import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adjustSupply, interact, runEscapeAction, targetLabel } from '../src/game/actions';
import { escapeAction } from '../src/game/escape';
import { restoreSave } from '../src/game/progress';
import { useGame } from '../src/game/store';
import { canMove } from '../src/game/world';

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) });
  useGame.getState().reset(); useGame.setState({ phase: 'playing' });
});
afterEach(() => vi.unstubAllGlobals());

function prepareRelay() {
  let p = escapeAction('take', 'badge', restoreSave(null)).progress;
  p = escapeAction('locker', '1704', p).progress;
  p = { ...p, cell: true };
  p = escapeAction('use', 'cell:relay', p).progress;
  p = escapeAction('use', 'fuse:relay', p).progress;
  useGame.setState({ progress: p });
}

describe('diegetic supply controls', () => {
  it('keeps the enlarged optical housing solid without blocking the side aisles', () => {
    const p = restoreSave(JSON.stringify({ cell: true, installed: true, power: true, door: true, complete: false }));
    expect(canMove(1.8, -34, p)).toBe(false);
    expect(canMove(-1.8, -34, p)).toBe(false);
    expect(canMove(2.1, -34, p)).toBe(true);
    expect(canMove(-2.1, -34, p)).toBe(true);
  });
  it('shares a provisional selection between world switches and the accessible panel', async () => {
    const before = useGame.getState().progress;
    useGame.setState({ target: 'supply:0' }); await interact();
    expect(useGame.getState().powerLines).toBe('100');
    useGame.setState({ phase: 'mechanism', mechanism: 'relay', target: null });
    expect(adjustSupply(2)).toBe(true);
    expect(useGame.getState().powerLines).toBe('101');
    expect(useGame.getState().progress.story.escape).toEqual(before.story.escape);
    expect(useGame.getState().progress.power).toBe(false);
  });
  it('rejects controls outside the targeted switch or relay panel and rejects invalid indices', () => {
    useGame.setState({ target: 'supply:0' });
    expect(adjustSupply(1)).toBe(false);
    expect(adjustSupply(-1)).toBe(false); expect(adjustSupply(3)).toBe(false);
    useGame.setState({ phase: 'mechanism', mechanism: 'optics' });
    expect(adjustSupply(0)).toBe(false);
    useGame.setState({ phase: 'paused' }); expect(adjustSupply(0)).toBe(false);
    expect(useGame.getState().powerLines).toBe('000');
  });
  it('requires physical presence, matching draft and installed parts to energize', () => {
    useGame.setState({ target: 'supply-start', powerLines: '101' });
    expect(runEscapeAction('power', '101').ok).toBe(false);
    prepareRelay();
    expect(runEscapeAction('power', '000').ok).toBe(false);
    expect(useGame.getState().progress.power).toBe(false);
    expect(runEscapeAction('power', '101').ok).toBe(true);
    expect(useGame.getState().progress.power).toBe(true);
    expect(targetLabel('supply:0')).toBe('Bloqueado · Soporte vital');
    expect(targetLabel('supply-start')).toBe('Red estable · arranque validado');
    useGame.setState({ target: 'supply:0' }); expect(adjustSupply(0)).toBe(false);
    expect(useGame.getState().powerLines).toBe('101');
  });
  it('validates through the physical start control and clears drafts on reset', async () => {
    prepareRelay(); useGame.setState({ target: 'supply-start', powerLines: '101' });
    await interact(); expect(useGame.getState().progress.power).toBe(true);
    useGame.getState().reset(); expect(useGame.getState().powerLines).toBe('000');
  });
});
