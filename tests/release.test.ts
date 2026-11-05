import { describe, expect, it, vi } from 'vitest';
import { detectCapabilities } from '../src/ai/capabilities';
import { readProgress, writeProgress, BACKUP_KEY } from '../src/game/persistence';
import { INITIAL, restoreSave, SAVE_KEY, type Progress } from '../src/game/progress';
import { beginTrace, clearTraces, stateChanges, traceStep, useTelemetry } from '../src/game/telemetry';
import { Object3D } from 'three';
import { isSceneVisible } from '../src/scene/visibility';

const environment = (patch: Record<string, unknown> = {}) => ({ secure: true, worker: true, cache: true, navigator: {
  gpu: { requestAdapter: async () => ({ features: new Set(['shader-f16']), limits: { maxStorageBufferBindingSize: 134217728 } }) },
  storage: { estimate: async () => ({ quota: 1e9, usage: 0 }) }, deviceMemory: 8,
}, ...patch } as unknown as Parameters<typeof detectCapabilities>[0]);

describe('pre-download capability boundary', () => {
  it('requires a secure context, Worker and Cache API without downloading a model', async () => {
    for (const patch of [{ secure: false }, { worker: false }, { cache: false }]) expect((await detectCapabilities(environment(patch))).status).toBe('unavailable');
    expect((await detectCapabilities(environment())).status).toBe('available');
  });
  it('checks GPU and RAM while leaving download quota enforcement to the Worker', async () => {
    const base = environment().navigator;
    for (const patch of [{ gpu: undefined }, { deviceMemory: 2 }, { gpu: { requestAdapter: async () => null } }]) expect((await detectCapabilities(environment({ navigator: { ...base, ...patch } }))).status).toBe('unavailable');
    expect((await detectCapabilities(environment({ navigator: { ...base, deviceMemory: undefined } }))).status).toBe('available');
    expect(await detectCapabilities(environment({ navigator: { ...base, storage: { estimate: async () => ({ quota: 500 * 1024 * 1024, usage: 300 * 1024 * 1024 }) } } })))
      .toMatchObject({ status: 'available', freeBytes: 200 * 1024 * 1024 });
  });
});

describe('recoverable progress', () => {
  const p = restoreSave(JSON.stringify({ cell: true, power: true, door: false, complete: false }));
  it('recovers a valid backup when the primary save is corrupt', () => {
    const storage = new Map([[SAVE_KEY, 'broken'], [BACKUP_KEY, JSON.stringify(p)]]);
    expect(readProgress({ getItem: key => storage.get(key) ?? null })).toEqual({ progress: p, recovery: 'backup' });
  });
  it('recovers semantic corruption without replacing a coherent backup', () => {
    const corruptSaves: Progress[] = [
      { ...p, cell: false }, { ...p, installed: false }, { ...p, power: false, door: true }, { ...p, complete: true },
      { ...p, door: true, story: { ...p.story, labSolved: true } },
      { ...p, story: { ...p.story, archiveVerified: true } },
      { ...p, story: { ...p.story, protocol: 'preserve' } },
      { ...p, story: { ...p.story, zone: 'core' } },
    ];
    for (const corrupt of corruptSaves) {
      const backup = JSON.stringify(p);
      const storage = new Map([[SAVE_KEY, JSON.stringify(corrupt)], [BACKUP_KEY, backup]]);
      const api = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } };
      expect(readProgress(api)).toEqual({ progress: p, recovery: 'backup' });
      writeProgress(api, p);
      expect(storage.get(BACKUP_KEY)).toBe(backup);
      const before = new Map(storage);
      expect(() => writeProgress(api, corrupt)).toThrow('incoherente');
      expect(storage).toEqual(before);
    }
  });
  it('preserves legacy migration and salvages coherent progress when no backup is valid', () => {
    const legacy = JSON.stringify({ cell: true, power: true, door: true, complete: true });
    expect(readProgress({ getItem: key => key === SAVE_KEY ? legacy : null }))
      .toMatchObject({ recovery: null, progress: { installed: true, power: true, door: true, complete: false, story: { zone: 'lab' } } });
    const corrupt = JSON.stringify({ ...p, story: { ...p.story, labSolved: true } });
    expect(readProgress({ getItem: key => key === SAVE_KEY ? corrupt : null }))
      .toEqual({ progress: p, recovery: 'repaired' });
  });
  it('keeps current saves authoritative and repairs invalid or inaccessible storage', () => {
    expect(readProgress({ getItem: () => JSON.stringify(p) }).progress).toEqual(p);
    expect(readProgress({ getItem: () => '[]' }).recovery).toBe('repaired');
    expect(readProgress({ getItem: () => { throw Error('Denied'); } }).recovery).toBe('unavailable');
    expect(readProgress({ getItem: () => 'x'.repeat(65537) }).progress).toEqual(INITIAL);
  });
  it('preserves the previous valid revision and still saves if backup quota is denied', () => {
    const storage = new Map([[SAVE_KEY, JSON.stringify(INITIAL)]]);
    const api = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } };
    writeProgress(api, p);
    expect(storage.get(BACKUP_KEY)).toBe(JSON.stringify(INITIAL));
    expect(storage.get(SAVE_KEY)).toBe(JSON.stringify(p));
    writeProgress({ ...api, setItem: (key, value) => { if (key === BACKUP_KEY) throw Error('quota'); storage.set(key, value); } }, INITIAL);
    expect(storage.get(SAVE_KEY)).toBe(JSON.stringify(INITIAL));
  });
});

describe('local public event timeline', () => {
  it('records real stages, bounds retention and contains no raw model reasoning', () => {
    clearTraces();
    for (let i = 0; i < 30; i++) { const id = beginTrace(`status ${i}`, 'deterministic'); traceStep(id, 'executed', 'Consulta real.'); }
    const traces = useTelemetry.getState().traces;
    expect(traces).toHaveLength(24);
    expect(traces[23].steps.map(s => s.stage)).toEqual(['received', 'executed']);
    expect(traces[23].steps.every(s => s.ms >= 0)).toBe(true);
    expect(Object.keys(traces[23])).not.toContain('raw');
    clearTraces(); expect(useTelemetry.getState().traces).toEqual([]);
  });
  it('reports only actual gameplay changes, excluding bookkeeping', () => {
    expect(stateChanges(INITIAL, { ...INITIAL, power: true })).toEqual({ power: { before: false, after: true } });
    expect(stateChanges(INITIAL, { ...INITIAL, story: { ...INITIAL.story, stats: { ...INITIAL.story.stats, seconds: 10 } } })).toEqual({});
  });
});

describe('hidden scene processing guard', () => {
  it('skips a hidden ancestor or background tab, even when the child itself is visible', () => {
    vi.stubGlobal('document', { hidden: false });
    try {
      const parent = new Object3D(), child = new Object3D(); parent.add(child);
      expect(isSceneVisible(child)).toBe(true);
      parent.visible = false; expect(isSceneVisible(child)).toBe(false);
      parent.visible = true; vi.stubGlobal('document', { hidden: true }); expect(isSceneVisible(child)).toBe(false);
      expect(isSceneVisible(null)).toBe(false);
    } finally { vi.unstubAllGlobals(); }
  });
});
