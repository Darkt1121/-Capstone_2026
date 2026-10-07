"""Clasificación de gastos con reglas simples. En el S3 se suman las correcciones del usuario y luego un modelo ML."""
import unicodedata

PALABRAS_COMISIONES = ('comision', 'cargo', 'mantencion', 'impuesto', 'interes')

# (clave, nombre que ve el usuario, detalle)
CATEGORIAS = [
    ('personas', 'Transferencias a personas', 'A amigos, familia, arriendo'),
    ('comisiones', 'Comisiones y cargos', 'Mantención, intereses, impuestos'),
    ('otros', 'Otros', 'Pagos a empresas y comercios'),
]


def sin_tildes(texto):
    """'Comisión' -> 'comision'"""
    return unicodedata.normalize('NFKD', texto).encode('ascii', 'ignore').decode().lower()


def es_persona(rut):
    """En Chile, los RUT de empresas parten sobre 50.000.000; los de personas están bajo esa cifra."""
    return int(rut.split('-')[0]) < 50_000_000


def categoria(movimiento):
    if any(palabra in sin_tildes(movimiento.nombre) for palabra in PALABRAS_COMISIONES):
        return 'comisiones'
    if es_persona(movimiento.rut):
        return 'personas'
    return 'otros'
