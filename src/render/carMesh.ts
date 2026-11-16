import * as THREE from 'three';
import { CarState } from '../sim/car';

export interface CarVisual {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  frontLeftPivot: THREE.Group;
  frontRightPivot: THREE.Group;
  wheels: THREE.Mesh[];
  tailLightMat: THREE.MeshStandardMaterial;
  wheelSpin: number;
}

export interface CarVisualOptions {
  ghost?: boolean;
}

export function createCarVisual(
  paintColor: string | number = 0xe63928,
  options: CarVisualOptions = {},
): CarVisual {
  const isGhost = Boolean(options.ghost);
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const ghostProps = isGhost
    ? { transparent: true, opacity: 0.36, depthWrite: false }
    : {};

  const paintMat = new THREE.MeshStandardMaterial({
    color: paintColor,
    roughness: 0.3,
    metalness: 0.35,
    ...ghostProps,
  });
  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x1b1f27,
    roughness: 0.6,
    metalness: 0.25,
    ...ghostProps,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.35,
    metalness: 0.2,
    ...ghostProps,
  });
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.12,
    metalness: 0.85,
    ...ghostProps,
  });
  const tailLightMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    emissive: isGhost ? 0x38bdf8 : 0xef4444,
    emissiveIntensity: 0.4,
    roughness: 0.3,
    ...ghostProps,
  });
  const headLightMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfef08a,
    emissiveIntensity: isGhost ? 0.2 : 0.8,
    roughness: 0.2,
    ...ghostProps,
  });

  // Main chassis (+x is forward, 4.4m long, 1.9m wide)
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.46, 1.72), paintMat);
  chassis.position.set(0, 0.5, 0);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  bodyGroup.add(chassis);

  // Sloped nose cone
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.32, 1.45), paintMat);
  nose.position.set(1.8, 0.43, 0);
  nose.rotation.z = -0.14;
  nose.castShadow = true;
  bodyGroup.add(nose);

  // Racing stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.03, 0.36), accentMat);
  stripe.position.set(0.1, 0.74, 0);
  bodyGroup.add(stripe);

  // Front splitter
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.08, 1.88), carbonMat);
  splitter.position.set(2.15, 0.22, 0);
  splitter.castShadow = true;
  bodyGroup.add(splitter);

  // Sidepods / skirts
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.16, 1.86), carbonMat);
  skirt.position.set(-0.05, 0.26, 0);
  skirt.castShadow = true;
  bodyGroup.add(skirt);

  // Cockpit canopy
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.42, 1.12), canopyMat);
  canopy.position.set(-0.15, 0.88, 0);
  canopy.castShadow = true;
  bodyGroup.add(canopy);

  // Rear wing
  const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 1.94), carbonMat);
  wingBlade.position.set(-1.95, 1.15, 0);
  wingBlade.rotation.z = 0.08;
  wingBlade.castShadow = true;
  bodyGroup.add(wingBlade);

  for (const zSign of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.46, 0.07), carbonMat);
    strut.position.set(-1.92, 0.92, zSign * 0.55);
    strut.castShadow = true;
    bodyGroup.add(strut);

    const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.34, 0.05), paintMat);
    endplate.position.set(-1.95, 1.12, zSign * 0.97);
    bodyGroup.add(endplate);

    // Headlights
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.3), headLightMat);
    hl.position.set(2.3, 0.45, zSign * 0.52);
    bodyGroup.add(hl);

    // Taillights
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.13, 0.42), tailLightMat);
    tl.position.set(-2.07, 0.56, zSign * 0.55);
    bodyGroup.add(tl);
  }

  // Wheels
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x111318,
    roughness: 0.85,
    ...ghostProps,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.3,
    metalness: 0.8,
    ...ghostProps,
  });
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 20);
  wheelGeo.rotateX(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.3, 12);
  rimGeo.rotateX(Math.PI / 2);

  const wheels: THREE.Mesh[] = [];
  const makeWheel = (x: number, z: number): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.36, z);
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    tire.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, rimMat);
    tire.add(rim);
    pivot.add(tire);
    wheels.push(tire);
    root.add(pivot);
    return pivot;
  };

  const frontLeftPivot = makeWheel(1.38, -0.92);
  const frontRightPivot = makeWheel(1.38, 0.92);
  makeWheel(-1.32, -0.92);
  makeWheel(-1.32, 0.92);

  return {
    root,
    bodyGroup,
    frontLeftPivot,
    frontRightPivot,
    wheels,
    tailLightMat,
    wheelSpin: 0,
  };
}

export function updateCarVisual(
  visual: CarVisual,
  car: CarState,
  dt: number,
): void {
  visual.root.position.set(car.x, 0, car.z);
  visual.root.rotation.y = -car.yaw;

  // Front wheel steering
  visual.frontLeftPivot.rotation.y = -car.steerAngle;
  visual.frontRightPivot.rotation.y = -car.steerAngle;

  // Wheel rotation
  const wheelRadius = 0.36;
  visual.wheelSpin -= (car.forwardSpeed * dt) / wheelRadius;
  for (const w of visual.wheels) {
    w.rotation.z = visual.wheelSpin;
  }

  // Subtle body roll from lateral slip
  const targetRoll = Math.max(-0.08, Math.min(0.08, car.lateralSpeed * 0.012));
  visual.bodyGroup.rotation.x += (targetRoll - visual.bodyGroup.rotation.x) * 0.2;

  // Brake lights
  visual.tailLightMat.emissiveIntensity = car.braking ? 3.2 : 0.4;
}
