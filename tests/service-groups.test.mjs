import test from 'node:test';
import assert from 'node:assert/strict';
import {tsImport} from 'tsx/esm/api';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const {serviceGroupKey,serviceGroupNames,selectableServices}=await tsImport('../src/lib/service-groups.ts',import.meta.url);
test('service groups normalize case/Unicode/spacing for duplicate detection without changing legacy category values',()=>{
 assert.equal(serviceGroupKey('  Chăm   sóc DA  '),'chăm sóc da');assert.equal(serviceGroupKey('Chăm sóc da'.normalize('NFD')),serviceGroupKey('Chăm sóc da'));
 assert.deepEqual(serviceGroupNames([{name:'Massage'}],[{category:'TRIỆT LÔNG'}],'Nhóm cũ'),['Massage','Nhóm cũ','TRIỆT LÔNG']);
 assert.deepEqual(selectableServices([{_id:'1',active:true},{_id:'2',active:false}]).map(s=>s._id),['1']);
});
test('service and package forms render saved groups, available services and explicit empty-catalog guidance',()=>{
 execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./service-groups-fixture.tsx',import.meta.url))],{env:{...process.env,MONGODB_URI:''},stdio:'pipe',timeout:15000});
});
