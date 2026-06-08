from musico import Musico
from Guitarrista import Guitarrista
from Vocalista import Vocalista
from Baterista import Baterista
from Baixista import Baixista
from itens import Item, Equipavel, Consumivel
from excecoes import TipoInvalidoError


class MusicoFactory:
    """Factory Method para criação de músicos a partir de uma string de tipo.

    O dict `_tipos` é o único ponto que cita as classes concretas; novos tipos
    podem ser registrados em tempo de execução via `registrar` (open/closed).
    """

    _tipos: dict[str, type[Musico]] = {
        "guitarrista": Guitarrista,
        "vocalista":   Vocalista,
        "baterista":   Baterista,
        "baixista":    Baixista,
    }

    @classmethod
    def criar(cls, tipo: str, **kwargs) -> Musico:
        if tipo not in cls._tipos:
            raise TipoInvalidoError(tipo)
        return cls._tipos[tipo](**kwargs)

    @classmethod
    def registrar(cls, chave: str, classe: type[Musico]) -> None:
        cls._tipos[chave] = classe


class ItemFactory:
    """Factory Method para itens. O catálogo `_catalogo` (string → fábrica) é o
    ÚNICO lugar que cita itens concretos; as classes em itens.py permanecem
    neutras de tema.
    """

    _catalogo: dict = {
        "energetico": lambda **kw: Consumivel(
            kw.get("nome", "Energético"),
            kw.get("descricao", "Recupera energia. Cura HP."),
            efeito="cura",
            valor=kw.get("valor", 50),
        ),
        "cerveja": lambda **kw: Consumivel(
            kw.get("nome", "Cerveja"),
            kw.get("descricao", "Dá aquele fôlego extra."),
            efeito="folego",
            valor=kw.get("valor", 30),
        ),
        "pedal": lambda **kw: Equipavel(
            kw.get("nome", "Pedal de Efeito"),
            kw.get("descricao", "Turboalimenta o som da guitarra."),
            atributo="forca",
            bonus=kw.get("bonus", 5),
            classes_permitidas=("Guitarrista", "Baixista"),
        ),
        "amplificador": lambda **kw: Equipavel(
            kw.get("nome", "Amplificador"),
            kw.get("descricao", "Volume na máxima. Pesado e brutal."),
            atributo="forca",
            bonus=kw.get("bonus", 8),
            classes_permitidas=("Guitarrista", "Baixista"),
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
