"""Campanha — estado autoritativo do modo história (a turnê da banda).

Detém a sequência de venues (cada uma com a capanga que se enfrenta lá), os
itens espalhados pelo mapa, e o progresso: quais venues já foram vencidas, quais
itens já foram pegos e onde a banda parou no overworld. É serializável (to_dict/
from_dict) pra entrar no envelope de save e a história ser retomada no load.

As definições (venues/itens) são dados, não objetos de domínio: a capanga é só
`{nome, hp, dano}` que a API usa pra montar um `Empresario`; o item é `{tipo}`
que a API passa pra `ItemFactory`. Assim a Campanha não acopla show nem itens.
"""
from excecoes import VenueInvalidaError, ItemMapaInvalidoError


# Turnê padrão — espelha a campanha provisória que vivia no main.js (F3.2).
_VENUES_PADRAO = [
    {"id": "bar",   "x": 420,  "nome": "Bar do Zé",
     "capanga": {"nome": "Capanga do Bar", "hp": 60, "dano": 8}},
    {"id": "feira", "x": 980,  "nome": "Feira Punk",
     "capanga": {"nome": "Roadie Valentão", "hp": 95, "dano": 12}},
    {"id": "arena", "x": 1600, "nome": "Arena — O Empresário",
     "capanga": {"nome": "O Empresário", "hp": 200, "dano": 20}},
]
_ITENS_PADRAO = [
    {"id": "i1", "x": 250,  "tipo": "energetico"},
    {"id": "i2", "x": 1280, "tipo": "pedal"},
]
POSICAO_INICIAL = 60.0


class Campanha:
    def __init__(self, venues, itens, posicao=POSICAO_INICIAL,
                 concluidas=None, coletados=None):
        # Cópias defensivas das definições (não compartilha listas/dicts externos).
        self._venues = [dict(v) for v in venues]
        self._itens = [dict(i) for i in itens]
        self._concluidas = set(concluidas or ())
        self._coletados = set(coletados or ())
        self._posicao = float(posicao)

    @classmethod
    def padrao(cls) -> "Campanha":
        return cls(_VENUES_PADRAO, _ITENS_PADRAO)

    # ── Consulta (defs + flags de progresso) ─────────────────────────

    def listar_venues(self) -> list:
        return [{**v, "concluida": v["id"] in self._concluidas} for v in self._venues]

    def listar_itens(self) -> list:
        return [{**i, "coletado": i["id"] in self._coletados} for i in self._itens]

    def get_venue(self, venue_id: str) -> dict:
        for v in self._venues:
            if v["id"] == venue_id:
                return {**v, "concluida": venue_id in self._concluidas}
        raise VenueInvalidaError(venue_id)

    def get_item(self, item_id: str) -> dict:
        for i in self._itens:
            if i["id"] == item_id:
                return {**i, "coletado": item_id in self._coletados}
        raise ItemMapaInvalidoError(item_id)

    # ── Mutação de progresso ─────────────────────────────────────────

    def concluir(self, venue_id: str) -> None:
        self.get_venue(venue_id)            # valida (→ VenueInvalidaError)
        self._concluidas.add(venue_id)

    def coletar(self, item_id: str) -> str:
        """Marca o item como pego e devolve seu `tipo` (pra ItemFactory)."""
        item = self.get_item(item_id)       # valida (→ ItemMapaInvalidoError)
        self._coletados.add(item_id)
        return item["tipo"]

    def set_posicao(self, x: float) -> None:
        self._posicao = float(x)

    def get_posicao(self) -> float:
        return self._posicao

    def esta_completa(self) -> bool:
        return all(v["id"] in self._concluidas for v in self._venues)

    # ── (de)serialização ─────────────────────────────────────────────

    def to_dict(self) -> dict:
        return {
            "venues": [dict(v) for v in self._venues],
            "itens": [dict(i) for i in self._itens],
            "concluidas": sorted(self._concluidas),
            "coletados": sorted(self._coletados),
            "posicao": self._posicao,
        }

    @classmethod
    def from_dict(cls, dados: dict) -> "Campanha":
        return cls(
            venues=dados["venues"],
            itens=dados["itens"],
            posicao=dados.get("posicao", POSICAO_INICIAL),
            concluidas=dados.get("concluidas", ()),
            coletados=dados.get("coletados", ()),
        )
