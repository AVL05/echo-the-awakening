import { chime } from './audio';
import { beginTrace, stateChanges, traceStep } from './telemetry';
import { useGame } from './store';
import { discover, DOCUMENTS, increment, type DocumentId, type StoryOperation, storyAction } from './story';
import { escapeAction, ITEMS, MECHANISMS, type EscapeOperation, type ItemId, type Mechanism } from './escape';

export function openPanel(phase: 'journal' | 'document' | 'valve' | 'terminal' | 'inventory' | 'mechanism') {
  useGame.getState().set({ phase, target: null });
  if (document.pointerLockElement) document.exitPointerLock();
}

export function runEscapeAction(name: EscapeOperation, value = '') {
  const s = useGame.getState();
  const device = name === 'power' ? 'relay' : name === 'mirrors' ? 'optics' : name;
  const allowed = name === 'take' ? s.phase === 'playing' && s.target === `item:${value}`
    : name === 'power' && s.phase === 'playing' ? s.target === 'supply-start' && value === s.powerLines && /^[01]{3}$/.test(value)
    : name === 'mirrors' && s.phase === 'playing' && s.target?.startsWith('mirror:') ? /^[01]{3}$/.test(value) && [...value].every((bit, i) => i === Number(s.target?.at(-1)) || bit === s.progress.story.escape.mirrors[i])
    : s.phase === 'mechanism' && (name === 'use' ? value.split(':')[1] === s.mechanism : device === s.mechanism);
  if (!allowed) return { ok: false, text: 'Esta operación exige estar ante el mecanismo físico.', progress: s.progress };
  const traceId = beginTrace(`${name}: ${value}`, 'physical');
  traceStep(traceId, 'interpreted', 'Control físico del escape room, sin LLM.');
  const result = escapeAction(name, value, s.progress);
  traceStep(traceId, result.ok ? 'executed' : 'rejected', result.text, { changes: stateChanges(s.progress, result.progress) });
  s.save(result.progress, traceId); s.set({ message: result.text });
  chime(!result.ok ? 'denied' : !s.progress.power && result.progress.power ? 'power' : name === 'optics' ? 'door' : 'terminal');
  return result;
}

export function runStoryAction(name: StoryOperation, value = '', physical = false) {
  const s = useGame.getState();
  const traceId = beginTrace(`${name}${value ? ': ' + value : ''}`, physical ? 'physical' : 'deterministic');
  traceStep(traceId, 'interpreted', physical ? 'Control físico de la instalación.' : 'Control determinista del terminal.');
  const result = storyAction(name, value, s.progress);
  traceStep(traceId, result.ok ? 'validated' : 'rejected', result.text);
  if (result.ok) traceStep(traceId, 'executed', result.text, { changes: stateChanges(s.progress, result.progress) });
  s.save(result.progress, traceId); s.set({ message: result.text });
  chime(result.ok ? name === 'calibrate' || name === 'choose_protocol' ? 'door' : 'terminal' : 'denied');
  return result;
}

export function adjustRegulator(index: number, units: number) {
  const s = useGame.getState();
  if (!((s.phase === 'playing' && s.target === `valve:${index}`) || (s.phase === 'valve' && s.valve === index))) return;
  return runStoryAction('adjust_dial', `${index}:${units}`, true);
}

export function adjustSupply(index: number) {
  const s = useGame.getState();
  if (!Number.isInteger(index) || index < 0 || index > 2 || !/^[01]{3}$/.test(s.powerLines)
    || s.progress.story.zone !== 'containment' || s.progress.story.protocol !== 'none' || s.progress.story.escape.powerRouted
    || !((s.phase === 'playing' && s.target === `supply:${index}`) || (s.phase === 'mechanism' && s.mechanism === 'relay'))) return false;
  const powerLines = [...s.powerLines].map((bit, i) => i === index ? bit === '0' ? '1' : '0' : bit).join('');
  const trace = beginTrace(`Interruptor ${index + 1}`, 'physical');
  traceStep(trace, 'validated', 'Mando del distribuidor accesible; selección provisional, sin energizar.');
  s.set({ powerLines });
  traceStep(trace, 'executed', `Selección de líneas: ${s.powerLines} → ${powerLines}. El progreso guardado no cambia.`);
  chime('switch');
  return true;
}

export function targetLabel(target: string) {
  if (target.startsWith('supply:')) return `${useGame.getState().progress.story.escape.powerRouted ? 'Bloqueado' : 'Alternar'} · ${['Soporte vital', 'Archivo', 'Refrigeración'][Number(target.at(-1))]}`;
  if (target === 'supply-start') return useGame.getState().progress.power ? 'Red estable · arranque validado' : 'Validar y energizar el distribuidor';
  if (target.startsWith('mirror:')) return `Girar espejo ${'ABC'[Number(target.at(-1))]}`;
  if (target === 'lab-validator') return 'Comprobar equilibrio del circuito';
  if (target.startsWith('item:')) return `Recoger · ${ITEMS[target.slice(5) as ItemId].name}`;
  if (target.startsWith('escape:')) return `Examinar · ${MECHANISMS[target.slice(7) as Mechanism]}`;
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
  if (s.target.startsWith('supply:')) { adjustSupply(Number(s.target.at(-1))); return; }
  if (s.target === 'supply-start') { runEscapeAction('power', s.powerLines); return; }
  if (s.target.startsWith('mirror:')) {
    const i = Number(s.target.at(-1));
    runEscapeAction('mirrors', [...s.progress.story.escape.mirrors].map((bit, index) => index === i ? bit === '0' ? '1' : '0' : bit).join('')); return;
  }
  if (s.target === 'lab-validator') { runStoryAction('calibrate', s.progress.story.dials.join(''), true); return; }
  if (s.target.startsWith('item:')) { runEscapeAction('take', s.target.slice(5)); s.set({ target: null }); return; }
  if (s.target.startsWith('escape:') || s.target === 'relay') {
    s.set({ mechanism: s.target === 'relay' ? 'relay' : s.target.slice(7) as Mechanism });
    chime('terminal'); openPanel('mechanism'); return;
  }
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
    s.set({ message: s.target === 'lab-gate' ? 'La esclusa exige equilibrio eléctrico y verificación óptica humana.' : 'Prepara el control independiente del archivo y confirma sus consecuencias en ECHO.' }); chime('denied'); return;
  }
  if (s.target === 'cell' && !s.progress.cell) {
    if (!s.progress.story.escape.locker) { s.set({ message: 'La celda permanece tras el cierre de la taquilla.' }); return; }
    const next = { ...useGame.getState().progress, cell: true };
    traceStep(traceId, 'executed', 'Celda recuperada físicamente.', { changes: stateChanges(s.progress, next) });
    s.save(next, traceId); chime('cell');
    s.set({ target: null, message: 'Celda recuperada. Abre el distribuidor derecho y úsala desde su inventario.' });
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
