import { Vector3 } from 'three';

// Store the hit on the preview triangle, independent of camera and scene framing.
// getVertexPosition also accounts for morph targets and a SkinnedMesh's pose.
export function surfacePosition(target, space = 'world', result = new Vector3()) {
  const vertex = new Vector3();
  result.set(0, 0, 0);
  target.vertices.forEach((index, i) => result.addScaledVector(target.mesh.getVertexPosition(index, vertex), target.barycentric[i]));
  if (space === 'world') result.applyMatrix4(target.mesh.matrixWorld);
  return result;
}

export function createSurfaceTarget(hit, meshIndex) {
  if (!hit?.face || !hit.barycoord || meshIndex < 0) return null;
  const original = hit.object.userData.originalMaterials || (Array.isArray(hit.object.material) ? hit.object.material : [hit.object.material]);
  const material = original[hit.face.materialIndex || 0];
  if (!material || material.isOutline || !hit.barycoord.toArray().every(Number.isFinite)) return null;
  return {
    mesh: hit.object, meshIndex, vertices: [hit.face.a, hit.face.b, hit.face.c],
    triangleIndex: hit.faceIndex, barycentric: hit.barycoord.toArray(),
    uv: hit.uv?.toArray(), material,
  };
}

export function surfaceTargetData(target) {
  if (!target) return null;
  const { mesh, material } = target;
  return {
    kind: 'surface-point', label: '①', coordinateSpace: 'preview-mesh-local-posed',
    object: { index: target.meshIndex, name: mesh.userData.sourceName || mesh.name, gltfIndex: mesh.userData.gltfIndex, gltfMeshIndex: mesh.userData.gltfMeshIndex, gltfPrimitiveIndex: mesh.userData.gltfPrimitiveIndex },
    material: { name: material.name, gltfIndex: material.userData.gltfIndex },
    localPosition: surfacePosition(target, 'local').toArray(),
    triangleIndex: target.triangleIndex, vertexIndices: target.vertices, barycentric: target.barycentric, uv: target.uv,
  };
}
