import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pytest

from musico import Musico
from Guitarrista import Guitarrista
from Vocalista import Vocalista
from Baterista import Baterista
from Baixista import Baixista
from itens import Equipavel, Consumivel
from fabricas import ItemFactory
from persistencia import salvar_jogo, carregar_jogo, listar_saves
from excecoes import SaveNaoEncontradoError, SaveCorrompidoError


# ── Round-trip puro (sem disco) — preserva tipo e atributos ───────

def test_roundtrip_guitarrista_preserva_tipo_e_forca():
    g = Guitarrista("Aldric", forca=17)
    copia = Musico.from_dict(g.to_dict())
    assert isinstance(copia, Guitarrista)
    assert copia.get_forca() == 17


def test_roundtrip_vocalista_preserva_folego_e_inteligencia():
    m = Vocalista("Selene", folego=42, inteligencia=13)
    copia = Musico.from_dict(m.to_dict())
    assert isinstance(copia, Vocalista)
    assert copia.get_folego() == 42
    assert copia.get_inteligencia() == 13


def test_roundtrip_baterista_preserva_agilidade_e_critico():
    l = Baterista("Kael", agilidade=15, chance_critico=0.5)
    copia = Musico.from_dict(l.to_dict())
    assert isinstance(copia, Baterista)
    assert copia.get_agilidade() == 15
    assert copia.get_chance_critico() == 0.5


def test_roundtrip_baixista_preserva_fe_e_forca():
    p = Baixista("Arthur", forca=20, fe=18)
    copia = Musico.from_dict(p.to_dict())
    assert isinstance(copia, Baixista)
    assert copia.get_forca() == 20
    assert copia.get_fe() == 18


def test_roundtrip_preserva_estado_mutavel():
    g = Guitarrista("Aldric", hp_maximo=100, forca=10)
    g.receber_dano(30)          # hp atual = 70
    g.ganhar_xp(20)
    copia = Musico.from_dict(g.to_dict())
    assert copia.get_hp() == 70
    assert copia.get_xp() == g.get_xp()
    assert copia.get_nivel() == g.get_nivel()


# ── Inventário sobrevive ao round-trip ────────────────────────────

def test_inventario_sobrevive_roundtrip():
    g = Guitarrista("Aldric")
    g.get_inventario().adicionar(ItemFactory.criar("pedal", bonus=5))
    g.get_inventario().adicionar(ItemFactory.criar("energetico"))

    copia = Musico.from_dict(g.to_dict())
    itens = copia.get_inventario().listar()

    assert len(itens) == 2
    pedal = next(i for i in itens if i.nome == "Pedal de Efeito")
    assert isinstance(pedal, Equipavel)
    assert pedal.bonus == 5
    assert any(isinstance(i, Consumivel) for i in itens)


# ── Save + load em arquivo temporário (tmp_path) ──────────────────

def test_salvar_e_carregar_em_arquivo(tmp_path):
    musicos = [Guitarrista("Aldric", forca=12), Vocalista("Selene", folego=30)]
    salvar_jogo(musicos, "slot1", pasta=str(tmp_path))

    carregados = carregar_jogo("slot1", pasta=str(tmp_path))

    assert len(carregados) == 2
    assert isinstance(carregados[0], Guitarrista)
    assert isinstance(carregados[1], Vocalista)
    assert carregados[0].get_forca() == 12
    assert carregados[1].get_folego() == 30


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
    salvar_jogo([Guitarrista("Aldric")], "slot1", pasta=str(tmp_path))
    salvar_jogo([Vocalista("Selene")], "slot2", pasta=str(tmp_path))
    slots = {s["slot"] for s in listar_saves(pasta=str(tmp_path))}
    assert slots == {"slot1", "slot2"}
