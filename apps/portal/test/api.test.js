import setupReeditoApi from '../src/utils/api';
import { HumanReadableError } from '../src/utils/errors';
import { vi } from 'vitest';

describe('Portal API gift redemption', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('returns the gifts api payload for redeemable gift tokens', async () => {
    const reeditoApi = setupReeditoApi({ siteUrl: 'https://example.com' });

    vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          gifts: [
            {
              token: 'gift-token-123',
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const response = await reeditoApi.gift.fetchRedemptionData({ token: 'gift-token-123' });

    expect(response.gifts[0].token).toBe('gift-token-123');
    expect(window.fetch).toHaveBeenCalledWith(
      'https://example.com/members/api/gifts/gift-token-123/redeem/',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: undefined,
      },
    );
  });

  test('throws a human-readable error for 400 members api gift responses', async () => {
    const reeditoApi = setupReeditoApi({ siteUrl: 'https://example.com' });

    vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [
            {
              message: 'This gift has expired.',
            },
          ],
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    await expect(reeditoApi.gift.fetchRedemptionData({ token: 'gift-token-123' })).rejects.toEqual(
      new HumanReadableError('This gift has expired.'),
    );
  });

  test('preserves the gift error code from the members api', async () => {
    const reeditoApi = setupReeditoApi({ siteUrl: 'https://example.com' });

    vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [
            {
              message: 'This gift has expired.',
              code: 'GIFT_EXPIRED',
            },
          ],
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    await expect(reeditoApi.gift.fetchRedemptionData({ token: 'gift-token-123' })).rejects.toEqual(
      new HumanReadableError('This gift has expired.', {
        code: 'GIFT_EXPIRED',
      }),
    );
  });

  test('preserves the api error message for 404 members api gift responses', async () => {
    const reeditoApi = setupReeditoApi({ siteUrl: 'https://example.com' });

    vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [
            {
              message: 'Gift not found.',
            },
          ],
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    await expect(reeditoApi.gift.fetchRedemptionData({ token: 'gift-token-123' })).rejects.toEqual(
      new HumanReadableError('Gift not found.'),
    );
  });

  test('redeems a gift for a logged-in member via POST', async () => {
    const reeditoApi = setupReeditoApi({ siteUrl: 'https://example.com' });

    vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          gifts: [
            {
              token: 'gift-token-123',
              status: 'redeemed',
              consumes_at: '2030-01-01T00:00:00.000Z',
            },
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    const response = await reeditoApi.gift.redeem({ token: 'gift-token-123' });

    expect(response.gifts[0].status).toBe('redeemed');
    expect(window.fetch).toHaveBeenCalledWith(
      'https://example.com/members/api/gifts/gift-token-123/redeem/',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: '{}',
      },
    );
  });

  test('throws a human-readable error for 400 members api gift redeem responses', async () => {
    const reeditoApi = setupReeditoApi({ siteUrl: 'https://example.com' });

    vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          errors: [
            {
              message: 'This gift has already been redeemed.',
            },
          ],
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    await expect(reeditoApi.gift.redeem({ token: 'gift-token-123' })).rejects.toEqual(
      new HumanReadableError('This gift has already been redeemed.'),
    );
  });
});

describe('Portal API payment features', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test.each([
    'checkoutPlan',
    'continueGiftCheckout',
    'checkoutGift',
    'checkoutDonation',
    'editBilling',
    'manageBilling',
    'updateSubscription',
    'applyOffer',
  ])('%s rejects without contacting a payment provider', async (method) => {
    const reeditoApi = setupReeditoApi({ siteUrl: 'https://example.com' });
    vi.spyOn(window, 'fetch');

    await expect(reeditoApi.member[method]()).rejects.toThrow(
      'Paid memberships are disabled in this build.',
    );
    expect(window.fetch).not.toHaveBeenCalled();
  });
});

describe('Portal API reader community', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('uses the signed-in member session for reader community actions', async () => {
    const reeditoApi = setupReeditoApi({ siteUrl: 'https://example.com' });
    vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ reaction: 'clap' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await reeditoApi.community.react({ id: 'article id/with spaces', reaction: 'clap' });

    expect(window.fetch).toHaveBeenCalledWith(
      'https://example.com/members/api/community/reactions/article%20id%2Fwith%20spaces/',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ reaction: 'clap' }),
      },
    );
  });

  test('sends a content report and surfaces the server error message', async () => {
    const reeditoApi = setupReeditoApi({ siteUrl: 'https://example.com' });
    vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ errors: [{ message: 'You have reached the hourly limit for reports.' }] }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(
      reeditoApi.community.report({
        type: 'post',
        id: '0123456789abcdef01234567',
        reason: 'spam',
        details: 'Repeated links',
      }),
    ).rejects.toEqual(new HumanReadableError('You have reached the hourly limit for reports.'));

    expect(window.fetch).toHaveBeenCalledWith(
      'https://example.com/members/api/community/reports/post/0123456789abcdef01234567/',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ reason: 'spam', details: 'Repeated links' }),
      },
    );
  });
});
