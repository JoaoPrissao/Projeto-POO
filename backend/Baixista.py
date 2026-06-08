from Guitarrista import Guitarrista
from musico import Musico


class Baixista(Guitarrista):
    TIPO = "baixista"

    def __init__(self, nome: str, nivel: int = 1, hp_maximo: int = 130,
                 xp: int = 0, forca: int = 15, fe: int = 20, ego: int = 0):
        super().__init__(nome, nivel, hp_maximo, xp, forca, ego=ego)
        self.__fe = fe

    def get_fe(self) -> int:
        return self.__fe

    def to_dict(self) -> dict:
        dados = super().to_dict()   # inclui tipo="baixista", forca e ego (Guitarrista)
        dados["fe"] = self.__fe
        return dados

    def exibir_status(self) -> None:
        Musico.exibir_status(self)
        print(f"  Força      : {self.get_forca()}")
        print(f"  Groove     : {self.__fe}")
        print("========================================")

    def atacar(self) -> int:
        dano = int(self.get_forca() * 1.5)
        if self.__fe >= 5:
            self.__fe -= 5
            cura = int(dano * 0.5)
            print(f"  {self._nome} groove sagrado! Dano base: {dano} | Cura: {cura} (groove: {self.__fe})")
            self.curar(cura)
        else:
            print(f"  {self._nome} ataca sem groove. Dano base: {dano}")
        return dano
