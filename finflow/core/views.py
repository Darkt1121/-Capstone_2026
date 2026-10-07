import calendar
import re
from datetime import date, datetime, timedelta

from django.contrib.auth.decorators import login_required
from django.http import Http404
from django.shortcuts import redirect, render
from django.utils import timezone
from django.utils.formats import date_format
from django.utils.text import capfirst

from .forms import PerfilForm
from .models import Movimiento, Perfil
from .plan import (
    calcular_resumen,
    calendario_del_mes,
    comparar_con_mes_anterior,
    movido_entre_cuentas,
    reparto_del_gasto,
    total,
    transferencias_por_persona,
)

DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

# Color de Bootstrap para cada parte de "¿A dónde va tu plata?"
COLORES_REPARTO = {'personas': 'bg-primary', 'comisiones': 'bg-secondary', 'otros': 'bg-warning', 'sin-gastar': 'bg-success'}


def datos_del_mes(usuario, primer_dia, hoy):
    """Calendario y gráfico de gasto diario de un mes (se usan en el dashboard y en la página Calendario)."""
    semanas, por_dia = calendario_del_mes(usuario, primer_dia)
    ultimo = calendar.monthrange(primer_dia.year, primer_dia.month)[1]
    # En el mes actual el gráfico llega hasta hoy, para no dibujar días futuros en $0
    hasta = hoy.day if (primer_dia.year, primer_dia.month) == (hoy.year, hoy.month) else ultimo
    return {
        'mes_nombre': capfirst(date_format(primer_dia, 'F Y')),
        'mes_anterior': (primer_dia - timedelta(days=1)).strftime('%Y-%m'),
        'mes_siguiente': (primer_dia.replace(day=ultimo) + timedelta(days=1)).strftime('%Y-%m'),
        'semanas': semanas,
        'dias_semana': DIAS_SEMANA,
        'hoy': hoy,
        'gastado_mes': sum(por_dia.values()),
        'grafico': {
            'dias': list(range(1, hasta + 1)),
            'montos': [por_dia.get(primer_dia.replace(day=dia), 0) for dia in range(1, hasta + 1)],
        },
    }


def agrupar_por_dia(movimientos, hoy):
    """Agrupa los movimientos por día: [('Hoy', [...]), ('Ayer', [...]), ('Lunes 5 de octubre', [...])]."""
    grupos = []
    for movimiento in movimientos:
        dia = timezone.localtime(movimiento.fecha).date()
        if dia == hoy:
            titulo = 'Hoy'
        elif dia == hoy - timedelta(days=1):
            titulo = 'Ayer'
        else:
            titulo = capfirst(date_format(dia, r'l j \d\e F'))
        if not grupos or grupos[-1][0] != titulo:
            grupos.append((titulo, []))
        grupos[-1][1].append(movimiento)
    return grupos


@login_required
def inicio(request):
    """Dashboard. Si el usuario aún no tiene perfil, lo manda a la configuración inicial."""
    perfil = Perfil.objects.filter(usuario=request.user).first()
    if perfil is None:
        return redirect('configuracion')
    hoy = timezone.localdate()
    contexto = calcular_resumen(perfil, hoy)
    inicio_periodo, fin_periodo = contexto['inicio'], contexto['fin']
    contexto.update({
        'perfil': perfil,
        'periodo': 'esta quincena' if perfil.frecuencia_pago == 'quincena' else 'este mes',
        'reparto': reparto_del_gasto(request.user, inicio_periodo, fin_periodo, contexto['ingreso']),
        'personas': transferencias_por_persona(request.user, hoy),
        'movido': movido_entre_cuentas(request.user, inicio_periodo, fin_periodo),
        'comparacion': comparar_con_mes_anterior(request.user, hoy),
        'dias_con_movimientos': agrupar_por_dia(Movimiento.objects.filter(usuario=request.user)[:8], hoy),
    })
    for parte in contexto['reparto']:
        parte['color'] = COLORES_REPARTO[parte['clave']]
    contexto.update(datos_del_mes(request.user, hoy.replace(day=1), hoy))
    return render(request, 'core/inicio.html', contexto)


@login_required
def calendario(request):
    """Calendario de un mes (?mes=AAAA-MM) con el gasto diario. Sin parámetro, el mes actual."""
    hoy = timezone.localdate()
    try:
        primer_dia = datetime.strptime(request.GET.get('mes', ''), '%Y-%m').date()
    except ValueError:
        primer_dia = hoy.replace(day=1)
    return render(request, 'core/calendario.html', datos_del_mes(request.user, primer_dia, hoy))


@login_required
def dia(request, fecha):
    """Total gastado y movimientos de un día (/dia/AAAA-MM-DD/)."""
    try:
        el_dia = date.fromisoformat(fecha)
    except ValueError:
        raise Http404('Fecha inválida')
    movimientos = Movimiento.objects.filter(usuario=request.user, fecha__date=el_dia).order_by('fecha')
    contexto = {
        'titulo': capfirst(date_format(el_dia, r'l j \d\e F \d\e Y')),
        'mes': el_dia.strftime('%Y-%m'),
        'movimientos': movimientos,
        'gastado': total(movimientos.filter(tipo='gasto', es_propia=False)),
    }
    return render(request, 'core/dia.html', contexto)


@login_required
def movimientos(request):
    """Lista de movimientos. El buscador filtra por nombre o por monto ('20020', '$20.020')."""
    busqueda = request.GET.get('q', '').strip()
    lista = Movimiento.objects.filter(usuario=request.user)
    if busqueda:
        solo_numeros = re.sub(r'[$.\s]', '', busqueda)
        if solo_numeros.isdigit():
            lista = lista.filter(monto=int(solo_numeros))
        else:
            lista = lista.filter(nombre__unaccent__icontains=busqueda)
    lista = list(lista)
    contexto = {
        'busqueda': busqueda,
        'cantidad': len(lista),
        'dias_con_movimientos': agrupar_por_dia(lista, timezone.localdate()),
    }
    return render(request, 'core/movimientos.html', contexto)


@login_required
def configuracion(request):
    perfil = Perfil.objects.filter(usuario=request.user).first()
    form = PerfilForm(request.POST or None, instance=perfil)
    if form.is_valid():
        perfil = form.save(commit=False)
        perfil.usuario = request.user
        perfil.save()
        return redirect('inicio')
    return render(request, 'core/configuracion.html', {'form': form, 'primera_vez': perfil is None})
