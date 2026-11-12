/* Íconos, ayudas, estado de la página (S) y datos calculados (D). */
import { guardarEnServidor } from './sesion.js';
import { chart } from '../graficos/proyeccion.js';
import { FF } from '../logica/index.js';

export const $root = document.getElementById('root');
export const STORE = 'finflow-proto-v1';

// iconos (trazo)
export const I = {
  logo: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16l5-5 4 3 7-8"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18M4 16l5-5 4 3 7-8"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4"/><path d="M12 17.5v.5"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="28" height="28"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
  clip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12l-8.5 8.5a5 5 0 0 1-7-7L14 5a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 8"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>',
};

export const fmt = FF.fmt;
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(n);
export const kfmt = (n) => (Math.abs(n) >= 1e6 ? '$' + (n / 1e6).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + ' M' : '$' + Math.round(n / 1000) + ' mil');

// estado
export const FINTOC = { enabled: false, busy: false, msg: null };
// Datos del link "crear contraseña nueva" (vienen en la dirección: /?recuperar=uid.token). No se guardan.
export const RECUPERAR = { uid: '', token: '' };
export const fresh = () => ({ view: 'landing', tab: 'inicio', user: null, holder: '', consent: false, step: 1, bank: 'BancoEstado CuentaRUT', accounts: [], reglas: [], presupuestos: [], metas: [], boletas: [], chatOpen: null, periodo: 90, notifOpen: false, notifs: [], notifBorradas: [], rules: { __tx: {}, __internal: {} }, minimum: 400000, sample: false, importMsg: null, filter: 'todos', query: '', accFilter: 'todas', sheetId: null, confirmDelete: false, exportOpen: false });
export let S = fresh();
try { const saved = JSON.parse(localStorage.getItem(STORE) || 'null'); if (saved && saved.accounts) S = Object.assign(fresh(), saved, { sheetId: null, confirmDelete: false, exportOpen: false, importMsg: null, notifOpen: false }); } catch (e) { /* sin almacenamiento */ }
export function save() { try { const { sheetId, ...rest } = S; localStorage.setItem(STORE, JSON.stringify(rest)); } catch (e) { /* sin almacenamiento */ } guardarEnServidor(); }

// datos derivados
export function derive(state) {
  if (!state.accounts.length) return null;
  const txs = FF.buildTransactions(state.accounts, state.holder, state.rules, state.reglas);
  const bals = FF.balances(state.accounts);
  const total = bals.reduce((s, b) => s + b.balance, 0);
  const today = bals.reduce((m, b) => (b.lastDate > m ? b.lastDate : m), '0000');
  const proj = FF.project(txs, total, today, state.minimum);
  const ym = FF.prevMonth(FF.monthKey(today));
  const porTag = {};
  for (const t of txs) if (!t.internal && t.amount < 0) porTag[t.tag || 'otros'] = (porTag[t.tag || 'otros'] || 0) - t.amount;
  const cats = Object.keys(porTag).filter((k) => k !== 'otros').sort((a, b) => porTag[b] - porTag[a]).slice(0, 5);
  return { txs, bals, total, today, proj, ym, cats, month: FF.monthSummary(txs, ym) };
}
export const SAMPLE_STATE = (() => {
  const st = fresh(); st.holder = 'Valentina Rojas Fuentes';
  st.accounts = [
    { id: 'rut', name: 'CuentaRUT', bank: 'BancoEstado CuentaRUT', rows: FF.parseStatement(window.SAMPLE_RUT).rows },
    { id: 'mp', name: 'Mercado Pago', bank: 'Mercado Pago', rows: FF.parseStatement(window.SAMPLE_MP).rows },
  ];
  return st;
})();
export const SAMPLE = derive(SAMPLE_STATE);

// piezas que se repiten
export const brand = () => `<span class="d-inline-flex align-items-center gap-2 fw-bold"><span class="brand-mark">${I.logo}</span>FinFlow</span>`;
export const BADGE = { negocio: 'text-bg-primary', personal: 'text-bg-secondary', internal: 'bg-body-secondary text-body border', review: 'text-bg-warning' };

// Marco de las pantallas de acceso y de configuración inicial.
export const panel = (body) => `<div class="container py-4 py-md-5"><div class="row justify-content-center"><div class="col-md-8 col-lg-5">${body}</div></div></div>`;

// Vuelve al estado inicial (al cerrar sesión o salir del ejemplo).
export function reiniciarEstado() { S = fresh(); }
