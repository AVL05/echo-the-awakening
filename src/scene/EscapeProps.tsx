import { Box, Sign } from './Room';
import { useGame, type Target } from '../game/store';
import type { Zone } from '../game/story';
import { traceBeam } from '../game/escape';
import { BoxInstances, type BoxInstance } from './Industrial';

function SupplyControls() {
  const lines = useGame(s => s.progress.story.escape.powerRouted ? '101' : s.powerLines);
  const powered = useGame(s => s.progress.power);
  return <group position={[5.8, 0, -1.5]}>
    <Box position={[0, 2.6, .3]} size={[1.8, 1.1, .25]} color="#273c40" />
    <Box position={[0, 1.95, .3]} size={[.16, .3, .2]} color="#6e7c73" />
    <BoxInstances items={[-.55, 0, .55].map(x => ({ position: [x, 2.65, .46], size: [.4, .55, .035] }))} color="#111f25" />
    <Sign position={[0, 3.03, .46]} text="VIDA / ARCHIVO / FRÍO" size={[1.6, .17]} color="#d9cfb4" />
    {[0, 1, 2].map(i => <group key={i}>
      <group position={[-.55 + i * .55, 2.6, .7]} rotation={[lines[i] === '1' ? -.6 : .6, 0, 0]}>
        <Box position={[0, .12, 0]} size={[.035, .26, .035]} color="#b1c0b6" metal={.85} rough={.25} />
        <mesh position={[0, .27, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.055, .055, .17, 8]} /><meshStandardMaterial color={lines[i] === '1' ? '#add8c3' : '#b99a6a'} metalness={.35} roughness={.4} /></mesh>
      </group>
      <mesh position={[-.55 + i * .55, 2.7, .8]} userData={{ interact: `supply:${i}` }}><boxGeometry args={[.43, .48, .3]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
    </group>)}
    <mesh position={[0, 2.3, .54]} userData={{ interact: 'supply-start' }}><boxGeometry args={[1.1, .19, .12]} /><meshStandardMaterial color={powered ? '#a6d9c6' : '#c6a574'} emissive={powered ? '#3b7365' : '#251a0c'} /></mesh>
    <Sign position={[0, 2.3, .61]} text={powered ? 'RED ESTABLE' : 'ARRANQUE'} size={[.85, .12]} />
  </group>;
}

function OpticalBench() {
  const e = useGame(s => s.progress.story.escape);
  const beam = traceBeam(e.mirrors);
  const point = ([x, y]: number[]): [number, number, number] => [-.9 + x * .6, 1.55 - y * .45, .53];
  const segments: BoxInstance[] = beam.path.slice(1).map((cell, i) => {
    const a = point(beam.path[i]), b = point(cell);
    return { position: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, .64], size: [Math.max(.035, Math.abs(a[0] - b[0])), Math.max(.035, Math.abs(a[1] - b[1])), .025] };
  });
  return <group position={[0, 1, -34]}>
    <Box position={[0, .5, .3]} size={[3.4, 2.4, .15]} color="#182c31" />
    <BoxInstances items={[-.6, 0, .6].flatMap(x => [
      { position: [x, .9, .4], size: [.015, 1.8, .02] },
      { position: [0, .2 + x, .4], size: [2.9, .015, .02] },
    ])} color="#4e686a" metal={.5} />
    {[[1, 1], [1, 0], [2, 0]].map((cell, i) => <group key={i} position={point(cell)}>
      <mesh position={[0, 0, -.06]}><torusGeometry args={[.25, .025, 6, 20]} /><meshStandardMaterial color="#8d9f96" metalness={.8} roughness={.35} /></mesh>
      <mesh rotation={[0, 0, e.mirrors[i] === '0' ? Math.PI / 4 : -Math.PI / 4]} userData={{ interact: `mirror:${i}` }}><boxGeometry args={[.5, .12, .15]} /><meshStandardMaterial color="#d2d6bd" metalness={.65} roughness={.35} /></mesh>
      <Sign position={[0, .23, .02]} text={'ABC'[i]} size={[.22, .2]} />
    </group>)}
    {e.lensInstalled && <BoxInstances items={segments} color={beam.human ? '#5edbb7' : '#e9b468'} glow={beam.human ? '#5edbb7' : '#e9b468'} raycast={() => {}} />}
    <mesh position={point([-1, 1])} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.13, .13, .2, 12]} /><meshStandardMaterial color="#adbdad" metalness={.8} emissive={e.lensInstalled ? '#a6d9c6' : '#000000'} /></mesh>
    {[1, 2].map(x => <mesh key={x} position={[point([x, 3])[0], .2, .54]}><boxGeometry args={[.27, .22, .12]} /><meshStandardMaterial color={x === 2 ? '#84bba6' : '#b99169'} emissive={e.lensInstalled && beam.human && x === 2 ? '#67c9a3' : '#000000'} emissiveIntensity={1.5} /></mesh>)}
    <Sign position={[-1.3, 1.1, .55]} text="LENTE" size={[.48, .18]} />
    <Sign position={[-.3, -.04, .55]} text="ECHO" size={[.5, .18]} color="#d5b185" />
    <Sign position={[.4, -.04, .55]} text="HUMANO" size={[.6, .18]} color="#a6d9c6" />
  </group>;
}

function Hit({ target, size = [1.1, 1.3, .6], z = .1 }: { target: Target; size?: [number, number, number]; z?: number }) {
  return <mesh position={[0, 1.5, z]} userData={{ interact: target }}><boxGeometry args={size} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>;
}
export default function EscapeProps({ zone }: { zone: Zone }) {
  const e = useGame(s => s.progress.story.escape);
  if (zone === 'containment') return <>
    <SupplyControls />
    {!e.inventory.includes('badge') && <group position={[-6, 0, 8]}><Box position={[0, .6, 0]} size={[1, 1.2, .6]} color="#303e41" /><Box position={[0, 1.3, .1]} size={[.55, .3, .06]} glow="#b9a47e" /><Sign position={[0, 1.75, .15]} text="CREDENCIAL / 17" size={[1.6, .22]} /><Hit target="item:badge" /></group>}
    {!e.locker && <group position={[-5.5, 0, 2.2]}><Box position={[0, 1.48, 0]} size={[1.6, .85, .08]} color="#28383d" /><Sign position={[0, 1.5, .06]} text="TURNO / HORA" size={[1.4, .23]} /><Hit target="escape:locker" size={[1.65, 1, .25]} /></group>}
    <group position={[6.7, 0, 6.4]}><Box position={[0, 2.55, -.15]} size={[1.7, .8, .1]} color="#192c31" /><Sign position={[0, 2.6, -.08]} text="04:17" size={[1.5, .55]} color="#d5b185" /><mesh position={[0, 2.55, .05]} userData={{ interact: 'escape:clock' }}><boxGeometry args={[1.75, .9, .35]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh></group>
    <Sign position={[5.8, 2.4, -.8]} text="VIDA / ARCHIVO / FRÍO" size={[2.1, .26]} />
  </>;
  if (zone === 'lab') return <>
    <OpticalBench />
    {!e.inventory.includes('crank') && <group position={[-4.3, 0, -23]}><Box position={[0, .6, 0]} size={[.9, 1.2, .6]} color="#33484b" /><mesh position={[0, 1.4, 0]} userData={{ interact: 'item:crank' }}><torusGeometry args={[.24, .055, 6, 16]} /><meshStandardMaterial color="#b6a17e" metalness={.7} roughness={.5} /></mesh><Sign position={[0, 1.9, .1]} text="SERVICIO MANUAL" size={[1.7, .22]} /><Hit target="item:crank" /></group>}
    <group position={[6.7, 0, -20.7]}><Box position={[0, 1, 0]} size={[1.3, 2, .7]} color="#33484b" /><Box position={[0, 1.5, .4]} size={[.65, .08, .04]} glow={e.cabinetOpen ? '#a6d9c6' : '#d5b185'} /><Sign position={[0, 2.35, .4]} text="ÓPTICA / EJE MANUAL" size={[2.1, .25]} /><Hit target="escape:cabinet" z={.5} /></group>
    <group position={[0, 0, -34]}><Box position={[0, .65, 0]} size={[1.8, 1.3, .9]} color="#3a5155" /><Box position={[0, 1.35, 0]} size={[1.9, .12, 1]} color="#788a83" /><Box position={[0, 1.45, 0]} size={[1.3, .035, .65]} glow={e.opticsSolved ? '#a6d9c6' : '#ad926b'} /><Sign position={[0, 1.9, .1]} text="VERIFICACIÓN HUMANA" size={[2.8, .27]} /><Hit target="escape:optics" size={[1.9, 1.7, 1]} z={.1} /></group>
    <group position={[-7.9, 0, -29.5]}><Sign position={[0, 2.8, 0]} rotation={[0, Math.PI / 2, 0]} text={e.lensInstalled ? 'PARA MARA / 17' : 'PINTURA RECIENTE'} size={[2.5, .4]} color={e.lensInstalled ? '#a6d9c6' : '#637470'} /><Hit target="escape:secret" size={[.8, 3.3, 1.2]} /></group>
    <Sign position={[-5.4, 2.8, -22]} text="C = x / R = 2x / A = x+1" size={[3.1, .32]} /><Sign position={[4.5, 3, -24]} text="MEDICIÓN ACTUAL / 9" size={[2.8, .3]} />
  </>;
  return <>
    <group position={[-2.3, 0, -44.5]}><Box position={[0, .8, 0]} size={[.8, 1.6, .6]} color="#495956" /><Box position={[0, 1.5, .35]} size={[.55, .05, .04]} glow={e.waferRead ? '#a6d9c6' : '#d5b185'} /><Sign position={[0, 2, .35]} text="CUSTODIA / FIRMA FÍSICA" size={[2.4, .25]} /><Hit target="escape:reader" /></group>
    <group position={[4.8, 0, -58]}><Box position={[0, 1, 0]} size={[1.4, 2, .8]} color="#3a4a4d" /><Box position={[0, 1.7, .45]} size={[1, .09, .04]} glow={e.finalRoute === 'none' ? '#d5b185' : '#a6d9c6'} /><Sign position={[0, 2.5, .45]} text="CONTROL INDEPENDIENTE" size={[2.6, .27]} /><Sign position={[0, 2.15, .45]} text="ARCHIVO / CUSTODIA / SALIDA" size={[2.6, .22]} /><Hit target="escape:continuity" size={[1.5, 2, 1]} /></group>
  </>;
}
