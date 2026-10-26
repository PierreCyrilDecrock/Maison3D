// core.js — modèle de données du plan et validation.
// Logique pure : aucun accès au DOM, aucun import de Three.js. Testée dans tests.js.

/** Version du document (fichier, projet enregistré, lien de partage) : 2 = plan à étages (levels). La version 1 était un plan à un seul niveau. */
export const PLAN_VERSION = 2;
/** Version de la « vue d'un niveau » (le plan à plat sur lequel travaillent les fonctions pures de ce fichier et du générateur). */
export const LEVEL_PLAN_VERSION = 1;

/** Bornes acceptées à la lecture d'un fichier (un plan démesuré bloquerait la page). */
export const PLAN_LIMITS = Object.freeze({ gridMax: 200, cellSizeMax: 5, wallHeightMin: 1, wallHeightMax: 6, furnitureMax: 3000, seedMax: 4294967295, levelsMax: 6, stairsMax: 20 });

/** Palettes de style connues (les mêmes identifiants que PALETTES de furniture.js et STYLE_DENSITY de generator.js ; testé). */
export const STYLE_PRESETS = Object.freeze(['scandinave', 'moderne', 'industriel', 'classique', 'boheme']);

/** Grille par défaut : 40 x 30 cases de 0,5 m, soit 20 m x 15 m. */
export const DEFAULT_GRID = Object.freeze({ width: 40, height: 30, cellSize: 0.5 });

/** Hauteur sous plafond par défaut, en mètres. */
export const DEFAULT_WALL_HEIGHT = 2.5;

export const WALL_DIRECTIONS = Object.freeze(['h', 'v']);
export const OPENING_TYPES = Object.freeze(['door', 'window', 'passage']);
export const SWING_SIDES = Object.freeze(['a', 'b']);
/** Longueur maximale du nom d'une pièce. */
export const ROOM_NAME_MAX = 40;

export const ROOM_TYPES = Object.freeze([
  'living',
  'dining',
  'kitchen',
  'bedroom',
  'bathroom',
  'toilet',
  'entrance',
  'hallway',
  'office',
  'laundry',
  'kidsroom',
  'dressing',
  'pantry',
  'workshop',
  'garage',
  'other',
]);

/**
 * Arête de grille portant un mur.
 * 'h' va du point (x, y) au point (x + 1, y) ; 'v' va du point (x, y) au point (x, y + 1).
 * @typedef {{ x: number, y: number, dir: 'h' | 'v' }} WallEdge
 */

/**
 * Porte, fenêtre ou passage posé sur `span` arêtes de mur consécutives, à partir de `start` (x ou y croissant).
 * `swing` est le côté où la porte s'ouvre : 'a' = vers le haut (mur horizontal) ou vers la gauche (mur vertical),
 * 'b' = l'autre côté. La charnière est à l'extrémité de `start`. `sill` (allège) et `height` sont en mètres ;
 * absents, ils valent les valeurs par défaut du type (voir OPENING_DEFAULTS).
 * @typedef {{
 *   id: string,
 *   type: 'door' | 'window' | 'passage',
 *   start: WallEdge,
 *   span: number,
 *   swing: 'a' | 'b',
 *   sill?: number,
 *   height?: number
 * }} Opening
 */

/**
 * @typedef {'living' | 'dining' | 'kitchen' | 'bedroom' | 'bathroom' | 'toilet'
 *   | 'entrance' | 'hallway' | 'office' | 'laundry' | 'kidsroom' | 'dressing' | 'pantry' | 'workshop' | 'garage' | 'other'} RoomType
 */

/**
 * Meuble ou objet de décoration placé par le générateur (plan.furniture). x et z sont en mètres : le centre de l'empreinte au sol,
 * x et y du plan 2D (z = y du plan). rotationY est la rotation autour de l'axe vertical, en degrés (0, 90, 180, 270 ; à 0° l'avant de
 * l'objet regarde vers +z). y (facultatif, 0 par défaut) est la hauteur du bas de l'objet (cadres, luminaires, objets posés).
 * variant.seed est la graine des variations de l'objet ; role (facultatif) est son rôle dans la recette de la pièce.
 * @typedef {{
 *   id: string,
 *   defId: string,
 *   roomId: string,
 *   x: number,
 *   z: number,
 *   rotationY: number,
 *   y?: number,
 *   role?: string,
 *   variant: Object<string, string>
 * }} PlacedItem
 */

/**
 * Le plan : un seul objet JSON. Les pièces en sont dérivées, jamais stockées.
 * roomTypes, roomNames et roomLocks (pièces dont le mobilier est verrouillé) ont pour clé la case-ancre « x,y » de la pièce
 * (sa case la plus en haut à gauche) ;
 * une pièce sans entrée est de type « other » et porte le nom de son type.
 * @typedef {{
 *   version: 1,
 *   grid: { width: number, height: number, cellSize: number },
 *   wallHeight: number,
 *   walls: WallEdge[],
 *   openings: Opening[],
 *   roomTypes: Object<string, RoomType>,
 *   roomNames?: Object<string, string>,
 *   roomLocks?: Object<string, true>,
 *   style: { preset: string, seed: number },
 *   furniture: PlacedItem[]
 * }} Plan
 */

/**
 * Crée un plan vide, sans référence partagée avec un autre plan.
 * @param {{ width?: number, height?: number }} [options] taille de la grille en cases
 * @returns {Plan}
 */
export function createEmptyPlan({ width = DEFAULT_GRID.width, height = DEFAULT_GRID.height } = {}) {
  return {
    version: LEVEL_PLAN_VERSION,
    grid: { width, height, cellSize: DEFAULT_GRID.cellSize },
    wallHeight: DEFAULT_WALL_HEIGHT,
    walls: [],
    openings: [],
    roomTypes: {},
    roomNames: {},
    roomLocks: {},
    style: { preset: 'scandinave', seed: 1 },
    furniture: [],
  };
}

const isInt = (v) => Number.isInteger(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.length > 0;

/** Vérifie une arête ; ajoute les problèmes trouvés à errors. */
function checkEdge(edge, grid, path, errors) {
  if (!isObj(edge)) {
    errors.push(`${path} : l'arête doit être un objet { x, y, dir }.`);
    return;
  }
  if (!WALL_DIRECTIONS.includes(edge.dir)) {
    errors.push(`${path} : dir doit valoir "h" ou "v".`);
  }
  if (!isInt(edge.x) || !isInt(edge.y)) {
    errors.push(`${path} : x et y doivent être des entiers.`);
    return;
  }
  if (grid && WALL_DIRECTIONS.includes(edge.dir) && !isEdgeInGrid(grid, edge)) {
    errors.push(`${path} : l'arête (${edge.x}, ${edge.y}) est hors de la grille.`);
  }
}

/**
 * Vérifie qu'un objet respecte le modèle Plan : types, bornes (PLAN_LIMITS) et références croisées (ouvertures sur des murs,
 * clés de pièces, objets rattachés à une pièce qui existe, identifiants uniques).
 * @param {unknown} plan
 * @param {{ furnitureIds?: Iterable<string> | null }} [options] `furnitureIds` : identifiants d'objets du catalogue ; s'il est donné, chaque `defId` doit en faire partie
 * @returns {{ valid: boolean, errors: string[] }} errors est en français, prêt à afficher
 */
export function validatePlan(plan, options = {}) {
  if (isObj(plan) && plan.version === PLAN_VERSION) return collectDocErrors(plan, { ...options, crossRefs: true });
  return collectPlanErrors(plan, { ...options, crossRefs: true });
}

/** Vérifie la vue d'un niveau (plan à plat), sans les références croisées entre pièces et mobilier si `crossRefs` est faux. */
export function validateLevelPlan(plan, options = {}) {
  return collectPlanErrors(plan, { ...options, crossRefs: true });
}

function collectPlanErrors(plan, { furnitureIds = null, crossRefs = true } = {}) {
  const errors = [];
  if (!isObj(plan)) {
    return { valid: false, errors: ['Le plan doit être un objet.'] };
  }

  if (plan.version !== LEVEL_PLAN_VERSION) {
    errors.push(`Version de plan non prise en charge : ${String(plan.version)} (attendu : ${LEVEL_PLAN_VERSION}).`);
  }

  // Grille
  let grid = null;
  if (
    isObj(plan.grid) &&
    isInt(plan.grid.width) &&
    plan.grid.width > 0 &&
    isInt(plan.grid.height) &&
    plan.grid.height > 0 &&
    isNum(plan.grid.cellSize) &&
    plan.grid.cellSize > 0
  ) {
    grid = plan.grid;
    if (grid.width > PLAN_LIMITS.gridMax || grid.height > PLAN_LIMITS.gridMax) {
      errors.push(`grid : la grille ne peut pas dépasser ${PLAN_LIMITS.gridMax} × ${PLAN_LIMITS.gridMax} cases.`);
      grid = null;
    } else if (grid.cellSize > PLAN_LIMITS.cellSizeMax) {
      errors.push(`grid : cellSize ne peut pas dépasser ${PLAN_LIMITS.cellSizeMax} m.`);
    }
  } else {
    errors.push('grid : width et height doivent être des entiers positifs, cellSize un nombre positif.');
  }

  if (!isNum(plan.wallHeight) || plan.wallHeight < PLAN_LIMITS.wallHeightMin || plan.wallHeight > PLAN_LIMITS.wallHeightMax) {
    errors.push(`wallHeight : doit être un nombre entre ${PLAN_LIMITS.wallHeightMin} et ${PLAN_LIMITS.wallHeightMax} (en mètres).`);
  }

  // Murs
  if (Array.isArray(plan.walls)) {
    const seen = new Set();
    plan.walls.forEach((edge, i) => {
      checkEdge(edge, grid, `walls[${i}]`, errors);
      if (isObj(edge) && isInt(edge.x) && isInt(edge.y)) {
        const key = `${edge.dir}${edge.x},${edge.y}`;
        if (seen.has(key)) errors.push(`walls[${i}] : l'arête (${edge.x}, ${edge.y}) est en double.`);
        seen.add(key);
      }
    });
  } else {
    errors.push('walls : doit être un tableau.');
  }

  // Ouvertures
  if (Array.isArray(plan.openings)) {
    const ids = new Set();
    plan.openings.forEach((o, i) => {
      const path = `openings[${i}]`;
      if (!isObj(o)) {
        errors.push(`${path} : doit être un objet.`);
        return;
      }
      if (!isText(o.id)) errors.push(`${path} : id manquant.`);
      else if (ids.has(o.id)) errors.push(`${path} : id "${o.id}" en double.`);
      else ids.add(o.id);
      if (!OPENING_TYPES.includes(o.type)) errors.push(`${path} : type inconnu "${String(o.type)}".`);
      checkEdge(o.start, grid, `${path}.start`, errors);
      const limits = openingSpanLimits(grid?.cellSize ?? DEFAULT_GRID.cellSize);
      if (!isInt(o.span) || o.span < limits.min || o.span > limits.max) {
        errors.push(`${path} : span doit être un entier de ${limits.min} à ${limits.max}.`);
      }
      if (!SWING_SIDES.includes(o.swing)) errors.push(`${path} : swing doit valoir "a" ou "b".`);
      if (o.sill !== undefined && (!isNum(o.sill) || o.sill < 0)) errors.push(`${path} : sill (allège) doit être un nombre positif ou nul.`);
      if (o.height !== undefined && (!isNum(o.height) || o.height <= 0)) errors.push(`${path} : height doit être un nombre positif.`);
      if (isNum(o.sill) && isNum(o.height) && isNum(plan.wallHeight) && o.sill + o.height > plan.wallHeight + 1e-9) {
        errors.push(`${path} : allège + hauteur dépasse la hauteur des murs.`);
      }
    });
    checkOpeningsOnWalls(plan, errors);
  } else {
    errors.push('openings : doit être un tableau.');
  }

  // Types de pièces, indexés par case-ancre « x,y »
  if (isObj(plan.roomTypes)) {
    for (const [key, type] of Object.entries(plan.roomTypes)) {
      const match = /^(\d+),(\d+)$/.exec(key);
      if (!match) {
        errors.push(`roomTypes : la clé "${key}" doit avoir la forme "x,y".`);
      } else if (grid && (Number(match[1]) >= grid.width || Number(match[2]) >= grid.height)) {
        errors.push(`roomTypes : la case "${key}" est hors de la grille.`);
      }
      if (!ROOM_TYPES.includes(type)) errors.push(`roomTypes["${key}"] : type de pièce inconnu "${String(type)}".`);
    }
  } else {
    errors.push('roomTypes : doit être un objet.');
  }

  // Noms personnalisés des pièces (facultatif : absent des plans enregistrés avant la phase 2)
  if (plan.roomNames !== undefined) {
    if (isObj(plan.roomNames)) {
      for (const [key, name] of Object.entries(plan.roomNames)) {
        const match = /^(\d+),(\d+)$/.exec(key);
        if (!match) errors.push(`roomNames : la clé "${key}" doit avoir la forme "x,y".`);
        else if (grid && (Number(match[1]) >= grid.width || Number(match[2]) >= grid.height)) {
          errors.push(`roomNames : la case "${key}" est hors de la grille.`);
        }
        if (typeof name !== 'string' || name.length === 0 || name.length > ROOM_NAME_MAX) {
          errors.push(`roomNames["${key}"] : le nom doit être un texte de 1 à ${ROOM_NAME_MAX} caractères.`);
        }
      }
    } else {
      errors.push('roomNames : doit être un objet.');
    }
  }

  // Verrous (facultatifs : absents des plans enregistrés avant la phase 6c)
  if (plan.roomLocks !== undefined) {
    if (isObj(plan.roomLocks)) {
      for (const [key, locked] of Object.entries(plan.roomLocks)) {
        if (!/^\d+,\d+$/.test(key)) errors.push(`roomLocks : la clé "${key}" doit avoir la forme "x,y".`);
        if (locked !== true) errors.push(`roomLocks["${key}"] : doit valoir true.`);
      }
    } else {
      errors.push('roomLocks : doit être un objet.');
    }
  }

  // Finitions des pièces (facultatives)
  if (plan.roomFinishes !== undefined) {
    if (isObj(plan.roomFinishes)) {
      for (const [key, finish] of Object.entries(plan.roomFinishes)) {
        if (!/^\d+,\d+$/.test(key)) errors.push(`roomFinishes : la clé "${key}" doit avoir la forme "x,y".`);
        if (!isObj(finish)) {
          errors.push(`roomFinishes["${key}"] : doit être un objet { floor, wall, baseboard }.`);
          continue;
        }
        if (finish.floor !== undefined && !finishById(FLOOR_FINISHES, finish.floor)) errors.push(`roomFinishes["${key}"] : sol inconnu "${String(finish.floor)}".`);
        if (finish.wall !== undefined && !isWallFinishValue(finish.wall)) errors.push(`roomFinishes["${key}"] : finition de mur inconnue "${String(finish.wall)}".`);
        if (finish.baseboard !== undefined && (!finishById(BASEBOARD_FINISHES, finish.baseboard) || finish.baseboard === 'none')) {
          errors.push(`roomFinishes["${key}"] : plinthe inconnue "${String(finish.baseboard)}".`);
        }
      }
    } else {
      errors.push('roomFinishes : doit être un objet.');
    }
  }

  // Escaliers (facultatifs) : rectangles en mètres, sens de la montée
  if (plan.stairs !== undefined) {
    if (Array.isArray(plan.stairs)) {
      const stairIds = new Set();
      if (plan.stairs.length > PLAN_LIMITS.stairsMax) errors.push(`stairs : trop d'escaliers (${PLAN_LIMITS.stairsMax} au maximum).`);
      plan.stairs.forEach((stair, i) => {
        const path = `stairs[${i}]`;
        if (!isObj(stair)) {
          errors.push(`${path} : doit être un objet.`);
          return;
        }
        if (!isText(stair.id)) errors.push(`${path} : id manquant.`);
        else if (stairIds.has(stair.id)) errors.push(`${path} : id "${stair.id}" en double.`);
        else stairIds.add(stair.id);
        if (![stair.x, stair.y, stair.w, stair.d].every(isNum)) {
          errors.push(`${path} : x, y, w et d doivent être des nombres (mètres).`);
          return;
        }
        const check = grid ? canPlaceStair({ grid, walls: [], stairs: [], wells: [] }, stair, stair.id) : { ok: true };
        if (!check.ok) errors.push(`${path} : ${check.reason === 'size' ? 'dimensions ou sens invalides' : 'hors de la grille'}.`);
      });
    } else {
      errors.push('stairs : doit être un tableau.');
    }
  }

  // Style
  if (!isObj(plan.style) || !isText(plan.style.preset) || !isInt(plan.style.seed)) {
    errors.push('style : doit contenir un preset (texte) et une seed (entier).');
  } else {
    if (!STYLE_PRESETS.includes(plan.style.preset)) errors.push(`style : palette inconnue "${plan.style.preset}" (${STYLE_PRESETS.join(', ')}).`);
    if (plan.style.seed < 0 || plan.style.seed > PLAN_LIMITS.seedMax) errors.push(`style : la seed doit être comprise entre 0 et ${PLAN_LIMITS.seedMax}.`);
  }

  // Mobilier généré
  const known = furnitureIds ? new Set(furnitureIds) : null;
  const furnitureIdsSeen = new Set();
  if (Array.isArray(plan.furniture)) {
    plan.furniture.forEach((item, i) => {
      const path = `furniture[${i}]`;
      if (!isObj(item)) {
        errors.push(`${path} : doit être un objet.`);
        return;
      }
      if (!isText(item.id) || !isText(item.defId) || !isText(item.roomId)) {
        errors.push(`${path} : id, defId et roomId sont obligatoires.`);
      }
      if (!isNum(item.x) || !isNum(item.z) || !isNum(item.rotationY)) {
        errors.push(`${path} : x, z et rotationY doivent être des nombres.`);
      } else {
        if (![0, 90, 180, 270].includes(item.rotationY)) errors.push(`${path} : rotationY doit valoir 0, 90, 180 ou 270.`);
        if (grid && (item.x < 0 || item.z < 0 || item.x > grid.width * grid.cellSize || item.z > grid.height * grid.cellSize)) {
          errors.push(`${path} : l'objet est hors de la grille.`);
        }
      }
      if (item.y !== undefined && (!isNum(item.y) || item.y < 0 || (isNum(plan.wallHeight) && item.y > plan.wallHeight))) {
        errors.push(`${path} : y (hauteur du bas) doit être comprise entre 0 et la hauteur des murs.`);
      }
      if (!isObj(item.variant)) errors.push(`${path} : variant doit être un objet.`);
      if (isText(item.id)) {
        if (furnitureIdsSeen.has(item.id)) errors.push(`${path} : id "${item.id}" en double.`);
        furnitureIdsSeen.add(item.id);
      }
      if (known && isText(item.defId) && !known.has(item.defId)) errors.push(`${path} : objet inconnu "${item.defId}".`);
    });
    if (plan.furniture.length > PLAN_LIMITS.furnitureMax) errors.push(`furniture : trop d'objets (${PLAN_LIMITS.furnitureMax} au maximum).`);
  } else {
    errors.push('furniture : doit être un tableau.');
  }

  // Références croisées : les clés et les objets doivent désigner des pièces qui existent.
  if (crossRefs && errors.length === 0) {
    const rooms = detectRooms(plan);
    const anchors = new Set(rooms.map(roomKey));
    for (const field of ['roomTypes', 'roomNames', 'roomLocks', 'roomFinishes']) {
      for (const key of Object.keys(plan[field] ?? {})) {
        if (!anchors.has(key)) errors.push(`${field} : la clé "${key}" ne correspond à aucune pièce du plan.`);
      }
    }
    const owner = new Map();
    for (const room of rooms) for (const c of room.cells) owner.set(`${c.x},${c.y}`, room.id);
    const cell = plan.grid.cellSize;
    plan.furniture.forEach((item, i) => {
      if (!owner.size || !isText(item.roomId)) return;
      if (!rooms.some((room) => room.id === item.roomId)) errors.push(`furniture[${i}] : la pièce "${item.roomId}" n'existe pas.`);
      else if (owner.get(`${Math.floor(item.x / cell)},${Math.floor(item.z / cell)}`) !== item.roomId) {
        errors.push(`furniture[${i}] : l'objet n'est pas dans la pièce "${item.roomId}".`);
      }
    });
    if (!rooms.length && plan.furniture.length) errors.push('furniture : le plan contient du mobilier mais aucune pièce.');
  }

  return { valid: errors.length === 0, errors };
}

/* ------------------------------------------------------------------ */
/* Grille : points, arêtes, murs                                      */
/* Les coordonnées de grille sont en cases ; les points de grille     */
/* (intersections) ont des coordonnées entières.                      */
/* ------------------------------------------------------------------ */

/** Épaisseur d'un mur, en mètres. */
export const WALL_THICKNESS = 0.1;

/** Taille d'une case à l'écran : bornes du zoom, en pixels. */
export const MIN_CELL_PX = 4;
export const MAX_CELL_PX = 96;

/** @typedef {{ x: number, y: number }} Point */

/**
 * Vue 2D : cell = pixels par case ; (ox, oy) = position à l'écran de l'origine (0, 0) de la grille.
 * @typedef {{ cell: number, ox: number, oy: number }} View
 */

/** Clé unique d'une arête, pour les ensembles et les recherches. */
export function edgeKey(edge) {
  return `${edge.dir}${edge.x},${edge.y}`;
}

/** Vrai si l'arête se trouve entièrement dans la grille. */
export function isEdgeInGrid(grid, edge) {
  // Une arête 'h' occupe x de 0 à largeur - 1 ; une arête 'v' occupe y de 0 à hauteur - 1.
  if (edge.dir === 'h') return edge.x >= 0 && edge.x <= grid.width - 1 && edge.y >= 0 && edge.y <= grid.height;
  if (edge.dir === 'v') return edge.x >= 0 && edge.x <= grid.width && edge.y >= 0 && edge.y <= grid.height - 1;
  return false;
}

/** Point de grille (écran) → coordonnées de grille décimales. */
export function screenToGrid(view, point) {
  return { x: (point.x - view.ox) / view.cell, y: (point.y - view.oy) / view.cell };
}

/** Coordonnées de grille → point à l'écran. */
export function gridToScreen(view, point) {
  return { x: view.ox + point.x * view.cell, y: view.oy + point.y * view.cell };
}

/** Intersection de grille la plus proche, ramenée dans la grille. */
export function snapToGrid(point, grid) {
  const clamp = (value, max) => Math.min(Math.max(Math.round(value), 0), max);
  return { x: clamp(point.x, grid.width), y: clamp(point.y, grid.height) };
}

/** Ramène `to` sur l'axe dominant (horizontal ou vertical) qui part de `from`. À égalité, horizontal. */
export function alignToAxis(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.abs(dx) >= Math.abs(dy) ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
}

/**
 * Arête canonique entre deux points de grille voisins, quel que soit l'ordre des points.
 * @returns {WallEdge | null} null si les points ne sont pas voisins
 */
export function normalizeEdge(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return null;
  return dy === 0
    ? { x: Math.min(a.x, b.x), y: a.y, dir: 'h' }
    : { x: a.x, y: Math.min(a.y, b.y), dir: 'v' };
}

/** Arêtes d'un segment horizontal ou vertical, de gauche à droite ou de haut en bas. Vide si le segment est oblique. */
export function segmentEdges(from, to) {
  const edges = [];
  if (from.y === to.y) {
    for (let x = Math.min(from.x, to.x); x < Math.max(from.x, to.x); x++) edges.push({ x, y: from.y, dir: 'h' });
  } else if (from.x === to.x) {
    for (let y = Math.min(from.y, to.y); y < Math.max(from.y, to.y); y++) edges.push({ x: from.x, y, dir: 'v' });
  }
  return edges;
}

/** Longueur en mètres du mur tracé de `from` vers `to` (ramené sur l'axe dominant). */
export function segmentLengthM(grid, from, to) {
  const end = alignToAxis(from, to);
  return (Math.abs(end.x - from.x) + Math.abs(end.y - from.y)) * grid.cellSize;
}

/**
 * Ajoute les murs du segment `from` → `to` (ramené sur l'axe dominant), sans doublon et sans sortir de la grille.
 * Renvoie le même plan, sans copie, si rien ne change.
 * @returns {Plan}
 */
export function addWallSegments(plan, from, to) {
  const known = new Set(plan.walls.map(edgeKey));
  const fresh = segmentEdges(from, alignToAxis(from, to)).filter(
    (edge) => isEdgeInGrid(plan.grid, edge) && !known.has(edgeKey(edge)),
  );
  if (fresh.length === 0) return plan;
  return { ...plan, walls: [...plan.walls, ...fresh] };
}

/** Plan avec de nouveaux murs ; les ouvertures qui reposaient sur un mur disparu sont supprimées. */
function withWalls(plan, walls) {
  const next = { ...plan, walls };
  const openings = pruneOpenings(next);
  return openings === plan.openings ? next : { ...next, openings };
}

/** Supprime les murs du segment `from` → `to` (ramené sur l'axe dominant). Même plan si rien ne change. */
export function removeWallSegments(plan, from, to) {
  const doomed = new Set(segmentEdges(from, alignToAxis(from, to)).map(edgeKey));
  const walls = plan.walls.filter((edge) => !doomed.has(edgeKey(edge)));
  return walls.length === plan.walls.length ? plan : withWalls(plan, walls);
}

/** Supprime une seule arête. Même plan si elle n'existe pas. */
export function removeWallEdge(plan, edge) {
  const key = edgeKey(edge);
  const walls = plan.walls.filter((wall) => edgeKey(wall) !== key);
  return walls.length === plan.walls.length ? plan : withWalls(plan, walls);
}

function distanceToEdge(point, edge) {
  const endX = edge.dir === 'h' ? edge.x + 1 : edge.x;
  const endY = edge.dir === 'v' ? edge.y + 1 : edge.y;
  const nearX = Math.min(Math.max(point.x, edge.x), endX);
  const nearY = Math.min(Math.max(point.y, edge.y), endY);
  return Math.hypot(point.x - nearX, point.y - nearY);
}

/** Mur existant le plus proche d'un point (coordonnées de grille), dans la limite de `tolerance` cases (1 au plus). */
function nearestWall(wallMap, point, tolerance) {
  const cx = Math.floor(point.x);
  const cy = Math.floor(point.y);
  let best = null;
  let bestDistance = tolerance;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (const dir of WALL_DIRECTIONS) {
        const edge = wallMap.get(`${dir}${cx + dx},${cy + dy}`);
        if (!edge) continue;
        const distance = distanceToEdge(point, edge);
        if (distance <= bestDistance) {
          best = edge;
          bestDistance = distance;
        }
      }
    }
  }
  return best;
}

/**
 * Mur le plus proche d'un point, ou null.
 * @param {Point} point coordonnées de grille décimales
 * @param {number} [tolerance] distance maximale en cases
 */
export function findWallEdgeNear(plan, point, tolerance = 0.5) {
  return nearestWall(new Map(plan.walls.map((edge) => [edgeKey(edge), edge])), point, tolerance);
}

/**
 * Gomme : supprime les murs proches du trajet `a` → `b` (coordonnées de grille décimales).
 * - Si a et b sont le même point (un toucher), seul le mur le plus proche est effacé ; si le toucher est sur une
 *   porte, une fenêtre ou un passage, c'est cette ouverture qui est supprimée et le mur reste.
 * - Sinon le trajet est échantillonné tous les quarts de case, pour ne rien sauter quand le doigt va vite ;
 *   le point de départ n'est pas rejoué, car l'appel précédent s'en est déjà occupé.
 * Même plan si rien n'est effacé.
 */
export function eraseAlongPath(plan, a, b, tolerance = 0.5) {
  if (a.x === b.x && a.y === b.y) {
    const opening = findOpeningAt(plan, a, tolerance);
    if (opening) return removeOpening(plan, opening.id);
  }
  const wallMap = new Map(plan.walls.map((edge) => [edgeKey(edge), edge]));
  const before = wallMap.size;
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.ceil(distance / 0.25);
  const samples = steps === 0 ? [a] : Array.from({ length: steps }, (_, i) => (i + 1) / steps);
  for (const s of samples) {
    const point = steps === 0 ? s : { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s };
    const edge = nearestWall(wallMap, point, tolerance);
    if (edge) wallMap.delete(edgeKey(edge));
  }
  if (wallMap.size === before) return plan;
  return withWalls(plan, plan.walls.filter((edge) => wallMap.has(edgeKey(edge))));
}

/** Plan vidé de ses murs et de tout ce qui en dépend, grille et style conservés. Même plan s'il est déjà vide. */
export function clearPlan(plan) {
  const named = Object.keys(plan.roomNames ?? {}).length;
  const locked = Object.keys(plan.roomLocks ?? {}).length;
  const finished = Object.keys(plan.roomFinishes ?? {}).length;
  const stairs = (plan.stairs ?? []).length;
  if (!plan.walls.length && !plan.openings.length && !Object.keys(plan.roomTypes).length && !named && !locked && !finished && !stairs && !plan.furniture.length) {
    return plan;
  }
  const cleared = { ...plan, walls: [], openings: [], roomTypes: {}, roomNames: {}, roomLocks: {}, furniture: [] };
  // Les champs facultatifs sont mis à vide s'ils existent (withLevelPlan lit « absent » comme « inchangé »).
  if (plan.roomFinishes) cleared.roomFinishes = {};
  if (plan.stairs) cleared.stairs = [];
  return cleared;
}

/**
 * Rectangles (en cases) à remplir pour dessiner les murs avec une épaisseur constante.
 * Chaque mur dépasse d'une demi-épaisseur à ses deux bouts : aux angles et aux T, les rectangles
 * se recouvrent et la jonction est pleine, sans trou ni encoche.
 * @param {WallEdge[]} walls
 * @param {number} thickness épaisseur en cases (0,1 m = 0,2 case)
 */
export function wallRects(walls, thickness) {
  const half = thickness / 2;
  return walls.map((edge) =>
    edge.dir === 'h'
      ? { x: edge.x - half, y: edge.y - half, w: 1 + thickness, h: thickness }
      : { x: edge.x - half, y: edge.y - half, w: thickness, h: 1 + thickness },
  );
}

/* ------------------------------------------------------------------ */
/* Vue 2D : cadrage, zoom, déplacement                                */
/* area = zone de dessin à l'écran : { x, y, w, h } en pixels.        */
/* ------------------------------------------------------------------ */

const clampNumber = (value, min, max) => Math.min(Math.max(value, min), max);

/** Vue qui fait tenir toute la grille dans la zone, centrée, avec une marge en pixels. */
export function fitView(grid, area, padding = 12) {
  const cell = clampNumber(
    Math.min((area.w - 2 * padding) / grid.width, (area.h - 2 * padding) / grid.height),
    MIN_CELL_PX,
    MAX_CELL_PX,
  );
  return {
    cell,
    ox: area.x + (area.w - cell * grid.width) / 2,
    oy: area.y + (area.h - cell * grid.height) / 2,
  };
}

/** Zoom de `factor` autour d'un point de l'écran : le point de grille sous ce point ne bouge pas. */
export function zoomAt(view, point, factor) {
  const cell = clampNumber(view.cell * factor, MIN_CELL_PX, MAX_CELL_PX);
  const ratio = cell / view.cell;
  return { cell, ox: point.x - (point.x - view.ox) * ratio, oy: point.y - (point.y - view.oy) * ratio };
}

/** Déplace la vue de (dx, dy) pixels. */
export function panView(view, dx, dy) {
  return { cell: view.cell, ox: view.ox + dx, oy: view.oy + dy };
}

/** Empêche de perdre la grille : au moins `keep` pixels de grille restent visibles dans la zone. */
export function clampView(view, grid, area, keep = 48) {
  const width = grid.width * view.cell;
  const height = grid.height * view.cell;
  const keepX = Math.min(keep, width);
  const keepY = Math.min(keep, height);
  return {
    cell: view.cell,
    ox: clampNumber(view.ox, area.x + keepX - width, area.x + area.w - keepX),
    oy: clampNumber(view.oy, area.y + keepY - height, area.y + area.h - keepY),
  };
}

/* ------------------------------------------------------------------ */
/* Pièces : détection, types, noms                                    */
/* Les pièces sont dérivées des murs, jamais stockées. Seuls le type  */
/* et le nom choisis par la personne sont conservés dans le plan, avec */
/* pour clé la case-ancre de la pièce (sa case en haut à gauche).      */
/* Une case (cx, cy) occupe les points de grille de (cx, cy) à          */
/* (cx + 1, cy + 1).                                                   */
/* ------------------------------------------------------------------ */

/**
 * Libellé et teinte (0-360) de chaque type de pièce. `mute` atténue la saturation (gris pour « Autre »).
 * @type {Readonly<Record<RoomType, { label: string, hue: number, mute: number }>>}
 */
export const ROOM_TYPE_INFO = Object.freeze({
  living: { label: 'Salon', hue: 28, mute: 1 },
  dining: { label: 'Salle à manger', hue: 48, mute: 1 },
  kitchen: { label: 'Cuisine', hue: 110, mute: 1 },
  bedroom: { label: 'Chambre', hue: 268, mute: 1 },
  bathroom: { label: 'Salle de bain', hue: 196, mute: 1 },
  toilet: { label: 'WC', hue: 165, mute: 1 },
  entrance: { label: 'Entrée', hue: 345, mute: 1 },
  hallway: { label: 'Couloir', hue: 60, mute: 0.55 },
  office: { label: 'Bureau', hue: 224, mute: 1 },
  laundry: { label: 'Buanderie', hue: 305, mute: 1 },
  kidsroom: { label: 'Chambre d’enfant', hue: 292, mute: 0.8 },
  dressing: { label: 'Dressing', hue: 248, mute: 0.7 },
  pantry: { label: 'Cellier', hue: 85, mute: 0.8 },
  workshop: { label: 'Atelier', hue: 18, mute: 0.85 },
  garage: { label: 'Garage', hue: 205, mute: 0.3 },
  other: { label: 'Autre', hue: 214, mute: 0.14 },
});

/**
 * Familles de pièces, dans l'ordre d'affichage du menu : chaque type de pièce appartient à exactement une famille.
 * @type {ReadonlyArray<Readonly<{ id: string, label: string, types: readonly RoomType[] }>>}
 */
export const ROOM_GROUPS = Object.freeze([
  Object.freeze({ id: 'life', label: 'Vie', types: Object.freeze(['living', 'dining', 'kitchen']) }),
  Object.freeze({ id: 'night', label: 'Nuit', types: Object.freeze(['bedroom', 'kidsroom', 'dressing']) }),
  Object.freeze({ id: 'water', label: 'Eau et entretien', types: Object.freeze(['bathroom', 'toilet', 'laundry']) }),
  Object.freeze({ id: 'work', label: 'Travail', types: Object.freeze(['office', 'workshop']) }),
  Object.freeze({ id: 'circulation', label: 'Circulation', types: Object.freeze(['entrance', 'hallway']) }),
  Object.freeze({ id: 'annex', label: 'Annexes', types: Object.freeze(['garage', 'pantry', 'other']) }),
]);

/** Famille d'un type de pièce. */
export function roomGroupOf(type) {
  return ROOM_GROUPS.find((group) => group.types.includes(type)) ?? ROOM_GROUPS[ROOM_GROUPS.length - 1];
}

/** Une composante de cases en dessous de ce nombre d'arêtes n'est pas signalée comme contour ouvert. */
export const MIN_OUTLINE_EDGES = 4;

/**
 * Pièce fermée : un ensemble de cases voisines, entouré de murs.
 * `anchor` est la case la plus en haut (puis à gauche) ; `bounds` est en points de grille ;
 * `centroid` est la moyenne des centres de cases (coordonnées de grille) ; `labelPoint` est le centre
 * de la case de la pièce la plus proche du centroïde, toujours à l'intérieur même pour une pièce en L.
 * @typedef {{
 *   id: string,
 *   anchor: { x: number, y: number },
 *   cells: { x: number, y: number }[],
 *   areaM2: number,
 *   bounds: { minX: number, minY: number, maxX: number, maxY: number },
 *   centroid: Point,
 *   labelPoint: Point
 * }} Room
 */

/** Clé « x,y » de la case-ancre d'une pièce, utilisée dans plan.roomTypes et plan.roomNames. */
export function roomKey(room) {
  return `${room.anchor.x},${room.anchor.y}`;
}

/** Identifiant stable d'une pièce, dérivé de sa case la plus en haut à gauche. */
export function roomIdOf(anchor) {
  return `room-${anchor.x}-${anchor.y}`;
}

function buildRoom(cells, cellSize) {
  cells.sort((a, b) => a.y - b.y || a.x - b.x);
  const anchor = { x: cells[0].x, y: cells[0].y };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let sumX = 0;
  let sumY = 0;
  for (const { x, y } of cells) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + 1);
    maxY = Math.max(maxY, y + 1);
    sumX += x + 0.5;
    sumY += y + 0.5;
  }
  const centroid = { x: sumX / cells.length, y: sumY / cells.length };
  let labelPoint = { x: cells[0].x + 0.5, y: cells[0].y + 0.5 };
  let best = Infinity;
  for (const { x, y } of cells) {
    const d = (x + 0.5 - centroid.x) ** 2 + (y + 0.5 - centroid.y) ** 2;
    if (d < best) {
      best = d;
      labelPoint = { x: x + 0.5, y: y + 0.5 };
    }
  }
  return {
    id: roomIdOf(anchor),
    anchor,
    cells,
    areaM2: cells.length * cellSize * cellSize,
    bounds: { minX, minY, maxX, maxY },
    centroid,
    labelPoint,
  };
}

/**
 * Détecte les pièces fermées : remplissage en 4-connexité des cases de la grille.
 * Deux cases voisines sont connectées s'il n'y a pas de mur entre elles. Une composante qui s'ouvre sur le
 * bord de la grille par un côté sans mur est l'extérieur et n'est pas une pièce (un mur posé sur le bord
 * lui-même referme bien la pièce). Les pièces sont triées de haut en bas, puis de gauche à droite.
 * @param {Plan} plan
 * @returns {Room[]}
 */
export function detectRooms(plan) {
  const { width, height, cellSize } = plan.grid;
  const walls = new Set(plan.walls.map(edgeKey));
  const wall = (dir, x, y) => walls.has(`${dir}${x},${y}`);
  const seen = new Uint8Array(width * height);
  const rooms = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (seen[y * width + x]) continue;
      const cells = [];
      let outside = false;
      const stack = [x, y];
      seen[y * width + x] = 1;
      while (stack.length) {
        const cy = stack.pop();
        const cx = stack.pop();
        cells.push({ x: cx, y: cy });
        const visit = (nx, ny, blocked, atEdge) => {
          if (blocked) return;
          if (atEdge) {
            outside = true;
            return;
          }
          if (seen[ny * width + nx]) return;
          seen[ny * width + nx] = 1;
          stack.push(nx, ny);
        };
        visit(cx - 1, cy, wall('v', cx, cy), cx === 0);
        visit(cx + 1, cy, wall('v', cx + 1, cy), cx === width - 1);
        visit(cx, cy - 1, wall('h', cx, cy), cy === 0);
        visit(cx, cy + 1, wall('h', cx, cy + 1), cy === height - 1);
      }
      if (!outside) rooms.push(buildRoom(cells, cellSize));
    }
  }
  return rooms;
}

/** Pièce qui contient la case (x, y), ou null. */
export function roomAtCell(rooms, x, y) {
  for (const room of rooms) {
    if (x < room.bounds.minX || x >= room.bounds.maxX || y < room.bounds.minY || y >= room.bounds.maxY) continue;
    if (room.cells.some((cell) => cell.x === x && cell.y === y)) return room;
  }
  return null;
}

/** Pièce sous un point de grille décimal, ou null. */
export function roomAtPoint(rooms, point) {
  return roomAtCell(rooms, Math.floor(point.x), Math.floor(point.y));
}

/** Type d'une pièce (« other » par défaut). */
export function getRoomType(plan, room) {
  return plan.roomTypes[roomKey(room)] ?? 'other';
}

/** Nom personnalisé d'une pièce, ou une chaîne vide. */
export function getRoomName(plan, room) {
  return plan.roomNames?.[roomKey(room)] ?? '';
}

/** Nom affiché : le nom personnalisé, sinon le libellé du type. */
export function roomLabel(plan, room) {
  return getRoomName(plan, room) || ROOM_TYPE_INFO[getRoomType(plan, room)].label;
}

/**
 * Change le type et / ou le nom d'une pièce. Un type « other » et un nom vide ne sont pas stockés.
 * Même plan si rien ne change.
 * @param {Plan} plan
 * @param {Room} room
 * @param {{ type?: RoomType, name?: string }} info
 */
export function setRoomInfo(plan, room, info) {
  const key = roomKey(room);
  let roomTypes = plan.roomTypes;
  let roomNames = plan.roomNames ?? {};
  if (info.type !== undefined && ROOM_TYPES.includes(info.type) && info.type !== getRoomType(plan, room)) {
    roomTypes = { ...roomTypes };
    if (info.type === 'other') delete roomTypes[key];
    else roomTypes[key] = info.type;
  }
  if (info.name !== undefined) {
    const name = String(info.name).trim().replace(/\s+/g, ' ').slice(0, ROOM_NAME_MAX);
    if (name !== (roomNames[key] ?? '')) {
      roomNames = { ...roomNames };
      if (name) roomNames[key] = name;
      else delete roomNames[key];
    }
  }
  if (roomTypes === plan.roomTypes && roomNames === (plan.roomNames ?? {})) return plan;
  return { ...plan, roomTypes, roomNames };
}

/** Ajoute roomNames (phase 2) et roomLocks (phase 6c) aux plans enregistrés avant. Même plan s'il est déjà à jour. */
export function normalizePlan(plan) {
  if (plan.roomNames && plan.roomLocks) return plan;
  return { ...plan, roomNames: plan.roomNames ?? {}, roomLocks: plan.roomLocks ?? {} };
}

/** Le mobilier de cette pièce est-il verrouillé (conservé quand on régénère le logement ou qu'on vide le mobilier) ? */
export function isRoomLocked(plan, room) {
  return Boolean(plan.roomLocks?.[roomKey(room)]);
}

/** Verrouille ou déverrouille une pièce. Même plan si rien ne change. */
export function setRoomLock(plan, room, locked) {
  const key = roomKey(room);
  if (Boolean(plan.roomLocks?.[key]) === Boolean(locked)) return plan;
  const roomLocks = { ...(plan.roomLocks ?? {}) };
  if (locked) roomLocks[key] = true;
  else delete roomLocks[key];
  return { ...plan, roomLocks };
}

const sameRecord = (a, b) => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
};

/**
 * Après un changement de murs : chaque nouvelle pièce hérite du type (et du nom) de l'ancienne pièce
 * avec laquelle elle partage le plus de cases (le verrou du mobilier suit de la même façon) ; sans ancienne pièce en commun, elle
 * est de type « other ».
 * À égalité, l'ancienne pièce la plus haute à gauche l'emporte. Les entrées des pièces disparues sont retirées.
 * Renvoie `nextPlan` lui-même si rien ne change.
 * @param {Plan} prevPlan plan avant le changement de murs
 * @param {Plan} nextPlan plan après le changement de murs
 * @param {Room[]} [prevRooms] pièces de prevPlan, si elles sont déjà calculées
 * @param {Room[]} [nextRooms] pièces de nextPlan, si elles sont déjà calculées
 */
export function reconcileRoomTypes(prevPlan, nextPlan, prevRooms = detectRooms(prevPlan), nextRooms = detectRooms(nextPlan)) {
  const { width } = nextPlan.grid;
  const owner = new Map(); // case → indice de l'ancienne pièce
  prevRooms.forEach((room, i) => room.cells.forEach((c) => owner.set(c.y * width + c.x, i)));

  const roomTypes = {};
  const roomNames = {};
  const roomLocks = {};
  const roomFinishes = {};
  for (const room of nextRooms) {
    const shared = new Map();
    for (const c of room.cells) {
      const i = owner.get(c.y * width + c.x);
      if (i !== undefined) shared.set(i, (shared.get(i) ?? 0) + 1);
    }
    let best = -1;
    let bestCount = 0;
    for (const [i, count] of shared) {
      if (count > bestCount || (count === bestCount && i < best)) {
        best = i;
        bestCount = count;
      }
    }
    if (best < 0) continue;
    const key = roomKey(room);
    const type = getRoomType(prevPlan, prevRooms[best]);
    const name = getRoomName(prevPlan, prevRooms[best]);
    if (type !== 'other') roomTypes[key] = type;
    if (name) roomNames[key] = name;
    if (isRoomLocked(prevPlan, prevRooms[best])) roomLocks[key] = true;
    const finish = prevPlan.roomFinishes?.[roomKey(prevRooms[best])];
    if (finish) roomFinishes[key] = finish;
  }
  const sameFinishes = sameRecord(roomFinishes, nextPlan.roomFinishes ?? {});
  if (sameRecord(roomTypes, nextPlan.roomTypes) && sameRecord(roomNames, nextPlan.roomNames ?? {}) && sameRecord(roomLocks, nextPlan.roomLocks ?? {}) && sameFinishes) return nextPlan;
  const next = { ...nextPlan, roomTypes, roomNames, roomLocks };
  if (Object.keys(roomFinishes).length) next.roomFinishes = roomFinishes;
  else delete next.roomFinishes;
  return next;
}

/**
 * Contours de murs qui ne ferment aucune pièce : groupes de murs reliés entre eux dont aucun côté ne borde
 * une pièce, et d'au moins MIN_OUTLINE_EDGES arêtes (pour ne pas signaler un début de tracé).
 * `ends` liste les extrémités libres (points de grille où un seul mur arrive).
 * @param {Plan} plan
 * @param {Room[]} [rooms] pièces du plan, si elles sont déjà calculées
 * @returns {{ edges: WallEdge[], ends: Point[] }[]}
 */
export function findOpenOutlines(plan, rooms = detectRooms(plan)) {
  const { width } = plan.grid;
  const inRoom = new Set();
  for (const room of rooms) for (const c of room.cells) inRoom.add(c.y * width + c.x);

  // Regroupe les murs qui partagent un point de grille (union-find sur les points).
  const parent = new Map();
  const find = (p) => {
    while (parent.get(p) !== p) {
      parent.set(p, parent.get(parent.get(p)));
      p = parent.get(p);
    }
    return p;
  };
  const ends = (edge) => [
    `${edge.x},${edge.y}`,
    edge.dir === 'h' ? `${edge.x + 1},${edge.y}` : `${edge.x},${edge.y + 1}`,
  ];
  for (const edge of plan.walls) {
    const [a, b] = ends(edge);
    if (!parent.has(a)) parent.set(a, a);
    if (!parent.has(b)) parent.set(b, b);
    parent.set(find(a), find(b));
  }
  const groups = new Map();
  for (const edge of plan.walls) {
    const root = find(ends(edge)[0]);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(edge);
  }

  const borders = (edge) => {
    const [x1, y1, x2, y2] = edge.dir === 'h' ? [edge.x, edge.y - 1, edge.x, edge.y] : [edge.x - 1, edge.y, edge.x, edge.y];
    return inRoom.has(y1 * width + x1) || inRoom.has(y2 * width + x2);
  };

  const outlines = [];
  for (const edges of groups.values()) {
    if (edges.length < MIN_OUTLINE_EDGES || edges.some(borders)) continue;
    const degree = new Map();
    for (const edge of edges) for (const p of ends(edge)) degree.set(p, (degree.get(p) ?? 0) + 1);
    const freeEnds = [...degree]
      .filter(([, n]) => n === 1)
      .map(([p]) => {
        const [x, y] = p.split(',').map(Number);
        return { x, y };
      });
    outlines.push({ edges, ends: freeEnds });
  }
  return outlines;
}

/**
 * Couleur de remplissage d'une pièce selon son type.
 * @param {RoomType} type
 * @param {{ sat: number, light: number }} tone saturation et clarté en % (pastel clair, ou plus sombre en thème sombre)
 * @param {number} [alpha]
 */
export function roomColor(type, tone, alpha = 1) {
  const info = ROOM_TYPE_INFO[type] ?? ROOM_TYPE_INFO.other;
  return `hsla(${info.hue}, ${Math.round(tone.sat * info.mute)}%, ${tone.light}%, ${alpha})`;
}

/* ------------------------------------------------------------------ */
/* Ouvertures : portes, fenêtres, passages                            */
/* Une ouverture occupe `span` arêtes de mur consécutives. Elle ne     */
/* sépare ni ne fusionne les pièces : le mur reste dans plan.walls.    */
/* ------------------------------------------------------------------ */

/** Largeur (en arêtes de 0,5 m), allège et hauteur par défaut de chaque type, en mètres. */
export const OPENING_DEFAULTS = Object.freeze({
  door: Object.freeze({ span: 2, sill: 0, height: 2.05 }),
  window: Object.freeze({ span: 2, sill: 0.9, height: 1.2 }),
  passage: Object.freeze({ span: 2, sill: 0, height: 2.05 }),
});

/** Largeur minimale et maximale d'une ouverture posée à la main, en arêtes de 0,5 m (voir openingSpanLimits pour une autre grille). */
export const OPENING_SPAN_MIN = 1;
export const OPENING_SPAN_MAX = 4;
/** Largeurs de référence d'une ouverture, en mètres : elles ne dépendent pas de la grille. */
export const OPENING_WIDTH_M = Object.freeze({ min: 0.5, max: 2, door: 1, window: 1, passage: 1 });

/** Largeur minimale et maximale d'une ouverture, en arêtes, pour une grille de `cellSize` mètres (de 1 à 4 arêtes à 0,5 m ; de 5 à 20 à 0,1 m). */
export function openingSpanLimits(cellSize = 0.5) {
  const min = Math.max(1, Math.round(OPENING_WIDTH_M.min / cellSize));
  return { min, max: Math.max(min, Math.round(OPENING_WIDTH_M.max / cellSize)) };
}

/** Largeur par défaut d'une ouverture, en arêtes (1 m : 2 arêtes à 0,5 m, 10 à 0,1 m). */
export function defaultOpeningSpan(type, cellSize = 0.5) {
  return Math.max(1, Math.round((OPENING_WIDTH_M[type] ?? 1) / cellSize));
}

export const OPENING_LABELS = Object.freeze({ door: 'Porte', window: 'Fenêtre', passage: 'Passage' });

/** Profondeur de la zone de dégagement devant une porte, en mètres. */
export const CLEARANCE_DEPTH_M = 1;

const roundTo = (value, step) => Number((Math.round(value / step) * step).toFixed(6)); // sans bruit flottant : 1,4 et non 1,4000000000000001

/** Les `span` arêtes occupées par une ouverture. */
export function openingEdges(opening) {
  const { x, y, dir } = opening.start;
  return Array.from({ length: opening.span }, (_, i) => (dir === 'h' ? { x: x + i, y, dir } : { x, y: y + i, dir }));
}

/** Allège (hauteur du bas de l'ouverture) en mètres. */
export function openingSill(opening) {
  return opening.sill ?? OPENING_DEFAULTS[opening.type].sill;
}

/** Hauteur de l'ouverture en mètres. */
export function openingHeight(opening) {
  return opening.height ?? OPENING_DEFAULTS[opening.type].height;
}

/** Axe de l'ouverture : segment entre deux points de grille. */
export function openingSegment(opening) {
  const { x, y, dir } = opening.start;
  return dir === 'h' ? { x1: x, y1: y, x2: x + opening.span, y2: y } : { x1: x, y1: y, x2: x, y2: y + opening.span };
}

/** Vecteurs unitaires de l'ouverture : `u` le long du mur (de la charnière vers l'autre bout), `side` vers le côté d'ouverture. */
export function openingAxes(opening) {
  const horizontal = opening.start.dir === 'h';
  const sign = opening.swing === 'b' ? 1 : -1;
  return { u: horizontal ? { x: 1, y: 0 } : { x: 0, y: 1 }, side: horizontal ? { x: 0, y: sign } : { x: sign, y: 0 } };
}

function occupiedKeys(plan, ignoreId = null) {
  const keys = new Set();
  for (const opening of plan.openings ?? []) {
    if (opening.id === ignoreId) continue;
    for (const edge of openingEdges(opening)) keys.add(edgeKey(edge));
  }
  return keys;
}

/** Erreurs de validatePlan sur les ouvertures : arêtes sans mur, chevauchements. */
function checkOpeningsOnWalls(plan, errors) {
  if (!Array.isArray(plan.walls) || !Array.isArray(plan.openings)) return;
  const walls = new Set(plan.walls.filter(isObj).map(edgeKey));
  const used = new Map();
  plan.openings.forEach((opening, i) => {
    if (!isObj(opening) || !isObj(opening.start) || !WALL_DIRECTIONS.includes(opening.start.dir)) return;
    if (!isInt(opening.start.x) || !isInt(opening.start.y) || !isInt(opening.span) || opening.span < 1) return;
    for (const edge of openingEdges(opening)) {
      const key = edgeKey(edge);
      if (!walls.has(key)) errors.push(`openings[${i}] : l'arête (${edge.x}, ${edge.y}, ${edge.dir}) n'a pas de mur.`);
      if (used.has(key)) errors.push(`openings[${i}] : chevauche openings[${used.get(key)}] sur l'arête (${edge.x}, ${edge.y}, ${edge.dir}).`);
      else used.set(key, i);
    }
  });
}

/**
 * Peut-on poser une ouverture de `span` arêtes à partir de `start` ?
 * @param {Plan} plan
 * @param {WallEdge} start
 * @param {number} span
 * @param {string | null} [ignoreId] ouverture à ne pas compter (pour la redimensionner)
 * @returns {{ ok: boolean, reason?: 'span' | 'no-wall' | 'overlap' }}
 */
export function canPlaceOpening(plan, start, span, ignoreId = null) {
  const limits = openingSpanLimits(plan.grid.cellSize);
  if (!WALL_DIRECTIONS.includes(start?.dir) || !isInt(span) || span < limits.min || span > limits.max) {
    return { ok: false, reason: 'span' };
  }
  const walls = new Set(plan.walls.map(edgeKey));
  const occupied = occupiedKeys(plan, ignoreId);
  const probe = { start, span };
  for (const edge of openingEdges(probe)) {
    const key = edgeKey(edge);
    if (!walls.has(key)) return { ok: false, reason: 'no-wall' };
    if (occupied.has(key)) return { ok: false, reason: 'overlap' };
  }
  return { ok: true };
}

/** Identifiant libre : « o1 », « o2 »… */
export function nextOpeningId(plan) {
  let max = 0;
  for (const { id } of plan.openings) {
    const match = /^o(\d+)$/.exec(id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `o${max + 1}`;
}

/** Ramène allège et hauteur dans les limites des murs : allège de 0 à (murs - 0,1 m), hauteur de 0,1 m au reste. */
function clampHeights(wallHeight, sill, height) {
  const safeSill = Math.min(Math.max(roundTo(sill, 0.01), 0), wallHeight - 0.1);
  const safeHeight = Math.min(Math.max(roundTo(height, 0.01), 0.1), wallHeight - safeSill);
  return { sill: roundTo(safeSill, 0.01), height: roundTo(safeHeight, 0.01) };
}

/**
 * Pose une ouverture. Même plan si elle ne tient pas (pas de mur, chevauchement, largeur hors de 1 à 4 arêtes).
 * La nouvelle ouverture est la dernière de plan.openings.
 * @param {Plan} plan
 * @param {{ type: Opening['type'], start: WallEdge, span?: number, swing?: 'a' | 'b', sill?: number, height?: number }} spec
 */
export function addOpening(plan, spec) {
  if (!OPENING_TYPES.includes(spec.type)) return plan;
  const defaults = OPENING_DEFAULTS[spec.type];
  const span = spec.span ?? defaultOpeningSpan(spec.type, plan.grid.cellSize);
  const start = { x: spec.start.x, y: spec.start.y, dir: spec.start.dir };
  if (!canPlaceOpening(plan, start, span).ok) return plan;
  const { sill, height } = clampHeights(plan.wallHeight, spec.sill ?? defaults.sill, spec.height ?? defaults.height);
  const opening = { id: nextOpeningId(plan), type: spec.type, start, span, swing: spec.swing === 'b' ? 'b' : 'a', sill, height };
  return { ...plan, openings: [...plan.openings, opening] };
}

/** Supprime une ouverture ; le mur reste. Même plan si elle n'existe pas. */
export function removeOpening(plan, id) {
  const openings = plan.openings.filter((opening) => opening.id !== id);
  return openings.length === plan.openings.length ? plan : { ...plan, openings };
}

/** Ouvertures qui reposent encore sur des murs. Renvoie plan.openings lui-même si aucune ne disparaît. */
export function pruneOpenings(plan) {
  const walls = new Set(plan.walls.map(edgeKey));
  const kept = plan.openings.filter((opening) => openingEdges(opening).every((edge) => walls.has(edgeKey(edge))));
  return kept.length === plan.openings.length ? plan.openings : kept;
}

/** Nouveau départ pour une ouverture de largeur `span`, en gardant son centre si possible ; null si elle ne tient pas. */
function fitSpan(plan, opening, span) {
  const { start } = opening;
  const delta = span - opening.span;
  const shifts = [];
  for (let shift = -Math.abs(delta); shift <= Math.abs(delta); shift++) shifts.push(shift);
  const ideal = -delta / 2;
  shifts.sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal) || a - b);
  for (const shift of shifts) {
    const candidate = start.dir === 'h' ? { ...start, x: start.x + shift } : { ...start, y: start.y + shift };
    if (canPlaceOpening(plan, candidate, span, opening.id).ok) return candidate;
  }
  return null;
}

/**
 * Modifie une ouverture : type (allège et hauteur reprennent les valeurs du nouveau type), largeur (1 à 4 arêtes,
 * centrée si possible), côté d'ouverture, allège, hauteur. Même plan si rien ne change ou si la largeur ne tient pas.
 * @param {Plan} plan
 * @param {string} id
 * @param {{ type?: Opening['type'], span?: number, swing?: 'a' | 'b', sill?: number, height?: number }} patch
 */
export function updateOpening(plan, id, patch) {
  const old = plan.openings.find((opening) => opening.id === id);
  if (!old) return plan;
  const next = { ...old, start: { ...old.start } };
  if (patch.type !== undefined && OPENING_TYPES.includes(patch.type) && patch.type !== old.type) {
    next.type = patch.type;
    next.sill = OPENING_DEFAULTS[patch.type].sill;
    next.height = OPENING_DEFAULTS[patch.type].height;
  }
  if (patch.swing !== undefined) next.swing = patch.swing === 'b' ? 'b' : 'a';
  if (patch.span !== undefined && patch.span !== old.span) {
    const limits = openingSpanLimits(plan.grid.cellSize);
    if (!isInt(patch.span) || patch.span < limits.min || patch.span > limits.max) return plan;
    const start = fitSpan(plan, old, patch.span);
    if (!start) return plan;
    next.start = start;
    next.span = patch.span;
  }
  const sill = isNum(patch.sill) ? patch.sill : openingSill(next);
  const height = isNum(patch.height) ? patch.height : openingHeight(next);
  Object.assign(next, clampHeights(plan.wallHeight, sill, height));
  const same =
    next.type === old.type &&
    next.swing === old.swing &&
    next.span === old.span &&
    next.start.x === old.start.x &&
    next.start.y === old.start.y &&
    next.sill === openingSill(old) &&
    next.height === openingHeight(old);
  if (same) return plan;
  return { ...plan, openings: plan.openings.map((opening) => (opening.id === id ? next : opening)) };
}

/** Change le côté d'ouverture d'une porte (ou d'une ouverture). */
export function flipOpening(plan, id) {
  const opening = plan.openings.find((o) => o.id === id);
  return opening ? updateOpening(plan, id, { swing: opening.swing === 'a' ? 'b' : 'a' }) : plan;
}

/** Ouverture la plus proche d'un point de grille décimal, dans la limite de `tolerance` cases ; null sinon. */
export function findOpeningAt(plan, point, tolerance = 0.5) {
  let best = null;
  let bestDistance = tolerance;
  for (const opening of plan.openings) {
    const { x1, y1, x2, y2 } = openingSegment(opening);
    const nearX = Math.min(Math.max(point.x, x1), x2);
    const nearY = Math.min(Math.max(point.y, y1), y2);
    const distance = Math.hypot(point.x - nearX, point.y - nearY);
    if (distance <= bestDistance) {
      best = opening;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Emplacement d'une nouvelle ouverture sous un point de grille décimal : le mur le plus proche, l'ouverture
 * centrée sur le point (décalée si le mur est trop court ou déjà occupé), le côté d'ouverture du côté du point.
 * @returns {{ type: Opening['type'], start: WallEdge, span: number, swing: 'a' | 'b' } | null}
 */
export function findOpeningPlacement(plan, point, type, span = defaultOpeningSpan(type, plan.grid.cellSize), tolerance = 0.6) {
  const wall = findWallEdgeNear(plan, point, tolerance);
  if (!wall) return null;
  const horizontal = wall.dir === 'h';
  const along = horizontal ? point.x : point.y;
  const across = horizontal ? point.y : point.x;
  const line = horizontal ? wall.y : wall.x;
  const ideal = along - span / 2;
  let best = null;
  let bestScore = Infinity;
  for (let s = Math.floor(ideal) - span; s <= Math.ceil(ideal) + span; s++) {
    const start = horizontal ? { x: s, y: line, dir: 'h' } : { x: line, y: s, dir: 'v' };
    if (Math.abs(s + span / 2 - along) > span / 2 + 0.5) continue; // le point doit rester sur l'ouverture
    if (!canPlaceOpening(plan, start, span).ok) continue;
    const score = Math.abs(s - ideal);
    if (score < bestScore) {
      best = start;
      bestScore = score;
    }
  }
  return best ? { type, start: best, span, swing: across < line ? 'a' : 'b' } : null;
}

/**
 * Zones de dégagement des portes, en mètres : pour chaque porte, un rectangle de la largeur de la porte sur
 * CLEARANCE_DEPTH_M (1 m) de profondeur, du côté où elle s'ouvre, à partir de la face du mur.
 * Le générateur de mobilier n'y place rien.
 * @param {Plan} plan
 * @returns {{ openingId: string, x: number, y: number, w: number, h: number }[]} (x, y) est le coin haut gauche
 */
export function getClearanceZones(plan) {
  const cell = plan.grid.cellSize;
  const zones = [];
  for (const opening of plan.openings) {
    if (opening.type !== 'door') continue;
    const { u, side } = openingAxes(opening);
    const width = opening.span * cell;
    const origin = {
      x: opening.start.x * cell + side.x * (WALL_THICKNESS / 2),
      y: opening.start.y * cell + side.y * (WALL_THICKNESS / 2),
    };
    const far = { x: origin.x + u.x * width + side.x * CLEARANCE_DEPTH_M, y: origin.y + u.y * width + side.y * CLEARANCE_DEPTH_M };
    zones.push({
      openingId: opening.id,
      x: Math.min(origin.x, far.x),
      y: Math.min(origin.y, far.y),
      w: Math.abs(far.x - origin.x),
      h: Math.abs(far.y - origin.y),
    });
  }
  return zones;
}

/**
 * Rectangles (en cases) des murs à dessiner, sans les arêtes occupées par une ouverture : le mur est interrompu.
 * Un bout de mur qui touche une ouverture reste droit, sans le dépassement d'une demi-épaisseur.
 * @param {Plan} plan
 * @param {number} thickness épaisseur en cases
 */
export function wallRectsWithOpenings(plan, thickness) {
  const half = thickness / 2;
  const occupied = occupiedKeys(plan);
  const rects = [];
  for (const edge of plan.walls) {
    if (occupied.has(edgeKey(edge))) continue;
    const horizontal = edge.dir === 'h';
    const before = occupied.has(`${edge.dir}${edge.x - (horizontal ? 1 : 0)},${edge.y - (horizontal ? 0 : 1)}`) ? 0 : half;
    const after = occupied.has(`${edge.dir}${edge.x + (horizontal ? 1 : 0)},${edge.y + (horizontal ? 0 : 1)}`) ? 0 : half;
    rects.push(
      horizontal
        ? { x: edge.x - before, y: edge.y - half, w: 1 + before + after, h: thickness }
        : { x: edge.x - half, y: edge.y - before, w: thickness, h: 1 + before + after },
    );
  }
  return rects;
}

/* ------------------------------------------------------------------ */
/* Structure 3D : murs, ouvertures, sols                              */
/* Description pure de la géométrie, sans Three.js : une liste de      */
/* boîtes alignées sur les axes, en mètres, dans le repère 3D          */
/* (plan x → 3D x, plan y → 3D z, hauteur = y).                        */
/* ------------------------------------------------------------------ */

/** Épaisseur des dalles de sol, en mètres. */
export const FLOOR_THICKNESS = 0.03;
/** Hauteur des murs en mode « abaissés », en mètres. */
export const LOWERED_WALL_HEIGHT = 0.3;
/** Largeur des montants d'un cadre de porte ou de fenêtre, en mètres. */
export const FRAME_WIDTH = 0.05;
const FRAME_PROUD = 0.02; // le cadre dépasse du mur de 2 cm de chaque côté
const GLASS_THICKNESS = 0.01;
const BOX_EPSILON = 1e-6;

/**
 * Boîte de la structure. `position` est le centre, `size` les dimensions selon x, y (hauteur) et z.
 * kind : wall | sill (allège) | lintel (linteau) | frame | glass | floor | threshold (seuil).
 * material : wall | frame | glass | threshold | floor:<type de pièce>.
 * kind aussi : tint (peau de couleur) | baseboard (plinthe) | stair (marche) ; `gridLine` = ligne de grille du mur d'une peau ou d'une plinthe.
 * @typedef {{ kind: string, material: string, position: [number, number, number], size: [number, number, number], angle?: number, pitch?: number, openingId?: string, roomId?: string, gridLine?: number }} StructureBox
 */

const r6 = (value) => Math.round(value * 1e6) / 1e6; // sans bruit flottant : 2,1 et non 2,0999999999999996

/** Boîte le long d'un mur : `a` à `b` selon l'axe du mur, `line` = position du mur sur l'autre axe, tout en mètres. */
function wallBox(kind, material, dir, line, a, b, depth, y0, y1, extra = {}) {
  const along = r6((a + b) / 2);
  const length = r6(b - a);
  const y = r6((y0 + y1) / 2);
  const height = r6(y1 - y0);
  line = r6(line);
  return dir === 'h'
    ? { kind, material, position: [along, y, line], size: [length, height, depth], ...extra }
    : { kind, material, position: [line, y, along], size: [depth, height, length], ...extra };
}

/** Boîtes d'une ouverture : parties du mur au-dessus et au-dessous, cadre, vitre, seuil. */
function openingBoxes(plan, opening, wallHeight) {
  const cell = plan.grid.cellSize;
  const { dir } = opening.start;
  const horizontal = dir === 'h';
  const line = (horizontal ? opening.start.y : opening.start.x) * cell;
  const a = (horizontal ? opening.start.x : opening.start.y) * cell;
  const b = a + opening.span * cell;
  const sill = Math.min(Math.max(openingSill(opening), 0), wallHeight);
  const top = Math.min(sill + openingHeight(opening), wallHeight);
  const extra = { openingId: opening.id };
  const depth = WALL_THICKNESS;
  const boxes = [];
  if (sill > BOX_EPSILON) boxes.push(wallBox('sill', 'wall', dir, line, a, b, depth, 0, sill, extra));
  if (top < wallHeight - BOX_EPSILON) boxes.push(wallBox('lintel', 'wall', dir, line, a, b, depth, top, wallHeight, extra));
  if (top - sill < BOX_EPSILON) return boxes;

  const frameDepth = depth + 2 * FRAME_PROUD;
  const frame = (a0, a1, y0, y1) => wallBox('frame', 'frame', dir, line, a0, a1, frameDepth, y0, y1, extra);
  if (opening.type === 'door' || opening.type === 'window') {
    boxes.push(frame(a, a + FRAME_WIDTH, sill, top), frame(b - FRAME_WIDTH, b, sill, top), frame(a, b, top - FRAME_WIDTH, top));
  }
  if (opening.type === 'window') {
    boxes.push(frame(a, b, sill, sill + FRAME_WIDTH));
    if (top - sill > 2 * FRAME_WIDTH + BOX_EPSILON) {
      boxes.push(wallBox('glass', 'glass', dir, line, a + FRAME_WIDTH, b - FRAME_WIDTH, GLASS_THICKNESS, sill + FRAME_WIDTH, top - FRAME_WIDTH, extra));
    }
  }
  if (opening.type !== 'window' && sill < BOX_EPSILON) {
    boxes.push(wallBox('threshold', 'threshold', dir, line, a, b, depth, 0, FLOOR_THICKNESS, extra));
  }
  return boxes;
}

/** Boîtes des murs : arêtes colinéaires fusionnées, prolongées d'une demi-épaisseur sauf contre une ouverture. */
function wallBoxes(plan) {
  const cell = plan.grid.cellSize;
  const half = WALL_THICKNESS / 2;
  const occupied = occupiedKeys(plan);
  const lines = new Map();
  for (const edge of plan.walls) {
    if (occupied.has(edgeKey(edge))) continue;
    const horizontal = edge.dir === 'h';
    const key = `${edge.dir}${horizontal ? edge.y : edge.x}`;
    if (!lines.has(key)) lines.set(key, { dir: edge.dir, line: horizontal ? edge.y : edge.x, positions: [] });
    lines.get(key).positions.push(horizontal ? edge.x : edge.y);
  }
  const boxes = [];
  const keyAt = (dir, line, pos) => (dir === 'h' ? `h${pos},${line}` : `v${line},${pos}`);
  for (const { dir, line, positions } of lines.values()) {
    positions.sort((p, q) => p - q);
    let runStart = positions[0];
    for (let i = 0; i < positions.length; i++) {
      const last = i === positions.length - 1 || positions[i + 1] !== positions[i] + 1;
      if (!last) continue;
      const runEnd = positions[i] + 1; // point de grille de fin
      const before = occupied.has(keyAt(dir, line, runStart - 1)) ? 0 : half;
      const after = occupied.has(keyAt(dir, line, runEnd)) ? 0 : half;
      boxes.push(wallBox('wall', 'wall', dir, line * cell, runStart * cell - before, runEnd * cell + after, WALL_THICKNESS, 0, plan.wallHeight));
      runStart = positions[i + 1];
    }
  }
  return boxes;
}

/**
 * Sols : pour chaque pièce, des boîtes fines (bandes de cases fusionnées en rectangles). À l'étage (`upper`), le sol est un plancher
 * épais qui prend appui sur les murs du dessous, percé des trémies (plan.wells).
 */
function floorBoxes(plan, rooms, upper = false) {
  const cell = plan.grid.cellSize;
  const boxes = [];
  const thickness = upper ? FLOOR_THICKNESS + SLAB_THICKNESS : FLOOR_THICKNESS;
  const holes = upper ? (plan.wells ?? []).flatMap(stairRects) : [];
  for (const room of rooms) {
    const type = getRoomType(plan, room);
    const rows = new Map();
    for (const { x, y } of room.cells) {
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push(x);
    }
    const blocks = [];
    let active = new Map();
    let previousY = null;
    for (const y of [...rows.keys()].sort((p, q) => p - q)) {
      if (previousY !== null && y !== previousY + 1) active = new Map();
      previousY = y;
      const xs = rows.get(y).sort((p, q) => p - q);
      const next = new Map();
      let start = xs[0];
      for (let i = 0; i < xs.length; i++) {
        if (i < xs.length - 1 && xs[i + 1] === xs[i] + 1) continue;
        const key = `${start},${xs[i] + 1}`;
        let block = active.get(key);
        if (block) block.y1 = y + 1;
        else {
          block = { x0: start, x1: xs[i] + 1, y0: y, y1: y + 1 };
          blocks.push(block);
        }
        next.set(key, block);
        start = xs[i + 1];
      }
      active = next;
    }
    const finishFloor = plan.roomFinishes?.[roomKey(room)]?.floor;
    for (const { x0, x1, y0, y1 } of blocks) {
      const box = {
        kind: 'floor',
        material: finishFloor ? `floor:${finishFloor}` : `floor:${type}`,
        position: [r6(((x0 + x1) / 2) * cell), r6(FLOOR_THICKNESS - thickness / 2), r6(((y0 + y1) / 2) * cell)],
        size: [r6((x1 - x0) * cell), r6(thickness), r6((y1 - y0) * cell)],
        roomId: room.id,
      };
      if (holes.length) boxes.push(...cutFloorBox(box, holes));
      else boxes.push(box);
    }
  }
  return boxes;
}

/** Plafond du niveau : une dalle de 10 cm posée sur les murs, au-dessus des pièces (le soleil n'entre que par les ouvertures). */
function roofBoxes(plan, rooms) {
  return floorBoxes(plan, rooms, false).map((box) => ({
    ...box,
    kind: 'roof',
    material: 'roof',
    position: [box.position[0], r6(plan.wallHeight + ROOF_THICKNESS / 2), box.position[2]],
    size: [box.size[0], ROOF_THICKNESS, box.size[2]],
  }));
}
const ROOF_THICKNESS = 0.1;

/** Coupe une boîte à la hauteur `maxHeight` ; null si elle disparaît. Les sols et seuils ne sont jamais coupés. */
function clipBox(box, maxHeight) {
  if (box.kind === 'floor' || box.kind === 'threshold' || box.kind === 'tint' || box.kind === 'stair' || box.kind === 'rail' || box.kind === 'baseboard') return box;
  const bottom = box.position[1] - box.size[1] / 2;
  const top = Math.min(box.position[1] + box.size[1] / 2, maxHeight);
  if (top - bottom < BOX_EPSILON) return null;
  return { ...box, position: [box.position[0], (bottom + top) / 2, box.position[2]], size: [box.size[0], top - bottom, box.size[2]] };
}

const TINT_DEPTH = 0.006; // peau de couleur posée sur la face intérieure des murs

/**
 * « Peaux » de couleur des murs, une matière par pièce (`tint:<id de la pièce>`) : de fines boîtes collées contre la face
 * intérieure de chaque mur, côté pièce, y compris au-dessus et au-dessous des ouvertures. Le viewer leur donne la couleur de
 * mur du logement, légèrement variée d'une pièce à l'autre. Les arêtes d'ouverture n'ont de peau que hors de l'ouverture.
 * @param {Plan} plan
 * @param {Room[]} rooms
 * @param {{ maxHeight?: number }} [options]
 * @returns {StructureBox[]}
 */
export function buildWallTints(plan, rooms, { maxHeight = Infinity } = {}) {
  const cell = plan.grid.cellSize;
  const wallHeight = plan.wallHeight;
  const top = Math.min(wallHeight, maxHeight);
  const owner = new Map();
  for (const room of rooms) for (const c of room.cells) owner.set(`${c.x},${c.y}`, room.id);
  const occupied = occupiedKeys(plan);
  const walls = new Set(plan.walls.map(edgeKey));
  const segments = new Map(); // clé de bande → positions le long du mur
  const add = (edge, y0, y1) => {
    const h = edge.dir === 'h';
    const sides = h ? [[-1, `${edge.x},${edge.y - 1}`], [1, `${edge.x},${edge.y}`]] : [[-1, `${edge.x - 1},${edge.y}`], [1, `${edge.x},${edge.y}`]];
    const hi = Math.min(y1, top);
    if (hi - y0 < BOX_EPSILON) return;
    for (const [side, cellKey] of sides) {
      const roomId = owner.get(cellKey);
      if (!roomId) continue;
      const line = h ? edge.y : edge.x;
      const key = `${roomId}|${edge.dir}|${line}|${side}|${y0}|${hi}`;
      if (!segments.has(key)) segments.set(key, []);
      segments.get(key).push(h ? edge.x : edge.y);
    }
  };
  for (const edge of plan.walls) if (!occupied.has(edgeKey(edge))) add(edge, 0, wallHeight);
  for (const opening of plan.openings ?? []) {
    const sill = Math.min(Math.max(openingSill(opening), 0), wallHeight);
    const lintel = Math.min(sill + openingHeight(opening), wallHeight);
    for (const edge of openingEdges(opening)) {
      if (!walls.has(edgeKey(edge))) continue;
      if (sill > BOX_EPSILON) add(edge, 0, sill);
      if (lintel < wallHeight - BOX_EPSILON) add(edge, lintel, wallHeight);
    }
  }
  const boxes = [];
  const offset = WALL_THICKNESS / 2 + TINT_DEPTH / 2;
  const boards = new Map(); // pièce → plinthe choisie
  for (const room of rooms) {
    const board = plan.roomFinishes?.[roomKey(room)]?.baseboard;
    if (board && board !== 'none') boards.set(room.id, board);
  }
  for (const [key, positions] of segments) {
    const [roomId, dir, line, side, y0, y1] = key.split('|');
    positions.sort((p, q) => p - q);
    let start = positions[0];
    for (let i = 0; i < positions.length; i++) {
      if (i < positions.length - 1 && positions[i + 1] === positions[i] + 1) continue;
      boxes.push(wallBox('tint', `tint:${roomId}`, dir, Number(line) * cell + Number(side) * offset, start * cell, (positions[i] + 1) * cell, TINT_DEPTH, Number(y0), Number(y1), { roomId, gridLine: Number(line) }));
      const board = boards.get(roomId);
      if (board && Number(y0) === 0) {
        const lift = Math.min(BASEBOARD.height, Number(y1));
        boxes.push(wallBox('baseboard', `baseboard:${board}`, dir, Number(line) * cell + Number(side) * (WALL_THICKNESS / 2 + BASEBOARD.depth / 2), start * cell, (positions[i] + 1) * cell, BASEBOARD.depth, 0, lift, { roomId, gridLine: Number(line) }));
      }
      start = positions[i + 1];
    }
  }
  return boxes;
}

/**
 * Géométrie 3D d'un plan : murs (0,1 m d'épaisseur, centrés sur la ligne de grille), ouvertures découpées en boîtes
 * (sans CSG), cadres, vitres, seuils et sols par pièce. Aucun Three.js : c'est une simple liste de boîtes testable.
 * @param {Plan} plan
 * @param {{ maxHeight?: number, rooms?: Room[], tints?: boolean, upper?: boolean }} [options] `maxHeight` abaisse les murs (ex. LOWERED_WALL_HEIGHT) ;
 *   `rooms` évite de recalculer les pièces ; `tints` ajoute les peaux de couleur des murs par pièce (buildWallTints) ; `upper` : niveau
 *   au-dessus du rez-de-chaussée (plancher épais, percé des trémies) ; `roof` ajoute un plafond (kind « roof ») au-dessus des pièces : il ne sert
 *   qu'au calcul de l'ensoleillement. Les escaliers du niveau (plan.stairs) ajoutent leurs marches.
 * @returns {{ boxes: StructureBox[], wallHeight: number }}
 */
export function buildStructure(plan, { maxHeight = Infinity, rooms = detectRooms(plan), tints = false, upper = false, roof = false } = {}) {
  const wallHeight = plan.wallHeight;
  const boxes = [...floorBoxes(plan, rooms, upper), ...wallBoxes(plan)];
  if (roof) boxes.push(...roofBoxes(plan, rooms));
  for (const opening of plan.openings ?? []) boxes.push(...openingBoxes(plan, opening, wallHeight));
  for (const stair of plan.stairs ?? []) boxes.push(...stairBoxes(stair, wallHeight, plan));
  if (upper) for (const well of plan.wells ?? []) boxes.push(...stairWellBoxes(well, wallHeight, plan));
  const clipped = Number.isFinite(maxHeight) ? boxes.map((box) => clipBox(box, maxHeight)).filter(Boolean) : boxes;
  if (tints) clipped.push(...buildWallTints(plan, rooms, { maxHeight }));
  return { boxes: clipped, wallHeight: Math.min(wallHeight, maxHeight) };
}

/**
 * Murs extérieurs, pour le mode « murs automatiques » : marque chaque boîte de mur (mur, allège, linteau, cadre, vitre, peau de couleur)
 * qui fait partie d'un mur dont UN SEUL côté donne sur l'extérieur (aucune pièce de ce côté) avec
 * `exterior: { side, line }` : `side` = côté extérieur ('n' = vers les y décroissants, 's', 'w', 'e'), `line` = position du mur en mètres
 * (z pour 'n' et 's', x pour 'w' et 'e'). Une boîte dont les arêtes ne sont pas toutes extérieures du même côté reste visible.
 * Les boîtes d'origine ne sont pas modifiées ; les autres boîtes (sols, seuils) sont renvoyées telles quelles.
 * @param {Plan} plan
 * @param {StructureBox[]} boxes
 * @param {Room[]} [rooms]
 * @returns {StructureBox[]}
 */
export function tagExteriorBoxes(plan, boxes, rooms = detectRooms(plan)) {
  const cs = plan.grid.cellSize;
  const inside = new Set();
  for (const room of rooms) for (const c of room.cells) inside.add(`${c.x},${c.y}`);
  const openings = new Map((plan.openings ?? []).map((o) => [o.id, o]));
  /** Côté extérieur d'une arête : 'n' | 's' | 'w' | 'e' | null (intérieure, ou des deux côtés dehors). */
  const sideOf = (edge) => {
    const a = edge.dir === 'h' ? `${edge.x},${edge.y - 1}` : `${edge.x - 1},${edge.y}`;
    const b = `${edge.x},${edge.y}`;
    const aIn = inside.has(a);
    const bIn = inside.has(b);
    if (aIn === bIn) return null;
    if (edge.dir === 'h') return aIn ? 's' : 'n';
    return aIn ? 'e' : 'w';
  };
  const tag = (edges, line) => {
    if (edges.length === 0) return null;
    const side = sideOf(edges[0]);
    if (!side || edges.some((edge) => sideOf(edge) !== side)) return null;
    return { side, line };
  };
  return boxes.map((box) => {
    if (!['wall', 'sill', 'lintel', 'frame', 'glass', 'tint', 'baseboard'].includes(box.kind)) return box;
    const [cx, , cz] = box.position;
    const [sx, , sz] = box.size;
    let edges;
    let line;
    const opening = box.openingId ? openings.get(box.openingId) : null;
    if (opening) {
      edges = openingEdges(opening);
      line = (opening.start.dir === 'h' ? opening.start.y : opening.start.x) * cs;
    } else if (sx >= sz) {
      const j = box.gridLine ?? Math.round(cz / cs);
      line = j * cs;
      const first = Math.floor((cx - sx / 2) / cs + 1e-6) + (box.kind === 'wall' ? 0 : 0);
      const last = Math.ceil((cx + sx / 2) / cs - 1e-6) - 1;
      edges = [];
      for (let i = first; i <= last; i++) edges.push({ dir: 'h', x: i, y: j });
    } else {
      const i = box.gridLine ?? Math.round(cx / cs);
      line = i * cs;
      const first = Math.floor((cz - sz / 2) / cs + 1e-6);
      const last = Math.ceil((cz + sz / 2) / cs - 1e-6) - 1;
      edges = [];
      for (let j = first; j <= last; j++) edges.push({ dir: 'v', x: i, y: j });
    }
    // Une extrémité qui dépasse d'une demi-épaisseur aux angles ne compte pas comme une arête de plus.
    edges = edges.filter((edge) => plan.walls.some((w) => w.dir === edge.dir && w.x === edge.x && w.y === edge.y));
    const exterior = tag(edges, line);
    return exterior ? { ...box, exterior } : box;
  });
}

/**
 * Emprise des murs en mètres, marge comprise, pour cadrer la caméra ; toute la grille si le plan n'a pas de mur.
 * @param {Plan} plan
 * @param {number} [margin] marge en mètres autour des murs
 * @returns {{ minX: number, minZ: number, maxX: number, maxZ: number, empty: boolean }}
 */
export function getPlanExtent(plan, margin = 1) {
  const { width, height, cellSize } = plan.grid;
  if (plan.walls.length === 0) return { minX: 0, minZ: 0, maxX: width * cellSize, maxZ: height * cellSize, empty: true };
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const { x, y, dir } of plan.walls) {
    minX = Math.min(minX, x);
    minZ = Math.min(minZ, y);
    maxX = Math.max(maxX, dir === 'h' ? x + 1 : x);
    maxZ = Math.max(maxZ, dir === 'v' ? y + 1 : y);
  }
  return {
    minX: minX * cellSize - margin,
    minZ: minZ * cellSize - margin,
    maxX: maxX * cellSize + margin,
    maxZ: maxZ * cellSize + margin,
    empty: false,
  };
}

/* ------------------------------------------------------------------ */
/* Fichiers : migration, lecture, export, code de partage             */
/* ------------------------------------------------------------------ */

/** Identité et version de l'enveloppe des fichiers .json exportés. */
export const PLAN_FILE_APP = 'maison-3d';
export const PLAN_FILE_FORMAT = 1;
/** Au-delà, un texte à importer est refusé sans être analysé. */
export const PLAN_FILE_MAX_CHARS = 8_000_000;

/**
 * Migrations : MIGRATIONS[n] transforme un plan de version n en plan de version n + 1 (sans modifier son argument).
 * Pour ajouter une version : incrémenter PLAN_VERSION, ajouter MIGRATIONS[ancienne version] et un test.
 * - 1 → 2 : plan à un niveau → document `levels` (voir docFromPlan).
 * - 0 → 1 : version 0 = plans enregistrés avant la phase 2, sans `version`, et parfois sans roomNames, roomLocks, style ni
 *   furniture, ni swing / identifiant sur les ouvertures. On complète avec les valeurs par défaut.
 */
export const MIGRATIONS = Object.freeze({
  0: (old) => ({
    ...old,
    version: 1,
    grid: isObj(old.grid) ? old.grid : { ...DEFAULT_GRID },
    wallHeight: old.wallHeight ?? DEFAULT_WALL_HEIGHT,
    walls: old.walls ?? [],
    openings: (old.openings ?? []).map((o, i) => (isObj(o) ? { id: `o${i + 1}`, swing: 'a', ...o } : o)),
    roomTypes: old.roomTypes ?? {},
    roomNames: old.roomNames ?? {},
    roomLocks: old.roomLocks ?? {},
    style: old.style ?? { preset: 'scandinave', seed: 1 },
    furniture: old.furniture ?? [],
  }),
  /** 1 → 2 : le plan à un seul niveau devient le rez-de-chaussée d'un document à étages (éclairage par défaut). */
  1: (old) => docFromPlan(normalizePlan(old)),
});

const describeValue = (v) => (v === undefined ? 'absent' : typeof v === 'string' ? `"${v}"` : isObj(v) || Array.isArray(v) ? 'un objet' : String(v));

/**
 * Amène un plan de n'importe quelle version connue à PLAN_VERSION. Ne valide pas le plan (voir readPlan) et ne modifie pas l'original.
 * @param {unknown} input
 * @returns {{ ok: true, plan: Plan, from: number, migrated: boolean, errors: [] } | { ok: false, errors: string[] }}
 */
export function migratePlan(input) {
  if (!isObj(input)) return { ok: false, errors: ['Le plan doit être un objet.'] };
  const from = input.version === undefined ? 0 : input.version;
  if (!isInt(from) || from < 0) return { ok: false, errors: [`Version de plan invalide : ${describeValue(from)}.`] };
  if (from > PLAN_VERSION) {
    return {
      ok: false,
      errors: [`Ce plan vient d'une version plus récente de Maison 3D (version ${from} ; cette page lit jusqu'à la version ${PLAN_VERSION}).`],
    };
  }
  let plan;
  try {
    plan = JSON.parse(JSON.stringify(input));
  } catch {
    return { ok: false, errors: ['Le plan contient des valeurs qui ne peuvent pas être lues (JSON impossible).'] };
  }
  for (let v = from; v < PLAN_VERSION; v++) plan = MIGRATIONS[v](plan);
  return { ok: true, plan, from, migrated: from !== PLAN_VERSION, errors: [] };
}

/** Retire les clés de roomTypes / roomNames / roomLocks qui ne correspondent à aucune pièce. Même plan si rien à retirer. */
function pruneOrphanKeys(plan) {
  const anchors = new Set(detectRooms(plan).map(roomKey));
  let next = plan;
  for (const field of ['roomTypes', 'roomNames', 'roomLocks', 'roomFinishes']) {
    const entries = Object.entries(next[field] ?? {});
    const kept = entries.filter(([key]) => anchors.has(key));
    if (kept.length !== entries.length) next = { ...next, [field]: Object.fromEntries(kept) };
  }
  return next;
}

/**
 * Lit un plan venu de l'extérieur (fichier, lien, ancienne sauvegarde) : migration, valeurs par défaut des champs facultatifs,
 * validation complète, puis retrait des clés de pièces orphelines (reliquat d'une modification de murs).
 * @param {unknown} input
 * @param {{ furnitureIds?: Iterable<string> | null }} [options]
 * @returns {{ ok: true, plan: Plan, from: number, migrated: boolean, errors: [] } | { ok: false, errors: string[] }}
 */
export function readPlan(input, { furnitureIds = null } = {}) {
  const migration = migratePlan(input);
  if (!migration.ok) return migration;
  const doc = normalizeDocument(migration.plan);
  const structure = collectDocErrors(doc, { furnitureIds, crossRefs: false });
  if (!structure.valid) return { ok: false, errors: structure.errors };
  let pruned = doc;
  doc.levels.forEach((level, i) => {
    const view = levelPlan(pruned, i);
    const cleaned = pruneOrphanKeys(view);
    if (cleaned !== view) pruned = withLevelPlan(pruned, i, cleaned);
  });
  const full = collectDocErrors(pruned, { furnitureIds, crossRefs: true });
  if (!full.valid) return { ok: false, errors: full.errors };
  return { ok: true, plan: pruned, from: migration.from, migrated: migration.migrated, errors: [] };
}

/** Erreurs d'un document : racine (version, éclairage, niveaux) puis chaque niveau (préfixé « niveau n » quand il y en a plusieurs). */
function collectDocErrors(doc, { furnitureIds = null, crossRefs = true } = {}) {
  const errors = [];
  if (!isObj(doc)) return { valid: false, errors: ['Le plan doit être un objet.'] };
  if (doc.version !== PLAN_VERSION) errors.push(`Version de plan non prise en charge : ${String(doc.version)} (attendu : ${PLAN_VERSION}).`);
  if (!Array.isArray(doc.levels) || doc.levels.length < 1 || doc.levels.length > PLAN_LIMITS.levelsMax) {
    errors.push(`levels : de 1 à ${PLAN_LIMITS.levelsMax} niveaux sont attendus.`);
    return { valid: false, errors };
  }
  if (doc.lighting !== undefined) {
    const l = doc.lighting;
    if (!isObj(l)) errors.push('lighting : doit être un objet.');
    else {
      if (!isNum(l.hour) || l.hour < 0 || l.hour > 24) errors.push('lighting : hour doit être un nombre de 0 à 24.');
      if (!isInt(l.month) || l.month < 1 || l.month > 12) errors.push('lighting : month doit être un entier de 1 à 12.');
      if (!isNum(l.north) || l.north < -360 || l.north > 360) errors.push('lighting : north doit être un angle en degrés (−360 à 360).');
      if (!isNum(l.latitude) || Math.abs(l.latitude) > 66) errors.push('lighting : latitude doit être comprise entre −66 et 66 degrés.');
      if (!LAMP_MODES.includes(l.lamps)) errors.push(`lighting : lamps doit valoir ${LAMP_MODES.join(', ')}.`);
    }
  }
  const ids = new Set();
  const many = doc.levels.length > 1;
  doc.levels.forEach((level, i) => {
    const prefix = many ? `niveau ${i + 1} : ` : '';
    if (!isObj(level)) {
      errors.push(`${prefix}le niveau doit être un objet.`);
      return;
    }
    if (typeof level.id !== 'string' || !level.id) errors.push(`${prefix}id manquant.`);
    else if (ids.has(level.id)) errors.push(`${prefix}id "${level.id}" en double.`);
    else ids.add(level.id);
    if (typeof level.name !== 'string' || !level.name || level.name.length > LEVEL_NAME_MAX) errors.push(`${prefix}le nom doit être un texte de 1 à ${LEVEL_NAME_MAX} caractères.`);
    if (i === doc.levels.length - 1 && level.stairs?.length) errors.push(`${prefix}un escalier monte vers un niveau qui n'existe pas (dernier niveau).`);
    const result = collectPlanErrors(levelPlan(doc, i), { furnitureIds, crossRefs });
    for (const message of result.errors) errors.push(prefix + message);
  });
  return { valid: errors.length === 0, errors };
}

/**
 * Texte d'un fichier d'export : une enveloppe { app, format, name, exportedAt, plan }, le plan sur une seule ligne.
 * @param {object} plan un document (un plan à un niveau est enveloppé)
 * @param {{ name?: string, now?: Date }} [options]
 */
export function exportPlanText(plan, { name = '', now = new Date() } = {}) {
  return `{\n"app": ${JSON.stringify(PLAN_FILE_APP)},\n"format": ${PLAN_FILE_FORMAT},\n"name": ${JSON.stringify(String(name))},\n"exportedAt": ${JSON.stringify(now.toISOString())},\n"plan": ${JSON.stringify(normalizeDocument(plan))}\n}\n`;
}

/**
 * Lit le texte d'un fichier ou d'un collage : enveloppe d'export ou plan brut (ancien format compris).
 * Toutes les erreurs sont en français, prêtes à afficher.
 * @param {string} text
 * @param {{ furnitureIds?: Iterable<string> | null }} [options]
 * @returns {{ ok: true, plan: Plan, name: string, from: number, migrated: boolean, errors: [] } | { ok: false, errors: string[] }}
 */
export function parsePlanText(text, options = {}) {
  if (typeof text !== 'string') return { ok: false, errors: ['Aucun texte à lire.'] };
  if (text.length > PLAN_FILE_MAX_CHARS) return { ok: false, errors: ['Le fichier est trop volumineux pour un plan Maison 3D.'] };
  const source = text.replace(/^﻿/, '').trim();
  if (!source) return { ok: false, errors: ['Le fichier est vide.'] };
  if (source.length > PLAN_FILE_MAX_CHARS) return { ok: false, errors: ['Le fichier est trop volumineux pour un plan Maison 3D.'] };
  let data;
  try {
    data = JSON.parse(source);
  } catch (error) {
    return { ok: false, errors: [`Ce texte n'est pas du JSON valide (${String(error?.message ?? error)}). Le fichier est peut-être tronqué ou abîmé.`] };
  }
  if (!isObj(data)) return { ok: false, errors: ['Ce JSON ne décrit pas un plan : un objet est attendu.'] };
  let name = '';
  let planData = data;
  if (data.app !== undefined) {
    if (data.app !== PLAN_FILE_APP) return { ok: false, errors: [`Ce fichier n'est pas un plan Maison 3D (application « ${String(data.app)} »).`] };
    if (!isInt(data.format) || data.format < 1 || data.format > PLAN_FILE_FORMAT) {
      return { ok: false, errors: [`Format de fichier non pris en charge : ${describeValue(data.format)} (cette page lit le format ${PLAN_FILE_FORMAT}).`] };
    }
    if (!isObj(data.plan)) return { ok: false, errors: ['Le fichier ne contient pas de plan (champ « plan » manquant).'] };
    planData = data.plan;
    if (typeof data.name === 'string') name = data.name.slice(0, 80);
  } else if (!('walls' in data) && !('grid' in data)) {
    return { ok: false, errors: ['Ce JSON ne ressemble pas à un plan Maison 3D (ni murs, ni grille).'] };
  }
  const result = readPlan(planData, options);
  return result.ok ? { ...result, name } : result;
}

/**
 * Extrait le code de partage d'un lien (…#plan=CODE), d'un fragment ou d'un code seul. Renvoie null s'il n'y en a pas.
 * Les caractères de lz-string « EncodedURIComponent » : lettres, chiffres, + - $.
 * @param {string} text
 */
export function extractShareCode(text) {
  if (typeof text !== 'string') return null;
  const source = text.trim();
  const match = /(?:^|[#&?])plan=([A-Za-z0-9+\-$%]+)/.exec(source);
  if (match) return decodeURIComponent(match[1].replace(/\+/g, '%2B'));
  return /^[A-Za-z0-9+\-$]{16,}$/.test(source) ? source : null;
}

/* ------------------------------------------------------------------ */
/* Archive .zip (secours quand le navigateur refuse un téléchargement .glb) */
/* ------------------------------------------------------------------ */

let crcTable = null;

/** Somme de contrôle CRC-32 (celle des fichiers .zip) d'un Uint8Array. */
export function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Archive .zip sans compression (méthode « stockée ») de fichiers { name, data: Uint8Array }.
 * @param {{ name: string, data: Uint8Array }[]} files
 * @param {Date} [date]
 * @returns {Uint8Array}
 */
export function zipStore(files, date = new Date()) {
  const encoder = new TextEncoder();
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const dosDate = (Math.max(0, date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const parts = [];
  const central = [];
  let offset = 0;
  const push = (chunk) => {
    parts.push(chunk);
    offset += chunk.length;
  };
  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const header = new DataView(new ArrayBuffer(30));
    header.setUint32(0, 0x04034b50, true);
    header.setUint16(4, 20, true);
    header.setUint16(6, 0x0800, true); // noms en UTF-8
    header.setUint16(8, 0, true); // stockée
    header.setUint16(10, dosTime, true);
    header.setUint16(12, dosDate, true);
    header.setUint32(14, crc, true);
    header.setUint32(18, file.data.length, true);
    header.setUint32(22, file.data.length, true);
    header.setUint16(26, name.length, true);
    header.setUint16(28, 0, true);
    central.push({ name, crc, size: file.data.length, offset, dosTime, dosDate });
    push(new Uint8Array(header.buffer));
    push(name);
    push(file.data);
  }
  const centralStart = offset;
  for (const entry of central) {
    const header = new DataView(new ArrayBuffer(46));
    header.setUint32(0, 0x02014b50, true);
    header.setUint16(4, 20, true);
    header.setUint16(6, 20, true);
    header.setUint16(8, 0x0800, true);
    header.setUint16(10, 0, true);
    header.setUint16(12, entry.dosTime, true);
    header.setUint16(14, entry.dosDate, true);
    header.setUint32(16, entry.crc, true);
    header.setUint32(20, entry.size, true);
    header.setUint32(24, entry.size, true);
    header.setUint16(28, entry.name.length, true);
    header.setUint32(42, entry.offset, true);
    push(new Uint8Array(header.buffer));
    push(entry.name);
  }
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, central.length, true);
  end.setUint16(10, central.length, true);
  end.setUint32(12, offset - centralStart, true);
  end.setUint32(16, centralStart, true);
  push(new Uint8Array(end.buffer));
  const out = new Uint8Array(offset);
  let at = 0;
  for (const chunk of parts) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/** Nom de fichier sûr (sans accents ni caractères spéciaux) à partir d'un nom de projet. */
export function fileSlug(name, fallback = 'maison-3d') {
  const slug = String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || fallback;
}

/* ------------------------------------------------------------------ */
/* Modèles de départ                                                  */
/* ------------------------------------------------------------------ */

/**
 * Construit un plan à partir d'une description : contour, cloisons, portes, passages, fenêtres (arête de départ : 'h' = trait
 * horizontal, 'v' = trait vertical) et type des pièces (une case à l'intérieur de chaque pièce). Toutes les coordonnées sont en cases.
 */
function planFromSpec(spec) {
  const [x0, y0, x1, y1] = spec.box;
  let plan = createEmptyPlan();
  const wall = (ax, ay, bx, by) => {
    plan = addWallSegments(plan, { x: ax, y: ay }, { x: bx, y: by });
  };
  wall(x0, y0, x1, y0);
  wall(x1, y0, x1, y1);
  wall(x1, y1, x0, y1);
  wall(x0, y1, x0, y0);
  for (const [ax, ay, bx, by] of spec.walls ?? []) wall(ax, ay, bx, by);
  for (const [type, list] of [['door', spec.doors], ['passage', spec.passages], ['window', spec.windows]]) {
    for (const [dir, x, y, swing] of list ?? []) plan = addOpening(plan, { type, start: { x, y, dir }, swing: swing ?? 'a' });
  }
  const rooms = detectRooms(plan);
  for (const [x, y, type] of spec.rooms) {
    const room = roomAtCell(rooms, x, y);
    if (room) plan = setRoomInfo(plan, room, { type });
  }
  return plan;
}

/**
 * Plans de départ proposés à l'écran d'accueil : sans mobilier (on le génère ensuite), pièces déjà typées. Leurs noms et descriptions
 * sont dans LABELS.templates (ui.js). Chaque porte, passage et fenêtre décrit doit avoir trouvé son mur (testé).
 */
export const TEMPLATES = Object.freeze([
  {
    id: 'studio',
    spec: {
      box: [2, 2, 14, 12],
      walls: [[10, 2, 10, 7], [10, 7, 14, 7]],
      doors: [['h', 4, 12], ['v', 10, 3]],
      windows: [['h', 4, 2], ['v', 2, 5], ['v', 14, 9], ['h', 12, 2]],
      rooms: [[3, 3, 'living'], [11, 3, 'bathroom']],
    },
  },
  {
    id: 't2',
    spec: {
      box: [2, 2, 22, 14],
      walls: [[12, 2, 12, 14], [12, 7, 22, 7], [18, 7, 18, 14]],
      doors: [['h', 4, 14], ['v', 12, 3], ['v', 12, 9], ['v', 18, 9]],
      windows: [['h', 5, 2], ['v', 2, 5], ['v', 2, 10], ['h', 15, 2], ['v', 22, 3], ['h', 14, 14], ['v', 22, 10]],
      rooms: [[3, 3, 'living'], [13, 3, 'kitchen'], [13, 8, 'bedroom'], [19, 8, 'bathroom']],
    },
  },
  {
    id: 't3',
    spec: {
      box: [2, 2, 24, 16],
      walls: [[12, 2, 12, 16], [16, 2, 16, 16], [2, 11, 12, 11], [16, 7, 24, 7], [16, 10, 24, 10]],
      doors: [['h', 13, 16], ['v', 12, 4], ['v', 12, 12], ['v', 16, 3], ['v', 16, 8], ['v', 16, 12]],
      windows: [['h', 4, 2], ['h', 8, 2], ['v', 2, 5], ['v', 2, 13], ['h', 6, 16], ['h', 19, 2], ['v', 24, 4], ['h', 19, 16], ['v', 24, 12], ['v', 24, 8]],
      rooms: [[3, 3, 'living'], [3, 12, 'kitchen'], [13, 3, 'hallway'], [17, 3, 'bedroom'], [17, 8, 'bathroom'], [17, 11, 'bedroom']],
    },
  },
  {
    id: 'house4',
    spec: {
      box: [2, 2, 26, 18],
      walls: [[16, 2, 16, 18], [2, 12, 16, 12], [16, 12, 26, 12]],
      doors: [['v', 2, 6], ['v', 16, 4], ['v', 16, 14], ['h', 19, 12]],
      passages: [['h', 8, 12]],
      windows: [['h', 5, 2], ['h', 10, 2], ['v', 2, 9], ['v', 2, 15], ['h', 6, 18], ['h', 12, 18], ['h', 20, 2], ['v', 26, 5], ['v', 26, 8], ['v', 26, 15]],
      rooms: [[3, 3, 'living'], [3, 13, 'kitchen'], [17, 3, 'bedroom'], [17, 13, 'bathroom']],
    },
  },
]);

/** Plan neuf d'un modèle de départ (undefined si l'identifiant est inconnu). */
export function buildTemplate(id) {
  const template = TEMPLATES.find((item) => item.id === id);
  return template ? planFromSpec(template.spec) : undefined;
}

/* ------------------------------------------------------------------ */
/* Document v2 : étages, escaliers, finitions, éclairage               */
/*                                                                     */
/* Le fichier / projet enregistré est un DOCUMENT : { version: 2, grid, wallHeight, style, lighting, levels: [niveau…] }. Chaque */
/* niveau porte ce qui change d'un étage à l'autre (murs, ouvertures, pièces, mobilier, escaliers, finitions). Toutes les fonctions */
/* pures de ce fichier et du générateur travaillent sur la « vue d'un niveau » : un plan à plat (levelPlan) de la forme d'avant, */
/* avec en plus `stairs` (escaliers qui montent de ce niveau) et `wells` (trémies : escaliers venus du niveau du dessous) quand ils existent. */
/* ------------------------------------------------------------------ */

/** Épaisseur du plancher entre deux niveaux, en mètres : l'étage n est à n × (hauteur des murs + SLAB_THICKNESS). */
export const SLAB_THICKNESS = 0.2;

/** Champs propres à un niveau. */
export const LEVEL_FIELDS = Object.freeze(['walls', 'openings', 'roomTypes', 'roomNames', 'roomLocks', 'roomFinishes', 'furniture', 'stairs']);

/** Éclairage du logement (au niveau du document). `north` : angle en degrés dont le plan est tourné par rapport au nord (0 = le nord est en haut du plan, 90 = à droite). */
export const DEFAULT_LIGHTING = Object.freeze({ hour: 15, month: 6, north: 0, latitude: 48.85, lamps: 'auto' });
export const LAMP_MODES = Object.freeze(['auto', 'on', 'off']);

/** Nom par défaut d'un niveau. */
export function levelName(index) {
  return index === 0 ? 'Rez-de-chaussée' : `Étage ${index}`;
}

const LEVEL_NAME_MAX = 30;

function newLevel(id, name, fields = {}) {
  return { id, name, walls: [], openings: [], roomTypes: {}, roomNames: {}, roomLocks: {}, roomFinishes: {}, furniture: [], stairs: [], ...fields };
}

/** Document neuf : un seul niveau vide. */
export function createEmptyDocument(options = {}) {
  const flat = createEmptyPlan(options);
  return docFromPlan(flat);
}

/** Enveloppe un plan à plat (version 1) dans un document à un seul niveau. */
export function docFromPlan(plan) {
  return {
    version: PLAN_VERSION,
    grid: plan.grid,
    wallHeight: plan.wallHeight,
    style: plan.style,
    lighting: { ...DEFAULT_LIGHTING },
    levels: [
      newLevel('n1', levelName(0), {
        walls: plan.walls ?? [],
        openings: plan.openings ?? [],
        roomTypes: plan.roomTypes ?? {},
        roomNames: plan.roomNames ?? {},
        roomLocks: plan.roomLocks ?? {},
        furniture: plan.furniture ?? [],
      }),
    ],
  };
}

/** Un document est reconnu à son tableau `levels`. */
export const isDocument = (value) => isObj(value) && Array.isArray(value.levels);

/**
 * Complète un document (ou enveloppe un plan à plat) : champs facultatifs, éclairage, noms et identifiants des niveaux.
 * Renvoie le même objet s'il est déjà complet.
 */
export function normalizeDocument(input) {
  if (!isDocument(input)) return docFromPlan(normalizePlan(input));
  const complete =
    isObj(input.lighting) &&
    input.levels.every((level) => isObj(level) && typeof level.id === 'string' && typeof level.name === 'string' && level.roomNames && level.roomLocks && level.roomFinishes && level.stairs && level.furniture);
  if (complete) return input;
  const used = new Set();
  const levels = input.levels.map((level, i) => {
    if (!isObj(level)) return level;
    let id = typeof level.id === 'string' && level.id ? level.id : `n${i + 1}`;
    while (used.has(id)) id += 'b';
    used.add(id);
    return {
      ...level,
      id,
      name: typeof level.name === 'string' && level.name ? level.name : levelName(i),
      roomNames: level.roomNames ?? {},
      roomLocks: level.roomLocks ?? {},
      roomFinishes: level.roomFinishes ?? {},
      furniture: level.furniture ?? [],
      stairs: level.stairs ?? [],
    };
  });
  return { ...input, lighting: isObj(input.lighting) ? { ...DEFAULT_LIGHTING, ...input.lighting } : { ...DEFAULT_LIGHTING }, levels };
}

const levelViews = new WeakMap();

/**
 * Vue d'un niveau : le plan à plat que lisent les fonctions pures. Le même objet est renvoyé tant que le niveau et ce dont il dépend
 * (grille, hauteur, style, escaliers du niveau du dessous) ne changent pas : les caches (pièces, 3D) s'y accrochent.
 * Les champs vides facultatifs (`stairs`, `wells`, `roomFinishes`) sont absents de la vue.
 * @returns {Plan}
 */
export function levelPlan(doc, index = 0) {
  const level = doc.levels[index];
  const below = index > 0 ? doc.levels[index - 1] : null;
  const wells = below?.stairs?.length ? below.stairs : null;
  const deps = [doc.grid, doc.wallHeight, doc.style, wells, index];
  const hits = levelViews.get(level) ?? [];
  const hit = hits.find((entry) => entry.deps.every((dep, i) => dep === deps[i]));
  if (hit) return hit.view;
  const view = {
    version: LEVEL_PLAN_VERSION,
    grid: doc.grid,
    wallHeight: doc.wallHeight,
    walls: level.walls,
    openings: level.openings,
    roomTypes: level.roomTypes,
    roomNames: level.roomNames ?? {},
    roomLocks: level.roomLocks ?? {},
    style: doc.style,
    furniture: level.furniture ?? [],
  };
  if (level.roomFinishes && Object.keys(level.roomFinishes).length) view.roomFinishes = level.roomFinishes;
  if (level.stairs?.length) view.stairs = level.stairs;
  if (wells) view.wells = wells;
  levelViews.set(level, [{ deps, view }, ...hits].slice(0, 4)); // annuler / rétablir retrouve la même vue (style changé, puis rétabli)
  return view;
}

/**
 * Remet dans le document un niveau modifié (sa vue `flat`) : champs du niveau, mais aussi grille, hauteur et style, qui sont communs.
 * Renvoie `doc` lui-même si rien ne change.
 */
export function withLevelPlan(doc, index, flat) {
  const level = doc.levels[index];
  const keep = (next, old, emptyCheck) => (next === undefined ? old : emptyCheck(next) && emptyCheck(old) ? old : next);
  const emptyObj = (v) => !v || Object.keys(v).length === 0;
  const emptyArr = (v) => !v || v.length === 0;
  const fields = {
    walls: flat.walls,
    openings: flat.openings,
    roomTypes: flat.roomTypes,
    roomNames: keep(flat.roomNames, level.roomNames, emptyObj) ?? {},
    roomLocks: keep(flat.roomLocks, level.roomLocks, emptyObj) ?? {},
    roomFinishes: flat.roomFinishes === undefined ? level.roomFinishes ?? {} : keep(flat.roomFinishes, level.roomFinishes, emptyObj),
    furniture: flat.furniture,
    stairs: flat.stairs === undefined ? level.stairs ?? [] : keep(flat.stairs, level.stairs, emptyArr),
  };
  const sameLevel = LEVEL_FIELDS.every((key) => fields[key] === level[key]);
  const sameRoot = flat.grid === doc.grid && flat.wallHeight === doc.wallHeight && flat.style === doc.style;
  if (sameLevel && sameRoot) return doc;
  return {
    ...doc,
    grid: flat.grid,
    wallHeight: flat.wallHeight,
    style: flat.style,
    levels: sameLevel ? doc.levels : doc.levels.map((item, i) => (i === index ? { ...item, ...fields } : item)),
  };
}

/** Hauteur du sol d'un niveau, en mètres. */
export function levelElevation(doc, index) {
  return index * (doc.wallHeight + SLAB_THICKNESS);
}

/** Ajoute un niveau vide au-dessus des autres. Même document s'il y en a déjà PLAN_LIMITS.levelsMax. */
export function addLevel(doc, name = null) {
  if (doc.levels.length >= PLAN_LIMITS.levelsMax) return doc;
  const ids = new Set(doc.levels.map((level) => level.id));
  let n = doc.levels.length + 1;
  while (ids.has(`n${n}`)) n++;
  const level = newLevel(`n${n}`, (name && String(name).trim().slice(0, LEVEL_NAME_MAX)) || levelName(doc.levels.length));
  return { ...doc, levels: [...doc.levels, level] };
}

/** Retire un niveau (jamais le dernier). Les escaliers du niveau d'en dessous, qui ne mènent plus nulle part, sont retirés avec lui. */
export function removeLevel(doc, index) {
  if (doc.levels.length <= 1 || index < 0 || index >= doc.levels.length) return doc;
  let levels = doc.levels.filter((_, i) => i !== index);
  if (index > 0 && levels[index - 1].stairs.length) levels = levels.map((level, i) => (i === index - 1 ? { ...level, stairs: [] } : level));
  return { ...doc, levels };
}

/** Renomme un niveau (30 caractères au plus). Même document si le nom ne change pas ou est vide. */
export function renameLevel(doc, index, name) {
  const clean = String(name ?? '').trim().replace(/\s+/g, ' ').slice(0, LEVEL_NAME_MAX);
  const level = doc.levels[index];
  if (!level || !clean || clean === level.name) return doc;
  return { ...doc, levels: doc.levels.map((item, i) => (i === index ? { ...item, name: clean } : item)) };
}

/* ---- Escaliers ---- */

export const STAIR_DIRECTIONS = Object.freeze(['n', 's', 'e', 'w']);
/** Styles : droit, quart tournant (L, avec palier), demi-tour (U, avec palier), colimaçon. */
export const STAIR_KINDS = Object.freeze(['straight', 'l', 'u', 'spiral']);
/** Dessous : « solid » (bloc plein, avec rangements) ou « open » (marches seules, vide dessous). */
export const STAIR_UNDERS = Object.freeze(['solid', 'open']);
/** Structure des marches d'un escalier ouvert : limon crémaillère (défaut), limon central, marches flottantes (ancrées dans un mur). */
export const STAIR_FRAMES = Object.freeze(['stringer', 'spine', 'floating']);
/** Marches : « solid » (bloc plein avec rangements) ou l'une des structures ouvertes ci-dessus. */
export const STAIR_STEPS = Object.freeze(['solid', 'stringer', 'spine', 'floating']);
/** Garde-corps (jamais de verre) : aucun, main courante seule, barreaux de bois ou de métal, câbles inox, lisses plates, lames de bois. */
export const STAIR_RAILS = Object.freeze(['none', 'handrail', 'wood', 'metal', 'cable', 'flat', 'slats']);
/** Finitions : couleur des marches, de la structure, du bois et du métal des garde-corps, des portes de rangement. */
export const STAIR_FINISHES = Object.freeze([
  { id: 'oak', name: 'Chêne', tread: '#b98a52', struct: '#d0b083', wood: '#b98a52', metal: '#2b2d31', steel: '#c9ced4', door: '#d0b083' },
  { id: 'ash', name: 'Frêne blanc', tread: '#d9bf94', struct: '#f1efea', wood: '#d9bf94', metal: '#2b2d31', steel: '#c9ced4', door: '#f1efea' },
  { id: 'walnut', name: 'Noyer blanc', tread: '#6b4a35', struct: '#efece6', wood: '#6b4a35', metal: '#26282c', steel: '#c9ced4', door: '#efece6' },
  { id: 'black', name: 'Acier noir', tread: '#a97c4e', struct: '#26282c', wood: '#a97c4e', metal: '#1b1c1f', steel: '#aeb4bb', door: '#34373c' },
  { id: 'concrete', name: 'Béton acier', tread: '#9b9a96', struct: '#b5b4b0', wood: '#8d6a45', metal: '#2a2c30', steel: '#c4c9cf', door: '#8e8d89' },
]);
export const STAIR_DEFAULTS = Object.freeze({ frame: 'stringer', rail: 'wood', finish: 'oak' });
/** Côté où l'escalier tourne (L, U) ou sens de rotation (colimaçon, vu d'en haut) : à gauche = sens inverse des aiguilles d'une montre. */
export const STAIR_TURNS = Object.freeze(['left', 'right']);
/**
 * Dimensions d'un escalier en mètres : largeur (perpendiculaire à la montée), longueur de la montée, hauteur maximale d'une marche ;
 * `flightMin` : longueur minimale de chaque volée d'un L ou d'un U ; `gap` : jour entre les deux volées d'un U ; `pole` : rayon du noyau
 * d'un colimaçon ; `sweep` : angle parcouru par un colimaçon.
 */
export const STAIR_LIMITS = Object.freeze({
  widthMin: 0.7, widthMax: 2.5, runMin: 2, runMax: 8, defaultWidth: 1, defaultRun: 3.5, riserMax: 0.19,
  flightMin: 1.2, sizeMax: 8, diameterMin: 1.4, diameterMax: 3, defaultDiameter: 2, gap: 0.1, pole: 0.08, sweep: 1.5 * Math.PI,
});
/** Épaisseur d'une marche d'un escalier ouvert, et hauteur des dents de sa crémaillère, en mètres. */
export const STAIR_TREAD = 0.06;
const STAIR_TOOTH = 0.16;
const STAIR_STRINGER = 0.05;

export const stairKind = (stair) => (STAIR_KINDS.includes(stair?.kind) ? stair.kind : 'straight');
export const stairTurn = (stair) => (stair?.turn === 'right' ? 'right' : 'left');
export const stairUnder = (stair) => (stair?.under === 'open' ? 'open' : 'solid');
export const stairFrame = (stair) => (STAIR_FRAMES.includes(stair?.frame) ? stair.frame : STAIR_DEFAULTS.frame);
export const stairRail = (stair) => (STAIR_RAILS.includes(stair?.rail) ? stair.rail : STAIR_DEFAULTS.rail);
export const stairFinish = (stair) => (STAIR_FINISHES.some((f) => f.id === stair?.finish) ? stair.finish : STAIR_DEFAULTS.finish);
/** Marches : « solid » ou la structure ouverte (un colimaçon n'a que « solid » et « stringer »). */
export const stairSteps = (stair) => {
  if (stairUnder(stair) === 'solid') return 'solid';
  const frame = stairFrame(stair);
  return stair?.kind === 'spiral' && frame !== 'stringer' ? 'stringer' : frame;
};
const stairVertical = (stair) => stair.dir === 'n' || stair.dir === 's';

/** Dimension perpendiculaire à la première volée, et dimension le long de la première volée (boîte englobante). */
export const stairAcross = (stair) => (stairVertical(stair) ? stair.w : stair.d);
export const stairAlong = (stair) => (stairVertical(stair) ? stair.d : stair.w);
/** Longueur de la montée (dans le sens de dir) : pour un L ou un U, la boîte englobante dans le sens de la première volée. */
export const stairRun = stairAlong;
/** Largeur de marche : un escalier droit, la boîte ; un L, `b` ; un U, la moitié de la boîte moins le jour ; un colimaçon, le rayon moins le noyau. */
export function stairBreadth(stair) {
  const kind = stairKind(stair);
  if (kind === 'l') return isNum(stair.b) ? stair.b : STAIR_LIMITS.defaultWidth;
  if (kind === 'u') return (stairAcross(stair) - STAIR_LIMITS.gap) / 2;
  if (kind === 'spiral') return stairAcross(stair) / 2 - STAIR_LIMITS.pole;
  return stairAcross(stair);
}

/** Dénivelé d'un niveau à l'autre, en mètres. */
export const stairRise = (wallHeight) => wallHeight + SLAB_THICKNESS;

/** Nombre de contremarches d'un escalier qui rachète un étage. */
export function stairStepCount(wallHeight) {
  return Math.max(2, Math.ceil(stairRise(wallHeight) / STAIR_LIMITS.riserMax - 1e-9));
}

/** Boîte englobante au sol d'un escalier : { x0, y0, x1, y1 } en mètres. */
export const stairRect = (stair) => ({ x0: stair.x, y0: stair.y, x1: stair.x + stair.w, y1: stair.y + stair.d });

const LAYOUT_CACHE = new WeakMap();

/**
 * Composition d'un escalier, dans le repère du plan (mètres) : une suite de volées (« flight », montée dans le sens `dir`), de paliers
 * (« landing ») et, pour un colimaçon, d'une partie « spiral ». `t0` et `t1` sont la part du dénivelé (0 au pied, 1 à l'étage)
 * au début et à la fin de la partie ; une volée monte régulièrement, un palier est plat.
 * `bottom` et `top` : le milieu du bord d'arrivée en bas et d'arrivée en haut, avec la normale sortante (nx, ny) et la largeur.
 * `divider` : le jour entre les deux volées d'un U (rectangle plein pour les garde-corps), sinon null.
 * Le résultat est gardé tant que l'objet escalier est le même.
 */
export function stairLayout(stair) {
  let layout = LAYOUT_CACHE.get(stair);
  if (!layout) {
    layout = computeStairLayout(stair);
    LAYOUT_CACHE.set(stair, layout);
  }
  return layout;
}

function computeStairLayout(stair) {
  const kind = stairKind(stair);
  const W = stairAcross(stair);
  const A = stairAlong(stair);
  const mirror = stairTurn(stair) === 'right' && (kind === 'l' || kind === 'u');
  // Repère local : la première volée monte vers le haut du dessin (ly décroît), le virage se fait vers la gauche (lx décroît).
  const toWorld = (lx, ly) => {
    const x = mirror ? W - lx : lx;
    if (stair.dir === 's') return { x: stair.x + W - x, y: stair.y + A - ly };
    if (stair.dir === 'e') return { x: stair.x + A - ly, y: stair.y + x };
    if (stair.dir === 'w') return { x: stair.x + ly, y: stair.y + W - x };
    return { x: stair.x + x, y: stair.y + ly };
  };
  const rectOf = (x0, y0, x1, y1) => {
    const a = toWorld(x0, y0);
    const b = toWorld(x1, y1);
    return { x0: r6(Math.min(a.x, b.x)), y0: r6(Math.min(a.y, b.y)), x1: r6(Math.max(a.x, b.x)), y1: r6(Math.max(a.y, b.y)) };
  };
  const letter = (dx, dy) => {
    const o = toWorld(0, 0);
    const p = toWorld(dx, dy);
    const vx = p.x - o.x;
    const vy = p.y - o.y;
    return Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'e' : 'w') : vy > 0 ? 's' : 'n';
  };
  const flight = (rect, dir, t0, t1) => ({ type: 'flight', rect, dir, t0, t1, len: dir === 'n' || dir === 's' ? rect.y1 - rect.y0 : rect.x1 - rect.x0 });
  const parts = [];
  let divider = null;
  if (kind === 'l') {
    const b = stairBreadth(stair);
    const L1 = A - b;
    const L2 = W - b;
    const tm = L1 / (L1 + L2);
    parts.push(flight(rectOf(W - b, b, W, A), letter(0, -1), 0, tm));
    parts.push({ type: 'landing', rect: rectOf(W - b, 0, W, b), t: tm });
    parts.push(flight(rectOf(0, 0, W - b, b), letter(-1, 0), tm, 1));
  } else if (kind === 'u') {
    const b = stairBreadth(stair);
    parts.push(flight(rectOf(W - b, b, W, A), letter(0, -1), 0, 0.5));
    parts.push({ type: 'landing', rect: rectOf(0, 0, W, b), t: 0.5 });
    parts.push(flight(rectOf(0, b, b, A), letter(0, 1), 0.5, 1));
    divider = rectOf(b, b, W - b, A);
  } else if (kind === 'spiral') {
    const cx = stair.x + stair.w / 2;
    const cy = stair.y + stair.d / 2;
    const a0 = { n: Math.PI / 2, s: -Math.PI / 2, e: Math.PI, w: 0 }[stair.dir];
    const sign = stairTurn(stair) === 'right' ? 1 : -1;
    parts.push({ type: 'spiral', cx, cy, rOut: stair.w / 2, rIn: STAIR_LIMITS.pole, a0, sign, sweep: STAIR_LIMITS.sweep, t0: 0, t1: 1 });
  } else {
    parts.push(flight(rectOf(0, 0, W, A), stair.dir, 0, 1));
  }
  const first = parts[0];
  const last = parts[parts.length - 1];
  const edgeOf = (f, atEnd) => {
    const r = f.rect;
    const cx = (r.x0 + r.x1) / 2;
    const cy = (r.y0 + r.y1) / 2;
    const across = f.dir === 'n' || f.dir === 's' ? r.x1 - r.x0 : r.y1 - r.y0;
    const facing = atEnd ? f.dir : { n: 's', s: 'n', e: 'w', w: 'e' }[f.dir]; // côté du rectangle où se trouve le bord
    const edge = { n: { x: cx, y: r.y0, nx: 0, ny: -1 }, s: { x: cx, y: r.y1, nx: 0, ny: 1 }, w: { x: r.x0, y: cy, nx: -1, ny: 0 }, e: { x: r.x1, y: cy, nx: 1, ny: 0 } }[facing];
    return { ...edge, width: across };
  };
  const startEdge = (f) => edgeOf(f, false);
  const endEdge = (f) => edgeOf(f, true);
  const arcEdge = (p, angle) => {
    const nx = Math.round(Math.cos(angle));
    const ny = Math.round(Math.sin(angle));
    return { x: p.cx + nx * p.rOut, y: p.cy + ny * p.rOut, nx, ny, width: p.rOut - p.rIn };
  };
  const bottom = first.type === 'spiral' ? arcEdge(first, first.a0) : startEdge(first);
  const top = last.type === 'spiral' ? arcEdge(last, last.a0 + last.sign * last.sweep) : endEdge(last);
  return { kind, parts, divider, bbox: stairRect(stair), bottom, top };
}

/** Longueur développée de la montée (somme des volées, ou longueur de l'arc au milieu de la marche d'un colimaçon). */
export function stairPathLength(stair) {
  return stairLayout(stair).parts.reduce((sum, part) => {
    if (part.type === 'flight') return sum + part.len;
    if (part.type === 'spiral') return sum + part.sweep * (part.rOut + part.rIn) / 2;
    return sum;
  }, 0);
}

/** Rectangles au sol occupés par un escalier (les volées et les paliers ; pour un colimaçon, sa boîte englobante). */
export function stairRects(stair) {
  const layout = stairLayout(stair);
  if (layout.kind === 'spiral') return [layout.bbox];
  return layout.parts.map((part) => part.rect);
}

const inRect = (r, x, y, margin) => x >= r.x0 - margin && x <= r.x1 + margin && y >= r.y0 - margin && y <= r.y1 + margin;

/** Le point (mètres) est-il sur l'escalier (à `margin` près) ? Sert à le toucher dans l'éditeur. */
export function stairContains(stair, x, y, margin = 0) {
  return stairRects(stair).some((r) => inRect(r, x, y, margin));
}

/**
 * Part du dénivelé atteinte au point (x, y) du plan : 0 au pied, 1 à l'arrivée à l'étage, null si le point n'est pas sur une marche.
 * L'altitude du marcheur est `t × dénivelé` : elle varie continûment sur une volée, reste constante sur un palier.
 */
export function stairClimb(stair, x, y, margin = 0) {
  for (const part of stairLayout(stair).parts) {
    if (part.type === 'spiral') {
      const dx = x - part.cx;
      const dy = y - part.cy;
      if (Math.hypot(dx, dy) > part.rOut * 1.05 + margin) continue;
      const turn = part.sign * (Math.atan2(dy, dx) - part.a0);
      const delta = ((turn % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      if (delta <= part.sweep + 1e-9) return delta / part.sweep;
      continue;
    }
    if (!inRect(part.rect, x, y, margin)) continue;
    if (part.type === 'landing') return part.t;
    const r = part.rect;
    const along = { n: r.y1 - y, s: y - r.y0, e: x - r.x0, w: r.x1 - x }[part.dir];
    return part.t0 + (part.t1 - part.t0) * Math.min(Math.max(along / part.len, 0), 1);
  }
  return null;
}

/** Distance parcourue le long de la montée au point (x, y), en mètres (0 au pied, longueur de la montée en haut), ou null hors de l'escalier. */
export function stairProgress(stair, x, y, margin = 0) {
  const t = stairClimb(stair, x, y, margin);
  return t === null ? null : t * stairPathLength(stair);
}

/** Point du bas (arrivée depuis le niveau inférieur) et du haut de la montée, au centre de la largeur. */
export function stairEnds(stair) {
  const { bottom, top } = stairLayout(stair);
  return { bottom: { x: bottom.x, y: bottom.y }, top: { x: top.x, y: top.y } };
}

/** Vecteur unitaire de la montée (plan x, y). */
export const stairVector = (dir) => ({ n: { x: 0, y: -1 }, s: { x: 0, y: 1 }, e: { x: 1, y: 0 }, w: { x: -1, y: 0 } })[dir];

/** Tourne un sens (n, e, s, w) d'un quart de tour horaire. */
const quarterTurn = (dir) => ({ n: 'e', e: 's', s: 'w', w: 'n' })[dir];

/**
 * Dimensions d'un escalier neuf d'un style donné : { across, along, b? } (mètres), le plus proche possible du pas de la grille.
 */
function defaultStairSize(kind, step) {
  const snap = (v) => Math.max(Math.round(v / step) * step, step);
  const width = snap(STAIR_LIMITS.defaultWidth);
  if (kind === 'l') return { across: snap(2.5), along: snap(3), b: width };
  if (kind === 'u') return { across: r6(2 * width + STAIR_LIMITS.gap), along: snap(3.2), b: width };
  if (kind === 'spiral') return { across: snap(STAIR_LIMITS.defaultDiameter), along: snap(STAIR_LIMITS.defaultDiameter), b: null };
  return { across: width, along: snap(STAIR_LIMITS.defaultRun), b: null };
}

/**
 * Boîte d'un escalier neuf : `point` = centre voulu, `dir` = sens de la première volée, dimensions par défaut du style,
 * calée sur le pas de la grille. `options` : { kind, turn, under }.
 */
export function createStairSpec(plan, point, dir = 'n', options = {}) {
  const step = plan.grid.cellSize;
  const snap = (v) => Math.round(v / step) * step;
  const kind = STAIR_KINDS.includes(options.kind) ? options.kind : 'straight';
  const size = defaultStairSize(kind, step);
  const vertical = dir === 'n' || dir === 's';
  const w = vertical ? size.across : size.along;
  const d = vertical ? size.along : size.across;
  const spec = { x: r6(snap(point.x - w / 2)), y: r6(snap(point.y - d / 2)), w: r6(w), d: r6(d), dir };
  return withStairStyle(spec, { kind, turn: options.turn, under: options.under, b: size.b, frame: options.frame, rail: options.rail, finish: options.finish });
}

/** Ajoute à un escalier les champs de style qui s'écartent des valeurs par défaut (droit, à gauche, plein) : les anciens plans restent valides. */
function withStairStyle(stair, { kind, turn, under, b, frame, rail, finish }) {
  const out = { ...stair };
  delete out.kind;
  delete out.turn;
  delete out.under;
  delete out.b;
  delete out.frame;
  delete out.rail;
  delete out.finish;
  if (kind && kind !== 'straight' && STAIR_KINDS.includes(kind)) out.kind = kind;
  if (turn === 'right' && (kind === 'l' || kind === 'u' || kind === 'spiral')) out.turn = 'right';
  if (under === 'open') out.under = 'open';
  if (under === 'open' && kind !== 'spiral' && STAIR_FRAMES.includes(frame) && frame !== STAIR_DEFAULTS.frame) out.frame = frame;
  if (STAIR_RAILS.includes(rail) && rail !== STAIR_DEFAULTS.rail) out.rail = rail;
  if (STAIR_FINISHES.some((f) => f.id === finish) && finish !== STAIR_DEFAULTS.finish) out.finish = finish;
  if (kind === 'l' && isNum(b)) out.b = r6(b);
  return out;
}

const rectsOverlap = (a, b, eps = 1e-6) => a.x0 < b.x1 - eps && a.x1 > b.x0 + eps && a.y0 < b.y1 - eps && a.y1 > b.y0 + eps;

/** Les dimensions d'un escalier sont-elles permises pour son style ? */
function stairSizeOk(stair) {
  if (!isNum(stair?.w) || !isNum(stair?.d) || !STAIR_DIRECTIONS.includes(stair?.dir)) return false;
  const kind = stairKind(stair);
  const W = stairAcross(stair);
  const A = stairAlong(stair);
  const eps = 1e-9;
  const L = STAIR_LIMITS;
  if (stair.kind !== undefined && !STAIR_KINDS.includes(stair.kind)) return false;
  if (stair.turn !== undefined && !STAIR_TURNS.includes(stair.turn)) return false;
  if (stair.under !== undefined && !STAIR_UNDERS.includes(stair.under)) return false;
  if (stair.frame !== undefined && !STAIR_FRAMES.includes(stair.frame)) return false;
  if (stair.rail !== undefined && !STAIR_RAILS.includes(stair.rail)) return false;
  if (stair.finish !== undefined && !STAIR_FINISHES.some((f) => f.id === stair.finish)) return false;
  if (kind === 'straight') return A >= L.runMin - eps && A <= L.runMax + eps && W >= L.widthMin - eps && W <= L.widthMax + eps;
  if (kind === 'spiral') return Math.abs(stair.w - stair.d) < 1e-6 && stair.w >= L.diameterMin - eps && stair.w <= L.diameterMax + eps;
  const b = stairBreadth(stair);
  if (!(b >= L.widthMin - eps && b <= Math.min(L.widthMax, 1.6) + eps)) return false;
  if (kind === 'l') return W >= b + L.flightMin - eps && A >= b + L.flightMin - eps && W <= L.sizeMax + eps && A <= L.sizeMax + eps;
  return Math.abs(W - (2 * b + L.gap)) < 1e-6 && A >= b + L.flightMin - eps && A <= L.sizeMax + eps;
}

/**
 * Un escalier peut-il se poser ici ? Raisons de refus : 'size' (dimensions hors limites), 'outside' (hors de la grille),
 * 'wall' (un mur le traverse ; le long d'un mur, c'est permis), 'opening' (il bouche une porte ou un passage),
 * 'overlap' (un autre escalier ou une trémie), 'top' (aucun niveau au-dessus : voir `hasLevelAbove`).
 * @param {Plan} plan vue du niveau
 * @param {{ x: number, y: number, w: number, d: number, dir: string }} stair
 * @param {string | null} [ignoreId] escalier à ne pas compter (pour le déplacer)
 */
export function canPlaceStair(plan, stair, ignoreId = null) {
  if (!stairSizeOk(stair)) return { ok: false, reason: 'size' };
  const r = stairRect(stair);
  const cs = plan.grid.cellSize;
  if (r.x0 < -1e-9 || r.y0 < -1e-9 || r.x1 > plan.grid.width * cs + 1e-9 || r.y1 > plan.grid.height * cs + 1e-9) return { ok: false, reason: 'outside' };
  const rects = stairRects(stair);
  // Un mur traverse l'escalier s'il passe strictement à l'intérieur : longer un mur (bord de l'escalier sur la ligne du mur) est permis.
  for (const edge of plan.walls) {
    const wall = edge.dir === 'h'
      ? { x0: edge.x * cs, x1: (edge.x + 1) * cs, y0: edge.y * cs, y1: edge.y * cs }
      : { x0: edge.x * cs, x1: edge.x * cs, y0: edge.y * cs, y1: (edge.y + 1) * cs };
    if (rects.some((part) => rectsOverlap(part, wall))) return { ok: false, reason: 'wall' };
  }
  // Un escalier collé à un mur ne doit pas boucher une porte ou un passage de ce mur (les fenêtres restent derrière lui).
  for (const opening of plan.openings ?? []) {
    if (opening.type === 'window') continue;
    for (const edge of openingEdges(opening)) {
      const wall = edge.dir === 'h'
        ? { x0: edge.x * cs, x1: (edge.x + 1) * cs, y0: edge.y * cs, y1: edge.y * cs }
        : { x0: edge.x * cs, x1: edge.x * cs, y0: edge.y * cs, y1: (edge.y + 1) * cs };
      const near = 0.02;
      const hit = rects.some((part) => (edge.dir === 'h'
        ? part.x0 < wall.x1 - 1e-6 && part.x1 > wall.x0 + 1e-6 && (Math.abs(part.y0 - wall.y0) < near || Math.abs(part.y1 - wall.y0) < near)
        : part.y0 < wall.y1 - 1e-6 && part.y1 > wall.y0 + 1e-6 && (Math.abs(part.x0 - wall.x0) < near || Math.abs(part.x1 - wall.x0) < near)));
      if (hit) return { ok: false, reason: 'opening' };
    }
  }
  for (const other of [...(plan.stairs ?? []), ...(plan.wells ?? [])]) {
    if (other.id !== undefined && other.id === ignoreId) continue;
    const otherRects = stairRects(other);
    if (rects.some((a) => otherRects.some((b) => rectsOverlap(a, b)))) return { ok: false, reason: 'overlap' };
  }
  return { ok: true };
}

/** Identifiant libre : « e1 », « e2 »… (unique dans le document, pas seulement le niveau). */
export function nextStairId(plan) {
  let max = 0;
  for (const { id } of [...(plan.stairs ?? []), ...(plan.wells ?? [])]) {
    const match = /^e(\d+)$/.exec(id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `e${max + 1}`;
}

/** Copie propre d'un escalier : nombres arrondis, champs de style seulement s'ils s'écartent des valeurs par défaut. */
function cleanStair(spec) {
  const stair = { x: r6(spec.x), y: r6(spec.y), w: r6(spec.w), d: r6(spec.d), dir: spec.dir };
  return withStairStyle(stair, { kind: spec.kind, turn: spec.turn, under: spec.under, b: spec.b, frame: spec.frame, rail: spec.rail, finish: spec.finish });
}

/** Pose un escalier. Même plan s'il ne tient pas. Le nouvel escalier est le dernier de plan.stairs. */
export function addStair(plan, spec) {
  const stair = cleanStair(spec);
  if (!canPlaceStair(plan, stair).ok || (plan.stairs ?? []).length >= PLAN_LIMITS.stairsMax) return plan;
  return { ...plan, stairs: [...(plan.stairs ?? []), { id: nextStairId(plan), ...stair }] };
}

const STAIR_KEYS = ['x', 'y', 'w', 'd', 'dir', 'kind', 'turn', 'under', 'b', 'frame', 'rail', 'finish'];

/** Modifie un escalier (position, dimensions, sens, style). Même plan si rien ne change ou si le résultat ne tient pas. */
export function updateStair(plan, id, patch) {
  const old = (plan.stairs ?? []).find((stair) => stair.id === id);
  if (!old) return plan;
  const merged = { ...old };
  for (const key of ['x', 'y', 'w', 'd', 'b']) if (isNum(patch[key])) merged[key] = r6(patch[key]);
  for (const key of ['dir', 'kind', 'turn', 'under', 'frame', 'rail', 'finish']) if (patch[key] !== undefined) merged[key] = patch[key];
  if (patch.b === null) delete merged.b;
  const next = { id, ...cleanStair(merged) };
  if (STAIR_KEYS.every((key) => next[key] === old[key])) return plan;
  if (!canPlaceStair(plan, next, id).ok) return plan;
  return { ...plan, stairs: plan.stairs.map((stair) => (stair.id === id ? next : stair)) };
}

/** Centre de la boîte englobante d'un escalier. */
const stairCenter = (stair) => ({ x: stair.x + stair.w / 2, y: stair.y + stair.d / 2 });

/** Fait pivoter un escalier d'un quart de tour (horaire) autour de son centre, en gardant le pas de la grille. */
export function rotateStair(plan, id) {
  const old = (plan.stairs ?? []).find((stair) => stair.id === id);
  if (!old) return plan;
  const step = plan.grid.cellSize;
  const c = stairCenter(old);
  const snap = (v) => Math.round(v / step) * step;
  return updateStair(plan, id, { dir: quarterTurn(old.dir), w: old.d, d: old.w, x: snap(c.x - old.d / 2), y: snap(c.y - old.w / 2) });
}

/**
 * Inverse l'escalier : un escalier droit change le sens de sa montée (le haut devient le bas) ; un L ou un U se retourne en miroir
 * (il tourne de l'autre côté) ; un colimaçon tourne dans l'autre sens.
 */
export function flipStair(plan, id) {
  const old = (plan.stairs ?? []).find((stair) => stair.id === id);
  if (!old) return plan;
  if (stairKind(old) === 'straight') return updateStair(plan, id, { dir: { n: 's', s: 'n', e: 'w', w: 'e' }[old.dir] });
  return updateStair(plan, id, { turn: stairTurn(old) === 'left' ? 'right' : 'left' });
}

/**
 * Change le style d'un escalier (droit, L, U, colimaçon) : dimensions par défaut du nouveau style, même centre et même sens.
 * Même plan si le nouvel escalier ne tient pas.
 */
export function setStairKind(plan, id, kind) {
  const old = (plan.stairs ?? []).find((stair) => stair.id === id);
  if (!old || !STAIR_KINDS.includes(kind) || stairKind(old) === kind) return plan;
  const spec = createStairSpec(plan, stairCenter(old), old.dir, { kind, turn: old.turn, under: old.under, frame: old.frame, rail: old.rail, finish: old.finish });
  return updateStair(plan, id, { ...spec, b: spec.b ?? null });
}

/** Choisit le dessous de l'escalier : « solid » ou « open ». */
export function setStairUnder(plan, id, under) {
  const old = (plan.stairs ?? []).find((stair) => stair.id === id);
  if (!old || !STAIR_UNDERS.includes(under) || stairUnder(old) === under) return plan;
  return updateStair(plan, id, { under });
}

/**
 * Choisit les marches : « solid » (bloc plein), « stringer », « spine » ou « floating ». Les marches flottantes ne s'ancrent que dans un
 * mur (voir stairWallBacked) ; un colimaçon n'a que « solid » et « stringer ».
 */
export function setStairSteps(plan, id, steps) {
  const old = (plan.stairs ?? []).find((stair) => stair.id === id);
  if (!old || !STAIR_STEPS.includes(steps) || stairSteps(old) === steps) return plan;
  if (stairKind(old) === 'spiral' && (steps === 'spine' || steps === 'floating')) return plan;
  if (steps === 'floating' && !stairWallBacked(old, plan)) return plan;
  return updateStair(plan, id, steps === 'solid' ? { under: 'solid', frame: STAIR_DEFAULTS.frame } : { under: 'open', frame: steps });
}

/** Choisit le garde-corps (jamais en verre). */
export function setStairRail(plan, id, rail) {
  const old = (plan.stairs ?? []).find((stair) => stair.id === id);
  if (!old || !STAIR_RAILS.includes(rail) || stairRail(old) === rail) return plan;
  return updateStair(plan, id, { rail });
}

/** Choisit la finition (couleurs des marches, de la structure et des garde-corps). */
export function setStairFinish(plan, id, finish) {
  const old = (plan.stairs ?? []).find((stair) => stair.id === id);
  if (!old || !STAIR_FINISHES.some((f) => f.id === finish) || stairFinish(old) === finish) return plan;
  return updateStair(plan, id, { finish });
}

/**
 * Modification de taille d'un escalier : `which` = 'width' (largeur de marche), 'run' (longueur dans le sens de la première volée)
 * ou 'side' (L : longueur de la seconde volée), `delta` en mètres. Renvoie le correctif à passer à updateStair, ou null.
 * Le bord de départ (le pied) reste en place quand c'est possible.
 */
export function stairResizePatch(stair, which, delta) {
  const kind = stairKind(stair);
  const vertical = stairVertical(stair);
  const round = (v) => Math.round(v * 1000) / 1000;
  if (kind === 'spiral') {
    if (which !== 'width') return null;
    const d = round(stair.w + 2 * delta);
    return { w: d, d, x: round(stair.x - delta), y: round(stair.y - delta) };
  }
  if (which === 'width') {
    if (kind === 'straight') return { [vertical ? 'w' : 'd']: round(stairAcross(stair) + delta) };
    if (kind === 'l') return { b: round(stairBreadth(stair) + delta) };
    // U : la boîte se calcule à partir de la largeur de marche (le centre ne bouge pas).
    const grow = round(2 * delta);
    return vertical ? { w: round(stair.w + grow), x: round(stair.x - delta) } : { d: round(stair.d + grow), y: round(stair.y - delta) };
  }
  if (which === 'run') return { [vertical ? 'd' : 'w']: round(stairAlong(stair) + delta) };
  if (which === 'side' && kind === 'l') return { [vertical ? 'w' : 'd']: round(stairAcross(stair) + delta) };
  return null;
}

/** Supprime un escalier. Même plan s'il n'existe pas. */
export function removeStair(plan, id) {
  const stairs = (plan.stairs ?? []).filter((stair) => stair.id !== id);
  return stairs.length === (plan.stairs ?? []).length ? plan : { ...plan, stairs };
}

/** Escalier (ou trémie) sous un point du plan en mètres, ou null. `list` = 'stairs' (ce niveau) ou 'wells'. */
export function findStairAt(plan, point, list = 'stairs', margin = 0) {
  for (const stair of plan[list] ?? []) if (stairContains(stair, point.x, point.y, margin)) return stair;
  return null;
}

/* Découpe d'un contour : segments de bord d'un ensemble de rectangles accolés qui ne touchent aucun autre rectangle. */
function exposedEdges(rects) {
  const edges = [];
  const eps = 1e-6;
  const cover = (intervals, lo, hi) => {
    // Retire de [lo, hi] les intervalles couverts ; renvoie les morceaux restants.
    let pieces = [[lo, hi]];
    for (const [a, b] of intervals) {
      const next = [];
      for (const [p, q] of pieces) {
        if (b <= p + eps || a >= q - eps) next.push([p, q]);
        else {
          if (a > p + eps) next.push([p, a]);
          if (b < q - eps) next.push([b, q]);
        }
      }
      pieces = next;
    }
    return pieces;
  };
  rects.forEach((r, i) => {
    const others = rects.filter((_, j) => j !== i);
    // bord haut (y = y0) : couvert par un rectangle qui occupe le dessus de cette ligne
    const sides = [
      ['n', r.y0, r.x0, r.x1, others.filter((o) => o.y0 < r.y0 - eps && o.y1 > r.y0 - eps).map((o) => [o.x0, o.x1])],
      ['s', r.y1, r.x0, r.x1, others.filter((o) => o.y1 > r.y1 + eps && o.y0 < r.y1 + eps).map((o) => [o.x0, o.x1])],
      ['w', r.x0, r.y0, r.y1, others.filter((o) => o.x0 < r.x0 - eps && o.x1 > r.x0 - eps).map((o) => [o.y0, o.y1])],
      ['e', r.x1, r.y0, r.y1, others.filter((o) => o.x1 > r.x1 + eps && o.x0 < r.x1 + eps).map((o) => [o.y0, o.y1])],
    ];
    for (const [side, line, lo, hi, covered] of sides) for (const [a, b] of cover(covered, lo, hi)) edges.push({ side, line, a, b, part: i });
  });
  return edges;
}

/** Retire des segments la partie d'un bord d'arrivée { x, y, nx, ny, width } (l'ouverture par où l'on entre ou sort). */
function openEdge(edges, edge) {
  const side = edge.ny < 0 ? 'n' : edge.ny > 0 ? 's' : edge.nx < 0 ? 'w' : 'e';
  const along = side === 'n' || side === 's' ? edge.x : edge.y;
  const line = side === 'n' || side === 's' ? edge.y : edge.x;
  const lo = along - edge.width / 2;
  const hi = along + edge.width / 2;
  const out = [];
  for (const seg of edges) {
    if (seg.side !== side || Math.abs(seg.line - line) > 1e-6 || seg.b <= lo + 1e-6 || seg.a >= hi - 1e-6) {
      out.push(seg);
      continue;
    }
    if (seg.a < lo - 1e-6) out.push({ ...seg, b: lo });
    if (seg.b > hi + 1e-6) out.push({ ...seg, a: hi });
  }
  return out;
}

/** Contour d'un escalier (les bords qui ne touchent pas une autre partie) : segments { x0, y0, x1, y1 } du plan ; vide pour un colimaçon (un cercle). */
export function stairOutline(stair) {
  const layout = stairLayout(stair);
  if (layout.kind === 'spiral') return [];
  return exposedEdges(layout.parts.map((part) => part.rect)).map(({ side, line, a, b }) => (side === 'n' || side === 's' ? { x0: a, y0: line, x1: b, y1: line } : { x0: line, y0: a, x1: line, y1: b }));
}

/** Épaisseur des garde-corps d'un escalier ou d'une trémie, en mètres. */
export const STAIR_RAIL = 0.05;

/** Rectangles { x0, y0, x1, y1 } posés à l'extérieur des segments de contour. */
function railRects(edges, t = STAIR_RAIL) {
  return edges.map(({ side, line, a, b }) => {
    if (side === 'n') return { x0: a, y0: line - t, x1: b, y1: line };
    if (side === 's') return { x0: a, y0: line, x1: b, y1: line + t };
    if (side === 'w') return { x0: line - t, y0: a, x1: line, y1: b };
    return { x0: line, y0: a, x1: line + t, y1: b };
  });
}

/**
 * Obstacles autour d'un escalier au niveau d'où il part : on n'y monte que par le pied (les côtés sont fermés), et rien ne se traverse
 * entre les deux volées d'un U. Rectangles { x0, y0, x1, y1 } du plan.
 */
export function stairObstacles(stair) {
  const layout = stairLayout(stair);
  if (layout.kind === 'spiral') return spiralObstacles(stair, layout, 'bottom');
  const rails = railRects(openEdge(exposedEdges(layout.parts.map((part) => part.rect)), layout.bottom));
  if (layout.divider) rails.push(layout.divider);
  return rails;
}

/**
 * Garde-corps de la trémie d'un escalier, vue de l'étage : tout le contour sauf l'arrivée (le haut de la montée) ; le jour d'un U est fermé.
 * Rectangles { x0, y0, x1, y1 } du plan.
 */
export function stairWellRails(stair) {
  const layout = stairLayout(stair);
  if (layout.kind === 'spiral') return spiralObstacles(stair, layout, 'top');
  const rails = railRects(openEdge(exposedEdges(layout.parts.map((part) => part.rect)), layout.top));
  if (layout.divider) rails.push(layout.divider);
  return rails;
}

/* Obstacles d'un colimaçon : noyau, contour de la boîte (sauf l'entrée ou la sortie) et les quatre coins hors du cercle. */
function spiralObstacles(stair, layout, which) {
  const part = layout.parts[0];
  const { cx, cy, rOut } = part;
  const t = STAIR_RAIL;
  const r = layout.bbox;
  const rails = railRects(openEdge(exposedEdges([r]), which === 'bottom' ? layout.bottom : layout.top), t);
  const corner = rOut * Math.SQRT1_2;
  const squares = [
    { x0: cx + corner, y0: cy + corner, x1: r.x1, y1: r.y1 },
    { x0: r.x0, y0: cy + corner, x1: cx - corner, y1: r.y1 },
    { x0: cx + corner, y0: r.y0, x1: r.x1, y1: cy - corner },
    { x0: r.x0, y0: r.y0, x1: cx - corner, y1: cy - corner },
  ];
  rails.push(...squares);
  const pole = part.rIn;
  rails.push({ x0: cx - pole, y0: cy - pole, x1: cx + pole, y1: cy + pole });
  // Au pied, la paroi radiale de la fin de la montée (le haut des marches) empêche d'y monter depuis le secteur libre.
  const end = layout.top;
  const wall = end.nx !== 0
    ? { x0: Math.min(cx, cx + end.nx * rOut), y0: cy - t / 2, x1: Math.max(cx, cx + end.nx * rOut), y1: cy + t / 2 }
    : { x0: cx - t / 2, y0: Math.min(cy, cy + end.ny * rOut), x1: cx + t / 2, y1: Math.max(cy, cy + end.ny * rOut) };
  if (which === 'bottom') rails.push(wall);
  return rails;
}

/** Sonde des murs d'un plan : un mur longe-t-il le segment [a, b] de la ligne `line` du côté `side` ('n', 's', 'w', 'e') ? Mètres. */
function wallProbe(plan) {
  const cs = plan?.grid?.cellSize;
  return (side, line, a, b) => {
    if (!plan || !plan.walls) return false;
    const horizontal = side === 'n' || side === 's';
    return plan.walls.some((edge) => {
      if ((edge.dir === 'h') !== horizontal) return false;
      const wl = (horizontal ? edge.y : edge.x) * cs;
      if (Math.abs(wl - line) > 1e-6) return false;
      const lo = (horizontal ? edge.x : edge.y) * cs;
      return lo < b - 1e-6 && lo + cs > a + 1e-6;
    });
  };
}

/** Un mur longe-t-il l'escalier (un de ses bords libres) ? Sert aux marches flottantes, ancrées dans un mur. */
export function stairWallBacked(stair, plan) {
  const layout = stairLayout(stair);
  const probe = wallProbe(plan);
  const rects = layout.kind === 'spiral' ? [layout.bbox] : layout.parts.map((part) => part.rect);
  return exposedEdges(rects).some(({ side, line, a, b }) => probe(side, line, a, b));
}

const RAIL_HEIGHT = 0.9;

/** Marches effectives : les marches flottantes retombent sur le limon crémaillère quand aucun mur ne les porte. */
function effectiveSteps(stair, plan) {
  const steps = stairSteps(stair);
  return steps === 'floating' && !stairWallBacked(stair, plan) ? 'stringer' : steps;
}

/**
 * Boîtes d'un escalier, dans le repère du niveau d'où il part. Marches pleines (« solid ») : chaque marche est un bloc posé sur le sol,
 * coiffé d'une planche. Marches ouvertes : une planche mince par marche, portée par un limon crémaillère (« stringer »), une poutre
 * centrale (« spine ») ou ancrée dans un mur (« floating ») ; le vide reste dessous. Les garde-corps suivent le style choisi.
 */
export function stairBoxes(stair, wallHeight, plan = null) {
  const layout = stairLayout(stair);
  const finish = stairFinish(stair);
  const mat = (part) => `stair:${finish}:${part}`;
  if (layout.kind === 'spiral') return [...spiralBoxes(stair, layout, wallHeight, mat), ...stairRailBoxes(stair, wallHeight, plan, 'stairs')];
  const n = stairStepCount(wallHeight);
  const rise = stairRise(wallHeight);
  const riser = rise / n;
  const steps = effectiveSteps(stair, plan);
  const open = steps !== 'solid';
  const boxes = [];
  const add = (rect, bottom, top, part, tag = {}) => {
    if (rect.x1 - rect.x0 < 1e-6 || rect.y1 - rect.y0 < 1e-6 || top - bottom < 1e-6) return;
    boxes.push({
      kind: 'stair', material: mat(part),
      position: [r6((rect.x0 + rect.x1) / 2), r6(FLOOR_THICKNESS + (bottom + top) / 2), r6((rect.y0 + rect.y1) / 2)],
      size: [r6(rect.x1 - rect.x0), r6(top - bottom), r6(rect.y1 - rect.y0)],
      stairId: stair.id,
      ...tag,
    });
  };
  const SPINE = 0.14;
  const CAP = 0.04;
  const plank = steps === 'floating' ? 0.08 : STAIR_TREAD;
  const centered = (rect, vertical, width) => (vertical
    ? { ...rect, x0: (rect.x0 + rect.x1) / 2 - width / 2, x1: (rect.x0 + rect.x1) / 2 + width / 2 }
    : { ...rect, y0: (rect.y0 + rect.y1) / 2 - width / 2, y1: (rect.y0 + rect.y1) / 2 + width / 2 });
  for (const part of layout.parts) {
    if (part.type === 'landing') {
      const top = Math.round(part.t * n) * riser;
      const r = part.rect;
      if (!open) {
        add(r, 0, top - CAP, 'struct');
        add(r, top - CAP, top, 'tread');
      } else if (steps === 'floating') {
        add(r, top - plank, top, 'tread');
      } else {
        add(r, top - 0.1, top, 'tread');
        if (steps === 'spine') {
          const post = 0.14;
          add({ x0: (r.x0 + r.x1) / 2 - post / 2, x1: (r.x0 + r.x1) / 2 + post / 2, y0: (r.y0 + r.y1) / 2 - post / 2, y1: (r.y0 + r.y1) / 2 + post / 2 }, 0, top - 0.1, 'struct');
        } else {
          const post = 0.08;
          const spot = (px, py) => ({ x0: px - post / 2, x1: px + post / 2, y0: py - post / 2, y1: py + post / 2 });
          for (const [px, py] of [[r.x0 + 0.06, r.y0 + 0.06], [r.x1 - 0.06, r.y0 + 0.06], [r.x0 + 0.06, r.y1 - 0.06], [r.x1 - 0.06, r.y1 - 0.06]]) add(spot(px, py), 0, top - 0.1, 'struct');
        }
      }
      continue;
    }
    const k0 = Math.round(part.t0 * n);
    const m = Math.round(part.t1 * n) - k0;
    if (m < 1) continue;
    const treads = Math.max(m - 1, 1);
    const depth = part.len / treads;
    const r = part.rect;
    const vertical = part.dir === 'n' || part.dir === 's';
    for (let j = 1; j <= treads; j++) {
      const top = (k0 + j) * riser;
      const a0 = (j - 1) * depth;
      const a1 = j * depth;
      let slice;
      if (part.dir === 'n') slice = { x0: r.x0, x1: r.x1, y0: r.y1 - a1, y1: r.y1 - a0 };
      else if (part.dir === 's') slice = { x0: r.x0, x1: r.x1, y0: r.y0 + a0, y1: r.y0 + a1 };
      else if (part.dir === 'e') slice = { x0: r.x0 + a0, x1: r.x0 + a1, y0: r.y0, y1: r.y1 };
      else slice = { x0: r.x1 - a1, x1: r.x1 - a0, y0: r.y0, y1: r.y1 };
      if (!open) {
        add(slice, 0, top - CAP, 'struct');
        add(slice, top - CAP, top, 'tread');
        continue;
      }
      add(slice, Math.max(0, top - plank), top, 'tread');
      if (steps === 'stringer') {
        const lateral = vertical
          ? [{ ...slice, x1: slice.x0 + STAIR_STRINGER }, { ...slice, x0: slice.x1 - STAIR_STRINGER }]
          : [{ ...slice, y1: slice.y0 + STAIR_STRINGER }, { ...slice, y0: slice.y1 - STAIR_STRINGER }];
        for (const side of lateral) add(side, Math.max(0, top - STAIR_TREAD - STAIR_TOOTH), Math.max(0, top - STAIR_TREAD), 'struct');
      } else if (steps === 'spine') {
        add(centered(slice, vertical, SPINE), Math.max(0, top - STAIR_TREAD - 0.32), Math.max(0, top - STAIR_TREAD), 'struct');
      }
    }
  }
  if (!open) boxes.push(...storageFronts(stair, layout, wallHeight, plan, mat));
  boxes.push(...stairRailBoxes(stair, wallHeight, plan, 'stairs'));
  return boxes;
}

/** Hauteur du bloc plein d'un escalier au point (x, y) du plan, en mètres au-dessus du sol du niveau ; 0 hors des marches. */
function solidHeightAt(layout, wallHeight, x, y) {
  const n = stairStepCount(wallHeight);
  const riser = stairRise(wallHeight) / n;
  for (const part of layout.parts) {
    const r = part.rect;
    if (x < r.x0 - 1e-6 || x > r.x1 + 1e-6 || y < r.y0 - 1e-6 || y > r.y1 + 1e-6) continue;
    if (part.type === 'landing') return Math.round(part.t * n) * riser;
    const k0 = Math.round(part.t0 * n);
    const m = Math.round(part.t1 * n) - k0;
    const treads = Math.max(m - 1, 1);
    const depth = part.len / treads;
    const from = part.dir === 'n' ? r.y1 - y : part.dir === 's' ? y - r.y0 : part.dir === 'e' ? x - r.x0 : r.x1 - x;
    const j = Math.min(treads, Math.max(1, Math.ceil(from / depth - 1e-9)));
    return (k0 + j) * riser;
  }
  return 0;
}

const STORAGE_DOOR = 0.6; // largeur visée d'une porte de placard sous l'escalier
const STORAGE_FRONT = 0.02; // épaisseur des façades (elles dépassent du bloc de cette valeur)

/**
 * Façades de rangement d'un escalier plein : sur chaque côté libre du bloc (pas collé à un mur), des portes de placard minces, avec
 * une poignée. Leur hauteur suit le dessous des marches ; elles sont omises là où le bloc est trop bas pour y ranger quoi que ce soit.
 */
function storageFronts(stair, layout, wallHeight, plan, mat) {
  const wallsAt = wallProbe(plan);
  const boxes = [];
  const maxTop = wallHeight - 0.1;
  for (const { side, line, a, b } of exposedEdges(layout.parts.map((part) => part.rect))) {
    const horizontal = side === 'n' || side === 's';
    const length = b - a;
    const doors = Math.max(1, Math.round(length / STORAGE_DOOR));
    const width = length / doors;
    for (let i = 0; i < doors; i++) {
      const a0 = a + i * width;
      const a1 = a0 + width;
      if (wallsAt(side, line, a0, a1)) continue;
      // hauteur du bloc juste derrière la façade, au plus bas de la porte
      const inward = side === 'n' || side === 'w' ? 0.02 : -0.02;
      let low = Infinity;
      for (let k = 0; k <= 4; k++) {
        const along = a0 + (width * k) / 4;
        const x = horizontal ? along : line + inward;
        const y = horizontal ? line + inward : along;
        low = Math.min(low, solidHeightAt(layout, wallHeight, x, y));
      }
      const top = Math.min(low, maxTop) - 0.08;
      if (top < 0.45) continue;
      const bottom = 0.08;
      const gap = 0.012;
      const thick = STORAGE_FRONT;
      const out = side === 'n' || side === 'w' ? -1 : 1;
      const center = (a0 + a1) / 2;
      const w = width - gap;
      const h = top - bottom;
      const at = (offsetOut, alongPos, y, sizeAlong, sizeY, sizeOut, material) => ({
        kind: 'stair', material, stairId: stair.id,
        position: horizontal ? [r6(alongPos), r6(FLOOR_THICKNESS + y), r6(line + out * offsetOut)] : [r6(line + out * offsetOut), r6(FLOOR_THICKNESS + y), r6(alongPos)],
        size: horizontal ? [r6(sizeAlong), r6(sizeY), r6(sizeOut)] : [r6(sizeOut), r6(sizeY), r6(sizeAlong)],
      });
      boxes.push(at(thick / 2, center, bottom + h / 2, w, h, thick, mat('door')));
      // poignée : barre verticale près du bord de la porte, à mi-hauteur (ou plus bas si la porte est haute)
      const handleY = Math.min(bottom + h / 2, bottom + 0.95);
      const handleAlong = center + (i % 2 === 0 ? 1 : -1) * (w / 2 - 0.06);
      boxes.push(at(thick + 0.01, handleAlong, handleY, 0.02, Math.min(0.16, h * 0.5), 0.02, mat('metal')));
    }
  }
  return boxes;
}

/**
 * Colimaçon : des marches en éventail autour d'un noyau central. Chaque marche est découpée en tronçons radiaux (des boîtes
 * tournées autour de l'axe vertical, champ `angle`) qui épousent à peu près le secteur ; le noyau monte jusqu'au garde-corps de l'étage.
 */
function spiralBoxes(stair, layout, wallHeight, mat) {
  const part = layout.parts[0];
  const n = stairStepCount(wallHeight);
  const rise = stairRise(wallHeight);
  const riser = rise / n;
  const open = stairUnder(stair) === 'open';
  const treads = n - 1;
  const dTheta = part.sweep / treads;
  const boxes = [];
  const segments = 4;
  const radial = (part.rOut - part.rIn) / segments;
  const push = (cx, cz, bottom, top, sizeX, sizeZ, angle, partName, tag = {}) => {
    if (top - bottom < 1e-6) return;
    boxes.push({
      kind: 'stair', material: mat(partName), stairId: stair.id,
      position: [r6(cx), r6(FLOOR_THICKNESS + (bottom + top) / 2), r6(cz)],
      size: [r6(sizeX), r6(top - bottom), r6(sizeZ)],
      ...(angle ? { angle: r6(angle) } : {}),
      ...tag,
    });
  };
  for (let k = 1; k <= treads; k++) {
    const theta = part.a0 + part.sign * dTheta * (k - 0.5);
    const top = k * riser;
    for (let sIdx = 0; sIdx < segments; sIdx++) {
      const r0 = part.rIn + sIdx * radial;
      const r1 = r0 + radial;
      const mid = (r0 + r1) / 2;
      const across = Math.min(r1 * dTheta * 1.02, 2 * r1 * Math.sin(dTheta / 2) * 1.02);
      // la boîte locale : x = sens radial, z = sens tangentiel ; tournée de -theta pour que x pointe vers theta
      const cx = part.cx + Math.cos(theta) * mid;
      const cz = part.cy + Math.sin(theta) * mid;
      const angle = -theta;
      if (open) {
        push(cx, cz, Math.max(0, top - STAIR_TREAD), top, radial + 0.01, across, angle, 'tread');
      } else {
        push(cx, cz, 0, top - 0.04, radial + 0.01, across, angle, 'struct');
        push(cx, cz, top - 0.04, top, radial + 0.01, across, angle, 'tread');
      }
    }
  }
  // noyau
  const pole = STAIR_LIMITS.pole;
  push(part.cx, part.cy, 0, rise + RAIL_HEIGHT, pole * 2, pole * 2, 0, 'struct');
  return boxes;
}

/* ---- Garde-corps d'un escalier ---- */

/**
 * Parcours de garde-corps : suites de points { x, z, g } (g : hauteur de la marche sous le point, mètres au-dessus du sol du niveau) et
 * `ground(x, z)` pour la hauteur de la marche à un point. `where` : 'stairs' (le long des marches, au niveau d'où l'escalier part :
 * les côtés libres, ni contre un mur, ni au pied ou à l'arrivée) ou 'well' (autour de la trémie, à l'étage : tout le contour sauf
 * l'arrivée, plat).
 */
function railRuns(stair, wallHeight, plan, where) {
  const layout = stairLayout(stair);
  const probe = wallProbe(plan);
  const cs = plan?.grid?.cellSize ?? 0.5;
  const n = stairStepCount(wallHeight);
  const riser = stairRise(wallHeight) / n;
  const INSET = 0.035;
  const runs = [];
  // morceaux de [a, b] qu'aucun mur ne longe (coupés aux lignes de la grille)
  const freeIntervals = (side, line, a, b) => {
    const out = [];
    let cur = null;
    for (let k = Math.floor(a / cs + 1e-9); k < Math.ceil(b / cs - 1e-9); k++) {
      const lo = Math.max(a, k * cs);
      const hi = Math.min(b, (k + 1) * cs);
      if (hi - lo < 1e-6) continue;
      if (probe(side, line, lo, hi)) {
        if (cur) out.push(cur);
        cur = null;
      } else if (cur) cur[1] = hi;
      else cur = [lo, hi];
    }
    if (cur) out.push(cur);
    return out;
  };
  const straight = (side, line, lo, hi, offset, gA, gB, ground) => {
    const horizontal = side === 'n' || side === 's';
    const p = (q, g) => (horizontal ? { x: q, z: line + offset, g } : { x: line + offset, z: q, g });
    runs.push({ pts: [p(lo, gA), p(hi, gB)], ground });
  };

  if (where === 'well') {
    const rects = layout.kind === 'spiral' ? [layout.bbox] : layout.parts.map((part) => part.rect);
    for (const { side, line, a, b } of openEdge(exposedEdges(rects), layout.top)) {
      const outward = side === 'n' || side === 'w' ? -0.03 : 0.03;
      for (const [lo, hi] of freeIntervals(side, line, a, b)) straight(side, line, lo, hi, outward, 0, 0, () => 0);
    }
    return runs;
  }

  if (layout.kind === 'spiral') {
    const part = layout.parts[0];
    const treads = n - 1;
    const dTheta = part.sweep / treads;
    const R = part.rOut - 0.03;
    const pts = [];
    for (let k = 0; k <= treads; k++) {
      const angle = part.a0 + part.sign * dTheta * k;
      pts.push({ x: part.cx + Math.cos(angle) * R, z: part.cy + Math.sin(angle) * R, g: k * riser });
    }
    const ground = (x, z) => {
      const rel = part.sign * (Math.atan2(z - part.cy, x - part.cx) - part.a0);
      const delta = ((rel % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      return Math.min(treads, Math.max(1, Math.ceil(delta / dTheta - 1e-9))) * riser;
    };
    runs.push({ pts, ground });
    return runs;
  }

  const edges = exposedEdges(layout.parts.map((part) => part.rect));
  layout.parts.forEach((part, i) => {
    const mine = edges.filter((edge) => edge.part === i);
    if (part.type === 'landing') {
      const top = Math.round(part.t * n) * riser;
      for (const { side, line, a, b } of mine) {
        const inward = side === 'n' || side === 'w' ? INSET : -INSET;
        for (const [lo, hi] of freeIntervals(side, line, a, b)) straight(side, line, lo, hi, inward, top, top, () => top);
      }
      return;
    }
    const k0 = Math.round(part.t0 * n);
    const m = Math.round(part.t1 * n) - k0;
    if (m < 1) return;
    const treads = Math.max(m - 1, 1);
    const depth = part.len / treads;
    const r = part.rect;
    const vertical = part.dir === 'n' || part.dir === 's';
    // distance depuis le pied de la volée au point (x, z)
    const along = (x, z) => ({ n: r.y1 - z, s: z - r.y0, e: x - r.x0, w: r.x1 - x })[part.dir];
    const line = (s) => k0 * riser + (s / depth) * riser; // la ligne des nez de marche
    const ground = (x, z) => (k0 + Math.min(treads, Math.max(1, Math.ceil(along(x, z) / depth - 1e-9)))) * riser;
    for (const { side, line: at, a, b } of mine) {
      if (vertical ? (side === 'n' || side === 's') : (side === 'e' || side === 'w')) continue; // bords d'about : le pied, l'arrivée, le palier
      const inward = side === 'n' || side === 'w' ? INSET : -INSET;
      for (const [lo, hi] of freeIntervals(side, at, a, b)) {
        const horizontal = side === 'n' || side === 's';
        const sOf = (q) => along(horizontal ? q : at, horizontal ? at : q);
        straight(side, at, lo, hi, inward, line(sOf(lo)), line(sOf(hi)), ground);
      }
    }
  });
  return runs;
}

const RAIL_STYLES = {
  handrail: { post: { w: 0.04, part: 'metal', every: 1.6 }, beam: { t: 0.05, h: 0.045, part: 'wood' } },
  wood: { post: { w: 0.07, part: 'wood', every: 1.2 }, bars: { w: 0.028, gap: 0.13, part: 'wood' }, beam: { t: 0.075, h: 0.045, part: 'wood' } },
  metal: { post: { w: 0.035, part: 'metal', every: 1.2 }, bars: { w: 0.012, gap: 0.11, part: 'metal' }, beam: { t: 0.04, h: 0.032, part: 'metal' } },
  cable: { post: { w: 0.045, part: 'metal', every: 1.2 }, wires: { at: [0.2, 0.4, 0.6, 0.8], t: 0.008, h: 0.008, part: 'steel' }, beam: { t: 0.06, h: 0.04, part: 'wood' } },
  flat: { post: { w: 0.04, part: 'metal', every: 1.2 }, wires: { at: [0.18, 0.4, 0.62, 0.84], t: 0.012, h: 0.05, part: 'metal' }, beam: { t: 0.05, h: 0.03, part: 'metal' } },
  slats: { post: { w: 0.06, part: 'wood', every: 1.4 }, bars: { w: 0.04, gap: 0.075, part: 'wood' }, beam: { t: 0.09, h: 0.04, part: 'wood' } },
};

/**
 * Boîtes des garde-corps d'un escalier (kind « rail » : posts, barreaux, câbles, main courante). Les barres inclinées utilisent `angle`
 * (autour de la verticale) et `pitch` (inclinaison dans leur plan vertical). `where` : voir railRuns.
 */
export function stairRailBoxes(stair, wallHeight, plan, where = 'stairs') {
  const style = RAIL_STYLES[stairRail(stair)];
  if (!style) return [];
  const finish = stairFinish(stair);
  const boxes = [];
  const base = FLOOR_THICKNESS;
  const put = (part, position, size, extra = {}) => boxes.push({
    kind: 'rail', material: `stair:${finish}:${part}`, stairId: stair.id,
    position: [r6(position[0]), r6(base + position[1]), r6(position[2])],
    size: [r6(size[0]), r6(size[1]), r6(size[2])],
    ...extra,
  });
  // une barre entre deux points (x, y, z), épaisseur t horizontale et h verticale
  const bar = (part, a, b, t, h) => {
    const dx = b[0] - a[0];
    const dz = b[2] - a[2];
    const flat = Math.hypot(dx, dz);
    const length = Math.hypot(flat, b[1] - a[1]);
    if (length < 1e-4) return;
    const angle = flat > 1e-6 ? Math.atan2(-dz, dx) : 0;
    const pitch = Math.atan2(b[1] - a[1], flat);
    put(part, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [length + 0.012, h, t], { ...(angle ? { angle: r6(angle) } : {}), ...(pitch ? { pitch: r6(pitch) } : {}) });
  };
  const H = RAIL_HEIGHT;
  for (const run of railRuns(stair, wallHeight, plan, where)) {
    const pts = run.pts;
    // longueur horizontale cumulée
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
    const total = cum[cum.length - 1];
    if (total < 0.05) continue;
    const at = (u) => {
      let i = 1;
      while (i < pts.length - 1 && cum[i] < u) i++;
      const f = Math.min(1, Math.max(0, (u - cum[i - 1]) / Math.max(cum[i] - cum[i - 1], 1e-9)));
      const a = pts[i - 1];
      const b = pts[i];
      return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, g: a.g + (b.g - a.g) * f };
    };
    const { post, bars, wires, beam } = style;
    const postCount = Math.max(1, Math.ceil(total / post.every));
    for (let k = 0; k <= postCount; k++) {
      const p = at((total * k) / postCount);
      const bottom = Math.max(0, run.ground(p.x, p.z) - 0.05);
      const top = p.g + H + beam.h / 2;
      put(post.part, [p.x, (bottom + top) / 2, p.z], [post.w, top - bottom, post.w]);
    }
    if (bars) {
      const count = Math.max(1, Math.round(total / bars.gap));
      for (let k = 1; k < count; k++) {
        const p = at((total * k) / count);
        const bottom = Math.max(0, run.ground(p.x, p.z) - 0.04);
        const top = p.g + H;
        put(bars.part, [p.x, (bottom + top) / 2, p.z], [bars.w, top - bottom, bars.w]);
      }
    }
    if (wires) {
      for (const f of wires.at) for (let i = 1; i < pts.length; i++) bar(wires.part, [pts[i - 1].x, pts[i - 1].g + H * f, pts[i - 1].z], [pts[i].x, pts[i].g + H * f, pts[i].z], wires.t, wires.h);
    }
    for (let i = 1; i < pts.length; i++) bar(beam.part, [pts[i - 1].x, pts[i - 1].g + H, pts[i - 1].z], [pts[i].x, pts[i].g + H, pts[i].z], beam.t, beam.h);
  }
  return boxes;
}

/** Garde-corps de la trémie d'un escalier, vue de l'étage (le garde-corps réel que la visite respecte aussi : wellRails). */
export function stairWellBoxes(stair, wallHeight, plan) {
  return stairRailBoxes(stair, wallHeight, plan, 'well');
}

/** Retire d'une boîte de sol (position, size) la partie couverte par des rectangles ; renvoie 0 à n boîtes. */
function cutFloorBox(box, holes) {
  let pieces = [{ x0: box.position[0] - box.size[0] / 2, x1: box.position[0] + box.size[0] / 2, z0: box.position[2] - box.size[2] / 2, z1: box.position[2] + box.size[2] / 2 }];
  for (const hole of holes) {
    const next = [];
    for (const piece of pieces) {
      const h = { x0: hole.x0, x1: hole.x1, z0: hole.y0, z1: hole.y1 };
      if (piece.x0 >= h.x1 - 1e-9 || piece.x1 <= h.x0 + 1e-9 || piece.z0 >= h.z1 - 1e-9 || piece.z1 <= h.z0 + 1e-9) {
        next.push(piece);
        continue;
      }
      if (piece.z0 < h.z0) next.push({ ...piece, z1: h.z0 });
      if (piece.z1 > h.z1) next.push({ ...piece, z0: h.z1 });
      const z0 = Math.max(piece.z0, h.z0);
      const z1 = Math.min(piece.z1, h.z1);
      if (piece.x0 < h.x0) next.push({ x0: piece.x0, x1: h.x0, z0, z1 });
      if (piece.x1 > h.x1) next.push({ x0: h.x1, x1: piece.x1, z0, z1 });
    }
    pieces = next;
  }
  return pieces
    .filter((piece) => piece.x1 - piece.x0 > 0.005 && piece.z1 - piece.z0 > 0.005)
    .map((piece) => ({
      ...box,
      position: [r6((piece.x0 + piece.x1) / 2), box.position[1], r6((piece.z0 + piece.z1) / 2)],
      size: [r6(piece.x1 - piece.x0), box.size[1], r6(piece.z1 - piece.z0)],
    }));
}

/* ---- Finitions des pièces : sol, murs, plinthes ---- */

/**
 * Sols : `pattern` décrit la texture procédurale dessinée par viewer3d.js (planches, chevrons, carreaux, damier, grain) ; `size` = côté
 * d'une répétition de la texture en mètres. Les couleurs sont celles de l'aperçu.
 */
export const FLOOR_FINISHES = Object.freeze([
  { id: 'oak', label: 'Parquet chêne', pattern: 'planks', color: '#c9a36b', accent: '#b88e54', size: 1.2 },
  { id: 'ash', label: 'Parquet frêne clair', pattern: 'planks', color: '#e3cfa6', accent: '#d2b98a', size: 1.2 },
  { id: 'walnut', label: 'Parquet noyer', pattern: 'planks', color: '#7b5539', accent: '#68452e', size: 1.2 },
  { id: 'herringbone', label: 'Point de Hongrie', pattern: 'herringbone', color: '#b98c5a', accent: '#9d7447', size: 0.96 },
  { id: 'tile-white', label: 'Carrelage blanc', pattern: 'tiles', color: '#e9e9e6', accent: '#b9bbbb', size: 1.2 },
  { id: 'tile-grey', label: 'Carrelage gris', pattern: 'tiles', color: '#9ca0a5', accent: '#7b7f84', size: 1.2 },
  { id: 'checker', label: 'Damier noir et blanc', pattern: 'checker', color: '#eeeeee', accent: '#2b2b2f', size: 0.8 },
  { id: 'terracotta', label: 'Terre cuite', pattern: 'tiles', color: '#b8643f', accent: '#8f4a2c', size: 0.9 },
  { id: 'concrete', label: 'Béton ciré', pattern: 'grain', color: '#a8a8a4', accent: '#8e8e8a', size: 2 },
  { id: 'carpet', label: 'Moquette', pattern: 'grain', color: '#8c93a6', accent: '#767d90', size: 0.5 },
]);

/** Murs : peintures unies et textures. `color` est la teinte de base ; une couleur libre « #rrggbb » est aussi acceptée. */
export const WALL_FINISHES = Object.freeze([
  { id: 'white', label: 'Blanc', kind: 'paint', color: '#f2efe9' },
  { id: 'cream', label: 'Crème', kind: 'paint', color: '#ebdfc6' },
  { id: 'greige', label: 'Taupe', kind: 'paint', color: '#b9a999' },
  { id: 'grey-light', label: 'Gris clair', kind: 'paint', color: '#cfd3d6' },
  { id: 'anthracite', label: 'Anthracite', kind: 'paint', color: '#5b6068' },
  { id: 'blue-soft', label: 'Bleu doux', kind: 'paint', color: '#b7cbe0' },
  { id: 'blue-night', label: 'Bleu nuit', kind: 'paint', color: '#38506e' },
  { id: 'sage', label: 'Vert sauge', kind: 'paint', color: '#adbfa5' },
  { id: 'forest', label: 'Vert forêt', kind: 'paint', color: '#44604f' },
  { id: 'blush', label: 'Rose poudré', kind: 'paint', color: '#e6c6c2' },
  { id: 'terracotta', label: 'Terracotta', kind: 'paint', color: '#c98a6b' },
  { id: 'mustard', label: 'Jaune moutarde', kind: 'paint', color: '#e2bf6a' },
  { id: 'brick', label: 'Brique', kind: 'texture', pattern: 'brick', color: '#a85a43', accent: '#d8d2c8', size: 1.2 },
  { id: 'concrete', label: 'Béton brut', kind: 'texture', pattern: 'grain', color: '#a3a3a0', accent: '#8a8a87', size: 2 },
  { id: 'wainscot', label: 'Lambris bois', kind: 'texture', pattern: 'boards', color: '#c7a678', accent: '#a9875b', size: 1 },
  { id: 'stripes', label: 'Papier rayé', kind: 'texture', pattern: 'stripes', color: '#e9e2d0', accent: '#c9b98f', size: 0.8 },
]);

/** Plinthes : `color` ; « none » = pas de plinthe. Hauteur et épaisseur fixes (BASEBOARD). */
export const BASEBOARD_FINISHES = Object.freeze([
  { id: 'none', label: 'Aucune', color: null },
  { id: 'white', label: 'Blanche', color: '#f4f2ee' },
  { id: 'wood', label: 'Bois', color: '#9a7449' },
  { id: 'black', label: 'Noire', color: '#25262a' },
  { id: 'grey', label: 'Grise', color: '#8b8f94' },
]);
export const BASEBOARD = Object.freeze({ height: 0.1, depth: 0.014 });

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const finishById = (list, id) => list.find((item) => item.id === id) ?? null;
export const isWallFinishValue = (value) => typeof value === 'string' && (HEX_COLOR.test(value) || Boolean(finishById(WALL_FINISHES, value)));

/** Finitions d'une pièce : { floor?, wall?, baseboard? } (objet vide si aucune). */
export function getRoomFinish(plan, room) {
  return plan.roomFinishes?.[roomKey(room)] ?? {};
}

/**
 * Change la finition d'une pièce : `patch` = { floor?, wall?, baseboard? } ; une valeur null ou « default » revient à la finition par défaut
 * (sol selon le type de pièce, murs de la palette du logement, pas de plinthe). Valeurs inconnues ignorées. Même plan si rien ne change.
 */
export function setRoomFinish(plan, room, patch) {
  const key = roomKey(room);
  const old = plan.roomFinishes?.[key] ?? {};
  const next = { ...old };
  const apply = (field, valid) => {
    if (patch[field] === undefined) return;
    if (patch[field] === null || patch[field] === 'default') delete next[field];
    else if (valid(patch[field])) next[field] = patch[field];
  };
  apply('floor', (v) => Boolean(finishById(FLOOR_FINISHES, v)));
  apply('wall', isWallFinishValue);
  apply('baseboard', (v) => Boolean(finishById(BASEBOARD_FINISHES, v)) && v !== 'none');
  if (patch.baseboard === 'none') delete next.baseboard;
  if (JSON.stringify(next) === JSON.stringify(old)) return plan;
  const roomFinishes = { ...(plan.roomFinishes ?? {}) };
  if (Object.keys(next).length) roomFinishes[key] = next;
  else delete roomFinishes[key];
  return { ...plan, roomFinishes };
}


/* ---- Textures procédurales des finitions (dessinées sur un contexte 2D fourni : core.js ne touche pas au DOM) ---- */

function hashText(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rgbOf = (hex) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** Éclaircit (facteur > 1) ou assombrit une couleur « #rrggbb » → « rgb(r,g,b) ». */
export function shadeColor(hex, factor) {
  const [r, g, b] = rgbOf(hex).map((v) => Math.min(255, Math.max(0, Math.round(v * factor))));
  return `rgb(${r},${g},${b})`;
}

/**
 * Dessine une répétition de la texture d'une finition dans un contexte 2D carré de `N` pixels. Le motif se raccorde avec lui-même
 * (le bord droit rejoint le bord gauche, le bas rejoint le haut). Motifs : planks (lames), herringbone (point de Hongrie), tiles (carreaux),
 * checker (damier), grain (grain : béton, moquette), brick (briques), boards (lambris), stripes (rayures).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} N
 * @param {{ id: string, pattern: string, color: string, accent?: string }} finish
 */
export function drawFinishPattern(ctx, N, finish) {
  const rand = seeded(hashText(finish.id));
  const base = finish.color;
  const accent = finish.accent ?? finish.color;
  const U = N / 512;
  const jitter = (spread) => shadeColor(base, 1 - spread + rand() * spread * 2);
  ctx.save();
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, N, N);
  const line = (x0, y0, x1, y1, width, alpha) => {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = accent;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.globalAlpha = 1;
  };
  switch (finish.pattern) {
    case 'planks': {
      const rows = 8;
      const rh = N / rows;
      for (let r = 0; r < rows; r++) {
        const joint = (0.1 + rand() * 0.8) * N;
        ctx.fillStyle = jitter(0.07);
        ctx.fillRect(0, r * rh, joint, rh);
        ctx.fillStyle = jitter(0.07);
        ctx.fillRect(joint, r * rh, N - joint, rh);
        for (let k = 0; k < 7; k++) {
          const y = r * rh + rand() * rh;
          const x = rand() * N;
          line(x, y, Math.min(N, x + N * (0.1 + rand() * 0.3)), y, U, 0.2);
        }
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.75;
        ctx.fillRect(0, r * rh, N, 2 * U);
        ctx.fillRect(joint - U, r * rh, 2 * U, rh);
        ctx.fillRect(0, r * rh, 2 * U, rh);
        ctx.globalAlpha = 1;
      }
      break;
    }
    case 'herringbone': {
      const cw = N / 4;
      const t = N / 8;
      for (let r = -1; r < 9; r++) {
        for (let c = 0; c < 4; c++) {
          const x0 = c * cw;
          const y0 = r * t;
          const up = c % 2 === 1;
          const a = up ? y0 + t : y0; // hauteur du bord gauche
          const b = up ? y0 : y0 + t; // hauteur du bord droit
          ctx.beginPath();
          ctx.moveTo(x0, a);
          ctx.lineTo(x0 + cw, b);
          ctx.lineTo(x0 + cw, b + t);
          ctx.lineTo(x0, a + t);
          ctx.closePath();
          ctx.fillStyle = jitter(0.09);
          ctx.fill();
          ctx.strokeStyle = accent;
          ctx.globalAlpha = 0.8;
          ctx.lineWidth = 2 * U;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      break;
    }
    case 'tiles': {
      const n = 3;
      const t = N / n;
      const gap = 5 * U;
      ctx.fillStyle = accent;
      ctx.fillRect(0, 0, N, N);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          ctx.fillStyle = jitter(0.035);
          ctx.fillRect(i * t + gap / 2, j * t + gap / 2, t - gap, t - gap);
        }
      }
      break;
    }
    case 'checker': {
      const n = 2;
      const t = N / n;
      ctx.fillStyle = accent;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if ((i + j) % 2 === 1) ctx.fillRect(i * t, j * t, t, t);
      break;
    }
    case 'grain': {
      const image = ctx.getImageData(0, 0, N, N);
      const [r0, g0, b0] = rgbOf(base);
      const data = image.data;
      for (let i = 0; i < data.length; i += 4) {
        const n = (rand() - 0.5) * 22;
        data[i] = Math.min(255, Math.max(0, r0 + n));
        data[i + 1] = Math.min(255, Math.max(0, g0 + n));
        data[i + 2] = Math.min(255, Math.max(0, b0 + n));
      }
      ctx.putImageData(image, 0, 0);
      const [ra, ga, ba] = rgbOf(accent);
      for (let k = 0; k < 40; k++) {
        const cx = rand() * N;
        const cy = rand() * N;
        const radius = N * (0.04 + rand() * 0.12);
        for (const ox of [-N, 0, N]) {
          for (const oy of [-N, 0, N]) {
            const gradient = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, radius);
            gradient.addColorStop(0, `rgba(${ra},${ga},${ba},0.16)`);
            gradient.addColorStop(1, `rgba(${ra},${ga},${ba},0)`);
            ctx.fillStyle = gradient;
            ctx.fillRect(cx + ox - radius, cy + oy - radius, radius * 2, radius * 2);
          }
        }
      }
      break;
    }
    case 'brick': {
      const rows = 16;
      const rh = N / rows;
      const bw = N / 4;
      const gap = 4 * U;
      ctx.fillStyle = accent;
      ctx.fillRect(0, 0, N, N);
      for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (bw / 2);
        for (let k = -1; k < 5; k++) {
          ctx.fillStyle = jitter(0.1);
          ctx.fillRect(k * bw + offset + gap / 2, r * rh + gap / 2, bw - gap, rh - gap);
        }
      }
      break;
    }
    case 'boards': {
      const n = 8;
      const bw = N / n;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = jitter(0.08);
        ctx.fillRect(i * bw, 0, bw, N);
        for (let k = 0; k < 4; k++) {
          const x = i * bw + rand() * bw;
          line(x, 0, x, N, U, 0.18);
        }
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(i * bw, 0, 3 * U, N);
        ctx.globalAlpha = 1;
      }
      break;
    }
    case 'stripes': {
      const n = 8;
      const bw = N / n;
      ctx.fillStyle = accent;
      for (let i = 0; i < n; i += 2) ctx.fillRect(i * bw, 0, bw, N);
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

/* ---- Éclairage : position du soleil, ensoleillement ---- */

const DEG = Math.PI / 180;
const MONTH_MIDDLE_DAY = [17, 47, 75, 105, 135, 162, 198, 228, 258, 288, 318, 344]; // jour de l'année au milieu de chaque mois

/**
 * Position du soleil (formules astronomiques simples, sans équation du temps ni changement d'heure : `hour` est l'heure solaire).
 * @param {{ hour: number, month: number, latitude: number }} when
 * @returns {{ elevation: number, azimuth: number }} radians ; azimut mesuré depuis le nord, vers l'est (0 = nord, π/2 = est, π = sud)
 */
export function sunPosition({ hour, month, latitude }) {
  const day = MONTH_MIDDLE_DAY[Math.min(Math.max(Math.round(month), 1), 12) - 1];
  const declination = 23.44 * DEG * Math.sin(((2 * Math.PI) / 365) * (day - 81));
  const phi = latitude * DEG;
  const hourAngle = (hour - 12) * 15 * DEG;
  const sinElev = Math.sin(phi) * Math.sin(declination) + Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle);
  const elevation = Math.asin(Math.min(Math.max(sinElev, -1), 1));
  let azimuth = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(phi) - Math.tan(declination) * Math.cos(phi)) + Math.PI;
  azimuth = ((azimuth % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return { elevation, azimuth };
}

/**
 * Direction VERS le soleil dans le repère 3D de la scène (x = plan x, y = hauteur, z = plan y), `north` = rotation du plan par rapport au nord
 * en degrés (0 : le nord est vers le haut du plan, c'est-à-dire vers −z ; 90 : le nord est vers la droite, +x).
 */
export function sunDirection(sun, north = 0) {
  const a = sun.azimuth + north * DEG; // azimut dans le repère du plan, depuis « le haut du plan »
  const horizontal = Math.cos(sun.elevation);
  return { x: horizontal * Math.sin(a), y: Math.sin(sun.elevation), z: -horizontal * Math.cos(a) };
}

/** Heures de lever et de coucher du soleil (heure solaire), ou null en cas de jour ou nuit polaire. */
export function daylightHours({ month, latitude }) {
  let rise = null;
  let set = null;
  for (let h = 0; h <= 24; h += 0.05) {
    const up = sunPosition({ hour: h, month, latitude }).elevation > 0;
    const before = sunPosition({ hour: Math.max(0, h - 0.05), month, latitude }).elevation > 0;
    if (up && !before && rise === null) rise = h;
    if (!up && before) set = h;
  }
  return rise === null || set === null ? null : { rise, set };
}

function rayHitsBox(origin, dir, box, maxT = Infinity) {
  if (box.angle) {
    // boîte tournée autour de l'axe vertical : on tourne le rayon dans son repère
    const cos = Math.cos(box.angle);
    const sin = Math.sin(box.angle);
    const rel = [origin[0] - box.position[0], origin[2] - box.position[2]];
    const local = (x, z) => [x * cos - z * sin, x * sin + z * cos];
    const [ox, oz] = local(rel[0], rel[1]);
    const [dx, dz] = local(dir[0], dir[2]);
    return rayHitsBox([ox + box.position[0], origin[1], oz + box.position[2]], [dx, dir[1], dz], { position: box.position, size: box.size }, maxT);
  }
  let tMin = 1e-6;
  let tMax = maxT;
  for (let axis = 0; axis < 3; axis++) {
    const lo = box.position[axis] - box.size[axis] / 2;
    const hi = box.position[axis] + box.size[axis] / 2;
    const o = origin[axis];
    const d = dir[axis];
    if (Math.abs(d) < 1e-12) {
      if (o < lo || o > hi) return false;
    } else {
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return false;
    }
  }
  return true;
}

const OPAQUE_KINDS = new Set(['wall', 'sill', 'lintel', 'frame', 'floor', 'stair', 'threshold', 'roof']);

/**
 * Ensoleillement d'une pièce : pour chaque demi-heure de jour, des points d'échantillonnage du sol sont-ils atteints par un rayon de soleil
 * (qui passe par les fenêtres et les portes vitrées, mais ni par les murs, ni par le plafond, ni par le plancher de l'étage au-dessus) ?
 * `occluders` = boîtes de la structure (buildStructure avec `roof: true`) dans le repère de la scène : celles du niveau et des niveaux
 * au-dessus, décalées de leur hauteur.
 * @param {{ cells: {x:number,y:number}[] }} room
 * @param {number} cellSize
 * @param {{ x:number, y:number, z:number }[]} directions directions vers le soleil, une par instant
 * @param {StructureBox[]} occluders
 * @param {number} baseY hauteur du sol de la pièce dans la scène
 * @returns {{ lit: number[], fraction: number }} part des points éclairés à chaque instant et moyenne
 */
export function sunlightForRoom(room, cellSize, directions, occluders, baseY = 0, { step = 0.5, height = 0.8 } = {}) {
  const solid = occluders.filter((box) => OPAQUE_KINDS.has(box.kind));
  const samples = [];
  const per = Math.max(1, Math.round(step / cellSize));
  const stride = Math.max(1, per);
  for (const c of room.cells) {
    if (c.x % stride !== 0 || c.y % stride !== 0) continue;
    samples.push([(c.x + 0.5 * stride) * cellSize, baseY + height, (c.y + 0.5 * stride) * cellSize]);
  }
  if (!samples.length) for (const c of room.cells.slice(0, 1)) samples.push([(c.x + 0.5) * cellSize, baseY + height, (c.y + 0.5) * cellSize]);
  const lit = directions.map((dir) => {
    if (dir.y <= 0.02) return 0;
    const d = [dir.x, dir.y, dir.z];
    let n = 0;
    for (const origin of samples) if (!solid.some((box) => rayHitsBox(origin, d, box))) n++;
    return n / samples.length;
  });
  const fraction = lit.length ? lit.reduce((a, b) => a + b, 0) / lit.length : 0;
  return { lit, fraction };
}

/**
 * Rapport d'ensoleillement d'un niveau pour le mois, la latitude et l'orientation du document : pour chaque pièce, la part des points du sol
 * éclairés à chaque demi-heure de jour, le nombre d'heures de soleil direct et l'éclairement à l'heure réglée. Les niveaux du dessus
 * (planchers, murs, plafonds) font de l'ombre ; le plafond du niveau lui-même aussi (le soleil n'entre que par les ouvertures).
 * @param {object} doc document
 * @param {number} levelIndex niveau étudié
 * @param {(index: number) => Room[]} roomsOf pièces d'un niveau (le store les garde en mémoire)
 * @returns {{ rise: number | null, set: number | null, hours: number[], rooms: { roomId: string, key: string, lit: number[], fraction: number, sunHours: number, now: number }[] }}
 */
export function computeSunReport(doc, levelIndex, roomsOf = (i) => detectRooms(levelPlan(doc, i)), { step = 0.5 } = {}) {
  const lighting = { ...DEFAULT_LIGHTING, ...(doc.lighting ?? {}) };
  const { month, latitude, north } = lighting;
  const direction = (hour) => sunDirection(sunPosition({ hour, month, latitude }), north);
  const day = daylightHours({ month, latitude });
  const rise = day ? day.rise : sunPosition({ hour: 12, month, latitude }).elevation > 0 ? 0 : null;
  const set = day ? day.set : rise === 0 ? 24 : null;
  const hours = [];
  if (rise !== null) for (let h = Math.ceil(rise / step) * step; h <= set + 1e-9; h += step) hours.push(Math.round(h * 100) / 100);
  const directions = hours.map(direction);
  const occluders = [];
  for (let j = levelIndex; j < doc.levels.length; j++) {
    const view = levelPlan(doc, j);
    const lift = levelElevation(doc, j);
    for (const box of buildStructure(view, { rooms: roomsOf(j), upper: j > 0, roof: true }).boxes) {
      occluders.push({ ...box, position: [box.position[0], box.position[1] + lift, box.position[2]] });
    }
  }
  const view = levelPlan(doc, levelIndex);
  const base = levelElevation(doc, levelIndex) + FLOOR_THICKNESS;
  const nowDirection = [direction(lighting.hour)];
  const rooms = roomsOf(levelIndex).map((room) => {
    const { lit, fraction } = sunlightForRoom(room, view.grid.cellSize, directions, occluders, base);
    const now = sunlightForRoom(room, view.grid.cellSize, nowDirection, occluders, base).lit[0];
    return { roomId: room.id, key: roomKey(room), lit, fraction, sunHours: Math.round(lit.reduce((a, b) => a + b, 0) * step * 10) / 10, now };
  });
  return { rise, set, hours, rooms };
}

/** Nombre de murs d'un niveau qui traversent une trémie (ou un escalier) de `rects` : sert à refuser un mur posé dans un escalier. */
export function countWallsInStairs(plan, stairs = plan.wells ?? []) {
  if (!stairs.length) return 0;
  const cs = plan.grid.cellSize;
  const rects = stairs.flatMap(stairRects);
  let count = 0;
  for (const edge of plan.walls) {
    // Un mur le long du bord d'un escalier ne le traverse pas ; seul un mur strictement à l'intérieur compte.
    const wall = edge.dir === 'h'
      ? { x0: edge.x * cs, x1: (edge.x + 1) * cs, y0: edge.y * cs, y1: edge.y * cs }
      : { x0: edge.x * cs, x1: edge.x * cs, y0: edge.y * cs, y1: (edge.y + 1) * cs };
    if (rects.some((rect) => rectsOverlap(rect, wall))) count++;
  }
  return count;
}

/* ------------------------------------------------------------------ */
/* Pas de grille : 0,5 m ↔ 0,1 m                                       */
/* ------------------------------------------------------------------ */

/** Pas de grille proposés (mètres) : « normal » pour dessiner vite, « fin » pour respecter les distances au centimètre près (10 cm). */
export const GRID_STEPS = Object.freeze([0.5, 0.1]);

/**
 * Convertit tout le document (tous les niveaux) vers un autre pas de grille. Les distances en mètres ne changent pas (mobilier, escaliers,
 * hauteurs) ; les murs, les ouvertures, les clés de pièces et les identifiants du mobilier sont recalculés.
 * - 0,5 → 0,1 : exact (chaque arête devient 5 arêtes, chaque case 25).
 * - 0,1 → 0,5 : les murs sont alignés sur la grille de 50 cm (une arête de 50 cm est conservée si au moins 3 des 5 arêtes fines sont posées) ; `exact` dit
 *   si rien n'a bougé. Les ouvertures qui ne tiennent plus sont retirées, comme le mobilier hors des pièces.
 * Le mobilier converti n'est PAS revalidé : reconcileFurniture (generator.js) s'en charge.
 * @param {object} doc
 * @param {number} cellSize 0,5 ou 0,1
 * @returns {{ ok: true, doc: object, exact: boolean, changed: boolean, lost: { walls: number, openings: number, furniture: number } } | { ok: false, reason: 'step' | 'too-big', errors: string[] }}
 */
export function convertGridStep(doc, cellSize) {
  if (!GRID_STEPS.includes(cellSize)) return { ok: false, reason: 'step', errors: [`Pas de grille non pris en charge : ${String(cellSize)} m.`] };
  const old = doc.grid.cellSize;
  if (Math.abs(old - cellSize) < 1e-9) return { ok: true, doc, exact: true, changed: false, lost: { walls: 0, openings: 0, furniture: 0 } };
  const k = Math.round(Math.max(old, cellSize) / Math.min(old, cellSize));
  const up = cellSize < old; // grille plus fine : tout est multiplié par k
  const width = up ? doc.grid.width * k : Math.ceil(doc.grid.width / k);
  const height = up ? doc.grid.height * k : Math.ceil(doc.grid.height / k);
  if (width > PLAN_LIMITS.gridMax || height > PLAN_LIMITS.gridMax) {
    return { ok: false, reason: 'too-big', errors: [`La grille ferait ${width} × ${height} cases (${PLAN_LIMITS.gridMax} au maximum) : réduisez d'abord le logement.`] };
  }
  const grid = { width, height, cellSize };
  const lost = { walls: 0, openings: 0, furniture: 0 };
  let exact = true;

  const levels = doc.levels.map((level, index) => {
    const view = levelPlan(doc, index);
    const walls = [];
    const openings = [];
    if (up) {
      for (const edge of view.walls) for (let i = 0; i < k; i++) walls.push(edge.dir === 'h' ? { x: edge.x * k + i, y: edge.y * k, dir: 'h' } : { x: edge.x * k, y: edge.y * k + i, dir: 'v' });
      for (const o of view.openings) openings.push({ ...o, start: { x: o.start.x * k, y: o.start.y * k, dir: o.start.dir }, span: o.span * k });
    } else {
      const votes = new Map();
      for (const edge of view.walls) {
        const line = Math.round((edge.dir === 'h' ? edge.y : edge.x) / k);
        const along = Math.floor((edge.dir === 'h' ? edge.x : edge.y) / k);
        const target = edge.dir === 'h' ? { x: along, y: line, dir: 'h' } : { x: line, y: along, dir: 'v' };
        const key = edgeKey(target);
        const entry = votes.get(key) ?? { target, count: 0 };
        entry.count++;
        votes.set(key, entry);
      }
      const need = Math.ceil(k / 2);
      for (const { target, count } of votes.values()) {
        if (count >= need && isEdgeInGrid(grid, target)) walls.push(target);
      }
      walls.sort((a, b) => a.dir.localeCompare(b.dir) || a.y - b.y || a.x - b.x);
      const probe = { ...view, grid, walls, openings: [] };
      const limits = openingSpanLimits(cellSize);
      for (const o of view.openings) {
        const start = { x: Math.round(o.start.x / k), y: Math.round(o.start.y / k), dir: o.start.dir };
        const span = Math.min(Math.max(Math.round(o.span / k), limits.min), limits.max);
        if (canPlaceOpening(probe, start, span).ok) {
          const next = { ...o, start, span };
          probe.openings = [...probe.openings, next];
          openings.push(next);
        } else lost.openings++;
      }
    }
    // Pièces de la nouvelle grille : les clés (type, nom, verrou, finitions) et le mobilier suivent la pièce qui contient l'ancienne case-ancre.
    const next = { ...view, grid, walls, openings };
    delete next.stairs;
    delete next.wells;
    const oldRooms = detectRooms(view);
    const newRooms = detectRooms(next);
    const owner = new Map();
    for (const room of newRooms) for (const c of room.cells) owner.set(`${c.x},${c.y}`, room);
    const cellOf = (x, y) => (up ? owner.get(`${x * k},${y * k}`) : owner.get(`${Math.floor(x / k)},${Math.floor(y / k)}`));
    const remap = (record) => {
      const out = {};
      for (const [key, value] of Object.entries(record ?? {})) {
        const [ax, ay] = key.split(',').map(Number);
        const room = cellOf(ax, ay);
        if (room && !(roomKey(room) in out)) out[roomKey(room)] = value;
      }
      return out;
    };
    const idMap = new Map();
    for (const room of oldRooms) {
      const target = cellOf(room.anchor.x, room.anchor.y);
      if (target) idMap.set(room.id, target.id);
    }
    const furniture = [];
    const seen = new Set();
    for (const item of view.furniture ?? []) {
      const room = owner.get(`${Math.floor(item.x / cellSize)},${Math.floor(item.z / cellSize)}`);
      if (!room) {
        lost.furniture++;
        continue;
      }
      const key = item.id.startsWith(`${item.roomId}:`) ? item.id.slice(item.roomId.length + 1) : item.id;
      const moved = { ...item, roomId: room.id, id: `${room.id}:${key}` };
      if (seen.has(moved.id)) moved.id = `${moved.id}~${seen.size}`;
      seen.add(moved.id);
      furniture.push(moved);
    }
    return {
      ...level,
      walls,
      openings,
      roomTypes: remap(level.roomTypes),
      roomNames: remap(level.roomNames),
      roomLocks: remap(level.roomLocks),
      roomFinishes: remap(level.roomFinishes),
      furniture,
    };
  });

  const converted = { ...doc, grid, levels };
  if (!up) {
    const back = convertGridStep(converted, old);
    let moved = 0; // arêtes fines qui ne reviennent pas à leur place
    let openingsOk = back.ok;
    if (back.ok) {
      doc.levels.forEach((level, i) => {
        const a = new Set(level.walls.map(edgeKey));
        const b = new Set(back.doc.levels[i].walls.map(edgeKey));
        for (const key of a) if (!b.has(key)) moved++;
        for (const key of b) if (!a.has(key)) moved++;
        const same = level.openings.length === back.doc.levels[i].openings.length && level.openings.every((o, j) => edgeKey(o.start) === edgeKey(back.doc.levels[i].openings[j].start) && o.span === back.doc.levels[i].openings[j].span);
        if (!same) openingsOk = false;
      });
    }
    lost.walls = moved;
    exact = back.ok && moved === 0 && openingsOk;
  }
  return { ok: true, doc: converted, exact, changed: true, lost };
}
