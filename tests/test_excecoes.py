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
