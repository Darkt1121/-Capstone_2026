"""Lectores de correos bancarios: convierten un correo en un movimiento.

Los lectores no saben de dónde vino el correo (.eml o API de Gmail): siempre reciben un EmailMessage.
Para agregar un banco: crear un archivo con REMITENTES, es_mio() y leer(), y sumarlo a LECTORES.
"""
from email import message_from_bytes, policy

from . import bancoestado_tef, bancoestado_tef_recibida, mach_transferencia

LECTORES = [bancoestado_tef, bancoestado_tef_recibida, mach_transferencia]


def correo_desde_bytes(datos):
    """Bytes crudos de un correo (archivo .eml, o Gmail con format=raw) -> EmailMessage."""
    return message_from_bytes(datos, policy=policy.default)


def leer_correo(correo):
    """Devuelve el movimiento del correo como diccionario, o None si ningún lector lo reconoce."""
    for lector in LECTORES:
        if lector.es_mio(correo):
            return lector.leer(correo)
    return None
