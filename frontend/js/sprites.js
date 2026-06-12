// Sprites pixel art procedurais do RPG Manager — arte 100% gerada via fillRect
// no grid 32×32. ZERO asset externo: nenhum Image, nenhum fetch, nenhum import.
// Mantém os harnesses determinísticos (sem loading assíncrono).
//
// Convenção de dados: cada sprite é um array de [linha, coluna, cor].
// Coordenada (0,0) = canto superior-esquerdo do sprite.
//
// D-01/D-02: procedural, zero binário.
// D-04/D-07: paleta derivada das COR_POR_TIPO do main.js.
// D-05: ordem de produção — músicos → van → inimigos → cenário/NPCs/baús.
// D-08: Marivaldo (baixista) renderizado com escala * 0.8 internamente.
//
// Pendurado em window.Sprites (sem ES modules — padrão idêntico ao audio.js).

(function () {
  "use strict";

  // ── Paleta derivada (D-04) ────────────────────────────────────────────────
  // A partir das cores-assinatura, deriva sombra (~30% mais escura) e realce
  // (~30% mais claro) por escurecer/clarear cada canal RGB individualmente.

  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }

  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  }

  function escurecer(hex, fator) {
    const [r, g, b] = hexToRgb(hex);
    return rgbToHex(r * fator, g * fator, b * fator);
  }

  function clarear(hex, fator) {
    const [r, g, b] = hexToRgb(hex);
    return rgbToHex(r + (255 - r) * fator, g + (255 - g) * fator, b + (255 - b) * fator);
  }

  // Cores-assinatura por tipo (espelha COR_POR_TIPO em main.js).
  const BASE = {
    guitarrista: "#e23b4e",  // Geraldo Muleta
    vocalista:   "#b04ad8",  // Vando Bicuda
    baixista:    "#4a78d8",  // Marivaldo
    baterista:   "#e0b341",  // Ramiro Paulada
  };

  const PALETA = {};
  for (const [tipo, cor] of Object.entries(BASE)) {
    PALETA[tipo] = {
      base:     cor,
      sombra:   escurecer(cor, 0.7),
      realce:   clarear(cor, 0.3),
    };
  }

  // Cores auxiliares compartilhadas
  const C = {
    PELE_CLARA:  "#f0c8a0",
    PELE_NEGRA:  "#8b5a3c",
    PRETO:       "#0d0a14",
    BRANCO:      "#ece6f5",
    CINZA:       "#6b7280",
    CINZA_ESC:   "#3a3540",
    CABELO_PRETO:"#1a1520",
    CABELO_LOIRO:"#e8c870",
    CABELO_CAST: "#7a4a2a",
    OCULOS:      "#1e3a5f",
    OCULOS_ESC:  "#111118",
    COURO_PRETO: "#1e1520",
    METAL:       "#a0b0c0",
    MADEIRA:     "#8b6040",
    VAN_FERRUGE: "#8b5520",
    VAN_AZUL:    "#2a4a8a",
    VAN_DOURADO: "#e0b341",
    BOSS_BASE:   "#8a1a2a",
    BOSS_SOMBRA: "#5a0a18",
    ROUPA_PRETA: "#1a1520",
    CAMISA_PB:   "#ece6f5",
    CAMISA_ESC:  "#1a2040",
    VERDE_NPC:   "#2a8a5a",
    VERDE_NPC2:  "#1a6040",
    CAIXA_OURO:  "#c8a400",
    CAIXA_OURO2: "#8a6a00",
    VENUE_ROSA:  "#c0356a",
    VENUE_VERDE: "#2a8a50",
    LOJA_AZUL:   "#1a5a8a",
    LOJA_AZUL2:  "#0a3a5a",
    JANELA:      "#6090c0",
    PORTA:       "#4a2a14",
    TETO:        "#2a1a3a",
  };

  // ── Helper genérico de render ──────────────────────────────────────────────
  // Cada célula [r, c, cor] ocupa escala×escala px a partir de (x, y).
  function desenharSprite(ctx, matriz, x, y, escala) {
    for (const [r, c, cor] of matriz) {
      ctx.fillStyle = cor;
      ctx.fillRect(x + c * escala, y + r * escala, escala, escala);
    }
  }

  // ── Sprites dos músicos (D-05 prioridade 1) ───────────────────────────────
  // Grade 8×5 (8 linhas × 5 colunas) por músico.
  // Linha 0-1: cabeça; 2: pescoço/ombros; 3-6: corpo; 7: pernas.
  // Colunas 0-4 (5 colunas, desenhadas a partir do centro).

  // Geraldo Muleta — Guitarrista (#e23b4e): cabelo preto espetado, jaqueta couro preta/vermelha
  const SPRITE_GUITARRISTA = [
    // Cabelo espetado
    [0, 1, C.CABELO_PRETO], [0, 2, C.CABELO_PRETO], [0, 3, C.CABELO_PRETO],
    [1, 0, C.CABELO_PRETO], [1, 1, C.PELE_CLARA],   [1, 2, C.PELE_CLARA],   [1, 3, C.PELE_CLARA], [1, 4, C.CABELO_PRETO],
    // Pescoço
    [2, 1, C.CABELO_PRETO], [2, 2, C.PELE_CLARA],   [2, 3, C.PELE_CLARA],   [2, 4, C.CABELO_PRETO],
    // Corpo — jaqueta couro preta com detalhe vermelho (base #e23b4e)
    [3, 0, C.COURO_PRETO],  [3, 1, C.COURO_PRETO],  [3, 2, BASE.guitarrista],[3, 3, C.COURO_PRETO], [3, 4, C.COURO_PRETO],
    [4, 0, C.COURO_PRETO],  [4, 1, PALETA.guitarrista.sombra], [4, 2, BASE.guitarrista], [4, 3, PALETA.guitarrista.sombra], [4, 4, C.COURO_PRETO],
    [5, 0, C.COURO_PRETO],  [5, 1, C.COURO_PRETO],  [5, 2, C.COURO_PRETO],  [5, 3, C.COURO_PRETO], [5, 4, C.COURO_PRETO],
    // Guitarra (haste à direita)
    [4, 5, C.MADEIRA], [5, 5, C.MADEIRA], [4, 6, C.METAL], [5, 6, C.METAL],
    // Pernas
    [6, 1, C.PRETO],         [6, 2, C.PRETO],         [6, 3, C.PRETO],
    [7, 1, C.PRETO],         [7, 3, C.PRETO],
  ];

  // Ramiro Paulada — Baterista (#e0b341): cabelo loiro curto, pele negra, camiseta preta
  const SPRITE_BATERISTA = [
    // Cabelo loiro curto
    [0, 1, C.CABELO_LOIRO], [0, 2, C.CABELO_LOIRO], [0, 3, C.CABELO_LOIRO],
    [1, 0, C.CABELO_LOIRO], [1, 1, C.PELE_NEGRA],   [1, 2, C.PELE_NEGRA],   [1, 3, C.PELE_NEGRA], [1, 4, C.CABELO_LOIRO],
    // Pescoço
    [2, 1, C.PELE_NEGRA],   [2, 2, C.PELE_NEGRA],   [2, 3, C.PELE_NEGRA],   [2, 4, C.PELE_NEGRA],
    // Corpo — camiseta preta com detalhe amarelo (base #e0b341)
    [3, 0, C.ROUPA_PRETA],  [3, 1, BASE.baterista],  [3, 2, BASE.baterista],  [3, 3, BASE.baterista], [3, 4, C.ROUPA_PRETA],
    [4, 0, C.ROUPA_PRETA],  [4, 1, C.ROUPA_PRETA],  [4, 2, PALETA.baterista.realce], [4, 3, C.ROUPA_PRETA], [4, 4, C.ROUPA_PRETA],
    [5, 0, C.ROUPA_PRETA],  [5, 1, C.ROUPA_PRETA],  [5, 2, C.ROUPA_PRETA],  [5, 3, C.ROUPA_PRETA], [5, 4, C.ROUPA_PRETA],
    // Baquetas (dois palitos)
    [3, 5, C.MADEIRA], [3, 6, C.MADEIRA], [4, 5, C.MADEIRA], [5, 5, C.MADEIRA],
    // Pernas
    [6, 1, C.ROUPA_PRETA],  [6, 2, C.ROUPA_PRETA],  [6, 3, C.ROUPA_PRETA],
    [7, 1, C.ROUPA_PRETA],  [7, 3, C.ROUPA_PRETA],
  ];

  // Vando Bicuda — Vocalista (#b04ad8): cabelo marrom longo, óculos escuros, camiseta P&B
  const SPRITE_VOCALISTA = [
    // Cabelo marrom longo (sobe na linha 0, desce até linha 3 laterais)
    [0, 1, C.CABELO_CAST], [0, 2, C.CABELO_CAST], [0, 3, C.CABELO_CAST],
    [1, 0, C.CABELO_CAST], [1, 1, C.PELE_CLARA],  [1, 2, C.PELE_CLARA],  [1, 3, C.PELE_CLARA],  [1, 4, C.CABELO_CAST],
    // Óculos escuros
    [1, 1, C.OCULOS_ESC],  [1, 2, C.OCULOS_ESC],  [1, 3, C.OCULOS_ESC],
    // Pescoço com cabelo caindo
    [2, 0, C.CABELO_CAST], [2, 1, C.PELE_CLARA],  [2, 2, C.PELE_CLARA],  [2, 3, C.PELE_CLARA],  [2, 4, C.CABELO_CAST],
    // Corpo — camiseta P&B com faixa roxa (base #b04ad8)
    [3, 0, C.CABELO_CAST], [3, 1, C.CAMISA_PB],   [3, 2, BASE.vocalista], [3, 3, C.CAMISA_PB],   [3, 4, C.CABELO_CAST],
    [4, 0, C.CABELO_CAST], [4, 1, C.CAMISA_PB],   [4, 2, PALETA.vocalista.realce], [4, 3, C.CAMISA_PB], [4, 4, C.CABELO_CAST],
    [5, 0, C.CABELO_CAST], [5, 1, C.CAMISA_PB],   [5, 2, C.CAMISA_PB],   [5, 3, C.CAMISA_PB],   [5, 4, C.CABELO_CAST],
    // Microfone
    [4, 5, C.CINZA], [3, 5, C.CINZA_ESC],
    // Pernas
    [6, 1, C.PRETO],       [6, 2, C.PRETO],       [6, 3, C.PRETO],
    [7, 1, C.PRETO],       [7, 3, C.PRETO],
  ];

  // Marivaldo — Baixista (#4a78d8): cabelo preto, óculos nerd, camiseta azul-escura
  // D-08: renderizado com escala * 0.8 (menor que os demais)
  const SPRITE_BAIXISTA = [
    // Cabelo preto normal (mais curto)
    [0, 1, C.CABELO_PRETO], [0, 2, C.CABELO_PRETO], [0, 3, C.CABELO_PRETO],
    [1, 0, C.CABELO_PRETO], [1, 1, C.PELE_CLARA],   [1, 2, C.PELE_CLARA],   [1, 3, C.PELE_CLARA], [1, 4, C.CABELO_PRETO],
    // Óculos nerd (armação visível — mais grossos)
    [1, 1, C.OCULOS],       [1, 3, C.OCULOS],
    // Pescoço
    [2, 1, C.PELE_CLARA],   [2, 2, C.PELE_CLARA],   [2, 3, C.PELE_CLARA],
    // Corpo — camiseta azul-escura (base #4a78d8)
    [3, 0, C.CAMISA_ESC],   [3, 1, C.CAMISA_ESC],   [3, 2, BASE.baixista],   [3, 3, C.CAMISA_ESC],  [3, 4, C.CAMISA_ESC],
    [4, 0, C.CAMISA_ESC],   [4, 1, BASE.baixista],   [4, 2, PALETA.baixista.realce], [4, 3, BASE.baixista], [4, 4, C.CAMISA_ESC],
    [5, 0, C.CAMISA_ESC],   [5, 1, C.CAMISA_ESC],   [5, 2, C.CAMISA_ESC],   [5, 3, C.CAMISA_ESC],  [5, 4, C.CAMISA_ESC],
    // Baixo (instrumento — contrabaixo mais comprido)
    [3, 5, C.MADEIRA], [4, 5, C.MADEIRA], [5, 5, C.MADEIRA], [3, 6, C.METAL], [4, 6, C.METAL],
    // Pernas
    [6, 1, C.PRETO],         [6, 2, C.PRETO],         [6, 3, C.PRETO],
    [7, 1, C.PRETO],         [7, 3, C.PRETO],
  ];

  const SPRITES_MEMBRO = {
    guitarrista: SPRITE_GUITARRISTA,
    baterista:   SPRITE_BATERISTA,
    vocalista:   SPRITE_VOCALISTA,
    baixista:    SPRITE_BAIXISTA,
  };

  // desenharMembro(ctx, tipo, escala)
  // Assume que ctx.translate() já foi feito pelo chamador (posicionar na origin).
  // D-08: quando tipo === "baixista" aplica escala * 0.8 internamente (Marivaldo menor).
  function desenharMembro(ctx, tipo, escala) {
    const sprite = SPRITES_MEMBRO[tipo] || SPRITE_GUITARRISTA;
    const esc = (tipo === "baixista") ? escala * 0.8 : escala;
    desenharSprite(ctx, sprite, 0, 0, esc);
  }

  // ── Van por estágio (D-05 prioridade 2) ──────────────────────────────────
  // Estágio 1: lata velha enferrujada.
  // Estágio 2: van decente azul.
  // Estágio 3: van tunada azul+dourado.
  // Grid 8 linhas × 10 colunas.

  const SPRITE_VAN_1 = [
    // Teto enferrujado
    [0, 1, C.VAN_FERRUGE], [0, 2, C.VAN_FERRUGE], [0, 3, C.VAN_FERRUGE], [0, 4, C.VAN_FERRUGE],
    [0, 5, C.VAN_FERRUGE], [0, 6, C.VAN_FERRUGE], [0, 7, C.VAN_FERRUGE], [0, 8, C.VAN_FERRUGE],
    // Carroceria enferrujada
    [1, 0, C.VAN_FERRUGE], [1, 1, C.CINZA],      [1, 2, C.JANELA],     [1, 3, C.JANELA],
    [1, 4, C.VAN_FERRUGE], [1, 5, C.VAN_FERRUGE], [1, 6, C.JANELA],     [1, 7, C.JANELA],
    [1, 8, C.VAN_FERRUGE], [1, 9, C.VAN_FERRUGE],
    [2, 0, C.VAN_FERRUGE], [2, 1, C.VAN_FERRUGE], [2, 2, C.CINZA],      [2, 3, C.VAN_FERRUGE],
    [2, 4, C.VAN_FERRUGE], [2, 5, C.VAN_FERRUGE], [2, 6, C.VAN_FERRUGE],[2, 7, C.CINZA],
    [2, 8, C.VAN_FERRUGE], [2, 9, C.VAN_FERRUGE],
    [3, 0, C.VAN_FERRUGE], [3, 1, C.VAN_FERRUGE], [3, 2, C.VAN_FERRUGE],[3, 3, C.VAN_FERRUGE],
    [3, 4, C.VAN_FERRUGE], [3, 5, C.VAN_FERRUGE], [3, 6, C.VAN_FERRUGE],[3, 7, C.VAN_FERRUGE],
    [3, 8, C.VAN_FERRUGE], [3, 9, C.VAN_FERRUGE],
    // Rodas
    [4, 1, C.CINZA_ESC],   [4, 2, C.CINZA_ESC],   [4, 7, C.CINZA_ESC],  [4, 8, C.CINZA_ESC],
    [5, 1, C.PRETO],        [5, 2, C.PRETO],        [5, 7, C.PRETO],       [5, 8, C.PRETO],
  ];

  const SPRITE_VAN_2 = [
    // Teto azul decente
    [0, 1, C.VAN_AZUL], [0, 2, C.VAN_AZUL], [0, 3, C.VAN_AZUL], [0, 4, C.VAN_AZUL],
    [0, 5, C.VAN_AZUL], [0, 6, C.VAN_AZUL], [0, 7, C.VAN_AZUL], [0, 8, C.VAN_AZUL],
    // Carroceria azul
    [1, 0, C.VAN_AZUL], [1, 1, C.VAN_AZUL], [1, 2, C.JANELA],   [1, 3, C.JANELA],
    [1, 4, C.VAN_AZUL], [1, 5, C.VAN_AZUL], [1, 6, C.JANELA],   [1, 7, C.JANELA],
    [1, 8, C.VAN_AZUL], [1, 9, C.VAN_AZUL],
    [2, 0, C.VAN_AZUL], [2, 1, C.VAN_AZUL], [2, 2, C.VAN_AZUL], [2, 3, C.VAN_AZUL],
    [2, 4, C.VAN_AZUL], [2, 5, C.VAN_AZUL], [2, 6, C.VAN_AZUL], [2, 7, C.VAN_AZUL],
    [2, 8, C.VAN_AZUL], [2, 9, C.VAN_AZUL],
    [3, 0, C.VAN_AZUL], [3, 1, C.VAN_AZUL], [3, 2, C.VAN_AZUL], [3, 3, C.VAN_AZUL],
    [3, 4, C.VAN_AZUL], [3, 5, C.VAN_AZUL], [3, 6, C.VAN_AZUL], [3, 7, C.VAN_AZUL],
    [3, 8, C.VAN_AZUL], [3, 9, C.VAN_AZUL],
    // Rodas melhores
    [4, 1, C.CINZA],    [4, 2, C.CINZA],    [4, 7, C.CINZA],    [4, 8, C.CINZA],
    [5, 1, C.PRETO],    [5, 2, C.PRETO],    [5, 7, C.PRETO],    [5, 8, C.PRETO],
  ];

  const SPRITE_VAN_3 = [
    // Teto azul tunado com borda dourada
    [0, 0, C.VAN_DOURADO], [0, 1, C.VAN_AZUL], [0, 2, C.VAN_AZUL], [0, 3, C.VAN_AZUL],
    [0, 4, C.VAN_AZUL],    [0, 5, C.VAN_AZUL], [0, 6, C.VAN_AZUL], [0, 7, C.VAN_AZUL],
    [0, 8, C.VAN_AZUL],    [0, 9, C.VAN_DOURADO],
    // Faixa dourada no corpo
    [1, 0, C.VAN_DOURADO], [1, 1, C.VAN_AZUL], [1, 2, C.JANELA],   [1, 3, C.JANELA],
    [1, 4, C.VAN_DOURADO], [1, 5, C.VAN_DOURADO], [1, 6, C.JANELA], [1, 7, C.JANELA],
    [1, 8, C.VAN_AZUL],    [1, 9, C.VAN_DOURADO],
    [2, 0, C.VAN_DOURADO], [2, 1, C.VAN_AZUL], [2, 2, C.VAN_AZUL], [2, 3, C.VAN_AZUL],
    [2, 4, C.VAN_AZUL],    [2, 5, C.VAN_AZUL], [2, 6, C.VAN_AZUL], [2, 7, C.VAN_AZUL],
    [2, 8, C.VAN_AZUL],    [2, 9, C.VAN_DOURADO],
    [3, 0, C.VAN_DOURADO], [3, 1, C.VAN_DOURADO],[3, 2, C.VAN_DOURADO],[3, 3, C.VAN_DOURADO],
    [3, 4, C.VAN_DOURADO], [3, 5, C.VAN_DOURADO],[3, 6, C.VAN_DOURADO],[3, 7, C.VAN_DOURADO],
    [3, 8, C.VAN_DOURADO], [3, 9, C.VAN_DOURADO],
    // Rodas tunadas (roda maior, detalhe dourado)
    [4, 0, C.VAN_DOURADO], [4, 1, C.CINZA],    [4, 2, C.CINZA],    [4, 7, C.CINZA],
    [4, 8, C.CINZA],       [4, 9, C.VAN_DOURADO],
    [5, 1, C.PRETO],        [5, 2, C.PRETO],    [5, 7, C.PRETO],    [5, 8, C.PRETO],
    // Faróis dianteiros (lado esquerdo — van se move para a direita)
    [2, 9, C.VAN_DOURADO],
  ];

  const SPRITES_VAN = { 1: SPRITE_VAN_1, 2: SPRITE_VAN_2, 3: SPRITE_VAN_3 };

  // desenharVan(ctx, estagio, x, y, escala)
  // x, y = canto superior-esquerdo da van no canvas.
  function desenharVan(ctx, estagio, x, y, escala) {
    const sprite = SPRITES_VAN[estagio] || SPRITES_VAN[1];
    desenharSprite(ctx, sprite, x, y, escala);
  }

  // ── Vilão/boss (D-05 prioridade 3) ────────────────────────────────────────
  // Grid 10 linhas × 8 colunas — maior que os músicos, intimidador.
  const SPRITE_BOSS = [
    // Chapéu de empresário
    [0, 1, C.PRETO], [0, 2, C.PRETO], [0, 3, C.PRETO], [0, 4, C.PRETO], [0, 5, C.PRETO],
    [1, 0, C.PRETO], [1, 1, C.PRETO], [1, 2, C.PRETO], [1, 3, C.PRETO],
    [1, 4, C.PRETO], [1, 5, C.PRETO], [1, 6, C.PRETO],
    // Rosto
    [2, 1, C.PELE_CLARA], [2, 2, C.PELE_CLARA], [2, 3, C.PELE_CLARA],
    [2, 4, C.PELE_CLARA], [2, 5, C.PELE_CLARA],
    [3, 1, C.PELE_CLARA], [3, 2, C.BOSS_SOMBRA], [3, 3, C.PELE_CLARA],
    [3, 4, C.BOSS_SOMBRA], [3, 5, C.PELE_CLARA],
    // Terno escarlate
    [4, 0, C.BOSS_BASE], [4, 1, C.BOSS_BASE], [4, 2, C.BOSS_BASE], [4, 3, C.BRANCO],
    [4, 4, C.BOSS_BASE], [4, 5, C.BOSS_BASE], [4, 6, C.BOSS_BASE],
    [5, 0, C.BOSS_BASE], [5, 1, C.BOSS_BASE], [5, 2, C.BOSS_BASE], [5, 3, C.BRANCO],
    [5, 4, C.BOSS_BASE], [5, 5, C.BOSS_BASE], [5, 6, C.BOSS_BASE],
    [6, 0, C.BOSS_SOMBRA],[6, 1, C.BOSS_BASE], [6, 2, C.BOSS_BASE], [6, 3, C.BOSS_BASE],
    [6, 4, C.BOSS_BASE],  [6, 5, C.BOSS_BASE], [6, 6, C.BOSS_SOMBRA],
    // Braço esquerdo (encarando a esquerda — para a banda)
    [5, 7, C.BOSS_BASE], [6, 7, C.BOSS_BASE], [6, 8, C.PELE_CLARA],
    // Pernas
    [7, 1, C.PRETO], [7, 2, C.PRETO], [7, 4, C.PRETO], [7, 5, C.PRETO],
    [8, 1, C.PRETO], [8, 2, C.PRETO], [8, 4, C.PRETO], [8, 5, C.PRETO],
    // Sapatos
    [9, 0, C.PRETO], [9, 1, C.PRETO], [9, 2, C.PRETO],
    [9, 4, C.PRETO], [9, 5, C.PRETO], [9, 6, C.PRETO],
  ];

  function desenharBoss(ctx, x, y, escala) {
    desenharSprite(ctx, SPRITE_BOSS, x, y, escala);
  }

  // ── NPC (D-05 prioridade 4) ────────────────────────────────────────────────
  // Grid 8 linhas × 5 colunas — transeunte simples.
  // A cor é passada pelo chamador (verde=disponível, cinza=dado).
  const SPRITE_NPC = [
    // Cabeça
    [0, 1, C.PELE_CLARA], [0, 2, C.PELE_CLARA], [0, 3, C.PELE_CLARA],
    [1, 1, C.PELE_CLARA], [1, 2, C.PELE_CLARA], [1, 3, C.PELE_CLARA],
    // Corpo (cor injetada)
    [2, 0, null], [2, 1, null], [2, 2, null], [2, 3, null], [2, 4, null],
    [3, 0, null], [3, 1, null], [3, 2, null], [3, 3, null], [3, 4, null],
    [4, 0, null], [4, 1, null], [4, 2, null], [4, 3, null], [4, 4, null],
    // Pernas
    [5, 1, C.PRETO], [5, 2, C.PRETO], [5, 3, C.PRETO],
    [6, 1, C.PRETO], [6, 3, C.PRETO],
  ];

  // desenharNpc(ctx, x, y, escala, dado)
  // dado=true → NPC já entregou o item (esmaecido).
  function desenharNpc(ctx, x, y, escala, dado) {
    const corCorpo = dado ? C.CINZA : C.VERDE_NPC;
    const corDetalhe = dado ? C.CINZA_ESC : C.VERDE_NPC2;
    for (const [r, c, cor] of SPRITE_NPC) {
      ctx.fillStyle = cor !== null ? cor : (r <= 4 && c === 2 ? corDetalhe : corCorpo);
      ctx.fillRect(x + c * escala, y + r * escala, escala, escala);
    }
  }

  // ── Baú (D-05 prioridade 4) ────────────────────────────────────────────────
  // Grid 5 linhas × 7 colunas — caixa do tesouro com dobradiça e fechadura.
  const SPRITE_BAU = [
    // Tampa arredondada
    [0, 1, C.CAIXA_OURO], [0, 2, C.CAIXA_OURO],  [0, 3, C.CAIXA_OURO],
    [0, 4, C.CAIXA_OURO], [0, 5, C.CAIXA_OURO],
    [1, 0, C.CAIXA_OURO], [1, 1, C.CAIXA_OURO2], [1, 2, C.CAIXA_OURO2],
    [1, 3, C.CAIXA_OURO],  [1, 4, C.CAIXA_OURO2], [1, 5, C.CAIXA_OURO2], [1, 6, C.CAIXA_OURO],
    // Faixa central (dobradiça)
    [2, 0, C.CAIXA_OURO], [2, 1, C.VAN_DOURADO], [2, 2, C.VAN_DOURADO],
    [2, 3, C.VAN_DOURADO], [2, 4, C.VAN_DOURADO], [2, 5, C.VAN_DOURADO], [2, 6, C.CAIXA_OURO],
    // Base da caixa
    [3, 0, C.CAIXA_OURO], [3, 1, C.CAIXA_OURO2], [3, 2, C.CAIXA_OURO2],
    [3, 3, C.CAIXA_OURO2], [3, 4, C.CAIXA_OURO2], [3, 5, C.CAIXA_OURO2], [3, 6, C.CAIXA_OURO],
    [4, 0, C.CAIXA_OURO], [4, 1, C.CAIXA_OURO],  [4, 2, C.CAIXA_OURO],
    [4, 3, C.CAIXA_OURO],  [4, 4, C.CAIXA_OURO],  [4, 5, C.CAIXA_OURO],  [4, 6, C.CAIXA_OURO],
  ];

  function desenharBau(ctx, x, y, escala) {
    desenharSprite(ctx, SPRITE_BAU, x, y, escala);
  }

  // ── Venue (D-05 prioridade 4) ─────────────────────────────────────────────
  // Grid 10 linhas × 8 colunas — prédio com porta e janela.
  // cor injetada: verde se concluída, rosa se não.
  const SPRITE_VENUE_LINHAS = [
    // Teto
    [0, 0, "teto"], [0, 1, "teto"], [0, 2, "teto"], [0, 3, "teto"],
    [0, 4, "teto"], [0, 5, "teto"], [0, 6, "teto"], [0, 7, "teto"],
    [1, 0, "teto"], [1, 1, "teto"], [1, 2, "teto"], [1, 3, "teto"],
    [1, 4, "teto"], [1, 5, "teto"], [1, 6, "teto"], [1, 7, "teto"],
    // Fachada
    [2, 0, "base"], [2, 1, "base"], [2, 2, "janela"], [2, 3, "base"],
    [2, 4, "base"],  [2, 5, "janela"], [2, 6, "base"], [2, 7, "base"],
    [3, 0, "base"], [3, 1, "base"], [3, 2, "janela"], [3, 3, "base"],
    [3, 4, "base"],  [3, 5, "janela"], [3, 6, "base"], [3, 7, "base"],
    [4, 0, "base"], [4, 1, "base"], [4, 2, "base"],   [4, 3, "base"],
    [4, 4, "base"],  [4, 5, "base"],   [4, 6, "base"], [4, 7, "base"],
    [5, 0, "base"], [5, 1, "base"], [5, 2, "base"],   [5, 3, "base"],
    [5, 4, "base"],  [5, 5, "base"],   [5, 6, "base"], [5, 7, "base"],
    // Entrada/porta
    [6, 0, "base"], [6, 1, "base"], [6, 2, "base"],   [6, 3, "porta"],
    [6, 4, "porta"], [6, 5, "base"],  [6, 6, "base"], [6, 7, "base"],
    [7, 0, "base"], [7, 1, "base"], [7, 2, "base"],   [7, 3, "porta"],
    [7, 4, "porta"], [7, 5, "base"],  [7, 6, "base"], [7, 7, "base"],
    [8, 0, "base"], [8, 1, "base"], [8, 2, "base"],   [8, 3, "porta"],
    [8, 4, "porta"], [8, 5, "base"],  [8, 6, "base"], [8, 7, "base"],
    [9, 0, "base"], [9, 1, "base"], [9, 2, "base"],   [9, 3, "porta"],
    [9, 4, "porta"], [9, 5, "base"],  [9, 6, "base"], [9, 7, "base"],
  ];

  function desenharVenue(ctx, x, y, escala, concluida) {
    const corBase = concluida ? C.VENUE_VERDE : C.VENUE_ROSA;
    const corTeto = escurecer(corBase, 0.7);
    for (const [r, c, tag] of SPRITE_VENUE_LINHAS) {
      if (tag === "teto") ctx.fillStyle = corTeto;
      else if (tag === "janela") ctx.fillStyle = C.JANELA;
      else if (tag === "porta") ctx.fillStyle = C.PORTA;
      else ctx.fillStyle = corBase;
      ctx.fillRect(x + c * escala, y + r * escala, escala, escala);
    }
  }

  // ── Loja (D-05 prioridade 4) ──────────────────────────────────────────────
  // Grid 10 linhas × 8 colunas — prédio azul com letreiro/tabuleta.
  const SPRITE_LOJA_LINHAS = [
    // Teto azul
    [0, 0, "teto"], [0, 1, "teto"], [0, 2, "teto"], [0, 3, "teto"],
    [0, 4, "teto"], [0, 5, "teto"], [0, 6, "teto"], [0, 7, "teto"],
    [1, 0, "teto"], [1, 1, "teto"], [1, 2, "teto"], [1, 3, "teto"],
    [1, 4, "teto"], [1, 5, "teto"], [1, 6, "teto"], [1, 7, "teto"],
    // Letreiro dourado
    [2, 0, "letr"], [2, 1, "letr"], [2, 2, "letr"], [2, 3, "letr"],
    [2, 4, "letr"], [2, 5, "letr"], [2, 6, "letr"], [2, 7, "letr"],
    // Fachada azul
    [3, 0, "base"], [3, 1, "base"], [3, 2, "janela"], [3, 3, "base"],
    [3, 4, "base"],  [3, 5, "janela"], [3, 6, "base"], [3, 7, "base"],
    [4, 0, "base"], [4, 1, "base"], [4, 2, "janela"], [4, 3, "base"],
    [4, 4, "base"],  [4, 5, "janela"], [4, 6, "base"], [4, 7, "base"],
    [5, 0, "base"], [5, 1, "base"], [5, 2, "base"],   [5, 3, "base"],
    [5, 4, "base"],  [5, 5, "base"],   [5, 6, "base"], [5, 7, "base"],
    // Porta azul-escura
    [6, 0, "base"], [6, 1, "base"], [6, 2, "base"],   [6, 3, "porta"],
    [6, 4, "porta"], [6, 5, "base"],  [6, 6, "base"], [6, 7, "base"],
    [7, 0, "base"], [7, 1, "base"], [7, 2, "base"],   [7, 3, "porta"],
    [7, 4, "porta"], [7, 5, "base"],  [7, 6, "base"], [7, 7, "base"],
    [8, 0, "base"], [8, 1, "base"], [8, 2, "base"],   [8, 3, "porta"],
    [8, 4, "porta"], [8, 5, "base"],  [8, 6, "base"], [8, 7, "base"],
    [9, 0, "base"], [9, 1, "base"], [9, 2, "base"],   [9, 3, "porta"],
    [9, 4, "porta"], [9, 5, "base"],  [9, 6, "base"], [9, 7, "base"],
  ];

  function desenharLoja(ctx, x, y, escala) {
    for (const [r, c, tag] of SPRITE_LOJA_LINHAS) {
      if (tag === "teto")  ctx.fillStyle = C.LOJA_AZUL2;
      else if (tag === "letr")  ctx.fillStyle = C.VAN_DOURADO;
      else if (tag === "janela") ctx.fillStyle = C.JANELA;
      else if (tag === "porta") ctx.fillStyle = C.PORTA;
      else ctx.fillStyle = C.LOJA_AZUL;
      ctx.fillRect(x + c * escala, y + r * escala, escala, escala);
    }
  }

  // ── Exportação ─────────────────────────────────────────────────────────────
  window.Sprites = {
    PALETA,
    desenharSprite,
    desenharMembro,
    desenharVan,
    desenharBoss,
    desenharNpc,
    desenharBau,
    desenharVenue,
    desenharLoja,
  };
})();
