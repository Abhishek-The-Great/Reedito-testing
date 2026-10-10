import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const backupScript = path.join(scriptDirectory, 'backup-loop.sh');
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function runBackupCase(mode) {
  const root = await mkdtemp(path.join(os.tmpdir(), `reedito-backup-${mode}-`));
  const bin = path.join(root, 'bin');
  const logPath = path.join(root, 'calls.log');
  const sqlCapturePath = path.join(root, 'restic-stdin.sql');
  const mysqlPasswordPath = path.join(root, 'mysql-password');
  const resticPasswordPath = path.join(root, 'restic-password');
  await mkdir(bin);
  await writeFile(mysqlPasswordPath, 'test-only-password');
  await writeFile(resticPasswordPath, 'test-only-password');

  const resticPath = path.join(bin, 'restic');
  await writeFile(
    resticPath,
    `#!/bin/sh
printf 'restic:%s\\n' "$*" >> "$TEST_LOG"
if [ "$1" = snapshots ]; then exit 0; fi
if [ "$1" = backup ] && [ "${'${2:-}'}" = --stdin ]; then cat > "$TEST_STDIN_CAPTURE"; fi
exit 0
`,
  );
  await chmod(resticPath, 0o755);

  const mysqldumpPath = path.join(bin, 'mysqldump');
  await writeFile(
    mysqldumpPath,
    `#!/bin/sh
printf 'mysqldump:%s\\n' "$*" >> "$TEST_LOG"
if [ "$TEST_DUMP_MODE" = fail ]; then printf 'partial dump'; exit 37; fi
printf 'valid-sql-dump\\n'
`,
  );
  await chmod(mysqldumpPath, 0o755);

  const child = spawn('sh', [backupScript], {
    cwd: root,
    detached: true,
    env: {
      ...process.env,
      PATH: `${bin}${path.delimiter}${process.env.PATH}`,
      TEST_LOG: logPath,
      TEST_STDIN_CAPTURE: sqlCapturePath,
      TEST_DUMP_MODE: mode,
      TMPDIR: root,
      MYSQL_HOST: 'mysql-test',
      MYSQL_DATABASE: 'reedito-test',
      MYSQL_USER: 'reedito-test',
      MYSQL_PASSWORD_FILE: mysqlPasswordPath,
      RESTIC_REPOSITORY: 'local:test-repository',
      RESTIC_PASSWORD_FILE: resticPasswordPath,
      BACKUP_INTERVAL_SECONDS: '86400',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  const closed = new Promise((resolve) => child.once('close', resolve));

  try {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const calls = await readFile(logPath, 'utf8').catch(() => '');
      const reachedExpectedPoint =
        mode === 'success'
          ? calls.includes('restic:forget')
          : stderr.includes('Reedito database dump failed');
      if (reachedExpectedPoint) {
        break;
      }
      assert.equal(child.exitCode, null, `backup loop exited early: ${stderr}`);
      await pause(25);
    }

    const calls = await readFile(logPath, 'utf8').catch(() => '');
    if (mode === 'success') {
      assert.match(calls, /restic:backup --stdin --stdin-filename .* --tag mysql/);
      assert.match(calls, /restic:backup \/backup\/content --tag content/);
      assert.match(calls, /restic:forget --keep-daily 7 --keep-weekly 5 --keep-monthly 6 --prune/);
      assert.equal(await readFile(sqlCapturePath, 'utf8'), 'valid-sql-dump\n');
    } else {
      assert.match(stderr, /Reedito database dump failed/);
      assert.doesNotMatch(calls, /restic:backup/);
    }

    process.kill(-child.pid, 'SIGTERM');
    await Promise.race([
      closed,
      pause(3000).then(() => {
        throw new Error('backup process did not stop');
      }),
    ]);
    const tempFiles = (await readdir(root)).filter((name) => name.startsWith('tmp.'));
    assert.deepEqual(tempFiles, []);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch (error) {
        if (error.code !== 'ESRCH') {
          throw error;
        }
      }
      await Promise.race([closed, pause(3000)]);
    }
    await rm(root, { recursive: true, force: true });
  }
}

test('failed mysqldump never gets uploaded as a successful database backup', async () => {
  await runBackupCase('fail');
});

test('successful database, content, and retention backups run in sequence', async () => {
  await runBackupCase('success');
});
