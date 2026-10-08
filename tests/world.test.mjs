import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScene } from '../dist/world.js';
import { createState } from '../dist/simulation.js';
test('the scene contains eleven 3D camels with four articulated legs each', () => {
  const state = createState(), world = buildScene(state);
  assert.equal(world.camels.size, 11);
  for (const c of state.camels) {
    const model = world.camels.get(c.id); assert.equal(model.legs.length, 4);
    assert.ok(world.scene.getObjectByName('camel-' + c.id));
  }
  assert.equal(world.camera.rotation.order, 'YXZ');
});
test('scene geometry has finite positions and uses instancing for landscape detail', () => {
  const world = buildScene(createState());
  let instances = 0, meshCount = 0;
  world.scene.traverse(node => {
    if (node.isInstancedMesh) instances++;
    if (node.isMesh) {
      meshCount++;
      const positions = node.geometry.getAttribute('position');
      assert.ok(positions && positions.count > 0);
      for (const value of positions.array) assert.ok(Number.isFinite(value));
      assert.ok(Number.isFinite(node.position.y));
    }
  });
  assert.equal(instances, 4); assert.ok(meshCount < 440);
  assert.ok(world.targetRing.geometry.getAttribute('position').count > 0);
});
