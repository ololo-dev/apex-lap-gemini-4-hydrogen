import { CarInput, CarState, createInitialCarState, stepCar } from './car';
import { computeDemoInput } from './driver';
import { createInitialLapState, LapState, stepLapTracker } from './lap';
import { defaultTrack, Track } from './track';

export const FIXED_DT = 1 / 60;
export const MAX_FRAME_DT = 0.25;

export interface SimulationState {
  car: CarState;
  lap: LapState;
  demoMode: boolean;
  elapsedTime: number;
}

export function createInitialSimulation(
  track: Track = defaultTrack,
  demoMode = false,
): SimulationState {
  const start = track.gates[0];
  const next = track.gates[1];
  const startYaw = Math.atan2(next.z - start.z, next.x - start.x);

  return {
    car: createInitialCarState(start.x, start.z, startYaw),
    lap: createInitialLapState(),
    demoMode,
    elapsedTime: 0,
  };
}

export function stepSimulation(
  state: SimulationState,
  playerInput: CarInput,
  track: Track = defaultTrack,
  dt: number = FIXED_DT,
): SimulationState {
  const prevX = state.car.x;
  const prevZ = state.car.z;

  const activeInput = state.demoMode
    ? computeDemoInput(state.car, track)
    : playerInput;

  const offRoadNow = !track.isOnRoad(prevX, prevZ);
  const nextCar = stepCar(state.car, activeInput, offRoadNow, dt);
  const nextOffRoad = !track.isOnRoad(nextCar.x, nextCar.z);
  nextCar.offRoad = nextOffRoad;

  const nextLap = stepLapTracker(
    state.lap,
    track,
    prevX,
    prevZ,
    nextCar.x,
    nextCar.z,
    nextOffRoad,
    dt,
  );

  return {
    car: nextCar,
    lap: nextLap,
    demoMode: state.demoMode,
    elapsedTime: state.elapsedTime + dt,
  };
}

export interface FixedStepResult {
  state: SimulationState;
  accumulator: number;
  steps: number;
}

export function advanceSimulationClock(
  state: SimulationState,
  accumulator: number,
  frameDt: number,
  getInput: () => CarInput,
  track: Track = defaultTrack,
): FixedStepResult {
  const clampedDt = Math.min(Math.max(frameDt, 0), MAX_FRAME_DT);
  let acc = accumulator + clampedDt;
  let current = state;
  let steps = 0;

  while (acc >= FIXED_DT) {
    current = stepSimulation(current, getInput(), track, FIXED_DT);
    acc -= FIXED_DT;
    steps++;
  }

  return { state: current, accumulator: acc, steps };
}
