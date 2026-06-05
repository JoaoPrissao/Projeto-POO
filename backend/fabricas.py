from jogador import Jogador
from Guerreiro import Guerreiro
from Mago import Mago
from Ladrao import Ladrao
from Paladino import Paladino
from excecoes import TipoInvalidoError


class JogadorFactory:
    """Factory Method para criação de jogadores a partir de uma string de tipo.

    O dict `_tipos` é o único ponto que cita as classes concretas; novos tipos
    podem ser registrados em tempo de execução via `registrar` (open/closed).
    """

    _tipos: dict[str, type[Jogador]] = {
        "guerreiro": Guerreiro,
        "mago":      Mago,
        "ladrao":    Ladrao,
        "paladino":  Paladino,
    }

    @classmethod
    def criar(cls, tipo: str, **kwargs) -> Jogador:
        if tipo not in cls._tipos:
            raise TipoInvalidoError(tipo)
        return cls._tipos[tipo](**kwargs)

    @classmethod
    def registrar(cls, chave: str, classe: type[Jogador]) -> None:
        cls._tipos[chave] = classe
