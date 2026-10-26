import { useTelemetry } from './game/telemetry';
import { useGame } from './game/store';
import { useEchoAi } from './ai/controller';

const numeric = (n: number | null, decimals = 0) => n === null ? 'No disponible' : n.toLocaleString('es-ES', { maximumFractionDigits: decimals });
const STATUS_LABELS = { off: 'Reglas locales', loading: 'Preparando modelo', ready: 'Modelo local listo', generating: 'Interpretando', error: 'Error · reglas disponibles', unsupported: 'Dispositivo sin IA', clearing: 'Eliminando caché' };

export default function RuntimeMetrics({ compact = false }: { compact?: boolean }) {
  const m = useTelemetry(s => s.metrics);
  const backend = useGame(s => s.backend), tier = useGame(s => s.tier), quality = useGame(s => s.quality);
  const status = useEchoAi(s => s.status), diagnostics = useEchoAi(s => s.diagnostics);
  const phase = useGame(s => s.phase);
  const last = [...diagnostics].reverse().find(d => d.origin === 'llm' && d.elapsedMs !== undefined);
  return <section className={compact ? 'runtime-metrics compact-metrics' : 'runtime-metrics'} aria-label="Métricas técnicas reales" data-fps={m.fps ?? ''} data-draw-calls={m.drawCalls ?? ''} data-triangles={m.triangles ?? ''}>
    <div className="metrics-title"><span className="eyebrow">TELEMETRÍA LOCAL</span>{compact && <button aria-label="Cerrar métricas" onClick={() => useTelemetry.setState({ panel: false })}>×</button>}</div>
    {!compact && ['technical', 'paused', 'complete'].includes(phase) && <p className="fineprint">Escena detenida. Se muestra la última medición real; activa el panel durante el juego para medir en movimiento.</p>}
    <dl className="metrics-grid">
      <div><dt>FPS de render</dt><dd>{numeric(m.fps, 1)}</dd></div><div><dt>Cuadro medio</dt><dd>{numeric(m.frameMs, 1)}{m.frameMs !== null && ' ms'}</dd></div>
      <div><dt>Draw calls</dt><dd>{numeric(m.drawCalls)}</dd></div><div><dt>Triángulos (Three.js)</dt><dd>{numeric(m.triangles)}</dd></div>
      <div><dt>Renderer</dt><dd>{backend}</dd></div><div><dt>Perfil</dt><dd>{quality === 'auto' ? 'Auto / ' : ''}{{ low: 'Bajo', medium: 'Medio', high: 'Alto' }[tier]}</dd></div>
      <div><dt>IA</dt><dd>{STATUS_LABELS[status]}</dd></div><div><dt>Última inferencia válida</dt><dd>{last ? `${(last.elapsedMs! / 1000).toFixed(2)} s` : 'Sin muestra'}</dd></div>
      {!compact && <><div><dt>Geometrías / texturas</dt><dd>{numeric(m.geometries)} / {numeric(m.textures)}</dd></div><div><dt>Heap JS de la página</dt><dd>{m.jsHeapBytes === null ? 'API no disponible' : `${(m.jsHeapBytes / 1048576).toFixed(1)} MiB`}</dd></div><div><dt>Recursos del renderer</dt><dd>{m.rendererBytes === null ? 'API no disponible' : `${(m.rendererBytes / 1048576).toFixed(1)} MiB`}</dd></div><div><dt>Motor listo desde navegación</dt><dd>{m.readyMs === null ? 'Sin muestra' : `${(m.readyMs / 1000).toFixed(2)} s`}</dd></div></>}
    </dl>
    {!compact && <p className="fineprint">FPS sobre los cuadros presentados; incluye el límite de 10 FPS al procesar IA. Draw calls y triángulos del último cuadro completo, incluidos pases de sombras. Heap JS es una API experimental de esta página; no incluye el Worker ni la VRAM. Recursos del renderer tampoco equivalen a VRAM total. Muestra: {m.sampledAt === 0 ? 'pendiente' : `${(m.sampledAt / 1000).toFixed(1)} s desde navegación`}. Sin envío de telemetría.</p>}
  </section>;
}
