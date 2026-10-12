import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
const iframe = document.querySelector('iframe');
const bridge = new AppBridge(null, { name: 'Texture sandbox test', version: '1.0.0' }, { serverTools: {}, updateModelContext: { text: {}, structuredContent: {} }, experimental: { 'openai/modelContext': {} } });
bridge.onupdatemodelcontext = async params => {
  const context = params.structuredContent;
  document.getElementById('host-context').textContent = `受信: ${context.asset?.name || '未選択'} · ${context.selection?.name || 'モデル全体'} · ${context.renderMode} · 視点 ${context.camera.position.map(value => value.toFixed(2)).join(', ')}`;
  document.getElementById('host-target').textContent = JSON.stringify(context.target);
  return { _meta: { 'openai/modelContext': { updateId: 'context-test' } } };
};
bridge.oncalltool = async params => (await fetch('/api/tool', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) })).json();
bridge.oninitialized = async () => {
  bridge.setHostContext({ theme: 'dark', displayMode: 'fullscreen' });
  await bridge.sendToolInput({ arguments: {} });
  await bridge.sendToolResult({ content: [], structuredContent: { asset: window.initialAsset, status: window.initialStatus } });
};
await bridge.connect(new PostMessageTransport(iframe.contentWindow, iframe.contentWindow));
iframe.src = '/viewer';
