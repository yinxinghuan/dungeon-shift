// ============================================================================
//  engine-3d/particles.js — shared voxel particle pool for 3D timing games.
//  Creates a reusable pool of BoxGeometry meshes and provides spawn/burst/
//  puff/update functions. Identical structure between Sky Leap and Corporate
//  Climb; only the tuning defaults differ per game.
// ============================================================================

/**
 * Create a particle system attached to a Three.js scene.
 *
 * @param {import('three').Scene} scene
 * @param {object} THREE_ - the THREE module (passed in to avoid global)
 * @param {object} [opts]
 * @param {number} [opts.poolSize=130]   number of pre-allocated particles
 */
export function createParticles(scene, THREE_, opts = {}) {
  const PCOUNT = opts.poolSize || 130;
  const pGeo = new THREE_.BoxGeometry(1, 1, 1);
  const pPool = [];
  for (let i = 0; i < PCOUNT; i++) {
    const m = new THREE_.Mesh(
      pGeo,
      new THREE_.MeshStandardMaterial({ flatShading: true, transparent: true }),
    );
    m.visible = false;
    m.frustumCulled = false;
    m.castShadow = false;
    scene.add(m);
    pPool.push({
      m,
      vx: 0, vy: 0, vz: 0,
      life: 0, maxLife: 1, size: 0.1,
      grav: 9, soft: false, spin: 0,
    });
  }
  let pCur = 0;

  function spawnP(x, y, z, color, o) {
    const p = pPool[pCur];
    pCur = (pCur + 1) % PCOUNT;
    const m = p.m;
    m.visible = true;
    m.position.set(x, y, z);
    const s = o.size || 0.12;
    m.scale.set(s, s, s);
    m.material.color.setHex(color);
    if (o.emissive) {
      m.material.emissive.setHex(color);
      m.material.emissiveIntensity = o.emissive;
    } else {
      m.material.emissive.setHex(0x000000);
      m.material.emissiveIntensity = 0;
    }
    m.material.opacity = 1;
    m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    p.vx = o.vx || 0;
    p.vy = o.vy || 0;
    p.vz = o.vz || 0;
    p.grav = o.grav != null ? o.grav : 9;
    p.soft = !!o.soft;
    p.life = p.maxLife = o.life || 0.6;
    p.size = s;
    p.spin = o.spin || 0;
  }

  function burst(x, y, z, {
    count = 12, color = 0xf2c14e, speed = 3, up = 3,
    size = 0.13, life = 0.6, emissive = 0,
  } = {}) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random();
      spawnP(x, y, z, color, {
        vx: Math.cos(a) * speed * r,
        vy: up * (0.5 + Math.random()),
        vz: Math.sin(a) * speed * r,
        size: size * (0.7 + Math.random() * 0.6),
        life: life * (0.7 + Math.random() * 0.6),
        grav: 9,
        emissive,
        spin: 6,
      });
    }
  }

  function puffFx(x, y, z, {
    count = 5, color = 0xeee7d6,
    size = 0.18, life = 0.5,
    vxRange = 1.1, vyMin = 0.5, vyRange = 0.6, vzRange = 0.7, grav = 1.0,
  } = {}) {
    for (let i = 0; i < count; i++) {
      spawnP(x, y, z, color, {
        vx: (Math.random() * 2 - 1) * vxRange,
        vy: vyMin + Math.random() * vyRange,
        vz: (Math.random() * 2 - 1) * vzRange,
        size: size * (0.6 + Math.random() * 0.6),
        life,
        grav,
        soft: true,
      });
    }
  }

  function updateParticles(dt) {
    for (const p of pPool) {
      if (!p.m.visible) continue;
      p.life -= dt;
      if (p.life <= 0) { p.m.visible = false; continue; }
      const m = p.m;
      m.position.x += p.vx * dt;
      m.position.y += p.vy * dt;
      m.position.z += p.vz * dt;
      p.vy -= p.grav * dt;
      const t = p.life / p.maxLife;
      if (p.soft) {
        m.scale.setScalar(p.size * (1.4 - 0.6 * t));
        m.material.opacity = t;
      } else {
        m.scale.setScalar(p.size * Math.max(0.2, t));
        m.material.opacity = Math.min(1, t * 1.6);
      }
      m.rotation.x += p.spin * dt;
      m.rotation.y += p.spin * dt;
    }
  }

  return { spawnP, burst, puffFx, updateParticles, pPool };
}
