import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, HemisphereLight, DirectionalLight, Vector3, MeshStandardMaterial } from 'three';
import { MToonMaterial } from '@pixiv/three-vrm';
import { LIGHTING_PRESETS, MTOON_LIGHTING_PRESETS, lightingSettings, lightingPreset, lightingProfile, lightingForMode, applyLighting } from '../src/lighting.mjs';

test('lighting presets and retained tab/revision snapshots are independent and bounded', () => {
  for (const name of Object.keys(LIGHTING_PRESETS)) {
    const first = lightingPreset(name), retained = lightingSettings(first);
    first.key.intensity = 0; first.fill.color = '#000000';
    assert.notEqual(retained.key.intensity, 0); assert.notEqual(retained.fill.color, '#000000');
    assert.deepEqual(lightingPreset(name), retained);
  }
  const value = lightingSettings({ preset: 'custom', exposure: Infinity, environment: -5, ambient: 500, ambientColor: 'url(invalid)', key: { intensity: NaN, color: '#Ab12Ff', azimuth: -800, elevation: 100 } });
  assert.equal(value.preset, 'custom'); assert.equal(value.exposure, 1.15); assert.equal(value.environment, 0); assert.equal(value.ambient, 5); assert.equal(value.ambientColor, '#e2d9ff');
  assert.deepEqual(value.key, { intensity: 3.2, color: '#ab12ff', azimuth: -180, elevation: 90 });
  assert.deepEqual(lightingSettings(null), lightingPreset('studio'));
});
test('lighting applies exposure, environment, colors and zero intensities to actual Three lights without changing model materials', () => {
  const rig = { scene: new Scene(), renderer: { toneMappingExposure: 1 }, ambient: new HemisphereLight(), key: new DirectionalLight(), fill: new DirectionalLight() };
  const value = lightingPreset('dramatic'); value.key.intensity = value.fill.intensity = value.ambient = value.environment = 0;
  applyLighting(rig, value);
  assert.equal(rig.renderer.toneMappingExposure, 1.1); assert.equal(rig.scene.environmentIntensity, 0); assert.equal(rig.ambient.intensity, 0); assert.equal(rig.key.intensity, 0); assert.equal(rig.fill.intensity, 0);
  assert.equal(rig.key.color.getHexString(), 'ffcf9e'); assert.equal(rig.fill.color.getHexString(), '8eacff');
  applyLighting(rig, lightingPreset('studio')); assert.equal(rig.key.intensity, 3.2); assert.equal(rig.scene.environmentIntensity, 1);
});
test('directional lights track the model centre and configured front independently of model scale and camera', () => {
  const rig = { scene: new Scene(), renderer: {}, ambient: new HemisphereLight(), key: new DirectionalLight(), fill: new DirectionalLight() }, settings = lightingPreset('studio');
  settings.key.azimuth = 0; settings.key.elevation = 0;
  const frame = { center: [4, 9, -3], largest: 20 };
  applyLighting(rig, settings, frame);
  assert.deepEqual(rig.key.target.position.toArray(), frame.center); assert.deepEqual(rig.key.position.toArray(), [4, 9, 37]);
  applyLighting(rig, settings, frame, Math.PI / 2);
  assert.ok(rig.key.position.distanceTo(new Vector3(44, 9, -3)) < 1e-10);
  settings.key.elevation = 90; applyLighting(rig, settings, frame, Math.PI / 2);
  assert.ok(rig.key.position.distanceTo(new Vector3(4, 49, -3)) < 1e-10);
});
test('every MToon preset reduces ambient and direct illumination without changing PBR defaults', () => {
  for (const name of Object.keys(MTOON_LIGHTING_PRESETS)) {
    const pbr = lightingPreset(name), toon = lightingPreset(name, 'mtoon');
    assert.equal(toon.profile, 'mtoon'); assert.equal(toon.automatic, true);
    assert.ok(toon.ambient <= .3); assert.ok(toon.ambient < pbr.ambient);
    assert.ok(toon.key.intensity < pbr.key.intensity); assert.ok(toon.fill.intensity < pbr.fill.intensity); assert.ok(toon.exposure < pbr.exposure);
    const copy = lightingSettings(toon); copy.key.intensity = 9; assert.deepEqual(lightingPreset(name, 'mtoon'), toon);
  }
  const pbr = lightingPreset('studio'), toon = lightingPreset('studio', 'mtoon');
  assert.equal(pbr.key.intensity, 3.2); assert.equal(pbr.ambient, 2); assert.equal(pbr.exposure, 1.15);
  assert.equal(toon.key.intensity, 1); assert.equal(toon.ambient, .2); assert.equal(toon.exposure, .8);
  assert.equal(lightingSettings({ profile: 'mtoon', exposure: NaN }).exposure, .8);
});
test('native MToon and MToon preview select safe automatic lights; PBR and wire transitions select or retain their profile', () => {
  const toon = new MToonMaterial(), pbr = new MeshStandardMaterial(), outline = new MToonMaterial({ isOutline: true });
  assert.equal(lightingProfile('auto', [toon, pbr]), 'mtoon'); assert.equal(lightingProfile('auto', [outline, pbr]), 'pbr');
  let settings = lightingForMode(lightingPreset('studio'), 'auto', [toon]);
  assert.equal(settings.profile, 'mtoon'); assert.equal(settings.key.intensity, 1);
  settings = lightingForMode(settings, 'pbr', [toon]); assert.equal(settings.profile, 'pbr'); assert.equal(settings.key.intensity, 3.2);
  settings = lightingForMode(settings, 'wire', [toon]); assert.equal(settings.profile, 'pbr');
  settings = lightingForMode(settings, 'mtoon', [pbr]); assert.equal(settings.profile, 'mtoon');
  assert.deepEqual(lightingForMode(settings, 'auto', [toon]), settings);
  toon.dispose(); pbr.dispose(); outline.dispose();
});
test('explicit presets, custom edits and legacy retained settings survive mode changes without being silently replaced', () => {
  const chosen = lightingPreset('soft', 'mtoon', false), edited = lightingSettings({ ...chosen, preset: 'custom', key: { ...chosen.key, intensity: .7, color: '#fedcba' } });
  for (const value of [chosen, edited, { preset: 'studio', exposure: .65, key: { intensity: 2.3 } }]) {
    const retained = lightingSettings(value);
    for (const mode of ['auto', 'pbr', 'mtoon', 'wire']) assert.deepEqual(lightingForMode(value, mode, []), retained);
  }
  const refreshed = lightingSettings(edited); refreshed.fill.intensity = 5; assert.notEqual(refreshed.fill.intensity, edited.fill.intensity);
});
