# Prayer Times WebApp

Static, multi-page web version of the Android app
[`metinkale38/prayer-times-android`](https://github.com/metinkale38/prayer-times-android).

Vanilla HTML/CSS/JS + htmx + Leaflet. **No compile step, no Tailwind.** The
runtime files are the source; `tools/build-static.mjs` only stages the static
files that GitHub Pages should publish.

- Production: `https://metinkale38.github.io/prayer-times-web/`
- API: `https://opt.mk38.de`
- Persistence: swappable JS interface → LocalStorage now, Android WebView bridge later

## Features

- Prayer times with a swipeable city pager: city list + any number of cities
- Standalone city page `city.html?provider=Diyanet&id=11010` without app chrome
- Month view, countdown, Kerahat/Makruh banner, Hijri date
- Qibla 2D compass and satellite map with a great-circle Qibla line
- 99 Names of Allah with search and DE/EN/TR meanings
- Multiple Dhikr counters with target, colours and haptics
- Islamic holidays / Hijri–Gregorian calendar with the Android articles (DE/TR)
- Settings: language, night mode, numerals, date formats, Hijri, Kerahat,
  vibration, city minute offsets
- About page with credits, licences and storage information
- PWA manifest + service worker
- `?embed=1` on every page hides app bar/drawer

## Quick start

The public API only sends CORS headers for the origin
`https://metinkale38.github.io`. For local development use the included
zero-dependency proxy:

```bash
node tools/dev-server.mjs
# local: http://127.0.0.1:8080/
# LAN:   http://192.168.178.5:8080/  (the server prints all available addresses)
```

The server binds to `0.0.0.0` by default. Restrict it with
`HOST=127.0.0.1 node tools/dev-server.mjs`.

The WebApp automatically uses `/api` when it is opened from localhost, a private
LAN address or a `.local` hostname. On GitHub Pages it calls the API directly.

> LAN access over plain HTTP is fine for prayer times and city search.
> Service workers/PWA install, geolocation and some device sensors require a
> secure context (HTTPS or localhost). The app falls back to manual compass/city
> selection there.

## Build & deployment

There is **no compiler**. The only build is a static staging copy:

```bash
npm run build        # -> dist/
npm run preview      # serves dist/ through the same dev proxy
```

`dist/` contains only the static site (HTML, CSS, JS, data, assets, partials,
manifest, service worker). Tooling, tests and docs are excluded.

The GitHub Actions workflow `.github/workflows/deploy.yml`:

1. checks out the repo,
2. runs `node tools/build-static.mjs`,
3. uploads `dist/` as the Pages artifact,
4. deploys it with `actions/deploy-pages`.

On the repository, enable **Settings → Pages → Source: GitHub Actions** (the
workflow also requests Pages enablement, but the repository setting must allow
it). Pushing to `main` or running the workflow manually deploys the site.

The API allowlist is origin-based (`https://metinkale38.github.io`), so the
project sub-path `/prayer-times-web/` is fine. A custom domain would need to be
added to the API allowlist.

If you change CSS/JS/data, bump `CACHE_VERSION` in `sw.js` so installed PWAs
receive the update.

## Structure

```text
index.html, compass.html, names.html, dhikr.html,
calendar.html, settings.html, about.html, city.html
css/            tokens, base, layout, components, Leaflet CSS
js/
  core/         storage, http, i18n, theme, format, icons, config
  services/     api, cities, times, hijri, qibla, dhikr
  components/   app-shell, city-card, city-list, city-search,
                month-view, ui
  pages/        one entry point per page
  vendor/       htmx, Leaflet
data/           i18n de/en/tr, 99 names, Hijri table
assets/         icons, source logos, app icon, fonts
partials/       holiday article fragments (DE/TR) + images
tools/          dev server, static build, Android data extractor
tests/          optional Playwright smoke test
docs/           architecture, deployment, Android WebView
```

## Data & API

| Endpoint | Purpose |
|---|---|
| `/` | providers |
| `/search?q=Berlin` | city search |
| `/search?lat=50.11&lng=8.68` | nearby cities |
| `/{provider}/{id}/json` | prayer times |
| `/{provider}/{id}` | city metadata |

- Times are cached per city in `pt:v1:times:<provider>:<id>`.
- The API returns a different number of days per source (currently ~42). The app
  caches what it receives and refreshes when fewer than 15 days remain. There is
  no full-city crawl and no background polling, so the rate limit is not a
  practical concern in normal use.
- Times are local wall-clock times of the city. Countdown and Hijri dates use the
  city's IANA timezone, not the device timezone.
- `Calc` search results are filtered because the public API does not expose
  their `/json` data. Official providers are supported.

The 99 names and Hijri table are generated once from the Android repo:

```bash
ANDROID_ROOT=/path/to/prayer-times-android python3 tools/extract-android-data.py
```

This is a data-maintenance helper, not a build step.

## Persistence interface

All user data goes through `js/core/storage.js`:

```js
await storage.get(key, fallback);
await storage.set(key, value);
await storage.remove(key);
await storage.keys();
await storage.update(key, updater);
storage.subscribe(key, callback);
```

Adapters:

- `LocalStorageAdapter` (browser default)
- `AndroidBridgeAdapter` (`window.PrayerTimesAndroid.storage` or direct
  `getString/...` methods)
- `MemoryAdapter` (fallback / private mode)

Keys are namespaced `pt:v1:...`; the Android adapter only sees opaque strings.

### Android WebView contract

The JS side auto-detects:

```text
window.PrayerTimesAndroid.storage.getString(key) -> String?
window.PrayerTimesAndroid.storage.setString(key, value)
window.PrayerTimesAndroid.storage.remove(key)
window.PrayerTimesAndroid.storage.keys() -> JSON array string
window.PrayerTimesAndroid.httpGet(url) -> JSON string
window.__ptStorageChanged(key) // optional native -> JS notification
```

See [`docs/android-webview.md`](docs/android-webview.md) for Kotlin snippets and
`WebViewAssetLoader` setup. The native HTTP bridge also solves the CORS allowlist
for WebView deployment.

## Localisation

`data/i18n/de.json`, `en.json`, `tr.json` reuse Android keys wherever possible
(`appName`, `compass`, `fajr`, `kerahatTime`, `holyday1`, …). Web-only keys are
prefixed `web.`. To add a language, copy `en.json`, translate it, add it to
`SUPPORTED` in `js/core/i18n.js`, and add an option in `settings.html`.

## Night mode

- Default: system (`prefers-color-scheme`)
- Settings: System / Light / Dark
- Toolbar moon/sun quick switch
- Stored in `pt.theme` and `pt:v1:settings.theme`
- No flash: inline head script sets the theme before first paint

Dark tokens come from the Android night palette (`#1e1e1e`, `#4a768a`,
`#5a7b8a`, `#dedede`, …). The compass dial intentionally stays white/black like
the Android `CompassView`.

## Tests

Optional, development-only:

```bash
npm install
npm run dev          # terminal 1
npm run test:smoke   # terminal 2
```

Playwright is not a runtime dependency.

## Visual reference

Calibrated against the Android app:

- Android AVD screenshots (1080×2340, 420 dpi) and store screenshots from
  [`metinkale38/prayer-times-android`](https://github.com/metinkale38/prayer-times-android)
- Web comparison screenshots were generated during implementation and are kept
  outside this repository (they are not needed to run the app)

The Android layouts/resources are the source of truth for colours, type weights,
the 10-slot times screen, drawer proportions and card radii.

## Notes / limitations

- The API is the only source of official provider times. Its day window is
  taken as-is; there is no synthetic 365-day cache.
- The Hijri table built from the Android app covers 2012–2035; later dates fall
  back to Umm al-Qura via `Intl`.
- The satellite layer uses EOX Sentinel-2 cloudless and needs network access for
  new tiles. The Qibla line is a great-circle curve, not a straight line.
- English holiday articles fall back to a short text because the Android app has
  no English article assets.
- `Calc` (local astronomical calculation) is intentionally not included.
- Plain HTTP on a LAN is not a secure context: PWA/geolocation/sensor features
  may be unavailable there.

## Licence

Apache License 2.0. See `LICENSE`. The app is a derivative of
`metinkale38/prayer-times-android`; data and map attributions are listed on the
About page.
