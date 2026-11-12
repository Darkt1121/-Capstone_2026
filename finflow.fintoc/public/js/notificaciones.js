/* Notificaciones: avisos, historial, campana y bloqueo del modo de ejemplo. */
'use strict';

// Notificaciones. notificaciones() calcula los avisos de ahora; cada uno tiene una "clave" para no
// repetirlo. revisarNotificaciones() compara con el historial (S.notifs) y avisa solo de los nuevos.
const ACCION_NOTIF = { antiguedad: ['add-account', '', 'Subir cartola'], proyeccion: ['tab', 'proyeccion', 'Ver proyección'], presupuesto: ['tab', 'plan', 'Ver presupuestos'], precio: ['tab', 'proyeccion', 'Ver pagos fijos'], cobro: ['tab', 'proyeccion', 'Ver pagos fijos'], repetidos: ['ver-revisar', '', 'Revisar'] };
function notificaciones() {
  if (!D) return [];
  const out = [];
  if (!S.sample && FF.diffDays(D.today, hoyReal()) > 7) out.push({ clave: 'antiguedad:' + D.today, nivel: 'info', titulo: `Tus cartolas llegan hasta el ${FF.shortDate(D.today)}`, texto: 'El saldo y lo que puedes gastar son de esa fecha, no de hoy. Sube una cartola más nueva.' });
  const a = D.proj.alert;
  if (a) out.push({ clave: 'proyeccion:' + a.start, nivel: 'warning', titulo: `Semana del ${FF.shortDate(a.start)}: podrías bajar de tu mínimo`, texto: a.amount < D.proj.minimum ? `Tu saldo podría llegar a ${fmt(a.amount)} (tu mínimo es ${fmt(D.proj.minimum)}).` : `En ${a.belowOf20} de 20 escenarios tu saldo baja de tu mínimo (${fmt(D.proj.minimum)}).` });
  const ym = FF.monthKey(D.today);
  for (const b of FF.budgetStatus(S.presupuestos, D.txs, ym)) {
    if (b.level === 'pasado') out.push({ clave: `presupuesto:${b.categoria}:${ym}:pasado`, nivel: 'danger', titulo: `Te pasaste del presupuesto de ${b.categoria}`, texto: `Llevas ${fmt(b.spent)} de ${fmt(b.monto)} en ${FF.monthName(ym)}.` });
    else if (b.level === 'cerca') out.push({ clave: `presupuesto:${b.categoria}:${ym}:cerca`, nivel: 'warning', titulo: `Vas en el 80 % del presupuesto de ${b.categoria}`, texto: `Llevas ${fmt(b.spent)} de ${fmt(b.monto)} en ${FF.monthName(ym)}.` });
  }
  for (const r of D.proj.recurring) if (r.change && r.sign < 0) out.push({ clave: `precio:${r.name}:${r.change.last}`, nivel: 'info', titulo: `${FF.titleCase(r.name)} ${r.change.pct > 0 ? 'subió' : 'bajó'} ${Math.abs(r.change.pct)} %`, texto: `Antes pagabas ${fmt(r.change.prev)} y el último cobro fue ${fmt(r.change.last)}.` });
  const desde = S.sample || D.today > hoyReal() ? D.today : hoyReal();
  for (const c of FF.nextCharges(D.proj.recurring, desde, 3)) out.push({ clave: `cobro:${c.name}:${c.date}`, nivel: 'info', titulo: `${FF.titleCase(c.name)} se cobra el ${FF.shortDate(c.date)}`, texto: `Son ${fmt(c.amount)}. Revisa que tengas saldo en esa cuenta.` });
  const dups = D.txs.filter((t) => t.dupOf);
  if (dups.length) out.push({ clave: `repetidos:${dups.length}:${dups[0].id}`, nivel: 'warning', titulo: dups.length === 1 ? 'Hay un posible movimiento repetido' : `Hay ${dups.length} posibles movimientos repetidos`, texto: 'Mismo monto, en otra cuenta y en la misma fecha. Revisa si cuentan una vez.' });
  return out;
}
const conCuenta = () => S.user && !S.sample;
const hace = (iso) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? 'recién' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} días`; };
let revisando = false;
async function revisarNotificaciones() {
  if (revisando || S.view !== 'app' || !D) return;
  const conocidas = new Set(S.notifs.map((n) => n.clave).concat(S.notifBorradas));
  const nuevas = notificaciones().filter((n) => !conocidas.has(n.clave));
  if (!nuevas.length) return;
  revisando = true;
  const ahora = new Date().toISOString();
  S.notifs = nuevas.map((n) => ({ ...n, creada: ahora, leida: false })).concat(S.notifs).slice(0, 300);
  if (conCuenta()) api('/api/notificaciones', { method: 'POST', body: JSON.stringify({ lista: nuevas }) }).catch(() => {});
  avisar(nuevas);
  revisando = false;
  animateNext = false; render();
}
// Aviso en la página (abajo a la derecha) y, si el usuario dio permiso, notificación del sistema.
function avisar(nuevas) {
  const titulo = nuevas.length === 1 ? nuevas[0].titulo : `Tienes ${nuevas.length} notificaciones nuevas`;
  const texto = nuevas.length === 1 ? nuevas[0].texto : nuevas.slice(0, 3).map((n) => n.titulo).join(' · ');
  const caja = document.getElementById('toasts');
  if (caja) {
    const t = document.createElement('div');
    t.className = 'toast show'; t.setAttribute('role', 'status');
    t.innerHTML = `<div class="toast-header"><span class="icon me-2">${I.bell}</span><strong class="me-auto">FinFlow</strong><button type="button" class="btn-close" data-act="toast-cerrar" aria-label="Cerrar"></button></div><div class="toast-body"><div class="fw-semibold">${esc(titulo)}</div><div class="small text-body-secondary">${esc(texto)}</div><button class="btn btn-link btn-sm p-0 mt-1" data-act="notif-abrir">Ver notificaciones</button></div>`;
    caja.appendChild(t); setTimeout(() => t.remove(), 8000);
  }
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      const n = new Notification('FinFlow: ' + titulo, { body: texto, tag: nuevas[0].clave });
      n.onclick = () => { window.focus(); S.notifOpen = true; render(); };
    }
  } catch (e) { /* el navegador no permite notificaciones */ }
}
function marcarLeidas() {
  if (!S.notifs.some((n) => !n.leida)) return;
  S.notifs.forEach((n) => { n.leida = true; });
  if (conCuenta()) api('/api/notificaciones/leidas', { method: 'PUT' }).catch(() => {});
}
function borrarNotif(clave) {
  S.notifs = S.notifs.filter((n) => n.clave !== clave);
  if (!S.notifBorradas.includes(clave)) S.notifBorradas.push(clave);
  if (conCuenta()) api('/api/notificaciones?clave=' + encodeURIComponent(clave), { method: 'DELETE' }).catch(() => {});
}
function notifBoton() {
  const sinLeer = S.notifs.filter((n) => !n.leida).length;
  const color = { info: 'text-bg-info', warning: 'text-bg-warning', danger: 'text-bg-danger' };
  const nombre = { info: 'Dato', warning: 'Atención', danger: 'Importante' };
  const permiso = 'Notification' in window ? Notification.permission : 'denied';
  return `<div class="position-relative ms-auto" id="notif">
    <button class="btn btn-sm btn-outline-secondary position-relative d-inline-flex align-items-center" data-act="notif" aria-expanded="${!!S.notifOpen}" aria-label="Notificaciones${sinLeer ? ': ' + sinLeer + ' sin leer' : ''}">${I.bell}${sinLeer ? `<span class="position-absolute top-0 start-100 translate-middle badge rounded-pill text-bg-danger">${sinLeer}</span>` : ''}</button>
    ${S.notifOpen ? `<div class="dropdown-menu dropdown-menu-end show p-0 shadow" data-bs-popper="static" style="width:370px;max-width:calc(100vw - 2rem)">
      <div class="d-flex align-items-center gap-2 px-3 py-2 border-bottom"><span class="small fw-semibold flex-grow-1">Notificaciones</span>${S.notifs.length ? '<button class="btn btn-link btn-sm p-0" data-act="notif-borrar-todas">Borrar todas</button>' : ''}</div>
      ${permiso === 'default' ? '<div class="px-3 py-2 border-bottom small">¿Quieres que también lleguen como notificación de tu computador? <button class="btn btn-link btn-sm p-0 align-baseline" data-act="notif-permiso">Activar</button></div>' : ''}
      ${S.notifs.length ? `<div class="list-group list-group-flush" style="max-height:65vh;overflow-y:auto">${S.notifs.map((n) => { const ac = ACCION_NOTIF[n.clave.split(':')[0]] || ['tab', 'inicio', 'Ver']; return `<div class="list-group-item ${n.leida ? '' : 'bg-body-tertiary'}">
        <div class="d-flex align-items-start gap-2"><span class="badge ${color[n.nivel] || 'text-bg-info'} mt-1">${nombre[n.nivel] || 'Dato'}</span>
          <div class="flex-grow-1"><div class="small fw-semibold">${esc(n.titulo)}</div><div class="small text-body-secondary">${esc(n.texto)}</div>
            <div class="d-flex align-items-center gap-2 mt-1"><button class="btn btn-link btn-sm p-0" data-act="${ac[0]}" ${ac[1] ? `data-tab="${ac[1]}"` : ''}>${ac[2]}</button><span class="small text-body-secondary">· ${hace(n.creada)}</span></div></div>
          <button type="button" class="btn-close btn-sm" data-act="notif-borrar" data-clave="${esc(n.clave)}" aria-label="Borrar esta notificación"></button></div>
      </div>`; }).join('')}</div>` : '<p class="small text-body-secondary px-3 py-3 mb-0">No tienes notificaciones.</p>'}
    </div>` : ''}
  </div>`;
}
// Con datos de ejemplo se puede mirar todo, pero no guardar ni cambiar nada.
const SOLO_CON_CUENTA = new Set(['add-account', 'remove-acc', 'fintoc-connect', 'fintoc-sync', 'ask-delete', 'do-delete', 'save-tx', 'dup', 'quitar-regla', 'quitar-presupuesto', 'quitar-meta', 'aportar', 'quitar-boleta']);
function avisoEjemplo() {
  const caja = document.getElementById('toasts'); if (!caja) return;
  caja.querySelectorAll('.toast-ejemplo').forEach((t) => t.remove());
  const t = document.createElement('div');
  t.className = 'toast show toast-ejemplo'; t.setAttribute('role', 'status');
  t.innerHTML = '<div class="toast-header"><strong class="me-auto">Datos de ejemplo</strong><button type="button" class="btn-close" data-act="toast-cerrar" aria-label="Cerrar"></button></div><div class="toast-body"><div>Estás viendo datos de ejemplo, solo para mirar. Crea una cuenta para usar los tuyos.</div><button class="btn btn-primary btn-sm mt-2" data-act="go-auth">Crear cuenta</button></div>';
  caja.appendChild(t); setTimeout(() => t.remove(), 7000);
}

// FinFlow revisa solo: cada 5 minutos, al volver a la pestaña y después de cada cambio en los datos.
setInterval(revisarNotificaciones, 5 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) revisarNotificaciones(); });
