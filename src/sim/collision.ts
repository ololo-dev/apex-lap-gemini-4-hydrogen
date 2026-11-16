import { CarState } from './car';

const CAPSULE_OFFSET = 1.05; // metres forward/backward from car center
const CAPSULE_RADIUS = 1.05; // metres (total width ~2.1 m, length ~4.2 m)
const MIN_DIST = CAPSULE_RADIUS * 2;

function getSpheres(car: CarState): [{ x: number; z: number }, { x: number; z: number }] {
  const fx = Math.cos(car.yaw) * CAPSULE_OFFSET;
  const fz = Math.sin(car.yaw) * CAPSULE_OFFSET;
  return [
    { x: car.x + fx, z: car.z + fz },
    { x: car.x - fx, z: car.z - fz },
  ];
}

function refreshSpeedComponents(car: CarState): CarState {
  const fx = Math.cos(car.yaw);
  const fz = Math.sin(car.yaw);
  const rx = -fz;
  const rz = fx;
  return {
    ...car,
    speed: Math.hypot(car.vx, car.vz),
    forwardSpeed: car.vx * fx + car.vz * fz,
    lateralSpeed: car.vx * rx + car.vz * rz,
  };
}

export function resolveCarCollisions(cars: CarState[]): CarState[] {
  const next = cars.map((c) => ({ ...c }));

  for (let i = 0; i < next.length; i++) {
    for (let j = i + 1; j < next.length; j++) {
      const a = next[i];
      const b = next[j];
      const spheresA = getSpheres(a);
      const spheresB = getSpheres(b);

      let maxOverlap = 0;
      let bestNx = 0;
      let bestNz = 0;

      for (const sa of spheresA) {
        for (const sb of spheresB) {
          const dx = sb.x - sa.x;
          const dz = sb.z - sa.z;
          const d = Math.hypot(dx, dz);
          if (d < MIN_DIST) {
            const overlap = MIN_DIST - d;
            if (overlap > maxOverlap) {
              maxOverlap = overlap;
              if (d > 1e-6) {
                bestNx = dx / d;
                bestNz = dz / d;
              } else {
                bestNx = 1;
                bestNz = 0;
              }
            }
          }
        }
      }

      if (maxOverlap > 0) {
        // Push both cars apart equally
        const push = maxOverlap * 0.5 + 1e-3;
        a.x -= bestNx * push;
        a.z -= bestNz * push;
        b.x += bestNx * push;
        b.z += bestNz * push;

        // Impulse + speed loss on contact
        const relVx = b.vx - a.vx;
        const relVz = b.vz - a.vz;
        const relNorm = relVx * bestNx + relVz * bestNz;

        if (relNorm < 0) {
          const restitution = 0.25;
          const impulse = -(1 + restitution) * relNorm * 0.5;
          a.vx -= bestNx * impulse;
          a.vz -= bestNz * impulse;
          b.vx += bestNx * impulse;
          b.vz += bestNz * impulse;
        }

        // Apply speed loss only on actual impact, not gentle side-by-side rubbing
        if (relNorm < -0.5) {
          a.vx *= 0.92;
          a.vz *= 0.92;
          b.vx *= 0.92;
          b.vz *= 0.92;
        }

        next[i] = refreshSpeedComponents(a);
        next[j] = refreshSpeedComponents(b);
      }
    }
  }

  return next;
}
