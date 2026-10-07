FROM python:3.12-slim

# No generar archivos .pyc y mostrar los logs al instante
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Primero solo las dependencias, para que Docker las guarde en caché
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Después el resto del código
COPY . .

EXPOSE 8000
