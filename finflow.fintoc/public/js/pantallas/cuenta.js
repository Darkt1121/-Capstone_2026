/* Pantalla para crear cuenta o entrar con correo y contraseña, y para recuperar la contraseña. */
import { S, brand, panel } from '../app/estado.js';

const marco = (titulo, cuerpo) => panel(`
    <button class="btn btn-link btn-sm px-0 mb-3" data-act="go-landing">← Volver</button>
    <div class="card shadow-sm"><div class="card-body p-4">
      <div class="mb-3">${brand()}</div>
      <h1 class="h3 mb-3">${titulo}</h1>
      ${cuerpo}
    </div></div>`);
const mensajes = '<div class="text-danger small mb-3" id="auth-error" role="alert"></div><div class="text-success small mb-3" id="auth-ok" role="status"></div>';

// acceso
export function viewAuth() {
  if (S.authMode === 'olvide') {
    return marco('¿Olvidaste tu contraseña?', `
      <p class="small text-body-secondary">Escribe el correo de tu cuenta y te enviamos un link para crear una contraseña nueva.</p>
      <form data-form="olvide">
        <div class="mb-3"><label class="form-label" for="email">Correo</label><input class="form-control" id="email" type="email" required autocomplete="email" placeholder="tu@correo.cl"></div>
        ${mensajes}
        <button class="btn btn-primary w-100" type="submit">Enviar link</button>
      </form>
      <p class="small text-center mt-3 mb-0"><a href="#" data-act="go-auth" data-modo="entrar">Volver a entrar</a></p>`);
  }
  if (S.authMode === 'nueva') {
    return marco('Crea tu contraseña nueva', `
      <form data-form="nueva-clave">
        <div class="mb-3"><label class="form-label" for="pass">Contraseña nueva</label><input class="form-control" id="pass" type="password" required minlength="8" autocomplete="new-password" placeholder="Mínimo 8 caracteres"></div>
        <div class="mb-3"><label class="form-label" for="pass2">Repite la contraseña</label><input class="form-control" id="pass2" type="password" required minlength="8" autocomplete="new-password"></div>
        ${mensajes}
        <button class="btn btn-primary w-100" type="submit">Guardar y entrar</button>
      </form>
      <p class="small text-body-secondary mt-3 mb-0">Al cambiarla se cierran las sesiones abiertas en otros dispositivos.</p>`);
  }
  const entrar = S.authMode === 'entrar';
  return marco(entrar ? 'Entra a tu cuenta' : 'Crea tu cuenta', `
      <form data-form="login">
        ${entrar ? '' : '<div class="mb-3"><label class="form-label" for="nombre">Nombre</label><input class="form-control" id="nombre" required maxlength="80" autocomplete="name"></div>'}
        <div class="mb-3"><label class="form-label" for="email">Correo</label><input class="form-control" id="email" type="email" required autocomplete="email" placeholder="tu@correo.cl"></div>
        <div class="mb-3"><label class="form-label" for="pass">Contraseña</label><input class="form-control" id="pass" type="password" required ${entrar ? 'autocomplete="current-password"' : 'minlength="8" autocomplete="new-password" placeholder="Mínimo 8 caracteres"'}>
          ${entrar ? '<div class="text-end mt-1"><a href="#" class="small" data-act="go-auth" data-modo="olvide">¿Olvidaste tu contraseña?</a></div>' : ''}</div>
        <div class="text-danger small mb-3" id="auth-error" role="alert"></div>
        <button class="btn btn-primary w-100" type="submit">${entrar ? 'Entrar' : 'Crear cuenta'}</button>
      </form>
      ${entrar ? '' : '<p class="small text-body-secondary text-center mt-3 mb-0">Antes de guardar tus movimientos te pediremos tu autorización. Lee la <a href="#" data-act="politica">política de privacidad</a>.</p>'}
      <p class="small text-center mt-3 mb-0">${entrar ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'} <a href="#" data-act="go-auth" data-modo="${entrar ? 'registro' : 'entrar'}">${entrar ? 'Créala' : 'Entra'}</a></p>`);
}
