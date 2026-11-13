/* Cadence — suivi GLP-1 et peptides. Tout est stocké sur l'appareil (localStorage). */
'use strict';
const KEY = 'cadence.v1';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fr = (n, d = 1) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: d });
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : NaN; };
const pad = n => String(n).padStart(2, '0');
const nowLocal = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const today = () => nowLocal().slice(0, 10);
const dFmt = (s, o = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(s).toLocaleDateString('fr-FR', o).replace(/\.$/, '');
const tFmt = s => new Date(s).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const DAY = 864e5;

/* Dosages = présentations commercialisées, proposées en raccourci de saisie. */
const PRESETS = [
  { key: 'mounjaro', name: 'Mounjaro', molecule: 'tirzépatide', unit: 'mg', intervalDays: 7, halfLifeH: 120, tmaxH: 24, doses: [2.5, 5, 7.5, 10, 12.5, 15], color: '#F7C948' },
  { key: 'wegovy', name: 'Wegovy', molecule: 'sémaglutide', unit: 'mg', intervalDays: 7, halfLifeH: 168, tmaxH: 48, doses: [0.25, 0.5, 1, 1.7, 2.4], color: '#5FC9B8' },
  { key: 'ozempic', name: 'Ozempic', molecule: 'sémaglutide', unit: 'mg', intervalDays: 7, halfLifeH: 168, tmaxH: 48, doses: [0.25, 0.5, 1, 2], color: '#7FA8FF' },
  { key: 'saxenda', name: 'Saxenda', molecule: 'liraglutide', unit: 'mg', intervalDays: 1, halfLifeH: 13, tmaxH: 11, doses: [0.6, 1.2, 1.8, 2.4, 3], color: '#C59BFF' },
  { key: 'custom', name: '', molecule: '', unit: 'mg', intervalDays: 7, halfLifeH: '', tmaxH: '', doses: [], color: '#FF7A90' }
];
const COLORS = ['#F7C948', '#5FC9B8', '#7FA8FF', '#C59BFF', '#FF7A90', '#FFA35C'];
const SITES = [
  { id: 'vg', label: 'Ventre gauche', x: 88, y: 150 }, { id: 'vd', label: 'Ventre droit', x: 122, y: 150 },
  { id: 'cg', label: 'Cuisse gauche', x: 84, y: 232 }, { id: 'cd', label: 'Cuisse droite', x: 126, y: 232 },
  { id: 'bg', label: 'Bras gauche', x: 50, y: 118 }, { id: 'bd', label: 'Bras droit', x: 160, y: 118 }
];
const SYMPT = ['Nausées', 'Fatigue', 'Constipation', 'Diarrhée', 'Reflux', 'Maux de tête', 'Appétit coupé', 'Fringales', 'Point d\'injection irrité', 'Autre'];
const LEVELS = ['', 'Léger', 'Gênant', 'Fort'];

let S = load();
let tab = 'home', focusT = null;

function blank() { return { v: 1, onboarded: false, profile: { name: '', height: '', goal: '' }, treatments: [], injections: [], weights: [], symptoms: [] }; }
function load() { try { return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { return blank(); } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Enregistrement impossible : stockage plein ou bloqué'); } }
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2400); }

const T = id => S.treatments.find(t => t.id === id);
const active = () => S.treatments.filter(t => !t.archived);
const injOf = id => S.injections.filter(i => i.tid === id).sort((a, b) => a.date < b.date ? 1 : -1);
const sortDesc = a => a.slice().sort((x, y) => x.date < y.date ? 1 : -1);
const siteLabel = id => (SITES.find(s => s.id === id) || {}).label || '';

/* ---------- Niveau estimé (modèle théorique à un compartiment) ---------- */
function kaFor(ke, tmax) {
  let lo = ke * 1.0001, hi = ke * 500;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2, tm = Math.log(m / ke) / (m - ke); tm > tmax ? lo = m : hi = m; }
  return (lo + hi) / 2;
}
function levelAt(t, ms) {
  const hl = num(t.halfLifeH); if (!(hl > 0)) return null;
  const ke = Math.LN2 / hl, tm = num(t.tmaxH), ka = tm > 0 ? kaFor(ke, tm) : null;
  let sum = 0;
  for (const i of S.injections) {
    if (i.tid !== t.id) continue;
    const h = (ms - new Date(i.date).getTime()) / 36e5; if (h < 0) continue;
    sum += ka ? i.dose * ka / (ka - ke) * (Math.exp(-ke * h) - Math.exp(-ka * h)) : i.dose * Math.exp(-ke * h);
  }
  return sum;
}
function nextSite(tid) {
  const used = injOf(tid).map(i => i.site).filter(Boolean);
  let best = SITES[0], bestIdx = -2;
  for (const s of SITES) { const idx = used.indexOf(s.id); const score = idx === -1 ? 1e9 : idx; if (score > bestIdx) { bestIdx = score; best = s; } }
  return { next: best.id, last: used[0] || null };
}
function status(t) {
  const last = injOf(t.id)[0]; if (!last) return { last: null };
  const lastMs = new Date(last.date).getTime(), int = num(t.intervalDays) || 7;
  const due = lastMs + int * DAY, left = due - Date.now();
  return { last, lastMs, due, left, int, elapsed: (Date.now() - lastMs) / DAY };
}

/* ---------- Rendu ---------- */
function render() {
  const app = $('#app'), nav = $('#nav');
  if (!S.onboarded) { nav.hidden = true; app.innerHTML = vWelcome(); return; }
  nav.hidden = false;
  nav.innerHTML = [['home', 'Aujourd\'hui', '<path d="M3 17c3 0 4-10 8-10s4 7 7 7 2-3 4-3"/>'], ['inj', 'Injections', '<path d="M17 3l4 4M19 5l-9 9-3 1 1-3 9-9M6 18l-3 3M10 8l2 2M12.5 5.5l2 2"/>'], ['poids', 'Poids', '<path d="M4 6h16l-1.5 14h-13zM9 6a3 3 0 016 0M12 11v4"/>'], ['ress', 'Ressentis', '<circle cx="12" cy="12" r="9"/><path d="M8.5 15c2 1.6 5 1.6 7 0M9 9.5v.5M15 9.5v.5"/>'], ['regl', 'Réglages', '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>']]
    .map(([k, l, p]) => `<button data-tab="${k}" ${tab === k ? 'aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>${l}</button>`).join('');
  app.innerHTML = ({ home: vHome, inj: vInj, poids: vPoids, ress: vRess, regl: vRegl })[tab]();
}

function vWelcome() {
  return `<section class="welcome">
  <h1>Garde le rythme de ton traitement.</h1>
  <p class="lead">Cadence note tes injections, ton poids et tes ressentis, pour Mounjaro, Wegovy, Ozempic ou n'importe quel peptide.</p>
  <ul>
    <li><b>Rien ne quitte ton téléphone</b>Pas de compte, pas de serveur. Tes données restent dans ce navigateur et tu peux les exporter ou les effacer quand tu veux.</li>
    <li><b>Un carnet, pas un médecin</b>Cadence ne recommande aucune dose. Les doses et le calendrier sont ceux de ta prescription.</li>
  </ul>
  <label class="check"><input type="checkbox" id="ok"><span>J'ai compris que Cadence est un outil de suivi personnel et ne remplace pas un avis médical.</span></label>
  <button class="btn wide" data-act="start">Commencer</button>
  </section>`;
}

function vHome() {
  const act = active();
  const hello = S.profile.name ? `Bonjour ${esc(S.profile.name)}` : 'Bonjour';
  let h = `<header class="top"><div><p>${dFmt(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}</p><h1>${hello}</h1></div></header>`;
  if (!act.length) return h + `<div class="panel empty"><b>Ajoute ton premier traitement</b>Mounjaro, Wegovy, Ozempic, Saxenda ou un peptide que tu définis toi-même.<br><button class="btn" data-act="newT">Ajouter un traitement</button></div>`;
  if (!act.some(t => t.id === focusT)) focusT = act[0].id;
  if (act.length > 1) h += `<div class="tabs-t">${act.map(t => `<button class="chip" data-focus="${t.id}" aria-pressed="${t.id === focusT}">${esc(t.name)}</button>`).join('')}</div>`;
  const t = T(focusT), st = status(t), unit = esc(t.unit);
  let big, sub, cells = '';
  const n = Math.min(Math.max(Math.round(num(t.intervalDays) || 7), 1), 14);
  if (!st.last) { big = 'Prêt à démarrer'; sub = 'Enregistre ta première injection pour lancer le suivi.'; for (let i = 0; i < n; i++) cells += '<i></i>'; }
  else {
    const dl = st.left / DAY, late = dl < 0;
    if (st.int <= 1) { const hl = st.left / 36e5; big = late ? 'À faire' : `Dans ${Math.max(1, Math.round(hl))} h`; }
    else big = late ? (dl > -1 ? 'C\'est le jour' : `${Math.floor(-dl)} j de retard`) : (dl < 1 ? 'Demain' : `Dans ${Math.ceil(dl)} jours`);
    if (!late && dl < 1 && new Date(st.due).toDateString() === new Date().toDateString()) big = 'Aujourd\'hui';
    sub = `Prochaine injection ${dFmt(st.due, { weekday: 'long', day: 'numeric', month: 'long' })}. Dernière : ${fr(st.last.dose, 3)} ${unit}, ${dFmt(st.last.date)}.`;
    const pos = Math.floor(st.elapsed * n / st.int);
    for (let i = 0; i < n; i++) cells += `<i class="${late ? 'late' : i < pos ? 'done' : i === pos ? 'now' : ''}"></i>`;
  }
  h += `<section class="cadence"><div class="who"><span class="dot" style="background:${esc(t.color)}"></span>${esc(t.name)}${t.molecule ? ' (' + esc(t.molecule) + ')' : ''}</div>
  <div class="big">${big}</div><p class="sub">${sub}</p>
  <div class="week" aria-hidden="true">${cells}</div><div class="weeklab"><span>Injection</span><span>${st.int > 1 || !st.last ? 'Prochaine' : '24 h'}</span></div>
  <div class="row"><button class="btn sun" style="flex:1" data-act="newInj" data-id="${t.id}">Noter une injection</button>${st.last ? `<button class="btn ghost" data-act="ics" data-id="${t.id}" aria-label="Ajouter le rappel au calendrier">Rappel</button>` : ''}</div></section>`;
  if (t.stock !== '' && t.stock != null && num(t.stock) <= 1) h += `<p class="note warn">Il te reste ${fr(t.stock, 0)} dose${num(t.stock) > 1 ? 's' : ''} de ${esc(t.name)}. Pense au renouvellement.</p>`;

  // Niveau estimé
  if (st.last && num(t.halfLifeH) > 0) {
    h += `<h2>Niveau estimé</h2><div class="panel">${levelChart(t)}<p class="small muted" style="margin-top:10px">Courbe théorique calculée à partir de la demi-vie (${fr(t.halfLifeH, 0)} h) et de tes injections. Elle ne mesure rien dans ton corps.</p></div>`;
  }
  // Résumé
  const w = sortDesc(S.weights), lastW = w[0], firstW = w[w.length - 1];
  const sy = S.symptoms.filter(s => Date.now() - new Date(s.date).getTime() < 7 * DAY).length;
  h += `<h2>En bref</h2><div class="panel"><div class="kv">
    <div><b>${lastW ? fr(lastW.kg) : '–'}</b><span>kg actuels</span></div>
    <div><b>${lastW && w.length > 1 ? (lastW.kg - firstW.kg > 0 ? '+' : '') + fr(lastW.kg - firstW.kg) : '–'}</b><span>kg depuis le début</span></div>
    <div><b>${sy}</b><span>ressenti${sy > 1 ? 's' : ''} sur 7 j</span></div></div>
    <div class="actions" style="margin-top:14px"><button class="btn soft sm" data-act="newW">Noter mon poids</button><button class="btn soft sm" data-act="newS">Noter un ressenti</button></div></div>`;
  return h;
}

function levelChart(t) {
  const W = 320, H = 130, P = 6, now = Date.now(), from = now - 21 * DAY, to = now + 7 * DAY, N = 140;
  const pts = []; let max = 0;
  for (let i = 0; i <= N; i++) { const ms = from + (to - from) * i / N, v = levelAt(t, Math.min(ms, 1e18)); pts.push([ms, v]); if (v > max) max = v; }
  // au-delà de maintenant : décroissance sans nouvelle injection (levelAt ignore déjà les injections futures)
  if (!max) return '';
  const x = ms => P + (ms - from) / (to - from) * (W - 2 * P), y = v => H - 18 - v / max * (H - 34);
  const path = a => a.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1)).join('');
  const past = pts.filter(p => p[0] <= now), fut = pts.filter(p => p[0] >= now - (to - from) / N);
  const cur = levelAt(t, now);
  const marks = S.injections.filter(i => i.tid === t.id && new Date(i.date) >= from).map(i => `<line x1="${x(new Date(i.date).getTime())}" x2="${x(new Date(i.date).getTime())}" y1="${H - 18}" y2="${H - 12}" stroke="var(--gris)" stroke-width="2"/>`).join('');
  return `<p style="font-family:var(--display);font-weight:800;font-size:26px">${fr(cur, 2)} ${esc(t.unit)} <span class="small muted" style="font-family:var(--body);font-weight:500">estimés maintenant</span></p>
  <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Courbe du niveau estimé sur 4 semaines">
  <path d="${path(past)}L${x(now)} ${H - 18}L${x(past[0][0])} ${H - 18}Z" fill="${esc(t.color)}" opacity=".22"/>
  <path d="${path(past)}" fill="none" stroke="var(--encre)" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="${path(fut)}" fill="none" stroke="var(--encre)" stroke-width="2" stroke-dasharray="3 5" stroke-linecap="round"/>
  <line x1="${P}" x2="${W - P}" y1="${H - 18}" y2="${H - 18}" stroke="var(--trait)"/>${marks}
  <circle cx="${x(now)}" cy="${y(cur)}" r="5" fill="var(--corail)"/>
  <text x="${P}" y="${H - 1}">il y a 3 sem.</text><text x="${x(now)}" y="${H - 1}" text-anchor="middle">maintenant</text><text x="${W - P}" y="${H - 1}" text-anchor="end">+7 j</text></svg>`;
}

function vInj() {
  const all = sortDesc(S.injections);
  let h = `<header class="top"><div><p>${all.length} injection${all.length > 1 ? 's' : ''} notée${all.length > 1 ? 's' : ''}</p><h1>Injections</h1></div>${active().length ? '<button class="btn sm" data-act="newInj">Noter</button>' : ''}</header>`;
  if (!active().length) return h + `<div class="panel empty"><b>Aucun traitement</b>Ajoute d'abord un traitement pour noter tes injections.<br><button class="btn" data-act="newT">Ajouter un traitement</button></div>`;
  if (!all.length) return h + `<div class="panel empty"><b>Ton carnet est vide</b>Chaque injection notée alimente le calendrier, la rotation des zones et la courbe.<br><button class="btn" data-act="newInj">Noter une injection</button></div>`;
  const t0 = T(focusT) || active()[0], rot = nextSite(t0.id);
  h += `<div class="panel">${bodySvg(null, rot)}<div class="legend"><span>Vert : zone conseillée par la rotation</span><span>Pointillé : dernière utilisée</span></div><p class="small muted" style="text-align:center">Rotation calculée pour ${esc(t0.name)} : la zone la plus anciennement utilisée passe en premier.</p></div>`;
  h += `<h2>Historique</h2><div class="panel"><ul class="list">${all.map(i => { const t = T(i.tid) || { name: 'Traitement supprimé', unit: '', color: '#999' }; return `<li><span class="dot" style="background:${esc(t.color)}"></span><div class="main"><b>${esc(t.name)}</b><span>${dFmt(i.date)} à ${tFmt(i.date)}${i.site ? ', ' + siteLabel(i.site).toLowerCase() : ''}${i.note ? ' — ' + esc(i.note) : ''}</span></div><span class="val">${fr(i.dose, 3)} ${esc(t.unit)}</span><button class="x" data-del="injections" data-id="${i.id}" aria-label="Supprimer cette injection">×</button></li>`; }).join('')}</ul></div>`;
  return h;
}

function bodySvg(sel, rot) {
  return `<svg class="body" viewBox="0 0 210 290" role="group" aria-label="Zones d'injection">
  <circle class="shape" cx="105" cy="34" r="22"/><rect class="shape" x="68" y="62" width="74" height="126" rx="26"/>
  <rect class="shape" x="35" y="68" width="30" height="98" rx="12"/><rect class="shape" x="145" y="68" width="30" height="98" rx="12"/>
  <rect class="shape" x="68" y="176" width="34" height="108" rx="16"/><rect class="shape" x="108" y="176" width="34" height="108" rx="16"/>
  ${SITES.map(s => `<circle class="zone ${sel === s.id ? 'on' : ''} ${rot && rot.next === s.id ? 'next' : ''} ${rot && rot.last === s.id ? 'last' : ''}" cx="${s.x}" cy="${s.y}" r="13" ${sel !== null || rot === undefined ? '' : ''} data-site="${s.id}" tabindex="0" role="button" aria-label="${s.label}"><title>${s.label}</title></circle>`).join('')}</svg>`;
}

function vPoids() {
  const w = sortDesc(S.weights);
  let h = `<header class="top"><div><p>${w.length ? 'Dernière pesée ' + dFmt(w[0].date) : 'Aucune pesée'}</p><h1>Poids</h1></div><button class="btn sm" data-act="newW">Noter</button></header>`;
  if (!w.length) return h + `<div class="panel empty"><b>Note ta première pesée</b>Le même jour et à la même heure chaque semaine, la courbe est plus lisible.<br><button class="btn" data-act="newW">Noter mon poids</button></div>`;
  const last = w[0], first = w[w.length - 1], diff = last.kg - first.kg, weeks = (new Date(last.date) - new Date(first.date)) / (7 * DAY);
  const hm = num(S.profile.height) / 100, goal = num(S.profile.goal);
  h += `<div class="panel"><div class="kv"><div><b>${fr(last.kg)}</b><span>kg actuels</span></div><div><b>${(diff > 0 ? '+' : '') + fr(diff)}</b><span>kg depuis le ${dFmt(first.date, { day: 'numeric', month: 'short' })}</span></div><div><b>${weeks >= 1 ? (diff > 0 ? '+' : '') + fr(diff / weeks, 2) : '–'}</b><span>kg par semaine</span></div></div>
  ${w.length > 1 ? weightChart(w.slice().reverse(), goal) : '<p class="small muted" style="margin-top:12px">La courbe apparaît à partir de deux pesées.</p>'}</div>`;
  if (hm > 0 || goal > 0) h += `<div class="panel"><div class="kv">${hm > 0 ? `<div><b>${fr(last.kg / (hm * hm))}</b><span>IMC</span></div>` : ''}${goal > 0 ? `<div><b>${fr(goal)}</b><span>kg, objectif</span></div><div><b>${fr(Math.max(0, last.kg - goal))}</b><span>kg restants</span></div>` : ''}</div></div>`;
  const rec = w.filter(x => new Date(last.date) - new Date(x.date) <= 21 * DAY);
  if (rec.length >= 3 && weeks >= 3) { const ks = rec.map(x => x.kg); if (Math.max(...ks) - Math.min(...ks) < 0.6) h += `<p class="note">Ton poids varie de moins de 600 g depuis 3 semaines. Un palier est courant ; si tu veux en parler, c'est un bon sujet pour ton prochain rendez-vous.</p>`; }
  h += `<h2>Pesées</h2><div class="panel"><ul class="list">${w.map((x, i) => { const prev = w[i + 1]; const d = prev ? x.kg - prev.kg : null; return `<li><div class="main"><b>${dFmt(x.date, { weekday: 'long', day: 'numeric', month: 'long' })}</b><span>${d === null ? 'Première pesée' : (d > 0 ? '+' : '') + fr(d) + ' kg depuis la précédente'}</span></div><span class="val">${fr(x.kg)} kg</span><button class="x" data-del="weights" data-id="${x.id}" aria-label="Supprimer cette pesée">×</button></li>`; }).join('')}</ul></div>`;
  return h;
}

function weightChart(a, goal) {
  const W = 320, H = 150, L = 30, R = 8, Tp = 10, B = 20;
  const xs = a.map(p => new Date(p.date).getTime()), ks = a.map(p => p.kg);
  let lo = Math.min(...ks), hi = Math.max(...ks); if (goal > 0 && goal > lo - 15) lo = Math.min(lo, goal); if (hi - lo < 1) { hi += .5; lo -= .5; }
  const m = (hi - lo) * .08; lo -= m; hi += m;
  const x = v => L + (xs.length > 1 && xs[xs.length - 1] > xs[0] ? (v - xs[0]) / (xs[xs.length - 1] - xs[0]) : .5) * (W - L - R), y = v => Tp + (hi - v) / (hi - lo) * (H - Tp - B);
  const path = a.map((p, i) => (i ? 'L' : 'M') + x(xs[i]).toFixed(1) + ' ' + y(p.kg).toFixed(1)).join('');
  const inj = S.injections.map(i => new Date(i.date).getTime()).filter(v => v >= xs[0] && v <= xs[xs.length - 1]).map(v => `<line x1="${x(v)}" x2="${x(v)}" y1="${H - B}" y2="${H - B + 5}" stroke="var(--soleil)" stroke-width="2.5"/>`).join('');
  return `<svg class="chart" style="margin-top:14px" viewBox="0 0 ${W} ${H}" role="img" aria-label="Courbe de poids">
  ${[hi - m, (hi + lo) / 2, lo + m].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--trait)"/><text x="${L - 5}" y="${y(v) + 4}" text-anchor="end">${fr(v, 0)}</text>`).join('')}
  ${goal > 0 && goal >= lo ? `<line x1="${L}" x2="${W - R}" y1="${y(goal)}" y2="${y(goal)}" stroke="var(--menthe)" stroke-width="1.5" stroke-dasharray="5 4"/>` : ''}
  <path d="${path}" fill="none" stroke="var(--encre)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
  ${a.length < 40 ? a.map((p, i) => `<circle cx="${x(xs[i])}" cy="${y(p.kg)}" r="3.5" fill="var(--papier)" stroke="var(--encre)" stroke-width="2"/>`).join('') : ''}${inj}
  <text x="${L}" y="${H - 2}">${dFmt(a[0].date, { day: 'numeric', month: 'short' })}</text><text x="${W - R}" y="${H - 2}" text-anchor="end">${dFmt(a[a.length - 1].date, { day: 'numeric', month: 'short' })}</text></svg>
  <p class="small muted" style="margin-top:6px">Traits jaunes : injections.${goal > 0 ? ' Pointillé vert : objectif.' : ''}</p>`;
}

function vRess() {
  const s = sortDesc(S.symptoms);
  let h = `<header class="top"><div><p>Effets, appétit, énergie</p><h1>Ressentis</h1></div><button class="btn sm" data-act="newS">Noter</button></header>`;
  if (!s.length) return h + `<div class="panel empty"><b>Rien à signaler pour l'instant</b>Note ce que tu ressens au fil des jours : c'est précieux pour en parler à ton médecin.<br><button class="btn" data-act="newS">Noter un ressenti</button></div>`;
  const cnt = {}; s.filter(x => Date.now() - new Date(x.date).getTime() < 30 * DAY).forEach(x => cnt[x.type] = (cnt[x.type] || 0) + 1);
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 5), mx = top.length ? top[0][1] : 1;
  if (top.length) h += `<div class="panel"><p class="small muted" style="margin-bottom:10px">Sur les 30 derniers jours</p>${top.map(([k, v]) => `<div style="display:flex;align-items:center;gap:10px;margin:7px 0"><span style="width:44%;font-weight:600;font-size:14.5px">${esc(k)}</span><span style="flex:1;height:12px;border-radius:6px;background:var(--lavande)"><span style="display:block;height:100%;width:${v / mx * 100}%;border-radius:6px;background:var(--corail)"></span></span><b style="width:22px;text-align:right">${v}</b></div>`).join('')}</div>`;
  if (s.some(x => x.level === 3 && Date.now() - new Date(x.date).getTime() < 3 * DAY)) h += `<p class="note warn">Tu as noté un ressenti fort ces derniers jours. S'il persiste ou t'inquiète, contacte ton médecin ou ton pharmacien. En cas d'urgence, appelle le 15.</p>`;
  h += `<h2>Journal</h2><div class="panel"><ul class="list">${s.map(x => `<li><div class="main"><b>${esc(x.type)}</b><span>${dFmt(x.date)}${x.note ? ' — ' + esc(x.note) : ''}</span></div><span class="val" style="font-size:15px;color:${x.level === 3 ? 'var(--corail)' : 'inherit'}">${LEVELS[x.level]}</span><button class="x" data-del="symptoms" data-id="${x.id}" aria-label="Supprimer ce ressenti">×</button></li>`).join('')}</ul></div>`;
  return h;
}

function vRegl() {
  const ts = S.treatments;
  return `<header class="top"><div><p>Traitements, profil, données</p><h1>Réglages</h1></div></header>
  <div class="panel"><ul class="list">${ts.length ? ts.map(t => `<li><span class="dot" style="background:${esc(t.color)}"></span><div class="main"><b>${esc(t.name)}${t.archived ? ' (arrêté)' : ''}</b><span>${t.molecule ? esc(t.molecule) + ', ' : ''}${num(t.intervalDays) === 1 ? 'tous les jours' : 'tous les ' + fr(t.intervalDays) + ' jours'}${t.stock !== '' && t.stock != null ? ', ' + fr(t.stock, 0) + ' dose(s) en stock' : ''}</span></div><button class="btn soft sm" data-act="editT" data-id="${t.id}">Modifier</button></li>`).join('') : '<li class="muted">Aucun traitement pour l\'instant.</li>'}</ul>
  <button class="btn wide" style="margin-top:12px" data-act="newT">Ajouter un traitement</button></div>
  <h2>Profil</h2><div class="panel">
  <label class="f">Prénom<input id="p-name" value="${esc(S.profile.name)}" autocomplete="given-name"></label>
  <div class="two"><label class="f">Taille (cm)<input id="p-height" inputmode="decimal" value="${esc(S.profile.height)}"></label><label class="f">Objectif (kg)<input id="p-goal" inputmode="decimal" value="${esc(S.profile.goal)}"></label></div>
  <button class="btn soft wide" data-act="saveP">Enregistrer le profil</button></div>
  <h2>Mes données</h2><div class="panel">
  <p class="small muted" style="margin-bottom:12px">Tout est stocké dans ce navigateur, sur cet appareil. Fais une sauvegarde de temps en temps : vider les données du navigateur efface aussi le carnet.</p>
  <div class="actions"><button class="btn soft sm" data-act="exp">Sauvegarder (JSON)</button><button class="btn soft sm" data-act="csv">Export CSV</button></div>
  <div class="actions" style="margin-top:10px"><button class="btn soft sm" data-act="imp">Restaurer une sauvegarde</button><button class="btn danger sm" data-act="wipe">Tout effacer</button></div>
  <input type="file" id="file" accept="application/json,.json" hidden></div>
  <p class="small muted" style="margin:18px 4px">Cadence est un carnet de suivi personnel. Il ne fournit ni diagnostic ni conseil de dosage. Pour toute question sur ton traitement, adresse-toi à ton médecin ou ton pharmacien.</p>`;
}

/* ---------- Feuilles de saisie ---------- */
function sheet(html) { $('#sheet-body').innerHTML = html; $('#sheet').hidden = false; const f = $('#sheet-body input:not([type=hidden]),#sheet-body select'); if (f && window.matchMedia('(min-width:700px)').matches) f.focus(); }
function closeSheet() { $('#sheet').hidden = true; $('#sheet-body').innerHTML = ''; }

function fInj(tid) {
  const act = active(); const t = T(tid) || T(focusT) || act[0]; if (!t) return;
  const last = injOf(t.id)[0], rot = nextSite(t.id), p = PRESETS.find(x => x.key === t.preset), doses = (p && p.doses) || [];
  const dose = last ? last.dose : '';
  sheet(`<h3>Noter une injection</h3>
  ${act.length > 1 ? `<label class="f">Traitement<select id="i-t">${act.map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>` : `<input type="hidden" id="i-t" value="${t.id}">`}
  <div class="two"><label class="f">Dose (${esc(t.unit)})<input id="i-dose" inputmode="decimal" value="${dose === '' ? '' : String(dose).replace('.', ',')}" placeholder="selon ta prescription"></label>
  <label class="f">Date et heure<input id="i-date" type="datetime-local" value="${nowLocal()}" max="${nowLocal()}"></label></div>
  ${doses.length ? `<div class="chips">${doses.map(d => `<button type="button" class="chip" data-dose="${d}" aria-pressed="${d === dose}">${fr(d, 2)} ${esc(t.unit)}</button>`).join('')}</div>` : ''}
  <p style="font-weight:600;font-size:14.5px;margin-bottom:6px">Zone d'injection</p>
  <div id="i-body" data-sel="${rot.next}">${bodySvg(rot.next, rot)}</div>
  <p class="small muted" id="i-site" style="text-align:center;margin-bottom:12px">${siteLabel(rot.next)}, proposé par la rotation</p>
  <label class="f">Note (facultatif)<input id="i-note" maxlength="140" placeholder="Stylo n°2, à jeun…"></label>
  <div class="actions"><button class="btn soft" data-close>Annuler</button><button class="btn" data-act="saveInj">Enregistrer</button></div>`);
}
function fW() { const l = sortDesc(S.weights)[0]; sheet(`<h3>Noter mon poids</h3><div class="two"><label class="f">Poids (kg)<input id="w-kg" inputmode="decimal" placeholder="${l ? fr(l.kg) : '70,0'}"></label><label class="f">Date<input id="w-date" type="date" value="${today()}" max="${today()}"></label></div><div class="actions"><button class="btn soft" data-close>Annuler</button><button class="btn" data-act="saveW">Enregistrer</button></div>`); }
function fS() {
  sheet(`<h3>Noter un ressenti</h3><div class="chips" id="s-type">${SYMPT.map((s, i) => `<button type="button" class="chip" data-pick aria-pressed="${i === 0}">${esc(s)}</button>`).join('')}</div>
  <p style="font-weight:600;font-size:14.5px;margin-bottom:10px">Intensité</p><div class="chips" id="s-lvl">${[1, 2, 3].map(l => `<button type="button" class="chip" data-pick data-v="${l}" aria-pressed="${l === 1}">${LEVELS[l]}</button>`).join('')}</div>
  <div class="two"><label class="f">Date<input id="s-date" type="date" value="${today()}" max="${today()}"></label><label class="f">Note (facultatif)<input id="s-note" maxlength="140"></label></div>
  <div class="actions"><button class="btn soft" data-close>Annuler</button><button class="btn" data-act="saveS">Enregistrer</button></div>`);
}
function fT(id) {
  const t = id ? T(id) : null;
  const fields = v => `<label class="f">Nom<input id="t-name" value="${esc(v.name)}" placeholder="Nom du produit ou du peptide" maxlength="40"></label>
  <div class="two"><label class="f">Molécule (facultatif)<input id="t-mol" value="${esc(v.molecule)}" maxlength="40"></label><label class="f">Unité<select id="t-unit">${['mg', 'µg', 'UI', 'mL'].map(u => `<option ${u === v.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></label></div>
  <div class="two"><label class="f">Une injection tous les (jours)<input id="t-int" inputmode="decimal" value="${esc(v.intervalDays)}"></label><label class="f">Doses en stock (facultatif)<input id="t-stock" inputmode="numeric" value="${esc(v.stock ?? '')}"></label></div>
  <div class="two"><label class="f">Demi-vie (heures)<input id="t-hl" inputmode="decimal" value="${esc(v.halfLifeH)}" placeholder="facultatif"></label><label class="f">Pic après (heures)<input id="t-tmax" inputmode="decimal" value="${esc(v.tmaxH)}" placeholder="facultatif"></label></div>
  <p class="small muted" style="margin:-4px 0 14px">La demi-vie sert uniquement à tracer la courbe du niveau estimé. Sans elle, le reste du suivi fonctionne pareil.</p>
  <p style="font-weight:600;font-size:14.5px;margin-bottom:10px">Couleur</p><div class="chips" id="t-col">${COLORS.map(c => `<button type="button" class="chip" data-pick data-v="${c}" aria-pressed="${c === v.color}" aria-label="Couleur ${c}" style="width:38px;padding:0;background:${c};${c === v.color ? 'box-shadow:0 0 0 3px var(--encre)' : ''}"></button>`).join('')}</div>`;
  if (t) return sheet(`<h3>Modifier ${esc(t.name)}</h3><input type="hidden" id="t-id" value="${t.id}"><input type="hidden" id="t-preset" value="${esc(t.preset || 'custom')}">${fields(t)}
    <div class="actions"><button class="btn soft" data-close>Annuler</button><button class="btn" data-act="saveT">Enregistrer</button></div>
    <div class="actions" style="margin-top:10px"><button class="btn soft sm" data-act="archT" data-id="${t.id}">${t.archived ? 'Reprendre ce traitement' : 'Marquer comme arrêté'}</button><button class="btn danger sm" data-act="delT" data-id="${t.id}">Supprimer</button></div>`);
  sheet(`<h3>Ajouter un traitement</h3><div class="chips" id="t-pre">${PRESETS.map((p, i) => `<button type="button" class="chip" data-preset="${p.key}" aria-pressed="${i === 0}">${p.name || 'Peptide ou autre'}</button>`).join('')}</div>
  <input type="hidden" id="t-id" value=""><input type="hidden" id="t-preset" value="mounjaro"><div id="t-fields">${fields(PRESETS[0])}</div>
  <div class="actions"><button class="btn soft" data-close>Annuler</button><button class="btn" data-act="saveT">Ajouter</button></div>`);
}

/* ---------- Actions ---------- */
const A = {
  start() { if (!$('#ok').checked) return toast('Coche la case pour continuer'); S.onboarded = true; save(); render(); fT(); },
  newT: () => fT(), editT: id => fT(id), newInj: id => fInj(id), newW: fW, newS: fS,
  saveT() {
    const name = $('#t-name').value.trim(), int = num($('#t-int').value); if (!name) return toast('Donne un nom au traitement'); if (!(int > 0)) return toast('Indique l\'intervalle entre deux injections');
    const hl = num($('#t-hl').value), tm = num($('#t-tmax').value), st = $('#t-stock').value.trim();
    const col = $('#t-col [aria-pressed="true"]');
    const d = { name, molecule: $('#t-mol').value.trim(), unit: $('#t-unit').value, intervalDays: int, halfLifeH: hl > 0 ? hl : '', tmaxH: tm > 0 ? tm : '', stock: st === '' || isNaN(num(st)) ? '' : Math.max(0, Math.round(num(st))), color: col ? col.dataset.v : COLORS[0], preset: $('#t-preset').value };
    const id = $('#t-id').value;
    if (id) Object.assign(T(id), d); else { d.id = uid(); d.archived = false; S.treatments.push(d); focusT = d.id; }
    save(); closeSheet(); render(); toast(id ? 'Traitement modifié' : 'Traitement ajouté');
  },
  archT(id) { const t = T(id); t.archived = !t.archived; save(); closeSheet(); render(); },
  delT(id) { if (!confirm('Supprimer ce traitement et toutes ses injections ?')) return; S.treatments = S.treatments.filter(t => t.id !== id); S.injections = S.injections.filter(i => i.tid !== id); save(); closeSheet(); render(); toast('Traitement supprimé'); },
  saveInj() {
    const tid = $('#i-t').value, dose = num($('#i-dose').value), date = $('#i-date').value; if (!(dose > 0)) return toast('Indique la dose injectée'); if (!date) return toast('Indique la date');
    S.injections.push({ id: uid(), tid, dose, date, site: $('#i-body').dataset.sel || '', note: $('#i-note').value.trim() });
    const t = T(tid); if (t.stock !== '' && t.stock != null) t.stock = Math.max(0, num(t.stock) - 1);
    focusT = tid; save(); closeSheet(); render(); toast('Injection enregistrée');
  },
  saveW() { const kg = num($('#w-kg').value), date = $('#w-date').value; if (!(kg > 20 && kg < 400)) return toast('Indique un poids en kg'); S.weights = S.weights.filter(w => w.date !== date); S.weights.push({ id: uid(), date, kg }); save(); closeSheet(); render(); toast('Poids enregistré'); },
  saveS() { const type = $('#s-type [aria-pressed="true"]').textContent, lv = +$('#s-lvl [aria-pressed="true"]').dataset.v; S.symptoms.push({ id: uid(), date: $('#s-date').value || today(), type, level: lv, note: $('#s-note').value.trim() }); save(); closeSheet(); render(); toast('Ressenti enregistré'); },
  saveP() { S.profile = { name: $('#p-name').value.trim(), height: $('#p-height').value.trim(), goal: $('#p-goal').value.trim() }; save(); toast('Profil enregistré'); },
  ics(id) {
    const t = T(id), st = status(t); if (!st.last) return;
    const d = new Date(st.due), f = x => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
    const e = new Date(d.getTime() + 15 * 6e4), clean = s => String(s).replace(/[,;\\\n]/g, ' ');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cadence//FR', 'BEGIN:VEVENT', 'UID:' + uid() + '@cadence', 'DTSTAMP:' + f(new Date()), 'DTSTART:' + f(d), 'DTEND:' + f(e), 'SUMMARY:Injection ' + clean(t.name), 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Injection ' + clean(t.name), 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    dl('rappel-injection.ics', ics, 'text/calendar');
  },
  exp() { dl(`cadence-${today()}.json`, JSON.stringify(S, null, 2), 'application/json'); },
  csv() {
    const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const rows = [['type', 'date', 'traitement', 'valeur', 'unite', 'detail', 'note']];
    S.injections.forEach(i => { const t = T(i.tid) || {}; rows.push(['injection', i.date, t.name, i.dose, t.unit, siteLabel(i.site), i.note]); });
    S.weights.forEach(w => rows.push(['poids', w.date, '', w.kg, 'kg', '', '']));
    S.symptoms.forEach(s => rows.push(['ressenti', s.date, '', s.level, '/3', s.type, s.note]));
    dl(`cadence-${today()}.csv`, '﻿' + rows.map(r => r.map(q).join(';')).join('\n'), 'text/csv');
  },
  imp() { $('#file').click(); },
  wipe() { if (!confirm('Effacer définitivement tout le carnet sur cet appareil ?')) return; localStorage.removeItem(KEY); S = blank(); tab = 'home'; render(); }
};
function dl(name, data, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }

document.addEventListener('click', e => {
  const el = e.target.closest('[data-tab],[data-act],[data-close],[data-del],[data-focus],[data-dose],[data-pick],[data-preset],[data-site]'); if (!el) return;
  const d = el.dataset;
  if (d.tab) { tab = d.tab; render(); window.scrollTo(0, 0); }
  else if (d.act) A[d.act](d.id);
  else if ('close' in d) closeSheet();
  else if (d.del) { if (!confirm('Supprimer cette entrée ?')) return; S[d.del] = S[d.del].filter(x => x.id !== d.id); save(); render(); }
  else if (d.focus) { focusT = d.focus; render(); }
  else if (d.dose) { $('#i-dose').value = String(d.dose).replace('.', ','); el.parentNode.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === el)); }
  else if ('pick' in d) { el.parentNode.querySelectorAll('.chip').forEach(c => { c.setAttribute('aria-pressed', c === el); if (el.parentNode.id === 't-col') c.style.boxShadow = c === el ? '0 0 0 3px var(--encre)' : ''; }); }
  else if (d.preset) {
    const p = PRESETS.find(x => x.key === d.preset); el.parentNode.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c === el)); $('#t-preset').value = p.key;
    $('#t-name').value = p.name; $('#t-mol').value = p.molecule; $('#t-unit').value = p.unit; $('#t-int').value = p.intervalDays; $('#t-hl').value = p.halfLifeH; $('#t-tmax').value = p.tmaxH;
    document.querySelectorAll('#t-col .chip').forEach(c => { const on = c.dataset.v === p.color; c.setAttribute('aria-pressed', on); c.style.boxShadow = on ? '0 0 0 3px var(--encre)' : ''; });
    if (p.key === 'custom') $('#t-name').focus();
  }
  else if (d.site) { const box = el.closest('#i-body'); if (!box) return; box.dataset.sel = d.site; box.querySelectorAll('.zone').forEach(z => z.classList.toggle('on', z === el)); $('#i-site').textContent = siteLabel(d.site); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet();
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.zone')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
});
document.addEventListener('change', e => {
  if (e.target.id === 'i-t') return fInj(e.target.value);
  if (e.target.id !== 'file' || !e.target.files[0]) return;
  const r = new FileReader();
  r.onload = () => { try { const d = JSON.parse(r.result); if (!d || !Array.isArray(d.treatments) || !Array.isArray(d.injections)) throw 0; if (!confirm('Remplacer le carnet actuel par cette sauvegarde ?')) return; S = Object.assign(blank(), d, { onboarded: true }); save(); render(); toast('Sauvegarde restaurée'); } catch (x) { toast('Ce fichier n\'est pas une sauvegarde Cadence'); } };
  r.readAsText(e.target.files[0]);
});

render();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
