from django import template

register = template.Library()


@register.filter
def pesos(valor):
    """Formato chileno: 850000 -> '$850.000', -1500 -> '-$1.500'."""
    signo = '-' if valor < 0 else ''
    return f'{signo}${abs(valor):,}'.replace(',', '.')
