const {test,expect}=require('@playwright/test');

for(const scenario of ['unpaid','paid','cancelled','busy','staff'])test(`list actions stay compact and preserve availability (${scenario})`,async({page},testInfo)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/?list=1&scenario='+scenario);
 await expect(page.locator('.row-action-menu')).toHaveCount(0);
 const edit=page.getByRole('button',{name:'Sửa hóa đơn',exact:true}),voidButton=page.getByRole('button',{name:'Vô hiệu hóa hóa đơn',exact:true});
 if(scenario==='staff'){await expect(edit).toHaveCount(0);await expect(voidButton).toHaveCount(0);return;}
 await expect(edit).toHaveAttribute('title','Sửa hóa đơn');await expect(voidButton).toHaveAttribute('title','Vô hiệu hóa hóa đơn');
 if(['busy','cancelled'].includes(scenario)){await expect(edit).toBeDisabled();await expect(voidButton).toBeDisabled();}
 else{await expect(edit).toBeEnabled();await expect(voidButton).toBeEnabled();await edit.click();await voidButton.click();}
 if(scenario==='unpaid'){await page.getByRole('button',{name:'Thanh toán',exact:true}).click();}
 else await expect(page.getByRole('button',{name:'Thanh toán',exact:true})).toHaveCount(0);
 const calls=await page.evaluate(()=>window.__replacementCalls);expect(calls.every(call=>call.opened)).toBe(true);
 expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`outputs/invoice-list-actions-${scenario}-${testInfo.project.name}.png`,fullPage:true});
});

for(const display of ['signed','unsigned','empty','sessions'])test(`invoice keeps all service lines and shows only actual signatures (${display})`,async({page},testInfo)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.goto('/?detail=1&display='+display);
 const dialog=page.getByRole('dialog',{name:'Chi tiết hóa đơn'}),summary=dialog.getByRole('region',{name:'Nội dung hóa đơn'}),signatures=dialog.getByRole('region',{name:'Chữ ký hóa đơn'});
 await expect(summary).toContainText('HD000001');await expect(summary).toContainText('Khách fixture');await expect(summary).toContainText('0900000000');
 const lines=summary.locator('.invoice-service-lines p');await expect(lines).toHaveCount(2);
 await expect(lines.nth(0)).toContainText('Chăm sóc da');await expect(lines.nth(1)).toContainText('Gội đầu dưỡng sinh');
 if(display!=='sessions'){
  await expect(lines.nth(0).locator('strong')).toContainText('100.000');await expect(lines.nth(1).locator('strong')).toContainText('150.000');
  const totals=summary.locator('.invoice-detail-money > span');await expect(totals.nth(0)).toContainText('250.000');await expect(totals.nth(1)).toContainText('150.000');await expect(totals.nth(2)).toContainText('100.000');
 }else{await expect(lines.nth(0)).toContainText('Buổi 1');await expect(lines.nth(1)).toContainText('Buổi 1');}
 await expect(dialog.getByText('Người thực hiện:',{exact:false})).toHaveCount(0);
 await expect(lines.nth(0).locator('small')).toHaveText('Kỹ thuật viên: Thư fixture');
 await expect(lines.nth(1).locator('small')).toHaveText('Kỹ thuật viên: Quỳnh fixture');
 await expect(dialog.getByText('Người tạo:',{exact:false})).toContainText('Thu ngân fixture');
 await expect(signatures).not.toContainText(/Buổi|Tên gói|Gói thứ hai|2026|Chăm sóc da|Gội đầu/);
 if(display==='signed'){
  await expect(signatures.getByRole('img',{name:'Chữ ký xác nhận của khách'})).toHaveCount(1);
  expect(await signatures.locator('polyline').getAttribute('points')).toBe('60,66 180,154 480,44');
  await expect(signatures.getByText('Không có chữ ký khách hàng.',{exact:true})).toHaveCount(0);
 }else{
  await expect(signatures.getByRole('img')).toHaveCount(0);await expect(signatures.getByText('Không có chữ ký khách hàng.',{exact:true})).toHaveCount(1);
 }
 expect(await signatures.evaluate(element=>element.parentElement.lastElementChild===element)).toBe(true);
 expect(await summary.evaluate(element=>element.parentElement.children[1]===element)).toBe(true);
 expect(await page.evaluate(()=>window.__replacementCalls)).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
 await page.screenshot({path:`outputs/invoice-layout-${display}-${testInfo.project.name}.png`,fullPage:true});
});

for(const scenario of ['unused','used','pending','paid','closed','staff'])test(`handling menu keeps unified correction and void flows (${scenario})`,async({page},testInfo)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/?detail=1&scenario='+scenario);
 const dialog=page.getByRole('dialog',{name:'Chi tiết hóa đơn'});await dialog.getByText('Xử lý hóa đơn',{exact:true}).click();
 const edit=dialog.getByRole('button',{name:'Sửa hóa đơn',exact:true}),voidButton=dialog.getByRole('button',{name:'Vô hiệu hóa hóa đơn',exact:true});
 await expect(dialog.getByRole('button',{name:'Sửa ngày hóa đơn',exact:true})).toHaveCount(0);
 await expect(dialog.getByRole('button',{name:'Hủy hóa đơn chưa thanh toán',exact:true})).toHaveCount(0);
 await expect(dialog.getByRole('button',{name:'Thay người tư vấn bán gói',exact:true})).toBeVisible();
 if(scenario==='staff'){await expect(edit).toBeDisabled();await expect(voidButton).toBeDisabled();}
 else{await expect(edit).toBeEnabled();await expect(voidButton).toBeEnabled();await edit.click();await voidButton.click();}
 expect((await page.evaluate(()=>window.__replacementCalls)).map(call=>call.opened)).toEqual(scenario==='staff'?[]:['openCorrection','openVoid']);
 expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`outputs/invoice-handling-${scenario}-${testInfo.project.name}.png`,fullPage:true});
});

for(const initial of ['unreplaced','active'])test(`invoice detail has unique sibling keys and resets replacement state (${initial})`,async({page},testInfo)=>{
 const keyWarnings=[],pageErrors=[];
 page.on('console',message=>{if(/same key|unique.*key/i.test(message.text()))keyWarnings.push(message.text());});
 page.on('pageerror',error=>pageErrors.push(error.message));
 await page.goto('/?detail=1'+(initial==='unreplaced'?'&unreplaced=1':''));
 const dialog=page.getByRole('dialog',{name:'Chi tiết hóa đơn'});
 await dialog.getByText('Xử lý hóa đơn',{exact:true}).click();
 await expect(dialog.getByRole('button',{name:'Tải PDF',exact:true})).toHaveCount(1);
 const toggle=dialog.getByRole('button',{name:'Thay người tư vấn bán gói',exact:true});
 await expect(toggle).toHaveCount(1);await toggle.click();
 await dialog.getByLabel('Người tư vấn cũ').selectOption('b'.repeat(24));
 await dialog.getByLabel('Người tư vấn mới').selectOption('c'.repeat(24));
 await dialog.getByRole('button',{name:'Xem trước thay thế',exact:true}).click();
 await expect(dialog.getByRole('region',{name:'Xem trước thay thế'})).toBeVisible();
 await dialog.getByLabel('Lý do thay thế').fill('Fixture: sửa tư vấn');
 await dialog.getByRole('button',{name:'Xác nhận tạo chứng từ thay thế'}).click();
 await expect(page.locator('#detail-done')).toHaveText('Đã thay thế thành công');
 await expect(dialog.locator('.invoice-code')).toHaveText('HD000002');
 await expect(dialog.getByRole('region',{name:'Xem trước thay thế'})).toHaveCount(0);
 if(!await dialog.locator('.invoice-handling').evaluate(element=>element.open))await dialog.getByText('Xử lý hóa đơn',{exact:true}).click();
 await toggle.click();
 await expect(dialog.getByLabel('Người tư vấn cũ')).toHaveValue('');
 await expect(dialog.getByLabel('Người tư vấn mới')).toHaveValue('');
 await dialog.getByLabel('Người tư vấn cũ').selectOption('c'.repeat(24));
 await dialog.getByLabel('Người tư vấn mới').selectOption('b'.repeat(24));
 await dialog.getByRole('button',{name:'Xem trước thay thế',exact:true}).click();
 await expect(dialog.getByLabel('Lý do thay thế')).toHaveValue('');
 const calls=await page.evaluate(()=>window.__replacementCalls);
 expect(calls.filter(call=>call.action==='replacePackageAdvisor')).toHaveLength(1);
 expect(calls.filter(call=>call.action==='previewPackageAdvisorReplacement').map(call=>call.data.expectedDocumentId)).toEqual(['a'.repeat(24),'c'.repeat(24)]);
 expect(keyWarnings).toEqual([]);expect(pageErrors).toEqual([]);
 await page.screenshot({path:`outputs/invoice-detail-keys-${initial}-${testInfo.project.name}.png`,fullPage:true});
});

test('ledger shows issued invoice codes for PAYMENT and REVERSAL without tagging unrelated rows',async({page},testInfo)=>{
 const warnings=[];page.on('console',message=>{if(message.type()==='error')warnings.push(message.text());});
 await page.goto('/?ledger=1');
 const rows=page.getByRole('row');await expect(rows).toHaveCount(3);
 await expect(rows.nth(0)).toContainText('Hóa đơn: HD000067');
 await expect(rows.nth(1)).toContainText('Hóa đơn: HD000067');
 await expect(rows.nth(0)).toContainText('#aaaaaa');
 await expect(rows.nth(1)).toContainText('Giao dịch gốc: #aaaaaa');
 await expect(rows.nth(2)).not.toContainText('Hóa đơn:');
 expect(warnings).toEqual([]);
 await page.screenshot({path:`outputs/payment-reversal-codes-${testInfo.project.name}.png`,fullPage:true});
});
test('preview, required reason, single confirmation and linked original document',async({page},testInfo)=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Thay thế chứng từ sửa tư vấn bán gói',exact:true}).click();
 await page.getByLabel('Người tư vấn cũ').selectOption('b'.repeat(24));await page.getByLabel('Người tư vấn mới').selectOption('c'.repeat(24));
 await page.getByRole('button',{name:'Xem trước thay thế',exact:true}).click();
 await expect(page.getByRole('region',{name:'Xem trước thay thế'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Xác nhận tạo chứng từ thay thế'})).toBeDisabled();
 await page.getByLabel('Lý do thay thế').fill('Ghi nhầm tư vấn bán gói');
 await page.screenshot({path:`outputs/replacement-${testInfo.project.name}.png`,fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Xác nhận tạo chứng từ thay thế'}).dblclick();
 await expect(page.getByRole('status')).toHaveText('Đã thay thế thành công');
 await page.getByRole('button',{name:'Đọc yêu cầu fixture'}).click();
 const calls=JSON.parse(await page.locator('#calls').textContent());
 expect(calls.filter(c=>c.action==='replacePackageAdvisor')).toHaveLength(1);
 expect(calls.at(-1).data.expectedDocumentId).toBe('a'.repeat(24));
 expect(calls.at(-1).data.reason).toBe('Ghi nhầm tư vấn bán gói');
 await page.getByText('HD000001 · Đã thay thế',{exact:true}).click();await expect(page.getByText(/Chứng từ này chỉ để tra cứu/)).toBeVisible();
});
test('changing selection invalidates preview',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Thay thế chứng từ sửa tư vấn bán gói',exact:true}).click();
 await page.getByLabel('Người tư vấn cũ').selectOption('b'.repeat(24));await page.getByLabel('Người tư vấn mới').selectOption('c'.repeat(24));
 await page.getByRole('button',{name:'Xem trước thay thế',exact:true}).click();await expect(page.getByRole('region',{name:'Xem trước thay thế'})).toBeVisible();
 await page.getByLabel('Người tư vấn mới').selectOption('');await expect(page.getByRole('region',{name:'Xem trước thay thế'})).toHaveCount(0);
});
test('legacy source without code remains readable and links to current document',async({page})=>{
 await page.goto('/?legacy=1');
 const legacyCode='HD'+BigInt('0x'+'a'.repeat(24)).toString();
 const source=page.locator('summary').filter({hasText:legacyCode});
 await expect(source).toHaveText(legacyCode+' · Đã thay thế');await source.click();
 await page.locator('details').getByRole('link',{name:'HD000002',exact:true}).click();
 await expect(page).toHaveURL(/#current-invoice-document$/);
});

for(const scenario of ['simple','stock','packages','gifts','mixed'])test(`adjustment dialog shows only relevant void choices (${scenario})`,async({page},testInfo)=>{
 await page.goto('/?adjust=1&case='+scenario);
 const dialog=page.getByRole('dialog',{name:'Vô hiệu hóa hóa đơn',exact:true});
 await expect(dialog).toContainText('Khách fixture');await expect(dialog).toContainText('Còn nợ');
 const flags={stock:scenario==='stock'||scenario==='mixed',packages:scenario==='packages'||scenario==='mixed',gifts:scenario==='gifts'||scenario==='mixed'};
 for(const [flag,label,value]of [['stock','Hàng đã bán','RETURN'],['packages','Gói đã bán','KEEP'],['gifts','Quà tặng','REVOKE_UNUSED']]){
   const field=dialog.getByRole('combobox',{name:label,exact:true});await expect(field).toHaveCount(flags[flag]?1:0);if(flags[flag])await field.selectOption(value);
 }
 const confirm=dialog.getByRole('button',{name:'Vô hiệu hóa hóa đơn',exact:true});await confirm.click();expect(await page.evaluate(()=>window.__replacementCalls)).toEqual([]);
 await dialog.getByLabel('Lý do',{exact:true}).fill('Chủ spa xác nhận sai chứng từ');
 await page.screenshot({path:`outputs/invoice-void-${scenario}-${testInfo.project.name}.png`,fullPage:true});
 await confirm.click();await expect(dialog.getByRole('region',{name:'Đối chiếu điều chỉnh hóa đơn'})).toBeVisible();
 const calls=await page.evaluate(()=>window.__replacementCalls);expect(calls).toHaveLength(1);expect(calls[0].action).toBe('previewInvoiceAdjustment');
 for(const [flag,key]of [['stock','stockHandling'],['packages','entitlementHandling'],['gifts','giftHandling']])expect(Object.hasOwn(calls[0].data,key)).toBe(flags[flag]);
 await confirm.click();await expect(page.getByText('Đã lưu điều chỉnh fixture',{exact:true})).toBeVisible();
 expect((await page.evaluate(()=>window.__replacementCalls)).map(call=>call.action)).toEqual(['previewInvoiceAdjustment','applyInvoiceAdjustment']);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('adjustment dialog edits date and total only while preserving original content',async({page})=>{
 await page.goto('/?adjust=1&mode=CORRECT');const dialog=page.getByRole('dialog',{name:'Sửa hóa đơn',exact:true});
 await expect(dialog.getByLabel('Nội dung hóa đơn gốc')).toContainText('Gói minh họa');
 await expect(dialog.getByRole('textbox',{name:'Nội dung hóa đơn'})).toHaveCount(0);
 await dialog.getByLabel('Ngày hóa đơn',{exact:true}).fill('2026-11-01');await dialog.getByLabel('Tổng tiền sau sửa (VNĐ)',{exact:true}).fill('1600000');await dialog.getByLabel('Lý do',{exact:true}).fill('Sửa sai ngày và tổng tiền');
 await dialog.getByRole('button',{name:'Xem trước thay đổi',exact:true}).click();const preview=dialog.getByRole('region',{name:'Đối chiếu điều chỉnh hóa đơn'});
 await expect(preview).toContainText('1/11/2026');await expect(dialog.getByLabel('Nội dung hóa đơn gốc')).toContainText('Gói minh họa');await expect(preview).toContainText('1.600.000 đ');
 await dialog.getByRole('button',{name:'Xác nhận lưu hóa đơn',exact:true}).click();await expect(page.getByText('Đã lưu điều chỉnh fixture',{exact:true})).toBeVisible();
 const calls=await page.evaluate(()=>window.__replacementCalls);expect(calls.map(call=>call.action)).toEqual(['previewInvoiceAdjustment','applyInvoiceAdjustment']);
 expect(calls[1].data.issuedOn).toBe('2026-11-01');expect(calls[1].data.total).toBe(1600000);expect(calls[1].data).not.toHaveProperty('description');expect(calls[1].data).not.toHaveProperty('serviceItems');expect(calls[1].data).not.toHaveProperty('performerId');expect(calls[1].data).not.toHaveProperty('adjustPaymentDates');
});

for(const scenario of ['receipt-single','receipt-many'])test(`receipt correction form submits original payment links and actual receipt days (${scenario})`,async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?adjust=1&mode=CORRECT&case='+scenario);
 const dialog=page.getByRole('dialog',{name:'Sửa hóa đơn',exact:true}),paid=dialog.getByLabel('Số tiền đã thanh toán (VNĐ)',{exact:true});
 if(scenario==='receipt-single'){
  await expect(paid).toBeEditable();await paid.fill('300000');
  await dialog.getByLabel('Ngày thực nhận khoản thu 1',{exact:true}).fill('2026-11-06');
 }else{
  await expect(paid).toHaveAttribute('readonly','');
  await dialog.getByLabel('Số tiền khoản thu 1 (VNĐ)',{exact:true}).fill('100000');
  await dialog.getByLabel('Số tiền khoản thu 2 (VNĐ)',{exact:true}).fill('200000');
  await dialog.getByLabel('Ngày thực nhận khoản thu 2',{exact:true}).fill('2026-11-07');
 }
 await expect(paid).toHaveValue('300000');
 await dialog.getByLabel('Lý do',{exact:true}).fill('Đối chiếu lại khoản thu thực tế đã nhập sai');
 await dialog.getByRole('button',{name:'Xem trước thay đổi',exact:true}).click();
 const review=dialog.getByRole('region',{name:'Đối chiếu khoản thu thực tế'});await expect(review).toContainText('Khoản thu điều chỉnh');
 await dialog.getByRole('button',{name:'Xác nhận lưu hóa đơn',exact:true}).click();await expect(page.getByText('Đã lưu điều chỉnh fixture',{exact:true})).toBeVisible();
 const calls=await page.evaluate(()=>window.__replacementCalls);expect(calls.map(call=>call.action)).toEqual(['previewInvoiceAdjustment','applyInvoiceAdjustment']);
 expect(calls[1].data.paid).toBe(300000);expect(calls[1].data.total).toBe(300000);
 expect(calls[1].data.receiptCorrections).toEqual(scenario==='receipt-single'?[{paymentId:'b'.repeat(24),amount:300000,day:'2026-11-06'}]:[{paymentId:'b'.repeat(24),amount:100000,day:'2026-11-07'},{paymentId:'c'.repeat(24),amount:200000,day:'2026-11-07'}]);
 expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('correction modal keeps one initial top-aligned scroll area and fixed title/actions',async({page})=>{
 await page.setViewportSize({width:page.viewportSize().width,height:520});
 await page.goto('/?adjust=1&mode=CORRECT&case=packages');
 const dialog=page.getByRole('dialog',{name:'Sửa hóa đơn',exact:true}),scroller=dialog.getByTestId('invoice-adjustment-scroll');
 const header=dialog.locator('.invoice-adjustment-header'),actions=dialog.locator('.invoice-adjustment-actions');
 await expect(scroller).toBeVisible();await expect(header).toBeVisible();await expect(actions.getByRole('button',{name:'Quay lại',exact:true})).toBeVisible();await expect(actions.getByRole('button',{name:'Xem trước thay đổi',exact:true})).toBeVisible();
 expect(await scroller.evaluate(el=>el.scrollTop)).toBe(0);
 expect(await dialog.evaluate(el=>el.scrollHeight===el.clientHeight)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const initial=await Promise.all([header.boundingBox(),actions.boundingBox()]);
 await scroller.evaluate(el=>el.scrollTop=el.scrollHeight);
 await expect.poll(()=>scroller.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
 const after=await Promise.all([header.boundingBox(),actions.boundingBox()]);
 expect(after[0].y).toBe(initial[0].y);expect(after[1].y).toBe(initial[1].y);
 await expect(actions.getByRole('button',{name:'Quay lại',exact:true})).toBeInViewport();
 await expect(actions.getByRole('button',{name:'Xem trước thay đổi',exact:true})).toBeInViewport();
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
});

test('compact correction groups show only relevant amount warnings',async({page},testInfo)=>{
 await page.goto('/?adjust=1&mode=CORRECT&case=receipt-many');
 const dialog=page.getByRole('dialog',{name:'Sửa hóa đơn',exact:true});
 const first=dialog.getByRole('group',{name:'Khoản thu 1',exact:true}),second=dialog.getByRole('group',{name:'Khoản thu 2',exact:true});
 await expect(first).toContainText('Khoản thu 1 · Tiền mặt · Gốc 30.000 đ · 07/11/2026');
 await expect(second).toContainText('Khoản thu 2 · Chuyển khoản · Gốc 20.000 đ · 06/11/2026');
 for(const text of ['Chỉ sửa tổng hóa đơn không tạo khoản thu','Ngày thu cũ và mới phải có sổ','Không dùng Thanh toán hôm nay','tổng hóa đơn − số tiền đã thanh toán'])await expect(dialog).not.toContainText(text);
 await expect(dialog.getByRole('alert')).toHaveCount(0);
 const amount=second.getByLabel('Số tiền khoản thu 2 (VNĐ)',{exact:true});await amount.fill('-1');
 await expect(second.getByRole('alert')).toHaveText('Số tiền không hợp lệ.');await expect(amount).toHaveAttribute('aria-describedby','receipt-amount-error-1');
 await amount.fill('400000');
 const paid=dialog.getByLabel('Số tiền đã thanh toán (VNĐ)',{exact:true});await expect(paid).toHaveAttribute('aria-describedby','invoice-paid-error');
 await expect(dialog.locator('#invoice-paid-error')).toHaveText('Số đã thanh toán vượt tổng hóa đơn.');
 await amount.fill('20000');await expect(dialog.getByRole('alert')).toHaveCount(0);
 await expect(dialog).toContainText('Còn nợ:');expect(await page.evaluate(()=>window.__replacementCalls)).toEqual([]);
 const columns=await first.locator('.invoice-adjustment-fields').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
 expect(columns).toBe(2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`outputs/invoice-correction-compact-${testInfo.project.name}.png`,fullPage:true});
 if(testInfo.project.name==='mobile'){
  await page.setViewportSize({width:320,height:844});
  expect(await first.locator('.invoice-adjustment-fields').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});

test('compact correction keeps closed-book errors short without changing the form',async({page},testInfo)=>{
 await page.goto('/?adjust=1&mode=CORRECT&case=receipt-single&scenario=closed');
 const dialog=page.getByRole('dialog',{name:'Sửa hóa đơn',exact:true}),paid=dialog.getByLabel('Số tiền đã thanh toán (VNĐ)',{exact:true});
 await paid.fill('300000');await dialog.getByLabel('Lý do',{exact:true}).fill('Đối chiếu khoản thu');
 await dialog.getByRole('button',{name:'Xem trước thay đổi',exact:true}).click();
 await expect(dialog.getByRole('alert')).toHaveText('Không thể chỉnh khoản thu: sổ ngày 07/11/2026 chưa mở hoặc đã chốt.');
 await expect(dialog.getByRole('alert')).toBeInViewport({ratio:1});
 await expect(paid).toHaveValue('300000');await expect(dialog.getByLabel('Ngày thực nhận khoản thu 1',{exact:true})).toHaveValue('2026-11-07');
 expect((await page.evaluate(()=>window.__replacementCalls)).map(call=>call.action)).toEqual(['previewInvoiceAdjustment']);
 await page.screenshot({path:`outputs/invoice-correction-closed-${testInfo.project.name}.png`,fullPage:true});
});
