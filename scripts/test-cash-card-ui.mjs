import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const result=await build({entryPoints:['tests/cash-card-ui-fixture.tsx'],bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},tsconfig:'tsconfig.json'});
const css=await Promise.all(['ui','globals','public'].map(n=>readFile('src/app/'+n+'.css','utf8')));
createServer((req,res)=>{if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(result.outputFiles[0].text);return;}res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="vi"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css.join('\n')+'</style><div id="root"></div><script src="/fixture.js"></script></html>');}).listen(3329,'127.0.0.1',()=>console.log('Cash card fake UI fixture: http://127.0.0.1:3329. No database.'));
