import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pytest
from fabricas import JogadorFactory
from jogador import Jogador
from Guerreiro import Guerreiro
from Mago import Mago
from Ladrao import Ladrao
from Paladino import Paladino
from excecoes import (
    JogoError,
    TipoInvalidoError,
    InventarioError,
    InventarioCheioError,
    ItemNaoEncontradoError,
    ItemIncompativelError,
    PersistenciaError,
    SaveNaoEncontradoError,
    SaveCorrompidoError,
)


# ── Factory cria a subclasse certa ────────────────────────────────

def test_criar_guerreiro_retorna_guerreiro():
    j = JogadorFactory.criar("guerreiro", nome="Aldric")
    assert isinstance(j, Guerreiro)


def test_criar_mago_retorna_mago():
    j = JogadorFactory.criar("mago", nome="Selene")
    assert isinstance(j, Mago)


def test_criar_ladrao_retorna_ladrao():
    j = JogadorFactory.criar("ladrao", nome="Kael")
    assert isinstance(j, Ladrao)


def test_criar_paladino_retorna_paladino():
    j = JogadorFactory.criar("paladino", nome="Arthur")
    assert isinstance(j, Paladino)


def test_criar_repassa_kwargs_ao_construtor():
    j = JogadorFactory.criar("guerreiro", nome="Aldric", forca=42)
    assert j.get_forca() == 42


# ── Tipo desconhecido ─────────────────────────────────────────────

def test_criar_tipo_desconhecido_lanca_excecao():
    with pytest.raises(TipoInvalidoError):
        JogadorFactory.criar("bardo", nome="Lute")


def test_tipo_invalido_mensagem_cita_o_tipo():
    err = TipoInvalidoError("bardo")
    assert "bardo" in str(err)


# ── Extensibilidade via registrar() ───────────────────────────────

def test_registrar_adiciona_tipo_novo():
    class Necromante(Guerreiro):
        pass

    JogadorFactory.registrar("necromante", Necromante)
    j = JogadorFactory.criar("necromante", nome="Mort")
    assert isinstance(j, Necromante)


# ── Exceções novas são subclasses de JogoError ────────────────────

def test_excecoes_novas_sao_jogo_error():
    novas = [
        TipoInvalidoError,
        InventarioError,
        InventarioCheioError,
        ItemNaoEncontradoError,
        ItemIncompativelError,
        PersistenciaError,
        SaveNaoEncontradoError,
        SaveCorrompidoError,
    ]
    for exc in novas:
        assert issubclass(exc, JogoError)


def test_hierarquia_inventario():
    for exc in (InventarioCheioError, ItemNaoEncontradoError, ItemIncompativelError):
        assert issubclass(exc, InventarioError)


def test_hierarquia_persistencia():
    for exc in (SaveNaoEncontradoError, SaveCorrompidoError):
        assert issubclass(exc, PersistenciaError)
