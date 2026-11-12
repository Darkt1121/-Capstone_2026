/* Pantalla Movimientos: lista, búsqueda y filtros. */
import { I, esc, signed, S, BADGE } from '../app/estado.js';
import { pageTitle } from '../app/marco.js';
import { D } from '../app/render.js';
import { FF } from '../logica/index.js';
import { tieneBoleta, txTitle } from './comunes.js';

export function txCounts() {
  const c = { todos: 0, negocio: 0, personal: 0, revisar: 0, internas: 0 };
  for (const t of D.txs) { c.todos++; if (t.internal) c.internas++; else { c[t.scope]++; if (t.review) c.revisar++; } }
  return c;
}
export function visibleTxs() {
  const q = S.query.trim().toUpperCase();
  return D.txs.filter((t) => {
    if (S.accFilter !== 'todas' && t.account !== S.accFilter) return false;
    if (S.filter === 'negocio' && (t.internal || t.scope !== 'negocio')) return false;
    if (S.filter === 'personal' && (t.internal || t.scope !== 'personal')) return false;
    if (S.filter === 'revisar' && (t.internal || !t.review)) return false;
    if (S.filter === 'internas' && !t.internal) return false;
    if (q && !t.description.toUpperCase().includes(q) && !t.comercio.toUpperCase().includes(q) && !String(Math.abs(t.amount)).includes(q.replace(/\D/g, '') || '§')) return false;
    return true;
  }).slice().reverse();
}
export function chipFor(t) {
  if (t.dup) return `<span class="badge ${BADGE.internal}">Repetido (no cuenta)</span>`;
  if (t.internal) return `<span class="badge ${BADGE.internal}">Entre tus cuentas</span>`;
  const label = { ingreso_negocio: 'Ingreso negocio', gasto_operacional: 'Gasto operacional', ingreso_personal: 'Ingreso personal', gasto_personal: 'Gasto personal' }[t.category];
  return `<span class="badge ${BADGE[t.scope]}">${label}</span>${t.review ? ` <span class="badge ${BADGE.review}">${t.dupOf ? '¿Repetido?' : '¿Correcto?'}</span>` : ''}`;
}
export function tabMovs() {
  const c = txCounts(); const list = visibleTxs();
  const F = [['todos', 'Todos'], ['negocio', 'Negocio'], ['personal', 'Personal'], ['revisar', 'Por revisar'], ['internas', 'Entre tus cuentas']];
  let html = ''; let cur = '';
  for (const t of list.slice(0, 160)) {
    if (t.date !== cur) { if (cur) html += '</div>'; cur = t.date; html += `<h2 class="h6 small text-uppercase text-body-secondary mt-4 mb-2">${FF.shortDate(t.date)}</h2><div class="list-group">`; }
    html += `<button class="list-group-item list-group-item-action ${t.internal ? 'is-internal' : ''}" data-act="open-tx" data-id="${esc(t.id)}">
      <span class="d-flex justify-content-between gap-3">${txTitle(t)}<span class="tx-amt fw-bold num text-nowrap ${t.amount > 0 ? 'pos' : ''}">${signed(t.amount)}</span></span>
      <span class="d-block small text-body-secondary mt-1">${chipFor(t)} ${tieneBoleta(t) ? `<span class="icon" title="Tiene boleta">${I.clip}</span>` : ''} ${esc(t.accountName)} · ${esc(t.internal ? t.internalReason || 'traspaso propio' : t.reason)}</span>
    </button>`;
  }
  if (cur) html += '</div>';
  return `
    ${pageTitle('Movimientos', 'Toca un movimiento para cambiarlo entre Negocio y Personal.', '<button class="btn btn-outline-primary btn-sm" data-act="add-account">Importar cartola</button>')}
    <div class="row g-2 mb-3">
      <div class="col-md"><input class="form-control" id="q" type="search" placeholder="Buscar por descripción o monto" aria-label="Buscar movimiento" value="${esc(S.query)}"></div>
      <div class="col-md-auto"><select class="form-select" id="accf" aria-label="Filtrar por cuenta"><option value="todas">Todas las cuentas</option>${S.accounts.map((a) => `<option value="${a.id}" ${S.accFilter === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
    </div>
    <div class="d-flex gap-2 overflow-auto pb-1" role="group" aria-label="Filtrar movimientos">${F.map(([id, l]) => `<button class="btn btn-sm text-nowrap ${S.filter === id ? 'btn-secondary' : 'btn-outline-secondary'}" data-act="filter" data-f="${id}" aria-pressed="${S.filter === id}">${l} <span class="badge bg-body-secondary text-body">${c[id]}</span></button>`).join('')}</div>
    ${html || '<p class="text-body-secondary py-4">No hay movimientos con este filtro.</p>'}`;
}
