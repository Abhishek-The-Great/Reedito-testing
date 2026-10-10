import { AutomatedEmailFactory } from './factories/automated-email-factory';
import { CommentFactory } from './factories/comment-factory';
import { HttpClient } from './persistence/adapters/http-client';
import { InvitationTokenProvider, StaffAccountFactory } from './factories/staff-account-factory';
import { MemberFactory } from './factories/member-factory';
import { OfferFactory } from './factories/offer-factory';
import { PostFactory } from './factories/post-factory';
import { ReeditoAdminApiAdapter } from './persistence/adapters/reedito-api';
import { TagFactory } from './factories/tag-factory';
import { TierFactory } from './factories/tier-factory';

/**
 * Create a new PostFactory with API persistence
 * Uses the http client which already has the proper authentication headers and baseURL
 * configured (this would be Playwright's page.request)
 *
 * @param httpClient - client for requests with pre-defined authorization and base url
 * @returns PostFactory ready to use with the specified Reedito backend
 */
export function createPostFactory(httpClient: HttpClient): PostFactory {
  const adapter = new ReeditoAdminApiAdapter(httpClient, 'posts', {
    formats: 'mobiledoc,lexical,html',
  });
  return new PostFactory(adapter);
}

export function createTagFactory(httpClient: HttpClient): TagFactory {
  const adapter = new ReeditoAdminApiAdapter(httpClient, 'tags');
  return new TagFactory(adapter);
}

export function createMemberFactory(httpClient: HttpClient): MemberFactory {
  const adapter = new ReeditoAdminApiAdapter(httpClient, 'members');
  return new MemberFactory(adapter);
}

export function createTierFactory(httpClient: HttpClient): TierFactory {
  const adapter = new ReeditoAdminApiAdapter(httpClient, 'tiers');
  return new TierFactory(adapter, httpClient);
}

export function createOfferFactory(httpClient: HttpClient): OfferFactory {
  const adapter = new ReeditoAdminApiAdapter(httpClient, 'offers');
  return new OfferFactory(adapter, httpClient);
}

export function createAutomatedEmailFactory(httpClient: HttpClient): AutomatedEmailFactory {
  const adapter = new ReeditoAdminApiAdapter(httpClient, 'automated_emails');
  return new AutomatedEmailFactory(adapter);
}

export function createCommentFactory(httpClient: HttpClient): CommentFactory {
  const adapter = new ReeditoAdminApiAdapter(httpClient, 'comments');
  return new CommentFactory(adapter);
}

export function createStaffAccountFactory(
  httpClient: HttpClient,
  getInvitationToken: InvitationTokenProvider,
): StaffAccountFactory {
  return new StaffAccountFactory(httpClient, getInvitationToken);
}

export interface Factories {
  postFactory: PostFactory;
  tagFactory: TagFactory;
  memberFactory: MemberFactory;
  tierFactory: TierFactory;
  offerFactory: OfferFactory;
  automatedEmailFactory: AutomatedEmailFactory;
  commentFactory: CommentFactory;
}

/**
 * Helper for creating all factories with the same http client
 * @param httpClient - client for requests with pre-defined authorization and base url
 *
 * @returns All factories ready to use with the specified Reedito backend
 */
export function createFactories(httpClient: HttpClient): Factories {
  return {
    postFactory: createPostFactory(httpClient),
    tagFactory: createTagFactory(httpClient),
    memberFactory: createMemberFactory(httpClient),
    tierFactory: createTierFactory(httpClient),
    offerFactory: createOfferFactory(httpClient),
    automatedEmailFactory: createAutomatedEmailFactory(httpClient),
    commentFactory: createCommentFactory(httpClient),
  };
}
