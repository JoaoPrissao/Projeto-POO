// RitmoMusica — temas CC0 em loop por venue (D-01/D-04/D-05/D-08).
// Carrega arquivos .ogg de assets/audio/ (relativo ao index.html) via fetch + decodeAudioData,
// toca em loop gapless com AudioBufferSourceNode.loop = true (Padrão 1).
// Duck via GainNode.gain.linearRampToValueAtTime (Padrão 2).
// No-op-able: sem AudioContext = silêncio total, zero throw (Padrão 3/REQ6).
//
// Ventas de confiança: venueId é validado contra allowlist antes do fetch (V5/T-03.1-01).
// Genérico: tocarTema() serve overworld depois sem refactor (D-08).
//
// Pendurado em window.RitmoMusica = { criar, nulo } (sem ES modules).

(function () {
  "use strict";

  // Venues válidos — allowlist de path traversal (T-03.1-01 / ASVS V5)
  const VENUES_VALIDOS = new Set(["bar", "feira", "arena", "overworld"]);

  // Duck: abaixar para 15% em 0.3s; retomar para 100% em 0.5s (Padrão 2, Claude's Discretion)
  const DUCK_VOLUME = 0.15;
  const RAMP_DOWN   = 0.3;
  const RAMP_UP     = 0.5;

  function criar() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    // Sem AudioContext (JSDOM, harnesses): retorna nulo imediatamente.
    // NUNCA chamar fetch/decodeAudioData neste caminho (Landmine L5).
    if (!Ctx) return nulo();

    let ctx = null;

    function garantirContexto() {
      if (!ctx) ctx = new Ctx();
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }

    // GainNode master: todas as fontes de tema conectam aqui.
    // Criado com lazy init junto ao contexto.
    let gainMaster = null;
    function garantirGain() {
      if (!gainMaster) {
        const ac = garantirContexto();
        gainMaster = ac.createGain();
        gainMaster.connect(ac.destination);
        // Respeita mute E volume já ativos ao criar a instância
        gainMaster.gain.value = (window.RitmoMuteGate ? window.RitmoMuteGate.nivelEfetivo : 1);
      }
      return gainMaster;
    }

    // Cache de AudioBuffer por venueId (Landmine L2: buffer é reutilizável; source é one-shot)
    const _bufferCache = {};

    async function obterBuffer(venueId) {
      if (_bufferCache[venueId]) return _bufferCache[venueId];
      const ac = garantirContexto();
      // Caminho relativo ao index.html — NÃO ao cwd Python (Landmine L7)
      try {
        const r = await fetch("assets/audio/" + venueId + ".ogg");
        if (!r.ok) return null;
        const buf = await r.arrayBuffer();
        _bufferCache[venueId] = await ac.decodeAudioData(buf);
        return _bufferCache[venueId];
      } catch (_) {
        // Falha de fetch/decode = silêncio; nunca derruba o jogo (T-03.1-03)
        return null;
      }
    }

    // Source ativo: ≤ 1 loop garantido (REQ4)
    let sourceAtivo = null;

    return {
      // Toca o tema do venue em loop. Para o anterior antes (≤ 1 loop).
      async tocarTema(venueId) {
        // Validação de venueId contra allowlist (T-03.1-01 / V5)
        if (!VENUES_VALIDOS.has(venueId)) return;
        try {
          const gm = garantirGain();
          const ac = garantirContexto();
          // Para o source anterior (Padrão 1 / REQ4)
          if (sourceAtivo) {
            try { sourceAtivo.stop(); } catch (_) {}
            sourceAtivo = null;
          }
          const buffer = await obterBuffer(venueId);
          if (!buffer) return; // arquivo ausente = silêncio
          // AudioBuffer reutilizável; AudioBufferSourceNode é one-shot (Landmine L3)
          const src = ac.createBufferSource();
          src.buffer = buffer;
          src.loop = true; // loop gapless nativo (Padrão 1)
          src.connect(gm);
          src.start();
          sourceAtivo = src;
        } catch (_) {
          /* áudio é cosmético — nunca derruba o jogo */
        }
      },

      // Para o tema ativo (≤ 1 loop garantido).
      parar() {
        if (sourceAtivo) {
          try { sourceAtivo.stop(); } catch (_) {}
          sourceAtivo = null;
        }
      },

      // Abaixa o volume para DUCK_VOLUME em RAMP_DOWN segundos (durante o minigame).
      duck() {
        try {
          const gm = garantirGain();
          const ac = garantirContexto();
          // cancelScheduledValues antes de agendar novo ramp (Landmine L5)
          const t = ac.currentTime;
          gm.gain.cancelScheduledValues(t);
          gm.gain.setValueAtTime(gm.gain.value, t);
          // Duck relativo ao volume atual (mute × volume), não absoluto
          const base = (window.RitmoMuteGate ? window.RitmoMuteGate.nivelEfetivo : 1);
          gm.gain.linearRampToValueAtTime(base * DUCK_VOLUME, t + RAMP_DOWN);
        } catch (_) {}
      },

      // Retoma o volume para 1.0 em RAMP_UP segundos. Respeita o mute.
      retoma() {
        try {
          const gm = garantirGain();
          const ac = garantirContexto();
          // Sobe até o nível efetivo (0 se mutado; senão o volume atual)
          const alvo = (window.RitmoMuteGate ? window.RitmoMuteGate.nivelEfetivo : 1.0);
          const t = ac.currentTime;
          gm.gain.cancelScheduledValues(t);
          gm.gain.setValueAtTime(gm.gain.value, t);
          gm.gain.linearRampToValueAtTime(alvo, t + RAMP_UP);
        } catch (_) {}
      },

      // Aplica o nível efetivo (mute × volume) ao gainMaster (D-06).
      aplicarMute() {
        try {
          const gm = garantirGain();
          gm.gain.value = (window.RitmoMuteGate ? window.RitmoMuteGate.nivelEfetivo : 1);
        } catch (_) {}
      },

      // Reaplica o nível efetivo (mute × volume) ao vivo — usado pelo slider de Opções.
      aplicarVolume() {
        try {
          const gm = garantirGain();
          gm.gain.value = (window.RitmoMuteGate ? window.RitmoMuteGate.nivelEfetivo : 1);
        } catch (_) {}
      },
    };
  }

  function nulo() {
    return {
      tocarTema() {},
      parar() {},
      duck() {},
      retoma() {},
      aplicarMute() {},
      aplicarVolume() {},
    };
  }

  window.RitmoMusica = { criar, nulo };
})();
