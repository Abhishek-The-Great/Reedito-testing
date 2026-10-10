import baseDebug from '@tryghost/debug';
import { User, UserFactory } from '@/data-factory';

const debug = baseDebug('e2e:helpers:utils:setup-user');

export class ReeditoUserSetup {
  private readonly baseURL: string;
  private readonly headers: Record<string, string>;
  private readonly setupAuthEndpoint = '/reedito/api/admin/authentication/setup';

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.headers = { 'Content-Type': 'application/json' };
  }

  async setup(userOverrides: Partial<User> = {}): Promise<void> {
    debug('setup-user called');
    if (await this.isSetupAlreadyCompleted()) {
      debug('Reedito user setup is already completed.');
      return;
    }

    const user = new UserFactory().build(userOverrides);
    await this.createUser(user);
  }

  private async isSetupAlreadyCompleted(): Promise<boolean> {
    const response = await this.makeRequest('GET');
    const data = await response.json();
    debug('Setup status response:', data);
    return data.setup?.[0]?.status === true;
  }

  private async createUser(user: User): Promise<void> {
    await this.makeRequest('POST', { setup: [user] });
    debug('Reedito user created successfully.');
  }

  private async makeRequest(method: 'GET' | 'POST', body?: unknown): Promise<Response> {
    const options: RequestInit = { method, headers: this.headers };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseURL}${this.setupAuthEndpoint}`, options);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Reedito setup ${method} failed (${response.status}): ${error}`);
    }

    return response;
  }
}

export async function setupUser(baseReeditoUrl: string, user: Partial<User> = {}): Promise<void> {
  const reeditoUserSetup = new ReeditoUserSetup(baseReeditoUrl);
  await reeditoUserSetup.setup(user);
}
