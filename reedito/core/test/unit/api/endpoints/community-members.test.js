const assert = require('node:assert/strict');
const sinon = require('sinon');
const community = require('../../../../core/server/services/community');
const communityMembersController = require('../../../../core/server/api/endpoints/community-members');

describe('Community member digest preferences', function () {
  afterEach(function () {
    sinon.restore();
  });

  it('returns the current member digest preference', async function () {
    const read = sinon.stub(community, 'getDigestPreferences').resolves({ enabled: true });
    const frame = { options: { context: { member: { id: 'member-id' } } } };

    const result = await communityMembersController.digestPreferences.query(frame);

    assert.deepEqual(result, { enabled: true });
    sinon.assert.calledOnceWithExactly(read, 'member-id');
  });

  it('updates only the authenticated member digest preference', async function () {
    const update = sinon.stub(community, 'setDigestPreferences').resolves({ enabled: false });
    const frame = {
      options: { context: { member: { id: 'member-id' } } },
      data: { enabled: false },
    };

    const result = await communityMembersController.editDigestPreferences.query(frame);

    assert.deepEqual(result, { enabled: false });
    sinon.assert.calledOnceWithExactly(update, 'member-id', false);
  });
});
