import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  checkDuplicateDependencies,
  collectLoadedFiles,
  formatDuplicateReport,
  parsePackageFromPath,
} from '../../../bin/lib/duplicate-deps';

// The fixture lives outside the project, so the runner leaves this import to Node
// and the file loads the way an ESM adapter would.
const nativeImport = (specifier: string) => import(/* @vite-ignore */ specifier);

/** Write a package, returning the file path a `require()` of it would cache. */
function writePackage(nodeModules: string, name: string, version: string): string {
  const packagePath = path.join(nodeModules, ...name.split('/'));
  fs.mkdirSync(packagePath, { recursive: true });
  fs.writeFileSync(path.join(packagePath, 'package.json'), JSON.stringify({ name, version }));
  fs.writeFileSync(path.join(packagePath, 'index.js'), 'module.exports = {};\n');

  return path.join(packagePath, 'index.js');
}

/**
 * The same in pnpm's isolated layout, how Reedito's own dependencies are installed:
 * the files live in the virtual store and the root name is only a symlink to them.
 */
function writePnpmPackage(nodeModules: string, name: string, version: string): string {
  const storeDirName = `${name.replace('/', '+')}@${version}`;
  const store = path.join(nodeModules, '.pnpm', storeDirName, 'node_modules');
  const indexPath = writePackage(store, name, version);

  const linkPath = path.join(nodeModules, ...name.split('/'));
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  fs.symlinkSync(path.dirname(indexPath), linkPath, 'dir');

  return indexPath;
}

describe('bin/lib/duplicate-deps', function () {
  describe('parsePackageFromPath', function () {
    it('attributes a file to the package directory that contains it', function () {
      assert.deepEqual(
        parsePackageFromPath('/home/reedito/adapters/storage/S3Storage/node_modules/lodash/index.js'),
        {
          name: 'lodash',
          path: '/home/reedito/adapters/storage/S3Storage/node_modules/lodash',
        },
      );
    });

    it("reads a scoped package out of pnpm's store layout, peer suffix and all", function () {
      // The store directory name is never parsed, so pnpm's encoding of the scope
      // (`+`) and of peer dependencies (`_`) doesn't have to be understood.
      assert.deepEqual(
        parsePackageFromPath(
          '/home/reedito/node_modules/.pnpm/@tryghost+metrics@1.0.3_pg@8.11.0/node_modules/@tryghost/metrics/lib/index.js',
        ),
        {
          name: '@tryghost/metrics',
          path: '/home/reedito/node_modules/.pnpm/@tryghost+metrics@1.0.3_pg@8.11.0/node_modules/@tryghost/metrics',
        },
      );
    });

    it('attributes a nested dependency to the package that physically contains it', function () {
      assert.deepEqual(
        parsePackageFromPath(
          '/home/reedito/node_modules/.pnpm/outer@1.0.0/node_modules/outer/node_modules/inner/index.js',
        ),
        {
          name: 'inner',
          path: '/home/reedito/node_modules/.pnpm/outer@1.0.0/node_modules/outer/node_modules/inner',
        },
      );
    });

    it('returns null for a file that is not inside a package', function () {
      assert.equal(parsePackageFromPath('/home/reedito/current/core/server/boot.js'), null);
      assert.equal(parsePackageFromPath('/home/reedito/adapters/storage/S3Storage/index.js'), null);
    });

    it("returns null for an installer's own directories, which are not packages", function () {
      // npm forbids a leading dot in a package name, so the whole class of them
      // goes without enumerating each installer's layout.
      assert.equal(parsePackageFromPath('/home/reedito/node_modules/.pnpm/lock.yaml'), null);
      assert.equal(parsePackageFromPath('/home/reedito/node_modules/.bin/knex-migrator'), null);
    });
  });

  describe('collectLoadedFiles', function () {
    it('keeps the CommonJS cache it is given, without duplicating entries', function () {
      const files = collectLoadedFiles([
        '/home/reedito/a.js',
        '/home/reedito/a.js',
        '/home/reedito/b.js',
      ]);

      assert.deepEqual(
        files.filter((file) => file.startsWith('/home/reedito/')),
        ['/home/reedito/a.js', '/home/reedito/b.js'],
      );
    });

    it('sees an ESM module, which the CommonJS cache never contains', async function () {
      const tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'reedito-esm-deps-')));
      const modulePath = path.join(tmpDir, 'adapter.mjs');
      fs.writeFileSync(modulePath, 'export const loaded = true;\n');

      try {
        await nativeImport(pathToFileURL(modulePath).href);

        assert.ok(
          collectLoadedFiles([]).includes(modulePath),
          'expected the imported ESM file to be reported as loaded',
        );
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('checkDuplicateDependencies', function () {
    let tmpDir: string;
    let reeditoNodeModules: string;
    let adapterRoot: string;
    let adapterNodeModules: string;

    // Two trees, the way managed deployments install them: Reedito's dependencies in pnpm's
    // isolated layout, and a self-contained adapter directory beside them.
    beforeEach(function () {
      tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'reedito-duplicate-deps-')));
      reeditoNodeModules = path.join(tmpDir, 'reedito', 'node_modules');
      adapterRoot = path.join(tmpDir, 'adapters');
      adapterNodeModules = path.join(adapterRoot, 'storage', 'S3Storage', 'node_modules');
      fs.mkdirSync(reeditoNodeModules, { recursive: true });
      fs.mkdirSync(adapterNodeModules, { recursive: true });
    });

    afterEach(function () {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function check(cachedFiles: string[], mustBeSingleCopy: string[] = ['reedito-storage-base']) {
      return checkDuplicateDependencies({
        cachedFiles,
        adapterRoots: [adapterRoot],
        reeditoNodeModulesRoots: [reeditoNodeModules],
        mustBeSingleCopy,
      });
    }

    it("reports nothing when the adapter shares Reedito's copy of every package", function () {
      const sharedBase = writePnpmPackage(reeditoNodeModules, 'reedito-storage-base', '1.1.0');
      const sharedLodash = writePnpmPackage(reeditoNodeModules, 'lodash', '4.17.20');
      const adapterOwn = writePackage(adapterNodeModules, 'aws-sdk', '2.1.0');

      const report = check([sharedBase, sharedLodash, adapterOwn]);

      assert.deepEqual(report.duplicates, []);
      assert.deepEqual(report.blocking, []);
    });

    it('reports a package the adapter brought its own copy of, without blocking', function () {
      const reeditoLodash = writePnpmPackage(reeditoNodeModules, 'lodash', '4.17.20');
      const adapterLodash = writePackage(adapterNodeModules, 'lodash', '4.17.21');

      const report = check([reeditoLodash, adapterLodash]);

      assert.deepEqual(report.duplicates, [
        {
          name: 'lodash',
          adapter: { version: '4.17.21', path: path.join(adapterNodeModules, 'lodash') },
          reedito: { version: '4.17.20', path: path.dirname(reeditoLodash) },
        },
      ]);
      assert.deepEqual(report.blocking, []);
    });

    it('blocks on a duplicate of a package that must be a single copy', function () {
      const reeditoBase = writePnpmPackage(reeditoNodeModules, 'reedito-storage-base', '1.1.0');
      const adapterBase = writePackage(adapterNodeModules, 'reedito-storage-base', '1.1.0');
      const adapterLodash = writePackage(adapterNodeModules, 'lodash', '4.17.21');
      const reeditoLodash = writePnpmPackage(reeditoNodeModules, 'lodash', '4.17.20');

      const report = check([reeditoBase, adapterBase, reeditoLodash, adapterLodash]);

      // Name order, and the identical version still counts: two copies of the
      // base class are still two function objects.
      assert.deepEqual(
        report.duplicates.map(({ name }) => name),
        ['reedito-storage-base', 'lodash'],
      );
      assert.deepEqual(
        report.blocking.map(({ name }) => name),
        ['reedito-storage-base'],
      );
      assert.equal(
        report.blocking[0].adapter.path,
        path.join(adapterNodeModules, 'reedito-storage-base'),
      );
      assert.equal(report.blocking[0].reedito.path, path.dirname(reeditoBase));
    });

    it('resolves symlinks before deciding which tree a file came from', function () {
      // Reedito caches pnpm's store path, but an adapter requiring the same copy
      // through the root symlink could surface the link path instead.
      const reeditoLodash = writePnpmPackage(reeditoNodeModules, 'lodash', '4.17.20');
      const throughSymlink = path.join(reeditoNodeModules, 'lodash', 'index.js');

      const report = check([throughSymlink]);

      assert.deepEqual(report.duplicates, []);
      assert.equal(
        parsePackageFromPath(fs.realpathSync(throughSymlink))?.path,
        path.dirname(reeditoLodash),
      );
    });

    it("treats an adapter installed inside the Reedito directory as the adapter's tree", function () {
      // content/adapters lives inside the installation, so the two aren't
      // mutually exclusive - the adapter has to win.
      const contentAdapters = path.join(tmpDir, 'reedito', 'content', 'adapters');
      const contentAdapterNodeModules = path.join(
        contentAdapters,
        'cache',
        'Redis',
        'node_modules',
      );
      fs.mkdirSync(contentAdapterNodeModules, { recursive: true });

      const reeditoIoredis = writePnpmPackage(reeditoNodeModules, 'ioredis', '5.3.0');
      const adapterIoredis = writePackage(contentAdapterNodeModules, 'ioredis', '5.4.0');

      const report = checkDuplicateDependencies({
        cachedFiles: [reeditoIoredis, adapterIoredis],
        adapterRoots: [contentAdapters],
        reeditoNodeModulesRoots: [reeditoNodeModules],
        mustBeSingleCopy: [],
      });

      assert.equal(report.duplicates.length, 1);
      assert.equal(report.duplicates[0].adapter.version, '5.4.0');
      assert.equal(report.duplicates[0].reedito.version, '5.3.0');
    });

    it('reports a copy whose manifest cannot be read as an unknown version', function () {
      const reeditoLodash = writePnpmPackage(reeditoNodeModules, 'lodash', '4.17.20');
      const adapterLodash = path.join(adapterNodeModules, 'lodash', 'index.js');
      fs.mkdirSync(path.dirname(adapterLodash), { recursive: true });
      fs.writeFileSync(adapterLodash, 'module.exports = {};\n');

      const report = check([reeditoLodash, adapterLodash]);

      assert.equal(report.duplicates.length, 1);
      assert.equal(report.duplicates[0].adapter.version, 'unknown');
      assert.equal(report.duplicates[0].reedito.version, '4.17.20');
    });

    it('ignores adapter paths that do not exist', function () {
      const reeditoLodash = writePnpmPackage(reeditoNodeModules, 'lodash', '4.17.20');

      const report = checkDuplicateDependencies({
        cachedFiles: [reeditoLodash],
        adapterRoots: [path.join(tmpDir, 'nope'), adapterRoot],
        reeditoNodeModulesRoots: [reeditoNodeModules],
        mustBeSingleCopy: [],
      });

      assert.deepEqual(report.duplicates, []);
    });
  });

  describe('formatDuplicateReport', function () {
    const duplicate = {
      name: 'reedito-storage-base',
      adapter: {
        version: '1.1.0',
        path: '/home/reedito/adapters/storage/S3Storage/node_modules/reedito-storage-base',
      },
      reedito: { version: '1.1.1', path: '/home/reedito/node_modules/reedito-storage-base' },
    };

    it('says so when there is nothing to report', function () {
      const output = formatDuplicateReport({ duplicates: [], blocking: [] });

      assert.match(output, /^ {2}ok {4}no duplicate dependencies\n$/);
    });

    it('names both copies, and passes when none of them must be a single copy', function () {
      const output = formatDuplicateReport({ duplicates: [duplicate], blocking: [] });

      assert.match(output, /1 package\(s\) loaded from both an adapter and Reedito/);
      assert.match(output, /adapter 1\.1\.0 {2}\/home\/reedito\/adapters/);
      assert.match(output, /reedito {3}1\.1\.1 {2}\/home\/reedito\/node_modules/);
      assert.ok(!output.includes('FAIL'));
    });

    it('marks a blocking duplicate as a failure', function () {
      const output = formatDuplicateReport({ duplicates: [duplicate], blocking: [duplicate] });

      assert.match(output, / {2}FAIL {2}duplicate dependencies: reedito-storage-base\n/);
    });
  });
});
