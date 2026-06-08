from jogador import Jogador

CUSTO_MANA = 10
DANO_BASE_MINIMO = 5


class Mago(Jogador):
    TIPO = "mago"

    def __init__(self, nome: str, nivel: int = 1, hp_maximo: int = 80,
                 xp: int = 0, mana: int = 50, inteligencia: int = 10):
        super().__init__(nome, nivel, hp_maximo, xp)
        self.__mana         = mana
        self.__inteligencia = inteligencia

    def get_mana(self) -> int:
        return self.__mana

    def get_inteligencia(self) -> int:
        return self.__inteligencia

    def restaurar_mana(self, quantidade: int) -> None:
        if quantidade > 0:
            self.__mana += quantidade
            print(f"  {self._nome} restaurou {quantidade} de mana. Mana: {self.__mana}")

    def to_dict(self) -> dict:
        dados = super().to_dict()
        dados["mana"] = self.__mana
        dados["inteligencia"] = self.__inteligencia
        return dados

    def exibir_status(self) -> None:
        super().exibir_status()
        print(f"  Mana       : {self.__mana}")
        print(f"  Inteligência: {self.__inteligencia}")
        print("========================================")

    def atacar(self, alvo: Jogador) -> None:
        if self.__mana >= CUSTO_MANA:
            self.__mana -= CUSTO_MANA
            dano = int(self.__inteligencia * 2.0)
            print(f"  {self._nome} conjura magia! Dano: {dano} (mana: {self.__mana})")
        else:
            dano = DANO_BASE_MINIMO
            print(f"  {self._nome} sem mana, ataque fraco! Dano: {dano}")
        alvo.receber_dano(dano)
