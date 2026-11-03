const {test,expect}=require('@playwright/test');
for(const kind of ['service','package','product'])test(`actual ${kind} line accepts zero and keeps catalog default`,async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 if(kind==='service'){await page.getByRole('button',{name:/^Fixture/}).click();await page.getByRole('button',{name:/^Service fixture/}).click();}
 else{await page.getByRole('button',{name:kind==='package'?'Bán gói mới':'Sản phẩm',exact:true}).click();await page.getByRole('button',{name:kind==='package'?/^Package fixture/:/^Product fixture/}).click();}
 const input=page.getByRole('textbox',{name:kind==='service'?'Giá dịch vụ (VNĐ)':kind==='package'?'Giá gói (VNĐ)':'Đơn giá (VNĐ)',exact:true});
 await expect(input).toHaveValue(kind==='service'?'100000':kind==='package'?'900000':'80000');
 for(const value of ['0','12345']){
  await input.fill(value);await page.getByRole('button',{name:'Lưu toàn bộ giỏ',exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>window.__pricingSubmissions.length)).toBe(value==='0'?1:2);
  const saved=await page.evaluate(()=>window.__pricingSubmissions.at(-1));
  expect(kind==='service'?saved.values.items[0].total:kind==='package'?saved.values.total:saved.values.items[0].unitPrice).toBe(Number(value));
 }
 await input.fill('-1');await page.getByRole('button',{name:'Lưu toàn bộ giỏ',exact:true}).click();
 expect(await page.evaluate(()=>window.__pricingSubmissions.length)).toBe(2);expect(errors).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('purchased package use has no editable price',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Dùng gói đã mua',exact:true}).click();await page.getByRole('button',{name:/^Purchased fixture/}).click();
 await expect(page.getByLabel(/Giá dịch vụ|Giá gói|Đơn giá/)).toHaveCount(0);
});
