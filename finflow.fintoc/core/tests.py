"""Pruebas del servidor: cuentas, confirmación de correo, recuperar contraseña y seguridad.

Se corren con:  docker compose run --rm web python manage.py test
Django crea una base de datos de prueba aparte y guarda los correos en memoria (no los envía).
"""

import json
import re

from django.core import mail
from django.core.cache import cache
from django.test import Client, TestCase

from .models import Usuario

CLAVE = 'clave-segura-123'


class Base(TestCase):
    def setUp(self):
        cache.clear()   # los límites de intentos se guardan en la caché
        self.c = Client()

    def post(self, ruta, datos, cliente=None):
        r = (cliente or self.c).post(ruta, json.dumps(datos), content_type='application/json')
        return r, (r.json() if r.headers.get('Content-Type', '').startswith('application/json') else None)

    def registrar(self, email='ana@example.com'):
        return self.post('/api/registro', {'email': email, 'nombre': 'Ana Pérez', 'clave': CLAVE})

    def link_del_correo(self, correo):
        return re.search(r'http://testserver(/\S+)', correo.body).group(1)


class CuentasTest(Base):
    def test_registro_crea_la_cuenta_sin_confirmar(self):
        r, j = self.registrar()
        self.assertEqual(r.status_code, 200)
        self.assertEqual(j['usuario'], {'email': 'ana@example.com', 'nombre': 'Ana Pérez', 'confirmado': False})
        u = Usuario.objects.get(email='ana@example.com')
        self.assertTrue(u.password.startswith('scrypt$'))   # la contraseña se guarda solo como hash scrypt
        self.assertNotIn(CLAVE, u.password)

    def test_no_se_repite_el_correo(self):
        self.registrar()
        r, j = self.registrar()
        self.assertEqual(r.status_code, 409)

    def test_entrar_y_clave_mala(self):
        self.registrar()
        self.c.post('/api/logout')
        r, _ = self.post('/api/login', {'email': 'ana@example.com', 'clave': 'mala'})
        self.assertEqual(r.status_code, 401)
        r, j = self.post('/api/login', {'email': 'ANA@example.com', 'clave': CLAVE})
        self.assertEqual(r.status_code, 200)

    def test_limite_de_intentos(self):
        self.registrar()
        self.c.post('/api/logout')
        estados = [self.post('/api/login', {'email': 'ana@example.com', 'clave': f'mala{i}'})[0].status_code for i in range(6)]
        self.assertEqual(estados, [401] * 5 + [429])
        r, _ = self.post('/api/login', {'email': 'ana@example.com', 'clave': CLAVE})
        self.assertEqual(r.status_code, 429)   # bloqueado: ni la clave buena entra

    def test_sin_sesion_no_hay_datos(self):
        self.assertEqual(self.c.get('/api/datos').status_code, 401)

    def test_csrf_protege_los_cambios(self):
        estricto = Client(enforce_csrf_checks=True)
        r, _ = self.post('/api/registro', {'email': 'x@example.com', 'nombre': 'X', 'clave': CLAVE}, cliente=estricto)
        self.assertEqual(r.status_code, 403)
        self.assertFalse(Usuario.objects.filter(email='x@example.com').exists())

    def test_cada_usuario_ve_solo_lo_suyo(self):
        self.registrar('ana@example.com')
        self.post('/api/cuentas', {'id': 'a1', 'name': 'CuentaRUT', 'rows': [{'date': '2026-10-01', 'description': 'PAGO JUMBO', 'amount': -1000, '_line': 0}]})
        otro = Client()
        self.post('/api/registro', {'email': 'beto@example.com', 'nombre': 'Beto', 'clave': CLAVE}, cliente=otro)
        datos = otro.get('/api/datos').json()
        self.assertEqual(datos['accounts'], [])
        r = otro.delete('/api/cuentas?id=a1')
        self.assertEqual(len(self.c.get('/api/datos').json()['accounts']), 1)   # no pudo borrar la de Ana


class ConfirmarCorreoTest(Base):
    def test_al_registrarse_llega_el_correo_y_el_link_confirma(self):
        self.registrar()
        self.assertEqual(len(mail.outbox), 1)
        correo = mail.outbox[0]
        self.assertEqual(correo.to, ['ana@example.com'])
        self.assertIn('Confirma tu correo', correo.subject)
        r = self.c.get(self.link_del_correo(correo))
        self.assertRedirects(r, '/?correo=confirmado', fetch_redirect_response=False)
        self.assertTrue(Usuario.objects.get(email='ana@example.com').correo_confirmado)
        self.assertTrue(self.c.get('/api/sesion').json()['usuario']['confirmado'])

    def test_link_alterado_no_sirve(self):
        self.registrar()
        link = self.link_del_correo(mail.outbox[0])
        r = self.c.get(link[:-3] + 'abc')
        self.assertRedirects(r, '/?correo=vencido', fetch_redirect_response=False)
        self.assertFalse(Usuario.objects.get(email='ana@example.com').correo_confirmado)

    def test_reenviar_tiene_limite(self):
        self.registrar()
        estados = [self.post('/api/correo/reenviar', {})[0].status_code for _ in range(4)]
        self.assertEqual(estados, [200, 200, 200, 429])


class RecuperarClaveTest(Base):
    def setUp(self):
        super().setUp()
        self.registrar()
        self.c.post('/api/logout')
        mail.outbox.clear()

    def pedir_link(self, email='ana@example.com'):
        return self.post('/api/clave/olvide', {'email': email})

    def codigo(self):
        link = self.link_del_correo(mail.outbox[-1])
        uid, token = link.split('recuperar=')[1].split('.')
        return uid, token

    def test_responde_igual_exista_o_no_la_cuenta(self):
        r1, j1 = self.pedir_link('ana@example.com')
        r2, j2 = self.pedir_link('nadie@example.com')
        self.assertEqual((r1.status_code, j1), (r2.status_code, j2))
        self.assertEqual(len(mail.outbox), 1)   # solo se envió a la cuenta que existe

    def test_crear_contrasena_nueva_y_entrar(self):
        self.pedir_link()
        uid, token = self.codigo()
        r, j = self.post('/api/clave/nueva', {'uid': uid, 'token': token, 'clave': 'otra-clave-456'})
        self.assertEqual(r.status_code, 200)
        self.assertTrue(j['usuario']['confirmado'])   # demostró que el correo es suyo
        self.c.post('/api/logout')
        self.assertEqual(self.post('/api/login', {'email': 'ana@example.com', 'clave': CLAVE})[0].status_code, 401)
        self.assertEqual(self.post('/api/login', {'email': 'ana@example.com', 'clave': 'otra-clave-456'})[0].status_code, 200)

    def test_el_link_sirve_una_sola_vez(self):
        self.pedir_link()
        uid, token = self.codigo()
        self.post('/api/clave/nueva', {'uid': uid, 'token': token, 'clave': 'otra-clave-456'})
        r, j = self.post('/api/clave/nueva', {'uid': uid, 'token': token, 'clave': 'tercera-clave-789'})
        self.assertEqual(r.status_code, 400)

    def test_link_falso_no_sirve(self):
        self.pedir_link()
        uid, _ = self.codigo()
        r, _ = self.post('/api/clave/nueva', {'uid': uid, 'token': 'inventado', 'clave': 'otra-clave-456'})
        self.assertEqual(r.status_code, 400)

    def test_cambiar_la_clave_cierra_las_otras_sesiones(self):
        otro_dispositivo = Client()
        self.post('/api/login', {'email': 'ana@example.com', 'clave': CLAVE}, cliente=otro_dispositivo)
        self.assertIsNotNone(otro_dispositivo.get('/api/sesion').json()['usuario'])
        self.pedir_link()
        uid, token = self.codigo()
        self.post('/api/clave/nueva', {'uid': uid, 'token': token, 'clave': 'otra-clave-456'})
        self.assertIsNone(otro_dispositivo.get('/api/sesion').json()['usuario'])
