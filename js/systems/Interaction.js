import * as THREE from 'three';

export class Interaction {
  constructor(sceneManager, inputManager) {
    this.scene = sceneManager.scene;
    this.camera = sceneManager.camera;
    this.inputManager = inputManager;

    this.interactables = [];
    this.hoveredObject = null;

    // Desktop raycaster
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this._setupMouseTracking();
  }

  _setupMouseTracking() {
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
  }

  register(interactable) {
    this.interactables.push(interactable);
  }

  unregister(interactable) {
    const idx = this.interactables.indexOf(interactable);
    if (idx > -1) this.interactables.splice(idx, 1);
  }

  getIntersections() {
    const meshes = this.interactables
      .filter(i => i.isInteractable && i.mesh.visible)
      .map(i => i.mesh);

    if (this.inputManager.isVR) {
      // Use VR controller ray
      const ray = this.inputManager.getRay();
      return ray.intersectObjects(meshes, true);
    } else {
      // Desktop mouse ray
      this.raycaster.setFromCamera(this.mouse, this.camera);
      return this.raycaster.intersectObjects(meshes, true);
    }
  }

  findInteractable(mesh) {
    // Traverse up to find the registered interactable
    let current = mesh;
    while (current) {
      for (const interactable of this.interactables) {
        if (interactable.mesh === current) {
          return interactable;
        }
      }
      current = current.parent;
    }
    return null;
  }

  update(dt) {
    const intersections = this.getIntersections();

    let newHovered = null;
    if (intersections.length > 0) {
      newHovered = this.findInteractable(intersections[0].object);
    }

    // Handle hover state changes
    if (newHovered !== this.hoveredObject) {
      if (this.hoveredObject && this.hoveredObject.onHoverExit) {
        this.hoveredObject.onHoverExit();
      }
      if (newHovered && newHovered.onHoverEnter) {
        newHovered.onHoverEnter();
      }
      this.hoveredObject = newHovered;

      // Update cursor
      document.body.style.cursor = newHovered ? 'pointer' : 'default';
    }
  }

  // Called on select event
  handleSelect() {
    if (this.hoveredObject && this.hoveredObject.onSelect) {
      this.hoveredObject.onSelect();
      return true;
    }
    return false;
  }
}
