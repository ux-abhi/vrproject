import * as THREE from 'three';
import { CONFIG } from '../config.js';
import {
  COLORS, FONT_MONO, font, createUICanvas, uiMaterial, drawGlass,
  drawIconBadge, drawGlyph, wrapText, rgba,
} from './theme.js';

const S = CONFIG.STATES;

// Ordered steps shown in the segmented progress bar
const STEP_ORDER = [
  S.VEST_PICKUP, S.TRIANGLE_PICKUP, S.TRIANGLE_HELD,
  S.TRIANGLE_PLACED, S.CALLING_112, S.CALL_COMPLETE, S.APPROACH_VICTIM,
];

// Phase of the chain of rescue each state belongs to
const PHASE = {
  [S.INTRO]: { label: 'Briefing', color: COLORS.blue, glyph: 'person' },
  [S.VEST_PICKUP]: { label: 'Secure the scene', color: COLORS.yellow, glyph: 'vest' },
  [S.TRIANGLE_PICKUP]: { label: 'Secure the scene', color: COLORS.orange, glyph: 'warning' },
  [S.TRIANGLE_HELD]: { label: 'Secure the scene', color: COLORS.orange, glyph: 'warning' },
  [S.TRIANGLE_PLACED]: { label: 'Call emergency services', color: COLORS.green, glyph: 'phone' },
  [S.CALLING_112]: { label: 'Call emergency services', color: COLORS.green, glyph: 'phone' },
  [S.CALL_COMPLETE]: { label: 'Reach the patient', color: COLORS.blue, glyph: 'person' },
  [S.APPROACH_VICTIM]: { label: 'Reach the patient', color: COLORS.blue, glyph: 'person' },
  [S.COMPLETE]: { label: 'Complete', color: COLORS.green, glyph: 'check' },
  [S.FAIL]: { label: 'Scene not secured', color: COLORS.red, glyph: 'warning' },
};

const W = 640;
const H = 200;
const CARD_H = 132;

export class HUDOverlay {
  constructor(scene, cameraRig, stateManager) {
    this.scene = scene;
    this.cameraRig = cameraRig;
    this.stateManager = stateManager;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    const { ctx, texture } = createUICanvas(W, H, 2);
    this.ctx = ctx;
    this.texture = texture;

    // HUD panel (1 m wide)
    const geo = new THREE.PlaneGeometry(1.0, 1.0 * (H / W));
    const mat = uiMaterial(this.texture, { depthTest: false });
    this.panel = new THREE.Mesh(geo, mat);
    this.panel.renderOrder = 100;
    this.group.add(this.panel);

    this.currentState = S.INTRO;
    this.currentText = '';
    this.successMessage = null;
    this.successTimer = 0;
    this.failMessage = null;
    this.failTimer = 0;
    this._lastSecond = -1;

    // Listen for state changes
    this.stateManager.on((oldState, newState) => {
      this._onStateChange(oldState, newState);
    });
  }

  _onStateChange(oldState, newState) {
    this.currentState = newState;
    this.currentText = CONFIG.TASK_TEXT[newState] || '';
    // The score screen takes over on completion
    this.group.visible = newState !== S.COMPLETE;

    if (newState === S.FAIL) {
      this.failMessage = 'Oncoming traffic risk. Secure the scene first.';
      this.failTimer = 5;
    } else if ([
      S.TRIANGLE_PICKUP,
      S.TRIANGLE_PLACED,
      S.CALL_COMPLETE,
      S.COMPLETE,
    ].includes(newState)) {
      const msgs = {
        [S.TRIANGLE_PICKUP]: 'Vest on. You are visible to traffic.',
        [S.TRIANGLE_PLACED]: 'Scene secured. Traffic is warned.',
        [S.CALL_COMPLETE]: 'Help is on the way.',
        [S.COMPLETE]: 'Excellent work. Training complete.',
      };
      this.successMessage = msgs[newState] || 'Step completed';
      this.successTimer = 3;
    }

    this._render();
  }

  showMessage(text, duration = 3, isSuccess = true) {
    if (isSuccess) {
      this.successMessage = text;
      this.successTimer = duration;
    } else {
      this.failMessage = text;
      this.failTimer = duration;
    }
    this._render();
  }

  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);

    const phase = PHASE[this.currentState] || PHASE[S.INTRO];
    const x = 8;
    const y = 8;
    const cw = W - 16;

    drawGlass(ctx, x, y, cw, CARD_H, 30, { tint: phase.color });

    // Phase badge
    drawIconBadge(ctx, x + 50, y + 54, 26, phase.color, phase.glyph);

    // Eyebrow: phase + step count
    const stepIdx = STEP_ORDER.indexOf(this.currentState);
    const eyebrow = stepIdx >= 0
      ? `${phase.label.toUpperCase()}  ·  STEP ${stepIdx + 1} OF ${STEP_ORDER.length}`
      : phase.label.toUpperCase();
    ctx.fillStyle = phase.color;
    ctx.font = font(13, 700);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(eyebrow, x + 92, y + 36);

    // Task text (strip the legacy "Step n:" prefix; the eyebrow shows it)
    const task = this.currentText.replace(/^Step \d+:\s*/, '');
    ctx.fillStyle = COLORS.label;
    ctx.font = font(21, 600);
    const lines = wrapText(ctx, task, cw - 92 - 110).slice(0, 2);
    let ty = y + 64;
    for (const line of lines) {
      ctx.fillText(line, x + 92, ty);
      ty += 26;
    }

    // Timer capsule
    const elapsed = this.stateManager.getTotalDuration();
    if (elapsed > 0) {
      const mins = Math.floor(elapsed / 60);
      const secs = Math.floor(elapsed % 60);
      const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      const tx = x + cw - 96;
      ctx.fillStyle = COLORS.fill;
      ctx.beginPath();
      ctx.roundRect(tx, y + 18, 80, 30, 15);
      ctx.fill();
      ctx.fillStyle = this.currentState === S.COMPLETE ? COLORS.green : COLORS.secondaryLabel;
      ctx.font = font(15, 600, FONT_MONO);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(timeStr, tx + 40, y + 34);
    }

    // Segmented progress bar
    const done = this.currentState === S.COMPLETE ? STEP_ORDER.length : Math.max(stepIdx, 0);
    const segGap = 6;
    const barX = x + 92;
    const barW = cw - 92 - 24;
    const segW = (barW - segGap * (STEP_ORDER.length - 1)) / STEP_ORDER.length;
    const barY = y + CARD_H - 24;
    for (let i = 0; i < STEP_ORDER.length; i++) {
      const sx = barX + i * (segW + segGap);
      let fill = COLORS.fill;
      if (i < done) fill = COLORS.green;
      else if (i === stepIdx) fill = phase.color;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.roundRect(sx, barY, segW, 6, 3);
      ctx.fill();
    }

    // Toast below the card
    const toast = this.failMessage
      ? { text: this.failMessage, color: COLORS.red, glyph: 'warning' }
      : this.successMessage
        ? { text: this.successMessage, color: COLORS.green, glyph: 'check' }
        : null;
    if (toast) {
      ctx.font = font(17, 600);
      const tw = ctx.measureText(toast.text).width + 72;
      const tx = (W - tw) / 2;
      const tyy = y + CARD_H + 10;
      drawGlass(ctx, tx, tyy, tw, 42, 21, { fill: rgba(toast.color, 0.9), border: 'rgba(255,255,255,0.3)' });
      drawGlyph(ctx, toast.glyph, tx + 26, tyy + 21, 20, '#FFFFFF');
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(toast.text, tx + 46, tyy + 22);
    }

    this.texture.needsUpdate = true;
  }

  update(dt) {
    // Position in front of player, slightly above eye level
    const camWorldPos = new THREE.Vector3();
    const camWorldDir = new THREE.Vector3(0, 0, -1);
    this.cameraRig.getWorldPosition(camWorldPos);
    camWorldDir.applyQuaternion(this.cameraRig.quaternion);

    this.group.position.set(
      camWorldPos.x + camWorldDir.x * 2,
      camWorldPos.y + 2.2,
      camWorldPos.z + camWorldDir.z * 2
    );
    this.group.lookAt(camWorldPos.x, this.group.position.y, camWorldPos.z);

    let dirty = false;

    if (this.successTimer > 0) {
      this.successTimer -= dt;
      if (this.successTimer <= 0) {
        this.successMessage = null;
        dirty = true;
      }
    }

    if (this.failTimer > 0) {
      this.failTimer -= dt;
      if (this.failTimer <= 0) {
        this.failMessage = null;
        dirty = true;
      }
    }

    // Re-render once per second for the timer (not every frame)
    if (!this.stateManager.isState(S.INTRO, S.COMPLETE)) {
      const sec = Math.floor(this.stateManager.getTotalDuration());
      if (sec !== this._lastSecond) {
        this._lastSecond = sec;
        dirty = true;
      }
    }

    if (dirty) this._render();
  }
}
