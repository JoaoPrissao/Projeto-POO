"""Harness de integração — campanha autoritativa + ponte overworld → batalha (F3.3).

A campanha agora vive no backend (GerenciadorJogo). O front lê dela:
`obter_campanha` (venues/itens/posição), entra numa venue por id
(`entrar_no_show(venue_id)` arma a capanga definida na campanha), coleta item
por id (`coletar_item({id})`), marca progresso (`concluir_venue`,
`registrar_posicao`) — e tudo isso sobrevive a save/load.
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
RITMO = {"acertos": 9, "total_notas": 10, "combo_max": 6}


def _api_com_banda():
    api = API()
    api.criar_banda(COMPOSICAO)
    return api


def _serializavel(dto):
    json.dumps(dto)  # levanta TypeError se algo não-JSON cruzar a ponte
    return dto


def _primeira_venue(api):
    return api.obter_campanha()["venues"][0]


def _primeiro_item(api):
    return api.obter_campanha()["itens"][0]


# ── obter_campanha ────────────────────────────────────────────────────────────

def test_obter_campanha_traz_venues_itens_e_posicao():
    api = _api_com_banda()
    camp = _serializavel(api.obter_campanha())
    assert len(camp["venues"]) >= 3
    assert len(camp["itens"]) >= 2
    assert "posicao" in camp
    assert camp["completa"] is False


# ── entrar_no_show (por id) ───────────────────────────────────────────────────

def test_entrar_no_show_por_id_arma_a_capanga_da_venue():
    api = _api_com_banda()
    venue = _primeira_venue(api)
    estado = _serializavel(api.entrar_no_show(venue["id"]))
    assert estado["boss"]["nome"] == venue["capanga"]["nome"]
    assert estado["boss"]["hp"] == venue["capanga"]["hp"]
    assert estado["turno"] == "banda"
    assert estado["fim_de_jogo"] is False


def test_entrar_no_show_id_invalido_vira_erro_dto():
    api = _api_com_banda()
    res = api.entrar_no_show("fantasma")
    assert res["ok"] is False


def test_entrar_no_show_permite_atacar_a_capanga():
    api = _api_com_banda()
    venue = _primeira_venue(api)
    hp0 = venue["capanga"]["hp"]
    api.entrar_no_show(venue["id"])
    res = api.executar_acao({"indice": 0, "ritmo": RITMO})
    assert res["ok"] is True
    assert res["estado"]["boss"]["hp"] < hp0


# ── concluir_venue ────────────────────────────────────────────────────────────

def test_concluir_venue_marca_na_campanha():
    api = _api_com_banda()
    venue = _primeira_venue(api)
    camp = _serializavel(api.concluir_venue(venue["id"]))
    marcada = next(v for v in camp["venues"] if v["id"] == venue["id"])
    assert marcada["concluida"] is True


def test_concluir_venue_invalida_vira_erro_dto():
    api = _api_com_banda()
    res = api.concluir_venue("fantasma")
    assert res["ok"] is False


# ── coletar_item (por id) ─────────────────────────────────────────────────────

def test_coletar_item_por_id_adiciona_e_marca():
    api = _api_com_banda()
    item = _primeiro_item(api)
    res = _serializavel(api.coletar_item({"id": item["id"]}))
    assert res["ok"] is True
    assert res["item"]  # nome do item criado
    marcado = next(i for i in api.obter_campanha()["itens"] if i["id"] == item["id"])
    assert marcado["coletado"] is True


def test_coletar_item_id_invalido_vira_erro_dto():
    api = _api_com_banda()
    res = api.coletar_item({"id": "fantasma"})
    assert res["ok"] is False


# ── registrar_posicao ─────────────────────────────────────────────────────────

def test_registrar_posicao_guarda_na_campanha():
    api = _api_com_banda()
    api.registrar_posicao(512.5)
    assert api.obter_campanha()["posicao"] == 512.5


# ── save/load retoma a história (teste-chave da fase) ─────────────────────────

def test_save_load_retoma_a_campanha(tmp_path):
    pasta = str(tmp_path)
    api = _api_com_banda()
    venue = _primeira_venue(api)
    item = _primeiro_item(api)

    api.concluir_venue(venue["id"])
    api.coletar_item({"id": item["id"]})
    api.registrar_posicao(777.0)
    api.salvar("slot1", pasta)

    # Nova sessão limpa: recarrega do save.
    GerenciadorJogo.resetar()
    api2 = API()
    api2.carregar("slot1", pasta)
    camp = api2.obter_campanha()

    assert next(v for v in camp["venues"] if v["id"] == venue["id"])["concluida"] is True
    assert next(i for i in camp["itens"] if i["id"] == item["id"])["coletado"] is True
    assert camp["posicao"] == 777.0
