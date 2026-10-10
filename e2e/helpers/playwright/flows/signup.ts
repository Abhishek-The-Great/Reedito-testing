import { HomePage } from '@/helpers/pages';
import { Page } from '@playwright/test';
import { SignUpPage, SignUpSuccessPage } from '@/portal-pages';
import { faker } from '@faker-js/faker';

export async function signupViaPortal(page: Page): Promise<{ emailAddress: string; name: string }> {
  const homePage = new HomePage(page);
  await homePage.goto();
  await homePage.openPortal();

  const signUpPage = new SignUpPage(page);
  const emailAddress = `test${faker.string.uuid()}@example.com`;
  const name = faker.person.fullName();
  await signUpPage.fillAndSubmit(emailAddress, name);

  const successPage = new SignUpSuccessPage(page);
  await successPage.waitForSignUpSuccess();
  await successPage.closePortal();

  return { emailAddress, name };
}

