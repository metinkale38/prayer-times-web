export const APP_VERSION = '1.0.0';
export const API_BASE = 'https://opt.mk38.de';
export const KAABA = Object.freeze({ lat: 21.42247, lng: 39.826198 });

export const NAV_ITEMS = [
  { page: 'times', href: './index.html', icon: './assets/icons/menu/times.png', key: 'appName' },
  { page: 'compass', href: './compass.html', icon: './assets/icons/menu/compass.png', key: 'compass' },
  { page: 'names', href: './names.html', icon: './assets/icons/menu/names.png', key: 'names' },
  { page: 'calendar', href: './calendar.html', icon: './assets/icons/menu/calendar.png', key: 'calendar' },
  { page: 'missed', href: './missed.html', icon: './assets/icons/menu/missed.png', key: 'missedPrayers' },
  { page: 'dhikr', href: './dhikr.html', icon: './assets/icons/menu/dhikr.png', key: 'dhikr' },
  { page: 'settings', href: './settings.html', icon: './assets/icons/menu/settings.png', key: 'settings' },
  { page: 'about', href: './about.html', icon: './assets/icons/menu/about.png', key: 'about' },
];

export const LINKS = {
  github: 'https://github.com/metinkale38/prayer-times-android',
  issues: 'https://github.com/metinkale38/prayer-times-android/issues',
  crowdin: 'https://crowdin.com/project/prayer-times-android',
  mail: 'mailto:prayer-times-android@mk38.de',
  playStore: 'https://play.google.com/store/apps/details?id=com.metinkale.prayer',
  share: 'https://play.google.com/store/apps/details?id=com.metinkale.prayer',
  license: 'https://www.apache.org/licenses/LICENSE-2.0',
  eox: 'https://s2maps.eu',
  osm: 'https://www.openstreetmap.org/copyright',
  leaflet: 'https://leafletjs.com',
  htmx: 'https://htmx.org',
  roboto: 'https://fonts.google.com/specimen/Roboto',
};

export const PRAYER_KEYS = ['fajr', 'sun', 'dhuhr', 'asr', 'maghrib', 'ishaa'];
