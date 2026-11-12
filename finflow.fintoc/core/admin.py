"""Panel de administración de Django (/admin): para revisar usuarios y datos durante el desarrollo."""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Cuenta, Notificacion, Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    ordering = ('email',)
    list_display = ('email', 'nombre', 'is_staff', 'date_joined')
    search_fields = ('email', 'nombre')
    fieldsets = ((None, {'fields': ('email', 'nombre', 'password', 'correo_confirmado')}),
                 ('Permisos', {'fields': ('is_active', 'is_staff', 'is_superuser')}),
                 ('Fechas', {'fields': ('last_login', 'date_joined')}))
    add_fieldsets = ((None, {'classes': ('wide',), 'fields': ('email', 'nombre', 'password1', 'password2')}),)


@admin.register(Cuenta)
class CuentaAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'banco', 'origen', 'usuario')


@admin.register(Notificacion)
class NotificacionAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'nivel', 'leida', 'borrada', 'usuario', 'creada')
