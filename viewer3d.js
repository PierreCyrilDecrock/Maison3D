// viewer3d.js — vue 3D (Three.js).
// Phase 4 : murs, ouvertures, cadres, vitres et sols générés à partir du plan (buildStructure de core.js),
// fusionnés en une géométrie par matériau, reconstruits avec un anti-rebond de 100 ms, rendu à la demande.
// Phase 9 : niveaux empilés (un groupe par niveau, décalé de levelElevation), finitions (textures procédurales dessinées sur canvas,
// coordonnées de texture en mètres), soleil réglable (direction, couleur, ombres statiques refaites seulement quand elles changent),
// luminaires la nuit (quelques lumières ponctuelles pour les plus proches de la caméra), boussole, visite sur plusieurs niveaux.
// Convention : 1 unité Three.js = 1 m ; le plan 2D (x, y) devient (x, z) en 3D, y est la hauteur.
// Three.js (version figée : 0.160.0). Dans le navigateur on charge les modules copiés dans vendor/,
// qui n'ont aucun import « nu » : une import map n'est donc pas nécessaire (Firefox l'ignorait dans
// l'artefact : « The specifier "three" was a bare specifier »). OrbitControls importe le même
// module three, donc il n'y a qu'une seule instance. Hors navigateur (tests Node) on prend le paquet npm.
import {
  BASEBOARD_FINISHES, DEFAULT_LIGHTING, FLOOR_FINISHES, FLOOR_THICKNESS, LOWERED_WALL_HEIGHT, ROOM_TYPES, STAIR_FINISHES, WALL_FINISHES,
  buildStructure, computeSunReport, drawFinishPattern, finishById, getPlanExtent, levelElevation, levelPlan, roomColor, roomKey, stairRise, sunDirection, sunPosition, tagExteriorBoxes,
} from './core.js';
import { buildFurniture, createBuildContext, getFurniture, getPalette, hashSeed } from './furniture.js';
import { WALK_EYE_HEIGHT, buildWalkBuilding, findBuildingWalkStart, roomWallVariation, stepWalker } from './generator.js';

const CDN = './vendor/three';
const inBrowser = typeof process === 'undefined';
const THREE = await import(inBrowser ? `${CDN}/build/three.module.js` : 'three');
const { OrbitControls } = await import(inBrowser ? `${CDN}/examples/jsm/controls/OrbitControls.js` : 'three/addons/controls/OrbitControls.js');
const { RoundedBoxGeometry } = await import(inBrowser ? `${CDN}/examples/jsm/geometries/RoundedBoxGeometry.js` : 'three/addons/geometries/RoundedBoxGeometry.js');

// Pour furniture.js (qui n'importe pas Three.js) et pour les tests : le même Three.js, une seule instance.
export { THREE, RoundedBoxGeometry };

const MAJOR_METERS = 2; // un trait fort tous les 2 m (même rythme que la grille 2D)
const MINOR_METERS = 0.5; // un trait fin tous les 50 cm, même quand le pas de la grille est de 10 cm
const GRID_Y = 0.004; // les traits de grille flottent à 4 mm du sol pour éviter le scintillement
const GROUND_Y = -0.004; // le sol extérieur est juste sous le niveau des sols
const REBUILD_DELAY_MS = 100;
const MIN_FRAME_W = 8; // un plan minuscule n'est pas cadré de trop près
const MIN_FRAME_D = 6;
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Couleurs de la scène, lues dans les variables CSS du thème actif. */
export function readPalette() {
  return {
    sky: cssVar('--scene-sky') || '#f4f8fb',
    background: cssVar('--scene-bg') || '#dde6ec',
    ground: cssVar('--scene-floor') || '#e6ecf0',
    gridMinor: cssVar('--grid-major') || '#bfcbd5',
    gridMajor: cssVar('--ink-soft') || '#566774',
    wall: cssVar('--scene-wall') || '#efebe4',
    frame: cssVar('--scene-frame') || '#7c6650',
    tone: {
      sat: Number.parseFloat(cssVar('--room-sat')) || 62,
      light: Number.parseFloat(cssVar('--room-light')) || 86,
    },
  };
}

function gridLines(positions, color, opacity, name) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  lines.name = name;
  return lines;
}

/**
 * Le « monde » : sol extérieur neutre, grille (traits tous les 0,5 m, forts tous les 2 m) et axes. Il ne dépend que de la taille de la grille ;
 * les murs et sols des pièces sont dans un groupe à part, reconstruit à chaque modification du plan.
 * @param {import('./core.js').Plan} plan
 * @param {ReturnType<typeof readPalette>} [palette]
 */
export function buildWorld(plan, palette = readPalette()) {
  const { width, height, cellSize } = plan.grid;
  const W = width * cellSize; // largeur en mètres (axe x)
  const H = height * cellSize; // profondeur en mètres (axe z)
  const world = new THREE.Group();
  world.name = 'monde';

  const size = Math.max(W, H) * 6;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({
      color: palette.ground,
      roughness: 1,
      metalness: 0,
      polygonOffset: true, // repousse le sol derrière la grille
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
  );
  ground.name = 'sol';
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(W / 2, GROUND_Y, H / 2);
  ground.receiveShadow = true;
  world.add(ground);

  const minor = [];
  const major = [];
  const minorEvery = Math.max(1, Math.round(MINOR_METERS / cellSize));
  const majorEvery = Math.max(1, Math.round(MAJOR_METERS / cellSize));
  for (let i = 0; i <= width; i++) {
    if (i % minorEvery !== 0 && i !== width) continue;
    const target = i % majorEvery === 0 || i === width ? major : minor;
    target.push(i * cellSize, GRID_Y, 0, i * cellSize, GRID_Y, H);
  }
  for (let j = 0; j <= height; j++) {
    if (j % minorEvery !== 0 && j !== height) continue;
    const target = j % majorEvery === 0 || j === height ? major : minor;
    target.push(0, GRID_Y, j * cellSize, W, GRID_Y, j * cellSize);
  }
  world.add(gridLines(minor, palette.gridMinor, 0.7, 'grille-fine'));
  world.add(gridLines(major, palette.gridMajor, 0.55, 'grille-2m'));

  // Axes de 1 m à l'origine : x rouge, y vert (hauteur), z bleu.
  const axes = new THREE.AxesHelper(1);
  axes.name = 'axes';
  axes.position.set(0, 0.01, 0);
  world.add(axes);
  return world;
}

/** Met à jour les couleurs d'un monde existant (changement de thème). */
export function applyPalette(world, palette) {
  world.getObjectByName('sol')?.material.color.set(palette.ground);
  world.getObjectByName('grille-fine')?.material.color.set(palette.gridMinor);
  world.getObjectByName('grille-2m')?.material.color.set(palette.gridMajor);
}

/** Libère la mémoire GPU des géométries et matériaux d'un objet retiré de la scène. */
export function disposeWorld(world) {
  world?.traverse((object) => {
    object.geometry?.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) material?.dispose();
  });
}

/* ------------------------------------------------------------------ */
/* Structure : boîtes → géométries fusionnées par matériau            */
/* ------------------------------------------------------------------ */

/**
 * Fusionne des boîtes en tableaux de sommets (positions, normales, indices) : 24 sommets et 12 triangles par boîte,
 * un seul tampon pour toutes. Fonction pure, sans Three.js : on peut la tester hors navigateur.
 * @param {import('./core.js').StructureBox[]} boxes
 */
export function mergeBoxes(boxes) {
  const positions = new Float32Array(boxes.length * 72);
  const normals = new Float32Array(boxes.length * 72);
  const uvs = new Float32Array(boxes.length * 48); // en mètres, dans le repère de la scène : une texture de `size` mètres se répète sans raccord d'une boîte à l'autre
  const indices = new Uint32Array(boxes.length * 36);
  let v = 0;
  let i = 0;
  let t = 0;
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const box of boxes) {
    const half = box.size.map((d) => d / 2);
    // Boîte tournée : `angle` autour de l'axe vertical (convention Three.js, rotation.y), précédé de `pitch`, une inclinaison autour de
    // l'axe z local (le sens de la longueur, x, monte quand pitch > 0) : marches d'un colimaçon, barres inclinées des garde-corps.
    const cos = box.angle ? Math.cos(box.angle) : 1;
    const sin = box.angle ? Math.sin(box.angle) : 0;
    const pc = box.pitch ? Math.cos(box.pitch) : 1;
    const ps = box.pitch ? Math.sin(box.pitch) : 0;
    const turned = Boolean(box.angle || box.pitch);
    const turn = (p) => { // p : décalage par rapport au centre, tourné sur place
      if (!turned) return;
      const x1 = p[0] * pc - p[1] * ps;
      const y1 = p[0] * ps + p[1] * pc;
      p[0] = x1 * cos + p[2] * sin;
      p[1] = y1;
      p[2] = -x1 * sin + p[2] * cos;
    };
    for (let axis = 0; axis < 3; axis++) {
      const u = (axis + 1) % 3; // (u, w, axis) est un repère direct : l'ordre des coins est antihoraire vu de l'extérieur
      const w = (axis + 2) % 3;
      for (const sign of [1, -1]) {
        const base = v / 3;
        const order = sign > 0 ? corners : [...corners].reverse();
        for (const [cu, cw] of order) {
          const p = [0, 0, 0];
          p[axis] = sign * half[axis];
          p[u] = cu * half[u];
          p[w] = cw * half[w];
          turn(p);
          p[0] += box.position[0];
          p[1] += box.position[1];
          p[2] += box.position[2];
          positions.set(p, v);
          const normal = [0, 0, 0];
          normal[axis] = sign;
          turn(normal);
          normals.set(normal, v);
          uvs[t++] = axis === 1 || axis === 2 ? p[0] : p[2]; // faces ±y et ±z : x ; faces ±x : z
          uvs[t++] = axis === 1 ? p[2] : p[1]; // faces ±y : z ; les autres : la hauteur
          v += 3;
        }
        indices.set([base, base + 1, base + 2, base, base + 2, base + 3], i);
        i += 6;
      }
    }
  }
  return { positions, normals, uvs, indices };
}

/** Un matériau par clé de matériau de la structure ; créés une seule fois, mis à jour au changement de thème. */
export function createMaterials(palette = readPalette()) {
  const materials = new Map();
  const standard = (key, params) => materials.set(key, new THREE.MeshStandardMaterial({ metalness: 0, ...params }));
  standard('wall', { color: palette.wall, roughness: 0.95 });
  standard('frame', { color: palette.frame, roughness: 0.7 });
  standard('threshold', { color: palette.frame, roughness: 0.8 });
  for (const type of ROOM_TYPES) standard(`floor:${type}`, { color: roomColor(type, palette.tone), roughness: 0.9 });
  return materials;
}

/** Recolore les matériaux d'un jeu existant (changement de thème). */
export function applyMaterialPalette(materials, palette) {
  materials.get('wall')?.color.set(palette.wall);
  materials.get('frame')?.color.set(palette.frame);
  materials.get('threshold')?.color.set(palette.frame);
  for (const type of ROOM_TYPES) materials.get(`floor:${type}`)?.color.set(roomColor(type, palette.tone));
}

const NO_CAST = (key) => key.startsWith('floor:') || key.startsWith('tint:') || key.startsWith('baseboard:');

/**
 * Couleur des murs d'une pièce : la couleur de mur de la palette du logement, légèrement variée (teinte, saturation,
 * luminosité) selon la graine du logement et la pièce (voir roomWallVariation). Renvoie une couleur Three.
 */
export function roomWallColor(paletteId, seed, roomId) {
  const hsl = { h: 0, s: 0, l: 0 };
  new THREE.Color(getPalette(paletteId).wall).getHSL(hsl);
  const v = roomWallVariation(seed, roomId);
  const h = (((hsl.h + v.h) % 1) + 1) % 1;
  const s = Math.min(0.5, Math.max(0.04, hsl.s + 0.04 + v.s)); // un minimum de couleur, sinon les variations de teinte ne se voient pas
  const l = Math.min(0.96, Math.max(0.55, hsl.l + v.l));
  return new THREE.Color().setHSL(h, s, l);
}

/**
 * Construit le groupe d'objets de la structure : un Mesh par matériau, géométries fusionnées.
 * @param {ReturnType<typeof buildStructure>} structure
 * @param {Map<string, THREE.Material>} materials
 */
export function buildStructureGroup(structure, materials) {
  const group = new THREE.Group();
  group.name = 'structure';
  const byMaterial = new Map();
  for (const box of structure.boxes) {
    // Murs extérieurs (mode automatique) : un maillage par côté et par ligne, pour pouvoir masquer ceux qui sont devant la caméra.
    const part = box.exterior ? `|${box.exterior.side}${box.exterior.line}` : '';
    const id = `${box.material}${part}`;
    if (!byMaterial.has(id)) byMaterial.set(id, { material: box.material, exterior: box.exterior ?? null, boxes: [] });
    byMaterial.get(id).boxes.push(box);
  }
  for (const { material: key, exterior, boxes } of byMaterial.values()) {
    const material = materials.get(key) ?? materials.get('wall');
    const { positions, normals, uvs, indices } = mergeBoxes(boxes);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = key;
    if (exterior) mesh.userData.exterior = exterior;
    mesh.castShadow = !NO_CAST(key);
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

/* ------------------------------------------------------------------ */
/* Textures procédurales des finitions                                 */
/* ------------------------------------------------------------------ */

/**
 * Fabrique de textures : une texture par finition, dessinée à la demande (256 px sur écran tactile, 512 sinon) et réutilisée.
 * Renvoie null quand le canvas n'est pas disponible (tests hors navigateur) : le matériau garde alors la couleur de la finition.
 */
function createTextureFactory(maxAnisotropy, small) {
  const cache = new Map();
  const N = small ? 256 : 512;
  return {
    get(finish) {
      if (!finish?.pattern) return null;
      if (cache.has(finish.id + finish.pattern)) return cache.get(finish.id + finish.pattern);
      let texture = null;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = N;
        canvas.height = N;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          drawFinishPattern(ctx, N, finish);
          texture = new THREE.CanvasTexture(canvas);
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = Math.min(4, maxAnisotropy);
          texture.repeat.set(1 / finish.size, 1 / finish.size);
        }
      } catch {
        texture = null;
      }
      cache.set(finish.id + finish.pattern, texture);
      return texture;
    },
    dispose() {
      for (const texture of cache.values()) texture?.dispose();
      cache.clear();
    },
  };
}

/** Matériau d'un sol fini (« floor:<id> ») : texture à l'échelle réelle ; carreaux et damier plus lisses que le parquet. */
function floorFinishMaterial(finish, textures) {
  const map = textures.get(finish);
  return new THREE.MeshStandardMaterial({ color: map ? 0xffffff : finish.color, map, roughness: finish.pattern === 'tiles' || finish.pattern === 'checker' ? 0.45 : 0.82, metalness: 0 });
}

/** Libère uniquement les géométries d'un groupe (les matériaux sont partagés et durent toute la session). */
export function disposeGeometries(group) {
  group?.traverse((object) => object.geometry?.dispose());
}

/* ------------------------------------------------------------------ */
/* Mobilier du plan : gabarits partagés, instances et lots            */
/* ------------------------------------------------------------------ */

/** Nombre de variantes (couleurs, tailles) construites par type d'objet : les objets d'une même variante partagent tout. */
export const FURNITURE_VARIANTS = 4;
/** À partir de ce nombre d'exemplaires identiques, un objet est dessiné en instances ; en dessous, il est fondu dans un lot. */
export const INSTANCE_MIN = 3;

const IDENTITY = new THREE.Matrix4();

/**
 * Fond des géométries en une seule : chaque entrée est une géométrie, la matrice à lui appliquer (positions et normales) et
 * sa couleur (couleurs de sommets : un même matériau peut alors servir pour toutes les couleurs ; sans couleur, celle de la
 * géométrie si elle en a une). Aucune texture : seuls position, normale et couleur sont conservés. Résultat indexé.
 * @param {{ geometry: THREE.BufferGeometry, matrix?: THREE.Matrix4, color?: THREE.Color }[]} entries
 */
export function bakeGeometries(entries) {
  let vertexCount = 0;
  let indexCount = 0;
  for (const { geometry } of entries) {
    vertexCount += geometry.attributes.position.count;
    indexCount += geometry.index ? geometry.index.count : geometry.attributes.position.count;
  }
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3).fill(1);
  const indices = new Uint32Array(indexCount);
  const normalMatrix = new THREE.Matrix3();
  const v = new THREE.Vector3();
  let vo = 0;
  let io = 0;
  for (const { geometry, matrix = IDENTITY, color } of entries) {
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const vertexColor = geometry.attributes.color; // déjà fondue dans un gabarit : on garde ses couleurs
    normalMatrix.getNormalMatrix(matrix);
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i).applyMatrix4(matrix);
      const o = (vo + i) * 3;
      positions[o] = v.x;
      positions[o + 1] = v.y;
      positions[o + 2] = v.z;
      if (normal) {
        v.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).normalize();
        normals[o] = v.x;
        normals[o + 1] = v.y;
        normals[o + 2] = v.z;
      }
      if (color) {
        colors[o] = color.r;
        colors[o + 1] = color.g;
        colors[o + 2] = color.b;
      } else if (vertexColor) {
        colors[o] = vertexColor.getX(i);
        colors[o + 1] = vertexColor.getY(i);
        colors[o + 2] = vertexColor.getZ(i);
      }
    }
    const flip = matrix.determinant() < 0; // miroir : l'ordre des sommets des triangles s'inverse
    const count = geometry.index ? geometry.index.count : position.count;
    for (let k = 0; k < count; k += 3) {
      const a = geometry.index ? geometry.index.getX(k) : k;
      const b = geometry.index ? geometry.index.getX(k + 1) : k + 1;
      const c = geometry.index ? geometry.index.getX(k + 2) : k + 2;
      indices[io + k] = vo + a;
      indices[io + k + 1] = vo + (flip ? c : b);
      indices[io + k + 2] = vo + (flip ? b : c);
    }
    vo += position.count;
    io += count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  out.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  out.setIndex(new THREE.BufferAttribute(indices, 1));
  out.computeBoundingSphere();
  return out;
}

/** Clé de partage d'un matériau de meuble : tout sauf la couleur (qui passe par les couleurs de sommets). */
const roughnessOf = (m) => Math.min(1, Math.max(0.2, Math.round(m.roughness * 5) / 5)); // par paliers de 0,2 : moins de matériaux
const metalnessOf = (m) => Math.round(m.metalness * 2) / 2;
const emissiveOf = (m) => (m.emissive && m.emissive.getHex() !== 0 ? m.emissive.getHexString() : '');
const materialKeyOf = (m) => [roughnessOf(m), metalnessOf(m), m.transparent ? Math.round(m.opacity * 10) / 10 : 1, emissiveOf(m), emissiveOf(m) ? m.emissiveIntensity : 0].join('|');

function sharedMaterial(source) {
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: roughnessOf(source), metalness: metalnessOf(source) });
  if (source.transparent) {
    material.transparent = true;
    material.opacity = source.opacity;
    material.depthWrite = false;
  }
  if (source.emissive && source.emissive.getHex() !== 0) {
    material.emissive.copy(source.emissive);
    material.emissiveIntensity = source.emissiveIntensity;
  }
  return material;
}

/**
 * Bibliothèque de rendu du mobilier. Chaque (objet, variante) n'est construit qu'une fois : ses maillages sont fondus par
 * matériau en un « gabarit » ; les matériaux sont partagés par tout le mobilier (clé = rugosité, métal, transparence, émission :
 * une dizaine de matériaux en tout) et les couleurs sont portées par les sommets.
 * - `build(items, { palette })` : groupe Three pour une liste de plan.furniture. Les objets en au moins INSTANCE_MIN exemplaires
 *   d'une même variante sont dessinés en instances (un InstancedMesh par matériau) ; les autres sont fondus, avec tous les
 *   autres objets isolés, en un seul maillage par matériau. Au total quelques dizaines d'appels de dessin pour tout un logement.
 * - Changer de palette vide la bibliothèque (les couleurs sont dans les gabarits).
 * - La variante d'un objet est variant.seed modulo FURNITURE_VARIANTS ; la graine du gabarit ne dépend que de l'objet et de sa variante.
 */
export function createFurnitureLibrary() {
  const three = { THREE, RoundedBoxGeometry };
  let paletteId = null;
  const templates = new Map();
  const materials = new Map();
  const stats = { templates: 0, items: 0, meshes: 0, instanced: 0, batched: 0, geometries: 0, materials: 0 };

  function shared(source) {
    const key = materialKeyOf(source);
    let material = materials.get(key);
    if (!material) {
      material = sharedMaterial(source);
      materials.set(key, material);
    }
    return { key, material };
  }

  function disposeAll() {
    for (const template of templates.values()) for (const part of template.parts) part.geometry.dispose();
    for (const material of materials.values()) material.dispose();
    templates.clear();
    materials.clear();
  }

  function templateOf(def, variant) {
    const key = `${def.id}#${variant}`;
    let template = templates.get(key);
    if (template) return template;
    const object = buildFurniture(def, createBuildContext(three, { palette: paletteId, variations: true, seed: hashSeed(key) }));
    object.updateMatrixWorld(true);
    const byMaterial = new Map();
    object.traverse((node) => {
      if (!node.isMesh) return;
      const { key: mk, material } = shared(node.material);
      if (!byMaterial.has(mk)) byMaterial.set(mk, { key: mk, material, entries: [] });
      byMaterial.get(mk).entries.push({ geometry: node.geometry, matrix: node.matrixWorld.clone(), color: node.material.color.clone() });
    });
    object.traverse((node) => node.material?.dispose());
    template = {
      key,
      parts: [...byMaterial.values()].map(({ key: mk, material, entries }) => ({ key: mk, material, geometry: bakeGeometries(entries) })),
    };
    object.traverse((node) => node.geometry?.dispose());
    templates.set(key, template);
    return template;
  }

  const euler = new THREE.Euler();
  const quaternion = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const position = new THREE.Vector3();

  return {
    stats,
    /**
     * @param {import('./core.js').PlacedItem[]} items plan.furniture
     * @param {{ palette?: string }} [options] identifiant de palette
     */
    build(items, { palette = 'scandinave' } = {}) {
      const id = getPalette(palette).id;
      if (id !== paletteId) {
        disposeAll();
        paletteId = id;
      }
      const group = new THREE.Group();
      group.name = 'furniture';
      const buckets = new Map();
      let count = 0;
      for (const item of items) {
        const def = getFurniture(item.defId);
        if (!def) continue;
        const variant = (Number(item.variant?.seed) || 0) % FURNITURE_VARIANTS;
        const template = templateOf(def, variant);
        quaternion.setFromEuler(euler.set(0, THREE.MathUtils.degToRad(item.rotationY), 0));
        const matrix = new THREE.Matrix4().compose(position.set(item.x, item.y ?? 0, item.z), quaternion, one);
        if (!buckets.has(template.key)) buckets.set(template.key, { template, matrices: [] });
        buckets.get(template.key).matrices.push(matrix);
        count++;
      }
      const batches = new Map();
      let instanced = 0;
      for (const { template, matrices } of buckets.values()) {
        if (matrices.length >= INSTANCE_MIN) {
          for (const part of template.parts) {
            const mesh = new THREE.InstancedMesh(part.geometry, part.material, matrices.length);
            matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
            mesh.instanceMatrix.needsUpdate = true;
            mesh.castShadow = !part.material.transparent;
            mesh.receiveShadow = true;
            mesh.frustumCulled = false;
            if (part.material.transparent) mesh.renderOrder = 1;
            mesh.name = `${template.key}/${part.key}`;
            group.add(mesh);
            instanced++;
          }
        } else {
          for (const part of template.parts) {
            if (!batches.has(part.key)) batches.set(part.key, { material: part.material, entries: [] });
            const entries = batches.get(part.key).entries;
            for (const matrix of matrices) entries.push({ geometry: part.geometry, matrix });
          }
        }
      }
      for (const [key, { material, entries }] of batches) {
        const mesh = new THREE.Mesh(bakeGeometries(entries), material);
        mesh.userData.ownGeometry = true;
        mesh.castShadow = !material.transparent;
        mesh.receiveShadow = true;
        if (material.transparent) mesh.renderOrder = 1;
        mesh.name = `lot/${key}`;
        group.add(mesh);
      }
      Object.assign(stats, { templates: templates.size, items: count, meshes: group.children.length, instanced, batched: batches.size, materials: materials.size });
      stats.geometries = group.children.length + templates.size;
      return group;
    },
    /** Libère ce que le groupe possède (lots, tampons d'instances) ; les gabarits et matériaux restent dans la bibliothèque. */
    release(group) {
      group?.traverse((node) => {
        if (node.isInstancedMesh) node.dispose();
        else if (node.userData?.ownGeometry) node.geometry.dispose();
      });
    },
    dispose() {
      disposeAll();
      paletteId = null;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Caméra                                                             */
/* ------------------------------------------------------------------ */

/**
 * Position de la caméra pour cadrer le plan (les murs, ou toute la grille si le plan est vide).
 * `mode` : « perspective » (vue oblique) ou « top » (vue du dessus, x vers la droite, z vers le bas comme sur le plan).
 * @returns {{ target: [number, number, number], position: [number, number, number] }}
 */
export function computeFraming(plan, aspect, fovDeg = 45, mode = 'perspective', height = 0) {
  const extent = getPlanExtent(plan);
  const cx = (extent.minX + extent.maxX) / 2;
  const cz = (extent.minZ + extent.maxZ) / 2;
  const W = Math.max(extent.maxX - extent.minX, MIN_FRAME_W);
  const D = Math.max(extent.maxZ - extent.minZ, MIN_FRAME_D);
  const vertical = THREE.MathUtils.degToRad(fovDeg);
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * aspect);
  const target = [cx, height * 0.35, cz];
  if (mode === 'top') {
    const distance = Math.max(D / 2 / Math.tan(vertical / 2), W / 2 / Math.tan(horizontal / 2)) * 1.2 + height;
    return { target, position: [cx, distance, cz + distance * 0.0005] }; // à peine décalée : l'orientation reste définie
  }
  const radius = Math.hypot(W, D, height * 0.8) / 2;
  const distance = (radius / Math.sin(Math.min(vertical, horizontal) / 2)) * 0.72;
  const direction = new THREE.Vector3(0.35, 0.85, 0.55).normalize();
  return {
    target,
    position: [cx + direction.x * distance, height * 0.35 + direction.y * distance, cz + direction.z * distance],
  };
}

/* ------------------------------------------------------------------ */
/* Moteur de rendu et vue                                             */
/* ------------------------------------------------------------------ */

/**
 * Crée le moteur de rendu en essayant des réglages de plus en plus prudents :
 * certains navigateurs (Firefox sur ordinateur surtout) refusent le contexte WebGL demandé
 * avec antialiasing ou « haute performance » alors qu'un contexte simple fonctionne.
 * Chaque essai utilise un canvas neuf : un canvas dont la création a échoué n'est pas réutilisable.
 */
export function createRenderer() {
  const attempts = [
    { antialias: true, powerPreference: 'high-performance' },
    { antialias: true },
    { antialias: false },
  ];
  let reason = '';
  for (const options of attempts) {
    const canvas = document.createElement('canvas');
    canvas.addEventListener('webglcontextcreationerror', (event) => {
      reason = event.statusMessage || reason;
    });
    try {
      return new THREE.WebGLRenderer({ canvas, alpha: true, ...options });
    } catch (error) {
      reason = reason || String(error?.message ?? error);
    }
  }
  throw new Error(`WebGL indisponible${reason ? ` (${reason})` : ''}`);
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Luminaires : point de lumière au-dessus du sol de l'objet (m), intensité (cd) et portée (m). */
const LAMP_SPECS = {
  'ceiling-light': { lift: -0.3, fromCeiling: true, intensity: 16, distance: 7 },
  'floor-lamp': { lift: 1.5, intensity: 8, distance: 5.5 },
  'table-lamp': { lift: 0.4, intensity: 4, distance: 4 },
};
const NIGHT_SKY = '#0b1830';
const NIGHT_BG = '#04080f';

/**
 * Crée la vue 3D dans un conteneur. Lève une erreur si WebGL est indisponible.
 * Renvoie { resize, refreshTheme, requestRender, setView, getView, setWallMode, getWallMode, setLevelView, getLevelView, getSunReport,
 * getLightingInfo, startWalk, stopWalk, captureCanvas, exportGLB, destroy… }.
 * @param {HTMLElement} container
 * @param {ReturnType<typeof import('./store.js').createStore>} store
 */
export function createViewer3D(container, store) {
  const renderer = createRenderer();
  const coarse = Boolean(window.matchMedia?.('(pointer: coarse)').matches);
  const MAX_RATIO = coarse ? 1.5 : 2; // un téléphone dessine 1,5 pixel par pixel CSS au plus : les images sont deux fois plus légères qu'à 2
  let pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_RATIO);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0); // fond transparent : le dégradé est celui du conteneur (CSS)
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // le décor est immobile : la carte d'ombres n'est refaite que quand il change (shadowDirty)
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Vue 3D du logement : murs, ouvertures, étages et sols des pièces');
  container.prepend(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.3, 400);
  container.__renderer = renderer; // accès pour les mesures de performance (verify/perf.py)
  container.__scene = scene;
  container.__camera = camera;

  const shadowSize = coarse ? 1024 : 2048; // plus léger sur téléphone
  const sky = new THREE.HemisphereLight(0xffffff, 0x8392a0, 1.15);
  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  scene.add(sky, sun, sun.target);

  // Luminaires : un petit nombre de lumières ponctuelles, réparties sur les luminaires les plus proches de la caméra (ou du marcheur).
  const MAX_LAMPS = coarse ? 3 : 5;
  const lampLights = Array.from({ length: MAX_LAMPS }, () => {
    const light = new THREE.PointLight(0xffd9a3, 0, 6, 2);
    light.visible = false;
    scene.add(light);
    return light;
  });

  const controls = new OrbitControls(camera, canvas);
  controls.screenSpacePanning = false; // le déplacement reste horizontal
  controls.maxPolarAngle = Math.PI / 2 - 0.03; // la caméra ne passe pas sous le sol
  controls.minDistance = 2;
  controls.maxDistance = 120;

  let palette = readPalette();
  const materials = createMaterials(palette);
  const textures = createTextureFactory(renderer.capabilities.getMaxAnisotropy?.() ?? 1, coarse);
  let world = null;
  let structure = null; // { group, boxes, levels: number[] }
  const furnitureGroups = new Map(); // niveau → { items, preset, group }
  const library = createFurnitureLibrary();
  const tintMaterials = new Map(); // matière « tint:<niveau>:<pièce> » → matériau (couleur ou texture des murs de la pièce)
  const tintSpecs = new Map(); // matière « tint:… » → { level, roomId, roomKey, furnished }
  const finishMaterials = new Map(); // matière « floor:<finition> » / « baseboard:<id> » → matériau
  let gridKey = '';
  let view = 'perspective';
  let wallMode = 'full'; // 'full' | 'lowered' | 'auto' (murs extérieurs devant la caméra masqués)
  let levelView = 'upto'; // 'upto' : jusqu'au niveau actif ; 'all' : tout le bâtiment ; 'solo' : le niveau actif seul
  let framedOnce = false;
  let shadowDirty = true;
  let pending = false;
  let rebuildTimer = 0;
  let rebuilds = 0;
  let built = { levels: null, level: -1, grid: null, wallHeight: 0, style: null, shown: '' }; // ce que la dernière reconstruction a affiché
  let bounds = { minX: 0, maxX: 8, minZ: 0, maxZ: 6, height: 2.5 };
  let lamps = [];
  let lampsOn = false;
  let lighting = null; // dernier éclairage appliqué (document.lighting)
  const compass = buildCompass();
  scene.add(compass);

  /* ---- Visite à la première personne (état ; voir « Visite » plus bas) ---- */
  const walk = {
    active: false, x: 0, z: 0, y: 0, level: 0, yaw: 0, pitch: 0, stickX: 0, stickY: 0,
    keys: new Set(), building: null, dirty: true, saved: null, raf: 0, last: 0, listeners: new Set(),
  };

  /* ---- Mesures du rendu (compteur de debug) ---- */
  const frames = []; // dates des derniers rendus, en ms
  const stats = { calls: 0, triangles: 0, geometries: 0, frameMs: 0, fps: 0, pixelRatio, renders: 0 };
  let slowFrames = 0;
  let fastFrames = 0;

  function recordFrame(started, withShadow) {
    const now = performance.now();
    const ms = now - started;
    frames.push(now);
    while (frames.length && now - frames[0] > 1000) frames.shift();
    stats.renders++;
    stats.frameMs = stats.frameMs ? stats.frameMs * 0.8 + ms * 0.2 : ms;
    stats.fps = frames.length;
    if (!withShadow) {
      stats.calls = renderer.info.render.calls;
      stats.triangles = renderer.info.render.triangles;
    }
    stats.geometries = renderer.info.memory.geometries;
    stats.pixelRatio = pixelRatio;
    // Résolution adaptative : si les images restent lentes pendant qu'on bouge, on baisse la définition ; si elles sont rapides, on la remonte.
    if (frames.length >= 2 && now - frames[frames.length - 2] < 120) {
      if (ms > 40) {
        fastFrames = 0;
        if (++slowFrames >= 8 && pixelRatio > 0.75) setPixelRatio(Math.max(0.75, pixelRatio - 0.25));
      } else if (ms < 14) {
        slowFrames = 0;
        if (++fastFrames >= 90 && pixelRatio < Math.min(window.devicePixelRatio || 1, MAX_RATIO)) setPixelRatio(Math.min(MAX_RATIO, pixelRatio + 0.25));
      } else {
        slowFrames = 0;
        fastFrames = 0;
      }
    }
  }

  function setPixelRatio(next) {
    pixelRatio = next;
    slowFrames = 0;
    fastFrames = 0;
    renderer.setPixelRatio(next);
    resize();
  }

  function renderNow() {
    const withShadow = shadowDirty;
    if (shadowDirty) {
      renderer.shadowMap.needsUpdate = true;
      shadowDirty = false;
    }
    const started = performance.now();
    renderer.render(scene, camera);
    recordFrame(started, withShadow);
    container.dataset.geometries = String(renderer.info.memory.geometries);
  }

  /** Rendu à la demande : une image seulement quand quelque chose a changé. */
  function requestRender() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      renderNow();
    });
  }
  controls.addEventListener('change', () => {
    if (wallMode === 'auto' && !walk.active) applyAutoWalls();
    if (lampsOn) updateLamps();
    requestRender();
  });

  /* ---- Emprise du bâtiment, soleil, ciel, luminaires, boussole ---- */

  /** Emprise de tous les niveaux (les niveaux sans mur ne comptent pas) et hauteur du bâtiment. */
  function computeBounds(doc) {
    let box = null;
    doc.levels.forEach((_, index) => {
      const extent = getPlanExtent(levelPlan(doc, index), 1);
      if (extent.empty && box) return;
      box = !box || box.empty ? { ...extent } : { minX: Math.min(box.minX, extent.minX), maxX: Math.max(box.maxX, extent.maxX), minZ: Math.min(box.minZ, extent.minZ), maxZ: Math.max(box.maxZ, extent.maxZ), empty: false };
    });
    const rise = stairRise(doc.wallHeight);
    return { ...box, height: (doc.levels.length - 1) * rise + doc.wallHeight };
  }

  function buildCompass() {
    const group = new THREE.Group();
    group.name = 'boussole';
    const flat = new THREE.MeshBasicMaterial({ color: 0x566774, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.46, 40), flat);
    ring.rotation.x = -Math.PI / 2;
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.4, 16), new THREE.MeshBasicMaterial({ color: 0xd8443c, depthWrite: false }));
    arrow.rotation.x = -Math.PI / 2; // la pointe vers −z (le nord quand le plan n'est pas tourné)
    arrow.position.set(0, 0.02, -0.2);
    group.add(ring, arrow);
    try {
      const label = document.createElement('canvas');
      label.width = 64;
      label.height = 64;
      const ctx = label.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#d8443c';
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('N', 32, 34);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(label), depthWrite: false, transparent: true }));
        sprite.scale.set(0.5, 0.5, 1);
        sprite.position.set(0, 0.05, -0.8);
        group.add(sprite);
      }
    } catch {
      /* pas de canvas : la flèche seule */
    }
    group.position.y = 0.02;
    return group;
  }

  const sunVector = new THREE.Vector3(0.4, 0.8, 0.3);
  const warm = new THREE.Color(0xff9a5a);
  const white = new THREE.Color(0xfff6e8);
  const daySky = new THREE.Color();
  const dayGround = new THREE.Color();
  const nightSkyColor = new THREE.Color(0x5a76b4);
  const nightGround = new THREE.Color(0x151a26);

  /** Réglage du soleil (direction, couleur, intensité, carte d'ombres), du ciel, du fond et des luminaires d'après document.lighting. */
  function applyLighting() {
    const { doc } = store.getState();
    lighting = doc.lighting ?? DEFAULT_LIGHTING;
    const settings = { ...DEFAULT_LIGHTING, ...lighting };
    const position = sunPosition(settings);
    const direction = sunDirection(position, settings.north);
    sunVector.set(direction.x, direction.y, direction.z).normalize();
    const day = smooth(-0.05, 0.3, position.elevation); // 0 : nuit, 1 : plein jour
    sun.intensity = 2 * smooth(0, 0.22, position.elevation);
    sun.color.copy(warm).lerp(white, smooth(0, 0.5, position.elevation));
    sun.castShadow = sun.intensity > 0.02;
    daySky.set(0xffffff);
    dayGround.set(0x8392a0);
    sky.color.copy(nightSkyColor).lerp(daySky, day);
    sky.groundColor.copy(nightGround).lerp(dayGround, day);
    sky.intensity = 0.16 + 0.99 * day;
    fitSun();
    lampsOn = settings.lamps === 'on' || (settings.lamps === 'auto' && position.elevation < 0.06);
    updateLamps();
    applyBackground(day);
    const north = (settings.north * Math.PI) / 180;
    compass.rotation.y = -north;
    compass.position.set(bounds.maxX + 0.9, 0.02, bounds.minZ + 0.6);
    container.dataset.sunElevation = position.elevation.toFixed(3);
    container.dataset.lamps = lampsOn ? '1' : '0';
    shadowDirty = true;
    requestRender();
  }

  /** La carte d'ombres du soleil couvre la sphère qui entoure le bâtiment, quelle que soit la direction des rayons. */
  function fitSun() {
    const W = bounds.maxX - bounds.minX;
    const D = bounds.maxZ - bounds.minZ;
    const center = new THREE.Vector3((bounds.minX + bounds.maxX) / 2, bounds.height / 2, (bounds.minZ + bounds.maxZ) / 2);
    const radius = Math.max(Math.hypot(W, D, bounds.height) / 2 + 0.5, 4);
    sun.target.position.copy(center);
    sun.position.copy(center).addScaledVector(sunVector, radius + 2);
    const shadowCamera = sun.shadow.camera;
    shadowCamera.left = -radius;
    shadowCamera.right = radius;
    shadowCamera.top = radius;
    shadowCamera.bottom = -radius;
    shadowCamera.near = 0.5;
    shadowCamera.far = radius * 2 + 6;
    shadowCamera.updateProjectionMatrix();
    shadowDirty = true;
  }

  const mixHex = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t).getStyle();
  /** Le dégradé du ciel (CSS) s'assombrit la nuit ; en plein jour c'est celui du thème. */
  function applyBackground(day) {
    const t = 1 - day;
    if (t < 0.01) {
      container.style.removeProperty('background');
      scene.fog = new THREE.Fog(new THREE.Color(palette.background), 60, 190);
      return;
    }
    const top = mixHex(palette.sky, NIGHT_SKY, t);
    const bottom = mixHex(palette.background, NIGHT_BG, t);
    container.style.background = `linear-gradient(to bottom, ${top}, ${bottom})`;
    scene.fog = new THREE.Fog(new THREE.Color(bottom), 60, 190);
  }
  let lastDay = 1;

  /** Luminaires des niveaux affichés, en coordonnées de la scène. */
  function collectLamps(doc, shown) {
    const list = [];
    for (const index of shown) {
      const view = levelPlan(doc, index);
      const base = levelElevation(doc, index);
      for (const item of view.furniture) {
        const spec = LAMP_SPECS[item.defId];
        if (!spec) continue;
        const y = spec.fromCeiling ? view.wallHeight + spec.lift : (item.y ?? 0) + spec.lift;
        list.push({ x: item.x, y: base + y, z: item.z, spec });
      }
    }
    return list;
  }

  /** Les lumières ponctuelles se posent sur les luminaires les plus proches du point regardé (cible de la caméra, ou marcheur). */
  function updateLamps() {
    const focus = walk.active ? { x: walk.x, z: walk.z } : { x: controls.target.x, z: controls.target.z };
    const chosen = lampsOn
      ? [...lamps].sort((a, b) => (a.x - focus.x) ** 2 + (a.z - focus.z) ** 2 - ((b.x - focus.x) ** 2 + (b.z - focus.z) ** 2)).slice(0, MAX_LAMPS)
      : [];
    lampLights.forEach((light, i) => {
      const lamp = chosen[i];
      const visible = Boolean(lamp);
      if (light.visible !== visible) light.visible = visible;
      if (!lamp) return;
      light.position.set(lamp.x, lamp.y, lamp.z);
      light.intensity = lamp.spec.intensity;
      light.distance = lamp.spec.distance;
    });
  }

  function frame(plan, mode = view) {
    const { target, position } = computeFraming(plan, camera.aspect, camera.fov, mode, shownHeight());
    controls.target.set(...target);
    camera.position.set(...position);
    controls.update();
    requestRender();
  }

  function applyTheme() {
    palette = readPalette();
    applyMaterialPalette(materials, palette);
    if (world) applyPalette(world, palette);
    applyBackground(lastDay);
  }

  function refreshTheme() {
    applyTheme();
    updateTints();
    requestRender();
  }

  function loadWorld(plan) {
    if (world) {
      scene.remove(world);
      disposeWorld(world);
    }
    world = buildWorld(plan, palette);
    scene.add(world);
  }

  /* ---- Niveaux affichés ---- */

  function shownLevels(doc, level) {
    const n = doc.levels.length;
    const mode = walk.active ? 'all' : levelView;
    if (mode === 'solo') return [level];
    const last = mode === 'all' ? n - 1 : level;
    return Array.from({ length: last + 1 }, (_, i) => i);
  }

  function shownHeight() {
    const { doc, level } = store.getState();
    const shown = shownLevels(doc, level);
    return (shown[shown.length - 1]) * stairRise(doc.wallHeight) + doc.wallHeight;
  }

  /** Crée au besoin les matériaux des finitions utilisées par ces boîtes (sols finis, plinthes). */
  function ensureMaterials(boxes) {
    for (const key of new Set(boxes.map((box) => box.material))) {
      if (materials.has(key) || finishMaterials.has(key)) continue;
      if (key.startsWith('floor:')) {
        const finish = finishById(FLOOR_FINISHES, key.slice('floor:'.length));
        if (finish) finishMaterials.set(key, floorFinishMaterial(finish, textures));
      } else if (key.startsWith('stair:')) {
        const [, finishId, part] = key.split(':');
        const finish = STAIR_FINISHES.find((item) => item.id === finishId);
        if (finish?.[part]) {
          const metal = part === 'metal' || part === 'steel';
          finishMaterials.set(key, new THREE.MeshStandardMaterial({ color: finish[part], roughness: part === 'steel' ? 0.3 : metal ? 0.45 : 0.7, metalness: part === 'steel' ? 0.85 : metal ? 0.5 : 0 }));
        }
      } else if (key.startsWith('baseboard:')) {
        const finish = finishById(BASEBOARD_FINISHES, key.slice('baseboard:'.length));
        if (finish?.color) finishMaterials.set(key, new THREE.MeshStandardMaterial({ color: finish.color, roughness: 0.6, metalness: 0 }));
      }
    }
  }
  const materialMap = () => new Proxy(materials, {
    get(target, prop) {
      if (prop === 'get') return (key) => target.get(key) ?? finishMaterials.get(key);
      const value = Reflect.get(target, prop);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  /** Groupe Three d'un niveau (murs, ouvertures, sols, escaliers, peaux de murs, plinthes), posé à l'altitude du niveau. */
  function buildLevelGroup(doc, index, { maxHeight = Infinity, auto = false } = {}) {
    const plan = levelPlan(doc, index);
    const rooms = store.getRooms(index);
    const furnished = plan.furniture.length > 0;
    const skins = Object.values(plan.roomFinishes ?? {}).some((finish) => finish.wall || finish.baseboard);
    const result = buildStructure(plan, { maxHeight, rooms, tints: furnished || skins, upper: index > 0 });
    let boxes = auto ? tagExteriorBoxes(plan, result.boxes, rooms) : result.boxes;
    const keyById = new Map(rooms.map((room) => [room.id, roomKey(room)]));
    boxes = boxes.map((box) => {
      if (box.kind !== 'tint') return box;
      const key = `tint:${index}:${box.roomId}`;
      tintSpecs.set(key, { level: index, roomId: box.roomId, roomKey: keyById.get(box.roomId), furnished });
      return { ...box, material: key };
    });
    ensureMaterials(boxes);
    updateTints(boxes);
    const group = buildStructureGroup({ boxes, wallHeight: result.wallHeight }, materialMap());
    group.name = `niveau-${index}`;
    group.position.y = levelElevation(doc, index);
    return { group, boxes };
  }

  /** Reconstruit les murs, ouvertures et sols de tous les niveaux affichés ; les anciennes géométries sont libérées. */
  function rebuild() {
    rebuildTimer = 0;
    const state = store.getState();
    const { doc, level } = state;
    const shown = shownLevels(doc, level);
    const root = new THREE.Group();
    root.name = 'structure';
    const all = [];
    for (const index of shown) {
      const { group, boxes } = buildLevelGroup(doc, index, { maxHeight: wallMode === 'lowered' && !walk.active ? LOWERED_WALL_HEIGHT : Infinity, auto: wallMode === 'auto' });
      root.add(group);
      all.push(...boxes);
    }
    if (structure) {
      scene.remove(structure.group);
      disposeGeometries(structure.group);
    }
    scene.add(root);
    structure = { group: root, boxes: all, levels: shown };
    bounds = computeBounds(doc);
    built = { levels: doc.levels, level, grid: doc.grid, wallHeight: doc.wallHeight, style: doc.style, shown: shown.join(',') };
    updateTints();
    shadowDirty = true;
    walk.dirty = true;
    rebuilds++;
    container.dataset.rebuilds = String(rebuilds);
    container.dataset.boxes = String(all.length);
    container.dataset.levels = String(doc.levels.length);
    container.dataset.shown = shown.join(',');
    rebuildFurniture(doc, shown);
    lamps = collectLamps(doc, shown);
    applyLighting();
    if (wallMode === 'auto' && !walk.active) applyAutoWalls();
    requestRender();
  }

  /**
   * Mode « murs automatiques » : les murs extérieurs qui se trouvent entre la caméra et le logement (la caméra est de leur côté
   * extérieur) sont masqués ; les autres restent. La carte d'ombres est refaite seulement quand l'ensemble masqué change.
   */
  let hiddenKey = '';
  function applyAutoWalls() {
    if (!structure?.group) return;
    const cam = camera.position;
    const margin = 0.05;
    let key = '';
    structure.group.traverse((mesh) => {
      const ext = mesh.userData?.exterior;
      if (!ext) return;
      const outside =
        ext.side === 'n' ? cam.z < ext.line - margin
        : ext.side === 's' ? cam.z > ext.line + margin
        : ext.side === 'w' ? cam.x < ext.line - margin
        : cam.x > ext.line + margin;
      mesh.visible = !outside;
      if (outside) key += `${ext.side}${ext.line},`;
    });
    if (key !== hiddenKey) {
      hiddenKey = key;
      shadowDirty = true;
    }
  }

  /** Couleur d'une peinture ou texture de mur : finition choisie pour la pièce, sinon couleur de la palette du logement (variée par pièce). */
  function wallAppearance(spec, doc) {
    const finish = doc.levels[spec.level]?.roomFinishes?.[spec.roomKey]?.wall;
    if (finish) {
      const entry = finishById(WALL_FINISHES, finish);
      if (entry) return { color: new THREE.Color(entry.color), texture: entry.kind === 'texture' ? textures.get(entry) : null, white: entry.kind === 'texture' };
      return { color: new THREE.Color(finish), texture: null, white: false }; // couleur libre « #rrggbb »
    }
    if (spec.furnished) return { color: roomWallColor(doc.style.preset, doc.style.seed, spec.roomId), texture: null, white: false };
    return { color: new THREE.Color(palette.wall), texture: null, white: false };
  }

  /** Couleurs des murs : matériau « wall » à la couleur de la palette, un matériau par pièce pour les peaux (couleur, peinture ou texture). */
  function updateTints(boxes = null) {
    const { doc } = store.getState();
    const furnished = doc.levels.some((level) => level.furniture.length > 0);
    materials.get('wall').color.set(furnished ? getPalette(doc.style.preset).wall : palette.wall);
    const used = new Set();
    for (const [key, spec] of tintSpecs) if (spec.level < doc.levels.length) used.add(key);
    if (boxes) {
      for (const box of boxes) if (box.kind === 'tint') used.add(box.material);
    } else {
      for (const key of [...tintMaterials.keys()]) {
        if (structure?.boxes.some((box) => box.material === key)) continue;
        tintMaterials.get(key).dispose();
        tintMaterials.delete(key);
        tintSpecs.delete(key);
      }
    }
    for (const key of used) {
      const spec = tintSpecs.get(key);
      if (!spec) continue;
      let material = tintMaterials.get(key);
      if (!material) {
        material = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
        tintMaterials.set(key, material);
      }
      const look = wallAppearance(spec, doc);
      material.color.copy(look.white ? new THREE.Color(0xffffff) : look.color);
      if (material.map !== look.texture) {
        material.map = look.texture;
        material.needsUpdate = true;
      }
      finishMaterials.set(key, material);
    }
  }

  /** Le mobilier de chaque niveau affiché : reconstruit seulement quand la liste ou la palette change. */
  function rebuildFurniture(doc, shown) {
    const preset = doc.style.preset;
    for (const [index, entry] of [...furnitureGroups]) {
      if (shown.includes(index)) continue;
      scene.remove(entry.group);
      library.release(entry.group);
      furnitureGroups.delete(index);
      shadowDirty = true;
    }
    let total = 0;
    let meshes = 0;
    for (const index of shown) {
      const items = levelPlan(doc, index).furniture;
      const old = furnitureGroups.get(index);
      if (!old || old.items !== items || old.preset !== preset) {
        if (old) {
          scene.remove(old.group);
          library.release(old.group);
          furnitureGroups.delete(index);
        }
        if (items.length) {
          const group = library.build(items, { palette: preset });
          group.position.y = levelElevation(doc, index);
          scene.add(group);
          furnitureGroups.set(index, { items, preset, group });
        }
        shadowDirty = true;
      }
      total += items.length;
      meshes += furnitureGroups.get(index)?.group.children.length ?? 0;
    }
    container.dataset.furniture = String(total);
    container.dataset.furnitureMeshes = String(meshes);
  }

  /** Reconstruction groupée : plusieurs modifications en moins de 100 ms ne coûtent qu'une reconstruction. */
  function scheduleRebuild() {
    if (rebuildTimer) clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(rebuild, REBUILD_DELAY_MS);
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return; // panneau masqué (onglet Plan sur téléphone)
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (!framedOnce) {
      frame(store.getState().plan);
      framedOnce = true;
    }
    requestRender();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(container);

  const keyOf = (grid) => `${grid.width}x${grid.height}x${grid.cellSize}`;
  const unsubscribe = store.subscribeUi((state) => {
    const { doc, level } = state;
    walk.dirty = true;
    if (keyOf(doc.grid) !== gridKey) {
      gridKey = keyOf(doc.grid);
      loadWorld(state.plan);
      frame(state.plan); // la grille a changé de taille : on cadre à nouveau
    }
    const structural = doc.levels !== built.levels || level !== built.level || doc.wallHeight !== built.wallHeight || doc.style !== built.style || doc.grid !== built.grid || shownLevels(doc, level).join(',') !== built.shown;
    if (structural) scheduleRebuild();
    else if (doc.lighting !== lighting) applyLighting();
  });

  canvas.addEventListener('webglcontextlost', (event) => event.preventDefault());
  canvas.addEventListener('webglcontextrestored', requestRender);

  const initialState = store.getState();
  gridKey = keyOf(initialState.doc.grid);
  applyTheme();
  loadWorld(initialState.plan);
  rebuild();
  resize();

  /** Image du rendu sur le fond dégradé, prête à être enregistrée. */
  function captureCanvas() {
    renderer.render(scene, camera); // le tampon est lu aussitôt après : pas besoin de preserveDrawingBuffer
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, out.height);
    gradient.addColorStop(0, container.style.background ? mixHex(palette.sky, NIGHT_SKY, 1 - lastDay) : palette.sky);
    gradient.addColorStop(1, container.style.background ? mixHex(palette.background, NIGHT_BG, 1 - lastDay) : palette.background);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0);
    return out;
  }

  /* ---- Visite à la première personne ---- */

  const WALK_SPEED = 1.5; // m/s
  const WALK_RUN = 2.6;
  const WALK_TURN = 1.9; // rad/s (flèches gauche / droite)
  const LOOK_SENSITIVITY = 0.0045; // rad par pixel glissé
  const WALK_FOV = 70;
  const lookPointers = new Map();
  let walkWall = null; // mode des murs avant la visite, rétabli ensuite

  const notifyWalk = () => {
    for (const listener of walk.listeners) listener(walk.active, walk.level);
  };

  function walkBuilding() {
    if (walk.dirty || !walk.building) {
      const { doc } = store.getState();
      walk.building = buildWalkBuilding(doc, (i) => store.getRooms(i));
      walk.dirty = false;
      if (walk.level >= doc.levels.length) walk.level = doc.levels.length - 1;
    }
    return walk.building;
  }

  function placeWalkCamera() {
    walk.pitch = Math.max(-1.2, Math.min(1.2, walk.pitch));
    camera.position.set(walk.x, walk.y + WALK_EYE_HEIGHT, walk.z);
    camera.rotation.set(walk.pitch, walk.yaw, 0, 'YXZ');
  }

  function walkInput() {
    const k = walk.keys;
    const forward = (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0) - (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - walk.stickY;
    const strafe = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0) + walk.stickX;
    const turn = (k.has('ArrowLeft') ? 1 : 0) - (k.has('ArrowRight') ? 1 : 0);
    return { forward, strafe, turn, run: k.has('ShiftLeft') || k.has('ShiftRight') };
  }

  /** Avance le marcheur de `delta` (mètres) dans le bâtiment ; renvoie vrai s'il a changé de niveau. */
  function moveWalk(delta) {
    const next = stepWalker(walkBuilding(), { level: walk.level, x: walk.x, z: walk.z }, delta);
    walk.x = next.x;
    walk.z = next.z;
    walk.y = next.y;
    if (next.level === walk.level) return false;
    walk.level = next.level;
    notifyWalk();
    return true;
  }

  function walkTick(time) {
    walk.raf = 0;
    if (!walk.active) return;
    const dt = Math.min((time - walk.last) / 1000, 0.05) || 0;
    walk.last = time;
    const { forward, strafe, turn, run } = walkInput();
    walk.yaw += turn * WALK_TURN * dt;
    const length = Math.hypot(forward, strafe);
    if (length > 0.01) {
      const scale = Math.min(1, length) / length;
      const speed = (run ? WALK_RUN : WALK_SPEED) * dt;
      const fx = -Math.sin(walk.yaw);
      const fz = -Math.cos(walk.yaw);
      const rx = Math.cos(walk.yaw);
      const rz = -Math.sin(walk.yaw);
      moveWalk({ x: (fx * forward + rx * strafe) * scale * speed, z: (fz * forward + rz * strafe) * scale * speed });
      if (lampsOn) updateLamps();
    }
    placeWalkCamera();
    renderNow();
    if (length > 0.01 || turn !== 0) walk.raf = requestAnimationFrame(walkTick);
  }

  /** Relance la boucle de déplacement (elle s'arrête d'elle-même quand plus rien ne bouge : rendu à la demande). */
  function kickWalk() {
    if (!walk.active || walk.raf) return;
    walk.last = performance.now();
    walk.raf = requestAnimationFrame(walkTick);
  }

  const typing = (event) => /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName ?? '') || event.target?.isContentEditable;
  const WALK_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight']);

  function onWalkKeyDown(event) {
    if (!walk.active || typing(event) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'Escape') {
      stopWalk();
      return;
    }
    if (!WALK_KEYS.has(event.code)) return;
    event.preventDefault();
    event.stopPropagation();
    walk.keys.add(event.code);
    kickWalk();
  }

  function onWalkKeyUp(event) {
    if (walk.keys.delete(event.code) && walk.active) event.preventDefault();
  }

  const clearWalkKeys = () => walk.keys.clear();
  // En phase de capture : les raccourcis de l'éditeur (W = mur, E = gomme…) ne doivent pas se déclencher pendant la visite.
  window.addEventListener('keydown', onWalkKeyDown, true);
  window.addEventListener('keyup', onWalkKeyUp, true);
  window.addEventListener('blur', clearWalkKeys);

  canvas.addEventListener('pointerdown', (event) => {
    if (!walk.active) return;
    lookPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    const last = lookPointers.get(event.pointerId);
    if (!last || !walk.active) return;
    walk.yaw += (event.clientX - last.x) * LOOK_SENSITIVITY;
    walk.pitch += (event.clientY - last.y) * LOOK_SENSITIVITY;
    lookPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    placeWalkCamera();
    requestRender();
  });
  const endLook = (event) => lookPointers.delete(event.pointerId);
  canvas.addEventListener('pointerup', endLook);
  canvas.addEventListener('pointercancel', endLook);

  /**
   * Entre dans la visite : caméra à 1,60 m, dans la pièce demandée du niveau actif (sinon le séjour). Les murs restent à leur hauteur
   * et tous les niveaux s'affichent (on peut monter). Pas de verrouillage du pointeur (souvent bloqué dans un artefact) : on regarde en glissant.
   */
  function startWalk({ roomId = null } = {}) {
    if (walk.active) return true;
    const { level } = store.getState();
    walk.dirty = true;
    const building = walkBuilding();
    const start = findBuildingWalkStart(building, level, (i) => store.getRooms(i), { roomId });
    walk.saved = { position: camera.position.clone(), target: controls.target.clone(), fov: camera.fov, near: camera.near };
    walkWall = wallMode === 'lowered' ? 'lowered' : null;
    walk.active = true;
    if (walkWall) wallMode = 'full';
    if (rebuildTimer) clearTimeout(rebuildTimer);
    rebuild(); // tous les niveaux, murs à leur hauteur
    structure?.group?.traverse((mesh) => {
      mesh.visible = true;
    });
    hiddenKey = '';
    shadowDirty = true;
    controls.enabled = false;
    camera.fov = WALK_FOV;
    camera.near = 0.08;
    camera.updateProjectionMatrix();
    walk.level = start.level;
    walk.x = start.x;
    walk.z = start.z;
    walk.y = start.y;
    walk.yaw = start.yaw;
    walk.pitch = 0;
    walk.stickX = 0;
    walk.stickY = 0;
    walk.keys.clear();
    placeWalkCamera();
    updateLamps();
    container.dataset.walk = '1';
    notifyWalk();
    requestRender();
    return true;
  }

  function stopWalk() {
    if (!walk.active) return;
    walk.active = false;
    if (walk.raf) cancelAnimationFrame(walk.raf);
    walk.raf = 0;
    walk.keys.clear();
    lookPointers.clear();
    walk.stickX = 0;
    walk.stickY = 0;
    camera.rotation.order = 'XYZ';
    camera.fov = walk.saved.fov;
    camera.near = walk.saved.near;
    camera.updateProjectionMatrix();
    camera.position.copy(walk.saved.position);
    controls.target.copy(walk.saved.target);
    controls.enabled = true;
    controls.update();
    if (walkWall) {
      wallMode = walkWall;
      walkWall = null;
    }
    if (rebuildTimer) clearTimeout(rebuildTimer);
    rebuild();
    updateLamps();
    delete container.dataset.walk;
    notifyWalk();
    requestRender();
  }

  /**
   * Scène 3D au format glTF binaire (.glb), à leur hauteur réelle (même quand la vue montre les murs abaissés ou un seul niveau) :
   * murs, ouvertures, sols (textures comprises), escaliers et mobilier de TOUS les niveaux, sans lumières ni ciel. GLTFExporter est
   * chargé à la demande depuis vendor/.
   * @returns {Promise<ArrayBuffer>}
   */
  async function exportGLB() {
    if (rebuildTimer) {
      clearTimeout(rebuildTimer);
      rebuild();
    }
    const { GLTFExporter } = await import(`${CDN}/examples/jsm/exporters/GLTFExporter.js`);
    const { doc } = store.getState();
    const group = new THREE.Group();
    group.name = 'maison-3d';
    const own = [];
    const furniture = [];
    doc.levels.forEach((_, index) => {
      const { group: levelGroup } = buildLevelGroup(doc, index);
      own.push(...levelGroup.children);
      group.add(levelGroup);
      const items = levelPlan(doc, index).furniture;
      if (items.length) {
        const pieces = library.build(items, { palette: doc.style.preset });
        pieces.position.y = levelElevation(doc, index);
        furniture.push(pieces);
        group.add(pieces);
      }
    });
    try {
      return await new Promise((resolve, reject) => {
        new GLTFExporter().parse(group, resolve, reject, { binary: true, onlyVisible: true, maxTextureSize: 1024 });
      });
    } finally {
      for (const mesh of own) mesh.geometry?.dispose();
      for (const pieces of furniture) library.release(pieces);
      updateTints();
    }
  }

  /** Réglages d'éclairage tels qu'appliqués : élévation du soleil, jour ou nuit, luminaires allumés. */
  function getLightingInfo() {
    const settings = { ...DEFAULT_LIGHTING, ...(store.getState().doc.lighting ?? {}) };
    const position = sunPosition(settings);
    return { ...settings, elevation: position.elevation, azimuth: position.azimuth, day: position.elevation > 0, lampsOn, lampCount: lamps.length, sunIntensity: sun.intensity };
  }

  return {
    resize,
    refreshTheme,
    requestRender,
    exportGLB,
    /** « top » : vue du dessus ; « perspective » : vue oblique. Recadre sur le plan. */
    setView(next) {
      view = next === 'top' ? 'top' : 'perspective';
      frame(store.getState().plan, view);
    },
    getView: () => view,
    /** « full » : murs à leur hauteur ; « lowered » : murs abaissés à 0,3 m pour voir l'intérieur ; « auto » : murs extérieurs devant la caméra masqués. */
    setWallMode(next) {
      const mode = next === 'lowered' || next === 'auto' ? next : 'full';
      if (mode === wallMode) return;
      wallMode = mode;
      hiddenKey = '';
      if (rebuildTimer) clearTimeout(rebuildTimer);
      rebuild();
    },
    /** « upto » : le niveau actif et ceux du dessous ; « all » : tout le bâtiment ; « solo » : le niveau actif seul. */
    setLevelView(next) {
      const mode = next === 'all' || next === 'solo' ? next : 'upto';
      if (mode === levelView) return;
      levelView = mode;
      if (rebuildTimer) clearTimeout(rebuildTimer);
      rebuild();
      frame(store.getState().plan);
    },
    getLevelView: () => levelView,
    startWalk,
    stopWalk,
    isWalking: () => walk.active,
    /** Joystick virtuel : x à droite, y vers le bas (−1 à 1) ; (0, 0) = au repos. */
    setWalkStick(x, y) {
      walk.stickX = Math.max(-1, Math.min(1, x));
      walk.stickY = Math.max(-1, Math.min(1, y));
      kickWalk();
    },
    /** Appelle `listener(actif, niveau)` quand la visite commence, se termine ou change de niveau ; renvoie une fonction pour se désabonner. */
    onWalkChange(listener) {
      walk.listeners.add(listener);
      return () => walk.listeners.delete(listener);
    },
    /** Position du marcheur (mètres), niveau, altitude du sol et direction, pour les tests et le debug. */
    getWalkState: () => ({ active: walk.active, x: walk.x, z: walk.z, y: walk.y, level: walk.level, yaw: walk.yaw, pitch: walk.pitch }),
    /** Déplace le marcheur de `delta` (mètres) sans passer par le clavier : tests et boutons. Renvoie son état. */
    walkBy(delta) {
      if (!walk.active) return null;
      moveWalk(delta);
      placeWalkCamera();
      renderNow();
      return { x: walk.x, z: walk.z, y: walk.y, level: walk.level };
    },
    /** Mesures du dernier rendu : appels de dessin, triangles, géométries, ms par image, images par seconde, résolution. */
    getRenderStats: () => ({ ...stats, shadows: !renderer.shadowMap.autoUpdate ? 'statiques' : 'à chaque image' }),
    getWallMode: () => wallMode,
    captureCanvas,
    /** Nombre d'objets du plan affichés (niveaux visibles) et de maillages (appels de dessin) qui les dessinent. */
    getFurnitureCount: () => Number(container.dataset.furniture ?? 0),
    getFurnitureStats: () => ({ ...library.stats, meshes: [...furnitureGroups.values()].reduce((sum, entry) => sum + entry.group.children.length, 0) }),
    getLightingInfo,
    /** Ensoleillement des pièces du niveau actif (voir computeSunReport) : heures de soleil direct par pièce, part éclairée à l'heure réglée. */
    getSunReport(index = store.getState().level) {
      const { doc } = store.getState();
      return computeSunReport(doc, index, (i) => store.getRooms(i));
    },
    /** Ce que la dernière reconstruction a affiché (même sans attendre l'anti-rebond). */
    flush() {
      if (rebuildTimer) {
        clearTimeout(rebuildTimer);
        rebuild();
      }
    },
    destroy() {
      stopWalk();
      window.removeEventListener('keydown', onWalkKeyDown, true);
      window.removeEventListener('keyup', onWalkKeyUp, true);
      window.removeEventListener('blur', clearWalkKeys);
      clearTimeout(rebuildTimer);
      for (const entry of furnitureGroups.values()) library.release(entry.group);
      library.dispose();
      for (const material of tintMaterials.values()) material.dispose();
      for (const [key, material] of finishMaterials) if (!tintMaterials.has(key)) material.dispose();
      textures.dispose();
      observer.disconnect();
      unsubscribe();
      controls.dispose();
      disposeWorld(world);
      disposeGeometries(structure?.group);
      for (const material of materials.values()) material.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Catalogue : un seul moteur de rendu pour tous les plateaux tournants */
/* ------------------------------------------------------------------ */

/**
 * Vue du catalogue. Un seul canvas WebGL (donc un seul contexte, léger sur téléphone) est posé sur la grille
 * défilante ; chaque case de la grille (un élément HTML) reçoit son objet sur un plateau tournant, dessiné dans la
 * zone de cette case (viewport + scissor). Les cases hors de l'écran ne sont pas dessinées.
 * @param {HTMLElement} scroller conteneur défilant (position: relative) qui contient les cases
 * @returns {{ setItems, start, stop, setSpin, destroy }}
 */
export function createCatalogViewer(scroller) {
  const renderer = createRenderer();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.className = 'catalog-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  scroller.prepend(canvas);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8392a0, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.015;
  scene.add(sun, sun.target);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100);
  const three = { THREE, RoundedBoxGeometry };

  let cells = [];
  let raf = 0;
  let running = false;
  let spin = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let lastTime = 0;
  let sizeKey = '';

  function disposeObject(object) {
    object.traverse((node) => {
      node.geometry?.dispose();
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) material?.dispose();
    });
  }

  function clearCells() {
    for (const cell of cells) {
      scene.remove(cell.stage);
      disposeObject(cell.stage);
    }
    cells = [];
  }

  /**
   * Remplace les objets affichés.
   * @param {{ def: import('./furniture.js').FurnitureDef, el: HTMLElement }[]} items un objet par case
   * @param {{ palette: import('./furniture.js').Palette, variations: boolean, seed: number }} options
   */
  function setItems(items, { palette, variations, seed }) {
    clearCells();
    for (const { def, el } of items) {
      const object = buildFurniture(def, createBuildContext(three, { palette, variations, seed: hashSeed(`${seed}:${def.id}`) }));
      const { w, d, h } = def.size;
      const discR = Math.max(w, d) / 2 * 1.25 + 0.06;
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(discR, discR, 0.02, 48), new THREE.MeshStandardMaterial({ color: palette.floor, roughness: 0.9 }));
      disc.position.y = -0.01;
      disc.receiveShadow = true;
      const turn = new THREE.Group();
      turn.rotation.y = -0.6;
      turn.add(object);
      const stage = new THREE.Group();
      stage.visible = false;
      stage.add(disc, turn);
      scene.add(stage);
      cells.push({ def, el, stage, turn, radius: Math.max(discR, Math.hypot(Math.hypot(w, d) / 2, h / 2)), height: h });
    }
    sizeKey = '';
    draw();
  }

  function draw() {
    const w = scroller.clientWidth;
    const h = scroller.clientHeight;
    if (!w || !h) return;
    const key = `${w}x${h}`;
    if (key !== sizeKey) {
      renderer.setSize(w, h, false);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      sizeKey = key;
    }
    canvas.style.transform = `translateY(${scroller.scrollTop}px)`; // le canvas reste calé sur la zone visible
    const rect = scroller.getBoundingClientRect();
    const left = rect.left + scroller.clientLeft;
    const bottom = rect.top + scroller.clientTop + h;
    renderer.setScissorTest(false);
    renderer.clear();
    renderer.setScissorTest(true);
    let shown = null;
    for (const cell of cells) {
      const r = cell.el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom < rect.top || r.top > rect.bottom) continue;
      if (shown) shown.stage.visible = false;
      shown = cell;
      cell.stage.visible = true;
      const x = r.left - left;
      const y = bottom - r.bottom;
      renderer.setViewport(x, y, r.width, r.height);
      renderer.setScissor(x, y, r.width, r.height);
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
      const half = Math.min(THREE.MathUtils.degToRad(camera.fov) / 2, Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect));
      const distance = (cell.radius / Math.sin(half)) * 0.92;
      const elevation = THREE.MathUtils.degToRad(24);
      const targetY = Math.min(cell.height / 2, 0.9);
      camera.position.set(0, targetY + distance * Math.sin(elevation), distance * Math.cos(elevation));
      camera.lookAt(0, targetY, 0);
      sun.position.set(cell.radius * 1.6, cell.radius * 2.6, cell.radius * 1.9);
      sun.target.position.set(0, targetY, 0);
      const shadowCamera = sun.shadow.camera;
      const reach = cell.radius * 1.4;
      shadowCamera.left = -reach;
      shadowCamera.right = reach;
      shadowCamera.top = reach;
      shadowCamera.bottom = -reach;
      shadowCamera.near = 0.1;
      shadowCamera.far = cell.radius * 8;
      shadowCamera.updateProjectionMatrix();
      renderer.render(scene, camera);
    }
    if (shown) shown.stage.visible = false;
  }

  function frame(time) {
    raf = 0;
    if (!running) return;
    const dt = Math.min((time - lastTime) / 1000, 0.1) || 0;
    lastTime = time;
    if (spin) for (const cell of cells) cell.turn.rotation.y += dt * 0.7;
    if (!document.hidden) draw();
    raf = requestAnimationFrame(frame);
  }

  return {
    setItems,
    /** Démarre l'animation (à appeler quand le catalogue est visible). */
    start() {
      if (running) return;
      running = true;
      lastTime = performance.now();
      raf = requestAnimationFrame(frame);
    },
    /** Arrête l'animation (catalogue masqué) : plus aucun rendu. */
    stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
    setSpin(value) {
      spin = Boolean(value);
    },
    draw,
    destroy() {
      this.stop();
      clearCells();
      renderer.dispose();
      canvas.remove();
    },
  };
}
