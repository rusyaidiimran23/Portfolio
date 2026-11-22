// The Work section's "car select": a Forza-style showroom built with three.js. One F1 car on
// a lit turntable, a mirror floor, glowing light strips (bloom). Every project is a car in its
// livery: switching slides the car out, repaints it and slides it back in, and the screens on
// the back wall swap to that project's photos. The HUD (HTML, in index.astro) shows the project.
//
// Performance: one renderer, pixel ratio capped, half-resolution bloom and reflections, the loop
// stops while the section is off-screen; phones get a glossy floor instead of a real mirror.
import '../styles/showroom.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export type ShowroomProject = { id: string; color: string; photos?: { src: string }[] };

export async function initShowroom(canvas: HTMLCanvasElement, projects: ShowroomProject[]) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = matchMedia('(max-width: 700px), (pointer: coarse)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.25 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x040406);
  scene.fog = new THREE.Fog(0x040406, 12, 26);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);

  // --- lights: a hard key from above, team-coloured rims, a soft fill ------------------------
  const key = new THREE.SpotLight(0xffffff, 38, 18, Math.PI / 6.5, 0.6, 1.4);
  key.position.set(0, 7, 2.5);
  key.castShadow = true;
  key.shadow.mapSize.set(small ? 512 : 1024, small ? 512 : 1024);
  key.shadow.bias = -0.0004;
  scene.add(key, key.target);
  const rimL = new THREE.PointLight(0xffffff, 3.5, 7), rimR = new THREE.PointLight(0xffffff, 3.5, 7);
  rimL.position.set(-3.4, 2.6, -2.4); rimR.position.set(3.4, 2.6, -2.4);
  scene.add(rimL, rimR);
  scene.add(new THREE.HemisphereLight(0x9aa4c0, 0x050507, 0.25));

  // --- floor: a real mirror under a dark glossy layer (desktop) or just glossy (phones) ------
  if (!small) {
    const mirror = new Reflector(new THREE.CircleGeometry(14, 64), {
      textureWidth: Math.floor(innerWidth * 0.5), textureHeight: Math.floor(innerHeight * 0.5), color: 0x3a3a3a,
    });
    mirror.rotation.x = -Math.PI / 2;
    scene.add(mirror);
  }
  const gloss = new THREE.Mesh(new THREE.CircleGeometry(14, 64), new THREE.MeshPhysicalMaterial({
    color: 0x0b0b10, roughness: small ? 0.25 : 0.4, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.15,
    transparent: !small, opacity: small ? 1 : 0.9,
  }));
  gloss.rotation.x = -Math.PI / 2; gloss.position.y = 0.002; gloss.receiveShadow = true;
  scene.add(gloss);

  // turntable with a glowing ring in the team colour
  // on wide screens the car sits right of centre, clear of the HUD panel on the left
  const stage = new THREE.Group();
  scene.add(stage);
  const table = new THREE.Group();
  stage.add(table);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.3, 0.06, 96), new THREE.MeshPhysicalMaterial({ color: 0x15161c, roughness: 0.3, metalness: 0.7, clearcoat: 0.6 }));
  disc.position.y = 0.03; disc.receiveShadow = true;
  table.add(disc);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.28, 0.018, 8, 160), ringMat);
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.065;
  stage.add(ring);

  // --- the garage wall: light strips and three screens for the photos ----------------------
  const wall = new THREE.Group();
  wall.position.set(0, 0, -4.2);
  scene.add(wall);
  wall.add(new THREE.Mesh(new THREE.PlaneGeometry(22, 8), new THREE.MeshStandardMaterial({ color: 0x0d0d12, roughness: 0.85 })).translateY(4));
  const stripMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const x of [-6.6, 6.6]) wall.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 4.6, 0.04), stripMat).translateX(x).translateY(2.6).translateZ(0.05));
  const accentMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  wall.add(new THREE.Mesh(new THREE.BoxGeometry(11, 0.05, 0.04), accentMat).translateY(0.9).translateZ(0.05));
  // overhead light bars (these, with the strips, are what blooms)
  for (const z of [-1.4, 0.6]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.05, 0.22), stripMat);
    bar.position.set(0, 4.2, z);
    scene.add(bar);
  }
  const screens: THREE.Mesh[] = [];
  const screenMat = () => new THREE.MeshBasicMaterial({ color: 0x111111, toneMapped: false });
  [[-3.2, 2.15], [0, 2.3], [3.2, 2.15]].forEach(([x, y]) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.72, 0.08), new THREE.MeshStandardMaterial({ color: 0x050507, roughness: 0.4 }));
    frame.position.set(x, y, 0.06);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.52), screenMat());
    scr.position.z = 0.045;
    frame.add(scr);
    wall.add(frame);
    screens.push(scr);
  });
  const texLoader = new THREE.TextureLoader();
  const texCache = new Map<string, THREE.Texture>();
  const SCREEN_AR = 2.7 / 1.52;
  const photoTex = (src: string) => {
    if (!texCache.has(src)) {
      const t = texLoader.load(src, (tx) => coverFit(tx, SCREEN_AR)); // full size: thumbnails look soft on a big screen
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy(); // stays sharp seen at an angle
      texCache.set(src, t);
    }
    return texCache.get(src)!;
  };
  const coverFit = (t: THREE.Texture, aspect: number) => {
    const img = t.image as HTMLImageElement | undefined;
    if (!img?.width) return;
    const k = aspect / (img.width / img.height);
    if (k < 1) { t.repeat.set(1, k); t.offset.set(0, (1 - k) / 2); } else { t.repeat.set(1 / k, 1); t.offset.set((1 - 1 / k) / 2, 0); }
  };

  // --- the car -------------------------------------------------------------------------------
  const gltf = await new GLTFLoader().loadAsync('/models/f1-car.glb');
  const car = gltf.scene;
  const paint = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 });
  car.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    const name = (Array.isArray(m.material) ? m.material[0] : m.material).name;
    if (name === 'red') m.material = paint;
    else if (name === 'carTire') m.material = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.85 });
    else if (name === 'glass') m.material = new THREE.MeshPhysicalMaterial({ color: 0x111418, roughness: 0.05, metalness: 0.5, clearcoat: 1 });
    else if (name === 'grey') m.material = new THREE.MeshPhysicalMaterial({ color: 0x24252b, roughness: 0.35, metalness: 0.6, clearcoat: 0.5 });
  });
  // centre it on the turntable, nose towards the camera's left
  const box = new THREE.Box3().setFromObject(car);
  const size = box.getSize(new THREE.Vector3());
  const s = 3.4 / Math.max(size.x, size.z);
  car.scale.setScalar(s);
  box.setFromObject(car);
  car.position.sub(new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y - 0.06, (box.min.z + box.max.z) / 2));
  const carHolder = new THREE.Group();
  carHolder.add(car);
  table.add(carHolder);

  // --- composer: render + bloom on the light strips, screens and ring --------------------------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), small ? 0.35 : 0.45, 0.35, 0.93);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function resize() {
    const r = canvas.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    composer.setSize(r.width, r.height);
    bloom.resolution.set(r.width / 2, r.height / 2);
    camera.aspect = r.width / Math.max(1, r.height);
    camera.fov = camera.aspect < 1 ? 46 : 32;
    stage.position.x = camera.aspect > 1.3 ? 1.5 : 0;
    key.position.x = stage.position.x; key.target.position.x = stage.position.x;
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);

  // --- switching projects: slide out, repaint, slide in ---------------------------------------
  const teamColor = new THREE.Color();
  let current = -1, slide = 0, slideDir = 1, pending = -1;
  function apply(i: number) {
    const p = projects[i];
    teamColor.set(p.color);
    paint.color.copy(teamColor);
    ringMat.color.copy(teamColor).multiplyScalar(1.8);
    accentMat.color.copy(teamColor).multiplyScalar(1.5);
    rimL.color.copy(teamColor); rimR.color.copy(teamColor);
    const photos = p.photos ?? [];
    screens.forEach((scr, k) => {
      const m = scr.material as THREE.MeshBasicMaterial;
      const ph = photos.length ? photos[k % photos.length] : null;
      if (!ph) { m.map = null; m.color.set(0x111111); m.needsUpdate = true; return; }
      m.map = photoTex(ph.src); m.color.set(0xffffff); m.needsUpdate = true;
    });
  }
  function show(i: number, dir: 1 | -1 = 1) {
    const n = projects.length;
    i = ((i % n) + n) % n;
    if (i === current && pending < 0) return;
    if (current < 0 || reduced) { current = i; apply(i); return; }
    pending = i; slideDir = dir; slide = 0.0001;
  }

  // drag the car round
  let spin = -0.6, spinV = 0, dragging = false, lastX = 0;
  canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!dragging) return; spinV = (e.clientX - lastX) * 0.01; spin += spinV; lastX = e.clientX; });
  const end = () => { dragging = false; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);

  let visible = false;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(canvas);
  const clock = new THREE.Clock();
  let t = 0;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!visible || document.hidden) return;
    t += dt;
    // turntable: slow idle spin; a drag flings it, then it eases back to the idle speed
    if (!dragging) { spinV *= 0.94; spin += spinV + (reduced ? 0 : 0.25 * dt); }
    table.rotation.y = spin;
    // slide transition
    if (slide > 0) {
      slide += dt / 0.7;
      const half = slide < 0.5;
      const k = half ? slide / 0.5 : (slide - 0.5) / 0.5;
      const ease = half ? k * k : 1 - (1 - k) * (1 - k);
      carHolder.position.x = half ? -slideDir * ease * 9 : slideDir * (1 - ease) * 9;
      if (!half && pending >= 0) { current = pending; pending = -1; apply(current); }
      if (slide >= 1) { slide = 0; carHolder.position.x = 0; }
    }
    // camera: a slow drift so the reflections move
    const a = Math.sin(t * 0.15) * 0.25;
    camera.position.set(Math.sin(a) * 7.4, 2.0 + Math.sin(t * 0.21) * 0.12, Math.cos(a) * 7.4);
    camera.lookAt(stage.position.x * 0.45, 1.0, 0);
    composer.render();
  });

  return { show, get index() { return current; } };
}
