import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class Vehicles {
  constructor(scene) {
    this.scene = scene;
    this.vehicles = [];
    this._createCollisionScene();
  }

  _createCar(color, length = 4.2, width = 1.8, height = 1.4) {
    const car = new THREE.Group();

    // Body
    const bodyGeo = new THREE.BoxGeometry(width, height * 0.5, length);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: color,
      metalness: 0.6,
      roughness: 0.4,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = height * 0.45;
    body.castShadow = true;
    car.add(body);

    // Cabin / roof
    const cabinGeo = new THREE.BoxGeometry(width * 0.85, height * 0.4, length * 0.5);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.3,
      roughness: 0.3,
    });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.y = height * 0.75;
    cabin.position.z = -length * 0.05;
    cabin.castShadow = true;
    car.add(cabin);

    // Windshield (front)
    const windshieldGeo = new THREE.PlaneGeometry(width * 0.8, height * 0.35);
    const windshieldMat = new THREE.MeshStandardMaterial({
      color: 0x88bbdd,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.7,
    });
    const frontWindshield = new THREE.Mesh(windshieldGeo, windshieldMat);
    frontWindshield.position.set(0, height * 0.7, -length * 0.2);
    frontWindshield.rotation.x = 0.3;
    car.add(frontWindshield);

    // Rear windshield
    const rearWindshield = new THREE.Mesh(windshieldGeo, windshieldMat);
    rearWindshield.position.set(0, height * 0.7, length * 0.1);
    rearWindshield.rotation.x = -0.3;
    rearWindshield.rotation.y = Math.PI;
    car.add(rearWindshield);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    const wheelPositions = [
      [-width / 2 - 0.05, 0.3, -length * 0.3],
      [width / 2 + 0.05, 0.3, -length * 0.3],
      [-width / 2 - 0.05, 0.3, length * 0.3],
      [width / 2 + 0.05, 0.3, length * 0.3],
    ];
    for (const [wx, wy, wz] of wheelPositions) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, wy, wz);
      wheel.castShadow = true;
      car.add(wheel);
    }

    // Headlights
    const lightGeo = new THREE.SphereGeometry(0.1, 8, 8);
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0xffffcc,
      emissive: 0xffffcc,
      emissiveIntensity: 0.5,
    });
    for (const side of [-1, 1]) {
      const headlight = new THREE.Mesh(lightGeo, lightMat);
      headlight.position.set(side * width * 0.35, height * 0.4, -length / 2 - 0.05);
      car.add(headlight);
    }

    // Tail lights
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 0.3,
    });
    for (const side of [-1, 1]) {
      const taillight = new THREE.Mesh(lightGeo, tailMat);
      taillight.position.set(side * width * 0.35, height * 0.4, length / 2 + 0.05);
      car.add(taillight);
    }

    return car;
  }

  _createCollisionScene() {
    const collisionPos = CONFIG.COLLISION_POS;

    // Car 1 (blue - the one that was hit, pulled to the side)
    const car1 = this._createCar(0x2255aa);
    car1.position.set(collisionPos.x, 0, collisionPos.z);
    car1.rotation.y = 0.08; // slightly angled
    car1.castShadow = true;
    this.scene.add(car1);
    this.vehicles.push(car1);

    // Car 2 (red - the one that rear-ended)
    const car2 = this._createCar(0xaa2222);
    car2.position.set(collisionPos.x + 0.3, 0, collisionPos.z + 4.5);
    car2.rotation.y = -0.05;
    car2.castShadow = true;
    this.scene.add(car2);
    this.vehicles.push(car2);

    // Damage effect: deform rear of car1 and front of car2
    // Add crumple zone meshes
    const crumpleMat = new THREE.MeshStandardMaterial({
      color: 0x444444,
      roughness: 0.9,
    });

    // Crumpled bumper between the cars
    const crumpleGeo = new THREE.BoxGeometry(1.5, 0.3, 0.5);
    const crumple = new THREE.Mesh(crumpleGeo, crumpleMat);
    crumple.position.set(collisionPos.x + 0.15, 0.4, collisionPos.z + 2.4);
    crumple.rotation.y = 0.03;
    crumple.scale.set(1, 0.7, 1.3);
    this.scene.add(crumple);

    // Broken glass particles on ground
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xaaddff,
      transparent: true,
      opacity: 0.6,
      metalness: 0.9,
      roughness: 0.1,
    });
    for (let i = 0; i < 15; i++) {
      const size = 0.02 + Math.random() * 0.06;
      const glassGeo = new THREE.BoxGeometry(size, 0.005, size);
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.position.set(
        collisionPos.x + (Math.random() - 0.5) * 2,
        0.02,
        collisionPos.z + 2 + (Math.random() - 0.5) * 1.5
      );
      glass.rotation.y = Math.random() * Math.PI;
      this.scene.add(glass);
    }

    // Hazard lights (blinking orange) on both cars
    this._addHazardLights(car1);
    this._addHazardLights(car2);

    // Player car (the car with the boot containing vest and triangle)
    const playerCar = this._createCar(0x556677, 4.5, 1.9, 1.5);
    playerCar.position.set(collisionPos.x - 2, 0, collisionPos.z - 8);
    playerCar.rotation.y = 0;
    this.scene.add(playerCar);
    this.vehicles.push(playerCar);
    this.playerCar = playerCar;

    // Open boot (trunk lid)
    const bootLidGeo = new THREE.BoxGeometry(1.7, 0.05, 1.0);
    const bootLidMat = new THREE.MeshStandardMaterial({ color: 0x556677, metalness: 0.6, roughness: 0.4 });
    const bootLid = new THREE.Mesh(bootLidGeo, bootLidMat);
    // Position at the rear of the player car, angled open
    bootLid.position.set(
      collisionPos.x - 2,
      1.2,
      collisionPos.z - 8 + 2.5
    );
    bootLid.rotation.x = -0.8; // open angle
    bootLid.castShadow = true;
    this.scene.add(bootLid);
  }

  _addHazardLights(car) {
    const hazardMat = new THREE.MeshStandardMaterial({
      color: 0xff8800,
      emissive: 0xff8800,
      emissiveIntensity: 0,
    });

    const hazardGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const hazards = [];

    for (const side of [-1, 1]) {
      for (const end of [-1, 1]) {
        const hazard = new THREE.Mesh(hazardGeo, hazardMat.clone());
        hazard.position.set(side * 0.85, 0.55, end * 2.15);
        car.add(hazard);
        hazards.push(hazard);
      }
    }

    car.userData.hazards = hazards;
    car.userData.hazardPhase = Math.random() * Math.PI * 2;
  }

  update(time) {
    // Blink hazard lights
    for (const vehicle of this.vehicles) {
      if (vehicle.userData.hazards) {
        const blink = Math.sin(time * 5 + vehicle.userData.hazardPhase) > 0 ? 1 : 0;
        for (const hazard of vehicle.userData.hazards) {
          hazard.material.emissiveIntensity = blink * 0.8;
        }
      }
    }
  }
}
