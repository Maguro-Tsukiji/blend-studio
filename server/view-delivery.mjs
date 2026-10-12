import { randomUUID } from 'node:crypto';

const VIEW_TTL = 10 * 60 * 1000;
const DELIVERY_TTL = 15 * 60 * 1000;

// Routes a result to the viewer/tab that supplied the chat context, not a new host window.
export class ViewDelivery {
  views = new Map();
  constructor(now = () => Date.now()) { this.now = now; }
  prune() {
    const now = this.now();
    for (const [id, view] of this.views) {
      if (now - view.seen > VIEW_TTL) this.views.delete(id);
      else view.queue = view.queue.filter(item => now - item.created < DELIVERY_TTL);
    }
  }
  register({ viewId, tabs, acknowledge = [] }) {
    this.prune();
    let view = this.views.get(viewId);
    if (!view) {
      if (this.views.size >= 32) throw new Error('開いている画面が多すぎます。不要な画面を閉じてください。');
      view = { queue: [], tabs: new Map(), seen: this.now() }; this.views.set(viewId, view);
    }
    view.seen = this.now(); view.tabs = new Map(tabs.map(tab => [tab.tabId, tab]));
    const acknowledged = [];
    for (const id of acknowledge) {
      const index = view.queue.findIndex(item => item.requestId === id);
      if (index >= 0) view.queue.splice(index, 1);
      // Echo even an expired ID so the client can finish its acknowledgement retry.
      acknowledged.push(id);
    }
    return { revision: view.queue[0] || null, acknowledged };
  }
  target(viewId, tabId, sourceAssetId) {
    this.prune();
    const view = this.views.get(viewId), tab = view?.tabs.get(tabId);
    if (!tab) throw new Error('修正依頼元の画面またはタブが見つかりません。元のBlend Studio画面を開き、表示情報を確認してください。');
    if (tab.assetId !== sourceAssetId) throw new Error('修正依頼元のモデルが変更されています。現在の表示を確認してから開いてください。');
    if (view.queue.length >= 8) throw new Error('この画面で開く修正結果が多すぎます。画面の選択を完了してください。');
    return view;
  }
  enqueue({ viewId, tabId, sourceAssetId, asset }) {
    const view = this.target(viewId, tabId, sourceAssetId);
    const revision = { requestId: randomUUID(), sourceTabId: tabId, sourceAssetId, asset, created: this.now() };
    view.queue.push(revision);
    return { requestId: revision.requestId, status: 'queued', viewId, tabId, asset: { id: asset.assetId, name: asset.name }, message: '修正依頼元のBlend Studio画面に送信しました。元のタブを更新するか、新しいモデルタブで開くか、画面で選んでください。選択が完了するまでは表示は更新されません。' };
  }
}

export async function openRevision(store, delivery, args) {
  delivery.target(args.viewId, args.tabId, args.sourceAssetId);
  const asset = await store.openPath(args.path);
  return delivery.enqueue({ ...args, asset });
}
