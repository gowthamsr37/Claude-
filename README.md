# Safarnama · सफ़रनामा

> **safarnāma** *(noun)*: the story of one's travels; a travelogue.

Safarnama is a travel map for the places you've been. Pick the **Indian states & union territories** and the **countries** you've visited from a searchable drop-down, or just tap them on the map, and watch them light up. It is fully **offline**, private (everything stays in your browser), and works on phones and desktops.

## Features

- **Two maps:** India (all 28 states + 8 UTs, current boundaries including Ladakh and the merged Dadra & Nagar Haveli and Daman & Diu) and the world (all 195 countries plus territories).
- **Searchable multi-select drop-down:**
  - Grouped by zone (India) or continent (world), with per-group "Select all".
  - Full keyboard support: <kbd>↑</kbd> <kbd>↓</kbd> <kbd>Enter</kbd> <kbd>Esc</kbd>, and <kbd>/</kbd> to focus the search.
  - Finds places by city or landmark too: *Munnar* → Kerala, *Dubai* → UAE, *Machu Picchu* → Peru.
- **Highlighted map:**
  - Visited places get a gradient with a soft glow.
  - Zoom with the scroll wheel, a trackpad, pinch, or the buttons; drag to pan.
  - Labels never overlap, and tiny places (Chandigarh, Lakshadweep, Singapore, Vatican…) get tappable markers.
- **Stats:** a completion ring, share of land area explored, zone/continent progress bars, a traveller rank ("Weekend explorer", "Globetrotter"…) and small celebrations when you complete a zone or unlock a continent.
- **Share:**
  - **Share link:** a compact URL that opens your map in a read-only view, with a "Make it mine" button.
  - **Save image:** a poster-style PNG of your map and stats.
- **Look & feel:**
  - Dark "night atlas" and warm light themes.
  - Four highlight palettes: Saffron sunset, Lagoon, Aurora and Gulabi.
- **Offline:**
  - A service worker caches everything on first visit, and the app installs to your home screen.
  - Opening `index.html` straight from disk (`file://`) works too: no server or internet needed.

## Run it

Open `index.html` in any modern browser. That's it.

To get the installable, offline-cached app, serve the folder over HTTP(S), for example with GitHub Pages or locally:

```sh
python3 -m http.server 8080   # then visit http://localhost:8080
```

After the first visit the app works with no connection at all.

## How it works

There is no framework and no runtime dependency. The boundary data is simplified and **pre-projected at build time** into compact SVG paths (`js/data/*.js`), so the browser never needs a map library, map tiles or network access.

| Path | What it is |
| --- | --- |
| `index.html`, `css/styles.css`, `js/app.js` | The app |
| `js/data/india.js`, `js/data/world.js` | Generated map data (≈300 KB each) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support and installability |
| `fonts/` | Self-hosted fonts (Fraunces, Plus Jakarta Sans, Twemoji country flags) |
| `scripts/` | Build scripts that regenerate the data, fonts and icons |

### Rebuilding the data

```sh
npm install
npm run build:data     # downloads the source shapefiles into .cache/ and writes js/data/*.js
npm run build:assets   # copies fonts; renders PNG icons if Playwright is available
```

Curated names, zones, continents and search aliases live in `scripts/meta.mjs`. If you change `sw.js` assets, bump `VERSION` there.

## Data & credits

- **India states & UTs:** [DataMeet India community maps](https://github.com/datameet/maps), CC BY 4.0.
- **World countries:** [Natural Earth](https://www.naturalearthdata.com/) 1:10m admin-0 countries, *India point of view* edition (public domain). It matches India's official boundaries, so both maps agree.
- **Flags:** [Twemoji](https://github.com/jdecked/twemoji) graphics (CC BY 4.0) via [country-flag-emoji-polyfill](https://github.com/talkjs/country-flag-emoji-polyfill) (MIT).
- **Fonts:** [Fraunces](https://github.com/undercasetype/Fraunces) and [Plus Jakarta Sans](https://github.com/tokotype/PlusJakartaSans), SIL Open Font License 1.1.

The country count uses the 193 UN member states plus the two UN observer states (Vatican City and Palestine). Territories and other regions are tracked separately.
