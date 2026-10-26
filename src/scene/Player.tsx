import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler, Mesh, Raycaster, Vector2, Vector3 } from 'three';
import { interact, openPanel } from '../game/actions';
import { useGame, type Target } from '../game/store';
import { canMove, INTERACT_DISTANCE, SPAWN } from '../game/world';
import { adaptQuality, damp } from '../game/graphics';
import { footstep } from '../game/audio';
import { controls } from '../game/input';
import { updateStory } from '../game/story';

const ray = new Raycaster();
const center = new Vector2();
const direction = new Vector3();
const rotation = new Euler(0, 0, 0, 'YXZ');
const upAxis = new Vector3(0, 1, 0);

export default function Player() {
  const { camera, gl, scene } = useThree();
  const yaw = useRef(0), pitch = useRef(0);
  const viewYaw = useRef(0), viewPitch = useRef(0);
  const velocity = useRef(new Vector3());
  const stride = useRef(0), bob = useRef(0), stepDistance = useRef(0), stepSide = useRef(false);
  const fastWindows = useRef(0);
  const started = useRef(false);
  const timer = useRef(0), frames = useRef(0), total = useRef(0);
  const rayTimer = useRef(0);
  const reduced = useRef(matchMedia('(prefers-reduced-motion: reduce)').matches);
  const sessionStats = useRef({ seconds: 0, distance: 0 });

  useEffect(() => {
    let dragPointer: number | null = null, lastX = 0, lastY = 0;
    const clear = () => { controls.keys.clear(); controls.touch = [0, 0]; dragPointer = null; };
    const down = (e: KeyboardEvent) => {
      const s = useGame.getState();
      if (s.phase !== 'playing' || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
        e.preventDefault(); controls.keys.add(e.code);
      }
      if (e.code === 'KeyE' && !e.repeat) void interact();
      if (e.code === 'KeyJ' && !e.repeat) openPanel('journal');
      if (e.code === 'Escape') {
        e.preventDefault(); s.set({ phase: 'paused' });
        if (document.pointerLockElement) document.exitPointerLock();
      }
    };
    const up = (e: KeyboardEvent) => { controls.keys.delete(e.code); };
    const lock = () => {
      const s = useGame.getState();
      const locked = document.pointerLockElement === gl.domElement;
      s.set({ locked }); clear();
      if (!locked && s.phase === 'playing' && s.inputMode === 'mouse') s.set({ phase: 'paused' });
    };
    const move = (e: PointerEvent) => {
      const s = useGame.getState();
      if (s.phase !== 'playing') return;
      let dx = 0, dy = 0;
      if (document.pointerLockElement === gl.domElement) { dx = e.movementX; dy = e.movementY; }
      else if (e.pointerId === dragPointer) { dx = e.clientX - lastX; dy = e.clientY - lastY; }
      else return;
      lastX = e.clientX; lastY = e.clientY;
      yaw.current -= dx * 0.0022;
      pitch.current = Math.max(-1.3, Math.min(1.3, pitch.current - dy * 0.0022));
    };
    const dragStart = (e: PointerEvent) => {
      if (useGame.getState().phase !== 'playing') return;
      dragPointer = e.pointerId; lastX = e.clientX; lastY = e.clientY;
      gl.domElement.setPointerCapture(e.pointerId);
    };
    const dragEnd = (e: PointerEvent) => { if (e.pointerId === dragPointer) dragPointer = null; };
    const blur = () => {
      clear();
      const s = useGame.getState();
      if (s.phase === 'playing') s.set({ phase: 'paused' });
      if (document.pointerLockElement) document.exitPointerLock();
    };
    const visibility = () => { if (document.hidden) blur(); };
    document.addEventListener('keydown', down); document.addEventListener('keyup', up);
    document.addEventListener('pointerlockchange', lock);
    window.addEventListener('pointermove', move); window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    gl.domElement.addEventListener('pointerdown', dragStart);
    window.addEventListener('pointerup', dragEnd); window.addEventListener('pointercancel', dragEnd);
    return () => {
      clear(); document.removeEventListener('keydown', down); document.removeEventListener('keyup', up);
      document.removeEventListener('pointerlockchange', lock);
      window.removeEventListener('pointermove', move); window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
      gl.domElement.removeEventListener('pointerdown', dragStart);
      window.removeEventListener('pointerup', dragEnd); window.removeEventListener('pointercancel', dragEnd);
    };
  }, [gl]);

  useFrame(({ clock }, delta) => {
    const s = useGame.getState();
    const dt = Math.min(delta, 0.06);
    if (!['intro', 'paused', 'complete', 'technical'].includes(s.phase)) {
      sessionStats.current.seconds += Math.min(delta, 0.25);
      if (sessionStats.current.seconds > 5) {
        const stats = s.progress.story.stats;
        s.save(updateStory(s.progress, { stats: { ...stats, seconds: stats.seconds + sessionStats.current.seconds, distance: stats.distance + sessionStats.current.distance } }));
        sessionStats.current = { seconds: 0, distance: 0 };
      }
    }
    if (s.phase === 'intro') {
      started.current = false;
      sessionStats.current = { seconds: 0, distance: 0 };
      camera.position.set(6.6 + (reduced.current ? 0 : Math.sin(clock.elapsedTime * 0.065) * 0.35), 2.8, 10);
      camera.lookAt(-2.8, 2.5, -1.0);
      return;
    }
    if (!started.current) {
      camera.position.set(...SPAWN);
      if (s.progress.door) camera.position.set(0, 1.7, -7.8);
      if (s.progress.story.zone === 'lab') camera.position.set(0, 1.7, -18.7);
      if (s.progress.story.zone === 'core') camera.position.set(0, 1.7, -42.5);
      yaw.current = pitch.current = viewYaw.current = viewPitch.current = 0;
      velocity.current.set(0, 0, 0); bob.current = stride.current = stepDistance.current = 0; started.current = true;
    }
    if (s.phase !== 'playing') { controls.keys.clear(); controls.touch = [0, 0]; velocity.current.set(0, 0, 0); return; }
    const k = controls.keys;
    yaw.current += ((k.has('ArrowLeft') ? 1 : 0) - (k.has('ArrowRight') ? 1 : 0)) * dt * 1.45;
    viewYaw.current = damp(viewYaw.current, yaw.current, 30, dt);
    viewPitch.current = damp(viewPitch.current, pitch.current, 30, dt);
    rotation.set(viewPitch.current, viewYaw.current, 0); camera.quaternion.setFromEuler(rotation);
    let x = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0) + controls.touch[0];
    let z = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) + controls.touch[1];
    const length = Math.hypot(x, z);
    if (length > 1) { x /= length; z /= length; }
    direction.set(x, 0, z).applyAxisAngle(upAxis, viewYaw.current).multiplyScalar(3.15);
    const response = length > 0 ? 12 : 22;
    velocity.current.x = damp(velocity.current.x, direction.x, response, dt);
    velocity.current.z = damp(velocity.current.z, direction.z, response, dt);
    direction.copy(velocity.current).multiplyScalar(dt);
    const beforeX = camera.position.x, beforeZ = camera.position.z;
    // Substeps prevent crossing thin geometry during a slow frame; separate axes let the player slide.
    for (let i = 0; i < 3; i++) {
      if (canMove(camera.position.x + direction.x / 3, camera.position.z, s.progress)) camera.position.x += direction.x / 3;
      else velocity.current.x = 0;
      if (canMove(camera.position.x, camera.position.z + direction.z / 3, s.progress)) camera.position.z += direction.z / 3;
      else velocity.current.z = 0;
    }
    const traveled = Math.hypot(camera.position.x - beforeX, camera.position.z - beforeZ);
    sessionStats.current.distance += traveled;
    stride.current += traveled * 5.8;
    bob.current = damp(bob.current, traveled > 0.002 ? 0.018 : 0, 10, dt);
    camera.position.y = 1.7 + (!reduced.current ? Math.sin(stride.current) * bob.current : 0);
    stepDistance.current += traveled;
    if (stepDistance.current > 0.95) { footstep(stepSide.current); stepSide.current = !stepSide.current; stepDistance.current %= 0.95; }
    const zone = camera.position.z < -41.5 ? 'core' : camera.position.z < -17.5 ? 'lab' : 'containment';
    const p = useGame.getState().progress;
    if (zone !== p.story.zone) {
      const first = zone === 'lab' ? !p.story.seenLab : zone === 'core' ? !p.story.seenCore : false;
      s.save(updateStory(p, { zone, ...(zone === 'lab' ? { seenLab: true } : zone === 'core' ? { seenCore: true } : {}) }));
      s.set({ target: null, ...(first ? { phase: 'cinematic', cinematic: zone === 'lab' ? 'lab' : 'core', skipCinematic: false } : {}) });
      if (first && document.pointerLockElement) document.exitPointerLock();
      if (first) return;
    }
    if (p.story.protocol !== 'none' && camera.position.z < -64.2) {
      s.set({ phase: 'cinematic', cinematic: p.story.protocol, skipCinematic: false, target: null });
      if (document.pointerLockElement) document.exitPointerLock();
      return;
    }
    rayTimer.current += dt;
    if (rayTimer.current > 0.1) {
      rayTimer.current = 0; ray.setFromCamera(center, camera); ray.far = INTERACT_DISTANCE;
      const hits = ray.intersectObjects(scene.children.filter(object => object.visible), true);
      const hit = hits.find(h => {
        for (let parent = h.object.parent; parent; parent = parent.parent) if (!parent.visible) return false;
        if (h.object.userData.interact) return true;
        if (!(h.object instanceof Mesh) || !h.object.visible) return false;
        const mat = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
        return !mat.transparent;
      });
      const target = (hit?.object.userData.interact ?? null) as Target | null;
      if (target !== s.target) s.set({ target });
    }
    if (s.quality === 'auto') {
      if (delta < 0.2) { total.current += delta; frames.current++; timer.current += delta; }
      if (timer.current > 4) {
        const fps = frames.current / total.current;
        const result = adaptQuality(s.tier, fps, fastWindows.current);
        fastWindows.current = result.fastWindows;
        if (result.tier !== s.tier) s.set({ tier: result.tier });
        timer.current = frames.current = total.current = 0;
      }
    } else { timer.current = frames.current = total.current = fastWindows.current = 0; }
  });
  return null;
}
