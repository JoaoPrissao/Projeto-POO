"""F3.7 — Recuperação + van/loja: cachê por show, regen passivo e consumíveis.

Economia: cada venue paga um `cache_recompensa` na PRIMEIRA vitória (idempotente,
como o XP/fama). O cachê vive na Campanha (persiste no envelope de save) e é
gasto na loja da van (consumíveis). Regen passivo: a banda recupera HP devagar
enquanto está no mapa (a ponte aplica em lotes de segundos, com teto por chamada
pra taxa ficar autoritativa no backend).
"""
import sys, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'bridge'))

import pytest

from campanha import Campanha
from excecoes import CacheInsuficienteError
from api import API, HP_REGEN_POR_SEGUNDO, REGEN_MAX_SEG_POR_CHAMADA, LOJA
from gerenciador import GerenciadorJogo


@pytest.fixture(autouse=True)
def _reset_singleton():
    GerenciadorJogo.resetar()
    yield
    GerenciadorJogo.resetar()


def _api_com_banda():
    api = API()
    api.criar_banda([
        {"tipo": "guitarrista", "nome": "Aldric", "forca": 10},
        {"tipo": "vocalista", "nome": "Selene", "folego": 50, "inteligencia": 12},
    ])
    return api


# ── Campanha: cachê ───────────────────────────────────────────────────────────

def test_cache_comeca_zero_e_acumula():
    camp = Campanha.padrao()
    assert camp.get_cache() == 0
    camp.ganhar_cache(80)
    camp.gastar_cache(30)
    assert camp.get_cache() == 50


def test_gastar_cache_sem_saldo_levanta_erro():
    camp = Campanha.padrao()
    camp.ganhar_cache(10)
    with pytest.raises(CacheInsuficienteError):
        camp.gastar_cache(11)
    assert camp.get_cache() == 10            # nada foi debitado


def test_round_trip_preserva_cache():
    camp = Campanha.padrao()
    camp.ganhar_cache(120)
    clone = Campanha.from_dict(camp.to_dict())
    assert clone.get_cache() == 120


def test_venues_padrao_pagam_cache_crescente():
    venues = Campanha.padrao().listar_venues()
    caches = [v["cache_recompensa"] for v in venues]
    assert all(c > 0 for c in caches)
    assert caches == sorted(caches) and caches[0] < caches[-1]


# ── Ponte: cachê por show ─────────────────────────────────────────────────────

def test_concluir_venue_paga_cache_uma_vez():
    api = _api_com_banda()
    res = api.concluir_venue("bar")
    assert res["cache_ganho"] > 0
    assert res["campanha"]["cache"] == res["cache_ganho"]
    de_novo = api.concluir_venue("bar")      # idempotente, como XP/fama
    assert de_novo["cache_ganho"] == 0
    assert de_novo["campanha"]["cache"] == res["cache_ganho"]


def test_obter_campanha_traz_cache():
    api = _api_com_banda()
    assert api.obter_campanha()["cache"] == 0


# ── Ponte: regen passivo na van ───────────────────────────────────────────────

def test_regenerar_banda_cura_vivos_ate_o_max():
    api = _api_com_banda()
    banda = api._gerenciador.listar_jogadores()
    banda[0]._hp = 50
    res = api.regenerar_banda(5)
    assert res["ok"] is True
    assert banda[0].get_hp() == 50 + 5 * HP_REGEN_POR_SEGUNDO
    api.regenerar_banda(9999)                # capado: nunca passa do teto/max
    assert banda[0].get_hp() <= banda[0].get_hp_maximo()


def test_regenerar_banda_nao_cura_nocauteado():
    api = _api_com_banda()
    banda = api._gerenciador.listar_jogadores()
    banda[0]._hp = 0
    api.regenerar_banda(5)
    assert banda[0].get_hp() == 0


def test_regenerar_banda_capa_segundos_por_chamada():
    api = _api_com_banda()
    banda = api._gerenciador.listar_jogadores()
    banda[0]._hp = 1
    api.regenerar_banda(99999)
    esperado = min(1 + REGEN_MAX_SEG_POR_CHAMADA * HP_REGEN_POR_SEGUNDO,
                   banda[0].get_hp_maximo())
    assert banda[0].get_hp() == esperado


# ── Ponte: loja da van ────────────────────────────────────────────────────────

def test_comprar_gasta_cache_e_guarda_no_inventario():
    api = _api_com_banda()
    api._garantir_campanha().ganhar_cache(100)
    res = api.comprar({"tipo": "energetico", "indice": 0})
    assert res["ok"] is True
    assert res["cache"] == 100 - LOJA["energetico"]
    g0 = api._gerenciador.listar_jogadores()[0]
    assert any(i.nome == "Energético" for i in g0.get_inventario().listar())


def test_comprar_sem_cache_vira_erro_dto():
    api = _api_com_banda()
    res = api.comprar({"tipo": "energetico", "indice": 0})
    assert res["ok"] is False
    g0 = api._gerenciador.listar_jogadores()[0]
    assert len(g0.get_inventario()) == 0     # nada entregue


def test_comprar_tipo_fora_da_loja_vira_erro_dto():
    api = _api_com_banda()
    api._garantir_campanha().ganhar_cache(999)
    res = api.comprar({"tipo": "pedal", "indice": 0})   # loja só vende consumível
    assert res["ok"] is False


# ── Ponte: usar consumível na van ─────────────────────────────────────────────

def test_usar_item_consumivel_cura_e_consome():
    api = _api_com_banda()
    g0 = api._gerenciador.listar_jogadores()[0]
    g0._hp = 30
    from fabricas import ItemFactory
    g0.get_inventario().adicionar(ItemFactory.criar("energetico"))   # cura 50
    res = api.usar_item({"indice": 0, "nome": "Energético"})
    assert res["ok"] is True
    assert g0.get_hp() == 80
    assert len(g0.get_inventario()) == 0     # consumido


def test_usar_item_equipavel_pela_van_vira_erro_dto():
    # Equipável não se "usa" pela van (seria bônus permanente burlando os
    # slots) — equipar é só pelos slots (F3.6).
    api = _api_com_banda()
    from fabricas import ItemFactory
    g0 = api._gerenciador.listar_jogadores()[0]
    g0.get_inventario().adicionar(ItemFactory.criar("pedal"))
    res = api.usar_item({"indice": 0, "nome": "Pedal de Efeito"})
    assert res["ok"] is False
    assert any(i.nome == "Pedal de Efeito" for i in g0.get_inventario().listar())
