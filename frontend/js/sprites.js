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
    vocalista:   "#b04ad8",  // Vande Bicuda
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
    // Guitarra elétrica (HU4): braço diagonal p/ cima-direita + corpo vermelho na mão
    [1, 7, C.METAL],                                                       // tarraxa
    [1, 6, C.MADEIRA], [2, 6, C.MADEIRA], [2, 5, C.MADEIRA], [3, 5, C.MADEIRA], // braço
    [4, 5, BASE.guitarrista],        [4, 6, PALETA.guitarrista.realce],   // corpo
    [5, 5, BASE.guitarrista],        [5, 6, BASE.guitarrista],
    [6, 5, PALETA.guitarrista.sombra], [6, 6, BASE.guitarrista],
    [5, 6, C.METAL],                                                      // ponte
    // Pernas
    [6, 1, C.PRETO],         [6, 2, C.PRETO],         [6, 3, C.PRETO],
    [7, 1, C.PRETO],         [7, 3, C.PRETO],
    // Sapatos estilosos vermelho-couro (cor-assinatura do guitarrista)
    [7, 0, BASE.guitarrista], [7, 1, BASE.guitarrista], [7, 2, C.COURO_PRETO],
    [7, 3, BASE.guitarrista], [7, 4, BASE.guitarrista],
  ];

  // Ramiro Paulada — Baterista (#e0b341): cabelo loiro curto, pele negra, camiseta preta
  const SPRITE_BATERISTA = [
    // Cabelo loiro curto
    [0, 1, C.CABELO_LOIRO], [0, 2, C.CABELO_LOIRO], [0, 3, C.CABELO_LOIRO],
    [1, 0, C.CABELO_LOIRO], [1, 1, C.PELE_NEGRA],   [1, 2, C.PELE_NEGRA],   [1, 3, C.PELE_NEGRA], [1, 4, C.CABELO_LOIRO],
    // Pescoço
    [2, 1, C.PELE_NEGRA],   [2, 2, C.PELE_NEGRA],   [2, 3, C.PELE_NEGRA],   [2, 4, C.PELE_NEGRA],
    // Corpo — camiseta preta com gola/detalhe amarelo (base #e0b341).
    // Ombros escuros (não dourados) pra separar a cabeça loira do corpo —
    // senão cabelo+ombros+sapatos dourados fundem num borrão (UAT Fase 3).
    [3, 0, C.ROUPA_PRETA],  [3, 1, C.ROUPA_PRETA],  [3, 2, BASE.baterista],  [3, 3, C.ROUPA_PRETA], [3, 4, C.ROUPA_PRETA],
    [4, 0, C.ROUPA_PRETA],  [4, 1, C.ROUPA_PRETA],  [4, 2, PALETA.baterista.realce], [4, 3, C.ROUPA_PRETA], [4, 4, C.ROUPA_PRETA],
    [5, 0, C.ROUPA_PRETA],  [5, 1, C.ROUPA_PRETA],  [5, 2, C.ROUPA_PRETA],  [5, 3, C.ROUPA_PRETA], [5, 4, C.ROUPA_PRETA],
    // Baquetas + kit de bateria ao lado (HU4): prato (haste) + caixa + bumbo.
    // Kit fica em rows 5-7 (longe do cabelo loiro — evita o borrão dourado documentado).
    [3, 5, C.MADEIRA], [4, 5, C.MADEIRA],                          // baquetas
    [2, 7, C.METAL], [3, 7, C.CINZA_ESC], [4, 7, C.CINZA_ESC],     // prato + haste
    [5, 5, C.BRANCO], [5, 6, C.BRANCO],                            // caixa (pele branca)
    [6, 5, BASE.baterista], [6, 6, BASE.baterista],                // bumbo (casco âmbar)
    [7, 5, PALETA.baterista.sombra], [7, 6, PALETA.baterista.sombra], // base/sombra do bumbo
    // Pernas
    [6, 1, C.ROUPA_PRETA],  [6, 2, C.ROUPA_PRETA],  [6, 3, C.ROUPA_PRETA],
    [7, 1, C.ROUPA_PRETA],  [7, 3, C.ROUPA_PRETA],
    // Sapatos estilosos dourados (cor-assinatura do baterista)
    [7, 0, BASE.baterista], [7, 1, BASE.baterista], [7, 2, C.ROUPA_PRETA],
    [7, 3, BASE.baterista], [7, 4, BASE.baterista],
  ];

  // Vande Bicuda — Vocalista (#b04ad8): cabelo marrom CURTO, pele branca, jaqueta preta c/ detalhes roxos, óculos escuros, pose confiante
  const SPRITE_VOCALISTA = [
    // Cabelo marrom curto (só no topo, não cai lateralmente)
    [0, 1, C.CABELO_CAST], [0, 2, C.CABELO_CAST], [0, 3, C.CABELO_CAST],
    // Cabeça (pele clara/branca) com óculos escuros na linha da testa
    [1, 0, C.PRETO],        [1, 1, C.PELE_CLARA],  [1, 2, C.PELE_CLARA],  [1, 3, C.PELE_CLARA],  [1, 4, C.PRETO],
    [1, 1, C.OCULOS_ESC],  [1, 2, C.OCULOS_ESC],  [1, 3, C.OCULOS_ESC],
    // Pescoço — sem cabelo caindo (curto)
    [2, 1, C.PRETO],        [2, 2, C.PELE_CLARA],  [2, 3, C.PELE_CLARA],  [2, 4, C.PRETO],
    // Corpo — jaqueta preta com ombros roxos (pose confiante = braço afastado col 5)
    [3, 0, C.COURO_PRETO],  [3, 1, BASE.vocalista], [3, 2, C.COURO_PRETO], [3, 3, BASE.vocalista], [3, 4, C.COURO_PRETO],
    [4, 0, C.COURO_PRETO],  [4, 1, C.COURO_PRETO],  [4, 2, PALETA.vocalista.sombra], [4, 3, C.COURO_PRETO], [4, 4, C.COURO_PRETO],
    [5, 0, C.COURO_PRETO],  [5, 1, C.COURO_PRETO],  [5, 2, C.COURO_PRETO],  [5, 3, C.COURO_PRETO], [5, 4, C.COURO_PRETO],
    // Braço confiante estendido (pose) + microfone erguido na mão (HU4)
    [4, 5, C.COURO_PRETO], [4, 6, C.PELE_CLARA],   // braço + mão segurando
    [1, 6, C.CINZA], [1, 7, C.CINZA],              // cabeça do mic (grelha)
    [2, 6, C.METAL], [2, 7, C.METAL],
    [3, 6, BASE.vocalista],                        // banda roxa (cor-assinatura)
    // Pernas
    [6, 1, C.PRETO],       [6, 2, C.PRETO],       [6, 3, C.PRETO],
    [7, 1, C.PRETO],       [7, 3, C.PRETO],
    // Sapatos estilosos roxos (cor-assinatura do vocalista)
    [7, 0, BASE.vocalista], [7, 1, BASE.vocalista], [7, 2, C.PRETO],
    [7, 3, BASE.vocalista], [7, 4, BASE.vocalista],
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
    // Baixo (HU4): corpo azul encorpado + braço comprido na mão direita
    [1, 7, C.METAL],                                                     // tarraxa
    [1, 6, C.MADEIRA], [2, 6, C.MADEIRA], [2, 5, C.MADEIRA],
    [3, 5, C.MADEIRA], [3, 6, C.MADEIRA],                               // braço comprido
    [4, 5, BASE.baixista],        [4, 6, PALETA.baixista.realce],       // corpo
    [5, 5, BASE.baixista],        [5, 6, BASE.baixista],
    [6, 5, PALETA.baixista.sombra], [6, 6, BASE.baixista],
    [5, 6, C.METAL],                                                    // ponte
    // Pernas
    [6, 1, C.PRETO],         [6, 2, C.PRETO],         [6, 3, C.PRETO],
    [7, 1, C.PRETO],         [7, 3, C.PRETO],
    // Sapatos estilosos azuis (cor-assinatura do baixista)
    [7, 0, BASE.baixista], [7, 1, BASE.baixista], [7, 2, C.PRETO],
    [7, 3, BASE.baixista], [7, 4, BASE.baixista],
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
  // HU4: faseAnim (number, opcional) faz o INSTRUMENTO embutido (células col>=5)
  // balançar de leve junto do membro. Default ausente/0 → render idêntico ao antigo
  // (chamadas de 3 args inalteradas — invariante 1). Determinístico: a fonte da fase
  // vem de FORA (introT da batalha); zero Math.random/Date.now aqui.
  function desenharMembro(ctx, tipo, escala, faseAnim) {
    const sprite = SPRITES_MEMBRO[tipo] || SPRITE_GUITARRISTA;
    const esc = (tipo === "baixista") ? escala * 0.8 : escala;
    if (!faseAnim) { desenharSprite(ctx, sprite, 0, 0, esc); return; }
    const dy = Math.sin(faseAnim) * esc * 0.35;   // bob sutil do instrumento (px)
    for (const [r, c, cor] of sprite) {
      ctx.fillStyle = cor;
      const y = c >= 5 ? r * esc + dy : r * esc;
      ctx.fillRect(c * esc, y, esc, esc);
    }
  }

  // Membro com contorno escuro + miolo preenchido (silhueta), pra destacar o
  // sprite sobre o fundo escuro do palco no cartaz do menu (UAT Fase 3).
  // Desenha cada célula expandida em PRETO atrás e o sprite real por cima.
  function desenharMembroDestacado(ctx, tipo, escala) {
    const sprite = SPRITES_MEMBRO[tipo] || SPRITE_GUITARRISTA;
    const esc = (tipo === "baixista") ? escala * 0.8 : escala;
    const out = Math.max(2, Math.round(esc * 0.34));   // espessura do contorno
    ctx.save();
    ctx.fillStyle = C.PRETO;
    for (const cel of sprite) {
      const r = cel[0], c = cel[1];
      ctx.fillRect(c * esc - out, r * esc - out, esc + 2 * out, esc + 2 * out);
    }
    ctx.restore();
    desenharSprite(ctx, sprite, 0, 0, esc);
  }

  // ── Instrumentos avulsos (HU4) ────────────────────────────────────────────
  // Sprites de instrumento reutilizáveis: showcase no cartaz do menu (idle) E
  // animação reativa do minigame (strum/baqueta/pulso no acerto/erro). Mesmo
  // formato das demais matrizes ([linha, coluna, cor], render por desenharSprite).
  // Cada instrumento separa células ESTÁTICAS (base) de poucas células ANIMÁVEIS
  // (anim) cujo offset inteiro vem de faseAnim — determinístico, zero Math.random.
  // Paleta derivada SÓ de PALETA[tipo].{base,sombra,realce} + C.* (sem cor solta).
  const _IG = PALETA.guitarrista, _IB = PALETA.baixista,
        _IV = PALETA.vocalista,   _ID = PALETA.baterista;

  const INSTRUMENTOS = {
    // Guitarra elétrica: corpo sólido vermelho (canto inf-esq), braço de madeira
    // diagonal p/ cima-direita + tarraxas de metal. Anim: palheta desliza (eixo x).
    guitarra: {
      eixo: "x",
      base: [
        [0, 5, C.MADEIRA], [0, 6, C.MADEIRA], [1, 6, C.METAL],   // headstock + tarraxa
        [1, 4, C.MADEIRA], [1, 5, C.MADEIRA],                    // braço diagonal
        [2, 3, C.MADEIRA], [2, 4, C.MADEIRA],
        [3, 2, C.MADEIRA], [3, 3, C.MADEIRA],
        [4, 2, C.MADEIRA],
        [4, 0, _IG.sombra], [4, 1, _IG.base],                    // corpo (blob vermelho)
        [5, 0, _IG.base],   [5, 1, _IG.base],  [5, 2, _IG.realce],
        [6, 0, _IG.sombra], [6, 2, _IG.base],  [6, 3, _IG.realce],
        [7, 1, _IG.sombra], [7, 2, _IG.base],
        [6, 1, C.PRETO],                                         // captador/ponte
      ],
      anim: [ [5, 3, C.METAL], [4, 3, C.BRANCO] ],
    },
    // Baixo: corpo azul maior, braço mais comprido (instrumento grave). Anim: pluck (eixo x).
    baixo: {
      eixo: "x",
      base: [
        [0, 4, C.MADEIRA], [0, 5, C.MADEIRA], [1, 5, C.METAL],
        [1, 4, C.MADEIRA],
        [2, 3, C.MADEIRA], [2, 4, C.MADEIRA],
        [3, 3, C.MADEIRA],
        [4, 2, C.MADEIRA], [4, 3, C.MADEIRA],
        [5, 2, C.MADEIRA],
        [5, 0, _IB.sombra], [5, 1, _IB.base],
        [6, 0, _IB.base],   [6, 2, _IB.realce],
        [7, 0, _IB.sombra], [7, 1, _IB.base], [7, 2, _IB.base], [7, 3, _IB.realce],
        [8, 1, _IB.sombra], [8, 2, _IB.base],
        [6, 1, C.METAL],                                         // ponte
      ],
      anim: [ [6, 3, C.METAL] ],
    },
    // Bateria: bumbo (pele branca) ao centro, caixa à direita, prato em haste.
    // Anim: baqueta bate (eixo y).
    bateria: {
      eixo: "y",
      base: [
        [4, 2, _ID.base], [4, 3, _ID.base],                      // bumbo
        [5, 1, _ID.base], [5, 2, C.BRANCO], [5, 3, C.BRANCO], [5, 4, _ID.base],
        [6, 1, _ID.base], [6, 2, C.BRANCO], [6, 3, C.BRANCO], [6, 4, _ID.base],
        [7, 1, _ID.sombra], [7, 2, _ID.base], [7, 3, _ID.base], [7, 4, _ID.sombra],
        [5, 5, C.BRANCO], [5, 6, C.BRANCO], [6, 5, C.CINZA], [6, 6, C.CINZA], // caixa
        [2, 5, C.METAL], [2, 6, C.METAL], [2, 7, C.METAL],       // prato
        [3, 6, C.CINZA_ESC], [4, 6, C.CINZA_ESC],                // haste do prato
      ],
      anim: [ [2, 2, C.MADEIRA], [3, 3, C.MADEIRA] ],
    },
    // Microfone: cabeça (grelha) em cima, banda roxa, haste e tripé. Anim: cabeça pulsa (eixo y).
    microfone: {
      eixo: "y",
      base: [
        [2, 1, _IV.base], [2, 2, _IV.base],                      // banda (cor vocalista)
        [3, 2, C.CINZA_ESC], [4, 2, C.CINZA_ESC], [5, 2, C.CINZA_ESC], [6, 2, C.CINZA_ESC], // haste
        [4, 1, C.PRETO], [5, 1, C.PRETO],                        // cabo
        [7, 0, C.PRETO], [7, 1, C.PRETO], [7, 2, C.PRETO], [7, 3, C.PRETO], // tripé/base
      ],
      anim: [ [0, 1, C.CINZA], [0, 2, C.CINZA], [1, 1, C.METAL], [1, 2, C.METAL] ],
    },
  };

  const SPRITE_INSTR_GUITARRA  = INSTRUMENTOS.guitarra.base.concat(INSTRUMENTOS.guitarra.anim);
  const SPRITE_INSTR_BAIXO     = INSTRUMENTOS.baixo.base.concat(INSTRUMENTOS.baixo.anim);
  const SPRITE_INSTR_BATERIA   = INSTRUMENTOS.bateria.base.concat(INSTRUMENTOS.bateria.anim);
  const SPRITE_INSTR_MICROFONE = INSTRUMENTOS.microfone.base.concat(INSTRUMENTOS.microfone.anim);

  // desenharInstrumento(ctx, tipo, escala, faseAnim)
  // tipo: "guitarra" | "baixo" | "bateria" | "microfone" (default guitarra).
  // faseAnim (number, default 0): modula SÓ a posição de poucas células animáveis,
  // de forma determinística (mesma fase → mesmo desenho). Sem Math.random/Date.now.
  // ctx nulo/ausente → no-op (mesma guarda das outras funções de draw).
  function desenharInstrumento(ctx, tipo, escala, faseAnim) {
    if (!ctx) return;
    const def  = INSTRUMENTOS[tipo] || INSTRUMENTOS.guitarra;
    const fase = faseAnim || 0;
    const off  = Math.round(Math.sin(fase));   // -1, 0 ou 1
    for (const [r, c, cor] of def.base) {
      ctx.fillStyle = cor;
      ctx.fillRect(c * escala, r * escala, escala, escala);
    }
    for (const [r, c, cor] of def.anim) {
      ctx.fillStyle = cor;
      const rr = def.eixo === "y" ? r + off : r;
      const cc = def.eixo === "x" ? c + off : c;
      ctx.fillRect(cc * escala, rr * escala, escala, escala);
    }
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

  // ── 3 skins de boss por venueId (UX-05 / D-11, D-12) ─────────────────────
  // Cores extras para as skins do boss (máx 8 cores cada).
  // Capanga do Bar: brutamontes baixo/largo, colete cinza, tatuagem vermelha.
  // Roadie Valentão: alto/magro, jaqueta punk, rebites âmbar, moicano roxo.
  // O Empresário: terno escuro #1a1a3a, gravata âmbar, maleta — reutiliza SPRITE_BOSS.

  const BOSS_COLETE      = "#4a4a58";  // cinza colete do capanga
  const BOSS_COLETE_ESC  = "#2a2a34";
  const BOSS_TATUAGEM    = "#e23b4e";  // tatuagem vermelha do capanga
  const BOSS_PUNK_JAQUETA= "#1a1228";  // jaqueta preta punk do roadie
  const BOSS_PUNK_REBITE = "#d4921e";  // rebites âmbar do roadie
  const BOSS_PUNK_MOICANO= "#5050a0";  // moicano roxo do roadie
  const BOSS_TERNO       = "#1a1a3a";  // terno escuro do empresário
  const BOSS_GRAVATA     = "#d4921e";  // gravata âmbar do empresário

  // Capanga do Bar (brutamontes): largo, colete cinza, tatuagem vermelha
  // Grid 10 linhas × 8 colunas
  const SPRITE_CAPANGA_BAR = [
    // Cabeça grande (sem chapéu)
    [0, 2, C.PELE_CLARA], [0, 3, C.PELE_CLARA], [0, 4, C.PELE_CLARA], [0, 5, C.PELE_CLARA],
    [1, 1, C.PELE_CLARA], [1, 2, C.PELE_CLARA], [1, 3, C.PELE_CLARA],
    [1, 4, C.PELE_CLARA], [1, 5, C.PELE_CLARA], [1, 6, C.PELE_CLARA],
    // Cabelo raspado / testa larga
    [0, 1, C.CABELO_PRETO], [0, 6, C.CABELO_PRETO],
    // Olhos e sombra de barba
    [1, 2, C.BOSS_SOMBRA], [1, 4, C.BOSS_SOMBRA],
    // Pescoço grosso
    [2, 2, C.PELE_CLARA], [2, 3, C.PELE_CLARA], [2, 4, C.PELE_CLARA], [2, 5, C.PELE_CLARA],
    // Ombros largos + colete cinza
    [3, 0, BOSS_COLETE], [3, 1, BOSS_COLETE], [3, 2, BOSS_COLETE_ESC], [3, 3, BOSS_COLETE],
    [3, 4, BOSS_COLETE], [3, 5, BOSS_COLETE_ESC], [3, 6, BOSS_COLETE], [3, 7, BOSS_COLETE],
    [4, 0, BOSS_COLETE], [4, 1, BOSS_COLETE],  [4, 2, BOSS_COLETE],   [4, 3, BOSS_COLETE_ESC],
    [4, 4, BOSS_COLETE_ESC],[4, 5, BOSS_COLETE],[4, 6, BOSS_COLETE],  [4, 7, BOSS_COLETE],
    // Tatuagem vermelha no braço esquerdo
    [5, 0, BOSS_COLETE], [5, 1, BOSS_TATUAGEM],[5, 2, BOSS_TATUAGEM], [5, 3, BOSS_COLETE],
    [5, 4, BOSS_COLETE], [5, 5, BOSS_COLETE],  [5, 6, BOSS_COLETE],   [5, 7, BOSS_COLETE],
    [6, 0, BOSS_COLETE_ESC],[6, 1, BOSS_COLETE],[6, 2, BOSS_COLETE],  [6, 3, BOSS_COLETE],
    [6, 4, BOSS_COLETE], [6, 5, BOSS_COLETE],  [6, 6, BOSS_COLETE],   [6, 7, BOSS_COLETE_ESC],
    // Pernas (calça preta)
    [7, 2, C.PRETO], [7, 3, C.PRETO], [7, 5, C.PRETO], [7, 6, C.PRETO],
    [8, 2, C.PRETO], [8, 3, C.PRETO], [8, 5, C.PRETO], [8, 6, C.PRETO],
    // Botas
    [9, 1, C.PRETO], [9, 2, C.PRETO], [9, 3, C.PRETO],
    [9, 5, C.PRETO], [9, 6, C.PRETO], [9, 7, C.PRETO],
  ];

  // Roadie Valentão (punk): alto/magro, jaqueta punk, rebites âmbar, moicano roxo
  // Grid 10 linhas × 7 colunas
  const SPRITE_ROADIE_VALENTAO = [
    // Moicano roxo (topo)
    [0, 2, BOSS_PUNK_MOICANO], [0, 3, BOSS_PUNK_MOICANO], [0, 4, BOSS_PUNK_MOICANO],
    // Cabeça magra
    [1, 2, C.PELE_CLARA], [1, 3, C.PELE_CLARA], [1, 4, C.PELE_CLARA],
    // Olhos raivosos
    [2, 2, C.BOSS_SOMBRA], [2, 4, C.BOSS_SOMBRA],
    [2, 3, C.PELE_CLARA],
    // Pescoço fino
    [3, 3, C.PELE_CLARA],
    // Jaqueta punk: estreita, rebites âmbar nas bordas
    [4, 1, BOSS_PUNK_REBITE],[4, 2, BOSS_PUNK_JAQUETA],[4, 3, BOSS_PUNK_JAQUETA],
    [4, 4, BOSS_PUNK_JAQUETA],[4, 5, BOSS_PUNK_REBITE],
    [5, 1, BOSS_PUNK_JAQUETA],[5, 2, BOSS_PUNK_JAQUETA],[5, 3, C.BRANCO],
    [5, 4, BOSS_PUNK_JAQUETA],[5, 5, BOSS_PUNK_JAQUETA],
    [6, 1, BOSS_PUNK_REBITE],[6, 2, BOSS_PUNK_JAQUETA],[6, 3, BOSS_PUNK_JAQUETA],
    [6, 4, BOSS_PUNK_JAQUETA],[6, 5, BOSS_PUNK_REBITE],
    // Calça preta estreita
    [7, 2, C.PRETO], [7, 3, C.PRETO], [7, 4, C.PRETO],
    [8, 2, C.PRETO], [8, 4, C.PRETO],
    // Botas com detalhe âmbar
    [9, 1, BOSS_PUNK_REBITE],[9, 2, C.PRETO],[9, 3, C.PRETO],
    [9, 4, C.PRETO],[9, 5, BOSS_PUNK_REBITE],
  ];

  // O Empresário (arena): reutiliza SPRITE_BOSS mas com terno escuro e gravata âmbar
  // Grid 10 linhas × 9 colunas — versão remasterizada com paleta diferente
  const SPRITE_EMPRESARIO = [
    // Chapéu de empresário
    [0, 1, BOSS_TERNO], [0, 2, BOSS_TERNO], [0, 3, BOSS_TERNO], [0, 4, BOSS_TERNO], [0, 5, BOSS_TERNO],
    [1, 0, BOSS_TERNO], [1, 1, BOSS_TERNO], [1, 2, BOSS_TERNO], [1, 3, BOSS_TERNO],
    [1, 4, BOSS_TERNO], [1, 5, BOSS_TERNO], [1, 6, BOSS_TERNO],
    // Rosto
    [2, 1, C.PELE_CLARA], [2, 2, C.PELE_CLARA], [2, 3, C.PELE_CLARA],
    [2, 4, C.PELE_CLARA], [2, 5, C.PELE_CLARA],
    [3, 1, C.PELE_CLARA], [3, 2, C.BOSS_SOMBRA], [3, 3, C.PELE_CLARA],
    [3, 4, C.BOSS_SOMBRA], [3, 5, C.PELE_CLARA],
    // Terno escuro
    [4, 0, BOSS_TERNO], [4, 1, BOSS_TERNO], [4, 2, BOSS_TERNO], [4, 3, BOSS_GRAVATA],
    [4, 4, BOSS_TERNO], [4, 5, BOSS_TERNO], [4, 6, BOSS_TERNO],
    [5, 0, BOSS_TERNO], [5, 1, BOSS_TERNO], [5, 2, BOSS_TERNO], [5, 3, BOSS_GRAVATA],
    [5, 4, BOSS_TERNO], [5, 5, BOSS_TERNO], [5, 6, BOSS_TERNO],
    [6, 0, "#12122a"], [6, 1, BOSS_TERNO], [6, 2, BOSS_TERNO], [6, 3, BOSS_TERNO],
    [6, 4, BOSS_TERNO],  [6, 5, BOSS_TERNO], [6, 6, "#12122a"],
    // Maleta (detalhe no braço)
    [5, 7, BOSS_TERNO], [6, 7, BOSS_GRAVATA], [6, 8, BOSS_GRAVATA],
    // Pernas
    [7, 1, BOSS_TERNO], [7, 2, BOSS_TERNO], [7, 4, BOSS_TERNO], [7, 5, BOSS_TERNO],
    [8, 1, BOSS_TERNO], [8, 2, BOSS_TERNO], [8, 4, BOSS_TERNO], [8, 5, BOSS_TERNO],
    // Sapatos pretos brilhantes
    [9, 0, C.PRETO], [9, 1, C.PRETO], [9, 2, C.PRETO],
    [9, 4, C.PRETO], [9, 5, C.PRETO], [9, 6, C.PRETO],
  ];

  // Sub-funções de skin do boss
  function _desenharCapangaBar(ctx, x, y, escala, anim) {
    const balanco = anim ? Math.sin((anim.introT || 0) / 120) * 2 : 0;
    desenharSprite(ctx, SPRITE_CAPANGA_BAR, x, y + balanco, escala);
  }

  function _desenharRoadieValentao(ctx, x, y, escala, anim) {
    const balanco = anim ? Math.sin((anim.introT || 0) / 100 + 1.5) * 3 : 0;
    desenharSprite(ctx, SPRITE_ROADIE_VALENTAO, x, y + balanco, escala);
  }

  function _desenharEmpresario(ctx, x, y, escala, anim) {
    const balanco = anim ? Math.sin((anim.introT || 0) / 140) * 1.5 : 0;
    desenharSprite(ctx, SPRITE_EMPRESARIO, x, y + balanco, escala);
  }

  // desenharBoss(ctx, x, y, escala, anim, venueId)
  // venueId opcional (default 'arena') — retrocompatível com chamadas de 4 args (Pitfall 3).
  // Guard: se ctx for null/undefined, retorna imediatamente.
  function desenharBoss(ctx, x, y, escala, anim, venueId) {
    if (!ctx) return;
    switch (venueId || "arena") {
      case "bar":
        _desenharCapangaBar(ctx, x, y, escala, anim);
        break;
      case "feira":
        _desenharRoadieValentao(ctx, x, y, escala, anim);
        break;
      case "arena":
      default:
        _desenharEmpresario(ctx, x, y, escala, anim);
        break;
    }
  }

  // ── Cenários de batalha por venue (UX-04 / D-10) ──────────────────────────
  // desenharCenario(ctx, venueId, largura, altura)
  // Pinta um fundo temático para a arena de batalha. Guard: ctx=null retorna sem erro.
  // Switch por venueId; default cai em 'arena'.
  function desenharCenario(ctx, venueId, largura, altura) {
    if (!ctx) return;
    switch (venueId || "arena") {
      case "bar":
        _desenharCenarioBar(ctx, largura, altura);
        break;
      case "feira":
        _desenharCenarioFeira(ctx, largura, altura);
        break;
      case "arena":
      default:
        _desenharCenarioArena(ctx, largura, altura);
        break;
    }
  }

  // Cenário "Bar do Zé": interior de bar — balcão, prateleiras de garrafas, palquinho,
  // luz âmbar rasante.
  function _desenharCenarioBar(ctx, largura, altura) {
    // Fundo: paredes do bar (tom quente-escuro)
    ctx.fillStyle = "#1a0e22";
    ctx.fillRect(0, 0, largura, altura);
    // Assoalho de madeira (inferior ~25%)
    const CHAO = Math.floor(altura * 0.75);
    ctx.fillStyle = "#3a1e0a";
    ctx.fillRect(0, CHAO, largura, altura - CHAO);
    // Tábuas do assoalho
    ctx.fillStyle = "#2e1808";
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(0, CHAO + i * Math.floor((altura - CHAO) / 6), largura, 2);
    }
    // Teto (faixa escura superior)
    ctx.fillStyle = "#0d0812";
    ctx.fillRect(0, 0, largura, Math.floor(altura * 0.10));
    // Luz âmbar rasante (halo de baixo para cima)
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#d4921e";
    ctx.fillRect(0, Math.floor(altura * 0.55), largura, Math.floor(altura * 0.20));
    ctx.restore();
    // Balcão (lado direito da tela)
    ctx.fillStyle = "#4a2808";
    ctx.fillRect(Math.floor(largura * 0.72), Math.floor(altura * 0.52), Math.floor(largura * 0.28), Math.floor(altura * 0.23));
    // Tampo do balcão
    ctx.fillStyle = "#6a3a0e";
    ctx.fillRect(Math.floor(largura * 0.70), Math.floor(altura * 0.50), Math.floor(largura * 0.30), 6);
    // Prateleiras de garrafas (fundo, atrás do balcão)
    ctx.fillStyle = "#0d0812";
    ctx.fillRect(Math.floor(largura * 0.74), Math.floor(altura * 0.15), Math.floor(largura * 0.24), Math.floor(altura * 0.35));
    // Prateleira 1 e 2
    ctx.fillStyle = "#3a1e0a";
    ctx.fillRect(Math.floor(largura * 0.74), Math.floor(altura * 0.22), Math.floor(largura * 0.24), 4);
    ctx.fillRect(Math.floor(largura * 0.74), Math.floor(altura * 0.35), Math.floor(largura * 0.24), 4);
    // Garrafas (retângulos coloridos sobre as prateleiras)
    const coresGarrafa = ["#e23b4e", "#4a78d8", "#2a8a5a", "#d4921e", "#b04ad8"];
    for (let g = 0; g < 8; g++) {
      ctx.fillStyle = coresGarrafa[g % coresGarrafa.length];
      const gx = Math.floor(largura * 0.76) + g * Math.floor(largura * 0.026);
      ctx.fillRect(gx, Math.floor(altura * 0.14), 6, 8);
      ctx.fillRect(gx, Math.floor(altura * 0.27), 6, 8);
    }
    // Palquinho (esquerda — onde a banda toca)
    ctx.fillStyle = "#2a1206";
    ctx.fillRect(0, Math.floor(altura * 0.70), Math.floor(largura * 0.45), Math.floor(altura * 0.05));
    // Borda do palco
    ctx.fillStyle = "#4a2808";
    ctx.fillRect(0, Math.floor(altura * 0.69), Math.floor(largura * 0.45), 4);
    // Luzes de cena (efeito de spot âmbar)
    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = "#ffe082";
    ctx.fillRect(Math.floor(largura * 0.05), 0, Math.floor(largura * 0.15), Math.floor(altura * 0.75));
    ctx.fillRect(Math.floor(largura * 0.25), 0, Math.floor(largura * 0.12), Math.floor(altura * 0.75));
    ctx.restore();
  }

  // Cenário "Feira Punk": rua de feira — barracas coloridas, grafites, asfalto.
  function _desenharCenarioFeira(ctx, largura, altura) {
    // Céu noturno (fundo)
    ctx.fillStyle = "#0f0a1e";
    ctx.fillRect(0, 0, largura, altura);
    // Parede de grafite (fundo)
    ctx.fillStyle = "#1a1424";
    ctx.fillRect(0, 0, largura, Math.floor(altura * 0.75));
    // Tijolos da parede
    ctx.fillStyle = "#12101e";
    for (let row = 0; row < 8; row++) {
      const h = Math.floor(altura * 0.75 / 8);
      for (let col = 0; col < 10; col++) {
        const offset = row % 2 === 0 ? 0 : Math.floor(largura * 0.05);
        ctx.fillRect(offset + col * Math.floor(largura * 0.10) + 1, row * h + 1, Math.floor(largura * 0.10) - 2, h - 2);
      }
    }
    // Grafite âmbar (blocos estilizados)
    ctx.fillStyle = "#d4921e";
    ctx.fillRect(Math.floor(largura * 0.05), Math.floor(altura * 0.15), Math.floor(largura * 0.12), 8);
    ctx.fillRect(Math.floor(largura * 0.06), Math.floor(altura * 0.23), Math.floor(largura * 0.08), 6);
    ctx.fillStyle = "#e0b341";
    ctx.fillRect(Math.floor(largura * 0.55), Math.floor(altura * 0.18), Math.floor(largura * 0.14), 8);
    ctx.fillRect(Math.floor(largura * 0.57), Math.floor(altura * 0.26), Math.floor(largura * 0.10), 5);
    // Grafite vermelho
    ctx.fillStyle = "#e23b4e";
    ctx.fillRect(Math.floor(largura * 0.30), Math.floor(altura * 0.10), Math.floor(largura * 0.18), 6);
    ctx.fillRect(Math.floor(largura * 0.32), Math.floor(altura * 0.16), Math.floor(largura * 0.12), 4);
    // Asfalto (inferior)
    const CHAO = Math.floor(altura * 0.75);
    ctx.fillStyle = "#1c1a28";
    ctx.fillRect(0, CHAO, largura, altura - CHAO);
    // Linhas do asfalto
    ctx.fillStyle = "#14121e";
    ctx.fillRect(0, CHAO + 8, largura, 2);
    // Barracas coloridas (toldo)
    const coresToldo = ["#3a1060", "#d4921e"];
    for (let b = 0; b < 3; b++) {
      const bx = b * Math.floor(largura * 0.34);
      for (let c = 0; c < 10; c++) {
        ctx.fillStyle = coresToldo[c % 2];
        ctx.fillRect(bx + c * Math.floor(largura * 0.034), Math.floor(altura * 0.40), Math.floor(largura * 0.034), Math.floor(altura * 0.10));
      }
      // Franja
      ctx.fillStyle = "#2a0a50";
      ctx.fillRect(bx, Math.floor(altura * 0.50), Math.floor(largura * 0.34), 4);
    }
    // Bandeiras penduradas
    const coresBandeira = ["#e23b4e", "#d4921e", "#4a78d8", "#b04ad8"];
    for (let f = 0; f < 14; f++) {
      ctx.fillStyle = coresBandeira[f % coresBandeira.length];
      ctx.fillRect(Math.floor(largura * 0.06) + f * Math.floor(largura * 0.065), Math.floor(altura * 0.38), 8, 12);
    }
  }

  // Cenário "Arena": palco de arena — cortinas laterais, cones de holofote, plateia em silhueta.
  function _desenharCenarioArena(ctx, largura, altura) {
    // Fundo: escuridão da arena
    ctx.fillStyle = "#080810";
    ctx.fillRect(0, 0, largura, altura);
    // Plateia em silhueta (faixa superior ~35%)
    ctx.fillStyle = "#0d0a1e";
    ctx.fillRect(0, 0, largura, Math.floor(altura * 0.35));
    // Cabeças da plateia (silhueta ondulada com fillRect)
    ctx.fillStyle = "#14101e";
    for (let i = 0; i < 28; i++) {
      const cx = i * Math.floor(largura / 28);
      const cy = Math.floor(altura * 0.05) + (i % 3) * 6 + (i % 5) * 3;
      ctx.fillRect(cx + 3, cy, 16, 18);
      ctx.fillRect(cx + 1, cy + 8, 20, 12);
    }
    // Palco (inferior ~25%)
    const PALCO_Y = Math.floor(altura * 0.72);
    ctx.fillStyle = "#1a1428";
    ctx.fillRect(0, PALCO_Y, largura, altura - PALCO_Y);
    // Borda brilhante do palco
    ctx.fillStyle = "#d4921e";
    ctx.fillRect(0, PALCO_Y, largura, 3);
    // Assoalho do palco com reflexo
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#d4921e";
    ctx.fillRect(0, PALCO_Y + 3, largura, altura - PALCO_Y - 3);
    ctx.restore();
    // Cortinas laterais (vermelho escuro)
    ctx.fillStyle = "#2a0a14";
    ctx.fillRect(0, 0, Math.floor(largura * 0.08), PALCO_Y);
    ctx.fillRect(Math.floor(largura * 0.92), 0, Math.floor(largura * 0.08), PALCO_Y);
    // Detalhes das cortinas
    ctx.fillStyle = "#3a1020";
    for (let d = 0; d < 5; d++) {
      ctx.fillRect(Math.floor(largura * 0.02), Math.floor(altura * 0.08) + d * Math.floor(altura * 0.12), Math.floor(largura * 0.04), Math.floor(altura * 0.06));
      ctx.fillRect(Math.floor(largura * 0.94), Math.floor(altura * 0.08) + d * Math.floor(altura * 0.12), Math.floor(largura * 0.04), Math.floor(altura * 0.06));
    }
    // Cones de holofote (feixes de luz do teto)
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = "#ffe082";
    // Holofote esquerdo
    ctx.fillRect(Math.floor(largura * 0.10), 0, Math.floor(largura * 0.18), PALCO_Y);
    // Holofote centro
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(Math.floor(largura * 0.40), 0, Math.floor(largura * 0.20), PALCO_Y);
    // Holofote direito
    ctx.fillStyle = "#ffe082";
    ctx.fillRect(Math.floor(largura * 0.72), 0, Math.floor(largura * 0.16), PALCO_Y);
    ctx.restore();
    // Equipamentos de som (silhueta de caixas no palco)
    ctx.fillStyle = "#0d0820";
    ctx.fillRect(Math.floor(largura * 0.08), Math.floor(altura * 0.55), Math.floor(largura * 0.10), Math.floor(altura * 0.17));
    ctx.fillRect(Math.floor(largura * 0.82), Math.floor(altura * 0.55), Math.floor(largura * 0.10), Math.floor(altura * 0.17));
  }

  // ── Intro d'O Empresário (D-13) ────────────────────────────────────────────
  // desenharIntroEmpresario(ctx, frame, largura, altura)
  // Chuva de dinheiro com posições determinísticas por frame + flash.
  // Guard: ctx=null retorna sem erro. globalAlpha dentro de save/restore (Pitfall 8).
  function desenharIntroEmpresario(ctx, frame, largura, altura) {
    if (!ctx) return;
    // Cédulas caindo: posições determinísticas via frame e índice (sem Math.random).
    // Usa LCG seed-by-index para distribuição visual.
    const N_CEDULAS = 18;
    for (let i = 0; i < N_CEDULAS; i++) {
      // LCG determinístico por índice (mesma semente do JANELAS_SKYLINE)
      const s1 = ((Math.imul(i * 37 + 1, 1664525) + 1013904223) >>> 0) / 0xFFFFFFFF;
      const s2 = ((Math.imul(i * 71 + 3, 1664525) + 1013904223) >>> 0) / 0xFFFFFFFF;
      const s3 = ((Math.imul(i * 13 + 7, 1664525) + 1013904223) >>> 0) / 0xFFFFFFFF;
      const cx = Math.floor(s1 * largura);
      // As cédulas caem de cima: y avança com frame, com offset por índice
      const cy = ((frame * 2 + Math.floor(s2 * altura)) % (altura + 20)) - 20;
      const inclinacao = Math.floor(s3 * 16) - 8;  // rotação visual: desvio horizontal
      // Cédula: retângulo âmbar (nota de dinheiro simplificada)
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "#d4921e";
      ctx.fillRect(cx + inclinacao, cy, 22, 12);
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = "#e0b341";
      ctx.fillRect(cx + inclinacao + 2, cy + 2, 18, 5);
      ctx.restore();
    }
    // Flash branco crescente nos últimos 30 frames (frame ~90-120)
    if (frame > 90) {
      const fadeIn = Math.min(1, (frame - 90) / 30);
      ctx.save();
      ctx.globalAlpha = fadeIn * 0.45;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, largura, altura);
      ctx.restore();
    }
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

  // ── Tipografia pixel 5×7 (UX-01 / D-05) ─────────────────────────────────────
  // Cada glifo é array de [lin, col] dos pixels ACESOS na grade 5 cols × 7 linhas.
  // Convenção: col 0..4, lin 0..6. Largura por char = 6*escala (5 glifo + 1 gap).
  // Cobertura: A-Z, a-z (mapeados para maiúscula), 0-9, espaço, acentuados,
  //            '.', ',', '!', "'" — necessários para textos do UI-SPEC.
  const GLIFOS = {
    // ── Letras ────────────────────────────────────────────────────────────────
    "A": [[0,1],[0,2],[0,3],[1,0],[1,4],[2,0],[2,4],[3,0],[3,1],[3,2],[3,3],[3,4],[4,0],[4,4],[5,0],[5,4],[6,0],[6,4]],
    "B": [[0,0],[0,1],[0,2],[0,3],[1,0],[1,4],[2,0],[2,4],[3,0],[3,1],[3,2],[3,3],[4,0],[4,4],[5,0],[5,4],[6,0],[6,1],[6,2],[6,3]],
    "C": [[0,1],[0,2],[0,3],[1,0],[1,4],[2,0],[3,0],[4,0],[5,0],[5,4],[6,1],[6,2],[6,3]],
    "D": [[0,0],[0,1],[0,2],[0,3],[1,0],[1,4],[2,0],[2,4],[3,0],[3,4],[4,0],[4,4],[5,0],[5,4],[6,0],[6,1],[6,2],[6,3]],
    "E": [[0,0],[0,1],[0,2],[0,3],[0,4],[1,0],[2,0],[3,0],[3,1],[3,2],[3,3],[4,0],[5,0],[6,0],[6,1],[6,2],[6,3],[6,4]],
    "F": [[0,0],[0,1],[0,2],[0,3],[0,4],[1,0],[2,0],[3,0],[3,1],[3,2],[3,3],[4,0],[5,0],[6,0]],
    "G": [[0,1],[0,2],[0,3],[1,0],[1,4],[2,0],[3,0],[3,3],[3,4],[4,0],[4,4],[5,0],[5,4],[6,1],[6,2],[6,3]],
    "H": [[0,0],[0,4],[1,0],[1,4],[2,0],[2,4],[3,0],[3,1],[3,2],[3,3],[3,4],[4,0],[4,4],[5,0],[5,4],[6,0],[6,4]],
    "I": [[0,1],[0,2],[0,3],[1,2],[2,2],[3,2],[4,2],[5,2],[6,1],[6,2],[6,3]],
    "J": [[0,3],[0,4],[1,4],[2,4],[3,4],[4,4],[5,0],[5,4],[6,1],[6,2],[6,3]],
    "K": [[0,0],[0,4],[1,0],[1,3],[2,0],[2,2],[3,0],[3,1],[4,0],[4,2],[5,0],[5,3],[6,0],[6,4]],
    "L": [[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[6,1],[6,2],[6,3],[6,4]],
    "M": [[0,0],[0,4],[1,0],[1,1],[1,3],[1,4],[2,0],[2,2],[2,4],[3,0],[3,4],[4,0],[4,4],[5,0],[5,4],[6,0],[6,4]],
    "N": [[0,0],[0,4],[1,0],[1,1],[1,4],[2,0],[2,2],[2,4],[3,0],[3,3],[3,4],[4,0],[4,4],[5,0],[5,4],[6,0],[6,4]],
    "O": [[0,1],[0,2],[0,3],[1,0],[1,4],[2,0],[2,4],[3,0],[3,4],[4,0],[4,4],[5,0],[5,4],[6,1],[6,2],[6,3]],
    "P": [[0,0],[0,1],[0,2],[0,3],[1,0],[1,4],[2,0],[2,4],[3,0],[3,1],[3,2],[3,3],[4,0],[5,0],[6,0]],
    "Q": [[0,1],[0,2],[0,3],[1,0],[1,4],[2,0],[2,4],[3,0],[3,4],[4,0],[4,2],[4,4],[5,0],[5,3],[5,4],[6,1],[6,2],[6,4]],
    "R": [[0,0],[0,1],[0,2],[0,3],[1,0],[1,4],[2,0],[2,4],[3,0],[3,1],[3,2],[3,3],[4,0],[4,2],[5,0],[5,3],[6,0],[6,4]],
    "S": [[0,1],[0,2],[0,3],[0,4],[1,0],[2,0],[3,1],[3,2],[3,3],[4,4],[5,4],[6,0],[6,1],[6,2],[6,3]],
    "T": [[0,0],[0,1],[0,2],[0,3],[0,4],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2]],
    "U": [[0,0],[0,4],[1,0],[1,4],[2,0],[2,4],[3,0],[3,4],[4,0],[4,4],[5,0],[5,4],[6,1],[6,2],[6,3]],
    "V": [[0,0],[0,4],[1,0],[1,4],[2,0],[2,4],[3,0],[3,4],[4,1],[4,3],[5,1],[5,3],[6,2]],
    "W": [[0,0],[0,4],[1,0],[1,4],[2,0],[2,4],[3,0],[3,2],[3,4],[4,0],[4,2],[4,4],[5,1],[5,3],[6,1],[6,3]],
    "X": [[0,0],[0,4],[1,1],[1,3],[2,2],[3,2],[4,1],[4,3],[5,1],[5,3],[6,0],[6,4]],
    "Y": [[0,0],[0,4],[1,0],[1,4],[2,1],[2,3],[3,2],[4,2],[5,2],[6,2]],
    "Z": [[0,0],[0,1],[0,2],[0,3],[0,4],[1,4],[2,3],[3,2],[4,1],[5,0],[6,0],[6,1],[6,2],[6,3],[6,4]],
    // ── Dígitos ───────────────────────────────────────────────────────────────
    "0": [[0,1],[0,2],[0,3],[1,0],[1,4],[2,0],[2,3],[2,4],[3,0],[3,2],[3,4],[4,0],[4,1],[4,4],[5,0],[5,4],[6,1],[6,2],[6,3]],
    "1": [[0,2],[1,1],[1,2],[2,2],[3,2],[4,2],[5,2],[6,1],[6,2],[6,3]],
    "2": [[0,1],[0,2],[0,3],[1,0],[1,4],[2,4],[3,3],[4,2],[5,1],[6,0],[6,1],[6,2],[6,3],[6,4]],
    "3": [[0,1],[0,2],[0,3],[1,0],[1,4],[2,4],[3,2],[3,3],[4,4],[5,0],[5,4],[6,1],[6,2],[6,3]],
    "4": [[0,3],[1,2],[1,3],[2,1],[2,3],[3,0],[3,3],[4,0],[4,1],[4,2],[4,3],[4,4],[5,3],[6,3]],
    "5": [[0,0],[0,1],[0,2],[0,3],[0,4],[1,0],[2,0],[3,0],[3,1],[3,2],[3,3],[4,4],[5,4],[6,0],[6,1],[6,2],[6,3]],
    "6": [[0,1],[0,2],[0,3],[1,0],[2,0],[3,0],[3,1],[3,2],[3,3],[4,0],[4,4],[5,0],[5,4],[6,1],[6,2],[6,3]],
    "7": [[0,0],[0,1],[0,2],[0,3],[0,4],[1,4],[2,3],[3,2],[4,2],[5,2],[6,2]],
    "8": [[0,1],[0,2],[0,3],[1,0],[1,4],[2,0],[2,4],[3,1],[3,2],[3,3],[4,0],[4,4],[5,0],[5,4],[6,1],[6,2],[6,3]],
    "9": [[0,1],[0,2],[0,3],[1,0],[1,4],[2,0],[2,4],[3,1],[3,2],[3,3],[3,4],[4,4],[5,4],[6,1],[6,2],[6,3]],
    // ── Pontuação ─────────────────────────────────────────────────────────────
    " ": [],
    ".": [[5,2],[6,2]],
    ",": [[4,2],[5,2],[6,1]],
    "!": [[0,2],[1,2],[2,2],[3,2],[4,2],[6,2]],
    "'": [[0,2],[1,2]],
    // ── Maiúsculas acentuadas (necessário para "DECIBÉIS", "EMPRESÁRIO", etc.) ─
    "Á": [[0,2],[1,1],[1,3],[2,0],[2,1],[2,2],[2,3],[2,4],[3,0],[3,4],[4,0],[4,4],[5,0],[5,4],[6,0],[6,4]],
    "É": [[0,2],[1,0],[1,1],[1,2],[1,3],[1,4],[2,0],[3,0],[3,1],[3,2],[3,3],[4,0],[5,0],[6,0],[6,1],[6,2],[6,3],[6,4]],
    "Í": [[0,2],[1,1],[1,2],[1,3],[2,2],[3,2],[4,2],[5,2],[6,1],[6,2],[6,3]],
    "Ó": [[0,2],[1,1],[1,2],[1,3],[2,0],[2,4],[3,0],[3,4],[4,0],[4,4],[5,0],[5,4],[6,1],[6,2],[6,3]],
    "Ú": [[0,2],[1,0],[1,4],[2,0],[2,4],[3,0],[3,4],[4,0],[4,4],[5,0],[5,4],[6,1],[6,2],[6,3]],
    "Ã": [[0,0],[0,2],[0,4],[1,1],[1,3],[2,0],[2,1],[2,2],[2,3],[2,4],[3,0],[3,4],[4,0],[4,4],[5,0],[5,4],[6,0],[6,4]],
    "Ç": [[0,1],[0,2],[0,3],[1,0],[1,4],[2,0],[3,0],[4,0],[5,0],[5,4],[6,1],[6,2],[6,3],[5,2]],
    // ── Minúsculas acentuadas mapeadas para maiúscula ─────────────────────────
    "á": [[0,2],[1,1],[1,3],[2,0],[2,1],[2,2],[2,3],[2,4],[3,0],[3,4],[4,0],[4,4],[5,0],[5,4],[6,0],[6,4]],
    "é": [[0,2],[1,0],[1,1],[1,2],[1,3],[1,4],[2,0],[3,0],[3,1],[3,2],[3,3],[4,0],[5,0],[6,0],[6,1],[6,2],[6,3],[6,4]],
    "ê": [[0,2],[1,1],[1,3],[2,0],[2,1],[2,2],[2,3],[2,4],[3,0],[3,4],[4,0],[4,4],[5,0],[5,4],[6,1],[6,2],[6,3]],
    "í": [[0,2],[1,1],[1,2],[1,3],[2,2],[3,2],[4,2],[5,2],[6,1],[6,2],[6,3]],
    "ó": [[0,2],[1,1],[1,2],[1,3],[2,0],[2,4],[3,0],[3,4],[4,0],[4,4],[5,0],[5,4],[6,1],[6,2],[6,3]],
    "ú": [[0,2],[1,0],[1,4],[2,0],[2,4],[3,0],[3,4],[4,0],[4,4],[5,0],[5,4],[6,1],[6,2],[6,3]],
    "ã": [[0,0],[0,2],[0,4],[1,1],[1,3],[2,0],[2,1],[2,2],[2,3],[2,4],[3,0],[3,4],[4,0],[4,4],[5,0],[5,4],[6,0],[6,4]],
    "ç": [[0,1],[0,2],[0,3],[1,0],[1,4],[2,0],[3,0],[4,0],[5,0],[5,4],[6,1],[6,2],[6,3],[5,2]],
  };

  // desenharTextoPixel(ctx, texto, x, y, escala, cor)
  // Retorna a largura total desenhada (N * 6 * escala) — útil para centralizar.
  // Guard: se ctx for null/undefined, retorna 0 sem lançar.
  function desenharTextoPixel(ctx, texto, x, y, escala, cor) {
    if (!ctx) return 0;
    ctx.fillStyle = cor;
    let cursorX = x;
    for (const ch of String(texto)) {
      const glifo = GLIFOS[ch] || GLIFOS[ch.toUpperCase()] || [];
      for (const [lin, col] of glifo) {
        ctx.fillRect(cursorX + col * escala, y + lin * escala, escala, escala);
      }
      cursorX += 6 * escala;
    }
    return String(texto).length * 6 * escala;
  }

  // _roundRect(ctx, x, y, w, h, r)
  // Desenha um retângulo com cantos arredondados usando arcTo.
  // NÃO usa a API roundRect nativa (ausente no JSDOM — Pitfall 1).
  function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  // desenharCartaz(ctx, largura, altura, membros, frame)
  // Renderiza o cartaz do menu com fundo âmbar + título pixel + 4 membros idle.
  // Guard: se ctx for null/undefined, retorna imediatamente sem erro.
  // membros: array de { tipo } (guitarrista/vocalista/baixista/baterista).
  // frame: contador incremental do rAF do menu (para idle senoidal D-07).
  function desenharCartaz(ctx, largura, altura, membros, frame) {
    if (!ctx) return;

    // Fundo do cartaz: faixa âmbar escura
    ctx.save();
    ctx.fillStyle = "#14111c";
    ctx.fillRect(0, 0, largura, altura);

    // Halo âmbar (--amber-glow)
    ctx.fillStyle = "rgba(212,146,30,0.15)";
    ctx.fillRect(0, 0, largura, altura);

    // Faixa de palco (gradiente simplificado em faixas)
    const faixas = [
      { y: 0,           h: Math.floor(altura * 0.15), cor: "#1a1040" },
      { y: Math.floor(altura * 0.15), h: Math.floor(altura * 0.25), cor: "#1e1530" },
      { y: Math.floor(altura * 0.40), h: Math.floor(altura * 0.25), cor: "#211b2e" },
      { y: Math.floor(altura * 0.65), h: Math.floor(altura * 0.35), cor: "#14111c" },
    ];
    for (const f of faixas) {
      ctx.fillStyle = f.cor;
      ctx.fillRect(0, f.y, largura, f.h);
    }

    // Borda do palco — âmbar sutil (tema), nada de rosa/roxo (UAT Fase 3).
    const pisoY = Math.floor(altura * 0.78);
    ctx.save();
    ctx.fillStyle = "rgba(212,146,30,0.22)";
    ctx.fillRect(0, pisoY, largura, 2);
    ctx.restore();

    // Título pixel "DECIBÉIS" centralizado
    const titulo = "DECIBÉIS";
    const escTitulo = 4;
    const wTitulo = titulo.length * 6 * escTitulo;
    const xTitulo = Math.floor((largura - wTitulo) / 2);
    const yTitulo = 16;
    ctx.fillStyle = "#d4921e";
    desenharTextoPixel(ctx, titulo, xTitulo, yTitulo, escTitulo, "#d4921e");

    // Subtítulo "a turne contra O Empresario" (escala 2, opacidade 70%)
    const sub = "a turne contra O Empresario";
    const escSub = 2;
    const wSub = sub.length * 6 * escSub;
    const xSub = Math.floor((largura - wSub) / 2);
    const ySub = yTitulo + 7 * escTitulo + 8;
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "#ece6f5";
    desenharTextoPixel(ctx, sub, xSub, ySub, escSub, "#ece6f5");
    ctx.restore();

    // 4 membros enfileirados com idle senoidal (D-07: reuso padrão batalha.js:231).
    // Maiores (esc 9), com sombra no piso + contorno escuro, pés fixos no piso e
    // só o corpo balançando — legíveis sobre o palco escuro (UAT Fase 3).
    const tiposMembro = membros && membros.length === 4
      ? membros.map((m) => m.tipo)
      : ["guitarrista", "vocalista", "baterista", "baixista"];
    const nMembros = tiposMembro.length;
    const SPRITE_ESC = 9;
    const spriteW = 7 * SPRITE_ESC;
    const gap = Math.floor((largura - nMembros * spriteW) / (nMembros + 1));

    for (let i = 0; i < nMembros; i++) {
      const tipo = tiposMembro[i];
      const esc = (tipo === "baixista") ? SPRITE_ESC * 0.8 : SPRITE_ESC;
      const altSprite = 8 * esc;
      const mX = gap + i * (spriteW + gap);
      const balanco = Math.sin(frame / 90 + i * 1.7) * 3;

      // Sombra no piso — fixa (não acompanha o balanço), pra "ancorar" o membro.
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath();
      ctx.ellipse(mX + spriteW / 2, pisoY + 3, spriteW * 0.42, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Membro: pés no piso (alinhados à sombra), corpo balança de leve.
      ctx.save();
      ctx.translate(mX, pisoY - altSprite + balanco);
      desenharMembroDestacado(ctx, tipo, SPRITE_ESC);
      ctx.restore();
    }

    // HU4: showcase dos 4 instrumentos avulsos — fileira no rodapé do palco, idle
    // senoidal derivado de `frame` (determinístico, sem Math.random). É a MESMA peça
    // reusada na animação reativa do minigame (desenharInstrumento).
    const showInstr = ["guitarra", "baixo", "bateria", "microfone"];
    const escI = Math.max(2, Math.floor((altura - pisoY) / 10));
    const wI = 8 * escI;
    const gapI = Math.floor((largura - showInstr.length * wI) / (showInstr.length + 1));
    const yI = pisoY + Math.max(4, Math.floor((altura - pisoY - 9 * escI) / 2));
    for (let i = 0; i < showInstr.length; i++) {
      const xI = gapI + i * (wI + gapI);
      ctx.save();
      ctx.translate(xI, yI);
      desenharInstrumento(ctx, showInstr[i], escI, frame / 60 + i);
      ctx.restore();
    }

    ctx.restore();
  }

  // ── Background parallax overworld (UX-03 / D-08) ────────────────────────
  // Camadas desenhadas ANTES dos sprites no overworld:
  //   0 — céu: degradê estático em faixas verticais (#1a1040 → #3a2a60 → #5a3a20)
  //   1 — skyline: silhuetas de prédios #0d0820 com janelas âmbar, parallax 0.2×
  //   2 — rua/calçada: faixa inferior ~20% (#1e1830 + sarjeta #0a0812)
  //
  // JANELAS_SKYLINE: pré-computado por índice (seed determinístico, sem Math.random no draw).
  // Pitfall 4: NUNCA usar Math.random dentro de funções de draw.
  const JANELAS_SKYLINE = (function () {
    // Gera posições de prédios e janelas com seed por índice (LCG simples).
    // Resultado é um array de objetos { bx, bw, bh, janelas: [{jx,jy,jw,jh}] }.
    const predios = [];
    // LCG seed: a=1664525, c=1013904223, m=2^32 (suficiente para distribução visual)
    let s = 0x12345678;
    function rand() { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0xFFFFFFFF; }

    const larguraTile = 1600; // tile repetível (skyline cobre 2× para tiling)
    let bx = 0;
    let idx = 0;
    while (bx < larguraTile) {
      const bw = Math.floor(30 + rand() * 60);   // largura do prédio: 30–90px
      const bh = Math.floor(40 + rand() * 100);  // altura do prédio: 40–140px
      const janelas = [];
      // 1 a 3 fileiras de janelas por prédio
      const nFileiras = 1 + Math.floor(rand() * 3);
      for (let f = 0; f < nFileiras; f++) {
        const jy = Math.floor(bh * 0.15 + f * (bh / (nFileiras + 1)));
        const nColunas = 1 + Math.floor(rand() * 3);
        const jw = 4, jh = 4;
        const passo = Math.floor(bw / (nColunas + 1));
        for (let c = 0; c < nColunas; c++) {
          const acesa = rand() > 0.3; // 70% das janelas acesas
          if (acesa) {
            janelas.push({ jx: Math.floor(passo * (c + 1)), jy, jw, jh });
          }
        }
      }
      predios.push({ bx, bw, bh, janelas });
      bx += bw + Math.floor(4 + rand() * 10); // espaço entre prédios: 4–14px
      idx++;
    }
    return { predios, larguraTile };
  })();

  // Estrelas do céu — pré-computadas com seed (Pitfall 4: nada de Math.random no
  // draw). Camada mais ao fundo: parallax bem lento (0.06×) e tile contínuo.
  // syPct = fração da altura (só no céu alto), pra não cair na rua/prédios.
  const ESTRELAS = (function () {
    const estrelas = [];
    let s = 0x9e3779b1;
    function rand() { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0xFFFFFFFF; }
    const larguraTile = JANELAS_SKYLINE.larguraTile;   // mesmo tile do skyline
    const n = 64;
    for (let i = 0; i < n; i++) {
      const sx = Math.floor(rand() * larguraTile);
      const syPct = 0.03 + rand() * 0.42;              // céu alto: 3%–45% da altura
      const r = rand();
      const tam = r > 0.9 ? 2 : 1;                     // maioria 1px, poucas 2px
      const cor = r > 0.82 ? "#ffe9b0" : (r > 0.5 ? "#cdd2ff" : "#ece6f5"); // âmbar/azul/branco
      const brilho = 0.45 + rand() * 0.5;              // alpha
      estrelas.push({ sx, syPct, tam, cor, brilho });
    }
    return { estrelas, larguraTile };
  })();

  // desenharFundo(ctx, largura, altura, scrollX)
  // Guard: se ctx for null/undefined, retorna imediatamente sem erro.
  function desenharFundo(ctx, largura, altura, scrollX) {
    if (!ctx) return;

    // Camada 0: céu — degradê estático em 7 faixas verticais (#1a1040 → #3a2a60 → #5a3a20)
    const ceuFaixas = [
      { y: 0,                          h: Math.floor(altura * 0.10), cor: "#1a1040" },
      { y: Math.floor(altura * 0.10),  h: Math.floor(altura * 0.10), cor: "#211548" },
      { y: Math.floor(altura * 0.20),  h: Math.floor(altura * 0.10), cor: "#2a1a55" },
      { y: Math.floor(altura * 0.30),  h: Math.floor(altura * 0.10), cor: "#32205a" },
      { y: Math.floor(altura * 0.40),  h: Math.floor(altura * 0.10), cor: "#3a2a60" },
      { y: Math.floor(altura * 0.50),  h: Math.floor(altura * 0.10), cor: "#442a48" },
      { y: Math.floor(altura * 0.60),  h: Math.floor(altura * 0.20), cor: "#5a3a20" },
    ];
    // Preenche até CHAO_Y (~83% de altura=360 → y≈300)
    const alturaCeu = Math.floor(altura * 0.833); // até o chão (~300/360)
    for (const f of ceuFaixas) {
      if (f.y >= alturaCeu) break;
      const fh = Math.min(f.h, alturaCeu - f.y);
      ctx.fillStyle = f.cor;
      ctx.fillRect(0, f.y, largura, fh);
    }

    // Camada 0.5: estrelas no céu — atrás do skyline, parallax bem lento (0.06×).
    const ofsEstrelas = -((scrollX * 0.06) % ESTRELAS.larguraTile);
    ctx.save();
    for (let tile = 0; tile < 3; tile++) {
      const tx = ofsEstrelas + tile * ESTRELAS.larguraTile;
      for (const e of ESTRELAS.estrelas) {
        const ex = e.sx + tx;
        if (ex < -2 || ex > largura + 2) continue;
        const ey = Math.floor(altura * e.syPct);
        if (ey >= alturaCeu - 4) continue;   // nunca sobre a rua/calçada
        ctx.globalAlpha = e.brilho;
        ctx.fillStyle = e.cor;
        ctx.fillRect(Math.floor(ex), ey, e.tam, e.tam);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Camada 1: skyline — prédios com janelas âmbar, parallax 0.2× (tile seamless)
    const offsetX = -((scrollX * 0.2) % JANELAS_SKYLINE.larguraTile);
    // Desenha 2 cópias do tile para cobertura contínua (tile seamless)
    for (let tile = 0; tile < 3; tile++) {
      const tileOfsX = offsetX + tile * JANELAS_SKYLINE.larguraTile;
      for (const p of JANELAS_SKYLINE.predios) {
        const px = p.bx + tileOfsX;
        if (px + p.bw < 0 || px > largura) continue;
        // Base do prédio: toca o CHAO_Y (~300px = altura*0.833)
        const py = alturaCeu - p.bh;
        ctx.fillStyle = "#0d0820";
        ctx.fillRect(px, py, p.bw, p.bh);
        // Janelas acesas (#d4921e âmbar)
        for (const j of p.janelas) {
          ctx.fillStyle = "#d4921e";
          ctx.fillRect(px + j.jx, py + j.jy, j.jw, j.jh);
        }
      }
    }

    // Camada 2: rua/calçada — faixa inferior ~17% (CHAO_Y até o fundo)
    ctx.fillStyle = "#1e1830";
    ctx.fillRect(0, alturaCeu, largura, altura - alturaCeu);
    // Sarjeta: linha mais escura logo abaixo do calçamento
    ctx.fillStyle = "#0a0812";
    ctx.fillRect(0, alturaCeu, largura, 4);
  }

  // ── Fachadas por venue (D-09) ─────────────────────────────────────────────
  // Sprites de fachada sobre a rua para cada venue.
  // Switch por venueId: bar/feira/arena com default seguro (cai no bar).
  // Guard: se ctx for null/undefined, retorna imediatamente.

  // Cores de fachada (declaradas no objeto C, mas como são específicas de fachada,
  // usamos constantes locais para não poluir o C global que pertence à paleta base).
  // Usam fillRect matricial análogo a desenharVenue.

  // Fachada "Bar do Zé": neon âmbar, porta de madeira, janelas quentes
  function _desenharFachadaBar(ctx, x, y, escala) {
    // Grade: 12 cols × 14 rows. Escala tipicamente 5 → 60×70px.
    // Parede principal
    ctx.fillStyle = "#1a0e2a";
    ctx.fillRect(x, y, 12 * escala, 14 * escala);
    // Teto/cornija
    ctx.fillStyle = "#0d0820";
    ctx.fillRect(x, y, 12 * escala, 2 * escala);
    // Letreiro neon "BAR DO ZÉ" (faixa âmbar brilhante)
    ctx.fillStyle = "#d4921e";
    ctx.fillRect(x + escala, y + 2 * escala, 10 * escala, 2 * escala);
    // Brilho interior do letreiro
    ctx.fillStyle = "#ffe082";
    ctx.fillRect(x + 2 * escala, y + 2 * escala, 8 * escala, escala);
    // Janelas (2 janelas com luz quente âmbar)
    ctx.fillStyle = "#c8780a";
    ctx.fillRect(x + escala,      y + 5 * escala, 3 * escala, 3 * escala);
    ctx.fillRect(x + 8 * escala,  y + 5 * escala, 3 * escala, 3 * escala);
    // Caixilho das janelas
    ctx.fillStyle = "#4a2a14";
    ctx.fillRect(x + 2 * escala,      y + 6 * escala, escala, 2 * escala);
    ctx.fillRect(x + 9 * escala,  y + 6 * escala, escala, 2 * escala);
    // Porta de madeira central
    ctx.fillStyle = "#5a3010";
    ctx.fillRect(x + 4 * escala, y + 9 * escala, 4 * escala, 5 * escala);
    // Detalhe da porta (maçaneta)
    ctx.fillStyle = "#d4921e";
    ctx.fillRect(x + 7 * escala, y + 11 * escala, escala, escala);
    // Friso inferior
    ctx.fillStyle = "#0d0820";
    ctx.fillRect(x, y + 13 * escala, 12 * escala, escala);
  }

  // Fachada "Feira Punk": toldo listrado, bandeiras, grafite
  function _desenharFachadaFeira(ctx, x, y, escala) {
    // Grade: 12 cols × 14 rows.
    // Parede com grafite (cor cinza escuro base)
    ctx.fillStyle = "#1e1a28";
    ctx.fillRect(x, y, 12 * escala, 14 * escala);
    // Toldo listrado (alternando roxo-escuro e âmbar claro)
    for (let c = 0; c < 12; c++) {
      ctx.fillStyle = c % 2 === 0 ? "#3a1060" : "#d4921e";
      ctx.fillRect(x + c * escala, y, escala, 3 * escala);
    }
    // Franja do toldo
    ctx.fillStyle = "#2a0a50";
    ctx.fillRect(x, y + 3 * escala, 12 * escala, escala);
    // Bandeiras penduradas (pequenos retângulos coloridos)
    const coresBandeira = ["#e23b4e", "#d4921e", "#4a78d8", "#b04ad8", "#3fae6b"];
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = coresBandeira[i % coresBandeira.length];
      ctx.fillRect(x + (i * 2 + 1) * escala, y + 4 * escala, escala, 2 * escala);
    }
    // Grafite no muro (bloco âmbar estilizado)
    ctx.fillStyle = "#d4921e";
    ctx.fillRect(x + escala, y + 7 * escala, 4 * escala, 3 * escala);
    ctx.fillStyle = "#e0b341";
    ctx.fillRect(x + 2 * escala, y + 8 * escala, 2 * escala, escala);
    // Balcão/barracão (faixa inferior escura com abertura central)
    ctx.fillStyle = "#0d0820";
    ctx.fillRect(x, y + 10 * escala, 12 * escala, 4 * escala);
    ctx.fillStyle = "#1a0e2a";
    ctx.fillRect(x + 3 * escala, y + 10 * escala, 6 * escala, 4 * escala);
  }

  // Fachada "Arena": concreto, letreiro "ARENA" âmbar, bilheteria
  function _desenharFachadaArena(ctx, x, y, escala) {
    // Grade: 12 cols × 14 rows.
    // Concreto escuro (cor base)
    ctx.fillStyle = "#181825";
    ctx.fillRect(x, y, 12 * escala, 14 * escala);
    // Nervuras de concreto verticais
    ctx.fillStyle = "#0f0f1a";
    ctx.fillRect(x,                y, escala,     14 * escala);
    ctx.fillRect(x + 11 * escala,  y, escala,     14 * escala);
    ctx.fillRect(x + 5 * escala,   y, escala,     14 * escala);
    ctx.fillRect(x + 6 * escala,   y, escala,     14 * escala);
    // Letreiro "ARENA" em âmbar brilhante (faixa com pixels dourados)
    ctx.fillStyle = "#d4921e";
    ctx.fillRect(x + escala, y + escala, 10 * escala, 3 * escala);
    ctx.fillStyle = "#ffe082";
    ctx.fillRect(x + 2 * escala, y + escala, 8 * escala, escala);
    // Janelas superiores (estreitas, vidro frio)
    ctx.fillStyle = "#2a4060";
    ctx.fillRect(x + 2 * escala, y + 5 * escala, 2 * escala, 2 * escala);
    ctx.fillRect(x + 8 * escala, y + 5 * escala, 2 * escala, 2 * escala);
    // Bilheteria central (caixa menor na base)
    ctx.fillStyle = "#0d0820";
    ctx.fillRect(x + 3 * escala, y + 8 * escala, 6 * escala, 6 * escala);
    // Janelinha da bilheteria
    ctx.fillStyle = "#d4921e";
    ctx.fillRect(x + 5 * escala, y + 9 * escala, 2 * escala, 2 * escala);
    // Degrau de entrada
    ctx.fillStyle = "#2a2a38";
    ctx.fillRect(x + 2 * escala, y + 13 * escala, 8 * escala, escala);
  }

  // desenharFachada(ctx, venueId, x, y, escala)
  // Guard: se ctx for null/undefined, retorna imediatamente.
  // Switch por venueId; default cai no bar sem crash.
  function desenharFachada(ctx, venueId, x, y, escala) {
    if (!ctx) return;
    // Centraliza a fachada: 12 colunas de largura
    const fachadaW = 12 * escala;
    const fx = x - fachadaW / 2;
    // Altura: 14 linhas; base no y (CHAO_Y), então fy = y - 14*escala
    const fachadaH = 14 * escala;
    const fy = y - fachadaH;
    switch (venueId) {
      case "bar":
        _desenharFachadaBar(ctx, fx, fy, escala);
        break;
      case "feira":
        _desenharFachadaFeira(ctx, fx, fy, escala);
        break;
      case "arena":
        _desenharFachadaArena(ctx, fx, fy, escala);
        break;
      default:
        _desenharFachadaBar(ctx, fx, fy, escala);
        break;
    }
  }

  // ── Exportação ─────────────────────────────────────────────────────────────
  window.Sprites = {
    PALETA,
    desenharSprite,
    desenharMembro,
    // HU4 — instrumentos avulsos (showcase no cartaz + animação reativa do minigame)
    desenharInstrumento,
    SPRITE_INSTR_GUITARRA,
    SPRITE_INSTR_BAIXO,
    SPRITE_INSTR_BATERIA,
    SPRITE_INSTR_MICROFONE,
    desenharVan,
    desenharBoss,
    desenharNpc,
    desenharBau,
    desenharVenue,
    desenharLoja,
    // UX-01/D-05 — tipografia pixel + cartaz do menu
    desenharTextoPixel,
    desenharCartaz,
    // UX-03/D-08-09 — background parallax + fachadas por venue
    desenharFundo,
    desenharFachada,
    // UX-04/D-10 — cenários de batalha por venue
    desenharCenario,
    // UX-05/D-11,D-12 — boss com skin por venueId (desenharBoss já exportado acima)
    // D-13 — intro d'O Empresário
    desenharIntroEmpresario,
  };
})();
