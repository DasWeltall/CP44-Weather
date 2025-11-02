# CP44 Weather

Minimalistische Dark-Mode Wetter Progressive Web Experience komplett ohne Backend. CP44 Weather liefert präzise Vorhersagen, animierte Radarframes und amtliche Warnungen – alle Daten werden nur auf deinem Gerät gespeichert.

## Features

- 🌐 **Globale Ortssuche** über die Open-Meteo Geocoding API
- 📍 **Standorterkennung** via Browser-GPS – ohne Tracking, ohne Server
- ⭐ **Favoritenverwaltung** lokal in `localStorage`
- ☀️ **Aktuelle Bedingungen** mit gefühlter Temperatur, Luftfeuchte, Windböen und Regenwahrscheinlichkeit
- 🕒 **Stunden- und Tagesvorhersage** in einem Umschalter mit 24-Stunden- bzw. 7-Tages-Detailkarten
- 🚨 **Warnmeldungen** aus dem Open-Meteo Severe Weather Feed
- 🌧️ **Animiertes Regenradar** mit RainViewer-Tiles auf einer monochromen Darkmap
- 🌓 **Monospace-Design** inspiriert von NOTHING – voll responsiv und mobile-optimiert

## Nutzung

1. Öffne `index.html` in einem modernen Browser.
2. Suche nach einem Ort oder nutze den GPS-Button.
3. Speichere Favoriten über den Stern – sie bleiben lokal erhalten.
4. Nutze den Radar-Player für animierte Niederschlagskarten.

> **Hinweis:** Alle API-Aufrufe laufen direkt im Browser. Stelle sicher, dass dein Gerät Zugriff auf das Internet hat, damit Vorhersagen, Warnungen und das Radar geladen werden können.

## Quellen

- [Open-Meteo](https://open-meteo.com/) – Vorhersagen, Geocoding, Warnungen
- [RainViewer](https://www.rainviewer.com/api.html) – Radar Tiles
- [Carto Dark Matter](https://carto.com/) – Kartenbasis auf OpenStreetMap-Daten

## Lizenz

Dieses Projekt steht unter der MIT-Lizenz. Siehe [LICENSE](LICENSE) für Details.
