"""Lector del comprobante de transferencia enviada (TEF) de BancoEstado."""
from .utiles import buscar, fecha, monto, remitente, rut, separar_desde_hacia, texto

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
        'monto': monto(buscar('Monto transferido', contenido)),
        'fecha': fecha(buscar('Fecha y Hora de TEF', desde), '%d/%m/%Y %H:%M:%S'),
        'codigo': buscar('N° de TEF', desde),
        'nombre': buscar('Nombre', hacia),
        'rut': rut(buscar('RUT', hacia)),
        'banco_contraparte': buscar('Banco', hacia),
        'mensaje': None,
    }
