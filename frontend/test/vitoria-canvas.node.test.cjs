// Teste headless de regressão para o canvas de vitória final (D-14) em main.js.
//
// Por que existe: _iniciarCanvasVitoria() chamava desenharTextoPixel() uma vez
// SÓ para medir a largura do texto (em x=0,y=0) e outra vez centralizado. Como
// desenharTextoPixel DESENHA como efeito colateral (não é medição pura), o app
// pintava "VITÓRIA!" DUAS vezes: um fantasma no canto superior esquerdo + o
// centralizado. O clear de limpeza mirava a faixa central (yCentro), não o
// canto (0,0), então o fantasma sobrevivia.
//
// Este teste roda UM tick do loop com um spy em Sprites.desenharTextoPixel e
// exige que "VITORIA!" seja desenhado EXATAMENTE 1 vez, nunca em (0,0).
//
// Rodar: node frontend/test/vitoria-canvas.node.test.cjs

const vm = require("vm");
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "js", "main.js"), "utf8");

function fakeGradient() {
  return { addColorStop: () => {} };
}

function fakeCtx() {
  return {
    fillStyle: "",
    globalAlpha: 1,
    clearRect: () => {},
    fillRect: () => {},
    createRadialGradient: () => fakeGradient(),
    save: () => {},
    restore: () => {},
  };
}

function novoSandbox(soloLog) {
  const canvas = { width: 400, height: 300, getContext: () => fakeCtx() };

  const document = {
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: (id) => {
      if (id === "vitoria-canvas") return canvas;
      if (id === "transicao-overlay") return { style: {}, addEventListener: () => {} };
      return null;
    },
  };

  let rafCount = 0;
  const ctx = {
    document,
    console,
    setTimeout,
    clearTimeout,
    // Roda exatamente UM tick: a 1ª chamada (a do final de _iniciarCanvasVitoria)
    // executa tick(); a 2ª (o re-agendamento dentro de tick) vira no-op.
    requestAnimationFrame: (cb) => { rafCount++; if (rafCount === 1) cb(); return rafCount; },
    cancelAnimationFrame: () => {},
  };
  ctx.window = ctx;
  ctx.window.addEventListener = () => {};
  ctx.window._semAnimacaoMenu = true;
  // Spy: registra cada desenho de texto e devolve a largura real (N*6*escala)
  // para que a matemática de centralização continue válida.
  ctx.Sprites = {
    desenharTextoPixel: (c, texto, x, y, escala) => {
      soloLog.push({ texto: String(texto), x, y });
      return String(texto).length * 6 * escala;
    },
  };

  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: "main.js" });
  return ctx;
}

function assert(cond, msg) {
  if (!cond) { console.error("FALHOU: " + msg); process.exitCode = 1; return false; }
  console.log("ok: " + msg);
  return true;
}

console.log("== Teste: canvas de vitória desenha 'VITÓRIA!' uma única vez ==");

const draws = [];
const ctx = novoSandbox(draws);

assert(typeof ctx._iniciarCanvasVitoria === "function", "_iniciarCanvasVitoria existe no escopo do script");

ctx._iniciarCanvasVitoria();

const vit = draws.filter((d) => d.texto === "VITORIA!");
assert(vit.length === 1, `'VITORIA!' desenhado exatamente 1 vez por tick (foi ${vit.length})`);
assert(!vit.some((d) => d.x === 0 && d.y === 0), "nenhum 'VITORIA!' fantasma desenhado em (0,0)");

if (process.exitCode) console.error("\n>>> TESTE FALHOU");
else console.log("\n>>> TESTE PASSOU");
