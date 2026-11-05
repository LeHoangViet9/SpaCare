import assert from 'node:assert/strict';
import {toggleCartItem,cashierActions,addServiceItem,removeServiceItem,updateServiceItemPerformers,addPackageItem,removePackageItem} from '../src/lib/cashier-cart';
let products:any[]=[];
products=toggleCartItem(products,{_id:'p1',price:10},{unitPrice:'10',quantity:'2'});
products=toggleCartItem(products,{_id:'p2',price:20},{unitPrice:'20',quantity:'1'});
assert.equal(products.length,2);
assert.equal(toggleCartItem(products,{_id:'p1'}).length,1);
assert.throws(()=>toggleCartItem(Array.from({length:30},(_,i)=>({_id:String(i)})),{_id:'new'}),/30/);

// addPackageItem & removePackageItem tests
let packageCart:any[]=[];
packageCart=addPackageItem(packageCart,{_id:'t1',name:'Gói 1',price:1000000,packageType:'SESSIONS',totalSessions:10});
assert.equal(packageCart.length,1);
assert.ok(packageCart[0].cartId);
assert.equal(packageCart[0].total,'1000000');
// Adding same template again creates a distinct line with different cartId
packageCart=addPackageItem(packageCart,{_id:'t1',name:'Gói 1',price:1000000,packageType:'SESSIONS',totalSessions:10});
assert.equal(packageCart.length,2);
assert.equal(packageCart[0]._id,packageCart[1]._id);
assert.notEqual(packageCart[0].cartId,packageCart[1].cartId);
const firstCartId=packageCart[0].cartId;
packageCart=removePackageItem(packageCart,firstCartId);
assert.equal(packageCart.length,1);
assert.notEqual(packageCart[0].cartId,firstCartId);

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
const mixed=cashierActions({...base,services:[{_id:'s1',total:'100',performerId:'s'}],sessions:[{_id:'t1',serviceId:'s1',remaining:3,performerId:'s'}]});
assert.equal(mixed[0].action,'invoice');assert.equal(mixed[0].data.additionalProducts.length,2);
assert.equal(mixed[0].data.additionalServices.length,1);assert.equal(mixed[0].data.treatments[0].remainingBefore,3);
assert.equal(mixed[0].data.signature,undefined,'signature remains optional');
assert.equal(cashierActions({...base,services:[{_id:'s1',total:'100',performerId:'s'}]})[0].action,'serviceInvoice');
assert.throws(()=>cashierActions({...base,services:[{_id:'s1',name:'Massage',total:'100',performerId:'a'},{_id:'s1',name:'Massage',total:'100'}]}),/dòng dịch vụ 2 \(Massage\)/);
assert.throws(()=>cashierActions({...base,sessions:[{_id:'t1',name:'Gói Massage',remaining:3}]}),/lượt dùng gói 1 \(Gói Massage\)/);
const optionalPerformers=cashierActions({...base,staffId:'',services:[{_id:'s1',total:'100',performerId:'a'},{_id:'s2',total:'200',performerId:'b'}],sessions:[],products:[],packages:[]})[0];
assert.equal(optionalPerformers.data.staffId,undefined);
assert.equal(optionalPerformers.data.items[0].performerId,'a');
assert.equal(optionalPerformers.data.items[1].performerId,'b');

// performerIds mapping to single performerId in cashierActions
const multiPerformerService=cashierActions({...base,staffId:'',services:[{_id:'s1',total:'100',performerIds:['staff-a','staff-b']},{_id:'s2',total:'200',performerIds:['staff-b']}],sessions:[],products:[],packages:[]})[0];
assert.equal(multiPerformerService.data.items[0].performerId,'staff-a');
assert.equal(multiPerformerService.data.items[1].performerId,'staff-b');

const optionalSession=cashierActions({...base,staffId:'',services:[{_id:'s2',total:'200',performerId:'a'}],sessions:[{_id:'t1',serviceId:'s1',remaining:3,performerId:'b'}],products:[],packages:[]})[0];
assert.equal(optionalSession.data.staffId,undefined);
assert.equal(optionalSession.data.treatments[0].performerId,'b');
assert.equal(optionalSession.data.additionalServices[0].performerId,'a');
assert.throws(()=>cashierActions({...base,products:[],packages:[]}),/ít nhất/);

const noDeadline = cashierActions({...base,dueDate:''}).filter(row=>row.action==='sellPackage');
assert.ok(noDeadline.length>0);
assert.ok(noDeadline.every(row=>!Object.hasOwn(row.data,'dueDate')));

// Cart identities and payload order preserve repeated service occurrences independently.
let repeated:any[]=[];
for(let index=0;index<3;index++)repeated=addServiceItem(repeated,{_id:'same-massage',name:'Massage',price:350000});
const occurrenceIds=repeated.map(item=>item.lineId);
assert.equal(new Set(occurrenceIds).size,3);
repeated=updateServiceItemPerformers(repeated,occurrenceIds[0],['tech-a']);
repeated=updateServiceItemPerformers(repeated,occurrenceIds[1],['tech-a']);
repeated=updateServiceItemPerformers(repeated,occurrenceIds[2],['tech-b']);
const repeatedInput={...base,services:repeated,sessions:[],products:[],packages:[]};
let repeatedAction=cashierActions(repeatedInput)[0];
assert.deepEqual(repeatedAction.data.items.map((row:any)=>row.performerId),['tech-a','tech-a','tech-b']);
assert.equal(repeatedAction.data.items.reduce((sum:number,row:any)=>sum+row.total,0),1050000);
repeated=removeServiceItem(repeated,occurrenceIds[1]);
assert.deepEqual(repeated.map(item=>item.lineId),[occurrenceIds[0],occurrenceIds[2]]);
repeatedAction=cashierActions({...repeatedInput,services:repeated})[0];
assert.deepEqual(repeatedAction.data.items.map((row:any)=>row.performerId),['tech-a','tech-b']);
assert.equal(repeatedAction.data.items.reduce((sum:number,row:any)=>sum+row.total,0),700000);
const repeatedMixed=cashierActions({...repeatedInput,sessions:[{_id:'plan',serviceId:'same-massage',remaining:3,performerId:'tech-b'}]})[0];
assert.equal(repeatedMixed.data.additionalServices.length,3);
assert.deepEqual(repeatedMixed.data.additionalServices.map((row:any)=>row.performerId),['tech-a','tech-a','tech-b']);
