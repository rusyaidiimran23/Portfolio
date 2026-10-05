import * as THREE from 'three';

// Kinetic hero: a glowing wireframe knot inside a streaming particle field.
// Motion + speed motif — nods to the gearhead side without literal vehicles.
export function initHero(canvas: HTMLCanvasElement) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05060a, 0.028);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  camera.position.set(0, 0, 26);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);

  const ACCENT = new THREE.Color(0xff2d4b);
  const CYAN = new THREE.Color(0x21d4fd);

  // --- centerpiece: glowing wireframe torus knot ---------------------------
  const knotGeo = new THREE.TorusKnotGeometry(6, 1.5, 220, 32, 2, 3);
  const knot = new THREE.Mesh(
    knotGeo,
    new THREE.MeshBasicMaterial({ color: ACCENT, wireframe: true, transparent: true, opacity: 0.55 }),
  );
  const knotCore = new THREE.Mesh(
    new THREE.TorusKnotGeometry(6, 1.2, 160, 24, 2, 3),
    new THREE.MeshBasicMaterial({ color: 0x120306, transparent: true, opacity: 0.9 }),
  );
  const group = new THREE.Group();
  group.add(knotCore, knot);
  scene.add(group);

  // glowing edge points along the knot
  const edgePts = new THREE.Points(
    knotGeo,
    new THREE.PointsMaterial({ color: CYAN, size: 0.12, transparent: true, opacity: 0.9 }),
  );
  group.add(edgePts);

  // --- streaming particle field (speed lines) ------------------------------
  const COUNT = 900;
  const positions = new Float32Array(COUNT * 3);
  const speeds = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 90;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 60;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 120;
    speeds[i] = 0.15 + Math.random() * 0.5;
  }
  const fieldGeo = new THREE.BufferGeometry();
  fieldGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const field = new THREE.Points(
    fieldGeo,
    new THREE.PointsMaterial({ color: 0x8b93a7, size: 0.18, transparent: true, opacity: 0.6 }),
  );
  scene.add(field);

  // --- interaction ---------------------------------------------------------
  const mouse = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  window.addEventListener('pointermove', (e) => {
    target.x = (e.clientX / window.innerWidth - 0.5) * 2;
    target.y = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clock = new THREE.Clock();
  let raf = 0;

  function frame() {
    const t = clock.getElapsedTime();
    const dt = Math.min(clock.getDelta ? 0.016 : 0.016, 0.05);

    mouse.x += (target.x - mouse.x) * 0.05;
    mouse.y += (target.y - mouse.y) * 0.05;

    if (!reduced) {
      group.rotation.y = t * 0.25 + mouse.x * 0.5;
      group.rotation.x = Math.sin(t * 0.3) * 0.2 + mouse.y * 0.3;
      knot.material.opacity = 0.45 + Math.sin(t * 2) * 0.12;

      // stream particles toward the camera, recycle when they pass
      const arr = fieldGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < COUNT; i++) {
        arr[i * 3 + 2] += speeds[i] * 0.9;
        if (arr[i * 3 + 2] > 60) arr[i * 3 + 2] = -60;
      }
      fieldGeo.attributes.position.needsUpdate = true;
      field.rotation.z = t * 0.02;
    }

    camera.position.x += (mouse.x * 3 - camera.position.x) * 0.04;
    camera.position.y += (-mouse.y * 2 - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  frame();

  return () => {
    cancelAnimationFrame(raf);
    renderer.dispose();
    knotGeo.dispose();
    fieldGeo.dispose();
  };
}
