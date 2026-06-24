# Roteiro de Apresentação — Decibéis: a turnê contra O Empresário

> **Entregável DEL-08** — Texto-fonte para o João montar os slides e gravar a demo.
> **Partes humanas (D-02):** montar os slides (PowerPoint/Google Slides), gravar a demo ao vivo
> e apresentar para a banca — o agente produz apenas o texto-fonte deste roteiro.

**Disciplina:** Programação Orientada a Objetos — UTFPR · 2026
**Duração total:** 15 minutos
**Formato sugerido:** demonstração ao vivo + slides com trechos de código

---

## Cronograma (15 min)

| Tempo | Bloco | Descrição |
|-------|-------|-----------|
| 0:00 – 1:30 | Introdução | Projeto, tema, stack |
| 1:30 – 4:00 | Demo ao vivo | Menu → banda → overworld → batalha + ritmo |
| 4:00 – 7:00 | POO: herança e polimorfismo | Diagrama UML, hierarquia Musico, subclasses |
| 7:00 – 9:30 | POO: padrões de projeto | Singleton, Factory, Template Method (código) |
| 9:30 – 11:00 | POO: operadores e outros padrões | `__len__`, `__contains__`, `__repr__`, Bridge |
| 11:00 – 12:30 | Qualidade e testes | 361 testes, 95% cobertura, pytest-cov |
| 12:30 – 13:30 | Empacotamento e execução | Instrução "rodar do zero" (5 passos) |
| 13:30 – 15:00 | Conclusão + perguntas | O que foi aprendido, melhorias futuras |

---

## Bloco 1 — Introdução (0:00 – 1:30)

**Slide:** título + logo do jogo + stack

**Fala:**
"Boa tarde. Hoje apresento o **Decibéis** — jogo RPG de gerenciamento de banda de rock desenvolvido
em Python 3.12 como projeto de POO. O jogador monta uma banda de 4 músicos e os leva em uma turnê
por venues crescentes até enfrentar O Empresário, o chefe final.

A stack é Python puro no domínio, com interface web via pywebview — HTML, CSS e JavaScript apenas
para renderização. Toda a lógica de jogo está em Python, o que facilita testar e demonstrar
os conceitos de OOP."

**Pontos-chave do slide:**
- Python 3.12 + pywebview
- Arquitetura 3 camadas: backend / bridge / frontend
- Prazo: 26/06/2026 | UTFPR POO 2026

---

## Bloco 2 — Demo ao Vivo (1:30 – 4:00)

**[PARTE HUMANA — João executa ao vivo]** `python bridge/app.py`

**Roteiro da demo:**

1. **(0:15)** Menu principal abre — mostrar o visual pixel-art âmbar.
2. **(0:30)** Clicar em "Nova Partida" → tela de criação de banda.
   - Preencher os 4 membros: "Riff" (guitarrista), "Vande" (vocalista), "Ramiro" (baterista), "Marivaldo" (baixista).
   - Mostrar que cada tipo tem atributos iniciais diferentes.
3. **(0:30)** Overworld: mover a van com as setas; comentar van pixel-art, skyline parallax.
4. **(0:45)** Parar no Bar do Zé → iniciar batalha.
   - Mostrar o HUD com HP/energia de cada músico.
   - Escolher um golpe pesado → mostrar o minigame de ritmo.
   - Comentar: acerto perfeito = combo = dano maior.
5. **(0:15)** Vencer a batalha → mostrar XP e fama ganhos.

**Fala durante a demo:**
"Reparem que o frontend só renderiza o estado que o backend envia. Quando escolho o golpe, o
JavaScript chama `window.pywebview.api.atacar()` e aguarda o DTO JSON de resposta — toda a lógica
do combate acontece em Python."

---

## Bloco 3 — POO: Herança e Polimorfismo (4:00 – 7:00)

**Slide:** Diagrama UML de classes (renderizado de `docs/uml_classes.md`)

**Fala:**
"Aqui está a hierarquia de classes do domínio. `Musico` é uma classe abstrata — define HP, XP,
energia, inventário, level-up. As 4 subclasses só precisam implementar `atacar()`.

Uma relação interessante: `Baixista` herda de `Guitarrista`, não direto de `Musico`. Por quê?
Porque o baixista compartilha o atributo `forca` e os métodos de equipamento da guitarra,
acrescentando apenas `fe` como diferencial. Isso evita duplicação de código."

**Slide:** trecho de código `musico.py` — `@abstractmethod atacar()`

```python
class Musico(ABC):
    @abstractmethod
    def atacar(self) -> int:
        """Retorna o dano base sem aplicá-lo."""
        pass
```

**Slide:** trecho de código `show.py` — polimorfismo em ação

```python
dano = musico.atacar()  # chama Guitarrista.atacar() ou Vocalista.atacar()...
```

"Aqui o polimorfismo: `musico.atacar()` funciona igual para qualquer tipo. O `Show` não precisa
saber se é guitarrista ou baterista."

**Também mostrar:** hierarquia `Item → Equipavel / Consumivel` e `usar()` polimorfico.

---

## Bloco 4 — POO: Padrões de Projeto (7:00 – 9:30)

**Slide:** tabela de 6 padrões GoF

**Fala:** "O projeto implementa 6 padrões GoF documentados. Vou detalhar os 3 canônicos mais
representativos."

**Sub-bloco 4a — Singleton (0:30):**

**Slide:** trecho `gerenciador.py`

```python
class GerenciadorJogo:
    _instancia = None
    def __new__(cls):
        if cls._instancia is None:
            cls._instancia = super().__new__(cls)
        return cls._instancia
```

"Qualquer módulo que instancie `GerenciadorJogo()` recebe sempre o mesmo objeto — o estado
central do jogo é único."

**Sub-bloco 4b — Factory Method (0:45):**

**Slide:** trecho `fabricas.py`

```python
class MusicoFactory:
    _tipos = {"guitarrista": Guitarrista, "vocalista": Vocalista, ...}

    @classmethod
    def criar(cls, tipo: str, **kwargs) -> Musico:
        return cls._tipos[tipo](**kwargs)

    @classmethod
    def registrar(cls, chave, classe):   # Open/Closed
        cls._tipos[chave] = classe
```

"A factory centraliza a criação: ninguém mais cita `Guitarrista()` diretamente. Novos tipos
são adicionados via `registrar()` sem alterar código existente."

**Sub-bloco 4c — Template Method (0:45):**

"Já vimos no bloco 3: `Musico` define o algoritmo completo de personagem; `atacar()` é o
único passo variável que cada subclasse implementa."

---

## Bloco 5 — POO: Operadores e Outros Padrões (9:30 – 11:00)

**Slide:** tabela de dunders

**Fala:**
"Python permite sobrecarregar operadores via métodos dunder. O `Inventario` implementa três:"

| Dunder | Uso |
|--------|-----|
| `__len__` | `len(inv)` → contagem de itens |
| `__contains__` | `"Pedal de Efeito" in inv` |
| `__repr__` | `repr(inv)` → `"Inventario(3/20 itens)"` |

```python
def __contains__(self, nome_item: str) -> bool:
    return self._buscar(nome_item) is not None
```

"Isso torna o código mais Pythônico — você pode usar `in` diretamente no inventário."

**Sub-bloco: Bridge (0:30):**

**Slide:** decorator `@_ponte`

"O padrão Bridge separa a API que o JavaScript enxerga do domínio Python. O decorator `@_ponte`
captura qualquer exceção e converte para `{ok: false, erro}` — o frontend nunca recebe uma
exceção bruta."

---

## Bloco 6 — Qualidade e Testes (11:00 – 12:30)

**Slide:** números de cobertura

**Fala:**
"361 testes pytest, cobertura de 95% no backend — muito acima do limiar de 60% da rubrica.

Os testes cobrem: musicos, inventário, itens, fábricas, combate, campanha, persistência e
integração. Para rodar:"

```bash
pytest --cov=backend --cov-report=term-missing -q
```

"Dois harnesses JavaScript têm falhas pré-existentes (derrota no harness de batalha e void 0
no harness de ritmo) — documentadas honestamente no relatório. Afetam apenas o ambiente de
testes, não o jogo real."

**Slide:** screenshot do terminal com `361 passed, 0 failed, 95% coverage`

---

## Bloco 7 — Empacotamento e Execução (12:30 – 13:30)

**Slide:** 5 passos para rodar do zero

**Fala:**
"Para rodar o projeto do zero, 5 comandos:"

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python bridge/app.py
```

"Pré-requisito: Python 3.12+ e WebView2 Runtime (já presente no Windows 10/11 atualizado).

Para distribuição sem Python instalado, existe instrução de empacotamento via PyInstaller em
`docs/empacotamento.md`."

---

## Bloco 8 — Conclusão + Perguntas (13:30 – 15:00)

**Slide:** lista do que foi implementado

**Fala:**
"O projeto demonstra os conceitos centrais de POO em um jogo jogável de ponta a ponta:
- 2 hierarquias de herança reais com polimorfismo funcional
- 6 padrões GoF implementados e documentados
- 4 sobrecargas de operadores Pythônicos
- 95% de cobertura de testes com 361 casos pytest

A maior decisão arquitetural foi manter o backend autoritativo — todo estado em Python,
frontend só renderiza. Isso tornou possível testar 95% do código sem precisar de browser.

Perguntas?"

**Possíveis perguntas da banca — respostas preparadas:**

| Pergunta | Resposta curta |
|----------|----------------|
| Por que Python e não C++? | A disciplina aceita Python (título "POO com Python e C++"); requisitos C++ mapeiam para ABC, dunder, módulos — tudo presente. |
| Por que `Baixista` herda de `Guitarrista`? | Compartilham `forca` e os métodos de equipamento (pedal, amplificador). Herança para reutilização de código real, não só hierárquica. |
| O que é o `@_ponte`? | Decorator que funciona como Bridge GoF: captura exceções do domínio e retorna DTOs JSON. Nenhuma exceção bruta cruza para o JavaScript. |
| Como garantiu que os padrões são reais? | Grep no código confirmou cada símbolo de evidência (`_instancia`, `registrar()`, `@abstractmethod`, `MOVES_BASE`). Documentado no relatório. |
| Por que pywebview? | Requisito de POO puro em Python; pywebview permite UI rica sem framework de jogo externo. |
