import { useEffect, useState, useContext } from 'react';
import SupportError from './support-error';
import LoadingPage from './loading-page';
import PaymentsComingSoonPage from './payments-coming-soon-page';
import setupReeditoApi from '../../utils/api';
import AppContext from '../../app-context';
import { t } from '../../utils/i18n';

const SupportPage = () => {
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [disabledFeatureError, setDisabledFeatureError] = useState(null);
  const { member, site } = useContext(AppContext);

  useEffect(() => {
    async function checkoutDonation() {
      const siteUrl = site.url;
      const currentUrl = window.location.origin + window.location.pathname;
      const successUrl = member
        ? `${currentUrl}?action=support&success=true`
        : `${currentUrl}#/portal/support/success`;
      const cancelUrl = currentUrl;
      const api = setupReeditoApi({ siteUrl });

      try {
        const response = await api.member.checkoutDonation({
          successUrl,
          cancelUrl,
          personalNote: t('Add a personal note'),
        });

        if (response.url) {
          window.location.replace(response.url);
        }
      } catch (err) {
        if (err.type && err.type === 'DisabledFeatureError') {
          setDisabledFeatureError(t('This site is not accepting payments at the moment.'));
        } else {
          setError(t('Something went wrong, please try again later.'));
        }

        setLoading(false);
      }
    }

    if (site && site.donations_enabled === false) {
      setDisabledFeatureError(t('This site is not accepting donations at the moment.'));
      setLoading(false);
    } else {
      checkoutDonation();
    }

    // Do it once
  }, []);

  if (isLoading) {
    if (site?.donations_enabled === false) {
      return <PaymentsComingSoonPage />;
    }

    return (
      <div>
        <LoadingPage />
      </div>
    );
  }

  if (error) {
    return <SupportError error={error} />;
  }

  if (disabledFeatureError) {
    return <PaymentsComingSoonPage />;
  }

  return null;
};

export default SupportPage;
