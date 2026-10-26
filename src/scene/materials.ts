import { BoxGeometry, CanvasTexture, CubeTexture, NoColorSpace, RepeatWrapping, SRGBColorSpace } from 'three';

export const UNIT_BOX = new BoxGeometry(1, 1, 1);
let floorMaps: { map: CanvasTexture; bump: CanvasTexture; roughness: CanvasTexture } | undefined;
// World/Room owns this shared resource for the lifetime of the three zones.
export function sharedFloor() {
  if (!floorMaps) { const map = surfaceTexture('floor'); floorMaps = { map, ...surfaceDetails(map) }; }
  return floorMaps;
}
export function disposeSharedFloor() {
  if (floorMaps) { floorMaps.map.dispose(); floorMaps.bump.dispose(); floorMaps.roughness.dispose(); floorMaps = undefined; }
}

export function surfaceTexture(kind: 'concrete' | 'floor') {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);
  let seed = kind === 'floor' ? 72 : 14;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  ctx.fillStyle = kind === 'floor' ? '#555c5c' : '#737770'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 22000; i++) {
    const light = Math.floor(50 + random() * 80);
    ctx.fillStyle = `rgba(${light},${light},${light},${random() * 0.22})`;
    ctx.fillRect(random() * 256, random() * 256, 1 + random() * 3, 1 + random() * 3);
  }
  ctx.strokeStyle = '#333c3c'; ctx.lineWidth = 3;
  if (kind === 'floor') {
    ctx.strokeRect(2, 2, 252, 252);
    ctx.strokeStyle = '#92988d'; ctx.lineWidth = 0.5; ctx.strokeRect(4, 4, 248, 248);
    ctx.strokeStyle = '#78817e'; ctx.lineWidth = 1;
    for (let i = 0; i < 45; i++) {
      const x = random() * 256, y = random() * 256;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + random() * 35, y + random() * 3); ctx.stroke();
    }
    ctx.fillStyle = '#292f2f';
    for (const x of [9, 247]) for (const y of [9, 247]) { ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill(); }
    for (let i = 0; i < 9; i++) {
      const x = random() * 256, y = random() * 256, r = 15 + random() * 60;
      const stain = ctx.createRadialGradient(x, y, 0, x, y, r);
      stain.addColorStop(0, '#171e1c35'); stain.addColorStop(1, '#171e1c00');
      ctx.fillStyle = stain; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  } else {
    ctx.beginPath(); ctx.moveTo(0, 90); ctx.lineTo(256, 90); ctx.stroke();
    ctx.fillStyle = '#404847';
    for (const x of [16, 240]) for (const y of [16, 240]) ctx.fillRect(x, y, 4, 4);
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(kind === 'floor' ? 9 : 3, kind === 'floor' ? 13 : 1);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function surfaceDetails(albedo: CanvasTexture) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(albedo.image, 0, 0);
  const pixels = ctx.getImageData(0, 0, 512, 512);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const value = Math.round(pixels.data[i] * 0.3 + pixels.data[i + 1] * 0.6 + pixels.data[i + 2] * 0.1);
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
  }
  ctx.putImageData(pixels, 0, 0);
  const bump = new CanvasTexture(canvas);
  bump.wrapS = bump.wrapT = RepeatWrapping; bump.repeat.copy(albedo.repeat);
  bump.colorSpace = NoColorSpace; bump.anisotropy = 4;
  const roughCanvas = document.createElement('canvas'); roughCanvas.width = roughCanvas.height = 512;
  const roughCtx = roughCanvas.getContext('2d')!;
  roughCtx.fillStyle = '#9b9b9b'; roughCtx.fillRect(0, 0, 512, 512);
  roughCtx.globalAlpha = 0.55; roughCtx.drawImage(canvas, 0, 0);
  const roughness = new CanvasTexture(roughCanvas);
  roughness.wrapS = roughness.wrapT = RepeatWrapping; roughness.repeat.copy(albedo.repeat); roughness.colorSpace = NoColorSpace;
  return { bump, roughness };
}

// Static softbox environment: approximate reflections without six extra scene renders per frame.
export function reflectionEnvironment() {
  const faces = Array.from({ length: 6 }, (_, i) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 128);
    gradient.addColorStop(0, i === 2 ? '#a8afb0' : '#586c78');
    gradient.addColorStop(0.5, '#202d35'); gradient.addColorStop(1, '#0b1419');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
    if (i !== 3) {
      ctx.shadowColor = '#f1d2a2'; ctx.shadowBlur = 14; ctx.fillStyle = '#f1d2a2';
      ctx.fillRect(14, 16, 4, 90); ctx.fillRect(90, 14, 25, 4);
    }
    return canvas;
  });
  const texture = new CubeTexture(faces); texture.colorSpace = SRGBColorSpace; texture.needsUpdate = true;
  return texture;
}

export function labelTexture(text: string, color = '#b4c3bd') {
  const canvas = document.createElement('canvas'); canvas.width = matchMedia('(pointer: coarse)').matches ? 512 : 1024; canvas.height = canvas.width / 4;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color; const base = canvas.height * 140 / 256; ctx.font = `600 ${base}px Bahnschrift, sans-serif`;
  const size = Math.min(base, base * (canvas.width - 32) / Math.max(ctx.measureText(text).width, 1));
  ctx.font = `600 ${size}px Bahnschrift, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
  return texture;
}
