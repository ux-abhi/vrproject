import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class Locomotion {
  constructor(sceneManager, inputManager, navMeshObjects) {
    this.cameraRig = sceneManager.cameraRig;
    this.camera = sceneManager.camera;
    this.scene = sceneManager.scene;
    this.inputManager = inputManager;
    this.navMeshObjects = navMeshObjects;

    this.moveTarget = null;
    this.isMoving = false;

    // Teleport marker
    this.teleportMarker = this._createTeleportMarker();
    this.scene.add(this.teleportMarker);
    this.teleportMarker.visible = false;

    // Teleport arc
    this.arcLine = this._createArcLine();
    this.scene.add(this.arcLine);
    this.arcLine.visible = false;

    // For desktop click-to-move
    this._setupDesktopClickMove();
  }

  _createTeleportMarker() {
    const group = new THREE.Group();

    // Ring
    const ringGeo = new THREE.RingGeometry(0.3, 0.4, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x0a84ff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    group.add(ring);

    // Inner circle
    const innerGeo = new THREE.CircleGeometry(0.25, 32);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x0a84ff,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.02;
    group.add(inner);

    return group;
  }

  _createArcLine() {
    const points = [];
    for (let i = 0; i < 30; i++) {
      points.push(new THREE.Vector3());
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: 0x0a84ff,
      transparent: true,
      opacity: 0.5,
    });
    return new THREE.Line(geo, mat);
  }

  _setupDesktopClickMove() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    window.addEventListener('click', (e) => {
      if (this.inputManager.isVR) return;

      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, this.camera);
      const intersects = raycaster.intersectObjects(this.navMeshObjects, false);

      if (intersects.length > 0) {
        const point = intersects[0].point;
        // Only move to ground-level points
        if (Math.abs(point.y) < 1) {
          this.moveTarget = new THREE.Vector3(point.x, 0, point.z);
          this.isMoving = true;
        }
      }
    });
  }

  update(dt) {
    // Smooth movement to target (desktop click-to-move)
    if (this.isMoving && this.moveTarget) {
      const currentPos = this.cameraRig.position;
      const dist = currentPos.distanceTo(this.moveTarget);

      if (dist > 0.1) {
        currentPos.lerp(this.moveTarget, Math.min(dt * 4.0, 1));
      } else {
        currentPos.copy(this.moveTarget);
        this.isMoving = false;
        this.moveTarget = null;
      }
    }

    // VR teleportation handling
    if (this.inputManager.isVR) {
      this._updateVRTeleport();
    }

    // Pulse the teleport marker
    if (this.teleportMarker.visible) {
      const scale = 1 + Math.sin(performance.now() * 0.005) * 0.1;
      this.teleportMarker.scale.set(scale, scale, scale);
    }
  }

  _updateVRTeleport() {
    // Use the right controller (index 0) for teleportation
    const controller = this.inputManager.controllers[0];
    if (!controller) return;

    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);

    const origin = new THREE.Vector3();
    origin.setFromMatrixPosition(controller.matrixWorld);

    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyMatrix4(tempMatrix);

    // Simple parabolic arc calculation
    const raycaster = new THREE.Raycaster(origin, direction);
    const intersects = raycaster.intersectObjects(this.navMeshObjects, false);

    if (intersects.length > 0 && intersects[0].distance < CONFIG.MAX_TELEPORT_DISTANCE) {
      const point = intersects[0].point;
      this.teleportMarker.position.copy(point);
      this.teleportMarker.position.y = 0.02;
      this.teleportMarker.visible = true;
      this._teleportTarget = point.clone();
      this._teleportTarget.y = 0;
    } else {
      this.teleportMarker.visible = false;
      this._teleportTarget = null;
    }
  }

  // Called by InputManager on select event
  executeTeleport() {
    if (this._teleportTarget && this.inputManager.isVR) {
      // Offset by the camera's position within the rig
      const cameraOffset = new THREE.Vector3();
      cameraOffset.copy(this.camera.position);
      cameraOffset.y = 0;
      cameraOffset.applyQuaternion(this.cameraRig.quaternion);

      this.cameraRig.position.copy(this._teleportTarget).sub(cameraOffset);
      this.teleportMarker.visible = false;
      this._teleportTarget = null;
      return true;
    }
    return false;
  }
}
