import test from 'node:test';
import assert from 'node:assert/strict';
import { viewDirection, orthographicFrame } from '../src/camera-views.mjs';
const near = (a, b) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-6));
test('front, character-left, character-right and back respect the configured front axis', () => {
  near(viewDirection('front'), [0, 0, 1]); near(viewDirection('left'), [1, 0, 0]); near(viewDirection('right'), [-1, 0, 0]); near(viewDirection('back'), [0, 0, -1]);
  near(viewDirection('front', Math.PI), [0, 0, -1]); near(viewDirection('left', Math.PI), [-1, 0, 0]);
});
test('orthographic framing fits wide front views and narrow side/mobile views without perspective distortion', () => {
  for (const direction of [viewDirection('front'), viewDirection('left')]) for (const aspect of [.4, 1, 2]) {
    const bounds = orthographicFrame([4, 2, 1], aspect, direction);
    assert.ok(bounds.top * 2 >= 2); assert.ok(bounds.right * 2 >= (Math.abs(direction[2]) * 4 + Math.abs(direction[0])));
  }
});
