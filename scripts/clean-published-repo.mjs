// One-time cleanup for the verified, single-commit SpaCare repository.
// Run --check for a read-only preview. Local artifact files are never deleted.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const oldCommit = '8946c90c9e4ee9bb880425a09dde6f361bf628cf';
const remote = 'https://github.com/LeHoangViet9/SpaCare.git';
function git(...args) {
  const result = spawnSync('git', ['-C', root, ...args], {
    encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || result.stderr || `Git failed: ${args[0]}`);
  }
  return result.stdout.trimEnd();
}
function requireState(condition, message) { if (!condition) throw new Error(`Stop: ${message}`); }
const lines = text => text ? text.split(/\r?\n/) : [];
const artifacts = /^(\.idea\/|outputs\/|tmp_library_inspect\/|test-results\.txt$)/;

try {
  requireState(git('branch', '--show-current') === 'main', 'checkout main first.');
  requireState(git('rev-parse', 'HEAD') === oldCommit, 'local history changed; review before rewriting it.');
  requireState(git('rev-list', '--count', 'HEAD') === '1', 'this script is only for the verified single-commit repository.');
  requireState(git('remote', 'get-url', 'origin') === remote && git('remote', 'get-url', '--push', 'origin') === remote,
    'origin is not the verified SpaCare repository.');
  requireState(git('ls-remote', '--heads', '--tags', 'origin') === `${oldCommit}\trefs/heads/main`,
    'remote changed or has other branches/tags; review before rewriting.');
  const allowed = new Set(['.gitignore', 'scripts/clean-published-repo.mjs']);
  requireState(lines(git('status', '--porcelain', '--untracked-files=all')).every(line => allowed.has(line.slice(3))),
    'other local changes exist; preserve and review them first.');
  const tracked = lines(git('ls-files'));
  console.log(`Verified local and remote main: ${oldCommit}`);
  console.log(`Artifacts to untrack: ${tracked.filter(path => artifacts.test(path)).length}. Local files will be kept.`);
  if (process.argv.includes('--check')) {
    console.log('CHECK ONLY: index, commits, history and remote were not changed.');
  } else {
    git('rm', '-r', '--cached', '--ignore-unmatch', '--', '.idea', 'outputs', 'tmp_library_inspect', 'test-results.txt');
    git('add', '--', '.gitignore', 'scripts/clean-published-repo.mjs');
    const remaining = lines(git('ls-files'));
    requireState(!remaining.some(path => artifacts.test(path)), 'unwanted artifacts remain in the index.');
    requireState(!remaining.some(path => /(^|\/)\.env/.test(path) && !['.env.example', '.env.demo.example'].includes(path)),
      'a private environment file remains tracked.');
    for (const required of ['scripts/setup.ts', 'package-lock.json', 'src/lib/operations.ts', 'tests/integration.test.ts']) {
      requireState(remaining.includes(required), `required source file missing: ${required}`);
    }
    // Amend the only root commit; a deletion commit alone would retain tokens.
    git('commit', '--amend', '-m', 'Initialize SpaCare source without local artifacts');
    const nextCommit = git('rev-parse', 'HEAD');
    requireState(!git('log', 'main', '--format=', '--name-only', '--', 'outputs/test-review-20261021/transfer.json').trim(),
      'main still contains transfer.json in its history.');
    // Only update main if GitHub still has the exact commit verified above.
    git('push', `--force-with-lease=refs/heads/main:${oldCommit}`, 'origin', 'HEAD:refs/heads/main');
    requireState(git('ls-remote', 'origin', 'refs/heads/main') === `${nextCommit}\trefs/heads/main`,
      'could not verify the published commit; check origin/main before further pushes.');
    console.log(`Cleanup published and verified: ${nextCommit}`);
    console.log('Artifacts remain on disk and are ignored. Old commits can remain in reflogs, caches or external copies.');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
