class Jogador:
    XP_BASE = 100  # XP necessário por nível (multiplicado pelo nível atual)

    # ── Construtores ──────────────────────────────────────────────

    def __init__(self, nome: str, nivel: int = 1, hp_maximo: int = 100, xp: int = 0):
        self.__nome              = nome
        self.__nivel             = nivel
        self.__hp_maximo         = hp_maximo
        self.__hp                = hp_maximo
        self.__xp                = xp
        self.__xp_proximo_nivel  = nivel * self.XP_BASE
        print(f"  [+] Jogador '{self.__nome}' criado (nível {self.__nivel}).")

    @classmethod
    def iniciante(cls, nome: str) -> "Jogador":
        """Construtor alternativo: cria um jogador iniciante com stats padrão."""
        return cls(nome)

    @classmethod
    def do_save(cls, nome: str, nivel: int, hp_maximo: int, xp: int) -> "Jogador":
        """Construtor alternativo: restaura um jogador a partir de dados salvos."""
        return cls(nome, nivel, hp_maximo, xp)

    # ── Destrutor ─────────────────────────────────────────────────

    def __del__(self):
        print(f"  [-] Jogador '{self.__nome}' removido da memória.")

    # ── Getters ───────────────────────────────────────────────────

    def get_nome(self) -> str:
        return self.__nome

    def get_nivel(self) -> int:
        return self.__nivel

    def get_hp(self) -> int:
        return self.__hp

    def get_hp_maximo(self) -> int:
        return self.__hp_maximo

    def get_xp(self) -> int:
        return self.__xp

    def get_xp_proximo_nivel(self) -> int:
        return self.__xp_proximo_nivel

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
        print(f"  XP         : {self.__xp}/{self.__xp_proximo_nivel}")
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

    def ganhar_xp(self, quantidade: int) -> None:
        if quantidade <= 0:
            print("  [ERRO] XP deve ser maior que zero.")
            return
        self.__xp += quantidade
        print(f"  {self.__nome} ganhou {quantidade} XP. "
              f"XP: {self.__xp}/{self.__xp_proximo_nivel}")
        while self.__xp >= self.__xp_proximo_nivel:
            self.__xp -= self.__xp_proximo_nivel
            self.subir_nivel()

    def subir_nivel(self) -> None:
        self.__nivel += 1
        self.__xp_proximo_nivel = self.__nivel * self.XP_BASE
        bonus_hp = 10
        self.__hp_maximo += bonus_hp
        self.__hp = min(self.__hp + bonus_hp, self.__hp_maximo)
        print(f"  {self.__nome} subiu para o nível {self.__nivel}! "
              f"HP máximo: {self.__hp_maximo} (+{bonus_hp}) | "
              f"Próximo nível: {self.__xp_proximo_nivel} XP")


# ── Função principal ──────────────────────────────────────────────

if __name__ == "__main__":

    # criando jogadores com diferentes construtores
    print("── Criando jogadores ────────────────────────────")
    guerreiro = Jogador("Aldric", 5, 150)          # construtor principal
    mago      = Jogador("Selene", 3, 80)           # construtor principal
    ladino    = Jogador.iniciante("Kael")           # construtor alternativo: iniciante
    retornado = Jogador.do_save("Thorin", 7, 200, 450)  # construtor alternativo: do_save

    # teste 1: exibir status
    print("\n── Teste 1: exibir_status() ──────────────────────")
    guerreiro.exibir_status()
    mago.exibir_status()
    ladino.exibir_status()
    retornado.exibir_status()

    # teste 2: getters
    print("\n── Teste 2: getters ─────────────────────────────")
    print(f"  guerreiro.get_nome()             → {guerreiro.get_nome()}")
    print(f"  guerreiro.get_nivel()            → {guerreiro.get_nivel()}")
    print(f"  guerreiro.get_hp()               → {guerreiro.get_hp()}")
    print(f"  guerreiro.get_hp_maximo()        → {guerreiro.get_hp_maximo()}")
    print(f"  guerreiro.get_xp()               → {guerreiro.get_xp()}")
    print(f"  guerreiro.get_xp_proximo_nivel() → {guerreiro.get_xp_proximo_nivel()}")

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

    # teste 8: sistema de XP e subir de nível
    print("\n── Teste 8: ganhar_xp() e subir_nivel() ─────────")
    ladino.ganhar_xp(60)         # XP parcial
    ladino.ganhar_xp(50)         # passa de 100 → sobe de nível automaticamente
    ladino.ganhar_xp(250)        # XP suficiente para múltiplos níveis
    guerreiro.subir_nivel()      # subida manual (sem XP)
    ladino.ganhar_xp(-5)         # inválido

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
    retornado.exibir_status()

    # teste 11: destrutor — remoção de objeto da memória
    print("\n── Teste 11: destrutor (__del__) ────────────────")
    print("  Deletando 'mago' explicitamente...")
    del mago
    print("  (destrutor chamado acima)")