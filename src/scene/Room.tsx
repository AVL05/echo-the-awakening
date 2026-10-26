import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BackSide, CanvasTexture, DoubleSide, Group, Mesh, MeshStandardMaterial, PointLight, SpriteMaterial, type Texture } from 'three';
import { useGame } from '../game/store';
import { labelTexture, reflectionEnvironment, surfaceDetails, surfaceTexture, sharedFloor, disposeSharedFloor, UNIT_BOX } from './materials';
import Industrial, { AtmosphericDust, BoxInstances, ReactorField, type BoxInstance } from './Industrial';
import { isSceneVisible } from './visibility';
import { GRAPHICS } from '../game/graphics';

type Position = [number, number, number];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const boxMaterials = new Map<string, MeshStandardMaterial>();
export function Box({ position, size, color = '#252e30', metal = 0.65, rough = 0.65, rotation = [0, 0, 0], glow, map, bump, roughMap }: {
  position: Position; size: Position; color?: string; metal?: number; rough?: number; rotation?: Position; glow?: string; map?: Texture; bump?: Texture; roughMap?: Texture;
}) {
  const key = [color, metal, rough, glow, map?.uuid].join('|');
  if (!boxMaterials.has(key)) boxMaterials.set(key, new MeshStandardMaterial({ color, metalness: metal, roughness: rough, map: map ?? null, bumpMap: bump ?? null, bumpScale: 0.035, roughnessMap: roughMap ?? null, emissive: glow ?? '#000000', emissiveIntensity: glow ? 2.5 : 0 }));
  return <mesh position={position} rotation={rotation} scale={size} geometry={UNIT_BOX} material={boxMaterials.get(key)} castShadow={!glow && Math.min(...size) > 0.12} receiveShadow dispose={null} />;
}

export function Sign({ text, position, size = [2.4, 0.6], color, rotation = [0, 0, 0] }: {
  text: string; position: Position; size?: [number, number]; color?: string; rotation?: Position;
}) {
  const map = useMemo(() => labelTexture(text, color), [text, color]);
  useEffect(() => () => map.dispose(), [map]);
  return <mesh position={position} rotation={rotation}>
    <planeGeometry args={size} /><meshBasicMaterial map={map} transparent depthWrite={false} side={DoubleSide} />
  </mesh>;
}

function Reactor() {
  const core = useRef<Group>(null);
  const ring = useRef<Group>(null);
  const power = useGame(s => s.progress.power);
  const color = power ? '#79e8dc' : '#eab477';
  const halo = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!, gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(0.12, '#ffffffbb'); gradient.addColorStop(0.4, '#ffffff20'); gradient.addColorStop(1, '#ffffff00');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
    return new CanvasTexture(canvas);
  }, []);
  const haloMaterial = useRef<SpriteMaterial>(null);
  useEffect(() => () => halo.dispose(), [halo]);
  const segments = useMemo<BoxInstance[]>(() => Array.from({ length: 32 }, (_, i) => {
    const a = i / 32 * Math.PI * 2;
    return { position: [Math.cos(a) * 2.45, Math.sin(a) * 2.45, 0], size: [0.64, 0.14, 0.72], rotation: [0, 0, a] };
  }), []);
  const insets = useMemo<BoxInstance[]>(() => segments.map(item => ({ ...item, position: [item.position[0], item.position[1], 0.38], size: [0.26, 0.028, 0.025] })), [segments]);
  useFrame(({ clock }, dt) => {
    if (haloMaterial.current) haloMaterial.current.opacity += ((power ? 0.48 : 0.24) - haloMaterial.current.opacity) * Math.min(dt, 0.05) * 2;
    if (!isSceneVisible(core.current) || reducedMotion || useGame.getState().phase === 'paused') return;
    if (core.current) {
      core.current.rotation.y += dt * (power ? 0.38 : 0.09);
      core.current.position.y = 3.3 + Math.sin(clock.elapsedTime * 0.8) * 0.12;
    }
    if (ring.current) ring.current.rotation.z += dt * (power ? 0.1 : 0.015);
  });
  return <group position={[0, 0, 0.2]}>
    <mesh position={[0, 0.22, 0]} receiveShadow><cylinderGeometry args={[2.65, 2.85, 0.44, 64]} /><meshStandardMaterial color="#252e30" metalness={0.8} roughness={0.4} /></mesh>
    <mesh position={[0, 0.45, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[2.45, 0.025, 8, 96]} /><meshBasicMaterial color={color} /></mesh>
    <Box position={[0, 0.7, 0]} size={[1.7, 0.5, 1.7]} color="#323b3b" />
    {[-1, 1].map(side => <group key={side}>
      <Box position={[side * 2.75, 1.75, 0]} size={[0.65, 3.5, 1.2]} color="#39413f" />
      <Box position={[side * 2.77, 2, 0.63]} size={[0.15, 2.5, 0.04]} glow={color} />
      <Box position={[side * 1.8, 0.8, 0]} size={[0.4, 2, 0.6]} rotation={[0, 0, side * -0.75]} />
    </group>)}
    <group position={[0, 3.3, 0]}>
      <mesh castShadow><torusGeometry args={[2.45, 0.26, 12, 96]} /><meshStandardMaterial color="#58605b" metalness={0.78} roughness={0.32} /></mesh>
      <mesh position={[0, 0, 0.14]}><torusGeometry args={[2.2, 0.025, 8, 96]} /><meshBasicMaterial color={color} /></mesh>
      <mesh position={[0, 0, -0.3]}><torusGeometry args={[2.6, 0.07, 8, 96]} /><meshStandardMaterial color="#20282a" metalness={0.8} roughness={0.4} /></mesh>
      <group ref={ring}><BoxInstances items={segments} color="#38494b" shadow /><BoxInstances items={insets} color={color} glow={color} /></group>
      {[0, 1, 2, 3].map(i => <group key={i} rotation={[0, 0, i * Math.PI / 2 + 0.07]}>
        <mesh position={[0, 0, -0.3]}><torusGeometry args={[2.72, 0.13, 8, 24, Math.PI * 0.42]} /><meshStandardMaterial color="#708078" metalness={0.88} roughness={0.3} /></mesh>
        <mesh position={[0, 0, -0.42]}><torusGeometry args={[2.88, 0.04, 6, 24, Math.PI * 0.42]} /><meshStandardMaterial color="#a89470" metalness={0.75} roughness={0.45} /></mesh>
      </group>)}
    </group>
    <group ref={core} position={[0, 3.3, 0]}>
      <mesh><icosahedronGeometry args={[0.65, 2]} /><meshStandardMaterial color="#b9c9b0" metalness={0.75} roughness={0.12} emissive={color} emissiveIntensity={power ? 2 : 0.55} /></mesh>
      <mesh rotation={[0.4, 0, 0.3]}><icosahedronGeometry args={[1.1, 1]} /><meshBasicMaterial color={color} wireframe transparent opacity={0.4} /></mesh>
      {[0, 1, 2].map(i => <mesh key={i} rotation={[i * 0.8, i * 0.6, 0.3]}><torusGeometry args={[1.35 + i * 0.15, 0.012, 6, 72]} /><meshBasicMaterial color={color} transparent opacity={0.6} /></mesh>)}
    </group>
    <sprite position={[0, 3.3, 0]} scale={[3.8, 3.8, 1]} raycast={() => {}}><spriteMaterial ref={haloMaterial} map={halo} color={power ? '#b7e5d0' : '#efd4a1'} blending={AdditiveBlending} transparent opacity={0.24} depthWrite={false} toneMapped={false} /></sprite>
    <Sign text="L A Z A R U S  /  0 7" position={[0, 0.73, 0.87]} size={[1.4, 0.27]} />
  </group>;
}

function Terminal() {
  const hologram = useRef<Group>(null);
  const power = useGame(s => s.progress.power);
  const isolated = useGame(s => s.progress.story.protocol === 'erase');
  useFrame(({ clock }) => {
    if (!isSceneVisible(hologram.current) || isolated || reducedMotion || useGame.getState().phase === 'paused') return;
    if (hologram.current) hologram.current.rotation.y = Math.sin(clock.elapsedTime * 0.4) * 0.22;
  });
  return <group position={[0, 0, -4.5]}>
    <Box position={[0, 0.6, 0]} size={[2.8, 1.2, 1.0]} color="#263235" />
    <Box position={[0, 1.18, 0.15]} size={[2.5, 0.12, 1]} color="#52615d" rotation={[0.16, 0, 0]} />
    <Box position={[0, 1.28, 0.05]} size={[1.9, 0.025, 0.55]} glow="#4b968e" />
    <mesh position={[0, 1.55, 0]} userData={{ interact: 'terminal' }} visible={false}><boxGeometry args={[2.8, 2, 1.2]} /></mesh>
    <group ref={hologram} visible={!isolated} position={[0, 2.3, 0]}>
      <mesh><icosahedronGeometry args={[0.57, 1]} /><meshBasicMaterial color="#8ceddf" wireframe transparent opacity={0.85} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.8, 0.014, 8, 64]} /><meshBasicMaterial color="#8ceddf" /></mesh>
      <Sign text="E C H O" position={[0, -0.9, 0.1]} size={[1.2, 0.3]} color="#8ceddf" />
    </group>
    <mesh position={[0, 1.8, 0]}><coneGeometry args={[0.7, 1.3, 32, 1, true]} /><meshBasicMaterial color="#6bcdbc" transparent opacity={isolated ? 0 : 0.035} depthWrite={false} side={DoubleSide} blending={AdditiveBlending} /></mesh>
    <pointLight position={[0, 2, 0.3]} intensity={isolated ? 0 : power ? 12 : 6} distance={6} color="#73e8d9" />
  </group>;
}

function Props() {
  const { cell, power } = useGame(s => s.progress);
  const battery = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!isSceneVisible(battery.current) || reducedMotion || useGame.getState().phase === 'paused') return;
    if (battery.current) {
      battery.current.rotation.y = clock.elapsedTime * 0.35;
      battery.current.position.y = 1.55 + Math.sin(clock.elapsedTime * 2) * 0.06;
    }
  });
  return <>
    <group position={[-5.5, 0, 1.5]}>
      <Box position={[0, 0.48, 0]} size={[1.3, 0.96, 1.3]} />
      <Box position={[0, 1, 0]} size={[1.6, 0.14, 1.6]} color="#545b54" />
      <Sign text="01 / RESERVA" position={[0, 0.7, 0.66]} size={[1.05, 0.26]} />
      {!cell && <group ref={battery} position={[0, 1.55, 0]}>
        <mesh userData={{ interact: 'cell' }} castShadow><cylinderGeometry args={[0.18, 0.18, 0.8, 16]} /><meshStandardMaterial color="#c8c8b1" metalness={0.75} roughness={0.25} emissive="#ebae61" emissiveIntensity={0.4} /></mesh>
        {[-0.31, 0, 0.31].map(y => <mesh key={y} position={[0, y, 0]}><torusGeometry args={[0.19, 0.025, 6, 24]} /><meshBasicMaterial color="#ffc27f" /></mesh>)}
        <pointLight color="#ffbb72" intensity={7} distance={4} />
      </group>}
      <Box position={[0, 1.09, 0.7]} size={[1.2, 0.03, 0.025]} glow={cell ? '#365b54' : '#d6a36a'} />
    </group>
    <group position={[5.8, 0, -1.5]}>
      <Box position={[0, 0.95, 0]} size={[1.2, 1.9, 1.2]} color="#39423e" />
      <Box position={[0, 1.52, 0.62]} size={[0.95, 0.65, 0.06]} color="#101c1e" />
      <mesh position={[0, 1.5, 0.7]} userData={{ interact: 'relay' }}><boxGeometry args={[1.2, 1.5, 0.25]} /><meshStandardMaterial color="#152323" transparent opacity={0.15} /></mesh>
      {[0, 1, 2].map(i => <Box key={i} position={[-0.28 + i * 0.28, 1.52, 0.67]} size={[0.12, 0.37, 0.03]} glow={power ? '#7bdec5' : '#ab754b'} />)}
      <Sign text="02 / ENERGÍA" position={[0, 0.9, 0.62]} size={[1.05, 0.26]} />
      <pointLight position={[0, 2, 0.5]} color={power ? '#7bdec5' : '#d9a16b'} intensity={8} distance={4} />
    </group>
    {[-1, 1].map(side => <group key={side} position={[side * 7.8, 0, -6]}>
      {[0, 1, 2].map(i => <group key={i} position={[0, 0, -i * 1.1]}>
        <Box position={[0, 1.5, 0]} size={[1.2, 3, 0.9]} color="#182326" />
        <BoxInstances color="#53605b" items={Array.from({ length: 8 }, (_, n) => ({ position: [-side * 0.62, 0.3 + n * 0.34, 0], size: [0.025, 0.17, 0.65] }))} />
        <BoxInstances color={power ? '#78b8a2' : '#92714e'} glow={power ? '#78b8a2' : '#92714e'} items={Array.from({ length: 8 }, (_, n) => ({ position: [-side * 0.64, 0.3 + n * 0.34, 0.2], size: [0.035, 0.035, 0.1] }))} />
      </group>)}
    </group>)}
    {Array.from({ length: 6 }, (_, i) => <Box key={i} position={[-7.4 + i * 0.34, 0.06, 7 + i * 0.2]} size={[0.13, 0.12, 1.3]} rotation={[0, -0.2, 0]} color="#212829" />)}
  </>;
}

function Door() {
  const left = useRef<Mesh>(null), right = useRef<Mesh>(null);
  const open = useGame(s => s.progress.door);
  const amount = useRef(open ? 1 : 0);
  const set = useGame(s => s.set);
  useFrame((_, dt) => {
    if (!isSceneVisible(left.current) || useGame.getState().phase === 'paused') return;
    amount.current += ((open ? 1 : 0) - amount.current) * Math.min(dt * 1.8, 1);
    if (left.current) left.current.position.x = -0.84 - amount.current * 1.68;
    if (right.current) right.current.position.x = 0.84 + amount.current * 1.68;
  });
  useEffect(() => {
    if (open && useGame.getState().progress.story.zone === 'containment') set({ message: 'Compuerta autorizada. Avanza por el corredor iluminado.' });
  }, [open, set]);
  return <group position={[0, 0, -12]}>
    {[-1, 1].map(side => <group key={side}>
      <Box position={[side * 5.4, 3.8, 0]} size={[7.2, 7.6, 0.65]} color="#515751" metal={0.15} />
      <Box position={[side * 1.95, 2.1, 0.4]} size={[0.25, 4.2, 0.4]} color="#303d3e" />
      <Box position={[side * 1.78, 2.1, 0.64]} size={[0.04, 3.9, 0.03]} glow={open ? '#a0dfcc' : '#cb8f58'} />
    </group>)}
    <Box position={[0, 5.6, 0]} size={[4.2, 3, 0.65]} color="#515751" metal={0.15} />
    {[-1, 1].map(side => <mesh key={side} ref={side < 0 ? left : right} position={[side * 0.84, 2.1, 0]} castShadow>
      <boxGeometry args={[1.68, 4.2, 0.3]} /><meshStandardMaterial color="#394747" metalness={0.65} roughness={0.5} />
      <BoxInstances color="#202e32" items={[-1.3, 0, 1.3].map(y => ({ position: [0, y, 0.18], size: [1.35, 0.76, 0.06] }))} />
      <BoxInstances color="#6a7972" items={[-0.65, 0.65].map(x => ({ position: [x, 0, 0.2], size: [0.075, 3.75, 0.06] }))} />
      <BoxInstances color="#ad956c" items={Array.from({ length: 5 }, (_, i) => ({ position: [-0.5 + i * 0.24, -1.87, 0.18], size: [0.13, 0.2, 0.025], rotation: [0, 0, -0.45] }))} />
    </mesh>)}
    {!open && <mesh position={[0, 1.8, 0.3]} userData={{ interact: 'door' }}><boxGeometry args={[3.2, 3.5, 0.2]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>}
    <Sign text="SECTOR 07" position={[0, 5.0, 0.36]} size={[3.5, 0.8]} />
    <Sign text={open ? 'ACCESO AUTORIZADO' : 'CUARENTENA'} position={[0, 4.4, 0.36]} size={[2, 0.35]} color={open ? '#a0dfcc' : '#c9a47e'} />
    <Box position={[0, 4.03, 0.3]} size={[3.3, 0.16, 0.2]} glow="#e4e4c8" />
    {[-1, 1].map(side => <Box key={side} position={[side * 1.85, 2, -2.5]} size={[0.2, 4, 5]} color="#303f3d" />)}
    <pointLight position={[0, 2.4, -2]} color="#c3e7d3" intensity={35} distance={8} />
  </group>;
}

function ReactiveLighting() {
  const light = useRef<PointLight>(null), sweep = useRef<Mesh>(null);
  const progress = useRef(useGame.getState().progress.power);
  const ramp = useRef(progress.current ? 1 : 0), elapsed = useRef(10), time = useRef(0);
  useFrame((_, delta) => {
    const s = useGame.getState(); if (!isSceneVisible(light.current) || s.phase === 'paused') return;
    const dt = Math.min(delta, 0.05); time.current += dt;
    if (progress.current !== s.progress.power) { progress.current = s.progress.power; elapsed.current = 0; }
    elapsed.current += dt;
    ramp.current += ((s.progress.power ? 1 : 0) - ramp.current) * dt * 1.3;
    if (light.current) light.current.intensity = 22 + ramp.current * 65 + (reducedMotion ? 0 : Math.sin(time.current * 1.1) * 2);
    if (sweep.current) {
      const active = !reducedMotion && s.progress.power && elapsed.current < 4;
      sweep.current.visible = active;
      sweep.current.scale.setScalar(1 + elapsed.current * 3);
      (sweep.current.material as MeshStandardMaterial).opacity = Math.max(0, 0.45 - elapsed.current * 0.13);
    }
  });
  return <>
    <pointLight ref={light} position={[0, 4.3, 0.3]} color="#bbd6c4" intensity={22} distance={17} />
    <mesh ref={sweep} position={[0, 0.035, 0.2]} rotation={[-Math.PI / 2, 0, 0]} visible={false} raycast={() => {}}><ringGeometry args={[0.96, 1.0, 64]} /><meshBasicMaterial color="#c2e4ca" transparent opacity={0.4} depthWrite={false} blending={AdditiveBlending} /></mesh>
  </>;
}

export default function Room() {
  const concrete = useMemo(() => surfaceTexture('concrete'), []);
  const detail = useMemo(sharedFloor, []);
  const floor = detail.map;
  const wallDetail = useMemo(() => surfaceDetails(concrete), [concrete]);
  const environment = useMemo(reflectionEnvironment, []);
  const { scene } = useThree();
  const tier = useGame(s => s.tier);
  const power = useGame(s => s.progress.power);
  const profile = GRAPHICS[tier];
  const floorGuides = useMemo<BoxInstance[]>(() => [-1, 1].flatMap(side => Array.from({ length: 10 }, (_, i) => ({ position: [side * 3.7, 0.014, -10 + i * 2.4], size: [0.055, 0.02, 1.1] }))), []);
  const visibleRoom = useRef<Group>(null);
  useFrame(({ camera }) => { if (visibleRoom.current) visibleRoom.current.visible = camera.position.z > -24; });
  useEffect(() => { scene.environment = environment; scene.environmentIntensity = 0.48; return () => { scene.environment = null; }; }, [environment, scene]);
  useEffect(() => () => {
    concrete.dispose(); disposeSharedFloor(); wallDetail.bump.dispose(); wallDetail.roughness.dispose(); environment.dispose();
    boxMaterials.forEach(material => material.dispose()); boxMaterials.clear(); UNIT_BOX.dispose();
  }, [concrete, floor, detail, wallDetail, environment]);
  return <>
    <color attach="background" args={['#0d171c']} />
    <fogExp2 attach="fog" args={['#17242a', tier === 'low' ? 0.022 : 0.027]} />
    <ambientLight intensity={0.28} color="#7e9fa9" />
    <hemisphereLight args={['#8ca9b2', '#20211d', 0.7]} />
    <group ref={visibleRoom}>
    <spotLight key={profile.shadowSize} position={[2, 7, 5]} color="#ffce94" intensity={280} angle={0.75} penumbra={0.8} distance={24} castShadow={profile.shadowSize > 0} shadow-mapSize={[profile.shadowSize || 512, profile.shadowSize || 512]} shadow-bias={-0.0007} shadow-normalBias={0.02} />
    <pointLight position={[-6, 3, 5]} color="#e2ac77" intensity={45} distance={12} />
    <pointLight position={[6, 4, -7]} color="#719caf" intensity={50} distance={14} />
    <pointLight position={[0, 5, 9]} color="#b9c5c1" intensity={35} distance={20} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, -1.7]} receiveShadow><planeGeometry args={[18, 30]} /><meshStandardMaterial map={floor} bumpMap={tier === 'low' ? undefined : detail.bump} bumpScale={0.065} roughnessMap={detail.roughness} color="#9da69d" metalness={0.7} roughness={0.3} envMapIntensity={0.7} /></mesh>
    {[-1, 1].map(side => <group key={side}>
      <Box position={[side * 9, 3.9, 0]} size={[0.5, 7.8, 26]} color="#6a726d" map={concrete} bump={wallDetail.bump} roughMap={wallDetail.roughness} metal={0.1} rough={0.96} />
      <Box position={[side * 8.68, 1.0, 0]} size={[0.08, 0.05, 24]} glow="#aa794b" />
      <Box position={[side * 8.3, 6.4, 0]} size={[0.7, 0.4, 26]} color="#414b48" />
      {Array.from({ length: 5 }, (_, i) => <group key={i} position={[0, 0, -10 + i * 5]}>
        <Box position={[side * 8.3, 3.4, 0]} size={[0.55, 6.8, 0.65]} color="#364447" />
        <Box position={[side * 7.6, 6.5, 0]} size={[0.4, 2.3, 0.65]} color="#364447" rotation={[0, 0, side * -0.7]} />
        <Box position={[side * 8.25, 3.3, 0.36]} size={[0.1, 0.9, 0.03]} glow="#d1a06b" />
        {side === 1 && <Box position={[0, 7.2, 0]} size={[17, 0.6, 0.6]} color="#334044" />}
      </group>)}
      {[0, 1, 2].map(i => <mesh key={i} position={[side * (6.5 + i * 0.45), 7, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12 + i * 0.04, 0.12 + i * 0.04, 26, 12]} /><meshStandardMaterial color="#4c5550" metalness={0.75} roughness={0.5} />
      </mesh>)}
      <Sign text="LAZARUS" position={[side * 8.7, 4.2, 0]} rotation={[0, side * -Math.PI / 2, 0]} size={[5.5, 1.4]} color="#94a09a" />
      <Sign text="07" position={[side * 8.7, 3, 5]} rotation={[0, side * -Math.PI / 2, 0]} size={[2, 0.8]} color="#c9b597" />
    </group>)}
    <Box position={[0, 7.9, 0]} size={[18, 0.3, 26]} color="#1b282c" />
    <Box position={[0, 3.8, 13]} size={[18, 7.6, 0.4]} color="#414a46" map={concrete} bump={wallDetail.bump} roughMap={wallDetail.roughness} metal={0.1} />
    {[-5, 5].map(x => <group key={x}>
      <Box position={[x, 7.25, 2]} size={[0.8, 0.16, 5]} glow="#b4b6a0" />
      {profile.beams && <mesh position={[x, 4.2, 2]} raycast={() => {}}><cylinderGeometry args={[0.2, 2.6, 6, 32, 1, true]} /><meshBasicMaterial color="#cfbd91" transparent opacity={0.013} depthWrite={false} side={BackSide} blending={AdditiveBlending} /></mesh>}
    </group>)}
    <BoxInstances items={floorGuides} color="#252e30" metal={0.65} roughness={0.65} glow={power ? '#b8d5bd' : '#8c7150'} />
    <Industrial /><Reactor /><ReactorField /><Terminal /><Props /><Door /><AtmosphericDust /><ReactiveLighting />
    </group>
  </>;
}
