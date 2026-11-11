import {test,expect} from '@playwright/test';

test('discount program: cashier previews automatic percent, preserves prices and returns to manual before the period',async({page})=>{
 await page.goto('/repeated-services?program=active');await page.getByRole('button',{name:/Nhóm QA.*1 dịch vụ/}).click();await page.getByRole('button',{name:/^Massage nhóm/}).click();
 await page.getByRole('button',{name:/Chọn kĩ thuật viên/}).click();await page.getByRole('checkbox',{name:'Kỹ thuật viên An',exact:true}).check();await page.getByRole('button',{name:/Kỹ thuật viên An/}).click();
 await expect(page.getByRole('region',{name:'Chương trình giảm giá áp dụng'})).toContainText('Ưu đãi fixture');
 await expect(page.getByRole('region',{name:'Chương trình giảm giá áp dụng'})).toContainText('25% · Giảm 87.500 đ');
 await expect(page.getByRole('combobox',{name:'Loại giảm giá',exact:true})).toHaveCount(0);
 await expect(page.locator('.cashier-total').first()).toContainText('262.500 đ');
 await page.getByRole('button',{name:'Lưu toàn bộ giỏ',exact:true}).click();
 const saved=JSON.parse(await page.locator('#saved-cashier').textContent());expect(saved.values.discount).toBeUndefined();expect(saved.values.discountProgram.id).toBe('8'.repeat(24));expect(saved.values.items[0].total).toBe(350000);
 await page.getByLabel('Ngày hóa đơn (để trống: hôm nay)',{exact:true}).fill('2026-10-21');
 await expect(page.getByRole('combobox',{name:'Loại giảm giá',exact:true})).toBeVisible();await expect(page.locator('.cashier-total').first()).toContainText('350.000 đ');
});
test('discount program: commercial creation sends preview identity and blocks unavailable program reads',async({page})=>{
 await page.goto('/pre-service?program=active');await page.getByRole('combobox',{name:'Dịch vụ',exact:true}).selectOption('c'.repeat(24));
 await expect(page.getByRole('region',{name:'Chương trình giảm giá áp dụng'})).toContainText('Giảm 25.000 đ');
 await page.getByRole('button',{name:'Lưu thông tin',exact:true}).click();const saved=JSON.parse(await page.locator('#saved-advance').textContent());expect(saved.discount).toBeUndefined();expect(saved.discountProgram.id).toBe('8'.repeat(24));
 await page.goto('/pre-service?program=error');await page.getByRole('combobox',{name:'Dịch vụ',exact:true}).selectOption('c'.repeat(24));
 await expect(page.getByRole('alert')).toContainText('Không tải được');await expect(page.getByRole('button',{name:'Lưu thông tin',exact:true})).toBeDisabled();await expect(page.locator('#saved-advance')).toHaveText('');
});
test('discount program: running edits and disabling require explicit confirmation',async({page})=>{
 await page.goto('/workspace/discount_programs');await page.getByRole('button',{name:'Sửa / bật / tắt',exact:true}).click();
 await page.getByRole('spinbutton',{name:'Phần trăm giảm',exact:true}).fill('30');await page.getByRole('checkbox',{name:'Bật chương trình',exact:true}).uncheck();
 const save=page.getByRole('button',{name:'Lưu chương trình',exact:true});await expect(save).toBeDisabled();
 await page.getByRole('checkbox',{name:/Xác nhận sửa\/tắt chương trình đang chạy/}).check();await save.click();
 await expect.poll(()=>page.evaluate(()=>window.__programOperations.length)).toBe(1);
 const op=await page.evaluate(()=>window.__programOperations[0]);expect(op.data.confirmedRunning).toBe(true);expect(op.data.enabled).toBe(false);expect(op.data.percent).toBe(30);
});
test('discount program: invoice detail displays the saved historical program',async({page})=>{
 await page.goto('/invoice-detail?programSnapshot=1');await expect(page.getByText(/Chương trình giảm giá: Chương trình cũ/)).toContainText('GG_OLD');await expect(page.getByText(/Chương trình giảm giá: Chương trình cũ/)).toContainText('500.000 đ');
});

for(const form of ['commercial','cashier'])for(const date of ['','2026-12-01'])test(`invoice deadline: ${form} creation ${date?'with date':'blank'}`,async({page})=>{
 await page.goto(form==='commercial'?'/pre-service':'/repeated-services');
 if(form==='commercial')await page.getByRole('combobox',{name:'Dịch vụ',exact:true}).selectOption('c'.repeat(24));
 else {await page.getByRole('button',{name:'Sản phẩm',exact:true}).click();await page.getByRole('button',{name:/^Dầu gội QA/}).click();}
 const due=page.getByLabel('Hạn thanh toán',{exact:true});await expect(due).toHaveValue('');
 expect(await due.getAttribute('required')).toBeNull();
 if(date)await due.fill(date);
 await page.getByRole('button',{name:form==='commercial'?'Lưu thông tin':'Lưu toàn bộ giỏ',exact:true}).click();
 const saved=JSON.parse(await page.locator(form==='commercial'?'#saved-advance':'#saved-cashier').textContent());
 const values=form==='commercial'?saved:saved.values;
 expect(values.dueDate).toBe(date||undefined);
});

for(const variant of ['debt','missing','paid','stale-paid'])test(`invoice deadline detail: ${variant}`,async({page})=>{
 await page.goto('/invoice-detail?deadlineCase='+variant);
 const dialog=page.getByRole('dialog',{name:'Chi tiết hóa đơn'});
 await expect(dialog.getByText('Tổng thanh toán sau giảm',{exact:false})).toBeVisible();
 await expect(dialog.getByText('Hạn thanh toán: 2026-12-01',{exact:true})).toHaveCount(['debt','stale-paid'].includes(variant)?1:0);
 if(variant==='missing'||variant==='paid')await expect(dialog.getByText(/^Hạn thanh toán:/)).toHaveCount(0);
});

async function repeatedCart(page,count){
 await page.goto('/repeated-services');
 await page.getByRole('button',{name:/Nhóm QA.*1 dịch vụ/}).click();
 for(let i=0;i<count;i++)await page.getByRole('button',{name:/^Massage nhóm/}).click();
 await page.locator('.cashier-cart-group > summary').click();
 await expect(page.getByText(/phân bổ.*từng dịch vụ/)).toHaveCount(0);
}
async function assignOccurrence(page,index,name){
 const unit=page.locator('.cashier-cart-unit').nth(index);
 await unit.locator(':scope > summary').click();
 await unit.getByRole('button',{name:/Chọn kĩ thuật viên/}).click();
 await unit.getByRole('checkbox',{name,exact:true}).check();
 await unit.getByRole('button',{name:new RegExp(name)}).click();
}
for(const count of [2,3])for(const different of [false,true])test(`repeated services: ${count} occurrences, ${different?'different':'same'} technicians`,async({page})=>{
 await repeatedCart(page,count);
 for(let index=0;index<count;index++)await assignOccurrence(page,index,different&&index%2?'Kỹ thuật viên Bình':'Kỹ thuật viên An');
 await page.getByRole('button',{name:'Lưu toàn bộ giỏ'}).click();
 const saved=JSON.parse(await page.locator('#saved-cashier').textContent());
 expect(saved.action).toBe('serviceInvoice');expect(saved.values.items).toHaveLength(count);
 expect(saved.values.items.map(row=>row.performerId)).toEqual(Array.from({length:count},(_,index)=>(different&&index%2?'2':'1').repeat(24)));
 expect(saved.values.items.reduce((sum,row)=>sum+row.total,0)).toBe(350000*count);
 expect(new Set(saved.values.items.map(row=>row.serviceId)).size).toBe(1);
});
test('repeated services: removing the middle occurrence preserves other technicians and prices',async({page},testInfo)=>{
 await repeatedCart(page,3);
 await assignOccurrence(page,0,'Kỹ thuật viên An');
 await assignOccurrence(page,2,'Kỹ thuật viên Bình');
 const middle=page.locator('.cashier-cart-unit').nth(1);
 await middle.locator(':scope > summary').click();
 await middle.getByRole('button',{name:'Bỏ dịch vụ',exact:true}).click();
 await expect(page.locator('.cashier-cart-unit')).toHaveCount(2);
 await page.locator('.cashier-cart-unit').nth(1).getByLabel('Giá dịch vụ (VNĐ)').fill('400000');
 await page.getByRole('button',{name:'Lưu toàn bộ giỏ'}).click();
 const saved=JSON.parse(await page.locator('#saved-cashier').textContent());
 expect(saved.values.items.map(row=>[row.performerId,row.total])).toEqual([['1'.repeat(24),350000],['2'.repeat(24),400000]]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('repeated-services.png')});
});

for(const count of [1,2,3])test(`technician requirement: immediate service row ${count} blocks save without creator fallback`,async({page},testInfo)=>{
 if(count===1){await page.goto('/repeated-services');await page.getByRole('button',{name:/Nhóm QA.*1 dịch vụ/}).click();await page.getByRole('button',{name:/^Massage nhóm/}).click();}
 else {await repeatedCart(page,count);for(let i=0;i<count-1;i++)await assignOccurrence(page,i,'Kỹ thuật viên An');}
 await page.getByRole('button',{name:'Lưu toàn bộ giỏ'}).click();
 await expect(page.getByRole('alert')).toHaveText(`Chọn kỹ thuật viên cho dòng dịch vụ ${count} (Massage nhóm).`);
 await expect(page.locator('#saved-cashier')).toHaveText('');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('alert').scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('missing-technician.png')});
});

test('technician requirement: purchased package occurrences each require their own technician',async({page})=>{
 await page.goto('/repeated-services');await page.getByRole('button',{name:'Dùng gói đã mua',exact:true}).click();
 for(let i=0;i<2;i++)await page.getByRole('button',{name:/^Gói chăm sóc da/}).click();
 await page.locator('.cashier-cart-group > summary').click();
 for(const unit of await page.locator('.cashier-cart-unit').all())await unit.locator(':scope > summary').click();
 const selectors=page.getByLabel('Kĩ thuật viên lượt này',{exact:true});
 await selectors.nth(0).selectOption('1'.repeat(24));
 await page.getByRole('button',{name:'Lưu toàn bộ giỏ'}).click();
 await expect(page.getByRole('alert')).toHaveText('Chọn kỹ thuật viên cho lượt dùng gói 2 (Gói chăm sóc da).');
 await expect(page.locator('#saved-cashier')).toHaveText('');
 await selectors.nth(1).selectOption('2'.repeat(24));await page.getByRole('button',{name:'Lưu toàn bộ giỏ'}).click();
 const saved=JSON.parse(await page.locator('#saved-cashier').textContent());
 expect(saved.values.treatments.map(row=>row.performerId)).toEqual(['1'.repeat(24),'2'.repeat(24)]);
});

for(const [mode,item,action]of [['Bán gói mới','Gói dùng sau QA','sellPackage'],['Sản phẩm','Dầu gội QA','productInvoice']])test(`technician requirement: ${action} saves without a technician`,async({page})=>{
 await page.goto('/repeated-services');await page.getByRole('button',{name:mode,exact:true}).click();
 await page.getByRole('button',{name:new RegExp('^'+item)}).click();
 if(action==='sellPackage')await page.getByRole('combobox',{name:'Người tư vấn',exact:true}).selectOption('1'.repeat(24));
 await page.getByRole('button',{name:'Lưu toàn bộ giỏ'}).click();
 const saved=JSON.parse(await page.locator('#saved-cashier').textContent());expect(saved.action).toBe(action);
 expect(saved.values.staffId).toBeUndefined();expect(saved.values.performerId).toBeUndefined();
});

test('technician requirement: advance invoice saves without a technician',async({page})=>{
 await page.goto('/pre-service');await page.getByRole('combobox',{name:'Dịch vụ',exact:true}).selectOption('c'.repeat(24));
 await page.getByRole('button',{name:'Lưu thông tin',exact:true}).click();
 const saved=JSON.parse(await page.locator('#saved-advance').textContent());expect(saved.staffId).toBeUndefined();expect(saved.serviceId).toBe('c'.repeat(24));
});

for(const type of ['AMOUNT','PERCENT'])test(`new invoice ${type} discount previews net amount and saves its input`,async({page},testInfo)=>{
 await page.goto('/pre-service');await page.getByRole('combobox',{name:'Dịch vụ',exact:true}).selectOption('c'.repeat(24));
 await page.getByRole('combobox',{name:'Loại giảm giá',exact:true}).selectOption(type);
 if(type==='AMOUNT')await page.getByRole('textbox',{name:'Số tiền giảm (VNĐ)',exact:true}).fill('20.000');
 else await page.getByRole('spinbutton',{name:'Phần trăm giảm giá (0–100)',exact:true}).fill('20');
 await expect(page.locator('.invoice-discount-fields')).toContainText('Tạm tính: 100.000 đ');
 await expect(page.locator('.invoice-discount-fields')).toContainText('Tổng thanh toán sau giảm: 80.000 đ');
 await page.getByRole('textbox',{name:'Tiền mặt',exact:true}).fill('50000');
 await page.getByRole('checkbox',{name:'Đã thực nhận tiền mặt',exact:true}).check();
 await page.getByRole('button',{name:'Lưu thông tin',exact:true}).click();
 const saved=JSON.parse(await page.locator('#saved-advance').textContent());
 expect(saved.discount).toEqual({type,value:type==='AMOUNT'?20000:20});expect(saved.total).toBe(100000);
 expect(saved.payments[0].amount).toBe(50000);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('invoice-discount.png'),fullPage:true});
});

test('covered package form has no discount input',async({page})=>{
 await page.goto('/pre-service');await page.getByRole('checkbox',{name:/Gói chăm sóc da/}).check();
 await expect(page.getByRole('combobox',{name:'Loại giảm giá',exact:true})).toHaveCount(0);
});

test('cashier discount preserves repeated line prices and is sent once',async({page})=>{
 await repeatedCart(page,2);
 await assignOccurrence(page,0,'Kỹ thuật viên An');await assignOccurrence(page,1,'Kỹ thuật viên Bình');
 await page.getByRole('combobox',{name:'Loại giảm giá',exact:true}).selectOption('PERCENT');
 await page.getByRole('spinbutton',{name:'Phần trăm giảm giá (0–100)',exact:true}).fill('10');
 await expect(page.locator('.invoice-discount-fields')).toContainText('Tổng thanh toán sau giảm: 630.000 đ');
 await page.getByRole('button',{name:'Lưu toàn bộ giỏ',exact:true}).click();
 const saved=JSON.parse(await page.locator('#saved-cashier').textContent());
 expect(saved.values.discount).toEqual({type:'PERCENT',value:10});expect(saved.values.items.map(row=>row.total)).toEqual([350000,350000]);
 expect(saved.values.items.map(row=>row.performerId)).toEqual(['1'.repeat(24),'2'.repeat(24)]);
});

test('technician requirement: recording a package in the invoice form requires an explicit line technician',async({page},testInfo)=>{
 await page.goto('/pre-service');await page.getByRole('checkbox',{name:/Gói chăm sóc da/}).check();
 const technician=page.getByRole('combobox',{name:'Kỹ thuật viên lượt dùng gói 1 (Gói chăm sóc da)',exact:true});
 await expect(technician).toHaveValue('');await page.getByRole('button',{name:'Lưu thông tin',exact:true}).click();
 await expect(page.locator('#saved-advance')).toHaveText('');
 expect(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await technician.scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('package-technician.png')});
 await technician.selectOption('a'.repeat(24));await page.getByRole('button',{name:'Lưu thông tin',exact:true}).click();
 const saved=JSON.parse(await page.locator('#saved-advance').textContent());expect(saved.treatments[0].performerId).toBe('a'.repeat(24));
});

test('invoice list opens one payment form for both methods', async ({page}) => {
 await page.goto('/workspace/invoices');
 await expect(page.locator('.invoice-list-actions').getByRole('button',{name:'Thanh toán',exact:true})).toBeVisible();
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

test('partial mixed receipts on multiple services require only actual receipts and confirmation',async({page})=>{
 await page.goto('/split-payment?lines=1');
 await page.getByRole('textbox',{name:'Tiền mặt',exact:true}).fill('200000');
 await page.getByRole('textbox',{name:'Chuyển khoản / QR',exact:true}).fill('100000');
 await page.getByRole('checkbox',{name:'Đã đếm và thực nhận tiền mặt'}).check();
 await page.getByRole('checkbox',{name:'Đã kiểm tra tài khoản và thực nhận chuyển khoản'}).check();
 await page.getByRole('textbox',{name:'Tiền mặt',exact:true}).fill('199999');
 await expect(page.getByRole('checkbox',{name:'Đã đếm và thực nhận tiền mặt'})).not.toBeChecked();
 await expect(page.getByRole('button',{name:'Xác nhận đã nhận tiền'})).toBeDisabled();
 await page.getByRole('textbox',{name:'Tiền mặt',exact:true}).fill('200000');
 await page.getByRole('checkbox',{name:'Đã đếm và thực nhận tiền mặt'}).check();
 await page.getByRole('button',{name:'Xác nhận đã nhận tiền'}).click();
 const saved=JSON.parse(await page.locator('#saved-payment').textContent());
 expect(saved.payments.map(row=>[row.method,row.amount])).toEqual([['CASH',200000],['BANK_TRANSFER',100000]]);
 expect(saved.payments.every(row=>!('lineAllocations' in row))).toBe(true);
 await expect(page.getByRole('dialog').getByText(/phân bổ/i)).toHaveCount(0);
});

for(const scenario of [
 {name:'single partial',query:'lines=single',cash:600000,bank:0},
 {name:'single settled',query:'lines=single',cash:1500000,bank:0},
 {name:'multiple partial single method',query:'lines=1&total=2300000',cash:2000000,bank:0},
 {name:'multiple partial mixed methods',query:'lines=1&total=2300000',cash:1500000,bank:500000},
 {name:'multiple settled mixed methods',query:'lines=1&paid=300000',cash:800000,bank:400000},
 {name:'historical one outstanding',query:'lines=one-owing',cash:100000,bank:200000},
])test('invoice-level payment without allocation: '+scenario.name,async({page},testInfo)=>{
 await page.goto('/split-payment?'+scenario.query);
 const dialog=page.getByRole('dialog');
 await dialog.getByRole('textbox',{name:'Tiền mặt',exact:true}).fill(String(scenario.cash));
 await dialog.getByRole('textbox',{name:'Chuyển khoản / QR',exact:true}).fill(String(scenario.bank));
 await expect(dialog.locator('input[inputmode="numeric"]')).toHaveCount(2);
 await expect(dialog.locator('input[type="date"]')).toHaveCount(Number(!!scenario.cash)+Number(!!scenario.bank));
 const receivedDays=await dialog.locator('input[type="date"]').evaluateAll(inputs=>inputs.map(input=>input.value));
 await expect(dialog.locator('input[name*="Allocations"],.payment-service-allocation')).toHaveCount(0);
 await expect(dialog.getByText(/phân bổ/i)).toHaveCount(0);
 if(scenario.cash)await dialog.getByRole('checkbox',{name:'Đã đếm và thực nhận tiền mặt'}).check();
 if(scenario.bank)await dialog.getByRole('checkbox',{name:'Đã kiểm tra tài khoản và thực nhận chuyển khoản'}).check();
 await dialog.getByRole('button',{name:'Xác nhận đã nhận tiền'}).click();
 const saved=JSON.parse(await page.locator('#saved-payment').textContent());
 expect(saved.payments.reduce((sum,row)=>sum+row.amount,0)).toBe(scenario.cash+scenario.bank);
 expect(saved.payments.map(row=>row.receivedOn)).toEqual(receivedDays);
 expect(saved.payments.every(row=>!('lineAllocations' in row))).toBe(true);
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await dialog.locator('.payment-summary').scrollIntoViewIfNeeded();
 await page.screenshot({path:testInfo.outputPath(scenario.name.replaceAll(' ','-')+'.png')});
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
 await expect(dialog.locator('.invoice-detail-money > span')).toHaveText(['Tạm tính1.500.000 đ', 'Giảm giá (Không áp dụng)0 đ', 'Tổng thanh toán sau giảm1.500.000 đ', 'Đã thanh toán1.500.000 đ', 'Còn nợ0 đ']);
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
 await expect(form.locator('label:has(input[name="amount"]) .required-mark')).toHaveCount(1);
 await expect(form.locator('label:has(textarea) .required-mark')).toHaveCount(0);
});
test('packages remove duplicate metrics and keep both date inputs in the same row without horizontal overflow',async({page})=>{
 await page.goto('/workspace/packages');await expect(page.getByRole('textbox',{name:'Tìm kiếm',exact:true})).toBeVisible();
 await expect(page.getByText('Tổng số gói',{exact:true})).toHaveCount(0);await expect(page.getByText('Số buổi còn lại',{exact:true})).toHaveCount(0);await expect(page.getByText('Còn 8/10 buổi',{exact:true})).toBeVisible();
 const from=await page.getByRole('textbox',{name:'Từ ngày',exact:true}).boundingBox(),to=await page.getByRole('textbox',{name:'Đến ngày',exact:true}).boundingBox();
 expect(Math.abs(from.y-to.y)).toBeLessThan(2);expect(to.x).toBeGreaterThan(from.x);expect(from.height).toBeGreaterThanOrEqual(40);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
