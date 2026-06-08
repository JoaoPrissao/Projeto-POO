from Guerreiro import Guerreiro
from jogador import Jogador


class Paladino(Guerreiro):
    TIPO = "paladino"

    def __init__(self, nome: str, nivel: int = 1, hp_maximo: int = 130,
                 xp: int = 0, forca: int = 15, fe: int = 20):
        super().__init__(nome, nivel, hp_maximo, xp, forca)
        self.__fe = fe

    def get_fe(self) -> int:
        return self.__fe

    def to_dict(self) -> dict:
        dados = super().to_dict()   # inclui tipo="paladino" e forca (Guerreiro)
        dados["fe"] = self.__fe
        return dados

    def exibir_status(self) -> None:
        Jogador.exibir_status(self)
        print(f"  Força      : {self.get_forca()}")
        print(f"  Fé         : {self.__fe}")
        print("========================================")

    def atacar(self, alvo: Jogador) -> None:
        dano = int(self.get_forca() * 1.5)
        if self.__fe >= 5:
            self.__fe -= 5
            cura = int(dano * 0.5)
            print(f"  {self._nome} golpe sagrado! Dano: {dano} | Cura: {cura} (fé: {self.__fe})")
            alvo.receber_dano(dano)
            self.curar(cura)
        else:
            print(f"  {self._nome} ataca sem fé. Dano: {dano}")
            alvo.receber_dano(dano)
