import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pytest
from unittest.mock import patch

from show import Show, Inimigo
from Guerreiro import Guerreiro
from Mago import Mago
from Ladrao import Ladrao
from Paladino import Paladino
from gerenciador import GerenciadorJogo
from excecoes import JogadorMortoError


@pytest.fixture(autouse=True)
def _reset_singleton():
    GerenciadorJogo.resetar()
    yield
    GerenciadorJogo.resetar()


# ── Inimigo ───────────────────────────────────────────────────────────────────

def test_inimigo_esta_vivo_com_hp_positivo():
    inimigo = Inimigo("Boss", hp=100, dano=10)
    assert inimigo.esta_vivo() is True


def test_inimigo_morre_ao_receber_dano_total():
    inimigo = Inimigo("Boss", hp=10, dano=10)
    inimigo.receber_dano(10)
    assert inimigo.esta_vivo() is False


def test_inimigo_receber_dano_morto_levanta_jogador_morto_error():
    inimigo = Inimigo("Boss", hp=5, dano=10)
    inimigo.receber_dano(5)
    with pytest.raises(JogadorMortoError):
        inimigo.receber_dano(1)


def test_inimigo_get_hp_apos_dano():
    inimigo = Inimigo("Boss", hp=50, dano=10)
    assert inimigo.get_hp() == 50
    inimigo.receber_dano(20)
    assert inimigo.get_hp() == 30


def test_inimigo_get_nome():
    inimigo = Inimigo("Boss Teste", hp=100, dano=10)
    assert inimigo.get_nome() == "Boss Teste"


# ── Show.acao_musico ──────────────────────────────────────────────────────────

def test_acao_musico_reduz_hp_do_inimigo():
    g = Guerreiro("Aldric", forca=10)  # dano = int(10 * 1.5) = 15
    inimigo = Inimigo("Boss", hp=100, dano=10)
    show = Show([g], inimigo)
    resultado = show.acao_musico(0)
    assert inimigo.get_hp() == 85
    assert resultado["dano"] == 15


def test_acao_musico_retorna_dict_com_campos_esperados():
    g = Guerreiro("Aldric", forca=10)
    inimigo = Inimigo("Boss", hp=100, dano=10)
    show = Show([g], inimigo)
    resultado = show.acao_musico(0)
    assert "atacante" in resultado
    assert "dano" in resultado
    assert "hp_inimigo" in resultado
    assert "fim" in resultado


def test_acao_musico_retorna_vitoria_quando_inimigo_cai():
    g = Guerreiro("Aldric", forca=10)  # dano = 15
    inimigo = Inimigo("Boss", hp=10, dano=10)
    show = Show([g], inimigo)
    resultado = show.acao_musico(0)
    assert resultado["fim"] == "vitoria"
    assert not inimigo.esta_vivo()


def test_acao_musico_retorna_fim_none_se_jogo_continua():
    g = Guerreiro("Aldric", forca=10)
    inimigo = Inimigo("Boss", hp=100, dano=10)
    show = Show([g], inimigo)
    resultado = show.acao_musico(0)
    assert resultado["fim"] is None


# ── Show.turno_inimigo ────────────────────────────────────────────────────────

def test_turno_inimigo_reduz_hp_de_musico_vivo():
    g = Guerreiro("Aldric", forca=10)
    hp_antes = g.get_hp()
    inimigo = Inimigo("Boss", hp=100, dano=20)
    show = Show([g], inimigo)
    resultado = show.turno_inimigo()
    assert g.get_hp() == hp_antes - 20
    assert resultado["dano"] == 20


def test_turno_inimigo_retorna_dict_com_campos_esperados():
    g = Guerreiro("Aldric", forca=10)
    inimigo = Inimigo("Boss", hp=100, dano=20)
    show = Show([g], inimigo)
    resultado = show.turno_inimigo()
    assert "atacante" in resultado
    assert "alvo" in resultado
    assert "dano" in resultado
    assert "hp_alvo" in resultado
    assert "fim" in resultado


def test_turno_inimigo_pula_musico_nocauteado():
    g1 = Guerreiro("Morto", hp_maximo=10, forca=1)
    g1.receber_dano(10)
    g2 = Guerreiro("Vivo", forca=10)
    hp_antes = g2.get_hp()
    inimigo = Inimigo("Boss", hp=100, dano=20)
    show = Show([g1, g2], inimigo)
    resultado = show.turno_inimigo()
    assert g1.get_hp() == 0
    assert g2.get_hp() == hp_antes - 20
    assert resultado["alvo"] == "Vivo"


def test_turno_inimigo_sem_musicos_vivos_retorna_derrota():
    g = Guerreiro("Aldric", hp_maximo=10, forca=1)
    g.receber_dano(10)
    inimigo = Inimigo("Boss", hp=100, dano=20)
    show = Show([g], inimigo)
    resultado = show.turno_inimigo()
    assert resultado["fim"] == "derrota"


# ── Show.verificar_fim ────────────────────────────────────────────────────────

def test_verificar_fim_retorna_none_quando_jogo_continua():
    g = Guerreiro("Aldric", forca=10)
    inimigo = Inimigo("Boss", hp=100, dano=10)
    show = Show([g], inimigo)
    assert show.verificar_fim() is None


def test_verificar_fim_vitoria_quando_inimigo_morto():
    g = Guerreiro("Aldric", forca=10)
    inimigo = Inimigo("Boss", hp=1, dano=10)
    inimigo.receber_dano(1)
    show = Show([g], inimigo)
    assert show.verificar_fim() == "vitoria"


def test_verificar_fim_derrota_quando_banda_toda_nocauteada():
    g = Guerreiro("Aldric", hp_maximo=10, forca=1)
    g.receber_dano(10)
    inimigo = Inimigo("Boss", hp=100, dano=10)
    show = Show([g], inimigo)
    assert show.verificar_fim() == "derrota"


# ── Polimorfismo ──────────────────────────────────────────────────────────────

def test_polimorfismo_banda_mista_sem_isinstance():
    """Show com subclasses mistas resolve ações sem checar tipo."""
    banda = [
        Guerreiro("G", forca=10),
        Mago("M", inteligencia=10, mana=50),
        Ladrao("L", agilidade=10, chance_critico=0.0),
        Paladino("P", forca=10, fe=20),
    ]
    inimigo = Inimigo("Boss", hp=1000, dano=5)
    show = Show(banda, inimigo)
    for i in range(len(banda)):
        resultado = show.acao_musico(i)
        assert "dano" in resultado
        assert resultado["dano"] > 0


def test_ladrao_critico_mockado():
    """Mock do random para garantir crítico determinístico."""
    with patch("random.random", return_value=0.0):  # 0.0 < 0.3 → sempre crítico
        l = Ladrao("Kael", agilidade=10, chance_critico=0.3)
        inimigo = Inimigo("Boss", hp=1000, dano=5)
        show = Show([l], inimigo)
        resultado = show.acao_musico(0)
        assert resultado["dano"] == 30  # int(10 * 3.0) = 30


# ── Integração com Factory/Singleton ─────────────────────────────────────────

def test_integracao_factory_singleton_banda_e_show():
    g = GerenciadorJogo.get_instancia()
    g.criar_banda([
        {"tipo": "guerreiro", "nome": "Aldric", "forca": 10},
        {"tipo": "mago", "nome": "Selene", "mana": 50, "inteligencia": 10},
    ])
    banda = g.listar_jogadores()
    inimigo = Inimigo("Boss", hp=200, dano=15)
    show = Show(banda, inimigo)
    resultado = show.acao_musico(0)
    assert resultado["dano"] == 15  # guerreiro forca=10 → int(10*1.5) = 15
    assert inimigo.get_hp() == 185


def test_turno_inimigo_com_morto_em_posicao_zero():
    """Show não crasha quando o primeiro da banda está nocauteado."""
    g1 = Guerreiro("Morto", hp_maximo=1, forca=1)
    g1.receber_dano(1)
    g2 = Guerreiro("Vivo", forca=10)
    inimigo = Inimigo("Boss", hp=100, dano=10)
    show = Show([g1, g2], inimigo)
    resultado = show.turno_inimigo()
    assert resultado["alvo"] == "Vivo"
