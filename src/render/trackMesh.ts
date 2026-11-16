import * as THREE from 'three';
import { ROAD_HALF_WIDTH, Track } from '../sim/track';
import {
  createAsphaltTexture,
  createCheckeredTexture,
  createGroundTexture,
} from './textures';

function buildRibbonGeometry(
  track: Track,
  innerOffset: number,
  outerOffset: number,
  y: number,
  uTile: number,
): THREE.BufferGeometry {
  const samples = track.samples;
  const n = samples.length;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= n; i++) {
    const s = samples[i % n];
    const dist = i === n ? track.totalLength : s.s;
    const v = dist / uTile;

    const x0 = s.x + s.nx * innerOffset;
    const z0 = s.z + s.nz * innerOffset;
    const x1 = s.x + s.nx * outerOffset;
    const z1 = s.z + s.nz * outerOffset;

    positions.push(x0, y, z0, x1, y, z1);
    normals.push(0, 1, 0, 0, 1, 0);
    uvs.push(0, v, 1, v);
  }

  for (let i = 0; i < n; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, c, b, d, c);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

export function buildWorldEnvironment(scene: THREE.Scene, track: Track): void {
  // Flat ground
  const groundTex = createGroundTexture();
  const groundGeo = new THREE.PlaneGeometry(1800, 1800);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshStandardMaterial({
    map: groundTex,
    roughness: 0.95,
    metalness: 0.0,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.set(20, 0, 100);
  ground.receiveShadow = true;
  scene.add(ground);

  // Main 12m road ribbon
  const asphaltTex = createAsphaltTexture();
  const roadGeo = buildRibbonGeometry(
    track,
    -ROAD_HALF_WIDTH,
    ROAD_HALF_WIDTH,
    0.03,
    12,
  );
  const roadMat = new THREE.MeshStandardMaterial({
    map: asphaltTex,
    roughness: 0.82,
    metalness: 0.05,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = true;
  scene.add(roadMesh);

  // Alternating red/white kerbs along both road edges (6.0m to 6.85m)
  const kerbRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.7 });
  const kerbWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 });
  const kerbBlockGeo = new THREE.BoxGeometry(2.6, 0.08, 0.85);
  const kerbInstRed = new THREE.InstancedMesh(
    kerbBlockGeo,
    kerbRedMat,
    track.samples.length,
  );
  const kerbInstWhite = new THREE.InstancedMesh(
    kerbBlockGeo,
    kerbWhiteMat,
    track.samples.length,
  );

  const dummy = new THREE.Object3D();
  let rIdx = 0;
  let wIdx = 0;
  for (let i = 0; i < track.samples.length; i += 2) {
    const s = track.samples[i];
    const yaw = Math.atan2(s.tz, s.tx);
    for (const side of [-1, 1]) {
      const offset = side * (ROAD_HALF_WIDTH + 0.42);
      dummy.position.set(s.x + s.nx * offset, 0.04, s.z + s.nz * offset);
      dummy.rotation.set(0, -yaw, 0);
      dummy.updateMatrix();
      if ((i / 2) % 2 === 0) {
        kerbInstRed.setMatrixAt(rIdx++, dummy.matrix);
      } else {
        kerbInstWhite.setMatrixAt(wIdx++, dummy.matrix);
      }
    }
  }
  kerbInstRed.count = rIdx;
  kerbInstWhite.count = wIdx;
  kerbInstRed.receiveShadow = true;
  kerbInstWhite.receiveShadow = true;
  scene.add(kerbInstRed, kerbInstWhite);

  // Start / Finish line & gantry at point A
  const startGate = track.gates[0];
  const startYaw = Math.atan2(startGate.tz, startGate.tx);
  const startGroup = new THREE.Group();
  startGroup.position.set(startGate.x, 0, startGate.z);
  startGroup.rotation.y = -startYaw;

  const finishStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_HALF_WIDTH * 2, 2.4),
    new THREE.MeshStandardMaterial({
      map: createCheckeredTexture(),
      roughness: 0.6,
    }),
  );
  finishStrip.rotation.x = -Math.PI / 2;
  finishStrip.rotation.z = Math.PI / 2;
  finishStrip.position.y = 0.05;
  finishStrip.receiveShadow = true;
  startGroup.add(finishStrip);

  // Overhead gantry
  const gantryMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.6,
    roughness: 0.35,
  });
  const bannerMat = new THREE.MeshStandardMaterial({
    color: 0xe63928,
    roughness: 0.4,
  });
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 6.2, 0.7), gantryMat);
    pillar.position.set(0, 3.1, side * (ROAD_HALF_WIDTH + 1.2));
    pillar.castShadow = true;
    startGroup.add(pillar);
  }
  const crossbar = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 1.3, ROAD_HALF_WIDTH * 2 + 3.2),
    gantryMat,
  );
  crossbar.position.set(0, 5.8, 0);
  crossbar.castShadow = true;
  startGroup.add(crossbar);

  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(1.16, 0.7, ROAD_HALF_WIDTH * 1.4),
    bannerMat,
  );
  banner.position.set(0, 5.8, 0);
  startGroup.add(banner);
  scene.add(startGroup);

  // Roadside speed-cue pylons, chevron boards, and stylized trees
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfacc15,
    emissiveIntensity: 1.2,
  });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2f6f4e, roughness: 0.85 });

  for (let dist = 25; dist < track.totalLength - 20; dist += 24) {
    const s = track.sampleAtDistance(dist);
    const yaw = Math.atan2(s.tz, s.tx);

    // Alternate sides for light poles
    const side = Math.floor(dist / 24) % 2 === 0 ? 1 : -1;
    const px = s.x + s.nx * (side * (ROAD_HALF_WIDTH + 3.2));
    const pz = s.z + s.nz * (side * (ROAD_HALF_WIDTH + 3.2));

    if (track.closestPoint(px, pz).distance > ROAD_HALF_WIDTH + 1.5) {
      const poleGroup = new THREE.Group();
      poleGroup.position.set(px, 0, pz);
      poleGroup.rotation.y = -yaw;

      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 4.6, 8), poleMat);
      post.position.y = 2.3;
      post.castShadow = true;
      poleGroup.add(post);

      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 1.4), poleMat);
      arm.position.set(0, 4.5, -side * 0.6);
      poleGroup.add(arm);

      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.45), lampMat);
      lamp.position.set(0, 4.42, -side * 1.15);
      poleGroup.add(lamp);

      scene.add(poleGroup);
    }

    // Trees further back for strong parallax & speed sense
    for (const treeSide of [-1, 1]) {
      const offset = treeSide * (ROAD_HALF_WIDTH + 11 + ((dist * 7) % 12));
      const tx = s.x + s.nx * offset;
      const tz = s.z + s.nz * offset;
      if (track.closestPoint(tx, tz).distance > ROAD_HALF_WIDTH + 8) {
        const tree = new THREE.Group();
        tree.position.set(tx, 0, tz);
        const scale = 0.85 + ((dist * 13) % 5) * 0.15;
        tree.scale.setScalar(scale);

        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.38, 2.2, 7), trunkMat);
        trunk.position.y = 1.1;
        trunk.castShadow = true;
        tree.add(trunk);

        const crown = new THREE.Mesh(new THREE.ConeGeometry(2.1, 5.4, 8), foliageMat);
        crown.position.y = 4.3;
        crown.castShadow = true;
        tree.add(crown);

        scene.add(tree);
      }
    }
  }
}
