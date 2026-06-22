"""Harness de integração — campanha autoritativa + ponte overworld → batalha (F3.3).

A campanha agora vive no backend (GerenciadorJogo). O front lê dela:
`obter_campanha` (venues/itens/posição), entra numa venue por id
(`entrar_no_show(venue_id)` arma a capanga definida na campanha), coleta item
por id (`coletar_item({id})`), marca progresso (`concluir_venue`,
`registrar_posicao`) — e tudo isso sobrevive a save/load.
"""
import sys, os, json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'bridge'))

import pytest

from api import API
from gerenciador import GerenciadorJogo


@pytest.fixture(autouse=True)
def _reset_singleton():
    GerenciadorJogo.resetar()
    yield
    GerenciadorJogo.resetar()


COMPOSICAO = [
    {"tipo": "guitarrista", "nome": "Aldric", "forca": 14, "ego": 0},
    {"tipo": "baixista",    "nome": "Paul",   "forca": 12, "fe": 20},
]
RITMO = {"acertos": 9, "total_notas": 10, "combo_max": 6}


def _api_com_banda():
    api = API()
    api.criar_banda(COMPOSICAO)
    return api


def _serializavel(dto):
    json.dumps(dto)  # levanta TypeError se algo não-JSON cruzar a ponte
    return dto


def _primeira_venue(api):
    return api.obter_campanha()["venues"][0]


def _primeiro_item(api):
    return api.obter_campanha()["itens"][0]


# ── obter_campanha ────────────────────────────────────────────────────────────

def test_obter_campanha_traz_venues_itens_e_posicao():
    api = _api_com_banda()
    camp = _serializavel(api.obter_campanha())
    assert len(camp["venues"]) >= 3
    assert len(camp["itens"]) >= 2
    assert "posicao" in camp
    assert camp["completa"] is False


# ── entrar_no_show (por id) ───────────────────────────────────────────────────

def test_entrar_no_show_por_id_arma_a_capanga_da_venue():
    api = _api_com_banda()
    venue = _primeira_venue(api)
    estado = _serializavel(api.entrar_no_show(venue["id"]))
    assert estado["boss"]["nome"] == venue["capanga"]["nome"]
    assert estado["boss"]["hp"] == venue["capanga"]["hp"]
    assert estado["turno"] == "banda"
    assert estado["fim_de_jogo"] is False


def test_entrar_no_show_id_invalido_vira_erro_dto():
    api = _api_com_banda()
    res = api.entrar_no_show("fantasma")
    assert res["ok"] is False


def test_entrar_no_show_permite_atacar_a_capanga():
    api = _api_com_banda()
    venue = _primeira_venue(api)
    hp0 = venue["capanga"]["hp"]
    api.entrar_no_show(venue["id"])
    res = api.executar_acao({"indice": 0, "ritmo": RITMO})
    assert res["ok"] is True
    assert res["estado"]["boss"]["hp"] < hp0


# ── concluir_venue ────────────────────────────────────────────────────────────

def test_concluir_venue_marca_na_campanha():
    api = _api_com_banda()
    venue = _primeira_venue(api)
    res = _serializavel(api.concluir_venue(venue["id"]))
    marcada = next(v for v in res["campanha"]["venues"] if v["id"] == venue["id"])
    assert marcada["concluida"] is True


def test_concluir_venue_invalida_vira_erro_dto():
    api = _api_com_banda()
    res = api.concluir_venue("fantasma")
    assert res["ok"] is False


# ── coletar_item (por id) ─────────────────────────────────────────────────────

def test_coletar_item_por_id_adiciona_e_marca():
    """Item sem classes_permitidas com 2 músicos elegíveis → escolha_necessaria=True.
    Após re-chamada com indice explícito, marca como coletado."""
    api = _api_com_banda()
    item = _primeiro_item(api)

    # Primeira chamada sem indice: 2 elegíveis → escolha_necessaria (não marca ainda).
    res = _serializavel(api.coletar_item({"id": item["id"]}))
    assert res["ok"] is True
    assert res["escolha_necessaria"] is True
    nao_marcado = next(i for i in api.obter_campanha()["itens"] if i["id"] == item["id"])
    assert nao_marcado["coletado"] is False

    # Segunda chamada com indice explícito → marca e entrega.
    res2 = _serializavel(api.coletar_item({"id": item["id"], "indice": 0}))
    assert res2["ok"] is True
    assert res2["escolha_necessaria"] is False
    assert res2["item"]  # nome do item criado
    marcado = next(i for i in api.obter_campanha()["itens"] if i["id"] == item["id"])
    assert marcado["coletado"] is True


def test_coletar_item_id_invalido_vira_erro_dto():
    api = _api_com_banda()
    res = api.coletar_item({"id": "fantasma"})
    assert res["ok"] is False


# ── registrar_posicao ─────────────────────────────────────────────────────────

def test_registrar_posicao_guarda_na_campanha():
    api = _api_com_banda()
    api.registrar_posicao(512.5)
    assert api.obter_campanha()["posicao"] == 512.5


# ── F3.4: golpe especial ──────────────────────────────────────────────────────

PERFEITO = {"acertos": 10, "total_notas": 10, "combo_max": 10}


def test_ataque_especial_indisponivel_vira_erro_dto():
    api = _api_com_banda()
    api.entrar_no_show(_primeira_venue(api)["id"])
    res = api.ataque_especial()                  # sem combos perfeitos ainda
    assert res["ok"] is False


def test_ataque_especial_disponivel_danifica_o_boss():
    api = _api_com_banda()
    api._garantir_campanha().ganhar_fama(3)       # gate de progressão: libera a Arena (UAT Fase 3)
    arena = api.obter_campanha()["venues"][-1]    # vilão mais resistente (aguenta 4 ataques)
    api.entrar_no_show(arena["id"])
    # 4 ataques perfeitos liberam o especial (cada perfeito também atordoa, então
    # o vilão não revida e a banda sobrevive pra encadear).
    estado = None
    for _ in range(4):
        estado = api.executar_acao({"indice": 0, "ritmo": PERFEITO})
    assert estado["especial_disponivel"] is True
    hp_antes = estado["estado"]["boss"]["hp"]
    res = _serializavel(api.ataque_especial())
    assert res["ok"] is True
    assert res["dano"] > 0
    assert res["estado"]["boss"]["hp"] < hp_antes


# ── F3.4: XP + drop ao vencer ─────────────────────────────────────────────────

def test_concluir_venue_da_xp_a_todos_e_devolve_drop():
    api = _api_com_banda()
    venue = _primeira_venue(api)
    antes = [(m["nivel"], m["xp"]) for m in api.obter_estado()["banda"]]
    res = _serializavel(api.concluir_venue(venue["id"]))
    assert res["xp_ganho"] > 0
    assert res["drop"] and res["drop"]["tipo"]
    depois = [(m["nivel"], m["xp"]) for m in api.obter_estado()["banda"]]
    assert depois != antes                        # XP subiu pra todo mundo
    assert all(d != a for d, a in zip(depois, antes))


def test_concluir_venue_e_idempotente_no_xp():
    api = _api_com_banda()
    venue = _primeira_venue(api)
    api.concluir_venue(venue["id"])
    snap = [(m["nivel"], m["xp"]) for m in api.obter_estado()["banda"]]
    res = api.concluir_venue(venue["id"])         # de novo
    assert res["xp_ganho"] == 0
    assert [(m["nivel"], m["xp"]) for m in api.obter_estado()["banda"]] == snap


def test_aplicar_drop_equipavel_vai_pro_inventario():
    # F3.6: drop NÃO equipa mais na hora — guarda no inventário do membro
    # escolhido (equipar é na van, via Tab). Atributo base fica intocado.
    api = _api_com_banda()
    g0 = api._gerenciador.listar_jogadores()[0]
    forca_antes = g0.get_forca()
    res = _serializavel(api.aplicar_drop({"tipo": "pedal", "indice": 0}))
    assert res["ok"] is True
    assert res["aplicado"] == "guardado"
    assert g0.get_forca() == forca_antes
    assert any(i.nome == "Pedal de Efeito" for i in g0.get_inventario().listar())


def test_aplicar_drop_incompativel_vira_erro_dto():
    # Pedal só pode em Guitarrista/Baixista; num Vocalista vira ErroDTO.
    api = API()
    api.criar_banda([{"tipo": "vocalista", "nome": "Selene", "folego": 50, "inteligencia": 12}])
    res = api.aplicar_drop({"tipo": "pedal", "indice": 0})
    assert res["ok"] is False


# ── F3.4: derrota bloqueia a venue ────────────────────────────────────────────

def test_registrar_derrota_bloqueia_e_impede_entrar():
    api = _api_com_banda()
    venue = _primeira_venue(api)
    res = api.registrar_derrota(venue["id"])
    assert res["ok"] is True
    assert res["bloqueada_seg"] > 0
    bloqueada = api.entrar_no_show(venue["id"])
    assert bloqueada["ok"] is False              # venue bloqueada → ErroDTO


def test_registrar_derrota_venue_invalida_vira_erro_dto():
    api = _api_com_banda()
    assert api.registrar_derrota("fantasma")["ok"] is False


# ── save/load retoma a história (teste-chave da fase) ─────────────────────────

def test_save_load_retoma_a_campanha(tmp_path):
    pasta = str(tmp_path)
    api = _api_com_banda()
    venue = _primeira_venue(api)
    item = _primeiro_item(api)

    api.concluir_venue(venue["id"])              # vence a 1ª (ganha fama)
    api.coletar_item({"id": item["id"], "indice": 0})  # indice explícito: item multi-elegível
    api.registrar_posicao(777.0)
    outra = api.obter_campanha()["venues"][1]    # 2ª venue
    api.registrar_derrota(outra["id"])           # bloqueia a 2ª + perde fama
    fama_salva = api.obter_campanha()["fama_banda"]
    api.salvar("slot1", pasta)

    # Nova sessão limpa: recarrega do save.
    GerenciadorJogo.resetar()
    api2 = API()
    api2.carregar("slot1", pasta)
    camp = api2.obter_campanha()

    assert next(v for v in camp["venues"] if v["id"] == venue["id"])["concluida"] is True
    assert next(i for i in camp["itens"] if i["id"] == item["id"])["coletado"] is True
    assert camp["posicao"] == 777.0
    assert camp["fama_banda"] == fama_salva
    assert next(v for v in camp["venues"] if v["id"] == outra["id"])["bloqueada"] is True
