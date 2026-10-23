import {test,expect} from '@playwright/test';
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
