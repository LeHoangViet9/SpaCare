import test from 'node:test';
import assert from 'node:assert/strict';
import { tsImport } from 'tsx/esm/api';
const { cardPayment, ensureCardService, cashCardInputs } = await tsImport('../src/lib/cash-card-rules.ts',import.meta.url);
const { CashCard, CashCardUse, Invoice, CashEntry } = await tsImport('../src/lib/models.ts',import.meta.url);
const { packageSaleInput } = await tsImport('../src/lib/package-input.ts',import.meta.url);
const { readCashCards, readCashCardList, cashCardListQuery } = await tsImport('../src/lib/cash-card-read.ts',import.meta.url);
const id='a'.repeat(24);
test('cash card money: 800k less 400k, split payment, insufficient balance and overpayment',()=>{
  assert.deepEqual(cardPayment(800000,400000,400000),{balance:400000,settled:400000});
  assert.deepEqual(cardPayment(200000,400000,200000,200000),{balance:0,settled:400000});
  for(const args of [[0,1,1],[200000,400000,200001],[800000,400000,400000,1],[800000,0,1],[800000,400000,0],[800000,400000,1.5],[800000,400000,1,-1]]) assert.throws(()=>cardPayment(...args));
});
test('cash card cannot pay for packages, gifts, products, sessions or ambiguous linked package invoices',()=>{
  assert.doesNotThrow(()=>ensureCardService({kind:'SERVICE',serviceId:id}));
  assert.doesNotThrow(()=>ensureCardService({serviceId:id}));
  for(const invoice of [{},...['PACKAGE','GIFT','PRODUCT','SESSION'].map(kind=>({kind,serviceId:id})),{kind:'SERVICE',serviceId:id,treatmentId:id},{kind:'SERVICE',serviceId:id,treatmentUseId:id},{kind:'SERVICE',serviceId:id,productId:id},{kind:'SERVICE',serviceId:id,giftOfInvoiceId:id}])assert.throws(()=>ensureCardService(invoice));
});
test('paid card requires explicit receipt confirmation; mixed payment requires confirmation only for cash portion',()=>{
  const sale={customerId:id,amount:800000,method:'CASH',receivedConfirmation:true};
  assert.ok(cashCardInputs.sellCashCard.safeParse(sale).success);
  assert.equal(cashCardInputs.sellCashCard.safeParse({...sale,receivedConfirmation:false}).success,false);
  for(const amount of [0,-1,1.5,1_000_000_000_001])assert.equal(cashCardInputs.sellCashCard.safeParse({...sale,amount}).success,false);
  const use={cardId:id,invoiceId:id,amount:200000,additionalAmount:200000};
  assert.equal(cashCardInputs.redeemCashCard.safeParse(use).success,false);
  assert.ok(cashCardInputs.redeemCashCard.safeParse({...use,method:'BANK_TRANSFER',receivedConfirmation:true}).success);
  assert.ok(cashCardInputs.redeemCashCard.safeParse({...use,additionalAmount:0}).success);
});
test('gift card on package needs promotion and cannot submit negative or fractional gift value',()=>{
  const sale={customerId:id,templateId:id,dueDate:'2026-10-24',giftCashCardAmount:800000};
  assert.equal(packageSaleInput.safeParse(sale).success,false);
  assert.ok(packageSaleInput.safeParse({...sale,promotion:'Mua gói tặng thẻ'}).success);
  for(const amount of [-1,0.5,1_000_000_000_001])assert.equal(packageSaleInput.safeParse({...sale,promotion:'Gift',giftCashCardAmount:amount}).success,false);
});
test('card schema preserves origin and immutable ledger snapshots without expiration or refund fields',async()=>{
  const card=new CashCard({spaId:id,customerId:id,amount:800000,balance:400000,origin:'GIFT',sourceInvoiceId:id,actorId:id});
  await card.validate();
  await new CashCardUse({spaId:id,cardId:id,customerId:id,invoiceId:id,amount:400000,balanceBefore:800000,balanceAfter:400000,actorId:id}).validate();
  assert.equal(CashCard.schema.path('expiresAt'),undefined);
  assert.ok(CashEntry.schema.path('kind').enumValues.includes('CARD_SALE'));
  assert.ok(Invoice.schema.path('cardPaid'));
});
test('CUSTOMER/MANAGER and ordinary staff without assigned invoice cannot list cards',async()=>{
  for(const role of ['CUSTOMER','MANAGER'])await assert.rejects(readCashCards({id,spaId:id,role,cashier:true},{customerId:id,page:1,usePage:1}),e=>e.status===403);
  await assert.rejects(readCashCards({id,spaId:id,role:'STAFF',cashier:false},{customerId:id,page:1,usePage:1}),e=>e.status===403);
});

test('all-customer card list is owner/cashier only and filters and pages within authenticated spa', async t=>{
 const owner={id,spaId:'b'.repeat(24),role:'OWNER',cashier:false};
 for(const user of [{...owner,role:'STAFF'},{...owner,role:'CUSTOMER',cashier:true},{...owner,role:'MANAGER',cashier:true}])await assert.rejects(readCashCardList(user,cashCardListQuery.parse({})),e=>e.status===403);
 const {Customer}=await tsImport('../src/lib/models.ts',import.meta.url);
 let offset=-1,scope;
 const query=value=>({select(){return this;},sort(){return this;},skip(n){offset=n;return this;},limit(n){assert.equal(n,10);return this;},lean:async()=>value});
 t.mock.method(Customer,'find',filter=>{
  assert.equal(filter.spaId,owner.spaId);
  if(filter.$or){assert.equal(filter.$or[0].name.$regex,'\\.\\*');return {distinct:async()=>[id]};}
  assert.deepEqual(filter._id.$in,[id]);return query([{_id:id,name:'Khách thử',phone:'0900000000'}]);
 });
 t.mock.method(CashCard,'countDocuments',async filter=>{scope=filter;return 11;});
 t.mock.method(CashCard,'find',filter=>{assert.deepEqual(filter,scope);return query([{_id:'c'.repeat(24),customerId:id,amount:800000,balance:400000,origin:'GIFT'}]);});
 const result=await readCashCardList(owner,cashCardListQuery.parse({search:'.*',status:'AVAILABLE',origin:'GIFT',page:2,spaId:'foreign'}));
 assert.deepEqual(scope.$and[0],{spaId:owner.spaId});assert.deepEqual(scope.$and[1],{balance:{$gt:0}});assert.deepEqual(scope.$and[2],{origin:'GIFT'});
 assert.equal(result.cards[0].customerName,'Khách thử');assert.equal(result.page,2);assert.equal(result.total,11);assert.equal(offset,10);
 for(const value of [{status:'PAUSED'},{origin:'ANY'},{page:0}])assert.equal(cashCardListQuery.safeParse(value).success,false);
});

test('selected card details filter the card and ledger by card, customer and spa',async t=>{
 const {Customer}=await tsImport('../src/lib/models.ts',import.meta.url);
 const owner={id,spaId:'b'.repeat(24),role:'OWNER',cashier:false};const cardId='c'.repeat(24);
 const query=value=>({select(){return this;},sort(){return this;},skip(){return this;},limit(){return this;},lean:async()=>value});
 t.mock.method(Customer,'exists',async filter=>{assert.deepEqual(filter,{spaId:owner.spaId,_id:id});return {_id:id};});
 t.mock.method(CashCard,'countDocuments',async filter=>{assert.deepEqual(filter,{spaId:owner.spaId,customerId:id,_id:cardId});return 1;});
 t.mock.method(CashCard,'find',()=>query([{_id:cardId}]));
 t.mock.method(CashCardUse,'countDocuments',async filter=>{assert.deepEqual(filter,{spaId:owner.spaId,customerId:id,cardId});return 0;});
 t.mock.method(CashCardUse,'find',()=>query([]));
 const result=await readCashCards(owner,{customerId:id,cardId,page:1,usePage:1});assert.equal(result.cards[0]._id,cardId);assert.equal(result.uses.length,0);
});
