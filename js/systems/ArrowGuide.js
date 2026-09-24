import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { COLORS, createPillLabel } from '../ui/theme.js';

export class ArrowGuide {
  constructor(scene, cameraRig) {
    this.scene = scene;
    this.cameraRig = cameraRig;
    this.targetPosition = new THREE.Vector3();
    this.isVisible = false;
    this.arrow = this._createArrow();

    // Attach to camera rig so it follows the player
    this.cameraRig.add(this.arrow);
    this.arrow.position.set(0, 1.0, -1.5); // In front, below eye level
    this.arrow.visible = false;
  }

  _createArrow() {
    const group = new THREE.Group();

    // Arrow shaft
    const shaftGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 20);
    const shaftMat = new THREE.MeshStandardMaterial({
      color: 0x0a84ff,
      emissive: 0x0a84ff,
      emissiveIntensity: 0.9,
      roughness: 0.3,
    });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = -0.15;
    group.add(shaft);

    // Arrow head (cone)
    const headGeo = new THREE.ConeGeometry(0.08, 0.2, 24);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x0a84ff,
      emissive: 0x0a84ff,
      emissiveIntensity: 0.9,
      roughness: 0.3,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.rotation.x = -Math.PI / 2;
    head.position.z = -0.5;
    group.add(head);

    // Glow effect (larger transparent sphere)
    const glowGeo = new THREE.SphereGeometry(0.15, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x64d2ff,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.z = -0.35;
    group.add(glow);

    // Label
    const labelGroup = new THREE.Group();
    const label = createPillLabel('Follow the arrow', COLORS.blue, { glyph: 'chevron', heightM: 0.09 });
    label.position.set(0, 0.15, -0.3);
    labelGroup.add(label);
    group.add(labelGroup);

    return group;
  }

  setTarget(worldPosition) {
    this.targetPosition.copy(worldPosition);
    this.arrow.visible = true;
    this.isVisible = true;
  }

  hide() {
    this.arrow.visible = false;
    this.isVisible = false;
  }

  update(dt) {
    if (!this.isVisible) return;

    // Get the target in the rig's local space so the arrow can point at it
    const worldTarget = this.targetPosition.clone();
    const arrowWorldPos = new THREE.Vector3();
    this.arrow.getWorldPosition(arrowWorldPos);

    // Make the arrow look at the target
    const direction = worldTarget.clone().sub(arrowWorldPos).normalize();
    const lookTarget = arrowWorldPos.clone().add(direction);

    // Convert lookTarget to rig-local space
    const rigInverse = new THREE.Matrix4();
    rigInverse.copy(this.cameraRig.matrixWorld).invert();
    const localTarget = lookTarget.clone().applyMatrix4(rigInverse);

    // The arrow should only rotate in the XZ plane relative to the rig
    const localArrowPos = this.arrow.position.clone();
    const dx = localTarget.x - localArrowPos.x;
    const dz = localTarget.z - localArrowPos.z;
    const angle = Math.atan2(dx, dz);
    this.arrow.rotation.y = angle + Math.PI;

    // Bobbing animation
    const time = performance.now() * CONFIG.ARROW_BOB_SPEED;
    this.arrow.position.y = 1.0 + Math.sin(time) * CONFIG.ARROW_BOB_AMPLITUDE;

    // Pulsing glow
    const glow = this.arrow.children[2]; // glow mesh
    if (glow && glow.material) {
      glow.material.opacity = 0.1 + Math.sin(time * 2) * 0.08;
    }
  }

  updateForState(state, positions) {
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
