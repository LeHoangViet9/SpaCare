const {test,expect}=require('@playwright/test');
for(const entry of ['list','detail'])test(`HD000021 technician edit through production Workspace ${entry} and backend operations`,async({page,request},info)=>{
 const ids=await (await request.get('/__test/reset')).json(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/workspace/invoices');const row=page.getByRole('row').filter({hasText:'HD000021'});await expect(row).toContainText('Gội đầu dưỡng sinh');
 if(entry==='detail'){
  await row.getByRole('button',{name:'Chi tiết / chữ ký',exact:true}).click();const detail=page.getByRole('dialog',{name:'Chi tiết hóa đơn',exact:true});await expect(detail).toContainText('HD000021');
  await expect(detail.getByRole('button',{name:'Đính chính dịch vụ / kỹ thuật viên',exact:true})).toHaveCount(0);
  await detail.locator('.invoice-handling > summary').click();
  await expect(detail.getByRole('button',{name:'Sửa hóa đơn',exact:true})).toHaveCount(1);
  await detail.getByRole('button',{name:'Sửa hóa đơn',exact:true}).click();
 }else await row.getByRole('button',{name:'Sửa hóa đơn',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Sửa hóa đơn',exact:true}),technician=dialog.getByRole('combobox',{name:'Kỹ thuật viên',exact:true});
 await expect(dialog).toContainText('HD000021');await expect(dialog).toContainText('Gội đầu dưỡng sinh');await expect(technician).toHaveValue(ids.tech);await expect(technician).toBeEnabled();
 await expect(dialog).not.toContainText('Chỉ đính chính');await expect(dialog).not.toContainText('Tổng tiền, ngày hóa đơn');await expect(dialog.getByLabel('Lý do',{exact:true})).toBeVisible();await expect(dialog).toContainText('300.000');
 await technician.scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`outputs/HD000021-technician-field-${entry}-${info.project.name}.png`});
 await technician.selectOption(ids.tech2);await dialog.getByRole('button',{name:'Xem trước đính chính',exact:true}).click();
 expect((await (await request.get('/__test/state')).json()).requests.filter(r=>r.method==='POST')).toHaveLength(0);
 await dialog.getByLabel('Lý do',{exact:true}).fill('Đối chiếu phiếu thực hiện: gán nhầm kỹ thuật viên');await dialog.getByRole('button',{name:'Xem trước đính chính',exact:true}).click();
 const comparison=dialog.getByRole('region',{name:'Đối chiếu kỹ thuật viên',exact:true});await expect(comparison).toContainText('KTV cũ local');await expect(comparison).toContainText('KTV mới local');
 await expect(comparison).toContainText('Dòng 1 · Gội đầu dưỡng sinh');
 const review=dialog.getByRole('region',{name:'Đối chiếu điều chỉnh hóa đơn',exact:true});
 await expect(review.getByRole('row').filter({hasText:'Còn nợ'})).toContainText('0 đ');
 await expect(review).toContainText('Chênh lệch: 0 đ');await expect(review).toContainText('Hoa hồng KTV cũ local: -10.000 đ');await expect(review).toContainText('Hoa hồng KTV mới local: 10.000 đ');
 const beforeContent=dialog.locator('.invoice-content-comparison > section').nth(0),afterContent=dialog.locator('.invoice-content-comparison > section').nth(1);
 await expect(beforeContent.locator('li')).toHaveCount(1);await expect(beforeContent.locator('li')).toContainText('Gội đầu dưỡng sinh');await expect(beforeContent.locator('li')).toContainText('KTV cũ local');
 await expect(afterContent.locator('li')).toHaveCount(1);await expect(afterContent.locator('li')).toContainText('Gội đầu dưỡng sinh');await expect(afterContent.locator('li')).toContainText('KTV mới local');
 await comparison.scrollIntoViewIfNeeded();await page.screenshot({path:`outputs/HD000021-technician-${entry}-${info.project.name}.png`,fullPage:true});
 await dialog.getByRole('button',{name:'Xác nhận lưu hóa đơn',exact:true}).click();await expect(dialog).toHaveCount(0);
 const result=await (await request.get('/__test/state')).json(),state=result.state,invoice=state.Invoice.find(i=>i._id===ids.billId);
 expect(result.requests.some(r=>r.method==='GET'&&r.edit==='1')).toBe(true);
 expect(invoice.performedBy).toBe(ids.tech2);expect(invoice.serviceItems[0].performerId).toBe(ids.tech2);expect(invoice.performedAt).toBe(result.original.invoice.performedAt);
 expect(state.CashEntry).toEqual(result.original.receipts);expect(state.Payment).toEqual(result.original.payments);expect(state.TreatmentUse).toEqual(result.original.uses);
 expect(state.Commission[0].amount).toBe(10000);const corrections=state.InvoiceLineCommission.filter(r=>r.invoiceId===ids.billId);expect(corrections).toHaveLength(2);expect(corrections.map(r=>r.amount).sort((a,b)=>a-b)).toEqual([-10000,10000]);expect(corrections.every(r=>r.originalLedgerIds.includes(ids.ledger))).toBe(true);
 expect(state.Payroll.every(r=>r.needsRecalculation)).toBe(true);expect(result.salary.find(r=>r.staffId===ids.tech).latestCommissionTotal).toBe(0);expect(result.salary.find(r=>r.staffId===ids.tech2).latestCommissionTotal).toBe(10000);
 const adjustment=state.InvoiceAdjustment[0];expect(adjustment.reason).toContain('gán nhầm');expect(adjustment.reconciliation.content.serviceCorrections[0]).toMatchObject({before:{performerId:ids.tech,performerName:'KTV cũ local'},after:{performerId:ids.tech2,performerName:'KTV mới local'}});
 expect(adjustment.before.serviceItems).toEqual([]);expect(adjustment.reconciliation.content.displayBefore.serviceItems).toHaveLength(1);
 await page.getByRole('row').filter({hasText:'HD000021'}).getByRole('button',{name:'Chi tiết / chữ ký',exact:true}).click();const saved=page.getByRole('dialog',{name:'Chi tiết hóa đơn',exact:true});await expect(saved.locator('.invoice-service-lines')).toContainText('KTV mới local');
 const history=saved.getByRole('region',{name:'Chứng từ điều chỉnh',exact:true});await history.locator('details').first().locator('summary').click();await expect(history.getByRole('region',{name:'Đối chiếu kỹ thuật viên',exact:true})).toContainText('KTV cũ local');await expect(history.getByRole('region',{name:'Đối chiếu kỹ thuật viên',exact:true})).toContainText('KTV mới local');
 expect(errors).toEqual([]);
});

for(const scenario of ['package','closed'])test(`HD000021 keeps unverified package and closed payroll sources locked: ${scenario}`,async({page,request})=>{
 await request.get('/__test/reset?'+(scenario==='package'?'kind=package':'closed=1'));await page.goto('/workspace/invoices');await page.getByRole('row').filter({hasText:'HD000021'}).getByRole('button',{name:'Sửa hóa đơn',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Sửa hóa đơn',exact:true});await expect(dialog.getByRole('region',{name:'Nội dung hóa đơn sau sửa',exact:true})).toBeVisible();await expect(dialog.getByRole('combobox',{name:'Kỹ thuật viên',exact:true})).toHaveCount(0);
 await expect(dialog).toContainText(scenario==='closed'?'lương đã chốt':'gói/buổi');
 const result=await (await request.get('/__test/state')).json();expect(result.state.Payroll).toEqual(result.original.payrolls);expect(result.state.TreatmentUse).toEqual(result.original.uses);expect(result.requests.filter(r=>r.method==='POST')).toHaveLength(0);
});

test('Workspace refuses an incomplete edit response instead of silently showing only money/date fields',async({page,request})=>{
 await request.get('/__test/reset');await page.route('**/api/invoices/*?edit=1',async route=>{const response=await route.fetch(),body=await response.json();delete body.editContext;await route.fulfill({json:body});});
 await page.goto('/workspace/invoices');await page.getByRole('row').filter({hasText:'HD000021'}).getByRole('button',{name:'Sửa hóa đơn',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Chưa tải được nội dung và kỹ thuật viên');await expect(page.getByRole('dialog',{name:'Sửa hóa đơn',exact:true})).toHaveCount(0);
 expect((await (await request.get('/__test/state')).json()).requests.filter(r=>r.method==='POST')).toHaveLength(0);
});

test('unified detail editor changes only the selected repeated service line and retains receipt sources',async({page,request})=>{
 const ids=await (await request.get('/__test/reset?kind=multi')).json();await page.goto('/workspace/invoices');
 await page.getByRole('button',{name:'Chi tiết / chữ ký',exact:true}).click();
 const detail=page.getByRole('dialog',{name:'Chi tiết hóa đơn',exact:true});await detail.locator('.invoice-handling > summary').click();await detail.getByRole('button',{name:'Sửa hóa đơn',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Sửa hóa đơn',exact:true});
 await expect(dialog.getByRole('combobox',{name:'Kỹ thuật viên',exact:true})).toHaveCount(2);
 await dialog.getByRole('group',{name:'Dịch vụ 2',exact:true}).getByRole('combobox',{name:'Kỹ thuật viên',exact:true}).selectOption(ids.tech2);
 await expect(dialog.getByRole('group',{name:'Dịch vụ 1',exact:true}).getByRole('combobox',{name:'Kỹ thuật viên',exact:true})).toHaveValue(ids.tech);
 await dialog.getByLabel('Lý do',{exact:true}).fill('Đính chính đúng lượt dịch vụ thứ hai');await dialog.getByRole('button',{name:'Xem trước đính chính',exact:true}).click();
 await expect(dialog.getByRole('region',{name:'Đối chiếu kỹ thuật viên',exact:true})).toContainText('Dòng 2 · Gội đầu dưỡng sinh');
 await dialog.getByRole('button',{name:'Xác nhận lưu hóa đơn',exact:true}).click();await expect(dialog).toHaveCount(0);
 const result=await (await request.get('/__test/state')).json(),bill=result.state.Invoice.find(r=>r._id===ids.billId);
 expect(bill.serviceItems[0]).toEqual(result.original.invoice.serviceItems[0]);expect(bill.serviceItems[1].performerId).toBe(ids.tech2);
 expect([bill.total,bill.paid,bill.total-bill.paid]).toEqual([300000,300000,0]);expect(result.state.Payment).toEqual(result.original.payments);expect(result.state.CashEntry).toEqual(result.original.receipts);
 const corrections=result.state.InvoiceLineCommission.filter(r=>r.adjustmentId);expect(corrections).toHaveLength(2);expect(corrections.every(r=>r.originalLedgerIds.includes(ids.ledger))).toBe(true);
 const change=result.state.InvoiceAdjustment[0];expect(change.actorId).toBeTruthy();expect(change.createdAt).toBeTruthy();expect(change.reason).toContain('thứ hai');expect(change.reconciliation.content.serviceCorrections[0].lineNumber).toBe(2);
});

test('unified editor reprices an eligible service and previews debt without recording money or commission',async({page,request})=>{
 const ids=await (await request.get('/__test/reset?kind=unperformed')).json();await page.goto('/workspace/invoices');await page.getByRole('button',{name:'Chi tiết / chữ ký',exact:true}).click();
 const detail=page.getByRole('dialog',{name:'Chi tiết hóa đơn',exact:true});await detail.locator('.invoice-handling > summary').click();await detail.getByRole('button',{name:'Sửa hóa đơn',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Sửa hóa đơn',exact:true}),line=dialog.getByRole('group',{name:'Dịch vụ 1',exact:true});
 await line.getByRole('combobox',{name:'Dịch vụ',exact:true}).selectOption(ids.replacementService);await line.getByLabel('Giá dịch vụ (VNĐ)',{exact:true}).fill('250000');await line.getByRole('combobox',{name:'Kỹ thuật viên',exact:true}).selectOption(ids.tech2);
 await dialog.getByLabel('Lý do',{exact:true}).fill('Sửa dịch vụ và giá thực tế');await dialog.getByRole('button',{name:'Xem trước thay đổi',exact:true}).click();
 const review=dialog.getByRole('region',{name:'Đối chiếu điều chỉnh hóa đơn',exact:true}),debt=review.getByRole('row').filter({hasText:'Còn nợ'});
 await expect(debt).toContainText('200.000 đ');await expect(debt).toContainText('150.000 đ');await expect(review).toContainText('Chênh lệch: -50.000 đ');await expect(review).toContainText('Hoa hồng: không thay đổi.');
 await dialog.getByRole('button',{name:'Xác nhận lưu hóa đơn',exact:true}).click();await expect(dialog).toHaveCount(0);
 const result=await (await request.get('/__test/state')).json(),bill=result.state.Invoice.find(r=>r._id===ids.billId);
 expect([bill.total,bill.paid,bill.total-bill.paid]).toEqual([250000,100000,150000]);expect(bill.serviceItems[0].serviceId).toBe(ids.replacementService);expect(bill.serviceItems[0].performerId).toBe(ids.tech2);
 expect(result.state.Payment).toEqual(result.original.payments);expect(result.state.CashEntry).toEqual(result.original.receipts);expect(result.state.InvoiceLineCommission).toHaveLength(0);
});
