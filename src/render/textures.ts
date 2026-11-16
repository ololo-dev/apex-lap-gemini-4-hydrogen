import * as THREE from 'three';

export function createGroundTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#8b9b6e';
  ctx.fillRect(0, 0, size, size);

  // Subtle organic mottling
  for (let i = 0; i < 1800; i++) {
    const x = (i * 73) % size;
    const y = (i * 137) % size;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(110, 125, 82, 0.25)' : 'rgba(160, 168, 118, 0.2)';
    ctx.fillRect(x, y, 10, 10);
  }

  // Subtle 20m grid lines to make ground speed readable
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, size, size);
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.moveTo(0, size / 2);
  ctx.lineTo(size, size / 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(60, 60);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createAsphaltTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#2b2f36';
  ctx.fillRect(0, 0, w, h);

  // Asphalt grain
  for (let i = 0; i < 2400; i++) {
    const x = (i * 53) % w;
    const y = (i * 97) % h;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(x, y, 2, 2);
  }

  // Crisp white road edge lines
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, 8, h);
  ctx.fillRect(w - 8, 0, 8, h);

  // Subtle dashed centerline
  ctx.fillStyle = 'rgba(241, 245, 249, 0.45)';
  ctx.fillRect(w / 2 - 3, 16, 6, h / 2 - 16);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function createCheckeredTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const cols = 16;
  const rows = 4;
  const cw = size / cols;
  const ch = 64 / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#111827';
      ctx.fillRect(c * cw, r * ch, cw, ch);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
