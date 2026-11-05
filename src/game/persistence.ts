import { restoreSave, SAVE_KEY, type Progress } from './progress';

export const BACKUP_KEY = `${SAVE_KEY}.backup`;
export type Recovery = 'backup' | 'repaired' | 'unavailable' | null;
const valid = (raw: string | null) => {
  if (!raw || raw.length > 65536) return false;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value) || !['cell', 'power', 'door', 'complete'].every(k => typeof value[k] === 'boolean')) return false;
    const restored = restoreSave(raw);
    if (!(['cell', 'installed', 'power', 'door'] as const).every(k => !Object.hasOwn(value, k) || value[k] === restored[k])) return false;
    // Older demo saves have neither story nor installed; their completion migrates to the extended chapter.
    if (!Object.hasOwn(value, 'story')) return !value.complete || (!Object.hasOwn(value, 'installed') && restored.door);
    const story = value.story;
    if (!story || typeof story !== 'object' || Array.isArray(story) || value.complete !== restored.complete) return false;
    if (Object.hasOwn(story, 'escape')) {
      const escape = story.escape;
      if (!escape || typeof escape !== 'object' || Array.isArray(escape)) return false;
      const hints = escape.hints;
      if (!hints || typeof hints !== 'object' || Array.isArray(hints) || Object.keys(hints).length !== Object.keys(restored.story.escape.hints).length || !Object.keys(hints).every(key => hints[key] === restored.story.escape.hints[key as keyof typeof restored.story.escape.hints])) return false;
      if (!Object.keys(restored.story.escape).filter(key => key !== 'hints').every(key =>
        Object.hasOwn(escape, key) && JSON.stringify(escape[key]) === JSON.stringify(restored.story.escape[key as keyof typeof restored.story.escape]))) return false;
    }
    return (['version', 'zone', 'documents', 'dials', 'labSolved', 'order', 'archiveVerified', 'stance', 'protocol', 'seenLab', 'seenCore'] as const)
      .every(k => !Object.hasOwn(story, k) || JSON.stringify(story[k]) === JSON.stringify(restored.story[k]));
  }
  catch { return false; }
};
export function readProgress(storage: Pick<Storage, 'getItem'>): { progress: Progress; recovery: Recovery } {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (valid(raw)) return { progress: restoreSave(raw), recovery: null };
    const backup = storage.getItem(BACKUP_KEY);
    if (valid(backup)) return { progress: restoreSave(backup), recovery: 'backup' };
    return { progress: restoreSave(raw), recovery: raw === null && backup === null ? null : 'repaired' };
  } catch { return { progress: restoreSave(null), recovery: 'unavailable' }; }
}
export function writeProgress(storage: Pick<Storage, 'getItem' | 'setItem'>, progress: Progress) {
  const raw = JSON.stringify(progress);
  if (!valid(raw)) throw new Error('El progreso es incoherente; se conservan los guardados anteriores.');
  const previous = storage.getItem(SAVE_KEY);
  // A backup failure must not prevent saving the new progress.
  if (valid(previous)) try { storage.setItem(BACKUP_KEY, previous!); } catch { /* Primary save still attempted. */ }
  storage.setItem(SAVE_KEY, raw);
}
