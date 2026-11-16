import { CarInput } from '../sim/car';
import { defaultTrack } from '../sim/track';
import { createInitialSimulation, FIXED_DT, stepSimulation } from '../sim/world';

const IDLE_INPUT: CarInput = { throttle: 0, brake: 0, steer: 0 };

export function runHeadlessLap(): { laps: number; time: number; offRoad: number } {
  let state = createInitialSimulation(defaultTrack, true);
  const maxSteps = 60 * 300; // 5 minute safety cap

  for (let i = 0; i < maxSteps && state.lap.laps < 1; i++) {
    state = stepSimulation(state, IDLE_INPUT, defaultTrack, FIXED_DT);
  }

  return {
    laps: state.lap.laps,
    time: Number((state.lap.lastLapTime ?? state.lap.currentLapTime).toFixed(3)),
    offRoad: Number(state.lap.offRoadTime.toFixed(3)),
  };
}

const result = runHeadlessLap();
console.log(JSON.stringify(result));
