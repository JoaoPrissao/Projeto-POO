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

// ── HUD da batalha (barras de vida + energia estilo MK) ─────────────────────
function barraMembro(m) {
  const cor = COR_POR_TIPO[m.tipo] || "var(--acento)";
  return `
    <div class="hud-membro${m.vivo ? "" : " ko"}">
      <span class="hud-nome">${esc(m.nome)}<span class="hud-nv">Nv ${esc(m.nivel)}</span>${m.cansado ? `<span class="hud-cansado">💤</span>` : ""}</span>
      <div class="barra mini">
        <div class="fill" style="width:${pct(m.hp, m.hp_maximo)}%;background:${cor}"></div>
        <span class="barra-label">${esc(m.hp)}/${esc(m.hp_maximo)}</span>
      </div>
      <div class="barra energia">
        <div class="fill" style="width:${pct(m.energia, m.energia_maxima)}%"></div>
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

// ── Painel de golpes (F3.8): 3 botões por músico selecionado ────────────────
// Estrelas de dificuldade = densidade do chart do minigame.
const DIFICULDADE_CHART = {
  facil: "★", padrao: "★★", constante: "★★", sustentada: "★★", rapido: "★★",
  sincopado: "★★", pesado: "★★★", denso: "★★★", caotico: "★★★",
};
let membroSelecionado = null;   // último membro emitido pelo `aoSelecionar`
let lutaInfo = { turno: "banda" };

function atualizarMovesHud(membro) {
  membroSelecionado = membro;
  const el = $("#moves-hud");
  if (!el) return;
  const moves = (membro && membro.moves) || [];
  if (!moves.length) { el.innerHTML = ""; return; }
  const vezDoVilao = lutaInfo.turno === "vilao";
  el.innerHTML = moves.map((mv, i) => {
    const semEnergia = mv.custo != null && membro.energia != null && membro.energia < mv.custo;
    const off = vezDoVilao || membro.cansado || semEnergia;
    return `
      <button class="move-btn" data-move="${i}" ${off ? "disabled" : ""}
              title="${semEnergia ? "sem energia" : membro.cansado ? "cansado" : ""}">
        <b>${i + 1}</b> ${esc(mv.nome)}
        <span class="mv-meta">×${esc(mv.mult)} · ⚡${esc(mv.custo ?? 0)} · ${DIFICULDADE_CHART[mv.chart] || "★★"}${mv.cansa ? " · 💤" : ""}</span>
      </button>`;
  }).join("");
  el.querySelectorAll(".move-btn").forEach((b) =>
    b.addEventListener("click", () => {
      if (batalhaHandle) batalhaHandle.batalha.atacar(Number(b.dataset.move));
    }));
}

// Rodapé alimentado pelo `aoLuta`: turno (F3.8) + golpe especial.
function atualizarLuta(info) {
  lutaInfo = info;
  const turnoEl = $("#turno-hint");
  if (turnoEl) {
    turnoEl.textContent = info.fase !== "luta" ? ""
      : info.turno === "vilao" ? "🎤 Vez do vilão…" : "🎸 Sua vez!";
    turnoEl.classList.toggle("vilao", info.turno === "vilao");
  }
  atualizarMovesHud(membroSelecionado);   // habilita/desabilita os botões
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
      <p class="fim-xp">+${esc(res.xp_ganho)} XP pra cada membro · 💰 +${esc(res.cache_ganho || 0)} de cachê</p>
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

// ── Menu de pausa (Esc na batalha E no mapa — F3.8) ─────────────────────────
// `pausaContexto` adapta os botões: "Reiniciar" só faz sentido em batalha.
let pausaContexto = "batalha";

function aoPausar() {                      // Esc dentro da batalha (batalha.js)
  pausaContexto = "batalha";
  $("#btn-pausa-reiniciar").hidden = false;
  $("#pausa-overlay").classList.add("aberto");
}
function pausarMapa() {                    // Esc no overworld (bug F3.8)
  pausaContexto = "mapa";
  if (owHandle) owHandle.mundo.parar();    // congela o passeio…
  pararRegen();                            // …e a cura passiva
  $("#btn-pausa-reiniciar").hidden = true;
  $("#pausa-overlay").classList.add("aberto");
}
function retomarPausa() {
  $("#pausa-overlay").classList.remove("aberto");
  if (pausaContexto === "mapa") {
    if (owHandle) owHandle.mundo.iniciar();
    iniciarRegen();
  } else if (batalhaHandle) {
    batalhaHandle.batalha.retomar();
  }
}
async function reiniciarBatalha() {
  $("#pausa-overlay").classList.remove("aberto");
  if (venueAtual) await entrarNaVenue(venueAtual);   // boss volta cheio
}
function sairProMenuPrincipal() {
  $("#pausa-overlay").classList.remove("aberto");
  if (batalhaHandle) { batalhaHandle.desligar(); batalhaHandle = null; }
  if (owHandle) { owHandle.desligar(); owHandle = null; }   // mapa não fica ouvindo teclas
  venueAtual = null;
  pararRegen();
  mostrarTela("tela-menu");
}

// ── Regen passivo na estrada (F3.7): tick enquanto o mapa está aberto ───────
let regenTimer = null;

function iniciarRegen() {
  pararRegen();
  regenTimer = setInterval(() => {
    // Defensivo: só cura com o mapa na tela (a taxa é capada no backend).
    if ($("#tela-overworld").classList.contains("ativa")) {
      window.pywebview.api.regenerar_banda(5);
    }
  }, 5000);
}
function pararRegen() {
  if (regenTimer) { clearInterval(regenTimer); regenTimer = null; }
}

// Status do mapa: cachê + fama (F3.7).
function atualizarStatusMapa() {
  const el = $("#ow-status");
  if (el && campanhaAtual) {
    el.textContent = `💰 ${campanhaAtual.cache ?? 0} · ⭐ ${campanhaAtual.fama_banda ?? 0}`;
  }
}

// ── Menu de equipamento (Tab na van — F3.6; só no mapa, nunca em batalha) ───
// F3.8: a van é só ARMAZENAMENTO (equipar/usar/guardar) — a loja virou um
// ponto do mapa (🏪), com overlay próprio mais abaixo.
const LOJA_CATALOGO = [   // espelha LOJA da ponte (tipo → preço)
  { tipo: "energetico", nome: "Energético", desc: "Cura 50 de HP", preco: 40 },
  { tipo: "cerveja", nome: "Cerveja", desc: "Restaura 30 de energia", preco: 25 },
];
let equipBanda = null;      // último DTO de obter_equipamento
let equipSel = 0;           // membro selecionado no menu
let equipCache = 0;         // cachê atual (mostrado na van)

function equipAberto() {
  return $("#equip-overlay").classList.contains("aberto");
}

async function abrirEquipamento() {
  const res = await window.pywebview.api.obter_equipamento();
  if (!res || res.ok === false) {
    avisoOverworld(`⚠️ ${res && res.erro ? res.erro.mensagem : "equipamento indisponível"}`);
    return;
  }
  const camp = await window.pywebview.api.obter_campanha();
  equipCache = (camp && camp.cache) || 0;
  equipBanda = res.banda;
  if (equipSel >= equipBanda.length) equipSel = 0;
  renderEquipamento("");
  $("#equip-overlay").classList.add("aberto");
}

// Recarrega banda + cachê depois de comprar/usar/equipar (estado no backend).
async function recarregarEquipamento(aviso) {
  const res = await window.pywebview.api.obter_equipamento();
  if (res && res.ok !== false) equipBanda = res.banda;
  renderEquipamento(aviso || "");
}

function fecharEquipamento() {
  $("#equip-overlay").classList.remove("aberto");
}

function renderEquipamento(aviso) {
  $("#equip-cache").textContent = `💰 ${equipCache}`;
  const membros = $("#equip-membros");
  membros.innerHTML = equipBanda.map((m, i) =>
    `<button data-i="${i}" class="${i === equipSel ? "ativo" : ""}">${esc(m.nome)} ♥${esc(m.hp)}</button>`).join("");
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
          it.equipavel
            ? `<button data-eq="${esc(it.nome)}" ${podeEquipar(it) ? "" : "disabled"}>Equipar</button>`
            : `<button data-usar="${esc(it.nome)}">Usar</button>`)).join("")
      : `<div class="equip-item vazio">inventário vazio</div>`}`;
  painel.querySelectorAll("[data-eq]").forEach((b) =>
    b.addEventListener("click", () => acaoEquipar("equipar", b.dataset.eq)));
  painel.querySelectorAll("[data-deseq]").forEach((b) =>
    b.addEventListener("click", () => acaoEquipar("desequipar", b.dataset.deseq)));
  painel.querySelectorAll("[data-usar]").forEach((b) =>
    b.addEventListener("click", () => acaoUsarItem(b.dataset.usar)));
  $("#equip-aviso").textContent = aviso || "";
}

async function acaoUsarItem(nome) {
  const res = await window.pywebview.api.usar_item({ indice: equipBanda[equipSel].id, nome });
  if (!res || res.ok === false) {
    renderEquipamento(`⚠️ ${res && res.erro ? res.erro.mensagem : "não deu"}`);
    return;
  }
  await recarregarEquipamento(
    `✨ ${res.item} usado — ${res.musico.nome} com ${res.musico.hp}/${res.musico.hp_maximo} de HP.`);
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

// ── Loja do mapa (F3.8): ponto 🏪 no overworld — W perto dela abre aqui ─────
let lojaBanda = null;
let lojaSel = 0;
let lojaCache = 0;

function lojaAberta() {
  return $("#loja-overlay").classList.contains("aberto");
}

async function abrirLoja() {
  const res = await window.pywebview.api.obter_equipamento();
  if (!res || res.ok === false) {
    avisoOverworld(`⚠️ ${res && res.erro ? res.erro.mensagem : "loja indisponível"}`);
    return;
  }
  const camp = await window.pywebview.api.obter_campanha();
  lojaCache = (camp && camp.cache) || 0;
  lojaBanda = res.banda;
  if (lojaSel >= lojaBanda.length) lojaSel = 0;
  renderLoja("");
  $("#loja-overlay").classList.add("aberto");
}

function fecharLoja() {
  $("#loja-overlay").classList.remove("aberto");
}

function renderLoja(aviso) {
  $("#loja-cache").textContent = `💰 ${lojaCache}`;
  const membros = $("#loja-membros");
  membros.innerHTML = lojaBanda.map((m, i) =>
    `<button data-i="${i}" class="${i === lojaSel ? "ativo" : ""}">${esc(m.nome)} ♥${esc(m.hp)}</button>`).join("");
  membros.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => { lojaSel = Number(b.dataset.i); renderLoja(""); }));

  const m = lojaBanda[lojaSel];
  $("#loja-itens").innerHTML = `
    <div class="equip-secao">Compra pra ${esc(m.nome)}</div>
    ${LOJA_CATALOGO.map((p) => `
      <div class="equip-item">
        <div class="equip-info">
          <div class="equip-nome">${esc(p.nome)}</div>
          <div class="equip-desc">${esc(p.desc)}</div>
        </div>
        <span class="equip-bonus">💰 ${esc(p.preco)}</span>
        <button data-comprar="${esc(p.tipo)}" ${lojaCache >= p.preco ? "" : "disabled"}>Comprar</button>
      </div>`).join("")}`;
  $("#loja-itens").querySelectorAll("[data-comprar]").forEach((b) =>
    b.addEventListener("click", () => acaoComprar(b.dataset.comprar)));
  $("#loja-aviso").textContent = aviso || "";
}

async function acaoComprar(tipo) {
  const res = await window.pywebview.api.comprar({ tipo, indice: lojaBanda[lojaSel].id });
  if (!res || res.ok === false) {
    renderLoja(`⚠️ ${res && res.erro ? res.erro.mensagem : "não deu"}`);
    return;
  }
  lojaCache = res.cache;
  if (campanhaAtual) campanhaAtual.cache = res.cache;   // HUD do mapa coerente
  atualizarStatusMapa();
  const eq = await window.pywebview.api.obter_equipamento();
  if (eq && eq.ok !== false) lojaBanda = eq.banda;
  renderLoja(`🛒 ${res.item} comprado!`);
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
    canvas, venues: camp.venues, itens: camp.itens, loja: camp.loja,
    vanEstagio: camp.van_estagio,  // MAP-01 (Phase 1): estágio da van vem do backend
    corTipo: "guitarrista",
    inicioX: camp.posicao,
    aoEntrar: entrarNaVenue,
    aoColetar: coletarItemNoMapa,
    aoLoja: abrirLoja,            // F3.8: W perto do 🏪 abre a loja
  });
  window.__overworld = owHandle;

  const faltam = camp.venues.filter((v) => !v.concluida).length;
  avisoOverworld(faltam > 0 ? `${faltam} venue(s) restante(s) na turnê.` : "Turnê completa! 🤘");
  atualizarStatusMapa();
  iniciarRegen();          // F3.7: HP regenera devagar na estrada
}

// Entrar numa venue → arma o show no backend e monta a arena de batalha.
async function entrarNaVenue(venue) {
  pararRegen();            // regen é só na estrada (nunca em batalha)
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
  atualizarLuta({ fase: "intro", turno: "banda", especialDisponivel: false, perfeitosSeguidos: 0 });
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
    aoLuta: atualizarLuta,
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
  $("#btn-pausa-voltar").addEventListener("click", retomarPausa);
  $("#btn-pausa-reiniciar").addEventListener("click", reiniciarBatalha);
  $("#btn-pausa-menu").addEventListener("click", sairProMenuPrincipal);
  $("#btn-salvar").addEventListener("click", salvar);
  $("#btn-carregar").addEventListener("click", carregar);
  $("#btn-voltar-mapa").addEventListener("click", voltarAoMapa);
  $("#btn-loja-fechar").addEventListener("click", fecharLoja);
  // Esc: fecha o que estiver aberto (pausa/van/loja); no mapa "limpo" PAUSA
  // (bug F3.8 — antes só a batalha pausava). Tab abre/fecha a van — só no mapa.
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && $("#pausa-overlay").classList.contains("aberto")) {
      e.preventDefault();
      retomarPausa();
    } else if (e.key === "Tab") {
      if (equipAberto()) { e.preventDefault(); fecharEquipamento(); }
      else if ($("#tela-overworld").classList.contains("ativa") && !lojaAberta()) {
        e.preventDefault();
        abrirEquipamento();
      }
    } else if (e.key === "Escape" && equipAberto()) {
      e.preventDefault();
      fecharEquipamento();
    } else if (e.key === "Escape" && lojaAberta()) {
      e.preventDefault();
      fecharLoja();
    } else if (e.key === "Escape" && $("#tela-overworld").classList.contains("ativa")) {
      e.preventDefault();
      pausarMapa();
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
