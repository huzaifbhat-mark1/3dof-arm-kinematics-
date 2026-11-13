export const LIMITS = Object.freeze({ base: [-180, 180], shoulder: [-55, 85], elbow: [-100, 100], gripper: [0, 100] });
export const HOME = Object.freeze({ base: 25, shoulder: 25, elbow: 45, gripper: 65 });
export const DIMENSIONS = Object.freeze({ base: 1.1, upper: 2.3, forearm: 2.0, tool: 0.65, cmPerUnit: 10 });
export const MAX_POSES = 40;
export const STARTER = [
  { id: 'ready', name: 'Ready', duration: 1.8, values: { ...HOME } },
  { id: 'reach', name: 'Reach', duration: 2.2, values: { base: -25, shoulder: 65, elbow: 20, gripper: 100 } },
  { id: 'grasp', name: 'Grasp', duration: 1.2, values: { base: -25, shoulder: 65, elbow: 20, gripper: 0 } },
  { id: 'lift', name: 'Lift', duration: 2.0, values: { base: 55, shoulder: 5, elbow: 65, gripper: 0 } },
];
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export function sanitizeValues(values) {
  if (!values || typeof values !== 'object') throw new Error('Missing joint values.');
  const result = {};
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    if (typeof values[key] !== 'number' || !Number.isFinite(values[key])) throw new Error(`Invalid ${key} value.`);
    if (values[key] < min || values[key] > max) throw new Error(`${key} must be between ${min} and ${max}.`);
    result[key] = values[key];
  }
  return result;
}
export function validateProject(input) {
  if (!input || input.version !== 1 || !Array.isArray(input.poses)) throw new Error('Choose an Arm Lab JSON file (version 1).');
  if (input.poses.length > MAX_POSES) throw new Error(`A sequence can have up to ${MAX_POSES} poses.`);
  const ids = new Set();
  return input.poses.map((pose, index) => {
    if (!pose || typeof pose.name !== 'string' || !pose.name.trim() || pose.name.trim().length > 32) throw new Error(`Pose ${index + 1} needs a name of 1–32 characters.`);
    if (typeof pose.duration !== 'number' || !Number.isFinite(pose.duration) || pose.duration < 0.3 || pose.duration > 15) throw new Error(`Pose ${index + 1} needs a duration of 0.3–15 seconds.`);
    let id = typeof pose.id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(pose.id) ? pose.id : `pose-${index}`;
    while (ids.has(id)) id += '-copy';
    ids.add(id);
    return { id, name: pose.name.trim(), duration: pose.duration, values: sanitizeValues(pose.values) };
  });
}
export function forwardKinematics(values) {
  const d = DIMENSIONS, radians = Math.PI / 180;
  const shoulder = values.shoulder * radians, elbow = (values.shoulder + values.elbow) * radians, yaw = values.base * radians;
  const reach = d.upper * Math.sin(shoulder) + (d.forearm + d.tool) * Math.sin(elbow);
  return { x: reach * Math.cos(yaw) * d.cmPerUnit, y: (d.base + d.upper * Math.cos(shoulder) + (d.forearm + d.tool) * Math.cos(elbow)) * d.cmPerUnit, z: -reach * Math.sin(yaw) * d.cmPerUnit };
}
export function interpolate(a, b, progress) {
  const t = clamp(progress, 0, 1), eased = t * t * (3 - 2 * t);
  return Object.fromEntries(Object.keys(LIMITS).map(key => [key, a[key] + (b[key] - a[key]) * eased]));
}
// Durations belong to destinations: each pose specifies how long it takes to reach it.
export function sampleSequence(start, poses, elapsed, loop = false) {
  if (!poses.length) return { values: { ...start }, index: -1, progress: 0, done: true, total: 0, elapsed: 0 };
  const total = poses.reduce((sum, pose) => sum + pose.duration, 0);
  const safeElapsed = Math.max(0, elapsed);
  if (!loop && safeElapsed >= total) return { values: { ...poses.at(-1).values }, index: poses.length - 1, progress: 1, done: true, total, elapsed: total };
  const lap = Math.floor(safeElapsed / total);
  let local = loop ? safeElapsed % total : safeElapsed;
  const displayElapsed = local;
  let previous = loop && lap > 0 ? poses.at(-1).values : start;
  for (let index = 0; index < poses.length; index++) {
    const pose = poses[index];
    if (local < pose.duration) return { values: interpolate(previous, pose.values, local / pose.duration), index, progress: local / pose.duration, done: false, total, elapsed: displayElapsed };
    local -= pose.duration;
    previous = pose.values;
  }
  return { values: { ...poses.at(-1).values }, index: poses.length - 1, progress: 1, done: true, total, elapsed: total };
}
