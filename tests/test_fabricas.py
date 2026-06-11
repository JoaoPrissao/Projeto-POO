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


# ── MAP-02: Itens de NPC no ItemFactory (Phase 1) ────────────────────────────

from fabricas import ItemFactory
from itens import Item


def test_item_factory_npc1_cria_item_valido():
    """ItemFactory deve criar item para o tipo do NPC 1 (bandana_sortuda) com nome nao vazio."""
    item = ItemFactory.criar("bandana_sortuda")
    assert isinstance(item, Item)
    assert len(item.nome) > 0


def test_item_factory_npc2_cria_item_valido():
    """ItemFactory deve criar item para o tipo do NPC 2 (palheta_de_ouro) com nome nao vazio."""
    item = ItemFactory.criar("palheta_de_ouro")
    assert isinstance(item, Item)
    assert len(item.nome) > 0


def test_item_factory_npc3_cria_item_valido():
    """ItemFactory deve criar item para o tipo do NPC 3 (vinil_raro) com nome nao vazio."""
    item = ItemFactory.criar("vinil_raro")
    assert isinstance(item, Item)
    assert len(item.nome) > 0


# ── MAP-03: Itens únicos de baú no ItemFactory (Phase 1) ─────────────────────

def test_item_factory_bau1_cria_item_valido():
    """ItemFactory deve criar item para o tipo do Baú 1 (jaqueta_lendaria) com nome nao vazio."""
    item = ItemFactory.criar("jaqueta_lendaria")
    assert isinstance(item, Item)
    assert len(item.nome) > 0


def test_item_factory_bau2_cria_item_valido():
    """ItemFactory deve criar item para o tipo do Baú 2 (capa_de_lp) com nome nao vazio."""
    item = ItemFactory.criar("capa_de_lp")
    assert isinstance(item, Item)
    assert len(item.nome) > 0
