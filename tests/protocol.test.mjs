import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
const packageRoot=process.env.TEST_PACKAGE_ROOT||fileURLToPath(new URL('../',import.meta.url));

test('bundled MCP server discovers file handlers, serves a self-contained app and reads GLB',async()=>{
  const transport=new StdioClientTransport({command:process.execPath,args:[resolve(packageRoot,'server/index.bundle.mjs')],stderr:'pipe'});
  let stderr='';transport.stderr?.on('data',x=>stderr+=x);
  const client=new Client({name:'blend-studio-verifier',version:'1.0.0'});
  try{
    await client.connect(transport);
    const {tools}=await client.listTools();
    const open=tools.find(x=>x.name==='studio.open');assert.ok(open);
    assert.deepEqual(open._meta['openai/ui'].entrypoints.find(x=>x.type==='file').extensions,['.blend','.glb','.vrm']);
    const status=await client.callTool({name:'studio.status',arguments:{}});assert.equal(status.isError,undefined);assert.equal(typeof status.structuredContent.blenderAvailable,'boolean');
    const blank=await client.callTool({name:'studio.open',arguments:{}});assert.ok(blank.structuredContent.status);
    const result=await client.callTool({name:'studio.open',arguments:{path:fileURLToPath(new URL('../assets/studio-companion.glb',import.meta.url))}});assert.ok(result.structuredContent.asset);assert.ok(result.structuredContent.asset.materials.some(m=>m.shader==='MToon'));
    const assetId=result.structuredContent.asset.assetId;
    const viewId=randomUUID(), tabId=randomUUID(), otherViewId=randomUUID();
    await client.callTool({name:'studio.view_updates',arguments:{viewId,tabs:[{tabId,assetId}]}});
    const revision=await client.callTool({name:'studio.open_revision',arguments:{path:fileURLToPath(new URL('../assets/studio-companion.glb',import.meta.url)),viewId,tabId,sourceAssetId:assetId}});
    assert.equal(revision.isError,undefined,JSON.stringify(revision));assert.equal(revision.structuredContent.status,'queued');
    assert.equal(tools.find(tool=>tool.name==='studio.open_revision')._meta?.ui,undefined,'revision delivery must not ask the host to open a new UI');
    const otherView=await client.callTool({name:'studio.view_updates',arguments:{viewId:otherViewId,tabs:[]}});assert.equal(otherView.structuredContent.revision,null);
    const pending=await client.callTool({name:'studio.view_updates',arguments:{viewId,tabs:[{tabId,assetId}]}});assert.equal(pending.structuredContent.revision.sourceTabId,tabId);
    const accepted=await client.callTool({name:'studio.view_updates',arguments:{viewId,tabs:[{tabId,assetId}],acknowledge:[revision.structuredContent.requestId]}});assert.equal(accepted.structuredContent.revision,null);
    const stale=await client.callTool({name:'studio.open_revision',arguments:{path:'missing.glb',viewId,tabId,sourceAssetId:randomUUID()}});assert.equal(stale.isError,true);assert.match(stale.content[0].text,/変更/);
    const chunk=await client.callTool({name:'studio.read_chunk',arguments:{assetId,offset:0}});assert.ok(chunk._meta['blend-studio/chunk'].base64);
    const html=await client.readResource({uri:'ui://blend-studio/viewer-0.1.9.html'});assert.match(html.contents[0].text,/Blend Studio/);assert.match(html.contents[0].mimeType,/mcp-app/);assert.ok(html.contents[0].text.length>1000000);
    const missing=await client.callTool({name:'studio.inspect',arguments:{assetId:'missing'}});assert.equal(missing.isError,true);
    const hostFile=await client.callTool({name:'studio.load_opened',arguments:{},_meta:{'openai/resource':{path:fileURLToPath(new URL('../assets/studio-companion.glb',import.meta.url))}}});assert.ok(hostFile.structuredContent.asset,'host resource path was not consumed');
  }finally{await client.close();if(stderr)console.error(stderr);}
});
