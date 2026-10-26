import { describe, expect, it } from 'vitest';
import { applyAction, deterministicPlan, parsePlan, type Action } from '../src/ai/actions';
import { INITIAL, restoreSave } from '../src/game/progress';

const action = (name: Action['name'], target: Action['target'], source: Action['source'] = 'none', destination: Action['destination'] = 'none'): Action => ({ name, target, source, destination });
describe('untrusted model actions', () => {
  it('rejects invented actions, extra properties, wrong types and multiple actions', () => {
    const valid = { reply: 'Vamos.', actions: [action('open_door', 'door')] };
    expect(parsePlan(JSON.stringify(valid))).toEqual(valid);
    for (const value of [null, [], { ...valid, progress: { power: true } }, { ...valid, actions: [action('open_door', 'door'), action('activate', 'reactor')] }, { ...valid, reply: 1 }, { ...valid, actions: [{ ...action('inspect', 'cell'), name: 'eval' }] }, { ...valid, actions: [{ ...action('inspect', 'cell'), target: '__proto__' }] }, { ...valid, actions: [{ ...action('inspect', 'cell'), script: 'alert(1)' }] }]) {
      expect(() => parsePlan(JSON.stringify(value))).toThrow();
    }
    expect(() => parsePlan('```json\n{}\n```')).toThrow();
    expect(() => parsePlan('x'.repeat(8193))).toThrow();
  });
  it('does not collect or install cells remotely or open an unpowered door', () => {
    for (const p of [INITIAL, { ...INITIAL, cell: true }]) {
      expect(applyAction(action('activate', 'reactor'), p).ok).toBe(false);
      expect(applyAction(action('transfer_energy', 'relay', 'cell', 'relay'), p).ok).toBe(false);
      expect(applyAction(action('open_door', 'door'), p).ok).toBe(false);
      expect(p.power).toBe(false);
    }
  });
  it('supports real deactivation and reactivation without losing the installed cell', () => {
    const on = { ...INITIAL, cell: true, installed: true, power: true };
    const off = applyAction(action('deactivate', 'reactor'), on);
    expect(off.progress).toEqual({ ...on, power: false });
    const resumed = restoreSave(JSON.stringify(off.progress));
    expect(resumed.installed).toBe(true);
    expect(applyAction(action('transfer_energy', 'reactor', 'relay', 'reactor'), resumed).progress.power).toBe(true);
    expect(applyAction(action('activate', 'relay'), resumed).progress.power).toBe(true);
  });
  it('rejects unsafe targets, impossible energy routes and shutdown with the door open', () => {
    const on = { ...INITIAL, cell: true, installed: true, power: true };
    expect(applyAction(action('activate', 'door'), on).ok).toBe(false);
    expect(applyAction(action('transfer_energy', 'reactor', 'cell', 'reactor'), on).ok).toBe(false);
    expect(applyAction(action('deactivate', 'reactor'), { ...on, door: true }).ok).toBe(false);
    expect(applyAction(action('open_door', 'door'), on).progress.door).toBe(true);
    expect(applyAction(action('deactivate', 'relay'), { ...on, door: true, complete: true }).ok).toBe(false);
  });
  it('keeps deterministic mode honest and protects negations', () => {
    expect(deterministicPlan('Abre la compuerta').actions[0].name).toBe('open_door');
    expect(deterministicPlan('No abras la puerta').actions).toEqual([]);
    expect(deterministicPlan('¿Dónde está la batería?').actions[0]).toEqual(action('inspect', 'cell'));
    expect(deterministicPlan('Desactiva el núcleo').actions[0]).toEqual(action('deactivate', 'reactor'));
    expect(deterministicPlan('transfiere del distribuidor al reactor').actions[0].name).toBe('transfer_energy');
    expect(deterministicPlan('¿Cómo está la instalación?').reply).toContain('sin inferencia');
  });
});
