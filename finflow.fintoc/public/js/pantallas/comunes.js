/* Piezas que usan varias pantallas: ayudas, título de un movimiento, recordatorios y presupuestos. */
import { I, fmt, esc, S } from '../app/estado.js';
import { D } from '../app/render.js';
import { FF } from '../logica/index.js';

// Ayudas para las pantallas nuevas
export const mayus = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
export const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
export const hoyReal = () => { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); };
export const tieneBoleta = (t) => S.boletas.some((b) => b.movimiento === t.id);
export function categorias() {
  return [...new Set([...FF.CATEGORIAS, ...S.reglas.map((r) => r.categoria), ...S.presupuestos.map((p) => p.categoria), ...(D ? D.txs.map((t) => t.tag).filter(Boolean) : []), 'otros'])].sort();
}
// Título de un movimiento: el comercio, y abajo la glosa del banco si es distinta.
export function txTitle(t) {
  const otra = mayus(t.comercio) !== mayus(t.description);
  return `<span class="text-break"><span class="fw-semibold">${esc(t.comercio)}</span>${otra ? `<span class="d-block small text-body-secondary">${esc(t.description)}</span>` : ''}</span>`;
}
export const cambioBadge = (c) => `<span class="badge text-bg-warning">${c.pct > 0 ? 'Subió' : 'Bajó'} ${Math.abs(c.pct)} %: antes ${fmt(c.prev)}</span>`;

// Recordatorios: pagos fijos de los próximos 7 días. Con datos de ejemplo se cuenta desde la fecha de los datos.
export function remindersCard() {
  const desde = S.sample || D.today > hoyReal() ? D.today : hoyReal();
  const prox = FF.nextCharges(D.proj.recurring, desde, 7);
  if (!prox.length) return '';
  const cuando = (n) => (n === 0 ? 'Hoy' : n === 1 ? 'Mañana' : `En ${n} días`);
  return `<div class="card h-100">
    <div class="card-header d-flex align-items-center gap-2"><span class="icon">${I.bell}</span>Próximos cobros</div>
    <ul class="list-group list-group-flush">${prox.map((c) => `<li class="list-group-item d-flex justify-content-between gap-3"><div><div class="fw-semibold">${esc(FF.titleCase(c.name))}</div><div class="small text-body-secondary">${cuando(c.inDays)} · ${FF.shortDate(c.date)}${c.change ? ' ' + cambioBadge(c.change) : ''}</div></div><span class="tx-amt fw-bold num text-nowrap">−${fmt(c.amount)}</span></li>`).join('')}</ul>
    <div class="card-footer small text-body-secondary">Salen de tus pagos fijos. Revisa que tengas saldo en esa cuenta.</div>
  </div>`;
}

// Presupuestos del mes en curso, con su barra.
export function budgetList(list, conQuitar) {
  const color = { ok: '', cerca: 'bg-warning', pasado: 'bg-danger' };
  const estado = (b) => (b.level === 'pasado' ? `<span class="badge text-bg-danger">Te pasaste por ${fmt(b.spent - b.monto)}</span>` : b.level === 'cerca' ? `<span class="badge text-bg-warning">Vas en el ${b.pct} %</span>` : `<span class="small text-body-secondary">${b.pct} %</span>`);
  return `<ul class="list-group list-group-flush">${list.map((b, i) => `<li class="list-group-item">
    <div class="d-flex justify-content-between align-items-center gap-2 small mb-1"><span><strong>${esc(cap(b.categoria))}</strong> ${estado(b)}</span><span class="d-flex align-items-center gap-2"><span class="num">${fmt(b.spent)} de ${fmt(b.monto)}</span>${conQuitar ? `<button class="btn btn-sm btn-outline-danger py-0" data-act="quitar-presupuesto" data-i="${i}" aria-label="Quitar presupuesto de ${esc(b.categoria)}">Quitar</button>` : ''}</span></div>
    <div class="progress" style="height:8px" role="progressbar" aria-label="${esc(b.categoria)}: ${b.pct} %" aria-valuenow="${Math.min(100, b.pct)}" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar ${color[b.level]}" style="width:${Math.min(100, b.pct)}%"></div></div>
  </li>`).join('') || '<li class="list-group-item small text-body-secondary">Aún no tienes presupuestos.</li>'}</ul>`;
}
export function budgetsCard() {
  if (!S.presupuestos.length) return '';
  const ym = FF.monthKey(D.today);
  const list = FF.budgetStatus(S.presupuestos, D.txs, ym).sort((a, b) => b.pct - a.pct);
  return `<div class="card h-100">
    <div class="card-header d-flex justify-content-between align-items-center"><span>Presupuestos de ${FF.monthName(ym)}</span><button class="btn btn-link btn-sm p-0" data-act="tab" data-tab="plan">Editar</button></div>
    ${budgetList(list, false)}
  </div>`;
}
