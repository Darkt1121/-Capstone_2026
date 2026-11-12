/* Clasificación: reglas fijas, reglas del usuario, comercio y categorías. */
import { TRANSFER } from './traspasos.js';
import { strip, titleCase } from './util.js';

// clasificación
export const RULES = [
  // [regex sobre la glosa, ámbito, motivo]
  [/ARRIENDO DEPTO|ARRIENDO CASA|DIVIDENDO/, 'personal', 'arriendo de vivienda'],
  [/LIDER|JUMBO|SANTA ?ISABEL|UNIMARC|TOTTUS|ACUENTA/, 'personal', 'supermercado'],
  [/ZARA|FALABELLA|RIPLEY|PARIS|SODIMAC|EASY|H&M|MERCADO ?LIBRE/, 'personal', 'tiendas'],
  [/APPLE.COM|YOUTUBE|PRIME VIDEO/, 'personal', 'suscripciones digitales'],
  [/FARMACIA|CRUZ VERDE|SALCOBRAND|AHUMADA/, 'personal', 'farmacia'],
  [/NETFLIX|SPOTIFY|DISNEY|HBO|CINEMARK|CINEPLANET/, 'personal', 'entretención'],
  [/PEDIDOSYA|RAPPI|UBER EATS|RESTAUR/, 'personal', 'comida'],
  [/MOVISTAR|ENTEL|CLARO|WOM|ENEL|AGUAS|METROGAS|CGE/, 'personal', 'servicios del hogar'],
  [/\bUBER\b|DIDI|CABIFY/, 'personal', 'transporte'],
  [/ADOBE|CANVA|FIGMA|NOTION|HOSTING|DOMINIO/, 'negocio', 'herramienta de trabajo'],
  [/COWORK/, 'negocio', 'espacio de trabajo'],
  [/LINK DE PAGO|COBRO|BOLETA|HONORARIO/, 'negocio', 'cobro a cliente'],
  [/\bSII\b|TESORERIA|IMPOSICION/, 'negocio', 'impuestos'],
];
export const COMPANY = /\b(SPA|LTDA|LIMITADA|EIRL|S\.?A\.?)\b/;

// Clave de contraparte para las reglas personales: glosa sin números ni prefijos.
export function counterpartyKey(description) {
  return strip(description)
    .replace(/^(PAGO EN|PAGO|COMPRA|PAC|TRANSF(ERENCIA)?( RECIBIDA| ENVIADA)? (DE|A)|COBRO)\s+/, '')
    .replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
}

// Comercio: saca el nombre desde la glosa ("PAGO JUMBO LAS CONDES 123" -> "Jumbo").
// "key" es el pedazo de la glosa que lo identifica; sirve para crear una regla.
export const COMERCIOS = [
  [/PAGO DE TARJETA DE CREDITO|PAGO TARJETA/, 'Pago de tarjeta de crédito'], [/SANTA ?ISABEL/, 'Santa Isabel'], [/\bJUMBO\b/, 'Jumbo'], [/\bLIDER\b/, 'Líder'],
  [/UNIMARC/, 'Unimarc'], [/TOTTUS/, 'Tottus'], [/ACUENTA/, 'aCuenta'], [/UBER ?EATS/, 'Uber Eats'], [/\bUBER\b/, 'Uber'], [/\bDIDI\b/, 'DiDi'],
  [/CABIFY/, 'Cabify'], [/NETFLIX/, 'Netflix'], [/SPOTIFY/, 'Spotify'], [/DISNEY/, 'Disney+'], [/APPLE\.COM|\bAPPLE\b/, 'Apple'],
  [/ADOBE/, 'Adobe'], [/ZARA/, 'Zara'], [/SODIMAC/, 'Sodimac'], [/FALABELLA/, 'Falabella'], [/RIPLEY/, 'Ripley'], [/MERCADO ?LIBRE/, 'Mercado Libre'],
  [/PEDIDOS ?YA/, 'PedidosYa'], [/RAPPI/, 'Rappi'], [/MC ?DONALD/, "McDonald's"], [/STARBUCKS/, 'Starbucks'], [/COPEC/, 'Copec'], [/CRUZ VERDE/, 'Cruz Verde'],
  [/SALCOBRAND/, 'Salcobrand'], [/AHUMADA/, 'Farmacias Ahumada'], [/\bENEL\b/, 'Enel'], [/AGUAS ANDINAS/, 'Aguas Andinas'], [/METROGAS/, 'Metrogas'],
  [/\bCLARO\b/, 'Claro'], [/ENTEL/, 'Entel'], [/MOVISTAR/, 'Movistar'], [/\bWOM\b/, 'WOM'], [/CINEMARK/, 'Cinemark'], [/CINEPLANET/, 'Cineplanet'],
];
export function merchant(description) {
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
export function personKey(description) { return strip(merchant(description).name).split(' ').slice(0, 3).join(' '); }

export function classify(tx, userRules, customRules) {
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

export function category(scope, amount) {
  if (scope === 'negocio') return amount >= 0 ? 'ingreso_negocio' : 'gasto_operacional';
  return amount >= 0 ? 'ingreso_personal' : 'gasto_personal';
}

export const CATEGORIAS = [...new Set(RULES.map((r) => r[2]).concat(['transferencias a personas', 'pago de tarjeta de crédito']))];
