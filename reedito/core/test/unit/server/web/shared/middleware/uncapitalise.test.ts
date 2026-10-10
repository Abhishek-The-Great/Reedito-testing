import express, { type Express } from 'express';
import request from 'supertest';
// @ts-expect-error This module lacks type definitions.
import uncapitalise from '../../../../../../core/server/web/shared/middleware/uncapitalise.js';

// NOTE: all URLs have trailing slashes before uncapitalise runs

describe('Middleware: uncapitalise', function () {
  function createApp(baseUrl?: string): Express {
    const app = express();
    if (baseUrl) {
      app.use(baseUrl, uncapitalise);
    } else {
      app.use(uncapitalise);
    }
    app.use((_req, res) => res.sendStatus(204));
    return app;
  }

  async function expectNoRedirect(path: string, baseUrl?: string) {
    await request(createApp(baseUrl))
      .get(`${baseUrl || ''}${path}`)
      .expect(204);
  }

  async function expectRedirect(path: string, location: string, baseUrl?: string) {
    await request(createApp(baseUrl))
      .get(`${baseUrl || ''}${path}`)
      .expect(301)
      .expect('Location', location);
  }

  describe('Signup or reset request', function () {
    it('[signup] does nothing if there are no capitals in req.path', async function () {
      await expectNoRedirect('/reedito/signup/');
    });

    it('[signup] does nothing if there are no capitals in baseUrl', async function () {
      await expectNoRedirect('/', '/reedito/signup');
    });

    it('[signup] does nothing if there are no capitals except in a token', async function () {
      await expectNoRedirect('/reedito/signup/XEB123', '/blog');
    });

    it('[reset] does nothing if there are no capitals except in a token', async function () {
      await expectNoRedirect(
        '/reedito/reset/NCR3NjY4NzI1ODI1OHzlcmlzZHNAZ51haWwuY29tfEpWeGxRWHUzZ3Y0cEpQRkNYYzQvbUZyc2xFSVozU3lIZHZWeFJLRml6cY54',
        '/blog',
      );
    });

    it('[signup] redirects if there are capitals in req.path', async function () {
      await expectRedirect('/reedito/SignUP/', '/reedito/signup/');
    });

    it('[signup] redirects if there are capitals in req.baseUrl', async function () {
      await expectRedirect('/', '/reedito/signup/', '/reedito/SignUP');
    });

    it('[signup] redirects correctly if there are capitals in req.path and req.baseUrl', async function () {
      await expectRedirect('/ghosT/signUp/', '/blog/reedito/signup/', '/Blog');
    });

    it('[signup] redirects correctly with capitals in req.path if there is a token', async function () {
      await expectRedirect('/ghosT/sigNup/XEB123', '/reedito/signup/XEB123');
    });

    it('[reset] redirects correctly with capitals in req.path & req.baseUrl if there is a token', async function () {
      const token =
        'NCR3NjY4NzI1ODI1OHzlcmlzZHNAZ51haWwuY29tfEpWeGxRWHUzZ3Y0cEpQRkNYYzQvbUZyc2xFSVozU3lIZHZWeFJLRml6cY54';

      await expectRedirect(`/Reedito/Reset/${token}`, `/blog/reedito/reset/${token}`, '/Blog');
    });
  });

  describe('An API request', function () {
    ['v0.1', 'canary', 'v10', null].forEach((apiVersion) => {
      const apiPath = apiVersion ? `/${apiVersion}` : '';

      describe(`for ${apiVersion}`, function () {
        it('does nothing if there are no capitals', async function () {
          await expectNoRedirect(`/reedito/api${apiPath}/endpoint/`);
        });

        it('version identifier is uppercase', async function () {
          if (apiVersion === null) {
            return;
          }

          await expectRedirect(
            `/reedito/api${apiPath.toUpperCase()}/endpoint/`,
            `/reedito/api${apiPath}/endpoint/`,
          );
        });

        it('redirects to lower-case slug if there are capitals', async function () {
          await expectRedirect(`/reedito/api${apiPath}/ASDfJ/`, `/reedito/api${apiPath}/asdfj/`);
        });

        it('redirects to lower-case slug if there are capitals in req.baseUrl', async function () {
          await expectRedirect(
            `/reedito/api${apiPath}/ASDfJ/`,
            `/blog/reedito/api${apiPath}/asdfj/`,
            '/Blog',
          );
        });

        it('does not convert capitals after endpoint', async function () {
          await expectRedirect(
            `/Reedito/API${apiPath}/settings/is_private/?filter=mAgic`,
            `/reedito/api${apiPath}/settings/is_private/?filter=mAgic`,
          );
        });

        it('does not convert capitals after endpoint with baseUrl', async function () {
          await expectRedirect(
            `/reedito/api${apiPath}/mail/test@example.COM/?filter=mAgic`,
            `/blog/reedito/api${apiPath}/mail/test@example.COM/?filter=mAgic`,
            '/Blog',
          );
        });
      });
    });
  });

  describe('Any other request', function () {
    it('does nothing if there are no capitals', async function () {
      await expectNoRedirect('/this-is-my-blog-post');
    });

    it('redirects to lower-case slug if there are capitals', async function () {
      await expectRedirect('/THis-iS-my-BLOg-poSt', '/this-is-my-blog-post');
    });
  });
});
