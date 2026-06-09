"""Harness do contrato ritmo → dano (camada API).

Garante que a contagem crua do minigame ({acertos, total_notas, combo_max})
vira o dano/Modo Refrão/multiplicador corretos via api.executar_acao — a regra
de balanceamento mora no backend (D4), então é aqui que ela é fixada.

Base de cálculo: Guitarrista forca=10, ego=0 → dano_base = int(10*1.5) = 15.
  multiplicador() = min(1 + combo_max*0.1, 2.0)
  modo_refrao     = precisao >= 0.90  (no Show, multiplica o mult por 1.5)
  dano_final      = int(dano_base * mult)
"""
import sys, os

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


def _api_guitarrista():
    api = API()
    api.criar_banda([{"tipo": "guitarrista", "nome": "Aldric", "forca": 10, "ego": 0}])
    return api


# (acertos, total, combo_max, dano_esperado, refrao_esperado, mult_esperado)
CASOS = [
    # precisão 0.8 < 0.90 → sem refrão; mult = 1 + 5*0.1 = 1.5 → 15*1.5 = 22
    (8, 10, 5, 22, False, 1.5),
    # precisão 1.0 → refrão; mult base capado em 2.0, *1.5 = 3.0 → 15*3.0 = 45
    (10, 10, 12, 45, True, 3.0),
    # precisão 0.3 → sem refrão; mult = 1.1 → int(16.5) = 16
    (3, 10, 1, 16, False, 1.1),
    # precisão 0.9 == limiar → refrão liga; mult base 1.0, *1.5 = 1.5 → 22
    (9, 10, 0, 22, True, 1.5),
]


@pytest.mark.parametrize("acertos,total,combo,dano,refrao,mult", CASOS)
def test_contrato_ritmo_para_dano(acertos, total, combo, dano, refrao, mult):
    api = _api_guitarrista()
    res = api.executar_acao({
        "indice": 0,
        "ritmo": {"acertos": acertos, "total_notas": total, "combo_max": combo},
    })
    assert res["ok"] is True
    assert res["dano"] == dano
    assert res["modo_refrao_ativo"] is refrao
    assert res["multiplicador_aplicado"] == pytest.approx(mult)


def test_multiplicador_respeita_teto():
    # combo altíssimo não passa de 2.0 (sem refrão, p/ isolar o teto)
    api = _api_guitarrista()
    res = api.executar_acao({
        "indice": 0,
        "ritmo": {"acertos": 5, "total_notas": 10, "combo_max": 99},
    })
    assert res["multiplicador_aplicado"] == pytest.approx(2.0)
    assert res["dano"] == 30  # int(15 * 2.0)


def test_ritmo_ausente_nao_aplica_multiplicador():
    api = _api_guitarrista()
    res = api.executar_acao({"indice": 0})  # sem ritmo
    assert res["multiplicador_aplicado"] == pytest.approx(1.0)
    assert res["dano"] == 15
