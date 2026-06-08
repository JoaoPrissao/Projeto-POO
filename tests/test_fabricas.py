import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pytest
from fabricas import MusicoFactory
from musico import Musico
from Guitarrista import Guitarrista
from Vocalista import Vocalista
from Baterista import Baterista
from Baixista import Baixista
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

def test_criar_guitarrista_retorna_guitarrista():
    j = MusicoFactory.criar("guitarrista", nome="Aldric")
    assert isinstance(j, Guitarrista)


def test_criar_vocalista_retorna_vocalista():
    j = MusicoFactory.criar("vocalista", nome="Selene")
    assert isinstance(j, Vocalista)


def test_criar_baterista_retorna_baterista():
    j = MusicoFactory.criar("baterista", nome="Kael")
    assert isinstance(j, Baterista)


def test_criar_baixista_retorna_baixista():
    j = MusicoFactory.criar("baixista", nome="Arthur")
    assert isinstance(j, Baixista)


def test_criar_repassa_kwargs_ao_construtor():
    j = MusicoFactory.criar("guitarrista", nome="Aldric", forca=42)
    assert j.get_forca() == 42


# ── Tipo desconhecido ─────────────────────────────────────────────

def test_criar_tipo_desconhecido_lanca_excecao():
    with pytest.raises(TipoInvalidoError):
        MusicoFactory.criar("bardo", nome="Lute")


def test_tipo_invalido_mensagem_cita_o_tipo():
    err = TipoInvalidoError("bardo")
    assert "bardo" in str(err)


# ── Extensibilidade via registrar() ───────────────────────────────

def test_registrar_adiciona_tipo_novo():
    class Tecladista(Guitarrista):
        pass

    MusicoFactory.registrar("tecladista", Tecladista)
    j = MusicoFactory.criar("tecladista", nome="Mort")
    assert isinstance(j, Tecladista)


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
