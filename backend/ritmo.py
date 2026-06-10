class Ritmo:
    """Resultado de uma rodada de ritmo + política de multiplicador (D4).

    Recebe contagem crua do frontend; o multiplicador é calculado aqui no
    domínio — o front não pode mandar um multiplicador pré-pronto.
    """

    LIMIAR_REFRAO: float = 0.90
    COMBO_FATOR: float   = 0.1
    MULTIPLICADOR_TETO: float = 2.0

    def __init__(self, acertos: int, total_notas: int, combo_max: int):
        if total_notas <= 0:
            raise ValueError("total_notas deve ser maior que zero.")
        self._acertos    = acertos
        self._total_notas = total_notas
        self._combo_max  = combo_max

    @property
    def precisao(self) -> float:
        return self._acertos / self._total_notas

    def multiplicador(self) -> float:
        valor = 1.0 + self._combo_max * self.COMBO_FATOR
        return min(valor, self.MULTIPLICADOR_TETO)

    def modo_refrao(self) -> bool:
        return self.precisao >= self.LIMIAR_REFRAO

    def perfeito(self) -> bool:
        """Acertou TODAS as notas — gatilho de atordoamento do vilão (F3.4)."""
        return self._acertos >= self._total_notas

    @classmethod
    def de_payload(cls, dto: dict) -> "Ritmo":
        return cls(
            acertos=dto["acertos"],
            total_notas=dto["total_notas"],
            combo_max=dto["combo_max"],
        )
