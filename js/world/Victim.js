import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class Victim {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.swayTime = 0;
    this._build();

    const pos = CONFIG.VICTIM_POS;
    this.group.position.set(pos.x, pos.y, pos.z);
    this.scene.add(this.group);
  }

  _build() {
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe0b090, roughness: 0.8 });
    const clothMat = new THREE.MeshStandardMaterial({ color: 0x3355aa, roughness: 0.7 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x222244, roughness: 0.7 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x332211, roughness: 0.9 });

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.45, 0.6, 0.25);
    this.torso = new THREE.Mesh(torsoGeo, clothMat);
    this.torso.position.y = 1.15;
    this.torso.castShadow = true;
    this.group.add(this.torso);

    // Head
    const headGeo = new THREE.SphereGeometry(0.14, 12, 10);
    this.head = new THREE.Mesh(headGeo, skinMat);
    this.head.position.y = 1.65;
    this.head.scale.set(1, 1.1, 1);
    this.head.castShadow = true;
    this.group.add(this.head);

    // Hair
    const hairGeo = new THREE.SphereGeometry(0.15, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 1.7;
    this.group.add(hair);

    // Face features
    // Eyes (closed - dazed look)
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    for (const side of [-1, 1]) {
      const eyeGeo = new THREE.BoxGeometry(0.04, 0.008, 0.01);
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(side * 0.05, 1.66, -0.13);
      this.group.add(eye);
    }

    // Mouth (slightly open - distress)
    const mouthGeo = new THREE.BoxGeometry(0.04, 0.02, 0.01);
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x993333 });
    const mouth = new THREE.Mesh(mouthGeo, mouthMat);
    mouth.position.set(0, 1.58, -0.13);
    this.group.add(mouth);

    // Neck
    const neckGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8);
    const neck = new THREE.Mesh(neckGeo, skinMat);
    neck.position.y = 1.48;
    this.group.add(neck);

    // Arms
    for (const side of [-1, 1]) {
      // Upper arm
      const upperArmGeo = new THREE.BoxGeometry(0.12, 0.35, 0.12);
      const upperArm = new THREE.Mesh(upperArmGeo, clothMat);
      upperArm.position.set(side * 0.3, 1.1, 0);
      upperArm.rotation.z = side * 0.15; // slightly drooping
      upperArm.castShadow = true;
      this.group.add(upperArm);

      // Lower arm
      const lowerArmGeo = new THREE.BoxGeometry(0.1, 0.3, 0.1);
      const lowerArm = new THREE.Mesh(lowerArmGeo, skinMat);
      lowerArm.position.set(side * 0.35, 0.82, 0.05);
      lowerArm.rotation.z = side * 0.3;
      lowerArm.rotation.x = -0.2; // arms forward slightly (dazed posture)
      lowerArm.castShadow = true;
      this.group.add(lowerArm);

      // Hand
      const handGeo = new THREE.SphereGeometry(0.05, 8, 6);
      const hand = new THREE.Mesh(handGeo, skinMat);
      hand.position.set(side * 0.4, 0.65, 0.08);
      this.group.add(hand);
    }

    // Legs
    for (const side of [-1, 1]) {
      // Upper leg
      const upperLegGeo = new THREE.BoxGeometry(0.16, 0.45, 0.16);
      const upperLeg = new THREE.Mesh(upperLegGeo, pantsMat);
      upperLeg.position.set(side * 0.12, 0.6, 0);
      upperLeg.castShadow = true;
      this.group.add(upperLeg);

      // Lower leg
      const lowerLegGeo = new THREE.BoxGeometry(0.13, 0.4, 0.13);
      const lowerLeg = new THREE.Mesh(lowerLegGeo, pantsMat);
      lowerLeg.position.set(side * 0.12, 0.2, 0);
      lowerLeg.castShadow = true;
      this.group.add(lowerLeg);

      // Shoe
      const shoeGeo = new THREE.BoxGeometry(0.13, 0.08, 0.22);
      const shoe = new THREE.Mesh(shoeGeo, shoeMat);
      shoe.position.set(side * 0.12, 0.04, -0.03);
      shoe.castShadow = true;
      this.group.add(shoe);
    }

    // Distress indicator: small sweat drops
    const sweatMat = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.6,
    });
    for (let i = 0; i < 3; i++) {
      const sweatGeo = new THREE.SphereGeometry(0.015, 6, 4);
      const sweat = new THREE.Mesh(sweatGeo, sweatMat);
      sweat.position.set(
        0.15 + i * 0.03,
        1.7 - i * 0.03,
        -0.1
      );
      sweat.userData.baseY = sweat.position.y;
      sweat.userData.phase = i * 0.5;
      this.group.add(sweat);
    }
  }

  getMesh() {
    return this.group;
  }

  getPosition() {
    return this.group.position.clone();
  }

  update(dt, elapsed) {
    this.swayTime += dt;

    // Dazed swaying motion
    const swayAmount = 0.02;
    this.torso.rotation.z = Math.sin(this.swayTime * 1.5) * swayAmount;
    this.torso.rotation.x = Math.sin(this.swayTime * 0.8) * swayAmount * 0.5;

    // Head wobble
    this.head.rotation.z = Math.sin(this.swayTime * 2.0 + 0.5) * swayAmount * 1.5;
    this.head.rotation.x = Math.sin(this.swayTime * 1.2) * swayAmount;

    // Sweat drop animation
    this.group.children.forEach(child => {
      if (child.userData.baseY !== undefined) {
        child.position.y = child.userData.baseY +
          Math.sin(elapsed * 3 + child.userData.phase) * 0.01;
        child.material.opacity = 0.3 + 0.3 * Math.sin(elapsed * 2 + child.userData.phase);
      }
    });
  }
}
