import { KMH_PER_MS } from '../sim/car';
import {
  getCountdownDisplay,
  getPlayerRacer,
  getRaceStandings,
  RACE_LAPS,
  RaceState,
} from '../sim/race';
import { defaultTrack } from '../sim/track';
import { Minimap } from './minimap';

export function formatLapTime(seconds: number | null): string {
  if (seconds === null) return '--:--.--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hundredths = Math.floor((seconds * 100) % 100);
  return `${mins}:${secs.toString().padStart(2, '0')}.${hundredths
    .toString()
    .padStart(2, '0')}`;
}

export class Hud {
  private readonly posEl: HTMLElement;
  private readonly speedEl: HTMLElement;
  private readonly boostBarEl: HTMLElement;
  private readonly lapNumberEl: HTMLElement;
  private readonly currentTimeEl: HTMLElement;
  private readonly lastTimeEl: HTMLElement;
  private readonly bestTimeEl: HTMLElement;
  private readonly offRoadEl: HTMLElement;
  private readonly countdownEl: HTMLElement;
  private readonly resultsEl: HTMLElement;
  private readonly resultsBodyEl: HTMLElement;
  private readonly demoBtnEl: HTMLButtonElement;
  private readonly minimap: Minimap;

  constructor(onToggleDemo: () => void, onReset: () => void) {
    this.posEl = document.getElementById('hud-pos')!;
    this.speedEl = document.getElementById('hud-speed')!;
    this.boostBarEl = document.getElementById('hud-boost-bar')!;
    this.lapNumberEl = document.getElementById('hud-lap')!;
    this.currentTimeEl = document.getElementById('hud-current-time')!;
    this.lastTimeEl = document.getElementById('hud-last-time')!;
    this.bestTimeEl = document.getElementById('hud-best-time')!;
    this.offRoadEl = document.getElementById('hud-offroad')!;
    this.countdownEl = document.getElementById('hud-countdown')!;
    this.resultsEl = document.getElementById('hud-results')!;
    this.resultsBodyEl = document.getElementById('results-body')!;
    this.demoBtnEl = document.getElementById('btn-demo') as HTMLButtonElement;

    const minimapCanvas = document.getElementById(
      'hud-minimap',
    ) as HTMLCanvasElement;
    this.minimap = new Minimap(minimapCanvas, defaultTrack);

    this.demoBtnEl.addEventListener('click', onToggleDemo);
    document.getElementById('btn-reset')!.addEventListener('click', onReset);
    document.getElementById('btn-new-race')!.addEventListener('click', onReset);
  }

  update(state: RaceState): void {
    const player = getPlayerRacer(state);
    const standings = getRaceStandings(state, defaultTrack);
    const playerStanding = standings.find((s) => s.racer.config.isPlayer);
    const pos = playerStanding ? playerStanding.position : 4;

    const kmh = Math.round(player.car.speed * KMH_PER_MS);
    this.posEl.textContent = `${pos} / ${state.racers.length}`;
    this.speedEl.textContent = String(kmh);

    const pct = Math.round(player.car.boostCharge * 100);
    this.boostBarEl.style.width = `${pct}%`;
    this.boostBarEl.classList.toggle('boosting', player.car.boosting);

    const displayLap = Math.min(RACE_LAPS, player.lap.laps + 1);
    this.lapNumberEl.textContent = `${displayLap} / ${RACE_LAPS}`;
    this.currentTimeEl.textContent = formatLapTime(player.lap.currentLapTime);
    this.lastTimeEl.textContent = formatLapTime(player.lap.lastLapTime);
    this.bestTimeEl.textContent = formatLapTime(player.lap.bestLapTime);

    this.offRoadEl.classList.toggle('visible', player.car.offRoad);

    const countdownLabel = getCountdownDisplay(state);
    this.countdownEl.textContent = countdownLabel ?? '';
    this.countdownEl.classList.toggle('visible', countdownLabel !== null);
    this.countdownEl.classList.toggle('go', countdownLabel === 'GO');

    this.demoBtnEl.classList.toggle('active', state.demoMode);
    this.demoBtnEl.textContent = state.demoMode
      ? 'DEMO ON (Any drive key to take over)'
      : 'DEMO MODE [M]';

    this.minimap.draw(state);

    this.resultsEl.classList.toggle('visible', state.playerFinished);
    if (state.playerFinished) {
      this.resultsBodyEl.innerHTML = standings
        .map((entry) => {
          const r = entry.racer;
          const timeText =
            r.finishTime !== null ? formatLapTime(r.finishTime) : 'On track';
          const bestText = formatLapTime(r.lap.bestLapTime);
          const rowClass = r.config.isPlayer ? ' class="player-row"' : '';
          return `<tr${rowClass}>
            <td>${entry.position}</td>
            <td><span class="swatch" style="background:${r.config.color}"></span>${r.config.name}</td>
            <td class="num">${timeText}</td>
            <td class="num">${bestText}</td>
          </tr>`;
        })
        .join('');
    }
  }
}
