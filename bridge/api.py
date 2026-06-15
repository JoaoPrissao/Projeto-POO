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
from moves import moves_de, get_move
from excecoes import JogoError, VenueBloqueadaError
import persistencia


BOSS_HP_PADRAO = 200
BOSS_DANO_PADRAO = 20

# F3.7/F3.8 — recuperação + loja (agora um PONTO do mapa; a van só armazena).
# O regen é autoritativo no backend: o front manda "passaram N segundos no
# mapa" e a ponte aplica com teto por chamada. Energia regenera junto.
HP_REGEN_POR_SEGUNDO = 2
ENERGIA_REGEN_POR_SEGUNDO = 2
REGEN_MAX_SEG_POR_CHAMADA = 10
LOJA = {"energetico": 40, "cerveja": 25}    # tipo (ItemFactory) -> preço em cachê

# Metadados de cada tipo para a tela de montar banda (vêm do Factory).
_INFO_TIPOS = {
    "guitarrista": {"nome": "Guitarrista", "recurso": "ego",
                    "descricao": "Dano alto. Acumula Ego a cada ataque."},
    "vocalista":   {"nome": "Vocalista", "recurso": "inteligencia",
                    "descricao": "Solta a voz com força (inteligência)."},
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

    def _garantir_campanha(self):
        """Garante uma campanha sem destruir progresso: reusa a do gerenciador
        (ex.: restaurada de um save) ou começa a turnê padrão."""
        if self._gerenciador.get_campanha() is None:
            self._gerenciador.iniciar_campanha()
        return self._gerenciador.get_campanha()

    def _campanha_dto(self) -> dict:
        camp = self._garantir_campanha()
        return {
            "venues": camp.listar_venues(),
            "itens": camp.listar_itens(),
            "posicao": camp.get_posicao(),
            "completa": camp.esta_completa(),
            "fama_banda": camp.fama_banda(),
            "cache": camp.get_cache(),
            "loja": camp.get_loja(),        # F3.8: ponto da loja no mapa
            "van_estagio": camp.van_estagio(),  # MAP-01 (Phase 1): estágio derivado da fama
            "npcs": camp.listar_npcs(),     # MAP-02 (Phase 1): NPCs do overworld
            "baus": camp.listar_baus(),     # MAP-03 (Phase 1): baús/segredos do overworld
        }

    def _drop_dto(self, tipo: str) -> dict | None:
        """Metadados do item que cai ao vencer (sem adicioná-lo a ninguém ainda;
        o jogador escolhe o membro depois via `aplicar_drop`)."""
        if not tipo:
            return None
        item = ItemFactory.criar(tipo)
        classes = getattr(item, "classes_permitidas", None)
        return {
            "tipo": tipo,
            "nome": item.nome,
            "descricao": item.descricao,
            "classes_permitidas": list(classes) if classes else None,
        }

    def _recurso_dto(self, musico) -> dict:
        tipo = getattr(musico, "TIPO", None)
        if tipo == "baixista":
            return {"tipo": "groove", "valor": musico.get_fe(), "max": None}
        if tipo == "guitarrista":
            return {"tipo": "ego", "valor": musico.get_ego(), "max": musico.EGO_MAX}
        if tipo == "vocalista":
            return {"tipo": "inteligencia", "valor": musico.get_inteligencia(), "max": None}
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
            "energia": musico.get_energia(),            # F3.8
            "energia_maxima": musico.ENERGIA_MAXIMA,
            "cansado": musico.esta_cansado(),
            "recurso": self._recurso_dto(musico),
            "moves": moves_de(musico),     # F3.6b: muda com o equipamento
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

        mult_extra, custo, cansa = 1.0, 0, False
        if payload.get("move_id"):                       # F3.6b: golpe escolhido
            musico = self._gerenciador.listar_jogadores()[indice]
            move = get_move(musico, payload["move_id"])  # MoveInvalidoError → ErroDTO
            mult_extra = move["mult"]
            custo = move.get("custo", 0)                 # F3.8: energia do golpe
            cansa = move.get("cansa", False)

        # Cansado/sem energia → ErroDTO antes de qualquer efeito (F3.8).
        resultado = self._show.acao_musico(indice, ritmo=ritmo, mult_extra=mult_extra,
                                           custo_energia=custo, cansa=cansa)
        self._gerenciador.set_turno("boss")
        fim = resultado["fim"]
        return {
            "ok": True,
            "dano": resultado["dano"],
            "critico": resultado["critico"],
            "modo_refrao_ativo": resultado["modo_refrao_ativo"],
            "multiplicador_aplicado": resultado["multiplicador_aplicado"],
            "perfeito": resultado["perfeito"],
            "atordoado": resultado["atordoado"],
            "perfeitos_seguidos": resultado["perfeitos_seguidos"],
            "especial_disponivel": resultado["especial_disponivel"],
            "atacante": resultado["atacante"],
            "estado": self._estado_dto(),
            "fim_de_jogo": fim is not None,
            "resultado_final": fim,
        }

    @_ponte
    def ataque_especial(self) -> dict:
        """Golpe coletivo da banda (todos atacam de uma vez). Só funciona com o
        especial liberado (4 combos perfeitos seguidos) — senão vira ErroDTO."""
        self._garantir_show()
        resultado = self._show.ataque_especial()   # EspecialIndisponivelError → ErroDTO
        self._gerenciador.set_turno("boss")
        fim = resultado["fim"]
        return {
            "ok": True,
            "dano": resultado["dano"],
            "por_membro": resultado["por_membro"],
            "atacante": resultado["atacante"],
            "estado": self._estado_dto(),
            "fim_de_jogo": fim is not None,
            "resultado_final": fim,
        }

    @_ponte
    def obter_campanha(self) -> dict:
        """Estado autoritativo da turnê: venues (com flag concluída), itens
        (com flag coletado), posição da banda no mapa e se a campanha acabou."""
        return self._campanha_dto()

    @_ponte
    def nova_campanha(self) -> dict:
        """Menu principal → Novo jogo: recomeça a turnê do zero (venues,
        itens, fama, posição e bloqueios voltam ao padrão)."""
        self._gerenciador.iniciar_campanha()
        return {"ok": True, "campanha": self._campanha_dto()}

    @_ponte
    def sair(self) -> dict:
        """Menu principal → Sair: fecha a janela do pywebview. Sem janela
        aberta (testes/browser), o IndexError vira ErroDTO pelo _ponte."""
        import webview
        webview.windows[0].destroy()
        return {"ok": True}

    @_ponte
    def entrar_no_show(self, venue_id: str) -> dict:
        """Modo história: entrar numa venue (por id) arma a capanga definida na
        campanha e religa o Show à banda. A capanga reusa `Empresario`; nada do
        fluxo de combate muda — só quem é o inimigo da vez."""
        camp = self._garantir_campanha()
        if camp.venue_bloqueada(venue_id):           # cooldown após derrota
            raise VenueBloqueadaError(venue_id, camp.segundos_bloqueio(venue_id))
        venue = camp.get_venue(venue_id)             # VenueInvalidaError → ErroDTO
        capanga = venue["capanga"]
        boss = Empresario(capanga["nome"], hp=int(capanga["hp"]), dano=int(capanga["dano"]))
        self._gerenciador.iniciar_show(boss)
        for musico in self._gerenciador.listar_jogadores():
            musico.descansar()              # F3.8: ninguém entra cansado no show
        # A fama da banda escala o dano (banda mais famosa bate mais forte).
        self._show = Show(self._gerenciador.listar_jogadores(), boss,
                          mult_banda=camp.mult_banda())
        return self._estado_dto()

    @_ponte
    def concluir_venue(self, venue_id: str) -> dict:
        """Vitória numa venue: marca como vencida, dá XP a todos os membros e
        descreve o item que cai (drop). Idempotente — concluir de novo não dá
        XP/fama em dobro. Devolve `{campanha, xp_ganho, drop}`."""
        camp = self._garantir_campanha()
        ja_vencida = camp.get_venue(venue_id)["concluida"]  # VenueInvalidaError → ErroDTO
        recompensa = camp.get_recompensa(venue_id)
        xp_ganho = 0
        cache_ganho = 0
        if not ja_vencida:
            xp_ganho = recompensa["xp"]
            for musico in self._gerenciador.listar_jogadores():
                musico.ganhar_xp(xp_ganho)
            cache_ganho = recompensa["cache"]               # F3.7: cachê por show
            camp.ganhar_cache(cache_ganho)
        camp.concluir(venue_id)
        return {
            "ok": True,
            "campanha": self._campanha_dto(),
            "xp_ganho": xp_ganho,
            "cache_ganho": cache_ganho,
            "drop": self._drop_dto(recompensa["drop"]),
        }

    @_ponte
    def aplicar_drop(self, payload: dict) -> dict:
        """Entrega o item dropado a um membro escolhido — vai pro INVENTÁRIO
        (equipar é na van, via Tab — F3.6). Equipável incompatível com a classe
        ainda é recusado (o item ficaria preso: não há transferência).

        CR-01: o drop de vitória é ÚNICO por venue. `venue_id` gateia a entrega
        (espelha baús/NPCs); re-vencer ou reabrir o overlay não duplica o item.
        """
        tipo = payload["tipo"]
        venue_id = payload.get("venue_id")
        indice = int(payload.get("indice", 0))
        camp = self._garantir_campanha()
        if venue_id and camp.drop_ja_coletado(venue_id):
            raise JogoError("O item desta venue já foi coletado.")
        musico = self._gerenciador.listar_jogadores()[indice]   # IndexError → ErroDTO
        item = ItemFactory.criar(tipo)                          # TipoInvalidoError → ErroDTO
        if not getattr(item, "consumir_ao_usar", False):
            item.validar_alvo(musico)                           # ItemIncompativelError → ErroDTO
        musico.get_inventario().adicionar(item)                 # InventarioCheioError → ErroDTO
        if venue_id:
            camp.marcar_drop_coletado(venue_id)                 # entrega única
        return {
            "ok": True,
            "aplicado": "guardado",
            "item": item.nome,
            "musico": self._musico_dto(indice, musico),
        }

    # ── Equipamento (F3.6 — equipar na van via Tab, nunca em batalha) ─────────

    def _indice_elegivel(self, item) -> int:
        """Retorna o índice do primeiro músico elegível para receber `item`.

        Elegibilidade:
          1. Se `item` tem `classes_permitidas`, o músico precisa ter o
             `TIPO` listado nelas (comparação case-insensitive — o catalogo
             usa "Vocalista" (PascalCase) e o TIPO é "vocalista").
          2. Se ninguém for elegível (ex.: nenhum vivo da classe), cai no
             índice 0 como fallback seguro.

        Não exige que o músico esteja vivo — itens podem ir para KO para
        o jogador equipar depois na van; o domínio não impede isso.
        """
        classes = getattr(item, "classes_permitidas", None)
        if not classes:
            return 0  # sem restrição: vai pro índice 0 (fallback sensato)
        classes_lower = {c.lower() for c in classes}
        for i, musico in enumerate(self._gerenciador.listar_jogadores()):
            tipo = getattr(musico, "TIPO", None)
            if tipo and tipo.lower() in classes_lower:
                return i
        return 0  # fallback: nenhum membro da classe certa na banda

    def _elegiveis(self, item) -> list:
        """Retorna TODOS os músicos elegíveis para receber `item`.

        Cada entrada é um dict `{indice, nome, tipo}` pronto para serializar
        no payload de `escolha_necessaria`.

        Sem `classes_permitidas` → todos os membros da banda são elegíveis.
        Com restrição → apenas quem tem o TIPO listado (case-insensitive).
        Fallback: se ninguém bater, retorna [índice 0] para não bloquear.
        """
        banda = self._gerenciador.listar_jogadores()
        classes = getattr(item, "classes_permitidas", None)
        if not classes:
            return [{"indice": i, "nome": m.get_nome(),
                     "tipo": getattr(m, "TIPO", "?")}
                    for i, m in enumerate(banda)]
        classes_lower = {c.lower() for c in classes}
        resultado = [
            {"indice": i, "nome": m.get_nome(), "tipo": getattr(m, "TIPO", "?")}
            for i, m in enumerate(banda)
            if getattr(m, "TIPO", None) and getattr(m, "TIPO").lower() in classes_lower
        ]
        if not resultado:
            # fallback: nenhum membro da classe — retorna índice 0
            m = banda[0]
            resultado = [{"indice": 0, "nome": m.get_nome(),
                          "tipo": getattr(m, "TIPO", "?")}]
        return resultado

    def _item_dto(self, item) -> dict:
        equipavel = (hasattr(item, "validar_alvo")
                     and not getattr(item, "consumir_ao_usar", False))
        dto = {
            "nome": item.nome,
            "descricao": item.descricao,
            "equipavel": equipavel,
        }
        if equipavel:
            dto["atributo"] = item.atributo
            dto["bonus"] = item.bonus
            dto["classes_permitidas"] = (list(item.classes_permitidas)
                                         if item.classes_permitidas else None)
        return dto

    def _equipamento_dto(self) -> dict:
        banda = self._gerenciador.listar_jogadores()
        return {
            "ok": True,
            "banda": [{
                **self._musico_dto(i, m),
                "slots": m.SLOTS_EQUIPAMENTO,
                "equipados": [self._item_dto(it) for it in m.listar_equipados()],
                "inventario": [self._item_dto(it) for it in m.get_inventario().listar()],
            } for i, m in enumerate(banda)],
        }

    @_ponte
    def obter_equipamento(self) -> dict:
        """Banda completa com slots, itens equipados e inventário (menu Tab)."""
        return self._equipamento_dto()

    @_ponte
    def equipar(self, payload: dict) -> dict:
        """Move um item do inventário do músico pro slot de equipamento.
        Se equipar falhar (classe/slots), o item VOLTA pro inventário."""
        indice = int(payload["indice"])
        nome = payload["nome"]
        musico = self._gerenciador.listar_jogadores()[indice]   # IndexError → ErroDTO
        item = musico.get_inventario().remover(nome)            # ItemNaoEncontrado → ErroDTO
        try:
            musico.equipar(item)        # Incompatível/SlotsOcupados → ErroDTO
        except Exception:
            musico.get_inventario().adicionar(item)             # não some com o item
            raise
        return self._equipamento_dto()

    @_ponte
    def desequipar(self, payload: dict) -> dict:
        """Tira um item do slot e devolve pro inventário do músico.
        Se o inventário estiver cheio, o item permanece equipado."""
        indice = int(payload["indice"])
        nome = payload["nome"]
        musico = self._gerenciador.listar_jogadores()[indice]   # IndexError → ErroDTO
        item = musico.desequipar(nome)                          # ItemNaoEncontrado → ErroDTO
        try:
            musico.get_inventario().adicionar(item)             # InventarioCheio → ErroDTO
        except Exception:
            musico.equipar(item)        # devolve pro slot: nada se perde
            raise
        return self._equipamento_dto()

    @_ponte
    def registrar_derrota(self, venue_id: str) -> dict:
        """Derrota numa venue: bloqueia o local por um tempo (escala com a fama
        da venue) e a banda perde fama (fica mais fraca)."""
        camp = self._garantir_campanha()
        camp.get_venue(venue_id)                     # VenueInvalidaError → ErroDTO
        camp.registrar_derrota(venue_id)
        return {
            "ok": True,
            "bloqueada_seg": camp.segundos_bloqueio(venue_id),
            "fama_banda": camp.fama_banda(),
        }

    # ── Recuperação + loja da van (F3.7) ──────────────────────────────────────

    @_ponte
    def regenerar_banda(self, segundos) -> dict:
        """Regen passivo no mapa: cura os VIVOS a HP_REGEN_POR_SEGUNDO e
        recupera energia (F3.8) — na estrada todo mundo também descansa.
        O teto por chamada mantém a taxa autoritativa (o front não acelera)."""
        seg = min(max(0, int(segundos)), REGEN_MAX_SEG_POR_CHAMADA)
        cura = seg * HP_REGEN_POR_SEGUNDO
        energia = seg * ENERGIA_REGEN_POR_SEGUNDO
        banda = self._gerenciador.listar_jogadores()
        for musico in banda:
            musico.descansar()              # cansaço é coisa de batalha
            if musico.esta_vivo() and cura > 0:
                musico.curar(cura)          # capa no hp_maximo
                musico.recuperar_energia(energia)
        return {
            "ok": True,
            "banda": [self._musico_dto(i, m) for i, m in enumerate(banda)],
        }

    @_ponte
    def comprar(self, payload: dict) -> dict:
        """Loja do mapa (F3.8 — o jogador vai até o ponto 🏪): compra um
        consumível com cachê e guarda no inventário do membro escolhido.
        Sem saldo/tipo fora da loja → ErroDTO."""
        tipo = payload["tipo"]
        indice = int(payload.get("indice", 0))
        if tipo not in LOJA:
            raise JogoError(f"A loja não vende '{tipo}'.")
        musico = self._gerenciador.listar_jogadores()[indice]   # IndexError → ErroDTO
        camp = self._garantir_campanha()
        camp.gastar_cache(LOJA[tipo])       # CacheInsuficienteError → ErroDTO
        item = ItemFactory.criar(tipo)
        try:
            musico.get_inventario().adicionar(item)
        except Exception:
            camp.ganhar_cache(LOJA[tipo])   # inventário cheio: estorna o cachê
            raise
        return {
            "ok": True,
            "item": item.nome,
            "cache": camp.get_cache(),
            "musico": self._musico_dto(indice, musico),
        }

    @_ponte
    def usar_item(self, payload: dict) -> dict:
        """Usa um CONSUMÍVEL do inventário na van (cura/fôlego) e o consome.
        Equipável não se 'usa' por aqui (seria bônus permanente burlando os
        slots da F3.6) — equipar é só pelo menu de equipamento."""
        from excecoes import ItemIncompativelError
        indice = int(payload["indice"])
        nome = payload["nome"]
        musico = self._gerenciador.listar_jogadores()[indice]   # IndexError → ErroDTO
        inv = musico.get_inventario()
        item = next((i for i in inv.listar() if i.nome == nome), None)
        if item is None or not getattr(item, "consumir_ao_usar", False):
            raise ItemIncompativelError(
                f"'{nome}' não é um consumível do inventário de {musico.get_nome()}.")
        inv.usar(nome, musico)              # aplica efeito e consome
        return {
            "ok": True,
            "item": nome,
            "musico": self._musico_dto(indice, musico),
        }

    @_ponte
    def registrar_posicao(self, x: float) -> dict:
        """Guarda onde a banda está no overworld (persiste no save)."""
        self._garantir_campanha().set_posicao(float(x))
        return {"ok": True}

    @_ponte
    def coletar_item(self, payload: dict) -> dict:
        """Modo história: pegar um item (por id) marca-o como coletado na
        campanha e o adiciona ao inventário do músico ELEGÍVEL.

        Fluxo com escolha (Ajuste UX — 02-01):
          - Sem `indice` no payload E >1 elegível → NÃO consome nem marca
            como coletado; retorna `escolha_necessaria=True` com a lista de
            elegíveis. O frontend mostra o diálogo e re-chama com `indice`.
          - Com `indice` explícito OU exatamente 1 elegível → comportamento
            original: marca coletado e entrega ao músico escolhido/único.
        """
        camp = self._garantir_campanha()

        # Inspeciona o tipo SEM marcar (peek) para decidir se precisa de escolha.
        tipo = camp.peek_item(payload["id"])         # ItemMapaInvalidoError → ErroDTO
        item = ItemFactory.criar(tipo)

        if "indice" not in payload:
            elegiveis = self._elegiveis(item)
            if len(elegiveis) > 1:
                # Devolve sem consumir/marcar — o frontend escolhe e re-chama.
                return {
                    "ok": True,
                    "escolha_necessaria": True,
                    # WR-02: chave distinta — "item" fica reservado p/ string|None.
                    "item_escolha": {
                        "nome": item.nome,
                        "descricao": item.descricao,
                        "classes_permitidas": (list(item.classes_permitidas)
                                               if getattr(item, "classes_permitidas", None)
                                               else None),
                    },
                    "elegiveis": elegiveis,
                }
            indice = elegiveis[0]["indice"]
        else:
            indice = int(payload["indice"])

        # Agora consome/marca — o indice está definido.
        camp.coletar(payload["id"])                  # marca como coletado
        musico = self._gerenciador.listar_jogadores()[indice]   # IndexError → ErroDTO
        inventario = musico.get_inventario()
        inventario.adicionar(item)                   # InventarioCheioError → ErroDTO
        return {
            "ok": True,
            "escolha_necessaria": False,
            "musico": musico.get_nome(),
            "item": item.nome,
            "tamanho_inventario": len(inventario),
            "campanha": self._campanha_dto(),
        }

    @_ponte
    def abordar_npc(self, payload: dict) -> dict:
        """MAP-02: aborda um NPC pelo id. Na primeira vez entrega o item ao músico
        ELEGÍVEL pela classe do item; depois só repete a fala.

        Fluxo com escolha (Ajuste UX — 02-01):
          - Primeira abordagem, sem `indice`, e >1 elegível → NÃO marca como
            dado nem entrega; retorna `escolha_necessaria=True`. Frontend
            mostra diálogo e re-chama com `indice`.
          - Com `indice` explícito OU exatamente 1 elegível → comportamento
            original: marca dado e entrega ao músico escolhido/único.
        """
        camp = self._garantir_campanha()
        npc = camp.get_npc(payload["id"])       # NpcInvalidoError → ErroDTO
        ja_deu = npc["dado"]
        tipo = None
        if not ja_deu:
            tipo = npc["item"]
            item = ItemFactory.criar(tipo)
            if "indice" not in payload:
                elegiveis = self._elegiveis(item)
                if len(elegiveis) > 1:
                    return {
                        "ok": True,
                        "escolha_necessaria": True,
                        "ja_deu": False,
                        "fala": npc["fala"],
                        # WR-02: chave distinta — "item" fica reservado p/ string|None.
                        "item_escolha": {
                            "nome": item.nome,
                            "descricao": item.descricao,
                            "classes_permitidas": (list(item.classes_permitidas)
                                                   if getattr(item, "classes_permitidas", None)
                                                   else None),
                        },
                        "elegiveis": elegiveis,
                    }
                indice = elegiveis[0]["indice"]
            else:
                indice = int(payload["indice"])
            # Marca como dado e entrega.
            camp.dar_item_npc(payload["id"])          # marca dado
            musico = self._gerenciador.listar_jogadores()[indice]   # IndexError → ErroDTO
            musico.get_inventario().adicionar(item)   # InventarioCheioError → ErroDTO
        return {
            "ok": True,
            "escolha_necessaria": False,
            "ja_deu": ja_deu,
            "fala": npc["fala"],
            "item": ItemFactory.criar(tipo).nome if tipo else None,
            "campanha": self._campanha_dto(),
        }

    @_ponte
    def abrir_bau(self, payload: dict) -> dict:
        """MAP-03: abre um baú pelo id. Gate de fama no domínio (FamaInsuficienteError
        → ErroDTO). Entrega o item único ao músico ELEGÍVEL pela classe APENAS na
        1ª abertura (D-13 — uma vez só).

        Fluxo com escolha (Ajuste UX — 02-01):
          - 1ª abertura, sem `indice`, e >1 elegível → NÃO marca como aberto
            nem entrega; retorna `escolha_necessaria=True`. Frontend mostra
            diálogo e re-chama com `indice`.
          - Com `indice` explícito OU exatamente 1 elegível → comportamento
            original: marca aberto e entrega ao músico escolhido/único.
        """
        camp = self._garantir_campanha()
        bau = camp.get_bau(payload["id"])       # BauInvalidoError → ErroDTO
        ja_aberto = bau["aberto"]
        item_nome = None
        if not ja_aberto:
            # Peek do tipo sem marcar aberto ainda.
            tipo = bau["item"]
            item = ItemFactory.criar(tipo)
            # WR-03: gate de fama UMA vez, antes de ramificar por `indice`. Vale
            # tanto para o caminho do chooser quanto para o re-call com indice —
            # o domínio (checar_fama_bau) vira a única fonte da verdade.
            camp.checar_fama_bau(payload["id"])   # FamaInsuficienteError → ErroDTO
            if "indice" not in payload:
                elegiveis = self._elegiveis(item)
                if len(elegiveis) > 1:
                    return {
                        "ok": True,
                        "escolha_necessaria": True,
                        "ja_aberto": False,
                        # WR-02: chave distinta — "item" fica reservado p/ string|None.
                        "item_escolha": {
                            "nome": item.nome,
                            "descricao": item.descricao,
                            "classes_permitidas": (list(item.classes_permitidas)
                                                   if getattr(item, "classes_permitidas", None)
                                                   else None),
                        },
                        "elegiveis": elegiveis,
                    }
                indice = elegiveis[0]["indice"]
            else:
                indice = int(payload["indice"])
            # Agora marca aberto e entrega.
            camp.abrir_bau(payload["id"])              # FamaInsuficienteError → ErroDTO; marca aberto
            musico = self._gerenciador.listar_jogadores()[indice]   # IndexError → ErroDTO
            musico.get_inventario().adicionar(item)    # InventarioCheioError → ErroDTO
            item_nome = item.nome
        return {
            "ok": True,
            "escolha_necessaria": False,
            "ja_aberto": ja_aberto,
            "item": item_nome,
            "campanha": self._campanha_dto(),
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
