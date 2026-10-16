import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const definitions = [
  ['hips', null, [0, 1, 0]], ['spine', 'hips', [0, 1.16, 0]], ['chest', 'spine', [0, 1.4, 0]], ['neck', 'chest', [0, 1.62, 0]], ['head', 'neck', [0, 1.76, 0]],
  ...['left', 'right'].flatMap(side => { const sign = side === 'left' ? 1 : -1; return [[side + 'UpperArm', 'chest', [.22 * sign, 1.57, 0]], [side + 'LowerArm', side + 'UpperArm', [.58 * sign, 1.57, 0]], [side + 'Hand', side + 'LowerArm', [.9 * sign, 1.57, 0]], [side + 'UpperLeg', 'hips', [.15 * sign, 1, 0]], [side + 'LowerLeg', side + 'UpperLeg', [.15 * sign, .56, 0]], [side + 'Foot', side + 'LowerLeg', [.15 * sign, .13, 0]]]; }),
];
const index = new Map(definitions.map(([name], i) => [name, i]));
const nodes = definitions.map(([name, parent, position]) => ({ name, translation: position.map((v, i) => v - (parent ? definitions[index.get(parent)][2][i] : 0)), children: definitions.flatMap(([child, p], i) => p === name ? [i] : []) }));
const json = { asset: { version: '2.0', generator: 'Blend Studio project-owned VRMA fixture' }, scene: 0, scenes: [{ nodes: [0] }], nodes, extensionsUsed: ['VRMC_vrm_animation'], extensions: { VRMC_vrm_animation: { specVersion: '1.0', humanoid: { humanBones: Object.fromEntries([...index].map(([name, node]) => [name, { node }])) } } }, buffers: [], bufferViews: [], accessors: [], animations: [{ channels: [], samplers: [] }] };
let length = 0; const parts = [];
function accessor(values, type, min, max) {
  const buffer = Buffer.from(new Float32Array(values).buffer); parts.push(buffer);
  const view = json.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: buffer.length }) - 1; length += buffer.length;
  return json.accessors.push({ bufferView: view, componentType: 5126, count: values.length / ({ SCALAR: 1, VEC3: 3, VEC4: 4 }[type]), type, ...(min ? { min, max } : {}) }) - 1;
}
const input = accessor([0, .5, 1, 1.5, 2], 'SCALAR', [0], [2]);
for (const [bone, axis, angles] of [['rightUpperArm', 2, [0, -.8, -.8, -.8, 0]], ['rightLowerArm', 1, [0, .3, -.3, .3, 0]]]) {
  const values = angles.flatMap(angle => [axis === 0 ? Math.sin(angle / 2) : 0, axis === 1 ? Math.sin(angle / 2) : 0, axis === 2 ? Math.sin(angle / 2) : 0, Math.cos(angle / 2)]);
  const output = accessor(values, 'VEC4'), sampler = json.animations[0].samplers.push({ input, output, interpolation: 'LINEAR' }) - 1;
  json.animations[0].channels.push({ sampler, target: { node: index.get(bone), path: 'rotation' } });
}
const hips = accessor([0, 1, 0, 0, 1.03, 0, 0, 1, 0, 0, 1.03, 0, 0, 1, 0], 'VEC3');
json.animations[0].channels.push({ sampler: json.animations[0].samplers.push({ input, output: hips, interpolation: 'LINEAR' }) - 1, target: { node: 0, path: 'translation' } });
json.buffers.push({ byteLength: length });
const encoded = Buffer.from(JSON.stringify(json)), body = Buffer.alloc(Math.ceil(encoded.length / 4) * 4, 32); encoded.copy(body);
const binary = Buffer.concat(parts), file = Buffer.alloc(28 + body.length + binary.length);
file.writeUInt32LE(0x46546c67); file.writeUInt32LE(2, 4); file.writeUInt32LE(file.length, 8); file.writeUInt32LE(body.length, 12); file.writeUInt32LE(0x4e4f534a, 16); body.copy(file, 20);
file.writeUInt32LE(binary.length, 20 + body.length); file.writeUInt32LE(0x004e4942, 24 + body.length); binary.copy(file, 28 + body.length);
await writeFile(fileURLToPath(new URL('../assets/wave-test.vrma', import.meta.url)), file);
console.log('Project-owned wave-test.vrma generated.');
