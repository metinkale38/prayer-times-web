/**
 * Optional Playwright smoke test. It is not needed to run the app.
 *
 *   npm install
 *   node tools/dev-server.mjs
 *   npm run test:smoke
 */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base = process.env.BASE_URL || 'http://127.0.0.1:8080/';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2,
  locale: 'de-DE',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});

async function go(path) {
  await page.goto(base + path, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(600);
}

await go('index.html');
assert.equal(await page.locator('.app-bar__title').textContent(), 'Gebetszeiten');

// Add a city through the real search + API proxy.
await page.click('#action-add');
await page.fill('[data-search-input]', 'Frankfurt');
await page.waitForTimeout(2500);
assert.ok((await page.locator('.city-result').count()) > 0, 'city search returned results');
await page.locator('.city-result').first().click();
await page.waitForTimeout(2500);
assert.ok((await page.locator('.city-card__time, .prayer-row__time').first().textContent()).includes(':'), 'prayer times rendered');

await go('compass.html');
assert.ok(await page.locator('#compass-dial, .compass-dial').count());
await page.click('#compass-toggle');
await page.waitForTimeout(2500);
assert.ok(await page.locator('#compass-map .leaflet-container, #compass-map.leaflet-container').count());

await go('names.html');
await page.waitForSelector('.name-card', { timeout: 8000 });
assert.ok((await page.locator('.name-card').count()) >= 99);

await go('dhikr.html');
await page.waitForSelector('#dhikr-circle');
await page.click('#dhikr-circle');
await page.waitForTimeout(350);
assert.ok((await page.locator('#dhikr-count').textContent()).trim().length > 0);

await go('calendar.html');
await page.waitForSelector('.calendar-event', { timeout: 8000 });
assert.ok((await page.locator('.calendar-event').count()) > 0);

await go('settings.html');
await page.selectOption('[data-setting="theme"]', 'dark');
await page.waitForTimeout(300);
assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');

await go('about.html');
assert.ok(await page.locator('.about-hero__name').count());

await go('city.html?provider=Diyanet&id=11010&lang=de');
await page.waitForSelector('.city-card .prayer-row', { timeout: 8000 });
assert.ok((await page.locator('.city-card .prayer-row').count()) === 6);
assert.equal(await page.locator('.drawer').count(), 0, 'standalone page has no drawer');

assert.deepEqual(errors, [], `console/page errors: ${errors.join(' | ')}`);
console.log('Smoke test passed');
await browser.close();
