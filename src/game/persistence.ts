import { INITIAL, restoreSave, SAVE_KEY, type Progress } from './progress';

export const BACKUP_KEY = `${SAVE_KEY}.backup`;
export type Recovery = 'backup' | 'repaired' | 'unavailable' | null;
const valid = (raw: string | null) => {
  if (!raw || raw.length > 65536) return false;
  try { const value = JSON.parse(raw); return value && typeof value === 'object' && !Array.isArray(value) && ['cell', 'power', 'door', 'complete'].every(k => typeof value[k] === 'boolean'); }
  catch { return false; }
};
export function readProgress(storage: Pick<Storage, 'getItem'>): { progress: Progress; recovery: Recovery } {
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (valid(raw)) return { progress: restoreSave(raw), recovery: null };
    const backup = storage.getItem(BACKUP_KEY);
    if (valid(backup)) return { progress: restoreSave(backup), recovery: 'backup' };
    return { progress: { ...INITIAL }, recovery: raw === null ? null : 'repaired' };
  } catch { return { progress: { ...INITIAL }, recovery: 'unavailable' }; }
}
export function writeProgress(storage: Pick<Storage, 'getItem' | 'setItem'>, progress: Progress) {
  const previous = storage.getItem(SAVE_KEY);
  // A backup failure must not prevent saving the new progress.
  if (valid(previous)) try { storage.setItem(BACKUP_KEY, previous!); } catch { /* Primary save still attempted. */ }
  storage.setItem(SAVE_KEY, JSON.stringify(progress));
}
