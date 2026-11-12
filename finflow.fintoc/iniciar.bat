@echo off
rem Enciende FinFlow (base de datos y página en Docker) y abre el navegador.
cd /d "%~dp0"
echo Encendiendo FinFlow...
set COMPOSE_BAKE=false
docker compose up -d --build --wait
if errorlevel 1 (
  echo.
  echo No se pudo encender FinFlow. Abre Docker Desktop, espera a que parta y vuelve a intentar.
  pause
  exit /b 1
)
start http://localhost:3000
echo FinFlow esta en http://localhost:3000
echo Para apagarlo: docker compose down
pause
