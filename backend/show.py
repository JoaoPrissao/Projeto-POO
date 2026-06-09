import random

from excecoes import JogadorMortoError, AtaqueInvalidoError


class Empresario:
    """Boss do show. Quer vender/comercializar a banda.
    Mesma interface de alvo que os Musicos (receber_dano, esta_vivo, etc.).
    """

    def __init__(self, nome: str = "O Empresário", hp: int = 200, dano: int = 20):
        self._nome     = nome
        self._hp_max   = hp
        self._hp       = hp
        self._dano     = dano

    def get_nome(self) -> str:
        return self._nome

    def get_hp(self) -> int:
        return self._hp

    def get_hp_maximo(self) -> int:
        return self._hp_max

    def esta_vivo(self) -> bool:
        return self._hp > 0

    # ── Serialização (persistência do progresso do show) ──────────

    def to_dict(self) -> dict:
        return {
            "nome": self._nome,
            "hp": self._hp,
            "hp_maximo": self._hp_max,
            "dano": self._dano,
        }

    @classmethod
    def from_dict(cls, dados: dict) -> "Empresario":
        emp = cls(dados["nome"], hp=dados["hp_maximo"], dano=dados["dano"])
        emp._hp = dados["hp"]
        return emp

    def receber_dano(self, dano: int) -> None:
        if dano <= 0:
            raise AtaqueInvalidoError(dano)
        if not self.esta_vivo():
            raise JogadorMortoError(self._nome)
        self._hp -= dano
        if self._hp < 0:
            self._hp = 0

    def atacar(self, alvo) -> None:
        alvo.receber_dano(self._dano)


class Show:
    """Orquestrador de turno (D2): o Show aplica modificadores temáticos ao
    dano base retornado por musico.atacar() e então chama alvo.receber_dano().
    """

    def __init__(self, banda: list, inimigo: Empresario):
        self._banda   = banda
        self._inimigo = inimigo

    def acao_musico(self, indice: int, ritmo=None) -> dict:
        """Resolve o ataque de um músico contra o boss.

        `ritmo`: instância de Ritmo opcional. Se None, nenhum modificador
        de ritmo é aplicado (placeholder para F2.3).
        """
        musico = self._banda[indice]

        # D2: atacar() retorna dano base sem aplicá-lo
        dano_base = musico.atacar()

        # Ego bonus (Guitarrista e quem tiver get_ego; outros retornam 0)
        ego = getattr(musico, 'get_ego', lambda: 0)()
        ego_bonus = int(ego / 10)

        # Multiplicador de ritmo
        mult = ritmo.multiplicador() if ritmo is not None else 1.0

        # Modo Refrão: buff extra quando a precisão estoura o limiar
        modo_refrao = ritmo.modo_refrao() if ritmo is not None else False
        if modo_refrao:
            mult *= 1.5

        dano_final = max(1, int((dano_base + ego_bonus) * mult))
        self._inimigo.receber_dano(dano_final)

        # Virada de bateria (flag interna do Baterista)
        critico = getattr(musico, 'foi_virada_de_bateria', lambda: False)()

        return {
            "atacante":              musico.get_nome(),
            "dano":                  dano_final,
            "dano_base":             dano_base,
            "critico":               critico,
            "modo_refrao_ativo":     modo_refrao,
            "multiplicador_aplicado": mult,
            "hp_inimigo":            self._inimigo.get_hp(),
            "fim":                   self.verificar_fim(),
        }

    def turno_inimigo(self) -> dict:
        vivos = [j for j in self._banda if j.esta_vivo()]
        if not vivos:
            return {
                "atacante": self._inimigo.get_nome(),
                "alvo": None,
                "dano": 0,
                "hp_alvo": 0,
                "fim": self.verificar_fim(),
            }
        alvo = random.choice(vivos)  # IA simples: provoca um músico vivo qualquer
        hp_antes = alvo.get_hp()
        self._inimigo.atacar(alvo)
        dano = hp_antes - alvo.get_hp()
        return {
            "atacante": self._inimigo.get_nome(),
            "alvo":     alvo.get_nome(),
            "dano":     dano,
            "hp_alvo":  alvo.get_hp(),
            "fim":      self.verificar_fim(),
        }

    def verificar_fim(self) -> str | None:
        if not self._inimigo.esta_vivo():
            return "vitoria"
        # Banda vazia é estado neutro (ainda não montou) — não é derrota.
        if self._banda and not any(j.esta_vivo() for j in self._banda):
            return "derrota"
        return None
