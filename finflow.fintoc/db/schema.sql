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
