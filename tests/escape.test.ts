import { describe, expect, it } from 'vitest';
import { escapeAction, escapeObjective, inventory, requestEscapeHint, solvedPuzzles, traceBeam, updateEscape, type EscapeOperation } from '../src/game/escape';
import { executeCommand, INITIAL, restoreSave, SAVE_KEY, type Progress } from '../src/game/progress';
import { discover, storyAction, updateStory, type DocumentId } from '../src/game/story';
import { BACKUP_KEY, readProgress, writeProgress } from '../src/game/persistence';
import { adjustRegulator, runEscapeAction } from '../src/game/actions';
import { useGame } from '../src/game/store';

describe('six connected mechanisms and checkpoint recovery', () => {
  function campaign(protocol: 'preserve' | 'erase') {
    let p = restoreSave(null);
    const storage = new Map<string, string>();
    const api = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } };
    const checkpoint = (next: Progress) => {
      writeProgress(api, next);
      expect(readProgress(api)).toEqual({ progress: next, recovery: null });
      p = restoreSave(storage.get(SAVE_KEY)!);
    };
    const physical = (op: EscapeOperation, value = '') => {
      const result = escapeAction(op, value, p); expect(result.ok).toBe(true); checkpoint(result.progress);
    };
    const read = (...ids: DocumentId[]) => checkpoint(ids.reduce((next, id) => discover(next, id), p));
    physical('take', 'badge'); physical('locker', '1704');
    checkpoint({ ...p, cell: true });
    physical('use', 'fuse:relay'); physical('use', 'cell:relay'); physical('power', '101');
    checkpoint(executeCommand('unlock', p).progress);
    checkpoint(updateStory(p, { zone: 'lab', seenLab: true }));
    read('manual', 'measurements', 'copy', 'evacuation');
    checkpoint(storyAction('calibrate', '243', p).progress);
    physical('take', 'crank'); physical('use', 'crank:cabinet'); physical('use', 'lens:optics');
    physical('secret'); physical('mirrors', '001'); physical('optics');
    expect(escapeAction('mirrors', '111', p).progress.story.escape.mirrors).toBe('001');
    expect(updateStory(p, { dials: [0, 0, 0] }).story.dials).toEqual([2, 4, 3]);
    checkpoint(updateStory(p, { zone: 'core', seenCore: true }));
    physical('use', 'wafer:reader'); read('quarantine', 'consent');
    checkpoint(storyAction('verify_archive', 'copy,quarantine,cut', p).progress);
    checkpoint(storyAction('record_decision', 'confront', p).progress);
    expect(storyAction('choose_protocol', protocol, p).ok).toBe(false);
    physical('continuity', protocol === 'preserve' ? 'aux:human:aux' : 'off:none:aux');
    expect(storyAction('choose_protocol', protocol === 'preserve' ? 'erase' : 'preserve', p).ok).toBe(false);
    checkpoint(storyAction('choose_protocol', protocol, p).progress);
    checkpoint({ ...p, complete: true });
    expect(p.story.protocol).toBe(protocol); expect(solvedPuzzles(p)).toBe(6);
    expect(inventory(p)).toEqual(['badge', 'crank']);
    expect(escapeAction('continuity', 'reset', p).ok).toBe(false);
    return p;
  }

  it('persists every physical stage and reaches both irreversible endings', () => {
    campaign('preserve'); campaign('erase');
  });
  it('requires the physical start, preserves incompatible objects and traces the human receiver', () => {
    let p = escapeAction('take', 'badge', INITIAL).progress;
    expect(executeCommand('restore', { ...p, cell: true }).progress.power).toBe(false);
    expect(escapeAction('power', '101', p).ok).toBe(false);
    const incompatible = escapeAction('use', 'badge:relay', p);
    expect(incompatible.ok).toBe(false); expect(inventory(incompatible.progress)).toEqual(['badge']);
    p = escapeAction('locker', '0417', p).progress;
    expect(p.story.escape.locker).toBe(false); expect(p.story.stats.mistakes).toBe(1);
    expect(traceBeam('001').human).toBe(true); expect(traceBeam('111').human).toBe(false);
    for (let i = 0; i < 8; i++) expect(traceBeam(i.toString(2).padStart(3, '0')).path.length).toBeLessThanOrEqual(21);
  });
  it('advances contextual hints independently and never requires a model', () => {
    let p = INITIAL;
    const texts: string[] = [];
    for (let i = 0; i < 4; i++) { const help = storyAction('request_hint', '', p); texts.push(help.text); p = help.progress; }
    expect(new Set(texts).size).toBe(3); expect(p.story.stats.hints).toBe(4);
    p = escapeAction('locker', '1704', escapeAction('take', 'badge', p).progress).progress;
    expect(storyAction('request_hint', '', p).text).toContain('celda sola');
  });
  it('guides authorization before laboratory research and confirms prepared final routes', () => {
    let p = escapeAction('take', 'badge', INITIAL).progress;
    p = escapeAction('locker', '1704', p).progress;
    p = { ...p, cell: true };
    for (const value of ['cell:relay', 'fuse:relay']) p = escapeAction('use', value, p).progress;
    p = escapeAction('power', '101', p).progress;
    const help = requestEscapeHint(p);
    expect(help.text).toMatch(/autorización|terminal/i);
    expect(help.progress.story.escape.hints).toEqual({ power: 1 });
    expect(requestEscapeHint(p, 'power').progress.story.stats.hints).toBe(1);
    expect(requestEscapeHint(p, 'lab').progress).toBe(p);
    const completed = campaign('preserve');
    const prepared = { ...completed, complete: false, story: { ...completed.story, protocol: 'none' as const } };
    expect(requestEscapeHint(prepared).text).toMatch(/confirmación|confirmar/i);
    expect(requestEscapeHint(prepared).text).not.toContain('junto a la salida decide');
  });
  it('allows optical investigation before calibration and restores that checkpoint', () => {
    let p = updateStory(restoreSave(JSON.stringify({ cell: true, power: true, door: true, complete: false })), { zone: 'lab' });
    p = escapeAction('take', 'crank', p).progress;
    for (const value of ['crank:cabinet', 'lens:optics']) p = escapeAction('use', value, p).progress;
    p = escapeAction('mirrors', '001', p).progress;
    const verified = escapeAction('optics', '', p);
    expect(verified.ok).toBe(true);
    expect(verified.progress.story.labSolved).toBe(false);
    expect(restoreSave(JSON.stringify(verified.progress))).toEqual(verified.progress);
    expect(requestEscapeHint(p, 'optics').text).toContain('esclusa');
    expect(requestEscapeHint(p, 'optics').progress.story.escape.hints).toEqual({ optics: 1 });
    expect(requestEscapeHint(p, 'lab').progress.story.escape.hints).toEqual({ lab: 1 });
    expect(requestEscapeHint(p, 'locker').progress).toBe(p);
    expect(requestEscapeHint(INITIAL, 'optics').progress).toBe(INITIAL);
  });
  it('keeps default objectives and rejection messages from giving away solutions', () => {
    expect(escapeObjective(INITIAL)).not.toMatch(/credencial|taquilla/i);
    const p = updateStory(restoreSave(JSON.stringify({ cell: true, power: true, door: true, complete: false })), { zone: 'lab' });
    expect(escapeObjective(p)).not.toMatch(/armario|espejo|receptor/i);
    expect(storyAction('calibrate', '333', p).text).not.toMatch(/2 ×|\+ 1|suma =/);
    const powered = updateEscape(INITIAL, { cellDocked: true, fuseInstalled: true });
    expect(escapeAction('power', '111', powered).text).not.toContain('debe quedar fuera');
  });
  it('validates direct regulator adjustments and preserves solved circuits', () => {
    const p = restoreSave(JSON.stringify({ cell: true, power: true, door: true, complete: false }));
    for (const value of ['-1:2', '3:2', '0:5', '0:NaN', '1:2:3']) {
      const result = storyAction('adjust_dial', value, p);
      expect(result.ok).toBe(false); expect(result.progress).toBe(p);
    }
    expect(storyAction('adjust_dial', '0:2', INITIAL).ok).toBe(false);
    const adjusted = storyAction('adjust_dial', '0:2', p);
    expect(adjusted.ok).toBe(true); expect(adjusted.progress.story.dials).toEqual([2, 0, 0]);
    expect(restoreSave(JSON.stringify(adjusted.progress))).toEqual(adjusted.progress);
    const solved = storyAction('calibrate', '243', p).progress;
    expect(storyAction('adjust_dial', '0:0', solved).progress).toBe(solved);
  });
  it('limits physical adjustments to the pointed control and shares the same rules with panels', () => {
    const previous = useGame.getState();
    try {
      let p = restoreSave(JSON.stringify({ cell: true, power: true, door: true, complete: false }));
      p = escapeAction('take', 'crank', p).progress;
      for (const value of ['crank:cabinet', 'lens:optics']) p = escapeAction('use', value, p).progress;
      useGame.setState({ progress: p, phase: 'playing', target: 'mirror:0' });
      expect(runEscapeAction('mirrors', '001').ok).toBe(false);
      expect(useGame.getState().progress).toBe(p);
      expect(runEscapeAction('mirrors', '011').ok).toBe(true);
      useGame.setState({ target: 'valve:0' });
      expect(adjustRegulator(1, 4)).toBeUndefined();
      expect(adjustRegulator(0, 2)?.ok).toBe(true);
      useGame.setState({ phase: 'valve', valve: 1 });
      expect(adjustRegulator(1, 4)?.ok).toBe(true);
      expect(useGame.getState().progress.story.dials).toEqual([2, 4, 0]);
    } finally { useGame.setState(previous); }
  });
  it('migrates completed earlier chapters without removing earned access or either ending', () => {
    for (const protocol of ['preserve', 'erase'] as const) {
      const current = campaign(protocol);
      const { escape: _escape, ...oldStory } = current.story;
      void _escape;
      const legacy = JSON.stringify({ ...current, story: oldStory });
      const migrated = restoreSave(legacy);
      expect(migrated.complete).toBe(true); expect(migrated.story.protocol).toBe(protocol);
      expect(migrated.story.zone).toBe('core'); expect(solvedPuzzles(migrated)).toBe(6);
      expect(restoreSave(JSON.stringify(migrated))).toEqual(migrated);
    }
  });
  it('rejects contradictory inventory without overwriting recoverable saves', () => {
    const coherent = escapeAction('take', 'badge', INITIAL).progress;
    const backup = JSON.stringify(coherent);
    const corrupt = updateEscape(coherent, { inventory: ['badge', 'wafer'], opticsSolved: true });
    const storage = new Map([[SAVE_KEY, JSON.stringify(corrupt)], [BACKUP_KEY, backup]]);
    const api = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } };
    expect(readProgress(api)).toEqual({ progress: coherent, recovery: 'backup' });
    expect(() => writeProgress(api, corrupt)).toThrow('incoherente');
    expect(storage.get(BACKUP_KEY)).toBe(backup);
  });
});
