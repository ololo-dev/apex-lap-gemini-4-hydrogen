import { describe, expect, it } from 'vitest';
import { createInitialCarState } from '../src/sim/car';
import { resolveCarCollisions } from '../src/sim/collision';
import { computeOvertakeOffset } from '../src/sim/driver';
import {
  COUNTDOWN_SECONDS,
  createInitialRace,
  getCountdownDisplay,
  getPlayerRacer,
  getRaceStandings,
  RACE_LAPS,
  stepRace,
} from '../src/sim/race';
import { defaultTrack } from '../src/sim/track';
import { FIXED_DT } from '../src/sim/world';

const IDLE = { throttle: 0, brake: 0, steer: 0 };

describe('Race rules & rivals', () => {
  it('places 4 cars two-by-two behind the start line with player 4th', () => {
    const race = createInitialRace(defaultTrack, false);
    expect(race.racers).toHaveLength(4);
    const standings = getRaceStandings(race, defaultTrack);
    expect(standings[3].racer.config.isPlayer).toBe(true);
    expect(standings[3].position).toBe(4);

    // Each car has a distinct name, colour, and pace
    const names = new Set(race.racers.map((r) => r.config.name));
    const colors = new Set(race.racers.map((r) => r.config.color));
    expect(names.size).toBe(4);
    expect(colors.size).toBe(4);
  });

  it('holds all cars and clock during 3, 2, 1 countdown and starts on GO', () => {
    let race = createInitialRace(defaultTrack, true);
    const initialPositions = race.racers.map((r) => ({ x: r.car.x, z: r.car.z }));

    expect(getCountdownDisplay(race)).toBe('3');
    // Step 2.5 seconds (still in countdown)
    for (let i = 0; i < 150; i++) {
      race = stepRace(race, IDLE, defaultTrack, FIXED_DT);
    }
    expect(getCountdownDisplay(race)).toBe('1');
    expect(race.raceTime).toBe(0);
    race.racers.forEach((r, idx) => {
      expect(r.car.x).toBe(initialPositions[idx].x);
      expect(r.car.z).toBe(initialPositions[idx].z);
      expect(r.car.speed).toBe(0);
    });

    // Step past 3.0 seconds -> GO!
    for (let i = 0; i < 45; i++) {
      race = stepRace(race, IDLE, defaultTrack, FIXED_DT);
    }
    expect(getCountdownDisplay(race)).toBe('GO');
    expect(race.raceTime).toBeGreaterThan(0);
    expect(getPlayerRacer(race).car.speed).toBeGreaterThan(0);
  });

  it('pushes overlapping cars apart and reduces their speed on contact', () => {
    const a = createInitialCarState(10, 0, 0);
    a.vx = 30;
    a.speed = 30;
    a.forwardSpeed = 30;

    const b = createInitialCarState(12.2, 0, 0);
    b.vx = 10;
    b.speed = 10;
    b.forwardSpeed = 10;

    const [resA, resB] = resolveCarCollisions([a, b]);
    const sep = Math.hypot(resB.x - resA.x, resB.z - resA.z);
    expect(sep).toBeGreaterThan(2.2);
    expect(resA.speed).toBeLessThan(30);
  });

  it('steers a rival around a slower car ahead on the same line', () => {
    const s1 = defaultTrack.sampleAtDistance(20);
    const s2 = defaultTrack.sampleAtDistance(35);
    const behind = createInitialCarState(s1.x, s1.z, Math.atan2(s1.tz, s1.tx));
    const ahead = createInitialCarState(s2.x, s2.z, Math.atan2(s2.tz, s2.tx));
    const offset = computeOvertakeOffset(behind, [behind, ahead], defaultTrack);
    expect(Math.abs(offset)).toBeGreaterThan(2.5);
  });

  it('runs a deterministic 3-lap race with spread-out rivals and ordered results', () => {
    const run = () => {
      let race = createInitialRace(defaultTrack, true);
      const maxSteps = 60 * (COUNTDOWN_SECONDS + 180);
      for (let i = 0; i < maxSteps && !race.allFinished; i++) {
        race = stepRace(race, IDLE, defaultTrack, FIXED_DT);
      }
      return race;
    };

    const race1 = run();
    const race2 = run();

    expect(race1.allFinished).toBe(true);
    expect(race1.playerFinished).toBe(true);

    const s1 = getRaceStandings(race1, defaultTrack);
    const s2 = getRaceStandings(race2, defaultTrack);

    expect(s1.map((s) => s.racer.config.name)).toEqual(
      s2.map((s) => s.racer.config.name),
    );
    expect(s1.map((s) => s.racer.finishTime)).toEqual(
      s2.map((s) => s.racer.finishTime),
    );

    // Every car completed 3 laps and rivals are spread out
    for (const s of s1) {
      expect(s.racer.lap.laps).toBe(RACE_LAPS);
      expect(s.racer.finishTime).not.toBeNull();
      expect(s.racer.lap.bestLapTime).not.toBeNull();
    }
    const fastestTime = s1[0].racer.finishTime!;
    const slowestTime = s1[3].racer.finishTime!;
    expect(fastestTime).toBeLessThan(slowestTime);
    expect(slowestTime - fastestTime).toBeGreaterThan(4);
  }, 20000);
});
