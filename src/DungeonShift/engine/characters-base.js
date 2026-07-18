// ============================================================================
//  engine-3d/characters-base.js — the shared character() factory + 14 base
//  civilian characters. Archetypes, monsters, and office characters are
//  imported separately by each game's roster file.
//
//  Split from builders/characters.js (byte-identical between Sky Leap and
//  Corporate Climb). The only difference between the two was the OFFICE import
//  and the roster spread — both now handled per-game.
// ============================================================================

import * as THREE from 'three';
import { P, box, darken } from './prims.js';

const EYE = 0x241f1c, FRAME = 0x4a3526;

// ── character() factory ──────────────────────────────────────────────────
// Sharp-cubic ADULT: head : torso : legs ≈ 1 : 1.3 : 1.5,
// head width ≈ 0.56 × torso width.
// Returns a THREE.Group with userData.rig = { legL, legR, armL, armR }.
export function character(s) {
  const g = new THREE.Group();
  const BW = s.bw ?? 1.00, BD = 0.52;
  const HW = s.hw ?? 0.56, HH = s.hh ?? 0.60, HDP = 0.50;
  const shoeH = 0.18, legH = s.legH ?? 0.92, legW = 0.34, gap = 0.10;
  const lx = legW / 2 + gap / 2;

  // ── legs ──
  const legL = new THREE.Group(), legR = new THREE.Group();
  if (s.skirt) {
    const skY = shoeH + 0.62;
    g.add(box(BW + 0.06, 0.80, BD + 0.04, s.skirt, 0, skY, 0));
    const hipY = shoeH + 0.54;
    legL.position.set(-0.18, hipY, 0); legR.position.set(0.18, hipY, 0);
    [legL, legR].forEach(L => {
      L.add(box(0.22, 0.54, 0.22, s.legskin ?? P.skin, 0, (shoeH + 0.27) - hipY, 0.02));
      L.add(box(0.26, shoeH, BD - 0.06, s.shoes, 0, shoeH / 2 - hipY, 0.05));
    });
  } else {
    const hipY = shoeH + legH;
    legL.position.set(-lx, hipY, 0); legR.position.set(lx, hipY, 0);
    [legL, legR].forEach(L => {
      L.add(box(legW + 0.02, shoeH, BD - 0.02, s.shoes, 0, shoeH / 2 - hipY, 0.05));
      L.add(box(legW, legH, BD - 0.08, s.bottom, 0, (shoeH + legH / 2) - hipY, 0));
    });
  }
  g.add(legL); g.add(legR);

  // ── torso ──
  const torsoH = s.torsoH ?? 0.80;
  const torsoBase = s.skirt ? (shoeH + 0.62 + 0.40 - 0.06) : (shoeH + legH);
  const torsoY = torsoBase + torsoH / 2;
  g.add(box(BW, torsoH, BD, s.top, 0, torsoY, 0));
  if (s.collar) g.add(box(BW - 0.20, 0.16, 0.05, s.collar, 0, torsoY + torsoH / 2 - 0.09, BD / 2 + 0.01));
  if (s.tie)    g.add(box(0.12, torsoH * 0.6, 0.04, s.tie, 0, torsoY + 0.02, BD / 2 + 0.02));
  if (s.apron) {
    g.add(box(BW - 0.22, torsoH * 0.82, 0.05, s.apron, 0, torsoY - 0.05, BD / 2 + 0.02));
    g.add(box(0.11, torsoH * 0.5, 0.05, s.apron, -0.24, torsoY + torsoH * 0.33, BD / 2 + 0.02));
    g.add(box(0.11, torsoH * 0.5, 0.05, s.apron, 0.24, torsoY + torsoH * 0.33, BD / 2 + 0.02));
  }
  if (s.belt) g.add(box(BW + 0.02, 0.13, BD + 0.02, s.belt, 0, torsoY - torsoH / 2 + 0.07, 0));

  // ── arms ──
  const armW = 0.24, armH = torsoH + legH * 0.28, agap = 0.02;
  const ax = BW / 2 + agap + armW / 2;
  const sleeve = s.bareArms ? s.skin : (s.sleeve ?? s.top);
  const shoulderY = torsoY + torsoH / 2;
  const armTop = shoulderY - armH * 0.36;
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-ax, shoulderY, 0); armR.position.set(ax, shoulderY, 0);
  [armL, armR].forEach(A => {
    A.add(box(armW, armH * 0.74, BD - 0.06, sleeve, 0, armTop - shoulderY, 0));
    A.add(box(armW, armH * 0.26, BD - 0.06, s.skin, 0, (shoulderY - armH * 0.87) - shoulderY, 0));
  });
  g.add(armL); g.add(armR);

  // ── neck + head ──
  const neckY = torsoY + torsoH / 2 + 0.05;
  g.add(box(0.28, 0.12, 0.26, s.skin, 0, neckY, 0));
  const headY = neckY + 0.06 + HH / 2;
  g.add(box(HW, HH, HDP, s.skin, 0, headY, 0));

  const fz = HDP / 2 + 0.01, eyeY = headY + 0.02, eyeX = HW * 0.26;
  g.add(box(0.13, 0.14, 0.04, EYE, -eyeX, eyeY, fz));
  g.add(box(0.13, 0.14, 0.04, EYE, eyeX, eyeY, fz));
  if (s.glasses) {
    g.add(box(0.18, 0.17, 0.05, FRAME, -eyeX, eyeY, fz + 0.005));
    g.add(box(0.18, 0.17, 0.05, FRAME, eyeX, eyeY, fz + 0.005));
    g.add(box(0.13, 0.05, 0.03, FRAME, 0, eyeY, fz + 0.002));
  }

  // ── hair ──
  const topHead = headY + HH / 2;
  if (s.hair) {
    if (s.hairStyle === 'bun') {
      g.add(box(HW + 0.05, 0.20, HDP + 0.04, s.hair, 0, topHead + 0.06, 0));
      g.add(box(0.32, 0.30, 0.30, s.hair, 0, topHead + 0.18, -0.06));
      g.add(box(0.13, HH * 0.7, HDP * 0.9, s.hair, -(HW / 2 + 0.03), headY - 0.03, 0));
      g.add(box(0.13, HH * 0.7, HDP * 0.9, s.hair, (HW / 2 + 0.03), headY - 0.03, 0));
    } else {
      g.add(box(HW + 0.05, 0.22, HDP + 0.04, s.hair, 0, topHead + 0.07, 0));
      g.add(box(HW + 0.05, 0.42, 0.14, s.hair, 0, headY + 0.04, -HDP * 0.5));
      g.add(box(0.13, 0.46, HDP * 0.78, s.hair, -(HW / 2 + 0.02), headY + 0.02, -0.04));
      g.add(box(0.13, 0.46, HDP * 0.78, s.hair, (HW / 2 + 0.02), headY + 0.02, -0.04));
    }
  }

  // ── cap ──
  if (s.hat) {
    g.add(box(HW + 0.06, 0.16, HDP + 0.06, s.hat, 0, topHead + 0.06, 0));
    g.add(box(HW * 0.7, 0.06, 0.20, s.hat, 0, topHead + 0.02, HDP / 2 + 0.08));
  }

  // ── backpack ──
  if (s.backpack) {
    g.add(box(BW - 0.06, torsoH + 0.02, 0.22, s.backpack, 0, torsoY + 0.02, -BD / 2 - 0.13));
    g.add(box(0.10, torsoH * 0.7, 0.04, darken(s.backpack, 0.8), -0.22, torsoY + 0.05, BD / 2 + 0.02));
    g.add(box(0.10, torsoH * 0.7, 0.04, darken(s.backpack, 0.8), 0.22, torsoY + 0.05, BD / 2 + 0.02));
  }

  // ── accordion ──
  if (s.accordion) {
    const aw = 0.7, ah = 0.62, az = BD / 2 + 0.22;
    g.add(box(aw, ah, 0.34, s.accordion, 0, torsoY + 0.02, az));
    for (let i = -1; i <= 1; i++) g.add(box(0.05, ah, 0.36, darken(s.accordion, 0.7), i * 0.18, torsoY + 0.02, az));
    g.add(box(0.11, ah, 0.36, P.cream, -aw / 2 + 0.055, torsoY + 0.02, az));
    g.add(box(0.11, ah, 0.36, P.cream, aw / 2 - 0.055, torsoY + 0.02, az));
    g.add(box(0.05, ah * 0.7, 0.04, P.panelD, aw / 2 - 0.02, torsoY + 0.02, az + 0.18));
  }

  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.rig = { legL, legR, armL, armR };
  return g;
}

// ── 14 base civilian characters ──────────────────────────────────────────
// Accent discipline: each figure = skin + hair + 2 MUTED garments + exactly
// ONE saturated teal accent. Garment hues are pushed grey via darken().
export const BASE_CHARACTERS = {
  shopkeeper: () => character({
    skin: P.skin, top: P.cream, sleeve: P.cream, bottom: darken(P.blue, 0.48), shoes: P.ironD,
    hair: P.hairDark, hairStyle: 'short', apron: P.accent,
  }),
  granny: () => character({
    skin: P.skin, top: darken(P.green, 0.52), sleeve: darken(P.green, 0.52),
    skirt: darken(P.coral, 0.58), legskin: P.cream,
    shoes: P.ironD, hair: P.hairGrey, hairStyle: 'bun', glasses: true, collar: P.accent,
  }),
  oldman: () => character({
    skin: P.skinD, top: P.stone, sleeve: P.stone, bottom: P.woodD, shoes: P.ironD,
    hair: P.hairGrey, hairStyle: 'short', glasses: true, accordion: P.accent,
  }),
  blonde: () => character({
    skin: P.skin, top: darken(P.blue, 0.5), sleeve: darken(P.blue, 0.5),
    skirt: darken(P.blue, 0.5), legskin: P.skin,
    shoes: P.ironD, hair: P.hairBlond, hairStyle: 'short', collar: P.cream, belt: P.accent,
  }),
  kid: () => character({
    skin: P.skin, top: darken(P.orange, 0.6), sleeve: darken(P.orange, 0.6), bottom: darken(P.blue, 0.5),
    shoes: P.ironD, hair: P.hairBrown, hairStyle: 'short', backpack: P.accent,
    bw: 0.78, hw: 0.52, hh: 0.58, torsoH: 0.60, legH: 0.52,
  }),
  businessman: () => character({
    skin: P.skinD, top: P.slate, sleeve: P.slate, bottom: P.slate, shoes: P.ironD,
    hair: P.hairDark, hairStyle: 'short', collar: P.cream, tie: P.accent, bw: 1.08,
  }),
  officeWoman: () => character({
    skin: P.skin, top: darken(P.purple, 0.6), sleeve: darken(P.purple, 0.6),
    skirt: P.panelD, legskin: P.skin, shoes: P.ironD,
    hair: P.hairBrown, hairStyle: 'short', collar: P.accent,
  }),
  student: () => character({
    skin: P.skinTan, top: darken(P.green, 0.55), sleeve: darken(P.green, 0.55), bottom: darken(P.blue, 0.5),
    shoes: P.ironD, hair: P.hairBrown, hairStyle: 'short', backpack: P.accent,
  }),
  darkWoman: () => character({
    skin: P.skinDk, top: darken(P.coral, 0.6), sleeve: darken(P.coral, 0.6),
    skirt: darken(P.coral, 0.6), legskin: P.skinDk, shoes: P.ironD,
    hair: P.hairDark, hairStyle: 'bun', collar: P.accent,
  }),
  worker: () => character({
    skin: P.skinDk, top: P.stone, sleeve: P.stone, bottom: P.woodD, shoes: P.ironD,
    hair: P.hairDark, hairStyle: 'short', hat: P.accent, apron: P.accent, bw: 1.04,
  }),
  teen: () => character({
    skin: P.skinTan, top: darken(P.red, 0.5), sleeve: darken(P.red, 0.5), bottom: darken(P.slate, 0.85),
    shoes: P.ironD, hair: P.hairBlond, hairStyle: 'short', hat: P.accent,
    bw: 0.92, hh: 0.58, legH: 0.74,
  }),
  fitWoman: () => character({
    skin: P.skinD, top: darken(P.coral, 0.55), bottom: darken(P.purple, 0.7), shoes: P.white,
    hair: P.hairDark, hairStyle: 'bun', belt: P.accent, bareArms: true,
  }),
  chef: () => character({
    skin: P.skin, top: P.panel, sleeve: P.panel, bottom: P.slate, shoes: P.ironD,
    hair: P.hairDark, hairStyle: 'short', hat: P.cream, collar: P.accent,
  }),
  bigGuy: () => character({
    skin: P.skinD, top: darken(P.green, 0.5), sleeve: darken(P.green, 0.5), bottom: P.woodD, shoes: P.ironD,
    hair: P.hairGrey, hairStyle: 'short', glasses: true, belt: P.accent, bw: 1.10,
  }),
};
