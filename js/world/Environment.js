import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.navMeshObjects = [];
    this._createSkybox();
    this._createGround();
    this._createRoad();
    this._createSidewalk();
    this._createBuildings();
    this._createTrees();
    this._createLampPosts();
  }

  _createSkybox() {
    // Procedural sky gradient using shader
    const skyGeo = new THREE.SphereGeometry(400, 32, 15);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x0077ff) },
        bottomColor: { value: new THREE.Color(0x87ceeb) },
        offset: { value: 20 },
        exponent: { value: 0.4 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide,
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));

    // Sun disc
    const sunGeo = new THREE.CircleGeometry(15, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffcc, side: THREE.DoubleSide });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.position.set(100, 150, -200);
    sun.lookAt(0, 0, 0);
    this.scene.add(sun);
  }

  _createGround() {
    // Grass / general ground
    const groundGeo = new THREE.PlaneGeometry(CONFIG.GROUND_SIZE, CONFIG.GROUND_SIZE);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x4a7c3f,
      roughness: 0.9,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.navMeshObjects.push(ground);
  }

  _createRoad() {
    // Main road surface
    const roadGeo = new THREE.PlaneGeometry(CONFIG.ROAD_WIDTH, CONFIG.ROAD_LENGTH);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.8,
    });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.01;
    road.receiveShadow = true;
    this.scene.add(road);
    this.navMeshObjects.push(road);

    // Road dashes (center line)
    const dashMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    for (let z = -CONFIG.ROAD_LENGTH / 2; z < CONFIG.ROAD_LENGTH / 2; z += 4) {
      const dashGeo = new THREE.PlaneGeometry(0.15, 2);
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.02, z);
      this.scene.add(dash);
    }

    // Road edge lines
    for (const side of [-1, 1]) {
      const edgeGeo = new THREE.PlaneGeometry(0.12, CONFIG.ROAD_LENGTH);
      const edge = new THREE.Mesh(edgeGeo, dashMat);
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(side * (CONFIG.ROAD_WIDTH / 2 - 0.2), 0.02, 0);
      this.scene.add(edge);
    }

    // Sidewalk on both sides
    for (const side of [-1, 1]) {
      const sidewalkGeo = new THREE.BoxGeometry(2, 0.15, CONFIG.ROAD_LENGTH);
      const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.7 });
      const sidewalk = new THREE.Mesh(sidewalkGeo, sidewalkMat);
      sidewalk.position.set(side * (CONFIG.ROAD_WIDTH / 2 + 1), 0.075, 0);
      sidewalk.receiveShadow = true;
      sidewalk.castShadow = true;
      this.scene.add(sidewalk);
      this.navMeshObjects.push(sidewalk);
    }
  }

  _createSidewalk() {
    // Curbs
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
    for (const side of [-1, 1]) {
      const curbGeo = new THREE.BoxGeometry(0.2, 0.15, CONFIG.ROAD_LENGTH);
      const curb = new THREE.Mesh(curbGeo, curbMat);
      curb.position.set(side * (CONFIG.ROAD_WIDTH / 2 + 0.1), 0.075, 0);
      curb.castShadow = true;
      this.scene.add(curb);
    }
  }

  _createBuildings() {
    const buildingMats = [
      new THREE.MeshStandardMaterial({ color: 0xccbbaa }),
      new THREE.MeshStandardMaterial({ color: 0xbbaa99 }),
      new THREE.MeshStandardMaterial({ color: 0xddccbb }),
      new THREE.MeshStandardMaterial({ color: 0xaa9988 }),
    ];

    // Place buildings along both sides of the road
    for (const side of [-1, 1]) {
      for (let i = 0; i < 8; i++) {
        const w = 6 + Math.random() * 4;
        const h = 8 + Math.random() * 12;
        const d = 6 + Math.random() * 4;
        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = buildingMats[Math.floor(Math.random() * buildingMats.length)];
        const building = new THREE.Mesh(geo, mat);

        const xOffset = side * (CONFIG.ROAD_WIDTH / 2 + 5 + w / 2);
        const zOffset = -40 + i * 14 + (Math.random() - 0.5) * 3;
        building.position.set(xOffset, h / 2, zOffset);
        building.castShadow = true;
        building.receiveShadow = true;
        this.scene.add(building);

        // Windows
        this._addWindows(building, w, h, d, side);
      }
    }
  }

  _addWindows(building, w, h, d, side) {
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x88bbdd,
      emissive: 0x112233,
      metalness: 0.8,
      roughness: 0.2,
    });

    const winW = 0.8;
    const winH = 1.2;
    const floors = Math.floor(h / 3.5);
    const cols = Math.floor(w / 2.5);

    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        const winGeo = new THREE.PlaneGeometry(winW, winH);
        const win = new THREE.Mesh(winGeo, windowMat);
        const wx = -w / 2 + 1.5 + c * 2.2;
        const wy = -h / 2 + 2 + f * 3.2;
        // Face toward road
        win.position.set(wx, wy, -side * (d / 2 + 0.01));
        if (side < 0) win.rotation.y = Math.PI;
        building.add(win);
      }
    }
  }

  _createTrees() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3222 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2d5a1e });

    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const tree = new THREE.Group();

        // Trunk
        const trunkGeo = new THREE.CylinderGeometry(0.15, 0.2, 2.5, 8);
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.25;
        trunk.castShadow = true;
        tree.add(trunk);

        // Foliage (sphere)
        const foliageGeo = new THREE.SphereGeometry(1.5, 8, 6);
        const foliage = new THREE.Mesh(foliageGeo, foliageMat);
        foliage.position.y = 3.5;
        foliage.castShadow = true;
        tree.add(foliage);

        const x = side * (CONFIG.ROAD_WIDTH / 2 + 2.5);
        const z = -30 + i * 12;
        tree.position.set(x, 0, z);
        this.scene.add(tree);
      }
    }
  }

  _createLampPosts() {
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.8 });

    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const post = new THREE.Group();

        // Pole
        const poleGeo = new THREE.CylinderGeometry(0.05, 0.08, 5, 8);
        const pole = new THREE.Mesh(poleGeo, metalMat);
        pole.position.y = 2.5;
        post.add(pole);

        // Arm
        const armGeo = new THREE.BoxGeometry(1.2, 0.05, 0.05);
        const arm = new THREE.Mesh(armGeo, metalMat);
        arm.position.set(-side * 0.6, 5, 0);
        post.add(arm);

        // Lamp head
        const lampGeo = new THREE.BoxGeometry(0.4, 0.1, 0.2);
        const lampMat = new THREE.MeshStandardMaterial({
          color: 0xffffee,
          emissive: 0x332200,
          emissiveIntensity: 0.2,
        });
        const lamp = new THREE.Mesh(lampGeo, lampMat);
        lamp.position.set(-side * 1.1, 4.95, 0);
        post.add(lamp);

        const x = side * (CONFIG.ROAD_WIDTH / 2 + 2);
        const z = -25 + i * 18;
        post.position.set(x, 0, z);
        post.castShadow = true;
        this.scene.add(post);
      }
    }
  }
}
