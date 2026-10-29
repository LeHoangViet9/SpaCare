import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import mongoose from 'mongoose';

const expected='mongodb://mongo-ui:27017/spacare_ui_test?replicaSet=rs0&directConnection=true';
if(process.env.MONGODB_URI!==expected) throw new Error('BLOCKED: UI fixture requires the isolated synthetic database');
const suite='per-line-performers-ui';
for(let attempt=0;attempt<30;attempt++){
 try{await mongoose.connect(expected,{serverSelectionTimeoutMS:1000});break;}catch(error){if(attempt===29)throw error;await new Promise(r=>setTimeout(r,1000));}
}
if(mongoose.connection.db.databaseName!=='spacare_ui_test') throw new Error('BLOCKED: wrong UI database');
const fixtures=mongoose.connection.db.collection('ui_fixtures');
const submissions=mongoose.connection.db.collection('ui_submissions');
await fixtures.deleteMany({suite});await submissions.deleteMany({suite});
const ids={owner:'aaaaaaaaaaaaaaaaaaaaaaaa',staffA:'bbbbbbbbbbbbbbbbbbbbbbbb',staffB:'cccccccccccccccccccccccc',customer:'dddddddddddddddddddddddd',serviceA:'eeeeeeeeeeeeeeeeeeeeeeee',serviceB:'ffffffffffffffffffffffff',serviceC:'111111111111111111111111',treatment:'222222222222222222222222'};
const data={user:{id:ids.owner,_id:ids.owner,name:'Chủ spa QA',role:'OWNER',cashier:true},today:'2026-10-29',staff:[{_id:ids.owner,name:'Chủ spa QA',role:'OWNER',active:true},{_id:ids.staffA,name:'Nhân viên An',role:'STAFF',active:true},{_id:ids.staffB,name:'Nhân viên Bình',role:'STAFF',active:true}],customers:[{_id:ids.customer,name:'Khách synthetic UI',phone:'0900000000'}],services:[{_id:ids.serviceA,name:'Chăm sóc da QA',category:'QA',active:true,price:100000},{_id:ids.serviceB,name:'Gội đầu QA',category:'QA',active:true,price:120000},{_id:ids.serviceC,name:'Massage QA',category:'QA',active:true,price:150000}],products:[],productGroups:[],packageTemplates:[],treatments:[{_id:ids.treatment,customerId:ids.customer,serviceId:ids.serviceA,name:'Liệu trình synthetic QA',status:'ACTIVE',packageType:'SESSIONS',remaining:3,totalSessions:5,price:0}]};
await fixtures.insertOne({suite,data,createdAt:new Date()});
const bundle=await build({entryPoints:['tests/per-line-performers-ui-fixture.tsx'],bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"test"'},alias:{'next/navigation':resolve('tests/input-ui-navigation.tsx'),'next/link':resolve('tests/input-ui-link.tsx')},tsconfig:'tsconfig.json'});
const css=await Promise.all(['ui','globals','public'].map(name=>readFile('src/app/'+name+'.css','utf8')));
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://ui-fixture:3219');
  if(url.pathname==='/health'){res.writeHead(200);res.end('ok');return;}
  if(url.pathname==='/fixture.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(bundle.outputFiles[0].text);return;}
  if(url.pathname==='/fixture/data'){const row=await fixtures.findOne({suite});json(res,200,row.data);return;}
  if(url.pathname==='/api/customers'){const row=await fixtures.findOne({suite});const rows=url.searchParams.get('id')?[row.data.customers.find(c=>c._id===url.searchParams.get('id'))].filter(Boolean):row.data.customers;json(res,200,{customers:rows,total:rows.length,page:1});return;}
  if(url.pathname==='/api/appointments/checkout'){json(res,200,{appointments:[],hasMore:false});return;}
  if(url.pathname==='/fixture/submissions' && req.method==='POST'){let raw='';for await(const chunk of req)raw+=chunk;if(raw.length>100000)throw new Error('payload too large');const payload=JSON.parse(raw);const submission={suite,action:payload.action,values:payload.values,createdAt:new Date()};await submissions.insertOne(submission);json(res,200,{submission:{action:submission.action,values:submission.values}});return;}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end('<!doctype html><html lang="vi"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SpaCare per-line UI QA</title><style>'+css.join('\n')+'</style><div id="root"></div><script src="/fixture.js"></script></html>');
 }catch{json(res,500,{error:'Synthetic UI fixture failed'});}
});
server.listen(3219,'0.0.0.0',()=>console.log('Synthetic UI fixture ready'));
async function cleanup(){await submissions.deleteMany({suite});await fixtures.deleteMany({suite});await mongoose.disconnect();server.close(()=>process.exit(0));}
process.once('SIGTERM',()=>void cleanup());process.once('SIGINT',()=>void cleanup());
