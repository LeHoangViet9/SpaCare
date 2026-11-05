import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareIntegrationDatabase, runCommand, runIntegration } from '../scripts/integration-runner.ts';
import { assertIntegrationEnvironment, INTEGRATION_ENV } from './integration-safety.ts';

function fixture({ failAt, exit = 0, env = {}, prepareError, endpoint = 'npipe:////./pipe/dockerDesktopLinuxEngine' } = {}) {
  const calls = [];
  return {
    calls,
    options: {
      env, log() {},
      async run(command, args, options) {
        calls.push({ command, args, options });
        assertIntegrationEnvironment(options.env);
        if (failAt === calls.length) return { code: 1, output: 'fixture environment unavailable' };
        if (args.includes('inspect')) return { code: 0, output: endpoint };
        if (command === process.execPath) return { code: exit, output: '' };
        return { code: 0, output: 'ok' };
      },
      async prepare(childEnv) {
        calls.push({ prepare: true, env: childEnv });
        assertIntegrationEnvironment(childEnv);
        if (prepareError) throw new Error(prepareError);
      },
    },
  };
}

test('integration runner prepares Docker/rs0/schema before tests and overrides inherited database settings', async () => {
  const f = fixture({ env: { MONGODB_URI: 'mongodb+srv://unsafe.invalid/production', NODE_ENV: 'production', NODE_OPTIONS: '--import unsafe', NODE_PATH: 'unsafe', TSX_TSCONFIG_PATH: 'unsafe' } });
  assert.equal(await runIntegration(f.options), 0);
  const commands = f.calls.filter(call => call.command);
  assert.deepEqual(commands.slice(0,4).map(call => call.args.slice(0,2)), [['--version'],['context','inspect'],['info','--format'],['compose','version']]);
  assert.ok(commands[4].args.includes('--wait'));
  assert.ok(commands[4].args.includes('--project-name'));
  assert.ok(commands[4].args.some(arg => arg.endsWith('compose.yaml')));
  assert.deepEqual(commands[5].args.slice(-4), ['run','--rm','--no-deps','mongo-init']);
  assert.equal(f.calls[6].prepare, true);
  const child = f.calls[7];
  assert.deepEqual(child.args, ['--import','tsx','--test','tests/integration.test.ts']);
  for (const [key,value] of Object.entries(INTEGRATION_ENV)) assert.equal(child.options.env[key], value);
  for (const key of ['NODE_OPTIONS','NODE_PATH','TSX_TSCONFIG_PATH']) assert.equal(child.options.env[key], undefined);
  assert.ok(commands.every(call => !call.args.includes('down') && !call.args.includes('-v')));
});

test('integration runner fails closed at each Docker stage without preparing or running tests', async () => {
  for (const [stage, code] of ['DOCKER_CLI','DOCKER_CONTEXT','DOCKER_DAEMON','DOCKER_COMPOSE','MONGO_START','RS_INIT'].entries()) {
    const f = fixture({failAt: stage + 1});
    await assert.rejects(runIntegration(f.options), new RegExp(code));
    assert.equal(f.calls.length, stage + 1);
  }
  for (const [failure, text] of [[{code:'ENOENT'}, 'không tìm thấy lệnh'],[new Error('COMMAND_TIMEOUT'),'quá thời gian chờ']]) {
    await assert.rejects(runIntegration({env:{},log(){},run:async()=>{throw failure;},prepare:async()=>assert.fail('must not prepare')}), new RegExp(text));
  }
});

test('integration runner rejects remote Docker contexts and hosted environments before writes', async () => {
  const remote = fixture({endpoint:'ssh://remote.example'});
  await assert.rejects(runIntegration(remote.options), /DOCKER_CONTEXT/);
  assert.equal(remote.calls.length,2);
  const override = fixture({env:{DOCKER_HOST:'unix:///var/run/docker.sock',DOCKER_CONTEXT:'remote'},endpoint:'tcp://remote.example:2375'});
  await assert.rejects(runIntegration(override.options), /DOCKER_CONTEXT/);
  assert.ok(override.calls[1].args.includes('remote'));
  for (const env of [{CI:'true'},{VERCEL_ENV:'production'}]) {
    const f = fixture({env}); await assert.rejects(runIntegration(f.options)); assert.equal(f.calls.length,0);
  }
});

test('integration runner does not start tests after a Mongo readiness/schema failure and preserves test exit code', async () => {
  const blocked = fixture({prepareError:'BLOCKED [MONGO_NOT_READY]'});
  await assert.rejects(runIntegration(blocked.options), /MONGO_NOT_READY/);
  assert.equal(blocked.calls.length,7);
  assert.equal(await runIntegration(fixture({exit:7}).options),7);
  const timeout = fixture();
  const run = timeout.options.run;
  timeout.options.run = async (...args) => {
    if (args[0] === process.execPath) throw new Error('COMMAND_TIMEOUT');
    return run(...args);
  };
  await assert.rejects(runIntegration(timeout.options),/INTEGRATION_PROCESS.*10 phút/);
});

test('database preparation rejects an unsafe URI before loading MongoDB or application models', async () => {
  await assert.rejects(prepareIntegrationDatabase({...INTEGRATION_ENV,MONGODB_URI:'mongodb+srv://unsafe.invalid/production'}),error=>error.code==='SRV_REJECTED');
});

test('npm integration command and compose topology match the runner safety target', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  assert.equal(pkg.scripts['test:integration'],'node --import tsx scripts/test-integration.ts');
  const compose = readFileSync(new URL('../compose.yaml',import.meta.url),'utf8');
  assert.match(compose,/127\.0\.0\.1:27018:27017/);
  assert.match(compose,/e\.code !== 94/);
  assert.match(compose,/status\.set !== 'rs0'/);
  assert.equal(INTEGRATION_ENV.MONGODB_URI,'mongodb://127.0.0.1:27018/spacare_test?replicaSet=rs0&directConnection=true');
});

test('command runner returns child exit codes and fails promptly for missing commands and timeouts', async () => {
  const options = {env:process.env,timeout:5000};
  assert.deepEqual(await runCommand(process.execPath,['-e',"console.log('fixture');process.exitCode=7"],options),{code:7,output:'fixture'});
  await assert.rejects(runCommand('spacare-nonexistent-test-command',[],options),error=>error.code==='ENOENT');
  await assert.rejects(runCommand(process.execPath,['-e','setInterval(()=>{},1000)'],{...options,timeout:100}),/COMMAND_TIMEOUT/);
});
