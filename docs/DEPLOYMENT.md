# Deployment

## GitHub Pages (primary target)

Production URL: **https://metinkale38.github.io/prayer-times-web/**

The API `opt.mk38.de` only allows the origin `https://metinkale38.github.io`.
This project path is fine because CORS compares scheme + host, not the path.

### One-time repository setup

1. Push the repository to GitHub.
2. Open **Settings → Pages**.
3. Set **Source** to **Deploy from a branch**.
4. Select branch **`gh-pages`**, folder **`/ (root)`**.
5. Push to `main` (or run **Deploy static WebApp** manually).

The workflow is `.github/workflows/deploy.yml`:

```text
checkout → node tools/build-static.mjs → publish dist/ to gh-pages
```

The workflow uses `peaceiris/actions-gh-pages` to publish the staged `dist/`
folder to the `gh-pages` branch. This avoids the Pages artifact API, which was
intermittently failing with `No artifacts named "github-pages"`. Do not switch
the Pages source back to GitHub Actions unless the workflow is changed to use
`upload-pages-artifact`/`deploy-pages` again.

### Releasing

1. Run `node tools/build-static.mjs` locally and `npm run preview` if desired.
2. Bump `CACHE_VERSION` in `sw.js` whenever CSS/JS/data changes.
3. Commit and push to `main`.
4. Wait for the **Deploy static WebApp** workflow; the environment URL is printed
   in the job summary.

### Custom domain

If a custom domain is used later, its origin must be added to the API allowlist;
otherwise API requests return 403. Also add the domain in Settings → Pages and a
`CNAME` file.

## Local / LAN

```bash
node tools/dev-server.mjs
# local: http://127.0.0.1:8080/
# LAN:   http://<private-ip>:8080/
```

- Binds `0.0.0.0` by default; use `HOST=127.0.0.1` to restrict.
- Proxies `/api/*` to `https://opt.mk38.de/*` server-side, so LAN clients avoid
  CORS.
- The app detects private/LAN hosts and calls `/api`; GitHub Pages calls the API
  directly.
- `ROOT_DIR=dist node tools/dev-server.mjs` previews the staged build.

Plain HTTP on a LAN is not a secure context. PWA install/service worker,
geolocation and some sensors may be unavailable. Prayer times, city search,
names, dhikr, calendar, missed prayers and settings work. The compass requires
HTTPS/localhost because it depends on geolocation and device orientation.

The dev server has no authentication; only expose it on trusted networks.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| City search returns 403 | Browser talks to the API from a non-allowlisted origin. Use the local proxy or GitHub Pages. |
| Pages deploy fails | Check that Pages uses branch `gh-pages` / `/ (root)` and that the workflow has `contents: write`. |
| Site shows an older version | Bump `CACHE_VERSION` in `sw.js`, redeploy, then hard reload. |
| Stale CSS/JS after deploy | Bump `CACHE_VERSION` in `sw.js`; hard reload. |
| No PWA/install prompt on LAN | Plain HTTP is not a secure context. Use HTTPS or localhost. |
| Compass shows the location gate on LAN | Geolocation/compass require a secure context. Open the live HTTPS URL via the link in the gate. |
| Compass sensor unavailable | The page shows the Qibla angle numerically; there is intentionally no manual heading control. |
| City search nearby shows many entries | Pick the desired provider (Diyanet, IGMG, NVC, Semerkand, Calc). Auto-location no longer preselects a source. |
| Calculated times differ from official times | `Calc` uses adhan.js locally; official providers are separate sources. |
| Satellite map is too far/too close | Default is Esri World Imagery at zoom 18; use the layer control/locate button. Google Maps needs an API key and is not enabled. |
| Month view starts at today | The API only provides a rolling window from today; this is expected. |
| Map tiles fail offline | Satellite tiles need network; the Qibla line/bearing still works in 2D. |

## Rollback

Revert the commit on `main` and push. The workflow republishes the previous
static state to `gh-pages`. If the service worker is involved, also bump
`CACHE_VERSION` so clients pick up the rollback promptly.
