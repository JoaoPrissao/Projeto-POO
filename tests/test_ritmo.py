import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pytest
from ritmo import Ritmo


# ── precisao ──────────────────────────────────────────────────────

def test_precisao_calcula_corretamente():
    r = Ritmo(acertos=14, total_notas=16, combo_max=10)
    assert r.precisao == pytest.approx(14 / 16)


def test_precisao_100_porcento():
    r = Ritmo(acertos=16, total_notas=16, combo_max=16)
    assert r.precisao == pytest.approx(1.0)


def test_precisao_zero():
    r = Ritmo(acertos=0, total_notas=10, combo_max=0)
    assert r.precisao == pytest.approx(0.0)


def test_precisao_total_notas_zero_levanta_erro():
    with pytest.raises(ValueError):
        Ritmo(acertos=0, total_notas=0, combo_max=0)


# ── multiplicador ────────────────────────────────────────────────

def test_multiplicador_sem_combo_e_1():
    r = Ritmo(acertos=10, total_notas=16, combo_max=0)
    assert r.multiplicador() == pytest.approx(1.0)


def test_multiplicador_com_combo_medio():
    r = Ritmo(acertos=12, total_notas=16, combo_max=5)
    # 1.0 + 5 * 0.1 = 1.5
    assert r.multiplicador() == pytest.approx(1.5)


def test_multiplicador_com_combo_alto_respeita_teto():
    r = Ritmo(acertos=16, total_notas=16, combo_max=100)
    # 1.0 + 100 * 0.1 = 11.0 → teto = 2.0
    assert r.multiplicador() == pytest.approx(2.0)


def test_multiplicador_exatamente_no_teto():
    r = Ritmo(acertos=16, total_notas=16, combo_max=10)
    # 1.0 + 10 * 0.1 = 2.0 (exatamente no teto)
    assert r.multiplicador() == pytest.approx(2.0)


# ── modo_refrao ───────────────────────────────────────────────────

def test_modo_refrao_ativo_com_precisao_alta():
    r = Ritmo(acertos=16, total_notas=16, combo_max=10)
    assert r.modo_refrao() is True


def test_modo_refrao_ativo_no_limiar_exato():
    # precisao = 9/10 = 0.90 = LIMIAR_REFRAO
    r = Ritmo(acertos=9, total_notas=10, combo_max=5)
    assert r.modo_refrao() is True


def test_modo_refrao_inativo_com_precisao_baixa():
    r = Ritmo(acertos=8, total_notas=10, combo_max=5)
    # precisao = 0.80 < 0.90
    assert r.modo_refrao() is False


# ── de_payload ────────────────────────────────────────────────────

def test_de_payload_reconstroi_ritmo():
    dto = {"acertos": 14, "total_notas": 16, "combo_max": 12}
    r = Ritmo.de_payload(dto)
    assert r.precisao == pytest.approx(14 / 16)
    # 1.0 + 12 * 0.1 = 2.2 → teto = 2.0
    assert r.multiplicador() == pytest.approx(2.0)
    # 14/16 = 0.875 < 0.90 → modo refrão inativo
    assert r.modo_refrao() is False


def test_de_payload_modo_refrao_ativo():
    dto = {"acertos": 10, "total_notas": 10, "combo_max": 8}
    r = Ritmo.de_payload(dto)
    assert r.modo_refrao() is True


def test_de_payload_modo_refrao_inativo():
    dto = {"acertos": 8, "total_notas": 10, "combo_max": 5}
    r = Ritmo.de_payload(dto)
    assert r.modo_refrao() is False
