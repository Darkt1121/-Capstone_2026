"""
Configuración de Django para FinFlow.

Todo lo secreto o que cambia según dónde corre (claves, base de datos) sale de variables de entorno,
que Docker Compose lee del archivo .env. Nada de eso va escrito en el código.
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
PUBLIC_DIR = BASE_DIR / 'public'   # la página (index.html, css/ y js/)

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', '')
if not SECRET_KEY:
    raise RuntimeError('Falta DJANGO_SECRET_KEY en el .env')
DEBUG = os.environ.get('DJANGO_DEBUG', '0') == '1'
ALLOWED_HOSTS = [h.strip() for h in os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if h.strip()]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'core',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Base de datos: PostgreSQL (servicio "db" de Docker Compose).
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('POSTGRES_DB', 'finflow'),
        'USER': os.environ.get('POSTGRES_USER', 'finflow'),
        'PASSWORD': os.environ.get('POSTGRES_PASSWORD', ''),
        'HOST': os.environ.get('DB_HOST', 'db'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}

# Usuarios: modelo propio (entran con su correo). Contraseñas con hash scrypt; nunca se guarda la contraseña.
AUTH_USER_MODEL = 'core.Usuario'
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.ScryptPasswordHasher',
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
]
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 8}},
]

# El link para crear una contraseña nueva vence en 1 hora.
PASSWORD_RESET_TIMEOUT = 60 * 60

# Sesión: cookie HttpOnly, 30 días. CSRF: la página manda el token en el encabezado X-CSRFToken.
SESSION_COOKIE_AGE = 30 * 24 * 60 * 60
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_TRUSTED_ORIGINS = [o.strip() for o in os.environ.get('DJANGO_CSRF_TRUSTED_ORIGINS', 'http://localhost:3000').split(',') if o.strip()]

# Al publicar con HTTPS (DJANGO_HTTPS=1): cookies solo por HTTPS, redirigir HTTP a HTTPS y HSTS.
if os.environ.get('DJANGO_HTTPS', '0') == '1':
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_SSL_REDIRECT = True
    SECURE_HSTS_SECONDS = 60 * 60 * 24 * 30
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Correos (confirmación de cuenta). Con EMAIL_HOST_USER y EMAIL_HOST_PASSWORD (contraseña de aplicación de
# Gmail) se envían de verdad; sin ellos se muestran en el registro del servidor (modo prueba).
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '').replace(' ', '')
if EMAIL_HOST_USER and EMAIL_HOST_PASSWORD:
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
    EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))
    EMAIL_USE_TLS = True
    EMAIL_TIMEOUT = 15
else:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
# Remitente. En Brevo el usuario SMTP no es la dirección que envía, por eso va aparte (EMAIL_FROM).
DEFAULT_FROM_EMAIL = f'FinFlow <{os.environ.get("EMAIL_FROM") or EMAIL_HOST_USER or "no-responder@finflow.local"}>'

# Una cuenta trae todos sus movimientos y una boleta llega en base64 (2 MB son unos 2,8 millones de letras).
DATA_UPLOAD_MAX_MEMORY_SIZE = 3_000_000

LANGUAGE_CODE = 'es-cl'
TIME_ZONE = 'America/Santiago'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Servicios externos (las claves quedan solo en el servidor).
FINTOC_SECRET_KEY = os.environ.get('FINTOC_SECRET_KEY', '')
FINTOC_PUBLIC_KEY = os.environ.get('FINTOC_PUBLIC_KEY', '')
FINTOC_API = os.environ.get('FINTOC_API_BASE', 'https://api.fintoc.com/v1')
GROQ_API_KEY = os.environ.get('GROQ_API_KEY', '')
GROQ_MODEL = os.environ.get('GROQ_MODEL', 'openai/gpt-oss-120b')
CONTACT_EMAIL = os.environ.get('CONTACT_EMAIL', '')
