import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelTabs, MAX_MODEL_BYTES } from '../src/model-tabs.mjs';

const state = (name, bytes = 10) => ({ asset: { name }, bytes, camera: [1, 2, 3], target: { triangle: 7 } });
test('new models preserve original state and replacement targets the originating tab', () => {
  let id = 0; const tabs = new ModelTabs(() => String(++id));
  const original = state('original'); const first = tabs.commit(original).tab;
  const second = tabs.commit(state('other')).tab;
  tabs.activate(first.id); assert.equal(tabs.get().state, original);
  tabs.activate(second.id);
  const result = tabs.commit(state('revision'), { mode: 'replace', targetId: first.id });
  assert.equal(result.previous, original); assert.equal(tabs.activeId, first.id);
  assert.equal(tabs.get(second.id).state.asset.name, 'other'); assert.equal(tabs.items.length, 2);
});
test('capacity and stale targets reject imports without changing existing tabs', () => {
  let id = 0; const tabs = new ModelTabs(() => String(++id));
  for (let i = 0; i < 8; i++) tabs.commit(state(String(i)));
  assert.throws(() => tabs.commit(state('overflow')), /8個/);
  const active = tabs.activeId;
  assert.throws(() => tabs.commit(state('stale'), { mode: 'replace', targetId: 'closed' }), /閉じられ/);
  assert.equal(tabs.activeId, active); assert.equal(tabs.items.length, 8);
  tabs.commit(state('large', MAX_MODEL_BYTES - 70), { mode: 'replace', targetId: active });
  assert.throws(() => tabs.commit(state('too-large', MAX_MODEL_BYTES), { mode: 'replace', targetId: active }), /512MiB/);
  assert.equal(tabs.get().state.asset.name, 'large');
});
test('closing tabs selects a neighbour and allows an empty workspace', () => {
  let id = 0; const tabs = new ModelTabs(() => String(++id));
  const first = tabs.commit(state('a')).tab, second = tabs.commit(state('b')).tab;
  tabs.close(first.id); assert.equal(tabs.activeId, second.id);
  tabs.close(second.id); assert.equal(tabs.activeId, null);
  assert.equal(tabs.items.length, 0); assert.equal(tabs.close('missing'), null);
});
test('working revisions retain the session and reject stale results after a manual replacement', () => {
  const tabs = new ModelTabs(); const original = tabs.commit(state('working')).tab;
  const sessionId = original.sessionId;
  tabs.commit(state('saved-1'), { mode: 'replace', targetId: original.id, keepSession: true, expectedSessionId: sessionId, expectedRevision: 0 });
  assert.equal(tabs.get().sessionId, sessionId); assert.equal(tabs.get().revision, 1);
  assert.throws(() => tabs.commit(state('stale'), { mode: 'replace', targetId: original.id, keepSession: true, expectedSessionId: sessionId, expectedRevision: 0 }), /セッション/);
  tabs.commit(state('different-model'), { mode: 'replace', targetId: original.id });
  assert.notEqual(tabs.get().sessionId, sessionId);
  assert.throws(() => tabs.commit(state('late-save'), { mode: 'replace', targetId: original.id, keepSession: true, expectedSessionId: sessionId }), /セッション/);
  assert.equal(tabs.get().state.asset.name, 'different-model');
});
