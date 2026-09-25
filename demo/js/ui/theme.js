import * as THREE from 'three';

// ── Design tokens (Apple HIG dark-mode system palette) ──────────────────────

export const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Arial, sans-serif';
export const FONT_MONO = '"SF Mono", ui-monospace, Menlo, Consolas, monospace';

export const COLORS = {
  blue: '#0A84FF',
  green: '#30D158',
  red: '#FF453A',
  orange: '#FF9F0A',
  yellow: '#FFD60A',
  teal: '#64D2FF',
  label: '#FFFFFF',
  secondaryLabel: 'rgba(235, 235, 245, 0.62)',
  tertiaryLabel: 'rgba(235, 235, 245, 0.32)',
  separator: 'rgba(84, 84, 88, 0.55)',
  fill: 'rgba(118, 118, 128, 0.24)',
  fillStrong: 'rgba(118, 118, 128, 0.36)',
  material: 'rgba(28, 28, 30, 0.82)',
};

export function font(size, weight = 400, family = FONT) {
  return `${weight} ${size}px ${family}`;
}

export function rgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// ── Canvas-backed UI surfaces ───────────────────────────────────────────────

// Creates a canvas rendered at `scale`× resolution; draw in logical units.
export function createUICanvas(width, height, scale = 2) {
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.minFilter = THREE.LinearMipmapLinearFilter;

  return { canvas, ctx, texture, width, height };
}

// UI materials skip tone mapping so system colours render as specified.
export function uiMaterial(texture, extra = {}) {
  return new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    toneMapped: false,
    depthWrite: false,
    ...extra,
  });
}

// Frosted glass card: translucent fill, top sheen, hairline border, soft shadow.
export function drawGlass(ctx, x, y, w, h, r, opts = {}) {
  const { tint = null, fill = COLORS.material, shadow = true, border = 'rgba(255,255,255,0.14)' } = opts;

  ctx.save();
  if (shadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.clip();

  if (tint) {
    const tg = ctx.createRadialGradient(x + w * 0.5, y, 0, x + w * 0.5, y, Math.max(w, h) * 0.9);
    tg.addColorStop(0, rgba(tint, 0.22));
    tg.addColorStop(1, rgba(tint, 0));
    ctx.fillStyle = tg;
    ctx.fillRect(x, y, w, h);
  }

  const sheen = ctx.createLinearGradient(0, y, 0, y + Math.min(h, 120));
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.09)');
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5, r);
    ctx.stroke();
  }
}

// Filled capsule button with centred label.
export function drawPillButton(ctx, cx, cy, w, h, text, color, hovered) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.save();
  if (hovered) {
    ctx.shadowColor = rgba(color, 0.6);
    ctx.shadowBlur = 22;
  }
  ctx.fillStyle = hovered ? color : rgba(color, 0.88);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.restore();

  if (hovered) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, w - 2, h - 2, h / 2);
    ctx.stroke();
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.font = font(Math.round(h * 0.4), 600);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + 1);
}

// Word wrap by measured pixel width.
export function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// ── Vector glyphs (SF Symbols-like, drawn with paths) ───────────────────────

export function drawIconBadge(ctx, cx, cy, r, color, glyph) {
  ctx.save();
  const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  g.addColorStop(0, color);
  g.addColorStop(1, rgba(color, 0.75));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  drawGlyph(ctx, glyph, cx, cy, r * 1.05, '#FFFFFF');
}

export function drawGlyph(ctx, glyph, cx, cy, size, color) {
  const s = size;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, s * 0.14);

  switch (glyph) {
    case 'check':
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.36, cy + s * 0.02);
      ctx.lineTo(cx - s * 0.1, cy + s * 0.28);
      ctx.lineTo(cx + s * 0.38, cy - s * 0.26);
      ctx.stroke();
      break;

    case 'warning': {
      ctx.lineWidth = Math.max(2, s * 0.1);
      ctx.beginPath();
      ctx.moveTo(cx, cy - s * 0.42);
      ctx.lineTo(cx + s * 0.44, cy + s * 0.34);
      ctx.lineTo(cx - s * 0.44, cy + s * 0.34);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - s * 0.12);
      ctx.lineTo(cx, cy + s * 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy + s * 0.22, s * 0.045, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'phone': {
      // Handset silhouette
      ctx.translate(cx, cy);
      ctx.rotate(-Math.PI / 4);
      ctx.beginPath();
      ctx.roundRect(-s * 0.42, -s * 0.12, s * 0.84, s * 0.2, s * 0.08);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(-s * 0.46, -s * 0.02, s * 0.24, s * 0.22, s * 0.06);
      ctx.roundRect(s * 0.22, -s * 0.02, s * 0.24, s * 0.22, s * 0.06);
      ctx.fill();
      break;
    }

    case 'person': {
      ctx.beginPath();
      ctx.arc(cx, cy - s * 0.18, s * 0.17, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, cy + s * 0.3, s * 0.32, s * 0.2, 0, Math.PI, 0);
      ctx.fill();
      break;
    }

    case 'cross': {
      const a = s * 0.13;
      const b = s * 0.36;
      ctx.beginPath();
      ctx.roundRect(cx - a, cy - b, a * 2, b * 2, a * 0.4);
      ctx.roundRect(cx - b, cy - a, b * 2, a * 2, a * 0.4);
      ctx.fill();
      break;
    }

    case 'vest': {
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.18, cy - s * 0.4);
      ctx.lineTo(cx - s * 0.38, cy - s * 0.26);
      ctx.lineTo(cx - s * 0.34, cy + s * 0.4);
      ctx.lineTo(cx + s * 0.34, cy + s * 0.4);
      ctx.lineTo(cx + s * 0.38, cy - s * 0.26);
      ctx.lineTo(cx + s * 0.18, cy - s * 0.4);
      ctx.lineTo(cx, cy - s * 0.12);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'chevron':
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.14, cy - s * 0.3);
      ctx.lineTo(cx + s * 0.16, cy);
      ctx.lineTo(cx - s * 0.14, cy + s * 0.3);
      ctx.stroke();
      break;

    case 'location': {
      ctx.beginPath();
      ctx.arc(cx, cy - s * 0.1, s * 0.26, Math.PI * 0.85, Math.PI * 2.15);
      ctx.lineTo(cx, cy + s * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(cx, cy - s * 0.1, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

// ── Floating capsule label for world objects ────────────────────────────────

// Returns a plane mesh sized in metres (height `heightM`), width derived from text.
export function createPillLabel(text, accent, { glyph = null, heightM = 0.1 } = {}) {
  const H = 64;
  const padX = 22;
  const iconSpace = glyph ? 46 : 0;

  const measure = document.createElement('canvas').getContext('2d');
  measure.font = font(26, 600);
  const W = Math.ceil(measure.measureText(text).width + padX * 2 + iconSpace + 8);

  const { ctx, texture } = createUICanvas(W, H + 16, 3);
  const y = 8;
  drawGlass(ctx, 4, y, W - 8, H, H / 2, { shadow: false, border: rgba(accent, 0.55) });

  let textX = W / 2;
  if (glyph) {
    drawIconBadge(ctx, 4 + padX + 14, y + H / 2, 17, accent, glyph);
    textX = W / 2 + iconSpace / 2 - 4;
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.font = font(26, 600);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, textX, y + H / 2 + 1);

  const heightTotal = heightM * ((H + 16) / H);
  const geo = new THREE.PlaneGeometry(heightTotal * (W / (H + 16)), heightTotal);
  const mesh = new THREE.Mesh(geo, uiMaterial(texture));
  mesh.renderOrder = 10;
  billboard(mesh);
  return mesh;
}

// Keeps a mesh turned toward whichever camera renders it (each eye in XR).
// Reads the already-updated world matrices (never recomputes them, which would
// clobber the per-eye XR camera matrices).
const _camQ = new THREE.Quaternion();
const _parentQ = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
export function billboard(mesh) {
  mesh.onBeforeRender = (renderer, scene, camera) => {
    if (!mesh.parent) return;
    camera.matrixWorld.decompose(_v, _camQ, _s);
    mesh.parent.matrixWorld.decompose(_v, _parentQ, _s);
    _parentQ.invert();
    mesh.quaternion.copy(_parentQ.multiply(_camQ));
    mesh.updateMatrix();
    mesh.matrixWorld.multiplyMatrices(mesh.parent.matrixWorld, mesh.matrix);
  };
}
