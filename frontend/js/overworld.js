// Overworld side-scroll "lite" — a banda anda pelo mundo, entra em venues
// (portas que disparam a batalha de ritmo) e pega itens andando por cima.
//
// SEM física de plataforma (decisão de escopo F3.2): só movimento horizontal +
// proximidade (AABB 1D). Mesma estratégia de testabilidade do ritmo.js: o SHELL
// de tempo/render é injetável (agora / agendarFrame / ctx). Em produção usa
// performance.now + rAF + canvas; no harness o relógio e a entrada são
// programáticos, então a simulação é determinística.
//
// Sem ES modules: tudo pendurado em window.Overworld.

(function () {
  "use strict";

  const CONFIG = {
    VEL: 0.22,          // px por ms enquanto uma direção está pressionada
    LARGURA: 800,       // viewport (canvas)
    ALTURA: 360,
    CHAO_Y: 300,        // linha do chão
    TAM_BANDA: 44,      // lado do "sprite" placeholder da banda
    RAIO_PORTA: 56,     // alcance pra "entrar" numa venue (W)
    RAIO_ITEM: 34,      // alcance pra coletar um item (sobreposição)
    MARGEM_MUNDO: 200,  // folga de mundo além do último ponto de interesse
  };

  const COR_POR_TIPO = {
    guitarrista: "#e23b4e", vocalista: "#b04ad8",
    baixista: "#4a78d8", baterista: "#e0b341",
  };

  // Paleta de cores da van por estágio (MAP-01, Phase 1 — arte definitiva é Phase 2).
  const VAN_COR = ["#888", "#4a78d8", "#e0b341"];  // estágio 1/2/3

  // ── Núcleo do mundo (shell injetável) ───────────────────────────────────────
  // opts: { agora, agendarFrame, ctx, venues, itens, loja, vanEstagio, npcs, baus, inicioX,
  //         aoEntrar, aoColetar, aoLoja, aoNpc, aoBau, aoAtualizar, aoSfx }
  function criarMundo(opts) {
    const agora = opts.agora;
    const agendarFrame = opts.agendarFrame;
    const ctx = opts.ctx || null;
    const aoEntrar = opts.aoEntrar || function () {};
    const aoColetar = opts.aoColetar || function () {};
    const aoLoja = opts.aoLoja || function () {};
    const aoAtualizar = opts.aoAtualizar || function () {};
    // MAP-02 (Phase 1): callback disparado ao abordar NPC com W.
    const aoNpc = opts.aoNpc || function () {};
    // MAP-03 (Phase 1): callback disparado ao abrir baú com W.
    const aoBau = opts.aoBau || function () {};
    // VIS-02: callback de SFX — aoSfx(nome) dispara audio[nome]().
    const aoSfx = opts.aoSfx || function () {};

    // Estado mutável, clonado das definições (não mexe nos dicts do chamador).
    const venues = (opts.venues || []).map((v) => ({ ...v, concluida: !!v.concluida }));
    const itens = (opts.itens || []).map((i) => ({ ...i, coletado: !!i.coletado }));
    const loja = opts.loja ? { ...opts.loja } : null;   // F3.8: ponto da loja 🏪
    // MAP-02 (Phase 1): clona NPCs com flag dado (D-07).
    const npcs = (opts.npcs || []).map((n) => ({ ...n, dado: !!n.dado }));
    // MAP-03 (Phase 1): clona baús com flags aberto e revelado (D-11/D-13).
    const baus = (opts.baus || []).map((b) => ({ ...b, aberto: !!b.aberto, revelado: !!b.revelado }));

    // MAP-01 (Phase 1): estágio visual da van (1=lata-velha, 2=decente, 3=tunada).
    // Vem do backend (_campanha_dto.van_estagio); default 1 quando não informado.
    const vanEstagio = opts.vanEstagio || 1;

    const pontos = [...venues.map((v) => v.x), ...itens.map((i) => i.x),
                    ...(loja ? [loja.x] : []), ...npcs.map((n) => n.x),
                    ...baus.map((b) => b.x), 0];
    const larguraMundo = Math.max(...pontos) + CONFIG.MARGEM_MUNDO;

    const banda = { x: opts.inicioX || 60, largura: CONFIG.TAM_BANDA };
    let direcao = 0;          // -1 esquerda, 0 parado, +1 direita
    let cameraX = 0;
    let ultimoT = null;
    let rodando = false;

    function centroBanda() { return banda.x + banda.largura / 2; }

    function ajustarCamera() {
      const alvo = centroBanda() - CONFIG.LARGURA / 2;
      cameraX = Math.max(0, Math.min(alvo, larguraMundo - CONFIG.LARGURA));
    }

    // MAP-02 (Phase 1): balão de fala — estado interno (D-15/D-16).
    // null = fechado; { texto, subtexto } = aberto.
    let balao = null;
    function abrirBalao(texto, subtexto) { balao = { texto: texto || "", subtexto: subtexto || "" }; }
    function fecharBalao() { balao = null; }

    // VIS-02: sparkle de coleta — timer e posição (não entram em estado()).
    let sparkleT = 0;
    let sparkleX = 0;

    // Avança a simulação por `dt` ms — núcleo determinístico (sem relógio nem rAF).
    function passo(dt) {
      // VIS-02: decrementar sparkle ANTES do return do balão, para que o brilho
      // apareça e termine mesmo se o balão abrir logo após a coleta.
      if (sparkleT > 0) sparkleT = Math.max(0, sparkleT - dt);

      if (balao) return;   // D-16: congela tudo enquanto balão está aberto
      if (direcao !== 0) {
        banda.x += direcao * CONFIG.VEL * dt;
        banda.x = Math.max(0, Math.min(banda.x, larguraMundo - banda.largura));
      }
      ajustarCamera();
      coletarPorSobreposicao();
      aoAtualizar(estado());
    }

    function coletarPorSobreposicao() {
      const cx = centroBanda();
      for (const item of itens) {
        if (item.coletado) continue;
        if (Math.abs(cx - item.x) <= CONFIG.RAIO_ITEM) {
          item.coletado = true;
          // VIS-02: dispara SFX e inicia sparkle na posição do item
          aoSfx("item");
          sparkleT = 500;  // 500ms de brilho
          sparkleX = item.x;
          aoColetar(item);
        }
      }
    }

    // Venue não-concluída mais próxima dentro do alcance da porta.
    function venuePerto() {
      const cx = centroBanda();
      let alvo = null, melhor = CONFIG.RAIO_PORTA + 1;
      for (const v of venues) {
        if (v.concluida) continue;
        const d = Math.abs(cx - v.x);
        if (d <= CONFIG.RAIO_PORTA && d < melhor) { melhor = d; alvo = v; }
      }
      return alvo;
    }

    // Loja dentro do alcance? (F3.8 — o jogador precisa IR até a loja.)
    function lojaPerto() {
      return !!(loja && Math.abs(centroBanda() - loja.x) <= CONFIG.RAIO_PORTA);
    }

    // MAP-02 (Phase 1): NPC mais próximo dentro do alcance (D-08).
    // NPCs já dados ainda são detectados (para repetir a fala — D-07).
    function npcPerto() {
      const cx = centroBanda();
      let alvo = null, melhor = CONFIG.RAIO_PORTA + 1;
      for (const n of npcs) {
        const d = Math.abs(cx - n.x);
        if (d <= CONFIG.RAIO_PORTA && d < melhor) { melhor = d; alvo = n; }
      }
      return alvo;
    }

    // MAP-03 (Phase 1): baú não-aberto E revelado mais próximo dentro do alcance (D-11).
    // Baús não revelados (ocultos por gate de fama) são completamente ignorados.
    function bauPerto() {
      const cx = centroBanda();
      for (const b of baus) {
        if (b.aberto) continue;
        if (!b.revelado) continue;   // D-11: oculto até fama >= fama_minima
        if (Math.abs(cx - b.x) <= CONFIG.RAIO_PORTA) return b;
      }
      return null;
    }

    // Entrar (W): fecha balão se aberto; prioridade loja > venue > NPC > baú (D-08).
    function interagir() {
      if (balao) { fecharBalao(); return null; }   // D-16: W fecha balão

      const v = venuePerto();
      const n = npcPerto();
      const b = bauPerto();
      const cx = centroBanda();
      if (lojaPerto() && (!v || Math.abs(cx - loja.x) < Math.abs(cx - v.x))) {
        aoLoja(loja);
        return null;
      }
      if (v) { aoEntrar(v); return v; }
      if (n) { aoNpc(n); return null; }
      if (b) { aoBau(b); return null; }   // MAP-03 (Phase 1): baú revelado perto
      return null;
    }

    function marcarVenueConcluida(id) {
      const v = venues.find((x) => x.id === id);
      if (v) v.concluida = true;
    }

    // MAP-03 (Phase 1): marca o baú como aberto localmente (D-13 — uma vez só).
    // Sem isto, bauPerto() continua retornando o baú e cada W reabre (item infinito).
    function marcarBauAberto(id) {
      const b = baus.find((x) => x.id === id);
      if (b) b.aberto = true;
    }

    // Mapa de teclas → ação. Mantém o motor agnóstico do DOM.
    function pressionar(tecla) {
      const t = (tecla || "").toLowerCase();
      if (t === "a" || t === "arrowleft") direcao = -1;
      else if (t === "d" || t === "arrowright") direcao = 1;
      else if (t === "w" || t === "arrowup" || t === " " || t === "enter") interagir();
    }
    function soltar(tecla) {
      const t = (tecla || "").toLowerCase();
      if ((t === "a" || t === "arrowleft") && direcao === -1) direcao = 0;
      if ((t === "d" || t === "arrowright") && direcao === 1) direcao = 0;
    }

    function estado() {
      return {
        banda: { x: banda.x, centro: centroBanda() },
        camera_x: cameraX,
        direcao,
        largura_mundo: larguraMundo,
        venues: venues.map((v) => ({ id: v.id, x: v.x, nome: v.nome, concluida: v.concluida })),
        itens: itens.map((i) => ({ id: i.id, x: i.x, tipo: i.tipo, coletado: i.coletado })),
        venue_perto: (venuePerto() || {}).id ?? null,
        loja: loja ? { x: loja.x } : null,
        loja_perto: lojaPerto(),
        van_estagio: vanEstagio,  // MAP-01 (Phase 1): estágio da van (backend autoritativo)
        // MAP-02 (Phase 1): NPCs e balão de fala.
        npcs: npcs.map((n) => ({ id: n.id, x: n.x, nome: n.nome, dado: n.dado })),
        npc_perto: (npcPerto() || {}).id ?? null,
        balao_aberto: balao !== null,
        balao: balao,
        // MAP-03 (Phase 1): baús/segredos e detecção de proximidade.
        baus: baus.map((b) => ({ id: b.id, x: b.x, aberto: b.aberto, revelado: b.revelado })),
        bau_perto: (bauPerto() || {}).id ?? null,
      };
    }

    // ── Render (canvas) — placeholders coloridos; arte real é F3.4 ─────────────
    function desenhar() {
      if (!ctx) return;
      const C = CONFIG;
      ctx.clearRect(0, 0, C.LARGURA, C.ALTURA);
      // UX-03/D-08: background parallax 3 camadas (céu+skyline+rua) via Sprites.
      Sprites.desenharFundo(ctx, C.LARGURA, C.ALTURA, cameraX);

      // Venues (portas) — sprite pixel art por status (concluída=verde / não=rosa).
      for (const v of venues) {
        const px = v.x - cameraX;
        if (px < -80 || px > C.LARGURA + 80) continue;
        // Venue: 8 cols × 10 rows @ escala 5 = 40×50px; centro em px, base no chão.
        const venueEsc = 5;
        const venueW = 8 * venueEsc, venueH = 10 * venueEsc;
        ctx.save();
        Sprites.desenharVenue(ctx, px - venueW / 2, C.CHAO_Y - venueH, venueEsc, v.concluida);
        ctx.restore();
        // D-09: fachada temática por venue sobre a rua (prenunciando o cenário).
        Sprites.desenharFachada(ctx, v.id, px, C.CHAO_Y, venueEsc);
        ctx.fillStyle = "#ece6f5";
        ctx.font = "12px monospace";
        ctx.textAlign = "center";
        ctx.fillText(v.nome || "Venue", px, C.CHAO_Y - venueH - 8);
        if (!v.concluida && venuePerto() && venuePerto().id === v.id) {
          ctx.fillText("[W] entrar", px, C.CHAO_Y - venueH - 20);
        }
      }
      // Loja (F3.8) — sprite pixel art (prédio azul com letreiro dourado).
      if (loja) {
        const px = loja.x - cameraX;
        if (px > -80 && px < C.LARGURA + 80) {
          const lojaEsc = 5;
          const lojaW = 8 * lojaEsc, lojaH = 10 * lojaEsc;
          ctx.save();
          Sprites.desenharLoja(ctx, px - lojaW / 2, C.CHAO_Y - lojaH, lojaEsc);
          ctx.restore();
          ctx.fillStyle = "#ece6f5";
          ctx.font = "12px monospace";
          ctx.textAlign = "center";
          ctx.fillText("🏪 Loja", px, C.CHAO_Y - lojaH - 8);
          if (lojaPerto()) ctx.fillText("[W] comprar", px, C.CHAO_Y - lojaH - 20);
        }
      }
      // Itens.
      for (const it of itens) {
        if (it.coletado) continue;
        const px = it.x - cameraX;
        if (px < -40 || px > C.LARGURA + 40) continue;
        ctx.fillStyle = "#e0b341";
        ctx.beginPath();
        ctx.arc(px, C.CHAO_Y - 16, 10, 0, Math.PI * 2);
        ctx.fill();
      }
      // MAP-02 (Phase 1): NPCs — sprite pixel art. Já-dados ficam esmaecidos.
      // Perto mostra [W] falar. (Sempre desenhados — D-07.)
      for (const n of npcs) {
        const px = n.x - cameraX;
        if (px < -60 || px > C.LARGURA + 60) continue;
        // NPC: 5 cols × 7 rows @ escala 5 = 25×35px; centro em px, base no chão.
        const npcEsc = 5;
        const npcW = 5 * npcEsc, npcH = 7 * npcEsc;
        ctx.save();
        ctx.globalAlpha = n.dado ? 0.5 : 1;
        Sprites.desenharNpc(ctx, px - npcW / 2, C.CHAO_Y - npcH, npcEsc, n.dado);
        ctx.globalAlpha = 1;
        ctx.restore();
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = "#ece6f5";
        ctx.fillText(n.nome || "NPC", px, C.CHAO_Y - npcH - 8);
        if (npcPerto() && npcPerto().id === n.id) {
          ctx.fillText("[W] falar", px, C.CHAO_Y - npcH - 20);
        }
      }
      // MAP-03 (Phase 1): baús/segredos — só desenha quando revelado e não aberto (D-11).
      for (const b of baus) {
        if (!b.revelado || b.aberto) continue;
        const px = b.x - cameraX;
        if (px < -40 || px > C.LARGURA + 40) continue;
        // Baú: sprite pixel art (caixa dourada). 7 cols × 5 rows @ escala 4 = 28×20px.
        const bauEsc = 4;
        const bauW = 7 * bauEsc, bauH = 5 * bauEsc;
        ctx.save();
        Sprites.desenharBau(ctx, px - bauW / 2, C.CHAO_Y - bauH, bauEsc);
        ctx.restore();
        ctx.fillStyle = "#ece6f5";
        ctx.font = "9px monospace";
        ctx.textAlign = "center";
        ctx.fillText("BAU", px, C.CHAO_Y - bauH - 4);
        if (bauPerto() && bauPerto().id === b.id) {
          ctx.fillText("[W] abrir", px, C.CHAO_Y - bauH - 14);
        }
      }
      // Van da banda por estágio — sprite pixel art (10 cols × 6 rows @ escala 4 = 40×24px).
      const bx = banda.x - cameraX;
      const vanEsc = 4;
      const vanW = 10 * vanEsc, vanH = 6 * vanEsc;
      ctx.save();
      Sprites.desenharVan(ctx, vanEstagio || 1, bx, C.CHAO_Y - vanH, vanEsc);
      ctx.restore();

      // VIS-02: sparkle de coleta — brilho radiante na posição do item coletado.
      if (sparkleT > 0) {
        const sx = sparkleX - cameraX;
        const sy = C.CHAO_Y - 16;
        const frac = sparkleT / 500;  // 1→0 conforme o timer esgota
        ctx.save();
        ctx.globalAlpha = frac * 0.9;
        // Círculo expansivo amarelo-dourado
        ctx.strokeStyle = "#e0b341";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, 10 + (1 - frac) * 22, 0, Math.PI * 2);
        ctx.stroke();
        // Raios em 8 direções
        ctx.strokeStyle = "#ffe97a";
        ctx.lineWidth = 1.5;
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2;
          const r1 = 13 + (1 - frac) * 10;
          const r2 = r1 + 8 * frac;
          ctx.beginPath();
          ctx.moveTo(sx + Math.cos(ang) * r1, sy + Math.sin(ang) * r1);
          ctx.lineTo(sx + Math.cos(ang) * r2, sy + Math.sin(ang) * r2);
          ctx.stroke();
        }
        // Emoji ✨ no centro
        ctx.globalAlpha = frac;
        ctx.font = "14px monospace";
        ctx.textAlign = "center";
        ctx.fillText("✨", sx, sy - 18 - (1 - frac) * 10);
        ctx.restore();
      }
    }

    // MAP-02 (Phase 1): balão de fala HQ sobre a van — desenhado no canvas (D-15/D-17).
    // Nunca usa innerHTML; toda string vai para ctx.fillText (sem XSS — T-03-04).
    // Reescrita UX-06: quebra de linha por palavra, borda arredondada (arcTo), cauda triangular.
    //
    // _roundRectLocal: replica _roundRect de sprites.js via arcTo.
    // Não usa a API roundRect nativa (ausente no JSDOM — Pitfall 1).
    // Interno a desenharBalao para não poluir o escopo do IIFE.
    function _roundRectLocal(c, x, y, w, h, r) {
      c.beginPath();
      c.moveTo(x + r, y);
      c.lineTo(x + w - r, y);
      c.arcTo(x + w, y, x + w, y + r, r);
      c.lineTo(x + w, y + h - r);
      c.arcTo(x + w, y + h, x + w - r, y + h, r);
      c.lineTo(x + r, y + h);
      c.arcTo(x, y + h, x, y + h - r, r);
      c.lineTo(x, y + r);
      c.arcTo(x, y, x + r, y, r);
      c.closePath();
    }

    function desenharBalao() {
      if (!balao || !ctx) return;
      const C = CONFIG;

      // Dimensões do balão (UX-06)
      const LARGURA_MAX = Math.min(320, C.LARGURA - 32);
      const PAD_H = 12;       // padding horizontal
      const PAD_V = 8;        // padding vertical
      const RAIO = 8;         // raio de borda arredondada
      const CAUDA_H = 8;      // altura da cauda triangular
      const MAX_LINHAS = 5;

      // Fonte do texto principal (NÃO pixel font — Segoe UI 700 13px, UX-06)
      ctx.font = "700 13px \"Segoe UI\", system-ui, sans-serif";

      // Quebra de linha por palavra (acumulando measureText com fallback length*7.5 — Pitfall 2)
      const larguraUtil = LARGURA_MAX - PAD_H * 2;
      const palavras = String(balao.texto || "").split(" ");
      const linhas = [];
      let linhaAtual = "";

      for (const palavra of palavras) {
        const teste = linhaAtual ? linhaAtual + " " + palavra : palavra;
        const medida = ctx.measureText(teste).width || teste.length * 7.5;
        if (medida > larguraUtil && linhaAtual) {
          linhas.push(linhaAtual);
          linhaAtual = palavra;
          if (linhas.length >= MAX_LINHAS) break;
        } else {
          linhaAtual = teste;
        }
      }
      if (linhaAtual && linhas.length < MAX_LINHAS) {
        linhas.push(linhaAtual);
      }
      // Truncar última linha com "…" se excedeu MAX_LINHAS
      if (linhas.length === MAX_LINHAS) {
        const ultima = linhas[MAX_LINHAS - 1];
        // Truncar com "…" se ainda sobrou texto
        const palavrasRestantes = palavras.slice(
          palavras.indexOf(ultima.split(" ").pop()) + 1
        );
        if (palavrasRestantes.length > 0) {
          let truncada = ultima;
          while (truncada.length > 0) {
            const candidata = truncada + "…";
            const w = ctx.measureText(candidata).width || candidata.length * 7.5;
            if (w <= larguraUtil) { linhas[MAX_LINHAS - 1] = candidata; break; }
            truncada = truncada.slice(0, -1).trimEnd();
          }
        }
      }

      // Dimensões do balão
      const alturaLinha = 18;
      const alturaTexto = linhas.length * alturaLinha;
      const alturaSubtexto = 16;  // linha de subtexto abaixo
      const balaW = LARGURA_MAX;
      const balaH = PAD_V + alturaTexto + PAD_V + alturaSubtexto + PAD_V;

      // Posição: acima da van/NPC, clampada às bordas do canvas
      const alvoX = banda.x - cameraX + C.TAM_BANDA / 2;
      const alvoY = C.CHAO_Y - C.TAM_BANDA - CAUDA_H;
      let balaX = Math.max(RAIO, Math.min(alvoX - balaW / 2, C.LARGURA - balaW - RAIO));
      const balaY = alvoY - balaH;

      // Centro horizontal do alvo (onde a cauda aponta)
      const caudaX = Math.max(balaX + RAIO + 4, Math.min(alvoX, balaX + balaW - RAIO - 4));

      // Fundo do balão: rgba(13,10,20,0.92) com borda arredondada
      ctx.save();
      _roundRectLocal(ctx, balaX, balaY, balaW, balaH, RAIO);
      ctx.fillStyle = "rgba(13,10,20,0.92)";
      ctx.fill();
      ctx.strokeStyle = "#ece6f5";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Cauda triangular apontando para o NPC/van (abaixo do balão)
      ctx.beginPath();
      ctx.moveTo(caudaX - CAUDA_H, balaY + balaH);
      ctx.lineTo(caudaX + CAUDA_H, balaY + balaH);
      ctx.lineTo(caudaX, balaY + balaH + CAUDA_H);
      ctx.closePath();
      ctx.fillStyle = "rgba(13,10,20,0.92)";
      ctx.fill();
      ctx.strokeStyle = "#ece6f5";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Texto principal: linhas quebradas
      ctx.fillStyle = "#ece6f5";
      ctx.textAlign = "left";
      for (let i = 0; i < linhas.length; i++) {
        ctx.fillText(linhas[i], balaX + PAD_H, balaY + PAD_V + (i + 1) * alturaLinha - 4);
      }

      // Subtexto / instrução de fechamento
      ctx.fillStyle = "#b0a8c8";
      ctx.font = "11px \"Segoe UI\", system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        balao.subtexto || "[W/Esc] fechar",
        balaX + balaW / 2,
        balaY + balaH - PAD_V + 2
      );

      ctx.restore();
    }

    function frame() {
      if (!rodando) return;
      const t = agora();
      const dt = ultimoT === null ? 0 : t - ultimoT;
      ultimoT = t;
      passo(dt);
      desenhar();
      desenharBalao();
      if (rodando) agendarFrame(frame);
    }

    function iniciar() {
      if (rodando) return;
      rodando = true;
      ultimoT = null;
      ajustarCamera();
      agendarFrame(frame);
    }
    function parar() { rodando = false; direcao = 0; }

    return {
      iniciar, parar, passo, pressionar, soltar, interagir,
      marcarVenueConcluida, marcarBauAberto,
      abrirBalao, fecharBalao,   // MAP-02 (Phase 1): expostos para main.js e harness
      get estado() { return estado(); },
      get rodando() { return rodando; },
    };
  }

  // ── Entrada de produção: liga canvas + teclado ──────────────────────────────
  function montar({ canvas, venues, itens, loja, vanEstagio, npcs, baus, corTipo, inicioX,
                    aoEntrar, aoColetar, aoLoja, aoNpc, aoBau, aoAtualizar, aoSfx } = {}) {
    const ctx = canvas ? canvas.getContext("2d") : null;
    if (canvas) { canvas.width = CONFIG.LARGURA; canvas.height = CONFIG.ALTURA; }

    const mundo = criarMundo({
      agora: () => performance.now(),
      agendarFrame: (cb) => requestAnimationFrame(cb),
      ctx, venues, itens, loja, vanEstagio, npcs, baus, corTipo, inicioX,
      aoEntrar, aoColetar, aoLoja, aoNpc, aoBau, aoAtualizar, aoSfx,
    });

    function onKeyDown(e) {
      const t = e.key.toLowerCase();
      // D-16: Escape fecha o balão de fala sem propagar.
      if (t === "escape") {
        mundo.fecharBalao();
        return;
      }
      if (["a", "d", "w", "arrowleft", "arrowright", "arrowup", " "].includes(t)) {
        e.preventDefault();
        mundo.pressionar(e.key);
      }
    }
    function onKeyUp(e) { mundo.soltar(e.key); }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    mundo.iniciar();
    return {
      mundo,
      desligar() {
        mundo.parar();
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
      },
    };
  }

  window.Overworld = { criarMundo, montar, CONFIG, COR_POR_TIPO };
})();
