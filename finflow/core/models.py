from django.contrib.auth.models import User
from django.core.validators import MaxValueValidator
from django.db import models


class Perfil(models.Model):
    """Configuración inicial del usuario: se ingresa una sola vez."""

    FRECUENCIAS = [('mensual', 'Mensual'), ('quincena', 'Quincena'), ('variable', 'Variable')]

    usuario = models.OneToOneField(User, on_delete=models.CASCADE)
    sueldo = models.PositiveIntegerField('Sueldo líquido mensual', help_text='En pesos, sin puntos.')
    frecuencia_pago = models.CharField('Frecuencia de pago', max_length=10, choices=FRECUENCIAS)
    meta_ahorro = models.PositiveSmallIntegerField(
        'Meta de ahorro (%)', validators=[MaxValueValidator(100)], help_text='Porcentaje del sueldo que quieres ahorrar.'
    )
    rut = models.CharField('RUT', max_length=12, help_text='Ej: 12.345.678-9')

    def __str__(self):
        return f'Perfil de {self.usuario}'


class Movimiento(models.Model):
    """Un movimiento leído de un correo bancario."""

    TIPOS = [('ingreso', 'Ingreso'), ('gasto', 'Gasto')]

    usuario = models.ForeignKey(User, on_delete=models.CASCADE)
    banco = models.CharField(max_length=30)
    fecha = models.DateTimeField()
    nombre = models.CharField(max_length=100)
    rut = models.CharField(max_length=12)
    monto = models.PositiveIntegerField()
    codigo = models.CharField('Código de operación', max_length=30)
    tipo = models.CharField(max_length=7, choices=TIPOS)
    es_propia = models.BooleanField('Entre tus cuentas', default=False)

    class Meta:
        ordering = ['-fecha']
        constraints = [
            # El mismo código de operación no se guarda dos veces para un usuario y banco
            models.UniqueConstraint(fields=['usuario', 'banco', 'codigo'], name='movimiento_unico'),
        ]

    def __str__(self):
        return f'{self.fecha:%d/%m/%Y} {self.banco} {self.nombre} ${self.monto}'
