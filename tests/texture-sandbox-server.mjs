import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { AssetStore } from '../server/core.mjs';
import { fileURLToPath } from 'node:url';
const store = await new AssetStore().init();
const path = process.env.TEXTURE_TEST_FILE || fileURLToPath(new URL('../assets/textured-test.blend', import.meta.url));
const initialAsset = await store.openPath(path);
const status = await store.status();
const hostCode = await build({ entryPoints: [fileURLToPath(new URL('texture-sandbox-host.mjs', import.meta.url))], bundle: true, format: 'esm', write: false });
const html = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#111119;color:#f3f0fa;font:12px sans-serif"><iframe style="display:block;width:100vw;height:calc(100vh - 70px);border:0"></iframe><div id="host-context" role="status" aria-label="ホストが受信した表示情報" style="padding:8px">表示情報の受信待ち</div><div id="host-target" aria-label="ホストが受信した指定位置" style="padding:0 8px;white-space:nowrap;overflow:auto"></div><script>window.initialAsset=${JSON.stringify(initialAsset).replaceAll('<','\\u003c')};window.initialStatus=${JSON.stringify(status).replaceAll('<','\\u003c')};</script><script type="module" src="/host.js"></script></body></html>`;
const server = createServer(async (request, response) => {
  try {
    if (request.url === '/') { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html); }
    else if (request.url === '/host.js') { response.setHeader('Content-Type', 'text/javascript; charset=utf-8'); response.end(hostCode.outputFiles[0].text); }
    else if (request.url === '/viewer') {
      response.setHeader('Content-Type','text/html; charset=utf-8');
      response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; font-src data:");
      response.end(await readFile(new URL('../dist/viewer.html', import.meta.url)));
    } else if (request.url === '/api/tool' && request.method === 'POST') {
      const chunks = []; for await (const chunk of request) chunks.push(chunk);
      const { name, arguments: args = {} } = JSON.parse(Buffer.concat(chunks)); let data, meta = {};
      if (name === 'studio.status') data = await store.status();
      else if (name === 'studio.upload_begin') data = store.beginUpload(args.name, args.size);
      else if (name === 'studio.upload_append') data = store.appendUpload(args.uploadId, args.offset, args.base64);
      else if (name === 'studio.upload_finish') data = { asset: await store.finishUpload(args.uploadId) };
      else if (name === 'studio.upload_cancel') data = store.cancelUpload(args.uploadId);
      else if (name === 'studio.read_chunk') { data = { assetId: args.assetId }; meta['blend-studio/chunk'] = store.readChunk(args.assetId, args.offset); }
      else throw new Error('Unsupported test tool');
      response.setHeader('Content-Type','application/json'); response.end(JSON.stringify({ content: [], structuredContent: data, _meta: meta }));
    } else { response.writeHead(404); response.end(); }
  } catch (error) { response.writeHead(500); response.end(error.message); }
});
const port = Number(process.env.PORT || 43127);
server.listen(port, '127.0.0.1', () => console.log(`Texture sandbox test ready: http://127.0.0.1:${port} (${initialAsset.materials.length} materials)`));
const stop = () => server.close(() => void store.close().finally(() => process.exit(0)));
process.on('SIGTERM', stop); process.on('SIGINT', stop);
