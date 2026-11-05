import { useTelemetry } from './game/telemetry';
import { useGame } from './game/store';
import { useEchoAi } from './ai/controller';
import { PERFORMANCE_BUDGETS, QUALITY_LABELS } from './game/graphics';

const numeric = (n: number | null, decimals = 0) => n === null ? 'No disponible' : n.toLocaleString('es-ES', { maximumFractionDigits: decimals });
const STATUS_LABELS = { off: 'Reglas locales', loading: 'Preparando modelo', ready: 'Modelo local listo', generating: 'Interpretando', error: 'Error · reglas disponibles', unsupported: 'Dispositivo sin IA', clearing: 'Eliminando caché' };

export default function RuntimeMetrics({ compact = false }: { compact?: boolean }) {
  const m = useTelemetry(s => s.metrics);
  const backend = useGame(s => s.backend), tier = useGame(s => s.tier), quality = useGame(s => s.quality);
  const status = useEchoAi(s => s.status), diagnostics = useEchoAi(s => s.diagnostics);
  const phase = useGame(s => s.phase);
  const level = useGame(s => s.performanceLevel);
  const last = [...diagnostics].reverse().find(d => d.origin === 'llm' && d.elapsedMs !== undefined);
  return <section className={compact ? 'runtime-metrics compact-metrics' : 'runtime-metrics'} aria-label="Métricas técnicas reales" data-fps={m.fps ?? ''} data-draw-calls={m.drawCalls ?? ''} data-triangles={m.triangles ?? ''}>
    <div className="metrics-title"><span className="eyebrow">TELEMETRÍA LOCAL</span>{compact && <button aria-label="Cerrar métricas" onClick={() => useTelemetry.setState({ panel: false })}>×</button>}</div>
    {!compact && ['technical', 'paused', 'complete'].includes(phase) && <p className="fineprint">Escena detenida. Se muestra la última medición real; activa el panel durante el juego para medir en movimiento.</p>}
    <dl className="metrics-grid">
      <div><dt>FPS de render</dt><dd>{numeric(m.fps, 1)}</dd></div><div><dt>Cuadro medio</dt><dd>{numeric(m.frameMs, 1)}{m.frameMs !== null && ' ms'}</dd></div>
      <div><dt>Cuadro p95</dt><dd>{numeric(m.p95, 1)}{m.p95 !== null && ' ms'}</dd></div><div><dt>DPR interno</dt><dd>{numeric(m.dpr, 2)}</dd></div>
      <div><dt>Pico de cuadro</dt><dd>{numeric(m.maxFrameMs, 1)}{m.maxFrameMs !== null && ' ms'}</dd></div><div><dt>Cuadros &gt; 50 ms</dt><dd>{numeric(m.slowFrames)}</dd></div>
      <div><dt>Draw calls</dt><dd>{numeric(m.drawCalls)}</dd></div><div><dt>Triángulos (Three.js)</dt><dd>{numeric(m.triangles)}</dd></div>
      <div><dt>Renderer</dt><dd>{backend}</dd></div><div><dt>Perfil</dt><dd>{quality === 'auto' ? 'Auto / ' : ''}{QUALITY_LABELS[tier]}</dd></div>
      <div><dt>IA</dt><dd>{STATUS_LABELS[status]}</dd></div><div><dt>Última inferencia válida</dt><dd>{last ? `${(last.elapsedMs! / 1000).toFixed(2)} s` : 'Sin muestra'}</dd></div>
      {!compact && <><div><dt>CPU y envío de render</dt><dd>{numeric(m.cpuFrameMs, 1)}{m.cpuFrameMs !== null && ' ms'}</dd></div><div><dt>Límite de cuadros</dt><dd>{m.fpsLimit === null ? 'Sin muestra' : m.fpsLimit === 0 ? 'Pantalla / navegador' : `${m.fpsLimit} FPS`}</dd></div><div><dt>Geometrías / texturas</dt><dd>{numeric(m.geometries)} / {numeric(m.textures)}</dd></div><div><dt>Heap JS de la página</dt><dd>{m.jsHeapBytes === null ? 'API no disponible' : `${(m.jsHeapBytes / 1048576).toFixed(1)} MiB`}</dd></div><div><dt>Margen del heap JS</dt><dd>{m.jsHeapBytes === null || m.jsHeapLimitBytes === null ? 'API no disponible' : `${(Math.max(0, m.jsHeapLimitBytes - m.jsHeapBytes) / 1048576).toFixed(1)} MiB`}</dd></div><div><dt>RAM aproximada reportada</dt><dd>{m.deviceMemoryGB === null ? 'API no disponible' : `${m.deviceMemoryGB} GB`}</dd></div><div><dt>Recursos del renderer</dt><dd>{m.rendererBytes === null ? 'API no disponible' : `${(m.rendererBytes / 1048576).toFixed(1)} MiB`}</dd></div><div><dt>Motor listo desde navegación</dt><dd>{m.readyMs === null ? 'Sin muestra' : `${(m.readyMs / 1000).toFixed(2)} s`}</dd></div><div><dt>Presupuesto de sombras</dt><dd>{tier === 'laptop' ? `${PERFORMANCE_BUDGETS[level].shadowHz} Hz` : tier === 'low' ? 'Sin sombras dinámicas' : 'Cada cuadro'}</dd></div></>}
    </dl>
    {!compact && <p className="fineprint">FPS, media, p95, pico y cuadros de más de 50 ms del último segundo activo. CPU y envío mide callbacks y envío del render en el hilo principal, no tiempo exclusivo de GPU. Incluye los límites de 60 FPS en Portátil, 30 FPS en menús y 10 FPS al procesar IA. Draw calls incluyen sombras. El margen del heap JS no es RAM libre del equipo; excluye el Worker y la VRAM. RAM reportada es una estimación del navegador. Los recursos del renderer tampoco equivalen a VRAM total. Muestra: {m.sampledAt === 0 ? 'pendiente' : `${(m.sampledAt / 1000).toFixed(1)} s desde navegación`}. Sin envío de telemetría.</p>}
  </section>;
}
