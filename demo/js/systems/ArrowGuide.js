import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { COLORS, createPillLabel } from '../ui/theme.js';

// Points the player at the current goal.
//  - Immersive: a floating arrow just below eye level that follows the gaze
//  - Top view: a large arrow on the ground in front of the character
// Plus a light beacon standing on the goal, visible from far away in both views.
export class ArrowGuide {
  constructor(scene, cameraRig, viewManager) {
    this.scene = scene;
    this.cameraRig = cameraRig;
    this.view = viewManager;
    this.targetPosition = new THREE.Vector3();
    this.isVisible = false;
    this.enabled = true;

    this.arrow = this._createArrow();
    this.scene.add(this.arrow);
    this.arrow.visible = false;

    this.beacon = this._createBeacon();
    this.scene.add(this.beacon);
    this.beacon.visible = false;

    this._head = new THREE.Vector3();
  }

  _createArrow() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0a84ff,
      emissive: 0x0a84ff,
      emissiveIntensity: 0.9,
      roughness: 0.3,
    });

    // Arrow shaft
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 20), mat);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = -0.15;
    group.add(shaft);

    // Arrow head (cone)
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 24), mat);
    head.rotation.x = -Math.PI / 2;
    head.position.z = -0.5;
    group.add(head);

    // Glow
    this._glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x64d2ff, transparent: true, opacity: 0.15, depthWrite: false })
    );
    this._glow.position.z = -0.35;
    group.add(this._glow);

    // Label
    this.label = createPillLabel('Follow the arrow', COLORS.blue, { glyph: 'chevron', heightM: 0.09 });
    this.label.position.set(0, 0.15, -0.3);
    group.add(this.label);

    return group;
  }

  _createBeacon() {
    const group = new THREE.Group();

    // Vertical light beam, fading upwards
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 128, 0, 0);
    g.addColorStop(0, 'rgba(100, 210, 255, 0.4)');
    g.addColorStop(1, 'rgba(100, 210, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 128);
    const tex = new THREE.CanvasTexture(c);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 7, 12, 1, true),
      new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, toneMapped: false,
      })
    );
    beam.position.y = 3.5;
    group.add(beam);
    this._beam = beam;

    // Pulsing ground rings
    this._beaconRings = [];
    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.68, 48),
        new THREE.MeshBasicMaterial({ color: 0x64d2ff, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.04;
      ring.userData.phase = i * 0.5;
      group.add(ring);
      this._beaconRings.push(ring);
    }
    return group;
  }

  setTarget(worldPosition) {
    this.targetPosition.copy(worldPosition);
    this.isVisible = true;
    this.beacon.position.set(worldPosition.x, 0, worldPosition.z);
  }

  hide() {
    this.arrow.visible = false;
    this.beacon.visible = false;
    this.isVisible = false;
  }

  // Team mode: hide guidance while a teammate owns the current step
  setEnabled(on) {
    this.enabled = on;
  }

  // Horizontal distance from a point to the current target
  distanceFrom(pos) {
    if (!this.isVisible) return null;
    return Math.hypot(this.targetPosition.x - pos.x, this.targetPosition.z - pos.z);
  }

  update(dt, avatarPosition) {
    const show = this.isVisible && this.enabled;
    this.arrow.visible = show;
    this.beacon.visible = show;
    if (!show) return;

    const t = performance.now() * CONFIG.ARROW_BOB_SPEED;
    const top = this.view.isTop;
    let x;
    let y;
    let z;

    if (top) {
      // Ground arrow in front of the character, pointing at the goal
      const dx = this.targetPosition.x - avatarPosition.x;
      const dz = this.targetPosition.z - avatarPosition.z;
      const len = Math.hypot(dx, dz) || 1;
      x = avatarPosition.x + (dx / len) * 1.1;
      z = avatarPosition.z + (dz / len) * 1.1;
      y = 0.35 + Math.sin(t) * 0.05;
      this.arrow.scale.setScalar(2.4);
      this.label.visible = false;
    } else {
      // Floating arrow ahead of the gaze, below eye level
      this.view.getHeadPosition(this._head);
      const yaw = this.view.getYaw();
      x = this._head.x - Math.sin(yaw) * 1.5;
      z = this._head.z - Math.cos(yaw) * 1.5;
      y = this._head.y - 0.6 + Math.sin(t) * CONFIG.ARROW_BOB_AMPLITUDE;
      this.arrow.scale.setScalar(1);
      this.label.visible = true;
    }
    this.arrow.position.set(x, y, z);

    // The beam is for finding far targets; fade it out up close
    const near = Math.hypot(this.targetPosition.x - x, this.targetPosition.z - z);
    this._beam.material.opacity = THREE.MathUtils.clamp((near - 4) / 8, 0, 1);

    // Local -z of the arrow points at the target on the ground plane
    const dx = this.targetPosition.x - x;
    const dz = this.targetPosition.z - z;
    this.arrow.rotation.set(0, Math.atan2(-dx, -dz), 0);

    this._glow.material.opacity = 0.1 + Math.sin(t * 2) * 0.08;

    const time = performance.now() / 1000;
    for (const ring of this._beaconRings) {
      const p = (time * 0.8 + ring.userData.phase) % 1;
      ring.scale.setScalar(0.6 + p * 1.2);
      ring.material.opacity = 0.7 * (1 - p);
    }
  }

  updateForState(state) {
    switch (state) {
      case CONFIG.STATES.VEST_PICKUP:
        this.setTarget(new THREE.Vector3(
          CONFIG.VEST_POS.x, CONFIG.VEST_POS.y + 0.5, CONFIG.VEST_POS.z
        ));
        break;

      case CONFIG.STATES.TRIANGLE_PICKUP:
        this.setTarget(new THREE.Vector3(
          CONFIG.TRIANGLE_POS.x, CONFIG.TRIANGLE_POS.y + 0.5, CONFIG.TRIANGLE_POS.z
        ));
        break;

      case CONFIG.STATES.TRIANGLE_HELD:
        // Point to the placement zone behind the collision
        this.setTarget(new THREE.Vector3(
          CONFIG.COLLISION_POS.x,
          0.5,
          CONFIG.COLLISION_POS.z + CONFIG.TRIANGLE_PLACE_DISTANCE
        ));
        break;

      case CONFIG.STATES.TRIANGLE_PLACED:
        this.setTarget(new THREE.Vector3(
          CONFIG.PHONE_POS.x, CONFIG.PHONE_POS.y + 0.5, CONFIG.PHONE_POS.z
        ));
        break;

      case CONFIG.STATES.CALL_COMPLETE:
      case CONFIG.STATES.APPROACH_VICTIM:
        this.setTarget(new THREE.Vector3(
          CONFIG.VICTIM_POS.x, 1.5, CONFIG.VICTIM_POS.z
        ));
        break;

      default:
        this.hide();
        break;
    }
  }
}
