import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class FailScreen {
  constructor(scene, cameraRig, stateManager, audioManager) {
    this.scene = scene;
    this.cameraRig = cameraRig;
    this.stateManager = stateManager;
    this.audioManager = audioManager;

    this.isActive = false;
    this.timer = 0;

    this.group = new THREE.Group();
    this.group.visible = false;
    this.scene.add(this.group);

    // Canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = 800;
    this.canvas.height = 500;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);

    // Panel
    const geo = new THREE.PlaneGeometry(1.6, 1.0);
    const mat = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true });
    this.panel = new THREE.Mesh(geo, mat);
    this.group.add(this.panel);

    // Red vignette backing
    const backGeo = new THREE.PlaneGeometry(1.64, 1.04);
    const backMat = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.3,
    });
    const back = new THREE.Mesh(backGeo, backMat);
    back.position.z = -0.01;
    this.group.add(back);

    // Continue button
    const btnGeo = new THREE.PlaneGeometry(0.5, 0.12);
    const btnMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
    });
    this.continueButton = new THREE.Mesh(btnGeo, btnMat);
    this.continueButton.position.set(0, -0.35, 0.01);
    this.group.add(this.continueButton);

    this._hoveredContinue = false;

    this.continueInteractable = {
      mesh: this.continueButton,
      isInteractable: false,
      onHoverEnter: () => { this._hoveredContinue = true; this._render(); },
      onHoverExit: () => { this._hoveredContinue = false; this._render(); },
      onSelect: () => { this._dismiss(); },
    };
  }

  getInteractable() {
    return this.continueInteractable;
  }

  show() {
    this.isActive = true;
    this.group.visible = true;
    this.continueInteractable.isInteractable = true;
    this.timer = 0;

    this.audioManager.playFail();

    // Position in front of player
    const camWorldPos = new THREE.Vector3();
    this.cameraRig.getWorldPosition(camWorldPos);
    const camDir = new THREE.Vector3(0, 0, -1);
    camDir.applyQuaternion(this.cameraRig.quaternion);

    this.group.position.set(
      camWorldPos.x + camDir.x * 2,
      camWorldPos.y + 1.5,
      camWorldPos.z + camDir.z * 2
    );
    this.group.lookAt(camWorldPos.x, this.group.position.y, camWorldPos.z);

    this._render();
  }

  _dismiss() {
    this.isActive = false;
    this.group.visible = false;
    this.continueInteractable.isInteractable = false;
    this._hoveredContinue = false;

    // Reset state to continue from where player was
    this.stateManager.resetAfterFail();
  }

  _render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Dark red background
    ctx.fillStyle = 'rgba(40, 0, 0, 0.95)';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 16);
    ctx.fill();

    // Red border
    ctx.strokeStyle = '#ff3333';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(8, 8, w - 16, h - 16, 12);
    ctx.stroke();

    // Warning icon
    ctx.fillStyle = '#ff3333';
    ctx.font = 'bold 60px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('DANGER', w / 2, 70);

    // Cause of death message
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Arial';
    ctx.fillText('You approached the victim without', w / 2, 140);
    ctx.fillText('securing the accident scene!', w / 2, 170);

    // Explanation
    ctx.fillStyle = '#ff9999';
    ctx.font = '20px Arial';
    ctx.fillText('Without the warning triangle in place,', w / 2, 220);
    ctx.fillText('oncoming traffic could cause a secondary', w / 2, 248);
    ctx.fillText('collision, endangering you and the victim.', w / 2, 276);

    // Learning point
    ctx.fillStyle = '#ff9800';
    ctx.font = 'bold 20px Arial';
    ctx.fillText('Always secure the scene FIRST!', w / 2, 330);

    // Continue button
    const btnW = 200;
    const btnH = 50;
    const btnX = (w - btnW) / 2;
    const btnY = 380;

    ctx.fillStyle = this._hoveredContinue ? '#ff4444' : 'rgba(255, 68, 68, 0.5)';
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 8);
    ctx.fill();

    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 8);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Arial';
    ctx.fillText('Try Again', w / 2, btnY + 32);

    this.texture.needsUpdate = true;
  }

  update(dt) {
    if (!this.isActive) return;

    this.timer += dt;
    const camWorldPos = new THREE.Vector3();
    this.cameraRig.getWorldPosition(camWorldPos);
    this.group.lookAt(camWorldPos.x, this.group.position.y, camWorldPos.z);

    // Pulsing red border effect
    const back = this.group.children[1];
    if (back && back.material) {
      back.material.opacity = 0.2 + Math.sin(this.timer * 3) * 0.1;
    }
  }
}
