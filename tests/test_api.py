import sys, os
import json

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


def _api_com_banda(composicao=None):
    api = API()
    api.criar_banda(composicao or [{"tipo": "guitarrista", "nome": "Aldric", "forca": 10}])
    return api


# ── listar_tipos_musicos ──────────────────────────────────────────────────────

def test_listar_tipos_retorna_os_quatro_musicos():
    api = API()
    tipos = api.listar_tipos_musicos()
    chaves = {t["tipo"] for t in tipos}
    assert chaves == {"guitarrista", "vocalista", "baterista", "baixista"}


def test_listar_tipos_e_serializavel():
    api = API()
    json.dumps(api.listar_tipos_musicos())  # não levanta


# ── criar_banda / obter_estado ────────────────────────────────────────────────

def test_criar_banda_retorna_estado_serializavel():
    api = _api_com_banda()
    estado = api.obter_estado()
    json.dumps(estado)  # tudo cruza a ponte como JSON
    assert estado["banda"][0]["nome"] == "Aldric"
    assert estado["boss"]["hp"] > 0
    assert estado["fim_de_jogo"] is False


def test_estado_traz_recurso_ego_do_guitarrista():
    api = _api_com_banda([{"tipo": "guitarrista", "nome": "Aldric", "forca": 10, "ego": 30}])
    rec = api.obter_estado()["banda"][0]["recurso"]
    assert rec["tipo"] == "ego"
    assert rec["valor"] == 30
    assert rec["max"] == 50


def test_estado_traz_recurso_inteligencia_do_vocalista():
    # F3.8: o fôlego virou a energia unificada (todo músico tem `energia` no
    # DTO) — o recurso próprio do vocalista agora é a inteligência.
    api = _api_com_banda([{"tipo": "vocalista", "nome": "Selene", "folego": 50, "inteligencia": 10}])
    m0 = api.obter_estado()["banda"][0]
    assert m0["recurso"]["tipo"] == "inteligencia"
    assert m0["recurso"]["valor"] == 10
    assert m0["energia"] == 50


def test_estado_traz_recurso_groove_do_baixista():
    api = _api_com_banda([{"tipo": "baixista", "nome": "Paul", "forca": 10, "fe": 20}])
    rec = api.obter_estado()["banda"][0]["recurso"]
    assert rec["tipo"] == "groove"
    assert rec["valor"] == 20


# ── executar_acao ─────────────────────────────────────────────────────────────

def test_executar_acao_reduz_hp_do_boss():
    api = _api_com_banda()
    hp0 = api.obter_estado()["boss"]["hp"]
    res = api.executar_acao({"indice": 0})
    assert res["ok"] is True
    assert res["dano"] == 15
    assert res["estado"]["boss"]["hp"] == hp0 - 15


def test_executar_acao_com_ritmo_aplica_multiplicador():
    api = _api_com_banda()
    # precisao=0.8 (<0.90, sem Modo Refrão); mult = 1.0 + 5*0.1 = 1.5
    res = api.executar_acao({"indice": 0,
                             "ritmo": {"acertos": 8, "total_notas": 10, "combo_max": 5}})
    assert res["dano"] == 22
    assert res["multiplicador_aplicado"] == pytest.approx(1.5)


def test_executar_acao_indice_invalido_retorna_erro_dto():
    api = _api_com_banda()
    res = api.executar_acao({"indice": 9})
    assert res["ok"] is False
    assert "erro" in res
    json.dumps(res)  # ErroDTO também é serializável


def test_executar_acao_vitoria_quando_boss_cai():
    api = _api_com_banda([{"tipo": "guitarrista", "nome": "Aldric", "forca": 10}])
    api._gerenciador.get_boss()._hp = 10  # boss quase morto
    res = api.executar_acao({"indice": 0})
    assert res["fim_de_jogo"] is True
    assert res["resultado_final"] == "vitoria"


# ── turno_inimigo ─────────────────────────────────────────────────────────────

def test_turno_inimigo_reduz_hp_de_musico():
    api = _api_com_banda()
    hp0 = api.obter_estado()["banda"][0]["hp"]
    res = api.turno_inimigo()
    assert res["ok"] is True
    assert res["estado"]["banda"][0]["hp"] < hp0


# ── nova_campanha (menu principal → Novo jogo) ────────────────────────────────

def test_nova_campanha_reseta_progresso():
    api = _api_com_banda()
    api.concluir_venue("bar")
    api.registrar_posicao(500.0)
    res = api.nova_campanha()
    assert res["ok"] is True
    camp = res["campanha"]
    json.dumps(camp)
    assert all(not v["concluida"] for v in camp["venues"])
    assert camp["fama_banda"] == 0
    assert camp["posicao"] != 500.0


def test_nova_campanha_zera_bloqueios_de_derrota():
    api = _api_com_banda()
    api.registrar_derrota("bar")
    api.nova_campanha()
    # venue volta acessível: entrar não devolve ErroDTO de bloqueio
    res = api.entrar_no_show("bar")
    assert res.get("ok") is not False


# ── sair (menu principal → Sair) ──────────────────────────────────────────────

def test_sair_sem_janela_retorna_erro_dto():
    api = API()
    r = api.sair()   # sem janela pywebview aberta → ErroDTO, nunca traceback
    assert r["ok"] is False
    assert "erro" in r


# ── persistência ──────────────────────────────────────────────────────────────

def test_salvar_e_carregar_round_trip(tmp_path):
    api = _api_com_banda([{"tipo": "guitarrista", "nome": "Aldric", "forca": 12}])
    r = api.salvar("slot1", pasta=str(tmp_path))
    assert r["ok"] is True

    GerenciadorJogo.resetar()
    api2 = API()
    r2 = api2.carregar("slot1", pasta=str(tmp_path))
    assert r2["ok"] is True
    assert r2["estado"]["banda"][0]["nome"] == "Aldric"


def test_save_load_preserva_hp_do_boss(tmp_path):
    api = _api_com_banda([{"tipo": "guitarrista", "nome": "Aldric", "forca": 10}])
    api.executar_acao({"indice": 0})  # boss leva dano
    hp_com_dano = api.obter_estado()["boss"]["hp"]
    assert hp_com_dano < 200

    api.salvar("slot_boss", pasta=str(tmp_path))
    GerenciadorJogo.resetar()
    api2 = API()
    res = api2.carregar("slot_boss", pasta=str(tmp_path))
    # o show retoma no ponto certo — boss NÃO volta pra 200
    assert res["estado"]["boss"]["hp"] == hp_com_dano


def test_carregar_inexistente_retorna_erro_dto(tmp_path):
    api = API()
    r = api.carregar("naoexiste", pasta=str(tmp_path))
    assert r["ok"] is False
    assert "erro" in r


def test_listar_saves_e_serializavel(tmp_path):
    api = _api_com_banda()
    api.salvar("slot1", pasta=str(tmp_path))
    saves = api.listar_saves(pasta=str(tmp_path))
    json.dumps(saves)
    assert any(s["slot"] == "slot1" for s in saves)


# ── MAP-01: van_estagio no DTO da campanha (Phase 1) ────────────────────────

def test_obter_campanha_contem_van_estagio():
    """obter_campanha() deve expor van_estagio no DTO."""
    api = _api_com_banda()
    camp = api.obter_campanha()
    assert "van_estagio" in camp


def test_van_estagio_dto_reflete_fama_atual():
    """van_estagio do DTO reflete a fama_banda atual: 0 → 1, 6+ → 3."""
    api = _api_com_banda()
    camp0 = api.obter_campanha()
    assert camp0["van_estagio"] == 1          # fama 0 → estágio 1

    # Vence 3 venues acumulando fama >= 6 (1+2+3)
    api.concluir_venue("bar")
    api.concluir_venue("feira")
    api.concluir_venue("arena")
    camp3 = api.obter_campanha()
    assert camp3["van_estagio"] == 3          # fama 6 → estágio 3


def test_van_estagio_dto_e_serializavel():
    """DTO completo da campanha deve ser JSON-serializável com van_estagio."""
    api = _api_com_banda()
    camp = api.obter_campanha()
    json.dumps(camp)  # não levanta


# ── MAP-02: abordar_npc na ponte (Phase 1) ───────────────────────────────────

def _serializavel(obj):
    json.dumps(obj)  # levanta se nao for serializavel


def test_obter_campanha_contem_npcs():
    """obter_campanha() deve incluir a chave 'npcs' no DTO."""
    api = _api_com_banda()
    camp = api.obter_campanha()
    assert "npcs" in camp
    _serializavel(camp)


def test_abordar_npc_primeira_vez_entrega_item():
    """Na primeira abordagem: ok=True, ja_deu=False, item != None, inventario cresce."""
    api = _api_com_banda()
    camp = api.obter_campanha()
    npc_id = camp["npcs"][0]["id"]

    # tamanho inicial do inventario
    eq0 = api.obter_equipamento()
    tam0 = len(eq0["banda"][0]["inventario"])

    res = api.abordar_npc({"id": npc_id})
    assert res["ok"] is True
    assert res["ja_deu"] is False
    assert res["item"] is not None
    assert res["fala"]  # string nao vazia

    eq1 = api.obter_equipamento()
    assert len(eq1["banda"][0]["inventario"]) == tam0 + 1


def test_abordar_npc_segunda_vez_nao_da_item():
    """Na segunda abordagem: ok=True, ja_deu=True, item=None, inventario nao cresce."""
    api = _api_com_banda()
    camp = api.obter_campanha()
    npc_id = camp["npcs"][0]["id"]

    api.abordar_npc({"id": npc_id})   # primeira vez

    eq1 = api.obter_equipamento()
    tam1 = len(eq1["banda"][0]["inventario"])

    res = api.abordar_npc({"id": npc_id})  # segunda vez
    assert res["ok"] is True
    assert res["ja_deu"] is True
    assert res["item"] is None
    assert res["fala"]  # ainda repete a fala

    eq2 = api.obter_equipamento()
    assert len(eq2["banda"][0]["inventario"]) == tam1


def test_abordar_npc_invalido_retorna_erro_dto():
    """id invalido deve retornar ErroDTO com tipo NpcInvalidoError."""
    api = _api_com_banda()
    res = api.abordar_npc({"id": "nao-existe"})
    assert res["ok"] is False
    assert res["erro"]["tipo"] == "NpcInvalidoError"
    _serializavel(res)


# ── MAP-03: abrir_bau na ponte (Phase 1) ────────────────────────────────────

def test_obter_campanha_contem_baus():
    """obter_campanha() deve incluir a chave 'baus' no DTO e ser serializável."""
    api = _api_com_banda()
    camp = api.obter_campanha()
    assert "baus" in camp
    _serializavel(camp)


def test_abrir_bau_caminho_feliz_entrega_item():
    """abrir_bau no baú sem gate deve: ok=True, item != None, inventário cresce."""
    api = _api_com_banda()
    camp = api.obter_campanha()
    # baú sem gate de fama (fama_minima ausente ou 0)
    bau = next(b for b in camp["baus"] if b.get("fama_minima", 0) == 0)

    eq0 = api.obter_equipamento()
    tam0 = len(eq0["banda"][0]["inventario"])

    res = api.abrir_bau({"id": bau["id"]})
    assert res["ok"] is True
    assert res["item"] is not None
    _serializavel(res)

    eq1 = api.obter_equipamento()
    assert len(eq1["banda"][0]["inventario"]) == tam0 + 1


def test_abrir_bau_gated_retorna_erro_dto_fama_insuficiente():
    """abrir_bau no baú gated com fama baixa deve retornar ErroDTO FamaInsuficienteError."""
    api = _api_com_banda()
    # banda recém-criada tem fama 0 < 3 (gate do bau2) → bloqueado
    res = api.abrir_bau({"id": "bau2"})
    assert res["ok"] is False
    assert res["erro"]["tipo"] == "FamaInsuficienteError"
    _serializavel(res)


def test_abrir_bau_idempotente_nao_duplica_item():
    """Abrir o MESMO baú duas vezes deve entregar o item só na 1ª vez (D-13).
    2ª chamada: ok=True, ja_aberto=True, item=None, inventário NÃO cresce de novo.
    Regressão do bug 'clicar repetido pega item infinito'."""
    api = _api_com_banda()
    camp = api.obter_campanha()
    bau = next(b for b in camp["baus"] if b.get("fama_minima", 0) == 0)

    eq0 = api.obter_equipamento()
    tam0 = len(eq0["banda"][0]["inventario"])

    r1 = api.abrir_bau({"id": bau["id"]})
    assert r1["ok"] is True and r1["item"] is not None
    assert r1.get("ja_aberto") is False
    tam1 = len(api.obter_equipamento()["banda"][0]["inventario"])
    assert tam1 == tam0 + 1

    r2 = api.abrir_bau({"id": bau["id"]})
    assert r2["ok"] is True
    assert r2.get("ja_aberto") is True
    assert r2["item"] is None
    tam2 = len(api.obter_equipamento()["banda"][0]["inventario"])
    assert tam2 == tam1   # não duplicou
    _serializavel(r2)


def test_abrir_bau_id_invalido_retorna_erro_dto():
    """abrir_bau com id inválido deve retornar ErroDTO BauInvalidoError."""
    api = _api_com_banda()
    res = api.abrir_bau({"id": "nao-existe"})
    assert res["ok"] is False
    assert res["erro"]["tipo"] == "BauInvalidoError"
    _serializavel(res)


# ── Ajuste 1: roteamento de itens coletados ao músico elegível por classe ───

def _api_banda_completa():
    """Banda com os 4 membros: Geraldo (guitarrista), Vande (vocalista),
    Ramiro (baterista), Marivaldo (baixista). Ordem preservada."""
    return _api_com_banda([
        {"tipo": "guitarrista", "nome": "Geraldo",   "forca": 10},
        {"tipo": "vocalista",   "nome": "Vande",     "inteligencia": 10},
        {"tipo": "baterista",   "nome": "Ramiro",    "agilidade": 10},
        {"tipo": "baixista",    "nome": "Marivaldo", "forca": 10},
    ])


def test_coletar_item_sem_classe_vai_ao_indice0():
    """Item sem classes_permitidas (energético) vai ao índice 0 por padrão."""
    api = _api_banda_completa()
    api.nova_campanha()
    camp = api.obter_campanha()
    # i1 é energético (sem classe)
    item_id = next(i["id"] for i in camp["itens"] if i["tipo"] == "energetico")
    res = api.coletar_item({"id": item_id})
    assert res["ok"] is True
    eq = api.obter_equipamento()
    # deve estar no inventário do músico 0 (Geraldo)
    nomes_inv0 = [it["nome"] for it in eq["banda"][0]["inventario"]]
    assert "Energético" in nomes_inv0


def test_npc_item_de_vocalista_vai_ao_vocalista():
    """NPC que entrega partitura_magica (Vocalista) deve rotear para Vande (índice 1)."""
    api = _api_banda_completa()
    api.nova_campanha()
    # npc4 entrega partitura_magica (Vocalista)
    res = api.abordar_npc({"id": "npc4"})
    assert res["ok"] is True
    assert res["item"] == "Partitura Mágica"
    eq = api.obter_equipamento()
    # Vande é índice 1
    nomes_vande = [it["nome"] for it in eq["banda"][1]["inventario"]]
    assert "Partitura Mágica" in nomes_vande
    # Geraldo (índice 0) NÃO deve ter o item
    nomes_geraldo = [it["nome"] for it in eq["banda"][0]["inventario"]]
    assert "Partitura Mágica" not in nomes_geraldo


def test_npc_item_de_baterista_vai_ao_baterista():
    """NPC que entrega oculos_do_ritmo (Baterista) deve rotear para Ramiro (índice 2)."""
    api = _api_banda_completa()
    api.nova_campanha()
    # npc5 entrega oculos_do_ritmo (Baterista)
    res = api.abordar_npc({"id": "npc5"})
    assert res["ok"] is True
    assert res["item"] == "Óculos do Ritmo"
    eq = api.obter_equipamento()
    # Ramiro é índice 2
    nomes_ramiro = [it["nome"] for it in eq["banda"][2]["inventario"]]
    assert "Óculos do Ritmo" in nomes_ramiro
    nomes_geraldo = [it["nome"] for it in eq["banda"][0]["inventario"]]
    assert "Óculos do Ritmo" not in nomes_geraldo


def test_npc_item_de_baixista_vai_ao_baixista():
    """NPC que entrega corda_de_tungstenio (Baixista) deve rotear para Marivaldo (índice 3)."""
    api = _api_banda_completa()
    api.nova_campanha()
    # npc6 entrega corda_de_tungstenio (Baixista)
    res = api.abordar_npc({"id": "npc6"})
    assert res["ok"] is True
    assert res["item"] == "Corda de Tungstênio"
    eq = api.obter_equipamento()
    # Marivaldo é índice 3
    nomes_marivaldo = [it["nome"] for it in eq["banda"][3]["inventario"]]
    assert "Corda de Tungstênio" in nomes_marivaldo
    nomes_geraldo = [it["nome"] for it in eq["banda"][0]["inventario"]]
    assert "Corda de Tungstênio" not in nomes_geraldo


def test_bau_de_vocalista_vai_ao_vocalista():
    """bau1 contém microfone_de_ouro (Vocalista) — deve ir para Vande (índice 1)."""
    api = _api_banda_completa()
    api.nova_campanha()
    res = api.abrir_bau({"id": "bau1"})
    assert res["ok"] is True
    assert res["item"] == "Microfone de Ouro"
    eq = api.obter_equipamento()
    nomes_vande = [it["nome"] for it in eq["banda"][1]["inventario"]]
    assert "Microfone de Ouro" in nomes_vande
    nomes_geraldo = [it["nome"] for it in eq["banda"][0]["inventario"]]
    assert "Microfone de Ouro" not in nomes_geraldo


def test_indice_elegivel_fallback_quando_classe_ausente():
    """Se a banda não tem membro da classe exigida, item cai no índice 0 (fallback)."""
    # Banda só com guitarrista — sem vocalista para receber partitura
    api = _api_com_banda([{"tipo": "guitarrista", "nome": "Solo", "forca": 10}])
    api.nova_campanha()
    res = api.abordar_npc({"id": "npc4"})   # partitura_magica (Vocalista)
    assert res["ok"] is True
    eq = api.obter_equipamento()
    nomes_solo = [it["nome"] for it in eq["banda"][0]["inventario"]]
    assert "Partitura Mágica" in nomes_solo   # fallback ao índice 0
