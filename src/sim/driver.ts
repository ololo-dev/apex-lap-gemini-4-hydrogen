import { CarInput, CarState, MAX_ROAD_SPEED } from './car';
import { ROAD_HALF_WIDTH, Track } from './track';

function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export interface DriverOptions {
  pace?: number;
  otherCars?: readonly CarState[];
}

export function computeOvertakeOffset(
  car: CarState,
  otherCars: readonly CarState[],
  track: Track,
): number {
  if (otherCars.length === 0) return 0;

  const selfClosest = track.closestPoint(car.x, car.z);
  let nearestAheadDist = Infinity;
  let nearestLateralDiff = 0;
  let blockerLateral = 0;

  for (const other of otherCars) {
    if (other === car) continue;
    const otherClosest = track.closestPoint(other.x, other.z);
    const ds = track.wrapDistance(otherClosest.s - selfClosest.s);
    const latDiff = otherClosest.signedLateral - selfClosest.signedLateral;

    // If a car is right alongside us, hold our own lateral lane
    if ((ds <= 4.5 || ds >= track.totalLength - 4.5) && Math.abs(latDiff) < 3.4) {
      const holdSide = selfClosest.signedLateral >= otherClosest.signedLateral ? 1 : -1;
      return clamp(
        otherClosest.signedLateral + holdSide * 3.0,
        -(ROAD_HALF_WIDTH - 1.5),
        ROAD_HALF_WIDTH - 1.5,
      );
    }

    if (ds > 4.5 && ds < 28 && ds < nearestAheadDist) {
      if (Math.abs(latDiff) < 2.8) {
        nearestAheadDist = ds;
        nearestLateralDiff = latDiff;
        blockerLateral = otherClosest.signedLateral;
      }
    }
  }

  if (nearestAheadDist === Infinity) return 0;

  // Choose the side with more room inside the 12 m road
  const passMargin = 3.1;
  const goRight = blockerLateral < 0 ? true : blockerLateral > 0 ? false : nearestLateralDiff <= 0;
  const targetOffset = goRight
    ? Math.min(ROAD_HALF_WIDTH - 1.5, blockerLateral + passMargin)
    : Math.max(-(ROAD_HALF_WIDTH - 1.5), blockerLateral - passMargin);

  return targetOffset;
}

export function computeDemoInput(
  car: CarState,
  track: Track,
  options: DriverOptions = {},
): CarInput {
  const pace = options.pace ?? 1.0;
  const laneOffset = options.otherCars
    ? computeOvertakeOffset(car, options.otherCars, track)
    : 0;

  const closest = track.closestPoint(car.x, car.z);

  // Pure-pursuit lookahead along the track centerline + optional overtake offset
  const lookahead = 10 + 0.32 * car.speed;
  const sample = track.sampleAtDistance(closest.s + lookahead);
  const targetX = sample.x + sample.nx * laneOffset;
  const targetZ = sample.z + sample.nz * laneOffset;
  const desiredYaw = Math.atan2(targetZ - car.z, targetX - car.x);
  const yawError = normalizeAngle(desiredYaw - car.yaw);

  // Subtle centering term relative to desired lane
  const lateralError = closest.signedLateral - laneOffset;
  const lateralCorrection = clamp(-lateralError * 0.04, -0.25, 0.25);
  const steer = clamp(yawError * 2.2 + lateralCorrection, -1, 1);

  // Look ahead for upcoming corners and compute safe target speed
  const safeLatAccel = 15.0 * pace * pace;
  const safeBrakeDecel = 22.0;
  let targetSpeed = MAX_ROAD_SPEED * pace;

  for (let d = 5; d <= 95; d += 5) {
    const ahead = track.sampleAtDistance(closest.s + d);
    const absK = Math.abs(ahead.curvature);
    if (absK > 1e-4) {
      const vCorner = Math.sqrt(safeLatAccel / absK);
      const vAllowed = Math.sqrt(
        vCorner * vCorner + 2 * safeBrakeDecel * Math.max(0, d - 6),
      );
      if (vAllowed < targetSpeed) {
        targetSpeed = vAllowed;
      }
    }
  }

  if (Math.abs(yawError) > 0.35) {
    targetSpeed = Math.min(targetSpeed, 22 * pace);
  }

  let throttle = 0;
  let brake = 0;

  if (car.forwardSpeed > targetSpeed + 1.2) {
    brake = clamp((car.forwardSpeed - targetSpeed) * 0.28, 0.15, 1);
  } else if (car.forwardSpeed < targetSpeed - 0.3) {
    throttle = clamp((targetSpeed - car.forwardSpeed) * 0.4, 0.25, 1) * pace;
  } else {
    throttle = 0.25 * pace;
  }

  return { throttle, brake, steer };
}
