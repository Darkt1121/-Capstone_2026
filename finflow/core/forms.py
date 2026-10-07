import re

from django import forms

from lectores.utiles import normalizar_rut

from .models import Perfil


class PerfilForm(forms.ModelForm):
    class Meta:
        model = Perfil
        fields = ['sueldo', 'frecuencia_pago', 'meta_ahorro', 'rut']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for campo in self.fields.values():
            campo.widget.attrs['class'] = 'form-select' if isinstance(campo.widget, forms.Select) else 'form-control'

    def clean_rut(self):
        """Guarda el RUT sin puntos (12345678-9), igual que lo entregan los lectores."""
        valor = normalizar_rut(self.cleaned_data['rut'])
        if not re.fullmatch(r'\d{7,8}-[\dK]', valor):
            raise forms.ValidationError('Escribe el RUT así: 12.345.678-9')
        return valor
