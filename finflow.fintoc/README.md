# FinFlow + Fintoc

Conecta el banco del usuario (modo prueba, solo lectura) y carga sus movimientos en FinFlow.
Las cartolas (CSV/Excel) siguen funcionando igual como alternativa.

## Puesta en marcha
1. Instala Node 20.6 o superior (`node -v`).
2. Crea una cuenta en https://app.fintoc.com y, en **modo prueba**, copia tus llaves
   (Para desarrolladores > API Keys): `sk_test_...` y `pk_test_...`.
3. Copia `.env.example` a `.env` y pega las llaves.
4. `npm start` y abre http://localhost:3000
5. En el paso "Sube tu cartola" aparece **Conectar mi banco**. En modo prueba Fintoc
   ofrece un banco de prueba con datos falsos (ver su guía "test your integration").

## Cómo funciona
```
Navegador --(widget Fintoc)--> Fintoc
   | exchange_token
   v
server.js --(sk_test_ + link_token; nunca salen del servidor)--> api.fintoc.com
   | filas ya convertidas {date, description, amount, balance}
   v
index.html -> FF.mergeRows() -> clasificación / proyección existentes
```
- `server.js`: crea el Link Intent, cambia el exchange_token por link_token, trae cuentas y movimientos (de a 300 por página).
- `public/index.html`: botón "Conectar mi banco", botón "Actualizar desde el banco" en Perfil y consentimiento actualizado.
- Si abres `index.html` sin el servidor, el botón no aparece y todo sigue funcionando con cartolas.

## Pendientes antes de producción
- Llaves `live` (requiere aprobación de Fintoc) y HTTPS.
- Guardar `link_token` cifrado y asociado a usuarios reales (hoy: `data/links.json` por sesión de navegador).
- Si el widget se abre dos veces, borra la línea `widget.open()` en `runFintoc` (depende de la versión de fintoc.js).
- Política de privacidad y retención de datos personales.
