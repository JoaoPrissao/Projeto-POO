# Combat Engine — Design Spec
Data: 2026-05-07 | Prazo de entrega: 2026-05-08

## Contexto

Trabalho acadêmico de POO. O objetivo é demonstrar herança, encapsulamento, classes abstratas, polimorfismo dinâmico e coleções heterogêneas.

As subclasses `Guerreiro`, `Mago` e `Ladrão` são **placeholders de entrega** — o tema real do jogo será definido depois. A classe `Jogador` abstrata é o componente permanente do projeto.

---

## Arquitetura

```
backend/
├── Jogador.py      # classe base abstrata (refatorar existente)
├── Guerreiro.py    # subclasse placeholder: foco em forca
├── Mago.py         # subclasse placeholder: foco em mana + inteligencia
├── Ladrao.py       # subclasse placeholder: foco em agilidade + chance_critico
└── main.py         # demonstração de polimorfismo com coleção heterogênea
```

---

## Classe Base: `Jogador` (abstrata)

**Arquivo:** `backend/Jogador.py`

### Mudanças em relação ao código atual
- Herdar de `ABC` (`from abc import ABC, abstractmethod`)
- Renomear atributos de `__` (private) para `_` (protected), para que subclasses acessem diretamente sem getters
- Manter todos os métodos existentes: `exibir_status`, `esta_vivo`, `receber_dano`, `curar`, `ganhar_xp`, `subir_nivel`
- Adicionar método abstrato: `atacar(alvo: "Jogador") -> None`
- Manter classmethods `iniciante()` e `do_save()` — mas como `Jogador` é abstrata, eles serão úteis só nas subclasses (cada subclasse pode sobrescrever se quiser)
- `exibir_status()` exibe os atributos base; subclasses podem chamar `super()` e acrescentar os seus extras

### Atributos (protected)
| Atributo | Tipo | Descrição |
|---|---|---|
| `_nome` | str | Nome do jogador |
| `_nivel` | int | Nível atual |
| `_hp_maximo` | int | HP máximo |
| `_hp` | int | HP atual |
| `_xp` | int | XP acumulado |
| `_xp_proximo_nivel` | int | XP necessário para o próximo nível |

---

## Subclasse: `Guerreiro`

**Arquivo:** `backend/Guerreiro.py`

### Atributos extras (private)
| Atributo | Tipo | Padrão |
|---|---|---|
| `__forca` | int | 10 |

### Método `atacar(alvo)`
```
dano = int(self.__forca * 1.5)
alvo.receber_dano(dano)
```

---

## Subclasse: `Mago`

**Arquivo:** `backend/Mago.py`

### Atributos extras (private)
| Atributo | Tipo | Padrão |
|---|---|---|
| `__mana` | int | 50 |
| `__inteligencia` | int | 10 |

### Método `atacar(alvo)`
```
se _mana >= 10:
    _mana -= 10
    dano = int(__inteligencia * 2.0)
senão:
    dano = 5  # dano base mínimo
alvo.receber_dano(dano)
```

---

## Subclasse: `Ladrão`

**Arquivo:** `backend/Ladrao.py`

### Atributos extras (private)
| Atributo | Tipo | Padrão |
|---|---|---|
| `__agilidade` | int | 10 |
| `__chance_critico` | float | 0.3 (30%) |

### Método `atacar(alvo)`
```
se random.random() < __chance_critico:
    dano = int(__agilidade * 3.0)  # crítico
senão:
    dano = int(__agilidade * 1.0)  # normal
alvo.receber_dano(dano)
```

---

## `main.py` — Demonstração de Polimorfismo

**Arquivo:** `backend/main.py`

1. Instanciar um `Guerreiro`, um `Mago` e um `Ladrão` como alvo fixo
2. Criar uma lista do tipo `list[Jogador]` com os três atacantes
3. Iterar a lista e chamar `atacar(alvo)` em cada elemento sem checar o tipo real
4. Exibir status de todos antes e depois do combate

```python
jogadores: list[Jogador] = [Guerreiro(...), Mago(...), Ladrao(...)]
alvo = Guerreiro("Dummy", ...)

for j in jogadores:
    j.atacar(alvo)  # polimorfismo dinâmico: tipo real resolvido em runtime
```

---

## Critérios do trabalho x Design

| Critério | Atendido por |
|---|---|
| Herança | `Guerreiro`, `Mago`, `Ladrão` herdam de `Jogador` |
| Encapsulamento | Atributos base `_protected`, extras das subclasses `__private` |
| Classe abstrata | `Jogador(ABC)` com `@abstractmethod atacar()` |
| Polimorfismo dinâmico | `list[Jogador]` iterada chamando `atacar()` |
| Coleção heterogênea | Lista com instâncias de tipos diferentes |
| `protected` vs `private` | Base usa `_`, subclasses usam `__` para seus próprios atributos |
