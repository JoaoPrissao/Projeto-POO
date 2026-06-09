"""Ponte domínio ↔ frontend (pywebview).

Regras do contrato (Planejamento §7.3):
  1. Exceções do domínio NÃO cruzam a ponte. Todo método público envolve a
     chamada ao domínio e devolve um ErroDTO (`{"ok": False, "erro": {...}}`).
  2. Tudo que cruza é serializável em JSON (dict/list/str/num/bool) — nunca um
     objeto `Musico` cru.
  3. O domínio continua dando `raise` de verdade; aqui é só a tradução.

Esta camada é um adaptador fino: o estado da banda vive no GerenciadorJogo
(Singleton) e a lógica de combate vive em `show.py`. A API só orquestra e
serializa.
"""
import os
import sys

# Permite rodar tanto via pytest (que injeta backend/) quanto via app.py direto.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from gerenciador import GerenciadorJogo
from fabricas import MusicoFactory, ItemFactory
from show import Show, Empresario
from ritmo import Ritmo
from excecoes import JogoError
import persistencia


BOSS_HP_PADRAO = 200
BOSS_DANO_PADRAO = 20

# Metadados de cada tipo para a tela de montar banda (vêm do Factory).
_INFO_TIPOS = {
    "guitarrista": {"nome": "Guitarrista", "recurso": "ego",
                    "descricao": "Dano alto. Acumula Ego a cada ataque."},
    "vocalista":   {"nome": "Vocalista", "recurso": "folego",
                    "descricao": "Gasta fôlego para soltar a voz com força."},
    "baterista":   {"nome": "Baterista", "recurso": "ritmo",
                    "descricao": "Viradas de bateria são golpes críticos."},
    "baixista":    {"nome": "Baixista", "recurso": "groove",
                    "descricao": "Segura o groove e se cura no compasso."},
}


def _erro_dto(exc: Exception) -> dict:
    return {"ok": False, "erro": {"tipo": type(exc).__name__, "mensagem": str(exc)}}


def _ponte(metodo):
    """Decorator: captura JogoError (→ ErroDTO) e qualquer erro inesperado."""
    def wrapper(self, *args, **kwargs):
        try:
            return metodo(self, *args, **kwargs)
        except JogoError as e:
            return _erro_dto(e)
        except Exception as e:  # noqa: BLE001 — nada de traceback cru cruzando a ponte
            return _erro_dto(e)
    wrapper.__name__ = metodo.__name__
    return wrapper


class API:
    def __init__(self):
        self._show: Show | None = None

    # ── infra interna ─────────────────────────────────────────────────────────

    @property
    def _gerenciador(self) -> GerenciadorJogo:
        return GerenciadorJogo.get_instancia()

    def _iniciar_show(self) -> None:
        """Começa um show novo: boss cheio, turno da banda."""
        boss = Empresario("O Empresário", hp=BOSS_HP_PADRAO, dano=BOSS_DANO_PADRAO)
        self._gerenciador.iniciar_show(boss)
        self._show = Show(self._gerenciador.listar_jogadores(), boss)

    def _vincular_show(self) -> None:
        """Liga o orquestrador Show à banda e ao boss atuais do gerenciador
        (usado após carregar um save, que restaura o boss no ponto certo)."""
        self._show = Show(self._gerenciador.listar_jogadores(), self._gerenciador.get_boss())

    def _garantir_show(self) -> None:
        """Garante um Show válido sem destruir progresso: reusa o boss do
        gerenciador se já houver um; senão começa um show novo."""
        if self._show is not None:
            return
        if self._gerenciador.get_boss() is not None:
            self._vincular_show()
        else:
            self._iniciar_show()

    def _recurso_dto(self, musico) -> dict:
        tipo = getattr(musico, "TIPO", None)
        if tipo == "baixista":
            return {"tipo": "groove", "valor": musico.get_fe(), "max": None}
        if tipo == "guitarrista":
            return {"tipo": "ego", "valor": musico.get_ego(), "max": musico.EGO_MAX}
        if tipo == "vocalista":
            return {"tipo": "folego", "valor": musico.get_folego(), "max": None}
        if tipo == "baterista":
            return {"tipo": "ritmo", "valor": musico.get_agilidade(), "max": None}
        return {"tipo": None, "valor": 0, "max": None}

    def _musico_dto(self, indice: int, musico) -> dict:
        return {
            "id": indice,
            "tipo": getattr(musico, "TIPO", None),
            "nome": musico.get_nome(),
            "nivel": musico.get_nivel(),
            "hp": musico.get_hp(),
            "hp_maximo": musico.get_hp_maximo(),
            "xp": musico.get_xp(),
            "vivo": musico.esta_vivo(),
            "recurso": self._recurso_dto(musico),
        }

    def _estado_dto(self) -> dict:
        banda = self._gerenciador.listar_jogadores()
        boss = self._gerenciador.get_boss()
        fim = self._show.verificar_fim() if self._show else None
        return {
            "banda": [self._musico_dto(i, m) for i, m in enumerate(banda)],
            "boss": {
                "id": "empresario",
                "nome": boss.get_nome() if boss else "O Empresário",
                "hp": boss.get_hp() if boss else BOSS_HP_PADRAO,
                "hp_maximo": boss.get_hp_maximo() if boss else BOSS_HP_PADRAO,
            },
            "turno": self._gerenciador.get_turno(),
            "fim_de_jogo": fim is not None,
            "resultado": fim,
        }

    # ── métodos expostos ao JS ────────────────────────────────────────────────

    @_ponte
    def listar_tipos_musicos(self) -> list:
        return [
            {"tipo": t, "nome": info["nome"], "recurso": info["recurso"],
             "descricao": info["descricao"]}
            for t, info in _INFO_TIPOS.items()
            if t in MusicoFactory._tipos
        ]

    @_ponte
    def novo_jogo(self, config: dict = None) -> dict:
        self._gerenciador.criar_banda([])
        self._iniciar_show()
        return self._estado_dto()

    @_ponte
    def criar_banda(self, composicao: list) -> dict:
        self._gerenciador.criar_banda(composicao)
        self._iniciar_show()
        return self._estado_dto()

    @_ponte
    def obter_estado(self) -> dict:
        self._garantir_show()
        return self._estado_dto()

    @_ponte
    def executar_acao(self, payload: dict) -> dict:
        self._garantir_show()
        indice = payload["indice"]
        ritmo = None
        if payload.get("ritmo"):
            ritmo = Ritmo.de_payload(payload["ritmo"])

        resultado = self._show.acao_musico(indice, ritmo=ritmo)
        self._gerenciador.set_turno("boss")
        fim = resultado["fim"]
        return {
            "ok": True,
            "dano": resultado["dano"],
            "critico": resultado["critico"],
            "modo_refrao_ativo": resultado["modo_refrao_ativo"],
            "multiplicador_aplicado": resultado["multiplicador_aplicado"],
            "atacante": resultado["atacante"],
            "estado": self._estado_dto(),
            "fim_de_jogo": fim is not None,
            "resultado_final": fim,
        }

    @_ponte
    def entrar_no_show(self, venue: dict) -> dict:
        """Modo história: entrar numa venue arma o boss daquela parada (uma
        capanga do Empresário) e religa o Show à banda atual. Espelha
        `_iniciar_show`, mas com os atributos vindos do overworld. Aditivo:
        não altera o fluxo de combate; só troca quem é o inimigo da vez."""
        boss = Empresario(
            venue.get("nome", "Capanga"),
            hp=int(venue.get("hp", BOSS_HP_PADRAO)),
            dano=int(venue.get("dano", BOSS_DANO_PADRAO)),
        )
        self._gerenciador.iniciar_show(boss)
        self._show = Show(self._gerenciador.listar_jogadores(), boss)
        return self._estado_dto()

    @_ponte
    def coletar_item(self, payload: dict) -> dict:
        """Modo história: pegar um item no overworld o adiciona ao inventário
        de um músico (via ItemFactory — reuso do domínio)."""
        indice = int(payload.get("indice", 0))
        banda = self._gerenciador.listar_jogadores()
        musico = banda[indice]                       # IndexError → ErroDTO
        item = ItemFactory.criar(payload["tipo"])    # TipoInvalidoError → ErroDTO
        inventario = musico.get_inventario()
        inventario.adicionar(item)                   # InventarioCheioError → ErroDTO
        return {
            "ok": True,
            "musico": musico.get_nome(),
            "item": item.nome,
            "tamanho_inventario": len(inventario),
        }

    @_ponte
    def turno_inimigo(self) -> dict:
        self._garantir_show()
        resultado = self._show.turno_inimigo()
        self._gerenciador.set_turno("banda")
        fim = resultado["fim"]
        return {
            "ok": True,
            "atacante": resultado["atacante"],
            "alvo": resultado["alvo"],
            "dano": resultado["dano"],
            "estado": self._estado_dto(),
            "fim_de_jogo": fim is not None,
            "resultado_final": fim,
        }

    @_ponte
    def salvar(self, slot: str, pasta: str = None) -> dict:
        self._gerenciador.salvar(slot, pasta)
        return {"ok": True, "slot": slot}

    @_ponte
    def carregar(self, slot: str, pasta: str = None) -> dict:
        self._gerenciador.carregar(slot, pasta)
        if self._gerenciador.get_boss() is None:
            self._iniciar_show()        # save antigo sem show → começa um novo
        else:
            self._vincular_show()       # retoma o show no ponto salvo
        return {"ok": True, "estado": self._estado_dto()}

    @_ponte
    def listar_saves(self, pasta: str = None) -> list:
        return persistencia.listar_saves(pasta)
