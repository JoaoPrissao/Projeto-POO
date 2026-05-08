from jogador import Jogador
from excecoes import ManaInsuficienteError

CUSTO_MANA = 10
DANO_BASE_MINIMO = 5


class Mago(Jogador):

    def __init__(self, nome: str, nivel: int = 1, hp_maximo: int = 80,
                 xp: int = 0, mana: int = 50, inteligencia: int = 10):
        super().__init__(nome, nivel, hp_maximo, xp)
        self.__mana         = mana
        self.__inteligencia = inteligencia

    def get_mana(self) -> int:
        return self.__mana

    def get_inteligencia(self) -> int:
        return self.__inteligencia

    def exibir_status(self) -> None:
        super().exibir_status()
        print(f"  Mana       : {self.__mana}")
        print(f"  Inteligência: {self.__inteligencia}")
        print("========================================")

    def atacar(self, alvo: Jogador) -> None:
        if self.__mana < CUSTO_MANA:
            raise ManaInsuficienteError(self._nome, self.__mana, CUSTO_MANA)
        self.__mana -= CUSTO_MANA
        dano = int(self.__inteligencia * 2.0)
        print(f"  {self._nome} conjura magia! Dano: {dano} (mana: {self.__mana})")
        alvo.receber_dano(dano)
