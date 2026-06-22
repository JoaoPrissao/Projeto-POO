"""F3.6a — Slots de equipamento reversíveis.

Decisão de design: equipar NÃO muta o atributo base (nada de `aumentar_forca`).
O item fica num slot e `atacar()` soma `bonus_equipamento(atributo)` na hora —
desequipar é reversível por construção. `Equipavel.usar()` (bônus permanente,
F1/F2) continua existindo, mas o fluxo do jogo agora usa equipar/desequipar.
"""
import sys, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pytest

from Guitarrista import Guitarrista
from Baterista import Baterista
from Vocalista import Vocalista
from Baixista import Baixista
from fabricas import ItemFactory
from itens import Equipavel
from musico import Musico
from excecoes import (ItemIncompativelError, ItemNaoEncontradoError,
                      SlotsOcupadosError)


def _pedal(bonus=5):
    return ItemFactory.criar("pedal", bonus=bonus)


# ── equipar / bônus reversível ────────────────────────────────────────────────

def test_equipar_soma_bonus_no_ataque_sem_mutar_atributo():
    g = Guitarrista("Aldric", forca=10)        # dano base = int(10 * 1.5) = 15
    g.equipar(_pedal(bonus=6))                 # forca efetiva 16 → dano 24
    assert g.get_forca() == 10                 # atributo base intocado
    assert g.bonus_equipamento("forca") == 6
    assert g.atacar() == 24

def test_desequipar_reverte_o_bonus():
    g = Guitarrista("Aldric", forca=10)
    g.equipar(_pedal(bonus=6))
    item = g.desequipar("Pedal de Efeito")
    assert isinstance(item, Equipavel)
    assert g.bonus_equipamento("forca") == 0
    assert g.atacar() == 15

def test_listar_equipados():
    g = Guitarrista("Aldric")
    assert g.listar_equipados() == []
    pedal = _pedal()
    g.equipar(pedal)
    assert g.listar_equipados() == [pedal]

def test_bonus_acumula_com_dois_itens():
    g = Guitarrista("Aldric", forca=10)
    g.equipar(_pedal(bonus=5))
    g.equipar(ItemFactory.criar("amplificador", bonus=8))
    assert g.bonus_equipamento("forca") == 13
    assert g.atacar() == int((10 + 13) * 1.5)

def test_baixista_soma_bonus_no_ataque():
    b = Baixista("Paul", forca=10, fe=0)       # sem groove: dano = forca*1.5
    b.equipar(_pedal(bonus=4))
    assert b.atacar() == int((10 + 4) * 1.5)


# ── validações ────────────────────────────────────────────────────────────────

def test_equipar_classe_incompativel_levanta_erro():
    v = Vocalista("Selene")
    with pytest.raises(ItemIncompativelError):
        v.equipar(_pedal())                    # pedal é só Guitarrista/Baixista

def test_equipar_consumivel_levanta_erro():
    g = Guitarrista("Aldric")
    with pytest.raises(ItemIncompativelError):
        g.equipar(ItemFactory.criar("energetico"))

def test_slots_ocupados_levanta_erro():
    g = Guitarrista("Aldric")
    g.equipar(_pedal())
    g.equipar(_pedal())                        # SLOTS_EQUIPAMENTO = 2
    with pytest.raises(SlotsOcupadosError):
        g.equipar(_pedal())

def test_desequipar_item_inexistente_levanta_erro():
    g = Guitarrista("Aldric")
    with pytest.raises(ItemNaoEncontradoError):
        g.desequipar("Pedal de Efeito")


# ── outros atributos (duck typing do bônus) ──────────────────────────────────

def test_bonus_de_agilidade_no_baterista():
    bat = Baterista("Kael", agilidade=10, chance_critico=0.0)  # sem crítico: dano = ag*1.0
    baqueta = Equipavel("Baqueta de Aço", atributo="agilidade", bonus=4,
                        classes_permitidas=("Baterista",))
    bat.equipar(baqueta)
    assert bat.atacar() == 14

def test_bonus_de_inteligencia_no_vocalista():
    v = Vocalista("Selene", folego=50, inteligencia=10)        # dano = int*2.0
    micro = Equipavel("Microfone Vintage", atributo="inteligencia", bonus=3,
                      classes_permitidas=("Vocalista",))
    v.equipar(micro)
    assert v.atacar() == 26

def test_bonus_de_forca_no_baixista_item_exclusivo():
    # 02-01: corda_de_tungstenio é exclusiva do Baixista; forca efetiva = 10+5=15 → dano 22
    b = Baixista("Marivaldo", forca=10, fe=0)                  # fe=0: sem groove, dano = forca*1.5
    corda = Equipavel("Corda de Tungstênio", atributo="forca", bonus=5,
                      classes_permitidas=("Baixista",))
    b.equipar(corda)
    assert b.atacar() == 22   # int(15 * 1.5) = 22

def test_item_exclusivo_baixista_incompativel_com_guitarrista():
    from Guitarrista import Guitarrista as G
    from excecoes import ItemIncompativelError
    g = G("Geraldo", forca=10)
    corda = Equipavel("Corda de Tungstênio", atributo="forca", bonus=5,
                      classes_permitidas=("Baixista",))
    with pytest.raises(ItemIncompativelError):
        g.equipar(corda)


# ── persistência ──────────────────────────────────────────────────────────────

def test_round_trip_preserva_equipados():
    g = Guitarrista("Aldric", forca=10)
    g.equipar(_pedal(bonus=6))
    clone = Musico.from_dict(g.to_dict())
    assert [i.nome for i in clone.listar_equipados()] == ["Pedal de Efeito"]
    assert clone.bonus_equipamento("forca") == 6
    assert clone.atacar() == 24


# ── Ponte (API) — equipar na van via Tab ──────────────────────────────────────

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'bridge'))

from api import API                      # noqa: E402
from gerenciador import GerenciadorJogo  # noqa: E402


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


def _dar_item(api, indice, tipo):
    musico = api._gerenciador.listar_jogadores()[indice]
    musico.get_inventario().adicionar(ItemFactory.criar(tipo))


def test_obter_equipamento_traz_slots_inventario_e_equipados():
    import json
    api = _api_com_banda()
    _dar_item(api, 0, "pedal")
    res = api.obter_equipamento()
    json.dumps(res)
    assert res["ok"] is True
    m0 = res["banda"][0]
    assert m0["slots"] == 2
    assert m0["equipados"] == []
    inv = m0["inventario"]
    assert inv[0]["nome"] == "Pedal de Efeito"
    assert inv[0]["equipavel"] is True
    assert inv[0]["classes_permitidas"] == ["Guitarrista", "Baixista"]


def test_equipar_move_do_inventario_pro_slot():
    api = _api_com_banda()
    _dar_item(api, 0, "pedal")
    res = api.equipar({"indice": 0, "nome": "Pedal de Efeito"})
    assert res["ok"] is True
    m0 = res["banda"][0]
    assert [e["nome"] for e in m0["equipados"]] == ["Pedal de Efeito"]
    assert m0["inventario"] == []
    g0 = api._gerenciador.listar_jogadores()[0]
    assert g0.bonus_equipamento("forca") == 7   # pedal +7 (UAT Fase 3)


def test_equipar_incompativel_vira_erro_dto_e_item_fica_no_inventario():
    api = _api_com_banda()
    _dar_item(api, 1, "pedal")               # Vocalista não pode pedal
    res = api.equipar({"indice": 1, "nome": "Pedal de Efeito"})
    assert res["ok"] is False
    v = api._gerenciador.listar_jogadores()[1]
    assert any(i.nome == "Pedal de Efeito" for i in v.get_inventario().listar())


def test_equipar_item_fora_do_inventario_vira_erro_dto():
    api = _api_com_banda()
    res = api.equipar({"indice": 0, "nome": "Pedal de Efeito"})
    assert res["ok"] is False


def test_desequipar_devolve_pro_inventario():
    api = _api_com_banda()
    _dar_item(api, 0, "pedal")
    api.equipar({"indice": 0, "nome": "Pedal de Efeito"})
    res = api.desequipar({"indice": 0, "nome": "Pedal de Efeito"})
    assert res["ok"] is True
    m0 = res["banda"][0]
    assert m0["equipados"] == []
    assert [i["nome"] for i in m0["inventario"]] == ["Pedal de Efeito"]


def test_desequipar_inexistente_vira_erro_dto():
    api = _api_com_banda()
    res = api.desequipar({"indice": 0, "nome": "Pedal de Efeito"})
    assert res["ok"] is False


def test_save_load_preserva_equipados_via_api(tmp_path):
    api = _api_com_banda()
    _dar_item(api, 0, "pedal")
    api.equipar({"indice": 0, "nome": "Pedal de Efeito"})
    api.salvar("slot_eq", pasta=str(tmp_path))

    GerenciadorJogo.resetar()
    api2 = API()
    api2.carregar("slot_eq", pasta=str(tmp_path))
    res = api2.obter_equipamento()
    assert [e["nome"] for e in res["banda"][0]["equipados"]] == ["Pedal de Efeito"]
    g0 = api2._gerenciador.listar_jogadores()[0]
    assert g0.bonus_equipamento("forca") == 7   # pedal +7 (UAT Fase 3)
