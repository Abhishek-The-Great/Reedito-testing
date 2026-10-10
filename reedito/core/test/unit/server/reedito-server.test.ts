import assert from 'node:assert/strict';
import * as net from 'node:net';
import sinon from 'sinon';
import logging from '@tryghost/logging';
import express from 'express';
import { once } from 'node:events';
import { promisify } from 'node:util';
import { ReeditoServer } from '../../../core/server/reedito-server';

describe('ReeditoServer', function () {
  beforeEach(function () {
    sinon.stub(logging, 'info');
    sinon.stub(logging, 'warn');
    sinon.stub(logging, 'error');
  });

  afterEach(function () {
    sinon.restore();
  });

  describe('start', function () {
    it('errors if the address is already in use', async function () {
      const otherServer = net.createServer();
      const otherServerListeningPromise = once(otherServer, 'listening');
      otherServer.listen(0);
      await otherServerListeningPromise;
      const otherServerInfo = otherServer.address();
      assert(
        otherServerInfo && typeof otherServerInfo === 'object',
        'Test setup: other server should be listening on a host and port',
      );
      onTestFinished(async () => {
        await promisify(otherServer.close.bind(otherServer))();
      });

      const reeditoServer = new ReeditoServer({
        url: 'http://localhost:2368',
        env: 'testing',
        serverConfig: {
          host: otherServerInfo.address,
          port: otherServerInfo.port,
          shutdownTimeout: 1,
        },
      });

      await assert.rejects(reeditoServer.start(express()), {
        message: /EADDRINUSE/,
      });
    });

    it('errors if the server cannot be started', async function () {
      const reeditoServer = new ReeditoServer({
        url: 'http://localhost:2368',
        env: 'testing',
        serverConfig: {
          // Bogus host.
          host: '192.0.2.1',
          port: 0,
          shutdownTimeout: 1,
        },
      });

      await assert.rejects(reeditoServer.start(express()));
    });

    it('starts the server', async function () {
      const app = express();
      app.get('/', (_req, res) => {
        res.send('Hello world');
      });

      const reeditoServer = new ReeditoServer({
        url: 'http://localhost:2368',
        env: 'testing',
        serverConfig: {
          host: '127.0.0.1',
          port: 0,
          shutdownTimeout: 1,
        },
      });

      await reeditoServer.start(app);
      onTestFinished(async () => {
        await reeditoServer.stop();
      });

      const addressInfo = reeditoServer.__testOnlyAddress();
      assert(addressInfo, 'Reedito server should be listening on a host and port');
      const { address, port } = addressInfo;
      const res = await fetch(`http://${address}:${port}/`);
      const text = await res.text();
      assert.equal(text, 'Hello world');
    });
  });

  describe('stop', function () {
    let reeditoServer: ReeditoServer;

    beforeEach(function () {
      reeditoServer = new ReeditoServer({
        url: 'http://localhost:2368',
        env: 'testing',
        serverConfig: {
          host: '127.0.0.1',
          port: 0,
          shutdownTimeout: 1,
        },
      });
    });

    it('can be called even if the server is not running', async function () {
      await assert.doesNotReject(reeditoServer.stop());
    });

    it('stops the server and runs pre- and post-stop tasks', async function () {
      const prestopOk = sinon.stub();
      const prestopThrower = sinon.stub().throws(new Error('nope'));
      const cleanupOk = sinon.stub();
      reeditoServer.registerPreStopTask(prestopOk, 'pre-stop ok');
      reeditoServer.registerPreStopTask(prestopThrower, 'pre-stop thrower');
      reeditoServer.registerCleanupTask(cleanupOk, 'cleanup ok');
      await reeditoServer.start(express());

      await reeditoServer.stop();

      assert.equal(reeditoServer.__testOnlyAddress(), null);
      sinon.assert.callOrder(prestopOk, prestopThrower, cleanupOk);
    });

    it('rejects if any cleanup tasks reject, but calls them all', async function () {
      const cleanup1 = sinon.stub();
      const cleanup2 = sinon.stub();
      reeditoServer.registerCleanupTask(cleanup1);
      reeditoServer.registerCleanupTask(() => Promise.reject(new Error('nope')), 'bad');
      reeditoServer.registerCleanupTask(cleanup2);
      await reeditoServer.start(express());

      await assert.rejects(reeditoServer.stop(), /1 cleanup task\(s\) failed: bad/);

      sinon.assert.calledOnce(cleanup1);
      sinon.assert.calledOnce(cleanup2);
    });
  });

  describe('shutdown', function () {
    let reeditoServer: ReeditoServer;
    let reeditoServerStopStub: sinon.SinonStub;
    let processExitStub: sinon.SinonStub;

    beforeEach(function () {
      reeditoServer = new ReeditoServer({
        url: 'http://localhost:2368',
        env: 'testing',
        serverConfig: {
          host: '127.0.0.1',
          port: 0,
          shutdownTimeout: 1,
        },
      });

      reeditoServerStopStub = sinon.stub(reeditoServer, 'stop').resolves();
      processExitStub = sinon.stub(process, 'exit');
    });

    it('stops the server and exits the process', async function () {
      await reeditoServer.shutdown();

      sinon.assert.callOrder(reeditoServerStopStub, processExitStub);
    });

    it('exits with a specified error code if specified', async function () {
      await reeditoServer.shutdown(123);

      sinon.assert.calledWith(processExitStub, 123);
    });

    it('is a no-op if called multiple times', async function () {
      await reeditoServer.shutdown();
      await reeditoServer.shutdown();
      await reeditoServer.shutdown();

      sinon.assert.calledOnce(reeditoServerStopStub);
      sinon.assert.calledOnce(processExitStub);
    });

    it('exits with status code 1 if the server stop fails', async function () {
      reeditoServerStopStub.rejects(new Error('nope'));

      await reeditoServer.shutdown();

      sinon.assert.calledWith(processExitStub, 1);
    });
  });
});
