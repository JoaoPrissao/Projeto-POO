// Teste headless do nível de volume em RitmoMuteGate.
// Rodar: node frontend/test/volume-gate.node.test.cjs
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "js", "mute-gate.js"), "utf8");

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m };
}
function novoSandbox(storage) {
  const ctx = { console };
  ctx.window = ctx;
  ctx.localStorage = storage;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: "mute-gate.js" });
  return ctx.window.RitmoMuteGate;
}
function assert(c, m) { if (!c) { console.error("FALHOU: " + m); process.exitCode = 1; } else console.log("ok: " + m); }

console.log("== Teste: volume no gate ==");
let g = novoSandbox(fakeStorage());
assert(g.volume === 0.35, "default 0.35 sem storage");
assert(g.nivelEfetivo === 0.35, "nivelEfetivo = volume quando não-mutado");

g.setVolume(0.6);
assert(g.volume === 0.6, "setVolume(0.6) grava 0.6");
g.setVolume(1.5);
assert(g.volume === 1, "setVolume(1.5) clampa para 1");
g.setVolume(-0.5);
assert(g.volume === 0, "setVolume(-0.5) clampa para 0");

g.setVolume(0.5);
g.toggle(); // muta
assert(g.mutado === true && g.nivelEfetivo === 0, "mutado → nivelEfetivo 0");
g.toggle(); // desmuta
assert(g.nivelEfetivo === 0.5, "desmutado → nivelEfetivo volta ao volume");

// persistência: novo gate lê o valor gravado
const st = fakeStorage();
let g1 = novoSandbox(st);
g1.setVolume(0.42);
let g2 = novoSandbox(st);
assert(g2.volume === 0.42, "volume persiste entre instâncias via localStorage");

if (process.exitCode) console.error("\n>>> TESTE FALHOU"); else console.log("\n>>> TESTE PASSOU");
