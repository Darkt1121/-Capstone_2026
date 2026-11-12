-- Tablas de FinFlow. El servidor corre este archivo al partir; como usa IF NOT EXISTS,
-- se puede correr muchas veces sin borrar nada.

CREATE TABLE IF NOT EXISTS usuarios (
  id          SERIAL PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,          -- siempre en minúsculas
  nombre      TEXT NOT NULL,
  google_id   TEXT UNIQUE,                   -- vacío si se registró con correo y contraseña
  clave_hash  TEXT,                          -- vacío si entra con Google. Nunca la contraseña en texto
  creado      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sesiones (
  id          TEXT PRIMARY KEY,              -- el valor de la cookie ff_sid
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira      TIMESTAMPTZ NOT NULL
);

-- Datos que el usuario configura una vez. "correcciones" guarda las categorías que corrigió a mano.
CREATE TABLE IF NOT EXISTS ajustes (
  usuario_id      INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  titular         TEXT NOT NULL DEFAULT '',       -- nombre como sale en sus cartolas
  consentimiento  BOOLEAN NOT NULL DEFAULT false,
  saldo_minimo    INTEGER NOT NULL DEFAULT 400000,
  correcciones    JSONB NOT NULL DEFAULT '{}'
);
-- Prueba del consentimiento: qué versión de la política de privacidad aceptó y cuándo.
ALTER TABLE ajustes ADD COLUMN IF NOT EXISTS politica_version      TEXT;
ALTER TABLE ajustes ADD COLUMN IF NOT EXISTS consentimiento_fecha  TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS cuentas (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  clave       TEXT NOT NULL,                      -- identificador que usa la página
  nombre      TEXT NOT NULL,
  banco       TEXT NOT NULL,
  origen      TEXT NOT NULL CHECK (origen IN ('cartola', 'fintoc')),
  UNIQUE (usuario_id, clave)
);

CREATE TABLE IF NOT EXISTS movimientos (
  id           BIGSERIAL PRIMARY KEY,
  cuenta_id    INTEGER NOT NULL REFERENCES cuentas(id) ON DELETE CASCADE,
  orden        INTEGER NOT NULL,                  -- posición dentro de la cuenta (cronológica)
  linea        INTEGER NOT NULL,                  -- número que identifica al movimiento en la cuenta
  fecha        DATE NOT NULL,
  descripcion  TEXT NOT NULL,
  monto        INTEGER NOT NULL,                  -- pesos; positivo es abono, negativo es cargo
  saldo        INTEGER,                           -- saldo después del movimiento, si la cartola lo trae
  UNIQUE (cuenta_id, linea)
);

-- Conexión con el banco a través de Fintoc. El link_token nunca sale del servidor.
CREATE TABLE IF NOT EXISTS conexiones_bancarias (
  usuario_id   INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
  link_token   TEXT NOT NULL,
  institucion  TEXT NOT NULL,
  creado       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reglas que escribe el usuario: si la descripción contiene "texto", el movimiento va a esa
-- categoría y ámbito. Se revisan antes que las reglas fijas de FinFlow.
CREATE TABLE IF NOT EXISTS reglas (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  texto       TEXT NOT NULL,                     -- en mayúsculas y sin tildes, ej. 'JUMBO'
  categoria   TEXT NOT NULL,                     -- ej. 'supermercado'
  ambito      TEXT NOT NULL CHECK (ambito IN ('negocio', 'personal')),
  UNIQUE (usuario_id, texto)
);

-- Tope de gasto mensual por categoría. La página avisa al 80 % y al 100 %.
CREATE TABLE IF NOT EXISTS presupuestos (
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  categoria   TEXT NOT NULL,
  monto       INTEGER NOT NULL CHECK (monto > 0),
  PRIMARY KEY (usuario_id, categoria)
);

-- Metas de ahorro. Se cruzan con la proyección para decir si el usuario llega a la fecha.
CREATE TABLE IF NOT EXISTS metas (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  monto       INTEGER NOT NULL CHECK (monto > 0),
  fecha       DATE NOT NULL,                     -- para cuándo la quiere
  aporte      INTEGER NOT NULL DEFAULT 0 CHECK (aporte >= 0),    -- cuánto piensa guardar al mes
  ahorrado    INTEGER NOT NULL DEFAULT 0 CHECK (ahorrado >= 0)   -- cuánto lleva
);

-- Boletas adjuntas a un movimiento (PDF, JPG o PNG de hasta 2 MB).
-- "movimiento" es el identificador que usa la página: cuenta:fecha:línea.
CREATE TABLE IF NOT EXISTS boletas (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  movimiento  TEXT NOT NULL,
  nombre      TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('application/pdf', 'image/jpeg', 'image/png')),
  datos       BYTEA NOT NULL,
  creado      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, movimiento)
);

-- Notificaciones que la página le mostró al usuario. "clave" identifica el aviso (por ejemplo
-- presupuesto:comida:2026-10:pasado) para no repetirlo; las borradas quedan marcadas y no vuelven.
CREATE TABLE IF NOT EXISTS notificaciones (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  clave       TEXT NOT NULL,
  nivel       TEXT NOT NULL CHECK (nivel IN ('info', 'warning', 'danger')),
  titulo      TEXT NOT NULL,
  texto       TEXT NOT NULL,
  creada      TIMESTAMPTZ NOT NULL DEFAULT now(),
  leida       BOOLEAN NOT NULL DEFAULT false,
  borrada     BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (usuario_id, clave)
);
