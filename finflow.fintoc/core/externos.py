"""Servicios externos: Fintoc (banco) y Groq (asistente).

Se usan con urllib, que viene con Python. Las llaves salen de la configuración del servidor.
"""

import json
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings


class ErrorExterno(Exception):
    """Un servicio externo respondió con error; el mensaje se le muestra al usuario."""

    def __init__(self, status, mensaje):
        super().__init__(mensaje)
        self.status = status


def _pedir(metodo, url, headers=None, body=None, timeout=30):
    datos = json.dumps(body).encode('utf-8') if body is not None else None
    # Groq rechaza la identificación por defecto de Python ("Python-urllib"); se manda una propia.
    req = urllib.request.Request(url, data=datos, method=metodo, headers={'User-Agent': 'FinFlow/1.0', **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            texto = r.read().decode('utf-8')
            return r.status, (json.loads(texto) if texto else None)
    except urllib.error.HTTPError as e:
        texto = e.read().decode('utf-8', 'replace')
        try:
            return e.code, json.loads(texto) if texto else None
        except ValueError:
            return e.code, None


# ---------- Fintoc ----------

def fintoc_activo():
    return settings.FINTOC_SECRET_KEY.startswith('sk_') and settings.FINTOC_PUBLIC_KEY.startswith('pk_')


def fintoc(metodo, ruta, query=None, body=None):
    url = settings.FINTOC_API + ruta
    if query:
        url += '?' + urllib.parse.urlencode({k: v for k, v in query.items() if v is not None})
    try:
        status, j = _pedir(metodo, url, headers={'Authorization': settings.FINTOC_SECRET_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json'}, body=body)
    except (urllib.error.URLError, TimeoutError):
        raise ErrorExterno(503, 'No pudimos conectar con Fintoc. Inténtalo de nuevo.')
    if status >= 400:
        mensaje = ((j or {}).get('error') or {}).get('message') if isinstance(j, dict) else None
        raise ErrorExterno(status, mensaje or f'Fintoc respondió {status}')
    return j


def todos_los_movimientos(cuenta_id, link_token, desde):
    out = []
    for pagina in range(1, 31):
        lote = fintoc('GET', f'/accounts/{cuenta_id}/movements', query={'link_token': link_token, 'since': desde, 'per_page': 300, 'page': pagina})
        out.extend(lote)
        if len(lote) < 300:
            break
    # Fintoc entrega lo más nuevo primero; FinFlow espera orden cronológico estable.
    out.reverse()
    out.sort(key=lambda m: str(m.get('post_date')))
    return out


def a_fila(m, i):
    """Movimiento de Fintoc -> fila de FinFlow: fecha, descripción, monto (+ abono / - cargo)."""
    return {'date': str(m.get('post_date'))[:10],
            'description': ' '.join(str(m.get('description') or m.get('comment') or 'Movimiento').split()),
            'amount': round(float(m.get('amount') or 0)), 'balance': None, '_line': i}


# ---------- Groq (asistente) ----------

SISTEMA = ('Eres el asistente de FinFlow, una app de finanzas para trabajadores independientes en Chile. '
           'Responde en español, en 4 frases como máximo y sin listas. Puedes marcar el dato más importante con **negrita**. '
           'Usa solo los datos que vienen en el último mensaje; si la respuesta no está ahí, di que no tienes ese dato. '
           'Escribe los montos en pesos chilenos con punto de miles (por ejemplo $120.000). No recomiendes inversiones ni créditos.')


def preguntar_groq(pregunta, resumen, historia):
    mensajes = [{'role': 'system', 'content': SISTEMA}, *historia,
                {'role': 'user', 'content': 'Datos del usuario (JSON):\n' + json.dumps(resumen, ensure_ascii=False) + '\n\nPregunta: ' + pregunta}]
    try:
        status, j = _pedir('POST', 'https://api.groq.com/openai/v1/chat/completions',
                           headers={'Authorization': 'Bearer ' + settings.GROQ_API_KEY, 'Content-Type': 'application/json'},
                           body={'model': settings.GROQ_MODEL, 'temperature': 0.2, 'max_completion_tokens': 700, 'messages': mensajes}, timeout=60)
    except (urllib.error.URLError, TimeoutError):
        raise ErrorExterno(503, 'No pudimos conectar con el asistente. Revisa tu conexión e inténtalo de nuevo.')
    if status == 429:
        raise ErrorExterno(429, 'El asistente llegó a su límite gratuito. Prueba en un rato.')
    try:
        respuesta = j['choices'][0]['message']['content']
    except (TypeError, KeyError, IndexError):
        respuesta = None
    if status >= 400 or not respuesta:
        raise ErrorExterno(502, ((j or {}).get('error') or {}).get('message') if isinstance(j, dict) else 'El asistente no respondió.')
    return respuesta.strip()
