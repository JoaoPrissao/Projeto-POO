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
  const VOL_KEY = "ritmo_volume";
  const VOL_DEFAULT = 0.35;
  let _mutado = false;
  let _volume = VOL_DEFAULT;

  function _clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  // Inicialização: lê o estado persistido sem lançar em ambientes sem localStorage.
  try {
    _mutado = localStorage.getItem(KEY) === "1";
    const v = parseFloat(localStorage.getItem(VOL_KEY));
    if (isFinite(v)) _volume = _clamp(v);
  } catch (_) {
    /* sem localStorage (ex.: harness/JSDOM com bloqueio de storage) — padrões em memória */
  }

  window.RitmoMuteGate = {
    /** Retorna true se o áudio está globalmente mutado. */
    get mutado() { return _mutado; },

    /** Volume master 0–1 (independente do mute). */
    get volume() { return _volume; },

    /** Nível de saída efetivo: 0 se mutado, senão o volume. */
    get nivelEfetivo() { return _mutado ? 0 : _volume; },

    /** Inverte o estado de mute e persiste em localStorage. */
    toggle() {
      _mutado = !_mutado;
      try {
        localStorage.setItem(KEY, _mutado ? "1" : "0");
      } catch (_) {
        /* sem localStorage — estado só vive na sessão atual */
      }
    },

    /** Define o volume (clampado 0–1) e persiste em localStorage. */
    setVolume(v) {
      _volume = _clamp(Number(v));
      try {
        localStorage.setItem(VOL_KEY, String(_volume));
      } catch (_) {
        /* sem localStorage — estado só vive na sessão atual */
      }
    },

    /** Relê mute + volume do localStorage e retorna o booleano de mute. */
    carregar() {
      try {
        _mutado = localStorage.getItem(KEY) === "1";
        const v = parseFloat(localStorage.getItem(VOL_KEY));
        if (isFinite(v)) _volume = _clamp(v);
      } catch (_) {
        /* sem localStorage — mantém estado em memória */
      }
      return _mutado;
    },
  };
})();
