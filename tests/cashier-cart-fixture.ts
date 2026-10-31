import assert from 'node:assert/strict';
import {toggleCartItem,cashierActions,addServiceItem,removeServiceItem,updateServiceItemPerformers} from '../src/lib/cashier-cart';
let products:any[]=[];
products=toggleCartItem(products,{_id:'p1',price:10},{unitPrice:'10',quantity:'2'});
products=toggleCartItem(products,{_id:'p2',price:20},{unitPrice:'20',quantity:'1'});
assert.equal(products.length,2);
assert.equal(toggleCartItem(products,{_id:'p1'}).length,1);
assert.throws(()=>toggleCartItem(Array.from({length:30},(_,i)=>({_id:String(i)})),{_id:'new'}),/30/);

// addServiceItem tests
let services:any[]=[];
services=addServiceItem(services,{_id:'s1',name:'Chăm sóc da',price:200000});
assert.equal(services.length,1);
assert.ok(services[0].lineId);
assert.deepEqual(services[0].performerIds,[]);
assert.equal(services[0].total,'200000');

// Adding same service again should append a new line with different lineId
services=addServiceItem(services,{_id:'s1',name:'Chăm sóc da',price:200000});
assert.equal(services.length,2);
assert.equal(services[0]._id,services[1]._id);
assert.notEqual(services[0].lineId,services[1].lineId);

// updateServiceItemPerformers tests
const firstLineId=services[0].lineId;
const secondLineId=services[1].lineId;
services=updateServiceItemPerformers(services,firstLineId,['staff-1','staff-2']);
assert.deepEqual(services[0].performerIds,['staff-1','staff-2']);
assert.deepEqual(services[1].performerIds,[]);

// removeServiceItem tests
services=removeServiceItem(services,firstLineId);
assert.equal(services.length,1);
assert.equal(services[0].lineId,secondLineId);

// limit 30 items
assert.throws(()=>addServiceItem(Array.from({length:30},(_,i)=>({_id:String(i),price:100})),{_id:'s-max',price:100}),/30/);

const packages=[{_id:'g1',total:'500',startsOn:'2026-10-25',gifts:[]},{_id:'g2',total:'600',startsOn:'2026-10-25',gifts:[]}];
const base={customerId:'c',services:[],sessions:[],products,packages,staffId:'s',participantIds:['s'],dueDate:'2026-10-25'};
const actions=cashierActions(base);
assert.deepEqual(actions.map(row=>row.action),['productInvoice','sellPackage','sellPackage']);
assert.equal(actions[0].data.items.length,2);
assert.ok(actions.every(row=>row.data.customerId==='c'));
const mixed=cashierActions({...base,services:[{_id:'s1',total:'100'}],sessions:[{_id:'t1',serviceId:'s1',remaining:3}]});
assert.equal(mixed[0].action,'invoice');assert.equal(mixed[0].data.additionalProducts.length,2);
assert.equal(mixed[0].data.additionalServices.length,1);assert.equal(mixed[0].data.treatments[0].remainingBefore,3);
assert.equal(mixed[0].data.signature,undefined,'signature remains optional');
assert.equal(cashierActions({...base,services:[{_id:'s1',total:'100'}]})[0].action,'serviceInvoice');
const optionalPerformers=cashierActions({...base,staffId:'',services:[{_id:'s1',total:'100',performerId:'a'},{_id:'s2',total:'200'}],sessions:[],products:[],packages:[]})[0];
assert.equal(optionalPerformers.data.staffId,undefined);
assert.equal(optionalPerformers.data.items[0].performerId,'a');
assert.equal(optionalPerformers.data.items[1].performerId,undefined);

// performerIds mapping to single performerId in cashierActions
const multiPerformerService=cashierActions({...base,staffId:'',services:[{_id:'s1',total:'100',performerIds:['staff-a','staff-b']},{_id:'s2',total:'200',performerIds:[]}],sessions:[],products:[],packages:[]})[0];
assert.equal(multiPerformerService.data.items[0].performerId,'staff-a');
assert.equal(multiPerformerService.data.items[1].performerId,undefined);

const optionalSession=cashierActions({...base,staffId:'',services:[{_id:'s2',total:'200'}],sessions:[{_id:'t1',serviceId:'s1',remaining:3,performerId:'b'}],products:[],packages:[]})[0];
assert.equal(optionalSession.data.staffId,undefined);
assert.equal(optionalSession.data.treatments[0].performerId,'b');
assert.equal(optionalSession.data.additionalServices[0].performerId,undefined);
assert.throws(()=>cashierActions({...base,products:[],packages:[]}),/ít nhất/);
