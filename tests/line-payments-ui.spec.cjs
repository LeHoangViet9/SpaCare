const {test,expect}=require('@playwright/test');
const saved=async page=>JSON.parse(await page.locator('#saved').textContent());
test('payment submits explicit line allocation',async({page})=>{
  await page.goto('/?mode=payment');
  await page.getByLabel(/Dịch vụ B/).fill('100000');
  await page.getByLabel('Đã nhận tiền').check();
  await page.getByRole('button',{name:'Xác nhận đã nhận tiền'}).click();
  await expect(page.locator('#saved')).not.toBeEmpty();
  expect((await saved(page)).lineAllocations).toEqual([{lineId:'dddddddddddddddddddddddd',amount:100000}]);
});
test('changing deposit target clears old line allocations',async({page})=>{
  await page.goto('/?mode=allocate');
  await page.getByLabel(/Dịch vụ A/).fill('50000');
  await page.getByRole('combobox',{name:/Hóa đơn/}).selectOption('eeeeeeeeeeeeeeeeeeeeeeee');
  await expect(page.getByLabel(/Dịch vụ A/)).toHaveValue('0');
  await page.getByLabel(/Dịch vụ B/).fill('100000');
  await page.getByRole('button',{name:'Lưu thông tin'}).click();
  await expect(page.locator('#saved')).not.toBeEmpty();
  expect((await saved(page)).lineAllocations).toEqual([{lineId:'111111111111111111111111',amount:100000}]);
});
test('card and extra cash submit separate allocation sources',async({page})=>{
  await page.goto('/?mode=card');
  await page.getByRole('button',{name:'Dùng thẻ này'}).click();
  await page.getByLabel('Trừ thẻ (VNĐ)').fill('150000');
  await page.getByLabel('Thu thêm (VNĐ)').fill('100000');
  await page.getByRole('group',{name:'Phân bổ phần trừ thẻ',exact:true}).getByLabel(/Dịch vụ A/).fill('150000');
  await page.getByRole('group',{name:'Phân bổ phần thu thêm',exact:true}).getByLabel(/Dịch vụ B/).fill('100000');
  await page.getByLabel('Đã kiểm tra và thực nhận phần tiền thu thêm').check();
  await page.getByRole('button',{name:'Xác nhận thanh toán',exact:true}).click();
  await expect(page.locator('#saved')).not.toBeEmpty();
  const payload=(await saved(page)).data;
  expect(payload.lineAllocations).toEqual([{lineId:'cccccccccccccccccccccccc',amount:150000}]);
  expect(payload.additionalLineAllocations).toEqual([{lineId:'dddddddddddddddddddddddd',amount:100000}]);
});
