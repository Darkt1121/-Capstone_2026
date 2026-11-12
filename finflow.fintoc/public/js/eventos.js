/* Botones, formularios y teclas. Al final dibuja la página por primera vez. */
'use strict';

// eventos
document.addEventListener('click', (e) => {
  // Un clic fuera de las notificaciones las cierra (y un clic en una de sus acciones también).
  if (S.notifOpen && !e.target.closest('#toasts') && (!e.target.closest('#notif') || (e.target.closest('[data-act]') && !['notif', 'notif-borrar', 'notif-borrar-todas', 'notif-permiso'].includes(e.target.closest('[data-act]').dataset.act)))) { S.notifOpen = false; if (!e.target.closest('[data-act]')) { render(); return; } }
  const el = e.target.closest('[data-act]'); if (!el) return;
  if (el.dataset.act === 'close-sheet' && e.target.closest('[data-stop]') && el.classList.contains('scrim')) return;
  const act = el.dataset.act;
  if (S.sample && SOLO_CON_CUENTA.has(act)) { e.preventDefault(); S.sheetId = null; S.confirmDelete = false; animateNext = false; render(); avisoEjemplo(); return; }
  switch (act) {
    case 'go-auth': e.preventDefault(); document.querySelectorAll('#toasts .toast-ejemplo').forEach((t) => t.remove()); go({ view: 'auth', authMode: el.dataset.modo || 'registro', sheetId: null }); break;
    case 'go-landing': go({ view: 'landing' }); break;
    case 'politica': e.preventDefault(); document.getElementById('politica').classList.remove('d-none'); document.getElementById('politica').scrollTop = 0; break;
    case 'cerrar-politica': document.getElementById('politica').classList.add('d-none'); break;
    case 'try-sample': loadSample(); break;
    case 'load-sample': loadSample(); break;
    case 'bank': PDF.file = null; go({ bank: el.dataset.bank, importMsg: null }); break;
    case 'fintoc-connect': runFintoc(true); break;
    case 'fintoc-sync': runFintoc(false); break;
    case 'finish': go({ view: 'app', tab: 'inicio', importMsg: null }); break;
    case 'tab': go({ tab: el.dataset.tab, sheetId: null }); break;
    case 'filter': S.filter = el.dataset.f; render(); break;
    case 'cal-month': S.calMonth = el.dataset.ym; S.calDay = null; render(); break;
    case 'cal-day': S.calDay = el.dataset.day; render(); break;
    case 'open-tx': pickedScope = null; S.sheetId = el.dataset.id; render(); setTimeout(() => { const b = document.querySelector('.sheet button'); if (b) b.focus(); }, 0); break;
    case 'close-sheet': S.sheetId = null; render(); break;
    case 'pick-scope': pickedScope = el.dataset.scope; document.querySelectorAll('[data-act="pick-scope"]').forEach((b) => { b.setAttribute('aria-pressed', String(b === el)); b.classList.toggle('active', b === el); }); break;
    case 'save-tx': saveTx(); break;
    case 'ask-idea': ask(el.dataset.q); break;
    case 'chat': S.chatOpen = !S.chatOpen; animateNext = false; render(); if (S.chatOpen) { const c = document.getElementById('ask-q'); if (c && !c.disabled) c.focus(); } break;
    case 'notif': S.notifOpen = !S.notifOpen; if (S.notifOpen) marcarLeidas(); animateNext = false; render(); break;
    case 'notif-abrir': el.closest('.toast') && el.closest('.toast').remove(); S.notifOpen = true; marcarLeidas(); animateNext = false; render(); break;
    case 'notif-borrar': borrarNotif(el.dataset.clave); animateNext = false; render(); break;
    case 'notif-borrar-todas': S.notifs.map((n) => n.clave).forEach((c) => { if (!S.notifBorradas.includes(c)) S.notifBorradas.push(c); }); S.notifs = []; if (conCuenta()) api('/api/notificaciones?todas=1', { method: 'DELETE' }).catch(() => {}); animateNext = false; render(); break;
    case 'notif-permiso': try { Notification.requestPermission().then(() => render()); } catch (er) { /* sin permiso */ } break;
    case 'toast-cerrar': el.closest('.toast').remove(); break;
    case 'salir-ejemplo': salir(); break;
    case 'ver-revisar': go({ tab: 'movimientos', filter: 'revisar', sheetId: null }); break;
    case 'chat-nuevo': AI.msgs = []; AI.error = ''; render(); break;
    case 'add-account': go({ view: 'onboard', step: 2, importMsg: null }); break;
    case 'remove-acc': S.boletas = S.boletas.filter((b) => !b.movimiento.startsWith(el.dataset.id + ':')); S.accounts = S.accounts.filter((a) => a.id !== el.dataset.id); if (!S.accounts.length) go({ view: 'onboard', step: 2 }); else render(); break;
    case 'export': S.exportOpen = !S.exportOpen; render(); break;
    case 'dup': S.rules.__dup = S.rules.__dup || {}; if (el.dataset.v) S.rules.__dup[S.sheetId] = el.dataset.v; else delete S.rules.__dup[S.sheetId]; render(); break;
    case 'quitar-boleta': api('/api/boletas?id=' + encodeURIComponent(el.dataset.id), { method: 'DELETE' }).then(() => { S.boletas = S.boletas.filter((b) => String(b.id) !== el.dataset.id); render(); }, (er) => avisoBoleta(er.message)); break;
    case 'quitar-regla': S.reglas.splice(Number(el.dataset.i), 1); render(); break;
    case 'quitar-presupuesto': S.presupuestos.splice(Number(el.dataset.i), 1); render(); break;
    case 'quitar-meta': S.metas.splice(Number(el.dataset.i), 1); render(); break;
    case 'aportar': { const m = S.metas[Number(el.dataset.i)]; if (m && m.aporte) { m.ahorrado += m.aporte; render(); } break; }
    case 'imprimir': window.print(); break;
    case 'copy-csv': { const ta = document.getElementById('csv'); const msg = document.getElementById('copy-msg'); (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject()).then(() => { msg.textContent = 'Copiado.'; }).catch(() => { ta.select(); msg.textContent = 'Selecciónalo y cópialo con Ctrl+C.'; }); break; }
    case 'ask-delete': S.confirmDelete = true; render(); break;
    case 'cancel-delete': S.confirmDelete = false; render(); break;
    case 'do-delete': (S.user ? api('/api/usuario', { method: 'DELETE' }) : Promise.resolve()).then(salir, () => { document.getElementById('aviso-guardado').classList.remove('d-none'); }); break;
    case 'logout': api('/api/logout', { method: 'POST' }).catch(() => {}); salir(); break;
  }
});
function loadSample() {
  S.holder = 'Valentina Rojas Fuentes'; S.consent = true; S.sample = true;
  S.accounts = JSON.parse(JSON.stringify(SAMPLE_STATE.accounts)); S.rules = { __tx: {}, __internal: {} };
  S.reglas = []; S.boletas = []; S.notifs = []; S.notifBorradas = [];
  S.presupuestos = [{ categoria: 'supermercado', monto: 80000 }, { categoria: 'herramienta de trabajo', monto: 20000 }, { categoria: 'transporte', monto: 25000 }];
  S.metas = [{ nombre: 'Fondo de emergencia', monto: 1500000, fecha: '2027-06-30', aporte: 150000, ahorrado: 300000 }];
  go({ view: 'app', tab: 'inicio', importMsg: null });
}
function saveTx() {
  const t = D.txs.find((x) => x.id === S.sheetId); if (!t) return;
  const internal = document.getElementById('is-internal').checked;
  const applyAll = document.getElementById('apply-all').checked;
  // Con "aplicar a todos": se aplica si cambió la casilla, o si está marcada como traspaso y otros
  // movimientos de la misma persona todavía no lo están (por ejemplo, uno marcado antes solo).
  const clave = FF.personKey(t.description);
  const cambio = internal !== t.internal;
  const faltan = internal && D.txs.some((x) => FF.personKey(x.description) === clave && !x.internal);
  if (applyAll && (cambio || faltan)) {
    S.rules.__internalKey = S.rules.__internalKey || {}; S.rules.__internalKey[clave] = internal;
    for (const x of D.txs) if (FF.personKey(x.description) === clave) delete S.rules.__internal[x.id];
  } else if (cambio) S.rules.__internal[t.id] = internal;
  const scope = pickedScope || t.scope;
  if (!internal && scope !== t.scope) {
    if (applyAll) S.rules[FF.counterpartyKey(t.description)] = scope; else S.rules.__tx[t.id] = scope;
  }
  const cat = ((document.getElementById('tx-cat') || {}).value || '').trim().toLowerCase().slice(0, 40);
  if (!internal && cat && cat !== (t.tag || '')) {
    const texto = FF.merchant(t.description).key;
    S.reglas = S.reglas.filter((r) => r.texto !== texto).concat({ texto, categoria: cat, ambito: scope });
  }
  S.sheetId = null; render();
}
document.addEventListener('submit', (e) => {
  const f = e.target.dataset.form; if (!f) return; e.preventDefault();
  if (S.sample && ['presupuesto', 'regla', 'meta'].includes(f)) { avisoEjemplo(); return; }
  if (f === 'login') {
    const val = (id) => (document.getElementById(id) || {}).value || '';
    if (S.authMode === 'entrar') abrirSesion('/api/login', { email: val('email'), clave: val('pass') });
    else abrirSesion('/api/registro', { nombre: val('nombre'), email: val('email'), clave: val('pass') });
  }
  if (f === 'pdf-clave' && PDF.file) importFile(PDF.file, document.getElementById('pdf-clave').value);
  const campo = (id) => ((document.getElementById(id) || {}).value || '').trim();
  if (f === 'presupuesto') {
    const categoria = campo('pre-cat').toLowerCase().slice(0, 40); const monto = Math.round(Number(campo('pre-monto')));
    if (categoria && monto > 0) { S.presupuestos = S.presupuestos.filter((p) => p.categoria !== categoria).concat({ categoria, monto }); render(); }
  }
  if (f === 'regla') {
    const texto = mayus(campo('regla-texto')).slice(0, 60); const categoria = campo('regla-cat').toLowerCase().slice(0, 40);
    if (texto.length >= 2 && categoria) { S.reglas = S.reglas.filter((r) => r.texto !== texto).concat({ texto, categoria, ambito: campo('regla-ambito') === 'negocio' ? 'negocio' : 'personal' }); render(); }
  }
  if (f === 'meta') {
    const meta = { nombre: campo('meta-nombre').slice(0, 60), monto: Math.round(Number(campo('meta-monto'))), fecha: campo('meta-fecha'), aporte: Math.max(0, Math.round(Number(campo('meta-aporte')) || 0)), ahorrado: Math.max(0, Math.round(Number(campo('meta-ahorrado')) || 0)) };
    if (meta.nombre && meta.monto > 0 && /^\d{4}-\d{2}-\d{2}$/.test(meta.fecha) && S.metas.length < 20) { S.metas.push(meta); render(); }
  }
  if (f === 'ask') ask(document.getElementById('ask-q').value);
  if (f === 'holder') { S.holder = document.getElementById('holder').value.trim(); S.consent = document.getElementById('consent').checked; S.consentDate = S.consentDate || new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/-/g, '/'); go(S.accounts.length ? { view: 'app', tab: 'inicio' } : { step: 2 }); }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'q') { S.query = e.target.value; const pos = e.target.selectionStart; render(); const q = document.getElementById('q'); if (q) { q.focus(); q.setSelectionRange(pos, pos); } }
  if (e.target.id === 'is-internal') { const b = document.getElementById('scope-block'); if (b) b.style.opacity = e.target.checked ? '.4' : '1'; }
});
document.addEventListener('change', (e) => {
  if (S.sample && ['minimum', 'file', 'boleta-file'].includes(e.target.id)) { e.target.value = e.target.id === 'minimum' ? S.minimum : ''; avisoEjemplo(); return; }
  if (e.target.id === 'file' && e.target.files[0]) importFile(e.target.files[0]);
  if (e.target.id === 'boleta-file' && e.target.files[0]) subirBoleta(e.target.files[0]);
  if (e.target.id === 'accf') { S.accFilter = e.target.value; render(); }
  if (e.target.id === 'periodo') { S.periodo = Number(e.target.value) || 90; render(); }
  if (e.target.id === 'minimum') { const v = Math.max(0, Number(e.target.value) || 0); S.minimum = v; render(); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.getElementById('politica').classList.add('d-none');
  if (e.key === 'Escape' && S.chatOpen && window.innerWidth < 1200 && S.view === 'app') { S.chatOpen = false; render(); } if (e.key === 'Escape' && S.sheetId) { S.sheetId = null; render(); } });

render();
