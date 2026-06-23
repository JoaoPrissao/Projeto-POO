// Teste headless de regressão: instrumentos avulsos (HU4).
// Prova export, no-throw, ctx-null no-op, determinismo + reatividade de faseAnim,
// e ausência de cor solta (toda fillStyle ∈ PALETA + C.* conhecidas).
// Rodar: node frontend/test/sprites-instrumentos.node.test.cjs
"use strict";
const vm   = require("vm");
const fs   = require("fs");
const path = require("path");
const SRC  = fs.readFileSync(path.join(__dirname, "..", "js", "sprites.js"), "utf8");

// ── Fake CanvasRenderingContext2D: registra fillRect(x,y,w,h) + fillStyle ──────
function FakeCtx() { this.fills = []; this.fillStyle = ""; }
FakeCtx.prototype.fillRect = function (x, y, w, h) {
  this.fills.push({ x: x, y: y, w: w, h: h, style: this.fillStyle });
};
// no-ops defensivos (desenharInstrumento só usa fillStyle+fillRect)
["save", "restore", "beginPath", "fill", "ellipse", "moveTo", "lineTo",
 "translate", "scale", "rect", "arc", "arcTo", "closePath", "fillText", "stroke"
].forEach(function (m) { FakeCtx.prototype[m] = function () {}; });

function carregarSprites() {
  const ctx = { console: console, Math: Math, Float32Array: Float32Array };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: "sprites.js" });
  return ctx.window.Sprites;
}

function assert(cond, msg) {
  if (!cond) { console.error("FALHOU: " + msg); process.exitCode = 1; }
  else        { console.log("ok: " + msg); }
}

// =============================================================================
console.log("== Teste: instrumentos avulsos (HU4) ==\n");

const S = carregarSprites();
const TIPOS = ["guitarra", "baixo", "bateria", "microfone"];

// 1. Export presente
assert(typeof S.desenharInstrumento === "function", "desenharInstrumento exportado");
[["SPRITE_INSTR_GUITARRA",  S.SPRITE_INSTR_GUITARRA],
 ["SPRITE_INSTR_BAIXO",     S.SPRITE_INSTR_BAIXO],
 ["SPRITE_INSTR_BATERIA",   S.SPRITE_INSTR_BATERIA],
 ["SPRITE_INSTR_MICROFONE", S.SPRITE_INSTR_MICROFONE]].forEach(function (p) {
  assert(Array.isArray(p[1]) && p[1].length > 0, p[0] + " é array não-vazio");
});

// 2. Cada tipo desenha sem lançar e emite >=1 fillRect
TIPOS.forEach(function (tipo) {
  const ctx = new FakeCtx();
  let lancou = false;
  try { S.desenharInstrumento(ctx, tipo, 4, 0); } catch (_) { lancou = true; }
  assert(!lancou, tipo + ": desenharInstrumento não lança");
  assert(ctx.fills.length >= 1, tipo + ": emite >=1 fillRect");
});

// tipo inválido cai no default (guitarra) sem lançar
(function () {
  const ctx = new FakeCtx();
  let lancou = false;
  try { S.desenharInstrumento(ctx, "zzz", 4, 0); } catch (_) { lancou = true; }
  assert(!lancou && ctx.fills.length >= 1, "tipo inválido cai em default sem lançar");
})();

// 3. ctx nulo = no-op (guard)
(function () {
  let lancou = false;
  try { S.desenharInstrumento(null, "guitarra", 4, 0); } catch (_) { lancou = true; }
  assert(!lancou, "ctx=null não lança (no-op)");
})();

// 4. faseAnim: determinístico + reativo (microfone e bateria têm células animáveis)
["microfone", "bateria"].forEach(function (tipo) {
  const a  = new FakeCtx(); S.desenharInstrumento(a,  tipo, 4, 0);
  const b  = new FakeCtx(); S.desenharInstrumento(b,  tipo, 4, Math.PI / 2);
  const a2 = new FakeCtx(); S.desenharInstrumento(a2, tipo, 4, 0);

  assert(a.fills.length === b.fills.length, tipo + ": nº de fillRects independe da fase");

  const idem = a.fills.length === a2.fills.length && a.fills.every(function (f, i) {
    return f.x === a2.fills[i].x && f.y === a2.fills[i].y;
  });
  assert(idem, tipo + ": mesma fase → desenho idêntico (determinístico)");

  const mudou = a.fills.some(function (f, i) {
    return b.fills[i] && (f.x !== b.fills[i].x || f.y !== b.fills[i].y);
  });
  assert(mudou, tipo + ": faseAnim modula posição de >=1 célula (reativo)");
});

// 5. Nenhuma cor solta: toda fillStyle ∈ allowlist (PALETA + C.* usadas)
(function () {
  const allow = new Set();
  Object.keys(S.PALETA).forEach(function (t) {
    ["base", "sombra", "realce"].forEach(function (k) {
      if (S.PALETA[t] && S.PALETA[t][k]) allow.add(String(S.PALETA[t][k]).toLowerCase());
    });
  });
  // Auxiliares C.* usadas pelos instrumentos (não exportadas — replicadas do topo de sprites.js):
  // MADEIRA, METAL, BRANCO, CINZA, CINZA_ESC, PRETO.
  ["#8b6040", "#a0b0c0", "#ece6f5", "#6b7280", "#3a3540", "#0d0a14"]
    .forEach(function (h) { allow.add(h); });

  let foraDaPaleta = null;
  TIPOS.forEach(function (tipo) {
    const ctx = new FakeCtx();
    S.desenharInstrumento(ctx, tipo, 4, 0);
    ctx.fills.forEach(function (f) {
      const cor = String(f.style).toLowerCase();
      if (!allow.has(cor)) foraDaPaleta = tipo + " usa " + f.style;
    });
  });
  assert(foraDaPaleta === null, "nenhuma cor solta fora de PALETA/C.* (" + (foraDaPaleta || "ok") + ")");
})();

// =============================================================================
if (process.exitCode) {
  console.error("\n>>> TESTE FALHOU");
} else {
  console.log("\n>>> TESTE PASSOU");
}
