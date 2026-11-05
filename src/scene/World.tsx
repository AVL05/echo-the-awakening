import { Component, memo, Suspense, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, PCFShadowMap, SpotLight, WebGLRenderer, type WebGLRendererParameters } from 'three';
import Room from './Room';
import Player from './Player';
import Metrics from './Metrics';
import { useTelemetry } from '../game/telemetry';
import StoryRooms from './StoryRooms';
import Cinematics from './Cinematics';
import { useGame } from '../game/store';
import { frameBudget, GRAPHICS, PERFORMANCE_BUDGETS, renderDpr } from '../game/graphics';
import { aiIsBusy, useEchoAi } from '../ai/controller';
import { prepareScene } from './preparation';

function FrameBudget({ fps }: { fps: number }) {
  const invalidate = useThree(s => s.invalidate);
  useEffect(() => {
    if (fps === 0) return;
    let frame = 0, previous = 0;
    const tick = (now: number) => {
      const interval = 1000 / fps, elapsed = now - previous;
      if (!document.hidden && elapsed >= interval - 0.5) { invalidate(); previous = elapsed >= interval ? now - elapsed % interval : now; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [fps, invalidate]);
  return null;
}

function InitialPreparation() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    const abort = new AbortController();
    void prepareScene(gl, scene, camera, abort.signal).catch(error => {
      if (!abort.signal.aborted) console.warn('ECHO: initial shaders will compile during rendering', error);
    }).finally(() => {
      if (abort.signal.aborted) return;
      useGame.getState().set({ ready: true });
      useTelemetry.setState(s => ({ metrics: { ...s.metrics, readyMs: performance.now() } }));
    });
    return () => abort.abort();
  }, [gl, scene, camera]);
  return null;
}

function ContextRecovery() {
  const gl = useThree(s => s.gl);
  useEffect(() => {
    let mounted = true;
    const lost = (event?: Event) => {
      event?.preventDefault();
      if (mounted) useGame.getState().set({ contextLost: true, phase: 'paused', message: 'Se perdió el contexto gráfico. Recarga para recuperar la partida guardada.' });
    };
    const device = (gl as unknown as { backend?: { device?: { lost: Promise<{ reason: string }> } } }).backend?.device;
    void device?.lost.then(info => { if (info.reason !== 'destroyed') lost(); });
    gl.domElement.addEventListener('webglcontextlost', lost);
    return () => { mounted = false; gl.domElement.removeEventListener('webglcontextlost', lost); };
  }, [gl]);
  return null;
}

function ShadowBudget() {
  const tier = useGame(s => s.tier);
  const level = useGame(s => s.performanceLevel);
  const elapsed = useRef(0);
  useFrame(({ scene }, delta) => {
    if (tier !== 'laptop') return;
    elapsed.current += delta;
    const interval = 1 / PERFORMANCE_BUDGETS[level].shadowHz;
    if (elapsed.current < interval) return;
    elapsed.current %= interval;
    scene.traverseVisible(object => {
      if (object instanceof SpotLight && object.castShadow) object.shadow.needsUpdate = true;
    });
  });
  return null;
}

class GraphicsBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('ECHO graphics', error, info.componentStack); }
  render() {
    if (this.state.failed) return <div className="graphics-error" role="alert"><h2>La señal se ha interrumpido.</h2><p>Necesitas WebGL 2 o WebGPU habilitado y aceleración gráfica. Prueba el modo compatible.</p><button onClick={() => { const url = new URL(location.href); url.searchParams.set('renderer', 'webgl'); location.assign(url); }}>Reintentar con WebGL 2</button></div>;
    return this.props.children;
  }
}

export default memo(function World() {
  const tier = useGame(s => s.tier);
  const scale = useGame(s => s.resolutionScale);
  const phase = useGame(s => s.phase);
  const [hidden, setHidden] = useState(document.hidden);
  const [viewport, setViewport] = useState([innerWidth, innerHeight]);
  useEffect(() => { const visibility = () => setHidden(document.hidden); document.addEventListener('visibilitychange', visibility); return () => document.removeEventListener('visibilitychange', visibility); }, []);
  useEffect(() => { const resize = () => setViewport([innerWidth, innerHeight]); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize); }, []);
  const profile = GRAPHICS[tier];
  const inferenceBusy = useEchoAi(aiIsBusy);
  const frozen = hidden || ['paused', 'technical', 'complete'].includes(phase);
  const fpsBudget = frameBudget(tier, phase, inferenceBusy, hidden);
  const limited = frozen || fpsBudget > 0;
  return <GraphicsBoundary><div className="world" aria-label="Instalación Lazarus, entorno tridimensional">
    <Canvas frameloop={limited ? 'demand' : 'always'} shadows={profile.shadowSize ? { type: PCFShadowMap } : false} dpr={renderDpr(tier, viewport[0], viewport[1], devicePixelRatio, scale)} camera={{ fov: 62, near: 0.1, far: 100 }}
      gl={async props => {
        const options = { ...props, antialias: true, alpha: false, powerPreference: 'high-performance' } as WebGLRendererParameters;
        const requested = new URLSearchParams(location.search).get('renderer');
        // Conservative default; compare both backends explicitly without switching during play.
        if (requested === 'webgpu' && navigator.gpu) {
          try {
            const { WebGPURenderer } = await import('three/webgpu');
            const renderer = new WebGPURenderer({ canvas: options.canvas as HTMLCanvasElement, antialias: true, alpha: false, powerPreference: 'high-performance' });
            await renderer.init();
            renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
            const backend = renderer.backend as { isWebGPUBackend?: boolean };
            useGame.getState().set({ backend: backend.isWebGPUBackend ? 'WEBGPU' : 'WEBGL 2' });
            return renderer as unknown as WebGLRenderer;
          } catch (error) { console.warn('WebGPU initialization failed, using WebGL 2.', error); }
        }
        const renderer = new WebGLRenderer(options);
        renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
        useGame.getState().set({ backend: 'WEBGL 2' });
        return renderer;
      }}>
      <Suspense fallback={null}><Room /><StoryRooms /><Player /><Cinematics /><Metrics /><ShadowBudget /><ContextRecovery /><FrameBudget fps={fpsBudget} /><InitialPreparation /></Suspense>
    </Canvas>
  </div></GraphicsBoundary>;
});
