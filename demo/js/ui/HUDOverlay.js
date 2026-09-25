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

const W = 760;
const H = 260;
const CARD_H = 132;
const WIDTH_M = 1.2;
const PX_PER_M = W / WIDTH_M;
const BTN_Y = 222;      // centre of the VR button row (canvas px)
const BTN_H = 40;

export class HUDOverlay {
  constructor(scene, cameraRig, stateManager, viewManager) {
    this.scene = scene;
    this.cameraRig = cameraRig;
    this.stateManager = stateManager;
    this.view = viewManager;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    const { ctx, texture } = createUICanvas(W, H, 2);
    this.ctx = ctx;
    this.texture = texture;

    const geo = new THREE.PlaneGeometry(WIDTH_M, WIDTH_M * (H / W));
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

    // Team mode / guidance extras
    this.role = null;          // { short, color }
    this.status = null;        // text shown instead of the task while a teammate works
    this.distance = null;      // metres to the current goal
    this.transcript = null;    // { speaker, text, color }

    // VR-only buttons on the HUD (desktop uses the HTML toolbar)
    this.showButtons = false;
    this.onExit = () => {};
    this.onSwitchRole = () => {};
    this._exitArmed = 0;
    this.buttons = [
      this._makeButton('role', 'Switch role', COLORS.blue, 150, () => this.onSwitchRole()),
      this._makeButton('exit', 'Exit', COLORS.red, 110, () => this._pressExit()),
    ];

    this.stateManager.on((oldState, newState) => {
      this._onStateChange(oldState, newState);
    });
  }

  _makeButton(id, label, color, width, action) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width / PX_PER_M, BTN_H / PX_PER_M),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, depthTest: false })
    );
    mesh.visible = false;
    this.group.add(mesh);
    const btn = {
      id, label, color, width, mesh, hovered: false, shown: false, x: 0,
      isInteractable: false,
      onHoverEnter: () => { btn.hovered = true; this._render(); },
      onHoverExit: () => { btn.hovered = false; this._render(); },
      onSelect: action,
    };
    return btn;
  }

  getInteractables() {
    return this.buttons;
  }

  _pressExit() {
    if (this._exitArmed > 0) {
      this._exitArmed = 0;
      this.onExit();
    } else {
      this._exitArmed = 3;
      this._render();
    }
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
        [S.TRIANGLE_PICKUP]: 'Vest on. Visible to traffic.',
        [S.TRIANGLE_PLACED]: 'Scene secured. Traffic is warned.',
        [S.CALL_COMPLETE]: 'Help is on the way.',
        [S.COMPLETE]: 'Excellent work. Training complete.',
      };
      this.successMessage = msgs[newState] || 'Step completed';
      this.successTimer = 3;
    }
    if (newState !== S.CALLING_112) this.transcript = null;

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

  setRole(role) {
    this.role = role;
    this._render();
  }

  setStatus(text) {
    if (text === this.status) return;
    this.status = text;
    this._render();
  }

  setDistance(metres) {
    const rounded = metres === null ? null : Math.round(metres);
    if (rounded === this.distance) return;
    this.distance = rounded;
    this._render();
  }

  setTranscript(t) {
    this.transcript = t;
    this._render();
  }

  setButtonsVisible(showRole, visible) {
    this.showButtons = visible;
    this.buttons[0].shown = visible && showRole;
    this.buttons[1].shown = visible;
    this._render();
  }

  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);

    const phase = PHASE[this.currentState] || PHASE[S.INTRO];
    const standby = !!this.status && this.currentState !== S.FAIL;
    const accent = standby ? COLORS.teal : phase.color;
    const x = 8;
    const y = 8;
    const cw = W - 16;

    drawGlass(ctx, x, y, cw, CARD_H, 30, { tint: accent });
    drawIconBadge(ctx, x + 50, y + 54, 26, accent, standby ? 'person' : phase.glyph);

    // Eyebrow: phase, step count, distance to goal
    const stepIdx = STEP_ORDER.indexOf(this.currentState);
    const parts = [standby ? 'TEAMMATE ON IT' : phase.label.toUpperCase()];
    if (stepIdx >= 0) parts.push(`STEP ${stepIdx + 1} OF ${STEP_ORDER.length}`);
    if (!standby && this.distance !== null && this.distance > 1) parts.push(`${this.distance} M AWAY`);
    ctx.fillStyle = accent;
    ctx.font = font(13, 700);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(parts.join('  ·  '), x + 92, y + 36);

    // Right-hand chips: role, then timer
    let chipRight = x + cw - 16;
    const elapsed = this.stateManager.getTotalDuration();
    if (elapsed > 0) {
      const mins = Math.floor(elapsed / 60);
      const secs = Math.floor(elapsed % 60);
      const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      const tx = chipRight - 80;
      ctx.fillStyle = COLORS.fill;
      ctx.beginPath();
      ctx.roundRect(tx, y + 18, 80, 30, 15);
      ctx.fill();
      ctx.fillStyle = this.currentState === S.COMPLETE ? COLORS.green : COLORS.secondaryLabel;
      ctx.font = font(15, 600, FONT_MONO);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(timeStr, tx + 40, y + 34);
      chipRight = tx - 8;
    }
    if (this.role) {
      const text = `You · ${this.role.short}`;
      ctx.font = font(14, 700);
      const rw = ctx.measureText(text).width + 34;
      const rx = chipRight - rw;
      ctx.fillStyle = rgba(this.role.color, 0.22);
      ctx.beginPath();
      ctx.roundRect(rx, y + 18, rw, 30, 15);
      ctx.fill();
      ctx.fillStyle = this.role.color;
      ctx.beginPath();
      ctx.arc(rx + 14, y + 33, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.label;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, rx + 24, y + 34);
    }

    // Task text (or what a teammate is doing)
    const task = standby ? this.status : this.currentText.replace(/^Step \d+:\s*/, '');
    ctx.fillStyle = COLORS.label;
    ctx.font = font(21, 600);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const lines = wrapText(ctx, task, cw - 92 - 40).slice(0, 2);
    let ty = y + 66;
    for (const line of lines) {
      ctx.fillText(line, x + 92, ty);
      ty += 26;
    }

    // Segmented progress bar
    const done = this.currentState === S.COMPLETE ? STEP_ORDER.length : Math.max(stepIdx, 0);
    const segGap = 6;
    const barX = x + 92;
    const barW = cw - 92 - 24;
    const segW = (barW - segGap * (STEP_ORDER.length - 1)) / STEP_ORDER.length;
    const barY = y + CARD_H - 22;
    for (let i = 0; i < STEP_ORDER.length; i++) {
      const sx = barX + i * (segW + segGap);
      let fill = COLORS.fill;
      if (i < done) fill = COLORS.green;
      else if (i === stepIdx) fill = accent;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.roundRect(sx, barY, segW, 6, 3);
      ctx.fill();
    }

    // Row 2: toast (warnings win over successes), else call transcript
    const toast = this.failMessage
      ? { text: this.failMessage, color: COLORS.red, glyph: 'warning' }
      : this.successMessage
        ? { text: this.successMessage, color: COLORS.green, glyph: 'check' }
        : null;
    const rowY = y + CARD_H + 8;
    if (toast) {
      ctx.font = font(17, 600);
      const tw = Math.min(ctx.measureText(toast.text).width + 72, W - 20);
      const tx = (W - tw) / 2;
      drawGlass(ctx, tx, rowY, tw, 42, 21, { fill: rgba(toast.color, 0.9), border: 'rgba(255,255,255,0.3)' });
      drawGlyph(ctx, toast.glyph, tx + 26, rowY + 21, 20, '#FFFFFF');
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(toast.text, tx + 46, rowY + 22);
    } else if (this.transcript) {
      const { speaker, text, color } = this.transcript;
      ctx.font = font(16, 500);
      const line = wrapText(ctx, text, W - 220)[0] || '';
      ctx.font = font(16, 700);
      const sw = ctx.measureText(speaker + '  ').width;
      ctx.font = font(16, 500);
      const tw = sw + ctx.measureText(line).width + 40;
      const tx = (W - tw) / 2;
      drawGlass(ctx, tx, rowY, tw, 42, 21, { fill: 'rgba(28,28,30,0.88)' });
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = font(16, 700);
      ctx.fillStyle = color;
      ctx.fillText(speaker, tx + 20, rowY + 22);
      ctx.font = font(16, 500);
      ctx.fillStyle = COLORS.label;
      ctx.fillText(line, tx + 20 + sw, rowY + 22);
    }

    // Row 3: VR buttons (right aligned)
    let bx = W - 12;
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i];
      b.isInteractable = b.shown;
      b.mesh.visible = b.shown;
      if (!b.shown) continue;
      const armed = b.id === 'exit' && this._exitArmed > 0;
      const label = armed ? 'Tap to confirm' : b.label;
      const width = armed ? 170 : b.width;
      const cx = bx - width / 2;
      ctx.save();
      ctx.fillStyle = armed ? COLORS.red : b.hovered ? rgba(b.color, 0.95) : 'rgba(44,44,46,0.92)';
      ctx.beginPath();
      ctx.roundRect(cx - width / 2, BTN_Y - BTN_H / 2, width, BTN_H, BTN_H / 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = armed || b.hovered ? '#FFFFFF' : b.color;
      ctx.font = font(16, 600);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx, BTN_Y + 1);
      b.mesh.scale.x = width / b.width;
      b.mesh.position.set((cx - W / 2) / PX_PER_M, (H / 2 - BTN_Y) / PX_PER_M, 0.002);
      bx -= width + 10;
    }

    this.texture.needsUpdate = true;
  }

  update(dt) {
    // Keep in front of the viewer, above the centre of view
    this.view.placeUI(this.group, { distance: 2, height: this.view.isTop ? 0.72 : 0.5, dt });

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

    if (this._exitArmed > 0) {
      this._exitArmed -= dt;
      if (this._exitArmed <= 0) dirty = true;
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
