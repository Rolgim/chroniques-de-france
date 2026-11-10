# Chroniques de France

Une application web pour apprendre l'histoire de France en jouant, de la Préhistoire à nos jours.
Elle s'installe sur Android (ou sur ordinateur) comme une application et fonctionne hors ligne.

## Contenu

- **21 chapitres** : Préhistoire, Gaule, Mérovingiens, Carolingiens, Capétiens, guerre de Cent Ans, Renaissance,
  guerres de Religion, Grand Siècle, Lumières, Révolution, Empire, monarchies du XIXe siècle, Second Empire,
  IIIe République, Grande Guerre, entre-deux-guerres, Seconde Guerre mondiale, IVe République, Ve République.
- Pour chaque chapitre : une leçon, les dates clés, les personnages, une épreuve notée sur trois étoiles.
- Environ 300 dates, 125 personnages, 250 questions rédigées, plus des questions générées à partir des dates.
- **Jeux** : épreuve de chapitre, chronologie, devine l'année, qui suis-je ?, survie, rois et présidents,
  cartes mémoire en répétition espacée, défi du jour.
- **Progression** : points d'expérience, 16 rangs (de Serf à Légende), série quotidienne, 26 badges.

## Lancer en local

Aucune installation ni compilation : ce sont des fichiers statiques.

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

Ouvrir directement `index.html` fonctionne aussi, mais sans le mode hors ligne ni l'installation.

## Publier sur GitHub Pages

1. Créer un dépôt sur GitHub et y pousser ce dossier :
   ```bash
   git init -b main
   git add .
   git commit -m "Chroniques de France"
   git remote add origin https://github.com/<utilisateur>/<depot>.git
   git push -u origin main
   ```
2. Sur GitHub : **Settings → Pages → Build and deployment**, choisir **Deploy from a branch**, branche `main`, dossier `/ (root)`.
3. Après une minute, le site est en ligne sur `https://<utilisateur>.github.io/<depot>/`.

Tous les chemins sont relatifs : l'application fonctionne telle quelle dans un sous-dossier.

## Installer sur Android

Ouvrir l'adresse du site dans Chrome, puis **menu ⋮ → Installer l'application** (ou le bouton
« Installer l'application » affiché sur l'accueil). L'icône apparaît sur l'écran d'accueil et l'application
s'ouvre en plein écran, même sans connexion.

Pour obtenir un vrai fichier APK ou publier sur le Play Store, le site en ligne peut être empaqueté
avec [PWABuilder](https://www.pwabuilder.com/) sans modifier le code.

## Mettre à jour

Après toute modification, incrémenter `VERSION` dans `sw.js` (par exemple `chroniques-v2`) : les appareils
déjà installés téléchargeront la nouvelle version au lancement suivant.

## Ajouter ou corriger du contenu

Tout le contenu est dans `js/data/`. Le format est décrit en tête de `js/data/00-core.js` :

```js
ev:   [année, "Titre", "Description", "a"]   // "a" = date approximative (facultatif)
pers: ["Nom", "dates", "rôle", "biographie", ["indice difficile", "indice moyen", "indice facile"]]
qcm:  ["Question", "Bonne réponse", ["Fausse 1", "Fausse 2", "Fausse 3"], "Explication"]
vf:   ["Affirmation", true, "Explication"]
```

Dans le texte des leçons, `*mot*` met un terme en valeur. Les événements d'un chapitre doivent rester
classés par année croissante.

## Structure

```
index.html              page unique
css/style.css           styles, thèmes clair et sombre
js/app.js               navigation, jeux, progression
js/data/*.js            contenu historique
sw.js                   cache hors ligne
manifest.webmanifest    déclaration de l'application installable
icons/                  icônes
```

La progression est enregistrée dans le navigateur de l'appareil (`localStorage`) ; l'onglet Profil permet
de l'exporter et de l'importer.
