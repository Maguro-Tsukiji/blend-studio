import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, HemisphereLight, DirectionalLight, Vector3 } from 'three';
import { LIGHTING_PRESETS, lightingSettings, lightingPreset, applyLighting } from '../src/lighting.mjs';

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
