import * as THREE from 'three';
import { CONFIG } from '../config.js';

// Direction the sun shines from; kept in sync with the directional light.
export const SUN_DIRECTION = new THREE.Vector3(30, 50, 30).normalize();

// Deterministic RNG so the street looks the same on every load.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function speckle(ctx, w, h, count, rand, colors, maxSize = 2) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    const s = 0.5 + rand() * maxSize;
    ctx.fillRect(rand() * w, rand() * h, s, s);
  }
}

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.navMeshObjects = [];
    this.rand = mulberry32(112);

    this._createSkybox();
    this._createGround();
    this._createRoad();
    this._createSidewalk();
    this._createBuildings();
    this._createTrees();
    this._createLampPosts();
    this._createStreetFurniture();
  }

  // Wind in the trees and drifting clouds
  update(elapsed) {
    this.sky.material.uniforms.time.value = elapsed;
    for (const t of this.trees) {
      t.rotation.z = Math.sin(elapsed * 0.9 + t.userData.phase) * 0.012;
      t.rotation.x = Math.sin(elapsed * 0.7 + t.userData.phase * 1.7) * 0.008;
    }
  }

  // ── Sky ───────────────────────────────────────────────────────────────────

  _createSkybox() {
    const skyGeo = new THREE.SphereGeometry(400, 48, 24);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        zenithColor: { value: new THREE.Color(0x2f6fd6) },
        horizonColor: { value: new THREE.Color(0xcfe3f5) },
        groundColor: { value: new THREE.Color(0xb9c6cf) },
        sunDir: { value: SUN_DIRECTION.clone() },
        time: { value: 0 },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 zenithColor;
        uniform vec3 horizonColor;
        uniform vec3 groundColor;
        uniform vec3 sunDir;
        uniform float time;
        varying vec3 vDir;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        float fbm(vec2 p) {
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
          return v;
        }

        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = mix(horizonColor, zenithColor, pow(clamp(h, 0.0, 1.0), 0.55));
          col = mix(col, groundColor, smoothstep(0.0, -0.08, h));
          float s = max(dot(d, sunDir), 0.0);
          col += vec3(1.0, 0.92, 0.78) * pow(s, 8.0) * 0.35;   // broad glow
          col += vec3(1.0, 0.96, 0.9) * pow(s, 900.0) * 6.0;   // sun disc
          // Fair-weather cumulus: projected onto a cloud layer, thinning toward the horizon
          if (h > 0.0) {
            vec2 uv = d.xz / (h + 0.08) * 0.9 + vec2(time * 0.004, time * 0.0015);
            float c = smoothstep(0.52, 0.78, fbm(uv));
            float lit = 0.85 + 0.15 * max(dot(d, sunDir), 0.0);
            col = mix(col, vec3(1.0, 0.99, 0.97) * lit, c * smoothstep(0.02, 0.22, h) * 0.85);
          }
          col = mix(col, horizonColor * 1.05, exp(-abs(h) * 18.0) * 0.5); // haze band
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1;
    this.scene.add(this.sky);
  }

  // ── Ground, road, sidewalk ───────────────────────────────────────────────

  _createGround() {
    const rand = this.rand;
    const grassTex = canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#4f7a3a';
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 5000, rand, ['#3f6a2e', '#5c8a44', '#6b9750', '#476f35'], 2.5);
    }, { repeat: [60, 60] });

    const groundGeo = new THREE.PlaneGeometry(CONFIG.GROUND_SIZE, CONFIG.GROUND_SIZE);
    const groundMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.navMeshObjects.push(ground);
  }

  _createRoad() {
    const rand = this.rand;
    const L = CONFIG.ROAD_LENGTH;
    const W = CONFIG.ROAD_WIDTH;

    // Asphalt: fine aggregate, tyre-worn lanes, a few crack lines
    const asphaltTex = canvasTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#3a3b3d';
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 22000, rand, ['#2f3032', '#46474a', '#505154', '#34353a', '#5a5b5e'], 1.8);
      // Wheel tracks (slightly polished, darker)
      for (const x of [0.17, 0.33, 0.67, 0.83]) {
        const g = ctx.createLinearGradient(x * w - 22, 0, x * w + 22, 0);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.5, 'rgba(0,0,0,0.12)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x * w - 22, 0, 44, h);
      }
      ctx.strokeStyle = 'rgba(20,20,22,0.55)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        let x = rand() * w;
        let y = rand() * h;
        ctx.moveTo(x, y);
        for (let k = 0; k < 8; k++) {
          x += (rand() - 0.5) * 30;
          y += rand() * 22;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }, { repeat: [1, L / W] });

    const roadGeo = new THREE.PlaneGeometry(W, L);
    const roadMat = new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.88, metalness: 0.0 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.01;
    road.receiveShadow = true;
    this.scene.add(road);
    this.navMeshObjects.push(road);

    // Lane markings (instanced dashes)
    const markMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 });
    const dashGeo = new THREE.PlaneGeometry(0.15, 3);
    dashGeo.rotateX(-Math.PI / 2);
    const dashCount = Math.floor(L / 9);
    const dashes = new THREE.InstancedMesh(dashGeo, markMat, dashCount);
    const m = new THREE.Matrix4();
    for (let i = 0; i < dashCount; i++) {
      m.makeTranslation(0, 0.02, -L / 2 + 4.5 + i * 9);
      dashes.setMatrixAt(i, m);
    }
    dashes.receiveShadow = true;
    this.scene.add(dashes);

    // Road edge lines
    for (const side of [-1, 1]) {
      const edgeGeo = new THREE.PlaneGeometry(0.12, L);
      const edge = new THREE.Mesh(edgeGeo, markMat);
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(side * (W / 2 - 0.35), 0.02, 0);
      edge.receiveShadow = true;
      this.scene.add(edge);
    }

    // Zebra crossing behind the start point
    for (let i = 0; i < 7; i++) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3.2), markMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(-W / 2 + 0.9 + i * 1.03, 0.021, -22);
      stripe.receiveShadow = true;
      this.scene.add(stripe);
    }

    // Manhole covers
    const coverMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2c, metalness: 0.7, roughness: 0.5 });
    for (const [x, z] of [[-1.8, -14], [1.9, 18], [-2.1, 36], [2.0, 70]]) {
      const cover = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.015, 24), coverMat);
      cover.position.set(x, 0.015, z);
      cover.receiveShadow = true;
      this.scene.add(cover);
    }

    // Sidewalk on both sides (paving tiles)
    const paveTex = canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#a7a39c';
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 3500, rand, ['#9a968f', '#b3afa8', '#8f8b85'], 1.5);
      ctx.strokeStyle = 'rgba(70,66,60,0.55)';
      ctx.lineWidth = 2;
      const n = 4; // 4 x 4 tiles per texture => 0.5 m tiles at repeat below
      for (let i = 0; i <= n; i++) {
        ctx.beginPath(); ctx.moveTo(i * w / n, 0); ctx.lineTo(i * w / n, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * h / n); ctx.lineTo(w, i * h / n); ctx.stroke();
      }
    }, { repeat: [1, L / 2] });

    for (const side of [-1, 1]) {
      const sidewalkGeo = new THREE.BoxGeometry(2, 0.15, L);
      const sidewalkMat = new THREE.MeshStandardMaterial({ map: paveTex, roughness: 0.85 });
      const sidewalk = new THREE.Mesh(sidewalkGeo, sidewalkMat);
      sidewalk.position.set(side * (W / 2 + 1), 0.075, 0);
      sidewalk.receiveShadow = true;
      sidewalk.castShadow = true;
      this.scene.add(sidewalk);
      this.navMeshObjects.push(sidewalk);
    }
  }

  _createSidewalk() {
    // Granite curbs with a small bevel
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xbdbab4, roughness: 0.7 });
    for (const side of [-1, 1]) {
      const curbGeo = new THREE.BoxGeometry(0.22, 0.17, CONFIG.ROAD_LENGTH);
      const curb = new THREE.Mesh(curbGeo, curbMat);
      curb.position.set(side * (CONFIG.ROAD_WIDTH / 2 + 0.1), 0.085, 0);
      curb.castShadow = true;
      curb.receiveShadow = true;
      this.scene.add(curb);
    }
  }

  // ── Buildings ────────────────────────────────────────────────────────────

  _facadeTexture(wM, hM, style) {
    const rand = this.rand;
    const ppm = 28; // pixels per metre
    return canvasTexture(Math.ceil(wM * ppm), Math.ceil(hM * ppm), (ctx, w, h) => {
      // Wall with plaster noise
      ctx.fillStyle = style.wall;
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, (w * h) / 18, rand, ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.05)'], 2);

      const floorH = 3.2 * ppm;
      const groundH = 4.0 * ppm;
      const floors = Math.floor((h - groundH) / floorH);
      const bay = 2.4 * ppm;
      const cols = Math.max(1, Math.floor(w / bay));
      const offX = (w - cols * bay) / 2;

      // Upper floors
      for (let f = 0; f < floors; f++) {
        const fy = h - groundH - (f + 1) * floorH;
        // Cornice line
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(0, fy + floorH - 3, w, 3);
        for (let c = 0; c < cols; c++) {
          const wx = offX + c * bay + bay * 0.22;
          const ww = bay * 0.56;
          const wy = fy + floorH * 0.2;
          const wh = floorH * 0.6;
          // Frame
          ctx.fillStyle = style.frame;
          ctx.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
          // Glass: sky reflection gradient, sometimes a warm interior / blind
          const g = ctx.createLinearGradient(0, wy, 0, wy + wh);
          g.addColorStop(0, '#9fc3e0');
          g.addColorStop(0.55, '#4f6f8d');
          g.addColorStop(1, '#2b3d52');
          ctx.fillStyle = g;
          ctx.fillRect(wx, wy, ww, wh);
          const r = rand();
          if (r < 0.18) {
            ctx.fillStyle = 'rgba(235, 225, 205, 0.85)';
            ctx.fillRect(wx, wy, ww, wh * (0.3 + rand() * 0.5));
          } else if (r < 0.28) {
            ctx.fillStyle = 'rgba(255, 214, 150, 0.35)';
            ctx.fillRect(wx, wy, ww, wh);
          }
          // Mullion + sill
          ctx.fillStyle = style.frame;
          ctx.fillRect(wx + ww / 2 - 1.5, wy, 3, wh);
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(wx - 5, wy + wh + 3, ww + 10, 3);
        }
      }

      // Ground-floor shopfront
      const gy = h - groundH;
      ctx.fillStyle = style.base;
      ctx.fillRect(0, gy, w, groundH);
      const sg = ctx.createLinearGradient(0, gy + groundH * 0.3, 0, h);
      sg.addColorStop(0, '#7fa2bf');
      sg.addColorStop(1, '#1d2833');
      ctx.fillStyle = sg;
      ctx.fillRect(w * 0.06, gy + groundH * 0.32, w * 0.88, groundH * 0.64);
      ctx.fillStyle = style.base;
      for (let k = 1; k < 4; k++) ctx.fillRect(w * 0.06 + (w * 0.88 * k) / 4 - 2, gy + groundH * 0.32, 4, groundH * 0.64);
      // Awning / sign band
      ctx.fillStyle = style.accent;
      ctx.fillRect(w * 0.04, gy + groundH * 0.1, w * 0.92, groundH * 0.16);
    });
  }

  _createBuildings() {
    const rand = this.rand;
    const styles = [
      { wall: '#e8dccb', frame: '#f7f3ec', base: '#6d6a66', accent: '#2f5d8a' },
      { wall: '#d4b79a', frame: '#efe6da', base: '#4b4744', accent: '#8a2f2f' },
      { wall: '#f1ede6', frame: '#cfcac2', base: '#5a5f66', accent: '#2f7a55' },
      { wall: '#c9cfd4', frame: '#ffffff', base: '#3e4247', accent: '#b8862b' },
      { wall: '#e3c7b0', frame: '#fbf6ef', base: '#5b4e45', accent: '#3a3a3c' },
      { wall: '#bfae9c', frame: '#ece4d8', base: '#474341', accent: '#6b4c8a' },
    ];
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x5b5d61, roughness: 0.9 });
    const parapetMat = new THREE.MeshStandardMaterial({ color: 0x8e8b86, roughness: 0.8 });

    for (const side of [-1, 1]) {
      let z = -CONFIG.ROAD_LENGTH / 2 + 4;
      while (z < CONFIG.ROAD_LENGTH / 2 - 6) {
        const w = 7 + rand() * 5;     // along the street (z)
        const d = 8 + rand() * 4;     // depth (x)
        const h = 10 + Math.floor(rand() * 5) * 3.2;
        const style = styles[Math.floor(rand() * styles.length)];

        const facade = this._facadeTexture(w, h, style);
        const sideFacade = this._facadeTexture(d, h, style);
        const wallMat = new THREE.MeshStandardMaterial({ map: facade, roughness: 0.85 });
        const sideMat = new THREE.MeshStandardMaterial({ map: sideFacade, roughness: 0.85 });
        // Box faces: +x, -x, +y, -y, +z, -z
        const mats = [wallMat, wallMat, roofMat, roofMat, sideMat, sideMat];
        const geo = new THREE.BoxGeometry(d, h, w);
        const building = new THREE.Mesh(geo, mats);
        building.position.set(side * (CONFIG.ROAD_WIDTH / 2 + 2 + 3 + d / 2), h / 2, z + w / 2);
        building.castShadow = true;
        building.receiveShadow = true;
        this.scene.add(building);

        // Parapet
        const parapet = new THREE.Mesh(new THREE.BoxGeometry(d + 0.3, 0.5, w + 0.3), parapetMat);
        parapet.position.set(0, h / 2 + 0.25, 0);
        parapet.castShadow = true;
        building.add(parapet);

        // Rooftop plant box on some buildings
        if (rand() < 0.5) {
          const unit = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 2.2), parapetMat);
          unit.position.set((rand() - 0.5) * d * 0.5, h / 2 + 0.5, (rand() - 0.5) * w * 0.5);
          unit.castShadow = true;
          building.add(unit);
        }

        z += w + 0.2 + rand() * 1.5;
      }
    }

    // Front-yard hedges between sidewalk and buildings
    const leafTex = canvasTexture(128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#35602a';
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 2600, rand, ['#2a4f21', '#3f7031', '#4b7f39', '#23441c'], 4);
    }, { repeat: [1, 90] });
    const hedgeMat = new THREE.MeshStandardMaterial({ map: leafTex, roughness: 1 });
    for (const side of [-1, 1]) {
      const hedge = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, CONFIG.ROAD_LENGTH - 8), hedgeMat);
      hedge.position.set(side * (CONFIG.ROAD_WIDTH / 2 + 2 + 0.6), 0.3, 0);
      hedge.castShadow = true;
      hedge.receiveShadow = true;
      this.scene.add(hedge);
    }
  }

  // ── Vegetation ───────────────────────────────────────────────────────────

  _createTrees() {
    const rand = this.rand;
    this.trees = [];
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4332, roughness: 0.95 });
    const leafMats = [0x3f7a2e, 0x4c8a37, 0x356b28, 0x5a9440].map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true })
    );
    const pitMat = new THREE.MeshStandardMaterial({ color: 0x3b2f25, roughness: 1 });
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 3, 10);
    const clumpGeo = new THREE.IcosahedronGeometry(1, 1);

    for (const side of [-1, 1]) {
      for (let i = 0; i < 14; i++) {
        const z = -90 + i * 13 + (rand() - 0.5) * 2;
        // Keep the accident zone and triangle zone readable
        if (Math.abs(z - CONFIG.COLLISION_POS.z) < 5 && side > 0) continue;

        const tree = new THREE.Group();
        const scale = 0.85 + rand() * 0.35;

        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.5;
        trunk.castShadow = true;
        tree.add(trunk);

        const clumps = 4 + Math.floor(rand() * 3);
        for (let k = 0; k < clumps; k++) {
          const clump = new THREE.Mesh(clumpGeo, leafMats[Math.floor(rand() * leafMats.length)]);
          const a = (k / clumps) * Math.PI * 2 + rand();
          const r = k === 0 ? 0 : 0.7 + rand() * 0.4;
          clump.position.set(Math.cos(a) * r, 3.6 + rand() * 0.9 + (k === 0 ? 0.5 : 0), Math.sin(a) * r);
          clump.scale.setScalar(0.9 + rand() * 0.6);
          clump.rotation.set(rand() * 3, rand() * 3, rand() * 3);
          clump.castShadow = true;
          tree.add(clump);
        }

        const pit = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.02, 1.1), pitMat);
        pit.position.y = 0.155;
        pit.receiveShadow = true;
        tree.add(pit);

        tree.scale.setScalar(scale);
        tree.userData.phase = rand() * Math.PI * 2;
        this.trees.push(tree);
        tree.position.set(side * (CONFIG.ROAD_WIDTH / 2 + 1.35), 0, z);
        this.scene.add(tree);
      }
    }
  }

  // ── Street lighting & furniture ──────────────────────────────────────────

  _createLampPosts() {
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.85, roughness: 0.35 });
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0xfff6e0, emissive: 0xfff1d0, emissiveIntensity: 0.4, roughness: 0.2,
    });
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.1, 6.5, 12);
    const armCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 6.2, 0), new THREE.Vector3(0, 7.0, 0), new THREE.Vector3(1.4, 6.9, 0)
    );
    const armGeo = new THREE.TubeGeometry(armCurve, 16, 0.045, 8);
    const headGeo = new THREE.BoxGeometry(0.7, 0.08, 0.26);
    const lensGeo = new THREE.PlaneGeometry(0.6, 0.18);

    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const post = new THREE.Group();
        const pole = new THREE.Mesh(poleGeo, metalMat);
        pole.position.y = 3.25;
        pole.castShadow = true;
        post.add(pole);

        const arm = new THREE.Mesh(armGeo, metalMat);
        arm.castShadow = true;
        post.add(arm);

        const head = new THREE.Mesh(headGeo, metalMat);
        head.position.set(1.55, 6.88, 0);
        head.castShadow = true;
        post.add(head);

        const lens = new THREE.Mesh(lensGeo, lensMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(1.55, 6.835, 0);
        post.add(lens);

        post.rotation.y = side > 0 ? Math.PI : 0;
        post.position.set(side * (CONFIG.ROAD_WIDTH / 2 + 0.45), 0, -70 + i * 28);
        this.scene.add(post);
      }
    }
  }

  _createStreetFurniture() {
    const steel = new THREE.MeshStandardMaterial({ color: 0x4a4d52, metalness: 0.8, roughness: 0.4 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.8 });
    const binMat = new THREE.MeshStandardMaterial({ color: 0x2f6e4f, metalness: 0.3, roughness: 0.6 });
    const signWhite = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.5 });

    // Benches
    for (const [side, z] of [[-1, -30], [-1, 26], [1, -58], [1, 44]]) {
      const bench = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 1.8), wood);
        slat.position.set(k * 0.14 - 0.14, 0.48, 0);
        slat.castShadow = true;
        bench.add(slat);
      }
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 1.8), wood);
      back.position.set(0.24 * side, 0.72, 0);
      back.castShadow = true;
      bench.add(back);
      for (const lz of [-0.75, 0.75]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.46, 0.05), steel);
        leg.position.set(0, 0.23, lz);
        bench.add(leg);
      }
      bench.position.set(side * (CONFIG.ROAD_WIDTH / 2 + 1.5), 0.15, z);
      this.scene.add(bench);
    }

    // Litter bins
    for (const [side, z] of [[-1, -27], [1, -55], [1, 40], [-1, 62]]) {
      const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.22, 0.9, 16), binMat);
      bin.position.set(side * (CONFIG.ROAD_WIDTH / 2 + 1.6), 0.6, z);
      bin.castShadow = true;
      this.scene.add(bin);
    }

    // Bollards along the zebra crossing
    for (const side of [-1, 1]) {
      for (const dz of [-2, 2]) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.9, 12), steel);
        b.position.set(side * (CONFIG.ROAD_WIDTH / 2 + 0.4), 0.6, -22 + dz);
        b.castShadow = true;
        this.scene.add(b);
      }
    }

    // Speed-limit signs (50 km/h)
    const sign50 = canvasTexture(128, 128, (ctx) => {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(64, 64, 60, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d62020';
      ctx.beginPath(); ctx.arc(64, 64, 60, 0, Math.PI * 2); ctx.arc(64, 64, 46, 0, Math.PI * 2, true); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.font = 'bold 50px "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('50', 64, 68);
    });
    for (const [side, z, rot] of [[1, -34, 0], [-1, 80, Math.PI]]) {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.6, 10), steel);
      pole.position.y = 1.3;
      pole.castShadow = true;
      g.add(pole);
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.32, 32), new THREE.MeshStandardMaterial({ map: sign50, roughness: 0.4 }));
      face.position.set(0, 2.4, 0.03);
      g.add(face);
      const backPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.02, 32), steel);
      backPlate.rotation.x = Math.PI / 2;
      backPlate.position.set(0, 2.4, 0.01);
      g.add(backPlate);
      g.rotation.y = rot;
      g.position.set(side * (CONFIG.ROAD_WIDTH / 2 + 0.5), 0.15, z);
      this.scene.add(g);
    }

    // Pedestrian-crossing sign
    for (const side of [-1, 1]) {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.6, 10), steel);
      pole.position.y = 1.3;
      g.add(pole);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.02), new THREE.MeshStandardMaterial({ color: 0x1f5fbf, roughness: 0.4 }));
      plate.position.y = 2.4;
      g.add(plate);
      const tri = new THREE.Mesh(new THREE.CircleGeometry(0.2, 3), signWhite);
      tri.rotation.z = Math.PI / 2;
      tri.position.set(0, 2.38, 0.012);
      g.add(tri);
      g.rotation.y = side > 0 ? 0 : Math.PI;
      g.position.set(side * (CONFIG.ROAD_WIDTH / 2 + 0.5), 0.15, -25.5);
      this.scene.add(g);
    }

  }
}
