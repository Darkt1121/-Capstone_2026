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
// Los montos son pesos enteros. Rechaza lo que no sea un número o no quepa en la base de datos.
function entero(valor) {
  const n = Math.round(Number(valor));
  if (!Number.isFinite(n) || Math.abs(n) > 2_000_000_000) throw fallo(400, 'Hay un monto inválido.');
  return n;
}

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
  res.setHeader('Set-Cookie', `ff_sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${30 * 86400}`);
  return { usuario: { email: usuario.email, nombre: usuario.nombre } };
}
async function usuarioDe(sid) {
  const r = await db.query('SELECT u.id, u.email, u.nombre FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id WHERE s.id = $1 AND s.expira > now()', [sid]);
  return r.rows[0] || null;
}

// Para las rutas que solo puede usar alguien que inició sesión.
async function exigirUsuario(sid) {
  const u = await usuarioDe(sid);
  if (!u) throw fallo(401, 'Inicia sesión para continuar.');
  return u;
}
function getSid(req, res) {
  const m = /(?:^|;\s*)ff_sid=([a-f0-9]{32})/.exec(req.headers.cookie || '');
  if (m) return m[1];
  const sid = crypto.randomBytes(16).toString('hex');
  res.setHeader('Set-Cookie', `ff_sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000`);
  return sid;
}

// Límite de intentos de contraseña: 5 claves malas para el mismo correo desde la misma dirección
// lo bloquean por 15 minutos. Se lleva en memoria; al reiniciar el servidor parte de cero.
const MAX_INTENTOS = 5;
const intentos = new Map(); // "correo|dirección" -> { n: fallos, hasta: cuándo se olvida }
function anotarFallo(llave) {
  const ahora = Date.now();
  if (intentos.size > 10000) for (const [k, v] of intentos) if (v.hasta < ahora) intentos.delete(k);
  const i = intentos.get(llave);
  if (i && i.hasta > ahora) i.n++; else intentos.set(llave, { n: 1, hasta: ahora + 15 * 60 * 1000 });
}

// Reemplaza todas las filas de un usuario en una tabla, en una transacción.
// "tabla" y "columnas" vienen siempre escritas en el código, nunca del navegador.
async function reemplazar(usuarioId, tabla, columnas, filas) {
  const cliente = await db.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query(`DELETE FROM ${tabla} WHERE usuario_id = $1`, [usuarioId]);
    const marcas = columnas.map((c, i) => '$' + (i + 2)).join(', ');
    for (const f of filas) await cliente.query(`INSERT INTO ${tabla} (usuario_id, ${columnas.join(', ')}) VALUES ($1, ${marcas})`, [usuarioId, ...f]);
    await cliente.query('COMMIT');
  } catch (e) { await cliente.query('ROLLBACK'); throw e; } finally { cliente.release(); }
}
function lista(body, maximo) {
  if (!Array.isArray(body.lista)) throw fallo(400, 'Falta la lista.');
  if (body.lista.length > maximo) throw fallo(400, `Puedes guardar hasta ${maximo}.`);
  return body.lista.map((x) => x || {});
}
const MAX_BOLETA = 2 * 1024 * 1024;
function tipoDeArchivo(b) {
  if (b.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  return null;
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
  'GET /api/fintoc/config': async () => ({ enabled: ENABLED, asistente: !!GROQ_KEY, googleClientId: GOOGLE_ID, contacto: process.env.CONTACT_EMAIL || '' }),

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
    const llave = email + '|' + req.socket.remoteAddress;
    const previo = intentos.get(llave);
    if (previo && previo.hasta > Date.now() && previo.n >= MAX_INTENTOS) throw fallo(429, 'Demasiados intentos. Espera unos minutos y vuelve a probar.');
    const u = (await db.query('SELECT id, email, nombre, clave_hash FROM usuarios WHERE email = $1', [email])).rows[0];
    if (!u || !u.clave_hash || !(await claveCorrecta(String(body.clave || '').slice(0, 200), u.clave_hash))) {
      anotarFallo(llave);
      throw fallo(401, 'Correo o contraseña incorrectos.');
    }
    intentos.delete(llave);
    return iniciarSesion(res, sid, u);
  },
  'GET /api/sesion': async (req, res, sid) => {
    const u = await usuarioDe(sid);
    return { usuario: u && { email: u.email, nombre: u.nombre } };
  },
  'POST /api/logout': async (req, res, sid) => { await db.query('DELETE FROM sesiones WHERE id = $1', [sid]); return { ok: true }; },
  // Borra al usuario. Sus sesiones, cuentas, movimientos y ajustes se van con él (ON DELETE CASCADE).
  'DELETE /api/usuario': async (req, res, sid) => {
    const u = await exigirUsuario(sid);
    await db.query('DELETE FROM usuarios WHERE id = $1', [u.id]);
    return { ok: true };
  },

  // Datos del usuario, en el mismo formato que usa la página.
  'GET /api/datos': async (req, res, sid) => {
    const u = await exigirUsuario(sid);
    const a = (await db.query(`SELECT titular, consentimiento, saldo_minimo, correcciones, politica_version, to_char(consentimiento_fecha AT TIME ZONE 'America/Santiago', 'DD/MM/YYYY') AS fecha FROM ajustes WHERE usuario_id = $1`, [u.id])).rows[0];
    const filas = (await db.query(
      `SELECT c.clave, c.nombre, c.banco, c.origen, m.linea, to_char(m.fecha, 'YYYY-MM-DD') AS fecha, m.descripcion, m.monto, m.saldo
       FROM cuentas c JOIN movimientos m ON m.cuenta_id = c.id
       WHERE c.usuario_id = $1 ORDER BY c.id, m.orden`, [u.id])).rows;
    const cuentas = new Map();
    for (const f of filas) {
      if (!cuentas.has(f.clave)) cuentas.set(f.clave, { id: f.clave, name: f.nombre, bank: f.banco, source: f.origen, rows: [] });
      cuentas.get(f.clave).rows.push({ date: f.fecha, description: f.descripcion, amount: f.monto, balance: f.saldo, _line: f.linea });
    }
    const reglas = (await db.query('SELECT texto, categoria, ambito FROM reglas WHERE usuario_id = $1 ORDER BY id', [u.id])).rows;
    const presupuestos = (await db.query('SELECT categoria, monto FROM presupuestos WHERE usuario_id = $1 ORDER BY categoria', [u.id])).rows;
    const metas = (await db.query(`SELECT nombre, monto, to_char(fecha, 'YYYY-MM-DD') AS fecha, aporte, ahorrado FROM metas WHERE usuario_id = $1 ORDER BY id`, [u.id])).rows;
    const boletas = (await db.query('SELECT id, movimiento, nombre, tipo, length(datos) AS tamano FROM boletas WHERE usuario_id = $1', [u.id])).rows;
    const notificaciones = (await db.query('SELECT clave, nivel, titulo, texto, creada, leida, borrada FROM notificaciones WHERE usuario_id = $1 ORDER BY creada DESC LIMIT 300', [u.id])).rows;
    return { holder: a ? a.titular : '', consent: a ? a.consentimiento : false, policy: a ? a.politica_version : null, consentDate: a ? a.fecha : null, minimum: a ? a.saldo_minimo : null, rules: a ? a.correcciones : null, accounts: [...cuentas.values()], reglas, presupuestos, metas, boletas, notificaciones };
  },

  // Notificaciones. La página calcula los avisos y manda los nuevos; si la clave ya existe (aunque
  // esté borrada) no se vuelve a crear.
  'POST /api/notificaciones': async (req, res, sid, body) => {
    const u = await exigirUsuario(sid);
    const nuevas = [];
    for (const n of lista(body, 50)) {
      const clave = String(n.clave || '').slice(0, 200);
      if (!clave) continue;
      const r = (await db.query(
        `INSERT INTO notificaciones (usuario_id, clave, nivel, titulo, texto) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (usuario_id, clave) DO NOTHING RETURNING clave, creada`,
        [u.id, clave, ['info', 'warning', 'danger'].includes(n.nivel) ? n.nivel : 'info', String(n.titulo || '').slice(0, 200), String(n.texto || '').slice(0, 500)])).rows[0];
      if (r) nuevas.push(r);
    }
    // Se guardan las 300 más recientes.
    await db.query('DELETE FROM notificaciones WHERE usuario_id = $1 AND id NOT IN (SELECT id FROM notificaciones WHERE usuario_id = $1 ORDER BY creada DESC LIMIT 300)', [u.id]);
    return { nuevas };
  },
  'PUT /api/notificaciones/leidas': async (req, res, sid) => {
    const u = await exigirUsuario(sid);
    await db.query('UPDATE notificaciones SET leida = true WHERE usuario_id = $1 AND NOT leida', [u.id]);
    return { ok: true };
  },
  // Borrar: la notificación queda marcada como borrada para que no vuelva a aparecer.
  'DELETE /api/notificaciones': async (req, res, sid, body, url) => {
    const u = await exigirUsuario(sid);
    if (url.searchParams.get('todas') === '1') await db.query('UPDATE notificaciones SET borrada = true WHERE usuario_id = $1', [u.id]);
    else await db.query('UPDATE notificaciones SET borrada = true WHERE usuario_id = $1 AND clave = $2', [u.id, String(url.searchParams.get('clave') || '')]);
    return { ok: true };
  },

  // Reglas, presupuestos y metas: la página manda la lista completa y se reemplaza la anterior.
  'PUT /api/reglas': async (req, res, sid, body) => {
    const u = await exigirUsuario(sid);
    const filas = lista(body, 200).map((r) => {
      const texto = String(r.texto || '').trim().toUpperCase().slice(0, 60);
      const categoria = String(r.categoria || '').trim().toLowerCase().slice(0, 40);
      if (texto.length < 2 || !categoria) throw fallo(400, 'Cada regla necesita un texto de al menos 2 letras y una categoría.');
      return [texto, categoria, r.ambito === 'negocio' ? 'negocio' : 'personal'];
    });
    if (new Set(filas.map((f) => f[0])).size !== filas.length) throw fallo(400, 'Hay dos reglas con el mismo texto.');
    await reemplazar(u.id, 'reglas', ['texto', 'categoria', 'ambito'], filas);
    return { ok: true };
  },
  'PUT /api/presupuestos': async (req, res, sid, body) => {
    const u = await exigirUsuario(sid);
    const filas = lista(body, 50).map((p) => {
      const categoria = String(p.categoria || '').trim().toLowerCase().slice(0, 40);
      const monto = entero(p.monto);
      if (!categoria || monto <= 0) throw fallo(400, 'Cada presupuesto necesita una categoría y un monto mayor que cero.');
      return [categoria, monto];
    });
    if (new Set(filas.map((f) => f[0])).size !== filas.length) throw fallo(400, 'Hay dos presupuestos para la misma categoría.');
    await reemplazar(u.id, 'presupuestos', ['categoria', 'monto'], filas);
    return { ok: true };
  },
  'PUT /api/metas': async (req, res, sid, body) => {
    const u = await exigirUsuario(sid);
    const filas = lista(body, 20).map((m) => {
      const nombre = String(m.nombre || '').trim().slice(0, 60);
      const fecha = String(m.fecha || '');
      const monto = entero(m.monto), aporte = entero(m.aporte), ahorrado = entero(m.ahorrado);
      if (!nombre || monto <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || aporte < 0 || ahorrado < 0) throw fallo(400, 'Revisa la meta: necesita nombre, monto, fecha y montos que no sean negativos.');
      return [nombre, monto, fecha, aporte, ahorrado];
    });
    await reemplazar(u.id, 'metas', ['nombre', 'monto', 'fecha', 'aporte', 'ahorrado'], filas);
    return { ok: true };
  },

  // Boletas. Llegan en base64; el tipo se decide por los primeros bytes del archivo, no por su nombre.
  'POST /api/boletas': async (req, res, sid, body) => {
    const u = await exigirUsuario(sid);
    const movimiento = String(body.movimiento || '').slice(0, 200);
    const datos = Buffer.from(String(body.datos || ''), 'base64');
    if (!movimiento) throw fallo(400, 'Falta el movimiento.');
    if (!datos.length || datos.length > MAX_BOLETA) throw fallo(400, 'La boleta debe pesar menos de 2 MB.');
    const tipo = tipoDeArchivo(datos);
    if (!tipo) throw fallo(400, 'La boleta debe ser un PDF, JPG o PNG.');
    const total = (await db.query('SELECT count(*)::int AS n FROM boletas WHERE usuario_id = $1 AND movimiento <> $2', [u.id, movimiento])).rows[0].n;
    if (total >= 300) throw fallo(400, 'Llegaste al máximo de 300 boletas.');
    const nombre = String(body.nombre || 'boleta').replace(/[^\w.\- áéíóúñÁÉÍÓÚÑ]/g, '').slice(0, 80) || 'boleta';
    const r = (await db.query(
      `INSERT INTO boletas (usuario_id, movimiento, nombre, tipo, datos) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (usuario_id, movimiento) DO UPDATE SET nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo, datos = EXCLUDED.datos, creado = now()
       RETURNING id, movimiento, nombre, tipo, length(datos) AS tamano`, [u.id, movimiento, nombre, tipo, datos])).rows[0];
    return r;
  },
  'GET /api/boletas/archivo': async (req, res, sid, body, url) => {
    const u = await exigirUsuario(sid);
    const b = (await db.query('SELECT nombre, tipo, datos FROM boletas WHERE usuario_id = $1 AND id = $2', [u.id, entero(url.searchParams.get('id'))])).rows[0];
    if (!b) throw fallo(404, 'No encontramos esa boleta.');
    res.writeHead(200, { 'Content-Type': b.tipo, 'Content-Length': b.datos.length, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `inline; filename="${encodeURIComponent(b.nombre)}"` });
    res.end(b.datos);
  },
  'DELETE /api/boletas': async (req, res, sid, body, url) => {
    const u = await exigirUsuario(sid);
    await db.query('DELETE FROM boletas WHERE usuario_id = $1 AND id = $2', [u.id, entero(url.searchParams.get('id'))]);
    return { ok: true };
  },
  // Guarda los ajustes. Del consentimiento queda la prueba: qué versión de la política aceptó y cuándo.
  // La fecha la pone el servidor, y solo cambia cuando acepta por primera vez o acepta una versión nueva.
  'PUT /api/ajustes': async (req, res, sid, body) => {
    const u = await exigirUsuario(sid);
    const acepta = body.consent === true;
    await db.query(
      `INSERT INTO ajustes (usuario_id, titular, consentimiento, saldo_minimo, correcciones, politica_version, consentimiento_fecha)
       VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $3 THEN now() END)
       ON CONFLICT (usuario_id) DO UPDATE SET titular = EXCLUDED.titular, consentimiento = EXCLUDED.consentimiento,
         saldo_minimo = EXCLUDED.saldo_minimo, correcciones = EXCLUDED.correcciones, politica_version = EXCLUDED.politica_version,
         consentimiento_fecha = CASE WHEN NOT EXCLUDED.consentimiento THEN NULL
                                     WHEN ajustes.consentimiento AND ajustes.politica_version IS NOT DISTINCT FROM EXCLUDED.politica_version THEN ajustes.consentimiento_fecha
                                     ELSE now() END`,
      [u.id, String(body.holder || '').slice(0, 120), acepta, entero(body.minimum), JSON.stringify(body.rules || {}), acepta ? String(body.policy || '').slice(0, 20) : null]);
    return { ok: true };
  },
  // Guarda una cuenta con todos sus movimientos (reemplaza los que tenía). Va en una transacción:
  // o se guarda todo o no se guarda nada.
  'POST /api/cuentas': async (req, res, sid, body) => {
    const u = await exigirUsuario(sid);
    const clave = String(body.id || '').slice(0, 100);
    const filas = Array.isArray(body.rows) ? body.rows : [];
    if (!clave || !filas.length || filas.length > 20000) throw fallo(400, 'La cuenta no tiene movimientos válidos.');
    if (filas.some((f) => !f || !/^\d{4}-\d{2}-\d{2}$/.test(f.date))) throw fallo(400, 'Hay un movimiento con una fecha inválida.');
    const cliente = await db.connect();
    try {
      await cliente.query('BEGIN');
      const cuenta = (await cliente.query(
        `INSERT INTO cuentas (usuario_id, clave, nombre, banco, origen) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (usuario_id, clave) DO UPDATE SET nombre = EXCLUDED.nombre, banco = EXCLUDED.banco RETURNING id`,
        [u.id, clave, String(body.name || 'Cuenta').slice(0, 80), String(body.bank || '').slice(0, 80), body.source === 'fintoc' ? 'fintoc' : 'cartola'])).rows[0];
      const total = (await cliente.query('SELECT count(*)::int AS n FROM cuentas WHERE usuario_id = $1', [u.id])).rows[0].n;
      if (total > 3) throw fallo(400, 'Ya tienes 3 cuentas. Quita una para agregar otra.');
      await cliente.query('DELETE FROM movimientos WHERE cuenta_id = $1', [cuenta.id]);
      await cliente.query(
        `INSERT INTO movimientos (cuenta_id, orden, linea, fecha, descripcion, monto, saldo)
         SELECT $1, t.orden, t.linea, t.fecha, t.descripcion, t.monto, t.saldo
         FROM unnest($2::int[], $3::date[], $4::text[], $5::int[], $6::int[]) WITH ORDINALITY AS t(linea, fecha, descripcion, monto, saldo, orden)`,
        [cuenta.id, filas.map((f) => entero(f._line)), filas.map((f) => f.date), filas.map((f) => String(f.description || '').slice(0, 300)),
          filas.map((f) => entero(f.amount)), filas.map((f) => (f.balance === null || f.balance === undefined ? null : entero(f.balance)))]);
      await cliente.query('COMMIT');
    } catch (e) { await cliente.query('ROLLBACK'); throw e; } finally { cliente.release(); }
    return { ok: true };
  },
  'DELETE /api/cuentas': async (req, res, sid, body, url) => {
    const u = await exigirUsuario(sid);
    const clave = String(url.searchParams.get('id') || '');
    await db.query('DELETE FROM cuentas WHERE usuario_id = $1 AND clave = $2', [u.id, clave]);
    // Las boletas de esa cuenta se van con ella (su identificador parte con la clave de la cuenta).
    await db.query(`DELETE FROM boletas WHERE usuario_id = $1 AND left(movimiento, length($2) + 1) = $2 || ':'`, [u.id, clave]);
    return { ok: true };
  },

  // 1) Crea el Link Intent y entrega solo el widget_token + llave pública.
  'POST /api/fintoc/link-intent': async () => {
    const li = await fintoc('POST', '/link_intents', { body: { country: 'cl', holder_type: 'individual', product: 'movements' } });
    return { widgetToken: li.widget_token, publicKey: PUBLIC };
  },

  // 2) Cambia el exchange_token por el link_token y lo guarda en el servidor.
  'POST /api/fintoc/exchange': async (req, res, sid, body) => {
    const u = await exigirUsuario(sid);
    if (!body.exchangeToken) throw fallo(400, 'Falta exchangeToken.');
    const link = await fintoc('GET', '/links/exchange', { query: { exchange_token: body.exchangeToken } });
    await db.query(
      `INSERT INTO conexiones_bancarias (usuario_id, link_token, institucion) VALUES ($1, $2, $3)
       ON CONFLICT (usuario_id) DO UPDATE SET link_token = EXCLUDED.link_token, institucion = EXCLUDED.institucion, creado = now()`,
      [u.id, link.link_token, (link.institution && link.institution.name) || 'Banco']);
    return { ok: true };
  },

  // 3) Trae cuentas y movimientos y los entrega listos para FinFlow.
  'GET /api/fintoc/movements': async (req, res, sid, body, url) => {
    const u = await exigirUsuario(sid);
    const rec = (await db.query('SELECT link_token, institucion FROM conexiones_bancarias WHERE usuario_id = $1', [u.id])).rows[0];
    if (!rec) throw fallo(400, 'Aún no has conectado tu banco.');
    const since = url.searchParams.get('since') || new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
    const accounts = await fintoc('GET', '/accounts', { query: { link_token: rec.link_token } });
    const result = [];
    for (const a of accounts) {
      if (String(a.currency).toUpperCase() !== 'CLP') continue; // FinFlow trabaja en pesos
      const movs = await allMovements(a.id, rec.link_token, since);
      result.push({
        id: 'fintoc_' + a.id,
        name: a.name || a.official_name || 'Cuenta',
        bank: rec.institucion,
        balance: a.balance && typeof a.balance.current === 'number' ? a.balance.current : null,
        rows: movs.map(toRow),
      });
    }
    return { accounts: result };
  },

  // Desvincula (borra el link_token guardado en el servidor).
  'DELETE /api/fintoc/link': async (req, res, sid) => {
    const u = await exigirUsuario(sid);
    await db.query('DELETE FROM conexiones_bancarias WHERE usuario_id = $1', [u.id]);
    return { ok: true };
  },

  // Asistente. La llave de Groq se queda en el servidor. El navegador manda la pregunta y un
  // resumen ya calculado (totales, sin nombres de personas ni RUT); el modelo solo redacta.
  'POST /api/asistente': async (req, res, sid, body) => {
    if (!GROQ_KEY) throw Object.assign(new Error('El asistente no está configurado.'), { status: 503 });
    const pregunta = String(body.pregunta || '').trim().slice(0, 300);
    if (!pregunta) throw Object.assign(new Error('Escribe una pregunta.'), { status: 400 });
    // Lo conversado antes (hasta 6 mensajes), para que entienda preguntas como "¿y el mes pasado?".
    const historia = (Array.isArray(body.historia) ? body.historia : []).slice(-6)
      .filter((m) => m && typeof m.texto === 'string' && m.texto.trim())
      .map((m) => ({ role: m.rol === 'asistente' ? 'assistant' : 'user', content: m.texto.slice(0, 1500) }));
    // Si no hay conexión con Groq, se responde un mensaje claro en vez del error técnico.
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + GROQ_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.2,
        max_completion_tokens: 700,
        messages: [
          { role: 'system', content: 'Eres el asistente de FinFlow, una app de finanzas para trabajadores independientes en Chile. Responde en español, en 4 frases como máximo y sin listas. Puedes marcar el dato más importante con **negrita**. Usa solo los datos que vienen en el último mensaje; si la respuesta no está ahí, di que no tienes ese dato. Escribe los montos en pesos chilenos con punto de miles (por ejemplo $120.000). No recomiendes inversiones ni créditos.' },
          ...historia,
          { role: 'user', content: 'Datos del usuario (JSON):\n' + JSON.stringify(body.resumen || {}) + '\n\nPregunta: ' + pregunta },
        ],
      }),
    }).catch(() => { throw Object.assign(new Error('No pudimos conectar con el asistente. Revisa tu conexión e inténtalo de nuevo.'), { status: 503 }); });
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
    // Estilos y scripts de la página. Solo nombres simples dentro de public/css, public/js y sus
    // carpetas conocidas (sin ".."), así no se puede pedir ningún otro archivo del servidor.
    const css = /^\/css\/([a-z0-9-]+)\.css$/.exec(url.pathname);
    const js = /^\/js\/(?:(app|pantallas|graficos|logica)\/)?([a-z0-9-]+)\.js$/.exec(url.pathname);
    if (req.method === 'GET' && (css || js)) {
      const archivo = css ? path.join(__dirname, 'public', 'css', css[1] + '.css') : path.join(__dirname, 'public', 'js', js[1] || '', js[2] + '.js');
      if (!fs.existsSync(archivo)) return send(404, { error: 'No encontrado' });
      return send(200, fs.readFileSync(archivo, 'utf8'), css ? 'text/css' : 'text/javascript');
    }
    const handler = routes[`${req.method} ${url.pathname}`];
    if (!handler) return send(404, { error: 'No encontrado' });
    if (!ENABLED && url.pathname.startsWith('/api/fintoc/') && url.pathname !== '/api/fintoc/config') return send(503, { error: 'El servidor no tiene llaves de Fintoc configuradas (.env).' });
    let body = {};
    if (req.method === 'POST' || req.method === 'PUT') {
      // Una cuenta trae todos sus movimientos y una boleta viene en base64 (2 MB son unos 2,8 millones de letras).
      const maximo = url.pathname === '/api/cuentas' || url.pathname === '/api/boletas' ? 3_000_000 : 200_000;
      req.setEncoding('utf8'); // para que una tilde no se corte entre dos pedazos del mensaje
      let raw = ''; for await (const c of req) { raw += c; if (raw.length > maximo) return send(413, { error: 'Solicitud demasiado grande' }); }
      try { body = raw ? JSON.parse(raw) : {}; } catch { return send(400, { error: 'JSON inválido' }); }
    }
    const sid = getSid(req, res);
    const respuesta = await handler(req, res, sid, body, url);
    if (!res.headersSent) send(200, respuesta); // la ruta de la boleta ya respondió con el archivo
  } catch (e) {
    console.error(`[${req.method} ${url.pathname}]`, e.message);
    // Los errores de la base de datos no se muestran al usuario: pueden revelar cómo está hecha.
    if (e.severity) return send(500, { error: 'No pudimos guardar o leer tus datos. Inténtalo de nuevo.' });
    send(e.status && e.status < 500 ? e.status : 502, { error: e.message });
  }
});
// Crea las tablas si faltan y recién entonces empieza a atender.
db.query(fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8')).then(() => server.listen(PORT, () => console.log(`FinFlow en http://localhost:${PORT}  ·  Fintoc ${ENABLED ? 'activo' : 'sin llaves (solo cartolas)'}  ·  Asistente ${GROQ_KEY ? 'activo' : 'sin llave'}`)))
  .catch((e) => { console.error('No se pudo conectar a la base de datos. ¿Está encendida? (docker compose up -d db)\n' + e.message); process.exit(1); });
