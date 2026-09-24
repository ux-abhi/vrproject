import * as THREE from 'three';
import { CONFIG } from '../config.js';
import {
  COLORS, font, createUICanvas, uiMaterial, drawGlass, drawIconBadge,
  drawPillButton, wrapText, rgba,
} from './theme.js';

const CW = 800;
const CH = 900;
const PX_PER_M = CW / 1.6;

const GRADE_STYLE = {
  A: { color: COLORS.green, ring: 1.0 },
  B: { color: COLORS.blue, ring: 0.72 },
  C: { color: COLORS.orange, ring: 0.45 },
};

export class ScoreScreen {
  constructor(scene, cameraRig, stateManager, scoringSystem) {
    this.scene = scene;
    this.cameraRig = cameraRig;
    this.stateManager = stateManager;
    this.scoringSystem = scoringSystem;

    this.group = new THREE.Group();
    this.group.visible = false;
    this.scene.add(this.group);

    // Canvas
    const { canvas, ctx, texture } = createUICanvas(CW, CH, 2);
    this.canvas = canvas;
    this.ctx = ctx;
    this.texture = texture;

    // Panel
    const geo = new THREE.PlaneGeometry(1.6, 1.8);
    this.panel = new THREE.Mesh(geo, uiMaterial(this.texture));
    this.panel.renderOrder = 50;
    this.group.add(this.panel);

    // Retry button hit area
    const retryGeo = new THREE.PlaneGeometry(0.5, 0.12);
    const retryMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.retryButton = new THREE.Mesh(retryGeo, retryMat);
    this.retryButton.position.set(0, -0.75, 0.01);
    this.group.add(this.retryButton);

    this.retryInteractable = {
      mesh: this.retryButton,
      isInteractable: false,
      onHoverEnter: () => { this._hoveredRetry = true; this._render(); },
      onHoverExit: () => { this._hoveredRetry = false; this._render(); },
      onSelect: () => { window.location.reload(); },
    };
    this._hoveredRetry = false;
  }

  getInteractable() {
    return this.retryInteractable;
  }

  show() {
    this.group.visible = true;
    this.retryInteractable.isInteractable = true;

    // Position in front of player
    const camWorldPos = new THREE.Vector3();
    this.cameraRig.getWorldPosition(camWorldPos);
    const camDir = new THREE.Vector3(0, 0, -1);
    camDir.applyQuaternion(this.cameraRig.quaternion);

    this.group.position.set(
      camWorldPos.x + camDir.x * 2.5,
      camWorldPos.y + 1.5,
      camWorldPos.z + camDir.z * 2.5
    );
    this.group.lookAt(camWorldPos.x, this.group.position.y, camWorldPos.z);

    this._render();
  }

  _render() {
    const ctx = this.ctx;
    const w = CW;
    const h = CH;
    const results = this.scoringSystem.getResults();
    const style = GRADE_STYLE[results.grade] || GRADE_STYLE.C;

    ctx.clearRect(0, 0, w, h);
    drawGlass(ctx, 10, 10, w - 20, h - 20, 48, { tint: style.color });

    // Grade ring (activity-ring style)
    const rx = w / 2;
    const ry = 170;
    const rr = 84;
    ctx.lineCap = 'round';
    ctx.lineWidth = 18;
    ctx.strokeStyle = rgba(style.color, 0.2);
    ctx.beginPath();
    ctx.arc(rx, ry, rr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.shadowColor = rgba(style.color, 0.7);
    ctx.shadowBlur = 20;
    ctx.strokeStyle = style.color;
    ctx.beginPath();
    ctx.arc(rx, ry, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * style.ring);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = COLORS.label;
    ctx.font = font(76, 800);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(results.grade, rx, ry + 4);

    // Title and verdict
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = COLORS.label;
    ctx.font = font(40, 700);
    ctx.fillText('Training Complete', w / 2, 316);

    const descriptions = {
      A: 'Excellent. You followed the Chain of Rescue perfectly.',
      B: 'Good performance. Practice will sharpen your response time.',
      C: 'Completed, with clear room to improve.',
    };
    ctx.fillStyle = COLORS.secondaryLabel;
    ctx.font = font(20, 500);
    ctx.fillText(descriptions[results.grade] || '', w / 2, 352);

    // Stat tiles (2 x 2)
    const stats = [
      { label: 'TOTAL TIME', value: results.totalTime, color: COLORS.blue },
      { label: 'TIME TO CALL', value: results.callDuration, color: COLORS.green },
      { label: 'FAILED ATTEMPTS', value: String(results.failCount), color: results.failCount ? COLORS.red : COLORS.green },
      { label: 'STEPS COMPLETED', value: `${results.stepsCompleted} / 8`, color: COLORS.orange },
    ];
    const tileW = 320;
    const tileH = 116;
    const gap = 20;
    const gx = (w - tileW * 2 - gap) / 2;
    stats.forEach((stat, i) => {
      const tx = gx + (i % 2) * (tileW + gap);
      const ty = 392 + Math.floor(i / 2) * (tileH + gap);
      ctx.fillStyle = COLORS.fill;
      ctx.beginPath();
      ctx.roundRect(tx, ty, tileW, tileH, 24);
      ctx.fill();

      ctx.fillStyle = stat.color;
      ctx.beginPath();
      ctx.arc(tx + 28, ty + 34, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.fillStyle = COLORS.secondaryLabel;
      ctx.font = font(14, 700);
      ctx.fillText(stat.label, tx + 42, ty + 39);

      ctx.fillStyle = COLORS.label;
      ctx.font = font(40, 700);
      ctx.fillText(stat.value, tx + 24, ty + 92);
    });

    // Key learning point
    const ky = 666;
    ctx.fillStyle = rgba(COLORS.orange, 0.16);
    ctx.beginPath();
    ctx.roundRect(gx, ky, tileW * 2 + gap, 92, 24);
    ctx.fill();
    drawIconBadge(ctx, gx + 46, ky + 46, 22, COLORS.orange, 'phone');
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.orange;
    ctx.font = font(13, 700);
    ctx.fillText('REMEMBER', gx + 84, ky + 36);
    ctx.fillStyle = COLORS.label;
    ctx.font = font(20, 600);
    const kl = wrapText(ctx, 'The 112 call is the "A and O" of rescue.', tileW * 2 + gap - 110);
    ctx.fillText(kl[0], gx + 84, ky + 64);

    // Retry button, aligned with the hit area at y = -0.75 m (0.5 x 0.12 m)
    const btnCy = CH / 2 + 0.75 * PX_PER_M;
    drawPillButton(ctx, w / 2, btnCy, 0.5 * PX_PER_M, 0.12 * PX_PER_M, 'Try Again', COLORS.blue, this._hoveredRetry);

    this.texture.needsUpdate = true;
  }

  update(dt) {
    if (!this.group.visible) return;
    const camWorldPos = new THREE.Vector3();
    this.cameraRig.getWorldPosition(camWorldPos);
    this.group.lookAt(camWorldPos.x, this.group.position.y, camWorldPos.z);
  }
}
