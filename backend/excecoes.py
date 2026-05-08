class JogoError(Exception):
    pass


class JogadorMortoError(JogoError):
    def __init__(self, nome: str):
        super().__init__(f"{nome} já está morto e não pode realizar esta ação.")


class ManaInsuficienteError(JogoError):
    def __init__(self, nome: str, mana_atual: int, custo: int):
        super().__init__(
            f"{nome} não tem mana suficiente (tem {mana_atual}, precisa de {custo})."
        )


class AtaqueInvalidoError(JogoError):
    def __init__(self, dano: int):
        super().__init__(f"Valor de dano inválido: {dano}. Deve ser maior que zero.")
