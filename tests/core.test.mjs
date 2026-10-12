import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AssetStore, parseGlb, summarize } from '../server/core.mjs';

const demo = await readFile(new URL('../assets/studio-companion.glb', import.meta.url));
test('textured PBR and MToon survive GLB inspection', () => {
  const json = parseGlb(demo), summary = summarize(json);
  assert.equal(summary.meshCount, 12);
  assert.ok(summary.materials.some(x => x.shader === 'MToon' && x.textures));
  assert.ok(summary.materials.some(x => x.shader === 'PBR'));
});
test('upload chunks preserve bytes and reject reordered or incomplete input', async () => {
  const store = await new AssetStore().init();
  try {
    const { uploadId, chunkBytes } = store.beginUpload('avatar.glb', demo.length);
    assert.throws(() => store.appendUpload(uploadId, 1, demo.subarray(0,10).toString('base64')), /順序/);
    await assert.rejects(store.finishUpload(uploadId), /完了/);
    for(let offset=0;offset<demo.length;offset+=chunkBytes) store.appendUpload(uploadId,offset,demo.subarray(offset,offset+chunkBytes).toString('base64'));
    const asset = await store.finishUpload(uploadId);
    assert.deepEqual(store.get(asset.assetId).data,demo);
    const parts=[];for(let offset=0;offset<demo.length;){const c=store.readChunk(asset.assetId,offset);parts.push(Buffer.from(c.base64,'base64'));offset=c.nextOffset;}
    assert.deepEqual(Buffer.concat(parts),demo);
    assert.throws(()=>store.readChunk(asset.assetId,-1),/範囲/);
  } finally { await store.close(); }
});
test('invalid GLB and external references are rejected',()=>{
  assert.throws(()=>parseGlb(Buffer.from('not a model')),/GLB/);
  const corrupt=Buffer.from(demo);corrupt.writeUInt32LE(0xffffffff,12);assert.throws(()=>parseGlb(corrupt),/範囲/);
  const json=Buffer.from(JSON.stringify({asset:{version:'2.0'},buffers:[{uri:'https://example.com/remote.bin'}]}));const body=Buffer.alloc(Math.ceil(json.length/4)*4,32);json.copy(body);const file=Buffer.alloc(20+body.length);file.writeUInt32LE(0x46546c67);file.writeUInt32LE(2,4);file.writeUInt32LE(file.length,8);file.writeUInt32LE(body.length,12);file.writeUInt32LE(0x4e4f534a,16);body.copy(file,20);assert.throws(()=>parseGlb(file),/外部参照/);
});
test('real .blend conversion preserves mesh names and Principled colors', {skip:!process.env.BLENDER_TEST_FILE}, async()=>{
  const store=await new AssetStore().init();try{const asset=await store.openPath(process.env.BLENDER_TEST_FILE);assert.ok(asset.nodes.some(x=>x.name==='Textured Cube'));assert.ok(asset.materials.some(x=>x.name==='Packed Checker'&&x.textures));assert.ok(asset.warnings.length);assert.ok(asset.sourceObjects.some(x=>x.name==='Textured Cube'));}finally{await store.close();}
});
