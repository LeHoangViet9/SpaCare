import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const result=await build({entryPoints:['tests/cash-card-manager-fixture.tsx'],bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},alias:{'next/navigation':resolve('tests/cash-card-manager-navigation.tsx')},tsconfig:'tsconfig.json'});
const css=await Promise.all(['ui','globals','public'].map(n=>readFile('src/app/'+n+'.css','utf8')));
createServer((req,res)=>{if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript');res.end(result.outputFiles[0].text);return;}res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="vi"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css.join('\n')+'</style><div id="root"></div><script src="/fixture.js"></script></html>');}).listen(3330,'127.0.0.1',()=>console.log('Cash card manager fake UI: http://127.0.0.1:3330. No database.'));
