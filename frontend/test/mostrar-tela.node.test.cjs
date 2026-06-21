// Teste headless de regressão para o controlador de telas de main.js.
//
// Por que existe: os harnesses (*.harness.html) NÃO carregam main.js — então o
// boot do modo história (menu → overworld → batalha) ficava sem cobertura. Um
// bug de hoisting (duas `function mostrarTela` no mesmo escopo de script clássico
// fazendo o wrapper capturar a si mesmo) derrubava TODA troca de tela com
// RangeError, e clicar em "Novo jogo"/"Continuar" não saía do menu.
//
// Carrega o main.js REAL num sandbox `vm` com stubs mínimos de DOM/window e
// verifica que mostrarTela() realmente troca a classe .ativa sem estourar a pilha.
//
// Rodar: node frontend/test/mostrar-tela.node.test.cjs

const vm = require("vm");
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "js", "main.js"), "utf8");

function classList(inicial) {
  const s = new Set(inicial || []);
  return {
    add: (x) => s.add(x),
    remove: (x) => s.delete(x),
    contains: (x) => s.has(x),
    toggle: (x, force) => {
      const on = force === undefined ? !s.has(x) : force;
      if (on) s.add(x); else s.delete(x);
      return on;
    },
  };
}

function novoSandbox() {
  const telas = {
    "tela-menu": { id: "tela-menu", classList: classList(["tela", "ativa"]) },
    "tela-overworld": { id: "tela-overworld", classList: classList(["tela"]) },
    "tela-show": { id: "tela-show", classList: classList(["tela"]) },
  };
  const overlays = []; // sem overlays modais abertos no boot

  const document = {
    querySelector: () => null,
    querySelectorAll: (sel) => {
      if (sel === ".tela") return Object.values(telas);
      if (sel === ".overlay-modal") return overlays;
      return [];
    },
    getElementById: (id) => {
      if (id === "transicao-overlay") return { style: {}, addEventListener: () => {} };
      return null; // menu-canvas ausente → _iniciarLoopMenu sai cedo
    },
  };

  const ctx = {
    document,
    console,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
  };
  ctx.window = ctx;            // no browser, window é o próprio global
  ctx.window.addEventListener = () => {};   // boot escuta "pywebviewready" (não disparamos)
  ctx.window._semAnimacaoMenu = true;       // opt-out do loop rAF do cartaz
  // window.pywebview fica undefined → bind() não roda no load (sem botões no stub)

  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: "main.js" });
  return { ctx, telas };
}

function assert(cond, msg) {
  if (!cond) { console.error("FALHOU: " + msg); process.exitCode = 1; return false; }
  console.log("ok: " + msg);
  return true;
}

console.log("== Teste: mostrarTela troca de tela sem recursão ==");
const { ctx, telas } = novoSandbox();

assert(typeof ctx.mostrarTela === "function", "mostrarTela existe no escopo global do script");

let estourou = false;
try {
  ctx.mostrarTela("tela-overworld");
} catch (e) {
  estourou = true;
  console.error("FALHOU: mostrarTela('tela-overworld') lançou " + e.constructor.name + ": " + e.message.split("\n")[0]);
  process.exitCode = 1;
}

if (!estourou) {
  assert(telas["tela-overworld"].classList.contains("ativa"), "tela-overworld ficou ativa");
  assert(!telas["tela-menu"].classList.contains("ativa"), "tela-menu deixou de ser ativa");

  // volta pro menu também deve funcionar
  ctx.mostrarTela("tela-menu");
  assert(telas["tela-menu"].classList.contains("ativa"), "voltar pro menu reativa tela-menu");
  assert(!telas["tela-overworld"].classList.contains("ativa"), "tela-overworld desativa ao voltar");
}

if (process.exitCode) console.error("\n>>> TESTE FALHOU");
else console.log("\n>>> TESTE PASSOU");
