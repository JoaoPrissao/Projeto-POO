// Teste headless de regressão: entrar numa venue BLOQUEADA não pode travar o mapa.
//
// Bug (gate de fama, UAT Fase 3): entrarNaVenue() chamava owHandle.desligar()
// — que para o loop do overworld e remove os listeners de teclado — ANTES de
// confirmar com o backend que o show começou. Quando entrar_no_show devolve um
// ErroDTO (gate de fama, venue bloqueada por derrota, id inválido), a função só
// fazia avisoOverworld()+return: o mapa ficava na tela, mas morto — o jogador não
// conseguia mais se mexer.
//
// Correção: confirmar o show (entrar_no_show ok) ANTES de desligar o overworld.
// No caminho de erro, o owHandle nunca é desligado → o jogador continua andando.
//
// Carrega o main.js REAL num sandbox `vm` com stubs de DOM/window + uma ponte
// falsa cujo entrar_no_show recusa a entrada, e verifica que o overworld segue vivo.
//
// Rodar: node frontend/test/entrar-venue-bloqueada.node.test.cjs

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

  const document = {
    querySelector: () => null,        // helpers ($-based) são defensivos: no-op com null
    querySelectorAll: (sel) => {
      if (sel === ".tela") return Object.values(telas);
      if (sel === ".overlay-modal") return [];
      return [];
    },
    getElementById: () => null,       // sem transicao-overlay → transicionar roda fn() direto
  };

  const ctx = {
    document,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
  };
  ctx.window = ctx;
  ctx.window.addEventListener = () => {};
  ctx.window._semAnimacaoMenu = true;
  ctx.window._transicaoAtiva = true;   // harness-safe: transicionar executa sem fade
  // window.pywebview / Overworld ficam undefined no load (igual à produção pré-boot).

  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: "main.js" });
  return { ctx, telas };
}

function assert(cond, msg) {
  if (!cond) { console.error("FALHOU: " + msg); process.exitCode = 1; return false; }
  console.log("ok: " + msg);
  return true;
}

(async () => {
  console.log("== Teste: entrar em venue bloqueada não trava o overworld ==");
  const { ctx, telas } = novoSandbox();

  const owFake = {
    desligarCalls: 0,
    mundo: { estado: { banda: { x: 123 } } },
    desligar() { this.desligarCalls++; },
  };
  let entrouNoShowCom = null;

  ctx.window.Overworld = { montar: () => owFake };
  ctx.window.Batalha = { montar: () => ({ desligar() {} }) };
  ctx.window.pywebview = {
    api: {
      obter_campanha: async () => ({
        venues: [{ id: "arena", nome: "Arena", concluida: false, liberada: false, fama_minima: 3,
                   x: 600, capanga: { nome: "O Empresário", hp: 750 } }],
        itens: [], loja: null, npcs: [], baus: [],
        posicao: 60, fama_banda: 0, cache: 0, van_estagio: 1, completa: false,
      }),
      registrar_posicao: async () => ({ ok: true }),
      regenerar_banda: () => {},
      entrar_no_show: async (id) => {
        entrouNoShowCom = id;
        return { ok: false, erro: { tipo: "venue_fama_insuficiente",
                 mensagem: "A turnê ainda não chegou na Arena: exige fama >= 3 (atual: 0)." } };
      },
    },
  };

  assert(typeof ctx.abrirOverworld === "function", "abrirOverworld existe no escopo global");
  assert(typeof ctx.entrarNaVenue === "function", "entrarNaVenue existe no escopo global");

  await ctx.abrirOverworld();
  ctx.pararRegen();   // mata o setInterval de regen pra o processo poder encerrar
  assert(owFake.desligarCalls === 0, "abrirOverworld não desliga o handle recém-montado");
  assert(telas["tela-overworld"].classList.contains("ativa"), "mapa abriu (tela-overworld ativa)");

  // Tenta entrar na venue bloqueada por fama.
  await ctx.entrarNaVenue({ id: "arena", nome: "Arena", concluida: false, liberada: false,
                            fama_minima: 3, capanga: { nome: "O Empresário", hp: 750 } });
  ctx.pararRegen();

  assert(entrouNoShowCom === "arena", "entrar_no_show foi consultado (backend é a autoridade do gate)");
  // O CORAÇÃO DO BUG: o overworld NÃO pode ter sido desligado num erro de entrada.
  assert(owFake.desligarCalls === 0,
    "overworld segue VIVO após entrada recusada (desligar não foi chamado) → jogador continua andando");
  assert(telas["tela-overworld"].classList.contains("ativa"),
    "continua no mapa (tela-overworld ativa)");
  assert(!telas["tela-show"].classList.contains("ativa"),
    "não entrou na batalha (tela-show não ativa)");

  if (process.exitCode) console.error("\n>>> TESTE FALHOU");
  else console.log("\n>>> TESTE PASSOU");
})();
