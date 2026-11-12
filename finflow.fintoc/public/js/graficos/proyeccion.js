/* Gráfico de la proyección a 4 semanas: tooltip, arrastre del mínimo y números que suben. */
import { fmt, esc, signed, kfmt, S } from '../app/estado.js';
import { avisoEjemplo } from '../app/notificaciones.js';
import { render } from '../app/render.js';

// gráfico de proyección
// Registro de gráficos dibujados (para tooltip y arrastre del mínimo).
export const CHARTS = {};
export let chartSeq = 0;
// Si el próximo dibujo anima los números. Los otros archivos lo cambian con setAnimateNext().
export let animateNext = true;
export function setAnimateNext(v) { animateNext = v; }
export function chart(d, opts = {}) {
  const p = d.proj; const W = opts.w || 640; const H = opts.h || 260;
  const padL = opts.compact ? 8 : 64, padR = opts.compact ? 16 : 28, padT = 18, padB = 30;
  const xs = [0, 1, 2, 3, 4].map((i) => padL + (i * (W - padL - padR)) / 4);
  const all = [p.startBalance, p.minimum].concat(p.points.flatMap((q) => [q.p10, q.p90]));
  let lo = Math.min(...all), hi = Math.max(...all); const span = hi - lo || 1; lo -= span * 0.08; hi += span * 0.08;
  const y = (v) => padT + ((hi - v) / (hi - lo)) * (H - padT - padB);
  const med = [p.startBalance].concat(p.points.map((q) => q.p50));
  const up = [p.startBalance].concat(p.points.map((q) => q.p90));
  const dn = [p.startBalance].concat(p.points.map((q) => q.p10));
  const band = up.map((v, i) => `${xs[i]},${y(v)}`).join(' ') + ' ' + dn.map((v, i) => `${xs[i]},${y(v)}`).reverse().join(' ');
  const line = med.map((v, i) => `${xs[i]},${y(v)}`).join(' ');
  const ym = y(p.minimum);
  let ticks = '';
  if (!opts.compact) {
    const raw = (hi - lo) / 3; const mag = Math.pow(10, Math.floor(Math.log10(raw))); const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((m) => m >= raw);
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) { ticks += `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${padL - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--faint)">${kfmt(v)}</text>`; }
  }
  const labels = ['Hoy'].concat(p.points.map((q) => (opts.compact ? `S${q.week}` : `Sem ${q.week}`)));
  const fs = opts.compact ? 14 : 11;
  const xl = labels.map((l, i) => `<text x="${xs[i]}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}" font-size="${fs}" fill="var(--muted)">${l}</text>`).join('');
  const a = p.alert;
  const dot = a ? `<circle class="ff-pulse" cx="${xs[a.week]}" cy="${y(med[a.week])}" r="6" fill="var(--bg)" stroke="var(--warn)" stroke-width="3"/>` : '';
  const id = 'c' + (++chartSeq);
  CHARTS[id] = { p, xs, W, H, padL, padR, padT, padB, lo, hi, med, compact: !!opts.compact };
  const fixedMin = opts.compact || opts.noDrag;
  const drag = fixedMin ? '' : `<g class="ff-min" data-chart="${id}">
      <line class="ff-min-hit" x1="${padL}" x2="${W - padR}" y1="${ym}" y2="${ym}" stroke="transparent" stroke-width="22"/>
      <line class="ff-min-line" x1="${padL}" x2="${W - padR}" y1="${ym}" y2="${ym}" stroke="var(--danger)" stroke-width="1.5" stroke-dasharray="5 5" pointer-events="none"/>
      <circle class="ff-min-knob" cx="${W - padR}" cy="${ym}" r="8" fill="var(--bg)" stroke="var(--danger)" stroke-width="2" pointer-events="none"/>
      <text class="ff-min-label" x="${W - padR - 14}" y="${ym - 8}" text-anchor="end" font-size="11" fill="var(--danger)" pointer-events="none">Tu mínimo ${fmt(p.minimum)} · arrastra</text>
    </g>`;
  const minStatic = fixedMin ? `<line x1="${padL}" x2="${W - padR}" y1="${ym}" y2="${ym}" stroke="var(--danger)" stroke-width="1.5" stroke-dasharray="5 5"/>
    <text x="${W - padR}" y="${ym - 6}" text-anchor="end" font-size="${opts.compact ? 14 : 11}" fill="var(--danger)">Tu mínimo ${fmt(p.minimum)}</text>` : '';
  return `<div class="chart-int"><svg class="ff-chart ${animateNext ? 'anim' : ''}" data-chart="${id}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Proyección de saldo a 4 semanas: hoy ${fmt(p.startBalance)}; ${p.points.map((q) => `semana ${q.week} ${fmt(q.p50)}`).join(', ')}.">
    ${ticks}
    <polygon class="ff-band" points="${band}" fill="var(--accent)" fill-opacity="0.14"/>
    ${minStatic}
    <line class="ff-guide" x1="0" x2="0" y1="${padT}" y2="${H - padB}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 4" visibility="hidden"/>
    <polyline class="ff-line" pathLength="1" points="${line}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    ${med.map((v, i) => `<circle class="ff-pt" cx="${xs[i]}" cy="${y(v)}" r="3.5" fill="var(--accent)"/>`).join('')}
    ${dot}${xl}
    <circle class="ff-hover" r="7" fill="var(--accent)" stroke="var(--bg)" stroke-width="3" visibility="hidden"/>
    <rect class="ff-hit" data-chart="${id}" x="${padL - 10}" y="${padT}" width="${W - padL - padR + 20}" height="${H - padT - padB}" fill="transparent"/>
    ${drag}
  </svg><div class="ff-tip" hidden></div></div>`;
}

// Tooltip: semana más cercana al puntero.
export function chartPoint(svg, evt) {
  const pt = svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}
export function showTip(svg, evt) {
  const c = CHARTS[svg.dataset.chart]; if (!c) return;
  const { x } = chartPoint(svg, evt);
  let i = 0; c.xs.forEach((xx, k) => { if (Math.abs(xx - x) < Math.abs(c.xs[i] - x)) i = k; });
  const yv = c.padT + ((c.hi - c.med[i]) / (c.hi - c.lo)) * (c.H - c.padT - c.padB);
  const g = svg.querySelector('.ff-guide'); g.setAttribute('x1', c.xs[i]); g.setAttribute('x2', c.xs[i]); g.setAttribute('visibility', 'visible');
  const h = svg.querySelector('.ff-hover'); h.setAttribute('cx', c.xs[i]); h.setAttribute('cy', yv); h.setAttribute('visibility', 'visible');
  const tip = svg.parentElement.querySelector('.ff-tip');
  let html;
  if (i === 0) html = `<strong>Hoy</strong><span class="num">${fmt(c.p.startBalance)}</span><span class="faint">Saldo actual en tus cuentas</span>`;
  else {
    const q = c.p.points[i - 1];
    const items = c.p.upcoming.filter((u) => u.week === q.week).slice(0, 3);
    html = `<strong>Semana ${q.week} · ${FF.shortDate(q.start)} al ${FF.shortDate(q.end)}</strong>
      <span>Más probable <b class="num">${fmt(q.p50)}</b></span>
      <span class="faint num">Rango ${fmt(q.p10)} a ${fmt(q.p90)}</span>
      <span class="${q.belowOf20 >= 3 ? 'tip-warn' : 'faint'}">${q.belowOf20} de 20 escenarios bajo tu mínimo</span>
      ${items.map((u) => `<span class="faint">${FF.shortDate(u.date)} · ${esc(FF.titleCase(u.name))} <span class="num">${signed(u.amount)}</span></span>`).join('')}`;
  }
  tip.innerHTML = html; tip.hidden = false;
  const rect = svg.getBoundingClientRect(); const left = (c.xs[i] / c.W) * rect.width;
  tip.style.left = Math.max(8, Math.min(rect.width - tip.offsetWidth - 8, left - tip.offsetWidth / 2)) + 'px';
  tip.style.top = Math.max(0, (yv / c.H) * rect.height - tip.offsetHeight - 14) + 'px';
}
export function hideTip(svg) {
  if (!svg) return;
  svg.querySelector('.ff-guide').setAttribute('visibility', 'hidden');
  svg.querySelector('.ff-hover').setAttribute('visibility', 'hidden');
  const tip = svg.parentElement.querySelector('.ff-tip'); if (tip) tip.hidden = true;
}
export let dragging = null;
export function minFromEvent(svg, evt) {
  const c = CHARTS[svg.dataset.chart]; const { y } = chartPoint(svg, evt);
  const v = c.hi - ((y - c.padT) / (c.H - c.padT - c.padB)) * (c.hi - c.lo);
  return Math.max(0, Math.round(Math.min(c.hi, Math.max(c.lo, v)) / 10000) * 10000);
}
export function moveMin(svg, v) {
  const c = CHARTS[svg.dataset.chart]; const yy = c.padT + ((c.hi - v) / (c.hi - c.lo)) * (c.H - c.padT - c.padB);
  svg.querySelectorAll('.ff-min-hit, .ff-min-line').forEach((l) => { l.setAttribute('y1', yy); l.setAttribute('y2', yy); });
  svg.querySelector('.ff-min-knob').setAttribute('cy', yy);
  const t = svg.querySelector('.ff-min-label'); t.setAttribute('y', yy - 8); t.textContent = `Tu mínimo ${fmt(v)}`;
}
document.addEventListener('pointerdown', (e) => {
  if (e.target.classList && e.target.classList.contains('ff-hit')) { showTip(e.target.ownerSVGElement, e); return; }
  const g = e.target.closest('.ff-min'); if (!g) return;
  if (S.sample) { avisoEjemplo(); return; }
  const svg = g.ownerSVGElement; e.preventDefault();
  dragging = { svg, value: minFromEvent(svg, e) }; svg.classList.add('dragging'); hideTip(svg);
  try { svg.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
  moveMin(svg, dragging.value);
});
document.addEventListener('pointermove', (e) => {
  if (dragging) { dragging.value = minFromEvent(dragging.svg, e); moveMin(dragging.svg, dragging.value); return; }
  const svg = e.target.closest && e.target.closest('svg.ff-chart');
  document.querySelectorAll('svg.ff-chart').forEach((s) => { if (s !== svg) hideTip(s); });
  if (svg && e.target.classList.contains('ff-hit')) showTip(svg, e);
});
document.addEventListener('pointerup', () => {
  if (!dragging) return;
  const v = dragging.value; dragging.svg.classList.remove('dragging'); dragging = null;
  S.minimum = v; animateNext = false; render();
});

// Números que suben al cargar.
export function countUp() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count); const t0 = performance.now(); const dur = 900;
    const tick = (t) => { const k = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - k, 3); el.textContent = (target < 0 ? '−' : '') + fmt(target * e); if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
}

export function phrase(p) {
  if (!p.enough) return 'Con menos de 3 meses de historia mostramos solo tus gastos e ingresos fijos.';
  if (p.alert) return `En ${p.alert.belowOf20} de cada 20 escenarios tu saldo baja de tu mínimo la semana del ${FF.shortDate(p.alert.start)}.`;
  return 'En los 20 de cada 20 escenarios tu saldo se mantiene sobre tu mínimo.';
}
