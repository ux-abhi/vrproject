import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { COLORS, createPillLabel } from '../ui/theme.js';

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

    // Vest body: sleeveless silhouette with V-neck and armholes
    const s = new THREE.Shape();
    s.moveTo(-0.08, 0.3);
    s.lineTo(-0.16, 0.3);
    s.quadraticCurveTo(-0.17, 0.16, -0.25, 0.1);
    s.lineTo(-0.24, -0.3);
    s.lineTo(0.24, -0.3);
    s.lineTo(0.25, 0.1);
    s.quadraticCurveTo(0.17, 0.16, 0.16, 0.3);
    s.lineTo(0.08, 0.3);
    s.lineTo(0, 0.08);
    s.closePath();
    const vestGeo = new THREE.ExtrudeGeometry(s, {
      depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 3,
    });
    vestGeo.translate(0, 0, -0.025);
    const vestMat = new THREE.MeshStandardMaterial({
      color: 0xd4ff1a, // High-vis yellow-green
      roughness: 0.75,
      emissive: 0x000000,
    });
    const vest = new THREE.Mesh(vestGeo, vestMat);
    vest.castShadow = true;
    group.add(vest);
    this._mainMat = vestMat;

    // Retroreflective stripes (silver, catch the environment light)
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0xe8e8ea,
      metalness: 0.9,
      roughness: 0.18,
      emissive: 0x555555,
      emissiveIntensity: 0.25,
    });
    for (const y of [-0.2, -0.08]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.045, 0.085), stripeMat);
      stripe.position.y = y;
      group.add(stripe);
    }
    // Shoulder straps
    for (const side of [-1, 1]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.2, 0.086), stripeMat);
      strap.position.set(side * 0.13, 0.19, 0);
      group.add(strap);
    }

    // Floating label
    const label = this._createLabel('Safety Vest');
    label.position.y = 0.5;
    group.add(label);

    // Interaction indicator
    const ringGeo = new THREE.RingGeometry(0.35, 0.38, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd60a,
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
    return createPillLabel(text, COLORS.yellow, { glyph: 'vest', heightM: 0.1 });
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
