/* eslint-disable no-console */
import { getUrlHistory } from './utils/helpers';
import { HumanReadableError, chooseBestErrorMessage } from './utils/errors';
import { t } from './utils/i18n';

function displayErrorIfElementExists(errorEl, message) {
  if (errorEl) {
    errorEl.innerText = message;
  }
}

function handleError(error, form, errorEl) {
  form.classList.add('error');
  const defaultMessage = t('There was an error sending the email, please try again');
  displayErrorIfElementExists(errorEl, chooseBestErrorMessage(error, defaultMessage));
}

export async function formSubmitHandler({
  event,
  form,
  errorEl,
  siteUrl,
  submitHandler,
  doAction,
  captureException,
}) {
  form.removeEventListener('submit', submitHandler);
  event.preventDefault();
  if (errorEl) {
    errorEl.innerText = '';
  }
  form.classList.remove('success', 'invalid', 'error');
  const emailInput = event.target.querySelector('input[data-members-email]');
  const nameInput = event.target.querySelector('input[data-members-name]');
  const autoRedirect = form?.dataset?.membersAutoredirect || 'true';
  const email = emailInput?.value;
  const name = (nameInput?.value || '').trim() || undefined;
  let emailType = undefined;
  const labels = [];
  const newsletters = [];

  const labelInputs = event.target.querySelectorAll('input[data-members-label]') || [];
  for (let i = 0; i < labelInputs.length; ++i) {
    labels.push(labelInputs[i].value);
  }

  const newsletterInputs =
    event.target.querySelectorAll(
      'input[type=hidden][data-members-newsletter], input[type=checkbox][data-members-newsletter]:checked, input[type=radio][data-members-newsletter]:checked',
    ) || [];
  for (let i = 0; i < newsletterInputs.length; ++i) {
    newsletters.push({ name: newsletterInputs[i].value });
  }

  if (form.dataset.membersForm) {
    emailType = form.dataset.membersForm;
  }

  const wantsOTC = emailType === 'signin' && form?.dataset?.membersOtc === 'true';

  form.classList.add('loading');
  const urlHistory = getUrlHistory();
  const reqBody = {
    email: email,
    emailType: emailType,
    labels: labels,
    name: name,
    autoRedirect: autoRedirect === 'true',
  };
  if (wantsOTC) {
    reqBody.includeOTC = true;
  }
  if (urlHistory) {
    reqBody.urlHistory = urlHistory;
  }
  if (newsletterInputs.length > 0) {
    reqBody.newsletters = newsletters;
  } else {
    // If there was only check-able newsletter inputs in the form, but none were checked, set reqBody.newsletters
    // to an empty array so that the member is not signed up to the default newsletters
    const checkableNewsletterInputs =
      event.target.querySelectorAll('input[type=checkbox][data-members-newsletter]') || [];

    if (checkableNewsletterInputs.length > 0) {
      reqBody.newsletters = [];
    }
  }

  try {
    const integrityTokenRes = await fetch(`${siteUrl}/members/api/integrity-token/`, {
      method: 'GET',
    });
    const integrityToken = await integrityTokenRes.text();

    const magicLinkRes = await fetch(`${siteUrl}/members/api/send-magic-link/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...reqBody, integrityToken }),
    });

    form.addEventListener('submit', submitHandler);
    form.classList.remove('loading');
    if (magicLinkRes.ok) {
      form.classList.add('success');

      let responseBody;
      if (wantsOTC) {
        try {
          responseBody = await magicLinkRes.clone().json();
        } catch (e) {
          responseBody = undefined;
        }
      }

      const otcRef = responseBody?.otc_ref;
      if (otcRef && typeof doAction === 'function') {
        try {
          doAction('startSigninOTCFromCustomForm', {
            email: (email || '').trim(),
            otcRef,
            inboxLinks: responseBody?.inboxLinks,
          });
        } catch (e) {
          console.error(e);
          captureException?.(e);
        }
      }
    } else {
      const e = await HumanReadableError.fromApiResponse(magicLinkRes);
      const errorMessage = chooseBestErrorMessage(e, t('Failed to send magic link email'));
      displayErrorIfElementExists(errorEl, errorMessage);
      form.classList.add('error'); // Ensure error state is set here
    }
  } catch (err) {
    handleError(err, form, errorEl);
  }
}

export function handleDataAttributes({
  siteUrl,
  doAction,
  captureException,
} = {}) {
  if (!siteUrl) {
    return;
  }

  siteUrl = siteUrl.replace(/\/$/, '');
  Array.prototype.forEach.call(
    document.querySelectorAll('form[data-members-form]'),
    function (form) {
      const errorEl = form.querySelector('[data-members-error]');
      function submitHandler(event) {
        formSubmitHandler({
          event,
          errorEl,
          form,
          siteUrl,
          submitHandler,
          doAction,
          captureException,
        });
      }
      form.addEventListener('submit', submitHandler);
    },
  );

  Array.prototype.forEach.call(document.querySelectorAll('[data-members-plan]'), function (el) {
    el.addEventListener('click', (event) => event.preventDefault());
  });

  Array.prototype.forEach.call(
    document.querySelectorAll('[data-members-edit-billing]'),
    (el) => el.addEventListener('click', (event) => event.preventDefault()),
  );

  Array.prototype.forEach.call(
    document.querySelectorAll('[data-members-manage-billing]'),
    (el) => el.addEventListener('click', (event) => event.preventDefault()),
  );

  Array.prototype.forEach.call(document.querySelectorAll('[data-members-signout]'), function (el) {
    function clickHandler(event) {
      el.removeEventListener('click', clickHandler);
      event.preventDefault();
      el.classList.remove('error');
      el.classList.add('loading');
      fetch(`${siteUrl}/members/api/session`, {
        method: 'DELETE',
      }).then(function (res) {
        if (res.ok) {
          window.location.replace(siteUrl);
        } else {
          el.addEventListener('click', clickHandler);
          el.classList.remove('loading');
          el.classList.add('error');
        }
      });
    }
    el.addEventListener('click', clickHandler);
  });

  Array.prototype.forEach.call(
    document.querySelectorAll('[data-members-cancel-subscription]'),
    (el) => el.addEventListener('click', (event) => event.preventDefault()),
  );

  Array.prototype.forEach.call(
    document.querySelectorAll('[data-members-continue-subscription]'),
    (el) => el.addEventListener('click', (event) => event.preventDefault()),
  );
}
