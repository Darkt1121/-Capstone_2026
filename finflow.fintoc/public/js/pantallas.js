/* Pantallas de la app: inicio, movimientos, proyección, plan, reporte, perfil, calendario y detalle; render(). */
'use strict';

function tabInicio() {
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

function txCounts() {
  const c = { todos: 0, negocio: 0, personal: 0, revisar: 0, internas: 0 };
  for (const t of D.txs) { c.todos++; if (t.internal) c.internas++; else { c[t.scope]++; if (t.review) c.revisar++; } }
  return c;
}
function visibleTxs() {
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
function chipFor(t) {
  if (t.dup) return `<span class="badge ${BADGE.internal}">Repetido (no cuenta)</span>`;
  if (t.internal) return `<span class="badge ${BADGE.internal}">Entre tus cuentas</span>`;
  const label = { ingreso_negocio: 'Ingreso negocio', gasto_operacional: 'Gasto operacional', ingreso_personal: 'Ingreso personal', gasto_personal: 'Gasto personal' }[t.category];
  return `<span class="badge ${BADGE[t.scope]}">${label}</span>${t.review ? ` <span class="badge ${BADGE.review}">${t.dupOf ? '¿Repetido?' : '¿Correcto?'}</span>` : ''}`;
}
function tabMovs() {
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

function tabProy() {
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

// Ayudas para las pantallas nuevas
const mayus = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
const hoyReal = () => { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); };
const tieneBoleta = (t) => S.boletas.some((b) => b.movimiento === t.id);
function categorias() {
  return [...new Set([...FF.CATEGORIAS, ...S.reglas.map((r) => r.categoria), ...S.presupuestos.map((p) => p.categoria), ...(D ? D.txs.map((t) => t.tag).filter(Boolean) : []), 'otros'])].sort();
}
// Título de un movimiento: el comercio, y abajo la glosa del banco si es distinta.
function txTitle(t) {
  const otra = mayus(t.comercio) !== mayus(t.description);
  return `<span class="text-break"><span class="fw-semibold">${esc(t.comercio)}</span>${otra ? `<span class="d-block small text-body-secondary">${esc(t.description)}</span>` : ''}</span>`;
}
const cambioBadge = (c) => `<span class="badge text-bg-warning">${c.pct > 0 ? 'Subió' : 'Bajó'} ${Math.abs(c.pct)} %: antes ${fmt(c.prev)}</span>`;

// Recordatorios: pagos fijos de los próximos 7 días. Con datos de ejemplo se cuenta desde la fecha de los datos.
function remindersCard() {
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
function budgetList(list, conQuitar) {
  const color = { ok: '', cerca: 'bg-warning', pasado: 'bg-danger' };
  const estado = (b) => (b.level === 'pasado' ? `<span class="badge text-bg-danger">Te pasaste por ${fmt(b.spent - b.monto)}</span>` : b.level === 'cerca' ? `<span class="badge text-bg-warning">Vas en el ${b.pct} %</span>` : `<span class="small text-body-secondary">${b.pct} %</span>`);
  return `<ul class="list-group list-group-flush">${list.map((b, i) => `<li class="list-group-item">
    <div class="d-flex justify-content-between align-items-center gap-2 small mb-1"><span><strong>${esc(cap(b.categoria))}</strong> ${estado(b)}</span><span class="d-flex align-items-center gap-2"><span class="num">${fmt(b.spent)} de ${fmt(b.monto)}</span>${conQuitar ? `<button class="btn btn-sm btn-outline-danger py-0" data-act="quitar-presupuesto" data-i="${i}" aria-label="Quitar presupuesto de ${esc(b.categoria)}">Quitar</button>` : ''}</span></div>
    <div class="progress" style="height:8px" role="progressbar" aria-label="${esc(b.categoria)}: ${b.pct} %" aria-valuenow="${Math.min(100, b.pct)}" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar ${color[b.level]}" style="width:${Math.min(100, b.pct)}%"></div></div>
  </li>`).join('') || '<li class="list-group-item small text-body-secondary">Aún no tienes presupuestos.</li>'}</ul>`;
}
function budgetsCard() {
  if (!S.presupuestos.length) return '';
  const ym = FF.monthKey(D.today);
  const list = FF.budgetStatus(S.presupuestos, D.txs, ym).sort((a, b) => b.pct - a.pct);
  return `<div class="card h-100">
    <div class="card-header d-flex justify-content-between align-items-center"><span>Presupuestos de ${FF.monthName(ym)}</span><button class="btn btn-link btn-sm p-0" data-act="tab" data-tab="plan">Editar</button></div>
    ${budgetList(list, false)}
  </div>`;
}

function tabPlan() {
  const d = D; const ym = FF.monthKey(d.today);
  const usanRegla = d.txs.filter((t) => t.source === 'regla').length;
  const etiqueta = { ok: ['text-bg-success', 'Llegas'], justo: ['text-bg-warning', 'Justo'], mal: ['text-bg-danger', 'No llegas'] };
  const barra = { ok: 'bg-success', justo: 'bg-warning', mal: 'bg-danger' };
  const metas = S.metas.map((m, i) => {
    const g = FF.goalStatus(m, d.txs, d.today, d.proj);
    return `<li class="list-group-item">
      <div class="d-flex justify-content-between align-items-start gap-2"><div><strong>${esc(m.nombre)}</strong><div class="small text-body-secondary num">${fmt(m.ahorrado)} de ${fmt(m.monto)} · para el ${m.fecha.split('-').reverse().join('/')}${m.aporte ? ` · aporte ${fmt(m.aporte)} al mes` : ''}</div></div>
        <div class="d-flex gap-1 flex-shrink-0">${m.aporte ? `<button class="btn btn-sm btn-outline-primary py-0 text-nowrap" data-act="aportar" data-i="${i}">Sumar aporte</button>` : ''}<button class="btn btn-sm btn-outline-danger py-0" data-act="quitar-meta" data-i="${i}" aria-label="Quitar meta ${esc(m.nombre)}">Quitar</button></div></div>
      <div class="progress my-2" style="height:8px" role="progressbar" aria-label="Avance de ${esc(m.nombre)}" aria-valuenow="${g.pct}" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar ${barra[g.state]}" style="width:${g.pct}%"></div></div>
      <div class="small"><span class="badge ${etiqueta[g.state][0]}">${etiqueta[g.state][1]}</span> ${esc(g.text)}</div>
    </li>`;
  }).join('');
  return `
    ${pageTitle('Plan', 'Presupuestos, metas de ahorro y tus propias reglas.')}
    <div class="row g-3">
      <div class="col-lg-6 d-flex flex-column gap-3">
        <div class="card">
          <div class="card-header">Presupuestos de ${FF.monthName(ym)}</div>
          ${budgetList(FF.budgetStatus(S.presupuestos, d.txs, ym), true)}
          <div class="card-body border-top">
            <form class="row g-2" data-form="presupuesto">
              <div class="col-sm-6"><label class="form-label small" for="pre-cat">Categoría</label><input class="form-control" id="pre-cat" list="cat-list" required maxlength="40" placeholder="Ej: comida"></div>
              <div class="col-sm"><label class="form-label small" for="pre-monto">Tope al mes</label><input class="form-control num" id="pre-monto" type="number" inputmode="numeric" min="1000" step="1000" required></div>
              <div class="col-sm-auto d-flex align-items-end"><button class="btn btn-primary w-100" type="submit">Agregar</button></div>
            </form>
            <div class="form-text">Te avisamos en Inicio cuando llegas al 80 % y al 100 %. Si la categoría ya tiene tope, se reemplaza.</div>
          </div>
        </div>
        <div class="card">
          <div class="card-header">Tus reglas</div>
          <ul class="list-group list-group-flush">${S.reglas.map((r, i) => `<li class="list-group-item d-flex justify-content-between align-items-center gap-2"><div class="small"><span class="text-body-secondary">Si dice</span> <strong>${esc(r.texto)}</strong> <span class="text-body-secondary">→</span> ${esc(cap(r.categoria))} <span class="badge ${BADGE[r.ambito]}">${r.ambito === 'negocio' ? 'Negocio' : 'Personal'}</span></div><button class="btn btn-sm btn-outline-danger py-0" data-act="quitar-regla" data-i="${i}" aria-label="Quitar regla ${esc(r.texto)}">Quitar</button></li>`).join('') || '<li class="list-group-item small text-body-secondary">Aún no tienes reglas. También se crean solas cuando cambias la categoría de un movimiento.</li>'}</ul>
          <div class="card-body border-top">
            <form class="row g-2" data-form="regla">
              <div class="col-sm-6"><label class="form-label small" for="regla-texto">Si la descripción dice</label><input class="form-control" id="regla-texto" required minlength="2" maxlength="60" placeholder="Ej: ferretería"></div>
              <div class="col-sm-6"><label class="form-label small" for="regla-cat">Categoría</label><input class="form-control" id="regla-cat" list="cat-list" required maxlength="40" placeholder="Ej: materiales"></div>
              <div class="col-sm"><label class="form-label small" for="regla-ambito">Ámbito</label><select class="form-select" id="regla-ambito"><option value="personal">Personal</option><option value="negocio">Negocio</option></select></div>
              <div class="col-sm-auto d-flex align-items-end"><button class="btn btn-primary w-100" type="submit">Agregar</button></div>
            </form>
            <div class="form-text">Se revisan antes que las reglas de FinFlow. Hoy ${usanRegla === 1 ? 'un movimiento usa' : usanRegla + ' movimientos usan'} tus reglas.</div>
          </div>
        </div>
      </div>
      <div class="col-lg-6 d-flex flex-column gap-3">
        <div class="card">
          <div class="card-header">Metas de ahorro</div>
          <ul class="list-group list-group-flush">${metas || '<li class="list-group-item small text-body-secondary">Aún no tienes metas.</li>'}</ul>
          <div class="card-body border-top">
            <form class="row g-2" data-form="meta">
              <div class="col-12"><label class="form-label small" for="meta-nombre">¿Para qué ahorras?</label><input class="form-control" id="meta-nombre" required maxlength="60" placeholder="Ej: Notebook nuevo"></div>
              <div class="col-sm-6"><label class="form-label small" for="meta-monto">Monto</label><input class="form-control num" id="meta-monto" type="number" inputmode="numeric" min="1000" step="1000" required></div>
              <div class="col-sm-6"><label class="form-label small" for="meta-fecha">Para cuándo</label><input class="form-control" id="meta-fecha" type="date" required min="${FF.addDays(d.today, 1)}"></div>
              <div class="col-sm-6"><label class="form-label small" for="meta-aporte">Cuánto guardarás al mes</label><input class="form-control num" id="meta-aporte" type="number" inputmode="numeric" min="0" step="1000" placeholder="Opcional"></div>
              <div class="col-sm-6"><label class="form-label small" for="meta-ahorrado">Cuánto llevas</label><input class="form-control num" id="meta-ahorrado" type="number" inputmode="numeric" min="0" step="1000" placeholder="0"></div>
              <div class="col-12"><button class="btn btn-primary" type="submit">Agregar meta</button></div>
            </form>
            <div class="form-text">Lo comparamos con lo que te sobra cada mes y con tu proyección de saldo.</div>
          </div>
        </div>
      </div>
    </div>
    <datalist id="cat-list">${categorias().map((c) => `<option value="${esc(c)}">`).join('')}</datalist>`;
}

// Reporte negocio vs. personal. "Descargar PDF" usa la impresión del navegador.
function tabReporte() {
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

// Boleta del movimiento: ver, quitar o adjuntar (PDF, JPG o PNG de hasta 2 MB).
function boletaBlock(t) {
  const b = S.boletas.find((x) => x.movimiento === t.id);
  const cuerpo = b
    ? `<div class="d-flex flex-wrap align-items-center gap-2"><a class="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1" href="/api/boletas/archivo?id=${encodeURIComponent(b.id)}" target="_blank" rel="noopener">${I.clip}Ver ${esc(b.nombre)}</a><button class="btn btn-sm btn-outline-danger" data-act="quitar-boleta" data-id="${esc(b.id)}">Quitar</button></div>`
    : S.user && !S.sample
      ? `<label class="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" for="boleta-file">${I.clip}Adjuntar boleta</label><input type="file" id="boleta-file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" hidden><div class="form-text">PDF, JPG o PNG de hasta 2 MB.</div>`
      : '<div class="form-text mt-0">Crea una cuenta para adjuntar boletas.</div>';
  return `<hr><div class="fw-semibold small mb-2">Boleta</div>${cuerpo}<div class="small mt-1" id="boleta-msg" role="status"></div>`;
}
function avisoBoleta(texto) { const m = document.getElementById('boleta-msg'); if (m) { m.textContent = texto; m.className = 'small mt-1 text-danger'; } }
async function subirBoleta(file) {
  if (file.size > 2 * 1024 * 1024) return avisoBoleta('La boleta debe pesar menos de 2 MB.');
  const m = document.getElementById('boleta-msg'); if (m) { m.textContent = 'Subiendo…'; m.className = 'small mt-1 text-body-secondary'; }
  try {
    const datos = await new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = () => mal(new Error('No pudimos leer el archivo.')); r.readAsDataURL(file); });
    const b = await api('/api/boletas', { method: 'POST', body: JSON.stringify({ movimiento: S.sheetId, nombre: file.name, datos }) });
    S.boletas = S.boletas.filter((x) => x.movimiento !== b.movimiento).concat(b); render();
  } catch (e) { avisoBoleta(e.message); }
}

function tabPerfil() {
  return `
    ${pageTitle('Perfil')}
    <div class="row g-3">
      <div class="col-lg-6 d-flex flex-column gap-3">
        <div class="card">
          <div class="card-header">Tu cuenta</div>
          <ul class="list-group list-group-flush">
            <li class="list-group-item"><div class="small text-body-secondary">Titular en tus cartolas</div><strong>${esc(S.holder)}</strong></li>
            <li class="list-group-item"><div class="small text-body-secondary">Acceso</div>${esc((S.user && S.user.email) || 'Sin cuenta (datos de ejemplo)')}</li>
          </ul>
        </div>
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center"><span>Cuentas</span><button class="btn btn-link btn-sm p-0" data-act="add-account" ${S.accounts.length >= 3 ? 'disabled' : ''}>Agregar cuenta</button></div>
          <ul class="list-group list-group-flush">${D.bals.map((b) => `<li class="list-group-item d-flex justify-content-between align-items-center gap-3"><div><strong>${esc(b.name)}</strong><div class="small text-body-secondary num">${fmt(b.balance)} · hasta el ${FF.shortDate(b.lastDate)}</div></div><button class="btn btn-outline-danger btn-sm" data-act="remove-acc" data-id="${b.id}" aria-label="Quitar ${esc(b.name)}">Quitar</button></li>`).join('')}</ul>
          <div class="card-body">
            ${(FINTOC.enabled && S.accounts.some((a) => a.source === 'fintoc')) ? `<button class="btn btn-outline-primary btn-sm mb-2" data-act="fintoc-sync" ${FINTOC.busy ? 'disabled' : ''}>${FINTOC.busy ? 'Actualizando…' : 'Actualizar desde el banco'}</button>${FINTOC.msg ? `<p class="small text-body-secondary" role="status">${esc(FINTOC.msg)}</p>` : ''}` : ''}
            <div class="form-text mt-0">Hasta 3 cuentas. Al volver a subir una cartola, los movimientos repetidos se ignoran.</div>
          </div>
        </div>
      </div>
      <div class="col-lg-6 d-flex flex-column gap-3">
        <div class="card"><div class="card-body">
          <h2 class="h6">Tus datos</h2>
          <p class="small text-body-secondary">Puedes llevarte todos tus movimientos clasificados o borrar tu cuenta con todo lo que contiene. ${S.user && S.consentDate ? 'Aceptaste la <a href="#" data-act="politica">política de privacidad</a> el ' + esc(S.consentDate) + '.' : '<a href="#" data-act="politica">Política de privacidad</a>'}</p>
          <div class="d-flex flex-wrap gap-2"><button class="btn btn-outline-secondary btn-sm" data-act="tab" data-tab="reporte">Reporte negocio vs. personal</button><button class="btn btn-outline-secondary btn-sm" data-act="export">Exportar mis datos (CSV)</button><button class="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-1" data-act="ask-delete">${I.trash}Borrar mi cuenta y mis datos</button></div>
          ${S.exportOpen ? `<textarea class="form-control font-monospace small mt-3" id="csv" rows="8" readonly aria-label="Tus datos en CSV">${esc(FF.toCSV(D.txs))}</textarea><div class="d-flex align-items-center gap-2 mt-2"><button class="btn btn-secondary btn-sm" data-act="copy-csv">Copiar CSV</button><span class="small text-body-secondary" id="copy-msg"></span></div>` : ''}
          ${S.confirmDelete ? `<div class="alert alert-danger mt-3 mb-0"><strong>¿Borrar todo?</strong><p class="mb-2">Se eliminan tu cuenta, tus cartolas, tus correcciones y tus alertas. No se puede deshacer.</p><div class="d-flex flex-wrap gap-2"><button class="btn btn-danger btn-sm" data-act="do-delete">Sí, borrar todo</button><button class="btn btn-outline-secondary btn-sm" data-act="cancel-delete">Cancelar</button></div></div>` : ''}
        </div></div>
        <div><button class="btn btn-outline-secondary btn-sm" data-act="logout">Cerrar sesión</button></div>
      </div>
    </div>`;
}

// calendario: cuánto gastaste cada día
// Más intenso = más gasto ese día. No cuenta los traspasos entre tus cuentas.
const nextMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`; };
const CAL_LEVEL = ['', 'bg-primary bg-opacity-25', 'bg-primary bg-opacity-50', 'bg-primary bg-opacity-75 text-white', 'bg-primary text-white'];
function tabCal() {
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

// Ventana para corregir un movimiento
function sheet() {
  const t = D.txs.find((x) => x.id === S.sheetId); if (!t) return '';
  const key = FF.counterpartyKey(t.description);
  return `<div class="modal-backdrop show"></div>
  <div class="modal d-block scrim" tabindex="-1" data-act="close-sheet"><div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
    <div class="modal-content sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" data-stop>
      <div class="modal-header"><h2 class="modal-title h6 text-break" id="sheet-title">${esc(t.description)}</h2><button type="button" class="btn-close" data-act="close-sheet" aria-label="Cerrar"></button></div>
      <div class="modal-body">
        <div class="d-flex justify-content-between align-items-center mb-3"><span class="small text-body-secondary">${FF.shortDate(t.date)} · ${esc(t.accountName)}</span><strong class="fs-5 num">${signed(t.amount)}</strong></div>
        ${t.dupOf ? `<div class="alert alert-warning small"><strong>¿Está repetido?</strong> Hay un movimiento igual en ${esc(t.dupName)} el ${FF.shortDate(t.dupDate)}. Pasa cuando la misma cuenta entra dos veces, por ejemplo por cartola y conectando el banco.
          <div class="d-flex flex-wrap gap-2 mt-2"><button class="btn btn-sm btn-warning" data-act="dup" data-v="juntar">Es el mismo: contarlo una vez</button><button class="btn btn-sm btn-outline-secondary" data-act="dup" data-v="mantener">Son distintos</button></div></div>` : ''}
        ${t.dup ? `<div class="alert alert-secondary small">Lo juntaste con el de ${esc(t.dupName)}, así que no cuenta. <button class="btn btn-link btn-sm p-0 align-baseline" data-act="dup" data-v="">Deshacer</button></div>` : ''}
        <div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="is-internal" ${t.internal ? 'checked' : ''}><label class="form-check-label" for="is-internal">Es un traspaso entre mis cuentas (no cuenta como ingreso ni gasto)</label></div>
        <div id="scope-block" style="${t.internal ? 'opacity:.4' : ''}">
          <div class="form-label">¿De qué es este movimiento?</div>
          <div class="row g-2 mb-2" role="group" aria-label="Ámbito">
            <div class="col-6"><button class="btn btn-outline-primary w-100 ${t.scope === 'negocio' ? 'active' : ''}" data-act="pick-scope" data-scope="negocio" aria-pressed="${t.scope === 'negocio'}">Negocio</button></div>
            <div class="col-6"><button class="btn btn-outline-primary w-100 ${t.scope === 'personal' ? 'active' : ''}" data-act="pick-scope" data-scope="personal" aria-pressed="${t.scope === 'personal'}">Personal</button></div>
          </div>
          <div class="form-text mb-3">Motivo actual: ${esc(t.reason)}</div>
          <div class="mb-3"><label class="form-label" for="tx-cat">Categoría</label>
            <input class="form-control" id="tx-cat" list="cat-list-tx" maxlength="40" value="${esc(t.tag || '')}" placeholder="Ej: supermercado">
            <datalist id="cat-list-tx">${categorias().map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
            <div class="form-text">Comercio: <strong>${esc(t.comercio)}</strong>. Si cambias la categoría, se crea una regla: todo lo que diga "${esc(FF.merchant(t.description).key)}" irá a esa categoría.</div></div>
        </div>
        <div class="form-check mt-3"><input class="form-check-input" type="checkbox" id="apply-all" checked><label class="form-check-label" for="apply-all">Aplicar también a los otros movimientos de ${esc(t.comercio || FF.titleCase(key) || 'esta contraparte')}</label>
          <div class="form-text mt-0">Si la desmarcas, el cambio queda solo en este movimiento.</div></div>
        ${boletaBlock(t)}
      </div>
      <div class="modal-footer"><button class="btn btn-outline-secondary" data-act="close-sheet">Cancelar</button><button class="btn btn-primary" data-act="save-tx">Guardar</button></div>
    </div>
  </div></div>`;
}


// render
let pickedScope = null;
function render() {
  D = S.accounts.length ? derive(S) : null;
  if (S.view === 'app' && !D) S.view = 'onboard';
  const html = { landing: viewLanding, auth: viewAuth, onboard: viewOnboard, app: viewApp }[S.view]();
  $root.innerHTML = html;
  save();
  afterRender();
  if (animateNext) countUp();
  animateNext = false;
}
function afterRender() {
  googleButton();
  // Los avisos aparecen a la izquierda del chat cuando el chat está abierto al lado.
  const avisos = document.getElementById('toasts');
  if (avisos) { if (S.view === 'app' && S.chatOpen && window.innerWidth >= 1200) avisos.style.setProperty('right', '360px', 'important'); else avisos.style.removeProperty('right'); }
  setTimeout(revisarNotificaciones, 0);
  const chat = document.getElementById('chat-msgs'); if (chat) chat.scrollTop = chat.scrollHeight;
  const qr = document.getElementById('qr');
  if (qr && window.QRCode) { try { new window.QRCode(qr, { text: SHARE_URL, width: 96, height: 96, colorDark: '#0c1214', colorLight: '#ffffff' }); } catch (e) { qr.textContent = 'QR'; } }
  const dz = document.getElementById('dropzone');
  if (dz) {
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('over'));
    dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('over'); if (e.dataTransfer.files[0]) importFile(e.dataTransfer.files[0]); });
  }
}
const go = (patch) => { Object.assign(S, patch); animateNext = true; render(); window.scrollTo(0, 0); };
