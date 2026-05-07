# -*- coding: utf-8 -*-
import sys

from jogador import Jogador
from Guerreiro import Guerreiro
from Mago import Mago
from Ladrao import Ladrao

# Force UTF-8 output no Windows
if sys.platform == "win32":
    import io
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


if __name__ == "__main__":

    # ── Criação dos personagens ───────────────────────────────────
    print("── Criando personagens ──────────────────────────")
    guerreiro = Guerreiro("Aldric",  nivel=5, hp_maximo=150, forca=20)
    mago      = Mago("Selene",       nivel=3, hp_maximo=80,  inteligencia=15, mana=60)
    ladrao    = Ladrao("Kael",       nivel=4, hp_maximo=110, agilidade=12, chance_critico=0.4)

    alvo = Guerreiro("Boneco de Treino", hp_maximo=500, forca=1)

    # ── Status inicial ────────────────────────────────────────────
    print("\n── Status inicial ───────────────────────────────")
    for j in [guerreiro, mago, ladrao]:
        j.exibir_status()

    # ── Demonstração de polimorfismo ──────────────────────────────
    # list[Jogador] armazena tipos diferentes — o tipo real só é
    # resolvido em tempo de execução (late binding / polimorfismo dinâmico)
    print("\n── Rodada de combate (polimorfismo dinâmico) ────")
    jogadores: list[Jogador] = [guerreiro, mago, ladrao]

    for jogador in jogadores:
        jogador.atacar(alvo)  # chamada polimórfica: tipo real desconhecido aqui

    # ── Status do alvo após o combate ─────────────────────────────
    print("\n── Status do alvo após o combate ────────────────")
    alvo.exibir_status()
