"""Lector del comprobante de transferencia enviada (TEF) de BancoEstado."""
from .utiles import buscar, leer_fecha, leer_monto, normalizar_rut, remitente, separar_desde_hacia, texto

# TODO: confirmar con correo real
REMITENTES = ['notificaciones@correo.bancoestado.cl']


def es_mio(correo):
    return remitente(correo) in REMITENTES and 'Acabas de realizar una Transferencia' in texto(correo)


def leer(correo):
    contenido = texto(correo)
    desde, hacia = separar_desde_hacia(contenido)
    return {
        'banco': 'BancoEstado',
        'direccion': 'sale',
        'monto': leer_monto(buscar('Monto transferido', contenido)),
        'fecha': leer_fecha(buscar('Fecha y Hora de TEF', desde), '%d/%m/%Y %H:%M:%S'),
        'codigo': buscar('N° de TEF', desde),
        'nombre': buscar('Nombre', hacia),
        'rut': normalizar_rut(buscar('RUT', hacia)),
        'banco_contraparte': buscar('Banco', hacia),
        'mensaje': None,
    }
