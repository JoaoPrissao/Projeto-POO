"""Movesets (F3.6b) — até 3 golpes por músico, definidos pelo tipo + itens.

Cada move tem `mult` (multiplicador de dano, aplicado pelo Show) e `chart`
(dica pro frontend escolher o padrão de barrinhas do minigame de ritmo — o
backend não conhece notas, só valida o move e aplica o mult).

O item equipado DESBLOQUEIA um golpe próprio: o moveset é `base + extras`,
capado nos 3 últimos (com dois itens, o golpe mais fraco sai — os golpes
mudam com o equipamento, como o João pediu).
"""
from excecoes import MoveInvalidoError

MOVES_BASE = {
    "guitarrista": [
        {"id": "solo_rapido",     "nome": "Solo Rápido",      "mult": 1.0, "chart": "rapido"},
        {"id": "riff_pesado",     "nome": "Riff Pesado",      "mult": 1.3, "chart": "pesado"},
    ],
    "vocalista": [
        {"id": "nota_sustentada", "nome": "Nota Sustentada",  "mult": 1.0, "chart": "sustentada"},
        {"id": "grito_agudo",     "nome": "Grito Agudo",      "mult": 1.3, "chart": "pesado"},
    ],
    "baterista": [
        {"id": "groove_constante", "nome": "Groove Constante", "mult": 1.0, "chart": "constante"},
        {"id": "blast_beat",      "nome": "Blast Beat",       "mult": 1.3, "chart": "denso"},
    ],
    "baixista": [
        {"id": "walking_bass",    "nome": "Walking Bass",     "mult": 1.0, "chart": "constante"},
        {"id": "slap_funk",       "nome": "Slap Funk",        "mult": 1.3, "chart": "sincopado"},
    ],
}

# Identidade do item = nome (mesma regra do Inventario).
MOVES_DE_ITEM = {
    "Pedal de Efeito": {"id": "solo_distorcido", "nome": "Solo Distorcido", "mult": 1.6, "chart": "caotico"},
    "Amplificador":    {"id": "wall_of_sound",   "nome": "Wall of Sound",   "mult": 1.8, "chart": "denso"},
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
