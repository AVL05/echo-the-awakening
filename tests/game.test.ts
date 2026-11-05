import { describe, expect, it } from 'vitest';
import { checkpointMessage, executeCommand, INITIAL, objective, restoreSave } from '../src/game/progress';
import { canMove } from '../src/game/world';
import { echoCommands } from '../src/game/commands';
import { adaptResolution, damp, frameBudget, framePercentile, GRAPHICS, renderDpr } from '../src/game/graphics';

describe('closed puzzle loop', () => {
  it('resumes with the actual objective instead of the initial power request', () => {
    expect(checkpointMessage(INITIAL)).toContain('Busca tu credencial');
    const lab = restoreSave(JSON.stringify({ cell: true, power: true, door: true, complete: false }));
    expect(checkpointMessage(lab)).toContain('equilibrio eléctrico y una autorización independiente');
    expect(checkpointMessage(lab)).not.toContain('restaures la energía');
    expect(checkpointMessage({ ...lab, story: { ...lab.story, protocol: 'erase' } })).toContain('ECHO está aislada');
  });
  it('requires the cell, then power, then authorization', () => {
    expect(executeCommand('restore', INITIAL).progress.power).toBe(false);
    expect(executeCommand('unlock', INITIAL).progress.door).toBe(false);
    expect(executeCommand('restore', { ...INITIAL, cell: true }).progress.power).toBe(false);
    const collected = restoreSave(JSON.stringify({ cell: true, installed: true, power: false, door: false, complete: false }));
    const powered = executeCommand('restore', collected).progress;
    expect(powered.power).toBe(true);
    const unlocked = executeCommand('unlock', powered).progress;
    expect(unlocked.door).toBe(true);
    expect(objective(unlocked)).toBe('La esclusa exige equilibrio eléctrico y una autorización independiente');
    expect(executeCommand('unlock', unlocked).progress).toEqual(unlocked);
  });
  it('repairs corrupted or out-of-order saves', () => {
    for (const raw of ['broken', 'null', '[]', '42', '{"complete":true,"door":true}', '{"cell":"true"}']) {
      expect(restoreSave(raw)).toEqual(INITIAL);
    }
    const complete = { cell: true, power: true, door: true, complete: true };
    const migrated = restoreSave(JSON.stringify(complete));
    expect(migrated).toMatchObject({ cell: true, installed: true, power: true, door: true, complete: false, story: { zone: 'lab' } });
  });
  it('blocks walls, props and the unpowered door', () => {
    expect(canMove(0, 10, INITIAL)).toBe(true);
    expect(canMove(9, 5, INITIAL)).toBe(false);
    expect(canMove(0, 0, INITIAL)).toBe(false);
    expect(canMove(2.75, 0.2, INITIAL)).toBe(false);
    expect(canMove(-5.5, 1.5, INITIAL)).toBe(false);
    expect(canMove(0, -12, INITIAL)).toBe(false);
    const open = { ...INITIAL, cell: true, installed: true, power: true, door: true, complete: false };
    expect(canMove(0, -14, open)).toBe(true);
    expect(canMove(2, -14, open)).toBe(false);
  });
  it('keeps command execution asynchronous and supports cancellation', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(echoCommands.send('diagnose', INITIAL, controller.signal)).rejects.toThrow();
    const result = await echoCommands.send('restore', restoreSave(JSON.stringify({ cell: true, installed: true, power: false, door: false, complete: false })));
    expect(result.progress.power).toBe(true);
    expect(INITIAL.power).toBe(false);
  });
});

describe('graphics and movement', () => {
  it('requires sustained slow frames, ignores one spike, and recovers more slowly', () => {
    const good = Array<number>(120).fill(16); good[0] = 180;
    expect(framePercentile(good, 0.95)).toBe(16);
    expect(framePercentile([])).toBeNull();
    expect(framePercentile([5, 50, 10, 20])).toBe(50);
    expect(adaptResolution(1, 25, 40, 0)).toEqual({ scale: 1, level: 0, windows: -1 });
    expect(adaptResolution(1, 25, 40, -1)).toEqual({ scale: 0.9, level: 0, windows: 0 });
    expect(adaptResolution(0.9, 17, 24, -1)).toEqual({ scale: 0.9, level: 0, windows: 0 });
    expect(adaptResolution(0.8, 13, 18, 3)).toEqual({ scale: 0.8, level: 0, windows: 4 });
    expect(adaptResolution(0.8, 13, 18, 4)).toEqual({ scale: 0.9, level: 0, windows: 0 });
    expect(adaptResolution(0.7, 40, 60, -1).scale).toBe(0.7);
    expect(adaptResolution(1, 13, 18, 4).scale).toBe(1);
    expect(GRAPHICS.low.particles).toBeLessThan(GRAPHICS.medium.particles);
    expect(GRAPHICS.medium.dpr).toBeLessThan(GRAPHICS.high.dpr);
    expect(adaptResolution(0.7, 25, 40, -1)).toEqual({ scale: 0.7, level: 1, windows: 0 });
    expect(adaptResolution(0.7, 25, 40, -1, 2)).toEqual({ scale: 0.7, level: 2, windows: 0 });
    expect(adaptResolution(0.7, 16.5, 19, 4, 2)).toEqual({ scale: 0.7, level: 1, windows: 0 });
  });
  it('bounds laptop pixel count on HiDPI displays without supersampling low DPI', () => {
    const dpr = renderDpr('laptop', 1920, 1080, 2, 1);
    expect(1920 * 1080 * dpr ** 2).toBeCloseTo(1200000, 4);
    expect(renderDpr('laptop', 1280, 720, 1, 1)).toBe(1);
    expect(renderDpr('laptop', 3840, 2160, 2, 0.7)).toBeLessThan(dpr);
    expect(renderDpr('high', 1280, 720, 1, 1)).toBe(1);
    expect(GRAPHICS.laptop.shadowSize).toBe(512);
    expect(GRAPHICS.laptop.beams).toBe(false);
  });
  it('caps laptop play at 60 FPS and reduces background and inference work', () => {
    expect(frameBudget('laptop', 'playing', false)).toBe(60);
    expect(frameBudget('high', 'playing', false)).toBe(0);
    expect(frameBudget('high', 'terminal', false)).toBe(30);
    expect(frameBudget('laptop', 'terminal', true)).toBe(10);
    expect(frameBudget('laptop', 'paused', true)).toBe(0);
    expect(frameBudget('laptop', 'playing', false, true)).toBe(0);
  });
  it('smooths movement independently of frame rate and brakes without overshooting', () => {
    let v30 = 0, v120 = 0;
    for (let i = 0; i < 30; i++) v30 = damp(v30, 3.15, 10, 1 / 30);
    for (let i = 0; i < 120; i++) v120 = damp(v120, 3.15, 10, 1 / 120);
    expect(v30).toBeCloseTo(v120, 10);
    expect(damp(v30, 0, 18, 0.1)).toBeGreaterThan(0);
    expect(damp(v30, 0, 18, 0.1)).toBeLessThan(v30);
  });
});
