/* Estructura de la app: menú de íconos, barra de arriba y el chat "Pregúntale a FinFlow". */
'use strict';

// app
const TABS = [['inicio', 'Inicio', I.home], ['movimientos', 'Movimientos', I.list], ['proyeccion', 'Proyección', I.chart], ['plan', 'Plan', I.target], ['calendario', 'Calendario', I.cal], ['perfil', 'Perfil', I.user]];
const navButtons = (cls) => TABS.map(([id, label, icon]) => `<button class="nav-link d-flex align-items-center ${cls} ${S.tab === id ? 'active' : ''}" data-act="tab" data-tab="${id}" ${S.tab === id ? 'aria-current="page"' : ''}>${icon}<span>${label}</span></button>`).join('');
const pageTitle = (title, sub, right) => `<div class="d-flex flex-wrap justify-content-between align-items-end gap-2 border-bottom pb-3 mb-4"><div><h1 class="h2 mb-0">${title}</h1>${sub ? `<p class="small text-body-secondary mb-0">${sub}</p>` : ''}</div>${right || ''}</div>`;

function viewApp() {
  if (S.chatOpen === null) S.chatOpen = window.innerWidth >= 1200;
  const body = { inicio: tabInicio, movimientos: tabMovs, proyeccion: tabProy, plan: tabPlan, reporte: tabReporte, calendario: tabCal, perfil: tabPerfil }[S.tab]();
  const titulo = { inicio: 'Panel', movimientos: 'Movimientos', proyeccion: 'Proyección', plan: 'Plan', reporte: 'Reporte', calendario: 'Calendario', perfil: 'Perfil' }[S.tab];
  const nombre = (S.user && S.user.name) || S.holder || '';
  const iniciales = nombre.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || 'FF';
  return `
    <div class="d-flex">
      <nav class="rail d-none d-lg-flex flex-column align-items-center gap-1 py-3 border-end bg-body-tertiary" aria-label="Navegación principal">
        <div class="mb-3"><span class="brand-mark" title="FinFlow">${I.logo}</span></div>
        ${navButtons('flex-column')}
        <span class="avatar mt-auto mb-5" title="${esc(nombre)}">${esc(iniciales)}</span>
      </nav>
      <div class="flex-grow-1 app-col">
        <header class="app-top d-flex align-items-center gap-2 px-3 px-lg-4 border-bottom">
          <span class="d-lg-none">${brand()}</span>
          <nav class="d-none d-lg-block small" aria-label="Estás en"><ol class="breadcrumb mb-0">
            <li class="breadcrumb-item"><button class="btn btn-link btn-sm p-0 align-baseline" data-act="tab" data-tab="inicio">Inicio</button></li>
            <li class="breadcrumb-item active" aria-current="page">${titulo}</li>
          </ol></nav>
          ${S.sample ? '<span class="badge text-bg-secondary">Ejemplo</span><button class="btn btn-sm btn-primary" data-act="go-auth">Crear cuenta</button><button class="btn btn-sm btn-link text-body-secondary px-1" data-act="salir-ejemplo">Salir</button>' : ''}
          ${notifBoton()}
          <button class="btn btn-sm ${S.chatOpen ? 'btn-secondary' : 'btn-outline-secondary'} d-inline-flex align-items-center gap-1" data-act="chat" aria-expanded="${S.chatOpen}" aria-controls="chat">${I.chat}<span class="d-none d-sm-inline">Pregúntale a FinFlow</span></button>
        </header>
        <main class="px-3 px-lg-4 py-4 app-main"><div class="mx-auto" style="max-width:1200px">${body}</div></main>
      </div>
      ${chatPanel()}
    </div>
    <nav class="navbar fixed-bottom bg-body border-top d-lg-none p-0 bottom-nav" aria-label="Navegación principal"><div class="nav nav-fill w-100">${navButtons('flex-column')}</div></nav>
    ${S.sheetId ? sheet() : ''}`;
}

function firstName() { return (S.holder || (S.user && S.user.name) || '').split(' ')[0] || 'hola'; }

// Asistente "Pregúntale a FinFlow"
const AI = { enabled: false, busy: false, msgs: [], error: '' };
// Lo que recibe el asistente: solo totales ya calculados. Los pagos fijos llevan nombre solo si son
// comercios conocidos (Netflix, Enel...); el resto va sin nombre para no mandar personas.
function aiSummary() {
  const d = D; const p = d.proj;
  const tagOf = {}; for (const t of d.txs) if (t.tag) tagOf[FF.counterpartyKey(t.description)] = t.tag;
  const month = (ym) => {
    const s = FF.monthSummary(d.txs, ym);
    return { mes: FF.monthName(ym), ingresos_negocio: s.ingreso_negocio, gastos_negocio: s.gasto_operacional, utilidad_negocio: s.utilidad, ingresos_personales: s.ingreso_personal, gastos_personales: s.gasto_personal, gastos_por_categoria: spendByTag(d.txs, ym).map((t) => ({ categoria: t.name, total: t.total })) };
  };
  return {
    fecha_de_los_datos: d.today,
    saldo_total: d.total,
    cuentas: d.bals.map((b) => ({ cuenta: b.name, saldo: b.balance })),
    minimo_que_quiere_mantener: p.minimum,
    puede_gastar_por_dia: dailyPlan(d).perDay,
    gasto_personal_promedio_por_dia: p.dailyPersonal,
    mes_en_curso: month(FF.monthKey(d.today)),
    meses_anteriores: [month(d.ym), month(FF.prevMonth(d.ym))],
    fijos_proximas_4_semanas: p.upcoming.map((u) => ({ fecha: u.date, que: tagOf[FF.counterpartyKey(u.name)] ? FF.titleCase(u.name) : (u.amount > 0 ? 'ingreso fijo de un cliente' : 'pago fijo'), monto: u.amount })),
    proyeccion_4_semanas: p.points.map((q) => ({ semana: q.week, desde: q.start, hasta: q.end, saldo_probable: Math.round(q.p50), rango: [Math.round(q.p10), Math.round(q.p90)] })),
    alerta: p.alert ? `podría bajar del mínimo la semana del ${FF.shortDate(p.alert.start)}, llegando a ${fmt(p.alert.amount)}` : 'sin alerta',
    presupuestos_del_mes: FF.budgetStatus(S.presupuestos, d.txs, FF.monthKey(d.today)).map((b) => ({ categoria: b.categoria, tope: b.monto, gastado: b.spent, porcentaje: b.pct })),
    metas_de_ahorro: S.metas.map((m, i) => { const g = FF.goalStatus(m, d.txs, d.today, p); return { meta: 'meta ' + (i + 1), monto: m.monto, fecha: m.fecha, ahorrado: m.ahorrado, necesita_al_mes: g.needed, evaluacion: g.text }; }),
  };
}
// Texto de la respuesta: se escapa todo y solo se permiten **negritas** y saltos de línea.
function formatoIA(texto) {
  return esc(texto).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').split(/\n{2,}/).map((p) => `<p class="mb-2">${p.replace(/\n/g, '<br>')}</p>`).join('');
}
function chatPanel() {
  const ideas = ['¿Cuánto gasté en supermercado el mes pasado?', '¿Me alcanza para pagar el arriendo?', '¿Cómo voy con mis presupuestos?', '¿Llego a mi meta de ahorro?'];
  const inicio = AI.enabled
    ? `<div class="d-flex gap-2"><span class="chat-logo">${I.logo}</span><div class="chat-ia small"><p class="mb-2">Hola, ${esc(firstName())}. Pregúntame lo que quieras sobre tus números.</p>
        <div class="d-flex flex-column align-items-start gap-1">${ideas.map((q) => `<button class="btn btn-sm btn-outline-secondary text-start" data-act="ask-idea" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div></div></div>`
    : '<p class="small text-body-secondary mb-0">El asistente no está configurado en este servidor.</p>';
  const msgs = AI.msgs.map((m) => (m.rol === 'usuario'
    ? `<div class="chat-yo px-3 py-2 small">${esc(m.texto)}</div>`
    : `<div class="d-flex gap-2"><span class="chat-logo">${I.logo}</span><div class="chat-ia small">${formatoIA(m.texto)}</div></div>`)).join('');
  return `<aside id="chat" class="chat-panel ${S.chatOpen ? 'open' : ''} flex-column border-start bg-body-tertiary" aria-label="Pregúntale a FinFlow">
    <div class="d-flex align-items-center gap-2 px-3 app-top border-bottom">
      <span class="icon">${I.chat}</span><strong class="small flex-grow-1 text-nowrap">Pregúntale a FinFlow</strong>
      ${AI.msgs.length ? '<button class="btn btn-link btn-sm text-body-secondary p-0" data-act="chat-nuevo">Nueva</button>' : ''}
      <button type="button" class="btn-close btn-sm" data-act="chat" aria-label="Cerrar el asistente"></button>
    </div>
    <div class="chat-msgs flex-grow-1 d-flex flex-column gap-3 p-3" id="chat-msgs" aria-live="polite">
      ${AI.msgs.length ? msgs : inicio}
      ${AI.busy ? `<div class="d-flex gap-2 align-items-center"><span class="chat-logo">${I.logo}</span><span class="small text-body-secondary">Pensando…</span></div>` : ''}
      ${AI.error ? `<div class="alert alert-danger py-2 small mb-0">${esc(AI.error)}</div>` : ''}
    </div>
    <form class="p-3 border-top" data-form="ask">
      <div class="input-group"><input class="form-control" id="ask-q" maxlength="300" required placeholder="Pregunta lo que quieras" aria-label="Pregunta" ${AI.busy || !AI.enabled ? 'disabled' : ''}>
        <button class="btn btn-primary" type="submit" aria-label="Enviar" ${AI.busy || !AI.enabled ? 'disabled' : ''}>${I.send}</button></div>
      <div class="form-text">Recibe un resumen de tus números, sin nombres de personas ni RUT. Es informativo: no es asesoría financiera.</div>
    </form>
  </aside>`;
}
async function ask(q) {
  q = String(q || '').trim(); if (!q || AI.busy || !AI.enabled) return;
  const historia = AI.msgs.slice(-6);
  AI.msgs.push({ rol: 'usuario', texto: q }); AI.busy = true; AI.error = ''; render();
  try {
    const r = await api('/api/asistente', { method: 'POST', body: JSON.stringify({ pregunta: q, resumen: aiSummary(), historia }) });
    AI.msgs.push({ rol: 'asistente', texto: r.respuesta });
  } catch (e) { AI.error = e.message; }
  AI.busy = false; render();
  const campo = document.getElementById('ask-q'); if (campo && window.innerWidth >= 992) campo.focus();
}
