import {build,stop} from 'esbuild';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
// FormModal is exported by workspace, whose Next client imports expect build-time env substitution.
// Use an empty environment rather than exposing the host environment to the browser bundle.
const bundle=await build({entryPoints:['tests/leave-ui-fixture.tsx'],bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"','process.env':'{}'},tsconfig:'tsconfig.json'});
// The bundle is complete; release esbuild's child process before serving it.
await stop();
const css=await Promise.all(['ui','globals','public'].map(name=>readFile('src/app/'+name+'.css','utf8')));
createServer((req,res)=>{
 if(req.url==='/fixture.js'){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(bundle.outputFiles[0].text);return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SpaCare leave responsive fixture</title><style>'+css.join('\n')+'</style><div id="root"></div><script src="/fixture.js"></script></html>');
}).listen(3231,'127.0.0.1',()=>console.log('Leave UI fixture on 127.0.0.1:3231; in-memory only, no database'));
