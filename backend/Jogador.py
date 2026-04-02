class Jogador:
    def __init__(self, nome: str, nivel: int = 1, hp_maximo: int = 100):
        self.nome      = nome
        self.nivel     = nivel
        self.hp_maximo = hp_maximo
        self.hp        = hp_maximo

    def exibir_status(self) -> None:
        print("========================================")
        print(f"  Nome       : {self.nome}")
        print(f"  Nível      : {self.nivel}")
        print(f"  HP         : {self.hp}/{self.hp_maximo}")
        print(f"  Vivo       : {'Sim' if self.esta_vivo() else 'Não'}")
        print("========================================")

    def esta_vivo(self) -> bool:
        return self.hp > 0

    def receber_dano(self, dano: int) -> None:
        if dano <= 0:
            print(f"  [ERRO] Dano deve ser maior que zero.")
            return
        if not self.esta_vivo():
            print(f"  {self.nome} já está morto e não pode receber dano.")
            return
        self.hp -= dano
        if self.hp < 0:
            self.hp = 0
        print(f"  {self.nome} recebeu {dano} de dano. HP: {self.hp}/{self.hp_maximo}")
        if not self.esta_vivo():
            print(f"  {self.nome} foi derrotado!")

    def curar(self, cura: int) -> None:
        if cura <= 0:
            print(f"  [ERRO] Cura deve ser maior que zero.")
            return
        if not self.esta_vivo():
            print(f"  {self.nome} está morto e não pode ser curado.")
            return
        self.hp += cura
        if self.hp > self.hp_maximo:
            self.hp = self.hp_maximo
        print(f"  {self.nome} curou {cura} de HP. HP: {self.hp}/{self.hp_maximo}")


# ── Função principal ──────────────────────────────────────────────

if __name__ == "__main__":

    # criando jogadores
    print("── Criando jogadores ────────────────────────────")
    guerreiro = Jogador("Aldric", 5, 150)
    mago      = Jogador("Selene", 3, 80)
    ladino    = Jogador("Kael")  # usa valores padrão: nível 1, HP 100

    # teste 1: exibir status
    print("\n── Teste 1: exibir_status() ──────────────────────")
    guerreiro.exibir_status()
    mago.exibir_status()
    ladino.exibir_status()

    # teste 2: receber dano
    print("\n── Teste 2: receber_dano() ──────────────────────")
    guerreiro.receber_dano(40)
    mago.receber_dano(30)
    ladino.receber_dano(10)

    # teste 3: curar
    print("\n── Teste 3: curar() ─────────────────────────────")
    guerreiro.curar(20)
    mago.curar(50)       # não deve ultrapassar hp_maximo
    ladino.curar(5)

    # teste 4: dano letal
    print("\n── Teste 4: dano letal ──────────────────────────")
    mago.receber_dano(200)   # mais dano que HP restante
    mago.exibir_status()

    # teste 5: ações em jogador morto
    print("\n── Teste 5: ações em jogador morto ──────────────")
    mago.receber_dano(10)    # já está morto
    mago.curar(50)           # não pode curar morto

    # teste 6: valores inválidos
    print("\n── Teste 6: valores inválidos ───────────────────")
    guerreiro.receber_dano(-5)
    guerreiro.curar(0)

    # teste 7: esta_vivo()
    print("\n── Teste 7: esta_vivo() ─────────────────────────")
    print(f"  {guerreiro.nome} vivo? {guerreiro.esta_vivo()}")
    print(f"  {mago.nome} vivo?      {mago.esta_vivo()}")

    # teste 8: status final
    print("\n── Teste 8: status final ────────────────────────")
    guerreiro.exibir_status()
    mago.exibir_status()
    ladino.exibir_status()