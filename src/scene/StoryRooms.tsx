import { startTransition, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, DoubleSide, Group, Mesh, Object3D } from 'three';
import { useGame, type Target } from '../game/store';
import { DOCUMENTS, type DocumentId, type Zone } from '../game/story';
import { Box, Sign } from './Room';
import { BoxInstances, type BoxInstance } from './Industrial';
import { floorOcclusion, sharedFloor } from './materials';
import { isSceneVisible, suspendHiddenUpdates } from './visibility';
import { GRAPHICS } from '../game/graphics';
import { aiIsBusy, useEchoAi } from '../ai/controller';
import { prepareScene, schedulePreparation } from './preparation';
import EscapeProps from './EscapeProps';

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
  const status = useGame(s => core ? s.progress.story.protocol : s.progress.story.labSolved ? 'stable' : 'none');
  const accent = status === 'erase' ? '#637e7e' : status === 'preserve' ? '#d9bc84' : status === 'stable' ? '#b3dbc7' : core ? '#90b8b3' : '#92c5d8';
  const lightTarget = useMemo(() => { const target = new Object3D(); target.position.set(0, core ? 2 : 0, center + (core ? 2 : 0)); return target; }, [center, core]);
  const detail = useMemo(sharedFloor, []);
  const floor = detail.map;
  const occlusion = useMemo(() => floorOcclusion(18, 20, center, core ? [[0, center + 2, 4.8, 4.8]] : [[0, center, 4.5, 4.1], [-7.7, center + 1, 1.2, 9], [7.7, center + 1, 1.2, 9]]), [center, core]);
  useEffect(() => () => occlusion.dispose(), [occlusion]);
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
    <mesh position={[0, -0.025, center]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[18, 20]} /><meshStandardMaterial map={floor} aoMap={occlusion} aoMapIntensity={0.65} bumpMap={GRAPHICS[tier].detail ? detail.bump : null} bumpScale={0.03} roughnessMap={detail.roughness} color={core ? '#536367' : '#9faeab'} roughness={0.4} metalness={0.65} /></mesh>
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
    <BoxInstances items={lanes} color={accent} glow={accent} />
    <BoxInstances items={ceilingLights} color={accent} glow={accent} />
    <primitive object={lightTarget} />
    <spotLight key={GRAPHICS[tier].shadowSize} target={lightTarget} position={[core ? 5 : 0, core ? 8.7 : 6.2, center - 1]} color={status === 'preserve' ? '#e0d2b7' : status === 'stable' ? '#d1e0db' : '#adc8cf'} intensity={core ? status === 'erase' ? 150 : 430 : 490} angle={1.05} penumbra={0.75} distance={27} castShadow={GRAPHICS[tier].shadowSize > 0} shadow-autoUpdate={tier !== 'laptop'} shadow-needsUpdate shadow-mapSize={[GRAPHICS[tier].shadowSize || 512, GRAPHICS[tier].shadowSize || 512]} shadow-normalBias={0.03} />
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
  const opticsSolved = useGame(s => s.progress.story.escape.opticsSolved);
  const labEquipment = useMemo<BoxInstance[]>(() => [-1, 1].flatMap(side => Array.from({ length: 12 }, (_, i) => ({ position: [side * 7.7, 0.5 + Math.floor(i / 4) * 0.7, -23 - (i % 4) * 2] as [number, number, number], size: [0.6, 0.6, 1.5] as [number, number, number] }))), []);
  const benchPanels = useMemo<BoxInstance[]>(() => [-1.4, 0, 1.4].map(x => ({ position: [x, 0.7, -24.96], size: [1.2, 0.92, 0.08] })), []);
  const benchFittings = useMemo<BoxInstance[]>(() => [-1.4, 0, 1.4].flatMap(x => [{ position: [x, 1.01, -24.89] as [number, number, number], size: [0.32, 0.045, 0.08] as [number, number, number] }, ...Array.from({ length: 5 }, (_, i) => ({ position: [x - 0.38 + i * 0.19, 0.45, -24.89] as [number, number, number], size: [0.09, 0.22, 0.03] as [number, number, number] }))]), []);
  return <>
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
    <group position={[-7.2, 0, -24.5]}><Box position={[0, 1.2, 0]} size={[.8, 1.8, .45]} color="#283e42" /><Sign position={[0, 1.9, .25]} text="COMPROBAR" size={[1.1, .22]} /><Sign position={[0, 1.5, .25]} text={`C / R / A   ${dials.join(' / ')}`} size={[1.15, .25]} /><mesh position={[0, 1.2, .26]} userData={{ interact: 'lab-validator' }}><boxGeometry args={[.7, .4, .12]} /><meshStandardMaterial color={solved ? '#a6d9c6' : '#d5b185'} /></mesh></group>
    <Sign position={[0, 5.9, -36.65]} text="CONSERVACIÓN NEURAL" size={[4, 0.4]} color="#a7c0bd" />
    <StoryTerminal zone="lab" position={[4.5, 0, -32.5]} />
    <Records zone="lab" /><EscapeProps zone="lab" /><Gate z={-37} open={solved && opticsSolved} />
  </>;
}

function MemoryCore() {
  const protocol = useGame(s => s.progress.story.protocol);
  const archive = useGame(s => s.progress.story.archiveVerified);
  const ring = useRef<Group>(null);
  const life = protocol !== 'erase';
  const memories = useRef<Group>(null), retained = useRef(life ? 1 : 0);
  const fragments = useMemo<BoxInstance[]>(() => Array.from({ length: 17 }, (_, i) => {
    const angle = i / 17 * Math.PI * 2;
    return { position: [Math.cos(angle) * 1.5, (i % 5 - 2) * .5, Math.sin(angle) * 1.5], size: [.38, .14, .035], rotation: [0, -angle, .12] };
  }), []);
  const frames = useMemo<BoxInstance[]>(() => Array.from({ length: 17 }, (_, i) => {
    const a = i / 17 * Math.PI * 2;
    return { position: [Math.cos(a) * 1.8, 4.1, -49 + Math.sin(a) * 1.8], size: [0.24, 5.6, 0.24], rotation: [0, -a, 0] };
  }), []);
  const nodes = useMemo<BoxInstance[]>(() => frames.flatMap(item => Array.from({ length: 7 }, (_, i) => ({ ...item, position: [item.position[0], 1.8 + i * 0.7, item.position[2]] as [number, number, number], size: [0.16, 0.23, 0.17] as [number, number, number] }))), [frames]);
  useFrame((_, delta) => {
    if (!isSceneVisible(ring.current)) return;
    const animate = !reduced && useGame.getState().effects;
    if (ring.current && !reduced && life) ring.current.rotation.y += delta * 0.13;
    retained.current = !animate ? Number(life) : retained.current + (Number(life) - retained.current) * Math.min(delta, .05) * .8;
    if (memories.current) {
      memories.current.scale.setScalar(retained.current);
      if (animate && life) memories.current.rotation.y -= delta * .09;
    }
  });
  return <>
    <Box position={[0, 0.2, -49]} size={[4.8, 0.4, 4.8]} color="#4a5655" />
    <Box position={[0, 7.6, -49]} size={[4.8, 0.8, 4.8]} color="#263238" />
    {[0.45, 7.08].map(y => <mesh key={y} position={[0, y, -49]} rotation={[Math.PI / 2, 0, 0]} castShadow><torusGeometry args={[2.52, 0.16, 8, 48]} /><meshStandardMaterial color="#7f8a7d" metalness={0.7} roughness={0.36} /></mesh>)}
    <Box position={[0, 8.4, -49]} size={[6.4, 0.25, 6.4]} color="#273b42" />
    {[-1, 1].map(side => <Box key={side} position={[side * 3, 7.9, -49]} size={[0.1, 1.2, 0.1]} color="#687e78" />)}
    <BoxInstances items={frames} color="#5b6866" shadow />
    <BoxInstances items={nodes} color={life ? '#6e9a8d' : '#273432'} glow={life ? '#6e9a8d' : undefined} />
    <group position={[0, 4.3, -49]}>
      <group ref={memories} scale={life ? 1 : 0}><BoxInstances items={fragments} color={protocol === 'preserve' ? '#e2c692' : '#84c9b3'} glow={life ? protocol === 'preserve' ? '#d0ad73' : '#72b79f' : undefined} raycast={() => {}} /></group>
      <mesh><icosahedronGeometry args={[1.1, 2]} /><meshStandardMaterial color="#84938a" metalness={0.8} roughness={0.2} emissive={life ? '#76c2a6' : '#000000'} emissiveIntensity={archive ? 1.7 : 0.6} /></mesh>
      <group ref={ring}>{[0, 1, 2].map(i => <mesh key={i} rotation={[i * 0.8 + 0.3, i * 0.7, 0.2]}><torusGeometry args={[2.05 + i * 0.12, 0.025, 6, 64]} /><meshBasicMaterial color={life ? '#c6c8a3' : '#344443'} transparent opacity={0.5} /></mesh>)}</group>
      {life && <mesh raycast={() => {}}><sphereGeometry args={[1.6, 20, 16]} /><meshBasicMaterial color="#8fc5ad" transparent opacity={0.025} depthWrite={false} blending={AdditiveBlending} /></mesh>}
    </group>
    <pointLight position={[0, 4.2, -49]} color="#86ceb3" intensity={life ? archive ? 70 : 40 : 0} distance={16} />
    <Sign position={[0, 7.1, -46.55]} text={life ? '17 / SEÑALES EN CONSERVACIÓN' : '00 / ARCHIVO ELIMINADO'} size={[4, 0.4]} color="#bec7a6" />
    <StoryTerminal zone="core" position={[0, 0, -44.5]} />
    <Records zone="core" /><EscapeProps zone="core" /><Gate z={-61} open={protocol !== 'none'} final />
    <Box position={[0, 2.1, -66.1]} size={[3.6, 4.2, 0.2]} glow="#abbcaf" />
  </>;
}

function PreparedZone({ zone, enabled, children }: { zone: 'lab' | 'core'; enabled: boolean; children: ReactNode }) {
  const root = useRef<Group>(null);
  const [stage, setStage] = useState(0);
  const ready = useGame(s => zone === 'lab' ? s.labReady : s.coreReady);
  const busy = useEchoAi(aiIsBusy);
  const { gl, scene, camera, invalidate } = useThree();
  useEffect(() => {
    if (!enabled || busy || stage >= 2) return;
    return schedulePreparation(() => startTransition(() => setStage(stage + 1)));
  }, [enabled, busy, stage]);
  useEffect(() => {
    if (stage !== 2 || ready || busy || !enabled || !root.current) return;
    const abort = new AbortController();
    void prepareScene(gl, scene, camera, abort.signal, root.current).catch(error => {
      if (!abort.signal.aborted) console.warn(`ECHO ${zone}: shader preparation deferred to rendering`, error);
    }).finally(() => {
      if (!abort.signal.aborted) { useGame.getState().set(zone === 'lab' ? { labReady: true } : { coreReady: true }); invalidate(); }
    });
    return () => abort.abort();
  }, [stage, ready, busy, enabled, gl, scene, camera, invalidate, zone]);
  useFrame(({ camera }) => {
    if (root.current) root.current.visible = enabled && ready && (zone === 'lab' ? camera.position.z < -9 && camera.position.z > -46 : camera.position.z < -32);
  }, -1);
  return <group ref={root} visible={false} userData={{ sceneZone: zone }} onUpdate={suspendHiddenUpdates}>
    {stage >= 1 && <Shell center={zone === 'lab' ? -27 : -51} core={zone === 'core'} />}
    {stage >= 2 && children}
  </group>;
}

export default function StoryRooms() {
  const labUnlocked = useGame(s => s.progress.door);
  const coreUnlocked = useGame(s => s.progress.story.labSolved);
  const containment = useRef<Group>(null);
  useFrame(({ camera }) => {
    if (containment.current) containment.current.visible = camera.position.z > -24;
  }, -1);
  return <>
    <group ref={containment} userData={{ sceneZone: 'containment' }} onUpdate={suspendHiddenUpdates}><Records zone="containment" /><EscapeProps zone="containment" /><Box position={[0, -0.1, -16]} size={[3.7, 0.2, 3]} color="#36464a" /></group>
    <PreparedZone zone="lab" enabled={labUnlocked}><Laboratory /></PreparedZone><PreparedZone zone="core" enabled={coreUnlocked}><MemoryCore /></PreparedZone>
  </>;
}
