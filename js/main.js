import * as THREE from 'three';
import { CONFIG } from './config.js';

// Core
import { SceneManager } from './core/SceneManager.js';
import { InputManager } from './core/InputManager.js';
import { StateManager } from './core/StateManager.js';
import { AudioManager } from './core/AudioManager.js';
import { ViewManager } from './core/ViewManager.js';

// World
import { Environment } from './world/Environment.js';
import { Vehicles } from './world/Vehicles.js';
import { Victim } from './world/Victim.js';
import { Character } from './world/Character.js';
import { Traffic } from './world/Traffic.js';

// Systems
import { Locomotion } from './systems/Locomotion.js';
import { Interaction } from './systems/Interaction.js';
import { ArrowGuide } from './systems/ArrowGuide.js';
import { ScoringSystem } from './systems/ScoringSystem.js';
import { TeamManager, ROLES, ROLE_ORDER } from './systems/TeamManager.js';

// Items
import { SafetyVest } from './items/SafetyVest.js';
import { WarningTriangle } from './items/WarningTriangle.js';
import { EmergencyPhone } from './items/EmergencyPhone.js';

// UI
import { DialoguePanel } from './ui/DialoguePanel.js';
import { ScoreScreen } from './ui/ScoreScreen.js';
import { HUDOverlay } from './ui/HUDOverlay.js';
import { FailScreen } from './ui/FailScreen.js';

const S = CONFIG.STATES;

class FirstAidVRApp {
  constructor() {
    this.container = document.getElementById('app');
    this.initialized = false;

    // Wait for user interaction to start (audio policy)
    this.startButton = document.getElementById('start-button');
    this.startButton.addEventListener('click', () => this._startApp());
  }

  _startApp() {
    // Read the chosen mode and role from the start screen
    const mode = document.querySelector('input[name="mode"]:checked');
    const role = document.querySelector('input[name="role"]:checked');
    this.options = {
      mode: mode ? mode.value : 'solo',
      role: role ? role.value : 'scene',
    };

    // Hide loading overlay
    document.getElementById('loading-overlay').style.display = 'none';
    this.startButton = null;

    this._init();
    this._buildWorld();
    this._setupItems();
    this._setupUI();
    this._setupSystems();
    this._setupTeam();
    this._setupGameLogic();
    this._setupToolbar();
    this._startRenderLoop();

    this.initialized = true;
  }

  _init() {
    // Core managers
    this.sceneManager = new SceneManager(this.container);
    this.stateManager = new StateManager();
    this.inputManager = new InputManager(this.sceneManager);
    this.audioManager = new AudioManager(this.sceneManager.camera);
    this.viewManager = new ViewManager(this.sceneManager);
    this.inputManager.getPointerCamera = () => this.viewManager.activeCamera;

    // Scoring
    this.scoringSystem = new ScoringSystem(this.stateManager);

    // Set player start position, facing the car and the crash
    const start = CONFIG.PLAYER_START;
    this.sceneManager.cameraRig.position.set(start.x, start.y, start.z);
    this.sceneManager.camera.rotation.set(0, Math.PI, 0, 'YXZ');

    this._head = new THREE.Vector3();
    this._warnCooldown = 0;
  }

  _buildWorld() {
    const scene = this.sceneManager.scene;
    this.environment = new Environment(scene);
    this.sceneManager.bakeEnvironment(this.environment.sky);
    this.vehicles = new Vehicles(scene);
    this.victim = new Victim(scene);

    // Start distress sounds
    this.audioManager.createDistressSound(this.victim.getMesh());

    // The player's own body, seen in the top view
    this.playerCharacter = new Character(scene, {
      top: 0x1c3d6e, trousers: 0x2a2d33, label: 'You', labelColor: '#0A84FF', ringColor: 0x0a84ff,
    });
    this.playerCharacter.setVisible(false);

    // Bystanders watching from the far pavement (one filming, as people do)
    this.bystanders = [
      new Character(scene, { top: 0x8a6a3a, trousers: 0x3a3a3c, hair: 0x6b4a2a }),
      new Character(scene, { top: 0x444a55, trousers: 0x23262b, hair: 0x111111, skin: 0x8d5f45 }),
    ];
    this.bystanders[0].setPose(-5.4, 3.4, Math.atan2(-(3 + 5.4), -(2 - 3.4)));
    this.bystanders[1].setPose(-5.8, 4.6, Math.atan2(-(3 + 5.8), -(2 - 4.6)));
    this.bystanders[1].setHolding('phone');
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
    const view = this.viewManager;

    this.hudOverlay = new HUDOverlay(scene, rig, sm, view);
    this.dialoguePanel = new DialoguePanel(scene, rig, sm, am, view);
    this.scoreScreen = new ScoreScreen(scene, rig, sm, this.scoringSystem, view);
    this.failScreen = new FailScreen(scene, rig, sm, am, view);

    this.hudOverlay.onExit = () => this._exit();
    this.hudOverlay.onSwitchRole = () => {
      const i = ROLE_ORDER.indexOf(this.team.playerRole);
      this._switchRole(ROLE_ORDER[(i + 1) % ROLE_ORDER.length]);
    };
  }

  _setupSystems() {
    const navMeshObjects = this.environment.navMeshObjects;

    this.locomotion = new Locomotion(
      this.sceneManager, this.inputManager, navMeshObjects
    );

    this.interaction = new Interaction(this.sceneManager, this.inputManager);

    // Register all interactable objects, with the role that owns each
    this.itemRoles = new Map([
      [this.safetyVest, 'scene'],
      [this.warningTriangle, 'scene'],
      [this.emergencyPhone, 'people'],
    ]);
    for (const item of this.itemRoles.keys()) this.interaction.register(item);

    // Register dialogue panel buttons
    for (const btn of this.dialoguePanel.getInteractables()) {
      this.interaction.register(btn);
    }

    // Register score screen retry button
    this.interaction.register(this.scoreScreen.getInteractable());

    // Register fail screen continue button
    this.interaction.register(this.failScreen.getInteractable());

    // HUD buttons (switch role / exit, shown in VR)
    for (const btn of this.hudOverlay.getInteractables()) {
      this.interaction.register(btn);
    }

    // Arrow guide
    this.arrowGuide = new ArrowGuide(
      this.sceneManager.scene, this.sceneManager.cameraRig, this.viewManager
    );

    // Trigger / left click: use what is pointed at, otherwise move
    this.inputManager.onSelect((controller, index) => {
      const handled = this.interaction.handleSelect(index);
      if (handled) return;
      if (this.inputManager.isVR) {
        this.locomotion.executeTeleport();
      } else if (!this._modalOpen()) {
        this.locomotion.moveToPointer(this.inputManager.mouse, this.viewManager.activeCamera);
      }
    });

    // Grip: grab whatever this hand points at (never teleports)
    this.inputManager.onSqueeze((controller, index) => {
      this.interaction.handleSelect(index);
    });

    // In team mode, items belong to a role
    this.interaction.canInteract = (it) => {
      const role = this.itemRoles.get(it);
      return role ? this.team.canPlayerUse(role) : true;
    };
    this.interaction.onBlocked = (it, reason) => {
      this.hudOverlay.showMessage(reason, 3.5, false);
    };
  }

  _setupTeam() {
    this.team = new TeamManager({
      scene: this.sceneManager.scene,
      stateManager: this.stateManager,
      viewManager: this.viewManager,
      items: { vest: this.safetyVest, triangle: this.warningTriangle, phone: this.emergencyPhone },
      victim: this.victim,
      onCallLine: (speaker, text, color) => {
        this.hudOverlay.setTranscript(speaker ? { speaker, text, color } : null);
      },
      onApproach: (pos) => this._checkVictimApproachAt(pos),
    });
    if (this.options.mode === 'team') this.team.startTeam(this.options.role);

    // Traffic reacts to everyone on foot
    this.traffic = new Traffic(this.sceneManager.scene, this.stateManager, this.audioManager, () => this._people());
    this.traffic.onHonk = () => {
      this.audioManager.playHorn();
      this.viewManager.getHeadPosition(this._head);
      if (Math.abs(this._head.x) < 3.2) {
        this.hudOverlay.showMessage('A car had to brake for you. Stay out of the lanes.', 3, false);
      }
    };

    // Session end in VR shows the HUD buttons only while presenting
    const xr = this.sceneManager.renderer.xr;
    xr.addEventListener('sessionstart', () => this.hudOverlay.setButtonsVisible(this.team.isTeam, true));
    xr.addEventListener('sessionend', () => this.hudOverlay.setButtonsVisible(this.team.isTeam, false));
  }

  _people() {
    this.viewManager.getHeadPosition(this._head);
    const list = [{ x: this._head.x, z: this._head.z }];
    for (const b of this.team.bots) list.push(b.character.position);
    if (this.traffic && this.traffic.paramedics) {
      for (const p of this.traffic.paramedics) list.push(p.c.position);
    }
    return list;
  }

  _setupGameLogic() {
    const sm = this.stateManager;

    // State change handler
    sm.on((oldState, newState) => {
      // Log step for scoring
      this.scoringSystem.logStep(newState);

      // Update arrow guide
      this.arrowGuide.updateForState(newState);

      // Start distress audio and street ambience once the game begins
      if (newState === S.VEST_PICKUP) {
        this.audioManager.playDistress();
        this.audioManager.startAmbience();
      }

      // What the player's own body is wearing / carrying
      const mine = this.team.isPlayerTurn(oldState);
      if (oldState === S.VEST_PICKUP && newState === S.TRIANGLE_PICKUP && mine) this.playerCharacter.setVest(true);
      if (newState === S.TRIANGLE_HELD && this.team.isPlayerTurn(newState)) this.playerCharacter.setHolding('triangle');
      if (newState === S.CALLING_112 && this.team.isPlayerTurn(newState)) this.playerCharacter.setHolding('phone');
      if (newState === S.TRIANGLE_PLACED || newState === S.CALL_COMPLETE) this.playerCharacter.setHolding(null);

      // Show dialogue panel on calling 112 (unless a teammate is making the call)
      if (newState === S.CALLING_112 && this.team.isPlayerTurn(newState)) {
        this.dialoguePanel.show();
      }

      // Show score screen on completion
      if (newState === S.COMPLETE) {
        this.audioManager.stopDistress();
        this.scoreScreen.show();
        this.arrowGuide.hide();
      }

      // Show fail screen
      if (newState === S.FAIL) {
        this.failScreen.show();
      }

      this._refreshRoleUI();
    });

    this.team.onChange(() => this._refreshRoleUI());
    this._refreshRoleUI();

    // Start the game in INTRO state, then transition to VEST_PICKUP
    // (In this version, we auto-start after the loading screen click)
    setTimeout(() => {
      sm.transition(S.VEST_PICKUP);
    }, 500);
  }

  // Everything that depends on whose turn it is and which role the player holds
  _refreshRoleUI() {
    const team = this.team;
    const state = this.stateManager.currentState;
    const role = team.isTeam ? team.playerRole : null;
    const turn = team.isPlayerTurn();

    this.arrowGuide.setEnabled(turn);
    this.hudOverlay.setStatus(turn ? null : team.activityText());
    this.hudOverlay.setRole(role ? ROLES[role] : null);

    // Asymmetric information: hazards for Scene, vitals for Medical (solo sees both)
    this.traffic.setHazardOverlay((!role || role === 'scene') && state !== S.COMPLETE);
    this.victim.setDangerZoneVisible(!this.stateManager.isTrianglePlacedOrLater() && state !== S.COMPLETE);
    this._vitalsVisible = !role || role === 'medical';

    this._renderRoster();
  }

  // ── Role switching ─────────────────────────────────────────────────────────

  _switchRole(newRole) {
    const sm = this.stateManager;
    const wasCalling = this.dialoguePanel.isActive;
    const question = this.dialoguePanel.currentQuestion;
    const res = this.team.switchRole(newRole);
    if (!res) return;

    // Hand the 112 call over mid-conversation in either direction
    if (wasCalling) {
      this.dialoguePanel.hide();
      this.team.handOverCall(question);
      this.playerCharacter.setHolding(null);
    }
    if (newRole === 'people' && sm.isState(S.CALLING_112)) {
      this.hudOverlay.setTranscript(null);
      this.dialoguePanel.show(res.callIndex);
      this.playerCharacter.setHolding('phone');
    }

    // The warning triangle goes with the Scene role
    if (sm.isState(S.TRIANGLE_HELD)) {
      this.playerCharacter.setHolding(newRole === 'scene' ? 'triangle' : null);
    }

    this.locomotion.cancelMove();
    this.hudOverlay.showMessage(`You are now ${ROLES[newRole].label}. ${res.teammate} took ${ROLES[res.from].short}.`, 3.5, true);
    this._refreshRoleUI();
  }

  // ── Checks ─────────────────────────────────────────────────────────────────

  _checkFailState() {
    const sm = this.stateManager;

    // Don't check during fail screen, completed, or if triangle already placed
    if (sm.isState(S.FAIL, S.COMPLETE, S.INTRO)) return;
    if (sm.isTrianglePlacedOrLater()) return;

    // Check proximity to victim (the head, so room-scale walking in VR counts)
    const head = this.viewManager.getHeadPosition(this._head);
    const victimPos = this.victim.getPosition();
    const dist = Math.hypot(head.x - victimPos.x, head.z - victimPos.z);

    if (dist < CONFIG.VICTIM_FAIL_RADIUS) {
      sm.transition(S.FAIL);
    } else if (dist < CONFIG.VICTIM_FAIL_RADIUS + 2.5 && this._warnCooldown <= 0) {
      // Early warning before the danger zone
      this._warnCooldown = 3;
      this.hudOverlay.showMessage('Too close. The scene is not secured yet.', 2.5, false);
    }
  }

  _checkTrianglePlacement() {
    if (!this.warningTriangle.isPickedUp || this.warningTriangle.isPlaced) return;
    if (!this.stateManager.isState(S.TRIANGLE_HELD)) return;
    if (!this.team.isPlayerTurn()) return; // a teammate is carrying it

    this.warningTriangle.tryPlace(this.viewManager.getHeadPosition(this._head));
  }

  _checkVictimApproach() {
    if (!this.team.isPlayerTurn(S.CALL_COMPLETE)) return;
    this._checkVictimApproachAt(this.viewManager.getHeadPosition(this._head));
  }

  _checkVictimApproachAt(pos) {
    if (!this.stateManager.isState(S.CALL_COMPLETE, S.APPROACH_VICTIM)) return;

    const victimPos = this.victim.getPosition();
    const dist = Math.hypot(pos.x - victimPos.x, pos.z - victimPos.z);

    if (dist < 3) {
      if (this.stateManager.isState(S.CALL_COMPLETE)) {
        this.stateManager.transition(S.APPROACH_VICTIM);
      }
      if (dist < 1.5 && this.stateManager.isState(S.APPROACH_VICTIM)) {
        this.stateManager.transition(S.COMPLETE);
      }
    }
  }

  // Tell the player when they are the reason the ambulance can't get through
  _checkAmbulanceWay(head) {
    const a = this.traffic.ambulance;
    if (a.state !== 'driving' || this._warnCooldown > 0) return;
    const inLane = Math.abs(head.x - a.lane.x) < 1.6;
    if (inLane && (head.z - a.z) * a.lane.dir > 0) {
      this._warnCooldown = 4;
      this.hudOverlay.showMessage('Ambulance coming. Step off the road so it can reach you.', 3.5, false);
    }
  }

  _modalOpen() {
    return this.dialoguePanel.isActive || this.failScreen.isActive || this.scoreScreen.group.visible;
  }

  // ── HTML toolbar (desktop): view switch, role switch, exit ─────────────────

  _setupToolbar() {
    const $ = (id) => document.getElementById(id);
    const toolbar = $('toolbar');
    toolbar.hidden = false;

    const viewButtons = toolbar.querySelectorAll('[data-view]');
    const syncView = () => {
      viewButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === this.viewManager.mode)));
      $('desktop-controls-hint').dataset.view = this.viewManager.mode;
    };
    viewButtons.forEach(b => b.addEventListener('click', () => this.viewManager.setMode(b.dataset.view)));
    this.viewManager.onChange(() => {
      syncView();
      this.hudOverlay.showMessage(this.viewManager.mode === 'top' ? 'Top view: you are the blue character.' : 'Immersive view', 2, true);
    });
    syncView();

    // Role menu (team mode only)
    const roleButton = $('role-button');
    const roleMenu = $('role-menu');
    roleButton.hidden = !this.team.isTeam;
    roleButton.addEventListener('click', () => {
      roleMenu.hidden = !roleMenu.hidden;
      roleButton.setAttribute('aria-expanded', String(!roleMenu.hidden));
    });
    roleMenu.querySelectorAll('[data-role]').forEach(b => b.addEventListener('click', () => {
      roleMenu.hidden = true;
      roleButton.setAttribute('aria-expanded', 'false');
      this._switchRole(b.dataset.role);
    }));

    // Exit with confirmation
    const sheet = $('exit-sheet');
    const openSheet = () => {
      sheet.hidden = false;
      this.inputManager.enabled = false;
      $('exit-cancel').focus();
    };
    const closeSheet = () => {
      sheet.hidden = true;
      this.inputManager.enabled = true;
    };
    $('exit-button').addEventListener('click', openSheet);
    $('exit-cancel').addEventListener('click', closeSheet);
    $('exit-confirm').addEventListener('click', () => this._exit());

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!roleMenu.hidden) { roleMenu.hidden = true; return; }
        if (sheet.hidden) openSheet(); else closeSheet();
      } else if ((e.key === 'v' || e.key === 'V') && sheet.hidden) {
        this.viewManager.toggle();
      }
    });
  }

  _renderRoster() {
    const el = document.getElementById('team-roster');
    if (!el) return;
    el.hidden = !this.team.isTeam;
    if (!this.team.isTeam) return;
    el.innerHTML = this.team.roster().map(r => `
      <li class="${r.active ? 'active' : ''}">
        <span class="dot" style="background:${r.role.color}"></span>
        <span class="who">${r.who}</span>
        <span class="what">${r.role.short}</span>
        ${r.active ? '<span class="now">Now</span>' : ''}
      </li>`).join('');
    document.querySelectorAll('#role-menu [data-role]').forEach(b => {
      b.setAttribute('aria-checked', String(b.dataset.role === this.team.playerRole));
    });
  }

  _exit() {
    const session = this.sceneManager.renderer.xr.getSession();
    this.audioManager.stopAll();
    this.traffic.stopAudio();
    const leave = () => {
      this.sceneManager.renderer.setAnimationLoop(null);
      window.location.href = window.location.pathname; // back to the start screen
    };
    if (session) session.end().then(leave, leave);
    else leave();
  }

  // ── Frame loop ─────────────────────────────────────────────────────────────

  _startRenderLoop() {
    const renderer = this.sceneManager.renderer;

    renderer.setAnimationLoop(() => {
      const dt = Math.min(this.sceneManager.getDelta(), 0.1);
      const elapsed = this.sceneManager.getElapsed();
      this._warnCooldown -= dt;

      // Input and movement
      this.inputManager.update(dt);
      this.locomotion.update(dt);

      // Player body and cameras
      const head = this.viewManager.getHeadPosition(this._head);
      this.playerCharacter.setPose(head.x, head.z, this.viewManager.getYaw());
      this.playerCharacter.setVisible(this.viewManager.isTop);
      this.playerCharacter.update(dt, elapsed);
      this.viewManager.update(dt, this.playerCharacter.position);

      this.interaction.update(dt);
      this.arrowGuide.update(dt, this.playerCharacter.position);

      // Update world
      this.environment.update(elapsed);
      this.vehicles.update(elapsed);
      this.victim.update(dt, elapsed);
      this.traffic.update(dt, elapsed);
      this.team.update(dt, elapsed);
      for (const b of this.bystanders) b.update(dt, elapsed);
      this.audioManager.update(elapsed);

      // Update items
      this.safetyVest.update(dt, elapsed);
      this.warningTriangle.update(dt, elapsed);
      this.emergencyPhone.update(dt, elapsed);

      // Guidance: distance to the goal, vitals detail near the patient
      this.hudOverlay.setDistance(this.team.isPlayerTurn() ? this.arrowGuide.distanceFrom(head) : null);
      this._updateVitals(head);

      // Update UI
      this.hudOverlay.update(dt);
      this.dialoguePanel.update(dt);
      this.scoreScreen.update(dt);
      this.failScreen.update(dt);

      // Game logic checks
      this._checkFailState();
      this._checkTrianglePlacement();
      this._checkVictimApproach();
      this._checkAmbulanceWay(head);

      // Render
      renderer.render(this.sceneManager.scene, this.viewManager.activeCamera);
    });
  }

  _updateVitals(head) {
    if (!this._vitalsVisible) {
      this.victim.setVitals(false, false);
      return;
    }
    // Whoever holds the Medical role gets the close-up assessment
    const medic = this.team.botForRole('medical');
    const p = medic ? medic.character.position : head;
    const v = CONFIG.VICTIM_POS;
    this.victim.setVitals(true, Math.hypot(p.x - v.x, p.z - v.z) < 3);
  }
}

// Initialize
const app = new FirstAidVRApp();
