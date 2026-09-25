import * as THREE from 'three';
import { CONFIG } from '../config.js';
import {
  COLORS, font, createUICanvas, uiMaterial, drawGlass, drawIconBadge,
  drawGlyph, wrapText, rgba,
} from './theme.js';

// Canvas layout (logical px). Hit areas are derived from the same numbers so
// what the player sees and what the ray hits always line up.
const CW = 800;
const CH = 600;
const OPT_X = 100;
const OPT_W = 600;
const OPT_H = 66;
const OPT_Y0 = 296;   // centre of first option row
const OPT_STEP = 80;

export class DialoguePanel {
  constructor(scene, cameraRig, stateManager, audioManager, viewManager) {
    this.scene = scene;
    this.view = viewManager;
    this.cameraRig = cameraRig;
    this.stateManager = stateManager;
    this.audioManager = audioManager;

    this.isActive = false;
    this.currentQuestion = 0;
    this.selectedOptions = [];
    this._order = [];       // shuffled display order per question
    this._feedback = null;  // { display, correct, timer }

    // Panel dimensions
    this.panelWidth = 1.2;
    this.panelHeight = 0.9;
    this.pxPerM = CW / this.panelWidth;

    // Create the 3D panel
    this.group = new THREE.Group();
    this.group.visible = false;
    this.scene.add(this.group);

    // Canvas for dynamic text
    const { canvas, ctx, texture } = createUICanvas(CW, CH, 2);
    this.canvas = canvas;
    this.ctx = ctx;
    this.texture = texture;

    // Panel mesh
    const panelGeo = new THREE.PlaneGeometry(this.panelWidth, this.panelHeight);
    this.panel = new THREE.Mesh(panelGeo, uiMaterial(this.texture));
    this.panel.renderOrder = 50;
    this.group.add(this.panel);

    // Option button hit areas (invisible meshes for raycasting)
    this.buttonMeshes = [];
    this.buttonInteractables = [];
    this._createButtonHitAreas();
  }

  _createButtonHitAreas() {
    // Create up to 5 button hit areas
    for (let i = 0; i < 5; i++) {
      const btnGeo = new THREE.PlaneGeometry(OPT_W / this.pxPerM, OPT_H / this.pxPerM);
      const btnMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const btn = new THREE.Mesh(btnGeo, btnMat);
      btn.visible = false;

      // Canvas row centre -> panel-local metres
      const cx = OPT_X + OPT_W / 2;
      const cy = OPT_Y0 + i * OPT_STEP;
      btn.position.set(
        (cx - CW / 2) / this.pxPerM,
        (CH / 2 - cy) / this.pxPerM,
        0.005
      );
      this.group.add(btn);
      this.buttonMeshes.push(btn);

      // Create interactable wrapper
      const interactable = {
        mesh: btn,
        isInteractable: false,
        index: i,
        _hovered: false,
        onHoverEnter: () => {
          interactable._hovered = true;
          this._renderCurrentQuestion();
        },
        onHoverExit: () => {
          interactable._hovered = false;
          this._renderCurrentQuestion();
        },
        onSelect: () => {
          this._selectOption(i);
        },
      };
      this.buttonInteractables.push(interactable);
    }
  }

  getInteractables() {
    return this.buttonInteractables;
  }

  show(startQuestion = 0) {
    this.isActive = true;
    this.currentQuestion = startQuestion;
    this.group.visible = true;
    this._feedback = null;

    // Shuffle answer order so the right answer is not always "A"
    if (startQuestion === 0 || this._order.length === 0) {
      this._order = CONFIG.W_QUESTIONS.map(q => {
        const idx = q.options.map((_, i) => i);
        for (let i = idx.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [idx[i], idx[j]] = [idx[j], idx[i]];
        }
        return idx;
      });
    }

    // Position in front of player
    this.view.placeUI(this.group, { distance: 2, height: this._height(), snap: true });

    // Enable button interactables for current question
    this._updateButtons();
    this._renderCurrentQuestion();
  }

  hide() {
    this.isActive = false;
    this.group.visible = false;
    for (const interactable of this.buttonInteractables) {
      interactable.isInteractable = false;
      interactable.mesh.visible = false;
    }
  }

  _height() {
    return this.view.isTop ? -0.12 : -0.15;
  }

  _updateButtons() {
    const questions = CONFIG.W_QUESTIONS;
    if (this.currentQuestion >= questions.length) return;

    const q = questions[this.currentQuestion];
    for (let i = 0; i < this.buttonMeshes.length; i++) {
      if (i < q.options.length) {
        this.buttonMeshes[i].visible = true;
        this.buttonInteractables[i].isInteractable = true;
      } else {
        this.buttonMeshes[i].visible = false;
        this.buttonInteractables[i].isInteractable = false;
      }
    }
  }

  _selectOption(index) {
    if (!this.isActive || this._feedback) return;

    const questions = CONFIG.W_QUESTIONS;
    if (this.currentQuestion >= questions.length) return;

    const q = questions[this.currentQuestion];
    if (index >= q.options.length) return;

    const original = this._order[this.currentQuestion][index];
    const correct = original === q.correct;
    this.audioManager.playClick();
    this.selectedOptions.push({
      question: this.currentQuestion,
      answer: original,
      correct,
    });

    // Closed loop: show the dispatcher's acknowledgement before moving on
    this._feedback = { display: index, correct, timer: correct ? 1.1 : 2.4 };
    for (const it of this.buttonInteractables) it.isInteractable = false;
    this._renderCurrentQuestion();
  }

  _advance() {
    const questions = CONFIG.W_QUESTIONS;
    this._feedback = null;
    this.currentQuestion++;

    if (this.currentQuestion >= questions.length) {
      // All questions answered
      this.audioManager.playSuccess();
      this.hide();
      this.stateManager.transition(CONFIG.STATES.CALL_COMPLETE);
    } else {
      this._updateButtons();
      this._renderCurrentQuestion();
    }
  }

  _renderCurrentQuestion() {
    const ctx = this.ctx;
    const w = CW;
    const h = CH;
    const questions = CONFIG.W_QUESTIONS;

    ctx.clearRect(0, 0, w, h);
    drawGlass(ctx, 10, 10, w - 20, h - 20, 40, { tint: COLORS.green });

    // Header: call identity
    drawIconBadge(ctx, 76, 70, 28, COLORS.green, 'phone');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = COLORS.label;
    ctx.font = font(26, 700);
    ctx.fillText('112 Emergency Call', 120, 64);

    // Connected indicator
    ctx.fillStyle = COLORS.green;
    ctx.beginPath();
    ctx.arc(126, 86, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.secondaryLabel;
    ctx.font = font(16, 500);
    ctx.fillText('Dispatch centre  ·  Connected', 138, 92);

    // Question counter capsule
    const done = this.currentQuestion >= questions.length;
    const counter = done ? 'Done' : `${this.currentQuestion + 1} of ${questions.length}`;
    ctx.font = font(15, 600);
    const cwid = ctx.measureText(counter).width + 28;
    ctx.fillStyle = COLORS.fill;
    ctx.beginPath();
    ctx.roundRect(w - 50 - cwid, 50, cwid, 32, 16);
    ctx.fill();
    ctx.fillStyle = COLORS.secondaryLabel;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(counter, w - 50 - cwid / 2, 66);

    // Segmented progress
    const segGap = 8;
    const barX = 50;
    const barW = w - 100;
    const segW = (barW - segGap * (questions.length - 1)) / questions.length;
    for (let i = 0; i < questions.length; i++) {
      ctx.fillStyle = i < this.currentQuestion ? COLORS.green
        : i === this.currentQuestion ? rgba(COLORS.green, 0.55) : COLORS.fill;
      ctx.beginPath();
      ctx.roundRect(barX + i * (segW + segGap), 118, segW, 6, 3);
      ctx.fill();
    }

    if (done) {
      drawIconBadge(ctx, w / 2, h / 2 - 20, 40, COLORS.green, 'check');
      ctx.fillStyle = COLORS.label;
      ctx.font = font(30, 700);
      ctx.textAlign = 'center';
      ctx.fillText('Call complete', w / 2, h / 2 + 60);
      this.texture.needsUpdate = true;
      return;
    }

    const q = questions[this.currentQuestion];

    // Dispatcher speech bubble (acknowledges the last answer during feedback)
    const fb = this._feedback;
    const order = this._order[this.currentQuestion];
    const bubbleText = !fb ? q.question
      : fb.correct ? 'Understood. Thank you.'
        : `Please be precise: "${q.options[q.correct]}"`;
    ctx.font = font(23, 600);
    const qLines = wrapText(ctx, bubbleText, w - 180).slice(0, 2);
    const bubbleH = 52 + qLines.length * 30;
    ctx.fillStyle = COLORS.fillStrong;
    ctx.beginPath();
    ctx.roundRect(50, 144, w - 100, bubbleH, 22);
    ctx.fill();
    ctx.fillStyle = COLORS.teal;
    ctx.font = font(13, 700);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('DISPATCHER', 76, 174);
    ctx.fillStyle = COLORS.label;
    ctx.font = font(23, 600);
    let qy = 206;
    ctx.fillStyle = fb ? (fb.correct ? COLORS.green : COLORS.orange) : COLORS.label;
    for (const line of qLines) {
      ctx.fillText(line, 76, qy);
      qy += 30;
    }

    // Answer options (iOS list cells)
    for (let i = 0; i < q.options.length; i++) {
      const cy = OPT_Y0 + i * OPT_STEP;
      const top = cy - OPT_H / 2;
      const isHovered = !fb && this.buttonInteractables[i]._hovered;
      const isRight = fb && order[i] === q.correct;
      const isWrongPick = fb && !fb.correct && fb.display === i;
      const stateColor = isRight ? COLORS.green : isWrongPick ? COLORS.red : null;

      ctx.fillStyle = stateColor ? rgba(stateColor, 0.3) : isHovered ? rgba(COLORS.blue, 0.32) : COLORS.fill;
      ctx.beginPath();
      ctx.roundRect(OPT_X, top, OPT_W, OPT_H, 18);
      ctx.fill();
      if (isHovered || stateColor) {
        ctx.strokeStyle = stateColor || COLORS.blue;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(OPT_X + 1, top + 1, OPT_W - 2, OPT_H - 2, 17);
        ctx.stroke();
      }

      // Letter disc
      ctx.fillStyle = stateColor || (isHovered ? COLORS.blue : COLORS.fillStrong);
      ctx.beginPath();
      ctx.arc(OPT_X + 36, cy, 17, 0, Math.PI * 2);
      ctx.fill();
      if (isRight) {
        drawGlyph(ctx, 'check', OPT_X + 36, cy, 20, '#FFFFFF');
      } else if (isWrongPick) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(OPT_X + 30, cy - 6); ctx.lineTo(OPT_X + 42, cy + 6);
        ctx.moveTo(OPT_X + 42, cy - 6); ctx.lineTo(OPT_X + 30, cy + 6);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = font(16, 700);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String.fromCharCode(65 + i), OPT_X + 36, cy + 1);
      }

      // Option text
      ctx.fillStyle = isHovered ? '#FFFFFF' : 'rgba(255,255,255,0.88)';
      ctx.font = font(19, 500);
      ctx.textAlign = 'left';
      const optLines = wrapText(ctx, q.options[order[i]], OPT_W - 120).slice(0, 2);
      let ly = cy - (optLines.length - 1) * 11 + 1;
      for (const line of optLines) {
        ctx.fillText(line, OPT_X + 66, ly);
        ly += 22;
      }

      drawGlyph(ctx, 'chevron', OPT_X + OPT_W - 26, cy, 22,
        isHovered ? '#FFFFFF' : COLORS.tertiaryLabel);
    }

    // Footer hint
    ctx.fillStyle = COLORS.tertiaryLabel;
    ctx.font = font(15, 500);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Stay calm. Give the location first, then stay on the line.', w / 2, h - 40);

    this.texture.needsUpdate = true;
  }

  update(dt) {
    if (!this.isActive) return;
    this.view.placeUI(this.group, { distance: 2, height: this._height(), dt });

    if (this._feedback) {
      this._feedback.timer -= dt;
      if (this._feedback.timer <= 0) this._advance();
    }
  }
}
