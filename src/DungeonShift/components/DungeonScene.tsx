// @ts-nocheck
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { BASE_CHARACTERS } from '../engine/characters-base.js';
import { vampire } from '../engine/monsters.js';
import { createParticles } from '../engine/particles.js';
import { sfx } from '../audio';
import type { DungeonConfig, DungeonSceneHandle, HudState, RunResult } from '../types';
import { COLS, ROWS, SAMPLE_DUNGEON, START, VAULT } from '../dungeons';

interface Props {
  active: boolean;
  runId: number;
  dungeon?: DungeonConfig;
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
    length, 0, -half * length,
    length, 0, half * length,
  ], 3));
  geo.setIndex([0, 1, 2]);
  geo.computeVertexNormals();
  return geo;
}

const DungeonScene = forwardRef<DungeonSceneHandle, Props>(function DungeonScene({ active, runId, dungeon = SAMPLE_DUNGEON, onHud, onFinish }, ref) {
  const mountRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef({ useSmoke: () => {}, armDash: () => {} });

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

    scene.add(new THREE.HemisphereLight(0x9aa8ff, 0x27182e, 0.48));
    const key = new THREE.DirectionalLight(0xffe6c9, 2.6);
    key.position.set(6.5, 16, 8); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -7; key.shadow.camera.right = 7;
    key.shadow.camera.top = 8; key.shadow.camera.bottom = -8;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x6f7cff, 0.7);
    rim.position.set(-7, 6, -5); scene.add(rim);
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
    const tiles = new Map<string, THREE.Mesh>();
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
      }
    }

    const wallGeo = new THREE.BoxGeometry(1.03, 0.8, 1.03);
    for (const keyCell of BLOCKED) {
      const [c, r] = keyCell.split(',').map(Number);
      const wall = new THREE.Mesh(wallGeo, edgeMat.clone());
      wall.position.copy(worldFor(c, r)); wall.position.y = 0.51;
      wall.castShadow = wall.receiveShadow = true;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.08, 0.82), new THREE.MeshStandardMaterial({ color: 0xb9b1a5, roughness: 0.8 }));
      cap.position.y = 0.44; wall.add(cap); scene.add(wall);
    }

    // Raised perimeter pieces make the dungeon read as a physical model.
    const perimeterMat = new THREE.MeshStandardMaterial({ color: 0x494a46, roughness: 0.88 });
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

    const relic = new THREE.Group();
    const relicCore = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 0),
      new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xe7b95c, emissiveIntensity: 1.1, roughness: 0.32 }),
    );
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.44, 0.32, 6), new THREE.MeshStandardMaterial({ color: 0x766445, roughness: 0.7, metalness: 0.2 }));
    pedestal.position.y = -0.27; relic.add(relicCore, pedestal);
    relic.position.copy(worldFor(VAULT.c, VAULT.r)); relic.position.y = 0.9; scene.add(relic);
    const vaultPool = new THREE.Mesh(
      new THREE.CircleGeometry(1.38, 32),
      new THREE.MeshBasicMaterial({ color: 0xe7a83e, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    vaultPool.rotation.x = -Math.PI / 2;
    vaultPool.position.copy(worldFor(VAULT.c, VAULT.r)); vaultPool.position.y = 0.11;
    scene.add(vaultPool);

    const spikeGroups: THREE.Group[] = [];
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0x8b8c83, roughness: 0.52, metalness: 0.35 });
    for (const trap of dungeon.traps.filter((item) => item.type === 'spike')) {
      const spikeGroup = new THREE.Group();
      for (let x = -1; x <= 1; x += 1) for (let z = -1; z <= 1; z += 1) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.42, 4), spikeMat);
        spike.position.set(x * 0.27, 0.14, z * 0.27); spike.rotation.y = Math.PI / 4; spike.castShadow = true; spikeGroup.add(spike);
      }
      spikeGroup.position.copy(worldFor(trap.cell.c, trap.cell.r)); scene.add(spikeGroup); spikeGroups.push(spikeGroup);
    }
    const runes = new Map<string, THREE.Mesh>();
    for (const trap of dungeon.traps.filter((item) => item.type === 'rune')) {
      const rune = new THREE.Mesh(
        new THREE.RingGeometry(0.18, 0.38, 4),
        new THREE.MeshBasicMaterial({ color: 0xa43f3d, transparent: true, opacity: 0.76, side: THREE.DoubleSide }),
      );
      rune.rotation.x = -Math.PI / 2; rune.rotation.z = Math.PI / 4;
      rune.position.copy(worldFor(trap.cell.c, trap.cell.r)); rune.position.y += 0.16; scene.add(rune);
      runes.set(cellKey(trap.cell.c, trap.cell.r), rune);
    }

    const playerRoot = new THREE.Group();
    const playerModel = normalizeModel(BASE_CHARACTERS.teen(), 0.94);
    playerRoot.add(playerModel); playerRoot.position.copy(worldFor(START.c, START.r)); playerRoot.position.y = 0.33;
    playerRoot.rotation.y = Math.PI; scene.add(playerRoot);
    const playerRig = playerModel.userData.rig;
    const playerMarker = new THREE.Mesh(
      new THREE.TorusGeometry(0.35, 0.035, 5, 24),
      new THREE.MeshBasicMaterial({ color: 0x8ae1d8, transparent: true, opacity: 0.86 }),
    );
    playerMarker.rotation.x = Math.PI / 2;
    playerMarker.position.y = 0.04;
    playerRoot.add(playerMarker);

    const guardRoot = new THREE.Group();
    const guardModel = normalizeModel(vampire(), 1.03);
    guardRoot.add(guardModel); guardRoot.position.copy(worldFor(guardStart.c, guardStart.r)); guardRoot.position.y = 0.33;
    scene.add(guardRoot);
    const guardRig = guardModel.userData.rig;
    const guardLight = new THREE.PointLight(0xd63f55, 0.8, 2.5, 2);
    guardLight.position.set(0, 0.78, 0);
    guardRoot.add(guardLight);

    const vision = new THREE.Mesh(
      visionGeometry(3.45, 0.24),
      new THREE.MeshBasicMaterial({ color: 0xe36a58, transparent: true, opacity: 0.23, side: THREE.DoubleSide, depthWrite: false }),
    );
    vision.rotation.x = -Math.PI / 2; vision.position.y = 0.18; guardRoot.add(vision);

    const particles = createParticles(scene, THREE, { poolSize: 96 });
    const rings: Array<{ mesh: THREE.Mesh; life: number; max: number }> = [];

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const clock = new THREE.Clock();
    const baseCamera = camera.position.clone();
    const state = {
      health: 3, alert: 0, hasLoot: false, smokeReady: true, dashReady: true, dashArmed: false,
      smokeUntil: 0, alarms: 0, timeLeft: 75, elapsed: 0, moving: false, moveT: 0,
      moveDuration: 0.22, current: { ...START }, from: { ...START }, target: { ...START },
      guardProgress: 0, guardDir: 1, guardPause: 0.5, sightTime: 0, chaseUntil: 0,
      invulnerableUntil: 0, usedRunes: new Set<string>(), ended: false, freezeUntil: 0, shakeUntil: 0,
      lastHud: 0, selectedTile: null as THREE.Mesh | null,
    };

    function hudSnapshot(): HudState {
      return {
        timeLeft: Math.max(0, state.timeLeft), health: state.health, alert: Math.max(0, Math.min(100, state.alert)),
        hasLoot: state.hasLoot, smokeReady: state.smokeReady, dashReady: state.dashReady,
        dashArmed: state.dashArmed, alarms: state.alarms,
      };
    }
    onHud(hudSnapshot());

    function addRing(position: THREE.Vector3, color: number, duration = 0.7) {
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(0.38, 0.035, 5, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }),
      );
      mesh.rotation.x = Math.PI / 2; mesh.position.copy(position); mesh.position.y += 0.25;
      scene.add(mesh); rings.push({ mesh, life: duration, max: duration });
    }

    function finish(won: boolean, reason: RunResult['reason']) {
      if (state.ended) return;
      state.ended = true;
      const score = won ? Math.max(0, Math.round(2000 + state.timeLeft * 20 + state.health * 250 + (state.smokeReady ? 150 : 0) + (state.dashReady ? 150 : 0) - state.alarms * 180)) : 0;
      if (won) sfx.win(); else sfx.lose();
      window.setTimeout(() => onFinish({ ...hudSnapshot(), won, reason, score }), reduceMotion ? 80 : 520);
    }

    function hit(reason = 'guard') {
      if (!active || state.ended || state.elapsed < state.invulnerableUntil) return;
      state.health -= 1; state.invulnerableUntil = state.elapsed + 1.0;
      state.freezeUntil = performance.now() + (reduceMotion ? 0 : 55);
      state.shakeUntil = performance.now() + (reduceMotion ? 0 : 140);
      particles.burst(playerRoot.position.x, 0.7, playerRoot.position.z, 0xe36a58, { count: reduceMotion ? 5 : 10, speed: 2.3, up: 2.1, size: 0.09, life: 0.52, emissive: 0.25 });
      sfx.hit(); onHud(hudSnapshot());
      if (state.health <= 0) finish(false, 'caught');
      else if (reason === 'guard') {
        state.current = { ...START }; state.target = { ...START }; state.from = { ...START }; state.moving = false;
        playerRoot.position.copy(worldFor(START.c, START.r)); playerRoot.position.y = 0.33;
      }
    }

    function triggerAlert(amount = 35) {
      state.alert = Math.min(100, state.alert + amount); state.alarms += 1;
      state.chaseUntil = state.elapsed + 2.5; state.freezeUntil = performance.now() + (reduceMotion ? 0 : 55);
      state.shakeUntil = performance.now() + (reduceMotion ? 0 : 140);
      particles.burst(guardRoot.position.x, 1.55, guardRoot.position.z, 0xe36a58, { count: reduceMotion ? 3 : 6, speed: 1.1, up: 1.6, size: 0.1, life: 0.5, emissive: 0.45 });
      sfx.alert(); onHud(hudSnapshot());
      if (state.alert >= 100) { state.timeLeft = Math.max(0, state.timeLeft - 12); state.alert = 55; }
    }

    function collectLoot() {
      if (state.hasLoot) return;
      state.hasLoot = true; relic.visible = false;
      particles.burst(relic.position.x, 0.85, relic.position.z, 0xe7b95c, { count: reduceMotion ? 12 : 24, speed: 3.2, up: 3.2, size: 0.12, life: 0.7, emissive: 0.65 });
      addRing(relic.position, 0xffe2a0, 0.7); sfx.loot(); onHud(hudSnapshot());
      state.chaseUntil = state.elapsed + 3.5;
    }

    function resolveCell() {
      const keyCell = cellKey(state.current.c, state.current.r);
      if (spikeKeys.has(keyCell) && ((state.elapsed % 1.4) > 1.1)) hit('spike');
      if (runeKeys.has(keyCell) && !state.usedRunes.has(keyCell)) { state.usedRunes.add(keyCell); const usedRune = runes.get(keyCell); if (usedRune) usedRune.visible = false; triggerAlert(45); }
      if (state.current.c === VAULT.c && state.current.r === VAULT.r) collectLoot();
      if (state.hasLoot && state.current.c === START.c && state.current.r === START.r) finish(true, 'escaped');
    }

    function tryMove(c: number, r: number) {
      if (!active || state.ended || state.moving) return;
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
      sfx.move(); onHud(hudSnapshot());
    }

    actionsRef.current.useSmoke = () => {
      if (!active || !state.smokeReady || state.ended) return;
      state.smokeReady = false; state.smokeUntil = state.elapsed + 3;
      for (let i = 0; i < 3; i += 1) particles.puffFx(playerRoot.position.x, 0.45 + i * 0.12, playerRoot.position.z, { count: reduceMotion ? 3 : 6, color: 0xaaa59c, size: 0.22, life: 0.8, grav: 0.3 });
      sfx.smoke(); onHud(hudSnapshot());
    };
    actionsRef.current.armDash = () => {
      if (!active || !state.dashReady || state.ended) return;
      state.dashArmed = !state.dashArmed; onHud(hudSnapshot());
      addRing(playerRoot.position, 0x3fb6ac, 0.36);
    };

    function onPointerDown(event: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hitTile = raycaster.intersectObjects(selectable, false)[0]?.object as THREE.Mesh | undefined;
      if (!hitTile) return;
      if (state.selectedTile) (state.selectedTile.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
      state.selectedTile = hitTile;
      (hitTile.material as THREE.MeshStandardMaterial).emissive.setHex(0x174a45);
      (hitTile.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.55;
      const { c, r } = hitTile.userData.cell; tryMove(c, r);
    }

    function onKeyDown(event: KeyboardEvent) {
      const dirs: Record<string, [number, number]> = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
      if (event.key === ' ') { event.preventDefault(); actionsRef.current.useSmoke(); return; }
      if (event.key === 'Shift') { actionsRef.current.armDash(); return; }
      const dir = dirs[event.key]; if (dir) { event.preventDefault(); tryMove(state.current.c + dir[0], state.current.r + dir[1]); }
    }
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
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
      const frozen = active && now < state.freezeUntil;
      const dt = frozen ? 0 : rawDt;
      const t = clock.elapsedTime;

      relicCore.rotation.y += rawDt * 1.5;
      relicCore.position.y = Math.sin(t * 2.4) * 0.06;
      vaultLight.intensity = 3.8 + Math.sin(t * 2.2) * 0.35;
      entranceLight.intensity = 4.0 + Math.sin(t * 1.7) * 0.3;
      entrancePool.material.opacity = 0.14 + Math.sin(t * 1.7) * 0.025;
      vaultPool.material.opacity = 0.13 + Math.sin(t * 2.2) * 0.025;
      runes.forEach((rune) => { (rune.material as THREE.MeshBasicMaterial).opacity = 0.48 + Math.sin(t * 4) * 0.22; });
      const spikeActive = (state.elapsed % 1.4) > 1.1;
      spikeGroups.forEach((spikeGroup) => { spikeGroup.position.y += ((spikeActive ? 0.17 : -0.12) - spikeGroup.position.y) * Math.min(1, rawDt * 18); });

      if (active && !state.ended) {
        state.elapsed += dt; state.timeLeft -= dt; state.alert = Math.max(0, state.alert - dt * 8);
        if (state.timeLeft <= 0) finish(false, 'timeout');

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
        guardRoot.position.lerpVectors(patrolFrom, patrolTo, state.guardProgress); guardRoot.position.y = 0.33 + Math.abs(Math.sin(t * (state.elapsed < state.chaseUntil ? 9 : 6))) * 0.035;
        guardRoot.rotation.y = Math.atan2((guardEnd.c - guardStart.c) * state.guardDir, (guardEnd.r - guardStart.r) * state.guardDir);
        guardLight.intensity = state.elapsed < state.chaseUntil ? 2.4 : 0.8 + Math.sin(t * 2.6) * 0.12;
        if (guardRig) {
          const gait = state.guardPause > 0 ? 0 : Math.sin(t * (state.elapsed < state.chaseUntil ? 10 : 7)) * 0.58;
          guardRig.legL.rotation.x = gait; guardRig.legR.rotation.x = -gait;
          guardRig.armL.rotation.x = -gait * 0.55; guardRig.armR.rotation.x = gait * 0.55;
        }

        const toPlayer = playerRoot.position.clone().sub(guardRoot.position); toPlayer.y = 0;
        const distance = toPlayer.length();
        const facing = new THREE.Vector3((guardEnd.c - guardStart.c) * state.guardDir, 0, (guardEnd.r - guardStart.r) * state.guardDir).normalize();
        const visible = state.elapsed > 1.2 && state.elapsed > state.smokeUntil && distance < 3.45 && toPlayer.normalize().dot(facing) > 0.84;
        if (visible) {
          state.sightTime += dt;
          vision.material.opacity = 0.34 + Math.sin(t * 12) * 0.08;
          if (state.sightTime >= 0.32) { state.sightTime = -2.1; triggerAlert(35); }
        } else {
          state.sightTime = Math.max(0, state.sightTime - dt * 2); vision.material.opacity = 0.22;
        }
        if (distance < 0.52 && state.elapsed > state.smokeUntil) hit('guard');

        if (state.elapsed - state.lastHud > 0.1) { state.lastHud = state.elapsed; onHud(hudSnapshot()); }
      } else {
        playerRoot.position.y = 0.33 + Math.sin(t * 2.2) * 0.025;
        const idleP = (Math.sin(t * 0.7) + 1) / 2;
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

      camera.position.copy(baseCamera);
      if (now < state.shakeUntil) { camera.position.x += (Math.random() - 0.5) * 0.06; camera.position.y += (Math.random() - 0.5) * 0.04; }
      camera.lookAt(0, 0.1, 0.18);
      composer.render();
    }
    animate();

    return () => {
      cancelAnimationFrame(raf); observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      actionsRef.current = { useSmoke: () => {}, armDash: () => {} };
      composer.dispose(); renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, [active, runId, dungeon, onFinish, onHud]);

  return <div className="ds-scene" ref={mountRef} aria-label="3D dungeon playfield" />;
});

export default DungeonScene;
