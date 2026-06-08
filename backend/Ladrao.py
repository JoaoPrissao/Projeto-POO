import random

from jogador import Jogador


class Ladrao(Jogador):
    TIPO = "ladrao"

    def __init__(self, nome: str, nivel: int = 1, hp_maximo: int = 90,
                 xp: int = 0, agilidade: int = 10, chance_critico: float = 0.3):
        super().__init__(nome, nivel, hp_maximo, xp)
        self.__agilidade      = agilidade
        self.__chance_critico = chance_critico

    def get_agilidade(self) -> int:
        return self.__agilidade

    def get_chance_critico(self) -> float:
        return self.__chance_critico

    def to_dict(self) -> dict:
        dados = super().to_dict()
        dados["agilidade"] = self.__agilidade
        dados["chance_critico"] = self.__chance_critico
        return dados

    def exibir_status(self) -> None:
        super().exibir_status()
        print(f"  Agilidade  : {self.__agilidade}")
        print(f"  Chance Crit: {int(self.__chance_critico * 100)}%")
        print("========================================")

    def atacar(self, alvo: Jogador) -> None:
        if random.random() < self.__chance_critico:
            dano = int(self.__agilidade * 3.0)
            print(f"  {self._nome} GOLPE CRÍTICO! Dano: {dano}")
        else:
            dano = int(self.__agilidade * 1.0)
            print(f"  {self._nome} ataca sorrateiro. Dano: {dano}")
        alvo.receber_dano(dano)
