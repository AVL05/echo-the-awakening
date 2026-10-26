import { describe, expect, it } from 'vitest';
import { checkpointMessage, executeCommand, INITIAL, objective, restoreSave } from '../src/game/progress';
import { canMove } from '../src/game/world';
import { echoCommands } from '../src/game/commands';
import { adaptQuality, damp, GRAPHICS } from '../src/game/graphics';

describe('closed puzzle loop', () => {
  it('resumes with the actual objective instead of the initial power request', () => {
    expect(checkpointMessage(INITIAL)).toContain('restaures la energía');
    const lab = { ...INITIAL, cell: true, installed: true, power: true, door: true };
    expect(checkpointMessage(lab)).toContain('Investiga el laboratorio');
    expect(checkpointMessage(lab)).not.toContain('restaures la energía');
    expect(checkpointMessage({ ...lab, story: { ...lab.story, protocol: 'erase' } })).toContain('ECHO está aislada');
  });
  it('requires the cell, then power, then authorization', () => {
    expect(executeCommand('restore', INITIAL).progress.power).toBe(false);
    expect(executeCommand('unlock', INITIAL).progress.door).toBe(false);
    const collected = { ...INITIAL, cell: true };
    const powered = executeCommand('restore', collected).progress;
    expect(powered.power).toBe(true);
    const unlocked = executeCommand('unlock', powered).progress;
    expect(unlocked.door).toBe(true);
    expect(objective(unlocked)).toBe('Investiga el laboratorio: manual del circuito y consumo residual');
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
    const result = await echoCommands.send('restore', { ...INITIAL, cell: true });
    expect(result.progress.power).toBe(true);
    expect(INITIAL.power).toBe(false);
  });
});

describe('graphics and movement', () => {
  it('lowers quality under sustained load and waits for three fast windows to recover', () => {
    expect(adaptQuality('high', 30, 0).tier).toBe('medium');
    expect(adaptQuality('medium', 30, 0).tier).toBe('low');
    expect(adaptQuality('low', 30, 0).tier).toBe('low');
    expect(adaptQuality('low', 60, 0)).toEqual({ tier: 'low', fastWindows: 1 });
    expect(adaptQuality('low', 60, 2).tier).toBe('medium');
    expect(adaptQuality('medium', 48, 2)).toEqual({ tier: 'medium', fastWindows: 0 });
    expect(GRAPHICS.low.particles).toBeLessThan(GRAPHICS.medium.particles);
    expect(GRAPHICS.medium.dpr).toBeLessThan(GRAPHICS.high.dpr);
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
