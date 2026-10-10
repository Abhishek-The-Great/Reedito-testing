import { ApiPersistenceAdapter } from './api';
import { HttpClient } from './http-client';

type ReeditoApiResponse = {
  [key: string]: unknown[] | unknown;
};

/**
 * Reedito Admin API adapter that handles Reedito's API formatting conventions
 * All Reedito Admin API endpoints follow the pattern:
 * - Endpoint: /reedito/api/admin/{resource}
 * - Request transformation: { [resource]: [data] }
 * - Response transformation: response[resource][0]
 */
export class ReeditoAdminApiAdapter extends ApiPersistenceAdapter<unknown, ReeditoApiResponse> {
  constructor(httpClient: HttpClient, resourcePath: string, queryParams?: Record<string, string>) {
    // Extract the resource name from the path (e.g., 'posts' from 'posts' or 'posts/1234')
    const resource = resourcePath.split('/')[0];

    super({
      httpClient,
      endpoint: `/reedito/api/admin/${resourcePath}`,
      queryParams: queryParams || {},
      transformRequest: (data) => ({ [resource]: [data] }),
      transformResponse: (response: ReeditoApiResponse) => {
        const items = response[resource];
        return Array.isArray(items) ? items[0] : response;
      },
    });
  }
}
