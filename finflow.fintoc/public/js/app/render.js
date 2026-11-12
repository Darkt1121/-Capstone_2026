/* Dibuja la pantalla que corresponde y lo que va después de dibujar. */
import { $root, S, save, derive } from './estado.js';
import { viewApp } from './marco.js';
import { revisarNotificaciones } from './notificaciones.js';
import { importFile } from './sesion.js';
import { animateNext, setAnimateNext, countUp } from '../graficos/proyeccion.js';
import { viewOnboard } from '../pantallas/configuracion.js';
import { viewAuth } from '../pantallas/cuenta.js';
import { viewLanding } from '../pantallas/portada.js';

// render
// Datos calculados de lo que se está mostrando (se recalculan en cada render).
export let D = null;
export function render() {
  D = S.accounts.length ? derive(S) : null;
  if (S.view === 'app' && !D) S.view = 'onboard';
  const html = { landing: viewLanding, auth: viewAuth, onboard: viewOnboard, app: viewApp }[S.view]();
  $root.innerHTML = html;
  save();
  afterRender();
  if (animateNext) countUp();
  setAnimateNext(false);
}
export function afterRender() {
  // Los avisos aparecen a la izquierda del chat cuando el chat está abierto al lado.
  const avisos = document.getElementById('toasts');
  if (avisos) { if (S.view === 'app' && S.chatOpen && window.innerWidth >= 1200) avisos.style.setProperty('right', '360px', 'important'); else avisos.style.removeProperty('right'); }
  setTimeout(revisarNotificaciones, 0);
  const chat = document.getElementById('chat-msgs'); if (chat) chat.scrollTop = chat.scrollHeight;
  const dz = document.getElementById('dropzone');
  if (dz) {
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('over'));
    dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('over'); if (e.dataTransfer.files[0]) importFile(e.dataTransfer.files[0]); });
  }
}
export const go = (patch) => { Object.assign(S, patch); setAnimateNext(true); render(); window.scrollTo(0, 0); };
