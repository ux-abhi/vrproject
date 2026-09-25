import * as THREE from 'three';

// Two ways to see the scene:
//  - 'immersive': first person from the player's eyes (always used in VR)
//  - 'top': an elevated camera that follows a visible player character
// Also owns UI placement so HUD and panels stay in front of whoever is viewing.
export class ViewManager {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.renderer = sceneManager.renderer;
    this.camera = sceneManager.camera;
    this.cameraRig = sceneManager.cameraRig;
    this.mode = 'immersive';
    this._listeners = [];

    this.topCamera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
    this.topCamera.position.set(0, 14, 8);
    sceneManager.scene.add(this.topCamera);
    this.topDistance = 1; // zoom multiplier (mouse wheel)
    this._topTarget = new THREE.Vector3();
    this._topInitialised = false;

    window.addEventListener('resize', () => {
      this.topCamera.aspect = window.innerWidth / window.innerHeight;
      this.topCamera.updateProjectionMatrix();
    });

    window.addEventListener('wheel', (e) => {
      if (this.mode !== 'top') return;
      this.topDistance = THREE.MathUtils.clamp(this.topDistance + Math.sign(e.deltaY) * 0.1, 0.5, 1.8);
    }, { passive: true });

    // Headsets are always first person
    this.renderer.xr.addEventListener('sessionstart', () => this.setMode('immersive'));

    // Scratch objects
    this._head = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._target = new THREE.Vector3();
    this._quat = new THREE.Quaternion();
    this._yAxis = new THREE.Vector3(0, 1, 0);
  }

  get isTop() {
    return this.mode === 'top' && !this.renderer.xr.isPresenting;
  }

  get activeCamera() {
    return this.isTop ? this.topCamera : this.camera;
  }

  onChange(cb) {
    this._listeners.push(cb);
  }

  setMode(mode) {
    if (mode === this.mode) return;
    if (mode === 'top' && this.renderer.xr.isPresenting) return;
    this.mode = mode;
    this._topInitialised = false;
    for (const cb of this._listeners) cb(mode);
  }

  toggle() {
    this.setMode(this.mode === 'top' ? 'immersive' : 'top');
  }

  // Player's eye position in world space (head in VR, rig + eye height on desktop)
  getHeadPosition(out = new THREE.Vector3()) {
    return this.camera.getWorldPosition(out);
  }

  // Heading of the player's view on the ground plane
  getYaw() {
    this.camera.getWorldDirection(this._fwd);
    return Math.atan2(-this._fwd.x, -this._fwd.z);
  }

  update(dt, avatarPosition) {
    if (!this.isTop) return;

    // Chase camera: above and behind the character, turning with the player's heading
    const yaw = this.getYaw();
    const back = 7.5 * this.topDistance;
    const up = 12 * this.topDistance;
    this._target.set(
      avatarPosition.x + Math.sin(yaw) * back,
      up,
      avatarPosition.z + Math.cos(yaw) * back
    );
    const k = this._topInitialised ? 1 - Math.exp(-dt * 6) : 1;
    this.topCamera.position.lerp(this._target, k);

    this._topTarget.lerp(
      this._head.set(avatarPosition.x - Math.sin(yaw) * 2.5, 0, avatarPosition.z - Math.cos(yaw) * 2.5),
      k
    );
    this.topCamera.lookAt(this._topTarget);
    this.topCamera.updateMatrixWorld();
    this._topInitialised = true;
  }

  // Keeps a UI group in front of the viewer.
  // Immersive: tag-along that only re-centres after the head turns ~30 degrees,
  // so panels stay still enough to point at. Top view: fixed to the screen.
  placeUI(object, { distance = 2, height = 0, dt = 0, snap = false } = {}) {
    const ud = object.userData;

    if (this.isTop) {
      const cam = this.topCamera;
      cam.getWorldDirection(this._fwd);
      this._up.set(0, 1, 0).applyQuaternion(cam.quaternion);
      object.position.copy(cam.position)
        .addScaledVector(this._fwd, distance)
        .addScaledVector(this._up, height);
      object.quaternion.copy(cam.quaternion);
      ud.anchorYaw = undefined;
      return;
    }

    const yaw = this.getYaw();
    if (snap || ud.anchorYaw === undefined) {
      ud.anchorYaw = yaw;
      snap = true;
    } else {
      let delta = yaw - ud.anchorYaw;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      if (Math.abs(delta) > 0.52) ud.recentre = true;
      if (ud.recentre) {
        ud.anchorYaw += delta * (1 - Math.exp(-dt * 5));
        if (Math.abs(delta) < 0.03) ud.recentre = false;
      }
    }

    this.getHeadPosition(this._head);
    this._target.set(
      this._head.x - Math.sin(ud.anchorYaw) * distance,
      this._head.y + height,
      this._head.z - Math.cos(ud.anchorYaw) * distance
    );
    this._quat.setFromAxisAngle(this._yAxis, ud.anchorYaw);

    if (snap) {
      object.position.copy(this._target);
      object.quaternion.copy(this._quat);
    } else {
      const k = 1 - Math.exp(-dt * 12);
      object.position.lerp(this._target, k);
      object.quaternion.slerp(this._quat, k);
    }
  }
}
