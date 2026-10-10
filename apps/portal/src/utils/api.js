import { HumanReadableError } from './errors';
import { transformApiSiteData, transformApiTiersData, getUrlHistory } from './helpers';

const paymentUnavailable = () => new Error('Paid memberships are disabled in this build.');

function setupReeditoApi({ siteUrl = window.location.origin, apiUrl, apiKey }) {
  const apiPath = 'members/api';

  function endpointFor({ type, resource }) {
    if (type === 'members') {
      return `${siteUrl.replace(/\/$/, '')}/${apiPath}/${resource}/`;
    }
  }

  function contentEndpointFor({ resource, params = {} }) {
    if (apiUrl && apiKey) {
      const searchParams = new URLSearchParams({
        ...params,
        key: apiKey,
      });
      return `${apiUrl.replace(/\/$/, '')}/${resource}/?${searchParams.toString()}`;
    }
    return '';
  }

  function makeRequest({
    url,
    method = 'GET',
    headers = {},
    credentials = undefined,
    body = undefined,
  }) {
    const options = {
      method,
      headers,
      credentials,
      body,
    };
    return fetch(url, options);
  }
  const api = {};

  api.site = {
    read() {
      const url = endpointFor({ type: 'members', resource: 'site' });
      return makeRequest({
        url,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }).then(function (res) {
        if (res.ok) {
          return res.json();
        } else {
          throw new Error('Failed to fetch site data');
        }
      });
    },

    newsletters() {
      const url = contentEndpointFor({ resource: 'newsletters', params: { limit: 100 } });
      return makeRequest({
        url,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }).then(function (res) {
        if (res.ok) {
          return res.json();
        } else {
          throw new Error('Failed to fetch site data');
        }
      });
    },

    tiers() {
      const url = contentEndpointFor({
        resource: 'tiers',
        params: { limit: 100, include: 'monthly_price,yearly_price,benefits' },
      });
      return makeRequest({
        url,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }).then(function (res) {
        if (res.ok) {
          return res.json();
        } else {
          throw new Error('Failed to fetch site data');
        }
      });
    },

    settings() {
      const url = contentEndpointFor({ resource: 'settings' });
      return makeRequest({
        url,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }).then(function (res) {
        if (res.ok) {
          return res.json();
        } else {
          throw new Error('Failed to fetch site data');
        }
      });
    },

    offer({ offerId }) {
      const url = contentEndpointFor({ resource: `offers/${offerId}` });
      return makeRequest({
        url,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }).then(function (res) {
        if (res.ok) {
          return res.json();
        } else {
          throw new Error('Failed to fetch offer data');
        }
      });
    },

    recommendations({ limit = 100 } = { limit: 100 }) {
      const url = contentEndpointFor({ resource: 'recommendations', params: { limit } });
      return makeRequest({
        url,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }).then(function (res) {
        if (res.ok) {
          return res.json();
        } else {
          throw new Error('Failed to fetch recommendations');
        }
      });
    },
  };

  api.feedback = {
    async add({ uuid, key, postId, score }) {
      let url = endpointFor({ type: 'members', resource: 'feedback' });
      if (uuid && key) {
        // only necessary if not logged in, and both are required if so
        url = url + `?uuid=${uuid}&key=${key}`;
      }
      const body = {
        feedback: [
          {
            post_id: postId,
            score,
          },
        ],
      };
      const res = await makeRequest({
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        return res.json();
      } else {
        throw (
          (await HumanReadableError.fromApiResponse(res)) ?? new Error('Failed to save feedback')
        );
      }
    },
  };

  const communityRequest = async (resource, { method = 'GET', body } = {}) => {
    const url = endpointFor({ type: 'members', resource: `community/${resource}` });
    const res = await makeRequest({
      url,
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) {
      return res.status === 204 ? {} : res.json();
    }
    const humanError = await HumanReadableError.fromApiResponse(res);
    throw humanError ?? new Error('Community request failed');
  };

  api.community = {
    feed() {
      return communityRequest('feed');
    },
    bookmarks() {
      return communityRequest('bookmarks');
    },
    digestPreferences() {
      return communityRequest('digest');
    },
    updateDigestPreferences({ enabled }) {
      return communityRequest('digest', { method: 'PUT', body: { enabled } });
    },
    followCreator({ id }) {
      return communityRequest(`follow/creators/${encodeURIComponent(id)}`, { method: 'POST' });
    },
    unfollowCreator({ id }) {
      return communityRequest(`follow/creators/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    followTopic({ id }) {
      return communityRequest(`follow/topics/${encodeURIComponent(id)}`, { method: 'POST' });
    },
    unfollowTopic({ id }) {
      return communityRequest(`follow/topics/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    bookmark({ id }) {
      return communityRequest(`bookmarks/${encodeURIComponent(id)}`, { method: 'POST' });
    },
    unbookmark({ id }) {
      return communityRequest(`bookmarks/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    react({ id, reaction }) {
      return communityRequest(`reactions/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: { reaction },
      });
    },
    clearReaction({ id }) {
      return communityRequest(`reactions/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    report({ type, id, reason, details }) {
      return communityRequest(`reports/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, {
        method: 'POST',
        body: { reason, details },
      });
    },
    blockCreator({ id }) {
      return communityRequest(`blocks/creators/${encodeURIComponent(id)}`, { method: 'POST' });
    },
    unblockCreator({ id }) {
      return communityRequest(`blocks/creators/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  };

  const handleGiftResponse = async (res, fallbackMessage) => {
    if (res.ok) {
      return res.json();
    }

    const humanError = await HumanReadableError.fromApiResponse(res);
    if (humanError) {
      throw humanError;
    }

    throw new Error(fallbackMessage);
  };

  api.gift = {
    async fetchRedemptionData({ token }) {
      const url = endpointFor({
        type: 'members',
        resource: `gifts/${encodeURIComponent(token)}/redeem`,
      });
      const res = await makeRequest({
        url,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
      });

      return handleGiftResponse(res, 'Failed to load gift data');
    },

    async redeem({ token }) {
      const url = endpointFor({
        type: 'members',
        resource: `gifts/${encodeURIComponent(token)}/redeem`,
      });
      const res = await makeRequest({
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({}),
      });

      return handleGiftResponse(res, 'Failed to redeem gift');
    },
  };

  api.recommendations = {
    trackClicked({ recommendationId }) {
      const url = endpointFor({
        type: 'members',
        resource: 'recommendations/' + recommendationId + '/clicked',
      });
      navigator.sendBeacon(url);
    },

    trackSubscribed({ recommendationId }) {
      const url = endpointFor({
        type: 'members',
        resource: 'recommendations/' + recommendationId + '/subscribed',
      });
      navigator.sendBeacon(url);
    },
  };

  api.member = {
    identity() {
      const url = endpointFor({ type: 'members', resource: 'session' });
      return makeRequest({
        url,
        credentials: 'same-origin',
      }).then(function (res) {
        if (!res.ok || res.status === 204) {
          return null;
        }
        return res.text();
      });
    },

    sessionData() {
      const url = endpointFor({ type: 'members', resource: 'member' });
      return makeRequest({
        url,
        credentials: 'same-origin',
      }).then(function (res) {
        if (!res.ok || res.status === 204) {
          return null;
        }
        return res.json();
      });
    },

    /**
     * The custom fields the publisher has opened to members, in the publisher's order.
     *
     * Portal reaches older Reedito sites indefinitely, so a site without the endpoint — or
     * a field that does not say what the member may do with it — reads as no fields.
     */
    customFields() {
      const url = endpointFor({ type: 'members', resource: 'member/metafields/custom' });
      return makeRequest({
        url,
        credentials: 'same-origin',
      }).then(function (res) {
        if (!res.ok) {
          return [];
        }
        // Read defensively: Portal and the site it talks to are deployed apart, so this
        // endpoint may be missing, or answered by a version that shapes it differently.
        // Anything unrecognisable reads as no fields, which is what a site with none
        // gives, rather than breaking the page these are drawn on.
        return res
          .json()
          .then((data) => {
            const fields = data?.members_metafields;
            if (!Array.isArray(fields)) {
              return [];
            }
            // Every part a field is drawn from, not just enough to recognise one: a name
            // that is not text is rendered as a child and takes the page down with it,
            // and a type nothing can draw is no more useful than a field that is absent.
            return fields.filter(
              (field) =>
                field &&
                typeof field.key === 'string' &&
                field.key.length > 0 &&
                typeof field.name === 'string' &&
                typeof field.type === 'string' &&
                ['read', 'write'].includes(field.access?.member),
            );
          })
          .catch(() => []);
      });
    },

    update({
      name,
      subscribed,
      newsletters,
      enableCommentNotifications,
      enableUpdatesAndAnnouncements,
      metafields,
    }) {
      const url = endpointFor({ type: 'members', resource: 'member' });
      const body = {
        name,
        subscribed,
        newsletters,
      };
      if (metafields !== undefined) {
        body.metafields = metafields;
      }
      if (enableCommentNotifications !== undefined) {
        body.enable_comment_notifications = enableCommentNotifications;
      }
      if (enableUpdatesAndAnnouncements !== undefined) {
        body.enable_updates_and_announcements = enableUpdatesAndAnnouncements;
      }

      return makeRequest({
        url,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      }).then(async function (res) {
        if (!res.ok) {
          throw (
            (await HumanReadableError.fromApiResponse(res)) ?? new Error('Failed to update member')
          );
        }
        return res.json();
      });
    },

    deleteSuppression() {
      const url = endpointFor({ type: 'members', resource: 'member/suppression' });

      return makeRequest({
        url,
        method: 'DELETE',
      }).then(function (res) {
        if (!res.ok) {
          throw new Error('Your email has failed to resubscribe, please try again');
        }
        return true;
      });
    },

    async getIntegrityToken() {
      const url = endpointFor({ type: 'members', resource: 'integrity-token' });
      const res = await makeRequest({
        url,
        method: 'GET',
      });

      if (res.ok) {
        return res.text();
      } else {
        const humanError = await HumanReadableError.fromApiResponse(res);
        if (humanError) {
          throw humanError;
        }
        throw new Error('Failed to start a members session');
      }
    },

    /**
     * @returns {{
     *     inboxLinks?: {
     *         desktop: string;
     *         android: string;
     *         provider: 'gmail' | 'yahoo' | 'outlook' | 'proton' | 'icloud' | 'hey' | 'aol' | 'mailru';
     *     };
     *     otc_ref?: string;
     * }}
     */
    async sendMagicLink({
      email,
      emailType,
      labels,
      name,
      oldEmail,
      newsletters,
      redirect,
      integrityToken,
      phonenumber,
      customUrlHistory,
      token,
      giftToken,
      autoRedirect = true,
      includeOTC,
    }) {
      const url = endpointFor({ type: 'members', resource: 'send-magic-link' });
      const body = {
        name,
        email,
        newsletters,
        oldEmail,
        emailType,
        labels,
        requestSrc: 'portal',
        redirect,
        integrityToken,
        // we don't actually use a phone #, this is from a hidden field to prevent bot activity
        honeypot: phonenumber,
        token,
        giftToken,
        autoRedirect,
        includeOTC,
      };
      const urlHistory = customUrlHistory ?? getUrlHistory();
      if (urlHistory) {
        body.urlHistory = urlHistory;
      }

      const res = await makeRequest({
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('application/json')) {
          try {
            return await res.json();
          } catch (e) {
            // fall through to response used pre-OTC
          }
        }
        return {};
      } else {
        const humanError = await HumanReadableError.fromApiResponse(res);
        if (humanError) {
          throw humanError;
        }
        throw new Error('Failed to send magic link email');
      }
    },

    async verifyOTC({ otc, otcRef, redirect, integrityToken }) {
      const url = endpointFor({ type: 'members', resource: 'verify-otc' });
      const body = {
        otc,
        otcRef,
        redirect,
        integrityToken,
      };

      const res = await makeRequest({
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        return await res.json();
      } else {
        const humanError = await HumanReadableError.fromApiResponse(res);
        if (humanError) {
          throw humanError;
        }
        throw new Error('Failed to verify code');
      }
    },

    signout(all = false) {
      const url = endpointFor({ type: 'members', resource: 'session' });
      return makeRequest({
        url,
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          all,
        }),
      }).then(function (res) {
        if (res.ok) {
          window.location.replace(siteUrl);
          return 'Success';
        } else {
          throw new Error('Failed to signout');
        }
      });
    },

    async newsletters({ uuid, key }) {
      let url = endpointFor({ type: 'members', resource: `member/newsletters` });
      url = url + `?uuid=${uuid}&key=${key}`;
      return makeRequest({
        url,
        credentials: 'same-origin',
      }).then(function (res) {
        if (!res.ok || res.status === 204) {
          return null;
        }
        return res.json();
      });
    },

    async updateNewsletters({
      uuid,
      newsletters,
      key,
      enableCommentNotifications,
      enableUpdatesAndAnnouncements,
    }) {
      let url = endpointFor({ type: 'members', resource: `member/newsletters` });
      url = url + `?uuid=${uuid}&key=${key}`;
      const body = {
        newsletters,
      };

      if (enableCommentNotifications !== undefined) {
        body.enable_comment_notifications = enableCommentNotifications;
      }

      if (enableUpdatesAndAnnouncements !== undefined) {
        body.enable_updates_and_announcements = enableUpdatesAndAnnouncements;
      }

      return makeRequest({
        url,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }).then(function (res) {
        if (res.ok) {
          return res.json();
        } else {
          throw new Error('Failed to update email preferences');
        }
      });
    },

    async updateEmailAddress({ email }) {
      const identity = await api.member.identity();
      const url = endpointFor({ type: 'members', resource: 'member/email' });
      const body = {
        email,
        identity,
      };

      return makeRequest({
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }).then(async function (res) {
        if (res.ok) {
          return 'Success';
        } else {
          const errData = await res.json();
          const errMssg =
            errData?.errors?.[0]?.message || 'Failed to send email address verification email';
          throw new Error(errMssg);
        }
      });
    },

    async checkoutPlan() {
      throw paymentUnavailable();
    },

    async continueGiftCheckout() {
      throw paymentUnavailable();
    },

    async checkoutGift() {
      throw paymentUnavailable();
    },

    async checkoutDonation() {
      throw paymentUnavailable();
    },

    async editBilling() {
      throw paymentUnavailable();
    },

    async manageBilling() {
      throw paymentUnavailable();
    },

    async updateSubscription() {
      throw paymentUnavailable();
    },

    async offers() {
      const identity = await api.member.identity();
      const url = endpointFor({ type: 'members', resource: 'member/offers' });

      return makeRequest({
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identity }),
      })
        .then(function (res) {
          if (!res.ok) {
            return { offers: [] };
          }
          return res.json();
        })
        .catch(function () {
          return { offers: [] };
        });
    },

    async applyOffer() {
      throw paymentUnavailable();
    },
  };

  api.init = async () => {
    const [member] = await Promise.all([api.member.sessionData()]);
    let site = {};
    let newsletters = [];
    let tiers = [];
    let settings = {};
    let offers = [];

    try {
      [{ settings }, { tiers }, { newsletters }] = await Promise.all([
        api.site.settings(),
        api.site.tiers(),
        api.site.newsletters(),
      ]);
      site = {
        ...settings,
        newsletters,
        tiers: transformApiTiersData({ tiers }),
      };
    } catch (e) {
      // Ignore
    }

    if (site.paid_members_enabled === true && member && member.paid) {
      try {
        const offersData = await api.member.offers();

        offers = offersData.offers || [];
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[Portal] Failed to load member offers:', e);
      }
    }

    site = transformApiSiteData({ site });

    return { site, member, offers };
  };

  return api;
}

export default setupReeditoApi;
