/* Pagos fijos (con cambio de precio) y proyección del saldo a 4 semanas. */
import { counterpartyKey } from './clasificacion.js';
import { addDays, diffDays, mulberry32, monthKey } from './util.js';

// proyección
// Detecta movimientos que se repiten cada mes (≥3 meses, monto parecido, día parecido).
export function recurring(txs) {
  const groups = {};
  const allMonths = new Set(txs.map((t) => monthKey(t.date))).size;
  for (const t of txs) {
    if (t.internal) continue;
    const k = counterpartyKey(t.description) + (t.amount > 0 ? '+' : '-');
    (groups[k] = groups[k] || []).push(t);
  }
  const out = [];
  for (const [k, list] of Object.entries(groups)) {
    const months = new Set(list.map((t) => monthKey(t.date)));
    if (months.size < 3 || months.size < allMonths * 0.75 || list.length > months.size + 1) continue;
    const amts = list.map((t) => Math.abs(t.amount));
    const mean = amts.reduce((a, b) => a + b, 0) / amts.length;
    const sd = Math.sqrt(amts.reduce((a, b) => a + (b - mean) ** 2, 0) / amts.length);
    if (sd / mean > 0.25) continue;
    const days = list.map((t) => Number(t.date.slice(8, 10))).sort((a, b) => a - b);
    const day = days[Math.floor(days.length / 2)];
    // Solo para cobros de precio fijo (los anteriores casi iguales), como una suscripción.
    // Una cuenta de luz cambia todos los meses y no cuenta como "subió".
    const prev = amts.slice(0, -1); const prevMean = prev.reduce((x, y) => x + y, 0) / prev.length;
    const prevSd = Math.sqrt(prev.reduce((x, y) => x + (y - prevMean) ** 2, 0) / prev.length);
    const last = amts[amts.length - 1]; const diff = last - prevMean;
    const change = prevSd / prevMean <= 0.02 && Math.abs(diff) >= 500 && Math.abs(diff) / prevMean >= 0.05 ? { prev: Math.round(prevMean), last, pct: Math.round((diff / prevMean) * 100) } : null;
    out.push({ key: k, name: counterpartyKey(list[0].description), sign: list[0].amount > 0 ? 1 : -1, amount: change ? last : Math.round(mean), day, change, scope: list[0].scope, months: months.size, ids: new Set(list.map((t) => t.id)) });
  }
  return out;
}

export function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q; const lo = Math.floor(pos); const hi = Math.ceil(pos);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo));
}

// Proyección a 4 semanas: saldo de hoy + movimientos fijos en su fecha + el resto proyectado por semana.
// Para el rango se repite el cálculo 200 veces con la variación real de la historia.
export function project(txs, startBalance, today, minimum, opts = {}) {
  const weeks = 4;
  const hist = txs.filter((t) => !t.internal && t.date <= today);
  const first = hist.length ? hist[0].date : today;
  const historyDays = diffDays(first, today);
  const rec = recurring(hist);
  const recIds = new Set(); rec.forEach((r) => r.ids.forEach((id) => recIds.add(id)));

  // Flujo semanal no recurrente, semanas completas hacia atrás desde hoy.
  const nWeeks = Math.max(1, Math.floor(historyDays / 7));
  const weekly = new Array(nWeeks).fill(0);
  for (const t of hist) {
    if (recIds.has(t.id)) continue;
    const w = Math.floor(diffDays(t.date, today) / 7);
    if (w < nWeeks) weekly[nWeeks - 1 - w] += t.amount;
  }
  // Holt: nivel + tendencia (alpha 0.3, beta 0.05).
  const a = 0.3, b = 0.05;
  let level = weekly[0], trend = 0; const errors = [];
  for (let i = 1; i < weekly.length; i++) {
    const f = level + trend; errors.push(weekly[i] - f);
    const prev = level; level = a * weekly[i] + (1 - a) * (level + trend); trend = b * (level - prev) + (1 - b) * trend;
  }

  // Recurrentes que caen en las próximas 4 semanas.
  const upcoming = [];
  for (let d = 1; d <= weeks * 7; d++) {
    const date = addDays(today, d); const dom = Number(date.slice(8, 10));
    for (const r of rec) if (r.day === dom) upcoming.push({ date, name: r.name, amount: r.sign * r.amount, scope: r.scope, week: Math.ceil(d / 7), change: r.change });
  }
  const recByWeek = [0, 0, 0, 0];
  upcoming.forEach((u) => { recByWeek[u.week - 1] += u.amount; });

  const enough = historyDays >= 84; // ~3 meses (regla del proyecto)
  const rand = mulberry32(opts.seed || 2026);
  const sims = 200;
  const paths = [];
  for (let s = 0; s < sims; s++) {
    let bal = startBalance; const p = [];
    for (let w = 0; w < weeks; w++) {
      const base = enough ? level + trend * (w + 1) : 0;
      const noise = enough && errors.length ? errors[Math.floor(rand() * errors.length)] : 0;
      bal += recByWeek[w] + base + noise;
      p.push(bal);
    }
    paths.push(p);
  }
  const points = [];
  for (let w = 0; w < weeks; w++) {
    const vals = paths.map((p) => p[w]).sort((x, y) => x - y);
    const below = vals.filter((v) => v < minimum).length / sims;
    points.push({ week: w + 1, end: addDays(today, (w + 1) * 7), start: addDays(today, w * 7 + 1), p10: quantile(vals, 0.1), p50: quantile(vals, 0.5), p90: quantile(vals, 0.9), below, belowOf20: Math.round(below * 20) });
  }
  // Gasto personal diario promedio (últimos 90 días) para expresar "días cubiertos".
  const since = addDays(today, -90);
  const personalSpend = hist.filter((t) => t.date > since && t.scope === 'personal' && t.amount < 0).reduce((s, t) => s - t.amount, 0);
  const dailyPersonal = Math.max(1, Math.round(personalSpend / 90));
  const worst = points.reduce((m, p) => (p.belowOf20 > m.belowOf20 || (p.belowOf20 === m.belowOf20 && p.p50 < m.p50) ? p : m), points[0]);
  const alert = enough && (worst.p50 < minimum || worst.belowOf20 >= 3)
    ? { week: worst.week, start: worst.start, end: worst.end, amount: worst.p50, belowOf20: Math.max(1, worst.belowOf20), daysCovered: Math.max(0, Math.floor(worst.p50 / dailyPersonal)) }
    : null;
  return { today, startBalance, minimum, enough, historyDays, points, upcoming, recurring: rec, dailyPersonal, alert };
}
