import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = new URL(process.env.SELENIUM_BASE_URL || 'https://spacare-rho.vercel.app');
assert.ok(['http:', 'https:'].includes(base.protocol));
assert.equal(base.username + base.password, '', 'Credentials must be environment variables');
const origin = base.origin;
const identifier = process.env.SELENIUM_IDENTIFIER;
const password = process.env.SELENIUM_PASSWORD;
const timeout = 25000;
const out = resolve('outputs/selenium', new Date().toISOString().replace(/[:.]/g, '-'));
await mkdir(out, { recursive: true });
const results = [];
let driver;
let authenticated = false;
let authenticationFailed = false;
let step = 'setup';
const css = selector => By.css(selector);
async function visible(locator) {
  return driver.wait(async () => {
    for (const el of await driver.findElements(locator)) if (await el.isDisplayed()) return el;
    return false;
  }, timeout);
}
async function activatePage() {
  await driver.switchTo().window(await driver.getWindowHandle());
  await driver.sendDevToolsCommand('Page.bringToFront', {});
}
async function go(path) {
  step = `navigate ${path.split('?')[0]}`;
  await activatePage();
  await driver.get(origin + path);
  await activatePage();
}
async function heading(text) {
  step = `heading ${text}`;
  await activatePage();
  await driver.wait(async () => {
    try {
      for (const el of await driver.findElements(css('.alert.error'))) {
        if (await el.isDisplayed()) {
          const error = new Error();
          error.name = 'ApplicationLoadError';
          throw error;
        }
      }
      for (const el of await driver.findElements(css('h1'))) {
        if (await el.isDisplayed() && (await el.getText()).trim() === text) return true;
      }
      return false;
    } catch (error) {
      if (error.name === 'StaleElementReferenceError') return false;
      throw error;
    }
  }, 45000);
}

async function login() {
  if (authenticated) return;
  await go('/login');
  await (await visible(css('input[autocomplete="username"]'))).sendKeys(identifier);
  await (await visible(css('#login-password'))).sendKeys(password);
  await (await visible(css('button[type="submit"]'))).click();
  step = 'login response';
  try {
    await driver.wait(async () => {
      const errors = await driver.findElements(css('.alert.error[role="alert"]'));
      for (const el of errors) {
        if (await el.isDisplayed()) {
          const text = await el.getText();
          const error = new Error();
          error.name = /quá nhiều|15 phút/.test(text) ? 'LoginRateLimited' : 'LoginRejected';
          throw error;
        }
      }
      return /\/workspace(?:[/?#]|$)/.test(await driver.getCurrentUrl());
    }, timeout);
    step = 'verify authenticated session';
    const sessionStatus = await driver.executeAsyncScript("const done=arguments[arguments.length-1]; fetch('/api/workspace').then(r=>done(r.status)).catch(()=>done(0));");
    assert.equal(sessionStatus, 200, 'Authenticated workspace API must return 200');
    authenticated = true;
  } catch (error) {
    authenticationFailed = true;
    throw error;
  }
}
async function run(id, name, fn, auth = false) {
  if (auth && !(identifier && password)) {
    results.push({ id, name, status: 'SKIP', reason: 'Missing test account environment variables' });
    console.log(`SKIP ${id}: ${name}`);
    return;
  }
  if (auth && authenticationFailed) {
    results.push({ id, name, status: 'BLOCKED', reason: 'Previous login failed' });
    console.log(`BLOCKED ${id}: Previous login failed`);
    return;
  }
  step = 'case setup';
  try {
    await driver.manage().window().setRect({ width: 1440, height: 1000 });
    if (!authenticated) await driver.manage().deleteAllCookies();
    await fn();
    results.push({ id, name, status: 'PASS' });
    console.log(`PASS ${id}: ${name}`);
  } catch (error) {
    // Do not log raw driver errors, DOM, cookies or customer data.
    let diagnostics = {};
    try {
      diagnostics = await driver.executeAsyncScript(`const done=arguments[arguments.length-1];
        const path=location.pathname;
        const state={path: /^\\/(workspace|login)(\\/|$)/.test(path)?path:'other',
          readyState:document.readyState,
          visibility:document.visibilityState, focused:document.hasFocus(),
          loadingStage: /Đang kết nối/.test(document.querySelector('.loading')?.textContent||'')?'workspace-fetch':document.querySelector('.loading')?'route-or-suspense':'none',
          scriptCount:document.scripts.length,
          loading:!!document.querySelector('.loading'),
          errorVisible:[...document.querySelectorAll('.alert.error')].some(e=>e.getClientRects().length>0)};
        const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),5000);
        fetch('/api/workspace',{signal:controller.signal}).then(r=>{clearTimeout(timer);done({...state,workspaceStatus:r.status})})
        .catch(()=>{clearTimeout(timer);done({...state,workspaceStatus:0})});`);
    } catch { /* Diagnostics must not hide the original error. */ }
    try {
      const events = (await driver.manage().logs().get('performance')).map(entry => {
        try { return JSON.parse(entry.message).message; } catch { return null; }
      }).filter(Boolean);
      // Allowlisted URLs and numeric statuses only; never headers, bodies or query values.
      diagnostics.network = events.filter(e => e.method === 'Network.responseReceived').flatMap(e => {
        const response = e.params.response;
        let url; try { url = new URL(response.url); } catch { return []; }
        if (url.origin !== origin) return [];
        const path = url.pathname;
        if (!(path === '/api/workspace' || path === '/api/auth/login' || path === '/workspace' || path.startsWith('/_next/static/'))) return [];
        return [{ resource: path.startsWith('/_next/static/') ? 'next-static' : path, status: response.status, type: e.params.type }];
      }).slice(-20);
      diagnostics.networkFailures = events.filter(e => e.method === 'Network.loadingFailed').map(e => ({
        type: e.params.type, canceled: !!e.params.canceled,
        code: /^net::ERR_[A-Z_]+$/.test(e.params.errorText || '') ? e.params.errorText : 'network-failure'
      })).slice(-10);
      const browserLogs = await driver.manage().logs().get('browser');
      const sanitize = message => {
        let clean = String(message);
        for (const secret of [identifier, password]) if (secret) clean = clean.split(secret).join('[redacted]');
        return clean.replace(/https?:\/\/[^\s"']+/g, '[url]')
          .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
          .replace(/\b[a-f0-9]{24,}\b/gi, '[id]')
          .replace(/\b\d{9,}\b/g, '[number]').slice(0, 1200);
      };
      diagnostics.javascript = browserLogs.filter(e => e.level.name === 'SEVERE').map(e => ({
        message: sanitize(e.message),
        category: /hydrati/i.test(e.message) ? 'hydration' : /ChunkLoadError|Loading chunk/i.test(e.message) ? 'chunk-load' : /TypeError/.test(e.message) ? 'TypeError' : /ReferenceError/.test(e.message) ? 'ReferenceError' : 'browser-error'
      })).slice(-10);
    } catch { /* Logging may be unavailable on a remote Grid. */ }
    results.push({ id, name, status: 'FAIL', reason: error.name, step, diagnostics });
    console.error('Diagnostics: ' + JSON.stringify(diagnostics));
    console.error(`FAIL ${id}: ${name} (${error.name}; ${step})`);
    // Screenshots may contain customer data; opt in only on a synthetic test spa.
    if (process.env.SELENIUM_SCREENSHOTS === '1') {
      try {
        await driver.executeScript("document.querySelectorAll('input').forEach(e=>e.value='')");
        await writeFile(resolve(out, `${id}.png`), await driver.takeScreenshot(), 'base64');
      } catch { /* Preserve test failure. */ }
    }
  }
}
try {
  const options = new chrome.Options();
  if (process.env.SELENIUM_HEADLESS !== '0') options.addArguments('--headless=new');
  // Keep React effects and timers running when Windows hides/occludes the test window.
  options.addArguments('--window-size=1440,1000', '--disable-notifications',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows');
  options.setLoggingPrefs({ performance: 'ALL', browser: 'ALL' });
  let builder = new Builder().forBrowser('chrome').setChromeOptions(options);
  if (process.env.SELENIUM_REMOTE_URL) builder = builder.usingServer(process.env.SELENIUM_REMOTE_URL);
  driver = await builder.build();
  await driver.manage().setTimeouts({ pageLoad: 45000, script: timeout, implicit: 0 });
  await go('/login');
  await run('SEL-AUTH-00', 'Workspace yêu cầu phiên đăng nhập', async () => {
    await go('/workspace');
    await driver.wait(until.urlMatches(/\/login\?/), timeout);
    assert.equal(new URL(await driver.getCurrentUrl()).searchParams.get('returnTo'), '/workspace');
    await visible(css('#login-password'));
    const status = await driver.executeAsyncScript("const done=arguments[arguments.length-1]; fetch('/api/workspace').then(r=>done(r.status)).catch(()=>done(0));");
    assert.equal(status, 401);
  });
  await run('SEL-AUTH-UI', 'Giao diện đăng nhập và liên kết', async () => {
    await go('/login');
    await heading('Chào mừng trở lại');
    assert.equal(await (await visible(css('input[autocomplete="username"]'))).getAttribute('required'), 'true');
    assert.equal(await (await visible(css('#login-password'))).getAttribute('type'), 'password');
    for (const href of ['/register', '/']) await visible(css(`a[href="${href}"]`));
  });
  await run('SEL-AUTH-EMPTY', 'Form rỗng bị chặn', async () => {
    await go('/login');
    await (await visible(css('button[type="submit"]'))).click();
    assert.equal(await driver.executeScript('return document.querySelector("form").checkValidity()'), false);
    assert.equal(new URL(await driver.getCurrentUrl()).pathname, '/login');
  });
  await run('SEL-AUTH-TOGGLE', 'Hiện ẩn mật khẩu không mất nội dung', async () => {
    await go('/login');
    const input = await visible(css('#login-password'));
    await input.sendKeys('Synthetic-UI-Only');
    await (await visible(css('button[aria-label="Hiện mật khẩu"]'))).click();
    assert.equal(await input.getAttribute('type'), 'text');
    assert.equal(await input.getAttribute('value'), 'Synthetic-UI-Only');
    await (await visible(css('button[aria-label="Ẩn mật khẩu"]'))).click();
    assert.equal(await input.getAttribute('type'), 'password');
  });
  await run('TC-AUTH-02-UI', 'Sai mật khẩu một lần bị từ chối', async () => {
    await go('/login');
    await (await visible(css('input[autocomplete="username"]'))).sendKeys(identifier);
    await (await visible(css('#login-password'))).sendKeys('Wrong-Selenium-Password-Only');
    await (await visible(css('button[type="submit"]'))).click();
    const error = await visible(css('.alert.error[role="alert"]'));
    assert.match(await error.getText(), /không chính xác|không đúng|không hợp lệ/i);
    assert.equal(new URL(await driver.getCurrentUrl()).pathname, '/login');
  }, true);
  await run('TC-AUTH-01', 'OWNER đăng nhập và giữ phiên sau reload', async () => {
    await login();
    await heading('Tổng quan');
    const role = await driver.executeAsyncScript("const done=arguments[arguments.length-1]; fetch('/api/workspace').then(r=>r.json()).then(d=>done(d.user?.role)).catch(()=>done(null));");
    assert.equal(role, 'OWNER');
    await driver.navigate().refresh();
    await heading('Tổng quan');
  }, true);
  await run('SEL-DASH-01', 'Dashboard desktop và điều hướng', async () => {
    await login();
    await go('/workspace');
    await heading('Tổng quan');
    await visible(css('main'));
    await visible(css('button[aria-label="Đăng xuất"]'));
    await visible(css('a[href="/workspace"]'));
    assert.ok((await driver.findElements(css('main h2, main h3, main .stat-card'))).length > 0);
    assert.equal(await driver.executeScript('return document.documentElement.scrollWidth <= innerWidth + 1'), true);
  }, true);
  for (const [key, title] of [['customers','Khách hàng'], ['appointments','Lịch hẹn'], ['cashier','Thu ngân'], ['invoices','Hóa đơn & công nợ'], ['packages','Gói của khách'], ['deposits','Tiền cọc'], ['cash','Sổ thu chi']]) {
    await run(`SEL-ROUTE-${key}`, `Mở và tải lại ${title}`, async () => {
      await login();
      await go(`/workspace/${key}`);
      await heading(title);
      await driver.navigate().refresh();
      await heading(title);
    }, true);
  }
  await run('SEL-FLOW-SEARCH', 'Tìm khách giữ bộ lọc sau reload', async () => {
    await login();
    await go('/workspace/customers');
    await heading('Khách hàng');
    const query = 'SELENIUM-NO-CUSTOMER-987654';
    await (await visible(css('input[aria-label="Tìm kiếm"]'))).sendKeys(query);
    await driver.wait(async () => new URL(await driver.getCurrentUrl()).searchParams.get('search') === query, timeout);
    await driver.navigate().refresh();
    await heading('Khách hàng');
    assert.equal(await (await visible(css('input[aria-label="Tìm kiếm"]'))).getAttribute('value'), query);
  }, true);
  await run('SEL-FLOW-CASHIER', 'Chuyển danh mục thu ngân rồi mở hóa đơn', async () => {
    await login();
    await go('/workspace/cashier');
    await heading('Thu ngân');
    for (const title of ['Dịch vụ lẻ', 'Dùng gói đã mua', 'Bán gói mới', 'Sản phẩm']) {
      const button = await visible(By.xpath(`//div[@aria-label='Danh mục thu ngân']/button[normalize-space(.)='${title}']`));
      await button.click();
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
    }
    await (await visible(By.xpath("//button[normalize-space(.)='Danh sách hóa đơn']"))).click();
    await heading('Hóa đơn & công nợ');
    assert.equal(new URL(await driver.getCurrentUrl()).pathname, '/workspace/invoices');
  }, true);
  await run('SEL-DASH-MOBILE', 'Mobile không tràn ngang và menu neo đáy', async () => {
    await login();
    await go('/workspace');
    await heading('Tổng quan');
    await driver.manage().window().setRect({ width: 390, height: 844 });
    const nav = await visible(css('nav[aria-label="Menu chính trên điện thoại"]'));
    const check = async () => {
      const r = await driver.executeScript('const r=arguments[0].getBoundingClientRect();return {bottom:r.bottom,height:r.height,viewport:innerHeight,overflow:document.documentElement.scrollWidth-innerWidth}', nav);
      assert.ok(r.height > 0 && Math.abs(r.bottom - r.viewport) <= 2);
      assert.ok(r.overflow <= 1);
    };
    await check();
    await driver.executeScript('window.scrollTo(0,document.body.scrollHeight)');
    await check();
    await (await visible(By.xpath("//nav[@aria-label='Menu chính trên điện thoại']/button[.//small[normalize-space(.)='Vận hành']]"))).click();
    await visible(css('section[aria-label="Điều hướng di động"]'));
    await (await visible(css('section[aria-label="Điều hướng di động"] a[href="/workspace/customers"]'))).click();
    await heading('Khách hàng');
  }, true);
  await run('SEL-AUTH-LOGOUT', 'Đăng xuất chặn truy cập lại workspace', async () => {
    await login();
    await go('/workspace/customers');
    await heading('Khách hàng');
    step = 'logout button';
    await (await visible(css('button[aria-label="Đăng xuất"]'))).click();
    step = 'session cookie removed';
    await driver.wait(async () => {
      const cookies = await driver.manage().getCookies();
      return !cookies.some(cookie => cookie.name === 'spacare_session');
    }, timeout);
    authenticated = false;
    await go('/workspace');
    await driver.wait(until.urlMatches(/\/login(?:\?|$)/), timeout);
  }, true);
} catch (error) {
  results.push({ id: 'SETUP', status: 'BLOCKED', reason: error.name });
  console.error('BLOCKED: Check Chrome, network, Selenium Manager and application URL.');
} finally {
  if (driver) await driver.quit().catch(() => {});
  await writeFile(resolve(out, 'report.json'), JSON.stringify({ origin, results }, null, 2));
  await writeFile(resolve(out, 'report.md'), ['# Selenium SpaCare', '', '| Case | Status |', '|---|---|', ...results.map(r => `| ${r.id} | ${r.status} |`)].join('\n'));
  console.log(`Report: ${out}`);
  if (results.some(r => ['FAIL','BLOCKED'].includes(r.status))) process.exitCode = 1;
  else if (results.some(r => r.status === 'SKIP')) process.exitCode = 2;
}
