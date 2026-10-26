import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { echoAi, useEchoAi } from '../src/ai/controller';
import { useGame } from '../src/game/store';
import { INITIAL } from '../src/game/progress';
import { useCapabilities } from '../src/ai/capabilities';
import { INFERENCE_TIMEOUT_MS, LOAD_TIMEOUT_MS } from '../src/ai/model';
import type { WorkerRequest, WorkerResponse } from '../src/ai/protocol';

class TestWorker {
  static instances: TestWorker[] = [];
  onmessage: ((event: { data: WorkerResponse }) => void) | null = null;
  onerror: ((event: { preventDefault: () => void }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  requests: WorkerRequest[] = [];
  terminated = false;
  constructor() { TestWorker.instances.push(this); }
  postMessage(request: WorkerRequest) { this.requests.push(request); }
  terminate() { this.terminated = true; }
  reply(response: Omit<Extract<WorkerResponse, { type: 'result' }>, 'id'> | { type: 'ready' }) {
    this.onmessage?.({ data: { ...response, id: this.requests.at(-1)!.id } });
  }
}

beforeEach(() => {
  echoAi.stop(); vi.stubGlobal('Worker', TestWorker); TestWorker.instances = [];
  useGame.setState({ phase: 'terminal', progress: { ...INITIAL } });
  useEchoAi.setState({ status: 'off', history: [], diagnostics: [] });
  useCapabilities.setState({ status: 'available', reason: 'Controlled capability fixture.' });
});
afterEach(() => { echoAi.stop(); vi.unstubAllGlobals(); vi.useRealTimers(); });

async function ready() {
  const loading = echoAi.load();
  const worker = TestWorker.instances.at(-1)!; worker.reply({ type: 'ready' }); await loading;
  return worker;
}

describe('worker lifecycle and game authority (mock transport, not real inference)', () => {
  it('releases the real runtime interface and blocks new inference after the erase protocol', async () => {
    const worker = await ready();
    const p = useGame.getState().progress;
    useGame.setState({ progress: { ...p, story: { ...p.story, protocol: 'erase' } } });
    expect(worker.terminated).toBe(true);
    expect(useEchoAi.getState().status).toBe('off');
    await expect(echoAi.interpret('¿Sigues ahí?')).rejects.toThrow('aislada');
    await echoAi.load();
    expect(TestWorker.instances).toHaveLength(1);
  });
  it('rejects simultaneous inference and cancelling discards the active operation', async () => {
    await ready();
    const first = echoAi.interpret('Abre la puerta');
    await expect(echoAi.interpret('Activa el reactor')).rejects.toThrow('Cancela');
    echoAi.stop();
    expect(await first).toBeNull();
    expect(useGame.getState().progress.door).toBe(false);
  });
  it('accepts each pending proposal only once', async () => {
    useGame.setState({ progress: { ...INITIAL, cell: true, installed: true } });
    const result = await echoAi.interpret('Activa el reactor');
    expect(echoAi.confirm(result!.proposal!).ok).toBe(true);
    expect(() => echoAi.confirm(result!.proposal!)).toThrow('caducado');
  });
  it('invalidates a pending proposal when discarding, releasing or reloading the model', async () => {
    useGame.setState({ progress: { ...INITIAL, cell: true, installed: true } });
    const first = await echoAi.interpret('Activa el reactor');
    echoAi.discard();
    expect(() => echoAi.confirm(first!.proposal!)).toThrow('caducado');
    const released = await echoAi.interpret('Activa el reactor');
    echoAi.stop();
    expect(() => echoAi.confirm(released!.proposal!)).toThrow('caducado');
    const second = await echoAi.interpret('Activa el reactor');
    await ready();
    expect(() => echoAi.confirm(second!.proposal!)).toThrow('caducado');
    expect(useGame.getState().progress.power).toBe(false);
  });
  it('does not create a Worker or download until explicitly enabled', async () => {
    const reply = await echoAi.interpret('¿Dónde está la celda?');
    expect(TestWorker.instances).toHaveLength(0);
    expect(reply?.origin).toBe('deterministic');
    expect(reply?.result?.text).toContain('ala izquierda');
  });
  it('discards late completions and terminates on terminal close', async () => {
    const worker = await ready();
    const reply = echoAi.interpret('Abre la puerta');
    useGame.setState({ phase: 'playing' });
    expect(await reply).toBeNull();
    expect(worker.terminated).toBe(true);
    worker.reply({ type: 'result', raw: '{"reply":"Abierto","actions":[]}', finishReason: 'stop', tokens: 10, elapsedMs: 1 });
    expect(useGame.getState().progress.door).toBe(false);
    expect(useEchoAi.getState().status).toBe('off');
  });
  it('times out loading and releases the worker without changing progress', async () => {
    vi.useFakeTimers();
    const loading = echoAi.load();
    await vi.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS + 1); await loading;
    expect(TestWorker.instances[0].terminated).toBe(true);
    expect(useEchoAi.getState().status).toBe('error');
    expect(useGame.getState().progress).toEqual(INITIAL);
  });
  it('falls back honestly when model output is invalid', async () => {
    const worker = await ready();
    const request = echoAi.interpret('Abre la puerta');
    worker.reply({ type: 'result', raw: '{"reply":"Hecho","actions":[{"name":"teleport"}]}', finishReason: 'stop', tokens: 30, elapsedMs: 5 });
    const reply = await request;
    expect(reply?.origin).toBe('deterministic');
    expect(reply?.result?.ok).toBe(false);
    expect(useGame.getState().progress.door).toBe(false);
    expect(worker.terminated).toBe(true);
  });
  it('terminates a stalled inference and falls back without applying a proposal', async () => {
    const worker = await ready(); vi.useFakeTimers();
    const request = echoAi.interpret('Abre la compuerta');
    await vi.advanceTimersByTimeAsync(INFERENCE_TIMEOUT_MS + 1);
    const reply = await request;
    expect(reply?.origin).toBe('deterministic');
    expect(useGame.getState().progress.door).toBe(false);
    expect(worker.terminated).toBe(true);
    expect(useEchoAi.getState().status).toBe('error');
  });
  it('revalidates confirmed proposals against current state', async () => {
    useGame.setState({ progress: { ...INITIAL, cell: true, installed: true, power: true } });
    const worker = await ready();
    const request = echoAi.interpret('Abre la compuerta');
    worker.reply({ type: 'result', raw: '{"reply":"Solicitaré apertura.","actions":[{"name":"open_door","target":"door","source":"none","destination":"none"}]}', finishReason: 'stop', tokens: 30, elapsedMs: 5 });
    const reply = await request;
    expect(reply?.proposal?.name).toBe('open_door');
    expect(useGame.getState().progress.door).toBe(false);
    useGame.setState({ progress: { ...useGame.getState().progress, power: false } });
    expect(echoAi.confirm(reply!.proposal!).ok).toBe(false);
    expect(useGame.getState().progress.door).toBe(false);
  });
  it('bounds memory to three turns/eight traces and clears it on game reset', async () => {
    for (let i = 0; i < 12; i++) await echoAi.interpret('Estado');
    expect(useEchoAi.getState().history).toHaveLength(3);
    expect(useEchoAi.getState().diagnostics).toHaveLength(8);
    useGame.setState({ phase: 'intro', progress: { ...INITIAL } });
    expect(useEchoAi.getState().history).toEqual([]);
    expect(useEchoAi.getState().diagnostics).toEqual([]);
  });
});
