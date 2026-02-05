import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

export class InputManager {
  constructor(sceneManager) {
    this.renderer = sceneManager.renderer;
    this.camera = sceneManager.camera;
    this.cameraRig = sceneManager.cameraRig;
    this.scene = sceneManager.scene;
    this.isVR = false;

    // Event callbacks
    this._selectListeners = [];
    this._squeezeListeners = [];

    // Desktop raycaster
    this.mouse = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();

    // VR controllers
    this.controllers = [];
    this.controllerGrips = [];
    this.controllerRays = [];

    this._setupVRControllers();
    this._setupDesktopInput();
    this._setupXRSessionEvents();
  }

  _setupXRSessionEvents() {
    this.renderer.xr.addEventListener('sessionstart', () => {
      this.isVR = true;
    });
    this.renderer.xr.addEventListener('sessionend', () => {
      this.isVR = false;
    });
  }

  _setupVRControllers() {
    const controllerModelFactory = new XRControllerModelFactory();

    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      this.cameraRig.add(controller);

      // Ray visual
      const rayGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -5),
      ]);
      const rayMat = new THREE.LineBasicMaterial({
        color: 0x00aaff,
        transparent: true,
        opacity: 0.6,
      });
      const rayLine = new THREE.Line(rayGeom, rayMat);
      rayLine.visible = false;
      controller.add(rayLine);

      controller.addEventListener('selectstart', (e) => {
        this._fireSelect(controller, i);
      });

      controller.addEventListener('squeezestart', (e) => {
        this._fireSqueeze(controller, i);
      });

      this.controllers.push(controller);
      this.controllerRays.push(rayLine);

      // Grip model
      const grip = this.renderer.xr.getControllerGrip(i);
      grip.add(controllerModelFactory.createControllerModel(grip));
      this.cameraRig.add(grip);
      this.controllerGrips.push(grip);
    }
  }

  _setupDesktopInput() {
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    window.addEventListener('click', (e) => {
      if (this.isVR) return;
      this._fireSelect(null, -1);
    });

    // WASD movement state
    this.keys = { w: false, a: false, s: false, d: false };
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      if (this.keys.hasOwnProperty(key)) this.keys[key] = true;
    });
    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (this.keys.hasOwnProperty(key)) this.keys[key] = false;
    });

    // Mouse drag for camera rotation (desktop)
    this._isDragging = false;
    this._prevMouse = { x: 0, y: 0 };
    this._cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');

    window.addEventListener('mousedown', (e) => {
      if (e.button === 2) { // right click
        this._isDragging = true;
        this._prevMouse.x = e.clientX;
        this._prevMouse.y = e.clientY;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) this._isDragging = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this._isDragging || this.isVR) return;
      const dx = e.clientX - this._prevMouse.x;
      const dy = e.clientY - this._prevMouse.y;
      this._prevMouse.x = e.clientX;
      this._prevMouse.y = e.clientY;

      this._cameraEuler.setFromQuaternion(this.camera.quaternion);
      this._cameraEuler.y -= dx * 0.003;
      this._cameraEuler.x -= dy * 0.003;
      this._cameraEuler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this._cameraEuler.x));
      this.camera.quaternion.setFromEuler(this._cameraEuler);
    });

    // Disable context menu for right-click drag
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  onSelect(callback) {
    this._selectListeners.push(callback);
  }

  onSqueeze(callback) {
    this._squeezeListeners.push(callback);
  }

  _fireSelect(controller, index) {
    for (const cb of this._selectListeners) {
      cb(controller, index);
    }
  }

  _fireSqueeze(controller, index) {
    for (const cb of this._squeezeListeners) {
      cb(controller, index);
    }
  }

  getRay() {
    if (this.isVR) {
      // Use the first controller that exists (index 0 = right hand typically)
      const controller = this.controllers[0];
      if (controller) {
        const tempMatrix = new THREE.Matrix4();
        tempMatrix.identity().extractRotation(controller.matrixWorld);
        const ray = new THREE.Raycaster();
        ray.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        ray.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
        return ray;
      }
    }
    // Desktop
    this.raycaster.setFromCamera(this.mouse, this.camera);
    return this.raycaster;
  }

  getIntersections(objects) {
    const ray = this.getRay();
    return ray.intersectObjects(objects, true);
  }

  update(dt) {
    // Show/hide VR controller rays
    for (const ray of this.controllerRays) {
      ray.visible = this.isVR;
    }

    // Desktop WASD movement
    if (!this.isVR) {
      const speed = 5 * dt;
      const direction = new THREE.Vector3();
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      forward.y = 0;
      forward.normalize();
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
      right.y = 0;
      right.normalize();

      if (this.keys.w) direction.add(forward);
      if (this.keys.s) direction.sub(forward);
      if (this.keys.d) direction.add(right);
      if (this.keys.a) direction.sub(right);

      if (direction.length() > 0) {
        direction.normalize().multiplyScalar(speed);
        this.cameraRig.position.add(direction);
      }
    }
  }
}
