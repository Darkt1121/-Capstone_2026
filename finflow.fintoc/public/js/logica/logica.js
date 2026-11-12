/* Lógica de FinFlow (corre en el navegador).
   Importación de cartolas CSV, clasificación Negocio/Personal con reglas y motivo,
   transferencias internas, resumen del mes y proyección a 4 semanas. */
(function (root) {
  'use strict';

  // utilidades
  const strip = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  const DAY = 86400000;
  const toDate = (iso) => new Date(iso + 'T12:00:00');
  const iso = (d) => d.toISOString().slice(0, 10);
  const addDays = (isoStr, n) => iso(new Date(toDate(isoStr).getTime() + n * DAY));
  const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / DAY);

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // lectura CSV
  function splitLine(line, delim) {
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

  function parseAmount(text) {
    let s = String(text || '').replace(/\$/g, '').replace(/\s/g, '');
    if (!s) return 0;
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');
    const n = Number(s);
    if (Number.isNaN(n)) throw new Error('Monto no reconocido: "' + text + '"');
    return Math.round(n);
  }

  function parseDate(text) {
    const s = String(text || '').trim();
    let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    throw new Error('Fecha no reconocida: "' + text + '"');
  }

  const COLS = {
    date: /^(FECHA|FECHA OPERACION|FECHA MOVIMIENTO|DATE)$/,
    desc: /^(DESCRIPCION|DETALLE|GLOSA|CONCEPTO|DESCRIPCION MOVIMIENTO|DETALLE DE TRANSACCION)$/,
    debit: /^(CARGO|CARGOS|DEBITO|DEBITOS|MONTO CARGOS)$/,
    credit: /^(ABONO|ABONOS|DEPOSITO|DEPOSITOS|CREDITO|CREDITOS|MONTO ABONOS)$/,
    amount: /^(MONTO|IMPORTE|AMOUNT)$/,
    balance: /^(SALDO|SALDO DISPONIBLE|BALANCE)$/,
  };

  // Lee una cartola CSV. Devuelve filas en orden cronológico y el resultado de la validación de saldo.
  function parseStatement(text) {
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
  const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  function parsePdfStatement(text) {
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

  // clasificación
  const RULES = [
    // [regex sobre la glosa, ámbito, motivo]
    [/ARRIENDO DEPTO|ARRIENDO CASA|DIVIDENDO/, 'personal', 'arriendo de vivienda'],
    [/LIDER|JUMBO|SANTA ?ISABEL|UNIMARC|TOTTUS|ACUENTA/, 'personal', 'supermercado'],
    [/ZARA|FALABELLA|RIPLEY|PARIS|SODIMAC|EASY|H&M|MERCADO ?LIBRE/, 'personal', 'tiendas'],
    [/APPLE.COM|GOOGLE PLAY|YOUTUBE|PRIME VIDEO/, 'personal', 'suscripciones digitales'],
    [/FARMACIA|CRUZ VERDE|SALCOBRAND|AHUMADA/, 'personal', 'farmacia'],
    [/NETFLIX|SPOTIFY|DISNEY|HBO|CINEMARK|CINEPLANET/, 'personal', 'entretención'],
    [/PEDIDOSYA|RAPPI|UBER EATS|RESTAUR/, 'personal', 'comida'],
    [/MOVISTAR|ENTEL|CLARO|WOM|ENEL|AGUAS|METROGAS|CGE/, 'personal', 'servicios del hogar'],
    [/\bUBER\b|DIDI|CABIFY/, 'personal', 'transporte'],
    [/ADOBE|CANVA|FIGMA|NOTION|GOOGLE WORKSPACE|HOSTING|DOMINIO/, 'negocio', 'herramienta de trabajo'],
    [/COWORK/, 'negocio', 'espacio de trabajo'],
    [/LINK DE PAGO|COBRO|BOLETA|HONORARIO/, 'negocio', 'cobro a cliente'],
    [/\bSII\b|TESORERIA|IMPOSICION/, 'negocio', 'impuestos'],
  ];
  const COMPANY = /\b(SPA|LTDA|LIMITADA|EIRL|S\.?A\.?)\b/;

  // Clave de contraparte para las reglas personales: glosa sin números ni prefijos.
  function counterpartyKey(description) {
    return strip(description)
      .replace(/^(PAGO EN|PAGO|COMPRA|PAC|TRANSF(ERENCIA)?( RECIBIDA| ENVIADA)? (DE|A)|COBRO)\s+/, '')
      .replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
  }

  // Comercio: saca el nombre desde la glosa ("PAGO JUMBO LAS CONDES 123" -> "Jumbo").
  // "key" es el pedazo de la glosa que lo identifica; sirve para crear una regla.
  const COMERCIOS = [
    [/PAGO DE TARJETA DE CREDITO|PAGO TARJETA/, 'Pago de tarjeta de crédito'], [/SANTA ?ISABEL/, 'Santa Isabel'], [/\bJUMBO\b/, 'Jumbo'], [/\bLIDER\b/, 'Líder'],
    [/UNIMARC/, 'Unimarc'], [/TOTTUS/, 'Tottus'], [/ACUENTA/, 'aCuenta'], [/UBER ?EATS/, 'Uber Eats'], [/\bUBER\b/, 'Uber'], [/\bDIDI\b/, 'DiDi'],
    [/CABIFY/, 'Cabify'], [/NETFLIX/, 'Netflix'], [/SPOTIFY/, 'Spotify'], [/DISNEY/, 'Disney+'], [/APPLE\.COM|\bAPPLE\b/, 'Apple'], [/GOOGLE/, 'Google'],
    [/ADOBE/, 'Adobe'], [/ZARA/, 'Zara'], [/SODIMAC/, 'Sodimac'], [/FALABELLA/, 'Falabella'], [/RIPLEY/, 'Ripley'], [/MERCADO ?LIBRE/, 'Mercado Libre'],
    [/PEDIDOS ?YA/, 'PedidosYa'], [/RAPPI/, 'Rappi'], [/MC ?DONALD/, "McDonald's"], [/STARBUCKS/, 'Starbucks'], [/COPEC/, 'Copec'], [/CRUZ VERDE/, 'Cruz Verde'],
    [/SALCOBRAND/, 'Salcobrand'], [/AHUMADA/, 'Farmacias Ahumada'], [/\bENEL\b/, 'Enel'], [/AGUAS ANDINAS/, 'Aguas Andinas'], [/METROGAS/, 'Metrogas'],
    [/\bCLARO\b/, 'Claro'], [/ENTEL/, 'Entel'], [/MOVISTAR/, 'Movistar'], [/\bWOM\b/, 'WOM'], [/CINEMARK/, 'Cinemark'], [/CINEPLANET/, 'Cineplanet'],
  ];
  function merchant(description) {
    const g = strip(description);
    for (const [re, name] of COMERCIOS) { const m = g.match(re); if (m) return { name, key: m[0] }; }
    let s = g.replace(/^(TEF|TRANSF(ERENCIA)?( RECIBIDA| ENVIADA)?|PAGO (ENVIADO|RECIBIDO))\s*(-\s*)?((A|DE|DESDE)\s+)?/, '')
      .replace(/^(COMPRA CON TARJETA (VIRTUAL|FISICA)|COMPRA( EN)?|PAGO( EN| DE)?|PAC|COBRO|CARGO)\s*(-\s*)?/, '')
      .replace(/^(PAYU|MERPAGO|MP|DLO|SUMUP|TUU|GETNET)\s*\*\s*/, '')
      .split(' - ')[0]
      .replace(/\s(PLAZA|MALL|LAS CONDES|PROVIDENCIA|SANTIAGO|STGO|NUNOA|MAIPU|VITACURA|LA FLORIDA|PUENTE ALTO)\b.*$/, '')
      .replace(/[*#]/g, ' ').replace(/(\s\d+)+$/, '').replace(/\s+/g, ' ').trim();
    if (!s) s = g;
    const words = s.split(' ').slice(0, 4).join(' ');
    return { name: titleCase(words), key: g.includes(words) ? words : counterpartyKey(description) };
  }

  // Clave de la contraparte para las marcas que el usuario aplica "a todos": 3 primeras palabras del nombre.
  function personKey(description) { return strip(merchant(description).name).split(' ').slice(0, 3).join(' '); }

  function classify(tx, userRules, customRules) {
    const key = counterpartyKey(tx.description);
    const g0 = strip(tx.description);
    const propia = (customRules || []).find((r) => r.texto && g0.includes(strip(r.texto)));
    if (userRules && typeof userRules[key] === 'string') { const r = RULES.find(([re]) => re.test(strip(tx.description))); return { scope: userRules[key], tag: propia ? propia.categoria : r ? r[2] : undefined, reason: 'tu corrección anterior', source: 'user', review: false }; }
    if (propia) return { scope: propia.ambito, tag: propia.categoria, reason: `tu regla: dice "${propia.texto}"`, source: 'regla', review: false };
    const g = strip(tx.description);
    for (const [re, scope, why] of RULES) {
      const m = g.match(re);
      if (m) return { scope, tag: why, reason: `por la glosa: ${m[0].trim()} (${why})`, source: 'rule', review: false };
    }
    if (tx.amount > 0 && COMPANY.test(g)) return { scope: 'negocio', reason: 'te pagó una empresa', source: 'rule', review: false };
    if (tx.amount < 0 && /PAGO (DE )?TARJETA/.test(g)) return { scope: 'personal', tag: 'pago de tarjeta de crédito', reason: 'pago de tu tarjeta de crédito', source: 'rule', review: false };
    if (tx.amount < 0 && (TRANSFER.test(g) || /PAGO ENVIADO/.test(g)) && !COMPANY.test(g)) return { scope: 'personal', tag: 'transferencias a personas', reason: 'transferencia a una persona', source: 'rule', review: true };
    if (tx.amount > 0 && /TRANSF/.test(g)) return { scope: 'personal', reason: 'transferencia de una persona', source: 'rule', review: true };
    return { scope: 'personal', reason: 'sin coincidencias: revísalo', source: 'rule', review: true };
  }

  function category(scope, amount) {
    if (scope === 'negocio') return amount >= 0 ? 'ingreso_negocio' : 'gasto_operacional';
    return amount >= 0 ? 'ingreso_personal' : 'gasto_personal';
  }

  // transferencias internas
  function holderTokens(name) { return strip(name).split(/\s+/).filter((t) => t.length >= 3); }
  const TRANSFER = /TRASP|TRANSF|TEF/;

  // ¿La glosa nombra al titular? Tiene que estar su nombre de pila y al menos otra palabra de su
  // nombre. Con solo los apellidos no basta: un familiar puede tener los mismos dos apellidos.
  const palabra = (g, w) => new RegExp('(^|[^A-Z])' + w + '([^A-Z]|$)').test(g);
  const PROPIA = /\bMI CUENTA\b|CUENTA PROPIA|ENTRE MIS CUENTAS/;
  function markInternal(txs, holderName) {
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
  function markDuplicates(txs, decisions) {
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

  // armado de movimientos
  function buildTransactions(accounts, holderName, userRules, customRules) {
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
  function mergeRows(existing, incoming) {
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

  // resumen
  function monthKey(isoStr) { return isoStr.slice(0, 7); }

  function monthSummary(txs, ym) {
    const s = { ym, ingreso_negocio: 0, gasto_operacional: 0, ingreso_personal: 0, gasto_personal: 0, internal: 0, internalCount: 0 };
    for (const t of txs) {
      if (monthKey(t.date) !== ym) continue;
      if (t.internal) { if (t.amount > 0 && !t.dup) { s.internal += t.amount; s.internalCount++; } continue; }
      s[t.category] += Math.abs(t.amount);
    }
    s.utilidad = s.ingreso_negocio - s.gasto_operacional;
    return s;
  }

  function balances(accounts) {
    return accounts.map((a) => {
      const last = a.rows[a.rows.length - 1];
      const opening = a.rows[0].balance !== null ? a.rows[0].balance - a.rows[0].amount : 0;
      const bal = last && last.balance !== null ? last.balance : opening + a.rows.reduce((s, r) => s + r.amount, 0);
      return { id: a.id, name: a.name, balance: bal, lastDate: last ? last.date : null };
    });
  }

  // proyección
  // Detecta movimientos que se repiten cada mes (≥3 meses, monto parecido, día parecido).
  function recurring(txs) {
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

  function quantile(sorted, q) {
    const pos = (sorted.length - 1) * q; const lo = Math.floor(pos); const hi = Math.ceil(pos);
    return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo));
  }

  // Proyección a 4 semanas: saldo de hoy + movimientos fijos en su fecha + el resto proyectado por semana.
  // Para el rango se repite el cálculo 200 veces con la variación real de la historia.
  function project(txs, startBalance, today, minimum, opts = {}) {
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

  // formato de montos y nombres de meses
  const fmt = (n) => '$' + Math.round(Math.abs(n)).toLocaleString('es-CL');
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const monthName = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1];
  const prevMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; };

  function titleCase(s) { return s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()).replace(/\b(Spa|Ltda|Eirl)\b/g, (x) => x.toUpperCase()); }
  function shortDate(isoStr) { const d = toDate(isoStr); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; }

  // Presupuestos: cuánto va gastado en el mes en cada categoría con tope. Aviso al 80 % y al 100 %.
  function budgetStatus(budgets, txs, ym) {
    return (budgets || []).map((b) => {
      const spent = txs.filter((t) => !t.internal && t.amount < 0 && monthKey(t.date) === ym && (t.tag || 'otros') === b.categoria).reduce((s, t) => s - t.amount, 0);
      const pct = Math.round((spent / b.monto) * 100);
      return { ...b, spent, pct, level: pct >= 100 ? 'pasado' : pct >= 80 ? 'cerca' : 'ok' };
    });
  }

  // Cuánto sobró en promedio al mes (lo que entró menos lo que salió), en los últimos meses completos.
  function monthlySurplus(txs, today, n = 3) {
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
  function goalStatus(goal, txs, today, projection) {
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
  function nextCharges(rec, fromIso, days = 7) {
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
  function businessReport(txs) {
    const months = [...new Set(txs.map((t) => monthKey(t.date)))].sort().reverse();
    const rows = months.map((ym) => monthSummary(txs, ym));
    const keys = ['ingreso_negocio', 'gasto_operacional', 'utilidad', 'ingreso_personal', 'gasto_personal'];
    const total = {}; for (const k of keys) total[k] = rows.reduce((s, r) => s + r[k], 0);
    const by = {};
    for (const t of txs) if (!t.internal && t.scope === 'negocio' && t.amount < 0) { const k = t.tag || 'otros'; by[k] = (by[k] || 0) - t.amount; }
    return { rows, total, businessByTag: Object.entries(by).map(([name, sum]) => ({ name, total: sum })).sort((a, b) => b.total - a.total) };
  }

  // exportar
  function toCSV(txs) {
    const head = 'fecha,cuenta,descripcion,monto,ambito,categoria,transferencia_interna';
    const esc = (v) => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v;
    return [head].concat(txs.map((t) => [t.date, t.accountName, t.description, t.amount, t.scope, t.category, t.internal ? 1 : 0].map(esc).join(','))).join('\n');
  }

  const CATEGORIAS = [...new Set(RULES.map((r) => r[2]).concat(['transferencias a personas', 'pago de tarjeta de crédito']))];
  root.FF = { CATEGORIAS, merchant, personKey, markDuplicates, budgetStatus, goalStatus, monthlySurplus, nextCharges, businessReport, parseStatement, parsePdfStatement, parseAmount, parseDate, mergeRows, buildTransactions, classify, counterpartyKey, category, markInternal, monthSummary, balances, recurring, project, toCSV, fmt, monthName, prevMonth, shortDate, titleCase, addDays, diffDays, monthKey };
})(typeof window !== 'undefined' ? window : globalThis);

// En Node (pruebas) también se puede usar: const FF = require('./logica.js');
if (typeof module === 'object' && module.exports) module.exports = (typeof window !== 'undefined' ? window : globalThis).FF;
