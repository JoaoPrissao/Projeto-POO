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

  // Escapa valores dinâmicos antes de montar HTML pra legenda (nomes podem virar
  // editáveis com os movesets/menu principal — defesa contra XSS por innerHTML).
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const COR_POR_TIPO = {
    guitarrista: "#e23b4e", vocalista: "#b04ad8",
    baixista: "#4a78d8", baterista: "#e0b341",
  };

  // Legendas com pegada rock — sorteadas pra não repetir sempre a mesma frase.
  // {a}=atacante, {v}=alvo, {d}=dano. Valores escapados em `_frase`.
  const FRASES_ATAQUE = [
    "🎸 {a} DETONOU {v} — {d} de dano!",
    "🤘 {a} mandou um SOLO insano em {v} (-{d})!",
    "🎸 {a} fez {v} sentir o riff na veia: {d}!",
    "🔊 {a} estourou a caixa na cara de {v} — {d}!",
    "🎶 {a} rasgou os tímpanos de {v}: {d}!",
  ];
  const FRASES_CRITICO = [
    "🥁 VIRADA DE BATERIA! {a} ARREBENTOU {v} — {d}!",
    "🥁 {a} mandou um FILL mortal em {v}: {d}!",
    "💥 SOLO ÉPICO! {a} pulverizou {v} com {d}!",
  ];
  const FRASES_REFRAO = [
    "🔥 REFRÃO! {a} incendiou {v} com {d}!",
    "🔥 A galera cantou junto e {a} esmagou {v}: {d}!",
    "🎉 ENCORE! {a} mandou {v} pro chão — {d}!",
  ];
  const FRASES_VILAO = [
    "🎤 {a} abafou o som de {v} (-{d})",
    "🍺 {a} jogou uma garrafa em {v} — {d}!",
    "🚫 {a} mandou {v} parar o show (-{d})",
    "📉 {a} vaiou {v} sem dó: {d} de dano!",
  ];
  function _frase(pool, a, v, d) {
    return pool[Math.floor(Math.random() * pool.length)]
      .replace("{a}", `<b>${esc(a)}</b>`)
      .replace("{v}", esc(v))
      .replace("{d}", `<b>${esc(d)}</b>`);
  }

  const CONFIG = {
    LARGURA: 800,
    ALTURA: 360,
    CHAO_Y: 300,
    MEMBRO_W: 50, MEMBRO_H: 86,
    BOSS_W: 104, BOSS_H: 168,
    BOSS_X: 628,        // x do vilão (direita)
    REVIDE_MS: 900,     // respiro antes do vilão revidar (5a; auto-ataque real é 5b)
  };

  // Disposição de palco (banda de rock): cada papel no seu lugar — vocal na
  // frente no microfone, guitarra/baixo nas laterais, bateria atrás. Quem repetir
  // papel ou for de tipo desconhecido cai num slot de reserva.
  const PALCO = {
    baterista:   { x: 132, y: 110 },   // fundo, centro (bateria atrás)
    vocalista:   { x: 134, y: 200 },   // frente, centro (microfone)
    guitarrista: { x: 40,  y: 168 },   // frente, esquerda
    baixista:    { x: 224, y: 168 },   // frente, direita
  };
  function layoutBanda(ms) {
    const usados = {};
    let reserva = 0;
    return ms.map((m) => {
      const base = PALCO[m.tipo];
      if (base && !usados[m.tipo]) { usados[m.tipo] = true; return base; }
      const k = reserva++;
      return { x: 36 + k * 30, y: 150 + (k % 2) * 44 };  // fallback
    });
  }

  // ── Núcleo (shell injetável) ────────────────────────────────────────────────
  // opts: { ctx, api, jogarRitmo, estado, corPorTipo, aoAtualizar, aoFim, aoLog, esperar }
  function criarBatalha(opts) {
    const ctx = opts.ctx || null;
    const api = opts.api;
    const jogarRitmo = opts.jogarRitmo || (() => Promise.resolve(null));
    const corPorTipo = opts.corPorTipo || COR_POR_TIPO;
    const aoAtualizar = opts.aoAtualizar || function () {};
    const aoFim = opts.aoFim || function () {};
    const aoLog = opts.aoLog || function () {};
    const esperar = opts.esperar || ((ms) => new Promise((r) => setTimeout(r, ms)));

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

    function membroNoPonto(x, y) {
      const ms = membros();
      const pos = layoutBanda(ms);
      for (let i = 0; i < ms.length; i++) {
        const p = pos[i];
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
      ctx.fillStyle = "#1b1526"; ctx.fillRect(0, 0, C.LARGURA, 70);   // fundo do palco
      ctx.fillStyle = "#211b2e"; ctx.fillRect(0, C.CHAO_Y, C.LARGURA, C.ALTURA - C.CHAO_Y);

      // Banda no palco (de trás pra frente, pra sobreposição ficar certa).
      const ms = membros();
      const pos = layoutBanda(ms);
      ms.map((m, i) => i).sort((a, b) => pos[a].y - pos[b].y).forEach((i) => {
        const m = ms[i], p = pos[i];
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
          ctx.fillStyle = "#ffffff"; ctx.font = "10px monospace"; ctx.textAlign = "center";
          ctx.fillText("▼", p.x + C.MEMBRO_W / 2, p.y - 18);
        }
        ctx.fillStyle = "#ece6f5"; ctx.font = "10px monospace"; ctx.textAlign = "center";
        ctx.fillText(m.nome, p.x + C.MEMBRO_W / 2, p.y - 6);
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
        const alvoBoss = (estado.boss && estado.boss.nome) || "Vilão";
        const ritmo = await jogarRitmo({ tipoMusico: m.tipo, cor: corPorTipo[m.tipo] });
        if (ritmo === null) return;                 // Esc cancelou: não gasta a vez

        const res = await api.executar_acao({ indice: m.id, ritmo });
        if (!res || res.ok === false) return;
        const pool = res.critico ? FRASES_CRITICO
                   : res.modo_refrao_ativo ? FRASES_REFRAO : FRASES_ATAQUE;
        aoLog(_frase(pool, m.nome, alvoBoss, res.dano));
        aplicarEstado(res.estado);
        if (res.fim_de_jogo) return finalizar(res.resultado_final);

        // Respiro antes do contra-ataque (5a; o auto-ataque por tempo real é 5b).
        await esperar(CONFIG.REVIDE_MS);
        const cont = await api.turno_inimigo();
        if (cont && cont.ok !== false) {
          if (cont.alvo) aoLog(_frase(FRASES_VILAO, cont.atacante, cont.alvo, cont.dano));
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
  function montar({ canvas, api, estado, corPorTipo, aoAtualizar, aoFim, aoLog } = {}) {
    const ctx = canvas ? canvas.getContext("2d") : null;
    if (canvas) { canvas.width = CONFIG.LARGURA; canvas.height = CONFIG.ALTURA; }
    const jogarRitmo = (window.RitmoMinigame && window.RitmoMinigame.jogarRitmo)
      ? window.RitmoMinigame.jogarRitmo
      : (() => Promise.resolve(null));

    const batalha = criarBatalha({ ctx, api, jogarRitmo, estado, corPorTipo, aoAtualizar, aoFim, aoLog });

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
