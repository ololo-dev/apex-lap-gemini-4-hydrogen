export const MAX_ROAD_SPEED = 60; // 216 km/h in m/s
export const MAX_BOOST_ROAD_SPEED = 75; // 270 km/h in m/s
export const MAX_OFFROAD_SPEED = 20; // 72 km/h in m/s
export const MAX_REVERSE_SPEED = 18; // 64.8 km/h in m/s
export const KMH_PER_MS = 3.6;
export const BOOST_BURN_SECONDS = 3;
export const BOOST_RECHARGE_SECONDS = 10;

export interface CarInput {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1 (left) .. +1 (right)
  boost?: boolean;
}

export interface CarState {
  x: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number; // radians, 0 = +x (east), +pi/2 = +z (south)
  steerAngle: number; // visual wheel steer angle in radians
  speed: number; // m/s magnitude
  forwardSpeed: number; // signed m/s along car heading
  lateralSpeed: number; // signed m/s perpendicular to heading
  offRoad: boolean;
  braking: boolean;
  boostCharge: number; // 0..1
  boosting: boolean;
}

export function createInitialCarState(x = 0, z = 0, yaw = 0): CarState {
  return {
    x,
    z,
    vx: 0,
    vz: 0,
    yaw,
    steerAngle: 0,
    speed: 0,
    forwardSpeed: 0,
    lateralSpeed: 0,
    offRoad: false,
    braking: false,
    boostCharge: 1,
    boosting: false,
  };
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function stepCar(
  car: CarState,
  input: CarInput,
  offRoad: boolean,
  dt: number,
): CarState {
  const throttle = clamp(input.throttle, 0, 1);
  const brake = clamp(input.brake, 0, 1);
  const steer = clamp(input.steer, -1, 1);
  const wantsBoost = Boolean(input.boost);

  let boostCharge = car.boostCharge;
  let boosting = false;
  if (wantsBoost && boostCharge > 0) {
    boosting = true;
    boostCharge = Math.max(0, boostCharge - dt / BOOST_BURN_SECONDS);
  } else {
    boostCharge = Math.min(1, boostCharge + dt / BOOST_RECHARGE_SECONDS);
  }

  const fx = Math.cos(car.yaw);
  const fz = Math.sin(car.yaw);
  const rx = -fz;
  const rz = fx;

  let vForward = car.vx * fx + car.vz * fz;
  let vLateral = car.vx * rx + car.vz * rz;

  // Longitudinal acceleration / braking / reverse
  const engineAccel = 18.0;
  const boostAccel = 16.0;
  const brakeDecel = 34.0;
  const reverseAccel = 11.0;
  const rollingDrag = 1.2;
  const aeroDrag = 0.0025;

  let braking = false;

  if (throttle > 0) {
    vForward += throttle * engineAccel * dt;
  }
  if (boosting) {
    vForward += boostAccel * dt;
  }

  if (brake > 0) {
    if (vForward > 0.25) {
      braking = true;
      vForward = Math.max(0, vForward - brake * brakeDecel * dt);
    } else {
      vForward -= brake * reverseAccel * dt;
    }
  }

  // Passive drag when not actively accelerating
  if (throttle === 0 && !boosting && brake === 0) {
    if (Math.abs(vForward) < 0.08) {
      vForward = 0;
    } else {
      const sign = vForward > 0 ? 1 : -1;
      const decel = (rollingDrag + aeroDrag * vForward * vForward) * dt;
      vForward =
        Math.abs(vForward) <= decel ? 0 : vForward - sign * decel;
    }
  } else {
    const sign = vForward >= 0 ? 1 : -1;
    vForward -= sign * aeroDrag * vForward * vForward * dt;
  }

  // Clamp longitudinal speed limits: off-road stays 72 km/h even when boosting
  const maxFwd = offRoad
    ? MAX_OFFROAD_SPEED
    : boosting
      ? MAX_BOOST_ROAD_SPEED
      : MAX_ROAD_SPEED;
  vForward = clamp(vForward, -MAX_REVERSE_SPEED, maxFwd);

  // Steering: car only turns when moving
  const absFwd = Math.abs(vForward);
  let yaw = car.yaw;
  if (absFwd > 0.15) {
    const moveFactor = clamp(absFwd / 5.0, 0, 1);
    const highSpeedDamping = 1 / (1 + 0.0075 * absFwd);
    const dir = vForward >= 0 ? 1 : -1;
    const maxYawRate = 1.75;
    const yawRate = steer * maxYawRate * moveFactor * highSpeedDamping * dir;
    yaw += yawRate * dt;
  }

  // Project velocity onto new heading for authentic lateral slip
  const worldVx = fx * vForward + rx * vLateral;
  const worldVz = fz * vForward + rz * vLateral;

  const nfx = Math.cos(yaw);
  const nfz = Math.sin(yaw);
  const nrx = -nfz;
  const nrz = nfx;

  vForward = worldVx * nfx + worldVz * nfz;
  vLateral = worldVx * nrx + worldVz * nrz;

  const maxLateralAccel = offRoad ? 14.0 : 24.0;
  const maxLatDelta = maxLateralAccel * dt;
  if (Math.abs(vLateral) <= maxLatDelta) {
    vLateral = 0;
  } else {
    vLateral -= Math.sign(vLateral) * maxLatDelta;
  }

  let vx = nfx * vForward + nrx * vLateral;
  let vz = nfz * vForward + nrz * vLateral;

  let speed = Math.hypot(vx, vz);
  if (speed > maxFwd && vForward >= 0) {
    const scale = maxFwd / speed;
    vx *= scale;
    vz *= scale;
    speed = maxFwd;
    vForward = vx * nfx + vz * nfz;
    vLateral = vx * nrx + vz * nrz;
  }

  const x = car.x + vx * dt;
  const z = car.z + vz * dt;

  return {
    x,
    z,
    vx,
    vz,
    yaw,
    steerAngle: steer * 0.45,
    speed,
    forwardSpeed: vForward,
    lateralSpeed: vLateral,
    offRoad,
    braking,
    boostCharge,
    boosting,
  };
}
