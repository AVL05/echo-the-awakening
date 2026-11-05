import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { adjustRegulator, interact, resume, openPanel, targetLabel, openTechnical, closeTechnical } from './game/actions';
import { chime, pauseAudio, setMuted, setReactorAudio, wakeAudio } from './game/audio';
import { echoCommands } from './game/commands';
import { objective, type Command } from './game/progress';
import { useGame, type Quality } from './game/store';
import { controls } from './game/input';
import AiTerminal from './ai/AiTerminal';
import Modal from './Modal';
import RuntimeMetrics from './RuntimeMetrics';
import { LoadBoundary, LoadingStatus } from './Boot';
import { beginTrace, stateChanges, traceStep, useTelemetry } from './game/telemetry';
import { Ending, NarrativePanels, StoryTerminal } from './StoryPanels';
import { CINEMA_TEXT, ZONE_LABELS } from './game/story';
import { QUALITY_LABELS } from './game/graphics';
import EscapePanels from './EscapePanels';
import NarrativeEvents from './NarrativeEvents';
import { inventory, solvedPuzzles } from './game/escape';

const World = lazy(() => import('./scene/World'));
const BehindSystem = lazy(() => import('./BehindSystem'));

function Icon({ name }: { name: 'sound' | 'mute' | 'settings' | 'arrow' | 'pause' }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    {name === 'arrow' ? <path d="M4 12h15m-6-6 6 6-6 6" /> : name === 'pause' ? <path d="M9 5v14m6-14v14" /> : name === 'settings' ? <><path d="M4 6h16M4 12h16M4 18h16" /><path d="M8 3v6m8 0v6m-7 0v6" /></> : <><path d="m11 5-6 4H2v6h3l6 4V5Z" />{name === 'sound' ? <><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></> : <path d="m16 9 6 6m0-6-6 6" />}</>}
  </svg>;
}

function Settings() {
  const { quality, inputMode, effects, set } = useGame();
  const panel = useTelemetry(s => s.panel);
  return <div className="settings-fields">
    <label>Calidad gráfica <select value={quality} onChange={e => {
      const quality = e.target.value as Quality; set({ quality, resolutionScale: 1, performanceLevel: 0, tier: quality === 'auto' ? matchMedia('(pointer: coarse)').matches ? 'low' : 'laptop' : quality });
    }}><option value="auto">Automático · Priorizar fluidez</option><option value="laptop">PORTÁTIL · Fluidez y memoria</option><option value="low">Bajo · Rendimiento</option><option value="medium">Medio · Equilibrado</option><option value="high">Alto · Cinematográfico</option></select></label>
    <label className="metrics-toggle"><input type="checkbox" checked={effects} onChange={e => set({ effects: e.target.checked })} /> Efectos atmosféricos avanzados (perfiles Medio y Alto)</label>
    <p className="fineprint">Automático y Portátil buscan 60 FPS y ajustan resolución, frecuencia de sombras y polvo con recuperación lenta. Medio y Alto conservan su detalle.</p>
    <label>Motor gráfico (recarga la partida) <select value={new URLSearchParams(location.search).get('renderer') ?? 'auto'} onChange={e => {
      const url = new URL(location.href);
      if (e.target.value === 'auto') url.searchParams.delete('renderer'); else url.searchParams.set('renderer', e.target.value);
      location.assign(url);
    }}><option value="auto">Automático · WebGL 2 conservador</option><option value="webgl">WebGL 2</option><option value="webgpu">WebGPU · Comparar en este equipo</option></select></label>
    <p className="fineprint">Compara ambos motores con el mismo perfil y recorrido: prioriza p95 y picos bajos frente al FPS máximo. Cambiar de motor recupera el último checkpoint guardado.</p>
    <label>Control de cámara <select value={inputMode} onChange={e => set({ inputMode: e.target.value as 'mouse' | 'drag' })}>
      <option value="mouse">Capturar ratón</option><option value="drag">Arrastrar para mirar</option>
    </select></label>
    <label className="metrics-toggle"><input type="checkbox" checked={panel} onChange={e => useTelemetry.setState({ panel: e.target.checked })} /> Mostrar métricas reales durante el juego</label>
    <p className="fineprint">WASD para caminar · Ratón para mirar · E para interactuar · R para girar un regulador señalado · J para consultar el registro · I para inventario · Esc para pausar. También puedes mirar con ← → y avanzar con ↑ ↓.</p>
    <p className="fineprint">En pantalla táctil, usa la cruceta y arrastra la escena para mirar.</p>
  </div>;
}

function Terminal() {
  const progress = useGame(s => s.progress);
  const activeTerminal = useGame(s => s.activeTerminal);
  const gateOpen = activeTerminal === 'lab' ? progress.story.labSolved : activeTerminal === 'core' ? progress.story.protocol !== 'none' : progress.door;
  const [text, setText] = useState(activeTerminal === 'lab' ? progress.story.stance === 'confront' ? 'Tengo los actuadores del circuito conectados. Validaré los valores que indiques; no volveré a ocultarte el resultado.' : 'Los reguladores mantienen el archivo estable. Busca las mediciones y el manual. Puedo ayudarte a interpretar sus relaciones.' : activeTerminal === 'core' ? progress.story.archiveVerified ? 'Los registros están verificados. El control del archivo te pertenece. Lee el informe de ética antes de decidir.' : 'Hay diecisiete señales. Para entregar el control humano debes reconstruir el orden de los registros. El corte no fue el principio.' : progress.power ? 'Has devuelto la energía a Lazarus. Hay cosas que no puedo recordar… pero sé cómo sacarte de aquí.' : 'Te estaba esperando. Mi red está aislada. Puedo ayudarte a restablecer la alimentación.');
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const command = async (command: Command) => {
    if (busy) return;
    setBusy(true); abort.current = new AbortController();
    try {
      const s = useGame.getState();
      const traceId = beginTrace(command, 'deterministic');
      traceStep(traceId, 'interpreted', 'Comando del terminal procesado por reglas locales.');
      const response = await echoCommands.send(command, s.progress, abort.current.signal);
      const ok = command !== 'unlock' || response.progress.door;
      traceStep(traceId, ok ? 'validated' : 'rejected', response.text);
      if (ok) traceStep(traceId, 'executed', response.text, { changes: stateChanges(s.progress, response.progress) });
      s.save(response.progress, traceId); setText(response.text);
      if (response.progress.door && !s.progress.door) chime('door');
      else if (command === 'unlock' && !response.progress.door) chime('denied');
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setText('Enlace interrumpido. Puedes volver a intentarlo.');
    } finally { setBusy(false); }
  };
  return <Modal label="Terminal ECHO" className="terminal-dialog">
    <div className="dialog-meta"><span className="status-dot cyan" /> ENLACE NEURONAL LOCAL <span>EC—07</span></div>
    <div className="terminal-layout"><aside className="terminal-identity">
    <div className="echo-avatar" aria-hidden="true"><i /><i /><i /><span>◇</span></div>
    <h2>ECHO<span>Environmental Cognitive Heuristic Operator</span></h2>
    <p className="terminal-identity-copy">Una voz entre los restos.<br />Una conexión que permanece.</p>
    <div className="terminal-carrier" aria-hidden="true">{Array.from({ length: 25 }, (_, i) => <i key={i} style={{ height: `${6 + Math.sin(i * 1.9) ** 2 * 26}px` }} />)}</div>
    <span className="terminal-node">LAZARUS · {ZONE_LABELS[activeTerminal]}</span>
    </aside><div className="terminal-conversation"><span className="eyebrow">TRANSMISIÓN DE ECHO</span>
    <p className="terminal-output" aria-live="polite">{text}</p>
    <div className="terminal-status"><span>ALIMENTACIÓN <b>{progress.power ? 'ESTABLE' : 'AUXILIAR'}</b></span><span>COMPUERTA <b>{gateOpen ? 'AUTORIZADA' : 'BLOQUEADA'}</b></span></div>
    {progress.story.protocol !== 'erase' && <button className="ai-invitation" onClick={() => { const section = document.getElementById('echo-local-ai'); section?.focus({ preventScroll: true }); section?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); }}><span><b>Una segunda forma de hablar con ECHO</b><small>IA local opcional · descarga de ≈300 MB · sin coste</small></span><span aria-hidden="true">↗</span></button>}
    {activeTerminal === 'containment' && <div className="command-list">
      <button disabled={busy} onClick={() => void command('diagnose')}><span>01</span>Diagnóstico de la instalación<Icon name="arrow" /></button>
      <button disabled={busy} onClick={() => void command('unlock')}><span>02</span>{progress.door ? 'Verificar autorización' : 'Autorizar compuerta de salida'}<Icon name="arrow" /></button>
    </div>}
    <StoryTerminal onResponse={setText} />
    <AiTerminal />
    <button className="text-button terminal-close" onClick={resume}>Cerrar enlace <span>ESC / ECHO</span></button>
    </div></div>
  </Modal>;
}

function SystemCue() {
  const [cue, setCue] = useState<'power' | 'door' | 'lab' | 'optics' | 'archive' | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const unsubscribe = useGame.subscribe((next, previous) => {
      const event = !previous.progress.power && next.progress.power ? 'power' : !previous.progress.door && next.progress.door ? 'door' : !previous.progress.story.labSolved && next.progress.story.labSolved ? 'lab' : !previous.progress.story.escape.opticsSolved && next.progress.story.escape.opticsSolved ? 'optics' : !previous.progress.story.archiveVerified && next.progress.story.archiveVerified ? 'archive' : null;
      if (event) { clearTimeout(timer); setCue(event); timer = setTimeout(() => setCue(null), 4800); }
      if (next.phase === 'intro') { clearTimeout(timer); setCue(null); }
    });
    return () => { unsubscribe(); clearTimeout(timer); };
  }, []);
  if (!cue) return null;
  const text = { power: ['ARRANQUE COMPLETADO', 'Lazarus vuelve a respirar.'], door: ['CUARENTENA ANULADA', 'El umbral está abierto.'], lab: ['SUMINISTRO ESTABLE', 'Los cultivos recuperan su pulso.'], optics: ['CUSTODIA VERIFICADA', 'Una firma que ECHO no controla.'], archive: ['CRONOLOGÍA CONTRASTADA', 'El apagón no fue el principio.'] }[cue];
  return <div className={`system-cue ${cue}`} key={cue} role="status"><span>{text[0]}</span><strong>{text[1]}</strong><i /></div>;
}

function TouchControls() {
  const phase = useGame(s => s.phase);
  const target = useGame(s => s.target);
  if (phase !== 'playing') return null;
  return <div className="touch-controls">
    <div className="dpad" aria-label="Movimiento">
      {([['↑', 0, -1, 'Avanzar'], ['←', -1, 0, 'Izquierda'], ['↓', 0, 1, 'Retroceder'], ['→', 1, 0, 'Derecha']] as const).map(([label, x, z, name]) => <button key={name} aria-label={name} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); controls.touch = [x, z]; }} onPointerUp={() => { controls.touch = [0, 0]; }} onPointerCancel={() => { controls.touch = [0, 0]; }}>{label}</button>)}
    </div>
    <button className="touch-interact" disabled={!target} onClick={() => void interact()}>E<span>{target ? 'Interactuar' : 'Apunta cerca'}</span></button>
  </div>;
}

function FirstSteps() {
  const progress = useGame(s => s.progress);
  const phase = useGame(s => s.phase);
  const target = useGame(s => s.target);
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || progress.door || target || phase !== 'playing') return null;
  const touch = matchMedia('(pointer: coarse)').matches;
  const step = 'Explora, examina y compara lo que encuentres.';
  return <aside className="first-steps" aria-label="Guía de primeros pasos"><span>PRIMEROS PASOS</span><strong>{step}</strong><p>{touch ? 'Cruceta para caminar. Arrastra para mirar. Apunta y pulsa Interactuar.' : 'WASD para caminar. Ratón para mirar; también puedes arrastrar desde ajustes. Apunta y pulsa E. El registro guarda tus pistas.'}</p><button onClick={() => setDismissed(true)}>Entendido</button></aside>;
}

function MetricsOverlay() {
  const panel = useTelemetry(s => s.panel);
  const phase = useGame(s => s.phase);
  return panel && phase === 'playing' ? <RuntimeMetrics compact /> : null;
}

export default function App() {
  const s = useGame();
  useEffect(() => { if (location.pathname.replace(/\/$/, '') === '/behind-the-system') openTechnical(); }, []);
  const [settings, setSettings] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const intro = s.phase === 'intro';
  const chapterReady = s.ready && (!s.progress.door || s.labReady) && (!s.progress.story.labSolved || s.coreReady);
  const completed = s.phase === 'complete' || (s.phase === 'technical' && s.progress.complete);
  const step = solvedPuzzles(s.progress);
  const hasProgress = s.progress.cell || s.progress.story.escape.inventory.length > 0 || step > 0;
  useEffect(() => { setMuted(s.muted); }, [s.muted]);
  useEffect(() => { const update = () => pauseAudio(document.hidden || ['paused', 'intro', 'complete', 'technical'].includes(s.phase)); update(); document.addEventListener('visibilitychange', update); return () => document.removeEventListener('visibilitychange', update); }, [s.phase]);
  useEffect(() => { setReactorAudio(s.progress.power); }, [s.progress.power, s.phase]);
  const start = () => {
    wakeAudio(s.muted);
    if (s.progress.complete) { s.set({ phase: 'complete' }); return; }
    resume();
  };
  const openSettings = () => {
    setSettings(true);
    if (!intro) s.set({ phase: 'paused' });
    if (document.pointerLockElement) document.exitPointerLock();
  };
  return <main className={intro ? 'experience is-intro' : 'experience'} data-phase={s.phase} data-power={s.progress.power}>
    <LoadBoundary><Suspense fallback={<div className="boot-screen" role="status">ESTABLECIENDO ENLACE CON LAZARUS<span /></div>}><World /></Suspense></LoadBoundary>
    <div className="cinematic-grain" aria-hidden="true" /><div className="vignette" aria-hidden="true" />
    <SystemCue /><MetricsOverlay /><NarrativeEvents />
    <header className="topbar">
      <div className="wordmark"><span className="brand-symbol">E</span><span>LAZARUS<span className="brand-sub">RESEARCH INITIATIVE</span></span></div>
      <div className="chapter-label"><span className="status-dot" /> {ZONE_LABELS[s.progress.story.zone]} <span className="meta-divider">/</span> EL DESPERTAR</div>
      <div className="tools">
        {!intro && !completed && <button aria-label="Pausar experiencia" onClick={() => { s.set({ phase: 'paused' }); if (document.pointerLockElement) document.exitPointerLock(); }}><Icon name="pause" /></button>}
        <button aria-label={s.muted ? 'Activar sonido' : 'Silenciar sonido'} aria-pressed={s.muted} onClick={() => s.set({ muted: !s.muted })}><Icon name={s.muted ? 'mute' : 'sound'} /></button>
        <button aria-label="Ajustes y controles" onClick={openSettings}><Icon name="settings" /></button>
      </div>
    </header>

    {intro && <section className="title-screen" aria-labelledby="game-title">
      <div className="episode"><span /> UNA EXPERIENCIA DE CIENCIA FICCIÓN <span className="episode-no">TRES ACTOS</span></div>
      <h1 id="game-title">ECHO<span>THE AWAKENING</span></h1>
      <div className="title-rule"><span>ARCHIVO DE INVESTIGACIÓN / 07</span></div>
      <p className="intro-quote">El silencio no significa<br />que estés solo.</p>
      <p className="intro-copy">Despiertas encerrado. No recuerdas por qué.<br />Seis mecanismos. Dos desenlaces. Una voz que sabe más.</p>
      <button className="start-button" disabled={!chapterReady} onClick={start}><span className="button-index">{chapterReady ? '↳' : '·'}</span><span>{!chapterReady ? 'ESTABLECIENDO ENLACE' : s.progress.complete ? 'VER DESENLACE' : hasProgress ? 'CONTINUE EXPERIENCE' : 'START EXPERIENCE'}</span><Icon name="arrow" /></button>
      {s.recovery && <p className="recovery-notice" role="status">{s.recovery === 'backup' ? 'Partida recuperada desde la copia anterior.' : s.recovery === 'repaired' ? 'El guardado no era válido. Se ha preparado un inicio seguro.' : 'Almacenamiento no disponible. Puedes jugar durante esta sesión.'}</p>}
      <div className="start-caption"><span className="tiny-diamond" /> {hasProgress ? 'PROGRESO LOCAL DISPONIBLE' : 'CAPÍTULO 01'} <i /> {hasProgress ? 'CONTINÚA TU SEÑAL' : 'SIN LÍMITE DE TIEMPO · ESCAPE ROOM'}</div>
      <button className="system-entry" data-open-system onClick={openTechnical}>Behind the System <span>Explorar la ingeniería ↗</span></button>
      <div className="intro-controls"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> MOVERSE</span><span><span className="mouse-icon" /> MIRAR</span><span><kbd>E</kbd> INTERACTUAR</span></div>
    </section>}

    {intro && <aside className="scene-caption"><div className="caption-line" /><span>INSTALACIÓN DE CONTENCIÓN / NIVEL −07</span><strong>PROYECTO LAZARUS</strong><small><span className="status-dot" /> {s.progress.power ? 'NÚCLEO EN LÍNEA' : 'ALIMENTACIÓN AUXILIAR'}</small></aside>}

    {!intro && !completed && <>
      <section className="objective" aria-label="Objetivo actual"><span className="eyebrow">INVESTIGACIÓN / {ZONE_LABELS[s.progress.story.zone]} <b>0{step} / 06</b></span><p aria-live="polite">{objective(s.progress)}</p><div className="objective-steps">{[0, 1, 2, 3, 4, 5].map(i => <i key={i} className={step > i ? 'active' : ''} />)}</div><FirstSteps /></section>
      {s.phase === 'playing' && <>
        <div className="entry-shutter" aria-hidden="true" />
        <div className={s.target ? 'crosshair active' : 'crosshair'} aria-hidden="true"><i /><i /></div>
        {s.target && <div className="world-interactions"><button className="interact-prompt" onClick={() => void interact()}><kbd>E</kbd>{targetLabel(s.target)}</button>{s.target.startsWith('valve:') && !s.progress.story.labSolved && <button className="quick-adjust" onClick={() => { const i = Number(s.target!.at(-1)); adjustRegulator(i, (s.progress.story.dials[i] + 1) % 5); }}><kbd>R</kbd> Girar · lectura {s.progress.story.dials[Number(s.target.at(-1))]}</button>}</div>}
        <section className="echo-message" aria-label="Mensaje ECHO"><div><span className="echo-mark">◇</span><span>ECHO <small>CANAL AUXILIAR</small></span><i /><i /><i /><i /><i /></div><p aria-live="polite">{s.message}</p></section>
        <div className="journal-access"><button onClick={() => openPanel('journal')}><kbd>J</kbd> Registro · {s.progress.story.documents.length} / 7</button><button onClick={() => openPanel('inventory')}><kbd>I</kbd> Inventario · {inventory(s.progress).length}</button></div>
        <div className="game-controls"><kbd>WASD</kbd> MOVERSE <kbd>E</kbd> INTERACTUAR <kbd>ESC</kbd> PAUSA</div>
        <aside className="inventory-indicator" aria-label="Estado de la celda"><span className={s.progress.cell ? 'inventory-cell acquired' : 'inventory-cell'} aria-hidden="true"><i /><i /><i /></span><div><small>CELDA DE ARRANQUE</small><strong>{s.progress.power ? 'CONECTADA AL NÚCLEO' : s.progress.installed ? 'INSTALADA · SIN ALIMENTACIÓN' : s.progress.cell ? 'UNIDAD RECUPERADA' : 'BUSCANDO UNIDAD'}</strong></div></aside>
      </>}
      {s.saveFailed && <p className="save-warning" role="status">Guardado local no disponible. Mantén esta pestaña abierta para conservar el progreso.</p>}
      <TouchControls />
    </>}

    <footer className="footer"><span><span className="status-dot" /> {intro ? 'SISTEMAS EN ESPERA' : s.progress.power ? 'RED PRINCIPAL ESTABLE' : 'RED AUXILIAR ACTIVA'}</span><span className="footer-center">{intro ? 'USA AURICULARES PARA UNA MEJOR EXPERIENCIA' : 'LAZARUS / INSTALACIÓN DE INVESTIGACIÓN / NIVEL −07'}</span><span>{s.backend} <i /> {s.quality === 'auto' && 'AUTO / '}{QUALITY_LABELS[s.tier].toUpperCase()}</span></footer>

    {s.phase === 'terminal' && <Terminal />}
    {(s.phase === 'paused' || (intro && settings)) && <Modal label={settings ? 'Ajustes y controles' : 'Experiencia pausada'} onEscape={() => { setSettings(false); setResetConfirm(false); if (!intro) resume(); }}>
      <span className="eyebrow">ENLACE EN SUSPENSIÓN</span><h2>{settings ? 'Ajustes de la señal.' : 'Seguimos aquí.'}</h2>
      {s.contextLost && <p role="alert">Se perdió el contexto gráfico. Recarga para recuperar la última revisión guardada.</p>}
      <Settings />
      <button className="text-button" data-open-system onClick={() => { setSettings(false); openTechnical(); }}>Behind the System ↗</button>
      <button className="primary-button" onClick={() => { if (s.contextLost) { location.reload(); return; } setSettings(false); setResetConfirm(false); if (!intro) resume(); }}> {s.contextLost ? 'Recargar y recuperar partida' : intro ? 'Volver' : 'Reanudar experiencia'}<Icon name="arrow" /></button>
      <button className="text-button" onClick={() => setResetConfirm(!resetConfirm)}>{resetConfirm ? 'Conservar partida' : 'Reiniciar capítulo'}</button>
      {resetConfirm && <div className="reset-confirm"><p>Se borrará el progreso de este capítulo.</p><button onClick={() => { s.reset(); setSettings(false); setResetConfirm(false); }}>Borrar progreso y volver al inicio</button></div>}
    </Modal>}
    {['document', 'journal', 'valve'].includes(s.phase) && <NarrativePanels />}
    {(s.phase === 'mechanism' || s.phase === 'inventory') && <EscapePanels />}
    {s.phase === 'technical' && <LoadBoundary><Suspense fallback={<Modal label="Behind the System" onEscape={closeTechnical}><p role="status">Cargando el apartado técnico…</p><button onClick={closeTechnical}>Volver</button></Modal>}><BehindSystem /></Suspense></LoadBoundary>}
    {s.phase === 'cinematic' && s.cinematic && <section className="cinematic-caption" aria-live="polite"><span className="eyebrow">{CINEMA_TEXT[s.cinematic][0]}</span><h2>{CINEMA_TEXT[s.cinematic][1]}</h2><p>{CINEMA_TEXT[s.cinematic][2]}</p><button className="text-button" onClick={() => s.set({ skipCinematic: true })}>Omitir secuencia</button></section>}
    {completed && <Ending />}
    <LoadingStatus />
  </main>;
}
