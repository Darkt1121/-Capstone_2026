"""Rutas de FinFlow (/api/...). Responden JSON con las mismas formas que espera la página.

La llave secreta de Fintoc, la de Groq y el link_token del banco nunca salen del servidor: al
navegador solo llegan los movimientos ya convertidos y un resumen de los números.
"""

import base64
import binascii
import json
import re
from datetime import date, timedelta
from functools import wraps

from django.conf import settings
from django.contrib import admin
from django.contrib.auth import authenticate, login, logout
from django.core.cache import cache
from django.db import DatabaseError, transaction
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie

from . import externos
from .models import (Ajustes, Boleta, ConexionBancaria, Cuenta, MetaAhorro, Movimiento, Notificacion,
                     Presupuesto, Regla, Usuario)


# ---------- piezas comunes ----------

class Fallo(Exception):
    """Error que se le muestra al usuario, con su código HTTP."""

    def __init__(self, status, mensaje):
        super().__init__(mensaje)
        self.status = status


def ruta(*metodos, sesion=False):
    """Decorador de las rutas: método permitido, cuerpo JSON, usuario obligatorio y errores en JSON."""

    def envolver(vista):
        @wraps(vista)
        def interna(request, *args, **kwargs):
            if request.method not in metodos:
                return JsonResponse({'error': 'No encontrado'}, status=404)
            try:
                if sesion and not request.user.is_authenticated:
                    raise Fallo(401, 'Inicia sesión para continuar.')
                cuerpo = {}
                if request.method in ('POST', 'PUT') and request.body:
                    try:
                        cuerpo = json.loads(request.body.decode('utf-8'))
                    except (ValueError, UnicodeDecodeError):
                        raise Fallo(400, 'JSON inválido')
                    if not isinstance(cuerpo, dict):
                        raise Fallo(400, 'JSON inválido')
                respuesta = vista(request, cuerpo, *args, **kwargs)
                return respuesta if isinstance(respuesta, HttpResponse) else JsonResponse(respuesta, safe=False)
            except Fallo as e:
                return JsonResponse({'error': str(e)}, status=e.status)
            except DatabaseError:
                # Los errores de la base de datos no se muestran: pueden revelar cómo está hecha.
                return JsonResponse({'error': 'No pudimos guardar o leer tus datos. Inténtalo de nuevo.'}, status=500)
            except externos.ErrorExterno as e:
                return JsonResponse({'error': str(e)}, status=e.status if e.status < 500 else 502)
        return interna
    return envolver


def direccion(request):
    return request.META.get('REMOTE_ADDR') or ''


def limitar(request, accion, maximo, segundos, mensaje):
    """Cuenta cuántas veces se usó una acción desde la misma dirección y corta al pasar el máximo.
    Protege lo que se puede usar sin cuenta (crear cuentas, el asistente) de que lo abusen con un script."""
    llave = f'limite:{accion}:{direccion(request)}'
    usos = cache.get(llave, 0)
    if usos >= maximo:
        raise Fallo(429, mensaje)
    cache.set(llave, usos + 1, segundos)


def entero(valor):
    """Los montos son pesos enteros. Rechaza lo que no sea número o no quepa en la base de datos."""
    try:
        n = round(float(valor))
    except (TypeError, ValueError, OverflowError):
        raise Fallo(400, 'Hay un monto inválido.')
    if abs(n) > 2_000_000_000:
        raise Fallo(400, 'Hay un monto inválido.')
    return n


def lista(cuerpo, maximo):
    if not isinstance(cuerpo.get('lista'), list):
        raise Fallo(400, 'Falta la lista.')
    if len(cuerpo['lista']) > maximo:
        raise Fallo(400, f'Puedes guardar hasta {maximo}.')
    return [x if isinstance(x, dict) else {} for x in cuerpo['lista']]


def texto(valor, largo):
    return str(valor if valor is not None else '').strip()[:largo]


def es_fecha(valor):
    return isinstance(valor, str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}', valor) is not None


def datos_usuario(u):
    return {'usuario': {'email': u.email, 'nombre': u.nombre}}


# ---------- la página ----------

def no_encontrado(request):
    return JsonResponse({'error': 'No encontrado'}, status=404)


def entrar_admin(request):
    """Login del panel de administración con el mismo límite que la página: 5 intentos malos
    desde la misma dirección bloquean 15 minutos."""
    llave = 'intentos-admin:' + direccion(request)
    if request.method == 'POST' and cache.get(llave, 0) >= MAX_INTENTOS:
        return HttpResponse('Demasiados intentos. Espera unos minutos y vuelve a probar.', status=429, content_type='text/plain; charset=utf-8')
    respuesta = admin.site.login(request)
    if request.method == 'POST':
        if request.user.is_authenticated and request.user.is_staff:
            cache.delete(llave)
        else:
            cache.set(llave, cache.get(llave, 0) + 1, 15 * 60)
    return respuesta


@ensure_csrf_cookie
def pagina(request):
    """Entrega index.html y deja la cookie del token CSRF que la página manda en cada cambio."""
    return HttpResponse((settings.PUBLIC_DIR / 'index.html').read_text(encoding='utf-8'), content_type='text/html; charset=utf-8')


# ---------- configuración y cuentas de usuario ----------

@ruta('GET')
def config(request, cuerpo):
    return {'enabled': externos.fintoc_activo(), 'asistente': bool(settings.GROQ_API_KEY),
            'googleClientId': settings.GOOGLE_CLIENT_ID, 'contacto': settings.CONTACT_EMAIL}


@ruta('POST')
def login_google(request, cuerpo):
    """El navegador manda el token que le dio Google; se comprueba con Google que sea auténtico."""
    if not settings.GOOGLE_CLIENT_ID:
        raise Fallo(503, 'El inicio de sesión con Google no está configurado.')
    limitar(request, 'google', 20, 15 * 60, 'Demasiados intentos. Espera unos minutos y vuelve a probar.')
    g = externos.google_token(str(cuerpo.get('credential') or ''))
    if not g or g.get('aud') != settings.GOOGLE_CLIENT_ID or g.get('email_verified') != 'true':
        raise Fallo(401, 'No pudimos comprobar tu cuenta de Google.')
    u = Usuario.objects.filter(google_id=g['sub']).first()
    if not u:
        email = g['email'].lower()
        if Usuario.objects.filter(email=email).exists():
            raise Fallo(409, 'Ya tienes una cuenta con ese correo. Entra con tu contraseña.')
        u = Usuario.objects.create_user(email, None, nombre=(g.get('name') or email)[:80], google_id=g['sub'])
    login(request, u, backend='django.contrib.auth.backends.ModelBackend')
    return datos_usuario(u)


@ruta('POST')
def registro(request, cuerpo):
    email = texto(cuerpo.get('email'), 300).lower()
    nombre = texto(cuerpo.get('nombre'), 80)
    clave = str(cuerpo.get('clave') or '')
    if len(email) > 254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
        raise Fallo(400, 'Escribe un correo válido.')
    if not nombre:
        raise Fallo(400, 'Escribe tu nombre.')
    if len(clave) < 8 or len(clave) > 200:
        raise Fallo(400, 'La contraseña debe tener al menos 8 caracteres.')
    if Usuario.objects.filter(email=email).exists():
        raise Fallo(409, 'Ya existe una cuenta con ese correo.')
    # Hasta 5 cuentas nuevas por hora desde la misma dirección.
    limitar(request, 'registro', 5, 60 * 60, 'Ya se crearon varias cuentas desde aquí. Prueba de nuevo en una hora.')
    u = Usuario.objects.create_user(email, clave, nombre=nombre)
    login(request, u, backend='django.contrib.auth.backends.ModelBackend')
    return datos_usuario(u)


MAX_INTENTOS = 5


@ruta('POST')
def entrar(request, cuerpo):
    """Límite: 5 contraseñas malas para el mismo correo desde la misma dirección bloquean 15 minutos."""
    email = texto(cuerpo.get('email'), 300).lower()
    llave = 'intentos:' + email + '|' + direccion(request)
    if cache.get(llave, 0) >= MAX_INTENTOS:
        raise Fallo(429, 'Demasiados intentos. Espera unos minutos y vuelve a probar.')
    u = authenticate(request, email=email, password=str(cuerpo.get('clave') or '')[:200])
    if not u:
        cache.set(llave, cache.get(llave, 0) + 1, 15 * 60)
        raise Fallo(401, 'Correo o contraseña incorrectos.')
    cache.delete(llave)
    login(request, u)   # Django crea un identificador de sesión nuevo al entrar
    return datos_usuario(u)


@ruta('GET')
def sesion(request, cuerpo):
    u = request.user
    return {'usuario': {'email': u.email, 'nombre': u.nombre} if u.is_authenticated else None}


@ruta('POST')
def salir(request, cuerpo):
    logout(request)
    return {'ok': True}


@ruta('DELETE', sesion=True)
def borrar_usuario(request, cuerpo):
    """Borra al usuario. Sus cuentas, movimientos, ajustes, boletas, etc. se van con él (CASCADE)."""
    u = request.user
    logout(request)
    u.delete()
    return {'ok': True}


# ---------- datos del usuario ----------

@ruta('GET', sesion=True)
def datos(request, cuerpo):
    """Todos los datos del usuario, en el mismo formato que usa la página."""
    u = request.user
    a = Ajustes.objects.filter(usuario=u).first()
    cuentas = []
    for c in Cuenta.objects.filter(usuario=u).order_by('id'):
        filas = [{'date': m.fecha.isoformat(), 'description': m.descripcion, 'amount': m.monto, 'balance': m.saldo, '_line': m.linea}
                 for m in c.movimientos.order_by('orden')]
        if filas:
            cuentas.append({'id': c.clave, 'name': c.nombre, 'bank': c.banco, 'source': c.origen, 'rows': filas})
    fecha = None
    if a and a.consentimiento_fecha:
        fecha = timezone.localtime(a.consentimiento_fecha).strftime('%d/%m/%Y')
    return {
        'holder': a.titular if a else '', 'consent': a.consentimiento if a else False,
        'policy': a.politica_version if a else None, 'consentDate': fecha,
        'minimum': a.saldo_minimo if a else None, 'rules': a.correcciones if a else None,
        'accounts': cuentas,
        'reglas': list(u.reglas.order_by('id').values('texto', 'categoria', 'ambito')),
        'presupuestos': list(u.presupuestos.order_by('categoria').values('categoria', 'monto')),
        'metas': [{'nombre': m.nombre, 'monto': m.monto, 'fecha': m.fecha.isoformat(), 'aporte': m.aporte, 'ahorrado': m.ahorrado}
                  for m in u.metas.order_by('id')],
        'boletas': [{'id': b.id, 'movimiento': b.movimiento, 'nombre': b.nombre, 'tipo': b.tipo, 'tamano': len(b.datos)}
                    for b in u.boletas.all()],
        'notificaciones': [{'clave': n.clave, 'nivel': n.nivel, 'titulo': n.titulo, 'texto': n.texto,
                            'creada': n.creada.isoformat(), 'leida': n.leida, 'borrada': n.borrada}
                           for n in u.notificaciones.order_by('-creada')[:300]],
    }


@ruta('PUT', sesion=True)
def ajustes(request, cuerpo):
    """Guarda los ajustes. Del consentimiento queda la prueba: qué versión aceptó y cuándo.
    La fecha la pone el servidor y solo cambia al aceptar por primera vez o al aceptar una versión nueva."""
    acepta = cuerpo.get('consent') is True
    version = texto(cuerpo.get('policy'), 20) if acepta else None
    a, _ = Ajustes.objects.get_or_create(usuario=request.user)
    if not acepta:
        a.consentimiento_fecha = None
    elif not (a.consentimiento and a.politica_version == version and a.consentimiento_fecha):
        a.consentimiento_fecha = timezone.now()
    a.titular = texto(cuerpo.get('holder'), 120)
    a.consentimiento = acepta
    a.politica_version = version
    a.saldo_minimo = entero(cuerpo.get('minimum'))
    a.correcciones = cuerpo.get('rules') if isinstance(cuerpo.get('rules'), dict) else {}
    a.save()
    return {'ok': True}


@ruta('POST', 'DELETE', sesion=True)
def cuentas(request, cuerpo):
    """POST guarda una cuenta con sus movimientos; DELETE ?id= la quita."""
    if request.method == 'POST':
        return guardar_cuenta(request.user, cuerpo)
    return borrar_cuenta(request.user, str(request.GET.get('id') or ''))


def guardar_cuenta(u, cuerpo):
    """Guarda una cuenta con todos sus movimientos (reemplaza los que tenía). Va en una transacción:
    o se guarda todo o no se guarda nada."""
    clave = texto(cuerpo.get('id'), 100)
    filas = cuerpo.get('rows') if isinstance(cuerpo.get('rows'), list) else []
    if not clave or not filas or len(filas) > 20000:
        raise Fallo(400, 'La cuenta no tiene movimientos válidos.')
    if any(not isinstance(f, dict) or not es_fecha(f.get('date')) for f in filas):
        raise Fallo(400, 'Hay un movimiento con una fecha inválida.')
    with transaction.atomic():
        cuenta, _ = Cuenta.objects.update_or_create(usuario=u, clave=clave, defaults={
            'nombre': texto(cuerpo.get('name'), 80) or 'Cuenta', 'banco': texto(cuerpo.get('bank'), 80),
            'origen': 'fintoc' if cuerpo.get('source') == 'fintoc' else 'cartola'})
        if Cuenta.objects.filter(usuario=u).count() > 3:
            raise Fallo(400, 'Ya tienes 3 cuentas. Quita una para agregar otra.')
        cuenta.movimientos.all().delete()
        Movimiento.objects.bulk_create([
            Movimiento(cuenta=cuenta, orden=i + 1, linea=entero(f.get('_line')), fecha=date.fromisoformat(f['date']),
                       descripcion=texto(f.get('description'), 300), monto=entero(f.get('amount')),
                       saldo=None if f.get('balance') is None else entero(f.get('balance')))
            for i, f in enumerate(filas)])
    return {'ok': True}


def borrar_cuenta(u, clave):
    Cuenta.objects.filter(usuario=u, clave=clave).delete()
    # Las boletas de esa cuenta se van con ella (su identificador parte con la clave de la cuenta).
    Boleta.objects.filter(usuario=u, movimiento__startswith=clave + ':').delete()
    return {'ok': True}


# ---------- reglas, presupuestos y metas (la página manda la lista completa) ----------

def reemplazar(modelo, usuario, objetos):
    with transaction.atomic():
        modelo.objects.filter(usuario=usuario).delete()
        modelo.objects.bulk_create(objetos)


@ruta('PUT', sesion=True)
def reglas(request, cuerpo):
    objetos = []
    for r in lista(cuerpo, 200):
        t, cat = texto(r.get('texto'), 60).upper(), texto(r.get('categoria'), 40).lower()
        if len(t) < 2 or not cat:
            raise Fallo(400, 'Cada regla necesita un texto de al menos 2 letras y una categoría.')
        objetos.append(Regla(usuario=request.user, texto=t, categoria=cat, ambito='negocio' if r.get('ambito') == 'negocio' else 'personal'))
    if len({o.texto for o in objetos}) != len(objetos):
        raise Fallo(400, 'Hay dos reglas con el mismo texto.')
    reemplazar(Regla, request.user, objetos)
    return {'ok': True}


@ruta('PUT', sesion=True)
def presupuestos(request, cuerpo):
    objetos = []
    for p in lista(cuerpo, 50):
        cat, monto = texto(p.get('categoria'), 40).lower(), entero(p.get('monto'))
        if not cat or monto <= 0:
            raise Fallo(400, 'Cada presupuesto necesita una categoría y un monto mayor que cero.')
        objetos.append(Presupuesto(usuario=request.user, categoria=cat, monto=monto))
    if len({o.categoria for o in objetos}) != len(objetos):
        raise Fallo(400, 'Hay dos presupuestos para la misma categoría.')
    reemplazar(Presupuesto, request.user, objetos)
    return {'ok': True}


@ruta('PUT', sesion=True)
def metas(request, cuerpo):
    objetos = []
    for m in lista(cuerpo, 20):
        nombre, fecha = texto(m.get('nombre'), 60), m.get('fecha')
        monto, aporte, ahorrado = entero(m.get('monto')), entero(m.get('aporte') or 0), entero(m.get('ahorrado') or 0)
        if not nombre or monto <= 0 or not es_fecha(fecha) or aporte < 0 or ahorrado < 0:
            raise Fallo(400, 'Revisa la meta: necesita nombre, monto, fecha y montos que no sean negativos.')
        objetos.append(MetaAhorro(usuario=request.user, nombre=nombre, monto=monto, fecha=date.fromisoformat(fecha), aporte=aporte, ahorrado=ahorrado))
    reemplazar(MetaAhorro, request.user, objetos)
    return {'ok': True}


# ---------- boletas ----------

MAX_BOLETA = 2 * 1024 * 1024


def tipo_de_archivo(b):
    """El tipo se decide por los primeros bytes del archivo, no por su nombre."""
    if b[:5] == b'%PDF-':
        return 'application/pdf'
    if b[:3] == b'\xff\xd8\xff':
        return 'image/jpeg'
    if b[:8] == b'\x89PNG\r\n\x1a\n':
        return 'image/png'
    return None


@ruta('POST', 'DELETE', sesion=True)
def boletas(request, cuerpo):
    """POST adjunta una boleta a un movimiento; DELETE ?id= la quita."""
    if request.method == 'POST':
        return subir_boleta(request.user, cuerpo)
    Boleta.objects.filter(usuario=request.user, id=entero(request.GET.get('id'))).delete()
    return {'ok': True}


def subir_boleta(u, cuerpo):
    movimiento = texto(cuerpo.get('movimiento'), 200)
    try:
        datos_ = base64.b64decode(str(cuerpo.get('datos') or ''), validate=False)
    except (binascii.Error, ValueError):
        datos_ = b''
    if not movimiento:
        raise Fallo(400, 'Falta el movimiento.')
    if not datos_ or len(datos_) > MAX_BOLETA:
        raise Fallo(400, 'La boleta debe pesar menos de 2 MB.')
    tipo = tipo_de_archivo(datos_)
    if not tipo:
        raise Fallo(400, 'La boleta debe ser un PDF, JPG o PNG.')
    if Boleta.objects.filter(usuario=u).exclude(movimiento=movimiento).count() >= 300:
        raise Fallo(400, 'Llegaste al máximo de 300 boletas.')
    nombre = re.sub(r'[^\w.\- áéíóúñÁÉÍÓÚÑ]', '', str(cuerpo.get('nombre') or 'boleta'))[:80] or 'boleta'
    b, _ = Boleta.objects.update_or_create(usuario=u, movimiento=movimiento, defaults={'nombre': nombre, 'tipo': tipo, 'datos': datos_})
    return {'id': b.id, 'movimiento': b.movimiento, 'nombre': b.nombre, 'tipo': b.tipo, 'tamano': len(datos_)}


@ruta('GET', sesion=True)
def archivo_boleta(request, cuerpo):
    b = Boleta.objects.filter(usuario=request.user, id=entero(request.GET.get('id'))).first()
    if not b:
        raise Fallo(404, 'No encontramos esa boleta.')
    r = HttpResponse(bytes(b.datos), content_type=b.tipo)
    r['Cache-Control'] = 'private, no-store'
    r['X-Content-Type-Options'] = 'nosniff'
    r['Content-Disposition'] = 'inline; filename="' + re.sub(r'[^\w.\-]', '_', b.nombre) + '"'
    return r


# ---------- notificaciones ----------

@ruta('POST', 'DELETE', sesion=True)
def notificaciones(request, cuerpo):
    u = request.user
    if request.method == 'DELETE':
        # Borrar: queda marcada como borrada para que no vuelva a aparecer.
        if request.GET.get('todas') == '1':
            u.notificaciones.update(borrada=True)
        else:
            u.notificaciones.filter(clave=str(request.GET.get('clave') or '')).update(borrada=True)
        return {'ok': True}
    # La página manda los avisos nuevos; si la clave ya existe (aunque esté borrada) no se crea de nuevo.
    nuevas = []
    for n in lista(cuerpo, 50):
        clave = texto(n.get('clave'), 200)
        if not clave:
            continue
        obj, creada = Notificacion.objects.get_or_create(usuario=u, clave=clave, defaults={
            'nivel': n.get('nivel') if n.get('nivel') in ('info', 'warning', 'danger') else 'info',
            'titulo': texto(n.get('titulo'), 200), 'texto': texto(n.get('texto'), 500)})
        if creada:
            nuevas.append({'clave': obj.clave, 'creada': obj.creada.isoformat()})
    # Se guardan las 300 más recientes.
    viejas = list(u.notificaciones.order_by('-creada').values_list('id', flat=True)[300:])
    if viejas:
        Notificacion.objects.filter(id__in=viejas).delete()
    return {'nuevas': nuevas}


@ruta('PUT', sesion=True)
def notificaciones_leidas(request, cuerpo):
    request.user.notificaciones.filter(leida=False).update(leida=True)
    return {'ok': True}


# ---------- Fintoc ----------

def exigir_fintoc():
    if not externos.fintoc_activo():
        raise Fallo(503, 'El servidor no tiene llaves de Fintoc configuradas (.env).')


@ruta('POST', sesion=True)
def fintoc_link_intent(request, cuerpo):
    """1) Crea el Link Intent y entrega solo el widget_token y la llave pública."""
    exigir_fintoc()
    li = externos.fintoc('POST', '/link_intents', body={'country': 'cl', 'holder_type': 'individual', 'product': 'movements'})
    return {'widgetToken': li['widget_token'], 'publicKey': settings.FINTOC_PUBLIC_KEY}


@ruta('POST', sesion=True)
def fintoc_exchange(request, cuerpo):
    """2) Cambia el exchange_token por el link_token y lo guarda en el servidor."""
    exigir_fintoc()
    if not cuerpo.get('exchangeToken'):
        raise Fallo(400, 'Falta exchangeToken.')
    link = externos.fintoc('GET', '/links/exchange', query={'exchange_token': cuerpo['exchangeToken']})
    ConexionBancaria.objects.update_or_create(usuario=request.user, defaults={
        'link_token': link['link_token'], 'institucion': (link.get('institution') or {}).get('name') or 'Banco'})
    return {'ok': True}


@ruta('GET', sesion=True)
def fintoc_movimientos(request, cuerpo):
    """3) Trae cuentas y movimientos y los entrega listos para FinFlow (solo cuentas en pesos)."""
    exigir_fintoc()
    con = ConexionBancaria.objects.filter(usuario=request.user).first()
    if not con:
        raise Fallo(400, 'Aún no has conectado tu banco.')
    desde = request.GET.get('since') or (date.today() - timedelta(days=365)).isoformat()
    resultado = []
    for a in externos.fintoc('GET', '/accounts', query={'link_token': con.link_token}):
        if str(a.get('currency')).upper() != 'CLP':
            continue
        movs = externos.todos_los_movimientos(a['id'], con.link_token, desde)
        saldo = (a.get('balance') or {}).get('current')
        resultado.append({'id': 'fintoc_' + a['id'], 'name': a.get('name') or a.get('official_name') or 'Cuenta', 'bank': con.institucion,
                          'balance': saldo if isinstance(saldo, (int, float)) else None,
                          'rows': [externos.a_fila(m, i) for i, m in enumerate(movs)]})
    return {'accounts': resultado}


@ruta('DELETE', sesion=True)
def fintoc_desvincular(request, cuerpo):
    """Desvincula: borra el link_token guardado en el servidor."""
    exigir_fintoc()
    ConexionBancaria.objects.filter(usuario=request.user).delete()
    return {'ok': True}


# ---------- asistente ----------

@ruta('POST')
def asistente(request, cuerpo):
    """La llave de Groq se queda en el servidor. La página manda la pregunta, un resumen ya calculado
    (sin nombres de personas ni RUT) y hasta 6 mensajes anteriores de la conversación."""
    if not settings.GROQ_API_KEY:
        raise Fallo(503, 'El asistente no está configurado.')
    pregunta = texto(cuerpo.get('pregunta'), 300)
    if not pregunta:
        raise Fallo(400, 'Escribe una pregunta.')
    # Se puede usar sin cuenta (con los datos de ejemplo), así que tiene tope para que no gasten el cupo de Groq.
    limitar(request, 'asistente', 30, 60 * 60, 'Hiciste muchas preguntas seguidas. Prueba de nuevo en un rato.')
    historia = [{'role': 'assistant' if m.get('rol') == 'asistente' else 'user', 'content': str(m['texto'])[:1500]}
                for m in (cuerpo.get('historia') if isinstance(cuerpo.get('historia'), list) else [])[-6:]
                if isinstance(m, dict) and isinstance(m.get('texto'), str) and m['texto'].strip()]
    resumen = cuerpo.get('resumen') if isinstance(cuerpo.get('resumen'), dict) else {}
    if len(json.dumps(resumen, ensure_ascii=False)) > 30_000:   # un resumen normal mide unos 3.000
        raise Fallo(400, 'El resumen de tus números es demasiado grande.')
    return {'respuesta': externos.preguntar_groq(pregunta, resumen, historia)}
