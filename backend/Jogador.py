class Jogador:
    def __init__(self, nome: str, nivel: int = 1, hp_maximo: int = 100):
        self.__nome      = nome
        self.__nivel     = nivel
        self.__hp_maximo = hp_maximo
        self.__hp        = hp_maximo

    # ── Getters ───────────────────────────────────────────────────

    def get_nome(self) -> str:
        return self.__nome

    def get_nivel(self) -> int:
        return self.__nivel

    def get_hp(self) -> int:
        return self.__hp

    def get_hp_maximo(self) -> int:
        return self.__hp_maximo

    # ── Setters ───────────────────────────────────────────────────

    def set_nome(self, nome: str) -> None:
        if not nome.strip():
            print("  [ERRO] Nome não pode ser vazio.")
            return
        self.__nome = nome
        print(f"  Nome alterado para: {self.__nome}")

    def set_nivel(self, nivel: int) -> None:
        if nivel < 1:
            print("  [ERRO] Nível deve ser no mínimo 1.")
            return
        self.__nivel = nivel
        print(f"  {self.__nome} agora é nível {self.__nivel}.")

    def set_hp_maximo(self, hp_maximo: int) -> None:
        if hp_maximo <= 0:
            print("  [ERRO] HP máximo deve ser maior que zero.")
            return
        self.__hp_maximo = hp_maximo
        if self.__hp > self.__hp_maximo:
            self.__hp = self.__hp_maximo
        print(f"  HP máximo de {self.__nome} ajustado para {self.__hp_maximo}.")

    # ── Métodos ───────────────────────────────────────────────────

    def exibir_status(self) -> None:
        print("========================================")
        print(f"  Nome       : {self.__nome}")
        print(f"  Nível      : {self.__nivel}")
        print(f"  HP         : {self.__hp}/{self.__hp_maximo}")
        print(f"  Vivo       : {'Sim' if self.esta_vivo() else 'Não'}")
        print("========================================")

    def esta_vivo(self) -> bool:
        return self.__hp > 0

    def receber_dano(self, dano: int) -> None:
        if dano <= 0:
            print("  [ERRO] Dano deve ser maior que zero.")
            return
        if not self.esta_vivo():
            print(f"  {self.__nome} já está morto e não pode receber dano.")
            return
        self.__hp -= dano
        if self.__hp < 0:
            self.__hp = 0
        print(f"  {self.__nome} recebeu {dano} de dano. HP: {self.__hp}/{self.__hp_maximo}")
        if not self.esta_vivo():
            print(f"  {self.__nome} foi derrotado!")

    def curar(self, cura: int) -> None:
        if cura <= 0:
            print("  [ERRO] Cura deve ser maior que zero.")
            return
        if not self.esta_vivo():
            print(f"  {self.__nome} está morto e não pode ser curado.")
            return
        self.__hp += cura
        if self.__hp > self.__hp_maximo:
            self.__hp = self.__hp_maximo
        print(f"  {self.__nome} curou {cura} de HP. HP: {self.__hp}/{self.__hp_maximo}")

    def subir_nivel(self) -> None:
        self.__nivel += 1
        bonus_hp = 10
        self.__hp_maximo += bonus_hp
        self.__hp += bonus_hp
        print(f"  {self.__nome} subiu para o nível {self.__nivel}! "
              f"HP máximo: {self.__hp_maximo} (+{bonus_hp})")


# ── Função principal ──────────────────────────────────────────────

if __name__ == "__main__":

    # criando jogadores
    print("── Criando jogadores ────────────────────────────")
    guerreiro = Jogador("Aldric", 5, 150)
    mago      = Jogador("Selene", 3, 80)
    ladino    = Jogador("Kael")

    # teste 1: exibir status
    print("\n── Teste 1: exibir_status() ──────────────────────")
    guerreiro.exibir_status()
    mago.exibir_status()
    ladino.exibir_status()

    # teste 2: getters
    print("\n── Teste 2: getters ─────────────────────────────")
    print(f"  guerreiro.get_nome()      → {guerreiro.get_nome()}")
    print(f"  guerreiro.get_nivel()     → {guerreiro.get_nivel()}")
    print(f"  guerreiro.get_hp()        → {guerreiro.get_hp()}")
    print(f"  guerreiro.get_hp_maximo() → {guerreiro.get_hp_maximo()}")

    # teste 3: setters válidos
    print("\n── Teste 3: setters válidos ─────────────────────")
    ladino.set_nome("Kael, o Sombrio")
    ladino.set_nivel(4)
    ladino.set_hp_maximo(120)

    # teste 4: setters inválidos
    print("\n── Teste 4: setters inválidos ───────────────────")
    guerreiro.set_nome("   ")
    guerreiro.set_nivel(-3)
    guerreiro.set_hp_maximo(0)

    # teste 5: encapsulamento — acesso direto bloqueado
    print("\n── Teste 5: encapsulamento ──────────────────────")
    try:
        print(guerreiro.__hp)
    except AttributeError as e:
        print(f"  Acesso direto a __hp bloqueado: {e}")

    try:
        guerreiro.__hp = -999
        # o Python cria um atributo NOVO em vez de acessar o privado
        # mas o HP real continua protegido
        print(f"  guerreiro.__hp atribuído = {guerreiro.__hp}")
        print(f"  HP real (via getter)     = {guerreiro.get_hp()}")
        print(f"  O atributo privado NÃO foi alterado!")
    except AttributeError as e:
        print(f"  Acesso direto bloqueado: {e}")

    # teste 6: receber dano
    print("\n── Teste 6: receber_dano() ──────────────────────")
    guerreiro.receber_dano(40)
    mago.receber_dano(30)

    # teste 7: curar
    print("\n── Teste 7: curar() ─────────────────────────────")
    guerreiro.curar(20)
    mago.curar(200)  # não ultrapassa hp_maximo

    # teste 8: subir de nível
    print("\n── Teste 8: subir_nivel() ───────────────────────")
    guerreiro.subir_nivel()
    guerreiro.subir_nivel()

    # teste 9: dano letal + ações em morto
    print("\n── Teste 9: dano letal + ações em morto ─────────")
    mago.receber_dano(999)
    mago.receber_dano(10)
    mago.curar(50)

    # teste 10: status final
    print("\n── Teste 10: status final ───────────────────────")
    guerreiro.exibir_status()
    mago.exibir_status()
    ladino.exibir_status()