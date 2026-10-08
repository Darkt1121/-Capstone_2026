// FinFlow – backend mínimo para conectar Fintoc.
// Sin dependencias: solo Node >= 20.6.  Uso: npm start
//
// Por qué existe: la llave secreta de Fintoc y el link_token (que equivale a las
// credenciales bancarias del usuario) NUNCA deben llegar al navegador.
// El navegador solo recibe movimientos ya convertidos al formato de FinFlow.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SECRET = process.env.FINTOC_SECRET_KEY || '';
const PUBLIC = process.env.FINTOC_PUBLIC_KEY || '';
const PORT = Number(process.env.PORT) || 3000;
const API = process.env.FINTOC_API_BASE || 'https://api.fintoc.com/v1';
const ENABLED = SECRET.startsWith('sk_') && PUBLIC.startsWith('pk_');

// ---------- sesiones y almacenamiento del link_token (solo servidor) ----------
const DATA_FILE = path.join(__dirname, 'data', 'links.json');
let links = {};
try { links = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { /* primera vez */ }
function persist() {
  try { fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true }); fs.writeFileSync(DATA_FILE, JSON.stringify(links), { mode: 0o600 }); } catch (e) { console.error('No se pudo guardar links.json', e.message); }
}
function getSid(req, res) {
  const m = /(?:^|;\s*)ff_sid=([a-f0-9]{32})/.exec(req.headers.cookie || '');
  if (m) return m[1];
  const sid = crypto.randomBytes(16).toString('hex');
  res.setHeader('Set-Cookie', `ff_sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000`);
  return sid;
}

// ---------- cliente Fintoc ----------
async function fintoc(method, route, { query, body } = {}) {
  const url = new URL(API + route);
  for (const [k, v] of Object.entries(query || {})) if (v !== undefined) url.searchParams.set(k, v);
  const r = await fetch(url, {
    method,
    headers: { Authorization: SECRET, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* no JSON */ }
  if (!r.ok) {
    const msg = (json && json.error && json.error.message) || `Fintoc respondió ${r.status}`;
    const err = new Error(msg); err.status = r.status; throw err;
  }
  return json;
}

// ---------- conversión Fintoc -> formato interno de FinFlow ----------
// Fila FinFlow: { date: 'YYYY-MM-DD', description, amount (CLP entero, + abono / - cargo), balance: null, _line }
function toRow(m, i) {
  return {
    date: String(m.post_date).slice(0, 10),
    description: String(m.description || m.comment || 'Movimiento').replace(/\s+/g, ' ').trim(),
    amount: Math.round(Number(m.amount)),
    balance: null,
    _line: i,
  };
}
async function allMovements(accountId, linkToken, since) {
  const out = [];
  for (let page = 1; page <= 30; page++) {
    const batch = await fintoc('GET', `/accounts/${accountId}/movements`, { query: { link_token: linkToken, since, per_page: 300, page } });
    out.push(...batch);
    if (batch.length < 300) break;
  }
  // Fintoc entrega lo más nuevo primero; FinFlow espera orden cronológico estable.
  out.reverse();
  out.sort((a, b) => (a.post_date < b.post_date ? -1 : a.post_date > b.post_date ? 1 : 0));
  return out;
}

// ---------- rutas ----------
const routes = {
  'GET /api/fintoc/config': async () => ({ enabled: ENABLED }),

  // 1) Crea el Link Intent y entrega solo el widget_token + llave pública.
  'POST /api/fintoc/link-intent': async () => {
    const li = await fintoc('POST', '/link_intents', { body: { country: 'cl', holder_type: 'individual', product: 'movements' } });
    return { widgetToken: li.widget_token, publicKey: PUBLIC };
  },

  // 2) Cambia el exchange_token por el link_token y lo guarda en el servidor.
  'POST /api/fintoc/exchange': async (req, res, sid, body) => {
    if (!body.exchangeToken) throw Object.assign(new Error('Falta exchangeToken.'), { status: 400 });
    const link = await fintoc('GET', '/links/exchange', { query: { exchange_token: body.exchangeToken } });
    links[sid] = { linkToken: link.link_token, institution: (link.institution && link.institution.name) || 'Banco de Chile', at: Date.now() };
    persist();
    return { ok: true };
  },

  // 3) Trae cuentas y movimientos y los entrega listos para FinFlow.
  'GET /api/fintoc/movements': async (req, res, sid, body, url) => {
    const rec = links[sid];
    if (!rec) throw Object.assign(new Error('Aún no has conectado tu banco.'), { status: 401 });
    const since = url.searchParams.get('since') || new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
    const accounts = await fintoc('GET', '/accounts', { query: { link_token: rec.linkToken } });
    const result = [];
    for (const a of accounts) {
      if (String(a.currency).toUpperCase() !== 'CLP') continue; // FinFlow trabaja en pesos
      const movs = await allMovements(a.id, rec.linkToken, since);
      result.push({
        id: 'fintoc_' + a.id,
        name: a.name || a.official_name || 'Cuenta',
        bank: rec.institution,
        balance: a.balance && typeof a.balance.current === 'number' ? a.balance.current : null,
        rows: movs.map(toRow),
      });
    }
    return { accounts: result };
  },

  // Desvincula (borra el link_token guardado en el servidor).
  'DELETE /api/fintoc/link': async (req, res, sid) => { delete links[sid]; persist(); return { ok: true }; },
};

const INDEX = path.join(__dirname, 'public', 'index.html');
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const send = (code, obj, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(typeof obj === 'string' ? obj : JSON.stringify(obj)); };
  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) return send(200, fs.readFileSync(INDEX, 'utf8'), 'text/html');
    const handler = routes[`${req.method} ${url.pathname}`];
    if (!handler) return send(404, { error: 'No encontrado' });
    if (!ENABLED && url.pathname !== '/api/fintoc/config') return send(503, { error: 'El servidor no tiene llaves de Fintoc configuradas (.env).' });
    let body = {};
    if (req.method === 'POST') {
      let raw = ''; for await (const c of req) { raw += c; if (raw.length > 10_000) return send(413, { error: 'Solicitud demasiado grande' }); }
      try { body = raw ? JSON.parse(raw) : {}; } catch { return send(400, { error: 'JSON inválido' }); }
    }
    const sid = getSid(req, res);
    send(200, await handler(req, res, sid, body, url));
  } catch (e) {
    console.error(`[${req.method} ${url.pathname}]`, e.message);
    send(e.status && e.status < 500 ? e.status : 502, { error: e.message });
  }
});
server.listen(PORT, () => console.log(`FinFlow en http://localhost:${PORT}  ·  Fintoc ${ENABLED ? 'activo' : 'SIN llaves (modo cartolas)'}`));
