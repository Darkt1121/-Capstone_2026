/* Pantalla Perfil: cuenta, cuentas bancarias, exportar y borrar datos. */
import { I, fmt, esc, FINTOC, S } from '../app/estado.js';
import { pageTitle } from '../app/marco.js';
import { D } from '../app/render.js';
import { FF } from '../logica/index.js';

export function tabPerfil() {
  return `
    ${pageTitle('Perfil')}
    <div class="row g-3">
      <div class="col-lg-6 d-flex flex-column gap-3">
        <div class="card">
          <div class="card-header">Tu cuenta</div>
          <ul class="list-group list-group-flush">
            <li class="list-group-item"><div class="small text-body-secondary">Titular en tus cartolas</div><strong>${esc(S.holder)}</strong></li>
            <li class="list-group-item"><div class="small text-body-secondary">Acceso</div>${esc((S.user && S.user.email) || 'Sin cuenta (datos de ejemplo)')}
              ${S.user && !S.sample ? (S.user.confirmado ? ' <span class="badge text-bg-success">Correo confirmado</span>' : ' <span class="badge text-bg-warning">Correo sin confirmar</span> <button class="btn btn-link btn-sm p-0 align-baseline" data-act="reenviar-correo">Reenviar correo</button>') : ''}</li>
          </ul>
        </div>
        <div class="card">
          <div class="card-header d-flex justify-content-between align-items-center"><span>Cuentas</span><button class="btn btn-link btn-sm p-0" data-act="add-account" ${S.accounts.length >= 3 ? 'disabled' : ''}>Agregar cuenta</button></div>
          <ul class="list-group list-group-flush">${D.bals.map((b) => `<li class="list-group-item d-flex justify-content-between align-items-center gap-3"><div><strong>${esc(b.name)}</strong><div class="small text-body-secondary num">${fmt(b.balance)} · hasta el ${FF.shortDate(b.lastDate)}</div></div><button class="btn btn-outline-danger btn-sm" data-act="remove-acc" data-id="${b.id}" aria-label="Quitar ${esc(b.name)}">Quitar</button></li>`).join('')}</ul>
          <div class="card-body">
            ${(FINTOC.enabled && S.accounts.some((a) => a.source === 'fintoc')) ? `<button class="btn btn-outline-primary btn-sm mb-2" data-act="fintoc-sync" ${FINTOC.busy ? 'disabled' : ''}>${FINTOC.busy ? 'Actualizando…' : 'Actualizar desde el banco'}</button>${FINTOC.msg ? `<p class="small text-body-secondary" role="status">${esc(FINTOC.msg)}</p>` : ''}` : ''}
            <div class="form-text mt-0">Hasta 3 cuentas. Al volver a subir una cartola, los movimientos repetidos se ignoran.</div>
          </div>
        </div>
      </div>
      <div class="col-lg-6 d-flex flex-column gap-3">
        <div class="card"><div class="card-body">
          <h2 class="h6">Tus datos</h2>
          <p class="small text-body-secondary">Puedes llevarte todos tus movimientos clasificados o borrar tu cuenta con todo lo que contiene. ${S.user && S.consentDate ? 'Aceptaste la <a href="#" data-act="politica">política de privacidad</a> el ' + esc(S.consentDate) + '.' : '<a href="#" data-act="politica">Política de privacidad</a>'}</p>
          <div class="d-flex flex-wrap gap-2"><button class="btn btn-outline-secondary btn-sm" data-act="tab" data-tab="reporte">Reporte negocio vs. personal</button><button class="btn btn-outline-secondary btn-sm" data-act="export">Exportar mis datos (CSV)</button><button class="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-1" data-act="ask-delete">${I.trash}Borrar mi cuenta y mis datos</button></div>
          ${S.exportOpen ? `<textarea class="form-control font-monospace small mt-3" id="csv" rows="8" readonly aria-label="Tus datos en CSV">${esc(FF.toCSV(D.txs))}</textarea><div class="d-flex align-items-center gap-2 mt-2"><button class="btn btn-secondary btn-sm" data-act="copy-csv">Copiar CSV</button><span class="small text-body-secondary" id="copy-msg"></span></div>` : ''}
          ${S.confirmDelete ? `<div class="alert alert-danger mt-3 mb-0"><strong>¿Borrar todo?</strong><p class="mb-2">Se eliminan tu cuenta, tus cartolas, tus correcciones y tus alertas. No se puede deshacer.</p><div class="d-flex flex-wrap gap-2"><button class="btn btn-danger btn-sm" data-act="do-delete">Sí, borrar todo</button><button class="btn btn-outline-secondary btn-sm" data-act="cancel-delete">Cancelar</button></div></div>` : ''}
        </div></div>
        <div><button class="btn btn-outline-secondary btn-sm" data-act="logout">Cerrar sesión</button></div>
      </div>
    </div>`;
}
