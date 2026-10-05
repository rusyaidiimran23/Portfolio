// Blueprint interaction engine.
// Drives scroll-triggered "blow-up" (exploded-assembly) diagrams, hover
// callouts, manual explode sliders, hero parallax, and reveal-on-scroll.

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n));

/** Apply an explode factor e (0..1) to every .bp-part inside an assembly.
 *  Parts may stagger via data-start/data-end (each a 0..1 window of the scroll).
 *  data-ease="linear" keeps the global progress linear (no smoothstep). */
function applyExplode(assembly: HTMLElement, e: number): number {
  const g = assembly.dataset.ease === 'linear' ? e : e * e * (3 - 2 * e);
  assembly.style.setProperty('--e', g.toFixed(4));
  const parts = assembly.querySelectorAll<SVGElement>('.bp-part');
  parts.forEach((p) => {
    const s = parseFloat(p.dataset.start || '0');
    const en = parseFloat(p.dataset.end || '1');
    const t = en > s ? clamp((g - s) / (en - s)) : g;
    const dx = parseFloat(p.dataset.dx || '0') * t;
    const dy = parseFloat(p.dataset.dy || '0') * t;
    const rot = parseFloat(p.dataset.rot || '0') * t;
    p.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
    if (p.dataset.fade) p.style.opacity = String(0.25 + 0.75 * t);
  });
  return g;
}

/** Update any percentage readouts bound to an assembly id. */
function setReadouts(id: string, eased: number) {
  const txt = String(Math.round(eased * 100)).padStart(3, '0');
  document.querySelectorAll<HTMLElement>(`[data-explode-readout="#${id}"]`).forEach((el) => {
    el.textContent = txt;
  });
}

/** Scroll progress of a stage as it travels up through the viewport. */
function stageProgress(stage: HTMLElement): number {
  const rect = stage.getBoundingClientRect();
  const vh = window.innerHeight;
  const start = vh * 0.92;
  const end = vh * 0.30;
  return clamp((start - rect.top) / (start - end));
}

/** Linear progress through a tall pinned scene (0 at top, 1 at bottom). */
function sceneProgress(scene: HTMLElement): number {
  const rect = scene.getBoundingClientRect();
  const travel = scene.offsetHeight - window.innerHeight;
  return travel > 0 ? clamp(-rect.top / travel) : 0;
}

function initAssemblies() {
  const assemblies = Array.from(document.querySelectorAll<HTMLElement>('.bp-assembly'));

  const update = () => {
    for (const a of assemblies) {
      const stage = (a.closest('.bp-stage') as HTMLElement) || a;
      const manual = a.dataset.manual;
      let e: number;
      if (manual != null) e = parseFloat(manual);
      else if (a.dataset.scroll === 'depth') e = clamp(window.scrollY / (window.innerHeight * 0.85));
      else if (a.dataset.scroll === 'scene') {
        const scene = a.closest('.scroll-scene') as HTMLElement | null;
        e = scene ? sceneProgress(scene) : 0;
      } else if (a.dataset.scroll === 'page') {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        e = max > 0 ? clamp(window.scrollY / max) : 0;
      } else e = stageProgress(stage);
      const eased = applyExplode(a, e);
      setReadouts(a.id, eased);
      // keep any bound slider in sync when scroll-driven
      const slider = document.querySelector<HTMLInputElement>(`input[data-target="#${a.id}"]`);
      if (slider && manual == null) slider.value = String(Math.round(e * 100));
    }
  };

  // Sliders let the visitor scrub the explosion by hand.
  document.querySelectorAll<HTMLInputElement>('input.bp-explode-slider').forEach((slider) => {
    const id = (slider.dataset.target || '').replace('#', '');
    const a = document.getElementById(id) as HTMLElement | null;
    if (!a) return;
    slider.addEventListener('input', () => {
      const v = Number(slider.value) / 100;
      a.dataset.manual = String(v);
      setReadouts(a.id, applyExplode(a, v));
    });
  });

  // Scrolling always hands control back to scroll-driving.
  window.addEventListener(
    'scroll',
    () => {
      for (const a of assemblies) delete a.dataset.manual;
      update();
    },
    { passive: true },
  );
  window.addEventListener('resize', update, { passive: true });
  update();
}

/** Hover / click callouts with cross-highlighting between parts and BOM rows. */
function initCallouts() {
  document.querySelectorAll<SVGElement>('.bp-part[data-label]').forEach((part) => {
    const id = part.dataset.callout;
    const row = id ? document.getElementById(id) : null;
    const activate = (on: boolean) => {
      part.classList.toggle('is-hot', on);
      row?.classList.toggle('is-hot', on);
    };
    part.addEventListener('pointerenter', () => activate(true));
    part.addEventListener('pointerleave', () => {
      if (part.dataset.pinned !== '1') activate(false);
    });
    part.addEventListener('click', () => {
      const pin = part.dataset.pinned !== '1';
      part.dataset.pinned = pin ? '1' : '0';
      activate(pin);
    });
  });

  // Reverse binding: hovering a bill-of-materials row lights up its part.
  document.querySelectorAll<HTMLElement>('.bp-bom-row[data-part]').forEach((row) => {
    const sel = row.dataset.part!;
    const part = document.querySelector<SVGElement>(sel);
    const set = (on: boolean) => {
      row.classList.toggle('is-hot', on);
      part?.classList.toggle('is-hot', on);
    };
    row.addEventListener('pointerenter', () => set(true));
    row.addEventListener('pointerleave', () => set(false));
  });
}

/** Subtle parallax tilt for any .bp-parallax stage on pointer move. */
function initParallax() {
  if (reduced) return;
  const stages = Array.from(document.querySelectorAll<HTMLElement>('.bp-parallax'));
  if (!stages.length) return;
  let tx = 0, ty = 0, cx = 0, cy = 0;
  window.addEventListener('pointermove', (e) => {
    tx = (e.clientX / window.innerWidth - 0.5) * 2;
    ty = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });
  const loop = () => {
    cx += (tx - cx) * 0.06;
    cy += (ty - cy) * 0.06;
    for (const s of stages) {
      const depth = parseFloat(s.dataset.depth || '6');
      s.style.transform = `perspective(1200px) rotateY(${cx * depth}deg) rotateX(${-cy * depth}deg)`;
    }
    requestAnimationFrame(loop);
  };
  loop();
}

/** Reveal-on-scroll for annotations, dimension lines, cards. */
function initReveals() {
  const els = document.querySelectorAll<HTMLElement>('.reveal');
  if (reduced) {
    els.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      }
    },
    { threshold: 0.2 },
  );
  els.forEach((el) => io.observe(el));
}

export function initBlueprint() {
  initAssemblies();
  initCallouts();
  initParallax();
  initReveals();
}
