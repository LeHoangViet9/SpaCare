import test from 'node:test';
import assert from 'node:assert/strict';
import { appointmentServiceIds, appointmentServiceName } from '../src/lib/appointment-services.ts';
test('appointment service labels preserve all requested services with legacy fallback',()=>{
 const visit={serviceId:'first',requestedServices:[{serviceId:'first',name:'First'},{serviceId:'second',name:'Second'}]};
 assert.deepEqual(appointmentServiceIds(visit),['first','second']);assert.equal(appointmentServiceName(visit,'Fallback'),'First + Second');
 assert.deepEqual(appointmentServiceIds({serviceId:'old'}),['old']);assert.equal(appointmentServiceName({serviceId:'old'},'Legacy'),'Legacy');
});
