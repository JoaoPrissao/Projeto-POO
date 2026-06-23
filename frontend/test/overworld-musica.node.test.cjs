// Teste headless: a allowlist de musica.js aceita "overworld" e tocarTema
// monta o caminho assets/audio/overworld.ogg; um venueId fora da allowlist
// não dispara fetch. Usa um AudioContext falso mínimo (só o que tocarTema
// percorre até o fetch) e um fetch espião. Sem áudio real.
//
// Rodar: node frontend/test/overworld-musica.node.test.cjs

const vm = require("vm");
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "js", "musica.js"), "utf8");

function fakeGain() {
  return {
    connect: () => {},
    gain: { value: 1, cancelScheduledValues: () => {}, setValueAtTime: () => {}, linearRampToValueAtTime: () => {} },
  };
}
function FakeAudioContext() {
  this.state = "running";
  this.currentTime = 0;
  this.destination = {};
}
FakeAudioContext.prototype.resume = function () {};
FakeAudioContext.prototype.createGain = function () { return fakeGain(); };
FakeAudioContext.prototype.createBufferSource = function () {
  return { connect: () => {}, start: () => {}, stop: () => {}, buffer: null, loop: false };
};
FakeAudioContext.prototype.decodeAudioData = function () { return Promise.resolve({}); };

function novoSandbox(fetchUrls) {
  const ctx = {
    console,
    setTimeout,
    clearTimeout,
    // fetch espião: registra a URL e devolve não-ok (obterBuffer → null = silêncio)
    fetch: (url) => { fetchUrls.push(url); return Promise.resolve({ ok: false }); },
  };
  ctx.window = ctx;
  ctx.window.AudioContext = FakeAudioContext;
  // sem RitmoMuteGate → tratado como não-mutado
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: "musica.js" });
  return ctx;
}

function assert(cond, msg) {
  if (!cond) { console.error("FALHOU: " + msg); process.exitCode = 1; return false; }
  console.log("ok: " + msg);
  return true;
}

(async () => {
  console.log("== Teste: allowlist aceita 'overworld' ==");
  const urls = [];
  const ctx = novoSandbox(urls);
  const musica = ctx.window.RitmoMusica.criar();

  await musica.tocarTema("overworld");
  assert(urls.includes("assets/audio/overworld.ogg"), "tocarTema('overworld') buscou assets/audio/overworld.ogg");

  urls.length = 0;
  await musica.tocarTema("naoexiste");
  assert(urls.length === 0, "venueId fora da allowlist NÃO dispara fetch");

  if (process.exitCode) console.error("\n>>> TESTE FALHOU");
  else console.log("\n>>> TESTE PASSOU");
})();
