// furniture-kit.js — boîte à outils commune aux fichiers du catalogue (furniture*.js) : raccourcis de données et outils de construction.
// Pas d'import de Three.js : il arrive par le contexte de construction (ctx.THREE).

/** Raccourci : { type, weight }. */
export const rt = (type, weight) => ({ type, weight });
/** Raccourci pour `placement`. */
export const place = (mode, clearanceFront = 0, clearanceSides = 0, canOverlap = [], extra = {}) => ({
  mode,
  clearanceFront,
  clearanceSides,
  canOverlap,
  ...extra,
});

export const RUGS = ['rug-s', 'rug-m', 'rug-l'];
/** Petits objets posés sur un meuble : lampes, plantes, et la déco de surface (livres, vase, fruits, bougies). */
export const SURFACE_DECOR = ['table-lamp', 'plant-small'];
export const TABLE_DECOR = ['fruit-bowl', 'vase', 'candles'];

/**
 * Plusieurs modèles pour un même objet : `builders` est la liste des constructeurs, tous dans la même boîte (taille annoncée).
 * Le modèle est tiré avec le hasard de l'objet (donc différent d'une génération à l'autre) ; `ctx.model` force un modèle (tests,
 * catalogue). Sans variations (hasard neutre), c'est toujours le premier. `.models` donne le nombre de modèles.
 */
export function withModels(builders) {
  const build = (ctx) => {
    const n = builders.length;
    const index = ctx.model !== undefined ? ((ctx.model % n) + n) % n : ctx.rng.neutral ? 0 : ctx.rng.int(0, n - 1);
    return builders[index](ctx);
  };
  build.models = builders.length;
  return build;
}

/* ------------------------------------------------------------------ */
/* Outils de construction                                              */
/* ------------------------------------------------------------------ */

/**
 * Petite boîte à outils au-dessus de Three.js : boîtes, boîtes arrondies, cylindres, ellipsoïdes, avec des
 * matériaux partagés et les ombres activées. Les coordonnées sont (x, bas, z) : `y` est la hauteur du bas de la pièce.
 */
export function makeKit(ctx, parent = null, cache = new Map()) {
  const T = ctx.THREE;
  const RoundedBox = ctx.RoundedBoxGeometry;
  const root = new T.Group();
  if (parent) parent.add(root);

  const mat = (color, o = {}) => {
    const key = `${color}|${o.rough ?? 0.8}|${o.metal ?? 0}|${o.opacity ?? 1}|${o.emissive ?? ''}`;
    let material = cache.get(key);
    if (!material) {
      material = new T.MeshStandardMaterial({ color, roughness: o.rough ?? 0.8, metalness: o.metal ?? 0 });
      if (o.opacity !== undefined && o.opacity < 1) {
        material.transparent = true;
        material.opacity = o.opacity;
        material.depthWrite = false;
      }
      if (o.emissive) {
        material.emissive = new T.Color(o.emissive);
        material.emissiveIntensity = o.emissiveIntensity ?? 0.6;
      }
      cache.set(key, material);
    }
    return material;
  };

  const add = (geometry, x, y, z, color, o = {}) => {
    const mesh = new T.Mesh(geometry, mat(color, o));
    mesh.position.set(x, y, z);
    mesh.castShadow = !(o.opacity !== undefined && o.opacity < 1);
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };

  return {
    root,
    mat,
    /** Sous-groupe positionné et tourné autour de y (pour une chaise autour d'une table). */
    sub(x = 0, z = 0, rotationY = 0) {
      const child = makeKit(ctx, root, cache);
      child.root.position.set(x, 0, z);
      child.root.rotation.y = rotationY;
      return child;
    },
    box: (w, h, d, x, y, z, color, o) => add(new T.BoxGeometry(w, h, d), x, y + h / 2, z, color, o),
    rbox: (w, h, d, r, x, y, z, color, o) =>
      add(new RoundedBox(w, h, d, 2, Math.max(0.002, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3))), x, y + h / 2, z, color, o),
    cyl: (rTop, rBottom, h, x, y, z, color, o, segments = 24) => add(new T.CylinderGeometry(rTop, rBottom, h, segments), x, y + h / 2, z, color, o),
    ell(rx, ry, rz, x, yCenter, z, color, o) {
      const mesh = add(new T.SphereGeometry(1, 16, 12), x, yCenter, z, color, o);
      mesh.scale.set(rx, ry, rz);
      return mesh;
    },
    /** Géométrie Three.js quelconque (tore, cylindre à 4 pans…) posée en (x, centre y, z). */
    mesh: (geometry, x, yCenter, z, color, o) => add(geometry, x, yCenter, z, color, o),
    /** Tige cylindrique de rayon r entre deux points (cadre de vélo, pied d'chevalet…). */
    tube(a, b, r, color, o, segments = 8) {
      const from = new T.Vector3(...a);
      const to = new T.Vector3(...b);
      const length = from.distanceTo(to);
      const mid = from.clone().add(to).multiplyScalar(0.5);
      const mesh = add(new T.CylinderGeometry(r, r, length, segments), mid.x, mid.y, mid.z, color, o);
      mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), to.clone().sub(from).normalize());
      return mesh;
    },
    /** Mélange deux couleurs hexadécimales : t = 0 renvoie a, t = 1 renvoie b. */
    mix: (a, b, t) => `#${new T.Color(a).lerp(new T.Color(b), t).getHexString()}`,
  };
}

/** Cadre rectangulaire (quatre bandes) : (x, y bas, z) est le centre bas. */
export function frameRect(k, { w, h, d, border, x = 0, y = 0, z = 0, color }) {
  k.box(w, border, d, x, y, z, color);
  k.box(w, border, d, x, y + h - border, z, color);
  k.box(border, h - 2 * border, d, x - w / 2 + border / 2, y + border, z, color);
  k.box(border, h - 2 * border, d, x + w / 2 - border / 2, y + border, z, color);
}

/**
 * Caisson générique : pieds, corps, plateau, portes ou tiroirs en façade (tout reste dans la boîte w × d × h).
 * (x, z) = centre du caisson.
 */
export function cabinet(k, { w, d, h, leg = 0.1, x = 0, z = 0, body, front, top, topT = 0.03, doors = 0, drawers = 0, legColor, handle, plinth = false }) {
  const bodyH = h - leg - topT;
  if (leg > 0) {
    if (plinth) k.box(w - 0.06, leg, d - 0.06, x, 0, z, legColor ?? front);
    else for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.04, leg, 0.04, x + sx * (w / 2 - 0.05), 0, z + sz * (d / 2 - 0.05), legColor ?? front);
  }
  k.box(w, bodyH, d, x, leg, z, body);
  k.box(w, topT, d, x, leg + bodyH, z, top ?? body);
  const faceZ = z + d / 2 - 0.006;
  if (doors > 0) {
    const slot = (w - 0.04) / doors;
    for (let i = 0; i < doors; i++) {
      const cx = x - w / 2 + 0.02 + (i + 0.5) * slot;
      k.box(slot - 0.01, bodyH - 0.04, 0.012, cx, leg + 0.02, faceZ, front);
      if (handle) k.box(0.015, 0.12, 0.02, cx + (i % 2 ? -1 : 1) * (slot / 2 - 0.05), leg + bodyH / 2, z + d / 2 - 0.01, handle);
    }
  }
  if (drawers > 0) {
    const slot = (bodyH - 0.04) / drawers;
    for (let i = 0; i < drawers; i++) {
      k.box(w - 0.04, slot - 0.01, 0.012, x, leg + 0.02 + i * slot, faceZ, front);
      if (handle) k.box(0.14, 0.015, 0.02, x, leg + 0.02 + i * slot + slot / 2, z + d / 2 - 0.01, handle);
    }
  }
}

/** Chaise de salle à manger dans un sous-kit (avant = +Z). 0,42 × 0,42, dossier à 0,9 m. */
export function diningChair(k, colors) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.035, 0.43, 0.035, sx * 0.1785, 0, sz * 0.1785, colors.leg);
  k.rbox(0.42, 0.04, 0.42, 0.012, 0, 0.43, 0, colors.seat);
  k.rbox(0.42, 0.43, 0.03, 0.012, 0, 0.47, -0.195, colors.back);
}

