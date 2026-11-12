/* Pantalla Proyección: saldo a 4 semanas, pagos fijos y tu mínimo. */
import { fmt, esc, signed, S, BADGE } from '../app/estado.js';
import { pageTitle } from '../app/marco.js';
import { D } from '../app/render.js';
import { chart, phrase } from '../graficos/proyeccion.js';
import { cambioBadge } from './comunes.js';

export function tabProy() {
  const d = D; const p = d.proj;
  return `
    ${pageTitle('Proyección', `Próximas 4 semanas, desde el ${FF.shortDate(d.today)}.`)}
    <div class="card mb-3"><div class="card-body">
      <div class="chart-wrap">${chart(d, { w: 760, h: 300 })}</div>
      <div class="form-text">Pasa el cursor o toca una semana para ver el detalle. Arrastra la línea roja para cambiar tu mínimo.</div>
      <div class="legend d-flex flex-wrap gap-3 small text-body-secondary my-3">
        <span class="d-inline-flex align-items-center gap-1"><i style="background:var(--accent)"></i>Saldo más probable</span>
        <span class="d-inline-flex align-items-center gap-1"><i style="background:var(--accent);opacity:.35;height:10px"></i>Rango probable (8 de cada 10 escenarios)</span>
        <span class="d-inline-flex align-items-center gap-1"><i style="background:var(--danger)"></i>Tu mínimo</span>
      </div>
      <p class="fw-semibold mb-1">${esc(phrase(p))}</p>
      ${p.alert ? `<p class="text-body-secondary mb-0">Ese saldo te alcanza para ${p.alert.daysCovered} días de gastos personales (gastas en promedio ${fmt(p.dailyPersonal)} al día).</p>` : ''}
    </div></div>
    <div class="row g-3">
      <div class="col-lg-7"><div class="card">
        <div class="card-header">Lo que viene</div>
        <ul class="list-group list-group-flush">${p.upcoming.map((u) => `<li class="list-group-item d-flex justify-content-between gap-3"><div><div class="fw-semibold">${esc(FF.titleCase(u.name))}</div><div class="small text-body-secondary">${FF.shortDate(u.date)} · semana ${u.week} · <span class="badge ${BADGE[u.scope]}">${u.scope === 'negocio' ? 'Negocio' : 'Personal'}</span>${u.change ? ' ' + cambioBadge(u.change) : ''}</div></div><span class="tx-amt fw-bold num text-nowrap ${u.amount > 0 ? 'pos' : ''}">${signed(u.amount)}</span></li>`).join('') || '<li class="list-group-item text-body-secondary">Aún no detectamos movimientos fijos.</li>'}</ul>
        <div class="card-footer small text-body-secondary">Movimientos que se repiten cada mes, detectados en tu historia.</div>
      </div></div>
      <div class="col-lg-5 d-flex flex-column gap-3">
        <div class="card"><div class="card-body">
          <h2 class="h6">Tu mínimo</h2>
          <label class="form-label small" for="minimum">Monto mínimo (CLP)</label>
          <div class="input-group"><span class="input-group-text">$</span><input class="form-control num" id="minimum" type="number" inputmode="numeric" min="0" step="10000" value="${S.minimum}"></div>
          <div class="form-text">Te avisamos una sola vez, unos 7 días antes de bajar de este monto.</div>
        </div></div>
        <div class="card"><div class="card-body">
          <h2 class="h6">Cómo se calcula</h2>
          <ol class="small text-body-secondary ps-3 mb-2">
            <li>Detectamos tus movimientos fijos (${p.recurring.length} encontrados) y los ubicamos en su fecha.</li>
            <li>El resto de tus ingresos y gastos se proyecta por semana con suavizado exponencial (nivel y tendencia).</li>
            <li>Repetimos el cálculo en 200 escenarios con la variación real de tu historia. La banda muestra el rango donde cae la mayoría.</li>
          </ol>
        </div></div>
      </div>
    </div>`;
}
