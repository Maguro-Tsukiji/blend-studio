import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AssetStore } from '../server/core.mjs';
import { lightingProfile, lightingPreset, lightingForMode } from '../src/lighting.mjs';

test('real Blend conversion carries MToon origin through GLB extras without misclassifying plain PBR or unused nodes', { skip: !process.env.TEST_BLENDER_PATH }, async () => {
  const store = await new AssetStore().init();
  try {
    const path = join(store.directory, 'lighting.blend');
    await promisify(execFile)(process.env.TEST_BLENDER_PATH, ['--background', '--factory-startup', '--disable-autoexec', '--python', fileURLToPath(new URL('create-lighting-fixture.py', import.meta.url)), '--', path], { windowsHide: true });
    const summary = await store.openPath(path), bytes = store.get(summary.assetId).data;
    const material = name => summary.materials.find(m => m.name === name);
    assert.equal(material('Converted Toon').shader, 'PBR');
    assert.equal(material('Converted Toon').sourceShader, 'MToon');
    assert.equal(material('Plain PBR').sourceShader, undefined);
    assert.equal(material('Unused Toon Nodes').sourceShader, undefined);
    assert.ok(summary.warnings.some(w => w.includes('1件のMToon')));
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const materials = [];
    gltf.scene.traverse(o => { if (o.isMesh) materials.push(...(Array.isArray(o.material) ? o.material : [o.material])); });
    assert.equal(lightingProfile('auto', materials), 'mtoon');
    const automatic = lightingForMode(lightingPreset('studio'), 'auto', materials);
    assert.equal(automatic.profile, 'mtoon'); assert.equal(automatic.ambient, .2); assert.equal(automatic.key.intensity, 1);
    assert.equal(lightingForMode(automatic, 'pbr', materials).profile, 'pbr');
  } finally { await store.close(); }
});
