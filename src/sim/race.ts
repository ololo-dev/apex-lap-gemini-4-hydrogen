import { CarInput, CarState, createInitialCarState, stepCar } from './car';
import { resolveCarCollisions } from './collision';
import { computeDemoInput } from './driver';
import {
  createInitialGhostState,
  GhostSample,
  GhostState,
  sampleGhostAtTime,
} from './ghost';
import { createInitialLapState, LapState, stepLapTracker } from './lap';
import { defaultTrack, Track } from './track';
import { FIXED_DT, MAX_FRAME_DT } from './world';

export const RACE_LAPS = 3;
export const COUNTDOWN_SECONDS = 3;
export const GO_BANNER_SECONDS = 1.0;

export interface RacerConfig {
  id: string;
  name: string;
  color: string;
  pace: number;
  isPlayer: boolean;
}

export const RACER_GRID_CONFIG: readonly RacerConfig[] = [
  { id: 'vexen', name: 'Vexen GT', color: '#2563eb', pace: 0.985, isPlayer: false },
  { id: 'solstice', name: 'Solstice V8', color: '#eab308', pace: 0.93, isPlayer: false },
  { id: 'borealis', name: 'Borealis RS', color: '#10b981', pace: 0.875, isPlayer: false },
  { id: 'kestrel', name: 'Kestrel R9', color: '#e63928', pace: 1.0, isPlayer: true },
];

export interface RacerState {
  config: RacerConfig;
  car: CarState;
  lap: LapState;
  finishTime: number | null;
}

export interface RaceStanding {
  racer: RacerState;
  position: number;
  progress: number;
}

export interface RaceState {
  racers: RacerState[];
  demoMode: boolean;
  countdownRemaining: number; // 3 -> 0; cars & clock start at 0
  goBannerRemaining: number; // 1 -> 0 after GO
  raceTime: number;
  playerFinished: boolean;
  allFinished: boolean;
  ghost: GhostState;
}

export function getCountdownDisplay(state: RaceState): '3' | '2' | '1' | 'GO' | null {
  if (state.countdownRemaining > 2) return '3';
  if (state.countdownRemaining > 1) return '2';
  if (state.countdownRemaining > 0) return '1';
  if (state.goBannerRemaining > 0) return 'GO';
  return null;
}

export function createInitialRace(
  track: Track = defaultTrack,
  demoMode = false,
): RaceState {
  const gridSlots = [
    { back: 6, lateral: -2.6 },
    { back: 6, lateral: 2.6 },
    { back: 14, lateral: -2.6 },
    { back: 14, lateral: 2.6 },
  ];

  const racers: RacerState[] = RACER_GRID_CONFIG.map((config, idx) => {
    const slot = gridSlots[idx];
    const sample = track.sampleAtDistance(track.totalLength - slot.back);
    const x = sample.x + sample.nx * slot.lateral;
    const z = sample.z + sample.nz * slot.lateral;
    const yaw = Math.atan2(sample.tz, sample.tx);

    return {
      config,
      car: createInitialCarState(x, z, yaw),
      lap: createInitialLapState(),
      finishTime: null,
    };
  });

  return {
    racers,
    demoMode,
    countdownRemaining: COUNTDOWN_SECONDS,
    goBannerRemaining: 0,
    raceTime: 0,
    playerFinished: false,
    allFinished: false,
    ghost: createInitialGhostState(),
  };
}

export function getGhostPose(state: RaceState): GhostSample | null {
  if (state.playerFinished || state.ghost.bestSamples.length === 0) {
    return null;
  }
  const player = getPlayerRacer(state);
  return sampleGhostAtTime(state.ghost.bestSamples, player.lap.currentLapTime);
}

export function computeLapProgress(
  car: CarState,
  lap: LapState,
  track: Track,
): number {
  const closest = track.closestPoint(car.x, car.z);
  const nextIdx = lap.nextCheckpoint;
  const targetGateS = nextIdx === 0 ? track.totalLength : track.gates[nextIdx].s;
  const distToNext = track.wrapDistance(targetGateS - closest.s);
  return targetGateS - distToNext;
}

export function getRaceStandings(
  state: RaceState,
  track: Track = defaultTrack,
): RaceStanding[] {
  const entries = state.racers.map((racer) => ({
    racer,
    progress:
      racer.lap.laps * track.totalLength +
      computeLapProgress(racer.car, racer.lap, track),
  }));

  entries.sort((a, b) => {
    const aFin = a.racer.finishTime;
    const bFin = b.racer.finishTime;
    if (aFin !== null && bFin !== null) return aFin - bFin;
    if (aFin !== null) return -1;
    if (bFin !== null) return 1;
    if (a.racer.lap.laps !== b.racer.lap.laps) {
      return b.racer.lap.laps - a.racer.lap.laps;
    }
    return b.progress - a.progress;
  });

  return entries.map((entry, idx) => ({
    racer: entry.racer,
    position: idx + 1,
    progress: entry.progress,
  }));
}

export function getPlayerRacer(state: RaceState): RacerState {
  return state.racers.find((r) => r.config.isPlayer) ?? state.racers[0];
}

export function stepRace(
  state: RaceState,
  playerInput: CarInput,
  track: Track = defaultTrack,
  dt: number = FIXED_DT,
): RaceState {
  // Countdown phase: cars and clock stay frozen until GO
  if (state.countdownRemaining > 0) {
    const nextCountdown = Math.max(0, state.countdownRemaining - dt);
    const hitGo = nextCountdown === 0;
    return {
      ...state,
      countdownRemaining: nextCountdown,
      goBannerRemaining: hitGo ? GO_BANNER_SECONDS : 0,
    };
  }

  const nextGoBanner = Math.max(0, state.goBannerRemaining - dt);
  const nextRaceTime = state.raceTime + dt;
  const prevPositions = state.racers.map((r) => ({ x: r.car.x, z: r.car.z }));
  const allCars = state.racers.map((r) => r.car);

  const steppedCars = state.racers.map((racer) => {
    const useAi = !racer.config.isPlayer || state.demoMode || racer.finishTime !== null;
    const input = useAi
      ? computeDemoInput(racer.car, track, {
          pace: racer.config.pace,
          otherCars: allCars,
        })
      : playerInput;

    const offRoadNow = !track.isOnRoad(racer.car.x, racer.car.z);
    return stepCar(racer.car, input, offRoadNow, dt);
  });

  const collidedCars = resolveCarCollisions(steppedCars);

  const nextRacers: RacerState[] = state.racers.map((racer, i) => {
    const car = collidedCars[i];
    const offRoad = !track.isOnRoad(car.x, car.z);
    car.offRoad = offRoad;

    if (racer.finishTime !== null) {
      return { ...racer, car };
    }

    const prev = prevPositions[i];
    const nextLap = stepLapTracker(
      racer.lap,
      track,
      prev.x,
      prev.z,
      car.x,
      car.z,
      offRoad,
      dt,
    );

    const finishTime = nextLap.laps >= RACE_LAPS ? nextRaceTime : null;

    return {
      ...racer,
      car,
      lap: nextLap,
      finishTime,
    };
  });

  const prevPlayer = getPlayerRacer(state);
  const player = nextRacers.find((r) => r.config.isPlayer) ?? nextRacers[0];
  const playerFinished = player.finishTime !== null;
  const allFinished = nextRacers.every((r) => r.finishTime !== null);

  let nextGhost = state.ghost;
  if (!state.playerFinished) {
    const sample: GhostSample = {
      t: player.lap.currentLapTime,
      x: player.car.x,
      z: player.car.z,
      yaw: player.car.yaw,
    };
    const updatedSamples = state.ghost.currentSamples.concat(sample);

    if (player.lap.laps > prevPlayer.lap.laps && player.lap.lastLapTime !== null) {
      const completedTime = player.lap.lastLapTime;
      const isNewBest =
        state.ghost.bestLapTime === null || completedTime < state.ghost.bestLapTime;
      nextGhost = {
        currentSamples: [{ t: 0, x: player.car.x, z: player.car.z, yaw: player.car.yaw }],
        bestSamples: isNewBest
          ? state.ghost.currentSamples.concat({
              t: completedTime,
              x: player.car.x,
              z: player.car.z,
              yaw: player.car.yaw,
            })
          : state.ghost.bestSamples,
        bestLapTime: isNewBest ? completedTime : state.ghost.bestLapTime,
      };
    } else {
      nextGhost = {
        ...state.ghost,
        currentSamples: updatedSamples,
      };
    }
  }

  return {
    racers: nextRacers,
    demoMode: state.demoMode,
    countdownRemaining: 0,
    goBannerRemaining: nextGoBanner,
    raceTime: nextRaceTime,
    playerFinished,
    allFinished,
    ghost: nextGhost,
  };
}

export interface FixedRaceStepResult {
  state: RaceState;
  accumulator: number;
  steps: number;
}

export function advanceRaceClock(
  state: RaceState,
  accumulator: number,
  frameDt: number,
  getPlayerInput: () => CarInput,
  track: Track = defaultTrack,
): FixedRaceStepResult {
  const clampedDt = Math.min(Math.max(frameDt, 0), MAX_FRAME_DT);
  let acc = accumulator + clampedDt;
  let current = state;
  let steps = 0;

  while (acc >= FIXED_DT) {
    current = stepRace(current, getPlayerInput(), track, FIXED_DT);
    acc -= FIXED_DT;
    steps++;
  }

  return { state: current, accumulator: acc, steps };
}
