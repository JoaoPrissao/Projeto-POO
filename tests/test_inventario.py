import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pytest

from itens import Item, Equipavel, Consumivel
from inventario import Inventario
from fabricas import ItemFactory
from Guitarrista import Guitarrista
from Vocalista import Vocalista
from excecoes import (
    TipoInvalidoError,
    InventarioCheioError,
    ItemNaoEncontradoError,
    ItemIncompativelError,
)


# ── Inventario: capacidade ────────────────────────────────────────

def test_adicionar_ate_a_capacidade():
    inv = Inventario(capacidade=2)
    inv.adicionar(Item("Pedra"))
    inv.adicionar(Item("Pena"))
    assert len(inv) == 2


def test_adicionar_alem_da_capacidade_lanca_excecao():
    inv = Inventario(capacidade=1)
    inv.adicionar(Item("Pedra"))
    with pytest.raises(InventarioCheioError):
        inv.adicionar(Item("Pena"))


# ── Inventario: remover ───────────────────────────────────────────

def test_remover_retorna_o_item_e_tira_do_inventario():
    inv = Inventario(capacidade=2)
    pedal = Item("Pedal de Efeito")
    inv.adicionar(pedal)
    removido = inv.remover("Pedal de Efeito")
    assert removido is pedal
    assert len(inv) == 0


def test_remover_item_inexistente_lanca_excecao():
    inv = Inventario(capacidade=2)
    with pytest.raises(ItemNaoEncontradoError):
        inv.remover("Inexistente")


# ── Inventario: usar consumível ───────────────────────────────────

def test_usar_energetico_cura_o_alvo():
    inv = Inventario(capacidade=2)
    energetico = ItemFactory.criar("energetico")   # cura 50
    inv.adicionar(energetico)
    alvo = Guitarrista("Aldric", hp_maximo=100)
    alvo.receber_dano(50)                           # hp = 50
    inv.usar(energetico.nome, alvo)
    assert alvo.get_hp() == 100


def test_consumivel_e_removido_apos_uso():
    inv = Inventario(capacidade=2)
    energetico = ItemFactory.criar("energetico")
    inv.adicionar(energetico)
    alvo = Guitarrista("Aldric", hp_maximo=100)
    alvo.receber_dano(10)
    inv.usar(energetico.nome, alvo)
    assert len(inv) == 0


def test_usar_cerveja_restaura_folego_do_vocalista():
    inv = Inventario(capacidade=2)
    cerveja = ItemFactory.criar("cerveja")    # restaura 30
    inv.adicionar(cerveja)
    vocalista = Vocalista("Selene", folego=0)
    inv.usar(cerveja.nome, vocalista)
    assert vocalista.get_folego() == 30


def test_usar_item_inexistente_lanca_excecao():
    inv = Inventario(capacidade=2)
    alvo = Guitarrista("Aldric")
    with pytest.raises(ItemNaoEncontradoError):
        inv.usar("Inexistente", alvo)


# ── Inventario: itens incompatíveis ───────────────────────────────

def test_vocalista_equipando_pedal_lanca_incompativel():
    inv = Inventario(capacidade=2)
    pedal = ItemFactory.criar("pedal")       # restrito a Guitarrista/Baixista
    inv.adicionar(pedal)
    vocalista = Vocalista("Selene")
    with pytest.raises(ItemIncompativelError):
        inv.usar(pedal.nome, vocalista)


def test_item_incompativel_nao_e_consumido():
    inv = Inventario(capacidade=2)
    pedal = ItemFactory.criar("pedal")
    inv.adicionar(pedal)
    vocalista = Vocalista("Selene")
    with pytest.raises(ItemIncompativelError):
        inv.usar(pedal.nome, vocalista)
    assert len(inv) == 1                        # continua no inventário


def test_guitarrista_equipa_pedal_e_ganha_forca():
    inv = Inventario(capacidade=2)
    pedal = ItemFactory.criar("pedal", bonus=5)
    inv.adicionar(pedal)
    guitarrista = Guitarrista("Aldric", forca=10)
    inv.usar(pedal.nome, guitarrista)
    assert guitarrista.get_forca() == 15


# ── ItemFactory ───────────────────────────────────────────────────

def test_factory_cria_consumiveis_e_equipaveis():
    assert isinstance(ItemFactory.criar("energetico"), Consumivel)
    assert isinstance(ItemFactory.criar("cerveja"), Consumivel)
    assert isinstance(ItemFactory.criar("pedal"), Equipavel)


def test_factory_tipo_desconhecido_lanca_excecao():
    with pytest.raises(TipoInvalidoError):
        ItemFactory.criar("bomba_nuclear")


def test_factory_registrar_adiciona_item_novo():
    ItemFactory.registrar(
        "amuleto",
        lambda **kw: Item(kw.get("nome", "Amuleto"), "Brilha."),
    )
    item = ItemFactory.criar("amuleto")
    assert isinstance(item, Item)
    assert item.nome == "Amuleto"


# ── Persistência (preparação Tarefa 3) ────────────────────────────

def test_equipavel_round_trip_dict():
    pedal = Equipavel("Pedal", "Afiado.", atributo="forca", bonus=7,
                      classes_permitidas=("Guitarrista",))
    copia = Equipavel.from_dict(pedal.to_dict())
    assert copia.nome == "Pedal"
    assert copia.atributo == "forca"
    assert copia.bonus == 7


def test_consumivel_round_trip_dict():
    energetico = Consumivel("Energético", "Cura.", efeito="cura", valor=40)
    copia = Consumivel.from_dict(energetico.to_dict())
    assert copia.nome == "Energético"
    assert copia.efeito == "cura"
    assert copia.valor == 40
