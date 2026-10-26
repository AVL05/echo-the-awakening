import type { Progress } from './progress';

export const SPAWN = [0, 1.7, 10] as const;
export const INTERACT_DISTANCE = 3.1;
export const OBJECTS = {
  cell: [-5.5, 1.25, 1.5],
  relay: [5.8, 1.55, -1.5],
  terminal: [0, 1.5, -4.5],
  door: [0, 1.8, -11.7],
} as const;

// Static architecture only: use Rapier when dynamic bodies become part of the game.
export function canMove(x: number, z: number, progress: Progress): boolean {
  const r = 0.28;
  if (Math.abs(x) > 8.4 - r || z > 12.4 - r || z < -66 + r) return false;
  if (z < -11.35 && z > -17.65 && (!progress.door || Math.abs(x) > 1.55 - r)) return false;
  if (z <= -17.65 && !progress.door) return false;
  if (z < -36.35 && z > -41.65 && (!progress.story.labSolved || Math.abs(x) > 1.55 - r)) return false;
  if (z <= -41.65 && !progress.story.labSolved) return false;
  if (z < -60.35 && (progress.story.protocol === 'none' || Math.abs(x) > 1.55 - r)) return false;
  const obstacles = [
    [-3.1, 3.1, -2.7, 3.1], // reactor base and side supports
    [-6.35, -4.65, 0.65, 2.35], // cell pedestal
    [5.1, 6.5, -2.25, -0.75], // relay
    [-1.65, 1.65, -5.2, -3.9], // terminal
    [-8.5, -7.0, -9, -4], [7.0, 8.5, -9, -4], // equipment racks
    [-2.2, 2.2, -29, -25], // laboratory workbench
    [3.25, 5.75, -33.15, -31.85], // laboratory terminal
    [-2.4, 2.4, -51.4, -46.6], // memory core
    [-1.4, 1.4, -45.15, -43.85], // core terminal
    ...[-22, -27, -32].map(z => [-8.2, -6.3, z - 0.8, z + 0.8]),
    [6.1, 7.3, 5.8, 7], [-7, -5.8, -7.1, -5.9],
    [-6.1, -4.9, -21.1, -19.9], [5, 6.2, -24.6, -23.4], [5, 6.2, -29.6, -28.4],
    [-6.6, -5.4, -47.6, -46.4], [5.4, 6.6, -56.4, -55.2],
  ];
  return !obstacles.some(([x1, x2, z1, z2]) => x > x1 - r && x < x2 + r && z > z1 - r && z < z2 + r);
}
