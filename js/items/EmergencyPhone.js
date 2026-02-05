import * as THREE from 'three';
import { CONFIG } from '../config.js';

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

    // Phone body
    const phoneGeo = new THREE.BoxGeometry(0.08, 0.16, 0.01);
    const phoneMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.8,
      roughness: 0.2,
    });
    const phone = new THREE.Mesh(phoneGeo, phoneMat);
    phone.castShadow = true;
    group.add(phone);
    this._mainMat = phoneMat;

    // Screen
    const screenGeo = new THREE.PlaneGeometry(0.065, 0.12);
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#112233';
    ctx.fillRect(0, 0, 128, 256);
    ctx.fillStyle = '#00ff44';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('112', 64, 120);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial';
    ctx.fillText('Emergency', 64, 160);
    ctx.fillText('Call', 64, 180);

    const screenTexture = new THREE.CanvasTexture(canvas);
    const screenMat = new THREE.MeshBasicMaterial({ map: screenTexture });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.z = 0.006;
    screen.position.y = 0.01;
    group.add(screen);

    // Label above phone
    const label = this._createLabel('Mobile Phone - Call 112');
    label.position.y = 0.2;
    group.add(label);

    // Interaction ring
    const ringGeo = new THREE.RingGeometry(0.12, 0.14, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ff44,
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
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.beginPath();
    ctx.roundRect(0, 0, 512, 64, 8);
    ctx.fill();
    ctx.fillStyle = '#00ff44';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const geo = new THREE.PlaneGeometry(0.6, 0.075);
    const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    return new THREE.Mesh(geo, mat);
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
