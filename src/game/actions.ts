import { chime } from './audio';
import { echoCommands } from './commands';
import { beginTrace, stateChanges, traceStep } from './telemetry';
import { useGame } from './store';
import { discover, DOCUMENTS, increment, type DocumentId, type StoryOperation, storyAction } from './story';

export function openPanel(phase: 'journal' | 'document' | 'valve' | 'terminal') {
  useGame.getState().set({ phase, target: null });
  if (document.pointerLockElement) document.exitPointerLock();
}

export function runStoryAction(name: StoryOperation, value = '') {
  const s = useGame.getState();
  const traceId = beginTrace(`${name}${value ? ': ' + value : ''}`, 'deterministic');
  traceStep(traceId, 'interpreted', 'Control determinista del terminal.');
  const result = storyAction(name, value, s.progress);
  traceStep(traceId, result.ok ? 'validated' : 'rejected', result.text);
  if (result.ok) traceStep(traceId, 'executed', result.text, { changes: stateChanges(s.progress, result.progress) });
  s.save(result.progress, traceId); s.set({ message: result.text });
  chime(result.ok ? name === 'calibrate' || name === 'choose_protocol' ? 'door' : 'terminal' : 'denied');
  return result;
}

export function targetLabel(target: string) {
  if (target.startsWith('doc:')) return `Leer · ${DOCUMENTS[target.slice(4) as DocumentId].title}`;
  if (target.startsWith('valve:')) return `Ajustar regulador · ${['Contención', 'Refrigeración', 'Análisis'][Number(target.at(-1))]}`;
  return ({ cell: 'Recuperar celda de energía', relay: 'Conectar distribuidor', terminal: 'Conectar con ECHO', door: 'Examinar compuerta', 'lab-terminal': 'ECHO · Validar circuito', 'core-terminal': 'ECHO · Archivo de memorias', 'lab-gate': 'Examinar esclusa del núcleo', 'exit-gate': 'Examinar salida' } as Record<string, string>)[target];
}

export async function interact() {
  const s = useGame.getState();
  if (s.phase !== 'playing' || !s.target) return;
  const traceId = beginTrace(targetLabel(s.target), 'physical');
  traceStep(traceId, 'interpreted', 'Objeto señalado por raycasting, a distancia de interacción.');
  traceStep(traceId, 'validated', 'Interacción disponible en la fase de exploración.');
  s.save(increment(s.progress, 'interactions'));
  if (s.progress.story.protocol === 'erase' && ['terminal', 'lab-terminal', 'core-terminal'].includes(s.target)) {
    traceStep(traceId, 'rejected', 'ECHO está aislada; el terminal no puede ejecutar instrucciones.');
    s.set({ message: 'ECHO está aislada. No hay enlace disponible. La salida auxiliar permanece abierta.' }); chime('denied'); return;
  }
  if (s.target.startsWith('doc:')) {
    const id = s.target.slice(4) as DocumentId;
    const next = discover(useGame.getState().progress, id);
    traceStep(traceId, 'executed', 'Documento recuperado.', { changes: stateChanges(s.progress, next) });
    s.save(next, traceId);
    s.set({ document: id }); chime('terminal'); openPanel('document'); return;
  }
  if (s.target.startsWith('valve:')) {
    traceStep(traceId, 'executed', 'Control del regulador abierto; el valor solo cambia al ajustarlo.');
    s.set({ valve: Number(s.target.at(-1)) as 0 | 1 | 2 }); openPanel('valve'); return;
  }
  if (s.target === 'lab-terminal' || s.target === 'core-terminal') {
    traceStep(traceId, 'executed', 'Enlace con el terminal de esta zona abierto.');
    s.set({ activeTerminal: s.target === 'lab-terminal' ? 'lab' : 'core' }); chime('terminal'); openPanel('terminal'); return;
  }
  if (s.target === 'lab-gate' || s.target === 'exit-gate') {
    traceStep(traceId, 'rejected', 'Esta esclusa exige completar los protocolos de su zona.');
    s.set({ message: s.target === 'lab-gate' ? 'La esclusa exige equilibrar el circuito del laboratorio y validarlo en ECHO.' : 'El control humano exige verificar los registros y elegir un protocolo en el terminal del núcleo.' }); chime('denied'); return;
  }
  if (s.target === 'cell' && !s.progress.cell) {
    const next = { ...useGame.getState().progress, cell: true };
    traceStep(traceId, 'executed', 'Celda recuperada físicamente.', { changes: stateChanges(s.progress, next) });
    s.save(next, traceId); chime('cell');
    s.set({ target: null, message: 'Celda de arranque recuperada. Conéctala al distribuidor del ala derecha.' });
  } else if (s.target === 'relay') {
    const response = await echoCommands.send('restore', useGame.getState().progress);
    if (useGame.getState().phase !== 'playing') return;
    traceStep(traceId, response.progress.power ? 'executed' : 'rejected', response.text, { changes: stateChanges(s.progress, response.progress) });
    s.save(response.progress, traceId); s.set({ message: response.text });
    if (response.progress.power && !s.progress.power) chime('power');
    else if (!response.progress.power) chime('denied');
  } else if (s.target === 'terminal') {
    traceStep(traceId, 'executed', 'Enlace de ECHO abierto.');
    chime('terminal');
    s.set({ phase: 'terminal', target: null, activeTerminal: 'containment' });
    if (document.pointerLockElement) document.exitPointerLock();
  } else if (s.target === 'door') {
    traceStep(traceId, 'rejected', 'La compuerta requiere autorización desde ECHO.');
    chime('denied');
    s.set({ message: s.progress.power ? 'Autoriza la salida desde el terminal ECHO.' : 'La compuerta no recibe energía. Recupera la celda y activa el distribuidor.' });
  }
}

export function openTechnical() {
  const s = useGame.getState();
  history.replaceState(null, '', '/behind-the-system' + location.search);
  s.set({ technicalReturn: s.progress.complete ? 'complete' : s.phase === 'intro' ? 'intro' : 'paused', phase: 'technical', target: null });
  if (document.pointerLockElement) document.exitPointerLock();
}

export function closeTechnical() {
  const s = useGame.getState(); history.replaceState(null, '', '/' + location.search); s.set({ phase: s.technicalReturn });
  requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-open-system]')?.focus({ preventScroll: true }));
}

export function resume() {
  const s = useGame.getState();
  if (s.contextLost) { s.set({ phase: 'paused', message: 'Recarga para recuperar el contexto gráfico y tu partida.' }); return; }
  s.set({ phase: 'playing' });
  if (s.inputMode === 'drag' || matchMedia('(pointer: coarse)').matches) return;
  const canvas = document.querySelector('canvas');
  if (!canvas?.requestPointerLock) {
    s.set({ inputMode: 'drag', message: 'Arrastra sobre la escena para mirar. WASD para moverte; E para interactuar.' });
    return;
  }
  try {
    const request = canvas.requestPointerLock();
    request?.catch(() => {
      if (useGame.getState().phase === 'playing') s.set({ inputMode: 'drag', message: 'Arrastra para mirar. El navegador no permitió capturar el ratón.' });
    });
  } catch { s.set({ inputMode: 'drag' }); }
}
