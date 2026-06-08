import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pytest

from gerenciador import GerenciadorJogo
from Guerreiro import Guerreiro
from Mago import Mago
from excecoes import TipoInvalidoError


# Isola cada teste: descarta a instância única antes e depois,
# pra o estado do Singleton não vazar entre os casos.
@pytest.fixture(autouse=True)
def _reset_singleton():
    GerenciadorJogo.resetar()
    yield
    GerenciadorJogo.resetar()


# ── Identidade do Singleton ───────────────────────────────────────

def test_get_instancia_retorna_sempre_o_mesmo_objeto():
    a = GerenciadorJogo.get_instancia()
    b = GerenciadorJogo.get_instancia()
    assert a is b


def test_construtor_chamado_duas_vezes_retorna_mesma_instancia():
    a = GerenciadorJogo()
    b = GerenciadorJogo()
    assert a is b


def test_reinstanciar_nao_zera_o_estado_existente():
    g = GerenciadorJogo()
    g.adicionar_jogador("guerreiro", nome="Aldric")
    # "reinstanciar" não pode rodar __init__ de novo e apagar a banda
    g2 = GerenciadorJogo()
    assert len(g2.listar_jogadores()) == 1
    assert g2.listar_jogadores()[0].get_nome() == "Aldric"


def test_resetar_descarta_a_instancia_e_cria_uma_limpa():
    a = GerenciadorJogo.get_instancia()
    a.adicionar_jogador("mago", nome="Selene")
    GerenciadorJogo.resetar()
    b = GerenciadorJogo.get_instancia()
    assert a is not b
    assert b.listar_jogadores() == []


# ── Centralização do estado + Factory ─────────────────────────────

def test_adicionar_jogador_usa_a_factory():
    g = GerenciadorJogo.get_instancia()
    jogador = g.adicionar_jogador("guerreiro", nome="Aldric", forca=17)
    assert isinstance(jogador, Guerreiro)
    assert jogador.get_forca() == 17
    assert g.listar_jogadores() == [jogador]


def test_adicionar_jogador_tipo_invalido_propaga_erro():
    g = GerenciadorJogo.get_instancia()
    with pytest.raises(TipoInvalidoError):
        g.adicionar_jogador("dragao", nome="X")


def test_criar_banda_a_partir_de_composicao():
    g = GerenciadorJogo.get_instancia()
    g.criar_banda([
        {"tipo": "guerreiro", "nome": "Aldric", "forca": 12},
        {"tipo": "mago", "nome": "Selene", "mana": 30},
    ])
    banda = g.listar_jogadores()
    assert len(banda) == 2
    assert isinstance(banda[0], Guerreiro)
    assert isinstance(banda[1], Mago)
    assert banda[0].get_forca() == 12
    assert banda[1].get_mana() == 30


def test_criar_banda_substitui_a_banda_anterior():
    g = GerenciadorJogo.get_instancia()
    g.adicionar_jogador("guerreiro", nome="Velho")
    g.criar_banda([{"tipo": "mago", "nome": "Novo"}])
    banda = g.listar_jogadores()
    assert len(banda) == 1
    assert banda[0].get_nome() == "Novo"


def test_obter_jogador_por_indice():
    g = GerenciadorJogo.get_instancia()
    g.adicionar_jogador("guerreiro", nome="Aldric")
    g.adicionar_jogador("mago", nome="Selene")
    assert g.obter_jogador(0).get_nome() == "Aldric"
    assert g.obter_jogador(1).get_nome() == "Selene"


# ── Save/load delegando pra persistência ──────────────────────────

def test_salvar_e_carregar_faz_round_trip_da_banda(tmp_path):
    g = GerenciadorJogo.get_instancia()
    g.adicionar_jogador("guerreiro", nome="Aldric", forca=15)
    g.adicionar_jogador("mago", nome="Selene", mana=42)
    g.salvar("slot1", pasta=str(tmp_path))

    GerenciadorJogo.resetar()
    g2 = GerenciadorJogo.get_instancia()
    g2.carregar("slot1", pasta=str(tmp_path))

    banda = g2.listar_jogadores()
    assert len(banda) == 2
    assert isinstance(banda[0], Guerreiro)
    assert banda[0].get_forca() == 15
    assert isinstance(banda[1], Mago)
    assert banda[1].get_mana() == 42


# ── Placeholder de fase do jogo (estado centralizado) ─────────────

def test_fase_inicial_e_alteracao():
    g = GerenciadorJogo.get_instancia()
    assert g.get_fase() == 1
    g.set_fase(2)
    assert g.get_fase() == 2
