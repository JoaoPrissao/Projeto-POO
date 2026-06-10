// Mock de window.pywebview.api para testes de browser — captura as chamadas
// (especialmente o payload de executar_acao) sem precisar do backend Python.
(function () {
  "use strict";
  const chamadas = [];
  function reg(metodo, payload) { chamadas.push({ metodo, payload }); }

  function bandaMock() {
    return [{ id: 0, tipo: "guitarrista", nome: "Aldric", nivel: 1, hp: 100,
              hp_maximo: 100, xp: 0, vivo: true,
              recurso: { tipo: "ego", valor: 0, max: 100 } }];
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
    { id: "bar",   x: 420,  nome: "Bar do Zé", fama: 1, xp_recompensa: 60,  drop: "energetico",
      capanga: { nome: "Capanga do Bar", hp: 90, dano: 10 } },
    { id: "feira", x: 980,  nome: "Feira Punk", fama: 2, xp_recompensa: 110, drop: "pedal",
      capanga: { nome: "Roadie Valentão", hp: 150, dano: 16 } },
    { id: "arena", x: 1600, nome: "Arena — O Empresário", fama: 3, xp_recompensa: 200, drop: "amplificador",
      capanga: { nome: "O Empresário", hp: 280, dano: 24 } },
  ];
  const ITENS = [
    { id: "i1", x: 250,  tipo: "energetico" },
    { id: "i2", x: 1280, tipo: "pedal" },
  ];
  const progresso = {
    concluidas: new Set(), coletados: new Set(), posicao: 60,
    fama_banda: 0, bloqueios: new Set(),   // mock: bloqueio sem timer (só liga/desliga)
  };
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
    };
  }
  function dropMock(tipo) {
    if (!tipo) return null;
    const NOMES = { energetico: "Energético", pedal: "Pedal de Efeito", amplificador: "Amplificador" };
    const EQUIP = { pedal: ["Guitarrista", "Baixista"], amplificador: ["Guitarrista", "Baixista"] };
    return { tipo, nome: NOMES[tipo] || tipo, descricao: "", classes_permitidas: EQUIP[tipo] || null };
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
        return Promise.resolve(estadoMock(
          { id: "empresario", nome: v.capanga.nome, hp: v.capanga.hp, hp_maximo: v.capanga.hp }, "banda", null));
      },
      concluir_venue(venueId) {
        reg("concluir_venue", venueId);
        const v = VENUES.find((x) => x.id === venueId);
        const ja = progresso.concluidas.has(venueId);
        if (!ja && v) { progresso.concluidas.add(venueId); progresso.fama_banda += v.fama; progresso.bloqueios.delete(venueId); }
        return Promise.resolve({
          ok: true,
          campanha: campanhaMock(),
          xp_ganho: ja ? 0 : (v ? v.xp_recompensa : 0),
          drop: v ? dropMock(v.drop) : null,
        });
      },
      ataque_especial() {
        reg("ataque_especial");
        return Promise.resolve({
          ok: true, dano: 120, atacante: "Banda (especial)",
          por_membro: [{ atacante: "Aldric", dano: 120 }],
          estado: estadoMock({ id: "empresario", nome: "mock", hp: 80, hp_maximo: 200 }, "boss", null),
          fim_de_jogo: false, resultado_final: null,
        });
      },
      aplicar_drop(payload) {
        reg("aplicar_drop", payload);
        const equip = payload.tipo === "pedal" || payload.tipo === "amplificador";
        return Promise.resolve({ ok: true, aplicado: equip ? "equipado" : "guardado", item: payload.tipo,
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
        return Promise.resolve({ ok: true, musico: "Aldric", item: it.tipo, tamanho_inventario: 1, campanha: campanhaMock() });
      },
      executar_acao(payload) {
        reg("executar_acao", payload);
        const r = payload && payload.ritmo;
        const perfeito = !!(r && r.acertos >= r.total_notas);
        return Promise.resolve({
          ok: true, dano: 0, critico: false, modo_refrao_ativo: false,
          multiplicador_aplicado: 1.0, atacante: "mock",
          perfeito, atordoado: perfeito, perfeitos_seguidos: perfeito ? 1 : 0,
          especial_disponivel: false,
          estado: estadoMock({ id: "empresario", nome: "mock", hp: 200, hp_maximo: 200 }, "boss", null),
          fim_de_jogo: false, resultado_final: null,
        });
      },
      turno_inimigo() {
        reg("turno_inimigo");
        return Promise.resolve({ ok: true, atacante: "mock", alvo: "Aldric", dano: 0,
          estado: estadoMock(null, "banda", null), fim_de_jogo: false, resultado_final: null });
      },
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
