import { Mesh, Texture, type Camera, type Object3D, type Scene, type WebGLRenderer } from 'three';

export function schedulePreparation(work: () => void) {
  let id = 0, idle = false;
  const run = () => {
    if (document.hidden) { document.addEventListener('visibilitychange', resume); return; }
    work();
  };
  const schedule = () => {
    idle = typeof requestIdleCallback === 'function';
    id = idle ? requestIdleCallback(run, { timeout: 500 }) : window.setTimeout(run, 32);
  };
  const resume = () => {
    if (!document.hidden) { document.removeEventListener('visibilitychange', resume); schedule(); }
  };
  schedule();
  return () => { if (idle) cancelIdleCallback(id); else clearTimeout(id); document.removeEventListener('visibilitychange', resume); };
}

let preparation: Promise<void> = Promise.resolve();

// Serialize GPU preparation and yield between uploads instead of doing them all on entry.
export function prepareScene(gl: WebGLRenderer, scene: Scene, camera: Camera, signal: AbortSignal, zone?: Object3D) {
  const task = preparation.then(async () => {
    signal.throwIfAborted();
    const textures = new Set<Texture>();
    if (scene.environment) textures.add(scene.environment);
    (zone ?? scene).traverse(object => {
      const material = (object as Mesh).material;
      if (material) for (const item of Array.isArray(material) ? material : [material]) {
        for (const value of Object.values(item)) if (value instanceof Texture) textures.add(value);
      }
    });
    const disposed = new WeakSet<Texture>();
    const onDispose = (event: { target: Texture }) => { disposed.add(event.target); };
    for (const texture of textures) texture.addEventListener('dispose', onDispose);
    try {
      let uploaded = 0;
      for (const texture of textures) {
        if (uploaded++ % 4 === 0) await new Promise<void>(resolve => schedulePreparation(resolve));
        signal.throwIfAborted();
        if (!disposed.has(texture)) gl.initTexture(texture);
      }
    } finally {
      for (const texture of textures) texture.removeEventListener('dispose', onDispose);
    }
    const warmCamera = camera.clone();
    if (zone) {
      const center = zone.userData.sceneZone === 'lab' ? -27 : -51;
      warmCamera.position.set(0, 2, center + 8); warmCamera.lookAt(0, 2, center); warmCamera.updateMatrixWorld();
    }
    for (const isolated of zone ? [false, true] : [false]) {
      await new Promise<void>(resolve => schedulePreparation(resolve));
      signal.throwIfAborted();
      const visibility: [Object3D, boolean][] = [], culling: [Object3D, boolean][] = [];
      let compiled: Promise<unknown>;
      try {
        if (zone) scene.traverse(object => {
          if (object.userData.sceneZone) { visibility.push([object, object.visible]); object.visible = object === zone || (!isolated && object.visible); }
        });
        scene.traverseVisible(object => { culling.push([object, object.frustumCulled]); object.frustumCulled = false; });
        // Both renderers collect their compile list before the returned promise yields.
        compiled = gl.compileAsync(scene, warmCamera);
      } finally {
        for (const [object, visible] of visibility) object.visible = visible;
        for (const [object, culled] of culling) object.frustumCulled = culled;
      }
      await compiled;
    }
  });
  preparation = task.catch(() => {});
  return task;
}
