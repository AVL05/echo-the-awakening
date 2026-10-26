import { describe, expect, it } from 'vitest';
import { INITIAL, restoreSave, type Progress } from '../src/game/progress';
import { compactMemory, discover, freshStory, hint, storyAction, updateStory, type DocumentId } from '../src/game/story';
import { applyAction, deterministicPlan, parsePlan, type Action } from '../src/ai/actions';
import { canMove } from '../src/game/world';

function start(): Progress { return { ...INITIAL, cell: true, installed: true, power: true, door: true, story: { ...freshStory(), zone: 'lab' } }; }
function documents(p: Progress, ...ids: DocumentId[]) { return ids.reduce((next, id) => discover(next, id), p); }
function laboratory() { return storyAction('calibrate', '243', documents(start(), 'manual', 'measurements', 'copy', 'evacuation')).progress; }
function archive() { return storyAction('verify_archive', 'copy,quarantine,cut', documents(updateStory(laboratory(), { zone: 'core' }), 'quarantine', 'consent')).progress; }

describe('narrative authority and three-puzzle campaign', () => {
  it('requires research, the real calibration and a local terminal', () => {
    expect(storyAction('calibrate', '243', start()).ok).toBe(false);
    const researched = documents(start(), 'manual', 'measurements');
    const wrong = storyAction('calibrate', '333', researched);
    expect(wrong.ok).toBe(false); expect(wrong.progress.story.stats.mistakes).toBe(1);
    expect(wrong.progress.story.labSolved).toBe(false);
    expect(storyAction('calibrate', '243', updateStory(researched, { zone: 'containment' })).ok).toBe(false);
    expect(storyAction('calibrate', '243', researched).progress.story.labSolved).toBe(true);
  });
  it('requires evidence from all three rooms and respects timestamp order', () => {
    const p = updateStory(laboratory(), { zone: 'core' });
    expect(storyAction('verify_archive', 'copy,quarantine,cut', p).ok).toBe(false);
    const researched = documents(p, 'quarantine');
    expect(storyAction('verify_archive', 'cut,copy,quarantine', researched).progress.story.stats.mistakes).toBe(1);
    expect(storyAction('verify_archive', 'copy,copy,cut', researched).ok).toBe(false);
    expect(storyAction('verify_archive', 'copy,quarantine,cut', researched).progress.story.archiveVerified).toBe(true);
  });
  it('makes both endings reachable, gated and irreversible with distinct consequences', () => {
    for (const protocol of ['preserve', 'erase'] as const) for (const decision of ['trust', 'confront'] as const) {
      expect(storyAction('choose_protocol', protocol, archive()).ok).toBe(false);
      const stance = storyAction('record_decision', decision, archive()).progress;
      const result = storyAction('choose_protocol', protocol, stance);
      expect(result.ok).toBe(true); expect(result.progress.story.protocol).toBe(protocol);
      expect(storyAction('choose_protocol', protocol === 'erase' ? 'preserve' : 'erase', result.progress).ok).toBe(false);
      expect(canMove(0, -64, result.progress)).toBe(true);
      const restored = restoreSave(JSON.stringify({ ...result.progress, complete: true }));
      expect(restored).toEqual({ ...result.progress, complete: true });
    }
  });
  it('repairs forged prerequisites and extends old demo saves without discarding power', () => {
    const old = restoreSave(JSON.stringify({ cell: true, power: true, door: true, complete: true }));
    expect(old).toMatchObject({ power: true, door: true, complete: false, story: { zone: 'lab' } });
    const forged = restoreSave(JSON.stringify({ ...start(), complete: true, story: { ...freshStory(), zone: 'core', labSolved: true, archiveVerified: true, protocol: 'erase', documents: ['__proto__'], stats: { seconds: Infinity, hints: -8 } } }));
    expect(forged.complete).toBe(false); expect(forged.story.protocol).toBe('none');
    expect(forged.story.documents).toEqual([]); expect(forged.story.stats.hints).toBe(0);
    expect(restoreSave(JSON.stringify(updateStory(start(), { order: ['', 'cut', 'copy'] }))).story.order).toEqual(['', 'cut', 'copy']);
  });
  it('blocks later rooms and each gate while allowing revisits', () => {
    expect(canMove(0, -18, INITIAL)).toBe(false);
    expect(canMove(0, -18, start())).toBe(true);
    expect(canMove(3, -15, start())).toBe(false);
    expect(canMove(0, -39, start())).toBe(false);
    expect(canMove(0, -39, laboratory())).toBe(true);
    expect(canMove(0, -49, laboratory())).toBe(false);
    expect(canMove(4, -54, laboratory())).toBe(true);
    expect(canMove(0, -63, archive())).toBe(false);
  });
  it('keeps compact memory bounded and hides undiscovered incident evidence', () => {
    expect(compactMemory(INITIAL)).not.toContain('04:14');
    expect(compactMemory(archive()).length).toBeLessThan(650);
    expect(hint(documents(start(), 'manual', 'measurements'))).toContain('x + 2x');
    expect(storyAction('request_hint', '', start()).progress.story.stats.hints).toBe(1);
  });
  it('shares deterministic validation with new JSON tools and rejects fabricated arguments', () => {
    const a: Action = { name: 'calibrate', target: 'lab', source: 'none', destination: 'none', value: '243' };
    expect(parsePlan(JSON.stringify({ reply: '', actions: [a] })).actions[0]).toEqual(a);
    expect(applyAction(a, start()).ok).toBe(false);
    expect(applyAction(a, documents(start(), 'manual', 'measurements')).progress.story.labSolved).toBe(true);
    expect(() => parsePlan(JSON.stringify({ reply: '', actions: [{ ...a, target: 'protocol' }] }))).toThrow();
    expect(() => parsePlan(JSON.stringify({ reply: '', actions: [{ ...a, value: 243 }] }))).toThrow();
    const inspect: Action = { name: 'inspect', target: 'document', source: 'none', destination: 'none', value: 'copy' };
    expect(applyAction(inspect, start()).ok).toBe(false);
    expect(applyAction(inspect, documents(start(), 'copy')).text).toContain('04:14');
    expect(deterministicPlan('Calibra los reguladores 2,4,3').actions[0]).toEqual(a);
    expect(deterministicPlan('Verifica la cronología: copia, encierro, corte').actions[0].value).toBe('copy,quarantine,cut');
    expect(deterministicPlan('No borres las memorias').actions).toEqual([]);
  });
});
