import test from 'node:test';
import assert from 'node:assert/strict';
import { Bone, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, Raycaster, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3 } from 'three';
import { createSurfaceTarget, surfacePosition, surfaceTargetData, SurfaceTargets } from '../src/surface-target.mjs';

const near = (a, b) => a.forEach((value, i) => assert.ok(Math.abs(value - b[i]) < 1e-6, `${a} != ${b}`));
function triangle(indexed = true) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 4, 0, 0, 0, 4, 0], 3));
  geometry.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
  if (indexed) geometry.setIndex([0, 1, 2]);
  return geometry;
}
const cast = (mesh, point) => new Raycaster(point.clone().add(new Vector3(0, 0, 5)), new Vector3(0, 0, -1)).intersectObject(mesh, false)[0];

test('multiple points keep independent coordinates and stable labels after deletion and obey the per-tab limit', () => {
  const mesh = new Mesh(triangle(), new MeshBasicMaterial()); mesh.updateMatrixWorld(true);
  const targets = new SurfaceTargets(), first = targets.add(createSurfaceTarget(cast(mesh, new Vector3(1, 1, 0)), 0)), second = targets.add(createSurfaceTarget(cast(mesh, new Vector3(2, 1, 0)), 0));
  assert.deepEqual(targets.data().map(point => point.label), ['①', '②']);
  near(targets.data()[0].localPosition, [1, 1, 0]); near(targets.data()[1].localPosition, [2, 1, 0]);
  targets.remove(first.id); assert.equal(targets.items[0].id, second.id);
  const third = targets.add(createSurfaceTarget(cast(mesh, new Vector3(1, 2, 0)), 0)); assert.equal(third.label, '③');
  for (let i = 0; i < 6; i++) targets.add(createSurfaceTarget(cast(mesh, new Vector3(1, 1, 0)), 0));
  assert.throws(() => targets.add({}), /8か所/); assert.equal(targets.items.length, 8);
  targets.clear(); assert.equal(targets.data().length, 0);
  assert.notEqual(targets.add(createSurfaceTarget(cast(mesh, new Vector3(1, 1, 0)), 0)).label, '①');
});

test('a hit remains in mesh-local coordinates despite preview centering, rotation and scale', () => {
  const mesh = new Mesh(triangle(), new MeshBasicMaterial()); mesh.name = 'Primitive';
  mesh.userData = { sourceName: 'Hair', gltfIndex: 7, gltfMeshIndex: 3, gltfPrimitiveIndex: 1 };
  mesh.material.name = 'Hair material'; mesh.material.userData.gltfIndex = 2;
  const frame = new Group(); frame.position.set(-9, 3, 2); frame.rotation.z = .3; frame.scale.set(2, 3, 1); frame.add(mesh); frame.updateMatrixWorld(true);
  const point = mesh.localToWorld(new Vector3(1, 1, 0));
  const target = createSurfaceTarget(cast(mesh, point), 4), data = surfaceTargetData(target);
  near(data.localPosition, [1, 1, 0]); near(data.barycentric, [.5, .25, .25]); near(data.uv, [.25, .25]);
  assert.deepEqual(data.object, { index: 4, name: 'Hair', gltfIndex: 7, gltfMeshIndex: 3, gltfPrimitiveIndex: 1 });
  assert.deepEqual(data.material, { name: 'Hair material', gltfIndex: 2 });
  frame.position.x = 40; frame.updateMatrixWorld(true);
  near(surfacePosition(target).toArray(), mesh.localToWorld(new Vector3(1, 1, 0)).toArray());
  near(surfaceTargetData(target).localPosition, [1, 1, 0]);
  assert.equal(JSON.stringify(data).includes('matrixWorld'), false);
});

test('non-indexed grouped meshes report the hit material and ignore MToon outlines', () => {
  const geometry = triangle(false); geometry.addGroup(0, 3, 1);
  const base = new MeshBasicMaterial(), hair = new MeshBasicMaterial(), outline = new MeshBasicMaterial();
  hair.name = 'Hair'; outline.isOutline = true;
  const mesh = new Mesh(geometry, [base, hair, outline]); mesh.userData.originalMaterials = [base, hair, outline]; mesh.updateMatrixWorld(true);
  const hit = cast(mesh, new Vector3(1, 1, 0)), target = createSurfaceTarget(hit, 0);
  assert.equal(surfaceTargetData(target).material.name, 'Hair'); assert.deepEqual(target.vertices, [0, 1, 2]);
  assert.equal(createSurfaceTarget({ ...hit, face: { ...hit.face, materialIndex: 2 } }, 0), null);
  assert.equal(createSurfaceTarget(undefined, -1), null);
});

test('surface anchors follow morph targets and the current skinned pose', () => {
  const geometry = triangle();
  geometry.morphTargetsRelative = true; geometry.morphAttributes.position = [new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3)];
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Array(12).fill(0), 4));
  geometry.setAttribute('skinWeight', new Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
  const mesh = new SkinnedMesh(geometry, new MeshBasicMaterial()), bone = new Bone(); mesh.add(bone); mesh.updateMatrixWorld(true); mesh.bind(new Skeleton([bone]));
  bone.position.z = 2; mesh.morphTargetInfluences[0] = .5; mesh.updateMatrixWorld(true);
  const target = createSurfaceTarget(cast(mesh, new Vector3(1, 1, 2.5)), 0);
  near(surfaceTargetData(target).localPosition, [1, 1, 2.5]);
  bone.position.z = 3; mesh.morphTargetInfluences[0] = 1; mesh.updateMatrixWorld(true);
  near(surfacePosition(target).toArray(), [1, 1, 4]);
});
