// furniture-models.js — modèles supplémentaires des objets d'origine : chaque génération en tire un au hasard (withModels).
// Chaque modèle garde la boîte englobante annoncée dans FURNITURE_DATA (largeur, profondeur, hauteur à 5 % près) ; l'avant est +Z.
// Le constructeur d'origine reste le modèle 0 : ALT_MODELS ne liste que les alternatives (id → constructeurs).
import { cabinet, diningChair, makeKit } from './furniture-kit.js';

const fabricOf = (rng, p) => rng.pick([p.fabric, p.fabricLight, p.accent]);

/* ---- Canapés et fauteuils ---- */

/** Canapé scandinave : cadre en bois, pieds fuselés, accoudoirs fins, coussins posés. */
function sofaScandi({ w, d, seats }) {
  return (ctx) => {
    const k = makeKit(ctx);
    const { rng, palette: p } = ctx;
    const wood = rng.pick([p.wood, p.woodDark]);
    const fabric = fabricOf(rng, p);
    const soft = k.mix(fabric, '#ffffff', 0.08);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(0.022, 0.016, 0.2, sx * (w / 2 - 0.07), 0, sz * (d / 2 - 0.07), wood, undefined, 12);
    k.box(w, 0.06, d, 0, 0.2, 0, wood);
    for (const sx of [-1, 1]) k.box(0.06, 0.34, d, sx * (w / 2 - 0.03), 0.26, 0, wood);
    k.box(w, 0.04, 0.06, 0, 0.81, -d / 2 + 0.03, wood);
    for (const sx of [-1, 1]) k.box(0.08, 0.04, d, sx * (w / 2 - 0.04), 0.6, 0, wood);
    const inner = w - 0.12;
    const cw = inner / seats;
    for (let i = 0; i < seats; i++) {
      const x = -inner / 2 + (i + 0.5) * cw;
      k.rbox(cw - 0.015, 0.16, d - 0.14, 0.05, x, 0.26, 0.05, soft);
      k.rbox(cw - 0.03, 0.36, 0.12, 0.05, x, 0.42, -d / 2 + 0.12, soft);
    }
    if (rng.chance(0.6)) k.rbox(0.3, 0.3, 0.1, 0.04, rng.chance(0.5) ? -inner / 2 + 0.2 : inner / 2 - 0.2, 0.42, -d / 2 + 0.24, rng.pick([p.accent, p.fabric, p.fabricLight]));
    return k.root;
  };
}

/** Canapé bas et rond, façon bouclé : pas de pieds, gros coussins arrondis. */
function sofaRounded({ w, d, seats }) {
  return (ctx) => {
    const k = makeKit(ctx);
    const { rng, palette: p } = ctx;
    const fabric = fabricOf(rng, p);
    const soft = k.mix(fabric, '#ffffff', 0.12);
    k.box(w - 0.1, 0.06, d - 0.1, 0, 0, 0, '#2a2a2c');
    k.rbox(w, 0.4, d, 0.12, 0, 0.06, 0, fabric, { rough: 1 });
    k.rbox(w, 0.79, 0.3, 0.13, 0, 0.06, -d / 2 + 0.15, fabric, { rough: 1 });
    for (const sx of [-1, 1]) k.rbox(0.2, 0.56, d - 0.12, 0.09, sx * (w / 2 - 0.1), 0.06, 0.06, fabric, { rough: 1 });
    const inner = w - 0.4;
    const cw = inner / seats;
    for (let i = 0; i < seats; i++) k.rbox(cw - 0.03, 0.14, d - 0.34, 0.07, -inner / 2 + (i + 0.5) * cw, 0.46, 0.1, soft, { rough: 1 });
    return k.root;
  };
}

/** Fauteuil au cadre de bois : pieds, assise, dossier à traverse haute. */
function armchairWood(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const wood = rng.pick([p.wood, p.woodDark]);
  const fabric = fabricOf(rng, p);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(0.02, 0.015, 0.22, sx * 0.34, 0, sz * 0.38, wood, undefined, 12);
  k.box(0.8, 0.05, 0.85, 0, 0.22, 0, wood);
  for (const sx of [-1, 1]) k.box(0.05, 0.3, 0.85, sx * 0.375, 0.27, 0, wood);
  for (const sx of [-1, 1]) k.box(0.07, 0.04, 0.7, sx * 0.375, 0.57, 0.07, wood);
  k.box(0.8, 0.04, 0.06, 0, 0.81, -0.395, wood);
  k.rbox(0.68, 0.14, 0.72, 0.05, 0, 0.27, 0.05, fabric);
  k.rbox(0.68, 0.42, 0.12, 0.05, 0, 0.38, -0.33, fabric);
  return k.root;
}

/** Fauteuil crapaud : bas, rembourré, accoudoirs enveloppants. */
function armchairBarrel(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const fabric = fabricOf(rng, p);
  const soft = k.mix(fabric, '#ffffff', 0.12);
  k.box(0.7, 0.05, 0.75, 0, 0, 0, p.woodDark);
  k.rbox(0.8, 0.38, 0.85, 0.12, 0, 0.05, 0, fabric, { rough: 1 });
  k.rbox(0.8, 0.8, 0.26, 0.13, 0, 0.05, -0.295, fabric, { rough: 1 });
  for (const sx of [-1, 1]) k.rbox(0.16, 0.52, 0.72, 0.08, sx * 0.32, 0.05, 0.065, fabric, { rough: 1 });
  k.rbox(0.46, 0.13, 0.6, 0.06, 0, 0.43, 0.1, soft, { rough: 1 });
  return k.root;
}

/* ---- Tables basses, meubles TV, rangements du salon ---- */

function coffeeTableOval(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const wood = rng.pick([p.wood, p.woodDark]);
  const leg = rng.pick([wood, p.metal]);
  const top = k.cyl(0.5, 0.5, 0.04, 0, 0.36, 0, wood, undefined, 32);
  top.scale.z = 0.55;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(0.02, 0.016, 0.36, sx * 0.3, 0, sz * 0.14, leg, undefined, 12);
  k.box(0.5, 0.015, 0.2, 0, 0.12, 0, k.mix(wood, '#000000', 0.12));
  return k.root;
}

function coffeeTableNest(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const wood = rng.pick([p.wood, p.woodDark]);
  const accent = rng.pick([p.accent, p.fabricLight, p.metal]);
  k.rbox(1.0, 0.04, 0.55, 0.012, 0, 0.36, 0, wood);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.035, 0.36, 0.035, sx * 0.46, 0, sz * 0.24, wood);
  k.rbox(0.5, 0.035, 0.36, 0.01, 0.2, 0.24, 0.02, accent);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.025, 0.24, 0.025, 0.2 + sx * 0.22, 0, 0.02 + sz * 0.15, accent);
  return k.root;
}

function coffeeTableChest(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const wood = rng.pick([p.woodDark, p.wood]);
  k.rbox(1.0, 0.4, 0.55, 0.025, 0, 0, 0, wood);
  k.box(1.004, 0.012, 0.554, 0, 0.24, 0, k.mix(wood, '#000000', 0.25));
  for (const sx of [-1, 1]) k.box(0.03, 0.4, 0.556, sx * 0.485, 0, 0, p.metal, { metal: 0.6, rough: 0.5 });
  k.box(0.1, 0.03, 0.02, 0, 0.2, 0.278, p.metal, { metal: 0.7, rough: 0.4 });
  return k.root;
}

function tvUnitNiches(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const body = rng.pick([p.wood, p.woodDark, p.fabricLight]);
  const dark = k.mix(body, '#000000', 0.15);
  const leg = rng.range(0.1, 0.14);
  const legColor = rng.pick([p.metal, p.woodDark]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(0.02, 0.015, leg, sx * 0.76, 0, sz * 0.16, legColor, undefined, 12);
  k.box(1.6, 0.03, 0.4, 0, leg, 0, body);
  k.box(1.6, 0.03, 0.4, 0, 0.42, 0, body);
  for (const x of [-0.785, -0.265, 0.265, 0.785]) k.box(0.03, 0.27 - 0.03, 0.4, x, leg + 0.03, 0, body);
  k.box(1.54, 0.27 - 0.03, 0.01, 0, leg + 0.03, -0.195, dark);
  for (const sx of [-1, 1]) k.box(0.48, 0.42 - leg - 0.05, 0.012, sx * 0.525, leg + 0.04, 0.2, k.mix(body, '#ffffff', 0.08));
  k.rbox(0.3, 0.08, 0.2, 0.02, 0, leg + 0.03, 0, rng.pick([p.accent, p.fabric]));
  k.box(0.35, 0.02, 0.18, 0, 0.45, 0, '#1c1c1e');
  k.box(1.0, 0.52, 0.035, 0, 0.48, 0, '#111214');
  k.box(0.96, 0.48, 0.005, 0, 0.5, 0.015, '#0c1822', { emissive: '#1a3a52', emissiveIntensity: 0.5, rough: 0.2 });
  return k.root;
}

function bookcaseCubes(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const wood = rng.pick([p.wood, p.woodDark, p.fabricLight]);
  const bins = [p.accent, p.fabric, p.fabricLight, p.plant, p.woodDark];
  for (const sx of [-1, 1]) k.box(0.03, 1.9, 0.32, sx * 0.435, 0, 0, wood);
  k.box(0.84, 0.06, 0.3, 0, 0, 0, wood);
  k.box(0.84, 1.84, 0.01, 0, 0.06, -0.155, k.mix(wood, '#000000', 0.15));
  k.box(0.03, 1.78, 0.3, -0.135, 0.06, 0, wood);
  k.box(0.03, 1.78, 0.3, 0.165, 0.06, 0, wood);
  const rows = 5;
  const gap = 1.78 / rows;
  for (let i = 1; i <= rows; i++) k.box(0.84, 0.03, 0.32, 0, 0.06 + i * gap - 0.03, 0, wood);
  for (let r = 0; r < rows; r++) {
    for (const x of [-0.285, 0.015, 0.315]) {
      if (!rng.chance(0.55)) continue;
      k.rbox(0.22, gap - 0.1, 0.24, 0.015, x - 0.015 + 0.015, 0.06 + r * gap + 0.01, 0.03, rng.pick(bins));
    }
  }
  return k.root;
}

function bookcaseClosedBase(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const wood = rng.pick([p.wood, p.woodDark]);
  for (const sx of [-1, 1]) k.box(0.03, 1.9, 0.32, sx * 0.435, 0, 0, wood);
  k.box(0.9, 0.03, 0.32, 0, 1.87, 0, wood);
  k.box(0.84, 0.7, 0.3, 0, 0, 0, wood);
  for (const sx of [-1, 1]) {
    k.box(0.4, 0.66, 0.012, sx * 0.21, 0.02, 0.156, k.mix(wood, '#000000', 0.1));
    k.box(0.015, 0.1, 0.02, sx * 0.04, 0.35, 0.165, p.metal);
  }
  k.box(0.84, 1.17, 0.01, 0, 0.7, -0.155, k.mix(wood, '#000000', 0.15));
  const bookColors = [p.accent, p.fabric, p.fabricLight, p.woodDark, p.plant];
  const shelves = 4;
  const gap = 1.17 / shelves;
  for (let i = 0; i < shelves; i++) {
    const y = 0.7 + i * gap;
    k.box(0.84, 0.025, 0.3, 0, y, 0, wood);
    if (rng.chance(0.8)) {
      let x = -0.4;
      for (let b = rng.int(3, 7); b > 0 && x < 0.36; b--) {
        const bw = rng.range(0.025, 0.05);
        k.box(bw, rng.range(0.16, gap - 0.06), 0.2, x + bw / 2, y + 0.025, 0.02, rng.pick(bookColors));
        x += bw + 0.004;
      }
    }
  }
  return k.root;
}

function consoleDrawers(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const body = rng.pick([p.wood, p.woodDark, p.fabricLight]);
  cabinet(k, { w: 1.1, d: 0.35, h: 0.8, leg: 0.3, body, front: k.mix(body, '#000000', 0.1), drawers: 2, handle: p.metal, legColor: rng.pick([p.metal, p.woodDark]), topT: 0.04 });
  return k.root;
}

function consoleMetal(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const top = rng.pick([p.woodDark, p.ceramic, p.wood]);
  k.box(1.1, 0.04, 0.35, 0, 0.76, 0, top);
  for (const sx of [-1, 1]) {
    k.box(0.025, 0.76, 0.025, sx * 0.53, 0, -0.15, p.metal, { metal: 0.6 });
    k.box(0.025, 0.76, 0.025, sx * 0.53, 0, 0.15, p.metal, { metal: 0.6 });
    k.box(0.025, 0.025, 0.3, sx * 0.53, 0.3, 0, p.metal, { metal: 0.6 });
  }
  k.box(1.06, 0.02, 0.3, 0, 0.3, 0, top);
  return k.root;
}

function floorLampTripod(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const shade = rng.pick([p.fabricLight, p.accent, p.wall]);
  const wood = rng.pick([p.wood, p.woodDark]);
  for (const [dx, dz] of [[0.17, 0], [-0.085, 0.147], [-0.085, -0.147]]) k.tube([dx, 0.01, dz], [dx * 0.12, 1.35, dz * 0.12], 0.013, wood, undefined, 10);
  k.cyl(0.2, 0.2, 0.25, 0, 1.35, 0, shade, { emissive: shade, emissiveIntensity: 0.35, rough: 0.9 }, 24);
  k.ell(0.05, 0.05, 0.05, 0, 1.4, 0, '#fff4d6', { emissive: '#ffd98a', emissiveIntensity: 1 });
  k.cyl(0.2, 0.2, 0.004, 0, 0, 0, k.mix(wood, '#000000', 0.2), undefined, 24); // socle plat : étale la boîte de 0,40 m
  return k.root;
}

function floorLampLantern(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const shade = rng.pick([p.fabricLight, p.wall, '#f4f1ea']);
  k.cyl(0.2, 0.2, 0.03, 0, 0, 0, p.metal, { metal: 0.6, rough: 0.4 }, 24);
  k.cyl(0.012, 0.012, 1.2, 0, 0.03, 0, p.metal, { metal: 0.6, rough: 0.4 }, 12);
  k.ell(0.2, 0.2, 0.2, 0, 1.4, 0, shade, { emissive: shade, emissiveIntensity: 0.55, rough: 0.9 });
  return k.root;
}

/* ---- Salle à manger ---- */

/** Table à piétement (tréteaux ou pied central) et chaises : mêmes encombrements que l'original (chaises comprises). */
function diningTableAlt({ ends, style }) {
  return (ctx) => {
    const k = makeKit(ctx);
    const { rng, palette: p } = ctx;
    const tableW = ends ? 1.8 : 1.4;
    const tableD = 0.8;
    const wood = rng.pick([p.wood, p.woodDark]);
    const topT = 0.04;
    k.rbox(tableW, topT, tableD, 0.012, 0, 0.75 - topT, 0, wood);
    const base = rng.pick([wood, p.metal, p.woodDark]);
    if (style === 'trestle') {
      for (const sx of [-1, 1]) {
        k.box(0.05, 0.71, tableD - 0.2, sx * (tableW / 2 - 0.2), 0, 0, base);
        k.box(0.05, 0.05, tableD - 0.1, sx * (tableW / 2 - 0.2), 0, 0, base);
      }
      k.box(tableW - 0.5, 0.04, 0.05, 0, 0.22, 0, base);
    } else {
      k.box(0.14, 0.71, 0.14, 0, 0, 0, base);
      k.box(0.7, 0.04, 0.5, 0, 0, 0, base);
    }
    const seat = rng.pick([p.fabric, p.fabricLight, p.accent, wood]);
    const colors = { leg: rng.pick([p.metal, p.woodDark, wood]), seat, back: rng.chance(0.5) ? seat : wood };
    for (const x of ends ? [-0.45, 0.45] : [-0.35, 0.35]) {
      diningChair(k.sub(x, tableD / 2 + 0.14, Math.PI), colors);
      diningChair(k.sub(x, -tableD / 2 - 0.14, 0), colors);
    }
    if (ends) {
      diningChair(k.sub(tableW / 2 + 0.14, 0, -Math.PI / 2), colors);
      diningChair(k.sub(-tableW / 2 - 0.14, 0, Math.PI / 2), colors);
    }
    return k.root;
  };
}

function buffetMidCentury(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const body = rng.pick([p.wood, p.woodDark]);
  cabinet(k, { w: 1.6, d: 0.45, h: 0.85, leg: 0.25, body, front: k.mix(body, '#ffffff', 0.06), doors: 4, handle: p.metal, legColor: rng.pick([p.woodDark, p.metal]), topT: 0.04 });
  k.box(0.012, 0.52, 0.016, 0, 0.29, 0.222, k.mix(body, '#000000', 0.3));
  return k.root;
}

/* ---- Chambre ---- */

/** Lit à tête de lit à lattes et sommier en bois. */
function bedSlats({ w, headH }) {
  return (ctx) => {
    const k = makeKit(ctx);
    const { rng, palette: p } = ctx;
    const d = 2.1;
    const wood = rng.pick([p.wood, p.woodDark]);
    const leg = 0.14;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.06, leg, 0.06, sx * (w / 2 - 0.04), 0, sz * (d / 2 - 0.04), wood);
    k.box(w, 0.18, d, 0, leg, 0, wood);
    k.rbox(w - 0.1, 0.22, 1.96, 0.05, 0, leg + 0.18, 0.03, k.mix(p.fabricLight, '#ffffff', 0.5));
    const slats = 7;
    for (let i = 0; i < slats; i++) k.box(0.05, headH - 0.08, 0.04, -w / 2 + 0.05 + (i * (w - 0.1)) / (slats - 1), 0, -d / 2 + 0.03, wood);
    k.box(w, 0.04, 0.06, 0, headH - 0.04, -d / 2 + 0.03, wood);
    k.box(w, 0.06, 0.06, 0, leg + 0.18, -d / 2 + 0.03, wood);
    const blanket = rng.pick([p.fabric, p.accent, p.fabricLight]);
    k.rbox(w - 0.06, 0.05, 1.1, 0.02, 0, leg + 0.4, 0.45, blanket);
    k.rbox(w - 0.2, 0.12, 0.4, 0.05, 0, leg + 0.42, -0.65, rng.pick([p.fabricLight, p.accent, '#f4f1ea']));
    return k.root;
  };
}

/** Lit capitonné sur sommier tapissé, sans pieds. */
function bedUpholstered({ w, headH }) {
  return (ctx) => {
    const k = makeKit(ctx);
    const { rng, palette: p } = ctx;
    const d = 2.1;
    const fabric = rng.pick([p.fabric, p.fabricLight, p.accent]);
    k.box(w - 0.1, 0.08, d - 0.1, 0, 0, 0, '#2a2a2c');
    k.rbox(w, 0.3, d, 0.05, 0, 0.08, 0, fabric, { rough: 1 });
    k.rbox(w - 0.1, 0.22, 1.96, 0.05, 0, 0.38, 0.03, k.mix(p.fabricLight, '#ffffff', 0.5));
    k.rbox(w, headH, 0.12, 0.05, 0, 0, -d / 2 + 0.06, fabric, { rough: 1 });
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) k.cyl(0.015, 0.015, 0.012, -w / 3 + (i * w) / 3, headH * 0.55 + j * 0.2, -d / 2 + 0.121, k.mix(fabric, '#000000', 0.3), undefined, 8).rotation.x = Math.PI / 2;
    const blanket = rng.pick([p.accent, p.fabricLight, p.fabric]);
    k.rbox(w - 0.06, 0.05, 1.2, 0.02, 0, 0.6, 0.42, blanket);
    k.rbox(w - 0.2, 0.12, 0.38, 0.05, 0, 0.62, -0.65, rng.pick([p.fabricLight, '#f4f1ea', p.accent]));
    return k.root;
  };
}

function nightstandOpen(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const wood = rng.pick([p.wood, p.woodDark, p.fabricLight]);
  const leg = rng.pick([wood, p.metal]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.035, 0.47, 0.035, sx * 0.205, 0, sz * 0.18, leg);
  k.box(0.45, 0.03, 0.4, 0, 0.47, 0, wood);
  k.box(0.4, 0.02, 0.36, 0, 0.12, 0, wood);
  k.box(0.4, 0.1, 0.34, 0, 0.3, 0, k.mix(wood, '#000000', 0.08));
  k.box(0.36, 0.07, 0.012, 0, 0.315, 0.177, k.mix(wood, '#ffffff', 0.1));
  k.box(0.1, 0.014, 0.02, 0, 0.345, 0.19, p.metal);
  return k.root;
}

function nightstandRound(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const body = rng.pick([p.wood, p.woodDark, p.fabricLight, p.accent]);
  const top = k.cyl(0.225, 0.225, 0.03, 0, 0.47, 0, body, undefined, 28);
  top.scale.z = 0.4 / 0.45;
  const mid = k.cyl(0.2, 0.2, 0.02, 0, 0.14, 0, body, undefined, 28);
  mid.scale.z = 0.4 / 0.45;
  for (const [x, z] of [[-0.17, 0], [0.17, 0], [0, -0.15], [0, 0.15]]) k.cyl(0.016, 0.016, 0.47, x, 0, z, rng.pick([p.metal, p.woodDark]), undefined, 10);
  return k.root;
}

function wardrobeSliding(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const body = rng.pick([p.wood, p.fabricLight, p.woodDark]);
  const dark = k.mix(body, '#000000', 0.12);
  k.box(1.14, 0.05, 0.54, 0, 0, 0, '#2a2a2c');
  k.box(1.2, 2.05 - 0.04, 0.57, 0, 0.05, -0.015, body);
  k.box(1.2, 0.04, 0.6, 0, 2.06, 0, body);
  k.box(0.598, 1.96, 0.02, -0.3, 0.07, 0.29, rng.chance(0.5) ? '#c9d7dd' : dark, { metal: 0.2, rough: 0.3 });
  k.box(0.598, 1.96, 0.02, 0.3, 0.07, 0.31 - 0.02, k.mix(body, '#ffffff', 0.06));
  k.box(0.012, 0.5, 0.02, -0.03, 1.0, 0.3, p.metal);
  k.box(0.012, 0.5, 0.02, 0.03, 1.0, 0.31, p.metal);
  return k.root;
}

function dresserHigh(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const body = rng.pick([p.wood, p.woodDark]);
  cabinet(k, { w: 1.2, d: 0.45, h: 0.85, leg: 0.25, body, front: k.mix(body, '#ffffff', 0.06), drawers: 3, handle: p.metal, legColor: rng.pick([p.woodDark, p.metal]), topT: 0.04 });
  k.box(0.012, 0.54 - 0.04, 0.016, 0, 0.27, 0.222, k.mix(body, '#000000', 0.3));
  return k.root;
}

/* ---- Bureau ---- */

function deskTrestle(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const wood = rng.pick([p.wood, p.woodDark, p.fabricLight]);
  const leg = rng.pick([p.metal, p.woodDark, wood]);
  k.rbox(1.2, 0.03, 0.6, 0.01, 0, 0.72, 0, wood);
  for (const sx of [-1, 1]) {
    k.box(0.04, 0.72, 0.5, sx * 0.55, 0, 0, leg);
    k.box(0.05, 0.03, 0.58, sx * 0.55, 0, 0, leg);
  }
  k.box(1.06, 0.04, 0.05, 0, 0.5, -0.2, leg);
  k.box(0.46, 0.09, 0.5, 0, 0.62, 0.02, k.mix(wood, '#000000', 0.1));
  k.box(0.4, 0.06, 0.012, 0, 0.635, 0.272, k.mix(wood, '#ffffff', 0.1));
  return k.root;
}

function officeChairMesh(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const fabric = rng.pick(['#2b2d31', p.fabric, p.accent, p.fabricLight]);
  k.box(0.6, 0.03, 0.05, 0, 0.05, 0, '#1c1c1e');
  k.box(0.05, 0.03, 0.6, 0, 0.05, 0, '#1c1c1e');
  for (const [x, z] of [[-0.27, 0], [0.27, 0], [0, -0.27], [0, 0.27]]) k.cyl(0.03, 0.03, 0.05, x, 0, z, '#1c1c1e', undefined, 12);
  k.cyl(0.03, 0.03, 0.34, 0, 0.08, 0, p.metal, { metal: 0.6 }, 12);
  k.rbox(0.5, 0.07, 0.5, 0.03, 0, 0.42, 0.02, fabric);
  k.box(0.04, 0.02, 0.04, 0, 0.5, -0.18, '#1c1c1e');
  k.rbox(0.44, 0.55, 0.05, 0.025, 0, 0.45, -0.22, fabric);
  k.box(0.06, 0.04, 0.05, 0, 0.96, -0.22, '#1c1c1e');
  for (const sx of [-1, 1]) k.box(0.03, 0.2, 0.03, sx * 0.265, 0.5, -0.03, '#1c1c1e');
  return k.root;
}

function shelfUnitCubes(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const wood = rng.pick([p.wood, p.woodDark]);
  const bins = [p.accent, p.fabric, p.fabricLight, p.plant];
  for (const sx of [-1, 1]) k.box(0.03, 1.8, 0.35, sx * 0.385, 0, 0, wood);
  k.box(0.74, 0.03, 0.35, 0, 0.1, 0, wood);
  k.box(0.74, 0.03, 0.35, 0, 1.77, 0, wood);
  k.box(0.74, 1.74, 0.01, 0, 0.06, -0.17, k.mix(wood, '#000000', 0.15));
  k.box(0.74, 0.06, 0.34, 0, 0, 0, wood);
  k.box(0.03, 1.64, 0.35, 0, 0.13, 0, wood);
  const rows = 4;
  const gap = 1.64 / rows;
  for (let i = 1; i < rows; i++) k.box(0.74, 0.03, 0.35, 0, 0.13 + i * gap - 0.015, 0, wood);
  for (let r = 0; r < rows; r++) {
    for (const x of [-0.19, 0.19]) if (rng.chance(0.6)) k.rbox(0.28, gap - 0.12, 0.26, 0.015, x, 0.13 + r * gap + 0.01, 0.02, rng.pick(bins));
  }
  return k.root;
}

/* ---- Salle de bain ---- */

function vanityOpen(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const body = rng.pick([p.wood, p.woodDark, p.fabricLight]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.035, 0.2, 0.035, sx * 0.37, 0, sz * 0.22, rng.pick([p.metal, p.woodDark]));
  k.box(0.8, 0.5, 0.5, 0, 0.2, 0, body);
  k.box(0.8, 0.03, 0.5, 0, 0.7, 0, p.ceramic);
  k.box(0.74, 0.3, 0.012, 0, 0.28, 0.255, k.mix(body, '#000000', 0.12));
  k.box(0.74, 0.12, 0.012, 0, 0.6, 0.255, k.mix(body, '#ffffff', 0.08));
  k.cyl(0.19, 0.16, 0.12, 0, 0.73, 0.02, p.ceramic, { rough: 0.3 }, 24);
  k.cyl(0.012, 0.012, 0.2, 0, 0.73, -0.19, p.metal, { metal: 0.9, rough: 0.2 }, 12);
  k.box(0.012, 0.012, 0.1, 0, 0.93, -0.14, p.metal, { metal: 0.9, rough: 0.2 });
  k.box(0.8, 0.9, 0.02, 0, 1.0, -0.24, '#d4e4ea', { metal: 0.8, rough: 0.08 });
  k.box(0.8, 0.03, 0.1, 0, 0.97, -0.2, rng.pick([p.woodDark, p.wood]));
  return k.root;
}

/* ---- Décoration ---- */

function lampCeramic(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const base = rng.pick([p.ceramic, p.accent, p.woodDark]);
  const shade = rng.pick([p.fabricLight, p.wall, '#f4f1ea']);
  k.cyl(0.07, 0.06, 0.2, 0, 0, 0, base, { rough: 0.35 }, 20);
  k.cyl(0.125, 0.125, 0.25, 0, 0.2, 0, shade, { emissive: shade, emissiveIntensity: 0.4, rough: 0.9 }, 24);
  return k.root;
}

function lampMushroom(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const color = rng.pick([p.accent, p.ceramic, p.fabricLight]);
  k.cyl(0.1, 0.11, 0.02, 0, 0, 0, p.metal, { metal: 0.5 }, 20);
  k.cyl(0.03, 0.03, 0.26, 0, 0.02, 0, p.metal, { metal: 0.5 }, 12);
  k.ell(0.125, 0.1, 0.125, 0, 0.35, 0, color, { emissive: color, emissiveIntensity: 0.4, rough: 0.5 });
  return k.root;
}

/** Plante verticale (sansevieria) : feuilles longues et fines dans un pot ; les quatre feuilles latérales fixent la largeur. */
function plantSpiky({ w, h, potR, potH }) {
  return (ctx) => {
    const k = makeKit(ctx);
    const { rng, palette: p } = ctx;
    const pot = rng.pick([p.accent, p.ceramic, p.woodDark, p.fabricLight]);
    k.cyl(potR, potR * 0.8, potH, 0, 0, 0, pot, { rough: 0.6 });
    k.cyl(potR - 0.01, potR - 0.01, 0.01, 0, potH, 0, '#4a3a2c');
    const greens = [k.mix(p.plant, '#000000', 0.15), p.plant, k.mix(p.plant, '#ffffff', 0.18)];
    const edge = w / 2 - 0.035;
    for (const [x, z] of [[edge, 0], [-edge, 0], [0, edge], [0, -edge]]) k.ell(0.035, (h - potH) * 0.35, 0.035, x, potH + (h - potH) * 0.35, z, rng.pick(greens), { rough: 0.9 });
    k.ell(0.04, (h - potH) / 2, 0.04, 0, potH + (h - potH) / 2, 0, greens[0], { rough: 0.9 });
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + 0.3;
      const r = rng.range(0.4, 0.8) * (w / 2 - 0.05);
      const height = rng.range(0.55, 0.9) * (h - potH);
      k.ell(0.032, height / 2, 0.032, Math.cos(angle) * r, potH + height / 2, Math.sin(angle) * r, rng.pick(greens), { rough: 0.9 });
    }
    return k.root;
  };
}

/** Tapis à rayures : le fond fixe la boîte, les rayures restent dessous 2 cm. */
function rugStripes({ w, d }) {
  return (ctx) => {
    const k = makeKit(ctx);
    const { rng, palette: p } = ctx;
    const colors = [p.fabric, p.fabricLight, p.accent];
    const a = rng.pick(colors);
    const b = rng.pick(colors.filter((c) => c !== a));
    k.box(w, 0.015, d, 0, 0, 0, a, { rough: 1 });
    const n = Math.max(3, Math.round(d / 0.28));
    for (let i = 0; i < n; i++) k.box(w - 0.16, 0.005, 0.07, 0, 0.015, -d / 2 + 0.12 + (i * (d - 0.24)) / (n - 1), b, { rough: 1 });
    return k.root;
  };
}

export const ALT_MODELS = {
  'sofa-2': [sofaScandi({ w: 1.6, d: 0.9, seats: 2 }), sofaRounded({ w: 1.6, d: 0.9, seats: 2 })],
  'sofa-3': [sofaScandi({ w: 2.2, d: 0.9, seats: 3 }), sofaRounded({ w: 2.2, d: 0.9, seats: 3 })],
  'sofa-bed': [sofaScandi({ w: 1.9, d: 0.9, seats: 2 })],
  armchair: [armchairWood, armchairBarrel],
  'coffee-table': [coffeeTableOval, coffeeTableNest, coffeeTableChest],
  'tv-unit': [tvUnitNiches],
  bookcase: [bookcaseCubes, bookcaseClosedBase],
  console: [consoleDrawers, consoleMetal],
  'floor-lamp': [floorLampTripod, floorLampLantern],
  'dining-table-4': [diningTableAlt({ ends: false, style: 'trestle' }), diningTableAlt({ ends: false, style: 'pedestal' })],
  'dining-table-6': [diningTableAlt({ ends: true, style: 'trestle' })],
  buffet: [buffetMidCentury],
  'bed-double': [bedSlats({ w: 1.7, headH: 1.0 }), bedUpholstered({ w: 1.7, headH: 1.0 })],
  'bed-single': [bedSlats({ w: 0.95, headH: 0.9 }), bedUpholstered({ w: 0.95, headH: 0.9 })],
  nightstand: [nightstandOpen, nightstandRound],
  wardrobe: [wardrobeSliding],
  dresser: [dresserHigh],
  desk: [deskTrestle],
  'office-chair': [officeChairMesh],
  'shelf-unit': [shelfUnitCubes],
  vanity: [vanityOpen],
  'table-lamp': [lampCeramic, lampMushroom],
  'plant-medium': [plantSpiky({ w: 0.5, h: 1.0, potR: 0.14, potH: 0.26 })],
  'plant-tall': [plantSpiky({ w: 0.6, h: 1.6, potR: 0.16, potH: 0.3 })],
  'rug-s': [rugStripes({ w: 1.2, d: 0.8 })],
  'rug-m': [rugStripes({ w: 2.0, d: 1.4 })],
  'rug-l': [rugStripes({ w: 2.8, d: 2.0 })],
};
