from fabricas import MusicoFactory
import persistencia


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

    # ── Fase do jogo (placeholder de estado) ──────────────────────

    def get_fase(self) -> int:
        return self._fase

    def set_fase(self, fase: int) -> None:
        self._fase = fase

    # ── Persistência (delega pro módulo persistencia) ─────────────

    def salvar(self, slot: str, pasta: str = None) -> None:
        persistencia.salvar_jogo(self._banda, slot, pasta)

    def carregar(self, slot: str, pasta: str = None) -> None:
        self._banda = persistencia.carregar_jogo(slot, pasta)
