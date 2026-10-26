import type { Object3D } from 'three';

export function isSceneVisible(object: Object3D | null) {
  if (!object || document.hidden) return false;
  for (let node: Object3D | null = object; node; node = node.parent) if (!node.visible) return false;
  return true;
}
