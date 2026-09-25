import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { COLORS, createPillLabel } from '../ui/theme.js';
import { Character } from '../world/Character.js';

const S = CONFIG.STATES;

// The three asymmetric roles from the research concept
export const ROLES = {
  scene: {
    id: 'scene', label: 'Scene management', short: 'Scene', color: COLORS.orange, hex: 0xff9f0a, glyph: 'warning',
    duty: 'Secures the scene: vest and warning triangle. Sees hazards.',
  },
  people: {
    id: 'people', label: 'People management', short: 'Lead', color: COLORS.blue, hex: 0x0a84ff, glyph: 'phone',
    duty: 'Leads the team and makes the 112 call.',
  },
  medical: {
    id: 'medical', label: 'Medical management', short: 'Medical', color: COLORS.green, hex: 0x30d158, glyph: 'cross',
    duty: 'Checks the patient once it is safe. Sees vitals.',
  },
};
export const ROLE_ORDER = ['scene', 'people', 'medical'];

// Which role is responsible for each step of the chain
export const STEP_OWNER = {
  [S.VEST_PICKUP]: 'scene',
  [S.TRIANGLE_PICKUP]: 'scene',
  [S.TRIANGLE_HELD]: 'scene',
  [S.TRIANGLE_PLACED]: 'people',
  [S.CALLING_112]: 'people',
  [S.CALL_COMPLETE]: 'medical',
  [S.APPROACH_VICTIM]: 'medical',
};

// Where idle teammates wait: on the far sidewalk, well clear of the victim
const IDLE_SPOTS = {
  scene: new THREE.Vector3(-5.1, 0, -9),
  people: new THREE.Vector3(-5.1, 0, -5.5),
  medical: new THREE.Vector3(-5.1, 0, -2),
};

const TEAMMATES = [
  { name: 'Lena', top: 0x6b3f5e, trousers: 0x2c3140, hair: 0x5a3a22, skin: 0xe2b394 },
  { name: 'Kai', top: 0x2f5c4a, trousers: 0x3a3a3c, hair: 0x151010, skin: 0x9c6b4e },
];

const WALK = 1.7;   // m/s
const JOG = 3.2;

export class TeamManager {
  constructor({ scene, stateManager, viewManager, items, victim, onCallLine, onApproach }) {
    this.scene = scene;
    this.sm = stateManager;
    this.view = viewManager;
    this.items = items;          // { vest, triangle, phone }
    this.victim = victim;
    this.onCallLine = onCallLine;   // (speaker, text, color) => void
    this.onApproach = onApproach;   // (position) => void, runs the victim-approach check

    this.mode = 'solo';
    this.playerRole = null;
    this.bots = [];
    this._listeners = [];
    this._tmp = new THREE.Vector3();
  }

  onChange(cb) { this._listeners.push(cb); }
  _emit() { for (const cb of this._listeners) cb(); }

  get isTeam() { return this.mode === 'team'; }

  startTeam(playerRole) {
    this.mode = 'team';
    this.playerRole = playerRole;
    const others = ROLE_ORDER.filter(r => r !== playerRole);
    others.forEach((role, i) => {
      const look = TEAMMATES[i];
      const r = ROLES[role];
      const character = new Character(this.scene, {
        ...look, label: `${look.name} · ${r.short}`, labelColor: r.color, labelGlyph: r.glyph, ringColor: r.hex,
      });
      const bot = { name: look.name, role, character, path: [], task: null, wait: 0, callIndex: 0 };
      const spot = IDLE_SPOTS[role];
      character.setPose(spot.x, spot.z, Math.PI);
      this.bots.push(bot);
    });
    this._emit();
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  ownerOf(state) { return STEP_OWNER[state] || null; }

  // Is the current step the player's to do? (always true in solo)
  isPlayerTurn(state = this.sm.currentState) {
    if (!this.isTeam) return true;
    const owner = this.ownerOf(state);
    return !owner || owner === this.playerRole;
  }

  botForRole(role) { return this.bots.find(b => b.role === role) || null; }

  // Can the player use this item right now?
  canPlayerUse(itemRole) {
    if (!this.isTeam || !itemRole) return true;
    if (itemRole === this.playerRole) return true;
    const bot = this.botForRole(itemRole);
    return `That's ${bot ? bot.name + "'s" : 'another'} job (${ROLES[itemRole].label}). Switch role to take it over.`;
  }

  // Sentence for the HUD while a teammate owns the current step
  activityText() {
    const bot = this.botForRole(this.ownerOf(this.sm.currentState));
    if (!bot) return null;
    const who = `${bot.name} (${ROLES[bot.role].short})`;
    switch (this.sm.currentState) {
      case S.VEST_PICKUP: return `${who} is putting on the hi-vis vest. Stay clear of the road.`;
      case S.TRIANGLE_PICKUP: return `${who} is fetching the warning triangle.`;
      case S.TRIANGLE_HELD: return `${who} is placing the triangle 50 m back.`;
      case S.TRIANGLE_PLACED: return `${who} is picking up the phone to call 112.`;
      case S.CALLING_112: return `${who} is on the phone with the 112 dispatcher.`;
      case S.CALL_COMPLETE:
      case S.APPROACH_VICTIM: return `${who} is going to the patient.`;
      default: return null;
    }
  }

  // Roster for the HTML panel
  roster() {
    return ROLE_ORDER.map(role => {
      const bot = this.botForRole(role);
      const active = this.ownerOf(this.sm.currentState) === role;
      return { role: ROLES[role], who: bot ? bot.name : 'You', isPlayer: !bot, active };
    });
  }

  // ── Role switching ─────────────────────────────────────────────────────────

  // The player takes `newRole`; the teammate who had it takes the player's old role.
  switchRole(newRole) {
    if (!this.isTeam || newRole === this.playerRole) return null;
    const bot = this.botForRole(newRole);
    if (!bot) return null;
    const old = this.playerRole;

    // Carried triangle passes to whoever now owns the scene role
    const hadTriangle = bot.character.holding === 'triangle';
    bot.character.setHolding(null);
    bot.character.pose = 'stand';

    const callIndex = bot.task === 'call' ? bot.callIndex : 0;
    bot.role = old;
    bot.path = [];
    bot.task = null;
    bot.wait = 0.4;
    bot.callIndex = 0;
    const r = ROLES[old];
    bot.character.group.remove(bot.character.label);
    this._relabel(bot);
    if (bot.character.ring) bot.character.ring.material.color.setHex(r.hex);

    this.playerRole = newRole;
    this._emit();
    return { from: old, to: newRole, teammate: bot.name, hadTriangle, callIndex };
  }

  _relabel(bot) {
    const r = ROLES[bot.role];
    const label = createPillLabel(`${bot.name} · ${r.short}`, r.color, { glyph: r.glyph, heightM: 0.3 });
    bot.character.label = label;
    label.position.y = 2.25;
    bot.character.group.add(label);
  }

  // Player dropped a step mid-way (e.g. switched away during the call)
  handOverCall(fromQuestion) {
    const bot = this.botForRole('people');
    if (bot) {
      bot.task = 'call';
      bot.callIndex = fromQuestion;
      bot.callTimer = 0;
      bot.callPhase = 0;
    }
  }

  // ── Simulation ─────────────────────────────────────────────────────────────

  // Route that stays out of the victim's danger zone and off the cars.
  // Tries a few simple corridors and takes the first one that is clear.
  _plan(from, to) {
    const V = (x, z) => new THREE.Vector3(x, 0, z);
    const blockedSeg = (a, b) => {
      for (let t = 0; t <= 1; t += 0.04) {
        const x = a.x + (b.x - a.x) * t;
        const z = a.z + (b.z - a.z) * t;
        if (!this.sm.isTrianglePlacedOrLater()
          && Math.hypot(x - CONFIG.VICTIM_POS.x, z - CONFIG.VICTIM_POS.z) < CONFIG.VICTIM_FAIL_RADIUS + 1.2) return true;
        if (x > 1.9 && x < 4.4 && z > -2.6 && z < 7.2) return true;     // crashed cars
        if (x > -0.1 && x < 2.1 && z > -10.5 && z < -5.5) return true;  // player's car
      }
      return false;
    };
    const clear = (path) => {
      let prev = from;
      for (const p of path) {
        if (blockedSeg(prev, p)) return false;
        prev = p;
      }
      return true;
    };
    const LANE = -2.6;   // left lane, away from the accident
    const GAP = -3.9;    // cross-street gap between the player's car and the crash
    const candidates = [
      [to.clone()],
      [V(LANE, from.z), V(LANE, to.z), to.clone()],
      [V(from.x, GAP), V(to.x, GAP), to.clone()],
      [V(LANE, from.z), V(LANE, GAP), V(to.x, GAP), to.clone()],
    ];
    return (candidates.find(clear) || candidates[1]).filter((p, i, arr) => i === arr.length - 1 || p.distanceTo(from) > 0.3);
  }

  _goTo(bot, target, speed = WALK) {
    bot.path = this._plan(bot.character.position, target);
    bot.speed = speed;
  }

  _walk(bot, dt) {
    if (!bot.path.length) return true;
    const p = bot.character.position;
    const next = bot.path[0];
    const dx = next.x - p.x;
    const dz = next.z - p.z;
    const d = Math.hypot(dx, dz);
    const step = bot.speed * dt;
    const yaw = Math.atan2(-dx, -dz);
    const cur = bot.character.group.rotation.y;
    const turn = Math.atan2(Math.sin(yaw - cur), Math.cos(yaw - cur));
    const newYaw = cur + turn * Math.min(1, dt * 8);
    if (d <= step) {
      bot.character.setPose(next.x, next.z, newYaw);
      bot.path.shift();
    } else {
      bot.character.setPose(p.x + (dx / d) * step, p.z + (dz / d) * step, newYaw);
    }
    return bot.path.length === 0;
  }

  _face(bot, x, z, dt) {
    const p = bot.character.position;
    const yaw = Math.atan2(-(x - p.x), -(z - p.z));
    const cur = bot.character.group.rotation.y;
    const turn = Math.atan2(Math.sin(yaw - cur), Math.cos(yaw - cur));
    bot.character.group.rotation.y = cur + turn * Math.min(1, dt * 5);
  }

  update(dt, elapsed) {
    if (!this.isTeam) return;
    const state = this.sm.currentState;

    for (const bot of this.bots) {
      bot.character.update(dt, elapsed);
      if (bot.wait > 0) { bot.wait -= dt; continue; }

      // The medic finishes reaching the patient even though the run is already complete
      if (state === S.COMPLETE && bot.task === 'patient') {
        if (this._walk(bot, dt)) {
          this._face(bot, CONFIG.VICTIM_POS.x, CONFIG.VICTIM_POS.z, dt);
          bot.character.pose = 'kneel';
        }
        continue;
      }

      const mine = this.ownerOf(state) === bot.role;
      if (!mine || state === S.FAIL || state === S.COMPLETE) {
        this._idle(bot, dt);
        continue;
      }

      switch (state) {
        case S.VEST_PICKUP: this._fetch(bot, dt, CONFIG.VEST_POS, () => {
          this.items.vest.onSelect();
          bot.character.setVest(true);
        }); break;
        case S.TRIANGLE_PICKUP: this._fetch(bot, dt, CONFIG.TRIANGLE_POS, () => {
          this.items.triangle.onSelect();
          bot.character.setHolding('triangle');
        }); break;
        case S.TRIANGLE_HELD: {
          if (bot.character.holding !== 'triangle') bot.character.setHolding('triangle');
          const zone = this.items.triangle.placementZone.position;
          if (bot.task !== 'place') {
            bot.task = 'place';
            this._goTo(bot, new THREE.Vector3(zone.x, 0, zone.z), JOG);
          }
          if (this._walk(bot, dt)) {
            bot.character.setHolding(null);
            bot.task = null;
            this.items.triangle.tryPlace(bot.character.position);
          }
          break;
        }
        case S.TRIANGLE_PLACED: this._fetch(bot, dt, CONFIG.PHONE_POS, () => {
          this.items.phone.onSelect();
          bot.character.setHolding('phone');
          bot.task = 'call';
          bot.callIndex = 0;
          bot.callTimer = 0;
          bot.callPhase = 0;
        }); break;
        case S.CALLING_112: this._call(bot, dt); break;
        case S.CALL_COMPLETE:
        case S.APPROACH_VICTIM: {
          if (bot.task !== 'patient') {
            bot.task = 'patient';
            // Stand in front of the patient (who faces -z)
            this._goTo(bot, new THREE.Vector3(CONFIG.VICTIM_POS.x, 0, CONFIG.VICTIM_POS.z - 0.9), WALK);
          }
          const arrived = this._walk(bot, dt);
          this.onApproach(bot.character.position);
          if (arrived) {
            this._face(bot, CONFIG.VICTIM_POS.x, CONFIG.VICTIM_POS.z, dt);
            bot.character.pose = 'kneel';
          }
          break;
        }
        default: this._idle(bot, dt);
      }
    }
  }

  _fetch(bot, dt, itemPos, action) {
    const key = `fetch:${itemPos.x},${itemPos.z}`;
    if (bot.task !== key) {
      bot.task = key;
      this._goTo(bot, new THREE.Vector3(itemPos.x - 0.6, 0, itemPos.z - 0.6), JOG);
    }
    if (this._walk(bot, dt)) {
      this._face(bot, itemPos.x, itemPos.z, dt);
      bot.task = null;
      bot.wait = 0.5;
      action();
    }
  }

  _call(bot, dt) {
    if (bot.task !== 'call') {
      bot.task = 'call';
      bot.callTimer = 0;
      bot.callPhase = 0;
    }
    bot.character.setHolding('phone');
    const qs = CONFIG.W_QUESTIONS;
    bot.callTimer -= dt;
    if (bot.callTimer > 0) return;

    if (bot.callIndex >= qs.length) {
      bot.character.setHolding(null);
      bot.task = null;
      this.onCallLine(null);
      this.sm.transition(S.CALL_COMPLETE);
      return;
    }
    const q = qs[bot.callIndex];
    if (bot.callPhase === 0) {
      this.onCallLine('Dispatcher', q.question, COLORS.teal);
      bot.callPhase = 1;
    } else {
      this.onCallLine(bot.name, q.options[q.correct], ROLES.people.color);
      bot.callPhase = 0;
      bot.callIndex++;
    }
    bot.callTimer = 2.4;
  }

  _idle(bot, dt) {
    const spot = IDLE_SPOTS[bot.role];
    // After the scene is secure, waiting teammates gather nearer the patient
    const target = this.sm.isTrianglePlacedOrLater() && bot.role !== 'scene'
      ? new THREE.Vector3(-4.8, 0, spot.z + 2)
      : spot;
    if (bot.task !== 'idle' || (bot.idleTarget && bot.idleTarget.distanceTo(target) > 0.1)) {
      bot.character.pose = 'stand';
      bot.task = 'idle';
      bot.idleTarget = target.clone();
      this._goTo(bot, target, WALK);
    }
    if (this._walk(bot, dt)) {
      // Watch the patient from a safe distance
      this._face(bot, CONFIG.VICTIM_POS.x, CONFIG.VICTIM_POS.z, dt);
    }
  }
}
