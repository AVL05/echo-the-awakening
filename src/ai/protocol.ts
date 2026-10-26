import type { Progress } from '../game/progress';

export type MemoryTurn = { user: string; assistant: string };
export type WorkerRequest = { id: number; type: 'load' | 'clear' } | { id: number; type: 'generate'; input: string; context: Progress; history: MemoryTurn[] };
export type WorkerResponse = { id: number; type: 'progress'; progress: number; cached?: boolean; message?: string } | { id: number; type: 'ready' | 'cleared' } | { id: number; type: 'result'; raw: string; elapsedMs: number; finishReason: string; tokens: number } | { id: number; type: 'error'; message: string; unsupported?: boolean };
