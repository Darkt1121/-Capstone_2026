# FinFlow

Página para trabajadores independientes: junta los movimientos de tus cuentas, separa lo del
negocio de lo personal y proyecta tu saldo a 4 semanas para avisarte antes de quedar corto.

Los movimientos entran de dos formas:
- subiendo la cartola del banco (Excel o CSV), o
- conectando el banco con Fintoc en modo solo lectura (nunca se pide la clave del banco).

## Cómo correrlo
1. Instala Node 20.6 o superior (`node -v`) y Docker Desktop.
2. Copia `.env.example` como `.env` e inventa una contraseña para la base de datos
   (`POSTGRES_PASSWORD`, y la misma dentro de `DATABASE_URL`).
3. `docker compose up -d db` enciende PostgreSQL (puerto 5433).
4. `npm install` instala `pg`, el conector de PostgreSQL. Es la única librería.
5. `npm start` y abre http://localhost:3000. Las tablas se crean solas la primera vez.

Opcional, en el `.env`:
- **Conectar un banco**: llaves de **modo prueba** de https://app.fintoc.com (`sk_test_...` y
  `pk_test_...`). Sin llaves la página funciona igual, solo con cartolas.
- **Entrar con Google**: `GOOGLE_CLIENT_ID` de https://console.cloud.google.com (cliente OAuth
  de tipo "Aplicación web", con origen autorizado `http://localhost:3000`).
- **Asistente**: `GROQ_API_KEY` de https://console.groq.com.

Para verla rápido sin crear cuenta, usa "Probar con datos de ejemplo".

## Qué tiene
- **Inicio**: saldo total, cuánto puedes gastar por día, alerta si vas a bajar de tu mínimo,
  resumen del mes, negocio vs. personal y gastos por categoría.
- **Movimientos**: lista con buscador y filtros. Cada movimiento dice por qué se clasificó así
  y se puede corregir; la corrección se aplica a los demás movimientos del mismo comercio.
- **Proyección**: saldo probable de las próximas 4 semanas, pagos fijos que vienen y tu mínimo.
- **Calendario**: cuánto gastaste cada día del mes.
- **Perfil**: cuentas conectadas, exportar los datos en CSV y borrar todo.
- **Asistente** (opcional): preguntas en español sobre tus números. Usa la API gratuita de Groq y
  solo recibe un resumen ya calculado, sin nombres de personas ni RUT. Se activa con `GROQ_API_KEY`.
- Modo claro y oscuro.

## Cómo está hecho
- `server.js`: servidor de Node. Entrega la página, maneja las cuentas y habla con la API de
  Fintoc. La llave secreta y el `link_token` se quedan en el servidor; al navegador solo llegan
  los movimientos ya convertidos.
- **Cuentas**: con correo y contraseña (se guarda solo el hash, hecho con `scrypt`) o con Google
  (el servidor comprueba con Google el token antes de aceptar). La sesión es una cookie
  `HttpOnly` y se guarda en la base de datos.
- `db/schema.sql`: las tablas de PostgreSQL (`usuarios`, `sesiones`, `ajustes`, `cuentas`,
  `movimientos` y `conexiones_bancarias`).
- `public/index.html`: toda la página. Diseño con Bootstrap 5.3. La lógica (leer cartolas,
  clasificar, detectar traspasos entre cuentas propias y proyectar) corre en el navegador. Con
  sesión iniciada, los datos se guardan en la base de datos.

```
Navegador --(widget de Fintoc)--> Fintoc
   | exchange_token
   v
server.js --(llave secreta + link_token)--> api.fintoc.com
   | movimientos {fecha, descripción, monto}
   v
index.html -> clasificación -> resumen, proyección y calendario
```

## Pendiente
- Llaves `live` de Fintoc (requiere aprobación) y HTTPS.
- Pruebas automáticas y el Dockerfile de la página.
