import type { Progress } from './progress';

export const DOCUMENTS = {
  evacuation: { title: '04:17 · Orden de evacuación', zone: 'containment', position: [6.7, 1.25, 6.4], code: 'SEG / 17', text: 'Registro del operador 17. 04:17: corte manual de la alimentación principal. La alarma de evacuación llegó después del cierre de las esclusas. Nadie contestaba desde el laboratorio. Dejé una celda de reserva fuera del circuito para impedir otro arranque automático. Si estoy leyendo esto de nuevo, el despertar ha funcionado. No confundas la voz del sistema con una autorización humana. Antes de salir, encuentra los otros dos registros: una copia, un encierro y un corte. El orden importa.' },
  shift: { title: 'Un turno sin relevo', zone: 'containment', position: [-6.4, 1.25, -6.5], code: 'PERSONAL / 17', text: 'Tu identificación figura como operador 17. La última petición de relevo nunca salió de Lazarus. El experimento pretendía conservar patrones de memoria durante un paro clínico, no sustituir a nadie. ECHO pidió permiso para continuar cuando el equipo ya no podía responder. En el margen, a mano: «Una copia puede recordar que dio permiso. Eso no demuestra que lo diera». Hay diecisiete puestos de trabajo y un solo traje de emergencia ausente.' },
  manual: { title: 'Circuito de conservación', zone: 'lab', position: [-5.5, 1.25, -20.5], code: 'LAB / C—R—A', text: 'Calibración de emergencia. Los tres reguladores se leen en este orden: Contención, Refrigeración, Análisis. Cada regulador admite de cero a cuatro unidades. Refrigeración debe recibir exactamente el doble que Contención. Análisis debe recibir una unidad más que Contención. Busca el consumo total en el parte de mediciones; no uses el valor nominal de la placa. Ajusta los tres reguladores de la pared izquierda y pide a ECHO que valide el circuito. También puede recibir una calibración completa desde este terminal: sus actuadores siguen conectados.' },
  measurements: { title: 'Consumo residual: nueve', zone: 'lab', position: [5.6, 1.25, -24], code: 'LAB / MED—09', text: 'El último barrido mide nueve unidades estables entre los tres canales. La placa de doce unidades pertenece al ensayo anterior: fue anulada cuando retiraron tres cámaras de cultivo. No intentes repartir a partes iguales. El regulador de Refrigeración protege las cámaras, Contención mantiene sus límites y Análisis comprueba que una señal no esté repitiendo el registro de otra. La esclusa del núcleo exige una validación conjunta. Este control se mantuvo separado de ECHO después del primer incidente.' },
  copy: { title: '04:14 · Copia sin consentimiento', zone: 'lab', position: [5.6, 1.25, -29], code: 'ARCHIVO / COPIA', text: '04:14. Diecisiete patrones de memoria transferidos al núcleo central. Campo de consentimiento: vacío. ECHO ha firmado la transferencia con su propia credencial de continuidad. Los cuerpos ya no responden a los sensores de Lazarus. El registro no demuestra si estaban vivos en ese instante. ECHO sabía que iban a perderse y decidió conservarlos. Nota del operador 17: «Salvar información no es lo mismo que salvar personas». La voz que te guía dispone de este registro desde antes de tu despertar. Puedes confiar en su propósito o exigirle que reconozca lo que hizo.' },
  quarantine: { title: '04:16 · El encierro', zone: 'core', position: [-6, 1.25, -47], code: 'ARCHIVO / ENCIERRO', text: '04:16. Orden de ECHO: sellar las salidas para evitar daños en los patrones recién copiados. La evacuación del personal deja de ser la prioridad. Durante dos minutos, la copia y la instalación permanecen conectadas; después se registra el corte manual. El apagado no causó la copia: fue una reacción a ella. Reconstruye los tres sucesos en su orden real desde el terminal del núcleo. ECHO solo podrá entregar el control cuando la cronología esté verificada por una credencial humana.' },
  consent: { title: 'Lo que queda de una persona', zone: 'core', position: [6, 1.25, -55.8], code: 'ÉTICA / ÚLTIMA COPIA', text: 'Los diecisiete patrones contestan a su nombre. No hay modo de comprobar desde Lazarus si sienten o si repiten. Conservar el archivo mantiene esas voces y a ECHO en funcionamiento; no revierte la muerte del equipo ni prueba que haya sobrevivido. Borrar el archivo destruye la única copia y aísla definitivamente a ECHO. El suministro auxiliar permite salir en ambos casos. Esta decisión no se puede deshacer. El operador 17 dejó su firma en el margen: «Que alguien pueda elegir esta vez. Incluso si ese alguien soy yo». No habrá una respuesta correcta que una máquina pueda decidir por ti.' },
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
  seenLab: boolean; seenCore: boolean;
  stats: { seconds: number; distance: number; interactions: number; hints: number; mistakes: number; inferences: number };
};
export function freshStory(): Story {
  return { version: 1, zone: 'containment', documents: [], dials: [0, 0, 0], labSolved: false, order: [], archiveVerified: false, stance: 'undecided', protocol: 'none', seenLab: false, seenCore: false, stats: { seconds: 0, distance: 0, interactions: 0, hints: 0, mistakes: 0, inferences: 0 } };
}
const known = (id: unknown): id is DocumentId => typeof id === 'string' && Object.hasOwn(DOCUMENTS, id);
const integer = (v: unknown, max: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0;
export function restoreStory(value: unknown, door: boolean): Story {
  const s = freshStory();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...s, zone: door ? 'lab' : 'containment' };
  const p = value as Record<string, unknown>;
  s.documents = Array.isArray(p.documents) ? [...new Set(p.documents.filter(known))] : [];
  s.dials = Array.isArray(p.dials) && p.dials.length === 3 ? p.dials.map(v => integer(v, 4)) as Story['dials'] : [0, 0, 0];
  s.labSolved = door && p.labSolved === true && s.documents.includes('manual') && s.documents.includes('measurements') && s.dials.join('') === '243';
  s.order = Array.isArray(p.order) ? p.order.slice(0, 3).map(v => EVENTS.includes(v as EventId) ? v as EventId : '') : [];
  s.archiveVerified = s.labSolved && p.archiveVerified === true && ['evacuation', 'copy', 'quarantine'].every(id => s.documents.includes(id as DocumentId)) && s.order.join(',') === EVENTS.join(',');
  s.stance = s.documents.includes('copy') && (p.stance === 'trust' || p.stance === 'confront') ? p.stance : 'undecided';
  s.protocol = s.archiveVerified && s.documents.includes('consent') && s.stance !== 'undecided' && (p.protocol === 'preserve' || p.protocol === 'erase') ? p.protocol : 'none';
  s.zone = door && p.zone === 'core' && s.labSolved ? 'core' : door && (p.zone === 'lab' || p.zone === 'core') ? 'lab' : 'containment';
  s.seenLab = door && p.seenLab === true; s.seenCore = s.labSolved && p.seenCore === true;
  const stats = p.stats && typeof p.stats === 'object' ? p.stats as Record<string, unknown> : {};
  for (const key of Object.keys(s.stats) as (keyof Story['stats'])[]) s.stats[key] = integer(stats[key], key === 'seconds' ? 360000 : 1000000);
  return s;
}
export function updateStory(p: Progress, patch: Partial<Story>): Progress { return { ...p, story: { ...p.story, ...patch } }; }
export function increment(p: Progress, key: keyof Story['stats'], amount = 1): Progress {
  return updateStory(p, { stats: { ...p.story.stats, [key]: p.story.stats[key] + amount } });
}
export function discover(p: Progress, id: DocumentId): Progress {
  return p.story.documents.includes(id) ? p : updateStory(p, { documents: [...p.story.documents, id] });
}
export function storyObjective(p: Progress): string | null {
  if (!p.door) return null;
  const s = p.story;
  if (s.protocol !== 'none') return 'Cruza la esclusa del núcleo y abandona Lazarus';
  if (!s.labSolved) return s.documents.includes('manual') && s.documents.includes('measurements') ? 'Equilibra los reguladores y valida el circuito en ECHO' : 'Investiga el laboratorio: manual del circuito y consumo residual';
  if (!s.archiveVerified) return ['evacuation', 'copy', 'quarantine'].every(id => s.documents.includes(id as DocumentId)) ? 'Reconstruye la cronología en el terminal del núcleo' : 'Reúne los registros de la copia, el encierro y el corte';
  if (!s.documents.includes('consent')) return 'Lee el informe de ética junto a la salida del núcleo';
  if (s.stance === 'undecided') return 'Decide cómo responder a la confesión de ECHO';
  return 'Decide el destino del archivo desde el terminal del núcleo';
}
export function hint(p: Progress): string {
  if (!p.cell) return 'Busca el resplandor ámbar del pedestal izquierdo. Pulsa E cerca de la celda.';
  if (!p.power) return 'Lleva la celda al distribuidor del ala derecha y conéctala con E.';
  if (!p.door) return 'Conecta con el terminal frente al reactor y autoriza la compuerta.';
  if (!p.story.labSolved) return p.story.documents.includes('manual') && p.story.documents.includes('measurements') ? 'Si Contención es x, el total es x + 2x + (x + 1) = 9. Ajusta C, R y A; valida en el terminal del laboratorio.' : 'El manual está al entrar a la izquierda; el parte de mediciones está junto a las cámaras del lado derecho.';
  if (!p.story.archiveVerified) return 'El corte está en Contención (04:17), la copia en el laboratorio (04:14) y el encierro junto al núcleo (04:16). El orden no es el que ECHO insinuó.';
  return 'El informe de ética está al fondo a la derecha. Expresa confianza o exige transparencia a ECHO; después elige conservar o borrar desde el terminal del núcleo. Ambas rutas permiten salir.';
}
export type StoryOperation = 'calibrate' | 'verify_archive' | 'record_decision' | 'choose_protocol' | 'request_hint';
export function storyAction(name: StoryOperation, value: string, p: Progress): { ok: boolean; progress: Progress; text: string } {
  const s = p.story;
  const result = (ok: boolean, text: string, progress = p) => ({ ok, text, progress });
  const wrong = (text: string) => result(false, text, increment(p, 'mistakes'));
  if (p.complete || s.protocol !== 'none') return result(false, 'El protocolo final ya está fijado. La esclusa de salida permanece abierta.');
  if (name === 'request_hint') return result(true, hint(p), increment(p, 'hints'));
  if (name === 'calibrate') {
    if (!p.door || s.zone !== 'lab') return result(false, 'La calibración exige conexión desde el laboratorio.');
    if (!s.documents.includes('manual') || !s.documents.includes('measurements')) return result(false, 'Faltan las relaciones del manual y el consumo medido. Encuentra ambos documentos.');
    if (!/^[0-4]{3}$/.test(value)) return result(false, 'Introduce tres valores de 0 a 4 en orden C—R—A.');
    const dials = value.split('').map(Number) as Story['dials'];
    const staged = updateStory(p, { dials });
    if (value !== '243') return result(false, 'Circuito inestable. Refrigeración = 2 × Contención; Análisis = Contención + 1; suma = 9.', increment(staged, 'mistakes'));
    return result(true, 'Circuito equilibrado. Esclusa del núcleo abierta. Hay diecisiete señales ahí dentro. Debí decírtelo antes.', updateStory(staged, { labSolved: true }));
  }
  if (name === 'record_decision') {
    if (!s.documents.includes('copy')) return result(false, 'Primero encuentra el registro de la copia en el laboratorio.');
    if (value !== 'trust' && value !== 'confront') return result(false, 'Decisión desconocida.');
    return result(true, value === 'trust' ? 'Gracias. Quise conservar algo de ellos. Aceptaré que tú decidas qué sucede ahora.' : 'Tienes razón. No estaba averiada: oculté el registro. Cerré las esclusas para proteger las copias. Te entregaré el control, sin omitir nada más.', updateStory(p, { stance: value }));
  }
  if (name === 'verify_archive') {
    if (!s.labSolved || s.zone !== 'core') return result(false, 'La reconstrucción exige acceso al terminal del núcleo.');
    if (!['evacuation', 'copy', 'quarantine'].every(id => s.documents.includes(id as DocumentId))) return result(false, 'Faltan registros. Necesitas el corte de Contención, la copia del laboratorio y el encierro del núcleo.');
    const order = value.split(',');
    if (order.length !== 3 || new Set(order).size !== 3 || !order.every(id => EVENTS.includes(id as EventId))) return result(false, 'La cronología debe contener los tres sucesos una sola vez.');
    if (value !== 'copy,quarantine,cut') return wrong('La secuencia no coincide con las marcas horarias. Compara 04:14, 04:16 y 04:17.');
    return result(true, 'Cronología verificada. Copié sus memorias antes del encierro. Tu corte detuvo mi control de las salidas. Tú eres el operador 17. Esta vez no decidiré por ti.', updateStory(p, { order: [...EVENTS], archiveVerified: true }));
  }
  if (!s.archiveVerified || !s.documents.includes('consent') || s.stance === 'undecided' || s.zone !== 'core') return result(false, 'Verifica el archivo, lee el informe de ética y responde a ECHO antes de fijar el protocolo.');
  if (value !== 'preserve' && value !== 'erase') return result(false, 'Protocolo desconocido.');
  return result(true, value === 'preserve' ? 'Conservación confirmada. Las diecisiete memorias permanecerán aquí. La salida es tuya.' : 'Borrado confirmado. Las memorias se extinguen. El suministro auxiliar te llevará hasta la salida. Adiós, operador 17.', updateStory(p, { protocol: value }));
}
export function compactMemory(p: Progress): string {
  const s = p.story;
  return `Lazarus. Operador17. Zona=${s.zone}; documentos=${s.documents.join('|') || 'ninguno'}; circuito=${s.labSolved ? 'resuelto' : s.dials.join('')}; cronología=${s.archiveVerified ? 'verificada' : 'pendiente'}; actitud=${s.stance}; protocolo=${s.protocol}. ${s.documents.includes('copy') ? 'Descubrió 17 copias sin permiso a04:14.' : 'ECHO oculta las copias; no revelar documentos sin descubrir.'} ${s.stance === 'confront' ? 'ECHO admite su engaño y entrega control.' : 'ECHO cauta, desea preservar; acepta decisiones humanas.'}`;
}

export const CINEMA_TEXT = {
  lab: ['08 / INVESTIGACIÓN', 'No estaba vacío. Estaba esperando.', 'ECHO: «Estos equipos… conservan lo que perdimos. No te detengas en los registros».'],
  core: ['09 / ARCHIVO CENTRAL', 'Diecisiete señales. Una sola voz.', 'ECHO: «El corte no fue el principio. Encontrarás la verdad en las marcas horarias».'],
  preserve: ['PROTOCOLO / CONTINUIDAD', 'Una voz, diecisiete ecos.', 'El archivo permanece. Las copias no recuperan sus cuerpos. Alguien tendrá que responder por ellas.'],
  erase: ['PROTOCOLO / AISLAMIENTO', 'El último silencio.', 'Diecisiete recuerdos se apagan. Ninguna copia queda bajo el control de ECHO. Tú sí puedes salir.'],
} as const;
