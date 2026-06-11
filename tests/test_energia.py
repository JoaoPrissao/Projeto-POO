"""F3.8 — Energia + cansaço + movesets leve/médio/pesado.

Energia é o recurso UNIFICADO de golpes (decisão do João): vive na classe base
`Musico` (0..ENERGIA_MAXIMA), os golpes do moveset consomem (`custo`) e o golpe
pesado deixa o músico CANSADO — ele perde a próxima vez da banda (descansa
quando o vilão age). O fôlego do Vocalista vira essa energia (o kwarg `folego`
é aceito como alias de compat para saves/payloads antigos). Cerveja restaura
energia de qualquer músico. A loja sai da van e vira um ponto no mapa.
"""
import sys, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'bridge'))

import pytest

from musico import Musico
from Guitarrista import Guitarrista
from Vocalista import Vocalista
from Baterista import Baterista
from Baixista import Baixista
from fabricas import ItemFactory
from moves import MOVES_BASE, MOVES_DE_ITEM, moves_de, get_move
from show import Show, Empresario, REGEN_ENERGIA_POR_RODADA
from excecoes import EnergiaInsuficienteError, MusicoCansadoError
from campanha import Campanha
from gerenciador import GerenciadorJogo
from api import API


@pytest.fixture(autouse=True)
def _reset_singleton():
    GerenciadorJogo.resetar()
    yield
    GerenciadorJogo.resetar()


# ── Musico: energia na classe base ───────────────────────────────────────────

def test_energia_comeca_no_maximo():
    g = Guitarrista("Aldric", forca=10)
    assert g.get_energia() == Musico.ENERGIA_MAXIMA


def test_gastar_e_recuperar_energia_com_teto():
    g = Guitarrista("Aldric", forca=10)
    g.gastar_energia(30)
    assert g.get_energia() == Musico.ENERGIA_MAXIMA - 30
    g.recuperar_energia(9999)                 # capa no máximo
    assert g.get_energia() == Musico.ENERGIA_MAXIMA


def test_gastar_energia_sem_saldo_levanta_erro():
    g = Guitarrista("Aldric", forca=10)
    g.gastar_energia(95)
    with pytest.raises(EnergiaInsuficienteError):
        g.gastar_energia(10)
    assert g.get_energia() == Musico.ENERGIA_MAXIMA - 95   # nada debitado


def test_cansar_e_descansar():
    b = Baterista("Bruta", agilidade=10)
    assert b.esta_cansado() is False
    b.cansar()
    assert b.esta_cansado() is True
    b.descansar()
    assert b.esta_cansado() is False


def test_round_trip_preserva_energia_e_cansaco():
    g = Guitarrista("Aldric", forca=10)
    g.gastar_energia(40)
    g.cansar()
    clone = Musico.from_dict(g.to_dict())
    assert clone.get_energia() == g.get_energia()
    assert clone.esta_cansado() is True


# ── Vocalista: fôlego unificado em energia ────────────────────────────────────

def test_vocalista_folego_vira_alias_de_energia():
    v = Vocalista("Selene", folego=50, inteligencia=10)
    assert v.get_energia() == 50              # alias de compat (saves antigos)


def test_vocalista_atacar_nao_gasta_mais_energia():
    # O custo agora é do GOLPE (moves), não do atacar() — dano determinístico.
    v = Vocalista("Selene", folego=50, inteligencia=10)
    assert v.atacar() == 20                   # int(10 * 2.0)
    assert v.get_energia() == 50              # intacta


def test_cerveja_restaura_energia_de_qualquer_musico():
    g = Guitarrista("Aldric", forca=10)
    g.gastar_energia(60)
    cerveja = ItemFactory.criar("cerveja")    # efeito folego/energia, valor 30
    cerveja.usar(g)
    assert g.get_energia() == Musico.ENERGIA_MAXIMA - 60 + 30


# ── Moves: leve / médio / pesado ──────────────────────────────────────────────

def test_todo_tipo_tem_tres_golpes_leve_medio_pesado():
    for tipo, moves in MOVES_BASE.items():
        assert len(moves) == 3, tipo
        leve, medio, pesado = moves
        assert leve["mult"] < medio["mult"] < pesado["mult"]
        assert leve["custo"] < medio["custo"] < pesado["custo"]
        assert leve["cansa"] is False and medio["cansa"] is False
        assert pesado["cansa"] is True        # só o pesado cansa
        assert leve["chart"] == "facil"       # combo mais fácil


def test_moves_de_item_sao_pesados():
    for move in MOVES_DE_ITEM.values():
        assert move["cansa"] is True
        assert move["custo"] >= 25


def test_item_equipado_empurra_o_golpe_mais_fraco():
    g = Guitarrista("Aldric", forca=10)
    assert len(moves_de(g)) == 3
    g.equipar(ItemFactory.criar("pedal"))     # desbloqueia Solo Distorcido
    moves = moves_de(g)
    assert len(moves) == 3                    # cap mantido
    assert moves[-1]["id"] == "solo_distorcido"
    assert all(m["id"] != "palhetada" for m in moves)   # leve saiu


# ── Show: custo, cansaço e rodada ─────────────────────────────────────────────

def _show_simples():
    banda = [Guitarrista("Aldric", forca=10), Baixista("Dov", forca=10)]
    boss = Empresario("Boss", hp=10_000, dano=10)
    return Show(banda, boss), banda, boss


def test_acao_musico_gasta_energia_do_golpe():
    show, banda, _ = _show_simples()
    antes = banda[0].get_energia()
    show.acao_musico(0, custo_energia=12)
    assert banda[0].get_energia() == antes - 12


def test_golpe_pesado_deixa_cansado_e_bloqueia_o_proximo():
    show, banda, _ = _show_simples()
    show.acao_musico(0, custo_energia=25, cansa=True)
    assert banda[0].esta_cansado() is True
    with pytest.raises(MusicoCansadoError):
        show.acao_musico(0)                   # cansado não ataca
    show.acao_musico(1)                       # o resto da banda pode


def test_sem_energia_o_golpe_nem_sai():
    show, banda, boss = _show_simples()
    banda[0].gastar_energia(95)
    hp_antes = boss.get_hp()
    with pytest.raises(EnergiaInsuficienteError):
        show.acao_musico(0, custo_energia=25)
    assert boss.get_hp() == hp_antes          # nenhum dano aplicado


def test_turno_inimigo_descansa_e_regenera_a_banda():
    show, banda, _ = _show_simples()
    show.acao_musico(0, custo_energia=25, cansa=True)
    energia_apos_golpe = banda[0].get_energia()
    show.turno_inimigo()                      # a rodada vira
    assert banda[0].esta_cansado() is False   # cansaço dura 1 vez do vilão
    assert banda[0].get_energia() == min(
        energia_apos_golpe + REGEN_ENERGIA_POR_RODADA, Musico.ENERGIA_MAXIMA)


# ── Ponte: executar_acao com custo/cansaço ────────────────────────────────────

def _api_com_banda():
    api = API()
    api.criar_banda([
        {"tipo": "guitarrista", "nome": "Aldric", "forca": 10},
        {"tipo": "vocalista", "nome": "Selene", "folego": 100, "inteligencia": 12},
    ])
    return api


def test_executar_acao_com_move_pesado_cansa_no_dto():
    api = _api_com_banda()
    pesado = MOVES_BASE["guitarrista"][2]
    res = api.executar_acao({"indice": 0, "move_id": pesado["id"]})
    assert res["ok"] is True
    m0 = res["estado"]["banda"][0]
    assert m0["cansado"] is True
    assert m0["energia"] == m0["energia_maxima"] - pesado["custo"]


def test_executar_acao_cansado_vira_erro_dto():
    api = _api_com_banda()
    pesado = MOVES_BASE["guitarrista"][2]
    api.executar_acao({"indice": 0, "move_id": pesado["id"]})
    res = api.executar_acao({"indice": 0, "move_id": MOVES_BASE["guitarrista"][0]["id"]})
    assert res["ok"] is False
    assert res["erro"]["tipo"] == "MusicoCansadoError"


def test_turno_inimigo_da_ponte_vira_a_rodada():
    api = _api_com_banda()
    pesado = MOVES_BASE["guitarrista"][2]
    api.executar_acao({"indice": 0, "move_id": pesado["id"]})
    res = api.turno_inimigo()
    m0 = res["estado"]["banda"][0]
    assert m0["cansado"] is False             # descansou na vez do vilão


def test_dto_do_musico_traz_energia_e_moves_com_custo():
    api = _api_com_banda()
    m0 = api.obter_estado()["banda"][0]
    assert m0["energia"] == m0["energia_maxima"]
    assert m0["cansado"] is False
    assert all("custo" in mv and "cansa" in mv for mv in m0["moves"])


def test_regenerar_banda_tambem_restaura_energia_e_descansa():
    api = _api_com_banda()
    banda = api._gerenciador.listar_jogadores()
    banda[0].gastar_energia(50)
    banda[0].cansar()
    api.regenerar_banda(5)
    assert banda[0].get_energia() > banda[0].ENERGIA_MAXIMA - 50
    assert banda[0].esta_cansado() is False   # na estrada todo mundo descansa


# ── Campanha: loja como ponto do mapa ─────────────────────────────────────────

def test_campanha_tem_loja_com_posicao_no_mapa():
    camp = Campanha.padrao()
    loja = camp.get_loja()
    assert isinstance(loja["x"], (int, float)) and loja["x"] > 0
    clone = Campanha.from_dict(camp.to_dict())
    assert clone.get_loja() == loja


def test_campanha_dto_da_ponte_traz_loja():
    api = _api_com_banda()
    camp = api.obter_campanha()
    assert "loja" in camp and camp["loja"]["x"] > 0
