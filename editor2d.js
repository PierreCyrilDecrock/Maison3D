// editor2d.js — éditeur de plan 2D (Canvas) : rendu, zoom / déplacement et événements pointer.
// Aucune logique métier ici : les calculs (grille, murs, vue) sont dans core.js
// et toute modification du plan passe par les actions du store.
import {
  WALL_THICKNESS,
  alignToAxis,
  clampView,
  createStairSpec,
  findOpeningAt,
  findOpeningPlacement,
  findStairAt,
  findWallEdgeNear,
  fitView,
  getRoomType,
  levelPlan,
  openingAxes,
  openingSegment,
  panView,
  roomAtPoint,
  roomColor,
  roomLabel,
  screenToGrid,
  segmentEdges,
  segmentLengthM,
  snapToGrid,
  stairLayout,
  stairOutline,
  stairStepCount,
  stairUnder,
  stairVector,
  wallRects,
  wallRectsWithOpenings,
  zoomAt,
} from './core.js';
import { FURNITURE_DATA } from './furniture.js';

const DEFS = new Map(FURNITURE_DATA.map((def) => [def.id, def]));

const RULER = { top: 28, left: 40 }; // bandes des règles graduées, en px
const FIT_PADDING = 14; // marge autour de la grille quand on cadre la vue
const MIN_TOLERANCE_PX = 5; // portée minimale de la gomme et des ouvertures, même quand une case ne fait que quelques pixels (grille fine)
const FURNITURE_NUDGE = 0.1; // flèches du clavier : 10 cm ; avec Maj : 50 cm
const WALL_CONTACT = 0.1; // dos d'un meuble contre un mur : demi-épaisseur du mur + marge de 5 cm
const MIN_WALL_PX = 1.5; // un mur reste visible même très dézoomé
const AXIS_X = '#e5484d'; // même code couleur que les axes de la vue 3D (x rouge)
const AXIS_Y = '#3e7bfa'; // l'axe y du plan devient l'axe z (bleu) en 3D
const TOLERANCE_PX = { touch: 18, pen: 14, mouse: 9 }; // portée de la gomme selon le pointeur
const MAX_TOLERANCE_CELLS = 0.6; // jamais plus d'une demi-case et demie, pour ne pas gommer le mur voisin

const OPENING_TOOLS = ['door', 'window', 'passage'];
/** Trait fort tous les 2 m (grille de 0,5 m) ou tous les mètres (grille fine) ; à 0,1 m, un trait moyen tous les 50 cm. */
const majorEvery = (grid) => (grid.cellSize < 0.3 ? 10 : 4);
const CATEGORY_HUE = { salon: 28, 'salle-a-manger': 205, cuisine: 150, chambre: 265, 'salle-de-bain': 188, bureau: 45, entree: 8, buanderie: 222, decoration: 100 };
const TAP_KINDS = ['room', 'opening', 'stair-place', 'item-place', 'item-empty'];
const TAP_SLOP_PX = { touch: 10, pen: 8, mouse: 5 }; // au-delà, un glissé de l'outil Pièce déplace la vue au lieu d'ouvrir le menu
const areaFormat = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const rulerFormat = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const lengthFormat = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });

const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const snap = (value) => Math.round(value) + 0.5; // aligne un trait de 1 px sur la grille de pixels
const isDark = (hex) => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? (0.299 * parseInt(m[1], 16) + 0.587 * parseInt(m[2], 16) + 0.114 * parseInt(m[3], 16)) / 255 < 0.45 : false;
};
const r6 = (v) => Math.round(v * 1e6) / 1e6;

/** Décalage (m) qui amène l'un des deux bords [a0, a1] sur la grille de `step`, ou à 10 cm d'une ligne de la grille (dos contre un mur). */
function snapSpan(a0, a1, step) {
  const offsets = step > WALL_CONTACT + 1e-9 ? [0, WALL_CONTACT, -WALL_CONTACT] : [0];
  let best = 0;
  let bestAbs = Infinity;
  for (const edge of [a0, a1]) {
    const base = Math.round(edge / step);
    for (const k of [-1, 0, 1]) {
      for (const o of offsets) {
        const delta = (base + k) * step + o - edge;
        if (Math.abs(delta) < bestAbs - 1e-9) {
          bestAbs = Math.abs(delta);
          best = delta;
        }
      }
    }
  }
  return best;
}

/** Empreinte au sol d'un objet du plan : { def, ex, ey, x0, y0, x1, y1 } en mètres. */
function itemBox(item) {
  const def = DEFS.get(item.defId);
  if (!def) return null;
  const swapped = item.rotationY === 90 || item.rotationY === 270;
  const ex = swapped ? def.size.d : def.size.w;
  const ey = swapped ? def.size.w : def.size.d;
  return { def, ex, ey, x0: item.x - ex / 2, y0: item.z - ey / 2, x1: item.x + ex / 2, y1: item.z + ey / 2 };
}

const FRONT = { 0: { x: 0, y: 1 }, 90: { x: 1, y: 0 }, 180: { x: 0, y: -1 }, 270: { x: -1, y: 0 } };
/** Ordre de dessin : tapis, meubles au sol, objets posés dessus, puis objets muraux et plafonniers. */
const layerRank = (item) => {
  const def = DEFS.get(item.defId);
  const mode = def?.placement?.mode;
  if (mode === 'ceiling') return 4;
  if (mode === 'wall-mounted' || mode === 'window') return 3;
  if (item.y > 0) return 2;
  return def && def.size.h <= 0.1 ? 0 : 1;
};

/**
 * @param {HTMLCanvasElement} canvas
 * @param {ReturnType<typeof import('./store.js').createStore>} store
 * @param {{ onRoomTap?: (tap: { room: import('./core.js').Room | null, point: { x: number, y: number }, size: { w: number, h: number } }) => void }} [options]
 *   onRoomTap : appelé quand on touche le plan avec l'outil Pièce (room vaut null hors de toute pièce) ; point est en pixels du canvas.
 */
export function createEditor2D(canvas, store, options = {}) {
  let ctx = canvas.getContext('2d'); // remplacé le temps d'un export d'image (exportImage)
  if (!ctx) throw new Error('Le Canvas 2D est indisponible dans ce navigateur.');

  const size = { w: 0, h: 0 };
  let view = { cell: 10, ox: 0, oy: 0 };
  let viewMoved = false; // vrai dès que la personne a zoomé ou déplacé : on ne recadre plus tout seul
  let frame = 0;
  let palette = null;

  const pointers = new Map(); // pointerId → { x, y, type }
  let gesture = null; // zoom / déplacement à deux doigts : { cx, cy, dist }
  let drag = null; // geste à un doigt : { kind: 'wall' | 'erase' | 'room' | 'opening' | 'pan', pointerId, ... }
  let hoverPlacement = null; // aperçu d'ouverture sous la souris (au doigt, l'aperçu vit dans le store)
  const runCache = new WeakMap(); // pièce → bandes de cases à remplir
  const outlineCache = new WeakMap(); // pièce → segments de son contour
  let preview = null; // tracé de mur en cours : { from, to } (points de grille)
  let lastPointer = null; // dernière position connue, pour l'aperçu au survol
  let hovering = false;
  let spaceHeld = false;
  let lastTool = store.getState().tool;
  let stairStyle = { kind: 'straight', turn: 'left', under: 'solid', frame: 'stringer', rail: 'wood', finish: 'oak' }; // style de l'escalier à poser
  let stairDir = 'n'; // sens de montée de l'escalier à poser (flèche vers le haut de l'écran au départ)

  /* -------------------------------- Géométrie -------------------------------- */

  const area = () => ({ x: RULER.left, y: RULER.top, w: size.w - RULER.left, h: size.h - RULER.top });
  const gridOf = () => store.getState().plan.grid;
  const toGrid = (point) => screenToGrid(view, point);
  const snapped = (point) => snapToGrid(toGrid(point), gridOf());
  const tolerance = (type) => Math.max(Math.min((TOLERANCE_PX[type] ?? TOLERANCE_PX.mouse) / view.cell, MAX_TOLERANCE_CELLS), MIN_TOLERANCE_PX / view.cell);

  function localPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function setView(next) {
    view = clampView(next, gridOf(), area());
    viewMoved = true;
  }

  function fit() {
    viewMoved = false;
    view = fitView(gridOf(), area(), FIT_PADDING);
    redraw();
  }

  /* --------------------------------- Rendu ---------------------------------- */

  function colors() {
    palette ??= {
      paper: cssVar('--paper'),
      sheet: cssVar('--sheet'),
      minor: cssVar('--grid-minor'),
      major: cssVar('--grid-major'),
      ink: cssVar('--ink'),
      soft: cssVar('--ink-soft'),
      accent: cssVar('--accent'),
      bad: cssVar('--bad'),
      warn: cssVar('--warn') || '#b45309',
      dark: isDark(cssVar('--paper')),
      roomTone: { sat: Number.parseFloat(cssVar('--room-sat')) || 70, light: Number.parseFloat(cssVar('--room-light')) || 86 },
      body: cssVar('--font-body') || 'sans-serif',
      mono: cssVar('--font-mono') || 'monospace',
    };
    return palette;
  }

  function fillRects(rects, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const r of rects) ctx.rect(view.ox + r.x * view.cell, view.oy + r.y * view.cell, r.w * view.cell, r.h * view.cell);
    ctx.fill();
  }

  function drawGrid(c, grid, drawUnderLines) {
    const a = area();
    const { cell, ox, oy } = view;
    const gw = grid.width * cell;
    const gh = grid.height * cell;
    ctx.fillStyle = c.sheet;
    ctx.fillRect(ox, oy, gw, gh);
    drawUnderLines?.(); // les pièces colorées passent sous les traits de la grille

    const first = (origin, start) => Math.max(0, Math.floor((start - origin) / cell));
    const last = (origin, end, max) => Math.min(max, Math.ceil((end - origin) / cell));
    const i0 = first(ox, a.x);
    const i1 = last(ox, a.x + a.w, grid.width);
    const j0 = first(oy, a.y);
    const j1 = last(oy, a.y + a.h, grid.height);
    const top = Math.max(oy, a.y);
    const bottom = Math.min(oy + gh, a.y + a.h);
    const left = Math.max(ox, a.x);
    const right = Math.min(ox + gw, a.x + a.w);

    ctx.lineWidth = 1;
    ctx.lineCap = 'butt';
    const MAJOR_EVERY = majorEvery(grid);
    const fine = grid.cellSize < 0.3;
    // Traits fins : une ligne par case, masquée quand elle serait trop serrée (en grille fine : un trait tous les 5 cases, soit 50 cm, puis rien).
    const minorStride = cell >= (fine ? 7 : 6) ? 1 : fine && cell * 5 >= 6 ? 5 : 0;
    if (minorStride) {
      ctx.strokeStyle = c.minor;
      ctx.beginPath();
      for (let i = Math.ceil(i0 / minorStride) * minorStride; i <= i1; i += minorStride) {
        if (i % MAJOR_EVERY === 0) continue;
        const x = snap(ox + i * cell);
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
      }
      for (let j = Math.ceil(j0 / minorStride) * minorStride; j <= j1; j += minorStride) {
        if (j % MAJOR_EVERY === 0) continue;
        const y = snap(oy + j * cell);
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
      }
      ctx.stroke();
    }

    // Traits forts : tous les 2 m (tous les mètres en grille fine).
    ctx.strokeStyle = c.major;
    ctx.beginPath();
    for (let i = Math.ceil(i0 / MAJOR_EVERY) * MAJOR_EVERY; i <= i1; i += MAJOR_EVERY) {
      const x = snap(ox + i * cell);
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    for (let j = Math.ceil(j0 / MAJOR_EVERY) * MAJOR_EVERY; j <= j1; j += MAJOR_EVERY) {
      const y = snap(oy + j * cell);
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    }
    ctx.stroke();

    // Cadre de la grille.
    ctx.strokeStyle = c.ink;
    ctx.strokeRect(snap(ox), snap(oy), Math.round(gw), Math.round(gh));
  }

  /** Origine (0, 0) et axes de 1 m : x vers la droite, y vers le bas (z en 3D). */
  function drawAxes(c, grid) {
    const { ox, oy, cell } = view;
    const length = Math.max(24, (1 / grid.cellSize) * cell);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = AXIS_X;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + length, oy);
    ctx.stroke();
    ctx.strokeStyle = AXIS_Y;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox, oy + length);
    ctx.stroke();
    ctx.fillStyle = c.ink;
    ctx.beginPath();
    ctx.arc(ox, oy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `500 11px ${c.mono}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = AXIS_X;
    ctx.fillText('x', ox + length + 5, oy + 9);
    ctx.fillStyle = AXIS_Y;
    ctx.fillText('y', ox + 8, oy + length + 6);
  }

  /** Bandes horizontales de cases d'une pièce : { x, y, n } (n cases de large). */
  function runsOf(room) {
    let runs = runCache.get(room);
    if (!runs) {
      runs = [];
      for (const { x, y } of room.cells) {
        const last = runs[runs.length - 1];
        if (last && last.y === y && last.x + last.n === x) last.n++;
        else runs.push({ x, y, n: 1 });
      }
      runCache.set(room, runs);
    }
    return runs;
  }

  function roomPath(room) {
    ctx.beginPath();
    for (const run of runsOf(room)) ctx.rect(view.ox + run.x * view.cell, view.oy + run.y * view.cell, run.n * view.cell, view.cell);
  }

  /** Segments (en cases) du contour d'une pièce : les côtés de cases sans case voisine dans la même pièce. */
  function outlineOf(room, grid) {
    let segments = outlineCache.get(room);
    if (!segments) {
      const inside = new Set(room.cells.map((cell) => cell.y * grid.width + cell.x));
      const has = (x, y) => x >= 0 && y >= 0 && x < grid.width && y < grid.height && inside.has(y * grid.width + x);
      segments = [];
      for (const { x, y } of room.cells) {
        if (!has(x, y - 1)) segments.push([x, y, x + 1, y]);
        if (!has(x, y + 1)) segments.push([x, y + 1, x + 1, y + 1]);
        if (!has(x - 1, y)) segments.push([x, y, x, y + 1]);
        if (!has(x + 1, y)) segments.push([x + 1, y, x + 1, y + 1]);
      }
      outlineCache.set(room, segments);
    }
    return segments;
  }

  /** Remplissage pastel de chaque pièce selon son type, puis survol et sélection. */
  function drawRooms(c, plan, rooms, hoverId, selectedId) {
    for (const room of rooms) {
      ctx.fillStyle = roomColor(getRoomType(plan, room), c.roomTone);
      roomPath(room);
      ctx.fill();
    }
    const hovered = hoverId && hoverId !== selectedId ? rooms.find((room) => room.id === hoverId) : null;
    if (hovered) {
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = c.accent;
      roomPath(hovered);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    const selected = selectedId ? rooms.find((room) => room.id === selectedId) : null;
    if (selected) {
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = c.accent;
      roomPath(selected);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  /** Contour épais de la pièce sélectionnée, dessiné au-dessus des murs. */
  function drawSelectionOutline(c, grid, rooms, selectedId) {
    const selected = selectedId ? rooms.find((room) => room.id === selectedId) : null;
    if (!selected) return;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of outlineOf(selected, grid)) {
      ctx.moveTo(view.ox + x1 * view.cell, view.oy + y1 * view.cell);
      ctx.lineTo(view.ox + x2 * view.cell, view.oy + y2 * view.cell);
    }
    ctx.stroke();
  }

  /** Nom et surface au centre de chaque pièce, réduits ou omis quand la pièce est trop petite à l'écran. */
  function drawRoomLabels(c, plan, rooms) {
    if (view.cell / plan.grid.cellSize < 14) return; // 7 px par demi-mètre au moins
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const room of rooms) {
      const widthPx = (room.bounds.maxX - room.bounds.minX) * view.cell - 6;
      const heightPx = (room.bounds.maxY - room.bounds.minY) * view.cell;
      let name = roomLabel(plan, room);
      let size = Math.min(15, Math.max(9, (view.cell / plan.grid.cellSize) * 0.4));
      ctx.font = `600 ${size}px ${c.body}`;
      let width = ctx.measureText(name).width;
      while (width > widthPx && size > 9) {
        size -= 1;
        ctx.font = `600 ${size}px ${c.body}`;
        width = ctx.measureText(name).width;
      }
      while (width > widthPx && name.length > 3) {
        name = `${name.slice(0, -2).trimEnd()}…`;
        width = ctx.measureText(name).width;
      }
      if (width > widthPx) continue; // trop étroite pour un libellé lisible
      const area = `${areaFormat.format(room.areaM2)} m²`;
      const areaFont = `500 ${Math.max(9, size - 2)}px ${c.mono}`;
      const centre = { x: view.ox + room.labelPoint.x * view.cell, y: view.oy + room.labelPoint.y * view.cell };
      const withArea = heightPx >= size * 2.9;
      const halo = roomColor(getRoomType(plan, room), c.roomTone, 0.85);
      const line = (text, font, y, color) => {
        ctx.font = font;
        ctx.lineWidth = 3;
        ctx.strokeStyle = halo;
        ctx.strokeText(text, centre.x, y);
        ctx.fillStyle = color;
        ctx.fillText(text, centre.x, y);
      };
      line(name, `600 ${size}px ${c.body}`, withArea ? centre.y - size * 0.6 : centre.y, c.ink);
      if (withArea) line(area, areaFont, centre.y + size * 0.75, c.soft);
    }
  }

  /** Extrémités libres des contours qui ne ferment aucune pièce : petits cercles d'avertissement. */
  function drawOpenEnds(c, outlines) {
    if (outlines.length === 0) return;
    ctx.strokeStyle = c.warn;
    ctx.fillStyle = c.warn;
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    for (const { ends } of outlines) {
      for (const end of ends) {
        const x = view.ox + end.x * view.cell;
        const y = view.oy + end.y * view.cell;
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    for (const { ends } of outlines) {
      for (const end of ends) {
        ctx.beginPath();
        ctx.arc(view.ox + end.x * view.cell, view.oy + end.y * view.cell, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** Rectangle (en cases) autour de l'axe d'une ouverture, `t` cases d'épaisseur. */
  function openingRect(opening, t) {
    const { x1, y1, x2, y2 } = openingSegment(opening);
    return x1 === x2 ? { x: x1 - t / 2, y: y1, w: t, h: y2 - y1 } : { x: x1, y: y1 - t / 2, w: x2 - x1, h: t };
  }

  /**
   * Symbole conventionnel d'une ouverture : porte = vantail ouvert et arc de cercle, fenêtre = double trait dans
   * l'épaisseur du mur, passage = interruption du mur avec un pointillé au sol. Le mur est déjà interrompu dessous.
   */
  function drawOpening(opening, grid, c, { color = c.ink, ghost = false, selected = false } = {}) {
    const { x1, y1, x2, y2 } = openingSegment(opening);
    const hinge = { x: view.ox + x1 * view.cell, y: view.oy + y1 * view.cell };
    const end = { x: view.ox + x2 * view.cell, y: view.oy + y2 * view.cell };
    const width = Math.hypot(end.x - hinge.x, end.y - hinge.y);
    const thick = Math.max(wallThickness(grid) * view.cell, 4);
    const { u, side } = openingAxes(opening);
    ctx.save();
    if (selected) {
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = c.accent;
      const reach = opening.type === 'door' ? width : 0;
      const pad = 6;
      const left = Math.min(hinge.x, end.x, hinge.x + side.x * reach) - (u.y === 0 ? 0 : thick) - pad;
      const top = Math.min(hinge.y, end.y, hinge.y + side.y * reach) - (u.x === 0 ? 0 : thick) - pad;
      const right = Math.max(hinge.x, end.x, hinge.x + side.x * reach) + (u.y === 0 ? 0 : thick) + pad;
      const bottom = Math.max(hinge.y, end.y, hinge.y + side.y * reach) + (u.x === 0 ? 0 : thick) + pad;
      ctx.beginPath();
      ctx.rect(left, top, right - left, bottom - top);
      ctx.fill();
    }
    ctx.globalAlpha = ghost ? 0.85 : 1;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'butt';
    if (opening.type === 'window') {
      const rect = { x: Math.min(hinge.x, end.x), y: Math.min(hinge.y, end.y), w: Math.abs(end.x - hinge.x), h: Math.abs(end.y - hinge.y) };
      if (u.x === 1) {
        rect.y -= thick / 2;
        rect.h = thick;
      } else {
        rect.x -= thick / 2;
        rect.w = thick;
      }
      ctx.fillStyle = c.sheet;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.lineWidth = 1;
      ctx.beginPath(); // la vitre : un trait au milieu, d'où le « double trait »
      ctx.moveTo(hinge.x, hinge.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    } else if (opening.type === 'door') {
      const tip = { x: hinge.x + side.x * width, y: hinge.y + side.y * width };
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hinge.x, hinge.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(hinge.x, hinge.y, width, Math.atan2(u.y, u.x), Math.atan2(side.y, side.x), u.x * side.y - u.y * side.x < 0);
      ctx.stroke();
    } else {
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hinge.x, hinge.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Aperçu d'une ouverture (souris au survol, ou premier toucher) avec sa largeur en mètres. */
  function drawOpeningGhost(spec, grid, c) {
    const opening = { id: 'ghost', ...spec };
    drawOpening(opening, grid, c, { color: c.accent, ghost: true });
    const { x1, y1, x2, y2 } = openingSegment(opening);
    const mid = { x: view.ox + ((x1 + x2) / 2) * view.cell, y: view.oy + ((y1 + y2) / 2) * view.cell };
    const { side } = openingAxes(opening);
    const label = `${lengthFormat.format(spec.span * grid.cellSize)} m`;
    pill(label, mid.x - side.x * 34, mid.y - side.y * 26, c);
  }

  /** Zones de dégagement des portes (aide au débogage) : rectangles hachurés en couleur d'avertissement. */
  function drawClearance(c, grid) {
    ctx.save();
    ctx.fillStyle = c.warn;
    ctx.strokeStyle = c.warn;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    for (const zone of store.getClearanceZones()) {
      const x = view.ox + (zone.x / grid.cellSize) * view.cell;
      const y = view.oy + (zone.y / grid.cellSize) * view.cell;
      const w = (zone.w / grid.cellSize) * view.cell;
      const h = (zone.h / grid.cellSize) * view.cell;
      ctx.globalAlpha = 0.22;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeRect(x, y, w, h);
    }
    ctx.restore();
  }

  /** Épaisseur d'un mur en cases : 0,1 m à l'échelle, jamais moins de MIN_WALL_PX à l'écran. */
  function wallThickness(grid) {
    return Math.max(WALL_THICKNESS / grid.cellSize, MIN_WALL_PX / view.cell);
  }

  function pill(text, x, y, c) {
    ctx.font = `500 12px ${c.mono}`;
    const width = ctx.measureText(text).width + 14;
    const a = area();
    const px = Math.min(Math.max(x - width / 2, a.x + 4), a.x + a.w - width - 4);
    const py = Math.min(Math.max(y - 11, a.y + 4), a.y + a.h - 26);
    ctx.fillStyle = c.sheet;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(px, py, width, 22, 4);
    else ctx.rect(px, py, width, 22);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = c.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, px + width / 2, py + 11.5);
  }

  /** Mur en cours de tracé : aperçu coloré, extrémités et longueur en mètres. */
  function drawWallPreview(c, grid) {
    const { from, to } = preview;
    const edges = segmentEdges(from, to);
    const start = { x: view.ox + from.x * view.cell, y: view.oy + from.y * view.cell };
    const end = { x: view.ox + to.x * view.cell, y: view.oy + to.y * view.cell };
    ctx.globalAlpha = 0.85;
    fillRects(wallRects(edges, wallThickness(grid)), c.accent);
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.accent;
    for (const p of [start, end]) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (edges.length > 0) {
      const horizontal = from.y === to.y;
      const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      const label = `${lengthFormat.format(segmentLengthM(grid, from, to))} m`;
      pill(label, horizontal ? mid.x : mid.x + 34, horizontal ? mid.y - 18 : mid.y, c);
    }
  }

  /* ------------------------- Mobilier, escaliers, étages ------------------------- */

  const px = (xm) => view.ox + (xm / gridOf().cellSize) * view.cell;
  const py = (ym) => view.oy + (ym / gridOf().cellSize) * view.cell;
  const perMeter = () => view.cell / gridOf().cellSize;
  const meters = (point) => {
    const g = toGrid(point);
    const cs = gridOf().cellSize;
    return { x: g.x * cs, y: g.y * cs };
  };
  const orderCache = new WeakMap();
  const drawOrder = (furniture) => {
    let sorted = orderCache.get(furniture);
    if (!sorted) {
      sorted = furniture.map((item, index) => ({ item, index })).sort((a, b) => layerRank(a.item) - layerRank(b.item) || (a.item.y ?? 0) - (b.item.y ?? 0) || a.index - b.index).map((entry) => entry.item);
      orderCache.set(furniture, sorted);
    }
    return sorted;
  };

  /** Un objet : rectangle teinté selon sa catégorie, trait épais sur l'avant, nom quand la place le permet. */
  function drawItem(item, c, { selected = false, ghost = null, dim = false } = {}) {
    const box = itemBox(item);
    if (!box) return;
    const { def } = box;
    const mode = def.placement?.mode;
    const hue = CATEGORY_HUE[def.category] ?? 30;
    const x = px(box.x0);
    const y = py(box.y0);
    const w = box.ex * perMeter();
    const h = box.ey * perMeter();
    ctx.save();
    ctx.globalAlpha = dim ? 0.35 : 1;
    const fill = ghost === 'bad' ? c.bad : ghost === 'ok' ? c.accent : c.dark ? `hsl(${hue} 28% 30%)` : `hsl(${hue} 50% 84%)`;
    const edge = ghost === 'bad' ? c.bad : ghost === 'ok' ? c.accent : c.dark ? `hsl(${hue} 35% 66%)` : `hsl(${hue} 38% 36%)`;
    if (ghost) ctx.globalAlpha = 0.5;
    if (mode === 'ceiling') {
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, Math.max(3, Math.min(w, h) / 2), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x + w / 2 - 3, y + h / 2);
      ctx.lineTo(x + w / 2 + 3, y + h / 2);
      ctx.moveTo(x + w / 2, y + h / 2 - 3);
      ctx.lineTo(x + w / 2, y + h / 2 + 3);
      ctx.stroke();
    } else {
      const thin = mode === 'wall-mounted' || mode === 'window';
      const rug = def.size.h <= 0.1;
      if (!thin) {
        ctx.fillStyle = fill;
        if (rug) ctx.globalAlpha = (ghost ? 0.5 : dim ? 0.3 : 0.55);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, Math.min(4, w / 4, h / 4));
        else ctx.rect(x, y, w, h);
        ctx.fill();
        ctx.globalAlpha = ghost ? 0.9 : dim ? 0.35 : 1;
      }
      ctx.strokeStyle = edge;
      ctx.lineWidth = thin ? 3 : 1;
      if (rug) ctx.setLineDash([4, 3]);
      if (thin) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y + h);
        ctx.stroke();
        ctx.beginPath();
        ctx.rect(x, y, Math.max(w, 1), Math.max(h, 1));
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, Math.min(4, w / 4, h / 4));
        else ctx.rect(x + 0.5, y + 0.5, w - 1, h - 1);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      if (!thin && !rug && w > 8 && h > 8) {
        // Avant de l'objet : trait épais sur le côté qui regarde la pièce.
        const f = FRONT[item.rotationY] ?? FRONT[0];
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        if (f.x === 0) {
          const fy = f.y > 0 ? y + h - 2 : y + 2;
          ctx.moveTo(x + w * 0.2, fy);
          ctx.lineTo(x + w * 0.8, fy);
        } else {
          const fx = f.x > 0 ? x + w - 2 : x + 2;
          ctx.moveTo(fx, y + h * 0.2);
          ctx.lineTo(fx, y + h * 0.8);
        }
        ctx.stroke();
      }
    }
    if (selected) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = c.accent;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.rect(x - 2, y - 2, w + 4, h + 4);
      ctx.stroke();
    }
    // Nom : seulement si l'objet est assez grand à l'écran.
    if (!ghost && !dim && mode !== 'ceiling' && mode !== 'wall-mounted' && mode !== 'window' && Math.min(w, h) >= 22 && Math.max(w, h) >= 44) {
      ctx.globalAlpha = 0.95;
      let size = 10;
      ctx.font = `500 ${size}px ${c.body}`;
      let text = def.label;
      const limit = (w >= h ? w : h) - 8;
      while (ctx.measureText(text).width > limit && size > 8) {
        size -= 1;
        ctx.font = `500 ${size}px ${c.body}`;
      }
      while (ctx.measureText(text).width > limit && text.length > 3) text = `${text.slice(0, -2).trimEnd()}…`;
      if (ctx.measureText(text).width <= limit) {
        ctx.fillStyle = c.dark ? '#f1ece4' : '#2a2620';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.translate(x + w / 2, y + h / 2);
        if (h > w * 1.4) ctx.rotate(-Math.PI / 2);
        ctx.fillText(text, 0, 0);
      }
    }
    ctx.restore();
  }

  /**
   * Escalier : marches, flèche le long de la montée (volées et paliers pour un L ou un U, cercle pour un colimaçon).
   * `well` : trémie venue du niveau du dessous (hachurée). Un dessous ouvert se dessine plus léger, en pointillés.
   */
  function drawStair(stair, plan, c, { selected = false, ghost = null, well = false } = {}) {
    const layout = stairLayout(stair);
    const open = stairUnder(stair) === 'open';
    const color = ghost === 'bad' ? c.bad : selected || ghost === 'ok' ? c.accent : c.ink;
    const pm = perMeter();
    const X = (xm) => px(xm);
    const Y = (ym) => py(ym);
    const spiral = layout.kind === 'spiral';
    const shape = () => {
      ctx.beginPath();
      if (spiral) {
        const part = layout.parts[0];
        ctx.arc(X(part.cx), Y(part.cy), part.rOut * pm, 0, Math.PI * 2);
      } else {
        for (const part of layout.parts) ctx.rect(X(part.rect.x0), Y(part.rect.y0), (part.rect.x1 - part.rect.x0) * pm, (part.rect.y1 - part.rect.y0) * pm);
      }
    };
    ctx.save();
    ctx.lineJoin = 'miter';
    if (well) {
      ctx.fillStyle = c.sheet;
      ctx.globalAlpha = 0.85;
      shape();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.save();
      shape();
      ctx.clip();
      const b = layout.bbox;
      const x = X(b.x0);
      const y = Y(b.y0);
      const w = (b.x1 - b.x0) * pm;
      const h = (b.y1 - b.y0) * pm;
      ctx.strokeStyle = c.soft;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = -h; k < w; k += 8) {
        ctx.moveTo(x + k, y + h);
        ctx.lineTo(x + k + h, y);
      }
      ctx.stroke();
      ctx.restore();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      outline(layout, stair, X, Y);
      ctx.setLineDash([]);
      ctx.restore();
      return;
    }
    ctx.fillStyle = ghost === 'bad' ? c.bad : ghost === 'ok' ? c.accent : c.sheet;
    ctx.globalAlpha = ghost ? 0.3 : open ? 0.55 : 0.92;
    shape();
    ctx.fill();
    ctx.globalAlpha = 1;
    // Lignes de marches.
    const n = stairStepCount(plan.wallHeight);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const part of layout.parts) {
      if (part.type === 'flight') {
        const treads = Math.max(Math.round(part.t1 * n) - Math.round(part.t0 * n) - 1, 1);
        const r = part.rect;
        for (let k = 1; k < treads; k++) {
          const f = k / treads;
          if (part.dir === 'n' || part.dir === 's') {
            const ym = part.dir === 'n' ? r.y1 - f * part.len : r.y0 + f * part.len;
            ctx.moveTo(snap(X(r.x0)), snap(Y(ym)));
            ctx.lineTo(snap(X(r.x1)), snap(Y(ym)));
          } else {
            const xm = part.dir === 'w' ? r.x1 - f * part.len : r.x0 + f * part.len;
            ctx.moveTo(snap(X(xm)), snap(Y(r.y0)));
            ctx.lineTo(snap(X(xm)), snap(Y(r.y1)));
          }
        }
      } else if (part.type === 'spiral') {
        const treads = Math.max(n - 1, 2);
        for (let k = 0; k <= treads; k++) {
          const angle = part.a0 + part.sign * part.sweep * (k / treads);
          ctx.moveTo(X(part.cx) + Math.cos(angle) * part.rIn * pm, Y(part.cy) + Math.sin(angle) * part.rIn * pm);
          ctx.lineTo(X(part.cx) + Math.cos(angle) * part.rOut * pm, Y(part.cy) + Math.sin(angle) * part.rOut * pm);
        }
      }
    }
    ctx.stroke();
    ctx.lineWidth = selected ? 3 : 2;
    if (open) ctx.setLineDash([6, 3]);
    outline(layout, stair, X, Y);
    ctx.setLineDash([]);
    if (layout.divider) {
      const d = layout.divider;
      ctx.lineWidth = 2;
      ctx.strokeRect(X(d.x0) + 0.5, Y(d.y0) + 0.5, (d.x1 - d.x0) * pm, (d.y1 - d.y0) * pm);
    }
    // Flèche : du pied vers le haut, en suivant les volées.
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    const path = [];
    if (spiral) {
      const part = layout.parts[0];
      const radius = (part.rOut + part.rIn) / 2;
      for (let k = 0; k <= 24; k++) {
        const angle = part.a0 + part.sign * part.sweep * (k / 24) * 0.92;
        path.push({ x: part.cx + Math.cos(angle) * radius, y: part.cy + Math.sin(angle) * radius });
      }
    } else {
      for (const part of layout.parts) {
        const r = part.rect;
        const cx = (r.x0 + r.x1) / 2;
        const cy = (r.y0 + r.y1) / 2;
        if (part.type === 'landing') {
          path.push({ x: cx, y: cy });
          continue;
        }
        const along = (f) => ({ n: { x: cx, y: r.y1 - f * part.len }, s: { x: cx, y: r.y0 + f * part.len }, e: { x: r.x0 + f * part.len, y: cy }, w: { x: r.x1 - f * part.len, y: cy } })[part.dir];
        const from = part === layout.parts[0] ? 0.16 : 0;
        const to = part === layout.parts[layout.parts.length - 1] ? 0.84 : 1;
        path.push(along(from), along(to));
      }
    }
    ctx.beginPath();
    path.forEach((point, k) => (k ? ctx.lineTo(X(point.x), Y(point.y)) : ctx.moveTo(X(point.x), Y(point.y))));
    const tip = path[path.length - 1];
    const prev = path[path.length - 2];
    const ang = Math.atan2(Y(tip.y) - Y(prev.y), X(tip.x) - X(prev.x));
    ctx.moveTo(X(tip.x), Y(tip.y));
    ctx.lineTo(X(tip.x) - Math.cos(ang - 0.5) * 9, Y(tip.y) - Math.sin(ang - 0.5) * 9);
    ctx.moveTo(X(tip.x), Y(tip.y));
    ctx.lineTo(X(tip.x) - Math.cos(ang + 0.5) * 9, Y(tip.y) - Math.sin(ang + 0.5) * 9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(X(path[0].x), Y(path[0].y), 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Contour d'un escalier : segments extérieurs des volées et des paliers, ou le cercle d'un colimaçon. */
  function outline(layout, stair, X, Y) {
    ctx.beginPath();
    if (layout.kind === 'spiral') {
      const part = layout.parts[0];
      ctx.arc(X(part.cx), Y(part.cy), part.rOut * perMeter(), 0, Math.PI * 2);
      ctx.moveTo(X(part.cx) + part.rIn * perMeter(), Y(part.cy));
      ctx.arc(X(part.cx), Y(part.cy), part.rIn * perMeter(), 0, Math.PI * 2);
    } else {
      for (const seg of stairOutline(stair)) {
        ctx.moveTo(snap(X(seg.x0)), snap(Y(seg.y0)));
        ctx.lineTo(snap(X(seg.x1)), snap(Y(seg.y1)));
      }
    }
    ctx.stroke();
  }

  /** Murs du niveau du dessous, en gris pâle sous le plan (repère pour aligner les étages). */
  function drawBelowGhost(c, state) {
    if (state.level < 1) return;
    const below = levelPlan(state.doc, state.level - 1);
    if (!below.walls.length) return;
    ctx.save();
    ctx.globalAlpha = c.dark ? 0.35 : 0.3;
    fillRects(wallRects(below.walls, wallThickness(below.grid)), c.soft);
    ctx.restore();
  }

  /**
   * Objets sous un point (mètres), du plus proche de la main au plus lointain : ce qui est dessiné au-dessus d'abord,
   * mais les luminaires de plafond en dernier (ils flottent au-dessus des meubles qu'on veut attraper). Les petits
   * objets restent faciles à attraper : leur zone est élargie, sans passer avant un objet touché pile.
   */
  function itemsAt(plan, point) {
    const order = drawOrder(plan.furniture);
    const exact = [];
    const near = [];
    for (let i = order.length - 1; i >= 0; i--) {
      const box = itemBox(order[i]);
      if (!box) continue;
      if (point.x >= box.x0 && point.x <= box.x1 && point.y >= box.y0 && point.y <= box.y1) {
        exact.push(order[i]);
        continue;
      }
      const slack = Math.max(0, 5 / perMeter() - Math.min(box.ex, box.ey) / 2);
      if (point.x >= box.x0 - slack && point.x <= box.x1 + slack && point.y >= box.y0 - slack && point.y <= box.y1 + slack) near.push(order[i]);
    }
    const isCeiling = (item) => DEFS.get(item.defId)?.placement?.mode === 'ceiling';
    return [...exact.filter((item) => !isCeiling(item)), ...exact.filter(isCeiling), ...near];
  }

  /** Centre d'un objet de taille ex × ey amené sur la grille (ou contre un mur) autour du point `at` (mètres). */
  function snapCenter(at, ex, ey, free = false) {
    if (free) return { x: r6(at.x), z: r6(at.y) };
    const step = gridOf().cellSize;
    return { x: r6(at.x + snapSpan(at.x - ex / 2, at.x + ex / 2, step)), z: r6(at.y + snapSpan(at.y - ey / 2, at.y + ey / 2, step)) };
  }

  const pendingBox = (pending) => itemBox({ defId: pending.defId, x: pending.x ?? 0, z: pending.z ?? 0, rotationY: pending.rotationY });

  /** Escalier qui serait posé (souris) ou déplacé : vert si possible, rouge sinon. */
  function drawStairPreview(c, plan, state) {
    if (drag?.kind === 'stair' && drag.moved && drag.candidate) {
      const old = (plan.stairs ?? []).find((s) => s.id === drag.id);
      if (old) drawStair({ ...old, x: drag.candidate.x, y: drag.candidate.y }, plan, c, { ghost: drag.candidate.ok ? 'ok' : 'bad' });
      return;
    }
    if (drag || gesture || lastPointer?.type !== 'mouse') return;
    const at = meters(lastPointer);
    if (findStairAt(plan, at, 'stairs', 0)) return;
    const spec = createStairSpec(plan, at, stairDir, stairStyle);
    drawStair(spec, plan, c, { ghost: store.checkStair(spec).ok ? 'ok' : 'bad' });
  }

  /** Objet du catalogue en cours de pose, ou objet qu'on déplace : aperçu vert / rouge selon la validité. */
  function drawFurniturePreview(c, plan, state) {
    if (drag?.kind === 'item' && drag.moved && drag.candidate) {
      const item = plan.furniture.find((o) => o.id === drag.id);
      if (item) drawItem({ ...item, x: drag.candidate.x, z: drag.candidate.z }, c, { ghost: drag.candidate.ok ? 'ok' : 'bad' });
      return;
    }
    const pending = state.pendingItem;
    if (!pending || pending.x === null) return;
    const check = store.checkItem({ defId: pending.defId, x: pending.x, z: pending.z, rotationY: pending.rotationY });
    drawItem({ ...pending, id: 'pending' }, c, { ghost: check.ok ? 'ok' : 'bad' });
  }

  /** `clean` : image d'export, sans sélection, aperçu ni survol. */
  function draw(clean = false) {
    frame = 0;
    if (size.w < 2 || size.h < 2) return;
    const dpr = canvas.width / size.w;
    const state = clean
      ? { ...store.getState(), tool: 'hand', selectedRoomId: null, selectedOpeningId: null, selectedStairId: null, selectedItemId: null, pendingItem: null, pendingOpening: null }
      : store.getState();
    const { plan, tool } = state;
    const rooms = store.getRooms();
    const grid = plan.grid;
    const c = colors();
    const a = area();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = c.paper;
    ctx.fillRect(0, 0, size.w, size.h);

    // Zone de dessin : tout est rogné aux bandes des règles.
    ctx.save();
    ctx.beginPath();
    ctx.rect(a.x, a.y, a.w, a.h);
    ctx.clip();

    const hoverRoom =
      tool === 'room' && lastPointer?.type === 'mouse' && !drag && !gesture ? roomAtPoint(rooms, toGrid(lastPointer)) : null;
    drawGrid(c, grid, () => {
      drawRooms(c, plan, rooms, hoverRoom?.id, state.selectedRoomId);
      if (state.showClearance) drawClearance(c, grid);
    });
    drawBelowGhost(c, state);
    fillRects(wallRectsWithOpenings(plan, wallThickness(grid)), c.ink);
    for (const opening of plan.openings) {
      drawOpening(opening, grid, c, { selected: opening.id === state.selectedOpeningId, color: opening.id === state.selectedOpeningId ? c.accent : c.ink });
    }
    for (const well of plan.wells ?? []) drawStair(well, plan, c, { well: true });
    for (const stair of plan.stairs ?? []) drawStair(stair, plan, c, { selected: stair.id === state.selectedStairId });
    const movingId = drag?.kind === 'item' && drag.moved ? drag.id : null;
    for (const item of drawOrder(plan.furniture)) drawItem(item, c, { selected: item.id === state.selectedItemId, dim: item.id === movingId });
    drawSelectionOutline(c, grid, rooms, state.selectedRoomId);
    drawRoomLabels(c, plan, rooms);
    drawOpenEnds(c, store.getOutlines());
    drawAxes(c, grid);

    if (preview) drawWallPreview(c, grid);
    if (OPENING_TOOLS.includes(tool)) {
      const ghost = state.pendingOpening ?? (lastPointer?.type === 'mouse' && !drag && !gesture ? hoverPlacement : null);
      if (ghost) drawOpeningGhost(ghost, grid, c);
    }

    if (tool === 'stair') drawStairPreview(c, plan, state);
    if (tool === 'furniture') drawFurniturePreview(c, plan, state);

    if (lastPointer && !gesture) {
      const dragging = drag?.kind === 'erase' || drag?.kind === 'wall';
      const showHover = lastPointer.type === 'mouse' || dragging;
      if (tool === 'erase' && showHover) {
        // Mur qui serait gommé : surligné en rouge.
        const where = toGrid(lastPointer);
        const opening = findOpeningAt(plan, where, tolerance(lastPointer.type));
        if (opening) {
          fillRects([openingRect(opening, wallThickness(grid) * 1.8)], c.bad);
        } else {
          const edge = findWallEdgeNear(plan, where, tolerance(lastPointer.type));
          if (edge) fillRects(wallRects([edge], wallThickness(grid) * 1.8), c.bad);
        }
      } else if (tool === 'wall' && lastPointer.type === 'mouse' && !drag) {
        // Intersection qui serait choisie : anneau.
        const p = snapped(lastPointer);
        ctx.strokeStyle = c.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(view.ox + p.x * view.cell, view.oy + p.y * view.cell, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();

    drawRulers(c, grid, a);
  }

  /** Règles graduées en mètres, fixes sur les bords ; les graduations suivent la grille. */
  function drawRulers(c, grid, a) {
    ctx.fillStyle = c.sheet;
    ctx.fillRect(0, 0, size.w, a.y);
    ctx.fillRect(0, a.y, a.x, size.h - a.y);
    ctx.strokeStyle = c.major;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, snap(a.y));
    ctx.lineTo(size.w, snap(a.y));
    ctx.moveTo(snap(a.x), a.y);
    ctx.lineTo(snap(a.x), size.h);
    ctx.stroke();

    const meters = grid.cellSize < 0.3 ? [1, 2, 5, 10, 20] : [2, 4, 10, 20, 40];
    const every = meters.map((m) => Math.round(m / grid.cellSize)).find((n) => n * view.cell >= 40) ?? Math.round(80 / grid.cellSize); // une graduation toutes les `every` cases
    ctx.font = `500 10px ${c.mono}`;
    ctx.fillStyle = c.soft;
    ctx.strokeStyle = c.soft;
    ctx.beginPath();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (let i = 0; i <= grid.width; i += every) {
      const x = view.ox + i * view.cell;
      if (x < a.x + 6 || x > size.w - 6) continue;
      ctx.fillText(rulerFormat.format(i * grid.cellSize), x, a.y - 8);
      ctx.moveTo(snap(x), a.y - 5);
      ctx.lineTo(snap(x), a.y);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let j = 0; j <= grid.height; j += every) {
      const y = view.oy + j * view.cell;
      if (y < a.y + 8 || y > size.h - 6) continue;
      ctx.fillText(rulerFormat.format(j * grid.cellSize), a.x - 8, y);
      ctx.moveTo(a.x - 5, snap(y));
      ctx.lineTo(a.x, snap(y));
    }
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('m', a.x / 2, a.y / 2);
  }

  /**
   * Dessine le plan entier (grille, pièces, murs, ouvertures, règles) dans un canvas à part, avec le même rendu qu'à l'écran,
   * sans sélection ni outil en cours, et renvoie ce canvas. Une case fait `cell` pixels (réduit si l'image dépasserait `maxSide`).
   */
  function exportImage({ cell = 30, maxSide = 3000 } = {}) {
    const grid = gridOf();
    const pad = FIT_PADDING;
    const fit = Math.floor((maxSide - RULER.left - 2 * pad) / Math.max(grid.width, grid.height));
    const pixels = Math.max(4, Math.min(cell, fit));
    const out = document.createElement('canvas');
    const w = RULER.left + grid.width * pixels + 2 * pad;
    const h = RULER.top + grid.height * pixels + 2 * pad;
    out.width = w;
    out.height = h;
    const saved = { ctx, canvas, w: size.w, h: size.h, view, lastPointer, preview, hoverPlacement, drag, gesture };
    try {
      ctx = out.getContext('2d');
      canvas = out;
      size.w = w;
      size.h = h;
      view = { cell: pixels, ox: RULER.left + pad, oy: RULER.top + pad };
      lastPointer = null;
      preview = null;
      hoverPlacement = null;
      drag = null;
      gesture = null;
      draw(true);
    } finally {
      ({ ctx, canvas, view, lastPointer, preview, hoverPlacement, drag, gesture } = saved);
      size.w = saved.w;
      size.h = saved.h;
    }
    return out;
  }

  /** Planifie un dessin à la prochaine image (plusieurs demandes = un seul dessin). */
  function redraw() {
    if (!frame) frame = requestAnimationFrame(() => draw());
  }

  function refreshTheme() {
    palette = null;
    redraw();
  }

  /** Ajuste la résolution du canvas à sa taille à l'écran (écrans haute densité), puis dessine. */
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    size.w = rect.width;
    size.h = rect.height;
    const pixelWidth = Math.round(size.w * dpr);
    const pixelHeight = Math.round(size.h * dpr);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    if (size.w >= 2 && size.h >= 2) {
      view = viewMoved ? clampView(view, gridOf(), area()) : fitView(gridOf(), area(), FIT_PADDING);
    }
    draw();
  }

  function updateCursor() {
    const tool = store.getState().tool;
    let cursor = tool === 'hand' ? 'grab' : tool === 'erase' || tool === 'room' ? 'pointer' : 'crosshair';
    if (spaceHeld) cursor = 'grab';
    if (tool === 'furniture' && !store.getState().pendingItem) cursor = 'default';
    if (drag?.kind === 'pan' || ((drag?.kind === 'item' || drag?.kind === 'stair') && drag.moved)) cursor = 'move';
    else if (drag && TAP_KINDS.includes(drag.kind) && drag.moved) cursor = 'grabbing';
    if (drag?.kind === 'pan') cursor = 'grabbing';
    canvas.style.cursor = cursor;
  }

  /* ------------------------------ Pointer events ------------------------------ */

  function cancelDrag() {
    if (drag?.kind === 'erase') store.actions.cancelTransaction();
    drag = null;
    preview = null;
    updateCursor();
    redraw();
  }

  function startGesture() {
    // Un deuxième doigt abandonne le tracé en cours : on passe en zoom / déplacement.
    if (drag?.kind === 'erase') store.actions.endTransaction();
    drag = null;
    preview = null;
    const [a, b] = [...pointers.values()];
    gesture = { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
    updateCursor();
  }

  /** Pose d'un escalier au point touché (sens courant). */
  function placeStair(point) {
    const plan = store.getState().plan;
    const spec = createStairSpec(plan, meters(point), stairDir, stairStyle);
    const check = store.checkStair(spec);
    if (!check.ok) {
      options.onNotice?.({ type: 'stair', reason: check.reason });
      return;
    }
    store.actions.addStair(spec);
  }

  /** Escalier ou objet en cours de déplacement : position candidate (calée sur la grille) et sa validité. */
  function moveCandidate(point, event) {
    const state = store.getState();
    const at = meters(point);
    if (drag.kind === 'stair') {
      const stair = (state.plan.stairs ?? []).find((s) => s.id === drag.id);
      if (!stair) return;
      const step = state.plan.grid.cellSize;
      const snapTo = (v) => Math.round(v / step) * step;
      const x = r6(snapTo(at.x + drag.offset.x));
      const y = r6(snapTo(at.y + drag.offset.y));
      const check = store.checkStair({ ...stair, x, y }, stair.id);
      drag.candidate = { x, y, ok: check.ok, reason: check.reason };
      return;
    }
    const item = state.plan.furniture.find((o) => o.id === drag.id);
    const box = item && itemBox(item);
    if (!box) return;
    const target = snapCenter({ x: at.x + drag.offset.x, y: at.y + drag.offset.y }, box.ex, box.ey, event.altKey);
    const result = store.previewFurniture(item.id, { x: target.x, z: target.z });
    drag.candidate = { x: target.x, z: target.z, ok: result.ok, reasons: result.reasons };
  }

  /** Souris : l'objet du catalogue en attente suit le pointeur (position calée), sans historique. */
  function followPending(point) {
    const pending = store.getState().pendingItem;
    if (!pending) return;
    const box = pendingBox(pending);
    if (!box) return;
    const target = snapCenter(meters(point), box.ex, box.ey);
    if (pending.x === target.x && pending.z === target.z) return;
    store.actions.setPendingItem({ ...pending, x: target.x, z: target.z });
  }

  /**
   * Toucher avec un objet du catalogue en attente. Souris : la pose a lieu à l'endroit de l'aperçu. Doigt : le premier toucher place l'aperçu,
   * un toucher sur l'aperçu le pose.
   */
  function tapPending(point, pointerType) {
    const pending = store.getState().pendingItem;
    if (!pending) return;
    const box = pendingBox(pending);
    if (!box) return;
    const target = snapCenter(meters(point), box.ex, box.ey);
    const at = meters(point);
    const onGhost = pending.x !== null && at.x >= pending.x - box.ex / 2 - 0.1 && at.x <= pending.x + box.ex / 2 + 0.1 && at.y >= pending.z - box.ey / 2 - 0.1 && at.y <= pending.z + box.ey / 2 + 0.1;
    if (pointerType === 'mouse' || onGhost) {
      const placed = pointerType === 'mouse' ? { ...pending, x: target.x, z: target.z } : pending;
      store.actions.setPendingItem(placed);
      const result = store.actions.commitPendingItem();
      if (!result.ok) options.onNotice?.({ type: 'item', reasons: result.reasons });
      return;
    }
    store.actions.setPendingItem({ ...pending, x: target.x, z: target.z });
  }

  function onPointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 1) return;
    const point = localPoint(event);
    canvas.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, { ...point, type: event.pointerType });
    lastPointer = { ...point, type: event.pointerType };
    if (pointers.size === 2) {
      startGesture();
      return;
    }
    if (pointers.size > 2) return;

    const tool = store.getState().tool;
    const panning = tool === 'hand' || spaceHeld || (event.pointerType === 'mouse' && event.button === 1);
    if (panning) {
      drag = { kind: 'pan', pointerId: event.pointerId, last: point };
    } else if (tool === 'wall') {
      const from = snapped(point);
      drag = { kind: 'wall', pointerId: event.pointerId, from };
      preview = { from, to: from };
    } else if (tool === 'room' || OPENING_TOOLS.includes(tool)) {
      drag = { kind: tool === 'room' ? 'room' : 'opening', pointerId: event.pointerId, start: point, last: point, moved: false };
    } else if (tool === 'erase') {
      store.actions.beginTransaction();
      const at = toGrid(point);
      drag = { kind: 'erase', pointerId: event.pointerId, last: at };
      store.actions.eraseAlong(at, at, tolerance(event.pointerType));
    } else if (tool === 'stair') {
      const plan = store.getState().plan;
      const at = meters(point);
      const hit = findStairAt(plan, at, 'stairs', tolerance(event.pointerType) * plan.grid.cellSize);
      if (hit) {
        store.actions.selectStair(hit.id);
        drag = { kind: 'stair', pointerId: event.pointerId, start: point, last: point, moved: false, id: hit.id, offset: { x: hit.x - at.x, y: hit.y - at.y }, candidate: null };
      } else {
        drag = { kind: 'stair-place', pointerId: event.pointerId, start: point, last: point, moved: false };
      }
    } else if (tool === 'furniture') {
      const state = store.getState();
      const at = meters(point);
      if (state.pendingItem) {
        drag = { kind: 'item-place', pointerId: event.pointerId, start: point, last: point, moved: false };
      } else {
        const hits = itemsAt(state.plan, at);
        const hit = hits[0];
        if (hit) {
          // Un second toucher au même endroit passe à l'objet suivant dessous (le luminaire au-dessus d'une table, par exemple).
          const selectedIndex = hits.findIndex((item) => item.id === state.selectedItemId);
          const cycleTo = selectedIndex >= 0 && hits.length > 1 ? hits[(selectedIndex + 1) % hits.length].id : null;
          const target = selectedIndex >= 0 ? hits[selectedIndex] : hit;
          store.actions.selectItem(target.id);
          drag = { kind: 'item', pointerId: event.pointerId, start: point, last: point, moved: false, id: target.id, cycleTo, offset: { x: target.x - at.x, y: target.z - at.y }, candidate: null };
        } else {
          drag = { kind: 'item-empty', pointerId: event.pointerId, start: point, last: point, moved: false };
        }
      }
    }
    updateCursor();
    redraw();
  }

  function onPointerMove(event) {
    const point = localPoint(event);
    if (pointers.has(event.pointerId)) pointers.set(event.pointerId, { ...point, type: event.pointerType });
    lastPointer = { ...point, type: event.pointerType };

    hoverPlacement = null;
    const tool = store.getState().tool;
    if (tool === 'furniture' && event.pointerType === 'mouse' && !drag && !gesture) followPending(point);
    if (OPENING_TOOLS.includes(tool) && !drag && event.pointerType === 'mouse') {
      hoverPlacement = findOpeningPlacement(store.getState().plan, toGrid(point), tool, undefined, tolerance('mouse'));
      if (findOpeningAt(store.getState().plan, toGrid(point), tolerance('mouse'))) hoverPlacement = null; // l'ouverture existante sera sélectionnée
    }

    if (gesture && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      // Zoom centré sur les doigts, puis déplacement du centre des doigts.
      setView(panView(zoomAt(view, { x: cx, y: cy }, dist / gesture.dist), cx - gesture.cx, cy - gesture.cy));
      gesture = { cx, cy, dist };
    } else if (drag && drag.pointerId === event.pointerId) {
      if (drag.kind === 'pan') {
        setView(panView(view, point.x - drag.last.x, point.y - drag.last.y));
        drag.last = point;
      } else if (drag.kind === 'stair' || drag.kind === 'item') {
        const slop = TAP_SLOP_PX[event.pointerType] ?? TAP_SLOP_PX.mouse;
        if (!drag.moved && Math.hypot(point.x - drag.start.x, point.y - drag.start.y) > slop) {
          drag.moved = true;
          updateCursor();
        }
        if (drag.moved) moveCandidate(point, event);
        drag.last = point;
      } else if (TAP_KINDS.includes(drag.kind)) {
        // Un glissé plus long qu'un simple toucher déplace la vue (pratique au doigt) au lieu d'ouvrir le menu.
        const slop = TAP_SLOP_PX[event.pointerType] ?? TAP_SLOP_PX.mouse;
        if (!drag.moved && Math.hypot(point.x - drag.start.x, point.y - drag.start.y) > slop) {
          drag.moved = true;
          updateCursor();
        }
        if (drag.moved) setView(panView(view, point.x - drag.last.x, point.y - drag.last.y));
        drag.last = point;
      } else if (drag.kind === 'wall') {
        preview.to = alignToAxis(drag.from, snapped(point));
      } else if (drag.kind === 'erase') {
        const at = toGrid(point);
        if (at.x !== drag.last.x || at.y !== drag.last.y) {
          store.actions.eraseAlong(drag.last, at, tolerance(event.pointerType));
          drag.last = at;
        }
      }
    }
    redraw();
  }

  /**
   * Toucher avec un outil d'ouverture. Sur une ouverture existante : la sélectionner. Sur un mur : à la souris,
   * la poser tout de suite ; au doigt, le premier toucher montre l'aperçu et le second (sur l'aperçu) la pose.
   */
  function tapOpening(point, pointerType) {
    const { plan, tool, pendingOpening } = store.getState();
    const where = toGrid(point);
    const reach = tolerance(pointerType);
    const existing = findOpeningAt(plan, where, reach);
    if (existing) {
      store.actions.setPendingOpening(null);
      store.actions.selectOpening(existing.id);
      return;
    }
    const placement = findOpeningPlacement(plan, where, tool, undefined, reach);
    if (!placement) {
      store.actions.setPendingOpening(null);
      store.actions.selectOpening(null);
      return;
    }
    if (pointerType === 'mouse') {
      hoverPlacement = null;
      store.actions.addOpening(placement);
      return;
    }
    const onPending =
      pendingOpening &&
      pendingOpening.type === tool &&
      (findOpeningAt({ openings: [{ id: 'pending', ...pendingOpening }] }, where, reach) ||
        (pendingOpening.start.x === placement.start.x && pendingOpening.start.y === placement.start.y && pendingOpening.start.dir === placement.start.dir));
    if (onPending) {
      store.actions.commitPendingOpening();
    } else {
      store.actions.selectOpening(null);
      store.actions.setPendingOpening(placement);
    }
  }

  function onPointerUp(event) {
    if (!pointers.delete(event.pointerId)) return;
    if (pointers.size < 2) gesture = null;
    if (drag && drag.pointerId === event.pointerId) {
      if (drag.kind === 'wall' && preview) store.actions.addWalls(drag.from, preview.to);
      if (drag.kind === 'erase') store.actions.endTransaction();
      const kind = drag.kind;
      const finished = drag;
      const tap = TAP_KINDS.includes(kind) && !drag.moved ? localPoint(event) : null;
      drag = null;
      preview = null;
      if (kind === 'stair' && finished.moved) {
        if (finished.candidate?.ok) store.actions.updateStair(finished.id, { x: finished.candidate.x, y: finished.candidate.y });
        else if (finished.candidate) options.onNotice?.({ type: 'stair', reason: finished.candidate.reason });
      } else if (kind === 'item' && finished.moved) {
        if (finished.candidate?.ok) store.actions.moveFurniture(finished.id, { x: finished.candidate.x, z: finished.candidate.z });
        else if (finished.candidate) options.onNotice?.({ type: 'item', reasons: finished.candidate.reasons });
      } else if (kind === 'item' && !finished.moved && finished.cycleTo) {
        store.actions.selectItem(finished.cycleTo);
      } else if (tap && kind === 'stair-place') {
        placeStair(tap);
      } else if (tap && kind === 'item-empty') {
        store.actions.selectItem(null);
      } else if (tap && kind === 'item-place') {
        tapPending(tap, event.pointerType);
      } else if (tap && kind === 'room') {
        const room = roomAtPoint(store.getRooms(), toGrid(tap));
        store.actions.selectRoom(room ? room.id : null);
        options.onRoomTap?.({ room, point: tap, size: { w: size.w, h: size.h } });
      } else if (tap) {
        tapOpening(tap, event.pointerType);
      }
    }
    if (event.pointerType !== 'mouse') lastPointer = null;
    updateCursor();
    redraw();
  }

  function onPointerCancel(event) {
    if (!pointers.delete(event.pointerId)) return;
    if (pointers.size < 2) gesture = null;
    if (drag && drag.pointerId === event.pointerId) cancelDrag();
    lastPointer = null;
    redraw();
  }

  function onWheel(event) {
    event.preventDefault();
    let delta = event.deltaY;
    if (event.deltaMode === 1) delta *= 16; // lignes → pixels
    else if (event.deltaMode === 2) delta *= size.h; // pages → pixels
    const factor = Math.exp(-delta * (event.ctrlKey ? 0.01 : 0.0015)); // pincement du pavé tactile = ctrl + molette
    setView(zoomAt(view, localPoint(event), factor));
    redraw();
  }

  function onKeyDown(event) {
    if (event.code === 'Space' && hovering) {
      event.preventDefault(); // pas de défilement, pas de clic sur un bouton
      if (!spaceHeld) {
        spaceHeld = true;
        updateCursor();
      }
    } else if (event.key === 'Escape' && drag) {
      cancelDrag();
    } else if (!isTyping(event)) {
      onToolKey(event);
    }
  }

  const isTyping = (event) => {
    const el = event.target;
    return Boolean(el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) || event.ctrlKey || event.metaKey || event.altKey;
  };

  /** Raccourcis des outils Escalier et Mobilier : R tourne, Suppr supprime, flèches déplacent l'objet choisi, Échap abandonne. */
  function onToolKey(event) {
    const state = store.getState();
    const key = event.key;
    if (state.tool === 'stair') {
      if (key === 'r' || key === 'R') {
        event.preventDefault();
        if (state.selectedStairId) store.actions.rotateStair(state.selectedStairId);
        else rotateStairPreview();
      } else if ((key === 'Delete' || key === 'Backspace') && state.selectedStairId) {
        event.preventDefault();
        store.actions.removeStair(state.selectedStairId);
      }
    } else if (state.tool === 'furniture') {
      if (key === 'Escape') {
        if (state.pendingItem) store.actions.setPendingItem(null);
        else store.actions.selectItem(null);
      } else if (key === 'r' || key === 'R') {
        event.preventDefault();
        if (state.pendingItem) store.actions.setPendingItem({ ...state.pendingItem, rotationY: (state.pendingItem.rotationY + 90) % 360 });
        else if (state.selectedItemId) notifyItem(store.actions.rotateFurniture(state.selectedItemId, event.shiftKey ? -90 : 90));
      } else if ((key === 'Delete' || key === 'Backspace') && state.selectedItemId) {
        event.preventDefault();
        store.actions.deleteFurniture(state.selectedItemId);
      } else if (state.selectedItemId && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) {
        event.preventDefault();
        const item = state.plan.furniture.find((o) => o.id === state.selectedItemId);
        if (!item) return;
        const d = event.shiftKey ? 0.5 : FURNITURE_NUDGE;
        const dx = key === 'ArrowLeft' ? -d : key === 'ArrowRight' ? d : 0;
        const dz = key === 'ArrowUp' ? -d : key === 'ArrowDown' ? d : 0;
        notifyItem(store.actions.moveFurniture(item.id, { x: r6(item.x + dx), z: r6(item.z + dz) }));
      }
    }
  }

  function notifyItem(result) {
    if (!result.ok) options.onNotice?.({ type: 'item', reasons: result.reasons });
  }

  /** Tourne l'aperçu de l'escalier à poser (quart de tour horaire). */
  function rotateStairPreview() {
    stairDir = { n: 'e', e: 's', s: 'w', w: 'n' }[stairDir];
    redraw();
    return stairDir;
  }

  function onKeyUp(event) {
    if (event.code === 'Space' && spaceHeld) {
      spaceHeld = false;
      updateCursor();
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('pointerenter', () => (hovering = true));
  canvas.addEventListener('pointerleave', () => {
    hovering = false;
    if (!drag) {
      lastPointer = null;
      redraw();
    }
  });
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const unsubscribePlan = store.subscribe(redraw);
  const unsubscribeUi = store.subscribeUi(({ tool }) => {
    if (tool !== lastTool) {
      lastTool = tool;
      if (drag) cancelDrag();
      preview = null;
      hoverPlacement = null;
    }
    updateCursor();
    redraw();
  });
  document.fonts?.ready?.then(refreshTheme); // redessine quand les polices sont chargées
  updateCursor();
  resize();

  /** Recentre la vue sur une pièce si elle n'est pas entièrement visible (sans changer le zoom). */
  function reveal(room) {
    const a = area();
    const left = view.ox + room.bounds.minX * view.cell;
    const right = view.ox + room.bounds.maxX * view.cell;
    const top = view.oy + room.bounds.minY * view.cell;
    const bottom = view.oy + room.bounds.maxY * view.cell;
    if (left >= a.x && right <= a.x + a.w && top >= a.y && bottom <= a.y + a.h) return;
    setView(panView(view, a.x + a.w / 2 - (left + right) / 2, a.y + a.h / 2 - (top + bottom) / 2));
    redraw();
  }

  return {
    redraw,
    resize,
    fit,
    reveal,
    rotateStairPreview,
    stairDirection: () => stairDir,
    stairStyle: () => ({ ...stairStyle }),
    setStairStyle(patch) {
      stairStyle = { ...stairStyle, ...patch };
      redraw();
      return { ...stairStyle };
    },
    refreshTheme,
    exportImage,
    destroy() {
      observer.disconnect();
      unsubscribePlan();
      unsubscribeUi();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (frame) cancelAnimationFrame(frame);
    },
  };
}
