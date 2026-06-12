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
            kw.get("descricao", "Restaura 30 de energia."),
            efeito="energia",       # F3.8: energia unificada (qualquer músico)
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
        # MAP-02 (Phase 1): itens entregues pelos 3 NPCs do overworld.
        "bandana_sortuda": lambda **kw: Equipavel(
            kw.get("nome", "Bandana da Sorte"),
            kw.get("descricao", "Um roadie aposentado jogou no palco. Traz boa sorte."),
            atributo="agilidade",
            bonus=kw.get("bonus", 4),
            classes_permitidas=None,   # qualquer membro da banda
        ),
        "palheta_de_ouro": lambda **kw: Equipavel(
            kw.get("nome", "Palheta de Ouro"),
            kw.get("descricao", "Lendária. Dizem que pertenceu a Hendrix."),
            atributo="forca",
            bonus=kw.get("bonus", 6),
            classes_permitidas=("Guitarrista", "Baixista"),
        ),
        "vinil_raro": lambda **kw: Consumivel(
            kw.get("nome", "Vinil Raro 1973"),
            kw.get("descricao", "Ouvir antes do show aumenta a concentracao. Recupera energia."),
            efeito="energia",
            valor=kw.get("valor", 40),
        ),
        # MAP-03 (Phase 1): itens únicos dos 2 baús/segredos do overworld (D-12).
        "jaqueta_lendaria": lambda **kw: Equipavel(
            kw.get("nome", "Jaqueta de Couro Lendária"),
            kw.get("descricao", "De uma banda que parou de existir. Força bruta nas cordas."),
            atributo="forca",
            bonus=kw.get("bonus", 15),
            classes_permitidas=None,   # qualquer membro — prestígio total
        ),
        "capa_de_lp": lambda **kw: Equipavel(
            kw.get("nome", "Capa de LP Sagrada"),
            kw.get("descricao", "O álbum mais raro do mundo. Quem carrega nunca para de tocar."),
            atributo="agilidade",
            bonus=kw.get("bonus", 12),
            classes_permitidas=None,   # qualquer membro
        ),
        # 02-01 (VIS-01 fix): itens específicos para Vocalista e Baterista.
        # Garante distribuição equilibrada: todos os 4 membros têm itens úteis.
        "partitura_magica": lambda **kw: Equipavel(
            kw.get("nome", "Partitura Mágica"),
            kw.get("descricao", "Anotações de um maestro louco. Aguça a inteligência do vocalista."),
            atributo="inteligencia",
            bonus=kw.get("bonus", 6),
            classes_permitidas=("Vocalista",),   # específico para Vande
        ),
        "oculos_do_ritmo": lambda **kw: Equipavel(
            kw.get("nome", "Óculos do Ritmo"),
            kw.get("descricao", "Lentes calibradas no pulso perfeito. Amplifica a agilidade do baterista."),
            atributo="agilidade",
            bonus=kw.get("bonus", 5),
            classes_permitidas=("Baterista",),   # específico para Ramiro
        ),
        "microfone_de_ouro": lambda **kw: Equipavel(
            kw.get("nome", "Microfone de Ouro"),
            kw.get("descricao", "Microfone de estúdio lendário. Potencializa a inteligência vocal."),
            atributo="inteligencia",
            bonus=kw.get("bonus", 10),
            classes_permitidas=("Vocalista",),   # baú único para Vande
        ),
        "baquetas_fantasma": lambda **kw: Equipavel(
            kw.get("nome", "Baquetas Fantasma"),
            kw.get("descricao", "Levíssimas, quase invisíveis. Dobra a agilidade e aguça o timing."),
            atributo="agilidade",
            bonus=kw.get("bonus", 8),
            classes_permitidas=("Baterista",),   # baú único para Ramiro
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
