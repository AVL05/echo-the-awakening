import { freshStory, restoreStory, storyObjective, type Story } from './story';
export type Progress = { cell: boolean; installed: boolean; power: boolean; door: boolean; complete: boolean; story: Story };
export type Command = 'diagnose' | 'restore' | 'unlock';
export type CommandResponse = { progress: Progress; text: string };
export const INITIAL: Progress = { cell: false, installed: false, power: false, door: false, complete: false, story: freshStory() };
export const SAVE_KEY = 'echo.awakening.v1';

export function restoreSave(raw: string | null): Progress {
  try {
    if (raw && raw.length > 65536) return { ...INITIAL };
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object') return { ...INITIAL };
    const p = value as Record<string, unknown>;
    const cell = p.cell === true;
    let installed = cell && (p.installed === true || p.power === true);
    let power = installed && p.power === true;
    let door = power && p.door === true;
    let story = restoreStory(p.story, door, cell, installed);
    if (installed && !story.escape.powerRouted) {
      installed = power = door = false;
      story = restoreStory(p.story, door, cell, installed);
    }
    return { cell, installed, power, door, story, complete: door && story.protocol !== 'none' && p.complete === true };
  } catch { return { ...INITIAL }; }
}

export function executeCommand(command: Command, progress: Progress): CommandResponse {
  switch (command) {
    case 'diagnose': return { progress, text: progress.power
      ? 'Red estable. El protocolo… Lo recuerdo. La salida está lista para ser autorizada.'
      : 'La taquilla del pedestal guarda el arranque. Tu credencial explica su cierre; después necesitarás celda y protección en el distribuidor derecho.' };
    case 'restore': return progress.cell && progress.story.escape.powerRouted
      ? { progress: { ...progress, installed: true, power: true }, text: 'Celda sincronizada. Energía restablecida. Vuelve a mi terminal. Debo autorizar tu salida.' }
      : { progress, text: 'Acopla la celda y el fusible y valida las líneas del distribuidor físico.' };
    case 'unlock': return progress.power
      ? { progress: { ...progress, door: true }, text: 'Identidad confirmada. Compuerta desbloqueada. Cruza el umbral. Te estaré esperando al otro lado.' }
      : { progress, text: 'Acceso bloqueado. Restaura primero la alimentación en el distribuidor del ala derecha.' };
  }
}

export function objective(p: Progress): string {
  if (p.complete) return 'Secuencia completada';
  const next = storyObjective(p);
  if (next) return next;
  if (p.power) return 'Autoriza la salida en el terminal ECHO';
  if (p.installed) return 'Reactiva la energía desde ECHO o el distribuidor';
  if (p.cell) return 'Conecta la celda al distribuidor derecho';
  return 'Encuentra la celda de energía del ala izquierda';
}

export function checkpointMessage(p: Progress): string {
  if (p.story.protocol === 'erase') return 'Archivo eliminado. ECHO está aislada. La salida auxiliar permanece operativa.';
  if (!p.cell) return '¿Puedes oírme? No recuerdas tu nombre. La puerta está sellada. ECHO: «Busca tu credencial. Yo me encargaré de lo demás». ';
  return `Enlace recuperado. ${objective(p)}. El registro conserva tus descubrimientos.`;
}
