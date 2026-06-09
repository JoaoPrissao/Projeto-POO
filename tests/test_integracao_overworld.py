"""Harness de integração — ponte overworld → batalha (F3.2).

Dirige a API como o frontend fará no modo história: ao entrar numa venue,
`entrar_no_show` arma o boss daquela venue (uma capanga do Empresário) sem
mexer na banda; ao andar por cima de um item, `coletar_item` o adiciona ao
inventário de um músico via ItemFactory. São métodos ADITIVOS — nada do
fluxo de show existente muda.
"""
import sys, os, json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'bridge'))

import pytest

from api import API
from gerenciador import GerenciadorJogo


@pytest.fixture(autouse=True)
def _reset_singleton():
    GerenciadorJogo.resetar()
    yield
    GerenciadorJogo.resetar()


COMPOSICAO = [
    {"tipo": "guitarrista", "nome": "Aldric", "forca": 14, "ego": 0},
    {"tipo": "baixista",    "nome": "Paul",   "forca": 12, "fe": 20},
]


def _api_com_banda():
    api = API()
    api.criar_banda(COMPOSICAO)
    return api


def _serializavel(dto):
    json.dumps(dto)  # levanta TypeError se algo não-JSON cruzar a ponte
    return dto


# ── entrar_no_show ────────────────────────────────────────────────────────────

def test_entrar_no_show_arma_boss_da_venue():
    api = _api_com_banda()
    estado = _serializavel(api.entrar_no_show({"nome": "Capanga do Bar", "hp": 60, "dano": 8}))
    assert estado["boss"]["nome"] == "Capanga do Bar"
    assert estado["boss"]["hp"] == 60
    assert estado["boss"]["hp_maximo"] == 60
    assert estado["turno"] == "banda"
    assert estado["fim_de_jogo"] is False


def test_entrar_no_show_preserva_a_banda():
    api = _api_com_banda()
    estado = api.entrar_no_show({"nome": "Capanga", "hp": 40, "dano": 5})
    assert [m["nome"] for m in estado["banda"]] == ["Aldric", "Paul"]


def test_entrar_no_show_permite_atacar_a_capanga():
    api = _api_com_banda()
    api.entrar_no_show({"nome": "Capanga", "hp": 40, "dano": 5})
    res = api.executar_acao({"indice": 0, "ritmo": {"acertos": 9, "total_notas": 10, "combo_max": 6}})
    assert res["ok"] is True
    assert res["estado"]["boss"]["hp"] < 40        # a capanga tomou dano


def test_entrar_no_show_troca_de_venue_reseta_o_boss():
    api = _api_com_banda()
    api.entrar_no_show({"nome": "Capanga 1", "hp": 40, "dano": 5})
    api.executar_acao({"indice": 0, "ritmo": {"acertos": 9, "total_notas": 10, "combo_max": 6}})
    estado = api.entrar_no_show({"nome": "Capanga 2", "hp": 80, "dano": 9})
    assert estado["boss"]["nome"] == "Capanga 2"
    assert estado["boss"]["hp"] == 80              # boss novo, cheio
    assert estado["turno"] == "banda"


# ── coletar_item ──────────────────────────────────────────────────────────────

def test_coletar_item_adiciona_ao_inventario():
    api = _api_com_banda()
    res = _serializavel(api.coletar_item({"tipo": "energetico", "indice": 0}))
    assert res["ok"] is True
    assert res["tamanho_inventario"] == 1


def test_coletar_item_indice_padrao_zero():
    api = _api_com_banda()
    res = api.coletar_item({"tipo": "cerveja"})
    assert res["ok"] is True
    assert res["musico"] == "Aldric"


def test_coletar_item_tipo_invalido_vira_erro_dto():
    api = _api_com_banda()
    res = api.coletar_item({"tipo": "inexistente"})
    assert res["ok"] is False
    assert "tipo" in res["erro"]


def test_coletar_item_indice_fora_da_banda_vira_erro_dto():
    api = _api_com_banda()
    res = api.coletar_item({"tipo": "energetico", "indice": 9})
    assert res["ok"] is False
