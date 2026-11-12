# FinFlow

Página para trabajadores independientes: junta los movimientos de tus cuentas, separa lo del
negocio de lo personal y proyecta tu saldo a 4 semanas para avisarte antes de quedar corto.

Los movimientos entran de dos formas:
- subiendo la cartola del banco (Excel, CSV o el PDF de BancoEstado o MACHBANK, aunque tenga clave), o
- conectando el banco con Fintoc en modo solo lectura (nunca se pide la clave del banco).

## Cómo correrlo
Necesitas Docker Desktop.

1. Copia `.env.example` como `.env`. Inventa una contraseña para la base de datos
   (`POSTGRES_PASSWORD`) y una clave secreta larga para Django (`DJANGO_SECRET_KEY`).
2. `docker compose up -d --build` enciende la base de datos y la página. Al partir, Django crea
   o actualiza las tablas solo (`python manage.py migrate`). En Windows también sirve
   `iniciar.bat` (doble clic).
3. Abre http://localhost:3000.

Para revisar los datos existe el panel de administración de Django en http://localhost:3000/admin
(se crea un usuario administrador con `docker compose exec web python manage.py createsuperuser`).

Opcional, en el `.env`:
- **Conectar un banco**: llaves de **modo prueba** de https://app.fintoc.com (`sk_test_...` y
  `pk_test_...`). Sin llaves la página funciona igual, solo con cartolas.
- **Correos** (confirmación de cuenta y recuperar contraseña): datos SMTP de Brevo en `EMAIL_HOST`,
  `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` y `EMAIL_FROM`. Sin ellos, los correos se ven en el registro del servidor.
- **Asistente**: `GROQ_API_KEY` de https://console.groq.com.
- **Contacto de la política de privacidad**: `CONTACT_EMAIL`.

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
- **Privacidad**: política de privacidad y consentimiento expreso, con la versión aceptada y la
  fecha guardadas. Límite de intentos de contraseña.
- **Plan**: presupuestos por categoría con aviso al 80 % y al 100 %, metas de ahorro que se
  comparan con lo que sobra cada mes y con la proyección, y reglas propias de categorías.
- **Reporte negocio vs. personal** por mes, descargable en PDF.
- **Próximos cobros**: recordatorio de los pagos fijos de los próximos 7 días, con aviso si un
  cobro fijo cambió de precio.
- **Comercio y boletas**: cada movimiento muestra el comercio ("PAGO JUMBO LAS CONDES 123" es
  "Jumbo") y se le puede adjuntar la boleta (PDF, JPG o PNG).
- **Posibles repetidos**: mismo monto, ±1 día y otra cuenta; el usuario decide si juntarlos.
- Modo claro y oscuro.

## Cómo está hecho
- **Servidor: Django 5.2** (Python). `config/` es la configuración y `core/` la app:
  `models.py` (tablas), `views.py` (rutas `/api`, con las mismas respuestas que usa la página) y
  `externos.py` (Fintoc y Groq) y `correos.py` (confirmación y recuperar contraseña). La llave secreta de Fintoc y el `link_token` se quedan en
  el servidor; al navegador solo llegan los movimientos ya convertidos.
- **Cuentas**: el sistema de usuarios de Django, con correo y contraseña (hash `scrypt`), confirmación
  por correo y recuperación de contraseña con un link que vence en 1 hora. Sesión en cookie `HttpOnly` y protección
  CSRF de Django en cada cambio. Límite de 5 contraseñas malas cada 15 minutos.
- **Base de datos**: PostgreSQL. Las tablas (`usuarios`, `ajustes`, `cuentas`, `movimientos`,
  `conexiones_bancarias`, `reglas`, `presupuestos`, `metas`, `boletas` y `notificaciones`) se
  definen como modelos de Django y se crean con migraciones.
- `public/`: la página. `index.html` es la estructura, `css/finflow.css` los estilos propios y
  `js/` el código en módulos (`import`/`export`), que `js/main.js` carga y arranca:
  - `logica/`: los cálculos, un archivo por tema (`cartolas`, `clasificacion`, `traspasos`,
    `movimientos`, `proyeccion`, `plan`, `util`); `index.js` los junta en el objeto `FF`.
    No dependen de la página y se pueden probar por separado.
  - `app/`: estado, menú y chat, notificaciones, importar cartolas y Fintoc, sesión y eventos.
  - `pantallas/`: un archivo por pantalla.
  - `graficos/`: los gráficos SVG. Diseño con Bootstrap 5.3. Con sesión iniciada,
  los datos se guardan en la base de datos.

```
Navegador --(widget de Fintoc)--> Fintoc
   | exchange_token
   v
Django --(llave secreta + link_token)--> api.fintoc.com
   | movimientos {fecha, descripción, monto}
   v
public/js -> clasificación -> resumen, proyección y calendario
```

## Pendiente
- Llaves `live` de Fintoc (requiere aprobación) y HTTPS.
- Pruebas automáticas y el Dockerfile de la página.
