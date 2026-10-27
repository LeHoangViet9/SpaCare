// Offline only: evaluate helper declarations, never import the executable runner.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('./preview-auth-smoke.mjs',import.meta.url),'utf8');
const helpers=source.slice(source.indexOf('async function visible('),source.indexOf('async function api('));
const origin='https://spacare-7smadvclt-hviet15.vercel.app';
function harness(driver){
 const context=vm.createContext({driver,URL,PREVIEW_ORIGIN:origin,By:{css:value=>value},diagnostic:{},diagnosticError:code=>Object.assign(new Error(),{code})});
 vm.runInContext(helpers,context);return context;
}
const element=(displayed,enabled)=>({isDisplayed:async()=>displayed,isEnabled:async()=>enabled});
test('hidden mobile button is skipped and visible enabled desktop button selected',async()=>{
 const desktop=element(true,true),mobile=element(false,true);
 const c=harness({wait:async fn=>fn(),findElements:async()=>[mobile,desktop]});
 assert.equal(await c.visible('button'),desktop);
});
test('disabled and stale buttons skipped; visible mobile also works',async()=>{
 const mobile=element(true,true),stale={isDisplayed:async()=>{throw Object.assign(new Error(),{name:'StaleElementReferenceError'});}};
 const c=harness({wait:async fn=>fn(),findElements:async()=>[element(true,false),stale,mobile]});
 assert.equal(await c.visible('button'),mobile);
});
test('no usable button returns false to bounded WebDriver wait',async()=>{
 const c=harness({wait:async fn=>fn(),findElements:async()=>[element(false,true),element(true,false)]});
 assert.equal(await c.visible('button'),false);
});
test('unexpected driver error is preserved instead of hidden until timeout',async()=>{
 const error=new Error('offline');const c=harness({wait:async fn=>fn(),findElements:async()=>[{isDisplayed:async()=>{throw error;}}]});
 await assert.rejects(c.visible('button'),value=>value===error);
});
test('denied staff page restored without login; query not saved',async()=>{
 let current=origin+'/workspace/staff?private=not-recorded';const visits=[];
 const c=harness({getCurrentUrl:async()=>current,get:async value=>{visits.push(value);current=value;}});
 await c.prepareLogoutPage();assert.deepEqual(visits,[origin+'/workspace']);
 assert.equal(c.diagnostic.pageBeforeLogout,'/workspace/staff');assert.equal(c.diagnostic.workspaceRestored,true);
 assert.equal(JSON.stringify(c.diagnostic).includes('not-recorded'),false);
});
test('foreign origin fails closed before any navigation',async()=>{
 let visits=0;const c=harness({getCurrentUrl:async()=> 'https://foreign.invalid/workspace',get:async()=>{visits++;}});
 await assert.rejects(c.prepareLogoutPage(),e=>e.code==='LOGOUT_ORIGIN_BLOCKED');assert.equal(visits,0);
});
test('unexpected login redirect fails rather than re-authenticating',async()=>{
 let current=origin+'/workspace/staff';const c=harness({getCurrentUrl:async()=>current,get:async()=>{current=origin+'/login';}});
 await assert.rejects(c.prepareLogoutPage(),e=>e.code==='LOGOUT_WORKSPACE_NOT_RESTORED');
});
