# -*- coding: utf-8 -*-
import sys

from jogador import Jogador
from Guerreiro import Guerreiro
from Mago import Mago, CUSTO_MANA, DANO_BASE_MINIMO
from Ladrao import Ladrao
from Paladino import Paladino
from excecoes import ManaInsuficienteError, JogadorMortoError

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


if __name__ == "__main__":

    # ── Criação dos personagens ───────────────────────────────────
    print("── Criando personagens ──────────────────────────")
    guerreiro = Guerreiro("Aldric",  nivel=5, hp_maximo=150, forca=20)
    mago      = Mago("Selene",       nivel=3, hp_maximo=80,  inteligencia=15, mana=60)
    ladrao    = Ladrao("Kael",       nivel=4, hp_maximo=110, agilidade=12, chance_critico=0.4)
    paladino  = Paladino("Arthur",   nivel=4, hp_maximo=130, forca=18, fe=20)

    alvo = Guerreiro("Boneco de Treino", hp_maximo=500, forca=1)

    # ── Status inicial ────────────────────────────────────────────
    print("\n── Status inicial ───────────────────────────────")
    for j in [guerreiro, mago, ladrao, paladino]:
        j.exibir_status()

    # ── Demonstração de polimorfismo dinâmico ─────────────────────
    # list[Jogador] armazena 4 tipos distintos — o tipo real só é
    # resolvido em tempo de execução (late binding / polimorfismo dinâmico)
    print("\n── Rodada de combate (polimorfismo dinâmico) ────")
    jogadores: list[Jogador] = [guerreiro, mago, ladrao, paladino]

    for jogador in jogadores:
        try:
            jogador.atacar(alvo)
        except ManaInsuficienteError as e:
            print(f"  [EXCEÇÃO capturada] {e}")
            print(f"  {jogador.get_nome()} usa ataque físico fraco. Dano: {DANO_BASE_MINIMO}")
            alvo.receber_dano(DANO_BASE_MINIMO)

    # ── Status do alvo após o combate ─────────────────────────────
    print("\n── Status do alvo após o combate ────────────────")
    alvo.exibir_status()

    # ── Demonstração de JogadorMortoError ────────────────────────
    print("\n── Demonstração de JogadorMortoError ────────────")
    cobaia = Guerreiro("Cobaia", hp_maximo=1)
    cobaia.receber_dano(1)
    try:
        cobaia.receber_dano(10)
    except JogadorMortoError as e:
        print(f"  [EXCEÇÃO capturada] {e}")

    # ── Demonstração de ManaInsuficienteError ─────────────────────
    print("\n── Demonstração de ManaInsuficienteError ────────")
    mago_sem_mana = Mago("Merlin Broke", mana=0, inteligencia=10)
    try:
        mago_sem_mana.atacar(alvo)
    except ManaInsuficienteError as e:
        print(f"  [EXCEÇÃO capturada] {e}")
