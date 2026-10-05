// Deployment map: a dot-matrix Malaysia + Singapore under a searchlight.
// Pins mark where each project runs; the spotlight glides to the active
// project's site, or widens over the whole country for nationwide work.
// Coastlines are simplified, and Borneo is pulled west so both halves fit.

export type MapProject = { id: string; tag: string; color: string; lat?: number; lon?: number };
export type MapApi = { setActive(i: number): void };

const BORNEO_SHIFT = -3.6; // degrees of longitude Borneo is moved towards the Peninsula
const LON0 = 99.6, LON1 = 116.0, LAT0 = 0.6, LAT1 = 7.4;
const STEP = 0.13; // dot spacing in degrees

// simplified outlines, [lon, lat]
const PENINSULA: [number, number][] = [
  [100.13, 6.45], [100.3, 6.72], [100.75, 6.48], [101.1, 6.25], [101.6, 5.92], [102.1, 6.22],
  [102.35, 6.15], [102.75, 5.85], [103.1, 5.4], [103.45, 4.8], [103.45, 4.3], [103.35, 3.8],
  [103.45, 3.3], [103.6, 2.8], [103.85, 2.45], [104.15, 1.95], [104.3, 1.55], [103.95, 1.42],
  [103.5, 1.27], [103.2, 1.5], [102.8, 1.85], [102.3, 2.2], [101.85, 2.5], [101.35, 2.95],
  [101.1, 3.5], [100.85, 3.95], [100.6, 4.3], [100.4, 4.9], [100.35, 5.5], [100.35, 6.05],
];
const BORNEO: [number, number][] = ([
  [109.65, 2.08], [110.3, 1.75], [111.0, 1.8], [111.4, 2.4], [112.1, 2.95], [113.0, 3.2],
  [113.6, 3.9], [114.1, 4.6], [114.6, 4.9], [115.3, 5.2], [115.8, 5.6], [116.3, 6.2],
  [116.85, 6.95], [117.3, 6.6], [117.7, 6.1], [118.1, 5.85], [118.7, 5.6], [119.25, 5.3],
  [118.4, 4.95], [118.6, 4.45], [117.9, 4.2], [117.0, 4.25], [116.0, 4.3], [115.6, 3.6],
  [115.3, 2.7], [114.8, 1.6], [113.8, 1.3], [112.9, 1.55], [112.0, 1.1], [111.0, 1.0],
  [110.2, 0.95], [109.75, 1.4],
] as [number, number][]).map(([lon, lat]) => [lon + BORNEO_SHIFT, lat]);
const SINGAPORE = { lon: 103.82, lat: 1.36, r: 0.16 };

function inPoly(lon: number, lat: number, poly: [number, number][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const isLand = (lon: number, lat: number) =>
  inPoly(lon, lat, PENINSULA) || inPoly(lon, lat, BORNEO) ||
  Math.hypot(lon - SINGAPORE.lon, lat - SINGAPORE.lat) < SINGAPORE.r;

// land dots, computed once
const DOTS: { lon: number; lat: number; seed: number }[] = [];
for (let lat = LAT0; lat <= LAT1; lat += STEP)
  for (let lon = LON0; lon <= LON1; lon += STEP)
    if (isLand(lon, lat)) DOTS.push({ lon, lat, seed: Math.random() * 100 });

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function initMap(canvas: HTMLCanvasElement, projects: MapProject[], onPick?: (i: number) => void): MapApi {
  const ctx = canvas.getContext('2d')!;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, dpr = 1;
  let mapX = 0, mapY = 0, scale = 1; // px per degree

  const project = (lon: number, lat: number) => [mapX + (lon - LON0) * scale, mapY + (LAT1 - lat) * scale];
  const pinPos = (p: MapProject) => {
    if (p.lat == null || p.lon == null) return null;
    const lon = p.lon > 108 ? p.lon + BORNEO_SHIFT : p.lon; // Borneo sites move with Borneo
    return project(lon, p.lat);
  };

  function resize() {
    W = canvas.clientWidth || 600;
    H = canvas.clientHeight || 360;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const lonSpan = LON1 - LON0, latSpan = LAT1 - LAT0;
    scale = Math.min((W * 0.96) / lonSpan, (H * 0.68) / latSpan);
    mapX = (W - lonSpan * scale) / 2;
    mapY = H - latSpan * scale - H * 0.04; // map sits low; the beam comes in from above
  }
  window.addEventListener('resize', resize);
  resize();

  let active = 0;
  // spotlight: current + target centre/radius in CSS px, eased each frame
  const spot = { x: W / 2, y: H * 0.7, r: W * 0.6 };
  const target = { x: spot.x, y: spot.y, r: spot.r };
  function aim() {
    const p = projects[active];
    const pos = p && pinPos(p);
    if (pos) { target.x = pos[0]; target.y = pos[1]; target.r = Math.max(W * 0.13, 46); }
    else { target.x = mapX + ((LON1 - LON0) * scale) / 2; target.y = mapY + ((LAT1 - LAT0) * scale) / 2; target.r = W * 0.5; }
    if (reduced) Object.assign(spot, target);
  }

  // pick a pin by click
  const nearestPin = (mx: number, my: number) => {
    let best = -1, bestD = 18;
    projects.forEach((p, i) => {
      const pos = pinPos(p);
      if (!pos) return;
      const d = Math.hypot(pos[0] - mx, pos[1] - my);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  };
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    canvas.style.cursor = nearestPin(e.clientX - r.left, e.clientY - r.top) >= 0 ? 'pointer' : 'default';
  });
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const i = nearestPin(e.clientX - r.left, e.clientY - r.top);
    if (i >= 0) onPick?.(i);
  });

  // skip drawing while off screen so scrolling elsewhere stays smooth
  let onScreen = true;
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(canvas);

  function frame() {
    if (!onScreen) { requestAnimationFrame(frame); return; }
    const t = performance.now() / 1000;
    const k = 0.07;
    spot.x += (target.x - spot.x) * k; spot.y += (target.y - spot.y) * k; spot.r += (target.r - spot.r) * k;
    const accent = projects[active]?.color ?? '#ff2bd6';
    const [ar, ag, ab] = rgb(accent);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // searchlight beam from above + pool of light on the map
    ctx.globalCompositeOperation = 'lighter';
    const srcX = W / 2 + (spot.x - W / 2) * 0.25, srcY = -H * 0.05;
    // the beam brightens towards the spot, then fades out past it (no hard edge)
    const half = Math.min(spot.r * 0.85, W * 0.45);
    const bottom = spot.y + spot.r * 0.4;
    const flare = (bottom - srcY) / (spot.y - srcY);
    const beam = ctx.createLinearGradient(0, srcY, 0, bottom);
    beam.addColorStop(0, `rgba(${ar},${ag},${ab},0)`);
    beam.addColorStop((spot.y - srcY) / (bottom - srcY), `rgba(${ar},${ag},${ab},0.16)`);
    beam.addColorStop(1, `rgba(${ar},${ag},${ab},0)`);
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(srcX - 6, srcY); ctx.lineTo(srcX + 6, srcY);
    ctx.lineTo(srcX + (spot.x + half - srcX) * flare, bottom);
    ctx.lineTo(srcX + (spot.x - half - srcX) * flare, bottom);
    ctx.closePath(); ctx.fill();
    const pool = ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, spot.r);
    pool.addColorStop(0, `rgba(${ar},${ag},${ab},0.28)`);
    pool.addColorStop(1, `rgba(${ar},${ag},${ab},0)`);
    ctx.fillStyle = pool;
    ctx.beginPath(); ctx.ellipse(spot.x, spot.y, spot.r, spot.r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // land dots: dim graphite, lit up in the accent where the spotlight hits
    const dotR = Math.max(1, scale * STEP * 0.34);
    for (const d of DOTS) {
      const [x, y] = project(d.lon, d.lat); // Borneo dots already carry the shift
      const dist = Math.hypot((x - spot.x), (y - spot.y) / 0.62) / spot.r;
      const lit = Math.max(0, 1 - dist) ** 1.4;
      const shimmer = reduced ? 0 : 0.06 * Math.sin(t * 2 + d.seed);
      const b = Math.min(1, lit + shimmer);
      const r = Math.round(42 + (ar - 42) * b), g = Math.round(44 + (ag - 44) * b), bl = Math.round(54 + (ab - 54) * b);
      ctx.fillStyle = `rgb(${r},${g},${bl})`;
      ctx.beginPath(); ctx.arc(x, y, dotR, 0, Math.PI * 2); ctx.fill();
    }

    // pins: pulsing rings + labels; the active one in the accent colour
    ctx.font = `600 ${Math.max(9, W * 0.017)}px 'Share Tech Mono', monospace`;
    projects.forEach((p, i) => {
      const pos = pinPos(p);
      if (!pos) return;
      const [x, y] = pos;
      const on = i === active;
      const [pr, pg, pb] = on ? [ar, ag, ab] : [235, 235, 240];
      const phase = reduced ? 0.5 : (t * 0.8 + i * 0.27) % 1;
      ctx.strokeStyle = `rgba(${pr},${pg},${pb},${(1 - phase) * (on ? 0.9 : 0.35)})`;
      ctx.lineWidth = on ? 2 : 1;
      ctx.beginPath(); ctx.arc(x, y, 4 + phase * (on ? 22 : 12), 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(${pr},${pg},${pb},${on ? 1 : 0.7})`;
      ctx.shadowColor = `rgba(${pr},${pg},${pb},0.9)`; ctx.shadowBlur = on ? 14 : 6;
      ctx.beginPath(); ctx.arc(x, y, on ? 4.5 : 3, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = on ? `rgb(${pr},${pg},${pb})` : 'rgba(200,200,210,0.6)';
      // if an earlier pin sits close by (e.g. Sepang next to KL), flip this label below-left
      const crowded = projects.slice(0, i).some((q) => {
        const qp = pinPos(q);
        return qp && Math.hypot(qp[0] - x, qp[1] - y) < 28;
      });
      if (crowded) ctx.fillText(p.tag, x - 9 - ctx.measureText(p.tag).width, y + 14);
      else ctx.fillText(p.tag, x + 9, y - 7);
    });

    requestAnimationFrame(frame);
  }
  aim();
  requestAnimationFrame(frame);
  window.addEventListener('resize', aim);

  return {
    setActive(i: number) { active = i; aim(); },
  };
}
