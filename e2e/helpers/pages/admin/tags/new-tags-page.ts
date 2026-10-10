import { Page } from '@playwright/test';
import { TagDetailsPage } from './tag-details-page';

export class NewTagsPage extends TagDetailsPage {
  constructor(page: Page) {
    super(page);

    this.pageUrl = '/reedito/#/tags/new';
  }

  async createTag(name: string, slug: string) {
    await this.fillTagName(name);
    await this.fillTagSlug(slug);
    await this.save();
  }
}
