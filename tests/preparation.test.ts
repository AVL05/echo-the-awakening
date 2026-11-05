import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Group, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, Texture, type WebGLRenderer } from 'three';
import { prepareScene } from '../src/scene/preparation';

beforeEach(() => {
  vi.stubGlobal('document', { hidden: false, removeEventListener: vi.fn() });
  vi.stubGlobal('requestIdleCallback', (work: () => void) => { queueMicrotask(work); return 1; });
  vi.stubGlobal('cancelIdleCallback', vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

describe('progressive preparation (mock renderer, no GPU or browser)', () => {
  it('uploads shared textures once and restores visibility and culling after warming', async () => {
    const scene = new Scene(), zone = new Group(), texture = new Texture();
    zone.userData.sceneZone = 'lab'; zone.visible = false;
    const material = new MeshStandardMaterial({ map: texture });
    const mesh = new Mesh(undefined, material);
    zone.add(mesh, new Mesh(undefined, material)); scene.add(zone);
    const renderer = { initTexture: vi.fn(), compileAsync: vi.fn(async () => {
      expect(zone.visible).toBe(true); expect(mesh.frustumCulled).toBe(false);
    }) };
    await prepareScene(renderer as unknown as WebGLRenderer, scene, new PerspectiveCamera(), new AbortController().signal, zone);
    expect(renderer.initTexture).toHaveBeenCalledTimes(1);
    expect(renderer.compileAsync).toHaveBeenCalledTimes(2);
    expect(zone.visible).toBe(false); expect(mesh.frustumCulled).toBe(true);
  });
  it('restores flags on compile failure and does not prepare a cancelled request', async () => {
    const scene = new Scene(), zone = new Group(); zone.visible = false; zone.userData.sceneZone = 'core'; scene.add(zone);
    const renderer = { initTexture: vi.fn(), compileAsync: vi.fn(() => { throw new Error('Compile failed'); }) };
    await expect(prepareScene(renderer as unknown as WebGLRenderer, scene, new PerspectiveCamera(), new AbortController().signal, zone)).rejects.toThrow('Compile failed');
    expect(zone.visible).toBe(false);
    const abort = new AbortController(); abort.abort();
    await expect(prepareScene(renderer as unknown as WebGLRenderer, scene, new PerspectiveCamera(), abort.signal, zone)).rejects.toThrow();
    expect(renderer.compileAsync).toHaveBeenCalledTimes(1);
  });
});
