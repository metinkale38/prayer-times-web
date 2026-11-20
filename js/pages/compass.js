import { PT } from '../boot.js';
import { rafThrottle } from '../core/format.js';
import { iconSvg } from '../core/icons.js';
import { openCitySearch } from '../components/city-search.js';
import { showToast } from '../components/ui.js';
import {
  CompassSensor,
  KAABA,
  distanceToKaabaKm,
  greatCirclePoints,
  normalizeAngle,
  qiblaBearing,
} from '../services/qibla.js';

await PT.ready;
await PT.shellReady;

const locationButton = document.getElementById('compass-location');
const rose = document.getElementById('compass-rose');
const qiblaArm = document.getElementById('compass-qibla-arm');
const headingEl = document.getElementById('compass-heading');
const angleEl = document.getElementById('compass-angle');
const distanceEl = document.getElementById('compass-distance');
const manual = document.getElementById('compass-manual');
const range = document.getElementById('compass-range');
const enableButton = document.getElementById('compass-enable');
const body2d = document.getElementById('compass-2d');
const mapWrap = document.getElementById('compass-map-wrap');
const mapEl = document.getElementById('compass-map');
const toggleButton = document.getElementById('compass-toggle');
const locateButton = document.getElementById('compass-locate');
const pickButton = document.getElementById('compass-pick');

let location = PT.settings.get('compass_location', null);
if (!location) {
  const first = PT.cities.all()[0];
  location = first
    ? { lat: first.lat, lng: first.lng, name: first.name, timezone: first.timezone }
    : { lat: 50.1109, lng: 8.6821, name: 'Frankfurt', timezone: 'Europe/Berlin' };
}

let heading = null;
let manualHeading = 0;
let mode = 'compass';
let map = null;
let userMarker = null;
let kaabaMarker = null;
let line = null;
let pickMode = false;
let sensorActive = false;
let sensorTimer = null;

const sensor = new CompassSensor();

function bearing() {
  return qiblaBearing(location.lat, location.lng);
}

function distance() {
  return distanceToKaabaKm(location.lat, location.lng);
}

function renderLocation() {
  locationButton.textContent = location.name || PT.i18n.t('web.currentLocation');
  locationButton.title = location.name || '';
}

function renderDial() {
  const qibla = bearing();
  const current = heading == null ? manualHeading : heading;
  if (rose) rose.style.transform = `rotate(${-normalizeAngle(current)}deg)`;
  if (qiblaArm) qiblaArm.style.transform = `rotate(${qibla}deg)`;
  if (headingEl) headingEl.textContent = `${Math.round(normalizeAngle(current))}°`;
  if (angleEl) angleEl.textContent = `${Math.round(qibla)}°`;
  if (distanceEl) {
    const km = Math.round(distance());
    distanceEl.textContent = `${PT.i18n.number(km, PT.settings.get('numbers', 'normal'))} ${PT.i18n.t('web.km')}`;
  }
}

function showManual(show) {
  if (manual) manual.hidden = !show;
}

function startSensor() {
  if (!CompassSensor.supported()) {
    showManual(true);
    if (enableButton) enableButton.hidden = true;
    return;
  }
  const started = sensor.start((value) => {
    heading = value;
    renderDial();
  });
  if (!started) {
    showManual(true);
    return;
  }
  sensorActive = true;
  showManual(false);
  clearTimeout(sensorTimer);
  sensorTimer = window.setTimeout(() => {
    if (heading == null) {
      showManual(true);
      if (enableButton) enableButton.hidden = false;
    }
  }, 1600);
}

async function enableSensor() {
  try {
    const granted = await sensor.requestPermission();
    if (!granted) {
      showToast(PT.i18n.t('web.locationDenied'));
      showManual(true);
      return;
    }
    startSensor();
  } catch (error) {
    console.warn('[compass] permission', error);
    showManual(true);
  }
}

function setLocation(next, { persist = true } = {}) {
  location = {
    lat: Number(next.lat),
    lng: Number(next.lng),
    name: next.name || PT.i18n.t('web.currentLocation'),
    timezone: next.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  if (persist) PT.settings.set('compass_location', location);
  renderLocation();
  renderDial();
  updateMap();
}

function locate() {
  if (!navigator.geolocation) {
    showToast(PT.i18n.t('web.locationDenied'));
    return;
  }
  showToast(PT.i18n.t('web.loading'), { duration: 1400 });
  navigator.geolocation.getCurrentPosition(async (position) => {
    const { latitude, longitude } = position.coords;
    let name = PT.i18n.t('web.currentLocation');
    let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      const cities = await PT.api.nearby(latitude, longitude);
      if (cities[0]) {
        name = cities[0].name;
        timezone = cities[0].timezone;
      }
    } catch { /* keep generic name */ }
    setLocation({ lat: latitude, lng: longitude, name, timezone });
    showToast(PT.i18n.t('web.synced'));
  }, (error) => {
    console.warn('[compass] geolocation', error);
    showToast(PT.i18n.t('web.locationDenied'));
  }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
}

function markerIcon(html, size = 24) {
  return window.L.divIcon({
    className: '',
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function initMap() {
  if (map || !window.L) return;
  map = window.L.map(mapEl, { zoomControl: true, attributionControl: true });
  const satellite = window.L.tileLayer('https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg', {
    maxZoom: 18,
    attribution: 'Sentinel-2 cloudless – <a href="https://s2maps.eu">s2maps.eu</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2020)',
  });
  const streets = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });
  satellite.addTo(map);
  window.L.control.layers({ [PT.i18n.t('web.satellite')]: satellite, [PT.i18n.t('web.street')]: streets }, null, { position: 'topright' }).addTo(map);

  userMarker = window.L.marker([location.lat, location.lng], {
    icon: markerIcon(`<div class="map-marker">${iconSvg('location', { size: 14 })}</div>`, 24),
    keyboard: false,
  }).addTo(map);
  kaabaMarker = window.L.marker([KAABA.lat, KAABA.lng], {
    icon: markerIcon('<div class="map-marker map-marker--kaaba"><img src="./assets/img/kaaba.png" alt="" width="44" height="36"></div>', 44),
    keyboard: false,
  }).addTo(map);
  line = window.L.polyline(greatCirclePoints(location.lat, location.lng), {
    color: '#4fc3f7',
    weight: 3,
    opacity: 0.95,
  }).addTo(map);

  map.on('click', (event) => {
    if (!pickMode) return;
    pickMode = false;
    if (pickButton) pickButton.classList.remove('btn--danger');
    setLocation({
      lat: event.latlng.lat,
      lng: event.latlng.lng,
      name: PT.i18n.t('web.currentLocation'),
      timezone: location.timezone,
    });
  });

  updateMap();
}

function updateMap() {
  if (!map) return;
  userMarker?.setLatLng([location.lat, location.lng]);
  line?.setLatLngs(greatCirclePoints(location.lat, location.lng));
  const qibla = bearing();
  const dist = distance();
  if (angleEl) angleEl.textContent = `${Math.round(qibla)}°`;
  if (distanceEl) distanceEl.textContent = `${Math.round(dist)} ${PT.i18n.t('web.km')}`;
  if (mode === 'map') {
    const bounds = window.L.latLngBounds(
      [location.lat, location.lng],
      [KAABA.lat, KAABA.lng],
    );
    map.fitBounds(bounds.pad(0.18), { maxZoom: 6, animate: false });
  }
}

function setMode(next) {
  mode = next;
  if (mode === 'map') {
    body2d.hidden = true;
    mapWrap.hidden = false;
    initMap();
    requestAnimationFrame(() => map?.invalidateSize());
  } else {
    mapWrap.hidden = true;
    body2d.hidden = false;
  }
  if (toggleButton) {
    toggleButton.innerHTML = iconSvg(mode === 'map' ? 'compass' : 'map');
    toggleButton.setAttribute('aria-label', PT.i18n.t(mode === 'map' ? 'web.compass' : 'web.map'));
  }
}

const renderDialThrottled = rafThrottle(renderDial);

range?.addEventListener('input', () => {
  manualHeading = Number(range.value || 0);
  heading = null;
  renderDial();
  showManual(true);
});

enableButton?.addEventListener('click', enableSensor);
toggleButton?.addEventListener('click', () => setMode(mode === 'map' ? 'compass' : 'map'));
locateButton?.addEventListener('click', async () => {
  await enableSensorIfNeeded();
  locate();
});
locationButton?.addEventListener('click', () => openCitySearch((city) => {
  setLocation(city);
  showToast(PT.i18n.t('web.added'));
}));
pickButton?.addEventListener('click', () => {
  pickMode = !pickMode;
  pickButton.classList.toggle('btn--danger', pickMode);
});

async function enableSensorIfNeeded() {
  if (sensorActive) return;
  if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
    await enableSensor();
  } else {
    startSensor();
  }
}

renderLocation();
renderDial();
startSensor();
window.addEventListener('pt:themechange', renderDialThrottled);
