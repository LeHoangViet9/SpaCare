// A streamed 200 is accepted only with positive Not Found evidence and server API denials.
export async function assertDeniedWorkspace({page,response,section,origin,expect,assertUi}){
 if(origin!=='http://127.0.0.1:3220'||!['inventory','staff','audit','services','cashier'].includes(section))throw Error('UI_DENIAL_TARGET_REJECTED');
 await assertUi('STAFF_FORBIDDEN_HTTP_STATUS',()=>expect([200,404]).toContain(response.status()));
 await assertUi('STAFF_FORBIDDEN_NOT_FOUND_VISIBLE',()=>expect(page.getByRole('heading',{name:'404',exact:true})).toBeVisible());
 await assertUi('STAFF_FORBIDDEN_NOINDEX',()=>expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached());
 await assertUi('STAFF_FORBIDDEN_WORKSPACE_ABSENT',()=>expect(page.locator('main.main')).toHaveCount(0));
 await assertUi('STAFF_FORBIDDEN_INVENTORY_ABSENT',()=>expect(page.getByRole('heading',{name:'Kho hàng',exact:true,includeHidden:true})).toHaveCount(0));
 // Context request shares only synthetic cookies; fixed same-origin requests remain behind the kernel guard.
 const urls=['/api/workspace?section='+section,...(section==='inventory'?['/api/products?view=inventory','/api/products?view=inventory&history=yes']:[])];
 for(const url of urls){
  const result=await page.context().request.get(origin+url,{maxRedirects:0});
  try{
   await assertUi('STAFF_FORBIDDEN_API_STATUS',()=>expect(result.status()).toBe(403));
   await assertUi('STAFF_FORBIDDEN_API_NO_DATA',async()=>{
    const body=await result.json();expect(Object.keys(body)).toEqual(['error']);expect(typeof body.error).toBe('string');
   });
  }finally{await result.dispose();}
 }
}


