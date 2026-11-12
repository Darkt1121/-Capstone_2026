@echo off
rem Enciende la base de datos y la pagina, y abre el navegador.
cd /d "%~dp0"
echo Encendiendo la base de datos...
docker compose up -d --wait db
if errorlevel 1 (
  echo.
  echo No se pudo encender la base de datos. Abre Docker Desktop, espera a que parta y vuelve a intentar.
  pause
  exit /b 1
)
if not exist node_modules call npm install
start "" cmd /c "timeout /t 3 >nul & start http://localhost:3000"
echo Para apagar FinFlow, cierra esta ventana.
npm start
