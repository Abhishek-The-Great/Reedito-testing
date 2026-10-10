import { render, fireEvent } from '../../../utils/test-utils';
import PaymentsComingSoonPage from '../../../../src/components/pages/payments-coming-soon-page';

describe('PaymentsComingSoonPage', () => {
  test('explains disabled payment features and can be dismissed', () => {
    const { getByTestId, getByRole, getByText, mockDoActionFn } = render(
      <PaymentsComingSoonPage />,
    );

    expect(getByTestId('payments-coming-soon')).toBeInTheDocument();
    expect(getByRole('heading', { name: 'Payments are coming soon' })).toBeInTheDocument();
    expect(
      getByText(
        'Paid memberships, plan changes, gift purchases, tips, and paid offers are not available yet.',
      ),
    ).toBeInTheDocument();

    fireEvent.click(getByRole('button', { name: 'Close popup' }));
    expect(mockDoActionFn).toHaveBeenCalledWith('closePopup');
  });
});
