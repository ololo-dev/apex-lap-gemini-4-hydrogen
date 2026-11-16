import * as THREE from 'three';
import { MAX_BOOST_ROAD_SPEED } from '../sim/car';
import {
  getGhostPose,
  getPlayerRacer,
  RACER_GRID_CONFIG,
  RaceState,
} from '../sim/race';
import { Track } from '../sim/track';
import { CarVisual, createCarVisual, updateCarVisual } from './carMesh';
import { buildWorldEnvironment } from './trackMesh';

export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  private readonly carVisuals = new Map<string, CarVisual>();
  private readonly ghostVisual: CarVisual;
  private readonly camPos = new THREE.Vector3();
  private readonly camLook = new THREE.Vector3();
  private camInitialized = false;
  private smoothSpeedRatio = 0;

  constructor(container: HTMLElement, track: Track) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xcbdcf0);
    this.scene.fog = new THREE.Fog(0xcbdcf0, 140, 520);

    this.camera = new THREE.PerspectiveCamera(
      56,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.5,
      900,
    );

    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x8c7a5b, 0.95);
    this.scene.add(hemiLight);

    const sun = new THREE.DirectionalLight(0xfff5e0, 1.85);
    sun.position.set(140, 180, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 20;
    sun.shadow.camera.far = 550;
    const d = 260;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    this.scene.add(sun);

    buildWorldEnvironment(this.scene, track);

    for (const cfg of RACER_GRID_CONFIG) {
      const visual = createCarVisual(cfg.color);
      this.carVisuals.set(cfg.id, visual);
      this.scene.add(visual.root);
    }

    this.ghostVisual = createCarVisual(0x38bdf8, { ghost: true });
    this.ghostVisual.root.visible = false;
    this.scene.add(this.ghostVisual.root);
  }

  resetCamera(): void {
    this.camInitialized = false;
    this.smoothSpeedRatio = 0;
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  render(state: RaceState, dt: number): void {
    const safeDt = Math.max(dt, 1 / 120);
    for (const racer of state.racers) {
      const visual = this.carVisuals.get(racer.config.id);
      if (visual) {
        updateCarVisual(visual, racer.car, safeDt);
      }
    }

    const ghostPose = getGhostPose(state);
    if (ghostPose) {
      this.ghostVisual.root.visible = true;
      this.ghostVisual.root.position.set(ghostPose.x, 0, ghostPose.z);
      this.ghostVisual.root.rotation.y = -ghostPose.yaw;
    } else {
      this.ghostVisual.root.visible = false;
    }

    const car = getPlayerRacer(state).car;
    const fx = Math.cos(car.yaw);
    const fz = Math.sin(car.yaw);

    // Smoothly stretch FOV and drop camera back as speed increases (no jumps)
    const targetSpeedRatio = Math.min(1, car.speed / MAX_BOOST_ROAD_SPEED);
    const speedBlend = 1 - Math.exp(-5.0 * safeDt);
    this.smoothSpeedRatio += (targetSpeedRatio - this.smoothSpeedRatio) * speedBlend;

    const followDist = 8.6 + this.smoothSpeedRatio * 3.8;
    const followHeight = 3.45 + this.smoothSpeedRatio * 0.55;
    const desiredCamX = car.x - fx * followDist;
    const desiredCamZ = car.z - fz * followDist;
    const desiredLookX = car.x + fx * (10 + this.smoothSpeedRatio * 3.0);
    const desiredLookZ = car.z + fz * (10 + this.smoothSpeedRatio * 3.0);

    if (!this.camInitialized) {
      this.camPos.set(desiredCamX, followHeight, desiredCamZ);
      this.camLook.set(desiredLookX, 1.0, desiredLookZ);
      this.camInitialized = true;
    } else {
      const posBlend = 1 - Math.exp(-9.0 * safeDt);
      const lookBlend = 1 - Math.exp(-12.0 * safeDt);
      this.camPos.lerp(
        new THREE.Vector3(desiredCamX, followHeight, desiredCamZ),
        posBlend,
      );
      this.camLook.lerp(
        new THREE.Vector3(desiredLookX, 1.0, desiredLookZ),
        lookBlend,
      );
    }

    const targetFov = 56 + this.smoothSpeedRatio * 22;
    if (Math.abs(this.camera.fov - targetFov) > 0.02) {
      this.camera.fov += (targetFov - this.camera.fov) * speedBlend;
      this.camera.updateProjectionMatrix();
    }

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.renderer.render(this.scene, this.camera);
  }
}
