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
  const VENUES = [
    { id: "bar",   x: 420,  nome: "Bar do Zé", capanga: { nome: "Capanga do Bar", hp: 60, dano: 8 } },
    { id: "feira", x: 980,  nome: "Feira Punk", capanga: { nome: "Roadie Valentão", hp: 95, dano: 12 } },
    { id: "arena", x: 1600, nome: "Arena — O Empresário", capanga: { nome: "O Empresário", hp: 200, dano: 20 } },
  ];
  const ITENS = [
    { id: "i1", x: 250,  tipo: "energetico" },
    { id: "i2", x: 1280, tipo: "pedal" },
  ];
  const progresso = { concluidas: new Set(), coletados: new Set(), posicao: 60 };
  function campanhaMock() {
    return {
      venues: VENUES.map((v) => ({ ...v, concluida: progresso.concluidas.has(v.id) })),
      itens: ITENS.map((i) => ({ ...i, coletado: progresso.coletados.has(i.id) })),
      posicao: progresso.posicao,
      completa: VENUES.every((v) => progresso.concluidas.has(v.id)),
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
        return Promise.resolve(estadoMock(
          { id: "empresario", nome: v.capanga.nome, hp: v.capanga.hp, hp_maximo: v.capanga.hp }, "banda", null));
      },
      concluir_venue(venueId) {
        reg("concluir_venue", venueId);
        progresso.concluidas.add(venueId);
        return Promise.resolve({ ok: true, ...campanhaMock() });
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
        return Promise.resolve({
          ok: true, dano: 0, critico: false, modo_refrao_ativo: false,
          multiplicador_aplicado: 1.0, atacante: "mock",
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
