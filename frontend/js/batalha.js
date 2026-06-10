// Arena de batalha estilo Mortal Kombat (F3.5a): a banda fica à ESQUERDA (cada
// membro com seu instrumento, encarando o vilão), o vilão à DIREITA. As barras
// de vida ficam no HUD em DOM (banda topo-esq., vilão topo-dir.) — quem desenha
// os sprites é este canvas; quem pinta as barras é o main.js via `aoAtualizar`.
//
// Mesma estratégia de testabilidade do ritmo.js/overworld.js: o SHELL (ctx, api,
// jogarRitmo) é injetável. Em produção usa o canvas real, o RitmoMinigame e a
// ponte pywebview; no harness injeta fakes determinísticos. O ataque reusa o
// minigame de ritmo modal que já existe.
//
// F3.5a: o vilão revida 1× logo após cada ataque (reusa turno_inimigo). O
// auto-ataque por tempo + atordoamento + especial entram na F3.5b.
//
// Sem ES modules: tudo pendurado em window.Batalha.

(function () {
  "use strict";

  const COR_POR_TIPO = {
    guitarrista: "#e23b4e", vocalista: "#b04ad8",
    baixista: "#4a78d8", baterista: "#e0b341",
  };

  const CONFIG = {
    LARGURA: 800,
    ALTURA: 360,
    CHAO_Y: 300,
    MEMBRO_W: 54, MEMBRO_H: 92,
    BANDA_X: 96,        // x base da coluna da banda (esquerda)
    BOSS_W: 96, BOSS_H: 156,
    BOSS_X: 632,        // x do vilão (direita)
  };

  // ── Núcleo (shell injetável) ────────────────────────────────────────────────
  // opts: { ctx, api, jogarRitmo, estado, corPorTipo, aoAtualizar, aoFim }
  function criarBatalha(opts) {
    const ctx = opts.ctx || null;
    const api = opts.api;
    const jogarRitmo = opts.jogarRitmo || (() => Promise.resolve(null));
    const corPorTipo = opts.corPorTipo || COR_POR_TIPO;
    const aoAtualizar = opts.aoAtualizar || function () {};
    const aoFim = opts.aoFim || function () {};

    let estado = opts.estado;
    let selecionado = 0;
    let ocupado = false;     // true enquanto um ataque (minigame + resolução) roda
    let encerrado = false;

    function membros() { return (estado && estado.banda) || []; }

    function primeiroVivo() {
      const i = membros().findIndex((m) => m.vivo);
      return i < 0 ? 0 : i;
    }
    function normalizarSelecao() {
      const m = membros()[selecionado];
      if (!m || !m.vivo) selecionado = primeiroVivo();
    }

    function aplicarEstado(novo) {
      if (novo) estado = novo;
      normalizarSelecao();
      aoAtualizar(estado);
      desenhar();
    }

    // Posição (canto sup. esq. do sprite) de cada membro — coluna à esquerda,
    // levemente escalonada em profundidade.
    function posMembro(i) {
      return {
        x: CONFIG.BANDA_X + (i % 2) * 40,
        y: CONFIG.CHAO_Y - CONFIG.MEMBRO_H - i * 6,
      };
    }

    function membroNoPonto(x, y) {
      const ms = membros();
      for (let i = 0; i < ms.length; i++) {
        const p = posMembro(i);
        if (x >= p.x - 4 && x <= p.x + CONFIG.MEMBRO_W + 20 &&
            y >= p.y - 8 && y <= p.y + CONFIG.MEMBRO_H + 4) return i;
      }
      return -1;
    }

    // ── Render (placeholders; pixel art é F3.7 — troca só esta função) ─────────
    function desenhar() {
      if (!ctx) return;
      const C = CONFIG;
      ctx.clearRect(0, 0, C.LARGURA, C.ALTURA);
      ctx.fillStyle = "#14111c"; ctx.fillRect(0, 0, C.LARGURA, C.ALTURA);
      ctx.fillStyle = "#211b2e"; ctx.fillRect(0, C.CHAO_Y, C.LARGURA, C.ALTURA - C.CHAO_Y);

      // Banda (esquerda, encarando a direita).
      membros().forEach((m, i) => {
        const p = posMembro(i);
        ctx.globalAlpha = m.vivo ? 1 : 0.3;
        ctx.fillStyle = corPorTipo[m.tipo] || "#e0457b";
        ctx.fillRect(p.x, p.y, C.MEMBRO_W, C.MEMBRO_H);
        // "instrumento": haste na frente (lado direito = encarando o vilão).
        ctx.fillStyle = "#0d0a14";
        ctx.fillRect(p.x + C.MEMBRO_W, p.y + C.MEMBRO_H * 0.45, 16, 7);
        ctx.globalAlpha = 1;
        if (i === selecionado && m.vivo) {
          ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3;
          ctx.strokeRect(p.x - 3, p.y - 3, C.MEMBRO_W + 6, C.MEMBRO_H + 6);
        }
        ctx.fillStyle = "#ece6f5"; ctx.font = "11px monospace"; ctx.textAlign = "center";
        ctx.fillText(m.nome, p.x + C.MEMBRO_W / 2, p.y - 7);
      });

      // Vilão (direita).
      const boss = (estado && estado.boss) || {};
      ctx.fillStyle = "#b8324a";
      ctx.fillRect(C.BOSS_X, C.CHAO_Y - C.BOSS_H, C.BOSS_W, C.BOSS_H);
      ctx.fillStyle = "#0d0a14";        // detalhe "encarando" a esquerda
      ctx.fillRect(C.BOSS_X - 14, C.CHAO_Y - C.BOSS_H * 0.6, 14, 8);
      ctx.fillStyle = "#ece6f5"; ctx.font = "12px monospace"; ctx.textAlign = "center";
      ctx.fillText(boss.nome || "Vilão", C.BOSS_X + C.BOSS_W / 2, C.CHAO_Y - C.BOSS_H - 9);
    }

    // ── Seleção (só entre vivos) ───────────────────────────────────────────────
    function selecionarIndice(i) {
      const m = membros()[i];
      if (m && m.vivo) { selecionado = i; desenhar(); }
    }
    function selecionar(dir) {
      const ms = membros();
      if (!ms.length) return;
      let i = selecionado;
      for (let n = 0; n < ms.length; n++) {
        i = (i + dir + ms.length) % ms.length;
        if (ms[i] && ms[i].vivo) { selecionado = i; break; }
      }
      desenhar();
    }

    // ── Ataque (abre o minigame; vilão revida na hora) ─────────────────────────
    async function atacar() {
      if (ocupado || encerrado || !estado || estado.fim_de_jogo) return;
      normalizarSelecao();
      const m = membros()[selecionado];
      if (!m || !m.vivo) return;

      ocupado = true;
      try {
        const ritmo = await jogarRitmo({ tipoMusico: m.tipo, cor: corPorTipo[m.tipo] });
        if (ritmo === null) return;                 // Esc cancelou: não gasta a vez

        const res = await api.executar_acao({ indice: m.id, ritmo });
        if (!res || res.ok === false) return;
        aplicarEstado(res.estado);
        if (res.fim_de_jogo) return finalizar(res.resultado_final);

        const cont = await api.turno_inimigo();     // vilão revida (5a)
        if (cont && cont.ok !== false) {
          aplicarEstado(cont.estado);
          if (cont.fim_de_jogo) return finalizar(cont.resultado_final);
        }
      } finally {
        ocupado = false;
      }
    }

    function finalizar(resultado) {
      if (encerrado) return;
      encerrado = true;
      aoFim(resultado);
    }

    // Primeira pintura.
    normalizarSelecao();
    aoAtualizar(estado);
    desenhar();

    return {
      atacar, selecionar, selecionarIndice, membroNoPonto, desenhar,
      get estado() { return estado; },
      get selecionado() { return selecionado; },
      get ocupado() { return ocupado; },
      get encerrado() { return encerrado; },
    };
  }

  // ── Entrada de produção: liga canvas + teclado + minigame real ──────────────
  function montar({ canvas, api, estado, corPorTipo, aoAtualizar, aoFim } = {}) {
    const ctx = canvas ? canvas.getContext("2d") : null;
    if (canvas) { canvas.width = CONFIG.LARGURA; canvas.height = CONFIG.ALTURA; }
    const jogarRitmo = (window.RitmoMinigame && window.RitmoMinigame.jogarRitmo)
      ? window.RitmoMinigame.jogarRitmo
      : (() => Promise.resolve(null));

    const batalha = criarBatalha({ ctx, api, jogarRitmo, estado, corPorTipo, aoAtualizar, aoFim });

    function onKeyDown(e) {
      if (batalha.ocupado) return;        // durante o minigame, as teclas são dele
      const t = e.key.toLowerCase();
      if (t === "arrowleft" || t === "a") { e.preventDefault(); batalha.selecionar(-1); }
      else if (t === "arrowright" || t === "d") { e.preventDefault(); batalha.selecionar(1); }
      else if (t === "enter") { e.preventDefault(); batalha.atacar(); }
    }
    function onClick(e) {
      if (batalha.ocupado || !canvas) return;
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) * (CONFIG.LARGURA / r.width);
      const y = (e.clientY - r.top) * (CONFIG.ALTURA / r.height);
      const i = batalha.membroNoPonto(x, y);
      if (i >= 0) { batalha.selecionarIndice(i); batalha.atacar(); }
    }

    window.addEventListener("keydown", onKeyDown);
    if (canvas) canvas.addEventListener("click", onClick);

    const handle = {
      batalha,
      desligar() {
        window.removeEventListener("keydown", onKeyDown);
        if (canvas) canvas.removeEventListener("click", onClick);
      },
    };
    window.__batalha = handle;   // depuração/harness
    return handle;
  }

  window.Batalha = { criarBatalha, montar, CONFIG, COR_POR_TIPO };
})();
