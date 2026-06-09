// Frontend mínimo F2.3 — render do EstadoDTO + ações por clique.
// O ritmo ainda é placeholder: por enquanto manda contagem perfeita fixa.
// (O minigame Web Audio + rAF entra na Fase 3.)

const $ = (sel) => document.querySelector(sel);

const COMPOSICAO_DEMO = [
  { tipo: "guitarrista", nome: "Aldric", forca: 14, ego: 0 },
  { tipo: "vocalista",   nome: "Selene", folego: 50, inteligencia: 12 },
  { tipo: "baterista",   nome: "Kael",   agilidade: 12, chance_critico: 0.3 },
  { tipo: "baixista",    nome: "Paul",   forca: 12, fe: 20 },
];

// Placeholder de ritmo (Fase 3 substitui pelo resultado real do minigame).
const RITMO_PLACEHOLDER = { acertos: 9, total_notas: 10, combo_max: 6 };

let estadoAtual = null;

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

  if (estado.fim_de_jogo) {
    log(estado.resultado === "vitoria"
      ? "🏆 <span class='refrao'>Vitória!</span> O Empresário caiu — a banda fez história."
      : "💀 <span class='crit'>Derrota.</span> A banda foi nocauteada.");
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
  const res = await window.pywebview.api.executar_acao({
    indice,
    ritmo: RITMO_PLACEHOLDER,
  });
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

function bind() {
  $("#btn-banda-demo").addEventListener("click", montarBandaDemo);
  $("#btn-turno-inimigo").addEventListener("click", turnoInimigo);
  $("#btn-salvar").addEventListener("click", salvar);
  $("#btn-carregar").addEventListener("click", carregar);
}

// A API só existe depois que o pywebview termina de injetar a ponte.
window.addEventListener("pywebviewready", () => {
  bind();
  window.pywebview.api.obter_estado().then(render);
});

// Fallback se o evento já tiver disparado antes deste script carregar.
if (window.pywebview) {
  bind();
}
