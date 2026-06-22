"""F3.6b — Movesets: cada músico tem até 3 golpes, cada um com seu chart de
ritmo e multiplicador de dano. O moveset muda com o item equipado (o item
desbloqueia um golpe próprio). O backend é autoritativo: valida o move e
aplica o mult; o chart_id é só uma dica pro frontend escolher as barrinhas.
"""
import sys, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'bridge'))

import pytest

from Guitarrista import Guitarrista
from Vocalista import Vocalista
from fabricas import ItemFactory
from moves import moves_de, get_move, MOVES_BASE
from excecoes import MoveInvalidoError
from api import API
from gerenciador import GerenciadorJogo


@pytest.fixture(autouse=True)
def _reset_singleton():
    GerenciadorJogo.resetar()
    yield
    GerenciadorJogo.resetar()


# ── catálogo ──────────────────────────────────────────────────────────────────

def test_todo_tipo_tem_tres_moves_base():
    # F3.8: leve / médio / pesado, com custo de energia e flag de cansaço.
    for tipo in ("guitarrista", "vocalista", "baterista", "baixista"):
        base = MOVES_BASE[tipo]
        assert len(base) == 3
        for m in base:
            assert {"id", "nome", "mult", "chart", "custo", "cansa"} <= set(m)


def test_moves_de_sem_equipamento_sao_os_base():
    g = Guitarrista("Aldric")
    assert moves_de(g) == MOVES_BASE["guitarrista"]


def test_item_equipado_desbloqueia_terceiro_move():
    g = Guitarrista("Aldric")
    g.equipar(ItemFactory.criar("pedal"))
    moves = moves_de(g)
    assert len(moves) == 3
    assert moves[-1]["id"] == "solo_distorcido"          # move do pedal
    assert moves[-1]["mult"] > 1.3                       # mais forte que os base


def test_moveset_capado_em_tres_com_dois_itens():
    g = Guitarrista("Aldric")
    g.equipar(ItemFactory.criar("pedal"))
    g.equipar(ItemFactory.criar("amplificador"))
    moves = moves_de(g)
    assert len(moves) == 3                               # cap em 3
    ids = [m["id"] for m in moves]
    assert "solo_distorcido" in ids and "wall_of_sound" in ids


def test_get_move_valida_pertencimento():
    g = Guitarrista("Aldric")
    move = get_move(g, "riff_pesado")
    assert move["mult"] == pytest.approx(1.5)
    with pytest.raises(MoveInvalidoError):
        get_move(g, "solo_distorcido")                   # sem pedal equipado
    with pytest.raises(MoveInvalidoError):
        get_move(g, "nao_existe")


# ── ponte: executar_acao com move ─────────────────────────────────────────────

def _api_com_guitarrista():
    api = API()
    api.criar_banda([{"tipo": "guitarrista", "nome": "Aldric", "forca": 10}])
    return api


def test_musico_dto_traz_moves():
    api = _api_com_guitarrista()
    m0 = api.obter_estado()["banda"][0]
    assert [mv["id"] for mv in m0["moves"]] == ["palhetada", "solo_rapido", "riff_pesado"]


def test_executar_acao_com_move_aplica_mult():
    api = _api_com_guitarrista()
    sem_move = api.executar_acao({"indice": 0})["dano"]          # 15
    GerenciadorJogo.resetar()
    api2 = _api_com_guitarrista()
    com_move = api2.executar_acao({"indice": 0, "move_id": "riff_pesado"})["dano"]
    assert com_move == int(sem_move * 1.5)


def test_executar_acao_move_invalido_vira_erro_dto():
    api = _api_com_guitarrista()
    res = api.executar_acao({"indice": 0, "move_id": "solo_distorcido"})
    assert res["ok"] is False


def test_move_de_item_funciona_apos_equipar_via_api():
    api = _api_com_guitarrista()
    musico = api._gerenciador.listar_jogadores()[0]
    musico.get_inventario().adicionar(ItemFactory.criar("pedal"))
    api.equipar({"indice": 0, "nome": "Pedal de Efeito"})
    m0 = api.obter_estado()["banda"][0]
    assert any(mv["id"] == "solo_distorcido" for mv in m0["moves"])
    res = api.executar_acao({"indice": 0, "move_id": "solo_distorcido"})
    assert res["ok"] is True
    # forca efetiva 17 (base 10 + pedal 7) → base 25; mult do move 1.6 → 40 (UAT Fase 3)
    assert res["dano"] == int(int((10 + 7) * 1.5) * 1.6)
