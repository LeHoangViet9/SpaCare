import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const bundle=await build({entryPoints:['tests/input-ui-fixture.tsx'],bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},alias:{'next/navigation':resolve('tests/input-ui-navigation.tsx'),'next/link':resolve('tests/input-ui-link.tsx')},tsconfig:'tsconfig.json'});
const css=await Promise.all(['ui','globals','public'].map(name=>readFile('src/app/'+name+'.css','utf8')));
const server=createServer((req,res)=>{
 if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(bundle.outputFiles[0].text);return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="vi"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SpaCare input regression fixture</title><style>'+css.join('\n')+'</style><div id="root"></div><script src="/fixture.js"></script></html>');
});
server.listen(3219,'127.0.0.1',()=>console.log('UI fixture http://127.0.0.1:3219/workspace/packages (in-memory only)'));
