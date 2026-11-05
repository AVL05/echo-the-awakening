import { useEffect, useRef } from 'react';
import { addAfterEffect, useFrame, useThree } from '@react-three/fiber';
import { useGame } from '../game/store';
import { useTelemetry } from '../game/telemetry';
import { adaptResolution, frameBudget, framePercentile } from '../game/graphics';
import { aiIsBusy, useEchoAi } from '../ai/controller';

export default function Metrics() {
  const gl = useThree(s => s.gl);
  const phase = useGame(s => s.phase);
  const quality = useGame(s => s.quality);
  const inferenceBusy = useEchoAi(aiIsBusy);
  const preparing = useGame(s => !s.ready || (s.progress.door && !s.labReady) || (s.progress.story.labSolved && !s.coreReady));
  const lastAdjustment = useRef(0);
  const frameStart = useRef(0);
  useFrame(() => { frameStart.current = performance.now(); }, -100);
  useEffect(() => {
    let start = performance.now(), previousFrame = 0, lastId = -1;
    let cpuTotal = 0, cpuSamples = 0;
    let adaptationStart = start, windows = 0;
    const holdUntil = start + 4000;
    let samples: number[] = [], adaptation: number[] = [];
    const visibility = () => { previousFrame = 0; samples = []; adaptation = []; cpuTotal = cpuSamples = 0; start = adaptationStart = performance.now(); windows = 0; };
    document.addEventListener('visibilitychange', visibility);
    // WebGPU resets counters before useFrame. Sample the completed render instead.
    const unsubscribe = addAfterEffect(() => {
      const info = gl.info as unknown as { calls?: number; render: { frame?: number; drawCalls?: number; calls: number; triangles: number }; memory: { geometries: number; textures: number; total?: number } };
      const id = info.render.frame ?? info.calls ?? info.render.calls;
      if (document.hidden || ['paused', 'technical', 'complete'].includes(phase) || id === lastId) return;
      lastId = id;
      const now = performance.now();
      if (previousFrame === 0) { previousFrame = start = now; return; }
      const duration = now - previousFrame;
      previousFrame = now; samples.push(duration); adaptation.push(duration);
      if (frameStart.current > 0) { cpuTotal += now - frameStart.current; cpuSamples++; }
      // Bound retained samples even on uncapped displays.
      if (samples.length > 1024) samples.shift();
      if (adaptation.length > 4096) adaptation.shift();
      const elapsed = now - start;
      if (elapsed < 1000) return;
      const heap = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
      const previous = useTelemetry.getState().metrics;
      const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
      useTelemetry.setState({ metrics: { fps: 1000 / mean, frameMs: mean, p95: framePercentile(samples), maxFrameMs: Math.max(...samples), cpuFrameMs: cpuSamples ? cpuTotal / cpuSamples : null, slowFrames: samples.filter(value => value > 50).length, fpsLimit: frameBudget(useGame.getState().tier, phase, inferenceBusy), dpr: gl.getPixelRatio(), drawCalls: info.render.drawCalls ?? info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures, jsHeapBytes: heap?.usedJSHeapSize ?? null, jsHeapLimitBytes: heap?.jsHeapSizeLimit ?? null, deviceMemoryGB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null, rendererBytes: info.memory.total ?? null, sampledAt: now, readyMs: previous.readyMs } });
      start = now; samples = []; cpuTotal = cpuSamples = 0;
      if (now - adaptationStart >= 4000) {
        const s = useGame.getState();
        if ((quality === 'auto' || quality === 'laptop') && phase === 'playing' && !inferenceBusy && !preparing && now >= Math.max(holdUntil, lastAdjustment.current + 12000)) {
          const result = adaptResolution(s.resolutionScale, adaptation.reduce((sum, value) => sum + value, 0) / adaptation.length, framePercentile(adaptation)!, windows, s.performanceLevel);
          windows = result.windows;
          if (result.scale !== s.resolutionScale || result.level !== s.performanceLevel) { s.set({ resolutionScale: result.scale, performanceLevel: result.level }); lastAdjustment.current = now; }
        }
        adaptation = []; adaptationStart = now;
      }
    });
    return () => { unsubscribe(); document.removeEventListener('visibilitychange', visibility); };
  }, [gl, phase, quality, inferenceBusy, preparing]);
  return null;
}
