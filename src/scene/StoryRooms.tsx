import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, DoubleSide, Group, Mesh, Object3D } from 'three';
import { useGame, type Target } from '../game/store';
import { DOCUMENTS, type DocumentId, type Zone } from '../game/story';
import { Box, Sign } from './Room';
import { BoxInstances, type BoxInstance } from './Industrial';
import { sharedFloor } from './materials';
import { isSceneVisible } from './visibility';
import { GRAPHICS } from '../game/graphics';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const VALVES = ['CONTENCIÓN', 'REFRIGERACIÓN', 'ANÁLISIS'];
function Hit({ target, position = [0, 1.5, 0], size = [1.2, 1.5, 1.2] }: { target: Target; position?: [number, number, number]; size?: [number, number, number] }) {
  return <mesh position={position} userData={{ interact: target }}><boxGeometry args={size} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>;
}

function Records({ zone }: { zone: Zone }) {
  const documents = useGame(s => s.progress.story.documents);
  return <>{(Object.entries(DOCUMENTS) as [DocumentId, typeof DOCUMENTS[DocumentId]][]).filter(([, doc]) => doc.zone === zone).map(([id, doc]) => <group key={id} position={[doc.position[0], 0, doc.position[2]]}>
    <Box position={[0, 0.5, 0]} size={[1.1, 1, 0.85]} color="#293737" />
    <Box position={[0, 1.1, 0]} size={[1.18, 0.08, 0.95]} color="#a6aba0" rough={0.35} />
    <Box position={[0, 1.17, 0]} size={[0.7, 0.025, 0.52]} glow={documents.includes(id) ? '#476b62' : '#b89663'} />
    <Sign position={[0, 0.78, 0.44]} text={doc.code} size={[0.94, 0.23]} color="#d6cdb7" />
    <Box position={[0, 1.75, -0.035]} size={[1.95, 0.35, 0.05]} color="#15272d" metal={0.2} />
    <Box position={[-0.88, 1.46, -0.035]} size={[0.035, 0.6, 0.035]} color="#63746e" />
    <Sign position={[0, 1.75, 0]} text={documents.includes(id) ? 'REGISTRO LEÍDO' : doc.title.replace(/^\d{2}:\d{2} · /, '')} size={[1.8, 0.22]} color="#e0d3b5" />
    <Hit target={`doc:${id}`} position={[0, 1.28, 0]} size={[1.2, 1.2, 1]} />
  </group>)}</>;
}

function Gate({ z, open, final = false }: { z: number; open: boolean; final?: boolean }) {
  const left = useRef<Group>(null), right = useRef<Group>(null);
  useFrame((_, delta) => {
    if (!isSceneVisible(left.current) || useGame.getState().phase === 'paused') return;
    const speed = Math.min(delta * 2, 1);
    if (left.current) left.current.position.x += ((open ? -2.7 : -0.85) - left.current.position.x) * speed;
    if (right.current) right.current.position.x += ((open ? 2.7 : 0.85) - right.current.position.x) * speed;
  });
  return <group position={[0, 0, z]}>
    {[-1, 1].map(side => <group key={side}>
      <Box position={[side * 5.4, 3.8, 0]} size={[7.2, 7.6, 0.6]} color={final ? '#202a2d' : '#465356'} metal={0.25} />
      <Box position={[side * 1.9, 2.2, 0.3]} size={[0.2, 4.4, 0.6]} color="#71817b" />
      <Box position={[side * 1.77, 2.2, 0.65]} size={[0.035, 4.1, 0.02]} glow={open ? '#a1d8be' : '#c08c5b'} />
      <group ref={side < 0 ? left : right} position={[side * (open ? 2.7 : 0.85), 2.1, 0]}>
        <Box position={[0, 0, 0]} size={[1.7, 4.2, 0.4]} color="#36444a" />
        <Box position={[0, 0, 0.24]} size={[1.3, 3.4, 0.1]} color="#253339" />
        <Box position={[side * -0.62, 0, 0.31]} size={[0.06, 3.3, 0.02]} glow={open ? '#83bca2' : '#b8976f'} />
      </group>
    </group>)}
    <Box position={[0, 5.7, 0]} size={[3.6, 3, 0.6]} color="#37454a" />
    <Sign text={final ? 'SALIDA / SUPERFICIE' : 'NÚCLEO / ECHO'} position={[0, 5, 0.33]} size={[3.2, 0.6]} />
    <Sign text={open ? 'CONTROL HUMANO / AUTORIZADO' : final ? 'DECISIÓN PENDIENTE' : 'CIRCUITO SIN VALIDAR'} position={[0, 4.45, 0.35]} size={[2.8, 0.3]} color="#cbb993" />
    {!open && <Hit target={final ? 'exit-gate' : 'lab-gate'} position={[0, 2, 0.4]} size={[3.5, 4, 0.2]} />}
    {[-1, 1].map(side => <Box key={side} position={[side * 1.85, 2, -2.4]} size={[0.2, 4, 4.8]} color="#303c3e" />)}
    <Box position={[0, -0.1, -2.5]} size={[3.7, 0.2, 5]} color="#3c4849" metal={0.7} rough={0.35} />
    <Box position={[0, 4.1, -2.5]} size={[3.7, 0.2, 5]} color="#18252a" />
    {[-1, 1].map(side => <Box key={side} position={[side * 1.5, 0.02, -2.5]} size={[0.04, 0.03, 4.5]} glow="#a4b9a0" />)}
    <pointLight position={[0, 2.5, -2]} color="#b9d0b9" intensity={22} distance={8} />
  </group>;
}

function Shell({ center, core = false }: { center: number; core?: boolean }) {
  const tier = useGame(s => s.tier);
  const lightTarget = useMemo(() => { const target = new Object3D(); target.position.set(0, core ? 2 : 0, center + (core ? 2 : 0)); return target; }, [center, core]);
  const detail = useMemo(sharedFloor, []);
  const floor = detail.map;
  const structures = useMemo<BoxInstance[]>(() => {
    const items: BoxInstance[] = [];
    for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
      const z = center - 8.5 + i * 3.4;
      items.push({ position: [side * 8.15, core ? 4.5 : 3.1, z], size: [0.55, core ? 9 : 6.2, 0.5] });
      items.push({ position: [side * 7.2, core ? 8.2 : 5.5, z], size: [0.5, 2.3, 0.5], rotation: [0, 0, side * -0.8] });
      if (side === 1) items.push({ position: [0, core ? 8.9 : 6.3, z], size: [16.5, 0.4, 0.4] });
    }
    return items;
  }, [center, core]);
  const panels = useMemo<BoxInstance[]>(() => Array.from({ length: 60 }, (_, i) => {
    const side = i % 2 ? 1 : -1, row = Math.floor(i / 20), col = Math.floor(i / 2) % 10;
    return { position: [side * 8.67, 1.1 + row * 1.4, center - 8.8 + col * 1.9], size: [0.12, 1.25, 1.7] };
  }), [center]);
  const lanes = useMemo<BoxInstance[]>(() => [-1, 1].flatMap(side => Array.from({ length: 12 }, (_, i) => ({ position: [side * 3.5, 0.025, center - 9 + i * 1.6] as [number, number, number], size: [0.035, 0.025, 0.8] as [number, number, number] }))), [center]);
  const ceilingLights = useMemo<BoxInstance[]>(() => [-1, 1].flatMap(side => Array.from({ length: 6 }, (_, i) => ({ position: [side * 5, core ? 8 : 5.9, center - 5.25 + i * 2.1] as [number, number, number], size: [0.26, 0.045, 1.35] as [number, number, number] }))), [center, core]);
  return <>
    <mesh position={[0, -0.025, center]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[18, 20]} /><meshStandardMaterial map={floor} bumpMap={tier === 'low' ? null : detail.bump} bumpScale={0.04} roughnessMap={detail.roughness} color={core ? '#536367' : '#9faeab'} roughness={0.4} metalness={0.65} /></mesh>
    {[-1, 1].map(side => <group key={side}>
      <Box position={[side * 9, core ? 4.5 : 3.3, center]} size={[0.5, core ? 9 : 6.6, 20]} color={core ? '#253239' : '#5e6f70'} metal={0.25} />
      <Box position={[side * 8.65, 0.5, center]} size={[0.09, 0.045, 19]} glow={core ? '#987e56' : '#749a9e'} />
      <Box position={[side * 5.4, 3.2, center + 10]} size={[7.2, 6.4, 0.6]} color={core ? '#28383c' : '#526568'} metal={0.2} />
      <Sign text={core ? 'MNEMOSYNE / 17' : 'INVESTIGACIÓN / 08'} position={[side * 8.64, 4.2, center]} rotation={[0, side * -Math.PI / 2, 0]} size={[5, 0.8]} color={core ? '#aba18c' : '#adc6c4'} />
      <Box position={[side * 5, core ? 8.07 : 5.97, center]} size={[0.5, 0.12, 12.5]} color="#203138" />
    </group>)}
    <Box position={[0, 5.6, center + 10]} size={[3.6, 3, 0.6]} color="#32434a" />
    <Box position={[0, core ? 9.2 : 6.7, center]} size={[18, 0.25, 20]} color="#18282c" />
    <BoxInstances items={structures} color={core ? '#36434a' : '#3d555a'} shadow />
    <BoxInstances items={panels} color={core ? '#1a262d' : '#465a60'} />
    <BoxInstances items={lanes} color="#adc6b5" glow="#adc6b5" />
    <BoxInstances items={ceilingLights} color={core ? '#d9c6a0' : '#c8d8d2'} glow={core ? '#d9c6a0' : '#c8d8d2'} />
    <primitive object={lightTarget} />
    <spotLight target={lightTarget} position={[core ? 5 : 0, core ? 8.7 : 6.2, center - 1]} color={core ? '#e0d2b7' : '#d1e0db'} intensity={core ? 430 : 490} angle={1.05} penumbra={0.75} distance={27} castShadow={tier !== 'low'} shadow-mapSize={[GRAPHICS[tier].shadowSize || 512, GRAPHICS[tier].shadowSize || 512]} shadow-normalBias={0.03} />
    <pointLight position={[-5, 3.5, center + 5]} color={core ? '#d2ac77' : '#8cc2d1'} intensity={core ? 40 : 65} distance={15} />
    <pointLight position={[5, 4, center - 6]} color="#a1b9aa" intensity={55} distance={14} />
  </>;
}

function StoryTerminal({ zone, position }: { zone: 'lab' | 'core'; position: [number, number, number] }) {
  const hologram = useRef<Mesh>(null);
  const isolated = useGame(s => s.progress.story.protocol === 'erase');
  useFrame((_, delta) => { if (hologram.current && isSceneVisible(hologram.current) && !isolated && !reduced && useGame.getState().phase !== 'paused') hologram.current.rotation.y += delta * 0.22; });
  return <group position={position}>
    <Box position={[0, 0.55, 0]} size={[2.5, 1.1, 1.2]} color="#2e4145" />
    <Box position={[0, 1.15, 0]} size={[2.6, 0.15, 1.3]} color="#748783" />
    <Box position={[0, 1.24, 0]} size={[2, 0.03, 0.8]} glow="#557f77" />
    <mesh ref={hologram} visible={!isolated} position={[zone === 'core' ? -0.82 : 0, 1.8, 0]}><icosahedronGeometry args={[zone === 'core' ? 0.24 : 0.4, 1]} /><meshBasicMaterial color="#9acdbb" wireframe transparent opacity={0.65} /></mesh>
    <Sign position={[0, 1.35, 0.72]} text={isolated ? 'SIN ENLACE / AUXILIAR' : zone === 'lab' ? 'ECHO / CIRCUITO' : 'ECHO / MEMORIA'} size={[1.9, 0.22]} color="#c7dfd1" />
    <Hit target={`${zone}-terminal`} size={[2.6, 2.4, 1.4]} />
  </group>;
}

function Laboratory() {
  const dials = useGame(s => s.progress.story.dials);
  const solved = useGame(s => s.progress.story.labSolved);
  const labEquipment = useMemo<BoxInstance[]>(() => [-1, 1].flatMap(side => Array.from({ length: 12 }, (_, i) => ({ position: [side * 7.7, 0.5 + Math.floor(i / 4) * 0.7, -23 - (i % 4) * 2] as [number, number, number], size: [0.6, 0.6, 1.5] as [number, number, number] }))), []);
  const benchPanels = useMemo<BoxInstance[]>(() => [-1.4, 0, 1.4].map(x => ({ position: [x, 0.7, -24.96], size: [1.2, 0.92, 0.08] })), []);
  const benchFittings = useMemo<BoxInstance[]>(() => [-1.4, 0, 1.4].flatMap(x => [{ position: [x, 1.01, -24.89] as [number, number, number], size: [0.32, 0.045, 0.08] as [number, number, number] }, ...Array.from({ length: 5 }, (_, i) => ({ position: [x - 0.38 + i * 0.19, 0.45, -24.89] as [number, number, number], size: [0.09, 0.22, 0.03] as [number, number, number] }))]), []);
  return <>
    <Shell center={-27} />
    <Box position={[0, 0.65, -27]} size={[4.4, 1.3, 4]} color="#3d5156" />
    <Box position={[0, 1.35, -27]} size={[4.5, 0.12, 4.1]} color="#a8b5b0" rough={0.3} />
    <BoxInstances items={benchPanels} color="#263e47" metal={0.55} roughness={0.52} />
    <BoxInstances items={benchFittings} color="#92a39a" metal={0.7} />
    <Sign position={[0, 0.77, -24.89]} text="CULTIVOS / 03" size={[0.95, 0.17]} color="#d3d4bc" />
    <Box position={[0, 4.3, -27]} size={[4.8, 0.3, 1]} color="#3b5258" />
    {[-1.8, 1.8].map(x => <Box key={x} position={[x, 5.3, -27]} size={[0.08, 1.8, 0.08]} color="#89988e" />)}
    <Box position={[0, 4.12, -27]} size={[3.8, 0.04, 0.5]} glow="#a7bfb6" />
    {[-1.25, 0, 1.25].map((x, i) => <group key={x} position={[x, 0, -27]}>
      <mesh position={[0, 2.15, 0]}><cylinderGeometry args={[0.37, 0.37, 1.5, 20, 1, true]} /><meshStandardMaterial color="#769e9c" transparent opacity={0.24} roughness={0.12} metalness={0.25} side={DoubleSide} depthWrite={false} /></mesh>
      <mesh position={[0, 2.1, 0]}><capsuleGeometry args={[0.15, 0.4 + i * 0.15, 4, 10]} /><meshStandardMaterial color="#a3b397" roughness={0.65} emissive="#507660" emissiveIntensity={solved ? 0.8 : 0.2} /></mesh>
      {[1.45, 2.9].map(y => <mesh key={y} position={[0, y, 0]}><cylinderGeometry args={[0.42, 0.42, 0.12, 20]} /><meshStandardMaterial color="#3d5355" metalness={0.75} roughness={0.3} /></mesh>)}
      <Box position={[0, 1.52, 0.39]} size={[0.29, 0.15, 0.09]} color="#253c42" />
      <Sign position={[0, 1.53, 0.44]} text={`0${i + 1}`} size={[0.22, 0.1]} color="#b6c4b5" />
    </group>)}
    <BoxInstances items={labEquipment} color="#32464d" />
    {VALVES.map((name, i) => <group key={name} position={[-7.2, 0, -22 - i * 5]}>
      <Box position={[0, 0.9, 0]} size={[1.65, 1.8, 1.5]} color="#5d7375" />
      <Box position={[0, 1.85, 0]} size={[1.7, 0.12, 1.6]} color="#b5bfb0" />
      <mesh position={[0, 1.5, 0.82]} rotation={[0, 0, -dials[i] * 0.55]}><torusGeometry args={[0.29, 0.055, 8, 20]} /><meshStandardMaterial color={solved ? '#a8d7b6' : '#c2aa7a'} metalness={0.7} roughness={0.4} /><Box position={[0, 0, 0]} size={[0.5, 0.055, 0.055]} color="#b5aa8c" /></mesh>
      <Sign text={`${i + 1} / ${name}  [ ${dials[i]} ]`} position={[0, 2.25, 0.82]} size={[2, 0.3]} color="#bed1bf" />
      <Sign text={`${i + 1} / ${name}`} position={[2.4, 0.02, 0.2]} rotation={[-Math.PI / 2, 0, 0]} size={[1.65, 0.3]} color="#acb8aa" />
      <Hit target={`valve:${i}` as Target} position={[0, 1.25, 0]} size={[1.85, 2.1, 1.85]} />
    </group>)}
    <Sign position={[0, 5.9, -36.65]} text="CONSERVACIÓN NEURAL" size={[4, 0.4]} color="#a7c0bd" />
    <StoryTerminal zone="lab" position={[4.5, 0, -32.5]} />
    <Records zone="lab" /><Gate z={-37} open={solved} />
  </>;
}

function MemoryCore() {
  const protocol = useGame(s => s.progress.story.protocol);
  const archive = useGame(s => s.progress.story.archiveVerified);
  const ring = useRef<Group>(null);
  const life = protocol !== 'erase';
  const frames = useMemo<BoxInstance[]>(() => Array.from({ length: 17 }, (_, i) => {
    const a = i / 17 * Math.PI * 2;
    return { position: [Math.cos(a) * 1.8, 4.1, -49 + Math.sin(a) * 1.8], size: [0.24, 5.6, 0.24], rotation: [0, -a, 0] };
  }), []);
  const nodes = useMemo<BoxInstance[]>(() => frames.flatMap(item => Array.from({ length: 7 }, (_, i) => ({ ...item, position: [item.position[0], 1.8 + i * 0.7, item.position[2]] as [number, number, number], size: [0.16, 0.23, 0.17] as [number, number, number] }))), [frames]);
  useFrame((_, delta) => { if (ring.current && isSceneVisible(ring.current) && !reduced && life && useGame.getState().phase !== 'paused') ring.current.rotation.y += delta * 0.13; });
  return <>
    <Shell center={-51} core />
    <Box position={[0, 0.2, -49]} size={[4.8, 0.4, 4.8]} color="#4a5655" />
    <Box position={[0, 7.6, -49]} size={[4.8, 0.8, 4.8]} color="#263238" />
    {[0.45, 7.08].map(y => <mesh key={y} position={[0, y, -49]} rotation={[Math.PI / 2, 0, 0]} castShadow><torusGeometry args={[2.52, 0.16, 8, 48]} /><meshStandardMaterial color="#7f8a7d" metalness={0.7} roughness={0.36} /></mesh>)}
    <Box position={[0, 8.4, -49]} size={[6.4, 0.25, 6.4]} color="#273b42" />
    {[-1, 1].map(side => <Box key={side} position={[side * 3, 7.9, -49]} size={[0.1, 1.2, 0.1]} color="#687e78" />)}
    <BoxInstances items={frames} color="#5b6866" shadow />
    <BoxInstances items={nodes} color={life ? '#6e9a8d' : '#273432'} glow={life ? '#6e9a8d' : undefined} />
    <group position={[0, 4.3, -49]}>
      <mesh><icosahedronGeometry args={[1.1, 2]} /><meshStandardMaterial color="#84938a" metalness={0.8} roughness={0.2} emissive={life ? '#76c2a6' : '#000000'} emissiveIntensity={archive ? 1.7 : 0.6} /></mesh>
      <group ref={ring}>{[0, 1, 2].map(i => <mesh key={i} rotation={[i * 0.8 + 0.3, i * 0.7, 0.2]}><torusGeometry args={[2.05 + i * 0.12, 0.025, 6, 64]} /><meshBasicMaterial color={life ? '#c6c8a3' : '#344443'} transparent opacity={0.5} /></mesh>)}</group>
      {life && <mesh raycast={() => {}}><sphereGeometry args={[1.6, 20, 16]} /><meshBasicMaterial color="#8fc5ad" transparent opacity={0.025} depthWrite={false} blending={AdditiveBlending} /></mesh>}
    </group>
    <pointLight position={[0, 4.2, -49]} color="#86ceb3" intensity={life ? archive ? 70 : 40 : 0} distance={16} />
    <Sign position={[0, 7.1, -46.55]} text={life ? '17 / SEÑALES EN CONSERVACIÓN' : '00 / ARCHIVO ELIMINADO'} size={[4, 0.4]} color="#bec7a6" />
    <StoryTerminal zone="core" position={[0, 0, -44.5]} />
    <Records zone="core" /><Gate z={-61} open={protocol !== 'none'} final />
    <Box position={[0, 2.1, -66.1]} size={[3.6, 4.2, 0.2]} glow="#abbcaf" />
  </>;
}

export default function StoryRooms() {
  const labUnlocked = useGame(s => s.progress.door);
  const coreUnlocked = useGame(s => s.progress.story.labSolved);
  const containment = useRef<Group>(null), lab = useRef<Group>(null), core = useRef<Group>(null);
  useFrame(({ camera }) => {
    if (containment.current) containment.current.visible = camera.position.z > -24;
    if (lab.current) lab.current.visible = camera.position.z < -9 && camera.position.z > -46;
    if (core.current) core.current.visible = camera.position.z < -32;
  });
  return <>
    <group ref={containment}><Records zone="containment" /><Box position={[0, -0.1, -16]} size={[3.7, 0.2, 3]} color="#36464a" /></group>
    <group ref={lab}>{labUnlocked && <Laboratory />}</group><group ref={core}>{coreUnlocked && <MemoryCore />}</group>
  </>;
}
