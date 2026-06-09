"""Testes da Campanha — estado autoritativo do modo história (F3.3).

A campanha é a turnê: a sequência de venues (cada uma com uma capanga), os itens
espalhados pelo mapa, e o progresso (venues vencidas, itens pegos, posição da
banda). É o que precisa sobreviver a save/load pra a história ser retomada.
"""
import sys, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pytest

from campanha import Campanha
from excecoes import VenueInvalidaError, ItemMapaInvalidoError, CampanhaError


# ── Fábrica padrão ────────────────────────────────────────────────────────────

def test_padrao_tem_venues_e_itens():
    c = Campanha.padrao()
    assert len(c.listar_venues()) >= 3
    assert len(c.listar_itens()) >= 2


def test_padrao_comeca_sem_progresso():
    c = Campanha.padrao()
    assert all(not v["concluida"] for v in c.listar_venues())
    assert all(not i["coletado"] for i in c.listar_itens())
    assert c.esta_completa() is False


def test_venues_tem_capanga_com_stats():
    c = Campanha.padrao()
    v = c.listar_venues()[0]
    assert set(v["capanga"]) >= {"nome", "hp", "dano"}
    assert v["capanga"]["hp"] > 0


# ── get_venue / get_item ──────────────────────────────────────────────────────

def test_get_venue_existente():
    c = Campanha.padrao()
    vid = c.listar_venues()[0]["id"]
    assert c.get_venue(vid)["id"] == vid


def test_get_venue_inexistente_levanta():
    c = Campanha.padrao()
    with pytest.raises(VenueInvalidaError):
        c.get_venue("nao-existe")


def test_get_item_inexistente_levanta():
    c = Campanha.padrao()
    with pytest.raises(ItemMapaInvalidoError):
        c.get_item("nao-existe")


# ── concluir / coletar ────────────────────────────────────────────────────────

def test_concluir_marca_venue():
    c = Campanha.padrao()
    vid = c.listar_venues()[0]["id"]
    c.concluir(vid)
    venue = next(v for v in c.listar_venues() if v["id"] == vid)
    assert venue["concluida"] is True


def test_concluir_venue_invalida_levanta():
    c = Campanha.padrao()
    with pytest.raises(VenueInvalidaError):
        c.concluir("fantasma")


def test_coletar_devolve_o_tipo_e_marca():
    c = Campanha.padrao()
    item = c.listar_itens()[0]
    tipo = c.coletar(item["id"])
    assert tipo == item["tipo"]
    marcado = next(i for i in c.listar_itens() if i["id"] == item["id"])
    assert marcado["coletado"] is True


def test_coletar_item_invalido_levanta():
    c = Campanha.padrao()
    with pytest.raises(ItemMapaInvalidoError):
        c.coletar("fantasma")


def test_esta_completa_quando_todas_concluidas():
    c = Campanha.padrao()
    for v in c.listar_venues():
        c.concluir(v["id"])
    assert c.esta_completa() is True


# ── posição ───────────────────────────────────────────────────────────────────

def test_posicao_get_set():
    c = Campanha.padrao()
    c.set_posicao(321.5)
    assert c.get_posicao() == 321.5


# ── round-trip (persistência) ─────────────────────────────────────────────────

def test_round_trip_preserva_defs_e_progresso():
    c = Campanha.padrao()
    vid = c.listar_venues()[0]["id"]
    iid = c.listar_itens()[0]["id"]
    c.concluir(vid)
    c.coletar(iid)
    c.set_posicao(640.0)

    clone = Campanha.from_dict(c.to_dict())

    assert [v["id"] for v in clone.listar_venues()] == [v["id"] for v in c.listar_venues()]
    assert next(v for v in clone.listar_venues() if v["id"] == vid)["concluida"] is True
    assert next(i for i in clone.listar_itens() if i["id"] == iid)["coletado"] is True
    assert clone.get_posicao() == 640.0


def test_to_dict_e_serializavel_em_json():
    import json
    json.dumps(Campanha.padrao().to_dict())  # não levanta
