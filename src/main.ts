import './style.css';
import { GameRenderer } from './render/renderer';
import { CarInput } from './sim/car';
import { advanceRaceClock, createInitialRace } from './sim/race';
import { defaultTrack } from './sim/track';
import { Hud } from './ui/hud';

const keys = new Set<string>();
const touchState = {
  left: false,
  right: false,
  gas: false,
  brake: false,
  boost: false,
};

const DRIVE_KEYS = new Set([
  'KeyW',
  'KeyS',
  'KeyA',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ShiftLeft',
  'ShiftRight',
  'Space',
]);

let raceState = createInitialRace(defaultTrack, false);
let accumulator = 0;

function readPlayerInput(): CarInput {
  const throttle =
    keys.has('KeyW') || keys.has('ArrowUp') || touchState.gas ? 1 : 0;
  const brake =
    keys.has('KeyS') || keys.has('ArrowDown') || touchState.brake ? 1 : 0;
  const left =
    keys.has('KeyA') || keys.has('ArrowLeft') || touchState.left ? 1 : 0;
  const right =
    keys.has('KeyD') || keys.has('ArrowRight') || touchState.right ? 1 : 0;
  const boost =
    keys.has('ShiftLeft') ||
    keys.has('ShiftRight') ||
    keys.has('Space') ||
    touchState.boost;
  return {
    throttle,
    brake,
    steer: right - left,
    boost,
  };
}

function toggleDemo(): void {
  raceState = { ...raceState, demoMode: !raceState.demoMode };
}

const viewport = document.getElementById('viewport')!;
const renderer = new GameRenderer(viewport, defaultTrack);

function resetRace(): void {
  raceState = createInitialRace(defaultTrack, false);
  accumulator = 0;
  renderer.resetCamera();
}

const hud = new Hud(toggleDemo, resetRace);

function bindTouchButton(
  id: string,
  key: keyof typeof touchState,
): void {
  const btn = document.getElementById(id);
  if (!btn) return;
  const setPressed = (down: boolean) => {
    touchState[key] = down;
    btn.classList.toggle('pressed', down);
    if (down && raceState.demoMode) {
      raceState = { ...raceState, demoMode: false };
    }
  };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    btn.setPointerCapture(e.pointerId);
    setPressed(true);
  });
  btn.addEventListener('pointerup', () => setPressed(false));
  btn.addEventListener('pointercancel', () => setPressed(false));
}

bindTouchButton('touch-left', 'left');
bindTouchButton('touch-right', 'right');
bindTouchButton('touch-gas', 'gas');
bindTouchButton('touch-brake', 'brake');
bindTouchButton('touch-boost', 'boost');

window.addEventListener('keydown', (e) => {
  if (DRIVE_KEYS.has(e.code)) {
    e.preventDefault();
    if (raceState.demoMode) {
      raceState = { ...raceState, demoMode: false };
    }
  }
  if (e.code === 'KeyM' && !e.repeat) {
    toggleDemo();
  }
  if (e.code === 'KeyR' && !e.repeat) {
    resetRace();
  }
  keys.add(e.code);
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
});

window.addEventListener('resize', () => {
  renderer.resize(viewport.clientWidth, viewport.clientHeight);
});

let lastFrameTime = performance.now();
function frame(now: number): void {
  const dt = (now - lastFrameTime) / 1000;
  lastFrameTime = now;

  const result = advanceRaceClock(
    raceState,
    accumulator,
    dt,
    readPlayerInput,
    defaultTrack,
  );
  raceState = result.state;
  accumulator = result.accumulator;

  renderer.render(raceState, dt);
  hud.update(raceState);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
