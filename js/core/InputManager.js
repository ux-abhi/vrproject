import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

const SNAP_TURN = Math.PI / 6;   // 30 degrees per thumbstick flick
const KEY_TURN_SPEED = 1.8;      // rad/s for Q/E and arrow keys

export class InputManager {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.renderer = sceneManager.renderer;
    this.camera = sceneManager.camera;
    this.cameraRig = sceneManager.cameraRig;
    this.scene = sceneManager.scene;
    this.canvas = this.renderer.domElement;
    this.isVR = false;
    this.enabled = true;

    // Camera used for desktop pointing (swapped for the top-view camera)
    this.getPointerCamera = () => this.camera;

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
    this._snapReady = [true, true];

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

      // Ray visual (length is trimmed to whatever it hits)
      const rayGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1),
      ]);
      const rayMat = new THREE.LineBasicMaterial({
        color: 0x0a84ff,
        transparent: true,
        opacity: 0.7,
      });
      const rayLine = new THREE.Line(rayGeom, rayMat);
      rayLine.scale.z = 5;
      rayLine.visible = false;
      controller.add(rayLine);

      controller.addEventListener('selectstart', () => {
        if (this.enabled) this._fireSelect(controller, i);
      });

      // Grip = grab: same action as select on whatever this hand points at
      controller.addEventListener('squeezestart', () => {
        if (this.enabled) this._fireSqueeze(controller, i);
      });

      controller.addEventListener('connected', (e) => {
        controller.userData.inputSource = e.data;
      });
      controller.addEventListener('disconnected', () => {
        controller.userData.inputSource = null;
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

    // Only clicks on the 3D view count (not the start screen or HTML toolbar)
    this.canvas.addEventListener('click', () => {
      if (this.isVR || !this.enabled) return;
      if (this._dragMoved) return; // end of a look-drag, not a click
      this._fireSelect(null, -1);
    });

    // Movement / turning keys
    this.keys = { w: false, a: false, s: false, d: false, q: false, e: false };
    const keyMap = {
      w: 'w', a: 'a', s: 's', d: 'd', q: 'q', e: 'e',
      arrowup: 'w', arrowdown: 's', arrowleft: 'q', arrowright: 'e',
    };
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      const key = keyMap[e.key.toLowerCase()];
      if (key) {
        this.keys[key] = true;
        if (e.key.startsWith('Arrow')) e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      const key = keyMap[e.key.toLowerCase()];
      if (key) this.keys[key] = false;
    });
    window.addEventListener('blur', () => {
      for (const k in this.keys) this.keys[k] = false;
    });

    // Right-drag (or Alt + left-drag on a trackpad) to look around
    this._isDragging = false;
    this._dragMoved = false;
    this._prevMouse = { x: 0, y: 0 };
    this._cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2 || (e.button === 0 && e.altKey)) {
        this._isDragging = true;
        this._dragMoved = false;
        this._prevMouse.x = e.clientX;
        this._prevMouse.y = e.clientY;
      }
    });
    window.addEventListener('mouseup', () => {
      this._isDragging = false;
      setTimeout(() => { this._dragMoved = false; }, 0);
    });
    window.addEventListener('mousemove', (e) => {
      if (!this._isDragging || this.isVR) return;
      const dx = e.clientX - this._prevMouse.x;
      const dy = e.clientY - this._prevMouse.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) this._dragMoved = true;
      this._prevMouse.x = e.clientX;
      this._prevMouse.y = e.clientY;
      this._rotateView(-dx * 0.003, -dy * 0.003);
    });

    // Disable context menu for right-click drag
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _rotateView(dYaw, dPitch) {
    this._cameraEuler.setFromQuaternion(this.camera.quaternion);
    this._cameraEuler.y += dYaw;
    this._cameraEuler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this._cameraEuler.x + dPitch));
    this.camera.quaternion.setFromEuler(this._cameraEuler);
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

  // Ray for a given controller index (VR) or the mouse (desktop)
  getRay(index = 0) {
    if (this.isVR) {
      const controller = this.controllers[index];
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
    this.raycaster.setFromCamera(this.mouse, this.getPointerCamera());
    return this.raycaster;
  }

  getIntersections(objects) {
    const ray = this.getRay();
    return ray.intersectObjects(objects, true);
  }

  // Snap turn around the head so the player doesn't slide sideways
  _snapTurn(angle) {
    const head = new THREE.Vector3();
    this.camera.getWorldPosition(head);
    this.cameraRig.rotation.y += angle;
    this.cameraRig.updateMatrixWorld(true);
    const after = new THREE.Vector3();
    this.camera.getWorldPosition(after);
    this.cameraRig.position.x += head.x - after.x;
    this.cameraRig.position.z += head.z - after.z;
  }

  update(dt) {
    // Show/hide VR controller rays
    for (const ray of this.controllerRays) {
      ray.visible = this.isVR;
    }

    if (this.isVR) {
      // Thumbstick left/right = snap turn (look direction)
      this.controllers.forEach((controller, i) => {
        const gp = controller.userData.inputSource && controller.userData.inputSource.gamepad;
        if (!gp || gp.axes.length < 4) return;
        const x = gp.axes[2];
        if (Math.abs(x) > 0.7 && this._snapReady[i]) {
          this._snapTurn(x > 0 ? -SNAP_TURN : SNAP_TURN);
          this._snapReady[i] = false;
        } else if (Math.abs(x) < 0.3) {
          this._snapReady[i] = true;
        }
      });
      return;
    }

    if (!this.enabled) return;

    // Desktop keyboard turning
    const turn = (this.keys.q ? 1 : 0) - (this.keys.e ? 1 : 0);
    if (turn) this._rotateView(turn * KEY_TURN_SPEED * dt, 0);

    // Desktop WASD / arrow movement
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
