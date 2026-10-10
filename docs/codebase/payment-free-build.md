# Payment-free build

This fork disables payment processing and provider-managed membership checkout.
Stripe Connect, checkout, billing portal, subscription mutation, webhook, and
machine-payment routes are unavailable. Admin reports paid membership and
donation processing as disabled even if an upgraded database still contains
old provider credentials.

Free member signup, signin, newsletter subscriptions, and gift redemption remain
available. Historical payment and subscription tables are preserved so existing
databases can upgrade without losing records. They are read-only in the Admin
interface.

When a reader opens a disabled paid-membership, plan-change, paid-offer,
donation/tip, or gift-purchase action, Reedito displays a localized “Payments
are coming soon” page. Paid links in the editors are hidden while payments are
disabled. This notice is a user-interface explanation only: it does not start
checkout, alter an existing paid entitlement, or manage a provider subscription.

The build does not contact a payment provider to cancel existing subscriptions.
If a site already has active recurring subscriptions, its owner must manage or
cancel them through the provider account.

This guide records the prior payment-free change, not a guarantee that payments
will remain out of product scope. On 2026-09-25 the user requested monetization
features again. They are not implemented or enabled in this source revision:
dormant Stripe-coupled code is not an active or provider-neutral gateway, and
adding API keys alone does not enable checkout. Track implementation and release
status in the root [`version.md`](../../version.md). Any new payment flow must
verify provider signatures server-side, handle duplicate and out-of-order
webhooks idempotently, and test refunds, renewals, cancellations, and account
access before accepting live payments.
