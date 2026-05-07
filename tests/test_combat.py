import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pytest
from jogador import Jogador

def test_jogador_e_abstrata():
    with pytest.raises(TypeError):
        Jogador("Teste")
