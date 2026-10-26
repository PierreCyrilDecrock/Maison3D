// generator.js — générateur de mobilier : briques de base (phase 6a) et placement des pièces (phase 6b).
// Logique pure : aucun accès au DOM, aucun import de Three.js (core.js et les DONNÉES de furniture.js seulement ;
// les briques reçoivent des données { id, size, placement }). Ce fichier fournit
//   1. un générateur pseudo-aléatoire avec graine (mulberry32) et ses helpers,
//   2. la grille d'occupation d'une pièce à 10 cm (sol, murs + marge, portes, fenêtres),
//   3. l'empreinte d'un objet placé et les tests de chevauchement, d'inclusion et de dégagement frontal,
//   4. le contrôle de connexité (largeur de passage minimale de 60 cm),
//   5. (6b) les recettes par type de pièce (salon, chambre, salle à manger) et generateRoom / generateRoomReport :
//      candidats, notes, groupes posés comme une unité, essais successifs puis suppression d'objets, validateLayout.
// Unités : mètres. Plan (x, y) = 3D (x, z). Rotation d'un objet = rotation Y de Three.js en degrés (0, 90, 180, 270) :
// à 0° l'avant (+Z local) regarde vers +y du plan (le bas de l'écran) ; à 90° vers +x ; à 180° vers -y ; à 270° vers -x.

import { WALL_THICKNESS, detectRooms, levelElevation, roomAtPoint, setRoomLock, stairClimb, stairContains, stairLayout, stairObstacles, stairRects, stairRise, stairStepCount, stairUnder, stairWellRails, STAIR_RAIL, getClearanceZones, getRoomType, isRoomLocked, levelPlan, normalizeDocument, openingAxes, openingEdges, openingHeight, openingSill, readPlan, withLevelPlan } from './core.js';
import { FURNITURE_DATA, variantsOf } from './furniture.js';

/* ------------------------------------------------------------------ */
/* 1. Hasard avec graine                                              */
/* ------------------------------------------------------------------ */

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * Dérive une sous-graine (entier 32 bits non signé) d'une graine et d'un texte : même entrée, même sortie, et deux
 * textes différents donnent des graines sans rapport. Sert à donner à chaque pièce (ou à chaque étape) son propre
 * flux de hasard : changer une pièce ne modifie pas le tirage des autres.
 * @param {number | string} seed
 * @param {string} [text]
 * @returns {number}
 */
export function hash(seed, text = '') {
  let h = (FNV_OFFSET ^ toSeed(seed)) >>> 0;
  h = Math.imul(h, FNV_PRIME) >>> 0;
  const label = String(text);
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** Ramène une graine (nombre ou texte) à un entier 32 bits non signé. Un nombre invalide donne 1. */
export function toSeed(seed) {
  if (typeof seed === 'string') return hash(0x9e3779b9, seed);
  const n = Number(seed);
  return Number.isFinite(n) ? Math.trunc(n) >>> 0 : 1;
}

/**
 * Générateur pseudo-aléatoire mulberry32 (même suite que `createRng` de furniture.js pour une même graine).
 * - next() : nombre dans [0, 1[ ; range(min, max) : nombre dans [min, max[ ; int(min, max) : entier, bornes comprises ;
 * - pick(liste) : un élément (undefined si la liste est vide) ;
 * - weightedPick(liste, poids) : un élément selon son poids (`poids(item)` ; par défaut `item.weight`, 1 s'il manque) ;
 *   les poids nuls, négatifs ou invalides sont ignorés ; null si aucun élément n'a de poids ;
 * - shuffle(liste) : nouvelle liste mélangée (Fisher-Yates), la liste d'origine n'est pas modifiée ;
 * - chance(p) : vrai avec la probabilité p ;
 * - fork(texte) : nouveau générateur indépendant, dérivé de la graine et du texte (voir `hash`).
 * @param {number | string} [seed]
 */
export function createRng(seed = 1) {
  const initial = toSeed(seed);
  let s = initial;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    seed: initial,
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => (items.length ? items[Math.floor(next() * items.length)] : undefined),
    weightedPick(items, weightOf = (item) => item?.weight ?? 1) {
      const weights = items.map((item) => {
        const w = Number(weightOf(item));
        return Number.isFinite(w) && w > 0 ? w : 0;
      });
      const total = weights.reduce((sum, w) => sum + w, 0);
      if (total <= 0) return null;
      let r = next() * total;
      for (let i = 0; i < items.length; i++) {
        if (weights[i] <= 0) continue;
        if (r < weights[i]) return items[i];
        r -= weights[i];
      }
      return items[weights.findLastIndex((w) => w > 0)]; // reste d'arrondi : le dernier élément qui a un poids
    },
    shuffle(items) {
      const list = items.slice();
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      return list;
    },
    chance: (p = 0.5) => next() < p,
    fork: (text) => createRng(hash(initial, text)),
  };
  return rng;
}

/* ------------------------------------------------------------------ */
/* 2. Empreintes et objets placés                                     */
/* ------------------------------------------------------------------ */

/** Rotations autorisées, en degrés. */
export const ROTATIONS = Object.freeze([0, 90, 180, 270]);

const FRONT = Object.freeze({ 0: { x: 0, y: 1 }, 90: { x: 1, y: 0 }, 180: { x: 0, y: -1 }, 270: { x: -1, y: 0 } });
const LOCAL_X = Object.freeze({ 0: { x: 1, y: 0 }, 90: { x: 0, y: -1 }, 180: { x: -1, y: 0 }, 270: { x: 0, y: 1 } });
const EPS = 1e-6;
const r6 = (value) => Math.round(value * 1e6) / 1e6; // sans bruit flottant : 1,4 et non 1,4000000000000001

/** Ramène une rotation à 0, 90, 180 ou 270. Lève une erreur pour tout autre angle. */
export function normalizeRotation(rotation) {
  if (!Number.isFinite(rotation) || rotation % 90 !== 0) throw new RangeError(`Rotation invalide : ${rotation} (multiples de 90° seulement).`);
  return ((rotation % 360) + 360) % 360;
}

/** Vecteur « avant » d'une rotation, dans le plan : (0, 1) à 0°, (1, 0) à 90°, (0, -1) à 180°, (-1, 0) à 270°. */
export function facingVector(rotation) {
  return { ...FRONT[normalizeRotation(rotation)] };
}

/**
 * Empreinte au sol d'un objet : rectangle orienté (multiple de 90°) centré en (x, y), en mètres.
 * `w` est la largeur locale (axe x de l'objet), `d` sa profondeur locale (axe z, l'avant est à +z).
 * @param {{ x: number, y: number, w: number, d: number, rotation?: number }} spec
 * @returns {Footprint}
 * @typedef {{ cx: number, cy: number, w: number, d: number, rotation: number, ex: number, ey: number,
 *   x0: number, y0: number, x1: number, y1: number, front: { x: number, y: number } }} Footprint
 * `ex` × `ey` : dimensions du rectangle dans le plan après rotation ; (x0, y0)-(x1, y1) : ses coins.
 */
export function makeFootprint({ x, y, w, d, rotation = 0 }) {
  const rot = normalizeRotation(rotation);
  const swapped = rot === 90 || rot === 270;
  const ex = swapped ? d : w;
  const ey = swapped ? w : d;
  return {
    cx: x,
    cy: y,
    w,
    d,
    rotation: rot,
    ex,
    ey,
    x0: r6(x - ex / 2),
    y0: r6(y - ey / 2),
    x1: r6(x + ex / 2),
    y1: r6(y + ey / 2),
    front: { ...FRONT[rot] },
  };
}

/** Deux rectangles { x0, y0, x1, y1 } se recouvrent-ils ? Deux rectangles qui se touchent seulement par un bord ne se recouvrent pas. */
export function footprintsOverlap(a, b, tolerance = EPS) {
  return a.x0 < b.x1 - tolerance && b.x0 < a.x1 - tolerance && a.y0 < b.y1 - tolerance && b.y0 < a.y1 - tolerance;
}

/** Surface de recouvrement de deux rectangles { x0, y0, x1, y1 }, en m². */
export function overlapArea(a, b) {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Le rectangle `inner` est-il entièrement dans `outer` ? */
export function rectContains(outer, inner, tolerance = EPS) {
  return inner.x0 >= outer.x0 - tolerance && inner.y0 >= outer.y0 - tolerance && inner.x1 <= outer.x1 + tolerance && inner.y1 <= outer.y1 + tolerance;
}

/** Rectangle collé à l'empreinte, dans la direction `dir` (vecteur axial), sur `depth` mètres, avec toute sa largeur perpendiculaire. */
function rectBeyond(fp, dir, depth) {
  if (dir.y > 0) return { x0: fp.x0, y0: fp.y1, x1: fp.x1, y1: r6(fp.y1 + depth) };
  if (dir.y < 0) return { x0: fp.x0, y0: r6(fp.y0 - depth), x1: fp.x1, y1: fp.y0 };
  if (dir.x > 0) return { x0: fp.x1, y0: fp.y0, x1: r6(fp.x1 + depth), y1: fp.y1 };
  return { x0: r6(fp.x0 - depth), y0: fp.y0, x1: fp.x0, y1: fp.y1 };
}

/** Zone libre à garder devant l'objet : `depth` mètres vers l'avant, sur toute la largeur de l'empreinte. */
export function frontClearanceRect(footprint, depth) {
  return rectBeyond(footprint, footprint.front, depth);
}

/**
 * Zones libres à garder sur les deux côtés de l'objet (`minus` côté -x local, `plus` côté +x local), `depth` mètres,
 * sur toute la profondeur de l'empreinte.
 */
export function sideClearanceRects(footprint, depth) {
  const axis = LOCAL_X[footprint.rotation]; // +x local, dans le plan : (cos θ, -sin θ)
  return { minus: rectBeyond(footprint, { x: -axis.x, y: -axis.y }, depth), plus: rectBeyond(footprint, axis, depth) };
}

/** Couches d'un objet selon son mode de placement : sol, mur, fenêtre, plafond. */
export function layerOf(mode) {
  if (mode === 'wall-mounted') return 'wall';
  if (mode === 'window') return 'window';
  if (mode === 'ceiling') return 'ceiling';
  return 'floor';
}

/** Un objet plus bas que cette hauteur (tapis) ne gêne pas la marche : il ne bloque pas le passage. */
export const STEP_HEIGHT = 0.1;
/** Hauteur de plafond par défaut, en mètres (plan.wallHeight sinon). */
export const DEFAULT_CEILING = 2.5;

/**
 * Objet placé, prêt pour les tests : empreinte, étendue verticale, couche, dégagements.
 * @param {{ id: string, size: { w: number, d: number, h: number },
 *   placement?: { mode?: string, clearanceFront?: number, clearanceSides?: number, canOverlap?: string[], mountHeight?: number } }} def
 *   données de l'objet (FURNITURE_DATA)
 * @param {{ x: number, y: number, rotation?: number, key?: string }} at centre de l'empreinte (m) et rotation (degrés)
 * @param {{ ceilingHeight?: number, elevation?: number }} [options] `elevation` : hauteur du bas de l'objet s'il n'est pas au sol
 *   (lampe posée sur un meuble) ; par défaut 0, `placement.mountHeight` pour un objet fixé au mur
 * @returns {PlacedObject}
 * @typedef {{ key?: string, id: string, mode: string, layer: 'floor' | 'wall' | 'window' | 'ceiling', footprint: Footprint,
 *   bottom: number, top: number, solid: boolean, clearanceFront: number, clearanceSides: number, canOverlap: string[] }} PlacedObject
 * `bottom` / `top` : hauteurs du bas et du haut de l'objet ; `solid` : l'objet bloque la marche (posé au sol et plus haut que 10 cm).
 */
export function createPlaced(def, { x, y, rotation = 0, key } = {}, { ceilingHeight = DEFAULT_CEILING, elevation } = {}) {
  const placement = def.placement ?? {};
  const mode = placement.mode ?? 'free';
  const layer = layerOf(mode);
  const h = def.size.h;
  let bottom = 0;
  if (layer === 'ceiling') bottom = ceilingHeight - h;
  else if (elevation !== undefined) bottom = elevation; // posé sur un meuble, ou fixé au mur à une hauteur choisie
  else if (layer === 'wall' || layer === 'window') bottom = placement.mountHeight ?? 0; // fixé au mur (cadre) ou store sous le haut de la fenêtre
  const placed = {
    id: def.id,
    mode,
    layer,
    footprint: makeFootprint({ x, y, w: def.size.w, d: def.size.d, rotation }),
    bottom: r6(bottom),
    top: r6(bottom + h),
    solid: layer === 'floor' && h > STEP_HEIGHT,
    clearanceFront: placement.clearanceFront ?? 0,
    clearanceSides: placement.clearanceSides ?? 0,
    canOverlap: placement.canOverlap ?? [],
  };
  if (key !== undefined) placed.key = key;
  return placed;
}

/** L'un des deux objets autorise-t-il l'autre à se superposer (tapis sous un canapé, lampe sur une commode) ? */
export function allowsOverlap(a, b) {
  return a.canOverlap.includes(b.id) || b.canOverlap.includes(a.id);
}

/**
 * Deux objets placés sont-ils en conflit ? Oui s'ils se recouvrent au sol ET dans la hauteur, sauf si l'un d'eux
 * autorise l'autre (`canOverlap`). Un luminaire de plafond au-dessus d'un canapé, un cadre au-dessus d'une commode
 * ne sont pas en conflit : leurs hauteurs ne se croisent pas.
 */
export function placementsConflict(a, b) {
  if (!footprintsOverlap(a.footprint, b.footprint)) return false;
  if (allowsOverlap(a, b)) return false;
  if (a.top <= b.bottom + EPS || b.top <= a.bottom + EPS) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/* 3. Grille d'occupation d'une pièce                                 */
/* ------------------------------------------------------------------ */

/** Résolution de la grille d'occupation, en mètres (10 cm). */
export const GRID_RES = 0.1;
/** Marge gardée entre les objets et la face des murs, en mètres. */
export const WALL_MARGIN = 0.05;
/** Profondeur de la zone devant une fenêtre, mesurée depuis l'axe du mur, en mètres. */
export const WINDOW_ZONE_DEPTH = 0.5;

/** Bits de l'état d'une case. */
export const CELL_FLOOR = 1; // la case est dans la pièce
export const CELL_WALL = 2; // mur (demi-épaisseur 5 cm) + marge de 5 cm : rien ne se pose ici
export const CELL_DOOR = 4; // zone de dégagement d'une porte (arrondie vers l'extérieur à 10 cm)
export const CELL_WINDOW = 8; // zone devant une fenêtre : interdite aux objets plus hauts que l'allège
export const CELL_OPENING = 16; // bande d'une porte ou d'un passage : on n'y accroche rien
export const CELL_STAIR = 32; // sous un escalier (ou sa trémie) : rien au plafond ; au sol, seulement ce qui passe sous les marches
export const CELL_STAIRZONE = 64; // à moins de STAIR_WALL_ZONE d'un escalier : on n'y accroche rien au mur (il serait caché ou dans les marches)

/**
 * Grille d'occupation d'une pièce.
 * @typedef {{
 *   res: number, originX: number, originY: number, cols: number, rows: number,
 *   flags: Uint8Array, windowTop: Float64Array, solid: Uint8Array,
 *   doors: DoorInfo[], windows: WindowInfo[], objects: PlacedObject[], nextKey: number,
 *   roomId: string, wallMargin: number, windowDepth: number
 * }} RoomGrid
 * `flags` : un octet de bits CELL_* par case (rangée par rangée) ; `windowTop[i]` : allège la plus basse des fenêtres
 * dont la zone couvre la case (Infinity sinon) ; `solid[i]` : nombre d'objets qui bloquent la marche sur la case.
 * @typedef {{ openingId: string, kind: 'door' | 'passage', span: number, width: number, axis: 'h' | 'v', pos: number,
 *   a0: number, a1: number, inward: { x: number, y: number } }} DoorInfo
 * Ligne de la porte : `pos` est la coordonnée du mur (y si axis = 'h', x si 'v'), [a0, a1] son étendue le long du mur ;
 * `inward` pointe vers l'intérieur de la pièce.
 * @typedef {{ openingId: string, sill: number, height: number, axis: 'h' | 'v', pos: number, a0: number, a1: number,
 *   inward: { x: number, y: number }, zones: { x0: number, y0: number, x1: number, y1: number }[] }} WindowInfo
 * Une entrée par fenêtre et par côté de la pièce : `pos`, [a0, a1] et `inward` comme pour les portes, `zones` les rectangles de la zone devant.
 */

const cellIdx = (grid, i, j) => j * grid.cols + i;

/** Cases (indices demi-ouverts) recouvertes par un rectangle en mètres, limitées à la grille. */
function cellRange(grid, x0, y0, x1, y1) {
  const { originX, originY, res, cols, rows } = grid;
  return {
    i0: Math.max(0, Math.floor((x0 - originX) / res + EPS)),
    i1: Math.min(cols, Math.ceil((x1 - originX) / res - EPS)),
    j0: Math.max(0, Math.floor((y0 - originY) / res + EPS)),
    j1: Math.min(rows, Math.ceil((y1 - originY) / res - EPS)),
  };
}

function markRect(grid, rect, bit, top) {
  const { i0, i1, j0, j1 } = cellRange(grid, rect.x0, rect.y0, rect.x1, rect.y1);
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      const idx = cellIdx(grid, i, j);
      grid.flags[idx] |= bit;
      if (top !== undefined && top < grid.windowTop[idx]) grid.windowTop[idx] = top;
    }
  }
}

/** Centre d'une case de la grille, en mètres. */
export function cellCenter(grid, i, j) {
  return { x: r6(grid.originX + (i + 0.5) * grid.res), y: r6(grid.originY + (j + 0.5) * grid.res) };
}

/** Case qui contient le point (x, y) en mètres : { i, j }, ou null hors de la grille. */
export function cellAt(grid, x, y) {
  const i = Math.floor((x - grid.originX) / grid.res + EPS);
  const j = Math.floor((y - grid.originY) / grid.res + EPS);
  return i < 0 || j < 0 || i >= grid.cols || j >= grid.rows ? null : { i, j };
}

/** Bits CELL_* d'une case (0 hors de la grille). */
export function cellFlags(grid, i, j) {
  return i < 0 || j < 0 || i >= grid.cols || j >= grid.rows ? 0 : grid.flags[cellIdx(grid, i, j)];
}

/** Case libre : dans la pièce, hors mur et marge, hors zone de porte, sans objet qui bloque la marche. */
export function isCellFree(grid, i, j) {
  if (i < 0 || j < 0 || i >= grid.cols || j >= grid.rows) return false;
  const idx = cellIdx(grid, i, j);
  return (grid.flags[idx] & (CELL_FLOOR | CELL_WALL | CELL_DOOR)) === CELL_FLOOR && grid.solid[idx] === 0 && grid.headroom[idx] >= STAIR_HEADROOM;
}

/** Nombre de cases libres (voir isCellFree). */
export function countFreeCells(grid) {
  let count = 0;
  for (let j = 0; j < grid.rows; j++) for (let i = 0; i < grid.cols; i++) if (isCellFree(grid, i, j)) count++;
  return count;
}

/** Surface libre en m². */
export function freeAreaM2(grid) {
  return r6(countFreeCells(grid) * grid.res * grid.res);
}

/**
 * Construit la grille d'occupation d'une pièce, à 10 cm.
 * - cases de la pièce : celles des cases du plan qui la composent (une pièce en L reste en L) ;
 * - murs : chaque arête de plan.walls, épaisse de 10 cm, plus une marge de 5 cm de chaque côté et à chaque bout
 *   (donc 10 cm entre l'axe du mur et le premier objet) ; les cloisons qui ne ferment rien comptent aussi ;
 * - portes et passages : leur bande est bloquée ; seules les portes ont une zone de dégagement (getClearanceZones),
 *   gardée côté pièce où elles s'ouvrent ;
 * - fenêtres : la zone de 0,5 m devant la fenêtre (depuis l'axe du mur) garde l'allège ; un objet dont le haut dépasse
 *   l'allège ne peut pas s'y trouver.
 * @param {Plan} plan
 * @param {Room} room une pièce de detectRooms(plan)
 * @param {{ wallMargin?: number, windowDepth?: number }} [options]
 * @returns {RoomGrid}
 */
export function createRoomGrid(plan, room, { wallMargin = WALL_MARGIN, windowDepth = WINDOW_ZONE_DEPTH } = {}) {
  const cell = plan.grid.cellSize;
  const sub = Math.max(1, Math.round(cell / GRID_RES));
  const res = cell / sub;
  const { minX, minY, maxX, maxY } = room.bounds;
  const cols = (maxX - minX) * sub;
  const rows = (maxY - minY) * sub;
  const grid = {
    res,
    originX: minX * cell,
    originY: minY * cell,
    cols,
    rows,
    flags: new Uint8Array(cols * rows),
    windowTop: new Float64Array(cols * rows).fill(Infinity),
    solid: new Uint8Array(cols * rows),
    headroom: new Float64Array(cols * rows).fill(Infinity),
    doors: [],
    windows: [],
    objects: [],
    nextKey: 1,
    roomId: room.id,
    wallMargin,
    windowDepth,
    _baseline: new Map(),
  };

  // Sol : les cases du plan de la pièce.
  const inRoom = new Set(room.cells.map(({ x, y }) => `${x},${y}`));
  for (const { x, y } of room.cells) {
    markRect(grid, { x0: x * cell, y0: y * cell, x1: (x + 1) * cell, y1: (y + 1) * cell }, CELL_FLOOR);
  }

  // Murs : demi-épaisseur + marge de chaque côté et à chaque bout de l'arête.
  const m = WALL_THICKNESS / 2 + wallMargin;
  for (const edge of plan.walls) {
    const horizontal = edge.dir === 'h';
    const rect = horizontal
      ? { x0: edge.x * cell - m, y0: edge.y * cell - m, x1: (edge.x + 1) * cell + m, y1: edge.y * cell + m }
      : { x0: edge.x * cell - m, y0: edge.y * cell - m, x1: edge.x * cell + m, y1: (edge.y + 1) * cell + m };
    markRect(grid, rect, CELL_WALL);
  }

  // Ouvertures.
  const sidesOf = (edge) =>
    edge.dir === 'h'
      ? [{ cell: { x: edge.x, y: edge.y - 1 }, dir: { x: 0, y: -1 } }, { cell: { x: edge.x, y: edge.y }, dir: { x: 0, y: 1 } }]
      : [{ cell: { x: edge.x - 1, y: edge.y }, dir: { x: -1, y: 0 } }, { cell: { x: edge.x, y: edge.y }, dir: { x: 1, y: 0 } }];
  const has = (c) => inRoom.has(`${c.x},${c.y}`);
  const zoneById = new Map(getClearanceZones(plan).map((zone) => [zone.openingId, zone]));

  for (const opening of plan.openings ?? []) {
    const edges = openingEdges(opening);
    if (opening.type === 'window') {
      const sill = openingSill(opening);
      const bySide = new Map(); // une entrée par côté de pièce (une fenêtre de cloison compte pour les deux pièces, chacune de son côté)
      for (const edge of edges) {
        for (const side of sidesOf(edge).filter((s) => has(s.cell))) {
          const horizontal = edge.dir === 'h';
          const line = (horizontal ? edge.y : edge.x) * cell;
          const along0 = (horizontal ? edge.x : edge.y) * cell;
          const sign = horizontal ? side.dir.y : side.dir.x;
          const near = sign > 0 ? line : line - windowDepth;
          const far = sign > 0 ? line + windowDepth : line;
          const rect = horizontal ? { x0: along0, x1: along0 + cell, y0: near, y1: far } : { x0: near, x1: far, y0: along0, y1: along0 + cell };
          markRect(grid, rect, CELL_WINDOW, sill);
          const id = `${side.dir.x},${side.dir.y}`;
          if (!bySide.has(id)) {
            bySide.set(id, { openingId: opening.id, sill, height: openingHeight(opening), axis: edge.dir, pos: line, a0: along0, a1: along0, inward: side.dir, zones: [] });
          }
          const entry = bySide.get(id);
          entry.a1 = Math.max(entry.a1, along0 + cell);
          entry.zones.push(rect);
        }
      }
      grid.windows.push(...bySide.values());
      continue;
    }

    // Porte ou passage : bande bloquée le long du mur, sans dépassement aux bouts.
    let inward = null;
    for (const edge of edges) {
      const line = edge.dir === 'h' ? edge.y * cell : edge.x * cell;
      const along0 = (edge.dir === 'h' ? edge.x : edge.y) * cell;
      const band = edge.dir === 'h' ? { x0: along0, x1: along0 + cell, y0: line - m, y1: line + m } : { x0: line - m, x1: line + m, y0: along0, y1: along0 + cell };
      markRect(grid, band, CELL_OPENING | CELL_WALL);
      const inside = sidesOf(edge).filter((s) => has(s.cell));
      if (!inward && inside.length === 1) inward = inside[0].dir;
    }
    if (inward) {
      const horizontal = opening.start.dir === 'h';
      grid.doors.push({
        openingId: opening.id,
        kind: opening.type,
        span: opening.span,
        width: opening.span * cell,
        axis: opening.start.dir,
        pos: (horizontal ? opening.start.y : opening.start.x) * cell,
        a0: (horizontal ? opening.start.x : opening.start.y) * cell,
        a1: ((horizontal ? opening.start.x : opening.start.y) + opening.span) * cell,
        inward,
      });
    }
    // Zone de dégagement : seulement si la porte s'ouvre dans cette pièce.
    const zone = zoneById.get(opening.id);
    if (zone) {
      const first = edges[0];
      const { side } = openingAxes(opening);
      const swingCell =
        first.dir === 'h' ? { x: first.x, y: side.y > 0 ? first.y : first.y - 1 } : { x: side.x > 0 ? first.x : first.x - 1, y: first.y };
      if (has(swingCell)) markRect(grid, { x0: zone.x, y0: zone.y, x1: zone.x + zone.w, y1: zone.y + zone.h }, CELL_DOOR);
    }
  }

  // Escaliers (qui montent de ce niveau) et trémies (arrivée des escaliers du niveau du dessous) : rien ne se pose dessus,
  // ni sur l'espace de 90 cm où l'on monte (bas de l'escalier) ou où l'on arrive (haut, côté trémie). Sous un escalier ouvert,
  // on peut poser ce qui tient sous les marches (hauteur libre par case) ; rien de fixé au mur ni au plafond près d'un escalier.
  const wells = plan.wells ?? [];
  for (const stair of [...(plan.stairs ?? []), ...wells]) {
    const isWell = wells.includes(stair);
    const layout = stairLayout(stair);
    const rects = stairRects(stair);
    const open = !isWell && stairUnder(stair) === 'open';
    for (const r of rects) {
      markRect(grid, r, CELL_STAIR);
      markRect(grid, { x0: r.x0 - STAIR_WALL_ZONE, y0: r.y0 - STAIR_WALL_ZONE, x1: r.x1 + STAIR_WALL_ZONE, y1: r.y1 + STAIR_WALL_ZONE }, CELL_STAIRZONE);
      if (!open) markRect(grid, r, CELL_WALL);
    }
    if (open) markStairUnder(grid, stair, plan.wallHeight);
    const edge = isWell ? layout.top : layout.bottom;
    const half = edge.width / 2;
    const landing = edge.ny > 0 ? { x0: edge.x - half, x1: edge.x + half, y0: edge.y, y1: edge.y + STAIR_LANDING }
      : edge.ny < 0 ? { x0: edge.x - half, x1: edge.x + half, y0: edge.y - STAIR_LANDING, y1: edge.y }
      : edge.nx > 0 ? { x0: edge.x, x1: edge.x + STAIR_LANDING, y0: edge.y - half, y1: edge.y + half }
      : { x0: edge.x - STAIR_LANDING, x1: edge.x, y0: edge.y - half, y1: edge.y + half };
    markRect(grid, landing, CELL_DOOR);
  }
  return grid;
}

/** Espace laissé libre au pied (ou à l'arrivée) d'un escalier, en mètres. */
export const STAIR_LANDING = 0.9;
/** Distance autour d'un escalier où l'on n'accroche rien au mur, en mètres. */
export const STAIR_WALL_ZONE = 0.6;
/** Sous un escalier ouvert, une case où la hauteur libre est moindre est fermée à tout objet (et à la marche), en mètres. */
export const STAIR_MIN_UNDER = 0.3;
/** Hauteur libre nécessaire pour passer sous un escalier (visite et connexité), en mètres. */
export const STAIR_HEADROOM = 1.9;
/** Épaisseur d'une marche ouverte et marge de sécurité sous les marches, en mètres. */
const STAIR_UNDERSIDE = 0.1;

/**
 * Hauteur libre sous un escalier ouvert, pour chaque case de 10 cm qu'il couvre (plus petite valeur sur la case : le bas des
 * marches au point le plus bas). Les cases trop basses pour y poser quoi que ce soit sont fermées comme un mur.
 */
function markStairUnder(grid, stair, wallHeight) {
  const rise = stairRise(wallHeight);
  for (const r of stairRects(stair)) {
    const { i0, i1, j0, j1 } = cellRange(grid, r.x0, r.y0, r.x1, r.y1);
    for (let j = j0; j < j1; j++) {
      for (let i = i0; i < i1; i++) {
        const x0 = grid.originX + i * grid.res;
        const y0 = grid.originY + j * grid.res;
        let low = Infinity;
        for (const fx of [0.02, 0.5, 0.98]) {
          for (const fy of [0.02, 0.5, 0.98]) {
            const t = stairClimb(stair, x0 + fx * grid.res, y0 + fy * grid.res);
            if (t !== null) low = Math.min(low, Math.max(0, t * rise - STAIR_UNDERSIDE));
          }
        }
        if (low === Infinity) continue;
        const idx = cellIdx(grid, i, j);
        grid.headroom[idx] = Math.min(grid.headroom[idx], low);
        if (low < STAIR_MIN_UNDER) grid.flags[idx] |= CELL_WALL;
      }
    }
  }
}

/**
 * Dessin du texte de la grille, une ligne par rangée de 10 cm : « # » mur ou marge, « D » zone de porte, « W » zone de
 * fenêtre, « o » objet qui bloque la marche, « . » libre, « » (espace) hors de la pièce. Pour déboguer et pour les tests.
 */
export function gridToText(grid) {
  const lines = [];
  for (let j = 0; j < grid.rows; j++) {
    let line = '';
    for (let i = 0; i < grid.cols; i++) {
      const idx = cellIdx(grid, i, j);
      const f = grid.flags[idx];
      if (!(f & CELL_FLOOR)) line += ' ';
      else if (f & CELL_WALL) line += '#';
      else if (grid.solid[idx] > 0) line += 'o';
      else if (f & CELL_DOOR) line += 'D';
      else if (f & CELL_WINDOW) line += 'W';
      else line += '.';
    }
    lines.push(line);
  }
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* 4. Placement : inclusion, chevauchement, dégagement                */
/* ------------------------------------------------------------------ */

function outOfBounds(grid, rect) {
  return (
    rect.x0 < grid.originX - EPS ||
    rect.y0 < grid.originY - EPS ||
    rect.x1 > grid.originX + grid.cols * grid.res + EPS ||
    rect.y1 > grid.originY + grid.rows * grid.res + EPS
  );
}

/**
 * Le rectangle est-il entièrement sur le sol de la pièce, hors mur et marge ? (test d'inclusion)
 * Chaque case recouverte doit être dans la pièce et hors CELL_WALL. Pour les objets qui se collent au mur
 * (fixés au mur, rideaux), utilisez checkPlacement, qui tolère la marge.
 */
export function rectInRoom(grid, rect) {
  if (outOfBounds(grid, rect)) return false;
  const { i0, i1, j0, j1 } = cellRange(grid, rect.x0, rect.y0, rect.x1, rect.y1);
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      if ((grid.flags[cellIdx(grid, i, j)] & (CELL_FLOOR | CELL_WALL)) !== CELL_FLOOR) return false;
    }
  }
  return true;
}

/**
 * Le dégagement frontal de l'objet est-il libre ? La zone devant l'objet doit être sur le sol libre de la pièce
 * (marge de 5 cm comprise) et ne recouvrir aucun autre objet qui bloque la marche, sauf ceux qu'il autorise (canOverlap).
 * @param {RoomGrid} grid
 * @param {PlacedObject} placed
 * @param {{ ignore?: string[] }} [options] clés des objets à ignorer
 */
export function isFrontClear(grid, placed, { ignore = [] } = {}) {
  if (!(placed.clearanceFront > 0)) return true;
  const zone = frontClearanceRect(placed.footprint, placed.clearanceFront);
  if (!rectInRoom(grid, zone)) return false;
  for (const other of grid.objects) {
    if (!other.solid || ignore.includes(other.key) || allowsOverlap(placed, other)) continue;
    if (footprintsOverlap(zone, other.footprint)) return false;
  }
  return true;
}

/**
 * Teste un objet placé contre la pièce et contre les objets déjà posés. Ne modifie rien.
 * Raisons possibles dans `reasons` :
 * - « outside » : une partie de l'empreinte est hors de la pièce ;
 * - « wall » : sur un mur ou sa marge de 5 cm (objets au sol et suspendus au plafond) ;
 * - « door » : dans la zone de dégagement d'une porte (objets au sol) ;
 * - « window » : devant une fenêtre alors que son haut dépasse l'allège (objets au sol et fixés au mur) ;
 * - « opening » : sur la bande d'une porte ou d'un passage (objets fixés au mur, rideaux) ;
 * - « object » : en conflit avec un autre objet (voir placementsConflict) ;
 * - « clearance » : le dégagement frontal est occupé (le sien, ou celui d'un objet déjà posé).
 * Les objets fixés au mur et les rideaux peuvent toucher la marge contre le mur ; les rideaux ignorent aussi la zone de fenêtre.
 * @param {RoomGrid} grid
 * @param {PlacedObject} placed
 * @param {{ clearance?: 'both' | 'own' | false, ignore?: string[], firstOnly?: boolean }} [options]
 *   `clearance` : 'both' (défaut) vérifie son dégagement et celui des autres objets ; 'own' seulement le sien ; false aucun ;
 *   `firstOnly` : s'arrête à la première raison trouvée (plus rapide quand on veut seulement savoir si l'objet est valide).
 * @returns {{ ok: boolean, reasons: string[], conflicts: string[] }} `conflicts` : clés des objets en conflit ou gênés
 */
export function checkPlacement(grid, placed, { clearance = 'both', ignore = [], firstOnly = false } = {}) {
  const reasons = new Set();
  const conflicts = [];
  const fp = placed.footprint;
  const { layer } = placed;
  const done = () => ({ ok: reasons.size === 0, reasons: [...reasons], conflicts: [...new Set(conflicts)] });
  if (outOfBounds(grid, fp)) {
    reasons.add('outside');
    if (firstOnly) return done();
  }
  const { i0, i1, j0, j1 } = cellRange(grid, fp.x0, fp.y0, fp.x1, fp.y1);
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      const idx = cellIdx(grid, i, j);
      const f = grid.flags[idx];
      if (!(f & CELL_FLOOR)) {
        reasons.add('outside');
        continue;
      }
      if ((layer === 'floor' || layer === 'ceiling') && f & CELL_WALL) reasons.add('wall');
      if (layer === 'floor' && placed.top > grid.headroom[idx] - EPS) reasons.add('stair'); // plus haut que le dessous des marches
      if (layer === 'ceiling' && f & CELL_STAIR) reasons.add('stair');
      if ((layer === 'wall' || layer === 'window') && f & CELL_STAIRZONE) reasons.add('stair');
      if (layer === 'floor' && f & CELL_DOOR) reasons.add('door');
      if ((layer === 'floor' || layer === 'wall') && f & CELL_WINDOW && placed.top > grid.windowTop[idx] + EPS) reasons.add('window');
      if ((layer === 'wall' || layer === 'window') && f & CELL_OPENING) reasons.add('opening');
    }
    if (firstOnly && reasons.size) return done();
  }

  for (const other of grid.objects) {
    if (ignore.includes(other.key)) continue;
    if (placementsConflict(placed, other)) {
      reasons.add('object');
      conflicts.push(other.key);
      if (firstOnly) return done();
    }
  }

  if (clearance && layer === 'floor') {
    if (!isFrontClear(grid, placed, { ignore })) {
      reasons.add('clearance');
      if (firstOnly) return done();
    }
    if (clearance === 'both' && placed.solid) {
      for (const other of grid.objects) {
        if (ignore.includes(other.key) || other.layer !== 'floor' || !(other.clearanceFront > 0) || allowsOverlap(placed, other)) continue;
        if (footprintsOverlap(fp, frontClearanceRect(other.footprint, other.clearanceFront))) {
          reasons.add('clearance');
          conflicts.push(other.key);
          if (firstOnly) return done();
        }
      }
    }
  }
  return done();
}

function addSolid(grid, footprint, delta) {
  const { i0, i1, j0, j1 } = cellRange(grid, footprint.x0, footprint.y0, footprint.x1, footprint.y1);
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) grid.solid[cellIdx(grid, i, j)] += delta;
}

/** Ajoute un objet à la grille sans le tester. Lui donne une clé unique (« id#n ») s'il n'en a pas. Renvoie l'objet ajouté. */
export function addObject(grid, placed) {
  const object = placed.key === undefined ? { ...placed, key: `${placed.id}#${grid.nextKey++}` } : placed;
  grid.objects.push(object);
  if (object.solid) addSolid(grid, object.footprint, 1);
  return object;
}

/** Retire un objet de la grille (pour revenir en arrière). Renvoie faux si la clé est inconnue. */
export function removeObject(grid, key) {
  const index = grid.objects.findIndex((object) => object.key === key);
  if (index < 0) return false;
  const [object] = grid.objects.splice(index, 1);
  if (object.solid) addSolid(grid, object.footprint, -1);
  return true;
}

/** Retire tous les objets de la grille (pour recommencer un essai). */
export function clearObjects(grid) {
  grid.objects.length = 0;
  grid.solid.fill(0);
  grid.nextKey = 1;
}

/** Teste puis ajoute l'objet s'il est accepté. Renvoie { ok, reasons, conflicts, object } ; `object` est l'objet ajouté (avec sa clé). */
export function tryPlaceObject(grid, placed, options) {
  const result = checkPlacement(grid, placed, options);
  return result.ok ? { ...result, object: addObject(grid, placed) } : { ...result, object: null };
}

/* ------------------------------------------------------------------ */
/* 5. Connexité                                                       */
/* ------------------------------------------------------------------ */

/** Largeur de passage minimale, en mètres. */
export const MIN_PASSAGE_WIDTH = 0.6;
/** Distance maximale entre une porte et la personne qui s'en approche, en mètres. */
export const DOOR_REACH_DEPTH = 0.4;
/** Surface minimale d'une poche libre isolée pour être jugée « importante », en m². */
export const POCKET_AREA_M2 = 1;

/**
 * Positions possibles d'un corps carré de `n` × `n` cases : une position (i, j) est le coin haut gauche du carré, qui
 * doit être entièrement sur des cases libres de mur (les portes et fenêtres ne bloquent pas la marche).
 */
function passablePositions(grid, n, withObjects) {
  const { cols, rows } = grid;
  const W = cols + 1;
  const sums = new Int32Array((cols + 1) * (rows + 1));
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const idx = cellIdx(grid, i, j);
      const open = (grid.flags[idx] & (CELL_FLOOR | CELL_WALL)) === CELL_FLOOR && !(withObjects && grid.solid[idx] > 0);
      sums[(j + 1) * W + i + 1] = (open ? 0 : 1) + sums[j * W + i + 1] + sums[(j + 1) * W + i] - sums[j * W + i];
    }
  }
  const pw = Math.max(0, cols - n + 1);
  const ph = Math.max(0, rows - n + 1);
  const ok = new Uint8Array(pw * ph);
  for (let j = 0; j < ph; j++) {
    for (let i = 0; i < pw; i++) {
      if (sums[(j + n) * W + i + n] - sums[j * W + i + n] - sums[(j + n) * W + i] + sums[j * W + i] === 0) ok[j * pw + i] = 1;
    }
  }
  return { n, pw, ph, ok };
}

/** Composantes connexes (4-voisins) des positions possibles : labels de 1 à `count` (0 = position impossible). */
function labelComponents(positions) {
  const { pw, ph, ok } = positions;
  const labels = new Int32Array(pw * ph);
  let count = 0;
  const stack = [];
  for (let start = 0; start < ok.length; start++) {
    if (!ok[start] || labels[start]) continue;
    count++;
    labels[start] = count;
    stack.push(start);
    while (stack.length) {
      const p = stack.pop();
      const i = p % pw;
      const j = (p - i) / pw;
      const visit = (q) => {
        if (ok[q] && !labels[q]) {
          labels[q] = count;
          stack.push(q);
        }
      };
      if (i > 0) visit(p - 1);
      if (i < pw - 1) visit(p + 1);
      if (j > 0) visit(p - pw);
      if (j < ph - 1) visit(p + pw);
    }
  }
  return { ...positions, labels, count };
}

const squareRect = (grid, n, i, j) => ({
  x0: grid.originX + i * grid.res,
  y0: grid.originY + j * grid.res,
  x1: grid.originX + (i + n) * grid.res,
  y1: grid.originY + (j + n) * grid.res,
});

/** Composante d'où l'on atteint une porte : meilleure position (recouvrement le long du mur, puis proximité), 0 si aucune. */
function doorComponent(grid, comps, door, reach) {
  const { n, pw, ph, labels } = comps;
  const body = n * grid.res;
  const need = Math.min(door.width, body) - EPS;
  const horizontal = door.axis === 'h';
  const sign = horizontal ? door.inward.y : door.inward.x;
  let best = 0;
  let bestScore = -Infinity;
  const origin = horizontal ? grid.originX : grid.originY;
  const lineOrigin = horizontal ? grid.originY : grid.originX;
  const iLo = Math.max(0, Math.floor((door.a0 - origin) / grid.res) - n);
  const iHi = Math.min((horizontal ? pw : ph) - 1, Math.ceil((door.a1 - origin) / grid.res));
  const kLo = Math.max(0, Math.floor((door.pos - lineOrigin) / grid.res) - n - 1);
  const kHi = Math.min((horizontal ? ph : pw) - 1, Math.ceil((door.pos - lineOrigin) / grid.res) + n + 1);
  for (let k = kLo; k <= kHi; k++) {
    for (let a = iLo; a <= iHi; a++) {
      const i = horizontal ? a : k;
      const j = horizontal ? k : a;
      const label = labels[j * pw + i];
      if (!label) continue;
      const r = squareRect(grid, n, i, j);
      const lo = horizontal ? r.x0 : r.y0;
      const hi = horizontal ? r.x1 : r.y1;
      const lateral = Math.min(hi, door.a1) - Math.max(lo, door.a0);
      const near = sign > 0 ? (horizontal ? r.y0 : r.x0) - door.pos : door.pos - (horizontal ? r.y1 : r.x1);
      if (lateral < need || near > reach + EPS || near < -EPS) continue;
      const score = lateral * 10 - near;
      if (score > bestScore) {
        bestScore = score;
        best = label;
      }
    }
  }
  return best;
}

/** Composante d'où l'on atteint une zone : un corps libre qui la recouvre au moins à moitié (de la plus petite des deux surfaces). */
function zoneComponent(grid, comps, zone) {
  const { n, pw, ph, labels } = comps;
  const bodyArea = (n * grid.res) ** 2;
  const zoneArea = Math.max(0, (zone.x1 - zone.x0) * (zone.y1 - zone.y0));
  const need = 0.5 * Math.min(zoneArea, bodyArea) - EPS;
  const i0 = Math.max(0, Math.floor((zone.x0 - grid.originX) / grid.res) - n);
  const i1 = Math.min(pw - 1, Math.ceil((zone.x1 - grid.originX) / grid.res));
  const j0 = Math.max(0, Math.floor((zone.y0 - grid.originY) / grid.res) - n);
  const j1 = Math.min(ph - 1, Math.ceil((zone.y1 - grid.originY) / grid.res));
  let best = 0;
  let bestArea = 0;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const label = labels[j * pw + i];
      if (!label) continue;
      const area = overlapArea(squareRect(grid, n, i, j), zone);
      if (area >= need && area > bestArea) {
        bestArea = area;
        best = label;
      }
    }
  }
  return best;
}

/** Zones à garder accessibles par défaut : le dégagement frontal de chaque objet posé au sol qui en demande un. */
export function autoZones(grid) {
  return grid.objects
    .filter((o) => o.layer === 'floor' && o.clearanceFront > 0)
    .map((o) => ({ id: o.key, ...frontClearanceRect(o.footprint, o.clearanceFront) }));
}

/**
 * Contrôle de connexité après placement : un corps de `minWidth` (60 cm) de large doit pouvoir aller de chaque porte
 * (ou passage) de la pièce à toutes les zones libres importantes, sans toucher un mur, sa marge ni un objet.
 * Méthode : positions possibles d'un carré de 60 cm sur la grille de 10 cm (somme cumulée), puis remplissage 4-connexe.
 * - Une porte est « atteinte » si un corps libre se tient devant elle (à moins de 40 cm du mur, sur sa largeur).
 * - Zones importantes : `zones` (rectangles { id, x0, y0, x1, y1 }) ou, par défaut, le dégagement frontal des objets posés.
 *   Une zone est atteinte si un corps libre la recouvre au moins à moitié.
 * - Poche : espace libre où un corps tient mais qui n'est relié à aucune porte, d'au moins `pocketArea` m² de sol.
 * Par défaut (`relative: true`) on compare avec la pièce vide : ce qui est déjà inaccessible sans meuble (porte sur un
 * couloir de 50 cm, WC minuscule) n'est pas un défaut du placement ; seul ce que les objets ont rendu inaccessible en est un.
 * Avec `relative: false`, tout doit être accessible, dans une seule composante.
 * @param {RoomGrid} grid
 * @param {{ minWidth?: number, zones?: { id: string, x0: number, y0: number, x1: number, y1: number }[],
 *   pocketArea?: number, relative?: boolean }} [options]
 * @returns {{ ok: boolean, violations: { code: 'door-blocked' | 'doors-disconnected' | 'zone-unreachable' | 'zone-cut-off' | 'pocket', id?: string, areaM2?: number, at?: { x: number, y: number } }[],
 *   doors: { openingId: string, kind: string, reachable: boolean, blockedWhenEmpty: boolean }[],
 *   zones: { id: string, reachable: boolean, blockedWhenEmpty: boolean }[], minWidth: number }}
 */
export function checkConnectivity(grid, { minWidth = MIN_PASSAGE_WIDTH, zones = autoZones(grid), pocketArea = POCKET_AREA_M2, relative = true } = {}) {
  const n = Math.max(1, Math.ceil(minWidth / grid.res - 1e-9));
  const after = labelComponents(passablePositions(grid, n, true));
  let before = null;
  if (relative) {
    if (!grid._baseline.has(n)) grid._baseline.set(n, labelComponents(passablePositions(grid, n, false)));
    before = grid._baseline.get(n);
  }

  // Terminaux : portes puis zones, avec leur composante avant (pièce vide) et après.
  const terminals = [
    ...grid.doors.map((door) => ({
      type: 'door',
      id: door.openingId,
      door,
      before: before ? doorComponent(grid, before, door, DOOR_REACH_DEPTH) : 1,
      after: doorComponent(grid, after, door, DOOR_REACH_DEPTH),
    })),
    ...zones.map((zone) => ({
      type: 'zone',
      id: zone.id,
      zone,
      before: before ? zoneComponent(grid, before, zone) : 1,
      after: zoneComponent(grid, after, zone),
    })),
  ];

  const violations = [];
  const groups = new Map(); // composante de la pièce vide → terminaux accessibles
  for (const t of terminals) {
    if (t.before === 0) continue; // inaccessible même sans meuble
    if (t.after === 0) {
      violations.push({ code: t.type === 'door' ? 'door-blocked' : 'zone-unreachable', id: t.id });
      continue;
    }
    if (!groups.has(t.before)) groups.set(t.before, []);
    groups.get(t.before).push(t);
  }
  for (const list of groups.values()) {
    const reference = (list.find((t) => t.type === 'door') ?? list[0]).after;
    for (const t of list) {
      if (t.after !== reference) violations.push({ code: t.type === 'door' ? 'doors-disconnected' : 'zone-cut-off', id: t.id });
    }
  }

  // Poches : composantes sans porte, reliées à une porte quand la pièce est vide, assez grandes.
  const doorComps = new Set(terminals.filter((t) => t.type === 'door' && t.after > 0).map((t) => t.after));
  const baseDoorComps = new Set(terminals.filter((t) => t.type === 'door' && t.before > 0).map((t) => t.before));
  if (baseDoorComps.size > 0) {
    const members = new Map(); // composante → positions
    for (let p = 0; p < after.labels.length; p++) {
      const label = after.labels[p];
      if (!label || doorComps.has(label)) continue;
      const baseLabel = before ? before.labels[p] : 1; // mêmes positions possibles, mêmes indices
      if (!baseDoorComps.has(baseLabel)) continue;
      if (!members.has(label)) members.set(label, []);
      members.get(label).push(p);
    }
    const stamp = new Int32Array(grid.cols * grid.rows);
    let tag = 0;
    for (const positions of members.values()) {
      tag++;
      let cells = 0;
      for (const p of positions) {
        const i = p % after.pw;
        const j = (p - i) / after.pw;
        for (let dj = 0; dj < n; dj++) {
          for (let di = 0; di < n; di++) {
            const idx = (j + dj) * grid.cols + i + di;
            if (stamp[idx] !== tag) {
              stamp[idx] = tag;
              cells++;
            }
          }
        }
      }
      const areaM2 = r6(cells * grid.res * grid.res);
      if (areaM2 >= pocketArea) {
        const first = positions[0];
        const i = first % after.pw;
        violations.push({ code: 'pocket', areaM2, at: cellCenter(grid, i + (n - 1) / 2, (first - i) / after.pw + (n - 1) / 2) });
      }
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    doors: terminals.filter((t) => t.type === 'door').map((t) => ({ openingId: t.id, kind: t.door.kind, reachable: t.after > 0, blockedWhenEmpty: t.before === 0 })),
    zones: terminals.filter((t) => t.type === 'zone').map((t) => ({ id: t.id, reachable: t.after > 0, blockedWhenEmpty: t.before === 0 })),
    minWidth,
  };
}

/* ------------------------------------------------------------------ */
/* 6. Génération d'une pièce : recettes, candidats, scores, groupes   */
/* ------------------------------------------------------------------ */

const DEFS = new Map(FURNITURE_DATA.map((def) => [def.id, def]));

/** On tire au hasard parmi les K meilleurs candidats. */
export const TOP_K = 3;
/** Écart de score maximal entre le meilleur candidat et les autres candidats retenus pour le tirage. */
export const TOP_MARGIN = 1.5;
/** Nombre d'essais (sous-graines) avant de supprimer les objets optionnels. */
export const MAX_ATTEMPTS = 20;
/** Nombre d'emplacements d'ancre simulés avec leur groupe avant de choisir. */
const GROUP_ANCHOR_CANDIDATES = 5;
/** Densité du décor selon le style : multiplie la chance des objets facultatifs. */
export const STYLE_DENSITY = Object.freeze({ scandinave: 0.9, moderne: 0.7, industriel: 0.8, classique: 1.1, boheme: 1.3 });

const choice = (id, weight = 1, minArea = 0) => ({ id, weight, minArea });

/** Briques de recettes communes à plusieurs types de pièces. */
const frameSlot = (chance, extra = {}) => ({ slot: 'frame', choices: [choice('frame-large', 1, 10), choice('frame-small', 2)], min: 0, max: 2, chance, priority: 8, strategy: 'wall-spot', rules: [['centered', 1], ['away-door', 0.5]], ...extra });
const ceilingSlot = (target, choices = [choice('ceiling-light')]) => ({ slot: 'ceiling-light', choices, min: 1, max: 1, priority: 10, strategy: 'ceiling', ...(target ? { target } : {}) });
/** Petits objets posés sur un meuble ou une table (livres, vase, bougies, corbeille de fruits) ; `center` : au milieu du plateau. */
const tabletopSlot = (chance, hosts, center = false) => ({ slot: 'tabletop', choices: [choice('vase', 2), choice('books', 2), choice('candles', 1), choice('fruit-bowl', 1)], min: 0, max: 1, chance, priority: 7, strategy: 'on-top', hosts, ...(center ? { center } : {}) });
/** Radiateur sous une fenêtre. */
const radiatorSlot = (chance) => ({ slot: 'radiator', choices: [choice('radiator')], min: 0, max: 1, chance, priority: 8, strategy: 'under-window' });
/** Store à la fenêtre (les rideaux sont réservés aux salons et chambres). */
const blindsSlot = (chance) => ({ slot: 'blinds', choices: [choice('blinds')], min: 0, max: 2, chance, priority: 9, strategy: 'at-window' });
/** Décor mural varié : étagère, horloge, miroir rond, applique. */
const wallExtraSlot = (chance, ids = ['wall-shelf', 'wall-clock', 'mirror-round', 'wall-sconce']) => ({ slot: 'wall-extra', choices: ids.map((id) => choice(id)), min: 0, max: 1, chance, priority: 8, strategy: 'wall-spot', rules: [['centered', 1], ['away-door', 0.5]] });
const plantSlot = (chance, max = 1, minArea = 6, small = false) => ({
  slot: 'plant-corner',
  choices: small ? [choice('plant-small', 1, minArea)] : [choice('plant-medium', 2, minArea), choice('plant-tall', 1, minArea + 6)],
  min: 0,
  max,
  chance,
  priority: 6,
  strategy: 'corner',
  rules: [['away-door', 1], ['window-soft', 0.5]],
});

/**
 * Recettes par type de pièce. Une recette est une liste d'« emplacements » (slots) :
 * - `slot` : nom du rôle (sofa, bed…), `choices` : objets possibles { id, weight, minArea (surface de la pièce, m²) } ;
 * - `min` / `max` : nombre d'exemplaires ; au-delà de `min`, chaque exemplaire est facultatif et tiré avec la probabilité
 *   `chance` × densité du style ; `priority` : ordre de placement (1 d'abord) ; à priorité égale, du plus grand au plus petit ;
 * - `strategy` : où chercher les candidats (wall, corner, free-center, wall-spot, front-of, flank, under, bed-sides, tucked,
 *   on-top, above-host, at-window, ceiling, foot-of, under-window, park) ; `rules` : règles de score [nom, poids] (voir RULES) ;
 * - `group` : le slot fait partie d'un groupe (`groups[groupe].anchor` = slot qui sert d'ancre) : l'ancre et ses membres sont
 *   placés comme une unité, les membres se placent par rapport à l'ancre ;
 * - `access` : le dégagement frontal doit rester atteignable (contrôle de circulation) ; `hosts` : rôles qui portent l'objet ;
 *   `perAnchor` : nombre maximal d'exemplaires selon l'ancre ; `clearance` : 'both' | 'own' | false (voir checkPlacement) ;
 * - 6c : `planner` (recette) : fonction qui pose des modules avant les slots (cuisine) ; `decor` (ajouté) : passe de décoration ;
 *   `unless` : rôles dont la présence supprime le slot ; `lift` : accroché à `lift` m au-dessus de l'hôte (miroir au-dessus d'une console).
 */
const RAW_RECIPES = {
  living: Object.freeze({
    type: 'living',
    groups: Object.freeze({ seating: Object.freeze({ anchor: 'sofa' }) }),
    slots: Object.freeze([
      { slot: 'sofa', group: 'seating', choices: [choice('sofa-3', 3, 11), choice('sofa-2', 2, 4), choice('sofa-corner', 2, 16), choice('sofa-bed', 1, 10)], min: 1, max: 1, priority: 2, strategy: 'wall', rules: [['face-partner:tv-unit', 3], ['centered', 1], ['away-door', 0.5], ['window-soft', 1]] },
      { slot: 'coffee-table', group: 'seating', choices: [choice('coffee-table', 1, 7)], min: 0, max: 1, chance: 0.9, priority: 2, strategy: 'front-of' },
      { slot: 'armchair', group: 'seating', choices: [choice('armchair', 2, 13), choice('pouf', 1, 12)], min: 0, max: 2, chance: 0.45, priority: 3, strategy: 'flank' },
      { slot: 'rug', group: 'seating', choices: [choice('rug-m', 1, 9), choice('rug-l', 1, 14)], min: 0, max: 1, chance: 0.6, priority: 4, strategy: 'under' },
      { slot: 'frame-over-sofa', group: 'seating', choices: [choice('frame-large', 2), choice('frame-small', 1), choice('wall-shelf', 1), choice('mirror-round', 1)], min: 0, max: 1, chance: 0.55, priority: 5, strategy: 'above-host', hosts: ['sofa'] },
      { slot: 'tv-unit', choices: [choice('tv-unit')], min: 1, max: 1, priority: 1, strategy: 'wall', clearance: false, rules: [['faces-room', 3], ['centered', 1.5], ['window-soft', 1], ['away-door', 0.3]] },
      { slot: 'bookcase', choices: [choice('bookcase', 2, 10), choice('bookcase-narrow', 1, 8), choice('display-cabinet', 1, 14)], min: 0, max: 2, chance: 0.5, priority: 3, strategy: 'wall', access: true, rules: [['away-door', 0.5], ['window-soft', 1], ['centered', 0.2]] },
      { slot: 'console', choices: [choice('console', 2, 10), choice('sideboard', 1, 14)], min: 0, max: 1, chance: 0.35, priority: 4, strategy: 'wall', access: true, rules: [['centered', 1], ['away-door', 0.5], ['window-soft', 1]] },
      { slot: 'side-table', choices: [choice('side-table', 1, 9)], min: 0, max: 1, chance: 0.4, priority: 4, strategy: 'wall', rules: [['near-role:sofa', 2], ['away-door', 0.5]] },
      { slot: 'stove', choices: [choice('stove', 1, 17)], min: 0, max: 1, chance: 0.15, priority: 4, strategy: 'corner', rules: [['away-door', 0.5], ['window-soft', 1]] },
      { slot: 'floor-lamp', choices: [choice('floor-lamp', 1, 8)], min: 0, max: 1, chance: 0.55, priority: 5, strategy: 'corner', rules: [['near-role:sofa', 2], ['away-door', 0.5]] },
      { slot: 'plant-corner', choices: [choice('plant-tall', 1, 12), choice('plant-medium', 2, 6)], min: 0, max: 2, chance: 0.45, priority: 6, strategy: 'corner', rules: [['away-door', 1], ['window-soft', 0.5]] },
      { slot: 'basket', choices: [choice('blanket-basket', 1, 10)], min: 0, max: 1, chance: 0.3, priority: 6, strategy: 'corner', rules: [['near-role:sofa', 1], ['away-door', 0.5]] },
      { slot: 'decor-on-top', choices: [choice('table-lamp', 2), choice('plant-small', 1)], min: 0, max: 2, chance: 0.5, priority: 7, strategy: 'on-top', hosts: ['console', 'coffee-table', 'bookcase', 'side-table'] },
      tabletopSlot(0.6, ['coffee-table', 'console', 'tv-unit', 'bookcase']),
      frameSlot(0.4),
      wallExtraSlot(0.3),
      radiatorSlot(0.5),
      { slot: 'curtains', choices: [choice('curtains', 3), choice('blinds', 1)], min: 0, max: 4, chance: 0.75, priority: 9, strategy: 'at-window' },
      ceilingSlot(['coffee-table', 'sofa'], [choice('ceiling-light', 3), choice('pendant-light', 1, 9)]),
    ]),
  }),
  bedroom: Object.freeze({
    type: 'bedroom',
    groups: Object.freeze({ sleeping: Object.freeze({ anchor: 'bed' }), working: Object.freeze({ anchor: 'desk' }) }),
    slots: Object.freeze([
      { slot: 'bed', group: 'sleeping', choices: [choice('bed-double', 3, 8), choice('bed-single', 1, 3.5), choice('bed-king', 2, 22)], min: 1, max: 1, priority: 1, strategy: 'wall', rules: [['bed-wall', 3], ['side-access', 1.5], ['away-door', 0.4]] },
      { slot: 'nightstand', group: 'sleeping', choices: [choice('nightstand')], min: 0, max: 2, chance: 1, priority: 2, strategy: 'bed-sides', perAnchor: { 'bed-double': 2, 'bed-king': 2, 'bed-single': 1 } },
      { slot: 'bed-lamp', group: 'sleeping', choices: [choice('table-lamp')], min: 0, max: 2, chance: 0.75, priority: 3, strategy: 'on-top', hosts: ['nightstand'] },
      { slot: 'bed-bench', group: 'sleeping', choices: [choice('bed-bench', 1, 12)], min: 0, max: 1, chance: 0.4, priority: 3, strategy: 'foot-of', perAnchor: { 'bed-single': 0 } },
      { slot: 'rug', group: 'sleeping', choices: [choice('rug-m', 1, 9), choice('rug-l', 1, 13)], min: 0, max: 1, chance: 0.5, priority: 4, strategy: 'under' },
      { slot: 'frame-over-bed', group: 'sleeping', choices: [choice('frame-large', 2), choice('frame-small', 1), choice('wall-shelf', 1), choice('mirror-round', 1)], min: 0, max: 1, chance: 0.55, priority: 5, strategy: 'above-host', hosts: ['bed'] },
      { slot: 'wardrobe', choices: [choice('wardrobe', 3), choice('wardrobe-3', 2, 12), choice('open-wardrobe', 1, 9)], min: 1, max: 1, priority: 2, strategy: 'wall', access: true, rules: [['away-door', 0.3], ['window-soft', 1], ['centered', 0.3]] },
      { slot: 'desk', group: 'working', choices: [choice('desk', 2, 11), choice('desk-large', 1, 15)], min: 0, max: 1, chance: 0.3, priority: 3, strategy: 'wall', rules: [['desk-window', 1.5], ['away-door', 0.3]] },
      { slot: 'chair', group: 'working', choices: [choice('office-chair')], min: 0, max: 1, chance: 1, priority: 2, strategy: 'tucked' },
      { slot: 'dresser', choices: [choice('dresser', 2, 10), choice('chest-drawers', 1, 8)], min: 0, max: 1, chance: 0.55, priority: 4, strategy: 'wall', access: true, rules: [['centered', 0.7], ['away-door', 0.4], ['window-soft', 1]] },
      { slot: 'dressing-table', choices: [choice('dressing-table', 1, 11)], min: 0, max: 1, chance: 0.25, priority: 4, strategy: 'wall', rules: [['desk-window', 1], ['away-door', 0.4]] },
      { slot: 'armchair', choices: [choice('armchair', 1, 14)], min: 0, max: 1, chance: 0.3, priority: 5, strategy: 'corner', rules: [['faces-room', 1.5], ['away-door', 0.5], ['window-soft', 1]] },
      { slot: 'standing-mirror', choices: [choice('standing-mirror', 1, 9)], min: 0, max: 1, chance: 0.3, priority: 5, strategy: 'wall', rules: [['away-door', 0.5], ['window-soft', 1]] },
      { slot: 'floor-lamp', choices: [choice('floor-lamp', 1, 9)], min: 0, max: 1, chance: 0.35, priority: 6, strategy: 'corner', rules: [['away-door', 0.5]] },
      { slot: 'plant-corner', choices: [choice('plant-medium', 2, 6), choice('plant-tall', 1, 12)], min: 0, max: 1, chance: 0.4, priority: 6, strategy: 'corner', rules: [['away-door', 1], ['window-soft', 0.5]] },
      { slot: 'decor-on-top', choices: [choice('table-lamp', 2), choice('plant-small', 1)], min: 0, max: 1, chance: 0.4, priority: 7, strategy: 'on-top', hosts: ['dresser', 'desk', 'dressing-table'] },
      tabletopSlot(0.5, ['dresser', 'nightstand']),
      { slot: 'computer', choices: [choice('computer')], min: 0, max: 1, chance: 0.6, priority: 7, strategy: 'on-top', hosts: ['desk'], center: true },
      frameSlot(0.35),
      wallExtraSlot(0.25),
      radiatorSlot(0.5),
      { slot: 'curtains', choices: [choice('curtains', 3), choice('blinds', 1)], min: 0, max: 4, chance: 0.75, priority: 9, strategy: 'at-window' },
      ceilingSlot(['bed']),
    ]),
  }),
  dining: Object.freeze({
    type: 'dining',
    groups: Object.freeze({ dining: Object.freeze({ anchor: 'dining-table' }) }),
    slots: Object.freeze([
      { slot: 'dining-table', group: 'dining', choices: [choice('dining-table-4', 3, 6), choice('dining-table-6', 2, 15), choice('dining-table-round', 2, 8)], min: 1, max: 1, priority: 1, strategy: 'free-center', rotations: [0, 90], access: true, rules: [['center-free', 2.5], ['long-axis', 1.5], ['ring-free', 2], ['away-door', 0.5]] },
      { slot: 'rug', group: 'dining', choices: [choice('rug-l', 1, 12)], min: 0, max: 1, chance: 0.5, priority: 2, strategy: 'under' },
      { slot: 'buffet', choices: [choice('buffet', 2, 9), choice('sideboard-small', 1, 6)], min: 0, max: 1, chance: 0.8, priority: 2, strategy: 'wall', access: true, rules: [['centered', 1.5], ['away-door', 0.5], ['window-soft', 1]] },
      { slot: 'display-cabinet', choices: [choice('display-cabinet', 1, 12)], min: 0, max: 1, chance: 0.35, priority: 3, strategy: 'wall', access: true, rules: [['away-door', 0.5], ['window-soft', 1]] },
      { slot: 'frame-over-buffet', choices: [choice('frame-large', 2), choice('frame-small', 1), choice('mirror-round', 1), choice('wall-clock', 1)], min: 0, max: 1, chance: 0.6, priority: 3, strategy: 'above-host', hosts: ['buffet'] },
      { slot: 'decor-on-top', choices: [choice('table-lamp', 1), choice('plant-small', 1)], min: 0, max: 1, chance: 0.6, priority: 4, strategy: 'on-top', hosts: ['buffet'] },
      tabletopSlot(0.7, ['dining-table', 'buffet'], true),
      { slot: 'plant-corner', choices: [choice('plant-medium', 2, 6), choice('plant-tall', 1, 12)], min: 0, max: 2, chance: 0.5, priority: 5, strategy: 'corner', rules: [['away-door', 1], ['window-soft', 0.5]] },
      frameSlot(0.35, { priority: 6 }),
      wallExtraSlot(0.25),
      radiatorSlot(0.4),
      blindsSlot(0.3),
      ceilingSlot(['dining-table'], [choice('ceiling-light', 2), choice('pendant-light', 3)]),
    ]),
  }),
  kitchen: Object.freeze({
    type: 'kitchen',
    planner: 'kitchen', // les modules (meubles bas, évier, plaque, frigo, lave-vaisselle, colonne four, meubles hauts, hotte) sont posés par planKitchen
    groups: Object.freeze({}),
    slots: Object.freeze([
      { slot: 'island', choices: [choice('kitchen-island', 1, 12)], min: 0, max: 1, chance: 0.85, priority: 2, strategy: 'free-center', access: true, rules: [['face-partner:kitchen-base', 2], ['ring-clear:0.9', 1], ['center-free', 1.5]] },
      { slot: 'bar-stool', choices: [choice('bar-stool')], min: 0, max: 3, chance: 0.8, priority: 3, strategy: 'island-stools' },
      { slot: 'dining-table', choices: [choice('dining-table-4', 1, 14), choice('kitchen-table-2', 2, 7), choice('dining-table-round', 1, 12)], min: 0, max: 1, chance: 0.5, priority: 4, strategy: 'free-center', rotations: [0, 90], unless: ['island'], access: true, rules: [['center-free', 2], ['ring-free', 2], ['away-door', 0.5]] },
      { slot: 'trash', choices: [choice('trash-bin', 1, 5)], min: 0, max: 1, chance: 0.6, priority: 5, strategy: 'wall', rules: [['near-role:kitchen-sink', 2], ['away-door', 0.5]] },
      { slot: 'microwave', choices: [choice('microwave')], min: 0, max: 1, chance: 0.45, priority: 7, strategy: 'on-top', hosts: ['kitchen-base'] },
      tabletopSlot(0.5, ['island', 'dining-table']),
      plantSlot(0.3, 1, 8, true),
      frameSlot(0.3),
      wallExtraSlot(0.15, ['wall-clock']),
      blindsSlot(0.5),
      ceilingSlot(['island', 'dining-table'], [choice('ceiling-light', 3), choice('pendant-light', 1, 8)]),
    ]),
  }),
  bathroom: Object.freeze({
    type: 'bathroom',
    groups: Object.freeze({}),
    slots: Object.freeze([
      { slot: 'bath', choices: [choice('bathtub', 3, 5), choice('shower', 3, 2.5)], min: 1, max: 1, priority: 1, strategy: 'corner', access: true, rules: [['away-door', 0.8], ['window-soft', 0.5]] },
      { slot: 'vanity', choices: [choice('vanity', 3), choice('vanity-double', 1, 7)], min: 1, max: 1, priority: 2, strategy: 'wall', access: true, rules: [['away-door', 0.3], ['centered', 0.8], ['window-soft', 1]] },
      { slot: 'toilet', choices: [choice('toilet')], min: 1, max: 1, priority: 3, strategy: 'wall', access: true, rules: [['away-door', 0.8], ['window-soft', 0.5]] },
      { slot: 'shower-extra', choices: [choice('shower', 1, 8)], min: 0, max: 1, chance: 0.5, priority: 4, strategy: 'corner', access: true, rules: [['away-door', 0.5]] },
      { slot: 'washer', choices: [choice('washer', 1, 6)], min: 0, max: 1, chance: 0.25, priority: 5, strategy: 'wall', access: true, rules: [['away-door', 0.5]] },
      { slot: 'column-cabinet', choices: [choice('column-cabinet', 1, 4)], min: 0, max: 1, chance: 0.5, priority: 5, strategy: 'wall', rules: [['away-door', 0.4], ['window-soft', 1]] },
      { slot: 'laundry-basket', choices: [choice('laundry-basket', 1, 4)], min: 0, max: 1, chance: 0.5, priority: 6, strategy: 'wall', rules: [['away-door', 0.6]] },
      { slot: 'towel-radiator', choices: [choice('towel-radiator')], min: 0, max: 1, chance: 0.6, priority: 6, strategy: 'wall-spot', rules: [['away-door', 0.5], ['centered', 0.3]] },
      { slot: 'wc-cabinet', choices: [choice('wc-cabinet')], min: 0, max: 1, chance: 0.3, priority: 6, strategy: 'above-host', hosts: ['toilet'] },
      { slot: 'toilet-brush', choices: [choice('toilet-brush')], min: 0, max: 1, chance: 0.5, priority: 6, strategy: 'corner', rules: [['near-role:toilet', 3]] },
      plantSlot(0.3, 1, 4, true),
      blindsSlot(0.4),
      ceilingSlot(),
    ]),
  }),
  toilet: Object.freeze({
    type: 'toilet',
    groups: Object.freeze({}),
    slots: Object.freeze([
      { slot: 'toilet', choices: [choice('toilet')], min: 1, max: 1, priority: 1, strategy: 'wall', access: true, rules: [['away-door', 0.6], ['centered', 0.3]] },
      { slot: 'handbasin', choices: [choice('handbasin')], min: 0, max: 1, chance: 0.9, priority: 2, strategy: 'wall', access: true, rules: [['near-role:toilet', 1], ['away-door', 0.3]] },
      { slot: 'wc-cabinet', choices: [choice('wc-cabinet')], min: 0, max: 1, chance: 0.4, priority: 6, strategy: 'above-host', hosts: ['toilet'] },
      { slot: 'toilet-brush', choices: [choice('toilet-brush')], min: 0, max: 1, chance: 0.5, priority: 6, strategy: 'corner', rules: [['near-role:toilet', 3]] },
      frameSlot(0.25, { choices: [choice('frame-small')], max: 1 }),
      ceilingSlot(),
    ]),
  }),
  office: Object.freeze({
    type: 'office',
    groups: Object.freeze({ working: Object.freeze({ anchor: 'desk' }) }),
    slots: Object.freeze([
      { slot: 'desk', group: 'working', choices: [choice('desk', 2), choice('desk-large', 1, 10)], min: 1, max: 1, priority: 1, strategy: 'wall', rules: [['desk-window', 1.5], ['centered', 0.5], ['away-door', 0.4]] },
      { slot: 'chair', group: 'working', choices: [choice('office-chair')], min: 1, max: 1, priority: 2, strategy: 'tucked' },
      { slot: 'rug', group: 'working', choices: [choice('rug-m', 1, 9)], min: 0, max: 1, chance: 0.45, priority: 4, strategy: 'under' },
      { slot: 'shelf', choices: [choice('shelf-unit', 2), choice('bookcase', 2, 9), choice('bookcase-narrow', 1, 6)], min: 0, max: 2, chance: 0.7, priority: 2, strategy: 'wall', access: true, rules: [['away-door', 0.5], ['window-soft', 1], ['centered', 0.3]] },
      { slot: 'drawer-unit', choices: [choice('drawer-unit', 1, 7)], min: 0, max: 1, chance: 0.4, priority: 3, strategy: 'wall', rules: [['near-role:desk', 2], ['away-door', 0.4]] },
      { slot: 'filing-cabinet', choices: [choice('filing-cabinet', 1, 8)], min: 0, max: 1, chance: 0.35, priority: 3, strategy: 'wall', access: true, rules: [['near-role:desk', 1], ['away-door', 0.4], ['window-soft', 1]] },
      { slot: 'sofa-bed', choices: [choice('sofa-bed', 1, 13)], min: 0, max: 1, chance: 0.15, priority: 3, strategy: 'wall', rules: [['faces-room', 1], ['away-door', 0.5], ['window-soft', 1]] },
      { slot: 'armchair', choices: [choice('armchair', 1, 11)], min: 0, max: 1, chance: 0.3, priority: 5, strategy: 'corner', rules: [['faces-room', 1.5], ['away-door', 0.5], ['window-soft', 1]] },
      { slot: 'floor-lamp', choices: [choice('floor-lamp', 1, 8)], min: 0, max: 1, chance: 0.4, priority: 6, strategy: 'corner', rules: [['away-door', 0.5]] },
      plantSlot(0.45, 1, 6),
      { slot: 'decor-on-top', choices: [choice('table-lamp', 2), choice('plant-small', 1)], min: 0, max: 1, chance: 0.6, priority: 7, strategy: 'on-top', hosts: ['desk'] },
      { slot: 'computer', choices: [choice('computer')], min: 0, max: 1, chance: 0.85, priority: 7, strategy: 'on-top', hosts: ['desk'], center: true },
      { slot: 'board', choices: [choice('board')], min: 0, max: 1, chance: 0.4, priority: 8, strategy: 'above-host', hosts: ['desk'] },
      frameSlot(0.5),
      wallExtraSlot(0.25),
      radiatorSlot(0.5),
      blindsSlot(0.5),
      ceilingSlot(),
    ]),
  }),
  entrance: Object.freeze({
    type: 'entrance',
    groups: Object.freeze({}),
    slots: Object.freeze([
      { slot: 'console', choices: [choice('console', 1, 3)], min: 0, max: 1, chance: 0.8, priority: 1, strategy: 'wall', access: true, rules: [['centered', 1], ['away-door', 0.3], ['window-soft', 1]] },
      { slot: 'bench', choices: [choice('bench', 1, 4)], min: 0, max: 1, chance: 0.6, priority: 2, strategy: 'wall', access: true, rules: [['away-door', 0.3], ['window-soft', 1]] },
      { slot: 'shoe-cabinet', choices: [choice('shoe-cabinet', 1, 3.5)], min: 0, max: 1, chance: 0.6, priority: 2, strategy: 'wall', access: true, rules: [['away-door', 0.3], ['window-soft', 1]] },
      { slot: 'coat-rack', choices: [choice('coat-rack', 1, 3)], min: 0, max: 1, chance: 0.8, priority: 3, strategy: 'corner', rules: [['away-door', 0.5]] },
      { slot: 'wardrobe', choices: [choice('wardrobe', 1, 7)], min: 0, max: 1, chance: 0.3, priority: 4, strategy: 'wall', access: true, rules: [['away-door', 0.3], ['window-soft', 1]] },
      { slot: 'umbrella-stand', choices: [choice('umbrella-stand', 1, 3)], min: 0, max: 1, chance: 0.4, priority: 5, strategy: 'corner', rules: [['near-role:coat-rack', 1], ['away-door', 0.5]] },
      { slot: 'mirror', choices: [choice('mirror', 2), choice('mirror-round', 1)], min: 0, max: 1, chance: 0.7, priority: 5, strategy: 'above-host', hosts: ['console', 'bench', 'shoe-cabinet'], lift: 0.15 },
      { slot: 'wall-hooks', choices: [choice('wall-hooks')], min: 0, max: 1, chance: 0.5, priority: 6, strategy: 'wall-spot', rules: [['near-role:coat-rack', 1], ['away-door', 0.3]] },
      { slot: 'decor-on-top', choices: [choice('table-lamp', 2), choice('plant-small', 1)], min: 0, max: 1, chance: 0.6, priority: 7, strategy: 'on-top', hosts: ['console', 'bench', 'shoe-cabinet'] },
      tabletopSlot(0.4, ['console']),
      plantSlot(0.4, 1, 5),
      frameSlot(0.4),
      wallExtraSlot(0.2, ['wall-clock']),
      ceilingSlot(),
    ]),
  }),
  laundry: Object.freeze({
    type: 'laundry',
    groups: Object.freeze({}),
    slots: Object.freeze([
      { slot: 'washer', choices: [choice('washer')], min: 1, max: 2, chance: 0.4, priority: 1, strategy: 'wall', access: true, rules: [['near-role:washer', 1.5], ['away-door', 0.5], ['window-soft', 0.3]] },
      { slot: 'dryer', choices: [choice('dryer')], min: 0, max: 1, chance: 0.6, priority: 1, strategy: 'wall', access: true, rules: [['near-role:washer', 2], ['away-door', 0.5], ['window-soft', 0.3]] },
      { slot: 'utility-sink', choices: [choice('utility-sink', 1, 3)], min: 0, max: 1, chance: 0.6, priority: 2, strategy: 'wall', access: true, rules: [['near-role:washer', 0.5], ['away-door', 0.4], ['window-soft', 0.5]] },
      { slot: 'shelf-unit', choices: [choice('shelf-unit')], min: 0, max: 2, chance: 0.8, priority: 2, strategy: 'wall', access: true, rules: [['near-role:washer', 0.5], ['away-door', 0.3], ['window-soft', 1]] },
      { slot: 'broom-cupboard', choices: [choice('broom-cupboard', 1, 3)], min: 0, max: 1, chance: 0.5, priority: 3, strategy: 'wall', access: true, rules: [['away-door', 0.4], ['window-soft', 1]] },
      { slot: 'water-heater', choices: [choice('water-heater', 1, 3)], min: 0, max: 1, chance: 0.3, priority: 3, strategy: 'corner', rules: [['away-door', 0.5], ['window-soft', 1]] },
      { slot: 'freezer-chest', choices: [choice('freezer-chest', 1, 5)], min: 0, max: 1, chance: 0.25, priority: 3, strategy: 'wall', access: true, rules: [['away-door', 0.4], ['window-soft', 1]] },
      { slot: 'drying-rack', choices: [choice('drying-rack', 1, 5)], min: 0, max: 1, chance: 0.4, priority: 4, strategy: 'free-center', rotations: [0, 90], rules: [['center-free', 1], ['ring-free', 1], ['away-door', 0.5]] },
      { slot: 'laundry-basket', choices: [choice('laundry-basket')], min: 0, max: 1, chance: 0.6, priority: 6, strategy: 'wall', rules: [['near-role:washer', 1], ['away-door', 0.5]] },
      blindsSlot(0.3),
      ceilingSlot(),
    ]),
  }),
  hallway: Object.freeze({
    type: 'hallway',
    groups: Object.freeze({}),
    slots: Object.freeze([
      { slot: 'console', choices: [choice('console', 1, 5)], min: 0, max: 1, chance: 0.5, priority: 1, strategy: 'wall', access: true, rules: [['centered', 1], ['away-door', 0.3]] },
      { slot: 'bench', choices: [choice('bench', 1, 6)], min: 0, max: 1, chance: 0.3, priority: 2, strategy: 'wall', access: true, rules: [['away-door', 0.3]] },
      { slot: 'bookcase', choices: [choice('bookcase-narrow', 1, 6)], min: 0, max: 1, chance: 0.25, priority: 3, strategy: 'wall', access: true, rules: [['away-door', 0.4], ['window-soft', 1]] },
      { slot: 'mirror', choices: [choice('mirror', 2, 4), choice('mirror-round', 1, 4)], min: 0, max: 1, chance: 0.4, priority: 5, strategy: 'wall-spot', rules: [['centered', 1], ['away-door', 0.5]] },
      plantSlot(0.4, 1, 6),
      tabletopSlot(0.4, ['console']),
      frameSlot(0.6, { max: 3, choices: [choice('frame-small', 2), choice('frame-large', 1, 6)] }),
      wallExtraSlot(0.3, ['wall-clock', 'wall-shelf', 'wall-sconce']),
      radiatorSlot(0.3),
      ceilingSlot(),
    ]),
  }),

  /* --- Familles « enfants », « rangement », « garage et atelier » ------------------------------------------ */
  kidsroom: Object.freeze({
    type: 'kidsroom',
    groups: Object.freeze({ sleeping: Object.freeze({ anchor: 'bed' }), working: Object.freeze({ anchor: 'desk' }) }),
    slots: Object.freeze([
      { slot: 'bed', group: 'sleeping', choices: [choice('bed-single', 3, 3.5), choice('bunk-bed', 2, 7), choice('baby-bed', 1, 3.5)], min: 1, max: 1, priority: 1, strategy: 'wall', rules: [['bed-wall', 2], ['side-access', 1], ['away-door', 0.4]] },
      { slot: 'nightstand', group: 'sleeping', choices: [choice('nightstand')], min: 0, max: 1, chance: 0.6, priority: 2, strategy: 'bed-sides', perAnchor: { 'bed-single': 1, 'bunk-bed': 0, 'baby-bed': 0 } },
      { slot: 'bed-lamp', group: 'sleeping', choices: [choice('table-lamp')], min: 0, max: 1, chance: 0.6, priority: 3, strategy: 'on-top', hosts: ['nightstand'] },
      { slot: 'rug', group: 'sleeping', choices: [choice('rug-s', 1, 4), choice('rug-m', 1, 9)], min: 0, max: 1, chance: 0.6, priority: 4, strategy: 'under' },
      { slot: 'wardrobe', choices: [choice('wardrobe', 2), choice('open-wardrobe', 1, 8)], min: 0, max: 1, chance: 0.9, priority: 2, strategy: 'wall', access: true, rules: [['away-door', 0.3], ['window-soft', 1], ['centered', 0.3]] },
      { slot: 'desk', group: 'working', choices: [choice('kids-desk', 3), choice('desk', 1, 11)], min: 0, max: 1, chance: 0.7, priority: 3, strategy: 'wall', rules: [['desk-window', 1.5], ['away-door', 0.3]] },
      { slot: 'chair', group: 'working', choices: [choice('chair')], min: 0, max: 1, chance: 1, priority: 2, strategy: 'tucked' },
      { slot: 'toy-box', choices: [choice('toy-box')], min: 0, max: 1, chance: 0.8, priority: 3, strategy: 'wall', rules: [['away-door', 0.4], ['window-soft', 0.5]] },
      { slot: 'shelf-low', choices: [choice('shelf-low', 1, 5), choice('bookcase-narrow', 1, 9)], min: 0, max: 1, chance: 0.7, priority: 3, strategy: 'wall', access: true, rules: [['away-door', 0.4], ['window-soft', 1]] },
      { slot: 'teepee', choices: [choice('teepee', 1, 8)], min: 0, max: 1, chance: 0.4, priority: 4, strategy: 'corner', rules: [['away-door', 0.5], ['window-soft', 0.5]] },
      { slot: 'pouf', choices: [choice('pouf', 1, 8)], min: 0, max: 1, chance: 0.3, priority: 5, strategy: 'corner', rules: [['away-door', 0.5]] },
      { slot: 'decor-on-top', choices: [choice('table-lamp', 2), choice('plant-small', 1)], min: 0, max: 1, chance: 0.4, priority: 7, strategy: 'on-top', hosts: ['shelf-low', 'desk'] },
      { slot: 'frame', choices: [choice('frame-small', 2), choice('frame-large', 1, 9)], min: 0, max: 3, chance: 0.5, priority: 8, strategy: 'wall-spot', rules: [['centered', 1], ['away-door', 0.5]] },
      wallExtraSlot(0.25, ['wall-clock', 'wall-shelf']),
      radiatorSlot(0.5),
      { slot: 'curtains', choices: [choice('curtains')], min: 0, max: 4, chance: 0.8, priority: 9, strategy: 'at-window' },
      ceilingSlot(['bed']),
    ]),
  }),
  dressing: Object.freeze({
    type: 'dressing',
    groups: Object.freeze({}),
    slots: Object.freeze([
      { slot: 'wardrobe', choices: [choice('wardrobe-3', 3, 4), choice('wardrobe', 2), choice('open-wardrobe', 2, 4)], min: 1, max: 3, chance: 0.75, priority: 1, strategy: 'wall', access: true, rules: [['away-door', 0.3], ['window-soft', 1], ['near-role:wardrobe', 0.5]] },
      { slot: 'dresser', choices: [choice('chest-drawers', 2), choice('dresser', 1, 6)], min: 0, max: 1, chance: 0.6, priority: 2, strategy: 'wall', access: true, rules: [['away-door', 0.4], ['window-soft', 1]] },
      { slot: 'dressing-table', choices: [choice('dressing-table', 1, 5)], min: 0, max: 1, chance: 0.4, priority: 3, strategy: 'wall', rules: [['desk-window', 1], ['away-door', 0.4]] },
      { slot: 'standing-mirror', choices: [choice('standing-mirror')], min: 0, max: 1, chance: 0.8, priority: 3, strategy: 'wall', rules: [['away-door', 0.5], ['window-soft', 1]] },
      { slot: 'bench', choices: [choice('bed-bench', 2, 5), choice('pouf', 1, 5)], min: 0, max: 1, chance: 0.5, priority: 4, strategy: 'free-center', rotations: [0, 90], rules: [['center-free', 1], ['ring-free', 1]] },
      { slot: 'laundry-basket', choices: [choice('laundry-basket')], min: 0, max: 1, chance: 0.4, priority: 6, strategy: 'wall', rules: [['away-door', 0.5]] },
      plantSlot(0.3, 1, 5, true),
      { slot: 'decor-on-top', choices: [choice('table-lamp', 2), choice('plant-small', 1)], min: 0, max: 1, chance: 0.4, priority: 7, strategy: 'on-top', hosts: ['dresser', 'dressing-table'] },
      tabletopSlot(0.4, ['dresser']),
      frameSlot(0.3),
      blindsSlot(0.4),
      ceilingSlot(),
    ]),
  }),
  pantry: Object.freeze({
    type: 'pantry',
    groups: Object.freeze({}),
    slots: Object.freeze([
      { slot: 'shelving', choices: [choice('metal-shelving')], min: 1, max: 3, chance: 0.7, priority: 1, strategy: 'wall', access: true, rules: [['away-door', 0.4], ['window-soft', 1], ['centered', 0.2]] },
      { slot: 'freezer-chest', choices: [choice('freezer-chest', 1, 4)], min: 0, max: 1, chance: 0.4, priority: 2, strategy: 'wall', access: true, rules: [['away-door', 0.4], ['window-soft', 1]] },
      { slot: 'wine-rack', choices: [choice('wine-rack')], min: 0, max: 1, chance: 0.5, priority: 2, strategy: 'wall', access: true, rules: [['away-door', 0.4], ['window-soft', 1]] },
      { slot: 'crates', choices: [choice('crates')], min: 0, max: 2, chance: 0.6, priority: 3, strategy: 'wall', rules: [['away-door', 0.5]] },
      { slot: 'broom-cupboard', choices: [choice('broom-cupboard', 1, 3)], min: 0, max: 1, chance: 0.3, priority: 3, strategy: 'wall', access: true, rules: [['away-door', 0.4]] },
      { slot: 'trash', choices: [choice('trash-bin', 1, 3)], min: 0, max: 1, chance: 0.3, priority: 5, strategy: 'corner', rules: [['away-door', 0.5]] },
      blindsSlot(0.3),
      ceilingSlot(),
    ]),
  }),
  workshop: Object.freeze({
    type: 'workshop',
    groups: Object.freeze({}),
    slots: Object.freeze([
      { slot: 'workbench', choices: [choice('workbench')], min: 1, max: 1, priority: 1, strategy: 'wall', rules: [['centered', 1], ['away-door', 0.5], ['window-soft', 0.3]] },
      { slot: 'table-saw', choices: [choice('table-saw', 1, 11)], min: 0, max: 1, chance: 0.45, priority: 2, strategy: 'free-center', rotations: [0, 90], rules: [['center-free', 1.5], ['ring-free', 2], ['long-axis', 1], ['away-door', 0.5]] },
      { slot: 'easel', choices: [choice('easel', 1, 9)], min: 0, max: 1, chance: 0.25, priority: 3, strategy: 'free-center', rules: [['center-free', 0.5], ['ring-free', 1.5], ['away-door', 0.5]] },
      { slot: 'metal-cabinet', choices: [choice('metal-cabinet')], min: 0, max: 1, chance: 0.7, priority: 3, strategy: 'wall', access: true, rules: [['away-door', 0.4], ['window-soft', 1]] },
      { slot: 'shelving', choices: [choice('metal-shelving')], min: 0, max: 2, chance: 0.6, priority: 3, strategy: 'wall', access: true, rules: [['away-door', 0.4], ['window-soft', 1]] },
      { slot: 'tool-trolley', choices: [choice('tool-trolley')], min: 0, max: 1, chance: 0.6, priority: 4, strategy: 'wall', rules: [['near-role:workbench', 2], ['away-door', 0.4]] },
      { slot: 'crates', choices: [choice('crates')], min: 0, max: 2, chance: 0.5, priority: 5, strategy: 'wall', rules: [['away-door', 0.5]] },
      { slot: 'stool', choices: [choice('bar-stool', 1, 8)], min: 0, max: 1, chance: 0.5, priority: 5, strategy: 'wall', rules: [['near-role:workbench', 2]] },
      { slot: 'pegboard', choices: [choice('pegboard')], min: 0, max: 1, chance: 0.85, priority: 6, strategy: 'above-host', hosts: ['workbench'] },
      { slot: 'decor-on-top', choices: [choice('table-lamp')], min: 0, max: 1, chance: 0.4, priority: 7, strategy: 'on-top', hosts: ['workbench'] },
      wallExtraSlot(0.25, ['wall-clock']),
      blindsSlot(0.4),
      ceilingSlot(['workbench'], [choice('tube-light', 3), choice('ceiling-light', 1)]),
    ]),
  }),
  garage: Object.freeze({
    type: 'garage',
    groups: Object.freeze({}),
    slots: Object.freeze([
      { slot: 'car', choices: [choice('car', 3, 10), choice('car-large', 2, 16)], min: 1, max: 1, priority: 1, strategy: 'park', rules: [['away-door', 1.5], ['centered', 1], ['long-axis', 1], ['center-free', 0.3]] }, // garée l'arrière contre le mur du fond
      { slot: 'car-2', choices: [choice('car', 1, 26), choice('car-large', 1, 28)], min: 0, max: 1, chance: 0.9, priority: 2, strategy: 'park', rules: [['near-role:car', 2], ['away-door', 1], ['long-axis', 1]] },
      { slot: 'workbench', choices: [choice('workbench', 1, 12)], min: 0, max: 1, chance: 0.75, priority: 3, strategy: 'wall', rules: [['near-role:car', -0.5], ['centered', 0.5], ['away-door', 0.4], ['window-soft', 0.3]] },
      { slot: 'metal-cabinet', choices: [choice('metal-cabinet', 1, 11)], min: 0, max: 1, chance: 0.6, priority: 3, strategy: 'wall', access: true, rules: [['away-door', 0.4], ['window-soft', 1]] },
      { slot: 'shelving', choices: [choice('metal-shelving', 1, 9)], min: 0, max: 2, chance: 0.6, priority: 3, strategy: 'wall', access: true, rules: [['away-door', 0.4], ['window-soft', 1]] },
      { slot: 'motorbike', choices: [choice('motorbike', 1, 15)], min: 0, max: 1, chance: 0.3, priority: 4, strategy: 'park', rules: [['away-door', 0.6], ['long-axis', 0.5]] },
      { slot: 'bike', choices: [choice('bike', 1, 11)], min: 0, max: 2, chance: 0.5, priority: 4, strategy: 'wall', rules: [['away-door', 0.5], ['window-soft', 0.5]] },
      { slot: 'tool-trolley', choices: [choice('tool-trolley', 1, 13)], min: 0, max: 1, chance: 0.45, priority: 4, strategy: 'wall', rules: [['near-role:workbench', 2], ['away-door', 0.4]] },
      { slot: 'wheelie-bin', choices: [choice('wheelie-bin', 1, 10)], min: 0, max: 2, chance: 0.35, priority: 5, strategy: 'corner', rules: [['away-door', 0.6]] },
      { slot: 'tyres', choices: [choice('tyre-stack', 1, 12)], min: 0, max: 1, chance: 0.4, priority: 5, strategy: 'corner', rules: [['away-door', 0.6]] },
      { slot: 'crates', choices: [choice('crates', 1, 11)], min: 0, max: 2, chance: 0.5, priority: 5, strategy: 'wall', rules: [['away-door', 0.5]] },
      { slot: 'freezer-chest', choices: [choice('freezer-chest', 1, 14)], min: 0, max: 1, chance: 0.2, priority: 5, strategy: 'wall', access: true, rules: [['away-door', 0.5]] },
      { slot: 'pegboard', choices: [choice('pegboard')], min: 0, max: 1, chance: 0.85, priority: 6, strategy: 'above-host', hosts: ['workbench'] },
      wallExtraSlot(0.2, ['wall-clock']),
      ceilingSlot(['car'], [choice('tube-light', 3), choice('ceiling-light', 1)]),
    ]),
  }),
};

/** Rôles de la passe de décoration : posés après le mobilier, retirés les premiers si le passage est coupé. */
const DECOR_ROLES = new Set([
  'plant-corner', 'decor-on-top', 'frame', 'frame-over-sofa', 'frame-over-bed', 'frame-over-buffet', 'curtains', 'blinds', 'ceiling-light', 'floor-lamp', 'bed-lamp', 'mirror',
  'tabletop', 'radiator', 'wall-extra', 'computer', 'microwave', 'board', 'basket', 'wall-hooks', 'toilet-brush', 'wc-cabinet', 'laundry-basket', 'towel-radiator', 'umbrella-stand', 'pegboard',
]);

/**
 * Recettes finales : chaque slot reçoit `decor` (vrai pour la passe de décoration). Pour chaque pièce, le générateur
 * pose d'abord le mobilier (et ses groupes : tapis sous l'ensemble principal), puis la décoration (plantes dans les coins libres,
 * cadres sur les murs sans fenêtre ni porte, plafonnier au centre, rideaux aux fenêtres des salons et chambres).
 */
export const RECIPES = Object.freeze(
  Object.fromEntries(
    Object.entries(RAW_RECIPES).map(([type, recipe]) => [
      type,
      Object.freeze({ ...recipe, slots: Object.freeze(recipe.slots.map((slot) => Object.freeze({ ...slot, decor: DECOR_ROLES.has(slot.slot) }))) }),
    ]),
  ),
);

/** Nom français des rôles (slots) des recettes, pour les messages. */
export const ROLE_LABELS = Object.freeze({
  sofa: 'canapé', 'coffee-table': 'table basse', armchair: 'fauteuil', rug: 'tapis', 'tv-unit': 'meuble TV', bookcase: 'bibliothèque',
  console: 'console', 'floor-lamp': 'lampadaire', 'plant-corner': 'plante', bed: 'lit', nightstand: 'table de chevet', wardrobe: 'armoire',
  desk: 'bureau', chair: 'chaise de bureau', dresser: 'commode', 'dining-table': 'table à manger', buffet: 'buffet', curtains: 'rideaux',
  'ceiling-light': 'plafonnier', frame: 'cadre', 'frame-over-sofa': 'cadre', 'frame-over-bed': 'cadre', 'frame-over-buffet': 'cadre',
  'decor-on-top': 'objet décoratif', 'bed-lamp': 'lampe de chevet',
  island: 'îlot', 'bar-stool': 'tabouret', 'kitchen-base': 'meuble bas', 'kitchen-sink': 'évier', 'kitchen-hob': 'plaque de cuisson', fridge: 'réfrigérateur',
  'kitchen-wall': 'meuble haut', hood: 'hotte', bath: 'baignoire ou douche', 'shower-extra': 'douche', vanity: 'meuble vasque', toilet: 'toilettes',
  handbasin: 'lave-mains', shelf: 'étagère', 'shelf-unit': 'étagère', mirror: 'miroir', bench: 'banc', 'coat-rack': 'porte-manteau', washer: 'lave-linge',
  dishwasher: 'lave-vaisselle', 'oven-column': 'colonne four', dryer: 'sèche-linge', 'utility-sink': 'bac de buanderie', 'broom-cupboard': 'placard à balais',
  'water-heater': 'chauffe-eau', 'freezer-chest': 'congélateur coffre', 'drying-rack': 'séchoir', 'laundry-basket': 'panier à linge',
  'side-table': 'table d\'appoint', stove: 'poêle', basket: 'panier', tabletop: 'objet posé', radiator: 'radiateur', blinds: 'store', 'wall-extra': 'décor mural',
  computer: 'ordinateur', board: 'tableau mural', 'drawer-unit': 'caisson', 'filing-cabinet': 'classeur', 'sofa-bed': 'canapé-lit',
  'shoe-cabinet': 'meuble à chaussures', 'umbrella-stand': 'porte-parapluie', 'wall-hooks': 'patères', trash: 'poubelle', microwave: 'micro-ondes',
  'bed-bench': 'banc de lit', 'dressing-table': 'coiffeuse', 'standing-mirror': 'miroir sur pied', 'column-cabinet': 'colonne de rangement', 'towel-radiator': 'sèche-serviettes',
  'wc-cabinet': 'meuble WC', 'toilet-brush': 'brosse WC', 'toy-box': 'coffre à jouets', 'shelf-low': 'étagère basse', teepee: 'tipi', pouf: 'pouf', 'display-cabinet': 'vitrine',
  shelving: 'rayonnage', 'wine-rack': 'casier à bouteilles', crates: 'caisses', workbench: 'établi', 'table-saw': 'scie sur table', easel: 'chevalet', 'metal-cabinet': 'armoire métallique',
  'tool-trolley': 'servante d\'atelier', stool: 'tabouret', pegboard: 'panneau à outils', car: 'voiture', 'car-2': 'voiture', motorbike: 'moto', bike: 'vélo',
  'wheelie-bin': 'poubelle roulante', tyres: 'pneus',
});

/** Types de pièces qui ont une recette. */
export const RECIPE_TYPES = Object.freeze(Object.keys(RECIPES));

const RELATIVE_STRATEGIES = new Set(['front-of', 'flank', 'under', 'bed-sides', 'tucked', 'foot-of', 'on-top', 'above-host', 'at-window', 'under-window', 'ceiling', 'island-stools']);

/* --- Géométrie utilitaire ------------------------------------------ */

const dot = (a, b) => a.x * b.x + a.y * b.y;
const inflate = (rect, m) => ({ x0: rect.x0 - m, y0: rect.y0 - m, x1: rect.x1 + m, y1: rect.y1 + m });
const rotationFacing = (v) => (Math.abs(v.x) >= Math.abs(v.y) ? (v.x >= 0 ? 90 : 270) : v.y >= 0 ? 0 : 180);

/** Cases recouvertes par un rectangle, sans limiter à la grille (pour compter aussi ce qui sort). */
function unclippedRange(grid, rect) {
  const e = EPS;
  return {
    i0: Math.floor((rect.x0 - grid.originX) / grid.res + e),
    i1: Math.ceil((rect.x1 - grid.originX) / grid.res - e),
    j0: Math.floor((rect.y0 - grid.originY) / grid.res + e),
    j1: Math.ceil((rect.y1 - grid.originY) / grid.res - e),
  };
}

/** Part des cases recouvertes par le rectangle qui vérifient `test(drapeaux)` ; les cases hors grille ne comptent pas comme réussies. */
function fractionOfCells(grid, rect, test, maxMissFraction = 1) {
  const { i0, i1, j0, j1 } = unclippedRange(grid, rect);
  const total = (i1 - i0) * (j1 - j0);
  if (total <= 0) return 0;
  const allowed = Math.floor(total * maxMissFraction);
  let hits = 0;
  let misses = 0;
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      if (i >= 0 && j >= 0 && i < grid.cols && j < grid.rows && test(grid.flags[j * grid.cols + i], j * grid.cols + i)) hits++;
      else if (++misses > allowed) return 0; // trop de ratés : inutile de continuer
    }
  }
  return hits / total;
}

const isSolidWall = (flags) => (flags & CELL_WALL) !== 0 && (flags & CELL_OPENING) === 0;

/** Étendue [a0, a1] (m) du mur plein derrière l'objet, le long du mur, ou null. `back` : direction de l'arrière. */
function wallRun(grid, fp, back) {
  const { res, originX: ox, originY: oy, cols, rows } = grid;
  const wall = (i, j) => i >= 0 && j >= 0 && i < cols && j < rows && isSolidWall(grid.flags[j * cols + i]);
  if (back.y !== 0) {
    const j = Math.floor(((back.y < 0 ? fp.y0 - res / 2 : fp.y1 + res / 2) - oy) / res);
    const i = Math.floor((fp.cx - ox) / res);
    if (!wall(i, j)) return null;
    let l = i;
    let r = i;
    while (wall(l - 1, j)) l--;
    while (wall(r + 1, j)) r++;
    return { a0: ox + l * res, a1: ox + (r + 1) * res };
  }
  const i = Math.floor(((back.x < 0 ? fp.x0 - res / 2 : fp.x1 + res / 2) - ox) / res);
  const j = Math.floor((fp.cy - oy) / res);
  if (!wall(i, j)) return null;
  let t = j;
  let b = j;
  while (wall(i, t - 1)) t--;
  while (wall(i, b + 1)) b++;
  return { a0: oy + t * res, a1: oy + (b + 1) * res };
}

/** Profondeur libre devant l'objet (m), au milieu de sa face avant, jusqu'à 4 m. */
function frontDepth(grid, fp) {
  const f = fp.front;
  const half = f.x !== 0 ? fp.ex / 2 : fp.ey / 2;
  let depth = 0;
  for (let t = grid.res / 2; t < 4; t += grid.res) {
    const c = cellAt(grid, fp.cx + f.x * (half + t), fp.cy + f.y * (half + t));
    if (!c) break;
    const flags = grid.flags[c.j * grid.cols + c.i];
    if (!(flags & CELL_FLOOR) || flags & CELL_WALL) break;
    depth = t + grid.res / 2;
  }
  return Math.min(depth, 4);
}

/** Petit bruit reproductible (0 à 0,05) qui départage les candidats de même score sans consommer le hasard. */
function jitter(seed, x, y, rotation) {
  let h = (seed ^ Math.imul(Math.round(x * 100) | 0, 0x9e3779b1) ^ Math.imul(Math.round(y * 100) | 0, 0x85ebca6b) ^ Math.imul(rotation + 1, 0xc2b2ae35)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  return ((h >>> 0) / 4294967296) * 0.05;
}

/* --- État d'une génération ----------------------------------------- */

function createState(plan, room, grid, rng, { density = 1, jitterSeed = 1, flushCache = new Map() } = {}) {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let j = 0; j < grid.rows; j++) {
    for (let i = 0; i < grid.cols; i++) {
      if (isCellFree(grid, i, j)) {
        sx += i;
        sy += j;
        n++;
      }
    }
  }
  const center = n ? { x: grid.originX + (sx / n + 0.5) * grid.res, y: grid.originY + (sy / n + 0.5) * grid.res } : { x: grid.originX, y: grid.originY };
  const roomW = grid.cols * grid.res;
  const roomH = grid.rows * grid.res;
  const doorPoints = grid.doors.map((d) => {
    const mid = (d.a0 + d.a1) / 2;
    return d.axis === 'h' ? { x: mid, y: d.pos } : { x: d.pos, y: mid };
  });
  return {
    plan,
    room,
    grid,
    rng,
    density,
    jitterSeed,
    flushCache,
    ceiling: plan.wallHeight ?? DEFAULT_CEILING,
    center,
    roomW,
    roomH,
    diag: Math.hypot(roomW, roomH),
    doorPoints,
    windowZones: grid.windows.flatMap((w) => w.zones.map((zone) => ({ ...zone, sill: w.sill }))),
    items: [],
    missing: [],
    order: 0,
  };
}

const itemsWithRole = (S, role) => S.items.filter((item) => item.role === role);

/** Ajoute un objet à la grille et à la liste. `spec` : { def, x, y, rotation, elevation, slot, back, parent, optional, windowIndex, sharedSeed }. */
function addItem(S, spec) {
  const placed = createPlaced(spec.def, { x: spec.x, y: spec.y, rotation: spec.rotation }, { ceilingHeight: S.ceiling, elevation: spec.elevation });
  const object = addObject(S.grid, placed);
  const item = {
    key: object.key,
    def: spec.def,
    id: spec.def.id,
    slot: spec.slot,
    role: spec.slot.slot,
    group: spec.slot.group ?? null,
    priority: spec.slot.priority + (spec.slot.decor ? 100 : 0), // la décoration part la première si le passage est coupé
    optional: spec.optional,
    sharedSeed: Boolean(spec.sharedSeed), // les modules répétés d'une cuisine partagent leurs variations (rendu en instances)
    x: spec.x,
    y: spec.y,
    rotation: spec.rotation,
    elevation: spec.elevation,
    back: spec.back ?? null,
    parent: spec.parent ?? null,
    windowIndex: spec.windowIndex ?? null,
    placed: object,
    order: S.order++,
  };
  S.items.push(item);
  return item;
}

function removeItem(S, item) {
  removeObject(S.grid, item.key);
  S.items.splice(S.items.indexOf(item), 1);
}

/** Retire un objet et tout ce qui est posé dessus ou accroché à lui. */
function removeWithDependents(S, item) {
  for (const child of S.items.filter((other) => other.parent === item)) removeWithDependents(S, child);
  if (S.items.includes(item)) removeItem(S, item);
}

/* --- Règles de score ------------------------------------------------ */
// Chaque règle renvoie un nombre (environ de -1 à 1) multiplié par le poids du slot, ou null pour refuser le candidat.

const RULES = {
  /** Centré le long du mur plein derrière l'objet : 1 au milieu du mur, 0 au bout. */
  centered(S, c) {
    if (!c.back) return 0;
    const run = wallRun(S.grid, c.placed.footprint, c.back);
    if (!run) return 0;
    const lateral = c.back.y !== 0 ? c.placed.footprint.cx : c.placed.footprint.cy;
    const half = (run.a1 - run.a0) / 2;
    return half > 0 ? 1 - Math.min(1, Math.abs(lateral - (run.a0 + run.a1) / 2) / half) : 0;
  },

  /** Tourné vers l'intérieur de la pièce : vers le centre de l'espace libre, avec de la place devant. */
  'faces-room'(S, c) {
    const fp = c.placed.footprint;
    const v = { x: S.center.x - fp.cx, y: S.center.y - fp.cy };
    const len = Math.hypot(v.x, v.y);
    const cos = len < 0.3 ? 0.5 : Math.max(0, dot(fp.front, { x: v.x / len, y: v.y / len }));
    return 0.6 * cos + 0.4 * (frontDepth(S.grid, fp) / 4);
  },

  /** Fait face à l'objet de rôle `role` (canapé ↔ meuble TV) ; sans lui, retombe sur « faces-room ». */
  'face-partner'(S, c, role) {
    const partner = itemsWithRole(S, role)[0];
    if (!partner) return RULES['faces-room'](S, c);
    const fp = c.placed.footprint;
    const pf = partner.placed.footprint;
    const facing = Math.max(0, -dot(fp.front, pf.front));
    const delta = { x: pf.cx - fp.cx, y: pf.cy - fp.cy };
    const along = dot(delta, fp.front);
    const lateral = Math.abs(delta.x * fp.front.y - delta.y * fp.front.x);
    const distance = along >= 1.5 && along <= 4.5 ? 1 : along > 0 ? 0.3 : 0;
    return 0.5 * facing + 0.2 * (lateral < 0.5 ? 1 : lateral < 1 ? 0.5 : 0) + 0.3 * distance - (facing < 0.5 ? 0.5 : 0);
  },

  /** Lit : centré contre un mur, loin des fenêtres. */
  'bed-wall'(S, c) {
    const near = S.windowZones.some((zone) => footprintsOverlap(inflate(c.placed.footprint, 0.8), zone));
    return 0.7 * RULES.centered(S, c) + (near ? -1.2 : 0.3);
  },

  /** Au moins un côté du lit reste libre (0,5 m) pour y accéder ; les deux côtés valent mieux. */
  'side-access'(S, c) {
    const sides = sideClearanceRects(c.placed.footprint, 0.5);
    const free = (rect) => rectInRoom(S.grid, rect) && !S.grid.objects.some((o) => o.solid && footprintsOverlap(rect, o.footprint));
    const n = Number(free(sides.minus)) + Number(free(sides.plus));
    return n === 0 ? null : n === 2 ? 1 : 0.3;
  },

  /** Un objet haut ne frôle pas une fenêtre (30 cm) : il en cache la lumière. */
  'window-soft'(S, c) {
    const near = inflate(c.placed.footprint, 0.3);
    return S.windowZones.some((zone) => c.placed.top > zone.sill && footprintsOverlap(near, zone)) ? -1 : 0;
  },

  /** Loin des portes : 0 contre la porte, 1 à 3 m ou plus. */
  'away-door'(S, c) {
    if (!S.doorPoints.length) return 1;
    const fp = c.placed.footprint;
    return Math.min(3, Math.min(...S.doorPoints.map((p) => Math.hypot(p.x - fp.cx, p.y - fp.cy)))) / 3;
  },

  /** Près d'un objet de rôle `role` (jusqu'à 3 m). */
  'near-role'(S, c, role) {
    const others = itemsWithRole(S, role);
    if (!others.length) return 0;
    const fp = c.placed.footprint;
    return 1 - Math.min(1, Math.min(...others.map((o) => Math.hypot(o.placed.footprint.cx - fp.cx, o.placed.footprint.cy - fp.cy))) / 3);
  },

  /** Au centre de l'espace libre de la pièce. */
  'center-free'(S, c) {
    const fp = c.placed.footprint;
    return 1 - Math.min(1, Math.hypot(fp.cx - S.center.x, fp.cy - S.center.y) / (0.5 * S.diag));
  },

  /** Grand côté de l'objet dans le sens de la plus grande dimension de la pièce. */
  'long-axis'(S, c) {
    const fp = c.placed.footprint;
    return fp.ex >= fp.ey === S.roomW >= S.roomH ? 1 : 0;
  },

  /** Place libre tout autour (30 cm) : les chaises se tirent, on circule autour. */
  'ring-free'(S, c) {
    const ring = inflate(c.placed.footprint, 0.3);
    const own = unclippedRange(S.grid, c.placed.footprint);
    const { i0, i1, j0, j1 } = unclippedRange(S.grid, ring);
    let free = 0;
    let total = 0;
    for (let j = j0; j < j1; j++) {
      for (let i = i0; i < i1; i++) {
        if (i >= own.i0 && i < own.i1 && j >= own.j0 && j < own.j1) continue;
        total++;
        if (isCellFree(S.grid, i, j)) free++;
      }
    }
    return total ? free / total : 0;
  },

  /** Passage libre autour d'un îlot : `depth` m sur les grands côtés, 60 cm aux deux bouts ; sinon le candidat est refusé. */
  'ring-clear'(S, c, depth) {
    const d = Number(depth) || 0.9;
    const fp = c.placed.footprint;
    const alongX = fp.ex >= fp.ey;
    const strips = alongX
      ? [{ x0: fp.x0, y0: fp.y0 - d, x1: fp.x1, y1: fp.y0 }, { x0: fp.x0, y0: fp.y1, x1: fp.x1, y1: fp.y1 + d }, { x0: fp.x0 - 0.6, y0: fp.y0, x1: fp.x0, y1: fp.y1 }, { x0: fp.x1, y0: fp.y0, x1: fp.x1 + 0.6, y1: fp.y1 }]
      : [{ x0: fp.x0 - d, y0: fp.y0, x1: fp.x0, y1: fp.y1 }, { x0: fp.x1, y0: fp.y0, x1: fp.x1 + d, y1: fp.y1 }, { x0: fp.x0, y0: fp.y0 - 0.6, x1: fp.x1, y1: fp.y0 }, { x0: fp.x0, y0: fp.y1, x1: fp.x1, y1: fp.y1 + 0.6 }];
    for (const strip of strips) {
      const { i0, i1, j0, j1 } = unclippedRange(S.grid, strip);
      for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) if (!isCellFree(S.grid, i, j)) return null;
    }
    return 1;
  },

  /** Bureau devant une fenêtre : la lumière du jour (un bureau est plus bas que l'allège). */
  'desk-window'(S, c) {
    const near = inflate(c.placed.footprint, 0.2);
    return S.windowZones.some((zone) => footprintsOverlap(near, zone)) ? 1 : 0;
  },
};

function applyRule(S, name, candidate) {
  const [base, param] = name.split(':');
  return RULES[base](S, candidate, param);
}

/* --- Candidats ------------------------------------------------------ */

/**
 * Positions « collées au mur » : le dos de l'objet touche le mur (marge de 5 cm comprise), dans les 4 orientations.
 * `corner` : un côté touche aussi un mur. `mounted` : l'objet est fixé au mur, donc collé à la face du mur (sans la marge).
 */
function flushCandidates(S, def, { corner = false, mounted = false, rotations = ROTATIONS } = {}) {
  const cacheKey = `${def.size.w}x${def.size.d}/${corner ? 'c' : ''}${mounted ? 'm' : ''}/${rotations.join(',')}`;
  const cached = S.flushCache.get(cacheKey);
  if (cached) return cached;
  const { grid } = S;
  const { res, originX: ox, originY: oy, cols, rows } = grid;
  const maxX = ox + cols * res + EPS;
  const maxY = oy + rows * res + EPS;
  const out = [];
  const seen = new Set();
  for (const rotation of rotations) {
    const fp = makeFootprint({ x: 0, y: 0, w: def.size.w, d: def.size.d, rotation });
    const { ex, ey, front } = fp;
    const back = { x: -front.x, y: -front.y };
    const vertical = back.y !== 0; // le dos est au nord ou au sud : on cale y ; sinon on cale x
    const mains = [];
    const laterals = [];
    if (vertical) {
      for (let k = 0; k <= rows; k++) mains.push(back.y < 0 ? oy + k * res : oy + k * res - ey);
      for (let k = 0; k <= cols; k++) laterals.push(ox + k * res, ox + k * res - ex);
    } else {
      for (let k = 0; k <= cols; k++) mains.push(back.x < 0 ? ox + k * res : ox + k * res - ex);
      for (let k = 0; k <= rows; k++) laterals.push(oy + k * res, oy + k * res - ey);
    }
    const axis = LOCAL_X[rotation];
    for (const main of mains) {
      for (const lateral of laterals) {
        const x0 = vertical ? lateral : main;
        const y0 = vertical ? main : lateral;
        if (x0 < ox - EPS || y0 < oy - EPS || x0 + ex > maxX || y0 + ey > maxY) continue;
        const rect = { x0, y0, x1: x0 + ex, y1: y0 + ey };
        if (fractionOfCells(grid, rectBeyond(rect, back, res), isSolidWall, 0.1) < 0.9) continue;
        // Le long du mur, un pas de 20 cm suffit ; les positions intermédiaires ne comptent que si elles touchent un mur latéral.
        const onStep = Math.round((lateral - (vertical ? ox : oy)) / res) % 2 === 0;
        if (corner || !onStep) {
          const side = (dir) => fractionOfCells(grid, rectBeyond(rect, dir, res), isSolidWall, 0.1) >= 0.9;
          if (!side(axis) && !side({ x: -axis.x, y: -axis.y })) {
            if (corner || !onStep) continue;
          }
        }
        const key = `${Math.round(x0 * 1000)},${Math.round(y0 * 1000)},${rotation}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const shift = mounted ? grid.wallMargin : 0; // fixé au mur : on rejoint la face du mur
        out.push({ x: r6(x0 + ex / 2 + back.x * shift), y: r6(y0 + ey / 2 + back.y * shift), rotation, back });
      }
    }
  }
  S.flushCache.set(cacheKey, out);
  return out;
}

/** Positions libres sur un réseau de `step` cases, dans les rotations données. */
function freeCandidates(S, def, { step = 2, rotations = ROTATIONS } = {}) {
  const { grid } = S;
  const out = [];
  for (const rotation of rotations) {
    const fp = makeFootprint({ x: 0, y: 0, w: def.size.w, d: def.size.d, rotation });
    for (let j = 0; j + 1 <= grid.rows; j += step) {
      for (let i = 0; i + 1 <= grid.cols; i += step) {
        const x0 = grid.originX + i * grid.res;
        const y0 = grid.originY + j * grid.res;
        if (x0 + fp.ex > grid.originX + grid.cols * grid.res + EPS || y0 + fp.ey > grid.originY + grid.rows * grid.res + EPS) continue;
        out.push({ x: r6(x0 + fp.ex / 2), y: r6(y0 + fp.ey / 2), rotation });
      }
    }
  }
  return out;
}

const frameOf = (item) => ({ f: item.placed.footprint.front, ux: LOCAL_X[item.placed.footprint.rotation], fp: item.placed.footprint, rotation: item.placed.footprint.rotation });
const pointFrom = (fp, f, ux, along, lateral) => ({ x: r6(fp.cx + f.x * along + ux.x * lateral), y: r6(fp.cy + f.y * along + ux.y * lateral) });

/** Rectangle à couvrir par un tapis, selon l'ancre du groupe. */
function rugTarget(S, anchor) {
  const fp = anchor.placed.footprint;
  if (anchor.role === 'dining-table') return inflate(fp, 0.3);
  const front = frontClearanceRect(fp, 1);
  if (anchor.role === 'bed') {
    const { f } = frameOf(anchor);
    const half = f.x !== 0 ? fp.ex : fp.ey;
    const foot = rectBeyond(fp, f, 0.45);
    const body = { x0: fp.x0, y0: fp.y0, x1: fp.x1, y1: fp.y1 };
    const cut = Math.max(0, half - 1.3); // le tapis passe sous les 1,3 m du pied du lit
    const trim = f.y > 0 ? { ...body, y0: body.y0 + cut } : f.y < 0 ? { ...body, y1: body.y1 - cut } : f.x > 0 ? { ...body, x0: body.x0 + cut } : { ...body, x1: body.x1 - cut };
    return inflate(
      { x0: Math.min(trim.x0, foot.x0), y0: Math.min(trim.y0, foot.y0), x1: Math.max(trim.x1, foot.x1), y1: Math.max(trim.y1, foot.y1) },
      0,
    ) && lateralInflate(unionRects(trim, foot), fp, 0.35);
  }
  // Salon : la table basse (si elle est là) plus la bande de canapé qui la touche ; sinon la zone devant le canapé.
  const table = itemsWithRole(S, 'coffee-table')[0];
  const strip = rectBeyond(fp, frameOf(anchor).f, 0.4);
  const under = unionRects(strip, table ? inflate(table.placed.footprint, 0.3) : front);
  return under;
}

function unionRects(a, b) {
  return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
}

/** Élargit un rectangle de `m` dans le sens perpendiculaire à l'avant de l'empreinte (sur les côtés du lit). */
function lateralInflate(rect, fp, m) {
  return fp.front.y !== 0 ? { ...rect, x0: rect.x0 - m, x1: rect.x1 + m } : { ...rect, y0: rect.y0 - m, y1: rect.y1 + m };
}

/**
 * Candidats bruts d'un slot pour un objet : { x, y, rotation, elevation?, back?, base?, parent?, windowIndex? }.
 * Les stratégies relatives s'appuient sur l'ancre (`anchor`) ou sur les objets déjà posés.
 */
function rawCandidates(S, slot, def, anchor) {
  const { grid } = S;
  switch (slot.strategy) {
    case 'wall':
      return flushCandidates(S, def, {});
    case 'corner':
      return flushCandidates(S, def, { corner: true });
    case 'wall-spot':
      return flushCandidates(S, def, { mounted: true, rotations: ROTATIONS }).map((c) => ({ ...c, elevation: def.placement.mountHeight }));
    case 'free-center':
      return freeCandidates(S, def, { step: 2, rotations: slot.rotations ?? ROTATIONS });
    case 'park':
      // Véhicule : de préférence l'arrière contre un mur, sinon n'importe où au sol (un mur à fenêtre ou à porte ne convient pas à un objet haut).
      return [...flushCandidates(S, def, {}), ...freeCandidates(S, def, { step: 3, rotations: slot.rotations ?? ROTATIONS })];

    case 'front-of': {
      // Table basse devant le canapé, au même alignement.
      if (!anchor) return [];
      const { f, ux, fp, rotation } = frameOf(anchor);
      const half = f.x !== 0 ? fp.ex / 2 : fp.ey / 2;
      const out = [];
      for (const gap of [0.45, 0.5, 0.4, 0.6]) {
        for (const lateral of [0, -0.25, 0.25]) {
          const p = pointFrom(fp, f, ux, half + gap + def.size.d / 2, lateral);
          out.push({ ...p, rotation, base: 2 - Math.abs(gap - 0.45) * 3 - Math.abs(lateral) * 2 });
        }
      }
      return out;
    }

    case 'flank': {
      // Fauteuil sur un côté de la table basse (ou du canapé), tourné vers elle.
      if (!anchor) return [];
      const { f, ux, fp } = frameOf(anchor);
      const table = itemsWithRole(S, 'coffee-table')[0];
      const half = f.x !== 0 ? fp.ex / 2 : fp.ey / 2;
      const ref = table ? { cx: table.placed.footprint.cx, cy: table.placed.footprint.cy, w: table.def.size.w } : { ...pointFrom(fp, f, ux, half + 1.2, 0), w: 1 };
      const refPoint = table ? { x: ref.cx, y: ref.cy } : { x: ref.x, y: ref.y };
      const out = [];
      for (const side of [-1, 1]) {
        const facing = { x: -side * ux.x, y: -side * ux.y };
        const rotation = rotationFacing(facing);
        for (const gap of [0.3, 0.4, 0.25]) {
          for (const along of [0, 0.25, -0.25]) {
            const lateral = side * (ref.w / 2 + gap + def.size.d / 2);
            out.push({
              x: r6(refPoint.x + ux.x * lateral + f.x * along),
              y: r6(refPoint.y + ux.y * lateral + f.y * along),
              rotation,
              base: 1.5 - Math.abs(gap - 0.3) * 3 - Math.abs(along),
            });
          }
        }
      }
      return out;
    }

    case 'under': {
      // Plus petit tapis qui couvre la zone cible, dans les deux sens, recentré au besoin.
      if (!anchor) return [];
      const target = rugTarget(S, anchor);
      const tw = target.x1 - target.x0;
      const th = target.y1 - target.y0;
      const cx = (target.x0 + target.x1) / 2;
      const cy = (target.y0 + target.y1) / 2;
      const out = [];
      for (const rotation of [0, 90]) {
        const fp = makeFootprint({ x: 0, y: 0, w: def.size.w, d: def.size.d, rotation });
        if (fp.ex < tw - EPS || fp.ey < th - EPS) continue;
        for (const dx of [0, 0.15, -0.15, 0.3, -0.3]) {
          for (const dy of [0, 0.15, -0.15, 0.3, -0.3]) {
            if (fp.ex - tw < Math.abs(dx) * 2 - EPS && Math.abs(dx) > EPS) continue; // la cible doit rester couverte
            if (fp.ey - th < Math.abs(dy) * 2 - EPS && Math.abs(dy) > EPS) continue;
            out.push({ x: r6(cx + dx), y: r6(cy + dy), rotation, base: -(Math.abs(dx) + Math.abs(dy)) });
          }
        }
      }
      return out;
    }

    case 'bed-sides': {
      // Tables de chevet à la tête du lit, de chaque côté.
      if (!anchor) return [];
      const { f, ux, fp, rotation } = frameOf(anchor);
      const half = f.x !== 0 ? fp.ex / 2 : fp.ey / 2;
      const used = S.items.filter((i) => i.role === slot.slot && i.parent === anchor).map((i) => Math.sign(dot({ x: i.placed.footprint.cx - fp.cx, y: i.placed.footprint.cy - fp.cy }, ux)));
      const out = [];
      for (const side of [1, -1]) {
        if (used.includes(side)) continue;
        for (const gap of [0.03, 0.06]) {
          const lateral = side * ((f.x !== 0 ? fp.ey : fp.ex) / 2 + def.size.w / 2 + gap);
          const along = -(half - def.size.d / 2);
          const p = pointFrom(fp, f, ux, along, lateral);
          out.push({ ...p, rotation, base: 1 - gap * 5 });
        }
      }
      return out;
    }

    case 'tucked': {
      // Chaise de bureau devant le bureau, à moitié rentrée, tournée vers lui.
      if (!anchor) return [];
      const { f, ux, fp, rotation } = frameOf(anchor);
      const half = f.x !== 0 ? fp.ex / 2 : fp.ey / 2;
      const out = [];
      for (const pull of [0.15, 0.25, 0.05]) {
        for (const lateral of [0, -0.2, 0.2]) {
          const p = pointFrom(fp, f, ux, half + def.size.d / 2 - pull, lateral);
          out.push({ ...p, rotation: (rotation + 180) % 360, base: 1 - Math.abs(lateral) - Math.abs(pull - 0.15) });
        }
      }
      return out;
    }

    case 'on-top': {
      // Lampe, plante ou petit objet posé sur un meuble qui l'autorise (canOverlap) : contre le mur, ou au centre (`center`).
      const out = [];
      const hosts = S.items.filter((i) => slot.hosts.includes(i.role) && i.def.placement.canOverlap.includes(def.id) && !S.items.some((o) => o.parent === i && o.role === slot.slot));
      for (const host of hosts) {
        const { f, ux, fp, rotation } = frameOf(host);
        const hostW = f.x !== 0 ? fp.ey : fp.ex;
        const hostD = f.x !== 0 ? fp.ex : fp.ey;
        const span = Math.max(0, hostW / 2 - def.size.w / 2 - 0.05);
        const surface = host.def.placement.surface ?? host.placed.top; // plateau d'une table livrée avec ses chaises
        const laterals = slot.center ? [0] : span > 0.1 ? [-span, 0, span] : [0];
        for (const lateral of laterals) {
          for (const along of slot.center ? [0] : [-(hostD / 2 - def.size.d / 2 - 0.03), 0]) {
            const p = pointFrom(fp, f, ux, Math.max(along, -(hostD / 2 - def.size.d / 2)), lateral);
            out.push({ ...p, rotation: slot.center ? rotation : 0, elevation: surface, parent: host, base: -Math.abs(lateral) * 0.5 - (along === 0 && !slot.center ? 0.3 : 0) });
          }
        }
      }
      return out;
    }

    case 'above-host': {
      // Cadre au-dessus d'un meuble contre le mur, centré sur lui.
      const out = [];
      for (const host of S.items.filter((i) => slot.hosts.includes(i.role) && i.back && !S.items.some((o) => o.parent === i && o.role === slot.slot))) {
        const mount = slot.lift ? Math.max(def.placement.mountHeight ?? 0, host.placed.top + slot.lift) : def.placement.mountHeight ?? 1.3;
        if (host.placed.top + 0.1 > mount) continue;
        const fp = host.placed.footprint;
        const hostDepth = host.back.y !== 0 ? fp.ey : fp.ex;
        const shift = hostDepth / 2 + S.grid.wallMargin - def.size.d / 2;
        out.push({
          x: r6(fp.cx + host.back.x * shift),
          y: r6(fp.cy + host.back.y * shift),
          rotation: host.placed.footprint.rotation,
          elevation: mount,
          back: host.back,
          parent: host,
          base: 1,
        });
      }
      return out;
    }

    case 'foot-of': {
      // Banc ou coffre au pied du lit, dans son axe.
      if (!anchor) return [];
      const { f, ux, fp, rotation } = frameOf(anchor);
      const half = f.x !== 0 ? fp.ex / 2 : fp.ey / 2;
      const out = [];
      for (const gap of [0.05, 0.12]) {
        const p = pointFrom(fp, f, ux, half + gap + def.size.d / 2, 0);
        out.push({ ...p, rotation, base: 1 - gap * 3 });
      }
      return out;
    }

    case 'under-window': {
      // Radiateur sous une fenêtre, centré, fixé au mur (sous l'allège).
      const out = [];
      grid.windows.forEach((w, index) => {
        if (S.items.some((i) => i.role === slot.slot && i.windowIndex === index)) return;
        const mid = (w.a0 + w.a1) / 2;
        const sign = w.axis === 'h' ? w.inward.y : w.inward.x;
        const rotation = rotationFacing(w.inward);
        for (const extra of [0, 0.03, 0.06]) {
          const offset = sign * (WALL_THICKNESS / 2 + def.size.d / 2 + extra);
          out.push({ x: r6(w.axis === 'h' ? mid : w.pos + offset), y: r6(w.axis === 'h' ? w.pos + offset : mid), rotation, elevation: def.placement.mountHeight, windowIndex: index, base: 1 - extra });
        }
      });
      return out;
    }

    case 'island-stools': {
      // Tabourets sur le côté de l'îlot opposé à la zone de cuisson, tournés vers lui.
      const island = itemsWithRole(S, 'island')[0];
      if (!island) return [];
      const { f, ux, fp, rotation } = frameOf(island);
      const half = f.x !== 0 ? fp.ex / 2 : fp.ey / 2;
      const width = f.x !== 0 ? fp.ey : fp.ex;
      const out = [];
      for (const lateral of [-width / 4, width / 4, 0]) {
        const p = pointFrom(fp, f, ux, -(half + 0.04 + def.size.d / 2), lateral);
        out.push({ ...p, rotation: (rotation + 180) % 360, base: -Math.abs(lateral) });
      }
      return out;
    }

    case 'at-window': {
      // Rideaux centrés sur une fenêtre, collés au mur.
      const out = [];
      grid.windows.forEach((w, index) => {
        if (S.items.some((i) => i.role === slot.slot && i.windowIndex === index)) return;
        const mid = (w.a0 + w.a1) / 2;
        const sign = w.axis === 'h' ? w.inward.y : w.inward.x;
        const offset = sign * (WALL_THICKNESS / 2 + def.size.d / 2);
        const rotation = rotationFacing(w.inward);
        out.push({ x: r6(w.axis === 'h' ? mid : w.pos + offset), y: r6(w.axis === 'h' ? w.pos + offset : mid), rotation, windowIndex: index, base: 1 });
      });
      return out;
    }

    case 'ceiling': {
      // Luminaire au centre de l'ensemble (ou de la pièce), à défaut le plus près possible.
      const targets = (slot.target ?? []).flatMap((role) => itemsWithRole(S, role));
      const target = targets.length ? { x: targets[0].placed.footprint.cx, y: targets[0].placed.footprint.cy } : S.center;
      const out = [];
      for (let dx = -1.2; dx <= 1.2 + EPS; dx += 0.3) {
        for (let dy = -1.2; dy <= 1.2 + EPS; dy += 0.3) out.push({ x: r6(target.x + dx), y: r6(target.y + dy), rotation: 0, base: -Math.hypot(dx, dy) });
      }
      return out;
    }

    default:
      return [];
  }
}

/** Un objet fixé au mur ne doit pas disparaître derrière un meuble plus haut que son bord inférieur. */
function hiddenByFurniture(S, placed) {
  const near = inflate(placed.footprint, 0.12);
  return S.grid.objects.some((o) => o.layer === 'floor' && o.solid && o.top > placed.bottom + 0.05 && footprintsOverlap(near, o.footprint));
}

/** La décoration au sol (plantes) ne gêne pas les chaises : 30 cm libres autour d'une table à manger. */
function blocksChairs(S, placed) {
  return S.items.some((item) => item.role === 'dining-table' && footprintsOverlap(placed.footprint, inflate(item.placed.footprint, 0.3)));
}

/** Valide et note les candidats bruts : { ...brut, def, placed, score }. */
function evaluate(S, slot, def, raws, anchor) {
  const clearance = slot.clearance ?? (RELATIVE_STRATEGIES.has(slot.strategy) ? false : 'both');
  const out = [];
  for (const raw of raws) {
    const placed = createPlaced(def, { x: raw.x, y: raw.y, rotation: raw.rotation }, { ceilingHeight: S.ceiling, elevation: raw.elevation });
    if (!checkPlacement(S.grid, placed, { clearance, firstOnly: true }).ok) continue;
    if (placed.layer === 'wall' && hiddenByFurniture(S, placed)) continue;
    if (slot.decor && placed.layer === 'floor' && placed.bottom === 0 && blocksChairs(S, placed)) continue; // posé sur la table : ne gêne pas les chaises
    const candidate = { ...raw, def, placed, score: raw.base ?? 0 };
    let accepted = true;
    for (const [name, weight] of slot.rules ?? []) {
      const value = applyRule(S, name, candidate, anchor);
      if (value === null) {
        accepted = false;
        break;
      }
      candidate.score += weight * value;
    }
    if (!accepted) continue;
    candidate.score += jitter(S.jitterSeed, raw.x, raw.y, raw.rotation);
    out.push(candidate);
  }
  return out;
}

/**
 * Meilleurs candidats, deux à deux distincts (au moins 50 cm ou une autre orientation). Un candidat trop loin derrière le
 * meilleur (plus de `margin` points) n'est pas retenu : on ne tire pas au sort un emplacement franchement médiocre.
 */
function distinctBest(candidates, count, margin = Infinity) {
  const sorted = candidates.slice().sort((a, b) => b.score - a.score || a.x - b.x || a.y - b.y || a.rotation - b.rotation);
  const chosen = [];
  for (const c of sorted) {
    if (chosen.length && c.score < chosen[0].score - margin) break;
    if (chosen.every((o) => o.rotation !== c.rotation || Math.hypot(o.x - c.x, o.y - c.y) >= 0.5)) chosen.push(c);
    if (chosen.length === count) break;
  }
  return chosen;
}

/** Ordre dans lequel essayer les objets d'un slot : tirage pondéré sans remise, ou du plus petit au plus grand pour un tapis. */
function defOrder(S, slot, rng) {
  const area = S.room.areaM2;
  const eligible = slot.choices.filter((c) => c.minArea <= area);
  if (slot.strategy === 'under') return eligible.map((c) => DEFS.get(c.id)).sort((a, b) => a.size.w * a.size.d - b.size.w * b.size.d);
  const pool = eligible.slice();
  const order = [];
  while (pool.length) {
    const next = rng.weightedPick(pool, (c) => c.weight);
    order.push(DEFS.get(next.id));
    pool.splice(pool.indexOf(next), 1);
  }
  return order;
}

/** Nombre d'exemplaires d'un slot : `min`, plus chaque exemplaire facultatif tiré avec `chance` × densité. */
function instanceCount(S, slot, rng, anchorDef) {
  let max = slot.max;
  if (slot.perAnchor && anchorDef) max = Math.min(max, slot.perAnchor[anchorDef.id] ?? max);
  let n = slot.min;
  for (let i = slot.min; i < max; i++) if (rng.chance(Math.min(1, (slot.chance ?? 0.5) * S.density))) n++;
  return n;
}

/**
 * Place un exemplaire d'un slot : essaie les objets dans l'ordre, génère et note les candidats, en retient un (au hasard
 * parmi les K meilleurs, ou le meilleur si `best`). Ajoute l'objet et le renvoie, ou renvoie null.
 */
function placeSlot(S, slot, rng, { anchor = null, order = null, optional = true, best = false } = {}) {
  const guarded = !optional && !anchor; // un objet obligatoire ne doit pas, à lui seul, couper une porte ou une zone d'accès
  const before = guarded ? blockingViolations(S) : null;
  for (const def of order ?? defOrder(S, slot, rng)) {
    const candidates = evaluate(S, slot, def, rawCandidates(S, slot, def, anchor), anchor);
    if (!candidates.length) continue;
    const ranked = distinctBest(candidates, guarded ? 6 : best ? 1 : TOP_K, guarded ? Infinity : TOP_MARGIN);
    const first = best ? ranked[0] : rng.pick(guarded ? ranked.slice(0, TOP_K) : ranked);
    for (const picked of [first, ...ranked.filter((c) => c !== first)]) {
      const item = addItem(S, { def, x: picked.x, y: picked.y, rotation: picked.rotation, elevation: picked.elevation, slot, back: picked.back, parent: picked.parent ?? anchor, windowIndex: picked.windowIndex, optional });
      if (!guarded || blockingViolations(S) <= before) return item;
      removeItem(S, item);
    }
  }
  return null;
}

/** Nombre de violations de circulation qui ne sont pas de simples poches (porte bloquée, zone d'accès coupée ou isolée). */
function blockingViolations(S) {
  return connectivity(S).violations.filter((v) => v.code !== 'pocket').length;
}

/** Données minimales pour rejouer un placement : voir replay. */
const specOf = (item, index) => ({ def: item.def, x: item.x, y: item.y, rotation: item.rotation, elevation: item.elevation, slot: item.slot, back: item.back, windowIndex: item.windowIndex, optional: item.optional, sharedSeed: item.sharedSeed, parentIndex: item.parent ? index.get(item.parent) ?? null : null });

function replay(S, specs) {
  const made = [];
  for (const spec of specs) made.push(addItem(S, { ...spec, parent: spec.parentIndex === null ? null : made[spec.parentIndex] }));
  return made;
}

/**
 * Place un groupe comme une unité : pour les meilleurs emplacements de l'ancre, on simule le placement des membres
 * (table basse, chevets, tapis…), on additionne les scores, puis on tire au hasard parmi les K meilleurs ensembles.
 */
function placeGroup(S, recipe, anchorSlot, rng, optional) {
  const members = recipe.slots.filter((s) => s.group === anchorSlot.group && s !== anchorSlot).sort((a, b) => a.priority - b.priority);
  for (const def of defOrder(S, anchorSlot, rng)) {
    const plan = [];
    for (const slot of members) {
      const n = instanceCount(S, slot, rng, def);
      for (let k = 0; k < n; k++) plan.push({ slot, order: defOrder(S, slot, rng) });
    }
    const candidates = evaluate(S, anchorSlot, def, rawCandidates(S, anchorSlot, def, null), null);
    if (!candidates.length) continue;
    const before = optional ? 0 : blockingViolations(S);
    const trials = distinctBest(candidates, GROUP_ANCHOR_CANDIDATES).map((candidate) => {
      const base = S.items.length;
      const anchor = addItem(S, { def, x: candidate.x, y: candidate.y, rotation: candidate.rotation, slot: anchorSlot, back: candidate.back, optional });
      if (!optional && blockingViolations(S) > before) {
        removeItem(S, anchor); // l'ancre seule coupe déjà une porte ou une zone d'accès : emplacement écarté
        return null;
      }
      let total = candidate.score;
      for (const entry of plan) {
        const item = placeSlot(S, entry.slot, rng, { anchor, order: entry.order, best: true });
        if (item) total += 1 + 0.25 * (itemScore(item));
      }
      const added = S.items.slice(base);
      const index = new Map(added.map((item, i) => [item, i]));
      const specs = added.map((item) => specOf(item, index));
      for (const item of added.slice().reverse()) removeItem(S, item);
      return { score: total, x: candidate.x, y: candidate.y, rotation: candidate.rotation, specs };
    }).filter(Boolean);
    if (!trials.length) continue;
    const picked = rng.pick(distinctBest(trials, TOP_K, TOP_MARGIN));
    replay(S, picked.specs);
    return true;
  }
  return false;
}

const itemScore = () => 0;

/**
 * Déroule la recette : d'abord le planificateur éventuel (cuisine), puis le mobilier par priorité (du plus grand au plus petit objet),
 * enfin la passe de décoration (slots `decor`).
 */
function runRecipe(S, recipe, rng) {
  if (recipe.planner) PLANNERS[recipe.planner](S, rng);
  const units = [];
  for (const slot of recipe.slots) {
    if (slot.group && recipe.groups[slot.group].anchor !== slot.slot) continue; // membre : placé avec son ancre
    const n = instanceCount(S, slot, rng);
    const area = Math.max(...slot.choices.map((c) => DEFS.get(c.id).size.w * DEFS.get(c.id).size.d));
    for (let index = 0; index < n; index++) units.push({ slot, index, area });
  }
  units.sort((a, b) => Number(a.slot.decor) - Number(b.slot.decor) || a.slot.priority - b.slot.priority || b.area - a.area || a.index - b.index);
  for (const { slot, index } of units) {
    if (slot.unless?.some((role) => itemsWithRole(S, role).length)) continue;
    const optional = index >= slot.min;
    const done = slot.group ? placeGroup(S, recipe, slot, rng, optional) : placeSlot(S, slot, rng, { optional });
    if (!done && !optional) S.missing.push(slot.slot);
  }
}

/* --- Cuisine : modules alignés le long d'un ou deux murs ------------ */

const MODULE_W = 0.6;
const kitchenSlot = (id, extra = {}) => ({ slot: id, choices: [choice(id)], min: 0, max: 99, priority: 1, strategy: 'planner', ...extra });
const K_SLOTS = {
  'kitchen-base': kitchenSlot('kitchen-base', { access: true }),
  'kitchen-sink': kitchenSlot('kitchen-sink', { access: true }),
  'kitchen-hob': kitchenSlot('kitchen-hob', { access: true }),
  fridge: kitchenSlot('fridge', { access: true }),
  'kitchen-wall': kitchenSlot('kitchen-wall', { priority: 2, decor: false }),
  hood: kitchenSlot('hood', { priority: 2, decor: false }),
  dishwasher: kitchenSlot('dishwasher', { access: true }),
  'oven-column': kitchenSlot('oven-column', { access: true }),
};
/** Modules indispensables d'une cuisine, avec leur rôle dans les messages. */
const KITCHEN_NEEDS = { fridge: 'fridge', sink: 'kitchen-sink', hob: 'kitchen-hob' };
const KITCHEN_NEEDS_IDS = { fridge: 1, 'kitchen-sink': 1, 'kitchen-hob': 1 };

/**
 * Lignes continues où l'on peut aligner des modules de 60 cm contre un mur : positions valides des meubles bas (dégagement de
 * 90 cm devant compris), regroupées par mur ; chaque ligne devient un intervalle { rotation, back, vertical, main, lo, hi, length }.
 * `lo` et `hi` sont les bornes le long du mur (m).
 */
function kitchenIntervals(S, clearance) {
  const base = DEFS.get('kitchen-base');
  const lines = new Map();
  for (const c of flushCandidates(S, base, {})) {
    const placed = createPlaced(base, { x: c.x, y: c.y, rotation: c.rotation }, { ceilingHeight: S.ceiling });
    if (!checkPlacement(S.grid, placed, { clearance, firstOnly: true }).ok) continue;
    const vertical = c.back.y !== 0;
    const key = `${c.rotation}|${vertical ? c.y : c.x}`;
    let line = lines.get(key);
    if (!line) lines.set(key, (line = { rotation: c.rotation, back: c.back, vertical, main: vertical ? c.y : c.x, lats: [] }));
    line.lats.push(vertical ? c.x : c.y);
  }
  const out = [];
  for (const line of lines.values()) {
    line.lats.sort((a, b) => a - b);
    let start = 0;
    for (let i = 0; i < line.lats.length; i++) {
      if (i < line.lats.length - 1 && line.lats[i + 1] - line.lats[i] <= 0.25) continue;
      const lo = line.lats[start] - MODULE_W / 2;
      const hi = line.lats[i] + MODULE_W / 2;
      out.push({ rotation: line.rotation, back: line.back, vertical: line.vertical, main: line.main, lo: r6(lo), hi: r6(hi), length: r6(hi - lo) });
      start = i + 1;
    }
  }
  return out;
}

/** Un module de cuisine : `needs` = indispensables restants (fridge, sink, hob). Ordre des modules d'une ligne de `n` emplacements de 60 cm. */
function composeRun(n, needs, rng) {
  const out = composeBasics(n, needs, rng);
  // Variété : lave-vaisselle à côté de l'évier (un meuble bas en moins), colonne four en bout de ligne.
  if (n >= 4 && out.includes('kitchen-sink') && rng.chance(0.55)) {
    const at = out.indexOf('kitchen-sink');
    const near = [at + 1, at - 1].map((i) => i).find((i) => out[i] === 'kitchen-base');
    if (near !== undefined) out[near] = 'dishwasher';
  }
  if (n >= 5 && rng.chance(0.3)) {
    const ends = [0, out.length - 1].filter((i) => out[i] === 'kitchen-base');
    if (ends.length) out[ends[rng.chance(0.5) ? 0 : ends.length - 1]] = 'oven-column';
  }
  return out;
}

function composeBasics(n, needs, rng) {
  let req = [];
  if (needs.has('fridge')) req.push('fridge');
  if (needs.has('sink')) req.push('kitchen-sink');
  if (needs.has('hob')) req.push('kitchen-hob');
  const width = (id) => (id === 'kitchen-sink' ? 2 : 1);
  const total = () => req.reduce((sum, id) => sum + width(id), 0);
  for (const drop of ['fridge', 'kitchen-hob', 'kitchen-sink']) if (total() > n) req = req.filter((id) => id !== drop);
  if (!req.includes('fridge') && req.includes('kitchen-sink') && req.includes('kitchen-hob') && rng.chance(0.5)) req = req.map((id) => (id === 'kitchen-sink' ? 'kitchen-hob' : id === 'kitchen-hob' ? 'kitchen-sink' : id));
  let free = n - total();
  // Un meuble bas entre deux modules : d'abord entre évier et plaque, puis après le frigo, puis ailleurs.
  const gaps = req.slice(0, -1).map((id, i) => ({ i, rank: (id === 'kitchen-sink' || id === 'kitchen-hob') && req[i + 1] !== 'fridge' ? 0 : id === 'fridge' ? 1 : 2 }));
  gaps.sort((a, b) => a.rank - b.rank || a.i - b.i);
  const baseAfter = new Set();
  for (const gap of gaps) {
    if (free <= 0) break;
    baseAfter.add(gap.i);
    free--;
  }
  const out = [];
  req.forEach((id, i) => {
    out.push(id);
    if (baseAfter.has(i)) out.push('kitchen-base');
  });
  while (free-- > 0) out.push('kitchen-base');
  return out;
}

/** Pose un meuble fixé au mur au-dessus de `host` (meuble haut, hotte). Renvoie l'objet ou null. */
function mountOnWall(S, host, def, slot, lateral = 0) {
  const fp = host.placed.footprint;
  const depth = host.back.y !== 0 ? fp.ey : fp.ex;
  const shift = depth / 2 + S.grid.wallMargin - def.size.d / 2;
  const ux = LOCAL_X[fp.rotation];
  const spec = { x: r6(fp.cx + host.back.x * shift + ux.x * lateral), y: r6(fp.cy + host.back.y * shift + ux.y * lateral), rotation: fp.rotation };
  const elevation = def.placement.mountHeight;
  const placed = createPlaced(def, spec, { ceilingHeight: S.ceiling, elevation });
  if (!checkPlacement(S.grid, placed, { clearance: false, firstOnly: true }).ok) return null;
  return addItem(S, { def, ...spec, elevation, slot, back: host.back, parent: host, optional: true, sharedSeed: true });
}

/**
 * Planificateur de cuisine : une ou deux lignes de modules (frigo, meubles bas, évier de 1,20 m, plaque) contre les murs,
 * meubles hauts au-dessus des meubles bas, hotte au-dessus de la plaque. La première ligne est la plus longue (au hasard parmi
 * les trois meilleures) ; la seconde (en L, en U ou en parallèle) apporte ce que la première n'a pas pu contenir. L'îlot, ses
 * tabourets et la table sont posés ensuite par les slots de la recette.
 */
function planKitchen(S, rng) {
  const needs = new Set(Object.keys(KITCHEN_NEEDS));
  const placedRuns = [];

  const placeRun = (interval) => {
    const n = Math.floor((interval.length + EPS) / MODULE_W);
    if (n < 2) return false;
    const touches = (lat) => {
      const rect = interval.vertical ? { x0: lat - MODULE_W / 2, y0: interval.main - MODULE_W / 2, x1: lat + MODULE_W / 2, y1: interval.main + MODULE_W / 2 } : { x0: interval.main - MODULE_W / 2, y0: lat - MODULE_W / 2, x1: interval.main + MODULE_W / 2, y1: lat + MODULE_W / 2 };
      const axis = LOCAL_X[interval.rotation];
      const side = (dir) => fractionOfCells(S.grid, rectBeyond(rect, dir, S.grid.res), isSolidWall, 0.1) >= 0.9;
      return side(axis) || side({ x: -axis.x, y: -axis.y });
    };
    const loWall = touches(interval.lo + MODULE_W / 2);
    const hiWall = touches(interval.hi - MODULE_W / 2);
    const forward = loWall !== hiWall ? loWall : rng.chance(0.5); // on part de l'angle ; sinon au hasard
    const sequence = composeRun(n, needs, rng);
    const mainSign = interval.vertical ? interval.back.y : interval.back.x;
    let cursor = 0;
    const hosts = [];
    const pending = [];
    for (const id of sequence) {
      const def = DEFS.get(id);
      const slots = id === 'kitchen-sink' ? 2 : 1;
      const lat = forward ? interval.lo + (cursor + slots / 2) * MODULE_W : interval.hi - (cursor + slots / 2) * MODULE_W;
      cursor += slots;
      const attempt = (candidate) => {
        const main = interval.main + mainSign * (MODULE_W / 2 - candidate.size.d / 2);
        const spec = interval.vertical ? { x: r6(lat), y: r6(main), rotation: interval.rotation } : { x: r6(main), y: r6(lat), rotation: interval.rotation };
        const placed = createPlaced(candidate, spec, { ceilingHeight: S.ceiling });
        if (!checkPlacement(S.grid, placed, { clearance: placedRuns.length ? 'own' : 'both', firstOnly: true }).ok) return null;
        const required = candidate.id in KITCHEN_NEEDS_IDS;
        return addItem(S, { def: candidate, ...spec, slot: K_SLOTS[candidate.id], back: interval.back, optional: !required, sharedSeed: true });
      };
      let item = attempt(def);
      if (!item && id !== 'kitchen-base') {
        pending.push(id);
        item = attempt(DEFS.get('kitchen-base')); // à la place du module trop haut pour cet endroit (sous une fenêtre) : un meuble bas
      }
      if (item) hosts.push(item);
    }
    for (const item of hosts) {
      if (item.id === 'fridge') needs.delete('fridge');
      else if (item.id === 'kitchen-sink') needs.delete('sink');
      else if (item.id === 'kitchen-hob') needs.delete('hob');
    }
    placedRuns.push({ hosts, interval });
    return true;
  };

  // Première ligne, puis seconde ligne si la cuisine en a besoin (modules manquants) ou si elle est assez grande.
  for (let run = 0; run < 2; run++) {
    if (run === 1 && !needs.size && !(S.room.areaM2 >= 8 && rng.chance(0.75))) break;
    const intervals = kitchenIntervals(S, run === 0 ? 'both' : 'own').filter((i) => i.length >= (run === 0 ? 1.2 : 1.2) - EPS);
    if (!intervals.length) break;
    const placedRects = S.items.filter((i) => i.slot.strategy === 'planner').map((i) => i.placed.footprint);
    const scored = intervals.map((interval) => {
      const rect = interval.vertical ? { x0: interval.lo, y0: interval.main - 0.3, x1: interval.hi, y1: interval.main + 0.3 } : { x0: interval.main - 0.3, y0: interval.lo, x1: interval.main + 0.3, y1: interval.hi };
      const adjacent = placedRects.some((r) => footprintsOverlap(inflate(r, 0.15), rect));
      const door = S.doorPoints.length ? Math.min(...S.doorPoints.map((p) => Math.hypot(p.x - (rect.x0 + rect.x1) / 2, p.y - (rect.y0 + rect.y1) / 2))) : 3;
      return { interval, score: Math.min(interval.length, 4.8) + (run === 1 && adjacent ? 1.5 : 0) + Math.min(door, 3) * 0.15 + rng.next() * 0.5 };
    });
    scored.sort((a, b) => b.score - a.score || a.interval.lo - b.interval.lo);
    const pick = rng.pick(scored.slice(0, TOP_K));
    if (!placeRun(pick.interval)) break;
  }

  // Meubles hauts au-dessus des meubles bas et de l'évier, hotte au-dessus de la plaque.
  for (const { hosts } of placedRuns) {
    for (const host of hosts) {
      if (host.id === 'kitchen-hob') {
        if (rng.chance(0.95)) mountOnWall(S, host, DEFS.get('hood'), K_SLOTS.hood);
      } else if (host.id === 'kitchen-base' || host.id === 'kitchen-sink' || host.id === 'dishwasher') {
        const def = DEFS.get('kitchen-wall');
        const count = host.id === 'kitchen-sink' ? 2 : 1;
        for (let k = 0; k < count; k++) if (rng.chance(0.85)) mountOnWall(S, host, def, K_SLOTS['kitchen-wall'], count === 2 ? (k - 0.5) * MODULE_W : 0);
      }
    }
  }
  for (const need of needs) S.missing.push(KITCHEN_NEEDS[need]);
}

const PLANNERS = { kitchen: planKitchen };

/** Zones dont le dégagement frontal doit rester atteignable : les meubles de rangement (slot `access`). */
function accessZones(S) {
  return S.items
    .filter((item) => item.slot.access && item.placed.clearanceFront > 0)
    .map((item) => ({ id: item.key, ...frontClearanceRect(item.placed.footprint, item.placed.clearanceFront) }));
}

const connectivity = (S) => checkConnectivity(S.grid, { zones: accessZones(S) });

/** Supprime les objets facultatifs (les moins prioritaires d'abord), puis au besoin les obligatoires, jusqu'à rétablir la circulation. */
function prune(S) {
  let result = connectivity(S);
  while (!result.ok) {
    const byImportance = (list) => list.slice().sort((a, b) => b.priority - a.priority || b.order - a.order);
    const optional = byImportance(S.items.filter((i) => i.optional));
    const next = optional[0] ?? byImportance(S.items)[0];
    if (!next) break;
    removeWithDependents(S, next);
    result = connectivity(S);
  }
  return result;
}

/**
 * @typedef {{ roomId: string, key: string, id: string, role: string, group: string | null, optional: boolean,
 *   x: number, y: number, rotation: number, elevation: number, seed: number }} PlacedItem
 * `x`, `y` : centre de l'empreinte au sol en mètres (plan ; en 3D : x et z) ; `rotation` : rotation Y en degrés ;
 * `elevation` : hauteur du bas de l'objet (m) ; `seed` : graine des variations de l'objet (createBuildContext).
 */

/**
 * Positions collées aux murs : ne dépendent que des murs, des ouvertures et de la pièce. Cache à deux niveaux de WeakMap
 * (plan.walls puis plan.openings), qui survit donc aux changements de mobilier (nouveau plan, mêmes tableaux de murs).
 */
const FLUSH_CACHES = new WeakMap();
function flushCacheFor(plan, room) {
  let byOpenings = FLUSH_CACHES.get(plan.walls);
  if (!byOpenings) FLUSH_CACHES.set(plan.walls, (byOpenings = new WeakMap()));
  let rooms = byOpenings.get(plan.openings);
  if (!rooms) byOpenings.set(plan.openings, (rooms = new Map()));
  const key = `${room.id}/${room.cells.length}`;
  let cache = rooms.get(key);
  if (!cache) rooms.set(key, (cache = new Map()));
  return cache;
}

const densityOf = (style) => (typeof style === 'string' ? STYLE_DENSITY[style] ?? 1 : style?.density ?? 1);

function toPlacedItems(S, room, seed) {
  return S.items
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((item) => ({
      roomId: room.id,
      key: item.key,
      id: item.id,
      role: item.role,
      group: item.group,
      optional: item.optional,
      x: item.x,
      y: item.y,
      rotation: item.rotation,
      elevation: item.placed.bottom,
      seed: hash(seed, `${room.id}/${item.sharedSeed ? item.id : item.key}`),
    }));
}

/**
 * Génère le mobilier d'une pièce et en donne le rapport : { items, attempts, pruned, ok, missing, type } (`missing` : objets obligatoires introuvables).
 * - Même (plan, pièce, seed, style) → même résultat. Chaque pièce a sa sous-graine (hash(seed, id de la pièce)), donc modifier
 *   une pièce ne change pas les autres.
 * - Essai : on déroule la recette ; si la circulation est coupée (checkConnectivity : porte bloquée, zone d'accès coupée, poche
 *   libre isolée), nouvelle sous-graine, jusqu'à MAX_ATTEMPTS essais.
 * - Ensuite, on part du meilleur essai et on supprime les objets facultatifs (puis obligatoires) jusqu'à rétablir la circulation.
 * - `style` : identifiant de palette ; il règle la densité du décor (STYLE_DENSITY).
 * @param {Room} room
 * @param {Plan} plan
 * @param {number | string} seed
 * @param {string} [style]
 */
export function generateRoomReport(room, plan, seed, style) {
  const type = getRoomType(plan, room);
  const recipe = RECIPES[type];
  if (!recipe) return { items: [], attempts: 0, pruned: 0, ok: true, missing: [], type };
  const grid = createRoomGrid(plan, room);
  const base = createRng(hash(seed, room.id));
  const jitterSeed = hash(seed, `${room.id}/jitter`);
  const density = densityOf(style);
  const flushCache = flushCacheFor(plan, room);
  let best = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    clearObjects(grid);
    const rng = base.fork(`try-${attempt}`);
    const S = createState(plan, room, grid, rng, { density, jitterSeed, flushCache });
    runRecipe(S, recipe, rng);
    const result = connectivity(S);
    if (result.ok && !S.missing.length) return { items: toPlacedItems(S, room, seed), attempts: attempt + 1, pruned: 0, ok: true, missing: [], type };
    const rank = (result.ok ? 0 : 1000) + S.missing.length * 100 + result.violations.length; // circulation d'abord, puis objets obligatoires manquants
    if (!best || rank < best.rank) {
      const index = new Map(S.items.map((item, i) => [item, i]));
      best = { rank, missing: S.missing.slice(), specs: S.items.map((item) => specOf(item, index)) };
    }
  }
  clearObjects(grid);
  const S = createState(plan, room, grid, base.fork('prune'), { density, jitterSeed, flushCache });
  replay(S, best.specs);
  const before = S.items.length;
  const result = prune(S);
  return { items: toPlacedItems(S, room, seed), attempts: MAX_ATTEMPTS, pruned: before - S.items.length, ok: result.ok, missing: best.missing, type };
}

/** Mobilier d'une pièce : PlacedItem[] (voir generateRoomReport). Une pièce sans recette n'a pas d'objets. */
export function generateRoom(room, plan, seed, style) {
  return generateRoomReport(room, plan, seed, style).items;
}

/** Mobilier de toutes les pièces qui ont une recette : PlacedItem[]. `rooms` : pièces déjà détectées (sinon detectRooms). */
export function generateLayout(plan, seed, style, rooms) {
  return (rooms ?? detectRooms(plan)).flatMap((room) => generateRoom(room, plan, seed, style));
}

/**
 * Contrôle indépendant d'un résultat : rejoue les objets sur une grille neuve et relève les problèmes.
 * @returns {{ ok: boolean, problems: { code: string, key: string, with?: string }[] }}
 *   codes : outside wall door window opening (objet mal placé), collision (deux objets), blocked (porte ou zone d'accès coupée), pocket
 */
export function validateLayout(room, plan, items) {
  const grid = createRoomGrid(plan, room);
  const ceilingHeight = plan.wallHeight ?? DEFAULT_CEILING;
  const placed = items
    .filter((item) => item.roomId === room.id)
    .map((item) => createPlaced(DEFS.get(item.id), { x: item.x, y: item.y, rotation: item.rotation, key: item.key }, { ceilingHeight, elevation: item.elevation }));
  const problems = [];
  for (const object of placed) {
    for (const reason of checkPlacement(grid, object, { clearance: false }).reasons) if (reason !== 'object') problems.push({ code: reason, key: object.key });
  }
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      if (placementsConflict(placed[i], placed[j])) problems.push({ code: 'collision', key: placed[i].key, with: placed[j].key });
    }
  }
  for (const object of placed) addObject(grid, object);
  const zones = placed
    .filter((o) => o.layer === 'floor' && DEFS.get(o.id) && ACCESS_IDS.has(o.id) && o.clearanceFront > 0)
    .map((o) => ({ id: o.key, ...frontClearanceRect(o.footprint, o.clearanceFront) }));
  for (const violation of checkConnectivity(grid, { zones }).violations) problems.push({ code: violation.code === 'pocket' ? 'pocket' : 'blocked', key: violation.id ?? 'pocket' });
  return { ok: problems.length === 0, problems };
}

/** Objets de rangement dont le dégagement frontal doit rester accessible (voir les slots `access` des recettes). */
const ACCESS_IDS = new Set([...Object.values(RECIPES).flatMap((r) => r.slots.filter((s) => s.access).flatMap((s) => s.choices.map((c) => c.id))), 'kitchen-base', 'kitchen-sink', 'kitchen-hob', 'fridge']);


/* ------------------------------------------------------------------ */
/* 8. Logement entier : plan.furniture, verrous, couleurs de murs      */
/* ------------------------------------------------------------------ */

/**
 * Objet du générateur (PlacedItem de generateRoom) → objet stocké dans plan.furniture (voir core.js).
 * L'identifiant est « <roomId>:<clé> » ; la graine des variations est stockée dans variant.seed.
 */
export function toPlanItem(item) {
  const out = {
    id: `${item.roomId}:${item.key}`,
    defId: item.id,
    roomId: item.roomId,
    x: item.x,
    z: item.y,
    rotationY: item.rotation,
    role: item.role,
    variant: { seed: String(item.seed) },
  };
  if (item.elevation) out.y = item.elevation;
  return out;
}

/** Objet stocké dans plan.furniture → objet du générateur (pour validateLayout). */
export function fromPlanItem(item) {
  return {
    roomId: item.roomId,
    key: item.id.startsWith(`${item.roomId}:`) ? item.id.slice(item.roomId.length + 1) : item.id,
    id: item.defId,
    role: item.role ?? item.defId,
    group: null,
    optional: true,
    x: item.x,
    y: item.z,
    rotation: item.rotationY,
    elevation: item.y ?? 0,
    seed: Number(item.variant?.seed) || 0,
  };
}

/** Palette (identifiant) réellement utilisée : celle demandée si elle existe, sinon celle du plan. */
const presetOf = (plan, style) => (typeof style === 'string' && STYLE_DENSITY[style] !== undefined ? style : plan.style?.preset ?? 'scandinave');

/**
 * Génère le mobilier du logement et l'écrit dans plan.furniture (nouveau plan, l'ancien n'est pas modifié).
 * - Une seule palette pour tout le logement (plan.style.preset) ; plan.style.seed prend la graine.
 * - Les pièces verrouillées (plan.roomLocks) gardent leur mobilier ; les autres sont régénérées (une pièce sans recette n'a rien).
 * - `only` : liste d'identifiants de pièces à régénérer (les autres, verrouillées ou non, sont conservées) ; dans ce cas plan.style
 *   n'est pas modifié. Une pièce verrouillée n'est régénérée que si on la demande explicitement dans `only`.
 * @param {Plan} plan
 * @param {number | string} seed
 * @param {string} [style] identifiant de palette
 * @param {{ rooms?: Room[], only?: string[] | null }} [options]
 * @returns {{ plan: Plan, reports: Object<string, ReturnType<typeof generateRoomReport>> }}
 */
export function generateHome(plan, seed, style, { rooms = detectRooms(plan), only = null } = {}) {
  const preset = presetOf(plan, style);
  const targets = rooms.filter((room) => (only ? only.includes(room.id) : !isRoomLocked(plan, room)));
  const fresh = new Map();
  const reports = {};
  for (const room of targets) {
    const report = generateRoomReport(room, plan, seed, preset);
    reports[room.id] = report;
    fresh.set(room.id, report.items.map(toPlanItem));
  }
  const furniture = [];
  for (const room of rooms) {
    if (fresh.has(room.id)) furniture.push(...fresh.get(room.id));
    else for (const item of plan.furniture) if (item.roomId === room.id) furniture.push(item);
  }
  const next = { ...plan, furniture };
  if (!only) next.style = { ...plan.style, preset, seed: toSeed(seed) };
  return { plan: next, reports };
}

const ROLES_CACHE = new WeakMap();
/** Rôles que peut avoir un objet de cette recette (slots, plus les modules du planificateur de cuisine). */
function recipeRoles(recipe) {
  let roles = ROLES_CACHE.get(recipe);
  if (!roles) {
    roles = new Set(recipe.slots.map((slot) => slot.slot));
    if (recipe.planner) for (const role of Object.keys(K_SLOTS)) roles.add(role);
    ROLES_CACHE.set(recipe, roles);
  }
  return roles;
}

/**
 * Remet plan.furniture d'accord avec les pièces actuelles après une modification des murs, des ouvertures ou des types :
 * chaque objet est rattaché à la pièce qui contient son centre ; le mobilier d'une pièce est conservé s'il est encore valide
 * (validateLayout : dans la pièce, sans collision, portes dégagées) et si la pièce a encore une recette, sinon il est retiré.
 * Renvoie le même plan si rien ne change.
 * @param {Plan} plan
 * @param {Room[]} [rooms]
 */
export function reconcileFurniture(plan, rooms = detectRooms(plan)) {
  if (!plan.furniture.length) return plan;
  const cellSize = plan.grid.cellSize;
  const byCell = new Map();
  for (const room of rooms) for (const cell of room.cells) byCell.set(`${cell.x},${cell.y}`, room);
  const groups = new Map();
  for (const item of plan.furniture) {
    const room = byCell.get(`${Math.floor(item.x / cellSize)},${Math.floor(item.z / cellSize)}`);
    if (!room) continue;
    if (!groups.has(room.id)) groups.set(room.id, []);
    groups.get(room.id).push(item);
  }
  const kept = [];
  for (const room of rooms) {
    const list = groups.get(room.id);
    if (!list) continue;
    const recipe = RECIPES[getRoomType(plan, room)];
    // Les objets retouchés à la main (`manual`) ne dépendent pas de la recette de la pièce ; les autres, si.
    const generated = list.filter((item) => !item.manual);
    if (generated.some((item) => !DEFS.has(item.defId) || !recipe || !recipeRoles(recipe).has(item.role)) || list.some((item) => !DEFS.has(item.defId))) {
      if (!list.some((item) => item.manual)) continue;
    }
    const moved = list.map((item) => (item.roomId === room.id ? item : { ...item, roomId: room.id, id: `${room.id}:${fromPlanItem(item).key}` }));
    const layout = validateLayout(room, plan, moved.map(fromPlanItem));
    if (layout.ok) {
      kept.push(...moved);
    } else if (list.some((item) => item.manual)) {
      // Pièce retouchée à la main : on ne retire que les objets en faute (hors de la pièce, sur un mur, en collision…), pas toute la pièce.
      const bad = new Set();
      for (const problem of layout.problems) {
        if (problem.code === 'blocked' || problem.code === 'pocket') continue;
        bad.add(problem.key);
        if (problem.with) bad.add(problem.with);
      }
      kept.push(...moved.filter((item) => DEFS.has(item.defId) && (item.manual || !recipe || recipeRoles(recipe).has(item.role)) && !bad.has(fromPlanItem(item).key)));
    }
  }
  const same = kept.length === plan.furniture.length && kept.every((item, i) => item === plan.furniture[i]);
  return same ? plan : { ...plan, furniture: kept };
}

/** Retire le mobilier d'une pièce (ou le mobilier de toutes les pièces non verrouillées). Même plan si rien à retirer. */
export function removeFurniture(plan, rooms = detectRooms(plan), { keepLocked = true } = {}) {
  const locked = new Set(keepLocked ? rooms.filter((room) => isRoomLocked(plan, room)).map((room) => room.id) : []);
  const furniture = plan.furniture.filter((item) => locked.has(item.roomId));
  return furniture.length === plan.furniture.length ? plan : { ...plan, furniture };
}

/** Amplitude maximale (HSL, valeurs entre 0 et 1) de la variation de couleur des murs d'une pièce. */
export const ROOM_WALL_VARIATION = Object.freeze({ h: 0.05, s: 0.05, l: 0.03 });

/**
 * Petite variation de la couleur des murs d'une pièce, stable pour (graine du logement, pièce) : décalages de teinte,
 * de saturation et de luminosité à ajouter à la couleur de mur de la palette (valeurs HSL entre 0 et 1).
 * @returns {{ h: number, s: number, l: number }}
 */
export function roomWallVariation(seed, room) {
  const id = typeof room === 'string' ? room : room.id;
  const rng = createRng(hash(seed, `wall/${id}`));
  return { h: rng.range(-ROOM_WALL_VARIATION.h, ROOM_WALL_VARIATION.h), s: rng.range(-ROOM_WALL_VARIATION.s, ROOM_WALL_VARIATION.s), l: rng.range(-ROOM_WALL_VARIATION.l, ROOM_WALL_VARIATION.l) };
}

/* ------------------------------------------------------------------ */
/* 9. Lien de partage                                                  */
/* ------------------------------------------------------------------ */

/** Longueur au-delà de laquelle le lien « complet » est jugé trop long : on partage alors la version allégée. */
export const SHARE_MAX_LENGTH = 6000;

const sameFurnitureList = (a, b) => a.length === b.length && a.every((item, i) => JSON.stringify(item) === JSON.stringify(b[i]));

/** Remeuble un document sans mobilier avec la graine et la palette de son style (sans tenir compte des verrous), puis remet les verrous. */
function regenerateFurniture(doc) {
  let next = doc;
  doc.levels.forEach((_, i) => {
    const view = levelPlan(next, i);
    const free = { ...view, roomLocks: {}, furniture: [] };
    const { plan: furnished } = generateHome(free, view.style.seed, view.style.preset);
    next = withLevelPlan(next, i, { ...furnished, roomLocks: view.roomLocks ?? {} });
  });
  return next;
}

const countFurniture = (doc) => doc.levels.reduce((sum, level) => sum + level.furniture.length, 0);
const withoutFurniture = (doc) => ({ ...doc, levels: doc.levels.map((level) => (level.furniture.length ? { ...level, furniture: [] } : level)) });
const sameDocFurniture = (a, b) => a.levels.length === b.levels.length && a.levels.every((level, i) => sameFurnitureList(level.furniture, b.levels[i].furniture));

/**
 * Prépare le contenu d'un lien de partage. Le mobilier se régénère à l'identique à partir de la graine tant qu'il vient d'un seul
 * « Générer » (ni pièce régénérée à part, ni verrou, ni retouche à la main) ; dans ce cas on ne partage que murs, ouvertures, types, noms,
 * style et graine (« allégé », sans perte). Sinon : mobilier complet si le lien reste court, sinon version allégée avec un mobilier qui peut différer.
 * `compress` est la compression du texte vers un code court (lz-string en pratique) ; elle est injectée pour rester testable.
 * @param {object} input un document (ou un plan à un niveau)
 * @param {{ compress: (text: string) => string, maxLength?: number, name?: string }} options
 * @returns {{ code: string, mode: 'plan' | 'light' | 'full', lossless: boolean, length: number, furnitureCount: number }}
 *   mode : 'plan' (aucun mobilier), 'light' (mobilier à régénérer), 'full' (mobilier dans le lien) ; `lossless` faux = le mobilier recréé peut différer
 */
export function buildShare(input, { compress, maxLength = SHARE_MAX_LENGTH, name = '' }) {
  const doc = normalizeDocument(input);
  const pack = (p, light) => compress(JSON.stringify({ v: 1, light: light || undefined, name: name || undefined, plan: p }));
  const furnitureCount = countFurniture(doc);
  const done = (code, mode, lossless) => ({ code, mode, lossless, length: code.length, furnitureCount });
  if (!furnitureCount) return done(pack(doc, false), 'plan', true);
  const light = withoutFurniture(doc);
  if (sameDocFurniture(regenerateFurniture(light), doc)) return done(pack(light, true), 'light', true);
  const full = pack(doc, false);
  if (full.length <= maxLength) return done(full, 'full', true);
  return done(pack(light, true), 'light', false);
}

/**
 * Lit le code d'un lien de partage. Un plan « allégé » est remeublé avec sa graine et sa palette.
 * @param {string} code
 * @param {{ decompress: (code: string) => string | null, furnitureIds?: Iterable<string> | null }} options
 * @returns {{ ok: true, plan: object, name: string, regenerated: boolean, errors: [] } | { ok: false, errors: string[] }}
 *   `plan` est un document (tous les niveaux)
 */
export function readShare(code, { decompress, furnitureIds = null }) {
  let text = null;
  try {
    text = decompress(code);
  } catch {
    text = null;
  }
  if (!text) return { ok: false, errors: ['Ce lien de partage est incomplet ou abîmé : impossible de le décompresser.'] };
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['Ce lien de partage est abîmé : son contenu n\'est pas lisible.'] };
  }
  if (!data || typeof data !== 'object' || data.v !== 1 || typeof data.plan !== 'object' || data.plan === null) {
    return { ok: false, errors: ['Ce lien ne contient pas de plan Maison 3D (ou vient d\'une version plus récente).'] };
  }
  const result = readPlan(data.plan, { furnitureIds });
  if (!result.ok) return result;
  const name = typeof data.name === 'string' ? data.name.slice(0, 80) : '';
  if (!data.light) return { ok: true, plan: result.plan, name, regenerated: false, errors: [] };
  return { ok: true, plan: regenerateFurniture(result.plan), name, regenerated: true, errors: [] };
}

/* ------------------------------------------------------------------ */
/* 10. Visite à la première personne : monde de collision              */
/* ------------------------------------------------------------------ */

/** Hauteur des yeux, rayon du corps (cercle au sol) et pas maximal d'un mouvement, en mètres. */
export const WALK_EYE_HEIGHT = 1.6;
export const WALK_RADIUS = 0.22;
/** Un objet gêne le passage s'il est plus haut que ceci (marche : tapis, paillasson) et que son bas est sous cette hauteur (têtes). */
export const WALK_STEP = 0.3;
export const WALK_HEAD = 1.2;

/**
 * Obstacles de la visite, en mètres, dans le repère de la vue 3D (x, z) : rectangles { x0, z0, x1, z1, kind }.
 * - murs (épaisseur WALL_THICKNESS), fenêtres comprises (on ne passe pas par une fenêtre) ; les portes et passages restent libres ;
 * - mobilier posé au sol ou en hauteur moyenne ; ni les tapis (≤ 30 cm), ni les luminaires de plafond, ni les objets très hauts.
 * @param {import('./core.js').Plan} plan
 */
export function buildWalkWorld(plan) {
  const cs = plan.grid.cellSize;
  const half = WALL_THICKNESS / 2;
  const key = (e) => `${e.dir}${e.x},${e.y}`;
  const gaps = new Set();
  for (const opening of plan.openings) {
    if (opening.type === 'window') continue;
    for (const edge of openingEdges(opening)) gaps.add(key(edge));
  }
  const rects = [];
  for (const edge of plan.walls) {
    if (gaps.has(key(edge))) continue;
    const horizontal = edge.dir === 'h';
    const prev = { dir: edge.dir, x: edge.x - (horizontal ? 1 : 0), y: edge.y - (horizontal ? 0 : 1) };
    const next = { dir: edge.dir, x: edge.x + (horizontal ? 1 : 0), y: edge.y + (horizontal ? 0 : 1) };
    const before = gaps.has(key(prev)) ? 0 : half;
    const after = gaps.has(key(next)) ? 0 : half;
    const x = edge.x * cs;
    const z = edge.y * cs;
    rects.push(
      horizontal
        ? { x0: x - before, z0: z - half, x1: x + cs + after, z1: z + half, kind: 'wall' }
        : { x0: x - half, z0: z - before, x1: x + half, z1: z + cs + after, kind: 'wall' },
    );
  }
  for (const item of plan.furniture ?? []) {
    const def = FURNITURE_DATA.find((entry) => entry.id === item.defId);
    if (!def) continue;
    const placed = createPlaced(def, { x: item.x, y: item.z, rotation: item.rotationY }, { elevation: item.y });
    if (placed.top <= WALK_STEP || placed.bottom >= WALK_HEAD) continue;
    const f = placed.footprint;
    rects.push({ x0: f.x0, z0: f.y0, x1: f.x1, z1: f.y1, kind: 'furniture' });
  }
  for (const stair of plan.stairs ?? []) rects.push(...stairObstacles(stair).map((r) => ({ x0: r.x0, z0: r.y0, x1: r.x1, z1: r.y1, kind: 'rail' })));
  for (const well of plan.wells ?? []) rects.push(...wellRails(well));
  return { rects, width: plan.grid.width * cs, depth: plan.grid.height * cs };
}

/** Épaisseur des garde-corps autour d'une trémie, en mètres. */
export const WALK_RAIL = STAIR_RAIL;

/**
 * Garde-corps d'une trémie (l'escalier du niveau du dessous, vu de l'étage) : tout le contour sauf l'arrivée de l'escalier,
 * côté « haut de la montée », qui reste ouverte. Rectangles { x0, z0, x1, z1, kind: 'rail' } dans le repère de la vue 3D.
 */
export function wellRails(well) {
  return stairWellRails(well).map((r) => ({ x0: r.x0, z0: r.y0, x1: r.x1, z1: r.y1, kind: 'rail' }));
}

/** Le cercle (x, z, radius) touche-t-il un obstacle ? */
export function walkBlocked(world, x, z, radius = WALK_RADIUS) {
  for (const r of world.rects) {
    const dx = x - Math.min(Math.max(x, r.x0), r.x1);
    const dz = z - Math.min(Math.max(z, r.z0), r.z1);
    if (dx * dx + dz * dz < radius * radius - 1e-9) return true;
  }
  return false;
}

/**
 * Déplace le marcheur de `delta` en glissant le long des obstacles (le cercle est repoussé hors de chaque rectangle) et reste dans
 * la grille. Les grands déplacements sont découpés en pas de moins d'un demi-rayon : on ne traverse jamais un mur.
 * @returns {{ x: number, z: number, blocked: boolean }}
 */
export function moveWalker(world, position, delta, radius = WALK_RADIUS) {
  let { x, z } = position;
  const length = Math.hypot(delta.x, delta.z);
  const steps = Math.max(1, Math.ceil(length / (radius * 0.5)));
  let blocked = false;
  for (let s = 0; s < steps; s++) {
    const before = { x, z };
    x += delta.x / steps;
    z += delta.z / steps;
    for (let pass = 0; pass < 4; pass++) {
      let pushed = false;
      for (const r of world.rects) {
        const cx = Math.min(Math.max(x, r.x0), r.x1);
        const cz = Math.min(Math.max(z, r.z0), r.z1);
        const dx = x - cx;
        const dz = z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius - 1e-9) continue;
        if (d2 > 1e-12) {
          const k = (radius - Math.sqrt(d2)) / Math.sqrt(d2);
          x += dx * k;
          z += dz * k;
        } else {
          const gaps = [x - r.x0, r.x1 - x, z - r.z0, r.z1 - z];
          const m = Math.min(...gaps);
          if (m === gaps[0]) x = r.x0 - radius;
          else if (m === gaps[1]) x = r.x1 + radius;
          else if (m === gaps[2]) z = r.z0 - radius;
          else z = r.z1 + radius;
        }
        pushed = true;
        blocked = true;
      }
      if (!pushed) break;
    }
    x = Math.min(Math.max(x, radius), world.width - radius);
    z = Math.min(Math.max(z, radius), world.depth - radius);
    // Coincé entre deux obstacles (angle de meuble contre un mur) : les poussées ne suffisent pas, on reste où l'on était.
    if (walkBlocked(world, x, z, radius - 0.005)) {
      x = before.x;
      z = before.z;
      blocked = true;
    }
  }
  return { x, z, blocked };
}

/**
 * Point de départ de la visite : le centre de la pièce demandée (sinon le séjour, sinon la plus grande), déplacé au plus près
 * si un meuble l'occupe, et orienté vers la direction où l'on voit le plus loin. `yaw` : 0 regarde vers −z (nord du plan),
 * angle croissant vers la gauche, comme la caméra de Three.js.
 * @returns {{ x: number, z: number, yaw: number, roomId: string | null }}
 */
export function findWalkStart(plan, { roomId = null, rooms = detectRooms(plan), world = buildWalkWorld(plan) } = {}) {
  const cs = plan.grid.cellSize;
  const chosen =
    rooms.find((room) => room.id === roomId) ??
    rooms.find((room) => getRoomType(plan, room) === 'living') ??
    [...rooms].sort((a, b) => b.areaM2 - a.areaM2)[0] ??
    null;
  const extent = { x: (plan.grid.width * cs) / 2, z: (plan.grid.height * cs) / 2 };
  if (!chosen) return { x: extent.x, z: extent.z, yaw: 0, roomId: null };
  const inside = new Set(chosen.cells.map((cell) => `${cell.x},${cell.y}`));
  const centre = {
    x: ((chosen.bounds.minX + chosen.bounds.maxX) / 2) * cs,
    z: ((chosen.bounds.minY + chosen.bounds.maxY) / 2) * cs,
  };
  const margin = WALK_RADIUS + 0.08;
  const candidates = [];
  const step = 0.25;
  for (let x = chosen.bounds.minX * cs; x <= chosen.bounds.maxX * cs; x += step) {
    for (let z = chosen.bounds.minY * cs; z <= chosen.bounds.maxY * cs; z += step) {
      if (!inside.has(`${Math.floor(x / cs)},${Math.floor(z / cs)}`)) continue;
      if (walkBlocked(world, x, z, margin)) continue;
      if (onStairs(plan, x, z, 0.3)) continue;
      candidates.push({ x, z, d: Math.hypot(x - centre.x, z - centre.z) });
    }
  }
  candidates.sort((a, b) => a.d - b.d);
  const spot = candidates[0] ?? { ...centre };
  // Regarde dans la direction (parmi quatre) où le champ est le plus dégagé.
  let best = { yaw: 0, distance: -1 };
  for (const [yaw, dx, dz] of [[0, 0, -1], [Math.PI / 2, -1, 0], [Math.PI, 0, 1], [-Math.PI / 2, 1, 0]]) {
    let distance = 0;
    while (distance < 12 && !walkBlocked(world, spot.x + dx * distance, spot.z + dz * distance, 0.12)) distance += 0.1;
    if (distance > best.distance) best = { yaw, distance };
  }
  return { x: spot.x, z: spot.z, yaw: best.yaw, roomId: chosen.id };
}


const onStairs = (plan, x, z, margin = 0) => [...(plan.stairs ?? []), ...(plan.wells ?? [])].some((stair) => stairContains(stair, x, z, margin));

/* ---- Visite sur plusieurs niveaux ---- */

/**
 * Le bâtiment de la visite : pour chaque niveau, ses obstacles (buildWalkWorld), son altitude, et — aux étages — les cases où il y a un
 * plancher (on ne marche pas dans le vide).
 * @param {object} doc document (tous les niveaux)
 * @param {(index: number) => import('./core.js').Room[]} roomsOf pièces d'un niveau
 */
export function buildWalkBuilding(doc, roomsOf = (i) => detectRooms(levelPlan(doc, i))) {
  const levels = doc.levels.map((_, index) => {
    const plan = levelPlan(doc, index);
    const floor = index > 0 ? new Set(roomsOf(index).flatMap((room) => room.cells.map((cell) => `${cell.x},${cell.y}`))) : null;
    return { index, plan, world: buildWalkWorld(plan), floor, elevation: levelElevation(doc, index), stairs: plan.stairs ?? [], wells: plan.wells ?? [] };
  });
  return { levels, rise: stairRise(doc.wallHeight), cellSize: doc.grid.cellSize };
}

/**
 * Altitude du sol sous le marcheur (sans la hauteur des yeux) et ce qu'il y a dessous : 'floor', 'stair' (il monte, escalier de son
 * niveau) ou 'well' (il descend, escalier du niveau d'en dessous). `t` = part du dénivelé atteinte sur l'escalier (0 au pied, 1 en haut).
 */
export function walkGround(building, level, x, z) {
  const here = building.levels[level];
  for (const stair of here.stairs) {
    const t = stairClimb(stair, x, z);
    if (t !== null) return { kind: 'stair', y: here.elevation + building.rise * t, t };
  }
  const below = building.levels[level - 1];
  for (const well of here.wells) {
    const t = stairClimb(well, x, z);
    if (t !== null && below) return { kind: 'well', y: below.elevation + building.rise * t, t };
  }
  return { kind: 'floor', y: here.elevation, t: 0 };
}

function hasFloor(building, level, x, z) {
  const here = building.levels[level];
  if (!here.floor) return true;
  // Dans une trémie, on ne marche que sur les marches (le reste est un trou) ; sur l'escalier de son niveau aussi.
  for (const well of here.wells) if (stairContains(well, x, z)) return stairClimb(well, x, z) !== null;
  if (here.floor.has(`${Math.floor(x / building.cellSize)},${Math.floor(z / building.cellSize)}`)) return true;
  return here.stairs.some((stair) => stairClimb(stair, x, z) !== null);
}

/**
 * Un pas du marcheur dans le bâtiment : déplacement dans les obstacles du niveau (moveWalker), pas de marche dans le vide aux étages,
 * et changement de niveau au milieu d'un escalier (la hauteur est continue : seule la liste d'obstacles change).
 * @param {ReturnType<typeof buildWalkBuilding>} building
 * @param {{ level: number, x: number, z: number }} state
 * @param {{ x: number, z: number }} delta
 * @returns {{ level: number, x: number, z: number, y: number, blocked: boolean, kind: string }}
 */
export function stepWalker(building, state, delta) {
  const here = building.levels[state.level];
  let moved = moveWalker(here.world, state, delta);
  if (!hasFloor(building, state.level, moved.x, moved.z)) {
    const slides = [moveWalker(here.world, state, { x: delta.x, z: 0 }), moveWalker(here.world, state, { x: 0, z: delta.z })];
    const ok = slides.find((slide) => hasFloor(building, state.level, slide.x, slide.z));
    moved = { x: ok ? ok.x : state.x, z: ok ? ok.z : state.z, blocked: true };
  }
  let level = state.level;
  let ground = walkGround(building, level, moved.x, moved.z);
  if (ground.kind === 'stair' && ground.t > 0.55 && level + 1 < building.levels.length) level++;
  else if (ground.kind === 'well' && ground.t < 0.45) level--;
  if (level !== state.level) ground = walkGround(building, level, moved.x, moved.z);
  return { level, x: moved.x, z: moved.z, y: ground.y, blocked: moved.blocked, kind: ground.kind };
}

/** Point de départ de la visite sur le niveau `level` (voir findWalkStart) → { level, x, z, y, yaw, roomId }. */
export function findBuildingWalkStart(building, level, roomsOf, { roomId = null } = {}) {
  const here = building.levels[level];
  const start = findWalkStart(here.plan, { roomId, rooms: roomsOf(level), world: here.world });
  return { level, ...start, y: walkGround(building, level, start.x, start.z).y };
}

/* ------------------------------------------------------------------ */
/* 11. Mobilier à la main : déplacer, tourner, remplacer, ajouter       */
/* ------------------------------------------------------------------ */

/** Objets de décoration qui se posent sur un meuble. */
const SURFACE_ITEMS = new Set(['table-lamp', 'plant-small']);

/** Rôle d'un objet ajouté depuis le catalogue (il n'appartient à aucune recette de pièce). */
export const MANUAL_ROLE = 'manual';

const GRID_CACHE = new WeakMap(); // murs → ouvertures → escaliers → { pièce → grille }
/** Grille d'occupation d'une pièce, sans aucun objet : calculée une fois tant que les murs, les ouvertures et les escaliers ne changent pas. */
function emptyGrid(plan, room) {
  const bag = (map, key) => {
    let entry = map.get(key);
    if (!entry) map.set(key, (entry = new WeakMap()));
    return entry;
  };
  const stairs = plan.stairs ?? EMPTY;
  const wells = plan.wells ?? EMPTY;
  const byStairs = bag(bag(bag(GRID_CACHE, plan.walls), plan.openings), stairs);
  let byRoom = byStairs.get(wells);
  if (!byRoom) byStairs.set(wells, (byRoom = new Map()));
  const hit = byRoom.get(room.id);
  if (hit && hit.cells === room.cells.length) return hit.grid;
  const grid = createRoomGrid(plan, room);
  byRoom.set(room.id, { cells: room.cells.length, grid });
  return grid;
}
const EMPTY = Object.freeze([]);

const placedOf = (plan, item, def = DEFS.get(item.defId)) =>
  createPlaced(def, { x: item.x, y: item.z, rotation: item.rotationY, key: item.id }, { ceilingHeight: plan.wallHeight ?? DEFAULT_CEILING, elevation: item.y ?? (def.placement?.mode === 'ceiling' ? undefined : 0) });

const rectsTouch = (a, b) => a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.y0 < b.y1 - EPS && b.y0 < a.y1 - EPS;

/**
 * Un objet peut-il se trouver là ? Même contrôle que le générateur (pièce, murs, zones de porte et de fenêtre, autres objets, hauteurs) sans
 * exiger les dégagements frontaux ni la connexité, plus les escaliers et les trémies.
 * @param {Plan} plan vue du niveau
 * @param {Room[]} rooms pièces du niveau
 * @param {{ id?: string, defId: string, x: number, z: number, rotationY: number, y?: number }} item
 * @param {{ ignore?: string[], furniture?: PlacedItem[] }} [options] `ignore` : identifiants d'objets à ne pas compter ; `furniture` : les autres objets (plan.furniture par défaut)
 * @returns {{ ok: boolean, reasons: string[], room: Room | null, conflicts: string[] }}
 *   raisons : unknown, outside, wall, door, window, opening, object, stair
 */
export function checkFurniturePlacement(plan, rooms, item, { ignore = [], furniture = plan.furniture } = {}) {
  const def = DEFS.get(item.defId);
  if (!def) return { ok: false, reasons: ['unknown'], room: null, conflicts: [] };
  const cs = plan.grid.cellSize;
  const room = roomAtPoint(rooms, { x: item.x / cs, y: item.z / cs });
  if (!room) return { ok: false, reasons: ['outside'], room: null, conflicts: [] };
  const placed = placedOf(plan, item, def);
  const reasons = checkPlacement(emptyGrid(plan, room), placed, { clearance: false }).reasons.filter((reason) => reason !== 'object');
  const conflicts = [];
  for (const other of furniture) {
    if (other.roomId !== room.id || other.id === item.id || ignore.includes(other.id)) continue;
    const otherDef = DEFS.get(other.defId);
    if (otherDef && placementsConflict(placed, placedOf(plan, other, otherDef))) conflicts.push(other.id);
  }
  if (conflicts.length) reasons.push('object');
  if (placed.layer === 'floor') {
    // Sous un escalier ouvert, la grille de la pièce juge la hauteur libre ; les autres escaliers et trémies sont pleins.
    for (const stair of [...(plan.stairs ?? EMPTY).filter((item) => stairUnder(item) !== 'open'), ...(plan.wells ?? EMPTY)]) {
      if (stairRects(stair).some((r) => rectsTouch(placed.footprint, r))) {
        if (!reasons.includes('stair')) reasons.push('stair');
        break;
      }
    }
  }
  return { ok: reasons.length === 0, reasons, room, conflicts };
}

/** Objets posés sur `base` (lampe sur une commode…) : au sol dans la même pièce, centre au-dessus de l'empreinte, bas à la hauteur du dessus. */
export function itemsOnTop(plan, base) {
  const def = DEFS.get(base.defId);
  if (!def) return [];
  const fp = placedOf(plan, base, def).footprint;
  const top = (base.y ?? 0) + def.size.h;
  return plan.furniture.filter((other) => {
    if (other.id === base.id || other.roomId !== base.roomId || !(other.y > 0)) return false;
    const otherDef = DEFS.get(other.defId);
    if (!otherDef || layerOf(otherDef.placement?.mode) !== 'floor') return false;
    return Math.abs(other.y - top) < 0.06 && other.x >= fp.x0 - EPS && other.x <= fp.x1 + EPS && other.z >= fp.y0 - EPS && other.z <= fp.y1 + EPS;
  });
}

const keyOf = (item) => (item.id.startsWith(`${item.roomId}:`) ? item.id.slice(item.roomId.length + 1) : item.id);

function freeId(furniture, roomId, key, own = null) {
  const used = new Set(furniture.filter((item) => item.id !== own).map((item) => item.id));
  let id = `${roomId}:${key}`;
  for (let n = 2; used.has(id); n++) id = `${roomId}:${key}~${n}`;
  return id;
}

/** Verrouille les pièces touchées par une retouche à la main : le générateur n'y touche plus (le cadenas se rouvre à la main). */
function lockRooms(plan, rooms, roomIds) {
  let next = plan;
  for (const id of new Set(roomIds)) {
    const room = rooms.find((r) => r.id === id);
    if (room) next = setRoomLock(next, room, true);
  }
  return next;
}

const refuse = (plan, reasons) => ({ ok: false, plan, reasons, id: null });

/**
 * Retouche un objet : position (`x`, `z`), rotation (`rotationY`), modèle (`defId`), aspect (`seed`). Les objets posés dessus suivent. L'objet et les
 * pièces touchées sont marqués : `manual: true` sur l'objet, pièce verrouillée. Refusé (même plan) si le résultat n'est pas valide.
 * @returns {{ ok: boolean, plan: Plan, reasons: string[], id: string | null }} `id` : nouvel identifiant de l'objet (il change avec la pièce)
 */
export function editFurniture(plan, rooms, id, change) {
  const base = plan.furniture.find((item) => item.id === id);
  if (!base) return refuse(plan, ['unknown']);
  const oldDef = DEFS.get(base.defId);
  const newDef = change.defId ? DEFS.get(change.defId) : oldDef;
  if (!oldDef || !newDef) return refuse(plan, ['unknown']);
  const rotationY = change.rotationY === undefined ? base.rotationY : normalizeRotation(change.rotationY);
  const next = { ...base, rotationY, defId: newDef.id };
  next.x = r6(change.x ?? base.x);
  next.z = r6(change.z ?? base.z);
  if (change.defId && change.defId !== base.defId) {
    // Un objet contre un mur garde son dos contre le mur : la profondeur en plus (ou en moins) se prend sur l'avant.
    const front = facingVector(rotationY);
    const shift = (newDef.size.d - oldDef.size.d) / 2;
    if (['wall', 'wall-mounted', 'corner'].includes(newDef.placement?.mode)) {
      next.x = r6(next.x + front.x * shift);
      next.z = r6(next.z + front.y * shift);
    }
    const mode = newDef.placement?.mode;
    if (mode === 'ceiling') next.y = r6((plan.wallHeight ?? DEFAULT_CEILING) - newDef.size.h);
    else if (mode === 'wall-mounted') next.y = newDef.placement.mountHeight ?? base.y ?? 0;
    else if (base.y && layerOf(oldDef.placement?.mode) === 'floor') next.y = base.y;
    else delete next.y;
  }
  if (change.seed !== undefined) next.variant = { ...(base.variant ?? {}), seed: String(toSeed(change.seed)) };

  // Les objets posés dessus tournent et se déplacent avec lui.
  const turns = (((rotationY - base.rotationY) % 360) + 360) % 360;
  const carried = change.defId && change.defId !== base.defId ? [] : itemsOnTop(plan, base);
  // rotationY 0 : l'avant est vers +y du plan ; 90 : vers +x. Un quart de tour envoie donc (dx, dz) sur (dz, -dx).
  const turn = (dx, dz) => (turns === 0 ? { dx, dz } : turns === 90 ? { dx: dz, dz: -dx } : turns === 180 ? { dx: -dx, dz: -dz } : { dx: -dz, dz: dx });
  const originals = [base, ...carried];
  const candidates = [
    next,
    ...carried.map((item) => {
      const r = turn(item.x - base.x, item.z - base.z);
      return { ...item, x: r6(next.x + r.dx), z: r6(next.z + r.dz), rotationY: (item.rotationY + turns) % 360 };
    }),
  ];
  const others = plan.furniture.filter((item) => !originals.some((o) => o.id === item.id));
  const placedItems = [];
  const touched = [base.roomId];
  for (const [index, candidate] of candidates.entries()) {
    const result = checkFurniturePlacement(plan, rooms, candidate, { furniture: [...others, ...placedItems] });
    if (!result.ok) return { ...refuse(plan, result.reasons), conflicts: result.conflicts };
    const original = originals[index];
    const roomId = result.room.id;
    touched.push(roomId);
    const item = { ...candidate, roomId, id: roomId === original.roomId ? original.id : freeId([...others, ...placedItems], roomId, keyOf(original)), manual: true };
    if (item.role === undefined) item.role = MANUAL_ROLE;
    placedItems.push(item);
  }
  const byOldId = new Map(originals.map((o, i) => [o.id, placedItems[i]]));
  const replaced = plan.furniture.map((item) => byOldId.get(item.id) ?? item);
  return { ok: true, plan: lockRooms({ ...plan, furniture: replaced }, rooms, touched), reasons: [], id: placedItems[0].id };
}

/** Fait pivoter un objet d'un quart de tour (par défaut dans le sens horaire) autour de son centre. */
export function rotateFurniture(plan, rooms, id, delta = 90) {
  const base = plan.furniture.find((item) => item.id === id);
  return base ? editFurniture(plan, rooms, id, { rotationY: base.rotationY + delta }) : refuse(plan, ['unknown']);
}

/**
 * Ajoute un objet du catalogue au point (x, z) en mètres. Un objet de décoration (lampe, plante) est posé sur le meuble qui se trouve dessous.
 * L'objet est `manual` et la pièce se verrouille. Même plan si l'emplacement n'est pas valide.
 * @param {{ defId: string, x: number, z: number, rotationY?: number }} spec
 */
export function addFurnitureItem(plan, rooms, spec) {
  const def = DEFS.get(spec.defId);
  if (!def) return refuse(plan, ['unknown']);
  const rotationY = normalizeRotation(spec.rotationY ?? 0);
  const item = { defId: def.id, x: r6(spec.x), z: r6(spec.z), rotationY };
  const mode = def.placement?.mode;
  if (mode === 'ceiling') item.y = r6((plan.wallHeight ?? DEFAULT_CEILING) - def.size.h);
  else if (mode === 'wall-mounted') item.y = def.placement.mountHeight ?? 0;
  else if (layerOf(mode) === 'floor') {
    // Posé sur un meuble qui l'autorise (lampe sur une commode, plante sur une console).
    if (SURFACE_ITEMS.has(def.id)) {
      for (const other of plan.furniture) {
        const otherDef = DEFS.get(other.defId);
        if (!otherDef || layerOf(otherDef.placement?.mode) !== 'floor' || !(otherDef.size.h > STEP_HEIGHT) || !(otherDef.placement?.canOverlap ?? []).includes(def.id)) continue;
        const { footprint } = placedOf(plan, other, otherDef);
        if (footprint.x0 <= item.x && item.x <= footprint.x1 && footprint.y0 <= item.z && item.z <= footprint.y1) {
          item.y = r6((other.y ?? 0) + otherDef.size.h);
          break;
        }
      }
    }
  }
  const result = checkFurniturePlacement(plan, rooms, { ...item, id: 'new' });
  if (!result.ok) return refuse(plan, result.reasons);
  const roomId = result.room.id;
  const id = freeId(plan.furniture, roomId, `${def.id}#m${plan.furniture.filter((o) => o.roomId === roomId && o.manual).length + 1}`);
  const placed = { id, defId: def.id, roomId, x: item.x, z: item.z, rotationY, role: MANUAL_ROLE, variant: { seed: String(hash(plan.style?.seed ?? 1, id)) }, manual: true };
  if (item.y) placed.y = item.y;
  return { ok: true, plan: lockRooms({ ...plan, furniture: [...plan.furniture, placed] }, rooms, [roomId]), reasons: [], id };
}

/** Copie un objet à côté de l'original, au premier emplacement valide (à droite, en bas, à gauche, en haut, puis plus loin). */
export function duplicateFurniture(plan, rooms, id) {
  const base = plan.furniture.find((item) => item.id === id);
  const def = base && DEFS.get(base.defId);
  if (!base || !def) return refuse(plan, ['unknown']);
  const fp = placedOf(plan, base, def).footprint;
  const gap = 0.05;
  const offsets = [];
  for (const k of [1, 2]) offsets.push([k * (fp.ex + gap), 0], [0, k * (fp.ey + gap)], [-k * (fp.ex + gap), 0], [0, -k * (fp.ey + gap)]);
  let last = ['outside'];
  for (const [dx, dz] of offsets) {
    const result = addFurnitureItem(plan, rooms, { defId: base.defId, x: base.x + dx, z: base.z + dz, rotationY: base.rotationY });
    if (result.ok) return result;
    last = result.reasons;
  }
  return refuse(plan, last);
}

/** Supprime un objet (et ceux qui sont posés dessus). La pièce se verrouille : le générateur ne le remet pas. */
export function deleteFurnitureItem(plan, rooms, id) {
  const base = plan.furniture.find((item) => item.id === id);
  if (!base) return refuse(plan, ['unknown']);
  const gone = new Set([id, ...itemsOnTop(plan, base).map((item) => item.id)]);
  return { ok: true, plan: lockRooms({ ...plan, furniture: plan.furniture.filter((item) => !gone.has(item.id)) }, rooms, [base.roomId]), reasons: [], id: null };
}

/** Objets du catalogue qui peuvent remplacer `defId` (ses familles). */
export const replacementsFor = (defId) => variantsOf(defId);
