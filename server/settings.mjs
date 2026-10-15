import { readFile, writeFile, mkdir, rename, stat, realpath, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname, isAbsolute, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function settingsPath() {
  const directory = process.env.BLEND_STUDIO_CONFIG_DIR || (process.platform === 'win32'
    ? join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'BlendStudio')
    : join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'blend-studio'));
  return join(directory, 'settings.json');
}
export async function readSettings() {
  try { return JSON.parse(await readFile(settingsPath(), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw new Error('Blender設定を読み込めません。設定ファイルを確認してください。'); }
}
async function executable(path) {
  try { return (await stat(path)).isFile() ? await realpath(path) : null; } catch { return null; }
}
export async function findBlender() {
  const saved = (await readSettings()).blenderPath;
  if (saved) return executable(saved);
  const candidates = process.env.BLENDER_PATH ? [process.env.BLENDER_PATH] : [];
  for (const directory of (process.env.PATH || '').split(process.platform === 'win32' ? ';' : ':')) {
    if (directory) candidates.push(join(directory, process.platform === 'win32' ? 'blender.exe' : 'blender'));
  }
  if (process.platform === 'win32') {
    for (const base of ['C:/Program Files/Blender Foundation', 'D:/Program Files/Blender Foundation']) {
      try { for (const child of (await readdir(base)).sort().reverse()) candidates.push(join(base, child, 'blender.exe')); } catch {}
    }
  } else candidates.push('/Applications/Blender.app/Contents/MacOS/Blender', '/usr/bin/blender', '/snap/bin/blender');
  for (const candidate of candidates) { const path = await executable(candidate); if (path) return path; }
  return null;
}
function run(program, args, timeout = 30000) {
  return new Promise((accept, reject) => {
    const child = spawn(program, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', errors = '', settled = false;
    const finish = error => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : accept(output); };
    const timer = setTimeout(() => { child.kill(); finish(new Error('Blenderの確認に時間がかかりすぎました。')); }, timeout);
    child.stdout.on('data', data => output = (output + data).slice(-12000));
    child.stderr.on('data', data => errors = (errors + data).slice(-2000));
    child.on('error', error => finish(new Error(`起動できません: ${error.message}`)));
    child.on('close', code => finish(code === 0 ? null : new Error(`実行ファイルを確認できません (${code})。${errors}`)));
  });
}
let writeQueue = Promise.resolve();
export function configureBlender(input) {
  const operation = writeQueue.then(async () => {
    let path = String(input || '').trim().replace(/^"(.*)"$/, '$1');
    if (path) {
      if (!isAbsolute(path) || !/^blender(?:\.exe)?$/i.test(basename(path))) throw new Error('Blenderの実行ファイルを選んでください。Windowsでは blender.exe です。');
      path = await executable(path);
      if (!path) throw new Error('指定したBlenderが見つかりません。実行ファイルを選び直してください。');
      if (!/\bBlender \d+\.\d+/.test(await run(path, ['--version']))) throw new Error('Blenderの実行ファイルとして確認できませんでした。');
    }
    const settings = { ...await readSettings(), blenderPath: path || '' };
    const target = settingsPath(); await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(settings, null, 2), { encoding: 'utf8', mode: 0o600 });
    await rename(temporary, target);
    return { blenderPath: settings.blenderPath };
  });
  writeQueue = operation.catch(() => {}); return operation;
}
export async function pickBlender() {
  if (process.platform !== 'win32') throw new Error('この環境ではBlenderの実行ファイルのパスを入力してください。');
  const powershell = join(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const script = fileURLToPath(new URL('../scripts/pick-blender.ps1', import.meta.url));
  const selection = JSON.parse((await run(powershell, ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', script], 240000)).replace(/^\uFEFF/, ''));
  if (selection.cancelled) return selection;
  await configureBlender(selection.path);
  return { cancelled: false };
}
export async function blenderStatus() {
  const settings = await readSettings(), path = await findBlender();
  return { blenderAvailable: !!path, blenderPath: path || '', configuredBlenderPath: settings.blenderPath || '', nativePickerAvailable: process.platform === 'win32' };
}

export async function pickWorkingFile() {
  if (process.platform !== 'win32') throw new Error('作業ファイルの絶対パスを入力してください。');
  const powershell = join(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const script = fileURLToPath(new URL('../scripts/pick-work-file.ps1', import.meta.url));
  return JSON.parse((await run(powershell, ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', script], 240000)).replace(/^\uFEFF/, ''));
}
