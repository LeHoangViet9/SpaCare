import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { Readable } from 'node:stream';
import mongoose from 'mongoose';
import { Product, Spa, Session, User } from '../src/lib/models';
import { storedProductImageId, publicProductImageUrl } from '../src/lib/product-image';
import { internalProductImageUrl } from '../src/lib/product-image';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ProductImagePicker from '../src/components/product-image-picker';

const id = (digit: string) => digit.repeat(24);
const spaA = id('a'), spaB = id('b'), productA = id('1'), productB = id('2');
const imageA = id('3'), imageB = id('4'), unusedImage = id('5'), badImage = id('6');
const data = Buffer.from('Synthetic image bytes');
let authenticated = false, active = true, role = 'OWNER';
mock.module('next/headers', { namedExports: { cookies: async () => ({ get: () => authenticated ? {value:'synthetic-session'} : undefined }) } });
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/spacare_test';
(mongoose.connection as any).readyState = 1;
(mongoose as any).connect = () => assert.fail('No real database connections');
(Session as any).findOne = async () => ({ userId:id('7'), spaId:spaA });
(User as any).findOne = async (filter: any) => active && filter.spaId === spaA && filter.active === true
  ? { _id:id('7'), spaId:spaA, role, name:'Synthetic account', active, cashier:false } : null;
const spas: any[] = [
  {_id:spaA,slug:'spa-a',active:true,publicEnabled:true},
  {_id:spaB,slug:'spa-b',active:true,publicEnabled:true},
  {_id:id('c'),slug:'hidden',active:true,publicEnabled:false},
  {_id:id('d'),slug:'inactive',active:false,publicEnabled:true},
  {_id:id('e'),slug:'legacy'},
];
const products: any[] = [
  {_id:productA,spaId:spaA,active:true,imageUrl:`/api/product-images/${imageA}`},
  {_id:productB,spaId:spaB,active:true,imageUrl:`/api/product-images/${imageB}`},
];
const files: any[] = [
  {_id:imageA,metadata:{spaId:spaA,kind:'PRODUCT_IMAGE',contentType:'image/jpeg'},length:data.length},
  {_id:imageB,metadata:{spaId:spaB,kind:'PRODUCT_IMAGE',contentType:'image/png'},length:data.length},
  {_id:unusedImage,metadata:{spaId:spaA,kind:'PRODUCT_IMAGE',contentType:'image/webp'},length:data.length},
  {_id:badImage,metadata:{spaId:spaA,kind:'PRODUCT_IMAGE',contentType:'text/html'},length:data.length},
];
let productReads = 0, bucketReads = 0, downloads = 0;
const matches = (row: any, filter: any) => Object.entries(filter).every(([key,value]) => String(key.split('.').reduce((obj,part)=>obj?.[part],row)) === String(value));
const query = (read: () => any): any => ({select(){return this;},limit(){return this;},async lean(){return read();}});
(Spa as any).find = (filter:any) => query(() => spas.filter(spa => matches(spa,filter)));
(Product as any).findOne = (filter:any) => { productReads++; return query(() => products.find(product=>matches(product,filter)) || null); };
class Bucket {
  find(filter:any) { bucketReads++; return {next:async()=>files.find(file=>matches(file,filter)) || null}; }
  openDownloadStream(imageId:any) { downloads++; assert.ok(files.some(file=>file._id===String(imageId))); return Readable.from([data]); }
}
Object.defineProperty(mongoose.mongo,'GridFSBucket',{configurable:true,value:Bucket});
const publicGet = (await import('../src/app/api/s/[slug]/products/[productId]/image/route')).GET;
const internalGet = (await import('../src/app/api/product-images/[id]/route')).GET;
const versionedGet = (await import('../src/app/api/product-images/v2/[id]/route')).GET;
const validators = { 'If-None-Match':'"previously-cached-image"', 'If-Modified-Since':'Wed, 01 Jan 2098 00:00:00 GMT' };
const publicRequest = (slug='spa-a',productId=productA,query='') => publicGet(new Request('https://example.test/api/s/'+slug+'/products/'+productId+'/image'+query, {headers:validators}), {params:Promise.resolve({slug,productId})});
const internalRequest = (imageId=imageA,query='') => internalGet(new Request('https://example.test/api/product-images/'+imageId+query), {params:Promise.resolve({id:imageId})});
const versionedRequest = (imageId=imageA) => versionedGet(new Request('https://example.test/api/product-images/v2/'+imageId,{headers:validators}), {params:Promise.resolve({id:imageId})});
function expectCachePolicy(response: Response) {
  assert.equal(response.headers.get('Cache-Control'),'private, no-store, max-age=0');
  assert.equal(response.headers.get('CDN-Cache-Control'),'no-store');
  assert.equal(response.headers.get('Vercel-CDN-Cache-Control'),'no-store');
  assert.equal(response.headers.get('ETag'),null);
  assert.equal(response.headers.get('Last-Modified'),null);
}
async function expectImage(response: Response) {
  assert.equal(response.status,200);
  expectCachePolicy(response);
  assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),data);
}
async function expectDenied(promise: Promise<Response>, status=404) {
  const before = downloads;
  const response = await promise;
  assert.equal(response.status,status); expectCachePolicy(response);
  assert.equal(downloads,before,'rejection cannot open a download stream');
}

await expectImage(await publicRequest());
await expectImage(await publicRequest('spa-b',productB));
await expectImage(await publicRequest('spa-a',productA,`?spaId=${spaB}&productId=${productB}&url=https://example.test/api/product-images/${imageB}`));
await expectDenied(publicRequest('spa-a',productB));
await expectDenied(publicRequest('spa-a',imageA));
await expectDenied(publicRequest('spa-b',productA));
await expectDenied(publicRequest('spa-a','invalid'));
for (const slug of ['missing','hidden','inactive','legacy','Bad Slug']) {
  const before = productReads;
  await expectDenied(publicRequest(slug));
  assert.equal(productReads,before);
}
const savedUrl = products[0].imageUrl;
for (const url of [
  `/api/product-images/${imageB}`,
  `https://example.test/api/product-images/${imageB}`,
  `https://example.test/api/product-images/${imageA}`,
  `//example.test/api/product-images/${imageB}`,
  'https://external.invalid/photo.jpg',
  `data:image/svg+xml,<svg/>`,
  `/api/product-images/${imageA}?spaId=${spaB}`,
  `/api/product-images/${badImage}`, '',
]) {
  products[0].imageUrl=url;
  const readsBefore=bucketReads;
  await expectDenied(publicRequest());
  if (!storedProductImageId(url)) assert.equal(bucketReads,readsBefore,'untrusted URLs are never fetched or redirected');
}
products[0].imageUrl=savedUrl;
products[0].active=false; await expectDenied(publicRequest()); products[0].active=true;
spas[0].publicEnabled=false; await expectDenied(publicRequest()); spas[0].publicEnabled=true;
await expectDenied(internalRequest(),401);
authenticated=true;
await expectImage(await internalRequest());
await expectImage(await internalRequest(unusedImage));
products[0].active=false; spas[0].publicEnabled=false;
await expectImage(await internalRequest());
await expectDenied(publicRequest()); // A session cookie cannot bypass public checks.
products[0].active=true; spas[0].publicEnabled=true;
role='STAFF'; await expectImage(await internalRequest());
await expectDenied(internalRequest(imageB,`?spaId=${spaB}`));
await expectDenied(internalRequest(badImage));
role='CUSTOMER'; await expectDenied(internalRequest(),403);
role='OWNER'; active=false; await expectDenied(internalRequest(),401); active=true;
files[0].metadata.kind='OTHER'; await expectDenied(publicRequest()); files[0].metadata.kind='PRODUCT_IMAGE';
files[0].metadata.spaId=spaB; await expectDenied(publicRequest()); await expectDenied(internalRequest());
files[0].metadata.spaId=spaA;
await expectImage(await versionedRequest());
await expectImage(await versionedRequest(unusedImage));
await expectDenied(versionedRequest(imageB));
authenticated=false; await expectDenied(versionedRequest(),401); authenticated=true;
role='STAFF'; await expectImage(await versionedRequest());
role='CUSTOMER'; await expectDenied(versionedRequest(),403); role='OWNER';
active=false; await expectDenied(versionedRequest(),401); active=true;
const realProductFind = Product.findOne;
(Product as any).findOne = () => { throw new Error('Synthetic image-read failure'); };
await expectDenied(publicRequest(),500);
(Product as any).findOne = realProductFind;
assert.equal(storedProductImageId(savedUrl),imageA);
assert.equal(publicProductImageUrl('spa-a',productA,savedUrl),`/api/s/spa-a/products/${productA}/image`);
assert.equal(publicProductImageUrl('spa-a',productA,'https://external.invalid/photo.jpg'),null);
assert.equal(internalProductImageUrl(savedUrl),`/api/product-images/v2/${imageA}`);
assert.equal(storedProductImageId(internalProductImageUrl(savedUrl)),null,'the display version is not persisted as a canonical upload reference');
const picker = renderToStaticMarkup(React.createElement(ProductImagePicker,{name:'imageUrl',initialValue:savedUrl,disabled:false,onBusyChange:()=>{}}));
assert.ok(picker.includes(`src="/api/product-images/v2/${imageA}"`));
assert.ok(picker.includes(`value="${savedUrl}"`),'the form keeps the original database reference');
console.log('Public A/B product image ownership, unsafe absolute URLs, publication changes and authenticated internal previews verified.');
