"""Funciones que comparten todos los lectores de correos."""
import re
from datetime import datetime
from email.utils import parseaddr
from html.parser import HTMLParser
from zoneinfo import ZoneInfo

ZONA_CHILE = ZoneInfo('America/Santiago')

# Así cada fila de tabla queda en su propia línea y se puede buscar "Etiqueta : valor"
ETIQUETAS_DE_LINEA = {'p', 'div', 'br', 'tr', 'h1', 'h2', 'h3', 'h4', 'li'}


class _ConvertidorHTML(HTMLParser):
    """Junta el texto del HTML: cada párrafo o fila de tabla queda en su propia línea."""

    def __init__(self):
        super().__init__()
        self.lineas = ['']

    def handle_starttag(self, tag, attrs):
        if tag in ETIQUETAS_DE_LINEA:
            self.lineas.append('')

    def handle_data(self, data):
        self.lineas[-1] += ' ' + data


def remitente(correo):
    """Dirección del remitente, sin el nombre: 'MACH <a@b.cl>' -> 'a@b.cl'."""
    return parseaddr(correo['From'])[1].lower()


def texto(correo):
    """Cuerpo del correo como texto simple, una línea por párrafo o fila de tabla."""
    cuerpo = correo.get_body(preferencelist=('html', 'plain'))
    contenido = cuerpo.get_content()
    if cuerpo.get_content_subtype() == 'plain':
        return contenido
    convertidor = _ConvertidorHTML()
    convertidor.feed(contenido)
    lineas = (' '.join(linea.split()) for linea in convertidor.lineas)
    return '\n'.join(linea for linea in lineas if linea)


def buscar(etiqueta, contenido):
    """Busca la línea 'Etiqueta : valor' (o 'Etiqueta valor') y devuelve el valor, o None."""
    encontrado = re.search(rf'^{re.escape(etiqueta)}(?: ?:)? (.+)$', contenido, re.MULTILINE)
    return encontrado.group(1) if encontrado else None


def separar_desde_hacia(contenido):
    """Divide el texto en la parte 'Desde' y la parte 'Hacia'."""
    desde, hacia = contenido.split('\nHacia\n', 1)
    return desde, hacia


def leer_monto(valor):
    """'$20.020' -> 20020"""
    return int(re.sub(r'\D', '', valor))


def leer_fecha(valor, formato):
    """Texto de la fecha -> datetime con la hora de Chile."""
    return datetime.strptime(valor, formato).replace(tzinfo=ZONA_CHILE)


def normalizar_rut(valor):
    """'12.345.678-5' -> '12345678-5' (sin puntos y con K mayúscula)."""
    return valor.replace('.', '').replace(' ', '').upper()
