class JogoError(Exception):
    pass


class JogadorMortoError(JogoError):
    def __init__(self, nome: str):
        super().__init__(f"{nome} está nocauteado e não pode realizar esta ação.")


class ManaInsuficienteError(JogoError):
    def __init__(self, nome: str, mana_atual: int, custo: int):
        super().__init__(
            f"{nome} não tem fôlego suficiente (tem {mana_atual}, precisa de {custo})."
        )


class AtaqueInvalidoError(JogoError):
    def __init__(self, dano: int):
        super().__init__(f"Valor de dano inválido: {dano}. Deve ser maior que zero.")


# ── Inventário ────────────────────────────────────────────────────

class InventarioError(JogoError):
    pass


class InventarioCheioError(InventarioError):
    pass


class ItemNaoEncontradoError(InventarioError):
    pass


class ItemIncompativelError(InventarioError):
    pass


# ── Persistência ──────────────────────────────────────────────────

class PersistenciaError(JogoError):
    pass


class SaveNaoEncontradoError(PersistenciaError):
    pass


class SaveCorrompidoError(PersistenciaError):
    pass


# ── Fábricas ──────────────────────────────────────────────────────

class TipoInvalidoError(JogoError):
    def __init__(self, tipo: str):
        super().__init__(f"Tipo de músico inválido: '{tipo}'.")
