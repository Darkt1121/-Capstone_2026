// FinFlow – servidor: cuentas de usuario, conexión con Fintoc y asistente.
// Node >= 20.6 y PostgreSQL (docker compose up -d db).  Uso: npm start
//
// Por qué existe: la llave secreta de Fintoc y el link_token (que equivale a las
// credenciales bancarias del usuario) NUNCA deben llegar al navegador.
// El navegador solo recibe movimientos ya convertidos al formato de FinFlow.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { Pool } = require('pg');

const SECRET = process.env.FINTOC_SECRET_KEY || '';
const PUBLIC = process.env.FINTOC_PUBLIC_KEY || '';
const PORT = Number(process.env.PORT) || 3000;
const API = process.env.FINTOC_API_BASE || 'https://api.fintoc.com/v1';
const ENABLED = SECRET.startsWith('sk_') && PUBLIC.startsWith('pk_');
const GROQ_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const GOOGLE_ID = process.env.GOOGLE_CLIENT_ID || '';

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const fallo = (status, mensaje) => Object.assign(new Error(mensaje), { status });

// contraseñas: se guarda "sal:hash" hecho con scrypt, nunca la contraseña
const scrypt = promisify(crypto.scrypt);
async function hashClave(clave, sal = crypto.randomBytes(16).toString('hex')) {
  return sal + ':' + (await scrypt(clave, sal, 64)).toString('hex');
}
async function claveCorrecta(clave, guardada) {
  const calculada = await hashClave(clave, guardada.split(':')[0]);
  return crypto.timingSafeEqual(Buffer.from(calculada), Buffer.from(guardada));
}

// sesiones: al entrar se crea un identificador nuevo (no se reutiliza la cookie que había antes)
async function iniciarSesion(res, sidViejo, usuario) {
  const sid = crypto.randomBytes(16).toString('hex');
  await db.query("INSERT INTO sesiones (id, usuario_id, expira) VALUES ($1, $2, now() + interval '30 days')", [sid, usuario.id]);
  await db.query('DELETE FROM sesiones WHERE id = $1 OR expira < now()', [sidViejo]);
  if (links[sidViejo]) { links[sid] = links[sidViejo]; delete links[sidViejo]; persist(); }
  res.setHeader('Set-Cookie', `ff_sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${30 * 86400}`);
  return { usuario: { email: usuario.email, nombre: usuario.nombre } };
}
async function usuarioDe(sid) {
  const r = await db.query('SELECT u.id, u.email, u.nombre FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id WHERE s.id = $1 AND s.expira > now()', [sid]);
  return r.rows[0] || null;
}

// sesiones y almacenamiento del link_token (solo servidor)
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

// cliente Fintoc
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

// conversión Fintoc -> formato interno de FinFlow
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

// rutas
const routes = {
  'GET /api/fintoc/config': async () => ({ enabled: ENABLED, asistente: !!GROQ_KEY, googleClientId: GOOGLE_ID }),

  // Inicio de sesión con Google. El navegador manda el token que le dio Google y acá se
  // comprueba con Google que sea auténtico y que haya sido emitido para esta app.
  'POST /api/login/google': async (req, res, sid, body) => {
    if (!GOOGLE_ID) throw Object.assign(new Error('El inicio de sesión con Google no está configurado.'), { status: 503 });
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(String(body.credential || '')));
    const g = await r.json().catch(() => null);
    if (!r.ok || !g || g.aud !== GOOGLE_ID || g.email_verified !== 'true') throw fallo(401, 'No pudimos comprobar tu cuenta de Google.');
    let u = (await db.query('SELECT id, email, nombre FROM usuarios WHERE google_id = $1', [g.sub])).rows[0];
    if (!u) u = (await db.query('INSERT INTO usuarios (email, nombre, google_id) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING RETURNING id, email, nombre', [g.email.toLowerCase(), g.name || g.email, g.sub])).rows[0];
    if (!u) throw fallo(409, 'Ya tienes una cuenta con ese correo. Entra con tu contraseña.');
    return iniciarSesion(res, sid, u);
  },

  // Cuenta con correo y contraseña.
  'POST /api/registro': async (req, res, sid, body) => {
    const email = String(body.email || '').trim().toLowerCase();
    const nombre = String(body.nombre || '').trim().slice(0, 80);
    const clave = String(body.clave || '');
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fallo(400, 'Escribe un correo válido.');
    if (!nombre) throw fallo(400, 'Escribe tu nombre.');
    if (clave.length < 8 || clave.length > 200) throw fallo(400, 'La contraseña debe tener al menos 8 caracteres.');
    const r = await db.query('INSERT INTO usuarios (email, nombre, clave_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING RETURNING id, email, nombre', [email, nombre, await hashClave(clave)]);
    if (!r.rows[0]) throw fallo(409, 'Ya existe una cuenta con ese correo.');
    return iniciarSesion(res, sid, r.rows[0]);
  },
  'POST /api/login': async (req, res, sid, body) => {
    const email = String(body.email || '').trim().toLowerCase();
    const u = (await db.query('SELECT id, email, nombre, clave_hash FROM usuarios WHERE email = $1', [email])).rows[0];
    if (!u || !u.clave_hash || !(await claveCorrecta(String(body.clave || '').slice(0, 200), u.clave_hash))) throw fallo(401, 'Correo o contraseña incorrectos.');
    return iniciarSesion(res, sid, u);
  },
  'GET /api/sesion': async (req, res, sid) => {
    const u = await usuarioDe(sid);
    return { usuario: u && { email: u.email, nombre: u.nombre } };
  },
  'POST /api/logout': async (req, res, sid) => { await db.query('DELETE FROM sesiones WHERE id = $1', [sid]); return { ok: true }; },

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

  // Asistente. La llave de Groq se queda en el servidor. El navegador manda la pregunta y un
  // resumen ya calculado (totales, sin nombres de personas ni RUT); el modelo solo redacta.
  'POST /api/asistente': async (req, res, sid, body) => {
    if (!GROQ_KEY) throw Object.assign(new Error('El asistente no está configurado.'), { status: 503 });
    const pregunta = String(body.pregunta || '').trim().slice(0, 300);
    if (!pregunta) throw Object.assign(new Error('Escribe una pregunta.'), { status: 400 });
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.2,
        max_completion_tokens: 700,
        messages: [
          { role: 'system', content: 'Eres el asistente de FinFlow, una app de finanzas para trabajadores independientes en Chile. Responde en español, en 4 frases como máximo y sin listas. Usa solo los datos que vienen en el mensaje; si la respuesta no está ahí, di que no tienes ese dato. Escribe los montos en pesos chilenos con punto de miles (por ejemplo $120.000). No recomiendes inversiones ni créditos.' },
          { role: 'user', content: 'Datos del usuario (JSON):\n' + JSON.stringify(body.resumen || {}) + '\n\nPregunta: ' + pregunta },
        ],
      }),
    });
    const j = await r.json().catch(() => null);
    if (r.status === 429) throw Object.assign(new Error('El asistente llegó a su límite gratuito. Prueba en un rato.'), { status: 429 });
    const texto = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!r.ok || !texto) throw new Error((j && j.error && j.error.message) || 'El asistente no respondió.');
    return { respuesta: texto.trim() };
  },
};

const INDEX = path.join(__dirname, 'public', 'index.html');
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const send = (code, obj, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(typeof obj === 'string' ? obj : JSON.stringify(obj)); };
  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) return send(200, fs.readFileSync(INDEX, 'utf8'), 'text/html');
    const handler = routes[`${req.method} ${url.pathname}`];
    if (!handler) return send(404, { error: 'No encontrado' });
    if (!ENABLED && url.pathname.startsWith('/api/fintoc/') && url.pathname !== '/api/fintoc/config') return send(503, { error: 'El servidor no tiene llaves de Fintoc configuradas (.env).' });
    let body = {};
    if (req.method === 'POST') {
      let raw = ''; for await (const c of req) { raw += c; if (raw.length > 20_000) return send(413, { error: 'Solicitud demasiado grande' }); }
      try { body = raw ? JSON.parse(raw) : {}; } catch { return send(400, { error: 'JSON inválido' }); }
    }
    const sid = getSid(req, res);
    send(200, await handler(req, res, sid, body, url));
  } catch (e) {
    console.error(`[${req.method} ${url.pathname}]`, e.message);
    send(e.status && e.status < 500 ? e.status : 502, { error: e.message });
  }
});
// Crea las tablas si faltan y recién entonces empieza a atender.
db.query(fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8')).then(() => server.listen(PORT, () => console.log(`FinFlow en http://localhost:${PORT}  ·  Fintoc ${ENABLED ? 'activo' : 'sin llaves (solo cartolas)'}  ·  Asistente ${GROQ_KEY ? 'activo' : 'sin llave'}`)))
  .catch((e) => { console.error('No se pudo conectar a la base de datos. ¿Está encendida? (docker compose up -d db)\n' + e.message); process.exit(1); });
