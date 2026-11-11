# FinFlow

Aplicación web de gestión financiera para trabajadores independientes y pequeñas empresas. Proyecto desarrollado en la asignatura Capstone de Ingeniería en Informática de Duoc UC.

## Descripción

FinFlow permite reunir movimientos bancarios, separar las finanzas personales de las del negocio y proyectar el saldo para las próximas cuatro semanas.

Busca reducir el tiempo y los errores de la clasificación manual de transacciones, además de ayudar al usuario a anticipar posibles problemas de liquidez.

Los movimientos pueden obtenerse mediante archivos CSV o Excel y mediante una integración con Fintoc, preparada para trabajar en su entorno de pruebas.

## Funcionalidades actuales

- Importación de cartolas CSV y Excel con formatos compatibles.
- Integración con Fintoc para consultar cuentas y movimientos en pesos chilenos.
- Clasificación mediante reglas en cuatro categorías:
  - Ingreso de negocio.
  - Ingreso personal.
  - Gasto operacional.
  - Gasto personal.
- Explicación y corrección manual de las clasificaciones.
- Detección de transferencias internas y pagos recurrentes.
- Consolidación de movimientos con control de duplicados.
- Dashboard con saldos y resumen mensual.
- Proyección del saldo a cuatro semanas con banda de incertidumbre.
- Alertas dentro de la aplicación cuando se estima un saldo inferior al mínimo definido.
- Exportación de movimientos clasificados a CSV.
- Interfaz adaptable a computadores y dispositivos móviles.
- Datos de ejemplo para explorar el prototipo.

## Tecnologías utilizadas

| Componente | Tecnología |
|---|---|
| Interfaz web | HTML5, CSS3 y JavaScript |
| Backend | Node.js y su módulo HTTP nativo |
| Integración bancaria | API y widget de Fintoc |
| Lectura de Excel | SheetJS, cargado desde CDN |
| Clasificación actual | Reglas y expresiones regulares en JavaScript |
| Proyección financiera | Suavizado exponencial de Holt y simulaciones por remuestreo |
| Almacenamiento del prototipo | `localStorage` del navegador |
| Persistencia de conexiones bancarias | Archivo JSON en el servidor |
| Control de versiones | Git y GitHub |

El proyecto actualmente no utiliza una base de datos central ni requiere servicios cloud para ejecutarse localmente. El acceso de usuarios está simulado; Supabase Auth se contempla para una versión posterior.

## Ejecución local

### Requisitos

- Git.
- Node.js 20.6 o superior.
- Navegador actualizado.
- Conexión a internet para cargar las bibliotecas externas y utilizar Fintoc.

### Descargar el repositorio

```bash
git clone https://github.com/Darkt1121/-Capstone_2026.git Capstone_2026
cd Capstone_2026/finflow.fintoc
```

### Ejecutar sin conexión bancaria

```bash
node server.js
```

Abrir en el navegador:

```text
http://localhost:3000
```

Este modo permite utilizar las cartolas de ejemplo o importar archivos compatibles. El botón de conexión bancaria permanece oculto si no hay llaves de Fintoc configuradas.

El backend no requiere instalar paquetes adicionales con `npm install`.

### Habilitar Fintoc en modo de prueba

Crear un archivo llamado `.env` dentro de `finflow.fintoc`:

```dotenv
FINTOC_SECRET_KEY=sk_test_REEMPLAZAR
FINTOC_PUBLIC_KEY=pk_test_REEMPLAZAR
PORT=3000
```

Reemplazar los valores por las llaves de prueba de la cuenta de Fintoc y ejecutar:

```bash
npm start
```

Con una configuración válida, aparecerá el botón **Conectar mi banco**. Después de importar una cuenta, será posible actualizar sus movimientos desde **Perfil**.

Las llaves y los tokens no deben incluirse en commits ni compartirse en el repositorio.

### Formato básico de cartola

El importador reconoce encabezados como fecha, descripción y monto. También admite cargos y abonos en columnas separadas.

Ejemplo de CSV:

```csv
Fecha;Descripción;Monto;Saldo
01/11/2026;Pago cliente;100000;100000
02/11/2026;Compra materiales;-20000;80000
```

Los encabezados deben estar en la primera fila. La compatibilidad depende de la estructura del archivo; todavía no existe un lector específico para cada banco.

## Integrantes y roles

| Integrante | Rol y responsabilidades |
|---|---|
| Kevin Sanchez | Desarrollo frontend, diseño de interfaz y experiencia de usuario |
| Camilo Ponce | Scrum Master y desarrollo backend, integración con Fintoc y sincronización bancaria |
| Johan Huamanchumo | Ciencia de datos, clasificación de transacciones y proyección financiera |

## Metodología de trabajo

El equipo utiliza una metodología ágil con enfoque Scrum, distribución de responsabilidades y ciclos cortos de desarrollo.

El trabajo contempla planificación de actividades, revisión de avances, integración de componentes y ajustes ante dificultades técnicas. GitHub se utiliza para compartir el código y mantener el historial de cambios.

La planificación y las evidencias se organizan según las fases de la asignatura:

1. **Fase 1:** definición y planificación del proyecto.
2. **Fase 2:** desarrollo, integración y validación.
3. **Fase 3:** presentación y exposición final.

## Arquitectura de la solución

La aplicación se organiza en una interfaz web, un backend intermediario y un servicio externo de conexión bancaria.

```text
                        USUARIO
                           |
                           v
             Interfaz HTML, CSS y JavaScript
                  /                    \
                 v                      v
       Importación CSV/Excel      Backend Node.js
                 |                      |
                 |                      v
                 |                 API de Fintoc
                 |                      |
                 +----------+-----------+
                            |
                            v
              Movimientos en formato común
                            |
                            v
           Clasificación, correcciones y análisis
                            |
                            v
              Proyección de saldo a 4 semanas
                            |
                            v
                Dashboard y alertas visuales
```

**Frontend:** presenta las pantallas, importa cartolas, clasifica movimientos y calcula las proyecciones. Guarda los datos del prototipo en el navegador mediante `localStorage`.

**Backend:** gestiona las solicitudes a Fintoc, intercambia tokens y transforma las respuestas bancarias al formato utilizado por la aplicación. Las llaves secretas y el `link_token` permanecen en el servidor.

**Integración bancaria:** Fintoc proporciona el widget de conexión y el acceso a cuentas y movimientos. La clave bancaria se introduce en el widget del proveedor; el código de FinFlow no la solicita ni la almacena directamente.

## Estructura del repositorio

```text
Capstone_2026/
├── README.md
├── APT122_FormativaFase1.docx
├── Fase 1/
│   ├── Evidencias Grupales/
│   └── Evidencias Individuales/
├── Fase 2/
│   ├── Evidencias Grupales/
│   ├── Evidencias Individuales/
│   └── Evidencias Proyecto/
│       ├── Evidencias Documentacion/
│       ├── Evidencias Sistema/
│       └── Presentacion_Fase2.pdf
└── finflow.fintoc/
    ├── package.json
    ├── README.md
    ├── server.js
    └── public/
        └── index.html
```

## Estado actual y limitaciones

FinFlow se encuentra en etapa de prototipo funcional.

- La clasificación actual utiliza reglas. El modelo NLP supervisado está pendiente de desarrollo e integración.
- Las proyecciones requieren validación con datos reales. Las alertas de liquidez se habilitan a partir de 84 días de historial.
- La conexión bancaria se documenta para el entorno de pruebas. El acceso a producción requiere la habilitación correspondiente de Fintoc.
- El registro y el inicio de sesión son simulados.
- Los movimientos se almacenan en el navegador y no se sincronizan entre dispositivos.
- El prototipo admite hasta tres cuentas.
- La importación no cubre todos los formatos de cartolas bancarias.
- Antes de utilizar datos reales en producción deben completarse la autenticación, la protección del almacenamiento de tokens y los mecanismos de desconexión y borrado verificable.
