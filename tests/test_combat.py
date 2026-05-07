import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pytest
from jogador import Jogador
from Guerreiro import Guerreiro
from Mago import Mago
from Ladrao import Ladrao

def test_jogador_e_abstrata():
    with pytest.raises(TypeError):
        Jogador("Teste")

def test_guerreiro_dano_fixo():
    g = Guerreiro("Aldric", forca=10)
    alvo = Guerreiro("Dummy", forca=1)
    hp_antes = alvo.get_hp()
    g.atacar(alvo)
    assert alvo.get_hp() == hp_antes - 15  # int(10 * 1.5) = 15

def test_guerreiro_herda_jogador():
    g = Guerreiro("Aldric")
    assert isinstance(g, Jogador)

def test_mago_dano_magico_com_mana():
    m = Mago("Selene", inteligencia=10, mana=50)
    alvo = Guerreiro("Dummy")
    hp_antes = alvo.get_hp()
    m.atacar(alvo)
    assert alvo.get_hp() == hp_antes - 20   # int(10 * 2.0) = 20
    assert m.get_mana() == 40               # consumiu 10 de mana

def test_mago_dano_minimo_sem_mana():
    m = Mago("Selene", inteligencia=10, mana=5)  # mana insuficiente
    alvo = Guerreiro("Dummy")
    hp_antes = alvo.get_hp()
    m.atacar(alvo)
    assert alvo.get_hp() == hp_antes - 5    # dano base mínimo = 5

def test_ladrao_dano_normal_sem_critico():
    l = Ladrao("Kael", agilidade=10, chance_critico=0.0)  # nunca critico
    alvo = Guerreiro("Dummy")
    hp_antes = alvo.get_hp()
    l.atacar(alvo)
    assert alvo.get_hp() == hp_antes - 10  # int(10 * 1.0) = 10

def test_ladrao_dano_critico():
    l = Ladrao("Kael", agilidade=10, chance_critico=1.0)  # sempre critico
    alvo = Guerreiro("Dummy")
    hp_antes = alvo.get_hp()
    l.atacar(alvo)
    assert alvo.get_hp() == hp_antes - 30  # int(10 * 3.0) = 30
