import {test,expect} from '@playwright/test';

test('invoice list opens one payment form for both methods', async ({page}) => {
 await page.goto('/workspace/invoices');
 await page.locator('.invoice-list-actions summary').click();
 await page.getByRole('button',{name:'Thanh toán',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Tiền mặt',exact:true})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Chuyển khoản / QR',exact:true})).toBeVisible();
});

test('split payment validates totals, confirms each method and preserves partial debt', async ({page},testInfo) => {
 await page.goto('/split-payment?paid=300000');
 const dialog = page.getByRole('dialog');
 await expect(dialog.locator('.payment-summary')).toContainText('Còn phải thanh toán1.200.000 đ');
 const submit=dialog.getByRole('button',{name:'Xác nhận đã nhận tiền'});
 await expect(submit).toBeDisabled();
 await dialog.getByRole('textbox',{name:'Tiền mặt',exact:true}).fill('1000000');
 await dialog.getByRole('textbox',{name:'Chuyển khoản / QR',exact:true}).fill('500000');
 await expect(dialog.getByRole('alert')).toHaveText('Tổng thu vượt số còn phải thanh toán.');
 await expect(submit).toBeDisabled();
 await dialog.getByRole('textbox',{name:'Chuyển khoản / QR',exact:true}).fill('200000');
 await expect(dialog.locator('.payment-collection-total')).toHaveText('Tổng thu lần này: 1.200.000 đ');
 await dialog.getByRole('checkbox',{name:'Đã đếm và thực nhận tiền mặt'}).check();
 await expect(submit).toBeDisabled();
 await dialog.getByRole('checkbox',{name:'Đã kiểm tra tài khoản và thực nhận chuyển khoản'}).check();
 await submit.click();
 const saved=JSON.parse(await page.locator('#saved-payment').textContent());
 expect(saved.payments.map(row=>[row.method,row.amount,row.receivedConfirmation])).toEqual([['CASH',1000000,true],['BANK_TRANSFER',200000,true]]);
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 const bounds = await dialog.boundingBox();
 expect(bounds.x).toBeGreaterThanOrEqual(0);
 expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await dialog.locator('.payment-collection-total').scrollIntoViewIfNeeded();
 await page.screenshot({path:testInfo.outputPath('split-payment.png')});
});

test('split payment supports one method and blank unused amount', async ({page}) => {
 await page.goto('/split-payment');
 await page.getByRole('textbox',{name:'Tiền mặt',exact:true}).fill('');
 await page.getByRole('textbox',{name:'Chuyển khoản / QR',exact:true}).fill('1500000');
 await page.getByRole('checkbox',{name:'Đã kiểm tra tài khoản và thực nhận chuyển khoản'}).check();
 await page.getByRole('button',{name:'Xác nhận đã nhận tiền'}).click();
 const saved=JSON.parse(await page.locator('#saved-payment').textContent());
 expect(saved.payments).toHaveLength(1); expect(saved.payments[0].method).toBe('BANK_TRANSFER');
 expect(saved.payments[0].amount).toBe(1500000);
});

test('split payment reveals required partial allocations only when needed and resets confirmation after amount changes', async ({page},testInfo) => {
 await page.goto('/split-payment?lines=1');
 await page.getByRole('textbox',{name:'Tiền mặt',exact:true}).fill('200000');
 await page.getByRole('textbox',{name:'Chuyển khoản / QR',exact:true}).fill('100000');
 const allocation=page.locator('.payment-service-allocation');
 await expect(allocation).toHaveJSProperty('open',false);
 await expect(page.locator('input[name^="CASHAllocations:"]').first()).toBeHidden();
 await allocation.locator('summary').click();
 await expect(page.locator('input[name^="CASHAllocations:"]').first()).toBeVisible();
 await page.getByRole('checkbox',{name:'Đã đếm và thực nhận tiền mặt'}).check();
 await page.getByRole('checkbox',{name:'Đã kiểm tra tài khoản và thực nhận chuyển khoản'}).check();
 await page.getByRole('textbox',{name:'Tiền mặt',exact:true}).fill('199999');
 await expect(page.getByRole('checkbox',{name:'Đã đếm và thực nhận tiền mặt'})).not.toBeChecked();
 await page.getByRole('textbox',{name:'Tiền mặt',exact:true}).fill('200000');
 await page.getByRole('checkbox',{name:'Đã đếm và thực nhận tiền mặt'}).check();
 await expect(allocation).toHaveJSProperty('open',false);
 await page.getByRole('button',{name:'Xác nhận đã nhận tiền'}).click();
 await expect(page.locator('#saved-payment')).toBeEmpty();
 await expect(allocation).toHaveJSProperty('open',true);
 await expect(page.getByRole('alert')).toContainText('Kiểm tra phân bổ');
 await page.locator('input[name="CASHAllocations:'+'1'.repeat(24)+'"]').fill('1.00');
 await allocation.locator('summary').click();
 await page.getByRole('button',{name:'Xác nhận đã nhận tiền'}).click();
 await expect(allocation).toHaveJSProperty('open',true);
 await expect(page.locator('#saved-payment')).toBeEmpty();
 await page.locator('input[name="CASHAllocations:'+'1'.repeat(24)+'"]').fill('200000');
 await page.locator('input[name="BANK_TRANSFERAllocations:'+'2'.repeat(24)+'"]').fill('100000');
 await page.getByRole('button',{name:'Xác nhận đã nhận tiền'}).click();
 const saved=JSON.parse(await page.locator('#saved-payment').textContent());
 expect(saved.payments.map(row=>row.lineAllocations)).toEqual([[{lineId:'1'.repeat(24),amount:200000}],[{lineId:'2'.repeat(24),amount:100000}]]);
 await allocation.scrollIntoViewIfNeeded();
 await page.screenshot({path:testInfo.outputPath('partial-allocation.png')});
});

for(const amount of [600000,1500000])test(`one service hides allocation fields for collection ${amount}`,async({page})=>{
 await page.goto('/split-payment?lines=single');
 await page.getByRole('textbox',{name:'Tiền mặt',exact:true}).fill(String(amount));
 await expect(page.locator('.payment-service-allocation, input[name^="CASHAllocations:"]')).toHaveCount(0);
 await page.getByRole('checkbox',{name:'Đã đếm và thực nhận tiền mặt'}).check();
 await page.getByRole('button',{name:'Xác nhận đã nhận tiền'}).click();
 expect(JSON.parse(await page.locator('#saved-payment').textContent()).payments[0].lineAllocations).toEqual([{lineId:'1'.repeat(24),amount}]);
});

test('only one outstanding service hides both allocation panels for a partial mixed receipt',async({page},testInfo)=>{
 await page.goto('/split-payment?lines=one-owing');
 await page.getByRole('textbox',{name:'Tiền mặt',exact:true}).fill('100000');
 await page.getByRole('textbox',{name:'Chuyển khoản / QR',exact:true}).fill('200000');
 await expect(page.locator('.payment-service-allocation, input[name*="Allocations:"]')).toHaveCount(0);
 await page.getByRole('checkbox',{name:'Đã đếm và thực nhận tiền mặt'}).check();
 await page.getByRole('checkbox',{name:'Đã kiểm tra tài khoản và thực nhận chuyển khoản'}).check();
 await page.getByRole('button',{name:'Xác nhận đã nhận tiền'}).click();
 expect(JSON.parse(await page.locator('#saved-payment').textContent()).payments.map(row=>row.lineAllocations)).toEqual([[{lineId:'2'.repeat(24),amount:100000}],[{lineId:'2'.repeat(24),amount:200000}]]);
 await page.locator('.payment-summary').scrollIntoViewIfNeeded();
 await page.screenshot({path:testInfo.outputPath('one-outstanding-service.png')});
});

test('full mixed settlement hides manual panels and uses actual balances instead of stale manual input',async({page},testInfo)=>{
 await page.goto('/split-payment?lines=1&paid=300000');
 await page.getByRole('textbox',{name:'Tiền mặt',exact:true}).fill('100000');
 await page.locator('.payment-service-allocation summary').click();
 await page.locator('input[name="CASHAllocations:'+'2'.repeat(24)+'"]').fill('100000');
 await page.getByRole('textbox',{name:'Tiền mặt',exact:true}).fill('800000');
 await page.getByRole('textbox',{name:'Chuyển khoản / QR',exact:true}).fill('400000');
 await expect(page.locator('.payment-service-allocation, input[name*="Allocations:"]')).toHaveCount(0);
 await page.getByRole('checkbox',{name:'Đã đếm và thực nhận tiền mặt'}).check();
 await page.getByRole('checkbox',{name:'Đã kiểm tra tài khoản và thực nhận chuyển khoản'}).check();
 await page.getByRole('button',{name:'Xác nhận đã nhận tiền'}).click();
 expect(JSON.parse(await page.locator('#saved-payment').textContent()).payments.map(row=>row.lineAllocations)).toEqual([[{lineId:'1'.repeat(24),amount:700000},{lineId:'2'.repeat(24),amount:100000}],[{lineId:'2'.repeat(24),amount:400000}]]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('.payment-summary').scrollIntoViewIfNeeded();
 await page.screenshot({path:testInfo.outputPath('full-settlement.png')});
});

test('invoice detail keeps per-service staff, separate receipts and totals on desktop and mobile', async ({page}, testInfo) => {
 const errors = [];
 page.on('pageerror', error => errors.push(error.message));
 await page.goto('/invoice-detail');
 const dialog = page.getByRole('dialog', {name:'Chi tiết hóa đơn'});
 const services = dialog.locator('.invoice-service-lines p');
 await expect(services).toHaveCount(3);
 await expect(services.nth(0)).toContainText('Massage CVG');
 await expect(services.nth(0)).toContainText('Kỹ thuật viên: Thư');
 await expect(services.nth(1)).toContainText('Kỹ thuật viên: Quỳnh');
 await expect(services.nth(2)).toContainText('Kỹ thuật viên: Chưa có');
 const payments = dialog.getByRole('region', {name:'Phương thức thanh toán'}).getByRole('listitem');
 await expect(payments).toHaveText(['Chuyển khoản:500.000 đ', 'Tiền mặt:600.000 đ', 'Tiền mặt:400.000 đ']);
 await expect(dialog.locator('.invoice-detail-money > span')).toHaveText(['Tổng tiền1.500.000 đ', 'Đã thanh toán1.500.000 đ', 'Còn nợ0 đ']);
 await expect(dialog.getByText('Người tạo:', {exact:false})).toContainText('Chủ spa kiểm thử');
 await expect(dialog.getByText(/hệ thống sẽ kiểm tra và chặn|Nhân viên đã ghi nhận|Đã thực hiện:/)).toHaveCount(0);
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('invoice-detail.png'),fullPage:true});
 await dialog.getByRole('region', {name:'Phương thức thanh toán'}).scrollIntoViewIfNeeded();
 await page.screenshot({path:testInfo.outputPath('invoice-payments.png'),fullPage:true});
 expect(errors).toEqual([]);
});
test('packages search keeps its DOM node, focus and middle caret across delayed fetch and URL sync',async({page})=>{
 await page.goto('/workspace/packages');const input=page.getByRole('textbox',{name:'Tìm kiếm',exact:true});await expect(input).toBeVisible();
 await input.focus();await input.pressSequentially('Nguyễn Ánh 0900',{delay:45});await page.waitForTimeout(800);
 await expect(input).toHaveValue('Nguyễn Ánh 0900');await expect(input).toBeFocused();
 await input.press('Home');await input.press('ArrowRight');await input.pressSequentially('X');await page.waitForTimeout(800);
 await expect(input).toHaveValue('NXguyễn Ánh 0900');await expect(input).toBeFocused();
 expect(await input.evaluate(el=>el.selectionStart)).toBe(2);
 await input.evaluate(el=>{el.dataset.identity='original-node';});
 await input.pressSequentially('Y');await page.waitForTimeout(800);expect(await input.getAttribute('data-identity')).toBe('original-node');
 // Vietnamese composition must not publish a stale partial URL into the draft.
 await input.dispatchEvent('compositionstart');await input.fill('liệu trình');await page.waitForTimeout(500);await input.dispatchEvent('compositionend');await page.waitForTimeout(500);await expect(input).toHaveValue('liệu trình');await expect(input).toBeFocused();
});
test('money draft keeps caret, stores numeric VND, optional fields stay optional and invalid values survive',async({page})=>{
 await page.goto('/workspace/packages');const form=page.locator('#money-test');const input=form.locator('input[name="amount"]');
 await input.pressSequentially('1.000.000');await expect(input).toHaveValue('1.000.000');await expect(input).toBeFocused();
 await form.getByRole('button',{name:'Lưu tiền kiểm thử'}).click();await expect(page.locator('#saved-money')).toHaveText('1000000');
 await input.fill('1.00');await form.getByRole('button',{name:'Lưu tiền kiểm thử'}).click();await expect(form.locator('.field-error')).toBeVisible();await expect(input).toHaveValue('1.00');
 await expect(form.locator('label').filter({has:input}).locator('.required-mark')).toHaveCount(1);
 await expect(form.locator('label').filter({has:form.locator('textarea')}).locator('.required-mark')).toHaveCount(0);
});
test('packages remove duplicate metrics and keep both date inputs in the same row without horizontal overflow',async({page})=>{
 await page.goto('/workspace/packages');await expect(page.getByRole('textbox',{name:'Tìm kiếm',exact:true})).toBeVisible();
 await expect(page.getByText('Tổng số gói',{exact:true})).toHaveCount(0);await expect(page.getByText('Số buổi còn lại',{exact:true})).toHaveCount(0);await expect(page.getByText('8/10 buổi',{exact:true})).toBeVisible();
 const from=await page.getByLabel('Từ ngày',{exact:true}).boundingBox(),to=await page.getByLabel('Đến ngày',{exact:true}).boundingBox();
 expect(Math.abs(from.y-to.y)).toBeLessThan(2);expect(to.x).toBeGreaterThan(from.x);expect(from.height).toBeGreaterThanOrEqual(40);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
