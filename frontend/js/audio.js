// Wrapper Web Audio do minigame — som 100% sintetizado (OscillatorNode), sem
// arquivos de áudio (zero asset, zero questão de copyright). Acerto = beep curto
// agudo; erro = buzz grave. É no-op-able: se o AudioContext não existir (ou em
// teste), tudo vira no-op silencioso.
//
// Extensão D-03: método solo(timbre, pitchHz, acerto) com 4 timbres distintos
// (guitarrista/vocalista/baixista/baterista). Todos os emissores checam
// window.RitmoMuteGate antes de emitir (D-01b/D-06).
//
// GF2: cadeias de síntese ricas por timbre (waveshaper/lowpass/formantes/vibrato/thump).
//
// Pendurado em window.RitmoAudio (sem ES modules).

(function () {
  "use strict";

  // ── Tabela de timbres (D-03) ────────────────────────────────────────────────
  // Campos lidos por solo(): gainAcerto/gainErro/durAcerto/durErro/attack/freqMult/wave.
  const TIMBRES = {
    // Guitarrista (Geraldo Muleta): sawtooth → waveshaper dist → lowpass → pluck
    guitarrista: {
      wave: "sawtooth",
      freqMult: 1.0,
      attack: 0.005,
      gainAcerto: 0.30,
      gainErro: 0.12,
      durAcerto: 0.16,
      durErro: 0.08,
    },
    // Vocalista (Vande Bicuda): sawtooth → formantes bandpass → vibrato LFO → onset gradual
    vocalista: {
      wave: "sawtooth",
      freqMult: 0.5,
      attack: 0.025,
      gainAcerto: 0.28,
      gainErro: 0.08,
      durAcerto: 0.22,
      durErro: 0.10,
    },
    // Baixista (Marivaldo): sine + 2º harmônico suave → lowpass grave → punch
    baixista: {
      wave: "sine",
      freqMult: 0.25,
      attack: 0.010,
      gainAcerto: 0.38,
      gainErro: 0.12,
      durAcerto: 0.20,
      durErro: 0.09,
    },
    // Baterista (Ramiro Paulada): noise burst (snap) + corpo pitched (thump)
    baterista: {
      wave: "noise",     // tag especial — implementação via bateristaHit()
      freqMult: 1.0,
      attack: 0.002,
      gainAcerto: 0.35,
      gainErro: 0.10,
      durAcerto: 0.10,
      durErro: 0.05,
    },
  };

  // ── Curva de saturação (WaveShaper) ─────────────────────────────────────────
  // Gerada uma vez por quantidade de pontos e cacheada — evita realocar por nota.
  const _curvasDistorcao = {};
  function curvaDistorcao(pontos, quantidade) {
    const k = pontos + "_" + quantidade;
    if (_curvasDistorcao[k]) return _curvasDistorcao[k];
    const curva = new Float32Array(pontos);
    for (let i = 0; i < pontos; i++) {
      const x = (i * 2) / pontos - 1;
      curva[i] = ((Math.PI + quantidade) * x) / (Math.PI + quantidade * Math.abs(x));
    }
    _curvasDistorcao[k] = curva;
    return curva;
  }

  // ── Síntese: guitarrista — sawtooth → waveshaper → lowpass → pluck env ──────
  // Opcional: 2º osc detunado em quinta (ganho leve) para encorpar power-chord.
  function guitarristaHit(ac, destino, pitchHz, cfg, acerto) {
    try {
      const t = ac.currentTime;
      const pico = acerto ? cfg.gainAcerto : cfg.gainErro;
      const dur  = acerto ? cfg.durAcerto  : cfg.durErro;
      const freq = pitchHz * cfg.freqMult;

      // Fonte principal: sawtooth
      const osc = ac.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;

      // 2º osc em quinta (freq*1.5), ganho menor — body/power-chord
      const osc2 = ac.createOscillator();
      osc2.type = "sawtooth";
      osc2.frequency.value = freq * 1.5;

      const gainMix = ac.createGain();
      gainMix.gain.value = 1.0;
      const gainOsc2 = ac.createGain();
      gainOsc2.gain.value = 0.3;

      // WaveShaper: saturação forte (guitarra distorcida)
      const shaper = ac.createWaveShaper();
      shaper.curve = curvaDistorcao(256, 200);
      shaper.oversample = "2x";

      // Lowpass: doma os harmônicos superiores (~3000 Hz)
      const lpf = ac.createBiquadFilter();
      lpf.type = "lowpass";
      lpf.frequency.value = 3000;

      // Envelope de pluck: attack curto, decay rápido
      const gainEnv = ac.createGain();
      gainEnv.gain.setValueAtTime(0.0001, t);
      gainEnv.gain.exponentialRampToValueAtTime(pico, t + cfg.attack);
      gainEnv.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      // Grafo: osc → mixGain → shaper → lpf → gainEnv → destino
      //        osc2 → gainOsc2 → mixGain
      osc.connect(gainMix);
      osc2.connect(gainOsc2).connect(gainMix);
      gainMix.connect(shaper).connect(lpf).connect(gainEnv).connect(destino);

      osc.start(t);  osc.stop(t + dur + 0.02);
      osc2.start(t); osc2.stop(t + dur + 0.02);
    } catch (_) { /* áudio é cosmético */ }
  }

  // ── Síntese: vocalista — sawtooth → formantes bandpass → vibrato → onset ────
  // 3 filtros bandpass em paralelo modelam a vogal "ah" (~700/1220/2600 Hz).
  // LFO (~5.5 Hz) modula a frequência da fonte para vibrato.
  function vocalistaHit(ac, destino, pitchHz, cfg, acerto) {
    try {
      const t = ac.currentTime;
      const pico = acerto ? cfg.gainAcerto : cfg.gainErro;
      const dur  = acerto ? cfg.durAcerto  : cfg.durErro;
      const freq = pitchHz * cfg.freqMult;

      // Fonte: sawtooth
      const osc = ac.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;

      // LFO de vibrato (~5.5 Hz, profundidade ~8 Hz)
      const lfo = ac.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 5.5;
      const lfoGain = ac.createGain();
      lfoGain.gain.value = 8;
      lfo.connect(lfoGain).connect(osc.frequency);

      // 3 filtros bandpass (formantes "ah")
      const formantes = [700, 1220, 2600];
      const Q = 8;
      const gainFormantes = ac.createGain();
      gainFormantes.gain.value = 1.0;

      formantes.forEach((f) => {
        const bp = ac.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = f;
        bp.Q.value = Q;
        osc.connect(bp).connect(gainFormantes);
      });

      // Envelope vocal: onset gradual
      const gainEnv = ac.createGain();
      gainEnv.gain.setValueAtTime(0.0001, t);
      gainEnv.gain.exponentialRampToValueAtTime(pico, t + cfg.attack);
      gainEnv.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      gainFormantes.connect(gainEnv).connect(destino);

      osc.start(t);  osc.stop(t + dur + 0.02);
      lfo.start(t);  lfo.stop(t + dur + 0.02);
    } catch (_) { /* áudio é cosmético */ }
  }

  // ── Síntese: baixista — sine fundamental + 2º harmônico → lowpass grave ─────
  function baixistaHit(ac, destino, pitchHz, cfg, acerto) {
    try {
      const t = ac.currentTime;
      const pico = acerto ? cfg.gainAcerto : cfg.gainErro;
      const dur  = acerto ? cfg.durAcerto  : cfg.durErro;
      const freq = pitchHz * cfg.freqMult;

      // Fundamental sine grave
      const osc = ac.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;

      // 2º harmônico (oitava acima) em ganho baixo — leve saturação orgânica
      const osc2 = ac.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = freq * 2;
      const gainHarm = ac.createGain();
      gainHarm.gain.value = 0.18;

      const gainMix = ac.createGain();
      gainMix.gain.value = 1.0;

      // WaveShaper suave (saturação leve, quantidade pequena)
      const shaper = ac.createWaveShaper();
      shaper.curve = curvaDistorcao(128, 30);
      shaper.oversample = "none";

      // Lowpass grave (~300 Hz) — corta harmônicos superiores, mantém corpo
      const lpf = ac.createBiquadFilter();
      lpf.type = "lowpass";
      lpf.frequency.value = 300;

      // Envelope punchy: ataque rápido, decay moderado
      const gainEnv = ac.createGain();
      gainEnv.gain.setValueAtTime(0.0001, t);
      gainEnv.gain.exponentialRampToValueAtTime(pico, t + cfg.attack);
      gainEnv.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(gainMix);
      osc2.connect(gainHarm).connect(gainMix);
      gainMix.connect(shaper).connect(lpf).connect(gainEnv).connect(destino);

      osc.start(t);  osc.stop(t + dur + 0.02);
      osc2.start(t); osc2.stop(t + dur + 0.02);
    } catch (_) { /* áudio é cosmético */ }
  }

  // ── Síntese: baterista — noise (snap) + corpo pitched (thump) ───────────────
  // Math.random() aqui é seguro: solo() é chamado em callback de evento (acerto/erro),
  // NUNCA dentro de passo(dt)/desenhar() — não viola o determinismo do draw (REQ6).
  function bateristaHit(ac, destino, acerto) {
    try {
      const t = ac.currentTime;
      const durNoise = acerto ? 0.10 : 0.05;
      const durCorpo = acerto ? 0.12 : 0.06;

      // ── Noise burst (snap de snare/chapéu) ──
      const tamBuffer = Math.ceil(ac.sampleRate * durNoise);
      const buf = ac.createBuffer(1, tamBuffer, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < tamBuffer; i++) data[i] = Math.random() * 2 - 1;

      const src = ac.createBufferSource();
      src.buffer = buf;

      const hpf = ac.createBiquadFilter();
      hpf.type = "highpass";
      hpf.frequency.value = acerto ? 2500 : 900; // acerto = mais brilho

      const gainNoise = ac.createGain();
      gainNoise.gain.setValueAtTime(acerto ? 0.32 : 0.10, t);
      gainNoise.gain.exponentialRampToValueAtTime(0.0001, t + durNoise);

      src.connect(hpf).connect(gainNoise).connect(destino);
      src.start(t);
      src.stop(t + durNoise + 0.01);

      // ── Corpo pitched (thump tipo kick/tom) ──
      const oscCorpo = ac.createOscillator();
      oscCorpo.type = "sine";
      oscCorpo.frequency.value = acerto ? 180 : 120;
      // Pitch descendente: 180→50 Hz (kick/tom)
      oscCorpo.frequency.setValueAtTime(acerto ? 180 : 120, t);
      oscCorpo.frequency.exponentialRampToValueAtTime(50, t + durCorpo * 0.7);

      const gainCorpo = ac.createGain();
      gainCorpo.gain.setValueAtTime(acerto ? 0.45 : 0.20, t);
      gainCorpo.gain.exponentialRampToValueAtTime(0.0001, t + durCorpo);

      oscCorpo.connect(gainCorpo).connect(destino);
      oscCorpo.start(t);
      oscCorpo.stop(t + durCorpo + 0.01);
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

    // Gain master de SFX: todos os efeitos roteiam por aqui para o volume global.
    // O mute continua via early-return em cada SFX; este master carrega o VOLUME.
    let gainMaster = null;
    function garantirGainMaster() {
      const ac = garantirContexto();
      if (!gainMaster) {
        gainMaster = ac.createGain();
        gainMaster.connect(ac.destination);
        gainMaster.gain.value = (window.RitmoMuteGate ? window.RitmoMuteGate.volume : 1);
      }
      return gainMaster;
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
        osc.connect(gain).connect(garantirGainMaster());
        osc.start(t);
        osc.stop(t + duracao + 0.02);
      } catch (_) {
        /* áudio é cosmético — nunca derruba o jogo */
      }
    }

    return {
      iniciar() { garantirContexto(); },
      parar() { /* osciladores são one-shot; nada a manter vivo */ },
      // Reaplica o volume master de SFX ao vivo — usado pelo slider de Opções.
      aplicarVolume() {
        try { garantirGainMaster().gain.value = (window.RitmoMuteGate ? window.RitmoMuteGate.volume : 1); } catch (_) {}
      },
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
      // D-03 / GF2: solo melódico por timbre de instrumento (cadeia de síntese rica)
      solo(timbre, pitchHz, acerto) {
        if (window.RitmoMuteGate && window.RitmoMuteGate.mutado) return;
        const cfg = TIMBRES[timbre] || TIMBRES.guitarrista;
        const ac  = garantirContexto();
        const mst = garantirGainMaster();
        if (cfg.wave === "noise") {
          bateristaHit(ac, mst, acerto);
          return;
        }
        if (timbre === "guitarrista") {
          guitarristaHit(ac, mst, pitchHz, cfg, acerto);
        } else if (timbre === "vocalista") {
          vocalistaHit(ac, mst, pitchHz, cfg, acerto);
        } else {
          // baixista (e fallback genérico)
          baixistaHit(ac, mst, pitchHz, cfg, acerto);
        }
      },
    };
  }

  function nulo() {
    return { iniciar() {}, parar() {}, acerto() {}, erro() {}, batida() {},
             golpe() {}, critico() {}, vitoria() {}, item() {},
             solo() {}, aplicarVolume() {} };
  }

  window.RitmoAudio = { criar, nulo };
})();
