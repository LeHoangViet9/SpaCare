const {test,expect}=require('@playwright/test');
const saved=async page=>JSON.parse(await page.locator('#saved').textContent());
const noAllocations=async page=>{
 await expect(page.locator('input[name*="Allocations"],.payment-service-allocation')).toHaveCount(0);
 await expect(page.getByText(/Phân bổ (theo|phần|tiền mặt|chuyển khoản)/)).toHaveCount(0);
};
test('partial invoice payment has no service allocation fields or payload',async({page})=>{
 await page.goto('/?mode=payment');await noAllocations(page);
 await page.getByLabel('Đã nhận tiền').check();
 await page.getByRole('button',{name:'Xác nhận đã nhận tiền'}).click();
 await expect(page.locator('#saved')).not.toBeEmpty();
 expect((await saved(page)).lineAllocations).toBeUndefined();
 expect((await saved(page)).amount).toBe(100000);
});
test('deposit application targets the invoice without creating line allocations',async({page})=>{
 await page.goto('/?mode=allocate');await noAllocations(page);
 await page.getByRole('combobox',{name:/Hóa đơn/}).selectOption('eeeeeeeeeeeeeeeeeeeeeeee');
 await page.getByRole('button',{name:'Lưu thông tin'}).click();
 await expect(page.locator('#saved')).not.toBeEmpty();
 expect((await saved(page)).invoiceId).toBe('eeeeeeeeeeeeeeeeeeeeeeee');
 expect((await saved(page)).lineAllocations).toBeUndefined();
});
test('card and extra cash settle invoice debt without line assignments',async({page})=>{
 await page.goto('/?mode=card');
 await page.getByRole('button',{name:'Dùng thẻ này'}).click();
 await page.getByLabel('Trừ thẻ (VNĐ)').fill('150000');
 await page.getByLabel('Thu thêm (VNĐ)').fill('100000');await noAllocations(page);
 await page.getByLabel('Đã kiểm tra và thực nhận phần tiền thu thêm').check();
 await page.getByRole('button',{name:'Xác nhận thanh toán',exact:true}).click();
 await expect(page.locator('#saved')).not.toBeEmpty();
 const payload=(await saved(page)).data;
 expect(payload.amount).toBe(150000);expect(payload.additionalAmount).toBe(100000);
 expect(payload.lineAllocations).toBeUndefined();expect(payload.additionalLineAllocations).toBeUndefined();
});
