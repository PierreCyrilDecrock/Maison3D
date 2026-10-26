// furniture.js — catalogue d'objets construits procéduralement, piloté par les données.
// Ce fichier n'importe PAS Three.js : les données (identifiant, taille, placement, types de pièces compatibles,
// palettes) se lisent donc partout, y compris dans le générateur pur (generator.js) et dans les tests Node.
// Seules les fonctions `build(ctx)` ont besoin de Three.js, et elles le reçoivent par le contexte :
//   ctx = { rng, palette, THREE, RoundedBoxGeometry }   (voir createBuildContext)
// Convention de chaque objet : l'avant est +Z dans le repère local, l'origine est au centre de l'empreinte au sol,
// le bas de l'objet est à y = 0 (pour un objet mural ou suspendu, `placement.mountHeight` donne la hauteur du bas
// au-dessus du sol ; un luminaire de plafond se place sous le plafond). Unités : mètres.
// Les parties qui fixent la boîte englobante sont déterministes ; le hasard ne touche que les couleurs, les pieds,
// les coussins, etc. à l'intérieur de cette boîte, donc la taille annoncée reste vraie quelle que soit la graine.
import { ROOM_TYPES } from './core.js';
import { RUGS, SURFACE_DECOR, TABLE_DECOR, cabinet, diningChair, frameRect, makeKit, place, rt, withModels } from './furniture-kit.js';
import { HOME_BUILDERS, HOME_DATA } from './furniture-home.js';
import { GARAGE_BUILDERS, GARAGE_DATA } from './furniture-garage.js';
import { ALT_MODELS } from './furniture-models.js';

/* ------------------------------------------------------------------ */
/* Données                                                            */
/* ------------------------------------------------------------------ */

/** Catégories d'objets, dans l'ordre du catalogue. */
export const FURNITURE_CATEGORIES = Object.freeze([
  { id: 'salon', label: 'Salon' },
  { id: 'salle-a-manger', label: 'Salle à manger' },
  { id: 'cuisine', label: 'Cuisine' },
  { id: 'chambre', label: 'Chambre' },
  { id: 'enfant', label: 'Chambre d\'enfant' },
  { id: 'salle-de-bain', label: 'Salle de bain · WC' },
  { id: 'bureau', label: 'Bureau' },
  { id: 'entree', label: 'Entrée' },
  { id: 'buanderie', label: 'Buanderie · Cellier' },
  { id: 'garage', label: 'Garage · Atelier' },
  { id: 'eclairage', label: 'Éclairage · Chauffage' },
  { id: 'decoration', label: 'Décoration' },
]);

/**
 * Modes de placement : wall (dos contre un mur), corner (dans un angle), free (n'importe où dans la pièce),
 * wall-mounted (fixé au mur, à `mountHeight`), window (devant une fenêtre), ceiling (suspendu au plafond).
 */
export const PLACEMENT_MODES = Object.freeze(['wall', 'corner', 'free', 'wall-mounted', 'window', 'ceiling']);

/** Libellé court du mode de placement, pour le catalogue. */
export const PLACEMENT_LABELS = Object.freeze({
  wall: 'Contre un mur',
  corner: 'Dans un angle',
  free: 'Libre',
  'wall-mounted': 'Fixé au mur',
  window: 'Devant une fenêtre',
  ceiling: 'Au plafond',
});

/** Rôles de couleur d'une palette. */
export const PALETTE_ROLES = Object.freeze([
  'wall', // murs
  'floor', // sol
  'wood', // bois clair
  'woodDark', // bois foncé
  'fabric', // tissu principal
  'fabricLight', // tissu clair
  'accent', // couleur d'accent
  'metal', // métal
  'plant', // feuillage
  'ceramic', // faïence et électroménager blanc
]);

/**
 * Palettes de style. `floorKind` décrit le matériau du sol (utilisé plus tard par le générateur).
 * @typedef {{ id: string, label: string, floorKind: string, wall: string, floor: string, wood: string, woodDark: string,
 *   fabric: string, fabricLight: string, accent: string, metal: string, plant: string, ceramic: string }} Palette
 * @type {Readonly<Palette[]>}
 */
export const PALETTES = Object.freeze([
  {
    id: 'scandinave', label: 'Scandinave', floorKind: 'Parquet chêne clair',
    wall: '#f2f0ec', floor: '#d9bc90', wood: '#d8b98a', woodDark: '#a98259', fabric: '#c9cfd2', fabricLight: '#f1efe9',
    accent: '#8fb2a7', metal: '#b9bec2', plant: '#5a9158', ceramic: '#f6f6f3',
  },
  {
    id: 'moderne', label: 'Moderne', floorKind: 'Carrelage gris',
    wall: '#e6e7ea', floor: '#8e9196', wood: '#6e4d38', woodDark: '#3b2a20', fabric: '#3f4852', fabricLight: '#b9c0c8',
    accent: '#d9603c', metal: '#2c2e33', plant: '#3f7d4b', ceramic: '#fafafa',
  },
  {
    id: 'industriel', label: 'Industriel', floorKind: 'Béton ciré',
    wall: '#b8b2a8', floor: '#65625e', wood: '#8f6c47', woodDark: '#4a3524', fabric: '#6d4e3b', fabricLight: '#9ba1a7',
    accent: '#c9a24a', metal: '#303338', plant: '#4c6e3e', ceramic: '#e8e8e5',
  },
  {
    id: 'classique', label: 'Classique', floorKind: 'Parquet foncé',
    wall: '#eadcc3', floor: '#7b5333', wood: '#80502c', woodDark: '#4e2d17', fabric: '#7a2e3b', fabricLight: '#d9caa8',
    accent: '#b18f3d', metal: '#b18f3d', plant: '#3f6c3b', ceramic: '#f5f0e6',
  },
  {
    id: 'boheme', label: 'Bohème', floorKind: 'Bois chaud',
    wall: '#f0e1cf', floor: '#b98b5f', wood: '#b27c4b', woodDark: '#7b4c2b', fabric: '#c96a3e', fabricLight: '#efd9b5',
    accent: '#3f807a', metal: '#b78a40', plant: '#5f9d47', ceramic: '#f7f1e7',
  },
]);

const UNDER_RUG = ['sofa-2', 'sofa-3', 'sofa-corner', 'sofa-bed', 'armchair', 'coffee-table', 'bed-double', 'bed-single', 'bed-king', 'bunk-bed', 'dining-table-4', 'dining-table-6', 'dining-table-round', 'kitchen-table-2', 'desk', 'desk-large', 'office-chair', 'pouf', 'chair', 'bed-bench'];

/** Hauteur du plateau quand elle diffère de la hauteur totale (tables livrées avec leurs chaises) : sert aux objets posés dessus. */
const SURFACE = { 'dining-table-4': 0.75, 'dining-table-6': 0.75, 'dining-table-round': 0.75, 'kitchen-table-2': 0.75 };

/**
 * Données du catalogue : lisibles sans Three.js. Chaque entrée : { id, label, category, roomTypes, size, placement }.
 * `size` = { w (x), d (z), h (y) } en mètres. `canOverlap` : ids d'objets autorisés dessus ou dessous (tapis,
 * lampe posée sur une commode…). `clearanceFront` / `clearanceSides` : espace libre à garder, en mètres.
 */
const BASE_DATA = [
  // Salon
  { id: 'sofa-2', label: 'Canapé 2 places', category: 'salon', roomTypes: [rt('living', 3), rt('office', 0.2)], size: { w: 1.6, d: 0.9, h: 0.85 }, placement: place('wall', 0.8, 0.1, RUGS) },
  { id: 'sofa-3', label: 'Canapé 3 places', category: 'salon', roomTypes: [rt('living', 3)], size: { w: 2.2, d: 0.9, h: 0.85 }, placement: place('wall', 0.8, 0.1, RUGS) },
  { id: 'armchair', label: 'Fauteuil', category: 'salon', roomTypes: [rt('living', 2), rt('bedroom', 0.5), rt('office', 0.5), rt('other', 0.5)], size: { w: 0.8, d: 0.85, h: 0.85 }, placement: place('free', 0.6, 0.1, RUGS) },
  { id: 'coffee-table', label: 'Table basse', category: 'salon', roomTypes: [rt('living', 3)], size: { w: 1.0, d: 0.55, h: 0.4 }, placement: place('free', 0.4, 0.4, [...RUGS, 'table-lamp', 'plant-small']) },
  { id: 'tv-unit', label: 'Meuble TV', category: 'salon', roomTypes: [rt('living', 3), rt('bedroom', 0.5)], size: { w: 1.6, d: 0.4, h: 1.0 }, placement: place('wall', 1.5, 0.1) },
  { id: 'bookcase', label: 'Bibliothèque', category: 'salon', roomTypes: [rt('living', 2), rt('office', 2), rt('hallway', 0.5), rt('bedroom', 0.3), rt('other', 0.5)], size: { w: 0.9, d: 0.32, h: 1.9 }, placement: place('wall', 0.6, 0.05) },
  { id: 'console', label: 'Console', category: 'salon', roomTypes: [rt('living', 1), rt('entrance', 3), rt('hallway', 2), rt('dining', 0.5)], size: { w: 1.1, d: 0.35, h: 0.8 }, placement: place('wall', 0.5, 0.05, SURFACE_DECOR) },
  { id: 'floor-lamp', label: 'Lampadaire', category: 'salon', roomTypes: [rt('living', 2), rt('bedroom', 1), rt('office', 1), rt('hallway', 0.5), rt('other', 1)], size: { w: 0.4, d: 0.4, h: 1.6 }, placement: place('corner', 0.1, 0.1) },
  // Salle à manger
  { id: 'dining-table-4', label: 'Table + 4 chaises', category: 'salle-a-manger', roomTypes: [rt('dining', 3), rt('living', 0.5), rt('kitchen', 0.8)], size: { w: 1.4, d: 1.5, h: 0.9 }, placement: place('free', 0.3, 0.3, RUGS) },
  { id: 'dining-table-6', label: 'Table + 6 chaises', category: 'salle-a-manger', roomTypes: [rt('dining', 2), rt('living', 0.3)], size: { w: 2.5, d: 1.5, h: 0.9 }, placement: place('free', 0.3, 0.3, RUGS) },
  { id: 'buffet', label: 'Buffet', category: 'salle-a-manger', roomTypes: [rt('dining', 2), rt('living', 0.5), rt('kitchen', 0.3)], size: { w: 1.6, d: 0.45, h: 0.85 }, placement: place('wall', 0.7, 0.05, SURFACE_DECOR) },
  // Cuisine
  { id: 'kitchen-base', label: 'Meuble bas', category: 'cuisine', roomTypes: [rt('kitchen', 4)], size: { w: 0.6, d: 0.6, h: 0.9 }, placement: place('wall', 0.9, 0) },
  { id: 'kitchen-sink', label: 'Évier', category: 'cuisine', roomTypes: [rt('kitchen', 3)], size: { w: 1.2, d: 0.6, h: 1.1 }, placement: place('wall', 0.9, 0) },
  { id: 'kitchen-hob', label: 'Plaque de cuisson', category: 'cuisine', roomTypes: [rt('kitchen', 3)], size: { w: 0.6, d: 0.6, h: 0.91 }, placement: place('wall', 0.9, 0) },
  { id: 'fridge', label: 'Réfrigérateur', category: 'cuisine', roomTypes: [rt('kitchen', 3)], size: { w: 0.6, d: 0.65, h: 1.85 }, placement: place('wall', 0.9, 0) },
  { id: 'hood', label: 'Hotte', category: 'cuisine', roomTypes: [rt('kitchen', 2)], size: { w: 0.6, d: 0.45, h: 0.65 }, placement: place('wall-mounted', 0, 0, [], { mountHeight: 1.55 }) },
  { id: 'kitchen-island', label: 'Îlot', category: 'cuisine', roomTypes: [rt('kitchen', 1)], size: { w: 1.6, d: 0.9, h: 0.9 }, placement: place('free', 0.9, 0.9) },
  { id: 'bar-stool', label: 'Tabouret', category: 'cuisine', roomTypes: [rt('kitchen', 1), rt('dining', 0.3)], size: { w: 0.35, d: 0.35, h: 0.65 }, placement: place('free', 0.2, 0.1) },
  { id: 'kitchen-wall', label: 'Meuble haut', category: 'cuisine', roomTypes: [rt('kitchen', 3)], size: { w: 0.6, d: 0.35, h: 0.7 }, placement: place('wall-mounted', 0, 0, [], { mountHeight: 1.4 }) },
  // Chambre
  { id: 'bed-double', label: 'Lit double', category: 'chambre', roomTypes: [rt('bedroom', 3)], size: { w: 1.7, d: 2.1, h: 1.0 }, placement: place('wall', 0.7, 0.55, [...RUGS]) },
  { id: 'bed-single', label: 'Lit simple', category: 'chambre', roomTypes: [rt('bedroom', 1)], size: { w: 0.95, d: 2.1, h: 0.9 }, placement: place('wall', 0.6, 0.5, [...RUGS]) },
  { id: 'nightstand', label: 'Table de chevet', category: 'chambre', roomTypes: [rt('bedroom', 3)], size: { w: 0.45, d: 0.4, h: 0.5 }, placement: place('wall', 0.3, 0.05, SURFACE_DECOR) },
  { id: 'wardrobe', label: 'Armoire', category: 'chambre', roomTypes: [rt('bedroom', 3), rt('hallway', 0.5), rt('entrance', 0.5)], size: { w: 1.2, d: 0.6, h: 2.1 }, placement: place('wall', 0.8, 0.05) },
  { id: 'dresser', label: 'Commode', category: 'chambre', roomTypes: [rt('bedroom', 2), rt('hallway', 0.5), rt('living', 0.3)], size: { w: 1.2, d: 0.45, h: 0.85 }, placement: place('wall', 0.7, 0.05, SURFACE_DECOR) },
  { id: 'desk', label: 'Bureau', category: 'bureau', roomTypes: [rt('office', 4), rt('bedroom', 1), rt('living', 0.3)], size: { w: 1.2, d: 0.6, h: 0.75 }, placement: place('wall', 0.9, 0.1, ['office-chair', 'table-lamp', 'plant-small']) },
  // Salle de bain · WC
  { id: 'bathtub', label: 'Baignoire', category: 'salle-de-bain', roomTypes: [rt('bathroom', 3)], size: { w: 1.7, d: 0.75, h: 0.65 }, placement: place('corner', 0.6, 0.05) },
  { id: 'shower', label: 'Douche', category: 'salle-de-bain', roomTypes: [rt('bathroom', 3)], size: { w: 0.9, d: 0.9, h: 2.0 }, placement: place('corner', 0.6, 0) },
  { id: 'vanity', label: 'Meuble vasque + miroir', category: 'salle-de-bain', roomTypes: [rt('bathroom', 4)], size: { w: 0.8, d: 0.5, h: 1.9 }, placement: place('wall', 0.7, 0.05) },
  { id: 'toilet', label: 'Toilettes', category: 'salle-de-bain', roomTypes: [rt('bathroom', 2), rt('toilet', 4)], size: { w: 0.4, d: 0.7, h: 0.8 }, placement: place('wall', 0.6, 0.2) },
  { id: 'handbasin', label: 'Lave-mains', category: 'salle-de-bain', roomTypes: [rt('toilet', 3)], size: { w: 0.4, d: 0.3, h: 0.85 }, placement: place('wall', 0.5, 0.1) },
  // Bureau
  { id: 'office-chair', label: 'Chaise de bureau', category: 'bureau', roomTypes: [rt('office', 4), rt('bedroom', 0.5)], size: { w: 0.6, d: 0.6, h: 1.0 }, placement: place('free', 0.1, 0.1, []) },
  { id: 'shelf-unit', label: 'Étagère', category: 'bureau', roomTypes: [rt('office', 2), rt('laundry', 3), rt('hallway', 0.5), rt('other', 1)], size: { w: 0.8, d: 0.35, h: 1.8 }, placement: place('wall', 0.6, 0.05) },
  // Entrée
  { id: 'mirror', label: 'Miroir', category: 'entree', roomTypes: [rt('entrance', 3), rt('hallway', 1.5)], size: { w: 0.6, d: 0.03, h: 1.2 }, placement: place('wall-mounted', 0, 0, [], { mountHeight: 0.7 }) },
  { id: 'bench', label: 'Banc', category: 'entree', roomTypes: [rt('entrance', 3), rt('hallway', 1)], size: { w: 1.0, d: 0.35, h: 0.45 }, placement: place('wall', 0.5, 0.05) },
  { id: 'coat-rack', label: 'Porte-manteau', category: 'entree', roomTypes: [rt('entrance', 3)], size: { w: 0.5, d: 0.5, h: 1.75 }, placement: place('corner', 0.3, 0.1) },
  // Buanderie
  { id: 'washer', label: 'Lave-linge', category: 'buanderie', roomTypes: [rt('laundry', 4), rt('kitchen', 0.3)], size: { w: 0.6, d: 0.6, h: 0.85 }, placement: place('wall', 0.7, 0) },
  // Décoration
  { id: 'rug-s', label: 'Tapis petit', category: 'decoration', roomTypes: [rt('entrance', 1), rt('bedroom', 1), rt('bathroom', 0.5), rt('hallway', 1)], size: { w: 1.2, d: 0.8, h: 0.02 }, placement: place('free', 0, 0, UNDER_RUG) },
  { id: 'rug-m', label: 'Tapis moyen', category: 'decoration', roomTypes: [rt('living', 2), rt('bedroom', 2), rt('office', 1), rt('dining', 1)], size: { w: 2.0, d: 1.4, h: 0.02 }, placement: place('free', 0, 0, UNDER_RUG) },
  { id: 'rug-l', label: 'Tapis grand', category: 'decoration', roomTypes: [rt('living', 3), rt('bedroom', 2), rt('dining', 2)], size: { w: 2.8, d: 2.0, h: 0.02 }, placement: place('free', 0, 0, UNDER_RUG) },
  { id: 'plant-small', label: 'Plante en pot', category: 'decoration', roomTypes: [rt('living', 2), rt('kitchen', 1), rt('office', 2), rt('bathroom', 1.5), rt('entrance', 1), rt('bedroom', 1), rt('other', 1), rt('toilet', 0.5), rt('dining', 1), rt('laundry', 0.3)], size: { w: 0.3, d: 0.3, h: 0.45 }, placement: place('free', 0.1, 0.1) },
  { id: 'plant-medium', label: 'Plante d\'intérieur', category: 'decoration', roomTypes: [rt('living', 2), rt('dining', 1), rt('entrance', 1), rt('hallway', 1), rt('other', 1.5), rt('bedroom', 1), rt('office', 1)], size: { w: 0.5, d: 0.5, h: 1.0 }, placement: place('corner', 0.2, 0.1) },
  { id: 'plant-tall', label: 'Grande plante', category: 'decoration', roomTypes: [rt('living', 2), rt('entrance', 1), rt('other', 1), rt('hallway', 1), rt('dining', 1)], size: { w: 0.6, d: 0.6, h: 1.6 }, placement: place('corner', 0.2, 0.1) },
  { id: 'frame-small', label: 'Cadre mural', category: 'decoration', roomTypes: [rt('living', 3), rt('bedroom', 3), rt('dining', 2), rt('entrance', 2), rt('hallway', 3), rt('office', 2), rt('other', 2), rt('kitchen', 0.5)], size: { w: 0.4, d: 0.03, h: 0.5 }, placement: place('wall-mounted', 0, 0, [], { mountHeight: 1.3 }) },
  { id: 'frame-large', label: 'Grand cadre mural', category: 'decoration', roomTypes: [rt('living', 3), rt('bedroom', 2), rt('dining', 2), rt('hallway', 1), rt('office', 1), rt('other', 1)], size: { w: 0.9, d: 0.04, h: 0.6 }, placement: place('wall-mounted', 0, 0, [], { mountHeight: 1.2 }) },
  { id: 'ceiling-light', label: 'Luminaire de plafond', category: 'decoration', roomTypes: ROOM_TYPES.map((type) => rt(type, 3)), size: { w: 0.4, d: 0.4, h: 0.45 }, placement: place('ceiling', 0, 0) },
  { id: 'curtains', label: 'Rideaux', category: 'decoration', roomTypes: [rt('living', 3), rt('bedroom', 3), rt('dining', 1), rt('office', 1.5), rt('other', 1)], size: { w: 1.6, d: 0.15, h: 2.3 }, placement: place('window', 0, 0) },
  { id: 'table-lamp', label: 'Lampe de table', category: 'decoration', roomTypes: [rt('living', 2), rt('bedroom', 3), rt('office', 2), rt('entrance', 1), rt('hallway', 0.5), rt('other', 0.5)], size: { w: 0.25, d: 0.25, h: 0.45 }, placement: place('free', 0, 0) },
];

/** Types de pièces ajoutés aux objets d'origine (nouvelles pièces : chambre d'enfant, dressing, cellier, atelier, garage). */
const MORE_ROOMS = {
  'sofa-2': [rt('other', 0.5)],
  armchair: [rt('kidsroom', 0.3), rt('dressing', 0.2)],
  bookcase: [rt('kidsroom', 1), rt('workshop', 0.3)],
  console: [rt('dressing', 0.3)],
  'floor-lamp': [rt('kidsroom', 0.5), rt('dressing', 0.3)],
  nightstand: [rt('kidsroom', 1)],
  wardrobe: [rt('kidsroom', 2), rt('dressing', 2), rt('pantry', 0.2)],
  dresser: [rt('kidsroom', 1), rt('dressing', 2)],
  desk: [rt('kidsroom', 0.3), rt('workshop', 0.5)],
  'office-chair': [rt('kidsroom', 1), rt('workshop', 0.5)],
  'shelf-unit': [rt('kidsroom', 0.5), rt('pantry', 3), rt('garage', 1.5), rt('workshop', 2), rt('dressing', 0.5)],
  mirror: [rt('dressing', 1)],
  bench: [rt('dressing', 1.5), rt('kidsroom', 0.3)],
  washer: [rt('garage', 0.4), rt('pantry', 0.3)],
  'bed-single': [rt('kidsroom', 3)],
  'rug-s': [rt('kidsroom', 1), rt('dressing', 1)],
  'rug-m': [rt('kidsroom', 2), rt('dressing', 0.5)],
  'rug-l': [rt('kidsroom', 0.5)],
  'plant-small': [rt('kidsroom', 0.6), rt('dressing', 0.3), rt('pantry', 0.2)],
  'plant-medium': [rt('kidsroom', 0.5)],
  'frame-small': [rt('kidsroom', 2), rt('dressing', 1), rt('workshop', 0.5), rt('garage', 0.3)],
  'frame-large': [rt('kidsroom', 1), rt('dressing', 0.5)],
  curtains: [rt('kidsroom', 3), rt('dressing', 0.6)],
  'table-lamp': [rt('kidsroom', 2), rt('dressing', 1), rt('workshop', 0.5)],
  'bar-stool': [rt('workshop', 0.8), rt('garage', 0.3)],
};

/** Petits objets que les meubles d'origine peuvent porter en plus des lampes et des plantes. */
const MORE_OVERLAP = {
  'dining-table-4': TABLE_DECOR,
  'dining-table-6': TABLE_DECOR,
  'coffee-table': ['books', 'vase', 'fruit-bowl', 'candles'],
  console: ['books', 'vase', 'candles'],
  buffet: TABLE_DECOR,
  dresser: ['books', 'vase', 'candles'],
  nightstand: ['books', 'candles'],
  desk: ['computer', 'books', 'candles', 'vase'],
  'kitchen-island': ['fruit-bowl', 'vase'],
  'kitchen-base': ['microwave'],
  bookcase: ['vase', 'books'],
  'tv-unit': [],
};

/**
 * Données du catalogue : lisibles sans Three.js. Chaque entrée : { id, label, category, roomTypes, size, placement }.
 * Les objets d'origine, complétés par MORE_ROOMS et MORE_OVERLAP, puis ceux de furniture-home.js et furniture-garage.js.
 */
export const FURNITURE_DATA = Object.freeze(
  [...BASE_DATA, ...HOME_DATA, ...GARAGE_DATA].map((entry) =>
    Object.freeze({
      ...entry,
      roomTypes: [...entry.roomTypes, ...(MORE_ROOMS[entry.id] ?? [])],
      placement: {
        ...entry.placement,
        ...(MORE_OVERLAP[entry.id]?.length ? { canOverlap: [...new Set([...entry.placement.canOverlap, ...MORE_OVERLAP[entry.id]])] } : {}),
        ...(SURFACE[entry.id] ? { surface: SURFACE[entry.id] } : {}),
      },
    }),
  ),
);

/**
 * Familles d'objets interchangeables (« remplacer par une variante » dans l'éditeur) : même usage, autre taille ou autre modèle.
 * Un objet qui n'est dans aucune famille n'a que son « autre aspect » (nouvelle graine des variations).
 */
export const FURNITURE_FAMILIES = Object.freeze([
  ['sofa-2', 'sofa-3', 'sofa-corner', 'sofa-bed'],
  ['bed-double', 'bed-single', 'bed-king'],
  ['bed-single', 'bunk-bed', 'baby-bed'],
  ['dining-table-4', 'dining-table-6', 'dining-table-round', 'kitchen-table-2'],
  ['wardrobe', 'wardrobe-3', 'open-wardrobe'],
  ['coffee-table', 'side-table', 'pouf'],
  ['desk', 'desk-large', 'kids-desk'],
  ['fridge', 'fridge-american'],
  ['washer', 'dryer', 'dishwasher'],
  ['vanity', 'vanity-double'],
  ['mirror', 'mirror-round', 'standing-mirror'],
  ['ceiling-light', 'pendant-light'],
  ['curtains', 'blinds'],
  ['chair', 'office-chair', 'bar-stool'],
  ['books', 'vase', 'fruit-bowl', 'candles'],
  ['console', 'buffet', 'dresser', 'sideboard', 'sideboard-small', 'chest-drawers'],
  ['bookcase', 'bookcase-narrow', 'shelf-unit', 'shelf-low'],
  ['wall-shelf', 'wc-cabinet'],
  ['car', 'car-large', 'motorbike'],
  ['metal-shelving', 'metal-cabinet', 'shelf-unit'],
  ['workbench', 'tool-trolley'],
  ['freezer-chest', 'wine-rack'],
  ['tube-light', 'ceiling-light'],
  ['frame-small', 'frame-large', 'wall-clock'],
  ['rug-s', 'rug-m', 'rug-l'],
  ['plant-small', 'plant-medium', 'plant-tall'],
  ['frame-small', 'frame-large'],
  ['armchair', 'bench'],
  ['bathtub', 'shower'],
  ['toilet', 'handbasin'],
  ['kitchen-base', 'kitchen-sink', 'kitchen-hob', 'fridge'],
  ['kitchen-wall', 'hood'],
  ['floor-lamp', 'plant-tall'],
  ['desk', 'dining-table-4'],
  ['wardrobe', 'bookcase'],
]);

/** Variantes d'un objet du catalogue : les autres membres de ses familles, sans doublon, dans l'ordre du catalogue. */
export function variantsOf(id) {
  const found = new Set();
  for (const family of FURNITURE_FAMILIES) if (family.includes(id)) for (const other of family) if (other !== id) found.add(other);
  return FURNITURE_DATA.filter((entry) => found.has(entry.id));
}

/** Retrouve les données d'un objet par son identifiant (undefined s'il n'existe pas). */
export function getFurnitureData(id) {
  return FURNITURE_DATA.find((entry) => entry.id === id);
}

/** Objets compatibles avec un type de pièce, du plus au moins probable : [{ id, weight }]. */
export function furnitureForRoomType(type) {
  return FURNITURE_DATA.flatMap((entry) => {
    const match = entry.roomTypes.find((r) => r.type === type);
    return match ? [{ id: entry.id, weight: match.weight }] : [];
  }).sort((a, b) => b.weight - a.weight);
}

/** Palette par identifiant (la première si l'identifiant est inconnu). */
export function getPalette(id) {
  return PALETTES.find((palette) => palette.id === id) ?? PALETTES[0];
}

/* ------------------------------------------------------------------ */
/* Hasard : générateur à graine et mode « sans variations »           */
/* ------------------------------------------------------------------ */

/** Graine entière à partir d'un texte (pour donner à chaque objet la sienne). */
export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < String(text).length; i++) {
    h ^= String(text).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Générateur pseudo-aléatoire reproductible (mulberry32) : next, range, int, pick, chance. */
export function createRng(seed = 1) {
  let s = (Number(seed) >>> 0) || 1;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    neutral: false,
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (p = 0.5) => next() < p,
  };
}

/** « Sans variations » : toujours la valeur centrale, le premier choix, jamais l'option facultative. */
export function createNeutralRng() {
  return {
    neutral: true,
    next: () => 0.5,
    range: (min, max) => (min + max) / 2,
    int: (min, max) => Math.floor((min + max) / 2),
    pick: (items) => items[0],
    chance: () => false,
  };
}

/**
 * Contexte de construction.
 * @param {{ THREE: any, RoundedBoxGeometry: any }} three modules Three.js (le namespace et la géométrie des add-ons)
 * @param {{ palette?: Palette | string, seed?: number, variations?: boolean }} [options]
 */
export function createBuildContext(three, { palette = PALETTES[0], seed = 1, variations = true, model } = {}) {
  const ctx = {
    THREE: three.THREE,
    RoundedBoxGeometry: three.RoundedBoxGeometry,
    palette: typeof palette === 'string' ? getPalette(palette) : palette,
    rng: variations ? createRng(seed) : createNeutralRng(),
  };
  if (model !== undefined) ctx.model = model; // force le modèle d'un objet à plusieurs modèles (tests, catalogue)
  return ctx;
}

/* ------------------------------------------------------------------ */
/* Construction des objets                                            */
/* ------------------------------------------------------------------ */

function sofa({ w, d, seats }) {
  return (ctx) => {
    const k = makeKit(ctx);
    const { rng, palette: p } = ctx;
    const h = 0.85;
    const armW = 0.18;
    const leg = rng.range(0.07, 0.15);
    const fabric = rng.pick([p.fabric, p.fabricLight, p.accent]);
    const soft = k.mix(fabric, '#ffffff', 0.1);
    const legColor = rng.pick([p.woodDark, p.metal]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.05, leg, 0.05, sx * (w / 2 - 0.08), 0, sz * (d / 2 - 0.08), legColor);
    k.rbox(w, 0.28, d, 0.04, 0, leg, 0, fabric);
    k.rbox(w, h - leg, 0.22, 0.05, 0, leg, -d / 2 + 0.11, fabric);
    for (const sx of [-1, 1]) k.rbox(armW, 0.62 - leg, d, 0.05, sx * (w / 2 - armW / 2), leg, 0, fabric);
    const inner = w - 2 * armW;
    const cw = inner / seats;
    const backH = h - leg - 0.43;
    for (let i = 0; i < seats; i++) {
      const x = -inner / 2 + (i + 0.5) * cw;
      k.rbox(cw - 0.02, 0.14, d - 0.25, 0.05, x, leg + 0.28, 0.1, soft);
      k.rbox(cw - 0.04, backH, 0.14, 0.05, x, leg + 0.43, -d / 2 + 0.29, soft);
    }
    const pillows = rng.int(0, Math.min(3, seats + 1));
    for (let i = 0; i < pillows; i++) {
      const side = i % 2 ? 1 : -1;
      const pillow = k.rbox(0.3, 0.26, 0.1, 0.04, side * (inner / 2 - 0.2 - 0.1 * Math.floor(i / 2)), leg + 0.42, -d / 2 + 0.43, rng.pick([p.accent, p.fabricLight, p.fabric]));
      pillow.rotation.x = -0.3;
    }
    return k.root;
  };
}

function coffeeTable(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const legH = rng.range(0.3, 0.37);
  const wood = rng.pick([p.wood, p.woodDark]);
  const legColor = rng.pick([wood, p.metal]);
  k.rbox(1.0, 0.4 - legH, 0.55, 0.012, 0, legH, 0, wood);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(0.022, 0.018, legH, sx * 0.44, 0, sz * 0.22, legColor, undefined, 12);
  if (rng.chance(0.6)) k.box(0.86, 0.02, 0.4, 0, 0.1, 0, rng.pick([p.woodDark, p.fabricLight]));
  return k.root;
}

function tvUnit(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const body = rng.pick([p.wood, p.woodDark, p.fabricLight]);
  cabinet(k, { w: 1.6, d: 0.4, h: 0.45, leg: rng.range(0.08, 0.14), body, front: k.mix(body, '#000000', 0.12), top: body, doors: rng.int(2, 4), handle: p.metal, legColor: p.metal });
  k.box(0.35, 0.02, 0.18, 0, 0.45, 0, '#1c1c1e');
  k.box(1.0, 0.52, 0.035, 0, 0.48, 0, '#111214');
  k.box(0.96, 0.48, 0.005, 0, 0.5, 0.015, '#0c1822', { emissive: '#1a3a52', emissiveIntensity: 0.5, rough: 0.2 });
  return k.root;
}

function bookcase(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const wood = rng.pick([p.wood, p.woodDark, p.fabricLight]);
  for (const sx of [-1, 1]) k.box(0.03, 1.9, 0.32, sx * 0.435, 0, 0, wood);
  k.box(0.9, 0.03, 0.32, 0, 1.87, 0, wood);
  k.box(0.84, 0.08, 0.3, 0, 0, 0, wood);
  k.box(0.84, 1.79, 0.01, 0, 0.08, -0.155, k.mix(wood, '#000000', 0.15));
  const shelves = rng.int(4, 6);
  const gap = (1.87 - 0.08) / shelves;
  const bookColors = [p.accent, p.fabric, p.fabricLight, p.woodDark, p.plant];
  for (let i = 0; i < shelves; i++) {
    const y = 0.08 + i * gap;
    if (i > 0) k.box(0.84, 0.025, 0.3, 0, y, 0, wood);
    if (rng.chance(0.75)) {
      let x = -0.4;
      const books = rng.int(3, 8);
      for (let b = 0; b < books && x < 0.36; b++) {
        const bw = rng.range(0.025, 0.05);
        const bh = rng.range(0.16, Math.min(0.26, gap - 0.04));
        k.box(bw, bh, 0.2, x + bw / 2, y + (i > 0 ? 0.025 : 0), 0.02, rng.pick(bookColors));
        x += bw + 0.004;
      }
    }
  }
  return k.root;
}

function consoleTable(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const wood = rng.pick([p.wood, p.woodDark]);
  const legColor = rng.pick([wood, p.metal]);
  k.box(1.1, 0.03, 0.35, 0, 0.77, 0, wood);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.03, 0.77, 0.03, sx * 0.52, 0, sz * 0.15, legColor);
  k.box(1.04, 0.02, 0.3, 0, 0.2, 0, wood);
  if (rng.chance(0.5)) {
    k.box(0.5, 0.1, 0.012, 0, 0.65, 0.169, k.mix(wood, '#000000', 0.12));
    k.box(0.12, 0.015, 0.02, 0, 0.7, 0.165, p.metal);
  }
  return k.root;
}

function floorLamp(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const shade = rng.pick([p.fabricLight, p.accent, p.wall]);
  k.cyl(0.15, 0.15, 0.03, 0, 0, 0, p.metal, { metal: 0.6, rough: 0.4 });
  k.cyl(0.012, 0.012, 1.4, 0, 0.03, 0, p.metal, { metal: 0.6, rough: 0.4 }, 12);
  k.cyl(0.14, 0.2, 0.25, 0, 1.35, 0, shade, { emissive: shade, emissiveIntensity: 0.35, rough: 0.9 });
  k.ell(0.05, 0.05, 0.05, 0, 1.45, 0, '#fff4d6', { emissive: '#ffd98a', emissiveIntensity: 1 });
  return k.root;
}

function diningTable({ ends }) {
  return (ctx) => {
    const k = makeKit(ctx);
    const { rng, palette: p } = ctx;
    const tableW = ends ? 1.8 : 1.4;
    const tableD = 0.8;
    const wood = rng.pick([p.wood, p.woodDark]);
    const topT = rng.range(0.03, 0.05);
    k.rbox(tableW, topT, tableD, 0.012, 0, 0.75 - topT, 0, wood);
    const legColor = rng.pick([wood, p.metal]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.06, 0.75 - topT, 0.06, sx * (tableW / 2 - 0.08), 0, sz * (tableD / 2 - 0.08), legColor);
    const colors = { leg: rng.pick([p.woodDark, p.metal, wood]), seat: rng.pick([p.fabric, p.fabricLight, p.accent]), back: null };
    colors.back = rng.chance(0.5) ? colors.seat : colors.leg;
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

function buffet(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const body = rng.pick([p.wood, p.woodDark]);
  cabinet(k, { w: 1.6, d: 0.45, h: 0.85, leg: rng.range(0.08, 0.14), body, front: k.mix(body, '#000000', 0.1), doors: rng.int(2, 3), handle: p.metal, legColor: rng.pick([p.woodDark, p.metal]) });
  return k.root;
}

/* ---- Cuisine ---- */

function worktop(k, ctx) {
  const { rng, palette: p } = ctx;
  return rng.pick([p.woodDark, p.ceramic, p.metal]);
}

function kitchenBase(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const body = rng.pick([p.fabricLight, p.wood, p.fabric]);
  const drawers = rng.chance(0.4);
  cabinet(k, { w: 0.6, d: 0.6, h: 0.9, leg: 0.1, plinth: true, legColor: '#2a2a2c', body, front: k.mix(body, '#ffffff', 0.08), top: worktop(k, ctx), topT: 0.04, doors: drawers ? 0 : 1, drawers: drawers ? 3 : 0, handle: p.metal });
  return k.root;
}

function kitchenSink(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const body = rng.pick([p.fabricLight, p.wood, p.fabric]);
  cabinet(k, { w: 1.2, d: 0.6, h: 0.9, leg: 0.1, plinth: true, legColor: '#2a2a2c', body, front: k.mix(body, '#ffffff', 0.08), top: worktop(k, ctx), topT: 0.04, doors: 2, handle: p.metal });
  k.box(0.5, 0.005, 0.38, -0.2, 0.9, 0.02, '#c9ced2', { metal: 0.8, rough: 0.3 });
  k.cyl(0.015, 0.015, 0.2, 0.25, 0.9, -0.22, p.metal, { metal: 0.9, rough: 0.2 }, 12);
  k.box(0.02, 0.02, 0.16, 0.25, 1.08, -0.15, p.metal, { metal: 0.9, rough: 0.2 });
  return k.root;
}

function kitchenHob(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const body = rng.pick([p.fabricLight, p.wood, p.fabric]);
  cabinet(k, { w: 0.6, d: 0.6, h: 0.9, leg: 0.1, plinth: true, legColor: '#2a2a2c', body, front: k.mix(body, '#ffffff', 0.08), top: worktop(k, ctx), topT: 0.04, doors: 1, handle: p.metal });
  k.box(0.56, 0.01, 0.5, 0, 0.9, 0, '#121316', { rough: 0.15 });
  for (const [x, z, r] of [[-0.13, -0.1, 0.06], [0.13, -0.1, 0.05], [-0.13, 0.12, 0.05], [0.13, 0.12, 0.065]]) k.cyl(r, r, 0.002, x, 0.91, z, '#3a3c40', { metal: 0.5 }, 20);
  return k.root;
}

function fridge(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const color = rng.pick([p.ceramic, p.metal, p.fabricLight]);
  k.rbox(0.6, 1.85, 0.65, 0.03, 0, 0, 0, color, { metal: color === p.metal ? 0.6 : 0.1, rough: 0.4 });
  k.box(0.58, 0.012, 0.01, 0, 0.62, 0.32, '#2a2a2c');
  k.box(0.02, 0.3, 0.025, -0.24, 1.15, 0.3, p.metal, { metal: 0.8, rough: 0.3 });
  k.box(0.02, 0.2, 0.025, -0.24, 0.35, 0.3, p.metal, { metal: 0.8, rough: 0.3 });
  return k.root;
}

function hood(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const color = rng.pick([p.metal, p.ceramic, p.woodDark]);
  k.box(0.6, 0.12, 0.45, 0, 0, 0, color, { metal: 0.5, rough: 0.4 });
  k.box(0.2, 0.53, 0.2, 0, 0.12, -0.125, color, { metal: 0.5, rough: 0.4 });
  return k.root;
}

function kitchenIsland(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const body = rng.pick([p.fabric, p.wood, p.fabricLight]);
  k.box(1.5, 0.82, 0.6, 0, 0, -0.1, body);
  k.box(1.6, 0.04, 0.9, 0, 0.86, 0, worktop(k, ctx));
  const front = k.mix(body, '#000000', 0.1);
  for (let i = 0; i < 3; i++) k.box(0.46, 0.7, 0.012, -0.5 + i * 0.5, 0.06, -0.406, front);
  for (const sx of [-1, 1]) k.box(0.04, 0.82, 0.04, sx * 0.7, 0, 0.35, p.metal);
  return k.root;
}

function barStool(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const seat = rng.pick([p.fabric, p.accent, p.woodDark]);
  k.cyl(0.175, 0.175, 0.05, 0, 0.6, 0, seat, undefined, 24);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(0.012, 0.015, 0.6, sx * 0.11, 0, sz * 0.11, p.metal, { metal: 0.7, rough: 0.3 }, 10);
  k.box(0.22, 0.015, 0.015, 0, 0.25, 0.11, p.metal);
  k.box(0.22, 0.015, 0.015, 0, 0.25, -0.11, p.metal);
  return k.root;
}

function kitchenWall(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const body = rng.pick([p.fabricLight, p.wood, p.fabric]);
  cabinet(k, { w: 0.6, d: 0.35, h: 0.7, leg: 0, body, front: k.mix(body, '#ffffff', 0.08), top: body, topT: 0.02, doors: 1, handle: p.metal });
  return k.root;
}

/* ---- Chambre ---- */

function bed({ w, headH, pillowCount }) {
  return (ctx) => {
    const k = makeKit(ctx);
    const { rng, palette: p } = ctx;
    const d = 2.1;
    const leg = rng.range(0.08, 0.14);
    const frame = rng.pick([p.wood, p.woodDark]);
    const head = rng.pick([frame, p.fabric, p.fabricLight]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.05, leg, 0.05, sx * (w / 2 - 0.05), 0, sz * (d / 2 - 0.05), frame);
    k.box(w, 0.2, d, 0, leg, 0, frame);
    k.rbox(w - 0.1, 0.22, 1.96, 0.05, 0, leg + 0.2, 0.03, k.mix(p.fabricLight, '#ffffff', 0.5));
    k.rbox(w, headH, 0.1, 0.03, 0, 0, -d / 2 + 0.05, head);
    const blanket = rng.pick([p.fabric, p.accent, p.fabricLight]);
    k.rbox(w - 0.06, 0.05, 1.2, 0.02, 0, leg + 0.4, 0.42, blanket);
    for (let i = 0; i < pillowCount; i++) {
      const x = pillowCount === 1 ? 0 : (i === 0 ? -1 : 1) * (w / 4);
      k.rbox(Math.min(0.55, w / pillowCount - 0.1), 0.12, 0.35, 0.05, x, leg + 0.42, -0.65, rng.pick([p.fabricLight, p.accent, '#f4f1ea']));
    }
    return k.root;
  };
}

function nightstand(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const body = rng.pick([p.wood, p.woodDark, p.fabricLight]);
  cabinet(k, { w: 0.45, d: 0.4, h: 0.5, leg: rng.range(0.08, 0.14), body, front: k.mix(body, '#000000', 0.1), drawers: rng.int(1, 2), handle: p.metal, legColor: rng.pick([p.woodDark, p.metal]) });
  return k.root;
}

function wardrobe(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const body = rng.pick([p.wood, p.fabricLight, p.woodDark]);
  const mirrored = rng.chance(0.3);
  cabinet(k, { w: 1.2, d: 0.6, h: 2.1, leg: 0.05, body, front: mirrored ? '#c9d7dd' : k.mix(body, '#000000', 0.08), doors: 2, handle: p.metal, plinth: true, legColor: '#2a2a2c', topT: 0.04 });
  return k.root;
}

function dresser(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const body = rng.pick([p.wood, p.woodDark, p.fabricLight]);
  cabinet(k, { w: 1.2, d: 0.45, h: 0.85, leg: rng.range(0.08, 0.14), body, front: k.mix(body, '#000000', 0.1), drawers: rng.int(3, 4), handle: p.metal, legColor: rng.pick([p.woodDark, p.metal]) });
  return k.root;
}

function desk(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const wood = rng.pick([p.wood, p.woodDark, p.fabricLight]);
  const legColor = rng.pick([wood, p.metal, p.woodDark]);
  k.box(1.2, 0.03, 0.6, 0, 0.72, 0, wood);
  if (rng.chance(0.5)) {
    for (const sx of [-1, 1]) k.box(0.03, 0.72, 0.56, sx * 0.585, 0, 0, legColor);
  } else {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.04, 0.72, 0.04, sx * 0.57, 0, sz * 0.27, legColor);
  }
  if (rng.chance(0.55)) {
    const side = rng.chance(0.5) ? 1 : -1;
    const unit = k.mix(wood, '#000000', 0.08);
    k.box(0.4, 0.5, 0.5, side * 0.37, 0.2, 0, unit);
    for (let i = 0; i < 3; i++) k.box(0.36, 0.14, 0.012, side * 0.37, 0.22 + i * 0.15, 0.25 - 0.006, k.mix(wood, '#ffffff', 0.1));
  }
  return k.root;
}

/* ---- Salle de bain · WC ---- */

function bathtub(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const c = p.ceramic;
  for (const sz of [-1, 1]) k.rbox(1.7, 0.55, 0.1, 0.03, 0, 0, sz * 0.325, c, { rough: 0.3 });
  for (const sx of [-1, 1]) k.rbox(0.1, 0.55, 0.55, 0.03, sx * 0.8, 0, 0, c, { rough: 0.3 });
  k.box(1.5, 0.15, 0.55, 0, 0, 0, k.mix(c, '#cfe3ec', 0.35), { rough: 0.3 });
  k.cyl(0.015, 0.015, 0.1, -0.78, 0.55, 0, p.metal, { metal: 0.9, rough: 0.2 }, 12);
  k.box(0.02, 0.02, 0.1, -0.78, 0.63, 0.05, p.metal, { metal: 0.9, rough: 0.2 });
  if (rng.chance(0.4)) k.box(1.5, 0.02, 0.04, 0, 0.35, 0.285, p.accent);
  return k.root;
}

function shower(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  k.box(0.9, 0.06, 0.9, 0, 0, 0, p.ceramic, { rough: 0.35 });
  k.box(0.9, 1.9, 0.01, 0, 0.06, 0.445, '#bfe3f2', { opacity: 0.25, rough: 0.05 });
  k.box(0.01, 1.9, 0.9, 0.445, 0.06, 0, '#bfe3f2', { opacity: 0.25, rough: 0.05 });
  const metal = { metal: 0.9, rough: 0.2 };
  k.cyl(0.012, 0.012, 1.94, -0.4, 0.06, -0.36, p.metal, metal, 12);
  k.box(0.2, 0.02, 0.02, -0.3, 1.9, -0.36, p.metal, metal);
  k.cyl(0.08, 0.08, 0.015, -0.18, 1.88, -0.36, p.metal, metal, 20);
  if (rng.chance(0.5)) k.box(0.01, 1.9, 0.01, 0.445, 0.06, 0.445, p.metal, metal);
  return k.root;
}

function vanity(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const body = rng.pick([p.wood, p.woodDark, p.fabricLight]);
  cabinet(k, { w: 0.8, d: 0.5, h: 0.8, leg: rng.range(0.1, 0.16), body, front: k.mix(body, '#000000', 0.1), top: p.ceramic, topT: 0.03, doors: 2, handle: p.metal, legColor: rng.pick([p.metal, p.woodDark]) });
  k.rbox(0.5, 0.08, 0.38, 0.04, 0, 0.8, 0.02, p.ceramic, { rough: 0.3 });
  k.cyl(0.012, 0.012, 0.12, 0, 0.88, -0.15, p.metal, { metal: 0.9, rough: 0.2 }, 12);
  k.box(0.012, 0.012, 0.08, 0, 0.98, -0.11, p.metal, { metal: 0.9, rough: 0.2 });
  const border = rng.range(0.025, 0.04);
  frameRect(k, { w: 0.7, h: 0.9, d: 0.02, border, y: 1.0, z: -0.24, color: rng.pick([p.metal, p.woodDark, p.wood]) });
  k.box(0.7 - 2 * border, 0.9 - 2 * border, 0.01, 0, 1.0 + border, -0.24, '#d4e4ea', { metal: 0.8, rough: 0.08 });
  return k.root;
}

function toilet(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const c = p.ceramic;
  k.rbox(0.36, 0.4, 0.52, 0.07, 0, 0, 0.09, c, { rough: 0.3 });
  k.rbox(0.4, 0.785, 0.18, 0.03, 0, 0, -0.26, c, { rough: 0.3 });
  k.rbox(0.36, 0.03, 0.42, 0.03, 0, 0.4, 0.12, rng.pick(['#f2f2f0', c, k.mix(c, p.accent, 0.15)]), { rough: 0.35 });
  k.box(0.06, 0.015, 0.04, 0, 0.785, -0.26, p.metal, { metal: 0.9, rough: 0.2 });
  return k.root;
}

function handbasin(ctx) {
  const k = makeKit(ctx);
  const { palette: p } = ctx;
  k.cyl(0.05, 0.07, 0.65, 0, 0, 0, p.ceramic, { rough: 0.3 }, 16);
  k.rbox(0.4, 0.12, 0.3, 0.05, 0, 0.65, 0, p.ceramic, { rough: 0.3 });
  k.cyl(0.012, 0.012, 0.08, 0, 0.77, -0.1, p.metal, { metal: 0.9, rough: 0.2 }, 12);
  k.box(0.012, 0.012, 0.07, 0, 0.84, -0.07, p.metal, { metal: 0.9, rough: 0.2 });
  return k.root;
}

/* ---- Bureau, entrée, buanderie ---- */

function officeChair(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const fabric = rng.pick([p.fabric, p.fabricLight, p.accent, '#2b2d31']);
  k.box(0.6, 0.03, 0.05, 0, 0.05, 0, p.metal, { metal: 0.6 });
  k.box(0.05, 0.03, 0.6, 0, 0.05, 0, p.metal, { metal: 0.6 });
  for (const [x, z] of [[-0.27, 0], [0.27, 0], [0, -0.27], [0, 0.27]]) k.cyl(0.03, 0.03, 0.05, x, 0, z, '#1c1c1e', undefined, 12);
  k.cyl(0.03, 0.03, 0.35, 0, 0.08, 0, p.metal, { metal: 0.6 }, 12);
  k.rbox(0.5, 0.08, 0.5, 0.03, 0, 0.43, 0, fabric);
  k.rbox(0.46, 0.46, 0.06, 0.03, 0, 0.54, -0.22, fabric);
  if (rng.chance(0.5)) {
    for (const sx of [-1, 1]) {
      k.box(0.03, 0.2, 0.03, sx * 0.265, 0.51, -0.05, p.metal);
      k.box(0.05, 0.03, 0.28, sx * 0.265, 0.71, -0.05, '#1c1c1e');
    }
  }
  return k.root;
}

function shelfUnit(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const wood = rng.pick([p.wood, p.woodDark]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.03, 1.8, 0.03, sx * 0.385, 0, sz * 0.16, p.metal, { metal: 0.5 });
  const shelves = rng.int(4, 5);
  const gap = (1.77 - 0.1) / (shelves - 1);
  const stuff = [p.accent, p.fabric, p.fabricLight, p.plant];
  for (let i = 0; i < shelves; i++) {
    const y = i === shelves - 1 ? 1.77 : 0.1 + i * gap;
    k.box(0.8, 0.03, 0.35, 0, y, 0, wood);
    if (i < shelves - 1 && rng.chance(0.7)) {
      const items = rng.int(1, 3);
      for (let n = 0; n < items; n++) {
        const size = rng.range(0.18, Math.min(0.32, gap - 0.08));
        k.rbox(rng.range(0.16, 0.22), size, 0.25, 0.02, -0.22 + n * 0.25, y + 0.03, 0, rng.pick(stuff));
      }
    }
  }
  return k.root;
}

function mirror(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const border = rng.range(0.03, 0.05);
  frameRect(k, { w: 0.6, h: 1.2, d: 0.03, border, color: rng.pick([p.wood, p.woodDark, p.metal, p.accent]) });
  k.box(0.6 - 2 * border, 1.2 - 2 * border, 0.01, 0, border, 0, '#d4e4ea', { metal: 0.8, rough: 0.08 });
  return k.root;
}

function bench(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const wood = rng.pick([p.wood, p.woodDark]);
  const legH = rng.range(0.3, 0.37);
  const cushion = rng.chance(0.5);
  const plankTop = cushion ? 0.41 : 0.45;
  k.box(1.0, plankTop - legH, 0.35, 0, legH, 0, wood);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.05, legH, 0.05, sx * 0.45, 0, sz * 0.15, rng.pick([wood, p.metal]));
  k.box(0.9, 0.02, 0.28, 0, 0.12, 0, k.mix(wood, '#000000', 0.1));
  if (cushion) k.rbox(0.96, 0.04, 0.31, 0.015, 0, 0.41, 0, rng.pick([p.fabric, p.accent, p.fabricLight]));
  return k.root;
}

function coatRack(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const color = rng.pick([p.woodDark, p.metal, p.wood]);
  k.cyl(0.25, 0.25, 0.03, 0, 0, 0, color, undefined, 24);
  k.cyl(0.02, 0.02, 1.72, 0, 0.03, 0, color, undefined, 12);
  for (let i = 0; i < 4; i++) {
    const arm = k.sub(0, 0, (i * Math.PI) / 2 + Math.PI / 4);
    arm.box(0.015, 0.015, 0.2, 0, 1.62, 0.11, color);
    arm.box(0.015, 0.05, 0.015, 0, 1.62, 0.205, color);
  }
  if (rng.chance(0.5)) k.rbox(0.3, 0.7, 0.1, 0.04, 0, 0.9, 0, rng.pick([p.fabric, p.accent, p.fabricLight]));
  return k.root;
}

function washer(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const c = rng.pick([p.ceramic, p.fabricLight]);
  k.rbox(0.6, 0.85, 0.6, 0.02, 0, 0, 0, c, { rough: 0.35 });
  const door = k.cyl(0.21, 0.21, 0.02, 0, 0, 0, '#2c3a44', { metal: 0.5, rough: 0.15 }, 24);
  door.rotation.x = Math.PI / 2;
  door.position.set(0, 0.4, 0.29);
  const glass = k.cyl(0.17, 0.17, 0.02, 0, 0, 0, '#101a22', { rough: 0.1 }, 24);
  glass.rotation.x = Math.PI / 2;
  glass.position.set(0, 0.4, 0.293);
  k.box(0.56, 0.08, 0.01, 0, 0.74, 0.29, '#1f2226');
  for (const x of [-0.18, 0.18]) k.cyl(0.02, 0.02, 0.01, x, 0.78, 0.275, p.metal, { metal: 0.8 }, 12);
  return k.root;
}

/* ---- Décoration ---- */

function rug({ w, d }) {
  return (ctx) => {
    const k = makeKit(ctx);
    const { rng, palette: p } = ctx;
    const colors = [p.fabric, p.fabricLight, p.accent];
    const a = rng.pick(colors);
    const b = rng.pick(colors.filter((c) => c !== a));
    const c = rng.pick(colors.filter((color) => color !== b));
    k.box(w, 0.015, d, 0, 0, 0, a, { rough: 1 });
    k.box(w - 0.2, 0.003, d - 0.2, 0, 0.015, 0, b, { rough: 1 });
    k.box(w - 0.4, 0.002, d - 0.4, 0, 0.018, 0, c, { rough: 1 });
    return k.root;
  };
}

function foliageColors(k, p, rng) {
  const shades = [k.mix(p.plant, '#000000', 0.15), p.plant, k.mix(p.plant, '#ffffff', 0.18)];
  const shift = rng.int(0, 2);
  return shades.map((_, i) => shades[(i + shift) % 3]);
}

/** Plante : pot + feuillage. Le gros ellipsoïde central fixe la boîte (largeur et hauteur) ; les autres restent dedans. */
function plant({ w, h, potR, potH, trunk }) {
  return (ctx) => {
    const k = makeKit(ctx);
    const { rng, palette: p } = ctx;
    const pot = rng.pick([p.accent, p.ceramic, p.woodDark, p.fabricLight]);
    k.cyl(potR, potR * 0.8, potH, 0, 0, 0, pot, { rough: 0.6 });
    k.cyl(potR - 0.01, potR - 0.01, 0.01, 0, potH, 0, '#4a3a2c');
    const greens = foliageColors(k, p, rng);
    const r = w / 2;
    const canopyH = h - potH - (trunk ? trunk : 0);
    const cy = potH + (trunk ?? 0) + canopyH / 2;
    if (trunk) k.cyl(0.015, 0.02, trunk + 0.02, 0, potH, 0, '#6b4f3a', undefined, 10);
    k.ell(r, canopyH / 2, r, 0, cy, 0, greens[0], { rough: 0.9 });
    const blobs = rng.int(3, 6);
    for (let i = 0; i < blobs; i++) {
      const angle = rng.range(0, Math.PI * 2);
      const dist = rng.range(0.15, 0.45) * r;
      const size = rng.range(0.3, 0.5) * r;
      k.ell(size, size * 1.1, size, Math.cos(angle) * dist, cy + rng.range(-0.2, 0.2) * (canopyH / 2), Math.sin(angle) * dist, greens[1 + (i % 2)], { rough: 0.9 });
    }
    return k.root;
  };
}

function framed({ w, h, d }) {
  return (ctx) => {
    const k = makeKit(ctx);
    const { rng, palette: p } = ctx;
    const border = Math.min(w, h) * 0.07;
    frameRect(k, { w, h, d, border, color: rng.pick([p.woodDark, p.wood, p.metal, '#1c1c1e']) });
    const matte = '#f4f1ea';
    k.box(w - 2 * border, h - 2 * border, d * 0.4, 0, border, -d * 0.1, matte);
    const iw = (w - 2 * border) * 0.7;
    const ih = (h - 2 * border) * 0.7;
    const colors = [p.accent, p.fabric, p.plant, p.woodDark, p.fabricLight];
    const style = rng.int(0, 2);
    const z = d * 0.12;
    if (style === 0) {
      k.box(iw, ih, d * 0.3, 0, h / 2 - ih / 2, z, rng.pick(colors));
      k.box(iw * 0.5, ih * 0.4, d * 0.3, 0, h / 2 - ih / 2 + ih * 0.3, z + 0.002, rng.pick(colors));
    } else if (style === 1) {
      const disc = k.cyl(Math.min(iw, ih) * 0.4, Math.min(iw, ih) * 0.4, d * 0.3, 0, 0, z, rng.pick(colors), undefined, 24);
      disc.rotation.x = Math.PI / 2;
      disc.position.set(0, h / 2, z);
    } else {
      const bands = rng.int(3, 5);
      for (let i = 0; i < bands; i++) k.box(iw, ih / bands - 0.01, d * 0.3, 0, h / 2 - ih / 2 + i * (ih / bands), z, rng.pick(colors));
    }
    return k.root;
  };
}

function ceilingLight(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const shade = rng.pick([p.fabricLight, p.accent, p.metal, p.wood]);
  const metal = { metal: 0.6, rough: 0.4 };
  k.cyl(0.005, 0.005, 0.25, 0, 0.2, 0, p.metal, metal, 8);
  k.cyl(0.04, 0.04, 0.02, 0, 0.43, 0, p.metal, metal, 16);
  const drum = rng.chance(0.5);
  k.cyl(drum ? 0.2 : 0.08, 0.2, 0.2, 0, 0, 0, shade, { emissive: shade, emissiveIntensity: 0.3, rough: 0.8 });
  k.ell(0.05, 0.05, 0.05, 0, 0.07, 0, '#fff4d6', { emissive: '#ffd98a', emissiveIntensity: 1 });
  return k.root;
}

function curtains(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const fabric = rng.pick([p.fabricLight, p.fabric, p.accent]);
  const rod = k.cyl(0.015, 0.015, 1.6, 0, 0, 0, p.metal, { metal: 0.7, rough: 0.3 }, 12);
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, 2.285, -0.06);
  const folds = rng.int(5, 8);
  const panelW = 0.68;
  for (const side of [-1, 1]) {
    const x0 = side * (0.8 - panelW / 2);
    for (let i = 0; i < folds; i++) {
      const fw = panelW / folds;
      const x = x0 - panelW / 2 + fw * (i + 0.5);
      k.box(fw, 2.25, 0.03, x, 0, i % 2 ? 0.06 : -0.06, i % 2 ? fabric : k.mix(fabric, '#000000', 0.08), { rough: 1 });
    }
  }
  return k.root;
}

function tableLamp(ctx) {
  const k = makeKit(ctx);
  const { rng, palette: p } = ctx;
  const base = rng.pick([p.ceramic, p.accent, p.metal, p.woodDark]);
  const shade = rng.pick([p.fabricLight, p.wall, p.accent]);
  k.ell(0.07, 0.07, 0.07, 0, 0.07, 0, base, { rough: 0.4 });
  k.cyl(0.012, 0.012, 0.12, 0, 0.13, 0, base, { rough: 0.4 }, 10);
  k.cyl(0.1, 0.125, 0.2, 0, 0.25, 0, shade, { emissive: shade, emissiveIntensity: 0.4, rough: 0.9 });
  return k.root;
}

/* ------------------------------------------------------------------ */
/* Fonctions de construction par identifiant                           */
/* ------------------------------------------------------------------ */

/** @type {Readonly<Record<string, (ctx: any) => any>>} */
const BASE_BUILDERS = {
  'sofa-2': sofa({ w: 1.6, d: 0.9, seats: 2 }),
  'sofa-3': sofa({ w: 2.2, d: 0.9, seats: 3 }),
  'sofa-bed': sofa({ w: 1.9, d: 0.9, seats: 2 }),
  armchair: sofa({ w: 0.8, d: 0.85, seats: 1 }),
  'coffee-table': coffeeTable,
  'tv-unit': tvUnit,
  bookcase,
  console: consoleTable,
  'floor-lamp': floorLamp,
  'dining-table-4': diningTable({ ends: false }),
  'dining-table-6': diningTable({ ends: true }),
  buffet,
  'kitchen-base': kitchenBase,
  'kitchen-sink': kitchenSink,
  'kitchen-hob': kitchenHob,
  fridge,
  hood,
  'kitchen-island': kitchenIsland,
  'bar-stool': barStool,
  'kitchen-wall': kitchenWall,
  'bed-double': bed({ w: 1.7, headH: 1.0, pillowCount: 2 }),
  'bed-single': bed({ w: 0.95, headH: 0.9, pillowCount: 1 }),
  nightstand,
  wardrobe,
  dresser,
  desk,
  bathtub,
  shower,
  vanity,
  toilet,
  handbasin,
  'office-chair': officeChair,
  'shelf-unit': shelfUnit,
  mirror,
  bench,
  'coat-rack': coatRack,
  washer,
  'rug-s': rug({ w: 1.2, d: 0.8 }),
  'rug-m': rug({ w: 2.0, d: 1.4 }),
  'rug-l': rug({ w: 2.8, d: 2.0 }),
  'plant-small': plant({ w: 0.3, h: 0.45, potR: 0.1, potH: 0.16 }),
  'plant-medium': plant({ w: 0.5, h: 1.0, potR: 0.14, potH: 0.26 }),
  'plant-tall': plant({ w: 0.6, h: 1.6, potR: 0.16, potH: 0.3, trunk: 0.35 }),
  'frame-small': framed({ w: 0.4, h: 0.5, d: 0.03 }),
  'frame-large': framed({ w: 0.9, h: 0.6, d: 0.04 }),
  'ceiling-light': ceilingLight,
  curtains,
  'table-lamp': tableLamp,
};

/** Modèles supplémentaires des objets d'origine (furniture-models.js) : le constructeur d'origine reste le modèle 0. */
function withAlternatives(builders) {
  const out = { ...builders };
  for (const [id, alternatives] of Object.entries(ALT_MODELS)) out[id] = withModels([builders[id], ...alternatives]);
  return out;
}

/** @type {Readonly<Record<string, ((ctx: any) => any) & { models?: number }>>} */
export const FURNITURE_BUILDERS = Object.freeze(withAlternatives({ ...BASE_BUILDERS, ...HOME_BUILDERS, ...GARAGE_BUILDERS }));

/**
 * Définitions complètes : les données (FURNITURE_DATA) avec leur fonction `build(ctx)`.
 * @typedef {typeof FURNITURE_DATA[number] & { build: (ctx: any) => any }} FurnitureDef
 * @type {readonly FurnitureDef[]}
 */
export const FURNITURE_DEFS = Object.freeze(FURNITURE_DATA.map((entry) => Object.freeze({ ...entry, build: FURNITURE_BUILDERS[entry.id], models: FURNITURE_BUILDERS[entry.id]?.models ?? 1 })));

/** Définition complète d'un objet par son identifiant. */
export function getFurniture(id) {
  return FURNITURE_DEFS.find((def) => def.id === id);
}

/**
 * Construit un objet : applique le nom et marque le groupe avec l'identifiant et la taille attendue.
 * @param {FurnitureDef} def
 * @param {ReturnType<typeof createBuildContext>} ctx
 */
export function buildFurniture(def, ctx) {
  const group = def.build(ctx);
  group.name = def.id;
  group.userData = { furnitureId: def.id, size: def.size };
  return group;
}
