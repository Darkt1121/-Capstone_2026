/* Utilidades: fechas, montos, nombres de meses y un generador de números al azar con semilla. */

// utilidades
export const strip = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
export const DAY = 86400000;
export const toDate = (iso) => new Date(iso + 'T12:00:00');
export const iso = (d) => d.toISOString().slice(0, 10);
export const addDays = (isoStr, n) => iso(new Date(toDate(isoStr).getTime() + n * DAY));
export const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / DAY);

export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


// formato de montos y nombres de meses
export const fmt = (n) => '$' + Math.round(Math.abs(n)).toLocaleString('es-CL');
export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const monthName = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1];
export const prevMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; };

export function titleCase(s) { return s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()).replace(/\b(Spa|Ltda|Eirl)\b/g, (x) => x.toUpperCase()); }
export function shortDate(isoStr) { const d = toDate(isoStr); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; }

export function monthKey(isoStr) { return isoStr.slice(0, 7); }
