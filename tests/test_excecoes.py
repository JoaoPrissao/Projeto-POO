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
