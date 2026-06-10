// Frontend — modo história (F3.5b): menu principal + overworld + batalha MK.
// Três telas: menu (Novo jogo/Continuar/Sair), mapa (overworld.js) e batalha
// (batalha.js — intro, auto-ataque por tempo, especial no espaço, pausa no Esc).
// A campanha é AUTORITATIVA no backend: o front lê de `obter_campanha` e
// reporta progresso. Vitória abre a tela de drop (escolhe o membro →
// `aplicar_drop`); derrota registra bloqueio+fama (`registrar_derrota`).

const $ = (sel) => document.querySelector(sel);

// Escapa valores dinâmicos antes de interpolar em innerHTML (anti-XSS).
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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
      <span class="hud-nome">${esc(m.nome)}<span class="hud-nv">Nv ${esc(m.nivel)}</span></span>
      <div class="barra mini">
        <div class="fill" style="width:${pct(m.hp, m.hp_maximo)}%;background:${cor}"></div>
        <span class="barra-label">${esc(m.hp)}/${esc(m.hp_maximo)}</span>
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

// Moveset do músico selecionado no rodapé (alimentado pelo `aoSelecionar`).
function atualizarMovesHud(membro) {
  const el = $("#moves-hud");
  if (!el) return;
  const moves = (membro && membro.moves) || [];
  el.innerHTML = moves.map((mv, i) =>
    `<b>${i + 1}</b> ${esc(mv.nome)}${mv.mult > 1 ? ` <span class="mv-mult">×${esc(mv.mult)}</span>` : ""}`
  ).join(" · ");
}

// Aviso do golpe especial no rodapé (alimentado pelo `aoLuta` da batalha).
function atualizarEspecialHint(info) {
  const el = $("#especial-hint");
  if (!el) return;
  if (info.especialDisponivel) {
    el.textContent = "⚡ ESPECIAL PRONTO — aperte ESPAÇO!";
    el.classList.add("pronto");
  } else {
    el.textContent = info.perfeitosSeguidos > 0 ? `⚡ Perfeitos: ${info.perfeitosSeguidos}/4` : "";
    el.classList.remove("pronto");
  }
}

// ── Fim de batalha: telas ricas de vitória (drop) e derrota (bloqueio) ──────
async function aplicarFim(resultado, venue) {
  if (resultado === "vitoria") {
    const res = await window.pywebview.api.concluir_venue(venue.id);
    mostrarVitoria(res, venue);
  } else {
    const res = await window.pywebview.api.registrar_derrota(venue.id);
    mostrarDerrota(res, venue);
  }
}

function mostrarVitoria(res, venue) {
  const caixa = $("#fim-caixa");
  if (!res || res.ok === false) {
    const msg = res && res.erro ? res.erro.mensagem : "erro ao concluir a venue";
    caixa.innerHTML = `<h2>🏆 Vitória!</h2><p class="fim-aviso">⚠️ ${esc(msg)}</p>
      <div class="menu-opcoes"><button id="btn-fim-mapa">🗺 Voltar ao mapa</button></div>`;
  } else {
    const final = venue.id === "arena";
    const drop = res.drop;
    const banda = (batalhaHandle && batalhaHandle.batalha.estado.banda) || [];
    const botoesMembros = drop ? banda.filter((m) => m.vivo).map((m) => {
      const pode = !drop.classes_permitidas ||
        drop.classes_permitidas.some((c) => String(c).toLowerCase() === m.tipo);
      return `<button data-membro="${esc(m.id)}" data-tipo="${esc(drop.tipo)}"
                ${pode ? "" : "disabled"}>${esc(m.nome)}</button>`;
    }).join("") : "";
    caixa.innerHTML = `
      <h2>${final ? "🏆 VITÓRIA FINAL!" : "🏆 Vitória!"}</h2>
      <p>${final ? "O Empresário caiu. A banda é LENDÁRIA. 🤘"
                 : `Vocês detonaram em <b>${esc(venue.nome)}</b>!`}</p>
      <p class="fim-xp">+${esc(res.xp_ganho)} XP pra cada membro</p>
      ${drop ? `
        <div class="fim-drop">
          <div class="drop-nome">🎁 ${esc(drop.nome)}</div>
          <div class="drop-desc">${esc(drop.descricao || "")}</div>
          <div class="drop-desc">Escolha quem fica com o item:</div>
        </div>
        <div class="fim-membros">${botoesMembros}</div>
        <p id="fim-aviso" class="fim-aviso"></p>` : ""}
      <div class="menu-opcoes">
        <button id="btn-fim-mapa">🗺 ${drop ? "Deixar pra trás e voltar" : "Voltar ao mapa"}</button>
      </div>`;
    caixa.querySelectorAll(".fim-membros button").forEach((b) => {
      b.addEventListener("click", () => aplicarDropEm(b));
    });
  }
  caixa.querySelector("#btn-fim-mapa").addEventListener("click", fecharFimEVoltar);
  $("#fim-overlay").classList.add("aberto");
}

async function aplicarDropEm(botao) {
  const res = await window.pywebview.api.aplicar_drop({
    tipo: botao.dataset.tipo, indice: Number(botao.dataset.membro),
  });
  const aviso = $("#fim-aviso");
  if (!res || res.ok === false) {
    if (aviso) aviso.textContent = `⚠️ ${res && res.erro ? res.erro.mensagem : "não deu"}`;
    return;                                  // deixa tentar outro membro
  }
  if (aviso) {
    aviso.textContent = `✅ ${res.item} ${res.aplicado === "equipado" ? "equipado em" : "guardado com"} ${res.musico.nome}!`;
  }
  document.querySelectorAll(".fim-membros button").forEach((b) => { b.disabled = true; });
  const btn = $("#btn-fim-mapa");
  if (btn) btn.textContent = "🗺 Voltar ao mapa";
}

function mostrarDerrota(res, venue) {
  const caixa = $("#fim-caixa");
  const ok = res && res.ok !== false;
  caixa.innerHTML = `
    <h2>💀 Derrota</h2>
    <p class="fim-derrota-info">A banda foi nocauteada em <b>${esc(venue.nome)}</b>.<br>
      🚫 Venue bloqueada por <b>${esc(ok ? res.bloqueada_seg : "?")}s</b>.<br>
      📉 Fama da banda agora: <b>${esc(ok ? res.fama_banda : "?")}</b>.</p>
    <div class="menu-opcoes"><button id="btn-fim-mapa">🗺 Voltar ao mapa</button></div>`;
  caixa.querySelector("#btn-fim-mapa").addEventListener("click", fecharFimEVoltar);
  $("#fim-overlay").classList.add("aberto");
}

async function fecharFimEVoltar() {
  $("#fim-overlay").classList.remove("aberto");
  await abrirOverworld();
}

// ── Menu de pausa (Esc na batalha) ──────────────────────────────────────────
function aoPausar() {
  $("#pausa-overlay").classList.add("aberto");
}
function retomarBatalha() {
  $("#pausa-overlay").classList.remove("aberto");
  if (batalhaHandle) batalhaHandle.batalha.retomar();
}
async function reiniciarBatalha() {
  $("#pausa-overlay").classList.remove("aberto");
  if (venueAtual) await entrarNaVenue(venueAtual);   // boss volta cheio
}
function sairProMenuPrincipal() {
  $("#pausa-overlay").classList.remove("aberto");
  if (batalhaHandle) { batalhaHandle.desligar(); batalhaHandle = null; }
  venueAtual = null;
  mostrarTela("tela-menu");
}

// ── Menu de equipamento (Tab na van — F3.6; só no mapa, nunca em batalha) ───
let equipBanda = null;      // último DTO de obter_equipamento
let equipSel = 0;           // membro selecionado no menu

function equipAberto() {
  return $("#equip-overlay").classList.contains("aberto");
}

async function abrirEquipamento() {
  const res = await window.pywebview.api.obter_equipamento();
  if (!res || res.ok === false) {
    avisoOverworld(`⚠️ ${res && res.erro ? res.erro.mensagem : "equipamento indisponível"}`);
    return;
  }
  equipBanda = res.banda;
  if (equipSel >= equipBanda.length) equipSel = 0;
  renderEquipamento("");
  $("#equip-overlay").classList.add("aberto");
}

function fecharEquipamento() {
  $("#equip-overlay").classList.remove("aberto");
}

function renderEquipamento(aviso) {
  const membros = $("#equip-membros");
  membros.innerHTML = equipBanda.map((m, i) =>
    `<button data-i="${i}" class="${i === equipSel ? "ativo" : ""}">${esc(m.nome)}</button>`).join("");
  membros.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => { equipSel = Number(b.dataset.i); renderEquipamento(""); }));

  const m = equipBanda[equipSel];
  const podeEquipar = (it) => it.equipavel &&
    (!it.classes_permitidas || it.classes_permitidas.some((c) => String(c).toLowerCase() === m.tipo));
  const itemHtml = (it, acao) => `
    <div class="equip-item">
      <div class="equip-info">
        <div class="equip-nome">${esc(it.nome)}</div>
        <div class="equip-desc">${esc(it.descricao || "")}</div>
      </div>
      ${it.equipavel ? `<span class="equip-bonus">+${esc(it.bonus)} ${esc(it.atributo)}</span>` : ""}
      ${acao}
    </div>`;
  const painel = $("#equip-painel");
  painel.innerHTML = `
    <div class="equip-secao">Equipado (${m.equipados.length}/${esc(m.slots)})</div>
    ${m.equipados.length
      ? m.equipados.map((it) => itemHtml(it, `<button data-deseq="${esc(it.nome)}">Desequipar</button>`)).join("")
      : `<div class="equip-item vazio">nenhum item equipado</div>`}
    <div class="equip-secao">Inventário</div>
    ${m.inventario.length
      ? m.inventario.map((it) => itemHtml(it,
          it.equipavel ? `<button data-eq="${esc(it.nome)}" ${podeEquipar(it) ? "" : "disabled"}>Equipar</button>` : "")).join("")
      : `<div class="equip-item vazio">inventário vazio</div>`}`;
  painel.querySelectorAll("[data-eq]").forEach((b) =>
    b.addEventListener("click", () => acaoEquipar("equipar", b.dataset.eq)));
  painel.querySelectorAll("[data-deseq]").forEach((b) =>
    b.addEventListener("click", () => acaoEquipar("desequipar", b.dataset.deseq)));
  $("#equip-aviso").textContent = aviso || "";
}

async function acaoEquipar(metodo, nome) {
  const res = await window.pywebview.api[metodo]({ indice: equipBanda[equipSel].id, nome });
  if (!res || res.ok === false) {
    renderEquipamento(`⚠️ ${res && res.erro ? res.erro.mensagem : "não deu"}`);
    return;
  }
  equipBanda = res.banda;
  renderEquipamento(metodo === "equipar" ? `✅ ${nome} equipado!` : `↩️ ${nome} voltou pro inventário.`);
}

// ── Menu principal ──────────────────────────────────────────────────────────
function avisoMenu(texto) {
  const el = $("#menu-aviso");
  if (el) el.textContent = texto || "";
}

async function novoJogo() {
  avisoMenu("");
  await window.pywebview.api.criar_banda(COMPOSICAO_DEMO);
  await window.pywebview.api.nova_campanha();
  await abrirOverworld();
}

async function continuarJogo() {
  const res = await window.pywebview.api.carregar("slot1");
  if (!res || res.ok === false) {
    avisoMenu(`⚠️ ${res && res.erro ? res.erro.mensagem : "nenhum save encontrado"}`);
    return;
  }
  await abrirOverworld();
}

function sairDoJogo() {
  window.pywebview.api.sair();   // fecha a janela do pywebview
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

// ── Controlador de telas (menu ↔ overworld ↔ batalha) ───────────────────────
function mostrarTela(id) {
  // Trocar de tela sempre fecha os overlays modais (pausa/fim) — evita
  // sobra de overlay quando o fluxo sai da batalha por outro caminho.
  document.querySelectorAll(".overlay-modal").forEach((o) => o.classList.remove("aberto"));
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
  atualizarEspecialHint({ especialDisponivel: false, perfeitosSeguidos: 0 });
  log(`🎤 <b>${esc(venue.nome)}</b> — encare <b>${esc(venue.capanga.nome)}</b>! Escolha um músico e toque.`);

  if (batalhaHandle) batalhaHandle.desligar();
  batalhaHandle = window.Batalha.montar({
    canvas: $("#batalha-canvas"),
    api: window.pywebview.api,
    estado,
    corPorTipo: COR_POR_TIPO,
    aoAtualizar: atualizarHud,
    aoLog: (html) => log(html),
    aoFim: (res) => aplicarFim(res, venue),
    aoPausar,
    aoLuta: atualizarEspecialHint,
    aoSelecionar: atualizarMovesHud,
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
  $("#btn-novo-jogo").addEventListener("click", novoJogo);
  $("#btn-continuar").addEventListener("click", continuarJogo);
  $("#btn-sair").addEventListener("click", sairDoJogo);
  $("#btn-pausa-voltar").addEventListener("click", retomarBatalha);
  $("#btn-pausa-reiniciar").addEventListener("click", reiniciarBatalha);
  $("#btn-pausa-menu").addEventListener("click", sairProMenuPrincipal);
  $("#btn-salvar").addEventListener("click", salvar);
  $("#btn-carregar").addEventListener("click", carregar);
  $("#btn-voltar-mapa").addEventListener("click", voltarAoMapa);
  // Esc com o menu de pausa aberto = Voltar (a batalha ignora teclas na pausa).
  // Tab no mapa abre/fecha o menu de equipamento (van) — nunca em batalha.
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && $("#pausa-overlay").classList.contains("aberto")) {
      e.preventDefault();
      retomarBatalha();
    } else if (e.key === "Tab") {
      if (equipAberto()) { e.preventDefault(); fecharEquipamento(); }
      else if ($("#tela-overworld").classList.contains("ativa")) {
        e.preventDefault();
        abrirEquipamento();
      }
    } else if (e.key === "Escape" && equipAberto()) {
      e.preventDefault();
      fecharEquipamento();
    }
  });
}

// Boot do modo história: cai no menu principal (Novo jogo / Continuar / Sair).
window.addEventListener("pywebviewready", () => {
  bind();
  mostrarTela("tela-menu");
});

// Fallback se o evento já tiver disparado antes deste script carregar.
if (window.pywebview) {
  bind();
}
