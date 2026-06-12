// Mock de window.pywebview.api para testes de browser — captura as chamadas
// (especialmente o payload de executar_acao) sem precisar do backend Python.
(function () {
  "use strict";
  const chamadas = [];
  function reg(metodo, payload) { chamadas.push({ metodo, payload }); }

  function bandaMock() {
    return [{ id: 0, tipo: "guitarrista", nome: "Aldric", nivel: 1, hp: 100,
              hp_maximo: 100, xp: 0, vivo: true,
              energia: 100, energia_maxima: 100, cansado: false,   // F3.8
              recurso: { tipo: "ego", valor: 0, max: 100 },
              moves: [   // F3.8: leve/médio/pesado do guitarrista (espelha moves.py)
                { id: "palhetada",   nome: "Palhetada",   mult: 0.8, custo: 5,  cansa: false, chart: "facil" },
                { id: "solo_rapido", nome: "Solo Rápido", mult: 1.0, custo: 12, cansa: false, chart: "rapido" },
                { id: "riff_pesado", nome: "Riff Pesado", mult: 1.5, custo: 25, cansa: true,  chart: "pesado" },
              ] }];
  }
  function estadoMock(boss, turno, fim) {
    return {
      banda: bandaMock(),
      boss: boss || { id: "empresario", nome: "O Empresário", hp: 200, hp_maximo: 200 },
      turno: turno || "banda", fim_de_jogo: !!fim, resultado: fim || null,
    };
  }

  // Campanha mock (espelha Campanha.padrao() do backend) com progresso mutável.
  // F3.4: venues têm fama/xp_recompensa/drop; campanha tem fama_banda e bloqueios.
  const VENUES = [
    { id: "bar",   x: 420,  nome: "Bar do Zé", fama: 1, xp_recompensa: 70,  drop: "energetico",
      capanga: { nome: "Capanga do Bar", hp: 180, dano: 18 } },
    { id: "feira", x: 980,  nome: "Feira Punk", fama: 2, xp_recompensa: 130, drop: "pedal",
      capanga: { nome: "Roadie Valentão", hp: 340, dano: 28 } },
    { id: "arena", x: 1600, nome: "Arena — O Empresário", fama: 3, xp_recompensa: 240, drop: "amplificador",
      capanga: { nome: "O Empresário", hp: 600, dano: 40 } },
  ];
  const ITENS = [
    { id: "i1", x: 250,  tipo: "energetico" },
    { id: "i2", x: 1280, tipo: "pedal" },
  ];
  // MAP-02 (Phase 1): NPCs do overworld (espelha _NPCS_PADRAO do backend).
  const NPCS = [
    { id: "npc1", x: 560,  nome: "Roadie Aposentado",
      fala: "Saudades do estradao... Fica com essa bandana, vai precisar.",
      item: "bandana_sortuda" },
    { id: "npc2", x: 1140, nome: "Fa Fervoroso",
      fala: "Autografo nao, mas essa palheta dourada pode ser sua!",
      item: "palheta_de_ouro" },
    { id: "npc3", x: 1750, nome: "Vendedor de Vinil",
      fala: "Rarissimo! Pressagem original de 1973. So pra voce, cara.",
      item: "vinil_raro" },
  ];
  // MAP-03 (Phase 1): baús do overworld (espelha _BAUS_PADRAO do backend).
  const BAUS = [
    { id: "bau1", x: 20,   item: "jaqueta_lendaria", fama_minima: 0 },
    { id: "bau2", x: 1820, item: "capa_de_lp",       fama_minima: 3 },
  ];
  const progresso = {
    concluidas: new Set(), coletados: new Set(), posicao: 60,
    fama_banda: 0, cache: 0,               // F3.7: cachê por show
    bloqueios: new Set(),   // mock: bloqueio sem timer (só liga/desliga)
    npcs_dados: new Set(),  // MAP-02 (Phase 1): NPCs que já entregaram o item
    baus_abertos: new Set(), // MAP-03 (Phase 1): baús já abertos
  };
  const CACHE_POR_VENUE = { bar: 50, feira: 120, arena: 250 };   // espelha campanha.py
  const LOJA_MOCK = { energetico: 40, cerveja: 25 };             // espelha LOJA da ponte
  function campanhaMock() {
    return {
      venues: VENUES.map((v) => ({
        ...v,
        concluida: progresso.concluidas.has(v.id),
        bloqueada: progresso.bloqueios.has(v.id),
        bloqueada_seg: progresso.bloqueios.has(v.id) ? 30 * v.fama : 0,
      })),
      itens: ITENS.map((i) => ({ ...i, coletado: progresso.coletados.has(i.id) })),
      posicao: progresso.posicao,
      completa: VENUES.every((v) => progresso.concluidas.has(v.id)),
      fama_banda: progresso.fama_banda,
      cache: progresso.cache,
      loja: { x: 700 },        // F3.8: ponto da loja no mapa (espelha campanha.py)
      // MAP-01 (Phase 1): estágio da van derivado da fama (espelha Campanha.van_estagio())
      van_estagio: progresso.fama_banda >= 6 ? 3 : progresso.fama_banda >= 3 ? 2 : 1,
      // MAP-02 (Phase 1): NPCs com flag dado (espelha Campanha.listar_npcs())
      npcs: NPCS.map((n) => ({ ...n, dado: progresso.npcs_dados.has(n.id) })),
      // MAP-03 (Phase 1): baús com flags aberto e revelado (espelha Campanha.listar_baus())
      baus: BAUS.map((b) => ({
        ...b,
        aberto: progresso.baus_abertos.has(b.id),
        revelado: !b.fama_minima || progresso.fama_banda >= b.fama_minima,
      })),
    };
  }
  function dropMock(tipo) {
    if (!tipo) return null;
    const NOMES = { energetico: "Energético", pedal: "Pedal de Efeito", amplificador: "Amplificador" };
    const EQUIP = { pedal: ["Guitarrista", "Baixista"], amplificador: ["Guitarrista", "Baixista"] };
    return { tipo, nome: NOMES[tipo] || tipo, descricao: "", classes_permitidas: EQUIP[tipo] || null };
  }

  // Equipamento mock (F3.6): inventário/slots mutáveis do membro 0 (Aldric).
  function itemMock(tipo) {
    const d = dropMock(tipo);
    const equipavel = !!d.classes_permitidas;
    return {
      nome: d.nome, descricao: d.descricao, equipavel,
      ...(equipavel ? { atributo: "forca", bonus: tipo === "amplificador" ? 8 : 5,
                        classes_permitidas: d.classes_permitidas } : {}),
    };
  }
  const equipState = { equipados: [], inventario: [itemMock("pedal")] };
  function equipamentoDto() {
    return {
      ok: true,
      banda: [{ ...bandaMock()[0], slots: 2,
                equipados: equipState.equipados.map((i) => ({ ...i })),
                inventario: equipState.inventario.map((i) => ({ ...i })) }],
    };
  }

  // Estado de batalha mutável (mock) — criado em entrar_no_show; executar_acao
  // tira HP do boss e turno_inimigo tira de um membro, pro HUD refletir mudança.
  // F3.5b: espelha o contrato de stun/especial do backend — combo perfeito
  // atordoa (vilão perde a próxima vez); 4 perfeitos seguidos liberam o especial.
  let batalha = null;
  let perfeitosSeguidos = 0;
  let bossAtordoado = false;
  function estadoDaBatalha(turno, fim) {
    return {
      banda: batalha.banda, boss: batalha.boss,
      turno: turno || "banda", fim_de_jogo: !!fim, resultado: fim || null,
    };
  }

  window.pywebview = {
    api: {
      criar_banda(comp) { reg("criar_banda", comp); return Promise.resolve(estadoMock()); },
      obter_estado() { reg("obter_estado"); return Promise.resolve(estadoMock()); },
      obter_campanha() { reg("obter_campanha"); return Promise.resolve(campanhaMock()); },
      registrar_posicao(x) { reg("registrar_posicao", x); progresso.posicao = x; return Promise.resolve({ ok: true }); },
      entrar_no_show(venueId) {
        reg("entrar_no_show", venueId);
        const v = VENUES.find((x) => x.id === venueId);
        if (!v) return Promise.resolve({ ok: false, erro: { tipo: "VenueInvalidaError", mensagem: "venue inválida" } });
        if (progresso.bloqueios.has(venueId))
          return Promise.resolve({ ok: false, erro: { tipo: "VenueBloqueadaError", mensagem: "venue bloqueada" } });
        batalha = { banda: bandaMock(), boss: { id: "empresario", nome: v.capanga.nome, hp: v.capanga.hp, hp_maximo: v.capanga.hp } };
        perfeitosSeguidos = 0; bossAtordoado = false;
        return Promise.resolve(estadoDaBatalha("banda", null));
      },
      concluir_venue(venueId) {
        reg("concluir_venue", venueId);
        const v = VENUES.find((x) => x.id === venueId);
        const ja = progresso.concluidas.has(venueId);
        const cacheGanho = ja || !v ? 0 : (CACHE_POR_VENUE[venueId] || 0);
        if (!ja && v) {
          progresso.concluidas.add(venueId); progresso.fama_banda += v.fama;
          progresso.cache += cacheGanho; progresso.bloqueios.delete(venueId);
        }
        return Promise.resolve({
          ok: true,
          campanha: campanhaMock(),
          xp_ganho: ja ? 0 : (v ? v.xp_recompensa : 0),
          cache_ganho: cacheGanho,
          drop: v ? dropMock(v.drop) : null,
        });
      },
      ataque_especial() {
        reg("ataque_especial");
        if (perfeitosSeguidos < 4)
          return Promise.resolve({ ok: false, erro: { tipo: "EspecialIndisponivelError", mensagem: "especial indisponível" } });
        perfeitosSeguidos = 0;
        if (batalha) batalha.boss.hp = Math.max(0, batalha.boss.hp - 120);
        const fim = batalha && batalha.boss.hp <= 0 ? "vitoria" : null;
        return Promise.resolve({
          ok: true, dano: 120, atacante: "Banda (especial)",
          por_membro: [{ atacante: "Aldric", dano: 120 }],
          estado: batalha ? estadoDaBatalha("boss", fim)
                          : estadoMock({ id: "empresario", nome: "mock", hp: 80, hp_maximo: 200 }, "boss", null),
          fim_de_jogo: !!fim, resultado_final: fim,
        });
      },
      aplicar_drop(payload) {
        reg("aplicar_drop", payload);
        equipState.inventario.push(itemMock(payload.tipo));   // F3.6: drop vai pro inventário
        return Promise.resolve({ ok: true, aplicado: "guardado", item: payload.tipo,
          musico: bandaMock()[0] });
      },
      registrar_derrota(venueId) {
        reg("registrar_derrota", venueId);
        const v = VENUES.find((x) => x.id === venueId);
        progresso.bloqueios.add(venueId);
        progresso.fama_banda = Math.max(0, progresso.fama_banda - 1);
        return Promise.resolve({ ok: true, bloqueada_seg: v ? 30 * v.fama : 30, fama_banda: progresso.fama_banda });
      },
      coletar_item(payload) {
        reg("coletar_item", payload);
        const it = ITENS.find((x) => x.id === payload.id);
        if (!it) return Promise.resolve({ ok: false, erro: { tipo: "ItemMapaInvalidoError", mensagem: "item inválido" } });
        progresso.coletados.add(it.id);
        equipState.inventario.push(itemMock(it.tipo));        // F3.6: vai pro inventário
        return Promise.resolve({ ok: true, musico: "Aldric", item: it.tipo,
          tamanho_inventario: equipState.inventario.length, campanha: campanhaMock() });
      },
      // MAP-02 (Phase 1): aborda NPC pelo id — entrega única (D-07).
      abordar_npc(payload) {
        reg("abordar_npc", payload);
        const n = NPCS.find((x) => x.id === payload.id);
        if (!n) return Promise.resolve({ ok: false, erro: { tipo: "NpcInvalidoError", mensagem: "npc invalido" } });
        const ja_deu = progresso.npcs_dados.has(n.id);
        if (!ja_deu) {
          progresso.npcs_dados.add(n.id);
          equipState.inventario.push(itemMock(n.item));
        }
        return Promise.resolve({ ok: true, ja_deu, fala: n.fala,
          item: ja_deu ? null : n.item, campanha: campanhaMock() });
      },
      // MAP-03 (Phase 1): abre baú pelo id — abertura única com gate de fama (D-11/D-13).
      abrir_bau(payload) {
        reg("abrir_bau", payload);
        const b = BAUS.find((x) => x.id === payload.id);
        if (!b) return Promise.resolve({ ok: false, erro: { tipo: "BauInvalidoError", mensagem: "bau invalido" } });
        // D-13: entrega só na 1ª abertura; reabrir não duplica (espelha o guard da ponte).
        const jaAberto = progresso.baus_abertos.has(b.id);
        if (jaAberto) {
          return Promise.resolve({ ok: true, ja_aberto: true, item: null, campanha: campanhaMock() });
        }
        if (progresso.fama_banda < (b.fama_minima || 0))
          return Promise.resolve({ ok: false, erro: { tipo: "FamaInsuficienteError", mensagem: "fama insuficiente para abrir este bau" } });
        progresso.baus_abertos.add(b.id);
        equipState.inventario.push(itemMock(b.item));
        return Promise.resolve({ ok: true, ja_aberto: false, item: b.item, campanha: campanhaMock() });
      },
      executar_acao(payload) {
        reg("executar_acao", payload);
        // F3.8: valida cansaço/energia ANTES de qualquer efeito (espelha show.py).
        const atacante0 = batalha && batalha.banda[payload && payload.indice || 0];
        const move = atacante0 && (atacante0.moves || []).find((mv) => mv.id === (payload && payload.move_id));
        if (atacante0 && atacante0.cansado)
          return Promise.resolve({ ok: false, erro: { tipo: "MusicoCansadoError", mensagem: "cansado — perde esta vez" } });
        if (atacante0 && move && atacante0.energia < move.custo)
          return Promise.resolve({ ok: false, erro: { tipo: "EnergiaInsuficienteError", mensagem: "sem energia pro golpe" } });
        if (atacante0 && move) {
          atacante0.energia -= move.custo;
          if (move.cansa) atacante0.cansado = true;
        }
        const r = payload && payload.ritmo;
        const perfeito = !!(r && r.acertos >= r.total_notas);
        if (perfeito) { perfeitosSeguidos += 1; bossAtordoado = true; }
        else perfeitosSeguidos = 0;
        if (batalha) batalha.boss.hp = Math.max(0, batalha.boss.hp - 30);
        const fim = batalha && batalha.boss.hp <= 0 ? "vitoria" : null;
        return Promise.resolve({
          ok: true, dano: 30, critico: false, modo_refrao_ativo: false,
          multiplicador_aplicado: 1.0, atacante: "mock",
          perfeito, atordoado: bossAtordoado, perfeitos_seguidos: perfeitosSeguidos,
          especial_disponivel: perfeitosSeguidos >= 4,
          estado: batalha ? estadoDaBatalha("boss", fim)
                          : estadoMock({ id: "empresario", nome: "mock", hp: 200, hp_maximo: 200 }, "boss", null),
          fim_de_jogo: !!fim, resultado_final: fim,
        });
      },
      turno_inimigo() {
        reg("turno_inimigo");
        if (batalha) {              // F3.8: a rodada vira — banda descansa + regenera
          batalha.banda.forEach((m) => {
            if (m.vivo) { m.cansado = false; m.energia = Math.min(m.energia_maxima, m.energia + 8); }
          });
        }
        if (bossAtordoado) {        // stun consome a vez do vilão (espelha o backend)
          bossAtordoado = false;
          return Promise.resolve({ ok: true, atacante: "mock", alvo: null, dano: 0,
            atordoado: true,
            estado: batalha ? estadoDaBatalha("banda", null) : estadoMock(null, "banda", null),
            fim_de_jogo: false, resultado_final: null });
        }
        let alvo = "mock";
        if (batalha && batalha.banda[0]) {
          const m = batalha.banda[0];
          m.hp = Math.max(0, m.hp - 20); m.vivo = m.hp > 0; alvo = m.nome;
        }
        const fim = batalha && batalha.banda.every((m) => !m.vivo) ? "derrota" : null;
        return Promise.resolve({ ok: true, atacante: "mock", alvo, dano: 20, atordoado: false,
          estado: batalha ? estadoDaBatalha("banda", fim) : estadoMock(null, "banda", null),
          fim_de_jogo: !!fim, resultado_final: fim });
      },
      nova_campanha() {
        reg("nova_campanha");
        progresso.concluidas.clear(); progresso.coletados.clear();
        progresso.bloqueios.clear(); progresso.posicao = 60; progresso.fama_banda = 0;
        progresso.npcs_dados.clear();   // MAP-02: reseta entregas de NPCs
        progresso.baus_abertos.clear(); // MAP-03: reseta aberturas de baús
        return Promise.resolve({ ok: true, campanha: campanhaMock() });
      },
      obter_equipamento() { reg("obter_equipamento"); return Promise.resolve(equipamentoDto()); },
      regenerar_banda(seg) {
        reg("regenerar_banda", seg);
        if (batalha) {   // mock: cura + energia no estado mutável se existir (F3.8)
          batalha.banda.forEach((m) => {
            m.cansado = false;
            if (m.vivo) {
              m.hp = Math.min(m.hp_maximo, m.hp + 2 * Math.min(seg, 10));
              m.energia = Math.min(m.energia_maxima, m.energia + 2 * Math.min(seg, 10));
            }
          });
        }
        return Promise.resolve({ ok: true, banda: batalha ? batalha.banda : bandaMock() });
      },
      comprar(payload) {
        reg("comprar", payload);
        const preco = LOJA_MOCK[payload.tipo];
        if (preco == null) return Promise.resolve({ ok: false, erro: { tipo: "JogoError", mensagem: "a loja não vende isso" } });
        if (progresso.cache < preco)
          return Promise.resolve({ ok: false, erro: { tipo: "CacheInsuficienteError", mensagem: "cachê insuficiente" } });
        progresso.cache -= preco;
        equipState.inventario.push(itemMock(payload.tipo));
        return Promise.resolve({ ok: true, item: itemMock(payload.tipo).nome, cache: progresso.cache, musico: bandaMock()[0] });
      },
      usar_item(payload) {
        reg("usar_item", payload);
        const i = equipState.inventario.findIndex((x) => x.nome === payload.nome && !x.equipavel);
        if (i < 0) return Promise.resolve({ ok: false, erro: { tipo: "ItemIncompativelError", mensagem: "não é um consumível do inventário" } });
        equipState.inventario.splice(i, 1);
        const m = bandaMock()[0]; m.hp = 100;
        return Promise.resolve({ ok: true, item: payload.nome, musico: m });
      },
      equipar(payload) {
        reg("equipar", payload);
        const i = equipState.inventario.findIndex((x) => x.nome === payload.nome);
        if (i < 0) return Promise.resolve({ ok: false, erro: { tipo: "ItemNaoEncontradoError", mensagem: "item não está no inventário" } });
        if (equipState.equipados.length >= 2)
          return Promise.resolve({ ok: false, erro: { tipo: "SlotsOcupadosError", mensagem: "slots ocupados" } });
        equipState.equipados.push(equipState.inventario.splice(i, 1)[0]);
        return Promise.resolve(equipamentoDto());
      },
      desequipar(payload) {
        reg("desequipar", payload);
        const i = equipState.equipados.findIndex((x) => x.nome === payload.nome);
        if (i < 0) return Promise.resolve({ ok: false, erro: { tipo: "ItemNaoEncontradoError", mensagem: "item não está equipado" } });
        equipState.inventario.push(equipState.equipados.splice(i, 1)[0]);
        return Promise.resolve(equipamentoDto());
      },
      sair() { reg("sair"); return Promise.resolve({ ok: true }); },
      salvar(slot) { reg("salvar", slot); return Promise.resolve({ ok: true, slot }); },
      carregar(slot) { reg("carregar", slot); return Promise.resolve({ ok: true, estado: estadoMock() }); },
    },
  };
  window.__mockApi = {
    chamadas,
    ultimo() { return chamadas[chamadas.length - 1]; },
    nomes() { return chamadas.map((c) => c.metodo); },
    limpar() { chamadas.length = 0; },
  };
})();
