const { defineConfig } = require('@playwright/test');
const path = require('node:path');

const expectedMongoUri = 'mongodb://127.0.0.1:27018/spacare_test?replicaSet=rs0&directConnection=true';
const expectedOrigin = 'http://127.0.0.1:3223';
const browserRoot = path.resolve(
  process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.PLAYWRIGHT_BROWSERS_PATH !== '0'
    ? process.env.PLAYWRIGHT_BROWSERS_PATH
    : path.join(process.env.LOCALAPPDATA || '', 'ms-playwright'),
);
const browserPath = process.env.SPACARE_TEST_CHROME && path.resolve(process.env.SPACARE_TEST_CHROME);
const browserRelativePath = browserPath && path.relative(browserRoot, browserPath);
if (process.env.SPACARE_HTTP_E2E !== '1' ||
    process.env.MONGODB_URI !== expectedMongoUri ||
    process.env.APP_ORIGIN !== expectedOrigin ||
    process.env.SPACARE_ENV !== 'integration' ||
    process.env.SPACARE_TARGET_DATABASE !== 'spacare_test' ||
    process.env.SPACARE_INTEGRATION_ISOLATED !== 'local-rs0' ||
    !process.env.SPACARE_HTTP_E2E_FIXTURE ||
    !browserPath ||
    !browserRelativePath ||
    browserRelativePath.startsWith('..') ||
    path.isAbsolute(browserRelativePath) ||
    process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    (process.env.CI && !['0', 'false', 'no', 'off'].includes(process.env.CI.toLowerCase()))) {
  throw new Error('BLOCKED: run this Playwright configuration only through the isolated local MongoDB E2E runner.');
}

module.exports = defineConfig({
  testDir: 'tests',
  testMatch: 'invoice-replacement-http.spec.cjs',
  outputDir: 'outputs/invoice-replacement-http-e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  use: {
    baseURL: expectedOrigin,
    browserName: 'chromium',
    launchOptions: { executablePath: browserPath },
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: 'node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3223',
    url: `${expectedOrigin}/login`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      NODE_ENV: 'production',
      MONGODB_URI: expectedMongoUri,
      APP_ORIGIN: expectedOrigin,
      SPACARE_WRITE_FREEZE: 'OFF',
      SPACARE_ENV: 'integration',
      SPACARE_TARGET_DATABASE: 'spacare_test',
      SPACARE_INTEGRATION_ISOLATED: 'local-rs0',
    },
  },
});
