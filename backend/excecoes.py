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


class SlotsOcupadosError(InventarioError):
    def __init__(self, nome_musico: str, slots: int):
        super().__init__(f"{nome_musico} já está com os {slots} slots de "
                         f"equipamento ocupados. Desequipe algo antes.")


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


# ── Combate (F3.4) ────────────────────────────────────────────────

class MoveInvalidoError(JogoError):
    def __init__(self, move_id):
        super().__init__(f"Golpe inválido ou indisponível: '{move_id}' "
                         f"(confira o equipamento do músico).")


class EspecialIndisponivelError(JogoError):
    def __init__(self):
        super().__init__("Golpe especial ainda não está disponível "
                         "(precisa de uma sequência de combos perfeitos).")


# ── Campanha (modo história) ──────────────────────────────────────

class CampanhaError(JogoError):
    pass


class VenueInvalidaError(CampanhaError):
    def __init__(self, venue_id):
        super().__init__(f"Venue inexistente na campanha: '{venue_id}'.")


class ItemMapaInvalidoError(CampanhaError):
    def __init__(self, item_id):
        super().__init__(f"Item de mapa inexistente na campanha: '{item_id}'.")


class VenueBloqueadaError(CampanhaError):
    def __init__(self, venue_id, segundos=None):
        extra = f" (faltam {segundos}s)" if segundos else ""
        super().__init__(f"A venue '{venue_id}' está bloqueada após a derrota{extra}.")
