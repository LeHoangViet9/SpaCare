import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import assert from 'node:assert/strict';
import ValidatedForm from '../src/components/validated-form';
import GroupedCartLines from '../src/components/grouped-cart-lines';
for (const items of [[], [{_id:'a',name:'Nano'}], [{_id:'a',name:'Nano',cartId:'1',performerId:'KTV A',recipientName:'Chủ gói'},{_id:'a',name:'Nano',cartId:'2',performerId:'KTV B',recipientName:'Chồng'}]]) {
  const html=renderToStaticMarkup(<ValidatedForm><GroupedCartLines items={items} label="Lượt dùng gói" renderItem={item=><label>{item.name}<input name={item.cartId || item._id} defaultValue={item.performerId || ''} required/></label>}/></ValidatedForm>);
  assert.equal((html.match(/<input/g)||[]).length,items.length);
  if(items.length===2){assert.ok(html.includes('Nano ×2'));assert.ok(html.includes('KTV A'));assert.ok(html.includes('KTV B'));assert.ok(!html.includes('Chồng'));assert.ok(!html.includes('Chủ gói'));}
}
console.log('PASS: populated and empty grouped carts render inside ValidatedForm');
