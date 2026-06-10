// Frontend — modo história (F3.5a): overworld side-scroll + batalha estilo MK.
// Duas telas alternadas: o mapa (overworld.js) e a batalha (batalha.js, arena em
// canvas + barras de vida no HUD). A campanha é AUTORITATIVA no backend: o front
// lê de `obter_campanha` e reporta progresso. O ataque reusa o minigame de ritmo.
// Salvar/Carregar vivem no HUD do mapa (saíram da tela de batalha); o menu
// principal + menu de pausa entram na F3.5b.

const $ = (sel) => document.querySelector(sel);

const COMPOSICAO_DEMO = [
  { tipo: "guitarrista", nome: "Aldric", forca: 14, ego: 0 },
  { tipo: "vocalista",   nome: "Selene", folego: 50, inteligencia: 12 },
  { tipo: "baterista",   nome: "Kael",   agilidade: 12, chance_critico: 0.3 },
  { tipo: "baixista",    nome: "Paul",   forca: 12, fe: 20 },
];

// Cor-assinatura por tipo (espelha os tokens do card em estilo.css).
const COR_POR_TIPO = {
  guitarrista: "#e23b4e",  // --ego
  vocalista:   "#b04ad8",  // --folego
  baixista:    "#4a78d8",  // --groove
  baterista:   "#e0b341",  // --ritmo
};

let venueAtual = null;          // venue da batalha em curso (DTO da campanha)
let owHandle = null;            // handle do overworld em execução
let batalhaHandle = null;       // handle da batalha em execução
let campanhaAtual = null;       // último DTO de campanha lido do backend

function pct(v, max) {
  if (!max) return 100;
  return Math.max(0, Math.min(100, (v / max) * 100));
}

function log(html) {
  const el = $("#log");
  if (el) el.innerHTML = html;
}

// ── HUD da batalha (barras de vida estilo MK) ───────────────────────────────
function barraMembro(m) {
  const cor = COR_POR_TIPO[m.tipo] || "var(--acento)";
  return `
    <div class="hud-membro${m.vivo ? "" : " ko"}">
      <span class="hud-nome">${m.nome}<span class="hud-nv">Nv ${m.nivel}</span></span>
      <div class="barra mini">
        <div class="fill" style="width:${pct(m.hp, m.hp_maximo)}%;background:${cor}"></div>
        <span class="barra-label">${m.hp}/${m.hp_maximo}</span>
      </div>
    </div>`;
}

function atualizarHud(estado) {
  $("#hud-banda").innerHTML = estado.banda.map(barraMembro).join("");
  const b = estado.boss;
  $("#boss-nome").textContent = b.nome;
  $("#boss-hp-fill").style.width = pct(b.hp, b.hp_maximo) + "%";
  $("#boss-hp-label").textContent = `${b.hp} / ${b.hp_maximo}`;
}

// Fim da batalha (5a — ponte): vitória marca a venue; derrota volta ao mapa.
// As telas ricas de vitória (drop) e derrota (bloqueio) são F3.5b.
async function aplicarFim(resultado, venue) {
  if (resultado === "vitoria") {
    await window.pywebview.api.concluir_venue(venue.id);
    const final = venue.id === "arena";
    log(final
      ? "🏆 <span class='refrao'>Vitória final!</span> O Empresário caiu."
      : `🏆 <span class='refrao'>Venceu ${venue.nome}!</span> Volte ao mapa e siga a turnê.`);
  } else {
    log("💀 <span class='crit'>Derrota.</span> A banda foi nocauteada.");
  }
  $("#btn-voltar-mapa").hidden = false;
}

// ── Persistência (no HUD do mapa) ───────────────────────────────────────────
async function salvar() {
  const res = await window.pywebview.api.salvar("slot1");
  avisoOverworld(res.ok ? "💾 Jogo salvo no slot1." : `⚠️ ${res.erro.mensagem}`);
}

async function carregar() {
  const res = await window.pywebview.api.carregar("slot1");
  if (!res.ok) { avisoOverworld(`⚠️ ${res.erro.mensagem}`); return; }
  await abrirOverworld();
  avisoOverworld("📂 Jogo carregado do slot1.");
}

// ── Controlador de telas (overworld ↔ batalha) ──────────────────────────────
function mostrarTela(id) {
  document.querySelectorAll(".tela").forEach((t) => t.classList.toggle("ativa", t.id === id));
}

function avisoOverworld(texto) {
  const el = $("#ow-aviso");
  if (el) el.textContent = texto || "";
}

// Abre/reabre o mapa a partir da campanha autoritativa do backend.
async function abrirOverworld() {
  venueAtual = null;
  if (batalhaHandle) { batalhaHandle.desligar(); batalhaHandle = null; }
  mostrarTela("tela-overworld");
  const camp = await window.pywebview.api.obter_campanha();
  campanhaAtual = camp;
  const canvas = $("#overworld-canvas");

  if (owHandle) owHandle.desligar();
  owHandle = window.Overworld.montar({
    canvas, venues: camp.venues, itens: camp.itens, corTipo: "guitarrista",
    inicioX: camp.posicao,
    aoEntrar: entrarNaVenue,
    aoColetar: coletarItemNoMapa,
  });
  window.__overworld = owHandle;

  const faltam = camp.venues.filter((v) => !v.concluida).length;
  avisoOverworld(faltam > 0 ? `${faltam} venue(s) restante(s) na turnê.` : "Turnê completa! 🤘");
}

// Entrar numa venue → arma o show no backend e monta a arena de batalha.
async function entrarNaVenue(venue) {
  if (owHandle) {
    await window.pywebview.api.registrar_posicao(owHandle.mundo.estado.banda.x);
    owHandle.desligar();
  }
  venueAtual = venue;
  const estado = await window.pywebview.api.entrar_no_show(venue.id);
  if (estado.ok === false) {            // venue bloqueada/ inválida → fica no mapa
    avisoOverworld(`⚠️ ${estado.erro.mensagem}`);
    return;
  }
  mostrarTela("tela-show");
  $("#btn-voltar-mapa").hidden = true;
  log(`🎤 <b>${venue.nome}</b> — encare <b>${venue.capanga.nome}</b>! Escolha um músico e toque.`);

  if (batalhaHandle) batalhaHandle.desligar();
  batalhaHandle = window.Batalha.montar({
    canvas: $("#batalha-canvas"),
    api: window.pywebview.api,
    estado,
    corPorTipo: COR_POR_TIPO,
    aoAtualizar: atualizarHud,
    aoLog: (html) => log(html),
    aoFim: (res) => aplicarFim(res, venue),
  });
}

async function coletarItemNoMapa(item) {
  const res = await window.pywebview.api.coletar_item({ id: item.id });
  avisoOverworld(res.ok
    ? `🎁 ${res.musico} pegou ${res.item}! (inventário: ${res.tamanho_inventario})`
    : `⚠️ ${res.erro.mensagem}`);
}

async function voltarAoMapa() {
  $("#btn-voltar-mapa").hidden = true;
  await abrirOverworld();
}

function bind() {
  $("#btn-salvar").addEventListener("click", salvar);
  $("#btn-carregar").addEventListener("click", carregar);
  $("#btn-voltar-mapa").addEventListener("click", voltarAoMapa);
}

// Boot do modo história: garante a banda no palco e abre o mapa.
async function iniciarJogo() {
  await window.pywebview.api.criar_banda(COMPOSICAO_DEMO);
  await abrirOverworld();
}

window.addEventListener("pywebviewready", () => {
  bind();
  iniciarJogo();
});

// Fallback se o evento já tiver disparado antes deste script carregar.
if (window.pywebview) {
  bind();
}
