// Teste headless: mostrarTela() dispara a trilha do overworld no chokepoint
// de troca de tela. Espiona o `musica` injetando um RitmoMusica falso.
// Reaproveita o padrão de sandbox de mostrar-tela.node.test.cjs.
//
// Rodar: node frontend/test/overworld-tela.node.test.cjs

const vm = require("vm");
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "js", "main.js"), "utf8");

function classList(inicial) {
  const s = new Set(inicial || []);
  return {
    add: (x) => s.add(x), remove: (x) => s.delete(x), contains: (x) => s.has(x),
    toggle: (x, f) => { const on = f === undefined ? !s.has(x) : f; if (on) s.add(x); else s.delete(x); return on; },
  };
}

function novoSandbox(musicaLog) {
  const telas = {
    "tela-menu": { id: "tela-menu", classList: classList(["tela", "ativa"]) },
    "tela-overworld": { id: "tela-overworld", classList: classList(["tela"]) },
    "tela-show": { id: "tela-show", classList: classList(["tela"]) },
  };
  const document = {
    querySelector: () => null,
    querySelectorAll: (sel) => {
      if (sel === ".tela") return Object.values(telas);
      if (sel === ".overlay-modal") return [];
      return [];
    },
    getElementById: (id) => {
      if (id === "transicao-overlay") return { style: {}, addEventListener: () => {} };
      return null;
    },
  };
  const musicaSpy = {
    tocarTema: (v) => musicaLog.push(["tocarTema", v]),
    parar: () => musicaLog.push(["parar"]),
    duck: () => {}, retoma: () => {}, aplicarMute: () => {},
  };
  const ctx = {
    document, console, setTimeout, clearTimeout,
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  };
  ctx.window = ctx;
  ctx.window.addEventListener = () => {};
  ctx.window._semAnimacaoMenu = true;
  ctx.window.RitmoMusica = { criar: () => musicaSpy };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: "main.js" });
  return ctx;
}

function assert(cond, msg) {
  if (!cond) { console.error("FALHOU: " + msg); process.exitCode = 1; return false; }
  console.log("ok: " + msg);
  return true;
}

console.log("== Teste: mostrarTela dispara/para a trilha do overworld ==");
const log = [];
const ctx = novoSandbox(log);

ctx.mostrarTela("tela-overworld");
assert(log.some((e) => e[0] === "tocarTema" && e[1] === "overworld"),
  "tela-overworld chama tocarTema('overworld')");

log.length = 0;
ctx.mostrarTela("tela-menu");
assert(log.some((e) => e[0] === "parar"), "tela-menu chama parar()");

log.length = 0;
ctx.mostrarTela("tela-show");
assert(!log.some((e) => e[0] === "tocarTema"),
  "tela-show NÃO dispara tocarTema (batalha.js cuida do tema do venue)");

if (process.exitCode) console.error("\n>>> TESTE FALHOU");
else console.log("\n>>> TESTE PASSOU");
