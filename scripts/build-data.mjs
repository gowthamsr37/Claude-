// Builds the pre-projected, offline map data used by the app:
//   js/data/india.js  and  js/data/world.js
//
// Sources (downloaded into .cache/geo on first run):
//   • India states & UTs — DataMeet "States/Admin2" (CC BY 4.0)
//     https://github.com/datameet/maps
//   • World countries — Natural Earth 1:10m admin-0, India point-of-view (public domain)
//     https://github.com/nvkelso/natural-earth-vector
//
// Geometry is simplified with mapshaper (topology-aware, so shared borders stay
// gap-free), projected with d3-geo, and serialised as compact relative SVG paths.
// The browser never needs a map library, a tile server or the network.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import mapshaper from 'mapshaper';
import { geoConicConformal, geoNaturalEarth1, geoPath, geoGraticule10, geoArea } from 'd3-geo';
import polylabel from 'polylabel';
import {
  INDIA, INDIA_ZONES, INDIA_SEAS, INDIA_NEIGHBOURS,
  UN195, WORLD_DROP, WORLD_CONTEXT, CONTINENTS, WORLD_NAMES, WORLD_SHORT, WORLD_FLAG, WORLD_ALIASES,
} from './meta.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, '.cache', 'geo');
const OUT = path.join(ROOT, 'js', 'data');
const EARTH_R = 6371.0088; // km

const SOURCES = [
  ...['shp', 'dbf', 'shx', 'prj'].map((e) => ({
    file: `Admin2.${e}`,
    url: `https://raw.githubusercontent.com/datameet/maps/master/States/Admin2.${e}`,
  })),
  ...['shp', 'dbf', 'shx', 'prj', 'cpg'].map((e) => ({
    file: `ne_10m_admin_0_countries_ind.${e}`,
    url: `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/10m_cultural/ne_10m_admin_0_countries_ind.${e}`,
  })),
];

function ensureSources() {
  fs.mkdirSync(CACHE, { recursive: true });
  for (const { file, url } of SOURCES) {
    const dest = path.join(CACHE, file);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) continue;
    console.log(`↓ ${url}`);
    execFileSync('curl', ['-sSfL', '--retry', '3', url, '-o', dest], { stdio: 'inherit' });
  }
}

// mapshaper emits RFC 7946 (counter-clockwise) outer rings; d3-geo wants the
// opposite. Flip any polygon whose spherical area comes out larger than a hemisphere.
function rewind(fc) {
  if (fc.type === 'GeometryCollection') {
    fc = { type: 'FeatureCollection', features: fc.geometries.map((geometry) => ({ type: 'Feature', properties: {}, geometry })) };
  }
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g) continue;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const poly of polys) {
      if (geoArea({ type: 'Polygon', coordinates: poly }) > 2 * Math.PI) poly.forEach((ring) => ring.reverse());
    }
  }
  return fc;
}

async function ms(cmd) {
  const out = await mapshaper.applyCommands(cmd);
  const result = {};
  for (const [k, v] of Object.entries(out)) result[k] = rewind(JSON.parse(v));
  return result;
}

// ------------------------------------------------------------ path writer --
// A d3 path "context" that records projected rings, then serialises them as a
// compact SVG path (absolute M, relative l, 1 decimal place, tiny rings dropped).
class RingRecorder {
  constructor() { this.rings = []; this.cur = null; }
  moveTo(x, y) { this.cur = [[x, y]]; this.rings.push(this.cur); }
  lineTo(x, y) { this.cur.push([x, y]); }
  closePath() {}
  arc() {}
}

const Q = 10; // 0.1px precision
function ringArea(r) {
  let a = 0;
  for (let i = 0, n = r.length; i < n; i++) {
    const [x1, y1] = r[i];
    const [x2, y2] = r[(i + 1) % n];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}
const fmt = (v) => {
  // v is an integer count of tenths
  const s = (v / Q).toString();
  return s.replace(/^0\./, '.').replace(/^-0\./, '-.');
};

function serialize(rings, { minArea = 0.15, keepLargest = true } = {}) {
  const cleaned = [];
  for (const raw of rings) {
    const pts = [];
    for (const [x, y] of raw) {
      const p = [Math.round(x * Q), Math.round(y * Q)];
      const last = pts[pts.length - 1];
      if (!last || last[0] !== p[0] || last[1] !== p[1]) pts.push(p);
    }
    if (pts.length > 1) {
      const f = pts[0], l = pts[pts.length - 1];
      if (f[0] === l[0] && f[1] === l[1]) pts.pop();
    }
    if (pts.length < 3) continue;
    const area = Math.abs(ringArea(pts)) / (Q * Q);
    cleaned.push({ pts, area });
  }
  if (!cleaned.length) return { d: '', area: 0 };
  const largest = cleaned.reduce((a, b) => (b.area > a.area ? b : a));
  let d = '';
  let total = 0;
  for (const r of cleaned) {
    if (r.area < minArea && !(keepLargest && r === largest)) continue;
    total += r.area;
    const [x0, y0] = r.pts[0];
    d += `M${fmt(x0)} ${fmt(y0)}l`;
    let px = x0, py = y0, first = true;
    for (let i = 1; i < r.pts.length; i++) {
      const [x, y] = r.pts[i];
      const dx = fmt(x - px), dy = fmt(y - py);
      d += (first || dx[0] === '-' ? '' : ' ') + dx + (dy[0] === '-' ? '' : ' ') + dy;
      first = false;
      px = x; py = y;
    }
    d += 'z';
  }
  return { d, area: total };
}

function pathOf(projection, geo, opts) {
  const rec = new RingRecorder();
  geoPath(projection, rec)(geo);
  return serialize(rec.rings, opts);
}

// Largest polygon (by spherical area) of a (Multi)Polygon feature.
function largestPolygon(geom) {
  if (geom.type === 'Polygon') return geom.coordinates;
  let best = null, bestA = -1;
  for (const poly of geom.coordinates) {
    const a = geoArea({ type: 'Polygon', coordinates: poly });
    if (a > bestA) { bestA = a; best = poly; }
  }
  return best;
}

// Pole of inaccessibility of the largest polygon in projected space: a much
// better label/marker anchor than the centroid for concave or archipelago shapes.
function labelPoint(projection, geom) {
  const poly = largestPolygon(geom);
  const projected = poly.map((ring) => ring.map((c) => projection(c)).filter(Boolean));
  const p = polylabel(projected, 0.3);
  return { x: +p[0].toFixed(1), y: +p[1].toFixed(1), r: +p.distance.toFixed(1) };
}

// Zoom level at which a label of this length fits inside its shape.
function labelMinZoom(text, inscribedR, fontPx) {
  if (!inscribedR) return 99;
  const w = text.length * fontPx * 0.56;
  const k = Math.max(w / (3.1 * inscribedR), fontPx / (1.5 * inscribedR));
  return +Math.max(0.05, k).toFixed(2);
}

const r1 = (v) => +v.toFixed(1);
const write = (file, key, obj) => {
  const body = `/* Generated by scripts/build-data.mjs. Do not edit by hand. */\n` +
    `(window.HEJJE_DATA = window.HEJJE_DATA || {}).${key} = ${JSON.stringify(obj)};\n`;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, file), body);
  console.log(`✓ ${path.relative(ROOT, path.join(OUT, file))}  ${(body.length / 1024).toFixed(0)} KB`);
};

// ------------------------------------------------------------------ world --
async function loadWorld(pct) {
  const shp = path.join(CACHE, 'ne_10m_admin_0_countries_ind.shp');
  const drop = JSON.stringify([...WORLD_DROP]);
  const res = await ms(
    `-i "${shp}" encoding=utf8 ` +
    `-filter '!${drop}.includes(ADM0_A3)' ` +
    `-filter-fields ADM0_A3,ISO_A2_EH,NAME_EN,NAME,CONTINENT,REGION_UN,SUBREGION,TYPE ` +
    `-simplify ${pct} keep-shapes ` +
    `-o format=geojson world.json`
  );
  return res['world.json'];
}

function continentOf(p) {
  if (p.CONTINENT !== 'Seven seas (open ocean)') return p.CONTINENT;
  if (p.REGION_UN === 'Americas') return 'South America';
  return p.REGION_UN; // Africa / Asia / Oceania
}

async function buildWorld() {
  const geo = await loadWorld('6%');
  const W = 1000;
  const projection = geoNaturalEarth1().rotate([-11, 0]).precision(0.2);
  projection.fitWidth(W - 8, { type: 'Sphere' });
  const [[x0, y0], [x1, y1]] = geoPath(projection).bounds({ type: 'Sphere' });
  const H = Math.ceil(y1 - y0 + 8);
  projection.fitExtent([[4, 4], [W - 4, H - 4]], { type: 'Sphere' });

  const regions = [];
  const context = [];
  let totalArea = 0;
  for (const f of geo.features) {
    const p = f.properties;
    const sr = geoArea(f);
    if (sr > 2 * Math.PI) throw new Error(`Inverted winding for ${p.ADM0_A3}`);
    const { d, area: pxArea } = pathOf(projection, f, { minArea: 0.12 });
    if (WORLD_CONTEXT.has(p.ADM0_A3)) { if (d) context.push(d); continue; }
    // Micro-states (Vatican, Tuvalu…) vanish below 0.1px — they keep no outline
    // and are drawn as markers instead.
    const id = p.ADM0_A3;
    const a2 = id in WORLD_FLAG ? WORLD_FLAG[id] : (p.ISO_A2_EH && p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : '');
    const name = WORLD_NAMES[id] || p.NAME_EN || p.NAME;
    const short = WORLD_SHORT[id] || name;
    const lp = labelPoint(projection, f.geometry);
    const km2 = Math.round(sr * EARTH_R * EARTH_R);
    totalArea += km2;
    const sov = UN195.has(a2);
    let tag = '';
    if (!sov) tag = id === 'ATA' ? 'Continent' : id === 'TWN' ? 'Region' : 'Territory';
    regions.push({
      id, a2, name, short, continent: continentOf(p), sov, tag,
      aliases: WORLD_ALIASES[id] || [],
      d, area: km2, lx: lp.x, ly: lp.y,
      z: labelMinZoom(short, lp.r, 10),
      tiny: pxArea < 9 ? 1 : 0,
      px: r1(pxArea),
    });
  }

  // Sanity check: every UN member / observer must be present exactly once.
  const have = new Set(regions.filter((r) => r.sov).map((r) => r.a2));
  const missing = [...UN195].filter((c) => !have.has(c));
  if (missing.length) throw new Error(`Missing UN195 countries: ${missing.join(' ')}`);
  if (have.size !== 195) throw new Error(`Expected 195 sovereign entries, got ${have.size}`);

  regions.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const sphere = pathOf(projection, { type: 'Sphere' }, { minArea: 0 }).d;
  const grat = new RingRecorder();
  geoPath(projection, grat)(geoGraticule10());
  // graticule lines are open polylines — serialise without closing
  let graticule = '';
  for (const line of grat.rings) {
    const pts = line.map(([x, y]) => [Math.round(x * Q), Math.round(y * Q)]);
    graticule += `M${fmt(pts[0][0])} ${fmt(pts[0][1])}`;
    for (let i = 1; i < pts.length; i++) graticule += `L${fmt(pts[i][0])} ${fmt(pts[i][1])}`;
  }

  write('world.js', 'world', {
    w: W, h: H, sphere, graticule, context, continents: CONTINENTS, totalArea, regions,
  });
  return { geo, regions };
}

// ------------------------------------------------------------------ india --
async function buildIndia(worldGeo) {
  const shp = path.join(CACHE, 'Admin2.shp');
  const res = await ms(
    `-i "${shp}" encoding=latin1 ` +
    `-simplify interval=450 keep-shapes ` +
    `-o format=geojson india.json`
  );
  const geo = res['india.json'];

  // Lambert Conformal Conic, the projection Survey of India maps use.
  const W = 1000, PX = 70, PY = 34;
  const projection = geoConicConformal().parallels([12.472944, 35.172806]).rotate([-80, 0]).precision(0.1);
  projection.fitWidth(W - 2 * PX, geo);
  const b0 = geoPath(projection).bounds(geo);
  const H = Math.ceil((b0[1][1] - b0[0][1]) + 2 * PY);
  projection.fitExtent([[PX, PY], [W - PX, H - PY]], geo);

  const regions = [];
  let totalArea = 0;
  for (const f of geo.features) {
    const st = f.properties.ST_NM;
    const meta = INDIA[st];
    if (!meta) throw new Error(`No metadata for India region "${st}"`);
    const sr = geoArea(f);
    if (sr > 2 * Math.PI) throw new Error(`Inverted winding for ${st}`);
    const { d, area: pxArea } = pathOf(projection, f, { minArea: 0.08 });
    const name = meta.name || st;
    const short = meta.short || name;
    const lp = labelPoint(projection, f.geometry);
    const km2 = Math.round(sr * EARTH_R * EARTH_R);
    totalArea += km2;
    const lab = meta.label || {};
    regions.push({
      id: meta.id, name, short, kind: meta.kind, zone: meta.zone, aliases: meta.aliases,
      d, area: km2, lx: lp.x, ly: lp.y,
      z: lab.z ?? labelMinZoom(short, lp.r, 10.5),
      ...(lab.anchor ? { la: lab.anchor, ldx: lab.dx } : {}),
      tiny: pxArea < 140 ? 1 : 0,
      px: r1(pxArea),
    });
  }
  if (regions.length !== 36) throw new Error(`Expected 36 states/UTs, got ${regions.length}`);
  regions.sort((a, b) => a.name.localeCompare(b.name, 'en'));

  // Neighbouring countries, clipped to the frame, drawn faintly for context.
  const clipped = geoConicConformal().parallels([12.472944, 35.172806]).rotate([-80, 0])
    .scale(projection.scale()).translate(projection.translate()).precision(0.2)
    .clipExtent([[-560, -320], [W + 560, H + 320]]); // generous, so letterboxed views never show an edge
  const context = [];
  for (const f of worldGeo.features) {
    if (f.properties.ADM0_A3 === 'IND') continue;
    const { d } = pathOf(clipped, f, { minArea: 0.8, keepLargest: false });
    if (d) context.push(d);
  }

  const inFrame = ([x, y]) => x > 40 && x < W - 40 && y > 16 && y < H - 16;
  const seas = INDIA_SEAS.map((s) => {
    const [x, y] = projection([s.lon, s.lat]);
    return { name: s.name, x: r1(x), y: r1(y), s: s.size };
  }).filter((s) => inFrame([s.x, s.y]));
  const neighbours = INDIA_NEIGHBOURS.map((n) => {
    const [x, y] = projection([n.lon, n.lat]);
    return { name: n.name, x: r1(x), y: r1(y), small: !!n.small };
  }).filter((s) => inFrame([s.x, s.y]));

  write('india.js', 'india', {
    w: W, h: H, context, seas, neighbours, zones: INDIA_ZONES, totalArea, regions,
  });
}

// ------------------------------------------------------------------- main --
ensureSources();
const { geo: worldGeo } = await buildWorld();
await buildIndia(worldGeo);
