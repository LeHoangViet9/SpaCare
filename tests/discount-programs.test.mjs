import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {discountProgramInput,programActive,selectDiscountProgram,programPhase} from '../src/lib/discount-program-rules.ts';
import {spaDay} from '../src/lib/rules.ts';
const sample={_id:'a'.repeat(24),code:'GG001',name:'Ưu đãi',startsOn:'2026-11-10',endsOn:'2026-11-12',percent:10,enabled:true,updatedAt:new Date()};
test('program date bounds are inclusive in Vietnam and disabled programs never apply',()=>{
 for(const [time,expected]of [['2026-11-09T16:59:59Z',false],['2026-11-09T17:00:00Z',true],['2026-11-12T16:59:59Z',true],['2026-11-12T17:00:00Z',false]])assert.equal(programActive(sample,spaDay(new Date(time))),expected);
 assert.equal(selectDiscountProgram([{...sample,enabled:false}],'2026-11-11'),null);
 assert.throws(()=>selectDiscountProgram([sample,{...sample,_id:'b'.repeat(24)}],'2026-11-11'),/chồng lấn/);
 assert.equal(programPhase(sample,'2026-11-09'),'Sắp chạy');assert.equal(programPhase(sample,'2026-11-13'),'Đã kết thúc');
});
test('program requires name, real ordered dates, integer percentages and explicit status',()=>{
 const {_id,code,updatedAt,...input}=sample;
 for(const percent of [0,100])assert.equal(discountProgramInput.parse({...input,percent}).percent,percent);
 for(const patch of [{name:''},{name:'   '},{startsOn:'2026-02-30'},{endsOn:'2026-11-09'},{percent:-1},{percent:101},{percent:1.5},{enabled:undefined},{name:undefined}])assert.equal(discountProgramInput.safeParse({...input,...patch}).success,false);
});
test('discount program integration rules preserve snapshots, receipts, commissions and owner permissions (model doubles)',()=>{
 execFileSync(process.execPath,['--import','tsx',fileURLToPath(new URL('./discount-program-fixture.ts',import.meta.url))],{stdio:'pipe',timeout:20000});
});
