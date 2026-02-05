import * as THREE from 'three';
import { CONFIG } from './config.js';

// Core
import { SceneManager } from './core/SceneManager.js';
import { InputManager } from './core/InputManager.js';
import { StateManager } from './core/StateManager.js';
import { AudioManager } from './core/AudioManager.js';

// World
import { Environment } from './world/Environment.js';
import { Vehicles } from './world/Vehicles.js';
import { Victim } from './world/Victim.js';

// Systems
import { Locomotion } from './systems/Locomotion.js';
import { Interaction } from './systems/Interaction.js';
import { ArrowGuide } from './systems/ArrowGuide.js';
import { ScoringSystem } from './systems/ScoringSystem.js';

// Items
import { SafetyVest } from './items/SafetyVest.js';
import { WarningTriangle } from './items/WarningTriangle.js';
import { EmergencyPhone } from './items/EmergencyPhone.js';

// UI
import { DialoguePanel } from './ui/DialoguePanel.js';
import { ScoreScreen } from './ui/ScoreScreen.js';
import { HUDOverlay } from './ui/HUDOverlay.js';
import { FailScreen } from './ui/FailScreen.js';

class FirstAidVRApp {
  constructor() {
    this.container = document.getElementById('app');
    this.initialized = false;

    // Wait for user interaction to start (audio policy)
    this.startButton = document.getElementById('start-button');
    this.startButton.addEventListener('click', () => this._startApp());
  }

  _startApp() {
    // Hide loading overlay
    document.getElementById('loading-overlay').style.display = 'none';
    this.startButton = null;

    this._init();
    this._buildWorld();
    this._setupItems();
    this._setupUI();
    this._setupSystems();
    this._setupGameLogic();
    this._startRenderLoop();

    this.initialized = true;
  }

  _init() {
    // Core managers
    this.sceneManager = new SceneManager(this.container);
    this.stateManager = new StateManager();
    this.inputManager = new InputManager(this.sceneManager);
    this.audioManager = new AudioManager(this.sceneManager.camera);

    // Scoring
    this.scoringSystem = new ScoringSystem(this.stateManager);

    // Set player start position
    const start = CONFIG.PLAYER_START;
    this.sceneManager.cameraRig.position.set(start.x, start.y, start.z);
  }

  _buildWorld() {
    this.environment = new Environment(this.sceneManager.scene);
    this.vehicles = new Vehicles(this.sceneManager.scene);
    this.victim = new Victim(this.sceneManager.scene);

    // Start distress sounds
    this.audioManager.createDistressSound(this.victim.getMesh());
  }

  _setupItems() {
    const scene = this.sceneManager.scene;
    const sm = this.stateManager;
    const am = this.audioManager;

    this.safetyVest = new SafetyVest(scene, sm, am);
    this.warningTriangle = new WarningTriangle(
      scene, sm, am, this.sceneManager.cameraRig
    );
    this.emergencyPhone = new EmergencyPhone(scene, sm, am);
  }

  _setupUI() {
    const scene = this.sceneManager.scene;
    const rig = this.sceneManager.cameraRig;
    const sm = this.stateManager;
    const am = this.audioManager;

    this.hudOverlay = new HUDOverlay(scene, rig, sm);
    this.dialoguePanel = new DialoguePanel(scene, rig, sm, am);
    this.scoreScreen = new ScoreScreen(scene, rig, sm, this.scoringSystem);
    this.failScreen = new FailScreen(scene, rig, sm, am);
  }

  _setupSystems() {
    const navMeshObjects = this.environment.navMeshObjects;

    this.locomotion = new Locomotion(
      this.sceneManager, this.inputManager, navMeshObjects
    );

    this.interaction = new Interaction(this.sceneManager, this.inputManager);

    // Register all interactable objects
    this.interaction.register(this.safetyVest);
    this.interaction.register(this.warningTriangle);
    this.interaction.register(this.emergencyPhone);

    // Register dialogue panel buttons
    for (const btn of this.dialoguePanel.getInteractables()) {
      this.interaction.register(btn);
    }

    // Register score screen retry button
    this.interaction.register(this.scoreScreen.getInteractable());

    // Register fail screen continue button
    this.interaction.register(this.failScreen.getInteractable());

    // Arrow guide
    this.arrowGuide = new ArrowGuide(
      this.sceneManager.scene, this.sceneManager.cameraRig
    );

    // Handle select events
    this.inputManager.onSelect((controller, index) => {
      // Try interaction first
      const handled = this.interaction.handleSelect();
      if (!handled) {
        // If not handled by interaction, try teleportation (VR)
        this.locomotion.executeTeleport();
      }
    });
  }

  _setupGameLogic() {
    const sm = this.stateManager;

    // State change handler
    sm.on((oldState, newState) => {
      // Log step for scoring
      this.scoringSystem.logStep(newState);

      // Update arrow guide
      this.arrowGuide.updateForState(newState);

      // Start distress audio once the game begins
      if (newState === CONFIG.STATES.VEST_PICKUP) {
        this.audioManager.playDistress();
      }

      // Show dialogue panel on calling 112
      if (newState === CONFIG.STATES.CALLING_112) {
        this.dialoguePanel.show();
      }

      // Show score screen on completion
      if (newState === CONFIG.STATES.COMPLETE) {
        this.audioManager.stopDistress();
        this.scoreScreen.show();
        this.arrowGuide.hide();
      }

      // Show fail screen
      if (newState === CONFIG.STATES.FAIL) {
        this.failScreen.show();
      }
    });

    // Start the game in INTRO state, then transition to VEST_PICKUP
    // (In this version, we auto-start after the loading screen click)
    setTimeout(() => {
      sm.transition(CONFIG.STATES.VEST_PICKUP);
    }, 500);
  }

  _checkFailState() {
    const sm = this.stateManager;

    // Don't check during fail screen, completed, or if triangle already placed
    if (sm.isState(CONFIG.STATES.FAIL, CONFIG.STATES.COMPLETE, CONFIG.STATES.INTRO)) return;
    if (sm.isTrianglePlacedOrLater()) return;

    // Check proximity to victim
    const playerPos = this.sceneManager.cameraRig.position;
    const victimPos = this.victim.getPosition();
    const dist = new THREE.Vector2(
      playerPos.x - victimPos.x,
      playerPos.z - victimPos.z
    ).length();

    if (dist < CONFIG.VICTIM_FAIL_RADIUS) {
      sm.transition(CONFIG.STATES.FAIL);
    }
  }

  _checkTrianglePlacement() {
    if (!this.warningTriangle.isPickedUp || this.warningTriangle.isPlaced) return;
    if (!this.stateManager.isState(CONFIG.STATES.TRIANGLE_HELD)) return;

    const playerPos = this.sceneManager.cameraRig.position;
    this.warningTriangle.tryPlace(playerPos);
  }

  _checkVictimApproach() {
    if (!this.stateManager.isState(CONFIG.STATES.CALL_COMPLETE, CONFIG.STATES.APPROACH_VICTIM)) return;

    const playerPos = this.sceneManager.cameraRig.position;
    const victimPos = this.victim.getPosition();
    const dist = new THREE.Vector2(
      playerPos.x - victimPos.x,
      playerPos.z - victimPos.z
    ).length();

    if (dist < 3) {
      if (this.stateManager.isState(CONFIG.STATES.CALL_COMPLETE)) {
        this.stateManager.transition(CONFIG.STATES.APPROACH_VICTIM);
      }
      if (dist < 1.5 && this.stateManager.isState(CONFIG.STATES.APPROACH_VICTIM)) {
        this.stateManager.transition(CONFIG.STATES.COMPLETE);
      }
    }
  }

  _startRenderLoop() {
    const renderer = this.sceneManager.renderer;

    renderer.setAnimationLoop((time, frame) => {
      const dt = Math.min(this.sceneManager.getDelta(), 0.1);
      const elapsed = this.sceneManager.getElapsed();

      // Update systems
      this.inputManager.update(dt);
      this.locomotion.update(dt);
      this.interaction.update(dt);
      this.arrowGuide.update(dt);

      // Update world
      this.vehicles.update(elapsed);
      this.victim.update(dt, elapsed);

      // Update items
      this.safetyVest.update(dt, elapsed);
      this.warningTriangle.update(dt, elapsed);
      this.emergencyPhone.update(dt, elapsed);

      // Update UI
      this.hudOverlay.update(dt);
      this.dialoguePanel.update(dt);
      this.scoreScreen.update(dt);
      this.failScreen.update(dt);

      // Game logic checks
      this._checkFailState();
      this._checkTrianglePlacement();
      this._checkVictimApproach();

      // Render
      renderer.render(this.sceneManager.scene, this.sceneManager.camera);
    });
  }
}

// Initialize
const app = new FirstAidVRApp();
