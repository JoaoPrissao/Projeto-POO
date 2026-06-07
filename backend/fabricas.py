from jogador import Jogador
from Guerreiro import Guerreiro
from Mago import Mago
from Ladrao import Ladrao
from Paladino import Paladino
from itens import Item, Equipavel, Consumivel
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


class ItemFactory:
    """Factory Method para itens. O catálogo `_catalogo` (string → fábrica) é o
    ÚNICO lugar que cita itens concretos (espada, poção, ...); as classes em
    itens.py permanecem neutras de tema.
    """

    _catalogo: dict = {
        "pocao_vida": lambda **kw: Consumivel(
            kw.get("nome", "Poção de Vida"),
            kw.get("descricao", "Restaura HP."),
            efeito="cura",
            valor=kw.get("valor", 50),
        ),
        "pocao_mana": lambda **kw: Consumivel(
            kw.get("nome", "Poção de Mana"),
            kw.get("descricao", "Restaura mana."),
            efeito="mana",
            valor=kw.get("valor", 30),
        ),
        "espada": lambda **kw: Equipavel(
            kw.get("nome", "Espada"),
            kw.get("descricao", "Lâmina afiada."),
            atributo="forca",
            bonus=kw.get("bonus", 5),
            classes_permitidas=("Guerreiro", "Paladino"),
        ),
        "machado": lambda **kw: Equipavel(
            kw.get("nome", "Machado de Guerra"),
            kw.get("descricao", "Pesado e brutal."),
            atributo="forca",
            bonus=kw.get("bonus", 8),
            classes_permitidas=("Guerreiro", "Paladino"),
        ),
    }

    @classmethod
    def criar(cls, tipo: str, **kwargs) -> Item:
        if tipo not in cls._catalogo:
            raise TipoInvalidoError(tipo)
        return cls._catalogo[tipo](**kwargs)

    @classmethod
    def registrar(cls, chave: str, fabrica) -> None:
        cls._catalogo[chave] = fabrica
