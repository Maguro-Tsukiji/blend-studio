import { readFile, writeFile, stat, realpath, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename, extname, dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findBlender, blenderStatus } from './settings.mjs';
export { findBlender } from './settings.mjs';

export const MAX_BYTES = 256 * 1024 * 1024;
export const CHUNK_BYTES = 512 * 1024;
const MAX_TOTAL_BYTES = 512 * 1024 * 1024;
export const ROOT = fileURLToPath(new URL('../', import.meta.url));

export function parseGlb(bytes) {
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2) throw new Error('有効なglTF 2.0 GLBではありません。');
  if (bytes.readUInt32LE(8) !== bytes.length) throw new Error('GLBのサイズ情報が一致しません。');
  let json;
  for (let offset = 12; offset < bytes.length;) {
    if (offset + 8 > bytes.length) throw new Error('GLBのチャンクが壊れています。');
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    if (length % 4 || offset + 8 + length > bytes.length) throw new Error('GLBのチャンク範囲が不正です。');
    if (type === 0x4e4f534a && !json) json = JSON.parse(bytes.subarray(offset + 8, offset + 8 + length).toString('utf8').trim());
    offset += 8 + length;
  }
  if (!json || json.asset?.version !== '2.0') throw new Error('glTF 2.0の情報がありません。');
  const external = [...(json.buffers || []), ...(json.images || [])].filter(x => x.uri && !x.uri.startsWith('data:'));
  if (external.length) throw new Error('外部参照を含むGLBです。テクスチャとバッファを埋め込んだGLBで保存してください。');
  return json;
}

export function summarize(json) {
  const legacy = json.extensions?.VRM?.materialProperties || [];
  return {
    format: json.extensions?.VRM ? 'VRM 0.x' : json.extensions?.VRMC_vrm ? 'VRM 1.0' : 'glTF 2.0',
    nodes: (json.nodes || []).map((n, i) => ({ index: i, name: n.name || `Object ${i + 1}`, mesh: n.mesh, children: n.children || [] })),
    materials: (json.materials || []).map((m, i) => ({ index: i, name: m.name || `Material ${i + 1}`, shader: m.extensions?.VRMC_materials_mtoon || legacy[i]?.shader === 'VRM/MToon' ? 'MToon' : m.extensions?.KHR_materials_unlit ? 'Unlit' : 'PBR', baseColor: m.pbrMetallicRoughness?.baseColorFactor || [1, 1, 1, 1], textures: !!(m.pbrMetallicRoughness?.baseColorTexture || m.normalTexture), alphaMode: m.alphaMode || 'OPAQUE', doubleSided: !!m.doubleSided })),
    meshCount: json.meshes?.length || 0,
    animationCount: json.animations?.length || 0,
    extensions: json.extensionsUsed || [],
  };
}

export async function runBlender(inputPath, outputPath, reportPath) {
  const blender = await findBlender();
  if (!blender) throw new Error('Blenderが見つかりません。画面の「Blenderを設定」から実行ファイルを選んでください。');
  const args = ['--background', '--factory-startup', '--disable-autoexec', '--python', join(ROOT, 'scripts', 'convert_blend.py'), '--', inputPath, outputPath, reportPath];
  await new Promise((resolve, reject) => {
    const child = spawn(blender, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let logs = '', settled = false;
    const finish = error => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(); };
    const timer = setTimeout(() => { child.kill(); finish(new Error('Blenderの変換が180秒を超えました。')); }, 180000);
    child.stdout.on('data', d => { logs = (logs + d).slice(-6000); });
    child.stderr.on('data', d => { logs = (logs + d).slice(-6000); });
    child.on('error', e => finish(new Error(`Blenderを起動できません: ${e.message}`)));
    child.on('close', code => finish(code === 0 ? null : new Error(`Blender変換に失敗しました (${code})。${logs.slice(-2000)}`)));
  });
  return JSON.parse(await readFile(reportPath, 'utf8'));
}

export class AssetStore {
  assets = new Map(); uploads = new Map(); directory; residentBytes = 0;
  async init() { this.directory ||= await mkdtemp(join(tmpdir(), 'blend-studio-')); return this; }
  async close() { if (this.directory) { const target = resolve(this.directory); if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('blend-studio-')) throw new Error('Invalid temporary cache path'); await rm(target, { recursive: true, force: true }); } this.assets.clear(); this.uploads.clear(); }
  async status() { return { version: '0.1.10', ...await blenderStatus(), integrations: { blender: 'file-conversion', tripo: 'planned' }, maxFileBytes: MAX_BYTES }; }
  beginUpload(name, size) {
    if (!['.blend', '.glb', '.vrm'].includes(extname(name).toLowerCase())) throw new Error('対応形式は .blend / .glb / .vrm です。');
    if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_BYTES) throw new Error('ファイルは256MB以下にしてください。');
    if (this.uploads.size >= 2) throw new Error('読み込み中のファイルが多すぎます。');
    const id = randomUUID(); this.uploads.set(id, { name: basename(name), size, received: 0, parts: [] });
    return { uploadId: id, chunkBytes: CHUNK_BYTES };
  }
  appendUpload(id, offset, base64) {
    const upload = this.uploads.get(id); if (!upload) throw new Error('アップロードが見つかりません。');
    if (offset !== upload.received) throw new Error('チャンクの順序が一致しません。');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64) || base64.length > Math.ceil(CHUNK_BYTES / 3) * 4) throw new Error('チャンク形式が不正です。');
    const bytes = Buffer.from(base64, 'base64');
    if (!bytes.length || bytes.length > CHUNK_BYTES || upload.received + bytes.length > upload.size) throw new Error('チャンクのサイズが不正です。');
    upload.parts.push(bytes); upload.received += bytes.length;
    return { received: upload.received };
  }
  async finishUpload(id) {
    const upload = this.uploads.get(id); if (!upload || upload.received !== upload.size) throw new Error('アップロードが完了していません。');
    this.uploads.delete(id);
    const data = Buffer.concat(upload.parts);
    if (extname(upload.name).toLowerCase() !== '.blend') return this.addAsset(upload.name, data);
    await this.init();
    const path = join(this.directory, `${id}.blend`); await writeFile(path, data);
    return this.openPath(path, upload.name, true);
  }
  cancelUpload(id) { this.uploads.delete(id); return { cancelled: true }; }
  async openPath(path, displayName, uploaded = false) {
    const resolved = await realpath(path), size = (await stat(resolved)).size;
    if (size <= 0 || size > MAX_BYTES) throw new Error('ファイルは256MB以下にしてください。');
    const extension = extname(resolved).toLowerCase();
    if (!['.blend', '.glb', '.vrm'].includes(extension)) throw new Error('対応形式は .blend / .glb / .vrm です。');
    const name = displayName || basename(resolved);
    if (extension !== '.blend') return this.addAsset(name, await readFile(resolved), { warnings: [], sourcePath: uploaded ? undefined : resolved });
    await this.init(); const id = randomUUID();
    const out = join(this.directory, `${id}.glb`), reportPath = join(this.directory, `${id}.json`);
    try {
      const report = await runBlender(resolved, out, reportPath);
      if ((await stat(out)).size > MAX_BYTES) throw new Error('変換後のGLBが256MBを超えました。');
      if (uploaded) report.warnings.push('選択した.blendに外部テクスチャがある場合、元ファイルで「リソースをパック」してから読み込んでください。');
      return this.addAsset(name, await readFile(out), { ...report, sourcePath: uploaded ? undefined : resolved });
    } finally { await Promise.all([rm(out, { force: true }), rm(reportPath, { force: true })]); }
  }
  addAsset(name, data, report = { warnings: [] }) {
    if (data.length > MAX_BYTES) throw new Error('GLBが256MBを超えました。');
    const json = parseGlb(data);
    while ((this.residentBytes + data.length > MAX_TOTAL_BYTES || this.assets.size >= 8) && this.assets.size) {
      const [id, old] = this.assets.entries().next().value; this.assets.delete(id); this.residentBytes -= old.data.length;
    }
    const id = randomUUID(), summary = { assetId: id, name, bytes: data.length, ...summarize(json), warnings: report.warnings || [], sourceObjects: report.objects || [], ...(report.sourcePath ? { sourcePath: report.sourcePath } : {}) };
    this.assets.set(id, { data, summary }); this.residentBytes += data.length;
    return summary;
  }
  get(id) { const asset = this.assets.get(id); if (!asset) throw new Error('モデルが見つかりません。もう一度読み込んでください。'); return asset; }
  readChunk(id, offset) {
    const asset = this.get(id);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset >= asset.data.length) throw new Error('チャンク範囲が不正です。');
    const bytes = asset.data.subarray(offset, offset + CHUNK_BYTES);
    return { base64: bytes.toString('base64'), offset, nextOffset: offset + bytes.length, total: asset.data.length };
  }
}

export function makeEditRequest(summary, selection, camera, instruction, screenshot) {
  return { schemaVersion: 1, asset: summary ? { id: summary.assetId, name: summary.name, format: summary.format } : null, selection, camera, instruction, screenshot: screenshot ? { mimeType: 'image/png', data: screenshot } : undefined, target: 'chatgpt', integrations: { blender: { status: 'planned', operation: 'edit-copy' }, tripo: { status: 'planned', operation: 'regenerate' } } };
}
