import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AssetStore, ROOT } from './core.mjs';
import { configureBlender, pickBlender } from './settings.mjs';

const store = await new AssetStore().init();
const port = Number(process.env.PORT || 43123);
const host = `127.0.0.1:${port}`;
const server = createServer(async (req, res) => {
  const send = (code, type, body) => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(body); };
  try {
    if (req.headers.host !== host && req.headers.host !== `localhost:${port}`) return send(403, 'text/plain', 'Invalid host');
    const url = new URL(req.url, `http://${host}`);
    if (req.method === 'GET' && url.pathname === '/') return send(200, 'text/html; charset=utf-8', await readFile(join(ROOT, 'dist/viewer.html')));
    if (req.method === 'GET' && url.pathname === '/health') return send(200, 'application/json', JSON.stringify({ status: 'ok' }));
    if (req.method !== 'POST' || url.pathname !== '/api/tool') return send(404, 'text/plain', 'Not found');
    if (req.headers.origin && ![`http://${host}`, `http://localhost:${port}`].includes(req.headers.origin)) return send(403, 'text/plain', 'Invalid origin');
    if (!req.headers['content-type']?.startsWith('application/json')) return send(415, 'text/plain', 'JSON only');
    let body = '', length = 0;
    for await (const chunk of req) { length += chunk.length; if (length > 750000) throw new Error('Request too large'); body += chunk; }
    const { name, arguments: args = {} } = JSON.parse(body); let data, meta = {};
    switch(name) {
      case 'studio.status': data = await store.status(); break;
      case 'studio.configure_blender': if (typeof args.blenderPath !== 'string' || args.blenderPath.length > 4096) throw new Error('Blenderのパスが不正です。'); await configureBlender(args.blenderPath); data = { status: await store.status() }; break;
      case 'studio.pick_blender': data = { ...await pickBlender(), status: await store.status() }; break;
      case 'studio.upload_begin': data = store.beginUpload(args.name, args.size); break;
      case 'studio.upload_append': data = store.appendUpload(args.uploadId, args.offset, args.base64); break;
      case 'studio.upload_finish': data = { asset: await store.finishUpload(args.uploadId) }; break;
      case 'studio.upload_cancel': data = store.cancelUpload(args.uploadId); break;
      case 'studio.read_chunk': data = { assetId: args.assetId }; meta['blend-studio/chunk'] = store.readChunk(args.assetId, args.offset); break;
      default: throw new Error('Unknown tool');
    }
    send(200, 'application/json', JSON.stringify({ content: [], structuredContent: data, _meta: meta }));
  } catch(e) { send(400, 'application/json', JSON.stringify({ isError: true, content: [{ type: 'text', text: e.message }] })); }
});
server.listen(port, '127.0.0.1', () => console.log(`Blend Studio preview: http://${host}`));
const stop = () => server.close(() => void store.close().finally(() => process.exit(0)));
process.on('SIGTERM', stop); process.on('SIGINT', stop);
