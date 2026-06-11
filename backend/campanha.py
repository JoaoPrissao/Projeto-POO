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

from excecoes import VenueInvalidaError, ItemMapaInvalidoError, NpcInvalidoError, BauInvalidoError, FamaInsuficienteError


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
# MAP-02 (Phase 1): NPCs espalhados entre/perto das venues.
# npc1 entre bar(420) e loja(700); npc2 entre feira(980) e arena(1600); npc3 apos arena.
_NPCS_PADRAO = [
    {"id": "npc1", "x": 560,  "nome": "Roadie Aposentado",
     "fala": "Saudades do estradao... Fica com essa bandana, vai precisar.",
     "item": "bandana_sortuda"},
    {"id": "npc2", "x": 1140, "nome": "Fa Fervoroso",
     "fala": "Autografo nao, mas essa palheta dourada pode ser sua!",
     "item": "palheta_de_ouro"},
    {"id": "npc3", "x": 1750, "nome": "Vendedor de Vinil",
     "fala": "Raríssimo! Pressagem original de 1973. So pra voce, cara.",
     "item": "vinil_raro"},
]
# F3.8 — a loja é um PONTO do mapa (entre o bar e a feira): o jogador precisa
# ir até lá pra comprar. A van vira só armazenamento/equipamento.
_LOJA_PADRAO = {"x": 700.0}
POSICAO_INICIAL = 60.0
# MAP-03 (Phase 1): 2 segredos/baús escondidos.
# bau1: à ESQUERDA do ponto inicial (D-10) — fora do caminho óbvio (x=20).
# bau2: DEPOIS da arena (D-11) — na margem do mundo, oculto por fama (x=1820).
_BAUS_PADRAO = [
    {"id": "bau1", "x": 20.0,   "item": "jaqueta_lendaria"},
    {"id": "bau2", "x": 1820.0, "item": "capa_de_lp", "fama_minima": 6},
]

DURACAO_BASE_BLOQUEIO = 30      # segundos de bloqueio por nível de fama da venue
PENALIDADE_FAMA_DERROTA = 1     # fama que a banda perde ao ser nocauteada
BONUS_DANO_POR_FAMA = 0.02      # +2% de dano por ponto de fama da banda


class Campanha:
    def __init__(self, venues, itens, posicao=POSICAO_INICIAL,
                 concluidas=None, coletados=None, fama_banda=0, bloqueios=None,
                 cache=0, loja=None, npcs=None, npcs_dados=None,
                 baus=None, baus_abertos=None):
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
        # MAP-02 (Phase 1): NPCs e progresso de entregas.
        self._npcs = [dict(n) for n in (npcs or _NPCS_PADRAO)]
        self._npcs_dados = set(npcs_dados or ())
        # MAP-03 (Phase 1): baús/segredos e progresso de aberturas.
        self._baus = [dict(b) for b in (baus or _BAUS_PADRAO)]
        self._baus_abertos = set(baus_abertos or ())

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

    def listar_npcs(self) -> list:
        """MAP-02: retorna os 3 NPCs com flag 'dado' indicando se já entregaram o item."""
        return [{**n, "dado": n["id"] in self._npcs_dados} for n in self._npcs]

    def get_npc(self, npc_id: str) -> dict:
        for n in self._npcs:
            if n["id"] == npc_id:
                return {**n, "dado": npc_id in self._npcs_dados}
        raise NpcInvalidoError(npc_id)

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

    def van_estagio(self) -> int:
        """Estágio visual da van derivado da fama atual (MAP-01 — Phase 1).

        Faixas: 1 = lata-velha (fama 0-2), 2 = decente (fama 3-5),
                3 = tunada (fama 6+). Regride se a fama cair (D-03).
        Derivado puro de _fama_banda — não é persistido no save."""
        f = self._fama_banda
        if f >= 6:
            return 3
        if f >= 3:
            return 2
        return 1

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

    def dar_item_npc(self, npc_id: str) -> str:
        """MAP-02: marca o NPC como 'já deu' e retorna o tipo do item (D-07 — entrega única)."""
        npc = self.get_npc(npc_id)          # valida (→ NpcInvalidoError)
        self._npcs_dados.add(npc_id)
        return npc["item"]

    def listar_baus(self) -> list:
        """MAP-03: retorna os 2 baús com flags aberto e revelado.
        revelado = sem fama_minima (ou 0) OU fama_banda >= fama_minima (D-11)."""
        def _revelado(bau):
            fm = bau.get("fama_minima", 0)
            return fm == 0 or self._fama_banda >= fm
        return [{**b, "aberto": b["id"] in self._baus_abertos, "revelado": _revelado(b)}
                for b in self._baus]

    def get_bau(self, bau_id: str) -> dict:
        for b in self._baus:
            if b["id"] == bau_id:
                fm = b.get("fama_minima", 0)
                return {**b, "aberto": bau_id in self._baus_abertos,
                        "revelado": fm == 0 or self._fama_banda >= fm}
        raise BauInvalidoError(bau_id)

    def abrir_bau(self, bau_id: str) -> str:
        """MAP-03: abre o baú; aplica gate de fama_minima (D-11). Retorna tipo do item."""
        bau = self.get_bau(bau_id)          # valida (→ BauInvalidoError)
        fama_min = bau.get("fama_minima", 0)
        if self._fama_banda < fama_min:
            raise FamaInsuficienteError(bau_id, fama_min, self._fama_banda)
        self._baus_abertos.add(bau_id)
        return bau["item"]

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
            # MAP-02 (Phase 1): NPCs e progresso de entregas.
            "npcs": [dict(n) for n in self._npcs],
            "npcs_dados": sorted(self._npcs_dados),
            # MAP-03 (Phase 1): baús e progresso de aberturas.
            "baus": [dict(b) for b in self._baus],
            "baus_abertos": sorted(self._baus_abertos),
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
            npcs=dados.get("npcs"),         # MAP-02: None → _NPCS_PADRAO
            npcs_dados=dados.get("npcs_dados", ()),  # MAP-02: save antigo → conjunto vazio
            baus=dados.get("baus"),         # MAP-03: None → _BAUS_PADRAO
            baus_abertos=dados.get("baus_abertos", ()),  # MAP-03: save antigo → conjunto vazio
        )
