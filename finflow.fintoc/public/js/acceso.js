/* Portada, inicio de sesión / registro y configuración inicial (subir cartolas). */
'use strict';

// piezas que se repiten
const brand = () => `<span class="d-inline-flex align-items-center gap-2 fw-bold"><span class="brand-mark">${I.logo}</span>FinFlow</span>`;
const BADGE = { negocio: 'text-bg-primary', personal: 'text-bg-secondary', internal: 'bg-body-secondary text-body border', review: 'text-bg-warning' };

// landing
function viewLanding() {
  const d = SAMPLE; const a = d.proj.alert;
  return `
  <nav class="navbar navbar-expand bg-body border-bottom sticky-top">
    <div class="container">
      <span class="navbar-brand">${brand()}</span>
      <div class="navbar-nav ms-auto align-items-center gap-2">
        <a class="nav-link d-none d-md-block" href="#como">Cómo funciona</a>
        <a class="nav-link d-none d-md-block" href="#privacidad">Privacidad</a>
        <button class="btn btn-outline-primary btn-sm" data-act="go-auth" data-modo="entrar">Entrar</button>
      </div>
    </div>
  </nav>

  <header class="container py-5">
    <div class="row align-items-center g-5">
      <div class="col-lg-6">
        <p class="text-primary fw-semibold mb-2">Para trabajadores independientes en Chile</p>
        <h1 class="display-5 fw-bold mb-3">Tu negocio y tu plata, separados.</h1>
        <p class="lead text-body-secondary mb-4">Sube la cartola de tu banco o conéctalo. FinFlow separa lo del negocio de lo personal, te muestra cuánto ganaste de verdad y te avisa una semana antes de quedar corto.</p>
        <div class="d-flex flex-wrap gap-2 mb-4">
          <button class="btn btn-primary btn-lg" data-act="try-sample">Probar con datos de ejemplo</button>
          <button class="btn btn-outline-secondary btn-lg" data-act="go-auth">Subir mi cartola</button>
        </div>
        <ul class="list-unstyled small text-body-secondary mb-0">
          <li class="d-flex align-items-center gap-2 mb-1"><span class="icon text-success">${I.lock}</span>No pedimos tu clave del banco</li>
          <li class="d-flex align-items-center gap-2"><span class="icon text-success">${I.shield}</span>Exportas o borras tus datos cuando quieras</li>
        </ul>
      </div>
      <div class="col-lg-6">
        <div class="card shadow-sm">
          <div class="card-header small text-body-secondary">Ejemplo: Valentina, diseñadora freelance (datos ficticios)</div>
          <div class="card-body">
            <div class="small text-body-secondary">Saldo en sus 2 cuentas</div>
            <div class="fs-1 fw-bold num mb-2">${fmt(d.total)}</div>
            <div class="chart-wrap">${chart(d, { w: 640, h: 220, noDrag: true })}</div>
            <p class="small text-body-secondary mt-2 mb-0">${esc(phrase(d.proj))}</p>
          </div>
          ${a ? `<div class="card-footer small nota nota-warning"><strong>Semana del ${FF.shortDate(a.start)}:</strong> podrías bajar de tu mínimo y llegar a ${fmt(a.amount)}. Te alcanza para ${a.daysCovered} días de gastos personales.</div>` : ''}
        </div>
      </div>
    </div>
  </header>

  <section class="bg-body-tertiary border-top border-bottom py-5" id="como">
    <div class="container">
      <h2 class="fw-bold mb-2">Cómo funciona</h2>
      <p class="text-body-secondary mb-4">Lo importas una vez en el computador y después lo revisas desde el celular.</p>
      <div class="row g-4">
        <div class="col-md-4"><div class="card h-100"><div class="card-body">
          <span class="badge rounded-pill text-bg-primary mb-2">1</span>
          <h3 class="h5">Subes tu cartola</h3>
          <p class="text-body-secondary mb-0">Descargas la cartola desde la web de tu banco y la subes en Excel o CSV. También puedes conectar tu banco en modo solo lectura.</p>
        </div></div></div>
        <div class="col-md-4"><div class="card h-100"><div class="card-body">
          <span class="badge rounded-pill text-bg-primary mb-2">2</span>
          <h3 class="h5">Separa negocio y personal</h3>
          <p class="text-body-secondary mb-0">Cada movimiento dice por qué se clasificó así. Si no está bien, lo cambias con un toque y FinFlow lo recuerda.</p>
        </div></div></div>
        <div class="col-md-4"><div class="card h-100"><div class="card-body">
          <span class="badge rounded-pill text-bg-primary mb-2">3</span>
          <h3 class="h5">Proyecta 4 semanas y te avisa</h3>
          <p class="text-body-secondary mb-0">Ves un rango probable de tu saldo y tu mínimo. Si vas a quedar corto, te avisa una semana antes, en pesos y en días.</p>
        </div></div></div>
      </div>
    </div>
  </section>

  <section class="container py-5">
    <div class="row align-items-center g-4">
      <div class="col-lg-6">
        <h2 class="fw-bold mb-2">Cuánto ganaste de verdad</h2>
        <p class="text-body-secondary mb-0">Los traspasos entre tus propias cuentas no son ingresos. FinFlow los reconoce por tu nombre y los deja fuera, para que la utilidad del mes sea la real.</p>
      </div>
      <div class="col-lg-6">
        <div class="card"><div class="card-body">
          <div class="small text-body-secondary mb-2">${FF.monthName(d.ym)} · ejemplo de Valentina</div>
          <div class="row g-2">
            <div class="col-6"><div class="border rounded p-3 h-100"><span class="badge ${BADGE.negocio}">Negocio</span><div class="fs-4 fw-bold num mt-1">${fmt(d.month.utilidad)}</div><div class="small text-body-secondary">utilidad del mes</div></div></div>
            <div class="col-6"><div class="border rounded p-3 h-100"><span class="badge ${BADGE.personal}">Personal</span><div class="fs-4 fw-bold num mt-1">${fmt(d.month.gasto_personal)}</div><div class="small text-body-secondary">gastos personales</div></div></div>
          </div>
          <p class="small text-body-secondary mt-3 mb-0">${fmt(d.month.internal)} movidos entre sus cuentas no cuentan como ingreso.</p>
        </div></div>
      </div>
    </div>
  </section>

  <section class="container pb-5" id="privacidad">
    <div class="card bg-body-tertiary"><div class="card-body p-4">
      <h2 class="h3 fw-bold">Tus datos son tuyos</h2>
      <p class="text-body-secondary mb-0">No te pedimos la clave de tu banco: trabajamos con la cartola que tú descargas o con una conexión de solo lectura. Pedimos tu consentimiento antes de leer tus movimientos, y desde tu perfil puedes exportar todo o borrar tu cuenta con sus datos.</p>
    </div></div>
  </section>

  <footer class="border-top py-4">
    <div class="container d-flex flex-wrap justify-content-between gap-2 small text-body-secondary">
      <span>Los datos de ejemplo son ficticios. · <a href="#" data-act="politica">Política de privacidad</a></span>
    </div>
  </footer>`;
}

// Marco de las pantallas de acceso y de configuración inicial.
const panel = (body) => `<div class="container py-4 py-md-5"><div class="row justify-content-center"><div class="col-md-8 col-lg-5">${body}</div></div></div>`;

// acceso
function viewAuth() {
  const entrar = S.authMode === 'entrar';
  return panel(`
    <button class="btn btn-link btn-sm px-0 mb-3" data-act="go-landing">← Volver</button>
    <div class="card shadow-sm"><div class="card-body p-4">
      <div class="mb-3">${brand()}</div>
      <h1 class="h3 mb-3">${entrar ? 'Entra a tu cuenta' : 'Crea tu cuenta'}</h1>
      ${GOOGLE.clientId ? `<div id="google-btn" class="d-flex justify-content-center"></div>
      <div class="d-flex align-items-center gap-3 my-3 small text-body-secondary"><hr class="flex-grow-1">o con tu correo<hr class="flex-grow-1"></div>` : ''}
      <form data-form="login">
        ${entrar ? '' : '<div class="mb-3"><label class="form-label" for="nombre">Nombre</label><input class="form-control" id="nombre" required maxlength="80" autocomplete="name"></div>'}
        <div class="mb-3"><label class="form-label" for="email">Correo</label><input class="form-control" id="email" type="email" required autocomplete="email" placeholder="tu@correo.cl"></div>
        <div class="mb-3"><label class="form-label" for="pass">Contraseña</label><input class="form-control" id="pass" type="password" required ${entrar ? 'autocomplete="current-password"' : 'minlength="8" autocomplete="new-password" placeholder="Mínimo 8 caracteres"'}></div>
        <div class="text-danger small mb-3" id="auth-error" role="alert"></div>
        <button class="btn btn-primary w-100" type="submit">${entrar ? 'Entrar' : 'Crear cuenta'}</button>
      </form>
      ${entrar ? '' : '<p class="small text-body-secondary text-center mt-3 mb-0">Antes de guardar tus movimientos te pediremos tu autorización. Lee la <a href="#" data-act="politica">política de privacidad</a>.</p>'}
      <p class="small text-center mt-3 mb-0">${entrar ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'} <a href="#" data-act="go-auth" data-modo="${entrar ? 'registro' : 'entrar'}">${entrar ? 'Créala' : 'Entra'}</a></p>
    </div></div>`);
}

// configuración inicial
const GUIDES = {
  'BancoEstado CuentaRUT': ['Entra a la web de BancoEstado con tu RUT.', 'Abre CuentaRUT › Movimientos o Cartola.', 'Elige el período y descarga en PDF, Excel o CSV.'],
  'Mercado Pago': ['Entra a Mercado Pago desde el computador.', 'Ve a Actividad › Descargar reportes.', 'Elige el período y descarga en Excel o CSV.'],
  'Banco de Chile': ['Entra a tu banco en línea.', 'Busca Cuentas › Movimientos o Cartola.', 'Descarga en Excel o CSV.'],
  'Santander': ['Entra a tu banco en línea.', 'Busca Cuentas › Movimientos o Cartola.', 'Descarga en Excel o CSV.'],
  'MACH': ['MACHBANK te manda la cartola de cada mes en PDF a tu correo.', 'Descarga ese PDF.', 'Si tiene clave, te la pedimos al subirlo.'],
  'Otro banco': ['Descarga tus movimientos en Excel o CSV.', 'Necesitamos al menos fecha, descripción y monto.'],
};
const stepBar = (n) => `<div class="small text-body-secondary mb-1">Paso ${n} de 2</div><div class="progress mb-4" style="height:6px" role="progressbar" aria-label="Paso ${n} de 2" aria-valuenow="${n}" aria-valuemin="0" aria-valuemax="2"><div class="progress-bar" style="width:${n * 50}%"></div></div>`;
function viewOnboard() {
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
