from musico import Musico


class Guitarrista(Musico):
    TIPO = "guitarrista"
    EGO_BONUS_POR_ATAQUE = 5
    EGO_MAX = 50

    def __init__(self, nome: str, nivel: int = 1, hp_maximo: int = 100,
                 xp: int = 0, forca: int = 10, ego: int = 0):
        super().__init__(nome, nivel, hp_maximo, xp)
        self.__forca = forca
        self.__ego   = ego

    def get_forca(self) -> int:
        return self.__forca

    def get_ego(self) -> int:
        return self.__ego

    def aumentar_forca(self, quantidade: int) -> None:
        if quantidade > 0:
            self.__forca += quantidade
            print(f"  {self._nome} ganhou +{quantidade} de força. Força: {self.__forca}")

    def to_dict(self) -> dict:
        dados = super().to_dict()
        dados["forca"] = self.__forca
        dados["ego"]   = self.__ego
        return dados

    def exibir_status(self) -> None:
        super().exibir_status()
        print(f"  Força      : {self.__forca}")
        print(f"  Ego        : {self.__ego}/{self.EGO_MAX}")
        print("========================================")

    def atacar(self) -> int:
        dano = int(self.__forca * 1.5)
        self.__ego = min(self.__ego + self.EGO_BONUS_POR_ATAQUE, self.EGO_MAX)
        print(f"  {self._nome} rasga no palco! Dano base: {dano} (ego: {self.__ego})")
        return dano
