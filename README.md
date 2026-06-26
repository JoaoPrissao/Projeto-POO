# Decibéis — a turnê contra O Empresário

> RPG de turnos com minigame de ritmo | Python 3.12 + pywebview | Projeto POO 2026

[![Python 3.12](https://img.shields.io/badge/Python-3.12-blue)](https://python.org)
[![Testes](https://img.shields.io/badge/testes-361%20passando-brightgreen)]()
[![Cobertura](https://img.shields.io/badge/cobertura-95%25-brightgreen)]()

**Repositório:** https://github.com/JoaoPrissao/Projeto-POO

---

## Sobre o Jogo

**Decibéis** é um jogo de RPG de gerenciamento de banda de rock desenvolvido como projeto final
da disciplina de Programação Orientada a Objetos (UTFPR 2026). O jogador comanda uma banda de
4 músicos (Guitarrista, Vocalista, Baterista, Baixista) em uma turnê épica contra O Empresário.

A jornada passa por três venues:
- **Bar do Zé** — capanga iniciante, fácil de vencer, mas ótimo para ganhar experiência.
- **Feira da Cidade** — roadie valentão com mais HP, defende O Empresário.
- **Arena** — O Empresário, chefe final; exige fama acumulada nas venues anteriores.

### Como funciona

**Overworld 2D:** A van da banda percorre um mapa side-scroll. O jogador movimenta o grupo com
as setas do teclado, para em venues para batalhar, conversa com NPCs que doam itens, abre baús
secretos com equipamentos raros.

**Batalha por turnos:** Cada músico ataca com um dos 3 golpes disponíveis (leve/médio/pesado).
O vilão revida após a rodada da banda. O sistema de energia e cansaço adiciona profundidade
estratégica — golpes pesados cansam o músico, que perde a próxima vez.

**Minigame de ritmo:** Antes de cada ataque, o jogador pressiona as teclas corretas no ritmo
para multiplicar o dano. Acertos perfeitos constroem combos que liberam o ataque especial.

---

## Como Jogar

### Controles

| Tecla | Ação |
|-------|------|
| `←` / `→` | Mover a van no overworld |
| `Enter` | Interagir com venue / NPC / baú próximo |
| `1` / `2` / `3` | Escolher golpe na batalha (leve/médio/pesado) |
| `D` / `F` / `J` / `K` | Teclas de ritmo no minigame |
| `Esc` | Pausar o jogo |
| `F11` | Tela cheia |

### Fluxo do Jogo

1. **Menu principal** → criar a banda (nome e tipo de cada músico).
2. **Overworld** → andar com a van, parar em venues.
3. **Batalha** → vencer o capanga da venue no minigame de ritmo.
4. **Van / Loja** → usar itens, equipar a banda, comprar consumíveis.
5. **Progressão** → ganhar fama e XP para desbloquear a Arena.
6. **Chefe final** → derrotar O Empresário na Arena.

### Objetivo

Acumule fama suficiente vencendo o Bar e a Feira para desbloquear a Arena. Derrote O Empresário
para completar a turnê. Equipe a banda, use consumíveis estrategicamente e aproveite os
combos perfeitos do minigame de ritmo.

---

## Instalação e Execução

### Pré-requisitos

- **Python 3.12+** — [python.org/downloads](https://www.python.org/downloads/)
- **Windows 10/11** — o WebView2 Runtime já vem instalado no Windows atualizado.
  Em versões antigas ou máquinas fresh, baixe em [developer.microsoft.com/en-us/microsoft-edge/webview2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).

### Passo a passo (caminho garantido)

```bash
# 1. Clone ou descompacte o projeto
git clone https://github.com/JoaoPrissao/Projeto-POO.git
cd Projeto-POO

# 2. Criar ambiente virtual
python -m venv .venv

# 3. Ativar (Windows)
.venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate

# 4. Instalar dependências
pip install -r requirements.txt

# 5. Executar o jogo
python bridge/app.py
```

A janela do jogo abrirá automaticamente via pywebview.

### Executável standalone (best-effort)

Para criar um `.exe` sem precisar de Python instalado, veja as instruções em
[docs/empacotamento.md](docs/empacotamento.md).

---

## Estrutura do Projeto

```
Projeto_POO/
├── backend/          # Domínio do jogo (Python OOP puro)
│   ├── musico.py    # Classe base Musico (ABC) + subir_nivel + inventário
│   ├── Guitarrista.py, Vocalista.py, Baterista.py, Baixista.py
│   ├── show.py      # Orquestrador de combate (Show + Empresario boss)
│   ├── campanha.py  # Estado da campanha (venues, fama, cachê, cooldowns)
│   ├── inventario.py # Inventário com capacidade limitada
│   ├── itens.py     # Hierarquia de itens (Item, Equipavel, Consumivel)
│   ├── moves.py     # Catálogo de golpes (moveset system)
│   ├── fabricas.py  # MusicoFactory e ItemFactory (Factory Method)
│   ├── gerenciador.py # GerenciadorJogo (Singleton)
│   ├── excecoes.py  # Hierarquia de exceções (JogoError + 25 subclasses)
│   └── persistencia.py # Save/load JSON por slot
│
├── bridge/           # Camada de adaptação (JS ↔ Python)
│   ├── api.py       # API pública para pywebview (@_ponte decorator)
│   └── app.py       # Entry point: cria janela pywebview
│
├── frontend/         # Interface (HTML/CSS/JS — só renderiza)
│   ├── index.html   # Single-page app
│   ├── css/estilo.css
│   └── js/          # main.js, overworld.js, batalha.js, ritmo.js, audio.js
│
├── tests/            # Suite pytest (361 testes)
│   └── test_*.py    # Cobertura: musico, inventário, combate, campanha, API...
│
├── docs/             # Documentação da entrega
│   ├── uml_classes.md          # Diagrama UML em Mermaid (+ .png/.svg renderizados)
│   ├── relatorio.md            # Relatório técnico (+ relatorio.pdf)
│   └── empacotamento.md        # Distribuição: rodar do zero + .exe
│
├── saves/            # Saves do jogador (JSON, gerado em runtime)
├── requirements.txt  # Dependências Python
└── README.md         # Este arquivo
```

---

## Modelagem Orientada a Objetos

### Hierarquia de Classes

O diagrama UML completo está em [`docs/uml_classes.md`](docs/uml_classes.md).
Para o relatório técnico detalhado, veja [`docs/relatorio.md`](docs/relatorio.md).

**Hierarquia de músicos:**
```
Musico (ABC)
├── Guitarrista  — forca + ego
│   └── Baixista — herda forca; adiciona fe (groove)
├── Vocalista    — inteligencia
└── Baterista    — agilidade + chance_critico
```

**Hierarquia de itens:**
```
Item
├── Equipavel  — ocupa slot; bônus de atributo; reversível
└── Consumivel — efeito único (cura/energia); destruído ao usar
```

### Padrões de Projeto Implementados

| Padrão | Categoria GoF | Arquivo | Propósito |
|--------|---------------|---------|-----------|
| Singleton | Criacional | `backend/gerenciador.py` | Instância única do estado central (`_instancia` + `__new__`) |
| Factory Method | Criacional | `backend/fabricas.py` | Criação de músicos/itens por tipo-string; extensível via `registrar()` |
| Template Method | Comportamental | `backend/musico.py` | `Musico` define o esqueleto (HP, XP, level-up); subclasses implementam `atacar()` |
| Strategy | Comportamental | `backend/moves.py` | Golpe escolhido em runtime; `Show` não sabe qual move foi escolhido |
| Hierarquia de Exceções | Estrutural | `backend/excecoes.py` | `JogoError` é a raiz de 26 classes (1 raiz + 25 subclasses); captura no nível certo |
| Bridge | Estrutural | `bridge/api.py` | `@_ponte` separa API JS-friendly do domínio Python puro |

### Sobrecarga de Operadores

| Dunder | Classe | Semântica |
|--------|--------|-----------|
| `__len__` | `Inventario` | `len(inv)` — contagem de itens |
| `__contains__` | `Inventario` | `"Pedal de Efeito" in inv` — busca por nome |
| `__repr__` | `Inventario` | `repr(inv)` → `"Inventario(3/20 itens)"` |
| `__del__` | `Musico` | destrutor — print de ciclo de vida |

---

## Testes

```bash
# Rodar todos os testes
pytest -q

# Rodar com cobertura
pytest --cov=backend --cov-report=term-missing -q
```

| Métrica | Valor |
|---------|-------|
| Testes passando | **361** |
| Cobertura `backend/` | **95%** |
| Limiar da rubrica | ≥ 60% |

A suite cobre: musicos, inventário, itens, fábricas, combate, campanha, persistência, API bridge,
integração. Dois harnesses JS com falhas conhecidas pré-existentes (batalha/ritmo) — afetam apenas
o harness, não o jogo real.

---

## Créditos de Áudio

Os temas de batalha são CC0 (domínio público) — sem obrigação de atribuição, mas por boa prática:

- **bar.ogg:** "Groovy Goblins" (do Rock Music Pack) por Ragnar Random — https://opengameart.org/content/rock-music-pack (CC0)
- **feira.ogg:** "Anarchy in the Toadstool Kingdom" (do Rock Music Pack) por Ragnar Random — https://opengameart.org/content/rock-music-pack (CC0)
- **arena.ogg:** "Battle RPG Theme" por Cleyton Kauffman (CleytonRX) — https://opengameart.org/content/boss-battle-theme (CC0)
- **overworld.ogg:** "Dinosaur Spirit Guide" (do Rock Music Pack) por Ragnar Random — https://opengameart.org/content/rock-music-pack (CC0)
