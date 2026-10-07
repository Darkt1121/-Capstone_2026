"""Cálculos del dashboard: cuánto puedes gastar, a dónde va tu plata y comparación con el mes pasado."""
import calendar
import math
from datetime import timedelta

from django.db.models import Count, Max, Sum
from django.utils import timezone

from .categorias import CATEGORIAS, categoria, es_persona
from .models import Movimiento


def periodo_actual(frecuencia, hoy):
    """Primer y último día del período de pago que incluye hoy.

    Mensual y variable: el mes completo (se asume que el próximo pago llega a fin de mes).
    Quincena: del 1 al 15, o del 16 a fin de mes.
    """
    ultimo_dia = calendar.monthrange(hoy.year, hoy.month)[1]
    if frecuencia == 'quincena' and hoy.day <= 15:
        return hoy.replace(day=1), hoy.replace(day=15)
    if frecuencia == 'quincena':
        return hoy.replace(day=16), hoy.replace(day=ultimo_dia)
    return hoy.replace(day=1), hoy.replace(day=ultimo_dia)


def gastos(usuario, inicio, fin):
    """Gastos reales entre dos fechas (sin las transferencias entre cuentas propias)."""
    return Movimiento.objects.filter(usuario=usuario, tipo='gasto', es_propia=False, fecha__date__range=(inicio, fin))


def total(movimientos):
    return movimientos.aggregate(total=Sum('monto'))['total'] or 0


def calcular_resumen(perfil, hoy):
    """Números del dato principal: ingreso, ahorro, gastado, libre y monto por día."""
    inicio, fin = periodo_actual(perfil.frecuencia_pago, hoy)
    ingreso = perfil.sueldo // 2 if perfil.frecuencia_pago == 'quincena' else perfil.sueldo
    ahorro = ingreso * perfil.meta_ahorro // 100
    gastado = total(gastos(perfil.usuario, inicio, fin))
    libre = ingreso - ahorro - gastado
    dias = (fin - hoy).days + 1
    return {
        'inicio': inicio,
        'fin': fin,
        'ingreso': ingreso,
        'ahorro': ahorro,
        'gastado': gastado,
        'libre': libre,
        'dias': dias,
        'por_dia': max(libre, 0) // dias,
    }


def reparto_del_gasto(usuario, inicio, fin, ingreso):
    """Gasto del período por categoría, más lo que queda sin gastar."""
    montos = {clave: 0 for clave, _, _ in CATEGORIAS}
    for movimiento in gastos(usuario, inicio, fin):
        montos[categoria(movimiento)] += movimiento.monto
    reparto = [
        {'clave': clave, 'nombre': nombre, 'detalle': detalle, 'monto': montos[clave]}
        for clave, nombre, detalle in CATEGORIAS
    ]
    gastado = sum(montos.values())
    reparto.append({
        'clave': 'sin-gastar', 'nombre': 'Sin gastar', 'detalle': 'Queda en tus cuentas',
        'monto': max(ingreso - gastado, 0),
    })
    total_barra = sum(parte['monto'] for parte in reparto) or 1
    for parte in reparto:
        parte['porcentaje'] = round(parte['monto'] * 100 / total_barra)
    return reparto


def top_personas(usuario, hoy, cantidad=5):
    """Personas (agrupadas por RUT) a las que más les has transferido en los últimos 6 meses."""
    filas = (
        Movimiento.objects.filter(usuario=usuario, tipo='gasto', es_propia=False, fecha__date__gte=hoy - timedelta(days=182))
        .values('rut')
        .annotate(nombre=Max('nombre'), total=Sum('monto'), transferencias=Count('id'))
        .order_by('-total')
    )
    return [fila for fila in filas if es_persona(fila['rut'])][:cantidad]


def movido_entre_cuentas(usuario, inicio, fin):
    """Total pasado entre las cuentas propias del usuario en el período (no es gasto)."""
    propias = Movimiento.objects.filter(usuario=usuario, es_propia=True, fecha__date__range=(inicio, fin))
    bancos = Movimiento.objects.filter(usuario=usuario).values_list('banco', flat=True).distinct().order_by('banco')
    return {'total': total(propias), 'cantidad': propias.count(), 'bancos': list(bancos)}


def gasto_por_dia(usuario, inicio, fin):
    """{fecha: total gastado ese día} entre dos fechas (sin las transferencias entre cuentas propias)."""
    por_dia = {}
    for movimiento in gastos(usuario, inicio, fin):
        dia = timezone.localtime(movimiento.fecha).date()
        por_dia[dia] = por_dia.get(dia, 0) + movimiento.monto
    return por_dia


def calendario_del_mes(usuario, primer_dia):
    """Semanas del mes (lunes a domingo) con el gasto de cada día y su intensidad de 0 a 4.

    Devuelve (semanas, gasto_por_dia). Los días del mes anterior o siguiente vienen con del_mes=False.
    """
    ultimo_dia = primer_dia.replace(day=calendar.monthrange(primer_dia.year, primer_dia.month)[1])
    por_dia = gasto_por_dia(usuario, primer_dia, ultimo_dia)
    maximo = max(por_dia.values(), default=0)
    semanas = []
    for semana in calendar.Calendar(firstweekday=calendar.MONDAY).monthdatescalendar(primer_dia.year, primer_dia.month):
        semanas.append([
            {
                'fecha': dia,
                'del_mes': dia.month == primer_dia.month,
                'gasto': por_dia.get(dia, 0),
                'nivel': math.ceil(por_dia.get(dia, 0) * 4 / maximo) if maximo else 0,
            }
            for dia in semana
        ])
    return semanas, por_dia


def comparar_con_mes_anterior(usuario, hoy):
    """% de diferencia entre el gasto de este mes y el del mes pasado hasta el mismo día. None si no hay con qué comparar."""
    fin_mes_pasado = hoy.replace(day=1) - timedelta(days=1)
    mismo_dia_mes_pasado = fin_mes_pasado.replace(day=min(hoy.day, fin_mes_pasado.day))
    este_mes = total(gastos(usuario, hoy.replace(day=1), hoy))
    mes_pasado = total(gastos(usuario, fin_mes_pasado.replace(day=1), mismo_dia_mes_pasado))
    if mes_pasado == 0:
        return None
    return {'porcentaje': round((este_mes - mes_pasado) * 100 / mes_pasado), 'este_mes': este_mes, 'mes_pasado': mes_pasado}
