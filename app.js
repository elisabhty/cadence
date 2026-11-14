/* Cadence — carnet de suivi GLP-1 et peptides.
   Tout est stocké sur l'appareil (localStorage), rien n'est envoyé. */
'use strict';
const KEY = 'cadence.v1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.').replace(/\s/g, '')); return isFinite(n) ? n : NaN; };
const fr = (n, d = 1) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: d });
const fr1 = n => Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const sgn = n => (n > 0 ? '+' : n < 0 ? '−' : '') + fr1(Math.abs(n));
const pad = n => String(n).padStart(2, '0');
const DAY = 864e5;
const isoLocal = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const today = () => isoLocal().slice(0, 10);
const D = s => (typeof s === 'string' && s.length === 10) ? new Date(s + 'T12:00') : new Date(s);
const dayKey = s => isoLocal(D(s)).slice(0, 10);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const dfmt = (s, o = { weekday: 'long', day: 'numeric', month: 'long' }) => D(s).toLocaleDateString('fr-FR', o).replace(/\.$/, '');
const tfmt = s => D(s).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const daysBetween = (a, b) => Math.round((D(dayKey(b)) - D(dayKey(a))) / DAY);
function relDay(s) {
  const n = daysBetween(s, today());
  if (n === 0) return 'aujourd’hui';
  if (n === 1) return 'hier';
  if (n === -1) return 'demain';
  return dfmt(s, n < 7 && n > 0 ? { weekday: 'long' } : { weekday: 'long', day: 'numeric', month: 'long' });
}
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/* ---------- Icônes ---------- */
const IC = {
  today: '<circle cx="12" cy="12" r="8.5" opacity=".35"/><path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5"/><circle cx="12" cy="12" r="2.2"/>',
  journal: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.5" cy="6.5" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/><circle cx="4.5" cy="17.5" r="1.2"/>',
  progress: '<path d="M3.5 17.5l5-5.5 4 3.5 8-8.5"/><path d="M15 7h5.5v5.5"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pen: '<g transform="rotate(45 12 12)"><rect x="9" y="2" width="6" height="14.5" rx="2"/><path d="M12 16.5v5.5M9 6.5h6"/></g>',
  scale: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="M8.2 10a5.2 5.2 0 0 1 7.6 0"/><path d="M12 10.5l1.6-2.1"/>',
  face: '<circle cx="12" cy="12" r="8.5"/><path d="M8.6 14.4c1.9 1.7 4.9 1.7 6.8 0"/><path d="M9 9.6h.01M15 9.6h.01" stroke-width="2.6"/>',
  drop: '<path d="M12 3.5c3.6 4.3 6 7.6 6 10.6a6 6 0 0 1-12 0c0-3 2.4-6.3 6-10.6z"/>',
  box: '<path d="M3.8 7.6L12 3.3l8.2 4.3v8.8L12 20.7l-8.2-4.3z"/><path d="M3.8 7.6L12 12l8.2-4.4M12 12v8.7"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  chev: '<path d="M9 5.5l6.5 6.5L9 18.5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 3.8l9 15.7H3z"/><path d="M12 10v4.2M12 17h.01"/>',
  share: '<path d="M12 3.5v11M8 7.5l4-4 4 4"/><path d="M6 11v8.5h12V11"/>',
  table: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M3.5 9.5h17M3.5 14.5h17M10 9.5v10"/>',
  restore: '<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v4.5h4.5"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
  pause: '<path d="M9 6v12M15 6v12"/>'
};
const nb = s => String(s).replace(/ ([?!;:])/g, '\u202F$1');
const ic = (n, c = '') => `<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;

/* ---------- Référentiels ---------- */
const PRESETS = [
  { key: 'mounjaro', name: 'Mounjaro', molecule: 'tirzépatide', unit: 'mg', intervalDays: 7, halfLifeH: 120, tmaxH: 24, doses: [2.5, 5, 7.5, 10, 12.5, 15], color: '#E5487A' },
  { key: 'wegovy', name: 'Wegovy', molecule: 'sémaglutide', unit: 'mg', intervalDays: 7, halfLifeH: 168, tmaxH: 48, doses: [0.25, 0.5, 1, 1.7, 2.4], color: '#2F80ED' },
  { key: 'ozempic', name: 'Ozempic', molecule: 'sémaglutide', unit: 'mg', intervalDays: 7, halfLifeH: 168, tmaxH: 48, doses: [0.25, 0.5, 1, 2], color: '#7B61FF' },
  { key: 'saxenda', name: 'Saxenda', molecule: 'liraglutide', unit: 'mg', intervalDays: 1, halfLifeH: 13, tmaxH: 11, doses: [0.6, 1.2, 1.8, 2.4, 3], color: '#E8833A' },
  { key: 'custom', name: '', molecule: '', unit: 'mg', intervalDays: 7, halfLifeH: '', tmaxH: '', doses: [], color: '#0FA3A3' }
];
const COLORS = ['#E5487A', '#2F80ED', '#7B61FF', '#E8833A', '#0FA3A3', '#B4508F'];
const OLD_COLORS = { '#F7C948': '#E5487A', '#5FC9B8': '#2F80ED', '#7FA8FF': '#7B61FF', '#C59BFF': '#B4508F', '#FF7A90': '#0FA3A3', '#FFA35C': '#E8833A' };
// « gauche » = gauche de la personne : à droite à l'écran (silhouette vue de face).
const SITES = [
  { id: 'vg', label: 'Ventre gauche', x: 114, y: 184, rx: 10, ry: 14 },
  { id: 'vd', label: 'Ventre droit', x: 86, y: 184, rx: 10, ry: 14 },
  { id: 'cg', label: 'Cuisse gauche', x: 117, y: 272, rx: 10, ry: 19 },
  { id: 'cd', label: 'Cuisse droite', x: 83, y: 272, rx: 10, ry: 19 },
  { id: 'bg', label: 'Bras gauche', x: 147, y: 142, rx: 6.5, ry: 15 },
  { id: 'bd', label: 'Bras droit', x: 53, y: 142, rx: 6.5, ry: 15 }
];
const FEEL = [['Tout va bien', '✨'], ['Nausées', '🤢'], ['Fatigue', '😴'], ['Constipation', '😣'], ['Diarrhée', '💧'], ['Reflux', '🔥'], ['Maux de tête', '🤕'], ['Appétit coupé', '🍽️'], ['Fringales', '🍫'], ['Vertiges', '💫'], ['Point d’injection irrité', '📍'], ['Autre', '✏️']];
const GOOD = 'Tout va bien';
const LEVELS = ['', 'Léger', 'Gênant', 'Fort'];
const emo = t => (FEEL.find(f => f[0] === String(t).replace(/'/g, '’')) || [0, '•'])[1];

/* ---------- Données ---------- */
function blank() { return { v: 2, onboarded: false, profile: { name: '', height: '', goal: '' }, treatments: [], injections: [], weights: [], symptoms: [] }; }
function load() {
  try {
    const d = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY)) || {});
    d.treatments.forEach(t => { if (OLD_COLORS[t.color]) t.color = OLD_COLORS[t.color]; });
    d.symptoms.forEach(s => { s.type = String(s.type).replace(/'/g, '’'); });
    return d;
  } catch (e) { return blank(); }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Enregistrement impossible : stockage plein ou bloqué', true); } }

let S = load();
let tab = 'home', focusT = null, jFilter = 'all', range = 90, firstHome = true;
let ob = null, obStep = 0, obShown = -1;
let mounts = [];
const stack = [];

const T = id => S.treatments.find(t => t.id === id);
const active = () => S.treatments.filter(t => !t.archived);
const byDateDesc = a => a.slice().sort((x, y) => D(y.date) - D(x.date));
const injOf = id => byDateDesc(S.injections.filter(i => i.tid === id));
const siteLabel = id => (SITES.find(s => s.id === id) || {}).label || '';
const weightsAsc = () => S.weights.slice().sort((a, b) => D(a.date) - D(b.date));
const fmtDose = (d, u) => `${fr(d, 3)} ${u}`;
const freqTxt = n => n === 1 ? 'chaque jour' : n === 7 ? 'chaque semaine' : n === 14 ? 'toutes les 2 semaines' : `tous les ${fr(n)} jours`;

/* ---------- Calculs ---------- */
function kaFor(ke, tmax) {
  let lo = ke * 1.0001, hi = ke * 500;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2, tm = Math.log(m / ke) / (m - ke); if (tm > tmax) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
function levelAt(t, ms) {
  const hl = num(t.halfLifeH); if (!(hl > 0)) return null;
  const ke = Math.LN2 / hl, tm = num(t.tmaxH), ka = tm > 0 ? kaFor(ke, tm) : null;
  let sum = 0;
  for (const i of S.injections) {
    if (i.tid !== t.id) continue;
    const h = (ms - D(i.date).getTime()) / 36e5; if (h < 0) continue;
    sum += ka ? i.dose * ka / (ka - ke) * (Math.exp(-ke * h) - Math.exp(-ka * h)) : i.dose * Math.exp(-ke * h);
  }
  return sum;
}
function rotation(tid) {
  const used = injOf(tid).map(i => i.site).filter(Boolean);
  let best = SITES[0], score = -1;
  for (const s of SITES) { const idx = used.indexOf(s.id); const sc = idx === -1 ? 1e9 : idx; if (sc > score) { score = sc; best = s; } }
  return { next: best.id, last: used[0] || null };
}
function lastUse(tid, site) { const i = injOf(tid).find(x => x.site === site); return i ? daysBetween(i.date, today()) : null; }
function status(t) {
  const last = injOf(t.id)[0]; if (!last) return { last: null };
  const n = Math.max(1, Math.round(num(t.intervalDays) || 7));
  const due = D(last.date).getTime() + n * DAY;
  return { last, n, due, elapsed: daysBetween(last.date, today()), dueIn: daysBetween(today(), new Date(due)) };
}

/* ---------- Tracés ---------- */
function mono(p) {
  const n = p.length; if (!n) return '';
  if (n < 3) return p.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('');
  const dx = [], m = [], t = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1][0] - p[i][0]; m[i] = dx[i] ? (p[i + 1][1] - p[i][1]) / dx[i] : 0; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) { const h = dx[i] / 3; d += `C${(p[i][0] + h).toFixed(1)} ${(p[i][1] + h * t[i]).toFixed(1)} ${(p[i + 1][0] - h).toFixed(1)} ${(p[i + 1][1] - h * t[i + 1]).toFixed(1)} ${p[i + 1][0].toFixed(1)} ${p[i + 1][1].toFixed(1)}`; }
  return d;
}
function catmull(P) {
  const n = P.length; let d = `M${P[0][0]} ${P[0][1]}`;
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  return d + 'Z';
}
const SIL = (() => {
  const R = [[108, 62], [110, 74], [124, 80], [139, 86], [148, 98], [151, 124], [154, 158], [158, 192], [160, 219], [155, 228], [149, 221], [146, 192], [141, 160], [136, 128], [133, 150], [127, 173], [131, 197], [136, 220], [134, 252], [129, 292], [126, 332], [124, 368], [128, 388], [113, 391], [110, 372], [110, 332], [108, 292], [104, 254], [100, 240]];
  return catmull([...R, ...R.slice(0, -1).reverse().map(([x, y]) => [200 - x, y])]);
})();
function figure(rot, sel) {
  return `<svg class="figure" viewBox="0 0 200 400" role="group" aria-label="Zones d’injection">
  <ellipse class="sil" cx="100" cy="36" rx="21" ry="25"/><path class="sil" d="${SIL}"/>
  ${SITES.map(s => `<ellipse class="zone${sel === s.id ? ' on' : ''}${rot && rot.next === s.id ? ' sug' : ''}${rot && rot.last === s.id ? ' last' : ''}" cx="${s.x}" cy="${s.y}" rx="${s.rx}" ry="${s.ry}" data-site="${s.id}" tabindex="0" role="button" aria-label="${s.label}" aria-pressed="${sel === s.id}"/>`).join('')}</svg>`;
}
function arcPath(cx, cy, r, a0, a1) {
  const p = a => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
function ringArcs(n, done, cur, late, anim) {
  const R = 100, c = 118;
  if (n > 14 || n === 1) {
    const L = 2 * Math.PI * R, f = Math.min(1, done / n);
    return `<circle class="full" cx="${c}" cy="${c}" r="${R}" stroke="var(--fill)"/>${f > 0 ? `<circle class="full" cx="${c}" cy="${c}" r="${R}" stroke="${late ? 'var(--red)' : 'var(--c)'}" stroke-dasharray="${(L * f).toFixed(1)} ${L}" stroke-linecap="round" transform="rotate(-90 ${c} ${c})"/>` : ''}`;
  }
  const step = 360 / n, gap = Math.max(11, step * .1 + 10.5);
  let s = '';
  for (let i = 0; i < n; i++) {
    const a0 = -90 + i * step + gap / 2, a1 = -90 + (i + 1) * step - gap / 2;
    const cls = late ? 'late' : i < done ? 'done' : i === cur ? 'cur' : '';
    s += `<path class="arc ${cls}" d="${arcPath(c, c, R, a0, a1)}"${anim ? ` style="animation-delay:${i * 55}ms"` : ''}/>`;
  }
  return s;
}
function spark(vals, color) {
  if (vals.length < 2) return '';
  const lo = Math.min(...vals), hi = Math.max(...vals), r = hi - lo || 1;
  const p = vals.map((v, i) => [i / (vals.length - 1) * 100, 26 - (v - lo) / r * 22]);
  return `<svg class="spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><path d="${mono(p)}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
}

/* ---------- Rendu ---------- */
function render() {
  const app = $('#app');
  mounts = [];
  if (!S.onboarded) {
    $('#tabs').hidden = true; $('#bar').classList.remove('on');
    app.innerHTML = vOnboard();
  } else {
    $('#tabs').hidden = false; renderTabs();
    app.innerHTML = `<div class="page">${({ home: vHome, journal: vJournal, progress: vProgress, settings: vSettings })[tab]()}</div>`;
  }
  mounts.forEach(f => f());
  onScroll();
}
function renderTabs() {
  const it = [['home', 'Aujourd’hui', 'today'], ['journal', 'Journal', 'journal'], ['fab'], ['progress', 'Progrès', 'progress'], ['settings', 'Réglages', 'settings']];
  $('#tabs').innerHTML = '<div class="in">' + it.map(([k, l, i]) => k === 'fab'
    ? `<button class="fab" data-act="fab" aria-label="Ajouter une entrée"><span>${ic('plus')}</span></button>`
    : `<button data-tab="${k}" ${tab === k ? 'aria-current="page"' : ''}>${ic(i)}<span>${l}</span></button>`).join('') + '</div>';
}
function onScroll() {
  const lt = $('.lt'), bar = $('#bar');
  if (!lt || !S.onboarded) return bar.classList.remove('on');
  bar.firstElementChild.textContent = lt.dataset.short || lt.textContent;
  bar.classList.toggle('on', window.scrollY > lt.offsetTop + lt.offsetHeight - 44);
}
addEventListener('scroll', onScroll, { passive: true });

/* ---------- Accueil ---------- */
function vHome() {
  const act = active();
  const hi = S.profile.name ? `Bonjour ${esc(S.profile.name)}` : 'Aujourd’hui';
  let h = `<p class="kicker">${cap(dfmt(new Date()))}</p><h1 class="lt" data-short="Aujourd’hui">${hi}</h1>`;
  if (!act.length) return h + `<div class="card empty">${ic('pen')}<b>Aucun traitement en cours</b><p>Ajoute ton traitement pour suivre tes injections, ta rotation et ton niveau estimé.</p><button class="btn" data-act="newT">Ajouter un traitement</button></div>`;
  if (!act.some(t => t.id === focusT)) focusT = act[0].id;
  const t = T(focusT), st = status(t);
  if (act.length > 1) h += `<div class="seg" style="margin-bottom:12px">${act.map(x => `<button data-focus="${x.id}" aria-pressed="${x.id === focusT}">${esc(x.name)}</button>`).join('')}</div>`;
  h += hero(t, st);
  h += `<div class="grid">${tileWeight()}${tileLevel(t, st)}${tileFeel()}${tileStock(t, st)}</div>`;
  const strong = S.symptoms.find(s => s.level === 3 && daysBetween(s.date, today()) <= 3);
  if (strong) h += `<div class="alert" style="--c:var(--red)">${ic('alert')}<div><b>Ressenti fort : ${esc(strong.type.toLowerCase())}</b><p>S’il persiste ou t’inquiète, parles-en à ton médecin ou ton pharmacien. En cas d’urgence, appelle le 15.</p></div></div>`;
  firstHome = false;
  return h;
}
function hero(t, st) {
  const rot = rotation(t.id), anim = firstHome && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let center, when, meta, ring, cls = '';
  if (!st.last) {
    const n = Math.max(1, Math.round(num(t.intervalDays) || 7));
    ring = ringArcs(n, 0, -1, false, anim);
    center = `<div class="n">${ic('pen')}</div><div class="u">Aucune injection notée</div>`;
    when = 'Note ta première injection';
    meta = 'Le compte à rebours démarre ensuite, ' + freqTxt(n) + '.';
  } else {
    const { n, elapsed, dueIn, last } = st;
    const late = dueIn < 0, due = dueIn === 0;
    const done = late || due ? n : Math.min(elapsed, n);
    ring = ringArcs(n, done, late || due ? -1 : elapsed, late, anim);
    if (late) { cls = ' late'; center = `<div class="n">${-dueIn}</div><div class="u">jour${-dueIn > 1 ? 's' : ''} de retard</div>`; }
    else if (due) center = `<div class="n w">Jour J</div><div class="u">c’est aujourd’hui</div>`;
    else center = `<div class="n">${dueIn}</div><div class="u">${dueIn > 1 ? 'jours restants' : 'jour restant'}</div>${n > 1 ? `<div class="d">jour ${elapsed + 1} sur ${n}</div>` : ''}`;
    when = (late || due ? 'Injection prévue ' : 'Prochaine injection ') + relDay(new Date(st.due));
    meta = `Dernière : ${fmtDose(last.dose, esc(t.unit))}, ${relDay(last.date)}.<br>Zone conseillée : ${siteLabel(rot.next).toLowerCase()}.`;
  }
  return `<section class="card hero" style="--c:${esc(t.color)}">
    <div class="ring${anim ? ' anim' : ''}${cls}"><svg viewBox="0 0 236 236" aria-hidden="true">${ring}</svg><div class="c">${center}</div></div>
    <p class="when">${cap(when)}</p><p class="meta">${meta}</p>
    <div class="acts"><button class="btn" data-act="newInj" data-id="${t.id}">${ic('pen')}Noter l’injection</button>${st.last ? `<button class="btn tint sq" data-act="ics" data-id="${t.id}" aria-label="Ajouter les rappels au calendrier">${ic('bell')}</button>` : ''}</div>
  </section>`;
}
function tileWeight() {
  const w = weightsAsc(), last = w[w.length - 1];
  return `<button class="tile" style="--c:var(--poids)" data-tab="progress"><span class="h">${ic('scale')}Poids</span>
    ${last ? `<span class="v">${fr1(last.kg)}<small>kg</small></span><span class="s">${w.length > 1 ? sgn(last.kg - w[0].kg) + ' kg depuis le début' : 'Pesée ' + relDay(last.date)}</span>${spark(w.slice(-12).map(x => x.kg), 'var(--poids)')}`
      : `<span class="v">–</span><span class="s">Note ta première pesée</span>`}</button>`;
}
function tileLevel(t, st) {
  if (!(num(t.halfLifeH) > 0) || !st.last) return `<button class="tile" style="--c:var(--niv)" data-act="${num(t.halfLifeH) > 0 ? 'newInj' : 'editT'}" data-id="${t.id}"><span class="h">${ic('drop')}Niveau</span><span class="v">–</span><span class="s">${num(t.halfLifeH) > 0 ? 'Apparaît après la première injection' : 'Renseigne la demi-vie pour l’estimer'}</span></button>`;
  const now = Date.now(), pts = []; for (let i = 0; i <= 40; i++) pts.push(levelAt(t, now - 14 * DAY + i * 14 * DAY / 40));
  return `<button class="tile" style="--c:var(--niv)" data-tab="progress"><span class="h">${ic('drop')}Niveau</span><span class="v">${fr(levelAt(t, now), 2)}<small>${esc(t.unit)}</small></span><span class="s">estimé maintenant</span>${spark(pts, 'var(--niv)')}</button>`;
}
function tileFeel() {
  const wk = S.symptoms.filter(s => daysBetween(s.date, today()) < 7);
  const bad = wk.filter(s => s.type !== GOOD), last = byDateDesc(S.symptoms)[0];
  let v, s;
  if (!S.symptoms.length) { v = '–'; s = 'Comment tu te sens\u202F?'; }
  else if (!bad.length) { v = '✨'; s = wk.length ? 'Rien à signaler cette semaine' : 'Rien noté cette semaine'; }
  else { v = `${bad.length}<small>cette semaine</small>`; s = `Dernier : ${esc(last.type.toLowerCase())}${last.level ? ', ' + LEVELS[last.level].toLowerCase() : ''}`; }
  return `<button class="tile" style="--c:var(--ress)" data-act="newS"><span class="h">${ic('face')}Ressentis</span><span class="v">${v}</span><span class="s">${s}</span></button>`;
}
function tileStock(t, st) {
  if (t.stock !== '' && t.stock != null) {
    const n = num(t.stock), low = n <= 1;
    const until = st.last && n > 0 ? new Date(st.due + (n - 1) * st.n * DAY) : null;
    return `<button class="tile" style="--c:${low ? 'var(--red)' : 'var(--inj)'}" data-act="editT" data-id="${t.id}"><span class="h">${ic('box')}Stock</span><span class="v">${fr(n, 0)}<small>dose${n > 1 ? 's' : ''}</small></span><span class="s${low ? ' warn' : ''}">${low ? 'Pense au renouvellement' : until ? 'Jusqu’au ' + dfmt(until, { day: 'numeric', month: 'long' }) : 'Restantes'}</span></button>`;
  }
  return `<button class="tile" style="--c:var(--inj)" data-act="editT" data-id="${t.id}"><span class="h">${ic('box')}Stock</span><span class="v">–</span><span class="s">Indique tes doses pour savoir quand renouveler</span></button>`;
}

/* ---------- Journal ---------- */
function vJournal() {
  let h = `<h1 class="lt">Journal</h1><div class="seg" style="margin-bottom:6px">${[['all', 'Tout'], ['inj', 'Injections'], ['poids', 'Poids'], ['ress', 'Ressentis']].map(([k, l]) => `<button data-jf="${k}" aria-pressed="${jFilter === k}">${l}</button>`).join('')}</div>`;
  const items = [];
  if (jFilter === 'all' || jFilter === 'inj') items.push(...S.injections.map(o => ({ k: 'inj', d: D(o.date), o })));
  if (jFilter === 'all' || jFilter === 'poids') items.push(...S.weights.map(o => ({ k: 'poids', d: D(o.date), o })));
  if (jFilter === 'all' || jFilter === 'ress') items.push(...S.symptoms.map(o => ({ k: 'ress', d: D(o.date), o })));
  items.sort((a, b) => b.d - a.d || (a.k === 'inj' ? -1 : 1));
  if (!items.length) {
    const e = { all: ['journal', 'Ton journal est vide', 'Tout ce que tu notes apparaît ici, jour par jour.', 'fab', 'Ajouter une entrée'], inj: ['pen', 'Aucune injection', 'Chaque injection notée alimente le compte à rebours et la rotation des zones.', 'newInj', 'Noter une injection'], poids: ['scale', 'Aucune pesée', 'Pèse-toi le même jour chaque semaine pour une courbe lisible.', 'newW', 'Noter mon poids'], ress: ['face', 'Aucun ressenti', 'Note ce que tu ressens : c’est utile pour en parler à ton médecin.', 'newS', 'Noter un ressenti'] }[jFilter];
    return h + `<div class="card empty" style="margin-top:14px">${ic(e[0])}<b>${e[1]}</b><p>${e[2]}</p><button class="btn" data-act="${e[3]}">${e[4]}</button></div>`;
  }
  const ws = weightsAsc(), prevW = {}; ws.forEach((w, i) => prevW[w.id] = i ? ws[i - 1].kg : null);
  let cur = '';
  for (const it of items) {
    const k = dayKey(it.d);
    if (k !== cur) { if (cur) h += '</div>'; cur = k; h += `<h2 class="h2" style="font-size:20px">${cap(relDay(k))}</h2><div class="group">`; }
    h += row(it, prevW);
  }
  return h + '</div>';
}
function row(it, prevW) {
  const o = it.o;
  if (it.k === 'inj') {
    const t = T(o.tid) || { name: 'Traitement supprimé', unit: '', color: '#8E8E93' };
    return `<button class="row has-ic" data-entry="injections:${o.id}"><span class="bubble" style="--c:${esc(t.color)}">${ic('pen')}</span><span class="t"><b>${esc(t.name)}</b><span>${tfmt(o.date)}${o.site ? ', ' + siteLabel(o.site).toLowerCase() : ''}${o.note ? ' — ' + esc(o.note) : ''}</span></span><span class="val">${fmtDose(o.dose, esc(t.unit))}</span></button>`;
  }
  if (it.k === 'poids') {
    const p = prevW[o.id];
    return `<button class="row has-ic" data-entry="weights:${o.id}"><span class="bubble" style="--c:var(--poids)">${ic('scale')}</span><span class="t"><b>Poids</b><span>${p == null ? 'Première pesée' : sgn(o.kg - p) + ' kg depuis la précédente'}</span></span><span class="val">${fr1(o.kg)} kg</span></button>`;
  }
  return `<button class="row has-ic" data-entry="symptoms:${o.id}"><span class="bubble emo">${emo(o.type)}</span><span class="t"><b>${esc(o.type)}</b><span>${o.level ? LEVELS[o.level] : 'Bonne journée'}${o.note ? ' — ' + esc(o.note) : ''}</span></span></button>`;
}

/* ---------- Progrès ---------- */
function vProgress() {
  let h = `<h1 class="lt">Progrès</h1><div class="seg">${[[30, '1 mois'], [90, '3 mois'], [180, '6 mois'], [0, 'Tout']].map(([k, l]) => `<button data-range="${k}" aria-pressed="${range === k}">${l}</button>`).join('')}</div>`;
  const all = weightsAsc(), from = range ? Date.now() - range * DAY : -Infinity;
  const ws = all.filter(w => D(w.date).getTime() >= from);
  h += `<h2 class="h2">Poids <button data-act="newW">Ajouter</button></h2>`;
  if (all.length < 2) h += `<div class="card empty">${ic('scale')}<b>${all.length ? 'Encore une pesée' : 'Pas encore de pesée'}</b><p>La courbe apparaît à partir de deux pesées.</p><button class="btn poids" data-act="newW">Noter mon poids</button></div>`;
  else {
    const last = all[all.length - 1], first = all[0], wk = (D(last.date) - D(first.date)) / (7 * DAY);
    const hm = num(S.profile.height) / 100, goal = num(S.profile.goal);
    let goalHtml = '';
    if (goal > 0 && first.kg > goal) { const tot = first.kg - goal, doneKg = Math.max(0, first.kg - last.kg), p = Math.min(1, doneKg / tot); goalHtml = `<p class="goal"><b>${fr1(doneKg)} kg</b> sur ${fr1(tot)} kg vers ton objectif de ${fr1(goal)} kg</p><div class="pbar"><i style="width:${(p * 100).toFixed(1)}%"></i></div>`; }
    h += `<div class="card chart-card">${ws.length >= 2 ? weightChart(ws, goal) : `<p class="readout"><span class="d">Pas assez de pesées sur cette période.</span></p>`}
      <div class="stats"><div><b>${sgn(last.kg - first.kg)}</b><span>kg au total</span></div><div><b>${wk >= 1 ? sgn((last.kg - first.kg) / wk) : '–'}</b><span>kg par semaine</span></div><div><b>${hm > 0 ? fr1(last.kg / (hm * hm)) : '–'}</b><span>${hm > 0 ? 'IMC' : 'IMC (ajoute ta taille)'}</span></div></div>${goalHtml}</div>`;
    const rec = all.filter(x => daysBetween(x.date, last.date) <= 21);
    if (rec.length >= 3 && wk >= 3) { const ks = rec.map(x => x.kg); if (Math.max(...ks) - Math.min(...ks) < .6) h += `<div class="alert" style="--c:var(--poids)">${ic('progress')}<div><b>Palier possible</b><p>Ton poids varie de moins de 600 g depuis 3 semaines. C’est fréquent, et c’est un bon sujet pour ton prochain rendez-vous.</p></div></div>`; }
  }
  const act = active(); if (act.length && !act.some(t => t.id === focusT)) focusT = act[0].id;
  const t = T(focusT);
  if (t) {
    h += `<h2 class="h2">${esc(t.name)}</h2>`;
    if (act.length > 1) h += `<div class="seg" style="margin-bottom:12px">${act.map(x => `<button data-focus="${x.id}" aria-pressed="${x.id === focusT}">${esc(x.name)}</button>`).join('')}</div>`;
    const inj = injOf(t.id);
    if (num(t.halfLifeH) > 0 && inj.length) h += `<div class="card chart-card" style="--c:${esc(t.color)}">${levelChart(t)}<p class="foot-note" style="margin:10px 0 0">Courbe théorique calculée avec une demi-vie de ${fr(t.halfLifeH, 0)} h. Elle ne mesure rien dans ton corps.</p></div>`;
    if (inj.length) {
      const steps = [];
      inj.slice().reverse().forEach(i => { const s = steps[steps.length - 1]; if (s && s.dose === i.dose) s.n++; else steps.push({ dose: i.dose, from: i.date, n: 1 }); });
      h += `<p class="lab">Paliers de dose</p><div class="group">${steps.reverse().map((s, i) => `<div class="row"><span class="t"><b class="num" style="font-size:17px">${fmtDose(s.dose, esc(t.unit))}</b><span>${i === 0 ? 'Depuis le' : 'À partir du'} ${dfmt(s.from, { day: 'numeric', month: 'long' })}</span></span><span style="font-size:15px;color:var(--label2)">${s.n} injection${s.n > 1 ? 's' : ''}</span></div>`).join('')}</div>`;
    } else h += `<div class="card empty">${ic('pen')}<b>Aucune injection notée</b><p>Le niveau estimé et tes paliers de dose apparaîtront ici.</p><button class="btn" data-act="newInj" data-id="${t.id}">Noter une injection</button></div>`;
  }
  const d30 = S.symptoms.filter(s => daysBetween(s.date, today()) < 30);
  if (d30.length) {
    const cnt = {}; d30.filter(s => s.type !== GOOD).forEach(s => cnt[s.type] = (cnt[s.type] || 0) + 1);
    const top5 = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 6), mx = top5.length ? top5[0][1] : 1, good = d30.filter(s => s.type === GOOD).length;
    h += `<h2 class="h2">Ressentis <button data-act="newS">Ajouter</button></h2><div class="card chart-card"><p class="readout" style="min-height:0"><span class="d">Sur les 30 derniers jours${good ? `, dont ${good} journée${good > 1 ? 's' : ''} sans souci` : ''}</span></p>
      ${top5.length ? top5.map(([k, v]) => `<div class="freq"><span class="e">${emo(k)}</span><span class="k">${esc(k)}</span><span class="b"><i style="width:${v / mx * 100}%"></i></span><span class="n">${v}</span></div>`).join('') : `<p style="font-size:15px;margin-top:6px">Aucun effet indésirable noté ✨</p>`}</div>`;
  }
  return h;
}
function scrub(id, pts, def) {
  mounts.push(() => {
    const svg = document.getElementById(id); if (!svg) return;
    const W = svg.viewBox.baseVal.width, g = $('.guide', svg), dot = $('.hdot', svg), out = document.getElementById(id + '-r');
    let tm;
    const show = i => { const p = pts[i]; g.setAttribute('x1', p.x); g.setAttribute('x2', p.x); dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y); out.innerHTML = p.html; };
    const at = e => { clearTimeout(tm); const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W; let b = 0, bd = 1e9; pts.forEach((p, i) => { const d = Math.abs(p.x - x); if (d < bd) { bd = d; b = i; } }); show(b); };
    svg.addEventListener('pointerdown', at); svg.addEventListener('pointermove', at);
    svg.addEventListener('pointerleave', () => show(def));
    svg.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') tm = setTimeout(() => show(def), 1200); });
    show(def);
  });
}
function weightChart(ws, goal) {
  const id = 'wc', W = 340, H = 170, L = 4, R = 34, Tp = 10, B = 22;
  const xs = ws.map(w => D(w.date).getTime()), ks = ws.map(w => w.kg);
  let lo = Math.min(...ks), hi = Math.max(...ks);
  if (goal > 0 && goal < lo && lo - goal < 8) lo = goal;
  if (hi - lo < 2) { const m = (2 - (hi - lo)) / 2; hi += m; lo -= m; }
  const pd = (hi - lo) * .12; lo -= pd; hi += pd;
  const t0 = xs[0], t1 = xs[xs.length - 1];
  const x = v => L + (t1 > t0 ? (v - t0) / (t1 - t0) : .5) * (W - L - R), y = v => Tp + (hi - v) / (hi - lo) * (H - Tp - B);
  const p = ws.map((w, i) => [x(xs[i]), y(w.kg)]), path = mono(p);
  const ticks = [hi - pd, (hi + lo) / 2, lo + pd];
  const inj = S.injections.map(i => D(i.date).getTime()).filter(v => v >= t0 && v <= t1).map(v => `<circle cx="${x(v).toFixed(1)}" cy="${H - B + 6}" r="2.2" fill="var(--inj)"/>`).join('');
  const pts = ws.map((w, i) => ({ x: p[i][0], y: p[i][1], html: `<div class="v">${fr1(w.kg)}<small>kg</small></div><div class="d">${cap(relDay(w.date))}${i ? ', ' + sgn(w.kg - ws[i - 1].kg) + ' kg' : ''}</div>` }));
  scrub(id, pts, pts.length - 1);
  return `<div class="readout" id="${id}-r"></div>
  <svg class="chart" id="${id}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Courbe de poids">
    <defs><linearGradient id="${id}-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--poids)" stop-opacity=".28"/><stop offset="1" stop-color="var(--poids)" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map(v => `<line class="grid-l" x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${W - R + 6}" y="${(y(v) + 4).toFixed(1)}">${fr(v, 0)}</text>`).join('')}
    ${goal > 0 && goal >= lo && goal <= hi ? `<line x1="${L}" x2="${W - R}" y1="${y(goal).toFixed(1)}" y2="${y(goal).toFixed(1)}" stroke="var(--poids)" stroke-width="1.5" stroke-dasharray="4 4"/>` : ''}
    <path d="${path}L${p[p.length - 1][0].toFixed(1)} ${H - B}L${p[0][0].toFixed(1)} ${H - B}Z" fill="url(#${id}-g)"/>
    <path d="${path}" fill="none" stroke="var(--poids)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    ${ws.length <= 30 ? p.map(q => `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="3" fill="var(--card)" stroke="var(--poids)" stroke-width="2"/>`).join('') : ''}
    ${inj}
    <line class="guide" y1="${Tp - 4}" y2="${H - B}"/><circle class="hdot" r="6" fill="var(--poids)" stroke="var(--card)" stroke-width="2.5"/>
    <text x="${L}" y="${H - 2}">${dfmt(ws[0].date, { day: 'numeric', month: 'short' })}</text><text x="${W - R}" y="${H - 2}" text-anchor="end">${dfmt(ws[ws.length - 1].date, { day: 'numeric', month: 'short' })}</text>
  </svg><p class="foot-note" style="margin:6px 0 0">Glisse le doigt sur la courbe pour voir chaque pesée.${inj ? ' Points roses : injections.' : ''}${goal > 0 && goal >= lo && goal <= hi ? ' Pointillés : objectif.' : ''}</p>`;
}
function levelChart(t) {
  const id = 'lc', W = 340, H = 150, P = 4, now = Date.now(), from = now - 21 * DAY, to = now + 7 * DAY, N = 168;
  const s = []; let max = 0;
  for (let i = 0; i <= N; i++) { const ms = from + (to - from) * i / N, v = levelAt(t, ms); s.push([ms, v]); if (v > max) max = v; }
  if (!max) return '';
  const x = ms => P + (ms - from) / (to - from) * (W - 2 * P), y = v => H - 22 - v / max * (H - 36);
  const line = a => a.map((q, i) => (i ? 'L' : 'M') + x(q[0]).toFixed(1) + ' ' + y(q[1]).toFixed(1)).join('');
  const past = s.filter(q => q[0] <= now), fut = s.filter(q => q[0] >= past[past.length - 1][0]);
  const marks = S.injections.filter(i => i.tid === t.id && D(i.date).getTime() >= from).map(i => `<circle cx="${x(D(i.date).getTime()).toFixed(1)}" cy="${H - 16}" r="2.6" fill="var(--c)"/>`).join('');
  const pts = s.filter((q, i) => i % 2 === 0).map(q => ({ x: x(q[0]), y: y(q[1]), html: `<div class="v">${fr(q[1], 2)}<small>${esc(t.unit)} estimés</small></div><div class="d">${Math.abs(q[0] - now) < DAY / 12 ? 'Maintenant' : cap(relDay(new Date(q[0]))) + ' vers ' + tfmt(new Date(q[0]))}${q[0] > now + DAY / 12 ? ', sans nouvelle injection' : ''}</div>` }));
  let def = 0, bd = 1e18; pts.forEach((p, i) => { const d = Math.abs(p.x - x(now)); if (d < bd) { bd = d; def = i; } });
  scrub(id, pts, def);
  return `<div class="readout" id="${id}-r"></div>
  <svg class="chart" id="${id}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Niveau estimé sur 4 semaines">
    <defs><linearGradient id="${id}-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--c)" stop-opacity=".3"/><stop offset="1" stop-color="var(--c)" stop-opacity="0"/></linearGradient></defs>
    <line class="grid-l" x1="${P}" x2="${W - P}" y1="${H - 22}" y2="${H - 22}"/>
    <path d="${line(past)}L${x(now).toFixed(1)} ${H - 22}L${x(from).toFixed(1)} ${H - 22}Z" fill="url(#${id}-g)"/>
    <path d="${line(past)}" fill="none" stroke="var(--c)" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="${line(fut)}" fill="none" stroke="var(--c)" stroke-width="2.2" stroke-dasharray="2 5" stroke-linecap="round" opacity=".7"/>
    ${marks}
    <line class="guide" y1="4" y2="${H - 22}"/><circle class="hdot" r="6" fill="var(--c)" stroke="var(--card)" stroke-width="2.5"/>
    <text x="${P}" y="${H - 1}">il y a 3 sem.</text><text x="${x(now).toFixed(1)}" y="${H - 1}" text-anchor="middle">aujourd’hui</text><text x="${W - P}" y="${H - 1}" text-anchor="end">+7 j</text>
  </svg>`;
}

/* ---------- Réglages ---------- */
function vSettings() {
  const ts = S.treatments, withLast = active().filter(t => injOf(t.id).length);
  return `<h1 class="lt">Réglages</h1>
  <p class="lab" style="margin-top:4px">Profil</p>
  <div class="group">
    <div class="frow"><label for="p-name">Prénom</label><input id="p-name" data-prof="name" value="${esc(S.profile.name)}" placeholder="Facultatif" autocomplete="given-name" enterkeyhint="done"></div>
    <div class="frow"><label for="p-height">Taille</label><input id="p-height" data-prof="height" inputmode="decimal" value="${esc(S.profile.height)}" placeholder="–" enterkeyhint="done"><span class="unit">cm</span></div>
    <div class="frow"><label for="p-goal">Objectif de poids</label><input id="p-goal" data-prof="goal" inputmode="decimal" value="${esc(S.profile.goal)}" placeholder="–" enterkeyhint="done"><span class="unit">kg</span></div>
  </div>
  <p class="lab">Traitements</p>
  <div class="group">
    ${ts.map(t => `<button class="row" data-act="editT" data-id="${t.id}"><span class="dot" style="background:${esc(t.color)}"></span><span class="t"><b>${esc(t.name)}${t.archived ? ' (arrêté)' : ''}</b><span>${t.molecule ? esc(t.molecule) + ', ' : ''}${freqTxt(num(t.intervalDays))}${t.stock !== '' && t.stock != null ? ', ' + fr(t.stock, 0) + ' en stock' : ''}</span></span>${ic('chev', 'chev')}</button>`).join('')}
    <button class="row accent" data-act="newT">${ic('plus', 'ri')}Ajouter un traitement</button>
  </div>
  ${withLast.length ? `<p class="lab">Rappels</p><div class="group">${withLast.map(t => `<button class="row accent" data-act="ics" data-id="${t.id}">${ic('bell', 'ri')}Rappels ${esc(t.name)} dans mon calendrier</button>`).join('')}</div><p class="foot-note">Ajoute à ton calendrier une alerte qui se répète, calée sur ta prochaine injection.</p>` : ''}
  <p class="lab">Mes données</p>
  <div class="group">
    <button class="row accent" data-act="exp">${ic('share', 'ri')}Exporter une sauvegarde</button>
    <button class="row accent" data-act="csv">${ic('table', 'ri')}Exporter en tableau (CSV)</button>
    <button class="row accent" data-act="imp">${ic('restore', 'ri')}Restaurer une sauvegarde</button>
    <button class="row danger" data-act="wipe">${ic('trash', 'ri')}Tout effacer</button>
  </div>
  <p class="foot-note">Tes données restent sur cet appareil, dans ce navigateur. Rien n’est envoyé. Exporte une sauvegarde de temps en temps : effacer les données du navigateur efface aussi ton carnet.</p>
  <p class="foot-note" style="margin-top:22px">Cadence est un carnet de suivi personnel. Il ne fournit ni diagnostic ni conseil de dosage : pour toute question sur ton traitement, adresse-toi à ton médecin ou ton pharmacien.</p>`;
}

/* ---------- Feuilles ---------- */
const topS = () => stack[stack.length - 1];
const q = s => topS() && topS().querySelector(s);
function openSheet({ title = '', left = 'Annuler', right = '', rightAct = '', body = '', foot = '', small = false, color = '' }) {
  const el = document.createElement('div');
  el.className = 'sheet' + (small ? ' small' : '');
  if (color) el.style.setProperty('--c', color);
  el.innerHTML = `<div class="bg" data-close></div><div class="box" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="drag"><div class="grab"><i></i></div><div class="nav"><button class="l" data-close>${left}</button><div class="ttl">${nb(title)}</div>${right ? `<button class="r" data-act="${rightAct}">${right}</button>` : '<span class="r"></span>'}</div></div>
    <div class="body">${body}</div>${foot ? `<div class="foot">${foot}</div>` : ''}</div>`;
  document.body.appendChild(el); stack.push(el); document.body.classList.add('locked');
  el.getBoundingClientRect(); requestAnimationFrame(() => el.classList.add('on'));
  dragify(el);
  return el;
}
function closeSheet(instant) {
  const el = stack.pop(); if (!el) return;
  if (instant === true) el.remove(); else { el.classList.remove('on'); setTimeout(() => el.remove(), 420); }
  if (!stack.length) document.body.classList.remove('locked');
}
function dragify(el) {
  const box = $('.box', el), h = $('.drag', el); let y0 = null, dy = 0;
  h.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; y0 = e.clientY; dy = 0; box.style.transition = 'none'; try { h.setPointerCapture(e.pointerId); } catch (x) { } });
  h.addEventListener('pointermove', e => { if (y0 === null) return; dy = Math.max(0, e.clientY - y0); box.style.transform = `translateY(${dy}px)`; });
  const end = () => { if (y0 === null) return; y0 = null; box.style.transition = ''; box.style.transform = ''; if (dy > 110 && topS() === el) closeSheet(); };
  h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
}
function confirmSheet(title, msg, okLabel, onOk) {
  const el = openSheet({ title, small: true, body: `<p class="confirm-msg">${nb(msg)}</p><div class="stack"><button class="btn danger" data-act="confirmOk">${okLabel}</button><button class="btn plain" data-close>Annuler</button></div>` });
  el._ok = onOk;
}
function toast(m, err) {
  const t = $('#toast'); t.className = err ? 'err' : ''; t.innerHTML = ic(err ? 'alert' : 'check') + esc(m);
  requestAnimationFrame(() => t.classList.add('on')); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2300);
}

function fFab() {
  const t = T(focusT) || active()[0], st = t ? status(t) : {}, w = weightsAsc().pop();
  openSheet({
    title: 'Ajouter', small: true, body: `<div class="group">
    <button class="add-row" data-act="newInj"><span class="bubble" style="--c:${t ? esc(t.color) : 'var(--inj)'}">${ic('pen')}</span><span><b>Injection</b><span>${!t ? 'Ajoute d’abord un traitement' : st.last ? (st.dueIn < 0 ? 'En retard de ' + (-st.dueIn) + ' j' : st.dueIn === 0 ? 'Prévue aujourd’hui' : 'Prochaine ' + relDay(new Date(st.due))) : 'Note ta première injection'}</span></span></button>
    <button class="add-row" data-act="newW"><span class="bubble" style="--c:var(--poids)">${ic('scale')}</span><span><b>Poids</b><span>${w ? 'Dernière pesée : ' + fr1(w.kg) + ' kg, ' + relDay(w.date) : 'Note ta première pesée'}</span></span></button>
    <button class="add-row" data-act="newS"><span class="bubble" style="--c:var(--ress)">${ic('face')}</span><span><b>Ressenti</b><span>Effets, appétit, énergie</span></span></button>
  </div>` });
}

/* Injection */
function injBody(t) {
  const act = active(), last = injOf(t.id)[0], rot = rotation(t.id), p = PRESETS.find(x => x.key === t.preset);
  const doses = [...new Set([...(p && p.key !== 'custom' ? p.doses : []), ...injOf(t.id).slice(0, 6).map(i => i.dose)])].sort((a, b) => a - b);
  const sel = last ? last.dose : null, u = esc(t.unit);
  return `<input type="hidden" id="i-t" value="${t.id}">
  ${act.length > 1 ? `<div class="seg" style="margin:4px 0 4px">${act.map(x => `<button data-injt="${x.id}" aria-pressed="${x.id === t.id}">${esc(x.name)}</button>`).join('')}</div>` : ''}
  <p class="lab">Dose</p>
  ${doses.length ? `<div class="pills" id="i-pills" data-v="${sel ?? ''}">${doses.map(d => `<button class="pill" data-dose="${d}" aria-pressed="${d === sel}">${fr(d, 3)}<small>${u}</small></button>`).join('')}</div>` : ''}
  <div class="group" style="margin-top:${doses.length ? 8 : 0}px"><div class="frow"><label for="i-dose">${doses.length ? 'Autre dose' : 'Dose injectée'}</label><input id="i-dose" inputmode="decimal" placeholder="${doses.length ? '–' : 'selon ta prescription'}" enterkeyhint="done"><span class="unit">${u}</span></div></div>
  <p class="lab">Zone d’injection</p>
  <div class="figwrap" id="i-body" data-sel="${rot.next}"><span class="side l">Droite</span><span class="side r">Gauche</span>${figure(rot, rot.next)}
    <p class="figcap" id="i-cap">${siteCap(t.id, rot.next, rot)}</p>
    <div class="legend"><span><i></i>Conseillée</span>${rot.last ? '<span><i class="l"></i>Dernière utilisée</span>' : ''}</div></div>
  <p class="lab">Quand</p>
  <div class="group"><div class="frow"><span class="k">Date et heure</span><span style="flex:1"></span><span class="chip">${ic('cal')}<span id="i-when">Maintenant</span><input type="datetime-local" id="i-date" value="${isoLocal()}" max="${isoLocal(new Date(Date.now() + 6e4))}" aria-label="Date et heure de l’injection"></span></div>
  <div class="frow"><input id="i-note" class="left" placeholder="Ajouter une note (stylo, ressenti…)" maxlength="140" enterkeyhint="done"></div></div>`;
}
function siteCap(tid, id, rot) {
  const n = lastUse(tid, id);
  const sub = id === rot.next ? (n === null ? 'Conseillée : pas encore utilisée' : `Conseillée : dernière fois il y a ${n} j`) : n === null ? 'Pas encore utilisée' : n === 0 ? 'Déjà utilisée aujourd’hui' : `Utilisée il y a ${n} j`;
  return `${siteLabel(id)}<span>${sub}</span>`;
}
function fInj(tid) {
  const act = active();
  if (!act.length) { toast('Ajoute d’abord un traitement', true); return fT(); }
  const t = T(tid) && !T(tid).archived ? T(tid) : (T(focusT) || act[0]);
  openSheet({ title: 'Injection', body: injBody(t), foot: `<button class="btn" data-act="saveInj">Enregistrer l’injection</button>`, color: t.color });
}

/* Poids */
function rulerHtml(v) {
  const min = Math.max(20, Math.floor(v) - 40), max = Math.min(300, Math.ceil(v) + 40);
  let lab = ''; for (let k = min; k <= max; k++) lab += `<span style="left:${(k - min) * 100}px">${k}</span>`;
  return `<div class="ruler" data-min="${min}" data-max="${max}"><div class="sc"><div class="rw"><div class="sp"></div><div class="track" style="width:${(max - min) * 100 + 2}px">${lab}</div><div class="sp"></div></div></div><i class="needle"></i></div>`;
}
function initRuler(root, input, v, cb) {
  const r = $('.ruler', root), sc = $('.sc', r), min = +r.dataset.min, max = +r.dataset.max;
  const w = sc.clientWidth / 2; $$('.sp', r).forEach(s => s.style.width = w + 'px');
  let lock = 0, tm;
  const go = (x, smooth) => { lock = Date.now() + (smooth ? 400 : 60); sc.scrollTo({ left: (x - min) * 100, behavior: smooth ? 'smooth' : 'auto' }); };
  const val = () => Math.min(max, Math.max(min, Math.round((min + sc.scrollLeft / 100) * 10) / 10));
  go(v); input.value = fr1(v); cb && cb(v);
  sc.addEventListener('scroll', () => {
    if (Date.now() > lock) { const x = val(); input.value = fr1(x); cb && cb(x); }
    clearTimeout(tm); tm = setTimeout(() => { if (Date.now() > lock) go(val(), true); }, 150);
  }, { passive: true });
  input.addEventListener('input', () => { const x = num(input.value); if (x >= min && x <= max) go(x, true); if (x > 0) cb && cb(x); });
  input.addEventListener('focus', () => input.select());
  input.addEventListener('blur', () => { const x = num(input.value); if (x > 0) input.value = fr1(x); });
}
function fW() {
  const l = weightsAsc().pop(), v = l ? l.kg : (num(S.profile.goal) > 0 ? num(S.profile.goal) + 8 : 70);
  const el = openSheet({
    title: 'Poids', color: 'var(--poids)',
    body: `<div class="big-num"><input id="w-kg" inputmode="decimal" aria-label="Poids en kilos" enterkeyhint="done"><span>kg</span></div>
    <p class="hint">${l ? `Dernière pesée : ${fr1(l.kg)} kg, ${relDay(l.date)}` : 'Fais glisser la règle ou tape ton poids'}</p>
    <div id="w-r">${rulerHtml(v)}</div>
    <div class="center"><span class="chip">${ic('cal')}<span id="w-when">Aujourd’hui</span><input type="date" id="w-date" value="${today()}" max="${today()}" aria-label="Date de la pesée"></span></div>`,
    foot: `<button class="btn poids" data-act="saveW">Enregistrer</button>`
  });
  initRuler($('#w-r', el), $('#w-kg', el), v);
}

/* Ressentis */
function fS() {
  openSheet({
    title: 'Ressenti', color: 'var(--ress)',
    body: `<p class="lab">Comment tu te sens&#8239;?</p><div class="feel" id="s-feel">${FEEL.map(([k, e]) => `<button data-feel="${esc(k)}" aria-pressed="false"><span class="e">${e}</span>${esc(k)}</button>`).join('')}</div>
    <div id="s-lvl-w" hidden><p class="lab">Intensité</p><div class="seg" id="s-lvl">${[1, 2, 3].map(l => `<button data-lvl="${l}" aria-pressed="${l === 1}">${LEVELS[l]}</button>`).join('')}</div></div>
    <p class="lab">Détails</p><div class="group"><div class="frow"><span class="k">Date</span><span style="flex:1"></span><span class="chip">${ic('cal')}<span id="s-when">Aujourd’hui</span><input type="date" id="s-date" value="${today()}" max="${today()}" aria-label="Date"></span></div>
    <div class="frow"><input id="s-note" class="left" placeholder="Ajouter une note" maxlength="140" enterkeyhint="done"></div></div>`,
    foot: `<button class="btn ress" data-act="saveS" disabled>Choisis au moins un ressenti</button>`
  });
}

/* Traitements */
function tFields(v) {
  return `<div class="group">
    <div class="frow"><label for="t-name">Nom</label><input id="t-name" value="${esc(v.name)}" placeholder="Nom du produit" maxlength="40" enterkeyhint="next"></div>
    <div class="frow"><label for="t-mol">Molécule</label><input id="t-mol" value="${esc(v.molecule)}" placeholder="Facultatif" maxlength="40"></div>
    <div class="frow"><label for="t-unit">Unité</label><select id="t-unit">${['mg', 'µg', 'UI', 'mL'].map(u => `<option ${u === v.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
    <div class="frow"><label for="t-int">Une injection tous les</label><input id="t-int" inputmode="decimal" value="${esc(v.intervalDays)}"><span class="unit">jours</span></div>
    <div class="frow"><label for="t-stock">Doses en stock</label><input id="t-stock" inputmode="numeric" value="${esc(v.stock ?? '')}" placeholder="Facultatif"></div>
  </div>
  <p class="lab">Courbe de niveau estimé</p>
  <div class="group">
    <div class="frow"><label for="t-hl">Demi-vie</label><input id="t-hl" inputmode="decimal" value="${esc(v.halfLifeH)}" placeholder="Facultatif"><span class="unit">h</span></div>
    <div class="frow"><label for="t-tmax">Pic après injection</label><input id="t-tmax" inputmode="decimal" value="${esc(v.tmaxH)}" placeholder="Facultatif"><span class="unit">h</span></div>
  </div>
  <p class="foot-note">Valeurs indicatives, à vérifier sur la notice. Elles servent seulement à tracer une courbe théorique.</p>
  <p class="lab">Couleur</p>
  <div class="group swatches" id="t-col">${COLORS.map(c => `<button data-color="${c}" style="--sw:${c}" aria-pressed="${c === v.color}" aria-label="Couleur ${c}"></button>`).join('')}</div>`;
}
function fT(id) {
  const t = id ? T(id) : null;
  if (t) return openSheet({
    title: esc(t.name), right: 'OK', rightAct: 'saveT',
    body: `<input type="hidden" id="t-id" value="${t.id}"><input type="hidden" id="t-preset" value="${esc(t.preset || 'custom')}"><p class="lab">Traitement</p>${tFields(t)}
    <div class="group" style="margin-top:24px"><button class="row accent" data-act="archT" data-id="${t.id}">${ic(t.archived ? 'restore' : 'pause', 'ri')}${t.archived ? 'Reprendre ce traitement' : 'Marquer comme arrêté'}</button><button class="row danger" data-act="delT" data-id="${t.id}">${ic('trash', 'ri')}Supprimer le traitement</button></div>`
  });
  openSheet({
    title: 'Nouveau traitement', right: 'Ajouter', rightAct: 'saveT',
    body: `<input type="hidden" id="t-id" value=""><input type="hidden" id="t-preset" value="mounjaro">
    <div class="hscroll" id="t-pre" style="margin-top:6px">${PRESETS.map((p, i) => `<button class="chip" data-preset="${p.key}" aria-pressed="${i === 0}">${p.name || 'Peptide ou autre'}</button>`).join('')}</div>
    <p class="lab">Traitement</p><div id="t-fields">${tFields(Object.assign({ stock: '' }, PRESETS[0]))}</div>`
  });
}

/* Détail d'une entrée du journal */
function fEntry(kind, id) {
  const o = S[kind].find(x => x.id === id); if (!o) return;
  let title, lines;
  if (kind === 'injections') { const t = T(o.tid) || { name: 'Injection', unit: '' }; title = esc(t.name); lines = [['Dose', fmtDose(o.dose, esc(t.unit))], ['Date', cap(relDay(o.date)) + ' à ' + tfmt(o.date)], ['Zone', o.site ? siteLabel(o.site) : '–']]; if (o.note) lines.push(['Note', esc(o.note)]); }
  else if (kind === 'weights') { title = 'Poids'; lines = [['Poids', fr1(o.kg) + ' kg'], ['Date', cap(dfmt(o.date))]]; }
  else { title = esc(o.type); lines = [['Intensité', o.level ? LEVELS[o.level] : '–'], ['Date', cap(dfmt(o.date))]]; if (o.note) lines.push(['Note', esc(o.note)]); }
  openSheet({ title, left: 'Fermer', small: true, body: `<div class="group" style="margin-top:6px">${lines.map(([k, v]) => `<div class="frow"><span class="k">${k}</span><span style="flex:1;text-align:right;color:var(--label2)">${v}</span></div>`).join('')}</div><div class="group" style="margin-top:20px"><button class="row danger" data-act="delEntry" data-id="${kind}:${id}">${ic('trash', 'ri')}Supprimer cette entrée</button></div>` });
}

/* ---------- Démarrage ---------- */
const OBS = ['welcome', 'name', 'treat', 'dose', 'last', 'weight', 'goal', 'consent'];
const obP = () => PRESETS.find(p => p.key === ob.preset) || PRESETS[0];
function vOnboard() {
  if (!ob) ob = { name: S.profile.name || '', preset: 'mounjaro', cname: '', cunit: 'mg', cint: '7', dose: null, last: null, lastDate: '', weight: null, goal: null, ok: false };
  const s = OBS[obStep], anim = obShown !== obStep ? ' anim' : ''; obShown = obStep;
  if (s === 'welcome') return `<div class="ob splash"><div class="step${anim}">
    <svg class="logo" viewBox="0 0 96 96" aria-hidden="true">${[0, 1, 2, 3, 4, 5, 6].map(i => { const st = 360 / 7, g = 20; return `<path class="arc${i < 5 ? ' done' : ''}" d="${arcPath(48, 48, 40, -90 + i * st + g / 2, -90 + (i + 1) * st - g / 2)}" style="animation-delay:${i * 70}ms"/>`; }).join('')}</svg>
    <h1>Cadence</h1><p class="sub">Ton carnet de traitement GLP-1 et peptides, simple et privé.</p>
    <div class="feat"><span class="bubble" style="--c:var(--inj)">${ic('pen')}</span><div><b>Injections et rotation</b><span>Le compte à rebours, la dose et la prochaine zone en un coup d’œil.</span></div></div>
    <div class="feat"><span class="bubble" style="--c:var(--poids)">${ic('progress')}</span><div><b>Poids et ressentis</b><span>Tes courbes et un journal clair à montrer à ton médecin.</span></div></div>
    <div class="feat"><span class="bubble" style="--c:var(--niv)">${ic('lock')}</span><div><b>Rien ne quitte ton téléphone</b><span>Pas de compte, pas de serveur. Tu exportes ou effaces quand tu veux.</span></div></div>
    </div><div class="grow"></div><div class="cta"><button class="btn" data-act="obNext">Commencer</button></div></div>`;
  const p = obP(), u = p.key === 'custom' ? ob.cunit : p.unit, tname = p.key === 'custom' ? ob.cname.trim() : p.name;
  let title, sub = '', body = '', cta = 'Continuer', act = 'obNext', dis = false, skip = '';
  if (s === 'name') { title = 'Comment tu t’appelles ?'; sub = 'Juste pour te dire bonjour.'; body = `<input class="field" data-ob="name" value="${esc(ob.name)}" placeholder="Ton prénom" autocomplete="given-name" enterkeyhint="next">`; skip = 'Passer'; }
  if (s === 'treat') {
    title = 'Quel traitement suis-tu ?'; sub = 'Tu pourras en ajouter d’autres ensuite.';
    body = PRESETS.map(x => `<button class="choice" data-obp="${x.key}" aria-pressed="${ob.preset === x.key}"><span class="dot" style="background:${x.color}"></span><span class="t"><b>${x.name || 'Un peptide ou autre'}</b><span>${x.key === 'custom' ? 'Tu définis le nom, l’unité et le rythme' : `${x.molecule}, ${freqTxt(x.intervalDays)}`}</span></span><span class="ck">${ic('check')}</span></button>`).join('');
    if (ob.preset === 'custom') body += `<div class="group"><div class="frow"><label for="ob-cn">Nom</label><input id="ob-cn" data-ob="cname" value="${esc(ob.cname)}" placeholder="Ex. BPC-157" maxlength="40"></div><div class="frow"><label for="ob-cu">Unité</label><select id="ob-cu" data-ob="cunit">${['mg', 'µg', 'UI', 'mL'].map(x => `<option ${x === ob.cunit ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="frow"><label for="ob-ci">Une injection tous les</label><input id="ob-ci" data-ob="cint" inputmode="decimal" value="${esc(ob.cint)}"><span class="unit">jours</span></div></div>`;
    dis = ob.preset === 'custom' && (!ob.cname.trim() || !(num(ob.cint) > 0));
  }
  if (s === 'dose') {
    title = `Ta dose actuelle${tname ? ' de ' + esc(tname) : ''} ?`; sub = 'Celle de ta prescription.';
    const ds = p.key === 'custom' ? [] : p.doses;
    body = (ds.length ? `<div class="pills">${ds.map(d => `<button class="pill" data-obdose="${d}" aria-pressed="${ob.dose === d}">${fr(d, 3)}<small>${u}</small></button>`).join('')}</div>` : '') +
      `<div class="group"><div class="frow"><label for="ob-d">${ds.length ? 'Autre dose' : 'Dose'}</label><input id="ob-d" data-ob="doseTxt" inputmode="decimal" value="${ob.dose && !ds.includes(ob.dose) ? String(ob.dose).replace('.', ',') : ''}" placeholder="–"><span class="unit">${esc(u)}</span></div></div>`;
    dis = !(ob.dose > 0); skip = 'Je n’ai pas encore de dose';
  }
  if (s === 'last') {
    title = 'Ta dernière injection ?'; sub = 'Pour lancer le compte à rebours.';
    const n = p.key === 'custom' ? Math.round(num(ob.cint) || 7) : p.intervalDays;
    const opts = [['none', 'Je n’ai pas encore commencé'], [0, 'Aujourd’hui'], [1, 'Hier']];
    for (let i = 2; i < Math.min(n, 7); i++) opts.push([i, cap(dfmt(new Date(Date.now() - i * DAY)))]);
    opts.push(['date', 'Une autre date']);
    body = opts.map(([k, l]) => `<button class="choice" data-oblast="${k}" aria-pressed="${String(ob.last) === String(k)}"><span class="t"><b>${l}</b></span><span class="ck">${ic('check')}</span></button>`).join('');
    if (ob.last === 'date') body += `<div class="group"><div class="frow"><label for="ob-ld">Date</label><input type="date" id="ob-ld" data-ob="lastDate" value="${ob.lastDate}" max="${today()}"></div></div>`;
    dis = ob.last === null || (ob.last === 'date' && !ob.lastDate);
  }
  if (s === 'weight' || s === 'goal') {
    const isW = s === 'weight', lw = weightsAsc().pop();
    if (isW && ob.weight == null) ob.weight = lw ? lw.kg : 70;
    if (!isW && ob.goal == null) ob.goal = Math.round((ob.weight || 70) - 8);
    title = isW ? 'Ton poids aujourd’hui ?' : 'Un objectif en tête ?';
    sub = isW ? 'Ce sera ton point de départ.' : 'Tu pourras le changer quand tu veux.';
    body = `<div class="big-num"><input id="ob-kg" inputmode="decimal" aria-label="Poids en kilos"><span>kg</span></div><div id="ob-r" style="--c:var(--poids)">${rulerHtml(isW ? ob.weight : ob.goal)}</div>`;
    skip = isW ? 'Passer' : 'Pas d’objectif pour l’instant';
    mounts.push(() => initRuler($('#ob-r'), $('#ob-kg'), isW ? ob.weight : ob.goal, x => { if (isW) ob.weight = x; else ob.goal = x; }));
  }
  if (s === 'consent') {
    title = 'Avant de commencer';
    body = `<div class="info">${ic('heart')}<div><b>Un carnet, pas un médecin</b><span>Cadence ne recommande aucune dose. Les doses et le rythme sont ceux de ta prescription.</span></div></div>
    <div class="info">${ic('lock')}<div><b>Tes données restent ici</b><span>Elles sont enregistrées dans ce navigateur, sur ce téléphone, et nulle part ailleurs.</span></div></div>
    <button class="switch-row" data-act="obOk" role="switch" aria-checked="${ob.ok}" style="margin-top:6px"><span>J’ai compris que Cadence ne remplace pas un avis médical.</span><i class="switch"></i></button>`;
    cta = 'C’est parti'; act = 'obDone'; dis = !ob.ok;
  }
  return `<div class="ob"><div class="obtop"><button class="back" data-act="obBack" aria-label="Retour">${ic('back')}</button><div class="prog"><i style="width:${(obStep / (OBS.length - 1) * 100).toFixed(0)}%"></i></div></div>
  <div class="step${anim}"><h1>${nb(title)}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}${body}</div><div class="grow"></div>
  <div class="cta"><button class="btn" id="ob-cta" data-act="${act}" ${dis ? 'disabled' : ''}>${cta}</button>${skip ? `<button class="linkbtn" data-act="obSkip">${skip}</button>` : ''}</div></div>`;
}
function obGo(d) {
  let i = obStep + d;
  if (OBS[i] === 'last' && !(ob.dose > 0)) i += d;
  obStep = Math.max(0, Math.min(OBS.length - 1, i)); render(); scrollTo(0, 0);
}
function obCta() {
  const b = $('#ob-cta'); if (!b) return;
  const s = OBS[obStep], p = obP();
  let dis = false;
  if (s === 'treat') dis = p.key === 'custom' && (!ob.cname.trim() || !(num(ob.cint) > 0));
  if (s === 'dose') dis = !(ob.dose > 0);
  if (s === 'last') dis = ob.last === null || (ob.last === 'date' && !ob.lastDate);
  b.disabled = dis;
}
function obDone() {
  const p = obP(), c = p.key === 'custom';
  const t = { id: uid(), name: c ? ob.cname.trim() : p.name, molecule: p.molecule, unit: c ? ob.cunit : p.unit, intervalDays: c ? num(ob.cint) : p.intervalDays, halfLifeH: p.halfLifeH, tmaxH: p.tmaxH, color: p.color, stock: '', preset: p.key, archived: false };
  S.treatments.push(t); focusT = t.id;
  if (ob.dose > 0 && ob.last !== null && ob.last !== 'none') {
    let d;
    if (ob.last === 'date') d = ob.lastDate + 'T09:00';
    else if (+ob.last === 0) d = isoLocal();
    else d = isoLocal(new Date(Date.now() - ob.last * DAY)).slice(0, 10) + 'T09:00';
    S.injections.push({ id: uid(), tid: t.id, dose: ob.dose, date: d, site: '', note: '' });
  }
  if (ob.weight > 0) { S.weights = S.weights.filter(w => w.date !== today()); S.weights.push({ id: uid(), date: today(), kg: ob.weight }); }
  S.profile.name = ob.name.trim();
  if (ob.goal > 0) S.profile.goal = String(ob.goal).replace('.', ',');
  S.onboarded = true; save(); ob = null; obStep = 0; obShown = -1; tab = 'home'; firstHome = true;
  render(); scrollTo(0, 0); toast('C’est prêt');
}

/* ---------- Actions ---------- */
function closeAllThen(f) { if (stack.length) { while (stack.length) closeSheet(); setTimeout(f, 220); } else f(); }
const A = {
  fab: fFab,
  newInj(id) { closeAllThen(() => fInj(id)); },
  newW() { closeAllThen(fW); },
  newS() { closeAllThen(fS); },
  newT() { closeAllThen(() => fT()); },
  editT(id) { closeAllThen(() => fT(id)); },
  saveInj() {
    const tid = q('#i-t').value, typed = num(q('#i-dose').value), pill = q('#i-pills') ? num(q('#i-pills').dataset.v) : NaN;
    const dose = typed > 0 ? typed : pill, date = q('#i-date').value;
    if (!(dose > 0)) return toast('Choisis la dose injectée', true);
    if (!date) return toast('Indique la date', true);
    S.injections.push({ id: uid(), tid, dose, date, site: q('#i-body').dataset.sel || '', note: q('#i-note').value.trim() });
    const t = T(tid); if (t.stock !== '' && t.stock != null) t.stock = Math.max(0, num(t.stock) - 1);
    focusT = tid; save(); closeSheet(); render(); toast('Injection enregistrée');
  },
  saveW() {
    const kg = num(q('#w-kg').value), date = q('#w-date').value || today();
    if (!(kg >= 20 && kg <= 350)) return toast('Indique un poids en kg', true);
    S.weights = S.weights.filter(w => w.date !== date); S.weights.push({ id: uid(), date, kg: Math.round(kg * 10) / 10 });
    save(); closeSheet(); render(); toast('Poids enregistré');
  },
  saveS() {
    const sel = $$('#s-feel [aria-pressed="true"]', topS()).map(b => b.dataset.feel); if (!sel.length) return;
    const lb = q('#s-lvl [aria-pressed="true"]'), lv = lb ? +lb.dataset.lvl : 1, date = q('#s-date').value || today(), note = q('#s-note').value.trim();
    sel.forEach(type => S.symptoms.push({ id: uid(), date, type, level: type === GOOD ? 0 : lv, note }));
    save(); closeSheet(); render(); toast(sel.length > 1 ? 'Ressentis enregistrés' : 'Ressenti enregistré');
  },
  saveT() {
    const name = q('#t-name').value.trim(), int = num(q('#t-int').value);
    if (!name) return toast('Donne un nom au traitement', true);
    if (!(int > 0)) return toast('Indique le rythme des injections', true);
    const hl = num(q('#t-hl').value), tm = num(q('#t-tmax').value), st = q('#t-stock').value.trim(), col = q('#t-col [aria-pressed="true"]');
    const d = { name, molecule: q('#t-mol').value.trim(), unit: q('#t-unit').value, intervalDays: int, halfLifeH: hl > 0 ? hl : '', tmaxH: tm > 0 ? tm : '', stock: st === '' || isNaN(num(st)) ? '' : Math.max(0, Math.round(num(st))), color: col ? col.dataset.color : COLORS[0], preset: q('#t-preset').value };
    const id = q('#t-id').value;
    if (id) Object.assign(T(id), d); else { d.id = uid(); d.archived = false; S.treatments.push(d); focusT = d.id; }
    save(); closeSheet(); render(); toast(id ? 'Traitement modifié' : 'Traitement ajouté');
  },
  archT(id) { const t = T(id); t.archived = !t.archived; save(); closeSheet(); render(); toast(t.archived ? 'Traitement arrêté' : 'Traitement repris'); },
  delT(id) {
    const n = S.injections.filter(i => i.tid === id).length;
    confirmSheet('Supprimer ce traitement ?', n ? `Ses ${n} injection${n > 1 ? 's' : ''} ser${n > 1 ? 'ont' : 'a'} aussi supprimée${n > 1 ? 's' : ''}. Pour garder l’historique, marque-le plutôt comme arrêté.` : 'Cette action est définitive.', 'Supprimer', () => {
      S.treatments = S.treatments.filter(t => t.id !== id); S.injections = S.injections.filter(i => i.tid !== id); save(); while (stack.length) closeSheet(); render(); toast('Traitement supprimé');
    });
  },
  delEntry(ref) { const [k, id] = ref.split(':'); S[k] = S[k].filter(x => x.id !== id); save(); closeSheet(); render(); toast('Entrée supprimée'); },
  confirmOk() { const f = topS() && topS()._ok; f && f(); },
  ics(id) {
    const t = T(id), st = status(t); if (!st.last) return toast('Note d’abord une injection', true);
    const d = new Date(st.due), f = x => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`, clean = s => String(s).replace(/[,;\\\n]/g, ' ');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cadence//FR', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', 'UID:' + uid() + '@cadence', 'DTSTAMP:' + f(new Date()), 'DTSTART:' + f(d), 'DTEND:' + f(new Date(d.getTime() + 15 * 6e4)), `RRULE:FREQ=DAILY;INTERVAL=${st.n}`, 'SUMMARY:Injection ' + clean(t.name), 'DESCRIPTION:Rappel Cadence', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Injection ' + clean(t.name), 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    if (IOS) location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
    else dl('rappel-' + t.name.toLowerCase().replace(/\W+/g, '-') + '.ics', ics, 'text/calendar');
  },
  exp() { give(`cadence-${today()}.json`, JSON.stringify(S, null, 2), 'application/json'); },
  csv() {
    const c = v => '"' + String(v ?? '').replace(/"/g, '""') + '"', rows = [['type', 'date', 'traitement', 'valeur', 'unite', 'detail', 'note']];
    S.injections.forEach(i => { const t = T(i.tid) || {}; rows.push(['injection', i.date.replace('T', ' '), t.name, String(i.dose).replace('.', ','), t.unit, siteLabel(i.site), i.note]); });
    S.weights.forEach(w => rows.push(['poids', w.date, '', String(w.kg).replace('.', ','), 'kg', '', '']));
    S.symptoms.forEach(s => rows.push(['ressenti', s.date, '', s.level, '/3', s.type, s.note]));
    give(`cadence-${today()}.csv`, '﻿' + rows.map(r => r.map(c).join(';')).join('\n'), 'text/csv');
  },
  imp() { $('#file').click(); },
  wipe() { confirmSheet('Tout effacer ?', 'Traitements, injections, pesées et ressentis seront supprimés de cet appareil. Exporte une sauvegarde avant si tu veux les garder.', 'Tout effacer', () => { localStorage.removeItem(KEY); S = blank(); tab = 'home'; while (stack.length) closeSheet(true); document.body.classList.remove('locked'); render(); }); },
  obNext() { obGo(1); }, obBack() { obGo(-1); },
  obSkip() { const s = OBS[obStep]; if (s === 'name') ob.name = ''; if (s === 'dose') ob.dose = null; if (s === 'weight') ob.weight = null; if (s === 'goal') ob.goal = null; obGo(1); },
  obOk() { ob.ok = !ob.ok; const b = $('.switch-row'); b.setAttribute('aria-checked', ob.ok); $('#ob-cta').disabled = !ob.ok; },
  obDone
};
function dl(name, data, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); }
async function give(name, data, type) {
  try { const f = new File([data], name, { type }); if (IOS && navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: name }); return; } }
  catch (e) { if (e && e.name === 'AbortError') return; }
  dl(name, data, type);
}

/* ---------- Événements ---------- */
const SEL = '[data-act],[data-close],[data-tab],[data-focus],[data-jf],[data-range],[data-entry],[data-dose],[data-site],[data-feel],[data-lvl],[data-color],[data-injt],[data-preset],[data-obp],[data-obdose],[data-oblast]';
document.addEventListener('click', e => {
  const el = e.target.closest(SEL); if (!el) return;
  const d = el.dataset;
  if (d.act) return A[d.act] && A[d.act](d.id);
  if ('close' in d) return closeSheet();
  if (d.tab) { tab = d.tab; render(); scrollTo(0, 0); return; }
  if (d.focus) { focusT = d.focus; render(); return; }
  if (d.jf) { jFilter = d.jf; render(); return; }
  if (d.range !== undefined) { range = +d.range; render(); return; }
  if (d.entry) { const [k, id] = d.entry.split(':'); return fEntry(k, id); }
  if (d.dose) { const w = el.parentNode; w.dataset.v = d.dose; $$('.pill', w).forEach(b => b.setAttribute('aria-pressed', b === el)); q('#i-dose').value = ''; return; }
  if (d.site) return pickSite(el);
  if (d.feel) {
    const grid = el.parentNode, on = el.getAttribute('aria-pressed') !== 'true';
    if (on) $$('button', grid).forEach(b => { if ((d.feel === GOOD) !== (b.dataset.feel === GOOD)) b.setAttribute('aria-pressed', 'false'); });
    el.setAttribute('aria-pressed', on);
    const sel = $$('[aria-pressed="true"]', grid).map(b => b.dataset.feel), btn = q('[data-act="saveS"]');
    q('#s-lvl-w').hidden = !sel.some(x => x !== GOOD);
    btn.disabled = !sel.length; btn.textContent = sel.length ? 'Enregistrer' : 'Choisis au moins un ressenti';
    return;
  }
  if (d.lvl || d.color) { $$('button', el.parentNode).forEach(b => b.setAttribute('aria-pressed', b === el)); return; }
  if (d.injt) { q('.body').innerHTML = injBody(T(d.injt)); topS().style.setProperty('--c', T(d.injt).color); return; }
  if (d.preset) {
    const p = PRESETS.find(x => x.key === d.preset); $$('.chip', el.parentNode).forEach(b => b.setAttribute('aria-pressed', b === el));
    q('#t-preset').value = p.key; q('#t-fields').innerHTML = tFields(Object.assign({ stock: q('#t-stock').value }, p));
    if (p.key === 'custom') q('#t-name').focus();
    return;
  }
  if (d.obp) { ob.preset = d.obp; ob.dose = null; render(); if (d.obp === 'custom') setTimeout(() => { const i = $('#ob-cn'); i && i.focus(); }, 60); return; }
  if (d.obdose) { ob.dose = +d.obdose; $$('[data-obdose]').forEach(b => b.setAttribute('aria-pressed', b === el)); const i = $('#ob-d'); if (i) i.value = ''; obCta(); return; }
  if (d.oblast) { ob.last = /^\d+$/.test(d.oblast) ? +d.oblast : d.oblast; render(); if (d.oblast === 'date') setTimeout(() => { const i = $('#ob-ld'); i && i.focus(); }, 60); return; }
});
function pickSite(el) {
  const box = el.closest('#i-body'); if (!box) return;
  box.dataset.sel = el.dataset.site;
  $$('.zone', box).forEach(z => { z.classList.toggle('on', z === el); z.setAttribute('aria-pressed', z === el); });
  const tid = q('#i-t').value; $('#i-cap', box).innerHTML = siteCap(tid, el.dataset.site, rotation(tid));
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && stack.length) closeSheet();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('zone')) { e.preventDefault(); pickSite(e.target); }
  if (e.key === 'Enter' && e.target.matches && e.target.matches('.ob input:not([type=date])')) { const b = $('#ob-cta'); if (b && !b.disabled) { e.preventDefault(); b.click(); } }
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.ob) {
    const k = el.dataset.ob;
    if (k === 'doseTxt') { ob.dose = num(el.value) > 0 ? num(el.value) : null; $$('[data-obdose]').forEach(b => b.setAttribute('aria-pressed', 'false')); }
    else ob[k] = el.value;
    return obCta();
  }
  if (el.id === 'i-dose' && num(el.value) > 0) { const w = q('#i-pills'); if (w) { w.dataset.v = ''; $$('.pill', w).forEach(b => b.setAttribute('aria-pressed', 'false')); } }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.prof) { S.profile[el.dataset.prof] = el.value.trim(); save(); toast('Profil enregistré'); return; }
  if (el.dataset.ob) { ob[el.dataset.ob] = el.value; return obCta(); }
  if (el.id === 'i-date') { const v = el.value; q('#i-when').textContent = !v || Math.abs(D(v) - Date.now()) < 3 * 6e4 ? 'Maintenant' : cap(relDay(v)) + ' à ' + tfmt(v); return; }
  if (el.id === 'w-date' || el.id === 's-date') { q(el.id === 'w-date' ? '#w-when' : '#s-when').textContent = el.value ? cap(relDay(el.value)) : 'Aujourd’hui'; return; }
  if (el.id === 'file' && el.files[0]) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result); if (!d || !Array.isArray(d.treatments) || !Array.isArray(d.injections)) throw 0;
        confirmSheet('Restaurer cette sauvegarde ?', `${d.injections.length} injection(s) et ${(d.weights || []).length} pesée(s). Ton carnet actuel sera remplacé.`, 'Restaurer', () => { localStorage.setItem(KEY, JSON.stringify(Object.assign(blank(), d, { onboarded: true }))); S = load(); while (stack.length) closeSheet(); render(); toast('Sauvegarde restaurée'); });
      } catch (x) { toast('Ce fichier n’est pas une sauvegarde Cadence', true); }
      el.value = '';
    };
    r.readAsText(el.files[0]);
  }
});

render();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
