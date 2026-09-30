# ParkPrix Paris — plan du projet

> **Objectif** : un site avec une carte « façon Waze » qui montre le prix du stationnement partout dans Paris
> (places sur rue et parkings), construit uniquement avec des API et bases de données **gratuites**,
> avec une couverture d'environ **80 % de Paris**.
>
> **Résultat** : **91,5 %** du territoire parisien couvert (mailles de 200 m ayant un prix connu à moins de 250 m),
> **100 %** des places voiture sur rue tarifées, **272 parkings fermés** marqués d'un « P » dont **100** avec leurs tarifs,
> **147 874 places vélo** et **43 193 places deux-roues** sur rue, **89 %** des places publiques voiture recensées avec un prix.
>
> **Objectif suivant** : brancher la démo dans une **app Expo** — le cœur (prix, données, style de carte) est déjà
> partagé et indépendant du navigateur (voir § 4 et [docs/EXPO.md](docs/EXPO.md)).

---

## 1. Comment se forme le prix d'une place à Paris (règles vérifiées en septembre 2026)

### Sur rue (≈ 117 000 places voiture, ≈ 43 000 places deux-roues payantes)

| Règle | Valeur | Source |
|---|---|---|
| Jours et heures payants | lundi → samedi, 9 h → 20 h, **y compris en août** ; gratuit le dimanche, les jours fériés et la nuit | paris.fr « Payer son stationnement » |
| Zones tarifaires | **Zone 1** = arrondissements 1 à 11 · **Zone 2** = arrondissements 12 à 20 | jeu Paris Data « zones tarifaires » |
| Grille visiteur (progressive, par tranche horaire) | Zone 1 : 6 · 6 · 12 · 15 · 18 · 18 € → **6 / 12 / 24 / 39 / 57 / 75 €** cumulés<br>Zone 2 : 4 · 4 · 8 · 10 · 12 · 12 € → **4 / 8 / 16 / 26 / 38 / 50 €** cumulés | Paris Data + paris.fr |
| Paiement | par tranches de **15 min** ; durée max. visiteur **6 h** | paris.fr |
| Forfait post-stationnement (FPS) | 75 € (zone 1) / 50 € (zone 2) = coût des 6 h | paris.fr |
| SUV / véhicules lourds (depuis le 1ᵉʳ octobre 2024) | tarif **×3** : 18 €/h (zone 1), 12 €/h (zone 2) pour thermique/hybride > 1,6 t et électrique > 2 t | paris.fr |
| Deux-roues motorisés | 3 €/h (zone 1), 2 €/h (zone 2), grille progressive ; **électriques gratuits** | paris.fr |
| Voitures électriques ≤ 2 t | **gratuites** sur tous les emplacements payants, sans limite de durée | paris.fr |
| Résidents | 1,50 €/jour, 9 €/semaine (0,75 €/jour en deux-roues) dans leur secteur | paris.fr |
| Titulaires CMI-S (handicap) | gratuit | paris.fr |
| Bois de Boulogne / Vincennes | grille spécifique (jusqu'à 11 h mer./sam.), horodateurs à 4 €/h | paris.fr + horodateurs |

### En parking (ouvrage)
Tarifs libres fixés par chaque exploitant (Indigo, Saemes, Q-Park, Effia, Interparking…) ; dans les parkings
concédés par la Ville, facturation au quart d'heure et plafond journalier.

**Conséquence pour la couverture** : la voirie se couvre à 100 % en combinant *zones tarifaires* + *emprises*
(chaque place hérite du tarif de sa zone) ; les parkings demandent de **croiser plusieurs sources**.

---

## 2. Recherche des sources gratuites (API, bases de données)

| Source | Contenu | Accès | Licence | Fraîcheur | Rôle dans le projet |
|---|---|---|---|---|---|
| **Paris Data — zones tarifaires** | 2 polygones + grille officielle complète (voiture, SUV, deux-roues, semaine/samedi) | API Opendatasoft v2.1 `stationnement-sur-voie-publique-zones-tarifaires` | ODbL | à jour | ✅ **tarifs sur rue** |
| **Paris Data — emprises de stationnement** | 65 833 polygones de places (régime mixte/rotatif/gratuit/livraison/PMR/**motos**/**vélos**/Belib', nb de places, rue, secteur résidentiel) | `stationnement-sur-voie-publique-emprises` (export GeoJSON 82 Mo) | ODbL | modifié le 30/09/2026 | ✅ **carte des places sur rue** |
| Paris Data — emplacements | même contenu en points | `stationnement-voie-publique-emplacements` | ODbL | modifié le 30/09/2026 | alternative (non utilisée) |
| **Paris Data — stationnement en ouvrage** | 125 parkings concédés : tarifs 15 min → 24 h, deux-roues, abonnements, hauteur, PMR | `stationnement-en-ouvrage` | ODbL | 2026 | ✅ **source n° 1 des parkings** |
| **Open data Saemes** | 65 parkings (60 à Paris) : tarifs 15 min / 1 h / 3 h / 24 h (2026), forfaits nuit/week-end, abonnements | `opendata.saemes.fr` API `referentiel-parkings-saemes` | Licence ouverte | tarifs 01/2026 | ✅ complément + forfaits |
| **Parkings Indigo (APDS)** | 558 parkings (≈ 90 à Paris) : nom, position, capacité — **sans tarifs** | transport.data.gouv.fr (JSON APDS) | ODbL | avril 2026 | ✅ localisation (prix estimé) |
| **Base nationale des lieux de stationnement (BNLS)** | 826 parkings (135 à Paris) avec tarifs 1 h → 24 h | CSV data.gouv.fr | ODbL | **gelée en janvier 2024** | ✅ secours si rien de plus récent |
| **OpenStreetMap (Overpass)** | `amenity=parking` : ≈ 400 parkings couverts, nom/exploitant/capacité, prix rarement renseignés | Overpass API (miroirs) | ODbL | temps réel | ✅ parkings privés manquants |
| Paris Data — horodateurs | 3 668 horodateurs avec tarif horaire | `horodateurs-mobiliers` | ODbL | 2023 | ✅ **contrôle qualité** (3 623 cohérents / 2 écarts) |
| Paris Data — Belib' (statique + temps réel) | 1 886 points de charge | `belib-points-de-recharge-…` | ODbL | 2026 + flux temps réel | ✅ calque véhicules électriques |
| Paris Data — secteurs résidentiels | 162 secteurs | `stationnement-sur-voie-publique-secteurs-residentiels` | ODbL | 2026 | 🔜 futur « mode résident » |
| Paris Data — arrondissements | contours | `arrondissements` | ODbL | stable | ✅ calcul de couverture |
| **Géoplateforme IGN — géocodage** | recherche d'adresses et de lieux (remplace api-adresse.data.gouv.fr) | `https://data.geopf.fr/geocodage/search` — sans clé, CORS, 50 req/s | Licence ouverte | temps réel | ✅ barre de recherche |
| **OpenFreeMap** | tuiles vectorielles OpenStreetMap + polices | `tiles.openfreemap.org` — sans clé ni quota | ODbL / libre | hebdomadaire | ✅ fond de carte |
| IDFM — parcs relais | 78 P+R | data.iledefrance-mobilites.fr | Licence ouverte | 2026 | ❌ aucun dans Paris (extension future) |

**Non retenus (payants ou fermés)** : Parkopedia (licence B2B payante), Google Places (payant, sans prix de
stationnement), Onepark / Zenpark / Yespark (pas d'API publique). **Aucun flux ouvert de disponibilité en temps réel**
n'existe aujourd'hui pour les parkings parisiens (le flux temps réel Saemes a disparu).

---

## 3. Stratégie de couverture (objectif ≈ 80 %)

### Définition mesurable
1. **Couverture spatiale** (indicateur principal) : Paris (bois compris) est découpé en **2 626 mailles de 200 m** ;
   une maille est couverte si un prix connu (place sur rue tarifée/gratuite ou parking avec tarifs publiés)
   se trouve à **moins de 250 m** de son centre (≈ 3 min à pied).
2. **Couverture des places** : part des places publiques recensées (rue + parkings) dont on connaît le prix.
3. Les **estimations** (parkings sans tarif ouvert) ne sont **jamais** comptées.

### Résultats (générés par `npm run data`, affichés dans le site via le badge « Couverture »)

| Indicateur | Valeur |
|---|---|
| Couverture spatiale | **91,5 %** (2 404 mailles / 2 626) |
| Mailles contenant elles-mêmes un prix | 74,5 % |
| Places voiture sur rue tarifées | **116 853 / 116 853 (100 %)** |
| Parkings publics avec tarifs ouverts | 100 / 188 (53 %) — **75 % des places en parking** |
| Places publiques avec prix (rue + parkings) | **89 %** (179 608 / 201 038) |
| Arrondissements ≥ 93 % | 18 sur 20 — le 12ᵉ (63 %) et le 16ᵉ (90 %) sont pénalisés par les bois |

### Priorités de fusion des parkings
Paris Data → Saemes → BNLS → Indigo → OSM. Deux fiches à moins de 80 m (ou 25 m sans nom commun) sont fusionnées ;
la grille tarifaire la plus récente l'emporte. Les parkings sans tarif ouvert reçoivent une **estimation « ≈ »**
(médiane des parkings tarifés à moins de 1 km), clairement signalée.

### Pour dépasser 95 %
- Contribuer les tarifs manquants dans OpenStreetMap (`charge=*`) : ils seront repris automatiquement.
- Partenariats open data avec Indigo, Q-Park, Effia, Interparking (≈ 90 parkings sans prix publié).
- Signalements communautaires façon Waze (voir feuille de route).

---

## 4. Architecture (prête pour une app Expo)

```
 Sources ouvertes              Pipeline (Node, scripts/)                 @parkprix/core (TypeScript pur, sans DOM)
 ────────────────              ─────────────────────────                 ────────────────────────────────────────
 Paris Data (API v2.1) ──┐     build-data.mjs                            pricing  · grille officielle, fériés, heure de Paris sans Intl
 Saemes (API)          ──┤     ├─ zones, 60 657 emprises (auto, moto,    data     · client HTTP data/v1 + décodage voirie
 Indigo (APDS)         ──┼──►  │   vélo…) → voirie.json compact          model    · prix affichés, couleurs, « moins chers autour »
 BNLS (CSV)            ──┤     ├─ 5 sources fusionnées → parkings        style    · fond façon Waze + calques (spécifications MapLibre)
 OSM (Overpass)        ──┘     ├─ contrôle horodateurs, couverture              │                          │
                               └─ build-sprites.mjs → icônes PNG 1x/2x          ▼                          ▼
                                            │                           apps/web (Vite +            app Expo (à venir) :
                                            ▼                           MapLibre GL JS)             MapLibre React Native
                               apps/web/public/data/v1 + sprites   ◄──  ou WebView avec pont   ──►  ou WebView + pont
                               = API statique (GitHub Pages)            (messages JSON)             (docs/EXPO.md)
```

- **Un seul cœur** : `packages/core` compile avec la seule bibliothèque ES (aucune API navigateur) ; l'heure de Paris
  et le formatage des prix n'utilisent pas `Intl` (moteur Hermes de React Native). Vérifié par la CI et les tests.
- **API de données statique v1** (`data/v1/*.json`), versionnée et documentée ([docs/DATA_API.md](docs/DATA_API.md)) :
  le site et l'app lisent les mêmes fichiers, régénérés chaque semaine.
- **Style de carte portable** : `buildBasemapStyle()` et `parkingLayers()` produisent des spécifications MapLibre
  standard, acceptées telles quelles par MapLibre GL JS (web) et `@maplibre/maplibre-react-native` (`<Map mapStyle>`,
  `<Layer {...spec}>`). Les icônes sont une planche de sprites PNG (pas de canvas).
- **Pont WebView** (`apps/web/src/bridge.ts`) : paramètres d'URL (`?chrome=0&vehicle=moto…`), événements
  (`ready`, `select`, `settings`, `moveend`) et commandes validées (`setVehicle`, `focus`, `selectParking`…).
- **Pas de serveur** : tout est pré-calculé ; seuls les tuiles OpenFreeMap et le géocodeur IGN sont appelés en direct.

## 5. Design « façon Waze »

Couleurs **mesurées pixel par pixel** sur les tuiles de la live map Waze (servant uniquement de référence visuelle) :

| Élément | Waze | ParkPrix |
|---|---|---|
| Fond | `#faf7ef` crème | identique |
| Rues | remplissage `#eeebe3`, liseré `#c5cdc2` | identique, simple trait aux petites échelles |
| Axes majeurs / quais | vert sauge `#c2cfae`, liseré `#9ba68b`, libellé `#4e5346` | identique |
| Autoroutes, périphérique | vert canard `#63a08a` | identique (chaussées et bretelles séparées) |
| Eau / parcs / hôpitaux | `#9fd4da` / `#cce5a6` / `#e5c6c3` | identiques |
| Libellés | gris `#777`, italiques verts (parcs) et bleu-gris (eau) | identiques (Noto Sans) |
| Bâtiments | aucun | aucun |
| Voies ferrées, sentiers, sens uniques | hachures grises, « perles » crème, flèches | reproduits |

Interface : police Rubik (celle de la live map Waze), bleu `#00a4eb`, rayons de 10 px, ombres Waze ; puces véhicule
en icônes, panneau du bas (mobile) / latéral (ordinateur), bouton **« Y aller avec Waze »** (lien officiel
`waze.com/ul`), mode nuit bleu nuit. Chaque parking fermé porte un **« P » bleu** (gris si réservé aux abonnés),
toujours visible, accompagné d'une bulle de prix colorée ; vélos et motos ont leurs propres icônes.
Ni la marque, ni le logo, ni les tuiles Waze ne sont utilisés.

## 6. Feuille de route

**V1 — livrée**
- [x] Recherche et intégration de 10 sources gratuites, pipeline reproductible avec cache et miroirs Overpass
- [x] Prix selon véhicule, durée (30 min → 24 h) et heure d'arrivée ; recherche d'adresse ; « les moins chers autour »
- [x] Couverture mesurée : 91,5 % (objectif 80 %)

**V1.1 — livrée (cette itération)**
- [x] Carte fidèle à Waze (palette mesurée, hiérarchie des routes, pas de bâtiments, mode nuit)
- [x] Un « P » sur chaque parking fermé (272) + bulles de prix ; parkings abonnés en gris
- [x] Places **vélo** (15 489 emplacements) et **moto** (6 093) : modes dédiés, icônes, calques, liste, parkings acceptant vélos/motos
- [x] Monorepo : `@parkprix/core` sans DOM, API de données v1, sprites PNG, pont WebView, guide Expo vérifié au typage

**V2 — app Expo**
- [ ] `apps/mobile` : écran carte MapLibre React Native (style et calques du cœur), panneau en composants RN
- [ ] Recherche IGN, géolocalisation (`expo-location`), lien Waze natif, favoris, rappel de fin de ticket
- [ ] Mode résident (secteur → 1,50 €/jour dans ses secteurs) ; données hors ligne (cache de data/v1)

**V3 — moyen terme**
- [ ] Signalements communautaires (place libre, prix constaté) comme Waze
- [ ] Tarifs manquants via partenariats exploitants / contributions OSM ; disponibilité temps réel si ouverte
- [ ] Extension petite couronne (P+R IDFM, BNLS)

## 7. Limites et risques
- **Prix indicatifs** : la grille officielle peut évoluer → contrôle automatique (zones + horodateurs) à chaque génération.
- **Parkings privés** : ≈ 90 parkings (surtout Indigo, Q-Park) sans tarif ouvert → estimation signalée « ≈ ».
- **BNLS gelée** depuis 2024 : utilisée seulement en dernier recours ; **OSM** hétérogène (filtrage des accès privés).
- **Bois** : grille spécifique non publiée en open data → prix de la zone 2 affiché avec un avertissement.
- **Licences** : les fichiers de `apps/web/public/data` sont des bases dérivées publiées sous **ODbL** (attribution affichée sur la carte).
- **Vélos** : les emplacements vélo sont ceux de la voirie (arceaux) ; les parkings vélo sécurisés privés ne sont pas publiés en open data.
- **Waze** : style inspiré de la live map, sans reprendre sa marque ni ses tuiles (propriété de Waze / Google).
