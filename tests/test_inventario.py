import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pytest

from itens import Item, Equipavel, Consumivel
from inventario import Inventario
from fabricas import ItemFactory
from Guerreiro import Guerreiro
from Mago import Mago
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
    espada = Item("Espada")
    inv.adicionar(espada)
    removido = inv.remover("Espada")
    assert removido is espada
    assert len(inv) == 0


def test_remover_item_inexistente_lanca_excecao():
    inv = Inventario(capacidade=2)
    with pytest.raises(ItemNaoEncontradoError):
        inv.remover("Inexistente")


# ── Inventario: usar consumível ───────────────────────────────────

def test_usar_pocao_de_vida_cura_o_alvo():
    inv = Inventario(capacidade=2)
    pocao = ItemFactory.criar("pocao_vida")   # cura 50
    inv.adicionar(pocao)
    alvo = Guerreiro("Aldric", hp_maximo=100)
    alvo.receber_dano(50)                      # hp = 50
    inv.usar(pocao.nome, alvo)
    assert alvo.get_hp() == 100


def test_consumivel_e_removido_apos_uso():
    inv = Inventario(capacidade=2)
    pocao = ItemFactory.criar("pocao_vida")
    inv.adicionar(pocao)
    alvo = Guerreiro("Aldric", hp_maximo=100)
    alvo.receber_dano(10)
    inv.usar(pocao.nome, alvo)
    assert len(inv) == 0


def test_usar_pocao_de_mana_restaura_mana_do_mago():
    inv = Inventario(capacidade=2)
    pocao = ItemFactory.criar("pocao_mana")    # restaura 30
    inv.adicionar(pocao)
    mago = Mago("Selene", mana=0)
    inv.usar(pocao.nome, mago)
    assert mago.get_mana() == 30


def test_usar_item_inexistente_lanca_excecao():
    inv = Inventario(capacidade=2)
    alvo = Guerreiro("Aldric")
    with pytest.raises(ItemNaoEncontradoError):
        inv.usar("Inexistente", alvo)


# ── Inventario: itens incompatíveis ───────────────────────────────

def test_mago_equipando_espada_lanca_incompativel():
    inv = Inventario(capacidade=2)
    espada = ItemFactory.criar("espada")       # restrita a Guerreiro/Paladino
    inv.adicionar(espada)
    mago = Mago("Selene")
    with pytest.raises(ItemIncompativelError):
        inv.usar(espada.nome, mago)


def test_item_incompativel_nao_e_consumido():
    inv = Inventario(capacidade=2)
    espada = ItemFactory.criar("espada")
    inv.adicionar(espada)
    mago = Mago("Selene")
    with pytest.raises(ItemIncompativelError):
        inv.usar(espada.nome, mago)
    assert len(inv) == 1                        # continua no inventário


def test_guerreiro_equipa_espada_e_ganha_forca():
    inv = Inventario(capacidade=2)
    espada = ItemFactory.criar("espada", bonus=5)
    inv.adicionar(espada)
    guerreiro = Guerreiro("Aldric", forca=10)
    inv.usar(espada.nome, guerreiro)
    assert guerreiro.get_forca() == 15


# ── ItemFactory ───────────────────────────────────────────────────

def test_factory_cria_consumiveis_e_equipaveis():
    assert isinstance(ItemFactory.criar("pocao_vida"), Consumivel)
    assert isinstance(ItemFactory.criar("pocao_mana"), Consumivel)
    assert isinstance(ItemFactory.criar("espada"), Equipavel)


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
    espada = Equipavel("Espada", "Afiada.", atributo="forca", bonus=7,
                       classes_permitidas=("Guerreiro",))
    copia = Equipavel.from_dict(espada.to_dict())
    assert copia.nome == "Espada"
    assert copia.atributo == "forca"
    assert copia.bonus == 7


def test_consumivel_round_trip_dict():
    pocao = Consumivel("Poção", "Cura.", efeito="cura", valor=40)
    copia = Consumivel.from_dict(pocao.to_dict())
    assert copia.nome == "Poção"
    assert copia.efeito == "cura"
    assert copia.valor == 40
