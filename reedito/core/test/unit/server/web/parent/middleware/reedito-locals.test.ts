import assert from 'node:assert/strict';
import { assertExists } from '../../../../../utils/assertions';
import express from 'express';
import request from 'supertest';
import { reeditoLocals } from '../../../../../../core/server/web/parent/middleware/reedito-locals';

describe('reeditoLocals middleware', function () {
  const app = express();
  app.use(reeditoLocals);
  app.get('/awesome-post', (_req, res) => {
    res.json(res.locals);
  });

  it('sets all locals', async function () {
    const { body } = await request(app).get('/awesome-post');
    assertExists(body.version);
    assertExists(body.safeVersion);
    assert.equal(body.relativeUrl, '/awesome-post');
  });
});
