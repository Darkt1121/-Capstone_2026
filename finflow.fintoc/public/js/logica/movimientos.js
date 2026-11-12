/* Arma la lista de movimientos de todas las cuentas y une cartolas sin repetir. */
import { merchant, personKey, classify, category } from './clasificacion.js';
import { markInternal, markDuplicates } from './traspasos.js';
import { strip } from './util.js';

// armado de movimientos
export function buildTransactions(accounts, holderName, userRules, customRules) {
  const txs = [];
  for (const acc of accounts) {
    for (const r of acc.rows) {
      txs.push({ id: `${acc.id}:${r.date}:${r._line}`, account: acc.id, accountName: acc.name, ...r });
    }
  }
  txs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a._line - b._line));
  const manual = (userRules && userRules.__internal) || {};
  const porPersona = (userRules && userRules.__internalKey) || {};
  for (const t of txs) {
    if (manual[t.id] !== undefined) t.manualInternal = manual[t.id];
    else if (porPersona[personKey(t.description)] !== undefined) t.manualInternal = porPersona[personKey(t.description)];
  }
  markInternal(txs, holderName);
  markDuplicates(txs, (userRules && userRules.__dup) || {});
  for (const t of txs) {
    Object.assign(t, classify(t, userRules, customRules));
    t.comercio = merchant(t.description).name;
    const one = userRules && userRules.__tx && userRules.__tx[t.id];
    if (one) Object.assign(t, { scope: one, reason: 'corregido por ti', source: 'user', review: false });
    if (t.dupOf) t.review = true;
    if (t.internal) t.review = false;
    t.category = category(t.scope, t.amount);
  }
  return txs;
}

// Une filas nuevas a una cuenta, sin duplicados (misma fecha, glosa, monto y orden en el día).
export function mergeRows(existing, incoming) {
  const key = (r, n) => `${r.date}|${strip(r.description)}|${r.amount}|${n}`;
  const count = {};
  const keys = new Set(existing.map((r) => { const b = `${r.date}|${strip(r.description)}|${r.amount}`; count[b] = (count[b] || 0) + 1; return key(r, count[b]); }));
  const seen = {};
  const added = [];
  let maxLine = existing.reduce((m, r) => Math.max(m, r._line), -1);
  for (const r of incoming) {
    const b = `${r.date}|${strip(r.description)}|${r.amount}`;
    seen[b] = (seen[b] || 0) + 1;
    if (!keys.has(key(r, seen[b]))) added.push({ ...r, _line: ++maxLine });
  }
  const rows = existing.concat(added).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a._line - b._line));
  return { rows, added: added.length, duplicates: incoming.length - added.length };
}
