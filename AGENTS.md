# Kestrel R9 — Sunburst Ridge Circuit

A 3D browser racing game built with TypeScript, Three.js, and Vite, with a deterministic fixed-timestep simulation core decoupled from rendering.

## Stack

- **Language:** TypeScript (strict mode)
- **3D Rendering:** Three.js (`three`)
- **Bundler / Dev Server:** Vite (`vite`)
- **Testing & Coverage:** Vitest (`vitest`, `@vitest/coverage-v8`)
- **Headless CLI Runner:** `tsx`

## Project Layout

- `src/sim/` — Pure, browser-free simulation rules:
  - `track.ts` — 12-point closed Catmull-Rom circuit (12 m wide), arc-length sampling, closest-point projection, and start/checkpoint gate geometry.
  - `car.ts` — Fixed-timestep (`1/60 s`) car dynamics: acceleration up to 216 km/h (60 m/s) on road, 72 km/h (20 m/s) cap off-road, braking/reverse, speed-dependent steering, and lateral slip understeer.
  - `lap.ts` — Ordered 12-point checkpoint progression and forward-only start-line lap timing.
  - `driver.ts` — Autonomous demo driver using curvature lookahead for braking and steering.
  - `world.ts` — Combined simulation state, fixed-timestep accumulator, and step loop.
- `src/render/` — Three.js 3D scene, Kestrel R9 car mesh, track ribbon with kerbs and start gantry, roadside speed markers, and chase camera.
- `src/ui/` — HUD overlay (speed in km/h, lap counter, current/last/best lap times, off-road indicator, demo mode toggle, and controls legend).
- `src/cli/lap.ts` — Headless single-lap runner using the same simulation and demo driver.
- `src/main.ts` — Browser entry point wiring input, fixed-step simulation, Three.js renderer, and HUD.
- `tests/` — Unit and integration tests for track geometry, car physics, lap rules, fixed-step determinism, and autonomous lap completion.
- `docs/demo/` — Recorded `video/webm` screencast of a clean demo lap and three stills (start line, mid-corner, completed lap).

## Commands

run: npm run dev
test: npm test
coverage: npm run coverage
lap: npm run lap
race: npm run race
