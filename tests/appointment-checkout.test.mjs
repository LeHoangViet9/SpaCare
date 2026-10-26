import test from 'node:test';
import assert from 'node:assert/strict';
import {coversVisit,scheduledItems} from '../src/lib/appointment-checkout.ts';

test('checkout matches standalone services and purchased treatments independently, including legacy visits',()=>{
 assert.deepEqual(scheduledItems({serviceId:'hair',treatmentId:'plan'}),{services:[],treatments:['plan']});
 const mixed={serviceIds:['wash','mask'],treatmentIds:['plan1','plan2'],requestedServices:[{serviceId:'ignored'}]};
 assert.equal(coversVisit(mixed,['wash','mask'],['plan1','plan2']),true);
 assert.equal(coversVisit(mixed,['wash'],['plan1','plan2']),false);
 assert.equal(coversVisit(mixed,['wash','mask'],['plan1']),false);
 assert.equal(coversVisit({serviceId:'wash'},['wash'],[]),true);
 assert.equal(coversVisit({serviceId:'wash'},[],['wash']),false);
 assert.equal(coversVisit({},[],[]),false);
});
