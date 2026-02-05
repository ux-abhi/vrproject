import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

export class SceneManager {
  constructor(container) {
    this.container = container;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.003);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      500
    );
    this.camera.position.set(0, 1.6, 0);

    // Camera rig (dolly) for VR teleportation
    this.cameraRig = new THREE.Group();
    this.cameraRig.add(this.camera);
    this.scene.add(this.cameraRig);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.xr.enabled = true;

    container.appendChild(this.renderer.domElement);

    // VR Button
    this.vrButton = VRButton.createButton(this.renderer);
    document.body.appendChild(this.vrButton);

    // Lighting
    this._setupLighting();

    // Resize handler
    window.addEventListener('resize', () => this._onResize());

    // Clock
    this.clock = new THREE.Clock();
  }

  _setupLighting() {
    // Hemisphere light (sky blue / ground green)
    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x556b2f, 0.6);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    // Directional light (sun)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(30, 50, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 150;
    dirLight.shadow.camera.left = -50;
    dirLight.shadow.camera.right = 50;
    dirLight.shadow.camera.top = 50;
    dirLight.shadow.camera.bottom = -50;
    this.scene.add(dirLight);

    // Ambient fill
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(ambientLight);
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  getDelta() {
    return this.clock.getDelta();
  }

  getElapsed() {
    return this.clock.getElapsedTime();
  }
}
