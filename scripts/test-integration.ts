import { runIntegration } from './integration-runner';

runIntegration().then(code => { process.exitCode = code; }).catch(error => {
  // Runner errors contain a stage and safe diagnostic, never a database driver message.
  console.error(error.message);
  process.exitCode = 1;
});
