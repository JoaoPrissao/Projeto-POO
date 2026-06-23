// Teste headless: gainMaster da música reflete RitmoMuteGate.nivelEfetivo (não 1.0).
// Rodar: node frontend/test/musica-volume.node.test.cjs
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "js", "musica.js"), "utf8");

// Coletor global: cada gain criado é registrado p/ inspeção do .gain.value.
const GAINS = [];
function fakeGain() {
  const g = { connect: () => {}, gain: { value: 1, cancelScheduledValues: () => {}, setValueAtTime: () => {}, linearRampToValueAtTime: () => {} } };
  GAINS.push(g);
  return g;
}
function FakeAudioContext() { this.state = "running"; this.currentTime = 0; this.destination = {}; }
FakeAudioContext.prototype.resume = function () {};
FakeAudioContext.prototype.createGain = function () { return fakeGain(); };
FakeAudioContext.prototype.createBufferSource = function () { return { connect: () => {}, start: () => {}, stop: () => {}, buffer: null, loop: false }; };
FakeAudioContext.prototype.decodeAudioData = function () { return Promise.resolve({}); };

function novoSandbox() {
  const ctx = { console, setTimeout, clearTimeout, fetch: () => Promise.resolve({ ok: false }) };
  ctx.window = ctx;
  ctx.window.AudioContext = FakeAudioContext;
  // gate falso: volume 0.4, não-mutado
  ctx.window.RitmoMuteGate = { mutado: false, volume: 0.4, get nivelEfetivo() { return this.mutado ? 0 : this.volume; } };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: "musica.js" });
  return ctx;
}
function assert(c, m) { if (!c) { console.error("FALHOU: " + m); process.exitCode = 1; } else console.log("ok: " + m); }

(async () => {
  console.log("== Teste: música respeita o volume ==");
  GAINS.length = 0;
  const ctx = novoSandbox();
  const musica = ctx.window.RitmoMusica.criar();
  musica.aplicarVolume();
  assert(GAINS.length >= 1, "gainMaster criado");
  assert(GAINS.some((g) => g.gain.value === 0.4), "gainMaster setado para nivelEfetivo (0.4), não 1.0");

  // mutado → nivelEfetivo 0
  ctx.window.RitmoMuteGate.mutado = true;
  musica.aplicarMute(true);
  assert(GAINS.some((g) => g.gain.value === 0), "mutado → gainMaster 0");

  if (process.exitCode) console.error("\n>>> TESTE FALHOU"); else console.log("\n>>> TESTE PASSOU");
})();
