import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class DialoguePanel {
  constructor(scene, cameraRig, stateManager, audioManager) {
    this.scene = scene;
    this.cameraRig = cameraRig;
    this.stateManager = stateManager;
    this.audioManager = audioManager;

    this.isActive = false;
    this.currentQuestion = 0;
    this.selectedOptions = [];

    // Panel dimensions
    this.panelWidth = 1.2;
    this.panelHeight = 0.9;

    // Create the 3D panel
    this.group = new THREE.Group();
    this.group.visible = false;
    this.scene.add(this.group);

    // Canvas for dynamic text
    this.canvas = document.createElement('canvas');
    this.canvas.width = 800;
    this.canvas.height = 600;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.needsUpdate = true;

    // Panel mesh
    const panelGeo = new THREE.PlaneGeometry(this.panelWidth, this.panelHeight);
    const panelMat = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
    });
    this.panel = new THREE.Mesh(panelGeo, panelMat);
    this.group.add(this.panel);

    // Backing
    const backGeo = new THREE.PlaneGeometry(this.panelWidth + 0.04, this.panelHeight + 0.04);
    const backMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
    const backing = new THREE.Mesh(backGeo, backMat);
    backing.position.z = -0.01;
    this.group.add(backing);

    // Option button hit areas (invisible meshes for raycasting)
    this.buttonMeshes = [];
    this.buttonInteractables = [];
    this._createButtonHitAreas();
  }

  _createButtonHitAreas() {
    // Create up to 5 button hit areas
    for (let i = 0; i < 5; i++) {
      const btnGeo = new THREE.PlaneGeometry(0.9, 0.1);
      const btnMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
      });
      const btn = new THREE.Mesh(btnGeo, btnMat);
      btn.visible = false;

      // Position buttons vertically
      btn.position.set(0, -0.05 - i * 0.13, 0.005);
      this.group.add(btn);
      this.buttonMeshes.push(btn);

      // Create interactable wrapper
      const interactable = {
        mesh: btn,
        isInteractable: false,
        index: i,
        _hovered: false,
        onHoverEnter: () => {
          interactable._hovered = true;
          this._renderCurrentQuestion();
        },
        onHoverExit: () => {
          interactable._hovered = false;
          this._renderCurrentQuestion();
        },
        onSelect: () => {
          this._selectOption(i);
        },
      };
      this.buttonInteractables.push(interactable);
    }
  }

  getInteractables() {
    return this.buttonInteractables;
  }

  show() {
    this.isActive = true;
    this.currentQuestion = 0;
    this.group.visible = true;

    // Position in front of player
    this._positionInFrontOfPlayer();

    // Enable button interactables for current question
    this._updateButtons();
    this._renderCurrentQuestion();
  }

  hide() {
    this.isActive = false;
    this.group.visible = false;
    for (const interactable of this.buttonInteractables) {
      interactable.isInteractable = false;
      interactable.mesh.visible = false;
    }
  }

  _positionInFrontOfPlayer() {
    // Get camera world position and direction
    const camWorldPos = new THREE.Vector3();
    this.cameraRig.getWorldPosition(camWorldPos);
    const camDir = new THREE.Vector3(0, 0, -1);
    camDir.applyQuaternion(this.cameraRig.quaternion);

    // Place panel 2m in front of player at eye level
    this.group.position.set(
      camWorldPos.x + camDir.x * 2,
      camWorldPos.y + 1.5,
      camWorldPos.z + camDir.z * 2
    );
    this.group.lookAt(camWorldPos.x, camWorldPos.y + 1.5, camWorldPos.z);
  }

  _updateButtons() {
    const questions = CONFIG.W_QUESTIONS;
    if (this.currentQuestion >= questions.length) return;

    const q = questions[this.currentQuestion];
    for (let i = 0; i < this.buttonMeshes.length; i++) {
      if (i < q.options.length) {
        this.buttonMeshes[i].visible = true;
        this.buttonInteractables[i].isInteractable = true;
      } else {
        this.buttonMeshes[i].visible = false;
        this.buttonInteractables[i].isInteractable = false;
      }
    }
  }

  _selectOption(index) {
    if (!this.isActive) return;

    const questions = CONFIG.W_QUESTIONS;
    if (this.currentQuestion >= questions.length) return;

    const q = questions[this.currentQuestion];
    if (index >= q.options.length) return;

    this.audioManager.playClick();
    this.selectedOptions.push({
      question: this.currentQuestion,
      answer: index,
      correct: index === q.correct,
    });

    this.currentQuestion++;

    if (this.currentQuestion >= questions.length) {
      // All questions answered
      this.audioManager.playSuccess();
      this.hide();
      this.stateManager.transition(CONFIG.STATES.CALL_COMPLETE);
    } else {
      this._updateButtons();
      this._renderCurrentQuestion();
    }
  }

  _renderCurrentQuestion() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = 'rgba(10, 15, 30, 0.92)';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 16);
    ctx.fill();

    // Border
    ctx.strokeStyle = '#00aaff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(5, 5, w - 10, h - 10, 12);
    ctx.stroke();

    // Header
    ctx.fillStyle = '#00aaff';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('112 Emergency Call', w / 2, 45);

    // Progress indicator
    const questions = CONFIG.W_QUESTIONS;
    ctx.fillStyle = '#666666';
    ctx.font = '18px Arial';
    ctx.fillText(
      `Question ${this.currentQuestion + 1} of ${questions.length}`,
      w / 2,
      75
    );

    // Progress bar
    const barWidth = 300;
    const barX = (w - barWidth) / 2;
    ctx.fillStyle = '#333333';
    ctx.fillRect(barX, 85, barWidth, 8);
    ctx.fillStyle = '#00aaff';
    ctx.fillRect(barX, 85, barWidth * ((this.currentQuestion) / questions.length), 8);

    if (this.currentQuestion >= questions.length) {
      ctx.fillStyle = '#4caf50';
      ctx.font = 'bold 32px Arial';
      ctx.fillText('Call Complete!', w / 2, h / 2);
      this.texture.needsUpdate = true;
      return;
    }

    const q = questions[this.currentQuestion];

    // Dispatcher icon
    ctx.fillStyle = '#ff9800';
    ctx.font = '20px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Dispatcher:', 40, 130);

    // Question text
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px Arial';
    ctx.textAlign = 'center';
    const questionLines = this._wrapText(q.question, 50);
    let qY = 170;
    for (const line of questionLines) {
      ctx.fillText(line, w / 2, qY);
      qY += 28;
    }

    // Options
    ctx.textAlign = 'center';
    for (let i = 0; i < q.options.length; i++) {
      const optY = 260 + i * 80;
      const isHovered = this.buttonInteractables[i]._hovered;

      // Option background
      ctx.fillStyle = isHovered ? 'rgba(0, 170, 255, 0.3)' : 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.roundRect(60, optY - 25, w - 120, 60, 8);
      ctx.fill();

      // Option border
      ctx.strokeStyle = isHovered ? '#00aaff' : '#444444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(60, optY - 25, w - 120, 60, 8);
      ctx.stroke();

      // Option letter
      ctx.fillStyle = isHovered ? '#00aaff' : '#888888';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(String.fromCharCode(65 + i) + '.', 80, optY + 8);

      // Option text
      ctx.fillStyle = isHovered ? '#ffffff' : '#cccccc';
      ctx.font = '18px Arial';
      ctx.textAlign = 'left';
      const optLines = this._wrapText(q.options[i], 45);
      let lineY = optY + 2;
      for (const line of optLines) {
        ctx.fillText(line, 120, lineY);
        lineY += 22;
      }
    }

    this.texture.needsUpdate = true;
  }

  _wrapText(text, maxChars) {
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
      if ((current + ' ' + word).trim().length > maxChars) {
        lines.push(current.trim());
        current = word;
      } else {
        current = (current + ' ' + word).trim();
      }
    }
    if (current.trim()) lines.push(current.trim());
    return lines;
  }

  update(dt) {
    if (!this.isActive) return;
    // Keep facing the player
    const camWorldPos = new THREE.Vector3();
    this.cameraRig.getWorldPosition(camWorldPos);
    this.group.lookAt(camWorldPos.x, this.group.position.y, camWorldPos.z);
  }
}
