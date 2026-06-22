"""Gate de progressão do Empresário + equipamento/nível que pesam na batalha.

Origem: UAT da Fase 3 (pedido do usuário).
Design: docs/design/2026-06-21-gate-progressao-empresario.md
"""
import pytest

from campanha import Campanha
from excecoes import VenueFamaInsuficienteError
from show import Show, Empresario
from fabricas import ItemFactory
from Guitarrista import Guitarrista
from Baterista import Baterista


class _RitmoFake:
    """Ritmo determinístico para isolar o cálculo de dano nos testes."""
    def __init__(self, mult=1.2, refrao=False, perfeito=False):
        self._m, self._r, self._p = mult, refrao, perfeito

    def multiplicador(self):
        return self._m

    def modo_refrao(self):
        return self._r

    def perfeito(self):
        return self._p


# ── Gate de fama na Arena (progressão) ───────────────────────────────

def test_arena_tem_fama_minima_3():
    arena = Campanha.padrao().get_venue("arena")
    assert arena.get("fama_minima") == 3


def test_bar_e_feira_sem_gate_de_fama():
    c = Campanha.padrao()
    assert c.get_venue("bar").get("fama_minima", 0) == 0
    assert c.get_venue("feira").get("fama_minima", 0) == 0
    c.checar_fama_venue("bar")      # não levanta
    c.checar_fama_venue("feira")    # não levanta


def test_checar_fama_venue_bloqueia_arena_com_fama_baixa():
    c = Campanha.padrao()           # fama 0
    with pytest.raises(VenueFamaInsuficienteError):
        c.checar_fama_venue("arena")


def test_checar_fama_venue_libera_arena_com_fama_3():
    c = Campanha.padrao()
    c.ganhar_fama(3)
    c.checar_fama_venue("arena")    # não levanta
    assert c.venue_liberada("arena") is True


def test_venue_liberada_falsa_com_fama_2():
    c = Campanha.padrao()
    c.ganhar_fama(2)                # bar(1)+feira(2) ainda não — falta vencer feira
    assert c.venue_liberada("arena") is False


def test_listar_venues_traz_fama_minima_e_liberada():
    c = Campanha.padrao()
    vs = {v["id"]: v for v in c.listar_venues()}
    assert vs["arena"]["fama_minima"] == 3
    assert vs["arena"]["liberada"] is False
    assert vs["bar"]["liberada"] is True
    c.ganhar_fama(3)
    vs = {v["id"]: v for v in c.listar_venues()}
    assert vs["arena"]["liberada"] is True


# ── Vilões mais duros (rebalance) ────────────────────────────────────

def test_empresario_e_feira_mais_duros():
    c = Campanha.padrao()
    assert c.get_venue("arena")["capanga"]["hp"] == 750
    assert c.get_venue("arena")["capanga"]["dano"] == 50
    assert c.get_venue("feira")["capanga"]["hp"] == 400


# ── Nível também dá dano (não só HP) ─────────────────────────────────

def _dano_de_um_golpe(musico, mult=1.2):
    boss = Empresario(hp=100000, dano=1)    # HP alto: o boss não cai no teste
    return Show([musico], boss).acao_musico(0, _RitmoFake(mult))["dano"]


def test_nivel_aumenta_o_dano():
    d1 = _dano_de_um_golpe(Guitarrista("Nv1", nivel=1, forca=10))
    d2 = _dano_de_um_golpe(Guitarrista("Nv2", nivel=2, forca=10))
    assert d2 > d1


def test_nivel_1_nao_muda_dano_base():
    """Regressão: no nível 1 o multiplicador de nível é 1.0 (sem efeito)."""
    g = Guitarrista("Base", nivel=1, forca=10)
    # 10*1.5=15 base; ritmo 1.0; sem ego no 1º golpe; nivel_mult 1.0 → 15
    assert _dano_de_um_golpe(g, mult=1.0) == 15


# ── Equipamento de personalização pesa na batalha ────────────────────

def test_equipar_oculos_aumenta_dano_do_baterista():
    b = Baterista("Ramiro", agilidade=10, chance_critico=0.0)  # sem crit: determinístico
    base = b.atacar()                                  # 10 * 1.0
    b.equipar(ItemFactory.criar("oculos_do_ritmo"))    # +7 agilidade (UAT Fase 3)
    com_equip = b.atacar()                             # 17 * 1.0
    assert com_equip > base
    assert com_equip - base == 7
