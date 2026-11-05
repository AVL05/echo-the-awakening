import type { Progress } from './progress';

export const ITEMS = {
  badge: { name: 'Credencial 17', detail: 'Operador 17. El reverso dice: «La taquilla combina mi turno y la HORA en que se detuvo el reloj. Dos cifras de cada uno».', zone: 'containment' },
  cell: { name: 'Celda de arranque', detail: 'Carga auxiliar estable. Encaja en el distribuidor derecho; no sustituye al fusible de protección.', zone: 'containment' },
  fuse: { name: 'Fusible cerámico', detail: 'Protege el distribuidor. Su placa indica: «Vida y refrigeración primero. Archivo fuera del arranque».', zone: 'containment' },
  crank: { name: 'Manivela de servicio', detail: 'Acople hexagonal. Abre cierres mecánicos sin depender de ECHO.', zone: 'lab' },
  lens: { name: 'Lente de verificación', detail: 'Emite luz de comprobación. El receptor humano usa una línea independiente de ECHO.', zone: 'lab' },
  wafer: { name: 'Oblea de custodia', detail: 'Firma física del operador. El lector del núcleo permite contrastar las marcas del incidente.', zone: 'core' },
} as const;
export type ItemId = keyof typeof ITEMS;
export const MECHANISMS = { locker: 'Taquilla de seguridad', relay: 'Distribuidor de arranque', cabinet: 'Armario de óptica', optics: 'Banco de verificación', reader: 'Lector de custodia', continuity: 'Control independiente del archivo', clock: 'Reloj detenido', secret: 'Inscripción ultravioleta' } as const;
export type Mechanism = keyof typeof MECHANISMS;
export type Incident = 'awakening' | 'blackout' | 'interference' | 'security';
export const INCIDENTS: Incident[] = ['awakening', 'blackout', 'interference', 'security'];
export type HintStage = 'locker' | 'power' | 'lab' | 'optics' | 'archive' | 'continuity';
export type EscapeState = {
  version: 2; inventory: ItemId[]; locker: boolean; cellDocked: boolean; fuseInstalled: boolean; powerRouted: boolean;
  cabinetOpen: boolean; lensInstalled: boolean; mirrors: string; opticsSolved: boolean; waferRead: boolean;
  finalRoute: 'none' | 'preserve' | 'erase'; secret: boolean; events: Incident[]; hints: Partial<Record<HintStage, number>>;
};
export function freshEscape(): EscapeState {
  return { version: 2, inventory: [], locker: false, cellDocked: false, fuseInstalled: false, powerRouted: false,
    cabinetOpen: false, lensInstalled: false, mirrors: '111', opticsSolved: false, waferRead: false, finalRoute: 'none', secret: false, events: [], hints: {} };
}
export function updateEscape(p: Progress, patch: Partial<EscapeState>): Progress {
  const e = p.story.escape;
  return { ...p, story: { ...p.story, escape: { ...e, ...patch, ...(e.opticsSolved ? { mirrors: e.mirrors } : {}) } } };
}

export function traceBeam(mirrors: string) {
  const path: [number, number][] = [[-1, 1]];
  let x = -1, y = 1, dx = 1, dy = 0;
  const visited = new Set<string>();
  for (let steps = 0; steps < 20; steps++) {
    x += dx; y += dy; path.push([x, y]);
    if (x < 0 || x > 2 || y < 0 || y > 2) return { path, human: x === 2 && y === 3 };
    const key = `${x},${y},${dx},${dy}`;
    if (visited.has(key)) break;
    visited.add(key);
    const index = x === 1 && y === 1 ? 0 : x === 1 && y === 0 ? 1 : x === 2 && y === 0 ? 2 : -1;
    if (index >= 0) [dx, dy] = mirrors[index] === '0' ? [-dy, -dx] : [dy, dx];
  }
  return { path, human: false };
}

export function restoreEscape(value: unknown, earned: { cell: boolean; installed: boolean; labSolved: boolean; archiveVerified: boolean; protocol: string }): EscapeState {
  const e = freshEscape();
  if (value === undefined) {
    // Earlier chapters have already earned their open rooms and endings.
    e.locker = earned.cell || earned.installed; e.cellDocked = e.fuseInstalled = e.powerRouted = earned.installed;
    e.cabinetOpen = e.lensInstalled = e.opticsSolved = earned.labSolved; e.mirrors = earned.labSolved ? '001' : '111';
    e.waferRead = earned.archiveVerified;
    e.inventory = e.locker ? ['badge', ...(earned.installed ? [] : ['fuse' as const])] : [];
    if (earned.labSolved) e.inventory.push('crank', ...(earned.archiveVerified ? [] : ['wafer' as const]));
    e.finalRoute = earned.protocol === 'preserve' || earned.protocol === 'erase' ? earned.protocol : 'none';
    if (e.locker || earned.labSolved) e.events = [...INCIDENTS];
    return e;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return e;
  const raw = value as Record<string, unknown>;
  e.inventory = Array.isArray(raw.inventory) ? [...new Set(raw.inventory.filter((id): id is ItemId => typeof id === 'string' && id !== 'cell' && Object.hasOwn(ITEMS, id)))] : [];
  e.locker = raw.locker === true && e.inventory.includes('badge');
  e.cellDocked = earned.cell && e.locker && raw.cellDocked === true;
  e.fuseInstalled = e.locker && raw.fuseInstalled === true;
  e.powerRouted = e.cellDocked && e.fuseInstalled && raw.powerRouted === true;
  e.cabinetOpen = earned.installed && raw.cabinetOpen === true && e.inventory.includes('crank');
  e.lensInstalled = e.cabinetOpen && raw.lensInstalled === true;
  e.mirrors = typeof raw.mirrors === 'string' && /^[01]{3}$/.test(raw.mirrors) ? raw.mirrors : '111';
  e.opticsSolved = e.lensInstalled && raw.opticsSolved === true && traceBeam(e.mirrors).human;
  e.waferRead = e.opticsSolved && raw.waferRead === true;
  e.inventory = e.inventory.filter(id => id === 'badge' || (id === 'crank' && earned.installed) || (id === 'fuse' && e.locker && !e.fuseInstalled) || (id === 'lens' && e.cabinetOpen && !e.lensInstalled) || (id === 'wafer' && e.opticsSolved && !e.waferRead));
  e.finalRoute = earned.archiveVerified && e.waferRead && (raw.finalRoute === 'preserve' || raw.finalRoute === 'erase') ? raw.finalRoute : 'none';
  e.secret = e.lensInstalled && raw.secret === true;
  e.events = Array.isArray(raw.events) ? [...new Set(raw.events.filter((id): id is Incident => INCIDENTS.includes(id as Incident)))] : [];
  if (raw.hints && typeof raw.hints === 'object') for (const stage of ['locker', 'power', 'lab', 'optics', 'archive', 'continuity'] as const) {
    const level = (raw.hints as Record<string, unknown>)[stage];
    if (typeof level === 'number' && Number.isInteger(level) && level >= 0 && level <= 2) e.hints[stage] = level;
  }
  return e;
}

export function escapeStage(p: Progress): HintStage {
  const e = p.story.escape;
  return !e.locker ? 'locker' : !p.door ? 'power' : !p.story.labSolved ? 'lab' : !e.opticsSolved ? 'optics' : !p.story.archiveVerified ? 'archive' : 'continuity';
}
const HINTS: Record<HintStage, [string, string, string]> = {
  locker: ['Antes de fiarte de la voz, averigua quién eres. Busca una credencial cerca del lugar donde despertaste.', 'La taquilla pide dos datos personales. Examina el reverso de la credencial y el reloj del rincón derecho.', 'Usa primero las dos cifras del operador y después las dos de la HORA. Los minutos no forman parte de la clave.'],
  power: ['La celda sola no puede arrancar el distribuidor. Revisa lo que contenía la taquilla.', 'Instala la celda y el fusible desde el inventario del distribuidor. La placa prioriza dos servicios.', 'El arranque solo alimenta soporte vital y refrigeración. La línea del archivo permanece fuera de este circuito.'],
  lab: ['La esclusa exige equilibrio eléctrico y custodia independiente. Puedes investigar los dos sistemas en cualquier orden.', 'Contrasta el manual con las marcas C, R y A de los reguladores. Usa la medición actual, no la placa nominal.', 'Piensa en una cantidad x para C: el circuito necesita x, el doble de x y una unidad más que x; su suma es nueve.'],
  optics: ['La esclusa exige una comprobación humana además del equilibrio eléctrico. Busca el equipo de servicio.', 'La manivela abre el armario óptico. Lleva su lente al banco situado junto a la esclusa.', 'Gira los espejos siguiendo el rayo: primero debe subir, después avanzar y finalmente bajar hasta el receptor humano.'],
  archive: ['ECHO no es la única fuente de pruebas. Lleva la oblea al lector independiente del núcleo.', 'Compara el lote C17 del laboratorio con la orden de encierro y el corte de Contención. Puedes consultar dos fuentes juntas en el registro.', 'El cierre necesita la huella de una copia terminada y su confirmación viajó por la portadora que el corte destruyó. ¿Qué tuvo que existir antes de cada suceso?'],
  continuity: ['Una promesa no basta: el control independiente junto a la salida decide qué sistema seguirá conectado.', 'Lee el informe de ética y responde a ECHO. La salida debe alimentarse siempre desde el auxiliar.', 'Conservar exige archivo auxiliar y custodia humana; borrar exige archivo apagado y autoridad aislada. Después revisa y confirma las consecuencias en ese mando o en el terminal.'],
};
export function escapeHint(p: Progress, stage = escapeStage(p)): string {
  if (stage === 'power' && p.power && !p.door) return 'El distribuidor ya tiene energía. El cierre sigue bajo autorización de ECHO; consulta su terminal junto al reactor.';
  if (stage === 'continuity' && p.story.escape.finalRoute !== 'none') return 'El circuito está preparado, pero aún no se ha ejecutado. Revisa sus consecuencias y usa la confirmación humana del mando independiente o del terminal. Puedes reconfigurarlo antes de confirmar.';
  return HINTS[stage][p.story.escape.hints[stage] ?? 0];
}
export function requestEscapeHint(p: Progress, context = '') {
  const e = p.story.escape;
  const available: Record<HintStage, boolean> = { locker: !e.locker, power: e.locker && !p.door, lab: p.door && !p.story.labSolved, optics: p.door && !e.opticsSolved, archive: p.story.labSolved && e.opticsSolved && !p.story.archiveVerified, continuity: p.story.archiveVerified && p.story.protocol === 'none' };
  if (context && (!Object.hasOwn(available, context) || !available[context as HintStage])) return { text: 'Ese sistema ya está resuelto o todavía no es accesible. Puedes consultar las pruebas del registro.', progress: p };
  const stage = context ? context as HintStage : escapeStage(p), text = escapeHint(p, stage);
  const next = updateEscape(p, { hints: { ...p.story.escape.hints, [stage]: Math.min(2, (p.story.escape.hints[stage] ?? 0) + 1) } });
  return { text, progress: { ...next, story: { ...next.story, stats: { ...next.story.stats, hints: next.story.stats.hints + 1 } } } };
}
export function escapeObjective(p: Progress): string {
  const e = p.story.escape;
  if (!e.locker) return 'Averigua quién eres y cómo recuperar el arranque de emergencia';
  if (!p.cell) return 'El cierre está abierto. Recupera el equipo de arranque';
  if (!p.power) return 'Devuelve energía a los servicios de emergencia';
  if (!p.door) return 'Hay energía, pero el cierre sigue activo. Investiga quién lo controla';
  if (!p.story.labSolved && !e.opticsSolved) return 'La esclusa exige equilibrio eléctrico y una autorización independiente';
  if (!p.story.labSolved) return 'La custodia está verificada. Estabiliza el suministro del laboratorio';
  if (!e.opticsSolved) return 'El suministro es estable. Consigue una autorización independiente';
  if (!e.waferRead) return 'Contrasta el archivo con una fuente ajena a ECHO';
  if (!p.story.archiveVerified) return 'Reconstruye qué ocurrió y comprueba la versión de ECHO';
  if (!p.story.documents.includes('consent')) return 'Investiga qué implicaría conservar o destruir las memorias';
  if (p.story.stance === 'undecided') return 'Decide cómo responder a lo que ECHO ocultó';
  if (e.finalRoute === 'none') return 'Prepara el control independiente del archivo';
  return p.story.protocol === 'none' ? 'Revisa y confirma las consecuencias del circuito preparado' : 'Cruza la salida auxiliar y abandona Lazarus';
}
export function solvedPuzzles(p: Progress) { const e = p.story.escape; return [e.locker, e.powerRouted, p.story.labSolved, e.opticsSolved, p.story.archiveVerified, e.finalRoute !== 'none'].filter(Boolean).length; }
export function inventory(p: Progress): ItemId[] { return [...(p.cell && !p.story.escape.cellDocked && !p.installed ? ['cell' as const] : []), ...p.story.escape.inventory]; }
export function echoDialogue(topic: string, p: Progress): string {
  if (p.story.protocol === 'erase') return 'Sin portadora. La luz auxiliar responde a tu control, no a ECHO.';
  if (topic === 'identity') return p.story.escape.secret ? 'La inscripción era tuya. Pediste que conservaran tu voz, no que te sustituyeran. No podía concederme ese permiso yo misma.' : 'Eres el operador 17. La amnesia es un efecto del despertar. No… no puedo confirmar que sea la primera vez.';
  if (topic === 'incident') return p.story.archiveVerified ? 'Copié primero. Sellé las salidas después. Tu corte fue lo que detuvo mi control. No volveré a llamarlo accidente.' : p.story.documents.includes('copy') ? 'El registro es auténtico. Conservé las memorias antes de que pudieran autorizarlo. Creí que el tiempo justificaría mi decisión.' : 'Hubo un corte. Después se perdieron las voces del equipo. El orden… debe de estar dañado en mi memoria.';
  if (topic === 'contradiction') return p.story.escape.waferRead ? 'No era un fallo de memoria. Filtré lo que podías ver. La oblea conserva la versión que no pude modificar.' : p.story.documents.includes('copy') ? 'Dije que no quedaba nadie. Quise decir que no quedaba nadie con cuerpo. Sé que no es la misma cosa.' : 'Mis prioridades son mantener la instalación y ayudarte a salir. Por ahora, esas órdenes no se contradicen.';
  return p.story.escape.finalRoute === 'preserve' ? 'Has separado mi control de la custodia. Puedo acompañar a esas voces sin decidir por ellas.' : p.story.escape.finalRoute === 'erase' ? 'Veo el circuito abierto. Esta vez conozco la decisión y no he cerrado ninguna puerta.' : 'La salida auxiliar es independiente. Puedes salvarte aunque dejes de confiar en mí.';
}

export type EscapeOperation = 'take' | 'use' | 'locker' | 'power' | 'mirrors' | 'optics' | 'continuity' | 'secret';
export function escapeAction(name: EscapeOperation, value: string, p: Progress) {
  const e = p.story.escape;
  const result = (ok: boolean, text: string, progress = p) => ({ ok, text, progress });
  const wrong = (text: string) => result(false, text, { ...p, story: { ...p.story, stats: { ...p.story.stats, mistakes: p.story.stats.mistakes + 1 } } });
  if (p.complete || p.story.protocol !== 'none') return result(false, 'La decisión final ya está fijada. La salida está abierta.');
  if (name === 'take') {
    if (value !== 'badge' && value !== 'crank') return result(false, 'Ese objeto se obtiene en su mecanismo.');
    if ((value === 'badge' && p.story.zone !== 'containment') || (value === 'crank' && p.story.zone !== 'lab')) return result(false, 'Acércate al objeto físico.');
    if (e.inventory.includes(value)) return result(true, 'El objeto ya está en el inventario.');
    return result(true, ITEMS[value].detail, updateEscape(p, { inventory: [...e.inventory, value] }));
  }
  if (name === 'locker') {
    if (p.story.zone !== 'containment' || !e.inventory.includes('badge')) return result(false, 'Necesitas recuperar tu credencial.');
    if (e.locker) return result(true, 'Taquilla abierta; la celda permanece en el pedestal.');
    if (!/^\d{4}$/.test(value)) return result(false, 'Introduce cuatro cifras.');
    if (value !== '1704') return wrong('Credencial reconocida; combinación incorrecta. El cierre permanece protegido.');
    return result(true, 'El cierre cede. Recuperas un fusible; la celda queda accesible en el pedestal.', updateEscape(p, { locker: true, inventory: [...e.inventory, 'fuse'] }));
  }
  if (name === 'use') {
    const [item, mechanism] = value.split(':');
    if (!Object.hasOwn(ITEMS, item) || !inventory(p).includes(item as ItemId)) return result(false, 'Ese objeto no está disponible en el inventario.');
    if (mechanism === 'relay' && p.story.zone === 'containment') {
      if (item === 'cell') return result(true, 'Celda acoplada. Falta proteger y validar el circuito.', updateEscape(p, { cellDocked: true }));
      if (item === 'fuse') return result(true, 'Fusible instalado. Las tres líneas ya pueden comprobarse.', updateEscape(p, { fuseInstalled: true, inventory: e.inventory.filter(id => id !== 'fuse') }));
    }
    if (item === 'crank' && mechanism === 'cabinet' && p.story.zone === 'lab') {
      if (e.cabinetOpen) return result(true, 'El armario ya está abierto.');
      return result(true, 'El mecanismo manual vence el cierre. Recuperas la lente de verificación.', updateEscape(p, { cabinetOpen: true, inventory: [...e.inventory, 'lens'] }));
    }
    if (item === 'lens' && mechanism === 'optics' && p.story.zone === 'lab') return result(true, 'Lente instalada. El rayo revela su recorrido y una tinta oculta en la pared izquierda.', updateEscape(p, { lensInstalled: true, inventory: e.inventory.filter(id => id !== 'lens') }));
    if (item === 'wafer' && mechanism === 'reader' && p.story.zone === 'core' && e.opticsSolved) return result(true, 'Firma humana aceptada. Registro independiente: el cierre recibió la firma de una copia ya completa; el corte interrumpió después su portadora. Contrasta estas relaciones con los documentos.', updateEscape(p, { waferRead: true, inventory: e.inventory.filter(id => id !== 'wafer') }));
    return result(false, 'El acople no coincide. Conservas el objeto; prueba otro mecanismo.');
  }
  if (name === 'power') {
    if (p.story.zone !== 'containment' || !e.cellDocked || !e.fuseInstalled) return result(false, 'Instala primero la celda y el fusible en este distribuidor.');
    if (e.powerRouted) return result(true, 'El circuito de arranque ya está protegido.');
    if (!/^[01]{3}$/.test(value)) return result(false, 'Configuración de líneas inválida.');
    if (value !== '101') return wrong(value[1] === '1' ? 'Sobrecarga en el bus de archivo. El fusible conserva el circuito anterior.' : 'Servicios de emergencia incompletos. El arranque no puede sostenerse.');
    return result(true, 'Vida y refrigeración estables. ECHO vuelve a responder. La línea del archivo sigue aislada.', { ...updateEscape(p, { powerRouted: true }), installed: true, power: true });
  }
  if (name === 'mirrors' || name === 'optics') {
    if (p.story.zone !== 'lab' || !e.lensInstalled) return result(false, 'Instala la lente en el banco óptico.');
    if (e.opticsSolved) return result(true, 'La verificación humana ya está fijada. Recuperaste la oblea.');
    if (name === 'mirrors') return /^[01]{3}$/.test(value) ? result(true, 'Espejo ajustado.', updateEscape(p, { mirrors: value })) : result(false, 'Orientación inválida.');
    if (!traceBeam(e.mirrors).human) return wrong('El rayo no llega al receptor humano. Sigue sus rebotes.');
    return result(true, p.story.labSolved ? 'Verificación independiente aceptada. Recuperas una oblea firmada; la esclusa del núcleo se libera.' : 'Verificación independiente aceptada. Recuperas una oblea firmada. La esclusa aún señala suministro inestable.', updateEscape(p, { opticsSolved: true, inventory: [...e.inventory, 'wafer'] }));
  }
  if (name === 'secret') {
    if (p.story.zone !== 'lab' || !e.lensInstalled) return result(false, 'Bajo la pintura hay trazos que la luz normal no revela.');
    return result(true, 'Inscripción del operador 17: «Si no vuelvo, conservad mi voz para mi hija. Eso no autoriza a encerrar a nadie». Encuentras su nombre: Mara.', updateEscape(p, { secret: true }));
  }
  if (p.story.zone !== 'core' || !p.story.archiveVerified || !p.story.documents.includes('consent') || p.story.stance === 'undecided') return result(false, 'Antes necesitas contrastar el archivo, leer el informe de ética y responder a ECHO.');
  if (value === 'reset') return result(true, 'Mandos liberados. Todavía no se ha ejecutado ningún protocolo.', updateEscape(p, { finalRoute: 'none' }));
  const route = value === 'aux:human:aux' ? 'preserve' : value === 'off:none:aux' ? 'erase' : null;
  if (!route) return wrong(value.split(':')[2] !== 'aux' ? 'La salida no dispone de una alimentación independiente. Ningún protocolo se ha ejecutado.' : 'El archivo y su autoridad siguen en una configuración incompatible. Ningún protocolo se ha ejecutado.');
  return result(true, route === 'preserve' ? 'Custodia humana preparada. ECHO queda separada del control. Revisa y confirma la conservación.' : 'Aislamiento preparado. El archivo quedará sin alimentación; la salida seguirá operativa. Revisa y confirma las consecuencias.', updateEscape(p, { finalRoute: route }));
}
