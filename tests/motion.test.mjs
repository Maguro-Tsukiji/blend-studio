import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMAnimationLoaderPlugin } from '@pixiv/three-vrm-animation';
import { MotionPlayer, automaticMapping, validateMotion } from '../src/motion-player.mjs';
import { AssetStore } from '../server/core.mjs';

const array = bytes => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const source = async () => {
  const loader = new GLTFLoader(); loader.register(parser => new VRMAnimationLoaderPlugin(parser));
  const data = await loader.parseAsync(array(await readFile(new URL('../assets/wave-test.vrma', import.meta.url))), '');
  return { name: 'wave-test.vrma', animation: data.userData.vrmAnimations[0] };
};
const model = async () => (await new GLTFLoader().parseAsync(array(await readFile(new URL('../assets/humanoid-test.glb', import.meta.url))), '')).scene;
test('VRMA retargets a weighted Blender-exported rig, preserves preview placement and supports seek, pause, rate and restore', async () => {
  const root = await model(); root.position.set(-3, -2, 1); root.updateMatrixWorld(true);
  const player = new MotionPlayer(root), hand = player.bones.find(entry => entry.name === 'rightHand').bone;
  const rest = hand.getWorldPosition(new Vector3());
  const motion = await source(); player.load(motion, { playing: false });
  assert.ok(hand.getWorldPosition(new Vector3()).distanceTo(rest) < 1e-5, 'frame zero must not jump when the model is centred');
  player.seek(.5); const moved = hand.getWorldPosition(new Vector3());
  assert.ok(moved.distanceTo(rest) > .3); assert.ok(moved.y > rest.y, 'the right arm must lift instead of changing only its transform metadata');
  player.update(.1); assert.equal(player.time, .5, 'pause must freeze the displayed pose');
  player.rate = 2; player.playing = true; player.update(.25); assert.equal(player.time, 1);
  player.loop = false; player.update(10); assert.equal(player.time, 2); assert.equal(player.playing, false);
  player.resetPose(); root.updateMatrixWorld(true); assert.ok(hand.getWorldPosition(new Vector3()).distanceTo(rest) < 1e-5);
});
test('motion state can be reapplied to a new preview without sharing bone objects, and bad input retains the old motion', async () => {
  const motion = await source(), original = new MotionPlayer(await model()); original.load(motion, { playing: false, time: .7, rate: .5, loop: false });
  const refreshed = new MotionPlayer(await model(), null, original.mapping); refreshed.load(original.source, original.snapshot());
  assert.deepEqual(refreshed.snapshot(), original.snapshot()); assert.notEqual(refreshed.bones[0].bone, original.bones[0].bone);
  const invalid = { ...motion.animation, duration: NaN }; assert.throws(() => refreshed.load({ name: 'broken', animation: invalid }), /再生時間/);
  assert.equal(refreshed.source.name, 'wave-test.vrma'); assert.equal(refreshed.time, .7);
  original.dispose(); refreshed.dispose();
});
test('automatic bone mapping prefers explicit names, rejects ambiguity and supports common VRoid/Mixamo names', () => {
  const bones = ['Hips', 'Spine', 'Spine1', 'Spine2', 'mixamorig:LeftArm', 'J_Bip_R_LowerArm'].map((name, i) => ({ name, key: String(i) }));
  const mapping = automaticMapping(bones); assert.equal(mapping.hips, '0'); assert.equal(mapping.spine, '1'); assert.equal(mapping.chest, '2'); assert.equal(mapping.upperChest, '3'); assert.equal(mapping.leftUpperArm, '4'); assert.equal(mapping.rightLowerArm, '5');
  assert.equal(automaticMapping([...bones, { name: 'hips', key: 'other-armature' }]).hips, undefined);
  const bad = { duration: 1, humanoidTracks: { rotation: new Map(), translation: new Map() }, expressionTracks: { preset: new Map(), custom: new Map() } };
  assert.throws(() => validateMotion(bad), /動きがありません/);
});
test('a real Blend conversion retains weighted human bones that can play VRMA', { skip: !process.env.TEST_BLENDER_PATH }, async () => {
  const store = await new AssetStore().init();
  try {
    const asset = await store.openPath(fileURLToPath(new URL('../assets/humanoid-test.blend', import.meta.url)));
    const root = (await new GLTFLoader().parseAsync(array(store.get(asset.assetId).data), '')).scene;
    const player = new MotionPlayer(root); player.load(await source(), { time: .5, playing: false });
    assert.ok(player.bones.length >= 17); assert.ok(player.clip.tracks.length >= 3); player.dispose();
  } finally { await store.close(); }
});
