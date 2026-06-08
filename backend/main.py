# -*- coding: utf-8 -*-
import sys

from musico import Musico
from Guitarrista import Guitarrista
from Vocalista import Vocalista, CUSTO_FOLEGO, DANO_BASE_MINIMO
from Baterista import Baterista
from Baixista import Baixista
from gerenciador import GerenciadorJogo
from show import Show, Inimigo
from excecoes import ManaInsuficienteError, JogadorMortoError, JogoError

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def demo_polimorfismo():
    # ── Criação dos personagens ───────────────────────────────────
    print("── Criando músicos ──────────────────────────────")
    guitarrista = Guitarrista("Aldric",  nivel=5, hp_maximo=150, forca=20)
    vocalista   = Vocalista("Selene",    nivel=3, hp_maximo=80,  inteligencia=15, folego=60)
    baterista   = Baterista("Kael",      nivel=4, hp_maximo=110, agilidade=12, chance_critico=0.4)
    baixista    = Baixista("Arthur",     nivel=4, hp_maximo=130, forca=18, fe=20)

    alvo = Guitarrista("Boneco de Treino", hp_maximo=500, forca=1)

    # ── Status inicial ────────────────────────────────────────────
    print("\n── Status inicial ───────────────────────────────")
    for m in [guitarrista, vocalista, baterista, baixista]:
        m.exibir_status()

    # ── Demonstração de polimorfismo dinâmico ─────────────────────
    print("\n── Rodada de combate (polimorfismo dinâmico) ────")
    musicos: list[Musico] = [guitarrista, vocalista, baterista, baixista]

    for musico in musicos:
        try:
            musico.atacar(alvo)
        except ManaInsuficienteError as e:
            print(f"  [EXCEÇÃO capturada] {e}")
            print(f"  {musico.get_nome()} usa ataque físico fraco. Dano: {DANO_BASE_MINIMO}")
            alvo.receber_dano(DANO_BASE_MINIMO)

    # ── Status do alvo após o combate ─────────────────────────────
    print("\n── Status do alvo após o combate ────────────────")
    alvo.exibir_status()

    # ── Demonstração de JogadorMortoError ────────────────────────
    print("\n── Demonstração de JogadorMortoError ────────────")
    cobaia = Guitarrista("Cobaia", hp_maximo=1)
    cobaia.receber_dano(1)
    try:
        cobaia.receber_dano(10)
    except JogadorMortoError as e:
        print(f"  [EXCEÇÃO capturada] {e}")

    # ── Demonstração de ManaInsuficienteError ─────────────────────
    print("\n── Demonstração de ManaInsuficienteError ────────")
    vocalista_sem_folego = Vocalista("Merlin Broke", folego=0, inteligencia=10)
    try:
        vocalista_sem_folego.atacar(alvo)
    except ManaInsuficienteError as e:
        print(f"  [EXCEÇÃO capturada] {e}")


def jogar():
    print("\n" + "=" * 50)
    print("  BEM-VINDO AO SHOW!")
    print("=" * 50)

    GerenciadorJogo.resetar()
    gerenciador = GerenciadorJogo.get_instancia()
    gerenciador.criar_banda([
        {"tipo": "guitarrista", "nome": "Aldric", "forca": 15},
        {"tipo": "vocalista",   "nome": "Selene", "folego": 50, "inteligencia": 12},
        {"tipo": "baterista",   "nome": "Kael",   "agilidade": 10, "chance_critico": 0.3},
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
