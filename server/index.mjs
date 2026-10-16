import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { OpenAIExtensions, getResourcePath } from '@openai/mcp-extensions/server';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AssetStore, ROOT, MAX_BYTES, CHUNK_BYTES } from './core.mjs';
import { configureBlender, pickBlender, readSettings, pickWorkingFile } from './settings.mjs';
import { ViewDelivery, openRevision } from './view-delivery.mjs';

const store = await new AssetStore().init();
const delivery = new ViewDelivery();
const URI = 'ui://blend-studio/viewer-0.1.11.html';
const result = (data, meta = {}) => ({ content: [], structuredContent: data, _meta: meta });
const wrap = fn => async (...args) => { try { return await fn(...args); } catch (error) { return { isError: true, content: [{ type: 'text', text: error.message }] }; } };
const cleanup = () => { void store.close().finally(() => process.exit(0)); };
process.on('SIGINT', cleanup); process.on('SIGTERM', cleanup);
process.stdin.on('end', () => void store.close());

serveStdio(() => {
  const server = new McpServer({ name: 'blend-studio', version: '0.1.11' });
  const extensions = new OpenAIExtensions(server);
  server.registerResource('Blend Studio viewer', URI, { mimeType: 'text/html;profile=mcp-app' }, async () => ({ contents: [{ uri: URI, mimeType: 'text/html;profile=mcp-app', text: await readFile(join(ROOT, 'dist', 'viewer.html'), 'utf8'), _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] } }, 'openai/ui': { availableDisplayModes: ['inline', 'fullscreen'], preferredDisplayMode: 'fullscreen' } } }] }));
  server.registerTool('studio.open', {
    title: 'Blend Studio', description: 'Open the interactive Blend/GLB/VRM viewer. A .blend preview requires local Blender. Never claim a conversion preserves arbitrary Blender shader nodes.',
    inputSchema: z.object({ path: z.string().optional(), file: z.object({ name: z.string(), resourceUri: z.string() }).optional(), openMode: z.enum(['ask', 'replace', 'new-tab']).optional() }),
    annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: URI }, 'openai/ui': { entrypoints: [{ type: 'global' }, { type: 'thread' }, { type: 'file', extensions: ['.blend', '.glb', '.vrm'] }] } },
  }, wrap(async (args, context) => {
    const path = args.path || getResourcePath(context.mcpReq._meta);
    const asset = path ? await store.openPath(path) : undefined;
    return result({ status: await store.status(), ...(asset ? { asset } : {}), openMode: args.openMode || 'ask' });
  }));
  server.registerTool('studio.open_revision', {
    title: '修正依頼元の画面で結果を開く',
    description: 'Return a saved model to its existing edit session. Prefer sessionId from viewer.sessionId or studio.sessions; session IDs survive successive revisions. If origin IDs are missing, call studio.sessions instead of opening another viewer. openMode replace updates the source tab, ask offers a choice. queued does not mean displayed.',
    inputSchema: z.object({ path: z.string().max(4096), sessionId: z.uuid().optional(), viewId: z.uuid().optional(), tabId: z.uuid().optional(), sourceAssetId: z.uuid().optional(), expectedRevision: z.number().int().min(0).optional(), openMode: z.enum(['ask', 'replace', 'new-tab']).optional() }),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, wrap(async args => result(await openRevision(store, delivery, args))));
  server.registerTool('studio.sessions', {
    title: '開いている編集セッションを確認', description: 'Recover existing Blend Studio source tabs and their stable session IDs, current revision, filenames and connected working files. Use before returning results when chat context is missing or stale. Never guess between multiple candidates or open a new viewer as a fallback.',
    inputSchema: z.object({ sessionId: z.uuid().optional(), sourceAssetId: z.uuid().optional() }), annotations: { readOnlyHint: true, openWorldHint: false },
  }, wrap(async args => result(await delivery.sessions(args))));
  const followSchema = z.object({ sessionId: z.uuid(), path: z.string().max(4096).optional(), autoRefresh: z.boolean().optional(), disconnect: z.boolean().optional() });
  server.registerTool('studio.follow_working_file', {
    title: '保存した作業ファイルを元タブへ反映', description: 'Connect an explicitly identified saved local Blend/GLB/VRM working file to an existing edit session. Auto refresh updates that same tab after disk saves while preserving its camera/render mode. Does not edit files or read unsaved Blender memory. Find the session with studio.sessions. disconnect stops following.',
    inputSchema: followSchema, annotations: { destructiveHint: false, openWorldHint: false },
  }, wrap(async args => result(await delivery.follow(args))));
  server.registerTool('studio.work_file_configure', { inputSchema: followSchema, _meta: { ui: { visibility: ['app'] } } }, wrap(async args => result(await delivery.follow(args))));
  server.registerTool('studio.work_file_load', { inputSchema: z.object({ sessionId: z.uuid(), stamp: z.string().max(256).optional() }), annotations: { readOnlyHint: true, openWorldHint: false }, _meta: { ui: { visibility: ['app'] } } }, wrap(async args => result(await delivery.loadWorking(store, args))));
  server.registerTool('studio.pick_work_file', { inputSchema: z.object({}), _meta: { ui: { visibility: ['app'] } } }, wrap(async () => result(await pickWorkingFile())));
  server.registerTool('studio.load_revision', { inputSchema: z.object({ viewId: z.uuid(), requestId: z.uuid() }), annotations: { readOnlyHint: true, openWorldHint: false }, _meta: { ui: { visibility: ['app'] } } }, wrap(async args => result(await delivery.loadRevision(store, args))));
  server.registerTool('studio.view_updates', {
    title: '元の画面への修正結果を取得',
    inputSchema: z.object({ viewId: z.uuid(), activeTabId: z.uuid().nullable().optional(), tabs: z.array(z.object({ tabId: z.uuid(), sessionId: z.uuid().optional(), revision: z.number().int().min(0).optional(), assetId: z.uuid().optional(), name: z.string().max(1024).optional(), sourcePath: z.string().max(4096).optional(), demo: z.boolean().optional() })).max(8), acknowledge: z.array(z.uuid()).max(8).optional(), outcomes: z.array(z.object({ requestId: z.uuid(), status: z.enum(['applied', 'cancelled', 'failed']) })).max(8).optional() }),
    annotations: { readOnlyHint: true, openWorldHint: false }, _meta: { ui: { visibility: ['app'] } },
  }, wrap(async args => result(await delivery.register(args))));
  server.registerTool('studio.status', { title: '描画・変換の状態', inputSchema: z.object({}), annotations: { readOnlyHint: true, openWorldHint: false } }, wrap(async () => result(await store.status())));
  server.registerTool('studio.settings', {
    title: 'Blenderを設定', description: 'Open Blend Studio settings to select or replace the local Blender executable.',
    inputSchema: z.object({}), annotations: { readOnlyHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: URI }, 'openai/ui': { entrypoints: [{ type: 'settings', searchTerms: ['Blender', 'パス', '変換'] }] } },
  }, wrap(async () => result({ status: await store.status(), showSettings: true })));
  server.registerTool('studio.configure_blender', {
    title: 'Blender設定を保存', inputSchema: z.object({ blenderPath: z.string().max(4096) }),
    annotations: { openWorldHint: false, destructiveHint: false }, _meta: { ui: { visibility: ['app'] } },
  }, wrap(async ({ blenderPath }) => { await configureBlender(blenderPath); return result({ status: await store.status() }); }));
  server.registerTool('studio.pick_blender', {
    title: 'Blenderを選び直す', inputSchema: z.object({}),
    annotations: { openWorldHint: false, destructiveHint: false }, _meta: { ui: { visibility: ['app'] } },
  }, wrap(async () => result({ ...await pickBlender(), status: await store.status() })));
  extensions.settings.register({
    readTool: 'studio.settings_read', updateTool: 'studio.settings_update',
    fields: { blenderPath: { schema: z.string().max(4096), title: 'Blenderの実行ファイル', description: 'Windowsでは blender.exe を指定。空欄で保存すると自動検出に戻ります。' } },
    layout: [{ kind: 'group', title: 'Blender', items: [{ kind: 'property', property: 'blenderPath' }, { kind: 'tool', tool: 'studio.settings', title: 'Blenderを設定する画面を開く' }] }],
    read: async () => ({ blenderPath: (await readSettings()).blenderPath || '' }),
    update: async set => { if (set.blenderPath !== undefined) await configureBlender(set.blenderPath); return { blenderPath: (await readSettings()).blenderPath || '' }; },
  });
  server.registerTool('studio.load_opened', { title: '開いたファイルを読み込む', inputSchema: z.object({}), annotations: { readOnlyHint: true, openWorldHint: false }, _meta: { ui: { visibility: ['app'] } } }, wrap(async (_, context) => {
    const path = getResourcePath(context.mcpReq._meta);
    if (!path) throw new Error('ホストからファイルへのアクセスが提供されていません。ファイル選択から読み込んでください。');
    return result({ asset: await store.openPath(path) });
  }));
  server.registerTool('studio.read_chunk', { title: 'モデルを表示', inputSchema: z.object({ assetId: z.string(), offset: z.number().int().min(0) }), annotations: { readOnlyHint: true, openWorldHint: false }, _meta: { ui: { visibility: ['app'] } } }, wrap(async ({ assetId, offset }) => result({ assetId }, { 'blend-studio/chunk': store.readChunk(assetId, offset) })));
  server.registerTool('studio.upload_begin', { inputSchema: z.object({ name: z.string().max(255), size: z.number().int().positive().max(MAX_BYTES) }), annotations: { openWorldHint: false }, _meta: { ui: { visibility: ['app'] } } }, wrap(async ({ name, size }) => result(store.beginUpload(name, size))));
  server.registerTool('studio.upload_append', { inputSchema: z.object({ uploadId: z.string(), offset: z.number().int().min(0), base64: z.string().max(Math.ceil(CHUNK_BYTES / 3) * 4) }), annotations: { openWorldHint: false }, _meta: { ui: { visibility: ['app'] } } }, wrap(async ({ uploadId, offset, base64 }) => result(store.appendUpload(uploadId, offset, base64))));
  server.registerTool('studio.upload_finish', { inputSchema: z.object({ uploadId: z.string() }), annotations: { openWorldHint: false }, _meta: { ui: { visibility: ['app'] } } }, wrap(async ({ uploadId }) => result({ asset: await store.finishUpload(uploadId) })));
  server.registerTool('studio.upload_cancel', { inputSchema: z.object({ uploadId: z.string() }), annotations: { openWorldHint: false }, _meta: { ui: { visibility: ['app'] } } }, wrap(async ({ uploadId }) => result(store.cancelUpload(uploadId))));
  server.registerTool('studio.inspect', { title: 'モデルの構造とマテリアル', description: 'Inspect an asset previously opened in Blend Studio; returns material and object identifiers for a scoped edit request.', inputSchema: z.object({ assetId: z.string() }), annotations: { readOnlyHint: true, openWorldHint: false } }, wrap(async ({ assetId }) => result(store.get(assetId).summary)));
  return server;
});
