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


# ── F3.4: recompensa por venue (XP + drop) ────────────────────────────────────

def test_venues_tem_fama_xp_e_drop():
    c = Campanha.padrao()
    for v in c.listar_venues():
        assert v["fama"] >= 1
    rec = c.get_recompensa(c.listar_venues()[0]["id"])
    assert rec["xp"] > 0
    assert rec["drop"]


def test_get_recompensa_venue_invalida_levanta():
    with pytest.raises(VenueInvalidaError):
        Campanha.padrao().get_recompensa("fantasma")


# ── F3.4: fama da banda ───────────────────────────────────────────────────────

def test_fama_banda_comeca_zero():
    assert Campanha.padrao().fama_banda() == 0


def test_ganhar_e_perder_fama_com_piso_zero():
    c = Campanha.padrao()
    c.ganhar_fama(3)
    assert c.fama_banda() == 3
    c.perder_fama(10)                 # não passa de 0
    assert c.fama_banda() == 0


def test_concluir_da_fama_da_venue_e_e_idempotente():
    c = Campanha.padrao()
    v = c.listar_venues()[0]          # fama 1
    c.concluir(v["id"])
    assert c.fama_banda() == v["fama"]
    c.concluir(v["id"])               # de novo não dobra a fama
    assert c.fama_banda() == v["fama"]


def test_mult_banda_cresce_com_a_fama():
    c = Campanha.padrao()
    base = c.mult_banda()
    c.ganhar_fama(5)
    assert c.mult_banda() > base


# ── F3.4: bloqueio de venue (clock injetado) ──────────────────────────────────

def test_bloquear_venue_fica_bloqueada_antes_de_expirar():
    c = Campanha.padrao()
    vid = c.listar_venues()[0]["id"]
    c.bloquear_venue(vid, agora=1000.0)
    assert c.venue_bloqueada(vid, agora=1001.0) is True
    assert c.segundos_bloqueio(vid, agora=1001.0) > 0


def test_bloqueio_expira_depois_do_tempo():
    c = Campanha.padrao()
    vid = c.listar_venues()[0]["id"]
    c.bloquear_venue(vid, agora=1000.0)
    # passou muito tempo (bem além de DURACAO_BASE * fama)
    assert c.venue_bloqueada(vid, agora=999999.0) is False
    assert c.segundos_bloqueio(vid, agora=999999.0) == 0


def test_bloqueio_escala_com_a_fama_da_venue():
    c = Campanha.padrao()
    venues = c.listar_venues()
    fraca = min(venues, key=lambda v: v["fama"])
    forte = max(venues, key=lambda v: v["fama"])
    c.bloquear_venue(fraca["id"], agora=0.0)
    c.bloquear_venue(forte["id"], agora=0.0)
    assert c.segundos_bloqueio(forte["id"], agora=0.0) > c.segundos_bloqueio(fraca["id"], agora=0.0)


def test_registrar_derrota_bloqueia_e_reduz_fama():
    c = Campanha.padrao()
    c.ganhar_fama(2)
    vid = c.listar_venues()[0]["id"]
    c.registrar_derrota(vid, agora=0.0)
    assert c.venue_bloqueada(vid, agora=1.0) is True
    assert c.fama_banda() == 1        # perdeu 1 de fama


def test_concluir_limpa_bloqueio():
    c = Campanha.padrao()
    vid = c.listar_venues()[0]["id"]
    c.bloquear_venue(vid, agora=0.0)
    c.concluir(vid)
    assert c.venue_bloqueada(vid, agora=1.0) is False


def test_listar_venues_traz_flags_de_bloqueio():
    c = Campanha.padrao()
    vid = c.listar_venues()[0]["id"]
    c.bloquear_venue(vid, agora=0.0)
    v = next(v for v in c.listar_venues(agora=1.0) if v["id"] == vid)
    assert v["bloqueada"] is True
    assert v["bloqueada_seg"] > 0


# ── F3.4: round-trip preserva fama + bloqueios ────────────────────────────────

def test_round_trip_preserva_fama_e_bloqueios():
    c = Campanha.padrao()
    vid = c.listar_venues()[0]["id"]
    c.ganhar_fama(4)
    c.bloquear_venue(vid, agora=1000.0)

    clone = Campanha.from_dict(c.to_dict())
    assert clone.fama_banda() == 4
    assert clone.venue_bloqueada(vid, agora=1001.0) is True
    assert clone.venue_bloqueada(vid, agora=999999.0) is False


# ── MAP-01: van_estagio (Phase 1) ────────────────────────────────────────────

def test_van_estagio_fama_zero_retorna_1():
    c = Campanha.padrao()
    assert c.van_estagio() == 1


def test_van_estagio_fama_2_retorna_1():
    c = Campanha.padrao()
    c.ganhar_fama(2)
    assert c.van_estagio() == 1


def test_van_estagio_fama_3_retorna_2():
    c = Campanha.padrao()
    c.ganhar_fama(3)
    assert c.van_estagio() == 2


def test_van_estagio_fama_5_retorna_2():
    c = Campanha.padrao()
    c.ganhar_fama(5)
    assert c.van_estagio() == 2


def test_van_estagio_fama_6_retorna_3():
    c = Campanha.padrao()
    c.ganhar_fama(6)
    assert c.van_estagio() == 3


def test_van_estagio_fama_acima_de_6_retorna_3():
    c = Campanha.padrao()
    c.ganhar_fama(10)
    assert c.van_estagio() == 3


def test_van_estagio_sobe_ao_ganhar_fama():
    c = Campanha.padrao()
    c.ganhar_fama(6)
    assert c.van_estagio() == 3


def test_van_estagio_regride_ao_perder_fama():
    """D-03: van pode regredir — reflete a fama atual, sobe e desce."""
    c = Campanha.padrao()
    c.ganhar_fama(6)
    assert c.van_estagio() == 3
    c.perder_fama(4)            # fama cai pra 2
    assert c.van_estagio() == 1


def test_van_estagio_nao_e_persistido_em_to_dict():
    """van_estagio é derivado de fama_banda — não deve aparecer em to_dict."""
    c = Campanha.padrao()
    c.ganhar_fama(5)
    d = c.to_dict()
    assert "van_estagio" not in d
