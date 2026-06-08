import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pytest

from jogador import Jogador
from Guerreiro import Guerreiro
from Mago import Mago
from Ladrao import Ladrao
from Paladino import Paladino
from itens import Equipavel, Consumivel
from fabricas import ItemFactory
from persistencia import salvar_jogo, carregar_jogo, listar_saves
from excecoes import SaveNaoEncontradoError, SaveCorrompidoError


# ── Round-trip puro (sem disco) — preserva tipo e atributos ───────

def test_roundtrip_guerreiro_preserva_tipo_e_forca():
    g = Guerreiro("Aldric", forca=17)
    copia = Jogador.from_dict(g.to_dict())
    assert isinstance(copia, Guerreiro)
    assert copia.get_forca() == 17


def test_roundtrip_mago_preserva_mana_e_inteligencia():
    m = Mago("Selene", mana=42, inteligencia=13)
    copia = Jogador.from_dict(m.to_dict())
    assert isinstance(copia, Mago)
    assert copia.get_mana() == 42
    assert copia.get_inteligencia() == 13


def test_roundtrip_ladrao_preserva_agilidade_e_critico():
    l = Ladrao("Kael", agilidade=15, chance_critico=0.5)
    copia = Jogador.from_dict(l.to_dict())
    assert isinstance(copia, Ladrao)
    assert copia.get_agilidade() == 15
    assert copia.get_chance_critico() == 0.5


def test_roundtrip_paladino_preserva_fe_e_forca():
    p = Paladino("Arthur", forca=20, fe=18)
    copia = Jogador.from_dict(p.to_dict())
    assert isinstance(copia, Paladino)
    assert copia.get_forca() == 20
    assert copia.get_fe() == 18


def test_roundtrip_preserva_estado_mutavel():
    g = Guerreiro("Aldric", hp_maximo=100, forca=10)
    g.receber_dano(30)          # hp atual = 70
    g.ganhar_xp(20)
    copia = Jogador.from_dict(g.to_dict())
    assert copia.get_hp() == 70
    assert copia.get_xp() == g.get_xp()
    assert copia.get_nivel() == g.get_nivel()


# ── Inventário sobrevive ao round-trip ────────────────────────────

def test_inventario_sobrevive_roundtrip():
    g = Guerreiro("Aldric")
    g.get_inventario().adicionar(ItemFactory.criar("espada", bonus=5))
    g.get_inventario().adicionar(ItemFactory.criar("pocao_vida"))

    copia = Jogador.from_dict(g.to_dict())
    itens = copia.get_inventario().listar()

    assert len(itens) == 2
    espada = next(i for i in itens if i.nome == "Espada")
    assert isinstance(espada, Equipavel)
    assert espada.bonus == 5
    assert any(isinstance(i, Consumivel) for i in itens)


# ── Save + load em arquivo temporário (tmp_path) ──────────────────

def test_salvar_e_carregar_em_arquivo(tmp_path):
    jogadores = [Guerreiro("Aldric", forca=12), Mago("Selene", mana=30)]
    salvar_jogo(jogadores, "slot1", pasta=str(tmp_path))

    carregados = carregar_jogo("slot1", pasta=str(tmp_path))

    assert len(carregados) == 2
    assert isinstance(carregados[0], Guerreiro)
    assert isinstance(carregados[1], Mago)
    assert carregados[0].get_forca() == 12
    assert carregados[1].get_mana() == 30


def test_carregar_inexistente_lanca_save_nao_encontrado(tmp_path):
    with pytest.raises(SaveNaoEncontradoError):
        carregar_jogo("nao_existe", pasta=str(tmp_path))


def test_carregar_json_corrompido_lanca_save_corrompido(tmp_path):
    (tmp_path / "ruim.json").write_text("{ isto não é json válido ", encoding="utf-8")
    with pytest.raises(SaveCorrompidoError):
        carregar_jogo("ruim", pasta=str(tmp_path))


def test_carregar_schema_incompativel_lanca_save_corrompido(tmp_path):
    # JSON válido, mas sem o discriminador "tipo"
    (tmp_path / "schema.json").write_text('[{"nome": "X"}]', encoding="utf-8")
    with pytest.raises(SaveCorrompidoError):
        carregar_jogo("schema", pasta=str(tmp_path))


def test_listar_saves(tmp_path):
    salvar_jogo([Guerreiro("Aldric")], "slot1", pasta=str(tmp_path))
    salvar_jogo([Mago("Selene")], "slot2", pasta=str(tmp_path))
    slots = {s["slot"] for s in listar_saves(pasta=str(tmp_path))}
    assert slots == {"slot1", "slot2"}
