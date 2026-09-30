# Brancher ParkPrix dans une app Expo

Le projet est découpé pour qu'une future app Expo / React Native réutilise tout ce qui a de la valeur :

```
packages/core   @parkprix/core — TypeScript pur, sans DOM (vérifié par tsc : lib ES2023 seule)
                ├─ moteur de prix (grille officielle, jours fériés, heure de Paris sans Intl)
                ├─ client de l'API de données (fetch) + décodage de voirie.json
                ├─ style de carte façon Waze (objet MapLibre) + calques stationnement
                └─ modèle : prix affichés, couleurs, « les moins chers autour », vélo / moto
apps/web        site Vite + MapLibre GL JS (utilise @parkprix/core)
apps/web/public/data/v1   API de données statique (JSON / GeoJSON), voir DATA_API.md
apps/web/public/sprites   planche d'icônes PNG (P, bulles de prix, vélo, moto…) 1x / 2x
```

Deux chemins d'intégration, cumulables :

| | A. WebView (immédiat) | B. Carte native MapLibre (recommandé à terme) |
|---|---|---|
| Effort | ~30 lignes | un écran carte + un panneau en composants RN |
| Rendu | le site dans une WebView | MapLibre Native (fluide, hors-ligne possible) |
| Réutilisé | tout le site | `@parkprix/core` : style, calques, prix, données |
| Expo Go | oui | non (development build, plugin natif) |

---

## A. Intégration WebView (quelques minutes)

```bash
npx expo install react-native-webview
```

```tsx
// app/(tabs)/carte.tsx
import { useRef } from 'react';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

const PARKPRIX_URL = 'https://calvinndmb.github.io/Parking/'; // site déployé (GitHub Pages)

export default function CarteParking() {
  // <object> : contourne le paramètre de type par défaut (undefined) des typings de react-native-webview.
  const web = useRef<WebView<object>>(null);
  const send = (command: object) => web.current?.postMessage(JSON.stringify(command));

  const onMessage = (e: WebViewMessageEvent) => {
    const event = JSON.parse(e.nativeEvent.data);
    if (event.source !== 'parkprix') return;
    if (event.type === 'ready') send({ type: 'setVehicle', vehicle: 'voiture' });
    if (event.type === 'select' && event.kind === 'parking') {
      console.log(`${event.name} : ${event.label}`); // ex. « Saint Sulpice : 10,80 € »
    }
  };

  return (
    <WebView<object>
      ref={web}
      source={{ uri: `${PARKPRIX_URL}?chrome=0&vehicle=voiture&duration=120` }}
      onMessage={onMessage}
      geolocationEnabled
    />
  );
}
```

### Paramètres d'URL

| Paramètre | Valeurs | Effet |
|---|---|---|
| `chrome` | `0` | carte seule : pas de barre de recherche, puces, panneau ni boutons (l'app fournit sa propre interface) |
| `vehicle` | `voiture`, `suv`, `electrique`, `moto`, `velo` | véhicule initial |
| `duration` | `30`, `60`, `120`, `180`, `240`, `360`, `600`, `1440` | durée initiale (minutes) |
| `theme` | `day`, `night` | thème de carte |
| `parking` | identifiant (`paris:75101-P-006`…) | ouvre la fiche d'un parking |
| `#zoom/lat/lon` | ex. `#16/48.8508/2.3334` | position de la carte |

### Événements envoyés par la carte (`onMessage`)

Tous les messages ont `source: 'parkprix'` et un `type` :

| `type` | Contenu |
|---|---|
| `ready` | `dataVersion` (`v1`) — la carte et les 60 000 emplacements sont chargés |
| `settings` | `vehicle`, `minutes`, `start` (ISO ou `null` = maintenant), `theme` |
| `select` | `kind: 'parking'` → `id`, `name`, `price`, `label`, `lon`, `lat`<br>`kind: 'spot'` → `index`, `street`, `category`, `zone`, `price`, `lon`, `lat`<br>`kind: 'belib'` → `name`, `lon`, `lat` |
| `deselect` | la fiche a été fermée |
| `focus` | point de recherche choisi : `lon`, `lat`, `label` |
| `moveend` | `lon`, `lat`, `zoom` après chaque déplacement |

### Commandes acceptées (`web.current.postMessage(JSON.stringify(cmd))`)

| Commande | Exemple |
|---|---|
| `setVehicle` | `{ type: 'setVehicle', vehicle: 'velo' }` |
| `setDuration` | `{ type: 'setDuration', minutes: 180 }` |
| `setStart` | `{ type: 'setStart', start: '2026-10-04T12:00:00Z' }` (`null` = maintenant) |
| `setTheme` | `{ type: 'setTheme', theme: 'night' }` |
| `flyTo` | `{ type: 'flyTo', lon: 2.35, lat: 48.86, zoom: 16 }` |
| `focus` | `{ type: 'focus', lon: 2.35, lat: 48.86, label: 'Destination' }` → liste des moins chers autour |
| `selectParking` / `deselect` | `{ type: 'selectParking', id: 'paris:75101-P-006' }` |
| `setLayers` | `{ type: 'setLayers', layers: { velo: true, moto: true, zones: false } }` |
| `setChrome` | `{ type: 'setChrome', visible: false }` |

Les commandes sont validées côté carte (valeurs hors liste ignorées). Le même protocole fonctionne dans une `<iframe>` (via `window.postMessage`).

---

## B. Carte native avec MapLibre React Native

### 1. Installer

```bash
npx expo install @maplibre/maplibre-react-native
```

`app.json` :

```json
{ "expo": { "plugins": ["@maplibre/maplibre-react-native"] } }
```

MapLibre Native est un module natif : utiliser un *development build* (`npx expo run:ios` / `run:android`), pas Expo Go.
La version 11 demande Expo ≥ 54, React Native ≥ 0.80 et React ≥ 19.1.

### 2. Utiliser le cœur partagé

Dans ce dépôt (workspaces npm), ajouter l'app dans `apps/mobile` avec la dépendance `"@parkprix/core": "0.2.0"` :
Expo (SDK ≥ 52) gère les monorepos automatiquement et Metro compile directement les sources TypeScript de `packages/core`.
Hors monorepo, copier `packages/core/src` ou le publier sur un registre privé.

### 3. Écran carte

```tsx
import { useEffect, useMemo, useState } from 'react';
// « Map » est renommé pour ne pas masquer le Map natif de JavaScript utilisé plus bas.
import { Camera, GeoJSONSource, Layer, Map as MapView, type LayerSpecification, type StyleSpecification } from '@maplibre/maplibre-react-native';
import {
  FIRST_LABEL_LAYER,
  SOURCES,
  VOIRIE_SOURCE_OPTIONS,
  buildBasemapStyle,
  createDataClient,
  parkingLayers,
  parkingsFeatureCollection,
  quoteParking,
  streetStyle,
  zoneLabelsFeatureCollection,
  type CoreData,
  type Settings,
  type VoirieData,
} from '@parkprix/core';

const BASE = 'https://calvinndmb.github.io/Parking/'; // héberge data/v1 et sprites/
const data = createDataClient(BASE);

export function ParkingMap({ settings, theme }: { settings: Settings; theme: 'day' | 'night' }) {
  const [core, setCore] = useState<CoreData>();
  const [voirie, setVoirie] = useState<VoirieData>();
  useEffect(() => {
    data.loadCore().then(setCore);
    data.loadVoirie().then(setVoirie);
  }, []);

  // Le même style « façon Waze » que le site (fond + icônes du sprite). Le paramètre de type
  // indique la copie des types de style embarquée par MapLibre React Native.
  const mapStyle = useMemo(() => buildBasemapStyle<StyleSpecification>({ theme, spriteUrl: `${BASE}sprites/parkprix` }), [theme]);
  if (!core) return null;

  const categories = core.meta.categories;
  const quotes = new Map(core.parkings.map((p) => [p.id, quoteParking(p, settings)]));
  const street = streetStyle(settings, core.meta.tariffs, categories);
  const { below, above } = parkingLayers<LayerSpecification>({
    theme,
    categories,
    iconCategories: settings.vehicle === 'velo' ? ['velo'] : settings.vehicle === 'moto' ? ['moto'] : [],
    paint: { voirieColor: street.color, voirieOpacity: street.opacity, zoneColor: street.zoneColor },
  });
  const belowIds = new Set(below.map((l) => l.id));
  // Les calques « below » (zones, bordures de trottoir) passent sous les libellés du fond de carte.
  const layersOf = (source: string) =>
    [...below, ...above]
      .filter((l) => 'source' in l && l.source === source)
      .map((l) => <Layer key={l.id} {...l} beforeId={belowIds.has(l.id) ? FIRST_LABEL_LAYER : undefined} />);

  return (
    <MapView mapStyle={mapStyle} style={{ flex: 1 }}>
      <Camera initialViewState={{ center: [2.3417, 48.859], zoom: 13 }} />
      <GeoJSONSource id={SOURCES.zones} data={core.zones}>{layersOf(SOURCES.zones)}</GeoJSONSource>
      {voirie && (
        <GeoJSONSource id={SOURCES.voirie} data={voirie.geojson} {...VOIRIE_SOURCE_OPTIONS}>
          {layersOf(SOURCES.voirie)}
        </GeoJSONSource>
      )}
      <GeoJSONSource
        id={SOURCES.parkings}
        data={parkingsFeatureCollection(core.parkings, quotes, settings, { showSubscribers: true, selectedId: null })}
        onPress={(e) => console.log(e.nativeEvent.features[0]?.properties)}
      >
        {layersOf(SOURCES.parkings)}
      </GeoJSONSource>
      <GeoJSONSource id={SOURCES.zoneLabels} data={zoneLabelsFeatureCollection(street, settings)}>{layersOf(SOURCES.zoneLabels)}</GeoJSONSource>
    </MapView>
  );
}
```

Les calques « below » sont insérés sous les libellés grâce à `beforeId`, les « P » et bulles de prix restent au-dessus.
Pour les icônes vélo / moto, ajouter la source `SOURCES.voiriePoints` avec `voiriePointsCollection(voirie, ['velo', 'moto'])`.

### 4. Ce qui reste propre à l'app mobile

- Le panneau (liste « les moins chers autour », fiches) : à recomposer en composants RN à partir de
  `nearbyOptions()`, `quoteStreet()`, `quoteParking()` et `CATEGORY_LABELS` — toute la logique est déjà dans le cœur.
- La recherche d'adresse : même API IGN (`https://data.geopf.fr/geocodage/search`), appelable avec `fetch`.
- La géolocalisation : `expo-location` ou `<UserLocation />` de MapLibre.
- Le lien « Y aller avec Waze » : `Linking.openURL('https://waze.com/ul?ll=LAT,LON&navigate=yes')`.

## Compatibilité vérifiée

- Les deux exemples de ce guide ont été vérifiés au typage (TypeScript strict, sans DOM) contre React Native 0.81,
  React 19.1, `@maplibre/maplibre-react-native` 11.4 et `react-native-webview` 14.

- `packages/core` compile sans la bibliothèque DOM (`tsc -p packages/core`, lancé par la CI).
- `buildBasemapStyle<S>()` et `parkingLayers<L>()` prennent le type de style du moteur appelant :
  MapLibre React Native embarque sa propre copie des types de style (26.2.1) et MapLibre GL JS la sienne (26.4.x).
- L'heure de Paris est calculée sans `Intl` (Hermes) et vérifiée contre `Intl` sur 20 000 instants.
- Les prix sont formatés sans `Intl.NumberFormat` (« 10,80 € », « 3 650 € »).
