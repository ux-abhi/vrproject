import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createCar } from './Vehicles.js';
import { Character } from './Character.js';
import { createPillLabel, COLORS } from '../ui/theme.js';

const S = CONFIG.STATES;

// Lanes: the far lane carries oncoming traffic (+z); the near lane is the one
// blocked by the crash, so its traffic (-z) has to stop behind the scene.
const LANE_ONCOMING = { x: -1.5, dir: 1 };
const LANE_BLOCKED = { x: 1.5, dir: -1 };
const CRUISE = 12;        // m/s (~45 km/h)
const WARNED = 5;         // speed past a secured scene
const BRAKE = 7;          // m/s^2 normal braking
const HARD_BRAKE = 11;
const ROAD_END = 100;

export class Traffic {
  constructor(scene, stateManager, audioManager, getPeople) {
    this.scene = scene;
    this.sm = stateManager;
    this.audio = audioManager;
    this.getPeople = getPeople;   // () => array of {x, z} for everyone on foot
    this.vehicles = [];
    this._spawnTimer = 3;
    this._honkCooldown = 10; // grace period: the player starts next to the driver's door

    // Oncoming lane: a few cars looping through
    const colors = [0xd9dcdf, 0x3b3f46, 0x7a1f1f, 0x2d4f7c];
    colors.forEach((c, i) => this._addCar(c, LANE_ONCOMING, -95 + i * 48));

    this._buildAmbulance();
    this._buildHazardOverlay();
  }

  _addCar(color, lane, z) {
    const mesh = createCar(color);
    mesh.rotation.y = lane.dir > 0 ? Math.PI : 0;
    mesh.position.set(lane.x, 0, z);
    this.scene.add(mesh);
    const v = {
      mesh, lane, z, speed: CRUISE, target: CRUISE, length: 4.4,
      engine: this.audio.createEngineSound(mesh), stopped: false,
    };
    this.vehicles.push(v);
    return v;
  }

  // ── Ambulance (RTW) ──────────────────────────────────────────────────────

  _buildAmbulance() {
    const g = new THREE.Group();
    const L = 6.0;
    const W = 2.1;

    // Side livery: white with the red/yellow reflective blocks used on German ambulances
    const c = document.createElement('canvas');
    c.width = 600;
    c.height = 240;
    const x = c.getContext('2d');
    x.fillStyle = '#f5f5f2';
    x.fillRect(0, 0, 600, 240);
    for (let i = 0; i < 20; i++) {
      x.fillStyle = i % 2 ? '#ffd60a' : '#d7261e';
      x.fillRect(i * 30, 150, 30, 36);
    }
    x.fillStyle = '#d7261e';
    x.fillRect(0, 196, 600, 10);
    x.font = 'bold 34px "Helvetica Neue", Arial, sans-serif';
    x.textAlign = 'center';
    x.fillText('RETTUNGSDIENST', 300, 118);
    x.fillStyle = '#1f3f8f';
    x.fillRect(40, 40, 110, 70);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;

    const white = new THREE.MeshPhysicalMaterial({ color: 0xf2f2ef, roughness: 0.35, clearcoat: 0.8 });
    const livery = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.35, clearcoat: 0.8 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x151c24, roughness: 0.05, metalness: 0.1, clearcoat: 1 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.7 });

    // Box body (faces: +x, -x, +y, -y, +z, -z)
    const box = new THREE.Mesh(new THREE.BoxGeometry(W, 2.1, L * 0.68), [livery, livery, white, white, white, white]);
    box.position.set(0, 1.55, L * 0.14);
    box.castShadow = true;
    g.add(box);
    // Cab
    const cab = new THREE.Mesh(new THREE.BoxGeometry(W * 0.98, 1.3, L * 0.3), white);
    cab.position.set(0, 1.15, -L * 0.33);
    cab.castShadow = true;
    g.add(cab);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.86, 0.62), glass);
    screen.position.set(0, 1.5, -L * 0.48 - 0.001);
    screen.rotation.y = Math.PI;
    screen.rotation.x = -0.15;
    g.add(screen);
    for (const side of [-1, 1]) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), glass);
      win.position.set(side * (W / 2 + 0.005), 1.5, -L * 0.33);
      win.rotation.y = side * Math.PI / 2;
      g.add(win);
    }
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(W, 0.3, 0.2), dark);
    bumper.position.set(0, 0.45, -L * 0.49);
    g.add(bumper);

    // Wheels
    const tyreGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.28, 24);
    for (const wz of [-L * 0.3, L * 0.3]) {
      for (const s of [-1, 1]) {
        const t = new THREE.Mesh(tyreGeo, dark);
        t.rotation.z = Math.PI / 2;
        t.position.set(s * (W / 2 - 0.12), 0.4, wz);
        t.castShadow = true;
        g.add(t);
      }
    }

    // Blue light bars (flashed in update)
    this._blueMats = [];
    for (const [px, pz] of [[-0.55, -L * 0.33], [0.55, -L * 0.33], [-0.8, L * 0.46], [0.8, L * 0.46]]) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x0a3dff, emissive: 0x2255ff, emissiveIntensity: 0, roughness: 0.2 });
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.24), mat);
      bar.position.set(px, pz < 0 ? 1.87 : 2.68, pz);
      g.add(bar);
      this._blueMats.push(mat);
    }
    this._blueLight = new THREE.PointLight(0x2a5bff, 0, 26, 1.6);
    this._blueLight.position.set(0, 3, 0);
    g.add(this._blueLight);

    g.visible = false;
    this.scene.add(g);
    this.ambulance = {
      mesh: g, lane: LANE_ONCOMING, z: -ROAD_END - 10, speed: 14, target: 14, length: L,
      state: 'waiting', timer: 0,
      siren: this.audio.createSiren(g), engine: this.audio.createEngineSound(g),
    };
    g.rotation.y = Math.PI;
    g.position.set(LANE_ONCOMING.x, 0, this.ambulance.z);
  }

  _dispatchAmbulance() {
    const a = this.ambulance;
    if (a.state !== 'waiting') return;
    a.state = 'dispatched';
    a.timer = 5; // time for the dispatcher to send it
  }

  // ── Scene-management hazard overlay ─────────────────────────────────────

  _buildHazardOverlay() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xff9f0a, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false });
    const chevron = new THREE.Shape();
    chevron.moveTo(-0.6, 0); chevron.lineTo(0, -0.7); chevron.lineTo(0.6, 0);
    chevron.lineTo(0.6, 0.3); chevron.lineTo(0, -0.4); chevron.lineTo(-0.6, 0.3); chevron.closePath();
    const geo = new THREE.ShapeGeometry(chevron);
    this._chevrons = [];
    for (const lane of [LANE_BLOCKED, LANE_ONCOMING]) {
      for (let z = -30; z <= 80; z += 5) {
        const m = new THREE.Mesh(geo, mat.clone());
        m.rotation.x = -Math.PI / 2;
        // Shape tip points +z once laid flat; flip it for traffic heading -z
        if (lane.dir < 0) m.rotation.z = Math.PI;
        m.position.set(lane.x, 0.035, z);
        m.userData.z = z;
        m.userData.dir = lane.dir;
        g.add(m);
        this._chevrons.push(m);
      }
    }
    const label = createPillLabel('Traffic approaching the crash', COLORS.orange, { glyph: 'warning', heightM: 0.4 });
    label.position.set(LANE_BLOCKED.x, 2.2, 24);
    g.add(label);
    g.visible = false;
    this.scene.add(g);
    this.hazardOverlay = g;
  }

  setHazardOverlay(on) {
    this.hazardOverlay.visible = on;
  }

  // ── Simulation ──────────────────────────────────────────────────────────

  _laneOccupants(lane) {
    const list = this.vehicles.filter(v => v.lane === lane);
    if (this.ambulance.mesh.visible && this.ambulance.lane === lane) list.push(this.ambulance);
    return list;
  }

  // Distance to the nearest thing ahead in the lane (people, vehicles, stop line)
  _clearAhead(v) {
    const dir = v.lane.dir;
    let best = Infinity;
    let person = false;
    for (const p of this.getPeople()) {
      if (Math.abs(p.x - v.lane.x) > 1.5) continue;
      const d = (p.z - v.z) * dir - v.length / 2;
      if (d > -1 && d < best) { best = d; person = true; }
    }
    for (const o of this._laneOccupants(v.lane)) {
      if (o === v) continue;
      const d = (o.z - v.z) * dir - (v.length + o.length) / 2;
      if (d > 0 && d < best) { best = d; person = false; }
    }
    if (v.stopAt !== undefined) {
      const d = (v.stopAt - v.z) * dir;
      if (d > -0.5 && d < best) { best = Math.max(d, 0); person = false; }
    }
    return { gap: best, person };
  }

  _drive(v, dt, cruise) {
    const { gap, person } = this._clearAhead(v);
    let target = cruise;
    if (gap < 2.5) target = 0;
    else if (gap < 30) target = Math.min(cruise, Math.sqrt(2 * BRAKE * Math.max(0, gap - 2.5)));

    // Late, hard braking for someone in the lane
    if (person && gap < 9 && v.speed > 4 && this._honkCooldown <= 0) {
      this._honkCooldown = 4;
      this.onHonk && this.onHonk(v);
    }

    const accel = target < v.speed ? (gap < 8 ? HARD_BRAKE : BRAKE) : 3;
    v.speed += Math.sign(target - v.speed) * Math.min(Math.abs(target - v.speed), accel * dt);
    v.z += v.lane.dir * v.speed * dt;
    v.mesh.position.set(v.lane.x, 0, v.z);
    if (v.engine) {
      v.engine.setVolume(0.08 + (v.speed / CRUISE) * 0.45);
      if (!v.engine.isPlaying && this.audio.listener.context.state === 'running') v.engine.play();
    }
  }

  update(dt, elapsed) {
    const secured = this.sm.isTrianglePlacedOrLater();
    this._honkCooldown -= dt;

    // Oncoming lane: loop, slowing past the scene once it is signed
    for (const v of this.vehicles) {
      if (v.lane !== LANE_ONCOMING) continue;
      const nearScene = v.z > -20 && v.z < 20;
      this._drive(v, dt, nearScene && secured ? WARNED : CRUISE);
      if (v.z > ROAD_END + 5) {
        v.z = -ROAD_END - 5;
        v.speed = CRUISE;
      }
    }

    // Blocked lane: arrivals queue behind the scene. With the triangle out they
    // stop calmly far back; without it they only see the crash late.
    this._spawnTimer -= dt;
    const queued = this.vehicles.filter(v => v.lane === LANE_BLOCKED);
    if (this._spawnTimer <= 0 && queued.length < 3 && this.sm.currentState !== S.INTRO) {
      this._spawnTimer = 14;
      const colors = [0x5b6770, 0xe9e6df, 0x243b55];
      const v = this._addCar(colors[queued.length % colors.length], LANE_BLOCKED, ROAD_END + 5);
      v.speed = CRUISE;
      v.stopAt = secured ? CONFIG.COLLISION_POS.z + CONFIG.TRIANGLE_PLACE_DISTANCE + 8 : CONFIG.COLLISION_POS.z + 9;
    }
    for (const v of queued) this._drive(v, dt, CRUISE);

    // Hazard overlay chevrons flow in the direction of travel
    if (this.hazardOverlay.visible) {
      for (const m of this._chevrons) {
        const p = ((elapsed * 0.6 + m.userData.z / 10) % 1 + 1) % 1;
        m.material.opacity = 0.2 + 0.45 * Math.sin(p * Math.PI);
      }
    }

    this._updateAmbulance(dt, elapsed);
  }

  _updateAmbulance(dt, elapsed) {
    const a = this.ambulance;
    if ([S.CALL_COMPLETE, S.APPROACH_VICTIM, S.COMPLETE].includes(this.sm.currentState)) this._dispatchAmbulance();

    if (a.state === 'dispatched') {
      a.timer -= dt;
      if (a.timer <= 0) {
        a.state = 'driving';
        a.mesh.visible = true;
        a.stopAt = -13;
        if (this.audio.listener.context.state === 'running') a.siren.play();
      }
    }
    if (a.state === 'driving') {
      this._drive(a, dt, 14);
      a.mesh.position.x = a.lane.x - 0.2;
      if (a.speed < 0.05 && (a.stopAt - a.z) * a.lane.dir < 3) {
        a.state = 'parked';
        a.siren.stop();
        if (a.engine.isPlaying) a.engine.stop();
        this._spawnParamedics();
      }
    }
    if (a.state !== 'waiting' && a.state !== 'dispatched') {
      // Blue lights: double strobe, alternating left and right
      const side = Math.floor(elapsed * 3) % 2;
      const strobe = Math.floor(elapsed * 16) % 2 === 0;
      this._blueMats.forEach((m, i) => { m.emissiveIntensity = i % 2 === side && strobe ? 4 : 0.2; });
      this._blueLight.intensity = strobe ? 18 : 0;
    }

    if (this.paramedics) {
      for (const p of this.paramedics) {
        const goal = p.path[0];
        const dx = goal.x - p.c.position.x;
        const dz = goal.z - p.c.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.05 && p.path.length > 1) p.path.shift();
        if (d > 0.05) {
          const step = Math.min(d, 1.8 * dt);
          p.c.setPose(p.c.position.x + (dx / d) * step, p.c.position.z + (dz / d) * step, Math.atan2(-dx, -dz));
        } else {
          p.c.group.rotation.y = Math.atan2(-(CONFIG.VICTIM_POS.x - p.c.position.x), -(CONFIG.VICTIM_POS.z - p.c.position.z));
        }
        p.c.update(dt, elapsed);
      }
    }
  }

  _spawnParamedics() {
    const x = this.ambulance.mesh.position.x;
    const z = this.ambulance.z;
    const look = { top: 0xd7261e, trousers: 0x1f3f8f, skin: 0xd9a47f };
    this.paramedics = [
      { c: new Character(this.scene, { ...look, hair: 0x3b2a1a, label: 'Paramedic', labelColor: COLORS.red, labelGlyph: 'cross' }), path: [new THREE.Vector3(-0.8, 0, -4.2), new THREE.Vector3(4.2, 0, -0.9)] },
      { c: new Character(this.scene, { ...look, hair: 0x111111, skin: 0xa8765a }), path: [new THREE.Vector3(-0.4, 0, -3.8), new THREE.Vector3(6.6, 0, -0.6)] },
    ];
    this.paramedics.forEach((p, i) => {
      p.c.setVest(true);
      p.c.setPose(x + 1.4, z + 2 + i, 0);
    });
  }

  stopAudio() {
    for (const v of this.vehicles) if (v.engine && v.engine.isPlaying) v.engine.stop();
    if (this.ambulance.siren.isPlaying) this.ambulance.siren.stop();
  }
}
