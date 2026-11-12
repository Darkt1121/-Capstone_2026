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
- **Cuentas de usuario**: registro con correo y contraseña, confirmación por correo y recuperación
  de contraseña. Límite de intentos
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
| Servidor | Python 3.12 con Django 5.2 |
| Base de datos | PostgreSQL 16, en Docker |
| Conexión a la base de datos | ORM de Django con `psycopg` |
| Cuentas de usuario | Sistema de usuarios de Django (hash `scrypt`, sesiones y protección CSRF) |
| Correos | SMTP de Brevo (confirmación de cuenta y recuperar contraseña) |
| Conexión bancaria | API y widget de Fintoc, en modo prueba |
| Asistente | API de Groq |
| Lectura de Excel | SheetJS, cargado desde CDN |
| Lectura de PDF | pdf.js, cargado desde CDN solo al subir un PDF |
| Clasificación | Reglas y expresiones regulares en JavaScript |
| Proyección | Suavizado exponencial de Holt y simulaciones por remuestreo |
| Contenedores | Docker Compose |
| Control de versiones | Git y GitHub |

## Cómo correrlo
Necesitas Git y Docker Desktop. No hace falta instalar Python: Django corre dentro de Docker.

```bash
git clone https://github.com/Darkt1121/-Capstone_2026.git Capstone_2026
cd Capstone_2026/finflow.fintoc
```

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
                           Widget de Fintoc          Django (Python)  
             |                    |                 /       |        \
             +--------------------+--> token       v        v         v
                                             PostgreSQL   Fintoc     Groq
                                             (usuarios,  (cuentas y  (asistente)
                                             cuentas y    movimientos
                                             movimientos) del banco)
```

- **Navegador**: muestra las pantallas, lee las cartolas, clasifica los movimientos y calcula la
  proyección.
- **Servidor** (Django, app `core`): entrega la página, maneja las cuentas y las sesiones, y habla con
  Fintoc y con Groq. Las llaves secretas y el `link_token` del banco se quedan en el servidor;
  al navegador solo llegan los movimientos ya convertidos.
- **Cuentas**: el sistema de usuarios de Django. Con correo y contraseña se guarda solo el hash
  (`scrypt`), con confirmación por correo y recuperación de contraseña por link. La sesión es
  una cookie `HttpOnly` y cada cambio lleva el token CSRF de Django.
- **Base de datos** (modelos de Django en `core/models.py`, creados con migraciones): tablas `usuarios`, `ajustes`, `cuentas`,
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
    ├── docker-compose.yml       base de datos (db) y página (web)
    ├── Dockerfile               imagen de la página (Django)
    ├── requirements.txt         librerías de Python (Django y psycopg)
    ├── .env.example             variables que necesita el .env
    ├── iniciar.bat              enciende todo con doble clic (Windows)
    ├── manage.py                comandos de Django
    ├── config/                  configuración de Django (settings.py, urls.py)
    ├── core/                    la app: modelos (tablas), rutas /api y servicios externos
    │   ├── models.py            tablas
    │   ├── views.py             rutas /api
    │   ├── externos.py          Fintoc y Groq
    │   ├── correos.py           confirmación de cuenta y recuperar contraseña
    │   ├── tests.py             pruebas del servidor
    │   └── migrations/          historial de cambios de las tablas
    └── public/
        ├── index.html           estructura de la página
        ├── css/finflow.css      estilos propios (además de Bootstrap)
        └── js/
            ├── main.js          punto de entrada: carga los módulos y arranca la página
            ├── logica/          cálculos (no dependen de la pantalla; se prueban por separado)
            │   ├── index.js     junta todo en el objeto FF
            │   ├── util.js      fechas, montos y meses
            │   ├── cartolas.js  CSV, Excel y PDF de BancoEstado y MACHBANK
            │   ├── clasificacion.js  reglas, comercio y categorías
            │   ├── traspasos.js      cuentas propias y movimientos repetidos
            │   ├── movimientos.js    arma la lista de movimientos y une cartolas
            │   ├── proyeccion.js     pagos fijos y proyección a 4 semanas
            │   ├── plan.js      resumen, presupuestos, metas, recordatorios y reporte
            │   └── ejemplo.js   cartolas de ejemplo (ficticias)
            ├── app/
            │   ├── estado.js    estado de la página, íconos y ayudas
            │   ├── marco.js     menú, barra de arriba y chat del asistente
            │   ├── render.js    dibuja la pantalla que corresponde
            │   ├── notificaciones.js
            │   ├── importar.js  cartolas (CSV, Excel, PDF) y Fintoc
            │   ├── sesion.js    cuentas y guardado en el servidor
            │   └── eventos.js   botones y formularios
            ├── pantallas/       una por pantalla: portada, cuenta, configuracion, inicio,
            │                    movimientos, proyeccion, plan, reporte, perfil, calendario,
            │                    detalle (un movimiento) y comunes (piezas compartidas)
            ├── graficos/
            │   ├── proyeccion.js  gráfico de la proyección
            │   └── panel.js       gráficos y cálculos del panel
            └── tema.js, tema-boton.js   modo claro y oscuro
```

## Estado actual y pendientes
- La clasificación usa reglas fijas, reglas propias del usuario y sus correcciones.
- La conexión bancaria funciona con las llaves de prueba de Fintoc. Las de producción requieren
  la aprobación de Fintoc.
- La alerta de saldo necesita al menos 3 meses de movimientos.
- Se admiten hasta 3 cuentas, y el importador no cubre todos los formatos de cartola.
- Faltan las pruebas automáticas y el Dockerfile de la página.
- Antes de un lanzamiento con usuarios reales: HTTPS, recuperación de contraseña, respaldos de la
  base de datos y la revisión de la política de privacidad por un abogado.
