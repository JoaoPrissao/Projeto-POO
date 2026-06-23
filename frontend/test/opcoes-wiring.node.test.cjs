// Teste headless: _aplicarVolumeGlobal grava no gate e reaplica em música + SFX.
// Rodar: node frontend/test/opcoes-wiring.node.test.cjs
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "js", "main.js"), "utf8");

function novoSandbox(log) {
  const document = {
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: (id) => (id === "transicao-overlay" ? { style: {}, addEventListener: () => {} } : null),
  };
  const ctx = { document, console, setTimeout, clearTimeout, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} };
  ctx.window = ctx;
  ctx.window.addEventListener = () => {};
  ctx.window._semAnimacaoMenu = true;
  ctx.window.RitmoMuteGate = { mutado: false, volume: 0.35, setVolume: (v) => { ctx.window.RitmoMuteGate.volume = v; log.push(["setVolume", v]); }, get nivelEfetivo() { return this.mutado ? 0 : this.volume; }, toggle: () => log.push(["toggle"]) };
  ctx.window.RitmoMusica = { criar: () => ({ tocarTema() {}, parar() {}, duck() {}, retoma() {}, aplicarMute() { log.push(["musica.aplicarMute"]); }, aplicarVolume() { log.push(["musica.aplicarVolume"]); } }) };
  ctx.window.RitmoAudio = { criar: () => ({ iniciar() {}, parar() {}, acerto() {}, erro() {}, batida() {}, golpe() {}, critico() {}, vitoria() {}, item() {}, solo() {}, aplicarVolume() { log.push(["audio.aplicarVolume"]); } }) };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: "main.js" });
  return ctx;
}
function assert(c, m) { if (!c) { console.error("FALHOU: " + m); process.exitCode = 1; } else console.log("ok: " + m); }

console.log("== Teste: wiring de volume ==");
const log = [];
const ctx = novoSandbox(log);
assert(typeof ctx._aplicarVolumeGlobal === "function", "_aplicarVolumeGlobal existe");
ctx._aplicarVolumeGlobal(0.7);
assert(log.some((e) => e[0] === "setVolume" && e[1] === 0.7), "grava setVolume(0.7) no gate");
assert(log.some((e) => e[0] === "musica.aplicarVolume"), "reaplica na música");
assert(log.some((e) => e[0] === "audio.aplicarVolume"), "reaplica nos SFX");

if (process.exitCode) console.error("\n>>> TESTE FALHOU"); else console.log("\n>>> TESTE PASSOU");
