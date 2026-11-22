// The Work section's live circuit: a small isometric race track built from Kenney's Racing
// Kit (CC0, public/racing/). One F1 car per project, painted in its colour, laps the track;
// trackside billboards show the project photos. Hover a car to see which project it is,
// click it to jump to that project. The track itself is a smooth ribbon drawn here.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type CircuitProject = { id: string; tag: string; color: string; title: string; photos?: { src: string }[] };
export type CircuitUI = {
  canvas: HTMLCanvasElement;
  labels: HTMLElement;                    // layer for the car name tags
  onPick: (id: string) => void;           // car clicked
  onHover: (id: string | null) => void;   // car hovered
};

const W = 1.0;            // track width (Kenney road tiles are 1 unit wide)
const KERB = 0.13;
const ROAD = 0x3b3b45, LINE = 0xf3f3f5, KERB_R = 0xe8554f, GRASS = 0x14161c;

// the circuit: main straight along the bottom (start/finish + pits), a hairpin, an esses
const PATH: [number, number][] = [
  [-6.5, 3], [-2, 3], [3.5, 3], [6.8, 2.4], [8.2, 0.4], [7.6, -1.8], [5.4, -2.6],
  [3.4, -1.4], [1.4, -2.8], [-1.6, -3.6], [-5, -3.4], [-7.8, -2], [-8.6, 0.6], [-8, 2.4],
];

function ribbon(curve: THREE.CatmullRomCurve3, n: number, from: number, to: number, colorAt?: (i: number) => THREE.Color) {
  // a flat strip between offsets `from` and `to` (left of travel = negative)
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = curve.getPointAt(t % 1), tan = curve.getTangentAt(t % 1);
    const side = new THREE.Vector3().crossVectors(up, tan).normalize();
    for (const off of [from, to]) {
      const v = p.clone().addScaledVector(side, off);
      pos.push(v.x, v.y, v.z);
      const c = colorAt ? colorAt(i) : new THREE.Color(1, 1, 1);
      col.push(c.r, c.g, c.b);
    }
    if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export async function initCircuit(ui: CircuitUI, projects: CircuitProject[]) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2a38, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-6, 12, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 9, bottom: -9 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);

  // ground: dark infield with a faint grid, so it sits in the site's dark theme
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 26), new THREE.MeshStandardMaterial({ color: GRASS, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(40, 40, 0x1f2129, 0x1b1d24);
  grid.position.y = -0.015;
  scene.add(grid);

  // --- the track ------------------------------------------------------------------------
  const curve = new THREE.CatmullRomCurve3(PATH.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
  const N = 600;
  const flat = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, vertexColors: false });
  const road = new THREE.Mesh(ribbon(curve, N, -W / 2, W / 2), flat(ROAD));
  road.receiveShadow = true;
  scene.add(road);
  for (const [a, b] of [[-W / 2, -W / 2 + 0.035], [W / 2 - 0.035, W / 2]] as const) {
    const line = new THREE.Mesh(ribbon(curve, N, a, b), flat(LINE));
    line.position.y = 0.004;
    scene.add(line);
  }
  // kerbs: red/white stripes, only where the track bends
  const curvature = (t: number) => {
    const a = curve.getTangentAt(t), b = curve.getTangentAt((t + 0.004) % 1);
    return a.angleTo(b);
  };
  const kerbMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  const red = new THREE.Color(KERB_R), white = new THREE.Color(LINE);
  for (const [a, b] of [[-W / 2 - KERB, -W / 2], [W / 2, W / 2 + KERB]] as const) {
    const g = ribbon(curve, N, a, b, (i) => (Math.floor(i / 4) % 2 ? red : white));
    // hide the kerb on straights by dropping those triangles
    const idx = g.getIndex()!.array as Uint16Array | Uint32Array;
    const keep: number[] = [];
    for (let k = 0; k < idx.length; k += 6) if (curvature((k / 6) / N) > 0.022) keep.push(...idx.slice(k, k + 6));
    g.setIndex(keep);
    const kerb = new THREE.Mesh(g, kerbMat);
    kerb.position.y = 0.006;
    scene.add(kerb);
  }
  // start/finish line: chequered strip across the main straight
  const startT = 0.115;
  {
    const c = document.createElement('canvas'); c.width = 64; c.height = 16;
    const g = c.getContext('2d')!;
    for (let x = 0; x < 8; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#f3f3f5'; g.fillRect(x * 8, y * 8, 8, 8); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter;
    const line = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.18), new THREE.MeshBasicMaterial({ map: tex }));
    const p = curve.getPointAt(startT), tan = curve.getTangentAt(startT);
    line.rotation.x = -Math.PI / 2;
    line.rotation.z = -Math.atan2(tan.z, tan.x) + Math.PI / 2;
    line.position.set(p.x, 0.008, p.z);
    scene.add(line);
  }

  // --- Kenney props ---------------------------------------------------------------------
  const loader = new GLTFLoader();
  const cache = new Map<string, Promise<THREE.Group>>();
  const model = (name: string) => {
    if (!cache.has(name)) cache.set(name, loader.loadAsync(`/racing/${name}.glb`).then((g) => {
      g.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      return g.scene;
    }));
    return cache.get(name)!.then((s) => s.clone(true));
  };
  /** Kenney models carry an editor offset: re-centre so (0,0,0) is the middle of the footprint, on the ground. */
  const centred = (o: THREE.Object3D) => {
    const box = new THREE.Box3().setFromObject(o);
    o.position.x -= (box.min.x + box.max.x) / 2; o.position.z -= (box.min.z + box.max.z) / 2; o.position.y -= box.min.y;
    return o;
  };
  /** Place a prop: (x, z) on the ground, turned to face `yaw` (radians). */
  const place = async (name: string, x: number, z: number, yaw = 0, s = 1) => {
    const o = await model(name);
    const holder = new THREE.Group();
    holder.add(centred(o)); holder.position.set(x, 0, z); holder.rotation.y = yaw; holder.scale.setScalar(s);
    scene.add(holder);
    return holder;
  };

  const props: Promise<unknown>[] = [];
  // pit garages on the inside of the main straight, doors facing the track (and the camera)
  for (let i = 0; i < 6; i++) props.push(place('pitsGarage', -5.4 + i * 1.0, 1.9, 0));
  props.push(place('pitsOffice', 0.6, 1.9, 0));
  props.push(place('pitsOffice', 1.6, 1.9, 0));
  // grandstands round the outside of the hairpin
  for (let i = 0; i < 3; i++) props.push(place('grandStandCovered', -10.4, -0.6 + i * 1.0, Math.PI / 2));
  // start gantry with the lights, flags at the line
  {
    const p = curve.getPointAt(startT);
    props.push(place('overheadLights', p.x - 0.5, p.z + 0.06, 0));
    props.push(place('flagCheckers', p.x + 0.05, p.z + 0.85, 0));
  }
  // tyre barriers on the outside of the big corners
  const outside = (t: number, off: number) => {
    const p = curve.getPointAt(t), tan = curve.getTangentAt(t);
    const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), tan).normalize();
    return { p: p.addScaledVector(side, off), yaw: Math.atan2(tan.x, tan.z) };
  };
  for (let t = 0; t < 1; t += 0.012) {
    if (curvature(t) < 0.03) continue;
    // outside of the bend = the side the track turns away from
    const a = curve.getTangentAt(t), b = curve.getTangentAt((t + 0.01) % 1);
    const turnLeft = a.x * b.z - a.z * b.x < 0;
    const { p, yaw } = outside(t, (turnLeft ? 1 : -1) * (W / 2 + 0.38));
    props.push(place(Math.floor(t * 100) % 2 ? 'barrierRed' : 'barrierWhite', p.x, p.z, yaw + Math.PI / 2));
  }
  // trees and towers to fill the corners
  const trees: [number, number, string][] = [[-10.6, -3, 'treeLarge'], [-9.8, 3.6, 'treeLarge'], [10, 1.5, 'treeLarge'], [9.6, -3.2, 'treeSmall'],
    [3.2, -4.4, 'treeLarge'], [-3, -5.2, 'treeSmall'], [5.2, 0.2, 'treeSmall'], [-1.4, -0.9, 'treeLarge'], [0.4, -0.4, 'treeSmall'], [-6, -0.2, 'treeLarge']];
  trees.forEach(([x, z, n]) => props.push(place(n, x, z, Math.random() * 6)));
  props.push(place('tentLong', 3.4, 0.6, 0));
  props.push(place('radarEquipment', -7.2, -0.2, 0.8));
  props.push(place('bannerTowerRed', 7.2, 3.9, 0));
  props.push(place('lightPostModern', -7.4, 4.3, 0));

  // billboards round the back of the circuit, one per project photo (cover photo)
  const boards = projects.filter((p) => p.photos?.length);
  // all along the back of the circuit, facing the camera
  const boardSpots: [number, number, number][] = [[-9.2, -3.9, 0.6], [-6.2, -4.9, 0.1], [-3.2, -5.2, 0], [-0.2, -5.1, 0], [2.4, -4.4, 0], [5, -4.3, 0], [8.2, -3.6, -0.25]];
  const texLoader = new THREE.TextureLoader();
  boards.slice(0, boardSpots.length).forEach((p, i) => {
    const [x, z, yaw] = boardSpots[i];
    props.push(place('billboard', x, z, yaw, 1.35).then((b) => {
      // the photo goes on its own panel over the board face (the model's art is a small logo on a sheet)
      const src = p.photos![0].src.replace(/(\.\w+)$/, '-t$1');
      texLoader.load(src, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        const PW = 0.88, PH = 0.5, img = tex.image as HTMLImageElement;
        const ar = img.width / img.height, k = (PW / PH) / ar; // crop to fill like object-fit: cover
        if (k < 1) { tex.repeat.set(1, k); tex.offset.set(0, (1 - k) / 2); } else { tex.repeat.set(1 / k, 1); tex.offset.set((1 - 1 / k) / 2, 0); }
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({ map: tex }));
        panel.position.set(0, 0.73, 0.245);
        panel.userData.pid = p.id;
        b.add(panel);
      });
      b.userData.pid = p.id;
    }));
  });

  // --- the cars ---------------------------------------------------------------------------
  type Car = { p: CircuitProject; obj: THREE.Group; t: number; v: number; lane: number; label: HTMLElement };
  const cars: Car[] = [];
  const carTemplate = await model('raceCarRed');
  projects.forEach((p, i) => {
    const obj = carTemplate.clone(true);
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const fresh = mats.map((mat) => {
        if (mat.name !== 'red') return mat;
        const nm = (mat as THREE.MeshStandardMaterial).clone();
        nm.color.set(p.color);
        return nm;
      });
      m.material = Array.isArray(m.material) ? fresh : fresh[0];
      m.userData.pid = p.id;
    });
    const holder = new THREE.Group();
    holder.add(centred(obj)); // the model's nose points along -z
    holder.scale.setScalar(0.62);
    holder.userData.pid = p.id;
    scene.add(holder);
    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'cc-tag';
    label.style.setProperty('--c', p.color);
    label.innerHTML = `<b>P${i + 1}</b>${p.tag}`;
    label.addEventListener('click', () => ui.onPick(p.id));
    label.addEventListener('pointerenter', () => setHover(p.id));
    label.addEventListener('pointerleave', () => setHover(null));
    ui.labels.appendChild(label);
    cars.push({ p, obj: holder, t: (startT - i / projects.length + 1) % 1, v: 0.043 + (i % 3) * 0.0035 + Math.random() * 0.002, lane: ((i % 3) - 1) * 0.22, label });
  });
  await Promise.all(props);

  // --- interaction ------------------------------------------------------------------------
  let hovered: string | null = null;
  function setHover(id: string | null) {
    if (id === hovered) return;
    hovered = id;
    cars.forEach((c) => c.label.classList.toggle('on', c.p.id === id));
    ui.canvas.style.cursor = id ? 'pointer' : '';
    ui.onHover(id);
  }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const pick = (e: PointerEvent): string | null => {
    const r = ui.canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(cars.map((c) => c.obj), true)[0];
    return (hit?.object.userData.pid as string) ?? null;
  };
  ui.canvas.addEventListener('pointermove', (e) => setHover(pick(e)));
  ui.canvas.addEventListener('pointerleave', () => setHover(null));
  ui.canvas.addEventListener('click', (e) => { const id = pick(e); if (id) ui.onPick(id); });

  /** Highlight a car from outside (e.g. hovering its project card). */
  const highlight = (id: string | null) => setHover(id);

  // --- camera + loop -----------------------------------------------------------------------
  let drift = 0;
  function resize() {
    const r = ui.canvas.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    const aspect = r.width / Math.max(1, r.height);
    const half = aspect < 1.1 ? 9.4 : 7.1; // fit the circuit; phones need a wider view
    camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half;
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);
  let visible = false;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(ui.canvas);

  const clock = new THREE.Clock();
  const v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!visible || document.hidden) return;
    // isometric camera, slowly swinging a few degrees so the scene never sits still
    drift += reduced ? 0 : dt * 0.08;
    const ang = Math.PI * 0.25 + Math.sin(drift) * 0.12;
    // aim a little behind the centre so the billboards along the back stay in frame
    camera.position.set(Math.sin(ang) * 20, 16, Math.cos(ang) * 20 - 1);
    camera.lookAt(0, 0, -1);

    const r = ui.canvas.getBoundingClientRect();
    for (const c of cars) {
      if (!reduced) c.t = (c.t + c.v * dt * (hovered === c.p.id ? 0.4 : 1)) % 1; // the hovered car eases off so you can read it
      const p = curve.getPointAt(c.t), tan = curve.getTangentAt(c.t);
      const side = new THREE.Vector3().crossVectors(up, tan).normalize();
      c.obj.position.copy(p).addScaledVector(side, c.lane);
      c.obj.rotation.y = Math.atan2(tan.x, tan.z) + Math.PI; // nose along the direction of travel
      // name tag floats above the car
      v.copy(c.obj.position).setY(0.9).project(camera);
      c.label.style.transform = `translate(${((v.x + 1) / 2) * r.width}px, ${((1 - v.y) / 2) * r.height}px) translate(-50%, -100%)`;
    }
    renderer.render(scene, camera);
  });

  return { highlight };
}
