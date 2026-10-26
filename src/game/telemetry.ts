import { create } from 'zustand';
import type { Action } from '../ai/actions';
import type { Progress } from './progress';

export type Stage = 'received' | 'interpreted' | 'validated' | 'confirmation' | 'executed' | 'rejected' | 'cancelled' | 'saved' | 'error';
export type Trace = { id: number; input: string; origin: 'llm' | 'deterministic' | 'physical'; started: number; action?: Action; steps: { stage: Stage; ms: number; detail: string }[]; changes?: Record<string, { before: unknown; after: unknown }> };
export type Metrics = { fps: number | null; frameMs: number | null; drawCalls: number | null; triangles: number | null; geometries: number | null; textures: number | null; jsHeapBytes: number | null; rendererBytes: number | null; sampledAt: number; readyMs: number | null };
export const useTelemetry = create<{ metrics: Metrics; traces: Trace[]; panel: boolean }>(() => ({
  metrics: { fps: null, frameMs: null, drawCalls: null, triangles: null, geometries: null, textures: null, jsHeapBytes: null, rendererBytes: null, sampledAt: 0, readyMs: null }, traces: [], panel: false,
}));
let sequence = 0;
export function beginTrace(input: string, origin: Trace['origin']) {
  const trace: Trace = { id: ++sequence, input: input.slice(0, 400), origin, started: performance.now(), steps: [{ stage: 'received', ms: 0, detail: 'Instrucción recibida en este dispositivo.' }] };
  useTelemetry.setState(s => ({ traces: [...s.traces, trace].slice(-24) }));
  return trace.id;
}
export function traceStep(id: number, stage: Stage, detail: string, patch: Partial<Pick<Trace, 'origin' | 'action' | 'changes'>> = {}) {
  useTelemetry.setState(s => ({ traces: s.traces.map(t => t.id === id ? { ...t, ...patch, steps: [...t.steps, { stage, ms: Math.max(0, performance.now() - t.started), detail: detail.slice(0, 500) }].slice(-12) } : t) }));
}
export function stateChanges(before: Progress, after: Progress): Trace['changes'] {
  const fields = (p: Progress) => ({ cell: p.cell, installed: p.installed, power: p.power, door: p.door, complete: p.complete, dials: p.story.dials, labSolved: p.story.labSolved, archiveVerified: p.story.archiveVerified, stance: p.story.stance, protocol: p.story.protocol, documents: p.story.documents, hints: p.story.stats.hints, mistakes: p.story.stats.mistakes });
  const a = fields(before), b = fields(after);
  return Object.fromEntries((Object.keys(a) as (keyof typeof a)[]).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])).map(k => [k, { before: a[k], after: b[k] }]));
}
export function clearTraces() { useTelemetry.setState({ traces: [] }); }
