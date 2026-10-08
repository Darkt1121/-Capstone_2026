from datetime import date
from io import StringIO

from django.conf import settings
from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse

from .categorias import categoria
from .forms import PerfilForm
from .importar import importar_correos
from .models import Movimiento, Perfil
from .plan import (
    calcular_resumen,
    calendario_del_mes,
    comparar_con_mes_anterior,
    movido_entre_cuentas,
    reparto_del_gasto,
    transferencias_por_persona,
)
from .views import agrupar_por_dia

CARPETA_EJEMPLOS = settings.BASE_DIR / 'correos_ejemplo'


class FinFlowTest(TestCase):
    def setUp(self):
        self.usuario = User.objects.create_user('valentina', password='clave-de-prueba-123')
        self.perfil = Perfil.objects.create(
            usuario=self.usuario, sueldo=850000, frecuencia_pago='mensual', meta_ahorro=10, rut='11111111-1'
        )

    def test_importar_no_repite_y_marca_propias(self):
        self.assertEqual(importar_correos(self.perfil, CARPETA_EJEMPLOS), (26, 0))
        self.assertEqual(importar_correos(self.perfil, CARPETA_EJEMPLOS), (0, 26))
        self.assertEqual(Movimiento.objects.filter(es_propia=True).count(), 7)
        self.assertEqual(Movimiento.objects.filter(tipo='ingreso').count(), 3)

    def test_resumen_mensual(self):
        importar_correos(self.perfil, CARPETA_EJEMPLOS)
        resumen = calcular_resumen(self.perfil, date(2026, 10, 7))
        self.assertEqual(resumen['ingreso'], 850000)
        self.assertEqual(resumen['gastado'], 300500)  # 250.000 + 13.000 + 7.500 + 30.000 (sin los 200.000 propios)
        self.assertEqual(resumen['libre'], 464500)  # 850.000 - 85.000 de ahorro - 300.500
        self.assertEqual(resumen['dias'], 25)  # del 7 al 31 de octubre
        self.assertEqual(resumen['por_dia'], 18580)

    def test_resumen_quincena(self):
        self.perfil.frecuencia_pago = 'quincena'
        importar_correos(self.perfil, CARPETA_EJEMPLOS)
        resumen = calcular_resumen(self.perfil, date(2026, 10, 7))
        self.assertEqual(resumen['ingreso'], 425000)
        self.assertEqual(resumen['libre'], 82000)  # 425.000 - 42.500 - 300.500
        self.assertEqual(resumen['dias'], 9)  # del 7 al 15 de octubre

    def test_categorias_por_reglas(self):
        persona = Movimiento(nombre='Diego Soto', rut='15678234-0')
        empresa = Movimiento(nombre='Comercial Los Andes SpA', rut='76543210-3')
        comision = Movimiento(nombre='Cargo mantención CuentaRUT', rut='97030000-7')
        self.assertEqual(categoria(persona), 'personas')
        self.assertEqual(categoria(empresa), 'otros')
        self.assertEqual(categoria(comision), 'comisiones')

    def test_secciones_del_dashboard_en_octubre(self):
        importar_correos(self.perfil, CARPETA_EJEMPLOS)
        hoy = date(2026, 10, 7)
        inicio, fin = date(2026, 10, 1), date(2026, 10, 31)

        reparto = {parte['clave']: parte['monto'] for parte in reparto_del_gasto(self.usuario, inicio, fin, 850000)}
        self.assertEqual(reparto, {'personas': 300500, 'comisiones': 0, 'otros': 0, 'sin-gastar': 549500})

        personas = [(p['nombre'], p['transferencias'], p['total']) for p in transferencias_por_persona(self.usuario, hoy)]
        self.assertEqual(personas, [
            ('Diego Soto Vergara', 3, 750000),
            ('Javiera Muñoz Pérez', 3, 95020),
            ('Camila Fuentes Díaz', 5, 85520),
            ('Matías Herrera Lagos', 5, 81000),
        ])

        movido = movido_entre_cuentas(self.usuario, inicio, fin)
        self.assertEqual((movido['total'], movido['cantidad'], movido['bancos']), (200000, 1, ['BancoEstado', 'MACH']))

        # 1 al 7 oct: $300.500 · 1 al 7 sep: $265.000 (arriendo + Camila) -> 13% más
        comparacion = comparar_con_mes_anterior(self.usuario, hoy)
        self.assertEqual((comparacion['diferencia'], comparacion['porcentaje']), (35500, 13))
        # Sin gastos el mes anterior (julio) no hay con qué comparar
        self.assertIsNone(comparar_con_mes_anterior(self.usuario, date(2026, 8, 7)))

    def test_calendario_de_octubre(self):
        importar_correos(self.perfil, CARPETA_EJEMPLOS)
        semanas, por_dia = calendario_del_mes(self.usuario, date(2026, 10, 1))
        dias = {dia['fecha']: dia for semana in semanas for dia in semana}
        # La grilla parte el lunes 28 de septiembre (día de otro mes, deshabilitado)
        self.assertEqual(semanas[0][0]['fecha'], date(2026, 9, 28))
        self.assertFalse(semanas[0][0]['del_mes'])
        # 1 oct: arriendo $250.000 (el más alto) -> nivel 4; 2 oct sin gasto -> 0; 3 oct $13.000 -> 1
        self.assertEqual((dias[date(2026, 10, 1)]['gasto'], dias[date(2026, 10, 1)]['nivel']), (250000, 4))
        self.assertEqual(dias[date(2026, 10, 2)]['nivel'], 0)
        self.assertEqual(dias[date(2026, 10, 3)]['nivel'], 1)
        self.assertEqual(sum(por_dia.values()), 300500)

    def test_paginas_calendario_y_dia(self):
        importar_correos(self.perfil, CARPETA_EJEMPLOS)
        self.client.force_login(self.usuario)
        septiembre = self.client.get(reverse('calendario'), {'mes': '2026-09'})
        self.assertEqual(septiembre.context['mes_nombre'], 'Septiembre 2026')
        self.assertEqual(len(septiembre.context['grafico']['montos']), 30)
        dia = self.client.get(reverse('dia', args=['2026-10-01']))
        self.assertEqual(dia.context['gastado'], 250000)  # sin los $200.000 a su propia cuenta MACH
        self.assertContains(dia, 'Entre tus cuentas')
        self.assertContains(dia, '09:05')
        self.assertEqual(self.client.get(reverse('dia', args=['2026-13-45'])).status_code, 404)

    def test_rut_se_guarda_sin_puntos(self):
        form = PerfilForm(data={'sueldo': 500000, 'frecuencia_pago': 'variable', 'meta_ahorro': 5, 'rut': '12.345.678-k'})
        self.assertTrue(form.is_valid())
        self.assertEqual(form.cleaned_data['rut'], '12345678-K')

    def test_sin_login_va_al_login(self):
        self.assertRedirects(self.client.get(reverse('inicio')), f"{reverse('login')}?next=/")

    def test_sin_perfil_va_a_configuracion(self):
        nuevo = User.objects.create_user('nuevo', password='clave-de-prueba-123')
        self.client.force_login(nuevo)
        self.assertRedirects(self.client.get(reverse('inicio')), reverse('configuracion'))
        self.assertContains(self.client.get(reverse('configuracion')), 'Configura tu cuenta')
        datos = {'sueldo': 600000, 'frecuencia_pago': 'quincena', 'meta_ahorro': 15, 'rut': '12.345.678-5'}
        self.assertRedirects(self.client.post(reverse('configuracion'), datos), reverse('inicio'))
        self.assertEqual(Perfil.objects.get(usuario=nuevo).rut, '12345678-5')

    def test_buscar_movimientos_por_nombre_y_monto(self):
        importar_correos(self.perfil, CARPETA_EJEMPLOS)
        self.client.force_login(self.usuario)
        self.assertEqual(self.client.get(reverse('movimientos'), {'q': 'camila'}).context['cantidad'], 5)
        self.assertEqual(self.client.get(reverse('movimientos'), {'q': 'matias'}).context['cantidad'], 5)
        self.assertEqual(self.client.get(reverse('movimientos'), {'q': '$20.020'}).context['cantidad'], 2)

    def test_agrupar_por_dia(self):
        importar_correos(self.perfil, CARPETA_EJEMPLOS)
        grupos = agrupar_por_dia(Movimiento.objects.filter(usuario=self.usuario)[:3], date(2026, 10, 7))
        self.assertEqual([titulo for titulo, _ in grupos], ['Ayer', 'Lunes 5 de octubre', 'Sábado 3 de octubre'])

    def test_dashboard_muestra_los_numeros(self):
        importar_correos(self.perfil, CARPETA_EJEMPLOS)
        self.client.force_login(self.usuario)
        respuesta = self.client.get(reverse('inicio'))
        self.assertContains(respuesta, 'Puedes gastar')
        self.assertContains(respuesta, '¿A dónde va tu plata?')
        self.assertContains(respuesta, 'Transferencias por persona')
        self.assertContains(respuesta, 'Movido entre tus cuentas')
        self.assertEqual(sum(len(lista) for _, lista in respuesta.context['dias_con_movimientos']), 8)
        self.assertContains(respuesta, '$850.000')
        self.assertContains(respuesta, 'text-bg-bancoestado')
        self.assertContains(respuesta, 'text-bg-mach')
        self.assertContains(respuesta, 'progress-stacked')
        self.assertContains(respuesta, 'id="datos-grafico"')
        self.assertContains(respuesta, 'Entre tus cuentas')


class CargarDemoTest(TestCase):
    def test_cargar_demo_dos_veces_no_repite(self):
        call_command('cargar_demo', stdout=StringIO())
        call_command('cargar_demo', stdout=StringIO())
        demo = User.objects.get(username='demo')
        self.assertTrue(demo.check_password('demo1234'))
        self.assertEqual(Perfil.objects.get(usuario=demo).rut, '11111111-1')
        self.assertEqual(Movimiento.objects.filter(usuario=demo).count(), 26)
