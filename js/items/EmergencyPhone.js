import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLORS, font, createUICanvas, drawIconBadge, createPillLabel } from '../ui/theme.js';

export class EmergencyPhone {
  constructor(scene, stateManager, audioManager) {
    this.scene = scene;
    this.stateManager = stateManager;
    this.audioManager = audioManager;
    this.isInteractable = true;
    this.isPickedUp = false;

    this.mesh = this._build();
    const pos = CONFIG.PHONE_POS;
    this.mesh.position.set(pos.x, pos.y, pos.z);
    this.scene.add(this.mesh);
  }

  _build() {
    const group = new THREE.Group();

    // Phone body (rounded titanium frame)
    const phoneGeo = new RoundedBoxGeometry(0.078, 0.16, 0.009, 4, 0.012);
    const phoneMat = new THREE.MeshStandardMaterial({
      color: 0x3a3a3c,
      metalness: 0.9,
      roughness: 0.25,
    });
    const phone = new THREE.Mesh(phoneGeo, phoneMat);
    phone.castShadow = true;
    group.add(phone);
    this._mainMat = phoneMat;

    // Screen: iOS-style emergency call UI
    const { ctx, texture: screenTexture } = createUICanvas(144, 300, 3);
    const bg = ctx.createLinearGradient(0, 0, 0, 300);
    bg.addColorStop(0, '#1c1c1e');
    bg.addColorStop(1, '#000000');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(0, 0, 144, 300, 18);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.roundRect(48, 10, 48, 14, 7); // dynamic island
    ctx.fill();
    ctx.fillStyle = COLORS.red;
    ctx.font = font(11, 700);
    ctx.textAlign = 'center';
    ctx.fillText('EMERGENCY SOS', 72, 70);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = font(52, 300);
    ctx.fillText('112', 72, 128);
    ctx.fillStyle = COLORS.secondaryLabel;
    ctx.font = font(11, 500);
    ctx.fillText('Tap to call', 72, 150);
    drawIconBadge(ctx, 72, 232, 26, COLORS.green, 'phone');

    const screenGeo = new THREE.PlaneGeometry(0.07, 0.146);
    const screenMat = new THREE.MeshBasicMaterial({ map: screenTexture, transparent: true, toneMapped: false });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.z = 0.0048;
    group.add(screen);

    // Label above phone
    const label = this._createLabel('Call 112');
    label.position.y = 0.2;
    group.add(label);

    // Interaction ring
    const ringGeo = new THREE.RingGeometry(0.12, 0.14, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x30d158,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.z = 0.01;
    group.add(ring);
    this._ring = ring;

    return group;
  }

  _createLabel(text) {
    return createPillLabel(text, COLORS.green, { glyph: 'phone', heightM: 0.1 });
  }

  onHoverEnter() {
    if (!this.isInteractable) return;
    this._mainMat.emissive.setHex(0x002211);
    this._ring.material.opacity = 0.8;
  }

  onHoverExit() {
    this._mainMat.emissive.setHex(0x000000);
    this._ring.material.opacity = 0.4;
  }

  onSelect() {
    if (!this.isInteractable) return;
    if (!this.stateManager.isState(CONFIG.STATES.TRIANGLE_PLACED)) return;

    const success = this.stateManager.transition(CONFIG.STATES.CALLING_112);
    if (!success) return;

    this.isPickedUp = true;
    this.isInteractable = false;
    this.mesh.visible = false;
    this.audioManager.playPhoneRing();
  }

  update(dt, elapsed) {
    if (this.isPickedUp) return;

    // Only show when it's time
    const visible = this.stateManager.isState(CONFIG.STATES.TRIANGLE_PLACED);
    this.mesh.visible = visible;

    if (visible) {
      this.mesh.position.y = CONFIG.PHONE_POS.y + Math.sin(elapsed * 2) * 0.05;
      this.mesh.rotation.y = Math.sin(elapsed * 0.5) * 0.2;
      this._ring.material.opacity = 0.3 + Math.sin(elapsed * 3) * 0.2;
    }
  }
}
