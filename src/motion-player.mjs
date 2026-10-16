import { AnimationMixer, LoopOnce } from 'three';
import { VRMHumanoid, VRMHumanBoneList } from '@pixiv/three-vrm';
import { createVRMAnimationClip } from '@pixiv/three-vrm-animation';

export { VRMHumanBoneList as HUMAN_BONES };
export const CORE_BONES = ['hips', 'spine', 'head'];
const normalize = name => name.replace(/^mixamorig\d*[:_]?/i, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const aliases = { hips: ['pelvis', 'hip', 'j_bip_c_hips', '下半身'], spine: ['j_bip_c_spine', '上半身'], chest: ['spine1', 'j_bip_c_chest', '上半身2'], upperChest: ['spine2', 'j_bip_c_upperchest'], neck: ['j_bip_c_neck', '首'], head: ['j_bip_c_head', '頭'] };
for (const [side, short, japanese] of [['left', 'L', '左'], ['right', 'R', '右']]) {
  for (const [human, names, jp] of [['Shoulder', ['Shoulder', 'shoulder'], '肩'], ['UpperArm', ['UpperArm', 'Arm', 'upper_arm'], '腕'], ['LowerArm', ['LowerArm', 'ForeArm', 'forearm'], 'ひじ'], ['Hand', ['Hand', 'hand'], '手首'], ['UpperLeg', ['UpperLeg', 'UpLeg', 'thigh'], '足'], ['LowerLeg', ['LowerLeg', 'Leg', 'shin'], 'ひざ'], ['Foot', ['Foot', 'foot'], '足首'], ['Toes', ['Toes', 'ToeBase', 'toe'], 'つま先']]) {
    aliases[side + human] = [`j_bip_${short}_${human}`, japanese + jp, ...names.flatMap(name => [side + name, `${name}.${short}`, `${short}_${name}`])];
  }
  for (const finger of ['Thumb', 'Index', 'Middle', 'Ring', 'Little']) {
    const parts = finger === 'Thumb' ? ['Metacarpal', 'Proximal', 'Distal'] : ['Proximal', 'Intermediate', 'Distal'];
    parts.forEach((part, index) => { aliases[side + finger + part] = [`j_bip_${short}_${finger}${index + 1}`, `${side}Hand${finger === 'Little' ? 'Pinky' : finger}${index + 1}`, `${finger.toLowerCase()}${index + 1}.${short}`]; });
  }
}
export function rigBones(model) {
  const bones = new Set(); model.traverse(object => { if (object.isSkinnedMesh) for (const bone of object.skeleton.bones) bones.add(bone); });
  return [...bones].map(bone => {
    const path = []; for (let node = bone; node && node !== model; node = node.parent) path.unshift(node.userData.sourceBoneName || node.name);
    return { bone, name: bone.userData.sourceBoneName || bone.name, key: JSON.stringify(path) };
  });
}
export function automaticMapping(bones, hints = {}) {
  const mapping = {}, used = new Set();
  for (const human of VRMHumanBoneList) {
    const names = (aliases[human] || []).map(normalize);
    const hinted = hints[human] ? bones.filter(entry => entry.name === hints[human]) : [];
    const exact = bones.filter(entry => normalize(entry.name) === normalize(human));
    const candidates = hinted.length ? hinted : exact.length ? exact : bones.filter(entry => names.includes(normalize(entry.name)));
    if (candidates.length === 1 && !used.has(candidates[0].key)) { mapping[human] = candidates[0].key; used.add(candidates[0].key); }
  }
  return mapping;
}
function validateMapping(bones, mapping) {
  const map = new Map(bones.map(entry => [entry.key, entry.bone])), humanBones = {}, used = new Set();
  for (const human of VRMHumanBoneList) if (mapping[human]) {
    const node = map.get(mapping[human]);
    if (!node) throw new Error(`${human}のボーンが見つかりません。「ボーン対応」で確認してください。`);
    if (used.has(node)) throw new Error('同じボーンを複数の部位に割り当てることはできません。');
    used.add(node); humanBones[human] = { node };
  }
  const missing = CORE_BONES.filter(name => !humanBones[name]);
  if (missing.length) throw new Error(`人型ボーンの対応が必要です: ${missing.join(', ')}。「ボーン対応」で設定してください。`);
  const hips = humanBones.hips.node;
  for (const [name, { node }] of Object.entries(humanBones)) {
    if (name === 'hips') continue;
    let parent = node.parent; while (parent && parent !== hips) parent = parent.parent;
    if (!parent) throw new Error(`${name}はhips配下のボーンを指定してください。`);
  }
  return humanBones;
}
export function validateMotion(animation) {
  if (!Number.isFinite(animation.duration) || animation.duration < 0) throw new Error('VRMAの再生時間が不正です。');
  const tracks = [...animation.humanoidTracks.rotation.values(), ...animation.humanoidTracks.translation.values(), ...animation.expressionTracks.preset.values(), ...animation.expressionTracks.custom.values(), ...(animation.lookAtTrack ? [animation.lookAtTrack] : [])];
  if (!tracks.length) throw new Error('VRMAに再生できる動きがありません。');
  for (const track of tracks) {
    if (!track.times.every(Number.isFinite) || !track.values.every(Number.isFinite) || !track.times.length || track.times[0] < 0 || track.times.some((value, i) => i > 0 && value <= track.times[i - 1])) throw new Error('VRMAのキーフレームが不正です。');
  }
  if (animation.humanoidTracks.translation.size && Math.abs(animation.restHipsPosition.y) < 1e-6) throw new Error('VRMAの基準の腰位置を確認できません。');
}

export class MotionPlayer {
  constructor(model, vrm, mapping, hints) {
    this.model = model; this.vrm = vrm; this.bones = rigBones(model);
    this.mapping = mapping || automaticMapping(this.bones, hints);
    this.rest = this.bones.map(({ bone }) => ({ bone, position: bone.position.clone(), quaternion: bone.quaternion.clone(), scale: bone.scale.clone() }));
    this.rate = 1; this.loop = true; this.playing = false; this.time = 0;
  }
  makeTarget() {
    if (this.target) return this.target;
    if (this.vrm) return this.target = this.vrm;
    const humanBones = validateMapping(this.bones, this.mapping);
    this.model.updateWorldMatrix(true, true);
    // Construct the bridge in the uncentred model space, not the preview translation.
    const position = this.model.position.clone(); this.model.position.set(0, 0, 0); this.model.updateWorldMatrix(true, true);
    try {
      const humanoid = new VRMHumanoid(humanBones);
      this.model.add(humanoid.normalizedHumanBonesRoot);
      this.target = { scene: this.model, humanoid, meta: { metaVersion: '1' } };
      return this.target;
    } finally { this.model.position.copy(position); this.model.updateWorldMatrix(true, true); }
  }
  load(source, options = {}) {
    validateMotion(source.animation);
    const target = this.makeTarget(), clip = createVRMAnimationClip(source.animation, target);
    if (!clip.tracks.length) throw new Error('対応する動きがありません。「ボーン対応」を確認してください。');
    if (clip.tracks.some(track => !track.values.every(Number.isFinite))) throw new Error('動きをモデルへ対応付けられませんでした。');
    this.mixer?.stopAllAction(); this.mixer?.uncacheRoot(this.model);
    this.source = source; this.clip = clip; this.mixer = new AnimationMixer(this.model);
    this.action = this.mixer.clipAction(clip); this.action.clampWhenFinished = true;
    this.rate = options.rate ?? this.rate; this.loop = options.loop ?? this.loop;
    this.playing = options.playing ?? source.animation.duration > 0;
    this.seek(options.time ?? 0);
    this.warnings = [];
    const missing = [...source.animation.humanoidTracks.rotation.keys()].filter(name => !target.humanoid.getRawBoneNode(name));
    if (missing.length) this.warnings.push(`未対応のボーン ${missing.length}個: ${missing.join(', ')}`);
    if (!this.vrm && (source.animation.expressionTracks.preset.size || source.animation.expressionTracks.custom.size || source.animation.lookAtTrack)) this.warnings.push('一般リグでは体の動きのみ再生します。表情・視線はVRMモデルで対応します。');
  }
  seek(time) {
    if (!this.action) return;
    this.time = Math.max(0, Math.min(this.source.animation.duration, Number(time) || 0));
    this.action.setLoop(LoopOnce, 1); this.action.reset().play();
    this.action.paused = false; this.mixer.setTime(this.time); this.target.humanoid.update();
    this.model.updateMatrixWorld(true); for (const { bone } of this.bones) bone.updateWorldMatrix(true, false);
  }
  update(delta) {
    if (!this.source || !this.playing) return;
    let time = this.time + delta * this.rate;
    if (time >= this.source.animation.duration) { if (this.loop && this.source.animation.duration) time %= this.source.animation.duration; else { time = this.source.animation.duration; this.playing = false; } }
    this.seek(time);
  }
  snapshot() { return { time: this.time, playing: this.playing, rate: this.rate, loop: this.loop }; }
  resetPose() {
    this.mixer?.stopAllAction(); this.mixer?.uncacheRoot(this.model); this.mixer = this.action = undefined;
    if (this.vrm) this.vrm.humanoid.resetNormalizedPose();
    else if (this.target) this.model.remove(this.target.humanoid.normalizedHumanBonesRoot);
    for (const { bone, position, quaternion, scale } of this.rest) { bone.position.copy(position); bone.quaternion.copy(quaternion); bone.scale.copy(scale); }
    this.target = undefined; this.source = undefined; this.playing = false; this.time = 0; this.model.updateMatrixWorld(true);
  }
  dispose() { this.resetPose(); }
}
