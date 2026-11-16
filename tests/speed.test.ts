import { describe, expect, it } from 'vitest';
import {
  BOOST_BURN_SECONDS,
  BOOST_RECHARGE_SECONDS,
  createInitialCarState,
  KMH_PER_MS,
  MAX_BOOST_ROAD_SPEED,
  MAX_OFFROAD_SPEED,
  stepCar,
} from '../src/sim/car';
import { sampleGhostAtTime } from '../src/sim/ghost';
import {
  COUNTDOWN_SECONDS,
  createInitialRace,
  getGhostPose,
  getPlayerRacer,
  stepRace,
} from '../src/sim/race';
import { defaultTrack } from '../src/sim/track';
import { FIXED_DT } from '../src/sim/world';

describe('Boost & Ghost', () => {
  it('lifts on-road speed up to 270 km/h and burns full charge in 3 seconds', () => {
    let car = createInitialCarState(0, 0, 0);
    // Accelerate to 216 km/h first without boost
    for (let i = 0; i < 60 * 10; i++) {
      car = stepCar(car, { throttle: 1, brake: 0, steer: 0, boost: false }, false, FIXED_DT);
    }
    expect(car.boostCharge).toBe(1);

    // Burn boost for 3 seconds
    for (let i = 0; i < 60 * BOOST_BURN_SECONDS; i++) {
      car = stepCar(car, { throttle: 1, brake: 0, steer: 0, boost: true }, false, FIXED_DT);
    }
    expect(car.speed * KMH_PER_MS).toBeGreaterThan(255);
    expect(car.speed).toBeLessThanOrEqual(MAX_BOOST_ROAD_SPEED + 1e-6);
    expect(car.boostCharge).toBeCloseTo(0, 2);
  });

  it('recharges from empty to full in 10 seconds when not burning', () => {
    let car = createInitialCarState(0, 0, 0);
    car.boostCharge = 0;

    // 5 seconds -> ~50%
    for (let i = 0; i < 60 * 5; i++) {
      car = stepCar(car, { throttle: 1, brake: 0, steer: 0, boost: false }, false, FIXED_DT);
    }
    expect(car.boostCharge).toBeCloseTo(0.5, 2);

    // Another 5 seconds -> 100%
    for (let i = 0; i < 60 * (BOOST_RECHARGE_SECONDS - 5); i++) {
      car = stepCar(car, { throttle: 1, brake: 0, steer: 0, boost: false }, false, FIXED_DT);
    }
    expect(car.boostCharge).toBeCloseTo(1, 2);
  });

  it('does not lift the 72 km/h off-road speed limit when boosting', () => {
    let car = createInitialCarState(0, 0, 0);
    for (let i = 0; i < 60 * 3; i++) {
      car = stepCar(car, { throttle: 1, brake: 0, steer: 0, boost: true }, true, FIXED_DT);
    }
    expect(car.speed).toBeLessThanOrEqual(MAX_OFFROAD_SPEED + 1e-6);
    expect(car.speed * KMH_PER_MS).toBeCloseTo(72, 1);
  });

  it('records best lap ghost after Lap 1 and replays it in step with the clock', () => {
    let race = createInitialRace(defaultTrack, true);
    const idle = { throttle: 0, brake: 0, steer: 0 };

    // Run through countdown + Lap 1
    for (let i = 0; i < 60 * (COUNTDOWN_SECONDS + 40); i++) {
      race = stepRace(race, idle, defaultTrack, FIXED_DT);
      if (getPlayerRacer(race).lap.laps >= 1) break;
    }

    expect(getPlayerRacer(race).lap.laps).toBe(1);
    expect(race.ghost.bestSamples.length).toBeGreaterThan(100);

    // Step a couple seconds into Lap 2 and verify ghost pose is active
    for (let i = 0; i < 120; i++) {
      race = stepRace(race, idle, defaultTrack, FIXED_DT);
    }
    const pose = getGhostPose(race);
    expect(pose).not.toBeNull();
    expect(pose!.t).toBeCloseTo(getPlayerRacer(race).lap.currentLapTime, 3);
  });

  it('interpolates ghost samples smoothly', () => {
    const samples = [
      { t: 0, x: 0, z: 0, yaw: 0 },
      { t: 1, x: 10, z: 20, yaw: 1 },
    ];
    const mid = sampleGhostAtTime(samples, 0.5)!;
    expect(mid.x).toBeCloseTo(5, 5);
    expect(mid.z).toBeCloseTo(10, 5);
    expect(mid.yaw).toBeCloseTo(0.5, 5);
  });
});
