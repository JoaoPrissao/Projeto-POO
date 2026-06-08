# -*- coding: utf-8 -*-
import sys

from jogador import Jogador
from Guerreiro import Guerreiro
from Mago import Mago, CUSTO_MANA, DANO_BASE_MINIMO
from Ladrao import Ladrao
from Paladino import Paladino
from gerenciador import GerenciadorJogo
from show import Show, Inimigo
from excecoes import ManaInsuficienteError, JogadorMortoError, JogoError

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def demo_polimorfismo():
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


def jogar():
    print("\n" + "=" * 50)
    print("  BEM-VINDO AO SHOW!")
    print("=" * 50)

    GerenciadorJogo.resetar()
    gerenciador = GerenciadorJogo.get_instancia()
    gerenciador.criar_banda([
        {"tipo": "guerreiro", "nome": "Aldric", "forca": 15},
        {"tipo": "mago",      "nome": "Selene", "mana": 50, "inteligencia": 12},
        {"tipo": "ladrao",    "nome": "Kael",   "agilidade": 10, "chance_critico": 0.3},
    ])
    banda = gerenciador.listar_jogadores()
    inimigo = Inimigo("O Empresário", hp=120, dano=18)

    show = Show(banda, inimigo)

    print(f"\nBanda vs {inimigo.get_nome()} (HP: {inimigo.get_hp()})")
    print("-" * 50)

    turno = 1
    while True:
        print(f"\n=== TURNO {turno} ===")

        # Exibe status da banda
        print("Banda:")
        for i, musico in enumerate(banda):
            status = "vivo" if musico.esta_vivo() else "NOCAUTEADO"
            print(f"  [{i}] {musico.get_nome()} — HP: {musico.get_hp()} ({status})")
        print(f"Inimigo: {inimigo.get_nome()} — HP: {inimigo.get_hp()}")

        vivos_idx = [i for i, j in enumerate(banda) if j.esta_vivo()]
        if not vivos_idx:
            print("\n  Toda a banda foi nocauteada. DERROTA!")
            break

        # Escolha do músico
        print(f"\nEscolha quem ataca {[str(i) for i in vivos_idx]}: ", end="")
        try:
            escolha = int(input())
            if escolha not in vivos_idx:
                print("  Escolha inválida — tente novamente.")
                continue

            resultado = show.acao_musico(escolha)
            print(f"  {resultado['atacante']} causou {resultado['dano']} de dano! "
                  f"HP do inimigo: {resultado['hp_inimigo']}")

            if resultado["fim"] == "vitoria":
                print("\n  O inimigo foi derrotado. VITÓRIA!")
                break

        except JogoError as e:
            print(f"  [ERRO] {e}")
            continue
        except ValueError:
            print("  Entrada inválida.")
            continue

        # Turno do inimigo
        resultado = show.turno_inimigo()
        if resultado["alvo"]:
            print(f"  {resultado['atacante']} ataca {resultado['alvo']}! "
                  f"Dano: {resultado['dano']} — HP restante: {resultado['hp_alvo']}")
        if resultado["fim"] == "derrota":
            print("\n  Toda a banda foi nocauteada. DERROTA!")
            break

        turno += 1


if __name__ == "__main__":
    demo_polimorfismo()
    jogar()
