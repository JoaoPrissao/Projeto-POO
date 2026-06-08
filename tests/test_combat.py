import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pytest
from unittest.mock import patch
from musico import Musico
from Guitarrista import Guitarrista
from Vocalista import Vocalista
from Baterista import Baterista
from Baixista import Baixista


def test_musico_e_abstrata():
    with pytest.raises(TypeError):
        Musico("Teste")


# ── atacar() retorna int (D2: dano base sem aplicar) ──────────────

def test_guitarrista_atacar_retorna_dano_base():
    g = Guitarrista("Aldric", forca=10)
    dano = g.atacar()
    assert dano == 15  # int(10 * 1.5)


def test_guitarrista_herda_musico():
    g = Guitarrista("Aldric")
    assert isinstance(g, Musico)


def test_guitarrista_atacar_nao_aplica_dano_ao_alvo():
    g = Guitarrista("Aldric", forca=10)
    alvo = Guitarrista("Dummy")
    hp_antes = alvo.get_hp()
    g.atacar()  # sem alvo — dano não é aplicado
    assert alvo.get_hp() == hp_antes  # alvo intacto


def test_vocalista_dano_magico_com_folego():
    m = Vocalista("Selene", inteligencia=10, folego=50)
    dano = m.atacar()
    assert dano == 20            # int(10 * 2.0)
    assert m.get_folego() == 40  # consumiu 10 de fôlego


def test_vocalista_dano_minimo_sem_folego():
    m = Vocalista("Selene", inteligencia=10, folego=5)
    dano = m.atacar()
    assert dano == 5  # dano base mínimo


def test_baterista_dano_normal_sem_critico():
    with patch("random.random", return_value=1.0):  # nunca crítico
        l = Baterista("Kael", agilidade=10, chance_critico=0.3)
        dano = l.atacar()
        assert dano == 10  # int(10 * 1.0)
        assert l.foi_virada_de_bateria() is False


def test_baterista_dano_critico():
    with patch("random.random", return_value=0.0):  # sempre crítico
        l = Baterista("Kael", agilidade=10, chance_critico=0.3)
        dano = l.atacar()
        assert dano == 30  # int(10 * 3.0)
        assert l.foi_virada_de_bateria() is True


def test_baixista_atacar_retorna_dano_e_se_cura():
    p = Baixista("Arthur", hp_maximo=150, forca=20, fe=20)
    p.receber_dano(30)
    hp_antes = p.get_hp()
    dano = p.atacar()
    assert dano == 30  # int(20 * 1.5)
    assert p.get_hp() > hp_antes  # auto-cura interna


def test_baixista_sem_groove_sem_cura():
    p = Baixista("Arthur", hp_maximo=150, forca=20, fe=0)
    p.receber_dano(30)
    hp_antes = p.get_hp()
    dano = p.atacar()
    assert dano == 30
    assert p.get_hp() == hp_antes  # sem cura


# ── Ego do Guitarrista ────────────────────────────────────────────

def test_guitarrista_ego_sobe_por_ataque():
    g = Guitarrista("Aldric", forca=10)
    assert g.get_ego() == 0
    g.atacar()
    assert g.get_ego() == Guitarrista.EGO_BONUS_POR_ATAQUE


def test_guitarrista_ego_respeita_teto():
    g = Guitarrista("Aldric", forca=10, ego=Guitarrista.EGO_MAX)
    g.atacar()
    assert g.get_ego() == Guitarrista.EGO_MAX
