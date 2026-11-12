/* Cuentas de usuario (Google y correo) y guardado en el servidor. */
import { STORE, FINTOC, GOOGLE, S, reiniciarEstado } from './estado.js';
import { bankShort, readFile, PDF, POLITICA, readPdf, api } from './importar.js';
import { render, go } from './render.js';

// inicio de sesión con Google
// Google dibuja el botón y entrega un token; el servidor lo comprueba y crea la sesión.
export function googleButton() {
  const el = document.getElementById('google-btn');
  if (!el || !GOOGLE.clientId || !window.google) return;
  if (!GOOGLE.listo) { window.google.accounts.id.initialize({ client_id: GOOGLE.clientId, callback: googleLogin }); GOOGLE.listo = true; }
  window.google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', text: 'continue_with', locale: 'es', width: Math.min(el.offsetWidth, 400) });
}
export const googleLogin = (resp) => abrirSesion('/api/login/google', { credential: resp.credential });
window.onGoogleLibraryLoad = googleButton;

// cuentas: el servidor comprueba los datos y crea la sesión; acá solo se guarda quién entró
export async function abrirSesion(ruta, datos) {
  try {
    const { usuario } = await api(ruta, { method: 'POST', body: JSON.stringify(datos) });
    await cargarDatos(usuario);
    go({ view: S.accounts.length && S.consent ? 'app' : 'onboard', step: S.holder && S.consent ? 2 : 1 });
  } catch (e) { const el = document.getElementById('auth-error'); if (el) el.textContent = e.message; }
}
export function salir() {
  clearTimeout(porSubir); SUBIDO.ajustes = ''; SUBIDO.cuentas = {}; SUBIDO.listas = {};
  reiniciarEstado(); try { localStorage.removeItem(STORE); } catch (e) { /* sin almacenamiento */ }
  render(); window.scrollTo(0, 0);
}

// datos en el servidor
// Con sesión iniciada, las cuentas, los movimientos y los ajustes se guardan en la base de datos.
// SUBIDO recuerda lo último que se mandó, para subir solo lo que cambió.
export const SUBIDO = { ajustes: '', cuentas: {}, listas: {} };
export let porSubir = null;
export const LISTAS = ['reglas', 'presupuestos', 'metas'];
export const ajustesDe = (s) => JSON.stringify({ holder: s.holder, consent: s.consent, policy: POLITICA, minimum: s.minimum, rules: s.rules });
export async function cargarDatos(usuario) {
  const mismoUsuario = S.user && S.user.email === usuario.email;
  const d = await api('/api/datos');
  if (d.accounts.length || d.holder) {
    // Si aceptó una versión anterior de la política, tiene que aceptar la vigente.
    Object.assign(S, { holder: d.holder, consent: d.consent && d.policy === POLITICA, consentDate: d.consentDate, minimum: d.minimum === null ? S.minimum : d.minimum, rules: Object.assign({ __tx: {}, __internal: {} }, d.rules), accounts: d.accounts, sample: false });
    SUBIDO.ajustes = ajustesDe(S); SUBIDO.cuentas = {};
    for (const a of S.accounts) SUBIDO.cuentas[a.id] = JSON.stringify(a);
    Object.assign(S, { reglas: d.reglas || [], presupuestos: d.presupuestos || [], metas: d.metas || [], boletas: d.boletas || [] });
    const ns = d.notificaciones || [];
    S.notifs = ns.filter((n) => !n.borrada).map(({ borrada, ...n }) => n); S.notifBorradas = ns.filter((n) => n.borrada).map((n) => n.clave);
    for (const k of LISTAS) SUBIDO.listas[k] = JSON.stringify(S[k]);
  } else if (!mismoUsuario) {
    // Cuenta sin datos: no se mezcla con los datos de ejemplo ni con los de otra persona.
    Object.assign(S, { holder: '', consent: false, accounts: [], rules: { __tx: {}, __internal: {} }, reglas: [], presupuestos: [], metas: [], boletas: [], notifs: [], notifBorradas: [], sample: false });
  }
  S.user = { email: usuario.email, name: usuario.nombre };
}
export function guardarEnServidor() {
  if (!S.user || S.sample) return;
  clearTimeout(porSubir);
  porSubir = setTimeout(async () => {
    if (!S.user || S.sample) return;
    const aviso = document.getElementById('aviso-guardado');
    try {
      const ajustes = ajustesDe(S);
      if (ajustes !== SUBIDO.ajustes) { await api('/api/ajustes', { method: 'PUT', body: ajustes }); SUBIDO.ajustes = ajustes; }
      for (const k of LISTAS) {
        const texto = JSON.stringify(S[k] || []);
        if (texto !== (SUBIDO.listas[k] || '[]')) { await api('/api/' + k, { method: 'PUT', body: JSON.stringify({ lista: S[k] || [] }) }); SUBIDO.listas[k] = texto; }
      }
      for (const a of S.accounts) {
        const texto = JSON.stringify(a);
        if (texto !== SUBIDO.cuentas[a.id]) { await api('/api/cuentas', { method: 'POST', body: texto }); SUBIDO.cuentas[a.id] = texto; }
      }
      for (const id of Object.keys(SUBIDO.cuentas)) {
        if (!S.accounts.some((a) => a.id === id)) { await api('/api/cuentas?id=' + encodeURIComponent(id), { method: 'DELETE' }); delete SUBIDO.cuentas[id]; }
      }
      aviso.classList.add('d-none');
    } catch (e) { aviso.classList.remove('d-none'); }
  }, 400);
}
// Al abrir la página: con sesión se traen los datos del servidor; sin sesión se vuelve a la portada.
export function arrancarSesion() {
  api('/api/sesion').then(async (s) => {
    if (!s.usuario) { if (S.user) salir(); return; }
    await cargarDatos(s.usuario);
    if (S.view === 'landing' || S.view === 'auth' || !S.consent) go({ view: S.accounts.length && S.consent ? 'app' : 'onboard', step: S.holder && S.consent ? 2 : 1 }); else render();
  }).catch(() => {});
}

export async function syncFintoc() {
  const j = await api('/api/fintoc/movements');
  const usable = j.accounts.filter((a) => a.rows.length);
  if (!usable.length) throw new Error('Tu banco no devolvió movimientos en el último año.');
  if (S.sample) { S.accounts = []; S.sample = false; }
  let added = 0, dup = 0;
  for (const fa of usable) {
    let acc = S.accounts.find((a) => a.id === fa.id);
    if (acc) { const m = FF.mergeRows(acc.rows, fa.rows); acc.rows = m.rows; added += m.added; dup += m.duplicates; }
    else {
      if (S.accounts.length >= 3) break;
      acc = { id: fa.id, name: fa.name, bank: fa.bank, source: 'fintoc', rows: fa.rows }; S.accounts.push(acc); added += fa.rows.length;
    }
    // El saldo real del banco ancla el saldo de la última fila.
    if (fa.balance !== null && acc.rows.length) acc.rows[acc.rows.length - 1].balance = fa.balance;
  }
  return `Banco conectado: ${added} movimientos nuevos${dup ? `, ${dup} repetidos ignorados` : ''}.`;
}
export async function runFintoc(connect) {
  if (FINTOC.busy) return;
  FINTOC.busy = true; FINTOC.msg = null; render();
  try {
    if (connect) {
      if (!window.Fintoc) throw new Error('No pudimos cargar el widget de Fintoc. Revisa tu conexión.');
      const { widgetToken, publicKey } = await api('/api/fintoc/link-intent', { method: 'POST', body: '{}' });
      await new Promise((resolve, reject) => {
        const widget = window.Fintoc.create({
          publicKey, widgetToken,
          onSuccess: (li) => { api('/api/fintoc/exchange', { method: 'POST', body: JSON.stringify({ exchangeToken: li.exchangeToken }) }).then(resolve, reject); },
          onExit: () => reject(new Error('__cancel__')),
        });
        if (widget && typeof widget.open === 'function') widget.open();
      });
    }
    const text = await syncFintoc();
    FINTOC.msg = text; FINTOC.busy = false;
    go({ importMsg: { ok: true, text } });
  } catch (e) {
    FINTOC.busy = false;
    if (e.message === '__cancel__') { render(); return; }
    FINTOC.msg = e.message; go({ importMsg: { ok: false, text: e.message } });
  }
}
export async function importFile(file, clave) {
  PDF.file = null; PDF.error = '';
  try {
    const parsed = /\.pdf$/i.test(file.name) ? FF.parsePdfStatement(await readPdf(file, clave)) : FF.parseStatement(await readFile(file));
    if (parsed.bank) S.bank = parsed.bank; // el PDF dice de qué banco es
    const name = bankShort(S.bank);
    let acc = S.accounts.find((a) => a.bank === S.bank);
    let added = parsed.rows.length, dup = 0;
    if (acc) { const m = FF.mergeRows(acc.rows, parsed.rows); acc.rows = m.rows; added = m.added; dup = m.duplicates; }
    else { if (S.accounts.length >= 3) throw new Error('Ya tienes 3 cuentas. Quita una desde tu perfil para agregar otra.'); S.accounts.push({ id: 'a' + Date.now(), name, bank: S.bank, rows: parsed.rows }); }
    const check = parsed.check ? (parsed.check.ok ? ' · saldo verificado' : ' · ojo: el saldo no cuadra, puede faltar una página') : '';
    S.sample = false;
    go({ importMsg: { ok: true, text: `${name}: ${added} movimientos nuevos${dup ? `, ${dup} repetidos ignorados` : ''}${check}.` } });
  } catch (e) {
    if (e.name === 'PasswordException') {
      // El PDF tiene clave: se pide (o se vuelve a pedir si estaba mala).
      PDF.file = file; PDF.error = clave ? 'Esa clave no abre el archivo. Inténtalo de nuevo.' : '';
      go({ importMsg: null });
      const campo = document.getElementById('pdf-clave'); if (campo) campo.focus();
      return;
    }
    go({ importMsg: { ok: false, text: e.message } });
  }
}
