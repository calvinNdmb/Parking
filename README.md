# ParkPrix Paris

Carte interactive **« façon Waze »** du prix du stationnement à Paris : places sur rue (zones 1 et 2, grille
progressive officielle) et parkings, pour la durée, l'heure d'arrivée et le véhicule choisis.
Construite uniquement avec des **données ouvertes et des API gratuites**, sans clé.

**Couverture : 91,5 % de Paris** (objectif 80 %) · 116 853 places sur rue tarifées · 100 parkings avec tarifs publiés.

![Vue d'ensemble : pastilles de prix des parkings et zones tarifaires](docs/apercu-paris.jpg)

| Ordinateur | Mobile | Mode nuit |
|---|---|---|
| ![Carte sur ordinateur](docs/apercu-ordinateur.jpg) | ![Carte sur mobile](docs/apercu-mobile.jpg) | ![Mode nuit et fiche parking](docs/apercu-nuit.jpg) |

➡️ Le plan complet (recherche des sources, stratégie de couverture, architecture, feuille de route) est dans **[PLAN.md](PLAN.md)**.

## Fonctionnalités

- **Prix partout** : bordures de trottoir colorées selon le prix, pastilles de prix sur chaque parking, étiquettes par zone.
- **Selon votre situation** : voiture, SUV / véhicule lourd (tarif ×3), deux-roues, électrique (gratuit ≤ 2 t) ;
  durée de 30 min à 24 h ; arrivée « maintenant » ou à une date précise (dimanche, soirée et jours fériés gratuits).
- **« Les moins chers autour »** d'une adresse (recherche IGN), de votre position ou de n'importe quel point de la carte.
- **Fiches détaillées** : grille horaire, forfaits, abonnements, horaires, hauteur max., règles de la voirie
  (6 h max., FPS, secteur résidentiel), bouton **« Y aller avec Waze »** et Google Maps.
- **Mode nuit**, bornes Belib', parkings réservés aux abonnés, **carte de couverture** des données.
- Couleurs en €/h équivalent : `0` · `≤ 3` · `≤ 4,5` · `≤ 5,5` · `≤ 7` · `> 7`.

## Démarrer

Prérequis : Node.js ≥ 22.12.

```bash
npm install
npm run dev        # http://localhost:5173
```

Les données sont déjà générées dans `public/data/` : le site fonctionne immédiatement.

### Régénérer les données

```bash
npm run data                 # utilise le cache disque .cache/sources (12 h)
npm run data -- --refresh    # re-télécharge toutes les sources
```

Le script `scripts/build-data.mjs` télécharge Paris Data, Saemes, Indigo, la BNLS et OpenStreetMap (avec
plusieurs miroirs Overpass), fusionne les parkings, vérifie la grille tarifaire avec les horodateurs et
recalcule la couverture. Derrière un proxy HTTPS, il active automatiquement `NODE_USE_ENV_PROXY`.

### Vérifier et construire

```bash
npm run typecheck
npm test           # moteur de prix, jours fériés, décodage des données, pipeline
npm run build      # site statique dans dist/
npm run preview
```

## Déploiement (GitHub Pages)

Le workflow `.github/workflows/deploy.yml` construit et publie le site à chaque push sur `main`, et
**régénère les données chaque lundi**. À activer une fois : *Settings → Pages → Source : GitHub Actions*.
Le site est 100 % statique (chemins relatifs) : n'importe quel hébergement de fichiers convient.

## Structure

```
scripts/build-data.mjs     pipeline de données (sans dépendance)
scripts/lib/               géométrie, CSV/BNLS, textes, téléchargement avec cache
public/data/               données générées : voirie, parkings, zones, Belib', couverture, méta
src/pricing.ts             moteur de prix (règles 2026 de la Ville de Paris)
src/app/model.ts           prix affichés, couleurs, « moins chers autour »
src/map/                   fond de carte façon Waze (jour/nuit), calques, pastilles
src/ui/                    recherche d'adresse, panneau, fiches
tests/                     tests Vitest
```

## Sources et licences

| Donnée | Fournisseur | Licence |
|---|---|---|
| Zones tarifaires, emprises de stationnement, parkings en ouvrage, horodateurs, Belib', arrondissements | [Paris Data](https://opendata.paris.fr) — Ville de Paris | ODbL |
| Référentiel parkings | [Open data Saemes](https://opendata.saemes.fr) | Licence ouverte |
| Parkings Indigo (APDS) | [transport.data.gouv.fr](https://transport.data.gouv.fr/datasets/indigo-open-data-parkings) | ODbL |
| Base nationale des lieux de stationnement | [transport.data.gouv.fr](https://transport.data.gouv.fr/datasets/base-nationale-des-lieux-de-stationnement) | ODbL |
| Parkings, fond de carte | © contributeurs [OpenStreetMap](https://www.openstreetmap.org/copyright), tuiles [OpenFreeMap](https://openfreemap.org) | ODbL |
| Géocodage | [Géoplateforme IGN](https://data.geopf.fr/geocodage) | Licence ouverte |

Les fichiers de `public/data/` sont des bases de données dérivées, diffusées sous **ODbL**.
Les prix sont **indicatifs** : les tarifs des parkings sans données ouvertes sont estimés (« ≈ ») d'après les
parkings voisins et signalés comme tels. ParkPrix n'est ni affilié à Waze ni à la Ville de Paris.
