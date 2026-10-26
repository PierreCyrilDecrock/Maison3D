// store.js — état de l'application, historique annuler / rétablir, sauvegarde automatique.
// Toute modification du plan passe par une action de ce store. Le plan est traité comme immuable :
// chaque action produit un nouvel objet, et l'historique ne garde que des références (instantanés).
import {
  PLAN_LIMITS,
  addLevel,
  addOpening,
  addStair,
  addWallSegments,
  canPlaceOpening,
  canPlaceStair,
  clearPlan,
  countWallsInStairs,
  createEmptyDocument,
  detectRooms,
  eraseAlongPath,
  findOpenOutlines,
  flipOpening,
  flipStair,
  setStairKind,
  setStairUnder,
  setStairSteps,
  setStairRail,
  setStairFinish,
  getClearanceZones,
  getRoomType,
  isRoomLocked,
  levelPlan,
  normalizeDocument,
  readPlan,
  reconcileRoomTypes,
  removeLevel,
  removeOpening,
  removeStair,
  removeWallSegments,
  renameLevel,
  rotateStair,
  setRoomFinish,
  setRoomInfo,
  setRoomLock,
  updateOpening,
  updateStair,
  withLevelPlan,
  DEFAULT_LIGHTING,
  LAMP_MODES,
  convertGridStep,
} from './core.js';
import { FURNITURE_DATA } from './furniture.js';
import {
  RECIPES,
  STYLE_DENSITY,
  addFurnitureItem,
  checkFurniturePlacement,
  deleteFurnitureItem,
  duplicateFurniture,
  editFurniture,
  generateHome,
  hash,
  reconcileFurniture,
  removeFurniture,
  rotateFurniture,
} from './generator.js';

export const HISTORY_LIMIT = 100;
/** Ancienne clé (avant les projets) : un plan enregistré là devient le premier projet. */
export const STORAGE_KEY = 'maison3d.plan';
export const PROJECTS_KEY = 'maison3d.projects';
export const PROJECT_KEY_PREFIX = 'maison3d.project.';
export const PROJECT_NAME_MAX = 60;
/** Identifiants d'objets du catalogue : un plan lu ne peut référencer que ceux-là. */
export const FURNITURE_IDS = Object.freeze(FURNITURE_DATA.map((def) => def.id));
export const TOOLS = Object.freeze(['wall', 'erase', 'room', 'hand', 'door', 'window', 'passage', 'stair', 'furniture']);
/** Outils qui posent une ouverture. */
export const OPENING_TOOLS = Object.freeze(['door', 'window', 'passage']);

/** Même mobilier, objet pour objet ? (une régénération qui redonne le même résultat n'ajoute rien à l'historique) */
function sameFurniture(a, b) {
  return a === b || (a.length === b.length && a.every((item, i) => JSON.stringify(item) === JSON.stringify(b[i])));
}

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/**
 * @param {import('./core.js').Plan | object} [initial] un document (version 2) ou un plan à un niveau
 *
 * Le store garde le DOCUMENT (tous les niveaux) et un niveau actif ; `state.plan` est la vue à plat du niveau actif
 * (levelPlan) : c'est elle que lisent les fonctions pures.
 * État exposé : { doc, level, plan, tool, canUndo, canRedo, selectedRoomId, selectedOpeningId, selectedStairId, pendingOpening, showClearance }.
 * - subscribe(fn)     : appelé quand le plan change (dessin, annulation, chargement, changement de niveau, type ou nom d'une pièce).
 * - subscribeUi(fn)   : appelé à chaque changement d'état (outil, sélection, éclairage, annuler / rétablir compris).
 * - getRooms(i)       : pièces dérivées du niveau i (le niveau actif par défaut), calculées une fois par vue.
 * - getOutlines()     : contours de murs qui ne ferment aucune pièce (idem).
 * - getClearanceZones() : zones de dégagement des portes (mètres), calculées une fois par plan.
 * La sélection (pièce, ouverture, escalier), l'emplacement en attente d'une ouverture (second toucher) et l'affichage des
 * zones de dégagement sont des états d'affichage : ils n'entrent pas dans l'historique. L'éclairage (heure, mois, nord) est
 * enregistré avec le document mais n'entre pas non plus dans l'historique.
 */
export function createStore(initial = createEmptyDocument()) {
  let doc = normalizeDocument(initial);
  let level = 0;
  let plan = levelPlan(doc, 0);
  let tool = 'wall';
  let selectedRoomId = null;
  let selectedOpeningId = null;
  let selectedStairId = null;
  let selectedItemId = null;
  let pendingItem = null; // { defId, x, z, rotationY } : objet du catalogue à poser (aperçu qui suit le pointeur)
  let pendingOpening = null; // { type, start, span, swing } : aperçu posé au premier toucher, validé au second
  let showClearance = false;
  let zonesCache = { plan: null, zones: [] };
  const roomsByPlan = new WeakMap(); // vue d'un niveau → { rooms, outlines }
  let hintRooms = null; // pièces déjà calculées de la prochaine vue (voir withFurniture)
  let past = []; // documents précédents, le plus ancien en premier (100 au maximum)
  let future = []; // documents annulés, prêts à être rétablis
  let transaction = null; // { base } : un geste en cours (gomme, déplacement) qui ne fera qu'une entrée d'historique

  const planListeners = new Set();
  const uiListeners = new Set();
  let state = snapshot();

  function snapshot() {
    return {
      doc,
      level,
      plan,
      tool,
      canUndo: past.length > 0,
      canRedo: future.length > 0,
      selectedRoomId,
      selectedOpeningId,
      selectedStairId,
      selectedItemId,
      pendingItem,
      pendingOpening,
      showClearance,
    };
  }

  /** Recale le niveau actif et sa vue après un changement de document. */
  function sync() {
    level = clamp(level, 0, doc.levels.length - 1);
    plan = levelPlan(doc, level);
    if (hintRooms) {
      roomsByPlan.set(plan, { rooms: hintRooms, outlines: null });
      hintRooms = null;
    }
  }

  function roomsOf(view) {
    let entry = roomsByPlan.get(view);
    if (!entry) {
      entry = { rooms: detectRooms(view), outlines: null };
      roomsByPlan.set(view, entry);
    }
    return entry;
  }

  /** Pièces du niveau `index` (le niveau actif par défaut), recalculées seulement quand sa vue est un nouvel objet. */
  function getRooms(index = level) {
    return roomsOf(index === level ? plan : levelPlan(doc, index)).rooms;
  }

  /** Contours ouverts du niveau actif, calculés à la demande puis mis en cache avec les pièces. */
  function getOutlines() {
    const entry = roomsOf(plan);
    entry.outlines ??= findOpenOutlines(plan, entry.rooms);
    return entry.outlines;
  }

  function publish(reason, planChanged) {
    if (planChanged && selectedRoomId && !getRooms().some((room) => room.id === selectedRoomId)) selectedRoomId = null;
    if (planChanged && selectedOpeningId && !plan.openings.some((o) => o.id === selectedOpeningId)) selectedOpeningId = null;
    if (planChanged && selectedItemId && !plan.furniture.some((item) => item.id === selectedItemId)) selectedItemId = null;
    if (planChanged && selectedStairId && !(plan.stairs ?? []).some((s) => s.id === selectedStairId)) selectedStairId = null;
    if (planChanged && pendingOpening && !canPlaceOpening(plan, pendingOpening.start, pendingOpening.span).ok) pendingOpening = null;
    state = snapshot();
    if (planChanged) for (const listener of planListeners) listener(state, reason);
    for (const listener of uiListeners) listener(state, reason);
  }

  /** Mémorise le document de départ d'une modification et vide la pile « rétablir ». */
  function remember(base) {
    past.push(base);
    if (past.length > HISTORY_LIMIT) past.shift();
    future = [];
  }

  /** Remplace le document avec une entrée d'historique. */
  function commit(next, reason) {
    remember(doc);
    doc = next;
    sync();
    publish(reason, true);
  }

  /** Remplace le document sans entrée d'historique (pendant une transaction). */
  function replace(next, reason) {
    doc = next;
    sync();
    publish(reason, true);
  }

  /** Applique un nouveau document : dans une transaction, sans historique ; sinon, avec. */
  function applyDoc(next, reason) {
    if (next === doc) {
      hintRooms = null;
      return false;
    }
    if (transaction) replace(next, reason);
    else commit(next, reason);
    return true;
  }

  /** Applique la modification d'une vue de niveau (celle du niveau actif par défaut). */
  function apply(nextPlan, reason, index = level) {
    if (nextPlan === (index === level ? plan : levelPlan(doc, index))) {
      hintRooms = null;
      return false;
    }
    return applyDoc(withLevelPlan(doc, index, nextPlan), reason);
  }

  function beginTransaction() {
    if (!transaction) transaction = { base: doc };
  }

  /** Termine le geste : une seule entrée d'historique s'il a modifié le document. */
  function endTransaction() {
    if (!transaction) return;
    const { base } = transaction;
    transaction = null;
    if (doc !== base) {
      remember(base);
      publish('history', false);
    }
  }

  /** Abandonne le geste et revient au document de départ. */
  function cancelTransaction() {
    if (!transaction) return;
    const { base } = transaction;
    transaction = null;
    if (doc !== base) replace({ ...base, lighting: doc.lighting }, 'cancel');
  }

  function getZones() {
    if (zonesCache.plan !== plan) zonesCache = { plan, zones: getClearanceZones(plan) };
    return zonesCache.zones;
  }

  /**
   * Remet le mobilier d'accord avec les pièces de `next` (voir reconcileFurniture) et mémorise ses pièces : elles sont
   * calculées une seule fois, la lecture suivante de getRooms() les retrouve.
   */
  function withFurniture(next, rooms = null) {
    if (!next.furniture.length) return next;
    const found = rooms ?? detectRooms(next);
    const fixed = reconcileFurniture(next, found);
    hintRooms = found;
    return fixed;
  }

  /** Changement de murs : les nouvelles pièces héritent des types, noms et verrous des anciennes ; le mobilier devenu invalide disparaît. */
  function applyWalls(next, reason) {
    if (next === plan) return false;
    if (countWallsInStairs(next) > countWallsInStairs(plan)) return false; // pas de mur dans une trémie
    return apply(withFurniture(reconcileRoomTypes(plan, next, getRooms())), reason);
  }

  /** Changement d'ouvertures : les pièces ne changent pas, mais une porte ou une fenêtre peut gêner un meuble. */
  const applyOpenings = (next, reason) => (next === plan ? false : apply(withFurniture(next, getRooms()), reason));

  /** Un escalier peut-il se poser ici ? Le niveau de départ, mais aussi l'étage du dessus (murs, autre escalier) comptent. */
  function checkStair(spec, ignoreId = null) {
    const here = canPlaceStair(plan, spec, ignoreId);
    if (!here.ok) return here;
    const up = doc.levels[level + 1];
    if (up) {
      const upView = { grid: plan.grid, walls: up.walls, stairs: up.stairs ?? [], wells: [] };
      const result = canPlaceStair(upView, spec);
      if (!result.ok) return { ok: false, reason: result.reason === 'overlap' ? 'overlap-up' : 'wall-up' };
    } else if (doc.levels.length >= PLAN_LIMITS.levelsMax) {
      return { ok: false, reason: 'top' };
    }
    return { ok: true };
  }

  /** Les trémies d'un niveau changent le niveau du dessus : le mobilier qui s'y trouvait est retiré. */
  function reconcileUpper(nextDoc, index) {
    if (index + 1 >= nextDoc.levels.length) return nextDoc;
    const view = levelPlan(nextDoc, index + 1);
    if (!view.furniture.length) return nextDoc;
    const fixed = reconcileFurniture(view, roomsOf(view).rooms);
    return fixed === view ? nextDoc : withLevelPlan(nextDoc, index + 1, fixed);
  }

  /** Remplace le niveau actif par `nextPlan` et remet d'accord le niveau du dessus (escaliers). */
  function applyStairs(nextPlan, reason, baseDoc = doc) {
    const nextDoc = reconcileUpper(withLevelPlan(baseDoc, level, nextPlan), level);
    return applyDoc(nextDoc, reason);
  }

  function resetSelection() {
    selectedRoomId = null;
    selectedOpeningId = null;
    selectedStairId = null;
    selectedItemId = null;
    pendingItem = null;
    pendingOpening = null;
  }

  /** Applique le résultat d'une retouche de mobilier (editFurniture & co) : historique, sélection, pièces déjà connues. */
  function applyFurniture(result, reason) {
    if (!result.ok) return result;
    hintRooms = getRooms();
    const changed = apply(result.plan, reason);
    return { ...result, changed };
  }

  return {
    getState: () => state,
    getRooms,
    getOutlines,
    getClearanceZones: getZones,
    checkStair,
    /** Un objet du catalogue peut-il se trouver là ? (aperçu en rouge dans l'éditeur) → { ok, reasons, room, conflicts } */
    /** Ce que donnerait une retouche d'objet ({ x, z, rotationY, defId }), sans rien changer → { ok, reasons }. */
    previewFurniture: (id, change) => editFurniture(plan, getRooms(), id, change),
    checkItem: (item, ignore = []) => checkFurniturePlacement(plan, getRooms(), item, { ignore }),
    /** Ce que donnerait setGridStep, sans rien changer (pour demander confirmation). */
    previewGridStep: (cellSize) => convertGridStep(doc, cellSize),

    subscribe(listener) {
      planListeners.add(listener);
      return () => planListeners.delete(listener);
    },

    subscribeUi(listener) {
      uiListeners.add(listener);
      return () => uiListeners.delete(listener);
    },

    actions: {
      setTool(next) {
        if (!TOOLS.includes(next) || next === tool) return;
        tool = next;
        pendingOpening = null;
        if (!OPENING_TOOLS.includes(next)) selectedOpeningId = null; // le panneau de l'ouverture suit les outils d'ouverture
        if (next !== 'stair') selectedStairId = null;
        if (next !== 'furniture') {
          selectedItemId = null;
          pendingItem = null;
        }
        publish('tool', false);
      },

      /** Trace un mur de `from` à `to` (points de grille). Une entrée d'historique. */
      addWalls: (from, to) => applyWalls(addWallSegments(plan, from, to), 'addWalls'),

      /** Efface les murs du segment `from` → `to`. */
      removeWalls: (from, to) => applyWalls(removeWallSegments(plan, from, to), 'removeWalls'),

      /** Gomme le long d'un trajet (coordonnées de grille décimales). Dans une transaction : sans historique. */
      eraseAlong: (a, b, tolerance) => applyWalls(eraseAlongPath(plan, a, b, tolerance), 'erase'),

      /** Sélectionne une pièce (mise en surbrillance) ou, avec null, ne sélectionne rien. Sans historique. Un identifiant inconnu est ignoré. */
      selectRoom(id) {
        const next = id ?? null;
        if (next !== null && !getRooms().some((room) => room.id === next)) return false;
        if (next === selectedRoomId) return false;
        selectedRoomId = next;
        publish('select', false);
        return true;
      },

      /** Pose une ouverture et la sélectionne. Renvoie son identifiant, ou null si elle ne tient pas. Une entrée d'historique. */
      addOpening(spec) {
        const next = addOpening(plan, spec);
        if (next === plan) return null;
        const id = next.openings[next.openings.length - 1].id;
        pendingOpening = null;
        selectedOpeningId = id;
        applyOpenings(next, 'addOpening');
        return id;
      },

      /** Modifie une ouverture (type, largeur, côté, allège, hauteur). Faux si rien ne change ou si elle ne tient pas. */
      updateOpening: (id, patch) => applyOpenings(updateOpening(plan, id, patch), 'updateOpening'),

      /** Change le côté d'ouverture. */
      flipOpening: (id) => applyOpenings(flipOpening(plan, id), 'flipOpening'),

      /** Supprime une ouverture (le mur reste). */
      removeOpening: (id) => applyOpenings(removeOpening(plan, id), 'removeOpening'),

      /** Sélectionne une ouverture pour le panneau de propriétés, ou null. Sans historique. */
      selectOpening(id) {
        const next = id ?? null;
        if (next !== null && !plan.openings.some((o) => o.id === next)) return false;
        if (next === selectedOpeningId) return false;
        selectedOpeningId = next;
        publish('selectOpening', false);
        return true;
      },

      /** Aperçu d'une ouverture au premier toucher (null pour l'abandonner). Sans historique. */
      setPendingOpening(spec) {
        const next = spec ? { type: spec.type, start: { ...spec.start }, span: spec.span, swing: spec.swing } : null;
        if (JSON.stringify(next) === JSON.stringify(pendingOpening)) return false;
        pendingOpening = next;
        publish('pendingOpening', false);
        return true;
      },

      /** Inverse le côté d'ouverture de l'aperçu en attente. */
      flipPendingOpening() {
        if (!pendingOpening) return false;
        pendingOpening = { ...pendingOpening, swing: pendingOpening.swing === 'a' ? 'b' : 'a' };
        publish('pendingOpening', false);
        return true;
      },

      /** Pose l'ouverture en attente (second toucher). Renvoie son identifiant ou null. */
      commitPendingOpening() {
        return pendingOpening ? this.addOpening(pendingOpening) : null;
      },

      /** Affiche ou masque les zones de dégagement des portes (aide au débogage). */
      showClearance(on) {
        const next = Boolean(on);
        if (next === showClearance) return false;
        showClearance = next;
        publish('clearance', false);
        return true;
      },

      /** Change le type et / ou le nom d'une pièce, désignée par son identifiant. Une entrée d'historique. Changer le type retire le mobilier de la pièce. */
      setRoomInfo(id, info) {
        const room = getRooms().find((r) => r.id === id);
        if (!room) return false;
        let next = setRoomInfo(plan, room, info);
        if (next !== plan && getRoomType(next, room) !== getRoomType(plan, room)) {
          next = { ...next, furniture: next.furniture.filter((item) => item.roomId !== id) };
        }
        return apply(next, 'roomInfo');
      },

      /** Finitions d'une pièce : { floor?, wall?, baseboard? } (null ou « default » = valeur par défaut). Une entrée d'historique. */
      setRoomFinish(id, patch) {
        const room = getRooms().find((r) => r.id === id);
        if (!room) return false;
        return apply(setRoomFinish(plan, room, patch), 'finish');
      },

      /**
       * Génère le mobilier de tout le logement (les pièces verrouillées sont conservées). Une entrée d'historique.
       * Sans options : graine et palette du plan. Renvoie { ok, unchanged?, reason?, reports, seed, style } (`unchanged` : même résultat, rien ajouté à l'historique) ;
       * raison : 'locked' (toutes les pièces sont verrouillées), 'no-room' (aucune pièce typée à meubler).
       * `scope: 'all'` meuble tous les niveaux d'un coup (rapports : ceux du niveau actif).
       */
      generateHome({ seed = plan.style.seed, style = plan.style.preset, scope = 'level' } = {}) {
        const indexes = scope === 'all' ? doc.levels.map((_, i) => i) : [level];
        let next = doc;
        let reports = {};
        let usable = false;
        let anyFree = false;
        let rooms0 = 0;
        for (const i of indexes) {
          const view = levelPlan(next, i);
          const rooms = getRooms(i);
          rooms0 += rooms.length;
          const free = rooms.filter((room) => !isRoomLocked(view, room));
          if (free.length) anyFree = true;
          if (!free.some((room) => RECIPES[getRoomType(view, room)])) continue;
          usable = true;
          const result = generateHome(view, seed, style, { rooms });
          if (i === level) reports = result.reports;
          next = withLevelPlan(next, i, result.plan);
        }
        if (rooms0 && !anyFree) return { ok: false, reason: 'locked', reports: {}, seed, style };
        if (!usable) return { ok: false, reason: 'no-room', reports: {}, seed, style };
        const unchanged = indexes.every((i) => sameFurniture(levelPlan(next, i).furniture, levelPlan(doc, i).furniture)) && next.style.seed === doc.style.seed && next.style.preset === doc.style.preset;
        if (!unchanged) applyDoc(next, 'generate');
        return { ok: true, unchanged, reports, seed: next.style.seed, style: next.style.preset };
      },

      /** Régénère le mobilier d'une pièce avec une nouvelle graine (palette du logement). Raison de refus : 'unknown', 'locked', 'no-recipe'. */
      regenerateRoom(id, seed) {
        const room = getRooms().find((r) => r.id === id);
        if (!room) return { ok: false, reason: 'unknown', reports: {} };
        if (isRoomLocked(plan, room)) return { ok: false, reason: 'locked', reports: {} };
        if (!RECIPES[getRoomType(plan, room)]) return { ok: false, reason: 'no-recipe', reports: {} };
        const result = generateHome(plan, seed, plan.style.preset, { rooms: getRooms(), only: [id] });
        const unchanged = sameFurniture(result.plan.furniture, plan.furniture);
        if (!unchanged) apply(result.plan, 'regenerate');
        return { ok: true, unchanged, reports: result.reports, seed };
      },

      /** Verrouille ou déverrouille le mobilier d'une pièce (sans argument `locked`, inverse l'état). Une entrée d'historique. */
      toggleRoomLock(id, locked) {
        const room = getRooms().find((r) => r.id === id);
        if (!room) return false;
        return apply(setRoomLock(plan, room, locked ?? !isRoomLocked(plan, room)), 'lock');
      },

      /** Retire le mobilier de toutes les pièces non verrouillées. Faux s'il n'y a rien à retirer. */
      clearFurniture: () => apply(removeFurniture(plan, getRooms()), 'clearFurniture'),

      /** Change la palette du logement (le mobilier reste en place, seules les couleurs changent). */
      setStyle(preset) {
        if (STYLE_DENSITY[preset] === undefined || plan.style.preset === preset) return false;
        return apply({ ...plan, style: { ...plan.style, preset } }, 'style');
      },

      /**
       * Change le pas de la grille (0,5 ou 0,1 m) pour tout le logement ; murs, ouvertures, pièces et mobilier suivent (convertGridStep). Une entrée d'historique.
       * Renvoie { ok, exact, changed, lost } ou { ok: false, reason, errors }. `lost.furniture` compte aussi le mobilier devenu invalide.
       */
      setGridStep(cellSize) {
        const result = convertGridStep(doc, cellSize);
        if (!result.ok || !result.changed) return result;
        let next = result.doc;
        const before = result.doc.levels.reduce((sum, l) => sum + l.furniture.length, 0);
        next.levels.forEach((_, i) => {
          const view = levelPlan(next, i);
          if (!view.furniture.length) return;
          const fixed = reconcileFurniture(view, detectRooms(view));
          if (fixed !== view) next = withLevelPlan(next, i, fixed);
        });
        const after = next.levels.reduce((sum, l) => sum + l.furniture.length, 0);
        resetSelection();
        applyDoc(next, 'gridStep');
        return { ...result, doc: next, lost: { ...result.lost, furniture: result.lost.furniture + (before - after) } };
      },

      /* ---- Niveaux ---- */

      /** Change de niveau actif (sans historique). La sélection est abandonnée. */
      setLevel(index) {
        if (!Number.isInteger(index) || index < 0 || index >= doc.levels.length || index === level) return false;
        level = index;
        plan = levelPlan(doc, level);
        resetSelection();
        zonesCache = { plan: null, zones: [] };
        publish('level', true);
        return true;
      },

      /** Ajoute un niveau au-dessus des autres et passe dessus. Une entrée d'historique. Faux au-delà de la limite. */
      addLevel() {
        const next = addLevel(doc);
        if (next === doc) return false;
        resetSelection();
        level = next.levels.length - 1;
        return applyDoc(next, 'addLevel');
      },

      /** Supprime un niveau (jamais le dernier) avec son contenu ; les escaliers du niveau du dessous sont retirés. */
      removeLevel(index = level) {
        const next = removeLevel(doc, index);
        if (next === doc) return false;
        resetSelection();
        if (level >= index) level = Math.max(0, level - 1);
        return applyDoc(next, 'removeLevel');
      },

      renameLevel: (index, name) => applyDoc(renameLevel(doc, index, name), 'renameLevel'),

      /* ---- Escaliers (sur le niveau actif, ils montent vers le niveau du dessus) ---- */

      /** Pose un escalier ({ x, y, w, d, dir } en mètres) et le sélectionne. Crée le niveau du dessus s'il manque. Renvoie son identifiant ou null. */
      addStair(spec) {
        if (!checkStair(spec).ok) return null;
        const base = level + 1 >= doc.levels.length ? addLevel(doc) : doc;
        const next = addStair(plan, spec);
        if (next === plan) return null;
        const id = next.stairs[next.stairs.length - 1].id;
        selectedStairId = id;
        return applyStairs(next, 'addStair', base) ? id : null;
      },

      /** Modifie un escalier (position, dimensions, sens). Faux s'il ne tient pas à sa nouvelle place. */
      updateStair(id, patch) {
        const old = (plan.stairs ?? []).find((s) => s.id === id);
        if (!old) return false;
        const merged = { ...old, ...patch };
        if (!checkStair(merged, id).ok) return false;
        return applyStairs(updateStair(plan, id, patch), 'updateStair');
      },

      rotateStair(id) {
        const next = rotateStair(plan, id);
        const moved = next !== plan && (next.stairs ?? []).find((s) => s.id === id);
        if (!moved || !checkStair(moved, id).ok) return false;
        return applyStairs(next, 'updateStair');
      },

      flipStair(id) {
        const next = flipStair(plan, id);
        const moved = next !== plan && (next.stairs ?? []).find((s) => s.id === id);
        if (!moved || !checkStair(moved, id).ok) return false;
        return applyStairs(next, 'updateStair');
      },

      /** Change le style d'un escalier (droit, L, U, colimaçon). Faux s'il ne tient pas à cet endroit. */
      setStairKind(id, kind) {
        const next = setStairKind(plan, id, kind);
        const moved = next !== plan && (next.stairs ?? []).find((s) => s.id === id);
        if (!moved || !checkStair(moved, id).ok) return false;
        return applyStairs(next, 'updateStair');
      },

      /** Dessous d'un escalier : « solid » (rangements) ou « open » (vide). */
      setStairUnder(id, under) {
        const next = setStairUnder(plan, id, under);
        if (next === plan) return false;
        return applyStairs(next, 'updateStair');
      },

      /** Marches d'un escalier : « solid » (rangements), « stringer », « spine » ou « floating » (contre un mur). Faux si impossible. */
      setStairSteps(id, steps) {
        const next = setStairSteps(plan, id, steps);
        if (next === plan) return false;
        return applyStairs(next, 'updateStair');
      },

      /** Garde-corps d'un escalier : none, handrail, wood, metal, cable, flat ou slats (jamais de verre). */
      setStairRail(id, rail) {
        const next = setStairRail(plan, id, rail);
        if (next === plan) return false;
        return applyStairs(next, 'updateStair');
      },

      /** Finition d'un escalier : oak, ash, walnut, black ou concrete. */
      setStairFinish(id, finish) {
        const next = setStairFinish(plan, id, finish);
        if (next === plan) return false;
        return applyStairs(next, 'updateStair');
      },

      removeStair(id) {
        return applyStairs(removeStair(plan, id), 'removeStair');
      },

      /** Sélectionne un escalier du niveau actif, ou null. Sans historique. */
      selectStair(id) {
        const next = id ?? null;
        if (next !== null && !(plan.stairs ?? []).some((s) => s.id === next)) return false;
        if (next === selectedStairId) return false;
        selectedStairId = next;
        publish('selectStair', false);
        return true;
      },

      /* ---- Éclairage (au niveau du document, hors historique) ---- */

      /** Modifie { hour, month, north, latitude, lamps } ; les valeurs invalides sont ignorées. Faux si rien ne change. */
      setLighting(patch) {
        const old = doc.lighting ?? { ...DEFAULT_LIGHTING };
        const next = { ...old };
        const num = (v) => typeof v === 'number' && Number.isFinite(v);
        if (num(patch.hour)) next.hour = clamp(Math.round(patch.hour * 100) / 100, 0, 24);
        if (num(patch.month)) next.month = clamp(Math.round(patch.month), 1, 12);
        if (num(patch.north)) next.north = clamp(Math.round(patch.north), -360, 360);
        if (num(patch.latitude)) next.latitude = clamp(Math.round(patch.latitude * 10) / 10, -66, 66);
        if (LAMP_MODES.includes(patch.lamps)) next.lamps = patch.lamps;
        if (Object.keys(next).every((key) => next[key] === old[key])) return false;
        doc = { ...doc, lighting: next };
        sync();
        publish('lighting', false);
        return true;
      },

      /* ---- Mobilier retouché à la main (la pièce se verrouille : le générateur n'y touche plus) ---- */

      /** Sélectionne un objet (outil Mobilier), ou null. Sans historique. */
      selectItem(id) {
        const next = id ?? null;
        if (next !== null && !plan.furniture.some((item) => item.id === next)) return false;
        if (next === selectedItemId) return false;
        selectedItemId = next;
        publish('selectItem', false);
        return true;
      },

      /** Déplace un objet vers (x, z) en mètres. Renvoie { ok, reasons, changed }. */
      moveFurniture(id, { x, z }) {
        const result = applyFurniture(editFurniture(plan, getRooms(), id, { x, z }), 'moveFurniture');
        if (result.ok && result.id !== id && selectedItemId === id) selectedItemId = result.id;
        return result;
      },

      /** Fait tourner un objet d'un quart de tour (delta en degrés, 90 par défaut = sens horaire). */
      rotateFurniture(id, delta = 90) {
        return applyFurniture(rotateFurniture(plan, getRooms(), id, delta), 'rotateFurniture');
      },

      /** Remplace un objet par un autre modèle du catalogue (même position, même rotation). */
      replaceFurniture(id, defId) {
        const result = applyFurniture(editFurniture(plan, getRooms(), id, { defId }), 'replaceFurniture');
        if (result.ok && result.id !== id && selectedItemId === id) selectedItemId = result.id;
        return result;
      },

      /** « Autre aspect » : nouvelle graine des variations (couleurs, pieds, coussins) du même objet. */
      rerollFurniture(id) {
        const item = plan.furniture.find((o) => o.id === id);
        if (!item) return { ok: false, reasons: ['unknown'], plan, id: null };
        return applyFurniture(editFurniture(plan, getRooms(), id, { seed: hash(item.variant?.seed ?? 1, 'aspect') }), 'rerollFurniture');
      },

      /** Ajoute un objet du catalogue ({ defId, x, z, rotationY? }) et le sélectionne. Renvoie { ok, reasons, id }. */
      addFurniture(spec) {
        const result = applyFurniture(addFurnitureItem(plan, getRooms(), spec), 'addFurniture');
        if (result.ok) {
          selectedItemId = result.id;
          pendingItem = null;
          publish('selectItem', false);
        }
        return result;
      },

      /** Copie un objet à côté de lui. */
      duplicateFurniture(id) {
        const result = applyFurniture(duplicateFurniture(plan, getRooms(), id), 'addFurniture');
        if (result.ok) {
          selectedItemId = result.id;
          publish('selectItem', false);
        }
        return result;
      },

      /** Supprime un objet (les objets posés dessus aussi). */
      deleteFurniture: (id) => applyFurniture(deleteFurnitureItem(plan, getRooms(), id), 'deleteFurniture'),

      /** Objet du catalogue en cours de pose : aperçu sans historique (null pour l'abandonner). */
      setPendingItem(spec) {
        const next = spec ? { defId: spec.defId, x: spec.x ?? null, z: spec.z ?? null, rotationY: spec.rotationY ?? 0 } : null;
        if (JSON.stringify(next) === JSON.stringify(pendingItem)) return false;
        pendingItem = next;
        if (next) selectedItemId = null;
        publish('pendingItem', false);
        return true;
      },

      /** Pose l'objet en attente à l'endroit de l'aperçu. */
      commitPendingItem() {
        if (!pendingItem || pendingItem.x === null) return { ok: false, reasons: ['outside'], id: null };
        return this.addFurniture(pendingItem);
      },

      beginTransaction,
      endTransaction,
      cancelTransaction,

      /** Vide le niveau actif (murs, ouvertures, mobilier, escaliers…). */
      clearLevel: () => applyStairs(clearPlan(plan), 'clear'),

      /** Vide tout le logement : un seul niveau vide, grille, palette et éclairage conservés. */
      clearAll() {
        const empty = clearPlan(levelPlan(doc, 0));
        const next = { ...withLevelPlan(doc, 0, empty), levels: [withLevelPlan(doc, 0, empty).levels[0]] };
        if (doc.levels.length === 1 && next.levels[0] === doc.levels[0]) return false;
        level = 0;
        resetSelection();
        return applyDoc(next, 'clear');
      },

      undo() {
        if (transaction || past.length === 0) return false;
        future.push(doc);
        doc = keepLighting(past.pop(), doc);
        sync();
        publish('undo', true);
        return true;
      },

      redo() {
        if (transaction || future.length === 0) return false;
        past.push(doc);
        doc = keepLighting(future.pop(), doc);
        sync();
        publish('redo', true);
        return true;
      },

      /**
       * Remplace le document après migration et validation complète (readPlan) et repart d'un historique vide.
       * Accepte un document ou un plan à un niveau (versions précédentes). Renvoie { ok, errors, migrated }.
       */
      loadPlan(next) {
        const result = readPlan(next, { furnitureIds: FURNITURE_IDS });
        if (!result.ok) return { ok: false, errors: result.errors, migrated: false };
        past = [];
        future = [];
        transaction = null;
        doc = result.plan;
        level = 0;
        resetSelection();
        sync();
        publish('loadPlan', true);
        return { ok: true, errors: [], migrated: result.migrated };
      },
    },
  };
}

/** L'éclairage est un réglage d'affichage : annuler ou rétablir ne le ramène pas en arrière. */
function keepLighting(target, current) {
  return target.lighting === current.lighting ? target : { ...target, lighting: current.lighting };
}

/* ------------------------------------------------------------------ */
/* Stockage et projets (localStorage, toujours dans un try/catch)     */
/* ------------------------------------------------------------------ */

/**
 * Stockage clé / valeur qui ne lève jamais : localStorage si le navigateur le permet, avec une copie en mémoire qui sert de
 * repli (la liste des projets reste utilisable pendant la session même si rien n'est conservé).
 * - `available` : vrai tant que le stockage répond ; `persisted` : la dernière écriture a bien été enregistrée.
 * @param {() => Storage} [getBacking] fournit le stockage du navigateur (les tests y mettent un faux)
 */
export function createStorage(getBacking = () => window.localStorage) {
  const memory = new Map();
  let backing = null;
  const state = { available: false, persisted: true };
  try {
    backing = getBacking();
    backing.setItem('maison3d.test', '1');
    backing.removeItem('maison3d.test');
    state.available = true;
  } catch {
    backing = null;
  }
  const fail = () => {
    state.persisted = false;
  };
  return {
    get available() {
      return state.available;
    },
    get persisted() {
      return state.available && state.persisted;
    },
    get(key) {
      if (state.available) {
        try {
          const value = backing.getItem(key);
          if (value !== null) return value;
        } catch {
          state.available = false;
        }
      }
      return memory.get(key) ?? null;
    },
    /** Enregistre ; renvoie faux si le navigateur a refusé (la valeur reste en mémoire). */
    set(key, value) {
      memory.set(key, value);
      if (!state.available) return false;
      try {
        backing.setItem(key, value);
        state.persisted = true;
        return true;
      } catch {
        fail();
        return false;
      }
    },
    remove(key) {
      memory.delete(key);
      if (!state.available) return;
      try {
        backing.removeItem(key);
      } catch {
        fail();
      }
    },
  };
}

const cleanName = (name) => String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, PROJECT_NAME_MAX);

/**
 * Liste de projets : chaque projet est un plan JSON enregistré sous « maison3d.project.<id> » ; l'index
 * (« maison3d.projects ») garde les noms, les dates et le projet actif. Un plan enregistré avant les projets
 * (clé « maison3d.plan ») devient le projet « Mon logement ».
 * @param {ReturnType<typeof createStorage>} storage
 * @param {{ now?: () => number, random?: () => number }} [options]
 */
export function createProjects(storage, { now = () => Date.now(), random = Math.random } = {}) {
  /** @type {{ activeId: string | null, projects: { id: string, name: string, createdAt: number, updatedAt: number }[] }} */
  let index = { activeId: null, projects: [] };

  const readIndex = () => {
    try {
      const data = JSON.parse(storage.get(PROJECTS_KEY) ?? 'null');
      if (data && Array.isArray(data.projects)) {
        const projects = data.projects
          .filter((p) => p && typeof p.id === 'string' && /^[a-z0-9]+$/i.test(p.id) && typeof p.name === 'string')
          .map((p) => ({ id: p.id, name: cleanName(p.name) || 'Projet', createdAt: Number(p.createdAt) || 0, updatedAt: Number(p.updatedAt) || 0 }));
        return { activeId: projects.some((p) => p.id === data.activeId) ? data.activeId : projects[0]?.id ?? null, projects };
      }
    } catch {
      /* index illisible : on repart d'une liste vide, les plans eux-mêmes ne sont pas touchés */
    }
    return null;
  };
  const writeIndex = () => storage.set(PROJECTS_KEY, JSON.stringify(index));
  const find = (id) => index.projects.find((p) => p.id === id) ?? null;
  const newId = () => {
    let id;
    do id = `p${now().toString(36)}${Math.floor(random() * 36 ** 3).toString(36)}`;
    while (find(id));
    return id;
  };
  const uniqueName = (base) => {
    const names = new Set(index.projects.map((p) => p.name));
    if (!names.has(base)) return base;
    for (let n = 2; ; n++) if (!names.has(`${base} ${n}`)) return `${base} ${n}`;
  };
  const add = (name, plan) => {
    const t = now();
    const project = { id: newId(), name: uniqueName(cleanName(name) || 'Nouveau projet'), createdAt: t, updatedAt: t };
    index.projects.push(project);
    if (plan) storage.set(PROJECT_KEY_PREFIX + project.id, JSON.stringify(plan));
    writeIndex();
    return project;
  };

  return {
    /** Les projets, du plus récemment modifié au plus ancien. */
    list: () => index.projects.slice().sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name)),
    get: (id) => find(id),
    activeId: () => index.activeId,
    active: () => find(index.activeId),
    isPersistent: () => storage.persisted,
    isAvailable: () => storage.available,

    /**
     * Relit l'index et le projet actif.
     * @returns {{ project: object | null, plan: object | null, status: 'restored' | 'empty' | 'invalid' | 'unavailable', errors: string[] }}
     */
    load() {
      const stored = readIndex();
      if (stored) {
        index = stored;
        const project = find(index.activeId);
        if (!project) return { project: null, plan: null, status: storage.available ? 'empty' : 'unavailable', errors: [] };
        const result = this.readPlan(project.id);
        return result.ok ? { project, plan: result.plan, status: 'restored', errors: [] } : { project, plan: null, status: 'invalid', errors: result.errors };
      }
      // Première ouverture avec projets : un ancien plan unique devient le premier projet.
      const legacy = storage.get(STORAGE_KEY);
      if (legacy) {
        let parsed = null;
        try {
          parsed = JSON.parse(legacy);
        } catch {
          parsed = null;
        }
        const result = parsed ? readPlan(parsed, { furnitureIds: FURNITURE_IDS }) : { ok: false, errors: ['Ancien plan illisible.'] };
        if (result.ok) {
          const project = add('Mon logement', result.plan);
          index.activeId = project.id;
          writeIndex();
          return { project, plan: result.plan, status: 'restored', errors: [] };
        }
        return { project: null, plan: null, status: 'invalid', errors: result.errors };
      }
      return { project: null, plan: null, status: storage.available ? 'empty' : 'unavailable', errors: [] };
    },

    /** Plan d'un projet, migré et validé : { ok, plan } ou { ok: false, errors }. */
    readPlan(id) {
      const raw = storage.get(PROJECT_KEY_PREFIX + id);
      if (raw === null) return { ok: false, errors: ['Ce projet n\'a pas de plan enregistré.'] };
      try {
        return readPlan(JSON.parse(raw), { furnitureIds: FURNITURE_IDS });
      } catch {
        return { ok: false, errors: ['Le plan enregistré de ce projet est illisible.'] };
      }
    },

    /** Crée un projet (avec un plan facultatif). Ne le rend pas actif. */
    create: (name, plan = createEmptyDocument()) => add(name, plan),

    /** Enregistre le plan d'un projet et met à jour sa date. Renvoie faux si le navigateur a refusé l'écriture. */
    savePlan(id, plan) {
      const project = find(id);
      if (!project) return false;
      const ok = storage.set(PROJECT_KEY_PREFIX + id, JSON.stringify(plan));
      project.updatedAt = now();
      writeIndex();
      return ok;
    },

    /** Renomme (nom vide ou inconnu : refusé). */
    rename(id, name) {
      const project = find(id);
      const clean = cleanName(name);
      if (!project || !clean || clean === project.name) return false;
      project.name = clean;
      writeIndex();
      return true;
    },

    /** Copie un projet sous un nouveau nom (« … (copie) »). Renvoie le nouveau projet, ou null. */
    duplicate(id) {
      const project = find(id);
      const raw = project && storage.get(PROJECT_KEY_PREFIX + id);
      if (!project || raw === null) return null;
      const copy = add(`${project.name} (copie)`, null);
      storage.set(PROJECT_KEY_PREFIX + copy.id, raw);
      return copy;
    },

    /** Supprime un projet et son plan. Si c'était le projet actif, il n'y a plus de projet actif (à choisir par l'appelant). */
    remove(id) {
      const project = find(id);
      if (!project) return false;
      index.projects = index.projects.filter((p) => p !== project);
      storage.remove(PROJECT_KEY_PREFIX + id);
      if (index.activeId === id) index.activeId = null;
      writeIndex();
      return true;
    },

    setActive(id) {
      if (!find(id)) return false;
      index.activeId = id;
      writeIndex();
      return true;
    },
  };
}

/**
 * Enregistre le document courant dans le projet actif 500 ms après le dernier changement, et à la fermeture de la page.
 * Un plan que l'on vient d'ouvrir (déjà enregistré) n'est pas réécrit : `rebase(plan)` le déclare enregistré.
 * @param {ReturnType<typeof createStore>} store
 * @param {ReturnType<typeof createProjects>} projects
 * @param {(status: { state: 'pending' | 'saved' | 'unavailable', at?: Date }) => void} onStatus
 */
export function autosave(store, projects, onStatus, { delay = 500 } = {}) {
  let timer = 0;
  let lastSaved = store.getState().doc;

  function save() {
    timer = 0;
    const { doc } = store.getState();
    const id = projects.activeId();
    if (doc === lastSaved || !id) return;
    lastSaved = doc;
    onStatus(projects.savePlan(id, doc) ? { state: 'saved', at: new Date() } : { state: 'unavailable' });
  }

  function flush() {
    if (!timer) return;
    clearTimeout(timer);
    save();
  }

  const unsubscribe = store.subscribeUi(() => {
    if (store.getState().doc === lastSaved) return;
    clearTimeout(timer);
    timer = setTimeout(save, delay);
    onStatus({ state: 'pending' });
  });
  const onHidden = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  const hasPage = typeof window !== 'undefined' && typeof document !== 'undefined'; // absent dans les tests Node
  if (hasPage) {
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHidden);
  }

  return {
    flush,
    /** Déclare `doc` comme déjà enregistré (ouverture d'un projet). */
    rebase(doc) {
      clearTimeout(timer);
      timer = 0;
      lastSaved = doc;
    },
    dispose() {
      unsubscribe();
      clearTimeout(timer);
      if (hasPage) {
        window.removeEventListener('pagehide', flush);
        document.removeEventListener('visibilitychange', onHidden);
      }
    },
  };
}
