/* Pantalla Reporte negocio vs. personal (se descarga en PDF con la impresión del navegador). */
import { fmt, esc, S } from '../app/estado.js';
import { PDF } from '../app/importar.js';
import { pageTitle } from '../app/marco.js';
import { D } from '../app/render.js';
import { FF } from '../logica/index.js';
import { cap, hoyReal } from './comunes.js';

// Reporte negocio vs. personal. "Descargar PDF" usa la impresión del navegador.
export function tabReporte() {
  const r = FF.businessReport(D.txs);
  const neg = (n) => (n < 0 ? '−' : '') + fmt(n);
  const fila = (x, label, fuerte) => `<tr class="${fuerte ? 'fw-semibold' : ''}"><td class="text-nowrap">${label}</td><td class="text-end num">${fmt(x.ingreso_negocio)}</td><td class="text-end num">${fmt(x.gasto_operacional)}</td><td class="text-end num ${x.utilidad < 0 ? 'text-danger' : ''}">${neg(x.utilidad)}</td><td class="text-end num">${fmt(x.ingreso_personal)}</td><td class="text-end num">${fmt(x.gasto_personal)}</td></tr>`;
  const maxTag = Math.max(1, ...r.businessByTag.map((t) => t.total));
  return `
    ${pageTitle('Reporte negocio vs. personal', `${esc(S.holder || '')} · ${r.rows.length} ${r.rows.length === 1 ? 'mes' : 'meses'} · datos hasta el ${FF.shortDate(D.today)}`, '<button class="btn btn-primary btn-sm no-print" data-act="imprimir">Descargar PDF</button>')}
    <div class="card mb-3"><div class="table-responsive"><table class="table table-sm mb-0 align-middle">
      <thead><tr><th>Mes</th><th class="text-end">Ingresos negocio</th><th class="text-end">Gastos negocio</th><th class="text-end">Resultado negocio</th><th class="text-end">Ingresos personales</th><th class="text-end">Gastos personales</th></tr></thead>
      <tbody>${r.rows.map((x) => fila(x, cap(FF.monthName(x.ym)) + ' ' + x.ym.slice(0, 4))).join('')}</tbody>
      <tfoot>${fila(r.total, 'Total', true)}</tfoot>
    </table></div></div>
    <div class="row g-3">
      <div class="col-lg-7"><div class="card">
        <div class="card-header">Gastos del negocio por categoría</div>
        <div class="card-body d-flex flex-column gap-3">${r.businessByTag.map((t) => `<div><div class="d-flex justify-content-between small mb-1"><span>${esc(cap(t.name))}</span><strong class="num">${fmt(t.total)}</strong></div><div class="progress" style="height:8px" aria-hidden="true"><div class="progress-bar" style="width:${((t.total / maxTag) * 100).toFixed(1)}%"></div></div></div>`).join('') || '<p class="small text-body-secondary mb-0">No hay gastos del negocio.</p>'}</div>
      </div></div>
      <div class="col-lg-5"><div class="card"><div class="card-body small text-body-secondary">
        <p>No incluye los traspasos entre tus cuentas ni los movimientos que marcaste como repetidos.</p>
        <p>Usa la clasificación de cada movimiento. Si algo está en el lado equivocado, corrígelo en Movimientos y el reporte se actualiza.</p>
        <p class="mb-0 no-print">"Descargar PDF" abre la ventana de impresión: elige "Guardar como PDF".</p>
      </div></div></div>
    </div>
    <p class="small text-body-secondary mt-3 d-none d-print-block">Generado con FinFlow el ${hoyReal().split('-').reverse().join('/')}.</p>`;
}
