/* Ventana de un movimiento: corregir categoría, traspaso, repetido y boleta. */
import { I, esc, signed, S } from '../app/estado.js';
import { PDF, api } from '../app/importar.js';
import { D, render } from '../app/render.js';
import { categorias } from './comunes.js';

// Boleta del movimiento: ver, quitar o adjuntar (PDF, JPG o PNG de hasta 2 MB).
export function boletaBlock(t) {
  const b = S.boletas.find((x) => x.movimiento === t.id);
  const cuerpo = b
    ? `<div class="d-flex flex-wrap align-items-center gap-2"><a class="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1" href="/api/boletas/archivo?id=${encodeURIComponent(b.id)}" target="_blank" rel="noopener">${I.clip}Ver ${esc(b.nombre)}</a><button class="btn btn-sm btn-outline-danger" data-act="quitar-boleta" data-id="${esc(b.id)}">Quitar</button></div>`
    : S.user && !S.sample
      ? `<label class="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" for="boleta-file">${I.clip}Adjuntar boleta</label><input type="file" id="boleta-file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" hidden><div class="form-text">PDF, JPG o PNG de hasta 2 MB.</div>`
      : '<div class="form-text mt-0">Crea una cuenta para adjuntar boletas.</div>';
  return `<hr><div class="fw-semibold small mb-2">Boleta</div>${cuerpo}<div class="small mt-1" id="boleta-msg" role="status"></div>`;
}
export function avisoBoleta(texto) { const m = document.getElementById('boleta-msg'); if (m) { m.textContent = texto; m.className = 'small mt-1 text-danger'; } }
export async function subirBoleta(file) {
  if (file.size > 2 * 1024 * 1024) return avisoBoleta('La boleta debe pesar menos de 2 MB.');
  const m = document.getElementById('boleta-msg'); if (m) { m.textContent = 'Subiendo…'; m.className = 'small mt-1 text-body-secondary'; }
  try {
    const datos = await new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = () => mal(new Error('No pudimos leer el archivo.')); r.readAsDataURL(file); });
    const b = await api('/api/boletas', { method: 'POST', body: JSON.stringify({ movimiento: S.sheetId, nombre: file.name, datos }) });
    S.boletas = S.boletas.filter((x) => x.movimiento !== b.movimiento).concat(b); render();
  } catch (e) { avisoBoleta(e.message); }
}

// Ventana para corregir un movimiento
export function sheet() {
  const t = D.txs.find((x) => x.id === S.sheetId); if (!t) return '';
  const key = FF.counterpartyKey(t.description);
  return `<div class="modal-backdrop show"></div>
  <div class="modal d-block scrim" tabindex="-1" data-act="close-sheet"><div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
    <div class="modal-content sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" data-stop>
      <div class="modal-header"><h2 class="modal-title h6 text-break" id="sheet-title">${esc(t.description)}</h2><button type="button" class="btn-close" data-act="close-sheet" aria-label="Cerrar"></button></div>
      <div class="modal-body">
        <div class="d-flex justify-content-between align-items-center mb-3"><span class="small text-body-secondary">${FF.shortDate(t.date)} · ${esc(t.accountName)}</span><strong class="fs-5 num">${signed(t.amount)}</strong></div>
        ${t.dupOf ? `<div class="alert alert-warning small"><strong>¿Está repetido?</strong> Hay un movimiento igual en ${esc(t.dupName)} el ${FF.shortDate(t.dupDate)}. Pasa cuando la misma cuenta entra dos veces, por ejemplo por cartola y conectando el banco.
          <div class="d-flex flex-wrap gap-2 mt-2"><button class="btn btn-sm btn-warning" data-act="dup" data-v="juntar">Es el mismo: contarlo una vez</button><button class="btn btn-sm btn-outline-secondary" data-act="dup" data-v="mantener">Son distintos</button></div></div>` : ''}
        ${t.dup ? `<div class="alert alert-secondary small">Lo juntaste con el de ${esc(t.dupName)}, así que no cuenta. <button class="btn btn-link btn-sm p-0 align-baseline" data-act="dup" data-v="">Deshacer</button></div>` : ''}
        <div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="is-internal" ${t.internal ? 'checked' : ''}><label class="form-check-label" for="is-internal">Es un traspaso entre mis cuentas (no cuenta como ingreso ni gasto)</label></div>
        <div id="scope-block" style="${t.internal ? 'opacity:.4' : ''}">
          <div class="form-label">¿De qué es este movimiento?</div>
          <div class="row g-2 mb-2" role="group" aria-label="Ámbito">
            <div class="col-6"><button class="btn btn-outline-primary w-100 ${t.scope === 'negocio' ? 'active' : ''}" data-act="pick-scope" data-scope="negocio" aria-pressed="${t.scope === 'negocio'}">Negocio</button></div>
            <div class="col-6"><button class="btn btn-outline-primary w-100 ${t.scope === 'personal' ? 'active' : ''}" data-act="pick-scope" data-scope="personal" aria-pressed="${t.scope === 'personal'}">Personal</button></div>
          </div>
          <div class="form-text mb-3">Motivo actual: ${esc(t.reason)}</div>
          <div class="mb-3"><label class="form-label" for="tx-cat">Categoría</label>
            <input class="form-control" id="tx-cat" list="cat-list-tx" maxlength="40" value="${esc(t.tag || '')}" placeholder="Ej: supermercado">
            <datalist id="cat-list-tx">${categorias().map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
            <div class="form-text">Comercio: <strong>${esc(t.comercio)}</strong>. Si cambias la categoría, se crea una regla: todo lo que diga "${esc(FF.merchant(t.description).key)}" irá a esa categoría.</div></div>
        </div>
        <div class="form-check mt-3"><input class="form-check-input" type="checkbox" id="apply-all" checked><label class="form-check-label" for="apply-all">Aplicar también a los otros movimientos de ${esc(t.comercio || FF.titleCase(key) || 'esta contraparte')}</label>
          <div class="form-text mt-0">Si la desmarcas, el cambio queda solo en este movimiento.</div></div>
        ${boletaBlock(t)}
      </div>
      <div class="modal-footer"><button class="btn btn-outline-secondary" data-act="close-sheet">Cancelar</button><button class="btn btn-primary" data-act="save-tx">Guardar</button></div>
    </div>
  </div></div>`;
}
