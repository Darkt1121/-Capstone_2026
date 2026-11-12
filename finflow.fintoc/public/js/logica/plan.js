/* Resumen del mes, saldos, presupuestos, metas de ahorro, recordatorios, reporte y exportar a CSV. */
import { addDays, diffDays, fmt, prevMonth, shortDate, monthKey } from './util.js';

// resumen

export function monthSummary(txs, ym) {
  const s = { ym, ingreso_negocio: 0, gasto_operacional: 0, ingreso_personal: 0, gasto_personal: 0, internal: 0, internalCount: 0 };
  for (const t of txs) {
    if (monthKey(t.date) !== ym) continue;
    if (t.internal) { if (t.amount > 0 && !t.dup) { s.internal += t.amount; s.internalCount++; } continue; }
    s[t.category] += Math.abs(t.amount);
  }
  s.utilidad = s.ingreso_negocio - s.gasto_operacional;
  return s;
}

export function balances(accounts) {
  return accounts.map((a) => {
    const last = a.rows[a.rows.length - 1];
    const opening = a.rows[0].balance !== null ? a.rows[0].balance - a.rows[0].amount : 0;
    const bal = last && last.balance !== null ? last.balance : opening + a.rows.reduce((s, r) => s + r.amount, 0);
    return { id: a.id, name: a.name, balance: bal, lastDate: last ? last.date : null };
  });
}


// Presupuestos: cuánto va gastado en el mes en cada categoría con tope. Aviso al 80 % y al 100 %.
export function budgetStatus(budgets, txs, ym) {
  return (budgets || []).map((b) => {
    const spent = txs.filter((t) => !t.internal && t.amount < 0 && monthKey(t.date) === ym && (t.tag || 'otros') === b.categoria).reduce((s, t) => s - t.amount, 0);
    const pct = Math.round((spent / b.monto) * 100);
    return { ...b, spent, pct, level: pct >= 100 ? 'pasado' : pct >= 80 ? 'cerca' : 'ok' };
  });
}

// Cuánto sobró en promedio al mes (lo que entró menos lo que salió), en los últimos meses completos.
export function monthlySurplus(txs, today, n = 3) {
  let ym = monthKey(today); const vals = [];
  for (let i = 0; i < n; i++) {
    ym = prevMonth(ym);
    const ms = txs.filter((t) => !t.internal && monthKey(t.date) === ym);
    if (ms.length) vals.push(ms.reduce((s, t) => s + t.amount, 0));
  }
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
}
// Meta de ahorro: cuánto hay que guardar al mes, si el aporte alcanza y si lo que sobra cada mes
// y la proyección de saldo lo permiten.
export function goalStatus(goal, txs, today, projection) {
  const left = Math.max(0, goal.monto - (goal.ahorrado || 0));
  const days = diffDays(today, goal.fecha);
  // Meses de calendario que quedan: del 15 de octubre al 15 de febrero son 4.
  const [y1, m1, d1] = today.split('-').map(Number), [y2, m2, d2] = goal.fecha.split('-').map(Number);
  const months = Math.max(1, (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0));
  const needed = Math.ceil(left / months / 100) * 100;
  const surplus = monthlySurplus(txs, today);
  const withPlan = (goal.aporte || 0) * months;
  const pct = Math.min(100, Math.round(((goal.ahorrado || 0) / goal.monto) * 100));
  if (left === 0) return { left, months, needed: 0, surplus, pct, state: 'ok', text: 'Ya juntaste lo que necesitabas.' };
  if (days < 0) return { left, months, needed, surplus, pct, state: 'mal', text: `La fecha ya pasó y te faltan ${fmt(left)}.` };
  const parts = [`Te faltan ${fmt(left)}: son ${fmt(needed)} al mes por ${months} ${months === 1 ? 'mes' : 'meses'}.`];
  if (goal.aporte) parts.push(withPlan >= left ? `Con tu aporte de ${fmt(goal.aporte)} al mes llegas a tiempo.` : `Con ${fmt(goal.aporte)} al mes juntarías ${fmt(withPlan)}; te faltarían ${fmt(left - withPlan)}.`);
  if (surplus === null) parts.push('Aún no tenemos un mes completo para saber cuánto te sobra.');
  else if (surplus >= needed) parts.push(`En los últimos meses te sobraron en promedio ${fmt(surplus)} al mes, así que te alcanza.`);
  else if (surplus > 0) parts.push(`En los últimos meses te sobraron en promedio ${fmt(surplus)} al mes, menos de lo que necesitas.`);
  else parts.push('En los últimos meses salió más plata de la que entró, así que hoy no te sobra para esta meta.');
  if (projection && projection.alert) parts.push(`Ojo: tu proyección muestra que podrías bajar de tu mínimo la semana del ${shortDate(projection.alert.start)}.`);
  const ok = (!goal.aporte || withPlan >= left) && surplus !== null && surplus >= needed && !(projection && projection.alert);
  return { left, months, needed, surplus, pct, state: ok ? 'ok' : surplus !== null && surplus > 0 ? 'justo' : 'mal', text: parts.join(' ') };
}

// Recordatorios: los pagos fijos que se cobran en los próximos días ("en 3 días se cobra X").
export function nextCharges(rec, fromIso, days = 7) {
  const out = [];
  for (const r of rec) {
    if (r.sign > 0) continue;
    for (let d = 0; d <= days; d++) {
      const date = addDays(fromIso, d);
      const lastDay = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0).getDate();
      if (Number(date.slice(8, 10)) === Math.min(r.day, lastDay)) { out.push({ date, inDays: d, name: r.name, amount: r.amount, change: r.change }); break; }
    }
  }
  return out.sort((a, b) => a.inDays - b.inDays);
}

// Reporte negocio vs. personal: un resumen por mes y los gastos del negocio por categoría.
export function businessReport(txs) {
  const months = [...new Set(txs.map((t) => monthKey(t.date)))].sort().reverse();
  const rows = months.map((ym) => monthSummary(txs, ym));
  const keys = ['ingreso_negocio', 'gasto_operacional', 'utilidad', 'ingreso_personal', 'gasto_personal'];
  const total = {}; for (const k of keys) total[k] = rows.reduce((s, r) => s + r[k], 0);
  const by = {};
  for (const t of txs) if (!t.internal && t.scope === 'negocio' && t.amount < 0) { const k = t.tag || 'otros'; by[k] = (by[k] || 0) - t.amount; }
  return { rows, total, businessByTag: Object.entries(by).map(([name, sum]) => ({ name, total: sum })).sort((a, b) => b.total - a.total) };
}

// exportar
export function toCSV(txs) {
  const head = 'fecha,cuenta,descripcion,monto,ambito,categoria,transferencia_interna';
  const esc = (v) => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v;
  return [head].concat(txs.map((t) => [t.date, t.accountName, t.description, t.amount, t.scope, t.category, t.internal ? 1 : 0].map(esc).join(','))).join('\n');
}
