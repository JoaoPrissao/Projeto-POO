// Mock de window.pywebview.api para testes de browser — captura as chamadas
// (especialmente o payload de executar_acao) sem precisar do backend Python.
(function () {
  "use strict";
  const chamadas = [];
  window.pywebview = {
    api: {
      executar_acao(payload) {
        chamadas.push({ metodo: "executar_acao", payload });
        return Promise.resolve({
          ok: true, dano: 0, critico: false, modo_refrao_ativo: false,
          multiplicador_aplicado: 1.0, atacante: "mock",
          estado: { banda: [], boss: { hp: 200, hp_maximo: 200 }, turno: "boss",
                    fim_de_jogo: false, resultado: null },
          fim_de_jogo: false, resultado_final: null,
        });
      },
    },
  };
  window.__mockApi = {
    chamadas,
    ultimo() { return chamadas[chamadas.length - 1]; },
    limpar() { chamadas.length = 0; },
  };
})();
