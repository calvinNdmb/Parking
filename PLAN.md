# ParkPrix Paris — plan du projet

> **Objectif** : un site avec une carte « façon Waze » qui montre le prix du stationnement partout dans Paris
> (places sur rue et parkings), construit uniquement avec des API et bases de données **gratuites**,
> avec une couverture d'environ **80 % de Paris**.
>
> **Résultat de la V1** : **91,5 %** du territoire parisien couvert (mailles de 200 m ayant un prix connu à moins de 250 m),
> **100 %** des places voiture sur rue tarifées, **100 parkings publics** avec leurs tarifs, **89 %** des places publiques recensées avec un prix.

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
| **Paris Data — emprises de stationnement** | 65 833 polygones de places (régime mixte/rotatif/gratuit/livraison/PMR/deux-roues/Belib', nb de places, rue, secteur résidentiel) | `stationnement-sur-voie-publique-emprises` (export GeoJSON 82 Mo) | ODbL | modifié le 30/09/2026 | ✅ **carte des places sur rue** |
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

## 4. Architecture

```
 Sources ouvertes                    Pipeline (Node ≥ 22, sans dépendance)          Site statique (Vite + TypeScript + MapLibre GL)
 ─────────────────                   ──────────────────────────────────────        ─────────────────────────────────────────────
 Paris Data (API v2.1) ──┐           scripts/build-data.mjs                         index.html + src/
 Saemes (API)          ──┤  fetch +  ├─ zones tarifaires → zones.geojson           ├─ map/basemap.ts   fond « façon Waze » jour/nuit
 Indigo (APDS)         ──┼─ cache ──►├─ emprises → voirie.json (compact, 1,2 Mo gz) ├─ map/layers.ts    voirie, zones, pastilles de prix
 BNLS (CSV)            ──┤  disque   ├─ parkings fusionnés → parkings.geojson       ├─ pricing.ts       moteur de prix (testé)
 OSM (Overpass)        ──┘           ├─ Belib' → belib.geojson                      ├─ app/model.ts     prix affichés, « moins chers autour »
                                     ├─ contrôle horodateurs                        ├─ ui/              recherche IGN, panneau, fiches
                                     └─ couverture → meta.json, coverage-grid       └─ public/data/     données générées (ODbL)
                                                                                             │
 GitHub Actions : build + tests + rafraîchissement hebdomadaire des données ───────────────► GitHub Pages
```

- **Pas de serveur** : tout est pré-calculé ; le site ne dépend en direct que des tuiles OpenFreeMap et du géocodeur IGN.
- **Format compact** pour les 45 168 emprises : coordonnées en micro-degrés delta-encodées + dictionnaires
  (3,2 Mo brut / 1,2 Mo gzip au lieu de 82 Mo).
- **Moteur de prix** (`src/pricing.ts`) : minutes réellement payantes selon l'heure de Paris (jours fériés, dimanche,
  soirée), grille progressive au quart d'heure, limite de 6 h, SUV/2RM/électrique, interpolation des grilles
  de parkings (sans extrapolation abusive).
- **Couleurs** : chaque prix est converti en €/h équivalent pour la durée choisie → 6 niveaux (gratuit → > 7 €/h).

## 5. Design « façon Waze »
- Fond de carte clair et doux, routes blanches épaisses, grands axes jaunes/orangés, eau bleu vif ; **mode nuit** bleu nuit.
- Barre de recherche arrondie « Où voulez-vous vous garer ? », puces véhicule / durée / heure d'arrivée, boutons ronds flottants.
- **Pastilles de prix** étirables avec badge « P », bordures de trottoir colorées selon le prix, étiquettes de zone.
- Panneau du bas (mobile) / latéral (ordinateur) : « Les moins chers autour », fiches détaillées,
  bouton **« Y aller avec Waze »** (lien profond officiel `waze.com/ul`) et Google Maps.
- La marque et le logo Waze ne sont pas utilisés : le style s'en inspire seulement.

## 6. Feuille de route

**V1 — livrée**
- [x] Recherche et intégration de 10 sources gratuites, pipeline reproductible avec cache et miroirs Overpass
- [x] Carte jour/nuit, voirie colorée, zones, parkings, bornes Belib', carte de couverture
- [x] Prix selon véhicule (voiture, SUV, deux-roues, électrique), durée (30 min → 24 h) et heure d'arrivée
- [x] Recherche d'adresse, géolocalisation, « les moins chers autour », fiches détaillées, lien Waze
- [x] Couverture mesurée : 91,5 % (objectif 80 %), tests unitaires du moteur de prix et du décodage

**V2 — court terme**
- [ ] Mode résident (secteur résidentiel → 1,50 €/jour dans ses 4 secteurs)
- [ ] PWA hors ligne + ajout à l'écran d'accueil ; rappel de fin de ticket
- [ ] Disponibilité temps réel des bornes Belib' ; horaires d'ouverture des parkings pris en compte dans le prix
- [ ] Vector tiles (PMTiles) si les données grossissent ; version anglaise

**V3 — moyen terme**
- [ ] Signalements communautaires (place libre, prix constaté, travaux) comme Waze
- [ ] Tarifs manquants via partenariats exploitants / contributions OSM ; disponibilité temps réel si ouverte
- [ ] Extension petite couronne (P+R IDFM, BNLS)

## 7. Limites et risques
- **Prix indicatifs** : la grille officielle peut évoluer → contrôle automatique (zones + horodateurs) à chaque génération.
- **Parkings privés** : ≈ 90 parkings (surtout Indigo, Q-Park) sans tarif ouvert → estimation signalée « ≈ ».
- **BNLS gelée** depuis 2024 : utilisée seulement en dernier recours ; **OSM** hétérogène (filtrage des accès privés).
- **Bois** : grille spécifique non publiée en open data → prix de la zone 2 affiché avec un avertissement.
- **Licences** : les fichiers de `public/data` sont des bases dérivées publiées sous **ODbL** (attribution affichée sur la carte).
