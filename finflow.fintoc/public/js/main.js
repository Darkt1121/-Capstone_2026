/* Punto de entrada de la página. Carga los módulos en orden y arranca FinFlow.
   La lógica (logica/index.js, el objeto FF) la importa cada módulo que la usa.
   logica/ejemplo.js se carga antes como script normal: son los datos de ejemplo. */
import './app/estado.js';
import './graficos/proyeccion.js';
import './pantallas/portada.js';
import './pantallas/cuenta.js';
import './pantallas/configuracion.js';
import './app/marco.js';
import './graficos/panel.js';
import './app/notificaciones.js';
import './pantallas/comunes.js';
import './pantallas/inicio.js';
import './pantallas/movimientos.js';
import './pantallas/proyeccion.js';
import './pantallas/plan.js';
import './pantallas/reporte.js';
import './pantallas/perfil.js';
import './pantallas/calendario.js';
import './pantallas/detalle.js';
import './app/render.js';
import './app/importar.js';
import './app/sesion.js';
import './app/eventos.js';
import { cargarConfig } from './app/importar.js';
import { arrancarSesion } from './app/sesion.js';
import { render, go } from './app/render.js';
import { RECUPERAR } from './app/estado.js';
import { avisoSimple } from './app/notificaciones.js';

cargarConfig();
const sesionLista = arrancarSesion();
render();

// Al volver desde el link "crear contraseña nueva" (/?recuperar=uid.token): se abre ese formulario
// después de revisar la sesión, para que nada lo pise.
const recuperar = new URLSearchParams(location.search).get('recuperar');
if (recuperar) {
  history.replaceState(null, '', location.pathname);
  [RECUPERAR.uid, RECUPERAR.token] = recuperar.split('.');
  sesionLista.then(() => go({ view: 'auth', authMode: 'nueva' }));
}

// Al volver desde el link del correo de confirmación (/?correo=confirmado o /?correo=vencido).
const correo = new URLSearchParams(location.search).get('correo');
if (correo) {
  history.replaceState(null, '', location.pathname);
  if (correo === 'confirmado') avisoSimple('Correo confirmado', '¡Listo! Tu cuenta quedó confirmada.');
  else avisoSimple('Link vencido', 'Ese link ya no sirve. Entra a tu cuenta y pide otro desde tu Perfil.');
}
