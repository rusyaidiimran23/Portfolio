// Blob look editor: preview, part pickers, colour swatches and a shape gallery.
// Used by the Garage "Crew" screen. Calls onChange with the new look after every edit.
import { Blob2D, DEFAULT_LOOK, SHAPES, type Look, type Mood, type Shape } from './blob2d';

const PARTS: [keyof Look, string[]][] = [
  ['eyes', ['dots', 'big', 'pills', 'led']],
  ['visor', ['none', 'dark', 'smoke', 'sunset']],
  ['head', ['none', 'fullface', 'helmet', 'cap', 'headband', 'goggles']],
  ['ears', ['none', 'headset', 'earmuffs', 'antenna', 'headset+antenna']],
  ['outfit', ['none', 'suit', 'jacket', 'vest', 'bomber']],
  ['prop', ['none', 'flag', 'wrench', 'pitboard']],
  ['mouth', ['smile', 'cat', 'grin', 'none']],
];
const SWATCHES = ['#ff2bd6', '#e10600', '#00d2be', '#b6ff2e', '#ffb000', '#3fa9ff', '#b14cff', '#f3f3f5', '#14141b'];
const COLOR_ROWS: [keyof Look, string][] = [['color', 'Body'], ['outfitColor', 'Outfit'], ['helmetColor', 'Helmet']];
const LINES: Partial<Record<Mood, string>> = { talk: 'Radio check! Want to see what we\'ve built?', think: 'Hmm… checking the data…', happy: 'Purple sector!', wow: 'Whoa, new PB!' };

const CSS = `
.ce { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 1.5rem; align-items: start; }
@media (max-width: 860px) { .ce { grid-template-columns: 1fr; } }
.ce-stage { position: relative; display: grid; justify-items: center; gap: 1.2rem; padding-top: 3.2rem; }
.ce-stage svg { max-width: 100%; height: auto; cursor: pointer; }
.ce-bubble { position: absolute; top: 0; left: 50%; transform: translateX(-50%); max-width: min(300px, 80vw); padding: .5rem .8rem; background: #f3f3f5; color: #0a0a0d; font-weight: 600; border-radius: 14px; text-align: center; z-index: 1; }
.ce-bubble::after { content: ''; position: absolute; left: 50%; bottom: -8px; border: 8px solid transparent; border-bottom: 0; border-top-color: #f3f3f5; transform: translateX(-50%); }
.ce-ctl { display: grid; gap: .45rem; }
.ce-row { display: flex; flex-wrap: wrap; gap: .3rem; align-items: center; }
.ce-row > span { width: 4.6rem; color: var(--muted); font: .66rem var(--mono); letter-spacing: .18em; text-transform: uppercase; }
.ce-b { padding: .28rem .55rem; background: #111118; border: 1px solid var(--line); color: var(--ink); font: .74rem var(--mono); cursor: pointer; }
.ce-b:hover, .ce-b:focus-visible { border-color: var(--pink); }
.ce-b.on { border-color: var(--pink); background: #2a0f25; color: #fff; }
.ce-sw { width: 24px; height: 24px; border-radius: 50%; background: var(--c); border: 3px solid #0a0a0d; outline: 1px solid var(--line); cursor: pointer; padding: 0; }
.ce-sw.on { outline: 2px solid #fff; }
.ce-shapes { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: .45rem; }
.ce-shapes button { display: grid; justify-items: center; padding: .5rem .1rem .35rem; background: #0e0e14; border: 1px solid var(--line); color: #d6d6de; cursor: pointer; font: .6rem var(--mono); letter-spacing: .08em; text-transform: uppercase; }
.ce-shapes button:hover, .ce-shapes button.on { border-color: var(--pink); }
`;

export function createEditor(host: HTMLElement, onChange: (look: Look) => void) {
  if (!document.getElementById('ce-css')) document.head.insertAdjacentHTML('beforeend', `<style id="ce-css">${CSS}</style>`);
  host.innerHTML = `
    <div class="ce">
      <div class="ce-stage"><div class="ce-bubble" hidden></div><div class="ce-main"></div>
        <div class="ce-row">${['hop', 'happy', 'talk', 'think', 'wow'].map((m) => `<button class="ce-b" type="button" data-mood="${m}">${m}</button>`).join('')}</div>
      </div>
      <div class="ce-ctl">
        ${COLOR_ROWS.map(([k, label]) => `<div class="ce-row"><span>${label}</span>${SWATCHES.map((c) => `<button class="ce-sw" type="button" data-key="${k}" data-val="${c}" style="--c:${c}" aria-label="${label} ${c}"></button>`).join('')}</div>`).join('')}
        ${PARTS.map(([k, opts]) => `<div class="ce-row"><span>${k}</span>${opts.map((o) => `<button class="ce-b" type="button" data-key="${k}" data-val="${o}">${o}</button>`).join('')}</div>`).join('')}
      </div>
      <div class="ce-shapes"></div>
    </div>`;
  const $ = <T extends Element>(s: string) => host.querySelector<T>(s)!;
  const main = new Blob2D($('.ce-main'), DEFAULT_LOOK, 260);
  const minis: Blob2D[] = [];

  // shape gallery, drawn in the current colours so you see what you'd get
  const shapeBox = $('.ce-shapes');
  for (const name of Object.keys(SHAPES)) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.key = 'shape'; b.dataset.val = name;
    shapeBox.append(b);
    minis.push(new Blob2D(b, { ...DEFAULT_LOOK, shape: name as Shape }, 64));
    b.insertAdjacentHTML('beforeend', name);
  }

  function sync() {
    host.querySelectorAll<HTMLElement>('[data-key]').forEach((b) => b.classList.toggle('on', String(main.look[b.dataset.key as keyof Look]) === b.dataset.val));
    minis.forEach((m) => m.set({ color: main.look.color }));
  }

  host.addEventListener('click', (e) => {
    const t = (e.target as Element).closest<HTMLElement>('[data-key], [data-mood]');
    if (!t) return;
    if (t.dataset.mood) { mood(t.dataset.mood as Mood); return; }
    main.set({ [t.dataset.key!]: t.dataset.val } as Partial<Look>);
    main.setMood(t.dataset.key!.toLowerCase().includes('color') ? 'happy' : 'hop');
    sync();
    onChange({ ...main.look });
  });
  main.svg.addEventListener('click', () => main.setMood('hop'));
  addEventListener('pointermove', (e) => { main.lookAt(e.clientX, e.clientY); });

  const bubble = $<HTMLElement>('.ce-bubble');
  let hideT = 0;
  function mood(m: Mood) {
    main.setMood(m);
    clearTimeout(hideT);
    if (LINES[m]) { bubble.textContent = LINES[m]!; bubble.hidden = false; }
    hideT = window.setTimeout(() => { bubble.hidden = true; if (main.mood === m) main.setMood('idle'); }, 2800);
  }

  return {
    /** Load a look into the editor without firing onChange. */
    load(look: Partial<Look>) { main.set({ ...DEFAULT_LOOK, ...look }); main.setMood('hop'); sync(); },
    get look() { return { ...main.look }; },
  };
}
