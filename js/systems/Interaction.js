import * as THREE from 'three';

export class Interaction {
  constructor(sceneManager, inputManager) {
    this.scene = sceneManager.scene;
    this.inputManager = inputManager;

    this.interactables = [];
    this.hoveredObject = null;
    this.hoverIndex = -1; // controller that is hovering (VR)

    // Optional guard: (interactable) => true | string (reason it is blocked)
    this.canInteract = () => true;
    this.onBlocked = () => {};
  }

  register(interactable) {
    this.interactables.push(interactable);
  }

  unregister(interactable) {
    const idx = this.interactables.indexOf(interactable);
    if (idx > -1) this.interactables.splice(idx, 1);
  }

  _meshes() {
    return this.interactables
      .filter(i => i.isInteractable && i.mesh.visible && this._visibleInScene(i.mesh))
      .map(i => i.mesh);
  }

  _visibleInScene(obj) {
    for (let o = obj; o; o = o.parent) if (!o.visible) return false;
    return true;
  }

  _hit(ray) {
    const hits = ray.intersectObjects(this._meshes(), true);
    for (const h of hits) {
      const it = this.findInteractable(h.object);
      if (it) return { interactable: it, distance: h.distance };
    }
    return null;
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

  update() {
    let newHovered = null;
    let newIndex = -1;

    if (this.inputManager.isVR) {
      // Either hand can point; trim each ray to what it hits
      this.inputManager.controllers.forEach((c, i) => {
        const hit = this._hit(this.inputManager.getRay(i));
        this.inputManager.controllerRays[i].scale.z = hit ? hit.distance : 5;
        if (hit && !newHovered) {
          newHovered = hit.interactable;
          newIndex = i;
        }
      });
    } else {
      const hit = this._hit(this.inputManager.getRay());
      if (hit) newHovered = hit.interactable;
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
      document.body.style.cursor = newHovered ? 'pointer' : 'default';
    }
    this.hoverIndex = newIndex;
  }

  // Called on select / grip. In VR, the hand that fired is the one that counts.
  handleSelect(controllerIndex = -1) {
    let target = this.hoveredObject;
    if (this.inputManager.isVR && controllerIndex >= 0) {
      const hit = this._hit(this.inputManager.getRay(controllerIndex));
      target = hit ? hit.interactable : null;
    }
    if (!target || !target.onSelect) return false;

    const allowed = this.canInteract(target);
    if (allowed !== true) {
      this.onBlocked(target, allowed);
      return true; // consumed: don't also walk/teleport
    }
    target.onSelect();
    return true;
  }
}
