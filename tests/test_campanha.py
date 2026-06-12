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


# ── MAP-02: NPCs no domínio (Phase 1) ────────────────────────────────────────

from excecoes import NpcInvalidoError


def test_listar_npcs_retorna_3_npcs():
    """Campanha.padrao() deve expor 3 NPCs, cada um com flag dado=False."""
    c = Campanha.padrao()
    npcs = c.listar_npcs()
    assert len(npcs) == 3
    assert all(not n["dado"] for n in npcs)


def test_listar_npcs_campos_obrigatorios():
    """Cada NPC deve ter: id, x, nome, fala, item."""
    c = Campanha.padrao()
    for n in c.listar_npcs():
        assert {"id", "x", "nome", "fala", "item"} <= set(n.keys())


def test_get_npc_existente():
    c = Campanha.padrao()
    nid = c.listar_npcs()[0]["id"]
    n = c.get_npc(nid)
    assert n["id"] == nid


def test_get_npc_invalido_levanta():
    c = Campanha.padrao()
    with pytest.raises(NpcInvalidoError):
        c.get_npc("nao-existe")


def test_dar_item_npc_marca_dado_e_retorna_tipo():
    c = Campanha.padrao()
    nid = c.listar_npcs()[0]["id"]
    tipo = c.dar_item_npc(nid)
    assert isinstance(tipo, str) and len(tipo) > 0
    marcado = next(n for n in c.listar_npcs() if n["id"] == nid)
    assert marcado["dado"] is True


def test_dar_item_npc_invalido_levanta():
    c = Campanha.padrao()
    with pytest.raises(NpcInvalidoError):
        c.dar_item_npc("fantasma")


def test_dar_item_npc_idempotente_quanto_ao_conjunto():
    """Chamar dar_item_npc duas vezes não duplica no conjunto npcs_dados."""
    c = Campanha.padrao()
    nid = c.listar_npcs()[0]["id"]
    c.dar_item_npc(nid)
    c.dar_item_npc(nid)  # segunda chamada — set não cresce
    marcados = [n for n in c.listar_npcs() if n["dado"]]
    assert len(marcados) == 1


def test_round_trip_preserva_npcs_e_npcs_dados():
    c = Campanha.padrao()
    nid = c.listar_npcs()[0]["id"]
    c.dar_item_npc(nid)

    clone = Campanha.from_dict(c.to_dict())

    assert len(clone.listar_npcs()) == 3
    marcado = next(n for n in clone.listar_npcs() if n["id"] == nid)
    assert marcado["dado"] is True


def test_from_dict_save_antigo_sem_npcs_usa_defaults():
    """from_dict com save sem chaves 'npcs'/'npcs_dados' usa _NPCS_PADRAO e conjunto vazio."""
    import json
    c = Campanha.padrao()
    d = c.to_dict()
    d.pop("npcs", None)
    d.pop("npcs_dados", None)

    clone = Campanha.from_dict(d)
    npcs = clone.listar_npcs()
    assert len(npcs) == 3
    assert all(not n["dado"] for n in npcs)


def test_to_dict_npcs_e_serializavel():
    import json
    c = Campanha.padrao()
    nid = c.listar_npcs()[0]["id"]
    c.dar_item_npc(nid)
    d = c.to_dict()
    json.dumps(d)  # nao levanta
    assert "npcs" in d
    assert "npcs_dados" in d


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


# ── MAP-03: Baús/segredos no domínio (Phase 1) ───────────────────────────────

from excecoes import BauInvalidoError, FamaInsuficienteError


def test_listar_baus_retorna_2_baus():
    """Campanha.padrao() deve expor 2 baús, cada um com aberto=False."""
    c = Campanha.padrao()
    baus = c.listar_baus()
    assert len(baus) == 2
    assert all(not b["aberto"] for b in baus)


def test_listar_baus_campos_obrigatorios():
    """Cada baú deve ter: id, x, item."""
    c = Campanha.padrao()
    for b in c.listar_baus():
        assert {"id", "x", "item"} <= set(b.keys())


def test_bau1_revelado_sem_fama():
    """Baú 1 (sem fama_minima ou fama_minima=0) deve estar revelado com fama zero."""
    c = Campanha.padrao()
    baus = c.listar_baus()
    bau1 = next(b for b in baus if b.get("fama_minima", 0) == 0 or "fama_minima" not in b)
    assert bau1["revelado"] is True


def test_bau2_gate_e_fama_3():
    """Baú 2 deve ter gate de fama_minima=3 (alcançável antes do boss final — D-11 revisada).
    Com bar=1, feira=2, arena=3, fama 3 = vencer bar+feira ANTES da arena."""
    c = Campanha.padrao()
    bau2 = next(b for b in c.listar_baus() if b["id"] == "bau2")
    assert bau2["fama_minima"] == 3


def test_bau2_oculto_com_fama_baixa():
    """Baú 2 deve estar oculto (revelado=False) com fama abaixo do gate (< 3)."""
    c = Campanha.padrao()
    c.ganhar_fama(2)   # bar vencido só (1) ou bar parcial — abaixo do gate
    assert c.fama_banda() < 3
    bau2 = next(b for b in c.listar_baus() if b["id"] == "bau2")
    assert bau2["revelado"] is False


def test_bau2_revelado_com_fama_suficiente():
    """Baú 2 deve ficar revelado após fama_banda >= 3 (bar+feira vencidos)."""
    c = Campanha.padrao()
    c.ganhar_fama(3)
    bau2 = next(b for b in c.listar_baus() if b["id"] == "bau2")
    assert bau2["revelado"] is True


def test_get_bau_invalido_levanta():
    """get_bau com id inválido deve levantar BauInvalidoError."""
    c = Campanha.padrao()
    with pytest.raises(BauInvalidoError):
        c.get_bau("nao-existe")


def test_abrir_bau1_marca_aberto_e_retorna_tipo():
    """abrir_bau(bau1) com qualquer fama deve marcar aberto e retornar tipo do item."""
    c = Campanha.padrao()
    bau_id = next(b["id"] for b in c.listar_baus() if b.get("fama_minima", 0) == 0 or "fama_minima" not in b)
    tipo = c.abrir_bau(bau_id)
    assert isinstance(tipo, str) and len(tipo) > 0
    marcado = next(b for b in c.listar_baus() if b["id"] == bau_id)
    assert marcado["aberto"] is True


def test_abrir_bau2_gated_com_fama_baixa_levanta():
    """abrir_bau(bau2) com fama < 3 deve levantar FamaInsuficienteError sem marcar aberto."""
    c = Campanha.padrao()
    c.ganhar_fama(2)
    with pytest.raises(FamaInsuficienteError):
        c.abrir_bau("bau2")
    # não deve ter marcado aberto
    marcado = next(b for b in c.listar_baus() if b["id"] == "bau2")
    assert marcado["aberto"] is False


def test_abrir_bau2_liberado_com_fama_suficiente():
    """abrir_bau(bau2) com fama >= 3 deve marcar aberto e retornar tipo."""
    c = Campanha.padrao()
    c.ganhar_fama(3)
    tipo = c.abrir_bau("bau2")
    assert isinstance(tipo, str) and len(tipo) > 0
    marcado = next(b for b in c.listar_baus() if b["id"] == "bau2")
    assert marcado["aberto"] is True


def test_round_trip_preserva_baus_e_baus_abertos():
    """to_dict/from_dict deve preservar baus e baus_abertos."""
    c = Campanha.padrao()
    bau_id = next(b["id"] for b in c.listar_baus() if b.get("fama_minima", 0) == 0 or "fama_minima" not in b)
    c.abrir_bau(bau_id)

    clone = Campanha.from_dict(c.to_dict())

    assert len(clone.listar_baus()) == 2
    marcado = next(b for b in clone.listar_baus() if b["id"] == bau_id)
    assert marcado["aberto"] is True


def test_from_dict_save_antigo_sem_baus_usa_defaults():
    """from_dict com save sem chaves 'baus'/'baus_abertos' usa _BAUS_PADRAO e conjunto vazio."""
    c = Campanha.padrao()
    d = c.to_dict()
    d.pop("baus", None)
    d.pop("baus_abertos", None)

    clone = Campanha.from_dict(d)
    baus = clone.listar_baus()
    assert len(baus) == 2
    assert all(not b["aberto"] for b in baus)


def test_to_dict_baus_e_serializavel():
    """to_dict com baus deve ser JSON-serializável."""
    import json
    c = Campanha.padrao()
    bau_id = next(b["id"] for b in c.listar_baus() if b.get("fama_minima", 0) == 0 or "fama_minima" not in b)
    c.abrir_bau(bau_id)
    d = c.to_dict()
    json.dumps(d)
    assert "baus" in d
    assert "baus_abertos" in d
