import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class WarningTriangle {
  constructor(scene, stateManager, audioManager, cameraRig) {
    this.scene = scene;
    this.stateManager = stateManager;
    this.audioManager = audioManager;
    this.cameraRig = cameraRig;
    this.isInteractable = true;
    this.isPickedUp = false;
    this.isPlaced = false;

    this.mesh = this._build();
    const pos = CONFIG.TRIANGLE_POS;
    this.mesh.position.set(pos.x, pos.y, pos.z);
    this.scene.add(this.mesh);

    // Placement zone marker
    this.placementZone = this._createPlacementZone();
    this.scene.add(this.placementZone);
    this.placementZone.visible = false;

    // Placed triangle (separate mesh)
    this.placedMesh = this._buildPlacedTriangle();
    this.scene.add(this.placedMesh);
    this.placedMesh.visible = false;
  }

  _build() {
    const group = new THREE.Group();

    // Triangle shape
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.4);
    shape.lineTo(-0.3, -0.15);
    shape.lineTo(0.3, -0.15);
    shape.closePath();

    // Inner hole
    const hole = new THREE.Path();
    hole.moveTo(0, 0.25);
    hole.lineTo(-0.18, -0.05);
    hole.lineTo(0.18, -0.05);
    hole.closePath();
    shape.holes.push(hole);

    const extrudeSettings = { depth: 0.03, bevelEnabled: false };
    const triGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    const triMat = new THREE.MeshStandardMaterial({
      color: 0xff4400,
      emissive: 0x000000,
      roughness: 0.4,
    });
    const triangle = new THREE.Mesh(triGeo, triMat);
    triangle.castShadow = true;
    group.add(triangle);
    this._mainMat = triMat;

    // Reflective border
    const borderMat = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      emissive: 0xff2200,
      emissiveIntensity: 0.3,
      metalness: 0.5,
    });

    // Label
    const label = this._createLabel('Warning Triangle');
    label.position.y = 0.6;
    group.add(label);

    // Interaction ring
    const ringGeo = new THREE.RingGeometry(0.35, 0.38, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.z = 0.02;
    group.add(ring);
    this._ring = ring;

    return group;
  }

  _buildPlacedTriangle() {
    const group = new THREE.Group();

    // Bigger triangle for placed version
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.6);
    shape.lineTo(-0.45, -0.2);
    shape.lineTo(0.45, -0.2);
    shape.closePath();

    const hole = new THREE.Path();
    hole.moveTo(0, 0.4);
    hole.lineTo(-0.28, -0.05);
    hole.lineTo(0.28, -0.05);
    hole.closePath();
    shape.holes.push(hole);

    const extrudeSettings = { depth: 0.04, bevelEnabled: false };
    const triGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    const triMat = new THREE.MeshStandardMaterial({
      color: 0xff4400,
      emissive: 0xff2200,
      emissiveIntensity: 0.4,
      roughness: 0.3,
    });
    const triangle = new THREE.Mesh(triGeo, triMat);
    triangle.castShadow = true;
    group.add(triangle);

    // Stand legs
    const legMat = new THREE.MeshStandardMaterial({ color: 0xff4400 });
    for (const side of [-1, 1]) {
      const legGeo = new THREE.BoxGeometry(0.02, 0.3, 0.02);
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(side * 0.25, -0.35, 0.1);
      leg.rotation.x = 0.3;
      leg.rotation.z = side * 0.15;
      group.add(leg);
    }

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
    ctx.fillStyle = '#ff6600';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const geo = new THREE.PlaneGeometry(0.5, 0.125);
    const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    return new THREE.Mesh(geo, mat);
  }

  _createPlacementZone() {
    const group = new THREE.Group();

    // Ring on ground
    const ringGeo = new THREE.RingGeometry(
      CONFIG.TRIANGLE_PLACE_TOLERANCE - 0.5,
      CONFIG.TRIANGLE_PLACE_TOLERANCE,
      32
    );
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    group.add(ring);

    // Cross marker in center
    const crossMat = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.5,
    });
    const crossGeo1 = new THREE.PlaneGeometry(0.5, 0.08);
    const cross1 = new THREE.Mesh(crossGeo1, crossMat);
    cross1.rotation.x = -Math.PI / 2;
    cross1.position.y = 0.03;
    group.add(cross1);

    const cross2 = new THREE.Mesh(crossGeo1, crossMat);
    cross2.rotation.x = -Math.PI / 2;
    cross2.rotation.z = Math.PI / 2;
    cross2.position.y = 0.03;
    group.add(cross2);

    // Label
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, 512, 64);
    ctx.fillStyle = '#ff6600';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Place warning triangle here (~50m behind collision)', 256, 32);

    const labelTexture = new THREE.CanvasTexture(canvas);
    const labelGeo = new THREE.PlaneGeometry(3, 0.375);
    const labelMat = new THREE.MeshBasicMaterial({ map: labelTexture, transparent: true });
    const label = new THREE.Mesh(labelGeo, labelMat);
    label.position.y = 1.5;
    label.rotation.y = Math.PI; // Face toward player approach direction
    group.add(label);

    // Position the zone behind the collision
    group.position.set(
      CONFIG.COLLISION_POS.x,
      0,
      CONFIG.COLLISION_POS.z + CONFIG.TRIANGLE_PLACE_DISTANCE
    );

    return group;
  }

  onHoverEnter() {
    if (!this.isInteractable) return;
    this._mainMat.emissive.setHex(0x442200);
    this._ring.material.opacity = 0.8;
  }

  onHoverExit() {
    if (!this._mainMat) return;
    this._mainMat.emissive.setHex(0x000000);
    if (this._ring) this._ring.material.opacity = 0.4;
  }

  onSelect() {
    if (!this.isInteractable) return;

    if (this.stateManager.isState(CONFIG.STATES.TRIANGLE_PICKUP) && !this.isPickedUp) {
      // Pick up the triangle
      this.isPickedUp = true;
      this.mesh.visible = false;
      this.placementZone.visible = true;
      this.audioManager.playClick();
      this.stateManager.transition(CONFIG.STATES.TRIANGLE_HELD);
    }
  }

  // Check if player is in the placement zone and try to place
  tryPlace(playerPosition) {
    if (!this.isPickedUp || this.isPlaced) return false;
    if (!this.stateManager.isState(CONFIG.STATES.TRIANGLE_HELD)) return false;

    const zonePos = this.placementZone.position;
    const dist = new THREE.Vector2(
      playerPosition.x - zonePos.x,
      playerPosition.z - zonePos.z
    ).length();

    if (dist <= CONFIG.TRIANGLE_PLACE_TOLERANCE) {
      this.isPlaced = true;
      this.isInteractable = false;
      this.placementZone.visible = false;

      // Show placed triangle
      this.placedMesh.position.copy(zonePos);
      this.placedMesh.position.y = 0;
      this.placedMesh.visible = true;

      this.audioManager.playSuccess();
      this.stateManager.transition(CONFIG.STATES.TRIANGLE_PLACED);
      return true;
    }
    return false;
  }

  update(dt, elapsed) {
    if (this.isPickedUp && !this.isPlaced) {
      // Show placement zone with pulsing
      const ring = this.placementZone.children[0];
      if (ring && ring.material) {
        ring.material.opacity = 0.2 + Math.sin(elapsed * 3) * 0.15;
      }
    }

    if (!this.isPickedUp) {
      // Floating animation
      this.mesh.position.y = CONFIG.TRIANGLE_POS.y + Math.sin(elapsed * 2) * 0.05;
      this.mesh.rotation.y = Math.sin(elapsed * 0.5) * 0.2;

      if (this.stateManager.isState(CONFIG.STATES.TRIANGLE_PICKUP)) {
        this._ring.material.opacity = 0.3 + Math.sin(elapsed * 3) * 0.2;
      }
    }
  }
}
