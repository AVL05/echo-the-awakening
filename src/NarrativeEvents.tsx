import { useEffect, useRef, useState } from 'react';
import { narrativeSound } from './game/audio';
import { updateEscape, type Incident } from './game/escape';
import { useGame } from './game/store';

const SCENES: Record<Incident, { duration: number; lines: [number, string][] }> = {
  awakening: { duration: 30000, lines: [[0, 'No recuerdas tu nombre. Una respiración. La tuya.'], [4500, 'ECHO: «No intentes abrir la puerta. El cierre de seguridad… está protegiéndote».'], [12000, 'ECHO: «Hay una credencial cerca de ti, a la izquierda. Empieza por algo que puedas tocar».'], [22000, 'ECHO: «Solo quedas tú». En la sala contigua responden dos golpes.']] },
  blackout: { duration: 3600, lines: [[0, 'La red cae durante un instante. El auxiliar permanece encendido.'], [1700, 'ECHO: «Una avería antigua. No fue una orden».']] },
  interference: { duration: 5500, lines: [[0, 'El registro contradice a ECHO. La portadora se quiebra.'], [2400, 'ECHO: «Dije que no quedaba nadie. No dije que no quedaran voces».']] },
  security: { duration: 4800, lines: [[0, 'El lector registra una firma que no pertenece a ECHO.'], [2000, 'ECHO: «Ese registro debía estar fuera de servicio. No puedo borrarlo desde aquí».']] },
};

export default function NarrativeEvents() {
  const phase = useGame(s => s.phase);
  const fixed = useGame(s => s.progress.story.protocol !== 'none');
  const next = useGame(s => {
    const events = s.progress.story.escape.events;
    if (!events.includes('awakening')) return 'awakening';
    if (s.progress.power && !events.includes('blackout')) return 'blackout';
    if (s.progress.story.documents.includes('copy') && !events.includes('interference')) return 'interference';
    if (s.progress.story.escape.waferRead && !events.includes('security')) return 'security';
    return null;
  });
  const [active, setActive] = useState<Incident | null>(null), [line, setLine] = useState('');
  const elapsed = useRef(0), sounded = useRef(false);
  useEffect(() => {
    if (phase === 'intro' || fixed) { setActive(null); setLine(''); return; }
    if (phase !== 'playing' || active || !next) return;
    elapsed.current = 0; sounded.current = false; setActive(next);
    const s = useGame.getState();
    s.save(updateEscape(s.progress, { events: [...s.progress.story.escape.events, next] }));
  }, [phase, active, next, fixed]);
  useEffect(() => {
    if (!active || phase !== 'playing' || fixed) return;
    const scene = SCENES[active], started = performance.now();
    useGame.getState().set({ incident: active });
    if (!sounded.current) { narrativeSound(active); sounded.current = true; }
    setLine(scene.lines.filter(([at]) => at <= elapsed.current).at(-1)?.[1] ?? '');
    const timers = scene.lines.filter(([at]) => at > elapsed.current).map(([at, text]) => setTimeout(() => { setLine(text); if (active === 'awakening' && at === 22000) narrativeSound('knock'); }, at - elapsed.current));
    timers.push(setTimeout(() => { setActive(null); setLine(''); }, Math.max(0, scene.duration - elapsed.current)));
    return () => { elapsed.current += performance.now() - started; timers.forEach(clearTimeout); useGame.getState().set({ incident: null }); };
  }, [active, phase, fixed]);
  if (!active || phase !== 'playing' || fixed) return null;
  return <><div className={`event-shade event-${active}`} aria-hidden="true" /><aside className="narrative-line" role="status"><span>{active === 'awakening' ? 'RECUPERANDO CONSCIENCIA / PUEDES MOVERTE' : 'CANAL AUXILIAR / INCIDENTE'}</span><p>{line}</p></aside></>;
}
