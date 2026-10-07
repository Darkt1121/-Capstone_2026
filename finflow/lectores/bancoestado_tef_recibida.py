"""Lector del aviso de transferencia recibida (TEF) de BancoEstado. Ej: el sueldo.

Formato inventado (no teníamos un correo real de este tipo). Ajustar en el S2.
"""
from .utiles import buscar, leer_fecha, leer_monto, normalizar_rut, remitente, separar_desde_hacia, texto

# TODO: confirmar con correo real
REMITENTES = ['notificaciones@correo.bancoestado.cl']


def es_mio(correo):
    return remitente(correo) in REMITENTES and 'Has recibido una Transferencia' in texto(correo)


def leer(correo):
    contenido = texto(correo)
    desde, hacia = separar_desde_hacia(contenido)
    return {
        'banco': 'BancoEstado',
        'direccion': 'entra',
        'monto': leer_monto(buscar('Monto recibido', contenido)),
        'fecha': leer_fecha(buscar('Fecha y Hora de TEF', hacia), '%d/%m/%Y %H:%M:%S'),
        'codigo': buscar('N° de TEF', hacia),
        'nombre': buscar('Nombre', desde),
        'rut': normalizar_rut(buscar('RUT', desde)),
        'banco_contraparte': buscar('Banco', desde),
        'mensaje': None,
    }
