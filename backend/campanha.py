"""Campanha — estado autoritativo do modo história (a turnê da banda).

Detém a sequência de venues (cada uma com a capanga que se enfrenta lá), os
itens espalhados pelo mapa, e o progresso: quais venues já foram vencidas, quais
itens já foram pegos e onde a banda parou no overworld. É serializável (to_dict/
from_dict) pra entrar no envelope de save e a história ser retomada no load.

As definições (venues/itens) são dados, não objetos de domínio: a capanga é só
`{nome, hp, dano}` que a API usa pra montar um `Empresario`; o item é `{tipo}`
que a API passa pra `ItemFactory`. Assim a Campanha não acopla show nem itens.

F3.4 acrescenta a economia de fama: cada venue tem uma `fama` fixa (1..3) que
define a recompensa, a dificuldade e quanto tempo a venue fica BLOQUEADA se a
banda perder lá. A banda tem a sua própria fama (sobe ao vencer, cai ao perder),
que dá um pequeno multiplicador de dano. Tudo é serializável pra sobreviver ao
save/load — inclusive os bloqueios (guardados como timestamps absolutos).
"""
import math
import time

from excecoes import VenueInvalidaError, ItemMapaInvalidoError


# Turnê padrão — vilões progressivamente mais duros (exigem evoluir nível/itens).
# `fama`: nível da venue (recompensa/dificuldade/bloqueio). `xp_recompensa`: XP
# dado a cada membro ao vencer. `drop`: tipo de item (ItemFactory) que cai.
_VENUES_PADRAO = [
    {"id": "bar",   "x": 420,  "nome": "Bar do Zé",
     "fama": 1, "xp_recompensa": 70,  "cache_recompensa": 50,  "drop": "energetico",
     "capanga": {"nome": "Capanga do Bar", "hp": 180, "dano": 18}},
    {"id": "feira", "x": 980,  "nome": "Feira Punk",
     "fama": 2, "xp_recompensa": 130, "cache_recompensa": 120, "drop": "pedal",
     "capanga": {"nome": "Roadie Valentão", "hp": 340, "dano": 28}},
    {"id": "arena", "x": 1600, "nome": "Arena — O Empresário",
     "fama": 3, "xp_recompensa": 240, "cache_recompensa": 250, "drop": "amplificador",
     "capanga": {"nome": "O Empresário", "hp": 600, "dano": 40}},
]
_ITENS_PADRAO = [
    {"id": "i1", "x": 250,  "tipo": "energetico"},
    {"id": "i2", "x": 1280, "tipo": "pedal"},
]
# F3.8 — a loja é um PONTO do mapa (entre o bar e a feira): o jogador precisa
# ir até lá pra comprar. A van vira só armazenamento/equipamento.
_LOJA_PADRAO = {"x": 700.0}
POSICAO_INICIAL = 60.0

DURACAO_BASE_BLOQUEIO = 30      # segundos de bloqueio por nível de fama da venue
PENALIDADE_FAMA_DERROTA = 1     # fama que a banda perde ao ser nocauteada
BONUS_DANO_POR_FAMA = 0.02      # +2% de dano por ponto de fama da banda


class Campanha:
    def __init__(self, venues, itens, posicao=POSICAO_INICIAL,
                 concluidas=None, coletados=None, fama_banda=0, bloqueios=None,
                 cache=0, loja=None):
        # Cópias defensivas das definições (não compartilha listas/dicts externos).
        self._venues = [dict(v) for v in venues]
        self._itens = [dict(i) for i in itens]
        self._loja = dict(loja) if loja else dict(_LOJA_PADRAO)   # F3.8
        self._concluidas = set(concluidas or ())
        self._coletados = set(coletados or ())
        self._posicao = float(posicao)
        self._fama_banda = int(fama_banda)
        self._cache = int(cache)        # F3.7: dinheiro da banda (cachê por show)
        # venue_id -> timestamp (epoch) em que o bloqueio expira
        self._bloqueios = {k: float(v) for k, v in (bloqueios or {}).items()}

    @classmethod
    def padrao(cls) -> "Campanha":
        return cls(_VENUES_PADRAO, _ITENS_PADRAO)

    # ── Consulta (defs + flags de progresso) ─────────────────────────

    def listar_venues(self, agora=None) -> list:
        return [{**v,
                 "concluida": v["id"] in self._concluidas,
                 "bloqueada": self.venue_bloqueada(v["id"], agora),
                 "bloqueada_seg": self.segundos_bloqueio(v["id"], agora)}
                for v in self._venues]

    def listar_itens(self) -> list:
        return [{**i, "coletado": i["id"] in self._coletados} for i in self._itens]

    def get_loja(self) -> dict:
        """Ponto da loja no mapa (F3.8): `{"x": ...}` — o frontend desenha e
        só abre a compra com a banda perto."""
        return dict(self._loja)

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

    def get_recompensa(self, venue_id: str) -> dict:
        v = self.get_venue(venue_id)        # valida (→ VenueInvalidaError)
        return {"xp": v.get("xp_recompensa", 0), "drop": v.get("drop"),
                "cache": v.get("cache_recompensa", 0)}

    # ── Cachê (F3.7 — economia: dinheiro por show, gasto na loja) ────

    def get_cache(self) -> int:
        return self._cache

    def ganhar_cache(self, valor: int) -> None:
        self._cache += max(0, int(valor))

    def gastar_cache(self, valor: int) -> None:
        from excecoes import CacheInsuficienteError
        valor = max(0, int(valor))
        if valor > self._cache:
            raise CacheInsuficienteError(self._cache, valor)
        self._cache -= valor

    # ── Fama da banda ────────────────────────────────────────────────

    def fama_banda(self) -> int:
        return self._fama_banda

    def ganhar_fama(self, n: int) -> None:
        self._fama_banda += max(0, int(n))

    def perder_fama(self, n: int) -> None:
        self._fama_banda = max(0, self._fama_banda - max(0, int(n)))

    def mult_banda(self) -> float:
        """Multiplicador de dano derivado da fama (banda famosa bate mais forte;
        ao perder fama, fica mais fraca)."""
        return 1.0 + BONUS_DANO_POR_FAMA * self._fama_banda

    # ── Bloqueio de venue (cooldown após derrota) ────────────────────

    def _fama_venue(self, venue_id: str) -> int:
        return self.get_venue(venue_id).get("fama", 1)

    def _restante(self, venue_id: str, agora=None) -> float:
        agora = time.time() if agora is None else agora
        expira = self._bloqueios.get(venue_id)
        return max(0.0, expira - agora) if expira is not None else 0.0

    def bloquear_venue(self, venue_id: str, agora=None) -> float:
        """Bloqueia a venue por um tempo proporcional à fama dela. Devolve o
        timestamp de expiração. `agora` é injetável pra teste determinístico."""
        agora = time.time() if agora is None else agora
        expira = agora + DURACAO_BASE_BLOQUEIO * self._fama_venue(venue_id)
        self._bloqueios[venue_id] = expira
        return expira

    def venue_bloqueada(self, venue_id: str, agora=None) -> bool:
        return self._restante(venue_id, agora) > 0

    def segundos_bloqueio(self, venue_id: str, agora=None) -> int:
        return math.ceil(self._restante(venue_id, agora))

    def registrar_derrota(self, venue_id: str, agora=None) -> float:
        """Perdeu o show: bloqueia a venue (escala com a fama dela) e a banda
        perde fama (fica mais fraca). Devolve o timestamp de expiração."""
        expira = self.bloquear_venue(venue_id, agora)
        self.perder_fama(PENALIDADE_FAMA_DERROTA)
        return expira

    # ── Mutação de progresso ─────────────────────────────────────────

    def concluir(self, venue_id: str) -> None:
        self.get_venue(venue_id)            # valida (→ VenueInvalidaError)
        if venue_id not in self._concluidas:
            self._concluidas.add(venue_id)
            self.ganhar_fama(self._fama_venue(venue_id))  # vencer dá fama
        self._bloqueios.pop(venue_id, None)               # e limpa o bloqueio

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
            "fama_banda": self._fama_banda,
            "cache": self._cache,
            "bloqueios": dict(self._bloqueios),
            "loja": dict(self._loja),
        }

    @classmethod
    def from_dict(cls, dados: dict) -> "Campanha":
        return cls(
            venues=dados["venues"],
            itens=dados["itens"],
            posicao=dados.get("posicao", POSICAO_INICIAL),
            concluidas=dados.get("concluidas", ()),
            coletados=dados.get("coletados", ()),
            fama_banda=dados.get("fama_banda", 0),
            bloqueios=dados.get("bloqueios", {}),
            cache=dados.get("cache", 0),
            loja=dados.get("loja"),         # save antigo: None → loja padrão
        )
