import random

from excecoes import (JogadorMortoError, AtaqueInvalidoError,
                      EspecialIndisponivelError, MusicoCansadoError)

# F3.8 — quando o vilão age, a rodada vira: a banda descansa (cansaço dura
# exatamente 1 vez do vilão) e recupera um pouco de energia.
REGEN_ENERGIA_POR_RODADA = 8


class Empresario:
    """Boss do show. Quer vender/comercializar a banda.
    Mesma interface de alvo que os Musicos (receber_dano, esta_vivo, etc.).
    """

    def __init__(self, nome: str = "O Empresário", hp: int = 200, dano: int = 20):
        self._nome      = nome
        self._hp_max    = hp
        self._hp        = hp
        self._dano      = dano
        self._atordoado = False    # combo perfeito da banda o atordoa (F3.4)

    def get_nome(self) -> str:
        return self._nome

    def get_hp(self) -> int:
        return self._hp

    def get_hp_maximo(self) -> int:
        return self._hp_max

    def esta_vivo(self) -> bool:
        return self._hp > 0

    # ── Atordoamento (combo perfeito da banda) ────────────────────

    def esta_atordoado(self) -> bool:
        return self._atordoado

    def atordoar(self) -> None:
        self._atordoado = True

    def acordar(self) -> None:
        self._atordoado = False

    # ── Serialização (persistência do progresso do show) ──────────

    def to_dict(self) -> dict:
        return {
            "nome": self._nome,
            "hp": self._hp,
            "hp_maximo": self._hp_max,
            "dano": self._dano,
            "atordoado": self._atordoado,
        }

    @classmethod
    def from_dict(cls, dados: dict) -> "Empresario":
        emp = cls(dados["nome"], hp=dados["hp_maximo"], dano=dados["dano"])
        emp._hp = dados["hp"]
        emp._atordoado = dados.get("atordoado", False)
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

    F3.4 acrescenta o estado de combate de tempo real: um combo PERFEITO (todas
    as notas) atordoa o vilão por uma rodada e conta na sequência; ao acumular
    `LIMIAR_ESPECIAL` perfeitos seguidos a banda libera o golpe especial (todos
    atacam de uma vez). `mult_banda` (vindo da fama) escala o dano da banda.
    """

    LIMIAR_ESPECIAL = 4      # perfeitos seguidos pra liberar o especial
    MULT_ESPECIAL   = 2.0    # bônus de dano do golpe coletivo

    def __init__(self, banda: list, inimigo: Empresario, mult_banda: float = 1.0):
        self._banda             = banda
        self._inimigo           = inimigo
        self._mult_banda        = float(mult_banda)
        self._perfeitos_seguidos = 0

    def especial_disponivel(self) -> bool:
        return self._perfeitos_seguidos >= self.LIMIAR_ESPECIAL

    def _dano_de(self, musico, ritmo=None, mult_extra: float = 1.0) -> dict:
        """Calcula (e aplica os efeitos colaterais de) o ataque de um músico,
        SEM aplicar o dano ao boss. Devolve dano final + flags.
        `mult_extra` vem do move escolhido (F3.6b)."""
        dano_base = musico.atacar()                      # D2: só o dano base
        ego = getattr(musico, 'get_ego', lambda: 0)()
        ego_bonus = int(ego / 10)

        mult = ritmo.multiplicador() if ritmo is not None else 1.0
        modo_refrao = ritmo.modo_refrao() if ritmo is not None else False
        if modo_refrao:
            mult *= 1.5

        dano_final = max(1, int((dano_base + ego_bonus) * mult * mult_extra * self._mult_banda))
        critico = getattr(musico, 'foi_virada_de_bateria', lambda: False)()
        return {
            "dano": dano_final, "dano_base": dano_base, "critico": critico,
            "modo_refrao_ativo": modo_refrao, "multiplicador_aplicado": mult,
        }

    def acao_musico(self, indice: int, ritmo=None, mult_extra: float = 1.0,
                    custo_energia: int = 0, cansa: bool = False) -> dict:
        """Resolve o ataque de um músico contra o boss.

        `ritmo`: instância de Ritmo opcional. Se None, nenhum modificador
        de ritmo é aplicado. `mult_extra`/`custo_energia`/`cansa` vêm do move
        escolhido (F3.6b/F3.8): valida cansaço e energia ANTES de qualquer
        efeito (golpe inválido não causa dano nem gasta nada)."""
        musico = self._banda[indice]
        if musico.esta_cansado():
            raise MusicoCansadoError(musico.get_nome())
        musico.gastar_energia(custo_energia)   # EnergiaInsuficiente → nada sai
        calc = self._dano_de(musico, ritmo, mult_extra)
        self._inimigo.receber_dano(calc["dano"])
        if cansa:
            musico.cansar()                    # pesado: perde a próxima vez

        # Combo perfeito → atordoa o vilão e conta na sequência do especial.
        perfeito = ritmo.perfeito() if ritmo is not None else False
        if perfeito:
            self._inimigo.atordoar()
            self._perfeitos_seguidos += 1
        else:
            self._perfeitos_seguidos = 0

        return {
            "atacante":               musico.get_nome(),
            "dano":                   calc["dano"],
            "dano_base":              calc["dano_base"],
            "critico":                calc["critico"],
            "modo_refrao_ativo":      calc["modo_refrao_ativo"],
            "multiplicador_aplicado": calc["multiplicador_aplicado"],
            "perfeito":               perfeito,
            "atordoado":              self._inimigo.esta_atordoado(),
            "perfeitos_seguidos":     self._perfeitos_seguidos,
            "especial_disponivel":    self.especial_disponivel(),
            "hp_inimigo":             self._inimigo.get_hp(),
            "fim":                    self.verificar_fim(),
        }

    def ataque_especial(self) -> dict:
        """Golpe coletivo: todos os músicos vivos atacam de uma vez, com um
        multiplicador extra. Exige o especial liberado e zera a sequência."""
        if not self.especial_disponivel():
            raise EspecialIndisponivelError()

        por_membro = []
        total = 0
        for musico in self._banda:
            if not musico.esta_vivo():
                continue
            base = self._dano_de(musico)["dano"]
            dano = max(1, int(base * self.MULT_ESPECIAL))
            por_membro.append({"atacante": musico.get_nome(), "dano": dano})
            total += dano

        if total > 0 and self._inimigo.esta_vivo():
            self._inimigo.receber_dano(total)
        self._perfeitos_seguidos = 0

        return {
            "atacante":   "Banda (especial)",
            "dano":       total,
            "por_membro": por_membro,
            "atordoado":  self._inimigo.esta_atordoado(),
            "especial_disponivel": False,
            "hp_inimigo": self._inimigo.get_hp(),
            "fim":        self.verificar_fim(),
        }

    def turno_inimigo(self) -> dict:
        # F3.8 — a vez do vilão vira a rodada: a banda descansa (o cansaço do
        # golpe pesado dura exatamente 1 vez) e recupera um pouco de energia.
        # Vale também quando ele está atordoado (a rodada passou do mesmo jeito).
        for musico in self._banda:
            if musico.esta_vivo():
                musico.descansar()
                musico.recuperar_energia(REGEN_ENERGIA_POR_RODADA)

        # Atordoado: o vilão perde a vez e acorda (consome o stun).
        if self._inimigo.esta_atordoado():
            self._inimigo.acordar()
            return {
                "atacante": self._inimigo.get_nome(),
                "alvo": None, "dano": 0, "hp_alvo": 0,
                "atordoado": True,
                "fim": self.verificar_fim(),
            }

        vivos = [j for j in self._banda if j.esta_vivo()]
        if not vivos:
            return {
                "atacante": self._inimigo.get_nome(),
                "alvo": None, "dano": 0, "hp_alvo": 0,
                "atordoado": False,
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
            "atordoado": False,
            "fim":      self.verificar_fim(),
        }

    def verificar_fim(self) -> str | None:
        if not self._inimigo.esta_vivo():
            return "vitoria"
        # Banda vazia é estado neutro (ainda não montou) — não é derrota.
        if self._banda and not any(j.esta_vivo() for j in self._banda):
            return "derrota"
        return None
