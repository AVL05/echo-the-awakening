import { create } from 'zustand';

export type Capability = { status: 'unchecked' | 'checking' | 'available' | 'unavailable'; reason: string; ramGB?: number; freeBytes?: number };
export const useCapabilities = create<Capability>(() => ({ status: 'unchecked', reason: 'Comprobación local pendiente. No se descarga ningún archivo.' }));
type Environment = { secure: boolean; worker: boolean; cache: boolean; navigator: Pick<Navigator, 'gpu' | 'storage'> & { deviceMemory?: number } };
export async function detectCapabilities(env: Environment): Promise<Capability> {
  const unavailable = (reason: string): Capability => ({ status: 'unavailable', reason });
  if (!env.secure) return unavailable('La IA necesita HTTPS o localhost. El juego determinista sigue disponible.');
  if (!env.worker || !env.cache) return unavailable('Web Workers o Cache API no están disponibles. Puedes jugar sin IA.');
  if (!env.navigator.gpu) return unavailable('Este navegador no ofrece WebGPU. El renderizado WebGL 2 y el modo sin IA siguen disponibles.');
  if (env.navigator.deviceMemory !== undefined && env.navigator.deviceMemory < 4) return unavailable('El dispositivo informa menos de 4 GB de RAM. Se mantiene el modo determinista.');
  const adapter = await env.navigator.gpu.requestAdapter();
  if (!adapter?.features.has('shader-f16') || adapter.limits.maxStorageBufferBindingSize < 128 * 1024 * 1024) return unavailable('La GPU no ofrece shader-f16 y buffers de 128 MiB requeridos por este modelo.');
  const storage = await env.navigator.storage?.estimate();
  const freeBytes = storage?.quota === undefined ? undefined : storage.quota - (storage.usage ?? 0);
  if (freeBytes !== undefined && freeBytes < 360 * 1024 * 1024) return unavailable('No se verifican 360 MiB libres para una descarga nueva. Libera espacio y vuelve a comprobar.');
  return { status: 'available', reason: 'Requisitos básicos comprobados. La carga aún puede fallar por memoria o por el controlador; puedes cancelar y seguir sin IA.', ramGB: env.navigator.deviceMemory, freeBytes };
}
let checking: Promise<void> | undefined;
export function checkCapabilities() {
  if (checking) return checking;
  useCapabilities.setState({ status: 'checking', reason: 'Comprobando GPU, Worker y almacenamiento local…' });
  checking = (async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([detectCapabilities({ secure: window.isSecureContext, worker: typeof Worker !== 'undefined', cache: typeof caches !== 'undefined', navigator }), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('La comprobación de GPU tardó demasiado. Puedes reintentar o jugar sin IA.')), 5000); })]);
      useCapabilities.setState(result);
    } catch (error) { useCapabilities.setState({ status: 'unavailable', reason: error instanceof Error ? error.message : 'No se pudieron comprobar los requisitos. Continúa sin IA.' }); }
    finally { clearTimeout(timer); checking = undefined; }
  })();
  return checking;
}
