// Gate de mute compartilhado — ponto ÚNICO consultado por TODOS os emissores de áudio:
// SFX em main.js (audio.acerto/erro/golpe/etc.), solos em ritmo.js (audio.solo),
// e RitmoMusica (gainMaster). Implementa D-01b: flag de módulo em window.RitmoMuteGate.
//
// Deve ser carregado ANTES de audio.js, musica.js e qualquer consumidor.
//
// Chave de persistência: localStorage['ritmo_muted'] ("1" = mutado, "0" ou ausente = ativo).

(function () {
  "use strict";

  const KEY = "ritmo_muted";
  let _mutado = false;

  // Inicialização: lê o estado persistido sem lançar em ambientes sem localStorage.
  try {
    _mutado = localStorage.getItem(KEY) === "1";
  } catch (_) {
    /* sem localStorage (ex.: harness/JSDOM com bloqueio de storage) — padrão: som ativo */
  }

  window.RitmoMuteGate = {
    /** Retorna true se o áudio está globalmente mutado. */
    get mutado() { return _mutado; },

    /** Inverte o estado de mute e persiste em localStorage. */
    toggle() {
      _mutado = !_mutado;
      try {
        localStorage.setItem(KEY, _mutado ? "1" : "0");
      } catch (_) {
        /* sem localStorage — estado só vive na sessão atual */
      }
    },

    /** Relê o estado do localStorage e retorna o booleano. */
    carregar() {
      try {
        _mutado = localStorage.getItem(KEY) === "1";
      } catch (_) {
        /* sem localStorage — mantém estado em memória */
      }
      return _mutado;
    },
  };
})();
