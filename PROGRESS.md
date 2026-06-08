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
