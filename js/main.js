import Lenis from 'lenis';
import { ParticleField } from './particles.js';
import { loadModels } from './models.js';
import { FORMATIONS, G, buildFormation } from './formations.js';
import { LINKS, METHOD, QUESTIONS, PERSONAS, CATEGORIES, MAPPING, MECHANICS, TIERS, PHASES, MILESTONES, LIMITS } from './content.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const small = () => innerWidth <= 820 || innerWidth / innerHeight <= 1;
const LITE = small() || coarse;
const COUNT = LITE ? 12000 : 48000;

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// ── Links (pending ones say so instead of pointing nowhere) ──────────────

function wireLinks() {
  for (const a of $$('[data-link]')) {
    const url = LINKS[a.dataset.link];
    if (url) {
      a.href = url;
    } else {
      a.removeAttribute('href');
      a.setAttribute('aria-disabled', 'true');
      a.setAttribute('role', 'link');
      if (a.dataset.link === 'paper') a.textContent = 'Research paper · coming soon';
      if (a.dataset.link === 'paperPdf') a.remove();
    }
  }
  if (LINKS.video) {
    const slot = $('#video-slot');
    const isFile = /\.(mp4|webm)$/i.test(LINKS.video);
    slot.innerHTML = isFile
      ? `<video src="${LINKS.video}" controls playsinline preload="metadata" style="width:100%;height:100%;object-fit:cover"></video>`
      : `<iframe src="${LINKS.video}" title="Prototype walkthrough" allow="fullscreen" style="width:100%;height:100%;border:0"></iframe>`;
  }
}

// ── Content rendered from data ───────────────────────────────────────────

const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function renderContent() {
  $('#method-cards').innerHTML = METHOD.map((m) => `
    <article class="card"><p class="k">${m.k}</p><h3>${m.title}</h3><p>${m.body}</p></article>`).join('');

  $('#cat-list').innerHTML = CATEGORIES.map((c, i) => `<li tabindex="0" data-focus="${G.cat(i)}">${c}</li>`).join('');

  $('#map-list').innerHTML = MAPPING.map((m, i) => `
    <div class="maprow" tabindex="0" data-focus="${G.map(i)}">
      <span class="from">${m.from}</span><span class="arrow" aria-hidden="true">→</span>
      <span class="to"><b>${m.to}</b><span>${m.why}</span></span>
    </div>`).join('');

  $('#tier-list').innerHTML = TIERS.map((t, i) => `
    <div class="tier" tabindex="0" data-focus="${G.tier(i)}"><b>${t.name.toUpperCase()}</b>${t.casualties} casualt${t.casualties > 1 ? 'ies' : 'y'} · ${t.guidance}
      <span class="meta-line">${t.realism}</span>
      <span class="status ${t.status === 'built' ? '' : 'concept'}">${t.status === 'built' ? 'Built' : 'Concept'}</span></div>`).join('');

  $('#limit-list').innerHTML = LIMITS.map((l) => `<div><b>${l.k}</b>${l.body}</div>`).join('');

  $('#q-list').innerHTML = QUESTIONS.map((q, i) => `<li>Question ${i + 1}, ${q.theme}: ${q.q} Why: ${q.why} We assumed: ${q.assumed} We learned: ${q.learned}</li>`).join('');
  $('#phase-list').innerHTML = PHASES.map((p, i) => `<li>Phase ${i + 1}: ${p.title} (${p.status}). ${p.body}</li>`).join('');
}

// ── Particle field ───────────────────────────────────────────────────────

const canvas = $('#field');
let field;
const sections = $$('[data-formation], [data-formations]');
let stops = [];

function layoutFor(side) {
  const e = field.viewExtent();
  const HALF = 7.4; // half-width of a formation in world units
  if (small()) {
    const s = Math.min(1, (e.w * 1.9) / (HALF * 2));
    return { x: 0, y: e.h * 0.42, scale: s };
  }
  // Zoomed in: formations fill most of their half / the upper screen
  if (side === 'right') {
    // Right half of the screen, clear of the text column
    const s = Math.min(1.2, (e.w * 1.05) / (HALF * 2), (e.h * 1.35) / 7.5);
    return { x: e.w - HALF * s - e.w * 0.03, y: 0.1, scale: s };
  }
  if (side === 'wide') {
    const s = Math.min(1.35, (e.w * 1.85) / (HALF * 2));
    return { x: 0, y: e.h * 0.28, scale: s };
  }
  // 'top': big and centred in the upper part of the screen, above the words
  const s = Math.min(1.22, (e.w * 1.85) / (HALF * 2), (e.h * 1.05) / 5.4);
  return { x: 0, y: e.h * 0.47, scale: s };
}

function computeLayouts() {
  for (const sec of sections) {
    const keys = (sec.dataset.formations || sec.dataset.formation).split(',');
    for (const k of keys) field.setLayout(k, layoutFor(sec.dataset.side));
  }
}

// Scroll positions at which each formation is fully formed
function computeStops() {
  stops = [];
  for (const sec of sections) {
    const top = sec.getBoundingClientRect().top + scrollY;
    if (sec.dataset.formations) {
      const keys = sec.dataset.formations.split(',');
      const range = sec.offsetHeight - innerHeight;
      keys.forEach((key, i) => stops.push({ key, y: top + (range * (i + 0.3)) / keys.length, sec, sub: i }));
    } else {
      stops.push({ key: sec.dataset.formation, y: top + sec.offsetHeight / 2 - innerHeight / 2, sec, sub: 0 });
    }
  }
  stops[0].y = Math.min(stops[0].y, 0);
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Which pair of formations the current scroll position sits between
function scrollState() {
  const y = scrollY;
  let i = 0;
  while (i < stops.length - 1 && stops[i + 1].y <= y) i++;
  const a = stops[i];
  const b = stops[Math.min(i + 1, stops.length - 1)];
  if (a === b || y <= a.y) {
    const prev = stops[Math.max(0, i - 1)];
    const t0 = a === prev ? 0 : Math.max(-1, (y - a.y) / (a.y - prev.y || 1));
    return { a, b: a, mix: 0, t: t0 };
  }
  const t = (y - a.y) / (b.y - a.y);
  // Hold each formation for a while, then transition
  const mix = reduced ? (t < 0.5 ? 0 : 1) : smooth(0.22, 0.78, t);
  return { a, b, mix, t };
}

// ── Hotspots (labels & buttons positioned over formations) ───────────────

const hotspots = [];

function addHotspot(key, anchor, el, color) {
  el.classList.add('hs');
  if (color) el.style.color = color;
  $('#hotspots').appendChild(el);
  hotspots.push({ key, anchor, el });
}

function label(text) {
  const el = document.createElement('span');
  el.innerHTML = `<i class="dot"></i>${text}`;
  el.setAttribute('aria-hidden', 'true');
  return el;
}

function buildHotspots() {
  const H = FORMATIONS;
  addHotspot('hero', H.hero.anchors.hazard, label('Hazard'), 'var(--teal)');
  addHotspot('hero', H.hero.anchors.patient, label('Patient'), 'var(--coral)');
  addHotspot('hero', H.hero.anchors.phone, label('The call'), 'var(--purple)');

  // Personas: real buttons that open the anonymised profile
  PERSONAS.forEach((p, i) => {
    const b = document.createElement('button');
    b.textContent = p.code;
    b.setAttribute('aria-label', `Interviewee ${p.code}${p.role ? `, ${p.role}` : ''}`);
    b.addEventListener('click', () => openPersona(i));
    b.addEventListener('pointerenter', () => setFocus(G.persona(i)));
    b.addEventListener('pointerleave', () => setFocus(-1));
    b.addEventListener('focus', () => setFocus(G.persona(i)));
    b.addEventListener('blur', () => setFocus(-1));
    addHotspot('research', H.research.anchors[`p${i}`], b, 'var(--fg)');
  });

  // Act I: the research landscape
  const axis = (t) => { const el = label(t); el.classList.add('group'); return el; };
  const LA = H.landscape.anchors;
  addHotspot('landscape', LA.procedural, axis('Procedural'), 'var(--faint)');
  addHotspot('landscape', LA.collaborative, axis('Collaborative'), 'var(--faint)');
  addHotspot('landscape', LA.professional, axis('Professionals'), 'var(--faint)');
  addHotspot('landscape', LA.lay, axis('Lay responders'), 'var(--faint)');
  addHotspot('landscape', LA.empty, label('Empty: where road accidents happen'), 'var(--coral)');
  addHotspot('window', H.window.anchors.dial, label('Before the ambulance arrives'), 'var(--coral)');
  addHotspot('window', H.window.anchors.group, label('Everyone waits for someone else'), 'var(--faint)');

  // Act II: the rescue chain
  ['Secure', 'Call', 'First aid', 'Hand over'].forEach((t, i) =>
    addHotspot('chain', H.chain.anchors[`l${i}`], label(t), ['var(--teal)', 'var(--purple)', 'var(--coral)', 'var(--fg)'][i]));

  // Act III: question pictures
  addHotspot('q2', H.q2.anchors.alone, label('Trained alone, on a dummy'), 'var(--amber)');
  addHotspot('q3', H.q3.anchors.room, label('Classroom'), 'var(--faint)');
  addHotspot('q3', H.q3.anchors.road, label('Real road'), 'var(--coral)');
  ['Easy', 'Medium', 'Extreme'].forEach((t, i) => {
    const el = label(t);
    el.style.transform = 'translate(-50%, 0) translateY(14px)';
    addHotspot('q4', H.q4.anchors[`t${i}`], el, ['var(--teal)', 'var(--amber)', 'var(--coral)'][i]);
  });
  addHotspot('q4', H.q4.anchors.calm, label('Calm'), 'var(--teal)');
  addHotspot('q4', H.q4.anchors.chaos, label('Chaos'), 'var(--coral)');
  addHotspot('q5', H.q5.anchors.point, label('Point + name'), 'var(--purple)');
  addHotspot('q5', H.q5.anchors.you, label('Confirmed'), 'var(--teal)');
  ['Call made', 'Roles assigned', 'Instruction unconfirmed'].forEach((t, i) => {
    const el = label(t);
    el.style.transform = 'translate(-50%, -100%) translateY(-12px)';
    addHotspot('q6', H.q6.anchors[`m${i}`], el, ['var(--purple)', 'var(--teal)', 'var(--coral)'][i]);
  });

  // Act III: coded categories
  CATEGORIES.forEach((c, i) => {
    const el = label(`0${i + 1}`);
    el.style.transform = 'translate(-50%, 0)';
    addHotspot('analysis', H.analysis.anchors[`c${i}`], el, 'var(--muted)');
  });

  // Act IV: tiers
  TIERS.forEach((t, i) => addHotspot('tiers', H.tiers.anchors[`t${i}`], label(t.name), ['var(--teal)', 'var(--amber)', 'var(--coral)'][i]));

  addHotspot('roles', H.roles.anchors.scene, label('Hazards only'), 'var(--teal)');
  addHotspot('roles', H.roles.anchors.people, label('Dial prompt only'), 'var(--purple)');
  addHotspot('roles', H.roles.anchors.medical, label('Vitals only'), 'var(--coral)');

  const groupLabel = (t) => { const el = label(t); el.classList.add('group'); return el; };
  addHotspot('status', H.status.anchors.done, groupLabel('Done'), 'var(--teal)');
  addHotspot('status', H.status.anchors.owed, groupLabel('Still owed'), 'var(--faint)');

  addHotspot('built', H.built.anchors.built, label('Built'), 'var(--teal)');
  addHotspot('built', H.built.anchors.concept, label('Not yet built'), 'var(--faint)');

  // Timeline milestones
  MILESTONES.forEach((m, i) => {
    const b = document.createElement('button');
    b.className = `milestone${m.done ? '' : ' todo'}`;
    b.innerHTML = `<span class="num">${String(i + 1).padStart(2, '0')}</span><span class="lbl">${m.label}</span>`;
    b.setAttribute('aria-label', `${m.label}: ${m.done ? 'done' : 'not yet done'}. ${m.detail}`);
    const show = () => {
      setFocus(G.milestone(i));
      $('#status-detail').textContent = `${m.label}. ${m.detail}`;
    };
    const hide = () => {
      setFocus(-1);
      $('#status-detail').textContent = statusDefault;
    };
    b.addEventListener('pointerenter', show);
    b.addEventListener('pointerleave', hide);
    b.addEventListener('focus', show);
    b.addEventListener('blur', hide);
    addHotspot('status', H.status.anchors[`m${i}`], b, m.done ? 'var(--fg)' : 'var(--faint)');
  });
}

let statusDefault = '';

const narrow = matchMedia('(max-width: 820px)');

// On phones the copy sits over the lower part of the scene; labels stop above it
function copyTop() {
  let top = innerHeight;
  for (const c of $$('main .copy')) {
    const r = c.getBoundingClientRect();
    if (r.bottom > 0 && r.top < innerHeight && r.top < top) top = r.top;
  }
  return top;
}

function placeHotspots(state) {
  const presence = (key) =>
    (state.a.key === key ? 1 - state.mix : 0) + (state.b.key === key && state.b !== state.a ? state.mix : 0);
  const small = narrow.matches;
  const limit = small ? copyTop() : Infinity;
  for (const h of hotspots) {
    const p = presence(h.key);
    let visible = p > 0.8;
    if (p > 0.01) {
      const s = field.project(h.key, h.anchor);
      let x = s.x;
      if (small) {
        // Keep the whole label on screen, and hide it where it would sit on the text
        const half = h.el.offsetWidth / 2 + 12;
        x = Math.min(innerWidth - half, Math.max(half, x));
        if (s.y > limit - 8) visible = false;
      }
      h.el.style.left = `${x}px`;
      h.el.style.top = `${s.y}px`;
    }
    h.el.style.opacity = visible ? String((p - 0.8) / 0.2) : '0';
    h.el.classList.toggle('live', visible);
    h.el.tabIndex = visible ? 0 : -1;
  }
}

// ── Interactions ─────────────────────────────────────────────────────────

let userFocus = -1;
let roleFocus = -1;

function setFocus(g) {
  userFocus = g;
  field && field.setFocus(g >= 0 ? g : roleFocus);
}

function wireCards() {
  for (const el of $$('[data-focus]')) {
    const g = Number(el.dataset.focus);
    el.addEventListener('pointerenter', () => { el.classList.add('active'); setFocus(g); });
    el.addEventListener('pointerleave', () => { el.classList.remove('active'); setFocus(-1); });
    el.addEventListener('focusin', () => setFocus(g));
    el.addEventListener('focusout', () => setFocus(-1));
  }
}

function setRole(role) {
  const info = MECHANICS[role];
  $('#role-title').textContent = info.title;
  $('#role-sees').textContent = info.sees;
  $('#role-does').textContent = info.does;
  $('#role-hyp').textContent = info.hyp;
  $('#role-hyp').hidden = !info.hyp;
  $('#role-hyp-k').hidden = !info.hyp;
  for (const b of $$('[data-role]')) b.setAttribute('aria-pressed', String(b.dataset.role === role));
  roleFocus = { all: -1, scene: G.scene, people: G.people, medical: G.medical }[role];
  setFocus(userFocus);
}

function openPersona(i) {
  const p = PERSONAS[i];
  $('#persona-code').textContent = p.code;
  const filled = p.role || p.quotes.length;
  $('#persona-body').innerHTML = filled
    ? `<p class="muted">${[p.role, p.experience].filter(Boolean).join(' · ')}</p>
       <dl>
         ${p.pain ? `<div><dt>What they struggled with</dt><dd>${p.pain}</dd></div>` : ''}
         ${p.quotes.map(q => `<div><dt>In their words</dt><dd><blockquote>“${q}”</blockquote></dd></div>`).join('')}
         ${p.led ? `<div><dt>What it led to</dt><dd>${p.led}</dd></div>` : ''}
       </dl>`
    : `<p class="muted">Emergency response professional</p>
       <p class="pending">This profile is being written from the interview transcript. Nothing here is invented, so it stays empty until the anonymised quotes are ready.</p>`;
  $('#persona-sheet').showModal();
}

function wireInteractions() {
  for (const b of $$('[data-role]')) b.addEventListener('click', () => setRole(b.dataset.role));
  $('#persona-close').addEventListener('click', () => $('#persona-sheet').close());
  $('#persona-sheet').addEventListener('click', (e) => { if (e.target.id === 'persona-sheet') e.target.close(); });

  if (!coarse && !reduced) {
    addEventListener('pointermove', (e) => field.setPointer((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1));
    document.addEventListener('pointerleave', () => field.clearPointer());
  }
}

// ── Scroll-linked UI: pull quote, phases, chapter, nav, progress ─────────

let lastKey = null;
let lastPhase = -1;

function updatePhase(i) {
  if (i === lastPhase) return;
  lastPhase = i;
  const p = PHASES[i];
  const panel = $('#phases .copy');
  panel.classList.remove('swap');
  void panel.offsetWidth; // restart the animation
  panel.classList.add('swap');
  $('#phase-num').textContent = String(i + 1).padStart(2, '0');
  $('#phase-title').textContent = p.title;
  $('#phase-body').textContent = p.body;
  const st = $('#phase-status');
  st.className = `status ${p.status === 'built' ? '' : p.status}`;
  st.textContent = { built: 'Built', concept: 'Concept', partial: 'Partly built' }[p.status];
  $$('#phase-steps i').forEach((el, k) => {
    el.className = k <= i ? (PHASES[k].status === 'built' ? 'on' : 'dim') : '';
  });
}

let lastQ = -1;

function updateQuestion(i) {
  if (i === lastQ) return;
  lastQ = i;
  const q = QUESTIONS[i];
  const panel = $('#questions .qpanel');
  panel.classList.remove('swap');
  void panel.offsetWidth;
  panel.classList.add('swap');
  $('#q-num').textContent = String(i + 1).padStart(2, '0');
  $('#q-theme').textContent = q.theme;
  $('#q-text').textContent = q.q;
  $('#q-why').textContent = q.why;
  $('#q-heard').innerHTML = q.heard.map((h) => `
    <figure><blockquote>“${esc(h.t)}”</blockquote><figcaption>${h.p}</figcaption></figure>`).join('');
  $('#q-assumed').textContent = q.assumed;
  $('#q-learned').textContent = q.learned;
  $$('#q-steps i').forEach((el, k) => { el.className = k <= i ? 'on' : ''; });
}

const STEP_HANDLERS = { phases: updatePhase, questions: updateQuestion };

function updateScrollUI(state) {
  const dom = state.mix < 0.5 ? state.a : state.b;

  if (dom.key !== lastKey) {
    lastKey = dom.key;
    $('#chapter').textContent = dom.sec.dataset.chapter || '';
    if (userFocus >= 0) setFocus(-1);
    for (const a of $$('.nav-links a')) {
      a.setAttribute('aria-current', String(a.getAttribute('href') === `#${dom.sec.id}`));
    }
  }

  const handler = STEP_HANDLERS[dom.sec.dataset.steps];
  if (handler) handler(dom.sub);

  // Role focus only applies while the roles formation is on screen
  field.setFocus(userFocus >= 0 ? userFocus : dom.key === 'roles' ? roleFocus : -1);

  const max = document.documentElement.scrollHeight - innerHeight;
  $('#progress').style.width = `${(scrollY / Math.max(1, max)) * 100}%`;
}

// ── Camera shots: framing per chapter, driven by scroll ─────────────────

// zoom > 1 pushes in, < 1 pulls back. focus is a formation-local point to zoom
// towards (defaults to the formation's middle).
const SHOTS = {
  hero: { zoom: 1, focus: [0.4, -0.6] },
  problem: { zoom: 1 },
  research: { zoom: 1, focus: [1.2, -0.9] },
  insights: { zoom: 1 },
  pain: { zoom: 1, focus: [-2.4, -0.6] },
  gap: { zoom: 0.92 },
  roles: { zoom: 1, dolly: 0.08 },
  phase1: { zoom: 1 },
  phase2: { zoom: 1 },
  phase3: { zoom: 1 },
  phase4: { zoom: 1 },
  built: { zoom: 1 },
  status: { zoom: 1, dolly: 0.06 },
  reflect: { zoom: 1, focus: [0, 0.6] },
};

// The look-at point that scales a formation around `focus` without moving it on screen
function shotFor(key, t) {
  const lay = field.layouts[key] || { x: 0, y: 0, scale: 1 };
  const shot = SHOTS[key] || { zoom: 1 };
  const f = shot.focus || [0, -0.3];
  const fx = f[0] * lay.scale + lay.x;
  const fy = f[1] * lay.scale + lay.y;
  // Scroll-linked dolly: t is where the chapter sits (-1 arriving .. 0 centred .. 1 leaving).
  // The scene zooms in as it arrives and back out as it leaves.
  const amount = reduced ? 0 : small() ? 0.08 : (shot.dolly ?? 0.26);
  const near = 1 - Math.min(1, Math.abs(t) * 1.4);
  const zoom = shot.zoom * (1 + amount * near * near * (3 - 2 * near));
  const k = 1 - 1 / zoom;
  return { x: fx * k, y: 0.2 + (fy - 0.2) * k, dist: 18 / zoom };
}

function updateCamera(state) {
  const t = state.t ?? 0;
  const A = shotFor(state.a.key, t);
  const B = shotFor(state.b.key, t - 1);
  const m = state.mix;
  const e = m * m * (3 - 2 * m);
  // Transitions: pull back and swing in an arc while particles are in flight
  const flight = reduced ? 0 : Math.sin(m * Math.PI);
  const dir = state.b.y >= state.a.y ? 1 : -1;
  field.setShot({
    x: A.x + (B.x - A.x) * e,
    y: A.y + (B.y - A.y) * e,
    dist: A.dist + (B.dist - A.dist) * e + flight * 1.0,
    swing: flight * 0.03 * dir,
  });
}

// ── Chapter haze: a soft colour wash behind each formation ───────────────

const haze = $('#haze');
function tintHaze(state) {
  const A = field.formations[state.a.key];
  const B = field.formations[state.b.key];
  const m = state.mix;
  const c = A.tint.map((v, i) => Math.round((v + (B.tint[i] - v) * m) * 255));
  const pa = field.project(state.a.key, [0, -0.5]);
  const pb = field.project(state.b.key, [0, -0.5]);
  haze.style.setProperty('--hc', `${c[0]}, ${c[1]}, ${c[2]}`);
  haze.style.setProperty('--hx', `${pa.x + (pb.x - pa.x) * m}px`);
  haze.style.setProperty('--hy', `${pa.y + (pb.y - pa.y) * m}px`);
}

// ── Scroll animations: word rise, staggered reveals, parallax ────────────

function splitWords(el) {
  let n = 0;
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        for (const part of child.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); continue; }
          const w = document.createElement('span');
          w.className = 'w';
          w.innerHTML = `<span style="--i:${n++}">${part}</span>`;
          frag.appendChild(w);
        }
        child.replaceWith(frag);
      } else if (child.nodeName !== 'BR') {
        walk(child);
      }
    }
  };
  walk(el);
}

function setupReveals() {
  for (const sec of $$('.beat, .pinned')) {
    for (const h of $$('h1, h2:not(#phase-title)', sec)) splitWords(h);
    if (sec.id === 'questions') continue; // question panel swaps content per step
    const items = $$('.eyebrow, .copy > p, .meta, .chips, .cards > *, .seg, .panel, .mechanics > li, .tiers > *, .split > *, .video-slot, .actions, .hero-actions > *, .counter, #phase-status, .steps', sec);
    items.forEach((el, i) => {
      el.setAttribute('data-reveal', '');
      el.style.setProperty('--d', i);
    });
  }
  if (reduced) {
    for (const sec of $$('.beat, .pinned')) sec.classList.add('in');
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.target.classList.toggle('in', e.isIntersecting);
  }, { threshold: 0, rootMargin: '-18% 0px -18% 0px' });
  for (const sec of $$('.beat, .pinned')) io.observe(sec);
}

// Text blocks drift slightly slower than the page for depth
const parallaxEls = [];
function parallax() {
  if (reduced || small()) return;
  if (!parallaxEls.length) parallaxEls.push(...$$('.beat > .copy, .beat > .hero-grid'));
  for (const el of parallaxEls) {
    const r = el.parentElement.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) continue;
    const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
    el.style.transform = `translate3d(0, ${(p * 60).toFixed(1)}px, 0)`;
  }
}

// ── Boot ─────────────────────────────────────────────────────────────────

async function boot() {
  wireLinks();
  renderContent();
  statusDefault = $('#status-detail').textContent;

  field = new ParticleField(canvas, COUNT, { bloom: !LITE });
  field.uniforms.uSize.value = LITE ? 1.7 : 1.15;
  field.terrain.material.uniforms.uSize.value = LITE ? 2.2 : 1.9;
  if (reduced) field.uniforms.uMouseStrength.value = 0;

  // Formations sample real 3D models and text drawn in Inter Tight
  const loading = $('#loading');
  try { await document.fonts.load('300 40px "Inter Tight"'); } catch { /* fall back to system font */ }
  try {
    await loadModels();
  } catch (e) {
    loading.textContent = 'Scene failed to load';
    throw e;
  }
  for (const [key, def] of Object.entries(FORMATIONS)) field.setFormation(key, buildFormation(def, COUNT));
  loading.classList.add('done');

  const resize = () => {
    field.resize(innerWidth, innerHeight);
    computeLayouts();
    computeStops();
    field.refresh();
  };
  resize();
  addEventListener('resize', resize);
  // Layout can shift once fonts and content settle
  setTimeout(computeStops, 600);

  buildHotspots();
  setRole('all');
  wireCards();
  wireInteractions();

  const lenis = reduced ? null : new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9 });
  if (lenis) {
    document.documentElement.style.scrollBehavior = 'auto';
    for (const a of $$('a[href^="#"]')) {
      a.addEventListener('click', (e) => {
        const target = a.getAttribute('href') === '#top' ? 0 : $(a.getAttribute('href'));
        if (target === null) return;
        e.preventDefault();
        lenis.scrollTo(target, { duration: 1.6 });
      });
    }
  }
  setupReveals();

  let last = performance.now();
  let shownMix = 0;
  let shownPair = '';
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (lenis) lenis.raf(now);
    const state = scrollState();
    // Ease the particle mix toward the scroll target so steps never jump
    const pairId = state.a.key + '>' + state.b.key;
    if (pairId !== shownPair) { shownPair = pairId; shownMix = state.mix; }
    shownMix += (state.mix - shownMix) * (reduced ? 1 : Math.min(1, dt * 12));
    state.mix = shownMix;
    parallax();
    const still = reduced || (state.mix === 0 && FORMATIONS[state.a.key].still);
    field.show(state.a.key, state.b.key, state.mix);
    // Terrain meets the ground line of whichever formation is on screen
    const ga = field.layouts[state.a.key];
    const gb = field.layouts[state.b.key];
    const gy = (l) => l.y - 2.55 * l.scale;
    field.setGround(gy(ga) + (gy(gb) - gy(ga)) * state.mix);
    tintHaze(state);
    updateCamera(state);
    updateScrollUI(state);
    placeHotspots(state);
    field.render(dt, still);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

boot();
