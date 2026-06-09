// Frontend — modo história (F3.2): overworld side-scroll + batalha de ritmo.
// Duas telas alternadas: o mapa (overworld.js, canvas) e o show (a UI de batalha
// herdada da F2/F3.1). Andar até uma venue e apertar W troca pra tela de show e
// arma a capanga daquela parada; vencer volta pro mapa com a venue concluída.

const $ = (sel) => document.querySelector(sel);

const COMPOSICAO_DEMO = [
  { tipo: "guitarrista", nome: "Aldric", forca: 14, ego: 0 },
  { tipo: "vocalista",   nome: "Selene", folego: 50, inteligencia: 12 },
  { tipo: "baterista",   nome: "Kael",   agilidade: 12, chance_critico: 0.3 },
  { tipo: "baixista",    nome: "Paul",   forca: 12, fe: 20 },
];

// Cor-assinatura por tipo (espelha os tokens do card em estilo.css) — pinta a
// highway do minigame na cor do músico ativo.
const COR_POR_TIPO = {
  guitarrista: "#e23b4e",  // --ego
  vocalista:   "#b04ad8",  // --folego
  baixista:    "#4a78d8",  // --groove
  baterista:   "#e0b341",  // --ritmo
};

// Campanha provisória no front (F3.2) — migra pro backend autoritativo na F3.3.
// Cada venue tem uma capanga (reusa Empresario via API.entrar_no_show); a última
// é o próprio Empresário. Itens são pegos andando por cima (API.coletar_item).
const CAMPANHA = {
  venues: [
    { id: "bar",   x: 420,  nome: "Bar do Zé", capanga: { nome: "Capanga do Bar", hp: 60, dano: 8 } },
    { id: "feira", x: 980,  nome: "Feira Punk", capanga: { nome: "Roadie Valentão", hp: 95, dano: 12 } },
    { id: "arena", x: 1600, nome: "Arena — O Empresário", capanga: { nome: "O Empresário", hp: 200, dano: 20 } },
  ],
  itens: [
    { id: "i1", x: 250,  tipo: "energetico" },
    { id: "i2", x: 1280, tipo: "pedal" },
  ],
};
const concluidas = new Set();     // ids de venues vencidas
const itensColetados = new Set(); // ids de itens já pegos

let estadoAtual = null;
let venueAtual = null;            // venue da batalha em curso
let owHandle = null;             // handle do overworld em execução
let posicaoMapa = null;          // x da banda no mapa (lembra entre batalhas)

function pct(v, max) {
  if (!max) return 100;
  return Math.max(0, Math.min(100, (v / max) * 100));
}

function log(html) {
  $("#log").innerHTML = html;
}

function renderBoss(boss) {
  $("#boss-nome").textContent = boss.nome;
  $("#boss-hp-fill").style.width = pct(boss.hp, boss.hp_maximo) + "%";
  $("#boss-hp-label").textContent = `${boss.hp} / ${boss.hp_maximo}`;
}

function renderBanda(banda, fimDeJogo) {
  const cont = $("#banda");
  cont.innerHTML = "";
  banda.forEach((m) => {
    const card = document.createElement("div");
    card.className = "card" + (m.vivo ? "" : " nocauteado");
    card.dataset.tipo = m.tipo;

    const rec = m.recurso;
    const recLabel = rec.tipo
      ? `${rec.tipo}: ${rec.valor}${rec.max ? " / " + rec.max : ""}`
      : "";

    card.innerHTML = `
      <h3>${m.nome}</h3>
      <div class="papel">${m.tipo} · nível ${m.nivel}</div>
      <div class="mini-barra"><div class="fill" style="width:${pct(m.hp, m.hp_maximo)}%;background:var(--boss)"></div></div>
      <div class="stat">HP ${m.hp}/${m.hp_maximo}</div>
      <div class="stat">${recLabel}</div>
    `;

    if (m.vivo && !fimDeJogo && estadoAtual?.turno === "banda") {
      card.addEventListener("click", () => executarAcao(m.id));
    }
    cont.appendChild(card);
  });
}

// Única fonte de verdade do estado dos botões — derivada do EstadoDTO.
// (Espelha _pode_montar_banda em tests/test_integracao_jogo.py.)
function atualizarBotoes(estado) {
  const fim = estado.fim_de_jogo;
  const bandaVazia = estado.banda.length === 0;
  // Só dá pra (re)montar quando não há banda ativa: vazia ou show acabou.
  $("#btn-banda-demo").disabled = !bandaVazia && !fim;
  $("#btn-turno-inimigo").disabled = fim || bandaVazia || estado.turno !== "boss";
  $("#btn-salvar").disabled = false;
  $("#btn-carregar").disabled = false;
}

function render(estado) {
  estadoAtual = estado;
  renderBoss(estado.boss);
  renderBanda(estado.banda, estado.fim_de_jogo);
  atualizarBotoes(estado);

  // Fim de batalha: vitória marca a venue como concluída; nos dois casos o
  // jogador volta ao mapa pelo botão.
  const btnVoltar = $("#btn-voltar-mapa");
  if (estado.fim_de_jogo) {
    if (estado.resultado === "vitoria" && venueAtual) {
      concluidas.add(venueAtual.id);
      const final = venueAtual.id === "arena";
      log(final
        ? "🏆 <span class='refrao'>Vitória final!</span> O Empresário caiu — a banda fez história."
        : `🏆 <span class='refrao'>Venceu ${venueAtual.nome}!</span> Volte ao mapa e siga a turnê.`);
    } else {
      log("💀 <span class='crit'>Derrota.</span> A banda foi nocauteada.");
    }
    if (btnVoltar) btnVoltar.hidden = false;
  } else if (btnVoltar) {
    btnVoltar.hidden = true;
  }
}

function aplicarResultado(res) {
  if (!res.ok) {
    log(`⚠️ ${res.erro.mensagem}`);
    return;
  }
  render(res.estado);
  if (res.fim_de_jogo) return;

  let msg = `<b>${res.atacante}</b> causou <b>${res.dano}</b> de dano`;
  if (res.critico) msg += ` — <span class='crit'>VIRADA DE BATERIA!</span>`;
  if (res.modo_refrao_ativo) msg += ` <span class='refrao'>(Modo Refrão ×${res.multiplicador_aplicado.toFixed(2)})</span>`;
  log(msg + ".");
}

async function montarBandaDemo() {
  const estado = await window.pywebview.api.criar_banda(COMPOSICAO_DEMO);
  render(estado);
  log("Banda no palco! Clique num músico para atacar.");
}

async function executarAcao(indice) {
  const musico = estadoAtual?.banda?.[indice];
  const tipo = musico?.tipo;
  const cor = COR_POR_TIPO[tipo] || "#e0457b";

  // Abre o minigame; a performance vira a contagem crua {acertos,total,combo_max}.
  const ritmo = await window.RitmoMinigame.jogarRitmo({ tipoMusico: tipo, cor });
  if (ritmo === null) {                  // Esc → cancelou; não gasta o turno
    log("Ritmo cancelado — escolha um músico para tocar.");
    return;
  }

  const res = await window.pywebview.api.executar_acao({ indice, ritmo });
  aplicarResultado(res);
}

async function turnoInimigo() {
  const res = await window.pywebview.api.turno_inimigo();
  if (!res.ok) { log(`⚠️ ${res.erro.mensagem}`); return; }
  render(res.estado);
  if (!res.fim_de_jogo) {
    log(`🎤 <b>${res.atacante}</b> provocou <b>${res.alvo}</b> (-${res.dano} HP). Sua vez.`);
  }
}

async function salvar() {
  const res = await window.pywebview.api.salvar("slot1");
  log(res.ok ? "💾 Show salvo no slot1." : `⚠️ ${res.erro.mensagem}`);
}

async function carregar() {
  const res = await window.pywebview.api.carregar("slot1");
  if (!res.ok) { log(`⚠️ ${res.erro.mensagem}`); return; }
  render(res.estado);
  log("📂 Show carregado do slot1.");
}

// ── Controlador de telas (overworld ↔ show) ─────────────────────────────────
function mostrarTela(id) {
  document.querySelectorAll(".tela").forEach((t) => t.classList.toggle("ativa", t.id === id));
}

function avisoOverworld(texto) {
  const el = $("#ow-aviso");
  if (el) el.textContent = texto || "";
}

// Abre/reabre o mapa. Reconstrói o mundo a partir do progresso da campanha
// (venues vencidas e itens já pegos ficam marcados).
function abrirOverworld() {
  venueAtual = null;
  mostrarTela("tela-overworld");
  const canvas = $("#overworld-canvas");
  const venues = CAMPANHA.venues.map((v) => ({ ...v, concluida: concluidas.has(v.id) }));
  const itens = CAMPANHA.itens.map((i) => ({ ...i, coletado: itensColetados.has(i.id) }));

  if (owHandle) owHandle.desligar();
  owHandle = window.Overworld.montar({
    canvas, venues, itens, corTipo: "guitarrista",
    inicioX: posicaoMapa,            // retoma onde a banda estava (null = começo)
    aoEntrar: entrarNaVenue,
    aoColetar: coletarItemNoMapa,
  });
  window.__overworld = owHandle;   // handle p/ harness/depuração (dirige o mundo sem rAF)

  const faltam = CAMPANHA.venues.length - concluidas.size;
  avisoOverworld(faltam > 0 ? `${faltam} venue(s) restante(s) na turnê.` : "Turnê completa! 🤘");
}

async function entrarNaVenue(venue) {
  if (owHandle) {
    posicaoMapa = owHandle.mundo.estado.banda.x;   // lembra onde parou no mapa
    owHandle.desligar();
  }
  venueAtual = venue;
  mostrarTela("tela-show");
  const estado = await window.pywebview.api.entrar_no_show(venue.capanga);
  render(estado);
  log(`🎤 <b>${venue.nome}</b> — encare <b>${venue.capanga.nome}</b>! Clique num músico pra tocar.`);
}

async function coletarItemNoMapa(item) {
  itensColetados.add(item.id);
  const res = await window.pywebview.api.coletar_item({ tipo: item.tipo, indice: 0 });
  avisoOverworld(res.ok
    ? `🎁 ${res.musico} pegou ${res.item}! (inventário: ${res.tamanho_inventario})`
    : `⚠️ ${res.erro.mensagem}`);
}

function voltarAoMapa() {
  $("#btn-voltar-mapa").hidden = true;
  abrirOverworld();
}

function bind() {
  $("#btn-banda-demo").addEventListener("click", montarBandaDemo);
  $("#btn-turno-inimigo").addEventListener("click", turnoInimigo);
  $("#btn-salvar").addEventListener("click", salvar);
  $("#btn-carregar").addEventListener("click", carregar);
  $("#btn-voltar-mapa").addEventListener("click", voltarAoMapa);
}

// Boot do modo história: garante a banda no palco e abre o mapa.
async function iniciarJogo() {
  await window.pywebview.api.criar_banda(COMPOSICAO_DEMO);
  abrirOverworld();
}

// A API só existe depois que o pywebview termina de injetar a ponte.
window.addEventListener("pywebviewready", () => {
  bind();
  iniciarJogo();
});

// Fallback se o evento já tiver disparado antes deste script carregar.
if (window.pywebview) {
  bind();
}
