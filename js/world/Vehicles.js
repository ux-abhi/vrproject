import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Shared resources for all cars
let shared = null;
function getShared() {
  if (shared) return shared;

  const plateCanvas = document.createElement('canvas');
  plateCanvas.width = 260;
  plateCanvas.height = 56;
  const c = plateCanvas.getContext('2d');
  c.fillStyle = '#f4f4f0';
  c.fillRect(0, 0, 260, 56);
  c.strokeStyle = '#111';
  c.lineWidth = 3;
  c.strokeRect(2, 2, 256, 52);
  c.fillStyle = '#1f47a8';
  c.fillRect(4, 4, 26, 48);
  c.fillStyle = '#ffd60a';
  c.beginPath();
  c.arc(17, 20, 7, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#111';
  c.font = 'bold 36px "DIN Alternate", "Helvetica Neue", Arial, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('M·FA 112', 145, 30);
  const plateTex = new THREE.CanvasTexture(plateCanvas);
  plateTex.colorSpace = THREE.SRGBColorSpace;

  shared = {
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x151c24, metalness: 0.1, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02,
    }),
    trim: new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.6 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xdadde2, metalness: 1, roughness: 0.18 }),
    tyre: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.92 }),
    rim: new THREE.MeshStandardMaterial({ color: 0xb9bdc4, metalness: 0.95, roughness: 0.28 }),
    headlight: new THREE.MeshStandardMaterial({
      color: 0xf4f7ff, emissive: 0xeaf1ff, emissiveIntensity: 0.6, metalness: 0.4, roughness: 0.1,
    }),
    taillight: new THREE.MeshStandardMaterial({
      color: 0x8a0d10, emissive: 0xff1a1a, emissiveIntensity: 0.45, roughness: 0.2,
    }),
    plate: new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.5 }),
    tyreGeo: new THREE.CylinderGeometry(0.33, 0.33, 0.22, 28),
    rimGeo: new THREE.CylinderGeometry(0.21, 0.21, 0.232, 20),
    hubGeo: new THREE.CylinderGeometry(0.06, 0.06, 0.24, 12),
    spokeGeo: new THREE.BoxGeometry(0.04, 0.238, 0.36),
  };
  return shared;
}

// Builds a side profile shape; u runs along the length with the FRONT at +L/2.
function bodyProfile(L, s) {
  const y0 = 0.33;
  const archR = 0.4;
  const axleF = L * 0.3;
  const axleR = -L * 0.3;

  const p = new THREE.Shape();
  p.moveTo(-L / 2 + 0.08, y0);
  p.lineTo(axleR - archR, y0);
  p.absarc(axleR, y0, archR, Math.PI, 0, true);
  p.lineTo(axleF - archR, y0);
  p.absarc(axleF, y0, archR, Math.PI, 0, true);
  p.lineTo(L / 2 - 0.12, y0);
  p.quadraticCurveTo(L / 2 + 0.02, y0 + 0.02, L / 2, 0.6 * s);          // front bumper
  p.quadraticCurveTo(L / 2 - 0.02, 0.76 * s, L / 2 - 0.25, 0.8 * s);   // nose
  p.lineTo(L * 0.2, 0.9 * s);                                           // bonnet
  p.lineTo(-L * 0.34, 0.94 * s);                                        // belt line
  p.quadraticCurveTo(-L / 2 + 0.05, 0.95 * s, -L / 2 + 0.02, 0.84 * s); // boot lid edge
  p.quadraticCurveTo(-L / 2 - 0.03, 0.55 * s, -L / 2 + 0.08, y0);       // rear bumper
  return p;
}

function greenhouseProfile(L, s) {
  const p = new THREE.Shape();
  p.moveTo(L * 0.2, 0.9 * s);
  p.quadraticCurveTo(L * 0.1, 1.2 * s, L * 0.02, 1.33 * s);   // windscreen
  p.lineTo(-L * 0.2, 1.35 * s);                                 // roof
  p.quadraticCurveTo(-L * 0.3, 1.2 * s, -L * 0.36, 0.94 * s);  // rear screen
  p.closePath();
  return p;
}

function extrudeAcross(shape, width, bevel) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 16,
  });
  geo.translate(0, 0, -(width - bevel * 2) / 2);
  geo.rotateY(Math.PI / 2); // u (front +) -> -z, extrusion -> x
  return geo;
}

export function createCar(color, length = 4.2, width = 1.8, height = 1.4) {
  const sh = getShared();
  const car = new THREE.Group();
  const L = length;
  const W = width;
  const s = height / 1.4;

  const paint = new THREE.MeshPhysicalMaterial({
    color, metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06,
  });

  // Body
  const body = new THREE.Mesh(extrudeAcross(bodyProfile(L, s), W, 0.07), paint);
  body.castShadow = true;
  body.receiveShadow = true;
  car.add(body);
  car.userData.paint = paint;

  // Glass cabin + painted roof skin
  const cabin = new THREE.Mesh(extrudeAcross(greenhouseProfile(L, s), W * 0.86, 0.06), sh.glass);
  cabin.castShadow = true;
  car.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 0.04, L * 0.2), paint);
  roof.position.set(0, 1.36 * s, L * 0.09);
  roof.castShadow = true;
  car.add(roof);

  // Side sills, mirrors and door handles
  for (const side of [-1, 1]) {
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, L * 0.36), sh.trim);
    sill.position.set(side * (W / 2 + 0.005), 0.4, 0);
    car.add(sill);

    // Mirrors
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.12), paint);
    mirror.position.set(side * (W / 2 + 0.06), 0.98 * s, -L * 0.17);
    mirror.castShadow = true;
    car.add(mirror);

    // Door handles
    for (const dz of [-L * 0.06, L * 0.14]) {
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.16), sh.chrome);
      handle.position.set(side * (W / 2 + 0.005), 0.84 * s, dz);
      car.add(handle);
    }
  }

  // Grille + lower intake
  const grille = new THREE.Mesh(new THREE.BoxGeometry(W * 0.5, 0.14, 0.04), sh.trim);
  grille.position.set(0, 0.62 * s, -L / 2 - 0.005);
  car.add(grille);

  // Headlights (front = -z)
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.09, 0.06), sh.headlight);
    hl.position.set(side * W * 0.34, 0.7 * s, -L / 2 + 0.03);
    hl.rotation.y = side * 0.12;
    car.add(hl);
  }

  // Full-width tail light bar
  const tail = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 0.07, 0.04), sh.taillight);
  tail.position.set(0, 0.82 * s, L / 2 - 0.02);
  car.add(tail);

  // Number plates
  const plateGeo = new THREE.PlaneGeometry(0.52, 0.112);
  const plateF = new THREE.Mesh(plateGeo, sh.plate);
  plateF.position.set(0, 0.45, -L / 2 - 0.03);
  plateF.rotation.y = Math.PI;
  car.add(plateF);
  const plateR = new THREE.Mesh(plateGeo, sh.plate);
  plateR.position.set(0, 0.55, L / 2 + 0.03);
  car.add(plateR);

  // Wheels: tyre, alloy rim with five spokes, hub
  const wheelX = W / 2 - 0.13;
  for (const wz of [-L * 0.3, L * 0.3]) {
    for (const side of [-1, 1]) {
      const wheel = new THREE.Group();
      const tyre = new THREE.Mesh(sh.tyreGeo, sh.tyre);
      tyre.castShadow = true;
      wheel.add(tyre);
      const rim = new THREE.Mesh(sh.rimGeo, sh.rim);
      wheel.add(rim);
      for (let k = 0; k < 5; k++) {
        const spoke = new THREE.Mesh(sh.spokeGeo, sh.chrome);
        spoke.rotation.y = (k / 5) * Math.PI;
        wheel.add(spoke);
      }
      wheel.add(new THREE.Mesh(sh.hubGeo, sh.chrome));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * wheelX, 0.33, wz);
      car.add(wheel);
    }
  }

  car.userData.length = L;
  car.userData.width = W;
  car.userData.scaleY = s;
  return car;
}

export class Vehicles {
  constructor(scene) {
    this.scene = scene;
    this.vehicles = [];
    this._createCollisionScene();
    this._createParkedCars();
  }

  _createCar(color, length, width, height) {
    return createCar(color, length, width, height);
  }

  _createCollisionScene() {
    const collisionPos = CONFIG.COLLISION_POS;

    // Car 1 (blue - the one that was hit, pulled to the side)
    const car1 = this._createCar(0x1f4f9a);
    car1.position.set(collisionPos.x, 0, collisionPos.z);
    car1.rotation.y = 0.08; // slightly angled
    this.scene.add(car1);
    this.vehicles.push(car1);

    // Car 2 (red - the one that rear-ended)
    const car2 = this._createCar(0xa81c1c);
    car2.position.set(collisionPos.x + 0.3, 0, collisionPos.z + 4.5);
    car2.rotation.y = -0.05;
    this.scene.add(car2);
    this.vehicles.push(car2);

    // Crumpled bumper wedged between the cars
    const crumpleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.85, flatShading: true });
    const crumpleGeo = new THREE.IcosahedronGeometry(0.5, 1);
    const pos = crumpleGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(i, pos.getX(i) * (1 + Math.sin(i * 12.9) * 0.25), pos.getY(i), pos.getZ(i) * (1 + Math.cos(i * 7.3) * 0.25));
    }
    crumpleGeo.computeVertexNormals();
    const crumple = new THREE.Mesh(crumpleGeo, crumpleMat);
    crumple.position.set(collisionPos.x + 0.15, 0.45, collisionPos.z + 2.3);
    crumple.scale.set(1.6, 0.35, 0.5);
    crumple.castShadow = true;
    this.scene.add(crumple);

    // Buckled bonnet on the red car
    const bonnet = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.8), car2.userData.paint);
    bonnet.position.set(collisionPos.x + 0.25, 0.98, collisionPos.z + 2.85);
    bonnet.rotation.set(-0.35, 0.05, 0.06);
    bonnet.castShadow = true;
    this.scene.add(bonnet);

    // Detached bumper piece lying on the road
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.12), crumpleMat);
    bumper.position.set(collisionPos.x - 1.2, 0.08, collisionPos.z + 3.2);
    bumper.rotation.set(0, 0.7, Math.PI / 2 - 0.2);
    bumper.castShadow = true;
    this.scene.add(bumper);

    // Coolant puddle (glossy decal)
    const puddle = new THREE.Mesh(
      new THREE.CircleGeometry(0.7, 32),
      new THREE.MeshStandardMaterial({ color: 0x0f1a14, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.8 })
    );
    puddle.rotation.x = -Math.PI / 2;
    puddle.scale.set(1.3, 0.8, 1);
    puddle.position.set(collisionPos.x + 0.4, 0.022, collisionPos.z + 2.8);
    this.scene.add(puddle);

    // Broken glass and plastic debris on the ground
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xcfe8ff, transparent: true, opacity: 0.75, metalness: 0.9, roughness: 0.05,
    });
    const redPlastic = new THREE.MeshStandardMaterial({ color: 0xb01010, roughness: 0.3 });
    for (let i = 0; i < 40; i++) {
      const size = 0.02 + Math.random() * 0.07;
      const isPlastic = i % 5 === 0;
      const shard = new THREE.Mesh(new THREE.BoxGeometry(size, 0.006, size * (0.5 + Math.random())), isPlastic ? redPlastic : glassMat);
      shard.position.set(
        collisionPos.x + (Math.random() - 0.5) * 2.4,
        0.022,
        collisionPos.z + 2.2 + (Math.random() - 0.5) * 2.2
      );
      shard.rotation.y = Math.random() * Math.PI;
      this.scene.add(shard);
    }

    // Steam from the red car's damaged radiator
    this._createSteam(new THREE.Vector3(collisionPos.x + 0.35, 0.95, collisionPos.z + 2.55));

    // Hazard lights (blinking orange) on both cars
    this._addHazardLights(car1);
    this._addHazardLights(car2);

    // Player car (the car with the boot containing vest and triangle)
    const playerCar = this._createCar(0x8e949c, 4.5, 1.9, 1.5);
    playerCar.position.set(collisionPos.x - 2, 0, collisionPos.z - 8);
    playerCar.rotation.y = 0;
    this.scene.add(playerCar);
    this.vehicles.push(playerCar);
    this.playerCar = playerCar;
    this._addHazardLights(playerCar);

    // Open boot: lid hinged at the base of the rear screen, plus dark cargo well
    const L = playerCar.userData.length;
    const s = playerCar.userData.scaleY;
    const hinge = new THREE.Group();
    hinge.position.set(0, 0.97 * s, L * 0.36);
    const bootLid = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.045, 0.7), playerCar.userData.paint);
    bootLid.position.z = 0.35;
    bootLid.castShadow = true;
    hinge.add(bootLid);
    hinge.rotation.x = -1.2; // open angle
    playerCar.add(hinge);

    const well = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.02, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 1 })
    );
    well.position.set(0, 0.955 * s, L * 0.36 + 0.3);
    playerCar.add(well);
  }

  _createSteam(origin) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.5, 'rgba(240,240,240,0.2)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);

    this.steam = [];
    this._steamOrigin = origin;
    for (let i = 0; i < 26; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
      sprite.userData.life = i / 26;   // stagger so the plume is continuous
      sprite.userData.seed = Math.random();
      this.scene.add(sprite);
      this.steam.push(sprite);
    }
  }

  _updateSteam(dt) {
    const o = this._steamOrigin;
    for (const p of this.steam) {
      const u = p.userData;
      u.life += dt / 3.2;
      if (u.life >= 1) {
        u.life -= 1;
        u.seed = Math.random();
      }
      const t = u.life;
      p.position.set(
        o.x + (u.seed - 0.5) * 0.5 + t * 0.9,   // drifts with the wind
        o.y + t * 1.6,
        o.z + (u.seed - 0.5) * 0.4 + t * 0.2
      );
      p.scale.setScalar(0.25 + t * 1.3);
      p.material.opacity = Math.sin(t * Math.PI) * 0.32;
    }
  }

  _createParkedCars() {
    const parked = [
      [0xd9dcdf, -3.3, -46, Math.PI],
      [0x1c1c1e, -3.3, -60, Math.PI],
      [0x2e4a3e, -3.3, 74, Math.PI],
      [0xf2f2f2, -3.3, 88, Math.PI],
      [0x6f5a45, 3.0, -62, 0],
    ];
    for (const [color, x, z, rot] of parked) {
      const car = this._createCar(color);
      car.position.set(x, 0, z);
      car.rotation.y = rot;
      this.scene.add(car);
    }
  }

  _addHazardLights(car) {
    const hazardMat = new THREE.MeshStandardMaterial({
      color: 0xff8800,
      emissive: 0xff9500,
      emissiveIntensity: 0,
      roughness: 0.2,
    });

    const L = car.userData.length || 4.2;
    const W = car.userData.width || 1.8;
    const s = car.userData.scaleY || 1;
    const hazardGeo = new THREE.BoxGeometry(0.12, 0.06, 0.04);
    const hazards = [];

    for (const side of [-1, 1]) {
      for (const end of [-1, 1]) {
        const hazard = new THREE.Mesh(hazardGeo, hazardMat.clone());
        hazard.position.set(side * (W / 2 - 0.12), (end < 0 ? 0.72 : 0.82) * s, end * (L / 2 + 0.01));
        car.add(hazard);
        hazards.push(hazard);
      }
    }

    car.userData.hazards = hazards;
    car.userData.hazardPhase = Math.random() * Math.PI * 2;
  }

  update(time) {
    const dt = this._lastTime === undefined ? 0 : Math.min(time - this._lastTime, 0.1);
    this._lastTime = time;
    this._updateSteam(dt);

    // Blink hazard lights
    for (const vehicle of this.vehicles) {
      if (vehicle.userData.hazards) {
        const blink = Math.sin(time * 5 + vehicle.userData.hazardPhase) > 0 ? 1 : 0;
        for (const hazard of vehicle.userData.hazards) {
          hazard.material.emissiveIntensity = blink * 2.2;
        }
      }
    }
  }
}
