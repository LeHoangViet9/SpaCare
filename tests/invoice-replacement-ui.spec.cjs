const {test,expect}=require('@playwright/test');

for(const initial of ['unreplaced','active'])test(`invoice detail has unique sibling keys and resets replacement state (${initial})`,async({page},testInfo)=>{
 const keyWarnings=[],pageErrors=[];
 page.on('console',message=>{if(/same key|unique.*key/i.test(message.text()))keyWarnings.push(message.text());});
 page.on('pageerror',error=>pageErrors.push(error.message));
 await page.goto('/?detail=1'+(initial==='unreplaced'?'&unreplaced=1':''));
 const dialog=page.getByRole('dialog',{name:'Chi tiết hóa đơn'});
 await expect(dialog.getByRole('button',{name:'Tải PDF',exact:true})).toHaveCount(1);
 const toggle=dialog.getByRole('button',{name:'Thay thế chứng từ sửa tư vấn bán gói',exact:true});
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
