import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pytest
from excecoes import JogoError, JogadorMortoError, ManaInsuficienteError, AtaqueInvalidoError


def test_jogo_error_e_exception():
    assert issubclass(JogoError, Exception)


def test_jogador_morto_error_e_jogo_error():
    assert issubclass(JogadorMortoError, JogoError)


def test_mana_insuficiente_error_e_jogo_error():
    assert issubclass(ManaInsuficienteError, JogoError)


def test_ataque_invalido_error_e_jogo_error():
    assert issubclass(AtaqueInvalidoError, JogoError)


def test_jogador_morto_mensagem():
    err = JogadorMortoError("Aldric")
    assert "Aldric" in str(err)
    assert "morto" in str(err)


def test_mana_insuficiente_mensagem():
    err = ManaInsuficienteError("Selene", mana_atual=5, custo=10)
    assert "Selene" in str(err)
    assert "5" in str(err)
    assert "10" in str(err)


def test_ataque_invalido_mensagem():
    err = AtaqueInvalidoError(-5)
    assert "-5" in str(err)


from Guerreiro import Guerreiro


def test_receber_dano_invalido_lanca_excecao():
    g = Guerreiro("Teste")
    with pytest.raises(AtaqueInvalidoError):
        g.receber_dano(0)


def test_receber_dano_negativo_lanca_excecao():
    g = Guerreiro("Teste")
    with pytest.raises(AtaqueInvalidoError):
        g.receber_dano(-10)


def test_atacar_jogador_morto_lanca_excecao():
    alvo = Guerreiro("Alvo", hp_maximo=1)
    alvo.receber_dano(1)
    with pytest.raises(JogadorMortoError):
        alvo.receber_dano(5)


def test_set_nome_vazio_lanca_excecao():
    g = Guerreiro("Teste")
    with pytest.raises(ValueError):
        g.set_nome("   ")


def test_set_nivel_invalido_lanca_excecao():
    g = Guerreiro("Teste")
    with pytest.raises(ValueError):
        g.set_nivel(0)


def test_set_hp_maximo_invalido_lanca_excecao():
    g = Guerreiro("Teste")
    with pytest.raises(ValueError):
        g.set_hp_maximo(0)


from Mago import Mago, CUSTO_MANA


def test_mago_ataca_com_mana_suficiente():
    mago = Mago("Selene", mana=50, inteligencia=10)
    alvo = Guerreiro("Alvo", hp_maximo=500)
    mago.atacar(alvo)
    assert alvo.get_hp() < 500


def test_mago_sem_mana_lanca_excecao():
    mago = Mago("Selene", mana=0, inteligencia=10)
    alvo = Guerreiro("Alvo", hp_maximo=500)
    with pytest.raises(ManaInsuficienteError):
        mago.atacar(alvo)


from Paladino import Paladino


def test_paladino_e_subclasse_de_guerreiro():
    from Guerreiro import Guerreiro
    assert issubclass(Paladino, Guerreiro)


def test_paladino_ataca_com_fe_e_se_cura():
    paladino = Paladino("Arthur", hp_maximo=150, forca=20, fe=20)
    alvo = Guerreiro("Alvo", hp_maximo=500)
    paladino.receber_dano(30)
    hp_apos_dano = paladino.get_hp()
    paladino.atacar(alvo)
    assert paladino.get_hp() > hp_apos_dano


def test_paladino_ataca_sem_fe_nao_se_cura():
    paladino = Paladino("Arthur", hp_maximo=150, forca=20, fe=0)
    alvo = Guerreiro("Alvo", hp_maximo=500)
    paladino.receber_dano(30)
    hp_apos_dano = paladino.get_hp()
    paladino.atacar(alvo)
    assert paladino.get_hp() == hp_apos_dano


def test_paladino_exibir_status_inclui_fe():
    import io, sys
    paladino = Paladino("Arthur", fe=15)
    output = io.StringIO()
    sys.stdout = output
    paladino.exibir_status()
    sys.stdout = sys.__stdout__
    assert "15" in output.getvalue()
