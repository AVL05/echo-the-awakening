export type GraphicsTier = 'low' | 'laptop' | 'medium' | 'high';
export type Quality = 'auto' | GraphicsTier;

export const GRAPHICS = {
  low: { dpr: 0.8, pixels: 850000, shadowSize: 0, particles: 36, beams: false, detail: false },
  laptop: { dpr: 1, pixels: 1200000, shadowSize: 512, particles: 72, beams: false, detail: false },
  medium: { dpr: 1.15, pixels: Infinity, shadowSize: 1024, particles: 160, beams: true, detail: true },
  high: { dpr: 1.65, pixels: Infinity, shadowSize: 1536, particles: 320, beams: true, detail: true },
} as const;

export const QUALITY_LABELS = { low: 'Bajo · Rendimiento', laptop: 'Portátil', medium: 'Medio', high: 'Alto' };
export const PERFORMANCE_BUDGETS = [
  { shadowHz: 8, particles: 1 }, { shadowHz: 4, particles: 0.5 }, { shadowHz: 2, particles: 0.25 },
] as const;

export function frameBudget(tier: GraphicsTier, phase: string, inferenceBusy: boolean, hidden = false) {
  if (hidden || ['paused', 'technical', 'complete'].includes(phase)) return 0;
  if (inferenceBusy) return 10;
  if (['intro', 'terminal', 'document', 'journal', 'valve', 'mechanism', 'inventory'].includes(phase)) return 30;
  return tier === 'low' || tier === 'laptop' ? 60 : 0;
}

export function renderDpr(tier: GraphicsTier, width: number, height: number, deviceDpr: number, scale: number) {
  const profile = GRAPHICS[tier];
  return Math.min(deviceDpr, profile.dpr, Math.sqrt(profile.pixels / Math.max(1, width * height))) * scale;
}

export function framePercentile(samples: readonly number[], percentile = 0.95): number | null {
  if (!samples.length) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * percentile) - 1)];
}

// Reduce pixels first, then shadow frequency and dust; restore detail before adding pixels.
export function adaptResolution(scale: number, mean: number, p95: number, windows: number, level = 0) {
  const slow = mean > 18.5 || p95 > 25, fast = mean < 17 && p95 < 20;
  const next = slow ? Math.min(0, windows) - 1 : fast ? Math.max(0, windows) + 1 : 0;
  if (next <= -2) return { scale: Math.max(0.7, Math.round((scale - 0.1) * 10) / 10), level: scale <= 0.7 ? Math.min(2, level + 1) : level, windows: 0 };
  if (next >= 5) return { scale: level > 0 ? scale : Math.min(1, Math.round((scale + 0.1) * 10) / 10), level: Math.max(0, level - 1), windows: 0 };
  return { scale, level, windows: next };
}

export function damp(current: number, target: number, response: number, dt: number) {
  return target + (current - target) * Math.exp(-response * dt);
}
