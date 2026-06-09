"""Harness de integração — dirige a API exatamente como o frontend faz.

Cada teste reproduz uma sessão de jogo (abrir → montar → atacar → turno →
salvar → carregar), validando os invariantes que a UI depende. Serve como o
"jeito de testar o jogo" reproduzível: se algo aqui falha, o app real quebra
do mesmo jeito.
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
    {"tipo": "vocalista",   "nome": "Selene", "folego": 50, "inteligencia": 12},
    {"tipo": "baterista",   "nome": "Kael",   "agilidade": 12, "chance_critico": 0.3},
    {"tipo": "baixista",    "nome": "Paul",   "forca": 12, "fe": 20},
]
RITMO = {"acertos": 9, "total_notas": 10, "combo_max": 6}
HP_TOTAL_INICIAL = 100 + 80 + 90 + 130


def _serializavel(dto):
    json.dumps(dto)  # levanta TypeError se algo não-JSON cruzar a ponte
    return dto


# ── Regra de UI testável: quando o botão "Montar banda" fica disponível ───────
# O frontend habilita "Montar banda demo" quando NÃO há banda ativa, ou seja:
# banda vazia, ou o show acabou. Espelha api/main.js para travar regressões.

def _pode_montar_banda(estado: dict) -> bool:
    return len(estado["banda"]) == 0 or estado["fim_de_jogo"]


# ── Abertura ──────────────────────────────────────────────────────────────────

def test_abrir_interface_estado_inicial_neutro():
    api = API()
    estado = _serializavel(api.obter_estado())
    assert estado["banda"] == []
    assert estado["boss"]["hp"] == 200
    assert estado["fim_de_jogo"] is False          # banda vazia não é derrota
    assert _pode_montar_banda(estado) is True       # pode montar


# ── Fluxo principal de um turno ───────────────────────────────────────────────

def test_fluxo_montar_atacar_turno_inimigo():
    api = API()
    estado = _serializavel(api.criar_banda(COMPOSICAO))
    assert len(estado["banda"]) == 4
    assert _pode_montar_banda(estado) is False      # banda no palco → trava remontar

    res = _serializavel(api.executar_acao({"indice": 0, "ritmo": RITMO}))
    assert res["ok"] is True
    assert res["estado"]["boss"]["hp"] < 200
    assert res["estado"]["turno"] == "boss"

    res2 = _serializavel(api.turno_inimigo())
    assert res2["ok"] is True
    assert res2["estado"]["turno"] == "banda"
    hp_total = sum(m["hp"] for m in res2["estado"]["banda"])
    assert hp_total < HP_TOTAL_INICIAL              # alguém apanhou do Empresário


# ── BUG reportado: abrir → salvar → carregar não pode travar "Montar banda" ───

def test_salvar_vazio_e_carregar_ainda_permite_montar(tmp_path):
    api = API()
    api.obter_estado()                              # abre (banda vazia, show iniciado)
    assert api.salvar("slot1", pasta=str(tmp_path))["ok"] is True

    res = _serializavel(api.carregar("slot1", pasta=str(tmp_path)))
    assert res["ok"] is True
    assert res["estado"]["banda"] == []
    assert _pode_montar_banda(res["estado"]) is True   # <- o que travava na UI

    # e montar de fato funciona depois do load:
    estado = api.criar_banda(COMPOSICAO)
    assert len(estado["banda"]) == 4


# ── Save/load preserva o progresso inteiro (boss + cada músico) ───────────────

def test_save_load_preserva_progresso_completo(tmp_path):
    api = API()
    api.criar_banda(COMPOSICAO)
    api.executar_acao({"indice": 0, "ritmo": RITMO})
    api.turno_inimigo()
    antes = api.obter_estado()

    api.salvar("slot1", pasta=str(tmp_path))
    GerenciadorJogo.resetar()
    api2 = API()
    depois = api2.carregar("slot1", pasta=str(tmp_path))["estado"]

    assert depois["boss"]["hp"] == antes["boss"]["hp"]
    assert [m["hp"] for m in depois["banda"]] == [m["hp"] for m in antes["banda"]]
    assert [m["nome"] for m in depois["banda"]] == [m["nome"] for m in antes["banda"]]


# ── Vitória: boss zera com a banda viva ───────────────────────────────────────

def test_vitoria_ao_derrubar_o_boss():
    api = API()
    api.criar_banda(COMPOSICAO)
    api._gerenciador.get_boss()._hp = 5
    res = api.executar_acao({"indice": 0, "ritmo": RITMO})
    assert res["fim_de_jogo"] is True
    assert res["resultado_final"] == "vitoria"


# ── Tudo que cruza a ponte é serializável, em todo o fluxo ────────────────────

def test_estado_serializavel_em_todo_o_fluxo():
    api = API()
    _serializavel(api.listar_tipos_musicos())
    _serializavel(api.obter_estado())
    _serializavel(api.criar_banda(COMPOSICAO))
    _serializavel(api.executar_acao({"indice": 0, "ritmo": RITMO}))
    _serializavel(api.turno_inimigo())
