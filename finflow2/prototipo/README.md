# FinFlow · prototipo navegable (Sprint 0)

Prototipo de alta fidelidad con lógica real, hecho para validar el diseño y el flujo antes de construir la versión React + FastAPI.

## Cómo abrirlo

Abre `index.html` en el navegador (doble clic). Funciona sin instalar nada. Necesita internet solo para las fuentes, el lector de Excel y el código QR.

## Qué hace de verdad

- Lee cartolas en CSV o Excel (fecha, descripción, cargos/abonos o monto, saldo) y valida que el saldo cuadre.
- Hasta 3 cuentas; al reimportar ignora los movimientos repetidos.
- Clasifica cada movimiento como Negocio o Personal con reglas y muestra el motivo. El usuario corrige con un toque y la corrección se aplica a la misma contraparte.
- Detecta traspasos entre cuentas propias (nombre del titular, o mismo monto entre dos cuentas en ±1 día) y los excluye de ingresos y gastos.
- Proyecta el saldo a 4 semanas: movimientos fijos detectados + suavizado exponencial con tendencia + 200 escenarios. Muestra rango, mínimo y la frase "en X de cada 20 escenarios".
- Una alerta de liquidez en pesos y días cubiertos, y el Resumen inteligente generado por reglas.
- Exportar datos (CSV) y borrar cuenta.

## Qué es simulado

- El acceso (Google / correo) no crea cuentas reales: en la versión final se usa Supabase Auth.
- Los datos se guardan solo en el navegador. La versión final usa PostgreSQL.
- La proyección corre en el navegador; la versión final usa Holt-Winters (statsmodels) en el servidor.

## Datos de ejemplo

`datos-ejemplo/` tiene dos cartolas ficticias (CuentaRUT y Mercado Pago) de "Valentina Rojas Fuentes", diseñadora freelance, abril–octubre 2026. No son datos reales.
