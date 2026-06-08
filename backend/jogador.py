from abc import ABC, abstractmethod
from excecoes import JogadorMortoError, AtaqueInvalidoError
from inventario import Inventario

CAPACIDADE_INVENTARIO_PADRAO = 20


class Jogador(ABC):
    XP_BASE = 100
    TIPO = None  # discriminador de serialização; cada subclasse define o seu

    def __init__(self, nome: str, nivel: int = 1, hp_maximo: int = 100, xp: int = 0):
        self._nome             = nome
        self._nivel            = nivel
        self._hp_maximo        = hp_maximo
        self._hp               = hp_maximo
        self._xp               = xp
        self._xp_proximo_nivel = nivel * self.XP_BASE
        print(f"  [+] Jogador '{self._nome}' criado (nível {self._nivel}).")

    @classmethod
    def iniciante(cls, nome: str) -> "Jogador":
        return cls(nome)

    @classmethod
    def do_save(cls, nome: str, nivel: int, hp_maximo: int, xp: int) -> "Jogador":
        return cls(nome, nivel, hp_maximo, xp)

    def __del__(self):
        print(f"  [-] Jogador '{self._nome}' removido da memória.")

    # ── Getters ───────────────────────────────────────────────────

    def get_nome(self) -> str:
        return self._nome

    def get_nivel(self) -> int:
        return self._nivel

    def get_hp(self) -> int:
        return self._hp

    def get_hp_maximo(self) -> int:
        return self._hp_maximo

    def get_xp(self) -> int:
        return self._xp

    def get_xp_proximo_nivel(self) -> int:
        return self._xp_proximo_nivel

    # ── Setters ───────────────────────────────────────────────────

    def set_nome(self, nome: str) -> None:
        if not nome.strip():
            raise ValueError("Nome não pode ser vazio.")
        self._nome = nome
        print(f"  Nome alterado para: {self._nome}")

    def set_nivel(self, nivel: int) -> None:
        if nivel < 1:
            raise ValueError("Nível deve ser no mínimo 1.")
        self._nivel = nivel
        print(f"  {self._nome} agora é nível {self._nivel}.")

    def set_hp_maximo(self, hp_maximo: int) -> None:
        if hp_maximo <= 0:
            raise ValueError("HP máximo deve ser maior que zero.")
        self._hp_maximo = hp_maximo
        if self._hp > self._hp_maximo:
            self._hp = self._hp_maximo
        print(f"  HP máximo de {self._nome} ajustado para {self._hp_maximo}.")

    # ── Métodos ───────────────────────────────────────────────────

    def exibir_status(self) -> None:
        print("========================================")
        print(f"  Nome       : {self._nome}")
        print(f"  Nível      : {self._nivel}")
        print(f"  HP         : {self._hp}/{self._hp_maximo}")
        print(f"  XP         : {self._xp}/{self._xp_proximo_nivel}")
        print(f"  Vivo       : {'Sim' if self.esta_vivo() else 'Não'}")

    def esta_vivo(self) -> bool:
        return self._hp > 0

    def receber_dano(self, dano: int) -> None:
        if dano <= 0:
            raise AtaqueInvalidoError(dano)
        if not self.esta_vivo():
            raise JogadorMortoError(self._nome)
        self._hp -= dano
        if self._hp < 0:
            self._hp = 0
        print(f"  {self._nome} recebeu {dano} de dano. HP: {self._hp}/{self._hp_maximo}")
        if not self.esta_vivo():
            print(f"  {self._nome} foi derrotado!")

    def curar(self, cura: int) -> None:
        if cura <= 0:
            return
        if not self.esta_vivo():
            print(f"  {self._nome} está morto e não pode ser curado.")
            return
        self._hp = min(self._hp + cura, self._hp_maximo)
        print(f"  {self._nome} curou {cura} de HP. HP: {self._hp}/{self._hp_maximo}")

    def ganhar_xp(self, quantidade: int) -> None:
        if quantidade <= 0:
            return
        self._xp += quantidade
        print(f"  {self._nome} ganhou {quantidade} XP. XP: {self._xp}/{self._xp_proximo_nivel}")
        while self._xp >= self._xp_proximo_nivel:
            self._xp -= self._xp_proximo_nivel
            self.subir_nivel()

    def subir_nivel(self) -> None:
        self._nivel += 1
        self._xp_proximo_nivel = self._nivel * self.XP_BASE
        bonus_hp = 10
        self._hp_maximo += bonus_hp
        self._hp = min(self._hp + bonus_hp, self._hp_maximo)
        print(f"  {self._nome} subiu para o nível {self._nivel}! "
              f"HP máximo: {self._hp_maximo} (+{bonus_hp})")

    @abstractmethod
    def atacar(self, alvo: "Jogador") -> None:
        pass

    # ── Inventário ────────────────────────────────────────────────

    def get_inventario(self) -> "Inventario":
        if not hasattr(self, "_inventario"):
            self._inventario = Inventario(CAPACIDADE_INVENTARIO_PADRAO)
        return self._inventario

    # ── Serialização (persistência) ───────────────────────────────

    def to_dict(self) -> dict:
        inv = getattr(self, "_inventario", None)
        return {
            "tipo": self.TIPO,
            "nome": self._nome,
            "nivel": self._nivel,
            "hp_maximo": self._hp_maximo,
            "hp": self._hp,
            "xp": self._xp,
            "inventario": {
                "capacidade": inv.capacidade if inv else CAPACIDADE_INVENTARIO_PADRAO,
                "itens": [item.to_dict() for item in inv.listar()] if inv else [],
            },
        }

    @classmethod
    def from_dict(cls, dados: dict) -> "Jogador":
        from fabricas import JogadorFactory
        from itens import item_from_dict

        dados = dict(dados)
        tipo = dados.pop("tipo")
        hp_atual = dados.pop("hp")
        inv_dados = dados.pop("inventario", None)

        # o restante (nome, nivel, hp_maximo, xp, + atributos da subclasse)
        # casa exatamente com os parâmetros do construtor de cada subclasse
        jogador = JogadorFactory.criar(tipo, **dados)
        jogador._hp = hp_atual

        if inv_dados:
            inv = jogador.get_inventario()
            inv.capacidade = inv_dados.get("capacidade", inv.capacidade)
            for item_d in inv_dados.get("itens", []):
                inv.adicionar(item_from_dict(item_d))
        return jogador
