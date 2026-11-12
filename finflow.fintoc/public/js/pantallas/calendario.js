/* Pantalla Calendario: cuánto gastaste cada día. */
import { I, fmt, esc, signed, kfmt, S } from '../app/estado.js';
import { pageTitle } from '../app/marco.js';
import { D } from '../app/render.js';
import { tieneBoleta, txTitle } from './comunes.js';
import { chipFor } from './movimientos.js';

// calendario: cuánto gastaste cada día
// Más intenso = más gasto ese día. No cuenta los traspasos entre tus cuentas.
export const nextMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; };
export const CAL_LEVEL = ['', 'bg-primary bg-opacity-25', 'bg-primary bg-opacity-50', 'bg-primary bg-opacity-75 text-white', 'bg-primary text-white'];
export function tabCal() {
  const ym = S.calMonth || FF.monthKey(D.today);
  const [y, m] = ym.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const blanks = (new Date(y, m - 1, 1).getDay() + 6) % 7; // la semana parte el lunes
  const spent = {}; let total = 0;
  for (const t of D.txs) { if (t.amount < 0 && !t.internal && FF.monthKey(t.date) === ym) { spent[t.date] = (spent[t.date] || 0) - t.amount; total -= t.amount; } }
  const max = Math.max(0, ...Object.values(spent));
  const top = Object.keys(spent).find((k) => spent[k] === max);
  let cells = '<div></div>'.repeat(blanks);
  for (let dd = 1; dd <= days; dd++) {
    const date = `${ym}-${String(dd).padStart(2, '0')}`; const g = spent[date] || 0;
    const lvl = max ? Math.ceil((g * 4) / max) : 0;
    cells += `<button class="btn cal-btn ${CAL_LEVEL[lvl]} ${date === D.today ? 'border-primary' : ''} ${date === S.calDay ? 'cal-sel' : ''}" data-act="cal-day" data-day="${date}" title="${dd} de ${FF.monthName(ym)}: ${fmt(g)} gastado"><span class="fw-semibold">${dd}</span>${g ? `<span class="cal-amt num d-none d-sm-block">${kfmt(g)}</span>` : ''}</button>`;
  }
  const sel = S.calDay && FF.monthKey(S.calDay) === ym ? S.calDay : null;
  const list = sel ? D.txs.filter((t) => t.date === sel) : [];
  return `
    ${pageTitle('Calendario', 'Cuánto gastaste cada día. Toca un día para ver sus movimientos.')}
    <div class="row g-3">
      <div class="col-lg-7"><div class="card"><div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <button class="btn btn-outline-secondary btn-sm" data-act="cal-month" data-ym="${FF.prevMonth(ym)}" aria-label="Mes anterior">&larr;</button>
          <strong class="text-capitalize">${FF.monthName(ym)} ${y}</strong>
          <button class="btn btn-outline-secondary btn-sm" data-act="cal-month" data-ym="${nextMonth(ym)}" aria-label="Mes siguiente">&rarr;</button>
        </div>
        <div class="cal-grid small text-body-secondary text-center mb-1">${['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'].map((n) => `<div>${n}</div>`).join('')}</div>
        <div class="cal-grid">${cells}</div>
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 small text-body-secondary mt-3">
          <span>${total ? `Gastado en ${FF.monthName(ym)}: <strong class="text-body num">${fmt(total)}</strong> · el día más caro fue el ${FF.shortDate(top)}` : 'Sin gastos este mes.'}</span>
          <span class="d-inline-flex align-items-center gap-1">Menos ${CAL_LEVEL.slice(1).map((c) => `<i class="cal-key ${c}"></i>`).join('')} Más</span>
        </div>
      </div></div></div>
      <div class="col-lg-5"><div class="card">
        <div class="card-header d-flex justify-content-between"><span>${sel ? FF.shortDate(sel) : 'Detalle del día'}</span>${sel && spent[sel] ? `<span class="num">Gastado: <strong>${fmt(spent[sel])}</strong></span>` : ''}</div>
        ${list.length ? `<div class="list-group list-group-flush">${list.map((t) => `<button class="list-group-item list-group-item-action ${t.internal ? 'is-internal' : ''}" data-act="open-tx" data-id="${esc(t.id)}">
          <span class="d-flex justify-content-between gap-3">${txTitle(t)}<span class="tx-amt fw-bold num text-nowrap ${t.amount > 0 ? 'pos' : ''}">${signed(t.amount)}</span></span>
          <span class="d-block small text-body-secondary mt-1">${chipFor(t)} ${tieneBoleta(t) ? `<span class="icon" title="Tiene boleta">${I.clip}</span>` : ''} ${esc(t.accountName)}</span></button>`).join('')}</div>`
          : `<div class="card-body text-body-secondary">${sel ? 'Sin movimientos este día.' : 'Toca un día del calendario para ver sus movimientos.'}</div>`}
      </div></div>
    </div>`;
}
