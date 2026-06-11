"""Movesets (F3.6b/F3.8) — 3 golpes por músico: leve / médio / pesado.

Cada move tem `mult` (multiplicador de dano, aplicado pelo Show), `custo`
(energia consumida — F3.8), `cansa` (golpe pesado deixa o músico CANSADO:
perde a próxima vez da banda) e `chart` (dica pro frontend escolher o padrão
de barrinhas do minigame — leve usa o chart "facil", pesado usa os difíceis).

O item equipado DESBLOQUEIA um golpe próprio: o moveset é `base + extras`,
capado nos 3 últimos (o golpe de item empurra o mais fraco pra fora — os
golpes mudam com o equipamento, como o João pediu).
"""
from excecoes import MoveInvalidoError

# leve:  mult 0.8 / custo 5  / chart facil      / não cansa
# médio: mult 1.0 / custo 12 / chart do tipo    / não cansa
# pesado: mult 1.5 / custo 25 / chart difícil   / CANSA (perde a próxima vez)
MOVES_BASE = {
    "guitarrista": [
        {"id": "palhetada",       "nome": "Palhetada",        "mult": 0.8, "custo": 5,  "cansa": False, "chart": "facil"},
        {"id": "solo_rapido",     "nome": "Solo Rápido",      "mult": 1.0, "custo": 12, "cansa": False, "chart": "rapido"},
        {"id": "riff_pesado",     "nome": "Riff Pesado",      "mult": 1.5, "custo": 25, "cansa": True,  "chart": "pesado"},
    ],
    "vocalista": [
        {"id": "vocalize",        "nome": "Vocalize",         "mult": 0.8, "custo": 5,  "cansa": False, "chart": "facil"},
        {"id": "nota_sustentada", "nome": "Nota Sustentada",  "mult": 1.0, "custo": 12, "cansa": False, "chart": "sustentada"},
        {"id": "grito_agudo",     "nome": "Grito Agudo",      "mult": 1.5, "custo": 25, "cansa": True,  "chart": "caotico"},
    ],
    "baterista": [
        {"id": "marcacao",        "nome": "Marcação",         "mult": 0.8, "custo": 5,  "cansa": False, "chart": "facil"},
        {"id": "groove_constante", "nome": "Groove Constante", "mult": 1.0, "custo": 12, "cansa": False, "chart": "constante"},
        {"id": "blast_beat",      "nome": "Blast Beat",       "mult": 1.5, "custo": 25, "cansa": True,  "chart": "denso"},
    ],
    "baixista": [
        {"id": "nota_pedal",      "nome": "Nota Pedal",       "mult": 0.8, "custo": 5,  "cansa": False, "chart": "facil"},
        {"id": "walking_bass",    "nome": "Walking Bass",     "mult": 1.0, "custo": 12, "cansa": False, "chart": "sincopado"},
        {"id": "slap_funk",       "nome": "Slap Funk",        "mult": 1.5, "custo": 25, "cansa": True,  "chart": "denso"},
    ],
}

# Identidade do item = nome (mesma regra do Inventario). Golpes de item são
# PESADOS: dano alto, custo alto e cansam.
MOVES_DE_ITEM = {
    "Pedal de Efeito": {"id": "solo_distorcido", "nome": "Solo Distorcido", "mult": 1.6, "custo": 28, "cansa": True, "chart": "caotico"},
    "Amplificador":    {"id": "wall_of_sound",   "nome": "Wall of Sound",   "mult": 1.8, "custo": 32, "cansa": True, "chart": "denso"},
}

MAX_MOVES = 3


def moves_de(musico) -> list:
    """Moveset atual do músico: base do tipo + golpes dos itens equipados,
    capado nos MAX_MOVES últimos (item empurra o golpe mais fraco pra fora)."""
    base = MOVES_BASE.get(getattr(musico, "TIPO", None), [])
    extras = [MOVES_DE_ITEM[item.nome]
              for item in musico.listar_equipados()
              if item.nome in MOVES_DE_ITEM]
    return (list(base) + extras)[-MAX_MOVES:]


def get_move(musico, move_id: str) -> dict:
    """Move do músico por id — golpe de item sem o item equipado é inválido."""
    for move in moves_de(musico):
        if move["id"] == move_id:
            return move
    raise MoveInvalidoError(move_id)
