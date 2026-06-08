from jogador import Jogador


class Guerreiro(Jogador):
    TIPO = "guerreiro"

    def __init__(self, nome: str, nivel: int = 1, hp_maximo: int = 100,
                 xp: int = 0, forca: int = 10):
        super().__init__(nome, nivel, hp_maximo, xp)
        self.__forca = forca

    def get_forca(self) -> int:
        return self.__forca

    def aumentar_forca(self, quantidade: int) -> None:
        if quantidade > 0:
            self.__forca += quantidade
            print(f"  {self._nome} ganhou +{quantidade} de força. Força: {self.__forca}")

    def to_dict(self) -> dict:
        dados = super().to_dict()
        dados["forca"] = self.__forca
        return dados

    def exibir_status(self) -> None:
        super().exibir_status()
        print(f"  Força      : {self.__forca}")
        print("========================================")

    def atacar(self, alvo: Jogador) -> None:
        dano = int(self.__forca * 1.5)
        print(f"  {self._nome} ataca com força! Dano: {dano}")
        alvo.receber_dano(dano)
