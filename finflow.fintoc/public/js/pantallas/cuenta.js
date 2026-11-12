/* Pantalla para crear cuenta o entrar (correo y contraseña, o Google). */
import { GOOGLE, S, brand, panel } from '../app/estado.js';

// acceso
export function viewAuth() {
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
