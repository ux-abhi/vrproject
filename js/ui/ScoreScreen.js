import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class ScoreScreen {
  constructor(scene, cameraRig, stateManager, scoringSystem) {
    this.scene = scene;
    this.cameraRig = cameraRig;
    this.stateManager = stateManager;
    this.scoringSystem = scoringSystem;

    this.group = new THREE.Group();
    this.group.visible = false;
    this.scene.add(this.group);

    // Canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = 800;
    this.canvas.height = 900;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);

    // Panel
    const geo = new THREE.PlaneGeometry(1.6, 1.8);
    const mat = new THREE.MeshBasicMaterial({ map: this.texture, transparent: true });
    this.panel = new THREE.Mesh(geo, mat);
    this.group.add(this.panel);

    // Backing
    const backGeo = new THREE.PlaneGeometry(1.64, 1.84);
    const backMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 });
    const back = new THREE.Mesh(backGeo, backMat);
    back.position.z = -0.01;
    this.group.add(back);

    // Retry button
    const retryGeo = new THREE.PlaneGeometry(0.5, 0.12);
    const retryMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
    });
    this.retryButton = new THREE.Mesh(retryGeo, retryMat);
    this.retryButton.position.set(0, -0.75, 0.01);
    this.group.add(this.retryButton);

    this.retryInteractable = {
      mesh: this.retryButton,
      isInteractable: false,
      onHoverEnter: () => { this._hoveredRetry = true; this._render(); },
      onHoverExit: () => { this._hoveredRetry = false; this._render(); },
      onSelect: () => { window.location.reload(); },
    };
    this._hoveredRetry = false;
  }

  getInteractable() {
    return this.retryInteractable;
  }

  show() {
    this.group.visible = true;
    this.retryInteractable.isInteractable = true;

    // Position in front of player
    const camWorldPos = new THREE.Vector3();
    this.cameraRig.getWorldPosition(camWorldPos);
    const camDir = new THREE.Vector3(0, 0, -1);
    camDir.applyQuaternion(this.cameraRig.quaternion);

    this.group.position.set(
      camWorldPos.x + camDir.x * 2.5,
      camWorldPos.y + 1.5,
      camWorldPos.z + camDir.z * 2.5
    );
    this.group.lookAt(camWorldPos.x, this.group.position.y, camWorldPos.z);

    this._render();
  }

  _render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const results = this.scoringSystem.getResults();

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = 'rgba(10, 15, 30, 0.95)';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 20);
    ctx.fill();

    // Border
    ctx.strokeStyle = results.gradeColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(8, 8, w - 16, h - 16, 16);
    ctx.stroke();

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Training Complete', w / 2, 60);

    // Decorative line
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(100, 85);
    ctx.lineTo(w - 100, 85);
    ctx.stroke();

    // Grade circle
    ctx.beginPath();
    ctx.arc(w / 2, 170, 60, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fill();
    ctx.strokeStyle = results.gradeColor;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = results.gradeColor;
    ctx.font = 'bold 70px Arial';
    ctx.fillText(results.grade, w / 2, 190);

    // Stats
    const stats = [
      { label: 'Total Time', value: results.totalTime, icon: '' },
      { label: '112 Call Duration (TTC)', value: results.callDuration, icon: '' },
      { label: 'Failed Attempts', value: results.failCount.toString(), icon: '' },
      { label: 'Steps Completed', value: `${results.stepsCompleted} / 8`, icon: '' },
    ];

    let y = 290;
    for (const stat of stats) {
      // Stat background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.beginPath();
      ctx.roundRect(60, y - 20, w - 120, 55, 8);
      ctx.fill();

      // Label
      ctx.fillStyle = '#999999';
      ctx.font = '20px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(stat.label, 80, y + 10);

      // Value
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(stat.value, w - 80, y + 12);

      y += 70;
    }

    // Rating description
    y += 20;
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';

    const descriptions = {
      'A': 'Excellent! You followed the Chain of Rescue perfectly.',
      'B': 'Good performance. Practice will improve your response time.',
      'C': 'You completed the training but there is room for improvement.',
    };
    ctx.fillText(descriptions[results.grade] || '', w / 2, y);

    // Key learning point
    y += 50;
    ctx.fillStyle = '#ff9800';
    ctx.font = 'bold 18px Arial';
    ctx.fillText('Remember: The 112 call is the "A and O" of rescue!', w / 2, y);

    // Retry button
    y += 60;
    const btnW = 200;
    const btnH = 50;
    const btnX = (w - btnW) / 2;
    const btnY = y - 20;

    ctx.fillStyle = this._hoveredRetry ? '#2196f3' : 'rgba(33, 150, 243, 0.6)';
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 8);
    ctx.fill();

    ctx.strokeStyle = '#2196f3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 8);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Arial';
    ctx.fillText('Try Again', w / 2, btnY + 30);

    this.texture.needsUpdate = true;
  }

  update(dt) {
    if (!this.group.visible) return;
    const camWorldPos = new THREE.Vector3();
    this.cameraRig.getWorldPosition(camWorldPos);
    this.group.lookAt(camWorldPos.x, this.group.position.y, camWorldPos.z);
  }
}
