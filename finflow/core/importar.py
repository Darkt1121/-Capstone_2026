"""Importa movimientos desde archivos .eml usando los lectores."""
from lectores import correo_desde_bytes, leer_correo

from .models import Movimiento


def importar_correos(perfil, carpeta):
    """Lee los .eml de la carpeta y guarda los movimientos nuevos. Devuelve (nuevos, repetidos)."""
    nuevos = repetidos = 0
    for archivo in sorted(carpeta.glob('*.eml')):
        datos = leer_correo(correo_desde_bytes(archivo.read_bytes()))
        if datos is None:
            continue
        _, creado = Movimiento.objects.get_or_create(
            usuario=perfil.usuario,
            banco=datos['banco'],
            codigo=datos['codigo'],
            defaults={
                'fecha': datos['fecha'],
                'nombre': datos['nombre'],
                'rut': datos['rut'],
                'monto': datos['monto'],
                'tipo': 'ingreso' if datos['direccion'] == 'entra' else 'gasto',
                'es_propia': datos['rut'] == perfil.rut,
            },
        )
        if creado:
            nuevos += 1
        else:
            repetidos += 1
    return nuevos, repetidos
