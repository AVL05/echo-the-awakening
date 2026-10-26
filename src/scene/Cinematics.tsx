import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Quaternion, Vector3 } from 'three';
import { resume } from '../game/actions';
import { narrativeSound } from '../game/audio';
import { useGame } from '../game/store';

import { CINEMA_TEXT } from '../game/story';

export default function Cinematics() {
  const kind = useGame(s => s.cinematic);
  const phase = useGame(s => s.phase);
  const { camera } = useThree();
  const saved = useRef({ position: new Vector3(), quaternion: new Quaternion() });
  const time = useRef(0);
  const reduced = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (!kind || phase !== 'cinematic') return;
    saved.current.position.copy(camera.position); saved.current.quaternion.copy(camera.quaternion); time.current = 0;
    narrativeSound(kind);
    return () => { camera.position.copy(saved.current.position); camera.quaternion.copy(saved.current.quaternion); };
  }, [kind, phase, camera]);
  useFrame((_, delta) => {
    const s = useGame.getState();
    if (s.phase !== 'cinematic' || !kind) return;
    time.current += Math.min(delta, 0.1);
    const t = reduced.current ? 0.4 : Math.min(time.current / 8, 1);
    const eased = t * t * (3 - 2 * t);
    if (kind === 'lab') { camera.position.set(2.8 - eased * 1.4, 2.8, -18.5 - eased * 3); camera.lookAt(-1, 1.8, -28); }
    else { camera.position.set(5.8 - eased * 2.8, 3.7 + eased, -42.5 - eased * 1.8); camera.lookAt(0, 4.2, -49); }
    if (time.current > 8 || s.skipCinematic) {
      camera.position.copy(saved.current.position); camera.quaternion.copy(saved.current.quaternion);
      s.set({ cinematic: null, skipCinematic: false });
      if (kind === 'preserve' || kind === 'erase') { s.save({ ...useGame.getState().progress, complete: true }); s.set({ phase: 'complete' }); }
      else { s.set({ message: CINEMA_TEXT[kind][2] }); resume(); }
    }
  });
  return null;
}
