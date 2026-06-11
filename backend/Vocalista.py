from musico import Musico


class Vocalista(Musico):
    TIPO = "vocalista"

    def __init__(self, nome: str, nivel: int = 1, hp_maximo: int = 80,
                 xp: int = 0, folego: int = None, inteligencia: int = 10):
        super().__init__(nome, nivel, hp_maximo, xp)
        # F3.8: o fôlego virou a ENERGIA unificada da classe base (todo músico
        # tem; os golpes consomem). `folego` segue aceito como alias de compat
        # pra saves/payloads antigos — vira a energia inicial.
        if folego is not None:
            self._energia = min(int(folego), self.ENERGIA_MAXIMA)
        self.__inteligencia = inteligencia

    def get_inteligencia(self) -> int:
        return self.__inteligencia

    def to_dict(self) -> dict:
        dados = super().to_dict()
        dados["inteligencia"] = self.__inteligencia
        return dados

    def exibir_status(self) -> None:
        super().exibir_status()
        print(f"  Energia    : {self._energia}")
        print(f"  Inteligência: {self.__inteligencia}")
        print("========================================")

    def atacar(self) -> int:
        # O custo do golpe agora é do MOVE (F3.8) — o dano base é determinístico.
        intel = self.__inteligencia + self.bonus_equipamento("inteligencia")  # F3.6
        dano = int(intel * 2.0)
        print(f"  {self._nome} solta a voz! Dano base: {dano}")
        return dano
