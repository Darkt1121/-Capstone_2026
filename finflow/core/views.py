from django.db import connection
from django.shortcuts import render


def inicio(request):
    """Página de inicio: muestra si Django se conecta a PostgreSQL."""
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT version()')
            version_bd = cursor.fetchone()[0]
    except Exception as error:
        version_bd = None
        print('Error conectando a la base:', error)

    return render(request, 'core/inicio.html', {'version_bd': version_bd})
