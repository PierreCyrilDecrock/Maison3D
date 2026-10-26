// furniture-home.js — meubles et objets d'intérieur ajoutés au catalogue (entrée, salle à manger, salon, chambres, enfants,
// cuisine, salle de bain, WC, buanderie, bureau, éclairage, chauffage et petits objets de décoration).
// Mêmes conventions que furniture.js : avant = +Z, origine au centre de l'empreinte, bas à y = 0, boîte englobante = size à 5 %.
// Les objets à plusieurs modèles sont enveloppés par withModels : chaque génération en tire un au hasard.
import { RUGS, SURFACE_DECOR, TABLE_DECOR, cabinet, diningChair, frameRect, makeKit, place, rt, withModels } from './furniture-kit.js';

const setup = (ctx) => ({ k: makeKit(ctx), rng: ctx.rng, p: ctx.palette });
const darker = (k, c, t = 0.12) => k.mix(c, '#000000', t);
const lighter = (k, c, t = 0.1) => k.mix(c, '#ffffff', t);
const METAL = { metal: 0.7, rough: 0.35 };
const GLASS = { opacity: 0.22, rough: 0.05, metal: 0.1 };
const sides = [-1, 1];

/** Quatre pieds carrés aux angles d'un rectangle w × d centré en (x, z). */
function legs4(k, { w, d, h, x = 0, z = 0, t = 0.04, inset = 0.03, color }) {
  for (const sx of sides) for (const sz of sides) k.box(t, h, t, x + sx * (w / 2 - inset - t / 2), 0, z + sz * (d / 2 - inset - t / 2), color);
}

/** Rangée de livres sur une étagère, de x0 à x1 (le premier fait exactement `maxH`, pour fixer la hauteur). */
function bookRow(k, rng, p, { x0, x1, y, z = 0, depth = 0.2, maxH = 0.26, minH = 0.16 }) {
  const colors = [p.accent, p.fabric, p.fabricLight, p.woodDark, p.plant];
  let x = x0;
  let first = true;
  while (x < x1 - 0.06) {
    const bw = rng.range(0.025, 0.05);
    if (x + bw > x1) break;
    k.box(bw, first ? maxH : rng.range(minH, maxH), depth, x + bw / 2, y, z, rng.pick(colors));
    first = false;
    x += bw + 0.004;
  }
}

/** Chaise de salle à manger à modèles : bois, métal rond, coque rembourrée. Même boîte 0,42 × 0,42 × 0,9. */
function chairModel(model) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    const seat = rng.pick([p.fabric, p.fabricLight, p.accent]);
    const leg = rng.pick([p.woodDark, p.metal, p.wood]);
    if (model === 0) {
      diningChair(k, { leg, seat, back: rng.chance(0.5) ? seat : leg });
    } else if (model === 1) {
      // Chaise de bistrot : assise ronde, quatre pieds fins, dossier large.
      k.cyl(0.21, 0.21, 0.035, 0, 0.43, 0, seat, { rough: 0.7 }, 24);
      for (const sx of sides) for (const sz of sides) k.cyl(0.013, 0.013, 0.43, sx * 0.14, 0, sz * 0.14, p.metal, METAL, 8);
      k.rbox(0.42, 0.3, 0.025, 0.01, 0, 0.6, -0.19, seat);
      for (const sx of sides) k.box(0.02, 0.17, 0.02, sx * 0.17, 0.465, -0.17, p.metal, METAL);
    } else {
      // Chaise coque : un grand dossier arrondi.
      for (const sx of sides) for (const sz of sides) k.box(0.03, 0.43, 0.03, sx * 0.17, 0, sz * 0.15, leg);
      k.rbox(0.42, 0.08, 0.42, 0.03, 0, 0.4, 0, seat);
      k.rbox(0.42, 0.42, 0.05, 0.025, 0, 0.48, -0.185, seat);
    }
    return k.root;
  };
}

/* ------------------------------------------------------------------ */
/* Entrée et couloir                                                   */
/* ------------------------------------------------------------------ */

function shoeCabinetClosed(ctx) {
  const { k, rng, p } = setup(ctx);
  const body = rng.pick([p.wood, p.woodDark, p.fabricLight]);
  const flaps = rng.chance(0.5);
  cabinet(k, { w: 0.8, d: 0.3, h: 1.1, leg: 0.1, body, front: darker(k, body, 0.1), doors: flaps ? 0 : 2, drawers: flaps ? 3 : 0, handle: p.metal, legColor: rng.pick([p.woodDark, p.metal]) });
  return k.root;
}

function shoeCabinetOpen(ctx) {
  const { k, rng, p } = setup(ctx);
  const frame = rng.pick([p.wood, p.woodDark, p.metal]);
  for (const sx of sides) k.box(0.03, 1.1, 0.3, sx * 0.385, 0, 0, frame);
  const levels = [0.08, 0.38, 0.68, 1.08];
  for (const y of levels) k.box(0.74, 0.02, 0.3, 0, y, 0, frame);
  const shoe = [p.fabric, p.accent, p.woodDark, p.fabricLight, '#1f1f22'];
  for (const y of levels.slice(0, 3)) {
    let x = -0.33;
    while (x < 0.28) {
      const w = rng.range(0.09, 0.12);
      k.rbox(w, 0.07, 0.24, 0.02, x + w / 2, y + 0.02, 0.0, rng.pick(shoe));
      x += w + rng.range(0.02, 0.05);
    }
  }
  return k.root;
}

function wallHooks(ctx) {
  const { k, rng, p } = setup(ctx);
  const board = rng.pick([p.wood, p.woodDark, p.fabricLight]);
  k.box(0.6, 0.15, 0.02, 0, 0, -0.03, board);
  const count = rng.int(4, 5);
  for (let i = 0; i < count; i++) {
    const x = -0.24 + (0.48 / (count - 1)) * i;
    k.box(0.02, 0.02, 0.06, x, 0.065, 0.01, p.metal, METAL);
    k.ell(0.018, 0.018, 0.018, x, 0.075, 0.022, p.metal, METAL);
  }
  return k.root;
}

function umbrellaStand(ctx) {
  const { k, rng, p } = setup(ctx);
  const body = rng.pick([p.metal, p.ceramic, p.accent, p.woodDark]);
  k.cyl(0.1, 0.09, 0.45, 0, 0, 0, body, { rough: 0.5, metal: body === p.metal ? 0.6 : 0 });
  const colors = [p.fabric, p.accent, '#22252b', p.plant];
  k.cyl(0.012, 0.012, 0.15, 0.03, 0.45, 0.02, p.metal, METAL, 8);
  k.cyl(0.02, 0.012, 0.6, -0.02, 0.0, -0.02, rng.pick(colors), undefined, 10).position.y = 0.3;
  k.cyl(0.018, 0.012, 0.52, 0.04, 0.0, -0.03, rng.pick(colors), undefined, 10).position.y = 0.26;
  return k.root;
}

function bookcaseNarrow(model) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    const wood = rng.pick([p.wood, p.woodDark, p.fabricLight]);
    const shelves = rng.int(4, 6);
    const w = 0.6;
    const d = 0.25;
    const h = 1.9;
    if (model === 0) {
      for (const sx of sides) k.box(0.03, h, d, sx * (w / 2 - 0.015), 0, 0, wood);
      k.box(w, 0.03, d, 0, h - 0.03, 0, wood);
      k.box(w - 0.06, 0.06, d - 0.02, 0, 0, 0, wood);
      k.box(w - 0.06, h - 0.03, 0.01, 0, 0, -d / 2 + 0.005, darker(k, wood, 0.15));
    } else {
      // Étagère industrielle : montants métal, planches épaisses.
      for (const sx of sides) for (const sz of sides) k.box(0.03, h, 0.03, sx * (w / 2 - 0.015), 0, sz * (d / 2 - 0.015), p.metal, METAL);
      k.box(w, 0.03, d, 0, h - 0.03, 0, wood);
    }
    const gap = (h - 0.06) / shelves;
    for (let i = 0; i < shelves; i++) {
      const y = 0.06 + i * gap;
      if (i > 0 || model === 1) k.box(w - 0.06, 0.025, d - 0.02, 0, y - (i === 0 ? 0.03 : 0), 0, wood);
      if (rng.chance(0.8)) bookRow(k, rng, p, { x0: -w / 2 + 0.04, x1: w / 2 - 0.04, y: y + 0.025, depth: 0.17, maxH: Math.min(0.26, gap - 0.06), minH: 0.15 });
    }
    return k.root;
  };
}

/** Étagère murale à petits objets : 0,9 × 0,25 × 0,22 (la planche et ce qu'elle porte). */
function wallShelf(model) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    const wood = rng.pick([p.wood, p.woodDark, p.fabricLight]);
    k.box(0.9, 0.03, 0.25, 0, 0, 0, wood);
    const H = 0.19;
    if (model === 0) {
      bookRow(k, rng, p, { x0: -0.42, x1: -0.02, y: 0.03, depth: 0.18, maxH: H, minH: 0.12 });
      k.cyl(0.05, 0.04, 0.14, 0.25, 0.03, 0, rng.pick([p.ceramic, p.accent]), { rough: 0.5 });
      k.cyl(0.02, 0.02, 0.05, 0.25, 0.17, 0, rng.pick([p.ceramic, p.accent]), { rough: 0.5 }, 12);
    } else if (model === 1) {
      k.cyl(0.07, 0.055, 0.1, -0.3, 0.03, 0, rng.pick([p.accent, p.ceramic, p.woodDark]), { rough: 0.6 });
      k.ell(0.1, 0.045, 0.08, -0.3, 0.145, 0, p.plant, { rough: 0.9 });
      k.box(0.3, H, 0.015, 0.05, 0.03, 0.02, rng.pick([p.woodDark, p.metal, '#1c1c1e']));
      k.box(0.26, H - 0.04, 0.005, 0.05, 0.05, 0.03, '#f4f1ea');
      k.box(0.18, 0.12, 0.18, 0.33, 0.03, 0, rng.pick([p.fabricLight, p.accent]));
    } else {
      for (let i = 0; i < 4; i++) {
        const jarH = i === 0 ? H : rng.range(0.11, H);
        k.cyl(0.04, 0.04, jarH, -0.3 + i * 0.2, 0.03, 0, rng.pick([p.ceramic, p.accent, p.fabricLight]), { rough: 0.4 });
      }
    }
    return k.root;
  };
}

/* ------------------------------------------------------------------ */
/* Salle à manger                                                      */
/* ------------------------------------------------------------------ */

function displayCabinet(model) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    const wood = rng.pick([p.wood, p.woodDark]);
    cabinet(k, { w: 1.0, d: 0.45, h: 0.85, leg: 0.08, body: wood, front: darker(k, wood, 0.08), doors: 2, handle: p.metal, legColor: darker(k, wood, 0.2) });
    for (const sx of sides) k.box(0.03, 1.05, 0.4, sx * 0.485, 0.85, -0.025, wood);
    k.box(1.0, 0.03, 0.45, 0, 1.87, 0, wood);
    k.box(0.94, 1.02, 0.01, 0, 0.85, -0.2, darker(k, wood, 0.15));
    const levels = model === 0 ? [1.2, 1.55] : [1.15, 1.4, 1.65];
    for (const y of levels) k.box(0.94, 0.01, 0.38, 0, y, -0.01, '#cfe3e8', GLASS);
    for (const y of [0.86, ...levels]) {
      let x = -0.38;
      while (x < 0.36) {
        const kind = rng.int(0, 2);
        const c = rng.pick([p.ceramic, p.fabricLight, p.accent]);
        if (kind === 0) k.cyl(0.07, 0.07, 0.012, x, y + (y === 0.86 ? 0 : 0.01), 0, c, { rough: 0.3 });
        else if (kind === 1) k.cyl(0.035, 0.03, 0.12, x, y + (y === 0.86 ? 0 : 0.01), 0, c, { rough: 0.3 });
        else k.cyl(0.03, 0.022, 0.09, x, y + (y === 0.86 ? 0 : 0.01), 0, '#dbe9ee', { rough: 0.1 });
        x += rng.range(0.12, 0.2);
      }
    }
    for (const sx of sides) {
      frameRect(k, { w: 0.47, h: 1.0, d: 0.02, border: 0.025, x: sx * 0.235, y: 0.86, z: 0.2, color: wood });
      k.box(0.42, 0.95, 0.006, sx * 0.235, 0.885, 0.205, '#cfe3e8', GLASS);
    }
    return k.root;
  };
}

function sideboardSmall(model) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    const wood = rng.pick([p.wood, p.woodDark, p.fabricLight]);
    if (model === 0) {
      cabinet(k, { w: 0.8, d: 0.4, h: 0.85, leg: rng.range(0.1, 0.16), body: wood, front: darker(k, wood, 0.1), doors: 2, handle: p.metal, legColor: rng.pick([p.woodDark, p.metal]) });
    } else {
      // Desserte à roulettes : deux plateaux, montants métal.
      for (const sx of sides) for (const sz of sides) {
        k.box(0.025, 0.85, 0.025, sx * 0.385, 0, sz * 0.185, p.metal, METAL);
        k.cyl(0.025, 0.025, 0.04, sx * 0.385, 0, sz * 0.175, '#1c1c1e', undefined, 10);
      }
      for (const y of [0.18, 0.5, 0.82]) k.rbox(0.8, 0.03, 0.4, 0.01, 0, y, 0, wood);
      k.cyl(0.07, 0.06, 0.15, -0.2, 0.53, 0, rng.pick([p.ceramic, p.accent]), { rough: 0.4 });
      k.box(0.3, 0.06, 0.2, 0.2, 0.53, 0, rng.pick([p.fabric, p.fabricLight]));
    }
    return k.root;
  };
}

function roundTable(model) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    const wood = rng.pick([p.wood, p.woodDark]);
    const top = model === 0 ? wood : rng.pick([p.ceramic, p.fabricLight, wood]);
    k.cyl(0.45, 0.45, 0.04, 0, 0.71, 0, top, { rough: 0.5 }, 36);
    if (model === 0) {
      k.cyl(0.07, 0.09, 0.67, 0, 0.04, 0, wood);
      k.cyl(0.26, 0.26, 0.04, 0, 0, 0, wood, undefined, 24);
    } else {
      for (const a of [0.8, 2.37, 3.94, 5.51]) k.cyl(0.02, 0.03, 0.71, Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3, rng.pick([wood, p.metal]), undefined, 10);
    }
    const colors = { leg: rng.pick([p.woodDark, p.metal, wood]), seat: rng.pick([p.fabric, p.fabricLight, p.accent]), back: null };
    colors.back = rng.chance(0.5) ? colors.seat : colors.leg;
    diningChair(k.sub(0, 0.49, Math.PI), colors);
    diningChair(k.sub(0, -0.49, 0), colors);
    diningChair(k.sub(0.49, 0, -Math.PI / 2), colors);
    diningChair(k.sub(-0.49, 0, Math.PI / 2), colors);
    return k.root;
  };
}

/* ------------------------------------------------------------------ */
/* Salon                                                               */
/* ------------------------------------------------------------------ */

/** Canapé d'angle 2,6 × 1,7 : assise en L, la méridienne à gauche ou à droite (tirée au hasard). */
function cornerSofa(ctx) {
  const { k, rng, p } = setup(ctx);
  const w = 2.6;
  const d = 1.7;
  const h = 0.85;
  const fabric = rng.pick([p.fabric, p.fabricLight, p.accent]);
  const soft = lighter(k, fabric, 0.1);
  const m = rng.chance(0.5) ? 1 : -1; // côté de la méridienne
  const leg = 0.08;
  const legColor = rng.pick([p.woodDark, p.metal]);
  for (const sx of sides) for (const sz of sides) k.box(0.05, leg, 0.05, sx * (w / 2 - 0.08), 0, sz * (d / 2 - 0.08), legColor);
  k.rbox(w, 0.28, 0.9, 0.04, 0, leg, -d / 2 + 0.45, fabric);
  k.rbox(0.9, 0.28, d, 0.04, m * (w / 2 - 0.45), leg, 0, fabric);
  k.rbox(w, h - leg, 0.22, 0.05, 0, leg, -d / 2 + 0.11, fabric);
  k.rbox(0.18, 0.62 - leg, d - 0.1, 0.05, -m * (w / 2 - 0.09), leg, 0.05, fabric);
  const seatW = (w - 0.18 - 0.9) / 2;
  for (let i = 0; i < 2; i++) {
    const x = -m * (w / 2 - 0.18 - seatW * (i + 0.5));
    k.rbox(seatW - 0.02, 0.14, 0.7, 0.05, x, leg + 0.28, -d / 2 + 0.57, soft);
    k.rbox(seatW - 0.04, 0.34, 0.14, 0.05, x, leg + 0.43, -d / 2 + 0.29, soft);
  }
  k.rbox(0.86, 0.14, d - 0.3, 0.05, m * (w / 2 - 0.45), leg + 0.28, 0.12, soft);
  k.rbox(0.8, 0.34, 0.14, 0.05, m * (w / 2 - 0.45), leg + 0.43, -d / 2 + 0.29, soft);
  const pillow = k.rbox(0.3, 0.26, 0.1, 0.04, -m * (w / 2 - 0.5), leg + 0.36, -d / 2 + 0.43, rng.pick([p.accent, p.fabricLight, p.fabric]));
  pillow.rotation.x = -0.3;
  return k.root;
}

function sideTable(model) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    const wood = rng.pick([p.wood, p.woodDark]);
    const color = rng.pick([wood, p.metal, p.ceramic]);
    if (model === 0) {
      // Bout de canapé rond, pied central.
      k.cyl(0.225, 0.225, 0.03, 0, 0.47, 0, color, { rough: 0.5 }, 32);
      k.cyl(0.02, 0.02, 0.47, 0, 0, 0, p.metal, METAL, 10);
      k.cyl(0.14, 0.14, 0.02, 0, 0, 0, p.metal, METAL, 20);
    } else if (model === 1) {
      // Carré, quatre pieds fuselés, tablette basse.
      k.rbox(0.45, 0.03, 0.45, 0.008, 0, 0.47, 0, wood);
      for (const sx of sides) for (const sz of sides) k.cyl(0.014, 0.02, 0.47, sx * 0.195, 0, sz * 0.195, wood, undefined, 10);
      k.box(0.38, 0.015, 0.38, 0, 0.15, 0, darker(k, wood, 0.1));
    } else {
      // Deux tables gigognes décalées.
      k.cyl(0.2, 0.2, 0.025, 0.02, 0.475, 0.02, color, { rough: 0.5 }, 28);
      k.cyl(0.02, 0.02, 0.475, 0.02, 0, 0.02, color, METAL, 10);
      k.cyl(0.16, 0.16, 0.025, -0.065, 0.335, -0.065, p.accent, { rough: 0.5 }, 28);
      k.cyl(0.015, 0.015, 0.335, -0.065, 0, -0.065, p.accent, METAL, 10);
      k.cyl(0.225, 0.225, 0.012, -0.0, 0, 0, color, { rough: 0.5 }, 28);
    }
    return k.root;
  };
}

function sideboardLong(model) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    const wood = rng.pick([p.wood, p.woodDark, p.fabricLight]);
    const front = model === 0 ? darker(k, wood, 0.1) : lighter(k, wood, 0.05);
    cabinet(k, { w: 1.8, d: 0.4, h: 0.7, leg: model === 0 ? rng.range(0.12, 0.18) : 0.1, body: wood, front, doors: model === 0 ? 4 : 0, drawers: 0, handle: p.metal, legColor: rng.pick([p.woodDark, p.metal]), plinth: model === 1 });
    if (model === 1) {
      // Enfilade à portes coulissantes bicolores : une porte sur deux plus claire.
      const slot = (1.8 - 0.04) / 4;
      for (let i = 0; i < 4; i++) k.box(slot - 0.01, 0.5, 0.012, -0.9 + 0.02 + (i + 0.5) * slot, 0.14, 0.2, i % 2 ? p.accent : front);
    }
    return k.root;
  };
}

function pouf(model) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    const fabric = rng.pick([p.fabric, p.accent, p.fabricLight]);
    if (model === 0) {
      k.cyl(0.25, 0.25, 0.4, 0, 0, 0, fabric, { rough: 0.95 }, 32);
      k.cyl(0.255, 0.255, 0.03, 0, 0.37, 0, lighter(k, fabric, 0.08), { rough: 0.95 }, 32);
    } else {
      k.rbox(0.5, 0.4, 0.5, 0.06, 0, 0, 0, fabric, { rough: 0.95 });
      k.box(0.45, 0.01, 0.01, 0, 0.395, 0, darker(k, fabric, 0.2));
    }
    return k.root;
  };
}

function stove(ctx) {
  const { k, rng, p } = setup(ctx);
  const color = rng.pick(['#26282c', '#3a3d42', p.metal]);
  k.box(0.5, 0.12, 0.45, 0, 0, 0, color, METAL);
  k.rbox(0.46, 0.7, 0.41, 0.04, 0, 0.12, 0, color, METAL);
  k.box(0.5, 0.04, 0.45, 0, 0.82, 0, color, METAL);
  k.box(0.28, 0.28, 0.01, 0, 0.3, 0.205, '#1a1210', { emissive: '#ff7a2a', emissiveIntensity: 0.55, rough: 0.3 });
  k.box(0.3, 0.3, 0.012, 0, 0.29, 0.198, color, METAL).scale.set(1, 1, 0.1);
  k.cyl(0.08, 0.08, 0.2, 0, 0.86, -0.05, color, METAL, 16);
  k.cyl(0.1, 0.1, 0.04, 0, 1.06, -0.05, color, METAL, 16);
  return k.root;
}

function blanketBasket(ctx) {
  const { k, rng, p } = setup(ctx);
  const wicker = rng.pick(['#b99668', '#a58257', p.wood]);
  k.cyl(0.225, 0.19, 0.34, 0, 0, 0, wicker, { rough: 1 }, 28);
  for (const y of [0.08, 0.17, 0.26]) k.cyl(0.228 - (0.34 - y) * 0.1, 0.228 - (0.34 - y) * 0.1, 0.012, 0, y, 0, darker(k, wicker, 0.15), { rough: 1 }, 28);
  const blanket = rng.pick([p.fabric, p.accent, p.fabricLight]);
  k.rbox(0.34, 0.06, 0.26, 0.03, -0.02, 0.34, 0, blanket, { rough: 1 });
  k.rbox(0.24, 0.07, 0.2, 0.03, 0.05, 0.33, 0.02, lighter(k, blanket, 0.12), { rough: 1 });
  return k.root;
}

/* ------------------------------------------------------------------ */
/* Chambres                                                            */
/* ------------------------------------------------------------------ */

function bedFrame({ w, headH, d = 2.1, pillows }) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    const frame = rng.pick([p.wood, p.woodDark]);
    const head = rng.pick([frame, p.fabric, p.fabricLight]);
    const leg = rng.range(0.08, 0.14);
    legs4(k, { w, d, h: leg, t: 0.05, inset: 0, color: frame });
    k.box(w, 0.2, d, 0, leg, 0, frame);
    k.rbox(w - 0.1, 0.22, d - 0.14, 0.05, 0, leg + 0.2, 0.03, lighter(k, p.fabricLight, 0.5));
    k.rbox(w, headH, 0.1, 0.03, 0, 0, -d / 2 + 0.05, head);
    const blanket = rng.pick([p.fabric, p.accent, p.fabricLight]);
    k.rbox(w - 0.06, 0.05, 1.2, 0.02, 0, leg + 0.4, 0.42, blanket);
    for (let i = 0; i < pillows; i++) {
      const x = pillows === 1 ? 0 : (i === 0 ? -1 : 1) * (w / 4);
      k.rbox(Math.min(0.55, w / pillows - 0.1), 0.12, 0.35, 0.05, x, leg + 0.42, -0.65, rng.pick([p.fabricLight, p.accent, '#f4f1ea']));
    }
    return k.root;
  };
}

function bunkBed(ctx) {
  const { k, rng, p } = setup(ctx);
  const wood = rng.pick([p.wood, p.woodDark]);
  const w = 1.0;
  const d = 2.1;
  const h = 1.7;
  for (const sx of sides) for (const sz of sides) k.box(0.06, h, 0.06, sx * (w / 2 - 0.03), 0, sz * (d / 2 - 0.03), wood);
  const matt = lighter(k, p.fabricLight, 0.5);
  const blanket = [rng.pick([p.fabric, p.accent]), rng.pick([p.accent, p.fabricLight, p.fabric])];
  [0.25, 1.05].forEach((y, i) => {
    k.box(w - 0.12, 0.06, d - 0.12, 0, y, 0, wood);
    k.rbox(w - 0.14, 0.14, d - 0.2, 0.04, 0, y + 0.06, 0, matt);
    k.rbox(w - 0.16, 0.05, 1.0, 0.02, 0, y + 0.18, 0.3, blanket[i]);
    k.rbox(0.5, 0.1, 0.32, 0.04, 0, y + 0.2, -d / 2 + 0.3, '#f4f1ea');
  });
  // Barrière du haut et échelle sur le côté.
  for (const sz of [-0.55, 0.0]) k.box(0.03, 0.22, 0.5, -w / 2 + 0.06, 1.3, sz - 0.05, wood);
  k.box(0.03, 0.04, d - 0.1, -w / 2 + 0.06, 1.49, 0, wood);
  for (let i = 0; i < 5; i++) k.box(0.03, 0.03, 0.38, w / 2 - 0.03, 0.2 + i * 0.25, d / 2 - 0.3, wood).rotation.set(0, 0, 0);
  for (const sz of [-1, 1]) k.box(0.035, 1.2, 0.035, w / 2 - 0.03, 0.2, d / 2 - 0.3 + sz * 0.18, wood);
  return k.root;
}

function babyBed(ctx) {
  const { k, rng, p } = setup(ctx);
  const wood = rng.pick([p.wood, p.fabricLight, '#f1efe9']);
  const w = 0.7;
  const d = 1.25;
  legs4(k, { w, d, h: 0.95, t: 0.045, inset: 0, color: wood });
  k.box(w - 0.1, 0.03, d - 0.1, 0, 0.3, 0, wood);
  k.rbox(w - 0.1, 0.1, d - 0.12, 0.03, 0, 0.33, 0, lighter(k, p.fabricLight, 0.5));
  const bars = 11;
  for (let i = 0; i < bars; i++) {
    const z = -d / 2 + 0.1 + ((d - 0.2) / (bars - 1)) * i;
    for (const sx of sides) k.box(0.014, 0.5, 0.014, sx * (w / 2 - 0.022), 0.4, z, wood);
  }
  for (const sx of sides) k.box(0.03, 0.04, d - 0.04, sx * (w / 2 - 0.022), 0.89, 0, wood);
  for (const sz of sides) k.box(w - 0.04, 0.5, 0.025, 0, 0.4, sz * (d / 2 - 0.0225), darker(k, wood, 0.04));
  k.rbox(0.5, 0.05, 0.9, 0.02, 0, 0.43, 0.05, rng.pick([p.accent, p.fabric, p.fabricLight]));
  return k.root;
}

function dressingTable(ctx) {
  const { k, rng, p } = setup(ctx);
  const wood = rng.pick([p.wood, p.woodDark, p.fabricLight]);
  k.box(1.0, 0.03, 0.45, 0, 0.72, 0, wood);
  legs4(k, { w: 1.0, d: 0.45, h: 0.72, t: 0.04, inset: 0.01, color: wood });
  const unit = darker(k, wood, 0.06);
  k.box(0.3, 0.2, 0.4, 0.33, 0.5, 0, unit);
  k.box(0.28, 0.16, 0.012, 0.33, 0.52, 0.204, lighter(k, wood, 0.1));
  k.box(0.04, 0.012, 0.014, 0.33, 0.6, 0.21, p.metal, METAL);
  const border = 0.03;
  frameRect(k, { w: 0.7, h: 0.75, d: 0.025, border, x: 0, y: 0.75, z: -0.2, color: rng.pick([p.metal, p.woodDark, wood]) });
  k.box(0.7 - 2 * border, 0.75 - 2 * border, 0.01, 0, 0.75 + border, -0.2, '#d4e4ea', { metal: 0.8, rough: 0.08 });
  k.cyl(0.04, 0.035, 0.1, -0.3, 0.75, -0.05, rng.pick([p.ceramic, p.accent]), { rough: 0.4 });
  k.box(0.14, 0.015, 0.1, -0.15, 0.75, 0.05, rng.pick([p.accent, p.fabricLight]));
  return k.root;
}

function bedBench(model) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    const fabric = rng.pick([p.fabric, p.fabricLight, p.accent]);
    if (model === 0) {
      legs4(k, { w: 1.2, d: 0.4, h: 0.15, t: 0.04, inset: 0.02, color: rng.pick([p.woodDark, p.metal]) });
      k.rbox(1.2, 0.3, 0.4, 0.06, 0, 0.15, 0, fabric, { rough: 0.95 });
    } else {
      const wood = rng.pick([p.wood, p.woodDark]);
      k.box(1.2, 0.04, 0.4, 0, 0.41, 0, wood);
      for (const sx of sides) k.box(0.04, 0.41, 0.36, sx * 0.58, 0, 0, wood);
      k.box(1.12, 0.02, 0.34, 0, 0.12, 0, wood);
      k.rbox(1.12, 0.05, 0.34, 0.02, 0, 0.14, 0, fabric);
    }
    return k.root;
  };
}

function openWardrobe(ctx) {
  const { k, rng, p } = setup(ctx);
  const frame = rng.pick([p.wood, p.woodDark, p.metal]);
  for (const sx of sides) k.box(0.03, 1.9, 0.5, sx * 0.485, 0, 0, frame);
  k.box(1.0, 0.03, 0.5, 0, 1.87, 0, frame);
  k.box(0.94, 0.04, 0.5, 0, 0, 0, frame);
  k.box(0.94, 0.02, 0.5, 0, 1.2, 0, frame);
  k.box(0.94, 1.83, 0.01, 0, 0.04, -0.245, darker(k, frame, 0.12));
  const rod = k.cyl(0.013, 0.013, 0.94, 0, 0, 0, p.metal, METAL, 10);
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, 1.75, -0.02);
  const colors = [p.fabric, p.accent, p.fabricLight, p.woodDark, '#2a2c32', '#d8d2c4'];
  let x = -0.42;
  while (x < 0.38) {
    const gw = rng.range(0.03, 0.05);
    k.box(gw, rng.range(0.5, 0.65), 0.34, x + gw / 2, 1.75 - 0.6, -0.02, rng.pick(colors), { rough: 1 });
    x += gw + 0.01;
  }
  for (let i = 0; i < 3; i++) k.rbox(0.28, 0.12, 0.34, 0.02, -0.3 + i * 0.3, 1.22, 0, rng.pick(colors), { rough: 1 });
  for (const x2 of [-0.23, 0.23]) k.box(0.4, 0.28, 0.4, x2, 0.04, 0.03, lighter(k, '#b99668', 0.0), { rough: 1 });
  return k.root;
}

function chestDrawers(ctx) {
  const { k, rng, p } = setup(ctx);
  const body = rng.pick([p.wood, p.woodDark, p.fabricLight]);
  cabinet(k, { w: 0.8, d: 0.45, h: 1.1, leg: rng.range(0.08, 0.14), body, front: darker(k, body, 0.1), drawers: rng.int(4, 5), handle: p.metal, legColor: rng.pick([p.woodDark, p.metal]) });
  return k.root;
}

function standingMirror(ctx) {
  const { k, rng, p } = setup(ctx);
  const frame = rng.pick([p.woodDark, p.wood, p.metal, '#1c1c1e']);
  frameRect(k, { w: 0.5, h: 1.7, d: 0.035, border: 0.035, y: 0.0, z: 0, color: frame });
  k.box(0.43, 1.63, 0.012, 0, 0.035, 0, '#d4e4ea', { metal: 0.8, rough: 0.08 });
  for (const sx of sides) k.box(0.035, 0.05, 0.08, sx * 0.2, 0, 0, frame);
  return k.root;
}

function wardrobe3(ctx) {
  const { k, rng, p } = setup(ctx);
  const body = rng.pick([p.wood, p.fabricLight, p.woodDark]);
  const mirrored = rng.chance(0.3);
  cabinet(k, { w: 1.8, d: 0.6, h: 2.1, leg: 0.05, body, front: mirrored ? '#c9d7dd' : darker(k, body, 0.08), doors: 3, handle: p.metal, plinth: true, legColor: '#2a2a2c', topT: 0.04 });
  return k.root;
}

/* ---- Chambre d'enfant ---- */

function toyBox(ctx) {
  const { k, rng, p } = setup(ctx);
  const wood = rng.pick([p.wood, p.fabricLight, p.accent]);
  // Coffre ouvert : le couvercle est appuyé contre le mur, les jouets dépassent.
  legs4(k, { w: 0.6, d: 0.4, h: 0.04, t: 0.04, inset: 0, color: darker(k, wood, 0.2) });
  k.box(0.6, 0.26, 0.4, 0, 0.04, 0, wood);
  k.box(0.6, 0.02, 0.4, 0, 0.3, 0, lighter(k, wood, 0.1));
  k.box(0.56, 0.01, 0.36, 0, 0.32, 0, darker(k, wood, 0.3));
  const toy = [p.accent, p.fabric, p.plant, '#e8b84a'];
  k.box(0.1, 0.08, 0.1, -0.15, 0.32, 0.02, rng.pick(toy)).rotation.y = 0.5;
  k.ell(0.07, 0.04, 0.07, 0.12, 0.36, -0.02, rng.pick(toy));
  k.box(0.6, 0.4, 0.02, 0, 0, -0.19, lighter(k, wood, 0.05));
  return k.root;
}

function kidsDesk(ctx) {
  const { k, rng, p } = setup(ctx);
  const wood = rng.pick([p.wood, p.fabricLight, p.woodDark]);
  k.rbox(0.9, 0.03, 0.5, 0.01, 0, 0.67, 0, wood);
  legs4(k, { w: 0.9, d: 0.5, h: 0.67, t: 0.04, inset: 0.02, color: rng.pick([wood, p.metal, p.accent]) });
  k.box(0.35, 0.14, 0.4, 0.25, 0.5, 0, darker(k, wood, 0.06));
  k.box(0.33, 0.1, 0.012, 0.25, 0.52, 0.202, lighter(k, wood, 0.1));
  return k.root;
}

function teepee(ctx) {
  const { k, rng, p } = setup(ctx);
  const T = ctx.THREE;
  const cloth = rng.pick([p.fabricLight, '#f1efe9', p.accent]);
  const stripe = rng.pick([p.accent, p.fabric, p.plant]);
  // Toile pyramidale à quatre faces (le sommet est coupé : les perches dépassent).
  const cone = new T.Mesh(new T.CylinderGeometry(0.02, 0.4 * Math.SQRT2, 1.0, 4, 1, false, Math.PI / 4), k.mat(cloth, { rough: 1 }));
  cone.position.y = 0.5;
  cone.castShadow = true;
  cone.receiveShadow = true;
  k.root.add(cone);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const pole = k.cyl(0.012, 0.012, 1.18, 0, 0, 0, p.woodDark, undefined, 8);
    pole.position.set(sx * 0.2, 0.56, sz * 0.2);
    pole.rotation.set(-sz * 0.35, 0, sx * 0.35);
  }
  k.rbox(0.8, 0.03, 0.8, 0.01, 0, 0, 0, stripe, { rough: 1 });
  return k.root;
}

function shelfLow(ctx) {
  const { k, rng, p } = setup(ctx);
  const wood = rng.pick([p.wood, p.fabricLight, p.woodDark, p.accent]);
  const w = 0.8;
  const d = 0.3;
  const h = 0.8;
  for (const sx of sides) k.box(0.03, h, d, sx * (w / 2 - 0.015), 0, 0, wood);
  for (const y of [0, 0.385, h - 0.03]) k.box(w, 0.03, d, 0, y, 0, wood);
  k.box(w - 0.06, h - 0.06, 0.01, 0, 0.03, -d / 2 + 0.005, darker(k, wood, 0.12));
  k.box(0.02, 0.35, d - 0.02, 0, 0.415 - 0.385 + 0.385 - 0.03 + 0.03, 0, wood);
  const colors = [p.accent, p.fabric, p.plant, '#e8b84a'];
  bookRow(k, rng, p, { x0: -0.36, x1: -0.03, y: 0.06, depth: 0.2, maxH: 0.3, minH: 0.2 });
  k.rbox(0.28, 0.2, 0.22, 0.03, 0.2, 0.06, 0, rng.pick(colors));
  k.rbox(0.28, 0.14, 0.22, 0.03, 0.2, 0.415, 0, rng.pick(colors));
  k.ell(0.07, 0.07, 0.07, -0.2, 0.49, 0, rng.pick(colors));
  return k.root;
}

/* ------------------------------------------------------------------ */
/* Cuisine                                                             */
/* ------------------------------------------------------------------ */

function dishwasher(ctx) {
  const { k, rng, p } = setup(ctx);
  const c = rng.pick([p.ceramic, p.metal, p.fabricLight]);
  const metallic = c === p.metal;
  k.rbox(0.6, 0.85, 0.6, 0.015, 0, 0, 0, c, { rough: 0.35, metal: metallic ? 0.6 : 0.1 });
  k.box(0.56, 0.06, 0.012, 0, 0.77, 0.3, '#1f2226');
  k.box(0.4, 0.02, 0.03, 0, 0.7, 0.31, p.metal, { metal: 0.8, rough: 0.3 });
  for (const x of [-0.2, 0.2]) k.cyl(0.012, 0.012, 0.012, x, 0.79, 0.307, p.metal, METAL, 10).rotation.x = Math.PI / 2;
  k.box(0.01, 0.01, 0.003, 0.2, 0.81, 0.31, '#4cc6ff', { emissive: '#4cc6ff', emissiveIntensity: 1 });
  return k.root;
}

function ovenColumn(ctx) {
  const { k, rng, p } = setup(ctx);
  const body = rng.pick([p.fabricLight, p.wood, p.fabric]);
  cabinet(k, { w: 0.6, d: 0.6, h: 2.1, leg: 0.1, plinth: true, legColor: '#2a2a2c', body, front: lighter(k, body, 0.08), top: body, topT: 0.03, doors: 0, handle: p.metal });
  k.box(0.56, 0.58, 0.012, 0, 0.62, 0.294, '#1c1d20', { rough: 0.2, metal: 0.4 });
  k.box(0.4, 0.3, 0.004, 0, 0.74, 0.298, '#0d1318', { rough: 0.1 });
  k.box(0.46, 0.02, 0.025, 0, 1.12, 0.29, p.metal, METAL);
  k.box(0.56, 0.1, 0.012, 0, 1.25, 0.294, '#1f2226');
  for (const x of [-0.18, 0.18]) k.cyl(0.015, 0.015, 0.012, x, 1.3, 0.294, p.metal, METAL, 10).rotation.x = Math.PI / 2;
  for (const y of [1.45, 1.8]) k.box(0.56, 0.3, 0.012, 0, y, 0.294, lighter(k, body, 0.04));
  return k.root;
}

function microwave(ctx) {
  const { k, rng, p } = setup(ctx);
  const c = rng.pick([p.metal, p.ceramic, '#2a2c30']);
  k.rbox(0.45, 0.28, 0.35, 0.015, 0, 0, 0, c, { rough: 0.35, metal: 0.4 });
  k.box(0.28, 0.2, 0.006, -0.065, 0.04, 0.176, '#0d1318', { rough: 0.1 });
  k.box(0.07, 0.2, 0.006, 0.16, 0.04, 0.176, '#1a1c20');
  k.box(0.04, 0.02, 0.006, 0.16, 0.2, 0.178, '#4cc6ff', { emissive: '#4cc6ff', emissiveIntensity: 0.9 });
  return k.root;
}

function trashBin(model) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    const c = rng.pick([p.metal, p.ceramic, '#2a2c30', p.accent]);
    if (model === 0) {
      k.cyl(0.175, 0.16, 0.6, 0, 0, 0, c, { rough: 0.4, metal: c === p.metal ? 0.6 : 0 }, 28);
      k.cyl(0.18, 0.18, 0.05, 0, 0.6, 0, darker(k, c, 0.1), { rough: 0.4 }, 28);
      k.box(0.06, 0.02, 0.07, 0, 0.0, 0.14, '#1c1c1e');
    } else {
      k.rbox(0.35, 0.65, 0.35, 0.03, 0, 0, 0, c, { rough: 0.4, metal: c === p.metal ? 0.6 : 0 });
      k.box(0.34, 0.04, 0.34, 0, 0.62, 0, darker(k, c, 0.12));
      k.box(0.2, 0.02, 0.02, 0, 0.58, 0.18, p.metal, METAL);
    }
    return k.root;
  };
}

function fridgeAmerican(ctx) {
  const { k, rng, p } = setup(ctx);
  const c = rng.pick([p.metal, p.ceramic, '#2a2c30']);
  const o = { metal: c === p.metal ? 0.6 : 0.15, rough: 0.35 };
  k.rbox(0.9, 1.78, 0.7, 0.03, 0, 0, 0, c, o);
  k.box(0.01, 1.78, 0.012, 0, 0, 0.35, '#1c1c1e');
  k.box(0.88, 0.012, 0.012, 0, 0.62, 0.35, '#1c1c1e');
  for (const sx of sides) k.box(0.025, 0.55, 0.03, sx * 0.04 * 1.0, 0.95, 0.365, p.metal, { metal: 0.8, rough: 0.3 });
  k.box(0.2, 0.3, 0.01, 0.2, 1.28, 0.352, '#0d1318', { rough: 0.1 });
  return k.root;
}

function kitchenTable2(ctx) {
  const { k, rng, p } = setup(ctx);
  const wood = rng.pick([p.wood, p.woodDark]);
  k.rbox(0.7, 0.04, 0.6, 0.012, 0, 0.71, 0, wood);
  legs4(k, { w: 0.7, d: 0.6, h: 0.71, t: 0.05, inset: 0.03, color: rng.pick([wood, p.metal]) });
  const colors = { leg: rng.pick([p.woodDark, p.metal, wood]), seat: rng.pick([p.fabric, p.fabricLight, p.accent]), back: null };
  colors.back = rng.chance(0.5) ? colors.seat : colors.leg;
  diningChair(k.sub(0, 0.43, Math.PI), colors);
  diningChair(k.sub(0, -0.43, 0), colors);
  return k.root;
}

/* ------------------------------------------------------------------ */
/* Salle de bain, WC, buanderie                                        */
/* ------------------------------------------------------------------ */

function doubleVanity(ctx) {
  const { k, rng, p } = setup(ctx);
  const body = rng.pick([p.wood, p.woodDark, p.fabricLight]);
  cabinet(k, { w: 1.4, d: 0.5, h: 0.8, leg: rng.range(0.1, 0.16), body, front: darker(k, body, 0.1), top: p.ceramic, topT: 0.03, doors: 0, drawers: 2, handle: p.metal, legColor: rng.pick([p.metal, p.woodDark]) });
  for (const sx of sides) {
    k.rbox(0.45, 0.08, 0.36, 0.04, sx * 0.34, 0.8, 0.02, p.ceramic, { rough: 0.3 });
    k.cyl(0.012, 0.012, 0.12, sx * 0.34, 0.88, -0.15, p.metal, { metal: 0.9, rough: 0.2 }, 12);
    k.box(0.012, 0.012, 0.08, sx * 0.34, 0.98, -0.11, p.metal, { metal: 0.9, rough: 0.2 });
  }
  const border = 0.03;
  const frame = rng.pick([p.metal, p.woodDark, p.wood]);
  frameRect(k, { w: 1.3, h: 0.9, d: 0.02, border, y: 1.0, z: -0.24, color: frame });
  k.box(1.3 - 2 * border, 0.9 - 2 * border, 0.01, 0, 1.0 + border, -0.24, '#d4e4ea', { metal: 0.8, rough: 0.08 });
  k.box(1.3, 0.04, 0.06, 0, 1.86, -0.2, frame);
  return k.root;
}

function columnCabinet(model) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    const body = rng.pick([p.wood, p.woodDark, p.fabricLight, p.ceramic]);
    if (model === 0) {
      cabinet(k, { w: 0.35, d: 0.3, h: 1.6, leg: 0.1, body, front: darker(k, body, 0.06), doors: 1, handle: p.metal, legColor: rng.pick([p.metal, p.woodDark]), topT: 0.02 });
    } else {
      // Colonne ouverte : trois niches avec serviettes roulées.
      for (const sx of sides) k.box(0.02, 1.6, 0.3, sx * 0.165, 0, 0, body);
      for (const y of [0.1, 0.55, 1.0, 1.58]) k.box(0.31, 0.02, 0.3, 0, y, 0, body);
      k.box(0.31, 1.5, 0.01, 0, 0.1, -0.145, darker(k, body, 0.12));
      for (const y of [0.12, 0.57, 1.02]) for (let i = 0; i < 3; i++) k.cyl(0.05, 0.05, 0.26, 0, 0, 0, rng.pick([p.fabricLight, p.accent, p.ceramic]), { rough: 1 }, 14).position.set(0, y + 0.07 + i * 0.1, 0.0);
    }
    return k.root;
  };
}

function towelRadiator(ctx) {
  const { k, rng, p } = setup(ctx);
  const c = rng.pick(['#f1f1ee', p.metal, '#2a2c30']);
  const o = { metal: 0.3, rough: 0.4 };
  for (const sx of sides) k.box(0.04, 1.2, 0.04, sx * 0.23, 0, -0.03, c, o);
  const bars = 9;
  for (let i = 0; i < bars; i++) {
    const y = 0.04 + ((1.2 - 0.1) / (bars - 1)) * i;
    k.box(0.46, 0.022, 0.022, 0, y, 0.039, c, o);
    for (const sx of sides) k.box(0.02, 0.02, 0.06, sx * 0.23, y, 0.01, c, o);
  }
  k.rbox(0.4, 0.34, 0.03, 0.01, 0, 0.66, 0.05 - 0.015, rng.pick([p.fabricLight, p.accent, p.fabric]), { rough: 1 });
  return k.root;
}

function laundryBasket(model) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    const wicker = rng.pick(['#b99668', '#a58257', p.wood, p.fabricLight]);
    if (model === 0) {
      k.rbox(0.4, 0.5, 0.3, 0.08, 0, 0, 0, wicker, { rough: 1 });
      for (const y of [0.1, 0.2, 0.3, 0.4]) k.box(0.402, 0.014, 0.302, 0, y, 0, darker(k, wicker, 0.15), { rough: 1 });
      k.rbox(0.4, 0.05, 0.3, 0.02, 0, 0.5, 0, darker(k, wicker, 0.08), { rough: 1 });
    } else {
      // Sac à linge sur cadre métallique.
      for (const sx of sides) for (const sz of sides) k.cyl(0.012, 0.012, 0.55, sx * 0.185, 0, sz * 0.135, p.metal, METAL, 8);
      k.rbox(0.38, 0.4, 0.28, 0.05, 0, 0.1, 0, rng.pick([p.fabricLight, p.fabric, '#e6e1d3']), { rough: 1 });
      for (const [w, d, x, z] of [[0.4, 0.02, 0, 0.135], [0.4, 0.02, 0, -0.135], [0.02, 0.3, 0.185, 0], [0.02, 0.3, -0.185, 0]]) k.box(w, 0.02, d, x, 0.53, z, p.metal, METAL);
    }
    return k.root;
  };
}

function dryer(ctx) {
  const { k, rng, p } = setup(ctx);
  const c = rng.pick([p.ceramic, p.fabricLight]);
  k.rbox(0.6, 0.85, 0.6, 0.02, 0, 0, 0, c, { rough: 0.35 });
  const door = k.cyl(0.21, 0.21, 0.02, 0, 0, 0, '#2c3a44', { metal: 0.5, rough: 0.15 }, 24);
  door.rotation.x = Math.PI / 2;
  door.position.set(0, 0.4, 0.29);
  const glass = k.cyl(0.17, 0.17, 0.02, 0, 0, 0, '#101a22', { rough: 0.1 }, 24);
  glass.rotation.x = Math.PI / 2;
  glass.position.set(0, 0.4, 0.293);
  k.box(0.56, 0.08, 0.01, 0, 0.74, 0.29, '#1f2226');
  k.box(0.1, 0.03, 0.006, 0.17, 0.765, 0.296, '#ff9a4a', { emissive: '#ff9a4a', emissiveIntensity: 0.9 });
  k.cyl(0.025, 0.025, 0.01, -0.17, 0.78, 0.275, p.metal, { metal: 0.8 }, 12).rotation.x = Math.PI / 2;
  return k.root;
}

function utilitySink(model) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    const body = rng.pick([p.fabricLight, p.wood, p.fabric]);
    const tapMetal = { metal: 0.9, rough: 0.2 };
    let rim;
    if (model === 0) {
      cabinet(k, { w: 0.6, d: 0.5, h: 0.75, leg: 0.08, body, front: lighter(k, body, 0.06), top: p.ceramic, topT: 0.04, doors: 2, handle: p.metal, legColor: '#2a2a2c' });
      k.rbox(0.5, 0.1, 0.4, 0.04, 0, 0.75, 0.02, '#d8dcdf', { rough: 0.3 });
      rim = 0.85;
    } else {
      // Bac en résine sur pieds métal.
      for (const sx of sides) for (const sz of sides) k.box(0.04, 0.5, 0.04, sx * 0.27, 0, sz * 0.22, p.metal, METAL);
      k.box(0.54, 0.02, 0.44, 0, 0.3, 0, p.metal, METAL);
      k.rbox(0.6, 0.3, 0.5, 0.05, 0, 0.5, 0, '#e6e8ea', { rough: 0.35 });
      rim = 0.8;
    }
    k.cyl(0.015, 0.015, 0.9 - rim - 0.012, 0, rim, -0.2, p.metal, tapMetal, 12);
    k.box(0.012, 0.012, 0.1, 0, 0.888, -0.15, p.metal, tapMetal);
    return k.root;
  };
}

function dryingRack(ctx) {
  const { k, rng, p } = setup(ctx);
  const frame = rng.pick([p.metal, '#d9dcde', p.wood]);
  const o = { metal: 0.6, rough: 0.35 };
  for (const sz of sides) for (const sx of sides) {
    const leg = k.box(0.025, 1.0, 0.025, sx * 0.5 - sx * 0.0125, 0, sz * 0.3 - sz * 0.0125, frame, o);
    void leg;
  }
  for (let i = 0; i < 7; i++) {
    const z = -0.29 + (0.58 / 6) * i;
    k.box(0.95, 0.012, 0.012, 0, 0.97 - Math.abs(i - 3) * 0.0, z, frame, o);
  }
  k.box(1.0, 0.02, 0.025, 0, 0.98, 0.2875, frame, o);
  k.box(1.0, 0.02, 0.025, 0, 0.98, -0.2875, frame, o);
  for (const y of [0.3]) for (const sz of sides) k.box(1.0, 0.012, 0.012, 0, y, sz * 0.29, frame, o);
  const cloth = [p.fabric, p.fabricLight, p.accent, '#e6e1d3'];
  k.box(0.4, 0.012, 0.3, -0.2, 0.975, -0.1, rng.pick(cloth), { rough: 1 });
  k.box(0.3, 0.012, 0.25, 0.25, 0.975, 0.12, rng.pick(cloth), { rough: 1 });
  return k.root;
}

function broomCupboard(model) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    const body = rng.pick([p.fabricLight, p.wood, p.woodDark, p.ceramic]);
    if (model === 0) {
      cabinet(k, { w: 0.5, d: 0.5, h: 1.9, leg: 0.06, plinth: true, legColor: '#2a2a2c', body, front: darker(k, body, 0.05), doors: 1, handle: p.metal, topT: 0.03 });
    } else {
      // Placard ouvert : balai, serpillière sur manche, seau et produits.
      for (const sx of sides) k.box(0.03, 1.9, 0.5, sx * 0.235, 0, 0, body);
      k.box(0.5, 0.03, 0.5, 0, 1.87, 0, body);
      k.box(0.44, 0.06, 0.5, 0, 0, 0, body);
      k.box(0.44, 1.81, 0.01, 0, 0.06, -0.245, darker(k, body, 0.25));
      k.box(0.44, 0.02, 0.4, 0, 1.3, -0.04, body);
      k.cyl(0.012, 0.012, 1.6, -0.12, 0.06, -0.12, p.woodDark, undefined, 8);
      k.box(0.3, 0.04, 0.06, -0.12, 0.06, -0.12, p.accent);
      k.cyl(0.012, 0.012, 1.55, 0.04, 0.06, -0.12, p.woodDark, undefined, 8);
      k.cyl(0.06, 0.05, 0.2, 0.04, 0.06, -0.12, p.fabricLight, { rough: 1 });
      k.cyl(0.1, 0.085, 0.26, 0.13, 0.06, 0.1, p.accent, { rough: 0.5 });
      for (let i = 0; i < 3; i++) k.cyl(0.04, 0.04, 0.2, -0.15 + i * 0.1, 1.32, -0.1, rng.pick([p.accent, p.plant, p.fabric]), { rough: 0.4 }, 14);
    }
    return k.root;
  };
}

function waterHeater(ctx) {
  const { k, rng, p } = setup(ctx);
  const c = rng.pick(['#f1f1ee', p.ceramic]);
  k.cyl(0.25, 0.25, 1.5, 0, 0.05, 0, c, { rough: 0.35 }, 32);
  k.cyl(0.22, 0.25, 0.05, 0, 0, 0, '#9ba1a7', METAL, 24);
  k.cyl(0.25, 0.22, 0.05, 0, 1.55, 0, c, { rough: 0.35 }, 32);
  for (const x of [-0.07, 0.07]) k.cyl(0.02, 0.02, 0.1, x, 1.51, -0.1, p.metal, METAL, 12);
  k.box(0.16, 0.1, 0.03, 0, 1.1, 0.24, '#1f2226').rotation.set(0, 0, 0);
  k.cyl(0.02, 0.02, 0.012, 0.0, 1.14, 0.265, '#4cc6ff', { emissive: '#4cc6ff', emissiveIntensity: 0.9 }, 10).rotation.x = Math.PI / 2;
  return k.root;
}

function wcCabinet(model) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    const body = rng.pick([p.wood, p.fabricLight, p.ceramic, p.woodDark]);
    if (model === 0) {
      k.box(0.4, 0.6, 0.2, 0, 0, 0, body);
      k.box(0.36, 0.56, 0.012, 0, 0.02, 0.094, darker(k, body, 0.08));
      k.box(0.012, 0.14, 0.02, 0.14, 0.28, 0.09, p.metal, METAL);
    } else {
      // Niche ouverte avec rouleaux de papier.
      for (const sx of sides) k.box(0.02, 0.6, 0.2, sx * 0.19, 0, 0, body);
      for (const y of [0, 0.29, 0.58]) k.box(0.4, 0.02, 0.2, 0, y, 0, body);
      k.box(0.36, 0.56, 0.01, 0, 0.02, -0.095, darker(k, body, 0.12));
      for (let i = 0; i < 3; i++) k.cyl(0.055, 0.055, 0.11, -0.12 + i * 0.12, 0.31, 0.0, '#f6f6f3', { rough: 0.9 }, 16);
      k.cyl(0.07, 0.07, 0.12, 0.0, 0.04, 0.0, rng.pick([p.accent, p.plant]), { rough: 0.6 }, 16);
    }
    return k.root;
  };
}

function toiletBrush(ctx) {
  const { k, rng, p } = setup(ctx);
  const c = rng.pick([p.metal, p.ceramic, p.accent]);
  k.cyl(0.06, 0.055, 0.28, 0, 0, 0, c, { rough: 0.4, metal: c === p.metal ? 0.6 : 0 }, 20);
  k.cyl(0.012, 0.012, 0.4, 0, 0, 0, '#2a2c30', undefined, 8);
  k.ell(0.04, 0.04, 0.04, 0, 0.36, 0, '#2a2c30');
  return k.root;
}

/* ------------------------------------------------------------------ */
/* Bureau                                                              */
/* ------------------------------------------------------------------ */

function deskLarge(ctx) {
  const { k, rng, p } = setup(ctx);
  const wood = rng.pick([p.wood, p.woodDark, p.fabricLight]);
  const legColor = rng.pick([wood, p.metal, p.woodDark]);
  k.rbox(1.6, 0.04, 0.7, 0.01, 0, 0.71, 0, wood);
  if (rng.chance(0.5)) {
    for (const sx of sides) k.box(0.04, 0.71, 0.66, sx * 0.77, 0, 0, legColor);
    k.box(1.5, 0.35, 0.02, 0, 0.36, -0.3, darker(k, wood, 0.1));
  } else {
    legs4(k, { w: 1.6, d: 0.7, h: 0.71, t: 0.05, inset: 0.03, color: legColor });
    k.box(1.5, 0.02, 0.02, 0, 0.14, -0.29, legColor);
  }
  const side = rng.chance(0.5) ? 1 : -1;
  const unit = darker(k, wood, 0.08);
  k.box(0.42, 0.55, 0.6, side * 0.55, 0.12, 0, unit);
  for (let i = 0; i < 3; i++) {
    k.box(0.38, 0.16, 0.012, side * 0.55, 0.14 + i * 0.18, 0.306, lighter(k, wood, 0.1));
    k.box(0.12, 0.012, 0.014, side * 0.55, 0.14 + i * 0.18 + 0.1, 0.314, p.metal, METAL);
  }
  return k.root;
}

function drawerUnit(ctx) {
  const { k, rng, p } = setup(ctx);
  const body = rng.pick([p.fabricLight, p.wood, p.metal, p.fabric]);
  for (const sx of sides) for (const sz of sides) {
    k.cyl(0.02, 0.02, 0.05, sx * 0.17, 0, sz * 0.22, '#1c1c1e', undefined, 10);
    void sx;
  }
  k.box(0.4, 0.5, 0.5, 0, 0.05, 0, body);
  k.box(0.4, 0.05, 0.5, 0, 0.55, 0, darker(k, body, 0.08));
  for (let i = 0; i < 3; i++) {
    k.box(0.36, 0.14, 0.012, 0, 0.07 + i * 0.16, 0.25, lighter(k, body, 0.08));
    k.box(0.1, 0.012, 0.014, 0, 0.07 + i * 0.16 + 0.1, 0.258, p.metal, METAL);
  }
  return k.root;
}

function filingCabinet(ctx) {
  const { k, rng, p } = setup(ctx);
  const c = rng.pick([p.metal, '#9ba1a7', p.fabricLight, '#3a3d42']);
  const o = { metal: 0.5, rough: 0.45 };
  k.box(0.45, 1.3, 0.6, 0, 0, 0, c, o);
  const n = 4;
  for (let i = 0; i < n; i++) {
    const y = 0.04 + i * ((1.3 - 0.08) / n);
    k.box(0.41, (1.3 - 0.08) / n - 0.02, 0.012, 0, y, 0.294, lighter(k, c, 0.06), o);
    k.box(0.14, 0.02, 0.025, 0, y + 0.2, 0.29, p.metal, { metal: 0.8, rough: 0.3 });
    k.box(0.08, 0.04, 0.004, 0, y + 0.1, 0.302, '#f4f1ea');
  }
  return k.root;
}

function computer(model) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    const body = rng.pick(['#1c1c1e', '#2a2c30', p.metal]);
    const lit = { emissive: '#1a3a52', emissiveIntensity: 0.5, rough: 0.2 };
    const keys = '#d7d7d9';
    if (model === 0) {
      // Écran sur pied, clavier et souris.
      k.box(0.6, 0.34, 0.025, 0, 0.11, -0.17, body);
      k.box(0.57, 0.31, 0.004, 0, 0.125, -0.155, '#0c1822', lit);
      k.box(0.05, 0.1, 0.04, 0, 0.0, -0.17, body);
      k.box(0.24, 0.012, 0.15, 0, 0.0, -0.125, body);
      k.rbox(0.4, 0.018, 0.14, 0.006, -0.05, 0.0, 0.13, keys);
      k.rbox(0.06, 0.022, 0.1, 0.012, 0.22, 0.0, 0.15, body);
    } else if (model === 1) {
      // Deux écrans côte à côte, clavier.
      for (const sx of sides) {
        k.box(0.3, 0.3, 0.025, sx * 0.15, 0.15, -0.17, body);
        k.box(0.27, 0.27, 0.004, sx * 0.15, 0.165, -0.155, '#0c1822', lit);
        k.box(0.03, 0.15, 0.03, sx * 0.15, 0.0, -0.17, body);
        k.box(0.16, 0.01, 0.12, sx * 0.15, 0.0, -0.14, body);
      }
      k.box(0.6, 0.012, 0.012, 0, 0.45 - 0.012, -0.17, body);
      k.rbox(0.4, 0.018, 0.12, 0.006, 0, 0.0, 0.14, keys);
    } else {
      // Tout-en-un : grand écran, pied unique, clavier fin.
      k.rbox(0.6, 0.38, 0.02, 0.008, 0, 0.07, -0.17, p.metal, METAL);
      k.box(0.57, 0.33, 0.004, 0, 0.095, -0.158, '#0c1822', lit);
      k.box(0.06, 0.1, 0.03, 0, 0.0, -0.17, p.metal, METAL);
      k.box(0.24, 0.012, 0.16, 0, 0.0, -0.12, p.metal, METAL);
      k.rbox(0.36, 0.012, 0.13, 0.005, 0, 0.0, 0.14, keys);
      k.rbox(0.06, 0.016, 0.1, 0.01, 0.2, 0.0, 0.14, keys);
      k.box(0.12, 0.012, 0.012, -0.2, 0.0, 0.14, body);
    }
    return k.root;
  };
}

function boardWall(model) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    const frame = rng.pick([p.woodDark, p.wood, p.metal, '#1c1c1e']);
    const w = 1.0;
    const h = 0.7;
    const d = 0.03;
    if (model === 0) {
      frameRect(k, { w, h, d, border: 0.025, color: frame });
      k.box(w - 0.05, h - 0.05, d * 0.6, 0, 0.025, -d * 0.1, '#b78f5e', { rough: 1 });
      const notes = ['#f4e27a', '#f2a1b3', '#9bd3e8', '#f4f1ea'];
      for (let i = 0; i < 6; i++) k.box(0.12, 0.12, 0.004, -0.4 + (i % 3) * 0.3 + rng.range(-0.05, 0.05), 0.15 + Math.floor(i / 3) * 0.3 + rng.range(-0.03, 0.03), 0.012, rng.pick(notes));
    } else {
      frameRect(k, { w, h, d, border: 0.02, color: p.metal });
      k.box(w - 0.04, h - 0.04, d * 0.6, 0, 0.02, -d * 0.1, '#f8f8f6', { rough: 0.2 });
      k.box(0.5, 0.012, 0.004, -0.15, 0.45, 0.012, p.accent);
      k.box(0.35, 0.012, 0.004, -0.22, 0.38, 0.012, p.fabric);
    }
    return k.root;
  };
}

/* ------------------------------------------------------------------ */
/* Éclairage, chauffage et petite décoration                           */
/* ------------------------------------------------------------------ */

function radiator(ctx) {
  const { k, rng, p } = setup(ctx);
  const c = rng.pick(['#f4f4f1', '#e9e9e4', p.ceramic]);
  const o = { rough: 0.4, metal: 0.2 };
  const fins = 14;
  const gap = 0.8 / fins;
  k.box(0.8, 0.5, 0.025, 0, 0.05, -0.0375, c, o);
  for (let i = 0; i < fins; i++) k.box(gap * 0.55, 0.6, 0.05, -0.4 + gap * (i + 0.5), 0, 0.0, c, o).scale.set(1, 1, 1);
  k.box(0.8, 0.04, 0.1, 0, 0.56, 0, c, o);
  return k.root;
}

function wallSconce(model) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    const metal = rng.pick([p.metal, p.woodDark, '#1c1c1e']);
    const shade = rng.pick([p.fabricLight, p.accent, p.wall]);
    k.box(0.1, 0.25, 0.02, 0, 0, -0.05, metal, METAL);
    if (model === 0) {
      k.box(0.03, 0.03, 0.08, 0, 0.1, -0.02, metal, METAL);
      k.cyl(0.07, 0.05, 0.14, 0, 0.1, 0.02, shade, { emissive: shade, emissiveIntensity: 0.4, rough: 0.8 }, 20);
      k.box(0.15, 0.02, 0.02, 0, 0.0, -0.05, metal, METAL);
    } else {
      k.cyl(0.075, 0.075, 0.12, 0, 0.0, 0.0, '#fff4d6', { emissive: '#ffd98a', emissiveIntensity: 0.6, opacity: 0.9 }, 20).position.set(0, 0.07, -0.0);
      k.box(0.15, 0.25, 0.02, 0, 0, -0.05, metal, METAL);
    }
    return k.root;
  };
}

function pendantLight(model) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    const shade = rng.pick([p.fabricLight, p.accent, p.metal, p.wood]);
    const metal = { metal: 0.6, rough: 0.4 };
    k.cyl(0.04, 0.04, 0.02, 0, 0.78, 0, p.metal, metal, 16);
    if (model === 0) {
      // Abat-jour conique (le haut du cône est étroit, l'ampoule dessous).
      k.cyl(0.004, 0.004, 0.55, 0, 0.23, 0, p.metal, metal, 6);
      k.cyl(0.05, 0.25, 0.22, 0, 0.0, 0, shade, { emissive: shade, emissiveIntensity: 0.3, rough: 0.7 }, 28);
      k.ell(0.05, 0.05, 0.05, 0, 0.05, 0, '#fff4d6', { emissive: '#ffd98a', emissiveIntensity: 1 });
    } else {
      // Globe opale.
      k.cyl(0.004, 0.004, 0.28, 0, 0.5, 0, p.metal, metal, 6);
      k.ell(0.25, 0.25, 0.25, 0, 0.25, 0, '#fff4d6', { emissive: '#ffd98a', emissiveIntensity: 0.7, opacity: 0.92 });
    }
    return k.root;
  };
}

function blinds(ctx) {
  const { k, rng, p } = setup(ctx);
  const slat = rng.pick([p.fabricLight, p.wall, p.wood, '#e6e1d3']);
  k.box(1.2, 0.05, 0.08, 0, 1.45, 0, p.metal, METAL);
  const n = 22;
  for (let i = 0; i < n; i++) k.box(1.16, 0.035, 0.012, 0, 1.4 - ((1.4 - 0.1) / n) * (i + 1) + 0.02, 0.0, slat, { rough: 0.6 });
  k.box(1.16, 0.03, 0.02, 0, 0.0, 0.0, darker(k, slat, 0.12));
  for (const sx of sides) k.box(0.004, 1.4, 0.004, sx * 0.5, 0.0, 0.025, '#e6e1d3');
  return k.root;
}

function wallClock(model) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    const frame = rng.pick([p.woodDark, p.metal, '#1c1c1e', p.wood]);
    const face = rng.pick(['#f6f4ee', '#1f2226', p.fabricLight]);
    const hand = face === '#1f2226' ? '#f4f1ea' : '#22252b';
    const disc = (r, h, z, color, o) => {
      const m = k.cyl(r, r, h, 0, 0, 0, color, o, 32);
      m.rotation.x = Math.PI / 2;
      m.position.set(0, 0.15, z);
    };
    if (model === 0) {
      disc(0.15, 0.04, -0.02, frame);
      disc(0.13, 0.01, 0.0, face, { rough: 0.4 });
    } else {
      k.box(0.3, 0.3, 0.04, 0, 0, -0.02, frame);
      disc(0.13, 0.01, 0.004, face, { rough: 0.4 });
    }
    k.box(0.012, 0.1, 0.004, 0, 0.15, 0.011, hand);
    const minute = k.box(0.008, 0.12, 0.004, 0, 0.0, 0.0125, hand);
    minute.rotation.z = -1.1;
    minute.position.set(0.04, 0.17, 0.0125);
    return k.root;
  };
}

function mirrorRound(ctx) {
  const { k, rng, p } = setup(ctx);
  const frame = rng.pick([p.woodDark, p.wood, p.metal, p.accent]);
  const ring = k.cyl(0.3, 0.3, 0.04, 0, 0, 0, frame, { rough: 0.5, metal: frame === p.metal ? 0.6 : 0 }, 40);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0.3, -0.0);
  const glass = k.cyl(0.272, 0.272, 0.012, 0, 0, 0, '#d4e4ea', { metal: 0.8, rough: 0.08 }, 40);
  glass.rotation.x = Math.PI / 2;
  glass.position.set(0, 0.3, 0.014);
  return k.root;
}

function booksStack(model) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    const colors = [p.accent, p.fabric, p.fabricLight, p.woodDark, p.plant];
    if (model === 0) {
      // Pile à plat de quatre livres de moins en moins grands (le plus grand fait 0,25 × 0,18).
      k.box(0.25, 0.04, 0.18, 0, 0, 0, rng.pick(colors));
      k.box(0.22, 0.035, 0.16, 0.01, 0.04, 0.0, rng.pick(colors));
      k.box(0.2, 0.04, 0.15, -0.01, 0.075, 0.01, rng.pick(colors));
      k.box(0.12, 0.035, 0.1, 0.0, 0.115, 0.0, '#f4f1ea');
    } else {
      // Livres debout, un livre couché contre eux.
      const widths = [0.038, 0.034, 0.04, 0.034];
      let x = -0.125;
      widths.forEach((w, i) => {
        k.box(w, i === 0 ? 0.15 : rng.range(0.11, 0.15), 0.18, x + w / 2, 0, 0, rng.pick(colors));
        x += w + 0.002;
      });
      k.box(0.1, 0.03, 0.14, 0.075, 0.0, 0.0, rng.pick(colors));
    }
    return k.root;
  };
}

function vase(model) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    const c = rng.pick([p.ceramic, p.accent, p.fabricLight, p.woodDark]);
    if (model === 0) {
      // Vase évasé avec cinq fleurs.
      k.cyl(0.04, 0.075, 0.2, 0, 0, 0, c, { rough: 0.3 }, 24);
      k.cyl(0.03, 0.04, 0.06, 0, 0.2, 0, c, { rough: 0.3 }, 24);
      for (let i = 0; i < 5; i++) {
        const a = i * 1.3;
        k.cyl(0.004, 0.004, 0.1, Math.sin(a) * 0.02, 0.25, Math.cos(a) * 0.02, p.plant, undefined, 6);
        k.ell(0.025, 0.025, 0.025, Math.sin(a) * 0.045, 0.32 + (i % 2) * 0.004, Math.cos(a) * 0.045, rng.pick([p.accent, '#f2a1b3', '#f4e27a', '#f4f1ea']));
      }
    } else if (model === 1) {
      // Soliflore : bouteille ronde, une longue tige et une feuille.
      k.ell(0.075, 0.1, 0.075, 0, 0.1, 0, c, { rough: 0.3 });
      k.cyl(0.025, 0.04, 0.11, 0, 0.2, 0, c, { rough: 0.3 }, 20);
      k.cyl(0.003, 0.003, 0.1, 0, 0.25, 0, p.plant, undefined, 6);
      k.ell(0.03, 0.04, 0.012, 0, 0.31, 0, p.plant);
    } else {
      // Pot d'herbes sèches.
      k.cyl(0.075, 0.07, 0.09, 0, 0, 0, c, { rough: 0.35 }, 24);
      const blades = [[0, 0, 0.26], [0.03, 0.02, 0.2], [-0.03, 0.025, 0.22], [0.02, -0.03, 0.17], [-0.035, -0.02, 0.15], [0.0, 0.04, 0.12]];
      blades.forEach(([x, z, h], i) => k.box(0.012, h, 0.012, x, 0.09, z, i % 2 ? '#c9b27a' : '#b59a5e', { rough: 1 }));
    }
    return k.root;
  };
}

function fruitBowl(model) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    const bowl = rng.pick([p.ceramic, p.woodDark, p.accent, p.wood]);
    const fruit = ['#d9453a', '#e8b84a', '#7fb552', '#e88a3a', '#b8d36a'];
    if (model === 0) {
      k.cyl(0.15, 0.08, 0.07, 0, 0, 0, bowl, { rough: 0.4 }, 28);
      for (let i = 0; i < 5; i++) k.ell(0.04, 0.04, 0.04, Math.cos(i * 1.26) * 0.07, 0.09, Math.sin(i * 1.26) * 0.07, rng.pick(fruit), { rough: 0.6 });
      k.ell(0.04, 0.04, 0.04, 0.0, 0.11, 0.0, rng.pick(fruit), { rough: 0.6 });
    } else {
      // Corbeille plate en bois.
      k.cyl(0.15, 0.12, 0.05, 0, 0, 0, bowl, { rough: 0.7 }, 28);
      for (let i = 0; i < 7; i++) k.ell(0.032, 0.03, 0.032, Math.cos(i * 0.9) * 0.085, 0.06, Math.sin(i * 0.9) * 0.085, rng.pick(fruit), { rough: 0.6 });
      k.ell(0.045, 0.04, 0.045, 0, 0.11, 0, rng.pick(fruit), { rough: 0.6 });
    }
    return k.root;
  };
}

function candles(model) {
  return (ctx) => {
    const { k, rng, p } = setup(ctx);
    const wax = rng.pick(['#f4f1ea', p.fabricLight, p.accent]);
    const flame = { emissive: '#ffb347', emissiveIntensity: 1.2 };
    k.box(0.2, 0.012, 0.1, 0, 0, 0, model === 0 ? p.metal : p.woodDark, METAL);
    if (model === 0) {
      // Trois bougies de hauteurs différentes sur un plateau.
      [[-0.06, 0.15, -0.015], [0.0, 0.09, 0.02], [0.06, 0.12, -0.015]].forEach(([x, h, z]) => {
        k.cyl(0.017, 0.017, h - 0.03, x, 0.012, z, wax, { rough: 0.6 }, 12);
        k.ell(0.006, 0.012, 0.006, x, h - 0.006, z, '#ffcf70', flame);
      });
    } else {
      // Deux photophores en verre.
      for (const [x, h] of [[-0.06, 0.1], [0.06, 0.15]]) {
        k.cyl(0.04, 0.04, h - 0.012, x, 0.012, 0, '#cfe3e8', { opacity: 0.35, rough: 0.05 }, 20);
        k.cyl(0.015, 0.015, 0.04, x, 0.012, 0, wax, { rough: 0.6 }, 10);
        k.ell(0.006, 0.012, 0.006, x, 0.07, 0, '#ffcf70', flame);
      }
    }
    return k.root;
  };
}

/* ------------------------------------------------------------------ */
/* Données                                                             */
/* ------------------------------------------------------------------ */

const WALL_DECOR_ROOMS = [rt('living', 1), rt('bedroom', 1), rt('entrance', 1), rt('hallway', 1), rt('office', 1)];

export const HOME_DATA = Object.freeze([
  // Entrée
  { id: 'shoe-cabinet', label: 'Meuble à chaussures', category: 'entree', roomTypes: [rt('entrance', 3), rt('hallway', 1), rt('dressing', 1.5)], size: { w: 0.8, d: 0.3, h: 1.1 }, placement: place('wall', 0.5, 0.05) },
  { id: 'wall-hooks', label: 'Patère murale', category: 'entree', roomTypes: [rt('entrance', 3), rt('hallway', 1), rt('kidsroom', 1), rt('laundry', 0.5)], size: { w: 0.6, d: 0.08, h: 0.15 }, placement: place('wall-mounted', 0, 0, [], { mountHeight: 1.6 }) },
  { id: 'umbrella-stand', label: 'Porte-parapluie', category: 'entree', roomTypes: [rt('entrance', 2), rt('hallway', 0.5)], size: { w: 0.2, d: 0.2, h: 0.6 }, placement: place('corner', 0.2, 0.05) },
  { id: 'bookcase-narrow', label: 'Bibliothèque étroite', category: 'salon', roomTypes: [rt('hallway', 1.5), rt('living', 0.6), rt('office', 1), rt('kidsroom', 1), rt('bedroom', 0.3), rt('workshop', 0.5)], size: { w: 0.6, d: 0.25, h: 1.9 }, placement: place('wall', 0.5, 0.05) },
  { id: 'wall-shelf', label: 'Étagère murale', category: 'decoration', roomTypes: [rt('living', 1), rt('entrance', 1), rt('hallway', 1), rt('kitchen', 0.6), rt('office', 1.5), rt('bedroom', 1), rt('kidsroom', 1.5), rt('bathroom', 0.5), rt('toilet', 1.5), rt('pantry', 2), rt('workshop', 1), rt('dressing', 0.5), rt('other', 1)], size: { w: 0.9, d: 0.25, h: 0.22 }, placement: place('wall-mounted', 0, 0, [], { mountHeight: 1.4 }) },
  // Salle à manger
  { id: 'display-cabinet', label: 'Vitrine', category: 'salle-a-manger', roomTypes: [rt('dining', 2), rt('living', 1)], size: { w: 1.0, d: 0.45, h: 1.9 }, placement: place('wall', 0.7, 0.05) },
  { id: 'sideboard-small', label: 'Desserte', category: 'salle-a-manger', roomTypes: [rt('dining', 1.5), rt('kitchen', 0.5), rt('living', 0.5)], size: { w: 0.8, d: 0.4, h: 0.85 }, placement: place('wall', 0.6, 0.05, [...SURFACE_DECOR, ...TABLE_DECOR]) },
  { id: 'dining-table-round', label: 'Table ronde + 4 chaises', category: 'salle-a-manger', roomTypes: [rt('dining', 2), rt('kitchen', 0.6), rt('living', 0.3)], size: { w: 1.4, d: 1.4, h: 0.9 }, placement: place('free', 0.3, 0.3, [...RUGS, ...TABLE_DECOR]) },
  { id: 'chair', label: 'Chaise', category: 'salle-a-manger', roomTypes: [rt('dining', 0.8), rt('kitchen', 0.5), rt('office', 0.5), rt('bedroom', 0.3), rt('kidsroom', 0.5), rt('hallway', 0.3)], size: { w: 0.42, d: 0.42, h: 0.9 }, placement: place('free', 0.3, 0.1) },
  // Salon
  { id: 'sofa-corner', label: 'Canapé d\'angle', category: 'salon', roomTypes: [rt('living', 1.5)], size: { w: 2.6, d: 1.7, h: 0.85 }, placement: place('wall', 0.8, 0.1, RUGS) },
  { id: 'sofa-bed', label: 'Canapé-lit', category: 'salon', roomTypes: [rt('other', 1), rt('office', 1), rt('living', 0.3), rt('workshop', 0.2)], size: { w: 1.9, d: 0.9, h: 0.85 }, placement: place('wall', 0.8, 0.1, RUGS) },
  { id: 'side-table', label: 'Bout de canapé', category: 'salon', roomTypes: [rt('living', 2), rt('bedroom', 0.6), rt('hallway', 0.3), rt('other', 0.5)], size: { w: 0.45, d: 0.45, h: 0.5 }, placement: place('wall', 0.2, 0.05, [...SURFACE_DECOR, ...TABLE_DECOR]) },
  { id: 'sideboard', label: 'Enfilade', category: 'salon', roomTypes: [rt('living', 1.5), rt('dining', 1.5), rt('hallway', 0.5), rt('entrance', 0.4)], size: { w: 1.8, d: 0.4, h: 0.7 }, placement: place('wall', 0.7, 0.05, [...SURFACE_DECOR, ...TABLE_DECOR]) },
  { id: 'pouf', label: 'Pouf', category: 'salon', roomTypes: [rt('living', 1.5), rt('kidsroom', 1.5), rt('bedroom', 0.5), rt('dressing', 0.8), rt('other', 0.5)], size: { w: 0.5, d: 0.5, h: 0.4 }, placement: place('free', 0.1, 0.05, []) },
  { id: 'stove', label: 'Poêle', category: 'salon', roomTypes: [rt('living', 0.6), rt('workshop', 0.4)], size: { w: 0.5, d: 0.45, h: 1.1 }, placement: place('corner', 0.8, 0.2) },
  { id: 'blanket-basket', label: 'Panier à plaids', category: 'salon', roomTypes: [rt('living', 1.5), rt('bedroom', 0.8), rt('kidsroom', 0.5), rt('other', 0.3)], size: { w: 0.45, d: 0.45, h: 0.4 }, placement: place('corner', 0.2, 0.05) },
  // Chambre
  { id: 'bed-king', label: 'Lit 180', category: 'chambre', roomTypes: [rt('bedroom', 1.5)], size: { w: 1.95, d: 2.1, h: 1.0 }, placement: place('wall', 0.7, 0.55, [...RUGS]) },
  { id: 'dressing-table', label: 'Coiffeuse', category: 'chambre', roomTypes: [rt('bedroom', 1), rt('dressing', 1.2)], size: { w: 1.0, d: 0.45, h: 1.5 }, placement: place('wall', 0.7, 0.05, ['table-lamp']) },
  { id: 'bed-bench', label: 'Banc de lit', category: 'chambre', roomTypes: [rt('bedroom', 1), rt('dressing', 0.6)], size: { w: 1.2, d: 0.4, h: 0.45 }, placement: place('free', 0.2, 0.1, []) },
  { id: 'open-wardrobe', label: 'Penderie ouverte', category: 'chambre', roomTypes: [rt('dressing', 3), rt('bedroom', 1), rt('entrance', 0.3), rt('kidsroom', 0.5)], size: { w: 1.0, d: 0.5, h: 1.9 }, placement: place('wall', 0.7, 0.05) },
  { id: 'chest-drawers', label: 'Chiffonnier', category: 'chambre', roomTypes: [rt('bedroom', 1.5), rt('kidsroom', 1.5), rt('dressing', 1.5), rt('hallway', 0.4)], size: { w: 0.8, d: 0.45, h: 1.1 }, placement: place('wall', 0.7, 0.05, SURFACE_DECOR) },
  { id: 'standing-mirror', label: 'Miroir sur pied', category: 'chambre', roomTypes: [rt('bedroom', 1.5), rt('dressing', 2.5), rt('entrance', 1), rt('kidsroom', 0.5), rt('hallway', 0.4)], size: { w: 0.5, d: 0.08, h: 1.7 }, placement: place('wall', 0.5, 0.05) },
  { id: 'wardrobe-3', label: 'Grande armoire', category: 'chambre', roomTypes: [rt('bedroom', 1.5), rt('dressing', 3), rt('kidsroom', 0.3)], size: { w: 1.8, d: 0.6, h: 2.1 }, placement: place('wall', 0.8, 0.05) },
  // Chambre d'enfant
  { id: 'bunk-bed', label: 'Lits superposés', category: 'enfant', roomTypes: [rt('kidsroom', 3), rt('bedroom', 0.1)], size: { w: 1.0, d: 2.1, h: 1.7 }, placement: place('wall', 0.7, 0.5, []) },
  { id: 'baby-bed', label: 'Lit bébé', category: 'enfant', roomTypes: [rt('kidsroom', 1), rt('bedroom', 0.2)], size: { w: 0.7, d: 1.25, h: 0.95 }, placement: place('wall', 0.6, 0.4, []) },
  { id: 'toy-box', label: 'Coffre à jouets', category: 'enfant', roomTypes: [rt('kidsroom', 3)], size: { w: 0.6, d: 0.4, h: 0.4 }, placement: place('wall', 0.4, 0.05, []) },
  { id: 'kids-desk', label: 'Bureau d\'enfant', category: 'enfant', roomTypes: [rt('kidsroom', 2.5)], size: { w: 0.9, d: 0.5, h: 0.7 }, placement: place('wall', 0.8, 0.1, ['office-chair', 'chair', 'table-lamp']) },
  { id: 'teepee', label: 'Tipi', category: 'enfant', roomTypes: [rt('kidsroom', 1.5)], size: { w: 0.8, d: 0.8, h: 1.1 }, placement: place('corner', 0.3, 0.1) },
  { id: 'shelf-low', label: 'Étagère basse', category: 'enfant', roomTypes: [rt('kidsroom', 2), rt('living', 0.8), rt('office', 0.8), rt('hallway', 0.4)], size: { w: 0.8, d: 0.3, h: 0.8 }, placement: place('wall', 0.5, 0.05, SURFACE_DECOR) },
  // Cuisine
  { id: 'dishwasher', label: 'Lave-vaisselle', category: 'cuisine', roomTypes: [rt('kitchen', 2)], size: { w: 0.6, d: 0.6, h: 0.85 }, placement: place('wall', 0.9, 0) },
  { id: 'oven-column', label: 'Colonne four', category: 'cuisine', roomTypes: [rt('kitchen', 1.5)], size: { w: 0.6, d: 0.6, h: 2.1 }, placement: place('wall', 0.9, 0) },
  { id: 'microwave', label: 'Micro-ondes', category: 'cuisine', roomTypes: [rt('kitchen', 2)], size: { w: 0.45, d: 0.35, h: 0.28 }, placement: place('free', 0, 0) },
  { id: 'trash-bin', label: 'Poubelle', category: 'cuisine', roomTypes: [rt('kitchen', 2), rt('office', 0.3), rt('bathroom', 0.4), rt('workshop', 0.5), rt('garage', 0.5)], size: { w: 0.35, d: 0.35, h: 0.65 }, placement: place('wall', 0.3, 0.05) },
  { id: 'fridge-american', label: 'Réfrigérateur américain', category: 'cuisine', roomTypes: [rt('kitchen', 1)], size: { w: 0.9, d: 0.7, h: 1.78 }, placement: place('wall', 0.9, 0) },
  { id: 'kitchen-table-2', label: 'Petite table + 2 chaises', category: 'cuisine', roomTypes: [rt('kitchen', 1), rt('dining', 0.3), rt('other', 0.3)], size: { w: 0.7, d: 1.3, h: 0.9 }, placement: place('free', 0.3, 0.3, [...TABLE_DECOR]) },
  // Salle de bain · WC
  { id: 'vanity-double', label: 'Double vasque + miroir', category: 'salle-de-bain', roomTypes: [rt('bathroom', 1)], size: { w: 1.4, d: 0.5, h: 1.9 }, placement: place('wall', 0.7, 0.05) },
  { id: 'column-cabinet', label: 'Colonne de rangement', category: 'salle-de-bain', roomTypes: [rt('bathroom', 2), rt('toilet', 0.3), rt('laundry', 0.6)], size: { w: 0.35, d: 0.3, h: 1.6 }, placement: place('wall', 0.5, 0.05) },
  { id: 'towel-radiator', label: 'Sèche-serviettes', category: 'salle-de-bain', roomTypes: [rt('bathroom', 2.5), rt('toilet', 0.5)], size: { w: 0.5, d: 0.1, h: 1.2 }, placement: place('wall-mounted', 0, 0, [], { mountHeight: 0.4 }) },
  { id: 'laundry-basket', label: 'Panier à linge', category: 'salle-de-bain', roomTypes: [rt('bathroom', 2), rt('laundry', 3), rt('dressing', 1.5), rt('bedroom', 0.3), rt('kidsroom', 0.5)], size: { w: 0.4, d: 0.3, h: 0.55 }, placement: place('wall', 0.3, 0.05) },
  { id: 'wc-cabinet', label: 'Meuble haut WC', category: 'salle-de-bain', roomTypes: [rt('toilet', 3), rt('bathroom', 0.5)], size: { w: 0.4, d: 0.2, h: 0.6 }, placement: place('wall-mounted', 0, 0, [], { mountHeight: 1.4 }) },
  { id: 'toilet-brush', label: 'Brosse WC', category: 'salle-de-bain', roomTypes: [rt('toilet', 2), rt('bathroom', 0.3)], size: { w: 0.12, d: 0.12, h: 0.4 }, placement: place('corner', 0, 0) },
  // Buanderie
  { id: 'dryer', label: 'Sèche-linge', category: 'buanderie', roomTypes: [rt('laundry', 3), rt('bathroom', 0.2)], size: { w: 0.6, d: 0.6, h: 0.85 }, placement: place('wall', 0.7, 0) },
  { id: 'utility-sink', label: 'Évier de buanderie', category: 'buanderie', roomTypes: [rt('laundry', 2), rt('garage', 1.5), rt('workshop', 1.5), rt('pantry', 0.3)], size: { w: 0.6, d: 0.5, h: 0.9 }, placement: place('wall', 0.7, 0.05) },
  { id: 'drying-rack', label: 'Étendoir', category: 'buanderie', roomTypes: [rt('laundry', 2), rt('bathroom', 0.2)], size: { w: 1.0, d: 0.6, h: 1.0 }, placement: place('free', 0.3, 0.1) },
  { id: 'broom-cupboard', label: 'Placard à balais', category: 'buanderie', roomTypes: [rt('laundry', 2), rt('pantry', 1.5), rt('garage', 1), rt('kitchen', 0.5), rt('hallway', 0.3), rt('workshop', 0.5)], size: { w: 0.5, d: 0.5, h: 1.9 }, placement: place('wall', 0.7, 0.05) },
  { id: 'water-heater', label: 'Chauffe-eau', category: 'buanderie', roomTypes: [rt('laundry', 1), rt('garage', 1.5), rt('pantry', 1.5), rt('workshop', 0.3), rt('bathroom', 0.2)], size: { w: 0.5, d: 0.5, h: 1.6 }, placement: place('corner', 0.5, 0.05) },
  // Bureau
  { id: 'desk-large', label: 'Grand bureau', category: 'bureau', roomTypes: [rt('office', 2.5), rt('workshop', 0.3)], size: { w: 1.6, d: 0.7, h: 0.75 }, placement: place('wall', 0.9, 0.1, ['office-chair', 'chair', 'table-lamp', 'plant-small', 'computer', 'books', 'candles', 'vase']) },
  { id: 'drawer-unit', label: 'Caisson à tiroirs', category: 'bureau', roomTypes: [rt('office', 1.5), rt('kidsroom', 0.4), rt('workshop', 0.5)], size: { w: 0.4, d: 0.5, h: 0.6 }, placement: place('wall', 0.5, 0.05, SURFACE_DECOR) },
  { id: 'filing-cabinet', label: 'Classeur', category: 'bureau', roomTypes: [rt('office', 1.5), rt('workshop', 0.5), rt('garage', 0.3)], size: { w: 0.45, d: 0.6, h: 1.3 }, placement: place('wall', 0.6, 0.05) },
  { id: 'computer', label: 'Ordinateur', category: 'bureau', roomTypes: [rt('office', 3), rt('bedroom', 0.3), rt('kidsroom', 0.5), rt('workshop', 0.3)], size: { w: 0.6, d: 0.4, h: 0.45 }, placement: place('free', 0, 0) },
  { id: 'board', label: 'Tableau d\'affichage', category: 'bureau', roomTypes: [rt('office', 2), rt('kidsroom', 1.5), rt('workshop', 1.5), rt('kitchen', 0.3), rt('hallway', 0.3)], size: { w: 1.0, d: 0.03, h: 0.7 }, placement: place('wall-mounted', 0, 0, [], { mountHeight: 1.2 }) },
  // Éclairage, chauffage, décoration
  { id: 'radiator', label: 'Radiateur', category: 'eclairage', roomTypes: [rt('living', 2), rt('bedroom', 2), rt('dining', 2), rt('office', 2), rt('kidsroom', 2), rt('kitchen', 1), rt('bathroom', 0.5), rt('dressing', 0.5), rt('hallway', 0.7), rt('entrance', 0.7), rt('workshop', 0.5)], size: { w: 0.8, d: 0.1, h: 0.6 }, placement: place('wall-mounted', 0, 0, [], { mountHeight: 0.15 }) },
  { id: 'wall-sconce', label: 'Applique murale', category: 'eclairage', roomTypes: [rt('living', 1), rt('bedroom', 1.5), rt('hallway', 2), rt('entrance', 1), rt('dining', 1), rt('bathroom', 1), rt('toilet', 1), rt('dressing', 0.5)], size: { w: 0.15, d: 0.15, h: 0.25 }, placement: place('wall-mounted', 0, 0, [], { mountHeight: 1.6 }) },
  { id: 'pendant-light', label: 'Suspension', category: 'eclairage', roomTypes: [rt('dining', 2), rt('kitchen', 1.5), rt('living', 0.5), rt('office', 0.5), rt('kidsroom', 0.5)], size: { w: 0.5, d: 0.5, h: 0.8 }, placement: place('ceiling', 0, 0) },
  { id: 'blinds', label: 'Store vénitien', category: 'eclairage', roomTypes: [rt('kitchen', 2), rt('bathroom', 1.5), rt('office', 2), rt('bedroom', 0.5), rt('kidsroom', 0.8), rt('toilet', 1), rt('workshop', 1), rt('laundry', 1), rt('garage', 0.5), rt('pantry', 0.5), rt('dressing', 0.5)], size: { w: 1.2, d: 0.08, h: 1.5 }, placement: place('window', 0, 0, [], { mountHeight: 0.75 }) },
  { id: 'wall-clock', label: 'Horloge murale', category: 'decoration', roomTypes: [rt('kitchen', 2), rt('living', 1), rt('entrance', 1.5), rt('office', 1.5), rt('hallway', 1), rt('workshop', 1), rt('garage', 1), rt('kidsroom', 0.5)], size: { w: 0.3, d: 0.055, h: 0.3 }, placement: place('wall-mounted', 0, 0, [], { mountHeight: 1.9 }) },
  { id: 'mirror-round', label: 'Miroir rond', category: 'decoration', roomTypes: [rt('entrance', 2), rt('hallway', 1.5), rt('bedroom', 1), rt('living', 1), rt('dressing', 1.5), rt('bathroom', 0.5), rt('toilet', 1)], size: { w: 0.6, d: 0.04, h: 0.6 }, placement: place('wall-mounted', 0, 0, [], { mountHeight: 1.1 }) },
  { id: 'books', label: 'Livres', category: 'decoration', roomTypes: [rt('living', 1.5), rt('office', 1.5), rt('bedroom', 1), rt('kidsroom', 0.8), rt('entrance', 0.5), rt('dining', 0.5)], size: { w: 0.25, d: 0.18, h: 0.15 }, placement: place('free', 0, 0) },
  { id: 'vase', label: 'Vase', category: 'decoration', roomTypes: [rt('living', 1.5), rt('dining', 1.5), rt('entrance', 1.5), rt('hallway', 1), rt('bedroom', 1), rt('kitchen', 0.6), rt('bathroom', 0.4)], size: { w: 0.15, d: 0.15, h: 0.35 }, placement: place('free', 0, 0) },
  { id: 'fruit-bowl', label: 'Coupe de fruits', category: 'decoration', roomTypes: [rt('kitchen', 2), rt('dining', 2), rt('living', 0.4)], size: { w: 0.3, d: 0.3, h: 0.15 }, placement: place('free', 0, 0) },
  { id: 'candles', label: 'Bougies', category: 'decoration', roomTypes: [rt('living', 1.5), rt('dining', 1.5), rt('bedroom', 1), rt('bathroom', 1), rt('entrance', 0.6)], size: { w: 0.2, d: 0.1, h: 0.15 }, placement: place('free', 0, 0) },
]);

export const HOME_BUILDERS = Object.freeze({
  'shoe-cabinet': withModels([shoeCabinetClosed, shoeCabinetOpen]),
  'wall-hooks': wallHooks,
  'umbrella-stand': umbrellaStand,
  'bookcase-narrow': withModels([bookcaseNarrow(0), bookcaseNarrow(1)]),
  'wall-shelf': withModels([wallShelf(0), wallShelf(1), wallShelf(2)]),
  'display-cabinet': withModels([displayCabinet(0), displayCabinet(1)]),
  'sideboard-small': withModels([sideboardSmall(0), sideboardSmall(1)]),
  'dining-table-round': withModels([roundTable(0), roundTable(1)]),
  chair: withModels([chairModel(0), chairModel(1), chairModel(2)]),
  'sofa-corner': cornerSofa,
  'side-table': withModels([sideTable(0), sideTable(1), sideTable(2)]),
  sideboard: withModels([sideboardLong(0), sideboardLong(1)]),
  pouf: withModels([pouf(0), pouf(1)]),
  stove,
  'blanket-basket': blanketBasket,
  'bed-king': bedFrame({ w: 1.95, headH: 1.0, pillows: 2 }),
  'dressing-table': dressingTable,
  'bed-bench': withModels([bedBench(0), bedBench(1)]),
  'open-wardrobe': openWardrobe,
  'chest-drawers': chestDrawers,
  'standing-mirror': standingMirror,
  'wardrobe-3': wardrobe3,
  'bunk-bed': bunkBed,
  'baby-bed': babyBed,
  'toy-box': toyBox,
  'kids-desk': kidsDesk,
  teepee,
  'shelf-low': shelfLow,
  dishwasher,
  'oven-column': ovenColumn,
  microwave,
  'trash-bin': withModels([trashBin(0), trashBin(1)]),
  'fridge-american': fridgeAmerican,
  'kitchen-table-2': kitchenTable2,
  'vanity-double': doubleVanity,
  'column-cabinet': withModels([columnCabinet(0), columnCabinet(1)]),
  'towel-radiator': towelRadiator,
  'laundry-basket': withModels([laundryBasket(0), laundryBasket(1)]),
  'wc-cabinet': withModels([wcCabinet(0), wcCabinet(1)]),
  'toilet-brush': toiletBrush,
  dryer,
  'utility-sink': withModels([utilitySink(0), utilitySink(1)]),
  'drying-rack': dryingRack,
  'broom-cupboard': withModels([broomCupboard(0), broomCupboard(1)]),
  'water-heater': waterHeater,
  'desk-large': deskLarge,
  'drawer-unit': drawerUnit,
  'filing-cabinet': filingCabinet,
  computer: withModels([computer(0), computer(1), computer(2)]),
  board: withModels([boardWall(0), boardWall(1)]),
  radiator,
  'wall-sconce': withModels([wallSconce(0), wallSconce(1)]),
  'pendant-light': withModels([pendantLight(0), pendantLight(1)]),
  blinds,
  'wall-clock': withModels([wallClock(0), wallClock(1)]),
  'mirror-round': mirrorRound,
  books: withModels([booksStack(0), booksStack(1)]),
  vase: withModels([vase(0), vase(1), vase(2)]),
  'fruit-bowl': withModels([fruitBowl(0), fruitBowl(1)]),
  candles: withModels([candles(0), candles(1)]),
});

void WALL_DECOR_ROOMS;
