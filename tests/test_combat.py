import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pytest
from jogador import Jogador
from Guerreiro import Guerreiro

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
