"""Lector del aviso de transferencia enviada de MACH."""
from .utiles import buscar, leer_fecha, leer_monto, normalizar_rut, remitente, texto

# TODO: confirmar con correo real
REMITENTES = ['notificaciones@somosmach.com']


def es_mio(correo):
    return remitente(correo) in REMITENTES and 'Acabas de hacer una transferencia' in texto(correo)


def leer(correo):
    contenido = texto(correo)
    return {
        'banco': 'MACH',
        'direccion': 'sale',
        'monto': leer_monto(buscar('Monto', contenido)),
        'fecha': leer_fecha(buscar('Fecha', contenido), '%d/%m/%Y - %H:%M:%S'),
        'codigo': buscar('Código de confirmación', contenido),
        'nombre': buscar('Nombre destinatario', contenido),
        'rut': normalizar_rut(buscar('RUT', contenido)),
        'banco_contraparte': buscar('Banco destino', contenido),
        'mensaje': buscar('Mensaje', contenido),
    }
