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


def test_estado_traz_recurso_inteligencia_do_vocalista():
    # F3.8: o fôlego virou a energia unificada (todo músico tem `energia` no
    # DTO) — o recurso próprio do vocalista agora é a inteligência.
    api = _api_com_banda([{"tipo": "vocalista", "nome": "Selene", "folego": 50, "inteligencia": 10}])
    m0 = api.obter_estado()["banda"][0]
    assert m0["recurso"]["tipo"] == "inteligencia"
    assert m0["recurso"]["valor"] == 10
    assert m0["energia"] == 50


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
    api._gerenciador.get_boss()._hp = 10  # boss quase morto
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


# ── nova_campanha (menu principal → Novo jogo) ────────────────────────────────

def test_nova_campanha_reseta_progresso():
    api = _api_com_banda()
    api.concluir_venue("bar")
    api.registrar_posicao(500.0)
    res = api.nova_campanha()
    assert res["ok"] is True
    camp = res["campanha"]
    json.dumps(camp)
    assert all(not v["concluida"] for v in camp["venues"])
    assert camp["fama_banda"] == 0
    assert camp["posicao"] != 500.0


def test_nova_campanha_zera_bloqueios_de_derrota():
    api = _api_com_banda()
    api.registrar_derrota("bar")
    api.nova_campanha()
    # venue volta acessível: entrar não devolve ErroDTO de bloqueio
    res = api.entrar_no_show("bar")
    assert res.get("ok") is not False


# ── sair (menu principal → Sair) ──────────────────────────────────────────────

def test_sair_sem_janela_retorna_erro_dto():
    api = API()
    r = api.sair()   # sem janela pywebview aberta → ErroDTO, nunca traceback
    assert r["ok"] is False
    assert "erro" in r


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


def test_save_load_preserva_hp_do_boss(tmp_path):
    api = _api_com_banda([{"tipo": "guitarrista", "nome": "Aldric", "forca": 10}])
    api.executar_acao({"indice": 0})  # boss leva dano
    hp_com_dano = api.obter_estado()["boss"]["hp"]
    assert hp_com_dano < 200

    api.salvar("slot_boss", pasta=str(tmp_path))
    GerenciadorJogo.resetar()
    api2 = API()
    res = api2.carregar("slot_boss", pasta=str(tmp_path))
    # o show retoma no ponto certo — boss NÃO volta pra 200
    assert res["estado"]["boss"]["hp"] == hp_com_dano


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


# ── MAP-01: van_estagio no DTO da campanha (Phase 1) ────────────────────────

def test_obter_campanha_contem_van_estagio():
    """obter_campanha() deve expor van_estagio no DTO."""
    api = _api_com_banda()
    camp = api.obter_campanha()
    assert "van_estagio" in camp


def test_van_estagio_dto_reflete_fama_atual():
    """van_estagio do DTO reflete a fama_banda atual: 0 → 1, 6+ → 3."""
    api = _api_com_banda()
    camp0 = api.obter_campanha()
    assert camp0["van_estagio"] == 1          # fama 0 → estágio 1

    # Vence 3 venues acumulando fama >= 6 (1+2+3)
    api.concluir_venue("bar")
    api.concluir_venue("feira")
    api.concluir_venue("arena")
    camp3 = api.obter_campanha()
    assert camp3["van_estagio"] == 3          # fama 6 → estágio 3


def test_van_estagio_dto_e_serializavel():
    """DTO completo da campanha deve ser JSON-serializável com van_estagio."""
    api = _api_com_banda()
    camp = api.obter_campanha()
    json.dumps(camp)  # não levanta
