import { create } from 'zustand';
import { checkpointMessage, INITIAL, SAVE_KEY, type Progress } from './progress';
import { BACKUP_KEY, readProgress, writeProgress, type Recovery } from './persistence';
import { traceStep } from './telemetry';
import type { GraphicsTier, Quality } from './graphics';
import { freshStory, type DocumentId, type Zone } from './story';
import type { Incident, Mechanism } from './escape';

export type Phase = 'intro' | 'playing' | 'paused' | 'terminal' | 'complete' | 'document' | 'journal' | 'valve' | 'cinematic' | 'technical' | 'mechanism' | 'inventory';
export type Cinematic = 'lab' | 'core' | 'preserve' | 'erase';
export type { Quality } from './graphics';
export type Target = 'cell' | 'relay' | 'terminal' | 'door' | 'lab-terminal' | 'core-terminal' | 'lab-gate' | 'exit-gate' | `doc:${DocumentId}` | 'valve:0' | 'valve:1' | 'valve:2' | 'mirror:0' | 'mirror:1' | 'mirror:2' | 'lab-validator' | 'item:badge' | 'item:crank' | `escape:${Mechanism}` | 'supply-start' | 'supply:0' | 'supply:1' | 'supply:2';

function load() {
  try { return readProgress(localStorage); }
  catch { return { progress: { ...INITIAL }, recovery: 'unavailable' as Recovery }; }
}
const loaded = load();

type Game = {
  progress: Progress; phase: Phase; target: Target | null; message: string;
  ready: boolean; labReady: boolean; coreReady: boolean; backend: string; quality: Quality; tier: GraphicsTier; resolutionScale: number; performanceLevel: number; effects: boolean; muted: boolean;
  saveFailed: boolean; locked: boolean; inputMode: 'mouse' | 'drag';
  activeTerminal: Zone; document: DocumentId | null; valve: 0 | 1 | 2;
  mechanism: Mechanism | null; incident: Incident | null; powerLines: string;
  cinematic: Cinematic | null; skipCinematic: boolean;
  technicalReturn: 'intro' | 'paused' | 'complete'; recovery: Recovery; contextLost: boolean;
  set: (patch: Partial<Omit<Game, 'set' | 'save' | 'reset'>>) => void;
  save: (progress: Progress, traceId?: number) => void;
  reset: () => void;
};

export const useGame = create<Game>((set) => ({
  progress: loaded.progress, recovery: loaded.recovery, phase: 'intro', target: null,
  message: checkpointMessage(loaded.progress),
  ready: false, labReady: false, coreReady: false, backend: 'INICIALIZANDO', quality: 'auto', tier: typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches ? 'low' : 'laptop', resolutionScale: 1, performanceLevel: 0, effects: true, muted: false,
  saveFailed: false, locked: false, inputMode: 'mouse',
  activeTerminal: 'containment', document: null, valve: 0, cinematic: null, skipCinematic: false,
  mechanism: null, incident: null, powerLines: loaded.progress.story.escape.powerRouted ? '101' : '000',
  technicalReturn: 'intro', contextLost: false,
  set,
  save: (progress, traceId) => {
    let saveFailed = false;
    try { writeProgress(localStorage, progress); } catch { saveFailed = true; }
    set({ progress, saveFailed, ...(progress.story.escape.powerRouted ? { powerLines: '101' } : {}) });
    if (traceId !== undefined) traceStep(traceId, saveFailed ? 'error' : 'saved', saveFailed ? 'Almacenamiento no disponible; progreso conservado en memoria durante esta sesión.' : 'Progreso guardado en localStorage con copia de recuperación.');
  },
  reset: () => {
    let saveFailed = false;
    try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(BACKUP_KEY); } catch { saveFailed = true; }
    set({ progress: { ...INITIAL, story: freshStory() }, phase: 'intro', target: null, saveFailed, cinematic: null, document: null, mechanism: null, incident: null, powerLines: '000',
      recovery: null, message: checkpointMessage(INITIAL) });
  },
}));
