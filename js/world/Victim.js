import * as THREE from 'three';
import { CONFIG } from '../config.js';
import {
  COLORS, font, createUICanvas, uiMaterial, drawGlass, drawIconBadge, billboard, rgba,
} from '../ui/theme.js';

export class Victim {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.swayTime = 0;
    this._build();

    const pos = CONFIG.VICTIM_POS;
    this.group.position.set(pos.x, pos.y, pos.z);
    this.scene.add(this.group);

    this._buildDangerZone();
    this._buildVitals();
  }

  // Red ring showing how close is too close before the scene is secured
  _buildDangerZone() {
    const r = CONFIG.VICTIM_FAIL_RADIUS;
    const zone = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r - 0.12, r, 64),
      new THREE.MeshBasicMaterial({ color: 0xff453a, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false })
    );
    ring.rotation.x = -Math.PI / 2;
    zone.add(ring);
    const fill = new THREE.Mesh(
      new THREE.CircleGeometry(r - 0.12, 64),
      new THREE.MeshBasicMaterial({ color: 0xff453a, transparent: true, opacity: 0.08, depthWrite: false, toneMapped: false })
    );
    fill.rotation.x = -Math.PI / 2;
    zone.add(fill);
    zone.position.set(CONFIG.VICTIM_POS.x, 0.18, CONFIG.VICTIM_POS.z);
    this.scene.add(zone);
    this.dangerZone = zone;
    this._dangerRing = ring;
  }

  setDangerZoneVisible(on) {
    this.dangerZone.visible = on;
  }

  // Patient card for Medical management
  _buildVitals() {
    const W = 420;
    const H = 250;
    this._vitalsCanvas = createUICanvas(W, H, 2);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.5), uiMaterial(this._vitalsCanvas.texture));
    mesh.position.y = 2.45;
    mesh.renderOrder = 20;
    billboard(mesh);
    this.group.add(mesh);
    this.vitals = mesh;
    this.vitals.visible = false;
    this._vitalsDetail = null;
    this._renderVitals(false);
  }

  setVitals(visible, detailed) {
    this.vitals.visible = visible;
    if (visible && detailed !== this._vitalsDetail) this._renderVitals(detailed);
  }

  _renderVitals(detailed) {
    this._vitalsDetail = detailed;
    const { ctx, texture } = this._vitalsCanvas;
    const W = 420;
    const H = 250;
    ctx.clearRect(0, 0, W, H);
    drawGlass(ctx, 6, 6, W - 12, H - 12, 26, { tint: COLORS.green });
    drawIconBadge(ctx, 40, 40, 18, COLORS.green, 'cross');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = COLORS.green;
    ctx.font = font(12, 700);
    ctx.fillText('PATIENT  ·  MEDICAL VIEW', 68, 34);
    ctx.fillStyle = COLORS.label;
    ctx.font = font(18, 700);
    ctx.fillText('Conscious, dazed', 68, 56);

    const rows = detailed
      ? [
        ['Pulse', '104 bpm', COLORS.orange],
        ['Breathing', '20 / min, normal', COLORS.green],
        ['Skin', 'Pale, sweaty', COLORS.orange],
        ['Injury', 'Forehead cut, minor bleeding', COLORS.red],
      ]
      : [
        ['Visual check', 'Standing, responsive', COLORS.green],
        ['Visible injury', 'Holding head', COLORS.orange],
        ['Vitals', 'Get within 3 m to assess', COLORS.secondaryLabel],
      ];
    let y = 92;
    for (const [k, v, c] of rows) {
      ctx.fillStyle = rgba('#767680', 0.18);
      ctx.beginPath();
      ctx.roundRect(20, y - 22, W - 40, 32, 10);
      ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(36, y - 6, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.secondaryLabel;
      ctx.font = font(14, 600);
      ctx.fillText(k, 48, y - 1);
      ctx.fillStyle = COLORS.label;
      ctx.textAlign = 'right';
      ctx.fillText(v, W - 34, y - 1);
      ctx.textAlign = 'left';
      y += 38;
    }
    texture.needsUpdate = true;
  }

  _build() {
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9a47f, roughness: 0.65 });
    const jacketMat = new THREE.MeshStandardMaterial({ color: 0x2d4f86, roughness: 0.75 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xe9e4da, roughness: 0.9 });
    const jeansMat = new THREE.MeshStandardMaterial({ color: 0x33415c, roughness: 0.85 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 });
    const soleMat = new THREE.MeshStandardMaterial({ color: 0x2c2c2e, roughness: 0.9 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x2b1d14, roughness: 0.85 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1414, roughness: 0.5 });
    const woundMat = new THREE.MeshStandardMaterial({ color: 0x8e1414, roughness: 0.35 });

    const add = (parent, geo, mat, x, y, z, shadow = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = shadow;
      parent.add(m);
      return m;
    };

    // Torso (open jacket over a light shirt); arms are parented so they sway with it
    this.torso = new THREE.Group();
    this.torso.position.y = 1.15;
    this.group.add(this.torso);
    const chest = add(this.torso, new THREE.CapsuleGeometry(0.19, 0.3, 6, 16), jacketMat, 0, 0, 0);
    chest.scale.set(1.15, 1, 0.68);
    const shirt = add(this.torso, new THREE.PlaneGeometry(0.1, 0.42), shirtMat, 0, 0.02, -0.132, false);
    shirt.rotation.y = Math.PI;
    add(this.torso, new THREE.TorusGeometry(0.09, 0.03, 8, 20), jacketMat, 0, 0.3, 0).rotation.x = Math.PI / 2; // collar

    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.24, 0.2, 0);
      shoulder.rotation.z = side * 0.12;
      shoulder.rotation.x = -0.15;
      this.torso.add(shoulder);
      add(shoulder, new THREE.CapsuleGeometry(0.058, 0.26, 4, 12), jacketMat, 0, -0.17, 0);
      const forearm = new THREE.Group();
      forearm.position.set(0, -0.34, 0);
      forearm.rotation.x = -0.35; // hands drift forward (dazed posture)
      shoulder.add(forearm);
      add(forearm, new THREE.CapsuleGeometry(0.05, 0.24, 4, 12), jacketMat, 0, -0.14, 0);
      add(forearm, new THREE.SphereGeometry(0.048, 12, 10), skinMat, 0, -0.32, 0).scale.set(0.8, 1.15, 0.6);
    }

    // Head
    this.head = new THREE.Group();
    this.head.position.y = 1.65;
    this.group.add(this.head);
    add(this.group, new THREE.CylinderGeometry(0.055, 0.06, 0.12, 12), skinMat, 0, 1.49, 0); // neck
    const skull = add(this.head, new THREE.SphereGeometry(0.13, 24, 18), skinMat, 0, 0, 0);
    skull.scale.set(0.92, 1.12, 1);
    const hair = add(this.head, new THREE.SphereGeometry(0.138, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), hairMat, 0, 0.04, 0.016);
    hair.scale.set(0.95, 1.1, 1.02);
    add(this.head, new THREE.SphereGeometry(0.03, 8, 6), skinMat, 0, -0.01, -0.13, false).scale.set(0.7, 1, 0.8); // nose
    for (const side of [-1, 1]) {
      // Half-closed eyes and brows (dazed look)
      add(this.head, new THREE.BoxGeometry(0.035, 0.009, 0.01), darkMat, side * 0.045, 0.025, -0.118, false);
      add(this.head, new THREE.BoxGeometry(0.045, 0.008, 0.01), hairMat, side * 0.047, 0.055, -0.12, false).rotation.z = side * -0.15;
      add(this.head, new THREE.SphereGeometry(0.025, 8, 6), skinMat, side * 0.12, 0, -0.005, false).scale.set(0.4, 1, 0.7); // ears
    }
    add(this.head, new THREE.BoxGeometry(0.045, 0.014, 0.01), new THREE.MeshStandardMaterial({ color: 0x8a3b3b }), 0, -0.07, -0.117, false);
    // Small forehead laceration
    const wound = add(this.head, new THREE.CircleGeometry(0.022, 12), woundMat, 0.035, 0.085, -0.114, false);
    wound.rotation.y = Math.PI;
    wound.scale.set(1, 0.55, 1);

    // Legs
    for (const side of [-1, 1]) {
      add(this.group, new THREE.CapsuleGeometry(0.078, 0.36, 4, 12), jeansMat, side * 0.11, 0.66, 0);
      add(this.group, new THREE.CapsuleGeometry(0.065, 0.34, 4, 12), jeansMat, side * 0.11, 0.27, 0.01);
      const shoe = add(this.group, new THREE.CapsuleGeometry(0.055, 0.14, 4, 10), shoeMat, side * 0.11, 0.055, -0.04);
      shoe.rotation.x = Math.PI / 2;
      shoe.scale.set(1.05, 1, 0.8);
      add(this.group, new THREE.BoxGeometry(0.11, 0.02, 0.25), soleMat, side * 0.11, 0.01, -0.04);
    }
    // Belt
    add(this.group, new THREE.CylinderGeometry(0.17, 0.17, 0.05, 20), soleMat, 0, 0.88, 0).scale.set(1.05, 1, 0.72);

    // Distress indicator: small sweat drops
    const sweatMat = new THREE.MeshStandardMaterial({
      color: 0x9fd4ff,
      transparent: true,
      opacity: 0.6,
      roughness: 0.05,
    });
    for (let i = 0; i < 3; i++) {
      const sweatGeo = new THREE.SphereGeometry(0.012, 8, 6);
      const sweat = new THREE.Mesh(sweatGeo, sweatMat.clone());
      sweat.position.set(
        0.09 + i * 0.02,
        1.72 - i * 0.03,
        -0.1
      );
      sweat.userData.baseY = sweat.position.y;
      sweat.userData.phase = i * 0.5;
      this.group.add(sweat);
    }

    // Soft contact shadow under the feet
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = shadowCanvas.height = 64;
    const sctx = shadowCanvas.getContext('2d');
    const g = sctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, 64, 64);
    const blob = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.7),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false })
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.005;
    this.group.add(blob);
  }

  getMesh() {
    return this.group;
  }

  getPosition() {
    return this.group.position.clone();
  }

  update(dt, elapsed) {
    this.swayTime += dt;

    if (this.dangerZone.visible) {
      this._dangerRing.material.opacity = 0.45 + Math.sin(elapsed * 4) * 0.25;
    }

    // Dazed swaying motion
    const swayAmount = 0.02;
    this.torso.rotation.z = Math.sin(this.swayTime * 1.5) * swayAmount;
    this.torso.rotation.x = Math.sin(this.swayTime * 0.8) * swayAmount * 0.5;

    // Head wobble
    this.head.rotation.z = Math.sin(this.swayTime * 2.0 + 0.5) * swayAmount * 1.5;
    this.head.rotation.x = Math.sin(this.swayTime * 1.2) * swayAmount;

    // Sweat drop animation
    this.group.children.forEach(child => {
      if (child.userData.baseY !== undefined) {
        child.position.y = child.userData.baseY +
          Math.sin(elapsed * 3 + child.userData.phase) * 0.01;
        child.material.opacity = 0.3 + 0.3 * Math.sin(elapsed * 2 + child.userData.phase);
      }
    });
  }
}
