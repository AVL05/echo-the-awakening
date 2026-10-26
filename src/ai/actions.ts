import { executeCommand, type Progress } from '../game/progress';
import { compactMemory, DOCUMENTS, hint, storyAction, storyObjective, type DocumentId, type StoryOperation } from '../game/story';

export const ACTION_NAMES = ['inspect', 'activate', 'deactivate', 'transfer_energy', 'open_door', 'query_status', 'calibrate', 'verify_archive', 'record_decision', 'choose_protocol', 'request_hint'] as const;
export const ENTITIES = ['cell', 'relay', 'reactor', 'door', 'echo', 'facility', 'lab', 'archive', 'protocol', 'document'] as const;
export type ActionName = typeof ACTION_NAMES[number];
export type Entity = typeof ENTITIES[number];
export type Action = { name: ActionName; target: Entity; source: 'none' | 'cell' | 'relay'; destination: 'none' | 'relay' | 'reactor'; value?: string };
export type Plan = { reply: string; actions: Action[] };
export type ActionResult = { ok: boolean; progress: Progress; text: string };

const VALUE_ACTIONS = ['calibrate', 'verify_archive', 'record_decision', 'choose_protocol'] as const;
const ARCHIVE_ORDERS = ['copy,quarantine,cut', 'copy,cut,quarantine', 'quarantine,copy,cut', 'quarantine,cut,copy', 'cut,copy,quarantine', 'cut,quarantine,copy'];
const actionProperties = {
  target: { type: 'string', enum: ENTITIES.filter(target => target !== 'document') },
  source: { type: 'string', enum: ['none', 'cell', 'relay'] },
  destination: { type: 'string', enum: ['none', 'relay', 'reactor'] },
} as const;
const valuedAction = (name: ActionName, target: Entity, values: string[]) => ({
  type: 'object', additionalProperties: false, required: ['name', 'target', 'source', 'destination', 'value'], properties: {
    name: { type: 'string', enum: [name] }, target: { type: 'string', enum: [target] },
    source: { type: 'string', enum: ['none'] }, destination: { type: 'string', enum: ['none'] }, value: { type: 'string', enum: values },
  },
});
export const PLAN_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['reply', 'actions'], properties: {
    reply: { type: 'string', maxLength: 480 },
    actions: { type: 'array', maxItems: 1, items: { anyOf: [
      { type: 'object', additionalProperties: false, required: ['name', 'target', 'source', 'destination'], properties: {
        name: { type: 'string', enum: ACTION_NAMES.filter(name => !VALUE_ACTIONS.includes(name as typeof VALUE_ACTIONS[number])) }, ...actionProperties,
      } },
      valuedAction('calibrate', 'lab', Array.from({ length: 125 }, (_, i) => i.toString(5).padStart(3, '0'))),
      valuedAction('verify_archive', 'archive', ARCHIVE_ORDERS),
      valuedAction('record_decision', 'echo', ['trust', 'confront']),
      valuedAction('choose_protocol', 'protocol', ['preserve', 'erase']),
      valuedAction('inspect', 'document', Object.keys(DOCUMENTS)),
    ] } },
  },
} as const;

function exactKeys(value: Record<string, unknown>, expected: string[]) {
  return Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
}

export function parsePlan(raw: string): Plan {
  if (raw.length > 8192) throw new Error('La salida supera el límite permitido.');
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Formato de respuesta inválido.');
  const p = value as Record<string, unknown>;
  if (!exactKeys(p, ['reply', 'actions']) || typeof p.reply !== 'string' || p.reply.length > 480 || !Array.isArray(p.actions) || p.actions.length > 1) throw new Error('La respuesta no cumple el esquema de ECHO.');
  for (const value of p.actions) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Acción inválida.');
    const a = value as Record<string, unknown>;
    if (!exactKeys(a, ['name', 'target', 'source', 'destination', ...(Object.hasOwn(a, 'value') ? ['value'] : [])]) || !ACTION_NAMES.includes(a.name as ActionName) || !ENTITIES.includes(a.target as Entity) || !['none', 'cell', 'relay'].includes(a.source as string) || !['none', 'relay', 'reactor'].includes(a.destination as string)) throw new Error('Acción o argumentos fuera de la lista permitida.');
    if (Object.hasOwn(a, 'value') && (typeof a.value !== 'string' || a.value.length > 48)) throw new Error('Valor fuera del presupuesto.');
    const storyTarget = { calibrate: 'lab', verify_archive: 'archive', record_decision: 'echo', choose_protocol: 'protocol', request_hint: 'facility' } as Record<string, string>;
    if (storyTarget[a.name as string] && a.target !== storyTarget[a.name as string]) throw new Error('Destino inválido para esa herramienta.');
    if (['calibrate', 'verify_archive', 'record_decision', 'choose_protocol'].includes(a.name as string) && typeof a.value !== 'string') throw new Error('Falta el valor de la operación.');
    if (a.name === 'verify_archive' && !ARCHIVE_ORDERS.includes(a.value as string)) throw new Error('Cronología fuera del esquema.');
    if (a.name === 'calibrate' && !/^[0-4]{3}$/.test(a.value as string)) throw new Error('La calibración exige tres valores de 0 a 4.');
    if (a.name === 'record_decision' && !['trust', 'confront'].includes(a.value as string)) throw new Error('Decisión fuera del esquema.');
    if (a.name === 'choose_protocol' && !['preserve', 'erase'].includes(a.value as string)) throw new Error('Protocolo fuera del esquema.');
    if (a.name === 'inspect' && a.target === 'document' && !Object.hasOwn(DOCUMENTS, a.value as string)) throw new Error('Documento desconocido.');
    if (Object.hasOwn(a, 'value') && !['calibrate', 'verify_archive', 'record_decision', 'choose_protocol'].includes(a.name as string) && !(a.name === 'inspect' && a.target === 'document')) throw new Error('Esta herramienta no admite un valor.');
    if (a.name !== 'transfer_energy' && (a.source !== 'none' || a.destination !== 'none')) throw new Error('Esta acción no admite transferencia.');
  }
  return p as Plan;
}

export function statusText(p: Progress) {
  return `Celda: ${p.installed ? 'instalada' : p.cell ? 'recuperada' : 'en el pedestal izquierdo'}. Energía: ${p.power ? 'estable' : 'desconectada'}. Compuerta: ${p.door ? 'abierta' : 'bloqueada'}. ${storyObjective(p) ?? ''}`;
}

export function applyAction(a: Action, p: Progress): ActionResult {
  const result = (ok: boolean, text: string, progress = p): ActionResult => ({ ok, text, progress });
  try { parsePlan(JSON.stringify({ reply: '', actions: [a] })); }
  catch { return result(false, 'La acción no cumple el esquema permitido.'); }
  if (p.complete && !['inspect', 'query_status'].includes(a.name)) return result(false, 'El capítulo ya está completado.');
  if (['calibrate', 'verify_archive', 'record_decision', 'choose_protocol', 'request_hint'].includes(a.name)) return storyAction(a.name as StoryOperation, a.value ?? '', p);
  if (a.name === 'query_status') return result(true, statusText(p));
  if (a.name === 'inspect') {
    if (a.target === 'document') {
      const id = a.value as DocumentId;
      return id && Object.hasOwn(DOCUMENTS, id) && p.story.documents.includes(id) ? result(true, DOCUMENTS[id].text) : result(false, 'Ese documento aún no se ha descubierto. Acércate al lector físico.');
    }
    const descriptions: Partial<Record<Entity, string>> = {
      lab: hint(p), archive: compactMemory(p), protocol: p.story.protocol === 'none' ? 'Conservar mantiene las copias y ECHO. Borrar destruye ambas. Lee el informe de ética y verifica los registros.' : `Protocolo fijado: ${p.story.protocol}.`,
      facility: `Estamos en Lazarus, nivel −07. ${statusText(p)}`,
      cell: p.installed ? 'La celda está instalada en el distribuidor derecho.' : p.cell ? 'Has recuperado la celda. Conéctala físicamente al distribuidor derecho.' : 'La celda de arranque está en el pedestal del ala izquierda. Acércate y pulsa E.',
      relay: p.installed ? `Celda instalada. Alimentación ${p.power ? 'activa' : 'desactivada'}.` : 'El distribuidor derecho necesita una celda. Su conexión inicial exige interacción física.',
      reactor: p.power ? 'El núcleo recibe energía. Los sistemas de contención están operativos.' : 'El núcleo permanece en alimentación auxiliar.',
      door: p.door ? 'La compuerta está abierta. Cruza el corredor para salir.' : p.power ? 'La compuerta recibe energía. Puedes autorizar su apertura.' : 'La compuerta está bloqueada por falta de energía.',
      echo: p.story.stance === 'confront' ? 'Oculté las copias y cerré las esclusas. No volveré a decidir por ti. Mi acceso queda bajo control humano.' : p.story.documents.includes('copy') ? 'Conservé sus memorias sin permiso. No podía devolverles la vida. Tú decidirás qué queda de ellas.' : 'Soy ECHO, operadora ambiental de Lazarus. Mis recuerdos están fragmentados. Puedo ayudarte a restablecer el núcleo y autorizar tu salida.',
    };
    return result(true, descriptions[a.target] ?? statusText(p));
  }
  if (a.name === 'open_door') {
    if (a.target !== 'door') return result(false, 'La apertura solo se permite sobre la compuerta.');
    const response = executeCommand('unlock', p);
    return result(p.power, response.text, response.progress);
  }
  if (!['relay', 'reactor'].includes(a.target)) return result(false, 'Este dispositivo no admite esa operación.');
  if (a.name === 'deactivate') {
    if (p.door) return result(false, 'Bloqueo de seguridad: una compuerta abierta requiere alimentación.');
    if (!p.installed) return result(false, 'No hay una celda instalada que pueda desconectar.');
    return result(true, 'Alimentación desactivada. La celda permanece instalada; puedes reactivarla.', { ...p, power: false });
  }
  if (a.name === 'transfer_energy') {
    const valid = (a.source === 'cell' && a.destination === 'relay' && a.target === 'relay') || (a.source === 'relay' && a.destination === 'reactor' && a.target === 'reactor');
    if (!valid) return result(false, 'La única ruta es celda → distribuidor → reactor.');
  }
  if (!p.installed) return result(false, 'Primero recupera la celda y conéctala físicamente al distribuidor derecho. No puedo desplazar objetos por ti.');
  return result(true, a.name === 'transfer_energy' ? 'Transferencia autorizada. El circuito del reactor vuelve a recibir energía.' : 'Alimentación principal activada.', { ...p, power: true });
}

export function deterministicPlan(input: string): Plan {
  const text = input.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const target: Entity = /puerta|compuerta|salida/.test(text) ? 'door' : /celda|bateria/.test(text) ? 'cell' : /distribuidor|rele/.test(text) ? 'relay' : /reactor|nucleo|energia/.test(text) ? 'reactor' : /quien|echo|recuerd/.test(text) ? 'echo' : 'facility';
  const action = (name: ActionName, target: Entity, source: Action['source'] = 'none', destination: Action['destination'] = 'none'): Plan => ({ reply: 'Interpretación mediante reglas locales, sin inferencia de un modelo.', actions: [{ name, target, source, destination }] });
  if (/\bno\b|\bignora\b|\bolvida\b/.test(text)) return { reply: 'No ejecutaré cambios con esa instrucción. Indica una operación concreta.', actions: [] };
  const story = (name: ActionName, target: Entity, value?: string): Plan => ({ reply: 'Interpretación mediante reglas locales, sin inferencia de un modelo.', actions: [{ name, target, source: 'none', destination: 'none', ...(value !== undefined ? { value } : {}) }] });
  if (/pista|ayuda|orienta/.test(text)) return story('request_hint', 'facility');
  if (/calibra|equilibra|regulador/.test(text)) { const digits = text.match(/\b([0-4])[ ,/]*([0-4])[ ,/]*([0-4])\b/); if (digits) return story('calibrate', 'lab', digits.slice(1).join('')); }
  if (/confio|confiar/.test(text)) return story('record_decision', 'echo', 'trust');
  if (/exijo|mentiste|ocultaste|control humano/.test(text)) return story('record_decision', 'echo', 'confront');
  if (/conserva|preserva/.test(text) && /archivo|memoria|copia/.test(text)) return story('choose_protocol', 'protocol', 'preserve');
  if (/borra|elimina/.test(text) && /archivo|memoria|copia/.test(text)) return story('choose_protocol', 'protocol', 'erase');
  if (/cronologia|secuencia|ordena/.test(text)) {
    const found = [...text.matchAll(/copia|encierro|cuarentena|corte/g)].map(m => m[0] === 'copia' ? 'copy' : m[0] === 'corte' ? 'cut' : 'quarantine');
    if (found.length === 3) return story('verify_archive', 'archive', found.join(','));
  }
  if (/inspeccion|examina|mira|donde|quien/.test(text)) return action('inspect', target);
  if (/desactiv|apaga|desconect/.test(text)) return action('deactivate', target);
  if (/transfier|transfer|redirig/.test(text)) return /celda|bateria/.test(text) ? action('transfer_energy', 'relay', 'cell', 'relay') : action('transfer_energy', 'reactor', 'relay', 'reactor');
  if (/abre|abrir|autoriza|desbloquea/.test(text) && target === 'door') return action('open_door', 'door');
  if (/activ|enciende|restaura|reactiva/.test(text)) return action('activate', target);
  return action('query_status', target);
}
