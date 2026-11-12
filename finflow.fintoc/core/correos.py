"""Correos que envía FinFlow (por ahora, la confirmación del correo al crear la cuenta).

Se envían con lo que trae Django (django.core.mail). Si el .env no tiene EMAIL_HOST_USER y
EMAIL_HOST_PASSWORD, el correo no sale: se muestra completo en el registro del servidor (modo prueba).
"""

import logging

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core import signing
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.html import escape
from django.utils.http import urlsafe_base64_encode

log = logging.getLogger(__name__)

SAL = 'finflow-confirmar-correo'
VIGENCIA = 2 * 24 * 60 * 60   # el link vence en 2 días


def token_confirmacion(usuario):
    """Código firmado por Django con el id y el correo. Si alguien lo cambia, la firma no calza."""
    return signing.dumps({'u': usuario.pk, 'e': usuario.email}, salt=SAL)


def leer_token(token):
    """Devuelve (id, correo) si el código es válido y no venció; None si no."""
    try:
        datos = signing.loads(token, salt=SAL, max_age=VIGENCIA)
        return datos['u'], datos['e']
    except (signing.BadSignature, KeyError, TypeError):
        return None


def _enviar(asunto, usuario, texto, html):
    try:
        send_mail(asunto, texto, settings.DEFAULT_FROM_EMAIL, [usuario.email], html_message=html)
        return True
    except Exception:   # sin conexión, clave SMTP mala, etc.
        log.exception('No se pudo enviar "%s" a %s', asunto, usuario.email)
        return False


def _html(saludo, parrafo, boton, link, nota):
    return (f'<div style="font-family:Arial,sans-serif;font-size:15px;color:#212529;max-width:520px">'
            f'<p>{escape(saludo)}</p><p>{parrafo}</p>'
            f'<p><a href="{escape(link)}" style="display:inline-block;background:#0d6efd;color:#fff;padding:10px 18px;'
            f'border-radius:6px;text-decoration:none">{escape(boton)}</a></p>'
            f'<p style="color:#6c757d;font-size:13px">{escape(nota)}</p></div>')


def enviar_recuperacion(request, usuario):
    """Correo con el link para crear una contraseña nueva. Usa el generador de Django: el link vence
    (PASSWORD_RESET_TIMEOUT) y deja de servir apenas se cambia la contraseña."""
    codigo = urlsafe_base64_encode(force_bytes(usuario.pk)) + '.' + default_token_generator.make_token(usuario)
    link = request.build_absolute_uri('/?recuperar=' + codigo)
    nota = 'El link vence en 1 hora y sirve una sola vez. Si no pediste cambiar tu contraseña, ignora este correo: tu contraseña sigue igual.'
    texto = f'Hola {usuario.nombre}:\n\nPara crear una contraseña nueva en FinFlow, abre este link:\n\n{link}\n\n{nota}\n'
    html = _html(f'Hola {usuario.nombre}:', 'Pediste crear una contraseña nueva en <strong>FinFlow</strong>. Aprieta el botón:', 'Crear contraseña nueva', link, nota)
    return _enviar('Crea una contraseña nueva en FinFlow', usuario, texto, html)


def enviar_confirmacion(request, usuario):
    """Envía el correo con el link para confirmar. Si falla el envío, no rompe el registro."""
    link = request.build_absolute_uri('/confirmar?t=' + token_confirmacion(usuario))
    texto = (f'Hola {usuario.nombre}:\n\n'
             f'Gracias por crear tu cuenta en FinFlow. Para confirmar tu correo, abre este link:\n\n{link}\n\n'
             'El link vence en 2 días. Si no creaste una cuenta en FinFlow, ignora este correo.\n')
    html = (f'<div style="font-family:Arial,sans-serif;font-size:15px;color:#212529;max-width:520px">'
            f'<p>Hola {escape(usuario.nombre)}:</p>'
            '<p>Gracias por crear tu cuenta en <strong>FinFlow</strong>. Para confirmar tu correo, aprieta el botón:</p>'
            f'<p><a href="{escape(link)}" style="display:inline-block;background:#0d6efd;color:#fff;padding:10px 18px;'
            'border-radius:6px;text-decoration:none">Confirmar mi correo</a></p>'
            '<p style="color:#6c757d;font-size:13px">El link vence en 2 días. Si no creaste una cuenta en FinFlow, ignora este correo.</p></div>')
    try:
        send_mail('Confirma tu correo en FinFlow', texto, settings.DEFAULT_FROM_EMAIL, [usuario.email], html_message=html)
        return True
    except Exception:   # sin conexión, contraseña de aplicación mala, etc.
        log.exception('No se pudo enviar el correo de confirmación a %s', usuario.email)
        return False
