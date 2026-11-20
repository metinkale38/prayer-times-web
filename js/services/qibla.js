export const KAABA = Object.freeze({ lat: 21.42247, lng: 39.826198 });

const rad = (deg) => (deg * Math.PI) / 180;
const deg = (radians) => (radians * 180) / Math.PI;

export function normalizeAngle(value) {
  return ((Number(value) % 360) + 360) % 360;
}

export function qiblaBearing(lat, lng) {
  const phi1 = rad(lat);
  const phi2 = rad(KAABA.lat);
  const delta = rad(KAABA.lng - lng);
  const y = Math.sin(delta) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(delta);
  return normalizeAngle(deg(Math.atan2(y, x)));
}

export function distanceToKaabaKm(lat, lng) {
  const R = 6371.0088;
  const phi1 = rad(lat);
  const phi2 = rad(KAABA.lat);
  const dPhi = rad(KAABA.lat - lat);
  const dLambda = rad(KAABA.lng - lng);
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toVector(lat, lng) {
  const phi = rad(lat);
  const lambda = rad(lng);
  return [Math.cos(phi) * Math.cos(lambda), Math.cos(phi) * Math.sin(lambda), Math.sin(phi)];
}

function toLatLng([x, y, z]) {
  return {
    lat: deg(Math.asin(z)),
    lng: deg(Math.atan2(y, x)),
  };
}

/**
 * Spherical linear interpolation between two coordinates. The result is the
 * great-circle path, which is what makes the Qibla line curve on a flat map.
 */
export function greatCirclePoints(lat1, lng1, lat2 = KAABA.lat, lng2 = KAABA.lng, steps = 72) {
  const a = toVector(lat1, lng1);
  const b = toVector(lat2, lng2);
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-7) return [{ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 }];
  const sinOmega = Math.sin(omega);
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const s1 = Math.sin((1 - t) * omega) / sinOmega;
    const s2 = Math.sin(t * omega) / sinOmega;
    points.push(toLatLng([
      s1 * a[0] + s2 * b[0],
      s1 * a[1] + s2 * b[1],
      s1 * a[2] + s2 * b[2],
    ]));
  }
  return points;
}

export function smoothAngle(previous, next, alpha = 0.18) {
  if (previous == null || !Number.isFinite(previous)) return normalizeAngle(next);
  const diff = ((next - previous + 540) % 360) - 180;
  return normalizeAngle(previous + alpha * diff);
}

export class CompassSensor {
  constructor() {
    this.heading = null;
    this.lastRaw = null;
    this.listening = false;
    this.callback = null;
    this.handler = (event) => {
      let raw = null;
      if (typeof event.webkitCompassHeading === 'number' && !Number.isNaN(event.webkitCompassHeading)) {
        raw = event.webkitCompassHeading;
      } else if (typeof event.alpha === 'number') {
        raw = 360 - event.alpha;
      }
      if (raw == null) return;
      this.lastRaw = normalizeAngle(raw);
      this.heading = smoothAngle(this.heading, this.lastRaw, 0.18);
      this.callback?.(this.heading, { absolute: Boolean(event.absolute), raw: this.lastRaw });
    };
  }

  static supported() {
    return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
  }

  async requestPermission() {
    if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
      const result = await DeviceOrientationEvent.requestPermission();
      return result === 'granted';
    }
    return true;
  }

  start(callback) {
    this.callback = callback;
    if (!CompassSensor.supported() || this.listening) return false;
    const absolute = 'ondeviceorientationabsolute' in window;
    window.addEventListener(absolute ? 'deviceorientationabsolute' : 'deviceorientation', this.handler, true);
    this.listening = true;
    return true;
  }

  stop() {
    if (!this.listening) return;
    window.removeEventListener('deviceorientationabsolute', this.handler, true);
    window.removeEventListener('deviceorientation', this.handler, true);
    this.listening = false;
    this.callback = null;
  }
}
