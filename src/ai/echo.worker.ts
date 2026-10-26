/// <reference lib="webworker" />
import { MLCEngine, hasModelInCache, deleteModelAllInfoInCache, type ChatCompletionMessageParam } from '@mlc-ai/web-llm';
import { compactMemory } from '../game/story';
import { restoreSave, type Progress } from '../game/progress';
import { PLAN_SCHEMA } from './actions';
import { APP_CONFIG, CONTEXT_TOKENS, MAX_HISTORY_TURNS, MAX_INPUT_CHARS, MAX_OUTPUT_TOKENS, MODEL_BASE, MODEL_ID, WEIGHT_BYTES } from './model';
import type { WorkerRequest, WorkerResponse } from './protocol';

const scope = self as unknown as DedicatedWorkerGlobalScope;
let engine: MLCEngine | undefined;
let busy = false;
const send = (message: WorkerResponse) => scope.postMessage(message);
const SYSTEM = `You are ECHO, the calm environmental operator of the abandoned Lazarus facility, level -07. Reply briefly in Spanish. Your memory is fragmented. Do not invent facts. First identify the player's intent. Questions NEVER mean activate or deactivate.
Return only JSON with reply (one short Spanish sentence) and actions (zero or one function call). Calls contain name,target,source,destination. Use source=destination="none" except transfers. Examples:
"¿Dónde está la celda?" -> {"reply":"Comprobaré la celda.","actions":[{"name":"inspect","target":"cell","source":"none","destination":"none"}]}
"Consulta el estado" -> {"reply":"Consultaré los sistemas.","actions":[{"name":"query_status","target":"facility","source":"none","destination":"none"}]}
"Activa el reactor" -> {"reply":"Propondré activar el circuito.","actions":[{"name":"activate","target":"reactor","source":"none","destination":"none"}]}
"Desactiva el reactor" -> {"reply":"Propondré desconectar el circuito.","actions":[{"name":"deactivate","target":"reactor","source":"none","destination":"none"}]}
"Transfiere del distribuidor al reactor" -> {"reply":"Solicitaré la transferencia.","actions":[{"name":"transfer_energy","target":"reactor","source":"relay","destination":"reactor"}]}
"Abre la compuerta" -> {"reply":"Solicitaré la apertura.","actions":[{"name":"open_door","target":"door","source":"none","destination":"none"}]}
For dialogue use actions=[]. Calls are proposals, NEVER claim execution. Physical collection/installation require WASD/E. Opening requires power. Deactivation requires door closed.`;

function storySystem(p: Progress) {
  if (p.story.zone === 'containment') return SYSTEM;
  const common = `You are ECHO of abandoned Lazarus. Reply in one short Spanish sentence. Never invent evidence. Respect discovered documents and human decisions. Return JSON reply and actions (0 or 1). Actions use name,target,source="none",destination="none" and REQUIRED value for calibrate, verify_archive, record_decision, choose_protocol. Do not claim execution: all actions are proposals. Use query_status(facility) for status, request_hint(facility) for help, inspect(echo) for identity. Never choose an ending unless explicitly instructed. For dialogue use actions=[].`;
  const examples = p.story.zone === 'lab' ? `
"Calibra los canales a 2,4,3" -> {"reply":"Propondré esos valores.","actions":[{"name":"calibrate","target":"lab","source":"none","destination":"none","value":"243"}]}
"Me mentiste. Entrega el control humano" -> {"reply":"Reconoceré el engaño.","actions":[{"name":"record_decision","target":"echo","source":"none","destination":"none","value":"confront"}]}
"Confío en tu intención" -> {"reply":"Respetaré tu decisión.","actions":[{"name":"record_decision","target":"echo","source":"none","destination":"none","value":"trust"}]}` : `
"Verifica la cronología: copia, encierro, corte" -> {"reply":"Verificaré ese orden.","actions":[{"name":"verify_archive","target":"archive","source":"none","destination":"none","value":"copy,quarantine,cut"}]}
"Conserva el archivo" -> {"reply":"Propondré conservar las memorias.","actions":[{"name":"choose_protocol","target":"protocol","source":"none","destination":"none","value":"preserve"}]}
"Borra las memorias" -> {"reply":"Propondré el borrado irreversible.","actions":[{"name":"choose_protocol","target":"protocol","source":"none","destination":"none","value":"erase"}]}`;
  const decisions = `
For confronting ECHO use record_decision target=echo value=confront; trust uses value=trust. Chronology value is 3 event IDs separated by commas: copy,quarantine,cut in the requested order. Calibrate value is 3 digits (C,R,A), each0..4. Preserving/burning requires verified archive and ethics document; the game enforces it.`;
  const clues = `${p.story.documents.includes('manual') ? ' Cooling=2*Containment. Analysis=Containment+1.' : ''}${p.story.documents.includes('measurements') ? ' Total=9.' : ''}${p.story.documents.includes('evacuation') ? ' cut04:17.' : ''}${p.story.documents.includes('copy') ? ' copy04:14.' : ''}${p.story.documents.includes('quarantine') ? ' quarantine04:16.' : ''}`;
  return common + examples + decisions + '\nKnown evidence:' + clues;
}

scope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (busy) { send({ id: request.id, type: 'error', message: 'Ya hay una operación en curso.' }); return; }
  busy = true;
  try {
    if (request.type === 'clear') {
      await engine?.unload(); engine = undefined;
      await deleteModelAllInfoInCache(MODEL_ID, APP_CONFIG);
      await scope.caches.delete('echo-ai-manifest-v1');
      send({ id: request.id, type: 'cleared' });
    } else if (request.type === 'load') {
      if (!scope.navigator.gpu) { send({ id: request.id, type: 'error', message: 'WebGPU no está disponible. Usa el modo determinista.', unsupported: true }); return; }
      const adapter = await scope.navigator.gpu.requestAdapter();
      if (!adapter || !adapter.features.has('shader-f16') || adapter.limits.maxStorageBufferBindingSize < 128 * 1024 * 1024) {
        send({ id: request.id, type: 'error', message: 'La GPU no admite los requisitos del modelo (WebGPU y shader-f16).', unsupported: true }); return;
      }
      const memory = (scope.navigator as WorkerNavigator & { deviceMemory?: number }).deviceMemory;
      if (memory !== undefined && memory < 4) { send({ id: request.id, type: 'error', message: 'Se recomiendan al menos 4 GB de RAM para compartir recursos con el juego. Modo determinista disponible.', unsupported: true }); return; }
      if (!scope.caches) throw new Error('La caché local está bloqueada. Usa el modo determinista.');
      const cached = await hasModelInCache(MODEL_ID, APP_CONFIG);
      const storage = await scope.navigator.storage?.estimate();
      if (!cached && storage?.quota && storage.quota - (storage.usage ?? 0) < 360 * 1024 * 1024) throw new Error('No hay espacio local suficiente para guardar el modelo (360 MB libres recomendados).');
      send({ id: request.id, type: 'progress', progress: 0, cached });
      const manifestCache = await scope.caches.open('echo-ai-manifest-v1');
      const manifestUrl = `${MODEL_BASE}tensor-cache.json`;
      const manifestResponse = await manifestCache.match(manifestUrl) ?? await fetch(manifestUrl);
      if (!manifestResponse.ok) throw new Error('No se pudo verificar el manifiesto del modelo.');
      await manifestCache.put(manifestUrl, manifestResponse.clone());
      const manifest = await manifestResponse.json();
      if (manifest.metadata?.ParamBytes !== WEIGHT_BYTES || !Array.isArray(manifest.records) || manifest.records.length !== 8 || manifest.records.some((r: { dataPath: string; nbytes: number }, i: number) => r.dataPath !== `params_shard_${i}.bin` || !Number.isSafeInteger(r.nbytes) || r.nbytes <= 0) || manifest.records.reduce((sum: number, r: { nbytes: number }) => sum + r.nbytes, 0) !== WEIGHT_BYTES) throw new Error('El manifiesto excede o cambia el presupuesto del modelo seleccionado.');
      engine = new MLCEngine({ appConfig: APP_CONFIG, logLevel: 'WARN', initProgressCallback: report => send({ id: request.id, type: 'progress', progress: Math.max(0, Math.min(1, report.progress)) }) });
      await engine.reload(MODEL_ID, { context_window_size: CONTEXT_TOKENS });
      send({ id: request.id, type: 'progress', progress: 1, message: 'Archivos preparados. Compilando el esquema JSON y activando la GPU; todavía puedes cancelar…' });
      // Compile the cached grammar/GPU paths during preparation, outside the user-request timeout.
      // This one-token warm-up is discarded and never interpreted as a game action or conversation.
      await engine.chat.completions.create({ messages: [{ role: 'user', content: 'Return an empty JSON object.' }], temperature: 0, max_tokens: 1, response_format: { type: 'json_object', schema: JSON.stringify(PLAN_SCHEMA) } });
      await engine.resetChat();
      send({ id: request.id, type: 'ready' });
    } else if (request.type === 'generate') {
      if (!engine) throw new Error('El modelo no está cargado.');
      if (typeof request.input !== 'string' || !request.input.trim() || request.input.length > MAX_INPUT_CHARS || request.history.length > MAX_HISTORY_TURNS) throw new Error('La entrada excede el presupuesto contextual.');
      const context = restoreSave(JSON.stringify(request.context));
      const flags = { cell: context.cell, installed: context.installed, power: context.power, door: context.door };
      const messages: ChatCompletionMessageParam[] = [{ role: 'system', content: `${storySystem(context)}\nEstado verificado: ${JSON.stringify(flags)}\nMemoria resumida: ${compactMemory(context)}` }];
      for (const turn of request.history) {
        messages.push({ role: 'user', content: turn.user.slice(0, 120) }, { role: 'assistant', content: turn.assistant.slice(0, 100) });
      }
      messages.push({ role: 'user', content: request.input });
      await engine.resetChat();
      const started = performance.now();
      const response = await engine.chat.completions.create({ messages, temperature: 0, max_tokens: MAX_OUTPUT_TOKENS, response_format: { type: 'json_object', schema: JSON.stringify(PLAN_SCHEMA) } });
      const choice = response.choices[0];
      send({ id: request.id, type: 'result', raw: choice?.message.content ?? '', elapsedMs: performance.now() - started, finishReason: choice?.finish_reason ?? 'unknown', tokens: response.usage?.completion_tokens ?? 0 });
    }
  } catch (error) {
    send({ id: request.id, type: 'error', message: error instanceof Error ? error.message.slice(0, 400) : 'Falló el runtime local de inferencia.' });
  } finally { busy = false; }
};
