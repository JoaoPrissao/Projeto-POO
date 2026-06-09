import json
import os

from musico import Musico
from excecoes import SaveNaoEncontradoError, SaveCorrompidoError, TipoInvalidoError

# Único módulo que toca o disco. Saves ficam em <raiz>/saves/<slot>.json.
SAVES_DIR = os.path.join(os.path.dirname(__file__), "..", "saves")


def _caminho(slot: str, pasta: str = None) -> str:
    base = pasta if pasta is not None else SAVES_DIR
    return os.path.join(base, f"{slot}.json")


def salvar_jogo(jogadores: list, slot: str, pasta: str = None) -> None:
    base = pasta if pasta is not None else SAVES_DIR
    os.makedirs(base, exist_ok=True)
    dados = [jogador.to_dict() for jogador in jogadores]
    with open(_caminho(slot, pasta), "w", encoding="utf-8") as arquivo:
        json.dump(dados, arquivo, ensure_ascii=False, indent=2)


def carregar_jogo(slot: str, pasta: str = None) -> list:
    caminho = _caminho(slot, pasta)
    if not os.path.exists(caminho):
        raise SaveNaoEncontradoError(f"Save '{slot}' não encontrado em {caminho}.")
    try:
        with open(caminho, encoding="utf-8") as arquivo:
            dados = json.load(arquivo)
        return [Musico.from_dict(d) for d in dados]
    except (json.JSONDecodeError, KeyError, TypeError, AttributeError, TipoInvalidoError) as erro:
        raise SaveCorrompidoError(f"Save '{slot}' inválido ou incompatível: {erro}") from erro


def salvar_estado(estado: dict, slot: str, pasta: str = None) -> None:
    """Salva o envelope completo do jogo: {"banda": [...], "show": {...}|None}.
    Mantém o save autocontido — banda + progresso do show (HP do boss, turno)."""
    base = pasta if pasta is not None else SAVES_DIR
    os.makedirs(base, exist_ok=True)
    with open(_caminho(slot, pasta), "w", encoding="utf-8") as arquivo:
        json.dump(estado, arquivo, ensure_ascii=False, indent=2)


def carregar_estado(slot: str, pasta: str = None) -> dict:
    """Lê o envelope do jogo. Saves antigos (lista pura de músicos) são tratados
    como banda sem show, pra retrocompatibilidade."""
    caminho = _caminho(slot, pasta)
    if not os.path.exists(caminho):
        raise SaveNaoEncontradoError(f"Save '{slot}' não encontrado em {caminho}.")
    try:
        with open(caminho, encoding="utf-8") as arquivo:
            dados = json.load(arquivo)
    except json.JSONDecodeError as erro:
        raise SaveCorrompidoError(f"Save '{slot}' inválido: {erro}") from erro

    if isinstance(dados, list):          # formato antigo: só a banda
        return {"banda": dados, "show": None}
    if isinstance(dados, dict) and "banda" in dados:
        return dados
    raise SaveCorrompidoError(f"Save '{slot}' com schema desconhecido.")


def listar_saves(pasta: str = None) -> list:
    base = pasta if pasta is not None else SAVES_DIR
    if not os.path.isdir(base):
        return []
    saves = []
    for nome in sorted(os.listdir(base)):
        if nome.endswith(".json"):
            caminho = os.path.join(base, nome)
            saves.append({
                "slot": nome[:-5],
                "caminho": caminho,
                "modificado_em": os.path.getmtime(caminho),
            })
    return saves
