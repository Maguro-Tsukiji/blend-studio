import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, readdir, unlink, realpath, stat } from 'node:fs/promises';
import { join, dirname, basename, extname } from 'node:path';
import { settingsPath } from './settings.mjs';

const RETENTION = 24 * 60 * 60 * 1000, ONLINE = 120000;
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const validId = id => { if (!UUID.test(id || '')) throw new Error('セッションIDが不正です。studio.sessionsで確認してください。'); return id; };

export async function modelFile(path) {
  const resolved = await realpath(path), info = await stat(resolved);
  if (!info.isFile() || !['.blend', '.glb', '.vrm'].includes(extname(resolved).toLowerCase())) throw new Error('作業ファイルは .blend / .glb / .vrm を選んでください。');
  if (info.size <= 0 || info.size > 256 * 1048576) throw new Error('ファイルは256MiB以下にしてください。');
  return { path: resolved, name: basename(resolved), stamp: `${info.ino}:${info.size}:${info.mtimeMs}`, modified: info.mtimeMs };
}

// Separate, atomically written records allow the chat and app MCP processes to reconnect.
// Binary models remain in the receiving process's AssetStore, not in this registry.
export class ViewDelivery {
  constructor({ directory = join(dirname(settingsPath()), 'viewer-sessions-v1'), now = () => Date.now() } = {}) { this.directory = directory; this.now = now; }
  file(kind, id) { return join(this.directory, `${kind}-${validId(id)}.json`); }
  async read(kind, id) { try { return JSON.parse(await readFile(this.file(kind, id), 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } }
  async write(kind, id, value) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const target = this.file(kind, id), temporary = `${target}.${randomUUID()}.tmp`;
    try { await writeFile(temporary, JSON.stringify(value), { mode: 0o600 }); await rename(temporary, target); }
    finally { await unlink(temporary).catch(e => { if (e.code !== 'ENOENT') throw e; }); }
  }
  async records(kind) {
    let names; try { names = await readdir(this.directory); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
    const records = [];
    for (const name of names) {
      const id = name.slice(kind.length + 1, -5);
      if (!name.startsWith(`${kind}-`) || !name.endsWith('.json') || !UUID.test(id)) continue;
      const record = await this.read(kind, id); if (record) records.push(record);
    }
    return records;
  }
  async prune() {
    if (this.pruned && this.now() - this.pruned < 60000) return;
    this.pruned = this.now();
    const liveSessions = new Set();
    for (const view of await this.records('view')) {
      if (this.now() - view.seen > RETENTION) await unlink(this.file('view', view.viewId)).catch(e => { if (e.code !== 'ENOENT') throw e; });
      else for (const tab of view.tabs) liveSessions.add(tab.sessionId);
    }
    for (const kind of ['request', 'ack', 'work']) for (const record of await this.records(kind)) {
      if (this.now() - record.created > RETENTION && (kind !== 'work' || !liveSessions.has(record.sessionId))) await unlink(this.file(kind, kind === 'work' ? record.sessionId : record.requestId)).catch(e => { if (e.code !== 'ENOENT') throw e; });
    }
  }
  async register({ viewId, tabs, activeTabId, acknowledge = [], outcomes = [] }) {
    validId(viewId); await this.prune();
    const seen = this.now();
    const normalized = tabs.map(tab => ({ ...tab, tabId: validId(tab.tabId), sessionId: validId(tab.sessionId || tab.tabId), revision: tab.revision || 0 }));
    await this.write('view', viewId, { viewId, tabs: normalized, activeTabId, seen });
    for (const requestId of acknowledge) {
      const request = await this.read('request', requestId);
      if (request?.viewId === viewId) await this.write('ack', requestId, { requestId, created: seen, status: outcomes.find(item => item.requestId === requestId)?.status || 'received' });
    }
    const queue = [];
    for (const item of await this.records('request')) if (item.viewId === viewId && this.now() - item.created < RETENTION && !await this.read('ack', item.requestId)) queue.push(item);
    queue.sort((a, b) => a.created - b.created);
    const workingFiles = [];
    for (const tab of normalized) {
      const binding = await this.read('work', tab.sessionId); if (!binding) continue;
      let state;
      try { const file = await modelFile(binding.path); state = { stamp: `${binding.bindingId}:${file.stamp}`, ready: seen - file.modified >= 900, modified: file.modified }; }
      catch (error) { state = { error: error.message }; }
      workingFiles.push({ sessionId: tab.sessionId, path: binding.path, name: basename(binding.path), autoRefresh: binding.autoRefresh, ...state });
    }
    const revision = queue[0] ? { ...queue[0], path: undefined } : null;
    return { revision, acknowledged: acknowledge, workingFiles };
  }
  async sessions({ sessionId, sourceAssetId } = {}) {
    await this.prune(); const sessions = [];
    for (const view of await this.records('view')) {
      if (this.now() - view.seen > RETENTION) continue;
      for (const tab of view.tabs) {
        if (sessionId && tab.sessionId !== sessionId || sourceAssetId && tab.assetId !== sourceAssetId) continue;
        const working = await this.read('work', tab.sessionId);
        sessions.push({ ...tab, viewId: view.viewId, active: view.activeTabId === tab.tabId, online: this.now() - view.seen < ONLINE, lastSeen: view.seen, workingFile: working ? { path: working.path, autoRefresh: working.autoRefresh } : null });
      }
    }
    return { sessions };
  }
  async target({ sessionId, viewId, tabId, sourceAssetId, expectedRevision }) {
    const candidates = (await this.sessions({ sessionId, ...(!sessionId && !viewId && sourceAssetId ? { sourceAssetId } : {}) })).sessions.filter(tab => (!viewId || tab.viewId === viewId) && (!tabId || tab.tabId === tabId));
    if (!sessionId && !(viewId && tabId) && !sourceAssetId || candidates.length !== 1) throw new Error('依頼元を一意に確認できません。studio.sessionsで編集セッションを確認してください。新しい画面は開きません。');
    const target = candidates[0];
    if (!sessionId && sourceAssetId && target.assetId !== sourceAssetId) throw new Error('依頼元のモデルが変更されています。studio.sessionsで現在の編集セッションを確認してください。');
    if (expectedRevision !== undefined && target.revision !== expectedRevision) throw new Error('確認後にモデルが更新されました。studio.sessionsで現在の版を確認してください。');
    return target;
  }
  async enqueue(args) {
    const target = await this.target(args), pending = [];
    for (const request of await this.records('request')) if (request.viewId === target.viewId && this.now() - request.created < RETENTION && !await this.read('ack', request.requestId)) pending.push(request);
    if (pending.length >= 8) throw new Error('開く修正結果が多すぎます。元の画面で選択を完了してください。');
    const requestId = randomUUID();
    const request = { requestId, viewId: target.viewId, sourceTabId: target.tabId, sourceSessionId: target.sessionId, sourceRevision: target.revision, sourceAssetId: target.assetId, path: args.path, asset: { name: basename(args.path) }, openMode: args.openMode || 'ask', created: this.now() };
    await this.write('request', requestId, request);
    return { requestId, status: 'queued', sessionId: target.sessionId, viewId: target.viewId, tabId: target.tabId, message: '依頼元の編集セッションに送信しました。元の画面で更新を確認してください。表示完了はまだ確認していません。' };
  }
  async loadRevision(store, { viewId, requestId }) {
    const request = await this.read('request', requestId);
    if (!request || request.viewId !== viewId || await this.read('ack', requestId) || this.now() - request.created > RETENTION) throw new Error('この画面で開く修正結果が見つかりません。');
    return { asset: await store.openPath(request.path) };
  }
  async follow(args) {
    const target = await this.target(args);
    if (args.disconnect) { await unlink(this.file('work', target.sessionId)).catch(e => { if (e.code !== 'ENOENT') throw e; }); return { sessionId: target.sessionId, disconnected: true }; }
    const file = await modelFile(args.path);
    await this.target({ sessionId: target.sessionId, expectedRevision: target.revision });
    await this.write('work', target.sessionId, { sessionId: target.sessionId, bindingId: randomUUID(), path: file.path, autoRefresh: args.autoRefresh !== false, created: this.now() });
    return { sessionId: target.sessionId, path: file.path, autoRefresh: args.autoRefresh !== false, message: '作業ファイルを接続しました。元のタブで保存後の内容を確認できます。' };
  }
  async loadWorking(store, { sessionId, stamp }) {
    const target = await this.target({ sessionId }), binding = await this.read('work', sessionId);
    if (!binding) throw new Error('作業ファイルが接続されていません。');
    const before = await modelFile(binding.path), workingStamp = `${binding.bindingId}:${before.stamp}`;
    if (stamp && stamp !== workingStamp) throw new Error('保存中にファイルが変わりました。次の更新で再確認します。');
    const asset = await store.openPath(binding.path), after = await modelFile(binding.path);
    if (before.stamp !== after.stamp || (await this.read('work', sessionId))?.bindingId !== binding.bindingId) throw new Error('読み込み中に作業ファイルが変わりました。前の表示を保持して再確認します。');
    await this.target({ sessionId, expectedRevision: target.revision });
    return { asset, workingStamp, sessionId, expectedRevision: target.revision };
  }
}

export async function openRevision(_store, delivery, args) {
  const target = await delivery.target(args);
  const file = await modelFile(args.path);
  return delivery.enqueue({ ...args, sessionId: target.sessionId, expectedRevision: target.revision, path: file.path });
}
