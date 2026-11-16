export interface Vec2 {
  x: number;
  z: number;
}

export interface ControlPoint extends Vec2 {
  name: string;
}

export interface TrackSample {
  x: number;
  z: number;
  tx: number;
  tz: number;
  nx: number;
  nz: number;
  s: number;
  curvature: number;
}

export interface ClosestTrackPoint extends TrackSample {
  distance: number;
  signedLateral: number;
}

export interface CheckpointGate {
  index: number;
  name: string;
  x: number;
  z: number;
  tx: number;
  tz: number;
  s: number;
}

export const ROAD_WIDTH = 12;
export const ROAD_HALF_WIDTH = ROAD_WIDTH / 2;

export const CIRCUIT_POINTS: readonly ControlPoint[] = [
  { name: 'A', x: 0, z: 0 },
  { name: 'B', x: 120, z: 0 },
  { name: 'C', x: 200, z: 40 },
  { name: 'D', x: 220, z: 120 },
  { name: 'E', x: 160, z: 180 },
  { name: 'F', x: 80, z: 160 },
  { name: 'G', x: 40, z: 220 },
  { name: 'H', x: -60, z: 240 },
  { name: 'I', x: -140, z: 180 },
  { name: 'J', x: -120, z: 80 },
  { name: 'K', x: -180, z: 20 },
  { name: 'L', x: -100, z: -40 },
];

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

/**
 * Centripetal Catmull-Rom evaluation between p1 and p2 for t in [0, 1].
 */
function evalCentripetalCatmullRom(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  tNorm: number,
): Vec2 {
  const alpha = 0.5;
  const dt01 = Math.max(1e-4, Math.pow(dist(p0, p1), alpha));
  const dt12 = Math.max(1e-4, Math.pow(dist(p1, p2), alpha));
  const dt23 = Math.max(1e-4, Math.pow(dist(p2, p3), alpha));

  const t0 = 0;
  const t1 = t0 + dt01;
  const t2 = t1 + dt12;
  const t3 = t2 + dt23;
  const t = t1 + tNorm * (t2 - t1);

  const lerpPt = (a: Vec2, b: Vec2, ta: number, tb: number): Vec2 => {
    const w = (t - ta) / (tb - ta);
    return {
      x: a.x + (b.x - a.x) * w,
      z: a.z + (b.z - a.z) * w,
    };
  };

  const a1 = lerpPt(p0, p1, t0, t1);
  const a2 = lerpPt(p1, p2, t1, t2);
  const a3 = lerpPt(p2, p3, t2, t3);

  const b1 = lerpPt(a1, a2, t0, t2);
  const b2 = lerpPt(a2, a3, t1, t3);

  return lerpPt(b1, b2, t1, t2);
}

export class Track {
  readonly samples: TrackSample[];
  readonly totalLength: number;
  readonly gates: CheckpointGate[];
  readonly controlPoints: readonly ControlPoint[];

  constructor(
    controlPoints: readonly ControlPoint[] = CIRCUIT_POINTS,
    subdivisionsPerSegment = 60,
  ) {
    this.controlPoints = controlPoints;
    const n = controlPoints.length;
    const rawPoints: Vec2[] = [];
    const controlRawIndices: number[] = [];

    for (let i = 0; i < n; i++) {
      controlRawIndices.push(rawPoints.length);
      const p0 = controlPoints[(i - 1 + n) % n];
      const p1 = controlPoints[i];
      const p2 = controlPoints[(i + 1) % n];
      const p3 = controlPoints[(i + 2) % n];
      for (let j = 0; j < subdivisionsPerSegment; j++) {
        rawPoints.push(
          evalCentripetalCatmullRom(p0, p1, p2, p3, j / subdivisionsPerSegment),
        );
      }
    }

    const m = rawPoints.length;
    const cumS: number[] = new Array(m + 1).fill(0);
    for (let i = 0; i < m; i++) {
      const next = rawPoints[(i + 1) % m];
      cumS[i + 1] = cumS[i] + dist(rawPoints[i], next);
    }
    this.totalLength = cumS[m];

    const sampleCount = m;
    const stepS = this.totalLength / sampleCount;
    const uniformPts: Vec2[] = [];

    let rawIdx = 0;
    for (let i = 0; i < sampleCount; i++) {
      const targetS = i * stepS;
      while (rawIdx < m - 1 && cumS[rawIdx + 1] < targetS) {
        rawIdx++;
      }
      const segLen = cumS[rawIdx + 1] - cumS[rawIdx];
      const frac = segLen > 1e-8 ? (targetS - cumS[rawIdx]) / segLen : 0;
      const a = rawPoints[rawIdx];
      const b = rawPoints[(rawIdx + 1) % m];
      uniformPts.push({
        x: a.x + (b.x - a.x) * frac,
        z: a.z + (b.z - a.z) * frac,
      });
    }

    this.samples = uniformPts.map((pt, i) => {
      const prev = uniformPts[(i - 1 + sampleCount) % sampleCount];
      const next = uniformPts[(i + 1) % sampleCount];
      const dx = next.x - prev.x;
      const dz = next.z - prev.z;
      const len = Math.hypot(dx, dz) || 1;
      const tx = dx / len;
      const tz = dz / len;
      // Right-hand normal in x-east, z-south plane
      const nx = -tz;
      const nz = tx;

      // Signed curvature via angle change over 2*stepS
      const d1x = pt.x - prev.x;
      const d1z = pt.z - prev.z;
      const d2x = next.x - pt.x;
      const d2z = next.z - pt.z;
      const cross = d1x * d2z - d1z * d2x;
      const dot = d1x * d2x + d1z * d2z;
      const dTheta = Math.atan2(cross, dot);
      const curvature = dTheta / (2 * stepS);

      return {
        x: pt.x,
        z: pt.z,
        tx,
        tz,
        nx,
        nz,
        s: i * stepS,
        curvature,
      };
    });

    this.gates = controlPoints.map((cp, idx) => {
      const s = cumS[controlRawIndices[idx]];
      const sample = this.sampleAtDistance(s);
      return {
        index: idx,
        name: cp.name,
        x: cp.x,
        z: cp.z,
        tx: sample.tx,
        tz: sample.tz,
        s,
      };
    });
  }

  wrapDistance(s: number): number {
    const mod = s % this.totalLength;
    return mod < 0 ? mod + this.totalLength : mod;
  }

  sampleAtDistance(s: number): TrackSample {
    const wrapped = this.wrapDistance(s);
    const n = this.samples.length;
    const step = this.totalLength / n;
    const exactIdx = wrapped / step;
    const i0 = Math.floor(exactIdx) % n;
    const i1 = (i0 + 1) % n;
    const frac = exactIdx - Math.floor(exactIdx);
    const a = this.samples[i0];
    const b = this.samples[i1];

    const tx = a.tx + (b.tx - a.tx) * frac;
    const tz = a.tz + (b.tz - a.tz) * frac;
    const tLen = Math.hypot(tx, tz) || 1;
    const ntx = tx / tLen;
    const ntz = tz / tLen;

    return {
      x: a.x + (b.x - a.x) * frac,
      z: a.z + (b.z - a.z) * frac,
      tx: ntx,
      tz: ntz,
      nx: -ntz,
      nz: ntx,
      s: wrapped,
      curvature: a.curvature + (b.curvature - a.curvature) * frac,
    };
  }

  closestPoint(x: number, z: number): ClosestTrackPoint {
    const n = this.samples.length;
    let bestDistSq = Infinity;
    let bestSeg = 0;
    let bestT = 0;
    let bestX = 0;
    let bestZ = 0;

    for (let i = 0; i < n; i++) {
      const a = this.samples[i];
      const b = this.samples[(i + 1) % n];
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const abLenSq = abx * abx + abz * abz;
      let t = 0;
      if (abLenSq > 1e-10) {
        t = ((x - a.x) * abx + (z - a.z) * abz) / abLenSq;
        if (t < 0) t = 0;
        else if (t > 1) t = 1;
      }
      const px = a.x + abx * t;
      const pz = a.z + abz * t;
      const dx = x - px;
      const dz = z - pz;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestSeg = i;
        bestT = t;
        bestX = px;
        bestZ = pz;
      }
    }

    const a = this.samples[bestSeg];
    const b = this.samples[(bestSeg + 1) % n];
    const tx = a.tx + (b.tx - a.tx) * bestT;
    const tz = a.tz + (b.tz - a.tz) * bestT;
    const tLen = Math.hypot(tx, tz) || 1;
    const ntx = tx / tLen;
    const ntz = tz / tLen;
    const nx = -ntz;
    const nz = ntx;

    const dx = x - bestX;
    const dz = z - bestZ;
    const distance = Math.sqrt(bestDistSq);
    const signedLateral = dx * nx + dz * nz;
    const step = this.totalLength / n;

    return {
      x: bestX,
      z: bestZ,
      tx: ntx,
      tz: ntz,
      nx,
      nz,
      s: this.wrapDistance((bestSeg + bestT) * step),
      curvature: a.curvature + (b.curvature - a.curvature) * bestT,
      distance,
      signedLateral,
    };
  }

  isOnRoad(x: number, z: number): boolean {
    return this.closestPoint(x, z).distance <= ROAD_HALF_WIDTH;
  }
}

export const defaultTrack = new Track();
