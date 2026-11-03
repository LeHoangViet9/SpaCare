const {test,expect}=require('@playwright/test');

for(const scenario of ['unpaid','paid','cancelled','busy','staff'])test(`list actions stay compact and preserve availability (${scenario})`,async({page},testInfo)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?list=1&scenario='+scenario);
 const toggle=page.locator('.row-action-menu > summary'),buttons=page.locator('.row-action-options button');
 if(scenario==='staff'){await expect(toggle).toHaveCount(0);await expect(page.getByText('Đã thu đủ',{exact:true})).toBeVisible();return;}
 await expect(toggle).toContainText('Thao tác');await expect(buttons.first()).toBeHidden();
 await toggle.click();expect(await page.evaluate(()=>window.__replacementCalls)).toEqual([]);
 await expect(page.locator('.row-action-options small, .row-action-options p, .row-action-options details')).toHaveCount(0);
 const cancel=page.getByRole('button',{name:'Hủy hóa đơn — giữ lịch sử',exact:true}),voidButton=page.getByRole('button',{name:'Vô hiệu hóa hóa đơn nhập nhầm',exact:true});
 if(scenario==='unpaid'){
  await expect(cancel).toBeEnabled();await expect(page.getByRole('button',{name:'Tiền mặt',exact:true})).toBeVisible();
  const actions=[['Sửa hóa đơn','updateInvoice'],['Hủy hóa đơn — giữ lịch sử','cancelInvoice'],['Vô hiệu hóa hóa đơn nhập nhầm','deleteInvoice'],['Tiền mặt','payment'],['Chuyển khoản / QR','payment']];
  for(const [label,action] of actions){if(!await toggle.evaluate(element=>element.parentElement.open))await toggle.click();await page.getByRole('button',{name:label,exact:true}).click();expect(await toggle.evaluate(element=>element.parentElement.open)).toBe(false);expect((await page.evaluate(()=>window.__replacementCalls)).at(-1).opened).toBe(action);}
  expect((await page.evaluate(()=>window.__replacementCalls)).slice(-2).map(call=>call.method)).toEqual(['CASH','BANK_TRANSFER']);await toggle.click();
 }else if(scenario==='busy'){for(const button of await buttons.all())await expect(button).toBeDisabled();}
 else{await expect(cancel).toBeDisabled();await expect(voidButton).toBeEnabled();if(scenario==='cancelled')await expect(page.getByRole('button',{name:'Sửa hóa đơn',exact:true})).toHaveCount(0);}
 if(scenario!=='unpaid')expect(await page.evaluate(()=>window.__replacementCalls)).toEqual([]);
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
 await expect(dialog.getByText('Người thực hiện:',{exact:false})).toContainText('Kỹ thuật viên fixture');await expect(dialog.getByText('Người tạo:',{exact:false})).toContainText('Thu ngân fixture');
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

for(const scenario of ['unused','used','pending','paid','closed','staff'])test(`handling menu explains restrictions and sends no unexpected writes (${scenario})`,async({page},testInfo)=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/?detail=1&scenario='+scenario);
 const dialog=page.getByRole('dialog',{name:'Chi tiết hóa đơn'});
 await expect(dialog.getByText('Xử lý hóa đơn',{exact:true})).toBeVisible();
 await expect(dialog.getByRole('button',{name:'Sửa hóa đơn',exact:true})).toBeHidden();
 expect(await page.evaluate(()=>window.__replacementCalls)).toEqual([]);
 await dialog.getByText('Xử lý hóa đơn',{exact:true}).click();
 const editing=dialog.getByRole('region',{name:'Chỉnh sửa',exact:true}),correction=dialog.getByRole('region',{name:'Xử lý hóa đơn sai',exact:true});
 await expect(editing.getByRole('button',{name:'Sửa ngày hóa đơn',exact:true})).toBeVisible();await expect(editing.getByRole('button',{name:'Thay người tư vấn bán gói',exact:true})).toBeVisible();
 await expect(correction.getByRole('button',{name:'Vô hiệu hóa hóa đơn nhập nhầm',exact:true})).toBeVisible();await expect(correction.getByRole('button',{name:'Hủy hóa đơn chưa thanh toán',exact:true})).toBeVisible();
 const edit=dialog.getByRole('button',{name:'Sửa hóa đơn',exact:true}),date=dialog.getByRole('button',{name:'Sửa ngày hóa đơn',exact:true}),voidButton=dialog.getByRole('button',{name:'Vô hiệu hóa hóa đơn nhập nhầm',exact:true});
 if(scenario==='unused'){
  await expect(edit).toBeEnabled();await expect(voidButton).toBeEnabled();await edit.click();await voidButton.click();
 }else{
  await expect(edit).toBeDisabled();
  if(scenario==='used'){
   await expect(dialog.getByText('Gói đã có buổi sử dụng; cần giữ nguyên lịch sử thực hiện.',{exact:true})).toHaveCount(1);
   await expect(voidButton).toBeDisabled();
   const shared=dialog.locator('.invoice-handling-shared').filter({hasText:'Gói đã có buổi sử dụng'});
   await expect(shared).toContainText('Áp dụng: Sửa nội dung, Hủy, Vô hiệu hóa.');
   const reasonId=await edit.getAttribute('aria-describedby');
   expect(await voidButton.getAttribute('aria-describedby')).toBe(reasonId);
   expect(await dialog.getByRole('button',{name:'Hủy hóa đơn chưa thanh toán',exact:true}).getAttribute('aria-describedby')).toBe(reasonId);
  }
  if(scenario==='pending'){
   await expect(dialog.getByText('Liệu trình đã có lịch hẹn; cần xử lý liên kết trước.',{exact:true})).toHaveCount(1);
   await expect(dialog.getByText('Gói còn lịch đang đặt hoặc hoãn; cần xử lý lịch trước khi vô hiệu hóa.',{exact:true})).toHaveCount(1);
   await expect(voidButton).toBeDisabled();
   expect(await voidButton.getAttribute('aria-describedby')).not.toBe(await edit.getAttribute('aria-describedby'));
  }
  if(scenario==='paid'){await expect(dialog.getByText(/Hóa đơn đã có thanh toán, cọc\/thẻ/)).toHaveCount(1);await expect(voidButton).toBeEnabled();}
  if(scenario==='closed'){await expect(date).toBeDisabled();await expect(dialog.getByText(/Ngày lập hóa đơn đã chốt sổ/).first()).toBeVisible();}
  if(scenario==='staff')await expect(voidButton).toBeDisabled();
 }
 await expect(dialog.getByText(/Hệ thống kiểm tra lại hoa hồng/)).toHaveCount(0);
 const descriptions=await dialog.locator('.invoice-handling-row > div > small').allTextContents();
 expect(descriptions).toHaveLength(5);
 expect(descriptions.every(text=>text.length<=90 && (text.match(/[.!?]/g)||[]).length<=1)).toBe(true);
 if(!['closed','staff'].includes(scenario)){await expect(date).toBeEnabled();await date.click();}
 const calls=await page.evaluate(()=>window.__replacementCalls);
 expect(calls.every(call=>call.opened)).toBe(true);
 expect(calls.map(call=>call.opened)).toEqual(scenario==='unused'?['updateInvoice','deleteInvoice','correctInvoiceDate']:['closed','staff'].includes(scenario)?[]:['correctInvoiceDate']);
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
