import { BasePage } from '@/helpers/pages';
import { Locator, Page } from '@playwright/test';
import { integrations } from '@reedito/test-data/selectors/settings';

export class IntegrationsSection extends BasePage {
  readonly integrationsSection: Locator;
  readonly integrationsHeading: Locator;
  readonly integrationsDescription: Locator;
  readonly integrationsAddButton: Locator;

  constructor(page: Page) {
    super(page, 'reedito/#/settings/integrations');

    this.integrationsSection = page.getByTestId(integrations);
    this.integrationsHeading = page.getByRole('heading', { level: 5, name: 'Integrations' });
    this.integrationsDescription = page.getByText('Make Reedito work with apps and tools');
    this.integrationsAddButton = page.getByRole('button', { name: 'Add custom integration' });
  }
}
