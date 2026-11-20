#!/usr/bin/env python3
"""
One-time helper: extracts reusable data from the Android app into webapp/data.
This script is NOT needed at runtime and is not part of a build pipeline.
"""
import json
import os
import re
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

WEB = Path(__file__).resolve().parents[1]
DATA = WEB / "data"

def find_android_root() -> Path:
    env = os.environ.get("ANDROID_ROOT")
    if env:
        return Path(env).expanduser().resolve()
    if len(sys.argv) > 1 and not sys.argv[1].startswith("-"):
        return Path(sys.argv[1]).expanduser().resolve()
    candidates = [
        WEB.parent / "prayer-times-android" / "prayer-times-android",
        WEB.parent / "prayer-times-android",
        Path.cwd() / "prayer-times-android",
    ]
    for candidate in candidates:
        if (candidate / "app" / "src" / "main" / "res").exists():
            return candidate.resolve()
    print(
        "Android-Quellrepo nicht gefunden. Setze ANDROID_ROOT oder übergib den Pfad:\n"
        "  ANDROID_ROOT=/pfad/zu/prayer-times-android python3 tools/extract-android-data.py",
        file=sys.stderr,
    )
    raise SystemExit(2)

ROOT = find_android_root()
RES = ROOT / "app" / "src" / "main" / "res"
TRANS = ROOT / "app" / "src" / "main" / "translations"

RELEVANT = [
    "strings.xml", "times.xml", "compass.xml", "dhikr.xml", "calendar.xml",
    "about.xml", "settings.xml", "widget.xml", "intro.xml", "missedprayers.xml",
]

ANDROID_ESCAPES = {
    "n": "\n", "t": "\t", "r": "\r", "'": "'", '"': '"', "\\": "\\",
}


def unescape(value: str) -> str:
    def repl(match):
        ch = match.group(1)
        if ch == "u":
            return match.group(0)
        return ANDROID_ESCAPES.get(ch, ch)

    value = re.sub(r"\\(.)", repl, value)
    value = re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1), 16)), value)
    return value


def parse_strings(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as exc:
        print(f"WARN parse {path}: {exc}", file=sys.stderr)
        return {}
    out = {}
    for node in root.findall("string"):
        name = node.get("name")
        if not name:
            continue
        text = "".join(node.itertext())
        out[name] = unescape(text)
    return out


def collect(lang_dir: Path) -> dict[str, str]:
    merged = {}
    for filename in RELEVANT:
        merged.update(parse_strings(lang_dir / filename))
    return merged


def extract_i18n():
    en = collect(RES / "values")
    de = collect(TRANS / "values-de")
    tr = collect(TRANS / "values-tr")

    # Some strings live in res/values-xx instead of translations.
    for lang, target in (("de", de), ("tr", tr)):
        folder = RES / f"values-{lang}"
        if folder.exists():
            target.update(collect(folder))

    # Web-only additions. Android keys are reused where they exist.
    web = {
        "de": {
            "web.menu": "Menü",
            "web.more": "Mehr",
            "web.skipToContent": "Zum Inhalt springen",
            "web.enableCompass": "Kompass aktivieren",
            "web.moveUp": "Nach oben",
            "web.moveDown": "Nach unten",
            "web.addCity": "Stadt hinzufügen",
            "web.searchCity": "Stadt suchen",
            "web.searchCityHint": "Stadtname eingeben …",
            "web.useLocation": "Standort verwenden",
            "web.noCities": "Noch keine Stadt",
            "web.noCitiesHint": "Füge eine Stadt hinzu oder nutze deinen Standort.",
            "web.removeCity": "Stadt entfernen",
            "web.removeCityConfirm": "Möchtest du „%1$s“ wirklich entfernen?",
            "web.standalone": "Eigenständige Seite",
            "web.openStandalone": "Eigenständig öffnen",
            "web.openInApp": "In der App öffnen",
            "web.copyLink": "Link kopieren",
            "web.copied": "Kopiert",
            "web.sync": "Synchronisieren",
            "web.synced": "Aktualisiert",
            "web.offline": "Offline – gespeicherte Daten werden angezeigt.",
            "web.loading": "Lädt …",
            "web.error": "Etwas ist schiefgelaufen.",
            "web.retry": "Erneut versuchen",
            "web.today": "Heute",
            "web.nextPrayer": "Nächstes Gebet",
            "web.remaining": "verbleibend",
            "web.monthView": "Monatsansicht",
            "web.close": "Schließen",
            "web.save": "Speichern",
            "web.edit": "Bearbeiten",
            "web.done": "Fertig",
            "web.selectCity": "Stadt wählen",
            "web.currentLocation": "Aktueller Standort",
            "web.km": "km",
            "web.degree": "Grad",
            "web.qibla": "Qibla",
            "web.map": "Karte",
            "web.compass": "Kompass",
            "web.satellite": "Satellit",
            "web.street": "Straße",
            "web.locationDenied": "Standortzugriff wurde nicht erlaubt.",
            "web.compassUnavailable": "Kein Kompasssensor verfügbar. Du kannst die Richtung manuell einstellen.",
            "web.calibrateHint": "Bewege dein Gerät einige Male in einer Acht, um den Kompass zu kalibrieren.",
            "web.target": "Ziel",
            "web.rounds": "Runden",
            "web.reset": "Zurücksetzen",
            "web.addDhikr": "Dhikr hinzufügen",
            "web.editDhikr": "Dhikr bearbeiten",
            "web.dhikrTitle": "Name",
            "web.dhikrTarget": "Ziel",
            "web.deleteDhikr": "Dhikr löschen",
            "web.deleteDhikrConfirm": "Möchtest du „%1$s“ wirklich löschen?",
            "web.vibration": "Vibration",
            "web.vibrationOff": "Aus",
            "web.vibrationSoft": "Leise",
            "web.vibrationStrong": "Stark",
            "web.color": "Farbe",
            "web.searchNames": "Namen durchsuchen",
            "web.noResults": "Keine Treffer",
            "web.source": "Quelle",
            "web.credits": "Danksagungen",
            "web.licenses": "Lizenzen",
            "web.storage": "Speicher",
            "web.resetData": "Alle Daten zurücksetzen",
            "web.resetDataConfirm": "Alle gespeicherten Städte, Einstellungen und Dhikrs werden gelöscht. Fortfahren?",
            "web.theme": "Design",
            "web.themeSystem": "System",
            "web.themeLight": "Hell",
            "web.themeDark": "Dunkel",
            "web.nightMode": "Nachtmodus",
            "web.numbers": "Ziffern",
            "web.normal": "Normal",
            "web.arabicNumbers": "Arabisch",
            "web.farsiNumbers": "Persisch",
            "web.hour12": "12-Stunden-Format",
            "web.current": "Aktuell",
            "web.next": "Nächste",
            "web.kerahat": "Makruh-Zeit",
            "web.asrType": "Asr-Berechnung",
            "web.shafi": "Schafi",
            "web.hanafi": "Hanafi",
            "web.both": "Beides",
            "web.minuteAdjust": "Minutenkorrektur",
            "web.timezoneOffset": "Zeitzonen-Korrektur",
            "web.citySettings": "Stadt-Einstellungen",
            "web.dataSource": "Datenquelle",
            "web.aboutText": "Eine WebApp-Version der Gebetszeiten-App – mit Gebetszeiten, Qibla-Kompass, 99 Namen, Dhikr und islamischen Feiertagen.",
            "web.viewOnGithub": "Auf GitHub ansehen",
            "web.reportBug": "Fehler melden",
            "web.translate": "Übersetzen",
            "web.rate": "Bewerten",
            "web.shareApp": "App teilen",
            "web.install": "App installieren",
            "web.installHint": "Zum Startbildschirm hinzufügen",
            "web.calendarHijri": "Hijri-Kalender",
            "web.calendarGregorian": "Gregorianischer Kalender",
            "web.switchCalendar": "Kalender wechseln",
            "web.eventDetails": "Details",
            "web.noEventDetails": "Für dieses Ereignis ist in dieser Sprache kein Artikel hinterlegt.",
            "web.days": "Tage",
            "web.month": "Monat",
            "web.year": "Jahr",
            "web.kerahatActive": "Makruh-Gebetszeit",
            "web.kerahatEndsIn": "endet in",
            "web.autoLocation": "Standort automatisch ermitteln",
            "web.searchResults": "Suchergebnisse",
            "web.added": "Hinzugefügt",
            "web.alreadyAdded": "Stadt ist bereits hinzugefügt.",
            "web.noSearchResults": "Keine Stadt gefunden.",
            "web.apiUnavailable": "Die Gebetszeiten konnten nicht geladen werden.",
            "web.standaloneHint": "Diese Seite zeigt nur die Gebetszeiten einer Stadt – ohne App-Menü.",
            "web.backToApp": "Zur App",
            "web.city": "Stadt",
            "web.country": "Land",
            "web.provider": "Anbieter",
            "web.monthly": "Monatsansicht",
            "web.monthNavigation": "Monat wählen",
            "web.previousMonth": "Vorheriger Monat",
            "web.nextMonth": "Nächster Monat",
            "web.prayerTimesFor": "Gebetszeiten für %1$s",
            "web.appTitle": "Gebetszeiten",
            "web.about": "Über",
            "web.aboutApp": "Über diese App",
            "web.developedBy": "Entwickelt von",
            "web.androidApp": "Android-App",
            "web.webApp": "WebApp",
            "web.version": "Version",
            "web.license": "Lizenz",
            "web.thirdParty": "Drittanbieter",
            "web.privacy": "Datenschutz",
            "web.mapAttribution": "Kartendaten",
            "web.compassNote": "Die Qibla-Richtung wird aus deinem Standort berechnet. Halte das Gerät flach und kalibriere den Kompass gegebenenfalls.",
            "web.mapCurveNote": "Die Linie folgt dem Großkreis – also dem kürzesten Weg auf der Erdkugel.",
            "web.chooseOnMap": "Standort auf der Karte wählen",
            "web.useThisLocation": "Diesen Standort verwenden",
            "web.manualHeading": "Richtung manuell einstellen",
            "web.vibrationHint": "Vibration beim Zählen",
            "web.dhikrHint": "Tippe auf den Kreis, um zu zählen.",
            "web.namesHint": "Tippe auf die Suche, um Namen, Bedeutung oder arabischen Text zu filtern.",
            "web.calendarHint": "Wähle ein Jahr und wechsle zwischen Hijri- und gregorianischem Kalender.",
            "web.storageLocal": "LocalStorage",
            "web.storageAndroid": "Android-Speicher",
            "web.storageMemory": "Nur im Arbeitsspeicher",
            "web.storageHint": "Die Persistenz läuft über ein austauschbares Interface. In einer Android-WebView kann sie an den nativen Speicher übergeben werden.",
            "web.settingsSaved": "Gespeichert",
            "web.selectProvider": "Anbieter wählen",
            "web.searchByCoordinates": "In der Nähe suchen",
            "web.noProvider": "Keine Quelle",
            "web.refreshHint": "Die API liefert je nach Quelle unterschiedlich viele Tage. Nicht vorhandene Tage werden nach dem nächsten Abgleich ergänzt.",
            "web.timezone": "Zeitzone",
            "web.minutes": "Minuten",
            "web.angle": "Winkel",
            "web.distance": "Entfernung",
            "web.shareTimes": "Gebetszeiten von heute für %1$s",
            "web.linkCopied": "Link in die Zwischenablage kopiert.",
        },
        "en": {
            "web.menu": "Menu",
            "web.more": "More",
            "web.skipToContent": "Skip to content",
            "web.enableCompass": "Enable compass",
            "web.moveUp": "Move up",
            "web.moveDown": "Move down",
            "web.addCity": "Add city",
            "web.searchCity": "Search city",
            "web.searchCityHint": "Enter a city name …",
            "web.useLocation": "Use my location",
            "web.noCities": "No city yet",
            "web.noCitiesHint": "Add a city or use your location.",
            "web.removeCity": "Remove city",
            "web.removeCityConfirm": "Remove “%1$s”?",
            "web.standalone": "Standalone page",
            "web.openStandalone": "Open standalone",
            "web.openInApp": "Open in app",
            "web.copyLink": "Copy link",
            "web.copied": "Copied",
            "web.sync": "Sync",
            "web.synced": "Updated",
            "web.offline": "Offline – showing cached data.",
            "web.loading": "Loading …",
            "web.error": "Something went wrong.",
            "web.retry": "Try again",
            "web.today": "Today",
            "web.nextPrayer": "Next prayer",
            "web.remaining": "remaining",
            "web.monthView": "Month view",
            "web.close": "Close",
            "web.save": "Save",
            "web.edit": "Edit",
            "web.done": "Done",
            "web.selectCity": "Select city",
            "web.currentLocation": "Current location",
            "web.km": "km",
            "web.degree": "degrees",
            "web.qibla": "Qibla",
            "web.map": "Map",
            "web.compass": "Compass",
            "web.satellite": "Satellite",
            "web.street": "Street",
            "web.locationDenied": "Location access was not granted.",
            "web.compassUnavailable": "No compass sensor available. You can set the direction manually.",
            "web.calibrateHint": "Move your device in a figure eight a few times to calibrate the compass.",
            "web.target": "Target",
            "web.rounds": "Rounds",
            "web.reset": "Reset",
            "web.addDhikr": "Add dhikr",
            "web.editDhikr": "Edit dhikr",
            "web.dhikrTitle": "Name",
            "web.dhikrTarget": "Target",
            "web.deleteDhikr": "Delete dhikr",
            "web.deleteDhikrConfirm": "Delete “%1$s”?",
            "web.vibration": "Vibration",
            "web.vibrationOff": "Off",
            "web.vibrationSoft": "Soft",
            "web.vibrationStrong": "Strong",
            "web.color": "Color",
            "web.searchNames": "Search names",
            "web.noResults": "No results",
            "web.source": "Source",
            "web.credits": "Credits",
            "web.licenses": "Licenses",
            "web.storage": "Storage",
            "web.resetData": "Reset all data",
            "web.resetDataConfirm": "All saved cities, settings and dhikrs will be deleted. Continue?",
            "web.theme": "Theme",
            "web.themeSystem": "System",
            "web.themeLight": "Light",
            "web.themeDark": "Dark",
            "web.nightMode": "Night mode",
            "web.numbers": "Numerals",
            "web.normal": "Normal",
            "web.arabicNumbers": "Arabic",
            "web.farsiNumbers": "Persian",
            "web.hour12": "12-hour format",
            "web.current": "Current",
            "web.next": "Next",
            "web.kerahat": "Makruh time",
            "web.asrType": "Asr calculation",
            "web.shafi": "Shafi",
            "web.hanafi": "Hanafi",
            "web.both": "Both",
            "web.minuteAdjust": "Minute adjustment",
            "web.timezoneOffset": "Timezone offset",
            "web.citySettings": "City settings",
            "web.dataSource": "Data source",
            "web.aboutText": "A web version of Prayer Times – with prayer times, Qibla compass, 99 Names, Dhikr and Islamic holidays.",
            "web.viewOnGithub": "View on GitHub",
            "web.reportBug": "Report a bug",
            "web.translate": "Translate",
            "web.rate": "Rate",
            "web.shareApp": "Share app",
            "web.install": "Install app",
            "web.installHint": "Add to home screen",
            "web.calendarHijri": "Hijri calendar",
            "web.calendarGregorian": "Gregorian calendar",
            "web.switchCalendar": "Switch calendar",
            "web.eventDetails": "Details",
            "web.noEventDetails": "No article is available for this event in this language.",
            "web.days": "days",
            "web.month": "Month",
            "web.year": "Year",
            "web.kerahatActive": "Makruh prayer time",
            "web.kerahatEndsIn": "ends in",
            "web.autoLocation": "Detect location automatically",
            "web.searchResults": "Search results",
            "web.added": "Added",
            "web.alreadyAdded": "City is already added.",
            "web.noSearchResults": "No city found.",
            "web.apiUnavailable": "Prayer times could not be loaded.",
            "web.standaloneHint": "This page shows only one city's prayer times – without the app menu.",
            "web.backToApp": "Back to app",
            "web.city": "City",
            "web.country": "Country",
            "web.provider": "Provider",
            "web.monthly": "Month view",
            "web.monthNavigation": "Choose month",
            "web.previousMonth": "Previous month",
            "web.nextMonth": "Next month",
            "web.prayerTimesFor": "Prayer times for %1$s",
            "web.appTitle": "Prayer Times",
            "web.about": "About",
            "web.aboutApp": "About this app",
            "web.developedBy": "Developed by",
            "web.androidApp": "Android app",
            "web.webApp": "Web app",
            "web.version": "Version",
            "web.license": "License",
            "web.thirdParty": "Third party",
            "web.privacy": "Privacy",
            "web.mapAttribution": "Map data",
            "web.compassNote": "The Qibla direction is calculated from your location. Keep the device flat and calibrate the compass if necessary.",
            "web.mapCurveNote": "The line follows the great circle – the shortest path on the globe.",
            "web.chooseOnMap": "Pick a location on the map",
            "web.useThisLocation": "Use this location",
            "web.manualHeading": "Set direction manually",
            "web.vibrationHint": "Vibrate while counting",
            "web.dhikrHint": "Tap the circle to count.",
            "web.namesHint": "Use search to filter by name, meaning or Arabic text.",
            "web.calendarHint": "Choose a year and switch between Hijri and Gregorian calendars.",
            "web.storageLocal": "LocalStorage",
            "web.storageAndroid": "Android storage",
            "web.storageMemory": "Memory only",
            "web.storageHint": "Persistence uses a swappable interface. In an Android WebView it can be handed over to native storage.",
            "web.settingsSaved": "Saved",
            "web.selectProvider": "Choose provider",
            "web.searchByCoordinates": "Search nearby",
            "web.noProvider": "No source",
            "web.refreshHint": "The API returns a different number of days depending on the source. Missing days are added on the next sync.",
            "web.timezone": "Timezone",
            "web.minutes": "minutes",
            "web.angle": "Angle",
            "web.distance": "Distance",
            "web.shareTimes": "Prayer times for today for %1$s",
            "web.linkCopied": "Link copied to clipboard.",
        },
        "tr": {
            "web.menu": "Menü",
            "web.more": "Daha fazla",
            "web.skipToContent": "İçeriğe geç",
            "web.enableCompass": "Pusulayı etkinleştir",
            "web.moveUp": "Yukarı taşı",
            "web.moveDown": "Aşağı taşı",
            "web.addCity": "Şehir ekle",
            "web.searchCity": "Şehir ara",
            "web.searchCityHint": "Şehir adı girin …",
            "web.useLocation": "Konumumu kullan",
            "web.noCities": "Henüz şehir yok",
            "web.noCitiesHint": "Bir şehir ekleyin veya konumunuzu kullanın.",
            "web.removeCity": "Şehri kaldır",
            "web.removeCityConfirm": "“%1$s” kaldırılsın mı?",
            "web.standalone": "Bağımsız sayfa",
            "web.openStandalone": "Bağımsız aç",
            "web.openInApp": "Uygulamada aç",
            "web.copyLink": "Bağlantıyı kopyala",
            "web.copied": "Kopyalandı",
            "web.sync": "Senkronize et",
            "web.synced": "Güncellendi",
            "web.offline": "Çevrimdışı – kayıtlı veriler gösteriliyor.",
            "web.loading": "Yükleniyor …",
            "web.error": "Bir hata oluştu.",
            "web.retry": "Tekrar dene",
            "web.today": "Bugün",
            "web.nextPrayer": "Sonraki vakit",
            "web.remaining": "kaldı",
            "web.monthView": "Aylık görünüm",
            "web.close": "Kapat",
            "web.save": "Kaydet",
            "web.edit": "Düzenle",
            "web.done": "Tamam",
            "web.selectCity": "Şehir seç",
            "web.currentLocation": "Mevcut konum",
            "web.km": "km",
            "web.degree": "derece",
            "web.qibla": "Kıble",
            "web.map": "Harita",
            "web.compass": "Pusula",
            "web.satellite": "Uydu",
            "web.street": "Sokak",
            "web.locationDenied": "Konum izni verilmedi.",
            "web.compassUnavailable": "Pusula sensörü yok. Yönü elle ayarlayabilirsiniz.",
            "web.calibrateHint": "Pusulayı kalibre etmek için cihazı birkaç kez sekiz şeklinde hareket ettirin.",
            "web.target": "Hedef",
            "web.rounds": "Turlar",
            "web.reset": "Sıfırla",
            "web.addDhikr": "Zikir ekle",
            "web.editDhikr": "Zikri düzenle",
            "web.dhikrTitle": "Ad",
            "web.dhikrTarget": "Hedef",
            "web.deleteDhikr": "Zikri sil",
            "web.deleteDhikrConfirm": "“%1$s” silinsin mi?",
            "web.vibration": "Titreşim",
            "web.vibrationOff": "Kapalı",
            "web.vibrationSoft": "Hafif",
            "web.vibrationStrong": "Güçlü",
            "web.color": "Renk",
            "web.searchNames": "İsimlerde ara",
            "web.noResults": "Sonuç yok",
            "web.source": "Kaynak",
            "web.credits": "Emeği geçenler",
            "web.licenses": "Lisanslar",
            "web.storage": "Depolama",
            "web.resetData": "Tüm verileri sıfırla",
            "web.resetDataConfirm": "Kayıtlı tüm şehirler, ayarlar ve zikirler silinecek. Devam?",
            "web.theme": "Tema",
            "web.themeSystem": "Sistem",
            "web.themeLight": "Açık",
            "web.themeDark": "Koyu",
            "web.nightMode": "Gece modu",
            "web.numbers": "Rakamlar",
            "web.normal": "Normal",
            "web.arabicNumbers": "Arapça",
            "web.farsiNumbers": "Farsça",
            "web.hour12": "12 saat biçimi",
            "web.current": "Mevcut",
            "web.next": "Sonraki",
            "web.kerahat": "Kerahat vakti",
            "web.asrType": "Asr hesabı",
            "web.shafi": "Şafi",
            "web.hanafi": "Hanefi",
            "web.both": "Her ikisi",
            "web.minuteAdjust": "Dakika düzeltmesi",
            "web.timezoneOffset": "Saat dilimi düzeltmesi",
            "web.citySettings": "Şehir ayarları",
            "web.dataSource": "Veri kaynağı",
            "web.aboutText": "Gebetszeiten uygulamasının web sürümü – namaz vakitleri, kıble pusulası, 99 isim, zikir ve İslami günler.",
            "web.viewOnGithub": "GitHub'da görüntüle",
            "web.reportBug": "Hata bildir",
            "web.translate": "Çeviriye yardım et",
            "web.rate": "Değerlendir",
            "web.shareApp": "Uygulamayı paylaş",
            "web.install": "Uygulamayı yükle",
            "web.installHint": "Ana ekrana ekle",
            "web.calendarHijri": "Hicri takvim",
            "web.calendarGregorian": "Miladi takvim",
            "web.switchCalendar": "Takvimi değiştir",
            "web.eventDetails": "Ayrıntılar",
            "web.noEventDetails": "Bu etkinlik için bu dilde bir makale yok.",
            "web.days": "gün",
            "web.month": "Ay",
            "web.year": "Yıl",
            "web.kerahatActive": "Kerahat vakti",
            "web.kerahatEndsIn": "bitiş",
            "web.autoLocation": "Konumu otomatik bul",
            "web.searchResults": "Arama sonuçları",
            "web.added": "Eklendi",
            "web.alreadyAdded": "Şehir zaten ekli.",
            "web.noSearchResults": "Şehir bulunamadı.",
            "web.apiUnavailable": "Namaz vakitleri yüklenemedi.",
            "web.standaloneHint": "Bu sayfa yalnızca bir şehrin namaz vakitlerini gösterir – uygulama menüsü olmadan.",
            "web.backToApp": "Uygulamaya dön",
            "web.city": "Şehir",
            "web.country": "Ülke",
            "web.provider": "Sağlayıcı",
            "web.monthly": "Aylık görünüm",
            "web.monthNavigation": "Ay seç",
            "web.previousMonth": "Önceki ay",
            "web.nextMonth": "Sonraki ay",
            "web.prayerTimesFor": "%1$s için namaz vakitleri",
            "web.appTitle": "Namaz Vakitleri",
            "web.about": "Hakkında",
            "web.aboutApp": "Bu uygulama hakkında",
            "web.developedBy": "Geliştiren",
            "web.androidApp": "Android uygulaması",
            "web.webApp": "Web uygulaması",
            "web.version": "Sürüm",
            "web.license": "Lisans",
            "web.thirdParty": "Üçüncü taraf",
            "web.privacy": "Gizlilik",
            "web.mapAttribution": "Harita verileri",
            "web.compassNote": "Kıble yönü konumunuzdan hesaplanır. Cihazı düz tutun ve gerekirse pusulayı kalibre edin.",
            "web.mapCurveNote": "Çizgi büyük daireyi – dünya üzerindeki en kısa yolu – izler.",
            "web.chooseOnMap": "Haritada konum seç",
            "web.useThisLocation": "Bu konumu kullan",
            "web.manualHeading": "Yönü elle ayarla",
            "web.vibrationHint": "Sayarken titreşim",
            "web.dhikrHint": "Saymak için daireye dokunun.",
            "web.namesHint": "İsim, anlam veya Arapça metne göre filtrelemek için aramayı kullanın.",
            "web.calendarHint": "Bir yıl seçin ve Hicri ile Miladi takvim arasında geçiş yapın.",
            "web.storageLocal": "LocalStorage",
            "web.storageAndroid": "Android depolama",
            "web.storageMemory": "Yalnızca bellek",
            "web.storageHint": "Kalıcılık değiştirilebilir bir arayüz kullanır. Android WebView'da yerel depolamaya devredilebilir.",
            "web.settingsSaved": "Kaydedildi",
            "web.selectProvider": "Sağlayıcı seç",
            "web.searchByCoordinates": "Yakında ara",
            "web.noProvider": "Kaynak yok",
            "web.refreshHint": "API kaynağa göre farklı sayıda gün döndürür. Eksik günler sonraki eşitlemede eklenir.",
            "web.timezone": "Saat dilimi",
            "web.minutes": "dakika",
            "web.angle": "Açı",
            "web.distance": "Mesafe",
            "web.shareTimes": "%1$s için bugünün namaz vakitleri",
            "web.linkCopied": "Bağlantı panoya kopyalandı.",
        },
    }

    web_extra = {
        "de": {
            "web.carousel": "Karussell",
            "web.selectDhikr": "Dhikr auswählen",
            "web.dhikrName": "Name des Dhikr",
            "web.compassAria": "Qibla-Kompass",
            "web.creditAndroid": "Android-App:",
            "web.creditData": "Gebetszeiten und Städte:",
            "web.creditMaps": "Satellitenkarte:",
            "web.streetMap": "Straßenkarte:",
            "web.creditLibraries": "Bibliotheken:",
            "web.calculated": "Berechnet",
            "web.locationRequired": "Standort erforderlich",
            "web.locationRequiredHint": "Aktiviere den Standortzugriff, um den Qibla-Kompass zu nutzen.",
            "web.activateLocation": "Standort aktivieren",
            "web.retryLocation": "Standort erneut versuchen",
            "web.secureContextRequired": "Standort und Kompass benötigen HTTPS (oder localhost).",
            "web.openLiveSite": "Veröffentlichte Seite öffnen",
            "web.compassSensorMissing": "Kein Kompasssensor verfügbar. Die Qibla-Richtung wird numerisch angezeigt.",
            "web.sensorPermissionHint": "Aktiviere den Kompasssensor, um die Richtung automatisch zu nutzen.",
            "web.asrOnlyCalc": "Die Asr-Berechnung ist nur für berechnete Zeiten verfügbar.",
            "web.lastUpdated": "Zuletzt aktualisiert",
            "web.monthNoData": "Für diesen Monat liegen keine Daten vor.",
            "web.missedHint": "Die Zähler werden automatisch gespeichert.",
            "web.data": "Daten",
            "web.storageAdapter": "Speicher-Adapter",
        },
        "en": {
            "web.carousel": "Carousel",
            "web.selectDhikr": "Select dhikr",
            "web.dhikrName": "Dhikr name",
            "web.compassAria": "Qibla compass",
            "web.creditAndroid": "Android app:",
            "web.creditData": "Prayer times and cities:",
            "web.creditMaps": "Satellite map:",
            "web.streetMap": "Street map:",
            "web.creditLibraries": "Libraries:",
            "web.calculated": "Calculated",
            "web.locationRequired": "Location required",
            "web.locationRequiredHint": "Enable location access to use the Qibla compass.",
            "web.activateLocation": "Enable location",
            "web.retryLocation": "Retry location",
            "web.secureContextRequired": "Location and compass require HTTPS (or localhost).",
            "web.openLiveSite": "Open the live site",
            "web.compassSensorMissing": "No compass sensor available. The Qibla direction is shown numerically.",
            "web.sensorPermissionHint": "Enable the compass sensor to use the automatic direction.",
            "web.asrOnlyCalc": "Asr calculation is only available for calculated times.",
            "web.lastUpdated": "Last updated",
            "web.monthNoData": "No data available for this month.",
            "web.missedHint": "Counters are saved automatically.",
            "web.data": "Data",
            "web.storageAdapter": "Storage adapter",
        },
        "tr": {
            "web.carousel": "Karusel",
            "web.selectDhikr": "Zikir seç",
            "web.dhikrName": "Zikir adı",
            "web.compassAria": "Kıble pusulası",
            "web.creditAndroid": "Android uygulaması:",
            "web.creditData": "Namaz vakitleri ve şehirler:",
            "web.creditMaps": "Uydu haritası:",
            "web.streetMap": "Sokak haritası:",
            "web.creditLibraries": "Kitaplıklar:",
            "web.calculated": "Hesaplanan",
            "web.locationRequired": "Konum gerekli",
            "web.locationRequiredHint": "Kıble pusulasını kullanmak için konum erişimini etkinleştirin.",
            "web.activateLocation": "Konumu etkinleştir",
            "web.retryLocation": "Konumu yeniden dene",
            "web.secureContextRequired": "Konum ve pusula HTTPS (veya localhost) gerektirir.",
            "web.openLiveSite": "Yayınlanan siteyi aç",
            "web.compassSensorMissing": "Pusula sensörü yok. Kıble yönü sayısal olarak gösterilir.",
            "web.sensorPermissionHint": "Otomatik yön için pusula sensörünü etkinleştirin.",
            "web.asrOnlyCalc": "Asr hesabı yalnızca hesaplanan vakitler için kullanılabilir.",
            "web.lastUpdated": "Son güncelleme",
            "web.monthNoData": "Bu ay için veri yok.",
            "web.missedHint": "Sayaçlar otomatik olarak kaydedilir.",
            "web.data": "Veri",
            "web.storageAdapter": "Depolama bağdaştırıcısı",
        },
    }

    for lang, extra in web.items():
        target = {"en": en, "de": de, "tr": tr}[lang]
        target.update(extra)
        target.update(web_extra[lang])
        # Fallbacks so every language file contains the same key set.
        for key, value in en.items():
            target.setdefault(key, value)

    # Ensure de/tr include English fallback for Android-only keys.
    for target in (de, tr):
        for key, value in en.items():
            target.setdefault(key, value)

    for lang, values in (("de", de), ("en", en), ("tr", tr)):
        out = DATA / "i18n" / f"{lang}.json"
        out.write_text(json.dumps(values, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{out}: {len(values)} keys")


def extract_names():
    def array(path: Path, name: str):
        if not path.exists():
            return []
        root = ET.parse(path).getroot()
        node = root.find(f".//string-array[@name='{name}']")
        if node is None:
            return []
        return [unescape("".join(item.itertext())) for item in node.findall("item")]

    base = RES / "values" / "names.xml"
    ar = array(base, "names_ar")
    en_name = array(base, "names_name")
    en_desc = array(base, "names_desc")
    de = RES / "values-de" / "names.xml"
    tr = TRANS / "values-tr" / "names.xml"
    de_name, de_desc = array(de, "names_name"), array(de, "names_desc")
    tr_name, tr_desc = array(tr, "names_name"), array(tr, "names_desc")

    names = []
    for i, arabic in enumerate(ar):
        names.append({
            "no": i + 1,
            "ar": arabic,
            "name": {
                "en": en_name[i] if i < len(en_name) else "",
                "de": de_name[i] if i < len(de_name) else en_name[i] if i < len(en_name) else "",
                "tr": tr_name[i] if i < len(tr_name) else en_name[i] if i < len(en_name) else "",
            },
            "meaning": {
                "en": en_desc[i] if i < len(en_desc) else "",
                "de": de_desc[i] if i < len(de_desc) else en_desc[i] if i < len(en_desc) else "",
                "tr": tr_desc[i] if i < len(tr_desc) else en_desc[i] if i < len(en_desc) else "",
            },
        })
    out = DATA / "names.json"
    out.write_text(json.dumps({"version": 1, "names": names}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{out}: {len(names)} names")


def extract_hijri():
    rows = []
    tsv = RES / "raw" / "hijri.tsv"
    for line in tsv.read_text(encoding="utf-8-sig").splitlines():
        parts = line.split("\t")
        if len(parts) != 6 or parts[0] == "HD":
            continue
        hd, hm, hy, gd, gm, gy = map(int, parts)
        # Known typo in the Android table: HY 1499 instead of 1449.
        if hy == 1499:
            hy = 1449
        rows.append({"hd": hd, "hm": hm, "hy": hy, "gd": gd, "gm": gm, "gy": gy})

    starts = []
    for row in rows:
        if row["hd"] != 1:
            continue
        date = f"{row['gy']:04d}-{row['gm']:02d}-{row['gd']:02d}"
        starts.append({"hy": row["hy"], "hm": row["hm"], "date": date})
    starts.sort(key=lambda x: x["date"])

    events = [
        {"hm": 1, "hd": 1, "key": "ISLAMIC_NEW_YEAR"},
        {"hm": 1, "hd": 10, "key": "ASHURA"},
        {"hm": 3, "hd": 11, "key": "MAWLID_AL_NABI"},
        {"hm": 7, "hd": 1, "key": "THREE_MONTHS"},
        {"hm": 7, "hd": 5, "key": "RAGAIB"},
        {"hm": 7, "hd": 26, "key": "MIRAJ"},
        {"hm": 8, "hd": 14, "key": "BARAAH"},
        {"hm": 9, "hd": 1, "key": "RAMADAN_BEGIN"},
        {"hm": 9, "hd": 26, "key": "LAYLATALQADR"},
        {"hm": 9, "hd": 29, "key": "LAST_RAMADAN"},
        {"hm": 10, "hd": 1, "key": "EID_AL_FITR_DAY1"},
        {"hm": 10, "hd": 2, "key": "EID_AL_FITR_DAY2"},
        {"hm": 10, "hd": 3, "key": "EID_AL_FITR_DAY3"},
        {"hm": 12, "hd": 9, "key": "ARAFAT"},
        {"hm": 12, "hd": 10, "key": "EID_AL_ADHA_DAY1"},
        {"hm": 12, "hd": 11, "key": "EID_AL_ADHA_DAY2"},
        {"hm": 12, "hd": 12, "key": "EID_AL_ADHA_DAY3"},
        {"hm": 12, "hd": 13, "key": "EID_AL_ADHA_DAY4"},
    ]
    out = DATA / "hijri.json"
    out.write_text(json.dumps({"version": 1, "monthStarts": starts, "events": events}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{out}: {len(starts)} month starts, {len(events)} events")


def main():
    DATA.mkdir(parents=True, exist_ok=True)
    extract_i18n()
    extract_names()
    extract_hijri()


if __name__ == "__main__":
    main()
