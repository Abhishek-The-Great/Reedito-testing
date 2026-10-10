const assert = require('node:assert/strict');
const sinon = require('sinon');
const community = require('../../../../core/server/services/community');
const communityAdminController = require('../../../../core/server/api/endpoints/community-admin');

describe('Community admin controller', function () {
  afterEach(function () {
    sinon.restore();
  });

  it('does not let Super Editors access community moderation endpoints', async function () {
    const queueStub = sinon.stub(community, 'getModerationQueue');
    const reportStub = sinon.stub(community, 'reviewReport');
    const updateStub = sinon.stub(community, 'moderateUpdate');
    const frame = {
      user: { id: 'moderator-id', roles: [{ name: 'Super Editor' }] },
      options: { id: 'target-id' },
      data: { action: 'hide', status: 'hidden' },
    };

    await assert.rejects(
      communityAdminController.moderationQueue.query(frame),
      /Only publication owners and administrators can moderate community content\./,
    );
    await assert.rejects(
      communityAdminController.reviewReport.query(frame),
      /Only publication owners and administrators can moderate community content\./,
    );
    await assert.rejects(
      communityAdminController.moderateUpdate.query(frame),
      /Only publication owners and administrators can moderate community content\./,
    );

    sinon.assert.notCalled(queueStub);
    sinon.assert.notCalled(reportStub);
    sinon.assert.notCalled(updateStub);
  });

  it('allows publication Owners and Administrators to moderate community content', async function () {
    const queueStub = sinon.stub(community, 'getModerationQueue').resolves({ reports: [] });
    const reportStub = sinon.stub(community, 'reviewReport').resolves({ status: 'dismissed' });
    const updateStub = sinon.stub(community, 'moderateUpdate').resolves({ status: 'published' });
    const frame = {
      user: { id: 'moderator-id', roles: [{ name: 'Owner' }, { name: 'Administrator' }] },
      options: { id: 'target-id' },
      data: { action: 'dismiss', status: 'published' },
    };

    await communityAdminController.moderationQueue.query(frame);
    await communityAdminController.reviewReport.query(frame);
    await communityAdminController.moderateUpdate.query(frame);

    sinon.assert.calledOnce(queueStub);
    sinon.assert.calledOnceWithExactly(
      reportStub,
      'target-id',
      'moderator-id',
      'dismiss',
      undefined,
    );
    sinon.assert.calledOnceWithExactly(updateStub, 'target-id', 'moderator-id', 'published');
  });
});
