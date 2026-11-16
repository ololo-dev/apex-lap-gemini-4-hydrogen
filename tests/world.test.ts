import { describe, expect, it } from 'vitest';
import { defaultTrack } from '../src/sim/track';
import {
  advanceSimulationClock,
  createInitialSimulation,
  FIXED_DT,
  stepSimulation,
} from '../src/sim/world';

describe('Simulation & Demo Driver', () => {
  it('moves the exact same distance per second regardless of frame rate', () => {
    const input = { throttle: 1, brake: 0, steer: 0.25 };

    // Run 2 seconds at 60 FPS
    let sim60 = createInitialSimulation(defaultTrack, false);
    let acc60 = 0;
    for (let i = 0; i < 120; i++) {
      const res = advanceSimulationClock(sim60, acc60, FIXED_DT, () => input, defaultTrack);
      sim60 = res.state;
      acc60 = res.accumulator;
    }

    // Run 2 seconds at 10 FPS (0.1s per frame)
    let sim10 = createInitialSimulation(defaultTrack, false);
    let acc10 = 0;
    for (let i = 0; i < 20; i++) {
      const res = advanceSimulationClock(sim10, acc10, 0.1, () => input, defaultTrack);
      sim10 = res.state;
      acc10 = res.accumulator;
    }

    expect(sim10.car.x).toBeCloseTo(sim60.car.x, 4);
    expect(sim10.car.z).toBeCloseTo(sim60.car.z, 4);
    expect(sim10.car.speed).toBeCloseTo(sim60.car.speed, 4);
  });

  it('completes a clean lap in demo mode without leaving the road', () => {
    let sim = createInitialSimulation(defaultTrack, true);
    const idle = { throttle: 0, brake: 0, steer: 0 };

    for (let i = 0; i < 60 * 60 && sim.lap.laps < 1; i++) {
      sim = stepSimulation(sim, idle, defaultTrack, FIXED_DT);
    }

    expect(sim.lap.laps).toBe(1);
    expect(sim.lap.offRoadTime).toBe(0);
    expect(sim.lap.lastLapTime).toBeGreaterThan(15);
    expect(sim.lap.lastLapTime).toBeLessThan(60);
  });
});
