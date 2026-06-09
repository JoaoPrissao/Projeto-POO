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

  // ── Núcleo do mundo (shell injetável) ───────────────────────────────────────
  // opts: { agora, agendarFrame, ctx, venues, itens, inicioX,
  //         aoEntrar, aoColetar, aoAtualizar }
  function criarMundo(opts) {
    const agora = opts.agora;
    const agendarFrame = opts.agendarFrame;
    const ctx = opts.ctx || null;
    const aoEntrar = opts.aoEntrar || function () {};
    const aoColetar = opts.aoColetar || function () {};
    const aoAtualizar = opts.aoAtualizar || function () {};

    // Estado mutável, clonado das definições (não mexe nos dicts do chamador).
    const venues = (opts.venues || []).map((v) => ({ ...v, concluida: !!v.concluida }));
    const itens = (opts.itens || []).map((i) => ({ ...i, coletado: !!i.coletado }));

    const pontos = [...venues.map((v) => v.x), ...itens.map((i) => i.x), 0];
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

    // Avança a simulação por `dt` ms — núcleo determinístico (sem relógio nem rAF).
    function passo(dt) {
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

    // Entrar (W): se há venue perto, dispara o callback (o app troca pra batalha).
    function interagir() {
      const v = venuePerto();
      if (v) aoEntrar(v);
      return v;
    }

    function marcarVenueConcluida(id) {
      const v = venues.find((x) => x.id === id);
      if (v) v.concluida = true;
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
      };
    }

    // ── Render (canvas) — placeholders coloridos; arte real é F3.4 ─────────────
    function desenhar() {
      if (!ctx) return;
      const C = CONFIG;
      ctx.clearRect(0, 0, C.LARGURA, C.ALTURA);
      ctx.fillStyle = "#14111c"; ctx.fillRect(0, 0, C.LARGURA, C.ALTURA);
      ctx.fillStyle = "#211b2e"; ctx.fillRect(0, C.CHAO_Y, C.LARGURA, C.ALTURA - C.CHAO_Y);

      // Venues (portas).
      for (const v of venues) {
        const px = v.x - cameraX;
        if (px < -80 || px > C.LARGURA + 80) continue;
        ctx.fillStyle = v.concluida ? "#3fae6b" : "#e0457b";
        ctx.fillRect(px - 24, C.CHAO_Y - 80, 48, 80);
        ctx.fillStyle = "#ece6f5";
        ctx.font = "12px monospace";
        ctx.textAlign = "center";
        ctx.fillText(v.nome || "Venue", px, C.CHAO_Y - 88);
        if (!v.concluida && venuePerto() && venuePerto().id === v.id) {
          ctx.fillText("[W] entrar", px, C.CHAO_Y - 100);
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
      // Banda (placeholder).
      const bx = banda.x - cameraX;
      ctx.fillStyle = COR_POR_TIPO[opts.corTipo] || "#e0457b";
      ctx.fillRect(bx, C.CHAO_Y - C.TAM_BANDA, C.TAM_BANDA, C.TAM_BANDA);
    }

    function frame() {
      if (!rodando) return;
      const t = agora();
      const dt = ultimoT === null ? 0 : t - ultimoT;
      ultimoT = t;
      passo(dt);
      desenhar();
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
      marcarVenueConcluida,
      get estado() { return estado(); },
      get rodando() { return rodando; },
    };
  }

  // ── Entrada de produção: liga canvas + teclado ──────────────────────────────
  function montar({ canvas, venues, itens, corTipo, inicioX, aoEntrar, aoColetar, aoAtualizar } = {}) {
    const ctx = canvas ? canvas.getContext("2d") : null;
    if (canvas) { canvas.width = CONFIG.LARGURA; canvas.height = CONFIG.ALTURA; }

    const mundo = criarMundo({
      agora: () => performance.now(),
      agendarFrame: (cb) => requestAnimationFrame(cb),
      ctx, venues, itens, corTipo, inicioX,
      aoEntrar, aoColetar, aoAtualizar,
    });

    function onKeyDown(e) {
      const t = e.key.toLowerCase();
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
