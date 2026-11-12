/* Pantalla de portada (antes de entrar). */
import { I, fmt, esc, SAMPLE, brand, BADGE } from '../app/estado.js';
import { chart, phrase } from '../graficos/proyeccion.js';
import { FF } from '../logica/index.js';

// landing
export function viewLanding() {
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
