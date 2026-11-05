import { Mesh, Object3D } from 'three';
import { useGame } from '../game/store';

function updateVisibleMatrices(this: Object3D, force?: boolean) {
  if (this.visible) Object3D.prototype.updateMatrixWorld.call(this, force);
}

// Three traverses hidden subtrees for matrices too; refresh them when the zone returns.
export function suspendHiddenUpdates(object: Object3D) {
  object.updateMatrixWorld = updateVisibleMatrices;
}

export function interactionObjects(root: Object3D, targets: Mesh[]) {
  for (const child of root.children) {
    // The terminal deliberately uses an invisible interaction mesh.
    if (child instanceof Mesh && (child.visible || child.userData.interact)) targets.push(child);
    if (child.visible) interactionObjects(child, targets);
  }
}

export function isSceneVisible(object: Object3D | null) {
  if (!object || document.hidden || ['paused', 'technical', 'complete'].includes(useGame.getState().phase)) return false;
  for (let node: Object3D | null = object; node; node = node.parent) if (!node.visible) return false;
  return true;
}
