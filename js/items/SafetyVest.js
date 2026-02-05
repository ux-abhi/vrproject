import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class SafetyVest {
  constructor(scene, stateManager, audioManager) {
    this.scene = scene;
    this.stateManager = stateManager;
    this.audioManager = audioManager;
    this.isInteractable = true;
    this.isPickedUp = false;

    this.mesh = this._build();
    const pos = CONFIG.VEST_POS;
    this.mesh.position.set(pos.x, pos.y, pos.z);
    this.scene.add(this.mesh);

    this._originalEmissive = 0x000000;
  }

  _build() {
    const group = new THREE.Group();

    // Vest body
    const vestGeo = new THREE.BoxGeometry(0.5, 0.6, 0.08);
    const vestMat = new THREE.MeshStandardMaterial({
      color: 0xccff00, // High-vis yellow-green
      roughness: 0.6,
      emissive: 0x000000,
    });
    const vest = new THREE.Mesh(vestGeo, vestMat);
    vest.castShadow = true;
    group.add(vest);
    this._mainMat = vestMat;

    // Reflective stripes
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0xdddddd,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0x333333,
      emissiveIntensity: 0.3,
    });

    // Horizontal stripe
    const stripeGeo1 = new THREE.BoxGeometry(0.52, 0.06, 0.09);
    const stripe1 = new THREE.Mesh(stripeGeo1, stripeMat);
    stripe1.position.y = -0.1;
    group.add(stripe1);

    const stripe2 = new THREE.Mesh(stripeGeo1, stripeMat);
    stripe2.position.y = 0.1;
    group.add(stripe2);

    // Floating label
    const label = this._createLabel('Safety Vest');
    label.position.y = 0.5;
    group.add(label);

    // Interaction indicator
    const ringGeo = new THREE.RingGeometry(0.35, 0.38, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xccff00,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.z = -0.05;
    group.add(ring);
    this._ring = ring;

    return group;
  }

  _createLabel(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.beginPath();
    ctx.roundRect(0, 0, 256, 64, 8);
    ctx.fill();
    ctx.fillStyle = '#ccff00';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const geo = new THREE.PlaneGeometry(0.5, 0.125);
    const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    return new THREE.Mesh(geo, mat);
  }

  onHoverEnter() {
    if (!this.isInteractable) return;
    this._mainMat.emissive.setHex(0x444400);
    this._ring.material.opacity = 0.8;
  }

  onHoverExit() {
    this._mainMat.emissive.setHex(0x000000);
    this._ring.material.opacity = 0.4;
  }

  onSelect() {
    if (!this.isInteractable) return;
    if (!this.stateManager.isState(CONFIG.STATES.VEST_PICKUP)) return;

    this.isPickedUp = true;
    this.isInteractable = false;
    this.mesh.visible = false;

    this.audioManager.playSuccess();
    this.stateManager.transition(CONFIG.STATES.TRIANGLE_PICKUP);
  }

  update(dt, elapsed) {
    if (this.isPickedUp) return;

    // Gentle floating animation
    this.mesh.position.y = CONFIG.VEST_POS.y + Math.sin(elapsed * 2) * 0.05;
    this.mesh.rotation.y = Math.sin(elapsed * 0.5) * 0.2;

    // Pulse the ring
    if (this.stateManager.isState(CONFIG.STATES.VEST_PICKUP)) {
      this._ring.material.opacity = 0.3 + Math.sin(elapsed * 3) * 0.2;
    }
  }
}
