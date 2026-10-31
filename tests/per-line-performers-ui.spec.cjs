const {test,expect}=require('@playwright/test');

const submission=async page=>JSON.parse(await page.locator('#last-submission').textContent());
async function addService(page,name){await page.getByRole('button',{name:new RegExp(name)}).click();}

test.beforeEach(async({page})=>{await page.goto('/');await expect(page.getByRole('heading',{name:'UI QA · nhân viên theo dòng'})).toBeVisible();});

test('2–3 services keep independent optional performers and need no invoice staff',async({page})=>{
 await addService(page,'Chăm sóc da QA');await addService(page,'Gội đầu QA');await addService(page,'Massage QA');
 const lines=page.locator('.cashier-service-line');await expect(lines).toHaveCount(3);
 await lines.nth(0).getByLabel('Người thực hiện dòng này').selectOption({label:'Nhân viên An'});
 await lines.nth(1).getByLabel('Người thực hiện dòng này').selectOption({label:'Nhân viên Bình'});
 await expect(lines.nth(2).getByLabel('Người thực hiện dòng này')).toHaveValue('');
 await expect(page.getByLabel(/Nhân viên cấp hóa đơn/)).toHaveValue('');
 await page.getByRole('button',{name:'Lưu toàn bộ giỏ'}).click();await expect(page.locator('#last-submission')).not.toHaveText('');
 const saved=await submission(page);expect(saved.action).toBe('serviceInvoice');expect(saved.values.staffId).toBeUndefined();
 expect(saved.values.items.map(row=>row.performerId)).toEqual(['bbbbbbbbbbbbbbbbbbbbbbbb','cccccccccccccccccccccccc',undefined]);
});

test('purchased treatment and standalone service preserve separate performers',async({page})=>{
 await page.getByRole('button',{name:'Dùng gói đã mua'}).click();await addService(page,'Liệu trình synthetic QA');
 await page.locator('.cashier-service-line').getByLabel('Người thực hiện lượt này').selectOption({label:'Nhân viên An'});
 await page.getByRole('button',{name:'Dịch vụ lẻ'}).click();await addService(page,'Gội đầu QA');
 await page.locator('.cashier-service-line').getByLabel('Người thực hiện dòng này').selectOption({label:'Nhân viên Bình'});
 await page.getByRole('button',{name:'Lưu toàn bộ giỏ'}).click();await expect(page.locator('#last-submission')).not.toHaveText('');
 const saved=await submission(page);expect(saved.action).toBe('invoice');expect(saved.values.staffId).toBeUndefined();
 expect(saved.values.treatments[0].performerId).toBe('bbbbbbbbbbbbbbbbbbbbbbbb');expect(saved.values.additionalServices[0].performerId).toBe('cccccccccccccccccccccccc');
});

test('mobile cart has no horizontal overflow and performer controls remain touchable',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='mobile','mobile-only layout assertion');
 await addService(page,'Chăm sóc da QA');await addService(page,'Gội đầu QA');
 const selects=page.getByLabel('Người thực hiện dòng này');await expect(selects).toHaveCount(2);
 for(let index=0;index<2;index++){const box=await selects.nth(index).boundingBox();expect(box.height).toBeGreaterThanOrEqual(40);expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(413);}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
