# PROGRESS — RPG Manager (banda de rock)

## F3.5a — Tela de batalha estilo Mortal Kombat: layout + seleção + ataque (10/06/2026)

### Contexto
A F3.4 botou o combate-RPG no backend sem tocar na UI. A F3.5 (tela MK completa) é grande demais → **dividida**: a **5a** entrega o esqueleto jogável da arena; a **5b** traz intro, auto-ataque por tempo/atordoamento, especial, menu de pausa, menu principal e telas de vitória(drop)/derrota(bloqueio). Decisões: setas/AD selecionam, **Enter** ataca, espaço=especial (5b), Esc=pausa (5b); Save/Load saem da batalha (na 5a vão pro HUD do mapa).

### O que mudou (só frontend; backend/ponte intocados)
- **`frontend/js/batalha.js` (novo):** motor da arena com shell injetável (ctx/api/jogarRitmo) — mesmo padrão do overworld/ritmo. Banda à **esquerda** (cada um com "instrumento", encarando o vilão), vilão à **direita**; render placeholder em canvas (pixel art é F3.7, troca só `desenhar()`). `selecionar(dir)`/`selecionarIndice` andam só entre vivos; `atacar()` abre o minigame de ritmo (modal atual) → `executar_acao` → aplica estado → **vilão revida 1×** (`turno_inimigo`); `aoFim` no fim. `montar()` liga canvas + teclado (setas/AD, Enter, clique) + `RitmoMinigame` + ponte; expõe `window.__batalha`.
- **`frontend/index.html`:** `#tela-show` virou a arena — `#batalha-canvas` + HUD em DOM (`#hud-banda` topo-esq., `#hud-boss` topo-dir.). **Removidos** os botões de turno/salvar/carregar/banda-demo da batalha; **Salvar/Carregar movidos pro `#overworld-hud`** (mapa). Inclui `batalha.js`.
- **`frontend/css/estilo.css`:** `.arena-wrap` + `#batalha-canvas`; HUD sobreposto (`.hud-batalha`/`.hud-esq`/`.hud-dir`, mini-barras por membro com KO esmaecido, barra grossa do boss); rodapé com dica/log; `#ow-acoes` no mapa.
- **`frontend/js/main.js`:** `entrarNaVenue` monta a arena (em vez dos cards); `atualizarHud(estado)` pinta as barras; `aplicarFim` (vitória→`concluir_venue`+volta; derrota→volta — telas ricas são 5b). Save/Load ligados no HUD do mapa; removidas as funções de card (`render/renderBanda/executarAcao/turnoInimigo/atualizarBotoes`).
- **`frontend/test/mock-api.js`:** `executar_acao`/`turno_inimigo` agora mexem no HP (boss/membro) — mock fiel pro HUD refletir mudança.

### Testes (padrão de harness mantido)
- **`frontend/test/batalha.harness.html` (novo): 20/20** — asserts determinísticos (injeta `jogarRitmo` fake + api fake): init banda+boss+seleção; setas andam só entre vivos (com wrap) e pulam KO; Enter chama `executar_acao` com o índice certo e baixa o HP; vilão revida; Esc não gasta a vez; vitória/derrota chamam `aoFim`; reentrância (2º ataque ignorado enquanto ocupado); `aoAtualizar` recebe o estado novo.
- **Sem regressão:** overworld **16/16**, ritmo **9/9**, **pytest 206** (5a não toca backend).
- **Smoke do `index.html` (Playwright + mock):** boot abre o mapa (canvas ok, `criar_banda`+`obter_campanha`), andar+W entra na venue → troca pra arena (canvas 800×360, boss "Capanga do Bar" 90/90, HUD populado, `entrar_no_show` chamado).

### Ajustes pós-feedback visual do João (10/06)
Depois de testar a arena, o João apontou correções — aplicadas ainda na 5a:
- **Layout de palco** (banda de rock): vocal na frente no microfone, guitarra/baixo nas laterais, bateria atrás (antes ficavam amontoados). `PALCO`/`layoutBanda` em `batalha.js`, desenho de trás-pra-frente.
- **Barras compactas + nível:** boss 26→18px, membros 12px, chip `Nv X` por membro (antes ocupavam muito e não mostravam nível).
- **Legenda de combate:** `aoLog` mostra cada golpe (`🎸 Aldric → Capanga: 54 🔥` / `🎤 Capanga → Selene: 28`).
- **Rebalance dos vilões:** HP 90/150/280 → **180/340/600**, dano 10/16/24 → **18/28/40** (estavam fáceis demais e davam pouco dano). Em `campanha.py` + mock.
- **Respiro no contra-ataque:** `esperar(~0.9s)` injetável antes do `turno_inimigo` (antes o vilão batia no mesmo instante). O auto-ataque por tempo real (2–3s) é a 5b.
- Harness atualizado (injeta `esperar` instantâneo): **batalha 20/20**, overworld 16/16, ritmo 9/9, pytest 206.

Feedback que virou fase própria (decidido 10/06): **menu de pausa (Esc)** e **auto-ataque por tempo** → F3.5b; **equipar itens (Tab) + movesets que mudam com o equipamento + charts variados** → fase nova; **recuperação (regen na van + loja com cachê)** → fase nova. Economia confirmada: **cachê por show**.

### Pendente de validação visual (usuário)
`.\.venv\Scripts\python.exe bridge\app.py` → entrar numa venue abre a **arena MK** (banda no palco, vilão dir., barras compactas no topo com nível); setas/AD escolhem, Enter abre o ritmo, acertar baixa o HP do vilão e ele revida ~0.9s depois (com legenda); vencer volta ao mapa. Salvar/Carregar no HUD do mapa.

### Nada commitado
✓ (na branch `modo-historia`)

### Próxima tarefa
**F3.5b** (priorizada pelo João) — intro coreografada, **auto-ataque por tempo (2–3s, reinicia a cada hit)** + atordoamento visual, especial (espaço), **menu de pausa no Esc** (voltar/reiniciar/menu principal), **menu principal** (Novo jogo/Continuar/Sair), telas de vitória (drop→escolher membro) e derrota (bloqueio+fama). Depois: equipamento+movesets (Tab) e recuperação+van/loja (cachê).

---

## F3.4 — Combate no backend: stun, especial, XP/drop, fama dupla, bloqueio (09/06/2026)

### Contexto
O João pediu um RPG de verdade (batalha estilo Mortal Kombat, vilões mais duros, atordoamento por combo, golpe especial, XP/drop ao vencer, fama, van, NPCs, pixel art). É grande demais p/ uma fase → virou roadmap **F3.4→F3.8**. Decisões: minigame de ritmo modal mantido (vilão contra-ataca *entre* ataques); **F3.4 = só domínio** (UI de batalha intocada, redesenho MK é F3.5); fama dupla + cooldown curto em segundos; perfeito (todas as notas) atordoa, 4 perfeitos seguidos liberam o especial.

### O que mudou (tudo no backend + ponte; nenhuma mudança de UI)
- **`backend/ritmo.py`:** `Ritmo.perfeito()` (acertou todas as notas) — gatilho do atordoamento.
- **`backend/show.py`:** `Empresario` ganha estado de **atordoamento** (`atordoar/esta_atordoado/acordar`, persistido no `to_dict`). `Show` ganha `mult_banda` (fama escala o dano), contador de **perfeitos seguidos** (`especial_disponivel` em 4), `ataque_especial()` (todos atacam ×2.0, zera a sequência → `EspecialIndisponivelError` se indisponível) e `turno_inimigo()` que **perde a vez** quando o vilão está atordoado (consome o stun). `acao_musico` agora devolve `perfeito/atordoado/perfeitos_seguidos/especial_disponivel`.
- **`backend/campanha.py`:** venues com `fama` (1/2/3), `xp_recompensa`, `drop` e capangas mais duras (90/150/280 HP). Estado novo **persistido**: `fama_banda` (sobe ao vencer, cai ao perder) e `bloqueios` (`{venue_id: timestamp}`). Métodos: `get_recompensa`, `ganhar/perder_fama`, `mult_banda`, `bloquear_venue`/`venue_bloqueada`/`segundos_bloqueio` (**clock injetável** p/ teste), `registrar_derrota`. `concluir` virou idempotente (não dobra fama) e limpa o bloqueio.
- **`backend/excecoes.py`:** `EspecialIndisponivelError`, `VenueBloqueadaError`.
- **`bridge/api.py` (aditivo, id-based):** `ataque_especial()`, `aplicar_drop({tipo,indice})` (equipável→aplica bônus; consumível→inventário), `registrar_derrota(venue_id)`. `entrar_no_show` recusa venue bloqueada e injeta `mult_banda`. `concluir_venue` virou `{ok, campanha, xp_ganho, drop}` — dá XP a todos (idempotente) e descreve o drop. `obter_campanha` traz `fama_banda` + flags de bloqueio.
- **`frontend/test/mock-api.js`:** espelha o contrato F3.4 (novos métodos/campos). **Produção (`main.js`/`overworld.js`) intocada** — a tela de batalha só muda na F3.5.

### Testes (TDD)
- **`tests/test_show.py` (+13):** stun em perfeito, `turno_inimigo` consome o stun, streak sobe/zera, especial em 4, `ataque_especial` soma e zera (+ indisponível levanta), `mult_banda` escala, round-trip do atordoamento.
- **`tests/test_campanha.py` (+13):** fama/xp/drop nas venues, `get_recompensa`, ganhar/perder fama (piso 0), `concluir` dá fama idempotente, bloqueio com clock injetado (escala com fama, expira), `registrar_derrota`, round-trip preserva fama+bloqueios.
- **`tests/test_integracao_overworld.py` (+8):** especial via API, `concluir_venue` dá XP a todos + drop (idempotente), `aplicar_drop` melhora o membro (incompatível→ErroDTO), `registrar_derrota` bloqueia e impede entrar; **save/load preserva fama + bloqueio**.

### Contagem de testes
**206 pytest, 100% verdes** (+32) · **16/16 overworld** + **9/9 ritmo** (Playwright).

### Pendente de validação visual (usuário)
`.\.venv\Scripts\python.exe bridge\app.py` — o fluxo de batalha atual segue funcionando; os efeitos novos (stun/especial/drop/bloqueio) só ganham tela na **F3.5**.

### Nada commitado
✓ (na branch `modo-historia`)

### Próxima tarefa
**F3.5** — Tela de batalha estilo Mortal Kombat (layout, intro, menu de pausa, seleção por setas, relógio de contra-ataque, botão de especial, tela de derrota com bloqueio). Pixel art passou p/ **F3.7**.

---

## F3.3 — Campanha no backend autoritativo (09/06/2026)

### O que mudou (a turnê virou estado do domínio; save/load retoma a história)
A campanha (venues + itens + progresso) saiu do front e virou estado autoritativo do `GerenciadorJogo`, persistido no envelope de save.
- **`backend/campanha.py` (novo):** classe `Campanha` — defs de venues (`{id,x,nome,capanga:{nome,hp,dano}}`) e itens (`{id,x,tipo}`) + progresso (`concluidas`, `coletados`, `posicao`). `padrao()` (3 venues + 2 itens, espelha o que vivia no main.js), `listar_venues/itens` (com flags), `get_venue/get_item` (→ exceções), `concluir`, `coletar` (devolve o tipo), `get/set_posicao`, `esta_completa`, `to_dict/from_dict`.
- **`backend/excecoes.py`:** `CampanhaError`, `VenueInvalidaError`, `ItemMapaInvalidoError`.
- **`backend/gerenciador.py`:** campo `_campanha` + `iniciar_campanha()/get_campanha()`; `salvar()` inclui `"campanha"` no envelope e `carregar()` reconstrói via `Campanha.from_dict` (erros → `SaveCorrompidoError`). `persistencia.py` intocado (envelope já passa chaves extras).
- **`bridge/api.py`:** contrato agora id-based e autoritativo — `obter_campanha()`, `entrar_no_show(venue_id)` (capanga vem da campanha), `concluir_venue(id)`, `coletar_item({id})` (tipo vem da campanha + inventário via ItemFactory), `registrar_posicao(x)`. `_garantir_campanha()` espelha `_garantir_show()`.
- **`frontend/js/main.js`:** removida a `CAMPANHA`/`Set`s hardcoded. Boot lê `obter_campanha`; entrar usa `registrar_posicao` + `entrar_no_show(venue.id)`; coletar usa `coletar_item({id})`; vitória chama `concluir_venue`; voltar re-lê a campanha (reflete o progresso).
- **Combate intocado:** `Show`/`acao_musico`/`turno_inimigo`/`Empresario` sem mudança.

### Testes (TDD + harness mantido)
- **`tests/test_campanha.py` (novo, +14):** defaults, concluir/coletar, ids inválidos, `esta_completa`, posição, **round-trip to_dict/from_dict**.
- **`tests/test_integracao_overworld.py` (reescrito p/ id-based, 10):** `obter_campanha`, `entrar_no_show(id)`, `concluir_venue`, `coletar_item({id})`, `registrar_posicao` e o **teste-chave `test_save_load_retoma_a_campanha`** (concluídas/coletados/posição sobrevivem ao load).
- **`frontend/test/mock-api.js`:** estendido com os métodos de campanha (progresso mutável). **Smoke do `index.html` (Playwright):** boot lê a campanha do backend (venues bar/feira/arena), anda→`coletar_item({id:i1})`, W→`entrar_no_show("bar")` + `registrar_posicao`, vitória→`concluir_venue("bar")`, voltar→bar aparece concluída. Round-trip completo ✓.

### Contagem de testes
**174 pytest, 100% verdes** (+16) · **16/16 overworld** + **9/9 ritmo** (Playwright).

### Pendente de validação visual (usuário)
`.\.venv\Scripts\python.exe bridge\app.py` → vencer a 1ª venue, **Salvar**, fechar, reabrir, **Carregar** → venue continua marcada e a banda volta na posição salva.

### Nada commitado
✓ (na branch `modo-historia`)

### Próxima tarefa
**F3.4** — Pixel art (eu desenho): 4 integrantes (idle+andar), capangas, props/venue, itens, cenário.

---

## F3.2 — Modo história: scaffold do overworld + ponte p/ batalha (09/06/2026)

### Base travada
Antes de começar: tag `entrega-base-f3.1` no commit verde da F3.1 + branch de trabalho `modo-historia`. Sempre há uma versão submissível.

### O que mudou (duas telas alternadas, reuso máximo da batalha)
- **`frontend/js/overworld.js` (novo):** mundo side-scroll "lite" com game loop **injetável** (mesmo padrão do ritmo.js: `agora`/`agendarFrame`/`ctx`). Movimento horizontal A/D, câmera que segue, **sem física** (só AABB 1D). `pressionar/soltar` (teclado→ação), `passo(dt)` (núcleo determinístico), `interagir()` (W entra na venue mais próxima dentro do alcance), coleta de item por sobreposição. Render placeholder em canvas (retângulos coloridos; arte real é F3.4).
- **`bridge/api.py` (aditivo, domínio intocado):** `entrar_no_show({nome,hp,dano})` arma a capanga daquela venue (reusa `Empresario` + `iniciar_show`) e religa o `Show`; `coletar_item({tipo,indice})` adiciona item ao inventário de um músico via `ItemFactory`. Erros viram ErroDTO pelo `_ponte`.
- **`frontend/index.html` + `css/estilo.css`:** `#tela-overworld` (canvas) e `#tela-show` (a UI de batalha herdada); `.tela.ativa` alterna. App começa no mapa.
- **`frontend/js/main.js`:** controlador de telas + campanha provisória no front (3 venues, 2 itens — migra pro backend na F3.3). Andar→entrar dispara `entrar_no_show` e troca pra batalha; vencer marca a venue concluída e mostra "← Voltar ao mapa"; item pego chama `coletar_item` e mostra no HUD. `window.__overworld` exposto p/ harness dirigir o mundo sem rAF.

### Testes (padrão de harness mantido)
- **`tests/test_integracao_overworld.py` (novo, +8):** `entrar_no_show` (arma boss da venue, preserva banda, permite atacar, troca de venue reseta) e `coletar_item` (adiciona, índice padrão, tipo inválido/índice fora → ErroDTO). Serialização verificada.
- **`frontend/test/overworld.harness.html` (novo):** harness de browser determinístico (relógio injetado) — 15 asserts: anda/para, câmera segue/clampa, coleta item, entra na venue (W), W longe não entra, venue concluída não re-entra, loop real integra. **Playwright (MCP): 15/15 PASS.**
- **Smoke de integração do `main.js`** (mock-api + `__overworld`): boot abre o mapa → andar → `coletar_item` (HUD "🎁 Aldric pegou…") → W → troca pra `tela-show` com `entrar_no_show` payload certo e boss "Capanga do Bar". Validado via Playwright.
- **`frontend/test/mock-api.js`:** estendido com os métodos do modo história (criar_banda/entrar_no_show/coletar_item/…). Harness do ritmo segue 9/9.

### Contagem de testes
**158 pytest, 100% verdes** (+8) · **15/15 overworld** + **9/9 ritmo** (Playwright).

### Como rodar
`\.venv\Scripts\python.exe -m http.server 8765 --directory frontend` → `http://127.0.0.1:8765/test/overworld.harness.html`.

### Pendente de validação visual (usuário)
`\.venv\Scripts\python.exe bridge\app.py` → começa no mapa; A/D anda, item no caminho é coletado, W na porta abre a batalha de ritmo contra a capanga; vencer volta ao mapa com a venue marcada.

### Nada commitado
✓ (na branch `modo-historia`, tree limpo fora dos arquivos da F3.2)

### Próxima tarefa
**F3.3** — Campanha no backend (modelo + persistência + API + harness): a sequência de venues vira estado autoritativo do `GerenciadorJogo`, save/load retoma a história.

---

## F3.1 — Minigame de ritmo (4 pistas, Web Audio + rAF) (09/06/2026)

### O que mudou
Substitui o ritmo placeholder por um minigame real. Backend intocado (Ritmo + contrato já prontos).
- **`frontend/js/ritmo.js` (novo):** placar **puro** (`criarPlacar`) + engine com relógio/escalonador/áudio/entrada **injetáveis** (`criarMinigame`) + `jogarRitmo({tipoMusico, cor}) → Promise<{acertos,total_notas,combo_max}|null>` (null = cancelado). 4 pistas (D F J K), chart fixo (~16 notas), janela de acerto ±150ms; nota não acertada = erro (zera combo). Clique na pista = fallback de acessibilidade.
- **`frontend/js/audio.js` (novo):** Web Audio sintetizado (OscillatorNode) — beep de acerto, buzz de erro, pulso de compasso; no-op se não houver AudioContext.
- **`frontend/index.html` + `css/estilo.css`:** overlay do minigame (highway 4 pistas, linha de acerto, HUD combo/acertos), pintado na cor-assinatura do músico. Scripts audio.js + ritmo.js antes do main.js.
- **`frontend/js/main.js`:** `executarAcao` agora abre o minigame, usa a contagem real e só ataca se não cancelar (Esc); removido `RITMO_PLACEHOLDER`; mapa `COR_POR_TIPO`.

### Testes (padrão de harness mantido)
- **`tests/test_ritmo_contrato.py` (novo, +6):** parametriza `{acertos,total_notas,combo_max}` → dano/Modo Refrão/multiplicador via `api.executar_acao` (inclui teto do mult e ausência de ritmo).
- **`frontend/test/harness.html` + `mock-api.js` (novo):** harness de browser determinístico (relógio manual injetado) com 9 asserts in-page — placar puro, engine (perfeito/intercalado/perdidas/cancelar) e `jogarRitmo` completo (overlay + teclado real + payload no `executar_acao`). **Rodado via Playwright (MCP): 9/9 PASS.**

### Contagem de testes
**150 pytest, 100% verdes** (+6) · **9/9 no harness de browser** (Playwright).

### Como rodar o harness do minigame
Servir `frontend/` e abrir `test/harness.html` num browser (lê PASS/FAIL na tela ou em `window.__testes`):
`\.venv\Scripts\python.exe -m http.server 8765 --directory frontend` → `http://127.0.0.1:8765/test/harness.html`.

### Pendente de validação visual (usuário)
`\.venv\Scripts\python.exe bridge\app.py` → montar banda → clicar músico → tocar com D F J K; dano deve variar com a performance; combo alto liga Modo Refrão; Esc cancela sem gastar turno.

### Nada commitado
✓

### Próxima tarefa
**F3.2** — Animações/SFX + identidade visual (inclui sanitizar innerHTML).

---

## F2.1 — Rename mecânico pro tema banda (08/06/2026)

### O que mudou
- **Arquivos renomeados:** `jogador.py→musico.py`, `Guerreiro.py→Guitarrista.py`, `Mago.py→Vocalista.py`, `Ladrao.py→Baterista.py`, `Paladino.py→Baixista.py`. Arquivos antigos deletados.
- **Classes renomeadas:** `Jogador→Musico`, `Guerreiro→Guitarrista`, `Mago→Vocalista`, `Ladrao→Baterista`, `Paladino→Baixista`. Herança de 3 níveis (`Musico→Guitarrista→Baixista`) preservada.
- **Discriminadores de persistência:** `guerreiro→guitarrista`, `mago→vocalista`, `ladrao→baterista`, `paladino→baixista` (chave `"tipo"` no `to_dict` e dict `_tipos` da factory).
- **Recurso `mana→folego`** no Vocalista: atributo `__folego`, `get_folego()`, `restaurar_folego()`, constante `CUSTO_FOLEGO`. Saves antigos quebram (esperado — `saves/` gitignored).
- **Factory renomeada:** `JogadorFactory→MusicoFactory` em `fabricas.py` e `gerenciador.py`.
- **Itens reskinados** (mecânica idêntica): `pocao_vida→energetico` (cura), `pocao_mana→cerveja` (fôlego), `espada→pedal` (+força, Guitarrista/Baixista), `machado→amplificador` (+força, Guitarrista/Baixista).
- **`itens.py`:** efeito `"mana"→"folego"`, duck typing `restaurar_mana→restaurar_folego`.
- **Mensagens de exceção** (nomes de classe intactos): `JogadorMortoError` → "nocauteado", `ManaInsuficienteError` → "fôlego", `TipoInvalidoError` → "músico".
- **Todos os testes** atualizados para os novos nomes. `test_combat.py` renomeado internamente (Musico abstrata, Guitarrista/Vocalista/Baterista).
- **Prints temáticos:** "rasga no palco" (Guitarrista), "solta a voz" (Vocalista), "VIRADA DE BATERIA" (Baterista), "groove sagrado" (Baixista).

### Contagem de testes
**94 testes, 100% verdes** (contagem idêntica à Fase 1 — apenas nomes mudaram).

### Status dos requisitos
Todos ✅ (inalterados — F2.1 é rename puro, zero mecânica nova).

### Nada commitado
✓

### Próxima tarefa
**F2.2** — Mecânicas de tema na camada Show (+ refactor `atacar()->int` + `Ritmo`).

---

## F2.2 — Mecânicas de tema na camada Show (08/06/2026)

### O que mudou
- **`backend/show.py`:** `Inimigo→Empresario`; `Show.acao_musico(indice, ritmo=None)→dict` — contrato D2: chama `musico.atacar()→int` (sem alvo), aplica ego_bonus (`get_ego()/10`), multiplicador de `Ritmo`, boost ×1.5 no Modo Refrão, depois chama `Empresario.receber_dano(dano_final)`. Retorna `{atacante, dano, dano_base, critico, modo_refrao_ativo, multiplicador_aplicado, hp_inimigo, fim}`.
- **`backend/Guitarrista.py`:** `atacar()→int` (sem `alvo`); acumula `__ego += EGO_BONUS_POR_ATAQUE` (máx `EGO_MAX=50`).
- **`backend/Vocalista.py`:** `atacar()→int`; consome `CUSTO_FOLEGO=10` ou retorna dano mínimo 5.
- **`backend/Baterista.py`:** `atacar()→int`; seta `_foi_virada = True/False`; expõe `foi_virada_de_bateria()`.
- **`backend/Baixista.py`:** `atacar()→int`; auto-cura interna via `self.curar()` quando `__fe >= 5`.
- **`backend/ritmo.py` (novo):** classe `Ritmo(acertos, total_notas, combo_max)` com `precisao`, `multiplicador()`, `modo_refrao()`, `Ritmo.de_payload(dto)`.
- **`tests/test_ritmo.py` (novo):** 14 testes cobrindo toda a lógica de Ritmo.
- **`tests/test_show.py`:** importa `Empresario`; novos testes de mult de ritmo, Modo Refrão, ego alto, virada de bateria.
- **`tests/test_combat.py`:** assinaturas `atacar()` sem `alvo`; novos testes de ego (`sobe_por_ataque`, `respeita_teto`).
- **`tests/test_excecoes.py`:** chamadas `atacar()` sem `alvo`.
- **Correção de fixture:** `test_acao_musico_aplica_multiplicador_de_ritmo` usava `acertos=16/16` (Modo Refrão ativo acidentalmente); corrigido para `acertos=8/10` (precisão=0.8, sem Modo Refrão).

### Contagem de testes
**119 testes, 100% verdes** (+25 novos desde F2.1).

### Status dos requisitos
- ✅ `atacar()→int` sem alvo em todas as subclasses
- ✅ `Ritmo` com `precisao`, `multiplicador()`, `modo_refrao()`, `de_payload()`
- ✅ `Show.acao_musico` aplica ego_bonus, mult, Modo Refrão antes de chamar `receber_dano`
- ✅ Duck typing: `get_ego`, `foi_virada_de_bateria` via `getattr` (sem `isinstance`)
- ✅ `Empresario` substitui `Inimigo` (mesmo contrato de alvo)

### Nada commitado
✓

### Próxima tarefa
**F2.3** — Ponte pywebview + frontend mínimo.

---

## F2.3 — Ponte pywebview + frontend mínimo (08/06/2026)

### Nova dependência
- **pywebview==6.2.1** instalado no `.venv` (com OK do usuário) e fixado em `requirements.txt`.

### O que foi criado
- **`bridge/api.py`:** classe `API` (adaptador domínio↔JS). Métodos expostos: `listar_tipos_musicos`, `novo_jogo`, `criar_banda`, `obter_estado`, `executar_acao`, `turno_inimigo`, `salvar`, `carregar`, `listar_saves`. Decorator `_ponte` captura `JogoError` (e qualquer erro) → `ErroDTO` `{ok:false, erro:{tipo,mensagem}}`; nenhuma exceção crua cruza a ponte (§7.3.1). Monta `EstadoDTO`/`ResultadoDTO` 100% serializáveis. Recurso por tipo via `.TIPO` (ego/folego/groove/ritmo).
- **`bridge/app.py`:** entrypoint pywebview (`webview.create_window` + `js_api=API()`). Rodar com `python bridge/app.py`.
- **`frontend/index.html` + `css/estilo.css` + `js/main.js`:** UI mínima — boss com barra de HP, cards da banda (clique = atacar), botões montar banda demo / turno do Empresário / salvar / carregar. Tokens de cor por personagem (§13). **Ritmo é placeholder** (contagem fixa) — minigame Web Audio fica para F3.1.
- **`tests/test_api.py` (novo):** 14 testes da API sem janela (DTOs serializáveis, ego/folego/groove no estado, dano com/sem ritmo, ErroDTO em índice inválido, vitória, turno inimigo, save/load round-trip).

### Estado/arquitetura
- O estado da banda continua no `GerenciadorJogo` (Singleton); o `Show`+`Empresario` são instanciados e mantidos pela `API` (adaptador fino). Domínio segue puro.
- Boss padrão: `Empresario("O Empresário", hp=200, dano=20)`.

### Decisões/observações
- Aviso de XSS no `innerHTML` do `main.js`: app desktop local single-user, dados vêm do próprio domínio → risco desprezível. Sanitização fica como polimento opcional de F3.2.
- Smoke test com `PYWEBVIEW_GUI=mock` confirma `app.py` importável e ponte funcional; janela real não é aberta em CI/teste.

### Contagem de testes
**133 testes, 100% verdes** (+14 da API).

### Status do DoD (F2.3)
- ✅ Ponte pywebview expõe a API ao JS
- ✅ Frontend renderiza o EstadoDTO e dispara ações por clique
- ✅ Salvar/carregar pela UI (via API)
- ⏳ Validação visual da janela real: pendente de execução manual (`python bridge/app.py`)

### Nada commitado
✓

### Próxima tarefa
**F3.1** — Minigame de ritmo (Web Audio + requestAnimationFrame).

---

## F2.4 — Correções pós-validação visual da F2.3 (09/06/2026)

Três ajustes apontados ao rodar `python bridge/app.py`:

### 1. Save/load agora preserva o progresso do show (bug real)
Antes, salvar/carregar recriava o boss com HP cheio (a persistência só serializava a banda). Decisão de arquitetura: **o estado do show (boss + turno) passou para o `GerenciadorJogo`** (alinha com Planejamento §5.1).
- **`backend/show.py`:** `Empresario` ganhou `_hp_max`, `get_hp_maximo()`, `to_dict()`/`from_dict()`.
- **`backend/persistencia.py`:** novas `salvar_estado(estado, slot)` / `carregar_estado(slot)` — envelope `{"banda":[...], "show":{boss, turno}|None}`. Retrocompat: save em formato lista (antigo) é lido como banda sem show. `salvar_jogo`/`carregar_jogo` intactos (ainda usados pelos testes de persistência).
- **`backend/gerenciador.py`:** estado `_boss`/`_turno` + `iniciar_show()`, `get_boss()`, `get_turno()`, `set_turno()`. `salvar`/`carregar` agora persistem o show; reconstrução do boss via `Empresario.from_dict` (erros → `SaveCorrompidoError`).
- **`bridge/api.py`:** boss/turno lidos do gerenciador (removidos `_boss`/`_boss_hp_max`/`_turno` locais). `carregar` reusa o boss restaurado (`_vincular_show`) em vez de criar um novo; `_garantir_show()` evita resetar um show já em andamento.

### 2. Empresário ataca alvo aleatório
`show.py turno_inimigo`: `vivos[0]` → `random.choice(vivos)`. Antes batia sempre no músico mais à esquerda.

### 3. Banda vazia é estado neutro
`show.py verificar_fim`: banda vazia (`[]`) não é mais "derrota" imediata — só há derrota se a banda tem membros e todos caíram.

### Testes novos (+5)
- `test_empresario_hp_maximo_inicial`, `test_empresario_round_trip_preserva_hp_atual_e_maximo`
- `test_turno_inimigo_escolhe_alvo_aleatorio_entre_vivos` (mock `random.choice`)
- `test_verificar_fim_banda_vazia_e_neutro`
- `test_save_load_preserva_hp_do_boss` (API end-to-end)

### Contagem de testes
**138 testes, 100% verdes** (+5).

---

## F2.4b — Bug do botão "Montar banda" + harness de integração (09/06/2026)

### Bug (frontend)
Abrir → Salvar (banda ainda vazia) → Carregar travava o botão "Montar banda demo".
Causa: `carregar()` e `montarBandaDemo()` mexiam em `btn-banda-demo.disabled` ad-hoc, em vez de derivar do estado.
- **`frontend/js/main.js`:** habilitação de botões centralizada em `atualizarBotoes(estado)`, chamada pelo `render()`. Regra: "Montar banda" só fica disponível quando `banda` vazia OU `fim_de_jogo`; removidas as manipulações ad-hoc.

### Harness de teste do jogo
- **`tests/test_integracao_jogo.py` (novo):** dirige a API como o frontend faria — abrir, montar, atacar, turno do boss, salvar/carregar, vitória, serialização em todo o fluxo. Inclui o repro exato do bug (`test_salvar_vazio_e_carregar_ainda_permite_montar`) e o invariante `_pode_montar_banda` que espelha a regra do `main.js`. É o "jeito reproduzível de testar o jogo": `pytest tests/test_integracao_jogo.py -v`.

### Contagem de testes
**144 testes, 100% verdes** (+6 de integração).

### Nada commitado
✓

### Próxima tarefa
**F3.1** — Minigame de ritmo (Web Audio + requestAnimationFrame).
