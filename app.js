/* Cadence — carnet de suivi de traitement GLP-1 et autres traitements injectables.
   Tout est stocké sur l'appareil (localStorage + IndexedDB pour les photos). Rien n'est envoyé. */
'use strict';
const KEY = 'cadence.v1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.').replace(/\s/g, '')); return isFinite(n) ? n : NaN; };
const fr = (n, d = 1) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: d });
const fr1 = n => Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const eur = n => Number(n).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const sgn = n => (n > 0 ? '+' : n < 0 ? '−' : '') + fr1(Math.abs(n));
const sum = a => a.reduce((x, y) => x + (+y || 0), 0);
const pad = n => String(n).padStart(2, '0');
const DAY = 864e5;
const isoLocal = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const today = () => isoLocal().slice(0, 10);
const D = s => (typeof s === 'string' && s.length === 10) ? new Date(s + 'T12:00') : new Date(s);
const dayKey = s => isoLocal(D(s)).slice(0, 10);
const addDays = (s, n) => isoLocal(new Date(D(s).getTime() + n * DAY)).slice(0, 10);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const dfmt = (s, o = { weekday: 'long', day: 'numeric', month: 'long' }) => D(s).toLocaleDateString('fr-FR', o).replace(/\.$/, '');
const short = s => dfmt(s, { day: 'numeric', month: 'short' });
const tfmt = s => D(s).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const daysBetween = (a, b) => Math.round((D(dayKey(b)) - D(dayKey(a))) / DAY);
const weekStart = () => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoLocal(d).slice(0, 10); };
function relDay(s) {
  const n = daysBetween(s, today());
  if (n === 0) return 'aujourd’hui';
  if (n === 1) return 'hier';
  if (n === -1) return 'demain';
  return dfmt(s, n < 7 && n > 0 ? { weekday: 'long' } : { weekday: 'long', day: 'numeric', month: 'long' });
}
const nb = s => String(s).replace(/ ([?!;:])/g, ' $1');
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Animation ---------- */
const PREV = new Map();
let animIn = true, tabDir = 1, tabPop = false;
const F = { int: v => fr(Math.round(v), 0), d1: v => fr1(v), d2: v => fr(v, 2), g: v => fr(Math.round(v), 0) + ' g', L: v => fr(v / 1000, 2) + ' L' };
const cnt = (k, v, f = 'int', from) => `<span class="cnt" data-k="${k}" data-v="${v}" data-f="${f}"${from !== undefined ? ` data-from="${from}"` : ''}>${F[f](v)}</span>`;
const ease = t => 1 - Math.pow(1 - t, 3);
function tween(dur, fn) { const t0 = performance.now(); const step = now => { const p = Math.min(1, (now - t0) / dur); fn(ease(p)); if (p < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }
function animateCounts(root = document) {
  $$('.cnt', root).forEach(el => {
    const k = el.dataset.k, v = +el.dataset.v, f = F[el.dataset.f] || F.int;
    const from = PREV.has(k) ? PREV.get(k) : (el.dataset.from !== undefined ? +el.dataset.from : v);
    PREV.set(k, v);
    if (REDUCED || from === v || !isFinite(from)) return;
    el.textContent = f(from); tween(Math.min(900, 450 + Math.abs(v - from) * 8), p => { el.textContent = f(from + (v - from) * p); });
  });
  $$('[data-wk]', root).forEach(el => {
    const k = 'w:' + el.dataset.wk, w = +el.dataset.w, from = PREV.has(k) ? PREV.get(k) : (animIn ? 0 : w);
    PREV.set(k, w);
    if (REDUCED || from === w) { el.style.width = w + '%'; return; }
    el.style.transition = 'none'; el.style.width = from + '%'; el.getBoundingClientRect();
    requestAnimationFrame(() => { el.style.transition = ''; el.style.width = w + '%'; });
  });
}
function haptic() {
  try {
    if (navigator.vibrate) { navigator.vibrate(8); return; }
    if (!IOS) return;
    // iOS 18+ : basculer un interrupteur natif caché déclenche un retour haptique léger.
    const l = document.createElement('label'), i = document.createElement('input');
    l.setAttribute('aria-hidden', 'true'); l.style.display = 'none'; i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1;
    l.appendChild(i); document.head.appendChild(l); l.click(); l.remove();
  } catch (e) { }
}
const center = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top }; };
function pop(el, k = 1.12) { if (!el || REDUCED || !el.animate) return; el.animate([{ transform: 'scale(1)' }, { transform: `scale(${k})` }, { transform: 'scale(1)' }], { duration: 340, easing: 'cubic-bezier(.3,1.6,.5,1)' }); }
function floatText(pt, text, color) {
  if (!pt || REDUCED) return;
  const s = document.createElement('span'); s.className = 'floaty'; s.textContent = text; s.style.color = color; s.style.left = pt.x + 'px'; s.style.top = (pt.y - 14) + 'px';
  document.body.appendChild(s);
  s.animate([{ transform: 'translate(-50%,0) scale(.7)', opacity: 0 }, { transform: 'translate(-50%,-20px) scale(1.05)', opacity: 1, offset: .25 }, { transform: 'translate(-50%,-52px) scale(1)', opacity: 0 }], { duration: 950, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => s.remove();
}
function burst(pt, colors, n = 26, spread = 1.15) {
  if (!pt || REDUCED) return;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i'); s.className = 'confetti'; s.style.left = pt.x + 'px'; s.style.top = pt.y + 'px'; s.style.background = colors[i % colors.length];
    if (i % 3 === 0) s.style.borderRadius = '50%'; else if (i % 3 === 1) { s.style.width = '5px'; s.style.height = '11px'; }
    document.body.appendChild(s);
    const a = Math.random() * Math.PI * 2, dist = (45 + Math.random() * 80) * spread, dx = Math.cos(a) * dist, dy = Math.sin(a) * dist - 40 * spread;
    s.animate([{ transform: 'translate(-50%,-50%) scale(.4) rotate(0deg)', opacity: 1 }, { transform: `translate(calc(-50% + ${dx * .7}px), calc(-50% + ${dy * .7}px)) scale(1) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: .45 }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 70 * spread}px)) scale(.8) rotate(${Math.random() * 720 - 360}deg)`, opacity: 0 }], { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => s.remove();
  }
}
function hud(text, color, o = {}) {
  const h = document.createElement('div'); h.className = 'hud'; h.style.setProperty('--c', color);
  const top = o.cadi ? `<span class="hud-cadi">${cadi({ size: 112, n: o.n || 7, done: o.n || 7, act: '', cls: 'hudc', expr: o.expr && !o.spin ? o.expr : '' })}<span class="hud-ok">${ic('check')}</span></span>`
    : `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30"/><path d="M19 33l9 9 18-19"/></svg>`;
  h.innerHTML = `<div class="hud-in${o.cadi ? ' with-cadi' : ''}">${top}<b>${esc(text)}</b>${o.sub ? `<span class="hsub">${esc(o.sub)}</span>` : ''}</div>`;
  document.body.appendChild(h); haptic();
  if (o.cadi && o.spin !== false) setTimeout(() => { const c = h.querySelector('.cadi'); if (o.expr) c.dataset.after = o.expr; cadiSpin(c); }, 120);
  if (o.cadi && o.spin === false) { const c = h.querySelector('.cadi'); cadiJelly(c); }
  const d = o.cadi ? 1700 : 1150;
  setTimeout(() => h.classList.add('out'), REDUCED ? 800 : d); setTimeout(() => h.remove(), REDUCED ? 900 : d + 400);
}
function collapse(el, cb) {
  if (!el || REDUCED || !el.animate) return cb();
  const h = el.offsetHeight; el.style.overflow = 'hidden';
  el.animate([{ height: h + 'px', opacity: 1, transform: 'translateX(0)' }, { height: h + 'px', opacity: 0, transform: 'translateX(-24px)', offset: .55 }, { height: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px', marginTop: '0px', marginBottom: '0px' }], { duration: 300, easing: 'ease-in', fill: 'forwards' }).onfinish = cb;
}
/* ---------- Cadi, la mascotte ---------- */
function haloSvg(n = 7, done = 5, cur = -1, late = false) {
  n = Math.max(1, Math.min(Math.round(n) || 7, 14));
  const step = n > 9 ? 11.5 : 16, span = (n - 1) * step, R = 33, cx = 50, cy = 36.8, pw = Math.min(8.6, R * step * Math.PI / 180 * .9);
  let r = '';
  for (let i = 0; i < n; i++) {
    const deg = -90 - span / 2 + i * step, a = deg * Math.PI / 180, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
    const cls = late ? 'l' : i < done ? 'd' : i === cur ? 'c' : '';
    r += `<g transform="rotate(${(deg + 90).toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})"><rect class="${cls}" x="${(x - pw / 2).toFixed(2)}" y="${(y - 2.7).toFixed(2)}" width="${pw.toFixed(2)}" height="5.4" rx="2.7" style="--i:${i}"/></g>`;
  }
  return `<svg class="cadi-h" viewBox="0 0 100 100" aria-hidden="true">${r}</svg>`;
}
const EXPR = ['calm', 'excited', 'worried', 'party', 'water', 'sleepy'];
const exprSrc = e => EXPR.includes(e) ? `cadi-${e}.webp` : 'cadi.png';
function cadi({ size = 64, n = 7, done = 5, cur = -1, late = false, mood = '', act = 'cadiPoke', cls = '', expr = '' } = {}) {
  return `<span class="cadi ${mood} ${cls}" style="--s:${size}px" data-expr="${expr}" data-base="${expr}"${act ? ` data-act="${act}"` : ''} role="img" aria-label="Cadi, la mascotte de Cadence"><span class="cadi-b"><img class="still" src="${exprSrc(expr)}" alt="" draggable="false"><span class="idle"><img src="cadi-idle.webp" alt="" draggable="false" loading="lazy"></span><span class="spin"><img src="cadi-spin.webp" alt="" draggable="false"></span></span>${haloSvg(n, done, cur, late)}</span>`;
}
function setExpr(el, expr) {
  if (!el) return; const img = el.querySelector('.still'), src = exprSrc(expr);
  el.dataset.expr = expr || '';
  if (img.getAttribute('src') === src) return;
  if (REDUCED || !img.animate) { img.src = src; return; }
  img.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.86)', opacity: .2 }], { duration: 120, easing: 'ease-in' }).onfinish = () => { img.src = src; img.animate([{ transform: 'scale(.86)', opacity: .2 }, { transform: 'scale(1.06)', opacity: 1, offset: .6 }, { transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(.3,1.5,.5,1)' }); };
}
// De temps en temps, Cadi regarde autour d'elle (seulement dans son expression neutre).
setInterval(() => {
  if (REDUCED || document.hidden) return;
  $$('.cadi:not(.spinning):not(.idling)').filter(c => !c.dataset.expr && c.offsetParent && Math.random() < .6).forEach(c => {
    c.classList.add('idling'); const img = c.querySelector('.idle img');
    const end = () => c.classList.remove('idling'); img.addEventListener('animationend', end, { once: true }); setTimeout(end, 2600);
  });
}, 6500);
function cadiMood(t) {
  const st = t ? status(t) : null, g = S.goals;
  if (S.symptoms.some(s => s.level === 3 && daysBetween(s.date, today()) <= 1) || S.symptoms.filter(s => isEffect(s.type) && s.date === today() && s.level >= 2).length >= 2) return 'sleepy';
  if (st && st.last && st.dueIn < 0) return 'worried';
  if (st && st.last && st.dueIn === 0) return 'excited';
  if (S.intake.some(i => i.date === today()) && ['p', 'w', 'f'].every(k => !(g[k] > 0) || intake(k) >= g[k])) return 'party';
  if (S.symptoms.some(s => s.type === GOOD && s.date === today())) return 'calm';
  return '';
}
function cadiFor(t, size = 60) {
  const expr = cadiMood(t);
  if (!t) return cadi({ size, act: 'cadi', expr });
  const st = status(t);
  if (!st.last) return cadi({ size, n: interval(t), done: 0, cur: 0, act: 'cadi', expr });
  const late = st.dueIn < 0, due = st.dueIn === 0, n = st.n;
  return cadi({ size, n, done: late || due ? n : Math.min(st.elapsed, n), cur: late || due ? -1 : st.elapsed, late, mood: late ? 'late' : due ? 'due' : '', act: 'cadi', expr });
}
function cadiSpin(el) {
  if (!el || REDUCED) return;
  el.classList.remove('spinning', 'jelly'); void el.offsetWidth; el.classList.add('spinning');
  const img = el.querySelector('.spin img'); img.addEventListener('animationend', () => { el.classList.remove('spinning'); if (el.dataset.after !== undefined) { setExpr(el, el.dataset.after); delete el.dataset.after; } }, { once: true });
}
function cadiJelly(el) { if (!el || REDUCED) return; el.classList.remove('jelly'); void el.offsetWidth; el.classList.add('jelly'); setTimeout(() => el.classList.remove('jelly'), 700); }
let cadiTaps = 0, sayTimer;
function say(text, expr) {
  const b = $('#say'); if (!b) return;
  const c = $('.hello .cadi'); if (c) setExpr(c, expr !== undefined ? expr : c.dataset.base);
  b.hidden = false; b.classList.remove('out'); b.textContent = text; void b.offsetWidth; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  clearTimeout(sayTimer); sayTimer = setTimeout(hideSay, 5200);
}
function hideSay() { const b = $('#say'); if (!b || b.hidden) return; b.classList.add('out'); const c = $('.hello .cadi'); if (c) setExpr(c, c.dataset.base); setTimeout(() => { b.hidden = true; b.classList.remove('out'); }, 250); }
function cadiTips() {
  const tips = [], t = T(focusT) || active()[0], st = t ? status(t) : null, g = S.goals, h = new Date().getHours();
  if (S.symptoms.some(s => s.level === 3 && daysBetween(s.date, today()) <= 1)) tips.push(['Pas facile en ce moment. Repose-toi, bois par petites gorgées, et si ça persiste ou t’inquiète, parles-en à ton médecin.', 'sleepy']);
  if (t && st && st.last && st.dueIn === 0) tips.push([`C’est le jour J ! Zone conseillée : ${siteLabel(rotation(t.id).next).toLowerCase()}.`, 'excited']);
  if (t && st && st.last && st.dueIn < 0) tips.push([`Ton injection était prévue ${relDay(new Date(st.due))}. En cas de doute, la notice et ton pharmacien sont là.`, 'worried']);
  if (t && st && !st.last) tips.push(['Note ta première injection et je lance le compte à rebours.', 'excited']);
  const p = t && penInfo(t); if (p && p.exp && p.expIn >= 0 && p.expIn <= 3 && !p.done) tips.push([`Ton stylo est à jeter ${relDay(p.exp)}.`, 'worried']);
  if (S.appt && daysBetween(today(), S.appt) >= 0 && daysBetween(today(), S.appt) <= 7) tips.push([`Rendez-vous ${relDay(S.appt)}. Tes questions sont prêtes ?`, '']);
  const allOk = ['p', 'w', 'f'].every(k => !(g[k] > 0) || intake(k) >= g[k]);
  if (allOk && S.intake.some(i => i.date === today())) tips.push(['Objectifs du jour atteints. Bravo ✨', 'party']);
  else {
    if (g.w > 0 && h >= 12 && intake('w') < g.w * .5) tips.push([`Un verre d’eau ? Tu en es à ${habFmt('w', intake('w'))} aujourd’hui.`, 'water']);
    if (g.p > 0 && h >= 12 && intake('p') < g.p * .5) tips.push([`Une portion de protéines au prochain repas ? ${habFmt('p', intake('p'))} sur ${g.p} g.`, '']);
  }
  if (g.s > 0 && sessionsWeek() < g.s && new Date().getDay() >= 4) { const r = g.s - sessionsWeek(); tips.push([`Encore ${r} séance${r > 1 ? 's' : ''} de renforcement cette semaine. Même courte, elle compte.`, 'excited']); }
  if (S.symptoms.some(s => s.type === GOOD && s.date === today())) tips.push(['Une journée sans souci, ça fait du bien.', 'calm']);
  return tips.length ? tips : [['Un ressenti à noter ? Ça aide beaucoup pour le rendez-vous.', ''], ['Tout reste ici, sur ton téléphone. 🔒', 'calm'], ['Petit à petit, à ton rythme.', 'calm'], ['Pense à boire régulièrement, surtout s’il fait chaud.', 'water'], ['Pense à faire une sauvegarde de temps en temps, dans Plus.', '']];
}

const SEGPREV = new Map();
function syncSegs(root = document) {
  $$('.seg', root).forEach(seg => {
    const btns = $$(':scope > button', seg); if (!btns.length) return;
    const on = btns.find(b => b.getAttribute('aria-pressed') === 'true'); if (!on || !on.offsetWidth) return;
    const key = Object.keys(btns[0].dataset)[0] || 'seg', idx = btns.indexOf(on);
    let th = $(':scope > .thumb', seg); const fresh = !th;
    if (fresh) { th = document.createElement('i'); th.className = 'thumb'; seg.prepend(th); seg.classList.add('has-thumb'); }
    const place = b => { th.style.left = b.offsetLeft + 'px'; th.style.width = b.offsetWidth + 'px'; };
    const prev = SEGPREV.get(key);
    if (fresh) { th.style.transition = 'none'; place(!REDUCED && prev !== undefined && prev !== idx && btns[prev] ? btns[prev] : on); th.getBoundingClientRect(); th.style.transition = ''; }
    requestAnimationFrame(() => place(on));
    SEGPREV.set(key, idx);
  });
}
addEventListener('resize', () => syncSegs());

/* ---------- Icônes ---------- */
const IC = {
  today: '<circle cx="12" cy="12" r="8.5" opacity=".35"/><path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5"/><circle cx="12" cy="12" r="2.2"/>',
  journal: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.5" cy="6.5" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/><circle cx="4.5" cy="17.5" r="1.2"/>',
  progress: '<path d="M3.5 17.5l5-5.5 4 3.5 8-8.5"/><path d="M15 7h5.5v5.5"/>',
  more: '<rect x="4" y="4" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2"/>',
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
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  alert: '<path d="M12 3.8l9 15.7H3z"/><path d="M12 10v4.2M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8h.01"/>',
  share: '<path d="M12 3.5v11M8 7.5l4-4 4 4"/><path d="M6 11v8.5h12V11"/>',
  table: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M3.5 9.5h17M3.5 14.5h17M10 9.5v10"/>',
  restore: '<path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v4.5h4.5"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
  pause: '<path d="M9 6v12M15 6v12"/>',
  egg: '<path d="M12 3.5c3.6 0 6.5 5.4 6.5 9.6a6.5 6.5 0 0 1-13 0c0-4.2 2.9-9.6 6.5-9.6z"/>',
  water: '<path d="M6 4h12l-1.5 15.4a2 2 0 0 1-2 1.6h-5a2 2 0 0 1-2-1.6z"/><path d="M6.7 10.5h10.6"/>',
  leaf: '<path d="M5 19.5C5 11 10 5 20 4.5c0 10-6 15.5-14 15"/><path d="M5 19.5l7.5-7.5"/>',
  dumbbell: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  ruler: '<rect x="2.5" y="8" width="19" height="8" rx="2"/><path d="M6.5 8v3M10 8v4.5M13.5 8v3M17 8v4.5"/>',
  camera: '<path d="M4 8.5h3l1.5-2.5h7L17 8.5h3a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  doc: '<path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4M9 12h6M9 16h6"/>',
  euro: '<path d="M17 6.5a6.5 6.5 0 1 0 0 11"/><path d="M4.5 10.5h8M4.5 13.5h8"/>',
  question: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4M12 16.8h.01"/>',
  steth: '<path d="M6 3.5v6a4 4 0 0 0 8 0v-6"/><path d="M10 13.5V16a4.5 4.5 0 0 0 9 0v-2"/><circle cx="19" cy="12" r="2"/>',
  plane: '<path d="M10.5 13.5L3 11l1.5-1.5 7.5.5 4.5-5a1.8 1.8 0 0 1 2.5 2.5l-5 4.5.5 7.5L13 21z"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".9"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
  print: '<path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14h10v6.5H7z"/>'
};
const ic = (n, c = '') => `<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;

/* ---------- Référentiels ---------- */
const MISS = {
  mounjaro: 'La notice de Mounjaro prévoit d’injecter la dose oubliée dès que possible dans les 4 jours (96 h) suivant l’oubli. Au-delà, saute-la et reprends au jour habituel.',
  wegovy: 'La notice de Wegovy prévoit d’injecter la dose oubliée dès que possible dans les 5 jours suivant l’oubli. Au-delà, saute-la et reprends au jour habituel.',
  ozempic: 'La notice d’Ozempic prévoit d’injecter la dose oubliée dès que possible dans les 5 jours suivant l’oubli. Au-delà, saute-la et reprends au jour habituel.'
};
const PRESETS = [
  { key: 'mounjaro', name: 'Mounjaro', molecule: 'tirzépatide', unit: 'mg', intervalDays: 7, halfLifeH: 120, tmaxH: 24, doses: [2.5, 5, 7.5, 10, 12.5, 15], color: '#E5487A', penDoses: 4, penDays: 30 },
  { key: 'wegovy', name: 'Wegovy', molecule: 'sémaglutide', unit: 'mg', intervalDays: 7, halfLifeH: 168, tmaxH: 48, doses: [0.25, 0.5, 1, 1.7, 2.4], color: '#2F80ED', penDoses: '', penDays: '' },
  { key: 'ozempic', name: 'Ozempic', molecule: 'sémaglutide', unit: 'mg', intervalDays: 7, halfLifeH: 168, tmaxH: 48, doses: [0.25, 0.5, 1, 2], color: '#7B61FF', penDoses: '', penDays: '' },
  { key: 'saxenda', name: 'Saxenda', molecule: 'liraglutide', unit: 'mg', intervalDays: 1, halfLifeH: 13, tmaxH: 11, doses: [0.6, 1.2, 1.8, 2.4, 3], color: '#E8833A', penDoses: '', penDays: '' },
  { key: 'custom', name: '', molecule: '', unit: 'mg', intervalDays: 7, halfLifeH: '', tmaxH: '', doses: [], color: '#0FA3A3', penDoses: '', penDays: '' }
];
// Prix publics indicatifs par stylo (avis JO du 28 mai 2026, applicables au 15 juin 2026). Simple pré-remplissage modifiable.
const PRICES = { mounjaro: { 2.5: 176.10, 5: 237.68, 7.5: 335.95, 10: 335.95, 12.5: 433.80, 15: 433.80 }, wegovy: { 0.25: 146.91, 0.5: 146.91, 1: 146.91, 1.7: 169.31, 2.4: 195.10 } };
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
// [libellé, emoji, échelle d'intensité ?, groupe]
const FEEL = [
  ['Tout va bien', '✨', 0, 'g'],
  ['Nausées', '🤢', 1, 'd'], ['Vomissements', '🤮', 1, 'd'], ['Constipation', '😣', 1, 'd'], ['Diarrhée', '💧', 1, 'd'], ['Reflux', '🔥', 1, 'd'], ['Ballonnements', '🎈', 1, 'd'], ['Jour sans selle', '🚽', 0, 'd'],
  ['Fatigue', '😴', 1, 'e'], ['Maux de tête', '🤕', 1, 'e'], ['Vertiges', '💫', 1, 'e'], ['Sommeil perturbé', '🌙', 1, 'e'], ['Humeur basse', '🌧️', 1, 'e'], ['Anxiété', '😟', 1, 'e'], ['Frissons ou bouffées de chaleur', '🥶', 1, 'e'],
  ['Appétit coupé', '🍽️', 1, 'a'], ['Pensées alimentaires', '💭', 1, 'a'], ['Fringales', '🍫', 1, 'a'], ['Goût modifié', '👅', 1, 'a'],
  ['Point d’injection irrité', '📍', 1, 'o'], ['Perte de cheveux', '💇', 1, 'o'], ['Cycle perturbé', '🩸', 1, 'o'], ['Alcool', '🍷', 0, 'o'], ['Autre', '✏️', 1, 'o']
];
const FEEL_G = { g: '', d: 'Digestion', e: 'Énergie et humeur', a: 'Appétit', o: 'Autre' };
const GOOD = 'Tout va bien';
const LEVELS = ['', 'Léger', 'Gênant', 'Fort'];
const feelOf = t => FEEL.find(f => f[0] === String(t).replace(/'/g, '’'));
const emo = t => (feelOf(t) || [0, '•'])[1];
const isEffect = t => { const f = feelOf(t); return f ? f[2] === 1 : true; };
const HAB = {
  p: { label: 'Protéines', unit: 'g', color: 'var(--prot)', icon: 'egg', portions: [['Œuf', 6], ['Skyr ou yaourt grec (150 g)', 15], ['Fromage blanc (100 g)', 8], ['Blanc de poulet (100 g)', 25], ['Poisson (100 g)', 20], ['Thon en boîte (100 g)', 25], ['Jambon (2 tranches)', 14], ['Fromage (30 g)', 7], ['Lentilles cuites (150 g)', 13], ['Tofu (100 g)', 12], ['Lait (250 mL)', 8], ['Shaker protéiné', 25]] },
  w: { label: 'Eau', unit: 'mL', color: 'var(--eau)', icon: 'water', portions: [['Verre', 250], ['Petite bouteille', 500], ['Thé ou tisane', 200], ['Grande bouteille', 1000]] },
  f: { label: 'Fibres', unit: 'g', color: 'var(--fib)', icon: 'leaf', portions: [['Fruit', 3], ['Portion de légumes', 3], ['Pain complet (2 tranches)', 4], ['Flocons d’avoine (40 g)', 4], ['Légumineuses (150 g cuites)', 10], ['Amandes ou noix (30 g)', 3], ['Graines de chia (1 c. à s.)', 4], ['Riz ou pâtes complets (150 g cuits)', 3]] },
  s: { label: 'Renforcement', unit: 'séance', color: 'var(--renfo)', icon: 'dumbbell', portions: [['Séance de renforcement', 1]] }
};
const habFmt = (k, v) => k === 'w' ? fr(v / 1000, 2) + ' L' : k === 's' ? fr(v, 0) : fr(v, 0) + ' g';

/* ---------- Données ---------- */
function blank() {
  return { v: 3, onboarded: false, profile: { name: '', height: '', goal: '', maintMax: '' }, settings: { hideWeight: false, female: true },
    goals: { p: 80, w: 1500, f: 30, s: 3 }, treatments: [], injections: [], weights: [], symptoms: [], intake: [], measures: [], questions: [],
    costs: [], photos: [], appt: '', rxEnd: '', lastBackup: '', dismissed: {} };
}
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY)) || {}, b = blank();
    const d = Object.assign(b, raw);
    d.profile = Object.assign(blank().profile, raw.profile || {});
    d.settings = Object.assign(blank().settings, raw.settings || {});
    d.goals = Object.assign(blank().goals, raw.goals || {});
    d.dismissed = raw.dismissed || {};
    d.treatments.forEach(t => {
      if (OLD_COLORS[t.color]) t.color = OLD_COLORS[t.color];
      if (t.penDoses === undefined) { const p = PRESETS.find(x => x.key === t.preset); t.penDoses = p ? p.penDoses : ''; t.penDays = p ? p.penDays : ''; }
    });
    d.symptoms.forEach(s => { s.type = String(s.type).replace(/'/g, '’'); });
    return d;
  } catch (e) { return blank(); }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Enregistrement impossible : stockage plein ou bloqué', true); } }

let S = load();
let tab = 'home', focusT = null, jFilter = 'all', range = 90, firstHome = true, peek = false, repDays = 90;
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
const intake = (k, day = today()) => sum(S.intake.filter(i => i.k === k && i.date === day).map(i => i.v));
const sessionsWeek = () => { const ws = weekStart(); return sum(S.intake.filter(i => i.k === 's' && i.date >= ws).map(i => i.v)); };
const hidden = () => S.settings.hideWeight && !peek;

/* ---------- Photos (IndexedDB, jamais envoyées) ---------- */
const IDB = (() => {
  let dbp;
  const open = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open('cadence', 1); r.onupgradeneeded = () => r.result.createObjectStore('files', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const run = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction('files', mode), rq = fn(t.objectStore('files')); t.oncomplete = () => res(rq && rq.result); t.onerror = () => rej(t.error); }); };
  return { put: f => run('readwrite', s => s.put(f)), del: id => run('readwrite', s => s.delete(id)), all: () => run('readonly', s => s.getAll()) };
})();
const URLS = new Map();
async function loadPhotos() {
  try { (await IDB.all() || []).forEach(f => { if (!URLS.has(f.id)) URLS.set(f.id, URL.createObjectURL(f.blob)); }); } catch (e) { }
  if (S.onboarded && (tab === 'progress' || stack.length)) { fillImgs(); }
}
function fillImgs(root = document) { $$('img[data-ph]', root).forEach(i => { const u = URLS.get(i.dataset.ph); if (u && i.src !== u) { i.onload = () => i.classList.add('ld'); i.src = u; } }); }
async function shrink(file, max = 1400) {
  const url = URL.createObjectURL(file), img = new Image(); img.src = url;
  await img.decode();
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
  return new Promise(r => c.toBlob(r, 'image/jpeg', .82));
}

/* ---------- Calculs ---------- */
function kaFor(ke, tmax) {
  let lo = ke * 1.0001, hi = ke * 500;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2, tm = Math.log(m / ke) / (m - ke); if (tm > tmax) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
function levelAt(t, ms) {
  const hl = num(t.halfLifeH); if (!(hl > 0)) return null;
  const ke = Math.LN2 / hl, tm = num(t.tmaxH), ka = tm > 0 ? kaFor(ke, tm) : null;
  let s = 0;
  for (const i of S.injections) {
    if (i.tid !== t.id) continue;
    const h = (ms - D(i.date).getTime()) / 36e5; if (h < 0) continue;
    s += ka ? i.dose * ka / (ka - ke) * (Math.exp(-ke * h) - Math.exp(-ka * h)) : i.dose * Math.exp(-ke * h);
  }
  return s;
}
function rotation(tid) {
  const used = injOf(tid).map(i => i.site).filter(Boolean);
  let best = SITES[0], score = -1;
  for (const s of SITES) { const idx = used.indexOf(s.id); const sc = idx === -1 ? 1e9 : idx; if (sc > score) { score = sc; best = s; } }
  return { next: best.id, last: used[0] || null };
}
function lastUse(tid, site) { const i = injOf(tid).find(x => x.site === site); return i ? daysBetween(i.date, today()) : null; }
const interval = t => Math.max(1, Math.round(num(t.intervalDays) || 7));
function status(t) {
  const last = injOf(t.id)[0]; if (!last) return { last: null };
  const n = interval(t), due = D(last.date).getTime() + n * DAY;
  return { last, n, due, elapsed: daysBetween(last.date, today()), dueIn: daysBetween(today(), new Date(due)) };
}
function steps(t) {
  const st = [];
  injOf(t.id).slice().reverse().forEach(i => { const s = st[st.length - 1]; if (s && s.dose === i.dose) s.n++; else st.push({ dose: i.dose, from: i.date, n: 1 }); });
  return st;
}
function penInfo(t) {
  const per = num(t.penDoses); if (!(per > 0) || !t.pen) return null;
  const days = num(t.penDays), exp = days > 0 ? addDays(t.pen.opened, days) : null;
  return { per, used: t.pen.used, opened: t.pen.opened, exp, expIn: exp ? daysBetween(today(), exp) : null, done: t.pen.used >= per };
}
function advancePen(t, date) {
  const per = num(t.penDoses); if (!(per > 0)) return;
  const day = dayKey(date), p = penInfo(t);
  const expired = p && p.exp && day > p.exp;
  if (!p || p.done || expired) t.pen = { opened: day, used: 1 }; else t.pen.used++;
}
// Effets rapportés au jour du cycle d'injection et au palier de dose
function effectStats(t, days = 120) {
  const inj = injOf(t.id).slice().reverse(), n = interval(t), from = addDays(today(), -days);
  const rows = [];
  for (const s of S.symptoms) {
    if (!isEffect(s.type) || s.date < from) continue;
    let ref = null; for (const i of inj) { if (dayKey(i.date) <= s.date) ref = i; else break; }
    if (!ref) continue;
    const dIdx = daysBetween(ref.date, s.date) + 1; if (dIdx > n) continue;
    rows.push({ type: s.type, day: dIdx, dose: ref.dose, level: s.level || 1 });
  }
  return { rows, n };
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
    s += `<path class="arc ${cls}" pathLength="1" d="${arcPath(c, c, R, a0, a1)}"${anim ? ` style="animation-delay:${i * 70}ms"` : ''}/>`;
  }
  return s;
}
function spark(vals, color) {
  if (vals.length < 2) return '';
  const lo = Math.min(...vals), hi = Math.max(...vals), r = hi - lo || 1;
  const p = vals.map((v, i) => [i / (vals.length - 1) * 100, 26 - (v - lo) / r * 22]);
  return `<svg class="spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><path d="${mono(p)}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
}
function alertBox({ c = 'var(--niv)', icon = 'info', title, text, acts = [], dismiss, cadi: ce }) {
  return `<div class="alert${ce ? ' with-cadi' : ''}" style="--c:${c}">${ce ? cadi({ size: 52, expr: ce }) : ic(icon)}<div style="flex:1;padding-right:${dismiss ? 26 : 0}px"><b>${title}</b>${text ? `<p>${text}</p>` : ''}${acts.length ? `<div class="acts2">${acts.map(a => `<button data-act="${a.act}"${a.id ? ` data-id="${esc(a.id)}"` : ''}>${a.label}</button>`).join('')}</div>` : ''}</div>${dismiss ? `<button class="x dismiss" data-act="dismiss" data-id="${esc(dismiss)}" aria-label="Masquer">${ic('close')}</button>` : ''}</div>`;
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
    app.innerHTML = `<div class="page${animIn && !REDUCED ? ' anim ' + (tabDir > 0 ? 'r' : 'l') : ''}">${({ home: vHome, journal: vJournal, progress: vProgress, more: vMore })[tab]()}</div>`;
  }
  mounts.forEach(f => f());
  fillImgs(app);
  animateCounts(app); syncSegs(app);
  animIn = false; tabPop = false;
  onScroll();
}
function renderTabs() {
  const it = [['home', 'Aujourd’hui', 'today'], ['journal', 'Journal', 'journal'], ['fab'], ['progress', 'Progrès', 'progress'], ['more', 'Plus', 'more']];
  $('#tabs').innerHTML = '<div class="in">' + it.map(([k, l, i]) => k === 'fab'
    ? `<button class="fab" data-act="fab" aria-label="Ajouter une entrée"><span>${ic('plus')}</span></button>`
    : `<button data-tab="${k}" ${tab === k ? 'aria-current="page"' : ''}${tab === k && tabPop ? ' class="pop"' : ''}>${ic(i)}<span>${l}</span></button>`).join('') + '</div>';
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
  if (act.length && !act.some(t => t.id === focusT)) focusT = act[0].id;
  let h = `<div class="hello"><div><p class="kicker">${cap(dfmt(new Date()))}</p><h1 class="lt" data-short="Aujourd’hui">${hi}</h1></div>${cadiFor(act.length ? T(focusT) : null)}<div class="say" id="say" role="status" hidden></div></div>`;
  mounts.push(() => {
    const k = 'cadi-hello-' + today(), t = T(focusT), st = t ? status(t) : null;
    let seen = false; try { seen = sessionStorage.getItem(k); sessionStorage.setItem(k, '1'); } catch (e) { }
    const strong = S.symptoms.some(s => s.level === 3 && daysBetween(s.date, today()) <= 1);
    if (!seen && ((st && st.last && st.dueIn <= 0) || strong)) setTimeout(() => { const [tx, ex] = cadiTips()[0]; say(tx, ex); cadiJelly($('.hello .cadi')); }, 900);
  });
  if (!S.treatments.length) return h + `<div class="card empty">${cadi({ size: 84 })}<b>Aucun traitement en cours</b><p>Ajoute ton traitement pour suivre tes injections, ta rotation et ton niveau estimé.</p><button class="btn" data-act="newT">Ajouter un traitement</button></div>` + habitsCard();
  if (!act.length) { h += maintenance(); h += homeAlerts(null); h += habitsCard(); h += `<div class="grid">${tileWeight()}${tileFeel()}</div>`; return h + lateAlerts(); }
  if (!act.some(t => t.id === focusT)) focusT = act[0].id;
  const t = T(focusT), st = status(t);
  if (act.length > 1) h += `<div class="seg" style="margin-bottom:12px">${act.map(x => `<button data-focus="${x.id}" aria-pressed="${x.id === focusT}">${esc(x.name)}</button>`).join('')}</div>`;
  h += hero(t, st);
  h += homeAlerts(t, st);
  h += habitsCard();
  h += `<div class="grid">${tileWeight()}${tileLevel(t, st)}${tileFeel()}${tilePen(t, st)}</div>`;
  h += lateAlerts();
  firstHome = false;
  return h;
}
function maintenance() {
  const w = weightsAsc(), last = w[w.length - 1], max = num(S.profile.maintMax), lastInj = byDateDesc(S.injections)[0];
  const over = last && max > 0 && last.kg > max;
  return `<section class="card hero" style="--c:var(--poids);text-align:left">
    <p class="kicker" style="margin:0 0 4px">Mode maintien</p>
    <p class="when" style="font-size:22px">${last && !hidden() ? `${fr1(last.kg)} kg` : 'Ton suivi continue'}</p>
    <p class="meta" style="margin-bottom:14px">${lastInj ? `Dernière injection ${relDay(lastInj.date)}. ` : ''}${max > 0 ? (over ? `<b style="color:var(--red)">Au-dessus de ta fourchette (${fr1(max)} kg).</b> C’est un bon sujet à aborder avec ton médecin.` : `Fourchette que tu t’es fixée : jusqu’à ${fr1(max)} kg.`) : 'Fixe une fourchette de poids dans Plus pour être prévenue si tu en sors.'}</p>
    <div class="acts"><button class="btn poids" data-act="newW">${ic('scale')}Noter mon poids</button><button class="btn tint sq" data-act="profile" aria-label="Régler la fourchette">${ic('target')}</button></div></section>`;
}
function hero(t, st) {
  const rot = rotation(t.id), anim = firstHome && !REDUCED;
  let center, when, meta, ring, cls = '';
  if (!st.last) {
    const n = interval(t);
    ring = ringArcs(n, 0, -1, false, anim);
    center = `<div class="n">${ic('pen')}</div><div class="u">Aucune injection notée</div>`;
    when = 'Note ta première injection';
    meta = 'Le compte à rebours démarre ensuite, ' + freqTxt(n) + '.';
  } else {
    const { n, elapsed, dueIn, last } = st, late = dueIn < 0, due = dueIn === 0;
    ring = ringArcs(n, late || due ? n : Math.min(elapsed, n), late || due ? -1 : elapsed, late, anim);
    if (late) { cls = ' late'; center = `<div class="n">${cnt('late:' + t.id, -dueIn, 'int', anim ? 0 : undefined)}</div><div class="u">jour${-dueIn > 1 ? 's' : ''} de retard</div>`; }
    else if (due) { cls = ' due'; center = `<div class="n w">Jour J</div><div class="u">c’est aujourd’hui</div>`; }
    else center = `<div class="n">${cnt('ring:' + t.id, dueIn, 'int', anim ? n : undefined)}</div><div class="u">${dueIn > 1 ? 'jours restants' : 'jour restant'}</div>${n > 1 ? `<div class="d">jour ${elapsed + 1} sur ${n}</div>` : ''}`;
    when = (late || due ? 'Injection prévue ' : 'Prochaine injection ') + relDay(new Date(st.due));
    meta = `Dernière : ${fmtDose(last.dose, esc(t.unit))}, ${relDay(last.date)}.<br>Zone conseillée : ${siteLabel(rot.next).toLowerCase()}.`;
  }
  return `<section class="card hero" style="--c:${esc(t.color)}">
    <div class="ring${anim ? ' anim' : ''}${cls}" data-act="replayRing" data-id="${t.id}"><svg viewBox="0 0 236 236" aria-hidden="true">${ring}</svg><div class="c">${center}</div></div>
    <p class="when">${cap(when)}</p><p class="meta">${meta}</p>
    <div class="acts"><button class="btn" data-act="newInj" data-id="${t.id}">${ic('pen')}Noter l’injection</button>${st.last ? `<button class="btn tint sq" data-act="ics" data-id="${t.id}" aria-label="Ajouter les rappels au calendrier">${ic('bell')}</button>` : ''}</div>
  </section>`;
}
function homeAlerts(t, st) {
  let h = '';
  if (t && st && st.last && st.dueIn < 0) {
    h += alertBox({ c: 'var(--red)', icon: 'info', cadi: 'worried', title: 'Injection oubliée ou décalée ?', text: (MISS[t.preset] || 'Les consignes en cas d’oubli figurent dans la notice de ton traitement.') + ' En cas de doute, demande à ton pharmacien.', acts: [{ label: 'Noter l’injection', act: 'newInj', id: t.id }] });
  }
  if (t && st && st.last) {
    const inj = injOf(t.id), last = inj[0], prev = inj[1];
    const up = !prev ? false : last.dose > prev.dose;
    const key = 'palier:' + last.id;
    if (up && daysBetween(last.date, today()) < 28 && !S.dismissed[key]) {
      let txt = `Les effets digestifs reviennent souvent quelques jours après une augmentation de dose. Note-les pour en parler à ton médecin.`;
      if (S.settings.female && t.preset === 'mounjaro') txt += `<br><br>Contraception : la notice de Mounjaro conseille, si tu prends une pilule, d’utiliser une méthode non orale ou d’ajouter une méthode barrière pendant 4 semaines après chaque augmentation de dose. Parles-en à ton médecin.`;
      h += alertBox({ title: `Nouveau palier : ${fmtDose(last.dose, esc(t.unit))}`, text: txt, dismiss: key });
    }
  }
  const strong = S.symptoms.find(s => s.level === 3 && daysBetween(s.date, today()) <= 3);
  if (strong) h += alertBox({ c: 'var(--red)', icon: 'alert', cadi: 'sleepy', title: `Ressenti fort : ${esc(strong.type.toLowerCase())}`, text: 'S’il persiste ou t’inquiète, parles-en à ton médecin ou ton pharmacien. En cas d’urgence, appelle le 15.', acts: [{ label: 'Quand consulter', act: 'info', id: 'signes' }, { label: 'Ajouter à mes questions', act: 'qFrom', id: strong.id }] });
  return h;
}
function lateAlerts() {
  let h = '';
  if (S.appt && daysBetween(today(), S.appt) >= 0 && daysBetween(today(), S.appt) <= 10) {
    const open = S.questions.filter(x => !x.done).length;
    h += alertBox({ c: 'var(--inj)', icon: 'steth', title: `Rendez-vous ${relDay(S.appt)} à ${tfmt(S.appt)}`, text: open ? `${open} question${open > 1 ? 's' : ''} préparée${open > 1 ? 's' : ''}.` : 'Prépare tes questions et ton rapport.', acts: [{ label: 'Mes questions', act: 'questions' }, { label: 'Rapport', act: 'report' }] });
  }
  if (S.rxEnd && daysBetween(today(), S.rxEnd) <= 10) h += alertBox({ c: 'var(--inj)', icon: 'doc', title: daysBetween(today(), S.rxEnd) < 0 ? 'Ordonnance expirée' : `Ordonnance jusqu’au ${dfmt(S.rxEnd, { day: 'numeric', month: 'long' })}`, text: 'Pense à prendre rendez-vous pour la renouveler.', acts: [{ label: 'Modifier', act: 'costs' }] });
  const n = S.injections.length + S.weights.length + S.symptoms.length, key = 'backup:' + today().slice(0, 7);
  if (n >= 10 && (!S.lastBackup || daysBetween(S.lastBackup, today()) > 30) && !S.dismissed[key]) h += alertBox({ icon: 'share', title: 'Pense à sauvegarder ton carnet', text: 'Tes données ne sont que sur ce téléphone. Une sauvegarde par mois suffit.', acts: [{ label: 'Exporter maintenant', act: 'exp' }], dismiss: key });
  return h;
}
function habitsCard() {
  const g = S.goals, row = (k, val, goal, sub) => {
    const H = HAB[k], p = goal > 0 ? Math.min(1, val / goal) : 0, ok = goal > 0 && val >= goal, was = PREV.get('ok:' + k);
    PREV.set('ok:' + k, ok);
    return `<div class="hab${ok ? ' ok' : ''}${ok && was === false ? ' new' : ''}" style="--c:${H.color}"><button class="bubble" style="--c:${H.color}" data-act="hab" data-id="${k}" aria-label="${H.label}">${ic(H.icon)}<span class="okb">${ic('check')}</span></button>
      <button class="m" data-act="hab" data-id="${k}" style="text-align:left"><span class="top">${H.label}<span><b>${cnt('hab:' + k, val, k === 'w' ? 'L' : k === 's' ? 'int' : 'g', animIn ? 0 : undefined)}</b>${goal > 0 ? ' / ' + habFmt(k, goal) : ''}${sub || ''}</span></span><span class="hbar" style="display:block"><i data-wk="hab${k}" data-w="${(p * 100).toFixed(1)}" style="width:${(p * 100).toFixed(0)}%"></i></span></button>
      <button class="plus" data-act="${k === 'w' ? 'quickW' : k === 's' ? 'quickS' : 'hab'}" data-id="${k}" aria-label="Ajouter : ${H.label}">${ic('plus')}</button></div>`;
  };
  return `<h2 class="h2">Mes habitudes du jour</h2><div class="card habits">${row('p', intake('p'), g.p)}${row('w', intake('w'), g.w)}${row('f', intake('f'), g.f)}${row('s', sessionsWeek(), g.s, ' cette sem.')}</div>`;
}
function tileWeight() {
  const w = weightsAsc(), last = w[w.length - 1];
  if (hidden() && last) return `<button class="tile" style="--c:var(--poids)" data-tab="progress"><span class="h">${ic('scale')}Poids</span><span class="v">${ic('eye')}</span><span class="s">Chiffres masqués. Pesée ${relDay(last.date)}.</span></button>`;
  return `<button class="tile" style="--c:var(--poids)" data-tab="progress"><span class="h">${ic('scale')}Poids</span>
    ${last ? `<span class="v">${cnt('tw', last.kg, 'd1')}<small>kg</small></span><span class="s">${w.length > 1 ? sgn(last.kg - w[0].kg) + ' kg depuis le début' : 'Pesée ' + relDay(last.date)}</span>${spark(w.slice(-12).map(x => x.kg), 'var(--poids)')}`
      : `<span class="v">–</span><span class="s">Note ta première pesée</span>`}</button>`;
}
function tileLevel(t, st) {
  if (!(num(t.halfLifeH) > 0) || !st.last) return `<button class="tile" style="--c:var(--niv)" data-act="${num(t.halfLifeH) > 0 ? 'newInj' : 'editT'}" data-id="${t.id}"><span class="h">${ic('drop')}Niveau</span><span class="v">–</span><span class="s">${num(t.halfLifeH) > 0 ? 'Apparaît après la première injection' : 'Renseigne la demi-vie pour l’estimer'}</span></button>`;
  const now = Date.now(), pts = []; for (let i = 0; i <= 40; i++) pts.push(levelAt(t, now - 14 * DAY + i * 14 * DAY / 40));
  return `<button class="tile" style="--c:var(--niv)" data-tab="progress"><span class="h">${ic('drop')}Niveau</span><span class="v">${cnt('tl:' + t.id, +levelAt(t, now).toFixed(2), 'd2')}<small>${esc(t.unit)}</small></span><span class="s">estimé, courbe théorique</span>${spark(pts, 'var(--niv)')}</button>`;
}
function tileFeel() {
  const wk = S.symptoms.filter(s => daysBetween(s.date, today()) < 7);
  const bad = wk.filter(s => isEffect(s.type)), last = byDateDesc(S.symptoms.filter(s => isEffect(s.type)))[0];
  let v, s;
  if (!S.symptoms.length) { v = '–'; s = 'Comment tu te sens ?'; }
  else if (!bad.length) { v = '✨'; s = 'Aucun effet noté cette semaine'; }
  else { v = `${bad.length}<small>cette semaine</small>`; s = `Dernier : ${esc(last.type.toLowerCase())}${last.level ? ', ' + LEVELS[last.level].toLowerCase() : ''}`; }
  return `<button class="tile" style="--c:var(--ress)" data-act="newS"><span class="h">${ic('face')}Ressentis</span><span class="v">${v}</span><span class="s">${s}</span></button>`;
}
function tilePen(t, st) {
  const p = penInfo(t), stock = t.stock !== '' && t.stock != null ? num(t.stock) : null;
  if (num(t.penDoses) > 0) {
    if (!p) return `<button class="tile" style="--c:var(--inj)" data-act="editT" data-id="${t.id}"><span class="h">${ic('pen')}Stylo</span><span class="v">–</span><span class="s">Démarre à ta prochaine injection${stock !== null ? `. ${fr(stock, 0)} dose${stock > 1 ? 's' : ''} en stock` : ''}</span></button>`;
    const warn = p.done || (p.expIn !== null && p.expIn <= 3), pk = 'pen:' + t.id, was = PREV.get(pk); PREV.set(pk, p.used);
    const s = p.done ? 'Stylo terminé : le liquide restant est normal, ne l’injecte pas' : p.exp ? (p.expIn < 0 ? 'Date d’utilisation dépassée' : `À jeter le ${dfmt(p.exp, { day: 'numeric', month: 'short' })}`) : `Ouvert ${relDay(p.opened)}`;
    return `<button class="tile" style="--c:${warn ? 'var(--red)' : 'var(--inj)'}" data-act="pen" data-id="${t.id}"><span class="h" style="color:var(--inj)">${ic('pen')}Stylo en cours</span><span class="pen">${Array.from({ length: p.per }, (_, i) => `<i class="${i < p.used ? 'u' : ''}${was !== undefined && i >= was && i < p.used ? ' new' : ''}"></i>`).join('')}</span><span class="s${warn ? ' warn' : ''}" style="margin-top:6px">${p.used} dose${p.used > 1 ? 's' : ''} sur ${p.per}. ${s}${stock !== null ? `. Stock : ${fr(stock, 0)}` : ''}</span></button>`;
  }
  if (stock !== null) {
    const low = stock <= 1, until = st.last && stock > 0 ? new Date(st.due + (stock - 1) * st.n * DAY) : null;
    return `<button class="tile" style="--c:${low ? 'var(--red)' : 'var(--inj)'}" data-act="editT" data-id="${t.id}"><span class="h">${ic('box')}Stock</span><span class="v">${fr(stock, 0)}<small>dose${stock > 1 ? 's' : ''}</small></span><span class="s${low ? ' warn' : ''}">${low ? 'Pense au renouvellement' : until ? 'Jusqu’au ' + dfmt(until, { day: 'numeric', month: 'long' }) : 'Restantes'}</span></button>`;
  }
  return `<button class="tile" style="--c:var(--inj)" data-act="editT" data-id="${t.id}"><span class="h">${ic('box')}Stock</span><span class="v">–</span><span class="s">Indique tes doses ou ton stylo pour savoir quand renouveler</span></button>`;
}

/* ---------- Journal ---------- */
function vJournal() {
  let h = `<h1 class="lt">Journal</h1><div class="seg" style="margin-bottom:6px">${[['all', 'Tout'], ['inj', 'Injections'], ['poids', 'Poids'], ['ress', 'Ressentis']].map(([k, l]) => `<button data-jf="${k}" aria-pressed="${jFilter === k}">${l}</button>`).join('')}</div>`;
  const items = [];
  if (jFilter === 'all' || jFilter === 'inj') items.push(...S.injections.map(o => ({ k: 'inj', d: D(o.date), o })));
  if (jFilter === 'all' || jFilter === 'poids') items.push(...S.weights.map(o => ({ k: 'poids', d: D(o.date), o })), ...S.measures.map(o => ({ k: 'mes', d: D(o.date), o })));
  if (jFilter === 'all' || jFilter === 'ress') items.push(...S.symptoms.map(o => ({ k: 'ress', d: D(o.date), o })));
  items.sort((a, b) => b.d - a.d || (a.k === 'inj' ? -1 : 1));
  if (!items.length) {
    const e = { all: ['journal', 'Ton journal est vide', 'Tout ce que tu notes apparaît ici, jour par jour.', 'fab', 'Ajouter une entrée'], inj: ['pen', 'Aucune injection', 'Chaque injection notée alimente le compte à rebours, le stylo et la rotation des zones.', 'newInj', 'Noter une injection'], poids: ['scale', 'Aucune pesée', 'Pèse-toi le même jour chaque semaine pour une courbe lisible.', 'newW', 'Noter mon poids'], ress: ['face', 'Aucun ressenti', 'Note ce que tu ressens : c’est utile pour en parler à ton médecin.', 'newS', 'Noter un ressenti'] }[jFilter];
    return h + `<div class="card empty" style="margin-top:14px">${cadi({ size: 84 })}<b>${e[1]}</b><p>${e[2]}</p><button class="btn" data-act="${e[3]}">${e[4]}</button></div>`;
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
function measTxt(m) {
  return [['waist', 'taille'], ['hips', 'hanches'], ['thigh', 'cuisse'], ['arm', 'bras']].filter(([k]) => num(m[k]) > 0).map(([k, l]) => `${l} ${fr(m[k])} cm`).concat(num(m.lean) > 0 ? [`masse maigre ${fr1(m.lean)} kg`] : []).join(', ');
}
function row(it, prevW) {
  const o = it.o;
  if (it.k === 'inj') {
    const t = T(o.tid) || { name: 'Traitement supprimé', unit: '', color: '#8E8E93' };
    return `<button class="row has-ic" data-entry="injections:${o.id}"><span class="bubble" style="--c:${esc(t.color)}">${ic('pen')}</span><span class="t"><b>${esc(t.name)}</b><span>${tfmt(o.date)}${o.site ? ', ' + siteLabel(o.site).toLowerCase() : ''}${o.note ? ' — ' + esc(o.note) : ''}</span></span><span class="val">${fmtDose(o.dose, esc(t.unit))}</span></button>`;
  }
  if (it.k === 'poids') {
    const p = prevW[o.id];
    return `<button class="row has-ic" data-entry="weights:${o.id}"><span class="bubble" style="--c:var(--poids)">${ic('scale')}</span><span class="t"><b>Poids</b><span>${hidden() ? 'Chiffres masqués' : p == null ? 'Première pesée' : sgn(o.kg - p) + ' kg depuis la précédente'}</span></span><span class="val">${hidden() ? '•••' : fr1(o.kg) + ' kg'}</span></button>`;
  }
  if (it.k === 'mes') return `<button class="row has-ic" data-entry="measures:${o.id}"><span class="bubble" style="--c:var(--poids)">${ic('ruler')}</span><span class="t"><b>Mensurations</b><span>${measTxt(o)}</span></span></button>`;
  return `<button class="row has-ic" data-entry="symptoms:${o.id}"><span class="bubble emo">${emo(o.type)}</span><span class="t"><b>${esc(o.type)}</b><span>${o.level ? LEVELS[o.level] : isEffect(o.type) ? 'Noté' : 'Repère'}${o.note ? ' — ' + esc(o.note) : ''}</span></span></button>`;
}

/* ---------- Progrès ---------- */
function vProgress() {
  let h = `<h1 class="lt">Progrès</h1><div class="seg">${[[30, '1 mois'], [90, '3 mois'], [180, '6 mois'], [0, 'Tout']].map(([k, l]) => `<button data-range="${k}" aria-pressed="${range === k}">${l}</button>`).join('')}</div>`;
  const all = weightsAsc(), from = range ? Date.now() - range * DAY : -Infinity;
  const ws = all.filter(w => D(w.date).getTime() >= from);
  h += `<h2 class="h2">Poids <button data-act="newW">Ajouter</button></h2>`;
  if (hidden() && all.length) h += `<div class="card empty">${ic('eye')}<b>Chiffres de poids masqués</b><p>Tu as choisi de ne pas afficher ton poids. Tes habitudes et tes mensurations restent visibles.</p><button class="btn plain" data-act="peek">Afficher pour cette fois</button></div>`;
  else if (all.length < 2) h += `<div class="card empty">${cadi({ size: 72 })}<b>${all.length ? 'Encore une pesée' : 'Pas encore de pesée'}</b><p>La courbe apparaît à partir de deux pesées.</p><button class="btn poids" data-act="newW">Noter mon poids</button></div>`;
  else {
    const last = all[all.length - 1], first = all[0], wk = (D(last.date) - D(first.date)) / (7 * DAY);
    const hm = num(S.profile.height) / 100, goal = num(S.profile.goal);
    let goalHtml = '';
    if (goal > 0 && first.kg > goal) { const tot = first.kg - goal, doneKg = Math.max(0, first.kg - last.kg), p = Math.min(1, doneKg / tot); goalHtml = `<p class="goal"><b>${fr1(doneKg)} kg</b> sur ${fr1(tot)} kg vers ton objectif de ${fr1(goal)} kg</p><div class="pbar"><i style="width:${(p * 100).toFixed(1)}%"></i></div>`; }
    const rec4 = all.filter(x => daysBetween(x.date, last.date) <= 28);
    const rate4 = rec4.length >= 2 ? (rec4[rec4.length - 1].kg - rec4[0].kg) / Math.max(1, daysBetween(rec4[0].date, rec4[rec4.length - 1].date) / 7) : null;
    h += `<div class="card chart-card">${ws.length >= 2 ? weightChart(ws, goal) : `<p class="readout"><span class="d">Pas assez de pesées sur cette période.</span></p>`}
      <div class="stats"><div><b>${sgn(last.kg - first.kg)}</b><span>kg, soit ${fr1(Math.abs((last.kg - first.kg) / first.kg * 100))} %</span></div><div><b>${rate4 !== null ? sgn(rate4) : '–'}</b><span>kg/sem. sur 4 sem.</span></div><div><b>${hm > 0 ? fr1(last.kg / (hm * hm)) : '–'}</b><span>${hm > 0 ? 'IMC' : 'IMC (ajoute ta taille)'}</span></div></div>${goalHtml}</div>`;
    const rec = all.filter(x => daysBetween(x.date, last.date) <= 21);
    if (rec.length >= 3 && wk >= 3) { const ks = rec.map(x => x.kg); if (Math.max(...ks) - Math.min(...ks) < .6) h += alertBox({ c: 'var(--poids)', icon: 'progress', title: 'Palier possible', text: 'Ton poids varie de moins de 600 g depuis 3 semaines. Le rythme ralentit souvent avec le temps ; regarde aussi tes mensurations et tes habitudes, et parles-en à ton prochain rendez-vous.' }); }
  }
  h += measuresCard();
  h += photosCard();
  const act = active(); if (act.length && !act.some(t => t.id === focusT)) focusT = act[0].id;
  const t = T(focusT) || S.treatments[0];
  if (t) {
    h += `<h2 class="h2">${esc(t.name)}</h2>`;
    if (act.length > 1) h += `<div class="seg" style="margin-bottom:12px">${act.map(x => `<button data-focus="${x.id}" aria-pressed="${x.id === t.id}">${esc(x.name)}</button>`).join('')}</div>`;
    const inj = injOf(t.id);
    if (num(t.halfLifeH) > 0 && inj.length) h += `<div class="card chart-card" style="--c:${esc(t.color)}">${levelChart(t)}<p class="foot-note" style="margin:10px 0 0">Courbe théorique calculée avec une demi-vie de ${fr(t.halfLifeH, 0)} h. Elle ne reflète pas ton taux réel.</p></div>`;
    if (inj.length) h += `<p class="lab">Paliers de dose</p><div class="group">${steps(t).reverse().map((s, i) => `<div class="row"><span class="t"><b class="num" style="font-size:17px">${fmtDose(s.dose, esc(t.unit))}</b><span>${i === 0 ? 'Depuis le' : 'À partir du'} ${dfmt(s.from, { day: 'numeric', month: 'long' })}</span></span><span style="font-size:15px;color:var(--label2)">${s.n} injection${s.n > 1 ? 's' : ''}</span></div>`).join('')}</div>`;
    else h += `<div class="card empty">${cadi({ size: 72, done: 0 })}<b>Aucune injection notée</b><p>Le niveau estimé et tes paliers de dose apparaîtront ici.</p><button class="btn" data-act="newInj" data-id="${t.id}">Noter une injection</button></div>`;
    h += effectsByDay(t);
  }
  h += habitsHistory();
  const d30 = S.symptoms.filter(s => daysBetween(s.date, today()) < 30);
  if (d30.length) {
    const cnt = {}; d30.filter(s => isEffect(s.type)).forEach(s => cnt[s.type] = (cnt[s.type] || 0) + 1);
    const top5 = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 6), mx = top5.length ? top5[0][1] : 1, good = d30.filter(s => s.type === GOOD).length;
    h += `<h2 class="h2">Ressentis <button data-act="newS">Ajouter</button></h2><div class="card chart-card"><p class="readout" style="min-height:0"><span class="d">Sur les 30 derniers jours${good ? `, dont ${good} journée${good > 1 ? 's' : ''} sans souci` : ''}</span></p>
      ${top5.length ? top5.map(([k, v]) => `<div class="freq"><span class="e">${emo(k)}</span><span class="k">${esc(k)}</span><span class="b"><i style="width:${v / mx * 100}%"></i></span><span class="n">${v}</span></div>`).join('') : `<p style="font-size:15px;margin-top:6px">Aucun effet indésirable noté ✨</p>`}</div>`;
  }
  return h;
}
function effectsByDay(t) {
  const { rows, n } = effectStats(t);
  if (n < 2 || n > 14) return '';
  if (rows.length < 3) return `<p class="lab">Effets selon le jour d’injection</p><div class="card chart-card"><p style="font-size:15px;color:var(--label2);line-height:1.4">Note tes ressentis quelques semaines : tu verras ici à quels jours après l’injection ils reviennent, et s’ils changent avec le palier.</p></div>`;
  const cnt = {}; rows.forEach(r => cnt[r.type] = (cnt[r.type] || 0) + 1);
  const types = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0]);
  const grid = {}; let mx = 1;
  rows.forEach(r => { const k = r.type + '|' + r.day; grid[k] = (grid[k] || 0) + 1; mx = Math.max(mx, grid[k]); });
  let h = `<p class="lab">Effets selon le jour d’injection</p><div class="card chart-card"><div class="heat" style="--n:${n}"><span></span>${Array.from({ length: n }, (_, i) => `<span class="hd">J${i + 1}</span>`).join('')}`;
  types.forEach(ty => { h += `<span class="lb">${emo(ty)} ${esc(ty)}</span>`; for (let d = 1; d <= n; d++) { const v = grid[ty + '|' + d] || 0; h += `<span class="c" style="animation-delay:${(d * 35 + types.indexOf(ty) * 60)}ms;${v ? `background:color-mix(in srgb,var(--ress) ${Math.round(18 + 70 * v / mx)}%,var(--fill2))` : ''}">${v || ''}</span>`; } });
  h += `</div><p class="foot-note" style="margin:8px 0 0">J1 = jour de l’injection. Chiffre = nombre de fois où tu l’as noté (4 derniers mois).</p>`;
  const ins = [];
  types.forEach(ty => {
    const r = rows.filter(x => x.type === ty); if (r.length < 3) return;
    let best = 0, bd = 1; for (let d = 1; d < n; d++) { const c = r.filter(x => x.day === d || x.day === d + 1).length; if (c > best) { best = c; bd = d; } }
    if (best / r.length >= .6) ins.push(`${ty} : surtout noté à J${bd}–J${bd + 1} (${best} fois sur ${r.length}).`);
  });
  const st = steps(t);
  const rates = st.map((s, i) => {
    const end = i < st.length - 1 ? dayKey(st[i + 1].from) : today(), wks = Math.max(1, daysBetween(s.from, end) / 7);
    const c = rows.filter(r => r.dose === s.dose).length;
    return { dose: s.dose, wks, rate: c / wks, c };
  }).filter(x => x.wks >= 1 && (x.c > 0 || x.wks >= 2));
  if (rates.length >= 2) {
    const a = rates[rates.length - 2], b = rates[rates.length - 1];
    if (b.rate > a.rate * 1.3 && b.c >= 2) ins.push(`Depuis le passage à ${fmtDose(b.dose, esc(t.unit))}, tu notes plus d’effets (${fr1(b.rate)} par semaine contre ${fr1(a.rate)} à ${fmtDose(a.dose, esc(t.unit))}).`);
    else if (b.rate < a.rate * .7) ins.push(`À ${fmtDose(b.dose, esc(t.unit))}, tu notes moins d’effets qu’au palier précédent (${fr1(b.rate)} par semaine contre ${fr1(a.rate)}).`);
  }
  if (ins.length) h += ins.map(x => `<p class="insight">${ic('spark')}<span>${x}</span></p>`).join('');
  if (rates.length) { const mr = Math.max(...rates.map(r => r.rate), .1); h += `<p class="lab" style="margin:16px 0 4px">Effets notés par semaine, selon le palier</p>${rates.map(r => `<div class="rate"><span class="k">${fmtDose(r.dose, esc(t.unit))}</span><span class="b"><i style="width:${r.rate / mr * 100}%"></i></span><span class="n">${fr1(r.rate)} / sem.</span></div>`).join('')}`; }
  h += `<p class="foot-note" style="margin:10px 0 0">Constat sur tes propres notes, pas un avis médical. Utile à montrer à ton médecin.</p></div>`;
  return h;
}
function habitsHistory() {
  if (!S.intake.length) return '';
  const days = Array.from({ length: 14 }, (_, i) => addDays(today(), i - 13));
  const block = k => {
    const H = HAB[k], g = S.goals[k], vals = days.map(d => intake(k, d)), mx = Math.max(g || 0, ...vals, 1);
    const logged = vals.filter(v => v > 0), avg = logged.length ? sum(logged) / logged.length : 0, hit = g > 0 ? vals.filter(v => v >= g).length : 0;
    return `<div style="--c:${H.color};margin-top:18px"><div class="hstat"><b>${H.label}</b><span>${logged.length ? `moyenne ${habFmt(k, avg)} les jours notés${g > 0 ? `, objectif atteint ${hit} j sur 14` : ''}` : 'rien noté'}</span></div>
      <div class="bars">${g > 0 ? `<span class="goal-l" style="bottom:${(g / mx * 100).toFixed(1)}%"></span>` : ''}${vals.map((v, i) => `<i class="${v ? '' : 'off'}" style="height:${v ? Math.max(4, v / mx * 100) : 3}%;animation-delay:${i * 28}ms"></i>`).join('')}</div></div>`;
  };
  const wk = []; for (let i = 0; i < 4; i++) { const s = addDays(weekStart(), -7 * i), e = addDays(s, 6); wk.push(sum(S.intake.filter(x => x.k === 's' && x.date >= s && x.date <= e).map(x => x.v))); }
  return `<h2 class="h2">Habitudes <button data-act="hab" data-id="p">Ajouter</button></h2><div class="card chart-card" style="padding-top:0">${block('p')}${block('w')}${block('f')}
    <div class="hstat" style="margin-top:18px"><b>Renforcement</b><span>${wk.reverse().map(x => fr(x, 0)).join(' · ')} séances (4 dernières semaines)</span></div>
    <p class="foot-note" style="margin:10px 0 0">14 derniers jours. Pointillés : ton objectif.</p></div>`;
}
function measuresCard() {
  const ms = S.measures.slice().sort((a, b) => D(a.date) - D(b.date));
  if (!ms.length) return `<h2 class="h2">Mensurations <button data-act="newM">Ajouter</button></h2><div class="card chart-card"><p style="font-size:15px;color:var(--label2);line-height:1.4">Le tour de taille bouge parfois quand la balance stagne. Mesure-le toutes les 2 à 4 semaines.</p></div>`;
  const last = {}, first = {};
  [['waist', 'Tour de taille', 'cm'], ['hips', 'Hanches', 'cm'], ['thigh', 'Cuisse', 'cm'], ['arm', 'Bras', 'cm'], ['lean', 'Masse maigre', 'kg']].forEach(([k]) => { const f = ms.find(m => num(m[k]) > 0), l = ms.slice().reverse().find(m => num(m[k]) > 0); if (l) { last[k] = num(l[k]); first[k] = num(f[k]); } });
  const cells = [['waist', 'Tour de taille', 'cm'], ['hips', 'Hanches', 'cm'], ['thigh', 'Cuisse', 'cm'], ['arm', 'Bras', 'cm'], ['lean', 'Masse maigre', 'kg']].filter(([k]) => last[k] !== undefined)
    .map(([k, l, u]) => `<div><b>${fr(last[k])} ${u}</b><span>${l}</span>${last[k] !== first[k] ? `<em>${sgn(last[k] - first[k])}</em>` : ''}</div>`).join('');
  return `<h2 class="h2">Mensurations <button data-act="newM">Ajouter</button></h2><div class="card chart-card"><div class="meas">${cells}</div><p class="foot-note" style="margin:12px 0 0">Écart depuis la première mesure, le ${dfmt(ms[0].date, { day: 'numeric', month: 'long' })}.</p></div>`;
}
function photosCard() {
  const ps = S.photos.filter(p => p.kind === 'body').sort((a, b) => D(b.date) - D(a.date));
  return `<h2 class="h2">Photos <button data-act="addPhoto" data-id="body">Ajouter</button></h2><div class="card chart-card">
    ${ps.length ? '' : `<p style="font-size:15px;color:var(--label2);line-height:1.4">Une photo par mois, même tenue, même lumière : la comparaison parle souvent plus que la balance. Elles restent sur ce téléphone.</p>`}
    <div class="photos">${ps.slice(0, 8).map(p => `<button data-act="viewPhoto" data-id="${p.id}"><img data-ph="${p.id}" alt="Photo du ${dfmt(p.date, { day: 'numeric', month: 'long' })}"><small>${short(p.date)}</small></button>`).join('')}<button class="add" data-act="addPhoto" data-id="body">${ic('camera')}Ajouter</button></div></div>`;
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
    <path class="area" d="${path}L${p[p.length - 1][0].toFixed(1)} ${H - B}L${p[0][0].toFixed(1)} ${H - B}Z" fill="url(#${id}-g)"/>
    <path class="ln" pathLength="1" d="${path}" fill="none" stroke="var(--poids)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    ${ws.length <= 30 ? p.map((q, i) => `<circle class="pt" style="animation-delay:${(.25 + .9 * i / Math.max(1, p.length - 1)).toFixed(2)}s" cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="3" fill="var(--card)" stroke="var(--poids)" stroke-width="2"/>`).join('') : ''}
    ${inj}
    <line class="guide" y1="${Tp - 4}" y2="${H - B}"/><circle class="hdot" r="6" fill="var(--poids)" stroke="var(--card)" stroke-width="2.5"/>
    <text x="${L}" y="${H - 2}">${short(ws[0].date)}</text><text x="${W - R}" y="${H - 2}" text-anchor="end">${short(ws[ws.length - 1].date)}</text>
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
    <path class="area" d="${line(past)}L${x(now).toFixed(1)} ${H - 22}L${x(from).toFixed(1)} ${H - 22}Z" fill="url(#${id}-g)"/>
    <path class="ln" pathLength="1" d="${line(past)}" fill="none" stroke="var(--c)" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
    <path class="fut" d="${line(fut)}" fill="none" stroke="var(--c)" stroke-width="2.2" stroke-dasharray="2 5" stroke-linecap="round" opacity=".7"/>
    ${marks}
    <line class="guide" y1="4" y2="${H - 22}"/><circle class="hdot" r="6" fill="var(--c)" stroke="var(--card)" stroke-width="2.5"/>
    <text x="${P}" y="${H - 1}">il y a 3 sem.</text><text x="${x(now).toFixed(1)}" y="${H - 1}" text-anchor="middle">aujourd’hui</text><text x="${W - P}" y="${H - 1}" text-anchor="end">+7 j</text>
  </svg>`;
}

/* ---------- Plus ---------- */
function vMore() {
  const ts = S.treatments, open = S.questions.filter(q => !q.done).length, totalCost = sum(S.costs.map(c => c.paid)), rac = sum(S.costs.map(c => (+c.paid || 0) - (+c.secu || 0) - (+c.mut || 0)));
  const rowA = (act, icon, label, right = '', color = 'var(--inj)', id = '') => `<button class="row has-ic" data-act="${act}"${id ? ` data-id="${id}"` : ''}><span class="bubble" style="--c:${color}">${ic(icon)}</span><span class="t"><b style="font-weight:500">${label}</b></span>${right}${ic('chev', 'chev')}</button>`;
  return `<h1 class="lt">Plus</h1>
  <p class="lab" style="margin-top:4px">Consultation</p>
  <div class="group">
    ${rowA('appt', 'cal', 'Prochain rendez-vous', `<span class="muted">${S.appt ? short(S.appt) : 'Aucun'}</span>`)}
    ${rowA('questions', 'question', 'Mes questions pour le médecin', open ? `<span class="badge">${open}</span>` : '')}
    ${rowA('report', 'print', 'Rapport pour le médecin')}
  </div>
  <p class="lab">Traitement</p>
  <div class="group">
    ${ts.map(t => `<button class="row has-ic" data-act="editT" data-id="${t.id}"><span class="bubble" style="--c:${esc(t.color)}">${ic('pen')}</span><span class="t"><b style="font-weight:500">${esc(t.name)}${t.archived ? ' (arrêté)' : ''}</b><span>${t.molecule ? esc(t.molecule) + ', ' : ''}${freqTxt(num(t.intervalDays))}</span></span>${ic('chev', 'chev')}</button>`).join('')}
    <button class="row accent" data-act="newT">${ic('plus', 'ri')}Ajouter un traitement</button>
  </div>
  <div class="group" style="margin-top:12px">
    ${rowA('costs', 'euro', 'Dépenses et remboursement', S.costs.length ? `<span class="muted">${eur(rac)}</span>` : '', 'var(--poids)')}
    ${rowA('goals', 'target', 'Objectifs du jour', `<span class="muted">${S.goals.p} g, ${fr(S.goals.w / 1000, 1)} L</span>`, 'var(--prot)')}
  </div>
  <p class="lab">Infos pratiques</p>
  <div class="group">
    ${rowA('info', 'alert', 'Quand consulter', '', 'var(--red)', 'signes')}
    ${rowA('info', 'info', 'Oubli d’une dose', '', 'var(--niv)', 'oubli')}
    ${rowA('info', 'pen', 'Le stylo et le liquide restant', '', 'var(--niv)', 'stylo')}
    ${rowA('info', 'plane', 'Conservation et voyage', '', 'var(--niv)', 'voyage')}
    ${rowA('info', 'doc', 'Remboursement : le volet 3', '', 'var(--niv)', 'volet')}
    <a class="row has-ic" href="https://signalement.social-sante.gouv.fr" target="_blank" rel="noopener"><span class="bubble" style="--c:var(--label2)">${ic('ext')}</span><span class="t"><b style="font-weight:500">Déclarer un effet indésirable</b><span>Portail officiel de signalement</span></span></a>
  </div>
  <p class="lab">Profil</p>
  <div class="group">
    <div class="frow"><label for="p-name">Prénom</label><input id="p-name" data-prof="name" value="${esc(S.profile.name)}" placeholder="Facultatif" autocomplete="given-name" enterkeyhint="done"></div>
    <div class="frow"><label for="p-height">Taille</label><input id="p-height" data-prof="height" inputmode="decimal" value="${esc(S.profile.height)}" placeholder="–" enterkeyhint="done"><span class="unit">cm</span></div>
    <div class="frow"><label for="p-goal">Objectif de poids</label><input id="p-goal" data-prof="goal" inputmode="decimal" value="${esc(S.profile.goal)}" placeholder="–" enterkeyhint="done"><span class="unit">kg</span></div>
    <div class="frow"><label for="p-max">Fourchette de maintien, max.</label><input id="p-max" data-prof="maintMax" inputmode="decimal" value="${esc(S.profile.maintMax)}" placeholder="–" enterkeyhint="done"><span class="unit">kg</span></div>
    <button class="trow" data-act="toggle" data-id="hideWeight" role="switch" aria-checked="${S.settings.hideWeight}"><span>Masquer les chiffres de poids<small>Pour suivre tes habitudes sans la pression de la balance.</small></span><i class="switch"></i></button>
    <button class="trow" data-act="toggle" data-id="female" role="switch" aria-checked="${S.settings.female}"><span>Infos cycle et contraception<small>Affiche les rappels de la notice liés à la pilule et au cycle.</small></span><i class="switch"></i></button>
  </div>
  <p class="lab">Mes données</p>
  <div class="group">
    <button class="row accent" data-act="exp">${ic('share', 'ri')}Exporter une sauvegarde</button>
    <button class="row accent" data-act="csv">${ic('table', 'ri')}Exporter en tableau (CSV)</button>
    <button class="row accent" data-act="imp">${ic('restore', 'ri')}Restaurer une sauvegarde</button>
    <button class="row danger" data-act="wipe">${ic('trash', 'ri')}Tout effacer</button>
  </div>
  <p class="foot-note">${S.lastBackup ? `Dernière sauvegarde ${relDay(S.lastBackup)}. ` : 'Aucune sauvegarde pour l’instant. '}Tes données restent sur ce téléphone, dans ce navigateur : rien n’est envoyé, aucun compte. Les photos ne sont pas incluses dans la sauvegarde.</p>
  <p class="foot-note" style="margin-top:22px">Cadence est un carnet de suivi personnel. Il ne fournit ni diagnostic ni conseil de dosage : les doses et le rythme sont ceux de ta prescription. Pour toute question, adresse-toi à ton médecin ou ton pharmacien.</p>
  <p class="foot-note">L’ANSM rappelle que les analogues du GLP-1 et les « peptides » achetés hors du circuit officiel (sites internet, réseaux sociaux) sont illégaux et potentiellement dangereux.</p>`;
}

/* ---------- Feuilles ---------- */
const topS = () => stack[stack.length - 1];
const q = s => topS() && topS().querySelector(s);
function openSheet({ title = '', left = 'Annuler', right = '', rightAct = '', body = '', foot = '', small = false, color = '', cls = '' }) {
  const el = document.createElement('div');
  el.className = 'sheet' + (small ? ' small' : '') + (cls ? ' ' + cls : '');
  if (color) el.style.setProperty('--c', color);
  el.innerHTML = `<div class="bg" data-close></div><div class="box" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="drag"><div class="grab"><i></i></div><div class="nav"><button class="l" data-close>${left}</button><div class="ttl">${nb(title)}</div>${right ? `<button class="r" data-act="${rightAct}">${right}</button>` : '<span class="r"></span>'}</div></div>
    <div class="body">${body}</div>${foot ? `<div class="foot">${foot}</div>` : ''}</div>`;
  const first = !stack.length;
  document.body.appendChild(el); stack.push(el); document.body.classList.add('locked');
  if (first && $('#report').hidden) scaleBack(true);
  el.classList.add('fresh'); setTimeout(() => el.classList.remove('fresh'), 900);
  el.getBoundingClientRect(); requestAnimationFrame(() => el.classList.add('on'));
  dragify(el); fillImgs(el); animateCounts(el); requestAnimationFrame(() => syncSegs(el));
  return el;
}
function scaleBack(on) {
  const app = $('#app');
  if (on) { if (REDUCED) return; app.style.transformOrigin = `50% ${scrollY}px`; app.style.clipPath = `inset(${scrollY}px 0 0 0 round 16px)`; document.documentElement.classList.add('sheet-open'); }
  else { document.documentElement.classList.remove('sheet-open'); setTimeout(() => { if (!stack.length) { app.style.clipPath = ''; app.style.transformOrigin = ''; } }, 450); }
}
function closeSheet(instant) {
  const el = stack.pop(); if (!el) return;
  if (instant === true) el.remove(); else { el.classList.remove('on'); setTimeout(() => el.remove(), 420); }
  if (el.dataset.fab) document.body.classList.remove('fab-open');
  if (!stack.length) { document.body.classList.remove('locked'); scaleBack(false); }
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
function toast(m, err, undo) {
  const t = $('#toast'); t.className = err ? 'err' : ''; t.innerHTML = ic(err ? 'alert' : 'check') + esc(m) + (undo ? '<button type="button" id="t-undo">Annuler</button>' : '');
  t.style.pointerEvents = undo ? 'auto' : 'none';
  if (undo) $('#t-undo').onclick = () => { undo(); t.classList.remove('on'); };
  requestAnimationFrame(() => t.classList.add('on')); clearTimeout(toast.t); toast.t = setTimeout(() => { t.classList.remove('on'); t.style.pointerEvents = 'none'; }, undo ? 4000 : 2300);
}

function fFab() {
  const t = T(focusT) || active()[0], st = t ? status(t) : {}, w = weightsAsc().pop();
  const r = (act, icon, color, title, sub, id = '') => `<button class="add-row" data-act="${act}"${id ? ` data-id="${id}"` : ''}><span class="bubble" style="--c:${color}">${ic(icon)}</span><span><b>${title}</b><span>${sub}</span></span></button>`;
  document.body.classList.add('fab-open'); haptic();
  const fabEl = openSheet({
    title: 'Ajouter', small: true, body: `<div class="group">
    ${r('newInj', 'pen', t ? esc(t.color) : 'var(--inj)', 'Injection', !t ? 'Ajoute d’abord un traitement' : st.last ? (st.dueIn < 0 ? 'En retard de ' + (-st.dueIn) + ' j' : st.dueIn === 0 ? 'Prévue aujourd’hui' : 'Prochaine ' + relDay(new Date(st.due))) : 'Note ta première injection')}
    ${r('newS', 'face', 'var(--ress)', 'Ressenti', 'Effets, appétit, énergie, humeur')}
    ${r('hab', 'egg', 'var(--prot)', 'Protéines, eau, fibres', `Aujourd’hui : ${habFmt('p', intake('p'))} de protéines, ${habFmt('w', intake('w'))}`, 'p')}
    ${r('newW', 'scale', 'var(--poids)', 'Poids', w && !hidden() ? 'Dernière pesée : ' + fr1(w.kg) + ' kg, ' + relDay(w.date) : 'Note ta pesée')}
    ${r('newM', 'ruler', 'var(--poids)', 'Mensurations', 'Tour de taille, hanches, masse maigre')}
    ${r('addPhoto', 'camera', 'var(--niv)', 'Photo de suivi', 'Reste sur ton téléphone', 'body')}
    ${r('questions', 'question', 'var(--inj)', 'Question pour le médecin', 'À garder pour ton prochain rendez-vous')}
  </div>` });
  fabEl.dataset.fab = '1';
}

/* Injection */
function injBody(t) {
  const act = active(), last = injOf(t.id)[0], rot = rotation(t.id), p = PRESETS.find(x => x.key === t.preset);
  const doses = [...new Set([...(p && p.key !== 'custom' ? p.doses : []), ...injOf(t.id).slice(0, 6).map(i => i.dose)])].sort((a, b) => a - b);
  const sel = last ? last.dose : null, u = esc(t.unit), pen = penInfo(t);
  let penTxt = '';
  if (num(t.penDoses) > 0) penTxt = !pen || pen.done || (pen.exp && pen.expIn < 0) ? 'Cette injection démarrera un nouveau stylo.' : `Dose ${pen.used + 1} sur ${pen.per} du stylo en cours.`;
  return `<input type="hidden" id="i-t" value="${t.id}">
  ${act.length > 1 ? `<div class="seg" style="margin:4px 0 4px">${act.map(x => `<button data-injt="${x.id}" aria-pressed="${x.id === t.id}">${esc(x.name)}</button>`).join('')}</div>` : ''}
  <p class="lab">Dose prescrite</p>
  ${doses.length ? `<div class="pills" id="i-pills" data-v="${sel ?? ''}">${doses.map(d => `<button class="pill" data-dose="${d}" aria-pressed="${d === sel}">${fr(d, 3)}<small>${u}</small></button>`).join('')}</div>` : ''}
  <div class="group" style="margin-top:${doses.length ? 8 : 0}px"><div class="frow"><label for="i-dose">${doses.length ? 'Autre dose' : 'Dose injectée'}</label><input id="i-dose" inputmode="decimal" placeholder="${doses.length ? '–' : 'selon ta prescription'}" enterkeyhint="done"><span class="unit">${u}</span></div></div>
  ${penTxt ? `<p class="foot-note">${penTxt}</p>` : ''}
  <p class="lab">Zone d’injection</p>
  <div class="figwrap" id="i-body" data-sel="${rot.next}"><span class="side l">Droite</span><span class="side r">Gauche</span>${figure(rot, rot.next)}
    <p class="figcap" id="i-cap">${siteCap(t.id, rot.next, rot)}</p>
    <div class="legend"><span><i></i>Conseillée</span>${rot.last ? '<span><i class="l"></i>Dernière utilisée</span>' : ''}</div></div>
  <p class="lab">Quand</p>
  <div class="group"><div class="frow"><span class="k">Date et heure</span><span style="flex:1"></span><span class="chip">${ic('cal')}<span id="i-when">Maintenant</span><input type="datetime-local" id="i-date" value="${isoLocal()}" max="${isoLocal(new Date(Date.now() + 6e4))}" aria-label="Date et heure de l’injection"></span></div>
  <div class="frow"><input id="i-note" class="left" placeholder="Ajouter une note" maxlength="140" enterkeyhint="done"></div></div>`;
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

/* Poids et mensurations */
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
  let lastI = Math.floor(v);
  sc.addEventListener('scroll', () => {
    if (Date.now() > lock) {
      const x = val(); input.value = fr1(x); cb && cb(x);
      const iv = Math.floor(x); if (iv !== lastI) { lastI = iv; haptic(); if (!REDUCED) input.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.035)' }, { transform: 'scale(1)' }], { duration: 160 }); }
    }
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
    <p class="hint">${l && !hidden() ? `Dernière pesée : ${fr1(l.kg)} kg, ${relDay(l.date)}` : 'Fais glisser la règle ou tape ton poids'}</p>
    <div id="w-r">${rulerHtml(v)}</div>
    <div class="center"><span class="chip">${ic('cal')}<span id="w-when">Aujourd’hui</span><input type="date" id="w-date" value="${today()}" max="${today()}" aria-label="Date de la pesée"></span></div>
    <p class="foot-note" style="text-align:center;margin-top:14px">Astuce : le même jour chaque semaine, le matin, donne la courbe la plus lisible.</p>`,
    foot: `<button class="btn poids" data-act="saveW">Enregistrer</button>`
  });
  initRuler($('#w-r', el), $('#w-kg', el), v);
}
function fM() {
  const last = S.measures.slice().sort((a, b) => D(b.date) - D(a.date))[0] || {};
  const f = (k, l, u) => `<div class="frow"><label for="m-${k}">${l}</label><input id="m-${k}" inputmode="decimal" placeholder="${last[k] ? fr(last[k]) : '–'}"><span class="unit">${u}</span></div>`;
  openSheet({
    title: 'Mensurations', color: 'var(--poids)',
    body: `<p class="lab">Tours (mètre ruban)</p><div class="group">${f('waist', 'Tour de taille', 'cm')}${f('hips', 'Hanches', 'cm')}${f('thigh', 'Cuisse', 'cm')}${f('arm', 'Bras', 'cm')}</div>
    <p class="foot-note">En gris : ta dernière mesure. Remplis seulement ce que tu mesures.</p>
    <p class="lab">Composition (balance impédancemètre)</p><div class="group">${f('lean', 'Masse maigre', 'kg')}</div>
    <p class="foot-note">Une partie du poids perdu sous traitement est de la masse maigre. Suivre ce chiffre, si ta balance le donne, aide à en parler avec ton médecin.</p>
    <p class="lab">Date</p><div class="group"><div class="frow"><span class="k">Date</span><span style="flex:1"></span><span class="chip">${ic('cal')}<span id="m-when">Aujourd’hui</span><input type="date" id="m-date" value="${today()}" max="${today()}" aria-label="Date"></span></div></div>`,
    foot: `<button class="btn poids" data-act="saveM">Enregistrer</button>`
  });
}

/* Ressentis */
function fS() {
  let grid = '', g = '';
  FEEL.forEach(([k, e, , grp]) => { if (grp !== g) { if (g) grid += '</div>'; g = grp; grid += `${FEEL_G[grp] ? `<p class="feel-h">${FEEL_G[grp]}</p>` : ''}<div class="feel">`; } grid += `<button data-feel="${esc(k)}" aria-pressed="false"><span class="e">${e}</span>${esc(k)}</button>`; });
  grid += '</div>';
  openSheet({
    title: 'Ressenti', color: 'var(--ress)',
    body: `<p class="lab">Comment tu te sens ? Plusieurs choix possibles.</p>${grid}
    <div id="s-lvl-w" hidden><p class="lab">Intensité</p><div class="seg" id="s-lvl">${[1, 2, 3].map(l => `<button data-lvl="${l}" aria-pressed="${l === 1}">${LEVELS[l]}</button>`).join('')}</div></div>
    <p class="lab">Détails</p><div class="group"><div class="frow"><span class="k">Date</span><span style="flex:1"></span><span class="chip">${ic('cal')}<span id="s-when">Aujourd’hui</span><input type="date" id="s-date" value="${today()}" max="${today()}" aria-label="Date"></span></div>
    <div class="frow"><input id="s-note" class="left" placeholder="Ajouter une note" maxlength="140" enterkeyhint="done"></div></div>
    <p class="foot-note">Un symptôme inquiétant ? <button data-act="info" data-id="signes" style="color:var(--inj);font-weight:600">Voir quand consulter</button></p>`,
    foot: `<button class="btn ress" data-act="saveS" disabled>Choisis au moins un ressenti</button>`
  });
}

/* Habitudes */
function habBody(k) {
  const H = HAB[k], g = S.goals[k], isS = k === 's';
  const val = isS ? sessionsWeek() : intake(k), p = g > 0 ? Math.min(1, val / g) : 0;
  const list = isS ? S.intake.filter(i => i.k === 's' && i.date >= weekStart()) : S.intake.filter(i => i.k === k && i.date === today());
  return `<div class="seg mini-seg">${['p', 'w', 'f', 's'].map(x => `<button data-habk="${x}" aria-pressed="${x === k}">${HAB[x].label}</button>`).join('')}</div>
  <div style="--c:${H.color}">${k === 'w' ? `<div class="hab-cadi">${cadi({ size: 76, expr: 'water' })}</div>` : ''}<p class="hab-total"><b>${cnt('habs:' + k, val, k === 'w' ? 'L' : k === 's' ? 'int' : 'g')}</b><span>${g > 0 ? '/ ' + habFmt(k, g) : ''}${isS ? ' séance' + (g > 1 ? 's' : '') + ' cette semaine' : ' aujourd’hui'}</span></p><div class="hbar"><i data-wk="habs${k}" data-w="${(p * 100).toFixed(1)}" style="width:${(p * 100).toFixed(0)}%"></i></div>
  <p class="lab">${isS ? 'Ajouter' : 'Ajouter une portion'}</p>
  <div class="portions">${H.portions.map(([l, v]) => `<button data-add="${k}|${v}|${esc(l)}"><b>${esc(l)}</b><span>${isS ? '+1' : '≈ ' + (k === 'w' ? fr(v, 0) + ' mL' : fr(v, 0) + ' g')}</span></button>`).join('')}</div>
  ${isS ? '' : `<div class="custom"><div class="group"><div class="frow"><label for="h-v">Autre</label><input id="h-v" inputmode="decimal" placeholder="–" enterkeyhint="done"><span class="unit">${k === 'w' ? 'mL' : 'g'}</span></div></div><button class="btn" style="--c:${H.color}" data-act="habCustom" data-id="${k}">Ajouter</button></div>`}
  ${list.length ? `<p class="lab">${isS ? 'Cette semaine' : 'Aujourd’hui'}</p><div class="group">${list.slice().reverse().map(i => `<div class="row"><span class="t"><b style="font-weight:500">${esc(i.label || H.label)}</b><span>${isS ? cap(relDay(i.date)) : ''}</span></span><span class="val">${isS ? '' : k === 'w' ? fr(i.v, 0) + ' mL' : fr(i.v, 0) + ' g'}</span><button class="x" data-act="habDel" data-id="${i.id}" aria-label="Retirer">${ic('close')}</button></div>`).join('')}</div>` : ''}
  <p class="foot-note">${{ p: 'Valeurs moyennes arrondies, à titre indicatif. Les protéines aident à préserver le muscle pendant la perte de poids.', w: 'Boire régulièrement aide surtout en cas de nausées, de diarrhée ou de constipation.', f: 'Augmente les fibres progressivement, avec de l’eau, pour éviter les ballonnements.', s: 'Le renforcement musculaire (poids du corps, élastiques, haltères) aide à préserver le muscle.' }[k]} <button data-act="goals" style="color:var(--inj);font-weight:600">Modifier l’objectif</button></p></div>`;
}
function fHab(k = 'p') { openSheet({ title: 'Habitudes', left: 'Fermer', body: habBody(k) }); }
function refreshHab(k) { const b = q('.body'); if (b && q('[data-habk]')) { b.innerHTML = habBody(k); animateCounts(b); syncSegs(b); } render(); }
const habVal = k => k === 's' ? sessionsWeek() : intake(k);
function addIntake(k, v, label, date = today()) {
  const before = habVal(k);
  const it = { id: uid(), k, v, label, date }; S.intake.push(it); save();
  it._before = before; it._after = habVal(k);
  return it;
}
function goalCheck(it, pt) {
  const k = it.k, g = S.goals[k], H = HAB[k];
  if (!(g > 0) || it._before >= g || it._after < g) return;
  setTimeout(() => {
    burst(pt, [H.color, H.color, '#FFD60A', '#FFFFFF']); haptic();
    const all = ['p', 'w', 'f'].every(x => !(S.goals[x] > 0) || intake(x) >= S.goals[x]);
    if (all && k !== 's') { setTimeout(() => { hud('Objectifs du jour atteints', 'var(--fib)', { cadi: true, expr: 'party', spin: false, sub: 'Protéines, eau et fibres ✨' }); burst({ x: innerWidth / 2, y: innerHeight * .42 }, ['var(--prot)', 'var(--eau)', 'var(--fib)', '#FFD60A'], 42, 1.8); }, 500); }
    else toast(k === 's' ? 'Objectif de la semaine atteint 💪' : `Objectif ${H.label.toLowerCase()} atteint 🎉`);
  }, 120);
}
function fGoals() {
  const w = weightsAsc().pop(), kg = w ? w.kg : null;
  openSheet({
    title: 'Objectifs du jour', right: 'OK', rightAct: 'saveGoals',
    body: `<p class="lab">Tes objectifs</p><div class="group">
      <div class="frow"><label for="g-p">Protéines</label><input id="g-p" inputmode="decimal" value="${S.goals.p}"><span class="unit">g / jour</span></div>
      <div class="frow"><label for="g-w">Eau</label><input id="g-w" inputmode="decimal" value="${fr(S.goals.w / 1000, 2)}"><span class="unit">L / jour</span></div>
      <div class="frow"><label for="g-f">Fibres</label><input id="g-f" inputmode="decimal" value="${S.goals.f}"><span class="unit">g / jour</span></div>
      <div class="frow"><label for="g-s">Renforcement</label><input id="g-s" inputmode="numeric" value="${S.goals.s}"><span class="unit">séances / sem.</span></div></div>
      <p class="foot-note">À fixer avec ton médecin ou ton diététicien. Quelques repères publiés :</p>
      <div class="doc" style="font-size:14.5px;margin-top:10px"><ul>
        <li><b>Protéines :</b> 1,2 à 1,6 g par kg et par jour, souvent 80 à 120 g/j, selon l’avis conjoint de quatre sociétés savantes américaines sur les traitements GLP-1 (2025).${kg ? ` Pour ${fr1(kg)} kg, ça ferait ${Math.round(kg * 1.2)} à ${Math.round(kg * 1.6)} g.` : ''}</li>
        <li><b>Renforcement :</b> le même avis recommande 2 à 3 séances par semaine, en plus d’environ 150 minutes d’activité modérée.</li>
        <li><b>Fibres :</b> l’ANSES recommande 30 g par jour pour les adultes, à atteindre progressivement.</li>
        <li><b>Eau :</b> pas de chiffre unique ; bois régulièrement, davantage en cas de nausées, de diarrhée ou de chaleur.</li></ul></div>`
  });
}

/* Consultation : rendez-vous, questions, rapport */
function fAppt() {
  openSheet({
    title: 'Prochain rendez-vous', right: 'OK', rightAct: 'saveAppt', small: true,
    body: `<div class="group" style="margin-top:6px"><div class="frow"><label for="a-date">Date et heure</label><input type="datetime-local" id="a-date" value="${S.appt || ''}" style="color:var(--label)"></div></div>
    <p class="foot-note">Cadence te rappellera de préparer tes questions et ton rapport les jours qui précèdent.</p>
    ${S.appt ? `<div class="group" style="margin-top:20px"><button class="row accent" data-act="apptIcs">${ic('bell', 'ri')}Ajouter au calendrier, rappel 2 jours avant</button><button class="row danger" data-act="apptDel">${ic('trash', 'ri')}Supprimer le rendez-vous</button></div>` : ''}`
  });
}
function questionsBody() {
  const qs = S.questions.slice().sort((a, b) => (a.done - b.done) || (D(b.date) - D(a.date)));
  return `<div class="custom" style="margin-top:6px"><div class="group"><div class="frow"><input id="q-new" class="left" placeholder="Ex. : nausées fortes à J2, est-ce normal ?" maxlength="200" enterkeyhint="done"></div></div><button class="btn" data-act="qAdd">Ajouter</button></div>
  ${qs.length ? `<div class="group" style="margin-top:16px">${qs.map(x => `<div class="qrow" data-done="${!!x.done}"><button class="ck" data-act="qToggle" data-id="${x.id}" aria-label="${x.done ? 'Marquer comme à poser' : 'Marquer comme posée'}">${ic('check')}</button><span class="t">${esc(x.text)}</span><button class="x" data-act="qDel" data-id="${x.id}" aria-label="Supprimer">${ic('close')}</button></div>`).join('')}</div>` : `<p class="foot-note" style="margin-top:14px">Note tes questions au fil des jours, même depuis le journal (bouton « Ajouter à mes questions »). Elles apparaîtront aussi dans le rapport.</p>`}
  ${S.appt ? `<p class="foot-note">Prochain rendez-vous : ${relDay(S.appt)} à ${tfmt(S.appt)}.</p>` : ''}`;
}
function fQuestions() { openSheet({ title: 'Mes questions', left: 'Fermer', body: questionsBody() }); }

/* Dépenses et remboursement */
function costsBody() {
  const cs = S.costs.slice().sort((a, b) => D(b.date) - D(a.date)), year = today().slice(0, 4);
  const paid = sum(cs.map(c => c.paid)), back = sum(cs.map(c => (+c.secu || 0) + (+c.mut || 0))), y = cs.filter(c => c.date.startsWith(year));
  const doc = S.photos.find(p => p.kind === 'doc');
  return `<div class="card chart-card" style="margin-top:6px"><div class="sumrow"><div><b>${eur(paid)}</b><span>payé</span></div><div><b>${eur(back)}</b><span>remboursé</span></div><div><b>${eur(paid - back)}</b><span>reste à charge</span></div></div>
    ${y.length !== cs.length ? `<p class="foot-note" style="margin:10px 0 0;text-align:center">Reste à charge en ${year} : ${eur(sum(y.map(c => (+c.paid || 0) - (+c.secu || 0) - (+c.mut || 0))))}</p>` : ''}</div>
  <button class="btn" style="margin-top:12px" data-act="newCost">${ic('plus')}Ajouter un achat</button>
  ${cs.length ? `<p class="lab">Achats</p><div class="group">${cs.map(c => `<div class="row"><span class="t"><b style="font-weight:500">${esc(c.label || 'Achat')}</b><span>${cap(dfmt(c.date, { day: 'numeric', month: 'long', year: 'numeric' }))}, remboursé ${eur((+c.secu || 0) + (+c.mut || 0))}</span></span><span class="val">${eur(c.paid)}</span><button class="x" data-act="costDel" data-id="${c.id}" aria-label="Supprimer">${ic('close')}</button></div>`).join('')}</div>` : ''}
  <p class="lab">Volet 3 du formulaire d’accompagnement</p>
  <div class="card chart-card">${doc ? `<img class="doc-thumb" data-ph="${doc.id}" alt="Volet 3">` : ''}
    <p style="font-size:15px;line-height:1.42;${doc ? 'margin-top:10px' : ''}">À présenter à la pharmacie à chaque délivrance de Wegovy ou Mounjaro, sinon le médicament n’est pas remboursé. Garde-en une photo ici, elle reste sur ton téléphone.</p>
    <button class="btn tint" style="margin-top:12px" data-act="addPhoto" data-id="doc">${ic('camera')}${doc ? 'Remplacer la photo' : 'Photographier le volet 3'}</button></div>
  <p class="lab">Ordonnance</p>
  <div class="group"><div class="frow"><label for="rx">Valable jusqu’au</label><input type="date" id="rx" value="${S.rxEnd || ''}" style="color:var(--label)"></div></div>
  <p class="foot-note">Cadence te prévient 10 jours avant pour penser au renouvellement.</p>`;
}
function fCosts() { openSheet({ title: 'Dépenses et remboursement', left: 'Fermer', body: costsBody(), color: 'var(--poids)' }); }
function fNewCost() {
  const t = T(focusT) || active()[0], last = t ? injOf(t.id)[0] : null, price = t && last && PRICES[t.preset] ? PRICES[t.preset][last.dose] : '';
  openSheet({
    title: 'Nouvel achat', right: 'Ajouter', rightAct: 'saveCost', small: true,
    body: `<div class="group" style="margin-top:6px">
      <div class="frow"><label for="c-l">Produit</label><input id="c-l" value="${t ? esc(t.name) + (last ? ' ' + fmtDose(last.dose, esc(t.unit)) : '') : ''}" placeholder="Ex. : 1 stylo"></div>
      <div class="frow"><label for="c-d">Date</label><input type="date" id="c-d" value="${today()}" max="${today()}" style="color:var(--label)"></div>
      <div class="frow"><label for="c-p">Prix payé</label><input id="c-p" inputmode="decimal" value="${price ? String(price).replace('.', ',') : ''}" placeholder="–"><span class="unit">€</span></div>
      <div class="frow"><label for="c-s">Assurance maladie</label><input id="c-s" inputmode="decimal" placeholder="0"><span class="unit">€</span></div>
      <div class="frow"><label for="c-m">Mutuelle</label><input id="c-m" inputmode="decimal" placeholder="0"><span class="unit">€</span></div></div>
      <button class="btn tint" style="margin-top:12px" data-act="cost65">Remboursement à 65 % par l’Assurance maladie</button>
      <p class="foot-note">${price ? 'Prix pré-rempli : prix public indicatif par stylo (Journal officiel, juin 2026). Vérifie sur ta facture. ' : ''}Depuis le 15 juin 2026, Wegovy et Mounjaro peuvent être remboursés à 65 % dans l’obésité, sous conditions fixées par l’Assurance maladie.</p>`
  });
}

/* Traitements */
function tFields(v) {
  const custom = v.preset === 'custom' || !v.preset;
  return `${custom ? `<div class="warnbox">${ic('alert')}<span>Uniquement pour un traitement prescrit par ton médecin. L’ANSM rappelle que les analogues du GLP-1 et les « peptides » achetés hors du circuit officiel sont illégaux et potentiellement dangereux.</span></div><p class="lab"></p>` : ''}
  <div class="group">
    <div class="frow"><label for="t-name">Nom</label><input id="t-name" value="${esc(v.name)}" placeholder="Nom du traitement" maxlength="40" enterkeyhint="next"></div>
    <div class="frow"><label for="t-mol">Molécule</label><input id="t-mol" value="${esc(v.molecule)}" placeholder="Facultatif" maxlength="40"></div>
    <div class="frow"><label for="t-unit">Unité</label><select id="t-unit">${['mg', 'µg', 'UI', 'mL'].map(u => `<option ${u === v.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
    <div class="frow"><label for="t-int">Une injection tous les</label><input id="t-int" inputmode="decimal" value="${esc(v.intervalDays)}"><span class="unit">jours</span></div>
    <div class="frow"><label for="t-stock">Doses en stock</label><input id="t-stock" inputmode="numeric" value="${esc(v.stock ?? '')}" placeholder="Facultatif"></div>
  </div>
  <p class="lab">Stylo multidose</p>
  <div class="group">
    <div class="frow"><label for="t-pd">Doses par stylo</label><input id="t-pd" inputmode="numeric" value="${esc(v.penDoses ?? '')}" placeholder="Facultatif"></div>
    <div class="frow"><label for="t-pj">À jeter après ouverture</label><input id="t-pj" inputmode="numeric" value="${esc(v.penDays ?? '')}" placeholder="–"><span class="unit">jours</span></div>
  </div>
  <p class="foot-note">Indiqués sur la notice. Pour Mounjaro KwikPen : 4 doses, et le stylo se jette 30 jours après la première utilisation.</p>
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
  if (t) {
    const p = penInfo(t);
    return openSheet({
      title: esc(t.name), right: 'OK', rightAct: 'saveT',
      body: `<input type="hidden" id="t-id" value="${t.id}"><input type="hidden" id="t-preset" value="${esc(t.preset || 'custom')}">
      ${num(t.penDoses) > 0 ? `<p class="lab">Stylo en cours</p><div class="card chart-card" style="--c:var(--inj);text-align:center">${p ? `<div class="pen-big">${Array.from({ length: p.per }, (_, i) => `<i class="${i < p.used ? 'u' : ''}"></i>`).join('')}</div><p style="font-size:15px;margin-top:8px">${p.used} dose${p.used > 1 ? 's' : ''} sur ${p.per}, ouvert ${relDay(p.opened)}${p.exp ? `, à jeter le ${dfmt(p.exp, { day: 'numeric', month: 'long' })}` : ''}.</p>` : `<p style="font-size:15px">Aucun stylo en cours. Il démarre à ta prochaine injection.</p>`}
        <button class="btn tint" style="margin-top:12px" data-act="newPen" data-id="${t.id}">Je commence un nouveau stylo</button></div>` : ''}
      <p class="lab">Traitement</p>${tFields(t)}
      <div class="group" style="margin-top:24px"><button class="row accent" data-act="archT" data-id="${t.id}">${ic(t.archived ? 'restore' : 'pause', 'ri')}${t.archived ? 'Reprendre ce traitement' : 'Marquer comme arrêté'}</button><button class="row danger" data-act="delT" data-id="${t.id}">${ic('trash', 'ri')}Supprimer le traitement</button></div>`
    });
  }
  openSheet({
    title: 'Nouveau traitement', right: 'Ajouter', rightAct: 'saveT',
    body: `<input type="hidden" id="t-id" value=""><input type="hidden" id="t-preset" value="mounjaro">
    <div class="hscroll" id="t-pre" style="margin-top:6px">${PRESETS.map((p, i) => `<button class="chip" data-preset="${p.key}" aria-pressed="${i === 0}">${p.name || 'Autre traitement'}</button>`).join('')}</div>
    <p class="lab">Traitement</p><div id="t-fields">${tFields(Object.assign({ stock: '' }, PRESETS[0], { preset: 'mounjaro' }))}</div>`
  });
}

/* Détail d'une entrée du journal */
function fEntry(kind, id) {
  const o = S[kind].find(x => x.id === id); if (!o) return;
  let title, lines, qtext = '';
  if (kind === 'injections') { const t = T(o.tid) || { name: 'Injection', unit: '' }; title = esc(t.name); lines = [['Dose', fmtDose(o.dose, esc(t.unit))], ['Date', cap(relDay(o.date)) + ' à ' + tfmt(o.date)], ['Zone', o.site ? siteLabel(o.site) : '–']]; if (o.note) lines.push(['Note', esc(o.note)]); }
  else if (kind === 'weights') { title = 'Poids'; lines = [['Poids', hidden() ? 'Masqué' : fr1(o.kg) + ' kg'], ['Date', cap(dfmt(o.date))]]; }
  else if (kind === 'measures') { title = 'Mensurations'; lines = [['Mesures', measTxt(o)], ['Date', cap(dfmt(o.date))]]; }
  else { title = esc(o.type); lines = [['Intensité', o.level ? LEVELS[o.level] : '–'], ['Date', cap(dfmt(o.date))]]; if (o.note) lines.push(['Note', esc(o.note)]); qtext = 1; }
  openSheet({
    title, left: 'Fermer', small: true, body: `<div class="group" style="margin-top:6px">${lines.map(([k, v]) => `<div class="frow"><span class="k">${k}</span><span style="flex:1;text-align:right;color:var(--label2);padding:12px 0">${v}</span></div>`).join('')}</div>
    <div class="group" style="margin-top:20px">${qtext ? `<button class="row accent" data-act="qFrom" data-id="${o.id}">${ic('question', 'ri')}Ajouter à mes questions</button>` : ''}<button class="row danger" data-act="delEntry" data-id="${kind}:${id}">${ic('trash', 'ri')}Supprimer cette entrée</button></div>`
  });
}

/* Photos */
function fPhoto(id) {
  const p = S.photos.find(x => x.id === id); if (!p) return;
  const body = S.photos.filter(x => x.kind === 'body').sort((a, b) => D(a.date) - D(b.date)), first = body[0];
  const cmp = first && first.id !== p.id;
  openSheet({
    title: cap(dfmt(p.date, { day: 'numeric', month: 'long', year: 'numeric' })), left: 'Fermer',
    body: cmp ? `<div class="cmp" style="margin-top:6px"><figure><img data-ph="${first.id}" alt=""><figcaption>${dfmt(first.date, { day: 'numeric', month: 'long' })}</figcaption></figure><figure><img data-ph="${p.id}" alt=""><figcaption>${dfmt(p.date, { day: 'numeric', month: 'long' })}</figcaption></figure></div><p class="foot-note" style="text-align:center">À gauche ta première photo, à droite celle-ci.</p>`
      : `<div class="pv" style="margin-top:6px"><img data-ph="${p.id}" alt=""></div>`,
    foot: `<button class="btn plain" style="color:var(--red)" data-act="delPhoto" data-id="${p.id}">${ic('trash')}Supprimer la photo</button>`
  });
}

/* Fiches d'information (contenu tiré des notices et sources officielles, sans interprétation) */
const INFO = {
  signes: ['Quand consulter', `<div class="callout red"><p><b>Urgence : appelle le 15 (ou le 112).</b> Gonflement du visage, des lèvres ou de la gorge, difficulté à respirer, malaise.</p></div>
    <h3>Contacte rapidement un médecin si tu as :</h3><ul>
    <li>une douleur au ventre intense et qui persiste, parfois irradiant dans le dos, avec ou sans vomissements (la notice demande de consulter immédiatement) ;</li>
    <li>des vomissements ou des diarrhées qui t’empêchent de boire, une bouche très sèche, peu d’urines ou des vertiges (risque de déshydratation) ;</li>
    <li>une douleur dans le haut du ventre à droite, de la fièvre, ou la peau ou les yeux qui jaunissent ;</li>
    <li>si tu prends aussi de l’insuline ou un sulfamide : sueurs, tremblements, faim brutale, confusion (possible hypoglycémie).</li></ul>
    <h3>Parles-en sans attendre</h3><p>Une humeur très basse, des idées noires ou un changement inhabituel de ton comportement : parles-en à ton médecin. Si tu as des idées suicidaires, appelle le <b>3114</b> (gratuit, 24 h/24).</p>
    <p>Pour tout autre effet gênant ou qui dure, demande conseil à ton médecin ou à ton pharmacien.</p>
    <p><a href="https://signalement.social-sante.gouv.fr" target="_blank" rel="noopener">Déclarer un effet indésirable sur le portail officiel</a></p>
    <p class="src">D’après les notices des traitements (rubrique 4, effets indésirables). Cadence n’interprète pas tes symptômes.</p>`],
  oubli: ['Oubli d’une dose', `<p>Les consignes dépendent du traitement. Voici ce que prévoient les notices :</p>
    <div class="callout"><p><b>Mounjaro</b> (une fois par semaine) : injecte la dose oubliée dès que possible dans les <b>4 jours</b> (96 h). Au-delà, saute-la et reprends au jour habituel.</p></div>
    <div class="callout"><p><b>Wegovy et Ozempic</b> (une fois par semaine) : injecte la dose oubliée dès que possible dans les <b>5 jours</b>. Au-delà, saute-la et reprends au jour habituel.</p></div>
    <p>Pour les autres traitements, reporte-toi à la rubrique 3 de la notice. N’injecte jamais deux doses pour rattraper un oubli.</p>
    <p>En cas de doute, ton pharmacien peut te répondre.</p>
    <p class="src">Sources : notices Mounjaro, Wegovy et Ozempic (EMA). Cadence ne calcule pas de dose.</p>`],
  stylo: ['Le stylo et le liquide restant', `<p><b>Mounjaro KwikPen</b> contient 4 doses fixes. Après la 4<sup>e</sup> dose, il reste un peu de liquide : c’est normal, ce n’est pas une dose complète et il ne faut pas l’injecter.</p>
    <p>Les graduations du stylo n’indiquent pas le nombre de doses restantes : Cadence les compte pour toi à chaque injection notée.</p>
    <p>Le stylo se jette <b>30 jours après la première utilisation</b>, même s’il reste du médicament.</p>
    <p>Pour un autre stylo, le nombre de doses et la durée après ouverture figurent dans sa notice ; tu peux les renseigner dans la fiche du traitement.</p>
    <p class="src">Source : Lilly, informations sur Mounjaro KwikPen.</p>`],
  voyage: ['Conservation et voyage', `<h3>Conservation</h3><ul><li>Avant la première utilisation : au réfrigérateur (2 à 8 °C), sans congeler.</li>
    <li>Mounjaro KwikPen entamé : il peut rester hors du réfrigérateur, sous 30 °C, pendant 30 jours au maximum.</li>
    <li>Pour les autres stylos, vérifie la rubrique 5 de la notice (« Comment conserver »).</li>
    <li>Ne laisse pas le stylo au soleil, dans une voiture chaude ou en contact direct avec de la glace.</li></ul>
    <h3>En voyage</h3><ul><li>Garde le stylo en bagage à main (la soute peut geler), avec ton ordonnance.</li>
    <li>Une pochette isotherme aide, sans contact direct avec les pains de glace.</li>
    <li>Décalage horaire : garde ton jour d’injection habituel et demande à ton pharmacien comment adapter l’heure si besoin.</li></ul>
    <p class="src">Sources : notices et informations du fabricant. En cas de doute, demande à ton pharmacien.</p>`],
  volet: ['Remboursement : le volet 3', `<p>Depuis le 15 juin 2026, Wegovy et Mounjaro peuvent être remboursés à 65 % dans l’obésité (100 % en ALD), sous conditions médicales.</p>
    <p>Ton médecin remplit un <b>formulaire d’accompagnement</b> une seule fois. Tu dois présenter son <b>volet 3</b> à la pharmacie à <b>chaque délivrance</b> : sans lui, le médicament est délivré mais pas remboursé.</p>
    <p>Garde-le avec ton ordonnance, ou photographie-le dans Cadence (Plus, Dépenses et remboursement).</p>
    <p class="src">Sources : Assurance maladie (ameli.fr) et pharmaciens. Les conditions peuvent évoluer : vérifie auprès de ton médecin ou de ta caisse.</p>`]
};
function fInfo(id) { const [t, h] = INFO[id] || INFO.signes; openSheet({ title: t, left: 'Fermer', body: `<div class="doc" style="margin-top:6px">${h}</div>` }); }

/* ---------- Rapport médecin (imprimable / PDF) ---------- */
function staticWeightSvg(ws) {
  if (ws.length < 2) return '';
  const W = 700, H = 170, L = 6, R = 40, Tp = 10, B = 22, xs = ws.map(w => D(w.date).getTime()), ks = ws.map(w => w.kg);
  let lo = Math.min(...ks), hi = Math.max(...ks); if (hi - lo < 2) { const m = (2 - (hi - lo)) / 2; hi += m; lo -= m; } const pd = (hi - lo) * .1; lo -= pd; hi += pd;
  const t0 = xs[0], t1 = xs[xs.length - 1], x = v => L + (t1 > t0 ? (v - t0) / (t1 - t0) : .5) * (W - L - R), y = v => Tp + (hi - v) / (hi - lo) * (H - Tp - B);
  const p = ws.map((w, i) => [x(xs[i]), y(w.kg)]);
  return `<svg viewBox="0 0 ${W} ${H}">${[hi - pd, (hi + lo) / 2, lo + pd].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#e3e3e8"/><text x="${W - R + 6}" y="${y(v) + 4}">${fr(v, 0)} kg</text>`).join('')}
    <path d="${mono(p)}" fill="none" stroke="#0F9F86" stroke-width="2.5"/>${p.map(q => `<circle cx="${q[0]}" cy="${q[1]}" r="2.6" fill="#0F9F86"/>`).join('')}
    ${S.injections.map(i => D(i.date).getTime()).filter(v => v >= t0 && v <= t1).map(v => `<circle cx="${x(v)}" cy="${H - B + 7}" r="2.2" fill="#E5487A"/>`).join('')}
    <text x="${L}" y="${H - 2}">${short(ws[0].date)}</text><text x="${W - R}" y="${H - 2}" text-anchor="end">${short(ws[ws.length - 1].date)}</text></svg><p style="font-size:11px;color:#666">Points roses : injections.</p>`;
}
function buildReport(days) {
  const from = days ? addDays(today(), -days) : '0000';
  const inP = s => dayKey(s) >= from;
  const allW = weightsAsc(), wsP = allW.filter(w => inP(w.date)), first = allW[0], last = allW[allW.length - 1];
  const hm = num(S.profile.height) / 100;
  const ms = S.measures.slice().sort((a, b) => D(a.date) - D(b.date));
  const waistF = ms.find(m => num(m.waist) > 0), waistL = ms.slice().reverse().find(m => num(m.waist) > 0);
  let h = `<div class="rep"><h1>Suivi de traitement${S.profile.name ? ' — ' + esc(S.profile.name) : ''}</h1>
  <p class="meta">Période : ${days ? `${days} derniers jours (depuis le ${dfmt(from, { day: 'numeric', month: 'long', year: 'numeric' })})` : 'depuis le début du suivi'}. Édité le ${dfmt(new Date(), { day: 'numeric', month: 'long', year: 'numeric' })} avec Cadence, à partir des données saisies par la personne.</p>
  <div class="kpi">
    <div><b>${last ? fr1(last.kg) + ' kg' : '–'}</b><span>Poids actuel${last ? ` (${short(last.date)})` : ''}</span></div>
    <div><b>${first && last && allW.length > 1 ? `${sgn(last.kg - first.kg)} kg` : '–'}</b><span>${first && allW.length > 1 ? `depuis le ${short(first.date)}, ${fr1((last.kg - first.kg) / first.kg * 100)} %` : 'Variation'}</span></div>
    <div><b>${hm > 0 && last ? fr1(last.kg / (hm * hm)) : '–'}</b><span>IMC${hm > 0 ? ` (taille ${fr(S.profile.height)} cm)` : ''}</span></div>
    <div><b>${waistL ? fr(waistL.waist) + ' cm' : '–'}</b><span>Tour de taille${waistF && waistL && waistF !== waistL ? `, ${sgn(waistL.waist - waistF.waist)} cm` : ''}</span></div>
  </div>`;
  for (const t of S.treatments) {
    const inj = injOf(t.id).slice().reverse(); if (!inj.length) continue;
    const n = interval(t), injP = inj.filter(i => inP(i.date));
    let late = 0, missed = 0;
    for (let i = 1; i < injP.length; i++) { const g = daysBetween(injP[i - 1].date, injP[i].date); if (g > n + 1) late++; if (n > 1 && g >= 2 * n) missed += Math.round(g / n) - 1; }
    const zones = {}; injP.forEach(i => { if (i.site) zones[siteLabel(i.site)] = (zones[siteLabel(i.site)] || 0) + 1; });
    h += `<h2>${esc(t.name)}${t.molecule ? ` (${esc(t.molecule)})` : ''}, ${freqTxt(n)}${t.archived ? ', arrêté' : ''}</h2>
    <table><tr><th>Palier</th><th>Depuis le</th><th>Injections notées</th></tr>${steps(t).map(s => `<tr><td>${fmtDose(s.dose, esc(t.unit))}</td><td>${dfmt(s.from, { day: 'numeric', month: 'long', year: 'numeric' })}</td><td>${s.n}</td></tr>`).join('')}</table>
    <p style="margin-top:8px"><b>Régularité sur la période :</b> ${injP.length} injection${injP.length > 1 ? 's' : ''} notée${injP.length > 1 ? 's' : ''}${n > 1 ? `, ${late} décalée${late > 1 ? 's' : ''} de plus d’un jour, ${missed} oubli${missed > 1 ? 's' : ''} probable${missed > 1 ? 's' : ''} (écart d’au moins deux intervalles)` : ''}. Dernière injection : ${dfmt(inj[inj.length - 1].date, { day: 'numeric', month: 'long' })}.</p>
    ${Object.keys(zones).length ? `<p><b>Zones utilisées :</b> ${Object.entries(zones).map(([k, v]) => `${k.toLowerCase()} (${v})`).join(', ')}.</p>` : ''}`;
    const { rows } = effectStats(t, days || 3650);
    if (rows.length) {
      const by = {}; rows.forEach(r => { const k = r.type; by[k] = by[k] || { n: 0, max: 0, doses: new Set(), days: {} }; by[k].n++; by[k].max = Math.max(by[k].max, r.level); by[k].doses.add(r.dose); by[k].days[r.day] = (by[k].days[r.day] || 0) + 1; });
      h += `<table style="margin-top:10px"><tr><th>Effet noté</th><th>Fois</th><th>Intensité max.</th><th>Paliers concernés</th><th>Jours après injection les plus fréquents</th></tr>${Object.entries(by).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.n}</td><td>${LEVELS[v.max] || '–'}</td><td>${[...v.doses].sort((a, b) => a - b).map(d => fmtDose(d, esc(t.unit))).join(', ')}</td><td>${Object.entries(v.days).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([d]) => 'J' + d).join(', ')}</td></tr>`).join('')}</table><p style="font-size:11px;color:#666">J1 = jour de l’injection.</p>`;
    }
  }
  h += `<h2>Poids</h2>${wsP.length >= 2 ? staticWeightSvg(wsP) : '<p>Pas assez de pesées sur la période.</p>'}`;
  if (ms.length) h += `<h2>Mensurations</h2><table><tr><th>Date</th><th>Taille</th><th>Hanches</th><th>Cuisse</th><th>Bras</th><th>Masse maigre</th></tr>${ms.filter(m => inP(m.date) || m === ms[0]).map(m => `<tr><td>${short(m.date)}</td>${['waist', 'hips', 'thigh', 'arm'].map(k => `<td>${num(m[k]) > 0 ? fr(m[k]) + ' cm' : '–'}</td>`).join('')}<td>${num(m.lean) > 0 ? fr1(m.lean) + ' kg' : '–'}</td></tr>`).join('')}</table>`;
  const other = S.symptoms.filter(s => inP(s.date) && !isEffect(s.type) && s.type !== GOOD), good = S.symptoms.filter(s => inP(s.date) && s.type === GOOD).length;
  if (other.length || good) { const c = {}; other.forEach(s => c[s.type] = (c[s.type] || 0) + 1); h += `<p style="margin-top:8px"><b>Autres repères notés :</b> ${[...Object.entries(c).map(([k, v]) => `${k.toLowerCase()} (${v})`), good ? `journées sans souci (${good})` : ''].filter(Boolean).join(', ')}.</p>`; }
  const days14 = Array.from({ length: 14 }, (_, i) => addDays(today(), i - 13));
  const avg = k => { const v = days14.map(d => intake(k, d)).filter(x => x > 0); return v.length ? { a: sum(v) / v.length, n: v.length } : null; };
  const hp = avg('p'), hw = avg('w'), hf = avg('f'), wk = []; for (let i = 0; i < 4; i++) { const s = addDays(weekStart(), -7 * i), e = addDays(s, 6); wk.push(sum(S.intake.filter(x => x.k === 's' && x.date >= s && x.date <= e).map(x => x.v))); }
  if (hp || hw || hf || sum(wk)) h += `<h2>Habitudes (14 derniers jours, jours notés)</h2><ul>${hp ? `<li>Protéines : ${fr(hp.a, 0)} g/j en moyenne (${hp.n} j notés), objectif personnel ${S.goals.p} g</li>` : ''}${hw ? `<li>Eau : ${fr(hw.a / 1000, 1)} L/j en moyenne (${hw.n} j notés)</li>` : ''}${hf ? `<li>Fibres : ${fr(hf.a, 0)} g/j en moyenne (${hf.n} j notés)</li>` : ''}<li>Renforcement musculaire : ${wk.reverse().join(', ')} séances par semaine (4 dernières semaines)</li></ul>`;
  const qs = S.questions.filter(x => !x.done);
  if (qs.length) h += `<h2>Questions</h2><ul>${qs.map(x => `<li>${esc(x.text)}</li>`).join('')}</ul>`;
  h += `<p class="foot">Document généré localement par Cadence, carnet de suivi personnel. Les données sont déclaratives et n’ont pas de valeur de diagnostic. La courbe de niveau estimé de l’appli n’est pas reproduite ici.</p></div>`;
  return h;
}
function openReport(days = repDays) {
  repDays = days;
  const r = $('#report'); r.hidden = false; document.body.classList.add('locked');
  r.innerHTML = `<div class="rep-bar"><button data-act="closeReport">Fermer</button><div class="seg">${[[30, '30 j'], [90, '90 j'], [0, 'Tout']].map(([k, l]) => `<button data-repd="${k}" aria-pressed="${repDays === k}">${l}</button>`).join('')}</div><button class="pr" data-act="printReport">PDF</button></div>${buildReport(days)}`;
  r.scrollTop = 0; syncSegs(r);
}

/* ---------- Démarrage ---------- */
const OBS = ['welcome', 'name', 'treat', 'dose', 'last', 'weight', 'goal', 'consent'];
const obP = () => PRESETS.find(p => p.key === ob.preset) || PRESETS[0];
function vOnboard() {
  if (!ob) ob = { name: S.profile.name || '', preset: 'mounjaro', cname: '', cunit: 'mg', cint: '7', dose: null, last: null, lastDate: '', weight: null, goal: null, ok: false };
  const s = OBS[obStep], anim = obShown !== obStep ? ' anim' : ''; obShown = obStep;
  if (s === 'welcome') { if (anim) mounts.push(() => setTimeout(() => cadiSpin($('.splash .cadi')), 900)); }
  if (s === 'welcome') return `<div class="ob splash"><div class="step${anim}">
    ${cadi({ size: 150, cls: 'intro' })}
    <h1>Cadence</h1><p class="sub">Ton carnet de traitement GLP-1, simple et privé.</p>
    <div class="feat"><span class="bubble" style="--c:var(--inj)">${ic('pen')}</span><div><b>Injections, stylo et rotation</b><span>Le compte à rebours, les doses restantes du stylo et la prochaine zone.</span></div></div>
    <div class="feat"><span class="bubble" style="--c:var(--prot)">${ic('egg')}</span><div><b>Protéines, eau, fibres</b><span>Les habitudes qui aident à passer les effets et à garder ton muscle.</span></div></div>
    <div class="feat"><span class="bubble" style="--c:var(--ress)">${ic('steth')}</span><div><b>Prête pour ton rendez-vous</b><span>Tes effets par jour et par palier, tes questions et un rapport à imprimer.</span></div></div>
    <div class="feat"><span class="bubble" style="--c:var(--niv)">${ic('lock')}</span><div><b>Rien ne quitte ton téléphone</b><span>Pas de compte, pas de serveur. Tu exportes ou effaces quand tu veux.</span></div></div>
    </div><div class="grow"></div><div class="cta"><button class="btn" data-act="obNext">Commencer</button></div></div>`;
  const p = obP(), u = p.key === 'custom' ? ob.cunit : p.unit, tname = p.key === 'custom' ? ob.cname.trim() : p.name;
  let title, sub = '', body = '', cta = 'Continuer', act = 'obNext', dis = false, skip = '';
  if (s === 'name') { title = 'Comment tu t’appelles ?'; sub = 'Juste pour te dire bonjour.'; body = `<input class="field" data-ob="name" value="${esc(ob.name)}" placeholder="Ton prénom" autocomplete="given-name" enterkeyhint="next">`; skip = 'Passer'; }
  if (s === 'treat') {
    title = 'Quel traitement suis-tu ?'; sub = 'Tu pourras en ajouter d’autres ensuite.';
    body = PRESETS.map(x => `<button class="choice" data-obp="${x.key}" aria-pressed="${ob.preset === x.key}"><span class="dot" style="background:${x.color}"></span><span class="t"><b>${x.name || 'Autre traitement injectable'}</b><span>${x.key === 'custom' ? 'Prescrit par ton médecin : tu définis le nom, l’unité et le rythme' : `${x.molecule}, ${freqTxt(x.intervalDays)}`}</span></span><span class="ck">${ic('check')}</span></button>`).join('');
    if (ob.preset === 'custom') body += `<div class="warnbox">${ic('alert')}<span>L’ANSM rappelle que les analogues du GLP-1 et les « peptides » achetés hors du circuit officiel sont illégaux et potentiellement dangereux.</span></div><div class="group"><div class="frow"><label for="ob-cn">Nom</label><input id="ob-cn" data-ob="cname" value="${esc(ob.cname)}" placeholder="Nom du traitement" maxlength="40"></div><div class="frow"><label for="ob-cu">Unité</label><select id="ob-cu" data-ob="cunit">${['mg', 'µg', 'UI', 'mL'].map(x => `<option ${x === ob.cunit ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div class="frow"><label for="ob-ci">Une injection tous les</label><input id="ob-ci" data-ob="cint" inputmode="decimal" value="${esc(ob.cint)}"><span class="unit">jours</span></div></div>`;
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
    sub = isW ? 'Ce sera ton point de départ. Tu pourras masquer les chiffres plus tard.' : 'Tu pourras le changer quand tu veux.';
    body = `<div class="big-num"><input id="ob-kg" inputmode="decimal" aria-label="Poids en kilos"><span>kg</span></div><div id="ob-r" style="--c:var(--poids)">${rulerHtml(isW ? ob.weight : ob.goal)}</div>`;
    skip = isW ? 'Passer' : 'Pas d’objectif pour l’instant';
    mounts.push(() => initRuler($('#ob-r'), $('#ob-kg'), isW ? ob.weight : ob.goal, x => { if (isW) ob.weight = x; else ob.goal = x; }));
  }
  if (s === 'consent') {
    title = 'Avant de commencer';
    body = `<div class="cadi-row">${cadi({ size: 64, expr: 'calm' })}<p>Je suis Cadi. Je t’aide à garder le rythme, sans jamais remplacer ton médecin.</p></div>`;
    body += `<div class="info">${ic('heart')}<div><b>Un carnet, pas un médecin</b><span>Cadence ne recommande aucune dose. Les doses et le rythme sont ceux de ta prescription.</span></div></div>
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
  const t = { id: uid(), name: c ? ob.cname.trim() : p.name, molecule: p.molecule, unit: c ? ob.cunit : p.unit, intervalDays: c ? num(ob.cint) : p.intervalDays, halfLifeH: p.halfLifeH, tmaxH: p.tmaxH, color: p.color, stock: '', preset: p.key, archived: false, penDoses: p.penDoses, penDays: p.penDays, pen: null };
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
  S.onboarded = true; save(); ob = null; obStep = 0; obShown = -1; tab = 'home'; firstHome = true; animIn = true;
  render(); scrollTo(0, 0); hud('C’est prêt !', 'var(--inj)', { cadi: true, expr: 'excited', n: interval(t), sub: 'Bienvenue dans Cadence' }); setTimeout(() => burst({ x: innerWidth / 2, y: innerHeight * .4 }, ['var(--inj)', 'var(--prot)', 'var(--eau)', 'var(--fib)', '#FFD60A'], 36, 1.6), 250);
}

/* ---------- Actions ---------- */
function closeAllThen(f) { if (stack.length) { while (stack.length) closeSheet(); setTimeout(f, 220); } else f(); }
function icsFile(name, lines) {
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cadence//FR', 'CALSCALE:GREGORIAN', ...lines, 'END:VCALENDAR'].join('\r\n');
  if (IOS) location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics); else dl(name, ics, 'text/calendar');
}
const icsT = x => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
const icsClean = s => String(s).replace(/[,;\\\n]/g, ' ');
const A = {
  fab: fFab,
  newInj(id) { closeAllThen(() => fInj(id)); },
  newW() { closeAllThen(fW); },
  newM() { closeAllThen(fM); },
  newS() { closeAllThen(fS); },
  newT() { closeAllThen(() => fT()); },
  editT(id) { closeAllThen(() => fT(id)); },
  pen(id) { closeAllThen(() => fT(id)); },
  hab(k) { closeAllThen(() => fHab(k || 'p')); },
  goals() { closeAllThen(fGoals); },
  appt() { closeAllThen(fAppt); },
  questions() { closeAllThen(fQuestions); },
  costs() { closeAllThen(fCosts); },
  info(id) { fInfo(id); },
  report() { closeAllThen(() => openReport()); },
  profile() { tab = 'more'; render(); setTimeout(() => { const i = $('#p-max'); if (i) { i.scrollIntoView({ block: 'center' }); i.focus(); } }, 50); },
  peek() { peek = true; render(); },
  dismiss(k, el) { collapse(el && el.closest('.alert'), () => { S.dismissed[k] = true; save(); render(); }); },
  toggle(k, el) { S.settings[k] = !S.settings[k]; peek = false; save(); haptic(); if (el) el.setAttribute('aria-checked', S.settings[k]); setTimeout(render, REDUCED ? 0 : 260); },
  cadi(id, el) {
    cadiTaps++; haptic();
    if (cadiTaps % 3 === 0) cadiSpin(el); else cadiJelly(el);
    const tips = cadiTips(), [tx, ex] = tips[(cadiTaps - 1) % tips.length];
    if (cadiTaps % 3 === 0) { el.dataset.after = ex; say(tx, el.dataset.expr); } else say(tx, ex);
  },
  cadiPoke(id, el) { haptic(); cadiSpin(el); },
  replayRing(id) { PREV.delete('ring:' + id); PREV.delete('late:' + id); firstHome = true; haptic(); render(); },
  quickW(id, el) { const pt = center(el), bub = center(el && el.closest('.hab') && el.closest('.hab').querySelector('.bubble')); pop(el, 1.2); haptic(); const it = addIntake('w', 250, 'Verre'); render(); floatText(pt, '+250 mL', 'var(--eau)'); toast(`${habFmt('w', intake('w'))} d’eau aujourd’hui`, false, () => { S.intake = S.intake.filter(x => x.id !== it.id); save(); render(); }); goalCheck(it, bub || pt); },
  quickS(id, el) { const pt = center(el), bub = center(el && el.closest('.hab') && el.closest('.hab').querySelector('.bubble')); pop(el, 1.2); haptic(); const it = addIntake('s', 1, 'Séance de renforcement'); render(); floatText(pt, '+1 séance', 'var(--renfo)'); toast(`${sessionsWeek()} séance${sessionsWeek() > 1 ? 's' : ''} cette semaine`, false, () => { S.intake = S.intake.filter(x => x.id !== it.id); save(); render(); }); goalCheck(it, bub || pt); },
  habCustom(k, el) { const v = num(q('#h-v').value); if (!(v > 0)) return toast('Indique une quantité', true); const pt = center(q('.hab-total')); haptic(); const it = addIntake(k, v, 'Autre'); refreshHab(k); floatText(pt, `+${k === 'w' ? fr(v, 0) + ' mL' : fr(v, 0) + ' g'}`, HAB[k].color); goalCheck(it, pt); },
  habDel(id, el) { const it = S.intake.find(x => x.id === id); collapse(el && el.closest('.row'), () => { S.intake = S.intake.filter(x => x.id !== id); save(); if (it) refreshHab(it.k); }); },
  saveGoals() {
    const p = num(q('#g-p').value), w = num(q('#g-w').value), f = num(q('#g-f').value), s = num(q('#g-s').value);
    S.goals = { p: p >= 0 ? Math.round(p) : S.goals.p, w: w >= 0 ? Math.round(w * (w < 20 ? 1000 : 1)) : S.goals.w, f: f >= 0 ? Math.round(f) : S.goals.f, s: s >= 0 ? Math.round(s) : S.goals.s };
    save(); closeSheet(); render(); toast('Objectifs enregistrés');
  },
  saveInj() {
    const tid = q('#i-t').value, typed = num(q('#i-dose').value), pill = q('#i-pills') ? num(q('#i-pills').dataset.v) : NaN;
    const dose = typed > 0 ? typed : pill, date = q('#i-date').value;
    if (!(dose > 0)) return toast('Choisis la dose injectée', true);
    if (!date) return toast('Indique la date', true);
    S.injections.push({ id: uid(), tid, dose, date, site: q('#i-body').dataset.sel || '', note: q('#i-note').value.trim() });
    const t = T(tid); if (t.stock !== '' && t.stock != null) t.stock = Math.max(0, num(t.stock) - 1);
    advancePen(t, date);
    focusT = tid; save(); closeSheet(); firstHome = true; PREV.delete('ring:' + tid);
    const p = penInfo(t);
    hud('Injection notée', t.color, { cadi: true, expr: 'excited', n: interval(t), sub: p ? `Dose ${p.used} sur ${p.per} du stylo` : `Prochaine ${relDay(new Date(D(date).getTime() + interval(t) * DAY))}` });
    setTimeout(() => { if (tab !== 'home') { tabDir = -1; tab = 'home'; tabPop = true; renderTabs(); } render(); scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }); }, REDUCED ? 0 : 380);
  },
  newPen(id) { const t = T(id); t.pen = null; save(); closeSheet(); render(); toast('Le nouveau stylo démarrera à ta prochaine injection'); },
  saveW() {
    const kg = num(q('#w-kg').value), date = q('#w-date').value || today();
    if (!(kg >= 20 && kg <= 350)) return toast('Indique un poids en kg', true);
    S.weights = S.weights.filter(w => w.date !== date); S.weights.push({ id: uid(), date, kg: Math.round(kg * 10) / 10 });
    save(); closeSheet(); render(); haptic(); toast('Poids enregistré');
  },
  saveM() {
    const m = { id: uid(), date: q('#m-date').value || today() }; let any = false;
    ['waist', 'hips', 'thigh', 'arm', 'lean'].forEach(k => { const v = num(q('#m-' + k).value); if (v > 0) { m[k] = v; any = true; } });
    if (!any) return toast('Renseigne au moins une mesure', true);
    S.measures.push(m); save(); closeSheet(); render(); toast('Mensurations enregistrées');
  },
  saveS() {
    const sel = $$('#s-feel [aria-pressed="true"], .feel [aria-pressed="true"]', topS()).map(b => b.dataset.feel); if (!sel.length) return;
    const lb = q('#s-lvl [aria-pressed="true"]'), lv = lb ? +lb.dataset.lvl : 1, date = q('#s-date').value || today(), note = q('#s-note').value.trim();
    [...new Set(sel)].forEach(type => S.symptoms.push({ id: uid(), date, type, level: isEffect(type) ? lv : 0, note }));
    save(); closeSheet(); render(); haptic(); toast(sel.length > 1 ? 'Ressentis enregistrés' : 'Ressenti enregistré');
  },
  saveT() {
    const name = q('#t-name').value.trim(), int = num(q('#t-int').value);
    if (!name) return toast('Donne un nom au traitement', true);
    if (!(int > 0)) return toast('Indique le rythme des injections', true);
    const hl = num(q('#t-hl').value), tm = num(q('#t-tmax').value), st = q('#t-stock').value.trim(), col = q('#t-col [aria-pressed="true"]');
    const pd = num(q('#t-pd').value), pj = num(q('#t-pj').value);
    const d = { name, molecule: q('#t-mol').value.trim(), unit: q('#t-unit').value, intervalDays: int, halfLifeH: hl > 0 ? hl : '', tmaxH: tm > 0 ? tm : '', stock: st === '' || isNaN(num(st)) ? '' : Math.max(0, Math.round(num(st))), color: col ? col.dataset.color : COLORS[0], preset: q('#t-preset').value, penDoses: pd > 0 ? Math.round(pd) : '', penDays: pj > 0 ? Math.round(pj) : '' };
    const id = q('#t-id').value;
    if (id) Object.assign(T(id), d); else { d.id = uid(); d.archived = false; d.pen = null; S.treatments.push(d); focusT = d.id; }
    save(); closeSheet(); render(); toast(id ? 'Traitement modifié' : 'Traitement ajouté');
  },
  archT(id) { const t = T(id); t.archived = !t.archived; save(); closeSheet(); render(); toast(t.archived ? 'Traitement arrêté' : 'Traitement repris'); },
  delT(id) {
    const n = S.injections.filter(i => i.tid === id).length;
    confirmSheet('Supprimer ce traitement ?', n ? `Ses ${n} injection${n > 1 ? 's' : ''} ser${n > 1 ? 'ont' : 'a'} aussi supprimée${n > 1 ? 's' : ''}. Pour garder l’historique, marque-le plutôt comme arrêté.` : 'Cette action est définitive.', 'Supprimer', () => {
      S.treatments = S.treatments.filter(t => t.id !== id); S.injections = S.injections.filter(i => i.tid !== id); save(); while (stack.length) closeSheet(); render(); toast('Traitement supprimé');
    });
  },
  delEntry(ref) { const [k, id] = ref.split(':'); const old = S[k].slice(); S[k] = S[k].filter(x => x.id !== id); save(); closeSheet(); render(); toast('Entrée supprimée', false, () => { S[k] = old; save(); render(); }); },
  confirmOk() { const f = topS() && topS()._ok; f && f(); },
  qAdd() { const v = q('#q-new').value.trim(); if (!v) return; const nid = uid(); S.questions.push({ id: nid, text: v, done: false, date: today() }); save(); q('.body').innerHTML = questionsBody(); render(); haptic(); const row = q(`[data-id="${nid}"]`); row && !REDUCED && row.closest('.qrow').animate([{ opacity: 0, transform: 'translateY(-10px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' }); const i = q('#q-new'); i && i.focus(); },
  qToggle(id, el) { const x = S.questions.find(y => y.id === id); x.done = !x.done; save(); if (x.done) haptic(); pop(el, 1.25); setTimeout(() => { q('.body').innerHTML = questionsBody(); render(); }, x.done ? 260 : 0); if (x.done) { const r = el.closest('.qrow'); r.dataset.done = 'true'; } },
  qDel(id, el) { collapse(el && el.closest('.qrow'), () => { S.questions = S.questions.filter(y => y.id !== id); save(); q('.body').innerHTML = questionsBody(); render(); }); },
  qFrom(id) {
    const s = S.symptoms.find(x => x.id === id); if (!s) return;
    S.questions.push({ id: uid(), text: `${s.type}${s.level ? ' (' + LEVELS[s.level].toLowerCase() + ')' : ''} noté le ${dfmt(s.date, { day: 'numeric', month: 'long' })}${s.note ? ' : ' + s.note : ''}. Est-ce attendu, et que faire ?`, done: false, date: today() });
    save(); if (stack.length) closeSheet(); render(); toast('Ajouté à tes questions');
  },
  saveAppt() { S.appt = q('#a-date').value || ''; save(); closeSheet(); render(); toast(S.appt ? 'Rendez-vous enregistré' : 'Rendez-vous retiré'); },
  apptDel() { S.appt = ''; save(); closeSheet(); render(); },
  apptIcs() { if (!S.appt) return; const d = D(S.appt); icsFile('rendez-vous.ics', ['BEGIN:VEVENT', 'UID:' + uid() + '@cadence', 'DTSTAMP:' + icsT(new Date()), 'DTSTART:' + icsT(d), 'DTEND:' + icsT(new Date(d.getTime() + 30 * 6e4)), 'SUMMARY:Rendez-vous de suivi', 'DESCRIPTION:Pense à ouvrir Cadence : tes questions et ton rapport', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Rendez-vous de suivi dans 2 jours', 'TRIGGER:-P2D', 'END:VALARM', 'END:VEVENT']); },
  newCost() { fNewCost(); },
  cost65() { const p = num(q('#c-p').value); if (!(p > 0)) return toast('Indique d’abord le prix', true); q('#c-s').value = fr(p * .65, 2); },
  saveCost() {
    const paid = num(q('#c-p').value); if (!(paid >= 0)) return toast('Indique le prix payé', true);
    S.costs.push({ id: uid(), date: q('#c-d').value || today(), label: q('#c-l').value.trim(), paid, secu: num(q('#c-s').value) || 0, mut: num(q('#c-m').value) || 0 });
    save(); closeSheet(); const b = q('.body'); if (b) b.innerHTML = costsBody(); fillImgs(topS()); render(); toast('Achat ajouté');
  },
  costDel(id, el) { collapse(el && el.closest('.row'), () => { S.costs = S.costs.filter(c => c.id !== id); save(); q('.body').innerHTML = costsBody(); fillImgs(topS()); render(); }); },
  addPhoto(kind) { const i = $('#photo-in'); i.dataset.kind = kind || 'body'; i.value = ''; i.click(); },
  viewPhoto(id) { fPhoto(id); },
  delPhoto(id) { confirmSheet('Supprimer la photo ?', 'Elle sera effacée de ce téléphone.', 'Supprimer', async () => { S.photos = S.photos.filter(p => p.id !== id); save(); try { await IDB.del(id); } catch (e) { } const u = URLS.get(id); if (u) URL.revokeObjectURL(u); URLS.delete(id); while (stack.length) closeSheet(); render(); }); },
  closeReport() { $('#report').hidden = true; $('#report').innerHTML = ''; if (!stack.length) document.body.classList.remove('locked'); },
  printReport() { window.print(); },
  ics(id) {
    const t = T(id), st = status(t); if (!st.last) return toast('Note d’abord une injection', true);
    const d = new Date(st.due);
    icsFile('rappel-' + t.name.toLowerCase().replace(/\W+/g, '-') + '.ics', ['BEGIN:VEVENT', 'UID:' + uid() + '@cadence', 'DTSTAMP:' + icsT(new Date()), 'DTSTART:' + icsT(d), 'DTEND:' + icsT(new Date(d.getTime() + 15 * 6e4)), `RRULE:FREQ=DAILY;INTERVAL=${st.n}`, 'SUMMARY:Injection ' + icsClean(t.name), 'DESCRIPTION:Rappel Cadence', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Injection ' + icsClean(t.name), 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT']);
  },
  exp() { S.lastBackup = today(); save(); give(`cadence-${today()}.json`, JSON.stringify(S, null, 2), 'application/json'); render(); },
  csv() {
    const c = v => '"' + String(v ?? '').replace(/"/g, '""') + '"', rows = [['type', 'date', 'traitement', 'valeur', 'unite', 'detail', 'note']], dec = v => String(v).replace('.', ',');
    S.injections.forEach(i => { const t = T(i.tid) || {}; rows.push(['injection', i.date.replace('T', ' '), t.name, dec(i.dose), t.unit, siteLabel(i.site), i.note]); });
    S.weights.forEach(w => rows.push(['poids', w.date, '', dec(w.kg), 'kg', '', '']));
    S.measures.forEach(m => rows.push(['mensurations', m.date, '', '', '', measTxt(m), '']));
    S.symptoms.forEach(s => rows.push(['ressenti', s.date, '', s.level, '/3', s.type, s.note]));
    S.intake.forEach(i => rows.push(['habitude', i.date, '', dec(i.v), HAB[i.k].unit, HAB[i.k].label + (i.label ? ' : ' + i.label : ''), '']));
    S.costs.forEach(x => rows.push(['achat', x.date, '', dec(x.paid), '€', `remboursé ${dec((+x.secu || 0) + (+x.mut || 0))} €`, x.label]));
    give(`cadence-${today()}.csv`, '﻿' + rows.map(r => r.map(c).join(';')).join('\n'), 'text/csv');
  },
  imp() { $('#file').click(); },
  wipe() { confirmSheet('Tout effacer ?', 'Traitements, injections, pesées, ressentis, habitudes et photos seront supprimés de cet appareil. Exporte une sauvegarde avant si tu veux les garder.', 'Tout effacer', async () => { localStorage.removeItem(KEY); try { for (const p of S.photos) await IDB.del(p.id); } catch (e) { } URLS.clear(); S = blank(); tab = 'home'; while (stack.length) closeSheet(true); document.body.classList.remove('locked'); render(); }); },
  obNext() { obGo(1); }, obBack() { obGo(-1); },
  obSkip() { const s = OBS[obStep]; if (s === 'name') ob.name = ''; if (s === 'dose') ob.dose = null; if (s === 'weight') ob.weight = null; if (s === 'goal') ob.goal = null; obGo(1); },
  obOk() { ob.ok = !ob.ok; const b = $('.switch-row'); b.setAttribute('aria-checked', ob.ok); $('#ob-cta').disabled = !ob.ok; haptic(); },
  obDone
};
function dl(name, data, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); }
async function give(name, data, type) {
  try { const f = new File([data], name, { type }); if (IOS && navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: name }); return; } }
  catch (e) { if (e && e.name === 'AbortError') return; }
  dl(name, data, type);
}

/* ---------- Événements ---------- */
const SEL = '[data-act],[data-close],[data-tab],[data-focus],[data-jf],[data-range],[data-entry],[data-dose],[data-site],[data-feel],[data-lvl],[data-color],[data-injt],[data-preset],[data-obp],[data-obdose],[data-oblast],[data-add],[data-habk],[data-repd]';
document.addEventListener('click', e => {
  if (e.target.closest('#say')) return hideSay();
  const el = e.target.closest(SEL); if (!el) return;
  const d = el.dataset;
  if (d.act) return A[d.act] && A[d.act](d.id, el);
  if ('close' in d) return closeSheet();
  if (d.tab) {
    const order = ['home', 'journal', 'progress', 'more'];
    if (d.tab === tab) { scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }); return; }
    tabDir = order.indexOf(d.tab) >= order.indexOf(tab) ? 1 : -1; tab = d.tab; peek = false; animIn = true; tabPop = el.closest('#tabs') ? true : false;
    if (d.tab === 'home') firstHome = true;
    render(); scrollTo(0, 0); return;
  }
  if (d.focus) { focusT = d.focus; firstHome = true; render(); return; }
  if (d.jf) { jFilter = d.jf; animIn = true; render(); return; }
  if (d.range !== undefined) { range = +d.range; animIn = true; render(); return; }
  if (d.repd !== undefined) { openReport(+d.repd); return; }
  if (d.entry) { const [k, id] = d.entry.split(':'); return fEntry(k, id); }
  if (d.habk) { const b = q('.body'); b.innerHTML = habBody(d.habk); animateCounts(b); syncSegs(b); if (!REDUCED) b.querySelector('[style*="--c"]').animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' }); return; }
  if (d.add) { const [k, v, l] = d.add.split('|'); const pt = center(el), tot = center(q('.hab-total')); pop(el, 1.06); haptic(); const it = addIntake(k, +v, l); refreshHab(k); floatText(pt, k === 's' ? '+1' : `+${k === 'w' ? v + ' mL' : v + ' g'}`, HAB[k].color); toast(k === 's' ? 'Séance notée' : l, false, () => { S.intake = S.intake.filter(x => x.id !== it.id); save(); refreshHab(k); }); goalCheck(it, tot || pt); return; }
  if (d.dose) { const w = el.parentNode; w.dataset.v = d.dose; $$('.pill', w).forEach(b => b.setAttribute('aria-pressed', b === el)); q('#i-dose').value = ''; haptic(); return; }
  if (d.site) return pickSite(el);
  if (d.feel) {
    const all = $$('[data-feel]', topS()), on = el.getAttribute('aria-pressed') !== 'true';
    if (on) all.forEach(b => { if ((d.feel === GOOD) !== (b.dataset.feel === GOOD)) b.setAttribute('aria-pressed', 'false'); });
    el.setAttribute('aria-pressed', on);
    const sel = all.filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.feel), btn = q('[data-act="saveS"]');
    const lw = q('#s-lvl-w'), wasHidden = lw.hidden; lw.hidden = !sel.some(isEffect);
    if (wasHidden && !lw.hidden) { syncSegs(lw); if (!REDUCED) lw.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 280 }); }
    if (on) haptic();
    btn.disabled = !sel.length; btn.textContent = sel.length ? `Enregistrer${sel.length > 1 ? ' (' + sel.length + ')' : ''}` : 'Choisis au moins un ressenti';
    return;
  }
  if (d.lvl || d.color) { $$('button', el.parentNode).forEach(b => b.setAttribute('aria-pressed', b === el)); syncSegs(el.parentNode.parentNode); haptic(); return; }
  if (d.injt) { const b = q('.body'); b.innerHTML = injBody(T(d.injt)); topS().style.setProperty('--c', T(d.injt).color); syncSegs(b); return; }
  if (d.preset) {
    const p = PRESETS.find(x => x.key === d.preset); $$('.chip', el.parentNode).forEach(b => b.setAttribute('aria-pressed', b === el));
    q('#t-preset').value = p.key; q('#t-fields').innerHTML = tFields(Object.assign({ stock: q('#t-stock').value }, p, { preset: p.key }));
    if (p.key === 'custom') q('#t-name').focus();
    return;
  }
  if (d.obp) { ob.preset = d.obp; ob.dose = null; render(); if (d.obp === 'custom') setTimeout(() => { const i = $('#ob-cn'); i && i.focus(); }, 60); return; }
  if (d.obdose) { ob.dose = +d.obdose; $$('[data-obdose]').forEach(b => b.setAttribute('aria-pressed', b === el)); const i = $('#ob-d'); if (i) i.value = ''; obCta(); haptic(); return; }
  if (d.oblast) { ob.last = /^\d+$/.test(d.oblast) ? +d.oblast : d.oblast; render(); if (d.oblast === 'date') setTimeout(() => { const i = $('#ob-ld'); i && i.focus(); }, 60); return; }
});
function pickSite(el) {
  const box = el.closest('#i-body'); if (!box) return;
  box.dataset.sel = el.dataset.site;
  $$('.zone', box).forEach(z => { z.classList.toggle('on', z === el); z.setAttribute('aria-pressed', z === el); });
  pop(el, 1.3); haptic();
  const tid = q('#i-t').value; $('#i-cap', box).innerHTML = siteCap(tid, el.dataset.site, rotation(tid));
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!$('#report').hidden) return A.closeReport(); if (stack.length) closeSheet(); }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('zone')) { e.preventDefault(); pickSite(e.target); }
  if (e.key === 'Enter' && e.target.id === 'q-new') { e.preventDefault(); A.qAdd(); }
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
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset.prof) { S.profile[el.dataset.prof] = el.value.trim(); save(); toast('Profil enregistré'); return; }
  if (el.dataset.ob) { ob[el.dataset.ob] = el.value; return obCta(); }
  if (el.id === 'rx') { S.rxEnd = el.value; save(); render(); toast('Date enregistrée'); return; }
  if (el.id === 'i-date') { const v = el.value; q('#i-when').textContent = !v || Math.abs(D(v) - Date.now()) < 3 * 6e4 ? 'Maintenant' : cap(relDay(v)) + ' à ' + tfmt(v); return; }
  if (['w-date', 's-date', 'm-date'].includes(el.id)) { q('#' + el.id.split('-')[0] + '-when').textContent = el.value ? cap(relDay(el.value)) : 'Aujourd’hui'; return; }
  if (el.id === 'photo-in' && el.files[0]) {
    const kind = el.dataset.kind || 'body';
    try {
      const blob = await shrink(el.files[0]), id = uid();
      if (kind === 'doc') { for (const p of S.photos.filter(x => x.kind === 'doc')) { try { await IDB.del(p.id); } catch (x) { } URLS.delete(p.id); } S.photos = S.photos.filter(x => x.kind !== 'doc'); }
      await IDB.put({ id, blob }); URLS.set(id, URL.createObjectURL(blob));
      S.photos.push({ id, date: today(), kind }); save();
      if (kind === 'doc' && stack.length && q('[data-act="newCost"]')) { q('.body').innerHTML = costsBody(); fillImgs(topS()); }
      else if (stack.length) while (stack.length) closeSheet();
      if (kind === 'body') tab = 'progress';
      render(); toast(kind === 'doc' ? 'Volet 3 enregistré sur ce téléphone' : 'Photo ajoutée');
    } catch (x) { toast('Impossible d’enregistrer cette photo', true); }
    el.value = ''; return;
  }
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
loadPhotos();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
