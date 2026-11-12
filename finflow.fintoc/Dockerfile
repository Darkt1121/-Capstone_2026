# Imagen de la página FinFlow (Django). La base de datos corre en su propio contenedor (servicio "db").
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --root-user-action=ignore -r requirements.txt

COPY . .

EXPOSE 3000
# Al partir: crea o actualiza las tablas y enciende el servidor.
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py runserver 0.0.0.0:3000"]
