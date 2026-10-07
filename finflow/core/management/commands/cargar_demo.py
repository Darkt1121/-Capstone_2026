from django.conf import settings
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from core.importar import importar_correos
from core.models import Perfil


class Command(BaseCommand):
    help = 'Deja listo el usuario demo (demo / demo1234) con los correos de ejemplo importados.'

    def handle(self, *args, **options):
        usuario, creado = User.objects.get_or_create(
            username='demo', defaults={'first_name': 'Valentina', 'last_name': 'Rojas'}
        )
        if creado:
            usuario.set_password('demo1234')
            usuario.save()
        perfil, _ = Perfil.objects.get_or_create(
            usuario=usuario,
            defaults={'sueldo': 850000, 'frecuencia_pago': 'mensual', 'meta_ahorro': 10, 'rut': '11111111-1'},
        )
        nuevos, repetidos = importar_correos(perfil, settings.BASE_DIR / 'correos_ejemplo')
        self.stdout.write(f'Usuario demo listo (demo / demo1234): {nuevos} movimientos nuevos, {repetidos} ya estaban.')
