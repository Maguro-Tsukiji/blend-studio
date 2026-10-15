export const MAX_MODEL_TABS = 8;
export const MAX_MODEL_BYTES = 512 * 1024 * 1024;

// A model is committed only after parsing succeeds. Failed imports leave tabs intact.
export class ModelTabs {
  items = [];
  activeId = null;
  constructor(createId = () => crypto.randomUUID()) { this.createId = createId; }
  get(id = this.activeId) { return this.items.find(tab => tab.id === id); }
  check(bytes, mode, targetId = this.activeId) {
    const target = mode === 'replace' ? this.get(targetId) : null;
    if (mode === 'replace' && !target) throw new Error('元のタブが閉じられました。新しいタブで開いてください。');
    if (mode !== 'replace' && this.items.length >= MAX_MODEL_TABS) throw new Error('タブは8個までです。不要なタブを閉じてください。');
    const total = this.items.reduce((sum, tab) => sum + (tab.state.bytes || 0), 0) - (target?.state.bytes || 0) + bytes;
    if (total > MAX_MODEL_BYTES) throw new Error('開いているモデルの合計が512MiBを超えます。不要なタブを閉じてください。');
  }
  commit(state, { mode = 'new-tab', targetId = this.activeId, keepSession = false, expectedSessionId, expectedRevision } = {}) {
    this.check(state.bytes, mode, targetId);
    const existing = mode === 'replace' ? this.get(targetId) : null;
    const previous = existing?.state;
    if (expectedSessionId && (existing?.sessionId !== expectedSessionId || expectedRevision !== undefined && existing.revision !== expectedRevision)) throw new Error('元タブの編集セッションが変わりました。現在の表示を確認してください。');
    const tab = existing || { id: this.createId() };
    if (!existing || !keepSession) { tab.sessionId = this.createId(); tab.revision = 0; }
    else tab.revision++;
    tab.state = state;
    if (!existing) this.items.push(tab);
    this.activeId = tab.id;
    return { tab, previous };
  }
  activate(id) { if (!this.get(id)) return false; this.activeId = id; return true; }
  close(id) {
    const index = this.items.findIndex(tab => tab.id === id);
    if (index < 0) return null;
    const [removed] = this.items.splice(index, 1);
    if (this.activeId === id) this.activeId = this.items[Math.min(index, this.items.length - 1)]?.id || null;
    return removed.state;
  }
}
