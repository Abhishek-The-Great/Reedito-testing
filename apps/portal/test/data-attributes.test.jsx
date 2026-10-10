import App from '../src/app';
import {
  offer as FixtureOffer,
  site as FixturesSite,
  member as FixtureMember,
} from './utils/test-fixtures';
import { fireEvent, appRender, within, waitFor } from './utils/test-utils';
import setupReeditoApi from '../src/utils/api';
import * as helpers from '../src/utils/helpers';
import { formSubmitHandler, handleDataAttributes } from '../src/data-attributes';
import { getOfferData } from '../src/utils/fixtures-generator';
import { vi } from 'vitest';

// Mock data
function getMockData({ newsletterQuerySelectorResult = null } = {}) {
  const site = FixturesSite.singleTier.basic;
  const member = null;

  const errorEl = {
    innerText: '',
  };
  const siteUrl = 'https://portal.localhost';
  const submitHandler = () => {};
  const clickHandler = () => {};

  const form = {
    removeEventListener: vi.fn(),
    classList: { remove: vi.fn(), add: vi.fn() },
    dataset: { membersForm: 'signup' },
    addEventListener: vi.fn(),
  };
  vi.spyOn(form.classList, 'add');

  const element = {
    removeEventListener: () => {},
    dataset: {
      membersPlan: 'monthly',
      membersSuccess: 'https://portal.localhost/success',
      membersCancel: 'https://portal.localhost/cancel',
    },
    classList: {
      remove: () => {},
      add: () => {},
    },
    addEventListener: () => {},
  };

  const event = {
    preventDefault: () => {},
    target: {
      querySelector: (elem) => {
        if (elem === 'input[data-members-email]') {
          return {
            value: 'jamie@example.com',
          };
        }
        if (elem === 'input[data-members-name]') {
          return {
            value: 'Jamie Larsen',
          };
        }
      },
      querySelectorAll: (elem) => {
        if (elem === 'input[data-members-label]') {
          return [
            {
              value: 'Gold',
            },
          ];
        }
        if (
          elem ===
            'input[type=hidden][data-members-newsletter], input[type=checkbox][data-members-newsletter]:checked, input[type=radio][data-members-newsletter]:checked' &&
          newsletterQuerySelectorResult
        ) {
          return newsletterQuerySelectorResult;
        }
      },
    },
  };

  return {
    event,
    form,
    siteUrl,
    submitHandler,
    errorEl,
    clickHandler,
    site,
    member,
    element,
  };
}

async function setup({
  site,
  member = null,
  showPopup = true,
  offer = getOfferData(),
  checkoutPlan = () => Promise.resolve(),
  waitForTrigger = site.portal_button,
}) {
  const reeditoApi = setupReeditoApi({ siteUrl: site.url || 'https://portal.localhost' });

  reeditoApi.init = vi.fn(() => Promise.resolve({ site, member }));
  reeditoApi.member.sendMagicLink = vi.fn(() => Promise.resolve('success'));
  reeditoApi.member.getIntegrityToken = vi.fn(() => Promise.resolve('testtoken'));
  reeditoApi.member.checkoutPlan = vi.fn(checkoutPlan);
  reeditoApi.member.sessionData = vi.fn(() => Promise.resolve(member));
  reeditoApi.site.offer = vi.fn(() => Promise.resolve({ offers: [offer] }));

  const utils = appRender(<App api={reeditoApi} showPopup={showPopup} />);
  const triggerButtonFrame = waitForTrigger
    ? await utils.findByTitle(/portal-trigger/i)
    : utils.queryByTitle(/portal-trigger/i);

  return {
    reeditoApi,
    popupFrame: utils.queryByTitle(/portal-popup/i),
    triggerButtonFrame,
    ...utils,
  };
}

describe('Member Data attributes:', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock global fetch
    vi.spyOn(window, 'fetch').mockImplementation((url) => {
      if (url.includes('send-magic-link')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      }

      if (url.includes('api/integrity-token')) {
        return Promise.resolve({
          ok: true,
          text: async () => 'testtoken',
        });
      }

      if (url.includes('api/session')) {
        return Promise.resolve({
          ok: true,
          text: async () => {
            return 'session-identity';
          },
        });
      }

      return Promise.resolve({});
    });

    // Mock url history method
    vi.spyOn(helpers, 'getUrlHistory').mockImplementation(() => {
      return [
        {
          path: '/blog/',
          refMedium: null,
          refSource: 'ghost-explore',
          refUrl: 'https://example.com/blog/',
          time: 1611234567890,
        },
      ];
    });

    // Mock window.location
    const locationMock = vi.fn();
    delete window.location;
    window.location = { assign: locationMock };
    window.location.href = new URL('https://portal.localhost').href;
    window.location.hash = '';
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });
  describe('data-members-form', () => {
    test('allows free signup', async () => {
      const { event, form, errorEl, siteUrl, submitHandler } = getMockData();

      await formSubmitHandler({ event, form, errorEl, siteUrl, submitHandler });

      expect(window.fetch).toHaveBeenCalledTimes(2);
      const expectedBody = JSON.stringify({
        email: 'jamie@example.com',
        emailType: 'signup',
        labels: ['Gold'],
        name: 'Jamie Larsen',
        autoRedirect: true,
        urlHistory: [
          {
            path: '/blog/',
            refMedium: null,
            refSource: 'ghost-explore',
            refUrl: 'https://example.com/blog/',
            time: 1611234567890,
          },
        ],
        integrityToken: 'testtoken',
      });
      expect(window.fetch).toHaveBeenLastCalledWith(
        'https://portal.localhost/members/api/send-magic-link/',
        { body: expectedBody, headers: { 'Content-Type': 'application/json' }, method: 'POST' },
      );
    });

    test('trims whitespace from name on signup', async () => {
      // Simulate a name input with leading/trailing whitespace
      const { event, form, errorEl, siteUrl, submitHandler } = getMockData();
      const originalQuerySelector = event.target.querySelector;
      event.target.querySelector = vi.fn((selector) => {
        if (selector === 'input[data-members-name]') {
          return { value: '  Jamie Larsen  ' };
        }
        return originalQuerySelector(selector);
      });

      // Capture the request body sent to the API
      let capturedRequestBody;
      window.fetch.mockImplementation((url, options) => {
        if (url.includes('send-magic-link')) {
          capturedRequestBody = JSON.parse(options.body);
          return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
        }
        if (url.includes('integrity-token')) {
          return Promise.resolve({ ok: true, text: async () => 'token' });
        }
        return Promise.resolve({});
      });

      await formSubmitHandler({ event, form, errorEl, siteUrl, submitHandler });

      expect(capturedRequestBody.name).toBe('Jamie Larsen');
    });

    test('requests OTC magic link and opens Portal when flagged with data-members-otc=true', async () => {
      const { event, form, errorEl, siteUrl, submitHandler } = getMockData();
      form.dataset.membersForm = 'signin';
      form.dataset.membersOtc = 'true';

      const originalQuerySelector = event.target.querySelector;
      event.target.querySelector = vi.fn((selector) => {
        if (selector === 'input[data-members-email]') {
          return { value: ' jamie@example.com ' };
        }
        return originalQuerySelector(selector);
      });

      const doAction = vi.fn(() => Promise.resolve());

      const json = async () => ({ otc_ref: 'otc_test_ref' });
      window.fetch.mockImplementation((url) => {
        if (url.includes('send-magic-link')) {
          return Promise.resolve({
            ok: true,
            json,
            clone: () => ({ json }),
          });
        }

        if (url.includes('integrity-token')) {
          return Promise.resolve({
            ok: true,
            text: async () => 'testtoken',
          });
        }

        return Promise.resolve({ ok: true });
      });

      await formSubmitHandler({ event, form, errorEl, siteUrl, submitHandler, doAction });

      const magicLinkCall = window.fetch.mock.calls.find(([fetchUrl]) =>
        fetchUrl.includes('send-magic-link'),
      );
      const requestBody = JSON.parse(magicLinkCall[1].body);
      expect(requestBody.includeOTC).toBe(true);
      expect(doAction).toHaveBeenCalledWith('startSigninOTCFromCustomForm', {
        email: 'jamie@example.com',
        otcRef: 'otc_test_ref',
      });
      expect(form.classList.add).toHaveBeenCalledWith('success');
    });

    test('captures exceptions when OTC action fails', async () => {
      const { event, form, errorEl, siteUrl, submitHandler } = getMockData();
      form.dataset.membersForm = 'signin';
      form.dataset.membersOtc = 'true';

      const originalQuerySelector = event.target.querySelector;
      event.target.querySelector = vi.fn((selector) => {
        if (selector === 'input[data-members-email]') {
          return { value: ' jamie@example.com ' };
        }
        return originalQuerySelector(selector);
      });

      const actionErrorMessage = new Error('failed to start OTC sign-in');
      const doAction = vi.fn(() => {
        throw actionErrorMessage;
      });
      const captureException = vi.fn();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const json = async () => ({ otc_ref: 'otc_test_ref' });
      window.fetch.mockImplementation((url) => {
        if (url.includes('send-magic-link')) {
          return Promise.resolve({
            ok: true,
            json,
            clone: () => ({ json }),
          });
        }

        if (url.includes('integrity-token')) {
          return Promise.resolve({
            ok: true,
            text: async () => 'testtoken',
          });
        }

        return Promise.resolve({ ok: true });
      });

      await formSubmitHandler({
        event,
        form,
        errorEl,
        siteUrl,
        submitHandler,
        doAction,
        captureException,
      });

      expect(doAction).toHaveBeenCalledWith('startSigninOTCFromCustomForm', {
        email: 'jamie@example.com',
        otcRef: 'otc_test_ref',
      });
      expect(captureException).toHaveBeenCalledWith(actionErrorMessage);
      expect(consoleSpy).toHaveBeenCalledWith(actionErrorMessage);
      expect(form.classList.add).toHaveBeenCalledWith('success');

      consoleSpy.mockRestore();
    });
  });

  describe('payment data attributes', () => {
    test('blocks checkout and billing actions even when payment settings are stale', () => {
      const siteUrl = 'https://portal.localhost';
      const doAction = vi.fn();

      document.body.innerHTML = `
        <a href="/checkout" data-members-plan="monthly">Subscribe</a>
        <a href="/billing" data-members-edit-billing>Edit billing</a>
        <a href="/billing" data-members-manage-billing>Manage billing</a>
        <a href="/cancel" data-members-cancel-subscription="sub_123">Cancel</a>
        <a href="/continue" data-members-continue-subscription="sub_123">Continue</a>
      `;

      handleDataAttributes({
        siteUrl,
        site: { paid_members_enabled: true },
        offers: [{ redemption_type: 'retention' }],
        doAction,
      });

      const actions = document.querySelectorAll(
        '[data-members-plan], [data-members-edit-billing], [data-members-manage-billing], [data-members-cancel-subscription], [data-members-continue-subscription]',
      );
      actions.forEach((action) => {
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        expect(action.dispatchEvent(event)).toBe(false);
        expect(event.defaultPrevented).toBe(true);
      });

      expect(window.fetch).not.toHaveBeenCalled();
      expect(doAction).not.toHaveBeenCalled();
    });
  });

  describe('data-members-newsletter', () => {
    test('includes specified newsletters in request', async () => {
      const { event, form, errorEl, siteUrl, submitHandler } = getMockData({
        newsletterQuerySelectorResult: [
          {
            value: 'Some Newsletter',
          },
        ],
      });

      await formSubmitHandler({ event, form, errorEl, siteUrl, submitHandler });

      expect(window.fetch).toHaveBeenCalledTimes(2);
      const expectedBody = JSON.stringify({
        email: 'jamie@example.com',
        emailType: 'signup',
        labels: ['Gold'],
        name: 'Jamie Larsen',
        autoRedirect: true,
        urlHistory: [
          {
            path: '/blog/',
            refMedium: null,
            refSource: 'ghost-explore',
            refUrl: 'https://example.com/blog/',
            time: 1611234567890,
          },
        ],
        newsletters: [{ name: 'Some Newsletter' }],
        integrityToken: 'testtoken',
      });
      expect(window.fetch).toHaveBeenLastCalledWith(
        'https://portal.localhost/members/api/send-magic-link/',
        { body: expectedBody, headers: { 'Content-Type': 'application/json' }, method: 'POST' },
      );
    });

    test('does not include newsletters in request if there are no newsletter inputs', async () => {
      const { event, form, errorEl, siteUrl, submitHandler } = getMockData({
        newsletterQuerySelectorResult: [],
      });

      await formSubmitHandler({ event, form, errorEl, siteUrl, submitHandler });

      expect(window.fetch).toHaveBeenCalledTimes(2);
      const expectedBody = JSON.stringify({
        email: 'jamie@example.com',
        emailType: 'signup',
        labels: ['Gold'],
        name: 'Jamie Larsen',
        autoRedirect: true,
        urlHistory: [
          {
            path: '/blog/',
            refMedium: null,
            refSource: 'ghost-explore',
            refUrl: 'https://example.com/blog/',
            time: 1611234567890,
          },
        ],
        integrityToken: 'testtoken',
      });
      expect(window.fetch).toHaveBeenLastCalledWith(
        'https://portal.localhost/members/api/send-magic-link/',
        { body: expectedBody, headers: { 'Content-Type': 'application/json' }, method: 'POST' },
      );
    });
  });

  describe('data-portal', () => {
    test('opens default portal page', async () => {
      document.body.innerHTML = `
                <div data-portal> </div>
            `;
      let { popupFrame, triggerButtonFrame, ...utils } = await setup({
        site: FixturesSite.singleTier.basic,
        showPopup: false,
      });
      expect(popupFrame).not.toBeInTheDocument();
      expect(triggerButtonFrame).toBeInTheDocument();
      const portalElement = document.querySelector('[data-portal]');
      fireEvent.click(portalElement);
      popupFrame = await utils.findByTitle(/portal-popup/i);
      expect(popupFrame).toBeInTheDocument();
    });
  });

  describe('data-portal=signin', () => {
    test('opens Portal signin page', async () => {
      document.body.innerHTML = `
                <div data-portal="signin"> </div>
            `;
      let { popupFrame, triggerButtonFrame, ...utils } = await setup({
        site: FixturesSite.singleTier.basic,
        showPopup: false,
      });
      expect(popupFrame).not.toBeInTheDocument();
      expect(triggerButtonFrame).toBeInTheDocument();
      const portalElement = document.querySelector('[data-portal]');
      fireEvent.click(portalElement);
      popupFrame = await utils.findByTitle(/portal-popup/i);
      expect(popupFrame).toBeInTheDocument();
      const loginTitle = within(popupFrame.contentDocument).queryByText(/sign in/i);
      expect(loginTitle).toBeInTheDocument();
    });
  });

  describe('data-portal=signup', () => {
    test('opens Portal signup page', async () => {
      document.body.innerHTML = `
                <div data-portal="signup"> </div>
            `;
      let { popupFrame, triggerButtonFrame, ...utils } = await setup({
        site: FixturesSite.singleTier.basic,
        showPopup: false,
      });
      expect(popupFrame).not.toBeInTheDocument();
      expect(triggerButtonFrame).toBeInTheDocument();
      const portalElement = document.querySelector('[data-portal]');
      fireEvent.click(portalElement);
      popupFrame = await utils.findByTitle(/portal-popup/i);
      expect(popupFrame).toBeInTheDocument();
      const loginTitle = within(popupFrame.contentDocument).queryByText(/already a member/i);
      expect(loginTitle).toBeInTheDocument();
    });
  });

  describe('data-portal=signup/:tierid/monthly', () => {
    test('opens Portal signup page', async () => {
      const siteData = FixturesSite.singleTier.basic;
      const paidTier = siteData.products.find((p) => p.type === 'paid');

      document.body.innerHTML = `
                <div data-portal="signup/${paidTier.id}/monthly"> </div>
            `;
      let { popupFrame, triggerButtonFrame, ...utils } = await setup({
        site: FixturesSite.singleTier.basic,
        showPopup: false,
      });
      expect(popupFrame).not.toBeInTheDocument();
      expect(triggerButtonFrame).toBeInTheDocument();
      const portalElement = document.querySelector('[data-portal]');
      fireEvent.click(portalElement);
      popupFrame = await utils.findByTitle(/portal-popup/i);
      expect(popupFrame).toBeInTheDocument();
    });
  });

  describe('data-portal=offers/:offerid', () => {
    test('opens Portal offer page when the Portal button is disabled', async () => {
      const siteData = {
        ...FixturesSite.singleTier.basic,
        portal_button: false,
      };

      document.body.innerHTML = `
                <div data-portal="offers/${FixtureOffer.id}"> </div>
            `;
      let { reeditoApi, popupFrame, triggerButtonFrame, ...utils } = await setup({
        site: siteData,
        showPopup: false,
        waitForTrigger: false,
        offer: FixtureOffer,
      });
      expect(popupFrame).not.toBeInTheDocument();
      expect(triggerButtonFrame).not.toBeInTheDocument();

      const portalElement = document.querySelector('[data-portal]');
      await waitFor(() => {
        expect(portalElement).toHaveClass('gh-portal-close');
      });
      fireEvent.click(portalElement);

      popupFrame = await utils.findByTitle(/portal-popup/i);
      expect(popupFrame).toBeInTheDocument();
      // The offer page renders only after the async site.offer() request resolves.
      await waitFor(() => {
        expect(
          within(popupFrame.contentDocument).queryByText(FixtureOffer.display_title),
        ).toBeInTheDocument();
      });
      expect(reeditoApi.member.checkoutPlan).not.toHaveBeenCalled();
    });

    test('does not open Portal when a paid member opens an offer link', async () => {
      document.body.innerHTML = `
                <button data-portal="offers/${FixtureOffer.id}">Offer</button>
            `;

      const { reeditoApi, popupFrame, ...utils } = await setup({
        site: FixturesSite.singleTier.basic,
        member: FixtureMember.paid,
        showPopup: false,
        waitForTrigger: false,
        offer: FixtureOffer,
      });
      expect(popupFrame).not.toBeInTheDocument();

      const offerElement = document.querySelector('[data-portal^="offers"]');
      await waitFor(() => {
        expect(offerElement).toHaveClass('gh-portal-close');
      });

      fireEvent.click(offerElement);

      await waitFor(() => {
        expect(utils.queryByTitle(/portal-popup/i)).not.toBeInTheDocument();
      });
      const notificationFrame = await utils.findByTitle(/portal-notification/i);
      expect(
        within(notificationFrame.contentDocument).queryByText(
          /You already have an active subscription\./i,
        ),
      ).toBeInTheDocument();
      expect(reeditoApi.site.offer).not.toHaveBeenCalled();
      expect(reeditoApi.member.checkoutPlan).not.toHaveBeenCalled();
    });

    test('closes a stale loading modal when a paid member opens an offer link', async () => {
      const paidTier = FixturesSite.singleTier.basic.products.find((p) => p.type === 'paid');
      const pendingCheckout = new Promise((resolve) => {
        void resolve;
      });

      document.body.innerHTML = `
                <button data-portal="signup/${paidTier.id}/monthly">Checkout</button>
                <button data-portal="offers/${FixtureOffer.id}">Offer</button>
            `;

      let { reeditoApi, popupFrame, ...utils } = await setup({
        site: FixturesSite.singleTier.basic,
        member: FixtureMember.paid,
        showPopup: false,
        waitForTrigger: false,
        offer: FixtureOffer,
        checkoutPlan: () => pendingCheckout,
      });
      expect(popupFrame).not.toBeInTheDocument();

      const checkoutElement = document.querySelector('[data-portal^="signup"]');
      const offerElement = document.querySelector('[data-portal^="offers"]');
      await waitFor(() => {
        expect(checkoutElement).toHaveClass('gh-portal-close');
        expect(offerElement).toHaveClass('gh-portal-close');
      });

      fireEvent.click(checkoutElement);

      popupFrame = await utils.findByTitle(/portal-popup/i);
      await waitFor(() => {
        expect(within(popupFrame.contentDocument).queryByTestId('loaderIcon')).toBeInTheDocument();
      });

      fireEvent.click(offerElement);

      await waitFor(() => {
        expect(utils.queryByTitle(/portal-popup/i)).not.toBeInTheDocument();
      });
      const notificationFrame = await utils.findByTitle(/portal-notification/i);
      expect(
        within(notificationFrame.contentDocument).queryByText(
          /You already have an active subscription\./i,
        ),
      ).toBeInTheDocument();
      expect(reeditoApi.member.checkoutPlan).toHaveBeenCalledTimes(1);
      expect(reeditoApi.site.offer).not.toHaveBeenCalled();
    });
  });

  describe('data-portal=share', () => {
    test('opens Portal share page', async () => {
      document.body.innerHTML = `
                <div data-portal="share"> </div>
            `;
      let { popupFrame, triggerButtonFrame, ...utils } = await setup({
        site: FixturesSite.singleTier.basic,
        showPopup: false,
      });
      expect(popupFrame).not.toBeInTheDocument();
      expect(triggerButtonFrame).toBeInTheDocument();
      const portalElement = document.querySelector('[data-portal]');
      fireEvent.click(portalElement);
      popupFrame = await utils.findByTitle(/portal-popup/i);
      expect(popupFrame).toBeInTheDocument();
      const shareTitle = within(popupFrame.contentDocument).queryByText(/^Share$/i);
      expect(shareTitle).toBeInTheDocument();
    });
  });

  describe('data-portal=account', () => {
    test('opens Portal account home page', async () => {
      document.body.innerHTML = `
                <div data-portal="account"> </div>
            `;
      let { popupFrame, triggerButtonFrame, ...utils } = await setup({
        site: FixturesSite.singleTier.basic,
        member: FixtureMember.free,
        showPopup: false,
      });
      expect(popupFrame).not.toBeInTheDocument();
      expect(triggerButtonFrame).toBeInTheDocument();
      const portalElement = document.querySelector('[data-portal]');
      fireEvent.click(portalElement);
      popupFrame = await utils.findByTitle(/portal-popup/i);
      expect(popupFrame).toBeInTheDocument();
      const accountHomeTitle = within(popupFrame.contentDocument).queryByText(/your account/i);
      expect(accountHomeTitle).toBeInTheDocument();
    });
  });

  describe('data-portal=account/plans', () => {
    test('opens Portal account plan page', async () => {
      document.body.innerHTML = `
                <div data-portal="account/plans"> </div>
            `;
      let { popupFrame, triggerButtonFrame, ...utils } = await setup({
        site: FixturesSite.singleTier.basic,
        member: FixtureMember.free,
        showPopup: false,
      });
      expect(popupFrame).not.toBeInTheDocument();
      expect(triggerButtonFrame).toBeInTheDocument();
      const portalElement = document.querySelector('[data-portal]');
      fireEvent.click(portalElement);
      popupFrame = await utils.findByTitle(/portal-popup/i);
      expect(popupFrame).toBeInTheDocument();
      const accountPlanTitle = within(popupFrame.contentDocument).queryByText(/choose a plan/i);
      expect(accountPlanTitle).toBeInTheDocument();
    });
  });

  describe('data-portal=account/profile', () => {
    test('opens Portal account profile page', async () => {
      document.body.innerHTML = `
                <div data-portal="account/profile"> </div>
            `;
      let { popupFrame, triggerButtonFrame, ...utils } = await setup({
        site: FixturesSite.singleTier.basic,
        member: FixtureMember.free,
        showPopup: false,
      });
      expect(popupFrame).not.toBeInTheDocument();
      expect(triggerButtonFrame).toBeInTheDocument();
      const portalElement = document.querySelector('[data-portal]');
      fireEvent.click(portalElement);
      popupFrame = await utils.findByTitle(/portal-popup/i);
      expect(popupFrame).toBeInTheDocument();
      const accountProfileTitle = within(popupFrame.contentDocument).queryByText(
        /account settings/i,
      );
      expect(accountProfileTitle).toBeInTheDocument();
    });
  });

  describe('data-members-error', () => {
    test('displays error message when errorEl exists and network error occurs', async () => {
      const { event, form, errorEl, siteUrl, submitHandler } = getMockData();

      // Mock fetch to reject with a network error
      window.fetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')));

      await formSubmitHandler({ event, form, errorEl, siteUrl, submitHandler });

      expect(errorEl.innerText).toBe('There was an error sending the email, please try again');
      expect(form.classList.add).toHaveBeenCalledWith('error');
      expect(window.fetch).toHaveBeenCalledTimes(1);
    });

    test('handles error gracefully when errorEl is null', async () => {
      const { event, form, siteUrl, submitHandler } = getMockData();

      window.fetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')));

      await expect(
        formSubmitHandler({ event, form, errorEl: null, siteUrl, submitHandler }),
      ).resolves.not.toThrow();
      expect(form.classList.add).toHaveBeenCalledWith('error');
      expect(window.fetch).toHaveBeenCalledTimes(1);
    });

    test('handles error when email does not exist', async () => {
      const { event, form, errorEl, siteUrl, submitHandler } = getMockData();

      window.fetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () => 'testtoken',
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ errors: [{ message: 'Failed to send magic link email' }] }),
          status: 400,
        });

      await formSubmitHandler({ event, form, errorEl, siteUrl, submitHandler });

      expect(window.fetch).toHaveBeenCalledTimes(2);
      expect(form.classList.add).toHaveBeenCalledWith('error');
      expect(errorEl.innerText).toBe('Failed to send magic link email');
    });
  });
});
