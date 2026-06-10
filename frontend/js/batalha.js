// Arena de batalha estilo Mortal Kombat (F3.5a/5b): a banda fica à ESQUERDA
// (cada membro com seu instrumento, encarando o vilão), o vilão à DIREITA. As
// barras de vida ficam no HUD em DOM (banda topo-esq., vilão topo-dir.) — quem
// desenha os sprites é este canvas; quem pinta as barras é o main.js via
// `aoAtualizar`.
//
// Mesma estratégia de testabilidade do ritmo.js/overworld.js: o SHELL (ctx,
// api, jogarRitmo, agora/agendarFrame) é injetável. Em produção usa o canvas
// real, o RitmoMinigame, a ponte pywebview e rAF; no harness injeta fakes e
// dirige `passo(dt)` na mão, então a simulação é determinística.
//
// F3.5b — máquina de fases:  intro → luta ⇄ pausa → fim
//   intro : banda toca → vilão entra → "FIGHT" (pulável com Enter/Espaço/Esc)
//   luta  : vilão ataca SOZINHO a cada AUTO_ATAQUE_MS (relógio congela com o
//           minigame aberto e na pausa; cada hit do player rearma); combo
//           perfeito atordoa (vilão perde a vez); espaço = golpe especial.
//   pausa : Esc abre o menu (overlay DOM do main.js); relógio congelado.
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
  const FRASES_ESPECIAL = [
    "⚡ A BANDA INTEIRA caiu em cima de {v}: {d} de dano!",
    "⚡ ESPECIAL! Wall of sound esmagou {v} — {d}!",
    "⚡ Power chord coletivo! {v} levou {d}!",
  ];
  const FRASES_STUN = [
    "💫 {a} está ATORDOADO e perdeu a vez!",
    "💫 {a} ficou zonzo com o combo perfeito — passou a vez!",
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
    BOSS_X: 628,           // x do vilão (direita)
    AUTO_ATAQUE_MS: 2500,  // relógio do vilão: ataca sozinho a cada tanto (5b)
    INTRO_BANDA_MS: 1200,  // intro: banda toca…
    INTRO_VILAO_MS: 1200,  // …o vilão entra…
    INTRO_FIGHT_MS: 800,   // …"FIGHT!" e começa.
  };
  const INTRO_TOTAL_MS = CONFIG.INTRO_BANDA_MS + CONFIG.INTRO_VILAO_MS + CONFIG.INTRO_FIGHT_MS;

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
  // opts: { ctx, api, jogarRitmo, estado, corPorTipo, agora, agendarFrame,
  //         aoAtualizar, aoFim, aoLog, aoPausar, aoLuta }
  function criarBatalha(opts) {
    const ctx = opts.ctx || null;
    const api = opts.api;
    const jogarRitmo = opts.jogarRitmo || (() => Promise.resolve(null));
    const corPorTipo = opts.corPorTipo || COR_POR_TIPO;
    const agora = opts.agora || (() => performance.now());
    const agendarFrame = opts.agendarFrame || ((cb) => requestAnimationFrame(cb));
    const aoAtualizar = opts.aoAtualizar || function () {};
    const aoFim = opts.aoFim || function () {};
    const aoLog = opts.aoLog || function () {};
    const aoPausar = opts.aoPausar || function () {};
    const aoLuta = opts.aoLuta || function () {};
    const aoSelecionar = opts.aoSelecionar || function () {};

    let estado = opts.estado;
    let selecionado = 0;
    let ocupado = false;       // true enquanto um ataque (minigame + resolução) roda
    let encerrado = false;

    // F3.5b — máquina de fases + relógio do vilão + estado de luta.
    let fase = "intro";
    let introT = 0;
    let timerAuto = CONFIG.AUTO_ATAQUE_MS;
    let vilaoAgindo = false;   // turno_inimigo em voo (congela o relógio)
    let bossAtordoado = false;
    let especialDisponivel = false;
    let perfeitosSeguidos = 0;

    let rodando = false;       // loop de produção (rAF)
    let ultimoT = null;

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
      emitirSelecao();
      desenhar();
    }

    function emitirSelecao() {
      aoSelecionar(membros()[selecionado] || null);   // HUD de moves (F3.6b)
    }

    function emitirLuta() {
      aoLuta({ fase, especialDisponivel, perfeitosSeguidos, bossAtordoado });
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

    // ── Render (placeholders; pixel art troca só esta função) ──────────────────
    function desenhar() {
      if (!ctx) return;
      const C = CONFIG;
      ctx.clearRect(0, 0, C.LARGURA, C.ALTURA);
      ctx.fillStyle = "#14111c"; ctx.fillRect(0, 0, C.LARGURA, C.ALTURA);
      ctx.fillStyle = "#1b1526"; ctx.fillRect(0, 0, C.LARGURA, 70);   // fundo do palco
      ctx.fillStyle = "#211b2e"; ctx.fillRect(0, C.CHAO_Y, C.LARGURA, C.ALTURA - C.CHAO_Y);

      const naIntro = fase === "intro";
      const tBanda = Math.min(introT, C.INTRO_BANDA_MS);
      const tVilao = Math.min(Math.max(introT - C.INTRO_BANDA_MS, 0), C.INTRO_VILAO_MS);

      // Banda no palco (de trás pra frente, pra sobreposição ficar certa).
      // Na intro ela "toca": os sprites oscilam e soltam notas.
      const ms = membros();
      const pos = layoutBanda(ms);
      ms.map((m, i) => i).sort((a, b) => pos[a].y - pos[b].y).forEach((i) => {
        const m = ms[i], p = pos[i];
        const balanco = naIntro ? Math.sin(introT / 90 + i * 1.7) * 4 : 0;
        ctx.globalAlpha = m.vivo ? 1 : 0.3;
        ctx.fillStyle = corPorTipo[m.tipo] || "#e0457b";
        ctx.fillRect(p.x, p.y + balanco, C.MEMBRO_W, C.MEMBRO_H);
        // "instrumento": haste na frente (lado direito = encarando o vilão).
        ctx.fillStyle = "#0d0a14";
        ctx.fillRect(p.x + C.MEMBRO_W, p.y + balanco + C.MEMBRO_H * 0.45, 16, 7);
        ctx.globalAlpha = 1;
        if (naIntro && tBanda > 120) {
          ctx.fillStyle = "#ece6f5"; ctx.font = "16px monospace"; ctx.textAlign = "center";
          ctx.fillText("🎵", p.x + C.MEMBRO_W / 2 + Math.sin(introT / 150 + i) * 14,
                       p.y - 26 - (introT / 40 + i * 9) % 26);
        }
        if (!naIntro && i === selecionado && m.vivo) {
          ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3;
          ctx.strokeRect(p.x - 3, p.y - 3, C.MEMBRO_W + 6, C.MEMBRO_H + 6);
          ctx.fillStyle = "#ffffff"; ctx.font = "10px monospace"; ctx.textAlign = "center";
          ctx.fillText("▼", p.x + C.MEMBRO_W / 2, p.y - 18);
        }
        ctx.fillStyle = "#ece6f5"; ctx.font = "10px monospace"; ctx.textAlign = "center";
        ctx.fillText(m.nome, p.x + C.MEMBRO_W / 2, p.y - 6);
      });

      // Vilão (direita). Na intro ele desliza de fora da tela até o lugar.
      const boss = (estado && estado.boss) || {};
      let bx = C.BOSS_X;
      if (naIntro) {
        if (introT < C.INTRO_BANDA_MS) bx = C.LARGURA + 20;            // ainda fora
        else bx = C.LARGURA + 20 - (C.LARGURA + 20 - C.BOSS_X) * (tVilao / C.INTRO_VILAO_MS);
      }
      ctx.globalAlpha = bossAtordoado ? 0.6 : 1;
      ctx.fillStyle = "#b8324a";
      ctx.fillRect(bx, C.CHAO_Y - C.BOSS_H, C.BOSS_W, C.BOSS_H);
      ctx.fillStyle = "#0d0a14";        // detalhe "encarando" a esquerda
      ctx.fillRect(bx - 14, C.CHAO_Y - C.BOSS_H * 0.6, 14, 8);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ece6f5"; ctx.font = "12px monospace"; ctx.textAlign = "center";
      ctx.fillText(boss.nome || "Vilão", bx + C.BOSS_W / 2, C.CHAO_Y - C.BOSS_H - 9);
      if (bossAtordoado) {
        ctx.font = "22px monospace";
        ctx.fillText("💫", bx + C.BOSS_W / 2, C.CHAO_Y - C.BOSS_H - 28);
      }

      // Relógio do vilão (lutinha justa: dá pra ver o golpe chegando).
      if (fase === "luta" && !bossAtordoado) {
        const frac = Math.max(0, Math.min(1, timerAuto / C.AUTO_ATAQUE_MS));
        ctx.fillStyle = "#2a2138";
        ctx.fillRect(bx, C.CHAO_Y + 12, C.BOSS_W, 6);
        ctx.fillStyle = frac < 0.25 ? "#e23b4e" : "#e0b341";
        ctx.fillRect(bx, C.CHAO_Y + 12, C.BOSS_W * (1 - frac), 6);
      }

      // "FIGHT!" no fim da intro.
      if (naIntro && introT >= C.INTRO_BANDA_MS + C.INTRO_VILAO_MS) {
        ctx.fillStyle = "#e0b341"; ctx.font = "bold 64px monospace"; ctx.textAlign = "center";
        ctx.fillText("FIGHT!", C.LARGURA / 2, C.ALTURA / 2);
      }
    }

    // ── Seleção (só entre vivos) ───────────────────────────────────────────────
    function selecionarIndice(i) {
      if (fase !== "luta") return;
      const m = membros()[i];
      if (m && m.vivo) { selecionado = i; emitirSelecao(); desenhar(); }
    }
    function selecionar(dir) {
      if (fase !== "luta") return;
      const ms = membros();
      if (!ms.length) return;
      let i = selecionado;
      for (let n = 0; n < ms.length; n++) {
        i = (i + dir + ms.length) % ms.length;
        if (ms[i] && ms[i].vivo) { selecionado = i; break; }
      }
      emitirSelecao();
      desenhar();
    }

    // ── Relógio/fases: o coração determinístico da 5b ──────────────────────────
    // Avança a simulação por `dt` ms. Pode devolver uma Promise (quando o
    // relógio estoura e o vilão age) — o harness dá `await`, o loop ignora.
    function passo(dt) {
      if (encerrado) return;
      if (fase === "intro") {
        introT += dt;
        if (introT >= INTRO_TOTAL_MS) iniciarLuta();
        else desenhar();
        return;
      }
      if (fase === "luta" && !ocupado && !vilaoAgindo) {
        timerAuto -= dt;
        if (timerAuto <= 0) return turnoVilao();
      }
      desenhar();
    }

    function iniciarLuta() {
      if (fase === "fim") return;
      fase = "luta";
      introT = INTRO_TOTAL_MS;
      timerAuto = CONFIG.AUTO_ATAQUE_MS;
      emitirLuta();
      desenhar();
    }
    function pularIntro() {
      if (fase === "intro") iniciarLuta();
    }

    function pausar() {
      if (fase !== "luta" || ocupado || encerrado) return;
      fase = "pausa";
      aoPausar();
      desenhar();
    }
    function retomar() {
      if (fase !== "pausa") return;
      fase = "luta";
      emitirLuta();
      desenhar();
    }

    // ── Vilão age sozinho (relógio estourou) ───────────────────────────────────
    async function turnoVilao() {
      if (encerrado || fase !== "luta") return;
      vilaoAgindo = true;
      try {
        const cont = await api.turno_inimigo();
        if (cont && cont.ok !== false) {
          if (cont.atordoado) {
            aoLog(_frase(FRASES_STUN, cont.atacante || "Vilão", "", 0));
            bossAtordoado = false;             // a vez perdida consome o stun
          } else if (cont.alvo) {
            aoLog(_frase(FRASES_VILAO, cont.atacante, cont.alvo, cont.dano));
          }
          emitirLuta();
          aplicarEstado(cont.estado);
          if (cont.fim_de_jogo) return finalizar(cont.resultado_final);
        }
      } finally {
        timerAuto = CONFIG.AUTO_ATAQUE_MS;
        vilaoAgindo = false;
      }
    }

    // ── Ataque do player (abre o minigame; hit rearma o relógio) ───────────────
    // `moveIdx`: qual golpe do moveset usar (0..2; teclas 1/2/3 — Enter = 1º).
    // Membro sem moveset (compat/harness antigo) ataca sem move_id/chart.
    async function atacar(moveIdx) {
      if (fase !== "luta" || ocupado || encerrado || !estado || estado.fim_de_jogo) return;
      normalizarSelecao();
      const m = membros()[selecionado];
      if (!m || !m.vivo) return;
      const moves = m.moves || [];
      const move = moves[moveIdx] || moves[0] || null;

      ocupado = true;
      try {
        const alvoBoss = (estado.boss && estado.boss.nome) || "Vilão";
        const ritmo = await jogarRitmo({
          tipoMusico: m.tipo, cor: corPorTipo[m.tipo],
          chart: move ? move.chart : undefined,
          nomeMove: move ? `${m.nome} — ${move.nome}` : undefined,
        });
        if (ritmo === null) return;                 // Esc cancelou: não gasta a vez

        const payload = { indice: m.id, ritmo };
        if (move) payload.move_id = move.id;
        const res = await api.executar_acao(payload);
        if (!res || res.ok === false) return;
        const pool = res.critico ? FRASES_CRITICO
                   : res.modo_refrao_ativo ? FRASES_REFRAO : FRASES_ATAQUE;
        aoLog(_frase(pool, m.nome, alvoBoss, res.dano));

        bossAtordoado = !!res.atordoado;
        perfeitosSeguidos = res.perfeitos_seguidos || 0;
        especialDisponivel = !!res.especial_disponivel;
        timerAuto = CONFIG.AUTO_ATAQUE_MS;          // hit rearma o relógio do vilão
        emitirLuta();
        aplicarEstado(res.estado);
        if (res.fim_de_jogo) return finalizar(res.resultado_final);
      } finally {
        ocupado = false;
      }
    }

    // ── Golpe especial (espaço; 4 perfeitos seguidos) ──────────────────────────
    async function especial() {
      if (fase !== "luta" || ocupado || encerrado) return;
      if (!especialDisponivel) {
        aoLog(`⚡ Especial ainda não está pronto — ${esc(perfeitosSeguidos)}/4 combos perfeitos.`);
        return;
      }
      ocupado = true;
      try {
        const res = await api.ataque_especial();
        if (!res || res.ok === false) {
          if (res && res.erro) aoLog(`⚠️ ${esc(res.erro.mensagem)}`);
          return;
        }
        const alvoBoss = (estado.boss && estado.boss.nome) || "Vilão";
        aoLog(_frase(FRASES_ESPECIAL, res.atacante || "Banda", alvoBoss, res.dano));
        especialDisponivel = false;
        perfeitosSeguidos = 0;
        timerAuto = CONFIG.AUTO_ATAQUE_MS;
        emitirLuta();
        aplicarEstado(res.estado);
        if (res.fim_de_jogo) return finalizar(res.resultado_final);
      } finally {
        ocupado = false;
      }
    }

    function finalizar(resultado) {
      if (encerrado) return;
      encerrado = true;
      fase = "fim";
      aoFim(resultado);
    }

    // ── Loop de produção (rAF injetável; o harness dirige passo() direto) ──────
    function frame() {
      if (!rodando) return;
      const t = agora();
      const dt = ultimoT === null ? 0 : t - ultimoT;
      ultimoT = t;
      passo(dt);
      if (rodando && !encerrado) agendarFrame(frame);
    }
    function iniciar() {
      if (rodando) return;
      rodando = true;
      ultimoT = null;
      agendarFrame(frame);
    }
    function parar() { rodando = false; }

    // Primeira pintura.
    normalizarSelecao();
    aoAtualizar(estado);
    emitirSelecao();
    desenhar();

    return {
      atacar, especial, selecionar, selecionarIndice, membroNoPonto, desenhar,
      passo, pularIntro, pausar, retomar, iniciar, parar,
      get estado() { return estado; },
      get selecionado() { return selecionado; },
      get ocupado() { return ocupado; },
      get encerrado() { return encerrado; },
      get fase() { return fase; },
      get timerAuto() { return timerAuto; },
      get bossAtordoado() { return bossAtordoado; },
      get especialDisponivel() { return especialDisponivel; },
      get perfeitosSeguidos() { return perfeitosSeguidos; },
    };
  }

  // ── Entrada de produção: liga canvas + teclado + minigame real ──────────────
  function montar({ canvas, api, estado, corPorTipo,
                    aoAtualizar, aoFim, aoLog, aoPausar, aoLuta, aoSelecionar } = {}) {
    const ctx = canvas ? canvas.getContext("2d") : null;
    if (canvas) { canvas.width = CONFIG.LARGURA; canvas.height = CONFIG.ALTURA; }
    const jogarRitmo = (window.RitmoMinigame && window.RitmoMinigame.jogarRitmo)
      ? window.RitmoMinigame.jogarRitmo
      : (() => Promise.resolve(null));

    const batalha = criarBatalha({
      ctx, api, jogarRitmo, estado, corPorTipo,
      aoAtualizar, aoFim, aoLog, aoPausar, aoLuta, aoSelecionar,
    });

    function onKeyDown(e) {
      const t = e.key.toLowerCase();
      if (batalha.fase === "intro") {
        if (t === "enter" || t === " " || t === "escape") { e.preventDefault(); batalha.pularIntro(); }
        return;
      }
      if (batalha.ocupado) return;        // durante o minigame, as teclas são dele
      if (batalha.fase === "pausa") return;  // overlay de pausa (main.js) cuida
      if (t === "arrowleft" || t === "a") { e.preventDefault(); batalha.selecionar(-1); }
      else if (t === "arrowright" || t === "d") { e.preventDefault(); batalha.selecionar(1); }
      else if (t === "enter") { e.preventDefault(); batalha.atacar(0); }
      else if (t === "1" || t === "2" || t === "3") {   // F3.6b: golpe direto
        e.preventDefault(); batalha.atacar(Number(t) - 1);
      }
      else if (t === " ") { e.preventDefault(); batalha.especial(); }
      else if (t === "escape") { e.preventDefault(); batalha.pausar(); }
    }
    function onClick(e) {
      if (batalha.ocupado || batalha.fase !== "luta" || !canvas) return;
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) * (CONFIG.LARGURA / r.width);
      const y = (e.clientY - r.top) * (CONFIG.ALTURA / r.height);
      const i = batalha.membroNoPonto(x, y);
      if (i >= 0) { batalha.selecionarIndice(i); batalha.atacar(); }
    }

    window.addEventListener("keydown", onKeyDown);
    if (canvas) canvas.addEventListener("click", onClick);
    batalha.iniciar();

    const handle = {
      batalha,
      desligar() {
        batalha.parar();
        window.removeEventListener("keydown", onKeyDown);
        if (canvas) canvas.removeEventListener("click", onClick);
      },
    };
    window.__batalha = handle;   // depuração/harness
    return handle;
  }

  window.Batalha = { criarBatalha, montar, CONFIG, COR_POR_TIPO };
})();
