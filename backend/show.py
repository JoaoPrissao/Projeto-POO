from excecoes import JogadorMortoError, AtaqueInvalidoError


class Inimigo:
    def __init__(self, nome: str, hp: int, dano: int):
        self._nome = nome
        self._hp = hp
        self._dano = dano

    def get_nome(self) -> str:
        return self._nome

    def get_hp(self) -> int:
        return self._hp

    def esta_vivo(self) -> bool:
        return self._hp > 0

    def receber_dano(self, dano: int) -> None:
        if dano <= 0:
            raise AtaqueInvalidoError(dano)
        if not self.esta_vivo():
            raise JogadorMortoError(self._nome)
        self._hp -= dano
        if self._hp < 0:
            self._hp = 0

    def atacar(self, alvo) -> None:
        alvo.receber_dano(self._dano)


class Show:
    def __init__(self, banda: list, inimigo: Inimigo):
        self._banda = banda
        self._inimigo = inimigo

    def acao_musico(self, indice: int) -> dict:
        musico = self._banda[indice]
        hp_antes = self._inimigo.get_hp()
        musico.atacar(self._inimigo)
        dano = hp_antes - self._inimigo.get_hp()
        return {
            "atacante": musico.get_nome(),
            "dano": dano,
            "hp_inimigo": self._inimigo.get_hp(),
            "fim": self.verificar_fim(),
        }

    def turno_inimigo(self) -> dict:
        vivos = [j for j in self._banda if j.esta_vivo()]
        if not vivos:
            return {
                "atacante": self._inimigo.get_nome(),
                "alvo": None,
                "dano": 0,
                "hp_alvo": 0,
                "fim": self.verificar_fim(),
            }
        alvo = vivos[0]
        hp_antes = alvo.get_hp()
        self._inimigo.atacar(alvo)
        dano = hp_antes - alvo.get_hp()
        return {
            "atacante": self._inimigo.get_nome(),
            "alvo": alvo.get_nome(),
            "dano": dano,
            "hp_alvo": alvo.get_hp(),
            "fim": self.verificar_fim(),
        }

    def verificar_fim(self) -> str | None:
        if not self._inimigo.esta_vivo():
            return "vitoria"
        if not any(j.esta_vivo() for j in self._banda):
            return "derrota"
        return None
