import { describe, expect, it } from 'vitest';
import { createInitialLapState, stepLapTracker } from '../src/sim/lap';
import { defaultTrack } from '../src/sim/track';
import { createInitialSimulation, FIXED_DT } from '../src/sim/world';

describe('Lap counting rules', () => {
  it('starts the car at point A facing point B', () => {
    const sim = createInitialSimulation(defaultTrack, false);
    expect(sim.car.x).toBeCloseTo(0, 5);
    expect(sim.car.z).toBeCloseTo(0, 5);
    expect(sim.car.yaw).toBeCloseTo(0, 5);
  });

  it('counts a lap when all 12 points are passed in order and start line is crossed forward', () => {
    let lap = createInitialLapState();
    let prevX = 0;
    let prevZ = 0;

    // Walk along the track centerline
    const steps = 400;
    for (let i = 1; i <= steps; i++) {
      const s = (i / steps) * (defaultTrack.totalLength + 5);
      const pt = defaultTrack.sampleAtDistance(s);
      lap = stepLapTracker(lap, defaultTrack, prevX, prevZ, pt.x, pt.z, false, FIXED_DT);
      prevX = pt.x;
      prevZ = pt.z;
    }

    expect(lap.laps).toBe(1);
    expect(lap.lastLapTime).not.toBeNull();
    expect(lap.bestLapTime).toBe(lap.lastLapTime);
  });

  it('does not count a lap when cutting across the middle and missing points', () => {
    let lap = createInitialLapState();
    // Drive slightly past A, then teleport/cut back behind A and cross A again without B..L
    lap = stepLapTracker(lap, defaultTrack, -5, 0, 5, 0, false, 1);
    lap = stepLapTracker(lap, defaultTrack, -5, 0, 5, 0, false, 1);
    expect(lap.laps).toBe(0);
    expect(lap.lastLapTime).toBeNull();
  });

  it('does not count a lap when crossing the start line the wrong way', () => {
    let lap = createInitialLapState();
    // Cross A backwards (+x -> -x)
    lap = stepLapTracker(lap, defaultTrack, 5, 0, -5, 0, false, 1);
    expect(lap.laps).toBe(0);
  });
});
