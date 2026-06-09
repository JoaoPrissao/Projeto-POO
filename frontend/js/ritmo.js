// Minigame de ritmo — 4 pistas (Guitar Hero), Web Audio + requestAnimationFrame.
//
// Testabilidade (constraint central): a PONTUAÇÃO é pura e determinística; o
// SHELL de tempo/render/áudio é injetável (agora / agendarFrame / audio /
// ouvirTeclas). Em produção usa performance.now + rAF + Web Audio; nos testes
// (Playwright) o harness injeta um relógio manual e entrada programática, então
// o resultado não depende de timing real.
//
// Sem ES modules (index.html usa <script> simples): tudo pendurado em
// window.RitmoMinigame.

(function () {
  "use strict";

  const TECLAS = ["d", "f", "j", "k"];        // pista 0..3
  const CONFIG = {
    PISTAS: 4,
    TEMPO_QUEDA_MS: 1800,   // tempo da nota do topo até a linha de acerto
    JANELA_MS: 150,         // tolerância de acerto (± em torno do tempo alvo)
    CAUDA_MS: 350,          // respiro depois da última nota antes de fechar
  };

  // Chart padrão: ~16 notas, uma a cada 400ms, começando em 1800ms (a 1ª nota
  // nasce no topo em t=0 e chega na linha em t=1800). Padrão de pistas variado.
  const PADRAO_PISTAS = [0, 1, 2, 3, 1, 2, 0, 3, 2, 1, 3, 0, 1, 3, 2, 0];
  const CHART = PADRAO_PISTAS.map((pista, i) => ({
    tempo_ms: 1800 + i * 400,
    pista,
  }));

  // ── Pontuação pura (sem timing, sem DOM) ────────────────────────────────────
  function criarPlacar(totalNotas) {
    let acertos = 0;
    let combo = 0;
    let comboMax = 0;
    return {
      acerto() {
        acertos += 1;
        combo += 1;
        if (combo > comboMax) comboMax = combo;
      },
      erro() {
        combo = 0;
      },
      get estado() {
        return {
          acertos,
          total_notas: totalNotas,
          combo,
          combo_max: comboMax,
        };
      },
    };
  }

  // ── Engine (shell injetável) ────────────────────────────────────────────────
  // opts: { agora, agendarFrame, audio, container, cor, chart, aoAtualizar }
  function criarMinigame(opts) {
    const agora = opts.agora;
    const agendarFrame = opts.agendarFrame;
    const audio = opts.audio || audioNulo();
    const chart = opts.chart || CHART;
    const aoAtualizar = opts.aoAtualizar || function () {};
    const cor = opts.cor || "#e0457b";

    const placar = criarPlacar(chart.length);
    const notas = chart.map((n, i) => ({
      id: i,
      tempoAlvo: n.tempo_ms,
      pista: n.pista,
      resolvida: false,
      el: null,
    }));
    const ultimoTempo = notas.reduce((m, n) => Math.max(m, n.tempoAlvo), 0);

    let t0 = null;
    let rodando = false;
    let cancelado = false;
    let resolver = null;

    // — DOM (opcional: só monta se houver container) —
    function montarDOM() {
      if (!opts.container) return;
      opts.container.innerHTML = "";
      opts.container.style.setProperty("--cor-pista", cor);
      for (let p = 0; p < CONFIG.PISTAS; p++) {
        const col = document.createElement("div");
        col.className = "pista";
        col.dataset.pista = String(p);
        col.innerHTML = `<span class="tecla">${TECLAS[p].toUpperCase()}</span>`;
        opts.container.appendChild(col);
      }
      const linha = document.createElement("div");
      linha.className = "linha-acerto";
      opts.container.appendChild(linha);

      for (const nota of notas) {
        const el = document.createElement("div");
        el.className = "nota";
        el.style.display = "none";
        const col = opts.container.querySelector(`.pista[data-pista="${nota.pista}"]`);
        col.appendChild(el);
        nota.el = el;
      }
    }

    function posicionar(t) {
      for (const nota of notas) {
        if (!nota.el) continue;
        if (nota.resolvida) { nota.el.style.display = "none"; continue; }
        const progresso = (t - nota.tempoAlvo + CONFIG.TEMPO_QUEDA_MS) / CONFIG.TEMPO_QUEDA_MS;
        if (progresso < 0) { nota.el.style.display = "none"; continue; }
        nota.el.style.display = "block";
        nota.el.style.top = Math.min(progresso, 1) * 100 + "%";
      }
    }

    function marcar(nota, classe) {
      if (!nota.el) return;
      nota.el.classList.add(classe);
    }

    // Resolve a nota mais próxima da pista dentro da janela → acerto.
    function apertarPista(pista) {
      if (!rodando || t0 === null) return;
      const t = agora() - t0;
      let alvo = null;
      let melhor = CONFIG.JANELA_MS + 1;
      for (const nota of notas) {
        if (nota.resolvida || nota.pista !== pista) continue;
        const d = Math.abs(t - nota.tempoAlvo);
        if (d <= CONFIG.JANELA_MS && d < melhor) { melhor = d; alvo = nota; }
      }
      if (alvo) {
        alvo.resolvida = true;
        placar.acerto();
        audio.acerto();
        marcar(alvo, "acerto");
        aoAtualizar(placar.estado);
      }
      // Tecla sem nota na janela: ignorada (não quebra combo) — pontuação fica
      // determinística e dependente só das notas do chart.
    }

    function cancelar() {
      cancelado = true;
    }

    function frame() {
      if (!rodando) return;
      const t = agora() - t0;

      // Notas que passaram da janela sem acerto contam como erro.
      for (const nota of notas) {
        if (nota.resolvida) continue;
        if (t > nota.tempoAlvo + CONFIG.JANELA_MS) {
          nota.resolvida = true;
          placar.erro();
          audio.erro();
          marcar(nota, "erro");
        }
      }

      posicionar(t);
      aoAtualizar(placar.estado);

      if (cancelado) { finalizar(null); return; }

      const acabou = notas.every((n) => n.resolvida) &&
        t > ultimoTempo + CONFIG.JANELA_MS + CONFIG.CAUDA_MS;
      if (acabou) { finalizar(placar.estado); return; }

      agendarFrame(frame);
    }

    function finalizar(resultado) {
      rodando = false;
      audio.parar();
      resolver(resultado);
    }

    function iniciar() {
      montarDOM();
      audio.iniciar();
      return new Promise((resolve) => {
        resolver = resolve;
        rodando = true;
        cancelado = false;
        t0 = agora();
        agendarFrame(frame);
      });
    }

    return {
      iniciar,
      apertarPista,
      cancelar,
      get estado() { return placar.estado; },
    };
  }

  // ── Áudio no-op (default e modo teste) ──────────────────────────────────────
  function audioNulo() {
    return {
      iniciar() {}, parar() {}, acerto() {}, erro() {}, batida() {},
    };
  }

  // ── Entrada de produção: monta o overlay e resolve com a contagem crua ──────
  // Retorna Promise<{acertos,total_notas,combo_max} | null>. null = cancelado.
  function jogarRitmo({ tipoMusico, cor } = {}) {
    const overlay = document.getElementById("ritmo-overlay");
    const pistas = document.getElementById("ritmo-pistas");
    const hudCombo = document.getElementById("ritmo-combo");
    const hudAcertos = document.getElementById("ritmo-acertos");
    const titulo = document.getElementById("ritmo-titulo");
    if (titulo) titulo.textContent = `Ritmo — ${tipoMusico || "banda"}`;

    function aoAtualizar(estado) {
      if (hudCombo) hudCombo.textContent = `Combo ${estado.combo}`;
      if (hudAcertos) hudAcertos.textContent = `${estado.acertos}/${estado.total_notas}`;
    }

    const audio = (window.RitmoAudio && window.RitmoAudio.criar)
      ? window.RitmoAudio.criar()
      : audioNulo();

    const mg = criarMinigame({
      agora: () => performance.now(),
      agendarFrame: (cb) => requestAnimationFrame(cb),
      audio,
      container: pistas,
      cor: cor || "#e0457b",
      chart: CHART,
      aoAtualizar,
    });

    // Entrada: teclado (D F J K / Esc) + clique nas pistas (acessibilidade).
    function onKey(e) {
      if (e.key === "Escape") { mg.cancelar(); return; }
      const p = TECLAS.indexOf(e.key.toLowerCase());
      if (p >= 0) mg.apertarPista(p);
    }
    function onClickPista(e) {
      const col = e.target.closest(".pista");
      if (col) mg.apertarPista(Number(col.dataset.pista));
    }

    window.addEventListener("keydown", onKey);
    if (pistas) pistas.addEventListener("click", onClickPista);
    if (overlay) overlay.classList.add("aberto");

    return mg.iniciar().finally(() => {
      window.removeEventListener("keydown", onKey);
      if (pistas) pistas.removeEventListener("click", onClickPista);
      if (overlay) overlay.classList.remove("aberto");
    });
  }

  window.RitmoMinigame = {
    criarPlacar,
    criarMinigame,
    jogarRitmo,
    audioNulo,
    CHART,
    TECLAS,
    CONFIG,
  };
})();
