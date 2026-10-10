const { DataImportError } = require('@tryghost/errors');
const logging = require('@tryghost/logging');
const tpl = require('@tryghost/tpl');

const messages = {
  productNotFound: 'Cannot find Product {id}',
  noStripeConnection: 'Cannot {action} without a Stripe Connection',
  forceNoCustomer: 'Cannot find Stripe customer to update subscription',
  forceNoExistingSubscription:
    'Cannot update subscription when customer does not have an existing subscription',
  forceTooManySubscriptions: 'Cannot update subscription when customer has multiple subscriptions',
  forceTooManySubscriptionItems:
    'Cannot update subscription when existing subscription has multiple items',
  forceExistingSubscriptionNotRecurring:
    'Cannot update subscription when existing subscription is not recurring',
};

module.exports = class MembersCSVImporterStripeUtils {
  /**
   * @param {Object} stripeAPIService
   * @param {Object} productRepository
   */
  constructor({ stripeAPIService, productRepository }) {
    this._stripeAPIService = stripeAPIService;
    this._productRepository = productRepository;
  }

  /**
   * Force a Stripe customer to be subscribed to a specific Reedito product
   *
   * This will either:
   *
   * Create a new price on the Stripe product that is associated with the Reedito product, then update
   * the customer's Stripe subscription to use the new price. The new price will be created with the details of the
   * existing price of the item in customer's Stripe subscription
   *
   * or
   *
   * Update the customer's stripe subscription to use an existing price on the Stripe product that matches the
   * details of the existing price of the item in customer's Stripe subscription
   *
   * If there is no Stripe product associated with the Reedito product, one will be created
   *
   * This method should be used in-conjunction with `MembersRepository.linkSubscription` to ensure
   * that the changes made in Stripe are reflected in Reedito - This is not executed as part of this to allow for
   * flexibility and reduce duplication
   *
   * @param {Object} data
   * @param {string} data.customer_id - Stripe customer ID
   * @param {string} data.product_id - Reedito product ID
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async forceStripeSubscriptionToProduct(data, options) {
    if (!this._stripeAPIService.configured) {
      throw new DataImportError({
        message: tpl(messages.noStripeConnection, { action: 'force subscription to product' }),
      });
    }

    // Retrieve customer's existing subscription information
    const stripeCustomer = await this._stripeAPIService.getCustomer(data.customer_id);

    // Subscription can only be forced if the customer exists
    if (!stripeCustomer) {
      throw new DataImportError({ message: tpl(messages.forceNoCustomer) });
    }

    // Subscription can only be forced if the customer has an existing subscription
    if (stripeCustomer.subscriptions.data.length === 0) {
      throw new DataImportError({ message: tpl(messages.forceNoExistingSubscription) });
    }

    // Subscription can only be forced if the customer does not have multiple subscriptions
    if (stripeCustomer.subscriptions.data.length > 1) {
      throw new DataImportError({ message: tpl(messages.forceTooManySubscriptions) });
    }

    const stripeSubscription = stripeCustomer.subscriptions.data[0];

    // Subscription can only be forced if the existing subscription does not have multiple items
    if (stripeSubscription.items.data.length > 1) {
      throw new DataImportError({ message: tpl(messages.forceTooManySubscriptionItems) });
    }

    const stripeSubscriptionItem = stripeSubscription.items.data[0];
    const stripeSubscriptionItemPrice = stripeSubscriptionItem.price;
    const stripeSubscriptionItemPriceCurrency = stripeSubscriptionItemPrice.currency;
    const stripeSubscriptionItemPriceAmount = stripeSubscriptionItemPrice.unit_amount;
    const stripeSubscriptionItemPriceType = stripeSubscriptionItemPrice.type;
    const stripeSubscriptionItemPriceInterval =
      stripeSubscriptionItemPrice.recurring?.interval || null;

    // Subscription can only be forced if the existing subscription has a recurring interval
    if (!stripeSubscriptionItemPriceInterval) {
      throw new DataImportError({ message: tpl(messages.forceExistingSubscriptionNotRecurring) });
    }

    // Retrieve Reedito product
    let reeditoProduct = await this._productRepository.get(
      { id: data.product_id },
      { ...options, withRelated: ['stripePrices', 'stripeProducts'] },
    );

    if (!reeditoProduct) {
      throw new DataImportError({
        message: tpl(messages.productNotFound, { id: data.product_id }),
      });
    }

    // If there is not a Stripe product associated with the Reedito product, ensure one is created before continuing
    if (!reeditoProduct.related('stripeProducts').first()) {
      // Even though we are not updating any information on the product, calling `ProductRepository.update`
      // will ensure that the product gets created in Stripe
      reeditoProduct = await this._productRepository.update(
        {
          id: data.product_id,
          name: reeditoProduct.get('name'),
          // Providing the pricing details will ensure the relevant prices for the Reedito product are created
          // on the Stripe product
          monthly_price: {
            amount: reeditoProduct.get('monthly_price'),
            currency: reeditoProduct.get('currency'),
          },
          yearly_price: {
            amount: reeditoProduct.get('yearly_price'),
            currency: reeditoProduct.get('currency'),
          },
        },
        options,
      );
    }

    // Find price on Reedito product matching stripe subscription item price details
    const reeditoProductPrice = reeditoProduct.related('stripePrices').find((price) => {
      return (
        price.get('currency') === stripeSubscriptionItemPriceCurrency &&
        price.get('amount') === stripeSubscriptionItemPriceAmount &&
        price.get('type') === stripeSubscriptionItemPriceType &&
        price.get('interval') === stripeSubscriptionItemPriceInterval
      );
    });

    let stripePriceId;
    let isNewStripePrice = false;

    if (!reeditoProductPrice) {
      // If there is not a matching price, create one on the associated Stripe product using the existing
      // subscription item price details and update the stripe subscription to use it
      const stripeProduct = reeditoProduct.related('stripeProducts').first();

      const newStripePrice = await this._stripeAPIService.createPrice({
        product: stripeProduct.get('stripe_product_id'),
        active: true,
        nickname: stripeSubscriptionItemPriceInterval === 'month' ? 'Monthly' : 'Yearly',
        currency: stripeSubscriptionItemPriceCurrency,
        amount: stripeSubscriptionItemPriceAmount,
        type: stripeSubscriptionItemPriceType,
        interval: stripeSubscriptionItemPriceInterval,
      });

      try {
        await this._stripeAPIService.updateSubscriptionItemPrice(
          stripeSubscription.id,
          stripeSubscriptionItem.id,
          newStripePrice.id,
          { prorationBehavior: 'none' },
        );
      } catch (err) {
        // The subscription update failed after we created a new price, which would
        // otherwise leave the price orphaned on the Stripe product (these accumulate
        // across imports). Archive it, then surface the original error regardless of
        // whether archiving succeeds. Ref: https://github.com/TryGhost/Ghost/issues/22115
        try {
          await this.archivePrice(newStripePrice.id);
        } catch (archiveErr) {
          logging.warn(
            {
              event: { name: 'members.import.orphaned_price_archive_failed' },
              err: archiveErr,
              stripePriceId: newStripePrice.id,
            },
            'Failed to archive an orphaned Stripe price after a failed subscription update',
          );
        }
        throw err;
      }

      stripePriceId = newStripePrice.id;
      isNewStripePrice = true;
    } else {
      // If there is a matching price, and the subscription is not already using it,
      // update the subscription to use it
      stripePriceId = reeditoProductPrice.get('stripe_price_id');

      if (stripeSubscriptionItem.price.id !== stripePriceId) {
        await this._stripeAPIService.updateSubscriptionItemPrice(
          stripeSubscription.id,
          stripeSubscriptionItem.id,
          stripePriceId,
          { prorationBehavior: 'none' },
        );
      }
    }

    // If there is a matching price, and the subscription is already using it, nothing else needs to be done

    return {
      stripePriceId,
      isNewStripePrice,
    };
  }

  /**
   * Archive a price in Stripe
   *
   * @param {number} stripePriceId
   * @returns {Promise<void>}
   */
  async archivePrice(stripePriceId) {
    await this._stripeAPIService.updatePrice(stripePriceId, { active: false });
  }
};
