// Wrapper Web Audio do minigame — som 100% sintetizado (OscillatorNode), sem
// arquivos de áudio (zero asset, zero questão de copyright). Acerto = beep curto
// agudo; erro = buzz grave. É no-op-able: se o AudioContext não existir (ou em
// teste), tudo vira no-op silencioso.
//
// Pendurado em window.RitmoAudio (sem ES modules).

(function () {
  "use strict";

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
      acerto() { bipe(880, 0.09, "triangle", 0.25); },   // agudo, limpo
      erro() { bipe(120, 0.18, "sawtooth", 0.2); },       // grave, áspero
      batida() { bipe(220, 0.05, "sine", 0.12); },        // pulso de compasso
    };
  }

  function nulo() {
    return { iniciar() {}, parar() {}, acerto() {}, erro() {}, batida() {} };
  }

  window.RitmoAudio = { criar, nulo };
})();
