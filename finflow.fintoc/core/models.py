"""Tablas de FinFlow. Django crea y actualiza las tablas con sus migraciones (python manage.py migrate)."""

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UsuarioManager(BaseUserManager):
    """Crea usuarios que entran con su correo (no hay nombre de usuario aparte)."""

    use_in_migrations = True

    def create_user(self, email, password=None, **extra):
        usuario = self.model(email=self.normalize_email(email).lower(), **extra)
        if password:
            usuario.set_password(password)
        else:
            usuario.set_unusable_password()   # entra con Google
        usuario.save(using=self._db)
        return usuario

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra)


class Usuario(AbstractUser):
    """Persona que usa FinFlow. Entra con correo y contraseña o con Google."""

    username = None
    first_name = None
    last_name = None
    email = models.EmailField('correo', unique=True)
    nombre = models.CharField(max_length=80)
    google_id = models.CharField(max_length=64, unique=True, null=True, blank=True)   # vacío si usa contraseña

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['nombre']
    objects = UsuarioManager()

    class Meta:
        db_table = 'usuarios'


class Ajustes(models.Model):
    """Lo que el usuario configura una vez. "correcciones" guarda las categorías que corrigió a mano."""

    usuario = models.OneToOneField(Usuario, on_delete=models.CASCADE, primary_key=True)
    titular = models.CharField(max_length=120, default='')          # nombre como sale en sus cartolas
    consentimiento = models.BooleanField(default=False)
    politica_version = models.CharField(max_length=20, null=True)   # qué versión de la política aceptó
    consentimiento_fecha = models.DateTimeField(null=True)          # y cuándo
    saldo_minimo = models.IntegerField(default=400000)
    correcciones = models.JSONField(default=dict)

    class Meta:
        db_table = 'ajustes'


class Cuenta(models.Model):
    """Una cuenta bancaria del usuario (máximo 3), subida por cartola o conectada con Fintoc."""

    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='cuentas')
    clave = models.CharField(max_length=100)                         # identificador que usa la página
    nombre = models.CharField(max_length=80)
    banco = models.CharField(max_length=80, default='')
    origen = models.CharField(max_length=10, choices=[('cartola', 'Cartola'), ('fintoc', 'Fintoc')], default='cartola')

    class Meta:
        db_table = 'cuentas'
        constraints = [models.UniqueConstraint(fields=['usuario', 'clave'], name='cuenta_unica_por_usuario')]


class Movimiento(models.Model):
    """Un movimiento de una cuenta. "linea" lo identifica dentro de la cuenta; "orden" es el orden original."""

    cuenta = models.ForeignKey(Cuenta, on_delete=models.CASCADE, related_name='movimientos')
    orden = models.IntegerField()
    linea = models.IntegerField()
    fecha = models.DateField()
    descripcion = models.CharField(max_length=300)
    monto = models.IntegerField()                 # pesos; positivo es abono, negativo es cargo
    saldo = models.IntegerField(null=True)         # saldo después del movimiento, si la cartola lo trae

    class Meta:
        db_table = 'movimientos'
        constraints = [models.UniqueConstraint(fields=['cuenta', 'linea'], name='movimiento_unico_por_cuenta')]


class ConexionBancaria(models.Model):
    """Conexión con el banco a través de Fintoc. El link_token nunca sale del servidor."""

    usuario = models.OneToOneField(Usuario, on_delete=models.CASCADE, primary_key=True)
    link_token = models.CharField(max_length=200)
    institucion = models.CharField(max_length=120)
    creado = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'conexiones_bancarias'


class Regla(models.Model):
    """Regla del usuario: si la descripción contiene "texto", va a esa categoría y ámbito."""

    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='reglas')
    texto = models.CharField(max_length=60)          # en mayúsculas y sin tildes, ej. 'JUMBO'
    categoria = models.CharField(max_length=40)
    ambito = models.CharField(max_length=10, choices=[('negocio', 'Negocio'), ('personal', 'Personal')])

    class Meta:
        db_table = 'reglas'
        constraints = [models.UniqueConstraint(fields=['usuario', 'texto'], name='regla_unica_por_usuario')]


class Presupuesto(models.Model):
    """Tope de gasto mensual por categoría. La página avisa al 80 % y al 100 %."""

    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='presupuestos')
    categoria = models.CharField(max_length=40)
    monto = models.IntegerField()

    class Meta:
        db_table = 'presupuestos'
        constraints = [
            models.UniqueConstraint(fields=['usuario', 'categoria'], name='presupuesto_unico_por_categoria'),
            models.CheckConstraint(condition=models.Q(monto__gt=0), name='presupuesto_monto_positivo'),
        ]


class MetaAhorro(models.Model):
    """Meta de ahorro. Se cruza con la proyección para decir si el usuario llega a la fecha."""

    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='metas')
    nombre = models.CharField(max_length=60)
    monto = models.IntegerField()
    fecha = models.DateField()                # para cuándo la quiere
    aporte = models.IntegerField(default=0)   # cuánto piensa guardar al mes
    ahorrado = models.IntegerField(default=0)

    class Meta:
        db_table = 'metas'
        verbose_name = 'meta'
        constraints = [
            models.CheckConstraint(condition=models.Q(monto__gt=0), name='meta_monto_positivo'),
            models.CheckConstraint(condition=models.Q(aporte__gte=0, ahorrado__gte=0), name='meta_sin_negativos'),
        ]


class Boleta(models.Model):
    """Boleta adjunta a un movimiento (PDF, JPG o PNG de hasta 2 MB). "movimiento" es el id de la página."""

    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='boletas')
    movimiento = models.CharField(max_length=200)
    nombre = models.CharField(max_length=80)
    tipo = models.CharField(max_length=20, choices=[('application/pdf', 'PDF'), ('image/jpeg', 'JPG'), ('image/png', 'PNG')])
    datos = models.BinaryField()
    creado = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'boletas'
        constraints = [models.UniqueConstraint(fields=['usuario', 'movimiento'], name='boleta_unica_por_movimiento')]


class Notificacion(models.Model):
    """Aviso que la página le mostró al usuario. "clave" evita repetirlo; las borradas no vuelven."""

    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='notificaciones')
    clave = models.CharField(max_length=200)
    nivel = models.CharField(max_length=10, choices=[('info', 'Dato'), ('warning', 'Atención'), ('danger', 'Importante')])
    titulo = models.CharField(max_length=200)
    texto = models.CharField(max_length=500)
    creada = models.DateTimeField(auto_now_add=True)
    leida = models.BooleanField(default=False)
    borrada = models.BooleanField(default=False)

    class Meta:
        db_table = 'notificaciones'
        constraints = [models.UniqueConstraint(fields=['usuario', 'clave'], name='notificacion_unica_por_usuario')]
