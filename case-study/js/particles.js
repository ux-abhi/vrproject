import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// One particle system for the whole page. It never resets: it always holds a
// "from" formation (A), a "to" formation (B) and a mix between them.

const BG = 0x020203;
const CAM_DIST = 18;

const vertexShader = /* glsl */ `
  attribute vec3 posA;
  attribute vec3 posB;
  attribute vec3 colA;
  attribute vec3 colB;
  attribute vec4 auxA;   // alpha, size, group, drift
  attribute vec4 auxB;
  attribute float seed;

  uniform float uMix;
  uniform float uTime;
  uniform float uFocus;
  uniform float uPixelRatio;
  uniform float uSize;
  uniform vec3 uMouse;
  uniform float uMouseStrength;

  varying vec3 vColor;
  varying float vAlpha;

  // Cheap flow field (sum of sines) used to carry points between shapes
  vec3 flow(vec3 p, float t) {
    return vec3(
      sin(p.y * 0.55 + t * 0.7) + sin(p.z * 0.8 + t * 0.4),
      cos(p.x * 0.45 - t * 0.6) + sin(p.z * 0.6 - t * 0.5),
      sin(p.x * 0.35 + p.y * 0.35 + t * 0.5)
    );
  }

  void main() {
    // Transitions sweep across the scene from left to right, with per-point jitter,
    // so outgoing and incoming shapes overlap instead of hard-cutting.
    float sweep = clamp((posB.x + 9.0) / 18.0, 0.0, 1.0);
    float t = clamp(uMix * 1.8 - (seed * 0.45 + sweep * 0.35), 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);

    vec3 p = mix(posA, posB, t);

    // In transit, points ride a slow, smooth current (depends on scroll, not time)
    float transit = sin(t * 3.14159);
    p += flow(posA * 0.35 + seed * 2.0, seed * 6.0) * transit * 0.9;
    p.z += (seed - 0.5) * transit * 3.0;

    vec4 aux = mix(auxA, auxB, t);

    // Idle motion: built things are still; concept things drift slowly
    float drift = aux.w * 0.12;
    p += flow(p * 0.3 + seed * 11.0, uTime * 0.18) * drift * 0.5;

    // Cursor gently parts the particles
    vec2 d = p.xy - uMouse.xy;
    float dist = length(d);
    float push = max(0.0, 1.0 - dist / 1.6);
    p.xy += normalize(d + 1e-5) * push * push * 0.45 * uMouseStrength;

    // Focus: highlight one group, dim the rest
    float g = t < 0.5 ? auxA.z : auxB.z;
    float focus = uFocus < 0.0 ? 1.0 : (abs(g - uFocus) < 0.5 ? 1.4 : 0.12);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    // Depth of field: points away from the focal plane grow softer and dimmer
    float defocus = min(abs(-mv.z - ${CAM_DIST.toFixed(1)}), 6.0);
    float blur = 1.0 + defocus * 0.12;
    // Far-off dust fades out instead of piling up into a haze
    float farFade = aux.w >= 1.0 ? 1.0 / (1.0 + defocus * 0.6) : 1.0;

    float tw = 1.0;

    vColor = mix(colA, colB, t);
    vAlpha = aux.x * focus * tw * farFade / (blur * blur);
    gl_PointSize = aux.y * uSize * uPixelRatio * (${CAM_DIST.toFixed(1)} / -mv.z) * blur * (focus > 1.0 ? 1.25 : 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uGain;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    // Crisp, hard-edged dot with a hint of anti-aliasing: stipple, not glow
    float dot = smoothstep(0.5, 0.32, r);
    gl_FragColor = vec4(vColor, dot * vAlpha * uGain);
  }
`;

// Deep background stars: a separate, slowly turning shell for parallax depth
function makeStars(count) {
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = 30 + Math.random() * 40;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(Math.random() * 1.6 - 0.8);
    pos[i * 3] = Math.cos(th) * Math.sin(ph) * r;
    pos[i * 3 + 1] = Math.cos(ph) * r * 0.6;
    pos[i * 3 + 2] = -Math.abs(Math.sin(th) * Math.sin(ph) * r) - 6;
    size[i] = Math.random() < 0.05 ? 2.6 : 0.6 + Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float size;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = size * uPixelRatio * 1.6;
        vA = 0.09 * min(1.0, size);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        if (r > 0.5) discard;
        gl_FragColor = vec4(vec3(0.85, 0.9, 1.0), smoothstep(0.5, 0.0, r) * vA);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geo, mat);
}

// A flowing landscape of particles under every scene: contour streaks plus
// scattered dust, rising into hills with distance and fading into the dark.
function makeTerrain(count) {
  const base = new Float32Array(count * 2);
  const seed = new Float32Array(count);
  const rows = 42;
  const onRows = Math.floor(count * 0.74);
  for (let i = 0; i < count; i++) {
    let x;
    let z;
    if (i < onRows) {
      const r = i % rows;
      const t = r / rows;
      z = 7 - Math.pow(t, 1.5) * 62 + (Math.random() - 0.5) * 0.08;
      x = (Math.random() - 0.5) * (32 + t * 56);
    } else {
      z = 7 - Math.pow(Math.random(), 1.2) * 62;
      x = (Math.random() - 0.5) * 90;
    }
    base[i * 2] = x;
    base[i * 2 + 1] = z;
    seed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('base', new THREE.BufferAttribute(base, 2));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 200);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uGround: { value: -3 }, uPixelRatio: { value: 1 }, uSize: { value: 2 },
      uMouse: { value: new THREE.Vector3(99, 99, 0) },
    },
    vertexShader: /* glsl */ `
      attribute vec2 base;
      attribute float seed;
      uniform float uTime;
      uniform float uGround;
      uniform float uPixelRatio;
      uniform float uSize;
      varying float vA;

      float height(vec2 p, float t) {
        return sin(p.x * 0.19 + p.y * 0.11 + t * 0.12) * 0.55
             + sin(p.x * 0.07 - p.y * 0.21 + t * 0.08) * 1.1
             + sin(p.y * 0.045 + p.x * 0.03 - t * 0.05) * 2.2;
      }

      void main() {
        vec2 p = base;
        float far = smoothstep(4.0, -30.0, p.y);        // flat near the scene, hills behind
        float amp = 0.32 + far * 1.15;
        float h = height(p, uTime) * amp;
        // Slope towards the camera -> crests catch the light
        float slope = (height(p + vec2(0.0, 0.6), uTime) - height(p - vec2(0.0, 0.6), uTime)) * amp;
        vec3 pos = vec3(p.x, uGround + h - far * 1.5, p.y);

        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mv;
        float dist = -mv.z;
        float lit = clamp(0.35 + slope * 0.9, 0.08, 1.0);
        float fog = exp(-max(0.0, dist - 14.0) * 0.035);
        float edge = 1.0 - smoothstep(18.0, 45.0, abs(p.x));
        vA = lit * fog * edge * (0.7 + 0.3 * seed) * 0.42;
        gl_PointSize = uSize * uPixelRatio * clamp(16.0 / dist, 0.45, 1.6);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        if (r > 0.5) discard;
        gl_FragColor = vec4(vec3(0.82, 0.88, 1.0), smoothstep(0.5, 0.3, r) * vA * 0.75);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geo, mat);
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.35)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.08)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export class ParticleField {
  constructor(canvas, count, { bloom = true } = {}) {
    this.count = count;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, bloom ? 1.5 : 2));
    this.renderer.setClearColor(BG, 1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    this.camera.position.set(0, 0, CAM_DIST);

    const geo = new THREE.BufferGeometry();
    const make = (size) => new THREE.BufferAttribute(new Float32Array(count * size), size);
    this.attrs = {
      posA: make(3), posB: make(3), colA: make(3), colB: make(3), auxA: make(4), auxB: make(4),
    };
    for (const [name, a] of Object.entries(this.attrs)) {
      a.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(name, a);
    }
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) seed[i] = Math.random();
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    // three.js needs a position attribute for bounds; the shader ignores it
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);

    this.uniforms = {
      uMix: { value: 0 },
      uTime: { value: 0 },
      uFocus: { value: -1 },
      uPixelRatio: { value: this.renderer.getPixelRatio() },
      uSize: { value: 3 },
      uMouse: { value: new THREE.Vector3(99, 99, 0) },
      uMouseStrength: { value: 1 },
      // Overall brightness: many points overlap additively, so keep each one subtle
      uGain: { value: 0.55 },
    };

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, this.material);
    this.scene.add(this.points);

    this.stars = makeStars(bloom ? 2600 : 1200);
    this.scene.add(this.stars);

    this.terrain = makeTerrain(bloom ? 30000 : 11000);
    this.scene.add(this.terrain);
    this.groundY = -3;
    this._groundTarget = -3;

    this._glowTex = glowTexture();
    this.glows = {};

    if (bloom) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.18, 0.25, 0.9);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }

    this.formations = {};
    this.layouts = {};
    this.pair = [null, null];
    this._focusTarget = -1;
    this._mouseTarget = new THREE.Vector3(99, 99, 0);
    this._ndc = new THREE.Vector2();
    this._ndcSmooth = new THREE.Vector2();
    this._ray = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    this._v = new THREE.Vector3();
    // Camera shot: where to look (x, y), how close (dist), and a sideways arc (swing).
    // `_shot` is the target from scroll; `_cam` follows it with a critically damped spring.
    this._shot = { x: 0, y: 0.2, dist: CAM_DIST, swing: 0 };
    this._cam = { ...this._shot };
    this._camVel = { x: 0, y: 0, dist: 0, swing: 0 };
  }

  setFormation(key, data) {
    this.formations[key] = data;
  }

  // Where a formation sits on screen: { x, y, scale } in world units
  setLayout(key, layout) {
    this.layouts[key] = layout;
  }

  _write(slot, key) {
    const f = this.formations[key];
    const lay = this.layouts[key] || { x: 0, y: 0, scale: 1 };
    const pos = this.attrs[slot === 'A' ? 'posA' : 'posB'].array;
    for (let i = 0; i < this.count; i++) {
      const isAmbient = f.aux[i * 4 + 2] === 0 && f.aux[i * 4 + 3] >= 1;
      // Ambient dust fills the whole screen; formed points follow the layout
      if (isAmbient) {
        pos[i * 3] = f.pos[i * 3];
        pos[i * 3 + 1] = f.pos[i * 3 + 1];
        pos[i * 3 + 2] = f.pos[i * 3 + 2];
      } else {
        pos[i * 3] = f.pos[i * 3] * lay.scale + lay.x;
        pos[i * 3 + 1] = f.pos[i * 3 + 1] * lay.scale + lay.y;
        pos[i * 3 + 2] = f.pos[i * 3 + 2] * lay.scale;
      }
    }
    this.attrs[slot === 'A' ? 'colA' : 'colB'].array.set(f.col);
    this.attrs[slot === 'A' ? 'auxA' : 'auxB'].array.set(f.aux);
    for (const n of ['pos', 'col', 'aux']) this.attrs[n + slot].needsUpdate = true;
  }

  // Soft light behind a formation's key subjects
  _glowsFor(key) {
    if (this.glows[key]) return this.glows[key];
    const group = new THREE.Group();
    for (const g of this.formations[key].glow) {
      const mat = new THREE.SpriteMaterial({
        map: this._glowTex, color: new THREE.Color(...g.color), transparent: true,
        depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
      });
      const s = new THREE.Sprite(mat);
      s.userData = g;
      group.add(s);
    }
    this.scene.add(group);
    this.glows[key] = group;
    this._placeGlows(key);
    return group;
  }

  _placeGlows(key) {
    const group = this.glows[key];
    if (!group) return;
    const lay = this.layouts[key] || { x: 0, y: 0, scale: 1 };
    for (const s of group.children) {
      const g = s.userData;
      s.position.set(g.at[0] * lay.scale + lay.x, g.at[1] * lay.scale + lay.y, -0.5);
      s.scale.setScalar(g.size * lay.scale);
    }
  }

  // Show the transition from formation a to b at progress mix (0..1)
  show(a, b, mix) {
    if (this.pair[0] !== a) { this._write('A', a); this.pair[0] = a; }
    if (this.pair[1] !== b) { this._write('B', b); this.pair[1] = b; }
    this.uniforms.uMix.value = mix;

    // Glows fade with their formation
    this._glowsFor(a);
    this._glowsFor(b);
    for (const [key, group] of Object.entries(this.glows)) {
      const w = (key === a ? 1 - mix : 0) + (key === b && b !== a ? mix : 0);
      group.visible = w > 0.001;
      for (const s of group.children) s.material.opacity = s.userData.strength * 0.06 * w * w;
    }

    // The camera eases back a little mid-transition, like taking a breath

  }

  // Re-apply layouts (after a resize)
  refresh() {
    const [a, b] = this.pair;
    this.pair = [null, null];
    for (const key of Object.keys(this.glows)) this._placeGlows(key);
    if (a && b) this.show(a, b, this.uniforms.uMix.value);
  }

  // Height of the ground line the terrain should meet (world units)
  setGround(y) {
    this._groundTarget = y;
  }

  // Scroll decides the shot; the camera eases towards it
  setShot(shot) {
    this._shot = shot;
  }

  setFocus(group) {
    this._focusTarget = group;
  }

  setPointer(ndcX, ndcY) {
    this._ndc.set(ndcX, ndcY);
    this._pointerActive = true;
  }

  clearPointer() {
    this._pointerActive = false;
    this._ndc.set(0, 0);
    this._mouseTarget.set(99, 99, 0);
  }

  // Formation-local point -> screen pixels (for HTML labels and hotspots)
  project(key, local) {
    const lay = this.layouts[key] || { x: 0, y: 0, scale: 1 };
    this._v.set(local[0] * lay.scale + lay.x, local[1] * lay.scale + lay.y, 0).project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: (this._v.x + 1) / 2 * r.width, y: (1 - this._v.y) / 2 * r.height };
  }

  // Visible half-size of the z=0 plane in world units
  viewExtent() {
    const h = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * CAM_DIST;
    return { w: h * this.camera.aspect, h };
  }

  resize(w, h) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const pr = this.renderer.getPixelRatio();
    this.uniforms.uPixelRatio.value = pr;
    this.stars.material.uniforms.uPixelRatio.value = pr;
    this.terrain.material.uniforms.uPixelRatio.value = pr;
    if (this.composer) {
      this.composer.setPixelRatio(pr);
      this.composer.setSize(w, h);
    }
  }

  render(dt, still) {
    if (!still) this.uniforms.uTime.value += dt;
    this.stars.material.uniforms.uTime.value += dt;
    this.stars.rotation.y += dt * 0.004;
    const tu = this.terrain.material.uniforms;
    if (!still) tu.uTime.value += dt * 0.4;
    this.groundY += (this._groundTarget - this.groundY) * Math.min(1, dt * 3);
    tu.uGround.value = this.groundY;
    this.uniforms.uFocus.value = this._focusTarget;

    // Camera: spring towards the scroll shot (no overshoot, no jerk on fast scrolls)
    const w = 2.4; // spring stiffness, 1/s
    for (const k of ['x', 'y', 'dist', 'swing']) {
      const a = w * w * (this._shot[k] - this._cam[k]) - 2 * w * this._camVel[k];
      this._camVel[k] += a * dt;
      this._cam[k] += this._camVel[k] * dt;
    }
    const c = this._cam;
    // Pointer adds a gentle orbit on top
    this._ndcSmooth.lerp(this._ndc, Math.min(1, dt * 2.2));
    const yaw = this._ndcSmooth.x * 0.14 + c.swing;
    const pitch = this._ndcSmooth.y * 0.07;
    // Raised and looking down, so the landscape recedes towards the horizon
    this.camera.position.set(
      c.x + Math.sin(yaw) * c.dist,
      c.y + 1.7 * (c.dist / CAM_DIST) + Math.sin(pitch) * c.dist,
      Math.cos(yaw) * Math.cos(pitch) * c.dist
    );
    this.camera.lookAt(c.x, c.y, 0);
    this.camera.updateMatrixWorld();

    // Pointer in world space (after the camera moved)
    if (this._pointerActive) {
      this._ray.setFromCamera(this._ndc, this.camera);
      this._ray.ray.intersectPlane(this._plane, this._mouseTarget);
    }
    this.uniforms.uMouse.value.lerp(this._mouseTarget, Math.min(1, dt * 6));

    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }
}
