export interface GhostSample {
  t: number;
  x: number;
  z: number;
  yaw: number;
}

export interface GhostState {
  currentSamples: GhostSample[];
  bestSamples: GhostSample[];
  bestLapTime: number | null;
}

export function createInitialGhostState(): GhostState {
  return {
    currentSamples: [],
    bestSamples: [],
    bestLapTime: null,
  };
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return a + diff * t;
}

export function sampleGhostAtTime(
  samples: readonly GhostSample[],
  t: number,
): GhostSample | null {
  if (samples.length === 0) return null;
  if (t <= samples[0].t) return samples[0];
  const last = samples[samples.length - 1];
  if (t >= last.t) return last;

  // Binary search for bracketing samples
  let lo = 0;
  let hi = samples.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].t <= t) lo = mid;
    else hi = mid;
  }

  const a = samples[lo];
  const b = samples[hi];
  const span = b.t - a.t;
  const frac = span > 1e-6 ? (t - a.t) / span : 0;

  return {
    t,
    x: a.x + (b.x - a.x) * frac,
    z: a.z + (b.z - a.z) * frac,
    yaw: lerpAngle(a.yaw, b.yaw, frac),
  };
}
