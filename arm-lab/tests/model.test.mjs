import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { HOME, STARTER, DIMENSIONS, validateProject, sampleSequence, forwardKinematics, interpolate } from '../model.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} should equal ${expected}`);
test('straight-up arm has the expected height; yaw rotates reach but not height', () => {
  const upright = forwardKinematics({ ...HOME, base: 0, shoulder: 0, elbow: 0 });
  near(upright.x, 0); near(upright.z, 0); near(upright.y, 60.5);
  const front = forwardKinematics({ ...HOME, base: 0 });
  const side = forwardKinematics({ ...HOME, base: 90 });
  near(side.x, 0); near(side.z, -front.x); near(side.y, front.y);
});
test('coordinates match independently composed 3D transforms across legal joint angles', () => {
  for (const base of [-180, -30, 0, 90, 180]) for (const shoulder of [-55, 0, 25, 85]) for (const elbow of [-100, 0, 45, 100]) {
    const root = new THREE.Object3D(); root.position.y = DIMENSIONS.base; root.rotation.y = THREE.MathUtils.degToRad(base);
    const upper = new THREE.Object3D(); upper.rotation.z = -THREE.MathUtils.degToRad(shoulder); root.add(upper);
    const forearm = new THREE.Object3D(); forearm.position.y = DIMENSIONS.upper; forearm.rotation.z = -THREE.MathUtils.degToRad(elbow); upper.add(forearm);
    const tip = new THREE.Object3D(); tip.position.y = DIMENSIONS.forearm + DIMENSIONS.tool; forearm.add(tip);
    const world = new THREE.Vector3(); tip.getWorldPosition(world);
    const actual = forwardKinematics({ base, shoulder, elbow, gripper: 50 });
    near(actual.x, world.x * 10); near(actual.y, world.y * 10); near(actual.z, world.z * 10);
  }
});
test('interpolation is bounded, has correct endpoints, and uses the mechanical range', () => {
  const a = { ...HOME, base: 170 }, b = { ...HOME, base: -170 };
  assert.deepEqual(interpolate(a, b, -2), a); assert.deepEqual(interpolate(a, b, 2), b);
  near(interpolate(a, b, .5).base, 0);
  // A limited-travel joint moves through its legal range rather than wrapping past an end stop.
  for (let i = 0; i <= 100; i++) assert.ok(Math.abs(interpolate(a, b, i / 100).base) <= 180);
});
test('sequence duration belongs to its destination and reaches exact final targets', () => {
  const poses = [ { ...STARTER[1], duration: 2 }, { ...STARTER[3], duration: 3 } ];
  assert.deepEqual(sampleSequence(HOME, poses, 0).values, HOME);
  assert.deepEqual(sampleSequence(HOME, poses, 2).values, poses[0].values);
  assert.equal(sampleSequence(HOME, poses, 2).index, 1);
  const final = sampleSequence(HOME, poses, 100);
  assert.equal(final.done, true); assert.deepEqual(final.values, poses[1].values); assert.equal(final.elapsed, 5);
});
test('loop joins last to first without jumping to the original starting position', () => {
  const poses = [ { ...STARTER[1], duration: 2 }, { ...STARTER[3], duration: 3 } ];
  const boundary = sampleSequence(HOME, poses, 5, true);
  assert.equal(boundary.done, false); assert.equal(boundary.index, 0); assert.deepEqual(boundary.values, poses[1].values);
  assert.deepEqual(sampleSequence(HOME, poses, 6, true).values, interpolate(poses[1].values, poses[0].values, .5));
  assert.deepEqual(sampleSequence(HOME, poses, 12, true).values, poses[0].values);
});
test('empty and single-pose sequences remain well-defined', () => {
  assert.equal(sampleSequence(HOME, [], 12, true).done, true);
  assert.deepEqual(sampleSequence(HOME, [STARTER[1]], 100).values, STARTER[1].values);
  assert.deepEqual(validateProject({ version: 1, poses: [] }), []);
});
test('project validation rejects malformed, oversized, unsafe or non-finite motion data', () => {
  assert.deepEqual(validateProject({ version: 1, poses: STARTER }), STARTER);
  const bad = change => ({ version: 1, poses: [{ ...STARTER[0], ...change }] });
  for (const project of [null, {}, { version: 2, poses: STARTER }, bad({ duration: 0 }), bad({ duration: Infinity }), bad({ name: '  ' }), bad({ name: 'x'.repeat(33) }), bad({ values: { ...HOME, base: 181 } }), bad({ values: { ...HOME, gripper: NaN } }), bad({ values: { ...HOME, elbow: '45' } }), { version: 1, poses: Array(41).fill(STARTER[0]) }]) assert.throws(() => validateProject(project));
});
test('project validation assigns safe unique IDs and preserves user text as data', () => {
  const poses = validateProject({ version: 1, poses: [{ ...STARTER[0], id: '<unsafe>', name: '<img src=x onerror=alert(1)>' }, { ...STARTER[0], id: '<unsafe>' }] });
  assert.equal(poses[0].id, 'pose-0'); assert.equal(poses[1].id, 'pose-1');
  assert.equal(poses[0].name, '<img src=x onerror=alert(1)>');
  assert.equal(new Set(validateProject({ version: 1, poses: [STARTER[0], STARTER[0]] }).map(p => p.id)).size, 2);
});
