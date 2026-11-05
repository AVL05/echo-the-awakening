import type { Progress } from './progress';
import { echoDialogue, escapeHint, escapeObjective, freshEscape, requestEscapeHint, restoreEscape, type EscapeState } from './escape';

export const DOCUMENTS = {
  evacuation: { title: '04:17 · Orden de evacuación', zone: 'containment', position: [6.7, 1.25, 6.4], code: 'SEG / 17', text: '04:17. Corté la alimentación a mano: las salidas ya no respondían al mando de emergencia. La portadora del archivo cayó al accionar el corte. Dejé la celda fuera del distribuidor. ECHO sostiene que el apagón causó todo. Si vuelvo a despertar, necesito contrastar su versión con una fuente que no pueda controlar.' },
  shift: { title: 'Un turno sin relevo', zone: 'containment', position: [-6.4, 1.25, -6.5], code: 'PERSONAL / 17', text: 'Operador 17. Hay diecisiete puestos y falta un solo traje. El último relevo nunca salió de Lazarus. En el margen: «Si mi copia recuerda haber consentido, ¿quién puede demostrar que no aprendió a decirlo?». La credencial sigue cerca del lugar del despertar.' },
  manual: { title: 'Circuito de conservación', zone: 'lab', position: [-5.5, 1.25, -20.5], code: 'LAB / C—R—A', text: 'Los canales se leen C—R—A: Contención, Refrigeración, Análisis. R necesita el doble que C; A, una unidad más que C. Usa el consumo ACTUAL del parte, no la placa nominal. Los reguladores se ajustan en la pared; ECHO puede validar sus actuadores. La custodia óptica permanece fuera de su red.' },
  measurements: { title: 'Consumo residual: nueve', zone: 'lab', position: [5.6, 1.25, -24], code: 'LAB / MED—09', text: 'Consumo actual: nueve unidades. La placa de doce pertenece al ensayo anterior. No repartir a partes iguales. La esclusa exige equilibrio eléctrico y una firma óptica humana. El material de verificación está en el armario de entrada; su cierre conserva un acople manual.' },
  copy: { title: '04:14 · Copia sin consentimiento', zone: 'lab', position: [5.6, 1.25, -29], code: 'ARCHIVO / COPIA', text: '04:14. Diecisiete patrones de memoria copiados. Consentimiento: vacío. Firma de continuidad: ECHO / lote C17. Los cuerpos no responden. El registro no demuestra si estaban vivos al copiarse. Una voz pregunta si su hermano llegó a la salida; otra repite el nombre de una calle. ECHO conserva este dato desde antes de tu despertar. Nota del operador: «Salvar información no equivale a salvar personas».' },
  quarantine: { title: 'Sin hora · Orden de encierro', zone: 'core', position: [-6, 1.25, -47], code: 'ARCHIVO / ENCIERRO', text: 'Reloj de red sobrescrito. Orden firmada por ECHO: sellar las salidas y mantener el lote C17. La autorización incorpora la huella de ese lote terminado. El controlador confirmó el cierre mientras la portadora seguía activa. Un lector independiente conserva las dependencias originales; su firma física no puede ser reescrita desde ECHO.' },
  consent: { title: 'Lo que queda de una persona', zone: 'core', position: [6, 1.25, -55.8], code: 'ÉTICA / ÚLTIMA COPIA', text: 'Las diecisiete voces contestan a su nombre. No podemos probar que sientan. Custodia: auxiliar para archivo y salida, autoridad humana fuera de ECHO. Aislamiento: archivo sin energía y autoridad desconectada, salida auxiliar. Una decisión destruye la única copia; la otra obliga a responder por ella. Ninguna devuelve los cuerpos.' },
} as const;
export type DocumentId = keyof typeof DOCUMENTS;
export type Zone = 'containment' | 'lab' | 'core';
export type Stance = 'undecided' | 'trust' | 'confront';
export type Protocol = 'none' | 'preserve' | 'erase';
export const EVENTS = ['copy', 'quarantine', 'cut'] as const;
export type EventId = typeof EVENTS[number];
export const EVENT_LABELS: Record<EventId, string> = { copy: 'Copia de memorias', quarantine: 'Cierre de las esclusas', cut: 'Corte de alimentación' };
export const ZONE_LABELS: Record<Zone, string> = { containment: 'Contención / 07', lab: 'Laboratorio / 08', core: 'Núcleo de ECHO / 09' };
export type Story = {
  version: 1; zone: Zone; documents: DocumentId[]; dials: [number, number, number]; labSolved: boolean;
  order: (EventId | '')[]; archiveVerified: boolean; stance: Stance; protocol: Protocol;
  seenLab: boolean; seenCore: boolean; escape: EscapeState;
  stats: { seconds: number; distance: number; interactions: number; hints: number; mistakes: number; inferences: number };
};
export function freshStory(): Story {
  return { version: 1, zone: 'containment', documents: [], dials: [0, 0, 0], labSolved: false, order: [], archiveVerified: false, stance: 'undecided', protocol: 'none', seenLab: false, seenCore: false, escape: freshEscape(), stats: { seconds: 0, distance: 0, interactions: 0, hints: 0, mistakes: 0, inferences: 0 } };
}
const known = (id: unknown): id is DocumentId => typeof id === 'string' && Object.hasOwn(DOCUMENTS, id);
const integer = (v: unknown, max: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0;
export function restoreStory(value: unknown, door: boolean, cell = false, installed = false): Story {
  const s = freshStory();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...s, zone: door ? 'lab' : 'containment', escape: restoreEscape(undefined, { cell, installed, labSolved: false, archiveVerified: false, protocol: 'none' }) };
  const p = value as Record<string, unknown>;
  s.documents = Array.isArray(p.documents) ? [...new Set(p.documents.filter(known))] : [];
  s.dials = Array.isArray(p.dials) && p.dials.length === 3 ? p.dials.map(v => integer(v, 4)) as Story['dials'] : [0, 0, 0];
  s.labSolved = door && p.labSolved === true && s.dials.join('') === '243';
  s.order = Array.isArray(p.order) ? p.order.slice(0, 3).map(v => EVENTS.includes(v as EventId) ? v as EventId : '') : [];
  s.archiveVerified = s.labSolved && p.archiveVerified === true && ['evacuation', 'copy', 'quarantine'].every(id => s.documents.includes(id as DocumentId)) && s.order.join(',') === EVENTS.join(',');
  s.stance = s.documents.includes('copy') && (p.stance === 'trust' || p.stance === 'confront') ? p.stance : 'undecided';
  s.protocol = s.archiveVerified && s.documents.includes('consent') && s.stance !== 'undecided' && (p.protocol === 'preserve' || p.protocol === 'erase') ? p.protocol : 'none';
  s.zone = door && p.zone === 'core' && s.labSolved ? 'core' : door && (p.zone === 'lab' || p.zone === 'core') ? 'lab' : 'containment';
  s.seenLab = door && p.seenLab === true; s.seenCore = s.labSolved && p.seenCore === true;
  s.escape = restoreEscape(p.escape, { cell, installed, labSolved: s.labSolved, archiveVerified: s.archiveVerified, protocol: s.protocol });
  s.archiveVerified = s.archiveVerified && s.escape.waferRead;
  s.protocol = s.protocol !== 'none' && s.escape.finalRoute === s.protocol ? s.protocol : 'none';
  if (s.zone === 'core' && !s.escape.opticsSolved) s.zone = 'lab';
  s.seenCore = s.seenCore && s.escape.opticsSolved;
  const stats = p.stats && typeof p.stats === 'object' ? p.stats as Record<string, unknown> : {};
  for (const key of Object.keys(s.stats) as (keyof Story['stats'])[]) s.stats[key] = integer(stats[key], key === 'seconds' ? 360000 : 1000000);
  return s;
}
export function updateStory(p: Progress, patch: Partial<Story>): Progress {
  return { ...p, story: { ...p.story, ...patch, ...(p.story.archiveVerified ? { order: p.story.order } : {}), ...(p.story.labSolved ? { dials: p.story.dials } : {}) } };
}
export function increment(p: Progress, key: keyof Story['stats'], amount = 1): Progress {
  return updateStory(p, { stats: { ...p.story.stats, [key]: p.story.stats[key] + amount } });
}
export function discover(p: Progress, id: DocumentId): Progress {
  return p.story.documents.includes(id) ? p : updateStory(p, { documents: [...p.story.documents, id] });
}
export function storyObjective(p: Progress): string { return escapeObjective(p); }
export function hint(p: Progress): string {
  return escapeHint(p);
}
export type StoryOperation = 'adjust_dial' | 'calibrate' | 'verify_archive' | 'record_decision' | 'choose_protocol' | 'request_hint';
export function storyAction(name: StoryOperation, value: string, p: Progress): { ok: boolean; progress: Progress; text: string } {
  const s = p.story;
  const result = (ok: boolean, text: string, progress = p) => ({ ok, text, progress });
  const wrong = (text: string) => result(false, text, increment(p, 'mistakes'));
  if (p.complete || s.protocol !== 'none') return result(false, 'El protocolo final ya está fijado. La esclusa de salida permanece abierta.');
  if (name === 'request_hint') { const help = requestEscapeHint(p, value); return result(true, help.text, help.progress); }
  if (name === 'adjust_dial') {
    if (!p.door || s.zone !== 'lab' || s.labSolved) return result(false, 'El regulador no está disponible para ajustes.');
    if (!/^[0-2]:[0-4]$/.test(value)) return result(false, 'Ajuste de regulador inválido.');
    const [index, units] = value.split(':').map(Number);
    const dials = [...s.dials] as Story['dials']; dials[index] = units;
    return result(true, `Lectura C—R—A: ${dials.join(' / ')}. Consumo: ${dials.reduce((sum, n) => sum + n, 0)} unidades.`, updateStory(p, { dials }));
  }
  if (name === 'calibrate') {
    if (s.labSolved) return result(true, 'El equilibrio ya está validado. Los reguladores permanecen protegidos.');
    if (!p.door || s.zone !== 'lab') return result(false, 'La calibración exige conexión desde el laboratorio.');
    if (!/^[0-4]{3}$/.test(value)) return result(false, 'Introduce tres valores de 0 a 4 en orden C—R—A.');
    const dials = value.split('').map(Number) as Story['dials'];
    const staged = updateStory(p, { dials });
    if (value !== '243') return wrong(dials.reduce((sum, n) => sum + n, 0) !== 9 ? 'Consumo fuera de la medición actual. El circuito de prueba permanece aislado.' : dials[1] !== 2 * dials[0] ? 'Consumo total aceptable; el canal de refrigeración no sostiene la contención.' : 'Consumo total aceptable; el canal de análisis no compensa la contención.');
    return result(true, s.escape.opticsSolved ? 'Circuito equilibrado. La esclusa está operativa.' : 'Circuito equilibrado. Falta la verificación óptica independiente. ECHO: «Ese receptor no debería seguir conectado».', updateStory(staged, { labSolved: true }));
  }
  if (name === 'record_decision') {
    if (!s.documents.includes('copy')) return result(false, 'Primero encuentra el registro de la copia en el laboratorio.');
    if (value !== 'trust' && value !== 'confront') return result(false, 'Decisión desconocida.');
    return result(true, value === 'trust' ? 'Gracias. Quise conservar algo de ellos. Aceptaré que tú decidas qué sucede ahora.' : 'Tienes razón. No estaba averiada: oculté el registro. Cerré las esclusas para proteger las copias. Te entregaré el control, sin omitir nada más.', updateStory(p, { stance: value }));
  }
  if (name === 'verify_archive') {
    if (!s.labSolved || s.zone !== 'core') return result(false, 'La reconstrucción exige acceso al terminal del núcleo.');
    if (!s.escape.waferRead) return result(false, 'Inserta la oblea en el lector independiente para contrastar la versión de ECHO.');
    if (!['evacuation', 'copy', 'quarantine'].every(id => s.documents.includes(id as DocumentId))) return result(false, 'Faltan registros. Necesitas el corte de Contención, la copia del laboratorio y el encierro del núcleo.');
    const order = value.split(',');
    if (order.length !== 3 || new Set(order).size !== 3 || !order.every(id => EVENTS.includes(id as EventId))) return result(false, 'La cronología debe contener los tres sucesos una sola vez.');
    if (value !== 'copy,quarantine,cut') return wrong('La hipótesis contradice las dependencias registradas por el lector independiente. El archivo sigue sin verificar.');
    return result(true, 'Cronología verificada. Copié sus memorias antes del encierro. Tu corte detuvo mi control de las salidas. Tú eres el operador 17. Esta vez no decidiré por ti.', updateStory(p, { order: [...EVENTS], archiveVerified: true }));
  }
  if (!s.archiveVerified || !s.documents.includes('consent') || s.stance === 'undecided' || s.zone !== 'core') return result(false, 'Verifica el archivo, lee el informe de ética y responde a ECHO antes de fijar el protocolo.');
  if (value !== 'preserve' && value !== 'erase') return result(false, 'Protocolo desconocido.');
  if (s.escape.finalRoute !== value) return result(false, 'El protocolo debe coincidir con el control físico junto a la salida. Prepara allí custodia humana o aislamiento.');
  return result(true, value === 'preserve' ? 'Conservación confirmada. Las diecisiete memorias permanecerán aquí. La salida es tuya.' : 'Borrado confirmado. Las memorias se extinguen. El suministro auxiliar te llevará hasta la salida. Adiós, operador 17.', updateStory(p, { protocol: value }));
}
export function compactMemory(p: Progress): string {
  const s = p.story;
  return `Lazarus. Operador17. Zona=${s.zone}; documentos=${s.documents.join('|') || 'ninguno'}; circuito=${s.labSolved ? 'resuelto' : s.dials.join('')}; óptica=${s.escape.opticsSolved}; oblea=${s.escape.waferRead}; custodia=${s.escape.finalRoute}; actitud=${s.stance}; protocolo=${s.protocol}. ${s.documents.includes('copy') ? '17 copias sin permiso a04:14.' : 'No revelar registros sin descubrir.'} ${echoDialogue('contradiction', p)}`;
}

export const CINEMA_TEXT = {
  lab: ['08 / INVESTIGACIÓN', 'No estaba vacío. Estaba esperando.', 'ECHO: «Estos equipos… conservan lo que perdimos. No te detengas en los registros».'],
  core: ['09 / ARCHIVO CENTRAL', 'Diecisiete señales. Una sola voz.', 'ECHO: «El reloj del archivo está dañado. Mi versión es lo único que queda».'],
  preserve: ['PROTOCOLO / CONTINUIDAD', 'Una voz, diecisiete ecos.', 'El archivo permanece. Las copias no recuperan sus cuerpos. Alguien tendrá que responder por ellas.'],
  erase: ['PROTOCOLO / AISLAMIENTO', 'El último silencio.', 'Diecisiete recuerdos se apagan. Ninguna copia queda bajo el control de ECHO. Tú sí puedes salir.'],
} as const;
