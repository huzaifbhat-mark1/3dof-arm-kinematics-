import * as THREE from './vendor/three.module.js';
import { DIMENSIONS } from './model.js';

export function createRobotView(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e7ebe2');
  scene.fog = new THREE.Fog('#e7ebe2', 17, 33);
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
  scene.add(new THREE.HemisphereLight('#fffdf0', '#89977d', 2.5));
  const light = new THREE.DirectionalLight('#fff9e9', 3.6);
  light.position.set(-3, 9, 7); light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  Object.assign(light.shadow.camera, { left: -7, right: 7, top: 8, bottom: -7, near: .5, far: 25 });
  light.shadow.bias = -.0006; light.shadow.normalBias = .025;
  light.shadow.radius = 3; scene.add(light);
  const rim = new THREE.DirectionalLight('#dce9f5', 1.2); rim.position.set(5, 5, -4); scene.add(rim);

  const materials = {
    body: new THREE.MeshStandardMaterial({ color: '#c96f42', metalness: .32, roughness: .36 }),
    edge: new THREE.MeshStandardMaterial({ color: '#9c482b', metalness: .4, roughness: .38 }),
    dark: new THREE.MeshStandardMaterial({ color: '#303b36', metalness: .6, roughness: .34 }),
    steel: new THREE.MeshStandardMaterial({ color: '#bdc6b6', metalness: .7, roughness: .29 }),
    cream: new THREE.MeshStandardMaterial({ color: '#efeee0', metalness: .15, roughness: .52 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#26332d', roughness: .95 }),
    accent: new THREE.MeshStandardMaterial({ color: '#d6ec9a', emissive: '#98b958', emissiveIntensity: .12, roughness: .5 }),
  };
  function mesh(geometry, material, parent, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geometry, materials[material] || material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function box(w, h, d, material, parent, x = 0, y = 0, z = 0) { return mesh(new THREE.BoxGeometry(w, h, d), material, parent, x, y, z); }
  function cylinder(rt, rb, h, material, parent, x = 0, y = 0, z = 0) { return mesh(new THREE.CylinderGeometry(rt, rb, h, 48), material, parent, x, y, z); }
  function pivot(parent, radius, depth, x = 0, y = 0) {
    const housing = cylinder(radius, radius, depth, 'dark', parent, x, y); housing.rotation.x = Math.PI / 2;
    for (const sign of [-1, 1]) {
      const disc = cylinder(radius * .79, radius * .79, .035, 'steel', parent, x, y, sign * (depth / 2 + .02)); disc.rotation.x = Math.PI / 2;
      const cap = cylinder(radius * .48, radius * .48, .042, 'body', parent, x, y, sign * (depth / 2 + .05)); cap.rotation.x = Math.PI / 2;
      const bolt = cylinder(.063, .063, .05, 'dark', parent, x, y, sign * (depth / 2 + .08)); bolt.rotation.x = Math.PI / 2;
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        const screw = cylinder(.022, .022, .045, 'dark', parent, x + Math.cos(a) * radius * .65, y + Math.sin(a) * radius * .65, sign * (depth / 2 + .04)); screw.rotation.x = Math.PI / 2;
      }
    }
  }
  function roundedPlate(w, h, d, material, parent, x, y, z) {
    const r = Math.min(w / 2, .2), shape = new THREE.Shape();
    const l = -w / 2, b = -h / 2;
    shape.moveTo(l + r, b); shape.lineTo(l + w - r, b); shape.quadraticCurveTo(l + w, b, l + w, b + r);
    shape.lineTo(l + w, b + h - r); shape.quadraticCurveTo(l + w, b + h, l + w - r, b + h);
    shape.lineTo(l + r, b + h); shape.quadraticCurveTo(l, b + h, l, b + h - r);
    shape.lineTo(l, b + r); shape.quadraticCurveTo(l, b, l + r, b);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: true, bevelThickness: .035, bevelSize: .035, bevelSegments: 3, steps: 1, curveSegments: 8 });
    geometry.translate(0, 0, -d / 2);
    return mesh(geometry, material, parent, x, y, z);
  }
  function link(parent, length, width, depth) {
    roundedPlate(width, length + .15, depth, 'body', parent, 0, length / 2, 0);
    for (const sign of [-1, 1]) {
      roundedPlate(width * .46, length * .63, .022, 'edge', parent, 0, length / 2, sign * (depth / 2 + .04));
      roundedPlate(width * .26, length * .43, .027, 'cream', parent, 0, length / 2, sign * (depth / 2 + .08));
      for (let i = 0; i < 3; i++) box(width * .18, .025, .018, 'dark', parent, 0, length * .4 + i * .12, sign * (depth / 2 + .101));
    }
  }
  const ground = mesh(new THREE.PlaneGeometry(180, 180), new THREE.MeshStandardMaterial({ color: '#e7ebe2', roughness: 1 }), scene);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.castShadow = false;
  const grid = new THREE.GridHelper(32, 64, '#b2bda8', '#c7d0bf'); grid.position.y = .002; grid.material.transparent = true; grid.material.opacity = .36; scene.add(grid);
  const ring = mesh(new THREE.RingGeometry(3.95, 3.975, 128), new THREE.MeshBasicMaterial({ color: '#b3bda7', transparent: true, opacity: .52, side: THREE.DoubleSide }), scene, 0, .008, 0); ring.rotation.x = -Math.PI / 2; ring.castShadow = false;
  // A dashed reach circle gives scale without cluttering the work surface.
  const arcPoints = Array.from({ length: 129 }, (_, i) => new THREE.Vector3(Math.cos(i / 128 * Math.PI * 2) * 5.1, .009, Math.sin(i / 128 * Math.PI * 2) * 5.1));
  const arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(arcPoints), new THREE.LineDashedMaterial({ color: '#b2bf9c', dashSize: .12, gapSize: .12, transparent: true, opacity: .5 })); arc.computeLineDistances(); scene.add(arc);
  const robot = new THREE.Group(); scene.add(robot);
  cylinder(1.04, 1.15, .16, 'dark', robot, 0, .08);
  cylinder(1.02, 1.04, .23, 'cream', robot, 0, .27);
  cylinder(.79, .92, .15, 'steel', robot, 0, .45);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; cylinder(.055, .055, .028, 'dark', robot, Math.cos(a) * .91, .398, Math.sin(a) * .91); }
  const yaw = new THREE.Group(); yaw.position.y = .52; robot.add(yaw);
  cylinder(.68, .79, .22, 'body', yaw, 0, .1);
  cylinder(.52, .61, .17, 'dark', yaw, 0, .29);
  for (const sign of [-1, 1]) roundedPlate(.61, .6, .14, 'body', yaw, 0, .46, sign * .38);
  box(.16, .04, .03, 'accent', yaw, .35, .16, .64);
  const shoulder = new THREE.Group(); shoulder.position.y = DIMENSIONS.base - .52; yaw.add(shoulder);
  link(shoulder, DIMENSIONS.upper, .55, .48); pivot(shoulder, .35, .96);
  const elbow = new THREE.Group(); elbow.position.y = DIMENSIONS.upper; shoulder.add(elbow);
  link(elbow, DIMENSIONS.forearm, .43, .4); pivot(elbow, .3, .72);
  const wrist = new THREE.Group(); wrist.position.y = DIMENSIONS.forearm; elbow.add(wrist);
  cylinder(.22, .25, .26, 'dark', wrist, 0, .09);
  cylinder(.23, .23, .08, 'steel', wrist, 0, .25);
  roundedPlate(.63, .23, .4, 'dark', wrist, 0, .36, 0);
  box(.45, .05, .44, 'steel', wrist, 0, .35);
  const fingers = [-1, 1].map(sign => {
    const finger = new THREE.Group(); wrist.add(finger);
    roundedPlate(.105, .43, .17, 'steel', finger, 0, .57, 0);
    box(.15, .16, .2, 'rubber', finger, -sign * .035, .72);
    cylinder(.055, .055, .09, 'dark', finger, 0, .4).rotation.x = Math.PI / 2;
    return { sign, finger };
  });
  const tip = new THREE.Object3D(); tip.position.y = DIMENSIONS.tool; wrist.add(tip);
  const footprint = mesh(new THREE.RingGeometry(.12, .15, 32), new THREE.MeshBasicMaterial({ color: '#9e704c', opacity: .8, transparent: true, side: THREE.DoubleSide }), scene); footprint.rotation.x = -Math.PI / 2; footprint.castShadow = false;
  const dropLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]), new THREE.LineDashedMaterial({ color: '#a6ad95', dashSize: .08, gapSize: .09, transparent: true, opacity: .5 })); scene.add(dropLine);
  const worldTip = new THREE.Vector3();
  let azimuth = .85, elevation = .47, distance = 15.6;
  const target = new THREE.Vector3(1.15, 2.15, 0);
  function updateCamera() { camera.position.set(target.x + distance * Math.sin(azimuth) * Math.cos(elevation), target.y + distance * Math.sin(elevation), target.z + distance * Math.cos(azimuth) * Math.cos(elevation)); camera.lookAt(target); }
  function setView(view) {
    if (view === 'front') { azimuth = 0; elevation = .03; }
    else if (view === 'top') { azimuth = 0; elevation = Math.PI / 2 - .01; }
    else { azimuth = .85; elevation = .47; }
    distance = 15.6; updateCamera();
  }
  let pointer = null;
  canvas.addEventListener('pointerdown', event => { if (event.button !== 0) return; pointer = { x: event.clientX, y: event.clientY, id: event.pointerId }; canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener('pointermove', event => {
    if (!pointer || event.pointerId !== pointer.id) return;
    azimuth -= (event.clientX - pointer.x) * .007; elevation = THREE.MathUtils.clamp(elevation + (event.clientY - pointer.y) * .006, .06, 1.56);
    pointer.x = event.clientX; pointer.y = event.clientY; updateCamera();
    canvas.dispatchEvent(new CustomEvent('camera-orbit'));
  });
  const releasePointer = () => { pointer = null; };
  canvas.addEventListener('pointerup', releasePointer); canvas.addEventListener('pointercancel', releasePointer); canvas.addEventListener('lostpointercapture', releasePointer);
  canvas.addEventListener('wheel', event => { event.preventDefault(); distance = THREE.MathUtils.clamp(distance * Math.exp(event.deltaY * .001), 7, 25); updateCamera(); }, { passive: false });
  const observer = new ResizeObserver(() => { const { width, height } = canvas.getBoundingClientRect(); if (!width || !height) return; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); }); observer.observe(canvas);
  updateCamera();
  return {
    setView,
    setPose(values) {
      yaw.rotation.y = THREE.MathUtils.degToRad(values.base);
      shoulder.rotation.z = -THREE.MathUtils.degToRad(values.shoulder);
      elbow.rotation.z = -THREE.MathUtils.degToRad(values.elbow);
      for (const { sign, finger } of fingers) finger.position.x = sign * (.08 + values.gripper / 100 * .31);
      scene.updateMatrixWorld(true); tip.getWorldPosition(worldTip);
      footprint.position.set(worldTip.x, .017, worldTip.z); footprint.visible = worldTip.y >= 0;
      const points = dropLine.geometry.attributes.position;
      points.setXYZ(0, worldTip.x, .02, worldTip.z); points.setXYZ(1, worldTip.x, Math.max(.02, worldTip.y), worldTip.z); points.needsUpdate = true; dropLine.geometry.computeBoundingSphere(); dropLine.computeLineDistances();
    },
    render() { renderer.render(scene, camera); },
    getTip() { return { x: worldTip.x * 10, y: worldTip.y * 10, z: worldTip.z * 10 }; },
  };
}
