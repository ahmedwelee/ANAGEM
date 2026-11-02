/* Schematic outline of Morocco (including the southern provinces), drawn from lon/lat.
   PLACEHOLDER: replace OUTLINE with ANAGEM's official cartography (or a CMS-managed SVG) before launch. */
(function () {
  const OUTLINE = [
    [-5.92, 35.79], [-5.81, 35.80], [-5.56, 35.86], [-5.34, 35.88], [-5.27, 35.62], [-5.05, 35.38], [-4.60, 35.20], [-3.93, 35.26], [-3.30, 35.20], [-2.98, 35.43], [-2.93, 35.30], [-2.42, 35.12], [-2.21, 35.10],
    [-1.95, 34.95], [-1.78, 34.72], [-1.75, 34.45], [-1.80, 34.00], [-1.70, 33.40], [-1.45, 32.55], [-1.23, 32.10], [-2.20, 32.00], [-3.00, 31.65], [-3.70, 31.10], [-4.50, 30.45], [-5.20, 30.00], [-5.60, 29.60], [-6.60, 29.15], [-7.60, 28.70], [-8.67, 28.00], [-8.67, 27.67],
    [-8.67, 26.00], [-12.00, 26.00], [-12.00, 23.45], [-13.10, 21.33], [-16.30, 21.33], [-17.05, 20.77],
    [-16.95, 21.40], [-16.50, 22.40], [-15.95, 23.75], [-15.35, 24.70], [-14.85, 25.60], [-14.48, 26.12], [-13.43, 27.13], [-13.00, 27.67], [-12.93, 27.94], [-11.90, 28.20], [-11.12, 28.48], [-10.50, 28.95], [-10.17, 29.38], [-9.75, 29.95], [-9.65, 30.42], [-9.87, 30.64], [-9.80, 31.50], [-9.50, 32.00], [-9.25, 32.30], [-9.28, 32.55], [-8.50, 33.25], [-7.62, 33.60], [-6.85, 34.03], [-6.67, 34.26], [-6.16, 35.20], [-6.03, 35.47]
  ];
  const CITIES = [
    { k: 'tanger', ll: [-5.81, 35.78], side: 'r' }, { k: 'oujda', ll: [-1.91, 34.68], side: 'l' },
    { k: 'kenitra', ll: [-6.58, 34.26], side: 't', hl: true }, { k: 'fes', ll: [-5.00, 34.03], side: 'r' },
    { k: 'rabat', ll: [-6.84, 34.02], side: 'l' }, { k: 'casablanca', ll: [-7.62, 33.57], side: 'l' },
    { k: 'marrakech', ll: [-7.98, 31.63], side: 'r' }, { k: 'agadir', ll: [-9.60, 30.43], side: 'l' },
    { k: 'laayoune', ll: [-13.20, 27.15], side: 'r' }, { k: 'dakhla', ll: [-15.93, 23.72], side: 'r' }
  ];
  const FR_NAMES = { tanger: 'Tanger', oujda: 'Oujda', kenitra: 'Kénitra', fes: 'Fès', rabat: 'Rabat', casablanca: 'Casablanca', marrakech: 'Marrakech', agadir: 'Agadir', laayoune: 'Laâyoune', dakhla: 'Dakhla' };
  const LON0 = -17.5, LON1 = -0.7, LAT0 = 20.5, LAT1 = 36.0, S = 40, KX = Math.cos(28.5 * Math.PI / 180);
  const W = Math.round((LON1 - LON0) * KX * S), H = Math.round((LAT1 - LAT0) * S);
  const proj = ([lon, lat]) => [(lon - LON0) * KX * S, (LAT1 - lat) * S];
  const NS = 'http://www.w3.org/2000/svg';
  let uid = 0;
  const el = (name, attrs = {}, parent) => { const n = document.createElementNS(NS, name); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };

  function renderMap(root, { mini = false } = {}) {
    if (!root) return;
    const id = ++uid;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: mini ? 'map map--mini' : 'map', 'aria-hidden': 'true', focusable: 'false' });
    const defs = el('defs', {}, svg);
    const grad = el('linearGradient', { id: `mf${id}`, x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': 'var(--c-primary)' }, grad); el('stop', { offset: 1, 'stop-color': 'var(--c-primary-dark)' }, grad);
    const hatch = el('pattern', { id: `mh${id}`, width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(35)' }, defs);
    el('line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: '#fff', 'stroke-opacity': .1, 'stroke-width': 2 }, hatch);

    if (!mini) {
      const g = el('g', { class: 'map__grat' }, svg);
      for (let lon = -16; lon <= -2; lon += 2) { const x = proj([lon, 0])[0]; el('line', { x1: x, y1: 0, x2: x, y2: H }, g); }
      for (let lat = 22; lat <= 36; lat += 2) { const y = proj([0, lat])[1]; el('line', { x1: 0, y1: y, x2: W, y2: y }, g); }
    }
    const float = el('g', { class: mini ? '' : 'map__float' }, svg);
    const d = OUTLINE.map((p, i) => (i ? 'L' : 'M') + proj(p).map(n => n.toFixed(1)).join(' ')).join('') + 'Z';
    const land = el('path', { d, class: 'map__land' }, float);
    if (!mini) {
      land.style.fill = `url(#mf${id})`;
      el('path', { d, class: 'map__hatch', fill: `url(#mh${id})` }, float);
    }
    CITIES.forEach((c, i) => {
      if (mini && !c.hl) return;
      const [x, y] = proj(c.ll);
      const g = el('g', { class: 'map__city' + (c.hl ? ' map__city--hl' : ''), style: `--i:${i}`, transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` }, float);
      if (c.hl) el('circle', { r: 5, class: 'map__ring' }, g);
      el('circle', { r: c.hl ? 6.5 : 5, class: 'dot' }, g);
      if (!mini) {
        const pos = { r: [11, 5, 'start'], l: [-11, 5, 'end'], t: [0, -13, 'middle'], b: [0, 21, 'middle'] }[c.side];
        const t = el('text', { x: pos[0], y: pos[1], 'text-anchor': pos[2], 'data-i18n': `city.${c.k}` }, g);
        t.textContent = FR_NAMES[c.k];
      }
    });
    root.replaceChildren(svg);
    const len = land.getTotalLength();
    land.style.setProperty('--len', Math.ceil(len));
    return svg;
  }
  window.AnagemMap = { renderMap, CITY_KEYS: Object.keys(FR_NAMES) };
})();
