import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { COLORS, createPillLabel } from '../ui/theme.js';

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

    const extrudeSettings = {
      depth: 0.02, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2,
    };
    const triGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    const triMat = new THREE.MeshStandardMaterial({
      color: 0xd81e1e,
      emissive: 0x000000,
      roughness: 0.25,
      metalness: 0.3,
    });
    const triangle = new THREE.Mesh(triGeo, triMat);
    triangle.castShadow = true;
    group.add(triangle);
    this._mainMat = triMat;

    group.add(this._buildFluorescentCore(0.4, 0.3, 0.15, 0.028));

    // Label
    const label = this._createLabel('Warning Triangle');
    label.position.y = 0.6;
    group.add(label);

    // Interaction ring
    const ringGeo = new THREE.RingGeometry(0.35, 0.38, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff9f0a,
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

    const extrudeSettings = {
      depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2,
    };
    const triGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    const triMat = new THREE.MeshStandardMaterial({
      color: 0xe02020,
      emissive: 0xff1a00,
      emissiveIntensity: 0.35,
      roughness: 0.25,
      metalness: 0.3,
    });

    // Raised so the triangle stands on its fold-out base rather than in the road
    const body = new THREE.Group();
    body.position.y = 0.26;
    body.rotation.x = -0.08;
    const triangle = new THREE.Mesh(triGeo, triMat);
    triangle.castShadow = true;
    body.add(triangle);
    body.add(this._buildFluorescentCore(0.6, 0.45, 0.2, 0.038));
    group.add(body);

    // Fold-out stand: grey base bar with two splayed feet
    const standMat = new THREE.MeshStandardMaterial({ color: 0x2c2c2e, metalness: 0.6, roughness: 0.4 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.025, 0.05), standMat);
    base.position.set(0, 0.03, 0.02);
    base.castShadow = true;
    group.add(base);
    for (const side of [-1, 1]) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.32), standMat);
      foot.position.set(side * 0.3, 0.012, -0.1);
      foot.rotation.y = side * 0.35;
      foot.castShadow = true;
      group.add(foot);
    }

    return group;
  }

  // Fluorescent orange-red inner band, as on EU-approved triangles
  _buildFluorescentCore(top, halfBase, bottom, z) {
    const outer = new THREE.Shape();
    outer.moveTo(0, top * 0.8);
    outer.lineTo(-halfBase * 0.78, -bottom * 0.55);
    outer.lineTo(halfBase * 0.78, -bottom * 0.55);
    outer.closePath();
    const inner = new THREE.Path();
    inner.moveTo(0, top * 0.62);
    inner.lineTo(-halfBase * 0.6, -bottom * 0.25);
    inner.lineTo(halfBase * 0.6, -bottom * 0.25);
    inner.closePath();
    outer.holes.push(inner);

    const mat = new THREE.MeshStandardMaterial({
      color: 0xff5a1f,
      emissive: 0xff3300,
      emissiveIntensity: 0.25,
      roughness: 0.8,
    });
    const core = new THREE.Mesh(new THREE.ShapeGeometry(outer), mat);
    core.position.z = z;
    return core;
  }

  _createLabel(text) {
    return createPillLabel(text, COLORS.orange, { glyph: 'warning', heightM: 0.1 });
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
      color: 0xff9f0a,
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
      color: 0xff9f0a,
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
    const label = createPillLabel('Place warning triangle here  ·  ~50 m behind', COLORS.orange, {
      glyph: 'warning', heightM: 0.34,
    });
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
