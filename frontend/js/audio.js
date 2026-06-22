// Wrapper Web Audio do minigame — som 100% sintetizado (OscillatorNode), sem
// arquivos de áudio (zero asset, zero questão de copyright). Acerto = beep curto
// agudo; erro = buzz grave. É no-op-able: se o AudioContext não existir (ou em
// teste), tudo vira no-op silencioso.
//
// Extensão D-03: método solo(timbre, pitchHz, acerto) com 4 timbres distintos
// (guitarrista/vocalista/baixista/baterista). Todos os emissores checam
// window.RitmoMuteGate antes de emitir (D-01b/D-06).
//
// Pendurado em window.RitmoAudio (sem ES modules).

(function () {
  "use strict";

  // ── Tabela de timbres (D-03) ────────────────────────────────────────────────
  // 4 assinaturas perceptualmente distintas: waveform + região de frequência + duração.
  const TIMBRES = {
    // Guitarrista (Geraldo Muleta): square agudo, som distorcido
    guitarrista: {
      wave: "square",    // distorção natural do square
      freqMult: 1.0,     // pitch direto (região 400–1200 Hz no solo)
      attack: 0.008,     // ataque rápido — pick de guitarra
      gainAcerto: 0.22,  // volume de acerto (limpo, acentuado)
      gainErro: 0.10,    // volume de erro (abafado)
      durAcerto: 0.14,   // duração do acerto em segundos
      durErro: 0.08,     // duração do erro (mais curto, abafado)
    },
    // Vocalista (Vande Bicuda): triangle médio, timbre vocal suave
    vocalista: {
      wave: "triangle",  // harmônicos suaves, parecido com voz
      freqMult: 0.5,     // oitava abaixo do guitarrista → região 200–600 Hz
      attack: 0.020,     // ataque mais lento — voz tem onset gradual
      gainAcerto: 0.30,  // voz mais presente no mix
      gainErro: 0.08,
      durAcerto: 0.20,   // sustentado — nota vocal tem mais duração
      durErro: 0.10,
    },
    // Baixista (Marivaldo): sine grave, profundidade sem harmônicos
    baixista: {
      wave: "sine",      // sub-grave puro, sem harmônicos superiores
      freqMult: 0.25,    // duas oitavas abaixo do guitarrista → 80–300 Hz
      attack: 0.015,
      gainAcerto: 0.40,  // grave requer mais gain para parecer igual em volume
      gainErro: 0.12,
      durAcerto: 0.18,
      durErro: 0.09,
    },
    // Baterista (Ramiro Paulada): noise burst percussivo, sem pitch melódico
    baterista: {
      wave: "noise",     // tag especial — implementação via noise buffer (bateristaHit)
      freqMult: 1.0,     // ignorado no noise; controla o highpass filter
      attack: 0.002,     // ataque mínimo — percussão é imediata
      gainAcerto: 0.35,
      gainErro: 0.10,
      durAcerto: 0.08,   // muito curto — snap percussivo
      durErro: 0.04,
    },
  };

  // ── Noise burst percussivo (baterista) ──────────────────────────────────────
  // Math.random() aqui é seguro: solo() é chamado em callback de evento (acerto/erro),
  // NUNCA dentro de passo(dt)/desenhar() — não viola o determinismo do draw (REQ6).
  function bateristaHit(ac, acerto) {
    try {
      const durSeg = acerto ? 0.08 : 0.04;
      const tamBuffer = Math.ceil(ac.sampleRate * durSeg);
      const buf = ac.createBuffer(1, tamBuffer, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < tamBuffer; i++) data[i] = Math.random() * 2 - 1;

      const src = ac.createBufferSource();
      src.buffer = buf;

      // Highpass para cortar sub-grave e dar caráter de snare/chapéu
      const filtro = ac.createBiquadFilter();
      filtro.type = "highpass";
      filtro.frequency.value = acerto ? 2000 : 800; // acerto = mais brilho

      const gain = ac.createGain();
      const t = ac.currentTime;
      gain.gain.setValueAtTime(acerto ? 0.35 : 0.10, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + durSeg);

      src.connect(filtro).connect(gain).connect(ac.destination);
      src.start(t);
      src.stop(t + durSeg + 0.01);
    } catch (_) {
      /* áudio é cosmético — nunca derruba o jogo */
    }
  }

  function criar() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return nulo();

    let ctx = null;

    function garantirContexto() {
      if (!ctx) ctx = new Ctx();
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }

    function bipe(freq, duracao, tipo, ganhoPico) {
      if (window.RitmoMuteGate && window.RitmoMuteGate.mutado) return;
      try {
        const ac = garantirContexto();
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = tipo;
        osc.frequency.value = freq;
        const t = ac.currentTime;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(ganhoPico, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + duracao);
        osc.connect(gain).connect(ac.destination);
        osc.start(t);
        osc.stop(t + duracao + 0.02);
      } catch (_) {
        /* áudio é cosmético — nunca derruba o jogo */
      }
    }

    return {
      iniciar() { garantirContexto(); },
      parar() { /* osciladores são one-shot; nada a manter vivo */ },
      acerto() {
        if (window.RitmoMuteGate && window.RitmoMuteGate.mutado) return;
        bipe(880, 0.09, "triangle", 0.25);
      },
      erro() {
        if (window.RitmoMuteGate && window.RitmoMuteGate.mutado) return;
        bipe(120, 0.18, "sawtooth", 0.2);
      },
      batida() {
        if (window.RitmoMuteGate && window.RitmoMuteGate.mutado) return;
        bipe(220, 0.05, "sine", 0.12);
      },
      // VIS-02: SFX dos momentos-chave de gameplay
      golpe() {
        if (window.RitmoMuteGate && window.RitmoMuteGate.mutado) return;
        bipe(300, 0.12, "sawtooth", 0.3);
      },
      critico() {
        if (window.RitmoMuteGate && window.RitmoMuteGate.mutado) return;
        bipe(660, 0.07, "square", 0.35); bipe(880, 0.12, "triangle", 0.2);
      },
      vitoria() {
        if (window.RitmoMuteGate && window.RitmoMuteGate.mutado) return;
        bipe(523, 0.18, "triangle", 0.3); bipe(659, 0.22, "triangle", 0.3);
      },
      item() {
        if (window.RitmoMuteGate && window.RitmoMuteGate.mutado) return;
        bipe(1046, 0.06, "sine", 0.2);
      },
      // D-03: solo melódico por timbre de instrumento
      solo(timbre, pitchHz, acerto) {
        if (window.RitmoMuteGate && window.RitmoMuteGate.mutado) return;
        const cfg = TIMBRES[timbre] || TIMBRES.guitarrista;
        // Baterista usa noise buffer — sem pitch melódico
        if (cfg.wave === "noise") { bateristaHit(garantirContexto(), acerto); return; }
        try {
          const ac = garantirContexto();
          const osc = ac.createOscillator();
          const gain = ac.createGain();
          osc.type = cfg.wave;
          osc.frequency.value = pitchHz * cfg.freqMult;
          const t = ac.currentTime;
          const pico = acerto ? cfg.gainAcerto : cfg.gainErro;
          const dur  = acerto ? cfg.durAcerto  : cfg.durErro;
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.exponentialRampToValueAtTime(pico, t + cfg.attack);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          osc.connect(gain).connect(ac.destination);
          osc.start(t);
          osc.stop(t + dur + 0.02);
        } catch (_) {
          /* áudio é cosmético — nunca derruba o jogo */
        }
      },
    };
  }

  function nulo() {
    return { iniciar() {}, parar() {}, acerto() {}, erro() {}, batida() {},
             golpe() {}, critico() {}, vitoria() {}, item() {},
             solo() {} };
  }

  window.RitmoAudio = { criar, nulo };
})();
