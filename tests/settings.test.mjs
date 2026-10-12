import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('Blender can be configured after skipping, persists across restart, and converts without environment setup', { skip: !process.env.TEST_BLENDER_PATH }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'blend-studio-settings-test-'));
  const root = fileURLToPath(new URL('../', import.meta.url));
  async function connect() {
    const client = new Client({ name: 'settings-verifier', version: '1.0.0' });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(root, 'server/index.bundle.mjs')], env: { ...process.env, BLENDER_PATH: '', BLEND_STUDIO_CONFIG_DIR: directory } }));
    return client;
  }
  let client = await connect();
  try {
    const first = await client.callTool({ name: 'studio.settings_read', arguments: {} });
    assert.equal(first.structuredContent.values.blenderPath, '');
    assert.ok(first.structuredContent.layout[0].items.some(item => item.tool === 'studio.settings'));
    const settings = await client.callTool({ name: 'studio.settings', arguments: {} });
    assert.equal(settings.structuredContent.showSettings, true);
    const valid = await client.callTool({ name: 'studio.configure_blender', arguments: { blenderPath: process.env.TEST_BLENDER_PATH } });
    assert.equal(valid.isError, undefined, JSON.stringify(valid));
    assert.equal(valid.structuredContent.status.blenderAvailable, true);
    const saved = JSON.parse(await readFile(join(directory, 'settings.json'), 'utf8'));
    assert.equal(saved.blenderPath.toLowerCase(), resolve(process.env.TEST_BLENDER_PATH).toLowerCase());
    const invalid = await client.callTool({ name: 'studio.configure_blender', arguments: { blenderPath: join(directory, 'missing', 'blender.exe') } });
    assert.equal(invalid.isError, true);
    assert.deepEqual(JSON.parse(await readFile(join(directory, 'settings.json'), 'utf8')), saved);
    await client.close(); client = await connect();
    const status = await client.callTool({ name: 'studio.status', arguments: {} });
    assert.equal(status.structuredContent.blenderPath, saved.blenderPath);
    const converted = await client.callTool({ name: 'studio.open', arguments: { path: join(root, 'assets/textured-test.blend') } });
    assert.equal(converted.isError, undefined, JSON.stringify(converted));
    assert.ok(converted.structuredContent.asset.materials.some(material => material.name === 'Packed Checker' && material.textures));
    const reset = await client.callTool({ name: 'studio.settings_update', arguments: { set: { blenderPath: '' } } });
    assert.equal(reset.isError, undefined, JSON.stringify(reset));
    assert.equal(reset.structuredContent.values.blenderPath, '');
  } finally { await client.close(); }
});
