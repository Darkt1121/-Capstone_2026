/* Punto de entrada de la página. Carga los módulos en orden y arranca FinFlow.
   logica/logica.js y logica/ejemplo.js ya se cargaron antes como scripts normales (FF y los datos de ejemplo). */
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
import { render } from './app/render.js';

cargarConfig();
arrancarSesion();
render();
