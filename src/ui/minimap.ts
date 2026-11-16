import { getGhostPose, RaceState } from '../sim/race';
import { Track } from '../sim/track';

export class Minimap {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly track: Track;
  private minX = Infinity;
  private maxX = -Infinity;
  private minZ = Infinity;
  private maxZ = -Infinity;

  constructor(canvas: HTMLCanvasElement, track: Track) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.track = track;

    for (const s of track.samples) {
      if (s.x < this.minX) this.minX = s.x;
      if (s.x > this.maxX) this.maxX = s.x;
      if (s.z < this.minZ) this.minZ = s.z;
      if (s.z > this.maxZ) this.maxZ = s.z;
    }
  }

  private toCanvas(x: number, z: number): { cx: number; cy: number } {
    const pad = 14;
    const w = this.canvas.width - pad * 2;
    const h = this.canvas.height - pad * 2;
    const spanX = Math.max(1, this.maxX - this.minX);
    const spanZ = Math.max(1, this.maxZ - this.minZ);
    const scale = Math.min(w / spanX, h / spanZ);
    const offsetX = pad + (w - spanX * scale) * 0.5;
    const offsetY = pad + (h - spanZ * scale) * 0.5;

    return {
      cx: offsetX + (x - this.minX) * scale,
      cy: offsetY + (z - this.minZ) * scale,
    };
  }

  draw(state: RaceState): void {
    const ctx = this.ctx;
    const { width, height } = this.canvas;
    ctx.clearRect(0, 0, width, height);

    // Track outline & road
    ctx.beginPath();
    this.track.samples.forEach((s, idx) => {
      const { cx, cy } = this.toCanvas(s.x, s.z);
      if (idx === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    });
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.stroke();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#64748b';
    ctx.stroke();

    // Start line at point A
    const g0 = this.track.gates[0];
    const nx = -g0.tz;
    const nz = g0.tx;
    const p1 = this.toCanvas(g0.x - nx * 9, g0.z - nz * 9);
    const p2 = this.toCanvas(g0.x + nx * 9, g0.z + nz * 9);
    ctx.beginPath();
    ctx.moveTo(p1.cx, p1.cy);
    ctx.lineTo(p2.cx, p2.cy);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Ghost marker if active
    const ghost = getGhostPose(state);
    if (ghost) {
      const gp = this.toCanvas(ghost.x, ghost.z);
      ctx.beginPath();
      ctx.arc(gp.cx, gp.cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.65)';
      ctx.fill();
    }

    // Cars (draw rivals first, player on top)
    const ordered = [...state.racers].sort((a, b) =>
      a.config.isPlayer === b.config.isPlayer ? 0 : a.config.isPlayer ? 1 : -1,
    );
    for (const r of ordered) {
      const { cx, cy } = this.toCanvas(r.car.x, r.car.z);
      ctx.beginPath();
      ctx.arc(cx, cy, r.config.isPlayer ? 5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = r.config.color;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }
  }
}
