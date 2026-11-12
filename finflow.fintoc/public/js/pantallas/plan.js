/* Pantalla Plan: presupuestos, metas de ahorro y reglas propias. */
import { fmt, esc, S, BADGE } from '../app/estado.js';
import { pageTitle } from '../app/marco.js';
import { D } from '../app/render.js';
import { cap, categorias, budgetList } from './comunes.js';

export function tabPlan() {
  const d = D; const ym = FF.monthKey(d.today);
  const usanRegla = d.txs.filter((t) => t.source === 'regla').length;
  const etiqueta = { ok: ['text-bg-success', 'Llegas'], justo: ['text-bg-warning', 'Justo'], mal: ['text-bg-danger', 'No llegas'] };
  const barra = { ok: 'bg-success', justo: 'bg-warning', mal: 'bg-danger' };
  const metas = S.metas.map((m, i) => {
    const g = FF.goalStatus(m, d.txs, d.today, d.proj);
    return `<li class="list-group-item">
      <div class="d-flex justify-content-between align-items-start gap-2"><div><strong>${esc(m.nombre)}</strong><div class="small text-body-secondary num">${fmt(m.ahorrado)} de ${fmt(m.monto)} · para el ${m.fecha.split('-').reverse().join('/')}${m.aporte ? ` · aporte ${fmt(m.aporte)} al mes` : ''}</div></div>
        <div class="d-flex gap-1 flex-shrink-0">${m.aporte ? `<button class="btn btn-sm btn-outline-primary py-0 text-nowrap" data-act="aportar" data-i="${i}">Sumar aporte</button>` : ''}<button class="btn btn-sm btn-outline-danger py-0" data-act="quitar-meta" data-i="${i}" aria-label="Quitar meta ${esc(m.nombre)}">Quitar</button></div></div>
      <div class="progress my-2" style="height:8px" role="progressbar" aria-label="Avance de ${esc(m.nombre)}" aria-valuenow="${g.pct}" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar ${barra[g.state]}" style="width:${g.pct}%"></div></div>
      <div class="small"><span class="badge ${etiqueta[g.state][0]}">${etiqueta[g.state][1]}</span> ${esc(g.text)}</div>
    </li>`;
  }).join('');
  return `
    ${pageTitle('Plan', 'Presupuestos, metas de ahorro y tus propias reglas.')}
    <div class="row g-3">
      <div class="col-lg-6 d-flex flex-column gap-3">
        <div class="card">
          <div class="card-header">Presupuestos de ${FF.monthName(ym)}</div>
          ${budgetList(FF.budgetStatus(S.presupuestos, d.txs, ym), true)}
          <div class="card-body border-top">
            <form class="row g-2" data-form="presupuesto">
              <div class="col-sm-6"><label class="form-label small" for="pre-cat">Categoría</label><input class="form-control" id="pre-cat" list="cat-list" required maxlength="40" placeholder="Ej: comida"></div>
              <div class="col-sm"><label class="form-label small" for="pre-monto">Tope al mes</label><input class="form-control num" id="pre-monto" type="number" inputmode="numeric" min="1000" step="1000" required></div>
              <div class="col-sm-auto d-flex align-items-end"><button class="btn btn-primary w-100" type="submit">Agregar</button></div>
            </form>
            <div class="form-text">Te avisamos en Inicio cuando llegas al 80 % y al 100 %. Si la categoría ya tiene tope, se reemplaza.</div>
          </div>
        </div>
        <div class="card">
          <div class="card-header">Tus reglas</div>
          <ul class="list-group list-group-flush">${S.reglas.map((r, i) => `<li class="list-group-item d-flex justify-content-between align-items-center gap-2"><div class="small"><span class="text-body-secondary">Si dice</span> <strong>${esc(r.texto)}</strong> <span class="text-body-secondary">→</span> ${esc(cap(r.categoria))} <span class="badge ${BADGE[r.ambito]}">${r.ambito === 'negocio' ? 'Negocio' : 'Personal'}</span></div><button class="btn btn-sm btn-outline-danger py-0" data-act="quitar-regla" data-i="${i}" aria-label="Quitar regla ${esc(r.texto)}">Quitar</button></li>`).join('') || '<li class="list-group-item small text-body-secondary">Aún no tienes reglas. También se crean solas cuando cambias la categoría de un movimiento.</li>'}</ul>
          <div class="card-body border-top">
            <form class="row g-2" data-form="regla">
              <div class="col-sm-6"><label class="form-label small" for="regla-texto">Si la descripción dice</label><input class="form-control" id="regla-texto" required minlength="2" maxlength="60" placeholder="Ej: ferretería"></div>
              <div class="col-sm-6"><label class="form-label small" for="regla-cat">Categoría</label><input class="form-control" id="regla-cat" list="cat-list" required maxlength="40" placeholder="Ej: materiales"></div>
              <div class="col-sm"><label class="form-label small" for="regla-ambito">Ámbito</label><select class="form-select" id="regla-ambito"><option value="personal">Personal</option><option value="negocio">Negocio</option></select></div>
              <div class="col-sm-auto d-flex align-items-end"><button class="btn btn-primary w-100" type="submit">Agregar</button></div>
            </form>
            <div class="form-text">Se revisan antes que las reglas de FinFlow. Hoy ${usanRegla === 1 ? 'un movimiento usa' : usanRegla + ' movimientos usan'} tus reglas.</div>
          </div>
        </div>
      </div>
      <div class="col-lg-6 d-flex flex-column gap-3">
        <div class="card">
          <div class="card-header">Metas de ahorro</div>
          <ul class="list-group list-group-flush">${metas || '<li class="list-group-item small text-body-secondary">Aún no tienes metas.</li>'}</ul>
          <div class="card-body border-top">
            <form class="row g-2" data-form="meta">
              <div class="col-12"><label class="form-label small" for="meta-nombre">¿Para qué ahorras?</label><input class="form-control" id="meta-nombre" required maxlength="60" placeholder="Ej: Notebook nuevo"></div>
              <div class="col-sm-6"><label class="form-label small" for="meta-monto">Monto</label><input class="form-control num" id="meta-monto" type="number" inputmode="numeric" min="1000" step="1000" required></div>
              <div class="col-sm-6"><label class="form-label small" for="meta-fecha">Para cuándo</label><input class="form-control" id="meta-fecha" type="date" required min="${FF.addDays(d.today, 1)}"></div>
              <div class="col-sm-6"><label class="form-label small" for="meta-aporte">Cuánto guardarás al mes</label><input class="form-control num" id="meta-aporte" type="number" inputmode="numeric" min="0" step="1000" placeholder="Opcional"></div>
              <div class="col-sm-6"><label class="form-label small" for="meta-ahorrado">Cuánto llevas</label><input class="form-control num" id="meta-ahorrado" type="number" inputmode="numeric" min="0" step="1000" placeholder="0"></div>
              <div class="col-12"><button class="btn btn-primary" type="submit">Agregar meta</button></div>
            </form>
            <div class="form-text">Lo comparamos con lo que te sobra cada mes y con tu proyección de saldo.</div>
          </div>
        </div>
      </div>
    </div>
    <datalist id="cat-list">${categorias().map((c) => `<option value="${esc(c)}">`).join('')}</datalist>`;
}
