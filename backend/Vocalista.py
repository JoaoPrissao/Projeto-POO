from musico import Musico

CUSTO_FOLEGO = 10
DANO_BASE_MINIMO = 5


class Vocalista(Musico):
    TIPO = "vocalista"

    def __init__(self, nome: str, nivel: int = 1, hp_maximo: int = 80,
                 xp: int = 0, folego: int = 50, inteligencia: int = 10):
        super().__init__(nome, nivel, hp_maximo, xp)
        self.__folego       = folego
        self.__inteligencia = inteligencia

    def get_folego(self) -> int:
        return self.__folego

    def get_inteligencia(self) -> int:
        return self.__inteligencia

    def restaurar_folego(self, quantidade: int) -> None:
        if quantidade > 0:
            self.__folego += quantidade
            print(f"  {self._nome} recuperou {quantidade} de fôlego. Fôlego: {self.__folego}")

    def to_dict(self) -> dict:
        dados = super().to_dict()
        dados["folego"]      = self.__folego
        dados["inteligencia"] = self.__inteligencia
        return dados

    def exibir_status(self) -> None:
        super().exibir_status()
        print(f"  Fôlego     : {self.__folego}")
        print(f"  Inteligência: {self.__inteligencia}")
        print("========================================")

    def atacar(self) -> int:
        intel = self.__inteligencia + self.bonus_equipamento("inteligencia")  # F3.6
        if self.__folego >= CUSTO_FOLEGO:
            self.__folego -= CUSTO_FOLEGO
            dano = int(intel * 2.0)
            print(f"  {self._nome} solta a voz! Dano base: {dano} (fôlego: {self.__folego})")
        else:
            dano = DANO_BASE_MINIMO
            print(f"  {self._nome} sem fôlego, ataque fraco! Dano base: {dano}")
        return dano
