import { PT } from '../boot.js';
import { iconSvg } from '../core/icons.js';
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

const gate = document.getElementById('compass-gate');
const gateButton = document.getElementById('compass-gate-locate');
const gateError = document.getElementById('compass-gate-error');
const liveLink = document.getElementById('compass-live-link');
const locationButton = document.getElementById('compass-location');
const rose = document.getElementById('compass-rose');
const qiblaArm = document.getElementById('compass-qibla-arm');
const headingEl = document.getElementById('compass-heading');
const angleEl = document.getElementById('compass-angle');
const distanceEl = document.getElementById('compass-distance');
const enableButton = document.getElementById('compass-enable');
const body2d = document.getElementById('compass-2d');
const mapWrap = document.getElementById('compass-map-wrap');
const mapEl = document.getElementById('compass-map');
const toggleButton = document.getElementById('compass-toggle');
const locateButton = document.getElementById('compass-locate');

const isLiveHost = location.hostname === 'metinkale38.github.io';
const secure = window.isSecureContext;
let location_ = PT.settings.get('compass_location', null);
let heading = null;
let mode = 'compass';
let map = null;
let userMarker = null;
let kaabaMarker = null;
let line = null;
let sensorActive = false;
let sensorTimer = null;
let busy = false;

const sensor = new CompassSensor();

function bearing() {
  return qiblaBearing(location_.lat, location_.lng);
}

function distance() {
  return distanceToKaabaKm(location_.lat, location_.lng);
}

function setGateError(message) {
  if (gateError) gateError.textContent = message || '';
}

function showGate(message = '') {
  gate.hidden = false;
  body2d.hidden = true;
  mapWrap.hidden = true;
  locationButton.hidden = true;
  toggleButton.disabled = true;
  setGateError(message);
  liveLink.hidden = isLiveHost || secure;
}

function hideGate() {
  gate.hidden = true;
  setGateError('');
}

function setBusy(value) {
  busy = value;
  if (gateButton) gateButton.disabled = value;
  if (locateButton) locateButton.disabled = value;
}

function renderLocation() {
  if (!locationButton) return;
  locationButton.hidden = false;
  locationButton.textContent = location_.name || PT.i18n.t('web.currentLocation');
  locationButton.title = PT.i18n.t('web.useLocation');
}

function renderDial() {
  if (!location_) return;
  const qibla = bearing();
  const current = heading == null ? 0 : heading;
  if (rose) rose.style.transform = `rotate(${-normalizeAngle(current)}deg)`;
  if (qiblaArm) qiblaArm.style.transform = `rotate(${qibla}deg)`;
  if (headingEl) headingEl.textContent = heading == null ? '--°' : `${Math.round(normalizeAngle(current))}°`;
  if (angleEl) angleEl.textContent = `${Math.round(qibla)}°`;
  if (distanceEl) {
    const km = Math.round(distance());
    distanceEl.textContent = `${PT.i18n.number(km, PT.settings.get('numbers', 'normal'))} ${PT.i18n.t('web.km')}`;
  }
}

function startSensor() {
  if (enableButton) enableButton.hidden = true;
  if (!CompassSensor.supported()) {
    showToast(PT.i18n.t('web.compassSensorMissing'));
    return;
  }
  const started = sensor.start((value) => {
    heading = value;
    renderDial();
  });
  if (!started && !sensorActive) {
    showToast(PT.i18n.t('web.compassSensorMissing'));
    return;
  }
  sensorActive = true;
  clearTimeout(sensorTimer);
  sensorTimer = window.setTimeout(() => {
    if (heading == null) {
      const needsPermission = typeof DeviceOrientationEvent?.requestPermission === 'function';
      showToast(PT.i18n.t(needsPermission ? 'web.sensorPermissionHint' : 'web.compassSensorMissing'));
      if (needsPermission && enableButton) enableButton.hidden = false;
    }
  }, 1800);
}

async function enableSensor() {
  try {
    const granted = await sensor.requestPermission();
    if (!granted) {
      showToast(PT.i18n.t('web.locationDenied'));
      return;
    }
    startSensor();
    if (enableButton) enableButton.hidden = true;
  } catch (error) {
    console.warn('[compass] sensor permission', error);
    showToast(PT.i18n.t('web.locationDenied'));
  }
}

function setLocation(next, { persist = true } = {}) {
  location_ = {
    lat: Number(next.lat),
    lng: Number(next.lng),
    name: next.name || PT.i18n.t('web.currentLocation'),
    timezone: next.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  if (persist) PT.settings.set('compass_location', location_);
  hideGate();
  renderLocation();
  body2d.hidden = mode === 'map';
  mapWrap.hidden = mode !== 'map';
  toggleButton.disabled = false;
  renderDial();
  if (mode === 'map') {
    initMap();
    updateMap();
  }
  startSensor();
}

function activateLocation() {
  if (busy) return;
  if (!secure) {
    showGate(PT.i18n.t('web.secureContextRequired'));
    liveLink.hidden = false;
    return;
  }
  if (!navigator.geolocation) {
    showGate(PT.i18n.t('web.locationDenied'));
    return;
  }
  setBusy(true);
  setGateError('');
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
    } catch {
      // Keep the generic name; the coordinates are what matters.
    }
    setBusy(false);
    setLocation({ lat: latitude, lng: longitude, name, timezone });
    showToast(PT.i18n.t('web.synced'));
    await enableSensorIfNeeded();
  }, (error) => {
    console.warn('[compass] geolocation', error);
    setBusy(false);
    setGateError(error?.code === 1 ? PT.i18n.t('web.locationDenied') : PT.i18n.t('web.locationDenied'));
  }, {
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 30000,
  });
}

async function enableSensorIfNeeded() {
  if (sensorActive) return;
  if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
    await enableSensor();
  } else {
    startSensor();
  }
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
  if (map || !window.L || !location_) return;
  map = window.L.map(mapEl, { zoomControl: true, attributionControl: true });
  const satellite = window.L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    },
  );
  const streets = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });
  satellite.addTo(map);
  window.L.control.layers(
    { [PT.i18n.t('web.satellite')]: satellite, [PT.i18n.t('web.street')]: streets },
    null,
    { position: 'topright' },
  ).addTo(map);

  userMarker = window.L.marker([location_.lat, location_.lng], {
    icon: markerIcon(`<div class="map-marker">${iconSvg('location', { size: 14 })}</div>`, 24),
    keyboard: false,
  }).addTo(map);
  kaabaMarker = window.L.marker([KAABA.lat, KAABA.lng], {
    icon: markerIcon('<div class="map-marker map-marker--kaaba"><img src="./assets/img/kaaba.png" alt="" width="44" height="36"></div>', 44),
    keyboard: false,
  }).addTo(map);
  line = window.L.polyline(greatCirclePoints(location_.lat, location_.lng), {
    color: '#4fc3f7',
    weight: 3,
    opacity: 0.95,
  }).addTo(map);

  map.setView([location_.lat, location_.lng], 18, { animate: false });
  updateMap();
}

function updateMap() {
  if (!map || !location_) return;
  userMarker?.setLatLng([location_.lat, location_.lng]);
  line?.setLatLngs(greatCirclePoints(location_.lat, location_.lng));
  const qibla = bearing();
  const dist = distance();
  if (angleEl) angleEl.textContent = `${Math.round(qibla)}°`;
  if (distanceEl) distanceEl.textContent = `${Math.round(dist)} ${PT.i18n.t('web.km')}`;
  map.setView([location_.lat, location_.lng], 18, { animate: false });
}

function setMode(next) {
  if (!location_) {
    showGate();
    return;
  }
  mode = next;
  body2d.hidden = mode === 'map';
  mapWrap.hidden = mode !== 'map';
  if (mode === 'map') {
    initMap();
    requestAnimationFrame(() => {
      map?.invalidateSize();
      updateMap();
    });
  }
  if (toggleButton) {
    toggleButton.innerHTML = iconSvg(mode === 'map' ? 'compass' : 'map');
    toggleButton.setAttribute('aria-label', PT.i18n.t(mode === 'map' ? 'web.compass' : 'web.map'));
  }
}

gateButton?.addEventListener('click', activateLocation);
locateButton?.addEventListener('click', activateLocation);
locationButton?.addEventListener('click', activateLocation);
toggleButton?.addEventListener('click', () => setMode(mode === 'map' ? 'compass' : 'map'));
enableButton?.addEventListener('click', enableSensor);

if (location_) {
  setLocation(location_, { persist: false });
} else {
  showGate();
}

window.addEventListener('pt:themechange', () => {
  if (location_) renderDial();
});
