import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const bundle=await build({entryPoints:['tests/invoice-replacement-ui-fixture.tsx'],bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"test"'},tsconfig:'tsconfig.json'});
const css=await readFile('src/app/ui.css','utf8');
const server=createServer((request,response)=>{
 if(request.url==='/fixture.js'){response.writeHead(200,{'Content-Type':'text/javascript'});response.end(bundle.outputFiles[0].text);return;}
 response.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});response.end('<!doctype html><html lang="vi"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><div id="root"></div><script src="/fixture.js"></script></html>');
});
server.listen(3221,'127.0.0.1');process.once('SIGTERM',()=>server.close());
