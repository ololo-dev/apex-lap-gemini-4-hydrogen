import { CheckpointGate, Track } from './track';

export const GATE_HALF_WIDTH = 18; // metres from gate center

export interface LapState {
  laps: number;
  currentLapTime: number;
  lastLapTime: number | null;
  bestLapTime: number | null;
  nextCheckpoint: number; // 1..11 (B..L), then 0 (A = start/finish)
  offRoadTime: number;
}

export function createInitialLapState(): LapState {
  return {
    laps: 0,
    currentLapTime: 0,
    lastLapTime: null,
    bestLapTime: null,
    nextCheckpoint: 1,
    offRoadTime: 0,
  };
}

function crossedGateForward(
  gate: CheckpointGate,
  prevX: number,
  prevZ: number,
  currX: number,
  currZ: number,
): boolean {
  const prevLong = (prevX - gate.x) * gate.tx + (prevZ - gate.z) * gate.tz;
  const currLong = (currX - gate.x) * gate.tx + (currZ - gate.z) * gate.tz;
  if (!(prevLong < 0 && currLong >= 0)) {
    return false;
  }

  // Interpolate crossing point along segment
  const denom = currLong - prevLong;
  const t = denom > 1e-8 ? -prevLong / denom : 0.5;
  const crossX = prevX + (currX - prevX) * t;
  const crossZ = prevZ + (currZ - prevZ) * t;

  const nx = -gate.tz;
  const nz = gate.tx;
  const lat = Math.abs((crossX - gate.x) * nx + (crossZ - gate.z) * nz);
  return lat <= GATE_HALF_WIDTH;
}

export function stepLapTracker(
  lap: LapState,
  track: Track,
  prevX: number,
  prevZ: number,
  currX: number,
  currZ: number,
  offRoad: boolean,
  dt: number,
): LapState {
  let currentLapTime = lap.currentLapTime + dt;
  let offRoadTime = lap.offRoadTime + (offRoad ? dt : 0);
  let laps = lap.laps;
  let lastLapTime = lap.lastLapTime;
  let bestLapTime = lap.bestLapTime;
  let nextCheckpoint = lap.nextCheckpoint;

  const gate = track.gates[nextCheckpoint];
  if (crossedGateForward(gate, prevX, prevZ, currX, currZ)) {
    if (nextCheckpoint === 0) {
      laps += 1;
      lastLapTime = currentLapTime;
      bestLapTime =
        bestLapTime === null
          ? currentLapTime
          : Math.min(bestLapTime, currentLapTime);
      currentLapTime = 0;
      nextCheckpoint = 1;
    } else {
      nextCheckpoint = (nextCheckpoint + 1) % track.gates.length;
    }
  }

  return {
    laps,
    currentLapTime,
    lastLapTime,
    bestLapTime,
    nextCheckpoint,
    offRoadTime,
  };
}
