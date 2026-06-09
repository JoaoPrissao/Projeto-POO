# PROGRESS — RPG Manager (banda de rock)

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

### Nada commitado
✓

### Próxima tarefa
**F3.1** — Minigame de ritmo (Web Audio + requestAnimationFrame).
