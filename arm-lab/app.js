import { LIMITS, HOME, STARTER, MAX_POSES, clamp, validateProject, forwardKinematics, sampleSequence } from './model.js';

const $ = id => document.getElementById(id);
const STORAGE_KEY = 'arm-lab.project.v1';
let poses = structuredClone(STARTER), values = { ...HOME }, selectedId = 'ready';
let playback = null, lastFrame = 0, editingId = null, pendingImport = null, toastTimer;
let poseSnapshot = null, view = null, storageAvailable = true;
function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3400); }
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved !== null) { poses = validateProject(JSON.parse(saved)); selectedId = null; }
} catch { storageAvailable = false; setTimeout(() => toast('Browser storage could not be loaded. Export your poses to keep a copy.'), 800); }

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, poses })); storageAvailable = true; }
  catch { storageAvailable = false; toast('Browser storage is unavailable. Use Export to keep your poses.'); }
  $('saveCaption').textContent = storageAvailable ? 'Saved on this browser. Ready when you are.' : 'Use Export to keep a copy of your poses.';
}
function setPose(next, sync = true) {
  values = { ...next };
  view?.setPose(values);
  if (sync) for (const [key, [min, max]] of Object.entries(LIMITS)) {
    $(key).value = values[key]; $(key + 'Number').value = Math.round(values[key]);
    $(key).style.setProperty('--fill', `${(values[key] - min) / (max - min) * 100}%`);
  }
  const position = forwardKinematics(values);
  for (const axis of ['x', 'y', 'z']) $('pos' + axis.toUpperCase()).textContent = (Math.abs(position[axis]) < .05 ? 0 : position[axis]).toFixed(1);
  $('clearanceWarning').hidden = position.y >= 0;
}
function updatePlaybackUI(sample) {
  const playing = playback?.state === 'playing', paused = playback?.state === 'paused';
  $('playText').textContent = playing ? 'Pause sequence' : paused ? 'Resume sequence' : 'Play sequence';
  $('playIcon').textContent = playing ? 'Ⅱ' : '▶';
  $('playButton').disabled = !poses.length;
  $('stopButton').disabled = !playback;
  $('motionStatus').textContent = playing ? 'Sequence running' : paused ? 'Sequence paused' : 'Manual control';
  $('motionDot').classList.toggle('playing', playing);
  const total = poses.reduce((sum, pose) => sum + pose.duration, 0);
  $('total').textContent = (total / Number($('speed').value)).toFixed(1);
  const elapsed = sample?.elapsed ?? 0;
  $('elapsed').textContent = (elapsed / Number($('speed').value)).toFixed(1);
  const percentage = total ? clamp(elapsed / total, 0, 1) * 100 : 0;
  $('progressFill').style.width = percentage + '%';
  document.querySelector('.progress-track').setAttribute('aria-valuenow', String(Math.round(percentage)));
  document.querySelectorAll('.pose-card').forEach((card, index) => card.classList.toggle('is-playing', !!playback && sample?.index === index));
}
function stopPlayback(restore = false) {
  const start = playback?.start;
  playback = null;
  if (restore && start) setPose(start);
  updatePlaybackUI();
}
function selectPose(id) {
  const pose = poses.find(p => p.id === id); if (!pose) return;
  stopPlayback(); selectedId = id; setPose(pose.values); renderPoses();
}
function button(label, action, id, title) {
  const element = document.createElement('button'); element.type = 'button'; element.textContent = label; element.dataset.action = action; element.dataset.id = id; element.title = title; element.setAttribute('aria-label', title); return element;
}
function renderPoses() {
  const list = $('poseList'); list.replaceChildren();
  $('poseCount').textContent = `${poses.length} pose${poses.length === 1 ? '' : 's'}`;
  poses.forEach((pose, index) => {
    const card = document.createElement('article'); card.className = 'pose-card'; card.classList.toggle('selected', pose.id === selectedId); card.dataset.id = pose.id;
    const select = button('', 'select', pose.id, `Load pose ${pose.name}`); select.className = 'pose-select'; select.setAttribute('aria-pressed', String(pose.id === selectedId));
    const upper = document.createElement('span'); upper.className = 'pose-upper';
    const order = document.createElement('span'); order.className = 'pose-order'; order.textContent = String(index + 1).padStart(2, '0');
    const duration = document.createElement('span'); duration.textContent = pose.duration.toFixed(1) + 's'; upper.append(order, duration);
    const name = document.createElement('span'); name.className = 'pose-name'; name.textContent = pose.name;
    const positions = document.createElement('span'); positions.className = 'pose-values';
    for (const [label, key, suffix] of [['B', 'base', '°'], ['S', 'shoulder', '°'], ['E', 'elbow', '°'], ['G', 'gripper', '%']]) { const item = document.createElement('span'); item.textContent = `${label} ${Math.round(pose.values[key])}${suffix}`; positions.append(item); }
    select.append(upper, name, positions); card.append(select);
    const actions = document.createElement('div'); actions.className = 'pose-actions';
    const update = button('↻ Update', 'update', pose.id, `Replace ${pose.name} with current joint positions`);
    const edit = button('✎', 'edit', pose.id, `Edit ${pose.name}`);
    const left = button('←', 'left', pose.id, `Move ${pose.name} earlier`); left.disabled = index === 0;
    const right = button('→', 'right', pose.id, `Move ${pose.name} later`); right.disabled = index === poses.length - 1;
    actions.append(update, edit, left, right, button('×', 'delete', pose.id, `Delete ${pose.name}`)); card.append(actions); list.append(card);
  });
  if (!poses.length) { const empty = document.createElement('p'); empty.className = 'empty-poses'; empty.textContent = 'Your sequence starts here. Adjust the joints, then save your first pose.'; list.append(empty); }
  const add = button('', 'add', '', 'Add current pose'); add.className = 'add-pose-card'; add.disabled = poses.length >= MAX_POSES;
  const plus = document.createElement('span'); plus.textContent = '+'; const text = document.createElement('small'); text.textContent = 'Add pose'; add.append(plus, text); list.append(add);
  $('saveButton').disabled = poses.length >= MAX_POSES;
  updatePlaybackUI(playback ? sampleSequence(playback.start, poses, playback.elapsed, $('loop').checked) : undefined);
}
function openPoseDialog(id = null) {
  if (!id && poses.length >= MAX_POSES) { toast(`Maximum ${MAX_POSES} poses. Export or remove some first.`); return; }
  if (playback?.state === 'playing') togglePlayback();
  editingId = id; const pose = poses.find(p => p.id === id); poseSnapshot = { ...values };
  $('poseDialogTitle').textContent = pose ? 'Edit pose details' : 'Save a pose';
  $('poseName').value = pose?.name || `Pose ${poses.length + 1}`; $('poseDuration').value = pose?.duration ?? 2;
  $('poseSubmit').textContent = pose ? 'Save changes' : 'Save pose';
  $('poseDialogNote').textContent = pose ? 'This edits the name and duration. Use Update on the pose card to replace its joint positions.' : 'The current joint positions will be saved with this pose.';
  $('poseDialog').showModal(); $('poseName').focus(); $('poseName').select();
}
$('poseForm').addEventListener('submit', event => {
  event.preventDefault(); const name = $('poseName').value.trim(); if (!name) { $('poseName').setCustomValidity('Give your pose a name.'); $('poseName').reportValidity(); return; }
  const duration = Number($('poseDuration').value); if (!Number.isFinite(duration) || duration < .3 || duration > 15) return;
  stopPlayback();
  if (editingId) { const pose = poses.find(p => p.id === editingId); if (pose) { pose.name = name; pose.duration = duration; } }
  else { const pose = { id: crypto.randomUUID(), name, duration, values: { ...poseSnapshot } }; poses.push(pose); selectedId = pose.id; }
  persist(); renderPoses(); $('poseDialog').close(); toast(editingId ? 'Pose details updated.' : `“${name}” saved to your sequence.`);
  const cards = $('poseList').querySelectorAll('.pose-card'); if (!editingId) cards[cards.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
});
$('poseName').addEventListener('input', () => $('poseName').setCustomValidity(''));
$('poseList').addEventListener('click', event => {
  const action = event.target.closest('button[data-action]'); if (!action || action.disabled) return;
  const id = action.dataset.id, index = poses.findIndex(p => p.id === id);
  if (action.dataset.action === 'add') return openPoseDialog();
  if (index < 0) return;
  if (action.dataset.action === 'select') return selectPose(id);
  if (action.dataset.action === 'edit') return openPoseDialog(id);
  stopPlayback();
  if (action.dataset.action === 'delete') { const name = poses[index].name; poses.splice(index, 1); if (selectedId === id) selectedId = null; toast(`“${name}” removed.`); }
  if (action.dataset.action === 'update') { poses[index].values = { ...values }; selectedId = id; toast(`“${poses[index].name}” updated to the current position.`); }
  if (action.dataset.action === 'left' && index > 0) [poses[index - 1], poses[index]] = [poses[index], poses[index - 1]];
  if (action.dataset.action === 'right' && index < poses.length - 1) [poses[index + 1], poses[index]] = [poses[index], poses[index + 1]];
  persist(); renderPoses();
});
for (const [key, [min, max]] of Object.entries(LIMITS)) {
  $(key).addEventListener('input', event => { stopPlayback(); selectedId = null; setPose({ ...values, [key]: Number(event.target.value) }); renderSelection(); });
  $(key + 'Number').addEventListener('change', event => {
    const next = Number(event.target.value); if (event.target.value.trim() === '' || !Number.isFinite(next)) { event.target.value = Math.round(values[key]); return; }
    stopPlayback(); selectedId = null; setPose({ ...values, [key]: clamp(Math.round(next), min, max) }); renderSelection();
  });
}
function renderSelection() { document.querySelectorAll('.pose-card').forEach(card => { card.classList.toggle('selected', card.dataset.id === selectedId); card.querySelector('.pose-select')?.setAttribute('aria-pressed', String(card.dataset.id === selectedId)); }); }
function togglePlayback() {
  if (!poses.length) { toast('Save a pose to start a sequence.'); return; }
  if (!playback) { playback = { state: 'playing', start: { ...values }, elapsed: 0 }; selectedId = null; renderSelection(); }
  else playback.state = playback.state === 'playing' ? 'paused' : 'playing';
  updatePlaybackUI(sampleSequence(playback.start, poses, playback.elapsed, $('loop').checked));
}
$('playButton').addEventListener('click', togglePlayback);
$('stopButton').addEventListener('click', () => { stopPlayback(true); toast('Stopped. Returned to the playback start.'); });
$('homeButton').addEventListener('click', () => { stopPlayback(); selectedId = null; setPose(HOME); renderSelection(); toast('Back to the home pose.'); });
$('saveButton').addEventListener('click', () => openPoseDialog());
$('speed').addEventListener('change', () => updatePlaybackUI(playback ? sampleSequence(playback.start, poses, playback.elapsed, $('loop').checked) : undefined));
$('loop').addEventListener('change', () => {
  if (playback) { const total = poses.reduce((sum, pose) => sum + pose.duration, 0); if (total && playback.elapsed >= total) { playback.elapsed %= total; playback.start = { ...poses.at(-1).values }; } }
});
$('guideButton').addEventListener('click', () => { if (playback?.state === 'playing') togglePlayback(); $('guideDialog').showModal(); });
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target !== dialog) return; const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); }));
document.querySelectorAll('[data-camera]').forEach(button => button.addEventListener('click', () => {
  view?.setView(button.dataset.camera);
  document.querySelectorAll('[data-camera]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); });
}));
$('resetCamera').addEventListener('click', () => document.querySelector('[data-camera="perspective"]').click());
$('robotCanvas').addEventListener('camera-orbit', () => document.querySelectorAll('[data-camera]').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); }));
$('exportButton').addEventListener('click', () => {
  const data = JSON.stringify({ version: 1, name: 'Arm Lab sequence', poses }, null, 2);
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'arm-lab-poses.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Sequence exported. Keep it as a backup or share it.');
});
$('importButton').addEventListener('click', () => { $('importFile').value = ''; $('importFile').click(); });
$('importFile').addEventListener('change', async () => {
  const file = $('importFile').files[0]; if (!file) return;
  try {
    if (file.size > 200_000) throw new Error('Choose a pose JSON file smaller than 200 KB.');
    pendingImport = validateProject(JSON.parse(await file.text()));
    if (playback?.state === 'playing') togglePlayback();
    $('confirmMessage').textContent = `Import ${pendingImport.length} pose${pendingImport.length === 1 ? '' : 's'}? This replaces your current sequence. Export your current sequence first if you want to keep it.`;
    $('confirmDialog').showModal();
  } catch (error) { pendingImport = null; toast(`Could not import: ${error.message}`); }
});
$('confirmForm').addEventListener('submit', event => { event.preventDefault(); if (!pendingImport) return; stopPlayback(); poses = pendingImport; pendingImport = null; selectedId = null; persist(); renderPoses(); $('confirmDialog').close(); toast('Sequence imported.'); });
$('confirmDialog').addEventListener('close', () => { pendingImport = null; });
document.addEventListener('keydown', event => {
  if (document.querySelector('dialog[open]') || event.target.closest('input,textarea,select,button,a,[contenteditable]') || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
  if (event.code === 'Space') { event.preventDefault(); togglePlayback(); }
  if (event.key.toLowerCase() === 'p') { event.preventDefault(); openPoseDialog(); }
});
// Don't jump through an entire sequence after a background tab has been suspended.
document.addEventListener('visibilitychange', () => { if (document.hidden && playback?.state === 'playing') { togglePlayback(); toast('Playback paused while the tab is hidden.'); } lastFrame = 0; });
setPose(values); renderPoses();
try {
  const { createRobotView } = await import('./robot.js'); view = createRobotView($('robotCanvas')); view.setPose(values);
} catch (error) { $('renderError').hidden = false; console.error('Unable to initialize the 3D view:', error); }
function frame(now) {
  const delta = lastFrame ? Math.min((now - lastFrame) / 1000, .25) : 0; lastFrame = now;
  if (playback?.state === 'playing') {
    playback.elapsed += delta * Number($('speed').value);
    const sample = sampleSequence(playback.start, poses, playback.elapsed, $('loop').checked);
    setPose(sample.values); updatePlaybackUI(sample);
    if (sample.done) { playback = null; selectedId = poses.at(-1).id; renderSelection(); updatePlaybackUI(sample); toast('Sequence complete. Nice moves.'); }
  }
  view?.render(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
