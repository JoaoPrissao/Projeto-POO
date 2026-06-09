from fabricas import MusicoFactory
from musico import Musico
import persistencia
from excecoes import SaveCorrompidoError


class GerenciadorJogo:
    """Singleton detentor central do estado do jogo (a banda/party).

    Amarra a MusicoFactory (criação) e o módulo persistencia (save/load) —
    nenhum dos dois é reimplementado aqui, apenas orquestrado.

    O padrão é implementado com `__new__` (instância única em `_instancia`) +
    a flag `_inicializado` para o `__init__` NÃO zerar o estado quando
    `GerenciadorJogo()` é chamado novamente.
    """

    _instancia: "GerenciadorJogo | None" = None

    def __new__(cls) -> "GerenciadorJogo":
        if cls._instancia is None:
            cls._instancia = super().__new__(cls)
            cls._instancia._inicializado = False
        return cls._instancia

    def __init__(self) -> None:
        if self._inicializado:
            return
        self._banda: list = []
        self._fase: int = 1
        self._boss = None        # Empresario | None — boss do show em andamento
        self._turno: str = "banda"
        self._campanha = None    # Campanha | None — turnê do modo história
        self._inicializado = True

    # ── Acesso canônico ao Singleton ──────────────────────────────

    @classmethod
    def get_instancia(cls) -> "GerenciadorJogo":
        if cls._instancia is None:
            cls()
        return cls._instancia

    @classmethod
    def resetar(cls) -> None:
        """Descarta a instância única (usado pelos testes pra isolar estado)."""
        cls._instancia = None

    # ── Banda / party ─────────────────────────────────────────────

    def adicionar_jogador(self, tipo: str, **kwargs):
        jogador = MusicoFactory.criar(tipo, **kwargs)
        self._banda.append(jogador)
        return jogador

    def criar_banda(self, composicao: list) -> list:
        """Cria a banda a partir de uma lista de dicts {tipo, **atributos},
        substituindo a banda atual."""
        self._banda = []
        for membro in composicao:
            dados = dict(membro)
            tipo = dados.pop("tipo")
            self.adicionar_jogador(tipo, **dados)
        return self._banda

    def listar_jogadores(self) -> list:
        return self._banda

    def obter_jogador(self, indice: int):
        return self._banda[indice]

    # ── Show em andamento (boss + turno) ──────────────────────────

    def iniciar_show(self, boss) -> None:
        self._boss = boss
        self._turno = "banda"

    def get_boss(self):
        return self._boss

    def get_turno(self) -> str:
        return self._turno

    def set_turno(self, turno: str) -> None:
        self._turno = turno

    # ── Campanha (modo história) ──────────────────────────────────

    def iniciar_campanha(self, campanha=None) -> None:
        from campanha import Campanha
        self._campanha = campanha if campanha is not None else Campanha.padrao()

    def get_campanha(self):
        return self._campanha

    # ── Fase do jogo (placeholder de estado) ──────────────────────

    def get_fase(self) -> int:
        return self._fase

    def set_fase(self, fase: int) -> None:
        self._fase = fase

    # ── Persistência (delega pro módulo persistencia) ─────────────

    def salvar(self, slot: str, pasta: str = None) -> None:
        estado = {
            "banda": [j.to_dict() for j in self._banda],
            "show": self._show_to_dict(),
            "campanha": self._campanha.to_dict() if self._campanha else None,
        }
        persistencia.salvar_estado(estado, slot, pasta)

    def carregar(self, slot: str, pasta: str = None) -> None:
        estado = persistencia.carregar_estado(slot, pasta)
        try:
            self._banda = [Musico.from_dict(d) for d in estado["banda"]]
            self._carregar_show(estado.get("show"))
            self._carregar_campanha(estado.get("campanha"))
        except (KeyError, TypeError, AttributeError) as erro:
            raise SaveCorrompidoError(f"Save '{slot}' incompatível: {erro}") from erro

    # ── (de)serialização do show ──────────────────────────────────

    def _show_to_dict(self):
        if self._boss is None:
            return None
        return {"boss": self._boss.to_dict(), "turno": self._turno}

    def _carregar_show(self, show) -> None:
        if not show:
            self._boss = None
            self._turno = "banda"
            return
        from show import Empresario
        self._boss = Empresario.from_dict(show["boss"])
        self._turno = show.get("turno", "banda")

    def _carregar_campanha(self, campanha) -> None:
        if not campanha:
            self._campanha = None
            return
        from campanha import Campanha
        self._campanha = Campanha.from_dict(campanha)
