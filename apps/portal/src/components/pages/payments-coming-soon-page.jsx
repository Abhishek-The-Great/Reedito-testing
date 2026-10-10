import { useContext } from 'react';
import AppContext from '../../app-context';
import CloseButton from '../common/close-button';
import { t } from '../../utils/i18n';

const PaymentsComingSoonPage = () => {
  const { brandColor } = useContext(AppContext);

  return (
    <div className="gh-portal-content" data-testid="payments-coming-soon">
      <CloseButton brandColor={brandColor} />
      <div className="gh-portal-section">
        <h1 className="gh-portal-main-title">{t('Payments are coming soon')}</h1>
        <p className="gh-portal-text-center">
          {t(
            'Paid memberships, plan changes, gift purchases, tips, and paid offers are not available yet.',
          )}
        </p>
        <p className="gh-portal-text-center">
          {t('If you already have a paid membership, contact the site owner for help managing it.')}
        </p>
      </div>
    </div>
  );
};

export default PaymentsComingSoonPage;
