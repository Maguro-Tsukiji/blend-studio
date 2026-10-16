export const VIEW_NAMES = { front: '正面', left: '左側面', right: '右側面', back: '背面', free: '3D' };
export function viewDirection(view, frontYaw = 0) {
  const offset = { front: 0, left: Math.PI / 2, right: -Math.PI / 2, back: Math.PI }[view];
  if (offset === undefined) throw new Error('不明な視点です。');
  return [Math.sin(frontYaw + offset), 0, Math.cos(frontYaw + offset)];
}
export function orthographicFrame(size, aspect, direction) {
  const width = Math.abs(direction[2]) * size[0] + Math.abs(direction[0]) * size[2];
  const halfHeight = Math.max(size[1] / 2, width / (2 * Math.max(aspect, .1)), .005) * 1.18;
  return { left: -halfHeight * aspect, right: halfHeight * aspect, top: halfHeight, bottom: -halfHeight };
}
