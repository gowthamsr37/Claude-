/* ==========================================================================
   Safarnama — app
   Plain JavaScript, no dependencies, no network. Map geometry is pre-projected
   at build time (see scripts/build-data.mjs) and loaded from js/data/*.js.
   ========================================================================== */
(function () {
  'use strict';

  const DATA = window.SAFARNAMA_DATA || {};
  const NS = 'http://www.w3.org/2000/svg';
  const STORE = 'safarnama.v1';
  const $ = (sel, root) => (root || document).querySelector(sel);
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Running inside another page (e.g. a claude.ai artifact): no service worker,
  // and the outer page owns the address bar.
  const EMBEDDED = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
  // claude.ai artifact runtime: lets the page hand the viewer a file to save.
  const downloadsCap = window.claude && typeof window.claude.use === 'function'
    ? Promise.resolve(window.claude.use('downloads')).catch(() => null)
    : Promise.resolve(null);

  const PALETTES = [
    { id: 'sunset', name: 'Saffron sunset', c: ['#FFC857', '#FF6B6B', '#C44DFF'] },
    { id: 'lagoon', name: 'Lagoon', c: ['#8CF5D2', '#22C3E6', '#4361EE'] },
    { id: 'aurora', name: 'Aurora', c: ['#C6F87A', '#2DD4A7', '#7C5CFF'] },
    { id: 'gulabi', name: 'Gulabi', c: ['#FFC2E2', '#FF5FA2', '#A01A9C'] },
  ];

  // ------------------------------------------------------------ helpers ---
  function svg(tag, attrs, parent) {
    const n = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  const flagOf = (a2) => (a2 && a2.length === 2 ? String.fromCodePoint(...[...a2.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : '');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmtPct = (p) => (p > 0 && p < 1 ? p.toFixed(1) : String(Math.round(p)));
  const icon = (id) => `<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  // -------------------------------------------------------------- views ---
  const INDIA_RANKS = [
    [0, 'Ready for take-off'], [1, 'First footsteps'], [4, 'Curious wanderer'], [9, 'Weekend explorer'],
    [15, 'Seasoned yatri'], [22, 'Bharat explorer'], [30, 'Almost everywhere'], [36, 'Legend: all of India!'],
  ];
  const WORLD_RANKS = [
    [0, 'Ready for take-off'], [1, 'First stamp'], [3, 'Curious wanderer'], [6, 'Explorer'], [12, 'Globetrotter'],
    [25, 'Seasoned voyager'], [50, 'World wanderer'], [100, 'Legendary nomad'], [195, 'Seen the whole world!'],
  ];

  const VIEWS = {
    india: {
      key: 'india', data: DATA.india, title: 'India', ringSub: 'of India', groupKey: 'zone',
      pickerLabel: "States & UTs you've visited",
      placeholder: 'Type a state or city…',
      sub: 'Tap a state to mark it visited',
      noun: 'state or UT', total: 36, maxZoom: 10, markerR: 4.2, ranks: INDIA_RANKS, rankUnit: ['state', 'states'],
      counted: () => true,
      tabCount: (n) => `${n} / 36<span class="unit"> states &amp; UTs</span>`,
      empty: "Nothing here yet. Pick the states you've been to from the list above, or tap them on the map.",
    },
    world: {
      key: 'world', data: DATA.world, title: 'World', ringSub: 'of countries', groupKey: 'continent',
      pickerLabel: "Countries you've visited",
      placeholder: 'Type a country or city…',
      sub: 'Tap a country to mark it visited',
      noun: 'country', total: 195, maxZoom: 18, markerR: 3.4, ranks: WORLD_RANKS, rankUnit: ['country', 'countries'],
      counted: (r) => r.sov,
      tabCount: (n) => `${n} / 195<span class="unit"> countries</span>`,
      empty: "No stamps yet. Search for a country above, or tap it on the map.",
    },
  };
  for (const key in VIEWS) {
    const v = VIEWS[key];
    if (!v.data) continue;
    v.groups = key === 'india' ? v.data.zones : v.data.continents;
    v.regions = v.data.regions;
    v.byId = new Map(v.regions.map((r) => [r.id, r]));
    for (const r of v.regions) {
      r.key = norm(r.name);
      r.aliasKeys = (r.aliases || []).map((a) => [a, norm(a)]);
      r.flag = key === 'world' ? flagOf(r.a2) : '';
      if (key === 'world' && r.tiny && !r.la) { r.la = 'start'; r.ldx = 7; r.z = r.sov ? 5 : 9; }
    }
  }

  // -------------------------------------------------------------- state ---
  function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { return {}; }
  }
  const saved = loadStore();
  const valid = (key, list) => new Set((Array.isArray(list) ? list : []).filter((id) => VIEWS[key].byId.has(id)));
  const state = {
    view: saved.view === 'world' ? 'world' : 'india',
    mine: { india: valid('india', saved.india), world: valid('world', saved.world) },
    shared: null, // { india:Set, world:Set } when previewing a shared link
    palette: PALETTES.some((p) => p.id === saved.palette) ? saved.palette : 'sunset',
    theme: saved.theme || null, // null → follow the system
    labels: saved.labels !== false,
  };
  const visitedOf = (key) => (state.shared || state.mine)[key];

  function persist() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        v: 1, india: [...state.mine.india], world: [...state.mine.world], view: state.view,
        palette: state.palette, theme: state.theme, labels: state.labels,
      }));
    } catch (e) { /* storage unavailable (private mode) — app still works for this session */ }
  }

  // ----------------------------------------------------------- map view ---
  class MapView {
    constructor(view, mount) {
      this.v = view;
      const d = view.data;
      this.W = d.w; this.H = d.h;
      this.k = 1; this.tx = 0; this.ty = 0;
      this.s = 1; // screen px per map unit at k = 1
      this.pointers = new Map();
      this.labelsOn = new Map();
      this.visited = new Set();
      this.build(mount);
      this.bind();
      if (window.ResizeObserver) new ResizeObserver(() => this.measure()).observe(this.svg);
      this.measure();
    }

    measure() {
      const r = this.svg.getBoundingClientRect();
      if (!r.width || !r.height) return;
      this.s = Math.min(r.width / this.W, r.height / this.H);
      this.apply();
    }

    build(mount) {
      const { v } = this, d = v.data, key = v.key;
      const root = this.svg = svg('svg', {
        class: 'map-svg', viewBox: `0 0 ${this.W} ${this.H}`, preserveAspectRatio: 'xMidYMid meet',
        role: 'img', 'data-view': key, 'aria-label': `Map of ${v.title}`,
      });
      root.style.setProperty('--grad', `url(#vg-${key})`);
      root.style.setProperty('--glow-filter', `url(#glow-${key})`);

      const defs = svg('defs', null, root);
      const grad = svg('linearGradient', { id: `vg-${key}`, gradientUnits: 'userSpaceOnUse', x1: 0, y1: 0, x2: this.W, y2: this.H }, defs);
      [['0', '--p1'], ['0.5', '--p2'], ['1', '--p3']].forEach(([o, c]) => svg('stop', { offset: o, style: `stop-color: var(${c})` }, grad));
      const filter = svg('filter', { id: `glow-${key}`, x: '-10%', y: '-10%', width: '120%', height: '120%', 'color-interpolation-filters': 'sRGB' }, defs);
      this.blur = svg('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: 4, result: 'b' }, filter);
      const ct = svg('feComponentTransfer', { in: 'b', result: 'bo' }, filter);
      this.glowFn = svg('feFuncA', { type: 'linear', slope: 0.75 }, ct);
      const merge = svg('feMerge', null, filter);
      svg('feMergeNode', { in: 'bo' }, merge);
      svg('feMergeNode', { in: 'SourceGraphic' }, merge);

      const vp = this.vp = svg('g', { class: 'viewport' }, root);

      if (key === 'world') {
        const og = svg('radialGradient', { id: 'ocean-world', cx: '50%', cy: '45%', r: '62%' }, defs);
        svg('stop', { offset: '0', style: 'stop-color: var(--ocean-2)' }, og);
        svg('stop', { offset: '1', style: 'stop-color: var(--ocean)' }, og);
        svg('path', { class: 'sphere', d: d.sphere, fill: 'url(#ocean-world)' }, vp);
        svg('path', { class: 'graticule', d: d.graticule }, vp);
        const cg = svg('g', { class: 'ctx-world' }, vp);
        d.context.forEach((p) => svg('path', { class: 'ctx-land', d: p }, cg));
      } else {
        const cg = svg('g', { class: 'ctx-india' }, vp);
        d.context.forEach((p) => svg('path', { class: 'ctx', d: p }, cg));
        const tg = svg('g', { class: 'ctx-text' }, vp);
        d.seas.forEach((s) => {
          const t = svg('text', { class: 'sea', x: s.x, y: s.y }, tg);
          t.style.setProperty('--fs', `${(13 * s.s).toFixed(1)}px`);
          t.textContent = s.name;
        });
        d.neighbours.forEach((n) => {
          const t = svg('text', { class: 'nbr', x: n.x, y: n.y }, tg);
          t.style.setProperty('--fs', n.small ? '8.5px' : '10.5px');
          t.textContent = n.name;
        });
        const halo = svg('g', { class: 'halo', 'aria-hidden': 'true' }, vp);
        v.regions.forEach((r) => r.d && svg('path', { d: r.d }, halo));
      }

      this.baseG = svg('g', { class: 'base' }, vp);
      this.visitedG = svg('g', { class: 'visited' }, vp);
      this.markerG = svg('g', { class: 'markers' }, vp);
      this.labelG = svg('g', { class: 'labels', 'aria-hidden': 'true' }, vp);
      this.overlayG = svg('g', { class: 'overlay' }, vp);
      this.hoverPath = svg('path', { class: 'hover-outline', d: '' }, this.overlayG);

      this.paths = new Map(); this.markers = new Map(); this.labels = new Map(); this.hits = [];
      for (const r of v.regions) {
        if (r.d) this.paths.set(r.id, svg('path', { class: 'region', d: r.d, 'data-id': r.id }, this.baseG));
        if (r.tiny) {
          const m = svg('circle', { class: 'marker', cx: r.lx, cy: r.ly, r: v.markerR, 'data-id': r.id }, this.markerG);
          this.markers.set(r.id, m);
        }
        const t = svg('text', { class: 'lbl' + (r.la ? ` lbl-${r.la}` : ''), x: r.lx, y: r.ly, 'data-id': r.id }, this.labelG);
        t.textContent = r.short || r.name;
        this.labels.set(r.id, t);
      }
      // Generous invisible hit targets for tiny places (drawn above the dots).
      for (const [id, m] of this.markers) {
        const hit = svg('circle', { class: 'marker-hit', cx: m.getAttribute('cx'), cy: m.getAttribute('cy'), r: 10, 'data-id': id }, this.markerG);
        this.hits.push(hit);
      }
      mount.appendChild(root);
      this.apply();
    }

    // Reflect a visited set onto the map. `changed` is the id the user just toggled.
    render(visited, { changed, intro } = {}) {
      this.visited = visited;
      let i = 0;
      for (const r of this.v.regions) {
        const on = visited.has(r.id);
        const p = this.paths.get(r.id);
        if (p) {
          const isIn = p.parentNode === this.visitedG;
          if (on && !isIn) this.visitedG.appendChild(p);
          else if (!on && isIn) this.baseG.appendChild(p);
          if (on && (r.id === changed) && !reduceMotion) this.restartAnim(p, 'pop');
          if (on && intro && !reduceMotion) {
            p.style.animationDelay = `${Math.min(i++ * 28, 900)}ms`;
            this.restartAnim(p, 'fade-in');
          }
        }
        const m = this.markers.get(r.id);
        if (m) {
          m.classList.toggle('is-visited', on);
          m.style.fill = on ? `url(#vg-${this.v.key})` : '';
        }
        const t = this.labels.get(r.id);
        if (t) { t.classList.toggle('v', on && !r.la); t.classList.toggle('vo', on && !!r.la); }
        if (on && r.id === changed && !reduceMotion) this.ripple(r);
      }
      this.svg.setAttribute('aria-label', `Map of ${this.v.title}: ${visited.size} visited`);
      this.updateZoomDeps();
    }

    restartAnim(node, cls) {
      node.classList.remove('pop', 'fade-in');
      requestAnimationFrame(() => {
        node.classList.add(cls);
        node.addEventListener('animationend', () => { node.classList.remove(cls); node.style.animationDelay = ''; }, { once: true });
      });
    }

    ripple(r) {
      const c = svg('circle', { class: 'ripple', cx: r.lx, cy: r.ly, r: 54 / (this.k * this.s) }, this.overlayG);
      c.addEventListener('animationend', () => c.remove(), { once: true });
      setTimeout(() => c.remove(), 1400);
    }

    // ---- zoom & pan ----
    apply() {
      this.vp.setAttribute('transform', `translate(${this.tx.toFixed(2)} ${this.ty.toFixed(2)}) scale(${this.k.toFixed(4)})`);
      this.vp.style.setProperty('--k', this.k.toFixed(4));
      this.vp.style.setProperty('--ks', (this.k * this.s).toFixed(4));
      this.updateZoomDeps();
    }

    // Markers, hit targets and labels keep a constant on-screen size.
    updateZoomDeps() {
      const k = this.k, ks = k * this.s, v = this.v;
      for (const [id, m] of this.markers) {
        const r = v.byId.get(id);
        const on = this.visited.has(id);
        m.setAttribute('r', ((on ? v.markerR + 1.4 : v.markerR * 0.72) / ks).toFixed(2));
        m.style.display = r.d && r.px * ks * ks > 300 ? 'none' : '';
      }
      const hr = (11 / ks).toFixed(2);
      for (const h of this.hits) h.setAttribute('r', hr);
      this.layoutLabels();
      const st = document.getElementById('stage');
      if (st && this.svg.classList.contains('is-active')) st.style.touchAction = k > 1.01 ? 'none' : 'pan-y';
    }

    // Greedy label placement: a label shows only if it fits inside its shape at
    // the current zoom and doesn't collide with one already placed. Your visited
    // places get first pick, then bigger places.
    layoutLabels() {
      const v = this.v, k = this.k, s = this.s, ks = k * s;
      const font = v.key === 'india' ? 11.5 : 11;
      const fit = (v.key === 'india' ? 10.5 : 10) / font; // build-time font ÷ on-screen font
      const Ws = this.W * s, Hs = this.H * s;
      const cands = [];
      for (const r of v.regions) {
        const ok = r.la ? k >= r.z : r.z <= ks * fit;
        if (ok) cands.push(r);
      }
      cands.sort((a, b) => (this.visited.has(b.id) - this.visited.has(a.id)) || b.px - a.px);
      const placed = [];
      const next = new Set();
      for (const r of cands) {
        const text = r.short || r.name;
        const w = text.length * font * 0.6 + 6, h = font * 1.3;
        let x = (r.lx * k + this.tx) * s;
        const y = (r.ly * k + this.ty) * s;
        let x0;
        if (r.la === 'start') { x += r.ldx; x0 = x - 2; } else if (r.la === 'end') { x += r.ldx; x0 = x - w + 2; } else x0 = x - w / 2;
        const y0 = y - h / 2;
        if (x0 < 2 || x0 + w > Ws - 2 || y0 < 2 || y0 + h > Hs - 2) continue;
        let hit = false;
        for (let i = 0; i < placed.length; i++) {
          const b = placed[i];
          if (x0 < b[2] && x0 + w > b[0] && y0 < b[3] && y0 + h > b[1]) { hit = true; break; }
        }
        if (hit) continue;
        placed.push([x0, y0, x0 + w, y0 + h]);
        next.add(r.id);
      }
      for (const r of v.regions) {
        const t = this.labels.get(r.id);
        const on = next.has(r.id);
        if (this.labelsOn.get(r.id) !== on) { t.classList.toggle('on', on); this.labelsOn.set(r.id, on); }
        if (on && r.la) t.setAttribute('x', (r.lx + r.ldx / ks).toFixed(2));
      }
    }

    clampPan() {
      this.tx = clamp(this.tx, this.W - this.W * this.k, 0);
      this.ty = clamp(this.ty, this.H - this.H * this.k, 0);
    }

    zoomAt(factor, px, py) {
      const k1 = clamp(this.k * factor, 1, this.v.maxZoom);
      const f = k1 / this.k;
      this.tx = px - (px - this.tx) * f;
      this.ty = py - (py - this.ty) * f;
      this.k = k1;
      this.clampPan();
      this.apply();
      this.moving();
    }

    animateTo(k, tx, ty, dur = 480) {
      cancelAnimationFrame(this.raf);
      const k0 = this.k, x0 = this.tx, y0 = this.ty, t0 = performance.now();
      const step = (now) => {
        const t = reduceMotion ? 1 : clamp((now - t0) / dur, 0, 1);
        const e = easeOut(t);
        this.k = k0 + (k - k0) * e; this.tx = x0 + (tx - x0) * e; this.ty = y0 + (ty - y0) * e;
        this.apply(); this.moving();
        if (t < 1) this.raf = requestAnimationFrame(step);
      };
      this.raf = requestAnimationFrame(step);
    }

    zoomBy(factor) {
      const k1 = clamp(this.k * factor, 1, this.v.maxZoom);
      const cx = this.W / 2, cy = this.H / 2, f = k1 / this.k;
      let tx = cx - (cx - this.tx) * f, ty = cy - (cy - this.ty) * f;
      tx = clamp(tx, this.W - this.W * k1, 0); ty = clamp(ty, this.H - this.H * k1, 0);
      this.animateTo(k1, tx, ty);
    }
    reset() { this.animateTo(1, 0, 0, 560); }

    // Pause the glow while the map moves — keeps panning buttery on big maps.
    moving() {
      this.svg.classList.add('is-moving');
      clearTimeout(this.movingT);
      this.movingT = setTimeout(() => {
        this.svg.classList.remove('is-moving');
        this.blur.setAttribute('stdDeviation', (4 / this.k).toFixed(2));
        this.svg.classList.toggle('no-glow', this.k > 3.5);
      }, 160);
    }

    // client px → viewBox units
    toLocal(cx, cy) {
      const r = this.svg.getBoundingClientRect();
      const s = Math.min(r.width / this.W, r.height / this.H);
      return { x: (cx - r.left - (r.width - this.W * s) / 2) / s, y: (cy - r.top - (r.height - this.H * s) / 2) / s, s };
    }

    bind() {
      const el = this.svg;
      el.addEventListener('wheel', (e) => {
        const zoomIn = e.deltaY < 0;
        if (!zoomIn && this.k <= 1.001) return; // let the page scroll
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 0.06 : 0.0022;
        const factor = Math.exp(-e.deltaY * unit * (e.ctrlKey ? 2.2 : 1));
        const p = this.toLocal(e.clientX, e.clientY);
        this.zoomAt(factor, p.x, p.y);
        hideTip();
      }, { passive: false });

      el.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        cancelAnimationFrame(this.raf);
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY });
        if (this.pointers.size === 1) {
          this.dragged = false;
          this.downTarget = e.target.closest('[data-id]');
        } else {
          this.dragged = true; // pinch
          this.pinch = this.pinchInfo();
        }
      });

      el.addEventListener('pointermove', (e) => {
        const p = this.pointers.get(e.pointerId);
        if (!p) {
          if (e.pointerType === 'mouse') hover(this, e);
          return;
        }
        const prev = { x: p.x, y: p.y };
        p.x = e.clientX; p.y = e.clientY;
        if (this.pointers.size >= 2 && this.pinch) {
          const cur = this.pinchInfo();
          const a = this.toLocal(cur.cx, cur.cy);
          const b = this.toLocal(this.pinch.cx, this.pinch.cy);
          this.tx += a.x - b.x; this.ty += a.y - b.y;
          this.zoomAt(cur.dist / this.pinch.dist, a.x, a.y);
          this.pinch = cur;
          return;
        }
        if (!this.dragged && Math.hypot(p.x - p.x0, p.y - p.y0) > 5) {
          this.dragged = true;
          try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
          el.classList.add('is-dragging');
          hideTip();
        }
        if (this.dragged && this.k > 1) {
          const s = this.toLocal(0, 0).s;
          this.tx += (p.x - prev.x) / s; this.ty += (p.y - prev.y) / s;
          this.clampPan(); this.apply(); this.moving();
        }
      });

      const end = (e) => {
        if (!this.pointers.has(e.pointerId)) return;
        const wasSingle = this.pointers.size === 1;
        this.pointers.delete(e.pointerId);
        if (this.pointers.size < 2) this.pinch = null;
        if (this.pointers.size === 0) el.classList.remove('is-dragging');
        if (e.type === 'pointerup' && wasSingle && !this.dragged) {
          const t = this.downTarget;
          if (t && t === e.target.closest('[data-id]')) onMapTap(this, t.getAttribute('data-id'), e);
        }
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { this.setHover(null); hideTip(); } });
    }

    pinchInfo() {
      const [a, b] = [...this.pointers.values()];
      return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
    }

    setHover(id) {
      if (id === this.hoverId) return;
      const prev = this.hoverId && this.markers.get(this.hoverId);
      if (prev) prev.classList.remove('is-hover');
      this.hoverId = id;
      const r = id && this.v.byId.get(id);
      this.hoverPath.setAttribute('d', r && r.d ? r.d : '');
      const m = id && this.markers.get(id);
      if (m) m.classList.add('is-hover');
    }

    setGlow(slope) { this.glowFn.setAttribute('slope', slope); }
  }

  // ------------------------------------------------------- map ⇄ picker ---
  const tip = $('#tip');
  const stage = $('#stage');
  let tipTimer;

  function tipHTML(view, r, visited) {
    const lead = view.key === 'world'
      ? `<span class="flag">${r.flag || '🏳️'}</span>`
      : '';
    const kind = view.key === 'india' ? (r.kind === 'ut' ? 'Union Territory' : 'State') : (r.tag || r.continent);
    const status = visited ? '<span class="yes">Visited</span>' : '<span>Not yet · tap to add</span>';
    return `<div class="tip-name">${lead}${esc(r.name)}</div><div class="tip-meta">${status}<span>·</span><span>${esc(kind)}</span></div>`;
  }

  function showTip(mv, id, clientX, clientY) {
    const r = mv.v.byId.get(id);
    if (!r) return hideTip();
    tip.innerHTML = tipHTML(mv.v, r, visitedOf(mv.v.key).has(id));
    const box = stage.getBoundingClientRect();
    const x = clamp(clientX - box.left, 90, box.width - 90);
    const y = Math.max(clientY - box.top, 64);
    tip.style.left = `${x}px`; tip.style.top = `${y}px`;
    tip.classList.add('on');
  }
  function hideTip() { tip.classList.remove('on'); }

  function hover(mv, e) {
    const t = e.target.closest('[data-id]');
    const id = t ? t.getAttribute('data-id') : null;
    mv.setHover(id);
    if (id) showTip(mv, id, e.clientX, e.clientY); else hideTip();
  }

  function onMapTap(mv, id, e) {
    if (state.shared) { toast('This is a shared map. Tap “Make it mine” to edit it.', 'link'); return; }
    toggle(mv.v.key, id, 'map');
    if (e.pointerType !== 'mouse') {
      showTip(mv, id, e.clientX, e.clientY);
      clearTimeout(tipTimer);
      tipTimer = setTimeout(hideTip, 1600);
    } else {
      showTip(mv, id, e.clientX, e.clientY);
    }
  }

  // -------------------------------------------------------- mutations ---
  function setVisited(key, next, { changed, quiet } = {}) {
    const before = state.mine[key];
    state.mine[key] = next;
    persist();
    syncShareHash();
    refresh({ changed });
    if (!quiet) celebrate(key, before, next);
  }

  function toggle(key, id) {
    const next = new Set(state.mine[key]);
    let added = false;
    if (next.has(id)) next.delete(id); else { next.add(id); added = true; }
    setVisited(key, next, { changed: added ? id : null });
  }

  function clearAll(key) {
    const prev = state.mine[key];
    if (!prev.size) return;
    setVisited(key, new Set(), { quiet: true });
    toast(`Cleared ${prev.size} ${prev.size === 1 ? VIEWS[key].rankUnit[0] : VIEWS[key].rankUnit[1]}`, 'reset', {
      label: 'Undo', fn: () => setVisited(key, prev, { quiet: true }),
    });
  }

  // ------------------------------------------------------------ picker ---
  const picker = {
    root: $('#picker'), input: $('#msInput'), pop: $('#msPop'), list: $('#msList'), empty: $('#msEmpty'),
    count: $('#msCount'), caret: $('#msCaret'), control: $('#msControl'),
    items: [], active: -1, open: false,

    init() {
      this.input.addEventListener('focus', () => this.show());
      this.input.addEventListener('click', () => this.show());
      this.input.addEventListener('input', () => { this.active = -1; this.render(); this.show(); });
      this.input.addEventListener('keydown', (e) => this.key(e));
      this.control.addEventListener('mousedown', (e) => {
        if (e.target === this.input) return;
        e.preventDefault();
        if (this.open && e.target.closest('.ms-caret')) { this.hide(); return; }
        this.input.focus(); this.show();
      });
      this.list.addEventListener('mousedown', (e) => e.preventDefault());
      this.list.addEventListener('click', (e) => {
        const g = e.target.closest('.gtoggle');
        if (g) { this.toggleGroup(g.getAttribute('data-group')); return; }
        const o = e.target.closest('.ms-opt');
        if (o) { this.pick(o.getAttribute('data-id')); this.setActive(this.items.indexOf(o.getAttribute('data-id')), false); }
      });
      this.list.addEventListener('mousemove', (e) => {
        const o = e.target.closest('.ms-opt');
        if (o) {
          const idx = this.items.indexOf(o.getAttribute('data-id'));
          if (idx !== this.active) this.setActive(idx, false);
        }
      });
      this.list.addEventListener('mouseleave', () => maps[state.view] && maps[state.view].setHover(null));
      this.pop.addEventListener('mousedown', (e) => { if (e.target.closest('.ms-tools')) e.preventDefault(); });
      this.pop.querySelector('.ms-tools').addEventListener('click', (e) => {
        const act = e.target.closest('[data-act]');
        if (!act) return;
        const key = state.view;
        if (state.shared) return toast('This is a shared map. Tap “Make it mine” to edit it.', 'link');
        if (act.dataset.act === 'all') {
          const prev = state.mine[key];
          const ids = this.query() ? this.items : VIEWS[key].regions.map((r) => r.id);
          setVisited(key, new Set([...prev, ...ids]));
        } else {
          clearAll(key);
        }
      });
      document.addEventListener('pointerdown', (e) => { if (this.open && !this.root.contains(e.target)) this.hide(); });
      document.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement !== this.input && !/input|textarea/i.test(document.activeElement.tagName)) {
          e.preventDefault(); this.input.focus();
        }
      });
    },

    query() { return norm(this.input.value); },

    setView(v) {
      this.input.placeholder = v.placeholder;
      $('#pickerLabel').textContent = v.pickerLabel;
      this.input.value = '';
      this.active = -1;
      this.render();
    },

    show() {
      if (this.open) return;
      this.open = true;
      this.pop.hidden = false;
      this.root.classList.add('is-open');
      this.input.setAttribute('aria-expanded', 'true');
      this.render();
    },
    hide() {
      if (!this.open) return;
      this.open = false;
      this.pop.hidden = true;
      this.root.classList.remove('is-open');
      this.input.setAttribute('aria-expanded', 'false');
      this.input.removeAttribute('aria-activedescendant');
      maps[state.view] && maps[state.view].setHover(null);
    },

    match(r, q) {
      if (!q) return { score: 0 };
      const i = r.key.indexOf(q);
      if (i === 0) return { score: 1 };
      if (i > 0 && r.key[i - 1] === ' ') return { score: 2 };
      if (i > 0) return { score: 4 };
      if (r.id.toLowerCase() === q) return { score: 1.5 };
      for (const [label, k] of r.aliasKeys) {
        const j = k.indexOf(q);
        if (j === 0 || (j > 0 && k[j - 1] === ' ')) return { score: 5, alias: label };
      }
      for (const [label, k] of r.aliasKeys) if (k.includes(q)) return { score: 6, alias: label };
      return null;
    },

    highlight(name, q) {
      if (!q) return esc(name);
      // map normalised query back onto the original name (best effort, diacritics-safe)
      const plain = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const qq = this.input.value.trim().toLowerCase();
      const i = qq ? plain.indexOf(qq) : -1;
      if (i < 0) return esc(name);
      return esc(name.slice(0, i)) + '<mark>' + esc(name.slice(i, i + qq.length)) + '</mark>' + esc(name.slice(i + qq.length));
    },

    optionHTML(v, r, m, visited, q) {
      const lead = v.key === 'world'
        ? `<span class="ms-flag flag" aria-hidden="true">${r.flag || '🏳️'}</span>`
        : `<span class="ms-badge" aria-hidden="true">${r.id}</span>`;
      const tag = v.key === 'india' ? (r.kind === 'ut' ? 'UT' : '') : r.tag;
      return `<li class="ms-opt" role="option" id="opt-${v.key}-${r.id}" data-id="${r.id}" aria-selected="${visited.has(r.id)}">` +
        `<span class="ms-check" aria-hidden="true">${icon('check')}</span>${lead}` +
        `<span class="ms-name">${this.highlight(r.name, q)}</span>` +
        (m && m.alias ? `<span class="ms-match">${esc(m.alias)}</span>` : '') +
        (tag ? `<span class="ms-tag">${esc(tag)}</span>` : '') + `</li>`;
    },

    render() {
      const v = VIEWS[state.view];
      const visited = visitedOf(v.key);
      const q = this.query();
      this.updateCount();
      if (!this.open) return;
      let html = '';
      const items = [];
      if (q) {
        const res = [];
        for (const r of v.regions) {
          const m = this.match(r, q);
          if (m) res.push([r, m]);
        }
        res.sort((a, b) => a[1].score - b[1].score || a[0].name.localeCompare(b[0].name));
        for (const [r, m] of res.slice(0, 80)) { html += this.optionHTML(v, r, m, visited, q); items.push(r.id); }
      } else {
        for (const g of v.groups) {
          const rs = v.regions.filter((r) => r[v.groupKey] === g);
          if (!rs.length) continue;
          const n = rs.filter((r) => visited.has(r.id)).length;
          html += `<li class="ms-group" role="presentation" data-group="${esc(g)}"><span>${esc(g)}</span>` +
            `<span class="gcount">${n}/${rs.length}</span>` +
            `<button class="gtoggle" type="button" data-group="${esc(g)}" tabindex="-1">${n === rs.length ? 'Clear' : 'Select all'}</button></li>`;
          for (const r of rs) { html += this.optionHTML(v, r, null, visited, ''); items.push(r.id); }
        }
      }
      const scroll = this.list.scrollTop;
      this.list.innerHTML = html;
      this.list.scrollTop = q ? 0 : scroll;
      this.items = items;
      this.empty.hidden = items.length > 0;
      if (!items.length) this.empty.innerHTML = `No ${v.noun} matches <b>“${esc(this.input.value.trim())}”</b>`;
      if (q && items.length) this.setActive(0, true);
      else if (this.active >= 0) this.setActive(Math.min(this.active, items.length - 1), false);
    },

    // Cheap in-place refresh after a selection change (keeps scroll & focus).
    sync() {
      const v = VIEWS[state.view];
      const visited = visitedOf(v.key);
      this.updateCount();
      if (!this.open) return;
      for (const li of this.list.querySelectorAll('.ms-opt')) li.setAttribute('aria-selected', visited.has(li.dataset.id));
      for (const li of this.list.querySelectorAll('.ms-group')) {
        const g = li.dataset.group;
        const rs = v.regions.filter((r) => r[v.groupKey] === g);
        const n = rs.filter((r) => visited.has(r.id)).length;
        li.querySelector('.gcount').textContent = `${n}/${rs.length}`;
        li.querySelector('.gtoggle').textContent = n === rs.length ? 'Clear' : 'Select all';
      }
    },

    updateCount() {
      const v = VIEWS[state.view];
      const visited = visitedOf(v.key);
      const n = [...visited].filter((id) => v.counted(v.byId.get(id))).length;
      this.count.textContent = `${n} / ${v.total}`;
      this.count.classList.toggle('has', n > 0);
    },

    setActive(i, scroll) {
      const prev = this.list.querySelector('.ms-opt.is-active');
      if (prev) prev.classList.remove('is-active');
      this.active = i;
      const id = this.items[i];
      if (id == null) { this.input.removeAttribute('aria-activedescendant'); return; }
      const li = document.getElementById(`opt-${state.view}-${id}`);
      if (!li) return;
      li.classList.add('is-active');
      this.input.setAttribute('aria-activedescendant', li.id);
      if (scroll) li.scrollIntoView({ block: 'nearest' });
      maps[state.view] && maps[state.view].setHover(id);
    },

    pick(id) {
      if (state.shared) { toast('This is a shared map. Tap “Make it mine” to edit it.', 'link'); return; }
      toggle(state.view, id);
    },

    toggleGroup(g) {
      if (state.shared) return toast('This is a shared map. Tap “Make it mine” to edit it.', 'link');
      const v = VIEWS[state.view];
      const ids = v.regions.filter((r) => r[v.groupKey] === g).map((r) => r.id);
      const next = new Set(state.mine[v.key]);
      const all = ids.every((id) => next.has(id));
      ids.forEach((id) => (all ? next.delete(id) : next.add(id)));
      setVisited(v.key, next);
    },

    key(e) {
      const n = this.items.length;
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault(); this.show();
          if (n) this.setActive((this.active + 1) % n, true);
          break;
        case 'ArrowUp':
          e.preventDefault(); this.show();
          if (n) this.setActive((this.active - 1 + n) % n, true);
          break;
        case 'Home': if (this.open && n && !this.input.value) { e.preventDefault(); this.setActive(0, true); } break;
        case 'End': if (this.open && n && !this.input.value) { e.preventDefault(); this.setActive(n - 1, true); } break;
        case 'Enter': {
          e.preventDefault();
          if (!this.open) { this.show(); break; }
          const id = this.items[this.active];
          if (id == null) break;
          const hadQuery = !!this.input.value;
          this.pick(id);
          if (hadQuery) { this.input.value = ''; this.active = -1; this.render(); }
          break;
        }
        case 'Escape':
          if (this.input.value) { this.input.value = ''; this.render(); } else { this.hide(); this.input.blur(); }
          break;
        case 'Tab': this.hide(); break;
        default:
      }
    },
  };

  // ------------------------------------------------------------- chips ---
  let lastChipSet = { india: new Set(), world: new Set() };
  function renderChips() {
    const v = VIEWS[state.view];
    const visited = visitedOf(v.key);
    const box = $('#chips');
    const prev = lastChipSet[v.key];
    const list = v.regions.filter((r) => visited.has(r.id));
    $('#chipsLabel').textContent = list.length ? `${list.length} ${list.length === 1 ? 'place' : 'places'} on your map` : 'Your list';
    $('#clearBtn').disabled = !list.length || !!state.shared;
    if (!list.length) {
      box.innerHTML = `<div class="empty-note">${icon('pin')}<span>${esc(v.empty)}</span></div>`;
    } else {
      box.innerHTML = list.map((r) => {
        const lead = v.key === 'world' ? `<span class="flag" aria-hidden="true">${r.flag || '🏳️'}</span>` : `<span class="chip-code" aria-hidden="true">${r.id}</span>`;
        const anim = prev.has(r.id) ? ' style="animation:none"' : '';
        return `<span class="chip"${anim}>${lead}<span>${esc(r.name)}</span>` +
          (state.shared ? '' : `<button type="button" data-id="${r.id}" aria-label="Remove ${esc(r.name)}">${icon('x')}</button>`) + `</span>`;
      }).join('');
    }
    lastChipSet[v.key] = new Set(visited);
  }
  $('#chips').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (b) toggle(state.view, b.getAttribute('data-id'));
  });
  $('#clearBtn').addEventListener('click', () => clearAll(state.view));

  // ------------------------------------------------------------- stats ---
  const ringBar = $('#ringBar');
  const RING_C = 2 * Math.PI * 52;
  const counters = new WeakMap();

  function countTo(node, to, { decimals = 0, suffix = '' } = {}) {
    const from = counters.get(node) ?? 0;
    counters.set(node, to);
    if (reduceMotion || from === to) { node.firstChild.nodeValue = to.toFixed(decimals); return; }
    const t0 = performance.now(), dur = 700;
    const step = (now) => {
      const t = clamp((now - t0) / dur, 0, 1);
      node.firstChild.nodeValue = (from + (to - from) * easeOut(t)).toFixed(decimals) + suffix;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function computeStats(v, visited) {
    const regs = v.regions;
    const vis = regs.filter((r) => visited.has(r.id));
    const counted = vis.filter(v.counted);
    const area = vis.reduce((a, r) => a + r.area, 0);
    const groups = v.groups.map((g) => {
      const all = regs.filter((r) => r[v.groupKey] === g);
      let pool = all.filter(v.counted);
      if (!pool.length) pool = all;
      const n = pool.filter((r) => visited.has(r.id)).length;
      const any = all.some((r) => visited.has(r.id));
      return { name: g, n, total: pool.length, any };
    });
    return { vis, counted: counted.length, area, areaPct: (area / v.data.totalArea) * 100, groups };
  }

  function rankFor(v, n) {
    let cur = v.ranks[0], next = null;
    for (let i = 0; i < v.ranks.length; i++) {
      if (n >= v.ranks[i][0]) { cur = v.ranks[i]; next = v.ranks[i + 1] || null; }
    }
    return { title: cur[1], next };
  }

  function renderStats() {
    const v = VIEWS[state.view];
    const visited = visitedOf(v.key);
    const s = computeStats(v, visited);
    const pct = (s.counted / v.total) * 100;

    ringBar.style.strokeDashoffset = (RING_C * (1 - pct / 100)).toFixed(2);
    const pctNode = $('#ringPct');
    countTo(pctNode, pct < 1 && pct > 0 ? Math.round(pct * 10) / 10 : Math.round(pct), { decimals: pct > 0 && pct < 1 ? 1 : 0 });
    $('#ringSub').textContent = v.ringSub;

    let kpis;
    if (v.key === 'india') {
      const st = s.vis.filter((r) => r.kind === 'state').length;
      const ut = s.vis.filter((r) => r.kind === 'ut').length;
      const zonesDone = s.groups.filter((g) => g.n === g.total).length;
      kpis = [
        ['States', `${st}<small> / 28</small>`],
        ['Union territories', `${ut}<small> / 8</small>`],
        ['Land explored', `${fmtPct(s.areaPct)}<small>%</small>`],
        ['Zones complete', `${zonesDone}<small> / ${s.groups.length}</small>`],
      ];
    } else {
      const conts = s.groups.filter((g) => g.any).length;
      const terr = s.vis.filter((r) => !r.sov).length;
      kpis = [
        ['Countries', `${s.counted}<small> / 195</small>`],
        ['Continents', `${conts}<small> / 7</small>`],
        ['Land explored', `${fmtPct(s.areaPct)}<small>%</small>`],
        ['Territories & more', `${terr}`],
      ];
    }
    $('#kpis').innerHTML = kpis.map(([l, val]) => `<div class="kpi"><span class="kpi-label">${l}</span><span class="kpi-val">${val}</span></div>`).join('');

    const rk = rankFor(v, s.counted);
    let nextTxt;
    if (rk.next) {
      const need = rk.next[0] - s.counted;
      nextTxt = `${need} more ${need === 1 ? v.rankUnit[0] : v.rankUnit[1]} to become <b>${esc(rk.next[1].replace(/!$/, ''))}</b>`;
    } else nextTxt = 'You have seen it all. Time for a victory lap.';
    $('#rank').innerHTML = `<span class="rank-ico">${icon(s.counted ? 'award' : 'compass')}</span>` +
      `<div class="rank-text"><div class="rank-title">${esc(rk.title)}</div><div class="rank-next">${nextTxt}</div></div>`;

    const bd = $('#breakdown');
    bd.innerHTML = s.groups.map((g) => {
      const w = g.total ? (g.n / g.total) * 100 : 0;
      const done = g.total && g.n === g.total;
      return `<div class="bd-row"><span class="bd-name">${esc(g.name)}${done ? `<span class="bd-done">${icon('check')}Done</span>` : ''}</span>` +
        `<span class="bd-count">${g.n} / ${g.total}</span>` +
        `<div class="bd-bar"><div class="bd-fill" data-w="${w.toFixed(2)}" style="--bgw:${w > 0 ? (10000 / w).toFixed(0) : 100}%"></div></div></div>`;
    }).join('');
    requestAnimationFrame(() => {
      for (const f of bd.querySelectorAll('.bd-fill')) f.style.width = f.dataset.w + '%';
    });

    // tab counters
    for (const key in VIEWS) {
      const vv = VIEWS[key];
      const n = [...visitedOf(key)].filter((id) => vv.counted(vv.byId.get(id))).length;
      const node = document.querySelector(`[data-count="${key}"]`);
      if (node) node.innerHTML = vv.tabCount(n);
    }
  }

  // --------------------------------------------------------- milestones ---
  function celebrate(key, before, after) {
    if (after.size <= before.size) return;
    const v = VIEWS[key];
    const b = computeStats(v, before), a = computeStats(v, after);
    if (a.counted === v.total && b.counted < v.total) {
      toast(key === 'india' ? 'All 36 states & UTs! You have seen all of India.' : 'Every country on Earth. Legendary!', 'award');
      return confetti(160);
    }
    for (let i = 0; i < a.groups.length; i++) {
      const ga = a.groups[i], gb = b.groups[i];
      if (key === 'world' && ga.any && !gb.any && a.groups.filter((g) => g.any).length > 1) {
        toast(`New continent unlocked: ${ga.name}`, 'globe');
        return confetti(70);
      }
      if (ga.total > 1 && ga.n === ga.total && gb.n < gb.total) {
        toast(`${ga.name} complete: all ${ga.total} visited!`, 'award');
        return confetti(90);
      }
    }
    const steps = key === 'world' ? [10, 25, 50, 100, 150] : [10, 20, 30];
    for (const st of steps) {
      if (a.counted >= st && b.counted < st) {
        toast(`${st} ${v.rankUnit[1]} and counting!`, 'spark');
        return confetti(60);
      }
    }
  }

  function confetti(n) {
    if (reduceMotion) return;
    const box = document.createElement('div');
    box.className = 'confetti';
    const cols = PALETTES.find((p) => p.id === state.palette).c.concat(['#ffffff']);
    for (let i = 0; i < n; i++) {
      const c = document.createElement('i');
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = cols[i % cols.length];
      c.style.setProperty('--dx', (Math.random() * 30 - 15) + 'vw');
      c.style.setProperty('--rot', (Math.random() * 900 - 450) + 'deg');
      c.style.setProperty('--dur', (1.8 + Math.random() * 1.6) + 's');
      c.style.animationDelay = Math.random() * 0.35 + 's';
      c.style.width = (6 + Math.random() * 6) + 'px';
      box.appendChild(c);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 4200);
  }

  // ------------------------------------------------------------ toasts ---
  function toast(msg, ico = 'check', action, ms) {
    const box = $('#toasts');
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span class="t-ico">${icon(ico)}</span><span>${esc(msg)}</span>`;
    if (action) {
      const b = document.createElement('button');
      b.className = 'link-btn';
      b.type = 'button';
      b.style.cssText = 'color:#fff;pointer-events:auto;margin-left:4px;text-decoration:underline;text-underline-offset:3px';
      b.textContent = action.label;
      b.addEventListener('click', () => { action.fn(); dismiss(); });
      t.appendChild(b);
      t.style.pointerEvents = 'auto';
    }
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    let gone = false;
    function dismiss() {
      if (gone) return; gone = true;
      t.classList.add('out');
      setTimeout(() => t.remove(), 320);
    }
    setTimeout(dismiss, ms || (action ? 6000 : 3200));
  }

  // ------------------------------------------------------- view switch ---
  const maps = {};
  const stageMaps = $('#stageMaps');

  function ensureMap(key) {
    if (!maps[key]) {
      maps[key] = new MapView(VIEWS[key], stageMaps);
      maps[key].svg.classList.toggle('no-labels', !state.labels);
      maps[key].setGlow(currentTheme() === 'light' ? 0.5 : 0.8);
      maps[key].render(visitedOf(key), { intro: true });
    }
    return maps[key];
  }

  function setView(key, { initial } = {}) {
    state.view = key;
    const v = VIEWS[key];
    const mv = ensureMap(key);
    for (const k in maps) maps[k].svg.classList.toggle('is-active', k === key);
    stage.dataset.view = key;
    stageMaps.style.setProperty('--ar', `${v.data.w} / ${v.data.h}`);
    stage.style.touchAction = mv.k > 1.01 ? 'none' : 'pan-y';
    $('#mapSub').textContent = state.shared ? 'Shared map · view only' : v.sub;
    for (const t of document.querySelectorAll('.tab')) t.setAttribute('aria-selected', String(t.dataset.view === key));
    stage.setAttribute('aria-labelledby', `tab-${key}`);
    moveIndicator();
    hideTip();
    picker.setView(v);
    renderChips();
    renderStats();
    if (!initial) persist();
  }

  function refresh({ changed } = {}) {
    const key = state.view;
    for (const k in maps) maps[k].render(visitedOf(k), { changed: k === key ? changed : null });
    picker.sync();
    renderChips();
    renderStats();
  }

  function moveIndicator() {
    const sel = document.querySelector('.tab[aria-selected="true"]');
    const ind = document.querySelector('.tab-indicator');
    if (!sel || !ind) return;
    ind.style.width = `${sel.offsetWidth}px`;
    ind.style.transform = `translateX(${sel.offsetLeft - 5}px)`;
  }

  $('#tabs').addEventListener('click', (e) => {
    const t = e.target.closest('.tab');
    if (t && t.dataset.view !== state.view) setView(t.dataset.view);
  });
  $('#tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next = state.view === 'india' ? 'world' : 'india';
    setView(next);
    document.getElementById(`tab-${next}`).focus();
  });
  window.addEventListener('resize', moveIndicator);

  $('#zoomIn').addEventListener('click', () => maps[state.view].zoomBy(1.8));
  $('#zoomOut').addEventListener('click', () => maps[state.view].zoomBy(1 / 1.8));
  $('#zoomReset').addEventListener('click', () => maps[state.view].reset());

  const labelsBtn = $('#labelsBtn');
  labelsBtn.addEventListener('click', () => {
    state.labels = !state.labels;
    labelsBtn.setAttribute('aria-pressed', String(state.labels));
    for (const k in maps) maps[k].svg.classList.toggle('no-labels', !state.labels);
    persist();
  });

  // ---------------------------------------------------- theme & palette ---
  const root = document.documentElement;
  const mqLight = window.matchMedia ? matchMedia('(prefers-color-scheme: light)') : null;
  function currentTheme() {
    const attr = root.getAttribute('data-theme');
    return state.theme || (attr === 'light' || attr === 'dark' ? attr : (mqLight && mqLight.matches ? 'light' : 'dark'));
  }
  function applyTheme() {
    if (state.theme) root.setAttribute('data-theme', state.theme);
    const t = currentTheme();
    const btn = $('#themeBtn');
    btn.innerHTML = `<svg><use href="#i-${t === 'light' ? 'moon' : 'sun'}"/></svg>`;
    btn.setAttribute('aria-label', `Switch to ${t === 'light' ? 'dark' : 'light'} theme`);
    for (const k in maps) maps[k].setGlow(t === 'light' ? 0.5 : 0.8);
  }
  $('#themeBtn').addEventListener('click', () => {
    state.theme = currentTheme() === 'light' ? 'dark' : 'light';
    applyTheme(); persist();
  });
  if (mqLight && mqLight.addEventListener) mqLight.addEventListener('change', () => { if (!state.theme) applyTheme(); });
  // A host page may switch data-theme on us; keep the button and glow in step.
  if (window.MutationObserver) {
    new MutationObserver(() => { if (!state.theme) applyTheme(); }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  }

  function renderSwatches() {
    const box = $('#swatches');
    box.innerHTML = PALETTES.map((p) =>
      `<button class="swatch" type="button" role="radio" aria-checked="${p.id === state.palette}" data-p="${p.id}" title="${p.name}" aria-label="${p.name}"` +
      ` style="--s1:${p.c[0]};--s2:${p.c[1]};--s3:${p.c[2]}"></button>`).join('');
  }
  $('#swatches').addEventListener('click', (e) => {
    const b = e.target.closest('.swatch');
    if (!b) return;
    // Tapping the active swatch cycles palettes (that's the only one shown on phones).
    const i = PALETTES.findIndex((p) => p.id === b.dataset.p);
    state.palette = b.dataset.p === state.palette ? PALETTES[(i + 1) % PALETTES.length].id : b.dataset.p;
    root.setAttribute('data-palette', state.palette);
    renderSwatches(); persist();
  });

  // ----------------------------------------------------- share & import ---
  // Share links carry the map in a plain hash: #s-<India codes>-<world codes>,
  // e.g. #s-KLMP-FRAJPN (2-letter state codes, 3-letter country codes).
  function encodeShare(src = state.mine) {
    return `#s-${[...src.india].sort().join('')}-${[...src.world].sort().join('')}`;
  }
  function decodeShare(hash) {
    const m = /^#?(.*)$/.exec(hash || '')[1];
    const chunk = (s, n) => (s || '').toUpperCase().match(new RegExp(`.{1,${n}}`, 'g')) || [];
    let i, w;
    const plain = /^s-([A-Za-z]*)-([A-Za-z]*)$/.exec(m);
    if (plain) { i = plain[1]; w = plain[2]; } else if (/(^|&)(i|w)=/.test(m)) {
      const params = new URLSearchParams(m); // older #i=..&w=.. links
      i = params.get('i'); w = params.get('w');
    } else return null;
    return { india: valid('india', chunk(i, 2)), world: valid('world', chunk(w, 3)) };
  }
  const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
  const isMine = (sh) => sameSet(sh.india, state.mine.india) && sameSet(sh.world, state.mine.world);
  // Keep an existing share hash in step with the map, so the address is always current.
  function syncShareHash() {
    if (state.shared || !/^#s-/.test(location.hash)) return;
    const h = encodeShare();
    if (location.hash !== h) location.replace(h);
  }

  async function share() {
    const hash = encodeShare();
    if (EMBEDDED) {
      // The outer page owns the real link: put the map in the hash, which its
      // address bar and Share menu pick up.
      if (location.hash !== hash) location.replace(hash);
      toast('Your map is now in this page’s link. Copy it from the address bar or the Share menu.', 'link', null, 7000);
      return;
    }
    const url = location.href.split('#')[0] + hash;
    const ni = state.mine.india.size;
    const nw = [...state.mine.world].filter((id) => VIEWS.world.byId.get(id).sov).length;
    const text = `My Safarnama: ${ni} of 36 Indian states & UTs and ${nw} countries visited.`;
    if (navigator.share && /^https?:/.test(location.protocol)) {
      try { await navigator.share({ title: 'My Safarnama', text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied. Anyone who opens it sees your map.', 'link');
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = url; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('Link copied', 'link'); } catch (err) { toast('Copy this link from the address bar.', 'link'); }
      ta.remove();
    }
  }
  $('#shareBtn').addEventListener('click', share);

  function enterShared(sh) {
    state.shared = sh;
    $('#sharedBanner').hidden = false;
    document.body.classList.add('is-shared');
  }
  function exitShared(adopt) {
    if (adopt && state.shared) {
      state.mine = { india: new Set(state.shared.india), world: new Set(state.shared.world) };
    }
    state.shared = null;
    $('#sharedBanner').hidden = true;
    if (EMBEDDED) { if (location.hash) location.replace(adopt ? encodeShare() : '#'); }
    else history.replaceState(null, '', location.pathname + location.search);
    persist();
    $('#mapSub').textContent = VIEWS[state.view].sub;
    refresh();
    if (adopt) toast('Saved. This map is yours now.', 'check');
  }
  $('#adoptShared').addEventListener('click', () => exitShared(true));
  $('#exitShared').addEventListener('click', () => exitShared(false));

  // ------------------------------------------------------- image export ---
  function cssVar(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }

  function exportSVG(v, visited) {
    const d = v.data;
    const c = (n) => cssVar(n);
    const p = PALETTES.find((x) => x.id === state.palette).c;
    const light = currentTheme() === 'light';
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d.w} ${d.h}" width="${d.w * 2}" height="${d.h * 2}">` +
      `<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${d.w}" y2="${d.h}">` +
      `<stop offset="0" stop-color="${p[0]}"/><stop offset=".5" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[2]}"/></linearGradient>` +
      `<radialGradient id="o" cx="50%" cy="45%" r="62%"><stop offset="0" stop-color="${c('--ocean-2')}"/><stop offset="1" stop-color="${c('--ocean')}"/></radialGradient>` +
      `<filter id="f" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="4" result="b"/>` +
      `<feComponentTransfer in="b" result="bo"><feFuncA type="linear" slope="${light ? 0.5 : 0.85}"/></feComponentTransfer>` +
      `<feMerge><feMergeNode in="bo"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
    if (v.key === 'world') {
      s += `<path d="${d.sphere}" fill="url(#o)" stroke="${c('--sphere-line')}" stroke-width="1"/>`;
      s += `<path d="${d.graticule}" fill="none" stroke="${c('--graticule')}" stroke-width=".6"/>`;
      s += d.context.map((x) => `<path d="${x}" fill="${c('--land')}" stroke="${c('--land-line')}" stroke-width=".5"/>`).join('');
    } else {
      s += d.context.map((x) => `<path d="${x}" fill="${c('--ctx-land')}" stroke="${c('--ctx-line')}" stroke-width=".6"/>`).join('');
      s += `<g fill="${c('--halo')}" stroke="${c('--halo')}" stroke-width="6" stroke-linejoin="round">` + v.regions.map((r) => r.d ? `<path d="${r.d}"/>` : '').join('') + '</g>';
    }
    const lw = v.key === 'world' ? 0.45 : 0.7;
    s += `<g fill="${c('--land')}" stroke="${c('--land-line')}" stroke-width="${lw}" stroke-linejoin="round" fill-rule="evenodd">`;
    for (const r of v.regions) if (r.d && !visited.has(r.id)) s += `<path d="${r.d}"/>`;
    s += `</g><g filter="url(#f)" fill="url(#g)" stroke="${c('--visited-line')}" stroke-width="${lw}" stroke-linejoin="round" fill-rule="evenodd">`;
    for (const r of v.regions) if (r.d && visited.has(r.id)) s += `<path d="${r.d}"/>`;
    s += '</g>';
    const mr = v.markerR * 0.85;
    for (const r of v.regions) {
      if (!r.tiny) continue;
      const on = visited.has(r.id);
      if (!on && v.key === 'world') continue; // keep the poster clean: only visited dots
      s += `<circle cx="${r.lx}" cy="${r.ly}" r="${mr}" fill="${on ? 'url(#g)' : c('--land')}" stroke="${on ? '#fff' : c('--muted')}" stroke-width=".8"/>`;
    }
    return s + '</svg>';
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  async function exportImage() {
    const btn = $('#exportBtn');
    btn.disabled = true;
    try {
      const v = VIEWS[state.view];
      const visited = visitedOf(v.key);
      const st = computeStats(v, visited);
      const pal = PALETTES.find((x) => x.id === state.palette).c;
      if (document.fonts && document.fonts.ready) await document.fonts.ready;

      const isWorld = v.key === 'world';
      const W = 2400, H = isWorld ? 1720 : 1500;
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const ctx = cv.getContext('2d');
      const text = cssVar('--text'), muted = cssVar('--muted'), text2 = cssVar('--text-2');
      const light = currentTheme() === 'light';
      const SERIF = 'Fraunces, Georgia, serif', SANS = 'Jakarta, system-ui, sans-serif';
      const gradH = (x0, x1) => {
        const g = ctx.createLinearGradient(x0, 0, x1, 0);
        g.addColorStop(0, pal[0]); g.addColorStop(0.55, pal[1]); g.addColorStop(1, pal[2]);
        return g;
      };

      // background + auras
      ctx.fillStyle = cssVar('--bg'); ctx.fillRect(0, 0, W, H);
      const aura = (x, y, r, col) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); };
      aura(150, 0, 1100, light ? 'rgba(255,160,90,0.22)' : 'rgba(255,140,90,0.18)');
      aura(W, 200, 1200, light ? 'rgba(140,110,255,0.14)' : 'rgba(120,90,255,0.2)');

      // ---- pieces ----
      const drawBrand = (x, y) => {
        ctx.save();
        ctx.translate(x, y - 54); ctx.scale(1.15, 1.15);
        const pg = ctx.createLinearGradient(10, 0, 54, 60);
        pg.addColorStop(0, pal[0]); pg.addColorStop(0.52, pal[1]); pg.addColorStop(1, pal[2]);
        ctx.fillStyle = pg;
        ctx.fill(new Path2D('M32 3.5c-11.6 0-21 8.9-21 20.6C11 39.5 32 61 32 61s21-21.5 21-36.9C53 12.4 43.6 3.5 32 3.5z'));
        ctx.fillStyle = '#0B1020'; ctx.beginPath(); ctx.arc(32, 24, 10.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#FFE9D2'; ctx.lineWidth = 1.7; ctx.stroke();
        ctx.beginPath(); ctx.ellipse(32, 24, 4.3, 10.5, 0, 0, Math.PI * 2); ctx.moveTo(21.5, 24); ctx.lineTo(42.5, 24); ctx.stroke();
        ctx.restore();
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = text; ctx.font = `650 46px ${SERIF}`;
        ctx.fillText('Safarnama', x + 92, y);
      };
      const drawHeadline = (x, y) => {
        ctx.textAlign = 'left';
        ctx.fillStyle = muted; ctx.font = `700 24px ${SANS}`;
        ctx.fillText((isWorld ? 'MY WORLD' : 'MY INDIA').split('').join(String.fromCharCode(8202)), x, y);
        const big = String(st.counted);
        ctx.font = `600 170px ${SERIF}`;
        const bw = ctx.measureText(big).width;
        const g = ctx.createLinearGradient(x, y + 30, x + bw + 40, y + 190);
        g.addColorStop(0, pal[0]); g.addColorStop(0.5, pal[1]); g.addColorStop(1, pal[2]);
        ctx.fillStyle = g;
        ctx.fillText(big, x - 4, y + 172);
        ctx.fillStyle = muted; ctx.font = `500 62px ${SERIF}`;
        ctx.fillText(`/ ${v.total}`, x + bw + 16, y + 172);
        ctx.fillStyle = text2; ctx.font = `600 31px ${SANS}`;
        ctx.fillText(isWorld ? 'countries visited' : 'states & union territories', x, y + 226);
      };
      const drawPill = (x, y, w, a, b) => {
        ctx.fillStyle = light ? 'rgba(20,28,60,0.05)' : 'rgba(255,255,255,0.05)';
        roundRect(ctx, x, y, w, 92, 24); ctx.fill();
        ctx.strokeStyle = cssVar('--line'); ctx.lineWidth = 2; ctx.stroke();
        ctx.textAlign = 'left';
        ctx.fillStyle = text; ctx.font = `600 44px ${SERIF}`; ctx.fillText(a, x + 28, y + 61);
        const aw = ctx.measureText(a).width;
        ctx.fillStyle = muted; ctx.font = `600 25px ${SANS}`; ctx.fillText(b, x + 28 + aw + 14, y + 59);
      };
      const drawBar = (x, y, w, g) => {
        ctx.font = `650 24px ${SANS}`;
        ctx.fillStyle = text2; ctx.textAlign = 'left'; ctx.fillText(g.name, x, y);
        ctx.fillStyle = muted; ctx.textAlign = 'right'; ctx.fillText(`${g.n}/${g.total}`, x + w, y);
        ctx.textAlign = 'left';
        ctx.fillStyle = light ? 'rgba(20,28,60,0.08)' : 'rgba(255,255,255,0.08)';
        roundRect(ctx, x, y + 14, w, 10, 5); ctx.fill();
        if (g.n) { ctx.fillStyle = gradH(x, x + w); roundRect(ctx, x, y + 14, Math.max(10, (w * g.n) / g.total), 10, 5); ctx.fill(); }
      };
      const drawMap = async (mx, my, mw, mh) => {
        ctx.save();
        roundRect(ctx, mx, my, mw, mh, 44);
        const og = ctx.createRadialGradient(mx + mw / 2, my + mh * 0.4, 0, mx + mw / 2, my + mh * 0.4, mw * 0.7);
        og.addColorStop(0, cssVar('--ocean-2')); og.addColorStop(1, cssVar('--ocean'));
        ctx.fillStyle = isWorld ? (light ? 'rgba(255,255,255,0.55)' : 'rgba(17,24,44,0.66)') : og;
        ctx.fill();
        ctx.strokeStyle = cssVar('--line-strong'); ctx.lineWidth = 2; ctx.stroke();
        ctx.clip();
        const url = URL.createObjectURL(new Blob([exportSVG(v, visited)], { type: 'image/svg+xml' }));
        const img = new Image();
        img.src = url;
        await img.decode();
        const pad = isWorld ? 34 : 0;
        const sc = Math.min((mw - pad * 2) / v.data.w, (mh - pad * 2) / v.data.h);
        const dw = v.data.w * sc, dh = v.data.h * sc;
        const dx = mx + (mw - dw) / 2, dy = my + (mh - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
        URL.revokeObjectURL(url);
        // Labels for visited places, in the same proportions as the on-screen map.
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
        const fpx = isWorld ? 20 : 22;
        const fit = ((isWorld ? 10 : 10.5) * sc) / fpx;
        ctx.font = `700 ${fpx}px ${SANS}`;
        for (const r of v.regions) {
          if (!visited.has(r.id) || r.tiny || r.la || r.z > fit) continue;
          const x = dx + r.lx * sc, y = dy + r.ly * sc;
          ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.strokeText(r.short || r.name, x, y);
          ctx.fillStyle = '#fff'; ctx.fillText(r.short || r.name, x, y);
        }
        ctx.restore();
        ctx.textBaseline = 'alphabetic';
      };
      const footer = `${rankFor(v, st.counted).title}  ·  ${new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`;
      const zonesDone = st.groups.filter((g) => g.n === g.total).length;
      const conts = st.groups.filter((g) => g.any).length;

      if (isWorld) {
        // Stats band on top, full-width map below (the world is wide).
        drawBrand(90, 150);
        ctx.fillStyle = muted; ctx.font = `600 24px ${SANS}`; ctx.textAlign = 'right';
        ctx.fillText(footer, W - 90, 138);
        drawHeadline(90, 270);
        const px = 760, pw = 470;
        drawPill(px, 262, pw, `${conts}/7`, 'continents');
        drawPill(px + pw + 24, 262, pw, `${fmtPct(st.areaPct)}%`, 'of the land');
        const terr = st.vis.filter((r) => !r.sov).length;
        drawPill(px + (pw + 24) * 2, 262, W - 90 - (px + (pw + 24) * 2), `${terr}`, terr === 1 ? 'territory' : 'territories');
        const rows = st.groups.filter((g) => g.total > 1);
        const cw = (W - 90 - px - 2 * 48) / 3;
        rows.slice(0, 6).forEach((g, i) => drawBar(px + (i % 3) * (cw + 48), 418 + Math.floor(i / 3) * 70, cw, g));
        await drawMap(70, 580, W - 140, H - 650);
      } else {
        // Card hugs the map's own aspect ratio so the neighbouring land fills it edge to edge.
        const mh = H - 140, mw = Math.round((mh * v.data.w) / v.data.h);
        await drawMap(W - 70 - mw, 70, mw, mh);
        drawBrand(90, 150);
        drawHeadline(90, 300);
        drawPill(90, 600, 610, `${fmtPct(st.areaPct)}%`, 'of the land');
        drawPill(90, 712, 610, `${zonesDone}/${st.groups.length}`, 'zones complete');
        let py = 880;
        for (const g of st.groups) { drawBar(90, py, 610, g); py += 62; }
        ctx.fillStyle = muted; ctx.font = `600 22px ${SANS}`; ctx.textAlign = 'left';
        ctx.fillText(footer, 90, H - 80);
      }

      const out = await new Promise((res) => cv.toBlob(res, 'image/png'));
      const name = `safarnama-${v.key}-${new Date().toISOString().slice(0, 10)}.png`;
      const downloads = await downloadsCap;
      if (downloads) {
        try {
          await downloads.save({ filename: name, data: out });
          toast('Image saved. Ready to share!', 'download');
        } catch (e) {
          if (!e || e.code !== 'declined') toast('Saving files isn’t available here.', 'x');
        }
        return;
      }
      const file = typeof File === 'function' ? new File([out], name, { type: 'image/png' }) : null;
      const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
      if (coarse && file && navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'My Safarnama' }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(out);
      a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('Image saved. Ready to share!', 'download');
    } catch (err) {
      console.error(err);
      toast('Could not create the image in this browser.', 'x');
    } finally {
      btn.disabled = false;
    }
  }
  $('#exportBtn').addEventListener('click', exportImage);

  // ---------------------------------------------------------- offline ---
  function netStatus() {
    const pill = $('#netPill'), txt = $('#netText');
    const offline = navigator.onLine === false;
    pill.classList.toggle('is-offline', offline);
    const ready = navigator.serviceWorker && navigator.serviceWorker.controller;
    txt.textContent = offline ? 'Offline · all good' : ready ? 'Offline ready' : 'Works offline';
  }
  window.addEventListener('online', netStatus);
  window.addEventListener('offline', () => { netStatus(); toast('You are offline. Safarnama keeps working.', 'wifi'); });

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !EMBEDDED) {
    const hadController = !!navigator.serviceWorker.controller;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          if (!w) return;
          w.addEventListener('statechange', () => {
            if (w.state === 'activated' && !hadController) toast('Saved for offline use. Works without internet now.', 'wifi');
          });
        });
      }).catch(() => { /* offline support unavailable — the app still works online */ });
      navigator.serviceWorker.addEventListener('controllerchange', netStatus);
    });
  }

  // ------------------------------------------------------------- boot ---
  function boot() {
    if (!DATA.india || !DATA.world) {
      document.body.insertAdjacentHTML('afterbegin', '<p style="padding:1rem;text-align:center">Map data failed to load.</p>');
      return;
    }
    renderSwatches();
    root.setAttribute('data-palette', state.palette);
    applyTheme();
    labelsBtn.setAttribute('aria-pressed', String(state.labels));
    picker.init();
    const sh = decodeShare(location.hash);
    if (sh && (sh.india.size || sh.world.size) && !isMine(sh)) enterShared(sh);
    if (sh && !sh.india.size && sh.world.size && !saved.view) state.view = 'world';
    setView(state.view, { initial: true });
    // Pre-build the other map when idle so switching tabs is instant.
    const other = state.view === 'india' ? 'world' : 'india';
    (window.requestIdleCallback || ((f) => setTimeout(f, 300)))(() => ensureMap(other));
    netStatus();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveIndicator);
    window.addEventListener('hashchange', () => {
      const s2 = decodeShare(location.hash);
      if (s2 && (s2.india.size || s2.world.size) && !isMine(s2) && !state.shared) { enterShared(s2); refresh(); setView(state.view); }
    });
  }
  boot();
})();
