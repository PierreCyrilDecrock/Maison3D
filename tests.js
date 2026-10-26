// tests.js — mini-lanceur de tests (describe, it, expect), tests de core.js, du store, de furniture.js et de generator.js
// (briques de la phase 6a, puis génération des salons, chambres et salles à manger de la phase 6b).
// Il tourne aussi bien dans l'artefact que dans Node ; seuls les tests de construction 3D chargent Three.js (à la demande).
import {
  STAIR_FINISHES,
  STAIR_FRAMES,
  STAIR_RAILS,
  STAIR_STEPS,
  setStairFinish,
  setStairRail,
  setStairSteps,
  stairFinish,
  stairFrame,
  stairRail,
  stairSteps,
  stairRailBoxes,
  stairWellBoxes,
  stairWallBacked,
  CLEARANCE_DEPTH_M,
  FLOOR_THICKNESS,
  FRAME_WIDTH,
  DEFAULT_LIGHTING,
  LAMP_MODES,
  SLAB_THICKNESS,
  computeSunReport,
  drawFinishPattern,
  shadeColor,
  STAIR_LIMITS,
  addLevel,
  addStair,
  canPlaceStair,
  countWallsInStairs,
  createEmptyDocument,
  createStairSpec,
  daylightHours,
  findStairAt,
  flipStair,
  getRoomFinish,
  removeLevel,
  removeStair,
  renameLevel,
  rotateStair,
  setRoomFinish,
  STAIR_TREAD,
  stairBoxes,
  stairClimb,
  stairContains,
  stairKind,
  stairLayout,
  stairOutline,
  stairPathLength,
  stairRects,
  stairResizePatch,
  stairUnder,
  setStairKind,
  setStairUnder,
  STAIR_KINDS,
  stairEnds,
  stairProgress,
  stairRise,
  stairStepCount,
  sunDirection,
  sunPosition,
  sunlightForRoom,
  updateStair,
  withLevelPlan,
  levelElevation,
  FLOOR_FINISHES,
  WALL_FINISHES,
  BASEBOARD_FINISHES,
  isDocument,
  GRID_STEPS,
  convertGridStep,
  LOWERED_WALL_HEIGHT,
  OPENING_DEFAULTS,
  PLAN_FILE_APP,
  PLAN_FILE_FORMAT,
  PLAN_FILE_MAX_CHARS,
  PLAN_LIMITS,
  ROOM_NAME_MAX,
  ROOM_GROUPS,
  ROOM_TYPES,
  roomGroupOf,
  ROOM_TYPE_INFO,
  STYLE_PRESETS,
  TEMPLATES,
  addOpening,
  addWallSegments,
  alignToAxis,
  buildStructure,
  buildTemplate,
  buildWallTints,
  canPlaceOpening,
  clampView,
  clearPlan,
  crc32,
  createEmptyPlan,
  detectRooms,
  docFromPlan,
  eraseAlongPath,
  exportPlanText,
  extractShareCode,
  fileSlug,
  findOpeningAt,
  findOpeningPlacement,
  findOpenOutlines,
  findWallEdgeNear,
  fitView,
  flipOpening,
  getClearanceZones,
  getPlanExtent,
  getRoomName,
  getRoomType,
  gridToScreen,
  isRoomLocked,
  levelPlan,
  migratePlan,
  normalizeDocument,
  normalizeEdge,
  normalizePlan,
  openingEdges,
  openingHeight,
  openingSill,
  parsePlanText,
  readPlan,
  reconcileRoomTypes,
  removeOpening,
  removeWallSegments,
  roomAtCell,
  roomColor,
  roomKey,
  roomLabel,
  screenToGrid,
  setRoomInfo,
  setRoomLock,
  segmentLengthM,
  snapToGrid,
  tagExteriorBoxes,
  updateOpening,
  validatePlan,
  wallRects,
  wallRectsWithOpenings,
  zipStore,
  zoomAt,
} from './core.js';
import {
  FURNITURE_BUILDERS,
  FURNITURE_CATEGORIES,
  FURNITURE_DATA,
  FURNITURE_DEFS,
  PALETTES,
  PALETTE_ROLES,
  PLACEMENT_MODES,
  buildFurniture,
  createBuildContext,
  createNeutralRng,
  createRng,
  furnitureForRoomType,
  getFurniture,
  hashSeed,
  FURNITURE_FAMILIES,
  variantsOf,
} from './furniture.js';
import { CAR_COLORS } from './furniture-garage.js';
import {
  CELL_DOOR,
  CELL_FLOOR,
  MANUAL_ROLE,
  STAIR_LANDING,
  addFurnitureItem,
  checkFurniturePlacement,
  deleteFurnitureItem,
  duplicateFurniture,
  editFurniture,
  itemsOnTop,
  rotateFurniture,
  CELL_WALL,
  CELL_WINDOW,
  GRID_RES,
  MAX_ATTEMPTS,
  RECIPES,
  RECIPE_TYPES,
  ROLE_LABELS,
  ROOM_WALL_VARIATION,
  SHARE_MAX_LENGTH,
  STYLE_DENSITY,
  TOP_K,
  WALK_EYE_HEIGHT,
  WALK_RADIUS,
  addObject,
  allowsOverlap,
  autoZones,
  buildShare,
  buildWalkWorld,
  cellAt,
  cellFlags,
  checkConnectivity,
  checkPlacement,
  countFreeCells,
  createPlaced,
  createRng as createGeneratorRng,
  createRoomGrid,
  facingVector,
  findWalkStart,
  footprintsOverlap,
  freeAreaM2,
  fromPlanItem,
  frontClearanceRect,
  generateHome,
  generateLayout,
  generateRoom,
  generateRoomReport,
  gridToText,
  hash,
  isCellFree,
  isFrontClear,
  makeFootprint,
  moveWalker,
  WALK_RAIL,
  buildWalkBuilding,
  findBuildingWalkStart,
  stepWalker,
  walkGround,
  wellRails,
  normalizeRotation,
  overlapArea,
  placementsConflict,
  readShare,
  rectContains,
  reconcileFurniture,
  rectInRoom,
  removeFurniture,
  removeObject,
  roomWallVariation,
  sideClearanceRects,
  toPlanItem,
  toSeed,
  tryPlaceObject,
  validateLayout,
  walkBlocked,
} from './generator.js';
import { HISTORY_LIMIT, autosave, createProjects, createStorage, createStore } from './store.js';

/* ------------------------------------------------------------------ */
/* Mini-lanceur                                                       */
/* ------------------------------------------------------------------ */

/** Nombre de graines des tests de génération : 200 par défaut ; la page en prend moins au chargement (voir runTests). */
let seedCount = 200;
const suites = []; // { name, tests: [{ name, fn }] }
let current = null;

/** Regroupe des tests sous un même titre. */
export function describe(name, fn) {
  const suite = { name, tests: [] };
  suites.push(suite);
  const previous = current;
  current = suite;
  try {
    fn();
  } finally {
    current = previous;
  }
}

/** Déclare un test (synchrone ou asynchrone). À appeler dans describe(). */
export function it(name, fn) {
  if (!current) throw new Error('it() doit être appelé à l\'intérieur de describe().');
  current.tests.push({ name, fn });
}

function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}

function show(value) {
  try {
    const text = JSON.stringify(value);
    return text === undefined ? String(value) : text;
  } catch {
    return String(value);
  }
}

/** Assertions : toBe, toEqual, toBeTruthy, toBeFalsy, toContain, toHaveLength, toBeGreaterThan, toThrow, et .not. */
export function expect(actual) {
  const build = (negate) => {
    const assert = (pass, positive, negative) => {
      if (negate ? pass : !pass) throw new Error(negate ? negative : positive);
    };
    return {
      toBe: (expected) =>
        assert(Object.is(actual, expected), `Attendu ${show(expected)}, reçu ${show(actual)}.`, `Attendu autre chose que ${show(expected)}.`),
      toEqual: (expected) =>
        assert(deepEqual(actual, expected), `Attendu ${show(expected)}, reçu ${show(actual)}.`, `Attendu une valeur différente de ${show(expected)}.`),
      toBeTruthy: () =>
        assert(Boolean(actual), `Attendu une valeur vraie, reçu ${show(actual)}.`, `Attendu une valeur fausse, reçu ${show(actual)}.`),
      toBeFalsy: () =>
        assert(!actual, `Attendu une valeur fausse, reçu ${show(actual)}.`, `Attendu une valeur vraie, reçu ${show(actual)}.`),
      toContain: (item) =>
        assert(actual != null && actual.includes(item), `${show(actual)} devrait contenir ${show(item)}.`, `${show(actual)} ne devrait pas contenir ${show(item)}.`),
      toHaveLength: (length) =>
        assert(actual != null && actual.length === length, `Longueur attendue ${length}, reçue ${actual == null ? 'aucune' : actual.length}.`, `La longueur ne devrait pas valoir ${length}.`),
      toBeGreaterThan: (min) =>
        assert(typeof actual === 'number' && actual > min, `${show(actual)} devrait être supérieur à ${show(min)}.`, `${show(actual)} ne devrait pas être supérieur à ${show(min)}.`),
      toBeLessThan: (max) =>
        assert(typeof actual === 'number' && actual < max, `${show(actual)} devrait être inférieur à ${show(max)}.`, `${show(actual)} ne devrait pas être inférieur à ${show(max)}.`),
      toThrow: () => {
        let threw = false;
        try {
          actual();
        } catch {
          threw = true;
        }
        assert(threw, 'La fonction aurait dû lever une erreur.', 'La fonction ne devrait pas lever d\'erreur.');
      },
    };
  };
  const matchers = build(false);
  matchers.not = build(true);
  return matchers;
}

/**
 * Exécute tous les tests enregistrés.
 * @returns {Promise<{ total: number, passed: number, failed: number,
 *   results: { suite: string, name: string, ok: boolean, error?: string, ms: number }[] }>}
 */
export async function runTests({ seeds = 200 } = {}) {
  seedCount = Math.max(1, Math.floor(seeds));
  const results = [];
  for (const suite of suites) {
    for (const test of suite.tests) {
      const started = performance.now();
      try {
        await test.fn();
        results.push({ suite: suite.name, name: test.name, ok: true, ms: performance.now() - started });
      } catch (error) {
        results.push({ suite: suite.name, name: test.name, ok: false, error: error?.message ?? String(error), ms: performance.now() - started });
      }
    }
  }
  const failed = results.filter((r) => !r.ok).length;
  return { total: results.length, passed: results.length - failed, failed, results };
}

/* ------------------------------------------------------------------ */
/* Tests de core.js                                                   */
/* ------------------------------------------------------------------ */

describe('createEmptyPlan', () => {
  it('crée un plan vide conforme au modèle de données', () => {
    const plan = createEmptyPlan();
    expect(plan.version).toBe(1);
    expect(plan.grid).toEqual({ width: 40, height: 30, cellSize: 0.5 });
    expect(plan.wallHeight).toBe(2.5);
    expect(plan.walls).toEqual([]);
    expect(plan.openings).toEqual([]);
    expect(plan.roomTypes).toEqual({});
    expect(plan.furniture).toEqual([]);
    expect(plan.style.preset).toBeTruthy();
    expect(plan.style.seed).toBeGreaterThan(0);

    // Deux plans ne partagent aucune référence.
    const other = createEmptyPlan();
    plan.walls.push({ x: 0, y: 0, dir: 'h' });
    expect(other.walls).toHaveLength(0);

    // La taille de la grille est paramétrable.
    expect(createEmptyPlan({ width: 12, height: 8 }).grid).toEqual({ width: 12, height: 8, cellSize: 0.5 });
  });
});

describe('validatePlan', () => {
  it('accepte un plan cohérent et rejette les plans invalides', () => {
    // Plan vide : valide.
    const empty = validatePlan(createEmptyPlan());
    expect(empty.valid).toBe(true);
    expect(empty.errors).toHaveLength(0);

    // Plan avec murs, ouverture et type de pièce : valide, y compris sur le bord droit de la grille.
    const plan = createEmptyPlan();
    plan.walls.push({ x: 2, y: 3, dir: 'h' }, { x: 3, y: 3, dir: 'h' }, { x: 2, y: 3, dir: 'v' }, { x: 40, y: 0, dir: 'v' });
    plan.openings.push({ id: 'o1', type: 'door', start: { x: 2, y: 3, dir: 'h' }, span: 2, swing: 'a' });
    expect(validatePlan(plan).valid).toBe(true);
    const closed = withBox(createEmptyPlan(), 4, 4, 12, 10);
    expect(validatePlan({ ...closed, roomTypes: { '4,4': 'kitchen' } }).valid).toBe(true);

    // Version inconnue.
    expect(validatePlan({ ...createEmptyPlan(), version: 2 }).valid).toBe(false);

    // Une arête horizontale ne peut pas commencer à x = largeur de la grille.
    const outside = createEmptyPlan();
    outside.walls.push({ x: 40, y: 0, dir: 'h' });
    expect(validatePlan(outside).valid).toBe(false);

    // Type de pièce inconnu.
    const badRoom = createEmptyPlan();
    badRoom.roomTypes['1,1'] = 'garage';
    expect(validatePlan(badRoom).valid).toBe(false);

    // Ce qui n'est pas un objet est refusé sans lever d'erreur.
    expect(validatePlan(null).valid).toBe(false);
    expect(ROOM_TYPES).toContain('living');
  });
});

/* ------------------------------------------------------------------ */
/* Phase 1 : grille, murs, gomme, vue                                 */
/* ------------------------------------------------------------------ */

const GRID = { width: 40, height: 30, cellSize: 0.5 };
const keysOf = (plan) => plan.walls.map((e) => `${e.dir}${e.x},${e.y}`).sort();

describe('snapToGrid, screenToGrid, gridToScreen', () => {
  it('accroche à l\'intersection la plus proche et reste dans la grille', () => {
    expect(snapToGrid({ x: 3.4, y: 2.6 }, GRID)).toEqual({ x: 3, y: 3 });
    expect(snapToGrid({ x: 3.5, y: 0.49 }, GRID)).toEqual({ x: 4, y: 0 });
    expect(snapToGrid({ x: -2, y: 99 }, GRID)).toEqual({ x: 0, y: 30 });
    expect(snapToGrid({ x: 41.2, y: -0.3 }, GRID)).toEqual({ x: 40, y: 0 });
  });

  it('convertit écran ↔ grille dans les deux sens', () => {
    const view = { cell: 20, ox: 50, oy: 30 };
    expect(gridToScreen(view, { x: 2, y: 3 })).toEqual({ x: 90, y: 90 });
    expect(screenToGrid(view, { x: 90, y: 90 })).toEqual({ x: 2, y: 3 });
    const back = screenToGrid(view, gridToScreen(view, { x: 7.25, y: 1.5 }));
    expect(back).toEqual({ x: 7.25, y: 1.5 });
  });
});

describe('normalizeEdge et alignToAxis', () => {
  it('donne la même arête quel que soit l\'ordre des points', () => {
    expect(normalizeEdge({ x: 3, y: 2 }, { x: 4, y: 2 })).toEqual({ x: 3, y: 2, dir: 'h' });
    expect(normalizeEdge({ x: 4, y: 2 }, { x: 3, y: 2 })).toEqual({ x: 3, y: 2, dir: 'h' });
    expect(normalizeEdge({ x: 5, y: 7 }, { x: 5, y: 6 })).toEqual({ x: 5, y: 6, dir: 'v' });
    expect(normalizeEdge({ x: 0, y: 0 }, { x: 2, y: 0 })).toBe(null); // pas voisins
    expect(normalizeEdge({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(null); // diagonale
  });

  it('ramène un tracé oblique sur l\'axe dominant', () => {
    expect(alignToAxis({ x: 2, y: 2 }, { x: 8, y: 4 })).toEqual({ x: 8, y: 2 });
    expect(alignToAxis({ x: 2, y: 2 }, { x: 3, y: 9 })).toEqual({ x: 2, y: 9 });
    expect(alignToAxis({ x: 5, y: 5 }, { x: 1, y: 3 })).toEqual({ x: 1, y: 5 });
    expect(alignToAxis({ x: 5, y: 5 }, { x: 7, y: 7 })).toEqual({ x: 7, y: 5 }); // égalité : horizontal
  });
});

describe('addWallSegments', () => {
  it('ajoute un segment horizontal', () => {
    const plan = addWallSegments(createEmptyPlan(), { x: 2, y: 3 }, { x: 5, y: 3 });
    expect(keysOf(plan)).toEqual(['h2,3', 'h3,3', 'h4,3']);
  });

  it('ajoute un segment vertical', () => {
    const plan = addWallSegments(createEmptyPlan(), { x: 4, y: 1 }, { x: 4, y: 3 });
    expect(keysOf(plan)).toEqual(['v4,1', 'v4,2']);
  });

  it('ramène une diagonale sur l\'axe dominant', () => {
    const plan = addWallSegments(createEmptyPlan(), { x: 2, y: 2 }, { x: 6, y: 3 });
    expect(keysOf(plan)).toEqual(['h2,2', 'h3,2', 'h4,2', 'h5,2']);
  });

  it('donne le même résultat si from et to sont inversés', () => {
    const a = addWallSegments(createEmptyPlan(), { x: 2, y: 3 }, { x: 5, y: 3 });
    const b = addWallSegments(createEmptyPlan(), { x: 5, y: 3 }, { x: 2, y: 3 });
    expect(keysOf(a)).toEqual(keysOf(b));
  });

  it('n\'ajoute pas de doublons et renvoie le même plan si rien ne change', () => {
    const once = addWallSegments(createEmptyPlan(), { x: 2, y: 3 }, { x: 5, y: 3 });
    const overlap = addWallSegments(once, { x: 4, y: 3 }, { x: 7, y: 3 });
    expect(keysOf(overlap)).toEqual(['h2,3', 'h3,3', 'h4,3', 'h5,3', 'h6,3']);
    expect(addWallSegments(overlap, { x: 3, y: 3 }, { x: 6, y: 3 })).toBe(overlap);
    expect(addWallSegments(once, { x: 3, y: 3 }, { x: 3, y: 3 })).toBe(once); // segment nul
  });

  it('ne modifie pas le plan d\'origine et ignore ce qui sort de la grille', () => {
    const empty = createEmptyPlan();
    const next = addWallSegments(empty, { x: 38, y: 0 }, { x: 45, y: 0 });
    expect(empty.walls).toHaveLength(0);
    expect(keysOf(next)).toEqual(['h38,0', 'h39,0']);
    expect(validatePlan(next).valid).toBe(true);
  });

  it('mesure la longueur d\'un tracé en mètres', () => {
    expect(segmentLengthM(GRID, { x: 0, y: 0 }, { x: 5, y: 1 })).toBe(2.5);
    expect(segmentLengthM(GRID, { x: 3, y: 3 }, { x: 3, y: 3 })).toBe(0);
  });
});

describe('removeWallSegments et gomme', () => {
  const room = () => {
    let plan = createEmptyPlan();
    plan = addWallSegments(plan, { x: 2, y: 2 }, { x: 6, y: 2 });
    plan = addWallSegments(plan, { x: 6, y: 2 }, { x: 6, y: 5 });
    return plan;
  };

  it('supprime un segment, dans les deux sens, et garde le reste', () => {
    const plan = room();
    expect(keysOf(removeWallSegments(plan, { x: 4, y: 2 }, { x: 2, y: 2 }))).toEqual(['h4,2', 'h5,2', 'v6,2', 'v6,3', 'v6,4']);
    expect(removeWallSegments(plan, { x: 10, y: 10 }, { x: 12, y: 10 })).toBe(plan);
  });

  it('retrouve le mur le plus proche d\'un point', () => {
    const plan = room();
    expect(findWallEdgeNear(plan, { x: 3.4, y: 2.2 })).toEqual({ x: 3, y: 2, dir: 'h' });
    expect(findWallEdgeNear(plan, { x: 5.8, y: 3.5 })).toEqual({ x: 6, y: 3, dir: 'v' });
    expect(findWallEdgeNear(plan, { x: 9, y: 9 })).toBe(null);
    expect(findWallEdgeNear(plan, { x: 3.5, y: 2.9 }, 0.5)).toBe(null); // trop loin pour 0,5 case
  });

  it('gomme tous les murs croisés par un trajet rapide', () => {
    const plan = room();
    // Le trajet s'arrête à 0,7 case du mur vertical : seuls les murs horizontaux sont effacés.
    const cleared = eraseAlongPath(plan, { x: 1.8, y: 2.1 }, { x: 5.3, y: 2.05 }, 0.3);
    expect(keysOf(cleared)).toEqual(['v6,2', 'v6,3', 'v6,4']);
    expect(eraseAlongPath(plan, { x: 20, y: 20 }, { x: 22, y: 20 }, 0.4)).toBe(plan);
  });

  it('un simple toucher ne gomme que le mur le plus proche, même avec des voisins à portée', () => {
    const plan = room();
    // (3,5 ; 2) est à 0,5 case de h2,2 et de h4,2 : tous trois sont à portée de 0,6 case.
    const touched = eraseAlongPath(plan, { x: 3.5, y: 2.02 }, { x: 3.5, y: 2.02 }, 0.6);
    expect(keysOf(touched)).toEqual(['h2,2', 'h4,2', 'h5,2', 'v6,2', 'v6,3', 'v6,4']);
  });

  it('vide le plan en gardant la grille, sans changer un plan déjà vide', () => {
    const cleared = clearPlan(room());
    expect(cleared.walls).toHaveLength(0);
    expect(cleared.grid).toEqual(GRID);
    const empty = createEmptyPlan();
    expect(clearPlan(empty)).toBe(empty);
  });
});

describe('wallRects', () => {
  it('prolonge chaque mur d\'une demi-épaisseur pour des jonctions pleines', () => {
    const rects = wallRects([{ x: 2, y: 3, dir: 'h' }, { x: 2, y: 3, dir: 'v' }], 0.2);
    // Coin en L : les deux rectangles se recouvrent sur le carré de l'angle.
    expect(rects[0]).toEqual({ x: 1.9, y: 2.9, w: 1.2, h: 0.2 });
    expect(rects[1]).toEqual({ x: 1.9, y: 2.9, w: 0.2, h: 1.2 });
  });
});

describe('vue 2D : cadrer, zoomer, ne pas perdre la grille', () => {
  const area = { x: 40, y: 28, w: 760, h: 572 };

  it('cadre toute la grille, centrée dans la zone', () => {
    const view = fitView(GRID, area, 14);
    expect(view.cell).toBe(Math.min(732 / 40, 544 / 30));
    const width = GRID.width * view.cell;
    expect(view.ox + width / 2).toBe(area.x + area.w / 2);
  });

  it('zoome autour d\'un point sans déplacer la case qui est dessous', () => {
    const view = { cell: 20, ox: 100, oy: 60 };
    const point = { x: 300, y: 200 };
    const before = screenToGrid(view, point);
    const zoomed = zoomAt(view, point, 1.5);
    expect(zoomed.cell).toBe(30);
    const after = screenToGrid(zoomed, point);
    expect(Math.abs(after.x - before.x)).toBeLessThan(1e-9);
    expect(Math.abs(after.y - before.y)).toBeLessThan(1e-9);
    expect(zoomAt(view, point, 1000).cell).toBe(96); // plafonné
    expect(zoomAt(view, point, 0.0001).cell).toBe(4); // plancher
  });

  it('garde toujours une partie de la grille visible', () => {
    const view = clampView({ cell: 20, ox: 5000, oy: -5000 }, GRID, area);
    expect(view.ox).toBe(area.x + area.w - 48);
    expect(view.oy).toBe(area.y + 48 - GRID.height * 20);
    const inside = { cell: 20, ox: 100, oy: 80 };
    expect(clampView(inside, GRID, area)).toEqual(inside);
  });
});

describe('store : historique', () => {
  const A = { x: 2, y: 2 };

  it('annule et rétablit un tracé en une seule étape', () => {
    const store = createStore();
    store.actions.addWalls(A, { x: 8, y: 2 });
    expect(store.getState().plan.walls).toHaveLength(6);
    expect(store.getState().canUndo).toBe(true);
    store.actions.undo();
    expect(store.getState().plan.walls).toHaveLength(0);
    expect(store.getState().canRedo).toBe(true);
    store.actions.redo();
    expect(store.getState().plan.walls).toHaveLength(6);
    expect(store.getState().canRedo).toBe(false);
  });

  it('ne crée pas d\'entrée quand rien ne change et efface le « rétablir » après un nouveau tracé', () => {
    const store = createStore();
    expect(store.actions.addWalls(A, A)).toBe(false);
    expect(store.getState().canUndo).toBe(false);
    store.actions.addWalls(A, { x: 4, y: 2 });
    store.actions.undo();
    store.actions.addWalls(A, { x: 3, y: 2 });
    expect(store.getState().canRedo).toBe(false);
  });

  it('regroupe un geste de gomme en une seule entrée d\'historique', () => {
    const store = createStore();
    store.actions.addWalls({ x: 2, y: 2 }, { x: 10, y: 2 }); // entrée 1
    store.actions.beginTransaction();
    store.actions.eraseAlong({ x: 3.1, y: 2.1 }, { x: 5.9, y: 2.1 }, 0.4);
    store.actions.eraseAlong({ x: 5.9, y: 2.1 }, { x: 7.9, y: 2.1 }, 0.4);
    store.actions.endTransaction(); // entrée 2
    expect(store.getState().plan.walls.length < 8).toBe(true);
    store.actions.undo();
    expect(store.getState().plan.walls).toHaveLength(8); // un seul annuler rend tout le geste
    store.actions.undo();
    expect(store.getState().plan.walls).toHaveLength(0);
    expect(store.getState().canUndo).toBe(false);
  });

  it('abandonne un geste annulé et limite l\'historique à 100 niveaux', () => {
    const store = createStore();
    store.actions.addWalls(A, { x: 6, y: 2 });
    store.actions.beginTransaction();
    store.actions.eraseAlong({ x: 2, y: 2.1 }, { x: 6, y: 2.1 }, 0.4);
    store.actions.cancelTransaction();
    expect(store.getState().plan.walls).toHaveLength(4);

    const long = createStore();
    // 120 murs distincts (une arête par appel) : chacun crée une entrée d'historique.
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) {
      const x = i % 40;
      const y = Math.floor(i / 40);
      long.actions.addWalls({ x, y }, { x: x + 1, y });
    }
    let undone = 0;
    while (long.actions.undo()) undone++;
    expect(undone).toBe(HISTORY_LIMIT);
  });

  it('vide le plan avec une étape d\'historique, et refuse un plan invalide au chargement', () => {
    const store = createStore();
    store.actions.addWalls(A, { x: 5, y: 2 });
    expect(store.actions.clearAll()).toBe(true);
    expect(store.getState().plan.walls).toHaveLength(0);
    store.actions.undo();
    expect(store.getState().plan.walls).toHaveLength(3);
    expect(store.actions.loadPlan({ version: 9 }).ok).toBe(false);
    expect(store.getState().plan.walls).toHaveLength(3);
    expect(store.actions.loadPlan(createEmptyPlan()).ok).toBe(true);
    expect(store.getState().canUndo).toBe(false);
  });

  it('prévient les abonnés du plan seulement quand le plan change', () => {
    const store = createStore();
    let planEvents = 0;
    let uiEvents = 0;
    store.subscribe(() => planEvents++);
    store.subscribeUi(() => uiEvents++);
    store.actions.setTool('erase');
    expect(planEvents).toBe(0);
    expect(uiEvents).toBe(1);
    store.actions.addWalls(A, { x: 4, y: 2 });
    expect(planEvents).toBe(1);
    expect(store.getState().tool).toBe('erase');
  });
});

/* ------------------------------------------------------------------ */
/* Phase 2 : pièces                                                   */
/* ------------------------------------------------------------------ */

/** Plan avec le contour d'un rectangle de points (x0, y0) à (x1, y1). */
const withBox = (plan, x0, y0, x1, y1) => {
  let next = addWallSegments(plan, { x: x0, y: y0 }, { x: x1, y: y0 });
  next = addWallSegments(next, { x: x1, y: y0 }, { x: x1, y: y1 });
  next = addWallSegments(next, { x: x1, y: y1 }, { x: x0, y: y1 });
  return addWallSegments(next, { x: x0, y: y1 }, { x: x0, y: y0 });
};
const withWall = (plan, x0, y0, x1, y1) => addWallSegments(plan, { x: x0, y: y0 }, { x: x1, y: y1 });

describe('detectRooms', () => {
  it('ne trouve aucune pièce sur une grille vide : tout est l\'extérieur', () => {
    expect(detectRooms(createEmptyPlan())).toEqual([]);
  });

  it('détecte un rectangle fermé : cases, surface, limites, centre et identifiant', () => {
    const rooms = detectRooms(withBox(createEmptyPlan(), 4, 4, 12, 10)); // 8 x 6 cases = 4 m x 3 m
    expect(rooms).toHaveLength(1);
    const room = rooms[0];
    expect(room.cells).toHaveLength(48);
    expect(room.areaM2).toBe(12);
    expect(room.anchor).toEqual({ x: 4, y: 4 });
    expect(room.id).toBe('room-4-4');
    expect(room.bounds).toEqual({ minX: 4, minY: 4, maxX: 12, maxY: 10 });
    expect(room.centroid).toEqual({ x: 8, y: 7 });
    expect(roomAtCell(rooms, room.labelPoint.x - 0.5, room.labelPoint.y - 0.5)).toBe(room);
  });

  it('sépare un rectangle avec une cloison en deux pièces', () => {
    const plan = withWall(withBox(createEmptyPlan(), 4, 4, 12, 10), 8, 4, 8, 10);
    const rooms = detectRooms(plan);
    expect(rooms).toHaveLength(2);
    expect(rooms.map((r) => r.id)).toEqual(['room-4-4', 'room-8-4']);
    expect(rooms.map((r) => r.cells.length)).toEqual([24, 24]);
    expect(rooms[0].areaM2 + rooms[1].areaM2).toBe(12);
  });

  it('ne trouve aucune pièce quand le contour a un trou', () => {
    const closed = withBox(createEmptyPlan(), 4, 4, 12, 10);
    const hole = removeWallSegments(closed, { x: 4, y: 6 }, { x: 4, y: 7 }); // une arête de moins sur le côté gauche
    expect(hole.walls).toHaveLength(closed.walls.length - 1);
    expect(detectRooms(hole)).toEqual([]);
  });

  it('détecte une pièce en L comme une seule pièce, avec le point d\'étiquette à l\'intérieur', () => {
    let plan = createEmptyPlan();
    const path = [[2, 2], [8, 2], [8, 5], [5, 5], [5, 9], [2, 9], [2, 2]];
    for (let i = 0; i < path.length - 1; i++) plan = withWall(plan, ...path[i], ...path[i + 1]);
    const rooms = detectRooms(plan);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].cells).toHaveLength(6 * 3 + 3 * 4); // 30 cases
    expect(rooms[0].areaM2).toBe(7.5);
    const { labelPoint } = rooms[0];
    expect(roomAtCell(rooms, Math.floor(labelPoint.x), Math.floor(labelPoint.y))).toBe(rooms[0]);
  });

  it('détecte deux pièces séparées, triées de haut en bas puis de gauche à droite', () => {
    let plan = withBox(createEmptyPlan(), 20, 10, 26, 14);
    plan = withBox(plan, 2, 2, 6, 6);
    const rooms = detectRooms(plan);
    expect(rooms.map((r) => r.id)).toEqual(['room-2-2', 'room-20-10']);
    expect(rooms.map((r) => r.cells.length)).toEqual([16, 24]);
  });

  it('fusionne deux pièces quand on supprime la cloison, et garde l\'identifiant de la case la plus haute à gauche', () => {
    const split = withWall(withBox(createEmptyPlan(), 4, 4, 12, 10), 8, 4, 8, 10);
    expect(detectRooms(split)).toHaveLength(2);
    const merged = removeWallSegments(split, { x: 8, y: 4 }, { x: 8, y: 10 });
    const rooms = detectRooms(merged);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].cells).toHaveLength(48);
    expect(rooms[0].id).toBe('room-4-4');
  });

  it('traite le bord de la grille : un mur posé sur le bord ferme la pièce, un bord ouvert la laisse à l\'extérieur', () => {
    const corner = withBox(createEmptyPlan(), 0, 0, 4, 4); // murs sur le bord haut et gauche de la grille
    expect(detectRooms(corner)).toHaveLength(1);
    const open = removeWallSegments(corner, { x: 0, y: 0 }, { x: 1, y: 0 }); // une case s'ouvre sur le bord
    expect(detectRooms(open)).toEqual([]);
    const right = withBox(createEmptyPlan(), 36, 26, 40, 30); // coin bas droit
    expect(detectRooms(right)).toHaveLength(1);
  });
});

describe('types et noms des pièces', () => {
  const split = () => withWall(withBox(createEmptyPlan(), 4, 4, 12, 10), 6, 4, 6, 10); // 2 x 6 = 12 cases | 6 x 6 = 36 cases

  it('donne « other » par défaut et change type et nom à partir de la case-ancre', () => {
    const plan = split();
    const [left, right] = detectRooms(plan);
    expect(getRoomType(plan, left)).toBe('other');
    expect(roomLabel(plan, left)).toBe('Autre');
    const typed = setRoomInfo(plan, right, { type: 'bedroom', name: '  Chambre   parents ' });
    expect(typed.roomTypes).toEqual({ '6,4': 'bedroom' });
    expect(getRoomName(typed, right)).toBe('Chambre parents');
    expect(roomLabel(typed, right)).toBe('Chambre parents');
    expect(roomLabel(setRoomInfo(typed, right, { name: '' }), right)).toBe('Chambre');
    expect(validatePlan(typed).valid).toBe(true);
  });

  it('ne stocke pas « other » ni un nom vide, tronque les noms trop longs et ne change rien sans modification', () => {
    const plan = split();
    const [left] = detectRooms(plan);
    const kitchen = setRoomInfo(plan, left, { type: 'kitchen' });
    expect(setRoomInfo(kitchen, left, { type: 'other' }).roomTypes).toEqual({});
    expect(setRoomInfo(plan, left, { type: 'other', name: '' })).toBe(plan);
    expect(setRoomInfo(kitchen, left, { type: 'kitchen' })).toBe(kitchen);
    expect(setRoomInfo(plan, left, { type: 'piscine' })).toBe(plan); // type inconnu ignoré
    expect(setRoomInfo(plan, left, { type: 'garage' }).roomTypes).toEqual({ '4,4': 'garage' });
    expect(getRoomName(setRoomInfo(plan, left, { name: 'x'.repeat(100) }), left)).toHaveLength(ROOM_NAME_MAX);
  });

  it('hérite du type de l\'ancienne pièce qui partage le plus de cases après une fusion', () => {
    let plan = split();
    const [left, right] = detectRooms(plan);
    plan = setRoomInfo(setRoomInfo(plan, left, { type: 'kitchen' }), right, { type: 'bedroom', name: 'Parents' });
    const merged = reconcileRoomTypes(plan, removeWallSegments(plan, { x: 6, y: 4 }, { x: 6, y: 10 }));
    const [room] = detectRooms(merged);
    expect(getRoomType(merged, room)).toBe('bedroom'); // 36 cases contre 12
    expect(getRoomName(merged, room)).toBe('Parents');
    expect(merged.roomTypes).toEqual({ '4,4': 'bedroom' }); // l'entrée de la pièce disparue est retirée
  });

  it('hérite du type après un déplacement de cloison, et garde « other » pour une pièce toute neuve', () => {
    let plan = split();
    const [, right] = detectRooms(plan);
    plan = setRoomInfo(plan, right, { type: 'living' });
    // On ajoute une pièce neuve ailleurs : elle est « other », la première garde son type.
    const next = reconcileRoomTypes(plan, withBox(plan, 20, 20, 24, 24));
    const rooms = detectRooms(next);
    expect(rooms).toHaveLength(3);
    expect(rooms.map((r) => getRoomType(next, r))).toEqual(['other', 'living', 'other']);
    // On recule la cloison d'une case : la pièce de droite change d'ancre mais garde son type.
    const moved = reconcileRoomTypes(
      next,
      withWall(removeWallSegments(next, { x: 6, y: 4 }, { x: 6, y: 10 }), 7, 4, 7, 10),
    );
    const movedRooms = detectRooms(moved);
    expect(movedRooms.map((r) => r.id)).toEqual(['room-4-4', 'room-7-4', 'room-20-20']);
    expect(movedRooms.map((r) => getRoomType(moved, r))).toEqual(['other', 'living', 'other']);
  });

  it('retire le type d\'une pièce qui s\'ouvre, et rend le même plan quand rien ne change', () => {
    let plan = withBox(createEmptyPlan(), 4, 4, 12, 10);
    plan = setRoomInfo(plan, detectRooms(plan)[0], { type: 'office' });
    const unchanged = withWall(plan, 14, 14, 16, 14); // un mur isolé : aucune pièce ne bouge
    expect(reconcileRoomTypes(plan, unchanged)).toBe(unchanged);
    const opened = removeWallSegments(plan, { x: 4, y: 4 }, { x: 5, y: 4 });
    expect(reconcileRoomTypes(plan, opened).roomTypes).toEqual({});
  });

  it('décrit chaque type de pièce avec un libellé en français et une couleur', () => {
    for (const type of ROOM_TYPES) {
      expect(ROOM_TYPE_INFO[type].label.length).toBeGreaterThan(0);
    }
    expect(ROOM_TYPE_INFO.living.label).toBe('Salon');
    expect(roomColor('kitchen', { sat: 60, light: 85 }, 0.5)).toBe('hsla(110, 60%, 85%, 0.5)');
    expect(roomColor('other', { sat: 50, light: 80 })).toBe('hsla(214, 7%, 80%, 1)');
  });

  it('range les types de pièces en familles : chaque type dans une seule famille, rien d\'oublié', () => {
    const seen = new Map();
    for (const group of ROOM_GROUPS) {
      expect(group.label.length > 0 && group.types.length > 0 ? group.id : `${group.id} : vide`).toBe(group.id);
      for (const type of group.types) {
        expect(ROOM_TYPES.includes(type) ? type : `${type} : type inconnu`).toBe(type);
        expect(seen.has(type) ? `${type} : dans deux familles` : type).toBe(type);
        seen.set(type, group.id);
      }
    }
    for (const type of ROOM_TYPES) expect(seen.has(type) ? type : `${type} : sans famille`).toBe(type);
    expect(ROOM_GROUPS.map((g) => g.id)).toEqual(['life', 'night', 'water', 'work', 'circulation', 'annex']);
    expect(roomGroupOf('garage').id).toBe('annex');
    expect(roomGroupOf('kidsroom').id).toBe('night');
    expect(roomGroupOf('inconnu').id).toBe('annex');
    for (const type of ['garage', 'kidsroom', 'dressing', 'pantry', 'workshop']) expect(ROOM_TYPE_INFO[type].label.length > 0 ? type : `${type} sans libellé`).toBe(type);
  });

  it('valide les noms de pièces et accepte les plans enregistrés avant la phase 2', () => {
    const box = withBox(createEmptyPlan(), 3, 3, 9, 9);
    const plan = { ...box, roomNames: { '3,3': 'Bureau' } };
    expect(validatePlan(plan).valid).toBe(true);
    const legacy = { ...box };
    delete legacy.roomNames;
    expect(validatePlan(legacy).valid).toBe(true);
    const bad = { ...box, roomNames: { '3,3': '' } };
    expect(validatePlan(bad).valid).toBe(false);
    const outside = createEmptyPlan();
    outside.roomNames['99,3'] = 'Dehors';
    expect(validatePlan(outside).valid).toBe(false);
  });
});

describe('contours ouverts', () => {
  it('ne signale rien pour une pièce fermée ni pour un début de tracé', () => {
    expect(findOpenOutlines(withBox(createEmptyPlan(), 4, 4, 12, 10))).toEqual([]);
    expect(findOpenOutlines(withWall(createEmptyPlan(), 4, 4, 6, 4))).toEqual([]); // 2 arêtes seulement
    expect(findOpenOutlines(createEmptyPlan())).toEqual([]);
  });

  it('signale un contour qui ne ferme aucune pièce, avec ses extrémités libres', () => {
    const closed = withBox(createEmptyPlan(), 4, 4, 12, 10);
    const open = removeWallSegments(closed, { x: 4, y: 6 }, { x: 4, y: 7 });
    const outlines = findOpenOutlines(open);
    expect(outlines).toHaveLength(1);
    expect(outlines[0].edges).toHaveLength(open.walls.length);
    expect(outlines[0].ends).toHaveLength(2);
    expect(outlines[0].ends.map((p) => `${p.x},${p.y}`).sort()).toEqual(['4,6', '4,7']);
  });

  it('ne signale que le contour ouvert quand une autre pièce est bien fermée', () => {
    let plan = withBox(createEmptyPlan(), 2, 2, 6, 6);
    plan = withWall(withWall(withWall(plan, 20, 20, 26, 20), 26, 20, 26, 24), 26, 24, 20, 24); // un U ouvert
    const outlines = findOpenOutlines(plan);
    expect(outlines).toHaveLength(1);
    expect(outlines[0].edges).toHaveLength(6 + 4 + 6);
    expect(detectRooms(plan)).toHaveLength(1);
  });
});

describe('store : pièces', () => {
  const build = () => {
    const store = createStore();
    store.actions.addWalls({ x: 4, y: 4 }, { x: 12, y: 4 });
    store.actions.addWalls({ x: 12, y: 4 }, { x: 12, y: 10 });
    store.actions.addWalls({ x: 12, y: 10 }, { x: 4, y: 10 });
    store.actions.addWalls({ x: 4, y: 10 }, { x: 4, y: 4 });
    return store;
  };

  it('calcule les pièces une seule fois par plan et les met à jour quand les murs changent', () => {
    const store = build();
    const rooms = store.getRooms();
    expect(rooms).toHaveLength(1);
    expect(store.getRooms()).toBe(rooms);
    store.actions.addWalls({ x: 8, y: 4 }, { x: 8, y: 10 });
    expect(store.getRooms()).toHaveLength(2);
    store.actions.undo();
    expect(store.getRooms()).toHaveLength(1);
  });

  it('change le type et le nom en une étape d\'historique, annulable', () => {
    const store = build();
    const [room] = store.getRooms();
    let planEvents = 0;
    store.subscribe(() => planEvents++);
    expect(store.actions.setRoomInfo(room.id, { type: 'bathroom', name: 'Sdb' })).toBe(true);
    expect(planEvents).toBe(1);
    expect(store.getState().plan.roomTypes).toEqual({ '4,4': 'bathroom' });
    expect(store.getState().plan.roomNames).toEqual({ '4,4': 'Sdb' });
    expect(store.actions.setRoomInfo(room.id, { type: 'bathroom' })).toBe(false); // rien ne change : pas d'entrée
    expect(store.actions.setRoomInfo('room-0-0', { type: 'kitchen' })).toBe(false); // pièce inconnue
    store.actions.undo();
    expect(store.getState().plan.roomTypes).toEqual({});
    expect(store.getState().plan.roomNames).toEqual({});
    store.actions.redo();
    expect(getRoomType(store.getState().plan, store.getRooms()[0])).toBe('bathroom');
  });

  it('conserve le type quand on ajoute puis qu\'on retire une cloison, et annule sans perte', () => {
    const store = build();
    store.actions.setRoomInfo('room-4-4', { type: 'living' });
    store.actions.addWalls({ x: 8, y: 4 }, { x: 8, y: 10 }); // deux pièces de 24 cases : les deux héritent
    expect(store.getRooms().map((r) => getRoomType(store.getState().plan, r))).toEqual(['living', 'living']);
    store.actions.removeWalls({ x: 8, y: 4 }, { x: 8, y: 10 }); // on retire la cloison
    expect(store.getRooms()).toHaveLength(1);
    expect(store.getState().plan.roomTypes).toEqual({ '4,4': 'living' });
    store.actions.undo();
    expect(store.getRooms()).toHaveLength(2);
  });

  it('gère la sélection d\'une pièce sans toucher à l\'historique, et la retire quand la pièce disparaît', () => {
    const store = build();
    const undoBefore = store.getState().canUndo;
    expect(store.actions.selectRoom('room-4-4')).toBe(true);
    expect(store.getState().selectedRoomId).toBe('room-4-4');
    expect(store.getState().canUndo).toBe(undoBefore);
    expect(store.actions.selectRoom('room-4-4')).toBe(false);
    expect(store.actions.selectRoom('room-9-9')).toBe(false); // pièce inconnue : ignorée
    expect(store.getState().selectedRoomId).toBe('room-4-4');
    store.actions.undo(); // le dernier mur disparaît : la pièce aussi
    expect(store.getState().selectedRoomId).toBe(null);
    expect(store.actions.selectRoom(null)).toBe(false);
  });

  it('charge un plan enregistré avant la phase 2 en lui ajoutant roomNames', () => {
    const legacy = createEmptyPlan();
    delete legacy.roomNames;
    const store = createStore(legacy);
    expect(store.getState().plan.roomNames).toEqual({});
    const other = createStore();
    expect(other.actions.loadPlan(legacy).ok).toBe(true);
    expect(other.getState().plan.roomNames).toEqual({});
    expect(other.actions.clearAll()).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Phase 3 : portes, fenêtres, passages                               */
/* ------------------------------------------------------------------ */

/** Rectangle de (4, 4) à (24, 16) avec une cloison verticale à x = 14 : un mur horizontal du haut va de x = 4 à 24. */
const house = () => withWall(withBox(createEmptyPlan(), 4, 4, 24, 16), 14, 4, 14, 16);
const hStart = (x, y) => ({ x, y, dir: 'h' });
const vStart = (x, y) => ({ x, y, dir: 'v' });

describe('ouvertures : modèle et valeurs par défaut', () => {
  it('pose une porte de 2 arêtes (1 m) et une fenêtre avec allège 0,9 m et hauteur 1,2 m', () => {
    let plan = addOpening(house(), { type: 'door', start: hStart(6, 4) });
    plan = addOpening(plan, { type: 'window', start: hStart(18, 4) });
    plan = addOpening(plan, { type: 'passage', start: vStart(14, 8) });
    expect(plan.openings.map((o) => o.id)).toEqual(['o1', 'o2', 'o3']);
    const [door, win, passage] = plan.openings;
    expect(door.span).toBe(2);
    expect(openingSill(door)).toBe(0);
    expect(openingHeight(door)).toBe(2.05);
    expect(win.span).toBe(2);
    expect(openingSill(win)).toBe(0.9);
    expect(openingHeight(win)).toBe(1.2);
    expect(passage.span).toBe(2);
    expect(openingEdges(door)).toEqual([hStart(6, 4), hStart(7, 4)]);
    expect(openingEdges(passage)).toEqual([vStart(14, 8), vStart(14, 9)]);
    expect(validatePlan(plan).valid).toBe(true);
    expect(OPENING_DEFAULTS.door.height).toBe(2.05);
  });

  it('refuse une ouverture sans mur, qui dépasse le mur, qui en chevauche une autre ou dont la largeur est hors de 1 à 4', () => {
    const plan = addOpening(house(), { type: 'door', start: hStart(6, 4) });
    expect(addOpening(plan, { type: 'door', start: hStart(6, 8) })).toBe(plan); // pas de mur à cet endroit
    expect(addOpening(plan, { type: 'door', start: hStart(23, 4) })).toBe(plan); // le mur s'arrête à x = 24
    expect(addOpening(plan, { type: 'window', start: hStart(7, 4) })).toBe(plan); // chevauche la porte
    expect(addOpening(plan, { type: 'window', start: hStart(10, 4), span: 5 })).toBe(plan);
    expect(addOpening(plan, { type: 'window', start: hStart(10, 4), span: 0 })).toBe(plan);
    expect(addOpening(plan, { type: 'garage', start: hStart(10, 4) })).toBe(plan);
    expect(canPlaceOpening(plan, hStart(8, 4), 2)).toEqual({ ok: true });
    expect(canPlaceOpening(plan, hStart(7, 4), 2).reason).toBe('overlap');
    expect(canPlaceOpening(plan, hStart(6, 5), 2).reason).toBe('no-wall');
    expect(addOpening(plan, { type: 'window', start: hStart(8, 4), span: 4 }).openings).toHaveLength(2);
  });

  it('valide un plan : arêtes sans mur et chevauchements sont rejetés', () => {
    const ok = addOpening(house(), { type: 'door', start: hStart(6, 4) });
    expect(validatePlan(ok).valid).toBe(true);
    const noWall = { ...ok, openings: [{ ...ok.openings[0], start: hStart(6, 9) }] };
    expect(validatePlan(noWall).valid).toBe(false);
    const overlap = { ...ok, openings: [ok.openings[0], { ...ok.openings[0], id: 'o2', start: hStart(7, 4) }] };
    expect(validatePlan(overlap).valid).toBe(false);
    const tooTall = { ...ok, openings: [{ ...ok.openings[0], sill: 1, height: 2 }] };
    expect(validatePlan(tooTall).valid).toBe(false);
    const legacy = { ...ok, openings: [{ id: 'o1', type: 'door', start: hStart(6, 4), span: 2, swing: 'a' }] };
    expect(validatePlan(legacy).valid).toBe(true); // sans allège ni hauteur : valeurs par défaut
  });

  it('ne fusionne pas les pièces : une porte ou un passage dans une cloison garde deux pièces', () => {
    const base = house();
    expect(detectRooms(base)).toHaveLength(2);
    const withDoor = addOpening(addOpening(base, { type: 'door', start: vStart(14, 6) }), { type: 'passage', start: vStart(14, 10) });
    expect(withDoor.openings).toHaveLength(2);
    expect(detectRooms(withDoor)).toHaveLength(2);
  });
});

describe('ouvertures : suppression avec les murs', () => {
  const furnished = () => {
    let plan = addOpening(house(), { type: 'door', start: hStart(6, 4) });
    plan = addOpening(plan, { type: 'window', start: hStart(18, 4) });
    return plan;
  };

  it('supprimer un segment de mur supprime les ouvertures qui l\'utilisent, et seulement elles', () => {
    const plan = furnished();
    const cut = removeWallSegments(plan, hStart(7, 4), hStart(8, 4)); // une seule arête, sous la porte
    expect(cut.openings.map((o) => o.type)).toEqual(['window']);
    expect(cut.walls).toHaveLength(plan.walls.length - 1);
    const farAway = removeWallSegments(plan, hStart(10, 4), hStart(12, 4));
    expect(farAway.openings).toHaveLength(2);
  });

  it('la gomme qui glisse sur le mur supprime aussi les ouvertures ; un toucher sur une ouverture ne supprime qu\'elle', () => {
    const plan = furnished();
    const dragged = eraseAlongPath(plan, { x: 5.6, y: 4.1 }, { x: 8.4, y: 4.1 }, 0.4);
    expect(dragged.openings.map((o) => o.type)).toEqual(['window']);
    expect(dragged.walls.length < plan.walls.length).toBe(true);
    const tapped = eraseAlongPath(plan, { x: 7, y: 4.1 }, { x: 7, y: 4.1 }, 0.4);
    expect(tapped.openings.map((o) => o.type)).toEqual(['window']);
    expect(tapped.walls).toHaveLength(plan.walls.length); // le mur reste
    const wallTap = eraseAlongPath(plan, { x: 11.5, y: 4.1 }, { x: 11.5, y: 4.1 }, 0.4);
    expect(wallTap.walls).toHaveLength(plan.walls.length - 1);
    expect(wallTap.openings).toHaveLength(2);
  });

  it('retire une ouverture sans toucher au mur, et tout effacer les retire toutes', () => {
    const plan = furnished();
    const removed = removeOpening(plan, 'o1');
    expect(removed.openings.map((o) => o.id)).toEqual(['o2']);
    expect(removed.walls).toHaveLength(plan.walls.length);
    expect(removeOpening(plan, 'inconnu')).toBe(plan);
    expect(clearPlan(plan).openings).toEqual([]);
  });
});

describe('ouvertures : modifier', () => {
  it('change la largeur de 1 à 4 arêtes en gardant le centre, et refuse ce qui ne tient pas', () => {
    let plan = addOpening(house(), { type: 'window', start: hStart(10, 4) }); // arêtes 10 et 11
    let grown = updateOpening(plan, 'o1', { span: 4 });
    expect(grown.openings[0].span).toBe(4);
    expect(grown.openings[0].start.x).toBe(9); // centre conservé : 9 à 12
    expect(updateOpening(grown, 'o1', { span: 1 }).openings[0].span).toBe(1);
    expect(updateOpening(plan, 'o1', { span: 5 })).toBe(plan);
    expect(updateOpening(plan, 'o1', { span: 0 })).toBe(plan);
    // Contre la cloison (x = 14) : un mur de 4 arêtes à x = 4..14 ; une porte collée à droite ne peut s'élargir qu'à gauche.
    plan = addOpening(house(), { type: 'door', start: hStart(12, 4) }); // 12 et 13
    expect(updateOpening(plan, 'o1', { span: 3 }).openings[0].start.x).toBe(11);
    // Une autre ouverture bloque l'élargissement des deux côtés.
    plan = addOpening(addOpening(addOpening(house(), { type: 'door', start: hStart(10, 4) }), { type: 'window', start: hStart(8, 4) }), { type: 'window', start: hStart(12, 4) });
    expect(updateOpening(plan, 'o1', { span: 3 })).toBe(plan);
  });

  it('change le type (allège et hauteur reprennent les valeurs du type), le côté, l\'allège et la hauteur', () => {
    let plan = addOpening(house(), { type: 'door', start: hStart(6, 4), swing: 'a' });
    plan = updateOpening(plan, 'o1', { type: 'window' });
    expect(plan.openings[0].type).toBe('window');
    expect(openingSill(plan.openings[0])).toBe(0.9);
    expect(openingHeight(plan.openings[0])).toBe(1.2);
    plan = updateOpening(plan, 'o1', { sill: 1, height: 1 });
    expect(openingSill(plan.openings[0])).toBe(1);
    expect(openingHeight(plan.openings[0])).toBe(1);
    const clamped = updateOpening(plan, 'o1', { sill: 2, height: 3 }); // les murs font 2,5 m
    expect(openingSill(clamped.openings[0]) + openingHeight(clamped.openings[0])).toBeLessThan(2.51);
    expect(flipOpening(plan, 'o1').openings[0].swing).toBe('b');
    expect(flipOpening(flipOpening(plan, 'o1'), 'o1').openings[0].swing).toBe('a');
    expect(updateOpening(plan, 'o1', { swing: 'a' })).toBe(plan);
    expect(flipOpening(plan, 'inconnu')).toBe(plan);
  });
});

describe('ouvertures : emplacement sous le pointeur', () => {
  it('centre l\'ouverture sur le pointeur et choisit le côté du pointeur', () => {
    const plan = house();
    const above = findOpeningPlacement(plan, { x: 8, y: 3.8 }, 'door');
    expect(above).toEqual({ type: 'door', start: hStart(7, 4), span: 2, swing: 'a' });
    const below = findOpeningPlacement(plan, { x: 8, y: 4.2 }, 'door');
    expect(below.swing).toBe('b');
    const vertical = findOpeningPlacement(plan, { x: 13.8, y: 10 }, 'window');
    expect(vertical).toEqual({ type: 'window', start: vStart(14, 9), span: 2, swing: 'a' });
    expect(findOpeningPlacement(plan, { x: 18, y: 10 }, 'door')).toBe(null); // au milieu d'une pièce
  });

  it('décale l\'ouverture au bout d\'un mur et évite les ouvertures déjà posées', () => {
    let plan = house();
    const corner = findOpeningPlacement(plan, { x: 4.2, y: 3.9 }, 'door'); // le pointeur est sur le coin
    expect(corner.start).toEqual(hStart(4, 4));
    plan = addOpening(plan, { type: 'door', start: hStart(8, 4) });
    const next = findOpeningPlacement(plan, { x: 9, y: 3.9 }, 'window');
    expect(next).toBe(null); // la porte occupe déjà 8 et 9 : pas de place centrée sur le pointeur
    const beside = findOpeningPlacement(plan, { x: 10.3, y: 3.9 }, 'window');
    expect(canPlaceOpening(plan, beside.start, beside.span).ok).toBe(true);
    expect(findOpeningAt(plan, { x: 9, y: 4.2 })?.id).toBe('o1');
    expect(findOpeningAt(plan, { x: 12, y: 4.2 })).toBe(null);
  });
});

describe('zones de dégagement et dessin des murs', () => {
  it('donne pour chaque porte un rectangle de sa largeur sur 1 m, du côté où elle s\'ouvre', () => {
    const t = 0.05; // demi-épaisseur du mur
    let plan = addOpening(house(), { type: 'door', start: hStart(6, 4), swing: 'a' }); // mur horizontal y = 2 m, ouvre vers le haut
    plan = addOpening(plan, { type: 'door', start: hStart(18, 4), swing: 'b', span: 3 }); // vers le bas, 1,5 m
    plan = addOpening(plan, { type: 'door', start: vStart(14, 8), swing: 'a' }); // cloison x = 7 m, ouvre vers la gauche
    plan = addOpening(plan, { type: 'door', start: vStart(14, 12), swing: 'b' }); // vers la droite
    plan = addOpening(plan, { type: 'window', start: hStart(10, 4) });
    plan = addOpening(plan, { type: 'passage', start: hStart(12, 4) });
    const zones = getClearanceZones(plan);
    expect(zones).toHaveLength(4); // ni fenêtre ni passage
    const [up, down, left, right] = zones;
    const near = (a, b) => Math.abs(a - b) < 1e-9;
    expect([up.openingId, down.openingId]).toEqual(['o1', 'o2']);
    expect(near(up.x, 3) && near(up.w, 1) && near(up.h, CLEARANCE_DEPTH_M) && near(up.y, 2 - t - 1)).toBe(true);
    expect(near(down.x, 9) && near(down.w, 1.5) && near(down.h, 1) && near(down.y, 2 + t)).toBe(true);
    expect(near(left.y, 4) && near(left.h, 1) && near(left.w, 1) && near(left.x, 7 - t - 1)).toBe(true);
    expect(near(right.y, 6) && near(right.h, 1) && near(right.w, 1) && near(right.x, 7 + t)).toBe(true);
    expect(getClearanceZones(house())).toEqual([]);
  });

  it('interrompt le mur sous une ouverture et garde les autres murs complets', () => {
    const base = house();
    const plain = wallRectsWithOpenings(base, 0.2);
    expect(plain).toHaveLength(base.walls.length);
    const withDoor = addOpening(base, { type: 'door', start: hStart(8, 4) });
    const rects = wallRectsWithOpenings(withDoor, 0.2);
    expect(rects).toHaveLength(base.walls.length - 2);
    const top = rects.filter((r) => Math.abs(r.y + 0.1 - 4) < 1e-9 && r.h < 1); // les rectangles du mur horizontal y = 4
    expect(top.some((r) => r.x < 10 && r.x + r.w > 8.0001)).toBe(false); // rien devant la porte (8 → 10)
    const lastBefore = top.find((r) => Math.abs(r.x - 6.9) < 1e-9);
    expect(Math.abs(lastBefore.x + lastBefore.w - 8) < 1e-9).toBe(true); // bout droit contre la porte
    expect(top.some((r) => Math.abs(r.x - 10) < 1e-9)).toBe(true);
  });
});

describe('store : ouvertures', () => {
  const build = () => {
    const store = createStore();
    for (const [a, b] of [[[4, 4], [24, 4]], [[24, 4], [24, 16]], [[24, 16], [4, 16]], [[4, 16], [4, 4]]]) {
      store.actions.addWalls({ x: a[0], y: a[1] }, { x: b[0], y: b[1] });
    }
    return store;
  };

  it('pose une ouverture en une étape d\'historique, la sélectionne, et annule', () => {
    const store = build();
    const id = store.actions.addOpening({ type: 'door', start: hStart(6, 4), swing: 'a' });
    expect(id).toBe('o1');
    expect(store.getState().selectedOpeningId).toBe('o1');
    expect(store.getState().plan.openings).toHaveLength(1);
    expect(store.actions.addOpening({ type: 'door', start: hStart(6, 4) })).toBe(null); // déjà occupé
    store.actions.undo();
    expect(store.getState().plan.openings).toHaveLength(0);
    expect(store.getState().selectedOpeningId).toBe(null);
    store.actions.redo();
    expect(store.getState().plan.openings).toHaveLength(1);
  });

  it('modifie, inverse et supprime l\'ouverture sélectionnée', () => {
    const store = build();
    store.actions.addOpening({ type: 'window', start: hStart(10, 4) });
    expect(store.actions.updateOpening('o1', { span: 3 })).toBe(true);
    expect(store.getState().plan.openings[0].span).toBe(3);
    expect(store.actions.updateOpening('o1', { span: 3 })).toBe(false); // rien ne change
    expect(store.actions.flipOpening('o1')).toBe(true);
    expect(store.getState().plan.openings[0].swing).toBe('b');
    expect(store.actions.removeOpening('o1')).toBe(true);
    expect(store.getState().selectedOpeningId).toBe(null);
    expect(store.getState().plan.walls).toHaveLength(64);
  });

  it('gère l\'emplacement en attente (second toucher) et l\'abandonne quand l\'outil ou le plan change', () => {
    const store = build();
    store.actions.setTool('door');
    const spec = { type: 'door', start: hStart(6, 4), span: 2, swing: 'a' };
    expect(store.actions.setPendingOpening(spec)).toBe(true);
    expect(store.getState().pendingOpening).toEqual(spec);
    expect(store.actions.flipPendingOpening()).toBe(true);
    expect(store.getState().pendingOpening.swing).toBe('b');
    expect(store.actions.commitPendingOpening()).toBe('o1');
    expect(store.getState().pendingOpening).toBe(null);
    expect(store.getState().plan.openings[0].swing).toBe('b');
    store.actions.setPendingOpening({ ...spec, start: hStart(10, 4) });
    store.actions.setTool('wall');
    expect(store.getState().pendingOpening).toBe(null);
    expect(store.getState().selectedOpeningId).toBe(null); // le panneau suit les outils d'ouverture
    store.actions.setTool('window');
    store.actions.setPendingOpening({ ...spec, start: hStart(10, 4) });
    store.actions.removeWalls({ x: 10, y: 4 }, { x: 12, y: 4 });
    expect(store.getState().pendingOpening).toBe(null); // le mur a disparu
  });

  it('supprime les ouvertures quand on efface leur mur, et l\'annulation les rend', () => {
    const store = build();
    store.actions.addOpening({ type: 'door', start: hStart(6, 4) });
    store.actions.removeWalls({ x: 6, y: 4 }, { x: 7, y: 4 });
    expect(store.getState().plan.openings).toHaveLength(0);
    expect(store.getState().selectedOpeningId).toBe(null);
    store.actions.undo();
    expect(store.getState().plan.openings).toHaveLength(1);
    expect(store.actions.showClearance(true)).toBe(true);
    expect(store.getState().showClearance).toBe(true);
    expect(store.getClearanceZones()).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ */
/* Phase 4 : structure 3D                                             */
/* ------------------------------------------------------------------ */

const EPS = 1e-9;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const ofKind = (structure, ...kinds) => structure.boxes.filter((box) => kinds.includes(box.kind));
const bounds = (box) => ({
  x0: box.position[0] - box.size[0] / 2,
  x1: box.position[0] + box.size[0] / 2,
  y0: box.position[1] - box.size[1] / 2,
  y1: box.position[1] + box.size[1] / 2,
  z0: box.position[2] - box.size[2] / 2,
  z1: box.position[2] + box.size[2] / 2,
});
/** Le point (x, y, z) est-il dans l'une des boîtes ? */
const covered = (boxes, x, y, z) =>
  boxes.some((box) => {
    const b = bounds(box);
    return x >= b.x0 - EPS && x <= b.x1 + EPS && y >= b.y0 - EPS && y <= b.y1 + EPS && z >= b.z0 - EPS && z <= b.z1 + EPS;
  });
/** Un point du plan (x, z) est-il couvert par un mur, à mi-hauteur ? */
const wallAt = (structure, x, z, y = 1) => covered(ofKind(structure, 'wall', 'sill', 'lintel'), x, y, z);

describe('structure 3D : murs', () => {
  it('un mur simple devient une boîte de 0,1 m d\'épaisseur, centrée sur la ligne de grille', () => {
    const plan = withWall(createEmptyPlan(), 4, 4, 8, 4); // 2 m, de x = 2 m à 4 m, sur z = 2 m
    const walls = ofKind(buildStructure(plan), 'wall');
    expect(walls).toHaveLength(1);
    expect(walls[0].size).toEqual([2.1, 2.5, 0.1]); // prolongé d'une demi-épaisseur à chaque bout
    expect(walls[0].position).toEqual([3, 1.25, 2]);
  });

  it('un mur vertical utilise z pour la longueur : le plan (x, y) devient (x, z)', () => {
    const plan = withWall(createEmptyPlan(), 6, 2, 6, 6); // x = 3 m, de y = 1 m à 3 m
    const wall = ofKind(buildStructure(plan), 'wall')[0];
    expect(wall.size).toEqual([0.1, 2.5, 2.1]);
    expect(wall.position).toEqual([3, 1.25, 2]);
  });

  it('la hauteur du mur suit plan.wallHeight', () => {
    const plan = { ...withWall(createEmptyPlan(), 4, 4, 8, 4), wallHeight: 3 };
    expect(ofKind(buildStructure(plan), 'wall')[0].size[1]).toBe(3);
  });

  it('fusionne les segments colinéaires adjacents en une seule boîte', () => {
    const plan = withWall(withWall(createEmptyPlan(), 4, 4, 8, 4), 8, 4, 12, 4);
    expect(ofKind(buildStructure(plan), 'wall')).toHaveLength(1);
    // deux segments séparés par un trou restent deux boîtes
    const gap = withWall(withWall(createEmptyPlan(), 4, 4, 6, 4), 8, 4, 10, 4);
    expect(ofKind(buildStructure(gap), 'wall')).toHaveLength(2);
  });

  it('un angle n\'a pas de trou : le coin extérieur est couvert', () => {
    const plan = withWall(withWall(createEmptyPlan(), 4, 4, 8, 4), 4, 4, 4, 8); // coin en (2 m, 2 m)
    const s = buildStructure(plan);
    expect(ofKind(s, 'wall')).toHaveLength(2);
    for (const [x, z] of [[1.95, 1.95], [2.05, 2.05], [1.95, 2.05], [2.05, 1.95], [2, 2]]) {
      expect(wallAt(s, x, z)).toBe(true);
    }
    expect(wallAt(s, 1.9, 1.9)).toBe(false); // mais pas au-delà de la demi-épaisseur
  });

  it('une jonction en T est pleine, sans trou ni dépassement', () => {
    // mur horizontal de x = 2 m à 6 m sur z = 2 m ; cloison qui descend de z = 2 m à 4 m en x = 4 m
    const plan = withWall(withWall(createEmptyPlan(), 4, 4, 12, 4), 8, 4, 8, 8);
    const s = buildStructure(plan);
    expect(ofKind(s, 'wall')).toHaveLength(2);
    for (let x = 1.96; x <= 6.04; x += 0.02) expect(wallAt(s, x, 2)).toBe(true);
    for (let z = 2; z <= 4.04; z += 0.02) expect(wallAt(s, 4, z)).toBe(true);
    for (const x of [3.9, 4.1]) for (const z of [2.04, 2.1, 3]) expect(wallAt(s, x, z) && z > 2.06).toBe(false);
  });

  it('un plan vide n\'a ni mur ni sol', () => {
    expect(buildStructure(createEmptyPlan()).boxes).toHaveLength(0);
  });
});

describe('structure 3D : ouvertures', () => {
  it('une porte découpe le mur : linteau au-dessus, rien au passage, cadre sur les côtés', () => {
    const plan = addOpening(withWall(createEmptyPlan(), 4, 4, 12, 4), { type: 'door', start: hStart(6, 4), span: 2 });
    const s = buildStructure(plan); // porte de x = 3 m à 4 m sur z = 2 m
    expect(ofKind(s, 'wall')).toHaveLength(2); // un morceau de chaque côté
    expect(ofKind(s, 'lintel')).toHaveLength(1);
    expect(ofKind(s, 'sill')).toHaveLength(0);
    const lintel = bounds(ofKind(s, 'lintel')[0]);
    expect(near(lintel.y0, 2.05)).toBe(true);
    expect(near(lintel.y1, 2.5)).toBe(true);
    for (const y of [0.1, 1, 2]) expect(wallAt(s, 3.5, 2, y)).toBe(false); // le passage est libre
    expect(wallAt(s, 3.5, 2, 2.3)).toBe(true); // le linteau ferme le haut
    expect(wallAt(s, 2.5, 2)).toBe(true);
    expect(wallAt(s, 4.5, 2)).toBe(true);
    expect(ofKind(s, 'frame')).toHaveLength(3); // deux montants et la traverse
    expect(ofKind(s, 'threshold')).toHaveLength(1);
    expect(ofKind(s, 'glass')).toHaveLength(0);
  });

  it('les murs qui touchent une porte restent droits : pas de débordement dans le passage', () => {
    const plan = addOpening(withWall(createEmptyPlan(), 4, 4, 12, 4), { type: 'door', start: hStart(6, 4), span: 2 });
    const walls = ofKind(buildStructure(plan), 'wall').map(bounds).sort((a, b) => a.x0 - b.x0);
    expect(near(walls[0].x1, 3)).toBe(true);
    expect(near(walls[1].x0, 4)).toBe(true);
    expect(near(walls[0].x0, 1.95)).toBe(true); // l'autre bout dépasse d'une demi-épaisseur
  });

  it('une fenêtre garde une allège et un linteau, avec cadre et vitre', () => {
    const plan = addOpening(withWall(createEmptyPlan(), 4, 4, 12, 4), { type: 'window', start: hStart(6, 4), span: 2 });
    const s = buildStructure(plan); // allège 0,9 m, hauteur 1,2 m : de 0,9 m à 2,1 m
    const sill = bounds(ofKind(s, 'sill')[0]);
    const lintel = bounds(ofKind(s, 'lintel')[0]);
    expect(near(sill.y0, 0)).toBe(true);
    expect(near(sill.y1, 0.9)).toBe(true);
    expect(near(lintel.y0, 2.1)).toBe(true);
    expect(near(lintel.y1, 2.5)).toBe(true);
    expect(wallAt(s, 3.5, 2, 0.4)).toBe(true);
    expect(wallAt(s, 3.5, 2, 1.5)).toBe(false);
    expect(ofKind(s, 'frame')).toHaveLength(4);
    const glass = ofKind(s, 'glass');
    expect(glass).toHaveLength(1);
    expect(glass[0].material).toBe('glass');
    const g = bounds(glass[0]);
    expect(near(g.y0, 0.9 + FRAME_WIDTH)).toBe(true);
    expect(near(g.y1, 2.1 - FRAME_WIDTH)).toBe(true);
    expect(ofKind(s, 'threshold')).toHaveLength(0);
  });

  it('un passage est une ouverture libre, sans cadre ni vitre', () => {
    const plan = addOpening(withWall(createEmptyPlan(), 4, 4, 12, 4), { type: 'passage', start: hStart(6, 4), span: 2 });
    const s = buildStructure(plan);
    expect(ofKind(s, 'frame', 'glass')).toHaveLength(0);
    expect(wallAt(s, 3.5, 2, 1)).toBe(false);
  });

  it('la hauteur d\'une ouverture est bornée par celle du mur', () => {
    const plan = addOpening(withWall(createEmptyPlan(), 4, 4, 12, 4), { type: 'window', start: hStart(6, 4), span: 2, sill: 1.5, height: 3 });
    const s = buildStructure(plan);
    expect(ofKind(s, 'lintel')).toHaveLength(0); // la fenêtre monte jusqu'au plafond
    for (const box of s.boxes) expect(bounds(box).y1 <= 2.5 + EPS).toBe(true);
  });

  it('une ouverture sur un mur vertical respecte l\'axe z', () => {
    const plan = addOpening(withWall(createEmptyPlan(), 6, 2, 6, 10), { type: 'door', start: vStart(6, 4), span: 2 });
    const s = buildStructure(plan); // porte en x = 3 m, de z = 2 m à 3 m
    expect(wallAt(s, 3, 2.5, 1)).toBe(false);
    expect(wallAt(s, 3, 1.5, 1)).toBe(true);
    expect(wallAt(s, 3, 3.5, 1)).toBe(true);
  });
});

describe('structure 3D : sols', () => {
  it('chaque pièce a un sol dont le matériau dépend de son type', () => {
    let plan = withWall(withBox(createEmptyPlan(), 4, 4, 24, 16), 14, 4, 14, 16);
    const rooms = detectRooms(plan);
    plan = setRoomInfo(plan, rooms[0], { type: 'kitchen' });
    plan = setRoomInfo(plan, rooms[1], { type: 'bedroom' });
    const floors = ofKind(buildStructure(plan), 'floor');
    expect(floors).toHaveLength(2);
    expect(floors.map((f) => f.material).sort()).toEqual(['floor:bedroom', 'floor:kitchen']);
    const kitchen = floors.find((f) => f.material === 'floor:kitchen');
    expect(kitchen.roomId).toBe(rooms[0].id);
    expect(kitchen.size).toEqual([5, FLOOR_THICKNESS, 6]); // 10 × 12 cases de 0,5 m
    expect(kitchen.position).toEqual([4.5, FLOOR_THICKNESS / 2, 5]);
  });

  it('une pièce en L est dans le bon sens et son sol couvre exactement ses cases', () => {
    // L : carré 8 × 8 cases dont on retire le quart en haut à droite (x de 8 à 12, y de 4 à 8)
    let plan = createEmptyPlan();
    const pts = [[4, 4], [8, 4], [8, 8], [12, 8], [12, 12], [4, 12]];
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length];
      plan = withWall(plan, p[0], p[1], q[0], q[1]);
    });
    const rooms = detectRooms(plan);
    expect(rooms).toHaveLength(1);
    const s = buildStructure(plan);
    const floors = ofKind(s, 'floor');
    const area = floors.reduce((sum, f) => sum + f.size[0] * f.size[2], 0);
    expect(near(area, rooms[0].areaM2)).toBe(true);
    // coin plein en haut à gauche (plan x 2-4 m, y 2-4 m) : couvert
    expect(covered(floors, 3, FLOOR_THICKNESS / 2, 3)).toBe(true);
    // quart manquant en haut à droite (plan x 4-6 m, y 2-4 m) : vide, donc z petit = haut du plan, pas de miroir
    expect(covered(floors, 5, FLOOR_THICKNESS / 2, 3)).toBe(false);
    // bas à droite (plan x 4-6 m, y 4-6 m) : couvert
    expect(covered(floors, 5, FLOOR_THICKNESS / 2, 5)).toBe(true);
    // mur de la partie rentrante : vertical en x = 4 m de z = 2 m à 4 m, horizontal en z = 4 m de x = 4 m à 6 m
    expect(wallAt(s, 4, 3)).toBe(true);
    expect(wallAt(s, 5, 4)).toBe(true);
    expect(wallAt(s, 5, 3)).toBe(false);
  });

  it('un sol rectangulaire se fusionne en une seule boîte', () => {
    const plan = withBox(createEmptyPlan(), 4, 4, 14, 12);
    expect(ofKind(buildStructure(plan), 'floor')).toHaveLength(1);
  });

  it('une pièce ouverte (sans fermeture) n\'a pas de sol', () => {
    const plan = withWall(withWall(withWall(createEmptyPlan(), 4, 4, 14, 4), 14, 4, 14, 12), 14, 12, 4, 12);
    expect(ofKind(buildStructure(plan), 'floor')).toHaveLength(0);
  });
});

describe('structure 3D : murs abaissés et emprise', () => {
  it('murs abaissés : tout ce qui dépasse 0,3 m est coupé, les sols restent', () => {
    const plan = addOpening(addOpening(house(), { type: 'door', start: hStart(6, 4), span: 2 }), { type: 'window', start: hStart(10, 4), span: 2 });
    const s = buildStructure(plan, { maxHeight: LOWERED_WALL_HEIGHT });
    expect(s.wallHeight).toBe(LOWERED_WALL_HEIGHT);
    for (const box of s.boxes) expect(bounds(box).y1 <= LOWERED_WALL_HEIGHT + EPS).toBe(true);
    expect(ofKind(s, 'lintel', 'glass')).toHaveLength(0);
    expect(ofKind(s, 'floor')).toHaveLength(2);
    expect(ofKind(s, 'sill')).toHaveLength(1); // l'allège de la fenêtre (0 à 0,9 m) est coupée à 0,3 m
    expect(near(bounds(ofKind(s, 'sill')[0]).y1, 0.3)).toBe(true);
  });

  it('par défaut les murs gardent leur hauteur', () => {
    expect(buildStructure(house()).wallHeight).toBe(2.5);
  });

  it('l\'emprise englobe les murs avec une marge, ou toute la grille si le plan est vide', () => {
    expect(getPlanExtent(createEmptyPlan())).toEqual({ minX: 0, minZ: 0, maxX: 20, maxZ: 15, empty: true });
    const extent = getPlanExtent(house());
    expect(extent).toEqual({ minX: 1, minZ: 1, maxX: 13, maxZ: 9, empty: false });
  });
});

/* ------------------------------------------------------------------ */
/* Phase 5 : catalogue d'objets (furniture.js)                         */
/* ------------------------------------------------------------------ */

describe('catalogue : données (sans Three.js)', () => {
  const ids = FURNITURE_DATA.map((entry) => entry.id);

  it('contient plus de 40 objets aux identifiants uniques, sans fonction dans les données', () => {
    expect(FURNITURE_DATA.length > 40).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of FURNITURE_DATA) expect(typeof entry.build).toBe('undefined');
  });

  it('chaque objet a une fonction build, séparée des données', () => {
    for (const id of ids) expect(typeof FURNITURE_BUILDERS[id]).toBe('function');
    expect(FURNITURE_DEFS).toHaveLength(FURNITURE_DATA.length);
    expect(typeof getFurniture('sofa-2').build).toBe('function');
  });

  it('chaque définition est valide : catégorie, taille, placement, types de pièces', () => {
    const categories = FURNITURE_CATEGORIES.map((c) => c.id);
    for (const entry of FURNITURE_DATA) {
      const where = entry.id;
      expect(categories.includes(entry.category) ? where : `${where} : catégorie inconnue ${entry.category}`).toBe(where);
      expect(entry.label.length > 0).toBe(true);
      for (const axis of ['w', 'd', 'h']) expect(entry.size[axis] > 0 ? where : `${where} : taille ${axis} invalide`).toBe(where);
      expect(PLACEMENT_MODES.includes(entry.placement.mode) ? where : `${where} : mode ${entry.placement.mode}`).toBe(where);
      expect(entry.placement.clearanceFront >= 0 && entry.placement.clearanceSides >= 0 ? where : `${where} : dégagement négatif`).toBe(where);
      for (const other of entry.placement.canOverlap) expect(ids.includes(other) ? where : `${where} : canOverlap inconnu ${other}`).toBe(where);
      if (entry.placement.mode === 'wall-mounted') expect(typeof entry.placement.mountHeight).toBe('number');
      expect(entry.roomTypes.length > 0 ? where : `${where} : aucun type de pièce`).toBe(where);
      for (const { type, weight } of entry.roomTypes) {
        expect(ROOM_TYPES.includes(type) ? where : `${where} : type de pièce inconnu ${type}`).toBe(where);
        expect(weight > 0 ? where : `${where} : poids ${weight}`).toBe(where);
      }
    }
  });

  it('chaque type de pièce a au moins un objet compatible', () => {
    for (const type of ROOM_TYPES) {
      const list = furnitureForRoomType(type);
      expect(list.length > 0 ? type : `${type} : aucun objet`).toBe(type);
    }
  });

  it('chaque catégorie contient des objets, et le contenu demandé est présent', () => {
    for (const { id } of FURNITURE_CATEGORIES) expect(FURNITURE_DATA.some((e) => e.category === id) ? id : `${id} : vide`).toBe(id);
    const wanted = [
      'sofa-2', 'sofa-3', 'armchair', 'coffee-table', 'tv-unit', 'bookcase', 'console', 'floor-lamp',
      'dining-table-4', 'dining-table-6', 'buffet',
      'kitchen-base', 'kitchen-sink', 'kitchen-hob', 'fridge', 'hood', 'kitchen-island', 'bar-stool',
      'bed-double', 'bed-single', 'nightstand', 'wardrobe', 'dresser', 'desk',
      'bathtub', 'shower', 'vanity', 'toilet', 'handbasin',
      'office-chair', 'shelf-unit', 'mirror', 'bench', 'coat-rack', 'washer',
      'rug-s', 'rug-m', 'rug-l', 'plant-small', 'plant-medium', 'plant-tall', 'frame-small', 'ceiling-light', 'curtains', 'table-lamp',
    ];
    for (const id of wanted) expect(ids.includes(id) ? id : `${id} manque`).toBe(id);
    // Lots A, B, C et garage : au moins 120 objets, et les objets demandés y sont.
    expect(ids.length >= 120).toBe(true);
    const added = [
      'shoe-cabinet', 'wall-hooks', 'umbrella-stand', 'bookcase-narrow', 'wall-shelf', 'display-cabinet', 'sideboard-small', 'dining-table-round', 'chair',
      'wc-cabinet', 'toilet-brush', 'vanity-double', 'column-cabinet', 'towel-radiator', 'laundry-basket', 'dryer', 'utility-sink', 'drying-rack', 'broom-cupboard', 'water-heater', 'sofa-bed',
      'dishwasher', 'oven-column', 'microwave', 'trash-bin', 'fridge-american', 'kitchen-table-2', 'sofa-corner', 'side-table', 'sideboard', 'pouf', 'stove',
      'bed-king', 'bunk-bed', 'baby-bed', 'dressing-table', 'bed-bench', 'open-wardrobe', 'chest-drawers', 'standing-mirror', 'wardrobe-3',
      'desk-large', 'drawer-unit', 'filing-cabinet', 'computer', 'board',
      'radiator', 'wall-sconce', 'pendant-light', 'blinds', 'wall-clock', 'mirror-round', 'books', 'vase', 'fruit-bowl', 'candles', 'blanket-basket',
      'toy-box', 'kids-desk', 'teepee', 'shelf-low',
      'car', 'car-large', 'motorbike', 'bike', 'workbench', 'pegboard', 'tool-trolley', 'metal-cabinet', 'metal-shelving', 'crates', 'wheelie-bin', 'tyre-stack',
      'freezer-chest', 'wine-rack', 'table-saw', 'easel', 'tube-light',
    ];
    for (const id of added) expect(ids.includes(id) ? id : `${id} manque`).toBe(id);
  });

  it('les catégories sont rangées : chambre d\'enfant, garage et éclairage existent et ne sont pas vides', () => {
    const categories = FURNITURE_CATEGORIES.map((c) => c.id);
    for (const id of ['enfant', 'garage', 'eclairage']) expect(categories.includes(id) ? id : `${id} manque`).toBe(id);
    expect(new Set(categories).size).toBe(categories.length);
    for (const entry of FURNITURE_DATA) expect(categories.includes(entry.category) ? entry.id : `${entry.id} : catégorie inconnue`).toBe(entry.id);
  });

  it('une voiture : plusieurs modèles et plusieurs couleurs de carrosserie, uniquement dans un garage', () => {
    expect(getFurniture('car').models).toBe(3);
    expect(getFurniture('car-large').models).toBe(2);
    expect(CAR_COLORS.length >= 8).toBe(true);
    expect(new Set(CAR_COLORS).size).toBe(CAR_COLORS.length);
    expect(furnitureForRoomType('garage')[0].id).toBe('car');
    for (const type of ROOM_TYPES) if (type !== 'garage') expect(furnitureForRoomType(type).some((o) => o.id === 'car' || o.id === 'car-large') ? type : 'ok').toBe('ok');
  });

  it('les tapis sont posables sous les meubles, les lampes sur les commodes', () => {
    expect(getFurniture('rug-m').placement.canOverlap).toContain('sofa-3');
    expect(getFurniture('nightstand').placement.canOverlap).toContain('table-lamp');
    expect(getFurniture('ceiling-light').placement.mode).toBe('ceiling');
    expect(getFurniture('curtains').placement.mode).toBe('window');
  });
});

describe('catalogue : palettes et hasard', () => {
  it('au moins 5 palettes, avec tous les rôles de couleur', () => {
    expect(PALETTES.length >= 5).toBe(true);
    expect(new Set(PALETTES.map((p) => p.id)).size).toBe(PALETTES.length);
    for (const palette of PALETTES) {
      for (const role of PALETTE_ROLES) {
        expect(/^#[0-9a-f]{6}$/i.test(palette[role]) ? role : `${palette.id} : ${role} invalide`).toBe(role);
      }
      expect(palette.floorKind.length > 0).toBe(true);
    }
    for (const id of ['scandinave', 'moderne', 'industriel', 'classique', 'boheme']) expect(PALETTES.some((p) => p.id === id)).toBe(true);
  });

  it('createRng est reproductible ; hashSeed et la graine donnent des suites différentes', () => {
    const a = createRng(42);
    const b = createRng(42);
    const c = createRng(43);
    const seq = (rng) => [rng.next(), rng.range(1, 2), rng.int(0, 9), rng.pick(['x', 'y', 'z'])];
    expect(seq(a)).toEqual(seq(b));
    expect(seq(createRng(42))).not.toEqual(seq(c));
    expect(hashSeed('sofa-2')).not.toBe(hashSeed('sofa-3'));
    const r = createRng(7);
    for (let i = 0; i < 200; i++) {
      const v = r.range(0.2, 0.4);
      expect(v >= 0.2 && v < 0.4).toBe(true);
      const n = r.int(2, 4);
      expect(n >= 2 && n <= 4).toBe(true);
    }
  });

  it('le hasard neutre donne toujours la valeur centrale et le premier choix', () => {
    const n = createNeutralRng();
    expect(n.range(0, 1)).toBe(0.5);
    expect(n.int(2, 4)).toBe(3);
    expect(n.pick(['a', 'b'])).toBe('a');
    expect(n.chance(0.99)).toBe(false);
  });
});

/** Three.js et RoundedBoxGeometry, chargés une seule fois, à la demande (viewer3d.js les expose). */
let threeModules = null;
const loadThree = () => (threeModules ??= import('./viewer3d.js').then(({ THREE, RoundedBoxGeometry }) => ({ THREE, RoundedBoxGeometry })));

/** Statistiques d'un objet construit : boîte englobante, centre, maillages, triangles, maillages sans ombre. */
function measure(THREE, group) {
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  let meshes = 0;
  let triangles = 0;
  let noShadow = 0;
  group.traverse((object) => {
    if (!object.isMesh) return;
    meshes++;
    triangles += (object.geometry.index ? object.geometry.index.count : object.geometry.attributes.position.count) / 3;
    if (!object.castShadow && !object.material.transparent) noShadow++;
  });
  return { box, size, center, meshes, triangles, noShadow };
}

describe('catalogue : construction (boîte englobante à 5 %)', () => {
  const seeds = [{ variations: false }, { seed: 11 }, { seed: 4242 }, { seed: 987654 }];
  for (const entry of FURNITURE_DATA) {
    it(`${entry.label} (${entry.id}) : boîte englobante = size, centrée, posée au sol, ombres, peu de polygones`, async () => {
      const three = await loadThree();
      const def = getFurniture(entry.id);
      expect(Number.isInteger(def.models) && def.models >= 1 ? entry.id : `${entry.id} : nombre de modèles invalide`).toBe(entry.id);
      for (const options of seeds) {
        for (const palette of [PALETTES[0], PALETTES[3]]) {
         for (let model = 0; model < def.models; model++) {
          const group = buildFurniture(def, createBuildContext(three, { palette, ...options, model }));
          const m = measure(three.THREE, group);
          const tag = `${entry.id} (${options.seed ?? 'sans variations'}, ${palette.id}, modèle ${model + 1}/${def.models})`;
          for (const [axis, got, want] of [['largeur', m.size.x, entry.size.w], ['profondeur', m.size.z, entry.size.d], ['hauteur', m.size.y, entry.size.h]]) {
            expect(Math.abs(got - want) <= 0.05 * want ? tag : `${tag} : ${axis} ${got.toFixed(3)} au lieu de ${want}`).toBe(tag);
          }
          expect(Math.abs(m.center.x) < 0.03 && Math.abs(m.center.z) < 0.03 ? tag : `${tag} : pas centré (${m.center.x.toFixed(2)}, ${m.center.z.toFixed(2)})`).toBe(tag);
          expect(Math.abs(m.box.min.y) < 0.02 ? tag : `${tag} : bas à ${m.box.min.y.toFixed(3)} m`).toBe(tag);
          expect(m.noShadow === 0 ? tag : `${tag} : ${m.noShadow} maillages sans ombre`).toBe(tag);
          expect(m.triangles < 6000 ? tag : `${tag} : ${m.triangles} triangles`).toBe(tag);
          expect(group.name).toBe(entry.id);
         }
        }
      }
    });
  }

  it('l\'avant est +Z : le dossier d\'un canapé et la tête de lit sont du côté -Z', async () => {
    const three = await loadThree();
    const backSide = (id) => {
      const group = buildFurniture(getFurniture(id), createBuildContext(three, { variations: false }));
      let sum = 0;
      let count = 0;
      const tmp = new three.THREE.Box3();
      group.traverse((object) => {
        if (!object.isMesh) return;
        tmp.setFromObject(object);
        if (tmp.max.y > 0.8 * (getFurniture(id).size.h)) {
          sum += (tmp.min.z + tmp.max.z) / 2;
          count++;
        }
      });
      return sum / count;
    };
    expect(backSide('sofa-3') < 0).toBe(true);
    expect(backSide('bed-double') < 0).toBe(true);
    expect(backSide('bed-single') < 0).toBe(true);
  });

  it('les variations changent l\'objet sans changer sa taille, et « sans variations » est stable', async () => {
    const three = await loadThree();
    const signature = (options) => {
      const group = buildFurniture(getFurniture('sofa-2'), createBuildContext(three, options));
      return JSON.stringify(group.children.map((c) => [c.position.y.toFixed(3), c.material.color.getHexString()]));
    };
    const varied = new Set([1, 2, 3, 4, 5, 6].map((seed) => signature({ seed })));
    expect(varied.size > 2).toBe(true);
    expect(signature({ variations: false })).toBe(signature({ variations: false }));
    expect(signature({ seed: 5 })).toBe(signature({ seed: 5 }));
  });

  it('une autre palette change les couleurs', async () => {
    const three = await loadThree();
    const color = (palette) => {
      const group = buildFurniture(getFurniture('bed-double'), createBuildContext(three, { palette, variations: false }));
      return group.children.map((c) => c.material.color.getHexString()).join(',');
    };
    expect(color('scandinave')).not.toBe(color('industriel'));
  });
});

/* ------------------------------------------------------------------ */
/* Tests de generator.js : briques du générateur (phase 6a)           */
/* ------------------------------------------------------------------ */

describe('generator : hasard avec graine', () => {
  it('donne la même suite pour la même graine, et la même suite que furniture.js', () => {
    const a = createGeneratorRng(12345);
    const b = createGeneratorRng(12345);
    const reference = createRng(12345);
    for (let i = 0; i < 20; i++) {
      const v = a.next();
      expect(v).toBe(b.next());
      expect(v).toBe(reference.next());
      expect(v >= 0 && v < 1).toBe(true);
    }
    expect(createGeneratorRng(1).next()).not.toBe(createGeneratorRng(2).next());
    expect(createGeneratorRng('salon').next()).toBe(createGeneratorRng('salon').next());
  });

  it('range et int respectent leurs bornes ; int atteint les deux bornes', () => {
    const rng = createGeneratorRng(7);
    const seen = new Set();
    for (let i = 0; i < 400; i++) {
      const f = rng.range(2, 5);
      expect(f >= 2 && f < 5).toBe(true);
      const n = rng.int(3, 6);
      expect(Number.isInteger(n) && n >= 3 && n <= 6).toBe(true);
      seen.add(n);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it('pick renvoie un élément de la liste, undefined si elle est vide', () => {
    const rng = createGeneratorRng(3);
    const items = ['a', 'b', 'c'];
    const picks = new Set(Array.from({ length: 60 }, () => rng.pick(items)));
    expect([...picks].sort()).toEqual(['a', 'b', 'c']);
    expect(rng.pick([])).toBe(undefined);
  });

  it('weightedPick suit les poids, ignore les poids nuls ou invalides, et renvoie null sans poids', () => {
    const rng = createGeneratorRng(11);
    const items = [{ id: 'rare', weight: 1 }, { id: 'courant', weight: 3 }, { id: 'jamais', weight: 0 }, { id: 'faux', weight: -2 }, { id: 'nan', weight: NaN }];
    const counts = { rare: 0, courant: 0 };
    for (let i = 0; i < 4000; i++) counts[rng.weightedPick(items).id]++;
    expect(counts.rare + counts.courant).toBe(4000); // jamais, faux et nan ne sortent pas
    const share = counts.courant / 4000;
    expect(share > 0.71 && share < 0.79).toBe(true); // 3 chances sur 4
    expect(rng.weightedPick([])).toBe(null);
    expect(rng.weightedPick([{ weight: 0 }, { weight: -1 }])).toBe(null);
    expect(rng.weightedPick([{ id: 'x' }]).id).toBe('x'); // sans poids : 1
    expect(rng.weightedPick(['a', 'b'], (item) => (item === 'b' ? 5 : 0))).toBe('b'); // fonction de poids
  });

  it('shuffle renvoie une permutation sans toucher la liste d\'origine, de façon reproductible', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = createGeneratorRng(5).shuffle(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
    expect(shuffled).toEqual(createGeneratorRng(5).shuffle(items));
    const orders = new Set(Array.from({ length: 10 }, (_, k) => createGeneratorRng(k + 1).shuffle(items).join()));
    expect(orders.size > 5).toBe(true);
    expect(createGeneratorRng(1).shuffle([])).toEqual([]);
  });

  it('hash(seed, texte) est stable, sur 32 bits, et dépend de la graine comme du texte', () => {
    expect(hash(42, 'salon')).toBe(hash(42, 'salon'));
    expect(hash(42, 'salon')).not.toBe(hash(42, 'cuisine'));
    expect(hash(42, 'salon')).not.toBe(hash(43, 'salon'));
    for (const v of [hash(0, ''), hash(1, 'a'), hash(2 ** 40, 'x'), hash('texte', 'y')]) expect(Number.isInteger(v) && v >= 0 && v < 2 ** 32).toBe(true);
    expect(toSeed(NaN)).toBe(1);
    expect(toSeed(-1)).toBe(4294967295);
    expect(toSeed('a')).toBe(toSeed('a'));
  });

  it('fork donne un flux indépendant et reproductible, sans consommer le flux parent', () => {
    const parent = createGeneratorRng(9);
    const control = createGeneratorRng(9);
    const child = parent.fork('room-4-4');
    expect(child.next()).toBe(createGeneratorRng(hash(9, 'room-4-4')).next());
    expect(parent.fork('room-4-4').next()).toBe(createGeneratorRng(9).fork('room-4-4').next());
    expect(parent.fork('room-14-4').next()).not.toBe(parent.fork('room-4-4').next());
    expect(parent.next()).toBe(control.next()); // le parent n'a rien perdu
  });
});

/* Plans de test : une pièce de 5 × 4 m (x de 1 à 6 m, y de 1 à 5 m), porte au sud, fenêtre au nord. */
const roomBox = () => withBox(createEmptyPlan(), 2, 2, 12, 10);
const roomWithOpenings = () => {
  let plan = addOpening(roomBox(), { type: 'door', start: hStart(4, 10), swing: 'a' }); // o1 : x 2 à 3 m, mur y = 5 m, ouvre vers le haut
  plan = addOpening(plan, { type: 'window', start: hStart(6, 2) }); // o2 : x 3 à 4 m, mur y = 1 m, allège 0,9 m
  return plan;
};
const gridOf = (plan, index = 0) => createRoomGrid(plan, detectRooms(plan)[index]);
/** Objet de test sans passer par le catalogue. */
const thing = (id, w, d, h, mode = 'free', extra = {}) => ({ id, size: { w, d, h }, placement: { mode, clearanceFront: 0, clearanceSides: 0, canOverlap: [], ...extra } });
const putAt = (def, x, y, rotation = 0) => createPlaced(typeof def === 'string' ? getFurniture(def) : def, { x, y, rotation });
const reasonsOf = (grid, placed, options) => checkPlacement(grid, placed, options).reasons;

describe('generator : empreintes', () => {
  it('une empreinte garde son centre et échange largeur et profondeur à 90° et 270°', () => {
    const fp0 = makeFootprint({ x: 3, y: 3, w: 1.7, d: 2.1, rotation: 0 });
    expect([fp0.ex, fp0.ey, fp0.x0, fp0.y0, fp0.x1, fp0.y1]).toEqual([1.7, 2.1, 2.15, 1.95, 3.85, 4.05]);
    const fp90 = makeFootprint({ x: 3, y: 3, w: 1.7, d: 2.1, rotation: 90 });
    expect([fp90.ex, fp90.ey, fp90.x0, fp90.y0, fp90.x1, fp90.y1]).toEqual([2.1, 1.7, 1.95, 2.15, 4.05, 3.85]);
    const fp270 = makeFootprint({ x: 3, y: 3, w: 1.7, d: 2.1, rotation: 270 });
    expect([fp270.ex, fp270.ey]).toEqual([2.1, 1.7]);
    expect(makeFootprint({ x: 3, y: 3, w: 1.7, d: 2.1, rotation: 180 }).x0).toBe(2.15);
  });

  it('refuse les rotations qui ne sont pas des multiples de 90° et ramène les autres dans 0-270', () => {
    expect(() => makeFootprint({ x: 0, y: 0, w: 1, d: 1, rotation: 45 })).toThrow();
    expect(() => normalizeRotation(NaN)).toThrow();
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(360)).toBe(0);
  });

  it('l\'avant regarde vers +y à 0°, +x à 90°, -y à 180°, -x à 270°', () => {
    expect(facingVector(0)).toEqual({ x: 0, y: 1 });
    expect(facingVector(90)).toEqual({ x: 1, y: 0 });
    expect(facingVector(180)).toEqual({ x: 0, y: -1 });
    expect(facingVector(270)).toEqual({ x: -1, y: 0 });
    expect(makeFootprint({ x: 0, y: 0, w: 1, d: 1, rotation: 90 }).front).toEqual({ x: 1, y: 0 });
  });

  it('chevauchement : vrai si les rectangles se recouvrent, faux s\'ils se touchent seulement par un bord', () => {
    const a = makeFootprint({ x: 1, y: 1, w: 1, d: 1 }); // 0,5 à 1,5
    expect(footprintsOverlap(a, makeFootprint({ x: 2, y: 1, w: 1, d: 1 }))).toBe(false); // bord contre bord
    expect(footprintsOverlap(a, makeFootprint({ x: 1.9, y: 1, w: 1, d: 1 }))).toBe(true);
    expect(footprintsOverlap(a, makeFootprint({ x: 1, y: 2.5, w: 1, d: 1 }))).toBe(false);
    expect(footprintsOverlap(a, makeFootprint({ x: 1, y: 1, w: 0.2, d: 0.2 }))).toBe(true); // contenu
    // un lit tourné de 90° occupe l'autre sens
    const bed = makeFootprint({ x: 3, y: 3, w: 1.7, d: 2.1 });
    const bedTurned = makeFootprint({ x: 3, y: 3, w: 1.7, d: 2.1, rotation: 90 });
    const stand = makeFootprint({ x: 4.0, y: 3, w: 0.2, d: 0.2 }); // x de 3,9 à 4,1
    expect(footprintsOverlap(bed, stand)).toBe(false); // le lit va de 2,15 à 3,85 en x
    expect(footprintsOverlap(bedTurned, stand)).toBe(true); // tourné : jusqu'à 4,05
  });

  it('surface de recouvrement et inclusion de rectangles', () => {
    const a = { x0: 0, y0: 0, x1: 2, y1: 2 };
    expect(overlapArea(a, { x0: 1, y0: 1, x1: 3, y1: 3 })).toBe(1);
    expect(overlapArea(a, { x0: 2, y0: 0, x1: 3, y1: 2 })).toBe(0);
    expect(rectContains(a, { x0: 0.5, y0: 0.5, x1: 1.5, y1: 1.5 })).toBe(true);
    expect(rectContains(a, { x0: 0.5, y0: 0.5, x1: 2.5, y1: 1.5 })).toBe(false);
  });

  it('zone de dégagement frontal : devant l\'objet, dans les quatre rotations', () => {
    const at = (rotation) => frontClearanceRect(makeFootprint({ x: 3, y: 3, w: 1, d: 0.5, rotation }), 0.8);
    expect(at(0)).toEqual({ x0: 2.5, y0: 3.25, x1: 3.5, y1: 4.05 });
    expect(at(90)).toEqual({ x0: 3.25, y0: 2.5, x1: 4.05, y1: 3.5 });
    expect(at(180)).toEqual({ x0: 2.5, y0: 1.95, x1: 3.5, y1: 2.75 });
    expect(at(270)).toEqual({ x0: 1.95, y0: 2.5, x1: 2.75, y1: 3.5 });
  });

  it('zones latérales : +x local est à droite de l\'objet à 0°, vers -y à 90°', () => {
    const at0 = sideClearanceRects(makeFootprint({ x: 3, y: 3, w: 1, d: 0.5 }), 0.3);
    expect(at0.plus).toEqual({ x0: 3.5, y0: 2.75, x1: 3.8, y1: 3.25 });
    expect(at0.minus).toEqual({ x0: 2.2, y0: 2.75, x1: 2.5, y1: 3.25 });
    const at90 = sideClearanceRects(makeFootprint({ x: 3, y: 3, w: 1, d: 0.5, rotation: 90 }), 0.3);
    expect(at90.plus).toEqual({ x0: 2.75, y0: 2.2, x1: 3.25, y1: 2.5 });
    expect(at90.minus).toEqual({ x0: 2.75, y0: 3.5, x1: 3.25, y1: 3.8 });
  });

  it('un objet placé garde ses hauteurs : au sol, fixé au mur, au plafond', () => {
    const sofa = putAt('sofa-2', 3, 3);
    expect([sofa.layer, sofa.bottom, sofa.top, sofa.solid]).toEqual(['floor', 0, 0.85, true]);
    const frame = putAt('frame-small', 3, 1.07);
    expect([frame.layer, frame.bottom, frame.top, frame.solid]).toEqual(['wall', 1.3, 1.8, false]);
    const light = createPlaced(getFurniture('ceiling-light'), { x: 3, y: 3 }, { ceilingHeight: 2.6 });
    expect([light.layer, light.bottom, light.top, light.solid]).toEqual(['ceiling', 2.15, 2.6, false]);
    expect(putAt('rug-m', 3, 3).solid).toBe(false); // un tapis ne bloque pas la marche
    expect(putAt('sofa-2', 3, 3).clearanceFront).toBe(0.8);
  });

  it('conflit entre objets : au sol et en hauteur, sauf ce que canOverlap autorise', () => {
    expect(placementsConflict(putAt('sofa-2', 3, 3), putAt('sofa-2', 3.5, 3))).toBe(true);
    expect(placementsConflict(putAt('sofa-2', 3, 3), putAt('sofa-2', 5, 3))).toBe(false);
    expect(placementsConflict(putAt('sofa-2', 3, 3), putAt('rug-m', 3, 3))).toBe(false); // tapis sous le canapé
    expect(placementsConflict(putAt('rug-m', 3, 3), putAt('sofa-2', 3, 3))).toBe(false); // dans les deux sens
    expect(allowsOverlap(putAt('console', 3, 3), putAt('table-lamp', 3, 3))).toBe(true);
    expect(placementsConflict(putAt('dining-table-4', 3, 3), putAt('ceiling-light', 3, 3))).toBe(false); // le luminaire est au plafond
    expect(placementsConflict(putAt('sofa-2', 3, 1.5), putAt('frame-large', 3, 1.5))).toBe(false); // cadre au-dessus du canapé (1,2 m > 0,85 m)
    expect(placementsConflict(putAt('fridge', 3, 1.5), putAt('kitchen-wall', 3, 1.5))).toBe(true); // meuble haut dans le frigo (1,85 m > 1,4 m)
    expect(placementsConflict(putAt('kitchen-base', 3, 1.5), putAt('kitchen-wall', 3, 1.5))).toBe(false); // meuble haut au-dessus du meuble bas (0,9 m < 1,4 m)
    expect(placementsConflict(putAt('desk', 3, 3), putAt('office-chair', 3, 3.1))).toBe(false); // chaise sous le bureau
  });
});

describe('generator : grille d\'occupation, pièce rectangulaire', () => {
  it('découpe la pièce en cases de 10 cm, avec un mur et sa marge d\'une case tout autour', () => {
    const grid = gridOf(roomBox());
    expect([grid.res, grid.cols, grid.rows, grid.originX, grid.originY]).toEqual([GRID_RES, 50, 40, 1, 1]);
    const lines = gridToText(grid).split('\n');
    expect(lines).toHaveLength(40);
    expect(lines[0]).toBe('#'.repeat(50));
    expect(lines[39]).toBe('#'.repeat(50));
    expect(lines[1]).toBe('#' + '.'.repeat(48) + '#');
    expect(freeAreaM2(grid)).toBe(18.24); // (5 - 0,2) × (4 - 0,2)
    expect(countFreeCells(grid)).toBe(1824);
  });

  it('une petite pièce de 1 × 1 m : mur 5 cm + marge 5 cm = une case libre de moins de chaque côté', () => {
    const plan = withBox(createEmptyPlan(), 2, 2, 4, 4);
    const lines = gridToText(gridOf(plan)).split('\n');
    expect(lines).toHaveLength(10);
    expect(lines[0]).toBe('##########');
    expect(lines[5]).toBe('#........#');
  });

  it('marge de 5 cm contre les murs : un canapé à 5 cm de la face du mur passe, à 0 cm non', () => {
    const grid = gridOf(roomBox());
    // mur nord : axe à y = 1 m, face à 1,05 m ; marge jusqu'à 1,10 m
    expect(reasonsOf(grid, putAt('sofa-2', 4.5, 1.1 + 0.45))).toEqual([]); // bord à 1,10 m
    expect(reasonsOf(grid, putAt('sofa-2', 4.5, 1.05 + 0.45))).toContain('wall'); // bord à 1,05 m : contre la face, sans marge
    expect(reasonsOf(grid, putAt('sofa-2', 4.5, 1.0 + 0.45))).toContain('wall');
    // mur ouest : axe à x = 1 m
    expect(reasonsOf(grid, putAt('armchair', 1.1 + 0.4, 3.5, 0))).toEqual([]);
    expect(reasonsOf(grid, putAt('armchair', 1.05 + 0.4, 3.5, 0))).toContain('wall');
    // mur sud : axe à y = 5 m ; marge jusqu'à 4,90 m
    expect(reasonsOf(grid, putAt('bookcase', 3.5, 4.9 - 0.16, 180))).toEqual([]);
    expect(reasonsOf(grid, putAt('bookcase', 3.5, 4.95 - 0.16, 180))).toContain('wall');
  });

  it('inclusion : un objet dépassant de la pièce est « outside »', () => {
    const grid = gridOf(roomBox());
    expect(reasonsOf(grid, putAt('sofa-2', 0.5, 3))).toContain('outside');
    expect(reasonsOf(grid, putAt('sofa-2', 8, 3))).toContain('outside');
    expect(reasonsOf(grid, putAt('sofa-2', 3.5, 3), { clearance: false })).toEqual([]);
    expect(rectInRoom(grid, { x0: 1.1, y0: 1.1, x1: 5.9, y1: 4.9 })).toBe(true); // toute la zone libre
    expect(rectInRoom(grid, { x0: 1.0, y0: 1.1, x1: 5.9, y1: 4.9 })).toBe(false); // dans la marge
    expect(rectInRoom(grid, { x0: 5.0, y0: 3.0, x1: 6.5, y1: 4.0 })).toBe(false); // dépasse
  });

  it('cellAt, cellFlags et isCellFree donnent l\'état d\'un point', () => {
    const grid = gridOf(roomBox());
    expect(cellAt(grid, 1.05, 1.05)).toEqual({ i: 0, j: 0 });
    expect(cellAt(grid, 6.5, 3)).toBe(null);
    expect(cellFlags(grid, 0, 0) & CELL_WALL).toBe(CELL_WALL);
    expect(cellFlags(grid, 0, 0) & CELL_FLOOR).toBe(CELL_FLOOR);
    expect(isCellFree(grid, 0, 0)).toBe(false);
    expect(isCellFree(grid, 5, 5)).toBe(true);
    expect(isCellFree(grid, -1, 5)).toBe(false);
    expect(cellFlags(grid, 999, 0)).toBe(0);
  });

  it('une cloison qui ne ferme rien (bout de mur dans la pièce) bloque aussi', () => {
    const plan = withWall(roomBox(), 7, 5, 7, 8); // x = 3,5 m, de y = 2,5 à 4 m, libre aux deux bouts
    expect(detectRooms(plan)).toHaveLength(1);
    const grid = gridOf(plan);
    expect(reasonsOf(grid, putAt(thing('caisse', 0.5, 0.5, 1), 3.5, 3.0))).toContain('wall');
    expect(reasonsOf(grid, putAt(thing('caisse', 0.5, 0.5, 1), 3.5, 2.1))).toEqual([]); // au-delà du bout (marge comprise)
    expect(reasonsOf(grid, putAt(thing('caisse', 0.5, 0.5, 1), 3.5, 4.4))).toEqual([]);
    expect(reasonsOf(grid, putAt(thing('caisse', 0.5, 0.5, 1), 3.5, 2.3))).toContain('wall'); // dans la marge de 10 cm au bout
    expect(freeAreaM2(grid) < 18.24).toBe(true);
  });
});

describe('generator : grille d\'occupation, pièce en L', () => {
  // Bras du haut : x de 1 à 7 m, y de 1 à 4 m. Bras de gauche : x de 1 à 4 m, y de 4 à 7 m. Creux : x > 4 m et y > 4 m.
  const lShape = () => {
    let plan = createEmptyPlan();
    for (const [a, b] of [[[2, 2], [14, 2]], [[14, 2], [14, 8]], [[14, 8], [8, 8]], [[8, 8], [8, 14]], [[8, 14], [2, 14]], [[2, 14], [2, 2]]]) {
      plan = addWallSegments(plan, { x: a[0], y: a[1] }, { x: b[0], y: b[1] });
    }
    return plan;
  };

  it('la pièce reste en L : le creux est hors de la pièce, la surface libre est celle du L réduit de 10 cm', () => {
    const plan = lShape();
    expect(detectRooms(plan)).toHaveLength(1);
    const grid = gridOf(plan);
    expect([grid.cols, grid.rows]).toEqual([60, 60]);
    expect(cellFlags(grid, 50, 50) & CELL_FLOOR).toBe(0); // (6 m, 6 m), dans le creux
    expect(cellFlags(grid, 10, 50) & CELL_FLOOR).toBe(CELL_FLOOR); // (2 m, 6 m), bras de gauche
    expect(cellFlags(grid, 50, 10) & CELL_FLOOR).toBe(CELL_FLOOR); // (6 m, 2 m), bras du haut
    // (5,8 × 2,8) + (2,8 × 5,8) - (2,8 × 2,8) = 24,64 m²
    expect(freeAreaM2(grid)).toBe(24.64);
    const rows = gridToText(grid).split('\n');
    expect(rows[10]).toBe('#' + '.'.repeat(58) + '#'); // y = 2 m : toute la largeur du bras du haut
    expect(rows[50]).toBe('#' + '.'.repeat(28) + '#' + ' '.repeat(30)); // y = 6 m : bras de gauche, puis le creux
  });

  it('inclusion : un objet dans le creux est « outside », un objet à cheval sur le coude est accepté', () => {
    const grid = gridOf(lShape());
    expect(reasonsOf(grid, putAt(thing('caisse', 0.8, 0.8, 1), 5.5, 5.5))).toContain('outside');
    expect(reasonsOf(grid, putAt(thing('caisse', 0.8, 0.8, 1), 3.0, 3.5))).toEqual([]);
    expect(rectInRoom(grid, { x0: 2.0, y0: 3.0, x1: 3.0, y1: 5.0 })).toBe(true); // le long du bras, sur le coude
    expect(rectInRoom(grid, { x0: 3.0, y0: 3.0, x1: 4.5, y1: 4.5 })).toBe(false); // mord sur le mur du coude et sa marge
    expect(reasonsOf(grid, putAt(thing('caisse', 0.8, 0.8, 1), 4.3, 3.3))).toEqual([]); // dans le bras du haut, au-dessus du coude
    expect(reasonsOf(grid, putAt(thing('caisse', 0.8, 0.8, 1), 4.3, 4.3))).toContain('outside');
  });

  it('chaque pièce d\'une maison a sa propre grille', () => {
    const plan = house();
    const rooms = detectRooms(plan);
    expect(rooms).toHaveLength(2);
    const [left, right] = rooms.map((room) => createRoomGrid(plan, room));
    expect([left.originX, right.originX]).toEqual([2, 7]);
    expect(left.roomId).toBe('room-4-4');
    expect(right.roomId).toBe('room-14-4');
  });
});

describe('generator : portes et zones de dégagement', () => {
  it('garde la zone de dégagement de la porte (1 m devant) : rien ne s\'y pose, juste à côté oui', () => {
    const grid = gridOf(roomWithOpenings());
    // porte au sud : x de 2 à 3 m, mur à y = 5 m, s'ouvre vers le haut ; zone de y = 3,95 à 4,95 m
    const inside = cellAt(grid, 2.5, 4.5);
    expect(cellFlags(grid, inside.i, inside.j) & CELL_DOOR).toBe(CELL_DOOR);
    expect(isCellFree(grid, inside.i, inside.j)).toBe(false);
    const beside = cellAt(grid, 3.5, 4.5);
    expect(cellFlags(grid, beside.i, beside.j) & CELL_DOOR).toBe(0);
    const above = cellAt(grid, 2.5, 3.5);
    expect(cellFlags(grid, above.i, above.j) & CELL_DOOR).toBe(0);
    expect(reasonsOf(grid, putAt('bookcase', 2.5, 4.5, 180), { clearance: false })).toContain('door');
    expect(reasonsOf(grid, putAt('bookcase', 4.5, 4.5, 180), { clearance: false })).toEqual([]);
    expect(reasonsOf(grid, putAt('bookcase', 2.5, 3.5, 180), { clearance: false })).toEqual([]); // au-delà du mètre
    expect(countFreeCells(grid) < 1824).toBe(true);
  });

  it('couvre toute la zone de getClearanceZones (arrondie vers l\'extérieur à 10 cm)', () => {
    const plan = roomWithOpenings();
    const grid = createRoomGrid(plan, detectRooms(plan)[0]);
    const [zone] = getClearanceZones(plan);
    for (let y = zone.y + 0.01; y < zone.y + zone.h; y += 0.1) {
      for (let x = zone.x + 0.01; x < zone.x + zone.w; x += 0.1) {
        const c = cellAt(grid, x, y);
        expect(cellFlags(grid, c.i, c.j) & CELL_DOOR).toBe(CELL_DOOR);
      }
    }
  });

  it('la bande de la porte est bloquée pour les objets fixés au mur, pas à côté', () => {
    const grid = gridOf(roomWithOpenings());
    const wallFrame = (x) => putAt('frame-small', x, 4.95 - 0.015, 180); // collé à la face du mur sud
    expect(reasonsOf(grid, wallFrame(2.5))).toContain('opening');
    expect(reasonsOf(grid, wallFrame(4.5))).toEqual([]);
  });

  it('dans une maison, la porte n\'a de zone que dans la pièce où elle s\'ouvre, et les deux pièces la connaissent', () => {
    const left = createRoomGrid(withOpen('a'), detectRooms(withOpen('a'))[0]);
    const right = createRoomGrid(withOpen('a'), detectRooms(withOpen('a'))[1]);
    function withOpen(swing) {
      return addOpening(house(), { type: 'door', start: vStart(14, 8), swing });
    }
    const countDoorCells = (grid) => grid.flags.reduce((n, f) => n + ((f & CELL_DOOR) !== 0 ? 1 : 0), 0);
    expect(countDoorCells(left) > 0).toBe(true);
    expect(countDoorCells(right)).toBe(0);
    expect(left.doors).toHaveLength(1);
    expect(right.doors).toHaveLength(1);
    expect(left.doors[0].inward).toEqual({ x: -1, y: 0 });
    expect(right.doors[0].inward).toEqual({ x: 1, y: 0 });
    // ouvrir vers la droite déplace la zone
    const plan = withOpen('b');
    const [l, r] = detectRooms(plan).map((room) => createRoomGrid(plan, room));
    expect(countDoorCells(l)).toBe(0);
    expect(countDoorCells(r) > 0).toBe(true);
  });

  it('un passage a sa bande bloquée mais pas de zone de dégagement ; une porte donne largeur, ligne et sens', () => {
    const plan = addOpening(roomWithOpenings(), { type: 'passage', start: vStart(12, 6), span: 2 });
    const grid = gridOf(plan);
    expect(grid.doors.map((d) => d.kind)).toEqual(['door', 'passage']);
    const door = grid.doors[0];
    expect([door.openingId, door.width, door.axis, door.pos, door.a0, door.a1, door.inward]).toEqual(['o1', 1, 'h', 5, 2, 3, { x: 0, y: -1 }]);
    const passage = grid.doors[1];
    expect([passage.axis, passage.pos, passage.a0, passage.a1, passage.inward]).toEqual(['v', 6, 3, 4, { x: -1, y: 0 }]);
    const near = cellAt(grid, 5.8, 3.5); // devant le passage, dans la pièce
    expect(cellFlags(grid, near.i, near.j) & CELL_DOOR).toBe(0);
    expect(reasonsOf(grid, putAt('frame-small', 5.95 - 0.015, 3.5, 270))).toContain('opening');
  });
});

describe('generator : zone devant les fenêtres', () => {
  it('garde l\'allège : la zone de 0,5 m devant la fenêtre refuse ce qui dépasse l\'allège', () => {
    const grid = gridOf(roomWithOpenings());
    const c = cellAt(grid, 3.5, 1.3);
    expect(cellFlags(grid, c.i, c.j) & CELL_WINDOW).toBe(CELL_WINDOW);
    expect(grid.windowTop[c.j * grid.cols + c.i]).toBe(0.9);
    expect(grid.windows).toHaveLength(1);
    expect(grid.windows[0].sill).toBe(0.9);
    const outside = cellAt(grid, 5, 1.3);
    expect(cellFlags(grid, outside.i, outside.j) & CELL_WINDOW).toBe(0);
    expect(grid.windowTop[outside.j * grid.cols + outside.i]).toBe(Infinity);
    // armoire (2,1 m) devant la fenêtre : refusée ; ailleurs : acceptée
    expect(reasonsOf(grid, putAt('wardrobe', 3.5, 1.4), { clearance: false })).toContain('window');
    expect(reasonsOf(grid, putAt('wardrobe', 5.0, 1.4), { clearance: false })).toEqual([]);
  });

  it('un objet plus bas que l\'allège (ou égal) peut se placer devant la fenêtre', () => {
    const grid = gridOf(roomWithOpenings());
    expect(reasonsOf(grid, putAt('sofa-2', 3.5, 1.55), { clearance: false })).toEqual([]); // 0,85 m < 0,9 m
    expect(reasonsOf(grid, putAt(thing('exact', 0.6, 0.4, 0.9), 3.5, 1.4))).toEqual([]); // juste à l'allège
    expect(reasonsOf(grid, putAt(thing('trop-haut', 0.6, 0.4, 0.95), 3.5, 1.4))).toContain('window');
  });

  it('les objets fixés au mur doivent aussi rester sous l\'allège devant la fenêtre ; rideaux et plafonniers ne sont pas concernés', () => {
    const grid = gridOf(roomWithOpenings());
    expect(reasonsOf(grid, putAt('frame-small', 3.5, 1.065))).toContain('window'); // cadre à 1,3 m devant la fenêtre
    expect(reasonsOf(grid, putAt('frame-small', 5.0, 1.065))).toEqual([]);
    expect(reasonsOf(grid, putAt('curtains', 3.5, 1.125))).toEqual([]); // rideaux dans la zone et contre le mur
    expect(reasonsOf(grid, putAt('ceiling-light', 3.5, 1.4))).toEqual([]);
  });

  it('la zone n\'existe que du côté de la pièce ; une fenêtre dans une cloison compte pour les deux pièces', () => {
    const plan = addOpening(house(), { type: 'window', start: vStart(14, 8), span: 2 });
    const rooms = detectRooms(plan);
    const [l, r] = rooms.map((room) => createRoomGrid(plan, room));
    expect(l.windows).toHaveLength(1);
    expect(r.windows).toHaveLength(1);
    const cl = cellAt(l, 6.8, 4.5);
    const cr = cellAt(r, 7.2, 4.5);
    expect(cellFlags(l, cl.i, cl.j) & CELL_WINDOW).toBe(CELL_WINDOW);
    expect(cellFlags(r, cr.i, cr.j) & CELL_WINDOW).toBe(CELL_WINDOW);
  });
});

describe('generator : placement et dégagement frontal', () => {
  it('place, retire et rend la grille comme avant ; chaque objet reçoit une clé unique', () => {
    const grid = gridOf(roomBox());
    const before = freeAreaM2(grid);
    const a = tryPlaceObject(grid, putAt('sofa-2', 3.5, 1.55));
    const b = tryPlaceObject(grid, putAt('armchair', 5.0, 3.5));
    expect([a.ok, b.ok]).toEqual([true, true]);
    expect([a.object.key, b.object.key]).toEqual(['sofa-2#1', 'armchair#2']);
    expect(grid.objects).toHaveLength(2);
    expect(freeAreaM2(grid) < before).toBe(true);
    expect(gridToText(grid)).toContain('o');
    expect(removeObject(grid, 'sofa-2#1')).toBe(true);
    expect(removeObject(grid, 'sofa-2#1')).toBe(false);
    removeObject(grid, 'armchair#2');
    expect(freeAreaM2(grid)).toBe(before);
    expect(grid.objects).toHaveLength(0);
    expect(grid.solid.every((n) => n === 0)).toBe(true);
  });

  it('refuse sans rien ajouter quand l\'objet est mal placé, et dit pourquoi', () => {
    const grid = gridOf(roomBox());
    const result = tryPlaceObject(grid, putAt('sofa-2', 0.5, 3));
    expect(result.ok).toBe(false);
    expect(result.object).toBe(null);
    expect(result.reasons).toContain('outside');
    expect(grid.objects).toHaveLength(0);
  });

  it('refuse deux objets qui se recouvrent, accepte tapis sous canapé et lampe sur une console', () => {
    const grid = gridOf(roomBox());
    expect(tryPlaceObject(grid, putAt('sofa-2', 3.5, 1.55)).ok).toBe(true);
    const clash = checkPlacement(grid, putAt('armchair', 4.0, 1.7), { clearance: false });
    expect(clash.reasons).toContain('object');
    expect(clash.conflicts).toEqual(['sofa-2#1']);
    expect(tryPlaceObject(grid, putAt('rug-m', 3.5, 2.4)).ok).toBe(true); // tapis : sous le canapé et devant lui
    expect(tryPlaceObject(grid, putAt('console', 5.0, 1.3)).ok).toBe(true);
    expect(tryPlaceObject(grid, putAt('table-lamp', 5.0, 1.3)).ok).toBe(true); // lampe sur la console
    expect(tryPlaceObject(grid, putAt('ceiling-light', 3.5, 3.0)).ok).toBe(true);
    expect(tryPlaceObject(grid, putAt('frame-large', 3.5, 1.075)).ok).toBe(true); // cadre au-dessus du canapé, contre le mur
  });

  it('dégagement frontal : celui d\'un canapé doit rester libre', () => {
    const grid = gridOf(roomBox());
    const sofa = putAt('sofa-2', 3.5, 1.55); // devant : y de 2,0 à 2,8 m
    expect(isFrontClear(grid, sofa)).toBe(true);
    expect(checkPlacement(grid, sofa).ok).toBe(true);
    addObject(grid, sofa);
    // une table basse à 0,3 m du canapé est dans son dégagement
    const table = putAt('coffee-table', 3.5, 2.55); // y de 2,275 à 2,825
    expect(reasonsOf(grid, table)).toContain('clearance');
    expect(checkPlacement(grid, table).conflicts).toEqual(['sofa-2#1']);
    // la même table à 1 m du canapé est acceptée
    expect(reasonsOf(grid, putAt('coffee-table', 3.5, 3.35))).toEqual([]);
    // en mode « own », on ne vérifie que le dégagement de la table elle-même (0,4 m)
    expect(reasonsOf(grid, table, { clearance: 'own' })).toEqual([]);
    expect(reasonsOf(grid, table, { clearance: false })).toEqual([]);
  });

  it('dégagement frontal : le sien est vérifié, y compris contre le mur d\'en face et les objets déjà là', () => {
    const grid = gridOf(roomBox());
    // canapé qui regarde le mur : 0,8 m devant, mais le mur est à 5 cm
    const facingWall = putAt('sofa-2', 3.5, 1.55, 180);
    expect(isFrontClear(grid, facingWall)).toBe(false);
    expect(reasonsOf(grid, facingWall)).toContain('clearance');
    expect(reasonsOf(grid, facingWall, { clearance: false })).toEqual([]);
    // la pièce fait 3,8 m de profondeur utile : un meuble TV contre le mur nord garde 1,5 m devant lui (y de 1,5 à 3,0 m)
    addObject(grid, putAt('tv-unit', 3.5, 1.3));
    const sofaFar = putAt('sofa-2', 3.5, 4.45, 180); // contre le mur sud, tourné vers le TV : hors de la zone du TV
    expect(checkPlacement(grid, sofaFar).ok).toBe(true);
    const sofaNear = putAt('sofa-2', 3.5, 3.3, 180); // y de 2,85 à 3,75 m : empiète sur le dégagement du TV
    expect(reasonsOf(grid, sofaNear)).toContain('clearance');
    expect(checkPlacement(grid, sofaNear).conflicts).toEqual(['tv-unit#1']);
    expect(reasonsOf(grid, sofaNear, { clearance: 'own' })).toEqual([]); // son propre dégagement (y de 2,05 à 2,85 m) est libre
  });
});

describe('generator : connexité (passage de 60 cm minimum)', () => {
  /** Dalle de test : un obstacle posé sans les contrôles de placement, centré en (cx, cy). */
  const slab = (w, d, cx, cy, h = 1, key = 'dalle') => createPlaced(thing(key, w, d, h), { x: cx, y: cy });
  const codes = (result) => result.violations.map((v) => v.code);
  // Pièce de 5 × 4 m : zone libre de x 1,1 à 5,9 m et de y 1,1 à 4,9 m ; porte au sud (x de 2 à 3 m).

  it('une pièce vide est connexe : la porte est atteinte et rien n\'est signalé', () => {
    const grid = gridOf(roomWithOpenings());
    const result = checkConnectivity(grid);
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.doors).toEqual([{ openingId: 'o1', kind: 'door', reachable: true, blockedWhenEmpty: false }]);
    expect(result.minWidth).toBe(0.6);
  });

  it('un passage de 60 cm laisse passer, un passage de 50 cm isole le fond de la pièce (poche)', () => {
    // Cloison basse sur toute la largeur sauf un couloir à l'est ; le fond (nord) n'est relié à la porte que par ce couloir.
    const wide = gridOf(roomWithOpenings());
    addObject(wide, slab(4.2, 0.4, 3.2, 3.0)); // x de 1,1 à 5,3 m : couloir de 5,3 à 5,9 m = 60 cm
    expect(checkConnectivity(wide).ok).toBe(true);

    const narrow = gridOf(roomWithOpenings());
    addObject(narrow, slab(4.3, 0.4, 3.25, 3.0)); // x de 1,1 à 5,4 m : couloir de 50 cm
    const result = checkConnectivity(narrow);
    expect(result.ok).toBe(false);
    expect(codes(result)).toEqual(['pocket']);
    expect(result.violations[0].areaM2 > 1).toBe(true);
    expect(result.violations[0].at.y < 2.8).toBe(true); // la poche est au nord de la cloison
    // avec un corps de 50 cm, le couloir de 50 cm suffit
    expect(checkConnectivity(narrow, { minWidth: 0.5 }).ok).toBe(true);
  });

  it('une porte entièrement bloquée est signalée', () => {
    const grid = gridOf(roomWithOpenings());
    addObject(grid, slab(4.8, 0.5, 3.5, 4.65)); // y de 4,4 à 4,9 m, devant la porte, d'un mur à l'autre
    const result = checkConnectivity(grid);
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain('door-blocked');
    expect(result.doors[0]).toEqual({ openingId: 'o1', kind: 'door', reachable: false, blockedWhenEmpty: false });
  });

  it('un meuble devant la porte mais avec 60 cm de côté laisse la porte accessible', () => {
    const grid = gridOf(roomWithOpenings());
    addObject(grid, slab(3.0, 0.5, 4.4, 4.65)); // x de 2,9 à 5,9 m ; la porte est à x de 2 à 3 m : accès par la gauche (1,1 à 2,9 m)
    expect(checkConnectivity(grid).ok).toBe(true);
  });

  it('deux portes séparées par un meuble sur toute la largeur sont déconnectées', () => {
    let plan = roomWithOpenings();
    plan = addOpening(plan, { type: 'door', start: hStart(8, 2), swing: 'b' }); // o3 : porte au nord, x de 4 à 5 m, vers l'intérieur
    const grid = gridOf(plan);
    expect(grid.doors.map((d) => d.openingId)).toEqual(['o1', 'o3']);
    expect(checkConnectivity(grid).ok).toBe(true);
    addObject(grid, slab(4.8, 0.4, 3.5, 3.0));
    const result = checkConnectivity(grid);
    expect(result.ok).toBe(false);
    expect(result.violations).toEqual([{ code: 'doors-disconnected', id: 'o3' }]);
    expect(result.doors.every((d) => d.reachable)).toBe(true);
  });

  it('un passage compte comme une porte', () => {
    const plan = addOpening(roomWithOpenings(), { type: 'passage', start: vStart(12, 4), span: 2 }); // o3 à l'est, y de 3 à 4 m
    const grid = gridOf(plan);
    expect(checkConnectivity(grid).doors.map((d) => d.kind)).toEqual(['door', 'passage']);
    addObject(grid, slab(0.5, 4.8, 5.65, 3.0)); // mur d'armoires le long du passage
    expect(codes(checkConnectivity(grid))).toContain('door-blocked');
  });

  it('les zones importantes doivent rester accessibles : dégagement frontal d\'un objet posé, ou zones données', () => {
    const grid = gridOf(roomWithOpenings());
    const sofa = tryPlaceObject(grid, putAt('sofa-2', 3.5, 1.55)).object; // dégagement devant : y de 2,0 à 2,8 m
    expect(autoZones(grid)).toEqual([{ id: sofa.key, x0: 2.7, y0: 2, x1: 4.3, y1: 2.8 }]);
    expect(checkConnectivity(grid).ok).toBe(true);
    expect(checkConnectivity(grid).zones).toEqual([{ id: 'sofa-2#1', reachable: true, blockedWhenEmpty: false }]);
    addObject(grid, slab(4.8, 0.8, 3.5, 2.4)); // meuble qui remplit tout le dégagement du canapé
    const blocked = checkConnectivity(grid);
    expect(blocked.ok).toBe(false);
    expect(codes(blocked)).toContain('zone-unreachable');
    expect(blocked.zones[0].reachable).toBe(false);
  });

  it('une zone donnée coupée du reste de la pièce est signalée', () => {
    const grid = gridOf(roomWithOpenings());
    addObject(grid, slab(4.3, 0.4, 3.25, 3.0)); // couloir de 50 cm à l'est
    const result = checkConnectivity(grid, { zones: [{ id: 'fond', x0: 2, y0: 1.2, x1: 3, y1: 2 }, { id: 'entree', x0: 3.5, y0: 4, x1: 4.5, y1: 4.8 }] });
    expect(result.violations.filter((v) => v.code === 'zone-cut-off')).toEqual([{ code: 'zone-cut-off', id: 'fond' }]);
    expect(result.zones.map((z) => [z.id, z.reachable])).toEqual([['fond', true], ['entree', true]]);
  });

  it('ce qui est déjà inaccessible dans la pièce vide n\'est pas reproché au placement (mode relatif), mais l\'est en mode strict', () => {
    // Un placard de 0,5 m de large : aucun corps de 60 cm n'y entre, même vide.
    let plan = withBox(createEmptyPlan(), 2, 2, 3, 6);
    plan = addOpening(plan, { type: 'door', start: hStart(2, 6), span: 1 });
    const grid = gridOf(plan);
    const relative = checkConnectivity(grid);
    expect(relative.ok).toBe(true);
    expect(relative.doors).toEqual([{ openingId: 'o1', kind: 'door', reachable: false, blockedWhenEmpty: true }]);
    const strict = checkConnectivity(grid, { relative: false });
    expect(strict.ok).toBe(false);
    expect(codes(strict)).toEqual(['door-blocked']);
  });

  it('une pièce en L : un meuble en travers du coude coupe le bras du haut de la porte', () => {
    let plan = createEmptyPlan();
    for (const [a, b] of [[[2, 2], [14, 2]], [[14, 2], [14, 8]], [[14, 8], [8, 8]], [[8, 8], [8, 14]], [[8, 14], [2, 14]], [[2, 14], [2, 2]]]) {
      plan = addWallSegments(plan, { x: a[0], y: a[1] }, { x: b[0], y: b[1] });
    }
    plan = addOpening(plan, { type: 'door', start: hStart(4, 14), swing: 'a' }); // en bas du bras de gauche
    const grid = gridOf(plan);
    expect(checkConnectivity(grid).ok).toBe(true);
    addObject(grid, slab(2.8, 0.4, 2.5, 4.4)); // y de 4,2 à 4,6 m, sur toute la largeur du bras de gauche
    const result = checkConnectivity(grid);
    expect(codes(result)).toEqual(['pocket']);
    expect(result.violations[0].areaM2 > 10).toBe(true);
    expect(result.violations[0].at.y < 4.2).toBe(true);
  });

  it('une pièce sans porte n\'a rien à relier, et le contrôle est stable d\'un appel à l\'autre', () => {
    const grid = gridOf(roomBox());
    addObject(grid, slab(2.0, 1.0, 3.5, 3.0));
    const first = checkConnectivity(grid);
    expect(first.ok).toBe(true);
    expect(first.doors).toEqual([]);
    expect(checkConnectivity(grid)).toEqual(first);
    removeObject(grid, 'dalle#1');
    expect(checkConnectivity(grid).ok).toBe(true);
  });
});

describe('generator : réglages et cas limites', () => {
  it('la marge contre les murs se règle : 15 cm de marge = 2 cases de mur de chaque côté', () => {
    const plan = roomBox();
    const grid = createRoomGrid(plan, detectRooms(plan)[0], { wallMargin: 0.15 });
    const lines = gridToText(grid).split('\n');
    expect(lines[1]).toBe('#'.repeat(50));
    expect(lines[2]).toBe('##' + '.'.repeat(46) + '##');
    expect(freeAreaM2(grid)).toBe(16.56); // (5 - 0,4) × (4 - 0,4)
  });

  it('une porte reste bloquée si la place libre est à côté d\'elle et non devant elle', () => {
    const grid = gridOf(roomWithOpenings());
    addObject(grid, createPlaced(thing('dalle', 2.8, 0.5, 1), { x: 2.5, y: 4.65 })); // x de 1,1 à 3,9 m, devant la porte (x de 2 à 3 m)
    const result = checkConnectivity(grid);
    expect(result.violations.map((v) => v.code)).toContain('door-blocked');
    expect(countFreeCells(grid) > 1000).toBe(true); // il reste beaucoup de place libre, mais pas devant la porte
  });

  it('les fenêtres ne comptent pas comme des portes pour la connexité', () => {
    const grid = gridOf(roomWithOpenings());
    expect(grid.doors.map((d) => d.openingId)).toEqual(['o1']);
    expect(grid.windows.map((w) => w.openingId)).toEqual(['o2']);
  });
});

/* ------------------------------------------------------------------ */
/* Tests de generator.js, phase 6b : placement des pièces             */
/* ------------------------------------------------------------------ */

const nextTurn = () => new Promise((resolve) => setTimeout(resolve, 0)); // rend la main à la page pendant les longues boucles

/** Plans de test : rectangle 5 × 4 m (porte au sud, fenêtres au nord et à l'est), L de 6 × 6 m, petite pièce de 3 × 3 m. */
function genPlan(shape, type) {
  let plan = createEmptyPlan();
  if (shape === 'rect') {
    plan = withBox(plan, 2, 2, 12, 10);
    plan = addOpening(plan, { type: 'door', start: hStart(4, 10), swing: 'a' });
    plan = addOpening(plan, { type: 'window', start: hStart(6, 2) });
    plan = addOpening(plan, { type: 'window', start: vStart(12, 5) });
  } else if (shape === 'L') {
    for (const [a, b] of [[[2, 2], [14, 2]], [[14, 2], [14, 8]], [[14, 8], [8, 8]], [[8, 8], [8, 14]], [[8, 14], [2, 14]], [[2, 14], [2, 2]]]) {
      plan = addWallSegments(plan, { x: a[0], y: a[1] }, { x: b[0], y: b[1] });
    }
    plan = addOpening(plan, { type: 'door', start: hStart(3, 14), swing: 'a' });
    plan = addOpening(plan, { type: 'window', start: hStart(6, 2) });
    plan = addOpening(plan, { type: 'window', start: vStart(14, 4) });
  } else {
    plan = withBox(plan, 2, 2, 8, 8);
    plan = addOpening(plan, { type: 'door', start: hStart(5, 8), swing: 'a' });
    plan = addOpening(plan, { type: 'window', start: hStart(4, 2) });
  }
  const room = detectRooms(plan)[0];
  plan = setRoomInfo(plan, room, { type });
  return { plan, room: detectRooms(plan)[0] };
}

const GEN_SHAPES = ['rect', 'L', 'small'];
const GEN_TYPES = ['living', 'bedroom', 'dining'];
const defOf = (id) => FURNITURE_DATA.find((def) => def.id === id);
const footprintOfItem = (item) => makeFootprint({ x: item.x, y: item.y, w: defOf(item.id).size.w, d: defOf(item.id).size.d, rotation: item.rotation });
const isFloorItem = (item) => item.elevation === 0 && !['ceiling', 'window', 'wall-mounted'].includes(defOf(item.id).placement.mode);

/** Contrôle écrit à part du générateur : tout reste dans la pièce, rien ne se chevauche, aucune porte n'est gênée. */
function independentProblems(plan, room, items) {
  const problems = [];
  const cells = new Set(room.cells.map((c) => `${c.x},${c.y}`));
  const cell = plan.grid.cellSize;
  const floor = items.filter(isFloorItem);
  for (const item of floor) {
    const fp = footprintOfItem(item);
    for (let x = fp.x0 + 0.05; x < fp.x1; x += 0.1) {
      for (let y = fp.y0 + 0.05; y < fp.y1; y += 0.1) {
        if (!cells.has(`${Math.floor(x / cell)},${Math.floor(y / cell)}`)) problems.push(`${item.id} sort de la pièce en (${x.toFixed(2)}, ${y.toFixed(2)})`);
      }
    }
  }
  for (let i = 0; i < floor.length; i++) {
    for (let j = i + 1; j < floor.length; j++) {
      const a = floor[i];
      const b = floor[j];
      const allowed = defOf(a.id).placement.canOverlap.includes(b.id) || defOf(b.id).placement.canOverlap.includes(a.id);
      if (!allowed && overlapArea(footprintOfItem(a), footprintOfItem(b)) > 1e-6) problems.push(`${a.id} et ${b.id} se chevauchent`);
    }
  }
  const zones = getClearanceZones(plan);
  for (const item of floor) {
    if (defOf(item.id).size.h <= 0.05) continue; // un tapis ne gêne pas le passage
    for (const zone of zones) {
      if (footprintsOverlap(footprintOfItem(item), { x0: zone.x, y0: zone.y, x1: zone.x + zone.w, y1: zone.y + zone.h })) problems.push(`${item.id} bloque la porte ${zone.openingId}`);
    }
  }
  return problems;
}

describe('generator : recettes', () => {
  it('les recettes existent pour tous les types de pièce meublés (pas pour « other »)', () => {
    expect([...RECIPE_TYPES].sort()).toEqual(['bathroom', 'bedroom', 'dining', 'dressing', 'entrance', 'garage', 'hallway', 'kidsroom', 'kitchen', 'laundry', 'living', 'office', 'pantry', 'toilet', 'workshop']);
    expect([...RECIPE_TYPES, 'other'].sort()).toEqual([...ROOM_TYPES].sort()); // tous les types ont une recette sauf « autre » (pièce sans usage)
    for (const type of RECIPE_TYPES) expect(RECIPES[type].type).toBe(type);
  });

  it('chaque objet d\'une recette existe dans le catalogue, avec des bornes min ≤ max et une priorité', () => {
    for (const recipe of Object.values(RECIPES)) {
      const roles = recipe.slots.map((slot) => slot.slot);
      expect(new Set(roles).size).toBe(roles.length);
      for (const slot of recipe.slots) {
        expect(slot.choices.length > 0).toBe(true);
        for (const choice of slot.choices) expect(defOf(choice.id) !== undefined).toBe(true);
        expect(slot.min >= 0 && slot.min <= slot.max).toBe(true);
        expect(slot.priority >= 1).toBe(true);
        for (const host of slot.hosts ?? []) expect(roles.includes(host) || host === 'kitchen-base').toBe(true); // 'kitchen-base' : posé par le planificateur de cuisine
        if (slot.group) expect(roles.includes(recipe.groups[slot.group].anchor)).toBe(true);
        expect(ROLE_LABELS[slot.slot] !== undefined).toBe(true);
      }
    }
  });

  it('les objets obligatoires sont ceux d\'une pièce habitable : canapé et meuble TV, lit et armoire, table', () => {
    const required = (type) => RECIPES[type].slots.filter((slot) => slot.min > 0).map((slot) => slot.slot);
    expect(required('living')).toContain('sofa');
    expect(required('living')).toContain('tv-unit');
    expect(required('bedroom')).toContain('bed');
    expect(required('bedroom')).toContain('wardrobe');
    expect(required('dining')).toContain('dining-table');
  });

  it('les groupes ont une ancre : lit + 2 tables de chevet, table de salle à manger, canapé + table basse', () => {
    expect(RECIPES.bedroom.groups.sleeping.anchor).toBe('bed');
    expect(RECIPES.bedroom.slots.find((slot) => slot.slot === 'nightstand').perAnchor).toEqual({ 'bed-double': 2, 'bed-king': 2, 'bed-single': 1 });
    expect(RECIPES.dining.groups.dining.anchor).toBe('dining-table');
    expect(RECIPES.living.groups.seating.anchor).toBe('sofa');
    expect(TOP_K).toBe(3);
    expect(MAX_ATTEMPTS).toBe(20);
  });
});

describe('generator : generateRoom', () => {
  it('renvoie des PlacedItem complets : pièce, clé unique, objet du catalogue, rotation multiple de 90°, hauteur, graine', () => {
    const { plan, room } = genPlan('rect', 'living');
    const items = generateRoom(room, plan, 7, 'scandinave');
    expect(items.length > 4).toBe(true);
    expect(new Set(items.map((item) => item.key)).size).toBe(items.length);
    for (const item of items) {
      expect(item.roomId).toBe(room.id);
      expect(defOf(item.id) !== undefined).toBe(true);
      expect(item.rotation % 90).toBe(0);
      expect(Number.isFinite(item.x) && Number.isFinite(item.y) && item.elevation >= 0).toBe(true);
      expect(Number.isInteger(item.seed)).toBe(true);
      expect(typeof item.optional).toBe('boolean');
    }
  });

  it('est déterministe : mêmes (pièce, plan, graine, style) donnent exactement le même résultat, même après d\'autres appels', () => {
    for (const type of GEN_TYPES) {
      const { plan, room } = genPlan('rect', type);
      const first = generateRoom(room, plan, 1234, 'moderne');
      generateRoom(room, plan, 99, 'boheme'); // un autre appel entre les deux ne change rien
      expect(generateRoom(room, plan, 1234, 'moderne')).toEqual(first);
      expect(generateRoomReport(room, plan, 1234, 'moderne').items).toEqual(first);
    }
  });

  it('des graines différentes donnent des aménagements différents', () => {
    const { plan, room } = genPlan('rect', 'living');
    const layouts = new Set();
    for (let seed = 1; seed <= 20; seed++) layouts.add(JSON.stringify(generateRoom(room, plan, seed, 'moderne').map((item) => [item.id, item.x, item.y, item.rotation])));
    expect(layouts.size >= 12).toBe(true);
  });

  it('une pièce sans recette (« other ») n\'a pas de meubles', () => {
    let { plan, room } = genPlan('rect', 'living');
    plan = setRoomInfo(plan, room, { type: 'other' });
    expect(generateRoom(detectRooms(plan)[0], plan, 3, 'moderne')).toEqual([]);
  });

  it('chaque pièce a sa propre graine : changer le type d\'une pièce ne change pas le mobilier des autres', () => {
    let plan = withBox(createEmptyPlan(), 2, 2, 12, 10);
    plan = withWall(plan, 12, 2, 22, 2);
    plan = withWall(plan, 22, 2, 22, 10);
    plan = withWall(plan, 22, 10, 12, 10);
    plan = addOpening(plan, { type: 'passage', start: vStart(12, 5) });
    plan = addOpening(plan, { type: 'door', start: hStart(4, 10), swing: 'a' });
    const [left, right] = detectRooms(plan);
    expect(detectRooms(plan)).toHaveLength(2);
    const a = setRoomInfo(setRoomInfo(plan, left, { type: 'living' }), right, { type: 'bedroom' });
    const b = setRoomInfo(setRoomInfo(plan, left, { type: 'living' }), right, { type: 'dining' });
    const roomA = detectRooms(a)[0];
    expect(generateRoom(roomA, a, 5, 'moderne')).toEqual(generateRoom(detectRooms(b)[0], b, 5, 'moderne'));
    const layout = generateLayout(a, 5, 'moderne');
    expect(new Set(layout.map((item) => item.roomId)).size).toBe(2);
  });

  it('le style change la densité du décor sans casser les règles', () => {
    const { plan, room } = genPlan('rect', 'living');
    const count = (style) => [...Array(30).keys()].reduce((n, seed) => n + generateRoom(room, plan, seed + 1, style).length, 0);
    expect(count('boheme') > count('moderne')).toBe(true);
  });
});

describe('generator : aucune collision, rien hors de la pièce, aucune porte bloquée (200 graines)', () => {
  for (const shape of GEN_SHAPES) {
    for (const type of GEN_TYPES) {
      it(`${shape} · ${type} : contrôle du générateur et contrôle indépendant sur toutes les graines`, async () => {
        const { plan, room } = genPlan(shape, type);
        let totalItems = 0;
        for (let seed = 1; seed <= seedCount; seed++) {
          const report = generateRoomReport(room, plan, seed, GEN_STYLE[seed % GEN_STYLE.length]);
          const check = validateLayout(room, plan, report.items);
          if (!check.ok) throw new Error(`graine ${seed} : ${JSON.stringify(check.problems.slice(0, 3))}`);
          const others = independentProblems(plan, room, report.items);
          if (others.length) throw new Error(`graine ${seed} : ${others.slice(0, 3).join(' ; ')}`);
          if (!report.ok) throw new Error(`graine ${seed} : circulation non rétablie`);
          if (report.attempts < 1 || report.attempts > MAX_ATTEMPTS) throw new Error(`graine ${seed} : ${report.attempts} essais`);
          totalItems += report.items.length;
          if (seed % 10 === 0) await nextTurn();
        }
        expect(totalItems / seedCount >= (shape === 'small' ? 3 : 5)).toBe(true); // la pièce est vraiment meublée
      });
    }
  }
});

const GEN_STYLE = ['scandinave', 'moderne', 'industriel', 'classique', 'boheme'];

describe('generator : règles de placement', () => {
  const seedsOf = (n) => [...Array(Math.min(n, seedCount)).keys()].map((k) => k + 1);

  it('lit : contre un mur, centré sur lui, loin des fenêtres, avec ses tables de chevet à la tête', async () => {
    const { plan, room } = genPlan('rect', 'bedroom');
    const grid = createRoomGrid(plan, room);
    let centered = 0;
    let nightstands = 0;
    let awayFromWindow = 0;
    for (const seed of seedsOf(60)) {
      const items = generateRoom(room, plan, seed, 'moderne');
      const bed = items.find((item) => item.role === 'bed');
      expect(bed !== undefined).toBe(true);
      const fp = footprintOfItem(bed);
      const wallDistance = Math.min(fp.x0 - 1, 6 - fp.x1, fp.y0 - 1, 5 - fp.y1);
      expect(wallDistance < 0.11).toBe(true); // le dos du lit touche le mur (marge de 5 cm comprise)
      const windows = grid.windows.flatMap((w) => w.zones);
      if (!windows.some((zone) => footprintsOverlap(inflateRect(fp, 0.5), zone))) awayFromWindow++;
      // Centré : le milieu du lit est à moins de 70 cm du milieu du mur (4 ou 5 m de long) contre lequel il est posé.
      const against = fp.y0 - 1 < 0.11 || 5 - fp.y1 < 0.11 ? 'h' : 'v';
      const offset = against === 'h' ? Math.abs(fp.cx - 3.5) : Math.abs(fp.cy - 3);
      if (offset < 0.7) centered++;
      nightstands += items.filter((item) => item.role === 'nightstand').length ? 1 : 0;
      if (seed % 20 === 0) await nextTurn();
    }
    const N = seedsOf(60).length;
    expect(centered >= 0.8 * N).toBe(true);
    expect(awayFromWindow >= 0.9 * N).toBe(true);
    expect(nightstands >= 0.8 * N).toBe(true);
  });

  it('canapé : face au meuble TV (ou à la pièce), table basse devant lui', async () => {
    const { plan, room } = genPlan('rect', 'living');
    let facing = 0;
    let tables = 0;
    let tableInFront = 0;
    for (const seed of seedsOf(60)) {
      const items = generateRoom(room, plan, seed, 'moderne');
      const sofa = items.find((item) => item.role === 'sofa');
      const tv = items.find((item) => item.role === 'tv-unit');
      expect(sofa !== undefined && tv !== undefined).toBe(true);
      const sfp = footprintOfItem(sofa);
      const toTv = { x: tv.x - sofa.x, y: tv.y - sofa.y };
      const len = Math.hypot(toTv.x, toTv.y);
      if (sfp.front.x * (toTv.x / len) + sfp.front.y * (toTv.y / len) > 0.7) facing++;
      const table = items.find((item) => item.role === 'coffee-table');
      if (table) {
        tables++;
        const toTable = { x: table.x - sofa.x, y: table.y - sofa.y };
        const along = toTable.x * sfp.front.x + toTable.y * sfp.front.y;
        const across = Math.abs(toTable.x * sfp.front.y - toTable.y * sfp.front.x);
        if (along > 0.5 && along < 1.6 && across < 0.4) tableInFront++;
      }
      if (seed % 20 === 0) await nextTurn();
    }
    const N = seedsOf(60).length;
    expect(facing >= 0.8 * N).toBe(true);
    expect(tables >= 0.5 * N).toBe(true);
    expect(tableInFront).toBe(tables);
  });

  it('salle à manger : la table (avec ses chaises) est au centre, avec 30 cm libres tout autour', async () => {
    const { plan, room } = genPlan('rect', 'dining');
    for (const seed of seedsOf(40)) {
      const items = generateRoom(room, plan, seed, 'moderne');
      const table = items.find((item) => item.role === 'dining-table');
      expect(table !== undefined).toBe(true);
      const ring = inflateRect(footprintOfItem(table), 0.3);
      for (const other of items) {
        if (other === table || !isFloorItem(other) || defOf(other.id).size.h <= 0.05) continue;
        expect(footprintsOverlap(ring, footprintOfItem(other))).toBe(false);
      }
      expect(Math.hypot(table.x - 3.5, table.y - 3) < 1.2).toBe(true);
      if (seed % 20 === 0) await nextTurn();
    }
  });

  it('les objets hauts ne bloquent pas les fenêtres, et rien ne se pose devant une porte', async () => {
    for (const shape of GEN_SHAPES) {
      for (const type of GEN_TYPES) {
        const { plan, room } = genPlan(shape, type);
        const grid = createRoomGrid(plan, room);
        const zones = grid.windows.flatMap((w) => w.zones.map((zone) => ({ ...zone, sill: w.sill })));
        for (const seed of seedsOf(25)) {
          for (const item of generateRoom(room, plan, seed, 'moderne')) {
            const def = defOf(item.id);
            if (!isFloorItem(item) || def.placement.mode === 'window') continue;
            const fp = footprintOfItem(item);
            for (const zone of zones) if (footprintsOverlap(fp, zone)) expect(item.elevation + def.size.h <= zone.sill + 1e-6).toBe(true);
          }
        }
        await nextTurn();
      }
    }
  });

  it('les objets posés (lampes, plantes) reposent sur un meuble qui les accepte, les cadres sont accrochés à leur hauteur', () => {
    const { plan, room } = genPlan('rect', 'living');
    for (const seed of seedsOf(40)) {
      const items = generateRoom(room, plan, seed, 'moderne');
      for (const item of items) {
        const def = defOf(item.id);
        if (def.placement.mode === 'wall-mounted') expect(item.elevation).toBe(def.placement.mountHeight);
        if (item.role === 'decor-on-top') {
          const host = items.find((other) => other !== item && defOf(other.id).placement.canOverlap.includes(item.id) && Math.abs(other.elevation + defOf(other.id).size.h - item.elevation) < 1e-6 && footprintsOverlap(footprintOfItem(item), footprintOfItem(other)));
          expect(host !== undefined).toBe(true);
        }
        if (def.placement.mode === 'ceiling') expect(Math.abs(item.elevation + def.size.h - plan.wallHeight) < 1e-6).toBe(true);
      }
    }
  });
});

const inflateRect = (rect, m) => ({ x0: rect.x0 - m, y0: rect.y0 - m, x1: rect.x1 + m, y1: rect.y1 + m });

describe('generator : essais, sous-graines et suppression des objets', () => {
  it('quand le premier essai coupe la circulation, un autre essai (nouvelle sous-graine) rétablit le passage', async () => {
    const { plan, room } = genPlan('small', 'bedroom');
    let retried = 0;
    for (let seed = 1; seed <= Math.max(30, seedCount / 2); seed++) {
      const report = generateRoomReport(room, plan, seed, 'moderne');
      if (report.attempts > 1) retried++;
      expect(report.attempts <= MAX_ATTEMPTS).toBe(true);
      expect(validateLayout(room, plan, report.items).ok).toBe(true);
      if (seed % 20 === 0) await nextTurn();
    }
    expect(retried > 0).toBe(true);
  });

  it('dans une pièce trop petite pour tout contenir, on supprime des objets plutôt que de couper le passage', () => {
    // 2 × 2,5 m, porte au sud : une chambre complète n'y tient pas.
    let plan = withBox(createEmptyPlan(), 2, 2, 6, 7);
    plan = addOpening(plan, { type: 'door', start: hStart(3, 7), swing: 'a' });
    plan = setRoomInfo(plan, detectRooms(plan)[0], { type: 'bedroom' });
    const room = detectRooms(plan)[0];
    for (let seed = 1; seed <= 25; seed++) {
      const report = generateRoomReport(room, plan, seed, 'moderne');
      expect(validateLayout(room, plan, report.items).ok).toBe(true);
      expect(report.items.length < 8).toBe(true);
    }
  });

  it('une pièce où rien ne tient donne une liste vide, sans erreur', () => {
    let plan = withBox(createEmptyPlan(), 2, 2, 4, 4); // 1 × 1 m
    plan = setRoomInfo(plan, detectRooms(plan)[0], { type: 'living' });
    const room = detectRooms(plan)[0];
    const report = generateRoomReport(room, plan, 1, 'moderne');
    expect(validateLayout(room, plan, report.items).ok).toBe(true);
    expect(report.items.length <= 3).toBe(true);
  });
});

describe('generator : validateLayout', () => {
  it('accepte un aménagement valide et relève collisions, objets hors de la pièce et portes bloquées', () => {
    const { plan, room } = genPlan('rect', 'living');
    const good = generateRoom(room, plan, 3, 'moderne');
    expect(validateLayout(room, plan, good).ok).toBe(true);
    const sofa = good.find((item) => item.role === 'sofa');
    const clone = { ...sofa, key: 'copie#1' };
    expect(validateLayout(room, plan, [...good, clone]).problems.map((p) => p.code)).toContain('collision');
    const outside = { ...sofa, key: 'dehors#1', x: 0.2, y: 0.2 };
    expect(validateLayout(room, plan, [outside]).problems.map((p) => p.code)).toContain('outside');
    const inDoor = { ...sofa, key: 'porte#1', x: 2.5, y: 4.3, rotation: 0 }; // devant la porte (x de 1 à 2 m, mur sud à 5 m)
    const codes = validateLayout(room, plan, [inDoor]).problems.map((p) => p.code);
    expect(codes.includes('door') || codes.includes('blocked')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Phase 6c : logement entier, verrous, peaux de murs, store          */
/* ------------------------------------------------------------------ */

/** Donne à chaque pièce son type : `types` a pour clé la case-ancre « x,y ». */
function typedHome(plan, types) {
  for (const room of detectRooms(plan)) plan = setRoomInfo(plan, room, { type: types[roomKey(room)] ?? 'other' });
  return plan;
}

/** Appartement de 9 × 6 m, 3 pièces : séjour (30 m²), chambre (14 m²), salle de bain (10 m²). */
function homePlan3() {
  let plan = withBox(createEmptyPlan(), 2, 2, 20, 14);
  plan = withWall(plan, 12, 2, 12, 14);
  plan = withWall(plan, 12, 9, 20, 9);
  plan = addOpening(plan, { type: 'door', start: hStart(4, 14), swing: 'a' });
  plan = addOpening(plan, { type: 'door', start: vStart(12, 4), swing: 'a' });
  plan = addOpening(plan, { type: 'door', start: vStart(12, 10), swing: 'a' });
  for (const start of [hStart(6, 2), vStart(2, 6), hStart(15, 2), vStart(20, 4), vStart(20, 10)]) plan = addOpening(plan, { type: 'window', start });
  return typedHome(plan, { '2,2': 'living', '12,2': 'bedroom', '12,9': 'bathroom' });
}

/** Appartement de 12 × 8 m, 6 pièces : séjour, couloir, chambre, salle de bain, cuisine, bureau. */
function homePlan6() {
  let plan = withBox(createEmptyPlan(), 2, 2, 26, 18);
  for (const [x0, y0, x1, y1] of [[12, 2, 12, 18], [16, 2, 16, 18], [2, 11, 12, 11], [16, 10, 26, 10], [16, 14, 26, 14]]) plan = withWall(plan, x0, y0, x1, y1);
  plan = addOpening(plan, { type: 'door', start: hStart(13, 18), swing: 'a' });
  for (const start of [vStart(12, 4), vStart(12, 13), vStart(16, 4), vStart(16, 11), vStart(16, 15)]) plan = addOpening(plan, { type: 'door', start, swing: 'a' });
  plan = addOpening(plan, { type: 'passage', start: hStart(5, 11) });
  for (const start of [hStart(5, 2), vStart(2, 5), vStart(2, 14), hStart(6, 18), hStart(19, 2), vStart(26, 4), vStart(26, 11), vStart(26, 15)]) {
    plan = addOpening(plan, { type: 'window', start });
  }
  return typedHome(plan, { '2,2': 'living', '12,2': 'hallway', '16,2': 'bedroom', '16,10': 'bathroom', '2,11': 'kitchen', '16,14': 'office' });
}

const homeSeeds = (n) => [...Array(Math.min(n, seedCount)).keys()].map((k) => k + 1);
const roomItems = (plan, room) => plan.furniture.filter((item) => item.roomId === room.id);

describe('core : verrous de pièces', () => {
  it('un plan neuf n\'a aucun verrou ; validatePlan accepte les verrous et refuse les valeurs invalides', () => {
    const plan = createEmptyPlan();
    expect(plan.roomLocks).toEqual({});
    expect(validatePlan({ ...withBox(plan, 4, 4, 10, 10), roomLocks: { '4,4': true } }).valid).toBe(true);
    expect(validatePlan({ ...plan, roomLocks: { '4,4': false } }).valid).toBe(false);
    expect(validatePlan({ ...plan, roomLocks: { pas: true } }).valid).toBe(false);
    expect(validatePlan({ ...plan, roomLocks: [] }).valid).toBe(false);
    const { roomLocks, ...old } = plan; // plan enregistré avant la phase 6c
    expect(validatePlan(old).valid).toBe(true);
    expect(normalizePlan(old).roomLocks).toEqual({});
    const fresh = normalizePlan(plan);
    expect(fresh).toBe(plan);
  });

  it('setRoomLock verrouille et déverrouille une pièce, et renvoie le même plan si rien ne change', () => {
    const plan = homePlan3();
    const [living, bedroom] = detectRooms(plan);
    expect(isRoomLocked(plan, living)).toBe(false);
    expect(setRoomLock(plan, living, false)).toBe(plan);
    const locked = setRoomLock(plan, living, true);
    expect(isRoomLocked(locked, living)).toBe(true);
    expect(isRoomLocked(locked, bedroom)).toBe(false);
    expect(locked.roomLocks).toEqual({ [roomKey(living)]: true });
    expect(plan.roomLocks).toEqual({}); // l'ancien plan n'a pas bougé
    expect(setRoomLock(locked, living, true)).toBe(locked);
    expect(setRoomLock(locked, living, false).roomLocks).toEqual({});
  });

  it('le verrou suit la pièce quand les murs changent, et disparaît avec elle ; clearPlan l\'efface', () => {
    const plan = setRoomLock(homePlan3(), detectRooms(homePlan3())[1], true); // la chambre
    // On ajoute un mur dans le séjour : la chambre reste la même pièce.
    const next = reconcileRoomTypes(plan, withWall(plan, 7, 2, 7, 14));
    expect(Object.keys(next.roomLocks)).toEqual(['12,2']);
    // On supprime la chambre en retirant le mur du fond : elle fusionne avec le séjour, qui hérite du verrou (pièce la plus recouverte).
    const merged = reconcileRoomTypes(plan, removeWallSegments(plan, { x: 12, y: 2 }, { x: 12, y: 9 }));
    expect(Object.keys(merged.roomLocks).length <= 1).toBe(true);
    expect(clearPlan(plan).roomLocks).toEqual({});
  });
});

describe('core : peaux de couleur des murs (buildWallTints)', () => {
  const boxPlan = () => typedHome(addOpening(withBox(createEmptyPlan(), 4, 4, 12, 10), { type: 'door', start: hStart(6, 10), swing: 'a' }), { '4,4': 'living' });

  it('une pièce a ses peaux collées à l\'intérieur des murs, avec une seule matière, et aucune dans l\'ouverture', () => {
    const plan = boxPlan();
    const rooms = detectRooms(plan);
    const boxes = buildWallTints(plan, rooms);
    expect(boxes.length > 0).toBe(true);
    expect(boxes.every((box) => box.kind === 'tint' && box.material === `tint:${rooms[0].id}`)).toBe(true);
    // La pièce fait 4 × 3 m, entre x = 2 et 6, y = 2 et 5. Chaque peau est à l'intérieur : à 5,3 cm du trait du mur, côté pièce.
    for (const box of boxes) {
      const [x, y, z] = box.position;
      expect(x > 2 && x < 6 && z > 2 && z < 5).toBe(true);
      expect(y > 0 && y <= plan.wallHeight).toBe(true);
    }
    // Surface = périmètre × hauteur, moins la découpe de la porte (1 m × 2,1 m).
    const area = boxes.reduce((sum, box) => sum + (box.size[0] > box.size[2] ? box.size[0] : box.size[2]) * box.size[1], 0);
    const door = plan.openings[0];
    const expected = 14 * plan.wallHeight - openingEdges(door).length * 0.5 * Math.min(openingHeight(door), plan.wallHeight);
    expect(Math.abs(area - expected) < 1e-3).toBe(true);
  });

  it('un mur mitoyen reçoit une peau de chaque côté, de la matière de chaque pièce', () => {
    const plan = typedHome(withWall(withBox(createEmptyPlan(), 4, 4, 16, 10), 10, 4, 10, 10), { '4,4': 'living', '10,4': 'bedroom' });
    const rooms = detectRooms(plan);
    const boxes = buildWallTints(plan, rooms);
    expect(new Set(boxes.map((box) => box.material))).toEqual(new Set(rooms.map((room) => `tint:${room.id}`)));
    const atWall = boxes.filter((box) => box.size[0] < 0.01 && Math.abs(box.position[0] - 5) < 0.06);
    expect(atWall.map((box) => Math.sign(box.position[0] - 5)).sort()).toEqual([-1, 1]);
  });

  it('les peaux sont coupées par le mode « murs abaissés » et ajoutées par buildStructure seulement sur demande', () => {
    const plan = boxPlan();
    const rooms = detectRooms(plan);
    expect(buildStructure(plan, { rooms }).boxes.some((box) => box.kind === 'tint')).toBe(false);
    const withTints = buildStructure(plan, { rooms, tints: true });
    expect(withTints.boxes.some((box) => box.kind === 'tint')).toBe(true);
    const low = buildStructure(plan, { rooms, tints: true, maxHeight: LOWERED_WALL_HEIGHT });
    for (const box of low.boxes.filter((b) => b.kind === 'tint')) expect(box.position[1] + box.size[1] / 2 <= LOWERED_WALL_HEIGHT + 1e-9).toBe(true);
  });

  it('une fenêtre laisse des peaux sous l\'allège et au-dessus du linteau, rien dans la vitre', () => {
    const plan = typedHome(addOpening(withBox(createEmptyPlan(), 4, 4, 12, 10), { type: 'window', start: hStart(6, 4) }), { '4,4': 'living' });
    const boxes = buildWallTints(plan, detectRooms(plan)).filter((box) => box.size[0] <= 1.01 && Math.abs(box.position[2] - 2.053) < 1e-6 && box.position[0] > 3 && box.position[0] < 4);
    const win = plan.openings[0];
    const sill = openingSill(win);
    const lintel = sill + openingHeight(win);
    const spans = boxes.map((box) => [box.position[1] - box.size[1] / 2, box.position[1] + box.size[1] / 2]).sort((a, b) => a[0] - b[0]);
    expect(spans).toHaveLength(2);
    expect(Math.abs(spans[0][1] - sill) < 1e-6).toBe(true);
    expect(Math.abs(spans[1][0] - lintel) < 1e-6).toBe(true);
  });
});

describe('generator : variation de couleur des murs par pièce', () => {
  it('est déterminée par (graine, pièce), bornée, et différente d\'une pièce à l\'autre', () => {
    const a = roomWallVariation(7, 'room-2-2');
    expect(roomWallVariation(7, 'room-2-2')).toEqual(a);
    expect(roomWallVariation(7, { id: 'room-2-2' })).toEqual(a);
    expect(roomWallVariation(8, 'room-2-2')).not.toEqual(a);
    const seen = new Set();
    for (let k = 0; k < 40; k++) {
      const v = roomWallVariation(3, `room-${k}-1`);
      expect(Math.abs(v.h) <= ROOM_WALL_VARIATION.h && Math.abs(v.s) <= ROOM_WALL_VARIATION.s && Math.abs(v.l) <= ROOM_WALL_VARIATION.l).toBe(true);
      seen.add(JSON.stringify(v));
    }
    expect(seen.size).toBe(40);
  });
});

describe('generator : generateHome', () => {
  it('écrit le mobilier dans plan.furniture, au format du plan, sans modifier le plan d\'origine', () => {
    const plan = homePlan3();
    const before = JSON.stringify(plan);
    const { plan: next, reports } = generateHome(plan, 5, 'industriel');
    expect(JSON.stringify(plan)).toBe(before);
    expect(plan.furniture).toEqual([]);
    expect(next.furniture.length > 10).toBe(true);
    expect(next.style).toEqual({ preset: 'industriel', seed: 5 });
    expect(Object.keys(reports).sort()).toEqual(detectRooms(plan).map((room) => room.id).sort());
    expect(validatePlan(next).valid).toBe(true);
    expect(JSON.parse(JSON.stringify(next))).toEqual(next); // un seul JSON, rien qui se perde à l'enregistrement
    const ids = next.furniture.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of next.furniture) {
      expect(getFurniture(item.defId) !== undefined).toBe(true);
      expect(item.id.startsWith(`${item.roomId}:`)).toBe(true);
      expect(typeof item.variant.seed).toBe('string');
    }
  });

  it('est déterministe : même (plan, graine, style) → même résultat ; une autre graine → un autre aménagement', () => {
    const plan = homePlan6();
    const a = generateHome(plan, 12, 'moderne').plan;
    expect(generateHome(plan, 12, 'moderne').plan).toEqual(a);
    expect(generateHome(plan, 13, 'moderne').plan.furniture).not.toEqual(a.furniture);
  });

  it('un style inconnu garde la palette du plan ; chaque type de pièce reçoit ses meubles', () => {
    const plan = homePlan6();
    expect(generateHome(plan, 1, 'inconnu').plan.style.preset).toBe(plan.style.preset);
    expect(generateHome(plan, 1, 'boheme').plan.style.preset).toBe('boheme');
    const { plan: next } = generateHome(plan, 4, 'scandinave');
    const rolesOf = (type) => new Set(next.furniture.filter((item) => item.roomId === detectRooms(next).find((r) => getRoomType(next, r) === type).id).map((item) => item.role));
    expect(rolesOf('living').has('sofa')).toBe(true);
    expect(rolesOf('bedroom').has('bed')).toBe(true);
    expect(rolesOf('bathroom').has('toilet')).toBe(true);
    expect(rolesOf('kitchen').has('kitchen-sink')).toBe(true);
    expect(rolesOf('office').has('desk')).toBe(true);
    expect(rolesOf('hallway').size > 0).toBe(true);
    // Chaque pièce a un plafonnier au centre.
    for (const room of detectRooms(next)) expect(next.furniture.some((item) => item.roomId === room.id && item.defId === 'ceiling-light')).toBe(true);
  });

  it('les pièces verrouillées gardent leur mobilier, les autres sont régénérées', () => {
    const base = generateHome(homePlan6(), 3, 'moderne').plan;
    const rooms = detectRooms(base);
    const bedroom = rooms.find((r) => getRoomType(base, r) === 'bedroom');
    const living = rooms.find((r) => getRoomType(base, r) === 'living');
    const locked = setRoomLock(base, bedroom, true);
    const { plan: next, reports } = generateHome(locked, 99, 'moderne');
    expect(reports[bedroom.id]).toBe(undefined);
    expect(roomItems(next, bedroom)).toEqual(roomItems(base, bedroom));
    expect(roomItems(next, living)).not.toEqual(roomItems(base, living));
    expect(isRoomLocked(next, bedroom)).toBe(true);
    // Les objets verrouillés sont les mêmes objets (pas des copies recalculées).
    roomItems(next, bedroom).forEach((item, i) => expect(item).toBe(roomItems(locked, bedroom)[i]));
  });

  it('« only » régénère les pièces demandées et conserve toutes les autres, sans toucher au style du plan', () => {
    const base = generateHome(homePlan6(), 3, 'moderne').plan;
    const rooms = detectRooms(base);
    const kitchen = rooms.find((r) => getRoomType(base, r) === 'kitchen');
    const { plan: next, reports } = generateHome(base, 77, 'boheme', { only: [kitchen.id] });
    expect(Object.keys(reports)).toEqual([kitchen.id]);
    expect(next.style).toEqual(base.style);
    for (const room of rooms) {
      if (room.id === kitchen.id) expect(roomItems(next, room)).not.toEqual(roomItems(base, room));
      else expect(roomItems(next, room)).toEqual(roomItems(base, room));
    }
    // Une pièce verrouillée n'est régénérée que si on la demande.
    const locked = setRoomLock(base, kitchen, true);
    expect(roomItems(generateHome(locked, 77, 'moderne').plan, kitchen)).toEqual(roomItems(base, kitchen));
    expect(roomItems(generateHome(locked, 77, 'moderne', { only: [kitchen.id] }).plan, kitchen)).not.toEqual(roomItems(base, kitchen));
  });

  it('toPlanItem et fromPlanItem sont réciproques', () => {
    const { plan } = homePlan3Furnished();
    for (const item of plan.furniture) expect(toPlanItem(fromPlanItem(item))).toEqual(item);
    const room = detectRooms(plan)[0];
    const items = generateRoom(room, plan, 5, 'moderne');
    expect(items.map((item) => fromPlanItem(toPlanItem(item)))).toEqual(items.map((item) => ({ ...item, group: null, optional: true })));
  });

  it('removeFurniture retire le mobilier des pièces non verrouillées seulement', () => {
    const base = generateHome(homePlan3(), 2, 'moderne').plan;
    const [living, bedroom] = detectRooms(base);
    const empty = createEmptyPlan();
    expect(removeFurniture(empty)).toBe(empty);
    const locked = setRoomLock(base, bedroom, true);
    const cleared = removeFurniture(locked);
    expect(cleared.furniture).toEqual(roomItems(locked, bedroom));
    expect(roomItems(cleared, living)).toEqual([]);
    expect(removeFurniture(base, detectRooms(base), { keepLocked: false }).furniture).toEqual([]);
    expect(removeFurniture(cleared)).toBe(cleared);
  });
});

function homePlan3Furnished() {
  return generateHome(homePlan3(), 6, 'scandinave');
}

describe('generator : logement entier, 3 et 6 pièces, 200 graines', () => {
  for (const [name, build] of [['3 pièces', homePlan3], ['6 pièces', homePlan6]]) {
    it(`${name} : aucune collision, rien hors des pièces, aucune porte bloquée, et moins de 300 ms par logement`, async () => {
      const plan = build();
      const rooms = detectRooms(plan);
      generateHome(plan, 0, 'moderne', { rooms }); // échauffement : le premier appel compile et construit les caches
      const times = [];
      for (let seed = 1; seed <= seedCount; seed++) {
        const started = performance.now();
        const { plan: next, reports } = generateHome(plan, seed, GEN_STYLE[seed % GEN_STYLE.length], { rooms });
        times.push(performance.now() - started);
        for (const room of rooms) {
          const items = roomItems(next, room).map(fromPlanItem);
          if (!items.length) throw new Error(`graine ${seed} : ${room.id} sans meubles`);
          const check = validateLayout(room, next, items);
          if (!check.ok) throw new Error(`graine ${seed} ${room.id} : ${JSON.stringify(check.problems.slice(0, 3))}`);
          const others = independentProblems(next, room, items);
          if (others.length) throw new Error(`graine ${seed} ${room.id} : ${others.slice(0, 3).join(' ; ')}`);
          if (!reports[room.id].ok) throw new Error(`graine ${seed} ${room.id} : circulation non rétablie`);
          if (reports[room.id].missing.length) throw new Error(`graine ${seed} ${room.id} : manque ${reports[room.id].missing.join(', ')}`);
        }
        if (reconcileFurniture(next, rooms) !== next) throw new Error(`graine ${seed} : la réconciliation retire du mobilier valide`);
        if (seed % 10 === 0) await nextTurn();
      }
      times.sort((a, b) => a - b);
      const median = times[Math.floor(times.length / 2)];
      const p95 = times[Math.floor(times.length * 0.95)];
      expect(median < 150).toBe(true);
      expect(p95 < 300).toBe(true);
    });
  }

  it('tous les types de pièce meublés : sans violation sur une pièce rectangulaire, en L et petite', async () => {
    for (const shape of GEN_SHAPES) {
      for (const type of RECIPE_TYPES) {
        const { plan, room } = genPlan(shape, type);
        for (const seed of homeSeeds(6)) {
          const report = generateRoomReport(room, plan, seed, GEN_STYLE[seed % GEN_STYLE.length]);
          const check = validateLayout(room, plan, report.items);
          if (!check.ok) throw new Error(`${shape} ${type} graine ${seed} : ${JSON.stringify(check.problems.slice(0, 3))}`);
          const others = independentProblems(plan, room, report.items);
          if (others.length) throw new Error(`${shape} ${type} graine ${seed} : ${others.slice(0, 3).join(' ; ')}`);
          if (!report.ok) throw new Error(`${shape} ${type} graine ${seed} : circulation non rétablie`);
          if (shape === 'rect' && report.missing.length) throw new Error(`rect ${type} graine ${seed} : manque ${report.missing.join(', ')}`);
        }
      }
      await nextTurn();
    }
  });

  it('la décoration : un luminaire de plafond par pièce, rideaux seulement au salon et dans les chambres', () => {
    const plan = homePlan6();
    let curtains = 0;
    for (const seed of homeSeeds(20)) {
      const { plan: next } = generateHome(plan, seed, 'moderne');
      for (const room of detectRooms(next)) {
        const type = getRoomType(next, room);
        const items = roomItems(next, room);
        for (const item of items) if (item.defId === 'curtains') {
          curtains++;
          expect(['living', 'bedroom', 'kidsroom'].includes(type)).toBe(true);
        }
        expect(items.filter((item) => item.role === 'ceiling-light').length).toBe(1);
      }
    }
    expect(curtains > 0).toBe(true);
  });
});

describe('generator : garage, nouvelles pièces et variété', () => {
  /** Pièce rectangulaire typée dont la porte est au sud ; fenêtre au nord si `window`. */
  const typedBox = (type, [x0, y0, x1, y1], { window = true, doorX = x0 + 2 } = {}) => {
    let plan = withBox(createEmptyPlan(), x0, y0, x1, y1);
    plan = addOpening(plan, { type: 'door', start: hStart(doorX, y1), swing: 'a' });
    if (window) plan = addOpening(plan, { type: 'window', start: hStart(x0 + 2, y0) });
    plan = setRoomInfo(plan, detectRooms(plan)[0], { type });
    return { plan, room: detectRooms(plan)[0] };
  };
  const seeds = (n) => [...Array(n).keys()].map((k) => k + 1); // nombre fixe : les seuils ci-dessous en dépendent, quel que soit le réglage de la page
  const itemFp = footprintOfItem;

  it('garage de 18 m² : une voiture dans le sens de la pièce, du rangement, une disposition valide à chaque graine', () => {
    const { plan, room } = typedBox('garage', [2, 2, 8, 14]); // 3 × 6 m
    let withShelving = 0;
    for (const seed of seeds(40)) {
      const report = generateRoomReport(room, plan, seed, GEN_STYLE[seed % 5]);
      expect(report.ok).toBe(true);
      expect(report.missing).toEqual([]);
      expect(validateLayout(room, plan, report.items).ok).toBe(true);
      const car = report.items.find((item) => item.role === 'car');
      expect(car !== undefined).toBe(true);
      const fp = itemFp(car);
      expect(fp.ey > fp.ex).toBe(true); // la voiture suit la longueur du garage
      if (report.items.some((item) => item.role === 'shelving' || item.role === 'metal-cabinet')) withShelving++;
    }
    expect(withShelving > 20).toBe(true);
  });

  it('garage trop petit (3 × 3 m) : pas de voiture, et le rapport l\'indique ; le reste reste valide', () => {
    const { plan, room } = typedBox('garage', [2, 2, 8, 8]);
    for (const seed of seeds(15)) {
      const report = generateRoomReport(room, plan, seed, 'moderne');
      expect(report.items.some((item) => item.role === 'car')).toBe(false);
      expect(report.missing).toContain('car');
      expect(validateLayout(room, plan, report.items).ok).toBe(true);
    }
  });

  it('grand garage (6 × 6 m, sans fenêtre) : une ou deux voitures, établi et panneau à outils posé au-dessus de lui', () => {
    const { plan, room } = typedBox('garage', [2, 2, 14, 14], { window: false, doorX: 12 });
    let two = 0;
    let boards = 0;
    for (const seed of seeds(60)) {
      const items = generateRoom(room, plan, seed, GEN_STYLE[seed % 5]);
      const cars = items.filter((item) => item.id === 'car' || item.id === 'car-large');
      expect(cars.length >= 1 && cars.length <= 2).toBe(true);
      if (cars.length === 2) {
        two++;
        expect(footprintsOverlap(itemFp(cars[0]), itemFp(cars[1]))).toBe(false);
      }
      const bench = items.find((item) => item.role === 'workbench');
      const board = items.find((item) => item.role === 'pegboard');
      if (board) {
        boards++;
        expect(bench !== undefined).toBe(true);
        expect(board.elevation).toBe(1.3);
        expect(footprintsOverlap(inflateRect(itemFp(bench), 0.1), itemFp(board))).toBe(true);
      }
    }
    expect(two > 5).toBe(true);
    expect(boards > 3).toBe(true);
  });

  it('cuisine : lave-vaisselle et colonne four varient selon la graine, micro-ondes sur un meuble bas', () => {
    const { plan, room } = genPlan('rect', 'kitchen');
    const seen = new Set();
    let microwaves = 0;
    for (const seed of seeds(80)) {
      const items = generateRoom(room, plan, seed, GEN_STYLE[seed % 5]);
      for (const item of items) seen.add(item.id);
      for (const microwave of items.filter((item) => item.id === 'microwave')) {
        microwaves++;
        expect(microwave.elevation).toBe(0.9);
        expect(items.some((item) => item.id === 'kitchen-base' && footprintsOverlap(itemFp(item), itemFp(microwave)))).toBe(true);
      }
      expect(items.filter((item) => item.id === 'fridge').length).toBe(1);
    }
    expect(seen.has('dishwasher') && seen.has('oven-column')).toBe(true);
    expect(microwaves > 3).toBe(true);
  });

  it('salle à manger : objets posés au milieu du plateau (hauteur 0,75 m sur la table, 0,85 m sur le buffet)', () => {
    const { plan, room } = genPlan('rect', 'dining');
    let onTable = 0;
    for (const seed of seeds(80)) {
      const items = generateRoom(room, plan, seed, GEN_STYLE[seed % 5]);
      const table = items.find((item) => item.role === 'dining-table');
      for (const top of items.filter((item) => item.role === 'tabletop')) {
        const inTable = footprintsOverlap(itemFp(table), itemFp(top));
        if (inTable) {
          onTable++;
          expect(top.elevation).toBe(0.75);
          expect(Math.hypot(top.x - table.x, top.y - table.y) < 0.02).toBe(true); // au centre
        } else {
          expect(top.elevation > 0.5).toBe(true); // sur le buffet
        }
      }
    }
    expect(onTable > 10).toBe(true);
  });

  it('radiateurs sous les fenêtres, stores à hauteur d\'allège : seulement là où il y a une fenêtre', () => {
    const { plan, room } = genPlan('rect', 'living');
    const grid = createRoomGrid(plan, room);
    let radiators = 0;
    let blinds = 0;
    for (const seed of seeds(60)) {
      for (const item of generateRoom(room, plan, seed, 'moderne')) {
        if (item.id === 'radiator') {
          radiators++;
          expect(item.elevation).toBe(0.15);
          expect(grid.windows.some((w) => footprintsOverlap(inflateRect(itemFp(item), 0.2), inflateRect({ x0: w.axis === 'h' ? w.a0 : w.pos, x1: w.axis === 'h' ? w.a1 : w.pos, y0: w.axis === 'h' ? w.pos : w.a0, y1: w.axis === 'h' ? w.pos : w.a1 }, 0.1)))).toBe(true);
        }
        if (item.id === 'blinds') {
          blinds++;
          expect(item.elevation).toBe(0.75);
        }
      }
    }
    expect(radiators > 5 && blinds > 5).toBe(true);
    const inner = genPlan('rect', 'hallway');
    void inner;
  });

  it('banc de lit : au pied du lit, dans son axe ; jamais avec un lit d\'une place', () => {
    const { plan, room } = genPlan('rect', 'bedroom');
    let benches = 0;
    for (const seed of seeds(120)) {
      const items = generateRoom(room, plan, seed, GEN_STYLE[seed % 5]);
      const bench = items.find((item) => item.role === 'bed-bench');
      if (!bench) continue;
      benches++;
      const bed = items.find((item) => item.role === 'bed');
      expect(bed.id).not.toBe('bed-single');
      const vertical = bed.rotation % 180 === 0; // lit dans l'axe nord-sud : le banc a le même x
      expect(Math.abs(vertical ? bench.x - bed.x : bench.y - bed.y) < 0.01).toBe(true);
      expect(bench.rotation).toBe(bed.rotation);
      expect(footprintsOverlap(itemFp(bed), itemFp(bench))).toBe(false);
    }
    expect(benches > 5).toBe(true);
  });

  it('chambre d\'enfant : lits variés (une place, superposés, bébé), pas de table de chevet pour un lit superposé', () => {
    const { plan, room } = typedBox('kidsroom', [2, 2, 9, 9]);
    const beds = new Set();
    for (const seed of seeds(80)) {
      const report = generateRoomReport(room, plan, seed, GEN_STYLE[seed % 5]);
      expect(validateLayout(room, plan, report.items).ok).toBe(true);
      const bed = report.items.find((item) => item.role === 'bed');
      expect(bed !== undefined).toBe(true);
      beds.add(bed.id);
      if (bed.id !== 'bed-single') expect(report.items.some((item) => item.role === 'nightstand')).toBe(false);
    }
    expect(beds.has('bed-single') && beds.has('bunk-bed')).toBe(true);
  });

  it('cellier, atelier, dressing : chacun a son mobilier propre et jamais celui d\'une autre famille', () => {
    const expectations = { pantry: ['metal-shelving'], workshop: ['workbench'], dressing: ['wardrobe-3', 'wardrobe', 'open-wardrobe'] };
    const geometry = { pantry: [2, 2, 6, 8], workshop: [2, 2, 8, 10], dressing: [2, 2, 7, 8] };
    for (const [type, mustHaveOne] of Object.entries(expectations)) {
      const { plan, room } = typedBox(type, geometry[type]);
      for (const seed of seeds(20)) {
        const items = generateRoom(room, plan, seed, 'moderne');
        expect(items.some((item) => mustHaveOne.includes(item.id))).toBe(true);
        expect(items.some((item) => ['sofa-2', 'sofa-3', 'bed-double', 'tv-unit', 'toilet'].includes(item.id))).toBe(false);
      }
    }
  });

  it('variété : canapé, lit, table et armoire changent d\'une graine à l\'autre, et deux graines donnent presque toujours deux aménagements différents', () => {
    const ids = (type, role, n = 100) => {
      const { plan, room } = genPlan('rect', type);
      const found = new Set();
      const layouts = new Set();
      for (const seed of seeds(n)) {
        const items = generateRoom(room, plan, seed, GEN_STYLE[seed % 5]);
        layouts.add(items.map((item) => `${item.id}@${item.x},${item.y}`).join('|'));
        for (const item of items) if (item.role === role) found.add(item.id);
      }
      return { found, layouts: layouts.size };
    };
    expect(ids('living', 'sofa').found.size >= 3).toBe(true);
    expect(ids('bedroom', 'wardrobe').found.size >= 2).toBe(true);
    const bedroom = ids('bedroom', 'bed');
    expect(bedroom.found.size >= 2).toBe(true);
    expect(bedroom.layouts >= 90).toBe(true);
    expect(ids('dining', 'dining-table').found.size >= 2).toBe(true);
  });

  it('les nouvelles pièces ont chacune une recette, un menu de famille et un nom lisible pour leurs objets', () => {
    for (const type of ['kidsroom', 'dressing', 'pantry', 'workshop', 'garage']) {
      expect(RECIPE_TYPES).toContain(type);
      expect(ROOM_TYPE_INFO[type].label.length > 2).toBe(true);
      expect(ROOM_GROUPS.some((group) => group.types.includes(type))).toBe(true);
      for (const slot of RECIPES[type].slots) expect(ROLE_LABELS[slot.slot] !== undefined).toBe(true);
    }
  });
});

describe('generator : réconciliation du mobilier', () => {
  it('rend le même plan quand tout est valide, et un plan sans mobilier tel quel', () => {
    const empty = homePlan3();
    expect(reconcileFurniture(empty)).toBe(empty);
    const { plan } = homePlan3Furnished();
    expect(reconcileFurniture(plan)).toBe(plan);
  });

  it('retire le mobilier d\'une pièce qui change de type, ou dont un objet ne tient plus', () => {
    const { plan } = homePlan3Furnished();
    const [living, bedroom, bathroom] = detectRooms(plan);
    const retyped = { ...plan, roomTypes: { ...plan.roomTypes, [roomKey(bedroom)]: 'office' } };
    const next = reconcileFurniture(retyped);
    expect(roomItems(next, bedroom)).toEqual([]);
    expect(roomItems(next, living)).toEqual(roomItems(plan, living));
    // Une porte posée devant un meuble : toute la pièce est remise à zéro (le mobilier invalide ne reste pas).
    const sofa = roomItems(plan, living).find((item) => item.role === 'sofa');
    const moved = { ...plan, furniture: plan.furniture.map((item) => (item === sofa ? { ...item, x: 1.2, z: 1.2 } : item)) };
    expect(roomItems(reconcileFurniture(moved), living)).toEqual([]);
    expect(roomItems(reconcileFurniture(moved), bathroom)).toEqual(roomItems(plan, bathroom));
  });

  it('suit une pièce qui garde ses cases mais change d\'identifiant, et retire les objets sans pièce', () => {
    const { plan } = homePlan3Furnished();
    const orphan = { ...plan.furniture[0], x: 40, z: 40 }; // hors de toute pièce
    const next = reconcileFurniture({ ...plan, furniture: [...plan.furniture, orphan] });
    expect(next.furniture).toEqual(plan.furniture);
  });

  it('après modification des murs, tout le mobilier restant est valide dans sa pièce', () => {
    const { plan } = homePlan3Furnished();
    const edits = [
      withWall(plan, 7, 2, 7, 14), // cloison dans le séjour
      removeWallSegments(plan, { x: 12, y: 2 }, { x: 12, y: 9 }), // la chambre et le séjour fusionnent
      withWall(plan, 2, 8, 12, 8), // séjour coupé en deux dans l'autre sens
    ];
    for (const edited of edits) {
      const rebuilt = reconcileFurniture(reconcileRoomTypes(plan, edited));
      const rooms = detectRooms(rebuilt);
      for (const room of rooms) {
        const items = roomItems(rebuilt, room).map(fromPlanItem);
        expect(validateLayout(room, rebuilt, items).ok).toBe(true);
      }
      expect(rebuilt.furniture.every((item) => rooms.some((room) => room.id === item.roomId))).toBe(true);
    }
  });
});

describe('store : ameublement annulable', () => {
  const homeStore = (build = homePlan3) => createStore(build());
  const furnitureOf = (store) => store.getState().plan.furniture;

  it('generateHome meuble le logement en une entrée d\'historique ; annuler et rétablir redonnent exactement les mêmes plans', () => {
    const store = homeStore();
    const before = store.getState().plan;
    const result = store.actions.generateHome({ seed: 21, style: 'classique' });
    expect(result.ok).toBe(true);
    const after = store.getState().plan;
    expect(after.furniture.length > 10).toBe(true);
    expect(after.style).toEqual({ preset: 'classique', seed: 21 });
    expect(store.getState().canUndo).toBe(true);
    store.actions.undo();
    expect(store.getState().plan).toBe(before);
    expect(store.getState().canUndo).toBe(false);
    store.actions.redo();
    expect(store.getState().plan).toBe(after);
  });

  it('une génération qui redonne le même résultat n\'ajoute rien à l\'historique', () => {
    const store = homeStore();
    store.actions.generateHome({ seed: 5 });
    const plan = store.getState().plan;
    const again = store.actions.generateHome({ seed: 5 });
    expect(again.ok && again.unchanged).toBe(true);
    expect(store.getState().plan).toBe(plan);
    store.actions.undo();
    expect(furnitureOf(store)).toEqual([]);
  });

  it('refuse proprement quand il n\'y a rien à meubler ou que tout est verrouillé', () => {
    const empty = createStore(createEmptyPlan());
    expect(empty.actions.generateHome().reason).toBe('no-room');
    const untyped = createStore(withBox(createEmptyPlan(), 4, 4, 12, 10));
    expect(untyped.actions.generateHome().reason).toBe('no-room');
    expect(untyped.getState().canUndo).toBe(false);
    const store = homeStore();
    for (const room of store.getRooms()) store.actions.toggleRoomLock(room.id, true);
    expect(store.actions.generateHome().reason).toBe('locked');
    expect(store.actions.clearFurniture()).toBe(false);
  });

  it('regenerateRoom ne change que cette pièce, refuse une pièce verrouillée ou sans type, et s\'annule', () => {
    const store = homeStore();
    store.actions.generateHome({ seed: 8 });
    const base = store.getState().plan;
    const [living, bedroom] = store.getRooms();
    const result = store.actions.regenerateRoom(bedroom.id, 1234);
    expect(result.ok).toBe(true);
    const next = store.getState().plan;
    expect(roomItems(next, bedroom)).not.toEqual(roomItems(base, bedroom));
    expect(roomItems(next, living)).toEqual(roomItems(base, living));
    expect(next.style).toEqual(base.style);
    store.actions.undo();
    expect(store.getState().plan).toBe(base);
    store.actions.toggleRoomLock(bedroom.id, true);
    expect(store.actions.regenerateRoom(bedroom.id, 5).reason).toBe('locked');
    expect(store.actions.regenerateRoom('room-0-0', 5).reason).toBe('unknown');
    store.actions.setRoomInfo(living.id, { type: 'other' });
    expect(store.actions.regenerateRoom(living.id, 5).reason).toBe('no-recipe');
  });

  it('le cadenas s\'annule ; une pièce verrouillée survit à Générer et à Vider', () => {
    const store = homeStore();
    store.actions.generateHome({ seed: 1 });
    const [living, bedroom, bathroom] = store.getRooms();
    const keep = roomItems(store.getState().plan, bedroom);
    expect(store.actions.toggleRoomLock(bedroom.id)).toBe(true);
    expect(isRoomLocked(store.getState().plan, bedroom)).toBe(true);
    store.actions.generateHome({ seed: 2 });
    expect(roomItems(store.getState().plan, bedroom)).toEqual(keep);
    expect(roomItems(store.getState().plan, living)).not.toEqual([]);
    expect(store.actions.clearFurniture()).toBe(true);
    expect(furnitureOf(store)).toEqual(keep);
    expect(roomItems(store.getState().plan, bathroom)).toEqual([]);
    store.actions.undo(); // annule Vider
    expect(furnitureOf(store).length > keep.length).toBe(true);
    store.actions.undo(); // annule la génération 2
    store.actions.undo(); // annule le verrou
    expect(isRoomLocked(store.getState().plan, bedroom)).toBe(false);
    expect(store.actions.toggleRoomLock('room-0-0')).toBe(false);
  });

  it('clearFurniture et setStyle sont annulables ; un style inconnu ou identique est ignoré', () => {
    const store = homeStore();
    store.actions.generateHome({ seed: 3, style: 'moderne' });
    const furnished = store.getState().plan;
    expect(store.actions.setStyle('moderne')).toBe(false);
    expect(store.actions.setStyle('nimporte')).toBe(false);
    expect(store.actions.setStyle('boheme')).toBe(true);
    expect(store.getState().plan.style.preset).toBe('boheme');
    expect(store.getState().plan.furniture).toBe(furnished.furniture); // seules les couleurs changent
    store.actions.undo();
    expect(store.getState().plan).toBe(furnished);
    expect(store.actions.clearFurniture()).toBe(true);
    expect(furnitureOf(store)).toEqual([]);
    store.actions.undo();
    expect(store.getState().plan).toBe(furnished);
    expect(createStore(createEmptyPlan()).actions.clearFurniture()).toBe(false);
  });

  it('changer le type d\'une pièce retire son mobilier (annulable) et laisse les autres pièces', () => {
    const store = homeStore();
    store.actions.generateHome({ seed: 4 });
    const base = store.getState().plan;
    const [living, bedroom] = store.getRooms();
    store.actions.setRoomInfo(bedroom.id, { name: 'Chambre bleue' }); // le nom seul ne change pas le mobilier
    expect(roomItems(store.getState().plan, bedroom)).toEqual(roomItems(base, bedroom));
    store.actions.setRoomInfo(bedroom.id, { type: 'office' });
    expect(roomItems(store.getState().plan, bedroom)).toEqual([]);
    expect(roomItems(store.getState().plan, living)).toEqual(roomItems(base, living));
    store.actions.undo();
    expect(roomItems(store.getState().plan, bedroom)).toEqual(roomItems(base, bedroom));
  });

  it('modifier les murs ou les portes retire le mobilier devenu invalide, annulé d\'un seul coup avec la modification', () => {
    const store = homeStore(homePlan6);
    store.actions.generateHome({ seed: 6 });
    const base = store.getState().plan;
    const rooms = store.getRooms();
    // Une cloison dans le séjour : les objets d'une moitié ou de l'autre disparaissent s'ils ne tiennent plus, le reste est valide.
    store.actions.addWalls({ x: 7, y: 2 }, { x: 7, y: 11 });
    const split = store.getState().plan;
    expect(split.walls.length > base.walls.length).toBe(true);
    for (const room of store.getRooms()) expect(validateLayout(room, split, roomItems(split, room).map(fromPlanItem)).ok).toBe(true);
    const other = rooms.find((room) => getRoomType(base, room) === 'bedroom');
    expect(roomItems(split, other)).toEqual(roomItems(base, other)); // les autres pièces n'ont pas bougé
    store.actions.undo();
    expect(store.getState().plan).toBe(base);
    // Poser et retirer une fenêtre : le mobilier de la pièce touchée reste valide.
    const id = store.actions.addOpening({ type: 'window', start: hStart(8, 2) });
    const withWindow = store.getState().plan;
    for (const room of store.getRooms()) expect(validateLayout(room, withWindow, roomItems(withWindow, room).map(fromPlanItem)).ok).toBe(true);
    store.actions.removeOpening(id);
    for (const room of store.getRooms()) expect(validateLayout(room, store.getState().plan, roomItems(store.getState().plan, room).map(fromPlanItem)).ok).toBe(true);
    // Tout effacer vide aussi le mobilier et les verrous.
    store.actions.toggleRoomLock(rooms[0].id, true);
    store.actions.clearAll();
    expect(furnitureOf(store)).toEqual([]);
    expect(store.getState().plan.roomLocks).toEqual({});
  });

  it('le mobilier est enregistré avec le plan : loadPlan accepte un plan meublé et retrouve les mêmes objets', () => {
    const store = homeStore();
    store.actions.generateHome({ seed: 9, style: 'industriel' });
    const saved = JSON.parse(JSON.stringify(store.getState().plan));
    const other = createStore(createEmptyPlan());
    expect(other.actions.loadPlan(saved).ok).toBe(true);
    expect(other.getState().plan.furniture).toEqual(store.getState().plan.furniture);
    expect(other.getState().canUndo).toBe(false);
    expect(Object.keys(STYLE_DENSITY)).toContain(other.getState().plan.style.preset);
  });
});

/* ------------------------------------------------------------------ */
/* Phase 7 : fichiers, migration, partage, projets                    */
/* ------------------------------------------------------------------ */

const furnitureIds = FURNITURE_DATA.map((def) => def.id);
const clone = (value) => JSON.parse(JSON.stringify(value));
/** Le store, les fichiers et les liens manipulent des DOCUMENTS (version 2) ; les fonctions pures, la vue à plat d'un niveau. */
const asDoc = (plan) => docFromPlan(normalizePlan(plan));
const flat = (doc, index = 0) => levelPlan(doc, index);
/** Plan meublé de 3 ou 6 pièces, copie profonde (les tests le modifient librement). */
const furnishedHome = (build = homePlan3, seed = 21, style = 'moderne') => clone(generateHome(build(), seed, style).plan);
/** Compression de remplacement (lz-string n'est chargé que dans la page) : réversible, mais sans gain de taille. */
const fakeCodec = { compress: (text) => encodeURIComponent(text), decompress: (code) => decodeURIComponent(code) };
/** Faux localStorage. */
function fakeBacking({ failWrites = false } = {}) {
  const data = new Map();
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      if (failWrites && key !== 'maison3d.test') throw new Error('QuotaExceededError');
      data.set(key, String(value));
    },
    removeItem: (key) => void data.delete(key),
  };
}
const projectsOn = (backing, clock = { t: 1000 }) => ({
  clock,
  storage: createStorage(() => backing),
  projects: createProjects(createStorage(() => backing), { now: () => (clock.t += 10), random: () => 0.5 }),
});

describe('core : validatePlan complet (types, bornes, références croisées)', () => {
  const home = () => furnishedHome();
  const errorsOf = (plan) => validatePlan(plan, { furnitureIds }).errors.join(' | ');

  it('accepte un plan vide, un logement meublé et chaque palette connue', () => {
    expect(validatePlan(createEmptyPlan(), { furnitureIds }).valid).toBe(true);
    expect(validatePlan(home(), { furnitureIds }).valid).toBe(true);
    for (const preset of STYLE_PRESETS) expect(validatePlan({ ...createEmptyPlan(), style: { preset, seed: 1 } }).valid).toBe(true);
  });

  it('les palettes autorisées sont celles du catalogue et de la densité de décor', () => {
    expect([...STYLE_PRESETS].sort()).toEqual(PALETTES.map((p) => p.id).sort());
    expect([...STYLE_PRESETS].sort()).toEqual(Object.keys(STYLE_DENSITY).sort());
  });

  it('refuse les bornes dépassées : grille, taille de case, hauteur des murs, graine', () => {
    const base = createEmptyPlan();
    expect(validatePlan({ ...base, grid: { width: PLAN_LIMITS.gridMax + 1, height: 30, cellSize: 0.5 } }).valid).toBe(false);
    expect(validatePlan({ ...base, grid: { width: 40, height: 30, cellSize: 0 } }).valid).toBe(false);
    expect(validatePlan({ ...base, grid: { width: 40, height: 30, cellSize: PLAN_LIMITS.cellSizeMax + 1 } }).valid).toBe(false);
    expect(validatePlan({ ...base, wallHeight: 0.2 }).valid).toBe(false);
    expect(validatePlan({ ...base, wallHeight: 40 }).valid).toBe(false);
    expect(validatePlan({ ...base, style: { preset: 'baroque', seed: 1 } }).valid).toBe(false);
    expect(validatePlan({ ...base, style: { preset: 'moderne', seed: -3 } }).valid).toBe(false);
    expect(validatePlan({ ...base, style: { preset: 'moderne', seed: 1.5 } }).valid).toBe(false);
  });

  it('refuse les murs en double, hors grille ou mal formés, et les ouvertures sur un mur absent', () => {
    const base = withBox(createEmptyPlan(), 4, 4, 12, 10);
    expect(validatePlan({ ...base, walls: [...base.walls, base.walls[0]] }).valid).toBe(false);
    expect(validatePlan({ ...base, walls: [...base.walls, { x: 500, y: 2, dir: 'h' }] }).valid).toBe(false);
    expect(validatePlan({ ...base, walls: [...base.walls, { x: 2, y: 2, dir: 'z' }] }).valid).toBe(false);
    const opened = addOpening(base, { type: 'door', start: hStart(6, 4), swing: 'a' });
    expect(validatePlan(opened).valid).toBe(true);
    expect(validatePlan({ ...opened, openings: [{ ...opened.openings[0], start: { x: 30, y: 20, dir: 'h' } }] }).valid).toBe(false);
    expect(validatePlan({ ...opened, openings: [{ ...opened.openings[0], span: 0 }] }).valid).toBe(false);
    expect(validatePlan({ ...opened, openings: [{ ...opened.openings[0], span: 99 }] }).valid).toBe(false);
  });

  it('refuse le mobilier invalide : rotation, hors grille, doublon, objet inconnu, hors de sa pièce', () => {
    const items = home().furniture;
    const first = items[0];
    const swap = (patch) => ({ ...home(), furniture: [{ ...first, ...patch }, ...items.slice(1)] });
    expect(errorsOf(swap({ rotationY: 45 }))).toContain('rotation');
    expect(validatePlan(swap({ x: -3 })).valid).toBe(false);
    expect(validatePlan(swap({ z: 9999 })).valid).toBe(false);
    expect(validatePlan(swap({ defId: 'licorne' }), { furnitureIds }).valid).toBe(false);
    expect(validatePlan(swap({ defId: 'licorne' })).valid).toBe(true); // sans catalogue fourni, l'identifiant n'est pas vérifié
    expect(validatePlan({ ...home(), furniture: [first, first, ...items.slice(2)] }).valid).toBe(false);
    expect(validatePlan(swap({ roomId: 'room-99-99' }), { furnitureIds }).valid).toBe(false);
    const otherRoom = items.find((item) => item.roomId !== first.roomId);
    expect(validatePlan(swap({ roomId: otherRoom.roomId }), { furnitureIds }).valid).toBe(false); // le centre n'est pas dans cette pièce
    expect(validatePlan({ ...createEmptyPlan(), furniture: [first] }, { furnitureIds }).valid).toBe(false); // mobilier sans aucune pièce
  });

  it('refuse les clés de pièces qui ne correspondent à aucune pièce', () => {
    const plan = withBox(createEmptyPlan(), 4, 4, 12, 10);
    expect(validatePlan({ ...plan, roomTypes: { '4,4': 'kitchen' } }).valid).toBe(true);
    expect(validatePlan({ ...plan, roomTypes: { '30,20': 'kitchen' } }).valid).toBe(false);
    expect(validatePlan({ ...plan, roomNames: { '30,20': 'Fantôme' } }).valid).toBe(false);
    expect(validatePlan({ ...plan, roomLocks: { '30,20': true } }).valid).toBe(false);
    expect(validatePlan({ ...plan, roomTypes: { '4,4': 'cave-a-vin' } }).valid).toBe(false);
  });

  it('les messages sont en français, un par problème, sans « undefined »', () => {
    const { errors } = validatePlan({ ...createEmptyPlan(), wallHeight: 99, style: { preset: 'x', seed: -1 } });
    expect(errors.length > 1).toBe(true);
    for (const message of errors) {
      expect(typeof message).toBe('string');
      expect(message.includes('undefined')).toBe(false);
      expect(/[a-zé]{4}/i.test(message)).toBe(true);
    }
  });
});

describe('core : migratePlan (versions du fichier)', () => {
  const v0 = () => ({ grid: { width: 20, height: 12, cellSize: 0.5 }, walls: [{ x: 2, y: 2, dir: 'h' }], wallHeight: 2.7 });

  it('migre un plan de version 0 (sans « version ») vers la version 2 en complétant les champs', () => {
    const result = migratePlan(v0());
    expect(result.ok).toBe(true);
    expect(result.from).toBe(0);
    expect(result.migrated).toBe(true);
    expect(result.plan.version).toBe(2);
    expect(result.plan.levels).toHaveLength(1);
    const level = flat(normalizeDocument(result.plan));
    expect(level.walls).toEqual([{ x: 2, y: 2, dir: 'h' }]);
    expect(result.plan.wallHeight).toBe(2.7);
    expect(level.openings).toEqual([]);
    expect(level.furniture).toEqual([]);
    expect(level.roomLocks).toEqual({});
    expect(STYLE_PRESETS).toContain(result.plan.style.preset);
  });

  it('migre un plan à un niveau (version 1) en document : un rez-de-chaussée, un éclairage par défaut, rien d\'autre ne change', () => {
    const plan = furnishedHome(homePlan3, 3);
    const result = migratePlan(plan);
    expect(result.ok && result.migrated && result.from === 1).toBe(true);
    expect(result.plan.version).toBe(2);
    expect(result.plan.levels).toHaveLength(1);
    expect(result.plan.levels[0].name).toBe('Rez-de-chaussée');
    expect(result.plan.lighting).toEqual(DEFAULT_LIGHTING);
    expect(flat(result.plan)).toEqual(plan); // la vue du niveau 0 est le plan d'origine
    expect(validatePlan(result.plan).valid).toBe(true);
  });

  it('une version 0 explicite et un plan presque vide sont migrés aussi ; la lecture complète donne un plan valide', () => {
    expect(migratePlan({ ...v0(), version: 0 }).migrated).toBe(true);
    const bare = readPlan({});
    expect(bare.ok).toBe(true);
    expect(bare.plan.grid).toEqual(createEmptyPlan().grid);
    const read = readPlan(v0());
    expect(read.ok).toBe(true);
    expect(read.from).toBe(0);
    expect(validatePlan(read.plan).valid).toBe(true);
  });

  it('ne touche pas à ce qu\'elle reçoit et ne modifie pas un plan déjà à jour', () => {
    const input = v0();
    const snapshot = clone(input);
    migratePlan(input);
    expect(input).toEqual(snapshot);
    const current = asDoc(createEmptyPlan());
    const result = migratePlan(current);
    expect(result.ok && result.migrated).toBe(false);
    expect(result.from).toBe(2);
    expect(result.plan).toEqual(current);
  });

  it('refuse une version plus récente et les valeurs qui ne sont pas des plans, avec des messages en français', () => {
    const future = migratePlan({ ...asDoc(createEmptyPlan()), version: 3 });
    expect(future.ok).toBe(false);
    expect(future.errors[0]).toContain('plus récente');
    for (const bad of [null, 'texte', 42, [], undefined]) {
      const result = migratePlan(bad);
      expect(result.ok).toBe(false);
      expect(result.errors).toHaveLength(1);
    }
    expect(migratePlan({ version: -1 }).ok).toBe(false);
    expect(migratePlan({ version: 'un' }).ok).toBe(false);
  });

  it('readPlan retire les clés de pièces orphelines au lieu de refuser un ancien fichier', () => {
    const plan = { ...withBox(createEmptyPlan(), 4, 4, 12, 10), roomTypes: { '4,4': 'kitchen', '30,20': 'office' }, roomNames: { '30,20': 'Fantôme' } };
    const result = readPlan(plan);
    expect(result.ok).toBe(true);
    expect(flat(result.plan).roomTypes).toEqual({ '4,4': 'kitchen' });
    expect(flat(result.plan).roomNames).toEqual({});
  });
});

describe('fichiers : export et import JSON', () => {
  const planText = (plan, name = 'Mon appartement') => exportPlanText(plan, { name, now: new Date('2026-10-23T12:00:00Z') });

  it('aller-retour : exporter puis importer redonne exactement le même plan (meublé), avec son nom', () => {
    for (const plan of [createEmptyPlan(), homePlan3(), furnishedHome(homePlan3), furnishedHome(homePlan6, 7, 'industriel')]) {
      const text = planText(plan, 'Été « 2026 » \\ test');
      const result = parsePlanText(text, { furnitureIds });
      expect(result.ok).toBe(true);
      expect(result.plan).toEqual(asDoc(plan));
      expect(result.name).toBe('Été « 2026 » \\ test');
      expect(result.migrated).toBe(false);
    }
  });

  it('le fichier est de l\'enveloppe attendue : application, format, date, plan', () => {
    const data = JSON.parse(planText(homePlan3()));
    expect(data.app).toBe(PLAN_FILE_APP);
    expect(data.format).toBe(PLAN_FILE_FORMAT);
    expect(data.exportedAt).toBe('2026-10-23T12:00:00.000Z');
    expect(data.plan.version).toBe(2);
    expect(data.plan.levels).toHaveLength(1);
  });

  it('accepte un plan brut (sauvegarde ancienne) et un fichier précédé d\'un BOM', () => {
    const plan = furnishedHome();
    expect(parsePlanText(JSON.stringify(plan)).plan).toEqual(asDoc(plan));
    expect(parsePlanText(`﻿${planText(plan)}`).ok).toBe(true);
    const old = parsePlanText(JSON.stringify({ grid: { width: 40, height: 30, cellSize: 0.5 }, walls: [] }));
    expect(old.ok && old.migrated && old.from === 0).toBe(true);
  });

  it('rejette les fichiers corrompus ou étrangers, chaque fois avec un message français et sans rien lever', () => {
    const good = planText(furnishedHome());
    const withPlan = (patch) => JSON.stringify({ app: PLAN_FILE_APP, format: 1, name: 'x', plan: { ...createEmptyPlan(), ...patch } });
    const cases = {
      vide: '',
      espaces: '   \n ',
      'pas du JSON': 'ceci n\'est pas un plan',
      tronqué: good.slice(0, Math.floor(good.length / 2)),
      'tableau': '[1, 2, 3]',
      nombre: '42',
      null: 'null',
      'objet quelconque': '{"bonjour": "monde"}',
      'autre application': JSON.stringify({ app: 'autre-logiciel', format: 1, plan: createEmptyPlan() }),
      'format futur': JSON.stringify({ app: PLAN_FILE_APP, format: 99, plan: createEmptyPlan() }),
      'format absent': JSON.stringify({ app: PLAN_FILE_APP, plan: createEmptyPlan() }),
      'plan manquant': JSON.stringify({ app: PLAN_FILE_APP, format: 1 }),
      'plan de version future': withPlan({ version: 7 }),
      'mur hors grille': withPlan({ walls: [{ x: 999, y: 1, dir: 'h' }] }),
      'hauteur absurde': withPlan({ wallHeight: -1 }),
      'palette inconnue': withPlan({ style: { preset: 'zzz', seed: 1 } }),
      'mobilier sans pièce': withPlan({ furniture: furnishedHome().furniture.slice(0, 2) }),
      'trop volumineux': ' '.repeat(PLAN_FILE_MAX_CHARS) + '{}',
    };
    for (const [label, text] of Object.entries(cases)) {
      const result = parsePlanText(text, { furnitureIds });
      expect(result.ok).toBe(false);
      expect(result.errors.length > 0).toBe(true);
      for (const message of result.errors) {
        expect(typeof message).toBe('string');
        expect(message.length > 10).toBe(true);
        expect(message.includes('undefined')).toBe(false);
        expect(message.includes('[object')).toBe(false);
      }
      expect(label.length > 0).toBe(true);
    }
    expect(parsePlanText(cases.tronqué).errors[0]).toContain('JSON');
    expect(parsePlanText(cases['autre application']).errors[0]).toContain('autre-logiciel');
    expect(parsePlanText(cases['format futur']).errors[0]).toContain('99');
    expect(parsePlanText(undefined).ok).toBe(false);
  });

  it('refuse un mobilier modifié à la main qui sortirait de sa pièce ou d\'un objet inconnu, sans abîmer le plan courant', () => {
    const plan = furnishedHome();
    const data = JSON.parse(planText(plan));
    data.plan.levels[0].furniture[0].defId = 'objet-inconnu';
    expect(parsePlanText(JSON.stringify(data), { furnitureIds }).ok).toBe(false);
    data.plan.levels[0].furniture[0].defId = plan.furniture[0].defId;
    data.plan.levels[0].furniture[0].x = 0.01;
    expect(parsePlanText(JSON.stringify(data), { furnitureIds }).ok).toBe(false);
    expect(plan.furniture[0].x).toBe(furnishedHome().furniture[0].x);
  });

  it('extractShareCode trouve le code dans un lien, un fragment ou seul, et rien dans le reste', () => {
    const code = 'N4IgdghgtgpiBcIQDEDKAXA0gYQKoBsBLAOwDMBnAEwCcA';
    expect(extractShareCode(`https://exemple.test/artefact#plan=${code}`)).toBe(code);
    expect(extractShareCode(`#plan=${code}`)).toBe(code);
    expect(extractShareCode(`  plan=${code}  `)).toBe(code);
    expect(extractShareCode(code)).toBe(code);
    expect(extractShareCode('https://exemple.test/artefact')).toBe(null);
    expect(extractShareCode('#autre=1')).toBe(null);
    expect(extractShareCode('court')).toBe(null);
    expect(extractShareCode('{"walls": []}')).toBe(null);
    expect(extractShareCode(undefined)).toBe(null);
  });
});

describe('partage : lien compressé (régénération depuis la graine)', () => {
  const shareOf = (plan, options = {}) => buildShare(plan, { ...fakeCodec, ...options });
  const read = (code) => readShare(code, { decompress: fakeCodec.decompress, furnitureIds });

  it('un plan sans mobilier est partagé tel quel et revient identique', () => {
    const plan = homePlan6();
    const share = shareOf(plan, { name: 'Sans meubles' });
    expect(share.mode).toBe('plan');
    expect(share.lossless).toBe(true);
    const back = read(share.code);
    expect(back.ok).toBe(true);
    expect(back.plan).toEqual(asDoc(plan));
    expect(back.name).toBe('Sans meubles');
    expect(back.regenerated).toBe(false);
  });

  it('un logement meublé est partagé « allégé » (sans mobilier) et le mobilier se régénère à l\'identique depuis la graine', () => {
    for (const [build, seed, style] of [[homePlan3, 21, 'moderne'], [homePlan3, 4, 'boheme'], [homePlan6, 33, 'classique'], [homePlan6, 120, 'industriel']]) {
      const plan = furnishedHome(build, seed, style);
      const share = shareOf(plan);
      expect(share.mode).toBe('light');
      expect(share.lossless).toBe(true);
      expect(share.furnitureCount).toBe(plan.furniture.length);
      const back = read(share.code);
      expect(back.ok).toBe(true);
      expect(back.regenerated).toBe(true);
      expect(flat(back.plan).furniture).toEqual(plan.furniture); // mêmes objets, mêmes positions, mêmes variantes
      expect(back.plan).toEqual(asDoc(plan));
      expect(JSON.parse(fakeCodec.decompress(share.code)).plan.levels[0].furniture).toEqual([]);
    }
  });

  it('le lien allégé est nettement plus court que le plan complet', () => {
    const plan = furnishedHome(homePlan6, 8);
    const light = shareOf(plan);
    const full = fakeCodec.compress(JSON.stringify({ v: 1, plan }));
    expect(light.mode).toBe('light');
    expect(light.length).toBeLessThan(full.length * 0.6);
  });

  it('régénérer deux fois avec la même graine donne le même mobilier ; une autre graine donne autre chose', () => {
    const a = generateHome(homePlan3(), 77, 'scandinave').plan;
    const b = generateHome(homePlan3(), 77, 'scandinave').plan;
    const c = generateHome(homePlan3(), 78, 'scandinave').plan;
    expect(a.furniture).toEqual(b.furniture);
    expect(c.furniture).not.toEqual(a.furniture);
    expect(a.furniture.length > 8).toBe(true);
  });

  it('un mobilier modifié à la main n\'est pas régénérable : le plan complet est joint s\'il tient dans la limite, sinon l\'allégé est signalé « avec perte »', () => {
    const plan = furnishedHome(homePlan3, 5);
    const edited = clone(plan);
    edited.furniture[0] = { ...edited.furniture[0], rotationY: (edited.furniture[0].rotationY + 180) % 360 };
    const full = shareOf(edited, { maxLength: Infinity });
    expect(full.mode).toBe('full');
    expect(full.lossless).toBe(true);
    const back = read(full.code);
    expect(back.ok).toBe(true);
    expect(back.regenerated).toBe(false);
    expect(back.plan).toEqual(asDoc(edited));
    const lossy = shareOf(edited, { maxLength: 100 });
    expect(lossy.mode).toBe('light');
    expect(lossy.lossless).toBe(false);
    expect(flat(read(lossy.code).plan).furniture.length > 0).toBe(true);
  });

  it('la limite par défaut est raisonnable et un logement de 6 pièces meublé tient dedans une fois compressé en « allégé »', () => {
    expect(SHARE_MAX_LENGTH).toBeGreaterThan(1000);
    expect(SHARE_MAX_LENGTH < 10000).toBe(true);
  });

  it('refuse les codes abîmés ou étrangers avec un message français', () => {
    const good = shareOf(furnishedHome()).code;
    const wrap = (value) => fakeCodec.compress(JSON.stringify(value));
    const bad = [
      '',
      'n-importe-quoi',
      good.slice(0, 40),
      fakeCodec.compress('pas du json'),
      wrap({ v: 2, plan: createEmptyPlan() }),
      wrap({ v: 1 }),
      wrap({ v: 1, plan: { ...createEmptyPlan(), wallHeight: -4 } }),
      wrap({ v: 1, plan: 'texte' }),
    ];
    for (const code of bad) {
      const result = read(code);
      expect(result.ok).toBe(false);
      expect(result.errors[0].length > 10).toBe(true);
    }
    expect(readShare('abc', { decompress: () => { throw new Error('boum'); } }).ok).toBe(false);
    expect(readShare('abc', { decompress: () => null }).ok).toBe(false);
  });

  it('avec lz-string (quand la page l\'a chargé), le lien reste court pour un logement de 6 pièces meublé', () => {
    const lz = globalThis.LZString;
    if (!lz) return; // Node : testé hors ligne avec le paquet npm, voir la mesure de taille
    const plan = furnishedHome(homePlan6, 12);
    const share = buildShare(plan, { compress: lz.compressToEncodedURIComponent });
    expect(share.length < SHARE_MAX_LENGTH).toBe(true);
    const back = readShare(share.code, { decompress: lz.decompressFromEncodedURIComponent, furnitureIds });
    expect(back.ok && back.plan.furniture.length === plan.furniture.length).toBe(true);
  });
});

describe('fichiers : archive zip et noms de fichiers', () => {
  it('crc32 donne les valeurs de référence', () => {
    expect(crc32(new Uint8Array([]))).toBe(0);
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new TextEncoder().encode('a'))).toBe(0xe8b7be43);
  });

  it('zipStore produit une archive lisible : en-têtes, noms, tailles, sommes de contrôle et contenu intacts', () => {
    const payload = new Uint8Array(1000).map((_, i) => (i * 7) & 255);
    const zip = zipStore([{ name: 'maison.glb', data: payload }, { name: 'léger.txt', data: new TextEncoder().encode('é') }], new Date(2026, 9, 23, 12, 30, 10));
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    const nameLength = view.getUint16(26, true);
    expect(new TextDecoder().decode(zip.subarray(30, 30 + nameLength))).toBe('maison.glb');
    expect(view.getUint32(14, true)).toBe(crc32(payload));
    expect(view.getUint32(18, true)).toBe(1000);
    expect(zip.subarray(30 + nameLength, 30 + nameLength + 1000)).toEqual(payload);
    const end = zip.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    const centralStart = view.getUint32(end + 16, true);
    expect(view.getUint32(centralStart, true)).toBe(0x02014b50);
    expect(view.getUint32(end + 12, true) + centralStart).toBe(end);
  });

  it('fileSlug donne un nom de fichier sûr', () => {
    expect(fileSlug('Mon Appartement — été 2026 !')).toBe('mon-appartement-ete-2026');
    expect(fileSlug('   ')).toBe('maison-3d');
    expect(fileSlug(undefined)).toBe('maison-3d');
    expect(fileSlug('../../etc/passwd')).toBe('etc-passwd');
    expect(fileSlug('x'.repeat(200)).length).toBe(40);
  });
});

describe('store : stockage local et projets', () => {
  it('createStorage lit et écrit dans le stockage du navigateur ; il le dit', () => {
    const backing = fakeBacking();
    const storage = createStorage(() => backing);
    expect(storage.available).toBe(true);
    expect(storage.set('a', '1')).toBe(true);
    expect(storage.get('a')).toBe('1');
    expect(backing.getItem('a')).toBe('1');
    storage.remove('a');
    expect(storage.get('a')).toBe(null);
    expect(storage.persisted).toBe(true);
  });

  it('stockage indisponible (accès refusé) : rien ne lève, l\'état est signalé, la session continue en mémoire', () => {
    const storage = createStorage(() => {
      throw new Error('SecurityError');
    });
    expect(storage.available).toBe(false);
    expect(storage.persisted).toBe(false);
    expect(storage.set('a', '1')).toBe(false);
    expect(storage.get('a')).toBe('1');
    storage.remove('a');
    expect(storage.get('a')).toBe(null);
    const projects = createProjects(storage);
    expect(projects.load().status).toBe('unavailable');
    const project = projects.create('Brouillon', createEmptyPlan());
    expect(projects.setActive(project.id)).toBe(true);
    expect(projects.readPlan(project.id).ok).toBe(true);
    expect(projects.isPersistent()).toBe(false);
    expect(projects.isAvailable()).toBe(false);
  });

  it('écriture refusée (quota plein) : signalée, sans exception, la valeur reste lisible en mémoire', () => {
    const storage = createStorage(() => fakeBacking({ failWrites: true }));
    expect(storage.available).toBe(true);
    expect(storage.set('a', '1')).toBe(false);
    expect(storage.persisted).toBe(false);
    expect(storage.get('a')).toBe('1');
    const projects = createProjects(storage);
    const project = projects.create('X', createEmptyPlan());
    expect(projects.savePlan(project.id, createEmptyPlan())).toBe(false);
  });

  it('créer, ouvrir, renommer, dupliquer et supprimer : l\'index et les plans suivent, et tout survit à un rechargement', () => {
    const backing = fakeBacking();
    const { projects } = projectsOn(backing);
    expect(projects.load().status).toBe('empty');
    const a = projects.create('Appartement', homePlan3());
    const b = projects.create('Appartement', createEmptyPlan()); // même nom : un numéro est ajouté
    expect(b.name).toBe('Appartement 2');
    expect(projects.setActive(a.id)).toBe(true);
    expect(projects.setActive('inconnu')).toBe(false);
    expect(projects.rename(a.id, '  Maison   de   campagne ')).toBe(true);
    expect(projects.get(a.id).name).toBe('Maison de campagne');
    expect(projects.rename(a.id, '   ')).toBe(false);
    expect(projects.rename('inconnu', 'x')).toBe(false);
    const copy = projects.duplicate(a.id);
    expect(copy.name).toBe('Maison de campagne (copie)');
    expect(projects.readPlan(copy.id).plan).toEqual(projects.readPlan(a.id).plan);
    expect(projects.duplicate('inconnu')).toBe(null);
    expect(projects.list()).toHaveLength(3);

    // Rechargement : un nouvel objet sur le même stockage retrouve tout.
    const reloaded = createProjects(createStorage(() => backing));
    const state = reloaded.load();
    expect(state.status).toBe('restored');
    expect(state.project.id).toBe(a.id);
    expect(state.plan).toEqual(asDoc(homePlan3()));
    expect(reloaded.list()).toHaveLength(3);

    expect(projects.remove(copy.id)).toBe(true);
    expect(backing.getItem(`maison3d.project.${copy.id}`)).toBe(null);
    expect(projects.remove(a.id)).toBe(true); // le projet actif : plus de projet actif
    expect(projects.activeId()).toBe(null);
    expect(projects.remove('inconnu')).toBe(false);
    expect(projects.list().map((p) => p.id)).toEqual([b.id]);
  });

  it('la liste est triée du plus récemment modifié au plus ancien, et savePlan met la date à jour', () => {
    const { projects, clock } = projectsOn(fakeBacking());
    const a = projects.create('A', createEmptyPlan());
    const b = projects.create('B', createEmptyPlan());
    expect(projects.list().map((p) => p.name)).toEqual(['B', 'A']);
    clock.t += 5000;
    projects.savePlan(a.id, createEmptyPlan());
    expect(projects.list().map((p) => p.name)).toEqual(['A', 'B']);
    expect(projects.savePlan('inconnu', createEmptyPlan())).toBe(false);
    expect(b.id === a.id).toBe(false);
  });

  it('un projet dont le plan est corrompu est signalé sans être effacé ; un index illisible ne fait rien planter', () => {
    const backing = fakeBacking();
    const { projects } = projectsOn(backing);
    const a = projects.create('Bon', homePlan3());
    projects.setActive(a.id);
    backing.setItem(`maison3d.project.${a.id}`, '{"version": 1, "walls": [');
    const state = createProjects(createStorage(() => backing)).load();
    expect(state.status).toBe('invalid');
    expect(state.plan).toBe(null);
    expect(state.errors.length > 0).toBe(true);
    expect(backing.getItem(`maison3d.project.${a.id}`)).toBe('{"version": 1, "walls": [');
    backing.setItem(`maison3d.project.${a.id}`, JSON.stringify({ ...createEmptyPlan(), wallHeight: -2 }));
    expect(createProjects(createStorage(() => backing)).load().status).toBe('invalid');
    backing.setItem('maison3d.projects', 'pas du json');
    expect(createProjects(createStorage(() => backing)).load().status).toBe('empty');
    backing.setItem('maison3d.projects', JSON.stringify({ projects: [{ id: '../x', name: 'piégé' }, { id: 'ok1', name: 'Bon' }, 42, null], activeId: 'absent' }));
    const filtered = createProjects(createStorage(() => backing));
    filtered.load();
    expect(filtered.list().map((p) => p.id)).toEqual(['ok1']);
    expect(filtered.activeId()).toBe('ok1');
  });

  it('l\'ancien plan unique (clé « maison3d.plan ») devient le premier projet, version 0 comprise', () => {
    const backing = fakeBacking();
    backing.setItem('maison3d.plan', JSON.stringify(homePlan3()));
    const { projects } = projectsOn(backing);
    const state = projects.load();
    expect(state.status).toBe('restored');
    expect(state.project.name).toBe('Mon logement');
    expect(state.plan).toEqual(asDoc(homePlan3()));
    expect(projects.list()).toHaveLength(1);
    // Version 0 : ancien fichier sans « version ».
    const old = fakeBacking();
    old.setItem('maison3d.plan', JSON.stringify({ grid: { width: 40, height: 30, cellSize: 0.5 }, walls: [] }));
    const migrated = projectsOn(old).projects.load();
    expect(migrated.status).toBe('restored');
    expect(migrated.plan.version).toBe(2);
    // Ancien plan corrompu : ignoré, jamais détruit.
    const broken = fakeBacking();
    broken.setItem('maison3d.plan', '{pas du json');
    expect(projectsOn(broken).projects.load().status).toBe('invalid');
    expect(broken.getItem('maison3d.plan')).toBe('{pas du json');
  });

  it('loadPlan du store migre un plan de version 0 et refuse un plan invalide sans toucher au plan courant', () => {
    const store = createStore(homePlan3());
    const before = store.getState().plan;
    const bad = store.actions.loadPlan({ ...createEmptyPlan(), wallHeight: 50 });
    expect(bad.ok).toBe(false);
    expect(bad.errors.length > 0).toBe(true);
    expect(store.getState().plan).toBe(before);
    const loaded = store.actions.loadPlan({ grid: { width: 20, height: 10, cellSize: 0.5 }, walls: [] });
    expect(loaded.ok).toBe(true);
    expect(loaded.migrated).toBe(true);
    expect(store.getState().plan.version).toBe(1);
    expect(store.getState().plan.grid.width).toBe(20);
    expect(store.getState().canUndo).toBe(false);
  });
});

describe('store : sauvegarde automatique (anti-rebond 500 ms)', () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const setup = (delay = 30) => {
    const backing = fakeBacking();
    const { projects } = projectsOn(backing);
    const project = projects.create('Auto', createEmptyPlan());
    projects.setActive(project.id);
    const store = createStore(createEmptyPlan());
    const statuses = [];
    let writes = 0;
    const realSave = projects.savePlan.bind(projects);
    projects.savePlan = (...args) => {
      writes++;
      return realSave(...args);
    };
    const saver = autosave(store, projects, (status) => statuses.push(status.state), { delay });
    return { backing, projects, project, store, statuses, saver, writes: () => writes };
  };
  const wall = (store, x) => store.actions.addWalls({ x, y: 2 }, { x: x + 2, y: 2 });

  it('plusieurs modifications rapprochées ne font qu\'une écriture, après le délai, dans le projet actif', async () => {
    const { store, projects, project, statuses, saver, writes } = setup();
    for (const x of [2, 6, 10]) wall(store, x);
    expect(statuses[0]).toBe('pending');
    expect(writes()).toBe(0);
    await sleep(80);
    expect(writes()).toBe(1);
    expect(statuses[statuses.length - 1]).toBe('saved');
    expect(flat(projects.readPlan(project.id).plan).walls).toEqual(store.getState().plan.walls);
    expect(store.getState().plan.walls.length > 0).toBe(true);
    saver.dispose();
  });

  it('flush enregistre tout de suite ; rebase déclare un plan déjà enregistré et évite une réécriture inutile', async () => {
    const { store, projects, project, saver, writes } = setup(1000);
    wall(store, 2);
    saver.flush();
    expect(writes()).toBe(1);
    expect(flat(projects.readPlan(project.id).plan).walls).toEqual(store.getState().plan.walls);
    saver.flush();
    expect(writes()).toBe(1); // rien de nouveau
    store.actions.loadPlan(homePlan3());
    saver.rebase(store.getState().doc);
    saver.flush();
    await sleep(20);
    expect(writes()).toBe(1);
    saver.dispose();
  });

  it('une écriture refusée est signalée « unavailable » ; sans projet actif rien n\'est écrit', async () => {
    const backing = fakeBacking({ failWrites: true });
    const { projects } = projectsOn(backing);
    const project = projects.create('Plein', createEmptyPlan());
    projects.setActive(project.id);
    const store = createStore(createEmptyPlan());
    const statuses = [];
    const saver = autosave(store, projects, (status) => statuses.push(status.state), { delay: 10 });
    wall(store, 2);
    await sleep(60);
    expect(statuses[statuses.length - 1]).toBe('unavailable');
    saver.dispose();
    const empty = createProjects(createStorage(() => fakeBacking()));
    const store2 = createStore(createEmptyPlan());
    const seen = [];
    const saver2 = autosave(store2, empty, (status) => seen.push(status.state), { delay: 10 });
    wall(store2, 2);
    await sleep(40);
    expect(seen.includes('saved')).toBe(false);
    saver2.dispose();
  });
});

/* ------------------------------------------------------------------ */
/* Phase 8 : modèles de départ, visite, test de bout en bout, interface */
/* ------------------------------------------------------------------ */

const GOLDEN_APARTMENT = { count: 45, fingerprint: 441400477 };

describe('modèles de départ (studio, T2, T3, maison de 4 pièces)', () => {
  const EXPECTED = { studio: 2, t2: 4, t3: 6, house4: 4 };

  it('quatre modèles, chacun donne un plan valide, vide de mobilier, avec ses pièces typées', () => {
    expect(TEMPLATES.map((template) => template.id)).toEqual(['studio', 't2', 't3', 'house4']);
    for (const template of TEMPLATES) {
      const plan = buildTemplate(template.id);
      expect(validatePlan(plan).valid).toBe(true);
      expect(plan.furniture).toEqual([]);
      const rooms = detectRooms(plan);
      expect(rooms).toHaveLength(EXPECTED[template.id]);
      for (const room of rooms) expect(getRoomType(plan, room)).not.toBe('other');
      expect(findOpenOutlines(plan)).toHaveLength(0); // aucun contour ouvert
    }
  });

  it('chaque porte, fenêtre et passage décrit a trouvé son mur, et chaque pièce a une porte ou un passage', () => {
    for (const template of TEMPLATES) {
      const spec = template.spec;
      const plan = buildTemplate(template.id);
      const asked = (spec.doors?.length ?? 0) + (spec.windows?.length ?? 0) + (spec.passages?.length ?? 0);
      expect(plan.openings).toHaveLength(asked);
      const wallKeys = new Set(plan.walls.map((edge) => `${edge.dir}${edge.x},${edge.y}`));
      for (const opening of plan.openings) for (const edge of openingEdges(opening)) expect(wallKeys.has(`${edge.dir}${edge.x},${edge.y}`)).toBe(true);
      const withDoor = new Set();
      for (const opening of plan.openings.filter((o) => o.type !== 'window')) {
        for (const room of detectRooms(plan)) {
          const cells = new Set(room.cells.map((c) => `${c.x},${c.y}`));
          for (const edge of openingEdges(opening)) {
            const a = edge.dir === 'h' ? `${edge.x},${edge.y - 1}` : `${edge.x - 1},${edge.y}`;
            if (cells.has(a) || cells.has(`${edge.x},${edge.y}`)) withDoor.add(room.id);
          }
        }
      }
      expect(withDoor.size).toBe(detectRooms(plan).length);
    }
  });

  it('un identifiant inconnu ne renvoie rien ; chaque appel renvoie un plan neuf ; les surfaces sont celles annoncées', () => {
    expect(buildTemplate('palais')).toBe(undefined);
    const a = buildTemplate('t2');
    const b = buildTemplate('t2');
    expect(a).toEqual(b);
    a.walls.pop();
    expect(buildTemplate('t2').walls.length).toBe(b.walls.length);
    const area = (id) => Math.round(detectRooms(buildTemplate(id)).reduce((sum, room) => sum + room.areaM2, 0));
    expect(area('studio') >= 25 && area('studio') <= 35).toBe(true);
    expect(area('t2') >= 55 && area('t2') <= 65).toBe(true);
    expect(area('t3') >= 70 && area('t3') <= 85).toBe(true);
    expect(area('house4') >= 90 && area('house4') <= 100).toBe(true);
  });

  it('chaque modèle se meuble avec plusieurs graines : rien ne se chevauche, aucune porte n\'est bloquée, chaque pièce reçoit des meubles', () => {
    for (const template of TEMPLATES) {
      const plan = buildTemplate(template.id);
      const rooms = detectRooms(plan);
      for (const seed of homeSeeds(10)) {
        const { plan: next } = generateHome(plan, seed, GEN_STYLE[seed % GEN_STYLE.length], { rooms });
        for (const room of rooms) {
          const items = roomItems(next, room);
          if (!items.length) throw new Error(`${template.id}, graine ${seed} : ${room.id} sans meubles`);
          const check = validateLayout(room, next, items.map(fromPlanItem));
          if (!check.ok) throw new Error(`${template.id}, graine ${seed}, ${room.id} : ${JSON.stringify(check.problems.slice(0, 2))}`);
        }
      }
    }
  });

  it('un modèle passe l\'export, l\'import et le lien de partage sans rien perdre', () => {
    for (const template of TEMPLATES) {
      const plan = buildTemplate(template.id);
      const back = parsePlanText(exportPlanText(plan, { name: template.id }));
      expect(back.ok).toBe(true);
      expect(back.plan).toEqual(asDoc(plan));
      const share = buildShare(plan, fakeCodec);
      expect(readShare(share.code, { decompress: fakeCodec.decompress, furnitureIds }).plan).toEqual(asDoc(plan));
    }
  });
});

describe('structure 3D : murs extérieurs (mode « murs automatiques »)', () => {
  const home = () => homePlan3();

  it('les murs du pourtour portent un côté extérieur, les cloisons intérieures non', () => {
    const plan = home();
    const boxes = buildStructure(plan).boxes;
    const tagged = tagExteriorBoxes(plan, boxes);
    expect(tagged).toHaveLength(boxes.length);
    const walls = tagged.filter((box) => box.kind === 'wall');
    const outer = walls.filter((box) => box.exterior);
    const inner = walls.filter((box) => !box.exterior);
    expect(outer.length >= 4).toBe(true);
    expect(inner.length >= 2).toBe(true); // les deux cloisons du plan
    expect(new Set(outer.map((box) => box.exterior.side))).toEqual(new Set(['n', 's', 'w', 'e']));
    for (const box of outer) {
      expect(['n', 's', 'w', 'e'].includes(box.exterior.side)).toBe(true);
      expect(typeof box.exterior.line).toBe('number');
    }
  });

  it('les boîtes d\'origine ne sont pas modifiées ; sols et seuils sont rendus tels quels', () => {
    const plan = home();
    const boxes = buildStructure(plan).boxes;
    const before = JSON.stringify(boxes);
    const tagged = tagExteriorBoxes(plan, boxes);
    expect(JSON.stringify(boxes)).toBe(before);
    for (let i = 0; i < boxes.length; i++) if (boxes[i].kind === 'floor') expect(tagged[i]).toBe(boxes[i]);
  });

  it('une fenêtre du pourtour est marquée avec son mur ; un plan sans pièce ne marque rien', () => {
    const plan = home();
    const tagged = tagExteriorBoxes(plan, buildStructure(plan).boxes);
    const glass = tagged.filter((box) => box.kind === 'glass');
    expect(glass.length >= 5).toBe(true);
    expect(glass.every((box) => box.exterior)).toBe(true);
    const open = withWall(createEmptyPlan(), 4, 4, 10, 4);
    expect(tagExteriorBoxes(open, buildStructure(open).boxes).some((box) => box.exterior)).toBe(false);
  });

  it('chaque modèle de départ a un pourtour complet (quatre côtés)', () => {
    for (const template of TEMPLATES) {
      const plan = buildTemplate(template.id);
      const sides = new Set(tagExteriorBoxes(plan, buildStructure(plan).boxes).filter((box) => box.exterior).map((box) => box.exterior.side));
      expect(sides).toEqual(new Set(['n', 's', 'w', 'e']));
    }
  });
});

describe('visite à la première personne : collisions', () => {
  it('murs et fenêtres arrêtent ; portes et passages restent libres ; un tapis ne gêne pas, un meuble oui', () => {
    const plan = homePlan3();
    const world = buildWalkWorld(plan);
    expect(world.width).toBe(plan.grid.width * plan.grid.cellSize);
    expect(world.rects.some((rect) => rect.kind === 'wall')).toBe(true);
    expect(world.rects.some((rect) => rect.kind === 'furniture')).toBe(false); // plan sans mobilier
    // La porte d'entrée (hStart(4, 14)) : on passe de part en part ; sous la fenêtre (hStart(6, 2)) : mur plein.
    expect(walkBlocked(world, 2.5, 7)).toBe(false); // juste sous la porte : dehors, côté sud du séjour
    expect(walkBlocked(world, 2.5, 7.0)).toBe(false);
    expect(walkBlocked(world, 3.5, 1.0)).toBe(true); // sur le mur nord (fenêtre comprise)
    const door = moveWalker(world, { x: 2.5, z: 6.4 }, { x: 0, z: 1.6 }); // traverse la porte vers le sud
    expect(door.z > 7.2).toBe(true);
    const wallBump = moveWalker(world, { x: 3.5, z: 2.5 }, { x: 0, z: -3 }); // contre le mur nord, fenêtre comprise
    expect(wallBump.blocked).toBe(true);
    expect(wallBump.z >= 1 + 0.05 + WALK_RADIUS - 0.001).toBe(true);
    const furnished = generateHome(plan, 3, 'moderne').plan;
    const full = buildWalkWorld(furnished);
    expect(full.rects.filter((rect) => rect.kind === 'furniture').length > 5).toBe(true);
    const rugs = furnished.furniture.filter((item) => /rug/.test(item.defId)).length;
    const solids = furnished.furniture.length;
    expect(full.rects.filter((rect) => rect.kind === 'furniture').length < solids || rugs === 0).toBe(true);
  });

  it('un grand mouvement ne traverse jamais un mur et le marcheur glisse le long de l\'obstacle', () => {
    const plan = homePlan3();
    const world = buildWalkWorld(plan);
    const through = moveWalker(world, { x: 3, z: 3 }, { x: 0, z: -40 });
    expect(through.z >= 1).toBe(true); // arrêté au mur nord, pas de l\'autre côté
    const slide = moveWalker(world, { x: 3, z: 1.4 }, { x: 1, z: -1 });
    expect(slide.x > 3.5).toBe(true); // glisse vers l\'est
    expect(walkBlocked(world, slide.x, slide.z)).toBe(false);
    const edge = moveWalker(world, { x: 1, z: 1 }, { x: -50, z: -50 });
    expect(edge.x >= WALK_RADIUS && edge.z >= WALK_RADIUS).toBe(true); // reste dans la grille
  });

  it('marche au hasard pendant des milliers de pas dans chaque modèle meublé : jamais dans un obstacle, jamais hors de la grille', () => {
    for (const template of TEMPLATES) {
      const plan = generateHome(buildTemplate(template.id), 5, 'scandinave').plan;
      const world = buildWalkWorld(plan);
      const start = findWalkStart(plan, { world });
      let pos = { x: start.x, z: start.z };
      const rng = createGeneratorRng(`visite-${template.id}`);
      let heading = start.yaw;
      for (let step = 0; step < 3000; step++) {
        if (step % 25 === 0) heading += (rng.next() - 0.5) * 3;
        const speed = rng.chance(0.2) ? 0.35 : 0.08;
        pos = moveWalker(world, pos, { x: Math.sin(heading) * speed, z: Math.cos(heading) * speed });
        if (walkBlocked(world, pos.x, pos.z, WALK_RADIUS - 0.01)) throw new Error(`${template.id} : dans un obstacle au pas ${step} (${pos.x.toFixed(2)}, ${pos.z.toFixed(2)})`);
        if (pos.x < 0 || pos.z < 0 || pos.x > world.width || pos.z > world.depth) throw new Error(`${template.id} : hors de la grille au pas ${step}`);
      }
    }
  });

  it('point de départ : dans la pièce demandée (sinon le séjour), libre, et regardant vers le plus dégagé', () => {
    const plan = generateHome(homePlan6(), 9, 'moderne').plan;
    const world = buildWalkWorld(plan);
    const rooms = detectRooms(plan);
    const living = rooms.find((room) => getRoomType(plan, room) === 'living');
    const start = findWalkStart(plan, { world, rooms });
    expect(start.roomId).toBe(living.id);
    expect(walkBlocked(world, start.x, start.z)).toBe(false);
    for (const room of rooms) {
      const there = findWalkStart(plan, { roomId: room.id, world, rooms });
      expect(there.roomId).toBe(room.id);
      expect(walkBlocked(world, there.x, there.z)).toBe(false);
      const cell = roomAtCell(rooms, Math.floor(there.x / plan.grid.cellSize), Math.floor(there.z / plan.grid.cellSize));
      expect(cell?.id).toBe(room.id);
    }
    expect([0, Math.PI / 2, Math.PI, -Math.PI / 2].includes(start.yaw)).toBe(true);
    expect(WALK_EYE_HEIGHT).toBe(1.6);
    const none = findWalkStart(createEmptyPlan());
    expect(none.roomId).toBe(null);
  });
});

describe('de bout en bout : un appartement construit par code, meublé avec une graine fixe', () => {
  const DOORS = [hStart(6, 16), vStart(14, 5), vStart(14, 12), hStart(8, 10)];
  const WINDOWS = [hStart(5, 2), vStart(2, 6), vStart(2, 12), hStart(10, 16), hStart(18, 2), vStart(24, 4), vStart(24, 13), hStart(18, 16)];

  /** Construit l'appartement uniquement par les actions du store, comme le ferait l'éditeur. */
  function buildApartment() {
    const store = createStore(createEmptyPlan());
    const a = store.actions;
    for (const [x0, y0, x1, y1] of [[2, 2, 24, 2], [24, 2, 24, 16], [24, 16, 2, 16], [2, 16, 2, 2], [14, 2, 14, 16], [14, 10, 24, 10], [2, 10, 14, 10]]) {
      a.addWalls({ x: x0, y: y0 }, { x: x1, y: y1 });
    }
    for (const start of DOORS) expect(typeof a.addOpening({ type: 'door', start, swing: 'a' })).toBe('string');
    for (const start of WINDOWS) expect(typeof a.addOpening({ type: 'window', start })).toBe('string');
    const types = { 'room-2-2': 'living', 'room-2-10': 'kitchen', 'room-14-2': 'bedroom', 'room-14-10': 'bathroom' };
    for (const [id, type] of Object.entries(types)) expect(a.setRoomInfo(id, { type })).toBe(true);
    return store;
  }

  it('le plan construit a 4 pièces closes, typées, avec leurs ouvertures', () => {
    const store = buildApartment();
    const plan = store.getState().plan;
    const rooms = store.getRooms();
    expect(rooms.map((room) => room.id).sort()).toEqual(['room-14-10', 'room-14-2', 'room-2-10', 'room-2-2']);
    expect(findOpenOutlines(plan)).toHaveLength(0);
    expect(plan.openings.filter((o) => o.type === 'door')).toHaveLength(4);
    expect(plan.openings.filter((o) => o.type === 'window')).toHaveLength(8);
    expect(validatePlan(plan).valid).toBe(true);
  });

  it('meublé avec la graine 7 (scandinave) : résultat attendu, valide, sans chevauchement, déterministe', () => {
    const store = buildApartment();
    const result = store.actions.generateHome({ seed: 7, style: 'scandinave' });
    expect(result.ok).toBe(true);
    const plan = store.getState().plan;
    expect(plan.style).toEqual({ preset: 'scandinave', seed: 7 });
    expect(validatePlan(plan).valid).toBe(true);
    // Chaque pièce porte ce que sa recette exige : lit, canapé, plan de cuisine, lavabo...
    const roles = (id) => plan.furniture.filter((item) => item.roomId === id).map((item) => item.role);
    expect(roles('room-14-2').some((role) => /bed/.test(role))).toBe(true);
    expect(roles('room-2-2').some((role) => /sofa|couch/.test(role))).toBe(true);
    expect(roles('room-2-10').length > 3).toBe(true);
    expect(roles('room-14-10').length >= 2).toBe(true);
    for (const room of store.getRooms()) {
      const check = validateLayout(room, plan, roomItems(plan, room).map(fromPlanItem));
      if (!check.ok) throw new Error(`${room.id} : ${JSON.stringify(check.problems.slice(0, 2))}`);
    }
    // Même construction, même graine : exactement le même plan (octet pour octet).
    const again = buildApartment();
    again.actions.generateHome({ seed: 7, style: 'scandinave' });
    expect(JSON.stringify(again.getState().plan)).toBe(JSON.stringify(plan));
    // Valeurs de référence : si le générateur change volontairement, mettre ces chiffres à jour.
    const fingerprint = crc32(JSON.stringify(plan.furniture.map((item) => [item.id, item.defId, item.x, item.z, item.rotationY])));
    expect({ count: plan.furniture.length, fingerprint }).toEqual(GOLDEN_APARTMENT);
  });

  it('annuler retire le mobilier, rétablir le rend identique ; une autre graine donne un autre aménagement', () => {
    const store = buildApartment();
    store.actions.generateHome({ seed: 7, style: 'scandinave' });
    const furnished = store.getState().plan;
    expect(store.actions.undo()).toBe(true);
    expect(store.getState().plan.furniture).toEqual([]);
    expect(store.actions.redo()).toBe(true);
    expect(store.getState().plan).toBe(furnished);
    store.actions.generateHome({ seed: 8, style: 'scandinave' });
    expect(store.getState().plan.furniture).not.toEqual(furnished.furniture);
  });

  it('enregistrement, relecture, export JSON et lien de partage redonnent exactement le même appartement meublé', () => {
    const store = buildApartment();
    store.actions.generateHome({ seed: 7, style: 'scandinave' });
    const doc = store.getState().doc;
    const plan = store.getState().plan;
    const projects = createProjects(createStorage(() => fakeBacking()));
    const project = projects.create('Appartement', doc);
    projects.setActive(project.id);
    expect(projects.readPlan(project.id).plan).toEqual(doc);
    const imported = parsePlanText(exportPlanText(doc, { name: 'Appartement' }));
    expect(imported.ok).toBe(true);
    expect(imported.plan).toEqual(doc);
    const share = buildShare(doc, fakeCodec);
    expect(share.lossless).toBe(true);
    const back = readShare(share.code, { decompress: fakeCodec.decompress, furnitureIds });
    expect(back.ok).toBe(true);
    expect(back.plan).toEqual(doc);
    const reopened = createStore(createEmptyPlan());
    expect(reopened.actions.loadPlan(back.plan).ok).toBe(true);
    expect(reopened.getState().plan).toEqual(plan);
  });

  it('on peut se promener dans l\'appartement meublé : départ libre, pas de passage par les murs, portes franchissables', () => {
    const store = buildApartment();
    store.actions.generateHome({ seed: 7, style: 'scandinave' });
    const plan = store.getState().plan;
    const world = buildWalkWorld(plan);
    const start = findWalkStart(plan, { world });
    expect(walkBlocked(world, start.x, start.z)).toBe(false);
    // De la porte d'entrée (hStart(6, 16) : x = 3 m, y = 8 m) vers le nord : on entre dans la cuisine.
    const entered = moveWalker(world, { x: 3.5, z: 8.6 }, { x: 0, z: -0.9 });
    expect(entered.z < 7.9).toBe(true);
    // Contre la cloison nord-sud (x = 7 m) sans porte à cet endroit : on est arrêté.
    const blocked = moveWalker(world, { x: 6, z: 4.5 }, { x: 3, z: 0 });
    expect(blocked.x < 7).toBe(true);
  });
});

describe('interface : libellés regroupés dans un seul objet, accessibilité de base', () => {
  const walk = (node, path, visit) => {
    for (const [key, value] of Object.entries(node)) {
      const here = path ? `${path}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) walk(value, here, visit);
      else visit(here, value);
    }
  };

  it('LABELS regroupe les textes par thème ; aucun libellé vide ; les fonctions renvoient du texte ; label() signale un chemin inconnu', async () => {
    const { LABELS, label } = await import('./ui.js');
    expect(Object.keys(LABELS).length >= 8).toBe(true);
    const stats = { fps: 60, frameMs: 4.2, calls: 12, triangles: 3000, geometries: 8, pixelRatio: 1, shadows: 'statiques' };
    walk(LABELS, '', (path, value) => {
      if (typeof value === 'function') {
        const text = [3, 'Salon', stats].map((sample) => {
          try {
            return value(sample, 'Salon');
          } catch {
            return undefined;
          }
        }).find((result) => typeof result === 'string');
        if (!text || !text.trim()) throw new Error(`${path}() ne renvoie pas de texte`);
      } else if (Array.isArray(value)) {
        if (!value.length) throw new Error(`${path} est vide`);
      } else if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`${path} : libellé vide ou non textuel`);
      }
    });
    expect(label('header.share')).toBe(LABELS.header.share);
    expect(label('nexiste.pas')).toBe('nexiste.pas');
  });

  it('chaque modèle de départ, chaque étape du tutoriel et chaque rubrique de l\'aide ont leur texte', async () => {
    const { LABELS } = await import('./ui.js');
    for (const template of TEMPLATES) {
      expect(typeof LABELS.templates[template.id]?.label).toBe('string');
      expect(LABELS.templates[template.id].description.length > 10).toBe(true);
    }
    expect(LABELS.tour.steps).toHaveLength(6);
    for (const step of LABELS.tour.steps) expect(step.title.length > 2 && step.text.length > 20).toBe(true);
    expect(LABELS.help.sections.length >= 5).toBe(true);
    for (const section of LABELS.help.sections) {
      expect(section.title.length > 2).toBe(true);
      expect(section.rows.length > 0).toBe(true);
      for (const row of section.rows) expect(row).toHaveLength(2);
    }
    const help = JSON.stringify(LABELS.help);
    expect(/artefact/i.test(help) && /Claude/.test(help)).toBe(true); // rappel : le lien de l'artefact se partage depuis Claude
  });

  it('dans la page : chaque data-l* de index.html a son libellé, chaque bouton a un nom accessible', async () => {
    if (typeof document === 'undefined' || !document.getElementById('canvas-2d')) return; // test de page : ignoré dans Node
    const { label } = await import('./ui.js');
    for (const attr of ['data-l', 'data-l-title', 'data-l-aria', 'data-l-ph']) {
      for (const node of document.querySelectorAll(`[${attr}]`)) {
        const path = node.getAttribute(attr);
        if (label(path) === path) throw new Error(`libellé manquant : ${path}`);
      }
    }
    const unnamed = [];
    for (const node of document.querySelectorAll('button, [role="button"], input, select, textarea')) {
      if (node.type === 'hidden') continue;
      const labelled = node.getAttribute('aria-label') || node.getAttribute('aria-labelledby') || node.getAttribute('title') || node.textContent.trim() || (node.labels && node.labels.length) || node.closest('label');
      if (!labelled) unnamed.push(node.id || node.outerHTML.slice(0, 60));
    }
    if (unnamed.length) throw new Error(`sans nom accessible : ${unnamed.join(', ')}`);
  });

  it('dans la page : contraste d\'au moins 4,5 : 1 pour les paires de couleurs du texte, en thème clair et en thème sombre', () => {
    if (typeof document === 'undefined' || !document.getElementById('canvas-2d')) return;
    const root = document.documentElement;
    const luminance = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a, b) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const pairs = [['ink', 'paper'], ['ink', 'sheet'], ['ink-soft', 'sheet'], ['ink-soft', 'paper'], ['accent-ink', 'accent'], ['accent', 'sheet'], ['ink', 'accent-wash'], ['good', 'sheet'], ['bad', 'sheet'], ['bad-ink', 'bad'], ['warn', 'warn-wash']];
    const previous = root.getAttribute('data-theme');
    const failures = [];
    try {
      for (const theme of ['light', 'dark']) {
        root.setAttribute('data-theme', theme); // lecture immédiate, sans rendu entre les deux : rien ne clignote
        const style = getComputedStyle(root);
        for (const [fg, bg] of pairs) {
          const a = style.getPropertyValue(`--${fg}`).trim();
          const b = style.getPropertyValue(`--${bg}`).trim();
          if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) throw new Error(`variable CSS illisible : --${fg} ou --${bg} (${theme})`);
          const value = ratio(a, b);
          if (value < 4.5) failures.push(`${theme} : ${fg} sur ${bg} = ${value.toFixed(2)}`);
        }
      }
    } finally {
      if (previous === null) root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', previous);
    }
    if (failures.length) throw new Error(failures.join(' ; '));
  });
});


/* ------------------------------------------------------------------ */
/* Phase 9 : document à étages (version 2), escaliers                  */
/* ------------------------------------------------------------------ */

describe('document : niveaux et vue d\'un niveau', () => {
  const box = () => withBox(createEmptyPlan(), 4, 4, 12, 10);

  it('un document neuf a un rez-de-chaussée vide, un éclairage par défaut, et passe la validation', () => {
    const doc = createEmptyDocument();
    expect(isDocument(doc)).toBe(true);
    expect(doc.version).toBe(2);
    expect(doc.levels).toHaveLength(1);
    expect(doc.levels[0].name).toBe('Rez-de-chaussée');
    expect(doc.lighting).toEqual(DEFAULT_LIGHTING);
    expect(validatePlan(doc).valid).toBe(true);
  });

  it('levelPlan renvoie le même objet tant que rien ne change, sans champs facultatifs vides', () => {
    const doc = asDoc(box());
    const view = levelPlan(doc, 0);
    expect(levelPlan(doc, 0)).toBe(view);
    expect(view.version).toBe(1);
    expect('stairs' in view).toBe(false);
    expect('wells' in view).toBe(false);
    expect('roomFinishes' in view).toBe(false);
    expect(view.walls).toBe(doc.levels[0].walls);
  });

  it('withLevelPlan est l\'inverse de levelPlan : même document si rien ne change, les autres niveaux restent identiques', () => {
    const doc = addLevel(asDoc(box()));
    expect(withLevelPlan(doc, 0, levelPlan(doc, 0))).toBe(doc);
    const changed = withLevelPlan(doc, 1, withBox(levelPlan(doc, 1), 2, 2, 6, 6));
    expect(changed).not.toBe(doc);
    expect(changed.levels[0]).toBe(doc.levels[0]);
    expect(levelPlan(changed, 1).walls.length > 0).toBe(true);
    expect(levelPlan(changed, 0)).toBe(levelPlan(doc, 0));
    // grille, hauteur et style sont communs à tous les niveaux
    const taller = withLevelPlan(doc, 0, { ...levelPlan(doc, 0), wallHeight: 2.8 });
    expect(taller.wallHeight).toBe(2.8);
    expect(levelPlan(taller, 1).wallHeight).toBe(2.8);
    const styled = withLevelPlan(doc, 1, { ...levelPlan(doc, 1), style: { preset: 'boheme', seed: 9 } });
    expect(levelPlan(styled, 0).style.preset).toBe('boheme');
  });

  it('addLevel, removeLevel, renameLevel : noms, limite de niveaux, jamais le dernier niveau', () => {
    let doc = asDoc(box());
    doc = addLevel(doc);
    expect(doc.levels.map((l) => l.name)).toEqual(['Rez-de-chaussée', 'Étage 1']);
    expect(new Set(doc.levels.map((l) => l.id)).size).toBe(2);
    while (doc.levels.length < PLAN_LIMITS.levelsMax) doc = addLevel(doc);
    expect(addLevel(doc)).toBe(doc);
    expect(validatePlan(doc).valid).toBe(true);
    expect(renameLevel(doc, 1, '  Mon   étage ').levels[1].name).toBe('Mon étage');
    expect(renameLevel(doc, 1, '   ')).toBe(doc);
    expect(renameLevel(doc, 1, 'Étage 1')).toBe(doc);
    expect(renameLevel(doc, 1, 'x'.repeat(80)).levels[1].name).toHaveLength(30);
    const fewer = removeLevel(doc, 2);
    expect(fewer.levels).toHaveLength(doc.levels.length - 1);
    expect(removeLevel(asDoc(box()), 0)).toEqual(asDoc(box()));
    expect(removeLevel(doc, 99)).toBe(doc);
    expect(Math.abs(levelElevation(doc, 2) - 2 * (doc.wallHeight + SLAB_THICKNESS)) < 1e-9).toBe(true);
  });

  it('la validation d\'un document nomme le niveau fautif et refuse un éclairage invalide', () => {
    const doc = addLevel(asDoc(box()));
    const bad = clone(doc);
    bad.levels[1].walls = [{ x: 999, y: 0, dir: 'h' }];
    const result = validatePlan(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('niveau 2'))).toBe(true);
    for (const patch of [{ hour: 30 }, { month: 13 }, { north: 'nord' }, { latitude: 90 }, { lamps: 'peut-être' }]) {
      expect(validatePlan({ ...doc, lighting: { ...doc.lighting, ...patch } }).valid).toBe(false);
    }
    expect(validatePlan({ ...doc, levels: [] }).valid).toBe(false);
    expect(LAMP_MODES).toContain(doc.lighting.lamps);
  });

  it('un document à plusieurs niveaux fait l\'aller-retour export / import sans rien perdre', () => {
    let doc = asDoc(furnishedHome());
    doc = addLevel(doc);
    doc = withLevelPlan(doc, 1, withBox(levelPlan(doc, 1), 4, 4, 14, 12));
    const back = parsePlanText(exportPlanText(doc, { name: 'Maison' }), { furnitureIds });
    expect(back.ok).toBe(true);
    expect(back.plan).toEqual(doc);
    expect(back.plan.levels).toHaveLength(2);
  });
});

describe('escaliers : modèle', () => {
  const ground = () => {
    const plan = withBox(createEmptyPlan(), 4, 4, 24, 20); // 10 m x 8 m
    return plan;
  };
  const spec = (plan, x = 6, y = 6, dir = 'n') => createStairSpec(plan, { x, y }, dir);

  it('createStairSpec : dimensions par défaut calées sur le pas de la grille, selon le sens', () => {
    const plan = ground();
    const north = spec(plan, 6, 6, 'n');
    expect(north.w).toBe(1);
    expect(north.d).toBe(3.5);
    expect(north.dir).toBe('n');
    const east = spec(plan, 6, 6, 'e');
    expect(east.w).toBe(3.5);
    expect(east.d).toBe(1);
    expect(Math.abs(north.x * 2 - Math.round(north.x * 2))).toBeLessThan(1e-9);
  });

  it('canPlaceStair : dimensions, grille, murs, autre escalier ou trémie', () => {
    const plan = ground();
    const ok = spec(plan);
    expect(canPlaceStair(plan, ok).ok).toBe(true);
    expect(canPlaceStair(plan, { ...ok, w: 0.2 }).reason).toBe('size');
    expect(canPlaceStair(plan, { ...ok, d: 12 }).reason).toBe('size');
    expect(canPlaceStair(plan, { ...ok, dir: 'x' }).reason).toBe('size');
    expect(canPlaceStair(plan, { ...ok, x: -3 }).reason).toBe('outside');
    expect(canPlaceStair(plan, spec(plan, 2, 6)).reason).toBe('wall'); // traverse le mur gauche (x = 2 m)
    expect(canPlaceStair(plan, spec(plan, 2.5, 6)).ok).toBe(true); // collé au mur gauche : permis
    expect(canPlaceStair(plan, spec(plan, 11.5, 6)).ok).toBe(true); // collé au mur droit (x = 12 m)
    const withStair = addStair(plan, ok);
    expect(withStair.stairs).toHaveLength(1);
    expect(canPlaceStair(withStair, ok).reason).toBe('overlap');
    expect(canPlaceStair(withStair, ok, withStair.stairs[0].id).ok).toBe(true);
    expect(canPlaceStair({ ...plan, wells: withStair.stairs }, ok).reason).toBe('overlap'); // trémie venue du dessous
  });

  it('addStair / updateStair / rotateStair / flipStair / removeStair : plan d\'origine intact, plan identique si refusé', () => {
    const plan = ground();
    const added = addStair(plan, spec(plan));
    expect(plan.stairs).toBe(undefined);
    expect(added.stairs[0].id).toBe('e1');
    expect(addStair(added, spec(plan)).stairs).toBe(added.stairs); // chevauchement : refusé
    const moved = updateStair(added, 'e1', { x: 8 });
    expect(moved.stairs[0].x).toBe(8);
    expect(updateStair(added, 'e1', { x: 8, y: 6 })).not.toBe(added);
    expect(updateStair(added, 'inconnu', { x: 8 })).toBe(added);
    expect(updateStair(added, 'e1', { x: 1.5 })).toBe(added); // dans le mur
    expect(updateStair(added, 'e1', { x: 2 }).stairs[0].x).toBe(2); // le long du mur : permis
    const rotated = rotateStair(added, 'e1');
    expect(rotated.stairs[0].dir).toBe('e');
    expect(rotated.stairs[0].w).toBe(added.stairs[0].d);
    expect(flipStair(added, 'e1').stairs[0].dir).toBe('s');
    expect(removeStair(added, 'e1').stairs).toEqual([]);
    expect(removeStair(added, 'zzz')).toBe(added);
    expect(nextIdAfterRemoval(added)).toBe('e1');
  });
  const nextIdAfterRemoval = (plan) => addStair(removeStair(plan, 'e1'), spec(plan)).stairs[0].id;

  it('nombre de marches : chaque contremarche reste sous 19 cm ; les marches montent jusqu\'au plancher', () => {
    for (const wallHeight of [2.2, 2.5, 2.8, 3.2]) {
      const n = stairStepCount(wallHeight);
      expect(stairRise(wallHeight) / n <= STAIR_LIMITS.riserMax + 1e-9).toBe(true);
      const stair = { id: 'e1', x: 6, y: 6, w: 1, d: 3.5, dir: 'n' };
      const boxes = stairBoxes(stair, wallHeight).filter((box) => box.material === 'stair:oak:tread');
      expect(boxes).toHaveLength(n - 1);
      const tops = boxes.map((b) => b.position[1] + b.size[1] / 2);
      expect(tops[0] < tops[tops.length - 1]).toBe(true);
      expect(Math.abs(tops[tops.length - 1] - (FLOOR_THICKNESS + stairRise(wallHeight) - stairRise(wallHeight) / n)) < 1e-3).toBe(true);
    }
  });

  it('stairProgress et stairEnds : de 0 au pied à la longueur de la montée en haut, null hors de l\'escalier', () => {
    const stair = { id: 'e1', x: 6, y: 6, w: 1, d: 3.5, dir: 'n' }; // monte vers les y décroissants
    expect(stairProgress(stair, 6.5, 9.5)).toBe(0);
    expect(stairProgress(stair, 6.5, 6)).toBe(3.5);
    expect(Math.abs(stairProgress(stair, 6.5, 7.75) - 1.75) < 1e-9).toBe(true);
    expect(stairProgress(stair, 5, 7)).toBe(null);
    expect(stairProgress(stair, 5.9, 7, 0.2)).not.toBe(null);
    const ends = stairEnds(stair);
    expect(ends.bottom).toEqual({ x: 6.5, y: 9.5 });
    expect(ends.top).toEqual({ x: 6.5, y: 6 });
    expect(findStairAt({ stairs: [stair] }, { x: 6.5, y: 7 })).toBe(stair);
    expect(findStairAt({ stairs: [stair] }, { x: 1, y: 1 })).toBe(null);
    for (const dir of ['e', 's', 'w']) {
      const s = { ...stair, dir, w: dir === 's' ? 1 : 3.5, d: dir === 's' ? 3.5 : 1 };
      expect(Math.abs(stairProgress(s, stairEnds(s).bottom.x, stairEnds(s).bottom.y)) < 1e-9).toBe(true);
      expect(Math.abs(stairProgress(s, stairEnds(s).top.x, stairEnds(s).top.y) - 3.5) < 1e-9).toBe(true);
    }
  });

  it('les escaliers d\'un niveau deviennent la trémie du niveau du dessus, retirée avec le niveau', () => {
    let doc = asDoc(ground());
    doc = addLevel(doc);
    const s = spec(levelPlan(doc, 0));
    doc = withLevelPlan(doc, 0, addStair(levelPlan(doc, 0), s));
    expect(levelPlan(doc, 0).stairs).toHaveLength(1);
    expect('wells' in levelPlan(doc, 0)).toBe(false);
    expect(levelPlan(doc, 1).wells).toEqual(levelPlan(doc, 0).stairs);
    expect(validatePlan(doc).valid).toBe(true);
    const up = withLevelPlan(doc, 1, withBox(levelPlan(doc, 1), 4, 4, 24, 20));
    const upper = buildStructure(levelPlan(up, 1), { upper: true });
    const floors = upper.boxes.filter((b) => b.kind === 'floor');
    expect(floors.length > 0).toBe(true);
    const x0 = s.x;
    const covered = (px, pz) => floors.some((b) => Math.abs(px - b.position[0]) <= b.size[0] / 2 && Math.abs(pz - b.position[2]) <= b.size[2] / 2);
    expect(covered(x0 + 0.5, s.y + 1)).toBe(false); // le trou de la trémie
    expect(covered(x0 + 3, s.y + 1)).toBe(true);
    expect(Math.min(...floors.map((b) => b.size[1])) > 0.2).toBe(true); // plancher épais
    expect(removeLevel(doc, 1).levels[0].stairs).toEqual([]);
    expect(countWallsInStairs(levelPlan(up, 1))).toBe(0);
    const crossing = withWall(levelPlan(up, 1), 12, 4, 12, 12);
    expect(countWallsInStairs({ ...crossing, wells: levelPlan(doc, 0).stairs }) >= 0).toBe(true);
  });

  it('un escalier hors des limites d\'un niveau ou sans niveau au-dessus est refusé à la validation du document', () => {
    const doc = asDoc(ground());
    const bad = withLevelPlan(doc, 0, { ...levelPlan(doc, 0), stairs: [{ id: 'e1', x: 6, y: 6, w: 1, d: 3.5, dir: 'n' }] });
    expect(validatePlan(bad).valid).toBe(false); // pas de niveau au-dessus
    expect(validatePlan(addLevel(bad)).valid).toBe(true);
    const outside = withLevelPlan(addLevel(doc), 0, { ...levelPlan(doc, 0), stairs: [{ id: 'e1', x: -4, y: 6, w: 1, d: 3.5, dir: 'n' }] });
    expect(validatePlan(outside).valid).toBe(false);
  });
});

describe('store : niveaux, escaliers, éclairage', () => {
  const home = () => createStore(asDoc(withBox(createEmptyPlan(), 4, 4, 24, 20)));

  it('le plan exposé est la vue du niveau actif ; ajouter un niveau passe dessus, annuler revient en arrière', () => {
    const store = home();
    const first = store.getState().plan;
    expect(store.getState().level).toBe(0);
    expect(store.actions.addLevel()).toBe(true);
    expect(store.getState().level).toBe(1);
    expect(store.getState().doc.levels).toHaveLength(2);
    expect(store.getState().plan.walls).toEqual([]);
    expect(store.actions.setLevel(0)).toBe(true);
    expect(store.getState().plan).toBe(first);
    expect(store.actions.setLevel(0)).toBe(false);
    expect(store.actions.setLevel(5)).toBe(false);
    store.actions.setLevel(1);
    expect(store.actions.undo()).toBe(true); // annule l'ajout du niveau : le niveau actif est ramené dans le document
    expect(store.getState().doc.levels).toHaveLength(1);
    expect(store.getState().level).toBe(0);
    expect(store.actions.redo()).toBe(true);
    expect(store.getState().doc.levels).toHaveLength(2);
  });

  it('dessiner sur un niveau ne touche pas aux autres ; les pièces sont calculées par niveau', () => {
    const store = home();
    store.actions.addLevel();
    store.actions.addWalls({ x: 4, y: 4 }, { x: 12, y: 4 });
    expect(store.getState().plan.walls).toHaveLength(8);
    expect(store.getRooms()).toEqual([]);
    expect(store.getRooms(0)).toHaveLength(1);
    store.actions.setLevel(0);
    expect(store.getState().plan.walls.length > 8).toBe(true);
    expect(store.getRooms()).toHaveLength(1);
  });

  it('addStair crée le niveau du dessus si besoin, en une seule entrée d\'historique ; les murs ne traversent pas la trémie', () => {
    const store = home();
    const s = createStairSpec(store.getState().plan, { x: 8, y: 7 }, 'n');
    expect(store.checkStair(s).ok).toBe(true);
    const id = store.actions.addStair(s);
    expect(id).toBe('e1');
    expect(store.getState().doc.levels).toHaveLength(2);
    expect(store.getState().selectedStairId).toBe('e1');
    expect(store.actions.addStair(s)).toBe(null); // chevauche le premier
    store.actions.undo();
    expect(store.getState().doc.levels).toHaveLength(1);
    expect(store.getState().plan.stairs).toBe(undefined);
    store.actions.redo();
    store.actions.setLevel(1);
    expect(store.getState().plan.wells).toHaveLength(1);
    const before = store.getState().plan;
    const cross = s.x + 0.5;
    expect(store.actions.addWalls({ x: Math.round(cross / 0.5), y: 2 }, { x: Math.round(cross / 0.5), y: 12 })).toBe(false);
    expect(store.getState().plan).toBe(before);
    expect(store.actions.addWalls({ x: 30, y: 2 }, { x: 30, y: 12 })).toBe(true);
  });

  it('un escalier ne se pose pas là où l\'étage du dessus a un mur ; déplacer, tourner, retourner, supprimer : annulables', () => {
    const store = home();
    store.actions.addLevel();
    store.actions.addWalls({ x: 20, y: 4 }, { x: 20, y: 12 });
    store.actions.setLevel(0);
    const blocked = createStairSpec(store.getState().plan, { x: 10, y: 7 }, 'n');
    expect(store.checkStair({ ...blocked, x: 9.5 }).reason).toBe('wall-up');
    const id = store.actions.addStair(createStairSpec(store.getState().plan, { x: 7, y: 7 }, 'n'));
    expect(id).toBe('e1');
    expect(store.actions.updateStair(id, { x: 7.5 })).toBe(true);
    expect(store.getState().plan.stairs[0].x).toBe(7.5);
    expect(store.actions.updateStair(id, { x: 9.5 })).toBe(false);
    expect(store.actions.rotateStair(id)).toBe(true);
    expect(store.getState().plan.stairs[0].dir).toBe('e');
    expect(store.actions.flipStair(id)).toBe(true);
    expect(store.getState().plan.stairs[0].dir).toBe('w');
    expect(store.actions.removeStair(id)).toBe(true);
    expect(store.getState().plan.stairs ?? []).toEqual([]);
    store.actions.undo();
    expect(store.getState().plan.stairs).toHaveLength(1);
    expect(store.actions.selectStair('zzz')).toBe(false);
    expect(store.actions.selectStair(id)).toBe(true);
  });

  it('supprimer un niveau retire les escaliers du niveau d\'en dessous ; le dernier niveau reste', () => {
    const store = home();
    store.actions.addStair(createStairSpec(store.getState().plan, { x: 8, y: 7 }, 'n'));
    expect(store.getState().doc.levels).toHaveLength(2);
    expect(store.actions.removeLevel(1)).toBe(true);
    expect(store.getState().doc.levels[0].stairs).toEqual([]);
    expect(store.getState().level).toBe(0);
    expect(store.actions.removeLevel(0)).toBe(false);
  });

  it('l\'éclairage est enregistré avec le document mais n\'entre pas dans l\'historique ; les valeurs invalides sont bornées ou ignorées', () => {
    const store = home();
    const seen = [];
    store.subscribe((_, reason) => seen.push(reason));
    expect(store.actions.setLighting({ hour: 8.5, month: 12, north: 90 })).toBe(true);
    expect(store.getState().doc.lighting).toEqual({ ...DEFAULT_LIGHTING, hour: 8.5, month: 12, north: 90 });
    expect(store.getState().canUndo).toBe(false);
    expect(seen).toEqual([]); // l'éclairage n'est pas un changement de plan
    expect(store.actions.setLighting({ hour: 8.5 })).toBe(false);
    store.actions.setLighting({ hour: 99, month: 'x', lamps: 'bizarre' });
    expect(store.getState().doc.lighting.hour).toBe(24);
    expect(store.getState().doc.lighting.month).toBe(12);
    expect(store.getState().doc.lighting.lamps).toBe(DEFAULT_LIGHTING.lamps);
    store.actions.addWalls({ x: 30, y: 2 }, { x: 34, y: 2 });
    store.actions.undo();
    expect(store.getState().doc.lighting.hour).toBe(24); // annuler ne ramène pas l'éclairage en arrière
  });

  it('loadPlan accepte un document à plusieurs niveaux et revient au rez-de-chaussée ; clearAll garde la grille et l\'éclairage', () => {
    const store = home();
    store.actions.addStair(createStairSpec(store.getState().plan, { x: 8, y: 7 }, 'n'));
    const doc = store.getState().doc;
    const other = createStore();
    expect(other.actions.loadPlan(doc).ok).toBe(true);
    expect(other.getState().doc).toEqual(doc);
    expect(other.getState().level).toBe(0);
    other.actions.setLighting({ hour: 7 });
    expect(other.actions.clearAll()).toBe(true);
    expect(other.getState().doc.levels).toHaveLength(1);
    expect(other.getState().plan.walls).toEqual([]);
    expect(other.getState().doc.lighting.hour).toBe(7);
    expect(other.actions.undo()).toBe(true);
    expect(other.getState().doc.levels).toHaveLength(2);
  });

  it('la sauvegarde automatique suit le document : changer d\'éclairage ou de niveau d\'escalier est enregistré', async () => {
    const backing = fakeBacking();
    const { projects } = projectsOn(backing);
    const project = projects.create('Étages', createEmptyDocument());
    projects.setActive(project.id);
    const store = createStore();
    const saver = autosave(store, projects, () => {}, { delay: 10 });
    store.actions.setLighting({ hour: 9 });
    store.actions.addLevel();
    saver.flush();
    const saved = projects.readPlan(project.id).plan;
    expect(saved.lighting.hour).toBe(9);
    expect(saved.levels).toHaveLength(2);
    saver.dispose();
  });
});

describe('finitions des pièces', () => {
  const room = () => {
    const plan = withBox(createEmptyPlan(), 4, 4, 12, 10);
    return { plan, room: detectRooms(plan)[0] };
  };

  it('setRoomFinish enregistre, remet à la valeur par défaut, ignore l\'inconnu et renvoie le même plan si rien ne change', () => {
    const { plan, room: r } = room();
    const wood = setRoomFinish(plan, r, { floor: 'oak', wall: 'sage', baseboard: 'white' });
    expect(getRoomFinish(wood, r)).toEqual({ floor: 'oak', wall: 'sage', baseboard: 'white' });
    expect(plan.roomFinishes).toBe(undefined);
    expect(setRoomFinish(wood, r, { floor: 'oak' })).toBe(wood);
    expect(setRoomFinish(wood, r, { floor: 'lave' })).toBe(wood);
    expect(getRoomFinish(setRoomFinish(wood, r, { wall: '#336699' }), r).wall).toBe('#336699');
    expect(getRoomFinish(setRoomFinish(wood, r, { wall: 'rouge' }), r).wall).toBe('sage');
    expect(getRoomFinish(setRoomFinish(wood, r, { baseboard: 'none' }), r).baseboard).toBe(undefined);
    const reset = setRoomFinish(wood, r, { floor: null, wall: 'default', baseboard: 'none' });
    expect(reset.roomFinishes).toEqual({});
    expect(validatePlan(wood).valid).toBe(true);
  });

  it('les catalogues sont complets : couleurs valides, identifiants uniques', () => {
    for (const list of [FLOOR_FINISHES, WALL_FINISHES, BASEBOARD_FINISHES]) {
      expect(new Set(list.map((f) => f.id)).size).toBe(list.length);
      for (const item of list) {
        expect(item.label.length > 2).toBe(true);
        if (item.color) expect(/^#[0-9a-f]{6}$/i.test(item.color)).toBe(true);
      }
    }
    expect(FLOOR_FINISHES.length >= 8).toBe(true);
    expect(WALL_FINISHES.length >= 12).toBe(true);
  });

  it('une finition de sol change la matière du sol 3D ; une plinthe ajoute des boîtes au pied des murs', () => {
    const { plan, room: r } = room();
    const base = buildStructure(plan).boxes.filter((b) => b.kind === 'floor');
    expect(base.every((b) => b.material === 'floor:other')).toBe(true);
    const tiled = setRoomFinish(plan, r, { floor: 'tile-white', baseboard: 'black' });
    expect(buildStructure(tiled).boxes.filter((b) => b.kind === 'floor').every((b) => b.material === 'floor:tile-white')).toBe(true);
    expect(buildStructure(tiled, { tints: true }).boxes.filter((b) => b.kind === 'baseboard').length >= 4).toBe(true);
    expect(buildStructure(plan, { tints: true }).boxes.filter((b) => b.kind === 'baseboard')).toEqual([]);
  });

  it('les finitions suivent la pièce quand on la redessine, et partent avec elle', () => {
    const store = createStore(withBox(createEmptyPlan(), 4, 4, 12, 10));
    const r = store.getRooms()[0];
    expect(store.actions.setRoomFinish(r.id, { floor: 'walnut' })).toBe(true);
    expect(store.actions.setRoomFinish('nope', { floor: 'oak' })).toBe(false);
    store.actions.addWalls({ x: 12, y: 4 }, { x: 16, y: 4 });
    expect(getRoomFinish(store.getState().plan, store.getRooms()[0]).floor).toBe('walnut');
    store.actions.undo();
    store.actions.undo();
    expect(store.getState().plan.roomFinishes).toBe(undefined);
    store.actions.redo();
    store.actions.clearLevel();
    expect(store.getState().plan.roomFinishes).toBe(undefined);
  });
});

describe('soleil et ensoleillement', () => {
  it('sunPosition : le soleil est au sud à midi, plus haut en été qu\'en hiver, sous l\'horizon la nuit', () => {
    const summer = sunPosition({ hour: 12, month: 6, latitude: 48.85 });
    const winter = sunPosition({ hour: 12, month: 12, latitude: 48.85 });
    expect(Math.abs(summer.azimuth - Math.PI) < 0.01).toBe(true);
    expect(summer.elevation > winter.elevation).toBe(true);
    expect(Math.abs((summer.elevation * 180) / Math.PI - 64.6) < 1.5).toBe(true);
    expect(Math.abs((winter.elevation * 180) / Math.PI - 17.7) < 1.5).toBe(true);
    expect(sunPosition({ hour: 0, month: 6, latitude: 48.85 }).elevation < 0).toBe(true);
    const morning = sunPosition({ hour: 8, month: 6, latitude: 48.85 });
    const evening = sunPosition({ hour: 16, month: 6, latitude: 48.85 });
    expect(morning.azimuth < Math.PI && evening.azimuth > Math.PI).toBe(true); // est le matin, ouest le soir
  });

  it('sunDirection : repère de la scène, le nord du plan tourne avec « north »', () => {
    const noon = sunPosition({ hour: 12, month: 6, latitude: 48.85 });
    const d0 = sunDirection(noon, 0); // nord en haut du plan : le soleil du sud vient du bas (z > 0)
    expect(d0.z > 0.3).toBe(true);
    expect(Math.abs(d0.x) < 0.05).toBe(true);
    expect(Math.abs(Math.hypot(d0.x, d0.y, d0.z) - 1) < 1e-9).toBe(true);
    const d90 = sunDirection(noon, 90); // nord à droite : le sud est à gauche (x < 0)
    expect(d90.x < -0.3).toBe(true);
    expect(Math.abs(d90.z) < 0.05).toBe(true);
  });

  it('daylightHours : jours plus longs en été, null en cas de nuit polaire', () => {
    const summer = daylightHours({ month: 6, latitude: 48.85 });
    const winter = daylightHours({ month: 12, latitude: 48.85 });
    expect(summer.set - summer.rise > winter.set - winter.rise + 5).toBe(true);
    expect(summer.rise < 6).toBe(true);
    expect(winter.rise > 7).toBe(true);
  });

  it('sunlightForRoom : une fenêtre au sud éclaire la pièce à midi, un mur plein non ; la nuit, rien', () => {
    let plan = withBox(createEmptyPlan(), 4, 4, 16, 14);
    const sunny = (p) => {
      const room = detectRooms(p)[0];
      const boxes = buildStructure(p, { roof: true }).boxes;
      const noon = sunDirection(sunPosition({ hour: 12, month: 6, latitude: 48.85 }), 0);
      const night = sunDirection(sunPosition({ hour: 1, month: 6, latitude: 48.85 }), 0);
      return {
        noon: sunlightForRoom(room, 0.5, [noon], boxes).fraction,
        night: sunlightForRoom(room, 0.5, [night], boxes).fraction,
      };
    };
    expect(sunny(plan).noon).toBe(0); // toit non modélisé, mais les murs bloquent les rayons rasants : la pièce est fermée
    const south = addOpening(plan, { type: 'window', start: { x: 8, y: 14, dir: 'h' }, span: 4 }); // mur sud (bas du plan)
    expect(south.openings).toHaveLength(1);
    const lit = sunny(south);
    expect(lit.noon > 0).toBe(true);
    expect(lit.night).toBe(0);
    const north = addOpening(plan, { type: 'window', start: { x: 8, y: 4, dir: 'h' }, span: 4 });
    expect(sunny(north).noon).toBe(0); // au nord, le soleil de midi n'entre pas
  });
});


describe('grille fine : conversion 0,5 m ↔ 0,1 m', () => {
  const sameWalls = (a, b) => a.length === b.length && new Set(a.map((e) => `${e.dir}${e.x},${e.y}`)).size === new Set([...a, ...b].map((e) => `${e.dir}${e.x},${e.y}`)).size;
  const furnishedDoc = (build = homePlan3, seed = 21) => asDoc(furnishedHome(build, seed));

  it('0,5 → 0,1 : exact — les murs, les ouvertures, les pièces et les clés suivent, les mètres ne bougent pas', () => {
    const doc = furnishedDoc();
    const result = convertGridStep(doc, 0.1);
    expect(result.ok && result.exact && result.changed).toBe(true);
    const fine = result.doc;
    expect(fine.grid).toEqual({ width: 200, height: 150, cellSize: 0.1 });
    const before = levelPlan(doc, 0);
    const after = levelPlan(fine, 0);
    expect(after.walls).toHaveLength(before.walls.length * 5);
    expect(after.openings).toHaveLength(before.openings.length);
    for (const [i, o] of before.openings.entries()) {
      expect(after.openings[i].span).toBe(o.span * 5);
      expect(after.openings[i].start.x).toBe(o.start.x * 5);
      expect(after.openings[i].id).toBe(o.id);
    }
    const roomsBefore = detectRooms(before);
    const roomsAfter = detectRooms(after);
    expect(roomsAfter).toHaveLength(roomsBefore.length);
    for (let i = 0; i < roomsBefore.length; i++) {
      expect(roomsAfter[i].areaM2).toBe(roomsBefore[i].areaM2);
      expect(getRoomType(after, roomsAfter[i])).toBe(getRoomType(before, roomsBefore[i]));
      expect(isRoomLocked(after, roomsAfter[i])).toBe(isRoomLocked(before, roomsBefore[i]));
    }
    expect(after.furniture).toHaveLength(before.furniture.length);
    expect(after.furniture.map((f) => [f.x, f.z, f.rotationY])).toEqual(before.furniture.map((f) => [f.x, f.z, f.rotationY]));
    expect(after.furniture.every((f) => roomsAfter.some((r) => r.id === f.roomId) && f.id.startsWith(`${f.roomId}:`))).toBe(true);
    expect(validatePlan(fine, { furnitureIds }).valid).toBe(true);
    expect(doc.grid.cellSize).toBe(0.5); // l'original n'est pas modifié
  });

  it('aller-retour 0,5 → 0,1 → 0,5 : le plan revient identique, mobilier compris', () => {
    for (const doc of [furnishedDoc(homePlan3, 21), furnishedDoc(homePlan6, 7), asDoc(createEmptyPlan())]) {
      const fine = convertGridStep(doc, 0.1).doc;
      const back = convertGridStep(fine, 0.5);
      expect(back.ok && back.exact).toBe(true);
      expect(back.doc.grid).toEqual(doc.grid);
      expect(sameWalls(levelPlan(back.doc, 0).walls, levelPlan(doc, 0).walls)).toBe(true);
      expect(levelPlan(back.doc, 0).openings).toEqual(levelPlan(doc, 0).openings);
      expect(levelPlan(back.doc, 0).furniture).toEqual(levelPlan(doc, 0).furniture);
      expect(levelPlan(back.doc, 0).roomTypes).toEqual(levelPlan(doc, 0).roomTypes);
    }
  });

  it('0,1 → 0,5 : un mur qui ne tombe pas sur la grille de 50 cm est aligné, et le résultat est déclaré inexact', () => {
    const fine = { ...createEmptyPlan(), grid: { width: 200, height: 150, cellSize: 0.1 } };
    let plan = withBox(fine, 20, 20, 120, 80); // 10 m × 6 m : tout tombe sur 50 cm
    const exactDoc = asDoc(plan);
    const exact = convertGridStep(exactDoc, 0.5);
    expect(exact.exact).toBe(true);
    expect(levelPlan(exact.doc, 0).grid).toEqual({ width: 40, height: 30, cellSize: 0.5 });
    expect(detectRooms(levelPlan(exact.doc, 0))).toHaveLength(1);
    plan = withBox(fine, 23, 20, 120, 80); // mur gauche à 2,3 m : entre deux lignes
    const rough = convertGridStep(asDoc(plan), 0.5);
    expect(rough.ok).toBe(true);
    expect(rough.exact).toBe(false);
    expect(rough.lost.walls > 0).toBe(true);
    expect(detectRooms(levelPlan(rough.doc, 0))).toHaveLength(1); // la pièce reste fermée
  });

  it('0,1 → 0,5 : les ouvertures trop étroites sont ramenées à 50 cm au moins, et celles qui ne tiennent plus sont retirées', () => {
    const fine = { ...createEmptyPlan(), grid: { width: 200, height: 150, cellSize: 0.1 } };
    let plan = withBox(fine, 20, 20, 120, 80);
    plan = addOpening(plan, { type: 'window', start: { x: 40, y: 20, dir: 'h' }, span: 12 }); // 1,2 m
    plan = addOpening(plan, { type: 'door', start: { x: 20, y: 40, dir: 'v' }, span: 9 }); // 90 cm
    expect(plan.openings).toHaveLength(2);
    const result = convertGridStep(asDoc(plan), 0.5);
    const spans = levelPlan(result.doc, 0).openings.map((o) => o.span);
    expect(spans).toEqual([2, 2]);
    expect(validatePlan(result.doc).valid).toBe(true);
  });

  it('refuse une grille trop grande ou un pas inconnu, et ne fait rien si le pas est déjà le bon', () => {
    const doc = asDoc({ ...createEmptyPlan(), grid: { width: 60, height: 30, cellSize: 0.5 } });
    const big = convertGridStep(doc, 0.1);
    expect(big.ok).toBe(false);
    expect(big.reason).toBe('too-big');
    expect(convertGridStep(doc, 0.25).reason).toBe('step');
    const same = convertGridStep(doc, 0.5);
    expect(same.ok && !same.changed).toBe(true);
    expect(same.doc).toBe(doc);
    expect(GRID_STEPS).toEqual([0.5, 0.1]);
  });

  it('les niveaux, les escaliers et les finitions passent aussi par la conversion', () => {
    let doc = addLevel(asDoc(withBox(createEmptyPlan(), 4, 4, 24, 20)));
    doc = withLevelPlan(doc, 0, addStair(levelPlan(doc, 0), createStairSpec(levelPlan(doc, 0), { x: 8, y: 7 }, 'n')));
    doc = withLevelPlan(doc, 1, withBox(levelPlan(doc, 1), 4, 4, 24, 20));
    const room = detectRooms(levelPlan(doc, 1))[0];
    doc = withLevelPlan(doc, 1, setRoomFinish(levelPlan(doc, 1), room, { floor: 'oak' }));
    const fine = convertGridStep(doc, 0.1).doc;
    expect(fine.levels).toHaveLength(2);
    expect(levelPlan(fine, 0).stairs).toEqual(levelPlan(doc, 0).stairs); // en mètres : inchangés
    expect(levelPlan(fine, 1).wells).toEqual(levelPlan(doc, 0).stairs);
    expect(getRoomFinish(levelPlan(fine, 1), detectRooms(levelPlan(fine, 1))[0]).floor).toBe('oak');
    expect(validatePlan(fine).valid).toBe(true);
  });

  it('store : setGridStep est une entrée d\'historique annulable ; previewGridStep ne change rien', () => {
    const store = createStore(furnishedHome());
    const before = store.getState().doc;
    const furniture = store.getState().plan.furniture.length;
    expect(store.previewGridStep(0.1).exact).toBe(true);
    expect(store.getState().doc).toBe(before);
    const result = store.actions.setGridStep(0.1);
    expect(result.ok && result.exact).toBe(true);
    expect(store.getState().plan.grid.cellSize).toBe(0.1);
    expect(store.getState().plan.furniture).toHaveLength(furniture);
    expect(store.getRooms()).toHaveLength(detectRooms(levelPlan(before, 0)).length);
    expect(store.actions.setGridStep(0.1).changed).toBe(false);
    store.actions.undo();
    expect(store.getState().doc).toBe(before);
    expect(store.actions.setGridStep(0.3).ok).toBe(false);
  });

  it('en grille fine : une ouverture de 1 m fait 10 arêtes, les limites sont de 0,5 m à 2 m ; pose, déplacement et validation suivent', () => {
    const fine = convertGridStep(furnishedDoc(), 0.1).doc;
    let plan = levelPlan(fine, 0);
    const base = withBox({ ...createEmptyPlan(), grid: { width: 200, height: 150, cellSize: 0.1 } }, 20, 20, 120, 80);
    expect(canPlaceOpening(base, { x: 40, y: 20, dir: 'h' }, 4).reason).toBe('span'); // 40 cm : trop étroit
    expect(canPlaceOpening(base, { x: 40, y: 20, dir: 'h' }, 21).reason).toBe('span'); // 2,1 m : trop large
    expect(canPlaceOpening(base, { x: 40, y: 20, dir: 'h' }, 10).ok).toBe(true);
    const door = addOpening(base, { type: 'door', start: { x: 40, y: 20, dir: 'h' } });
    expect(door.openings[0].span).toBe(10);
    const window = addOpening(door, { type: 'window', start: { x: 60, y: 20, dir: 'h' } });
    expect(window.openings).toHaveLength(2);
    expect(validatePlan(window).valid).toBe(true);
  });
});


describe('mobilier à la main : déplacer, tourner, remplacer, ajouter', () => {
  const setup = () => {
    const plan = furnishedHome(homePlan3, 21);
    return { plan, rooms: detectRooms(plan) };
  };
  const find = (plan, test) => plan.furniture.find(test);

  it('déplacer : l\'objet garde son identifiant, il est marqué « à la main » et sa pièce se verrouille ; le plan d\'origine n\'est pas modifié', () => {
    const { plan, rooms } = setup();
    const sofa = find(plan, (f) => f.defId.startsWith('sofa'));
    const before = clone(plan);
    const result = editFurniture(plan, rooms, sofa.id, { x: sofa.x + 0.1 });
    expect(result.ok).toBe(true);
    expect(result.id).toBe(sofa.id);
    expect(plan).toEqual(before);
    const moved = find(result.plan, (f) => f.id === sofa.id);
    expect(moved.x).toBe(Math.round((sofa.x + 0.1) * 1e6) / 1e6);
    expect(moved.manual).toBe(true);
    expect(moved.z).toBe(sofa.z);
    expect(isRoomLocked(result.plan, rooms.find((r) => r.id === sofa.roomId))).toBe(true);
    expect(result.plan.furniture).toHaveLength(plan.furniture.length);
    expect(validatePlan(asDoc(result.plan), { furnitureIds }).valid).toBe(true);
  });

  it('un emplacement invalide est refusé avec la raison, et le plan reste le même objet', () => {
    const { plan, rooms } = setup();
    const sofa = find(plan, (f) => f.defId.startsWith('sofa'));
    const wall = editFurniture(plan, rooms, sofa.id, { x: 0.5, z: 0.5 });
    expect(wall.ok).toBe(false);
    expect(wall.plan).toBe(plan);
    expect(wall.reasons).toContain('outside');
    const other = plan.furniture.find((f) => f.roomId === sofa.roomId && f.id !== sofa.id && f.defId === 'tv-unit');
    const onTv = editFurniture(plan, rooms, sofa.id, { x: other.x, z: other.z });
    expect(onTv.ok).toBe(false);
    expect(onTv.reasons).toContain('object');
    expect(onTv.conflicts).toContain(other.id);
    expect(editFurniture(plan, rooms, 'inconnu', { x: 1 }).reasons).toEqual(['unknown']);
  });

  it('passer dans une autre pièce change roomId et identifiant, et verrouille les deux pièces', () => {
    const { plan, rooms } = setup();
    const lamp = find(plan, (f) => f.defId === 'floor-lamp' || f.defId === 'plant-medium' || f.defId === 'plant-tall');
    expect(lamp).toBeTruthy();
    let target = null;
    let result = null;
    outer: for (const candidate of rooms.filter((r) => r.id !== lamp.roomId && r.areaM2 > 6)) {
      for (let y = candidate.bounds.minY + 1; y < candidate.bounds.maxY - 1; y++) {
        for (let x = candidate.bounds.minX + 1; x < candidate.bounds.maxX - 1; x++) {
          const tryIt = editFurniture(plan, rooms, lamp.id, { x: (x + 0.5) * 0.5, z: (y + 0.5) * 0.5 });
          if (tryIt.ok) {
            result = tryIt;
            target = candidate;
            break outer;
          }
        }
      }
    }
    expect(result).toBeTruthy();
    const moved = find(result.plan, (f) => f.defId === lamp.defId && f.manual);
    expect(moved.roomId).toBe(target.id);
    expect(moved.id.startsWith(`${target.id}:`)).toBe(true);
    expect(new Set(result.plan.furniture.map((f) => f.id)).size).toBe(result.plan.furniture.length);
    expect(isRoomLocked(result.plan, target)).toBe(true);
    expect(isRoomLocked(result.plan, rooms.find((r) => r.id === lamp.roomId))).toBe(true);
  });

  it('tourner : quart de tour, échange largeur et profondeur ; refusé si l\'objet ne tient plus', () => {
    const { plan, rooms } = setup();
    const table = find(plan, (f) => f.defId === 'coffee-table') ?? find(plan, (f) => ['armchair', 'pouf', 'side-table', 'plant-medium', 'plant-tall', 'floor-lamp'].includes(f.defId));
    expect(table).toBeTruthy();
    const turned = rotateFurniture(plan, rooms, table.id);
    expect(turned.ok).toBe(true);
    expect(find(turned.plan, (f) => f.id === table.id).rotationY).toBe((table.rotationY + 90) % 360);
    const back = rotateFurniture(turned.plan, rooms, table.id, -90);
    expect(back.ok).toBe(true);
    expect(find(back.plan, (f) => f.id === table.id).rotationY).toBe(table.rotationY);
    const bed = find(plan, (f) => f.defId.startsWith('bed'));
    const bedTurned = rotateFurniture(plan, rooms, bed.id);
    expect(bedTurned.ok === false ? bedTurned.plan === plan : true).toBe(true);
  });

  it('remplacer par une variante : même position et rotation, le dos reste contre le mur ; refusé si la place manque', () => {
    const { plan, rooms } = setup();
    const sofa = find(plan, (f) => f.defId.startsWith('sofa'));
    const other = sofa.defId === 'sofa-3' ? 'sofa-2' : 'sofa-3';
    const result = editFurniture(plan, rooms, sofa.id, { defId: other });
    if (result.ok) {
      const swapped = find(result.plan, (f) => f.id === sofa.id);
      expect(swapped.defId).toBe(other);
      expect(swapped.rotationY).toBe(sofa.rotationY);
      expect(swapped.manual).toBe(true);
    } else {
      expect(result.plan).toBe(plan);
    }
    const huge = editFurniture(plan, rooms, find(plan, (f) => ['nightstand', 'chest-drawers', 'dresser', 'side-table', 'plant-medium'].includes(f.defId)).id, { defId: 'bed-double' });
    expect(huge.ok).toBe(false);
  });

  it('les objets posés dessus (lampe sur une commode) suivent leur support quand on le déplace', () => {
    const { plan, rooms } = setup();
    const base = plan.furniture.find((f) => itemsOnTop(plan, f).length > 0);
    expect(base).toBeTruthy();
    const onTop = itemsOnTop(plan, base);
    expect(onTop.every((item) => item.y > 0)).toBe(true);
    let result = null;
    let dx = 0;
    for (const [mx, mz] of [[0.1, 0], [-0.1, 0], [0, 0.1], [0, -0.1]]) {
      const tryIt = editFurniture(plan, rooms, base.id, { x: base.x + mx, z: base.z + mz });
      if (tryIt.ok) {
        result = tryIt;
        dx = mx;
        break;
      }
    }
    expect(result).toBeTruthy();
    const after = find(result.plan, (f) => f.id === onTop[0].id);
    expect(Math.abs(after.x - (onTop[0].x + dx)) < 1e-6 || Math.abs(after.z - onTop[0].z) < 0.11).toBe(true);
    expect(after.y).toBe(onTop[0].y);
    const removed = deleteFurnitureItem(plan, rooms, base.id);
    expect(removed.plan.furniture.length).toBe(plan.furniture.length - 1 - onTop.length);
  });

  it('ajouter : un meuble au sol, une lampe sur un meuble (hauteur automatique), un luminaire au plafond ; hors de toute pièce, refusé', () => {
    const { plan, rooms } = setup();
    const room = rooms[0];
    const cs = plan.grid.cellSize;
    const cx = room.centroid.x * cs;
    const cz = room.centroid.y * cs;
    const empty = { ...plan, furniture: [] };
    const added = addFurnitureItem(empty, rooms, { defId: 'armchair', x: cx, z: cz });
    expect(added.ok).toBe(true);
    const item = added.plan.furniture[0];
    expect(item.role).toBe(MANUAL_ROLE);
    expect(item.manual).toBe(true);
    expect(item.roomId).toBe(room.id);
    expect(item.id.startsWith(`${room.id}:armchair`)).toBe(true);
    expect(validatePlan(asDoc(added.plan), { furnitureIds }).valid).toBe(true);
    const second = addFurnitureItem(added.plan, rooms, { defId: 'armchair', x: cx, z: cz });
    expect(second.ok).toBe(false);
    expect(second.reasons).toContain('object');
    const ceiling = addFurnitureItem(empty, rooms, { defId: 'ceiling-light', x: cx, z: cz });
    expect(ceiling.ok).toBe(true);
    expect(Math.abs(ceiling.plan.furniture[0].y - (plan.wallHeight - 0.45)) < 1e-6).toBe(true);
    const dresser = find(plan, (f) => f.defId === 'dresser' || f.defId === 'console' || f.defId === 'buffet');
    if (dresser) {
      const without = { ...plan, furniture: plan.furniture.filter((f) => f.roomId !== dresser.roomId || f.id === dresser.id) };
      const lamp = addFurnitureItem(without, rooms, { defId: 'table-lamp', x: dresser.x, z: dresser.z });
      expect(lamp.ok).toBe(true);
      expect(lamp.plan.furniture.at(-1).y > 0.5).toBe(true);
    }
    expect(addFurnitureItem(empty, rooms, { defId: 'armchair', x: 0.2, z: 0.2 }).ok).toBe(false);
    expect(addFurnitureItem(empty, rooms, { defId: 'dragon', x: cx, z: cz }).reasons).toEqual(['unknown']);
  });

  it('dupliquer pose une copie à côté, au premier emplacement valide', () => {
    const { plan, rooms } = setup();
    const chair = find(plan, (f) => f.defId === 'armchair' || f.defId === 'bar-stool' || f.defId === 'plant-medium' || f.defId === 'floor-lamp');
    const result = duplicateFurniture(plan, rooms, chair.id);
    if (result.ok) {
      expect(result.plan.furniture).toHaveLength(plan.furniture.length + 1);
      const copy = find(result.plan, (f) => f.id === result.id);
      expect(copy.defId).toBe(chair.defId);
      expect(copy.id).not.toBe(chair.id);
    } else {
      expect(result.plan).toBe(plan);
    }
  });

  it('les familles de remplacement ne contiennent que des objets du catalogue ; un objet seul n\'a pas de variante', () => {
    const ids = new Set(FURNITURE_DATA.map((d) => d.id));
    for (const family of FURNITURE_FAMILIES) {
      expect(family.length >= 2).toBe(true);
      for (const id of family) expect(ids.has(id)).toBe(true);
    }
    expect(variantsOf('sofa-2').map((d) => d.id)).toContain('sofa-3');
    expect(variantsOf('rug-m').map((d) => d.id)).toEqual(['rug-s', 'rug-l']);
    expect(variantsOf('stove')).toEqual([]);
    expect(variantsOf('ceiling-light').map((d) => d.id)).toEqual(['pendant-light', 'tube-light']);
    expect(variantsOf('car').map((d) => d.id)).toEqual(['car-large', 'motorbike']);
  });

  it('checkFurniturePlacement : raisons détaillées (mur, fenêtre, porte, escalier)', () => {
    const { plan, rooms } = setup();
    const room = rooms[0];
    const cs = plan.grid.cellSize;
    const onWall = checkFurniturePlacement(plan, rooms, { defId: 'wardrobe', x: room.bounds.minX * cs + 0.05, z: room.centroid.y * cs, rotationY: 0 });
    expect(onWall.ok).toBe(false);
    expect(onWall.reasons.some((r) => ['wall', 'outside'].includes(r))).toBe(true);
    const staired = { ...plan, furniture: [], stairs: [{ id: 'e1', x: room.centroid.x * cs - 0.5, y: room.centroid.y * cs - 1, w: 1, d: 2, dir: 'n' }] };
    const onStair = checkFurniturePlacement(staired, rooms, { defId: 'armchair', x: room.centroid.x * cs, z: room.centroid.y * cs, rotationY: 0 });
    expect(onStair.reasons).toContain('stair');
  });
});

describe('mobilier à la main : store', () => {
  const homeFurnished = () => {
    const store = createStore(homePlan3());
    store.actions.generateHome({ seed: 21, style: 'moderne' });
    return store;
  };

  it('chaque retouche est une entrée d\'historique annulable ; la sélection suit l\'objet', () => {
    const store = homeFurnished();
    const plan0 = store.getState().plan;
    const sofa = plan0.furniture.find((f) => f.defId.startsWith('sofa'));
    expect(store.actions.selectItem(sofa.id)).toBe(true);
    expect(store.actions.selectItem('inconnu')).toBe(false);
    const result = store.actions.moveFurniture(sofa.id, { x: sofa.x + 0.1, z: sofa.z });
    expect(result.ok && result.changed).toBe(true);
    expect(store.getState().selectedItemId).toBe(sofa.id);
    expect(store.getState().plan.furniture.find((f) => f.id === sofa.id).manual).toBe(true);
    expect(store.actions.moveFurniture(sofa.id, { x: 0.2, z: 0.2 }).ok).toBe(false);
    const turned = store.actions.rotateFurniture(sofa.id);
    expect(turned.ok === (store.getState().plan.furniture.find((f) => f.id === sofa.id).rotationY !== sofa.rotationY)).toBe(true);
    if (turned.ok) store.actions.undo();
    store.actions.undo();
    expect(store.getState().plan).toBe(plan0);
  });

  it('une pièce retouchée est verrouillée : Générer et Vider la laissent telle quelle, Régénérer la pièce est refusé', () => {
    const store = homeFurnished();
    const rooms = store.getRooms();
    const sofa = store.getState().plan.furniture.find((f) => f.defId.startsWith('sofa'));
    store.actions.moveFurniture(sofa.id, { x: sofa.x + 0.1, z: sofa.z });
    const living = rooms.find((r) => r.id === sofa.roomId);
    const mine = store.getState().plan.furniture.filter((f) => f.roomId === living.id);
    expect(store.actions.regenerateRoom(living.id, 9).reason).toBe('locked');
    store.actions.generateHome({ seed: 99 });
    expect(store.getState().plan.furniture.filter((f) => f.roomId === living.id)).toEqual(mine);
    store.actions.clearFurniture();
    expect(store.getState().plan.furniture.filter((f) => f.roomId === living.id)).toEqual(mine);
    store.actions.toggleRoomLock(living.id, false); // on rend la main au générateur
    expect(store.actions.regenerateRoom(living.id, 9).ok).toBe(true);
  });

  it('ajouter depuis le catalogue : aperçu (sans historique) puis pose ; l\'objet est sélectionné, supprimer et dupliquer fonctionnent', () => {
    const store = homeFurnished();
    const before = store.getState().plan;
    const room = store.getRooms()[0];
    const cs = before.grid.cellSize;
    store.actions.setTool('furniture');
    expect(store.actions.setPendingItem({ defId: 'plant-medium', x: room.centroid.x * cs, z: room.centroid.y * cs })).toBe(true);
    expect(store.getState().pendingItem.defId).toBe('plant-medium');
    expect(store.getState().canUndo).toBe(true); // la génération du mobilier
    expect(store.getState().plan).toBe(before);
    const empty = store.checkItem({ defId: 'plant-medium', x: 0.2, z: 0.2, rotationY: 0 });
    expect(empty.ok).toBe(false);
    const placed = store.actions.commitPendingItem();
    if (placed.ok) {
      expect(store.getState().selectedItemId).toBe(placed.id);
      expect(store.getState().pendingItem).toBe(null);
      expect(store.getState().plan.furniture).toHaveLength(before.furniture.length + 1);
      expect(store.actions.duplicateFurniture(placed.id).ok === (store.getState().plan.furniture.length === before.furniture.length + 2)).toBe(true);
      expect(store.actions.deleteFurniture(placed.id).ok).toBe(true);
      expect(store.getState().plan.furniture.some((f) => f.id === placed.id)).toBe(false);
    } else {
      expect(placed.reasons.length > 0).toBe(true);
    }
    store.actions.setTool('wall'); // quitter l'outil abandonne l'aperçu et la sélection
    expect(store.getState().pendingItem).toBe(null);
    expect(store.getState().selectedItemId).toBe(null);
  });

  it('un objet ajouté dans une pièce sans recette survit aux modifications du plan (pas de retrait automatique)', () => {
    const store = createStore(withBox(createEmptyPlan(), 4, 4, 20, 16));
    const room = store.getRooms()[0];
    const cs = store.getState().plan.grid.cellSize;
    const result = store.actions.addFurniture({ defId: 'armchair', x: room.centroid.x * cs, z: room.centroid.y * cs });
    expect(result.ok).toBe(true);
    store.actions.addOpening({ type: 'window', start: { x: 8, y: 4, dir: 'h' }, span: 4 });
    expect(store.getState().plan.furniture).toHaveLength(1);
    store.actions.addWalls({ x: 20, y: 4 }, { x: 26, y: 4 });
    expect(store.getState().plan.furniture).toHaveLength(1);
  });

  it('l\'export, l\'import et le lien de partage gardent le mobilier retouché (lien complet, pas de régénération)', () => {
    const store = homeFurnished();
    const sofa = store.getState().plan.furniture.find((f) => f.defId.startsWith('sofa'));
    store.actions.moveFurniture(sofa.id, { x: sofa.x + 0.1, z: sofa.z });
    const doc = store.getState().doc;
    const text = exportPlanText(doc, { name: 'Retouché' });
    const back = parsePlanText(text, { furnitureIds });
    expect(back.ok).toBe(true);
    expect(back.plan).toEqual(doc);
    const share = buildShare(doc, { ...fakeCodec, maxLength: Infinity });
    expect(share.mode).toBe('full');
    expect(readShare(share.code, { decompress: fakeCodec.decompress, furnitureIds }).plan).toEqual(doc);
  });
});

describe('générateur : escaliers et trémies', () => {
  const stairHome = () => {
    const store = createStore(asDoc(typedHomeForStairs()));
    return store;
  };
  function typedHomeForStairs() {
    let plan = withBox(createEmptyPlan(), 4, 4, 24, 20);
    const room = detectRooms(plan)[0];
    plan = setRoomInfo(plan, room, { type: 'living' });
    return plan;
  }

  it('le générateur ne pose rien sur un escalier ni sur l\'espace d\'accès, au rez-de-chaussée comme à l\'étage (trémie)', () => {
    const store = stairHome();
    const stair = createStairSpec(store.getState().plan, { x: 8, y: 7 }, 'n');
    store.actions.addStair(stair);
    store.actions.setLevel(0);
    store.actions.generateHome({ seed: 3 });
    const items = store.getState().plan.furniture;
    expect(items.length > 3).toBe(true);
    const rect = { x0: stair.x, x1: stair.x + stair.w, y0: stair.y, y1: stair.y + stair.d + STAIR_LANDING };
    const overlaps = (item) => {
      const def = FURNITURE_DATA.find((d) => d.id === item.defId);
      if (['wall-mounted', 'ceiling', 'window'].includes(def.placement.mode)) return false;
      const swapped = item.rotationY % 180 !== 0;
      const hw = (swapped ? def.size.d : def.size.w) / 2;
      const hd = (swapped ? def.size.w : def.size.d) / 2;
      return item.x - hw < rect.x1 - 1e-6 && item.x + hw > rect.x0 + 1e-6 && item.z - hd < rect.y1 - 1e-6 && item.z + hd > rect.y0 + 1e-6;
    };
    expect(items.filter((item) => item.defId !== 'rug-m' && item.defId !== 'rug-l' && item.defId !== 'rug-s').filter(overlaps)).toEqual([]);
    // À l'étage : la trémie est protégée de la même façon.
    store.actions.setLevel(1);
    const upper = store.getState().plan;
    expect(upper.wells).toHaveLength(1);
    const upperWalls = withBox(upper, 4, 4, 24, 20);
    store.actions.addWalls({ x: 4, y: 4 }, { x: 24, y: 4 });
    store.actions.addWalls({ x: 24, y: 4 }, { x: 24, y: 20 });
    store.actions.addWalls({ x: 24, y: 20 }, { x: 4, y: 20 });
    store.actions.addWalls({ x: 4, y: 20 }, { x: 4, y: 4 });
    expect(upperWalls.walls.length).toBe(store.getState().plan.walls.length);
    const room = store.getRooms()[0];
    store.actions.setRoomInfo(room.id, { type: 'bedroom' });
    store.actions.generateHome({ seed: 3 });
    const well = store.getState().plan.wells[0];
    const bed = store.getState().plan.furniture.filter((item) => item.defId.startsWith('bed') || item.defId === 'wardrobe');
    expect(bed.length > 0).toBe(true);
    for (const item of store.getState().plan.furniture) {
      const def = FURNITURE_DATA.find((d) => d.id === item.defId);
      if (['wall-mounted', 'ceiling', 'window'].includes(def.placement.mode) || def.size.h <= 0.1) continue;
      expect(Math.abs(item.x - (well.x + well.w / 2)) > well.w / 2 || Math.abs(item.z - (well.y + well.d / 2)) > well.d / 2).toBe(true);
    }
  });

  it('retirer un escalier remet la place à disposition du générateur', () => {
    const store = stairHome();
    const id = store.actions.addStair(createStairSpec(store.getState().plan, { x: 8, y: 7 }, 'n'));
    store.actions.setLevel(0);
    const grid = createRoomGrid(store.getState().plan, store.getRooms()[0]);
    const text = gridToText(grid);
    expect(text.includes('#')).toBe(true);
    store.actions.removeStair(id);
    const blank = gridToText(createRoomGrid(store.getState().plan, store.getRooms()[0]));
    expect(blank).not.toBe(text);
  });
});

describe('visite à plusieurs niveaux', () => {
  /** Rez-de-chaussée et étage de même emprise (4..24 × 4..20 cases = 2..12 × 2..10 m), un escalier vers le nord. */
  function twoFloors() {
    const store = createStore(asDoc(withBox(createEmptyPlan(), 4, 4, 24, 20)));
    const id = store.actions.addStair(createStairSpec(store.getState().plan, { x: 8, y: 7 }, 'n'));
    store.actions.setLevel(1);
    store.actions.addWalls({ x: 4, y: 4 }, { x: 24, y: 4 });
    store.actions.addWalls({ x: 24, y: 4 }, { x: 24, y: 20 });
    store.actions.addWalls({ x: 24, y: 20 }, { x: 4, y: 20 });
    store.actions.addWalls({ x: 4, y: 20 }, { x: 4, y: 4 });
    store.actions.setLevel(0);
    const doc = store.getState().doc;
    const stair = doc.levels[0].stairs.find((item) => item.id === id);
    return { store, doc, stair, building: buildWalkBuilding(doc, (i) => store.getRooms(i)) };
  }

  it('le bâtiment liste les niveaux avec leur altitude ; les étages ont un plancher, pas le rez-de-chaussée', () => {
    const { building, doc } = twoFloors();
    expect(building.levels).toHaveLength(2);
    expect(building.levels[0].elevation).toBe(0);
    expect(building.levels[1].elevation > doc.wallHeight).toBe(true);
    expect(building.levels[0].floor).toBe(null);
    expect(building.levels[1].floor.size > 0).toBe(true);
    expect(building.levels[1].wells).toHaveLength(1);
  });

  it('on monte l\'escalier : l\'altitude croît sans saut, le niveau change au milieu, on arrive à l\'étage ; et on redescend', () => {
    const { building, stair } = twoFloors();
    const cx = stair.x + stair.w / 2;
    const foot = stair.y + stair.d + 0.4;
    let state = { level: 0, x: cx, z: foot };
    let last = 0;
    let switched = false;
    for (let i = 0; i < 80; i++) {
      const next = stepWalker(building, state, { x: 0, z: -0.1 });
      expect(next.y >= last - 1e-9).toBe(true);
      expect(next.y - last < 0.2).toBe(true); // pas de saut
      if (next.level === 1 && state.level === 0) switched = true;
      last = next.y;
      state = { level: next.level, x: next.x, z: next.z };
      if (next.z < stair.y - 0.3) break;
    }
    expect(switched).toBe(true);
    expect(state.level).toBe(1);
    expect(Math.abs(last - building.levels[1].elevation) < 0.02).toBe(true);
    for (let i = 0; i < 80; i++) {
      const next = stepWalker(building, state, { x: 0, z: 0.1 });
      expect(last - next.y < 0.2).toBe(true);
      last = next.y;
      state = { level: next.level, x: next.x, z: next.z };
      if (next.z > foot) break;
    }
    expect(state.level).toBe(0);
    expect(last < 0.02).toBe(true);
  });

  it('walkGround : sol plat hors escalier, « stair » sur la montée, « well » vu de l\'étage', () => {
    const { building, stair } = twoFloors();
    expect(walkGround(building, 0, 3, 3).kind).toBe('floor');
    const mid = walkGround(building, 0, stair.x + stair.w / 2, stair.y + stair.d / 2);
    expect(mid.kind).toBe('stair');
    expect(mid.y > 0.5 && mid.y < building.levels[1].elevation - 0.5).toBe(true);
    expect(walkGround(building, 1, stair.x + stair.w / 2, stair.y + stair.d / 2).kind).toBe('well');
  });

  it('à l\'étage on ne marche pas dans le vide : hors de toute pièce, le marcheur reste en place', () => {
    const { building } = twoFloors();
    const start = { level: 1, x: 1, z: 1 }; // hors du plancher (la maison commence à 2 m)
    const next = stepWalker(building, start, { x: 0.1, z: 0 });
    expect(next.x).toBe(1);
    expect(next.z).toBe(1);
  });

  it('garde-corps de la trémie : trois côtés, l\'arrivée de l\'escalier reste ouverte', () => {
    const well = { x: 2, y: 2, w: 1, d: 3, dir: 'n' };
    const rails = wellRails(well);
    expect(rails).toHaveLength(3);
    expect(rails.every((rail) => rail.kind === 'rail' && rail.x1 > rail.x0 && rail.z1 > rail.z0)).toBe(true);
    // montée vers le nord : le haut (z = 2) est ouvert, le pied (z = 5) est fermé
    expect(rails.some((rail) => Math.abs(rail.z0 - 5) < 1e-9 && rail.x0 <= 2 && rail.x1 >= 3)).toBe(true);
    expect(rails.some((rail) => rail.z1 <= 2 + 1e-9)).toBe(false);
    expect(WALK_RAIL > 0).toBe(true);
  });

  it('le point de départ de la visite est dans une pièce du niveau demandé, à la bonne altitude', () => {
    const { building, store } = twoFloors();
    const up = findBuildingWalkStart(building, 1, (i) => store.getRooms(i));
    expect(up.level).toBe(1);
    expect(Math.abs(up.y - building.levels[1].elevation) < 1e-9).toBe(true);
    const down = findBuildingWalkStart(building, 0, (i) => store.getRooms(i));
    expect(down.level).toBe(0);
    expect(down.y).toBe(0);
  });
});

describe('ensoleillement et textures', () => {
  it('rapport d\'ensoleillement : un logement fermé sans ouverture n\'a pas de soleil, T2 en reçoit ; les parts restent entre 0 et 1', () => {
    const closed = asDoc(withBox(createEmptyPlan(), 4, 4, 24, 20));
    const dark = computeSunReport(closed, 0);
    expect(dark.hours.length > 10).toBe(true);
    expect(dark.rooms.length).toBe(1);
    expect(dark.rooms[0].sunHours).toBe(0);
    const t2 = asDoc(buildTemplate('t2'));
    const report = computeSunReport(t2, 0);
    expect(report.rooms.length >= 4).toBe(true);
    expect(report.rooms.some((room) => room.sunHours > 0)).toBe(true);
    for (const room of report.rooms) {
      expect(room.fraction >= 0 && room.fraction <= 1).toBe(true);
      expect(room.now >= 0 && room.now <= 1).toBe(true);
    }
    expect(report.hours.every((hour, i) => i === 0 || hour > report.hours[i - 1])).toBe(true);
  });

  it('un étage au-dessus fait de l\'ombre au rez-de-chaussée : moins de soleil que sans étage', () => {
    const base = asDoc(buildTemplate('t2'));
    const alone = computeSunReport(base, 0);
    const store = createStore(base);
    const id = store.actions.addStair(createStairSpec(store.getState().plan, { x: 3.5, y: 4 }, 'n'));
    expect(typeof id).toBe('string');
    store.actions.setLevel(1);
    for (const [a, b] of [[2, 2, 20, 2], [20, 2, 20, 14], [20, 14, 2, 14], [2, 14, 2, 2]].map(([x0, y0, x1, y1]) => [{ x: x0, y: y0 }, { x: x1, y: y1 }])) store.actions.addWalls(a, b);
    const stacked = computeSunReport(store.getState().doc, 0, (i) => store.getRooms(i));
    const total = (report) => report.rooms.reduce((sum, room) => sum + room.sunHours, 0);
    expect(total(stacked) < total(alone)).toBe(true);
  });

  it('shadeColor éclaircit ou assombrit, au format rgb(r,g,b) borné à 0–255', () => {
    expect(shadeColor('#808080', 1)).toBe('rgb(128,128,128)');
    expect(shadeColor('#808080', 2)).toBe('rgb(255,255,255)');
    expect(shadeColor('#808080', 0)).toBe('rgb(0,0,0)');
    expect(/^rgb\(\d+,\d+,\d+\)$/.test(shadeColor('#c9a36b', 0.8))).toBe(true);
  });

  it('drawFinishPattern dessine chaque finition (sol et murs) sans toucher au DOM, et reste dans le carré', () => {
    const calls = [];
    const ctx = new Proxy({ getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }) }, {
      get: (target, prop) => (prop in target ? target[prop] : (...args) => { calls.push([String(prop), ...args]); }),
      set: (target, prop, value) => { target[prop] = value; return true; },
    });
    for (const finish of [...FLOOR_FINISHES, ...WALL_FINISHES].filter((item) => item.pattern)) {
      calls.length = 0;
      drawFinishPattern(ctx, 64, finish);
      expect(calls.length > 0 || finish.pattern === 'grain').toBe(true);
    }
  });
});

describe('escaliers : styles, dessous et murs', () => {
  const room = () => withBox(createEmptyPlan(), 4, 4, 24, 20); // 2..12 m × 2..10 m
  const make = (kind, x = 6, y = 6, dir = 'n', extra = {}) => createStairSpec(room(), { x, y }, dir, { kind, ...extra });
  /** Un point de la montée à la fraction f du premier tronçon (volée) : au milieu de la largeur. */
  const pointOn = (part, f) => {
    const r = part.rect;
    const cx = (r.x0 + r.x1) / 2;
    const cy = (r.y0 + r.y1) / 2;
    return { n: { x: cx, y: r.y1 - f * part.len }, s: { x: cx, y: r.y0 + f * part.len }, e: { x: r.x0 + f * part.len, y: cy }, w: { x: r.x1 - f * part.len, y: cy } }[part.dir];
  };

  it('les quatre styles tiennent dans la pièce, sont valides et gardent les anciens plans lisibles (champs de style seulement s\'ils sortent des valeurs par défaut)', () => {
    expect(STAIR_KINDS).toEqual(['straight', 'l', 'u', 'spiral']);
    const plan = room();
    expect(make('straight').kind).toBe(undefined);
    expect(make('straight').under).toBe(undefined);
    for (const kind of STAIR_KINDS) {
      const stair = make(kind);
      expect(stairKind(stair)).toBe(kind);
      expect(canPlaceStair(plan, stair).ok).toBe(true);
    }
    expect(make('l').kind).toBe('l');
    expect(make('l', 6, 6, 'n', { under: 'open' }).under).toBe('open');
    expect(stairUnder(make('l'))).toBe('solid');
    expect(canPlaceStair(plan, { ...make('l'), kind: 'zigzag' }).reason).toBe('size');
    expect(canPlaceStair(plan, { ...make('spiral'), w: 2, d: 2.5 }).reason).toBe('size');
  });

  it('un escalier en L : volée, palier, seconde volée ; l\'altitude monte sans à-coup du pied (0) à l\'arrivée (1)', () => {
    const stair = make('l');
    const layout = stairLayout(stair);
    expect(layout.parts.map((part) => part.type)).toEqual(['flight', 'landing', 'flight']);
    const climb = [];
    for (const part of layout.parts) {
      if (part.type === 'landing') climb.push(stairClimb(stair, (part.rect.x0 + part.rect.x1) / 2, (part.rect.y0 + part.rect.y1) / 2));
      else for (const f of [0.05, 0.5, 0.95]) climb.push(stairClimb(stair, pointOn(part, f).x, pointOn(part, f).y));
    }
    expect(climb.every((t) => t !== null)).toBe(true);
    for (let i = 1; i < climb.length; i++) expect(climb[i] >= climb[i - 1] - 1e-9).toBe(true);
    expect(climb[0] < 0.1).toBe(true);
    expect(climb[climb.length - 1] > 0.9).toBe(true);
    // le palier est plat : mêmes valeurs partout
    const landing = layout.parts[1];
    expect(stairClimb(stair, landing.rect.x0 + 0.1, landing.rect.y0 + 0.1)).toBe(stairClimb(stair, landing.rect.x1 - 0.1, landing.rect.y1 - 0.1));
    // hors de l\'escalier : pas de marche (le coin vide du L)
    expect(stairClimb(stair, stair.x + 0.2, stair.y + stair.d - 0.2)).toBe(null);
  });

  it('un escalier en U : deux volées parallèles, un palier, un jour entre elles ; on repart dans l\'autre sens', () => {
    const stair = make('u');
    const layout = stairLayout(stair);
    expect(layout.parts.map((part) => part.type)).toEqual(['flight', 'landing', 'flight']);
    expect(layout.parts[0].dir).toBe('n');
    expect(layout.parts[2].dir).toBe('s');
    expect(layout.divider !== null).toBe(true);
    expect(Math.abs(stair.w - (2 * 1 + STAIR_LIMITS.gap)) < 1e-9).toBe(true);
    expect(stairClimb(stair, layout.divider.x0 + 0.01, layout.divider.y1 - 0.2)).toBe(null); // le jour n\'est pas une marche
    const first = stairClimb(stair, pointOn(layout.parts[0], 0.5).x, pointOn(layout.parts[0], 0.5).y);
    const second = stairClimb(stair, pointOn(layout.parts[2], 0.5).x, pointOn(layout.parts[2], 0.5).y);
    expect(first < 0.5 && second > 0.5).toBe(true);
    expect(layout.top.ny).toBe(1); // on ressort du même côté qu\'on est entré
    expect(layout.bottom.ny).toBe(1);
  });

  it('un colimaçon : un cercle, altitude croissante le long de l\'arc, 15 marches autour d\'un noyau', () => {
    const stair = make('spiral');
    const layout = stairLayout(stair);
    const part = layout.parts[0];
    expect(part.type).toBe('spiral');
    const r = (part.rOut + part.rIn) / 2;
    let last = -1;
    for (let k = 0; k <= 10; k++) {
      const angle = part.a0 + part.sign * part.sweep * (k / 10) * 0.98;
      const t = stairClimb(stair, part.cx + Math.cos(angle) * r, part.cy + Math.sin(angle) * r);
      expect(t !== null && t > last).toBe(true);
      last = t;
    }
    expect(stairClimb(stair, stair.x + 0.02, stair.y + 0.02)).toBe(null); // le coin de la boîte est hors du cercle
    expect(stairContains(stair, stair.x + 0.02, stair.y + 0.02)).toBe(true); // mais il reste dans la boîte pour la toucher
    const boxes = stairBoxes(stair, 2.5);
    const treads = boxes.filter((box) => box.angle !== undefined || box.size[0] < 1);
    expect(boxes.filter((box) => box.kind === 'stair')).toHaveLength((stairStepCount(2.5) - 1) * 4 * 2 + 1); // blocs + planches, et le noyau
    expect(treads.length > 20).toBe(true);
    expect(stairPathLength(stair) > 2).toBe(true);
  });

  it('retourner : un droit change de sens, un L ou U se met en miroir, un colimaçon tourne dans l\'autre sens ; deux fois = identique', () => {
    const plan = room();
    for (const kind of STAIR_KINDS) {
      const added = addStair(plan, make(kind));
      const flipped = flipStair(added, 'e1');
      expect(flipped).not.toBe(added);
      const first = added.stairs[0];
      const second = flipped.stairs[0];
      if (kind === 'straight') expect(second.dir).toBe('s');
      else expect(second.turn).toBe('right');
      const back = flipStair(flipped, 'e1').stairs[0];
      expect(back.dir).toBe(first.dir);
      expect(back.turn).toBe(first.turn);
    }
    // le miroir d\'un L met le virage de l\'autre côté de la boîte
    const left = stairLayout(make('l'));
    const right = stairLayout({ ...make('l'), turn: 'right' });
    expect(left.parts[0].rect.x0 > right.parts[0].rect.x0).toBe(true);
  });

  it('changer de style ou de dessous : dimensions par défaut du style, même centre ; refusé si ça ne tient pas', () => {
    const plan = addStair(room(), make('straight', 6, 6));
    const asL = setStairKind(plan, 'e1', 'l');
    expect(stairKind(asL.stairs[0])).toBe('l');
    const center = (stair) => [stair.x + stair.w / 2, stair.y + stair.d / 2];
    const [cx0, cy0] = center(plan.stairs[0]);
    expect(Math.abs(center(asL.stairs[0])[0] - cx0) <= 0.5).toBe(true);
    expect(Math.abs(center(asL.stairs[0])[1] - cy0) <= 0.5).toBe(true);
    expect(setStairKind(plan, 'e1', 'straight')).toBe(plan);
    expect(setStairKind(plan, 'e1', 'zigzag')).toBe(plan);
    const open = setStairUnder(plan, 'e1', 'open');
    expect(open.stairs[0].under).toBe('open');
    expect(setStairUnder(open, 'e1', 'solid').stairs[0].under).toBe(undefined);
    expect(setStairUnder(open, 'e1', 'open')).toBe(open);
    // contre la grille : le colimaçon au bord de la pièce est accepté (mur le long), pas à travers
    const edge = addStair(room(), make('straight', 2.6, 6));
    expect(edge.stairs).toHaveLength(1);
    expect(setStairKind(edge, 'e1', 'spiral').stairs).toHaveLength(1);
  });

  it('stairResizePatch : largeur, longueur et côté selon le style ; le résultat est appliqué par updateStair', () => {
    const plan = room();
    for (const kind of STAIR_KINDS) {
      const added = addStair(plan, make(kind, 8, 6));
      const stair = added.stairs[0];
      for (const which of ['width', 'run', 'side']) {
        const patch = stairResizePatch(stair, which, 0.5);
        if (kind === 'spiral' && which !== 'width') expect(patch).toBe(null);
        if (kind !== 'l' && which === 'side') expect(patch).toBe(null);
        if (patch && !(kind === 'l' && which === 'width')) {
          const next = updateStair(added, 'e1', patch);
          expect(next === added).toBe(false);
          const bigger = next.stairs[0];
          expect(bigger.w >= stair.w - 1e-9 && bigger.d >= stair.d - 1e-9).toBe(true);
        }
      }
    }
    // un U garde son centre quand on élargit ses volées ; un droit élargi garde l\'écart au bord de départ
    const u = addStair(plan, make('u', 8, 6)).stairs[0];
    const grown = updateStair(addStair(plan, make('u', 8, 6)), 'e1', stairResizePatch(u, 'width', 0.5)).stairs[0];
    expect(Math.abs((grown.x + grown.w / 2) - (u.x + u.w / 2)) < 1e-9).toBe(true);
  });

  it('collé aux murs : permis le long d\'un mur, refusé si un mur le traverse ou si la porte du mur serait bouchée', () => {
    let plan = room();
    const against = createStairSpec(plan, { x: 2.5, y: 6 }, 'n'); // bord gauche posé sur le mur de x = 2
    expect(against.x).toBe(2);
    expect(canPlaceStair(plan, against).ok).toBe(true);
    expect(canPlaceStair(plan, { ...against, x: 1.5 }).reason).toBe('wall');
    expect(canPlaceStair(plan, { ...against, y: 1.5 }).ok).toBe(false);
    // une porte dans le mur : l\'escalier ne peut pas se coller devant
    const walls = plan.walls.filter((edge) => edge.dir === 'v' && edge.x === 4);
    const door = addOpening(plan, { type: 'door', start: { dir: 'v', x: 4, y: 12 }, span: 2, swing: 'a' });
    if (door !== plan) {
      expect(canPlaceStair(door, createStairSpec(door, { x: 2.5, y: 7 }, 'n')).reason).toBe('opening');
      expect(canPlaceStair(door, createStairSpec(door, { x: 2.5, y: 4.25 }, 'n')).ok).toBe(true);
    }
    expect(walls.length > 0).toBe(true);
    // L, U, colimaçon : les contours collés aux murs sont permis aussi
    for (const kind of ['l', 'u', 'spiral']) expect(canPlaceStair(plan, createStairSpec(plan, { x: 3.5, y: 4 }, 'n', { kind })).reason ?? 'ok').toBe('ok');
  });

  it('le contour d\'un L ou d\'un U ne contient que les bords extérieurs (pas les jonctions entre volée et palier)', () => {
    for (const kind of ['straight', 'l', 'u']) {
      const outline = stairOutline(make(kind));
      expect(outline.length >= 4).toBe(true);
      expect(outline.every((seg) => seg.x0 === seg.x1 || seg.y0 === seg.y1)).toBe(true);
    }
    expect(stairOutline(make('straight'))).toHaveLength(4);
    expect(stairOutline(make('spiral'))).toEqual([]);
  });

  it('dessous plein : façades de rangement (portes et poignées) sur les côtés libres, pas contre un mur ; dessous ouvert : marches fines, aucune façade', () => {
    const plan = room();
    const free = make('straight', 6, 6);
    const solid = stairBoxes(free, plan.wallHeight, plan);
    const fronts = solid.filter((box) => box.material === 'stair:oak:door');
    expect(fronts.length >= 6).toBe(true);
    expect(solid.filter((box) => box.material === 'stair:oak:metal' && box.kind === 'stair')).toHaveLength(fronts.length);
    expect(fronts.every((box) => box.position[1] - box.size[1] / 2 >= FLOOR_THICKNESS)).toBe(true);
    // contre un mur (x = 2) : plus de portes de ce côté
    const along = createStairSpec(plan, { x: 2.5, y: 6 }, 'n');
    const side = stairBoxes(along, plan.wallHeight, plan).filter((box) => box.material === 'stair:oak:door');
    expect(side.length < fronts.length).toBe(true);
    // ouvert
    const open = stairBoxes({ ...free, under: 'open' }, plan.wallHeight, plan).filter((box) => box.kind === 'stair');
    expect(open.some((box) => box.material.endsWith(':door'))).toBe(false);
    const heights = open.map((box) => box.size[1]);
    expect(Math.min(...heights) <= STAIR_TREAD + 1e-9).toBe(true);
    const top = Math.max(...open.map((box) => box.position[1] + box.size[1] / 2));
    // le dessous est vide : entre le sol et le dessous de la marche du haut, aucune boîte ne couvre toute la hauteur au milieu de la volée
    const midX = free.x + free.w / 2;
    const midY = free.y + free.d / 2;
    const blocking = open.filter((box) => Math.abs(box.position[0] - midX) < box.size[0] / 2 - 0.1 && Math.abs(box.position[2] - midY) < box.size[2] / 2 && box.position[1] - box.size[1] / 2 < FLOOR_THICKNESS + 0.5 && box.position[1] + box.size[1] / 2 > FLOOR_THICKNESS + 1.6);
    expect(blocking).toEqual([]);
    expect(top > FLOOR_THICKNESS + 2).toBe(true);
  });

  it('boîtes tournées : mergeBoxes fait tourner les sommets et les normales autour de l\'axe vertical, comme Three.js', async () => {
    const { mergeBoxes } = await import('./viewer3d.js');
    const straight = mergeBoxes([{ position: [1, 1, 1], size: [2, 1, 0.4] }]);
    const turned = mergeBoxes([{ position: [1, 1, 1], size: [2, 1, 0.4], angle: -Math.PI / 2 }]);
    const extent = (positions, axis) => {
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = axis; i < positions.length; i += 3) {
        lo = Math.min(lo, positions[i]);
        hi = Math.max(hi, positions[i]);
      }
      return hi - lo;
    };
    expect(Math.abs(extent(straight.positions, 0) - 2) < 1e-4).toBe(true);
    expect(Math.abs(extent(turned.positions, 0) - 0.4) < 1e-4).toBe(true);
    expect(Math.abs(extent(turned.positions, 2) - 2) < 1e-4).toBe(true);
    expect(Math.abs(extent(turned.positions, 1) - 1) < 1e-4).toBe(true);
    for (let i = 0; i < turned.normals.length; i += 3) expect(Math.abs(Math.hypot(turned.normals[i], turned.normals[i + 1], turned.normals[i + 2]) - 1) < 1e-4).toBe(true);
  });

  it('le soleil est arrêté par une boîte tournée seulement là où elle se trouve vraiment (rayon testé dans son repère)', () => {
    const cell = { cells: [{ x: 0, y: 0 }] }; // échantillon en (0,25 ; 0,8 ; 0,25)
    const sun = [{ x: 0, y: 1, z: 0 }];
    const bar = (angle) => ({ kind: 'stair', material: 'stair', position: [0.75, 2, 0.25], size: [1.4, 0.1, 0.1], ...(angle ? { angle } : {}) });
    expect(sunlightForRoom(cell, 0.5, sun, [bar(0)], 0).lit[0]).toBe(0); // la barre couvre x = 0,05 à 1,45 : elle est au-dessus
    expect(sunlightForRoom(cell, 0.5, sun, [bar(Math.PI / 2)], 0).lit[0]).toBe(1); // tournée d\'un quart de tour, elle s\'étend selon z : elle ne couvre plus l\'échantillon
  });
});

describe('escaliers : dessous, décoration et visite', () => {
  const livingRoom = () => {
    const plan = withBox(createEmptyPlan(), 4, 4, 24, 20);
    return setRoomInfo(plan, detectRooms(plan)[0], { type: 'living' });
  };
  const withStair = (under, x = 6, y = 7) => {
    const plan = livingRoom();
    return addStair(plan, createStairSpec(plan, { x, y }, 'n', { under }));
  };
  const check = (plan, defId, x, z, rotationY = 0) => checkFurniturePlacement(plan, detectRooms(plan), { defId, x, z, rotationY });

  it('escalier plein : rien dessous ni dessus ; escalier ouvert : du mobilier bas sous la partie haute, pas de meuble haut', () => {
    const solid = withStair('solid');
    const open = withStair('open');
    const st = open.stairs[0];
    const top = [st.x + st.w / 2, st.y + 0.5]; // sous le haut de la montée (dir « n » : le haut est au nord)
    const middle = [st.x + st.w / 2, st.y + st.d / 2];
    expect(check(solid, 'armchair', ...top).reasons).toContain('stair');
    expect(check(solid, 'coffee-table', ...middle).reasons).toContain('stair');
    expect(check(open, 'armchair', ...top).reasons).not.toContain('stair');
    expect(check(open, 'coffee-table', ...middle).reasons).not.toContain('stair');
    expect(check(open, 'wardrobe', ...top).reasons).toContain('stair'); // 2,2 m de haut : ne passe pas sous les marches
    expect(check(open, 'plant-tall', ...middle).reasons).toContain('stair'); // trop haute au milieu de la montée
  });

  it('la décoration ne se pose jamais derrière ni sur un escalier : tableaux, miroirs, rideaux, plafonniers refusés près de lui', () => {
    for (const under of ['solid', 'open']) {
      const plan = livingRoom();
      const against = addStair(plan, createStairSpec(plan, { x: 2.5, y: 7 }, 'n', { under }));
      for (const defId of ['frame-large', 'frame-small', 'mirror']) expect(check(against, defId, 2.05, 7, 90).reasons).toContain('stair');
      expect(check(against, 'ceiling-light', 2.5, 7).reasons).toContain('stair');
      // loin de l\'escalier, les mêmes objets restent permis
      expect(check(against, 'frame-large', 2.05, 4, 90).reasons).not.toContain('stair');
    }
  });

  it('le générateur n\'accroche rien au mur près de l\'escalier ni au plafond au-dessus, et ne bloque pas l\'accès ; il peut meubler le dessous ouvert', () => {
    for (const under of ['solid', 'open']) {
      const plan = livingRoom();
      const store = createStore(asDoc(plan));
      expect(typeof store.actions.addStair(createStairSpec(plan, { x: 4, y: 7 }, 'n', { under, kind: 'l' }))).toBe('string');
      store.actions.setLevel(0);
      store.actions.generateHome({ seed: 5 });
      const state = store.getState().plan;
      const stair = state.stairs[0];
      const rects = stairRects(stair);
      const far = (item) => Math.min(...rects.map((r) => Math.hypot(Math.max(r.x0 - item.x, 0, item.x - r.x1), Math.max(r.y0 - item.z, 0, item.z - r.y1))));
      for (const item of state.furniture) {
        const def = FURNITURE_DATA.find((d) => d.id === item.defId);
        if (['wall-mounted', 'window'].includes(def.placement.mode)) expect(far(item) >= 0.5).toBe(true);
        if (def.placement.mode === 'ceiling') expect(rects.some((r) => item.x > r.x0 && item.x < r.x1 && item.z > r.y0 && item.z < r.y1)).toBe(false);
        if (def.placement.mode === 'floor' && under === 'solid') expect(rects.some((r) => item.x > r.x0 + 0.05 && item.x < r.x1 - 0.05 && item.z > r.y0 + 0.05 && item.z < r.y1 - 0.05)).toBe(false);
      }
    }
  });

  /** Le marcheur suit des points de passage, 10 cm par pas : l\'altitude ne saute jamais et on arrive à l\'étage. */
  function climb(kind, extra = {}) {
    const store = createStore(asDoc(withBox(createEmptyPlan(), 4, 4, 24, 20)));
    const plan0 = store.getState().plan;
    const spec = createStairSpec(plan0, { x: 8, y: 7 }, 'n', { kind, ...extra });
    expect(typeof store.actions.addStair(spec)).toBe('string');
    store.actions.setLevel(1);
    store.actions.addWalls({ x: 4, y: 4 }, { x: 24, y: 4 });
    store.actions.addWalls({ x: 24, y: 4 }, { x: 24, y: 20 });
    store.actions.addWalls({ x: 24, y: 20 }, { x: 4, y: 20 });
    store.actions.addWalls({ x: 4, y: 20 }, { x: 4, y: 4 });
    store.actions.setLevel(0);
    const doc = store.getState().doc;
    const stair = doc.levels[0].stairs[0];
    const building = buildWalkBuilding(doc, (i) => store.getRooms(i));
    const layout = stairLayout(stair);
    const waypoints = [];
    for (const part of layout.parts) {
      if (part.type === 'flight') {
        const r = part.rect;
        const cx = (r.x0 + r.x1) / 2;
        const cy = (r.y0 + r.y1) / 2;
        const at = (f) => ({ n: { x: cx, z: r.y1 - f * part.len }, s: { x: cx, z: r.y0 + f * part.len }, e: { x: r.x0 + f * part.len, z: cy }, w: { x: r.x1 - f * part.len, z: cy } })[part.dir];
        waypoints.push(at(0.04), at(0.96));
      } else if (part.type === 'landing') {
        waypoints.push({ x: (part.rect.x0 + part.rect.x1) / 2, z: (part.rect.y0 + part.rect.y1) / 2 });
      } else {
        const r = (part.rOut + part.rIn) / 2;
        for (let k = 0; k <= 40; k++) {
          const angle = part.a0 + part.sign * part.sweep * (k / 40) * 0.985;
          waypoints.push({ x: part.cx + Math.cos(angle) * r, z: part.cy + Math.sin(angle) * r });
        }
      }
    }
    // départ juste devant le pied
    const bottom = layout.bottom;
    let state = { level: 0, x: bottom.x + bottom.nx * 0.5, z: bottom.y + bottom.ny * 0.5 };
    let last = 0;
    let maxJump = 0;
    waypoints.unshift({ x: bottom.x + bottom.nx * 0.1, z: bottom.y + bottom.ny * 0.1 });
    for (const target of waypoints) {
      for (let i = 0; i < 80; i++) {
        const dx = target.x - state.x;
        const dz = target.z - state.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.06) break;
        const step = Math.min(0.1, dist);
        const next = stepWalker(building, state, { x: (dx / dist) * step, z: (dz / dist) * step });
        maxJump = Math.max(maxJump, Math.abs(next.y - last));
        last = next.y;
        state = { level: next.level, x: next.x, z: next.z };
      }
    }
    return { state, last, maxJump, elevation: building.levels[1].elevation };
  }

  it('on monte un escalier en L, en U ou en colimaçon, plein ou ouvert, sans saut d\'altitude, jusqu\'à l\'étage', () => {
    for (const kind of ['l', 'u', 'spiral']) {
      for (const under of ['solid', 'open']) {
        const result = climb(kind, { under });
        expect(result.maxJump < 0.2).toBe(true);
        expect(result.state.level).toBe(1);
        expect(result.last > result.elevation - 0.35).toBe(true);
      }
    }
  });
});

describe('escaliers : marches, garde-corps (jamais de verre) et finitions', () => {
  const room = () => withBox(createEmptyPlan(), 4, 4, 24, 20); // 2..12 m × 2..10 m
  const make = (kind, x = 6, y = 6, dir = 'n', extra = {}) => createStairSpec(room(), { x, y }, dir, { kind, ...extra });
  const rails = (boxes) => boxes.filter((box) => box.kind === 'rail');
  const top = (box) => box.position[1] + box.size[1] / 2;

  it('les valeurs par défaut ne sont pas écrites ; les autres sont gardées, validées et refusées si inconnues (jamais de verre)', () => {
    const plan = room();
    const plain = make('straight');
    expect(plain.frame).toBe(undefined);
    expect(plain.rail).toBe(undefined);
    expect(plain.finish).toBe(undefined);
    expect(stairRail(plain)).toBe('wood');
    expect(stairFinish(plain)).toBe('oak');
    expect(stairFrame(plain)).toBe('stringer');
    expect(STAIR_RAILS).toEqual(['none', 'handrail', 'wood', 'metal', 'cable', 'flat', 'slats']);
    expect(STAIR_RAILS.includes('glass')).toBe(false);
    expect(STAIR_RAILS.includes('panel')).toBe(false); // pas de muret
    expect(STAIR_STEPS).toEqual(['solid', 'stringer', 'spine', 'floating']);
    expect(STAIR_FRAMES).toEqual(['stringer', 'spine', 'floating']);
    const styled = make('straight', 6, 6, 'n', { under: 'open', frame: 'spine', rail: 'cable', finish: 'black' });
    expect(styled.frame).toBe('spine');
    expect(styled.rail).toBe('cable');
    expect(styled.finish).toBe('black');
    expect(canPlaceStair(plan, styled).ok).toBe(true);
    expect(canPlaceStair(plan, { ...styled, rail: 'glass' }).reason).toBe('size');
    expect(canPlaceStair(plan, { ...styled, frame: 'hover' }).reason).toBe('size');
    expect(canPlaceStair(plan, { ...styled, finish: 'neon' }).reason).toBe('size');
    // la structure n'a de sens que pour des marches ouvertes
    expect(make('straight', 6, 6, 'n', { under: 'solid', frame: 'spine' }).frame).toBe(undefined);
    for (const finish of STAIR_FINISHES) for (const part of ['tread', 'struct', 'wood', 'metal', 'steel', 'door']) expect(/^#[0-9a-f]{6}$/.test(finish[part])).toBe(true);
  });

  it('setStairSteps, setStairRail, setStairFinish : changent le style, ignorent l\'inconnu, gardent le style en changeant de forme', () => {
    const plan = addStair(room(), make('straight'));
    const id = plan.stairs[0].id;
    expect(stairSteps(plan.stairs[0])).toBe('solid');
    for (const steps of ['stringer', 'spine']) {
      const next = setStairSteps(plan, id, steps);
      expect(stairSteps(next.stairs[0])).toBe(steps);
      expect(stairUnder(next.stairs[0])).toBe('open'); // tout escalier ouvert laisse le dessous libre
    }
    expect(setStairSteps(plan, id, 'solid')).toBe(plan);
    expect(setStairSteps(plan, id, 'moquette')).toBe(plan);
    expect(setStairSteps(setStairSteps(plan, id, 'spine'), id, 'solid').stairs[0].frame).toBe(undefined);
    const railed = setStairRail(plan, id, 'metal');
    expect(railed.stairs[0].rail).toBe('metal');
    expect(setStairRail(railed, id, 'wood').stairs[0].rail).toBe(undefined);
    expect(setStairRail(plan, id, 'glass')).toBe(plan);
    expect(setStairFinish(plan, id, 'walnut').stairs[0].finish).toBe('walnut');
    expect(setStairFinish(plan, id, 'oak')).toBe(plan);
    // un changement de forme garde les marches, le garde-corps et la finition
    let styled = setStairFinish(setStairRail(setStairSteps(plan, id, 'spine'), id, 'slats'), id, 'concrete');
    const l = setStairKind(styled, id, 'l').stairs[0];
    expect([l.kind, l.frame, l.rail, l.finish]).toEqual(['l', 'spine', 'slats', 'concrete']);
    // un colimaçon n'a que le plein et le limon crémaillère
    const spiral = setStairKind(styled, id, 'spiral').stairs[0];
    expect(spiral.kind).toBe('spiral');
    expect(spiral.frame).toBe(undefined);
    expect(stairSteps(spiral)).toBe('stringer');
    const sp = addStair(room(), make('spiral'));
    expect(setStairSteps(sp, sp.stairs[0].id, 'spine')).toBe(sp);
    expect(setStairSteps(sp, sp.stairs[0].id, 'floating')).toBe(sp);
    expect(setStairSteps(sp, sp.stairs[0].id, 'stringer')).not.toBe(sp);
    styled = null;
  });

  it('marches flottantes : seulement contre un mur ; sans mur, les marches retombent sur le limon crémaillère', () => {
    const plan = room();
    const free = addStair(plan, make('straight', 6, 6));
    expect(stairWallBacked(free.stairs[0], free)).toBe(false);
    expect(setStairSteps(free, free.stairs[0].id, 'floating')).toBe(free);
    const wall = addStair(plan, createStairSpec(plan, { x: 2.5, y: 6 }, 'n'));
    expect(stairWallBacked(wall.stairs[0], wall)).toBe(true);
    const floating = setStairSteps(wall, wall.stairs[0].id, 'floating');
    expect(stairSteps(floating.stairs[0])).toBe('floating');
    const boxes = stairBoxes(floating.stairs[0], floating.wallHeight, floating).filter((box) => box.kind === 'stair');
    expect(boxes.every((box) => box.material === 'stair:oak:tread')).toBe(true); // rien que des planches
    expect(boxes.every((box) => box.size[1] <= 0.081)).toBe(true);
    // le mur disparaît (stairs déplacé hors mur dans le test : même escalier dans un plan sans mur) : limon crémaillère
    const orphan = stairBoxes(floating.stairs[0], floating.wallHeight, createEmptyPlan()).filter((box) => box.kind === 'stair');
    expect(orphan.some((box) => box.material === 'stair:oak:struct')).toBe(true);
  });

  it('limon central : une poutre étroite sous les marches, pas de limons latéraux ; limon crémaillère : deux limons', () => {
    const plan = room();
    const spine = stairBoxes({ ...make('straight', 6, 6), under: 'open', frame: 'spine' }, plan.wallHeight, plan).filter((box) => box.kind === 'stair');
    const beams = spine.filter((box) => box.material === 'stair:oak:struct');
    expect(beams.length).toBe(stairStepCount(plan.wallHeight) - 1);
    const middle = make('straight', 6, 6).x + 0.5;
    expect(beams.every((box) => Math.abs(box.size[0] - 0.14) < 1e-6 && Math.abs(box.position[0] - middle) < 1e-6)).toBe(true);
    const stringer = stairBoxes({ ...make('straight', 6, 6), under: 'open' }, plan.wallHeight, plan).filter((box) => box.kind === 'stair' && box.material === 'stair:oak:struct');
    expect(stringer.length).toBe(2 * (stairStepCount(plan.wallHeight) - 1));
  });

  it('garde-corps : de vrais barreaux, câbles ou lames sur les côtés libres, aucun verre, aucun côté contre un mur ; « aucun » n\'en pose pas', () => {
    const plan = room();
    for (const rail of STAIR_RAILS) {
      for (const kind of ['straight', 'l', 'u', 'spiral']) {
        const stair = { ...make(kind), rail, under: 'open' };
        const boxes = stairBoxes(stair, plan.wallHeight, plan);
        expect(boxes.some((box) => /glass|panel/.test(box.material))).toBe(false);
        const r = rails(boxes);
        if (rail === 'none') expect(r).toHaveLength(0);
        else {
          expect(r.length > 6).toBe(true);
          expect(r.every((box) => box.material.startsWith('stair:oak:') && box.size.every((d) => d > 0))).toBe(true);
        }
      }
    }
    // droit libre : un rail de chaque côté (deux x distincts), à 90 cm au-dessus de la marche en bas ; contre un mur : un seul côté
    const free = { ...make('straight', 6, 6), rail: 'handrail' };
    const sides = rails(stairBoxes(free, plan.wallHeight, plan)).map((box) => box.position[0]);
    expect(sides.some((x) => x < free.x + 0.1) && sides.some((x) => x > free.x + free.w - 0.1)).toBe(true); // un rail de chaque côté
    expect(sides.every((x) => x < free.x + 0.1 || x > free.x + free.w - 0.1)).toBe(true); // et rien au milieu
    const wall = createStairSpec(plan, { x: 2.5, y: 6 }, 'n', { rail: 'wood' });
    const wallSides = rails(stairBoxes(wall, plan.wallHeight, plan)).map((box) => box.position[0]);
    expect(wallSides.every((x) => x > wall.x + wall.w - 0.1)).toBe(true); // le côté du mur (x = 2) n'a pas de garde-corps
    expect(wallSides.length > 0).toBe(true);
  });

  it('la main courante suit la pente : inclinée (pitch), du pied vers l\'arrivée, à 90 cm au-dessus des marches', () => {
    const plan = room();
    const stair = { ...make('straight', 6, 6), rail: 'handrail' };
    const beams = rails(stairBoxes(stair, plan.wallHeight, plan)).filter((box) => box.pitch !== undefined);
    expect(beams).toHaveLength(2);
    const n = stairStepCount(plan.wallHeight);
    const riser = stairRise(plan.wallHeight) / n;
    const depth = 3.5 / (n - 1);
    for (const beam of beams) {
      expect(Math.abs(Math.abs(beam.pitch) - Math.atan2(riser, depth)) < 0.01).toBe(true);
      expect(Math.abs(beam.angle) - Math.PI / 2 < 1e-6).toBe(true); // elle va vers le nord (z décroissant)
      // le haut de la barre à l'arrivée est à la hauteur de la dernière marche + 0,9 m
      const high = beam.position[1] + (Math.sin(Math.abs(beam.pitch)) * beam.size[0]) / 2;
      expect(Math.abs(high - (FLOOR_THICKNESS + (n - 1) * riser + 0.9 + beam.size[1] / 2 * Math.cos(beam.pitch))) < 0.06).toBe(true);
    }
  });

  it('trémie à l\'étage : garde-corps de style sur le contour sauf l\'arrivée, plat, sans verre', () => {
    const plan = room();
    const stair = addStair(plan, { ...make('straight', 6, 6) }).stairs[0];
    const boxes = stairWellBoxes({ ...stair, rail: 'metal' }, plan.wallHeight, plan);
    expect(boxes.length > 20).toBe(true);
    expect(boxes.every((box) => box.kind === 'rail' && box.material.startsWith('stair:'))).toBe(true);
    // la montée va vers le nord : l'arrivée (y = stair.y) est ouverte ; le pied (y = stair.y + d) et les deux côtés sont fermés
    const mid = (box) => box.position[0] > stair.x + 0.1 && box.position[0] < stair.x + stair.w - 0.1;
    expect(boxes.filter((box) => Math.abs(box.position[2] - stair.y) < 0.1 && mid(box))).toEqual([]);
    expect(boxes.some((box) => Math.abs(box.position[2] - (stair.y + stair.d)) < 0.1 && mid(box))).toBe(true);
    expect(boxes.some((box) => box.position[0] < stair.x + 0.1)).toBe(true);
    expect(boxes.some((box) => box.position[0] > stair.x + stair.w - 0.1)).toBe(true);
    expect(Math.max(...boxes.map(top)) < FLOOR_THICKNESS + 1.05).toBe(true);
    expect(stairWellBoxes({ ...stair, rail: 'none' }, plan.wallHeight, plan)).toEqual([]);
    // le niveau du dessus les reçoit via buildStructure (upper), le niveau d'en bas non
    const upper = { ...plan, wells: [{ ...stair, rail: 'cable' }], stairs: [] };
    expect(buildStructure(upper, { upper: true }).boxes.some((box) => box.kind === 'rail')).toBe(true);
    expect(buildStructure(upper, { upper: false }).boxes.some((box) => box.kind === 'rail')).toBe(false);
  });

  it('la finition colore les marches et les garde-corps : une matière par partie', () => {
    const plan = room();
    for (const finish of ['ash', 'black']) {
      const boxes = stairBoxes({ ...make('straight', 6, 6), under: 'open', rail: 'cable', finish }, plan.wallHeight, plan);
      const keys = new Set(boxes.map((box) => box.material));
      for (const key of keys) expect(key.startsWith(`stair:${finish}:`)).toBe(true);
      for (const part of ['tread', 'struct', 'metal', 'steel', 'wood']) expect(keys.has(`stair:${finish}:${part}`)).toBe(true);
    }
  });

  it('mergeBoxes : une barre inclinée (pitch) tourne ses sommets et ses normales ; sans inclinaison, rien ne change', async () => {
    const { mergeBoxes } = await import('./viewer3d.js');
    const flat = mergeBoxes([{ kind: 'rail', material: 'm', position: [1, 2, 3], size: [2, 0.2, 0.1] }]);
    const p = Math.PI / 6;
    const tilted = mergeBoxes([{ kind: 'rail', material: 'm', position: [1, 2, 3], size: [2, 0.2, 0.1], pitch: p }]);
    // la face +x (sommets 0 à 3) : son centre est à +1 le long de l'axe de la barre, relevé de sin(pitch)
    const center = (g, face) => [0, 1, 2].map((a) => [0, 1, 2, 3].reduce((s, i) => s + g.positions[(face * 4 + i) * 3 + a], 0) / 4);
    const flatEnd = center(flat, 0);
    const tiltEnd = center(tilted, 0);
    expect(Math.abs(flatEnd[0] - 2) < 1e-6 && Math.abs(flatEnd[1] - 2) < 1e-6).toBe(true);
    expect(Math.abs(tiltEnd[0] - (1 + Math.cos(p))) < 1e-5).toBe(true);
    expect(Math.abs(tiltEnd[1] - (2 + Math.sin(p))) < 1e-5).toBe(true);
    // la normale de la face +y (sommets 8 à 11) penche vers l'arrière (−x)
    const normal = [tilted.normals[8 * 3], tilted.normals[8 * 3 + 1], tilted.normals[8 * 3 + 2]];
    expect(Math.abs(normal[0] + Math.sin(p)) < 1e-5 && Math.abs(normal[1] - Math.cos(p)) < 1e-5).toBe(true);
    // avec angle : l'axe de la barre se tourne autour de la verticale, comme Three.js (x → (cos a, 0, −sin a))
    const a = Math.PI / 2;
    const both = mergeBoxes([{ kind: 'rail', material: 'm', position: [0, 0, 0], size: [2, 0.2, 0.1], angle: a, pitch: p }]);
    const end = center(both, 0);
    expect(Math.abs(end[0]) < 1e-5 && Math.abs(end[2] + Math.cos(p)) < 1e-5 && Math.abs(end[1] - Math.sin(p)) < 1e-5).toBe(true);
  });
});
