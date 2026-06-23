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
    // Guitarrista (Geraldo Muleta): saw+quinta → drive → waveshaper agressivo →
    // highpass+lowpass aberto → pluck que canta
    guitarrista: {
      wave: "sawtooth",
      freqMult: 1.0,
      attack: 0.004,
      gainAcerto: 0.30,
      gainErro: 0.12,
      durAcerto: 0.24,
      durErro: 0.10,
    },
    // Vocalista (Vande Bicuda): saw+seno de corpo → formantes suaves → vibrato leve → onset gradual
    vocalista: {
      wave: "sawtooth",
      freqMult: 0.5,
      attack: 0.035,
      gainAcerto: 0.26,
      gainErro: 0.09,
      durAcerto: 0.30,
      durErro: 0.13,
    },
    // Baixista (Marivaldo): sine+harmônicos → saturação leve → lowpass grave → punch
    baixista: {
      wave: "sine",
      freqMult: 0.25,
      attack: 0.008,
      gainAcerto: 0.34,
      gainErro: 0.12,
      durAcerto: 0.22,
      durErro: 0.10,
    },
    // Baterista (Ramiro Paulada): kit alternado kick↔snare por nota (corpo pitched + noise)
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

  // Buffer de ruído branco curto (snap de bateria / transiente do batedor).
  // Math.random aqui é seguro: só roda em callback de evento, nunca no draw (REQ6).
  function criarNoiseBuffer(ac, dur) {
    const n = Math.max(1, Math.ceil(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // Jitter de afinação (±cents) p/ tirar o "robótico". Aplicado no VALOR da
  // frequência (não em .detune — mantém compat. com o FakeAudioContext do harness).
  function comJitter(freq, cents) {
    const r = (Math.random() * 2 - 1) * (cents / 1200);
    return freq * Math.pow(2, r);
  }

  // ── Síntese: guitarrista — sawtooth → waveshaper → lowpass → pluck env ──────
  // Opcional: 2º osc detunado em quinta (ganho leve) para encorpar power-chord.
  function guitarristaHit(ac, destino, pitchHz, cfg, acerto) {
    try {
      const t = ac.currentTime;
      const pico = acerto ? cfg.gainAcerto : cfg.gainErro;
      const dur  = acerto ? cfg.durAcerto  : cfg.durErro;
      const freq = comJitter(pitchHz * cfg.freqMult, 6);

      // Fonte principal: sawtooth
      const osc = ac.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;

      // 2º osc em quinta (freq*1.5), levemente destoado — reforça o power-chord
      const osc2 = ac.createOscillator();
      osc2.type = "sawtooth";
      osc2.frequency.value = comJitter(freq * 1.5, 8);

      const gainMix = ac.createGain();
      gainMix.gain.value = 1.0;
      const gainOsc2 = ac.createGain();
      gainOsc2.gain.value = 0.42;

      // Drive: empurra o sinal p/ a região não-linear → distorção mais agressiva
      const drive = ac.createGain();
      drive.gain.value = acerto ? 1.9 : 1.3;

      // WaveShaper: saturação forte (guitarra elétrica distorcida)
      const shaper = ac.createWaveShaper();
      shaper.curve = curvaDistorcao(1024, acerto ? 420 : 220);
      shaper.oversample = "2x";

      // Highpass tira a lama; lowpass aberto deixa o "bite"/brilho passar
      const hpf = ac.createBiquadFilter();
      hpf.type = "highpass";
      hpf.frequency.value = 120;
      const lpf = ac.createBiquadFilter();
      lpf.type = "lowpass";
      lpf.frequency.value = acerto ? 4800 : 3200;

      // Pluck: ataque rápido, decay com cauda que "canta"
      const gainEnv = ac.createGain();
      gainEnv.gain.setValueAtTime(0.0001, t);
      gainEnv.gain.exponentialRampToValueAtTime(pico, t + cfg.attack);
      gainEnv.gain.exponentialRampToValueAtTime(pico * 0.35, t + dur * 0.5);
      gainEnv.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      // Grafo: osc(+osc2) → mix → drive → shaper → hpf → lpf → env → destino
      osc.connect(gainMix);
      osc2.connect(gainOsc2).connect(gainMix);
      gainMix.connect(drive).connect(shaper).connect(hpf).connect(lpf)
             .connect(gainEnv).connect(destino);

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
      const freq = comJitter(pitchHz * cfg.freqMult, 5);

      // Fonte rica (saw) p/ excitar os formantes
      const osc = ac.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;

      // Seno de corpo na fundamental — suaviza o buzz do saw (vogal mais natural)
      const sub = ac.createOscillator();
      sub.type = "sine";
      sub.frequency.value = freq;
      const subGain = ac.createGain();
      subGain.gain.value = 0.5;

      // Vibrato suave: ~5 Hz, profundidade ~20 cents, com onset gradual
      const lfo = ac.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 5;
      const lfoGain = ac.createGain();
      lfoGain.gain.setValueAtTime(0.0001, t);
      lfoGain.gain.linearRampToValueAtTime(freq * 0.012, t + dur * 0.5);
      lfo.connect(lfoGain).connect(osc.frequency);

      // Formantes da vogal "ah": F1 forte, F2 médio, F3 fraco; Q baixo = menos buzz
      const formantes = [[700, 1.0, 5], [1150, 0.5, 6], [2600, 0.18, 7]];
      const somaForm = ac.createGain();
      formantes.forEach((f) => {
        const bp = ac.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = f[0];
        bp.Q.value = f[2];
        const g = ac.createGain();
        g.gain.value = f[1];
        osc.connect(bp).connect(g).connect(somaForm);
      });
      // Corpo de seno entra direto na soma
      sub.connect(subGain).connect(somaForm);

      // Lowpass tira a fritura do topo
      const lpf = ac.createBiquadFilter();
      lpf.type = "lowpass";
      lpf.frequency.value = 3500;

      // Envelope vocal: onset gradual, sustain e cauda de release
      const gainEnv = ac.createGain();
      gainEnv.gain.setValueAtTime(0.0001, t);
      gainEnv.gain.exponentialRampToValueAtTime(pico, t + cfg.attack);
      gainEnv.gain.setValueAtTime(pico, t + dur * 0.6);
      gainEnv.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      somaForm.connect(lpf).connect(gainEnv).connect(destino);

      osc.start(t); osc.stop(t + dur + 0.03);
      sub.start(t); sub.stop(t + dur + 0.03);
      lfo.start(t); lfo.stop(t + dur + 0.03);
    } catch (_) { /* áudio é cosmético */ }
  }

  // ── Síntese: baixista — sine fundamental + 2º harmônico → lowpass grave ─────
  function baixistaHit(ac, destino, pitchHz, cfg, acerto) {
    try {
      const t = ac.currentTime;
      const pico = acerto ? cfg.gainAcerto : cfg.gainErro;
      const dur  = acerto ? cfg.durAcerto  : cfg.durErro;
      const freq = comJitter(pitchHz * cfg.freqMult, 4);

      // Fundamental sine grave com blip de pitch no ataque (pluck de baixo)
      const osc = ac.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq * 1.5, t);
      osc.frequency.exponentialRampToValueAtTime(freq, t + 0.04);

      // 2º harmônico (oitava acima) em ganho baixo — leve saturação orgânica
      const osc2 = ac.createOscillator();
      osc2.type = "triangle";
      osc2.frequency.value = freq * 2;
      const gainHarm = ac.createGain();
      gainHarm.gain.value = 0.22;

      const gainMix = ac.createGain();
      gainMix.gain.value = 1.0;

      // WaveShaper suave (saturação leve, quantidade pequena)
      const shaper = ac.createWaveShaper();
      shaper.curve = curvaDistorcao(256, 40);
      shaper.oversample = "none";

      // Lowpass grave (~420 Hz) — corta harmônicos superiores, mantém corpo
      const lpf = ac.createBiquadFilter();
      lpf.type = "lowpass";
      lpf.frequency.value = 420;

      // Envelope punchy: ataque rápido, sustain curto, decay moderado
      const gainEnv = ac.createGain();
      gainEnv.gain.setValueAtTime(0.0001, t);
      gainEnv.gain.exponentialRampToValueAtTime(pico, t + cfg.attack);
      gainEnv.gain.exponentialRampToValueAtTime(pico * 0.4, t + dur * 0.6);
      gainEnv.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(gainMix);
      osc2.connect(gainHarm).connect(gainMix);
      gainMix.connect(shaper).connect(lpf).connect(gainEnv).connect(destino);

      osc.start(t);  osc.stop(t + dur + 0.02);
      osc2.start(t); osc2.stop(t + dur + 0.02);
    } catch (_) { /* áudio é cosmético */ }
  }

  // ── Síntese: baterista — kit alternado kick↔snare ───────────────────────────
  // Math.random() aqui é seguro: solo() é chamado em callback de evento (acerto/erro),
  // NUNCA dentro de passo(dt)/desenhar() — não viola o determinismo do draw (REQ6).
  //
  // A melodia injeta pitches que podem ficar todos no mesmo registro (ex.: "padrao"
  // só tem notas >440 Hz), então separar kick/snare só por registro deixaria a frase
  // monótona. Em vez disso ALTERNAMOS kick↔snare a cada nota (groove de rock claro,
  // boom-bap), e usamos pitchHz só p/ afinar a profundidade do kick.
  let _passoBateria = 0;

  function bateristaHit(ac, destino, pitchHz, acerto) {
    try {
      const t = ac.currentTime;
      const ehKick = (_passoBateria++ % 2) === 0;
      if (ehKick) kickHit(ac, destino, pitchHz, acerto, t);
      else        snareHit(ac, destino, acerto, t);
    } catch (_) {
      /* áudio é cosmético — nunca derruba o jogo */
    }
  }

  // Kick: corpo sine com pitch descendente (thump) + click curtíssimo do batedor.
  function kickHit(ac, destino, pitchHz, acerto, t) {
    const dur = acerto ? 0.20 : 0.12;
    // Afinação do kick segue de leve o registro da melodia (grave → mais fundo)
    const reg  = Math.max(0, Math.min(1, (pitchHz - 110) / 770));
    const fTop = (acerto ? 130 : 100) + reg * 30;

    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(fTop, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + dur * 0.7);

    const gainCorpo = ac.createGain();
    gainCorpo.gain.setValueAtTime(acerto ? 0.55 : 0.26, t);
    gainCorpo.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gainCorpo).connect(destino);
    osc.start(t); osc.stop(t + dur + 0.02);

    // Click do batedor — transiente que dá o "ataque" do kick
    const click = ac.createBufferSource();
    click.buffer = criarNoiseBuffer(ac, 0.02);
    const hpf = ac.createBiquadFilter();
    hpf.type = "highpass";
    hpf.frequency.value = 1200;
    const gainClick = ac.createGain();
    gainClick.gain.setValueAtTime(acerto ? 0.18 : 0.08, t);
    gainClick.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    click.connect(hpf).connect(gainClick).connect(destino);
    click.start(t); click.stop(t + 0.03);
  }

  // Snare: estouro de ruído (bandpass+highpass) + corpo tonal curto (crack ~190 Hz).
  function snareHit(ac, destino, acerto, t) {
    const dur = acerto ? 0.16 : 0.09;

    const noise = ac.createBufferSource();
    noise.buffer = criarNoiseBuffer(ac, dur);
    const bpf = ac.createBiquadFilter();
    bpf.type = "bandpass";
    bpf.frequency.value = 1800;
    bpf.Q.value = 0.7;
    const hpf = ac.createBiquadFilter();
    hpf.type = "highpass";
    hpf.frequency.value = acerto ? 1500 : 900; // acerto = mais brilho
    const gainNoise = ac.createGain();
    gainNoise.gain.setValueAtTime(acerto ? 0.30 : 0.12, t);
    gainNoise.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    noise.connect(bpf).connect(hpf).connect(gainNoise).connect(destino);
    noise.start(t); noise.stop(t + dur + 0.01);

    // Corpo tonal: pele afinada ~190 Hz com leve queda — dá o "tom" do snare
    const osc = ac.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(acerto ? 210 : 180, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + dur * 0.5);
    const gainCorpo = ac.createGain();
    gainCorpo.gain.setValueAtTime(acerto ? 0.22 : 0.10, t);
    gainCorpo.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.6);
    osc.connect(gainCorpo).connect(destino);
    osc.start(t); osc.stop(t + dur + 0.02);
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
          bateristaHit(ac, mst, pitchHz, acerto);
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
