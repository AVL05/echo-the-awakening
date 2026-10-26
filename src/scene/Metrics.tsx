import { useEffect } from 'react';
import { addAfterEffect, useThree } from '@react-three/fiber';
import { useGame } from '../game/store';
import { useTelemetry } from '../game/telemetry';

export default function Metrics() {
  const gl = useThree(s => s.gl);
  const phase = useGame(s => s.phase);
  useEffect(() => {
    let start = performance.now(), frames = 0, lastId = -1;
    // WebGPU resets counters before useFrame. Sample the completed render instead.
    return addAfterEffect(() => {
      const info = gl.info as unknown as { calls?: number; render: { frame?: number; drawCalls?: number; calls: number; triangles: number }; memory: { geometries: number; textures: number; total?: number } };
      const id = info.render.frame ?? info.calls ?? info.render.calls;
      if (document.hidden || id === lastId) return;
      lastId = id; frames++;
      const now = performance.now(), elapsed = now - start;
      if (elapsed < 1000) return;
      const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      const previous = useTelemetry.getState().metrics;
      useTelemetry.setState({ metrics: { fps: frames * 1000 / elapsed, frameMs: elapsed / frames, drawCalls: info.render.drawCalls ?? info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures, jsHeapBytes: heap?.usedJSHeapSize ?? null, rendererBytes: info.memory.total ?? null, sampledAt: now, readyMs: previous.readyMs } });
      start = now; frames = 0;
    });
  }, [gl, phase]);
  return null;
}
