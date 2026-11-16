import { describe, expect, it } from 'vitest';
import {
  CIRCUIT_POINTS,
  defaultTrack,
  ROAD_HALF_WIDTH,
  ROAD_WIDTH,
} from '../src/sim/track';

describe('Track geometry', () => {
  it('defines a 12 m wide closed circuit passing through all 12 points', () => {
    expect(ROAD_WIDTH).toBe(12);
    expect(ROAD_HALF_WIDTH).toBe(6);
    expect(CIRCUIT_POINTS).toHaveLength(12);

    for (const pt of CIRCUIT_POINTS) {
      const closest = defaultTrack.closestPoint(pt.x, pt.z);
      expect(closest.distance).toBeLessThan(0.15);
    }
  });

  it('distinguishes on-road and off-road at the 6 m half-width boundary', () => {
    const s = defaultTrack.sampleAtDistance(50);
    expect(defaultTrack.isOnRoad(s.x, s.z)).toBe(true);
    expect(defaultTrack.isOnRoad(s.x + s.nx * 5.9, s.z + s.nz * 5.9)).toBe(true);
    expect(defaultTrack.isOnRoad(s.x + s.nx * 6.2, s.z + s.nz * 6.2)).toBe(false);
  });

  it('wraps arc-length queries around totalLength', () => {
    const a = defaultTrack.sampleAtDistance(15);
    const b = defaultTrack.sampleAtDistance(defaultTrack.totalLength + 15);
    expect(a.x).toBeCloseTo(b.x, 4);
    expect(a.z).toBeCloseTo(b.z, 4);
  });
});
