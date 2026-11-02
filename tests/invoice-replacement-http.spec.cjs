const { test, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');

const fixture = JSON.parse(readFileSync(process.env.SPACARE_HTTP_E2E_FIXTURE, 'utf8'));

async function login(page, credentials) {
  await page.goto('/login');
  await page.getByPlaceholder('Số điện thoại hoặc email').fill(credentials.email);
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(credentials.password);
  await page.getByRole('button', { name: /Đăng nhập/ }).click();
  await expect(page).toHaveURL(/\/workspace(?:\/|$)/);
}

async function postOperation(page, action, data, key) {
  return page.evaluate(async ({ action, data, key }) => {
    const response = await fetch('/api/operations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify({ action, data }),
    });
    return { status: response.status, body: await response.json() };
  }, { action, data, key });
}

function replacementInput(target, oldStaffId, newStaffId) {
  return {
    id: target.invoiceId,
    expectedUpdatedAt: target.updatedAt,
    expectedDocumentId: target.invoiceId,
    oldStaffId,
    newStaffId,
    reason: 'E2E kiểm thử dữ liệu giả',
  };
}

test('OWNER previews and replaces once through login, browser UI, HTTP and Next', async ({ page }) => {
  await login(page, fixture.owner);
  const baselineResponse = await page.evaluate(async () => {
    const response = await fetch('/api/workspace?section=reports&page=1&pageSize=10');
    return { status: response.status, body: await response.json() };
  });
  expect(baselineResponse.status).toBe(200);
  const baseline = baselineResponse.body.report;

  const operationRequests = [];
  page.on('request', request => {
    if (request.url().endsWith('/api/operations') && request.method() === 'POST') {
      operationRequests.push({
        data: request.postDataJSON(),
        key: request.headers()['idempotency-key'],
      });
    }
  });
  await page.goto(`/workspace/invoices?search=${encodeURIComponent(fixture.primary.invoiceCode)}`);
  await expect(page.getByText(fixture.primary.invoiceCode, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Chi tiết / chữ ký' }).click();
  const dialog = page.getByRole('dialog', { name: 'Chi tiết hóa đơn' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.invoice-detail-money')).toContainText('1.750.000');
  await expect(dialog.locator('.invoice-detail-money')).toContainText('Đã trả');
  await expect(dialog.getByText(fixture.customerName, { exact: true })).toBeVisible();
  await expect(dialog.locator('.invoice-signature').filter({ hasText: 'Buổi 1' })).toBeVisible();

  await dialog.getByRole('button', { name: 'Thay thế chứng từ sửa tư vấn bán gói' }).click();
  await dialog.getByLabel('Người tư vấn cũ').selectOption(fixture.staff[0].id);
  await dialog.getByLabel('Người tư vấn mới').selectOption(fixture.staff[2].id);
  await dialog.getByRole('button', { name: 'Xem trước thay thế' }).click();
  const preview = dialog.getByRole('region', { name: 'Xem trước thay thế' });
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('Chuyển khoản');
  await expect(preview).toContainText(fixture.staff[0].name);
  await expect(preview).toContainText(fixture.staff[2].name);
  await expect(preview).toContainText('Buổi đã ghi 1');
  await expect(preview).toContainText('Quỹ hoa hồng gốc: 87.500');
  await expect(preview.getByRole('row').filter({ hasText: fixture.staff[0].name })).toContainText(/43\.750.*0/);
  await expect(preview.getByRole('row').filter({ hasText: fixture.staff[2].name })).toContainText(/0.*43\.750/);
  await expect(preview.getByLabel('Lý do thay thế')).toBeVisible();
  const confirm = dialog.getByRole('button', { name: 'Xác nhận tạo chứng từ thay thế' });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel('Lý do thay thế').fill('E2E lý do giả: ghi nhầm tư vấn');
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(preview).toHaveCount(0);

  await expect.poll(() => operationRequests.filter(request => request.data.action === 'replacePackageAdvisor').length).toBe(1);
  const replacementRequest = operationRequests.find(request => request.data.action === 'replacePackageAdvisor');
  expect(replacementRequest.key).toBeTruthy();
  expect(operationRequests.filter(request => request.data.action === 'replacePackageAdvisor')).toHaveLength(1);
  const replay = await postOperation(page, replacementRequest.data.action, replacementRequest.data.data, replacementRequest.key);
  expect(replay.status).toBe(200);
  expect(replay.body.code).toMatch(/^HD\d{6}$/);
  const replacementRequests = operationRequests.filter(request => request.data.action === 'replacePackageAdvisor');
  expect(replacementRequests).toHaveLength(2);
  expect(replacementRequests.every(request => request.key === replacementRequest.key)).toBe(true);

  await expect(dialog.getByText(`Chứng từ hiện hành: ${replay.body.code}`)).toBeVisible();
  await expect(dialog.getByRole('link', { name: fixture.primary.invoiceCode, exact: true })).toBeVisible();
  await dialog.getByRole('link', { name: fixture.primary.invoiceCode, exact: true }).click();
  const historicalDocument = dialog.locator(`#document-${fixture.primary.invoiceId}`);
  await expect(historicalDocument).toBeVisible();
  await historicalDocument.locator('summary').click();
  await expect(dialog.getByText(/Chứng từ này chỉ để tra cứu, đã hết hiệu lực/)).toBeVisible();
  await historicalDocument.getByRole('link', { name: replay.body.code, exact: true }).click();
  await expect(page).toHaveURL(/#current-invoice-document$/);
  await expect(dialog.locator('.invoice-detail-money')).toContainText('1.750.000');
  const invoiceResponse = await page.evaluate(async id => {
    const response = await fetch(`/api/invoices/${id}`);
    return { status: response.status, body: await response.json() };
  }, fixture.primary.invoiceId);
  expect(invoiceResponse.status).toBe(200);
  expect(invoiceResponse.body.invoice.effectiveCode).toBe(replay.body.code);
  expect(invoiceResponse.body.invoice.paid).toBe(1_750_000);
  expect(invoiceResponse.body.invoice.status).toBe('PAID');
  expect(invoiceResponse.body.treatments[0].remaining).toBe(9);
  expect(invoiceResponse.body.signatureTotal).toBe(1);
  expect(invoiceResponse.body.signatures[0].signature).toBeTruthy();

  await page.getByRole('button', { name: 'Đóng' }).click();
  await page.goto('/workspace/reports');
  const reportResponse = await page.evaluate(async () => {
    const response = await fetch('/api/workspace?section=reports&page=1&pageSize=10');
    return { status: response.status, body: await response.json() };
  });
  expect(reportResponse.status).toBe(200);
  const report = reportResponse.body.report;
  expect(report.summary).toEqual(baseline.summary);
  expect(report.inflow).toBe(baseline.inflow);
  expect(report.total).toBe(baseline.total);
  expect(report.total).toBe(4);
  expect(report.invoices.filter(invoice => invoice.effectiveCode === replay.body.code)).toHaveLength(1);
  expect(report.invoices.some(invoice => invoice.effectiveCode === fixture.primary.invoiceCode)).toBe(false);
  const totalSaleCommission = rows => rows.reduce((sum, row) => sum + (row.saleCommission || 0), 0);
  expect(totalSaleCommission(report.employees)).toBe(totalSaleCommission(baseline.employees));
  const newAdvisor = report.employees.find(row => row._id === fixture.staff[2].id);
  const oldAdvisor = report.employees.find(row => row._id === fixture.staff[0].id);
  const previousNewAdvisor = baseline.employees.find(row => row._id === fixture.staff[2].id);
  const previousOldAdvisor = baseline.employees.find(row => row._id === fixture.staff[0].id);
  expect(newAdvisor.saleCommission).toBe(previousNewAdvisor.saleCommission + 43_750);
  expect(oldAdvisor.saleCommission).toBe(previousOldAdvisor.saleCommission - 43_750);
  expect(newAdvisor.saleCommission).toBe(43_750);
  await expect(page.getByRole('heading', { name: 'Báo cáo' })).toBeVisible();
  await page.getByRole('button', { name: 'Nhân viên', exact: true }).click();
  await page.getByLabel('Tìm nhân viên trong báo cáo').fill(fixture.staff[2].name);
  const advisorRow = page.getByRole('row').filter({ hasText: fixture.staff[2].name });
  await expect(advisorRow).toContainText('43.750');
});

test('unauthenticated, inactive and non-OWNER requests are denied', async ({ page }) => {
  await page.goto('/login');
  const unauthenticated = await postOperation(page, 'replacePackageAdvisor',
    replacementInput(fixture.stale, fixture.staff[0].id, fixture.staff[2].id), `e2e-${Date.now()}-unauth`);
  expect(unauthenticated.status).toBe(401);

  await page.getByPlaceholder('Số điện thoại hoặc email').fill(fixture.inactiveOwner.email);
  await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(fixture.inactiveOwner.password);
  await page.getByRole('button', { name: /Đăng nhập/ }).click();
  await expect(page.getByRole('alert')).toBeVisible();

  await login(page, fixture.staff[1]);
  const staffResponse = await postOperation(page, 'replacePackageAdvisor',
    replacementInput(fixture.stale, fixture.staff[0].id, fixture.staff[2].id), `e2e-${Date.now()}-staff`);
  expect(staffResponse.status).toBe(403);
});

test('cross-spa invoices, missing reason and stale versions are rejected over HTTP', async ({ page }) => {
  await login(page, fixture.owner);
  const foreign = await postOperation(page, 'replacePackageAdvisor',
    replacementInput(fixture.foreign, fixture.foreignOwner.id, fixture.staff[2].id), `e2e-${Date.now()}-foreign`);
  expect(foreign.status).toBe(404);

  const missingReasonData = replacementInput(fixture.missingReason, fixture.staff[0].id, fixture.staff[2].id);
  missingReasonData.reason = '';
  const missingReason = await postOperation(page, 'replacePackageAdvisor', missingReasonData, `e2e-${Date.now()}-reason`);
  expect(missingReason.status).toBe(400);

  const staleData = replacementInput(fixture.stale, fixture.staff[0].id, fixture.staff[2].id);
  staleData.expectedUpdatedAt = '2000-01-01T00:00:00.000Z';
  const stale = await postOperation(page, 'replacePackageAdvisor', staleData, `e2e-${Date.now()}-version`);
  expect(stale.status).toBe(409);
});
