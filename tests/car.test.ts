import { describe, expect, it } from 'vitest';
import {
  createInitialCarState,
  KMH_PER_MS,
  MAX_OFFROAD_SPEED,
  MAX_ROAD_SPEED,
  stepCar,
} from '../src/sim/car';
import { FIXED_DT } from '../src/sim/world';

describe('Car physics', () => {
  it('accelerates up to 216 km/h on the road and no more', () => {
    let car = createInitialCarState(0, 0, 0);
    for (let i = 0; i < 60 * 15; i++) {
      car = stepCar(car, { throttle: 1, brake: 0, steer: 0 }, false, FIXED_DT);
    }
    expect(car.speed).toBeCloseTo(MAX_ROAD_SPEED, 1);
    expect(car.speed * KMH_PER_MS).toBeCloseTo(216, 0);
    expect(car.speed).toBeLessThanOrEqual(MAX_ROAD_SPEED + 1e-6);
  });

  it('holds speed to 72 km/h when off the road', () => {
    let car = createInitialCarState(0, 0, 0);
    // Accelerate on road to 216 km/h
    for (let i = 0; i < 60 * 10; i++) {
      car = stepCar(car, { throttle: 1, brake: 0, steer: 0 }, false, FIXED_DT);
    }
    expect(car.speed * KMH_PER_MS).toBeGreaterThan(200);

    // Leave road -> held to 72 km/h
    car = stepCar(car, { throttle: 1, brake: 0, steer: 0 }, true, FIXED_DT);
    expect(car.speed).toBeLessThanOrEqual(MAX_OFFROAD_SPEED + 1e-6);
    expect(car.speed * KMH_PER_MS).toBeCloseTo(72, 1);
  });

  it('brakes to a stop and reverses when brake is held longer', () => {
    let car = createInitialCarState(0, 0, 0);
    for (let i = 0; i < 60 * 2; i++) {
      car = stepCar(car, { throttle: 1, brake: 0, steer: 0 }, false, FIXED_DT);
    }
    expect(car.forwardSpeed).toBeGreaterThan(20);

    // Hold brake until stopped, then keep holding to reverse
    let sawStopped = false;
    for (let i = 0; i < 60 * 4; i++) {
      car = stepCar(car, { throttle: 0, brake: 1, steer: 0 }, false, FIXED_DT);
      if (Math.abs(car.forwardSpeed) < 0.3) {
        sawStopped = true;
      }
    }
    expect(sawStopped).toBe(true);
    expect(car.forwardSpeed).toBeLessThan(-5);
  });

  it('does not turn on the spot when standing still, but turns while moving', () => {
    let stillCar = createInitialCarState(0, 0, 0);
    for (let i = 0; i < 60; i++) {
      stillCar = stepCar(stillCar, { throttle: 0, brake: 0, steer: 1 }, false, FIXED_DT);
    }
    expect(stillCar.yaw).toBe(0);

    let movingCar = createInitialCarState(0, 0, 0);
    for (let i = 0; i < 60; i++) {
      movingCar = stepCar(movingCar, { throttle: 1, brake: 0, steer: 1 }, false, FIXED_DT);
    }
    expect(movingCar.yaw).toBeGreaterThan(0.5);
  });

  it('carries the car wide when taking a corner too fast', () => {
    // Accelerate to top speed and steer hard right
    let fastCar = createInitialCarState(0, 0, 0);
    for (let i = 0; i < 60 * 10; i++) {
      fastCar = stepCar(fastCar, { throttle: 1, brake: 0, steer: 0 }, false, FIXED_DT);
    }
    for (let i = 0; i < 30; i++) {
      fastCar = stepCar(fastCar, { throttle: 1, brake: 0, steer: 1 }, false, FIXED_DT);
    }
    // Lateral velocity magnitude is significant when understeering wide at 216 km/h
    expect(Math.abs(fastCar.lateralSpeed)).toBeGreaterThan(2);
  });
});
