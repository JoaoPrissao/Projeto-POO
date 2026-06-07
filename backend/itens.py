from excecoes import ItemIncompativelError

# Itens nesta fase são RPG-genéricos e NEUTROS de tema: as classes não citam
# nada concreto (espada/poção). O catálogo concreto vive na ItemFactory.
# Identidade do item = `nome` (usado como id pelo Inventario).


class Item:
    """Item base. Itens genéricos não têm efeito de uso sobre um jogador."""

    consumir_ao_usar = False

    def __init__(self, nome: str, descricao: str = ""):
        self.nome = nome
        self.descricao = descricao

    def usar(self, alvo) -> None:
        raise ItemIncompativelError(f"O item '{self.nome}' não pode ser usado.")

    def to_dict(self) -> dict:
        return {
            "classe": type(self).__name__,
            "nome": self.nome,
            "descricao": self.descricao,
        }

    @classmethod
    def from_dict(cls, dados: dict) -> "Item":
        return cls(nome=dados["nome"], descricao=dados.get("descricao", ""))


class Equipavel(Item):
    """Concede bônus a um atributo ao ser equipado (usado).

    `classes_permitidas`: tupla de nomes de classe que podem equipar, ou None
    (qualquer um). Tentar equipar fora disso é a origem do ItemIncompativelError.
    O bônus é aplicado via duck typing (`aumentar_<atributo>`), sem citar
    classes concretas de jogador aqui.
    """

    def __init__(self, nome: str, descricao: str = "", atributo: str = "forca",
                 bonus: int = 0, classes_permitidas=None):
        super().__init__(nome, descricao)
        self.atributo = atributo
        self.bonus = bonus
        self.classes_permitidas = tuple(classes_permitidas) if classes_permitidas else None

    def usar(self, alvo) -> None:
        classe_alvo = type(alvo).__name__
        if self.classes_permitidas is not None and classe_alvo not in self.classes_permitidas:
            raise ItemIncompativelError(
                f"{classe_alvo} não pode equipar '{self.nome}'."
            )
        aplicar = getattr(alvo, f"aumentar_{self.atributo}", None)
        if aplicar is None:
            raise ItemIncompativelError(
                f"{classe_alvo} não pode receber bônus de {self.atributo}."
            )
        aplicar(self.bonus)

    def to_dict(self) -> dict:
        dados = super().to_dict()
        dados.update(
            atributo=self.atributo,
            bonus=self.bonus,
            classes_permitidas=list(self.classes_permitidas) if self.classes_permitidas else None,
        )
        return dados

    @classmethod
    def from_dict(cls, dados: dict) -> "Equipavel":
        return cls(
            nome=dados["nome"],
            descricao=dados.get("descricao", ""),
            atributo=dados.get("atributo", "forca"),
            bonus=dados.get("bonus", 0),
            classes_permitidas=dados.get("classes_permitidas"),
        )


class Consumivel(Item):
    """Efeito de uso único. Consumido ao usar.

    `efeito`: "cura" usa Jogador.curar(); "mana" usa restaurar_mana() (Mago).
    O efeito de mana é resolvido por duck typing — quem não tiver mana recebe
    ItemIncompativelError.
    """

    consumir_ao_usar = True

    def __init__(self, nome: str, descricao: str = "", efeito: str = "cura", valor: int = 0):
        super().__init__(nome, descricao)
        self.efeito = efeito
        self.valor = valor

    def usar(self, alvo) -> None:
        if self.efeito == "cura":
            alvo.curar(self.valor)
        elif self.efeito == "mana":
            restaurar = getattr(alvo, "restaurar_mana", None)
            if restaurar is None:
                raise ItemIncompativelError(
                    f"{type(alvo).__name__} não tem mana para restaurar com '{self.nome}'."
                )
            restaurar(self.valor)
        else:
            raise ItemIncompativelError(f"Efeito desconhecido em '{self.nome}'.")

    def to_dict(self) -> dict:
        dados = super().to_dict()
        dados.update(efeito=self.efeito, valor=self.valor)
        return dados

    @classmethod
    def from_dict(cls, dados: dict) -> "Consumivel":
        return cls(
            nome=dados["nome"],
            descricao=dados.get("descricao", ""),
            efeito=dados.get("efeito", "cura"),
            valor=dados.get("valor", 0),
        )
