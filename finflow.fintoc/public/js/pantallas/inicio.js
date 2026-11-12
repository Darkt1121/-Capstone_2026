/* Pantalla Inicio (el panel). */
import { fmt, esc, S, BADGE } from '../app/estado.js';
import { pageTitle, firstName } from '../app/marco.js';
import { D } from '../app/render.js';
import { dailyPlan, gastosPorCategoria, serieSaldo, gastoAcumulado, lineChart, donut } from '../graficos/panel.js';
import { chart, phrase } from '../graficos/proyeccion.js';
import { FF } from '../logica/index.js';
import { cap, remindersCard, budgetsCard } from './comunes.js';

export function tabInicio() {
  const d = D; const p = d.proj; const a = p.alert; const m = d.month;
  const plan = dailyPlan(d);
  const planRow = (label, value, strong) => `<tr><td class="${strong ? 'fw-semibold' : 'text-body-secondary'}">${label}</td><td class="text-end num ${strong ? 'fw-semibold' : ''}">${value}</td></tr>`;
  const tot = m.ingreso_negocio + m.gasto_operacional + m.ingreso_personal + m.gasto_personal || 1;
  const pct = (v) => ((v / tot) * 100).toFixed(1);
  const dias = S.periodo || 90; const desde = FF.addDays(d.today, -(dias - 1)); const hasta = d.today;
  const nombrePeriodo = { 30: 'últimos 30 días', 90: 'últimos 90 días', 180: 'últimos 6 meses' }[dias];
  const fechaCorta = (i) => FF.shortDate(FF.addDays(desde, i));

  // Saldo total
  const saldo = serieSaldo(S.accounts, desde, hasta);
  const cambio = saldo[saldo.length - 1] - saldo[0];
  const cambioPct = Math.abs(saldo[0]) >= 50000 ? Math.round((cambio / Math.abs(saldo[0])) * 100) : null;

  // Gastos del período y lo que entró (sin traspasos entre tus cuentas)
  const gastos = gastosPorCategoria(d.txs, desde, hasta);
  const totalGasto = gastos.reduce((s, x) => s + x.total, 0);
  const totalIngreso = d.txs.filter((t) => !t.internal && t.amount > 0 && t.date >= desde && t.date <= hasta).reduce((s, t) => s + t.amount, 0);
  const neto = totalIngreso - totalGasto;

  // Gasto del mes contra el mes anterior, a la misma fecha
  const ymHoy = FF.monthKey(d.today); const ymAntes = FF.prevMonth(ymHoy); const diaHoy = Number(d.today.slice(8, 10));
  const acum = gastoAcumulado(d.txs, ymHoy, diaHoy); const acumAntes = gastoAcumulado(d.txs, ymAntes);
  const gastoHoy = acum[diaHoy - 1] || 0; const antesMismaFecha = acumAntes[Math.min(diaHoy, acumAntes.length) - 1] || 0;
  const dif = gastoHoy - antesMismaFecha; const n = Math.max(acum.length, acumAntes.length);
  const mesCap = (ym) => cap(FF.monthName(ym));

  return `
    ${pageTitle(`Hola, ${esc(firstName())}`, 'Esto es lo que está pasando con tu plata.', `<div class="d-flex align-items-center gap-2"><span class="small text-body-secondary d-none d-sm-inline">Datos al ${FF.shortDate(d.today)}${S.sample ? ' · ejemplo ficticio' : ''}</span>
      <select class="form-select form-select-sm w-auto" id="periodo" aria-label="Período de los gráficos">${[[30, '30 días'], [90, '90 días'], [180, '6 meses']].map(([v, l]) => `<option value="${v}" ${dias === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`)}
    <div class="row g-3">
      <div class="col-lg-6"><div class="card h-100"><div class="card-body">
        <div class="small text-body-secondary">Para las próximas 4 semanas</div>
        ${plan.free > 0 ? `<div class="fs-3 fw-bold">Puedes gastar <span class="num text-primary" data-count="${plan.perDay}">${fmt(plan.perDay)}</span> por día</div>` : '<div class="fs-4 fw-bold">Hoy no te queda margen para gastos extra</div>'}
        <table class="table table-sm small mt-2 mb-2"><tbody>
          ${planRow('Saldo de hoy', fmt(d.total))}
          ${planRow('Ingresos fijos que vienen', '+' + fmt(plan.income))}
          ${planRow('Pagos fijos que vienen', '−' + fmt(plan.fixed))}
          ${planRow('Tu mínimo', '−' + fmt(p.minimum))}
          ${planRow(plan.free > 0 ? 'Libre para 28 días' : 'Te falta', fmt(plan.free), true)}
        </tbody></table>
        <div class="form-text mt-0">Tu gasto personal promedio es ${fmt(p.dailyPersonal)} al día.</div>
      </div></div></div>

      <div class="col-lg-6"><div class="card h-100"><div class="card-body">
        <div class="small text-body-secondary">${d.bals.length === 1 ? 'Saldo en tu cuenta' : `Saldo en tus ${d.bals.length} cuentas`}</div>
        <div class="fs-2 fw-bold num" data-count="${d.total}">${fmt(d.total)}</div>
        <div class="small mb-2"><span class="num ${cambio >= 0 ? 'text-success' : 'text-danger'}">${cambio >= 0 ? '▲ +' : '▼ −'}${fmt(cambio)}${cambioPct === null ? '' : ` (${cambio >= 0 ? '+' : '−'}${Math.abs(cambioPct)} %)`}</span> <span class="text-body-secondary">en los ${nombrePeriodo}</span></div>
        ${lineChart({ series: [{ name: 'Saldo total', color: 'var(--s1)', vals: saldo }], n: saldo.length, xLabel: fechaCorta, zero: false, area: true, h: 170, aria: `Saldo total en los ${nombrePeriodo}: de ${fmt(saldo[0])} a ${fmt(saldo[saldo.length - 1])}` })}
        <div class="d-flex flex-wrap gap-2 mt-2">${d.bals.map((b) => `<span class="badge bg-body-secondary text-body border fw-normal num">${esc(b.name)} · ${fmt(b.balance)}</span>`).join('')}</div>
      </div></div></div>

      <div class="col-lg-6"><div class="card h-100">
        <div class="card-header">Gastos por categoría · ${nombrePeriodo}</div>
        <div class="card-body">
          <div class="d-flex flex-wrap justify-content-between gap-2 small mb-3 num">
            <span>Entró <strong>${fmt(totalIngreso)}</strong></span><span>Salió <strong>${fmt(totalGasto)}</strong></span>
            <span>${neto >= 0 ? 'Te sobró' : 'Gastaste de más'} <strong class="${neto >= 0 ? 'text-success' : 'text-danger'}">${neto >= 0 ? '+' : '−'}${fmt(neto)}</strong></span>
          </div>${totalGasto ? `${donut(gastos, totalGasto)}
          <table class="table table-sm small mb-0 mt-3"><thead><tr><th>Categoría</th><th class="text-end">Monto</th><th class="text-end">Peso</th></tr></thead><tbody>
            ${gastos.map((g) => `<tr><td><span class="d-inline-flex align-items-center gap-2"><span class="dot-cat" style="background:${g.color}"></span>${esc(g.name)}</span></td><td class="text-end num">${fmt(g.total)}</td><td class="text-end num">${Math.round((g.total / totalGasto) * 100)} %</td></tr>`).join('')}
          </tbody></table>` : '<p class="small text-body-secondary mb-0">No hay gastos en este período.</p>'}</div>
      </div></div>

      <div class="col-lg-6"><div class="card h-100">
        <div class="card-header">Gasto de ${FF.monthName(ymHoy)}</div>
        <div class="card-body">
          <div class="d-flex flex-wrap gap-4 mb-2">
            <div><div class="small d-flex align-items-center gap-2"><span class="dot-cat" style="background:var(--s1)"></span>${mesCap(ymHoy)} al ${diaHoy}</div><div class="fs-5 fw-bold num">${fmt(gastoHoy)}</div></div>
            <div><div class="small text-body-secondary d-flex align-items-center gap-2"><span class="dot-cat" style="background:var(--s-otros)"></span>${mesCap(ymAntes)} a la misma fecha</div><div class="fs-5 fw-bold num text-body-secondary">${fmt(antesMismaFecha)}</div></div>
          </div>
          <p class="small mb-2">${antesMismaFecha ? `Vas ${fmt(Math.abs(dif))} ${dif > 0 ? 'por encima' : 'por debajo'} de ${FF.monthName(ymAntes)} a esta fecha.` : `Sin datos de ${FF.monthName(ymAntes)} para comparar.`}
          ${lineChart({ series: [{ name: mesCap(ymHoy), color: 'var(--s1)', vals: acum.concat(new Array(n - acum.length).fill(null)) }, { name: mesCap(ymAntes), color: 'var(--s-otros)', dash: true, vals: acumAntes.concat(new Array(n - acumAntes.length).fill(null)) }], n, xLabel: (i, largo) => (largo ? `Día ${i + 1}` : String(i + 1)), zero: true, h: 190, aria: `Gasto acumulado: ${FF.monthName(ymHoy)} ${fmt(gastoHoy)} al día ${diaHoy}; ${FF.monthName(ymAntes)} ${fmt(antesMismaFecha)} a la misma fecha` })}
        </div>
      </div></div>

      ${remindersCard() ? `<div class="col-lg-6">${remindersCard()}</div>` : ''}
      ${budgetsCard() ? `<div class="col-lg-6">${budgetsCard()}</div>` : ''}

      <div class="col-lg-6"><div class="card h-100">
        <div class="card-header d-flex justify-content-between align-items-center"><span>${FF.monthName(d.ym)} · negocio vs. personal</span><button class="btn btn-link btn-sm p-0" data-act="tab" data-tab="reporte">Ver reporte</button></div>
        <div class="card-body">
          <div class="row g-2 mb-3">
            <div class="col-6"><div class="border rounded p-2 h-100"><span class="badge ${BADGE.negocio}">Negocio</span><div class="fs-5 fw-bold num mt-1">${fmt(m.utilidad)}</div><div class="small text-body-secondary num">+${fmt(m.ingreso_negocio)} · −${fmt(m.gasto_operacional)}</div></div></div>
            <div class="col-6"><div class="border rounded p-2 h-100"><span class="badge ${BADGE.personal}">Personal</span><div class="fs-5 fw-bold num mt-1">−${fmt(m.gasto_personal)}</div><div class="small text-body-secondary num">Ingresos ${fmt(m.ingreso_personal)}</div></div></div>
          </div>
          <div class="progress-stacked" aria-hidden="true">
            <div class="progress" style="width:${pct(m.ingreso_negocio)}%"><div class="progress-bar"></div></div>
            <div class="progress" style="width:${pct(m.gasto_operacional)}%"><div class="progress-bar bg-primary bg-opacity-50"></div></div>
            <div class="progress" style="width:${pct(m.ingreso_personal)}%"><div class="progress-bar bg-secondary bg-opacity-50"></div></div>
            <div class="progress" style="width:${pct(m.gasto_personal)}%"><div class="progress-bar bg-secondary"></div></div>
          </div>
          ${m.internalCount ? `<p class="small text-body-secondary mt-3 mb-0"><span class="badge ${BADGE.internal}">Entre tus cuentas</span> ${fmt(m.internal)} en ${m.internalCount} ${m.internalCount === 1 ? 'traspaso' : 'traspasos'}. No cuentan como ingreso ni gasto.</p>` : ''}
        </div>
      </div></div>

      <div class="col-lg-6"><div class="card h-100">
        <div class="card-header d-flex justify-content-between align-items-center"><span>Proyección · 4 semanas</span><button class="btn btn-link btn-sm p-0" data-act="tab" data-tab="proyeccion">Ver detalle</button></div>
        <div class="card-body">
          <div class="chart-wrap">${chart(d, { w: 760, h: 200, compact: true })}</div>
          <p class="small text-body-secondary mt-2 mb-0">${esc(phrase(p))}${p.enough ? ` En 4 semanas, rango probable: ${fmt(p.points[3].p10)} a ${fmt(p.points[3].p90)}.` : ''}</p>
        </div>
      </div></div>
    </div>`;
}
