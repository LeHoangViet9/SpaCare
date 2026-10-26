// Pure guards: supplied URLs and credentials never appear in errors.
export class SafetyGuardError extends Error {
  constructor() {
    super('SAFETY_GUARD_BLOCKED: Kiểm tra môi trường và đích theo docs/PRODUCTION_SAFETY.md.');
    this.name = 'SafetyGuardError';
    this.code = 'SAFETY_GUARD_BLOCKED';
  }
}
const block = () => { throw new SafetyGuardError(); };
/** @param {string} uri */
export function databaseName(uri) {
  // Supports replica-set authorities with multiple hosts. Reject ambiguous DB paths.
  const match = /^(mongodb(?:\+srv)?):\/\/([^/?#\s]+)\/([a-zA-Z0-9_-]+)(?:\?([^#\s]*))?$/.exec(uri);
  if (!match) return block();
  const options = new URLSearchParams(match[4] || '');
  for (const key of options.keys()) if (['dbname', 'database'].includes(key.toLowerCase())) block();
  return match[3];
}
/**
 * @param {string} uri
 * @param {Record<string, string | undefined>} env
 * @param {'runtime'|'maintenance'|'import'|'demo'|'test'|'backup'} purpose
 */
export function assertDatabaseTarget(uri, env = process.env, purpose = 'runtime') {
  if (!['runtime', 'maintenance', 'import', 'demo', 'test', 'backup'].includes(purpose)) block();
  const database = databaseName(uri);
  if (env.NODE_ENV && !['production', 'development', 'test'].includes(env.NODE_ENV)) block();
  const declared = env.SPACARE_ENV;
  if (declared && !['production', 'development', 'test', 'demo', 'operations'].includes(declared)) block();
  if (declared === 'demo' && database !== 'spacare_demo') block();
  if (declared === 'development' && database !== 'spacare_dev') block();
  const platform = env.VERCEL_ENV;
  const target = env.VERCEL_TARGET_ENV;
  const onVercel = ['VERCEL', 'VERCEL_ENV', 'VERCEL_TARGET_ENV', 'VERCEL_URL',
    'VERCEL_DEPLOYMENT_ID', 'VERCEL_PROJECT_ID', 'VERCEL_REGION', 'VERCEL_GIT_COMMIT_REF']
    .some(key => !!env[key]);
  // NODE_ENV=production also occurs in Preview. Missing or contradictory cloud
  // identity must never fall back to the local next-start compatibility path.
  if (onVercel && (!platform || !['production', 'preview', 'development'].includes(platform))) block();
  if (env.VERCEL && env.VERCEL !== '1') block();
  if (target && target !== platform) block();
  const hostedProduction = platform === 'production' && (!env.CI || env.VERCEL === '1');
  const test = env.NODE_ENV === 'test' || declared === 'test' || !!env.NODE_TEST_CONTEXT;
  const nonProduction = platform === 'preview' || platform === 'development' ||
    env.NODE_ENV === 'development' || declared === 'development' || declared === 'demo' ||
    (!!env.CI && !hostedProduction);
  if (test) {
    if (database !== 'spacare_test' || declared === 'production' || declared === 'operations' || platform === 'production') block();
  } else if (nonProduction) {
    if (!['spacare_dev', 'spacare_demo', 'spacare_test'].includes(database) ||
      declared === 'production' || declared === 'operations' || platform === 'production') block();
  } else if (purpose === 'runtime') {
    // Existing Vercel Production/next start need no new environment variable.
    const production = hostedProduction || (!onVercel && !env.CI && env.NODE_ENV === 'production' && declared !== 'operations');
    if (!production && !['spacare_dev', 'spacare_demo', 'spacare_test'].includes(database)) block();
    if (declared === 'production' && !production) block();
    if (declared === 'operations') block();
  }
  if (purpose === 'test' && database !== 'spacare_test') block();
  if (purpose === 'demo' && (database !== 'spacare_demo' || onVercel || declared === 'production')) block();
  if (['maintenance', 'import', 'backup'].includes(purpose)) {
    // Local operator opt-in supplements, never replaces, OWNER/batch approvals.
    if (onVercel) block();
    const sandbox = ['spacare_dev', 'spacare_test'].includes(database);
    if (!sandbox && !(declared === 'operations' && !test && !nonProduction &&
      ['spacare_live', 'spacare_prod'].includes(database) && env.SPACARE_TARGET_DATABASE === database)) block();
    if (declared === 'production') block();
  }
  if (env.SPACARE_TARGET_DATABASE && env.SPACARE_TARGET_DATABASE !== database) block();
  return database;
}
/** @param {string} expected @param {string | undefined} actual */
export function assertConnectedDatabase(expected, actual) {
  if (!actual || actual !== expected) block();
}
/** @param {Record<string, string | undefined>} env */
export function seleniumBaseUrl(env = process.env) {
  if (env.VERCEL_ENV === 'production' || env.VERCEL_TARGET_ENV === 'production') block();
  let url;
  try { url = new URL(env.SELENIUM_BASE_URL || ''); } catch { return block(); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
    url.pathname !== '/' || url.search || url.hash) block();
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  const productionHosts = seleniumProductionHosts(env);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(host);
  if (!local && productionHosts.some(name => host === name || host.endsWith('.' + name))) block();
  if (!local) {
    let allowed;
    try { allowed = new URL(env.SELENIUM_ALLOWED_ORIGIN || ''); } catch { return block(); }
    if (url.protocol !== 'https:' || allowed.origin !== url.origin || allowed.username || allowed.password ||
      allowed.pathname !== '/' || allowed.search || allowed.hash) block();
  }
  if (env.SELENIUM_ENV !== 'test' && env.SELENIUM_ENV !== 'staging') block();
  return url;
}

/** @param {Record<string, string | undefined>} env */
export function seleniumProductionHosts(env = process.env) {
  const productionHosts = ['spacare-rho.vercel.app'];
  for (const value of [env.VERCEL_PROJECT_PRODUCTION_URL, env.SELENIUM_PRODUCTION_ORIGIN]) {
    if (!value) continue;
    try { productionHosts.push(new URL(value.includes('://') ? value : 'https://' + value).hostname.toLowerCase().replace(/\.$/, '')); }
    catch { block(); }
  }
  return productionHosts;
}
