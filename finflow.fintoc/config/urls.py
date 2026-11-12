"""Direcciones de FinFlow: la página, sus archivos (css/ y js/), la API y el panel de administración."""

from django.conf import settings
from django.contrib import admin
from django.contrib.staticfiles.views import serve as serve_estatico
from django.urls import path, re_path
from django.views.static import serve

from core import views as v

urlpatterns = [
    path('', v.pagina),
    path('index.html', v.pagina),
    # Archivos de la página. serve() no deja salir de public/ (rechaza "..").
    re_path(r'^(?P<path>(?:css|js)/[a-z0-9/-]+\.(?:css|js))$', serve, {'document_root': settings.PUBLIC_DIR}),

    path('api/fintoc/config', v.config),
    path('api/login/google', v.login_google),
    path('api/registro', v.registro),
    path('api/login', v.entrar),
    path('api/sesion', v.sesion),
    path('api/logout', v.salir),
    path('api/usuario', v.borrar_usuario),
    path('api/datos', v.datos),
    path('api/ajustes', v.ajustes),
    path('api/cuentas', v.cuentas),
    path('api/reglas', v.reglas),
    path('api/presupuestos', v.presupuestos),
    path('api/metas', v.metas),
    path('api/boletas', v.boletas),
    path('api/boletas/archivo', v.archivo_boleta),
    path('api/notificaciones', v.notificaciones),
    path('api/notificaciones/leidas', v.notificaciones_leidas),
    path('api/fintoc/link-intent', v.fintoc_link_intent),
    path('api/fintoc/exchange', v.fintoc_exchange),
    path('api/fintoc/movements', v.fintoc_movimientos),
    path('api/fintoc/link', v.fintoc_desvincular),
    path('api/asistente', v.asistente),

    path('admin/login/', v.entrar_admin),   # el login del panel, con límite de intentos
    path('admin/', admin.site.urls),
    # Estilos del panel de administración (también con DJANGO_DEBUG=0).
    re_path(r'^static/(?P<path>.+)$', serve_estatico, {'insecure': True}),
    re_path(r'^api/', v.no_encontrado),
]
