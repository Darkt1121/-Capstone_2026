/* Traspasos entre cuentas propias y posibles movimientos repetidos. */
import { strip, diffDays } from './util.js';

// transferencias internas
export function holderTokens(name) { return strip(name).split(/\s+/).filter((t) => t.length >= 3); }
export const TRANSFER = /TRASP|TRANSF|TEF/;

// ¿La glosa nombra al titular? Tiene que estar su nombre de pila y al menos otra palabra de su
// nombre. Con solo los apellidos no basta: un familiar puede tener los mismos dos apellidos.
export const palabra = (g, w) => new RegExp('(^|[^A-Z])' + w + '([^A-Z]|$)').test(g);
export const PROPIA = /\bMI CUENTA\b|CUENTA PROPIA|ENTRE MIS CUENTAS/;
export function markInternal(txs, holderName) {
  const holder = holderTokens(holderName);
  const nombraTitular = (g) => holder.length > 0 && palabra(g, holder[0]) && holder.filter((h) => palabra(g, h)).length >= Math.min(2, holder.length);
  const algoDelTitular = (g) => PROPIA.test(g) || holder.some((h) => palabra(g, h));
  for (const t of txs) {
    if (t.manualInternal !== undefined) { t.internal = t.manualInternal; continue; }
    t.internal = false;
    const g = strip(t.description);
    if (TRANSFER.test(g) && PROPIA.test(g)) { t.internal = true; t.internalReason = 'dice que es una cuenta tuya'; }
    else if (TRANSFER.test(g) && nombraTitular(g)) { t.internal = true; t.internalReason = 'el titular eres tú'; }
  }
  // Entre cuentas: mismo monto (signo opuesto), cuentas distintas, ±1 día. Las dos glosas tienen que
  // mencionar algo tuyo; si una nombra solo a otra persona, es plata de esa persona, no un traspaso.
  const open = txs.filter((t) => !t.internal && t.manualInternal === undefined && TRANSFER.test(strip(t.description)) && algoDelTitular(strip(t.description)));
  for (const a of open) {
    if (a.internal || a.amount >= 0) continue;
    const b = open.find((x) => !x.internal && x !== a && x.account !== a.account && x.amount === -a.amount && Math.abs(diffDays(a.date, x.date)) <= 1);
    if (b) { a.internal = b.internal = true; a.internalReason = b.internalReason = 'el mismo monto llegó a tu otra cuenta'; }
  }
  return txs;
}

// Posibles duplicados: mismo monto y signo, ±1 día y en otra cuenta (por ejemplo, el mismo banco
// subido por cartola y conectado con Fintoc). Si el usuario elige "juntar", el segundo deja de contar.
export function markDuplicates(txs, decisions) {
  const libres = txs.filter((t) => !t.internal && Math.abs(t.amount) >= 1000);
  const usados = new Set();
  for (const a of libres) {
    if (usados.has(a.id)) continue;
    const b = libres.find((x) => x !== a && !usados.has(x.id) && x.account !== a.account && x.amount === a.amount && Math.abs(diffDays(a.date, x.date)) <= 1);
    if (!b) continue;
    usados.add(a.id); usados.add(b.id);
    const d = decisions[b.id];
    if (d === 'mantener') continue;
    if (d === 'juntar') { b.internal = true; b.dup = 'juntado'; b.dupName = a.accountName; b.internalReason = 'repetido: ya está en ' + a.accountName; continue; }
    b.dupOf = a.id; b.dupName = a.accountName; b.dupDate = a.date;
  }
  return txs;
}
