import { create } from 'zustand';
import { chime } from '../game/audio';
import { useGame } from '../game/store';
import { type Progress } from '../game/progress';
import { applyAction, deterministicPlan, parsePlan, type Action, type ActionResult, type Plan } from './actions';
import { beginTrace, clearTraces, stateChanges, traceStep } from '../game/telemetry';
import { checkCapabilities, useCapabilities } from './capabilities';
import { increment } from '../game/story';
import { INFERENCE_TIMEOUT_MS, LOAD_TIMEOUT_MS, MAX_HISTORY_TURNS, MAX_INPUT_CHARS } from './model';
import type { MemoryTurn, WorkerRequest, WorkerResponse } from './protocol';

type Status = 'off' | 'loading' | 'ready' | 'generating' | 'error' | 'unsupported' | 'clearing';
export type Diagnostic = { origin: 'llm' | 'deterministic'; input: string; raw: string; actions: Action[]; context: Progress; outcome: string; elapsedMs?: number; tokens?: number };
export type Interpretation = { traceId?: number; origin: Diagnostic['origin']; plan: Plan; result?: ActionResult; proposal?: Action };
type AiState = { status: Status; progress: number; cached: boolean | null; message: string; history: MemoryTurn[]; diagnostics: Diagnostic[] };
export const useEchoAi = create<AiState>(() => ({ status: 'off', progress: 0, cached: null, message: 'Modo determinista. El modelo solo se descarga con tu autorización.', history: [], diagnostics: [] }));
export const aiIsBusy = (state: AiState) => ['loading', 'generating', 'clearing'].includes(state.status);

let worker: Worker | undefined;
let sequence = 0, session = 0;
let activeTrace: number | undefined;
let proposal: { action: string; traceId: number } | undefined;
function discardProposal(message: string) {
  if (proposal) {
    traceStep(proposal.traceId, 'cancelled', message);
    useEchoAi.setState(s => ({ diagnostics: s.diagnostics.map((d, i) => i === s.diagnostics.length - 1 ? { ...d, outcome: message } : d) }));
  }
  proposal = undefined;
}
let pending: { id: number; resolve: (value: WorkerResponse) => void; reject: (reason: Error) => void; timer: ReturnType<typeof setTimeout> } | undefined;
function endPending(error: Error) {
  if (pending) { clearTimeout(pending.timer); pending.reject(error); pending = undefined; }
}
function stop(message = 'Modo determinista. Pesos conservados en caché si la descarga se completó.') {
  if (activeTrace !== undefined) traceStep(activeTrace, 'cancelled', 'Solicitud cancelada. El Worker se ha liberado; no se ejecutó ninguna acción.');
  activeTrace = undefined; discardProposal('Propuesta descartada al liberar la IA. No se ejecutó ninguna acción.');
  session++; worker?.terminate(); worker = undefined;
  endPending(new DOMException('Operación cancelada.', 'AbortError'));
  useEchoAi.setState({ status: 'off', progress: 0, message });
}

function rpc(request: Omit<Extract<WorkerRequest, { type: 'generate' }>, 'id'> | { type: 'load' | 'clear' }, timeout: number) {
  if (pending) return Promise.reject(new Error('ECHO ya está procesando una operación.'));
  if (!worker) {
    worker = new Worker(new URL('./echo.worker.ts', import.meta.url), { type: 'module', name: 'echo-local-inference' });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      if (!pending || response.id !== pending.id) return;
      if (response.type === 'progress') { useEchoAi.setState({ progress: response.progress, ...(response.message ? { message: response.message } : {}), ...(response.cached !== undefined ? { cached: response.cached } : {}) }); return; }
      if (response.type === 'error') {
        const error = new Error(response.message); error.name = response.unsupported ? 'UnsupportedError' : 'Error'; endPending(error); return;
      }
      const current = pending; pending = undefined; clearTimeout(current.timer); current.resolve(response);
    };
    worker.onerror = event => { event.preventDefault(); endPending(new Error('El Worker de IA se ha interrumpido. El juego sigue disponible.')); };
    worker.onmessageerror = () => endPending(new Error('No se pudo leer la respuesta del Worker.'));
  }
  return new Promise<WorkerResponse>((resolve, reject) => {
    const id = ++sequence;
    pending = { id, resolve, reject, timer: setTimeout(() => {
      worker?.terminate(); worker = undefined;
      endPending(new Error('Se agotó el tiempo de la IA local. Puedes continuar en modo determinista.'));
    }, timeout) };
    try { worker!.postMessage({ ...request, id }); }
    catch { endPending(new Error('No se pudo enviar la petición al Worker.')); }
  });
}

function addDiagnostic(entry: Diagnostic) {
  useEchoAi.setState(state => ({ diagnostics: [...state.diagnostics, entry].slice(-8) }));
}

async function load() {
  if (useGame.getState().phase !== 'terminal' || useGame.getState().progress.story.protocol === 'erase' || aiIsBusy(useEchoAi.getState()) || useEchoAi.getState().status === 'ready') return;
  if (useCapabilities.getState().status !== 'available') { void checkCapabilities(); useEchoAi.setState({ message: 'Comprueba primero los requisitos locales antes de descargar el modelo.' }); return; }
  const current = session;
  discardProposal('Propuesta anterior descartada al preparar el modelo.');
  useEchoAi.setState({ status: 'loading', progress: 0, message: 'Descargando o recuperando pesos y compilando el modelo local…' });
  try {
    const response = await rpc({ type: 'load' }, LOAD_TIMEOUT_MS);
    if (current !== session) return;
    if (response.type !== 'ready') throw new Error('El runtime no confirmó la carga.');
    useEchoAi.setState({ status: 'ready', progress: 1, cached: true, message: 'Qwen2.5 local preparado. Las instrucciones se procesan en este dispositivo.' });
  } catch (error) {
    if (current !== session) return;
    worker?.terminate(); worker = undefined;
    useEchoAi.setState({ status: error instanceof Error && error.name === 'UnsupportedError' ? 'unsupported' : 'error', message: error instanceof Error ? error.message : 'No se pudo cargar la IA local.' });
  }
}

async function clearCache() {
  if (useGame.getState().phase !== 'terminal') return;
  stop(); const current = session;
  useEchoAi.setState({ status: 'clearing', message: 'Eliminando solo la caché del modelo ECHO…' });
  try {
    await rpc({ type: 'clear' }, 15000);
    if (current !== session) return;
    worker?.terminate(); worker = undefined;
    useEchoAi.setState({ status: 'off', cached: false, message: 'Caché del modelo eliminada. El progreso del juego se conserva.' });
  } catch {
    if (current !== session) return;
    worker?.terminate(); worker = undefined;
    useEchoAi.setState({ status: 'error', message: 'No se pudo eliminar la caché. Puedes borrarla desde el almacenamiento del navegador.' });
  }
}

async function interpret(input: string): Promise<Interpretation | null> {
  if (useGame.getState().progress.story.protocol === 'erase') throw new Error('ECHO está aislada. El archivo fue eliminado. La salida auxiliar está abierta.');
  const text = input.trim();
  if (!text || text.length > MAX_INPUT_CHARS || useGame.getState().phase !== 'terminal') throw new Error(`Escribe entre 1 y ${MAX_INPUT_CHARS} caracteres desde el terminal.`);
  if (aiIsBusy(useEchoAi.getState())) throw new Error('Cancela la operación actual o espera a que termine.');
  const current = session;
  discardProposal('Propuesta sustituida por una nueva instrucción.');
  const traceId = beginTrace(text, useEchoAi.getState().status === 'ready' ? 'llm' : 'deterministic');
  activeTrace = traceId;
  let origin: Diagnostic['origin'] = 'deterministic', plan: Plan, raw = '', elapsedMs: number | undefined, tokens: number | undefined;
  if (useEchoAi.getState().status === 'ready') {
    useEchoAi.setState({ status: 'generating', message: 'ECHO está interpretando tu instrucción localmente…' });
    try {
      const response = await rpc({ type: 'generate', input: text, context: { ...useGame.getState().progress }, history: useEchoAi.getState().history }, INFERENCE_TIMEOUT_MS);
      if (current !== session || useGame.getState().phase !== 'terminal') return null;
      if (response.type !== 'result') throw new Error('Respuesta inesperada del Worker.');
      raw = response.raw; elapsedMs = response.elapsedMs; tokens = response.tokens;
      if (response.finishReason !== 'stop') throw new Error('La generación no terminó dentro del límite de tokens.');
      useGame.getState().save(increment(useGame.getState().progress, 'inferences'));
      plan = parsePlan(raw); origin = 'llm';
      useEchoAi.setState({ status: 'ready', message: 'Inferencia local completada; las acciones siguen sujetas a validación.' });
    } catch (error) {
      if (current !== session || useGame.getState().phase !== 'terminal') return null;
      worker?.terminate(); worker = undefined;
      const message = error instanceof Error ? error.message : 'Inferencia fallida.';
      useEchoAi.setState({ status: 'error', message: `${message} Se utiliza el modo determinista, sin LLM.` });
      traceStep(traceId, 'error', `${message} Se utiliza el intérprete determinista; no se ha aplicado ninguna acción.`);
      plan = deterministicPlan(text);
    }
  } else plan = deterministicPlan(text);
  if (current !== session || useGame.getState().phase !== 'terminal') return null;
  const context = { ...useGame.getState().progress }, action = plan.actions[0];
  const result = action ? applyAction(action, context) : undefined;
  traceStep(traceId, 'interpreted', origin === 'llm' ? 'Salida JSON estructurada de la inferencia local.' : 'Interpretación mediante reglas; sin inferencia de LLM.', { origin, action });
  traceStep(traceId, result?.ok === false ? 'rejected' : 'validated', result?.text ?? 'Conversación sin acciones.');
  activeTrace = undefined;
  const proposed = action && result?.ok && !['inspect', 'query_status'].includes(action.name) ? action : undefined;
  if (proposed) { proposal = { action: JSON.stringify(proposed), traceId }; traceStep(traceId, 'confirmation', 'Se requiere confirmación explícita. Los dispositivos y decisiones todavía no han cambiado.'); }
  else if (result?.ok) traceStep(traceId, 'executed', 'Consulta de solo lectura completada.');
  const reply = `${plan.reply} ${proposed ? 'Acción propuesta; pendiente de confirmación.' : result?.text ?? ''}`;
  useEchoAi.setState(state => ({ history: [...state.history, { user: text, assistant: reply.slice(0, 160) }].slice(-MAX_HISTORY_TURNS) }));
  addDiagnostic({ origin, input: text, raw: raw.slice(0, 8192), actions: plan.actions, context, outcome: proposed ? 'Validada; pendiente de confirmación.' : result?.text ?? 'Sin acción.', elapsedMs, tokens });
  return { traceId, origin, plan, result, proposal: proposed };
}

function confirm(action: Action): ActionResult {
  const s = useGame.getState();
  if (s.phase !== 'terminal') throw new Error('La acción solo se permite mientras el terminal está abierto.');
  if (!proposal || proposal.action !== JSON.stringify(action)) throw new Error('La propuesta ha caducado o ya se confirmó. Envía una instrucción nueva.');
  const traceId = proposal.traceId; proposal = undefined;
  const checked = parsePlan(JSON.stringify({ reply: '', actions: [action] })).actions[0];
  const result = applyAction(checked, s.progress);
  traceStep(traceId, result.ok ? 'validated' : 'rejected', `Comprobación al confirmar: ${result.text}`);
  if (result.ok) {
    traceStep(traceId, 'executed', result.text, { changes: stateChanges(s.progress, result.progress) });
    s.save(result.progress, traceId); s.set({ message: result.text });
    if (!s.progress.power && result.progress.power) chime('power');
    else if (!s.progress.door && result.progress.door) chime('door');
    else chime('terminal');
  } else chime('denied');
  useEchoAi.setState(state => ({ history: state.history.map((turn, i) => i === state.history.length - 1 ? { ...turn, assistant: result.text.slice(0, 160) } : turn), diagnostics: state.diagnostics.map((entry, i) => i === state.diagnostics.length - 1 ? { ...entry, outcome: `${result.ok ? 'Ejecutada' : 'Rechazada'}: ${result.text}` } : entry) }));
  return result;
}

// A loaded model never keeps GPU memory while the player explores; no background downloads.
const unsubscribeGame = useGame.subscribe((next, previous) => {
  if (next.phase !== 'terminal' && previous.phase === 'terminal') stop();
  if (next.progress.story.protocol === 'erase' && previous.progress.story.protocol !== 'erase') stop('ECHO aislada. Archivo eliminado; salida auxiliar autorizada.');
  if (next.phase === 'intro' && previous.phase !== 'intro' && !next.progress.cell && next.progress.story.documents.length === 0) { useEchoAi.setState({ history: [], diagnostics: [] }); clearTraces(); }
});
const visibility = () => { if (document.hidden && ['loading', 'generating', 'ready'].includes(useEchoAi.getState().status)) stop('IA liberada al ocultar la pestaña. Puedes volver a cargarla desde la caché; la partida se conserva.'); };
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visibility);
if (import.meta.hot) import.meta.hot.dispose(() => { unsubscribeGame(); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility); stop(); });
export const echoAi = { load, stop, clearCache, interpret, confirm, discard: () => discardProposal('Propuesta descartada por el jugador. No se ejecutó ninguna acción.') };
