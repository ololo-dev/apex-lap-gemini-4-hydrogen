import { CarInput } from '../sim/car';
import {
  createInitialRace,
  getRaceStandings,
  RACE_LAPS,
  stepRace,
} from '../sim/race';
import { defaultTrack } from '../sim/track';
import { FIXED_DT } from '../sim/world';

const IDLE_INPUT: CarInput = { throttle: 0, brake: 0, steer: 0 };

export function runHeadlessRace(): {
  laps: number;
  results: Array<{ name: string; time: number; best: number }>;
} {
  let state = createInitialRace(defaultTrack, true);
  const maxSteps = 60 * 300; // 5 minute safety cap

  for (let i = 0; i < maxSteps && !state.allFinished; i++) {
    state = stepRace(state, IDLE_INPUT, defaultTrack, FIXED_DT);
  }

  const standings = getRaceStandings(state, defaultTrack);
  return {
    laps: RACE_LAPS,
    results: standings.map(({ racer }) => ({
      name: racer.config.name,
      time: Number((racer.finishTime ?? state.raceTime).toFixed(3)),
      best: Number((racer.lap.bestLapTime ?? 0).toFixed(3)),
    })),
  };
}

const result = runHeadlessRace();
console.log(JSON.stringify(result));
