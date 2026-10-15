import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, copyFile, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ViewDelivery, openRevision } from '../server/view-delivery.mjs';
const fixture = fileURLToPath(new URL('../assets/studio-companion.glb', import.meta.url));
async function setup(t) {
  const directory = await mkdtemp(join(tmpdir(), 'blend-studio-routing-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const viewId = randomUUID(), tabId = randomUUID(), sessionId = randomUUID(), assetId = randomUUID();
  const tabs = [{ tabId, sessionId, revision: 0, assetId, name: 'original' }];
  const delivery = new ViewDelivery({ directory });
  await delivery.register({ viewId, tabs, activeTabId: tabId });
  return { directory, delivery, viewId, tabId, sessionId, assetId, tabs };
}
test('a reconnected broker recovers the source session and scopes delivery/acknowledgement to its view', async t => {
  const s = await setup(t), other = randomUUID();
  const reconnected = new ViewDelivery({ directory: s.directory });
  assert.equal((await reconnected.sessions()).sessions[0].sessionId, s.sessionId);
  const request = await openRevision(null, reconnected, { sessionId: s.sessionId, path: fixture });
  assert.equal(request.status, 'queued');
  assert.equal((await s.delivery.register({ viewId: other, tabs: [], acknowledge: [request.requestId] })).revision, null);
  const pending = await s.delivery.register({ viewId: s.viewId, tabs: s.tabs });
  assert.equal(pending.revision.sourceSessionId, s.sessionId); assert.equal(pending.revision.path, undefined);
  await assert.rejects(s.delivery.loadRevision({ openPath: async () => ({}) }, { viewId: other, requestId: request.requestId }), /見つかりません/);
  const loaded = await s.delivery.loadRevision({ openPath: async path => ({ name: path }) }, { viewId: s.viewId, requestId: request.requestId });
  assert.equal(loaded.asset.name, fixture);
  assert.equal((await s.delivery.register({ viewId: s.viewId, tabs: s.tabs, acknowledge: [request.requestId], outcomes: [{ requestId: request.requestId, status: 'applied' }] })).revision, null);
});
test('successive revisions keep their session, while changed sessions and stale expected revisions reject before file access', async t => {
  const s = await setup(t); s.tabs[0] = { ...s.tabs[0], assetId: randomUUID(), revision: 2 };
  await s.delivery.register({ viewId: s.viewId, tabs: s.tabs });
  assert.equal((await openRevision(null, s.delivery, { sessionId: s.sessionId, sourceAssetId: s.assetId, path: fixture })).status, 'queued');
  await assert.rejects(openRevision(null, s.delivery, { sessionId: s.sessionId, expectedRevision: 1, path: 'missing.glb' }), /版/);
  await assert.rejects(openRevision(null, s.delivery, { viewId: s.viewId, tabId: s.tabId, sourceAssetId: s.assetId, path: 'missing.glb' }), /変更/);
  await s.delivery.register({ viewId: s.viewId, tabs: [{ ...s.tabs[0], sessionId: randomUUID() }] });
  await assert.rejects(openRevision(null, s.delivery, { sessionId: s.sessionId, path: 'missing.glb' }), /確認できません/);
});
test('missing or ambiguous origin never chooses another active view, and background views survive more than ten minutes', async t => {
  const s = await setup(t); let now = Date.now(); const delivery = new ViewDelivery({ directory: s.directory, now: () => now });
  now += 11 * 60000;
  assert.equal((await delivery.target({ sessionId: s.sessionId })).online, false);
  await assert.rejects(delivery.target({}), /一意/);
  await delivery.register({ viewId: randomUUID(), tabs: [{ ...s.tabs[0], tabId: randomUUID(), sessionId: randomUUID() }] });
  await assert.rejects(delivery.target({ sourceAssetId: s.assetId }), /一意/);
  now += 25 * 60 * 60000;
  await assert.rejects(delivery.target({ sessionId: s.sessionId }), /確認できません/);
});
test('working-file saves load in the receiving session and concurrent saves preserve the old preview', async t => {
  const s = await setup(t), path = join(s.directory, 'working.glb'); await copyFile(fixture, path);
  await s.delivery.follow({ sessionId: s.sessionId, path, autoRefresh: true });
  const first = (await s.delivery.register({ viewId: s.viewId, tabs: s.tabs })).workingFiles[0];
  const store = { openPath: async () => ({ assetId: randomUUID() }) };
  const loaded = await s.delivery.loadWorking(store, { sessionId: s.sessionId, stamp: first.stamp });
  assert.equal(loaded.workingStamp, first.stamp); assert.equal(loaded.expectedRevision, 0);
  await writeFile(path, Buffer.concat([await readFile(path), Buffer.from('saved')]));
  const saved = (await s.delivery.register({ viewId: s.viewId, tabs: s.tabs })).workingFiles[0];
  assert.notEqual(saved.stamp, first.stamp);
  await assert.rejects(s.delivery.loadWorking(store, { sessionId: s.sessionId, stamp: first.stamp }), /保存中/);
  await assert.rejects(s.delivery.loadWorking({ openPath: async () => { await writeFile(path, 'changed during conversion'); return {}; } }, { sessionId: s.sessionId }), /読み込み中/);
  await s.delivery.follow({ sessionId: s.sessionId, disconnect: true });
  assert.equal((await s.delivery.register({ viewId: s.viewId, tabs: s.tabs })).workingFiles.length, 0);
});
