/* Cálculos y gráficos del panel: puedes gastar por día, saldo, categorías, gasto del mes. */
import { fmt, esc, kfmt } from '../app/estado.js';
import { D } from '../app/render.js';
import { chartPoint } from './proyeccion.js';
import { cap } from '../pantallas/comunes.js';

// "Puedes gastar $X por día": saldo de hoy + ingresos fijos que vienen − pagos fijos que vienen − tu mínimo,
// repartido en los 28 días de la proyección.
export function dailyPlan(d) {
  const up = d.proj.upcoming;
  const income = up.filter((u) => u.amount > 0).reduce((s, u) => s + u.amount, 0);
  const fixed = up.filter((u) => u.amount < 0).reduce((s, u) => s - u.amount, 0);
  const free = d.total + income - fixed - d.proj.minimum;
  return { income, fixed, free, perDay: Math.max(0, Math.floor(free / 28 / 100) * 100) };
}
// Gastos del mes por categoría (la misma que explica cada movimiento). Deja las 6 más grandes y junta el resto.
export function spendByTag(txs, ym) {
  const by = {};
  for (const t of txs) {
    if (t.internal || t.amount >= 0 || FF.monthKey(t.date) !== ym) continue;
    const k = t.tag || 'otros';
    by[k] = by[k] || { name: k, total: 0, negocio: 0 };
    by[k].total -= t.amount; if (t.scope === 'negocio') by[k].negocio -= t.amount;
  }
  const otros = by.otros; delete by.otros;
  const list = Object.values(by).sort((x, y) => y.total - x.total);
  const rest = list.splice(6).concat(otros || []);
  if (rest.length) list.push({ name: 'otros', total: rest.reduce((s, r) => s + r.total, 0), negocio: rest.reduce((s, r) => s + r.negocio, 0) });
  return list;
}

// Colores por categoría: las 5 principales tienen color propio y el resto va a "Otros".
export const colorCat = (tag) => { const i = D.cats.indexOf(tag); return i >= 0 ? `var(--s${i + 1})` : 'var(--s-otros)'; };
export const nombreCat = (tag) => (D.cats.includes(tag) ? cap(tag) : 'Otros');
export function gastosPorCategoria(txs, desde, hasta) {
  const by = {};
  for (const t of txs) {
    if (t.internal || t.amount >= 0 || t.date < desde || t.date > hasta) continue;
    const k = D.cats.includes(t.tag) ? t.tag : 'otros';
    by[k] = (by[k] || 0) - t.amount;
  }
  const list = Object.entries(by).map(([tag, total]) => ({ tag, name: nombreCat(tag), total, color: colorCat(tag) }));
  return list.sort((a, b) => (a.tag === 'otros') - (b.tag === 'otros') || b.total - a.total);
}
// Saldo total de cada día del período (sumando todas las cuentas).
export function serieSaldo(accounts, desde, hasta) {
  const dias = FF.diffDays(desde, hasta) + 1; const total = new Array(dias).fill(0);
  for (const a of accounts) {
    if (!a.rows.length) continue;
    let bal = a.rows[0].balance !== null ? a.rows[0].balance - a.rows[0].amount : 0;
    const porDia = {}; for (const r of a.rows) { bal = r.balance !== null ? r.balance : bal + r.amount; porDia[r.date] = bal; }
    let cur = a.rows[0].balance !== null ? a.rows[0].balance - a.rows[0].amount : 0;
    for (const r of a.rows) { if (r.date >= desde) break; cur = porDia[r.date]; }
    for (let i = 0; i < dias; i++) { const d = FF.addDays(desde, i); if (porDia[d] !== undefined) cur = porDia[d]; total[i] += cur; }
  }
  return total;
}
// Gasto acumulado de un mes, día a día (sin traspasos propios). Hasta "hastaDia" si el mes va en curso.
export function gastoAcumulado(txs, ym, hastaDia) {
  const [y, m] = ym.split('-').map(Number); const dias = new Date(y, m, 0).getDate();
  const porDia = new Array(dias).fill(0);
  for (const t of txs) if (!t.internal && t.amount < 0 && FF.monthKey(t.date) === ym) porDia[Number(t.date.slice(8, 10)) - 1] -= t.amount;
  let s = 0; return porDia.map((v, i) => { s += v; return hastaDia && i + 1 > hastaDia ? null : s; });
}

// Gráfico de líneas con tooltip. series: [{ name, color, dash, vals: [número o null] }]
export const VIZ = {};
export let vizSeq = 0;
export function lineChart({ series, n, xLabel, aria, w = 460, h = 220, zero = false, area = false, tip }) {
  const padL = 54, padR = 14, padT = 14, padB = 26;
  const vals = series.flatMap((s) => s.vals.filter((v) => v !== null));
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (zero) lo = 0;
  const span = hi - lo || Math.max(1, hi); if (!zero) lo -= span * 0.08; hi += span * 0.08;
  const raw = (hi - lo) / 3; const mag = Math.pow(10, Math.floor(Math.log10(raw || 1))); const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => k >= raw);
  const x = (i) => padL + (n <= 1 ? 0 : (i * (w - padL - padR)) / (n - 1));
  const y = (v) => padT + ((hi - v) / (hi - lo)) * (h - padT - padB);
  let grid = '';
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) grid += `<line x1="${padL}" x2="${w - padR}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${padL - 8}" y="${y(v) + 4}" text-anchor="end" font-size="12" fill="var(--faint)">${kfmt(v)}</text>`;
  const marcas = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i);
  const xl = marcas.map((i, k) => `<text x="${x(i)}" y="${h - 7}" text-anchor="${k === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}" font-size="12" fill="var(--muted)">${esc(xLabel(i))}</text>`).join('');
  const path = (s) => { let d = ''; s.vals.forEach((v, i) => { if (v === null) return; d += (d ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1); }); return d; };
  const lines = series.map((s, k) => {
    const ult = s.vals.reduce((m, v, i) => (v === null ? m : i), -1);
    const relleno = area && k === 0 ? `<path d="${path(s)}L${x(ult)},${y(lo)}L${x(0)},${y(lo)}Z" style="fill:${s.color}" fill-opacity="0.12"/>` : '';
    return `${relleno}<path d="${path(s)}" fill="none" style="stroke:${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" ${s.dash ? 'stroke-dasharray="5 4"' : ''}/>`;
  }).join('');
  const id = 'v' + (++vizSeq);
  VIZ[id] = { series, n, x, y, xLabel, tip, w, h };
  return `<div class="chart-int"><svg class="viz" data-viz="${id}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(aria)}">
    ${grid}${lines}${xl}
    <line class="viz-guide" x1="0" x2="0" y1="${padT}" y2="${h - padB}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 4" visibility="hidden"/>
    ${series.map((s, k) => `<circle class="viz-dot" data-k="${k}" r="5" style="fill:${s.color}" stroke="var(--bg)" stroke-width="2" visibility="hidden"/>`).join('')}
    <rect class="viz-hit" data-viz="${id}" x="${padL}" y="${padT}" width="${w - padL - padR}" height="${h - padT - padB}" fill="transparent"/>
  </svg><div class="ff-tip" hidden></div></div>`;
}
export function vizTip(svg, evt) {
  const c = VIZ[svg.dataset.viz]; if (!c) return;
  const { x } = chartPoint(svg, evt);
  const i = Math.max(0, Math.min(c.n - 1, Math.round(((x - c.x(0)) / (c.x(c.n - 1) - c.x(0) || 1)) * (c.n - 1))));
  const g = svg.querySelector('.viz-guide'); g.setAttribute('x1', c.x(i)); g.setAttribute('x2', c.x(i)); g.setAttribute('visibility', 'visible');
  let top = c.h;
  svg.querySelectorAll('.viz-dot').forEach((dot) => {
    const v = c.series[Number(dot.dataset.k)].vals[i];
    if (v === null || v === undefined) { dot.setAttribute('visibility', 'hidden'); return; }
    dot.setAttribute('cx', c.x(i)); dot.setAttribute('cy', c.y(v)); dot.setAttribute('visibility', 'visible'); top = Math.min(top, c.y(v));
  });
  const tip = svg.parentElement.querySelector('.ff-tip');
  tip.innerHTML = `<strong>${esc(c.xLabel(i, true))}</strong>` + c.series.map((s) => (s.vals[i] === null || s.vals[i] === undefined ? '' : `<span class="d-flex align-items-center gap-2"><span class="dot-cat" style="background:${s.color}"></span>${esc(s.name)} <b class="num ms-auto">${fmt(s.vals[i])}</b></span>`)).join('') + (c.tip ? c.tip(i) : '');
  tip.hidden = false;
  const rect = svg.getBoundingClientRect(); const left = (c.x(i) / c.w) * rect.width;
  tip.style.left = Math.max(8, Math.min(rect.width - tip.offsetWidth - 8, left - tip.offsetWidth / 2)) + 'px';
  tip.style.top = Math.max(0, (top / c.h) * rect.height - tip.offsetHeight - 14) + 'px';
}
export function vizHide(svg) {
  svg.querySelector('.viz-guide').setAttribute('visibility', 'hidden');
  svg.querySelectorAll('.viz-dot').forEach((d) => d.setAttribute('visibility', 'hidden'));
  const tip = svg.parentElement.querySelector('.ff-tip'); if (tip) tip.hidden = true;
}
document.addEventListener('pointermove', (e) => {
  const svg = e.target.closest && e.target.closest('svg.viz');
  document.querySelectorAll('svg.viz[data-viz]').forEach((s) => { if (s !== svg) vizHide(s); });
  if (svg && e.target.classList.contains('viz-hit')) vizTip(svg, e);
});
document.addEventListener('pointerdown', (e) => { if (e.target.classList && e.target.classList.contains('viz-hit')) vizTip(e.target.ownerSVGElement, e); });

// Dona de gastos: un anillo con un espacio entre categorías y el total al centro.
export function donut(items, total) {
  const R = 70, C = 2 * Math.PI * R; let off = 0;
  const segs = items.map((it) => {
    const len = (it.total / total) * C; const s = `<circle cx="90" cy="90" r="${R}" fill="none" style="stroke:${it.color}" stroke-width="18" stroke-dasharray="${Math.max(0.5, len - 2).toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 90 90)"><title>${esc(it.name)}: ${fmt(it.total)} (${Math.round((it.total / total) * 100)} %)</title></circle>`;
    off += len; return s;
  }).join('');
  return `<svg class="viz mx-auto" style="max-width:200px" viewBox="0 0 180 180" role="img" aria-label="Gastos por categoría, total ${fmt(total)}">
    <circle cx="90" cy="90" r="${R}" fill="none" stroke="var(--line)" stroke-width="18" opacity=".35"/>${segs}
    <text x="90" y="84" text-anchor="middle" font-size="11" fill="var(--muted)">Gasto total</text>
    <text x="90" y="104" text-anchor="middle" font-size="17" font-weight="700" fill="currentColor">${kfmt(total)}</text></svg>`;
}
