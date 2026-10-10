const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');

// Thing we are testing
const redirectAdminUrls = require('../../../../../core/server/web/admin/middleware/redirect-admin-urls');

describe('Admin App', function () {
  describe('middleware', function () {
    describe('redirectAdminUrls', function () {
      const app = express();

      app.use(redirectAdminUrls);
      app.use((req, res) => {
        res.json({ url: req.originalUrl });
      });

      it('should redirect a url which starts with reedito', async function () {
        await request(app).get('/reedito/x').expect(302).expect('Location', '/reedito/#/x');
      });

      it('should not redirect /reedito/ on its own', async function () {
        const { body } = await request(app).get('/reedito/').expect(200);

        assert.deepEqual(body, { url: '/reedito/' });
      });

      it('should not redirect url that starts with something other than /reedito/', async function () {
        const { body } = await request(app).get('/x/reedito/x').expect(200);

        assert.deepEqual(body, { url: '/x/reedito/x' });
      });

      it('should strip a trailing slash before building the hash url', async function () {
        await request(app)
          .get('/reedito/members/import/')
          .expect(302)
          .expect('Location', '/reedito/#/members/import');
      });

      it('should strip a trailing slash before the query string', async function () {
        await request(app)
          .get('/reedito/members/import/?source=link')
          .expect(302)
          .expect('Location', '/reedito/#/members/import?source=link');
      });

      it('should preserve trailing slashes inside query values', async function () {
        await request(app)
          .get('/reedito/members/import?next=/settings/')
          .expect(302)
          .expect('Location', '/reedito/#/members/import?next=/settings/');
      });
    });
  });
});
