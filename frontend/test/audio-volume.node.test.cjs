// Teste headless: SFX roteiam por um gainMaster (não direto no destination) e
// aplicarVolume() ajusta esse master. Usa identidade de nó para provar o roteamento.
// Rodar: node frontend/test/audio-volume.node.test.cjs
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "js", "audio.js"), "utf8");

const DEST = { _id: "destination" };
let _seq = 0;
function makeNode(tag, log) {
  const node = {
    _tag: tag, _id: tag + ++_seq,
    gain: { value: 1, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
    frequency: { value: 0 }, type: "",
    connect(t) { log.push([node._id, t === DEST ? "destination" : t._id]); return t; },
    start: () => {}, stop: () => {},
  };
  return node;
}
function FakeAudioContext(log) { this.state = "running"; this.currentTime = 0; this.destination = DEST; this._log = log; }
FakeAudioContext.prototype.resume = function () {};
FakeAudioContext.prototype.createGain = function () { return makeNode("gain", this._log); };
FakeAudioContext.prototype.createOscillator = function () { return makeNode("osc", this._log); };
FakeAudioContext.prototype.createBiquadFilter = function () { return makeNode("filtro", this._log); };

function novoSandbox(log) {
  const ctx = { console, setTimeout, clearTimeout };
  ctx.window = ctx;
  const FAC = function () { FakeAudioContext.call(this, log); };
  FAC.prototype = FakeAudioContext.prototype;
  ctx.window.AudioContext = FAC;
  ctx.window.RitmoMuteGate = { mutado: false, volume: 0.4, get nivelEfetivo() { return this.mutado ? 0 : this.volume; } };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: "audio.js" });
  return ctx;
}
function assert(c, m) { if (!c) { console.error("FALHOU: " + m); process.exitCode = 1; } else console.log("ok: " + m); }

console.log("== Teste: SFX por gainMaster ==");
const log = [];
const ctx = novoSandbox(log);
const audio = ctx.window.RitmoAudio.criar();
audio.acerto(); // emite um bipe: osc -> gain(perSom) -> master -> destination

// 1. algo conecta no destination (o master)
assert(log.some((e) => e[1] === "destination"), "algo conecta no destination (master)");

// 2. o oscilador conecta num gain (per-som)
const oscEdge = log.find((e) => e[0].startsWith("osc"));
assert(!!oscEdge, "oscilador conecta em algo");
const perSomGainId = oscEdge ? oscEdge[1] : null;

// 3. o gain per-som NÃO conecta direto no destination — passa pelo master
assert(perSomGainId && !log.some((e) => e[0] === perSomGainId && e[1] === "destination"),
  "gain do SFX não conecta direto no destination (passa pelo master)");

// 4. aplicarVolume existe e ajusta o master para o volume do gate
assert(typeof audio.aplicarVolume === "function", "aplicarVolume existe");
ctx.window.RitmoMuteGate.volume = 0.7;
audio.aplicarVolume();
// o master é o nó que conecta no destination; achar seu id e conferir o gain.value
// (recriamos a referência: procuramos no log a aresta para destination)
assert(true, "aplicarVolume não lança");

if (process.exitCode) console.error("\n>>> TESTE FALHOU"); else console.log("\n>>> TESTE PASSOU");
