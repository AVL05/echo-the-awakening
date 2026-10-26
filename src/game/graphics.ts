export type GraphicsTier = 'low' | 'medium' | 'high';
export type Quality = 'auto' | GraphicsTier;

export const GRAPHICS = {
  low: { dpr: 0.8, shadowSize: 0, particles: 60, beams: false },
  medium: { dpr: 1.15, shadowSize: 1024, particles: 160, beams: true },
  high: { dpr: 1.65, shadowSize: 1536, particles: 320, beams: true },
} as const;

export function adaptQuality(tier: GraphicsTier, fps: number, fastWindows: number): { tier: GraphicsTier; fastWindows: number } {
  if (fps < 38) return { tier: tier === 'high' ? 'medium' : 'low', fastWindows: 0 };
  if (fps < 57) return { tier, fastWindows: 0 };
  if (fastWindows < 2) return { tier, fastWindows: fastWindows + 1 };
  return { tier: tier === 'low' ? 'medium' : 'high', fastWindows: 0 };
}

export function damp(current: number, target: number, response: number, dt: number) {
  return target + (current - target) * Math.exp(-response * dt);
}
