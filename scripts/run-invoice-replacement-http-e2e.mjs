import { spawn } from 'node:child_process';
import { createServer, connect as connectSocket } from 'node:net';
import { access, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { assertConnectedServerIdentity, assertIntegrationEnvironment, inspectIntegrationSchema } from '../tests/integration-safety.ts';
import { allModels } from '../src/lib/models.ts';
import { createInvoiceReplacementHttpFixture, verifyInvoiceReplacementHttpFixture } from '../tests/invoice-replacement-http-fixture.ts';
import { connect } from '../src/lib/db.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputs = path.join(root, 'outputs');
const mongoBinary = path.join(outputs, 'mongo-bin', 'mongod-x64-win32-8.0.16.exe');
const appOrigin = 'http://127.0.0.1:3223';
const mongoUri = 'mongodb://127.0.0.1:27018/spacare_test?replicaSet=rs0&directConnection=true';
const safeEnv = {
  NODE_ENV: 'test',
  SPACARE_ENV: 'integration',
  SPACARE_TARGET_DATABASE: 'spacare_test',
  SPACARE_INTEGRATION_ISOLATED: 'local-rs0',
  SPACARE_WRITE_FREEZE: 'OFF',
  MONGODB_URI: mongoUri,
  APP_ORIGIN: appOrigin,
};

function assertEnvironment() {
  for (const [key, expected] of Object.entries({ MONGODB_URI: mongoUri, APP_ORIGIN: appOrigin })) {
    if (process.env[key] && process.env[key] !== expected) throw new Error(`BLOCKED: ${key} conflicts with the isolated local E2E target.`);
  }
  if (process.env.VERCEL || process.env.VERCEL_ENV) throw new Error('BLOCKED: hosted environments cannot run this E2E.');
  if (process.env.CI && !['0', 'false', 'no', 'off'].includes(process.env.CI.toLowerCase())) {
    throw new Error('BLOCKED: CI is not an audited isolated E2E environment.');
  }
  Object.assign(process.env, safeEnv);
  assertIntegrationEnvironment(process.env);
}

async function assertPortFree(port) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', error => reject(new Error(`BLOCKED: local test port ${port} is already in use.`)));
    server.listen(port, '127.0.0.1', () => server.close(error => error ? reject(error) : resolve()));
  });
}

async function waitForMongoProcess(processHandle, mongoLog) {
  const deadline = Date.now() + 30_000;
  let lastError;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error(`BLOCKED: temporary mongod exited early. ${mongoLog.slice(-2000)}`);
    try {
      const socket = connectSocket({ host: '127.0.0.1', port: 27018 });
      await new Promise((resolve, reject) => {
        socket.once('connect', resolve);
        socket.once('error', reject);
      });
      socket.destroy();
      return;
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  throw new Error(`BLOCKED: temporary mongod did not start. ${String(lastError || '')}`);
}

async function waitForPrimary(connection, processHandle, mongoLog) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error(`BLOCKED: temporary mongod exited. ${mongoLog.slice(-2000)}`);
    try {
      const hello = await connection.db.admin().command({ hello: 1 });
      if (hello.setName === 'rs0' && hello.isWritablePrimary === true) return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 250));
      continue;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`BLOCKED: temporary MongoDB did not elect the rs0 primary. ${mongoLog.slice(-2000)}`);
}

async function runChild(command, args, env, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve(undefined) : reject(new Error(`${label} exited with code ${code}.`)));
  });
}

async function findLocalChromium() {
  const browserRoot = process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.PLAYWRIGHT_BROWSERS_PATH !== '0'
    ? path.resolve(process.env.PLAYWRIGHT_BROWSERS_PATH)
    : path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  const candidates = [];
  try {
    const entries = await readdir(browserRoot, { withFileTypes: true });
    for (const entry of entries) {
      const match = /^chromium-(\d+)$/.exec(entry.name);
      if (entry.isDirectory() && match) candidates.push({ revision: Number(match[1]), directory: path.join(browserRoot, entry.name) });
    }
  } catch {
    throw new Error('BLOCKED: no local Playwright Chromium cache is available; browser installation was not attempted.');
  }
  candidates.sort((left, right) => right.revision - left.revision);
  for (const candidate of candidates) {
    for (const relativePath of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe']) {
      const executable = path.join(candidate.directory, relativePath);
      try {
        await access(executable);
        return executable;
      } catch {
        continue;
      }
    }
  }
  throw new Error('BLOCKED: no installed local Chromium executable was found; browser installation was not attempted.');
}

let sandbox;
let mongod;
let mongoLog = '';
let adminConnection;
let appConnected = false;
let fixturePath;
let outcome = 'FAIL';

try {
  assertEnvironment();
  await access(mongoBinary);
  await assertPortFree(27018);
  await assertPortFree(3223);
  sandbox = await mkdtemp(path.join(outputs, 'spacare-http-e2e-'));
  const dbPath = path.join(sandbox, 'mongo');
  const { mkdir } = await import('node:fs/promises');
  await mkdir(dbPath);
  mongod = spawn(mongoBinary, ['--bind_ip', '127.0.0.1', '--port', '27018', '--replSet', 'rs0', '--dbpath', dbPath, '--quiet'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  mongod.stdout.setEncoding('utf8').on('data', chunk => { mongoLog = (mongoLog + chunk).slice(-12_000); });
  mongod.stderr.setEncoding('utf8').on('data', chunk => { mongoLog = (mongoLog + chunk).slice(-12_000); });
  await waitForMongoProcess(mongod, mongoLog);

  adminConnection = await mongoose.createConnection('mongodb://127.0.0.1:27018/admin?directConnection=true', {
    serverSelectionTimeoutMS: 5_000,
  }).asPromise();
  const hello = await adminConnection.db.admin().command({ hello: 1 });
  if (hello.setName) throw new Error('BLOCKED: unexpectedly found a pre-existing replica set.');
  await adminConnection.db.admin().command({
    replSetInitiate: { _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27018' }] },
  });
  await waitForPrimary(adminConnection, mongod, mongoLog);
  await adminConnection.close();
  adminConnection = undefined;

  await connect();
  appConnected = true;
  const target = assertIntegrationEnvironment(process.env);
  await assertConnectedServerIdentity(mongoose.connection, target);
  for (const model of allModels) {
    await model.createCollection();
    await model.createIndexes();
  }
  await inspectIntegrationSchema(mongoose.connection, allModels);

  const fixture = await createInvoiceReplacementHttpFixture();
  fixturePath = path.join(sandbox, 'fixture.json');
  await writeFile(fixturePath, JSON.stringify(fixture), { encoding: 'utf8', flag: 'wx' });
  await mongoose.disconnect();
  appConnected = false;

  const chromiumPath = await findLocalChromium();
  const appEnv = {
    ...process.env,
    ...safeEnv,
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
  };
  if (process.platform === 'win32') {
    await runChild(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm run build'], appEnv, 'npm run build');
  } else {
    await runChild('npm', ['run', 'build'], appEnv, 'npm run build');
  }

  const testEnv = {
    ...appEnv,
    ...safeEnv,
    SPACARE_HTTP_E2E: '1',
    SPACARE_HTTP_E2E_FIXTURE: fixturePath,
    SPACARE_TEST_CHROME: chromiumPath,
  };
  const playwrightCli = path.join(root, 'node_modules', '@playwright', 'test', 'cli.js');
  await runChild(process.execPath, [playwrightCli, 'test', '--config', 'playwright.invoice-replacement-http.config.cjs'], testEnv, 'Playwright HTTP/session/Next E2E');

  const integrationEnv = { ...appEnv, ...safeEnv, NEXT_TELEMETRY_DISABLED: '1' };
  await runChild(process.execPath, ['--import', 'tsx', '--test', 'tests/integration.test.ts'], integrationEnv, 'MongoDB integration suite');
  Object.assign(process.env, safeEnv);
  await verifyInvoiceReplacementHttpFixture(fixture);
  await mongoose.disconnect();
  appConnected = false;
  outcome = 'PASS';
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  if (error?.code?.startsWith?.('ENV_') || error?.code?.includes?.('REJECTED') || String(error?.message).includes('BLOCKED:')) outcome = 'BLOCKED';
} finally {
  if (appConnected) await mongoose.disconnect().catch(() => {});
  if (adminConnection) await adminConnection.close().catch(() => {});
  if (mongod && mongod.exitCode === null) {
    mongod.kill();
    await new Promise(resolve => {
      const timeout = setTimeout(() => resolve(undefined), 5_000);
      mongod.once('close', () => { clearTimeout(timeout); resolve(undefined); });
    });
  }
  if (sandbox) {
    const resolved = path.resolve(sandbox);
    if (path.dirname(resolved) !== outputs || !path.basename(resolved).startsWith('spacare-http-e2e-')) {
      throw new Error('Refusing to remove an unexpected E2E temporary path.');
    }
    await rm(resolved, { recursive: true, force: true });
  }
}

console.log(`HTTP/session/Next invoice replacement E2E: ${outcome}`);
if (outcome !== 'PASS') process.exitCode = 1;
