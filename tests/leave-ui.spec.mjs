import {test,expect} from '@playwright/test';
const person='Nguyễn Thị Minh Anh – nhân viên thử nghiệm';
test.beforeEach(async({page})=>{
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
});
const mobile=page=>page.viewportSize().width<=700;
const requests=page=>mobile(page)?page.locator('.leave-card'):page.locator('.leave-desktop table').nth(1).locator('tbody tr');

test('leave layout fits the viewport, avoids repeated identity and keeps header reachable while scrolling',async({page},info)=>{
 await page.goto('/');const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(requests(page)).toHaveCount(10);
 await expect(dialog.locator('#attendance-title')).toContainText(person);
 await expect(dialog.locator('.leave-management')).not.toContainText(person);
 await expect(dialog.locator('.leave-desktop th').filter({hasText:'Nhân viên'})).toHaveCount(0);
 if(mobile(page)){
  const bounds=await dialog.boundingBox();expect(Math.abs(bounds.width-page.viewportSize().width)).toBeLessThanOrEqual(1);expect(Math.abs(bounds.height-page.viewportSize().height)).toBeLessThanOrEqual(1);
  await expect(dialog.locator('table').first()).toBeHidden();await expect(dialog.locator('.leave-metrics > div')).toHaveCount(4);
  const button=await dialog.getByRole('button',{name:'＋ Ghi nghỉ phép',exact:true}).boundingBox();expect(button.height).toBeGreaterThanOrEqual(48);expect(button.width).toBeGreaterThan(page.viewportSize().width-40);
  expect(await dialog.locator('.attendance-dialog-body').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await expect(requests(page).first()).toContainText('1,5 ngày');await expect(requests(page).first()).toContainText('01/11/2026');await expect(requests(page).first()).toContainText('03/11/2026');
  await page.screenshot({path:info.outputPath('leave-top.png')});
  await requests(page).last().scrollIntoViewIfNeeded();expect(await dialog.locator('.attendance-dialog-body').evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
 }else{await expect(dialog.locator('table').first()).toBeVisible();await expect(dialog.locator('.leave-mobile').first()).toBeHidden();}
 const close=dialog.getByRole('button',{name:'Đóng',exact:true});await expect(close).toBeInViewport();
 if(mobile(page)){const bounds=await close.boundingBox();expect(bounds.height).toBeGreaterThanOrEqual(48);}
 await close.focus();await page.keyboard.press('Shift+Tab');await expect(dialog.getByRole('button',{name:'Sau',exact:true})).toBeFocused();await page.keyboard.press('Tab');await expect(close).toBeFocused();
 await page.screenshot({path:info.outputPath('leave-scrolled.png')});
 await close.click();await expect(dialog).toHaveCount(0);const reopen=page.getByRole('button',{name:'Mở nghỉ phép',exact:true});await reopen.click();await expect(dialog).toBeVisible();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(reopen).toBeFocused();
});

for(const role of ['OWNER','STAFF'])test(`leave actions retain ${role} permissions and payloads`,async({page})=>{
 await page.goto('/?role='+role);const pending=requests(page).nth(0),approved=requests(page).nth(1),rejected=requests(page).nth(2);
 await expect(pending.getByRole('button',{name:'Sửa',exact:true})).toBeVisible();
 await expect(approved.getByRole('button')).toHaveCount(role==='OWNER'?1:0);await expect(rejected.getByRole('button')).toHaveCount(role==='OWNER'?1:0);
 await expect(pending.getByRole('button')).toHaveCount(role==='OWNER'?3:1);
 await pending.getByRole('button',{name:'Sửa',exact:true}).click();await expect(page.getByTestId('action')).toContainText('recordStaffLeave');await expect(page.getByTestId('action')).toContainText('leave-0');
 if(role==='OWNER'){
  await page.getByRole('dialog').getByRole('button',{name:'Hủy',exact:true}).click();
  await page.getByRole('button',{name:'Mở nghỉ phép',exact:true}).click();await requests(page).first().getByRole('button',{name:'Duyệt',exact:true}).click();await expect(page.getByTestId('action')).toContainText('reviewStaffLeave');await expect(page.getByTestId('action')).toContainText('APPROVED');
  await page.getByRole('dialog').getByRole('button',{name:'Hủy',exact:true}).click();
  await page.getByRole('button',{name:'Mở nghỉ phép',exact:true}).click();await requests(page).first().getByRole('button',{name:'Từ chối',exact:true}).click();await expect(page.getByTestId('action')).toContainText('REJECTED');
 }
});

test('opening add leave renders the real form at phone width 390px',async({page},info)=>{
 test.skip(info.project.name!=='mobile-390','Capture the requested 390px phone viewport.');
 await page.goto('/');
 await page.getByRole('dialog').getByRole('button',{name:'＋ Ghi nghỉ phép',exact:true}).click();
 const form=page.getByRole('dialog',{name:'Ghi nhận nghỉ phép',exact:true});
 await expect(form).toBeVisible();
 await expect(page.locator('.attendance-dialog')).toHaveCount(0);
 await expect(page.getByRole('dialog')).toHaveCount(1);
 await expect(form.getByRole('combobox',{name:'Nhân viên',exact:true})).toHaveValue('staff');
 await expect(form.getByRole('textbox',{name:'Từ ngày',exact:true})).toHaveValue('2026-11-04');
 await expect(form.getByRole('textbox',{name:'Đến ngày',exact:true})).toHaveValue('2026-11-04');
 await expect(form.getByRole('combobox',{name:'Thời gian mỗi ngày',exact:true})).toHaveValue('FULL');
 await expect(form.getByRole('combobox',{name:'Loại nghỉ',exact:true})).toHaveValue('PERMITTED');
 await expect(form.getByLabel('Nghỉ hưởng lương',{exact:true})).not.toBeChecked();
 await expect(form.getByLabel('Lý do nghỉ',{exact:true})).toHaveValue('');
 expect(page.viewportSize().width).toBe(390);
 expect(await form.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:'outputs/leave-mobile-20261104/leave-form-390.png'});
 await form.evaluate(el=>{el.scrollTop=el.scrollHeight;});
 await expect(form.getByLabel('Lý do nghỉ',{exact:true})).toBeInViewport();
 await expect(form.getByRole('button',{name:'Lưu thông tin',exact:true})).toBeInViewport();
 await expect(form.getByRole('button',{name:'Hủy',exact:true})).toBeInViewport();
 await page.screenshot({path:'outputs/leave-mobile-20261104/leave-form-390-scrolled.png'});
 await form.getByRole('button',{name:'Hủy',exact:true}).click();
 await expect(form).toHaveCount(0);
});

test('empty state still permits adding leave and failed reads can retry',async({page},info)=>{
 await page.goto('/?case=empty');const dialog=page.getByRole('dialog');await expect(dialog.getByText(mobile(page)?'Chưa có đơn nghỉ trong tháng này.':'Chưa có bản ghi nghỉ trong tháng.',{exact:true})).toBeVisible();await page.screenshot({path:info.outputPath('leave-empty.png')});
 await dialog.getByRole('button',{name:'＋ Ghi nghỉ phép',exact:true}).click();await expect(page.getByTestId('action')).toContainText('recordStaffLeave');await expect(page.getByTestId('action')).toContainText('staff');
 await page.goto('/?case=retry');await expect(page.getByRole('alert')).toContainText('Không tải được ngày nghỉ thử nghiệm.');await page.getByRole('button',{name:'Thử lại',exact:true}).click();await expect(requests(page)).toHaveCount(10);
});

test('leave pagination remains usable without horizontal page overflow',async({page})=>{
 await page.goto('/');await expect(requests(page)).toHaveCount(10);await page.getByRole('button',{name:'Sau',exact:true}).click();await expect(requests(page)).toHaveCount(2);await expect(page.getByText('Trang 2/2',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Sau',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.getByRole('button',{name:'Trước',exact:true}).click();await expect(requests(page)).toHaveCount(10);
});
