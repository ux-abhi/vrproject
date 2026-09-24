import * as THREE from 'three';
import { CONFIG } from '../config.js';
import {
  COLORS, font, createUICanvas, uiMaterial, drawGlass, drawIconBadge,
  drawGlyph, drawPillButton, wrapText, rgba,
} from './theme.js';

const CW = 800;
const CH = 500;
const PX_PER_M = CW / 1.6;

export class FailScreen {
  constructor(scene, cameraRig, stateManager, audioManager) {
    this.scene = scene;
    this.cameraRig = cameraRig;
    this.stateManager = stateManager;
    this.audioManager = audioManager;

    this.isActive = false;
    this.timer = 0;

    this.group = new THREE.Group();
    this.group.visible = false;
    this.scene.add(this.group);

    // Canvas
    const { canvas, ctx, texture } = createUICanvas(CW, CH, 2);
    this.canvas = canvas;
    this.ctx = ctx;
    this.texture = texture;

    // Panel
    const geo = new THREE.PlaneGeometry(1.6, 1.0);
    this.panel = new THREE.Mesh(geo, uiMaterial(this.texture));
    this.panel.renderOrder = 51;
    this.group.add(this.panel);

    // Soft red glow behind the panel (pulsed in update)
    const glow = createUICanvas(256, 160, 1);
    const g = glow.ctx.createRadialGradient(128, 80, 10, 128, 80, 128);
    g.addColorStop(0, rgba(COLORS.red, 0.9));
    g.addColorStop(0.55, rgba(COLORS.red, 0.35));
    g.addColorStop(1, rgba(COLORS.red, 0));
    glow.ctx.fillStyle = g;
    glow.ctx.fillRect(0, 0, 256, 160);
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.625),
      uiMaterial(glow.texture, { opacity: 0.4 })
    );
    back.position.z = -0.02;
    back.renderOrder = 49;
    this.group.add(back);
    this._glow = back;

    // Continue button hit area
    const btnGeo = new THREE.PlaneGeometry(0.5, 0.12);
    const btnMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.continueButton = new THREE.Mesh(btnGeo, btnMat);
    this.continueButton.position.set(0, -0.35, 0.01);
    this.group.add(this.continueButton);

    this._hoveredContinue = false;

    this.continueInteractable = {
      mesh: this.continueButton,
      isInteractable: false,
      onHoverEnter: () => { this._hoveredContinue = true; this._render(); },
      onHoverExit: () => { this._hoveredContinue = false; this._render(); },
      onSelect: () => { this._dismiss(); },
    };
  }

  getInteractable() {
    return this.continueInteractable;
  }

  show() {
    this.isActive = true;
    this.group.visible = true;
    this.continueInteractable.isInteractable = true;
    this.timer = 0;

    this.audioManager.playFail();

    // Position in front of player
    const camWorldPos = new THREE.Vector3();
    this.cameraRig.getWorldPosition(camWorldPos);
    const camDir = new THREE.Vector3(0, 0, -1);
    camDir.applyQuaternion(this.cameraRig.quaternion);

    this.group.position.set(
      camWorldPos.x + camDir.x * 2,
      camWorldPos.y + 1.5,
      camWorldPos.z + camDir.z * 2
    );
    this.group.lookAt(camWorldPos.x, this.group.position.y, camWorldPos.z);

    this._render();
  }

  _dismiss() {
    this.isActive = false;
    this.group.visible = false;
    this.continueInteractable.isInteractable = false;
    this._hoveredContinue = false;

    // Reset state to continue from where player was
    this.stateManager.resetAfterFail();
  }

  _render() {
    const ctx = this.ctx;
    const w = CW;
    const h = CH;

    ctx.clearRect(0, 0, w, h);
    drawGlass(ctx, 10, 10, w - 20, h - 20, 44, {
      tint: COLORS.red,
      border: rgba(COLORS.red, 0.6),
    });

    drawIconBadge(ctx, w / 2, 82, 38, COLORS.red, 'warning');

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = COLORS.label;
    ctx.font = font(36, 700);
    ctx.fillText('Scene not secured', w / 2, 166);

    ctx.fillStyle = COLORS.secondaryLabel;
    ctx.font = font(20, 500);
    const body = 'You approached the victim before placing the warning triangle. '
      + 'Oncoming traffic could cause a secondary collision, endangering you and the victim.';
    let y = 206;
    for (const line of wrapText(ctx, body, w - 180)) {
      ctx.fillText(line, w / 2, y);
      y += 28;
    }

    // Learning capsule
    const tip = 'Always secure the scene first';
    ctx.font = font(18, 700);
    const tw = ctx.measureText(tip).width + 70;
    ctx.fillStyle = rgba(COLORS.orange, 0.18);
    ctx.beginPath();
    ctx.roundRect((w - tw) / 2, 312, tw, 44, 22);
    ctx.fill();
    drawGlyph(ctx, 'warning', (w - tw) / 2 + 26, 334, 20, COLORS.orange);
    ctx.fillStyle = COLORS.orange;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(tip, (w - tw) / 2 + 46, 335);

    // Button, aligned with hit area at y = -0.35 m (0.5 x 0.12 m)
    const btnCy = CH / 2 + 0.35 * PX_PER_M;
    drawPillButton(ctx, w / 2, btnCy, 0.5 * PX_PER_M, 0.12 * PX_PER_M, 'Try Again', COLORS.red, this._hoveredContinue);

    this.texture.needsUpdate = true;
  }

  update(dt) {
    if (!this.isActive) return;

    this.timer += dt;
    const camWorldPos = new THREE.Vector3();
    this.cameraRig.getWorldPosition(camWorldPos);
    this.group.lookAt(camWorldPos.x, this.group.position.y, camWorldPos.z);

    // Pulsing red glow
    this._glow.material.opacity = 0.35 + Math.sin(this.timer * 3) * 0.2;
  }
}
