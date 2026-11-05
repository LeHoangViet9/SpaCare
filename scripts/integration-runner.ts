import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  INTEGRATION_ENV, IntegrationSafetyError, assertIntegrationEnvironment,
  assertConnectedServerIdentity, inspectIntegrationSchema,
} from '../tests/integration-safety.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const composeFile = fileURLToPath(new URL('../compose.yaml', import.meta.url));
const compose = ['compose', '--project-directory', root, '--file', composeFile, '--project-name', 'spacare-invoice-replacement'];

type Command = { env: NodeJS.ProcessEnv; timeout: number; inherit?: boolean };
type CommandResult = { code: number; output: string };
type RunCommand = (command: string, args: string[], options: Command) => Promise<CommandResult>;

/** No shell, env-file loading, teardown or volume deletion. */
export const runCommand: RunCommand = (command, args, options) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd: root, env: options.env, shell: false,
    stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'], windowsHide: true,
    detached: process.platform !== 'win32' });
  let output = '', expired = false;
  child.stdout?.on('data', chunk => { output = (output + chunk).slice(-6000); });
  child.stderr?.on('data', chunk => { output = (output + chunk).slice(-6000); });
  const timer = setTimeout(() => {
    expired = true;
    // Docker Compose and node --test can have child processes holding the pipes open.
    if (child.pid && process.platform === 'win32') {
      const stop = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      stop.unref();
      stop.once('error', () => { child.kill(); });
      stop.once('close', code => { if (code !== 0) child.kill(); });
      // Restricted shells can deny/hang taskkill; the direct child must still terminate.
      setTimeout(() => { child.kill(); }, 500).unref();
    } else if (child.pid) {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill(); }
    }
    reject(new Error('COMMAND_TIMEOUT'));
  }, options.timeout);
  child.once('error', error => { clearTimeout(timer); reject(error); });
  child.once('close', code => {
    clearTimeout(timer);
    if (expired) reject(new Error('COMMAND_TIMEOUT'));
    else resolve({ code: code ?? 1, output: output.trim() });
  });
});

export async function prepareIntegrationDatabase(env: NodeJS.ProcessEnv) {
  const target = assertIntegrationEnvironment(env);
  const { default: mongoose } = await import('mongoose');
  const deadline = Date.now() + 60_000;
  let ready = false;
  try {
    while (!ready && Date.now() < deadline) {
      try {
        await mongoose.connect(target.uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 2000, connectTimeoutMS: 2000 });
        await assertConnectedServerIdentity(mongoose.connection, target);
        ready = true;
      } catch (error) {
        await mongoose.disconnect();
        if (error instanceof IntegrationSafetyError) throw error;
        if (Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    if (!ready) throw new Error('BLOCKED [MONGO_NOT_READY]: Không kết nối được MongoDB rs0 PRIMARY tại 127.0.0.1:27018 trong 60 giây. Kiểm tra container, cổng và quá trình bầu PRIMARY.');
    // No writes until the environment, connected host/database and rs0 primary are verified.
    const { allModels } = await import('../src/lib/models');
    try {
      for (const model of allModels) {
        await model.createCollection();
        await model.createIndexes();
      }
      await inspectIntegrationSchema(mongoose.connection, allModels);
    } catch (error) {
      if (error instanceof IntegrationSafetyError) throw error;
      throw new Error('BLOCKED [TEST_SCHEMA]: Không tạo được collections/indexes trong spacare_test. Có thể có index cũ xung đột, dữ liệu test trùng hoặc thiếu quyền; không tự xóa dữ liệu/index.');
    }
  } finally { await mongoose.disconnect(); }
}

type Dependencies = {
  env?: NodeJS.ProcessEnv;
  run?: RunCommand;
  prepare?: typeof prepareIntegrationDatabase;
  log?: (message: string) => void;
};

export async function runIntegration({ env: inherited = process.env, run = runCommand, prepare = prepareIntegrationDatabase, log = console.log }: Dependencies = {}) {
  const env: NodeJS.ProcessEnv = { ...inherited, ...INTEGRATION_ENV };
  // A parent process cannot inject env-file/preload flags into the test child.
  delete env.NODE_OPTIONS;
  delete env.NODE_PATH;
  delete env.TSX_TSCONFIG_PATH;
  assertIntegrationEnvironment(env); // Hosted/CI guards remain enforced, not cleared.

  async function check(command: string, args: string[], code: string, hint: string, timeout = 30_000) {
    let result: CommandResult;
    try { result = await run(command, args, { env, timeout }); }
    catch (error) {
      const reason = (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'không tìm thấy lệnh' : (error as Error).message === 'COMMAND_TIMEOUT' ? 'quá thời gian chờ' : 'không chạy được tiến trình';
      throw new Error(`BLOCKED [${code}]: ${hint} (${reason}).`);
    }
    if (result.code !== 0) throw new Error(`BLOCKED [${code}]: ${hint}\n${result.output}`);
    return result.output;
  }

  log('Kiểm tra Docker CLI, daemon và Docker Compose…');
  await check('docker', ['--version'], 'DOCKER_CLI', 'Cần cài Docker và thêm docker vào PATH');
  // Avoid starting a remote daemon while testing a different server on local loopback.
  const endpoint = !inherited.DOCKER_CONTEXT && inherited.DOCKER_HOST || (await check('docker', ['context', 'inspect', ...(inherited.DOCKER_CONTEXT ? [inherited.DOCKER_CONTEXT] : []), '--format', '{{.Endpoints.docker.Host}}'], 'DOCKER_CONTEXT', 'Không đọc được Docker context hiện tại'));
  if (!/^(?:npipe:\/\/|unix:\/\/|tcp:\/\/(?:127\.0\.0\.1|localhost):\d+$)/.test(endpoint))
    throw new Error('BLOCKED [DOCKER_CONTEXT]: Chỉ dùng Docker daemon local (npipe/unix/loopback), không dùng context remote.');
  await check('docker', ['info', '--format', '{{.ServerVersion}}'], 'DOCKER_DAEMON', 'Docker daemon chưa sẵn sàng; mở Docker Desktop hoặc khởi động Docker Engine');
  await check('docker', ['compose', 'version'], 'DOCKER_COMPOSE', 'Cần Docker Compose v2 hỗ trợ up --wait');
  log('Khởi động MongoDB từ compose.yaml và đợi healthcheck…');
  await check('docker', [...compose, 'up', '--detach', '--wait', '--wait-timeout', '90', 'mongo'], 'MONGO_START', 'Không khởi động được MongoDB test; kiểm tra image mongo:8.0, cổng 27018 và container cùng project', 180_000);
  log('Khởi tạo/kiểm tra replica set rs0…');
  await check('docker', [...compose, 'run', '--rm', '--no-deps', 'mongo-init'], 'RS_INIT', 'Không khởi tạo/kiểm tra được rs0; giữ nguyên volume để kiểm tra', 60_000);
  log('Đợi PRIMARY, xác minh spacare_test và chuẩn bị collections/indexes test…');
  await prepare(env);
  log('Chạy integration tests trên spacare_test…');
  let result: CommandResult;
  try {
    result = await run(process.execPath, ['--import', 'tsx', '--test', 'tests/integration.test.ts'], { env, timeout: 600_000, inherit: true });
  } catch (error) {
    const reason = (error as Error).message === 'COMMAND_TIMEOUT' ? 'quá thời gian 10 phút' : 'không khởi chạy được tiến trình test';
    throw new Error(`FAILED [INTEGRATION_PROCESS]: ${reason}; không ghi nhận test đạt. MongoDB và volume được giữ nguyên.`);
  }
  if (result.code !== 0) log('Integration tests thất bại; không ghi nhận đạt. MongoDB và volume được giữ nguyên.');
  return result.code;
}
