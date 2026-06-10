import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pytest
from unittest.mock import patch

from show import Show, Empresario
from ritmo import Ritmo
from Guitarrista import Guitarrista
from Vocalista import Vocalista
from Baterista import Baterista
from Baixista import Baixista
from gerenciador import GerenciadorJogo
from excecoes import JogadorMortoError, EspecialIndisponivelError


PERFEITO = Ritmo(acertos=10, total_notas=10, combo_max=10)   # todas as notas
QUASE = Ritmo(acertos=8, total_notas=10, combo_max=5)        # errou alguma


@pytest.fixture(autouse=True)
def _reset_singleton():
    GerenciadorJogo.resetar()
    yield
    GerenciadorJogo.resetar()


# ── Empresario ────────────────────────────────────────────────────────────────

def test_empresario_esta_vivo_com_hp_positivo():
    emp = Empresario("Boss", hp=100, dano=10)
    assert emp.esta_vivo() is True


def test_empresario_morre_ao_receber_dano_total():
    emp = Empresario("Boss", hp=10, dano=10)
    emp.receber_dano(10)
    assert emp.esta_vivo() is False


def test_empresario_receber_dano_morto_levanta_jogador_morto_error():
    emp = Empresario("Boss", hp=5, dano=10)
    emp.receber_dano(5)
    with pytest.raises(JogadorMortoError):
        emp.receber_dano(1)


def test_empresario_get_hp_apos_dano():
    emp = Empresario("Boss", hp=50, dano=10)
    assert emp.get_hp() == 50
    emp.receber_dano(20)
    assert emp.get_hp() == 30


def test_empresario_get_nome():
    emp = Empresario("O Empresário", hp=100, dano=10)
    assert emp.get_nome() == "O Empresário"


def test_empresario_hp_maximo_inicial():
    emp = Empresario("Boss", hp=200, dano=10)
    assert emp.get_hp_maximo() == 200


def test_empresario_round_trip_preserva_hp_atual_e_maximo():
    emp = Empresario("Boss", hp=200, dano=15)
    emp.receber_dano(50)
    copia = Empresario.from_dict(emp.to_dict())
    assert copia.get_nome() == "Boss"
    assert copia.get_hp() == 150
    assert copia.get_hp_maximo() == 200


# ── Show.acao_musico — contrato D2 (retorna dano calculado pelo Show) ─────────

def test_acao_musico_reduz_hp_do_empresario():
    g = Guitarrista("Aldric", forca=10)  # dano base = 15, ego=0 → dano final = 15
    emp = Empresario("Boss", hp=100, dano=10)
    show = Show([g], emp)
    resultado = show.acao_musico(0)
    assert emp.get_hp() == 85
    assert resultado["dano"] == 15


def test_acao_musico_retorna_dict_com_campos_esperados():
    g = Guitarrista("Aldric", forca=10)
    emp = Empresario("Boss", hp=100, dano=10)
    show = Show([g], emp)
    resultado = show.acao_musico(0)
    assert "atacante" in resultado
    assert "dano" in resultado
    assert "hp_inimigo" in resultado
    assert "fim" in resultado
    assert "critico" in resultado
    assert "modo_refrao_ativo" in resultado
    assert "multiplicador_aplicado" in resultado


def test_acao_musico_retorna_vitoria_quando_empresario_cai():
    g = Guitarrista("Aldric", forca=10)  # dano = 15
    emp = Empresario("Boss", hp=10, dano=10)
    show = Show([g], emp)
    resultado = show.acao_musico(0)
    assert resultado["fim"] == "vitoria"
    assert not emp.esta_vivo()


def test_acao_musico_retorna_fim_none_se_jogo_continua():
    g = Guitarrista("Aldric", forca=10)
    emp = Empresario("Boss", hp=100, dano=10)
    show = Show([g], emp)
    resultado = show.acao_musico(0)
    assert resultado["fim"] is None


# ── Show.acao_musico — multiplicador de Ritmo ─────────────────────────────────

def test_acao_musico_aplica_multiplicador_de_ritmo():
    g = Guitarrista("Aldric", forca=10)  # dano base = 15
    emp = Empresario("Boss", hp=200, dano=10)
    show = Show([g], emp)
    # precisao=0.8 < 0.90 → sem Modo Refrão; mult = 1.0 + 5*0.1 = 1.5
    ritmo = Ritmo(acertos=8, total_notas=10, combo_max=5)
    resultado = show.acao_musico(0, ritmo=ritmo)
    # dano_final = int(15 * 1.5) = 22
    assert resultado["dano"] == 22
    assert resultado["multiplicador_aplicado"] == pytest.approx(1.5)


def test_acao_musico_sem_ritmo_mult_e_1():
    g = Guitarrista("Aldric", forca=10)
    emp = Empresario("Boss", hp=200, dano=10)
    show = Show([g], emp)
    resultado = show.acao_musico(0)  # sem ritmo
    assert resultado["multiplicador_aplicado"] == pytest.approx(1.0)


def test_acao_musico_modo_refrao_aplica_mult_extra():
    g = Guitarrista("Aldric", forca=10)  # dano base = 15
    emp = Empresario("Boss", hp=200, dano=10)
    show = Show([g], emp)
    # precisao=1.0 >= 0.90 → Modo Refrão; mult = 1.0 + 0 * 0.1 = 1.0; com refrão: 1.0 * 1.5 = 1.5
    ritmo = Ritmo(acertos=10, total_notas=10, combo_max=0)
    resultado = show.acao_musico(0, ritmo=ritmo)
    assert resultado["modo_refrao_ativo"] is True
    # dano_final = int(15 * 1.5) = 22
    assert resultado["dano"] == 22


# ── Virada de bateria (crítico do Baterista) ──────────────────────────────────

def test_baterista_critico_mockado_no_show():
    with patch("random.random", return_value=0.0):  # 0.0 < 0.3 → sempre crítico
        b = Baterista("Kael", agilidade=10, chance_critico=0.3)
        emp = Empresario("Boss", hp=1000, dano=5)
        show = Show([b], emp)
        resultado = show.acao_musico(0)
        assert resultado["dano"] == 30  # int(10 * 3.0)
        assert resultado["critico"] is True


def test_baterista_normal_nao_e_critico():
    with patch("random.random", return_value=1.0):  # nunca crítico
        b = Baterista("Kael", agilidade=10, chance_critico=0.3)
        emp = Empresario("Boss", hp=1000, dano=5)
        show = Show([b], emp)
        resultado = show.acao_musico(0)
        assert resultado["dano"] == 10  # int(10 * 1.0)
        assert resultado["critico"] is False


# ── Ego do Guitarrista no Show ────────────────────────────────────────────────

def test_ego_alto_aumenta_dano_no_show():
    g = Guitarrista("Aldric", forca=10, ego=50)  # ego no máximo
    emp = Empresario("Boss", hp=200, dano=10)
    show = Show([g], emp)
    resultado = show.acao_musico(0)
    # dano_base = 15; ego_bonus = int(50 / 10) = 5; dano_final = int((15+5)*1.0) = 20
    assert resultado["dano"] == 20


def test_ego_zero_nao_adiciona_bonus():
    g = Guitarrista("Aldric", forca=10, ego=0)
    emp = Empresario("Boss", hp=200, dano=10)
    show = Show([g], emp)
    resultado = show.acao_musico(0)
    assert resultado["dano"] == 15  # sem bonus


# ── Show.turno_inimigo ────────────────────────────────────────────────────────

def test_turno_inimigo_reduz_hp_de_musico_vivo():
    g = Guitarrista("Aldric", forca=10)
    hp_antes = g.get_hp()
    emp = Empresario("Boss", hp=100, dano=20)
    show = Show([g], emp)
    resultado = show.turno_inimigo()
    assert g.get_hp() == hp_antes - 20
    assert resultado["dano"] == 20


def test_turno_inimigo_retorna_dict_com_campos_esperados():
    g = Guitarrista("Aldric", forca=10)
    emp = Empresario("Boss", hp=100, dano=20)
    show = Show([g], emp)
    resultado = show.turno_inimigo()
    assert "atacante" in resultado
    assert "alvo" in resultado
    assert "dano" in resultado
    assert "hp_alvo" in resultado
    assert "fim" in resultado


def test_turno_inimigo_pula_musico_nocauteado():
    g1 = Guitarrista("Morto", hp_maximo=10, forca=1)
    g1.receber_dano(10)
    g2 = Guitarrista("Vivo", forca=10)
    hp_antes = g2.get_hp()
    emp = Empresario("Boss", hp=100, dano=20)
    show = Show([g1, g2], emp)
    resultado = show.turno_inimigo()
    assert g1.get_hp() == 0
    assert g2.get_hp() == hp_antes - 20
    assert resultado["alvo"] == "Vivo"


def test_turno_inimigo_sem_musicos_vivos_retorna_derrota():
    g = Guitarrista("Aldric", hp_maximo=10, forca=1)
    g.receber_dano(10)
    emp = Empresario("Boss", hp=100, dano=20)
    show = Show([g], emp)
    resultado = show.turno_inimigo()
    assert resultado["fim"] == "derrota"


def test_turno_inimigo_escolhe_alvo_aleatorio_entre_vivos():
    g1 = Guitarrista("Ana", forca=1)
    g2 = Guitarrista("Bia", forca=1)
    g3 = Guitarrista("Cau", forca=1)
    emp = Empresario("Boss", hp=100, dano=10)
    show = Show([g1, g2, g3], emp)
    with patch("random.choice", return_value=g2):
        resultado = show.turno_inimigo()
    assert resultado["alvo"] == "Bia"  # não é mais sempre o primeiro


# ── Show.verificar_fim ────────────────────────────────────────────────────────

def test_verificar_fim_retorna_none_quando_jogo_continua():
    g = Guitarrista("Aldric", forca=10)
    emp = Empresario("Boss", hp=100, dano=10)
    show = Show([g], emp)
    assert show.verificar_fim() is None


def test_verificar_fim_vitoria_quando_empresario_morto():
    g = Guitarrista("Aldric", forca=10)
    emp = Empresario("Boss", hp=1, dano=10)
    emp.receber_dano(1)
    show = Show([g], emp)
    assert show.verificar_fim() == "vitoria"


def test_verificar_fim_derrota_quando_banda_toda_nocauteada():
    g = Guitarrista("Aldric", hp_maximo=10, forca=1)
    g.receber_dano(10)
    emp = Empresario("Boss", hp=100, dano=10)
    show = Show([g], emp)
    assert show.verificar_fim() == "derrota"


def test_verificar_fim_banda_vazia_e_neutro():
    # Banda vazia não é "derrota" imediata — é um estado neutro (monte a banda).
    emp = Empresario("Boss", hp=100, dano=10)
    show = Show([], emp)
    assert show.verificar_fim() is None


# ── Polimorfismo ──────────────────────────────────────────────────────────────

def test_polimorfismo_banda_mista_sem_isinstance():
    banda = [
        Guitarrista("G", forca=10),
        Vocalista("M", inteligencia=10, folego=50),
        Baterista("L", agilidade=10, chance_critico=0.0),
        Baixista("P", forca=10, fe=20),
    ]
    emp = Empresario("Boss", hp=1000, dano=5)
    show = Show(banda, emp)
    for i in range(len(banda)):
        resultado = show.acao_musico(i)
        assert "dano" in resultado
        assert resultado["dano"] > 0


# ── Integração com Factory/Singleton ─────────────────────────────────────────

def test_integracao_factory_singleton_banda_e_show():
    g = GerenciadorJogo.get_instancia()
    g.criar_banda([
        {"tipo": "guitarrista", "nome": "Aldric", "forca": 10},
        {"tipo": "vocalista", "nome": "Selene", "folego": 50, "inteligencia": 10},
    ])
    banda = g.listar_jogadores()
    emp = Empresario("Boss", hp=200, dano=15)
    show = Show(banda, emp)
    resultado = show.acao_musico(0)
    assert resultado["dano"] == 15  # guitarrista ego=0 → dano = 15
    assert emp.get_hp() == 185


def test_turno_inimigo_com_morto_em_posicao_zero():
    g1 = Guitarrista("Morto", hp_maximo=1, forca=1)
    g1.receber_dano(1)
    g2 = Guitarrista("Vivo", forca=10)
    emp = Empresario("Boss", hp=100, dano=10)
    show = Show([g1, g2], emp)
    resultado = show.turno_inimigo()
    assert resultado["alvo"] == "Vivo"


# ── F3.4: atordoamento (combo perfeito) ───────────────────────────────────────

def test_empresario_comeca_sem_atordoamento():
    assert Empresario("Boss", hp=100, dano=10).esta_atordoado() is False


def test_empresario_round_trip_preserva_atordoamento():
    emp = Empresario("Boss", hp=100, dano=10)
    emp.atordoar()
    copia = Empresario.from_dict(emp.to_dict())
    assert copia.esta_atordoado() is True


def test_acao_musico_perfeita_atordoa_o_boss():
    g = Guitarrista("Aldric", forca=10)
    emp = Empresario("Boss", hp=1000, dano=10)
    show = Show([g], emp)
    res = show.acao_musico(0, ritmo=PERFEITO)
    assert res["perfeito"] is True
    assert res["atordoado"] is True
    assert emp.esta_atordoado() is True


def test_acao_musico_imperfeita_nao_atordoa():
    g = Guitarrista("Aldric", forca=10)
    emp = Empresario("Boss", hp=1000, dano=10)
    show = Show([g], emp)
    res = show.acao_musico(0, ritmo=QUASE)
    assert res["perfeito"] is False
    assert emp.esta_atordoado() is False


def test_turno_inimigo_atordoado_perde_a_vez_e_acorda():
    g = Guitarrista("Aldric", forca=10)
    hp_antes = g.get_hp()
    emp = Empresario("Boss", hp=1000, dano=20)
    show = Show([g], emp)
    show.acao_musico(0, ritmo=PERFEITO)          # atordoa
    res = show.turno_inimigo()
    assert res["atordoado"] is True
    assert res["dano"] == 0
    assert g.get_hp() == hp_antes                # não levou dano
    assert emp.esta_atordoado() is False         # consumiu o stun
    # próxima rodada o vilão volta a atacar normalmente
    res2 = show.turno_inimigo()
    assert res2["dano"] == 20
    assert g.get_hp() == hp_antes - 20


# ── F3.4: sequência de perfeitos → golpe especial ─────────────────────────────

def test_streak_de_perfeitos_sobe_e_zera_ao_errar():
    g = Guitarrista("Aldric", forca=10)
    emp = Empresario("Boss", hp=100000, dano=10)
    show = Show([g], emp)
    show.acao_musico(0, ritmo=PERFEITO)
    show.acao_musico(0, ritmo=PERFEITO)
    assert show._perfeitos_seguidos == 2
    res = show.acao_musico(0, ritmo=QUASE)       # errou → zera
    assert res["perfeitos_seguidos"] == 0


def test_especial_disponivel_apos_quatro_perfeitos():
    g = Guitarrista("Aldric", forca=10)
    emp = Empresario("Boss", hp=100000, dano=10)
    show = Show([g], emp)
    for _ in range(3):
        assert show.acao_musico(0, ritmo=PERFEITO)["especial_disponivel"] is False
    assert show.acao_musico(0, ritmo=PERFEITO)["especial_disponivel"] is True


def test_ataque_especial_indisponivel_levanta():
    g = Guitarrista("Aldric", forca=10)
    emp = Empresario("Boss", hp=1000, dano=10)
    show = Show([g], emp)
    with pytest.raises(EspecialIndisponivelError):
        show.ataque_especial()


def test_ataque_especial_soma_dano_de_todos_e_zera_streak():
    banda = [Guitarrista("G", forca=10), Baixista("P", forca=10, fe=20)]
    emp = Empresario("Boss", hp=100000, dano=10)
    show = Show(banda, emp)
    show._perfeitos_seguidos = 4                 # libera o especial direto
    hp0 = emp.get_hp()
    res = show.ataque_especial()
    assert len(res["por_membro"]) == 2
    assert res["dano"] == sum(m["dano"] for m in res["por_membro"])
    assert res["dano"] > 0
    assert emp.get_hp() == hp0 - res["dano"]
    assert show.especial_disponivel() is False   # zerou a sequência


def test_ataque_especial_ignora_membro_nocauteado():
    morto = Guitarrista("Morto", hp_maximo=10, forca=10)
    morto.receber_dano(10)
    vivo = Guitarrista("Vivo", forca=10)
    emp = Empresario("Boss", hp=100000, dano=10)
    show = Show([morto, vivo], emp)
    show._perfeitos_seguidos = 4
    res = show.ataque_especial()
    assert [m["atacante"] for m in res["por_membro"]] == ["Vivo"]


# ── F3.4: multiplicador de fama da banda ──────────────────────────────────────

def test_mult_banda_escala_o_dano():
    g = Guitarrista("Aldric", forca=10)          # base 15, ego 0
    emp = Empresario("Boss", hp=1000, dano=10)
    show = Show([g], emp, mult_banda=2.0)
    res = show.acao_musico(0)                     # sem ritmo: 15 * 1.0 * 2.0
    assert res["dano"] == 30
