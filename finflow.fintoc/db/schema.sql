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
