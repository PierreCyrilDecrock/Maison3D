// ui.js — assemblage de l'interface : barre d'outils, raccourcis, onglets, cartouche, panneau de tests, thème.
import {
  BASEBOARD_FINISHES,
  DEFAULT_LIGHTING,
  FLOOR_FINISHES,
  OPENING_LABELS,
  PLAN_LIMITS,
  ROOM_GROUPS,
  ROOM_TYPES,
  ROOM_TYPE_INFO,
  TEMPLATES,
  WALL_FINISHES,
  buildTemplate,
  createEmptyDocument,
  detectRooms,
  drawFinishPattern,
  exportPlanText,
  extractShareCode,
  fileSlug,
  finishById,
  getRoomFinish,
  getRoomName,
  getRoomType,
  isRoomLocked,
  levelPlan,
  openingHeight,
  openingSill,
  openingSpanLimits,
  parsePlanText,
  roomColor,
  roomLabel,
  stairBreadth,
  stairKind,
  stairPathLength,
  stairResizePatch,
  stairRise,
  stairRun,
  stairStepCount,
  stairUnder,
  stairAcross,
  stairSteps,
  stairRail,
  stairFinish,
  stairWallBacked,
  STAIR_FINISHES,
  STAIR_FRAMES,
  sunPosition,
  updateOpening,
  zipStore,
} from './core.js';
import { FURNITURE_IDS, autosave, createProjects, createStorage, createStore } from './store.js';
import { createEditor2D } from './editor2d.js';
import { FURNITURE_CATEGORIES, FURNITURE_DEFS, PALETTES, PLACEMENT_LABELS, getPalette, variantsOf } from './furniture.js';
import { RECIPES, ROLE_LABELS, buildShare, readShare } from './generator.js';
import { runTests } from './tests.js';

/**
 * Tous les libellés de l'interface, regroupés ici pour faciliter une traduction : les clés plates servent au code, les groupes
 * (header, view, walk, welcome, tour, help, files, toast, templates…) sont posés dans le HTML par les attributs data-l,
 * data-l-title, data-l-aria et data-l-ph (voir applyLabels). Une langue = une copie de cet objet. Restent dans leurs modules, car
 * ce sont des données : les noms de pièces et d'objets (core.js, furniture.js) et les messages de validation des fichiers (core.js).
 */
export const LABELS = {
  noCanvas: 'Le plan 2D n\'a pas pu démarrer : le Canvas est indisponible dans ce navigateur.',
  no3d: 'La vue 3D n\'a pas pu démarrer. Three.js est chargé depuis Internet : vérifiez votre connexion et que WebGL est activé dans le navigateur.',
  noWebgl: 'La vue 3D n\'a pas pu démarrer : WebGL est indisponible. Dans Firefox, vérifiez Paramètres > Général > Performances (accélération matérielle), que webgl.disabled est sur false dans about:config, et désactivez la protection renforcée contre le pistage pour cette page.',
  testsCrash: 'Les tests n\'ont pas pu s\'exécuter.',
  pass: 'Réussi : ',
  fail: 'Échec : ',
  saveReady: 'Automatique',
  saveRestored: 'Plan restauré',
  savePending: 'Enregistrement…',
  saveUnavailable: 'Indisponible ici',
  noRooms: 'Aucune',
  openOutline: 'Ce contour de murs ne ferme aucune pièce : fermez-le pour créer une pièce.',
  openOutlines: (n) => `${n} contours de murs ne ferment aucune pièce : fermez-les pour créer des pièces.`,

  tools: {
    furniture: 'Mobilier',
    furnitureTitle: 'Mobilier (M) : toucher un meuble pour le déplacer ou le modifier, ou choisir un objet du catalogue pour l\'ajouter',
    stair: 'Escalier',
    stairTitle: 'Escalier (S) : toucher le plan pour poser un escalier qui monte au niveau du dessus',
  },
  levels: {
    group: 'Niveaux et grille',
    tabs: 'Niveau affiché',
    add: '+ Niveau',
    addTitle: 'Ajouter un niveau au-dessus des autres',
    added: (name) => `Niveau « ${name} » ajouté.`,
    name: 'Nom',
    nameAria: 'Nom du niveau affiché',
    removeAria: 'Supprimer le niveau',
    removeTitle: 'Supprimer le niveau affiché, avec ses murs, ses meubles et ses escaliers',
    keep: 'Garder',
    remove: 'Supprimer',
    confirmRemove: (name, stairs) => `Supprimer « ${name} » avec ses murs, ses meubles et ses escaliers ?${stairs ? ' L\'escalier du niveau d\'en dessous est retiré aussi.' : ''} Le bouton Annuler permet de le retrouver.`,
    clearAll: 'Tout effacer ? Le logement revient à un seul niveau vide. Le bouton Annuler permet de le retrouver.',
    viewGroup: 'Niveaux affichés en 3D',
    viewUpto: 'Jusqu\'ici',
    viewUptoTitle: 'Le niveau affiché et ceux du dessous',
    viewAll: 'Tous',
    viewAllTitle: 'Tout le bâtiment',
    viewSolo: 'Seul',
    viewSoloTitle: 'Le niveau affiché seul',
  },
  grid: {
    group: 'Pas de la grille',
    label: 'Grille',
    coarseTitle: 'Pas de 0,5 m : dessin rapide',
    fineTitle: 'Pas de 0,1 m : murs, portes, fenêtres et meubles au dixième de mètre',
    keep: 'Garder',
    convert: 'Convertir',
    nowFine: 'Grille de 0,1 m : les murs, les ouvertures et les meubles se placent au dixième de mètre.',
    nowCoarse: 'Grille de 0,5 m.',
    failed: 'Le pas de la grille n\'a pas pu changer.',
    confirm: (exact, lost) => {
      const parts = [];
      if (!exact) parts.push('Les murs tracés au dixième de mètre sont alignés sur la grille de 50 cm.');
      const gone = [];
      if (lost.walls) gone.push(`${lost.walls} mur${lost.walls > 1 ? 's' : ''}`);
      if (lost.openings) gone.push(`${lost.openings} ouverture${lost.openings > 1 ? 's' : ''}`);
      if (lost.furniture) gone.push(`${lost.furniture} objet${lost.furniture > 1 ? 's' : ''}`);
      if (gone.length) parts.push(`Ne tiennent plus et disparaissent : ${gone.join(', ')}.`);
      parts.push('Le bouton Annuler permet de revenir en arrière.');
      return parts.join(' ');
    },
  },
  stair: {
    panel: 'Propriétés de l\'escalier',
    rotateTitle: 'Tourner d\'un quart de tour (R)',
    rotate: 'Tourner',
    flipTitle: 'Inverser le sens de la montée',
    flip: 'Inverser',
    delete: 'Supprimer',
    close: 'Fermer le panneau de l\'escalier',
    widthGroup: 'Largeur de l\'escalier',
    width: 'Largeur',
    narrower: 'Réduire la largeur',
    wider: 'Augmenter la largeur',
    runGroup: 'Longueur de la montée',
    run: 'Montée',
    shorter: 'Raccourcir la montée',
    longer: 'Allonger la montée',
    title: (from, to) => `Escalier · ${from} → ${to}`,
    newLevel: 'niveau créé au-dessus',
    placeHint: (from) => `Touchez le plan pour poser un escalier qui monte de « ${from} » au niveau du dessus (R pour tourner).`,
    rule: (steps, riser) => `Il faut ${steps} marches de ${Number(riser).toFixed(1).replace('.', ',')} cm pour monter d\'un étage.`,
    steps: (steps, riser, tread) => `${steps} marches · hauteur ${Number(riser).toFixed(1).replace('.', ',')} cm · giron ${Number(tread).toFixed(1).replace('.', ',')} cm. L\'étage du dessus est percé d\'une trémie, protégée par un garde-corps.`,
    kindGroup: 'Style de l\'escalier',
    kindLabel: 'Style',
    kinds: { straight: 'Droit', l: 'En L', u: 'En U', spiral: 'Colimaçon' },
    kindTitles: {
      straight: 'Escalier droit',
      l: 'Escalier quart tournant, en L : un quart de tour avec un palier',
      u: 'Escalier demi-tour, en U : deux volées et un palier, on repart dans l\'autre sens',
      spiral: 'Escalier en colimaçon : marches autour d\'un noyau, il prend peu de place',
    },
    stepsGroup: 'Marches de l\'escalier',
    stepsLabel: 'Marches',
    steps_: {
      solid: 'Plein',
      stringer: 'Crémaillère',
      spine: 'Limon central',
      floating: 'Flottantes',
    },
    stepsTitles: {
      solid: 'Plein + rangements : un bloc plein avec des placards dessous',
      stringer: 'Limon crémaillère : marches fines sur deux limons en dents de scie : le dessous est vide, on peut y poser des meubles bas',
      spine: 'Une poutre centrale en zigzag porte les marches : léger et graphique, le dessous est vide',
      floating: 'Des planches ancrées dans un mur, sans rien dessous : il faut un mur le long de l\'escalier',
      spiralOnly: 'Pas pour un colimaçon',
      needWall: 'Il faut un mur le long de l\'escalier',
    },
    railGroup: 'Garde-corps de l\'escalier',
    railLabel: 'Garde-corps',
    rails: {
      none: 'Aucun',
      handrail: 'Main courante',
      wood: 'Barreaux bois',
      metal: 'Barreaux acier',
      cable: 'Câbles inox',
      flat: 'Lisses',
      slats: 'Lames bois',
    },
    railHint: {
      none: 'Sans garde-corps, la visite reste bloquée sur les côtés libres.',
      handrail: 'Une rampe en bois sur quelques potelets fins.',
      wood: 'Barreaux verticaux en bois et main courante : classique et chaleureux.',
      metal: 'Fins barreaux d\'acier noir, très discrets.',
      cable: 'Quatre câbles inox tendus entre des poteaux : très ouvert.',
      flat: 'Lisses horizontales en fer plat, un style atelier.',
      slats: 'Lames de bois verticales serrées, façon claustra.',
    },
    finishGroup: 'Finition de l\'escalier',
    finishLabel: 'Finition',
    diameter: 'Diamètre',
    sideGroup: 'Longueur de la seconde volée',
    side: 'Côté',
    sideLess: 'Raccourcir la seconde volée',
    sideMore: 'Allonger la seconde volée',
    flipSpiralTitle: 'Tourner dans l\'autre sens',
    flipTurnTitle: 'Retourner l\'escalier en miroir (il tourne de l\'autre côté)',
    flipTitleDefault: 'Inverser le sens de la montée',
    kindFits: 'Ce style ne tient pas ici (mur, autre escalier ou limites de la grille).',
    cannotResize: 'L\'escalier ne tient pas avec cette taille (mur, autre escalier ou limites).',
    cannotRotate: 'L\'escalier ne peut pas pivoter ici (mur, autre escalier ou bord de la grille).',
  },
  item: {
    panel: 'Mobilier',
    title: 'Mobilier',
    close: 'Fermer le panneau du mobilier',
    rotateTitle: 'Tourner d\'un quart de tour (R)',
    rotate: 'Tourner',
    rerollTitle: 'Nouvelles couleurs et détails pour le même objet',
    reroll: 'Autre aspect',
    duplicate: 'Dupliquer',
    delete: 'Supprimer',
    replace: 'Remplacer par',
    replaceAria: 'Remplacer par une variante du catalogue',
    choose: 'Choisir…',
    noVariant: 'Aucune variante',
    locked: 'Pièce verrouillée : le générateur n\'y touche plus.',
    unlock: 'Déverrouiller',
    category: 'Catalogue',
    categoryAria: 'Catégorie du catalogue',
    gridAria: 'Objets du catalogue : toucher pour l\'ajouter',
    idleHint: 'Touchez un meuble du plan pour le modifier (glisser pour le déplacer), ou choisissez un objet du catalogue.',
    selectedHint: 'Glissez l\'objet pour le déplacer ; flèches : 10 cm (Maj : 50 cm) ; R : tourner ; Suppr : supprimer.',
    placing: (name) => `Touchez le plan pour poser « ${name} » (R : tourner, Échap : abandonner).`,
  },
  reasons: {
    stair: {
      size: 'dimensions hors limites (largeur 0,7 à 2,5 m, montée 2 à 8 m, colimaçon 1,4 à 3 m)',
      outside: 'l\'escalier sortirait de la grille',
      wall: 'un mur le traverse',
      opening: 'il boucherait une porte ou un passage',
      overlap: 'un autre escalier ou une trémie occupe la place',
      'wall-up': 'un mur de l\'étage du dessus le traverserait',
      'overlap-up': 'l\'étage du dessus a déjà un escalier ici',
      top: 'le nombre maximal de niveaux est atteint',
    },
    item: {
      unknown: 'objet inconnu',
      outside: 'il faut rester dans une pièce',
      wall: 'contre un mur',
      door: 'devant une porte',
      window: 'devant une fenêtre',
      opening: 'dans une ouverture',
      object: 'un autre objet occupe la place',
      stair: 'sur un escalier ou une trémie',
      clearance: 'pas assez de dégagement',
    },
  },
  finish: {
    panel: 'Finitions de la pièce',
    reset: 'Par défaut',
    close: 'Fermer le panneau des finitions',
    floor: 'Sol',
    floorAria: 'Sol de la pièce',
    wall: 'Murs',
    wallAria: 'Murs de la pièce',
    custom: 'Autre couleur',
    customAria: 'Couleur libre des murs',
    baseboard: 'Plinthes',
    baseboardAria: 'Plinthes de la pièce',
    byType: 'Selon le type de pièce',
    byStyle: 'Selon le style du logement',
    title: (room) => `Finitions · ${room}`,
    sun: (hours, month) => `Soleil direct en ${month} : ${hours.toFixed(1).replace('.', ',')} h.`,
  },
  light: {
    group: 'Soleil et éclairage',
    hour: 'Heure',
    hourAria: 'Heure du jour : position du soleil et ombres',
    month: 'Mois',
    monthAria: 'Mois : hauteur du soleil dans l\'année',
    north: 'Nord',
    northAria: 'Orientation du logement : angle du nord par rapport au haut du plan',
    lamps: 'Lampes',
    lampsAria: 'Luminaires : automatiques la nuit, allumés ou éteints',
    lampsAuto: 'Auto (la nuit)',
    lampsOn: 'Allumées',
    lampsOff: 'Éteintes',
    lampsLit: ' · luminaires allumés',
    report: 'Ensoleillement',
    reportTitle: 'Heures de soleil direct de chaque pièce du niveau affiché',
    reportHeading: 'Ensoleillement des pièces',
    reportClose: 'Fermer le panneau de l\'ensoleillement',
    latitude: 'Latitude (°)',
    latitudeAria: 'Latitude du logement en degrés (48,9 : Paris)',
    reportHint: 'Soleil direct calculé toutes les demi-heures, à travers les fenêtres et les portes ; murs, planchers et plafonds font de l\'ombre. Trait bleu : l\'heure réglée. Les ombres de la vue 3D restent figées.',
    night: 'Nuit',
    sunAt: (degrees) => `Soleil à ${degrees}° au-dessus de l\'horizon`,
    day: (month, rise, set, level) => `${level} · en ${month} : lever ${rise}, coucher ${set} (heure solaire).`,
    noSun: (month) => `En ${month}, le soleil ne se lève pas à cette latitude.`,
    sunHours: (hours) => `${hours.toFixed(1).replace('.', ',')} h de soleil direct`,
    barAria: (hours, now) => `${hours.toFixed(1).replace('.', ',')} heures de soleil direct ; à l\'heure réglée, ${now} % de la pièce est au soleil`,
    noRooms: 'Aucune pièce fermée à ce niveau.',
  },
  header: {
    share: 'Partager',
    shareTitle: 'Copie le lien de partage du plan (le mobilier est régénéré à l\'ouverture)',
    help: 'Aide',
    helpTitle: 'Aide : gestes, raccourcis, partage',
  },
  view: {
    wallsAuto: 'Murs auto',
    wallsAutoTitle: 'Murs automatiques : les murs extérieurs situés entre la caméra et l\'intérieur sont masqués quand vous tournez autour du logement',
    walk: 'Visite',
    walkTitle: 'Visite à la première personne : caméra à hauteur d\'yeux (1,60 m), on se déplace dans le logement',
    tourGroup: 'Visite',
  },
  walk: {
    exit: '← Vue d\'ensemble',
    hintTouch: 'Joystick pour avancer · glissez sur l\'image pour regarder',
    hintKeys: 'Z Q S D ou flèches pour avancer (← → tournent) · Maj pour courir · glissez pour regarder · avancez sur un escalier pour monter · Échap pour sortir',
    stick: 'Joystick : se déplacer',
    started: (room) => `Visite commencée${room ? ` : ${room}` : ''}. Les murs et les meubles arrêtent le marcheur ; les escaliers montent et descendent.`,
    level: (name) => `Niveau : ${name}`,
    ended: 'Retour à la vue d\'ensemble.',
  },
  welcome: {
    title: 'Bienvenue dans Maison 3D',
    intro: 'Partez d\'un modèle, ou d\'un plan vide : dessinez les murs, nommez les pièces, voyez le logement en 3D et laissez le générateur le meubler.',
    blank: 'Plan vide',
    skip: 'Plus tard',
    close: 'Fermer l\'écran d\'accueil',
    open: (label) => `Modèle « ${label} » chargé.`,
    pieces: (n) => `${n} pièce${n > 1 ? 's' : ''}`,
    templateAria: (label, description) => `${label} : ${description} Charger ce modèle.`,
  },
  templates: {
    studio: { label: 'Studio', description: 'Une pièce de vie et une salle d\'eau, 30 m².' },
    t2: { label: 'T2', description: 'Séjour, cuisine, chambre et salle de bain, 60 m².' },
    t3: { label: 'T3', description: 'Séjour, cuisine, deux chambres, salle de bain et couloir, 77 m².' },
    house4: { label: 'Maison de 4 pièces', description: 'Grand séjour, cuisine, chambre et salle de bain, 96 m².' },
  },
  tour: {
    skip: 'Passer',
    prev: 'Précédent',
    next: 'Suivant',
    done: 'Terminer',
    step: (n, total) => `Étape ${n} sur ${total}`,
    steps: [
      { title: 'Tracer', text: 'Avec l\'outil Mur, glissez d\'un point à un autre sur la grille pour fermer une pièce. Les portes et fenêtres se posent avec les outils Porte, Fenêtre et Passage. Un modèle de départ vous évite de tout dessiner.' },
      { title: 'Nommer', text: 'Avec l\'outil Pièce, touchez une pièce fermée pour choisir son type (salon, chambre, cuisine…) et son nom. Le type guide le mobilier.' },
      { title: 'Étages et grille', text: 'Les onglets au-dessus du plan sont les niveaux : « + Niveau » en ajoute un, l\'outil Escalier les relie. Le pas de grille 0,1 m place murs et meubles au dixième de mètre.' },
      { title: 'Voir en 3D', text: 'La vue 3D montre le logement : glissez pour tourner, pincez pour zoomer. Essayez « Murs auto » ou « Visite » pour vous promener à hauteur d\'yeux. Sur téléphone, l\'onglet 3D ou « Plan + 3D ».' },
      { title: 'Générer', text: 'Dans la vue 3D, touchez Générer : chaque pièce est meublée avec la graine indiquée. Le dé tire un autre aménagement, le cadenas d\'une pièce la protège, et Annuler revient en arrière. L\'outil Mobilier retouche ensuite chaque objet à la main.' },
      { title: 'Soleil', text: 'Le curseur Heure déplace le soleil et les ombres des fenêtres ; Mois, Nord et Lampes complètent l\'éclairage. « Ensoleillement » donne les heures de soleil de chaque pièce, et les finitions (sol, murs, plinthes) se choisissent dans la liste des pièces.' },
    ],
  },
  help: {
    title: 'Aide',
    close: 'Fermer l\'aide',
    sections: [
      {
        title: 'Dessiner le plan (2D)',
        rows: [
          ['Mur', 'Glisser d\'un point de la grille à un autre.'],
          ['Gomme', 'Toucher un mur, ou glisser le long de plusieurs murs.'],
          ['Pièce', 'Toucher une pièce fermée : type et nom. Le panneau « Pièces » liste tout.'],
          ['Porte, Fenêtre, Passage', 'Toucher un mur pour voir l\'aperçu, toucher l\'aperçu pour poser ; Inverser change le côté d\'ouverture.'],
          ['Zoom et déplacement', 'Pincer, ou molette ; outil Main, ou Espace + glisser, pour déplacer la vue.'],
        ],
      },
      {
        title: 'Étages, grille fine, mobilier',
        rows: [
          ['Niveaux', 'Les onglets au-dessus du plan changent de niveau ; « + Niveau » en ajoute un. Un escalier posé sur un niveau crée le niveau du dessus s\'il manque, et perce son plancher.'],
          ['Escalier', 'Outil Escalier : toucher le plan pour poser, R ou « Tourner » pour changer le sens, largeur et longueur dans le panneau. Il faut 15 marches pour un étage.'],
          ['Grille fine', 'Le pas 0,1 m place murs, portes et fenêtres au dixième de mètre ; le pas 0,5 m dessine plus vite. Le changement convertit le logement (Annuler le défait).'],
          ['Mobilier', 'Outil Mobilier : glisser un meuble pour le déplacer, R pour le tourner, flèches pour le pousser de 10 cm. Le panneau remplace, duplique, supprime, ou ajoute un objet du catalogue. Une pièce retouchée est verrouillée : le générateur n\'y touche plus.'],
          ['Finitions', 'Toucher une pièce dans la liste ouvre ses finitions : sol, murs, plinthes. L\'aperçu est immédiat en 3D.'],
          ['Soleil', 'Sous la vue 3D : l\'heure déplace le soleil et ses ombres, le mois change sa hauteur, « Nord » oriente le logement, les lampes s\'allument la nuit. « Ensoleillement » donne les heures de soleil direct de chaque pièce.'],
        ],
      },
      {
        title: 'Vue 3D',
        rows: [
          ['Tourner, zoomer', 'Glisser, pincer ou molette ; deux doigts ou clic droit pour déplacer.'],
          ['Dessus / Perspective', 'Le plan vu d\'en haut, ou en vue oblique.'],
          ['Murs', 'Complets, abaissés (0,3 m), ou automatiques : les murs extérieurs devant la caméra disparaissent.'],
          ['Générer', 'Meuble le logement avec la graine du champ ; le dé en tire une autre ; le cadenas protège une pièce.'],
          ['Capture, export', 'Capture PNG de la vue 3D ; le panneau Projets exporte en .json, .png et .glb.'],
        ],
      },
      {
        title: 'Visite à la première personne',
        rows: [
          ['Téléphone', 'Joystick à gauche pour avancer, glisser sur l\'image pour regarder.'],
          ['Ordinateur', 'Z Q S D (ou W A S D) pour avancer et se décaler, flèches gauche et droite pour tourner, Maj pour courir, glisser à la souris pour regarder.'],
          ['Sortir', 'Bouton « Vue d\'ensemble » ou touche Échap.'],
          ['Obstacles', 'Les murs, les fenêtres et les meubles arrêtent le marcheur ; les portes et passages sont libres.'],
          ['Étages', 'Avancez sur un escalier pour monter ou descendre ; les trémies de l\'étage ont un garde-corps (jamais en verre) dans le style de l\'escalier.'],
        ],
      },
      {
        title: 'Raccourcis clavier',
        rows: [
          ['W · E · R · H', 'Mur · Gomme · Pièce · Main'],
          ['D · F · P · I', 'Porte · Fenêtre · Passage · Inverser'],
          ['M · S', 'Mobilier · Escalier (R tourne l\'objet ou l\'escalier)'],
          ['Ctrl+Z · Ctrl+Maj+Z', 'Annuler · Rétablir (Ctrl+Y aussi)'],
          ['Suppr', 'Supprimer l\'ouverture, l\'objet ou l\'escalier sélectionné'],
          ['Échap', 'Abandonner un tracé, désélectionner, sortir de la visite'],
          ['Ctrl+Maj+D', 'Afficher ou masquer le compteur de debug'],
        ],
      },
      {
        title: 'Enregistrer et partager',
        rows: [
          ['Enregistrement', 'Automatique dans ce navigateur, projet par projet (bouton Projets). Exportez en .json pour sauvegarder ailleurs.'],
          ['Bouton Partager', 'Copie un lien contenant le plan : celui qui l\'ouvre le reçoit comme nouveau projet, sans toucher à ses propres plans. Le mobilier est régénéré avec la même graine.'],
          ['Lien de l\'artefact', 'Le lien de cette page elle-même se partage depuis Claude (menu Partager de l\'artefact) : sans cela, personne d\'autre ne peut l\'ouvrir.'],
        ],
      },
    ],
    display: 'Affichage',
    theme: 'Thème',
    themeAuto: 'Auto',
    themeLight: 'Clair',
    themeDark: 'Sombre',
    debug: 'Compteur de debug (images par seconde, appels de dessin, triangles)',
    replayTour: 'Revoir le tutoriel',
    openWelcome: 'Modèles de départ',
  },
  toast: {
    shareCopied: (n) => `Lien de partage copié (${n.toLocaleString('fr-FR')} caractères).`,
    shareShown: 'La copie automatique est bloquée ici : copiez le lien affiché dans le panneau.',
    shareFailed: 'Le lien n\'a pas pu être créé : la bibliothèque de compression n\'a pas pu être chargée.',
  },
  perf: {
    line1: (s) => `${s.fps} i/s · ${s.frameMs.toFixed(1)} ms`,
    line2: (s) => `${s.calls} appels · ${s.triangles.toLocaleString('fr-FR')} triangles`,
    line3: (s) => `${s.geometries} géométries · ×${s.pixelRatio} · ombres ${s.shadows}`,
  },
};

/** Libellé d'un chemin de LABELS (« header.share »), ou le chemin lui-même s'il manque (visible dans les tests). */
export function label(path) {
  const value = path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), LABELS);
  return typeof value === 'string' ? value : path;
}

/** Pose les libellés dans le HTML : data-l (texte), data-l-title, data-l-aria (aria-label), data-l-ph (placeholder). */
export function applyLabels(root = document) {
  for (const [attr, set] of [
    ['data-l', (node, text) => { node.textContent = text; }],
    ['data-l-title', (node, text) => node.setAttribute('title', text)],
    ['data-l-aria', (node, text) => node.setAttribute('aria-label', text)],
    ['data-l-ph', (node, text) => node.setAttribute('placeholder', text)],
  ]) {
    for (const node of root.querySelectorAll(`[${attr}]`)) set(node, label(node.getAttribute(attr)));
  }
}

const GHOST_CLICK_MS = 250;

const nf = (digits) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const fmt1 = nf(1);
const fmt2 = nf(2);
const fmtLen = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

const $ = (id) => document.getElementById(id);

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function showNotice(id, message, detail) {
  const notice = $(id);
  if (!notice) return;
  notice.replaceChildren(el('p', '', message));
  if (detail) notice.append(el('code', '', detail));
  notice.hidden = false;
}

/** Remplit le cartouche d'informations à partir du plan. */
function renderStatus(plan, roomCount = 0) {
  const { width, height, cellSize } = plan.grid;
  const wallLength = plan.walls.length * cellSize;
  $('st-grid').textContent = `${width} × ${height} cases`;
  $('st-scale').textContent = `1 case = ${fmt2.format(cellSize)} m`;
  $('st-surface').textContent = `${fmt1.format(width * cellSize)} × ${fmt1.format(height * cellSize)} m`;
  $('st-walls').textContent = `${fmt2.format(plan.wallHeight)} m`;
  $('st-drawn').textContent = `${fmt1.format(wallLength)} m`;
  $('canvas-2d').setAttribute(
    'aria-label',
    `Plan 2D : grille de ${width} par ${height} cases, une case = ${fmt2.format(cellSize)} m, ${fmt1.format(wallLength)} m de murs tracés, ${roomCount} pièce${roomCount > 1 ? 's' : ''} fermée${roomCount > 1 ? 's' : ''}`,
  );
}

function renderSave(status) {
  const text = {
    ready: LABELS.saveReady,
    restored: LABELS.saveRestored,
    pending: LABELS.savePending,
    unavailable: LABELS.saveUnavailable,
    saved: status.at ? `Enregistré à ${timeFormat.format(status.at)}` : '',
  }[status.state];
  const cell = $('st-save');
  cell.textContent = text;
  cell.title =
    status.state === 'unavailable'
      ? 'Le navigateur bloque le stockage local : le plan n\'est pas conservé au rechargement.'
      : '';
}

/** Reflète l'état du store sur la barre d'outils : outil actif, annuler / rétablir, tout effacer, inverser. */
function renderToolbar(state) {
  for (const button of document.querySelectorAll('[data-tool]')) {
    button.setAttribute('aria-pressed', String(button.dataset.tool === state.tool));
  }
  $('btn-undo').disabled = !state.canUndo;
  $('btn-redo').disabled = !state.canRedo;
  $('btn-clear').disabled = state.plan.walls.length === 0 && state.doc.levels.length === 1 && state.plan.furniture.length === 0;
  $('btn-flip').disabled = !state.pendingOpening && !state.selectedOpeningId;
  $('chk-clearance').checked = state.showClearance;
  if ($('btn-clear').disabled) $('confirm-clear').hidden = true;
}

/** Inverse le côté d'ouverture de l'aperçu en attente, sinon de l'ouverture sélectionnée. */
function flipCurrent(store) {
  const { pendingOpening, selectedOpeningId } = store.getState();
  if (pendingOpening) store.actions.flipPendingOpening();
  else if (selectedOpeningId) store.actions.flipOpening(selectedOpeningId);
}

/** Boutons de la barre d'outils, avec confirmation intégrée à la page pour « Tout effacer ». */
function setupToolbar(store, getEditor) {
  for (const button of document.querySelectorAll('[data-tool]')) {
    button.addEventListener('click', () => store.actions.setTool(button.dataset.tool));
  }
  $('btn-undo').addEventListener('click', () => store.actions.undo());
  $('btn-redo').addEventListener('click', () => store.actions.redo());
  $('btn-fit').addEventListener('click', () => getEditor()?.fit());
  $('btn-flip').addEventListener('click', () => flipCurrent(store));
  $('chk-clearance').addEventListener('change', (event) => store.actions.showClearance(event.target.checked));

  const box = $('confirm-clear');
  const clearButton = $('btn-clear');
  const setConfirm = (open) => {
    box.hidden = !open;
    clearButton.setAttribute('aria-expanded', String(open));
    if (open) $('confirm-cancel').focus();
  };
  clearButton.addEventListener('click', () => setConfirm(box.hidden));
  $('confirm-cancel').addEventListener('click', () => {
    setConfirm(false);
    clearButton.focus();
  });
  $('confirm-ok').addEventListener('click', () => {
    store.actions.clearAll();
    setConfirm(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !box.hidden) {
      setConfirm(false);
      clearButton.focus();
    }
  });
}

/** Raccourcis clavier : W / E / R / H / D / F / P / M / S pour les outils, I inverser, Suppr supprimer l'ouverture, Ctrl+Z annuler, Ctrl+Maj+Z (ou Ctrl+Y) rétablir. */
function setupShortcuts(store) {
  const tools = { w: 'wall', e: 'erase', r: 'room', h: 'hand', d: 'door', f: 'window', p: 'passage', m: 'furniture', s: 'stair' };
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    if (target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? '')) return;
    if ($('stage-3d')?.dataset.walk && event.key !== 'Escape') return; // pendant la visite, les touches servent à se déplacer
    const key = event.key.toLowerCase();
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) store.actions.redo();
      else store.actions.undo();
    } else if (modifier && key === 'y') {
      event.preventDefault();
      store.actions.redo();
    } else if (!modifier && !event.altKey && key === 'r' && ['furniture', 'stair'].includes(store.getState().tool)) {
      // R tourne l'objet ou l'escalier (voir editor2d.js) : il ne change pas d'outil
    } else if (!modifier && !event.altKey && tools[key]) {
      store.actions.setTool(tools[key]);
    } else if (!modifier && !event.altKey && key === 'i') {
      flipCurrent(store);
    } else if (!modifier && (event.key === 'Delete' || event.key === 'Backspace') && store.getState().selectedOpeningId) {
      event.preventDefault();
      store.actions.removeOpening(store.getState().selectedOpeningId);
    } else if (event.key === 'Escape') {
      store.actions.setPendingOpening(null);
      store.actions.selectOpening(null);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Pièces : couleurs, avertissement, panneau, menu                     */
/* ------------------------------------------------------------------ */

/** Saturation et clarté des pastels, selon le thème (variables CSS). */
function readRoomTone() {
  const style = getComputedStyle(document.documentElement);
  return {
    sat: Number.parseFloat(style.getPropertyValue('--room-sat')) || 62,
    light: Number.parseFloat(style.getPropertyValue('--room-light')) || 86,
  };
}

function swatch(type) {
  const node = el('span', 'swatch');
  node.dataset.type = type;
  node.style.background = roomColor(type, readRoomTone());
  node.setAttribute('aria-hidden', 'true');
  return node;
}

/** Petit avertissement non bloquant quand des murs ne ferment aucune pièce. */
function renderWarning(store) {
  const outlines = store.getOutlines();
  const chip = $('room-warning');
  chip.hidden = outlines.length === 0;
  chip.textContent = outlines.length === 1 ? LABELS.openOutline : outlines.length > 1 ? LABELS.openOutlines(outlines.length) : '';
}

const ICON_LOCK = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path class="shackle" d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ICON_REGEN = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M20 12a8 8 0 1 1-2.6-5.9M20 4v4.5h-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/**
 * Panneau « Pièces » : liste (type, surface), surbrillance au toucher ; se replie en tiroir sur téléphone.
 * Chaque pièce a un cadenas (verrouille son mobilier) et un bouton Régénérer (nouvelle graine pour cette pièce seulement).
 */
function setupRoomsPanel(store, getEditor, generator) {
  const toggle = $('rooms-toggle');
  const list = $('rooms-list');
  let renderedPlan = null;

  const setOpen = (open) => toggle.setAttribute('aria-expanded', String(open));
  setOpen(!window.matchMedia?.('(max-width: 759px)').matches);
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));

  function rebuild(state) {
    const rooms = store.getRooms();
    const total = rooms.reduce((sum, room) => sum + room.areaM2, 0);
    $('rooms-summary').textContent = rooms.length
      ? `${rooms.length} pièce${rooms.length > 1 ? 's' : ''} · ${fmt1.format(total)} m²`
      : LABELS.noRooms;
    $('rooms-empty').hidden = rooms.length > 0;

    const focusedId = document.activeElement?.dataset?.roomId;
    const focusedAct = document.activeElement?.dataset?.act ?? 'row';
    const items = rooms.map((room) => {
      const type = getRoomType(state.plan, room);
      const custom = getRoomName(state.plan, room);
      const row = el('button', 'room-row');
      row.type = 'button';
      row.dataset.roomId = room.id;
      const name = el('span', 'room-row-name', roomLabel(state.plan, room));
      if (custom) name.append(el('small', '', ROOM_TYPE_INFO[type].label));
      row.append(swatch(type), name, el('span', 'room-row-area', `${fmt1.format(room.areaM2)} m²`));
      row.addEventListener('click', () => {
        const selected = store.getState().selectedRoomId === room.id;
        store.actions.selectRoom(selected ? null : room.id);
        if (!selected) getEditor()?.reveal(room);
      });
      row.dataset.act = 'row';
      const locked = isRoomLocked(state.plan, room);
      const hasRecipe = Boolean(RECIPES[type]);
      const lock = el('button', 'room-act room-lock');
      lock.type = 'button';
      lock.dataset.roomId = room.id;
      lock.dataset.act = 'lock';
      lock.setAttribute('aria-pressed', String(locked));
      lock.setAttribute('aria-label', `${locked ? 'Déverrouiller' : 'Verrouiller'} le mobilier de ${roomLabel(state.plan, room)}`);
      lock.title = locked ? 'Mobilier verrouillé : conservé par Générer et Vider' : 'Verrouiller le mobilier de cette pièce';
      lock.innerHTML = ICON_LOCK;
      lock.addEventListener('click', () => store.actions.toggleRoomLock(room.id));
      const regen = el('button', 'room-act room-regen');
      regen.type = 'button';
      regen.dataset.roomId = room.id;
      regen.dataset.act = 'regen';
      regen.disabled = locked || !hasRecipe;
      regen.setAttribute('aria-label', `Régénérer le mobilier de ${roomLabel(state.plan, room)}`);
      regen.title = locked ? 'Pièce verrouillée' : hasRecipe ? 'Régénérer le mobilier de cette pièce (nouvelle graine)' : 'Donnez à cette pièce un type à meubler';
      regen.innerHTML = ICON_REGEN;
      regen.addEventListener('click', () => generator?.regenerateRoom(room.id));
      const item = el('li', 'room-item');
      item.append(row, lock, regen);
      return item;
    });
    list.replaceChildren(...items);
    if (focusedId) list.querySelector(`[data-room-id="${focusedId}"][data-act="${focusedAct}"]`)?.focus();
    renderedPlan = state.plan;
  }

  function render(state) {
    if (state.plan !== renderedPlan) rebuild(state);
    for (const row of list.querySelectorAll('.room-row')) {
      row.setAttribute('aria-pressed', String(row.dataset.roomId === state.selectedRoomId));
    }
  }

  render(store.getState());
  store.subscribeUi(render);
  return {
    /** Redessine les pastilles de couleur (changement de thème). */
    refreshColors() {
      renderedPlan = null;
      render(store.getState());
    },
  };
}

/** Menu de la pièce touchée avec l'outil Pièce : types en boutons, champ pour la renommer. */
function setupRoomMenu(store) {
  const menu = $('room-menu');
  const typesBox = $('room-types');
  const form = $('room-name-form');
  const input = $('room-name');
  let currentId = null;
  let openedAt = 0;
  // Au doigt, le « clic » synthétisé après le toucher arrive sur ce qui se trouve alors sous le doigt : le menu qu'on
  // vient d'ouvrir. Sans ce garde-fou il choisirait un type tout seul. Aucune personne ne tape aussi vite.
  const justOpened = () => performance.now() - openedAt < GHOST_CLICK_MS;

  // Les types sont rangés par familles (Vie, Nuit, Eau…), chacune avec son titre, pour que la liste reste lisible.
  for (const group of ROOM_GROUPS) {
    const section = el('div', 'room-group');
    section.dataset.group = group.id;
    section.setAttribute('role', 'group');
    section.setAttribute('aria-label', group.label);
    section.append(el('span', 'room-group-title', group.label));
    const row = el('div', 'room-group-types');
    for (const type of group.types) {
      const button = el('button', 'room-type');
      button.type = 'button';
      button.dataset.type = type;
      button.setAttribute('aria-pressed', 'false');
      button.append(swatch(type), el('span', '', ROOM_TYPE_INFO[type].label));
      row.append(button);
    }
    section.append(row);
    typesBox.append(section);
  }

  function close() {
    if (menu.hidden) return;
    menu.hidden = true;
    currentId = null;
  }

  /** Place le menu dans la moitié du plan opposée au point touché, pour ne pas cacher la pièce. */
  function place(point, size) {
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    menu.style.left = `${Math.min(Math.max(point.x - width / 2, 8), Math.max(8, size.w - width - 8))}px`;
    menu.style.top = `${point.y > size.h / 2 ? 8 : Math.max(8, size.h - height - 8)}px`;
  }

  function open({ room, point, size }) {
    if (!room) {
      close();
      return;
    }
    const { plan } = store.getState();
    currentId = room.id;
    openedAt = performance.now();
    const type = getRoomType(plan, room);
    $('room-menu-title').textContent = `Pièce · ${fmt1.format(room.areaM2)} m²`;
    for (const button of typesBox.querySelectorAll('.room-type')) button.setAttribute('aria-pressed', String(button.dataset.type === type));
    input.value = getRoomName(plan, room);
    input.placeholder = ROOM_TYPE_INFO[type].label;
    menu.hidden = false;
    place(point, size);
    typesBox.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
  }

  typesBox.addEventListener('click', (event) => {
    const button = event.target.closest?.('.room-type');
    if (!button || !currentId || justOpened()) return;
    store.actions.setRoomInfo(currentId, { type: button.dataset.type, name: input.value });
    close();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (currentId) store.actions.setRoomInfo(currentId, { name: input.value });
    close();
  });
  $('room-menu-close').addEventListener('click', () => {
    if (!justOpened()) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) close();
  });
  // Un toucher ailleurs ferme le menu ; le toucher sur le plan peut ensuite en ouvrir un autre.
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (!menu.hidden && !menu.contains(event.target)) close();
    },
    true,
  );
  store.subscribe(close); // le plan a changé (annuler, effacer…) : la pièce n'est peut-être plus la même
  store.subscribeUi(({ tool }) => {
    if (tool !== 'room') close();
  });

  return {
    onRoomTap: open,
    refreshColors() {
      for (const node of menu.querySelectorAll('.swatch')) node.style.background = roomColor(node.dataset.type, readRoomTone());
    },
  };
}

/* ------------------------------------------------------------------ */
/* Ouvertures : panneau de propriétés                                  */
/* ------------------------------------------------------------------ */

/** Nombre saisi au clavier : accepte la virgule décimale. NaN si ce n'est pas un nombre. */
function parseMeters(text) {
  const value = Number(String(text).trim().replace(',', '.'));
  return text.trim() === '' ? Number.NaN : value;
}

/** Panneau de l'ouverture sélectionnée : type, largeur, allège, hauteur, inverser, supprimer. */
function setupOpeningPanel(store) {
  const panel = $('opening-panel');
  const sill = $('op-sill');
  const height = $('op-height');
  let shownId = null;

  function selected(state) {
    return state.plan.openings.find((o) => o.id === state.selectedOpeningId) ?? null;
  }

  function render(state) {
    const opening = selected(state);
    panel.hidden = !opening;
    if (!opening) {
      shownId = null;
      return;
    }
    shownId = opening.id;
    for (const button of panel.querySelectorAll('[data-optype]')) {
      button.setAttribute('aria-pressed', String(button.dataset.optype === opening.type));
    }
    const cell = state.plan.grid.cellSize;
    const limits = openingSpanLimits(cell);
    $('op-width').textContent = `${fmtLen.format(opening.span * cell)} m`;
    $('op-narrower').disabled = opening.span <= limits.min;
    $('op-narrower').setAttribute('aria-label', `Réduire d'une arête (${fmtLen.format(cell)} m)`);
    $('op-wider').setAttribute('aria-label', `Élargir d'une arête (${fmtLen.format(cell)} m)`);
    $('op-wider').disabled =
      opening.span >= limits.max || updateOpening(state.plan, opening.id, { span: opening.span + 1 }) === state.plan;
    if (document.activeElement !== sill) sill.value = fmt2.format(openingSill(opening));
    if (document.activeElement !== height) height.value = fmt2.format(openingHeight(opening));
    panel.setAttribute('aria-label', `Propriétés : ${OPENING_LABELS[opening.type].toLowerCase()}`);
  }

  const current = () => store.getState().selectedOpeningId;
  for (const button of panel.querySelectorAll('[data-optype]')) {
    button.addEventListener('click', () => current() && store.actions.updateOpening(current(), { type: button.dataset.optype }));
  }
  const stepWidth = (delta) => {
    const opening = selected(store.getState());
    if (opening) store.actions.updateOpening(opening.id, { span: opening.span + delta });
  };
  $('op-narrower').addEventListener('click', () => stepWidth(-1));
  $('op-wider').addEventListener('click', () => stepWidth(1));
  $('op-flip').addEventListener('click', () => current() && store.actions.flipOpening(current()));
  $('op-delete').addEventListener('click', () => current() && store.actions.removeOpening(current()));
  $('op-close').addEventListener('click', () => store.actions.selectOpening(null));

  const commitField = (input, key) => () => {
    const opening = selected(store.getState());
    const value = parseMeters(input.value);
    if (opening && Number.isFinite(value)) store.actions.updateOpening(opening.id, { [key]: value });
    render(store.getState()); // réécrit la valeur retenue (bornée) même si le plan n'a pas changé
  };
  for (const [input, key] of [[sill, 'sill'], [height, 'height']]) {
    input.addEventListener('change', commitField(input, key));
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') input.blur();
    });
  }

  render(store.getState());
  store.subscribeUi(render);
  return { render, shownId: () => shownId };
}

/**
 * Barre de la vue 3D : point de vue (dessus / perspective), hauteur des murs (complets / abaissés), capture PNG.
 * Les boutons restent désactivés tant que la vue 3D n'est pas démarrée.
 */
function setupViewControls() {
  const top = $('btn-view-top');
  const persp = $('btn-view-persp');
  const full = $('btn-walls-full');
  const low = $('btn-walls-low');
  const auto = $('btn-walls-auto');
  const capture = $('btn-capture');
  const levelButtons = { upto: $('btn-lv-upto'), all: $('btn-lv-all'), solo: $('btn-lv-solo') };
  const box = $('capture-box');
  const image = $('capture-img');
  const download = $('capture-download');
  const open = $('capture-open');
  let viewer = null;
  let objectUrl = '';

  const sync = () => {
    top.setAttribute('aria-pressed', String(viewer.getView() === 'top'));
    persp.setAttribute('aria-pressed', String(viewer.getView() !== 'top'));
    full.setAttribute('aria-pressed', String(viewer.getWallMode() === 'full'));
    low.setAttribute('aria-pressed', String(viewer.getWallMode() === 'lowered'));
    auto.setAttribute('aria-pressed', String(viewer.getWallMode() === 'auto'));
    for (const [mode, button] of Object.entries(levelButtons)) button.setAttribute('aria-pressed', String(viewer.getLevelView() === mode));
  };
  const forget = () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = '';
    image.removeAttribute('src');
  };
  const closeCapture = () => {
    box.hidden = true;
    forget();
  };

  top.addEventListener('click', () => viewer?.setView('top'));
  persp.addEventListener('click', () => viewer?.setView('perspective'));
  full.addEventListener('click', () => viewer?.setWallMode('full'));
  low.addEventListener('click', () => viewer?.setWallMode('lowered'));
  auto.addEventListener('click', () => viewer?.setWallMode('auto'));
  for (const [mode, button] of Object.entries(levelButtons)) button.addEventListener('click', () => viewer?.setLevelView(mode));
  for (const button of [top, persp, full, low, auto, ...Object.values(levelButtons)]) button.addEventListener('click', () => viewer && sync());

  // Dans l'artefact publié, le téléchargement passe par la capacité « downloads » (confirmation du visiteur) ;
  // ailleurs (page ouverte à part), un lien <a download> suffit. Dans les deux cas l'aperçu reste affiché.
  let currentBlob = null;
  let saver;
  const getSaver = async () => {
    if (saver === undefined) {
      try {
        saver = (await window.claude?.use?.('downloads')) ?? null;
      } catch {
        saver = null;
      }
    }
    return saver;
  };
  const saveBlob = async () => {
    const downloads = await getSaver();
    if (downloads && currentBlob) {
      try {
        await downloads.save({ filename: 'maison-3d.png', data: currentBlob });
      } catch (error) {
        if (error?.code !== 'declined') console.warn(error);
      }
      return true;
    }
    return false;
  };
  download.addEventListener('click', (event) => {
    if (saver) {
      event.preventDefault();
      saveBlob();
    }
  });

  capture.addEventListener('click', () => {
    if (!viewer) return;
    viewer.captureCanvas().toBlob(async (blob) => {
      if (!blob) return;
      forget();
      currentBlob = blob;
      objectUrl = URL.createObjectURL(blob);
      image.src = objectUrl;
      download.href = objectUrl;
      open.href = objectUrl;
      box.hidden = false;
      open.hidden = Boolean(await getSaver()); // un onglet blob n'est pas ouvrable depuis l'artefact
      // On tente l'enregistrement tout de suite ; s'il est refusé ou bloqué, l'aperçu et les liens restent.
      if (await saveBlob()) return;
      try {
        download.click();
      } catch (error) {
        console.warn(error);
      }
    }, 'image/png');
  });
  $('capture-close').addEventListener('click', closeCapture);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !box.hidden) closeCapture();
  });

  return {
    attach(next) {
      viewer = next;
      for (const button of [top, persp, full, low, auto, capture, ...Object.values(levelButtons)]) button.disabled = false;
      sync();
    },
    sync: () => viewer && sync(),
  };
}

/** Phrases d'état de l'ameublement : résumé d'une génération (rapports par pièce) pour la ligne d'état. */
function describeReports(plan, rooms, reports) {
  const byId = new Map(rooms.map((room) => [room.id, room]));
  const notes = [];
  let count = 0;
  let furnished = 0;
  for (const [id, report] of Object.entries(reports)) {
    const room = byId.get(id);
    if (!room || !report.items.length) {
      if (room && report.type !== 'other') notes.push(`${roomLabel(plan, room)} : pas de meubles`);
      continue;
    }
    count += report.items.length;
    furnished++;
    const label = roomLabel(plan, room);
    for (const role of report.missing) notes.push(`${label} : pas de place pour ${ROLE_LABELS[role] ?? role}`);
    if (report.pruned) notes.push(`${label} : ${report.pruned} objet(s) retiré(s) pour garder le passage`);
  }
  return { count, furnished, notes };
}

/**
 * Ameublement automatique (phase 6c) : la barre Générer de la vue 3D. Tout passe par les actions du store (annulables) :
 * « Générer » meuble tout le logement avec la graine du champ, « dé » tire une graine au hasard, le sélecteur change la
 * palette du logement, « Vider » retire le mobilier des pièces non verrouillées. Le résultat est dans plan.furniture.
 */
function setupGenerator(store) {
  const button = $('btn-generate');
  const clear = $('btn-generate-clear');
  const dice = $('btn-dice');
  const seedInput = $('gen-seed');
  const styleSelect = $('gen-style');
  const status = $('gen-status');
  const undo = $('btn-undo-3d');
  const redo = $('btn-redo-3d');

  for (const palette of PALETTES) {
    const option = el('option', '', palette.label);
    option.value = palette.id;
    styleSelect.append(option);
  }

  const say = (text) => {
    status.textContent = text;
  };
  const newSeed = () => 1 + Math.floor(Math.random() * 999999998);
  const readSeed = () => {
    const value = Number.parseInt(seedInput.value, 10);
    return Number.isFinite(value) && value >= 0 ? value : null;
  };

  function announce(result, what) {
    const { plan } = store.getState();
    if (!result.ok) {
      say(
        result.reason === 'locked'
          ? 'Toutes les pièces sont verrouillées : déverrouillez-en une (cadenas, panneau Pièces).'
          : result.reason === 'no-recipe'
            ? 'Cette pièce n\'a pas de type à meubler (Salon, Chambre, Cuisine…).'
            : 'Aucune pièce à meubler : donnez un type à une pièce (outil Pièce, ou onglet Pièces).',
      );
      return;
    }
    const { count, furnished, notes } = describeReports(plan, store.getRooms(), result.reports);
    const locked = store.getRooms().filter((room) => isRoomLocked(plan, room)).length;
    const head = result.unchanged
      ? 'Même résultat : changez la graine (dé) pour un autre aménagement.'
      : `${what} · graine ${result.seed} · ${count} objets dans ${furnished} pièce${furnished > 1 ? 's' : ''}${locked && what === 'Logement' ? `, ${locked} verrouillée${locked > 1 ? 's' : ''} conservée${locked > 1 ? 's' : ''}` : ''}.`;
    say(`${head}${notes.length ? ` ${notes.join(' ; ')}.` : ''}`);
  }

  function generate(seed) {
    if (seed === null) {
      say('Graine invalide : entrez un entier positif ou touchez le dé.');
      return;
    }
    seedInput.value = String(seed);
    const all = !$('gen-all-label').hidden && $('gen-all').checked;
    announce(store.actions.generateHome({ seed, style: styleSelect.value, scope: all ? 'all' : 'level' }), all ? 'Tous les niveaux' : 'Logement');
  }

  button.addEventListener('click', () => generate(readSeed()));
  dice.addEventListener('click', () => generate(newSeed()));
  seedInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') generate(readSeed());
  });
  styleSelect.addEventListener('change', () => {
    store.actions.setStyle(styleSelect.value);
    say(`Style : ${getPalette(styleSelect.value).label}.`);
  });
  clear.addEventListener('click', () => {
    const { plan } = store.getState();
    const locked = store.getRooms().filter((room) => isRoomLocked(plan, room) && plan.furniture.some((item) => item.roomId === room.id)).length;
    store.actions.clearFurniture();
    say(locked ? `Mobilier retiré, sauf dans ${locked} pièce${locked > 1 ? 's' : ''} verrouillée${locked > 1 ? 's' : ''}.` : 'Mobilier retiré.');
  });
  undo.addEventListener('click', () => store.actions.undo());
  redo.addEventListener('click', () => store.actions.redo());

  /** Reflète l'état du plan : palette, graine, boutons annuler / rétablir et Vider. */
  function render(state) {
    const { plan } = state;
    styleSelect.value = plan.style.preset;
    if (document.activeElement !== seedInput) seedInput.value = String(plan.style.seed);
    clear.disabled = plan.furniture.length === 0;
    $('gen-all-label').hidden = state.doc.levels.length < 2;
    undo.disabled = !state.canUndo;
    redo.disabled = !state.canRedo;
  }
  render(store.getState());
  store.subscribeUi(render);

  return {
    say,
    /** Régénère une pièce avec une nouvelle graine (bouton de la liste des pièces). */
    regenerateRoom(roomId) {
      const seed = newSeed();
      const result = store.actions.regenerateRoom(roomId, seed);
      announce(result, 'Pièce');
    },
  };
}

/**
 * Mode Catalogue : une grille d'objets en plateau tournant, par catégorie (jamais tous à la fois : léger sur téléphone),
 * avec choix de la palette, variations aléatoires activables et dimensions affichées.
 * Un seul canvas WebGL sert toutes les cases (createCatalogViewer, chargé à la première ouverture).
 */
function setupCatalog() {
  const app = document.querySelector('.app');
  const section = $('catalog');
  const grid = $('catalog-grid');
  const button = $('btn-catalog');
  const cats = $('catalog-cats');
  const select = $('catalog-palette');
  const swatches = $('catalog-swatches');
  const variations = $('catalog-variations');
  let viewer = null;
  let failed = false;
  let category = FURNITURE_CATEGORIES[0].id;
  let paletteId = PALETTES[0].id;
  let seed = 1;
  let open = false;

  for (const { id, label } of FURNITURE_CATEGORIES) {
    const chip = el('button', 'tool', label);
    chip.type = 'button';
    chip.dataset.category = id;
    chip.setAttribute('aria-pressed', String(id === category));
    chip.addEventListener('click', () => {
      category = id;
      render();
    });
    cats.append(chip);
  }
  for (const palette of PALETTES) {
    const option = el('option', '', palette.label);
    option.value = palette.id;
    select.append(option);
  }
  select.addEventListener('change', () => {
    paletteId = select.value;
    render();
  });
  variations.addEventListener('change', render);
  $('catalog-reroll').addEventListener('click', () => {
    seed += 1;
    variations.checked = true;
    render();
  });

  const dims = (size) => `${fmt2.format(size.w)} × ${fmt2.format(size.d)} × ${fmt2.format(size.h)} m`;

  function render() {
    const palette = getPalette(paletteId);
    for (const chip of cats.children) chip.setAttribute('aria-pressed', String(chip.dataset.category === category));
    swatches.replaceChildren(
      ...['wall', 'floor', 'wood', 'fabric', 'accent', 'plant'].map((role) => {
        const swatch = el('i');
        swatch.style.background = palette[role];
        return swatch;
      }),
    );
    swatches.title = `${palette.label} · sol : ${palette.floorKind}`;
    const defs = FURNITURE_DEFS.filter((def) => def.category === category);
    $('catalog-count').textContent = `${defs.length} objets · ${palette.label} · sol : ${palette.floorKind} · dimensions : largeur × profondeur × hauteur`;
    grid.style.setProperty('--cat-wall', palette.wall);
    const items = defs.map((def) => {
      const view = el('div', 'cat-view');
      view.setAttribute('role', 'img');
      view.setAttribute('aria-label', `${def.label}, aperçu 3D tournant`);
      const cell = el('article', 'cat-cell');
      cell.dataset.furniture = def.id;
      cell.append(view, el('h3', '', def.label), el('p', 'cat-dims', dims(def.size)), el('p', 'cat-meta', PLACEMENT_LABELS[def.placement.mode]));
      return { def, el: view, cell };
    });
    for (const cell of grid.querySelectorAll('.cat-cell')) cell.remove(); // le canvas WebGL reste dans la grille
    grid.append(...items.map((item) => item.cell));
    grid.scrollTop = 0;
    viewer?.setItems(items, { palette, variations: variations.checked, seed });
  }

  async function show() {
    open = true;
    app.dataset.mode = 'catalog';
    section.hidden = false;
    button.setAttribute('aria-pressed', 'true');
    $('btn-catalog-label').textContent = 'Retour au plan';
    if (!viewer && !failed) {
      try {
        const { createCatalogViewer } = await import('./viewer3d.js');
        viewer = createCatalogViewer(grid);
      } catch (error) {
        console.error(error);
        failed = true;
        const detail = String(error?.message ?? error);
        showNotice('notice-catalog', /webgl/i.test(detail) ? LABELS.noWebgl : LABELS.no3d, detail);
      }
    }
    if (!open) return; // refermé pendant le chargement
    render();
    viewer?.start();
  }

  function hide() {
    open = false;
    delete app.dataset.mode;
    section.hidden = true;
    button.setAttribute('aria-pressed', 'false');
    $('btn-catalog-label').textContent = 'Catalogue';
    viewer?.stop();
  }

  button.addEventListener('click', () => (open ? hide() : show()));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open && !/^(INPUT|SELECT|TEXTAREA)$/.test(event.target?.tagName ?? '')) hide();
  });
  document.addEventListener('visibilitychange', () => {
    if (!open || !viewer) return;
    if (document.hidden) viewer.stop();
    else viewer.start();
  });
  render();
  return { isOpen: () => open };
}

/** Onglets Plan / 3D / Plan + 3D (visibles seulement sur petit écran ; le CSS affiche les deux vues sinon). */
function setupTabs(onChange) {
  const workspace = $('workspace');
  const tabs = [...document.querySelectorAll('[role="tab"]')];

  function select(view, focus = false) {
    workspace.dataset.view = view;
    for (const tab of tabs) {
      const active = tab.dataset.view === view;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    }
    onChange(view);
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab.dataset.view));
    tab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      const step = event.key === 'ArrowRight' ? 1 : -1;
      select(tabs[(index + step + tabs.length) % tabs.length].dataset.view, true);
    });
  });
}

function renderResults(container, results) {
  const bySuite = new Map();
  for (const result of results) {
    if (!bySuite.has(result.suite)) bySuite.set(result.suite, []);
    bySuite.get(result.suite).push(result);
  }
  const sections = [];
  for (const [suite, items] of bySuite) {
    const section = el('section', 'suite');
    section.append(el('h3', '', suite));
    const list = el('ul');
    for (const result of items) {
      const item = el('li', 'test');
      item.dataset.state = result.ok ? 'pass' : 'fail';
      const glyph = el('span', 'glyph', result.ok ? '✓' : '✕');
      glyph.setAttribute('aria-hidden', 'true');
      const name = el('span', 'test-name');
      name.append(el('span', 'sr', result.ok ? LABELS.pass : LABELS.fail), result.name);
      item.append(glyph, name);
      if (!result.ok) item.append(el('pre', 'err', result.error));
      list.append(item);
    }
    section.append(list);
    sections.push(section);
  }
  container.replaceChildren(...sections);
}

/** Bouton « Tests » : pastille verte ou rouge, panneau de détail, exécution à l'ouverture. */
/** Graines des tests de génération au chargement de la page : peu, pour rester léger ; le bouton « 200 graines » les passe toutes. */
const QUICK_SEEDS = 20;

function setupTests() {
  const button = $('btn-tests');
  const panel = $('tests-panel');
  const dot = $('tests-dot');
  const count = $('tests-count');
  const summary = $('tests-summary');
  const body = $('tests-body');

  const full = $('tests-full');
  let running = false;

  /** `seeds` : nombre de graines des tests de génération (peu au chargement, 200 avec le bouton). */
  async function refresh(seeds = QUICK_SEEDS) {
    if (running) return;
    running = true;
    full.disabled = true;
    summary.dataset.state = '';
    summary.textContent = `Tests en cours (${seeds} graines par pièce)…`;
    let outcome;
    try {
      outcome = await runTests({ seeds });
    } catch (error) {
      console.error(error);
      dot.dataset.state = 'fail';
      count.textContent = 'erreur';
      summary.dataset.state = 'fail';
      summary.textContent = LABELS.testsCrash;
      body.replaceChildren(el('pre', 'err', String(error?.message ?? error)));
      return;
    } finally {
      running = false;
      full.disabled = false;
    }
    const state = outcome.failed ? 'fail' : 'pass';
    dot.dataset.state = state;
    count.textContent = outcome.failed
      ? `${outcome.failed} échec${outcome.failed > 1 ? 's' : ''}`
      : `${outcome.passed}/${outcome.total}`;
    summary.dataset.state = state;
    summary.textContent = `${outcome.passed} sur ${outcome.total} tests réussis (génération : ${seeds} graines par pièce)`;
    renderResults(body, outcome.results);
  }

  function setOpen(open) {
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) refresh();
  }

  full.addEventListener('click', () => refresh(200));
  button.addEventListener('click', () => setOpen(panel.hidden));
  $('tests-close').addEventListener('click', () => {
    setOpen(false);
    button.focus();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) {
      setOpen(false);
      button.focus();
    }
  });

  return () => refresh(); // une première exécution (rapide) au chargement colore la pastille
}

/** Appelle callback quand le thème change (réglage système ou choix explicite du visualiseur). */
function watchTheme(callback) {
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', callback);
  new MutationObserver(callback).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
}

/* ------------------------------------------------------------------ */
/* Projets, export, import et partage                                  */
/* ------------------------------------------------------------------ */

const LZ_URL = './vendor/lz-string.min.js';
const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const IMPORT_MAX_BYTES = 10 * 1024 * 1024;
let lzPromise = null;

/** lz-string (cdnjs), chargé à la demande : seuls le lien de partage et sa lecture en ont besoin. */
function loadLz() {
  if (globalThis.LZString) return Promise.resolve(globalThis.LZString);
  lzPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = LZ_URL;
    script.async = true;
    script.onload = () => (globalThis.LZString ? resolve(globalThis.LZString) : reject(new Error('lz-string absent')));
    script.onerror = () => {
      lzPromise = null;
      reject(new Error('lz-string n\'a pas pu être chargé'));
    };
    document.head.append(script);
  });
  return lzPromise;
}

/** Adresse sur laquelle poser le fragment du lien : la page elle-même, ou la page qui l'affiche quand elle est dans un cadre. */
function shareBase() {
  try {
    if (window.top === window) return window.location.href.split('#')[0];
  } catch {
    /* cadre d'une autre origine : on regarde le référent */
  }
  return /^https?:\/\//.test(document.referrer) ? document.referrer.split('#')[0] : window.location.href.split('#')[0];
}

/** Compte d'objets pour un message : « 3 pièces, 12 murs… » */
function describePlan(doc) {
  const views = doc.levels.map((_, i) => levelPlan(doc, i));
  const rooms = views.reduce((sum, view) => sum + detectRooms(view).length, 0);
  const walls = views.reduce((sum, view) => sum + view.walls.length, 0);
  const objects = views.reduce((sum, view) => sum + view.furniture.length, 0);
  const parts = [`${rooms} pièce${rooms > 1 ? 's' : ''}`, `${walls} arête${walls > 1 ? 's' : ''} de mur`];
  if (doc.levels.length > 1) parts.unshift(`${doc.levels.length} niveaux`);
  if (objects) parts.push(`${objects} objet${objects > 1 ? 's' : ''}`);
  return parts.join(', ');
}

function setupFiles({ store, projects, storage, saver, getEditor, getViewer }) {
  const backdrop = $('files-backdrop');
  const openButton = $('btn-files');
  const list = $('project-list');
  const exportStatus = $('export-status');
  const importMsg = $('import-msg');
  const out = $('export-out');
  let editingId = null; // projet en cours de renommage
  let deletingId = null; // projet dont la suppression attend une confirmation
  let storageDismissed = false;
  let pendingShare = null;
  let downloads;

  const say = (text, state = '') => {
    exportStatus.textContent = text;
    exportStatus.dataset.state = state;
  };
  const sayImport = (lines, state = '') => {
    importMsg.dataset.state = state;
    const messages = Array.isArray(lines) ? lines : [lines];
    if (messages.length <= 1) {
      importMsg.textContent = messages[0] ?? '';
      return;
    }
    const ul = el('ul');
    for (const line of messages.slice(0, 8)) ul.append(el('li', '', line));
    if (messages.length > 8) ul.append(el('li', '', `… et ${messages.length - 8} autre${messages.length - 8 > 1 ? 's' : ''}.`));
    importMsg.replaceChildren(el('span', '', 'Ce plan n\'a pas pu être importé :'), ul);
  };

  /* ---- Bandeaux ---- */

  function updateBanners() {
    $('banner-storage').hidden = projects.isPersistent() || storageDismissed;
    $('banner-share').hidden = !pendingShare;
  }

  function showShareBanner(share) {
    pendingShare = share;
    const ok = Boolean(share.plan);
    $('banner-share-text').textContent = ok
      ? `Un plan partagé${share.name ? ` « ${share.name} »` : ''} (${describePlan(share.plan)}) a été trouvé dans l'adresse. Votre projet en cours n'est pas modifié : il s'ouvre comme nouveau projet.`
      : share.error;
    $('banner-share-open').hidden = !ok;
    $('banner-share-ignore').textContent = ok ? 'Ignorer' : 'Fermer';
    updateBanners();
  }

  function clearHash() {
    try {
      if (window.location.hash) window.history.replaceState(null, '', window.location.href.split('#')[0]);
    } catch {
      /* historique indisponible dans ce cadre : sans importance */
    }
  }

  /** Cherche un plan partagé dans le fragment de l'adresse (…#plan=code) et propose de l'ouvrir. */
  async function checkFragment() {
    const code = extractShareCode(window.location.hash || '');
    if (!code) return;
    try {
      const lz = await loadLz();
      const result = readShare(code, { decompress: lz.decompressFromEncodedURIComponent, furnitureIds: FURNITURE_IDS });
      showShareBanner(result.ok ? { plan: result.plan, name: result.name } : { error: result.errors[0] });
    } catch (error) {
      showShareBanner({ error: 'Le lien de partage ne peut pas être lu : la bibliothèque de décompression n\'a pas pu être chargée (connexion ?).' });
    }
  }

  $('banner-share-open').addEventListener('click', () => {
    if (!pendingShare?.plan) return;
    const { plan, name } = pendingShare;
    pendingShare = null;
    openNew(name || 'Plan partagé', plan);
    clearHash();
    updateBanners();
  });
  $('banner-share-ignore').addEventListener('click', () => {
    pendingShare = null;
    clearHash();
    updateBanners();
  });
  $('banner-storage-close').addEventListener('click', () => {
    storageDismissed = true;
    updateBanners();
  });
  $('banner-storage-export').addEventListener('click', () => {
    setOpen(true);
    exportJson();
  });

  /* ---- Projets ---- */

  function renderName() {
    const active = projects.active();
    $('project-name').textContent = active?.name ?? 'Projets';
    openButton.title = active ? `Projet « ${active.name} » · projets, export, import et partage` : 'Projets, export, import et partage';
  }

  function renderHint() {
    $('projects-hint').textContent = projects.isPersistent()
      ? 'Chaque projet est enregistré automatiquement dans ce navigateur (stockage local).'
      : 'Le stockage du navigateur est indisponible ici : les projets ne durent que le temps de cette page. Exportez vos plans pour les conserver.';
  }

  function renderList() {
    const items = projects.list().map((project) => {
      const active = project.id === projects.activeId();
      const item = el('li', 'project-item');
      item.dataset.active = String(active);
      item.dataset.projectId = project.id;
      if (editingId === project.id) {
        const form = el('form', 'project-rename');
        const input = el('input');
        input.type = 'text';
        input.value = project.name;
        input.maxLength = 60;
        input.setAttribute('aria-label', 'Nouveau nom du projet');
        const ok = el('button', 'btn btn-primary', 'Renommer');
        ok.type = 'submit';
        const cancel = el('button', 'btn', 'Annuler');
        cancel.type = 'button';
        form.append(input, ok, cancel);
        form.addEventListener('submit', (event) => {
          event.preventDefault();
          projects.rename(project.id, input.value);
          editingId = null;
          refresh();
        });
        cancel.addEventListener('click', () => {
          editingId = null;
          renderList();
        });
        item.append(form);
        queueMicrotask(() => {
          input.focus();
          input.select();
        });
      } else if (deletingId === project.id) {
        const box = el('div', 'project-confirm');
        const ask = el('span', '', `Supprimer « ${project.name} » ? Cette action est définitive.`);
        const keep = el('button', 'btn', 'Garder');
        keep.type = 'button';
        const del = el('button', 'btn btn-danger', 'Supprimer');
        del.type = 'button';
        keep.addEventListener('click', () => {
          deletingId = null;
          renderList();
        });
        del.addEventListener('click', () => {
          deletingId = null;
          removeProject(project.id);
        });
        box.append(ask, keep, del);
        item.append(box);
      } else {
        const open = el('button', 'project-open');
        open.type = 'button';
        open.append(el('b', '', project.name), el('small', '', `${active ? 'Ouvert · ' : ''}modifié ${project.updatedAt ? dateFormat.format(new Date(project.updatedAt)) : '—'}`));
        open.setAttribute('aria-label', active ? `${project.name}, projet ouvert` : `Ouvrir ${project.name}`);
        open.addEventListener('click', () => {
          if (!active) openProject(project.id);
          else setOpen(false);
        });
        const actions = el('div', 'project-actions');
        const rename = el('button', 'btn', 'Renommer');
        const copy = el('button', 'btn', 'Dupliquer');
        const del = el('button', 'btn', 'Supprimer');
        for (const button of [rename, copy, del]) button.type = 'button';
        rename.setAttribute('aria-label', `Renommer ${project.name}`);
        copy.setAttribute('aria-label', `Dupliquer ${project.name}`);
        del.setAttribute('aria-label', `Supprimer ${project.name}`);
        rename.addEventListener('click', () => {
          editingId = project.id;
          deletingId = null;
          renderList();
        });
        copy.addEventListener('click', () => {
          saver.flush();
          const duplicate = projects.duplicate(project.id);
          say(duplicate ? `Projet dupliqué : « ${duplicate.name} ».` : 'Ce projet n\'a pas pu être dupliqué.', duplicate ? 'good' : 'bad');
          refresh();
        });
        del.addEventListener('click', () => {
          deletingId = project.id;
          editingId = null;
          renderList();
        });
        actions.append(rename, copy, del);
        item.append(open, actions);
      }
      return item;
    });
    list.replaceChildren(...items);
  }

  function refresh() {
    renderName();
    renderHint();
    renderList();
    updateBanners();
  }

  /** Charge le plan d'un projet dans le store (historique vide) sans le réécrire. */
  function showPlan(plan) {
    const result = store.actions.loadPlan(plan);
    if (!result.ok) return result;
    saver.rebase(store.getState().doc);
    getEditor()?.fit();
    const viewer = getViewer();
    viewer?.setView(viewer.getView());
    return result;
  }

  function openProject(id) {
    saver.flush();
    const read = projects.readPlan(id);
    if (!read.ok) {
      say(`Ce projet ne peut pas être ouvert : ${read.errors[0]}`, 'bad');
      return false;
    }
    if (!showPlan(read.plan).ok) return false;
    projects.setActive(id);
    renderSave({ state: 'ready' });
    refresh();
    setOpen(false);
    return true;
  }

  /** Crée un projet avec ce plan et l'ouvre. */
  function openNew(name, plan) {
    saver.flush();
    const project = projects.create(name, plan);
    projects.setActive(project.id);
    const result = showPlan(plan);
    if (!result.ok) {
      projects.remove(project.id);
      return { ok: false, errors: result.errors };
    }
    renderSave({ state: projects.isPersistent() ? 'saved' : 'unavailable', at: new Date() });
    refresh();
    return { ok: true, project };
  }

  /** Charge un modèle de départ : remplace le projet en cours s'il est vide, sinon ouvre un nouveau projet. */
  function loadTemplate(id, name) {
    const plan = buildTemplate(id);
    const { doc: current } = store.getState();
    const active = projects.active();
    saver.flush();
    if (active && current.levels.length === 1 && current.levels[0].walls.length === 0 && current.levels[0].furniture.length === 0) {
      const result = store.actions.loadPlan(plan); // pas de rebase : l'enregistrement automatique l'écrit
      if (result.ok) {
        projects.rename(active.id, name);
        getEditor()?.fit();
        const viewer = getViewer();
        viewer?.setView(viewer.getView());
        refresh();
        return { ok: true };
      }
    }
    return openNew(name, plan);
  }

  function removeProject(id) {
    const wasActive = id === projects.activeId();
    projects.remove(id);
    if (wasActive) {
      const next = projects.list().find((project) => projects.readPlan(project.id).ok);
      if (!next || !openProject(next.id)) openNew('Mon logement', createEmptyDocument());
      return;
    }
    refresh();
  }

  $('project-new').addEventListener('click', () => {
    const result = openNew('Nouveau projet', createEmptyDocument());
    if (result.ok) setOpen(false);
  });

  /* ---- Ouverture du panneau ---- */

  function setOpen(open) {
    backdrop.hidden = !open;
    openButton.setAttribute('aria-expanded', String(open));
    if (open) {
      editingId = null;
      deletingId = null;
      refresh();
      $('files-close').focus();
    } else {
      openButton.focus({ preventScroll: true });
    }
  }
  openButton.addEventListener('click', () => setOpen(backdrop.hidden));
  $('files-close').addEventListener('click', () => setOpen(false));
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !backdrop.hidden) setOpen(false);
  });

  /* ---- Export ---- */

  const projectSlug = () => fileSlug(projects.active()?.name);

  async function getDownloads() {
    if (downloads === undefined) {
      try {
        downloads = (await window.claude?.use?.('downloads')) ?? null;
      } catch {
        downloads = null;
      }
    }
    return downloads;
  }

  /**
   * Propose un fichier au visiteur : capacité « downloads » de l'artefact (confirmation), sinon lien <a download>.
   * @returns {Promise<'saved' | 'declined' | 'rejected' | 'link' | 'failed'>}
   */
  async function deliver(filename, data, mime) {
    const capability = await getDownloads();
    if (capability) {
      try {
        await capability.save({ filename, data });
        return 'saved';
      } catch (error) {
        if (error?.code === 'declined') return 'declined';
        if (error?.code === 'rejected_extension') return 'rejected';
        console.warn(error);
      }
    }
    try {
      const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
      const url = URL.createObjectURL(blob);
      const link = el('a');
      link.href = url;
      link.download = filename;
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return 'link';
    } catch (error) {
      console.warn(error);
      return 'failed';
    }
  }

  const delivered = (result, filename) =>
    result === 'saved'
      ? `Fichier « ${filename} » proposé à l'enregistrement.`
      : result === 'declined'
        ? 'Enregistrement annulé.'
        : result === 'link'
          ? `Téléchargement de « ${filename} » lancé. S'il n'a pas démarré, votre navigateur l'a bloqué.`
          : 'Le téléchargement a échoué.';

  function showText(label, text, { code = null } = {}) {
    $('export-out-label').textContent = label;
    $('export-text').value = text;
    $('export-copy-code').hidden = !code;
    $('export-copy-code').dataset.code = code ?? '';
    out.hidden = false;
    $('export-text').focus();
    $('export-text').select();
  }

  async function copyText(text, okMessage) {
    try {
      await navigator.clipboard.writeText(text);
      say(okMessage, 'good');
    } catch {
      const area = $('export-text');
      area.value = text;
      area.focus();
      area.select();
      let done = false;
      try {
        done = document.execCommand('copy');
      } catch {
        done = false;
      }
      say(done ? okMessage : 'Copie automatique impossible ici : le texte est sélectionné, copiez-le avec Ctrl+C (ou un appui long).', done ? 'good' : 'bad');
    }
  }

  function planText() {
    saver.flush();
    return exportPlanText(store.getState().doc, { name: projects.active()?.name ?? 'Maison 3D' });
  }

  async function exportJson() {
    const text = planText();
    const filename = `${projectSlug()}.json`;
    const result = await deliver(filename, text, 'application/json');
    say(delivered(result, filename), result === 'failed' ? 'bad' : 'good');
    if (result === 'link' || result === 'failed' || result === 'rejected') {
      showText('Le téléchargement peut être bloqué ici. Copiez ce texte et enregistrez-le dans un fichier .json, ou collez-le plus tard dans « Importer ».', text);
    }
  }
  $('export-json').addEventListener('click', exportJson);
  $('export-json-text').addEventListener('click', () => {
    showText('Plan au format JSON : copiez ce texte dans un fichier .json, ou collez-le plus tard dans « Importer ».', planText());
    say('');
  });

  $('export-png2d').addEventListener('click', async () => {
    const editor = getEditor();
    if (!editor) return say('Le plan 2D n\'est pas disponible.', 'bad');
    say('Image en préparation…');
    const canvas = editor.exportImage();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return say('L\'image n\'a pas pu être créée.', 'bad');
    const filename = `${projectSlug()}-plan.png`;
    say(delivered(await deliver(filename, blob, 'image/png'), filename), 'good');
  });

  $('export-glb').addEventListener('click', async () => {
    const viewer = getViewer();
    if (!viewer?.exportGLB) return say('La vue 3D n\'est pas disponible : export impossible.', 'bad');
    say('Modèle 3D en préparation…');
    let buffer;
    try {
      buffer = await viewer.exportGLB();
    } catch (error) {
      console.error(error);
      return say('L\'export 3D a échoué (le module d\'export est chargé depuis Internet : vérifiez la connexion).', 'bad');
    }
    const slug = projectSlug();
    let result = await deliver(`${slug}.glb`, new Blob([buffer], { type: 'model/gltf-binary' }), 'model/gltf-binary');
    if (result === 'rejected') {
      // L'artefact n'accepte pas l'extension .glb : le même fichier, rangé dans une archive .zip.
      const zip = zipStore([{ name: `${slug}.glb`, data: new Uint8Array(buffer) }]);
      result = await deliver(`${slug}-glb.zip`, new Blob([zip], { type: 'application/zip' }), 'application/zip');
      say(result === 'saved' || result === 'link' ? `Archive « ${slug}-glb.zip » proposée : elle contient « ${slug}.glb » (l'extension .glb n'est pas acceptée ici, dézippez-la).` : delivered(result, `${slug}-glb.zip`), result === 'failed' ? 'bad' : 'good');
      return;
    }
    say(delivered(result, `${slug}.glb`), result === 'failed' ? 'bad' : 'good');
  });

  $('export-png3d').addEventListener('click', async () => {
    if (!getViewer()) return say('La vue 3D n\'est pas disponible : capture impossible.', 'bad');
    setOpen(false);
    if (!$('panel-3d').offsetParent) $('tab-3d').click(); // téléphone : la vue 3D doit être affichée pour être capturée
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    $('btn-capture').click();
  });

  $('export-share').addEventListener('click', async () => {
    say('Lien en préparation…');
    let lz;
    try {
      lz = await loadLz();
    } catch {
      return say('Le lien n\'a pas pu être créé : la bibliothèque de compression n\'a pas pu être chargée. Utilisez l\'export JSON.', 'bad');
    }
    saver.flush();
    const share = buildShare(store.getState().doc, { compress: lz.compressToEncodedURIComponent, name: projects.active()?.name ?? '' });
    const link = `${shareBase()}#plan=${share.code}`;
    const how = {
      plan: 'plan sans mobilier',
      light: share.lossless ? 'mobilier non inclus, régénéré à l\'identique avec la graine' : 'mobilier non inclus : il sera régénéré avec la graine (il peut différer, par exemple si certaines pièces ont été modifiées à la main)',
      full: 'avec tout le mobilier',
    }[share.mode];
    showText(`Lien de partage (${share.length.toLocaleString('fr-FR')} caractères, ${how}). Si l'ouverture du lien ne charge pas le plan, copiez le code seul et collez-le dans « Importer ».`, link, { code: share.code });
    say(share.length > 8000 ? 'Lien long : certains messageries peuvent le couper. L\'export JSON est plus sûr.' : '');
  });

  /** Bouton « Partager » de l'en-tête : copie le lien de partage ; si le presse-papiers est bloqué, l'affiche dans le panneau. */
  async function shareNow() {
    let lz;
    try {
      lz = await loadLz();
    } catch {
      toast(LABELS.toast.shareFailed, 5000);
      return;
    }
    saver.flush();
    const share = buildShare(store.getState().doc, { compress: lz.compressToEncodedURIComponent, name: projects.active()?.name ?? '' });
    const link = `${shareBase()}#plan=${share.code}`;
    try {
      await navigator.clipboard.writeText(link);
      toast(LABELS.toast.shareCopied(share.length));
    } catch {
      setOpen(true);
      showText(`Lien de partage (${share.length.toLocaleString('fr-FR')} caractères). Copiez-le avec Ctrl+C (ou un appui long).`, link, { code: share.code });
      toast(LABELS.toast.shareShown, 5000);
    }
  }
  $('btn-share').addEventListener('click', shareNow);

  $('export-copy').addEventListener('click', () => copyText($('export-text').value, 'Texte copié.'));
  $('export-copy-code').addEventListener('click', () => copyText($('export-copy-code').dataset.code, 'Code copié.'));
  $('export-out-close').addEventListener('click', () => {
    out.hidden = true;
  });

  /* ---- Import ---- */

  /** Lit un texte (fichier, JSON collé, lien ou code de partage) et l'ouvre comme nouveau projet. */
  async function importText(text, fallbackName) {
    const source = String(text ?? '').trim();
    if (!source) return sayImport('Rien à importer : choisissez un fichier ou collez un plan.', 'bad');
    let result;
    if (source.startsWith('{') || source.startsWith('﻿')) {
      result = parsePlanText(source, { furnitureIds: FURNITURE_IDS });
    } else {
      const code = extractShareCode(source);
      if (!code) {
        result = parsePlanText(source, { furnitureIds: FURNITURE_IDS }); // message d'erreur de lecture du JSON
      } else {
        try {
          const lz = await loadLz();
          result = readShare(code, { decompress: lz.decompressFromEncodedURIComponent, furnitureIds: FURNITURE_IDS });
        } catch {
          return sayImport('Le lien de partage ne peut pas être lu : la bibliothèque de décompression n\'a pas pu être chargée.', 'bad');
        }
      }
    }
    if (!result.ok) return sayImport(result.errors, 'bad');
    const name = result.name || fallbackName || 'Plan importé';
    const opened = openNew(name, result.plan);
    if (!opened.ok) return sayImport(opened.errors, 'bad');
    const notes = [`« ${opened.project.name} » importé : ${describePlan(result.plan)}.`];
    if (result.migrated) notes.push(`Ancien format (version ${result.from}) converti.`);
    if (result.regenerated) notes.push('Mobilier régénéré à partir de la graine.');
    sayImport(notes.join(' '), 'good');
    $('import-text').value = '';
  }

  $('import-go').addEventListener('click', () => importText($('import-text').value, 'Plan collé'));
  $('import-file').addEventListener('change', async (event) => {
    const input = event.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > IMPORT_MAX_BYTES) return sayImport('Ce fichier est trop volumineux pour un plan Maison 3D (10 Mo maximum).', 'bad');
    let text;
    try {
      text = await file.text();
    } catch {
      return sayImport('Ce fichier ne peut pas être lu.', 'bad');
    }
    importText(text, file.name.replace(/\.[^.]+$/, '').slice(0, 60));
  });

  window.addEventListener('hashchange', checkFragment);
  refresh();
  checkFragment();

  return {
    refresh,
    updateBanners,
    loadTemplate,
    shareNow,
    /** Résultat d'un enregistrement : le bandeau d'alerte suit l'état réel du stockage. */
    notify(text) {
      showShareBanner({ error: text });
    },
    onSaveStatus(status) {
      if (status.state === 'unavailable') storageDismissed = false;
      updateBanners();
      renderHint();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Phase 9 : niveaux, grille fine, escaliers, mobilier, finitions, soleil */
/* ------------------------------------------------------------------ */

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const hhmm = (hour) => {
  const total = Math.round(((hour % 24) + 24) % 24 * 60) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

/** Message bref quand l'éditeur refuse un escalier ou un objet (la raison vient de la validation). */
function explainRefusal(notice) {
  if (notice.type === 'stair') return `Escalier impossible ici : ${LABELS.reasons.stair[notice.reason] ?? 'il ne tient pas à cet endroit'}.`;
  const reasons = [...new Set(notice.reasons ?? [])].map((reason) => LABELS.reasons.item[reason] ?? reason);
  return `Impossible ici : ${reasons.length ? reasons.join(', ') : 'la place est prise'}.`;
}

/**
 * Niveaux (onglets, ajout, nom, suppression) et pas de la grille (0,5 m ou 0,1 m, avec confirmation quand la conversion
 * déplace des murs). Tout passe par les actions du store, annulables.
 */
function setupLevels(store, getEditor) {
  const tabs = $('levels-tabs');
  const add = $('level-add');
  const nameInput = $('level-name');
  const remove = $('level-remove');
  const confirmLevel = $('confirm-level');
  const confirmGrid = $('confirm-grid');
  const gridButtons = [...$('grid-seg').querySelectorAll('[data-grid]')];
  let tabsKey = '';
  let pendingGrid = null;

  const closeConfirms = () => {
    confirmLevel.hidden = true;
    confirmGrid.hidden = true;
    pendingGrid = null;
  };

  function render(state) {
    const { doc, level } = state;
    const key = doc.levels.map((item) => item.name).join('\u0001');
    if (key !== tabsKey) {
      tabsKey = key;
      tabs.replaceChildren(
        ...doc.levels.map((item, index) => {
          const button = el('button', 'tool', item.name);
          button.type = 'button';
          button.dataset.level = String(index);
          button.addEventListener('click', () => store.actions.setLevel(index));
          return button;
        }),
      );
    }
    for (const button of tabs.children) button.setAttribute('aria-pressed', String(Number(button.dataset.level) === level));
    add.disabled = doc.levels.length >= PLAN_LIMITS.levelsMax;
    remove.disabled = doc.levels.length <= 1;
    if (document.activeElement !== nameInput) nameInput.value = doc.levels[level].name;
    for (const button of gridButtons) button.setAttribute('aria-pressed', String(Math.abs(Number(button.dataset.grid) - doc.grid.cellSize) < 1e-9));
  }

  add.addEventListener('click', () => {
    closeConfirms();
    if (store.actions.addLevel()) toast(LABELS.levels.added(store.getState().doc.levels[store.getState().level].name));
  });
  nameInput.addEventListener('change', () => {
    store.actions.renameLevel(store.getState().level, nameInput.value);
    render(store.getState()); // réécrit le nom retenu (coupé, nettoyé)
  });
  nameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') nameInput.blur();
  });
  remove.addEventListener('click', () => {
    const { doc, level } = store.getState();
    confirmGrid.hidden = true;
    $('confirm-level-text').textContent = LABELS.levels.confirmRemove(doc.levels[level].name, level > 0 && doc.levels[level - 1].stairs.length > 0);
    confirmLevel.hidden = false;
    $('confirm-level-cancel').focus();
  });
  $('confirm-level-cancel').addEventListener('click', closeConfirms);
  $('confirm-level-ok').addEventListener('click', () => {
    closeConfirms();
    store.actions.removeLevel();
  });

  function applyGrid(target) {
    closeConfirms();
    const result = store.actions.setGridStep(target);
    if (!result.ok) {
      toast(result.errors?.[0] ?? LABELS.grid.failed, 5000);
      return;
    }
    getEditor()?.fit();
    toast(target < 0.5 ? LABELS.grid.nowFine : LABELS.grid.nowCoarse);
  }

  for (const button of gridButtons) {
    button.addEventListener('click', () => {
      const target = Number(button.dataset.grid);
      if (Math.abs(target - store.getState().doc.grid.cellSize) < 1e-9) return;
      const preview = store.previewGridStep(target);
      if (!preview.ok) {
        toast(preview.errors?.[0] ?? LABELS.grid.failed, 5000);
        return;
      }
      const { walls, openings, furniture } = preview.lost;
      if (preview.exact && !walls && !openings && !furniture) {
        applyGrid(target);
        return;
      }
      pendingGrid = target;
      confirmLevel.hidden = true;
      $('confirm-grid-text').textContent = LABELS.grid.confirm(preview.exact, preview.lost);
      confirmGrid.hidden = false;
      $('confirm-grid-cancel').focus();
    });
  }
  $('confirm-grid-cancel').addEventListener('click', closeConfirms);
  $('confirm-grid-ok').addEventListener('click', () => {
    if (pendingGrid !== null) applyGrid(pendingGrid);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && (!confirmLevel.hidden || !confirmGrid.hidden)) closeConfirms();
  });
  store.subscribe(() => {
    if (!confirmLevel.hidden) closeConfirms();
  });

  render(store.getState());
  store.subscribeUi(render);
}

/** Panneau de l'escalier (outil Escalier) : sens, largeur, longueur de la montée, suppression, nombre et hauteur de marches. */
function setupStairPanel(store, getEditor) {
  const panel = $('stair-panel');
  const hint = $('stair-hint');
  const selected = (state) => (state.plan.stairs ?? []).find((stair) => stair.id === state.selectedStairId) ?? null;

  const kindButtons = [...$('st-kind').querySelectorAll('[data-kind]')];
  const stepsSelect = $('st-steps');
  const railSelect = $('st-rail');
  const finishSelect = $('st-finish');
  for (const id of Object.keys(LABELS.stair.steps_)) stepsSelect.add(new Option(LABELS.stair.steps_[id], id));
  for (const id of Object.keys(LABELS.stair.rails)) railSelect.add(new Option(LABELS.stair.rails[id], id));
  for (const finish of STAIR_FINISHES) finishSelect.add(new Option(finish.name, finish.id));

  function render(state) {
    const stair = selected(state);
    panel.hidden = state.tool !== 'stair';
    if (panel.hidden) return;
    const { doc, level } = state;
    const cell = doc.grid.cellSize;
    const editor = getEditor();
    const preview = editor?.stairStyle() ?? {};
    const style = stair
      ? { kind: stairKind(stair), steps: stairSteps(stair), rail: stairRail(stair), finish: stairFinish(stair) }
      : { kind: preview.kind ?? 'straight', steps: preview.under === 'open' ? (STAIR_FRAMES.includes(preview.frame) ? preview.frame : 'stringer') : 'solid', rail: preview.rail ?? 'wood', finish: preview.finish ?? 'oak' };
    $('stair-title').textContent = stair
      ? LABELS.stair.title(doc.levels[level].name, doc.levels[level + 1]?.name ?? LABELS.stair.newLevel)
      : LABELS.stair.placeHint(doc.levels[level].name);
    for (const button of kindButtons) button.setAttribute('aria-pressed', String(button.dataset.kind === style.kind));
    const spiral = style.kind === 'spiral';
    const walled = stair ? stairWallBacked(stair, state.plan) : true;
    stepsSelect.value = style.steps;
    for (const option of stepsSelect.options) {
      option.disabled = (spiral && (option.value === 'spine' || option.value === 'floating')) || (option.value === 'floating' && !walled);
      option.title = LABELS.stair.stepsTitles[option.disabled ? (spiral ? 'spiralOnly' : 'needWall') : option.value];
    }
    stepsSelect.title = LABELS.stair.stepsTitles[style.steps];
    railSelect.value = style.rail;
    railSelect.title = LABELS.stair.railHint[style.rail];
    finishSelect.value = style.finish;
    const straight = style.kind === 'straight';
    const lShape = style.kind === 'l';
    $('st-run').closest('.stepper').hidden = spiral;
    $('st-side-group').hidden = !lShape;
    $('st-width-label').textContent = spiral ? LABELS.stair.diameter : LABELS.stair.width;
    $('st-flip').title = spiral ? LABELS.stair.flipSpiralTitle : straight ? LABELS.stair.flipTitleDefault : LABELS.stair.flipTurnTitle;
    for (const id of ['st-flip', 'st-delete', 'st-narrower', 'st-wider', 'st-shorter', 'st-longer', 'st-side-less', 'st-side-more']) $(id).disabled = !stair;
    $('st-rotate').disabled = false;
    if (!stair) {
      $('st-width').textContent = '—';
      $('st-run').textContent = '—';
      $('st-side').textContent = '—';
      hint.textContent = LABELS.stair.rule(stairStepCount(doc.wallHeight), (stairRise(doc.wallHeight) / stairStepCount(doc.wallHeight)) * 100);
      return;
    }
    const steps = stairStepCount(doc.wallHeight);
    $('st-width').textContent = `${fmtLen.format(spiral ? stair.w : stairBreadth(stair))} m`;
    $('st-run').textContent = `${fmtLen.format(stairRun(stair))} m`;
    $('st-side').textContent = `${fmtLen.format(stairAcross(stair))} m`;
    hint.textContent = LABELS.stair.steps(steps, (stairRise(doc.wallHeight) / steps) * 100, (stairPathLength(stair) / Math.max(steps - 1, 1)) * 100);
  }

  const resize = (which, sign) => {
    const state = store.getState();
    const stair = selected(state);
    if (!stair) return;
    const step = stairKind(stair) === 'spiral' ? 0.25 : state.doc.grid.cellSize;
    const patch = stairResizePatch(stair, which, sign * step);
    if (!patch || !store.actions.updateStair(stair.id, patch)) toast(LABELS.stair.cannotResize);
  };
  $('st-narrower').addEventListener('click', () => resize('width', -1));
  $('st-wider').addEventListener('click', () => resize('width', 1));
  $('st-shorter').addEventListener('click', () => resize('run', -1));
  $('st-longer').addEventListener('click', () => resize('run', 1));
  $('st-side-less').addEventListener('click', () => resize('side', -1));
  $('st-side-more').addEventListener('click', () => resize('side', 1));
  for (const button of kindButtons) {
    button.addEventListener('click', () => {
      const stair = selected(store.getState());
      if (stair) {
        if (!store.actions.setStairKind(stair.id, button.dataset.kind) && stairKind(stair) !== button.dataset.kind) toast(LABELS.stair.kindFits);
      } else {
        getEditor()?.setStairStyle({ kind: button.dataset.kind });
        render(store.getState());
      }
    });
  }
  stepsSelect.addEventListener('change', () => {
    const stair = selected(store.getState());
    const steps = stepsSelect.value;
    if (stair) store.actions.setStairSteps(stair.id, steps);
    else {
      getEditor()?.setStairStyle(steps === 'solid' ? { under: 'solid', frame: 'stringer' } : { under: 'open', frame: steps });
    }
    render(store.getState());
  });
  railSelect.addEventListener('change', () => {
    const stair = selected(store.getState());
    if (stair) store.actions.setStairRail(stair.id, railSelect.value);
    else getEditor()?.setStairStyle({ rail: railSelect.value });
    render(store.getState());
  });
  finishSelect.addEventListener('change', () => {
    const stair = selected(store.getState());
    if (stair) store.actions.setStairFinish(stair.id, finishSelect.value);
    else getEditor()?.setStairStyle({ finish: finishSelect.value });
    render(store.getState());
  });
  $('st-rotate').addEventListener('click', () => {
    const stair = selected(store.getState());
    if (stair) {
      if (!store.actions.rotateStair(stair.id)) toast(LABELS.stair.cannotRotate);
    } else {
      getEditor()?.rotateStairPreview();
    }
  });
  $('st-flip').addEventListener('click', () => {
    const stair = selected(store.getState());
    if (stair && !store.actions.flipStair(stair.id)) toast(LABELS.stair.cannotRotate);
  });
  $('st-delete').addEventListener('click', () => {
    const stair = selected(store.getState());
    if (stair) store.actions.removeStair(stair.id);
  });
  $('st-close').addEventListener('click', () => store.actions.setTool('hand'));

  render(store.getState());
  store.subscribeUi(render);
}

/**
 * Panneau du mobilier (outil Mobilier) : catalogue par catégorie pour ajouter un objet (aperçu qui suit le doigt, second toucher
 * pour poser), et, pour l'objet touché : tourner, remplacer par une variante, autre aspect, dupliquer, supprimer. Retoucher un objet
 * verrouille sa pièce : le générateur n'y touche plus (le cadenas se rouvre ici ou dans la liste des pièces).
 */
function setupFurniturePanel(store, notify) {
  const panel = $('furniture-panel');
  const category = $('item-category');
  const grid = $('item-grid');
  const replace = $('item-replace');
  const hint = $('item-hint');
  let shownCategory = null;
  let shownSelection = null;
  const dims = (size) => `${fmtLen.format(size.w)} × ${fmtLen.format(size.d)} × ${fmtLen.format(size.h)} m`;

  for (const { id, label: text } of FURNITURE_CATEGORIES) {
    const option = el('option', '', text);
    option.value = id;
    category.append(option);
  }
  category.addEventListener('change', () => renderGrid(store.getState()));

  function renderGrid(state) {
    const id = category.value || FURNITURE_CATEGORIES[0].id;
    if (shownCategory !== id) {
      shownCategory = id;
      grid.replaceChildren(
        ...FURNITURE_DEFS.filter((def) => def.category === id).map((def) => {
          const button = el('button', 'item-btn');
          button.type = 'button';
          button.dataset.defId = def.id;
          button.append(el('span', '', def.label), el('small', '', dims(def.size)));
          button.addEventListener('click', () => {
            const pending = store.getState().pendingItem;
            store.actions.setPendingItem(pending?.defId === def.id ? null : { defId: def.id, rotationY: 0 });
          });
          return button;
        }),
      );
    }
    for (const button of grid.children) button.setAttribute('aria-pressed', String(button.dataset.defId === state.pendingItem?.defId));
  }

  const current = (state = store.getState()) => state.plan.furniture.find((item) => item.id === state.selectedItemId) ?? null;
  const run = (result) => {
    if (result && result.ok === false) notify({ type: 'item', reasons: result.reasons });
    return result;
  };

  function render(state) {
    panel.hidden = state.tool !== 'furniture';
    if (panel.hidden) return;
    renderGrid(state);
    const item = current(state);
    $('item-selected').hidden = !item;
    if (item) {
      const def = FURNITURE_DEFS.find((entry) => entry.id === item.defId);
      $('item-name').textContent = def ? `${def.label} · ${dims(def.size)}` : item.defId;
      const variants = variantsOf(item.defId);
      const key = `${item.id}|${item.defId}`;
      if (shownSelection !== key) {
        shownSelection = key;
        replace.replaceChildren(
          Object.assign(el('option', '', variants.length ? LABELS.item.choose : LABELS.item.noVariant), { value: '' }),
          ...variants.map((variant) => Object.assign(el('option', '', variant.label), { value: variant.id })),
        );
      }
      replace.value = '';
      replace.disabled = variants.length === 0;
      const room = store.getRooms().find((entry) => entry.id === item.roomId);
      $('item-lock').hidden = !(room && isRoomLocked(state.plan, room));
    } else {
      shownSelection = null;
    }
    hint.textContent = state.pendingItem
      ? LABELS.item.placing(FURNITURE_DEFS.find((entry) => entry.id === state.pendingItem.defId)?.label ?? '')
      : item
        ? LABELS.item.selectedHint
        : LABELS.item.idleHint;
  }

  $('item-rotate').addEventListener('click', () => {
    const item = current();
    if (item) run(store.actions.rotateFurniture(item.id, 90));
  });
  $('item-reroll').addEventListener('click', () => {
    const item = current();
    if (item) run(store.actions.rerollFurniture(item.id));
  });
  $('item-duplicate').addEventListener('click', () => {
    const item = current();
    if (item) run(store.actions.duplicateFurniture(item.id));
  });
  $('item-delete').addEventListener('click', () => {
    const item = current();
    if (item) run(store.actions.deleteFurniture(item.id));
  });
  replace.addEventListener('change', () => {
    const item = current();
    if (item && replace.value) run(store.actions.replaceFurniture(item.id, replace.value));
    replace.value = '';
  });
  $('item-unlock').addEventListener('click', () => {
    const item = current();
    const room = item && store.getRooms().find((entry) => entry.id === item.roomId);
    if (room) store.actions.toggleRoomLock(room.id, false);
  });
  $('item-close').addEventListener('click', () => store.actions.setTool('hand'));

  render(store.getState());
  store.subscribeUi(render);
}

/** Aperçu d'une finition pour une pastille : motif réel (même dessin que la texture 3D) ou couleur unie. */
const previewCache = new Map();
function finishPreview(finish) {
  if (!finish.pattern) return { color: finish.color };
  if (previewCache.has(finish.id + finish.pattern)) return previewCache.get(finish.id + finish.pattern);
  let result = { color: finish.color };
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      drawFinishPattern(ctx, 96, finish);
      result = { color: finish.color, image: canvas.toDataURL('image/png') };
    }
  } catch {
    /* pas de canvas : la couleur seule */
  }
  previewCache.set(finish.id + finish.pattern, result);
  return result;
}

/**
 * Panneau des finitions de la pièce sélectionnée : sol (parquets, carrelages, béton, moquette), murs (peintures, couleur libre,
 * briques, béton, lambris, papier rayé), plinthes. Chaque choix est une entrée d'historique et se voit aussitôt en 3D.
 */
function setupFinishPanel(store, getViewer) {
  const panel = $('finish-panel');
  const floorBox = $('finish-floor');
  const wallBox = $('finish-wall');
  const boardBox = $('finish-baseboard');
  const colorInput = $('finish-color');
  let sunKey = '';
  let sunTimer = 0;

  function swatchButton(box, value, text, preview, extra = '') {
    const button = el('button', `finish-swatch ${extra}`.trim());
    button.type = 'button';
    button.dataset.value = value;
    button.title = text;
    button.setAttribute('aria-label', text);
    button.setAttribute('aria-pressed', 'false');
    if (preview.image) button.style.backgroundImage = `url(${preview.image})`;
    else if (preview.color) button.style.backgroundColor = preview.color;
    box.append(button);
    return button;
  }

  const selectedRoom = (state) => state.selectedRoomId && store.getRooms().find((room) => room.id === state.selectedRoomId);
  const apply = (patch) => {
    const room = selectedRoom(store.getState());
    if (room) store.actions.setRoomFinish(room.id, patch);
  };

  function buildSwatches() {
    const defaultWall = { color: readSceneWall() };
    swatchButton(floorBox, 'default', LABELS.finish.byType, {}, 'is-default').addEventListener('click', () => apply({ floor: null }));
    for (const finish of FLOOR_FINISHES) swatchButton(floorBox, finish.id, finish.label, finishPreview(finish)).addEventListener('click', () => apply({ floor: finish.id }));
    swatchButton(wallBox, 'default', LABELS.finish.byStyle, defaultWall, 'is-default').addEventListener('click', () => apply({ wall: null }));
    for (const finish of WALL_FINISHES) swatchButton(wallBox, finish.id, finish.label, finishPreview(finish)).addEventListener('click', () => apply({ wall: finish.id }));
    for (const finish of BASEBOARD_FINISHES) {
      swatchButton(boardBox, finish.id, finish.label, finish.color ? { color: finish.color } : { color: 'transparent' }, finish.color ? '' : 'is-none').addEventListener('click', () => apply({ baseboard: finish.id }));
    }
  }
  buildSwatches();
  colorInput.addEventListener('change', () => apply({ wall: colorInput.value }));
  $('finish-reset').addEventListener('click', () => apply({ floor: null, wall: null, baseboard: null }));
  $('finish-close').addEventListener('click', () => store.actions.selectRoom(null));

  function reportSun(state, room) {
    const viewer = getViewer();
    const lighting = state.doc.lighting ?? DEFAULT_LIGHTING;
    const key = `${state.level}|${lighting.month}|${lighting.north}|${lighting.latitude}|${room.id}`;
    const target = $('finish-sun');
    if (!viewer || key === sunKey) return;
    sunKey = key;
    clearTimeout(sunTimer);
    target.textContent = '';
    sunTimer = setTimeout(() => {
      try {
        const entry = viewer.getSunReport(state.level).rooms.find((item) => item.roomId === room.id);
        target.textContent = entry ? LABELS.finish.sun(entry.sunHours, MONTHS[lighting.month - 1]) : '';
      } catch (error) {
        console.warn(error);
      }
    }, 120);
  }

  function render(state) {
    const room = selectedRoom(state);
    panel.hidden = !room;
    if (!room) {
      sunKey = '';
      return;
    }
    $('finish-title').textContent = LABELS.finish.title(roomLabel(state.plan, room));
    const finish = getRoomFinish(state.plan, room);
    const mark = (box, value) => {
      for (const button of box.children) button.setAttribute('aria-pressed', String(button.dataset.value === value));
    };
    mark(floorBox, finish.floor ?? 'default');
    mark(wallBox, finish.wall && finishById(WALL_FINISHES, finish.wall) ? finish.wall : finish.wall ? '' : 'default');
    mark(boardBox, finish.baseboard ?? 'none');
    if (finish.wall && /^#[0-9a-f]{6}$/i.test(finish.wall)) colorInput.value = finish.wall;
    reportSun(state, room);
  }

  render(store.getState());
  store.subscribeUi(render);
  return {
    refreshColors() {
      const first = wallBox.querySelector('[data-value="default"]');
      if (first) first.style.backgroundColor = readSceneWall();
    },
  };
}

const readSceneWall = () => getComputedStyle(document.documentElement).getPropertyValue('--scene-wall').trim() || '#efebe4';

/**
 * Soleil et éclairage : heure (position du soleil, ombres des fenêtres), mois, orientation du logement (nord), luminaires (auto la nuit,
 * allumés, éteints) et ensoleillement des pièces du niveau (panneau). Les réglages sont enregistrés avec le plan, hors historique.
 */
function setupLighting(store, getViewer) {
  const hour = $('lt-hour');
  const month = $('lt-month');
  const north = $('lt-north');
  const lamps = $('lt-lamps');
  const status = $('lt-status');
  const reportButton = $('btn-sun-report');
  const panel = $('sun-panel');
  const latitude = $('lt-lat');
  let reportTimer = 0;

  MONTHS.forEach((name, index) => {
    const option = el('option', '', name);
    option.value = String(index + 1);
    month.append(option);
  });
  for (const [value, text] of [['auto', LABELS.light.lampsAuto], ['on', LABELS.light.lampsOn], ['off', LABELS.light.lampsOff]]) {
    const option = el('option', '', text);
    option.value = value;
    lamps.append(option);
  }

  function render(state) {
    const lighting = { ...DEFAULT_LIGHTING, ...(state.doc.lighting ?? {}) };
    if (document.activeElement !== hour) hour.value = String(lighting.hour);
    $('lt-hour-out').textContent = hhmm(lighting.hour);
    month.value = String(lighting.month);
    if (document.activeElement !== north) north.value = String(lighting.north);
    $('lt-north-out').textContent = `${lighting.north}°`;
    lamps.value = lighting.lamps;
    if (document.activeElement !== latitude) latitude.value = fmtLen.format(lighting.latitude);
    const sun = sunPosition(lighting);
    const degrees = Math.round((sun.elevation * 180) / Math.PI);
    const night = sun.elevation <= 0;
    const lit = lighting.lamps === 'on' || (lighting.lamps === 'auto' && sun.elevation < 0.06);
    status.textContent = `${night ? LABELS.light.night : LABELS.light.sunAt(degrees)}${lit ? LABELS.light.lampsLit : ''}`;
  }

  hour.addEventListener('input', () => store.actions.setLighting({ hour: Number(hour.value) }));
  month.addEventListener('change', () => store.actions.setLighting({ month: Number(month.value) }));
  north.addEventListener('input', () => store.actions.setLighting({ north: Number(north.value) }));
  lamps.addEventListener('change', () => store.actions.setLighting({ lamps: lamps.value }));
  latitude.addEventListener('change', () => {
    const value = parseMeters(latitude.value);
    if (Number.isFinite(value)) store.actions.setLighting({ latitude: value });
    render(store.getState());
  });
  latitude.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') latitude.blur();
  });

  function renderReport() {
    reportTimer = 0;
    const viewer = getViewer();
    if (!viewer || panel.hidden) return;
    const state = store.getState();
    const lighting = { ...DEFAULT_LIGHTING, ...(state.doc.lighting ?? {}) };
    let report;
    try {
      report = viewer.getSunReport(state.level);
    } catch (error) {
      console.warn(error);
      return;
    }
    $('sun-day').textContent = report.rise === null
      ? LABELS.light.noSun(MONTHS[lighting.month - 1])
      : LABELS.light.day(MONTHS[lighting.month - 1], hhmm(report.rise), hhmm(report.set), state.doc.levels[state.level].name);
    const rooms = store.getRooms();
    const rows = report.rooms.map((entry) => {
      const room = rooms.find((item) => item.id === entry.roomId);
      const row = el('li', 'sun-row');
      const head = el('div', 'sun-row-head');
      head.append(el('span', '', room ? roomLabel(state.plan, room) : entry.roomId), el('span', '', LABELS.light.sunHours(entry.sunHours)));
      const bar = el('div', 'sun-bar');
      bar.setAttribute('role', 'img');
      bar.setAttribute('aria-label', LABELS.light.barAria(entry.sunHours, Math.round(entry.now * 100)));
      for (let k = 0; k < 48; k++) {
        const cell = el('i');
        const index = report.hours.indexOf(k / 2);
        const value = index >= 0 ? entry.lit[index] : null;
        cell.style.background = value === null ? 'rgba(86, 103, 116, 0.35)' : value > 0 ? `rgba(242, 182, 50, ${0.3 + 0.7 * value})` : 'rgba(197, 208, 217, 0.9)';
        bar.append(cell);
      }
      const marker = el('b');
      marker.style.left = `calc(${(lighting.hour / 24) * 100}% - 1px)`;
      bar.append(marker);
      row.append(head, bar);
      return row;
    });
    $('sun-list').replaceChildren(...(rows.length ? rows : [el('li', 'panel-hint', LABELS.light.noRooms)]));
  }
  const scheduleReport = () => {
    if (panel.hidden) return;
    clearTimeout(reportTimer);
    reportTimer = setTimeout(renderReport, 160);
  };

  reportButton.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open;
    reportButton.setAttribute('aria-pressed', String(open));
    if (open) renderReport();
  });
  $('sun-close').addEventListener('click', () => {
    panel.hidden = true;
    reportButton.setAttribute('aria-pressed', 'false');
  });

  render(store.getState());
  let lastKey = '';
  store.subscribeUi((state) => {
    render(state);
    const lighting = state.doc.lighting ?? DEFAULT_LIGHTING;
    const key = `${state.level}|${lighting.hour}|${lighting.month}|${lighting.north}|${lighting.latitude}`;
    if (key !== lastKey) scheduleReport();
    lastKey = key;
  });
  store.subscribe(scheduleReport);
  return {
    attach() {
      reportButton.disabled = false;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Phase 8 : visite, accueil, tutoriel, aide, thème, compteur           */
/* ------------------------------------------------------------------ */

const FLAG_WELCOME = 'maison3d.welcome';
const FLAG_TOUR = 'maison3d.tour';
const FLAG_THEME = 'maison3d.theme';
let toastTimer = 0;

/** Message bref en bas de l'écran (région « status » : lu par les lecteurs d'écran). */
function toast(text, ms = 3200) {
  const node = $('toast');
  if (!node) return;
  node.textContent = text;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    node.hidden = true;
  }, ms);
}

/** Visite à la première personne : bouton, joystick virtuel, bouton de retour ; le déplacement lui-même est dans viewer3d.js. */
function setupWalk(store, onWalkEnd = () => {}) {
  const hud = $('walk-hud');
  const stick = $('walk-stick');
  const knob = $('walk-knob');
  const start = $('btn-walk');
  const stage = $('stage-3d');
  const coarse = Boolean(window.matchMedia?.('(pointer: coarse)').matches);
  const frozen = ['btn-view-top', 'btn-view-persp', 'btn-walls-full', 'btn-walls-low', 'btn-walls-auto', 'btn-lv-upto', 'btn-lv-all', 'btn-lv-solo'].map($);
  const levelLabel = $('walk-level');
  let viewer = null;
  let pointer = null;

  $('walk-hint').textContent = coarse ? LABELS.walk.hintTouch : LABELS.walk.hintKeys;
  hud.dataset.touch = String(coarse);

  function drive(event) {
    const rect = stick.getBoundingClientRect();
    const travel = Math.max(1, rect.width / 2 - knob.offsetWidth / 2);
    let dx = event.clientX - (rect.left + rect.width / 2);
    let dy = event.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(dx, dy);
    if (length > travel) {
      dx *= travel / length;
      dy *= travel / length;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    let x = dx / travel;
    let y = dy / travel;
    if (Math.hypot(x, y) < 0.12) {
      x = 0;
      y = 0;
    }
    viewer?.setWalkStick(x, y);
  }

  function release() {
    pointer = null;
    knob.style.transform = '';
    viewer?.setWalkStick(0, 0);
  }

  stick.addEventListener('pointerdown', (event) => {
    if (pointer !== null) return;
    pointer = event.pointerId;
    stick.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    drive(event);
  });
  stick.addEventListener('pointermove', (event) => {
    if (event.pointerId === pointer) drive(event);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    stick.addEventListener(type, (event) => {
      if (event.pointerId === pointer) release();
    });
  }

  let walkedPlan = null;
  let wasActive = false;
  start.addEventListener('click', () => {
    const { selectedRoomId, plan } = store.getState();
    if (!viewer?.startWalk({ roomId: selectedRoomId })) return;
    walkedPlan = plan;
    // Sur téléphone, l'onglet 3D est celui qui montre la visite.
    if (!$('panel-3d').offsetParent) $('tab-3d').click();
  });
  // Le plan change (autre projet, modèle, génération, annulation) : le marcheur pourrait être dans un mur, on revient à la vue d'ensemble.
  store.subscribe(({ plan }) => {
    if (walkedPlan && plan !== walkedPlan) {
      walkedPlan = null;
      viewer?.stopWalk();
    }
  });
  $('walk-exit').addEventListener('click', () => viewer?.stopWalk());

  function onChange(active, level = 0) {
    hud.hidden = !active;
    const { doc } = store.getState();
    levelLabel.hidden = !active || doc.levels.length < 2;
    if (active) levelLabel.textContent = LABELS.walk.level(doc.levels[level]?.name ?? '');
    const levelChangeOnly = active && wasActive; // simple changement de niveau pendant la visite : rien d'autre à faire
    wasActive = active;
    if (levelChangeOnly) return;
    stage.classList.toggle('walking', active);
    document.body.classList.toggle('walking', active); // téléphone : la vue 3D passe en plein écran (voir styles.css)
    for (const button of frozen) if (button) button.disabled = active || !viewer;
    if (!active) {
      walkedPlan = null;
      onWalkEnd();
    }
    start.setAttribute('aria-pressed', String(active));
    if (!active) release();
    toast(active ? LABELS.walk.started('') : LABELS.walk.ended, 2200);
  }

  return {
    attach(next) {
      viewer = next;
      start.disabled = false;
      viewer.onWalkChange(onChange);
    },
    stop: () => viewer?.stopWalk(),
  };
}

/** Compteur de debug : images par seconde, temps de rendu, appels de dessin, triangles (activé depuis l'aide ou Ctrl+Maj+D). */
function setupPerf(getViewer) {
  const node = $('perf-hud');
  let timer = 0;
  const refresh = () => {
    const stats = getViewer()?.getRenderStats?.();
    if (!stats) return;
    node.textContent = [LABELS.perf.line1(stats), LABELS.perf.line2(stats), LABELS.perf.line3(stats)].join('\n');
  };
  function set(on) {
    node.hidden = !on;
    clearInterval(timer);
    if (on) {
      refresh();
      timer = setInterval(refresh, 500);
    }
  }
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      set(node.hidden);
      document.dispatchEvent(new CustomEvent('maison3d:perf', { detail: !node.hidden }));
    }
  });
  return { set, isOn: () => !node.hidden };
}

/** Thème : Auto (celui de l'environnement), Clair ou Sombre ; le choix est mémorisé. */
function setupTheme(storage) {
  const root = document.documentElement;
  const hostTheme = root.getAttribute('data-theme');
  const apply = (mode) => {
    if (mode === 'light' || mode === 'dark') root.setAttribute('data-theme', mode);
    else if (hostTheme) root.setAttribute('data-theme', hostTheme);
    else root.removeAttribute('data-theme');
  };
  let mode = storage.get(FLAG_THEME) ?? 'auto';
  if (!['auto', 'light', 'dark'].includes(mode)) mode = 'auto';
  if (mode !== 'auto') apply(mode);
  return {
    get: () => mode,
    set(next) {
      mode = next;
      storage.set(FLAG_THEME, next);
      apply(next);
    },
  };
}

/** Aide : gestes, raccourcis, partage ; réglages d'affichage (thème, compteur) et accès au tutoriel et aux modèles. */
function setupHelp({ theme, perf, tour, welcome }) {
  const backdrop = $('help-backdrop');
  const body = $('help-body');
  const opener = $('btn-help');

  function build() {
    const nodes = [];
    for (const section of LABELS.help.sections) {
      const block = el('section', 'files-section');
      block.append(el('h3', '', section.title));
      const list = el('dl', 'help-list');
      for (const [term, text] of section.rows) {
        list.append(el('dt', '', term), el('dd', '', text));
      }
      block.append(list);
      nodes.push(block);
    }
    const display = el('section', 'files-section');
    display.append(el('h3', '', LABELS.help.display));
    const themeRow = el('div', 'help-row');
    themeRow.append(el('span', 'help-label', LABELS.help.theme));
    const seg = el('div', 'seg');
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-label', LABELS.help.theme);
    for (const [mode, text] of [['auto', LABELS.help.themeAuto], ['light', LABELS.help.themeLight], ['dark', LABELS.help.themeDark]]) {
      const button = el('button', 'seg-btn', text);
      button.type = 'button';
      button.dataset.theme = mode;
      button.setAttribute('aria-pressed', String(theme.get() === mode));
      button.addEventListener('click', () => {
        theme.set(mode);
        for (const other of seg.children) other.setAttribute('aria-pressed', String(other.dataset.theme === mode));
      });
      seg.append(button);
    }
    themeRow.append(seg);
    const debug = el('label', 'toggle help-debug');
    const check = el('input');
    check.type = 'checkbox';
    check.id = 'help-debug';
    check.checked = perf.isOn();
    check.addEventListener('change', () => perf.set(check.checked));
    document.addEventListener('maison3d:perf', (event) => {
      check.checked = event.detail;
    });
    debug.append(check, el('span', '', LABELS.help.debug));
    const actions = el('div', 'export-out-actions');
    const replay = el('button', 'btn', LABELS.help.replayTour);
    replay.type = 'button';
    replay.addEventListener('click', () => {
      setOpen(false);
      tour.start();
    });
    const templates = el('button', 'btn', LABELS.help.openWelcome);
    templates.type = 'button';
    templates.addEventListener('click', () => {
      setOpen(false);
      welcome.open();
    });
    actions.append(replay, templates);
    display.append(themeRow, debug, actions);
    nodes.push(display);
    body.replaceChildren(...nodes);
  }

  function setOpen(open) {
    backdrop.hidden = !open;
    opener.setAttribute('aria-expanded', String(open));
    if (open) {
      build();
      $('help-close').focus();
    } else {
      opener.focus({ preventScroll: true });
    }
  }
  opener.addEventListener('click', () => setOpen(backdrop.hidden));
  $('help-close').addEventListener('click', () => setOpen(false));
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !backdrop.hidden) setOpen(false);
  });
  return { open: () => setOpen(true) };
}

/** Miniature SVG d'un plan : ses murs en traits, pour les cartes de l'écran d'accueil. */
function planThumbnail(plan) {
  const ns = 'http://www.w3.org/2000/svg';
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { x, y, dir } of plan.walls) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, dir === 'h' ? x + 1 : x);
    maxY = Math.max(maxY, dir === 'v' ? y + 1 : y);
  }
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `${minX - 1} ${minY - 1} ${maxX - minX + 2} ${maxY - minY + 2}`);
  svg.setAttribute('class', 'template-thumb');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', plan.walls.map(({ x, y, dir }) => `M${x} ${y}${dir === 'h' ? 'h1' : 'v1'}`).join(''));
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '0.35');
  path.setAttribute('stroke-linecap', 'square');
  svg.append(path);
  const doors = document.createElementNS(ns, 'path');
  doors.setAttribute('d', plan.openings.map(({ start, span }) => `M${start.x} ${start.y}${start.dir === 'h' ? `h${span}` : `v${span}`}`).join(''));
  doors.setAttribute('fill', 'none');
  doors.setAttribute('stroke', 'var(--accent)');
  doors.setAttribute('stroke-width', '0.5');
  svg.append(doors);
  return svg;
}

/** Écran d'accueil : modèles de départ. Montré au premier lancement avec un plan vide, puis depuis l'aide ou le panneau Projets. */
function setupWelcome({ store, storage, loadTemplate, onClose }) {
  const backdrop = $('welcome');
  const grid = $('template-grid');
  let built = false;

  function build() {
    if (built) return;
    built = true;
    for (const template of TEMPLATES) {
      const text = LABELS.templates[template.id];
      const plan = buildTemplate(template.id);
      const rooms = detectRooms(plan).length;
      const item = el('li');
      const card = el('button', 'template-card');
      card.type = 'button';
      card.dataset.template = template.id;
      card.setAttribute('aria-label', LABELS.welcome.templateAria(text.label, text.description));
      const info = el('span', 'template-info');
      info.append(el('b', '', text.label), el('small', '', LABELS.welcome.pieces(rooms)), el('span', '', text.description));
      card.append(planThumbnail(plan), info);
      card.addEventListener('click', () => {
        loadTemplate(template.id, text.label);
        close();
        toast(LABELS.welcome.open(text.label));
      });
      item.append(card);
      grid.append(item);
    }
  }

  function open() {
    build();
    backdrop.hidden = false;
    storage.set(FLAG_WELCOME, '1');
    grid.querySelector('button')?.focus();
  }
  function close() {
    if (backdrop.hidden) return;
    backdrop.hidden = true;
    onClose?.();
  }
  $('welcome-close').addEventListener('click', close);
  $('welcome-skip').addEventListener('click', close);
  $('welcome-blank').addEventListener('click', close);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !backdrop.hidden) close();
  });
  return { open, close, isOpen: () => !backdrop.hidden };
}

/** Tutoriel en 4 étapes (tracer, nommer, voir en 3D, générer), affiché une seule fois ; l'élément concerné est entouré. */
function setupTour({ storage }) {
  const card = $('tour');
  const steps = LABELS.tour.steps;
  const targets = ['[data-tool="wall"]', '[data-tool="room"]', '#level-add', '#btn-walk', '#btn-generate', '#lt-hour'];
  let index = 0;
  let focused = null;

  const unfocus = () => {
    focused?.classList.remove('tour-focus');
    focused = null;
  };

  function render() {
    const step = steps[index];
    $('tour-step').textContent = LABELS.tour.step(index + 1, steps.length);
    $('tour-title').textContent = step.title;
    $('tour-text').textContent = step.text;
    $('tour-prev').hidden = index === 0;
    $('tour-next').textContent = index === steps.length - 1 ? LABELS.tour.done : LABELS.tour.next;
    unfocus();
    focused = document.querySelector(targets[index]);
    if (focused && !focused.offsetParent) $(focused.closest('#panel-3d') ? 'tab-3d' : 'tab-plan').click(); // téléphone : un seul panneau à la fois
    focused?.classList.add('tour-focus');
    focused?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  function end() {
    card.hidden = true;
    unfocus();
    storage.set(FLAG_TOUR, '1');
  }

  function start() {
    index = 0;
    card.hidden = false;
    render();
    $('tour-next').focus({ preventScroll: true });
  }

  $('tour-next').addEventListener('click', () => {
    if (index >= steps.length - 1) end();
    else {
      index++;
      render();
    }
  });
  $('tour-prev').addEventListener('click', () => {
    index = Math.max(0, index - 1);
    render();
  });
  $('tour-skip').addEventListener('click', end);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !card.hidden) end();
  });
  return { start, seen: () => storage.get(FLAG_TOUR) === '1' };
}

export async function init() {
  applyLabels();
  const storage = createStorage();
  const projects = createProjects(storage);
  const loaded = projects.load();
  let startPlan = loaded.plan;
  let unreadable = null;
  if (!startPlan) {
    // Premier lancement, stockage vide ou indisponible, ou projet actif illisible (conservé tel quel dans la liste).
    if (loaded.status === 'invalid') unreadable = `Le projet « ${loaded.project?.name ?? 'précédent'} » n'a pas pu être relu (${loaded.errors[0] ?? 'données invalides'}). Il reste dans la liste de vos projets, sans être modifié.`;
    startPlan = createEmptyDocument();
    const project = projects.create(loaded.project ? 'Nouveau projet' : 'Mon logement', startPlan);
    projects.setActive(project.id);
  }
  const store = createStore(startPlan);
  let editor = null;
  let viewer = null;
  let files = null;

  renderStatus(store.getState().plan, store.getRooms().length);
  store.subscribe(({ plan }) => renderStatus(plan, store.getRooms().length));
  renderWarning(store);
  store.subscribe(() => renderWarning(store));
  renderToolbar(store.getState());
  store.subscribeUi(renderToolbar);

  const saver = autosave(store, projects, (status) => {
    renderSave(status);
    files?.onSaveStatus(status);
  });
  renderSave({ state: !projects.isAvailable() ? 'unavailable' : loaded.status === 'restored' ? 'restored' : 'ready' });

  setupToolbar(store, () => editor);
  setupShortcuts(store);
  const viewControls = setupViewControls();
  const walk = setupWalk(store, () => viewControls.sync());
  setupTabs((view) => {
    if (view === 'plan') walk.stop();
    editor?.resize();
    viewer?.resize();
  });
  const theme = setupTheme(storage);
  const perf = setupPerf(() => viewer);
  const generator = setupGenerator(store);
  setupCatalog();
  const roomsPanel = setupRoomsPanel(store, () => editor, generator);
  const roomMenu = setupRoomMenu(store);
  setupOpeningPanel(store);
  let lastNotice = '';
  let lastNoticeAt = 0;
  const onNotice = (notice) => {
    const text = explainRefusal(notice);
    if (text === lastNotice && performance.now() - lastNoticeAt < 1500) return; // un glissement refusé ne répète pas le message
    lastNotice = text;
    lastNoticeAt = performance.now();
    toast(text, 2600);
  };
  setupLevels(store, () => editor);
  setupStairPanel(store, () => editor);
  setupFurniturePanel(store, onNotice);
  const finishPanel = setupFinishPanel(store, () => viewer);
  const lighting = setupLighting(store, () => viewer);
  const runInitialTests = setupTests();
  files = setupFiles({ store, projects, storage, saver, getEditor: () => editor, getViewer: () => viewer });
  if (unreadable) files.notify(unreadable);
  const tour = setupTour({ storage });
  const welcome = setupWelcome({
    store,
    storage,
    loadTemplate: (id, name) => files.loadTemplate(id, name),
    onClose: () => {
      if (!tour.seen()) tour.start();
    },
  });
  setupHelp({ theme, perf, tour, welcome });
  // Premier lancement avec un plan vide : écran d'accueil (puis tutoriel) ; sinon rien ne s'interpose.
  const firstPlan = store.getState().plan;
  if (storage.get(FLAG_WELCOME) !== '1' && firstPlan.walls.length === 0 && !unreadable && !window.location.hash.includes('plan=')) {
    welcome.open();
  } else if (!tour.seen() && firstPlan.walls.length === 0) {
    tour.start();
  }
  watchTheme(() => {
    editor?.refreshTheme();
    viewer?.refreshTheme();
    roomsPanel.refreshColors();
    roomMenu.refreshColors();
    finishPanel.refreshColors();
  });

  try {
    editor = createEditor2D($('canvas-2d'), store, { onRoomTap: roomMenu.onRoomTap, onNotice });
  } catch (error) {
    console.error(error);
    showNotice('notice-2d', LABELS.noCanvas, String(error?.message ?? error));
  }

  // Un panneau contextuel (ouverture, escalier, mobilier, finitions) qui s'ouvre dans la colonne de droite s'y fait voir.
  const sideStack = $('side-stack');
  if (sideStack && typeof MutationObserver !== 'undefined') {
    new MutationObserver((records) => {
      for (const record of records) {
        const node = record.target;
        if (record.attributeName === 'hidden' && !node.hidden && node.parentElement === sideStack) {
          const smooth = !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
          node.scrollIntoView?.({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
        }
      }
    }).observe(sideStack, { attributes: true, attributeFilter: ['hidden'], subtree: true });
  }
  $('stage-3d').__store = store; // accès pour les scripts de vérification (verify/)
  runInitialTests();

  // Chargé à part : si Three.js ne se charge pas, le plan 2D et les tests restent utilisables.
  try {
    const { createViewer3D } = await import('./viewer3d.js');
    viewer = createViewer3D($('stage-3d'), store);
    $('stage-3d').__viewer = viewer; // accès pour les scripts de vérification (verify/)
    viewControls.attach(viewer);
    walk.attach(viewer);
    lighting.attach();
  } catch (error) {
    console.error(error);
    const detail = String(error?.message ?? error);
    showNotice('notice-3d', /webgl/i.test(detail) ? LABELS.noWebgl : LABELS.no3d, detail);
  }
}

if (typeof document !== 'undefined' && document.getElementById('canvas-2d')) {
  init();
}
