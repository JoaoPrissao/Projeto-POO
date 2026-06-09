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

  window.pywebview = {
    api: {
      criar_banda(comp) { reg("criar_banda", comp); return Promise.resolve(estadoMock()); },
      obter_estado() { reg("obter_estado"); return Promise.resolve(estadoMock()); },
      entrar_no_show(venue) {
        reg("entrar_no_show", venue);
        return Promise.resolve(estadoMock(
          { id: "empresario", nome: venue.nome, hp: venue.hp, hp_maximo: venue.hp }, "banda", null));
      },
      coletar_item(payload) {
        reg("coletar_item", payload);
        return Promise.resolve({ ok: true, musico: "Aldric", item: payload.tipo, tamanho_inventario: 1 });
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
