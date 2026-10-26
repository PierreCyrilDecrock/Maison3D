// furniture-garage.js — garage, atelier et cellier : voitures (plusieurs carrosseries et couleurs), moto, vélo, établi, outils,
// rayonnages, caisses, pneus, congélateur, casier à bouteilles… Mêmes conventions que furniture.js (avant = +Z, bas à y = 0).
// La voiture est orientée comme les autres objets : le pare-brise regarde +Z (l'avant du véhicule).
import { cabinet, makeKit, place, rt, withModels } from './furniture-kit.js';

const setup = (ctx) => ({ k: makeKit(ctx), rng: ctx.rng, p: ctx.palette });
const darker = (k, c, t = 0.12) => k.mix(c, '#000000', t);
const lighter = (k, c, t = 0.1) => k.mix(c, '#ffffff', t);
const METAL = { metal: 0.7, rough: 0.35 };
const sides = [-1, 1];

/** Peintures de carrosserie : argent, blanc, noir, rouge, bleu, vert, gris, jaune, bordeaux. */
export const CAR_COLORS = Object.freeze(['#d9dbde', '#f4f4f2', '#1d1f24', '#a3262a', '#2c4a7a', '#4a6a52', '#8a8d92', '#c9a23a', '#6b2e3a']);
const STEEL_COLORS = ['#6d7378', '#3f5a73', '#4f6b4a', '#8a2f2b', '#d9dadc', '#2f3236'];

/* ------------------------------------------------------------------ */
/* Voitures                                                            */
/* ------------------------------------------------------------------ */

/**
 * Voiture paramétrée. `w` × `L` × `H` = boîte annoncée ; `belt` = hauteur de la ligne de caisse ; le profil du pavillon
 * est donné par les abscisses z (avant = +z) du bas du pare-brise `zf`, du haut du pare-brise `zt`, du haut de la lunette `zr`
 * et du bas de la lunette `zb` ; `deck` : coffre séparé (berline) ; `rails` : barres de toit ; `cladding` : bas de caisse protégé.
 */
function car(spec) {
  return (ctx) => {
    const { k, rng } = setup(ctx);
    const { w, L, H, wr, belt, zf, zt, zr, zb, deck = false, rails = false, cladding = false, floorY = 0.2 } = spec;
    const hl = L / 2;
    const bodyW = w - 0.06;
    const paint = rng.pick(CAR_COLORS);
    const P = { metal: 0.55, rough: 0.28 };
    const glass = '#1b2a33';
    const G = { rough: 0.08, metal: 0.4 };
    const dark = '#1c1d20';

    // Roues : pneu, jante, passage de roue sombre sur la caisse.
    for (const sx of sides) for (const z of [hl - 0.85, -hl + 0.85]) {
      const tyre = k.cyl(wr, wr, 0.2, sx * (w / 2 - 0.1), 0, z, '#1a1a1c', { rough: 0.9 }, 24);
      tyre.rotation.z = Math.PI / 2;
      tyre.position.y = wr;
      const rim = k.cyl(wr * 0.62, wr * 0.62, 0.21, sx * (w / 2 - 0.1), 0, z, '#b9bec2', { metal: 0.7, rough: 0.3 }, 16);
      rim.rotation.z = Math.PI / 2;
      rim.position.y = wr;
      const arch = k.cyl(wr + 0.04, wr + 0.04, 0.012, sx * (bodyW / 2 + 0.003), 0, z, dark, { rough: 0.9 }, 24);
      arch.rotation.z = Math.PI / 2;
      arch.position.y = wr + 0.04;
    }

    // Caisse basse, capot (et coffre pour une berline), bas de caisse.
    k.rbox(bodyW, belt - floorY, L, 0.14, 0, floorY, 0, paint, P);
    k.rbox(bodyW - 0.04, 0.06, hl - zf, 0.02, 0, belt - 0.01, (zf + hl) / 2, paint, P);
    if (deck) k.rbox(bodyW - 0.04, 0.07, zb + hl, 0.02, 0, belt - 0.01, (zb - hl) / 2, paint, P);
    if (cladding) k.box(bodyW + 0.01, 0.13, L - 0.4, 0, floorY, 0, '#2a2a2d', { rough: 0.9 });
    k.box(bodyW - 0.1, 0.12, 0.08, 0, floorY + 0.01, hl - 0.04, dark, { rough: 0.8 });
    k.box(bodyW - 0.1, 0.12, 0.08, 0, floorY + 0.01, -hl + 0.04, dark, { rough: 0.8 });

    // Face avant et arrière : calandre, phares, feux, plaque.
    k.box(0.7, 0.1, 0.02, 0, belt - 0.2, hl - 0.01, dark);
    for (const sx of sides) {
      k.box(0.34, 0.09, 0.02, sx * (bodyW / 2 - 0.28), belt - 0.1, hl - 0.01, '#f6f1d8', { emissive: '#fff2c0', emissiveIntensity: 0.5, rough: 0.2 });
      k.box(0.3, 0.09, 0.02, sx * (bodyW / 2 - 0.2), belt - 0.12, -hl + 0.01, '#b3201f', { emissive: '#ff2a2a', emissiveIntensity: 0.5, rough: 0.3 });
    }
    k.box(0.5, 0.11, 0.012, 0, floorY + 0.2, hl - 0.006, '#f1efe6');
    k.box(0.5, 0.11, 0.012, 0, floorY + 0.2, -hl + 0.006, '#f1efe6');

    // Vitrage et pavillon.
    const roofTop = H - (rails ? 0.03 : 0);
    const roofY = roofTop - 0.04;
    const rise = roofY - (belt + 0.05);
    const front = k.box(bodyW - 0.2, Math.hypot(zf - zt, rise), 0.025, 0, 0, 0, glass, G);
    front.position.set(0, belt + 0.05 + rise / 2, (zf + zt) / 2);
    front.rotation.x = -Math.atan((zf - zt) / rise);
    const rear = k.box(bodyW - 0.2, Math.hypot(zr - zb, rise), 0.025, 0, 0, 0, glass, G);
    rear.position.set(0, belt + 0.05 + rise / 2, (zb + zr) / 2);
    rear.rotation.x = Math.atan((zr - zb) / rise);
    k.rbox(bodyW - 0.14, 0.04, zt - zr, 0.015, 0, roofY, (zt + zr) / 2, paint, P);
    const winFront = (zf + zt) / 2 + 0.04;
    const winRear = (zb + zr) / 2 - 0.04;
    for (const sx of sides) {
      k.box(0.02, rise - 0.04, winFront - winRear, sx * (bodyW / 2 - 0.08), belt + 0.07, (winFront + winRear) / 2, glass, G);
      k.box(0.026, rise - 0.04, 0.07, sx * (bodyW / 2 - 0.08), belt + 0.07, (winFront + winRear) / 2 - 0.1, paint, P);
      k.box(0.07, 0.055, 0.13, sx * (w / 2 - 0.035), belt + 0.05, zf + 0.02, paint, P);
      for (const z of [(winFront + winRear) / 2 + 0.55, (winFront + winRear) / 2 - 0.55]) k.box(0.006, belt - floorY - 0.12, 0.008, sx * (bodyW / 2 + 0.002), floorY + 0.08, z, dark);
      k.box(0.014, 0.025, 0.12, sx * (bodyW / 2 + 0.004), belt - 0.1, (winFront + winRear) / 2 + 0.25, '#b9bec2', METAL);
      if (rails) k.box(0.03, 0.03, zt - zr - 0.2, sx * 0.55, roofY + 0.04, (zt + zr) / 2, '#2a2a2d');
    }
    return k.root;
  };
}

const CAR_HATCH = { w: 1.8, L: 4.2, H: 1.5, wr: 0.31, belt: 0.8, zf: 0.75, zt: 0.2, zr: -1.5, zb: -1.95 };
const CAR_SEDAN = { w: 1.8, L: 4.2, H: 1.5, wr: 0.31, belt: 0.8, zf: 0.8, zt: 0.3, zr: -0.75, zb: -1.25, deck: true };
const CAR_ESTATE = { w: 1.8, L: 4.2, H: 1.5, wr: 0.31, belt: 0.82, zf: 0.8, zt: 0.25, zr: -1.85, zb: -1.97, rails: true };
const CAR_SUV = { w: 1.9, L: 4.6, H: 1.7, wr: 0.37, belt: 0.98, zf: 0.95, zt: 0.45, zr: -1.8, zb: -2.12, rails: true, cladding: true, floorY: 0.28 };
const CAR_MPV = { w: 1.9, L: 4.6, H: 1.7, wr: 0.34, belt: 0.88, zf: 1.3, zt: 0.85, zr: -1.95, zb: -2.17, rails: true };

/* ------------------------------------------------------------------ */
/* Deux-roues                                                          */
/* ------------------------------------------------------------------ */

function bike(ctx) {
  const { k, rng, p } = setup(ctx);
  const T = ctx.THREE;
  const frame = rng.pick([p.accent, '#1d1f24', '#a3262a', '#2c4a7a', p.metal]);
  const R = 0.325;
  const tyre = '#1a1a1c';
  for (const x of [-0.5, 0.5]) {
    k.mesh(new T.TorusGeometry(R, 0.015, 8, 32), x, R + 0.015, 0, tyre, { rough: 0.9 });
    k.mesh(new T.TorusGeometry(R - 0.03, 0.004, 6, 24), x, R + 0.015, 0, p.metal, METAL);
    k.cyl(0.015, 0.015, 0.04, x, R - 0.005, -0.0, p.metal, METAL, 8).rotation.x = Math.PI / 2;
  }
  const y0 = R + 0.015;
  const bb = [-0.05, 0.3, 0];
  const seatTop = [-0.22, 0.88, 0];
  const headTop = [0.4, 0.82, 0];
  const headBot = [0.42, 0.62, 0];
  k.tube([-0.5, y0, 0], bb, 0.012, frame, METAL);
  k.tube([-0.5, y0, 0], seatTop, 0.012, frame, METAL);
  k.tube(bb, seatTop, 0.013, frame, METAL);
  k.tube(bb, headBot, 0.014, frame, METAL);
  k.tube(seatTop, headTop, 0.013, frame, METAL);
  k.tube(headTop, headBot, 0.016, frame, METAL);
  k.tube(headBot, [0.5, y0, 0], 0.011, p.metal, METAL);
  k.tube(headTop, [0.38, 1.0, 0], 0.012, p.metal, METAL);
  k.cyl(0.012, 0.012, 0.55, 0.38, 0, 0, '#1c1c1e', undefined, 8).rotation.x = Math.PI / 2;
  const bar = k.cyl(0.012, 0.012, 0.55, 0.38, 0, 0, '#1c1c1e', undefined, 8);
  bar.rotation.x = Math.PI / 2;
  bar.position.y = 0.99;
  k.rbox(0.2, 0.04, 0.09, 0.015, -0.28, 0.9 - 0.0, 0, '#1c1c1e');
  k.tube(seatTop, [-0.26, 0.9, 0], 0.01, p.metal, METAL);
  k.cyl(0.05, 0.05, 0.02, -0.05, 0.3 - 0.01, 0, p.metal, METAL, 16).rotation.x = Math.PI / 2;
  return k.root;
}

function motorbike(ctx) {
  const { k, rng } = setup(ctx);
  const T = ctx.THREE;
  const paint = rng.pick(CAR_COLORS);
  const chrome = { metal: 0.85, rough: 0.25 };
  const R = 0.31;
  for (const z of [0.69, -0.69]) {
    const t = k.cyl(R, R, 0.14, 0, 0, z, '#1a1a1c', { rough: 0.9 }, 24);
    t.rotation.z = Math.PI / 2;
    t.position.y = R;
    const hub = k.cyl(R * 0.55, R * 0.55, 0.15, 0, 0, z, '#9ba1a7', { metal: 0.7, rough: 0.3 }, 16);
    hub.rotation.z = Math.PI / 2;
    hub.position.y = R;
  }
  k.mesh(new T.BoxGeometry(0.12, 0.05, 0.7), 0, 0.75, -0.7, '#1d1f24', { rough: 0.6 });
  k.rbox(0.28, 0.2, 0.46, 0.05, 0, 0.6, 0.2, '#2a2c30', { metal: 0.5, rough: 0.4 });
  k.rbox(0.3, 0.2, 0.5, 0.07, 0, 0.74, 0.18, paint, { metal: 0.5, rough: 0.3 });
  k.rbox(0.26, 0.09, 0.62, 0.04, 0, 0.82, -0.32, '#1d1f24');
  k.tube([0, 0.95, 0.52], [0, 0.31, 0.69], 0.02, '#9ba1a7', chrome);
  k.tube([0.06, 0.95, 0.52], [0.06, 0.31, 0.69], 0.02, '#9ba1a7', chrome);
  k.tube([-0.06, 0.95, 0.52], [-0.06, 0.31, 0.69], 0.02, '#9ba1a7', chrome);
  const bar = k.cyl(0.012, 0.012, 0.8, 0, 0, 0.52, '#1c1c1e', undefined, 8);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = 1.02;
  for (const sx of sides) k.box(0.014, 0.1, 0.07, sx * 0.39, 1.03, 0.52, '#d4e4ea', { metal: 0.8, rough: 0.1 });
  k.ell(0.09, 0.09, 0.07, 0, 0.88, 0.8, '#f6f1d8', { emissive: '#fff2c0', emissiveIntensity: 0.5 });
  k.tube([0.14, 0.34, 0.3], [0.14, 0.4, -0.85], 0.04, '#9ba1a7', chrome, 12);
  k.tube([0.0, 0.5, -0.1], [0.0, 0.42, -0.69], 0.02, '#2a2c30', METAL);
  k.box(0.08, 0.04, 0.05, 0, 0.9 - 0.04 + 0.2, -0.99 + 0.025, '#b3201f', { emissive: '#ff2a2a', emissiveIntensity: 0.5 });
  return k.root;
}

/* ------------------------------------------------------------------ */
/* Établi, outils, rangements                                          */
/* ------------------------------------------------------------------ */

function workbench(model) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    const wood = rng.pick([p.wood, p.woodDark, '#b99668']);
    if (model === 0) {
      // Établi en bois : plateau épais, tablette basse, étau.
      k.box(1.6, 0.06, 0.6, 0, 0.84, 0, wood);
      for (const sx of sides) for (const sz of sides) k.box(0.07, 0.84, 0.07, sx * 0.74, 0, sz * 0.24, darker(k, wood, 0.1));
      k.box(1.5, 0.03, 0.5, 0, 0.2, 0, darker(k, wood, 0.05));
      k.box(1.4, 0.09, 0.03, 0, 0.62, 0.27, darker(k, wood, 0.15));
      k.box(0.12, 0.1, 0.12, -0.65, 0.9, 0.12, '#3f5a73', { metal: 0.5, rough: 0.4 });
      k.box(0.04, 0.03, 0.12, -0.65, 0.95, 0.24, p.metal, METAL);
      k.box(0.3, 0.12, 0.2, 0.25, 0.9, -0.05, rng.pick([p.accent, '#a3262a', '#c9a23a']), { rough: 0.5 });
    } else {
      // Établi métallique : plateau, trois tiroirs d'un côté, étagère de l'autre.
      const steel = rng.pick(STEEL_COLORS);
      k.box(1.6, 0.05, 0.6, 0, 0.85, 0, wood);
      for (const sz of sides) k.box(0.05, 0.85, 0.05, -0.775, 0, sz * 0.275, p.metal, METAL);
      k.box(0.55, 0.85, 0.6, 0.525, 0, 0, steel, { metal: 0.5, rough: 0.45 });
      for (let i = 0; i < 3; i++) {
        k.box(0.5, 0.22, 0.012, 0.525, 0.08 + i * 0.25, 0.3 - 0.006, lighter(k, steel, 0.08), { metal: 0.5, rough: 0.45 });
        k.box(0.2, 0.025, 0.025, 0.525, 0.08 + i * 0.25 + 0.1, 0.3 - 0.012, p.metal, METAL);
      }
      k.box(1.0, 0.025, 0.55, -0.27, 0.25, 0, wood);
      k.box(0.3, 0.14, 0.25, -0.5, 0.275, 0.0, '#c9a23a', { rough: 0.5 });
      k.box(0.2, 0.1, 0.2, -0.1, 0.275, 0.0, '#2c4a7a', { rough: 0.5 });
      k.box(0.14, 0.1, 0.14, -0.55, 0.9, 0.0, '#3f5a73', { metal: 0.5, rough: 0.4 });
      k.box(0.3, 0.1, 0.18, 0.1, 0.9, -0.1, rng.pick([p.accent, '#c9a23a']), { rough: 0.5 });
    }
    return k.root;
  };
}

function pegboard(ctx) {
  const { k, rng, p } = setup(ctx);
  const board = rng.pick(['#b99668', '#d9dadc', '#6d7378', p.wood]);
  k.box(1.2, 0.8, 0.02, 0, 0, -0.02, board, { rough: 0.9 });
  const hook = '#2a2c30';
  const handle = [p.accent, '#a3262a', '#c9a23a', '#2c4a7a'];
  // Silhouettes d'outils accrochés (tout reste dans l'épaisseur de 6 cm).
  k.box(0.04, 0.3, 0.03, -0.45, 0.35, 0.015, rng.pick(handle));
  k.box(0.12, 0.05, 0.03, -0.45, 0.62, 0.015, '#9ba1a7', METAL);
  k.box(0.4, 0.06, 0.025, -0.15, 0.55, 0.0125, '#9ba1a7', METAL);
  k.box(0.1, 0.06, 0.03, -0.3, 0.55, 0.015, rng.pick(handle));
  for (let i = 0; i < 4; i++) k.box(0.025, 0.28 - i * 0.03, 0.02, 0.05 + i * 0.07, 0.38, 0.01, '#9ba1a7', METAL);
  k.box(0.025, 0.12, 0.03, 0.05, 0.26, 0.015, rng.pick(handle));
  k.box(0.28, 0.12, 0.03, 0.42, 0.55, 0.015, rng.pick(handle));
  k.box(0.2, 0.2, 0.025, 0.42, 0.2, 0.0125, '#c9a23a');
  k.box(0.5, 0.025, 0.03, -0.2, 0.18, 0.015, '#9ba1a7', METAL);
  for (const [x, y] of [[-0.45, 0.62], [-0.3, 0.6], [0.05, 0.68], [0.42, 0.65]]) k.box(0.012, 0.012, 0.02, x, y, 0.01, hook);
  k.box(1.2, 0.02, 0.06, 0, 0.0, 0.0, darker(k, board, 0.2));
  return k.root;
}

function toolTrolley(ctx) {
  const { k, rng, p } = setup(ctx);
  const color = rng.pick(['#a3262a', '#2c4a7a', '#2f3236', '#c9a23a', '#4f6b4a']);
  const O = { metal: 0.4, rough: 0.4 };
  for (const sx of sides) for (const sz of sides) {
    const wheel = k.cyl(0.05, 0.05, 0.04, sx * 0.3, 0, sz * 0.15, '#1a1a1c', { rough: 0.9 }, 14);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.y = 0.05;
    k.box(0.02, 0.04, 0.03, sx * 0.3, 0.07, sz * 0.15, p.metal, METAL);
  }
  k.box(0.7, 0.8, 0.41, 0, 0.1, 0, color, O);
  k.box(0.7, 0.05, 0.41, 0, 0.9, 0, darker(k, color, 0.2), O);
  for (let i = 0; i < 5; i++) {
    const h = i === 4 ? 0.2 : 0.12;
    const y = 0.14 + i * 0.145;
    k.box(0.64, h, 0.012, 0, y, 0.2, lighter(k, color, 0.06), O);
    k.box(0.4, 0.02, 0.025, 0, y + h - 0.04, 0.2125, '#c9ccd0', METAL);
  }
  return k.root;
}

function metalCabinet(ctx) {
  const { k, rng } = setup(ctx);
  const steel = rng.pick(STEEL_COLORS);
  const O = { metal: 0.5, rough: 0.45 };
  k.box(0.9, 0.08, 0.43, 0, 0, 0, darker(k, steel, 0.4), O);
  k.box(0.9, 1.72, 0.43, 0, 0.08, 0, steel, O);
  for (const sx of sides) {
    k.box(0.43, 1.66, 0.012, sx * 0.218, 0.11, 0.211, lighter(k, steel, 0.07), O);
    for (let i = 0; i < 4; i++) k.box(0.2, 0.012, 0.004, sx * 0.218, 1.55 - i * 0.03, 0.219, darker(k, steel, 0.35));
    k.box(0.02, 0.2, 0.012, sx * 0.04, 0.9, 0.221, '#c9ccd0', METAL);
  }
  return k.root;
}

function metalShelving(model) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    const post = rng.pick(['#6d7378', '#2f3236', '#3f5a73']);
    const wood = rng.pick([p.wood, '#b99668', '#9ba1a7']);
    for (const sx of sides) for (const sz of sides) k.box(0.035, 1.8, 0.035, sx * 0.4825, 0, sz * 0.1825, post, METAL);
    const levels = [0.08, 0.5, 0.92, 1.34, 1.76];
    for (const y of levels) k.box(1.0, 0.04, 0.4, 0, y, 0, wood);
    const carton = ['#b99668', '#a58257', '#c9ab7a'];
    const bins = [p.accent, '#2c4a7a', '#a3262a', '#4f6b4a', '#c9a23a'];
    for (const y of levels.slice(0, 4)) {
      let x = -0.46;
      while (x < 0.3) {
        const w = rng.range(0.18, 0.3);
        if (x + w > 0.47) break;
        const h = rng.range(0.14, 0.3);
        if (model === 0) k.box(w, h, rng.range(0.25, 0.34), x + w / 2, y + 0.04, 0.0, rng.pick(carton), { rough: 1 });
        else {
          k.box(w, h, 0.3, x + w / 2, y + 0.04, 0.0, rng.pick(bins), { rough: 0.5 });
          k.box(w + 0.01, 0.02, 0.31, x + w / 2, y + 0.04 + h, 0.0, '#e6e8ea', { rough: 0.5 });
        }
        x += w + rng.range(0.01, 0.05);
      }
    }
    return k.root;
  };
}

function crates(model) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    if (model === 0) {
      // Deux bacs plastique empilés.
      const colors = [p.accent, '#2c4a7a', '#a3262a', '#4f6b4a', '#c9a23a', '#d9dadc'];
      for (let i = 0; i < 2; i++) {
        const c = rng.pick(colors);
        k.box(0.6, 0.3, 0.4, 0, i * 0.3, 0, c, { rough: 0.5 });
        k.box(0.5, 0.01, 0.3, 0, i * 0.3 + 0.29, 0, darker(k, c, 0.3), { rough: 0.8 });
        k.box(0.2, 0.05, 0.012, 0, i * 0.3 + 0.2, 0.206, darker(k, c, 0.15));
      }
    } else {
      // Cartons empilés, l'un d'eux scotché.
      const carton = ['#b99668', '#a58257', '#c9ab7a'];
      k.box(0.6, 0.3, 0.4, 0, 0, 0, rng.pick(carton), { rough: 1 });
      k.box(0.46, 0.18, 0.36, -0.06, 0.3, 0, rng.pick(carton), { rough: 1 });
      k.box(0.3, 0.12, 0.3, 0.12, 0.48, 0.0, rng.pick(carton), { rough: 1 });
      k.box(0.6, 0.02, 0.04, 0, 0.58, 0.0, rng.pick(carton), { rough: 1 });
    }
    return k.root;
  };
}

function wheelieBin(ctx) {
  const { k, rng } = setup(ctx);
  const body = rng.pick(['#3f5a73', '#4f6b4a', '#2f3236', '#c9a23a']);
  k.rbox(0.5, 0.9, 0.55, 0.04, 0, 0.0, 0.0, body, { rough: 0.6 });
  k.rbox(0.52, 0.08, 0.57, 0.02, 0, 0.9, 0, darker(k, body, 0.25), { rough: 0.6 });
  k.box(0.3, 0.04, 0.06, 0, 0.98, 0.26, darker(k, body, 0.1));
  for (const sx of sides) {
    const wheel = k.cyl(0.08, 0.08, 0.05, sx * 0.225, 0, -0.2, '#1a1a1c', { rough: 0.9 }, 14);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.y = 0.08;
  }
  k.box(0.4, 0.02, 0.01, 0, 0.55, 0.276, lighter(k, body, 0.2));
  return k.root;
}

function tyreStack(ctx) {
  const { k } = setup(ctx);
  const T = ctx.THREE;
  const n = 3;
  for (let i = 0; i < n; i++) {
    const tyre = k.mesh(new T.TorusGeometry(0.21, 0.115, 12, 28), 0, 0.115 + i * 0.23, 0, '#1a1a1c', { rough: 0.95 });
    tyre.rotation.x = Math.PI / 2;
  }
  const rim = k.cyl(0.14, 0.14, 0.02, 0, 0.69 - 0.01, 0, '#9ba1a7', { metal: 0.7, rough: 0.3 }, 16);
  rim.position.y = 0.685;
  return k.root;
}

function freezerChest(ctx) {
  const { k, rng, p } = setup(ctx);
  const c = rng.pick(['#f1f1ee', p.ceramic, '#dfe3e6']);
  for (const sx of sides) for (const sz of sides) k.box(0.05, 0.05, 0.05, sx * 0.4, 0, sz * 0.25, '#2a2c30');
  k.rbox(0.9, 0.62, 0.6, 0.02, 0, 0.05, 0, c, { rough: 0.35, metal: 0.1 });
  k.rbox(0.9, 0.04, 0.6, 0.015, 0, 0.67, 0, lighter(k, c, 0.03), { rough: 0.35 });
  k.rbox(0.86, 0.1, 0.56, 0.02, 0, 0.71, 0, c, { rough: 0.35 });
  k.box(0.3, 0.025, 0.04, 0, 0.77, 0.27, p.metal, METAL);
  k.box(0.06, 0.02, 0.012, 0.35, 0.5, 0.3, '#ff9a4a', { emissive: '#ff9a4a', emissiveIntensity: 0.8 });
  return k.root;
}

function wineRack(ctx) {
  const { k, rng, p } = setup(ctx);
  const wood = rng.pick([p.wood, p.woodDark, '#b99668']);
  for (const sx of sides) k.box(0.03, 1.2, 0.3, sx * 0.285, 0, 0, wood);
  const rows = 6;
  const cols = 5;
  for (let r = 0; r <= rows; r++) k.box(0.54, 0.02, 0.3, 0, r * (1.18 / rows), 0, wood);
  const glassColors = ['#2f4a2f', '#3a5a3a', '#4a2f2f', '#2f2f3a'];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (rng.chance(0.25)) continue;
    const x = -0.22 + c * 0.11;
    const y = r * (1.18 / rows) + 0.02 + 0.045;
    const bottle = k.cyl(0.04, 0.04, 0.2, x, 0, 0, rng.pick(glassColors), { rough: 0.15 }, 12);
    bottle.rotation.x = Math.PI / 2;
    bottle.position.set(x, y, -0.03);
    const neck = k.cyl(0.015, 0.02, 0.08, x, 0, 0, rng.pick(glassColors), { rough: 0.15 }, 10);
    neck.rotation.x = Math.PI / 2;
    neck.position.set(x, y, 0.11);
  }
  k.box(0.54, 1.18, 0.01, 0, 0.01, -0.145, darker(k, wood, 0.2));
  return k.root;
}

function tableSaw(ctx) {
  const { k, rng, p } = setup(ctx);
  const body = rng.pick(['#4f6b4a', '#2c4a7a', '#6d7378', '#a3262a']);
  const O = { metal: 0.5, rough: 0.4 };
  for (const sx of sides) for (const sz of sides) k.box(0.05, 0.78, 0.05, sx * 0.4, 0, sz * 0.25, p.metal, METAL);
  k.box(0.84, 0.3, 0.52, 0, 0.3, 0, body, O);
  k.box(1.0, 0.04, 0.7, 0, 0.86, 0, '#9ba1a7', { metal: 0.7, rough: 0.3 });
  k.box(0.04, 0.04, 0.7, -0.2, 0.9, 0, '#c9ccd0', METAL);
  k.box(0.3, 0.02, 0.08, 0.2, 0.9, 0.0, '#2a2c30');
  k.tube([0.0, 0.9, -0.2], [0.0, 0.9, 0.1], 0.004, '#c9ccd0', METAL);
  return k.root;
}

function easel(ctx) {
  const { k, rng, p } = setup(ctx);
  const wood = rng.pick([p.wood, p.woodDark, '#b99668']);
  for (const sx of sides) k.box(0.04, 1.6, 0.04, sx * 0.28, 0, 0.28, wood);
  k.box(0.6, 0.04, 0.04, 0, 1.56, 0.28, wood);
  k.box(0.6, 0.04, 0.05, 0, 0.5, 0.29, wood);
  k.tube([0, 1.5, 0.24], [0, 0.02, -0.27], 0.022, wood);
  k.box(0.5, 0.4, 0.02, 0, 0.9, 0.31 + 0.0, '#f4f1ea');
  k.box(0.38, 0.25, 0.012, 0.0, 0.98, 0.325, rng.pick([p.accent, p.fabric, p.plant, '#c9a23a']));
  k.box(0.2, 0.15, 0.012, 0.05, 1.02, 0.332, rng.pick([p.accent, '#a3262a', '#2c4a7a']));
  void p;
  return k.root;
}

function tubeLight(ctx) {
  const { k } = setup(ctx);
  k.box(1.2, 0.03, 0.1, 0, 0.05, 0, '#d9dadc', { rough: 0.5 });
  for (const sz of sides) {
    const tube = k.cyl(0.015, 0.015, 1.16, 0, 0, sz * 0.025, '#f4f8ff', { emissive: '#e8f2ff', emissiveIntensity: 1 }, 10);
    tube.rotation.z = Math.PI / 2;
    tube.position.y = 0.015;
  }
  for (const sx of sides) k.box(0.03, 0.03, 0.1, sx * 0.585, 0.03, 0, '#9ba1a7');
  return k.root;
}

/* ------------------------------------------------------------------ */
/* Données                                                             */
/* ------------------------------------------------------------------ */

export const GARAGE_DATA = Object.freeze([
  { id: 'car', label: 'Voiture', category: 'garage', roomTypes: [rt('garage', 5)], size: { w: 1.8, d: 4.2, h: 1.5 }, placement: place('free', 0.5, 0.7, []) },
  { id: 'car-large', label: 'Grande voiture (SUV, monospace)', category: 'garage', roomTypes: [rt('garage', 2)], size: { w: 1.9, d: 4.6, h: 1.7 }, placement: place('free', 0.5, 0.7, []) },
  { id: 'motorbike', label: 'Moto', category: 'garage', roomTypes: [rt('garage', 1.2)], size: { w: 0.8, d: 2.0, h: 1.1 }, placement: place('free', 0.4, 0.4, []) },
  { id: 'bike', label: 'Vélo', category: 'garage', roomTypes: [rt('garage', 2), rt('workshop', 0.4)], size: { w: 1.7, d: 0.55, h: 1.0 }, placement: place('wall', 0.3, 0.05, []) },
  { id: 'workbench', label: 'Établi', category: 'garage', roomTypes: [rt('garage', 3), rt('workshop', 4)], size: { w: 1.6, d: 0.6, h: 1.0 }, placement: place('wall', 0.9, 0.05, ['table-lamp']) },
  { id: 'pegboard', label: 'Panneau d\'outils', category: 'garage', roomTypes: [rt('garage', 2), rt('workshop', 3)], size: { w: 1.2, d: 0.06, h: 0.8 }, placement: place('wall-mounted', 0, 0, [], { mountHeight: 1.3 }) },
  { id: 'tool-trolley', label: 'Servante d\'atelier', category: 'garage', roomTypes: [rt('garage', 1.5), rt('workshop', 3)], size: { w: 0.7, d: 0.45, h: 0.95 }, placement: place('wall', 0.7, 0.05, []) },
  { id: 'metal-cabinet', label: 'Armoire métallique', category: 'garage', roomTypes: [rt('garage', 2), rt('workshop', 2), rt('pantry', 0.3)], size: { w: 0.9, d: 0.45, h: 1.8 }, placement: place('wall', 0.7, 0.05) },
  { id: 'metal-shelving', label: 'Rayonnage métallique', category: 'garage', roomTypes: [rt('garage', 3), rt('workshop', 2), rt('pantry', 3), rt('laundry', 0.5)], size: { w: 1.0, d: 0.4, h: 1.8 }, placement: place('wall', 0.6, 0.05) },
  { id: 'crates', label: 'Caisses et cartons', category: 'garage', roomTypes: [rt('garage', 2), rt('pantry', 2), rt('workshop', 1), rt('laundry', 0.4)], size: { w: 0.6, d: 0.4, h: 0.6 }, placement: place('wall', 0.3, 0.05, []) },
  { id: 'wheelie-bin', label: 'Poubelle roulante', category: 'garage', roomTypes: [rt('garage', 1.5)], size: { w: 0.5, d: 0.55, h: 1.0 }, placement: place('wall', 0.3, 0.05, []) },
  { id: 'tyre-stack', label: 'Pneus', category: 'garage', roomTypes: [rt('garage', 1.5)], size: { w: 0.65, d: 0.65, h: 0.7 }, placement: place('corner', 0.2, 0.05, []) },
  { id: 'freezer-chest', label: 'Congélateur coffre', category: 'buanderie', roomTypes: [rt('pantry', 3), rt('garage', 1.5), rt('laundry', 0.3)], size: { w: 0.9, d: 0.6, h: 0.85 }, placement: place('wall', 0.7, 0.05) },
  { id: 'wine-rack', label: 'Casier à bouteilles', category: 'buanderie', roomTypes: [rt('pantry', 2), rt('dining', 0.3), rt('kitchen', 0.3)], size: { w: 0.6, d: 0.3, h: 1.2 }, placement: place('wall', 0.5, 0.05) },
  { id: 'table-saw', label: 'Scie sur table', category: 'garage', roomTypes: [rt('workshop', 1.5)], size: { w: 1.0, d: 0.7, h: 0.9 }, placement: place('free', 0.8, 0.5, []) },
  { id: 'easel', label: 'Chevalet', category: 'garage', roomTypes: [rt('workshop', 1), rt('office', 0.2), rt('kidsroom', 0.2)], size: { w: 0.6, d: 0.6, h: 1.6 }, placement: place('free', 0.5, 0.3, []) },
  { id: 'tube-light', label: 'Tube lumineux', category: 'eclairage', roomTypes: [rt('garage', 3), rt('workshop', 3), rt('pantry', 2), rt('laundry', 0.6)], size: { w: 1.2, d: 0.1, h: 0.08 }, placement: place('ceiling', 0, 0) },
]);

export const GARAGE_BUILDERS = Object.freeze({
  car: withModels([car(CAR_HATCH), car(CAR_SEDAN), car(CAR_ESTATE)]),
  'car-large': withModels([car(CAR_SUV), car(CAR_MPV)]),
  motorbike,
  bike,
  workbench: withModels([workbench(0), workbench(1)]),
  pegboard,
  'tool-trolley': toolTrolley,
  'metal-cabinet': metalCabinet,
  'metal-shelving': withModels([metalShelving(0), metalShelving(1)]),
  crates: withModels([crates(0), crates(1)]),
  'wheelie-bin': wheelieBin,
  'tyre-stack': tyreStack,
  'freezer-chest': freezerChest,
  'wine-rack': wineRack,
  'table-saw': tableSaw,
  easel,
  'tube-light': tubeLight,
});

void cabinet;
