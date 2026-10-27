import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { plan, runPlan } from '../src/lib/preview-seed';
let connections=0;
mongoose.connect=async()=>{connections++;throw new Error('NO_DATABASE_ALLOWED');};
const {schemas}=await import('../src/lib/operations');
let sequence=0;
await runPlan(plan('2026-10-27'),'synthetic-offline-password',async()=>{const id=(++sequence).toString(16).padStart(24,'0');return {id,invoiceId:id};},(action,data)=>schemas[action as keyof typeof schemas].parse(data));
assert.equal(connections,0);
