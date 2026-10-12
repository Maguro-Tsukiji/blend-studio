import test from 'node:test';
import assert from 'node:assert/strict';
import { ViewDelivery, openRevision } from '../server/view-delivery.mjs';

test('revisions stay scoped to the originating viewer and tab until acknowledged', () => {
  const delivery = new ViewDelivery();
  delivery.register({ viewId: 'a', tabs: [{ tabId: 'original', assetId: 'old' }, { tabId: 'other', assetId: 'other-model' }] });
  delivery.register({ viewId: 'b', tabs: [{ tabId: 'original', assetId: 'old' }] });
  const request = delivery.enqueue({ viewId: 'a', tabId: 'original', sourceAssetId: 'old', asset: { assetId: 'new', name: 'revision.glb' } });
  assert.equal(request.status, 'queued');
  assert.equal(delivery.register({ viewId: 'b', tabs: [], acknowledge: [request.requestId] }).revision, null);
  const read = () => delivery.register({ viewId: 'a', tabs: [{ tabId: 'original', assetId: 'old' }] });
  assert.equal(read().revision.sourceTabId, 'original');
  assert.equal(read().revision.requestId, request.requestId);
  assert.equal(delivery.register({ viewId: 'a', tabs: [], acknowledge: [request.requestId] }).revision, null);
});
test('a changed source or expired viewer is rejected before reading the revised file', async () => {
  let now = 0; let opened = false; const delivery = new ViewDelivery(() => now);
  delivery.register({ viewId: 'a', tabs: [{ tabId: 'original', assetId: 'changed' }] });
  const store = { openPath: async () => { opened = true; } };
  await assert.rejects(openRevision(store, delivery, { viewId: 'a', tabId: 'original', sourceAssetId: 'old', path: 'revision.glb' }), /変更/);
  assert.equal(opened, false);
  now = 10 * 60 * 1000 + 1;
  assert.throws(() => delivery.target('a', 'original', 'changed'), /見つかりません/);
});
test('conversion errors leave the originating viewer without a pending replacement', async () => {
  const delivery = new ViewDelivery(); const tabs = [{ tabId: 'original', assetId: 'old' }];
  delivery.register({ viewId: 'a', tabs });
  await assert.rejects(openRevision({ openPath: async () => { throw new Error('conversion failed'); } }, delivery, { viewId: 'a', tabId: 'original', sourceAssetId: 'old', path: 'revision.blend' }), /conversion failed/);
  assert.equal(delivery.register({ viewId: 'a', tabs }).revision, null);
});
