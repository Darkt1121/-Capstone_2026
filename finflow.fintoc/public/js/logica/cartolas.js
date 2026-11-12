/* Lectura de cartolas: CSV y Excel (por columnas) y PDF de BancoEstado y MACHBANK. */
import { strip } from './util.js';

// lectura CSV
export function splitLine(line, delim) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { q = !q; continue; }
    if (c === delim && !q) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

export function parseAmount(text) {
  let s = String(text || '').replace(/\$/g, '').replace(/\s/g, '');
  if (!s) return 0;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');
  const n = Number(s);
  if (Number.isNaN(n)) throw new Error('Monto no reconocido: "' + text + '"');
  return Math.round(n);
}

export function parseDate(text) {
  const s = String(text || '').trim();
  let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  throw new Error('Fecha no reconocida: "' + text + '"');
}

export const COLS = {
  date: /^(FECHA|FECHA OPERACION|FECHA MOVIMIENTO|DATE)$/,
  desc: /^(DESCRIPCION|DETALLE|GLOSA|CONCEPTO|DESCRIPCION MOVIMIENTO|DETALLE DE TRANSACCION)$/,
  debit: /^(CARGO|CARGOS|DEBITO|DEBITOS|MONTO CARGOS)$/,
  credit: /^(ABONO|ABONOS|DEPOSITO|DEPOSITOS|CREDITO|CREDITOS|MONTO ABONOS)$/,
  amount: /^(MONTO|IMPORTE|AMOUNT)$/,
  balance: /^(SALDO|SALDO DISPONIBLE|BALANCE)$/,
};

// Lee una cartola CSV. Devuelve filas en orden cronológico y el resultado de la validación de saldo.
export function parseStatement(text) {
  const lines = String(text).replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error('El archivo no tiene movimientos.');
  const delim = (lines[0].split(';').length >= lines[0].split(',').length) ? ';' : ',';
  const header = splitLine(lines[0], delim).map(strip);
  const idx = {};
  for (const [key, re] of Object.entries(COLS)) idx[key] = header.findIndex((h) => re.test(h));
  if (idx.date < 0 || idx.desc < 0 || (idx.amount < 0 && idx.debit < 0 && idx.credit < 0)) {
    const e = new Error('No reconocemos las columnas de esta cartola. Necesitamos fecha, descripción y monto.');
    e.code = 'unknown_format';
    throw e;
  }
  const rows = lines.slice(1).map((line, i) => {
    const c = splitLine(line, delim);
    const amount = idx.amount >= 0
      ? parseAmount(c[idx.amount])
      : parseAmount(c[idx.credit]) - Math.abs(parseAmount(c[idx.debit]));
    return {
      date: parseDate(c[idx.date]),
      description: (c[idx.desc] || '').replace(/\s+/g, ' ').trim(),
      amount,
      balance: idx.balance >= 0 && c[idx.balance] ? parseAmount(c[idx.balance]) : null,
      _line: i,
    };
  });
  // Orden cronológico estable (algunos bancos exportan del más nuevo al más antiguo).
  if (rows.length > 1 && rows[0].date > rows[rows.length - 1].date) rows.reverse();
  let check = null;
  if (rows[0].balance !== null && rows[rows.length - 1].balance !== null) {
    const opening = rows[0].balance - rows[0].amount;
    const computed = opening + rows.reduce((s, r) => s + r.amount, 0);
    check = { opening, closing: rows[rows.length - 1].balance, ok: computed === rows[rows.length - 1].balance };
  }
  return { rows, check, delimiter: delim };
}

// Lee el texto de una cartola en PDF de BancoEstado o de MACHBANK (las páginas vienen separadas por \f).
// El texto no dice si un monto entra o sale, porque se pierde la columna.
// Se deduce con el saldo: si sube es un ingreso y si baja es un gasto.
export const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
export function parsePdfStatement(text) {
  const paginas = String(text).split('\f').map((p) => p.replace(/\s+/g, ' '));
  const todo = paginas.join(' ');
  const dato = (re, n) => { const m = todo.match(re); return m ? m[n || 1] : null; };
  const crudos = []; // cada movimiento: su fecha y el resto del texto (descripción y montos)
  let bank, anterior, final, cantidad = null, sobra;
  if (/MACHBANK/i.test(todo)) {
    // MACHBANK: "04/09/2026 Transferencia a Johan CLP $30.000 $5.048". El encabezado se repite en cada página.
    bank = 'MACH'; sobra = /(\s[\d.,]+)?\s[A-Z]{3}\s*(?=\$)/;
    // Los cuatro números que van justo antes de la tabla: saldo inicial, ingresos, egresos y saldo final.
    const totales = /Saldo inicial del.*?\s(-?[\d.]+)\s+[\d.]+\s+[\d.]+\s+(-?[\d.]+)\s+Fecha/i;
    anterior = dato(totales, 1); final = dato(totales, 2);
    for (const pagina of paginas) {
      const p = (pagina.split(/Egreso\s+Ingreso\s+Saldo/i)[1] || '').split(/Informaci[oó]n general/i)[0].split(/(\d{2})\/(\d{2})\/(\d{4})\s/);
      for (let i = 1; i < p.length; i += 4) crudos.push({ date: p[i + 2] + '-' + p[i + 1] + '-' + p[i], resto: p[i + 3] });
    }
  } else {
    // BancoEstado: "06/Jul 8047148 TEF DE ... $5.000 $280.000". La fecha viene sin año; sale de "Fecha Inicio".
    bank = 'BancoEstado CuentaRUT'; sobra = /Fecha N°.*$/i;
    const inicio = dato(/Fecha Inicio\s*(\d{2}\/\d{2}\/\d{4})/i);
    anterior = dato(/Saldo Anterior\s*\$?\s*(-?[\d.]+)/i);
    final = dato(/Saldo Final\s*\$?\s*(-?[\d.]+)/i);
    cantidad = dato(/N° de Movimientos\s*(\d+)/i);
    let anio = inicio ? Number(inicio.slice(6)) : 0, mesAnterior = inicio ? Number(inicio.slice(3, 5)) : 0;
    for (const pagina of inicio ? paginas : []) {
      const p = pagina.split(/Subtotales/i)[0].split(/(\d{2})\/\s*(Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic)\s+(\d{4,12})\s/i);
      for (let i = 1; i < p.length; i += 4) {
        const mes = MESES.indexOf(p[i + 1].toUpperCase()) + 1;
        if (mes < mesAnterior) anio++; // la cartola pasó de diciembre a enero
        mesAnterior = mes;
        crudos.push({ date: anio + '-' + String(mes).padStart(2, '0') + '-' + p[i], resto: p[i + 3] });
      }
    }
  }
  if (!crudos.length || anterior === null) {
    const e = new Error('No reconocemos este PDF. Por ahora leemos las cartolas en PDF de BancoEstado y MACHBANK; de otros bancos, sube el Excel o CSV.');
    e.code = 'unknown_format';
    throw e;
  }
  const opening = parseAmount(anterior);
  let saldo = opening, cuadra = true;
  const rows = crudos.map((c, i) => {
    const montos = c.resto.match(/\$\s*-?[\d.]+/g) || [];
    if (montos.length < 2) throw new Error('No pudimos leer el movimiento del ' + c.date.split('-').reverse().join('/') + ' en el PDF.');
    const monto = parseAmount(montos[0]), nuevo = parseAmount(montos[montos.length - 1]);
    if (Math.abs(nuevo - saldo) !== monto) cuadra = false;
    const amount = nuevo < saldo ? -monto : monto;
    saldo = nuevo;
    return { date: c.date, description: c.resto.replace(sobra, ' ').replace(/\$\s*-?[\d.]+/g, ' ').replace(/\s+/g, ' ').trim(), amount, balance: nuevo, _line: i };
  });
  const ok = cuadra && (final === null || parseAmount(final) === saldo) && (cantidad === null || Number(cantidad) === rows.length);
  return { rows, check: { opening, closing: saldo, ok }, bank };
}
