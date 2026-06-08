import sys, os
import json

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


def _api_com_banda(composicao=None):
    api = API()
    api.criar_banda(composicao or [{"tipo": "guitarrista", "nome": "Aldric", "forca": 10}])
    return api


# ── listar_tipos_musicos ──────────────────────────────────────────────────────

def test_listar_tipos_retorna_os_quatro_musicos():
    api = API()
    tipos = api.listar_tipos_musicos()
    chaves = {t["tipo"] for t in tipos}
    assert chaves == {"guitarrista", "vocalista", "baterista", "baixista"}


def test_listar_tipos_e_serializavel():
    api = API()
    json.dumps(api.listar_tipos_musicos())  # não levanta


# ── criar_banda / obter_estado ────────────────────────────────────────────────

def test_criar_banda_retorna_estado_serializavel():
    api = _api_com_banda()
    estado = api.obter_estado()
    json.dumps(estado)  # tudo cruza a ponte como JSON
    assert estado["banda"][0]["nome"] == "Aldric"
    assert estado["boss"]["hp"] > 0
    assert estado["fim_de_jogo"] is False


def test_estado_traz_recurso_ego_do_guitarrista():
    api = _api_com_banda([{"tipo": "guitarrista", "nome": "Aldric", "forca": 10, "ego": 30}])
    rec = api.obter_estado()["banda"][0]["recurso"]
    assert rec["tipo"] == "ego"
    assert rec["valor"] == 30
    assert rec["max"] == 50


def test_estado_traz_recurso_folego_do_vocalista():
    api = _api_com_banda([{"tipo": "vocalista", "nome": "Selene", "folego": 50, "inteligencia": 10}])
    rec = api.obter_estado()["banda"][0]["recurso"]
    assert rec["tipo"] == "folego"
    assert rec["valor"] == 50


def test_estado_traz_recurso_groove_do_baixista():
    api = _api_com_banda([{"tipo": "baixista", "nome": "Paul", "forca": 10, "fe": 20}])
    rec = api.obter_estado()["banda"][0]["recurso"]
    assert rec["tipo"] == "groove"
    assert rec["valor"] == 20


# ── executar_acao ─────────────────────────────────────────────────────────────

def test_executar_acao_reduz_hp_do_boss():
    api = _api_com_banda()
    hp0 = api.obter_estado()["boss"]["hp"]
    res = api.executar_acao({"indice": 0})
    assert res["ok"] is True
    assert res["dano"] == 15
    assert res["estado"]["boss"]["hp"] == hp0 - 15


def test_executar_acao_com_ritmo_aplica_multiplicador():
    api = _api_com_banda()
    # precisao=0.8 (<0.90, sem Modo Refrão); mult = 1.0 + 5*0.1 = 1.5
    res = api.executar_acao({"indice": 0,
                             "ritmo": {"acertos": 8, "total_notas": 10, "combo_max": 5}})
    assert res["dano"] == 22
    assert res["multiplicador_aplicado"] == pytest.approx(1.5)


def test_executar_acao_indice_invalido_retorna_erro_dto():
    api = _api_com_banda()
    res = api.executar_acao({"indice": 9})
    assert res["ok"] is False
    assert "erro" in res
    json.dumps(res)  # ErroDTO também é serializável


def test_executar_acao_vitoria_quando_boss_cai():
    api = _api_com_banda([{"tipo": "guitarrista", "nome": "Aldric", "forca": 10}])
    api._boss._hp = 10  # boss quase morto
    res = api.executar_acao({"indice": 0})
    assert res["fim_de_jogo"] is True
    assert res["resultado_final"] == "vitoria"


# ── turno_inimigo ─────────────────────────────────────────────────────────────

def test_turno_inimigo_reduz_hp_de_musico():
    api = _api_com_banda()
    hp0 = api.obter_estado()["banda"][0]["hp"]
    res = api.turno_inimigo()
    assert res["ok"] is True
    assert res["estado"]["banda"][0]["hp"] < hp0


# ── persistência ──────────────────────────────────────────────────────────────

def test_salvar_e_carregar_round_trip(tmp_path):
    api = _api_com_banda([{"tipo": "guitarrista", "nome": "Aldric", "forca": 12}])
    r = api.salvar("slot1", pasta=str(tmp_path))
    assert r["ok"] is True

    GerenciadorJogo.resetar()
    api2 = API()
    r2 = api2.carregar("slot1", pasta=str(tmp_path))
    assert r2["ok"] is True
    assert r2["estado"]["banda"][0]["nome"] == "Aldric"


def test_carregar_inexistente_retorna_erro_dto(tmp_path):
    api = API()
    r = api.carregar("naoexiste", pasta=str(tmp_path))
    assert r["ok"] is False
    assert "erro" in r


def test_listar_saves_e_serializavel(tmp_path):
    api = _api_com_banda()
    api.salvar("slot1", pasta=str(tmp_path))
    saves = api.listar_saves(pasta=str(tmp_path))
    json.dumps(saves)
    assert any(s["slot"] == "slot1" for s in saves)
