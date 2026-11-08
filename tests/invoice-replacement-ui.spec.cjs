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
 await expect(dialog.getByLabel('Nội dung',{exact:true})).toHaveValue('Gói minh họa');
 await expect(dialog.getByRole('textbox',{name:'Nội dung hóa đơn'})).toHaveCount(0);
 await dialog.getByLabel('Ngày hóa đơn',{exact:true}).fill('2026-11-01');await dialog.getByLabel('Tổng tiền sau sửa (VNĐ)',{exact:true}).fill('1600000');await dialog.getByLabel('Lý do',{exact:true}).fill('Sửa sai ngày và tổng tiền');
 await dialog.getByRole('button',{name:'Xem trước thay đổi',exact:true}).click();const preview=dialog.getByRole('region',{name:'Đối chiếu điều chỉnh hóa đơn'});
 await expect(preview).toContainText('1/11/2026');await expect(dialog.getByLabel('Nội dung',{exact:true})).toHaveValue('Gói minh họa');await expect(preview).toContainText('1.600.000 đ');
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

test('treatment edit uses the sale package catalog and derives the chosen name and rights',async({page},testInfo)=>{
 await page.goto('/?treatment-edit=1');
 const dialog=page.getByRole('dialog',{name:'Sửa gói của khách'}),select=dialog.getByRole('combobox',{name:'Gói dịch vụ',exact:true});
 const options=await select.locator('option').evaluateAll(options=>options.map(option=>option.value).filter(Boolean));
 expect(options).toEqual(await page.locator('select[name="templateId"] option').evaluateAll(options=>options.map(option=>option.value).filter(Boolean)));
 expect(options).toEqual(['a'.repeat(24),'c'.repeat(24),'f'.repeat(24)]);
 await expect(select).not.toContainText('Gói dịch vụ lẻ');await expect(select).not.toContainText('Gói mỹ phẩm');await expect(select).not.toContainText('Ngừng bán');
 await expect(dialog.getByRole('textbox',{name:'Tên gói',exact:true})).toHaveCount(0);
 await expect(dialog).not.toContainText('Việc sửa áp dụng cho quyền lợi chưa dùng');await expect(dialog).not.toContainText('từ lúc chuyển sổ');
 await select.selectOption('c'.repeat(24));
 await expect(dialog.getByLabel('Gói đang sửa')).toHaveText('Chăm sóc mở rộng · 10 buổi');
 await expect(dialog.getByRole('heading')).toHaveText('Sửa gói');await expect(dialog.getByLabel('Tổng số buổi',{exact:true})).toHaveValue('10');
 await dialog.getByRole('button',{name:'Xem trước thay đổi',exact:true}).click();
 const review=dialog.getByRole('region',{name:'Đối chiếu sửa gói'});
 await expect(review.locator('tr').filter({has:page.locator('th').filter({hasText:'Tên gói'})}).locator('td').last()).toHaveText('Chăm sóc mở rộng');
 await expect(review).toContainText('7');
 await review.getByLabel('Lý do sửa').fill('Đối chiếu lại gói đã chọn');
 await page.screenshot({path:`outputs/treatment-package-edit-${testInfo.project.name}.png`,fullPage:true});
 await dialog.getByRole('button',{name:'Xác nhận lưu gói',exact:true}).click();await expect(page.getByText('Đã lưu gói fixture',{exact:true})).toBeVisible();
 const calls=await page.evaluate(()=>window.__replacementCalls);expect(calls).toHaveLength(1);expect(calls[0].action).toBe('updateCustomerTreatment');
 expect(calls[0].data).toMatchObject({templateId:'c'.repeat(24),name:'Chăm sóc mở rộng',serviceId:'b'.repeat(24),totalSessions:10,expectedUseCount:3});
 expect(calls[0].data).not.toHaveProperty('invoiceId');expect(calls[0].data).not.toHaveProperty('paid');
});

test('treatment edit blocks a new package below used rights and retains the existing quota safeguard',async({page})=>{
 await page.goto('/?treatment-edit=1');const dialog=page.getByRole('dialog',{name:'Sửa gói của khách'});
 await dialog.getByRole('combobox',{name:'Gói dịch vụ',exact:true}).selectOption('f'.repeat(24));
 await expect(dialog.getByRole('alert')).toHaveText('Gói được chọn không đủ quyền lợi cho 3 buổi đã dùng.');
 await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Xem trước thay đổi',exact:true}).click();
 await expect(dialog.getByRole('region',{name:'Đối chiếu sửa gói'})).toHaveCount(0);expect(await page.evaluate(()=>window.__replacementCalls)).toEqual([]);
 await dialog.getByRole('combobox',{name:'Gói dịch vụ',exact:true}).selectOption('a'.repeat(24));
 await dialog.getByLabel('Tổng số buổi',{exact:true}).fill('2');await expect(dialog.getByRole('checkbox')).toBeVisible();
 await expect(dialog.getByRole('checkbox')).not.toBeChecked();
 await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Xem trước thay đổi',exact:true}).click();
 await expect(dialog.getByRole('region',{name:'Đối chiếu sửa gói'})).toBeVisible();expect(await page.evaluate(()=>window.__replacementCalls)).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

for(const mode of ['cashier','modal'])for(const receipt of ['yesterday','today','unpaid','split'])test(`creation receipt dates: ${mode}, ${receipt}`,async({page},testInfo)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?creation='+mode);
 if(mode==='cashier')await page.getByRole('button',{name:/^Sản phẩm hồi tố/}).click();
 else await page.getByRole('combobox',{name:'Dịch vụ',exact:true}).selectOption('b'.repeat(24));
 const issued=page.getByLabel(/^Ngày hóa đơn/);await issued.fill('2026-11-07');
 const fields=page.getByRole('group',{name:'Thu tiền khi lập hóa đơn',exact:true});
 await expect(fields.getByLabel(/^Ngày thực nhận/)).toHaveCount(0);
 if(receipt!=='unpaid'){
  await fields.getByLabel('Tiền mặt',{exact:true}).fill(receipt==='split'?'100000':'300000');
  const cashDay=fields.getByLabel('Ngày thực nhận · Tiền mặt',{exact:true});await expect(cashDay).toHaveValue('2026-11-07');
  await issued.fill('2026-11-06');await expect(cashDay).toHaveValue('2026-11-06');await issued.fill('2026-11-07');
  if(receipt==='today'){await cashDay.fill('2026-11-08');await issued.fill('2026-11-06');await expect(cashDay).toHaveValue('2026-11-08');await issued.fill('2026-11-07');}
  if(receipt==='split'){
   await fields.getByLabel('Chuyển khoản',{exact:true}).fill('200000');
   await fields.getByLabel('Ngày thực nhận · Chuyển khoản',{exact:true}).fill('2026-11-08');
   await fields.getByRole('checkbox',{name:'Đã thực nhận chuyển khoản',exact:true}).check();
  }
  await fields.getByRole('checkbox',{name:'Đã thực nhận tiền mặt',exact:true}).check();
 }
 if(receipt==='split'){await fields.scrollIntoViewIfNeeded();await page.screenshot({path:`outputs/invoice-creation-days-${mode}-${testInfo.project.name}.png`,fullPage:true});}
 await page.getByRole('button',{name:mode==='cashier'?'Lưu toàn bộ giỏ':'Lưu thông tin',exact:true}).click();
 await expect(page.getByText('Đã lưu hóa đơn fixture',{exact:true})).toBeVisible();
 const calls=await page.evaluate(()=>window.__replacementCalls);expect(calls).toHaveLength(1);expect(calls[0].data.issuedOn).toBe('2026-11-07');
 if(receipt==='unpaid')expect(calls[0].data).not.toHaveProperty('payments');
 else expect(calls[0].data.payments).toEqual(receipt==='split'?[{method:'CASH',amount:100000,receivedOn:'2026-11-07',receivedConfirmation:true},{method:'BANK_TRANSFER',amount:200000,receivedOn:'2026-11-08',receivedConfirmation:true}]:[{method:'CASH',amount:300000,receivedOn:receipt==='today'?'2026-11-08':'2026-11-07',receivedConfirmation:true}]);
 expect(errors).toEqual([]);
});
test('invoice content edit prefills all fields, replaces rows and previews exact content without payment',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?content-edit=1&mode=CORRECT');const dialog=page.getByRole('dialog',{name:'Sửa hóa đơn',exact:true});
 await expect(dialog.getByLabel('Tìm tên khách hàng',{exact:true})).toHaveCount(0);
 await expect(dialog.getByLabel('Nội dung',{exact:true})).toHaveValue('Hóa đơn đang sửa');
 await expect(dialog.getByLabel('Ngày hóa đơn',{exact:true})).toHaveValue('2026-11-02');
 await expect(dialog.getByLabel('Hạn thanh toán',{exact:true})).toHaveValue('2026-11-10');
 await expect(dialog.getByLabel('Người tư vấn khách hàng',{exact:true})).toHaveValue('c'.repeat(24));
 await expect(dialog.getByLabel('Đợt khuyến mãi',{exact:true})).toHaveValue('Ưu đãi cũ');
 const original=dialog.getByRole('group',{name:'Dịch vụ 1',exact:true});await expect(original.getByLabel('Kỹ thuật viên',{exact:true})).toHaveValue('b'.repeat(24));
 await expect(original.getByLabel('Giá dịch vụ (VNĐ)',{exact:true})).toHaveValue('300000');
 const product=dialog.getByRole('group',{name:'Sản phẩm 1',exact:true});await expect(product.getByLabel('Số lượng',{exact:true})).toHaveValue('3');
 await expect(product.getByLabel('Đơn giá (VNĐ)',{exact:true})).toHaveValue('50000');
 await dialog.getByLabel('Nội dung',{exact:true}).fill('Nội dung đã đối chiếu');await original.getByRole('button',{name:'Bỏ dòng',exact:true}).click();
 await dialog.getByRole('button',{name:'+ Dịch vụ',exact:true}).click();const replacement=dialog.getByRole('group',{name:'Dịch vụ 1',exact:true});
 await replacement.getByRole('combobox',{name:'Dịch vụ',exact:true}).selectOption('d'.repeat(24));await replacement.getByLabel('Kỹ thuật viên',{exact:true}).selectOption('c'.repeat(24));
 await product.getByLabel('Số lượng',{exact:true}).fill('2');await expect(dialog.getByLabel('Tổng tiền sau sửa (VNĐ)',{exact:true})).toHaveValue('200000');
 await dialog.getByLabel('Lý do',{exact:true}).fill('Sửa dòng nhập nhầm');await dialog.getByRole('button',{name:'Xem trước thay đổi',exact:true}).click();
 const comparison=dialog.getByLabel('Nội dung trước và sau',{exact:true});await expect(comparison.locator('section').first()).toContainText('Chăm sóc da');await expect(comparison.locator('section').last()).toContainText('Gội đầu');await expect(comparison.locator('section').last()).not.toContainText('Chăm sóc da');
 await expect(comparison.locator('section').last()).toContainText('2 × 50.000');await expect(comparison.locator('section').last()).toContainText('Nội dung đã đối chiếu');
 await comparison.scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`outputs/invoice-content-${testInfo.project.name}.png`,fullPage:true});
 await dialog.getByRole('button',{name:'Xác nhận lưu hóa đơn',exact:true}).click();await expect(page.getByText('Đã lưu điều chỉnh fixture',{exact:true})).toBeVisible();
 const calls=await page.evaluate(()=>window.__replacementCalls);expect(calls.map(c=>c.action)).toEqual(['previewInvoiceAdjustment','applyInvoiceAdjustment']);
 expect(calls[1].data.content).toMatchObject({description:'Nội dung đã đối chiếu',serviceItems:[{serviceId:'d'.repeat(24),performerId:'c'.repeat(24),total:100000}],productItems:[{quantity:2,unitPrice:50000}]});
 expect(calls[1].data.content).not.toHaveProperty('customerId');expect(calls[1].data).not.toHaveProperty('receiptCorrections');expect(calls[1].data).not.toHaveProperty('paid');expect(errors).toEqual([]);
});

test('invoice content edit no-op sends an empty patch and keeps used-service controls locked',async({page})=>{
 await page.goto('/?content-edit=1&mode=CORRECT');const dialog=page.getByRole('dialog',{name:'Sửa hóa đơn',exact:true});
 await dialog.getByLabel('Lý do',{exact:true}).fill('Kiểm tra không đổi');await dialog.getByRole('button',{name:'Xem trước thay đổi',exact:true}).click();await expect(dialog.getByRole('status')).toHaveText('Không có thay đổi.');
 expect((await page.evaluate(()=>window.__replacementCalls))[0].data.content).toEqual({});
 await page.goto('/?content-edit=1&mode=CORRECT&scenario=used');const used=page.getByRole('group',{name:'Dịch vụ 1',exact:true});
 await expect(used.locator('input, select, textarea, button')).toHaveCount(0);await expect(used).toContainText('Chỉ xem');await expect(used).toContainText('Chăm sóc da');await expect(used).toContainText('300.000');
});
test('completed service correction edits only service and technician while preserving the charge',async({page})=>{
 await page.goto('/?content-edit=1&mode=CORRECT&scenario=correction');
 const dialog=page.getByRole('dialog',{name:'Sửa hóa đơn',exact:true}),row=dialog.getByRole('group',{name:'Dịch vụ 1',exact:true});
 await expect(row.getByRole('button',{name:'Bỏ dòng',exact:true})).toHaveCount(0);
 await expect(dialog.getByRole('button',{name:'+ Dịch vụ',exact:true})).toHaveCount(0);
 await expect(row.getByLabel('Giá dịch vụ (VNĐ)',{exact:true})).toBeDisabled();
 await expect(dialog.getByLabel('Ngày hóa đơn',{exact:true})).toHaveCount(0);
 await expect(dialog.getByLabel('Tổng tiền sau sửa (VNĐ)',{exact:true})).toHaveCount(0);
 await expect(dialog.getByLabel('Số tiền đã thanh toán (VNĐ)',{exact:true})).toHaveCount(0);
 await row.getByRole('combobox',{name:'Dịch vụ',exact:true}).selectOption('d'.repeat(24));
 await row.getByLabel('Kỹ thuật viên',{exact:true}).selectOption('c'.repeat(24));
 await expect(row.getByLabel('Giá dịch vụ (VNĐ)',{exact:true})).toHaveValue('300000');
 await dialog.getByLabel('Lý do',{exact:true}).fill('Sửa đúng dịch vụ và KTV đã thực hiện');
 await dialog.getByRole('button',{name:'Xem trước đính chính',exact:true}).click();
 const comparison=dialog.getByLabel('Nội dung trước và sau',{exact:true});
 await expect(comparison.locator('section').first()).toContainText('Chăm sóc da');
 await expect(comparison.locator('section').last()).toContainText('Gội đầu');
 await expect(comparison.locator('section').last()).toContainText('KTV #cccc');
 await expect(dialog.getByLabel('Đối chiếu khoản thu thực tế',{exact:true})).toContainText('Khoản thu giữ nguyên');
 const calls=await page.evaluate(()=>window.__replacementCalls);expect(calls).toHaveLength(1);
 expect(calls[0].data.total).toBe(300000);expect(calls[0].data.content.serviceItems[0]).toMatchObject({serviceId:'d'.repeat(24),performerId:'c'.repeat(24),total:300000});
});
test('package session correction locks service and keeps its signature history while changing only the technician',async({page})=>{
 await page.goto('/?content-edit=1&mode=CORRECT&scenario=session-correction');
 const dialog=page.getByRole('dialog',{name:'Sửa hóa đơn',exact:true}),row=dialog.getByRole('group',{name:'Dịch vụ 1',exact:true});
 await expect(row.getByLabel('Dịch vụ',{exact:true})).toBeDisabled();
 await expect(row.getByLabel('Giá dịch vụ (VNĐ)',{exact:true})).toBeDisabled();
 await expect(row.getByLabel('Kỹ thuật viên',{exact:true})).toBeEnabled();
 await expect(row.getByRole('button',{name:'Bỏ dòng',exact:true})).toHaveCount(0);
 await expect(dialog.getByRole('region',{name:'Buổi đã xác nhận',exact:true})).toBeVisible();
 await expect(dialog).not.toContainText('Chỉ đính chính');
 await expect(dialog).not.toContainText('Chữ ký và xác nhận buổi giữ nguyên.');
 await row.getByLabel('Kỹ thuật viên',{exact:true}).selectOption('c'.repeat(24));
 await dialog.getByLabel('Lý do',{exact:true}).fill('Đính chính KTV trên buổi gói');
 await dialog.getByRole('button',{name:'Xem trước đính chính',exact:true}).click();
 const comparison=dialog.getByLabel('Nội dung trước và sau',{exact:true});
 await expect(comparison.locator('section').first()).toContainText('KTV #bbbb');
 await expect(comparison.locator('section').last()).toContainText('KTV #cccc');
 const calls=await page.evaluate(()=>window.__replacementCalls);expect(calls).toHaveLength(1);
 expect(calls[0].data.total).toBe(0);
 expect(calls[0].data.content.serviceItems[0]).toMatchObject({serviceId:'b'.repeat(24),performerId:'c'.repeat(24),total:0});
 expect(calls[0].data).not.toHaveProperty('paid');expect(calls[0].data).not.toHaveProperty('receiptCorrections');
});
test('invoice content edit prefills package rights and advisors from valid sale templates',async({page})=>{
 await page.goto('/?content-edit=1&mode=CORRECT&case=content-package');const dialog=page.getByRole('dialog',{name:'Sửa hóa đơn',exact:true}),group=dialog.getByRole('group',{name:'Gói 1',exact:true});
 const select=group.getByRole('combobox',{name:'Gói dịch vụ',exact:true});await expect(select).toHaveValue('e'.repeat(24));await expect(group.getByLabel('Tổng số buổi',{exact:true})).toHaveValue('5');await expect(group.getByLabel('Khuyến mãi gói',{exact:true})).toHaveValue('Ưu đãi gói');
 expect(await select.locator('option').evaluateAll(options=>options.map(o=>o.value).filter(Boolean))).toEqual(['e'.repeat(24),'f'.repeat(24)]);
 await expect(dialog.locator('select[name="saleParticipant.0"]')).toHaveValue('b'.repeat(24));
 await select.selectOption('f'.repeat(24));
 await expect(group).toContainText('Chăm sóc 10 buổi');await expect(group).not.toContainText('1. Chăm sóc 5 buổi');await expect(group.getByLabel('Tổng số buổi',{exact:true})).toHaveValue('10');
 await dialog.locator('select[name="saleParticipant.0"]').selectOption('c'.repeat(24));await dialog.getByLabel('Lý do',{exact:true}).fill('Đối chiếu mẫu gói và người tư vấn');await dialog.getByRole('button',{name:'Xem trước thay đổi',exact:true}).click();
 const calls=await page.evaluate(()=>window.__replacementCalls);expect(calls[0].data.content).toMatchObject({participantIds:['c'.repeat(24)],packageItems:[{templateId:'f'.repeat(24),totalSessions:10,total:1500000,promotion:'Ưu đãi gói'}]});
 await expect(dialog.getByLabel('Nội dung trước và sau').locator('section').last()).toContainText('Chăm sóc 10 buổi');
});
test('void receipt mistakes are explicitly selected and confirmed together with invoice cancellation',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/?adjust=1&case=void-wrong');
 const dialog=page.getByRole('dialog',{name:'Vô hiệu hóa hóa đơn',exact:true}),choices=dialog.getByRole('region',{name:'Khoản thu nhập nhầm cần đảo'});
 await expect(choices).not.toContainText('Chỉ chọn khoản không nhận tiền thật.');
 await expect(dialog).toContainText('Đã thanh toán:');await expect(dialog).toContainText('Còn nợ:');
 await page.screenshot({path:`outputs/invoice-void-compact-${testInfo.project.name}.png`,fullPage:true});
 await expect(choices.getByRole('checkbox')).toHaveCount(2);await expect(choices.getByRole('checkbox').first()).not.toBeChecked();await expect(choices.getByRole('checkbox').last()).not.toBeChecked();
 await choices.getByRole('checkbox').first().check();await expect(choices).toContainText('100.000');await dialog.getByLabel('Lý do',{exact:true}).fill('Nhập nhầm khoản tiền mặt; chuyển khoản là tiền thật');
 await dialog.getByRole('button',{name:'Xem trước hủy và đảo khoản thu',exact:true}).click();const confirmation=dialog.getByRole('region',{name:'Xác nhận đảo khoản thu nhập nhầm'});
 await expect(confirmation).toContainText('100.000');await expect(confirmation).toContainText('không phải tiền đã nhận thật');await expect(dialog).toContainText('Tiền chờ xử lý:');await expect(dialog).toContainText('200.000');
 await confirmation.scrollIntoViewIfNeeded();await page.screenshot({path:`outputs/invoice-void-mistaken-${testInfo.project.name}.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await dialog.getByRole('button',{name:/^Hủy và đảo 100.000/}).click();await expect(page.getByText('Đã lưu điều chỉnh fixture',{exact:true})).toBeVisible();
 const calls=await page.evaluate(()=>window.__replacementCalls);expect(calls.map(c=>c.action)).toEqual(['previewInvoiceAdjustment','applyInvoiceAdjustment']);expect(calls[1].data).toMatchObject({mode:'VOID',total:0,mistakenPaymentIds:['b'.repeat(24)],mistakenReceiptsConfirmed:true,confirmed:true});expect(calls[1].data).not.toHaveProperty('paid');expect(errors).toEqual([]);
});

test('void retains real receipts when none are classified as mistakes',async({page})=>{
 await page.goto('/?adjust=1&case=void-real');const dialog=page.getByRole('dialog',{name:'Vô hiệu hóa hóa đơn',exact:true});await dialog.getByLabel('Lý do',{exact:true}).fill('Hủy nghĩa vụ, khách đã chuyển tiền thật');await dialog.getByRole('button',{name:'Vô hiệu hóa hóa đơn',exact:true}).click();
 await expect(dialog.getByRole('region',{name:'Xác nhận đảo khoản thu nhập nhầm'})).toHaveCount(0);await expect(dialog).toContainText('300.000');await expect(dialog).toContainText('Chưa hoàn.');await dialog.getByRole('button',{name:'Vô hiệu hóa hóa đơn',exact:true}).click();
 const calls=await page.evaluate(()=>window.__replacementCalls);expect(calls[1].data).not.toHaveProperty('mistakenPaymentIds');expect(calls[1].data).not.toHaveProperty('mistakenReceiptsConfirmed');
});

test('cancelled invoice resolves remaining receipt mistakes directly from its detail without reopening',async({page})=>{
 await page.goto('/?detail=1&case=void-cancelled');const detail=page.getByRole('dialog',{name:'Chi tiết hóa đơn',exact:true});await expect(detail).toContainText('Đã hủy');
 await detail.getByRole('button',{name:'Đảo khoản thu nhập nhầm',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Xử lý khoản thu nhập nhầm',exact:true});await expect(dialog).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Vô hiệu hóa hóa đơn',exact:true})).toBeDisabled();await dialog.getByRole('checkbox').first().check();await dialog.getByRole('checkbox').last().check();await dialog.getByLabel('Lý do',{exact:true}).fill('Hoàn tất đảo các phiếu nhập nhầm của hóa đơn đã hủy');
 await dialog.getByRole('button',{name:'Xem trước hủy và đảo khoản thu',exact:true}).click();await dialog.getByRole('button',{name:/^Đảo 300.000/}).click();await expect(dialog).toHaveCount(0);await expect(detail.getByRole('button',{name:'Đảo khoản thu nhập nhầm',exact:true})).toHaveCount(0);await expect(detail).toContainText('Đã hủy');
 const calls=await page.evaluate(()=>window.__replacementCalls);expect(calls.map(c=>c.action)).toEqual(['previewInvoiceAdjustment','applyInvoiceAdjustment']);expect(calls[1].data.mistakenPaymentIds).toEqual(['b'.repeat(24),'c'.repeat(24)]);expect(calls[1].data).not.toHaveProperty('stockHandling');expect(calls[1].data).not.toHaveProperty('entitlementHandling');
 await page.goto('/?detail=1&case=void-cancelled&scenario=staff');await expect(page.getByRole('button',{name:'Đảo khoản thu nhập nhầm',exact:true})).toHaveCount(0);
});
test('void retry after a lost response reuses the reviewed request and idempotency key',async({page})=>{
 await page.goto('/?adjust=1&case=void-wrong&scenario=retry');const dialog=page.getByRole('dialog',{name:'Vô hiệu hóa hóa đơn',exact:true});await dialog.getByRole('checkbox').first().check();await dialog.getByLabel('Lý do',{exact:true}).fill('Nhập nhầm tiền mặt');await dialog.getByRole('button',{name:'Xem trước hủy và đảo khoản thu',exact:true}).click();
 await dialog.getByRole('button',{name:/^Hủy và đảo 100.000/}).click();await expect(dialog.getByRole('alert')).toHaveText('Mất kết nối sau khi lưu fixture');await expect(dialog.getByRole('region',{name:'Xác nhận đảo khoản thu nhập nhầm'})).toBeVisible();await dialog.getByRole('button',{name:/^Hủy và đảo 100.000/}).click();await expect(page.getByText('Đã lưu điều chỉnh fixture',{exact:true})).toBeVisible();
 const calls=await page.evaluate(()=>window.__replacementCalls);expect(calls.map(c=>c.action)).toEqual(['previewInvoiceAdjustment','applyInvoiceAdjustment','applyInvoiceAdjustment']);expect(calls[1].key).toBe(calls[2].key);expect(calls[1].data).toEqual(calls[2].data);
});
for(const [kind,present]of [
 ['content-service',['Dịch vụ']],['content-product',['Sản phẩm']],['content-package',['Gói dịch vụ']],
 ['mixed',['Dịch vụ','Sản phẩm']],['content-all',['Dịch vụ','Sản phẩm','Gói dịch vụ']],
])test(`compact invoice edit displays only original content: ${kind}`,async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/?content-edit=1&mode=CORRECT&case='+kind);
 const dialog=page.getByRole('dialog',{name:'Sửa hóa đơn',exact:true}),fields=dialog.getByRole('region',{name:'Nội dung hóa đơn sau sửa',exact:true});
 await expect(fields.getByRole('heading',{name:/Khách hàng/})).toHaveCount(0);await expect(dialog.getByRole('searchbox')).toHaveCount(0);await expect(dialog.locator('[name="customerId"]')).toHaveCount(0);
 for(const [label,add]of [['Dịch vụ','+ Dịch vụ'],['Sản phẩm','+ Sản phẩm'],['Gói dịch vụ','+ Gói']]){
  await expect(fields.getByRole('region',{name:label,exact:true})).toHaveCount(present.includes(label)?1:0);
  await expect(fields.getByRole('heading',{name:label,exact:true})).toHaveCount(present.includes(label)?1:0);
  await expect(fields.getByRole('button',{name:add,exact:true})).toHaveCount(present.includes(label)?1:0);
 }
 if(present.includes('Dịch vụ'))await expect(fields.getByRole('group',{name:'Dịch vụ 1',exact:true}).getByLabel('Giá dịch vụ (VNĐ)',{exact:true})).toHaveValue('300000');
 if(present.includes('Sản phẩm'))await expect(fields.getByRole('group',{name:'Sản phẩm 1',exact:true}).getByLabel('Số lượng',{exact:true})).toHaveValue('3');
 if(present.includes('Gói dịch vụ'))await expect(fields.getByRole('group',{name:'Gói 1',exact:true}).getByLabel('Tổng số buổi',{exact:true})).toHaveValue('5');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`outputs/invoice-kind-${kind}-${testInfo.project.name}.png`,fullPage:true});
 await dialog.getByLabel('Lý do',{exact:true}).fill('Kiểm tra đúng loại nội dung, giữ nguyên khách');await dialog.getByRole('button',{name:'Xem trước thay đổi',exact:true}).click();
 const calls=await page.evaluate(()=>window.__replacementCalls);expect(calls).toHaveLength(1);expect(calls[0].data).not.toHaveProperty('customerId');expect(calls[0].data.content).toEqual({});
 if(!present.includes('Gói dịch vụ'))await expect(dialog.getByLabel('Nội dung trước và sau')).not.toContainText('Người tư vấn gói');
 expect(errors).toEqual([]);
});

test('compact invoice edit retains its original section after removing the last line for replacement',async({page})=>{
 await page.goto('/?content-edit=1&mode=CORRECT&case=content-service');const dialog=page.getByRole('dialog',{name:'Sửa hóa đơn',exact:true});
 await dialog.getByRole('button',{name:'Bỏ dòng',exact:true}).click();await expect(dialog.getByRole('group',{name:'Dịch vụ 1',exact:true})).toHaveCount(0);await expect(dialog.getByRole('button',{name:'+ Dịch vụ',exact:true})).toBeVisible();
 await expect(dialog.getByRole('region',{name:'Sản phẩm',exact:true})).toHaveCount(0);await expect(dialog.getByRole('region',{name:'Gói dịch vụ',exact:true})).toHaveCount(0);
 await dialog.getByRole('button',{name:'+ Dịch vụ',exact:true}).click();await dialog.getByRole('combobox',{name:'Dịch vụ',exact:true}).selectOption('d'.repeat(24));await dialog.getByLabel('Lý do',{exact:true}).fill('Thay dòng cùng loại');await dialog.getByRole('button',{name:'Xem trước thay đổi',exact:true}).click();
 const data=(await page.evaluate(()=>window.__replacementCalls))[0].data;expect(Object.keys(data.content)).toEqual(['serviceItems']);expect(data.content.serviceItems[0].serviceId).toBe('d'.repeat(24));expect(data.content).not.toHaveProperty('customerId');
});

test('compact invoice edit shows used packages as short read-only rows',async({page})=>{
 await page.goto('/?content-edit=1&mode=CORRECT&case=content-package&scenario=used');const dialog=page.getByRole('dialog',{name:'Sửa hóa đơn',exact:true}),row=dialog.getByRole('group',{name:'Gói 1',exact:true});
 await expect(row).toContainText('Chăm sóc 5 buổi');await expect(row).toContainText('5 buổi');await expect(row).toContainText('Đã dùng buổi · Chỉ xem.');await expect(row.locator('input, select, textarea, button')).toHaveCount(0);
 await expect(dialog.getByRole('button',{name:'+ Gói',exact:true})).toHaveCount(0);await expect(dialog.locator('select[name="saleParticipant.0"]')).toHaveCount(0);await expect(dialog.getByRole('region',{name:'Dịch vụ',exact:true})).toHaveCount(0);await expect(dialog.getByRole('region',{name:'Sản phẩm',exact:true})).toHaveCount(0);
 await dialog.getByLabel('Lý do',{exact:true}).fill('Xem lại giữ nguyên lịch sử');await dialog.getByRole('button',{name:'Xem trước thay đổi',exact:true}).click();expect((await page.evaluate(()=>window.__replacementCalls))[0].data.content).toEqual({});
});
