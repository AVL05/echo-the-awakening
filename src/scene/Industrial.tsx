import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BufferGeometry, CanvasTexture, CatmullRomCurve3, CylinderGeometry, DoubleSide, Group, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Points, RepeatWrapping, SRGBColorSpace, TubeGeometry, Vector3, type Material } from 'three';
import { UNIT_BOX } from './materials';
import { useGame } from '../game/store';
import { isSceneVisible } from './visibility';
import { GRAPHICS } from '../game/graphics';

type V3 = [number, number, number];
export type BoxInstance = { position: V3; size: V3; rotation?: V3 };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function BoxInstances({ items, color = '#4d5755', metal = 0.7, roughness = 0.48, glow, shadow = false }: {
  items: BoxInstance[]; color?: string; metal?: number; roughness?: number; glow?: string; shadow?: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  const material = useMemo(() => new MeshStandardMaterial({ color, metalness: metal, roughness, emissive: glow ?? '#000000', emissiveIntensity: glow ? 2.2 : 0 }), [color, metal, roughness, glow]);
  useLayoutEffect(() => {
    const transform = new Object3D();
    items.forEach((item, i) => {
      transform.position.set(...item.position); transform.scale.set(...item.size); transform.rotation.set(...(item.rotation ?? [0, 0, 0])); transform.updateMatrix();
      ref.current!.setMatrixAt(i, transform.matrix);
    });
    ref.current!.instanceMatrix.needsUpdate = true; ref.current!.computeBoundingSphere();
  }, [items, material]);
  useEffect(() => () => { material.dispose(); }, [material]);
  useEffect(() => { const mesh = ref.current; return () => { mesh?.dispose(); }; }, [material, items.length]);
  return <instancedMesh ref={ref} args={[UNIT_BOX, material, items.length]} castShadow={shadow} receiveShadow dispose={null} />;
}

function Cable({ points, radius = 0.045, color = '#1e282a' }: { points: V3[]; radius?: number; color?: string }) {
  const geometry = useMemo(() => new TubeGeometry(new CatmullRomCurve3(points.map(p => new Vector3(...p))), 40, radius, 5, false), [points, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry}><meshStandardMaterial color={color} metalness={0.4} roughness={0.7} /></mesh>;
}

function Fan({ side, z }: { side: number; z: number }) {
  const rotor = useRef<Group>(null);
  const powered = useGame(s => s.progress.power);
  const blades = useMemo<BoxInstance[]>(() => Array.from({ length: 7 }, (_, i) => {
    const a = i * Math.PI * 2 / 7;
    return { position: [Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0], size: [0.7, 0.2, 0.04], rotation: [0.4, 0, a + 0.3] };
  }), []);
  useFrame((_, dt) => { if (rotor.current && isSceneVisible(rotor.current) && !reduced && useGame.getState().phase !== 'paused') rotor.current.rotation.z += dt * (powered ? 2.1 : 0.22); });
  return <group position={[side * 8.48, 4.65, z]} rotation={[0, -side * Math.PI / 2, 0]}>
    <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.88, 0.88, 0.15, 32]} /><meshStandardMaterial color="#101c23" roughness={0.7} /></mesh>
    <mesh><torusGeometry args={[0.83, 0.09, 8, 36]} /><meshStandardMaterial color="#626d65" metalness={0.8} roughness={0.4} /></mesh>
    <group ref={rotor}><BoxInstances items={blades} color="#60706d" /><mesh><sphereGeometry args={[0.17, 12, 8]} /><meshStandardMaterial color="#252f30" metalness={0.8} roughness={0.3} /></mesh></group>
    <BoxInstances color="#2f3a3b" items={Array.from({ length: 9 }, (_, i) => ({ position: [(i - 4) * 0.17, 0, 0.15], size: [0.018, 1.5, 0.018] }))} />
  </group>;
}

function Screen({ position, rotation }: { position: V3; rotation: V3 }) {
  const power = useGame(s => s.progress.power);
  const scan = useRef<Mesh>(null);
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#061317'; ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = power ? '#a2cdb9' : '#bd9d74'; ctx.font = '18px Consolas';
    ctx.fillText('LAZARUS / CONTAINMENT ARRAY', 26, 35);
    ctx.font = '12px Consolas'; ctx.fillText(power ? 'MAIN GRID: ONLINE' : 'AUXILIARY / STANDBY', 26, 61);
    ctx.strokeStyle = power ? '#70bca5' : '#947e5b'; ctx.lineWidth = 1.5;
    for (let row = 0; row < 3; row++) {
      ctx.beginPath();
      for (let x = 25; x < 480; x++) {
        const y = 100 + row * 42 + Math.sin(x * 0.08 + row) * (power ? 10 : 3) + Math.sin(x * 0.21) * 3;
        if (x === 25) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 10; i++) { ctx.fillStyle = i < (power ? 10 : 2) ? '#83b49d' : '#253a3d'; ctx.fillRect(26 + i * 46, 222, 35, 5); }
    const map = new CanvasTexture(canvas); map.colorSpace = SRGBColorSpace; return map;
  }, [power]);
  useEffect(() => () => texture.dispose(), [texture]);
  useFrame(({ clock }) => { if (scan.current && isSceneVisible(scan.current) && !reduced && useGame.getState().phase !== 'paused') scan.current.position.y = Math.sin(clock.elapsedTime * 0.65) * 0.52; });
  return <group position={position} rotation={rotation}>
    <BoxInstances items={[{ position: [0, 0, 0], size: [2.35, 1.4, 0.16] }]} color="#17232a" />
    <mesh position={[0, 0, 0.09]}><planeGeometry args={[2.1, 1.12]} /><meshBasicMaterial map={texture} toneMapped={false} /></mesh>
    <mesh ref={scan} position={[0, 0, 0.1]}><planeGeometry args={[2.07, 0.008]} /><meshBasicMaterial color="#92cbb6" transparent opacity={0.2} depthWrite={false} /></mesh>
  </group>;
}

export function ReactorField() {
  const { gl } = useThree();
  const mesh = useRef<Mesh>(null);
  const update = useRef<((time: number, intensity: number) => void) | null>(null);
  const intensity = useRef(0.2), timeline = useRef(0);
  const geometry = useMemo(() => new CylinderGeometry(0.94, 0.94, 2.3, 48, 1, true), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const fallback = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 16); gradient.addColorStop(0, '#000'); gradient.addColorStop(0.5, '#fff'); gradient.addColorStop(1, '#000');
    for (let y = 0; y < 256; y += 16) { ctx.save(); ctx.translate(0, y); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 32, 16); ctx.restore(); }
    const alpha = new CanvasTexture(canvas); alpha.wrapS = alpha.wrapT = RepeatWrapping;
    const material = new MeshBasicMaterial({ color: '#9cbfae', alphaMap: alpha, transparent: true, opacity: 0.14, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
    material.name = 'ECHO / raster containment bands';
    return { material, alpha };
  }, []);
  useEffect(() => {
    let active = true, nodeMaterial: Material | undefined;
    if ('isWebGPURenderer' in gl) void import('./energy').then(({ createEnergyField }) => {
      if (!active || !mesh.current) return;
      const energy = createEnergyField(); nodeMaterial = energy.material; mesh.current.material = energy.material; update.current = energy.update;
    }).catch(error => console.warn('ECHO energy: using raster fallback', error));
    return () => { active = false; update.current = null; nodeMaterial?.dispose(); fallback.material.dispose(); fallback.alpha.dispose(); };
  }, [gl, fallback]);
  useFrame((_, dt) => {
    const s = useGame.getState(); if (!isSceneVisible(mesh.current) || s.phase === 'paused') return;
    intensity.current += ((s.progress.power ? 0.85 : 0.17) - intensity.current) * Math.min(dt, 0.05) * 1.5;
    if (!reduced) timeline.current += Math.min(dt, 0.05);
    update.current?.(timeline.current, intensity.current);
    fallback.alpha.offset.y = timeline.current * 0.08; fallback.material.opacity = intensity.current * 0.32;
  });
  return <mesh ref={mesh} position={[0, 3.3, 0.2]} geometry={geometry} material={fallback.material} dispose={null} raycast={() => {}} />;
}

export function AtmosphericDust() {
  const tier = useGame(s => s.tier);
  const ref = useRef<Points>(null);
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    const positions = new Float32Array(320 * 3);
    for (let i = 0; i < 320; i++) {
      positions[i * 3] = Math.sin(i * 78.233) * 8;
      positions[i * 3 + 1] = 0.4 + ((i * 13.37) % 6.5);
      positions[i * 3 + 2] = Math.cos(i * 31.7) * 11;
    }
    return g.setFromPoints(Array.from({ length: 320 }, (_, i) => new Vector3().fromArray(positions, i * 3)));
  }, []);
  useEffect(() => { geometry.setDrawRange(0, GRAPHICS[tier].particles); }, [geometry, tier]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, dt) => { if (ref.current && isSceneVisible(ref.current) && !reduced && useGame.getState().phase !== 'paused') ref.current.rotation.y += dt * 0.005; });
  return <points ref={ref} geometry={geometry} raycast={() => {}}><pointsMaterial color="#cbbd99" size={0.025} sizeAttenuation transparent opacity={0.38} depthWrite={false} /></points>;
}

export default function Industrial() {
  const architecture = useMemo(() => {
    const ribs: BoxInstance[] = [], panels: BoxInstance[] = [], grates: BoxInstance[] = [], bolts: BoxInstance[] = [], trim: BoxInstance[] = [];
    for (const side of [-1, 1]) {
      for (let z = -10; z <= 10; z += 4) {
        panels.push({ position: [side * 8.65, 2.5, z], size: [0.12, 3.65, 3.62] });
        ribs.push({ position: [side * 8.28, 3.45, z - 1.95], size: [0.48, 6.9, 0.26] });
        ribs.push({ position: [side * 7.5, 6.4, z - 1.95], size: [0.26, 2.9, 0.32], rotation: [0, 0, -side * 0.78] });
        trim.push({ position: [side * 8.55, 0.7, z], size: [0.12, 0.08, 3.45] });
        for (const y of [1, 4]) for (const dz of [-1.5, 1.5]) bolts.push({ position: [side * 8.55, y, z + dz], size: [0.1, 0.1, 0.1] });
        for (let i = 0; i < 10; i++) grates.push({ position: [side * 8.49, 1.3 + i * 0.11, z], size: [0.08, 0.032, 2.6] });
      }
      for (let z = -10; z < 12; z += 0.45) {
        grates.push({ position: [side * 7.35, 0.035, z], size: [1.35, 0.045, 0.035] });
        grates.push({ position: [side * 5.25, 6.8, z], size: [1.65, 0.06, 0.04] });
      }
      ribs.push({ position: [side * 7.35, 0.04, 0], size: [1.55, 0.06, 24] });
      ribs.push({ position: [side * 4.3, 6.75, 0], size: [0.15, 0.3, 25] });
      ribs.push({ position: [side * 6.16, 6.75, 0], size: [0.15, 0.3, 25] });
      for (let z = -10; z <= 10; z += 2) trim.push({ position: [side * 3.55, 0.017, z], size: [0.22, 0.015, 0.065], rotation: [0, -side * 0.6, 0] });
    }
    for (let z = -9; z < 12; z += 5) {
      ribs.push({ position: [0, 7, z], size: [15, 0.18, 0.14] });
      for (let x = -6; x <= 6; x += 1.5) ribs.push({ position: [x, 7.28, z], size: [1.7, 0.08, 0.12], rotation: [0, 0, (x % 3 === 0 ? 1 : -1) * 0.3] });
    }
    return { ribs, panels, grates, bolts, trim };
  }, []);
  const cables = useMemo(() => {
    const list: { points: V3[]; radius: number; color: string }[] = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) list.push({ points: [[side * (7.0 + i * 0.15), 6.4, 12], [side * (6.8 + i * 0.16), 6.1, 4], [side * (7.0 + i * 0.16), 6.25, -4], [side * (7.2 + i * 0.15), 6.5, -12]], radius: 0.035 + i * 0.012, color: i === 1 ? '#665744' : '#1a2529' });
      list.push({ points: [[side * 8.4, 5.6, 3], [side * 7.9, 4, 3.1], [side * 8.1, 1.5, 2.5], [side * 7.9, 0.09, 4], [side * 6.9, 0.09, 6], [side * 7.9, 0.12, 9]], radius: 0.065, color: '#323d38' });
      list.push({ points: [[side * 8.4, 5.9, -3], [side * 7.5, 5.5, -2], [side * 6, 5.6, -1], [side * 2.8, 5.5, 0.2]], radius: 0.075, color: '#3b4140' });
    }
    return list;
  }, []);
  return <>
    <BoxInstances items={architecture.ribs} color="#3e4c50" roughness={0.44} shadow />
    <BoxInstances items={architecture.panels} color="#535e5c" metal={0.45} roughness={0.7} />
    <BoxInstances items={architecture.grates} color="#75817b" roughness={0.32} />
    <BoxInstances items={architecture.bolts} color="#a2a391" metal={0.85} roughness={0.3} />
    <BoxInstances items={architecture.trim} color="#8b7757" metal={0.5} roughness={0.6} />
    {cables.map((c, i) => <Cable key={i} {...c} />)}
    {[-1, 1].map(side => <group key={side}><Fan side={side} z={-5.5} /><Fan side={side} z={6.5} /><PracticalLight position={[side * 8.34, 5.95, 3]} />
      <Screen position={[side * 8.43, 3.35, 1]} rotation={[0, -side * Math.PI / 2, 0]} />
      <Screen position={[side * 5.3, 5.6, -11.6]} rotation={[0, 0, 0]} />
    </group>)}
  </>;
}

function PracticalLight({ position }: { position: V3 }) {
  const mesh = useRef<Mesh>(null);
  const ref = useRef<MeshBasicMaterial>(null), time = useRef(0);
  useFrame((_, dt) => {
    const s = useGame.getState(); if (!isSceneVisible(mesh.current) || s.phase === 'paused') return;
    time.current += Math.min(dt, 0.05);
    if (ref.current) ref.current.opacity = s.progress.power || reduced ? 0.85 : 0.35 + Math.max(0, Math.sin(time.current * 1.3)) * 0.5;
  });
  return <mesh ref={mesh} position={position}><boxGeometry args={[0.1, 0.12, 2.8]} /><meshBasicMaterial ref={ref} color="#b19b72" transparent opacity={0.7} /></mesh>;
}
