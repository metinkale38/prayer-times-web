# Architecture & build plan

## Runtime model

- Pure static multi-page app. Every feature is a real HTML document.
- No bundler/compiler. ES modules are loaded directly.
- `<app-shell>` is a small custom element that renders the toolbar + drawer and
  moves the page's `<main>` into the shell. This avoids duplicating the chrome in
  every file without a build-time include.
- htmx is local and used for real HTML fragments (holiday articles). It is not
  used as a state manager and it is not required for navigation.
- Leaflet is local and only loaded by `compass.html`.

## Pages

| URL | Layout | Purpose |
|---|---|---|
| `index.html` | app shell | prayer times pager, city list, month sheet |
| `compass.html` | app shell | 2D compass + satellite map |
| `names.html` | app shell | 99 names grid + search |
| `dhikr.html` | app shell | multiple counters |
| `calendar.html` | app shell | Hijri/Gregorian holidays |
| `settings.html` | app shell | preferences |
| `about.html` | app shell | credits, licences, storage |
| `city.html?provider=&id=` | standalone | one city, no app chrome |
| any page `?embed=1` | none | hides app bar/drawer |

## Module layers

```text
pages → components → services → core → adapters
```

- `js/pages/*` boot one page.
- `js/components/*` UI; no direct persistence.
- `js/services/*` domain logic: API, cities, times, Hijri, qibla, dhikr.
- `js/core/*` infrastructure: storage, HTTP, i18n, theme, formatting, icons.
- `js/core/adapters` and HTTP adapters are platform-specific.

## Data flow

```text
API /search, /{provider}/{id}/json
        │
        ▼
services/api.js → services/times.js → times cache in Storage
        │
        ▼
components/city-card.js → DOM
        │
        ▼
1-second tick updates countdown/highlight without network calls
```

- API calls are deduplicated, limited to 2 concurrent requests and retried on
  429/5xx with backoff.
- Cache key: `pt:v1:times:<provider>:<id>`.
- Refresh when today is missing, fewer than 15 days remain, or the cache is
  older than 7 days. The API day window is stored as received.
- Times are local wall times. Countdown uses the city IANA timezone via a small
  `zonedTimeToUtc` implementation and `Intl`.

## Persistence

`js/core/storage.js` exposes an async facade and adapters:

- `LocalStorageAdapter`
- `AndroidBridgeAdapter`
- `MemoryAdapter`

Envelope: `{"v":1,"data":...}` under `pt:v1:<key>`.
Stores: `settings`, `cities`, `dhikr`, `times:*`, `city:*`, `ui`.
`docs/android-webview.md` documents the native contract.

## i18n & theme

- `data/i18n/{de,en,tr}.json`; Android keys reused, web-only keys prefixed `web.`.
- `i18n.apply(document)` handles `data-i18n*` attributes; dynamic strings use
  `i18n.t()` and Android-style `%1$s` formatting.
- Theme: `pt.theme` (`system|light|dark`) plus `pt:v1:settings.theme`.
- An inline `<head>` script applies the theme before first paint.

## PWA

- `manifest.webmanifest`, `sw.js`.
- Precache shell/assets; network-first for navigations; cache-first for local
  static assets; capped runtime cache for map tiles.
- Bump `CACHE_VERSION` on every CSS/JS/data release.

## Build plan

There is no compilation step:

1. `node tools/build-static.mjs` stages the runtime files into `dist/`.
2. `actions/upload-pages-artifact` uploads `dist/`.
3. `actions/deploy-pages` publishes it.

`dist/` excludes `tools/`, `tests/`, `docs/`, `README.md`, `package.json`,
`.github/` and git metadata. The static sources remain the source of truth.

## Verification plan

- Local/LAN: `node tools/dev-server.mjs` (proxy `/api`).
- Smoke: `npm run test:smoke` (optional Playwright).
- Manual/visual: compare against the Android AVD and store screenshots.
- Offline: load a city once, enable offline in DevTools, reload; cached times and
  the app shell should still render.
- API: search, add city, refresh, month table, standalone city page.
- Dark mode: every page, especially compass/dial, calendar article modal and
  settings selects.
- i18n: DE/EN/TR, including drawer, settings and times labels.

## Extension points

- Additional language: add JSON + `SUPPORTED` + settings option.
- Local astronomical calculation (`Calc`): add a `CalcProvider` implementing the
  same `getDay/getRange` contract and route it for cities without official data.
- Native storage: provide `window.PrayerTimesAndroid` and the JS adapters switch
  automatically.
- Native HTTP: provide `httpGet(url)` to bypass CORS in WebView.
