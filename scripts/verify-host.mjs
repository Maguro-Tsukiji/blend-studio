import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
const child = spawn(process.argv[2], ['app-server', '--listen', 'stdio://'], { windowsHide: true, env: process.env });
let sequence = 0, errors = ''; const pending = new Map();
child.stderr.on('data', data => errors = (errors + data).slice(-3000));
const fail = error => { for (const operation of pending.values()) { clearTimeout(operation.timer); operation.reject(error); } pending.clear(); };
child.on('error', fail);
child.on('exit', code => fail(new Error(`接続確認が終了しました (${code})。${errors}`)));
createInterface({ input: child.stdout }).on('line', line => {
  let message; try { message = JSON.parse(line); } catch { return; }
  const operation = pending.get(message.id); if (!operation) return;
  clearTimeout(operation.timer); pending.delete(message.id);
  message.error ? operation.reject(new Error(JSON.stringify(message.error))) : operation.accept(message.result);
});
function request(method, params) {
  return new Promise((accept, reject) => {
    const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(new Error(`アプリへの接続を確認できませんでした: ${method}。${errors}`)); }, 45000);
    pending.set(id, { accept, reject, timer }); child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
  });
}
try {
  await request('initialize', { clientInfo: { name: 'blend-studio-installer', version: '0.1.8' }, capabilities: { experimentalApi: true } });
  child.stdin.write(JSON.stringify({ method: 'initialized' }) + '\n');
  const listing = await request('mcpServerStatus/list', { serverName: 'blend-studio', detail: 'full' });
  const server = listing.data.find(item => item.pluginId === 'blend-studio@blend-studio-local');
  if (!server?.tools?.['studio.open'] || !server.tools['studio.settings']) throw new Error('登録はできましたが、ビューアーの起動を確認できません。Blend Studioを再インストールしてください。');
  const entrypoints = server.tools['studio.open']._meta?.['openai/ui']?.entrypoints || [];
  if (!entrypoints.some(item => item.type === 'global')) throw new Error('サイドバーの入口を確認できませんでした。');
  const resource = await request('mcpServer/resource/read', { server: server.name, uri: 'ui://blend-studio/viewer-0.1.8.html' });
  if (!resource.contents?.[0]?.text.includes('blender-dialog')) throw new Error('Blender設定画面を読み込めませんでした。');
  console.log(JSON.stringify({ connected: true, sidebarEntrypoint: true, blenderSettings: true }));
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { fail(new Error('Verification finished')); child.stdin.end(); child.kill(); }
