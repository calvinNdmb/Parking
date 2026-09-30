# API de données ParkPrix — v1

Données statiques (JSON / GeoJSON, WGS84) générées par `npm run data` et servies avec le site :

```
<BASE>/data/v1/meta.json              version, tarifs officiels, catégories, couverture, sources
<BASE>/data/v1/zones.geojson          2 zones tarifaires (polygones)
<BASE>/data/v1/voirie.json            ~60 000 emplacements sur rue (format compact, voir plus bas)
<BASE>/data/v1/parkings.geojson       ~280 parkings (points) fusionnés depuis 5 sources
<BASE>/data/v1/belib.geojson          stations de recharge Belib'
<BASE>/data/v1/arrondissements.geojson  contours + couverture par arrondissement
<BASE>/data/v1/coverage-grid.geojson  grille de couverture (mailles de 200 m)
<BASE>/sprites/parkprix[@2x].{json,png}  icônes de la carte (sprite MapLibre)
```

`<BASE>` = l'URL du site (ex. GitHub Pages `https://<compte>.github.io/Parking/`).
Le client TypeScript `createDataClient(BASE)` de `@parkprix/core` charge et décode tout (web, Node, React Native).
Toute évolution incompatible du format donnera un dossier `v2` ; `meta.schemaVersion` vaut `1`.
Licence : bases dérivées de données ODbL → **ODbL** (attribution « Paris Data, Saemes, Indigo, BNLS, OpenStreetMap »).

## meta.json

| Champ | Type | Contenu |
|---|---|---|
| `schemaVersion` | `1` | version du contrat |
| `generatedAt` | ISO 8601 | date de génération |
| `categories` | `string[]` | ordre des catégories de voirie.json : `mixte`, `rotatif`, `gratuit`, `moto`, `pmr`, `electrique`, `livraison`, `velo` |
| `tariffs` | `{ "1": ZoneTariffs, "2": ZoneTariffs }` | grille officielle par zone : prix de chaque tranche horaire (6 tranches) pour `vl`, `vlSamedi`, `suv`, `moto`, `motoSamedi` |
| `coverage` | objet | couverture spatiale, places, parkings, contrôle horodateurs (voir `CoverageMeta` dans `packages/core/src/types.ts`) |
| `sources` | `SourceMeta[]` | nom, fournisseur, URL, licence, nombre d'enregistrements |

Exemple de grille : zone 1 voiture `[6, 6, 12, 15, 18, 18]` → 1 h = 6 €, 2 h = 12 €, 3 h = 24 €, 6 h = 75 €
(chaque quart d'heure coûte le quart du tarif de l'heure en cours : `progressiveCost()`).

## voirie.json (format compact)

```jsonc
{
  "version": 1,
  "origin": [2.2, 48.8],         // origine des coordonnées
  "scale": 1000000,              // micro-degrés
  "categories": ["mixte", …],     // = meta.categories
  "typsta": ["", "Longitudinal", "Épi", "Bataille"],
  "streets": ["", "Rue de Chabrol", …],   // dictionnaires de chaînes
  "zonesRes": ["", "10G", …],
  "regimes": ["", "Mixte", "Vélos", …],
  "hours": ["", "05:00–14:30", …],
  "rows": [
    // [cat, places, zone, arr, street, numFrom, numTo, zoneRes, typsta, regime, hours, ring]
    [0, 3, 1, 10, 1, 59, 73, 1, 1, 1, 0, [150670, 77175, 10, 0, 0, 20, -10, 0]]
  ]
}
```

- Les colonnes 0 à 10 sont des entiers ; les colonnes `street`, `zoneRes`, `typsta`, `regime`, `hours` sont des index dans les dictionnaires.
- `zone` : 1 ou 2 (0 = hors zone tarifaire) ; `arr` : arrondissement (bois rattachés au 12e / 16e).
- `ring` : contour de l'emprise, premier sommet en micro-degrés depuis `origin`, puis deltas `[dx, dy, …]` (anneau non refermé).
  `decodeVoirie()` reconstruit les polygones GeoJSON (propriétés `k = cat × 10 + zone` et `c = cat`) et un index des centres.

## parkings.geojson

Points (`FeatureCollection<Point>`) ; propriétés principales (type `CarPark`) :

| Champ | Contenu |
|---|---|
| `id` | identifiant stable préfixé par la source (`paris:75101-P-006`, `saemes:PMO33`, `osm:way/123`, `indigo:1553`, `bnls:…`) |
| `name`, `address`, `operator`, `url`, `phone` | fiche |
| `public` | `false` = réservé aux abonnés |
| `covered`, `kind` | parking fermé (`underground`, `multi-storey`, `rooftop`) ou `surface` — les parkings fermés portent un « P » |
| `prices` | `{ "15": 1.35, "60": 5.4, "1440": 48.6, … }` durée en minutes → prix en € (ou `null`) |
| `pricesDate`, `pricesSource` | fraîcheur et source des tarifs |
| `motoPrices` | idem pour les deux-roues motorisés |
| `estimate` | pour les parkings sans tarif ouvert : médiane des voisins (`{ "60", "1440", n, radiusM }`), à afficher « ≈ » |
| `places`, `placesPmr`, `placesMoto`, `placesVelo`, `placesEv`, `heightMax` | capacités |
| `motoAccess`, `veloAccess` | `true` / `false` / `null` (inconnu) |
| `subscriptions` | abonnements mensuels / annuels (`residentMonth`, `month`, `year`, `motoMonth`, `veloMonth`, `veloDay`, …) |
| `forfaits` | forfaits nuit / week-end (Saemes) |
| `sources` | toutes les sources fusionnées dans la fiche |

Prix pour une durée quelconque : `quoteCarPark(prices, minutes)` (interpolation au quart d'heure, cumul au-delà de 24 h).

## zones.geojson, belib.geojson, arrondissements.geojson, coverage-grid.geojson

- `zones` : `{ zone: 1 | 2 }`.
- `belib` : `{ name, address, pdc, kw, twoWheels, hours }` (une station par point).
- `arrondissements` : `{ ar, nom, label, coverage }` (part des mailles couvertes).
- `coverage-grid` : carrés de 200 m `{ ok: 0 | 1 }` (1 = prix connu à moins de 250 m).

## Sources amont

Paris Data (zones tarifaires, emprises, stationnement en ouvrage, horodateurs, Belib', arrondissements),
open data Saemes, Parkings Indigo (APDS, transport.data.gouv.fr), Base nationale des lieux de stationnement,
OpenStreetMap (Overpass). Détails, licences et fraîcheur : `meta.sources` et [PLAN.md](../PLAN.md).
