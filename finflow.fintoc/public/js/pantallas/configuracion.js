/* Configuración inicial: tu nombre, el consentimiento y subir la primera cartola. */
import { I, esc, FINTOC, S, panel } from '../app/estado.js';
import { PDF } from '../app/importar.js';

// configuración inicial
export const GUIDES = {
  'BancoEstado CuentaRUT': ['Entra a la web de BancoEstado con tu RUT.', 'Abre CuentaRUT › Movimientos o Cartola.', 'Elige el período y descarga en PDF, Excel o CSV.'],
  'Mercado Pago': ['Entra a Mercado Pago desde el computador.', 'Ve a Actividad › Descargar reportes.', 'Elige el período y descarga en Excel o CSV.'],
  'Banco de Chile': ['Entra a tu banco en línea.', 'Busca Cuentas › Movimientos o Cartola.', 'Descarga en Excel o CSV.'],
  'Santander': ['Entra a tu banco en línea.', 'Busca Cuentas › Movimientos o Cartola.', 'Descarga en Excel o CSV.'],
  'MACH': ['MACHBANK te manda la cartola de cada mes en PDF a tu correo.', 'Descarga ese PDF.', 'Si tiene clave, te la pedimos al subirlo.'],
  'Otro banco': ['Descarga tus movimientos en Excel o CSV.', 'Necesitamos al menos fecha, descripción y monto.'],
};
export const stepBar = (n) => `<div class="small text-body-secondary mb-1">Paso ${n} de 2</div><div class="progress mb-4" style="height:6px" role="progressbar" aria-label="Paso ${n} de 2" aria-valuenow="${n}" aria-valuemin="0" aria-valuemax="2"><div class="progress-bar" style="width:${n * 50}%"></div></div>`;
export function viewOnboard() {
  if (S.step === 1) {
    return panel(`${stepBar(1)}
      <h1 class="h3 mb-3">Antes de empezar</h1>
      <form data-form="holder">
        <div class="mb-3"><label class="form-label" for="holder">Tu nombre tal como aparece en tu cartola</label>
          <input class="form-control" id="holder" required minlength="3" value="${esc(S.holder)}" placeholder="Ej: Valentina Rojas Fuentes" autocomplete="name">
          <div class="form-text">Lo usamos para reconocer los traspasos entre tus propias cuentas.</div></div>
        <div class="form-check mb-4"><input class="form-check-input" type="checkbox" id="consent" ${S.consent ? 'checked' : ''} required>
          <label class="form-check-label small" for="consent">Leí la <a href="#" data-act="politica">política de privacidad</a> y autorizo expresamente a FinFlow a guardar y analizar los movimientos de las cartolas que yo suba o del banco que yo conecte (a través de Fintoc, solo lectura), para clasificarlos y proyectar mi saldo. Sé que son datos sobre mi situación económica. FinFlow no ve ni guarda mi clave bancaria. Puedo exportar o borrar mis datos y retirar esta autorización cuando quiera. El asistente usa un servicio externo de IA en Estados Unidos y solo recibe un resumen de mis números, sin nombres ni RUT.</label></div>
        <button class="btn btn-primary w-100" type="submit">Continuar</button>
      </form>`);
  }
  const full = S.accounts.length >= 3;
  const msg = S.importMsg ? `<div class="alert ${S.importMsg.ok ? 'alert-success' : 'alert-danger'}" role="status">${esc(S.importMsg.text)}</div>` : '';
  return panel(`${stepBar(2)}
    <h1 class="h3">Sube tu cartola</h1>
    <p class="text-body-secondary">Puedes agregar hasta 3 cuentas, por ejemplo CuentaRUT y Mercado Pago.</p>
    ${S.accounts.length ? `<ul class="list-group mb-3">${S.accounts.map((a) => `<li class="list-group-item d-flex justify-content-between align-items-center"><div><strong>${esc(a.name)}</strong><div class="small text-body-secondary">${a.rows.length} movimientos · hasta el ${FF.shortDate(a.rows[a.rows.length - 1].date)}</div></div><span class="badge text-bg-success">Lista</span></li>`).join('')}</ul>` : ''}
    ${(!full && FINTOC.enabled) ? `<div class="card mb-3"><div class="card-body">
      <h2 class="h6">Conexión directa</h2>
      <p class="small text-body-secondary">Conecta tu banco con Fintoc (solo lectura) y traemos tus movimientos sin subir archivos.</p>
      <button class="btn btn-primary w-100" data-act="fintoc-connect" ${FINTOC.busy ? 'disabled' : ''}>${FINTOC.busy ? 'Conectando…' : 'Conectar mi banco'}</button>
      <div class="form-text">¿Prefieres no conectarlo? Sube una cartola aquí abajo.</div>
    </div></div>` : ''}
    ${full ? '' : `
    <label class="form-label">¿De qué banco es?</label>
    <div class="row row-cols-2 g-2 mb-3">${Object.keys(GUIDES).map((b) => `<div class="col"><button class="btn btn-outline-secondary w-100 text-start ${S.bank === b ? 'active' : ''}" data-act="bank" data-bank="${esc(b)}" aria-pressed="${S.bank === b}">${esc(b)}</button></div>`).join('')}</div>
    <div class="card mb-3"><div class="card-body">
      <h2 class="h6">Cómo descargarla</h2>
      <ol class="small text-body-secondary ps-3 mb-2">${GUIDES[S.bank].map((g) => `<li>${esc(g)}</li>`).join('')}</ol>
    </div></div>
    <label class="dropzone d-flex flex-column align-items-center gap-1 text-center p-4 mb-3" id="dropzone" for="file">${I.upload}<strong>Arrastra tu archivo aquí o elige uno</strong><span class="small text-body-secondary">${S.bank === 'BancoEstado CuentaRUT' || S.bank === 'MACH' ? 'PDF, Excel o CSV' : 'Excel o CSV'}</span><input id="file" type="file" accept=".csv,.txt,.xlsx,.xls,.pdf" hidden></label>
    ${PDF.file ? `<form class="card mb-3" data-form="pdf-clave"><div class="card-body">
      <h2 class="h6">Tu cartola está protegida</h2>
      <p class="small text-body-secondary">Escribe la clave del archivo <strong>${esc(PDF.file.name)}</strong>. Es la clave del PDF, no la de tu banco. Se usa solo para abrirlo aquí, en tu navegador, y no se guarda.</p>
      <div class="input-group"><input type="password" class="form-control" id="pdf-clave" aria-label="Clave del archivo" autocomplete="off" required><button class="btn btn-primary">Abrir</button></div>
      ${PDF.error ? `<div class="text-danger small mt-2" role="alert">${esc(PDF.error)}</div>` : ''}
    </div></form>` : ''}`}
    ${msg}
    <div class="d-flex flex-wrap gap-2">
      ${S.accounts.length ? '<button class="btn btn-primary" data-act="finish">Ver mis números</button>' : ''}
      <button class="btn btn-outline-secondary" data-act="load-sample">Usar cartolas de ejemplo</button>
    </div>`);
}
