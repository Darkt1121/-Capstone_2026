# FinFlow

Aplicación web de gestión financiera para trabajadores independientes. Proyecto de la asignatura
Capstone de Ingeniería en Informática, Duoc UC.

## Descripción
FinFlow junta los movimientos de tus cuentas, separa lo del negocio de lo personal y proyecta tu
saldo a 4 semanas para avisarte antes de quedar corto.

Los movimientos entran de dos formas:
- subiendo la cartola del banco (Excel, CSV o el PDF de BancoEstado o MACHBANK, aunque tenga clave), o
- conectando el banco con Fintoc en modo solo lectura (nunca se pide la clave del banco).

## Qué tiene
- **Cuentas de usuario**: registro con correo y contraseña, o entrar con Google. Límite de intentos
  de contraseña.
- **Privacidad**: política de privacidad dentro de la página y consentimiento expreso antes de
  guardar movimientos; queda registrada la versión aceptada y la fecha (ley N° 21.719).
- **Inicio**: saldo total, cuánto puedes gastar por día, alerta si vas a bajar de tu mínimo,
  resumen del mes, negocio vs. personal y gastos por categoría.
- **Movimientos**: lista con buscador y filtros. Cada movimiento dice por qué se clasificó así
  y se puede corregir; la corrección se aplica a los demás movimientos del mismo comercio.
- **Proyección**: saldo probable de las próximas 4 semanas, pagos fijos que vienen y tu mínimo.
- **Calendario**: cuánto gastaste cada día del mes.
- **Perfil**: cuentas conectadas, exportar los datos en CSV y borrar todo.
- **Asistente "Pregúntale a FinFlow"**: preguntas en español sobre tus números. Solo recibe un
  resumen ya calculado, sin nombres de personas ni RUT.
- Detección de traspasos entre cuentas propias y de pagos fijos.
- **Plan**: presupuestos por categoría con aviso al 80 % y al 100 %, metas de ahorro que se
  comparan con lo que sobra cada mes y con la proyección, y reglas propias de categorías.
- **Reporte negocio vs. personal** por mes, descargable en PDF.
- **Próximos cobros**: recordatorio de los pagos fijos de los próximos 7 días, con aviso si un
  cobro fijo cambió de precio.
- **Comercio y boletas**: cada movimiento muestra el comercio ("PAGO JUMBO LAS CONDES 123" es
  "Jumbo") y se le puede adjuntar la boleta (PDF, JPG o PNG).
- **Posibles repetidos**: mismo monto, ±1 día y otra cuenta; el usuario decide si juntarlos.
- Modo claro y oscuro. Se adapta a computador y celular.

## Tecnologías
| Componente | Tecnología |
|---|---|
| Interfaz web | HTML, JavaScript y Bootstrap 5.3 |
| Servidor | Node.js (módulo HTTP nativo) |
| Base de datos | PostgreSQL 16, en Docker |
| Conexión a la base de datos | `pg` (única librería instalada) |
| Cuentas de usuario | Correo y contraseña con hash `scrypt`, o Google (Google Identity Services) |
| Conexión bancaria | API y widget de Fintoc, en modo prueba |
| Asistente | API de Groq |
| Lectura de Excel | SheetJS, cargado desde CDN |
| Lectura de PDF | pdf.js, cargado desde CDN solo al subir un PDF |
| Clasificación | Reglas y expresiones regulares en JavaScript |
| Proyección | Suavizado exponencial de Holt y simulaciones por remuestreo |
| Contenedores | Docker Compose |
| Control de versiones | Git y GitHub |

## Cómo correrlo
Necesitas Git, Node.js 20.6 o superior y Docker Desktop.

```bash
git clone https://github.com/Darkt1121/-Capstone_2026.git Capstone_2026
cd Capstone_2026/finflow.fintoc
```

1. Copia `.env.example` como `.env` e inventa una contraseña para la base de datos
   (`POSTGRES_PASSWORD`, y la misma dentro de `DATABASE_URL`).
2. `docker compose up -d db` enciende PostgreSQL (puerto 5433).
3. `npm install` instala `pg`.
4. `npm start` y abre http://localhost:3000. Las tablas se crean solas la primera vez.

Opcional, en el `.env`:
- **Conectar un banco**: llaves de **modo prueba** de https://app.fintoc.com (`sk_test_...` y
  `pk_test_...`). Sin llaves la página funciona igual, solo con cartolas.
- **Entrar con Google**: `GOOGLE_CLIENT_ID` de https://console.cloud.google.com (cliente OAuth
  de tipo "Aplicación web", con origen autorizado `http://localhost:3000`).
- **Asistente**: `GROQ_API_KEY` de https://console.groq.com.
- **Contacto de la política de privacidad**: `CONTACT_EMAIL`.

Las llaves y contraseñas van solo en el `.env`, que no se sube al repositorio.

Para verla rápido sin crear cuenta, usa "Probar con datos de ejemplo".

### Formato de cartola
El importador reconoce encabezados como fecha, descripción y monto, o cargos y abonos en columnas
separadas. Los encabezados van en la primera fila.

```csv
Fecha;Descripción;Monto;Saldo
01/11/2026;Pago cliente;100000;100000
02/11/2026;Compra materiales;-20000;80000
```

## Integrantes y roles
| Integrante | Rol y responsabilidades |
|---|---|
| Kevin Sanchez | Desarrollo frontend, diseño de interfaz y experiencia de usuario |
| Camilo Ponce | Scrum Master y desarrollo backend, integración con Fintoc y sincronización bancaria |
| Johan Huamanchumo | Datos: base de datos y cuentas de usuario, clasificación de transacciones y proyección financiera |

## Metodología de trabajo
El equipo trabaja con Scrum: sprints cortos, reparto de responsabilidades, revisión de avances e
integración de las partes de cada integrante. GitHub se usa para compartir el código y mantener
el historial de cambios.

Las evidencias se organizan según las fases de la asignatura:
1. **Fase 1:** definición y planificación del proyecto.
2. **Fase 2:** desarrollo, integración y validación.
3. **Fase 3:** presentación y exposición final.

## Arquitectura
```text
                      Navegador
        (public/: pantallas, cartolas, clasificación y proyección)
             |                    |                      |
             v                    v                      v
      Botón de Google      Widget de Fintoc         server.js (Node.js)
             |                    |                 /       |        \
             +--------------------+--> token       v        v         v
                                             PostgreSQL   Fintoc     Groq
                                             (usuarios,  (cuentas y  (asistente)
                                             cuentas y    movimientos
                                             movimientos) del banco)
```

- **Navegador**: muestra las pantallas, lee las cartolas, clasifica los movimientos y calcula la
  proyección.
- **Servidor** (`server.js`): entrega la página, maneja las cuentas y las sesiones, y habla con
  Fintoc y con Groq. Las llaves secretas y el `link_token` del banco se quedan en el servidor;
  al navegador solo llegan los movimientos ya convertidos.
- **Cuentas**: con correo y contraseña se guarda solo el hash. Con Google, el servidor comprueba
  el token con Google antes de aceptar. La sesión es una cookie `HttpOnly` guardada en la base de
  datos.
- **Base de datos** (`db/schema.sql`): tablas `usuarios`, `sesiones`, `ajustes`, `cuentas`,
  `movimientos`, `conexiones_bancarias`, `reglas`, `presupuestos`, `metas` y `boletas`. Cada usuario ve solo sus datos, y puede entrar desde
  otro dispositivo y encontrar lo mismo.
- **Conexión bancaria**: la clave del banco se escribe en el widget de Fintoc; FinFlow no la pide
  ni la guarda.

## Estructura del repositorio
```text
Capstone_2026/
├── README.md
├── APT122_FormativaFase1.docx
├── Fase 1/                      evidencias grupales e individuales
├── Fase 2/                      evidencias grupales, individuales y del proyecto
└── finflow.fintoc/
    ├── docker-compose.yml       base de datos PostgreSQL
    ├── .env.example             variables que necesita el .env
    ├── package.json
    ├── server.js                servidor
    ├── db/
    │   └── schema.sql           tablas
    └── public/
        ├── index.html           estructura de la página
        ├── css/finflow.css      estilos propios (además de Bootstrap)
        └── js/
            ├── logica.js        cálculos: cartolas, clasificación, traspasos, proyección
            ├── ejemplo.js       cartolas de ejemplo (ficticias)
            ├── estado.js        estado de la página e íconos
            ├── acceso.js        portada, cuenta y configuración inicial
            ├── app.js           menú, barra de arriba y chat
            ├── panel.js         cálculos y gráficos del panel
            ├── graficos.js      gráfico de la proyección
            ├── notificaciones.js
            ├── pantallas.js     movimientos, plan, reporte, perfil, calendario
            ├── importar.js      cartolas (CSV, Excel, PDF) y Fintoc
            ├── sesion.js        Google, cuentas y guardado en el servidor
            ├── eventos.js       botones y formularios
            └── tema.js, tema-boton.js   modo claro y oscuro
```

## Estado actual y pendientes
- La clasificación usa reglas. El modelo supervisado está pendiente.
- La conexión bancaria funciona con las llaves de prueba de Fintoc. Las de producción requieren
  la aprobación de Fintoc.
- La alerta de saldo necesita al menos 3 meses de movimientos.
- Se admiten hasta 3 cuentas, y el importador no cubre todos los formatos de cartola.
- Faltan las pruebas automáticas y el Dockerfile de la página.
- Antes de un lanzamiento con usuarios reales: HTTPS, recuperación de contraseña, respaldos de la
  base de datos y la revisión de la política de privacidad por un abogado.
