import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class HUDOverlay {
  constructor(scene, cameraRig, stateManager) {
    this.scene = scene;
    this.cameraRig = cameraRig;
    this.stateManager = stateManager;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    // Canvas for HUD
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 128;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.needsUpdate = true;

    // HUD panel
    const geo = new THREE.PlaneGeometry(0.8, 0.2);
    const mat = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false,
    });
    this.panel = new THREE.Mesh(geo, mat);
    this.group.add(this.panel);

    this.currentText = '';
    this.successMessage = null;
    this.successTimer = 0;
    this.failMessage = null;
    this.failTimer = 0;

    // Listen for state changes
    this.stateManager.on((oldState, newState) => {
      this._onStateChange(oldState, newState);
    });
  }

  _onStateChange(oldState, newState) {
    this.currentText = CONFIG.TASK_TEXT[newState] || '';

    if (newState === CONFIG.STATES.FAIL) {
      this.failMessage = 'DANGER! Oncoming traffic risk!\nAlways secure the scene first!';
      this.failTimer = 5;
    } else if ([
      CONFIG.STATES.TRIANGLE_PICKUP,
      CONFIG.STATES.TRIANGLE_PLACED,
      CONFIG.STATES.CALL_COMPLETE,
      CONFIG.STATES.COMPLETE,
    ].includes(newState)) {
      const msgs = {
        [CONFIG.STATES.TRIANGLE_PICKUP]: 'Vest equipped! You are now visible.',
        [CONFIG.STATES.TRIANGLE_PLACED]: 'Scene secured! Traffic is warned.',
        [CONFIG.STATES.CALL_COMPLETE]: 'Help is on the way!',
        [CONFIG.STATES.COMPLETE]: 'Excellent work! Training complete!',
      };
      this.successMessage = msgs[newState] || 'Step completed!';
      this.successTimer = 3;
    }

    this._render();
  }

  showMessage(text, duration = 3, isSuccess = true) {
    if (isSuccess) {
      this.successMessage = text;
      this.successTimer = duration;
    } else {
      this.failMessage = text;
      this.failTimer = duration;
    }
    this._render();
  }

  _render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 12);
    ctx.fill();

    // Task text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lines = this.currentText.split('\n');
    let y = h / 2 - (lines.length - 1) * 12;
    for (const line of lines) {
      ctx.fillText(line, w / 2, y);
      y += 24;
    }

    // Timer display
    const elapsed = this.stateManager.getTotalDuration();
    if (elapsed > 0 && !this.stateManager.isState(CONFIG.STATES.INTRO, CONFIG.STATES.COMPLETE)) {
      const mins = Math.floor(elapsed / 60);
      const secs = Math.floor(elapsed % 60);
      const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      ctx.fillStyle = '#888888';
      ctx.font = '16px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(timeStr, w - 20, 20);
    }

    this.texture.needsUpdate = true;
  }

  update(dt) {
    // Position in front of player, slightly below eye level
    const camWorldPos = new THREE.Vector3();
    const camWorldDir = new THREE.Vector3(0, 0, -1);
    this.cameraRig.getWorldPosition(camWorldPos);
    camWorldDir.applyQuaternion(this.cameraRig.quaternion);

    this.group.position.set(
      camWorldPos.x + camWorldDir.x * 2,
      camWorldPos.y + 2.2,
      camWorldPos.z + camWorldDir.z * 2
    );
    this.group.lookAt(camWorldPos.x, this.group.position.y, camWorldPos.z);

    // Update success message timer
    if (this.successTimer > 0) {
      this.successTimer -= dt;
      if (this.successTimer <= 0) {
        this.successMessage = null;
        this._render();
      }
    }

    // Update fail message timer
    if (this.failTimer > 0) {
      this.failTimer -= dt;
      if (this.failTimer <= 0) {
        this.failMessage = null;
        this._render();
      }
    }

    // Re-render every second for timer update
    this._renderTimer();
  }

  _renderTimer() {
    if (this.stateManager.isState(CONFIG.STATES.INTRO, CONFIG.STATES.COMPLETE)) return;

    const elapsed = this.stateManager.getTotalDuration();
    if (elapsed <= 0) return;

    // Only update the timer portion
    const ctx = this.ctx;
    const w = this.canvas.width;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(w - 100, 5, 95, 25);

    const mins = Math.floor(elapsed / 60);
    const secs = Math.floor(elapsed % 60);
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '16px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(timeStr, w - 15, 10);

    this.texture.needsUpdate = true;
  }
}
