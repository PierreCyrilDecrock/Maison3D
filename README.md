# Maison 3D (PWA)

Application web installable, sans serveur ni compte : dessin du plan 2D, étages et escaliers, mobilier généré (garage, chambres, cuisine…), finitions, soleil, visite 3D. Elle fonctionne **hors ligne** après le premier chargement ; les plans sont enregistrés dans le navigateur (localStorage).

## Publier sur GitHub Pages
1. Créez un dépôt GitHub et envoyez-y **le contenu de ce dossier à la racine** (index.html au niveau le plus haut, pas dans un sous-dossier).
2. Dépôt → *Settings* → *Pages* → *Build and deployment* → *Source* : « Deploy from a branch », branche `main`, dossier `/ (root)`.
3. Après une minute, l'application est sur `https://<votre-compte>.github.io/<depot>/`. Ouvrez-la en HTTPS : le navigateur propose « Installer » / « Ajouter à l'écran d'accueil ».

Tous les chemins sont relatifs : l'application marche à la racine d'un domaine comme dans un sous-dossier (`/<depot>/`). Aucune étape de compilation.

## Mettre à jour
Remplacez les fichiers et validez. `sw.js` change de numéro de version dès qu'un fichier change (reconstruisez-le : modifiez la ligne `const VERSION` si vous éditez à la main). Les utilisateurs voient un bandeau « Une nouvelle version est disponible » et la prennent quand ils veulent.

## Contenu
- `index.html`, `styles.css`, `*.js` : l'application (modules ES, sans framework).
- `vendor/` : Three.js 0.160.0 (licence MIT, voir `vendor/three/LICENSE`) et lz-string, copiés en local pour le hors-ligne.
- `manifest.webmanifest`, `sw.js`, `pwa.js`, `icons/` : la partie PWA.
- `tests.js` : tests intégrés (bouton « Tests » de l'en-tête).
- Les polices (Google Fonts) se chargent si le réseau est là et sont gardées en cache ; l'interface a des polices de secours.
