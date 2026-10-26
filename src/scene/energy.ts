import { AdditiveBlending, DoubleSide, MeshBasicNodeMaterial } from 'three/webgpu';
import { color, sin, uniform, uv } from 'three/tsl';

export function createEnergyField() {
  const clock = uniform(0), power = uniform(0.3);
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending });
  material.name = 'ECHO / TSL containment bands';
  const bands = sin(uv().y.mul(115).sub(clock.mul(3))).mul(0.5).add(0.5).pow(14);
  material.colorNode = color('#b3d6c8').mul(power.mul(0.5).add(0.7));
  material.opacityNode = bands.mul(power).mul(0.42);
  return { material, update: (time: number, intensity: number) => { clock.value = time; power.value = intensity; } };
}
