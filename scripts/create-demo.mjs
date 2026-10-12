import * as THREE from 'three';
import { deflateSync } from 'node:zlib';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../', import.meta.url);
await mkdir(new URL('assets/', root), { recursive: true });
const chunks = [], bufferViews = [], accessors = []; let size = 0;
const addBytes = (bytes, target) => { const padded = Buffer.alloc(Math.ceil(bytes.length / 4) * 4); bytes.copy(padded); const index = bufferViews.length; bufferViews.push({ buffer: 0, byteOffset: size, byteLength: bytes.length, ...(target ? { target } : {}) }); chunks.push(padded); size += padded.length; return index; };
const addAttribute = (attribute, type) => { const array = attribute.array, buf = Buffer.from(array.buffer, array.byteOffset, array.byteLength); const index = accessors.length; const accessor = { bufferView: addBytes(buf, 34962), componentType: 5126, count: attribute.count, type }; if (type === 'VEC3') { accessor.min = [Infinity, Infinity, Infinity]; accessor.max = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < array.length; i += 3) for (let k = 0; k < 3; k++) { accessor.min[k] = Math.min(accessor.min[k], array[i+k]); accessor.max[k] = Math.max(accessor.max[k], array[i+k]); } } accessors.push(accessor); return index; };
function crc32(buf) { let c = 0xffffffff; for (const b of buf) { c ^= b; for (let i = 0; i < 8; i++) c = c >>> 1 ^ (c & 1 ? 0xedb88320 : 0); } return (c ^ 0xffffffff) >>> 0; }
function pngChunk(type, data) { const b = Buffer.alloc(data.length + 12); b.writeUInt32BE(data.length); b.write(type, 4); data.copy(b, 8); b.writeUInt32BE(crc32(b.subarray(4, 8 + data.length)), 8 + data.length); return b; }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(4, 0); ihdr.writeUInt32BE(4, 4); ihdr[8] = 8; ihdr[9] = 6;
const rows = Buffer.alloc(4 * 17); for (let y=0;y<4;y++) for(let x=0;x<4;x++){ const p=y*17+1+x*4; const v=(x+y)%2 ? 215:255; rows.set([v,v,255,255],p); }
const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), pngChunk('IHDR',ihdr),pngChunk('IDAT',deflateSync(rows)),pngChunk('IEND',Buffer.alloc(0))]);
const imageView = addBytes(png);
const mtoon = (name, color, shade, texture = false) => ({ name, pbrMetallicRoughness: { baseColorFactor: [...color, 1], ...(texture ? { baseColorTexture: { index: 0 } } : {}), metallicFactor: 0, roughnessFactor: .65 }, extensions: { VRMC_materials_mtoon: { specVersion: '1.0', shadeColorFactor: shade, shadingShiftFactor: 0, shadingToonyFactor: .8, giEqualizationFactor: .85, parametricRimColorFactor: [.25,.18,.4], parametricRimFresnelPowerFactor: 3, parametricRimLiftFactor: 0, rimLightingMixFactor: .7, outlineWidthMode: 'worldCoordinates', outlineWidthFactor: .004, outlineColorFactor: [.10,.07,.20], outlineLightingMixFactor: .1 } } });
const materials = [mtoon('Lavender Shell', [.67,.48,.92],[.30,.17,.52], true), mtoon('Soft Lilac', [.82,.73,.98],[.44,.30,.64]), { name:'Obsidian Visor', pbrMetallicRoughness:{baseColorFactor:[.035,.045,.09,1],metallicFactor:.85,roughnessFactor:.17} }, {name:'Mint Signal',pbrMetallicRoughness:{baseColorFactor:[.38,1,.86,1],metallicFactor:.2,roughnessFactor:.25},emissiveFactor:[.08,.6,.4]}, {name:'Warm Brass',pbrMetallicRoughness:{baseColorFactor:[.95,.7,.36,1],metallicFactor:.7,roughnessFactor:.33}},mtoon('Deep Violet', [.23,.16,.39],[.10,.06,.2])];
const meshes = [], nodes = [];
const add = (name, geometry, material, translation, scale, rotation) => { const geo = geometry.toNonIndexed(); const attributes = {POSITION:addAttribute(geo.attributes.position,'VEC3'),NORMAL:addAttribute(geo.attributes.normal,'VEC3'),TEXCOORD_0:addAttribute(geo.attributes.uv,'VEC2')}; const index = meshes.length; meshes.push({name,primitives:[{attributes,material}]}); nodes.push({name,mesh:index,translation,...(scale?{scale}:{}),...(rotation?{rotation}:{}),extras:{sourceObject:name}}); geo.dispose(); geometry.dispose(); };
add('Body',new THREE.SphereGeometry(.6,32,20),0,[0,.95,0],[1,1.07,.87]);
add('Helmet',new THREE.SphereGeometry(.69,40,24),1,[0,1.94,0],[1,.83,.93]);
add('Visor',new THREE.SphereGeometry(.58,36,20),2,[0,1.96,.62],[.98,.58,.32]);
add('Eye · left',new THREE.CapsuleGeometry(.04,.12,5,12),3,[-.19,1.99,.835]);
add('Eye · right',new THREE.CapsuleGeometry(.04,.12,5,12),3,[.19,1.99,.835]);
add('Arm · left',new THREE.CapsuleGeometry(.16,.30,8,18),0,[-.67,.99,0],[1,1,1],new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),-.24).toArray());
add('Arm · right',new THREE.CapsuleGeometry(.16,.30,8,18),0,[.67,.99,0],[1,1,1],new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),.24).toArray());
add('Boot · left',new THREE.CapsuleGeometry(.18,.23,8,18),5,[-.24,.33,.05],[1,1,1.3]);
add('Boot · right',new THREE.CapsuleGeometry(.18,.23,8,18),5,[.24,.33,.05],[1,1,1.3]);
add('Chest Emblem',new THREE.TorusGeometry(.115,.018,12,32),4,[0,1.12,.51]);
add('Antenna',new THREE.CylinderGeometry(.021,.021,.24,12),4,[0,2.59,0]);
add('Signal Orb',new THREE.SphereGeometry(.07,16,12),3,[0,2.75,0]);
const json = { asset:{version:'2.0',generator:'Blend Studio demo fixture'},scene:0,scenes:[{name:'Studio Companion',nodes:nodes.map((_,i)=>i)}],nodes,meshes,materials,textures:[{source:0}],images:[{bufferView:imageView,mimeType:'image/png'}],bufferViews,accessors,buffers:[{byteLength:size}],extensionsUsed:['VRMC_materials_mtoon'] };
const jsonBytes = Buffer.from(JSON.stringify(json)); const paddedJson = Buffer.alloc(Math.ceil(jsonBytes.length/4)*4,32); jsonBytes.copy(paddedJson);
const bin = Buffer.concat(chunks), out = Buffer.alloc(12+8+paddedJson.length+8+bin.length); out.writeUInt32LE(0x46546c67);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(paddedJson.length,12);out.writeUInt32LE(0x4e4f534a,16);paddedJson.copy(out,20);const at=20+paddedJson.length;out.writeUInt32LE(bin.length,at);out.writeUInt32LE(0x004e4942,at+4);bin.copy(out,at+8);
await writeFile(new URL('assets/studio-companion.glb',root),out);
await writeFile(new URL('assets/demo-base64.json',root),JSON.stringify(out.toString('base64')));
console.log('Textured PBR + MToon demo generated:',out.length,'bytes');
