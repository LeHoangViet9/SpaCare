import {execFileSync} from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {tsImport} from 'tsx/esm/api';
import {canViewPage,pageKeys} from '../src/lib/navigation.ts';
import {ZodError} from 'zod';
import {productQuery,canViewProducts,canManageProducts} from '../src/lib/product-rules.ts';
import {workspaceQuery,literalPattern} from '../src/lib/workspace-query.ts';
import {assertDeniedWorkspace} from './ui/denied-workspace.mjs';

const {readWorkspace}=await tsImport('../src/lib/workspace-read.ts',import.meta.url);
const models=await tsImport('../src/lib/models.ts',import.meta.url);

const rules=await tsImport('../src/lib/rules.ts',import.meta.url);const {ensure}=rules;
const {readProducts}=load('../src/lib/product-read.ts',{'./navigation':{canViewPage},'./models':models,'./product-rules':{canViewProducts,canManageProducts,productQuery},'./workspace-query':{literalPattern},'./rules':rules});
const {failure}=load('../src/lib/http.ts',{'./logger':{log:()=>{},requestId:()=> 'OFFLINE'},'./rules':rules,'zod':{ZodError},'./db':{DatabaseUnavailableError:class extends Error{}}});
const staff={id:'a'.repeat(24),spaId:'b'.repeat(24),name:'Synthetic',role:'STAFF',cashier:false};
function load(file,imports){
 const code=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 new Function('require','module','exports',code)(name=>{assert.ok(Object.hasOwn(imports,name),'Unexpected dependency');return imports[name];},module,module.exports);
 return module.exports;
}
test('STAFF including cashier cannot read inventory, history or group-management before any model query',async t=>{
 for(const m of [models.Product,models.ProductGroup,models.StockMovement,models.User])for(const method of ['find','countDocuments'])t.mock.method(m,method,()=>assert.fail('Unauthorized model query'));
 for(const cashier of [false,true])for(const query of ['view=inventory','view=inventory&history=yes','view=inventory&history=yes&productId='+ 'c'.repeat(24),'view=product_groups','view=inventory&role=OWNER&spaId='+ 'f'.repeat(24)]){
  await assert.rejects(readProducts({...staff,cashier},productQuery(new URLSearchParams(query))),e=>e.status===403);
 }
 await assert.rejects(readWorkspace(staff,workspaceQuery(new URLSearchParams('section=inventory'))),e=>e.status===403);
});
test('real products API returns HTTP 403 with error-only JSON for direct inventory requests',async t=>{
 for(const m of [models.Product,models.ProductGroup,models.StockMovement])t.mock.method(m,'find',()=>assert.fail('Unauthorized data query'));
 const api=load('../src/app/api/products/route.ts',{'@/lib/auth':{actor:async()=>({...staff,cashier:true})},'@/lib/product-rules':{productQuery},'@/lib/product-read':{readProducts},'@/lib/http':{failure},'@/lib/rules':{ensure}});
 for(const query of ['view=inventory','view=inventory&history=yes','view=product_groups']){
  const response=await api.GET(new Request('http://synthetic.invalid/api/products?'+query));
  assert.equal(response.status,403);assert.deepEqual(Object.keys(await response.json()),['error']);
 }
});
test('OWNER inventory history remains allowed, tenant scope is server actor and STAFF product browsing remains read-only',async t=>{
 const observed=[];
 const cursor=value=>({select(){return this;},sort(){return this;},skip(){return this;},limit(){return this;},async lean(){return value;},async distinct(){return ['c'.repeat(24)];}});
 for(const m of [models.Product,models.ProductGroup,models.StockMovement]){
  t.mock.method(m,'find',filter=>{observed.push(filter);return cursor(m===models.StockMovement?[{kind:'MANUAL',quantity:1}]:[]);});
  t.mock.method(m,'countDocuments',async filter=>{observed.push(filter);return 1;});
 }
 const owner=await readProducts({...staff,role:'OWNER'},productQuery(new URLSearchParams('view=inventory&history=yes&spaId='+ 'f'.repeat(24))));
 assert.equal(owner.canManage,true);assert.equal(owner.rows[0].kind,'MANUAL');
 const employee=await readProducts(staff,productQuery(new URLSearchParams('view=products')));
 assert.equal(employee.canManage,false);assert.ok(observed.every(q=>q.spaId===staff.spaId));
});
test('direct server page calls notFound for STAFF before creating Workspace; owner remains allowed',async()=>{
 let workspaceElements=0;const stop=Symbol('not-found'),redirected=Symbol('redirect');
 for(const role of ['STAFF','OWNER','CUSTOMER']){
  const page=load('../src/app/workspace/[section]/page.tsx',{
   '@/components/workspace':{default:()=>null},'@/lib/navigation':{pageKeys,canViewPage},
   '@/lib/auth':{actor:async()=>({...staff,role,cashier:true})},
   'next/navigation':{notFound:()=>{throw stop;},redirect:()=>{throw redirected;}},
   'react/jsx-runtime':{jsx:()=>{workspaceElements++;return {};}}
  });
  if(role==='OWNER')await page.default({params:Promise.resolve({section:'inventory'})});
  else await assert.rejects(page.default({params:Promise.resolve({section:'inventory'})}),e=>e===(role==='STAFF'?stop:redirected));
 }
 assert.equal(workspaceElements,1);
});
test('actor revalidates active same-spa user from hashed session, not cookie role hints',async()=>{
 let enabled=true;
 const auth=load('../src/lib/auth.ts',{
  './password':{hash:token=>'HASHED_SYNTHETIC',hashPassword:()=>{},verifyPassword:()=>{}},
  'next/headers':{cookies:async()=>({get:()=>({value:'SYNTHETIC_TOKEN'})})},
  './db':{connect:async()=>{}},
  './models':{
   Session:{findOne:async q=>{assert.equal(q.tokenHash,'HASHED_SYNTHETIC');assert.ok(q.expiresAt.$gt instanceof Date);return {userId:staff.id,spaId:staff.spaId};}},
   User:{findOne:async q=>{assert.equal(q.active,true);assert.equal(q.spaId,staff.spaId);return enabled?{...staff,_id:staff.id,active:true}:null;}}
  },
  './rules':{ensure},'./request-origin':{isTrustedRequestOrigin:()=>true}
 });
 assert.equal((await auth.actor()).role,'STAFF');enabled=false;await assert.rejects(auth.actor(),e=>e.status===401);
});
test('actual Next default Not Found has positive 404/noindex evidence; loading boundary alone is not denial',()=>{
 const require=createRequire(import.meta.url),NotFound=require(fileURLToPath(new URL('../node_modules/next/dist/client/components/builtin/not-found.js',import.meta.url)));
 const html=renderToStaticMarkup(React.createElement(NotFound.default||NotFound));
 assert.match(html,/<h1[^>]*>404<\/h1>/);
 const file=fileURLToPath(new URL('../node_modules/next/dist/client/components/http-access-fallback/error-boundary.js',import.meta.url));
 const module={exports:{}};new Function('require','module','exports',readFileSync(file,'utf8')+'\n;module.exports.TestBoundary=HTTPAccessFallbackErrorBoundary;')(createRequire(file),module,module.exports);
 const boundary=new module.exports.TestBoundary({pathname:'/workspace/inventory',notFound:React.createElement(NotFound.default||NotFound)});boundary.state={...boundary.state,triggeredStatus:404};
 assert.match(renderToStaticMarkup(boundary.render()),/name="robots" content="noindex"/);
});
function fakeExpect(value){return {
 toBe:expected=>assert.equal(value,expected),toEqual:expected=>assert.deepEqual(value,expected),
 toContain:expected=>assert.ok(value.includes(expected)),
 async toBeVisible(){assert.equal(value.visible,true);},
 async toBeAttached(){assert.equal(value.attached,true);},
 async toHaveCount(expected){assert.equal(value.count,expected);}
};}
function denialFixture({status=200,notFound=true,noindex=true,workspace=0,inventory=0,apiStatus=403,leak=false}={}){
 const urls=[],disposed=[];
 const page={
  getByRole(_role,options){return options.name==='404'?{visible:notFound}:{count:inventory};},
  locator(selector){return selector==='main.main'?{count:workspace}:{first:()=>({attached:noindex})};},
  context(){return {request:{async get(url,options){
   assert.equal(options.maxRedirects,0);assert.ok(url.startsWith('http://127.0.0.1:3220/api/'));urls.push(url);
   return {status:()=>apiStatus,json:async()=>leak?{error:'Denied',rows:[{synthetic:true}]}:{error:'Denied'},dispose:async()=>disposed.push(url)};
  }}};}
 };
 return {page,response:{status:()=>status},urls,disposed};
}
test('streamed 200 and non-streamed 404 pass only with explicit denial UI, absent warehouse and three API 403s',async()=>{
 for(const status of [200,404]){
  const fixture=denialFixture({status}),ids=[];
  await assertDeniedWorkspace({...fixture,section:'inventory',origin:'http://127.0.0.1:3220',expect:fakeExpect,assertUi:async(id,fn)=>{ids.push(id);await fn();}});
  assert.equal(fixture.urls.length,3);assert.equal(fixture.disposed.length,3);assert.ok(ids.includes('STAFF_FORBIDDEN_NOINDEX'));
 }
});
test('200 inventory leak, blank/loading response, login redirect and API bypass all fail the UI security contract',async()=>{
 for(const settings of [{workspace:1},{inventory:1},{notFound:false},{noindex:false},{status:302},{status:500},{apiStatus:200},{leak:true}]){
  await assert.rejects(assertDeniedWorkspace({...denialFixture(settings),section:'inventory',origin:'http://127.0.0.1:3220',expect:fakeExpect,assertUi:async(_id,fn)=>fn()}));
 }
 await assert.rejects(assertDeniedWorkspace({...denialFixture(),section:'inventory',origin:'https://synthetic.invalid',expect:fakeExpect,assertUi:async(_id,fn)=>fn()}),/TARGET_REJECTED/);
});




test('manual stock API action rejects fresh STAFF/cashier role and inactive user inside transaction (no DB)',()=>{
 const source={};for(const key of ['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','TEMP','TMP'])if(process.env[key])source[key]=process.env[key];
 execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./inventory-write-auth-fixture.ts',import.meta.url))],{
  cwd:fileURLToPath(new URL('../',import.meta.url)),env:{...source,NODE_ENV:'test',SPACARE_ENV:'test',SPACARE_TARGET_DATABASE:'spacare_test',MONGODB_URI:'mongodb://127.0.0.1:1/spacare_test'},stdio:'pipe',windowsHide:true,shell:false,timeout:15000
 });
});

