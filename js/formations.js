import * as S from './shapes.js';
import { sampleFigure, sampleModel, sampleBaked, shade } from './models.js';

// Colour meanings (fixed across the page)
export const C = {
  white: [0.95, 0.96, 0.98],
  teal: [0.25, 0.69, 0.63],    // Scene management, built & confirmed
  coral: [0.91, 0.45, 0.29],   // Medical management, the problem
  purple: [0.56, 0.49, 0.76],  // People management, research
  amber: [0.95, 0.64, 0.31],   // Insights, reflection
};

// Density rule: built = dense & still, concept = sparse, dim, drifting
export const CONCEPT = { alpha: 0.45, drift: 0.26 };

// Group ids used for hover / role focus
export const G = {
  none: 0, scene: 1, people: 2, medical: 3,
  persona: (i) => 11 + i,
  insight: (i) => 21 + i,
  gapRing: (i) => 31 + i,
  milestone: (i) => 41 + i,
  built: 51, concept: 52,
  map: (i) => 61 + i,
  cat: (i) => 71 + i,
  cell: (i) => 81 + i,
  tier: (i) => 91 + i,
};

// A layer = some shapes sharing a colour and behaviour.
//  soft   : blur (px) before sampling; soft shapes glow at the core, fade at the edge
//  volume : how far the thick parts of a shape bulge towards/away from the camera
//  tilt   : rotate the layer about a horizontal axis (turns flat rings into orbits)
const L = (shapes, weight, color, opts = {}) => ({
  shapes: Array.isArray(shapes) ? shapes : [shapes],
  weight,
  color,
  alpha: opts.alpha ?? 1,
  size: opts.size ?? 1,
  group: opts.group ?? 0,
  drift: opts.drift ?? 0.02,
  soft: opts.soft ?? 1.2,
  volume: opts.volume ?? 0.12,
  tilt: opts.tilt ?? null,
  shade: opts.shade ?? 'flat',
});

// A true 3D layer: gen(count, rand) -> [{ x, y, z, b, c }]
const L3 = (gen, weight, opts = {}) => ({ ...L([], weight, C.white, opts), gen });

// Particle sphere with a vertical colour gradient (lit from above)
const sphere = (cx, cy, r, top, bottom) => (n, rand) => Array.from({ length: n }, () => {
  const u = rand() * 2 - 1;
  const th = rand() * Math.PI * 2;
  const k = Math.sqrt(1 - u * u);
  const x = Math.cos(th) * k;
  const z = Math.sin(th) * k;
  const shell = 0.93 + rand() * 0.07;
  const lit = 0.3 + 0.7 * Math.pow((u + 1) / 2, 0.8);
  const t = (u + 1) / 2;
  return {
    x: cx + x * r * shell, y: cy + u * r * shell, z: z * r * shell,
    b: lit * (0.4 + 0.6 * Math.abs(z) ** 0.3),
    c: bottom.map((v, i) => v + (top[i] - v) * t),
  };
});

// Human bodies: soft edges, real depth and rim lighting
const body = (h) => ({ soft: Math.min(2.8, h * 0.85), volume: h * 0.14, shade: 'rim' });
const LIGHT_BLUE = [0.72, 0.86, 1];

const ground = (a = 0.22) => L(S.path([[-7, -2.45], [7, -2.45]], 0.02), 0.035, C.white, { alpha: a, size: 0.7, soft: 0.5, volume: 0.02 });

// ── Real-model layers: surface points, lit and stippled ───────────────────

const mixWhite = (c, k) => c.map((v) => v + (1 - v) * k);

// Keep points with probability ~ brightness (stippling) and brighten highlights
function stipple(pts, n, rand, color, look) {
  const out = [];
  for (const q of pts) {
    const b = shade(q, look) * (q.albedo === undefined ? 1 : 0.35 + q.albedo * 0.9);
    if (rand() > 0.12 + Math.min(1, b) * 0.88) continue;
    out.push({ x: q.x, y: q.y, z: q.z, b: 0.3 + 0.7 * b, c: mixWhite(color, Math.pow(b, 3) * 0.45) });
    if (out.length >= n) break;
  }
  return out;
}

// A posed person (realistic rig), feet at (x, y), height h, facing yaw (0 = camera)
const person = (pose, x, h, color, { yaw = 0, y = -2.45, who = 'soldier' } = {}) =>
  (n, rand) => stipple(sampleFigure(pose, { who, x, y, h, yaw, count: n * 2, rand }), n, rand, color);

// The crashed car, side on, with airflow streaks trailing off the back
const carModel = (x, len, color, { y = -2.45, streaks = 0.22, yaw = Math.PI / 2 } = {}) => (n, rand) => {
  const body = stipple(sampleBaked('car', { x, y, size: len, yaw, count: Math.ceil(n * 1.8), rand }), Math.floor(n * (1 - streaks)), rand, color);
  const tops = body.filter((q) => q.y > y + len * 0.1);
  const minX = Math.min(...body.map((q) => q.x));
  const trails = [];
  for (let k = 0; tops.length && k < n * streaks; k++) {
    const src = tops[Math.floor(rand() * tops.length)];
    const t = Math.pow(rand(), 1.6);
    const reach = (src.x - minX) + len * (0.3 + rand() * 0.6);
    trails.push({
      x: src.x - reach * t, y: src.y + Math.sin(t * 3 + src.y) * 0.04 - t * 0.08, z: src.z * (1 - t * 0.3),
      b: (1 - t) * 0.55, c: mixWhite(color, 0.3),
    });
  }
  return body.concat(trails);
};

const bakedModel = (which, x, size, color, { y = -2.45, yaw = 0, look } = {}) =>
  (n, rand) => stipple(sampleBaked(which, { x, y, size, yaw, count: Math.ceil(n * 1.8), rand }), n, rand, color, look);

// Rim-lit head, dark where it faces you (like a portrait lit from behind)
const portrait = (x, y, size) => (n, rand) => {
  const pts = sampleModel('head', { x, y, size, yaw: -0.85, count: n * 3, rand, anchor: 'center' });
  const out = [];
  for (const q of pts) {
    const b = shade(q, { key: 0.22, rim: 1.3, ambient: 0.01, rimPow: 3.2 });
    if (rand() > 0.05 + b * 0.95) continue;
    const t = Math.min(1, Math.max(0, (q.y - (y - size / 2)) / size));   // 0 bottom .. 1 top
    const warm = [1, 0.55, 0.32];
    const cool = [0.78, 0.86, 1];
    out.push({ x: q.x, y: q.y, z: q.z, b: 0.2 + 0.8 * b, c: warm.map((v, i) => v + (cool[i] - v) * Math.pow(t, 0.7)) });
    if (out.length >= n) break;
  }
  return out;
};

const WARM_WHITE = [0.98, 0.95, 0.9];

// ── The story, one formation per beat ──────────────────────────────────────

export const FORMATIONS = {
  // A crash, a person on the kerb, and the three things that matter
  hero: {
    fill: 0.84,
    tint: C.coral,
    glow: [{ at: [1.9, -1.4], color: [1, 0.86, 0.8], size: 5, strength: 0.3 }],
    layers: [
      L3(person('dazed', 1.9, 3.4, WARM_WHITE, { yaw: -0.5 }), 0.3, { group: G.medical }),
      L3(carModel(-2.3, 5.4, LIGHT_BLUE, { streaks: 0.12 }), 0.5, { alpha: 1 }),
      L(S.warningTriangle(-6.1, -2.45, 0.7), 0.04, C.teal, { group: G.scene }),
      L([S.phone(5.1, 1.3, 0.8), S.signal(5.1, 1.3, 0.85)], 0.05, C.purple, { group: G.people }),
      ground(),
    ],
    anchors: { hazard: [-6.1, -1.5], patient: [2.0, 1.05], phone: [5.1, 2.55] },
  },

  // Seven interviews converging on one set of findings
  research: {
    fill: 0.82,
    tint: C.purple,
    glow: [{ at: [1.2, -0.9], color: [1, 0.78, 0.5], size: 3.2, strength: 0.5 }],
    layers: (() => {
      const layers = [];
      const cx = 1.2;
      const cy = -0.9;
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i / 7) * Math.PI * 2;
        const x = cx + Math.cos(a) * 4.2;
        const y = cy + Math.sin(a) * 2.2;
        const h = 1.7 - Math.sin(a) * 0.3; // closer figures slightly larger
        // Everyone turns towards the shared centre
        const yaw = Math.atan2(cx - x, 2.5);
        layers.push(L3(person(i % 3 === 1 ? 'phone' : 'stand', x, h, C.purple, { y: y - h * 0.45, yaw, who: i % 2 ? 'soldier' : 'xbot' }), 0.1, { group: G.persona(i) }));
        layers.push(L(S.path([[x, y - h * 0.05], [cx, cy]], 0.018, [0.08, 0.1]), 0.012, C.purple, { alpha: 0.5, size: 0.6, soft: 0.4 }));
      }
      layers.push(L3(sphere(cx, cy, 0.62, C.amber, C.white), 0.07, { size: 1 }));
      return layers;
    })(),
    anchors: Object.fromEntries(Array.from({ length: 7 }, (_, i) => {
      const a = -Math.PI / 2 + (i / 7) * Math.PI * 2;
      const h = 1.7 - Math.sin(a) * 0.3;
      return [`p${i}`, [1.2 + Math.cos(a) * 4.2, -0.9 + Math.sin(a) * 2.2 + h * 0.62]];
    })),
  },

  // Act I: the literature as a 2x2. Three cells are occupied; collaborative + lay is empty.
  landscape: {
    fill: 0.6,
    tint: C.coral,
    layers: [
      L(S.path([[-5.6, 0], [5.6, 0]], 0.02), 0.05, C.white, { alpha: 0.45, size: 0.7, soft: 0.3 }),
      L(S.path([[0, -2.5], [0, 2.5]], 0.02), 0.04, C.white, { alpha: 0.45, size: 0.7, soft: 0.3 }),
      // procedural + professional (top left): one trainee
      L3(person('stand', -2.8, 1.8, C.white, { y: 0.25, yaw: 0.3 }), 0.13, { alpha: 0.75, group: G.cell(0) }),
      // procedural + lay (bottom left): one person on a dummy
      L3(bakedModel('cpr', -2.8, 1.5, C.white, { y: -2.3, yaw: Math.PI / 2 }), 0.13, { alpha: 0.75, group: G.cell(1) }),
      // collaborative + professional (top right): pre-assigned crew
      L3((n, r) => [
        ...person('stand', 1.9, 1.6, C.white, { y: 0.25, yaw: 0.6 })(Math.floor(n / 3), r),
        ...person('phone', 2.9, 1.7, C.white, { y: 0.25, yaw: 0 })(Math.floor(n / 3), r),
        ...person('stand', 3.9, 1.6, C.white, { y: 0.25, yaw: -0.6, who: 'xbot' })(Math.floor(n / 3), r),
      ], 0.2, { alpha: 0.75, group: G.cell(2) }),
      // collaborative + lay (bottom right): empty
      L(S.ring(2.9, -1.25, 0.85, 0.85, 0.04, [0.09, 0.11]), 0.06, C.coral, { alpha: 0.9, drift: 0.04, group: G.cell(3) }),
      L(S.questionMark(2.9, -1.2, 1.0), 0.05, C.coral, { alpha: 0.9, group: G.cell(3), soft: 1.2 }),
    ],
    anchors: {
      procedural: [-2.8, 2.35], collaborative: [2.9, 2.35], professional: [-5.4, 1.3], lay: [-5.4, -1.25],
      empty: [2.9, -2.35],
    },
  },

  // Act I: 8-12 minutes before professional help arrives, and nobody moves
  window: {
    fill: 0.62,
    tint: C.coral,
    layers: [
      L3((n, rand) => {
        // 12 minute ticks on a dial; the 8-12 minute arc glows coral
        const out = [];
        const cx = 2.6;
        const cy = 0.1;
        const R = 2.1;
        for (let k = 0; k < n; k++) {
          const tick = k % 60;
          const minute = tick / 5;
          const a = Math.PI / 2 - (tick / 60) * Math.PI * 2;
          const major = tick % 5 === 0;
          const len = major ? 0.28 : 0.1;
          const t = rand();
          const r0 = R - len * t;
          const hot = minute >= 8 && minute <= 12;
          out.push({
            x: cx + Math.cos(a) * r0, y: cy + Math.sin(a) * r0, z: (rand() - 0.5) * 0.05,
            b: major ? 1 : 0.55, c: hot ? C.coral : C.white,
          });
        }
        return out;
      }, 0.18, { size: 0.9 }),
      L(S.ring(2.6, 0.1, 2.35, 2.35, 0.012), 0.05, C.white, { alpha: 0.3, size: 0.6, soft: 0.3 }),
      L(S.text('8–12', 2.6, 0.35, 1.0, 200), 0.08, C.white, { soft: 0.6 }),
      L(S.text('min', 2.6, -0.55, 0.4, 300), 0.03, C.white, { alpha: 0.6, soft: 0.4 }),
      L3(person('stand', -5.3, 2.0, C.white, { yaw: 0.6 }), 0.1, { alpha: 0.7, drift: 0.1 }),
      L3(person('frozen', -3.9, 2.1, C.white, { yaw: 0.2 }), 0.1, { alpha: 0.7, drift: 0.1 }),
      L3(person('phone', -2.5, 2.0, C.white, { yaw: -0.3 }), 0.1, { alpha: 0.7, drift: 0.1 }),
      L3(person('stand', -1.1, 2.05, C.white, { yaw: -0.7, who: 'xbot' }), 0.1, { alpha: 0.7, drift: 0.1 }),
      ground(0.14),
    ],
    anchors: { dial: [2.6, 2.65], group: [-3.2, 0.1] },
  },

  // Act II: the rescue chain as four interlocking links
  chain: (() => {
    // Four ordered stations, then the same phases laid on a 0–12 minute axis
    const X = [-4.5, -1.5, 1.5, 4.5];
    const Y = 0.1;
    const COL = [C.teal, C.purple, C.coral, C.white];
    const T = (m) => -5.6 + m * (11.2 / 12);
    const AY = -2.35;
    const layers = [
      L(S.path([[X[0], Y], [X[3], Y]], 0.02), 0.05, C.white, { alpha: 0.35, size: 0.7, soft: 0.3 }),
      ...X.slice(0, 3).map((x) => L(S.path([[x + 1.38, Y + 0.16], [x + 1.55, Y], [x + 1.38, Y - 0.16]], 0.03), 0.012, C.white, { alpha: 0.7, soft: 0.3 })),
      ...X.map((x, i) => L([S.disc(x, Y, 0.1), S.ring(x, Y, 0.3, 0.3, 0.025)], 0.05, COL[i], { size: 0.9, soft: 0.3 })),
      L(S.warningTriangle(X[0], 1.35, 0.7), 0.05, C.teal, { soft: 0.8 }),
      L([S.phone(X[1], 1.4, 0.75), S.signal(X[1], 1.4, 0.75)], 0.06, C.purple, { soft: 0.8 }),
      L(S.heart(X[2], 1.35, 0.5), 0.05, C.coral, { soft: 1 }),
      L(S.ambulance(X[3], 1.2, 1.35), 0.06, C.white, { soft: 0.7 }),
      // Time axis: each phase in its colour, ambulance window dashed
      ...[[0, 1], [1, 2], [2, 10], [10, 12]].map(([m0, m1], i) =>
        L(S.path([[T(m0) + 0.04, AY], [T(m1) - 0.04, AY]], 0.035), 0.03 + (m1 - m0) * 0.004, COL[i], { size: 0.8, soft: 0.2 })),
      L(S.path([[T(8), AY + 0.42], [T(12), AY + 0.42]], 0.02, [0.07, 0.09]), 0.015, C.amber, { alpha: 0.8, size: 0.7, soft: 0.3 }),
      L(S.path([[T(0), AY + 0.42], [T(8), AY + 0.42]], 0.015), 0.02, C.white, { alpha: 0.3, size: 0.6, soft: 0.3 }),
      ...Array.from({ length: 13 }, (_, m) => L(S.path([[T(m), AY - 0.07], [T(m), AY - (m % 4 === 0 ? 0.2 : 0.12)]], 0.015), 0.003, C.white, { alpha: 0.5, size: 0.6 })),
    ];
    return {
      fill: 0.72,
      tint: C.teal,
      layers,
      anchors: {
        ...Object.fromEntries(X.map((x, i) => [`l${i}`, [x, Y - 0.42]])),
        t0: [T(0), AY - 0.3], t12: [T(12), AY - 0.3],
        alone: [T(4), AY + 0.5], amb: [T(10), AY + 0.5],
      },
    };
  })(),

  // Act III: one picture per interview question
  q1: (() => {
    // The same chain, split between people: each one owns a station
    const X = [-3.6, -1.2, 1.2, 3.6];
    const Y = 1.75;
    const COL = [C.teal, C.purple, C.coral, C.white];
    return {
      fill: 0.7,
      tint: C.teal,
      layers: [
        L(S.path([[X[0], Y], [X[3], Y]], 0.02), 0.04, C.white, { alpha: 0.35, size: 0.7, soft: 0.3 }),
        ...X.map((x, i) => L([S.disc(x, Y, 0.09), S.ring(x, Y, 0.26, 0.26, 0.022, i === 3 ? [0.05, 0.07] : null)], 0.04, COL[i], { size: 0.9, soft: 0.3, ...(i === 3 ? { alpha: 0.6 } : {}) })),
        ...X.slice(0, 3).map((x, i) => L(S.path([[x, Y - 0.34], [x, 0.05]], 0.018, [0.06, 0.08]), 0.02, COL[i], { alpha: 0.8, size: 0.7, soft: 0.3 })),
        L3(person('walk', X[0], 2.3, C.teal, { yaw: 0.4 }), 0.19, {}),
        L3(person('phone', X[1], 2.3, C.purple, { yaw: 0 }), 0.19, {}),
        L3(person('reach', X[2], 2.3, C.coral, { yaw: -0.5 }), 0.19, {}),
        L(S.path([[X[3], Y - 0.34], [X[3], -1.2]], 0.015, [0.05, 0.1]), 0.012, C.white, { alpha: 0.45, size: 0.6, soft: 0.3 }),
        L(S.ambulance(X[3] + 0.2, -1.95, 1.5), 0.07, C.white, { ...CONCEPT, alpha: 0.55, drift: 0.05, soft: 0.6 }),
        ground(),
      ],
      anchors: Object.fromEntries(X.map((x, i) => [`p${i}`, [x, Y + 0.42]])),
    };
  })(),
  q2: {
    fill: 0.66,
    tint: C.purple,
    layers: [
      L(S.ring(0.4, -2.35, 2.3, 2.3, 0.03), 0.06, C.amber, { alpha: 0.7, tilt: { angle: 1.35, pivot: [0.4, -2.35] }, size: 0.8 }),
      L3(bakedModel('cpr', -0.1, 2.0, C.white, { yaw: Math.PI / 2 }), 0.26, {}),
      L3(person('supine', 1.1, 1.9, WARM_WHITE, { who: 'xbot' }), 0.12, { alpha: 0.8 }),
      L3(person('stand', -5.2, 1.9, C.white, { yaw: 0.8 }), 0.08, { ...CONCEPT, alpha: 0.35 }),
      L3(person('stand', 5.2, 1.9, C.white, { yaw: -0.8, who: 'xbot' }), 0.08, { ...CONCEPT, alpha: 0.35 }),
      ground(0.14),
    ],
    anchors: { alone: [0.4, 0.9] },
  },
  q3: {
    fill: 0.66,
    tint: C.coral,
    layers: [
      L(S.path([[-6.4, -2.45], [-6.4, 1.3], [-1.6, 1.3], [-1.6, -2.45]], 0.03), 0.06, C.white, { alpha: 0.55, size: 0.7, soft: 0.3 }),
      L3(bakedModel('cpr', -4.0, 1.6, C.white, { yaw: Math.PI / 2 }), 0.14, { alpha: 0.8 }),
      L3(carModel(2.6, 4.0, LIGHT_BLUE, { streaks: 0 }), 0.22, { alpha: 0.9, drift: 0.2 }),
      L3(person('frozen', 0.3, 2.1, C.white, { yaw: 0.5 }), 0.1, { drift: 0.2 }),
      L3(person('reach', 5.2, 2.1, C.white, { yaw: -0.9, who: 'xbot' }), 0.1, { drift: 0.2 }),
      ground(0.18),
    ],
    anchors: { room: [-4.0, 1.75], road: [2.6, 1.3] },
  },
  q4: {
    fill: 0.6,
    tint: C.amber,
    layers: [
      L3((n, rand) => {
        // Calm on the left, chaos on the right: spread and density grow with x
        const out = [];
        for (let k = 0; k < n; k++) {
          const t = Math.pow(rand(), 0.6);
          const x = -6 + t * 12;
          const spread = 0.05 + t * t * 2.2;
          out.push({
            x, y: -0.6 + (rand() - 0.5) * spread * 2, z: (rand() - 0.5) * spread,
            b: 0.4 + 0.6 * rand(), c: t > 0.66 ? C.coral : t > 0.33 ? C.amber : C.teal,
          });
        }
        return out;
      }, 0.5, { drift: 0.15, size: 0.8 }),
      L(S.path([[-6, -2.1], [6, -2.1]], 0.02), 0.04, C.white, { alpha: 0.5, size: 0.7, soft: 0.3 }),
      ...[-4, 0, 4].map((x, i) => L(S.disc(x, -2.1, 0.12), 0.012, [C.teal, C.amber, C.coral][i], { soft: 0.6 })),
    ],
    anchors: { t0: [-4, -2.1], t1: [0, -2.1], t2: [4, -2.1], calm: [-5.6, 0.6], chaos: [5.2, 1.9] },
  },
  q5: {
    fill: 0.7,
    tint: C.purple,
    layers: [
      L3(person('reach', -2.6, 2.6, C.purple, { yaw: -1.35 }), 0.28, { group: G.people }),
      L3(person('stand', 2.9, 2.5, C.white, { yaw: 1.2, who: 'xbot' }), 0.24, {}),
      L(S.curve([-1.4, -0.3], [0.3, 0.6], [2.2, -0.2], 0.025, [0.06, 0.1]), 0.05, C.purple, { alpha: 0.8, size: 0.7, soft: 0.3 }),
      L(S.signal(-2.4, 0.9, 0.9, 3), 0.05, C.purple, { soft: 0.8 }),
      L(S.ring(2.9, 0.95, 0.35, 0.35, 0.04), 0.04, C.teal, { soft: 0.6 }),
      L(S.path([[2.72, 0.95], [2.85, 0.8], [3.1, 1.12]], 0.05), 0.02, C.teal, { soft: 0.6 }),
      ground(),
    ],
    anchors: { you: [2.9, 1.6], point: [-2.4, 2.15] },
  },
  q6: {
    fill: 0.62,
    tint: C.teal,
    layers: [
      // The scene seen from above, inside a replay ring
      L(S.ring(0, -1.3, 3.4, 3.4, 0.03), 0.08, C.teal, { alpha: 0.8, tilt: { angle: 1.25, pivot: [0, -1.3] }, size: 0.8 }),
      L3(carModel(-1.3, 2.0, LIGHT_BLUE, { y: -1.45, streaks: 0 }), 0.1, { alpha: 0.7 }),
      L3(person('stand', 0.9, 1.2, C.teal, { y: -1.55, yaw: 0.4 }), 0.05, {}),
      L3(person('phone', 1.8, 1.2, C.purple, { y: -1.7, yaw: -0.4 }), 0.05, {}),
      L3(person('reach', 0.2, 1.2, C.coral, { y: -1.9, yaw: 1.0 }), 0.05, {}),
      // Timeline of key moments above
      L(S.path([[-4.5, 1.7], [4.5, 1.7]], 0.025), 0.05, C.white, { alpha: 0.6, size: 0.7, soft: 0.3 }),
      ...[-3, 0, 3].map((x, i) => L(S.disc(x, 1.7, 0.13), 0.015, [C.purple, C.teal, C.coral][i], { soft: 0.6 })),
    ],
    anchors: { m0: [-3, 1.7], m1: [0, 1.7], m2: [3, 1.7] },
  },

  // Act III: quotes clustering into the five coded categories
  analysis: {
    fill: 0.62,
    tint: C.purple,
    layers: [
      ...[-4.2, -2.1, 0, 2.1, 4.2].map((x, i) => L3(sphere(x, -0.2, 0.62 + (i % 2) * 0.12, [C.purple, C.coral, C.amber, C.white, C.teal][i], C.white), 0.14, { group: G.cat(i), size: 0.9 })),
      L3((n, rand) => Array.from({ length: n }, () => {
        const i = Math.floor(rand() * 5);
        const cx = -4.2 + i * 2.1;
        const a = rand() * Math.PI * 2;
        const r = 0.9 + Math.pow(rand(), 0.5) * 1.1;
        return { x: cx + Math.cos(a) * r * 0.6, y: -0.2 + Math.sin(a) * r, z: (rand() - 0.5) * 0.6, b: 0.25, c: C.white };
      }), 0.2, { size: 0.6, drift: 0.2, alpha: 0.6 }),
    ],
    anchors: Object.fromEntries([-4.2, -2.1, 0, 2.1, 4.2].map((x, i) => [`c${i}`, [x, -1.4]])),
  },

  // Act IV: findings flowing into design decisions
  mapping: {
    fill: 0.6,
    tint: C.amber,
    layers: (() => {
      const layers = [];
      const cols = [C.teal, C.purple, C.coral, C.amber, C.amber, C.white];
      for (let i = 0; i < 6; i++) {
        const y0 = 2.1 - i * 0.84;
        const y1 = 2.1 - i * 0.84;
        layers.push(L(S.disc(-4.8, y0, 0.14), 0.02, C.white, { alpha: 0.9, soft: 0.5, group: G.map(i) }));
        layers.push(L(S.curve([-4.6, y0], [0, y0 + (i % 2 ? -0.5 : 0.5)], [4.6, y1], 0.02), 0.08, cols[i], { alpha: 0.75, size: 0.7, soft: 0.3, group: G.map(i), drift: 0.05 }));
        layers.push(L3(sphere(4.9, y1, 0.3, cols[i], cols[i]), 0.035, { group: G.map(i), size: 0.9, alpha: i === 5 ? 0.45 : 1 }));
      }
      return layers;
    })(),
  },

  // Act IV: three tiers, one to three casualties, less guidance each time
  tiers: {
    fill: 0.62,
    tint: C.coral,
    layers: [
      L3(person('supine', -4.4, 1.6, C.teal, { who: 'xbot' }), 0.12, { group: G.tier(0) }),
      L3((n, r) => [
        ...person('supine', -0.9, 1.5, C.amber, { who: 'xbot' })(Math.floor(n / 2), r),
        ...person('dazed', 1.1, 1.7, C.amber, { yaw: -0.4 })(Math.floor(n / 2), r),
      ], 0.18, { ...CONCEPT, group: G.tier(1) }),
      L3((n, r) => [
        ...person('supine', 3.3, 1.4, C.coral, { who: 'xbot' })(Math.floor(n / 3), r),
        ...person('dazed', 4.9, 1.6, C.coral, { yaw: -0.5 })(Math.floor(n / 3), r),
        ...person('supine', 4.3, 1.4, C.coral, { y: -1.5 })(Math.floor(n / 3), r),
      ], 0.24, { ...CONCEPT, drift: 0.4, group: G.tier(2) }),
      L(S.path([[-2.25, -2.6], [-2.25, 1.6]], 0.015, [0.06, 0.1]), 0.02, C.white, { alpha: 0.3, soft: 0.3 }),
      L(S.path([[2.25, -2.6], [2.25, 1.6]], 0.015, [0.06, 0.1]), 0.02, C.white, { alpha: 0.3, soft: 0.3 }),
      ground(0.16),
    ],
    anchors: { t0: [-4.4, 1.3], t1: [0.1, 1.3], t2: [4.3, 1.3] },
  },

  // Three roles around one scene, each with its own partial view
  roles: {
    fill: 0.86,
    tint: C.teal,
    glow: [
      { at: [-5, -1.2], color: [0.4, 1, 0.9], size: 3, strength: 0.22 },
      { at: [5, -1.2], color: [0.75, 0.65, 1], size: 3, strength: 0.22 },
      { at: [2.4, -1.5], color: [1, 0.6, 0.45], size: 3, strength: 0.22 },
    ],
    layers: [
      L3(carModel(-1.4, 3.2, LIGHT_BLUE, { streaks: 0 }), 0.1, { alpha: 0.6 }),
      L3(person('supine', 1.35, 2.1, WARM_WHITE, { who: 'xbot' }), 0.07, { alpha: 0.85 }),
      L3(person('stand', -5, 2.7, C.teal, { yaw: 0.45 }), 0.14, { group: G.scene }),
      L([S.warningTriangle(-5, 0.85, 0.7)], 0.05, C.teal, { group: G.scene, soft: 1.4 }),
      L3(person('phone', 5, 2.7, C.purple, { yaw: -0.45 }), 0.14, { group: G.people }),
      L([S.phone(5, 1.5, 0.8), S.signal(5, 1.5, 0.85)], 0.05, C.purple, { group: G.people, soft: 1.4 }),
      L3(bakedModel('cpr', 3.0, 1.9, C.coral, { yaw: -Math.PI / 2 }), 0.15, { group: G.medical }),
      L([S.heart(2.6, 1.0, 0.5), S.pulseLine(1.6, 3.6, 0.3, 0.3)], 0.05, C.coral, { group: G.medical, soft: 1.4 }),
      ground(),
    ],
    anchors: { scene: [-5, 1.9], people: [5.3, 2.75], medical: [2.4, 1.85] },
  },

  // Four phases of one run. Phases 3 and 4 are concept only (dim & drifting).
  phase1: {
    fill: 0.82,
    tint: C.teal,
    glow: [{ at: [-3.4, -1.2], color: [0.4, 1, 0.9], size: 3.5, strength: 0.25 }],
    layers: [
      L3(carModel(1.2, 4.2, LIGHT_BLUE, { streaks: 0 }), 0.2, { alpha: 0.65 }),
      L3(person('walk', -3.4, 2.8, C.teal, { yaw: -1.35 }), 0.28, { group: G.scene }),
      L(S.warningTriangle(-6.1, -2.45, 0.75), 0.07, C.teal, { group: G.scene, soft: 1.4 }),
      L(S.path([[-4.1, -2.35], [-5.5, -2.35]], 0.03, [0.08, 0.12]), 0.03, C.teal, { alpha: 0.6, size: 0.7, soft: 0.4 }),
      L3(person('dazed', 4.3, 1.9, WARM_WHITE, { yaw: -0.5 }), 0.1, { alpha: 0.7 }),
      ground(),
    ],
  },
  phase2: {
    fill: 0.82,
    tint: C.purple,
    glow: [{ at: [-3.4, -1.0], color: [0.75, 0.65, 1], size: 4, strength: 0.3 }],
    layers: [
      L3(carModel(1.2, 4.2, LIGHT_BLUE, { streaks: 0 }), 0.16, { alpha: 0.5 }),
      L3(person('phone', -3.4, 2.9, C.purple, { yaw: 0.3 }), 0.3, { group: G.people }),
      L(S.signal(-3.1, 0.9, 1.5, 4), 0.1, C.purple, { group: G.people, soft: 1.2, tilt: { angle: 0.5, pivot: [-3.1, 0.9] } }),
      L(S.warningTriangle(-6.1, -2.45, 0.75), 0.04, C.teal, { alpha: 0.6 }),
      L3(person('dazed', 4.3, 1.9, WARM_WHITE, { yaw: -0.5 }), 0.1, { alpha: 0.7 }),
      ground(),
    ],
  },
  phase3: {
    fill: 0.62,
    tint: C.coral,
    layers: [
      L3(person('reclined', 1.6, 3.2, C.coral), 0.32, { ...CONCEPT, group: G.medical }),
      L3(bakedModel('cpr', -1.7, 2.3, C.coral, { yaw: Math.PI / 2 }), 0.24, { ...CONCEPT, group: G.medical }),
      L(S.curve([0.2, -0.9], [1.0, -1.0], [1.9, -1.9], 0.03, [0.06, 0.1]), 0.04, C.amber, { ...CONCEPT, alpha: 0.55, soft: 0.5 }),
      L(S.text('30°', 0.4, -0.2, 0.55), 0.03, C.amber, { ...CONCEPT, alpha: 0.55 }),
      ground(0.14),
    ],
  },
  phase4: {
    fill: 0.62,
    tint: [0.6, 0.7, 1],
    layers: [
      L3(bakedModel('ambulance', 3.1, 5.0, C.white, { yaw: Math.PI }), 0.36, { ...CONCEPT, alpha: 0.55 }),
      L3(person('reach', -0.9, 2.6, C.coral, { yaw: -1.2 }), 0.14, { ...CONCEPT }),
      L3(person('stand', -2.4, 2.6, C.white, { yaw: 1.1 }), 0.14, { ...CONCEPT }),
      L3(person('dazed', -4.6, 1.8, WARM_WHITE, { yaw: 0.6 }), 0.07, { ...CONCEPT }),
      ground(0.14),
    ],
  },

  // Built (dense, teal) versus concept (sparse, white)
  built: {
    fill: 0.76,
    tint: C.teal,
    glow: [{ at: [-3.6, -0.8], color: [0.4, 1, 0.9], size: 4.5, strength: 0.22 }],
    layers: [
      L3(carModel(-3.8, 3.4, C.teal, { streaks: 0.15 }), 0.2, { group: G.built }),
      L3(person('stand', -2.1, 2.6, C.teal, { yaw: -0.6 }), 0.14, { group: G.built }),
      L3((n, r) => [
        ...person('stand', 2.4, 2.4, C.white, { yaw: 0.6, who: 'xbot' })(Math.floor(n / 3), r),
        ...person('phone', 3.9, 2.6, C.white, { yaw: 0 })(Math.floor(n / 3), r),
        ...person('reach', 5.4, 2.4, C.white, { yaw: -0.8, who: 'xbot' })(Math.floor(n / 3), r),
      ], 0.26, { ...CONCEPT, alpha: 0.4, group: G.concept }),
      L(S.path([[0, -2.6], [0, 2.6]], 0.02, [0.1, 0.18]), 0.03, C.white, { alpha: 0.3, size: 0.6, soft: 0.4 }),
    ],
    anchors: { built: [-3.2, 1.6], concept: [3.9, 1.3] },
  },

  // A timeline: five solid steps done, two dashed steps still owed
  status: {
    fill: 0.5,
    tint: C.teal,
    layers: (() => {
      const X = [-6, -4, -2, 0, 2, 4, 6];
      const Y = -0.2;
      const layers = [
        L(S.path([[X[0], Y], [X[4], Y]], 0.03), 0.1, C.teal, { size: 0.8, soft: 0.4, alpha: 0.9 }),
        L(S.path([[X[4], Y], [X[6], Y]], 0.025, [0.08, 0.16]), 0.04, C.white, { ...CONCEPT, alpha: 0.4, drift: 0.05, soft: 0.3 }),
        // Group brackets above the line
        L(S.path([[X[0], 0.75], [X[0], 0.95], [X[4], 0.95], [X[4], 0.75]], 0.015), 0.035, C.teal, { alpha: 0.55, size: 0.6, soft: 0.3 }),
        L(S.path([[X[5], 0.75], [X[5], 0.95], [X[6], 0.95], [X[6], 0.75]], 0.015, [0.06, 0.1]), 0.02, C.white, { alpha: 0.35, size: 0.6, soft: 0.3, drift: 0.05 }),
      ];
      X.forEach((x, i) => {
        const done = i < 5;
        const current = i === 4;
        const shapes = done
          ? [S.disc(x, Y, 0.13), S.ring(x, Y, current ? 0.38 : 0.28, current ? 0.38 : 0.28, 0.02)]
          : [S.ring(x, Y, 0.22, 0.22, 0.025, [0.05, 0.07])];
        layers.push(L(shapes, done ? 0.06 : 0.03, done ? C.teal : C.white,
          done ? { group: G.milestone(i), size: 0.9, soft: 0.2 } : { ...CONCEPT, alpha: 0.5, drift: 0.05, group: G.milestone(i), soft: 0.5 }));
      });
      return layers;
    })(),
    anchors: {
      ...Object.fromEntries([-6, -4, -2, 0, 2, 4, 6].map((x, i) => [`m${i}`, [x, -0.2]])),
      done: [-2, 0.95], owed: [5, 0.95],
    },
  },

  // Still and resolved: a quiet, rim-lit portrait
  reflect: {
    fill: 0.8,
    still: true,
    tint: C.amber,
    layers: [
      L3(portrait(0, 0.4, 5.2), 0.9, { drift: 0 }),
    ],
  },
};

// ── Sampling: draw each layer and pick points from its lit pixels ─────────

const canvas = document.createElement('canvas');
canvas.width = S.W;
canvas.height = S.H;
const ctx = canvas.getContext('2d', { willReadFrequently: true });

function sampleLayer(layer) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = 'none';
  ctx.clearRect(0, 0, S.W, S.H);
  ctx.setTransform(1, 0, 0, 1, S.W / 2, S.H / 2);
  ctx.filter = layer.soft > 0 ? `blur(${layer.soft}px)` : 'none';
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  for (const draw of layer.shapes) draw(ctx);
  ctx.filter = 'none';
  const data = ctx.getImageData(0, 0, S.W, S.H).data;
  const alpha = new Float32Array(S.W * S.H);
  const idx = [];
  for (let i = 3, p = 0; i < data.length; i += 4, p++) {
    const a = data[i] / 255;
    alpha[p] = a;
    if (a > 0.1) idx.push(p);
  }
  return { idx, alpha };
}

// Light from the upper left, towards the viewer
const LX = -0.55;
const LY = 0.55;
const LZ = 0.63;

// How lit a pixel is: treat the blurred mask as a height field, so edges face
// sideways (rim light) and the interior faces the camera.
function shadeAt(alpha, p, soft) {
  const x = p % S.W;
  const y = (p - x) / S.W;
  const at = (dx, dy) => alpha[Math.min(S.H - 1, Math.max(0, y + dy)) * S.W + Math.min(S.W - 1, Math.max(0, x + dx))];
  const gx = (at(2, 0) - at(-2, 0)) * (soft + 1);
  const gy = (at(0, -2) - at(0, 2)) * (soft + 1); // canvas y is down, world y is up
  const len = Math.hypot(gx, gy, 1);
  const nx = -gx / len;
  const ny = -gy / len;
  const nz = 1 / len;
  const diffuse = Math.max(0, nx * LX + ny * LY + nz * LZ);
  const rim = Math.pow(1 - nz, 1.4);
  return Math.min(1, 0.12 + diffuse * 0.5 + rim * 0.75);
}

// Build flat arrays for one formation with exactly n points
export function buildFormation(def, n, rand = Math.random) {
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const aux = new Float32Array(n * 4); // alpha, size, group, drift

  const totalWeight = def.layers.reduce((s, l) => s + l.weight, 0) || 1;
  const formed = Math.floor(n * def.fill);
  let i = 0;

  for (const layer of def.layers) {
    const count = Math.round((layer.weight / totalWeight) * formed);

    // True 3D layers generate their own points
    if (layer.gen) {
      for (const q of layer.gen(count, rand)) {
        if (i >= formed) break;
        pos[i * 3] = q.x;
        pos[i * 3 + 1] = q.y;
        pos[i * 3 + 2] = q.z;
        col.set(q.c, i * 3);
        aux[i * 4] = layer.alpha * q.b;
        aux[i * 4 + 1] = layer.size * (0.6 + rand() * 0.8);
        aux[i * 4 + 2] = layer.group;
        aux[i * 4 + 3] = layer.drift;
        i++;
      }
      continue;
    }

    const { idx, alpha } = sampleLayer(layer);
    if (!idx.length) continue;
    const rim = layer.shade === 'rim';
    const cosT = layer.tilt ? Math.cos(layer.tilt.angle) : 1;
    const sinT = layer.tilt ? Math.sin(layer.tilt.angle) : 0;

    for (let k = 0, tries = 0; k < count && i < formed && tries < count * 40; tries++) {
      const j = Math.floor(rand() * idx.length);
      const a = alpha[idx[j]];
      // Stippling: lit pixels get more points, so brightness comes from density
      const light = rim ? shadeAt(alpha, idx[j], layer.soft) : a;
      if (rand() > (rim ? light * Math.min(1, a * 2) : a * a + 0.05)) continue;
      const px = idx[j] % S.W;
      const py = Math.floor(idx[j] / S.W);
      const x = (px + rand() - 0.5 - S.W / 2) / S.PX;
      let y = -(py + rand() - 0.5 - S.H / 2) / S.PX;
      // Volume: thick parts bulge in depth, giving rounded 3D bodies
      let z = (rand() * 2 - 1) * layer.volume * Math.sqrt(a);
      if (layer.tilt) {
        const [cx, cy] = layer.tilt.pivot;
        const dy = y - cy;
        y = cy + dy * cosT;
        z += dy * sinT;
      }
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      col.set(layer.color, i * 3);
      aux[i * 4] = layer.alpha * (rim ? 0.35 + light * 0.65 : 0.55 + a * 0.45) * (0.8 + rand() * 0.2);
      aux[i * 4 + 1] = layer.size * (0.6 + rand() * 0.8) * (rand() < 0.02 ? 1.8 : 1); // a few bright specks
      aux[i * 4 + 2] = layer.group;
      aux[i * 4 + 3] = layer.drift;
      k++;
      i++;
    }
  }

  // Remaining points: dust drifting through the whole field, in depth
  for (; i < n; i++) {
    pos[i * 3] = (rand() - 0.5) * 26;
    pos[i * 3 + 1] = (rand() - 0.5) * 16;
    pos[i * 3 + 2] = -7 + rand() * 11;
    col.set(C.white, i * 3);
    aux[i * 4] = 0.02 + rand() * 0.06;
    aux[i * 4 + 1] = 0.3 + rand() * 0.5;
    aux[i * 4 + 2] = 0;
    aux[i * 4 + 3] = 1;
  }

  return {
    pos, col, aux,
    anchors: def.anchors || {},
    still: !!def.still,
    tint: def.tint || C.white,
    glow: def.glow || [],
  };
}
