from datetime import datetime
from email.message import EmailMessage
from pathlib import Path
from unittest import TestCase

from . import correo_desde_bytes, leer_correo
from .utiles import ZONA_CHILE

CARPETA_EJEMPLOS = Path(__file__).resolve().parent.parent / 'correos_ejemplo'


def leer_ejemplo(nombre_archivo):
    return leer_correo(correo_desde_bytes((CARPETA_EJEMPLOS / nombre_archivo).read_bytes()))


class LectoresTest(TestCase):
    def test_todos_los_ejemplos_se_leen(self):
        archivos = list(CARPETA_EJEMPLOS.glob('*.eml'))
        self.assertTrue(archivos)
        for archivo in archivos:
            with self.subTest(archivo=archivo.name):
                movimiento = leer_ejemplo(archivo.name)
                self.assertIsNotNone(movimiento)
                self.assertTrue(all(valor is not None for clave, valor in movimiento.items() if clave != 'mensaje'))

    def test_bancoestado_tef_a_cuenta_propia(self):
        movimiento = leer_ejemplo('2026-08-01_1020_bancoestado_tef.eml')
        self.assertEqual(movimiento['banco'], 'BancoEstado')
        self.assertEqual(movimiento['direccion'], 'sale')
        self.assertEqual(movimiento['monto'], 200000)
        self.assertEqual(movimiento['fecha'], datetime(2026, 8, 1, 10, 20, 41, tzinfo=ZONA_CHILE))
        self.assertEqual(movimiento['codigo'], '4810024206')
        self.assertEqual(movimiento['nombre'], 'Valentina Rojas Soto')
        self.assertEqual(movimiento['rut'], '11111111-1')
        self.assertEqual(movimiento['banco_contraparte'], 'Bci/machbank')

    def test_bancoestado_sueldo(self):
        movimiento = leer_ejemplo('2026-07-31_1805_bancoestado_tef_recibida.eml')
        self.assertEqual(movimiento['direccion'], 'entra')
        self.assertEqual(movimiento['monto'], 850000)
        self.assertEqual(movimiento['nombre'], 'Comercial Los Andes SpA')

    def test_mach_transferencia(self):
        movimiento = leer_ejemplo('2026-08-22_1910_mach_transferencia.eml')
        self.assertEqual(movimiento['banco'], 'MACH')
        self.assertEqual(movimiento['direccion'], 'sale')
        self.assertEqual(movimiento['monto'], 38000)
        self.assertEqual(movimiento['fecha'], datetime(2026, 8, 22, 19, 10, 45, tzinfo=ZONA_CHILE))
        self.assertEqual(movimiento['codigo'], 'UAZNPOVR')
        self.assertEqual(movimiento['nombre'], 'Matías Herrera Lagos')
        self.assertEqual(movimiento['rut'], '19456123-7')
        self.assertEqual(movimiento['mensaje'], 'entradas concierto')

    def test_correo_desconocido_se_ignora(self):
        correo = EmailMessage()
        correo['From'] = 'ofertas@tienda.example.com'
        correo['Subject'] = 'Descuentos'
        correo.set_content('<p>Hola</p>', subtype='html')
        self.assertIsNone(leer_correo(correo))
