import * as THREE from './vendor/three.module.js';
import { calendar, STATIONS } from './simulation.js';

const palette = {
  sand: 0xc5a06a, skin: 0xb78350, dark: 0x403329, wood: 0x68513a, leaf: 0x657046
};
const material = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const mats = {
  sand: material(palette.sand), camel: material(palette.skin), camelLight: material(0xd2aa72),
  camelDark: material(0x96704c), dark: material(palette.dark), wood: material(palette.wood),
  leaf: material(palette.leaf), green: material(0x1f6546), rock: material(0xa17b57),
  cloth: material(0x40372f, { side: THREE.DoubleSide }), red: material(0x8a3c32),
  white: material(0xf2e4ca), water: material(0x639da4, { transparent: true, opacity: 0.86 })
};
const geo = {
  sphere: new THREE.IcosahedronGeometry(1, 1), box: new THREE.BoxGeometry(1, 1, 1),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 7), cone: new THREE.ConeGeometry(1, 1, 6)
};
function mesh(group, geometry, mat, position, scale) {
  const m = new THREE.Mesh(geometry, mat);
  m.position.set(...position); m.scale.set(...scale); group.add(m); return m;
}
function box(group, mat, x, y, z, w, h, d) { return mesh(group, geo.box, mat, [x, y, z], [w, h, d]); }
function ellipsoid(group, mat, x, y, z, a, b, c) { return mesh(group, geo.sphere, mat, [x, y, z], [a, b, c]); }
function poleBetween(group, mat, start, end, radius) {
  const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
  const direction = b.clone().sub(a);
  const m = mesh(group, geo.cylinder, mat, a.clone().add(b).multiplyScalar(0.5).toArray(), [radius, direction.length(), radius]);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return m;
}
function shadow(group, x, z, a, b) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1, 14), new THREE.MeshBasicMaterial({ color: 0x3b2b20, transparent: true, opacity: 0.17, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.025, z); m.scale.set(a, b, 1); group.add(m); return m;
}
export function createCamel(c) {
  const root = new THREE.Group(); root.name = 'camel-' + c.id;
  const body = new THREE.Group(); root.add(body);
  const mat = c.id % 3 === 0 ? mats.camelLight : c.id % 3 === 1 ? mats.camel : mats.camelDark;
  ellipsoid(body, mat, 0, 1.84, 0, 0.62, 0.72, 1.12);
  ellipsoid(body, mat, 0, 2.55, 0.26, 0.53, 0.69, 0.6);
  poleBetween(body, mat, [0, 1.9, -0.7], [0, 3.1, -1.17], 0.25);
  ellipsoid(body, mat, 0, 3.2, -1.45, 0.3, 0.37, 0.48);
  ellipsoid(body, mat, 0, 3.12, -1.84, 0.24, 0.21, 0.3);
  ellipsoid(body, mats.dark, 0, 3.1, -2.02, 0.19, 0.12, 0.06);
  for (const side of [-1, 1]) {
    const ear = ellipsoid(body, mat, side * 0.32, 3.47, -1.25, 0.12, 0.23, 0.08);
    ear.rotation.z = side * -0.45;
    ellipsoid(body, mats.dark, side * 0.24, 3.28, -1.64, 0.035, 0.055, 0.055);
  }
  const legs = [];
  for (const [x, z] of [[-0.4, -0.64], [0.4, -0.64], [-0.4, 0.66], [0.4, 0.66]]) {
    const pivot = new THREE.Group(); pivot.position.set(x, 1.5, z); body.add(pivot);
    poleBetween(pivot, mat, [0, 0, 0], [0, -1.32, 0], 0.09);
    ellipsoid(pivot, mats.dark, 0, -1.4, -0.04, 0.14, 0.09, 0.21);
    legs.push(pivot);
  }
  const tail = poleBetween(body, mat, [0, 1.9, 0.95], [0.07, 1.08, 1.23], 0.04);
  ellipsoid(body, mats.dark, 0.07, 1.08, 1.23, 0.06, 0.14, 0.06);
  if (c.sex === 'male') {
    root.scale.setScalar(1.1);
    box(body, mats.red, 0, 2.16, -0.03, 1.25, 0.08, 1.05);
  }
  const groundShadow = shadow(root, 0, 0, 1, 1.7);
  return { root, body, legs, tail, groundShadow };
}
function seeded(n) { let a = n; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }
function instances(scene, geometry, mat, count, transform) {
  const instanced = new THREE.InstancedMesh(geometry, mat, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) { transform(dummy, i); dummy.updateMatrix(); instanced.setMatrixAt(i, dummy.matrix); }
  scene.add(instanced); return instanced;
}
function buildCamp(scene) {
  const camp = new THREE.Group(); camp.position.set(-15, 0, 3); scene.add(camp);
  const roofVertices = [
    -6.5, 2.3, -4.5, 0, 4.4, -4.5, 0, 4.4, 4.5,
    -6.5, 2.3, -4.5, 0, 4.4, 4.5, -6.5, 2.3, 4.5,
    0, 4.4, -4.5, 6.5, 2.3, -4.5, 6.5, 2.3, 4.5,
    0, 4.4, -4.5, 6.5, 2.3, 4.5, 0, 4.4, 4.5
  ];
  const roofGeo = new THREE.BufferGeometry();
  roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(roofVertices, 3)); roofGeo.computeVertexNormals();
  const roof = new THREE.Mesh(roofGeo, mats.cloth); camp.add(roof);
  box(camp, mats.cloth, 0, 1.2, -4.5, 13, 2.4, 0.12);
  box(camp, mats.cloth, -6.5, 1.1, 0, 0.12, 2.2, 9);
  box(camp, mats.cloth, 6.5, 1.1, 0, 0.12, 2.2, 9);
  for (const x of [-6.5, 0, 6.5]) for (const z of [-4.5, 4.5])
    poleBetween(camp, mats.wood, [x, 0, z], [x, x === 0 ? 4.4 : 2.4, z], 0.065);
  const rug = box(scene, mats.red, -15, 0.035, 11, 7, 0.07, 4);
  for (let i = 0; i < 5; i++) box(scene, mats.white, -18 + i * 1.4, 0.08, 11, 0.06, 0.02, 4);
  const fire = new THREE.Group(); fire.position.set(-15, 0, 15); scene.add(fire);
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2;
    ellipsoid(fire, mats.rock, Math.sin(a) * 0.62, 0.12, Math.cos(a) * 0.62, 0.23, 0.16, 0.2);
  }
  const flame = mesh(fire, geo.cone, new THREE.MeshBasicMaterial({ color: 0xf39b42 }), [0, 0.4, 0], [0.33, 0.7, 0.33]);
  const light = new THREE.PointLight(0xffa45f, 6, 12, 2); light.position.set(-15, 1.1, 15); scene.add(light);
  // A simple green camp flag. No text texture is needed.
  poleBetween(scene, mats.wood, [-22, 0, 1], [-22, 7, 1], 0.07);
  box(scene, mats.green, -20.7, 6.1, 1, 2.6, 1.6, 0.025);
  return { flame, light, rug };
}
function buildStations(scene) {
  const w = STATIONS.water;
  box(scene, mats.rock, w.x, 0.3, w.z, 5, 0.6, 2);
  box(scene, mats.water, w.x, 0.62, w.z, 4.65, 0.04, 1.65);
  for (const dz of [-0.94, 0.94]) box(scene, mats.rock, w.x, 0.65, w.z + dz, 5.1, 0.2, 0.16);
  for (const dx of [-2.48, 2.48]) box(scene, mats.rock, w.x + dx, 0.65, w.z, 0.16, 0.2, 2);
  const m = STATIONS.market;
  box(scene, mats.wood, m.x, 0.7, m.z - 2, 8.8, 1.4, 4);
  box(scene, mats.red, m.x, 3.5, m.z - 2, 9.8, 0.12, 4.5);
  for (const dx of [-4.4, 4.4]) for (const dz of [-4, 0]) poleBetween(scene, mats.wood, [m.x + dx, 0, m.z + dz], [m.x + dx, 3.6, m.z + dz], 0.08);
  for (let i = 0; i < 6; i++) ellipsoid(scene, i % 2 ? mats.white : mats.camelLight, m.x - 3 + i * 1.1, 1.8, m.z - 1.8, 0.42, 0.52, 0.42);
}
function buildPalm(scene, x, z, height, random) {
  poleBetween(scene, mats.wood, [x, 0, z], [x + 0.3, height, z], 0.18);
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2;
    const leaf = box(scene, mats.leaf, x + Math.sin(a) * 1.2, height - 0.1, z + Math.cos(a) * 1.2, 0.55, 0.1, 3.2);
    leaf.rotation.set(0.2 + random() * 0.14, a, 0);
  }
}
export function buildScene(state) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc9caca);
  scene.fog = new THREE.Fog(0xd8c6ad, 40, 180);
  const camera = new THREE.PerspectiveCamera(67, 1, 0.08, 250);
  camera.rotation.order = 'YXZ'; scene.add(camera);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), mats.sand);
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const hemisphere = new THREE.HemisphereLight(0xe8f3fc, 0x6d5030, 2.2); scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xffe6ba, 2.8); sun.position.set(-40, 50, -60); scene.add(sun);
  const sunBall = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd38a }));
  sunBall.position.copy(sun.position).multiplyScalar(2.2); scene.add(sunBall);
  const random = seeded(45121);
  instances(scene, geo.sphere, mats.rock, 42, (d, i) => {
    const a = i / 42 * Math.PI * 2, radius = 112 + random() * 22;
    d.position.set(Math.sin(a) * radius, 7, Math.cos(a) * radius);
    d.scale.set(8 + random() * 14, 9 + random() * 15, 10 + random() * 14);
    d.rotation.set(0, random() * Math.PI, 0);
  });
  instances(scene, geo.sphere, mats.sand, 28, (d, i) => {
    const a = i / 28 * Math.PI * 2, radius = 65 + random() * 25;
    d.position.set(Math.sin(a) * radius, -1.5, Math.cos(a) * radius);
    d.scale.set(14 + random() * 12, 3 + random() * 4, 12 + random() * 10);
    d.rotation.set(0, random() * Math.PI, 0);
  });
  instances(scene, geo.cone, mats.leaf, 300, (d) => {
    const a = random() * Math.PI * 2, radius = random() * 9;
    d.position.set(STATIONS.pasture.x + Math.sin(a) * radius, 0.16, STATIONS.pasture.z + Math.cos(a) * radius);
    d.scale.set(0.16, 0.2 + random() * 0.25, 0.16);
    d.rotation.set(0, random() * Math.PI, 0);
  });
  instances(scene, geo.sphere, mats.rock, 80, d => {
    const x = (random() - 0.5) * 160, z = (random() - 0.5) * 160;
    d.position.set(x, -0.07, z); const s = 0.15 + random() * 0.6;
    d.scale.set(s, s * 0.6, s * 0.8); d.rotation.set(0, random() * Math.PI, 0);
  });
  for (const [x, z] of [[-30, -15], [-29, -9], [-33, -12], [26, 13], [20, 16], [35, -25]]) buildPalm(scene, x, z, 4.7 + random() * 2, random);
  const camp = buildCamp(scene); buildStations(scene);
  const camels = new Map();
  for (const c of state.camels) { const model = createCamel(c); scene.add(model.root); camels.set(c.id, model); }
  const hand = new THREE.Group(); camera.add(hand);
  const cuff = box(hand, mats.white, 0.35, -0.47, -0.58, 0.17, 0.38, 0.17);
  cuff.rotation.x = -0.45;
  ellipsoid(hand, mats.camelLight, 0.35, -0.29, -0.67, 0.105, 0.14, 0.08);
  const targetRing = new THREE.Mesh(new THREE.RingGeometry(0.8, 0.87, 28), new THREE.MeshBasicMaterial({ color: 0xf8deac, side: THREE.DoubleSide, transparent: true, opacity: 0.8, depthWrite: false }));
  targetRing.rotation.x = -Math.PI / 2; targetRing.position.y = 0.04; targetRing.visible = false; scene.add(targetRing);
  return { scene, camera, camels, hemisphere, sun, sunBall, camp, hand, targetRing };
}
export function createWorld(canvas, state) {
  const built = buildScene(state);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const vec = new THREE.Vector3();
  let phase = 0, gesture = 0, width = 1, height = 1;
  function resize(quality = state.settings.quality) {
    width = canvas.clientWidth || window.innerWidth; height = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'low' ? 1 : 1.4));
    renderer.setSize(width, height, false); built.camera.aspect = width / height; built.camera.updateProjectionMatrix();
  }
  resize();
  return {
    built, resize, interact: () => { gesture = 1; },
    update(current, dt, moving, selected) {
      if (moving) phase += dt * 10;
      gesture = Math.max(0, gesture - dt * 2);
      const cal = calendar(current), hour = cal.hour;
      const daylight = Math.max(0, Math.sin((hour - 6) / 24 * Math.PI * 2));
      const night = new THREE.Color(0x283745), day = new THREE.Color(cal.seasonIndex === 1 ? 0xd6c6aa : 0xc0cddd);
      built.scene.background.copy(night).lerp(day, daylight);
      built.scene.fog.color.copy(built.scene.background);
      built.hemisphere.intensity = 0.85 + daylight * 1.6;
      built.sun.intensity = 0.18 + daylight * 2.5;
      const angle = (hour - 6) / 24 * Math.PI * 2;
      built.sun.position.set(-Math.cos(angle) * 75, Math.max(5, Math.sin(angle) * 75), -45);
      built.sunBall.position.copy(built.sun.position).multiplyScalar(2);
      built.sunBall.visible = daylight > 0.02;
      built.camp.light.intensity = 3 + (1 - daylight) * 10;
      built.camp.flame.scale.y = 0.68 + Math.sin(current.elapsed * 8) * 0.08;
      for (const c of current.camels) {
        const m = built.camels.get(c.id);
        m.root.position.set(c.x, 0, c.z); m.root.rotation.y = c.yaw;
        m.body.position.y = Math.sin(c.gait * 2) * 0.025;
        m.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(c.gait + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.25; });
      }
      built.camera.position.set(current.player.x, 1.82 + (moving ? Math.sin(phase) * 0.035 : 0), current.player.z);
      built.camera.rotation.set(current.player.pitch, current.player.yaw, 0, 'YXZ');
      built.hand.position.y = Math.sin(gesture * Math.PI) * 0.16 + (moving ? Math.sin(phase) * 0.012 : 0);
      built.targetRing.visible = Boolean(selected);
      if (selected) built.targetRing.position.set(selected.x, 0.045, selected.z);
      renderer.render(built.scene, built.camera);
    },
    screenPosition(point, y = 3) {
      vec.set(point.x, y, point.z).project(built.camera);
      return { x: (vec.x * 0.5 + 0.5) * width, y: (-vec.y * 0.5 + 0.5) * height, visible: vec.z < 1 && vec.z > -1 && Math.abs(vec.x) < 0.92 && Math.abs(vec.y) < 0.85 };
    }
  };
}
