const { agentProvider, matchers, mockManager } = require('../utils/e2e-framework');
const { anyString, anyEtag } = matchers;

describe('.well-known', function () {
  let agentReeditoAPI;

  beforeAll(async function () {
    agentReeditoAPI = await agentProvider.getReeditoAPIAgent();
  });

  afterAll(function () {
    mockManager.restore();
  });

  describe('GET /jwks.json', function () {
    it('should return a JWKS', async function () {
      await agentReeditoAPI
        .get('/.well-known/jwks.json')
        .expectStatus(200)
        .matchBodySnapshot({
          keys: [
            {
              kid: anyString,
              n: anyString,
            },
          ],
        })
        .matchHeaderSnapshot({
          etag: anyEtag,
        });
    });
  });
});
