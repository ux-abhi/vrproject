import * as THREE from 'three';
import { createPillLabel } from '../ui/theme.js';

// Stylised human used for the player's top-view body, AI teammates and bystanders.
// Faces -z at rotation 0 (same convention as the cameras).
export class Character {
  constructor(scene, {
    top = 0x3a4a63, trousers = 0x2f3440, skin = 0xd9a47f, hair = 0x2b1d14,
    label = null, labelColor = '#0A84FF', labelGlyph = 'person', ringColor = null,
  } = {}) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this._walkPhase = 0;
    this._speed = 0;
    this._prevPos = new THREE.Vector3();
    this._hasPrev = false;
    this.pose = 'stand'; // 'stand' | 'kneel' | 'phone'

    this._build({ top, trousers, skin, hair });

    if (label) {
      this.label = createPillLabel(label, labelColor, { glyph: labelGlyph, heightM: 0.3 });
      this.label.position.y = 2.25;
      this.group.add(this.label);
    }

    if (ringColor !== null) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.42, 0.5, 40),
        new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      this.group.add(ring);
      // Heading notch
      const notch = new THREE.Mesh(
        new THREE.CircleGeometry(0.12, 3),
        new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false })
      );
      notch.rotation.x = -Math.PI / 2;
      notch.rotation.z = Math.PI / 2;
      notch.position.set(0, 0.031, -0.62);
      this.group.add(notch);
      this.ring = ring;
    }
  }

  _build({ top, trousers, skin, hair }) {
    const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.65 });
    const topMat = new THREE.MeshStandardMaterial({ color: top, roughness: 0.8 });
    const legMat = new THREE.MeshStandardMaterial({ color: trousers, roughness: 0.85 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1f1f21, roughness: 0.7 });
    const hairMat = new THREE.MeshStandardMaterial({ color: hair, roughness: 0.85 });

    const mesh = (geo, mat, parent, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };

    // Hips pivot so kneeling can lower the whole body
    this.body = new THREE.Group();
    this.group.add(this.body);

    this.torso = new THREE.Group();
    this.torso.position.y = 1.15;
    this.body.add(this.torso);
    mesh(new THREE.CapsuleGeometry(0.19, 0.3, 6, 14), topMat, this.torso).scale.set(1.12, 1, 0.68);

    // Hi-vis vest overlay (hidden until the vest is picked up)
    const vestMat = new THREE.MeshStandardMaterial({ color: 0xd4ff1a, roughness: 0.75, emissive: 0x263000 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xe8e8ea, metalness: 0.9, roughness: 0.2, emissive: 0x444444 });
    this.vest = new THREE.Group();
    const vestShell = mesh(new THREE.CapsuleGeometry(0.2, 0.26, 6, 14), vestMat, this.vest, 0, -0.03, 0);
    vestShell.scale.set(1.14, 1, 0.72);
    for (const y of [-0.16, -0.05]) {
      const s = mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.03, 20, 1, true), stripeMat, this.vest, 0, y, 0);
      s.scale.set(1.14, 1, 0.73);
    }
    this.vest.visible = false;
    this.torso.add(this.vest);

    this.head = new THREE.Group();
    this.head.position.y = 0.52;
    this.torso.add(this.head);
    mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.12, 10), skinMat, this.torso, 0, 0.36, 0);
    mesh(new THREE.SphereGeometry(0.125, 20, 16), skinMat, this.head).scale.set(0.92, 1.1, 1);
    const hairCap = mesh(new THREE.SphereGeometry(0.133, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), hairMat, this.head, 0, 0.035, 0.015);
    hairCap.scale.set(0.95, 1.08, 1.02);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1414 });
    for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.014, 8, 6), eyeMat, this.head, s * 0.042, 0.02, -0.112);

    // Arms: shoulder -> elbow groups for swing and carry poses
    this.arms = [];
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.24, 0.2, 0);
      this.torso.add(shoulder);
      mesh(new THREE.CapsuleGeometry(0.056, 0.25, 4, 10), topMat, shoulder, 0, -0.16, 0);
      const elbow = new THREE.Group();
      elbow.position.y = -0.32;
      shoulder.add(elbow);
      mesh(new THREE.CapsuleGeometry(0.048, 0.23, 4, 10), topMat, elbow, 0, -0.13, 0);
      const hand = mesh(new THREE.SphereGeometry(0.046, 10, 8), skinMat, elbow, 0, -0.3, 0);
      this.arms.push({ shoulder, elbow, hand, side });
    }

    // Legs: hip -> knee groups
    this.legs = [];
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.1, 0.9, 0);
      this.body.add(hip);
      mesh(new THREE.CapsuleGeometry(0.075, 0.34, 4, 10), legMat, hip, 0, -0.22, 0);
      const knee = new THREE.Group();
      knee.position.y = -0.45;
      hip.add(knee);
      mesh(new THREE.CapsuleGeometry(0.062, 0.32, 4, 10), legMat, knee, 0, -0.2, 0);
      const shoe = mesh(new THREE.BoxGeometry(0.1, 0.07, 0.24), shoeMat, knee, 0, -0.42, -0.04);
      shoe.castShadow = true;
      this.legs.push({ hip, knee, side });
    }

    // Props held in the right hand
    const right = this.arms[1].elbow;
    this.propTriangle = new THREE.Group();
    const tri = new THREE.Shape();
    tri.moveTo(0, 0.2); tri.lineTo(-0.16, -0.08); tri.lineTo(0.16, -0.08); tri.closePath();
    const hole = new THREE.Path();
    hole.moveTo(0, 0.12); hole.lineTo(-0.09, -0.03); hole.lineTo(0.09, -0.03); hole.closePath();
    tri.holes.push(hole);
    const triMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.015, bevelEnabled: false }),
      new THREE.MeshStandardMaterial({ color: 0xe02020, emissive: 0x551000, roughness: 0.3 }));
    triMesh.rotation.y = Math.PI / 2;
    this.propTriangle.add(triMesh);
    this.propTriangle.position.set(0, -0.42, 0);
    this.propTriangle.visible = false;
    right.add(this.propTriangle);

    this.propPhone = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.075, 0.008),
      new THREE.MeshStandardMaterial({ color: 0x2c2c2e, metalness: 0.8, roughness: 0.3 }));
    this.propPhone.position.set(0, -0.3, -0.03);
    this.propPhone.visible = false;
    right.add(this.propPhone);

    // Soft contact shadow
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d').createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,0.4)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    const cx = c.getContext('2d');
    cx.fillStyle = g;
    cx.fillRect(0, 0, 64, 64);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.02;
    this.group.add(blob);
  }

  setVisible(v) { this.group.visible = v; }
  setVest(on) { this.vest.visible = on; }
  setHolding(item) {
    this.propTriangle.visible = item === 'triangle';
    this.propPhone.visible = item === 'phone';
    this.holding = item;
  }

  // Place the character; yaw uses the camera convention (0 = facing -z)
  setPose(x, z, yaw) {
    this.group.position.set(x, 0, z);
    this.group.rotation.y = yaw;
  }

  get position() { return this.group.position; }

  update(dt, elapsed) {
    // Walk speed from actual movement so any driver (player, AI) animates correctly
    if (this._hasPrev && dt > 0) {
      const d = Math.hypot(this.group.position.x - this._prevPos.x, this.group.position.z - this._prevPos.z);
      const s = Math.min(d / dt, 6);
      this._speed += (s - this._speed) * Math.min(1, dt * 8);
    }
    this._prevPos.copy(this.group.position);
    this._hasPrev = true;

    const moving = this._speed > 0.25;
    this._walkPhase += dt * (moving ? 3 + this._speed * 1.6 : 0);
    const amp = moving ? Math.min(0.55, 0.18 + this._speed * 0.12) : 0;
    const swing = Math.sin(this._walkPhase) * amp;

    const kneel = this.pose === 'kneel' && !moving;
    this.body.position.y += ((kneel ? -0.42 : moving ? Math.abs(Math.cos(this._walkPhase)) * 0.03 : 0) - this.body.position.y) * Math.min(1, dt * 6);

    for (const leg of this.legs) {
      const target = kneel ? (leg.side < 0 ? -1.45 : -0.2) : swing * leg.side;
      leg.hip.rotation.x += (target - leg.hip.rotation.x) * Math.min(1, dt * 10);
      const kneeT = kneel ? (leg.side < 0 ? 1.5 : 1.35) : Math.max(0, -Math.sin(this._walkPhase * leg.side)) * amp * 1.4;
      leg.knee.rotation.x += (kneeT - leg.knee.rotation.x) * Math.min(1, dt * 10);
    }

    for (const arm of this.arms) {
      let sx = -swing * arm.side * 0.8;
      let ex = -0.15;
      let sz = arm.side * 0.06;
      if (arm.side > 0 && this.holding === 'phone') { sx = -2.5; ex = -1.9; sz = 0.35; }
      else if (arm.side > 0 && this.holding === 'triangle') { sx = -0.5; ex = -0.9; }
      else if (kneel) { sx = -0.9; ex = -0.4; }
      arm.shoulder.rotation.x += (sx - arm.shoulder.rotation.x) * Math.min(1, dt * 10);
      arm.shoulder.rotation.z += (sz - arm.shoulder.rotation.z) * Math.min(1, dt * 10);
      arm.elbow.rotation.x += (ex - arm.elbow.rotation.x) * Math.min(1, dt * 10);
    }

    // Idle breathing
    this.torso.scale.y = 1 + Math.sin(elapsed * 2.2) * 0.008;
    this.torso.rotation.x = kneel ? 0.35 : 0;

    if (this.ring) this.ring.material.opacity = 0.45 + Math.sin(elapsed * 3) * 0.2;
  }

  dispose() {
    this.scene.remove(this.group);
  }
}
