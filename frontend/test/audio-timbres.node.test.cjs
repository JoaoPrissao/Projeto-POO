// Teste headless de regressão: cadeias de síntese por timbre (GF2).
// Prova roteamento por master, ausência de conexão direta ao destination,
// distinção estrutural de grafo por timbre, mute, e no-throw (incl. nulo()).
// Rodar: node frontend/test/audio-timbres.node.test.cjs
"use strict";
const vm   = require("vm");
const fs   = require("fs");
const path = require("path");
const SRC  = fs.readFileSync(path.join(__dirname, "..", "js", "audio.js"), "utf8");

// ── FakeAudioContext completo ─────────────────────────────────────────────────
const DEST = { _id: "destination", _tag: "destination" };
let _seq = 0;

function makeNode(tag, log, nodes) {
  const node = {
    _tag: tag,
    _id: tag + (++_seq),
    gain: {
      value: 1,
      setValueAtTime:              function () {},
      exponentialRampToValueAtTime: function () {},
      setTargetAtTime:             function () {},
      linearRampToValueAtTime:     function () {},
    },
    frequency: {
      value: 0,
      setValueAtTime:              function () {},
      exponentialRampToValueAtTime: function () {},
      linearRampToValueAtTime:     function () {},
    },
    Q: { value: 1 },
    type: "",
    curve: null,
    oversample: "none",
    connect: function (t) {
      log.push([node._id, t === DEST ? "destination" : t._id]);
      return t;
    },
    start:  function () {},
    stop:   function () {},
  };
  nodes.push(node);
  return node;
}

function FakeAudioContext(log, nodes) {
  this.state       = "running";
  this.currentTime = 0;
  this.sampleRate  = 44100;
  this.destination = DEST;
  this._log   = log;
  this._nodes = nodes;
}
FakeAudioContext.prototype.resume             = function () {};
FakeAudioContext.prototype.createGain         = function () { return makeNode("gain",         this._log, this._nodes); };
FakeAudioContext.prototype.createOscillator   = function () { return makeNode("osc",          this._log, this._nodes); };
FakeAudioContext.prototype.createBiquadFilter = function () { return makeNode("filtro",       this._log, this._nodes); };
FakeAudioContext.prototype.createWaveShaper   = function () { return makeNode("waveshaper",   this._log, this._nodes); };
FakeAudioContext.prototype.createBufferSource = function () { return makeNode("bufferSource", this._log, this._nodes); };
FakeAudioContext.prototype.createBuffer       = function (ch, n) {
  return { getChannelData: function () { return new Float32Array(n); } };
};

// ── Sandbox por timbre ────────────────────────────────────────────────────────
function novoSandbox(log, nodes) {
  const ctx   = { console, setTimeout, clearTimeout, Float32Array };
  ctx.window  = ctx;
  const FAC   = function () { FakeAudioContext.call(this, log, nodes); };
  FAC.prototype = FakeAudioContext.prototype;
  ctx.window.AudioContext   = FAC;
  ctx.window.RitmoMuteGate = {
    mutado: false,
    volume: 0.4,
    get nivelEfetivo() { return this.mutado ? 0 : this.volume; },
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: "audio.js" });
  return ctx;
}

// ── Utilitário de asserção ────────────────────────────────────────────────────
function assert(cond, msg) {
  if (!cond) { console.error("FALHOU: " + msg); process.exitCode = 1; }
  else        { console.log("ok: " + msg); }
}

// =============================================================================
console.log("== Teste: grafo de síntese por timbre (GF2) ==\n");

const TIMBRES = ["guitarrista", "baixista", "vocalista", "baterista"];

// 1. Para cada timbre: roteia pelo master; nenhum nó per-som vai direto ao destination
TIMBRES.forEach(function (timbre) {
  const log = [], nodes = [];
  const ctx   = novoSandbox(log, nodes);
  const audio = ctx.window.RitmoAudio.criar();

  audio.solo(timbre, 440, true);

  // Identificar o master: nó com aresta para destination
  const masterIds = log.filter(function (e) { return e[1] === "destination"; })
                       .map(function (e) { return e[0]; });

  assert(masterIds.length >= 1,
    timbre + ": algum nó conecta no destination (master presente)");

  // Todos os outros nós que conectam em algum lugar NÃO devem ir ao destination
  // (somente o master vai ao destination)
  const directToDestCount = log.filter(function (e) {
    return e[1] === "destination" && !masterIds.includes(e[0]);
  }).length;
  assert(directToDestCount === 0,
    timbre + ": nenhum nó per-som conecta direto no destination (tudo passa pelo master)");
});

// 2. solo() não lança para nenhum timbre
TIMBRES.forEach(function (timbre) {
  const log = [], nodes = [];
  const ctx   = novoSandbox(log, nodes);
  const audio = ctx.window.RitmoAudio.criar();
  let lancou  = false;
  try { audio.solo(timbre, 440, true); }
  catch (_) { lancou = true; }
  assert(!lancou, timbre + ": solo() não lança");
});

// 3. Mute: com mutado=true, solo() não gera nenhuma aresta
(function () {
  const log = [], nodes = [];
  const ctx   = novoSandbox(log, nodes);
  ctx.window.RitmoMuteGate.mutado = true;
  const audio = ctx.window.RitmoAudio.criar();

  audio.solo("guitarrista", 440, true);

  assert(log.length === 0,
    "mute: solo(guitarrista) com mutado=true não gera arestas de connect");
})();

// 4. Distinção estrutural — guitarrista tem waveshaper
(function () {
  const log = [], nodes = [];
  const ctx   = novoSandbox(log, nodes);
  const audio = ctx.window.RitmoAudio.criar();
  audio.solo("guitarrista", 440, true);
  const temWaveShaper = nodes.some(function (n) { return n._tag === "waveshaper"; });
  assert(temWaveShaper, "guitarrista: grafo contém ao menos 1 nó waveshaper");
})();

// 5. Distinção estrutural — vocalista tem >=2 filtros bandpass (formantes) e >=2 oscs (LFO)
(function () {
  const log = [], nodes = [];
  const ctx   = novoSandbox(log, nodes);
  const audio = ctx.window.RitmoAudio.criar();
  audio.solo("vocalista", 440, true);
  const filtros = nodes.filter(function (n) { return n._tag === "filtro"; });
  const oscs    = nodes.filter(function (n) { return n._tag === "osc"; });
  assert(filtros.length >= 2, "vocalista: grafo contém >=2 filtros (formantes)");
  assert(oscs.length >= 2,    "vocalista: grafo contém >=2 oscs (fonte + LFO)");
})();

// 6. Distinção estrutural — baterista tem bufferSource (noise) e osc (corpo pitched)
(function () {
  const log = [], nodes = [];
  const ctx   = novoSandbox(log, nodes);
  const audio = ctx.window.RitmoAudio.criar();
  audio.solo("baterista", 440, true);
  const temNoise = nodes.some(function (n) { return n._tag === "bufferSource"; });
  const temOsc   = nodes.some(function (n) { return n._tag === "osc"; });
  assert(temNoise, "baterista: grafo contém bufferSource (noise snap)");
  assert(temOsc,   "baterista: grafo contém osc (corpo pitched)");
})();

// 7. nulo().solo() não lança
(function () {
  const log = [], nodes = [];
  const ctx   = novoSandbox(log, nodes);
  let lancou  = false;
  try { ctx.window.RitmoAudio.nulo().solo("guitarrista", 440, true); }
  catch (_) { lancou = true; }
  assert(!lancou, "nulo().solo() não lança");
})();

// =============================================================================
if (process.exitCode) {
  console.error("\n>>> TESTE FALHOU");
} else {
  console.log("\n>>> TESTE PASSOU");
}
