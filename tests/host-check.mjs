import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const built=await build({entryPoints:[fileURLToPath(new URL('host-fixture.mjs',import.meta.url))],bundle:true,write:false,format:'esm',platform:'browser'});
const js=built.outputFiles[0].text;
const post=async(name,args)=>{const r=await fetch('http://127.0.0.1:43124/api/tool',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,arguments:args})});return r.json();};
const demo=await readFile(new URL('../assets/studio-companion.glb',import.meta.url));const upload=(await post('studio.upload_begin',{name:'studio-companion.glb',size:demo.length})).structuredContent;
for(let offset=0;offset<demo.length;offset+=upload.chunkBytes)await post('studio.upload_append',{uploadId:upload.uploadId,offset,base64:demo.subarray(offset,offset+upload.chunkBytes).toString('base64')});
const initialAsset=(await post('studio.upload_finish',{uploadId:upload.uploadId})).structuredContent.asset;
const html=`<!doctype html><html><body style="margin:0"><iframe style="width:100vw;height:100vh;border:0"></iframe><script>window.initialAsset=${JSON.stringify(initialAsset)}</script><script type="module" src="/host.js"></script></body></html>`;
const server=createServer(async(req,res)=>{
  try{if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(html);}else if(req.url==='/host.js'){res.setHeader('Content-Type','text/javascript');res.end(js);}else if(req.url==='/viewer'){res.setHeader('Content-Type','text/html');res.end(await readFile(new URL('../dist/viewer.html',import.meta.url)));}else if(req.url==='/api/tool'){const chunks=[];for await(const c of req)chunks.push(c);const response=await fetch('http://127.0.0.1:43124/api/tool',{method:'POST',headers:{'Content-Type':'application/json'},body:Buffer.concat(chunks)});res.setHeader('Content-Type','application/json');res.end(await response.text());}else{res.writeHead(204);res.end();}}catch(e){res.writeHead(500);res.end(e.message);}
});
await new Promise(resolve=>server.listen(43125,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1440,height:1040}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:43125');await page.waitForFunction(()=>window.hostReady);
 const frame=page.frameLocator('iframe');
 await frame.locator('#filename').filter({hasText:'studio-companion.glb'}).waitFor();assert.equal(await frame.locator('#toast').isVisible(),false);
 await frame.locator('#file').setInputFiles(fileURLToPath(new URL('../assets/studio-companion.glb',import.meta.url)));
 await frame.locator('#filename').filter({hasText:'studio-companion.glb'}).waitFor();
 await frame.locator('.object-row').filter({hasText:'Helmet'}).click();
 await page.waitForFunction(()=>window.contextUpdates.some(x=>x.structuredContent?.selection?.name==='Helmet'));
 assert.equal(await frame.locator('#ask,#instruction,#export-request,#request-dialog').count(),0);
 await frame.locator('[data-mode=pbr]').click();
 await page.waitForFunction(()=>window.contextUpdates.some(x=>x.structuredContent?.selection?.name==='Helmet'&&x.structuredContent.renderMode==='pbr'));
 assert.equal(await page.evaluate(()=>window.messages.length),0);
 assert.deepEqual(errors,[]);await writeFile(new URL('host-result.json',import.meta.url),JSON.stringify({passed:true,selection:'Helmet',contextUpdates:await page.evaluate(()=>window.contextUpdates.length)},null,2));
 console.log('Host checks passed: official AppBridge connection, tool transfer, selected-object model context and host chat context without a duplicate request form.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
