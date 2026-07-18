// @ts-nocheck
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { BASE_CHARACTERS } from '../engine/characters-base.js';
import { MONSTERS } from '../engine/monsters.js';
import { createParticles } from '../engine/particles.js';
import { sfx } from '../audio';
import { normalizeGuardType } from '../roster';
import type { DungeonConfig, DungeonSceneHandle, HudState, InfiltratorType, RunResult } from '../types';
import { COLS, ROWS, SAMPLE_DUNGEON, START, VAULT } from '../dungeons';

interface Props {
  active: boolean;
  runId: number;
  dungeon?: DungeonConfig;
  infiltratorType: InfiltratorType;
  onHud: (state: HudState) => void;
  onFinish: (result: RunResult) => void;
}

const GAP = 1.15;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const cellKey = (c: number, r: number) => `${c},${r}`;
const worldFor = (c: number, r: number) => new THREE.Vector3((c - 2) * GAP, 0.22, (r - 3) * GAP);

function normalizeModel(group: THREE.Group, height = 0.92) {
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  box.getSize(size);
  const scale = height / Math.max(size.y, 0.01);
  group.scale.setScalar(scale);
  const after = new THREE.Box3().setFromObject(group);
  group.position.y -= after.min.y;
  return group;
}

function visionGeometry(length = 3.45, half = 0.72) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0,
    -half * length, 0, length,
    half * length, 0, length,
  ], 3));
  geo.setIndex([0, 1, 2]);
  geo.computeVertexNormals();
  return geo;
}

const DungeonScene = forwardRef<DungeonSceneHandle, Props>(function DungeonScene({ active, runId, dungeon = SAMPLE_DUNGEON, infiltratorType, onHud, onFinish }, ref) {
  const mountRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef({ useSmoke: () => {}, armDash: () => {} });
  const infiltratorSwapRef = useRef<(type: InfiltratorType) => void>(() => {});
  const onHudRef = useRef(onHud);
  const onFinishRef = useRef(onFinish);
  onHudRef.current = onHud;
  onFinishRef.current = onFinish;

  useImperativeHandle(ref, () => ({
    useSmoke: () => actionsRef.current.useSmoke(),
    armDash: () => actionsRef.current.armDash(),
  }), []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const BLOCKED = new Set(dungeon.blocked.map(({ c, r }) => cellKey(c, r)));
    const spikeKeys = new Set(dungeon.traps.filter((trap) => trap.type === 'spike').map((trap) => cellKey(trap.cell.c, trap.cell.r)));
    const runeKeys = new Set(dungeon.traps.filter((trap) => trap.type === 'rune').map((trap) => cellKey(trap.cell.c, trap.cell.r)));
    const guardRoute = dungeon.guards[0]?.route?.length >= 2 ? dungeon.guards[0].route : [{ c: 1, r: 3 }, { c: 3, r: 3 }];
    const guardType = normalizeGuardType(dungeon.guards[0]?.type);
    const guardStart = guardRoute[0];
    const guardEnd = guardRoute[guardRoute.length - 1];

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c1020);
    scene.fog = new THREE.Fog(0x15182d, 9.2, 18);

    const camera = new THREE.OrthographicCamera(-4, 4, 5, -5, 0.1, 40);
    camera.position.set(6.4, 10.8, 10.2);
    camera.lookAt(0, 0.1, 0.18);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.34, 0.48, 0.82));
    composer.addPass(new OutputPass());

    scene.add(new THREE.HemisphereLight(0x9aa8ff, 0x27182e, 0.62));
    const key = new THREE.DirectionalLight(0xffe6c9, 2.6);
    key.position.set(6.5, 16, 8); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -7; key.shadow.camera.right = 7;
    key.shadow.camera.top = 8; key.shadow.camera.bottom = -8;
    scene.add(key, key.target);
    const rim = new THREE.DirectionalLight(0x6f7cff, 0.7);
    rim.position.set(-7, 6, -5); scene.add(rim, rim.target);
    const vaultLight = new THREE.PointLight(0xffb83f, 4.0, 5.2, 2);
    vaultLight.position.copy(worldFor(VAULT.c, VAULT.r)).add(new THREE.Vector3(0, 1.2, 0));
    scene.add(vaultLight);
    const entranceLight = new THREE.PointLight(0x36e0d0, 4.2, 4.8, 2);
    entranceLight.position.copy(worldFor(START.c, START.r)).add(new THREE.Vector3(0, 0.72, 0));
    scene.add(entranceLight);

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(7.6, 0.35, 10.0),
      new THREE.MeshStandardMaterial({ color: 0x171c1d, roughness: 0.92 }),
    );
    floor.position.y = -0.25; floor.receiveShadow = true; scene.add(floor);

    const tileGeo = new THREE.BoxGeometry(1.03, 0.22, 1.03);
    const tileMat = new THREE.MeshStandardMaterial({ color: 0x918a80, roughness: 0.86 });
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0x5c5a54, roughness: 0.9 });
    const selectable: THREE.Mesh[] = [];
    const visionBlockers: THREE.Mesh[] = [];
    const tiles = new Map<string, THREE.Mesh>();
    const moveMarkers = new Map<string, THREE.LineLoop>();
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        const keyCell = cellKey(c, r);
        if (BLOCKED.has(keyCell)) continue;
        const tile = new THREE.Mesh(tileGeo, tileMat.clone());
        tile.position.copy(worldFor(c, r));
        tile.userData.cell = { c, r };
        if (c === START.c && r === START.r) {
          tile.material.emissive.setHex(0x0f665e);
          tile.material.emissiveIntensity = 0.42;
        } else if (c === VAULT.c && r === VAULT.r) {
          tile.material.emissive.setHex(0x6b4314);
          tile.material.emissiveIntensity = 0.5;
        }
        tile.receiveShadow = true;
        scene.add(tile); selectable.push(tile); tiles.set(keyCell, tile);
        const moveMarker = new THREE.LineLoop(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-0.42, 0, -0.42), new THREE.Vector3(0.42, 0, -0.42),
            new THREE.Vector3(0.42, 0, 0.42), new THREE.Vector3(-0.42, 0, 0.42),
          ]),
          new THREE.LineBasicMaterial({ color: 0x83e2ee, transparent: true, opacity: 0.72, depthWrite: false }),
        );
        moveMarker.position.copy(tile.position); moveMarker.position.y += 0.125;
        moveMarker.visible = false; moveMarker.renderOrder = 3;
        scene.add(moveMarker); moveMarkers.set(keyCell, moveMarker);
      }
    }

    const wallGeo = new THREE.BoxGeometry(1.03, 0.8, 1.03);
    const perimeterMat = new THREE.MeshPhysicalMaterial({ color: 0x272d31, roughness: 0.22, metalness: 0.72, clearcoat: 0.92, clearcoatRoughness: 0.08 });
    const wallCapMaterial = new THREE.MeshStandardMaterial({ color: 0xb9b1a5, roughness: 0.78, metalness: 0.06 });
    const wallReveals: Array<{ root: THREE.Group; delay: number; revealed: boolean }> = [];
    const propReveals: Array<{ root: THREE.Group; delay: number; color: number; revealed: boolean }> = [];
    let wallRevealIndex = 0;
    for (const keyCell of BLOCKED) {
      const [c, r] = keyCell.split(',').map(Number);
      const wallRoot = new THREE.Group();
      wallRoot.position.copy(worldFor(c, r)); wallRoot.position.y = 0.11;
      if (active) wallRoot.scale.set(0.9, 0.02, 0.9);
      const wall = new THREE.Mesh(wallGeo, perimeterMat);
      wall.position.y = 0.4;
      wall.castShadow = wall.receiveShadow = true;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.08, 0.82), wallCapMaterial);
      cap.position.y = 0.44;
      wall.add(cap); wallRoot.add(wall); scene.add(wallRoot); visionBlockers.push(wall);
      wallReveals.push({ root: wallRoot, delay: 0.08 + wallRevealIndex * 0.065, revealed: !active });
      wallRevealIndex += 1;
    }

    // Raised perimeter pieces make the dungeon read as a physical model.
    const longWall = new THREE.BoxGeometry(0.22, 0.54, 8.25);
    [-3.18, 3.18].forEach((x) => {
      const wall = new THREE.Mesh(longWall, perimeterMat); wall.position.set(x, 0.14, 0); wall.castShadow = true; scene.add(wall);
    });
    const endWall = new THREE.BoxGeometry(6.58, 0.54, 0.22);
    [-4.25, 4.25].forEach((z) => {
      const wall = new THREE.Mesh(endWall, perimeterMat); wall.position.set(0, 0.14, z); wall.castShadow = true; scene.add(wall);
    });

    const entranceRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.045, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0x3fb6ac }),
    );
    entranceRing.rotation.x = Math.PI / 2; entranceRing.rotation.z = Math.PI / 4;
    entranceRing.position.copy(worldFor(START.c, START.r)); entranceRing.position.y += 0.15;
    scene.add(entranceRing);
    const entrancePool = new THREE.Mesh(
      new THREE.CircleGeometry(1.32, 32),
      new THREE.MeshBasicMaterial({ color: 0x27c9bc, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    entrancePool.rotation.x = -Math.PI / 2;
    entrancePool.position.copy(worldFor(START.c, START.r)); entrancePool.position.y = 0.105;
    scene.add(entrancePool);
    const entrancePosts = new THREE.Group();
    const entrancePostMaterial = new THREE.MeshBasicMaterial({ color: 0x65e6ee, transparent: true, opacity: 0.88 });
    for (const [x, z] of [[-0.39, -0.39], [0.39, -0.39], [-0.39, 0.39], [0.39, 0.39]]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.58, 0.09), entrancePostMaterial);
      post.position.set(x, 0.29, z); entrancePosts.add(post);
    }
    entrancePosts.position.copy(worldFor(START.c, START.r)); entrancePosts.position.y = 0.28;
    scene.add(entrancePosts);

    const relic = new THREE.Group();
    const relicCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.34, 0),
      new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xe7b95c, emissiveIntensity: 1.1, roughness: 0.32 }),
    );
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.44, 0.32, 6), new THREE.MeshStandardMaterial({ color: 0x766445, roughness: 0.7, metalness: 0.2 }));
    const relicBeacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.13, 1.55, 4),
      new THREE.MeshBasicMaterial({ color: 0xffd578, transparent: true, opacity: 0.34, depthWrite: false }),
    );
    relicBeacon.position.y = 0.58;
    pedestal.position.y = -0.27; relic.add(relicBeacon, relicCore, pedestal);
    relic.position.copy(worldFor(VAULT.c, VAULT.r)); relic.position.y = 0.9; scene.add(relic);
    if (active) { relic.scale.setScalar(0.05); relic.rotation.z = -Math.PI / 2; }
    const relicReveal = { root: relic, delay: 0, color: 0xe7b95c, revealed: !active };
    const vaultPool = new THREE.Mesh(
      new THREE.CircleGeometry(1.38, 32),
      new THREE.MeshBasicMaterial({ color: 0xe7a83e, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    vaultPool.rotation.x = -Math.PI / 2;
    vaultPool.position.copy(worldFor(VAULT.c, VAULT.r)); vaultPool.position.y = 0.11;
    scene.add(vaultPool);

    const spikeGroups: THREE.Group[] = [];
    const spikeMat = new THREE.MeshPhysicalMaterial({ color: 0xb3c1c2, roughness: 0.16, metalness: 0.84, clearcoat: 0.86, clearcoatRoughness: 0.08 });
    for (const trap of dungeon.traps.filter((item) => item.type === 'spike')) {
      const spikeFixture = new THREE.Group();
      spikeFixture.position.copy(worldFor(trap.cell.c, trap.cell.r));
      if (active) { spikeFixture.scale.setScalar(0.05); spikeFixture.rotation.z = -Math.PI / 2; }
      const spikeBase = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.07, 0.9),
        new THREE.MeshPhysicalMaterial({ color: 0x7f241a, emissive: 0x3b100c, emissiveIntensity: 0.5, roughness: 0.24, metalness: 0.36, clearcoat: 0.9, clearcoatRoughness: 0.07 }),
      );
      spikeBase.position.y = 0.16; spikeFixture.add(spikeBase);
      const spikeGroup = new THREE.Group();
      for (let x = -1; x <= 1; x += 1) for (let z = -1; z <= 1; z += 1) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.52, 4), spikeMat);
        spike.position.set(x * 0.27, 0.18, z * 0.27); spike.rotation.y = Math.PI / 4; spike.castShadow = true; spikeGroup.add(spike);
      }
      spikeFixture.add(spikeGroup); scene.add(spikeFixture); spikeGroups.push(spikeGroup);
      propReveals.push({ root: spikeFixture, delay: 0, color: 0xeb7464, revealed: !active });
    }
    const runes = new Map<string, THREE.Mesh>();
    for (const trap of dungeon.traps.filter((item) => item.type === 'rune')) {
      const runeFixture = new THREE.Group();
      runeFixture.position.copy(worldFor(trap.cell.c, trap.cell.r));
      if (active) { runeFixture.scale.setScalar(0.05); runeFixture.rotation.z = -Math.PI / 2; }
      const rune = new THREE.Mesh(
        new THREE.RingGeometry(0.18, 0.38, 4),
        new THREE.MeshBasicMaterial({ color: 0xa43f3d, transparent: true, opacity: 0.76, side: THREE.DoubleSide }),
      );
      rune.rotation.x = -Math.PI / 2; rune.rotation.z = Math.PI / 4;
      const runeCrystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.16, 0),
        new THREE.MeshPhysicalMaterial({ color: 0xc879ee, emissive: 0x8e4db3, emissiveIntensity: 0.72, transparent: true, opacity: 0.88, roughness: 0.08, metalness: 0.04, transmission: 0.22, thickness: 0.28, ior: 1.45, clearcoat: 1, clearcoatRoughness: 0.03 }),
      );
      runeCrystal.position.z = 0.24; runeCrystal.rotation.x = Math.PI / 2; rune.add(runeCrystal);
      rune.position.y = 0.16; runeFixture.add(rune); scene.add(runeFixture);
      runes.set(cellKey(trap.cell.c, trap.cell.r), rune);
      propReveals.push({ root: runeFixture, delay: 0, color: 0x8e4db3, revealed: !active });
    }
    propReveals.push(relicReveal);
    propReveals.forEach((item, index) => { item.delay = 0.3 + (propReveals.length <= 1 ? 0 : index / (propReveals.length - 1)) * 0.38; });

    const playerRoot = new THREE.Group();
    let playerModel: THREE.Group | null = null;
    let playerRig: Record<string, THREE.Group> | null = null;
    let renderedInfiltrator = infiltratorType;
    let playerMaterialStates: Array<{ material: THREE.MeshStandardMaterial; color: number; emissive: number; emissiveIntensity: number }> = [];
    const disposePlayerModel = (model: THREE.Group | null) => model?.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => material.dispose());
    });
    const installPlayerModel = (type: InfiltratorType) => {
      if (playerModel && renderedInfiltrator === type) return;
      if (playerModel) { playerRoot.remove(playerModel); disposePlayerModel(playerModel); }
      playerMaterialStates = [];
      playerModel = normalizeModel(BASE_CHARACTERS[type](), 0.94);
      playerModel.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const cloned = source.map((material) => material.clone() as THREE.MeshStandardMaterial);
        mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
        cloned.forEach((material) => {
          playerMaterialStates.push({
            material,
            color: material.color.getHex(),
            emissive: material.emissive.getHex(),
            emissiveIntensity: material.emissiveIntensity,
          });
        });
      });
      playerRoot.add(playerModel);
      playerRig = playerModel.userData.rig || null;
      renderedInfiltrator = type;
      mount.dataset.infiltratorType = type;
    };
    installPlayerModel(infiltratorType);
    infiltratorSwapRef.current = installPlayerModel;
    playerRoot.position.copy(worldFor(START.c, START.r)); playerRoot.position.y = 0.33;
    playerRoot.rotation.y = Math.PI; scene.add(playerRoot);
    const playerMarker = new THREE.Mesh(
      new THREE.TorusGeometry(0.35, 0.035, 5, 24),
      new THREE.MeshBasicMaterial({ color: 0x8ae1d8, transparent: true, opacity: 0.86 }),
    );
    playerMarker.rotation.x = Math.PI / 2;
    playerMarker.position.y = 0.04;
    playerRoot.add(playerMarker);
    const playerFocusLight = new THREE.PointLight(0x8eeaf2, 5.2, 8.0, 1.4);
    playerFocusLight.position.set(0, 1.7, 0);
    playerRoot.add(playerFocusLight);
    const playerBeacon = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.12, 0),
      new THREE.MeshBasicMaterial({ color: 0x83e2ee, depthTest: false }),
    );
    playerBeacon.position.y = 1.38; playerBeacon.renderOrder = 8;
    playerRoot.add(playerBeacon);
    function setPlayerDeathTint(enabled: boolean) {
      playerMaterialStates.forEach(({ material, color, emissive, emissiveIntensity }) => {
        material.color.setHex(enabled ? 0xff3b30 : color);
        material.emissive.setHex(enabled ? 0xff170f : emissive);
        material.emissiveIntensity = enabled ? 1.18 : emissiveIntensity;
      });
      (playerMarker.material as THREE.MeshBasicMaterial).color.setHex(enabled ? 0xff655d : 0x8ae1d8);
      (playerBeacon.material as THREE.MeshBasicMaterial).color.setHex(enabled ? 0xff4a3f : 0x83e2ee);
      playerFocusLight.color.setHex(enabled ? 0xff3029 : 0x8eeaf2);
      playerFocusLight.intensity = enabled ? 8.2 : 5.2;
      mount.dataset.playerTint = enabled ? 'warning-red' : 'normal';
    }

    const guardRoot = new THREE.Group();
    const guardModel = normalizeModel(MONSTERS[guardType](), 1.03);
    guardRoot.add(guardModel); guardRoot.position.copy(worldFor(guardStart.c, guardStart.r)); guardRoot.position.y = 0.33;
    scene.add(guardRoot);
    const guardRig = guardModel.userData.rig;
    const guardLight = new THREE.PointLight(0xd63f55, 0.8, 2.5, 2);
    guardLight.position.set(0, 0.78, 0);
    guardRoot.add(guardLight);
    const guardMarker = new THREE.Mesh(
      new THREE.TorusGeometry(0.39, 0.045, 4, 24),
      new THREE.MeshBasicMaterial({ color: 0xeb7464, transparent: true, opacity: 0.82 }),
    );
    guardMarker.rotation.x = Math.PI / 2; guardMarker.position.y = 0.035;
    guardRoot.add(guardMarker);

    const vision = new THREE.Mesh(
      visionGeometry(3.45, 0.24),
      new THREE.MeshBasicMaterial({ color: 0xe94f4a, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false }),
    );
    vision.position.y = 0.16; guardRoot.add(vision);
    const visionOutline = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.19, 0),
        new THREE.Vector3(-0.83, 0.19, 3.45),
        new THREE.Vector3(0.83, 0.19, 3.45),
        new THREE.Vector3(0, 0.19, 0),
      ]),
      new THREE.LineBasicMaterial({ color: 0xff796b, transparent: true, opacity: 0.82, depthWrite: false }),
    );
    visionOutline.renderOrder = 4; guardRoot.add(visionOutline);
    const alertMarker = new THREE.Group();
    const alertMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0xff806f, depthTest: false });
    const alertBar = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.34, 0.11), alertMarkerMaterial);
    alertBar.position.y = 0.22;
    const alertDot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), alertMarkerMaterial);
    alertDot.position.y = -0.08;
    alertMarker.add(alertBar, alertDot); alertMarker.position.y = 1.36; alertMarker.visible = false; alertMarker.renderOrder = 8;
    guardRoot.add(alertMarker);

    const exitArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 1.05, 0x65e6ee, 0.28, 0.18);
    exitArrow.visible = false; exitArrow.line.material.depthTest = false; exitArrow.cone.material.depthTest = false;
    exitArrow.line.renderOrder = 7; exitArrow.cone.renderOrder = 7; scene.add(exitArrow);

    const particles = createParticles(scene, THREE, { poolSize: 96 });
    const rings: Array<{ mesh: THREE.Mesh; life: number; max: number }> = [];

    const raycaster = new THREE.Raycaster();
    const visionRaycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const clock = new THREE.Clock();
    const baseCamera = camera.position.clone();
    const baseKey = key.position.clone();
    const baseRim = rim.position.clone();
    const cameraFocus = new THREE.Vector3(0, 0.1, 0);
    const cameraGoal = new THREE.Vector3();
    const deathHoldFocus = new THREE.Vector3();
    const deathSubjectFocus = new THREE.Vector3();
    const spawnFocus = worldFor(START.c, START.r).multiply(new THREE.Vector3(0.78, 0, 0.72));
    spawnFocus.y = 0.1;
    const lightOffset = new THREE.Vector3();
    const deathTiming = { hold: 500, push: 1200, burstHold: 400, travel: 1000, pullout: 900 };
    const deathOrbit = reduceMotion
      ? { closeup: -0.14, spawn: 0.1 }
      : { closeup: -0.46, spawn: 0.32 };
    const state = {
      health: 3, alert: 0, hasLoot: false, smokeReady: true, dashReady: true, dashArmed: false,
      smokeUntil: 0, alarms: 0, timeLeft: 75, elapsed: 0, moving: false, moveT: 0,
      moveDuration: 0.22, current: { ...START }, from: { ...START }, target: { ...START },
      guardProgress: 0, guardDir: 1, guardPause: 0.5, sightTime: 0, chaseUntil: 0,
      invulnerableUntil: 0, usedRunes: new Set<string>(), ended: false, freezeUntil: 0, shakeUntil: 0,
      respawning: false, cameraTransition: (active ? 'introPending' : 'normal') as 'normal' | 'introPending' | 'intro' | 'death' | 'revive', cameraTransitionAt: 0,
      cameraTransitionElapsed: 0, userZoom: 1, deathStartZoom: 1, deathPeakZoom: 3.8,
      lastHud: 0, selectedTile: null as THREE.Mesh | null,
    };
    mount.dataset.effectActive = active ? 'true' : 'false';
    mount.dataset.initialCameraTransition = state.cameraTransition;

    function hudSnapshot(): HudState {
      return {
        timeLeft: Math.max(0, state.timeLeft), health: state.health, alert: Math.max(0, Math.min(100, state.alert)),
        hasLoot: state.hasLoot, smokeReady: state.smokeReady, dashReady: state.dashReady,
        dashArmed: state.dashArmed, alarms: state.alarms,
      };
    }
    onHudRef.current(hudSnapshot());

    function addRing(position: THREE.Vector3, color: number, duration = 0.7) {
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(0.38, 0.035, 5, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }),
      );
      mesh.rotation.x = Math.PI / 2; mesh.position.copy(position); mesh.position.y += 0.25;
      scene.add(mesh); rings.push({ mesh, life: duration, max: duration });
    }

    let finishRaf = 0;
    function finish(won: boolean, reason: RunResult['reason']) {
      if (state.ended) return;
      state.ended = true;
      const score = won ? Math.max(0, Math.round(2000 + state.timeLeft * 20 + state.health * 250 + (state.smokeReady ? 150 : 0) + (state.dashReady ? 150 : 0) - state.alarms * 180)) : 0;
      if (won) sfx.win(); else sfx.lose();
      const result = { ...hudSnapshot(), won, reason, score };
      onHudRef.current(hudSnapshot());
      finishRaf = requestAnimationFrame(() => onFinishRef.current(result));
    }

    let deathBurstDone = false;
    function burstPlayer() {
      if (deathBurstDone) return;
      deathBurstDone = true;
      playerRoot.visible = false; mount.dataset.death = 'burst';
      particles.burst(playerRoot.position.x, 0.7, playerRoot.position.z, 0xeb7464, { count: reduceMotion ? 8 : 14, speed: 3.5, up: 3.0, size: 0.15, life: 0.65, emissive: 0.62 });
      sfx.lose();
    }

    function revealPlayerAtSpawn() {
      state.health = 3; state.current = { ...START }; state.target = { ...START }; state.from = { ...START };
      playerRoot.position.copy(worldFor(START.c, START.r)); playerRoot.position.y = 0.33;
      playerRoot.scale.setScalar(reduceMotion ? 1 : 0.08);
      setPlayerDeathTint(false);
      playerRoot.visible = true; state.invulnerableUntil = state.elapsed + 1.2;
      state.cameraTransition = 'revive'; state.cameraTransitionAt = performance.now(); state.cameraTransitionElapsed = 0;
      mount.dataset.death = 'recovering'; addRing(playerRoot.position, 0x65e6ee, 0.52); onHudRef.current(hudSnapshot());
      requestAnimationFrame(() => { if (mount.dataset.death === 'recovering') delete mount.dataset.death; });
    }

    function respawn() {
      if (state.respawning || state.ended) return;
      state.respawning = true; state.moving = false; state.dashArmed = false;
      state.freezeUntil = performance.now();
      state.shakeUntil = performance.now();
      state.cameraTransition = 'death'; state.cameraTransitionAt = performance.now(); state.cameraTransitionElapsed = 0;
      deathBurstDone = false;
      state.deathStartZoom = state.userZoom;
      state.deathPeakZoom = Math.min(4.2, Math.max(3.8, state.userZoom + 2.8));
      deathHoldFocus.copy(cameraFocus);
      deathSubjectFocus.set(playerRoot.position.x * 0.78, 0.1, playerRoot.position.z * 0.72);
      setPlayerDeathTint(true);
      state.timeLeft = Math.max(1, state.timeLeft - 8); state.alert = 0; state.hasLoot = false;
      state.smokeReady = true; state.dashReady = true; state.smokeUntil = 0;
      relic.visible = true; exitArrow.visible = false; mount.dataset.death = 'highlighted'; onHudRef.current(hudSnapshot());
    }

    function hit(reason = 'guard') {
      if (!active || state.ended || state.respawning || state.elapsed < state.invulnerableUntil) return;
      state.health -= 1; state.invulnerableUntil = state.elapsed + 1.0;
      state.freezeUntil = performance.now() + (reduceMotion ? 0 : 55);
      state.shakeUntil = performance.now() + (reduceMotion ? 0 : 140);
      if (state.health > 0) particles.burst(playerRoot.position.x, 0.7, playerRoot.position.z, 0xe36a58, { count: reduceMotion ? 5 : 10, speed: 2.3, up: 2.1, size: 0.09, life: 0.52, emissive: 0.25 });
      sfx.hit(); onHudRef.current(hudSnapshot());
      if (state.health <= 0) {
        mount.dataset.damageOutcome = 'lethal-cinematic';
        respawn();
      }
      else if (reason === 'guard' && !state.hasLoot) {
        const knockback = state.from.c === state.current.c && state.from.r === state.current.r ? state.current : state.from;
        state.current = { ...knockback }; state.target = { ...knockback }; state.from = { ...knockback }; state.moving = false;
        playerRoot.position.copy(worldFor(knockback.c, knockback.r)); playerRoot.position.y = 0.33;
        mount.dataset.damageOutcome = 'guard-knockback';
      } else mount.dataset.damageOutcome = 'hit-in-place';
    }

    function triggerAlert(amount = 35) {
      state.alert = Math.min(100, state.alert + amount); state.alarms += 1;
      state.chaseUntil = state.elapsed + 2.5; state.freezeUntil = performance.now() + (reduceMotion ? 0 : 55);
      state.shakeUntil = performance.now() + (reduceMotion ? 0 : 140);
      particles.burst(guardRoot.position.x, 1.55, guardRoot.position.z, 0xe36a58, { count: reduceMotion ? 3 : 6, speed: 1.1, up: 1.6, size: 0.1, life: 0.5, emissive: 0.45 });
      sfx.alert(); onHudRef.current(hudSnapshot());
      if (state.alert >= 100) { state.timeLeft = Math.max(0, state.timeLeft - 12); state.alert = 55; }
    }

    function collectLoot() {
      if (state.hasLoot) return;
      state.hasLoot = true; relic.visible = false;
      particles.burst(relic.position.x, 0.85, relic.position.z, 0xe7b95c, { count: reduceMotion ? 12 : 24, speed: 3.2, up: 3.2, size: 0.12, life: 0.7, emissive: 0.65 });
      addRing(relic.position, 0xffe2a0, 0.7); sfx.loot(); onHudRef.current(hudSnapshot());
      state.chaseUntil = state.elapsed + 3.5;
      entranceRing.scale.setScalar(1.34);
    }

    function resolveCell() {
      const keyCell = cellKey(state.current.c, state.current.r);
      if (spikeKeys.has(keyCell) && ((state.elapsed % 1.4) > 1.1)) hit('spike');
      if (runeKeys.has(keyCell) && !state.usedRunes.has(keyCell)) { state.usedRunes.add(keyCell); const usedRune = runes.get(keyCell); if (usedRune) usedRune.visible = false; triggerAlert(45); }
      if (state.current.c === VAULT.c && state.current.r === VAULT.r) collectLoot();
      if (state.hasLoot && state.current.c === START.c && state.current.r === START.r) finish(true, 'escaped');
    }

    function tryMove(c: number, r: number) {
      if (!active || state.ended || state.respawning || state.cameraTransition === 'intro' || state.cameraTransition === 'introPending' || state.moving) return;
      const dc = c - state.current.c, dr = r - state.current.r;
      if (Math.abs(dc) + Math.abs(dr) !== 1 || BLOCKED.has(cellKey(c, r))) { sfx.reject(); return; }
      let target = { c, r };
      if (state.dashArmed && state.dashReady) {
        const c2 = state.current.c + dc * 2, r2 = state.current.r + dr * 2;
        if (c2 >= 0 && c2 < COLS && r2 >= 0 && r2 < ROWS && !BLOCKED.has(cellKey(c2, r2))) {
          target = { c: c2, r: r2 }; state.dashReady = false;
        }
        state.dashArmed = false;
      }
      state.from = { ...state.current }; state.target = target; state.moving = true; state.moveT = 0;
      state.moveDuration = (Math.abs(target.c - state.current.c) + Math.abs(target.r - state.current.r)) > 1 ? 0.26 : 0.22;
      playerRoot.rotation.y = Math.atan2(target.c - state.current.c, target.r - state.current.r);
      sfx.move(); onHudRef.current(hudSnapshot());
    }

    actionsRef.current.useSmoke = () => {
      if (!active || !state.smokeReady || state.ended || state.respawning || state.cameraTransition === 'intro' || state.cameraTransition === 'introPending') return;
      state.smokeReady = false; state.smokeUntil = state.elapsed + 3;
      for (let i = 0; i < 3; i += 1) particles.puffFx(playerRoot.position.x, 0.45 + i * 0.12, playerRoot.position.z, { count: reduceMotion ? 3 : 6, color: 0xaaa59c, size: 0.22, life: 0.8, grav: 0.3 });
      sfx.smoke(); onHudRef.current(hudSnapshot());
    };
    actionsRef.current.armDash = () => {
      if (!active || !state.dashReady || state.ended || state.respawning || state.cameraTransition === 'intro' || state.cameraTransition === 'introPending') return;
      state.dashArmed = !state.dashArmed; onHudRef.current(hudSnapshot());
      addRing(playerRoot.position, 0x3fb6ac, 0.36);
    };

    const activePointers = new Map<number, { x: number; y: number }>();
    let tapCandidate: { pointerId: number; startX: number; startY: number; tile: THREE.Mesh } | null = null;
    let pinchStartDistance = 0;
    let pinchStartZoom = 1;
    let gestureUsedPinch = false;

    function tileAt(clientX: number, clientY: number) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(selectable, false)[0]?.object as THREE.Mesh | undefined;
    }

    function pointerDistance() {
      const points = [...activePointers.values()];
      if (points.length < 2) return 0;
      return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    }

    function onPointerDown(event: PointerEvent) {
      event.preventDefault();
      if (activePointers.size === 0) gestureUsedPinch = false;
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      try { renderer.domElement.setPointerCapture?.(event.pointerId); } catch { /* Synthetic QA events have no native capture target. */ }
      if (activePointers.size >= 2) {
        gestureUsedPinch = true; tapCandidate = null;
        pinchStartDistance = Math.max(1, pointerDistance()); pinchStartZoom = state.userZoom;
        mount.dataset.pinch = 'active';
        return;
      }
      const hitTile = tileAt(event.clientX, event.clientY);
      if (!hitTile) return;
      if (state.selectedTile) (state.selectedTile.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
      state.selectedTile = hitTile;
      (hitTile.material as THREE.MeshStandardMaterial).emissive.setHex(0x174a45);
      (hitTile.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.55;
      tapCandidate = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, tile: hitTile };
    }

    function onPointerMove(event: PointerEvent) {
      if (!activePointers.has(event.pointerId)) return;
      event.preventDefault(); activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (activePointers.size >= 2) {
        gestureUsedPinch = true; tapCandidate = null;
        const distance = pointerDistance();
        state.userZoom = THREE.MathUtils.clamp(pinchStartZoom * (distance / Math.max(1, pinchStartDistance)), 0.72, 1.55);
        mount.dataset.userZoom = state.userZoom.toFixed(3);
      } else if (tapCandidate && Math.hypot(event.clientX - tapCandidate.startX, event.clientY - tapCandidate.startY) > 10) {
        tapCandidate = null;
      }
    }

    function endPointer(event: PointerEvent) {
      if (!activePointers.has(event.pointerId)) return;
      const shouldTap = activePointers.size === 1 && !gestureUsedPinch && tapCandidate?.pointerId === event.pointerId;
      const tile = shouldTap ? tapCandidate?.tile : null;
      activePointers.delete(event.pointerId); tapCandidate = null;
      if (activePointers.size < 2) mount.dataset.pinch = 'idle';
      if (activePointers.size === 0) gestureUsedPinch = false;
      if (tile) { const { c, r } = tile.userData.cell; tryMove(c, r); }
    }

    function onKeyDown(event: KeyboardEvent) {
      const dirs: Record<string, [number, number]> = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
      if (event.key === ' ') { event.preventDefault(); actionsRef.current.useSmoke(); return; }
      if (event.key === 'Shift') { actionsRef.current.armDash(); return; }
      const dir = dirs[event.key]; if (dir) { event.preventDefault(); tryMove(state.current.c + dir[0], state.current.r + dir[1]); }
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', endPointer);
    renderer.domElement.addEventListener('pointercancel', endPointer);
    window.addEventListener('keydown', onKeyDown);

    function resize() {
      const w = mount.clientWidth || 390, h = mount.clientHeight || 844;
      renderer.setSize(w, h, false); composer.setSize(w, h);
      const aspect = w / h;
      const view = 5.35;
      camera.left = -view * aspect; camera.right = view * aspect; camera.top = view; camera.bottom = -view;
      camera.updateProjectionMatrix();
    }
    const observer = new ResizeObserver(resize); observer.observe(mount); resize();

    let raf = 0;
    function animate() {
      raf = requestAnimationFrame(animate);
      const rawDt = Math.min(clock.getDelta(), 0.05);
      const now = performance.now();
      if (state.cameraTransition === 'death' || state.cameraTransition === 'revive') state.cameraTransitionElapsed += rawDt * 1000;
      if (state.cameraTransition === 'death' && state.cameraTransitionElapsed >= deathTiming.hold + deathTiming.push) burstPlayer();
      const frozen = active && now < state.freezeUntil;
      const dt = frozen || (active && (state.cameraTransition === 'intro' || state.cameraTransition === 'introPending')) ? 0 : rawDt;
      const t = clock.elapsedTime;
      const ambientDt = rawDt;
      const visualT = t;

      let revealedWalls = 0;
      let revealedProps = 0;
      if (state.cameraTransition === 'intro' || state.cameraTransition === 'introPending') {
        const introDuration = reduceMotion ? 240 : 1600;
        const introP = state.cameraTransition === 'introPending' ? 0 : Math.min(1, (now - state.cameraTransitionAt) / introDuration);
        wallReveals.forEach((item) => {
          const local = THREE.MathUtils.clamp((introP - item.delay) / 0.32, 0, 1);
          const c1 = reduceMotion ? 0 : 1.25;
          const c3 = c1 + 1;
          const grow = local === 0 ? 0 : 1 + c3 * Math.pow(local - 1, 3) + c1 * Math.pow(local - 1, 2);
          const settled = THREE.MathUtils.clamp(grow, 0, 1.08);
          item.root.scale.set(0.9 + Math.min(1, settled) * 0.1, 0.02 + settled * 0.98, 0.9 + Math.min(1, settled) * 0.1);
          if (local > 0.05 && !item.revealed) {
            item.revealed = true;
            particles.puffFx(item.root.position.x, 0.16, item.root.position.z, { count: reduceMotion ? 1 : 3, color: 0x77736c, size: 0.07, life: 0.38, grav: 1.0 });
          }
          if (local >= 1) revealedWalls += 1;
        });
        propReveals.forEach((item) => {
          const local = THREE.MathUtils.clamp((introP - item.delay) / 0.28, 0, 1);
          const c1 = reduceMotion ? 0 : 1.4;
          const c3 = c1 + 1;
          const flip = local === 0 ? 0 : 1 + c3 * Math.pow(local - 1, 3) + c1 * Math.pow(local - 1, 2);
          const settled = THREE.MathUtils.clamp(flip, 0, 1.1);
          item.root.scale.setScalar(0.05 + settled * 0.95);
          item.root.rotation.z = THREE.MathUtils.lerp(-Math.PI / 2, 0, Math.min(1, settled));
          if (local > 0.05 && !item.revealed) {
            item.revealed = true;
            particles.puffFx(item.root.position.x, Math.max(0.14, item.root.position.y), item.root.position.z, { count: reduceMotion ? 1 : 3, color: item.color, size: 0.065, life: 0.4, grav: 0.9 });
          }
          if (local >= 1) revealedProps += 1;
        });
      } else {
        wallReveals.forEach((item) => { item.root.scale.set(1, 1, 1); revealedWalls += 1; });
        propReveals.forEach((item) => { item.root.scale.setScalar(1); item.root.rotation.z = 0; revealedProps += 1; });
      }
      mount.dataset.obstacleReveal = `${revealedWalls}/${wallReveals.length}`;
      mount.dataset.obstacleRevealPhase = revealedWalls === wallReveals.length ? 'settled' : 'growing';
      mount.dataset.propReveal = `${revealedProps}/${propReveals.length}`;
      mount.dataset.propRevealPhase = revealedProps === propReveals.length ? 'settled' : 'flipping';

      relicCore.rotation.y += ambientDt * 1.5;
      relicCore.position.y = Math.sin(visualT * 2.4) * 0.06;
      relicBeacon.rotation.y -= ambientDt * 0.7;
      (relicBeacon.material as THREE.MeshBasicMaterial).opacity = 0.28 + Math.sin(visualT * 2.2) * 0.07;
      vaultLight.intensity = 3.8 + Math.sin(visualT * 2.2) * 0.35;
      const extractionBoost = state.hasLoot && !state.ended ? 1.55 : 1;
      entranceLight.intensity = (4.0 + Math.sin(visualT * 1.7) * 0.3) * extractionBoost;
      entrancePool.material.opacity = (0.14 + Math.sin(visualT * 1.7) * 0.025) * extractionBoost;
      entranceRing.scale.lerp(new THREE.Vector3(extractionBoost > 1 ? 1.34 : 1, extractionBoost > 1 ? 1.34 : 1, extractionBoost > 1 ? 1.34 : 1), Math.min(1, ambientDt * 8));
      entrancePosts.scale.y = extractionBoost > 1 ? 1.12 + Math.sin(visualT * 5) * 0.04 : 1;
      entrancePostMaterial.opacity = extractionBoost > 1 ? 1 : 0.82 + Math.sin(visualT * 2) * 0.08;
      vaultPool.material.opacity = 0.13 + Math.sin(visualT * 2.2) * 0.025;
      runes.forEach((rune) => {
        (rune.material as THREE.MeshBasicMaterial).opacity = 0.52 + Math.sin(visualT * 4) * 0.2;
        if (rune.children[0]) rune.children[0].rotation.y += ambientDt * 1.8;
      });
      const spikeActive = (state.elapsed % 1.4) > 1.1;
      spikeGroups.forEach((spikeGroup) => { spikeGroup.position.y += ((spikeActive ? 0.17 : -0.12) - spikeGroup.position.y) * Math.min(1, ambientDt * 18); });
      playerBeacon.position.y = 1.38 + Math.sin(visualT * 4.2) * 0.045;
      playerBeacon.rotation.y += ambientDt * 1.4;
      guardMarker.scale.setScalar(1 + Math.sin(visualT * 3.2) * 0.035);

      let visibleMoveTargets = 0;
      moveMarkers.forEach((marker, keyCell) => {
        const [c, r] = keyCell.split(',').map(Number);
        const adjacent = Math.abs(c - state.current.c) + Math.abs(r - state.current.r) === 1;
        marker.visible = active && !state.ended && !state.respawning && !state.moving && adjacent;
        if (marker.visible) {
          visibleMoveTargets += 1;
          (marker.material as THREE.LineBasicMaterial).opacity = 0.58 + Math.sin(visualT * 5) * 0.12;
        }
      });
      mount.dataset.moveTargets = String(visibleMoveTargets);

      if (active && !state.ended) {
        state.elapsed += dt;
        if (!state.respawning) state.timeLeft -= dt;
        state.alert = Math.max(0, state.alert - dt * 8);
        if (!state.respawning && state.timeLeft <= 0) finish(false, 'timeout');

        if (state.moving) {
          state.moveT += dt / state.moveDuration;
          const p = Math.min(1, state.moveT);
          const eased = 1 - Math.pow(1 - p, 3);
          const from = worldFor(state.from.c, state.from.r), to = worldFor(state.target.c, state.target.r);
          playerRoot.position.lerpVectors(from, to, eased); playerRoot.position.y = 0.33 + Math.sin(p * Math.PI) * 0.11;
          if (playerRig) {
            const stride = Math.sin(p * Math.PI * (state.moveDuration < 0.24 ? 2 : 3)) * 0.72;
            playerRig.legL.rotation.x = stride; playerRig.legR.rotation.x = -stride;
            playerRig.armL.rotation.x = -stride * 0.7; playerRig.armR.rotation.x = stride * 0.7;
          }
          if (p >= 1) {
            state.moving = false; state.current = { ...state.target }; playerRoot.position.copy(to); playerRoot.position.y = 0.33;
            if (playerRig) playerRig.legL.rotation.x = playerRig.legR.rotation.x = playerRig.armL.rotation.x = playerRig.armR.rotation.x = 0;
            particles.puffFx(playerRoot.position.x, 0.38, playerRoot.position.z, { count: 4, color: 0x77736c, size: 0.08, life: 0.36, grav: 1.1 });
            resolveCell();
          }
        }

        // Patrol from column 1 to 3 along row 3.
        if (state.guardPause > 0) state.guardPause -= dt;
        else {
          const speed = state.elapsed < state.chaseUntil ? 1.55 : 1.05;
          state.guardProgress += state.guardDir * speed * dt / Math.max(1, Math.abs(guardEnd.c - guardStart.c) + Math.abs(guardEnd.r - guardStart.r));
          if (state.guardProgress >= 1) { state.guardProgress = 1; state.guardDir = -1; state.guardPause = 0.5; }
          if (state.guardProgress <= 0) { state.guardProgress = 0; state.guardDir = 1; state.guardPause = 0.5; }
        }
        const patrolFrom = worldFor(guardStart.c, guardStart.r), patrolTo = worldFor(guardEnd.c, guardEnd.r);
        guardRoot.position.lerpVectors(patrolFrom, patrolTo, state.guardProgress); guardRoot.position.y = 0.33 + Math.abs(Math.sin(visualT * (state.elapsed < state.chaseUntil ? 9 : 6))) * 0.035;
        const patrolDx = (guardEnd.c - guardStart.c) * state.guardDir;
        const patrolDz = (guardEnd.r - guardStart.r) * state.guardDir;
        guardRoot.rotation.y = Math.atan2(patrolDx, patrolDz);
        guardLight.intensity = state.elapsed < state.chaseUntil ? 2.4 : 0.8 + Math.sin(visualT * 2.6) * 0.12;
        if (guardRig) {
          const gait = state.guardPause > 0 ? 0 : Math.sin(visualT * (state.elapsed < state.chaseUntil ? 10 : 7)) * 0.58;
          guardRig.legL.rotation.x = gait; guardRig.legR.rotation.x = -gait;
          guardRig.armL.rotation.x = -gait * 0.55; guardRig.armR.rotation.x = gait * 0.55;
        }

        const toPlayer = playerRoot.position.clone().sub(guardRoot.position); toPlayer.y = 0;
        const distance = toPlayer.length();
        const facing = new THREE.Vector3(0, 0, 1).applyQuaternion(guardRoot.quaternion).normalize();
        const sightDirection = distance > 0.001 ? toPlayer.clone().normalize() : new THREE.Vector3();
        visionRaycaster.set(guardRoot.position.clone().add(new THREE.Vector3(0, 0.52, 0)), sightDirection);
        const wallHit = visionRaycaster.intersectObjects(visionBlockers, false)[0];
        const lineClear = !wallHit || wallHit.distance >= distance - 0.18;
        const visible = state.elapsed > 1.2 && state.elapsed > state.smokeUntil && distance < 3.45 && sightDirection.dot(facing) > 0.84 && lineClear;
        mount.dataset.guardSight = visible ? 'visible' : lineClear ? 'outside-cone' : 'blocked';
        if (visible) {
          state.sightTime += dt;
          vision.material.opacity = 0.42 + Math.sin(visualT * 12) * 0.1;
          visionOutline.material.opacity = 0.92 + Math.sin(visualT * 12) * 0.08;
          alertMarker.visible = true; alertMarker.scale.setScalar(1 + Math.max(0, Math.sin(visualT * 12)) * 0.18);
          if (state.sightTime >= 0.32) { state.sightTime = -2.1; triggerAlert(35); }
        } else {
          state.sightTime = Math.max(0, state.sightTime - dt * 2); vision.material.opacity = 0.24;
          visionOutline.material.opacity = 0.82; alertMarker.visible = state.elapsed < state.chaseUntil;
          alertMarker.scale.setScalar(state.elapsed < state.chaseUntil ? 1 + Math.max(0, Math.sin(visualT * 10)) * 0.14 : 1);
        }
        if (distance < 0.52 && state.elapsed > state.smokeUntil) hit('guard');

        if (state.elapsed - state.lastHud > 0.1) { state.lastHud = state.elapsed; onHudRef.current(hudSnapshot()); }
      } else {
        playerRoot.position.y = 0.33 + Math.sin(visualT * 2.2) * 0.025;
        const idleP = (Math.sin(visualT * 0.7) + 1) / 2;
        guardRoot.position.lerpVectors(worldFor(guardStart.c, guardStart.r), worldFor(guardEnd.c, guardEnd.r), idleP);
        guardRoot.position.y = 0.33; guardRoot.rotation.y = Math.atan2(guardEnd.c - guardStart.c, guardEnd.r - guardStart.r);
      }

      for (let i = rings.length - 1; i >= 0; i -= 1) {
        const ring = rings[i]; ring.life -= rawDt;
        const p = 1 - Math.max(0, ring.life) / ring.max;
        ring.mesh.scale.setScalar(0.45 + p * 3.4); ring.mesh.material.opacity = (1 - p) * 0.9;
        if (ring.life <= 0) { scene.remove(ring.mesh); ring.mesh.geometry.dispose(); ring.mesh.material.dispose(); rings.splice(i, 1); }
      }
      particles.updateParticles(rawDt);

      let orbitAngle = 0;
      let finishDeathTravel = false;
      if (state.cameraTransition === 'intro' || state.cameraTransition === 'introPending') {
        const duration = reduceMotion ? 240 : 1600;
        const p = state.cameraTransition === 'introPending' ? 0 : Math.min(1, (now - state.cameraTransitionAt) / duration);
        const eased = p * p * (3 - 2 * p);
        cameraFocus.set(0, 0.1, THREE.MathUtils.lerp(-1.55, playerRoot.position.z * 0.72, eased));
        orbitAngle = (1 - eased) * 0.38;
        camera.zoom = THREE.MathUtils.lerp(0.72, state.userZoom, eased);
        if (p >= 1) state.cameraTransition = 'normal';
      } else if (state.cameraTransition === 'death') {
        const age = state.cameraTransitionElapsed;
        const pushStart = deathTiming.hold;
        const burstStart = pushStart + deathTiming.push;
        const travelStart = burstStart + deathTiming.burstHold;
        if (age < pushStart) {
          cameraFocus.copy(deathHoldFocus);
          camera.zoom = state.deathStartZoom;
          mount.dataset.deathCameraPhase = 'character-highlight';
        } else if (age < burstStart) {
          const p = THREE.MathUtils.clamp((age - pushStart) / deathTiming.push, 0, 1);
          const eased = p * p * (3 - 2 * p);
          cameraFocus.lerpVectors(deathHoldFocus, deathSubjectFocus, eased);
          orbitAngle = THREE.MathUtils.lerp(0, deathOrbit.closeup, eased);
          camera.zoom = THREE.MathUtils.lerp(state.deathStartZoom, state.deathPeakZoom, eased);
          mount.dataset.deathCameraPhase = 'push-orbit';
        } else if (age < travelStart) {
          cameraFocus.copy(deathSubjectFocus);
          orbitAngle = deathOrbit.closeup;
          camera.zoom = state.deathPeakZoom;
          mount.dataset.deathCameraPhase = 'burst-hold';
        } else {
          const p = THREE.MathUtils.clamp((age - travelStart) / deathTiming.travel, 0, 1);
          const eased = p * p * (3 - 2 * p);
          cameraFocus.lerpVectors(deathSubjectFocus, spawnFocus, eased);
          orbitAngle = THREE.MathUtils.lerp(deathOrbit.closeup, deathOrbit.spawn, eased);
          camera.zoom = state.deathPeakZoom;
          mount.dataset.deathCameraPhase = 'travel-to-spawn';
          finishDeathTravel = p >= 1;
        }
      } else if (state.cameraTransition === 'revive') {
        const p = Math.min(1, state.cameraTransitionElapsed / deathTiming.pullout);
        const eased = p * p * (3 - 2 * p);
        cameraFocus.copy(spawnFocus);
        orbitAngle = THREE.MathUtils.lerp(deathOrbit.spawn, 0, eased);
        camera.zoom = THREE.MathUtils.lerp(state.deathPeakZoom, state.userZoom, eased);
        if (!reduceMotion) {
          const appearP = THREE.MathUtils.clamp(p / 0.38, 0, 1);
          const overshoot = 1.12;
          const c3 = overshoot + 1;
          const appearScale = 1 + c3 * Math.pow(appearP - 1, 3) + overshoot * Math.pow(appearP - 1, 2);
          playerRoot.scale.setScalar(Math.max(0.08, appearScale));
        }
        mount.dataset.deathCameraPhase = p < 0.38 ? 'respawn-appear' : p < 1 ? 'rotate-pullout' : 'settled';
        if (p >= 1) {
          playerRoot.scale.setScalar(1);
          state.respawning = false;
          state.invulnerableUntil = state.elapsed + 1.2;
          state.cameraTransition = 'normal';
        }
      } else {
        cameraGoal.set(playerRoot.position.x * 0.78, 0.1, playerRoot.position.z * 0.72);
        cameraFocus.lerp(cameraGoal, 1 - Math.exp(-rawDt / 0.11));
        camera.zoom = state.userZoom;
        mount.dataset.deathCameraPhase = 'idle';
      }
      const orbitCos = Math.cos(orbitAngle), orbitSin = Math.sin(orbitAngle);
      camera.position.set(
        baseCamera.x * orbitCos - baseCamera.z * orbitSin + cameraFocus.x,
        baseCamera.y,
        baseCamera.x * orbitSin + baseCamera.z * orbitCos + cameraFocus.z,
      );
      if (now < state.shakeUntil && state.cameraTransition === 'normal') { camera.position.x += (Math.random() - 0.5) * 0.06; camera.position.y += (Math.random() - 0.5) * 0.04; }
      camera.updateProjectionMatrix();
      camera.lookAt(cameraFocus.x, cameraFocus.y, cameraFocus.z);
      key.position.copy(baseKey).add(lightOffset.set(playerRoot.position.x, 0, playerRoot.position.z));
      key.target.position.set(playerRoot.position.x, 0.18, playerRoot.position.z);
      rim.position.copy(baseRim).add(lightOffset.set(playerRoot.position.x, 0, playerRoot.position.z));
      rim.target.position.set(playerRoot.position.x, 0.18, playerRoot.position.z);
      if (state.hasLoot && !state.ended) {
        const toExit = worldFor(START.c, START.r).sub(playerRoot.position); toExit.y = 0;
        exitArrow.visible = toExit.lengthSq() > 0.08;
        if (exitArrow.visible) {
          exitArrow.position.copy(playerRoot.position).add(new THREE.Vector3(0, 1.34, 0));
          exitArrow.setDirection(toExit.normalize()); exitArrow.setLength(1.05, 0.28, 0.18);
        }
      } else exitArrow.visible = false;
      mount.dataset.exitArrow = exitArrow.visible ? 'visible' : 'hidden';
      mount.dataset.playerPosition = `${playerRoot.position.x.toFixed(3)},${playerRoot.position.z.toFixed(3)}`;
      mount.dataset.currentCell = `${state.current.c},${state.current.r}`;
      mount.dataset.health = String(state.health);
      mount.dataset.spikePhase = (state.elapsed % 1.4).toFixed(3);
      mount.dataset.spikeActive = (state.elapsed % 1.4) > 1.1 ? 'true' : 'false';
      mount.dataset.respawning = state.respawning ? 'true' : 'false';
      mount.dataset.cameraTransition = state.cameraTransition;
      mount.dataset.cameraZoom = camera.zoom.toFixed(3);
      mount.dataset.cameraOrbit = orbitAngle.toFixed(3);
      mount.dataset.userZoom = state.userZoom.toFixed(3);
      playerFocusLight.getWorldPosition(lightOffset);
      mount.dataset.playerLightPosition = `${lightOffset.x.toFixed(3)},${lightOffset.z.toFixed(3)}`;
      mount.dataset.playerLightIntensity = playerFocusLight.intensity.toFixed(1);
      mount.dataset.cameraTransitionAge = String(Math.round(
        state.cameraTransition === 'death' || state.cameraTransition === 'revive'
          ? state.cameraTransitionElapsed
          : now - state.cameraTransitionAt,
      ));
      mount.dataset.cameraFocus = `${cameraFocus.x.toFixed(3)},${cameraFocus.z.toFixed(3)}`;
      mount.dataset.guardForward = `${new THREE.Vector3(0, 0, 1).applyQuaternion(guardRoot.quaternion).x.toFixed(3)},${new THREE.Vector3(0, 0, 1).applyQuaternion(guardRoot.quaternion).z.toFixed(3)}`;
      mount.dataset.guardPosition = `${guardRoot.position.x.toFixed(3)},${guardRoot.position.z.toFixed(3)}`;
      mount.dataset.readabilityMarkers = 'player,entrance,relic,guard,spike,rune,moves';
      mount.dataset.materialVocabulary = 'dark-reflective-wall,matte-stone-cap,metal-foundation,crystal';
      mount.dataset.infiltratorType = renderedInfiltrator;
      mount.dataset.guardType = guardType;
      composer.render();
      if (finishDeathTravel && state.cameraTransition === 'death') revealPlayerAtSpawn();
    }
    if (active) {
      const openingAngle = 0.38;
      const openingCos = Math.cos(openingAngle), openingSin = Math.sin(openingAngle);
      cameraFocus.set(0, 0.1, -1.55); camera.zoom = 0.72;
      camera.position.set(
        baseCamera.x * openingCos - baseCamera.z * openingSin + cameraFocus.x,
        baseCamera.y,
        baseCamera.x * openingSin + baseCamera.z * openingCos + cameraFocus.z,
      );
      camera.lookAt(cameraFocus); camera.updateProjectionMatrix();
    }
    composer.render();
    state.cameraTransitionAt = active ? 0 : performance.now();
    const introStartTimer = window.setTimeout(() => {
      if (state.cameraTransition === 'introPending') {
        state.cameraTransition = 'intro'; state.cameraTransitionAt = performance.now();
      }
    }, 60);
    animate();

    return () => {
      cancelAnimationFrame(raf); cancelAnimationFrame(finishRaf); clearTimeout(introStartTimer); observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', endPointer);
      renderer.domElement.removeEventListener('pointercancel', endPointer);
      window.removeEventListener('keydown', onKeyDown);
      actionsRef.current = { useSmoke: () => {}, armDash: () => {} };
      infiltratorSwapRef.current = () => {};
      disposePlayerModel(playerModel);
      composer.dispose(); renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, [active, runId, dungeon]);

  useEffect(() => { infiltratorSwapRef.current(infiltratorType); }, [infiltratorType]);

  return <div className="ds-scene" ref={mountRef} aria-label="3D dungeon playfield" />;
});

export default DungeonScene;
