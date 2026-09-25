// Drawing primitives for particle formations.
// Everything is drawn in white on an offscreen canvas and then sampled into points,
// so a "shape" here is just a function (ctx) => void in canvas pixels.
// Canvas is W x H with the origin in the centre; 1 world unit = PX pixels.

export const W = 800;
export const H = 550;
export const PX = 55;

const u = (v) => v * PX; // world units -> canvas px

// ── People ────────────────────────────────────────────────────────────────

// A tapered limb: two circles joined by their outer tangents (a "capsule" that
// narrows), which gives organic, rounded bodies once sampled.
function limb(ctx, x1, y1, r1, x2, y2, r2) {
  const X1 = u(x1), Y1 = -u(y1), X2 = u(x2), Y2 = -u(y2), R1 = u(r1), R2 = u(r2);
  const dx = X2 - X1;
  const dy = Y2 - Y1;
  const d = Math.hypot(dx, dy) || 1e-6;
  const a = Math.atan2(dy, dx);
  const t = Math.acos(Math.max(-1, Math.min(1, (R1 - R2) / d)));
  ctx.beginPath();
  ctx.arc(X1, Y1, R1, a + t, a - t + Math.PI * 2);
  ctx.arc(X2, Y2, R2, a - t, a + t);
  ctx.closePath();
  ctx.fill();
}

// Joint positions per pose, in units of body height, feet at y = 0
const POSES = {
  stand: {
    head: [0, 0.925], neck: [0, 0.84], chest: [0, 0.735], pelvis: [0, 0.52],
    sL: [-0.1, 0.8], eL: [-0.16, 0.63], hL: [-0.21, 0.47],
    sR: [0.1, 0.8], eR: [0.16, 0.63], hR: [0.21, 0.47],
    pL: [-0.05, 0.5], kL: [-0.06, 0.27], fL: [-0.07, 0.02],
    pR: [0.05, 0.5], kR: [0.06, 0.27], fR: [0.07, 0.02],
  },
  walk: {
    head: [0.02, 0.92], neck: [0.015, 0.835], chest: [0.01, 0.73], pelvis: [0, 0.515],
    sL: [-0.09, 0.8], eL: [-0.02, 0.63], hL: [0.06, 0.5],
    sR: [0.1, 0.8], eR: [0.08, 0.63], hR: [-0.02, 0.49],
    pL: [-0.04, 0.5], kL: [0.06, 0.29], fL: [0.13, 0.03],
    pR: [0.04, 0.5], kR: [-0.03, 0.27], fR: [-0.15, 0.04],
  },
  frozen: {
    head: [-0.01, 0.925], neck: [-0.01, 0.84], chest: [0, 0.735], pelvis: [0, 0.52],
    sL: [-0.1, 0.8], eL: [-0.18, 0.66], hL: [-0.22, 0.54],
    sR: [0.1, 0.8], eR: [0.19, 0.68], hR: [0.25, 0.6],
    pL: [-0.05, 0.5], kL: [-0.07, 0.27], fL: [-0.09, 0.02],
    pR: [0.05, 0.5], kR: [0.12, 0.32], fR: [0.13, 0.11],
  },
  phone: {
    head: [0.01, 0.925], neck: [0, 0.84], chest: [0, 0.735], pelvis: [0, 0.52],
    sL: [-0.1, 0.8], eL: [-0.15, 0.63], hL: [-0.17, 0.47],
    sR: [0.1, 0.8], eR: [0.15, 0.7], hR: [0.06, 0.88],
    pL: [-0.05, 0.5], kL: [-0.06, 0.27], fL: [-0.07, 0.02],
    pR: [0.05, 0.5], kR: [0.06, 0.27], fR: [0.08, 0.02],
  },
  reach: {
    head: [0.05, 0.9], neck: [0.04, 0.82], chest: [0.025, 0.72], pelvis: [0, 0.51],
    sL: [-0.07, 0.78], eL: [-0.12, 0.62], hL: [-0.13, 0.46],
    sR: [0.12, 0.78], eR: [0.26, 0.7], hR: [0.39, 0.62],
    pL: [-0.05, 0.5], kL: [-0.09, 0.27], fL: [-0.12, 0.02],
    pR: [0.05, 0.5], kR: [0.1, 0.27], fR: [0.12, 0.02],
  },
  // Sitting on the kerb, one hand pressed to the head: dazed
  dazed: {
    head: [0.05, 0.7], neck: [0.02, 0.62], chest: [-0.01, 0.51], pelvis: [-0.04, 0.28],
    sL: [-0.08, 0.57], eL: [0.03, 0.44], hL: [0.15, 0.42],
    sR: [0.07, 0.58], eR: [0.17, 0.63], hR: [0.09, 0.72],
    pL: [-0.07, 0.27], kL: [0.19, 0.42], fL: [0.24, 0.02],
    pR: [0.0, 0.27], kR: [0.25, 0.4], fR: [0.3, 0.02],
  },
  seated: {
    head: [0.03, 0.71], neck: [0.01, 0.63], chest: [-0.01, 0.52], pelvis: [-0.03, 0.28],
    sL: [-0.08, 0.58], eL: [0.02, 0.44], hL: [0.14, 0.42],
    sR: [0.07, 0.58], eR: [0.12, 0.43], hR: [0.2, 0.41],
    pL: [-0.06, 0.27], kL: [0.19, 0.42], fL: [0.23, 0.02],
    pR: [0.0, 0.27], kR: [0.24, 0.4], fR: [0.29, 0.02],
  },
};

function body(ctx, J, x, y, s, f) {
  const P = (k) => [x + J[k][0] * s * f, y + J[k][1] * s];
  const L = (a, ra, b, rb) => limb(ctx, ...P(a), ra * s, ...P(b), rb * s);
  // Legs behind, then torso, arms and head
  L('pL', 0.06, 'kL', 0.045); L('kL', 0.045, 'fL', 0.03);
  L('pR', 0.06, 'kR', 0.045); L('kR', 0.045, 'fR', 0.03);
  L('pelvis', 0.085, 'chest', 0.1);
  L('chest', 0.1, 'sL', 0.045); L('chest', 0.1, 'sR', 0.045);
  L('neck', 0.035, 'chest', 0.05);
  L('sL', 0.04, 'eL', 0.033); L('eL', 0.033, 'hL', 0.026);
  L('sR', 0.04, 'eR', 0.033); L('eR', 0.033, 'hR', 0.026);
  const [hx, hy] = P('head');
  ctx.beginPath();
  ctx.ellipse(u(hx), -u(hy), u(0.062 * s), u(0.075 * s), 0, 0, Math.PI * 2);
  ctx.fill();
}

// A human figure. (x, y) = feet on the ground, h = height in world units.
// pose: 'stand' | 'walk' | 'seated' | 'phone' | 'reach' | 'frozen'
export function figure(x, y, h, pose = 'stand', flip = 1) {
  return (ctx) => body(ctx, POSES[pose] || POSES.stand, x, y, h, flip);
}

// Patient lying with the upper body raised (the positioning insight)
export function reclined(x, y, len) {
  return (ctx) => {
    const s = len;
    const P = (a, b) => [x + a * s, y + b * s];
    const L = (a, ra, b, rb) => limb(ctx, ...P(...a), ra * s, ...P(...b), rb * s);
    // Support wedge under the back
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(u(x - 0.56 * s), -u(y));
    ctx.lineTo(u(x + 0.02 * s), -u(y));
    ctx.lineTo(u(x - 0.56 * s), -u(y + 0.3 * s));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    L([0.02, 0.07], 0.07, [-0.34, 0.3], 0.085);      // torso, raised
    L([-0.34, 0.3], 0.03, [-0.42, 0.35], 0.03);      // neck
    L([0.02, 0.07], 0.06, [0.24, 0.16], 0.045);      // thigh (knees bent)
    L([0.24, 0.16], 0.045, [0.46, 0.04], 0.03);      // shin
    L([-0.28, 0.27], 0.035, [-0.12, 0.13], 0.028);   // arm resting on the body
    ctx.beginPath();
    ctx.ellipse(u(x - 0.49 * s), -u(y + 0.41 * s), u(0.06 * s), u(0.07 * s), -0.6, 0, Math.PI * 2);
    ctx.fill();
  };
}

// ── Objects ───────────────────────────────────────────────────────────────

// Side view car outline. (x, y) = centre of the ground contact
export function car(x, y, len, filled = false) {
  return (ctx) => {
    const s = len;
    ctx.lineJoin = 'round';
    ctx.lineWidth = u(0.035 * s);
    const P = (a, b) => [u(x + a * s), -u(y + b * s)];
    ctx.beginPath();
    ctx.moveTo(...P(-0.5, 0.1));
    ctx.lineTo(...P(-0.5, 0.2));
    ctx.quadraticCurveTo(...P(-0.49, 0.26), ...P(-0.36, 0.27));
    ctx.lineTo(...P(-0.22, 0.43));
    ctx.lineTo(...P(0.14, 0.43));
    ctx.lineTo(...P(0.3, 0.27));
    ctx.quadraticCurveTo(...P(0.49, 0.25), ...P(0.5, 0.16));
    ctx.lineTo(...P(0.5, 0.1));
    ctx.closePath();
    if (filled) ctx.fill(); else ctx.stroke();
    // Windows
    ctx.lineWidth = u(0.02 * s);
    ctx.beginPath();
    ctx.moveTo(...P(-0.19, 0.39));
    ctx.lineTo(...P(-0.08, 0.39));
    ctx.lineTo(...P(-0.08, 0.29));
    ctx.lineTo(...P(-0.3, 0.29));
    ctx.closePath();
    ctx.moveTo(...P(-0.03, 0.39));
    ctx.lineTo(...P(0.12, 0.39));
    ctx.lineTo(...P(0.22, 0.29));
    ctx.lineTo(...P(-0.03, 0.29));
    ctx.closePath();
    ctx.stroke();
    // Wheels
    for (const wx of [-0.3, 0.3]) {
      ctx.lineWidth = u(0.03 * s);
      ctx.beginPath();
      ctx.arc(u(x + wx * s), -u(y + 0.1 * s), u(0.09 * s), 0, Math.PI * 2);
      ctx.stroke();
    }
  };
}

// Car drawn as streaming light: the body contour repeated at several heights,
// with streaks trailing off the back (reads as speed, like a wind-tunnel render)
export function carStreams(x, y, len) {
  return (ctx) => {
    const s = len;
    const P = (a, b) => [u(x + a * s), -u(y + b * s)];
    ctx.lineCap = 'round';
    // Main silhouette, bright
    ctx.lineWidth = u(0.012 * s);
    const profile = (k) => {
      ctx.beginPath();
      ctx.moveTo(...P(-0.5, 0.16 + (1 - k) * 0.02));
      ctx.quadraticCurveTo(...P(-0.46, 0.27 * k + 0.1 * (1 - k)), ...P(-0.3, 0.3 * k + 0.12 * (1 - k)));
      ctx.quadraticCurveTo(...P(-0.14, 0.46 * k + 0.13 * (1 - k)), ...P(0.08, 0.44 * k + 0.13 * (1 - k)));
      ctx.quadraticCurveTo(...P(0.24, 0.4 * k + 0.12 * (1 - k)), ...P(0.34, 0.28 * k + 0.11 * (1 - k)));
      ctx.quadraticCurveTo(...P(0.49, 0.25 * k + 0.1 * (1 - k)), ...P(0.51, 0.14));
      ctx.stroke();
    };
    for (let i = 0; i <= 6; i++) {
      ctx.globalAlpha = i === 6 ? 1 : 0.35 + i * 0.08;
      profile(0.35 + i * 0.108);
    }
    // Windows
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(...P(-0.2, 0.3));
    ctx.quadraticCurveTo(...P(-0.08, 0.41), ...P(0.07, 0.4));
    ctx.quadraticCurveTo(...P(0.18, 0.37), ...P(0.24, 0.3));
    ctx.closePath();
    ctx.stroke();
    // Wheels as bright rims
    for (const wx of [-0.3, 0.32]) {
      ctx.globalAlpha = 1;
      ctx.lineWidth = u(0.016 * s);
      ctx.beginPath();
      ctx.arc(u(x + wx * s), -u(y + 0.1 * s), u(0.095 * s), Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.arc(u(x + wx * s), -u(y + 0.1 * s), u(0.06 * s), 0, Math.PI * 2);
      ctx.stroke();
    }
    // Streaks trailing off the back
    for (let i = 0; i < 6; i++) {
      const hy = 0.15 + i * 0.045;
      const grad = ctx.createLinearGradient(...P(-0.5, hy), ...P(-1.1, hy));
      grad.addColorStop(0, 'rgba(255,255,255,0.45)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = grad;
      ctx.globalAlpha = 1;
      ctx.lineWidth = u(0.008 * s);
      ctx.beginPath();
      ctx.moveTo(...P(-0.48, hy));
      ctx.quadraticCurveTo(...P(-0.75, hy + 0.02 * Math.sin(i)), ...P(-1.1 + (i % 3) * 0.08, hy - 0.01));
      ctx.stroke();
    }
    ctx.strokeStyle = '#fff';
    ctx.globalAlpha = 1;
  };
}

export function ambulance(x, y, len) {
  return (ctx) => {
    const s = len;
    const P = (a, b) => [u(x + a * s), -u(y + b * s)];
    ctx.lineWidth = u(0.03 * s);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(...P(-0.5, 0.1));
    ctx.lineTo(...P(-0.5, 0.62));
    ctx.lineTo(...P(0.2, 0.62));
    ctx.lineTo(...P(0.2, 0.44));
    ctx.lineTo(...P(0.38, 0.44));
    ctx.lineTo(...P(0.5, 0.28));
    ctx.lineTo(...P(0.5, 0.1));
    ctx.closePath();
    ctx.stroke();
    // Cross
    ctx.lineWidth = u(0.05 * s);
    ctx.beginPath();
    ctx.moveTo(...P(-0.15, 0.3)); ctx.lineTo(...P(-0.15, 0.5));
    ctx.moveTo(...P(-0.25, 0.4)); ctx.lineTo(...P(-0.05, 0.4));
    ctx.stroke();
    // Light bar
    ctx.fillRect(...P(-0.05, 0.69), u(0.18 * s), u(0.05 * s));
    for (const wx of [-0.3, 0.32]) {
      ctx.lineWidth = u(0.03 * s);
      ctx.beginPath();
      ctx.arc(u(x + wx * s), -u(y + 0.1 * s), u(0.085 * s), 0, Math.PI * 2);
      ctx.stroke();
    }
  };
}

export function warningTriangle(x, y, size) {
  return (ctx) => {
    ctx.lineWidth = u(size * 0.12);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(u(x), -u(y + size));
    ctx.lineTo(u(x + size * 0.58), -u(y));
    ctx.lineTo(u(x - size * 0.58), -u(y));
    ctx.closePath();
    ctx.stroke();
  };
}

export function phone(x, y, h) {
  return (ctx) => {
    ctx.lineWidth = u(h * 0.07);
    ctx.beginPath();
    ctx.roundRect(u(x - h * 0.25), -u(y + h / 2), u(h * 0.5), u(h), u(h * 0.08));
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(u(x), -u(y - h * 0.36), u(h * 0.04), 0, Math.PI * 2);
    ctx.fill();
  };
}

// Radiating arcs (a call going out)
export function signal(x, y, r, count = 3) {
  return (ctx) => {
    ctx.lineCap = 'round';
    for (let i = 1; i <= count; i++) {
      ctx.lineWidth = u(r * 0.06);
      ctx.beginPath();
      ctx.arc(u(x), -u(y), u(r * i / count), -Math.PI * 0.8, -Math.PI * 0.2);
      ctx.stroke();
    }
  };
}

export function heart(x, y, s) {
  return (ctx) => {
    const P = (a, b) => [u(x + a * s), -u(y + b * s)];
    ctx.beginPath();
    ctx.moveTo(...P(0, -0.35));
    ctx.bezierCurveTo(...P(-0.55, 0.05), ...P(-0.3, 0.5), ...P(0, 0.25));
    ctx.bezierCurveTo(...P(0.3, 0.5), ...P(0.55, 0.05), ...P(0, -0.35));
    ctx.fill();
  };
}

// ECG trace
export function pulseLine(x1, x2, y, amp) {
  return (ctx) => {
    ctx.lineWidth = u(0.05);
    ctx.lineJoin = 'round';
    const w = x2 - x1;
    const pts = [[0, 0], [0.35, 0], [0.42, 0.2], [0.48, -0.9], [0.55, 1], [0.6, -0.3], [0.66, 0], [1, 0]];
    ctx.beginPath();
    pts.forEach(([a, b], i) => {
      const px = u(x1 + a * w);
      const py = -u(y + b * amp);
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    });
    ctx.stroke();
  };
}

export function ring(x, y, rx, ry = rx, width = 0.03, dash = null) {
  return (ctx) => {
    ctx.lineWidth = u(width);
    if (dash) ctx.setLineDash(dash.map(u));
    ctx.beginPath();
    ctx.ellipse(u(x), -u(y), u(rx), u(ry), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  };
}

export function disc(x, y, r) {
  return (ctx) => {
    ctx.beginPath();
    ctx.arc(u(x), -u(y), u(r), 0, Math.PI * 2);
    ctx.fill();
  };
}

export function path(points, width = 0.04, dash = null) {
  return (ctx) => {
    ctx.lineWidth = u(width);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (dash) ctx.setLineDash(dash.map(u));
    ctx.beginPath();
    points.forEach(([a, b], i) => (i ? ctx.lineTo(u(a), -u(b)) : ctx.moveTo(u(a), -u(b))));
    ctx.stroke();
    ctx.setLineDash([]);
  };
}

export function curve(a, c, b, width = 0.04, dash = null) {
  return (ctx) => {
    ctx.lineWidth = u(width);
    ctx.lineCap = 'round';
    if (dash) ctx.setLineDash(dash.map(u));
    ctx.beginPath();
    ctx.moveTo(u(a[0]), -u(a[1]));
    ctx.quadraticCurveTo(u(c[0]), -u(c[1]), u(b[0]), -u(b[1]));
    ctx.stroke();
    ctx.setLineDash([]);
  };
}

export function text(str, x, y, size, weight = 300) {
  return (ctx) => {
    ctx.font = `${weight} ${u(size)}px "Inter Tight", "Helvetica Neue", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, u(x), -u(y));
  };
}

// VR headset, front view
export function headset(x, y, w) {
  return (ctx) => {
    const s = w;
    ctx.lineWidth = u(0.06 * s);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.roundRect(u(x - 0.5 * s), -u(y + 0.22 * s), u(s), u(0.44 * s), u(0.16 * s));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(u(x - 0.1 * s), -u(y - 0.22 * s));
    ctx.quadraticCurveTo(u(x), -u(y - 0.08 * s), u(x + 0.1 * s), -u(y - 0.22 * s));
    ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(u(x + side * 0.23 * s), -u(y + 0.02 * s), u(0.1 * s), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(u(x - 0.5 * s), -u(y + 0.05 * s));
    ctx.quadraticCurveTo(u(x - 0.7 * s), -u(y + 0.3 * s), u(x - 0.45 * s), -u(y + 0.45 * s));
    ctx.moveTo(u(x + 0.5 * s), -u(y + 0.05 * s));
    ctx.quadraticCurveTo(u(x + 0.7 * s), -u(y + 0.3 * s), u(x + 0.45 * s), -u(y + 0.45 * s));
    ctx.stroke();
  };
}

// Head with a headset on (for the multiplayer concept)
export function headsetFigure(x, y, h) {
  return (ctx) => {
    figure(x, y, h, 'stand')(ctx);
    ctx.beginPath();
    ctx.roundRect(u(x - 0.08 * h), -u(y + 0.955 * h), u(0.16 * h), u(0.055 * h), u(0.02 * h));
    ctx.fill();
  };
}

export function notebook(x, y, w) {
  return (ctx) => {
    const h = w * 0.72;
    ctx.lineWidth = u(w * 0.035);
    ctx.beginPath();
    ctx.roundRect(u(x - w / 2), -u(y + h / 2), u(w), u(h), u(w * 0.03));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(u(x), -u(y + h / 2));
    ctx.lineTo(u(x), -u(y - h / 2));
    ctx.stroke();
    ctx.lineWidth = u(w * 0.018);
    for (let i = 0; i < 5; i++) {
      const ly = y + h * 0.3 - i * h * 0.14;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(u(x + side * w * 0.08), -u(ly));
        ctx.lineTo(u(x + side * w * (i === 4 ? 0.3 : 0.42)), -u(ly));
        ctx.stroke();
      }
    }
  };
}

export function monitor(x, y, w) {
  return (ctx) => {
    const h = w * 0.6;
    ctx.lineWidth = u(w * 0.03);
    ctx.beginPath();
    ctx.roundRect(u(x - w / 2), -u(y + h), u(w), u(h), u(w * 0.03));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(u(x), -u(y));
    ctx.lineTo(u(x), -u(y - w * 0.12));
    ctx.moveTo(u(x - w * 0.18), -u(y - w * 0.12));
    ctx.lineTo(u(x + w * 0.18), -u(y - w * 0.12));
    ctx.stroke();
    // A tiny scene on the screen: road and car
    ctx.lineWidth = u(w * 0.015);
    ctx.beginPath();
    ctx.moveTo(u(x - w * 0.42), -u(y + h * 0.25));
    ctx.lineTo(u(x + w * 0.42), -u(y + h * 0.25));
    ctx.stroke();
    car(x + w * 0.05, y + h * 0.25, w * 0.4)(ctx);
  };
}

export function keyboard(x, y, w) {
  return (ctx) => {
    ctx.lineWidth = u(w * 0.02);
    ctx.beginPath();
    ctx.roundRect(u(x - w / 2), -u(y + w * 0.08), u(w), u(w * 0.16), u(w * 0.02));
    ctx.stroke();
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 12; c++) {
        ctx.fillRect(u(x - w * 0.45 + c * w * 0.076), -u(y + w * 0.05 - r * w * 0.045), u(w * 0.05), u(w * 0.028));
      }
    }
  };
}

export function questionMark(x, y, size) {
  return text('?', x, y, size, 200);
}

export function group3(x, y, h) {
  // Three people turned away from each other: a group that doesn't coordinate
  return (ctx) => {
    figure(x - h * 0.55, y, h * 0.9, 'stand')(ctx);
    figure(x, y, h, 'stand')(ctx);
    figure(x + h * 0.55, y, h * 0.9, 'stand')(ctx);
  };
}
