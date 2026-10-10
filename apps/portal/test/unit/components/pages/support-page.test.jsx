import { render } from '../../../utils/test-utils';
import SupportPage from '../../../../src/components/pages/support-page';
import { getSiteData } from '../../../../src/utils/fixtures-generator';

describe('SupportPage', () => {
  test('shows Coming Soon when donations are disabled', async () => {
    const site = getSiteData({ paidMembersEnabled: false });
    site.donations_enabled = false;

    const { findByTestId, getByRole } = render(<SupportPage />, {
      overrideContext: { site, member: null },
    });

    expect(await findByTestId('payments-coming-soon')).toBeInTheDocument();
    expect(getByRole('heading', { name: 'Payments are coming soon' })).toBeInTheDocument();
  });
});
