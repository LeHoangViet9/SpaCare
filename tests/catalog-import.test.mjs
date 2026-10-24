import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
test('catalog import validates VND/ranges, splits laser single visits from packages and never invents duration', () => {
  execFileSync(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./catalog-import-plan-fixture.ts', import.meta.url))], { stdio: 'pipe', timeout: 15000 });
});
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
test('Windows XLSX reader keeps Vietnamese, shared strings and zero amounts; rejects formulas', { skip: process.platform !== 'win32' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'spacare-catalog-'));
  const generate = fileURLToPath(new URL('./catalog-xlsx-fixture.ps1', import.meta.url));
  const reader = fileURLToPath(new URL('../scripts/read-catalog-xlsx.ps1', import.meta.url));
  const file = join(dir, 'sample.xlsx');
  const ps = args => execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `& { ${readFileSync(args[0], 'utf8').replace(/^\uFEFF/, '')} } ${args[1]} $env:SPACARE_CATALOG_FILE ${args.includes('-Formula') ? '-Formula' : ''}`], { env: { ...process.env, SPACARE_CATALOG_FILE: args[2] }, encoding: 'utf8', stdio: 'pipe', timeout: 15000 });
  ps([generate, '-OutputFile', file]);
  const rows = JSON.parse(ps([reader, '-FilePath', file]).replace(/^\uFEFF/, ''));
  assert.equal(rows[0].cells.A, 'Tên dịch vụ');
  assert.equal(rows[0].cells.E, 'Hoa hồng (VNĐ)');
  assert.equal(rows[1].cells.A, 'Triệt lông Nách');
  assert.equal(rows[1].cells.E, '0');
  const formula = join(dir, 'formula.xlsx');
  ps([generate, '-OutputFile', formula, '-Formula']);
  assert.throws(() => ps([reader, '-FilePath', formula]));
});
test('catalog import uses authenticated owner scope, atomic rollback and stable row idempotency (model doubles)', () => {
  execFileSync(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./catalog-import-db-fixture.ts', import.meta.url))], { env: { ...process.env, MONGODB_URI: '' }, stdio: 'pipe', timeout: 15000 });
});
test('arrival timeline renders 22:00 and stacks simultaneous appointments without requiring endAt', () => {
  execFileSync(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./arrival-agenda-fixture.tsx', import.meta.url))], { stdio: 'pipe', timeout: 15000 });
});
test('missing catalog file reports a local path problem before database access', () => {
  assert.throws(() => execFileSync(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../scripts/import-catalog.ts', import.meta.url)), '--file', join(tmpdir(), 'spacare-missing-catalog-' + Date.now() + '.xlsx')], {
    env: { ...process.env, MONGODB_URI: '' }, stdio: 'pipe', timeout: 15000,
  }), error => error.status === 1 && error.stderr.toString().includes('Không tìm thấy file Excel.') && !error.stderr.toString().includes('UNKNOWN'));
});
