# Combat Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refatorar `Jogador` para classe abstrata e criar subclasses `Guerreiro`, `Mago` e `Ladrão` com polimorfismo dinâmico demonstrado em `main.py`.

**Architecture:** `Jogador` herda de `ABC` e declara `atacar(alvo)` como método abstrato. As três subclasses implementam `atacar()` com regras de dano específicas. `main.py` armazena instâncias heterogêneas numa `list[Jogador]` e itera chamando `atacar()` sem conhecer o tipo real.

**Tech Stack:** Python 3.10+, `abc` (stdlib), `random` (stdlib). Sem dependências externas.

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `backend/Jogador.py` | Modificar | Classe base abstrata com atributos `_protected` e `@abstractmethod atacar()` |
| `backend/Guerreiro.py` | Criar | Subclasse com `__forca`; dano fixo |
| `backend/Mago.py` | Criar | Subclasse com `__mana` e `__inteligencia`; dano mágico com custo de mana |
| `backend/Ladrao.py` | Criar | Subclasse com `__agilidade` e `__chance_critico`; dano crítico aleatório |
| `backend/main.py` | Criar | Demonstração de polimorfismo com `list[Jogador]` |
| `tests/test_combat.py` | Criar | Testes das regras de dano de cada subclasse |

---

## Task 1: Refatorar `Jogador` para classe abstrata

**Files:**
- Modify: `backend/Jogador.py`

- [ ] **Step 1: Instalar pytest no venv**

```powershell
.venv\Scripts\python.exe -m pip install pytest
```

Expected: `Successfully installed pytest-x.x.x`

- [ ] **Step 2: Criar arquivo de testes vazio**

Criar `tests/__init__.py` (vazio) e `tests/test_combat.py` com:

```python
# tests/test_combat.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
```

- [ ] **Step 3: Escrever teste que verifica Jogador não pode ser instanciada diretamente**

Adicionar em `tests/test_combat.py`:

```python
import pytest
from Jogador import Jogador

def test_jogador_e_abstrata():
    with pytest.raises(TypeError):
        Jogador("Teste")
```

- [ ] **Step 4: Rodar teste — deve FALHAR (Jogador ainda é concreta)**

```powershell
.venv\Scripts\python.exe -m pytest tests/test_combat.py::test_jogador_e_abstrata -v
```

Expected: FAIL — `Jogador("Teste")` não lança TypeError ainda.

- [ ] **Step 5: Refatorar `backend/Jogador.py`**

Substituir o conteúdo completo do arquivo pelo código abaixo. As mudanças são:
1. Herdar de `ABC`
2. Renomear `__atributo` → `_atributo` em toda a classe (protected)
3. Adicionar `@abstractmethod atacar()`
4. Atualizar getters/setters para usar `_` em vez de `__`

```python
from abc import ABC, abstractmethod


class Jogador(ABC):
    XP_BASE = 100

    def __init__(self, nome: str, nivel: int = 1, hp_maximo: int = 100, xp: int = 0):
        self._nome             = nome
        self._nivel            = nivel
        self._hp_maximo        = hp_maximo
        self._hp               = hp_maximo
        self._xp               = xp
        self._xp_proximo_nivel = nivel * self.XP_BASE
        print(f"  [+] Jogador '{self._nome}' criado (nível {self._nivel}).")

    @classmethod
    def iniciante(cls, nome: str) -> "Jogador":
        return cls(nome)

    @classmethod
    def do_save(cls, nome: str, nivel: int, hp_maximo: int, xp: int) -> "Jogador":
        return cls(nome, nivel, hp_maximo, xp)

    def __del__(self):
        print(f"  [-] Jogador '{self._nome}' removido da memória.")

    # ── Getters ───────────────────────────────────────────────────

    def get_nome(self) -> str:
        return self._nome

    def get_nivel(self) -> int:
        return self._nivel

    def get_hp(self) -> int:
        return self._hp

    def get_hp_maximo(self) -> int:
        return self._hp_maximo

    def get_xp(self) -> int:
        return self._xp

    def get_xp_proximo_nivel(self) -> int:
        return self._xp_proximo_nivel

    # ── Setters ───────────────────────────────────────────────────

    def set_nome(self, nome: str) -> None:
        if not nome.strip():
            print("  [ERRO] Nome não pode ser vazio.")
            return
        self._nome = nome
        print(f"  Nome alterado para: {self._nome}")

    def set_nivel(self, nivel: int) -> None:
        if nivel < 1:
            print("  [ERRO] Nível deve ser no mínimo 1.")
            return
        self._nivel = nivel
        print(f"  {self._nome} agora é nível {self._nivel}.")

    def set_hp_maximo(self, hp_maximo: int) -> None:
        if hp_maximo <= 0:
            print("  [ERRO] HP máximo deve ser maior que zero.")
            return
        self._hp_maximo = hp_maximo
        if self._hp > self._hp_maximo:
            self._hp = self._hp_maximo
        print(f"  HP máximo de {self._nome} ajustado para {self._hp_maximo}.")

    # ── Métodos ───────────────────────────────────────────────────

    def exibir_status(self) -> None:
        print("========================================")
        print(f"  Nome       : {self._nome}")
        print(f"  Nível      : {self._nivel}")
        print(f"  HP         : {self._hp}/{self._hp_maximo}")
        print(f"  XP         : {self._xp}/{self._xp_proximo_nivel}")
        print(f"  Vivo       : {'Sim' if self.esta_vivo() else 'Não'}")

    def esta_vivo(self) -> bool:
        return self._hp > 0

    def receber_dano(self, dano: int) -> None:
        if dano <= 0:
            return
        if not self.esta_vivo():
            print(f"  {self._nome} já está morto.")
            return
        self._hp -= dano
        if self._hp < 0:
            self._hp = 0
        print(f"  {self._nome} recebeu {dano} de dano. HP: {self._hp}/{self._hp_maximo}")
        if not self.esta_vivo():
            print(f"  {self._nome} foi derrotado!")

    def curar(self, cura: int) -> None:
        if cura <= 0:
            return
        if not self.esta_vivo():
            print(f"  {self._nome} está morto e não pode ser curado.")
            return
        self._hp = min(self._hp + cura, self._hp_maximo)
        print(f"  {self._nome} curou {cura} de HP. HP: {self._hp}/{self._hp_maximo}")

    def ganhar_xp(self, quantidade: int) -> None:
        if quantidade <= 0:
            return
        self._xp += quantidade
        print(f"  {self._nome} ganhou {quantidade} XP. XP: {self._xp}/{self._xp_proximo_nivel}")
        while self._xp >= self._xp_proximo_nivel:
            self._xp -= self._xp_proximo_nivel
            self.subir_nivel()

    def subir_nivel(self) -> None:
        self._nivel += 1
        self._xp_proximo_nivel = self._nivel * self.XP_BASE
        bonus_hp = 10
        self._hp_maximo += bonus_hp
        self._hp = min(self._hp + bonus_hp, self._hp_maximo)
        print(f"  {self._nome} subiu para o nível {self._nivel}! "
              f"HP máximo: {self._hp_maximo} (+{bonus_hp})")

    @abstractmethod
    def atacar(self, alvo: "Jogador") -> None:
        pass
```

- [ ] **Step 6: Rodar teste — deve PASSAR**

```powershell
.venv\Scripts\python.exe -m pytest tests/test_combat.py::test_jogador_e_abstrata -v
```

Expected: PASS

- [ ] **Step 7: Commit**

```powershell
git add backend/Jogador.py tests/
git commit -m "refactor: Jogador vira classe abstrata com atacar() e atributos protected"
```

---

## Task 2: Criar `Guerreiro`

**Files:**
- Create: `backend/Guerreiro.py`
- Modify: `tests/test_combat.py`

- [ ] **Step 1: Escrever teste do Guerreiro**

Adicionar em `tests/test_combat.py`:

```python
from Guerreiro import Guerreiro

def test_guerreiro_dano_fixo():
    g = Guerreiro("Aldric", forca=10)
    alvo = Guerreiro("Dummy", forca=1)
    hp_antes = alvo.get_hp()
    g.atacar(alvo)
    assert alvo.get_hp() == hp_antes - 15  # int(10 * 1.5) = 15

def test_guerreiro_herda_jogador():
    g = Guerreiro("Aldric")
    assert isinstance(g, Jogador)
```

- [ ] **Step 2: Rodar teste — deve FALHAR**

```powershell
.venv\Scripts\python.exe -m pytest tests/test_combat.py::test_guerreiro_dano_fixo -v
```

Expected: FAIL — `Guerreiro` não existe ainda.

- [ ] **Step 3: Criar `backend/Guerreiro.py`**

```python
from Jogador import Jogador


class Guerreiro(Jogador):

    def __init__(self, nome: str, nivel: int = 1, hp_maximo: int = 100,
                 xp: int = 0, forca: int = 10):
        super().__init__(nome, nivel, hp_maximo, xp)
        self.__forca = forca

    def get_forca(self) -> int:
        return self.__forca

    def exibir_status(self) -> None:
        super().exibir_status()
        print(f"  Força      : {self.__forca}")
        print("========================================")

    def atacar(self, alvo: Jogador) -> None:
        dano = int(self.__forca * 1.5)
        print(f"  {self._nome} ataca com força! Dano: {dano}")
        alvo.receber_dano(dano)
```

- [ ] **Step 4: Rodar testes — devem PASSAR**

```powershell
.venv\Scripts\python.exe -m pytest tests/test_combat.py -v
```

Expected: todos PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/Guerreiro.py tests/test_combat.py
git commit -m "feat: subclasse Guerreiro com atacar() por forca"
```

---

## Task 3: Criar `Mago`

**Files:**
- Create: `backend/Mago.py`
- Modify: `tests/test_combat.py`

- [ ] **Step 1: Escrever testes do Mago**

Adicionar em `tests/test_combat.py`:

```python
from Mago import Mago

def test_mago_dano_magico_com_mana():
    m = Mago("Selene", inteligencia=10, mana=50)
    alvo = Guerreiro("Dummy")
    hp_antes = alvo.get_hp()
    m.atacar(alvo)
    assert alvo.get_hp() == hp_antes - 20   # int(10 * 2.0) = 20
    assert m.get_mana() == 40               # consumiu 10 de mana

def test_mago_dano_minimo_sem_mana():
    m = Mago("Selene", inteligencia=10, mana=5)  # mana insuficiente
    alvo = Guerreiro("Dummy")
    hp_antes = alvo.get_hp()
    m.atacar(alvo)
    assert alvo.get_hp() == hp_antes - 5    # dano base mínimo = 5
```

- [ ] **Step 2: Rodar testes — devem FALHAR**

```powershell
.venv\Scripts\python.exe -m pytest tests/test_combat.py::test_mago_dano_magico_com_mana tests/test_combat.py::test_mago_dano_minimo_sem_mana -v
```

Expected: FAIL — `Mago` não existe.

- [ ] **Step 3: Criar `backend/Mago.py`**

```python
from Jogador import Jogador

CUSTO_MANA = 10
DANO_BASE_MINIMO = 5


class Mago(Jogador):

    def __init__(self, nome: str, nivel: int = 1, hp_maximo: int = 80,
                 xp: int = 0, mana: int = 50, inteligencia: int = 10):
        super().__init__(nome, nivel, hp_maximo, xp)
        self.__mana         = mana
        self.__inteligencia = inteligencia

    def get_mana(self) -> int:
        return self.__mana

    def get_inteligencia(self) -> int:
        return self.__inteligencia

    def exibir_status(self) -> None:
        super().exibir_status()
        print(f"  Mana       : {self.__mana}")
        print(f"  Inteligência: {self.__inteligencia}")
        print("========================================")

    def atacar(self, alvo: Jogador) -> None:
        if self.__mana >= CUSTO_MANA:
            self.__mana -= CUSTO_MANA
            dano = int(self.__inteligencia * 2.0)
            print(f"  {self._nome} conjura magia! Dano: {dano} (mana: {self.__mana})")
        else:
            dano = DANO_BASE_MINIMO
            print(f"  {self._nome} não tem mana suficiente! Dano base: {dano}")
        alvo.receber_dano(dano)
```

- [ ] **Step 4: Rodar todos os testes — devem PASSAR**

```powershell
.venv\Scripts\python.exe -m pytest tests/test_combat.py -v
```

Expected: todos PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/Mago.py tests/test_combat.py
git commit -m "feat: subclasse Mago com atacar() magico e custo de mana"
```

---

## Task 4: Criar `Ladrão`

**Files:**
- Create: `backend/Ladrao.py`
- Modify: `tests/test_combat.py`

- [ ] **Step 1: Escrever testes do Ladrão**

Adicionar em `tests/test_combat.py`:

```python
from Ladrao import Ladrao

def test_ladrao_dano_normal_sem_critico():
    l = Ladrao("Kael", agilidade=10, chance_critico=0.0)  # nunca critico
    alvo = Guerreiro("Dummy")
    hp_antes = alvo.get_hp()
    l.atacar(alvo)
    assert alvo.get_hp() == hp_antes - 10  # int(10 * 1.0) = 10

def test_ladrao_dano_critico():
    l = Ladrao("Kael", agilidade=10, chance_critico=1.0)  # sempre critico
    alvo = Guerreiro("Dummy")
    hp_antes = alvo.get_hp()
    l.atacar(alvo)
    assert alvo.get_hp() == hp_antes - 30  # int(10 * 3.0) = 30
```

- [ ] **Step 2: Rodar testes — devem FALHAR**

```powershell
.venv\Scripts\python.exe -m pytest tests/test_combat.py::test_ladrao_dano_normal_sem_critico tests/test_combat.py::test_ladrao_dano_critico -v
```

Expected: FAIL — `Ladrao` não existe.

- [ ] **Step 3: Criar `backend/Ladrao.py`**

```python
import random

from Jogador import Jogador


class Ladrao(Jogador):

    def __init__(self, nome: str, nivel: int = 1, hp_maximo: int = 90,
                 xp: int = 0, agilidade: int = 10, chance_critico: float = 0.3):
        super().__init__(nome, nivel, hp_maximo, xp)
        self.__agilidade      = agilidade
        self.__chance_critico = chance_critico

    def get_agilidade(self) -> int:
        return self.__agilidade

    def get_chance_critico(self) -> float:
        return self.__chance_critico

    def exibir_status(self) -> None:
        super().exibir_status()
        print(f"  Agilidade  : {self.__agilidade}")
        print(f"  Chance Crit: {int(self.__chance_critico * 100)}%")
        print("========================================")

    def atacar(self, alvo: Jogador) -> None:
        if random.random() < self.__chance_critico:
            dano = int(self.__agilidade * 3.0)
            print(f"  {self._nome} GOLPE CRÍTICO! Dano: {dano}")
        else:
            dano = int(self.__agilidade * 1.0)
            print(f"  {self._nome} ataca sorrateiro. Dano: {dano}")
        alvo.receber_dano(dano)
```

- [ ] **Step 4: Rodar todos os testes — devem PASSAR**

```powershell
.venv\Scripts\python.exe -m pytest tests/test_combat.py -v
```

Expected: todos PASS.

- [ ] **Step 5: Commit**

```powershell
git add backend/Ladrao.py tests/test_combat.py
git commit -m "feat: subclasse Ladrao com atacar() critico aleatorio"
```

---

## Task 5: Criar `main.py` com demonstração de polimorfismo

**Files:**
- Create: `backend/main.py`

- [ ] **Step 1: Criar `backend/main.py`**

```python
from Jogador import Jogador
from Guerreiro import Guerreiro
from Mago import Mago
from Ladrao import Ladrao


if __name__ == "__main__":

    # ── Criação dos personagens ───────────────────────────────────
    print("── Criando personagens ──────────────────────────")
    guerreiro = Guerreiro("Aldric",  nivel=5, hp_maximo=150, forca=20)
    mago      = Mago("Selene",       nivel=3, hp_maximo=80,  inteligencia=15, mana=60)
    ladrao    = Ladrao("Kael",       nivel=4, hp_maximo=110, agilidade=12, chance_critico=0.4)

    alvo = Guerreiro("Boneco de Treino", hp_maximo=500, forca=1)

    # ── Status inicial ────────────────────────────────────────────
    print("\n── Status inicial ───────────────────────────────")
    for j in [guerreiro, mago, ladrao]:
        j.exibir_status()

    # ── Demonstração de polimorfismo ──────────────────────────────
    # list[Jogador] armazena tipos diferentes — o tipo real só é
    # resolvido em tempo de execução (late binding / polimorfismo dinâmico)
    print("\n── Rodada de combate (polimorfismo dinâmico) ────")
    jogadores: list[Jogador] = [guerreiro, mago, ladrao]

    for jogador in jogadores:
        jogador.atacar(alvo)  # chamada polimórfica: tipo real desconhecido aqui

    # ── Status do alvo após o combate ─────────────────────────────
    print("\n── Status do alvo após o combate ────────────────")
    alvo.exibir_status()
```

- [ ] **Step 2: Rodar o main e verificar a saída**

```powershell
cd backend; ..\venv\Scripts\python.exe main.py
```

> Nota: se o venv estiver na raiz, usar `..\venv\Scripts\python.exe`. Se `.venv`, usar `..\\.venv\Scripts\python.exe`.

Expected: ver criação dos personagens, status, três ataques distintos (forca, magia, crítico aleatório), status do alvo.

- [ ] **Step 3: Commit final**

```powershell
git add backend/main.py
git commit -m "feat: main.py com demonstracao de polimorfismo e colecao heterogenea"
```

---

## Task 6: Verificação final

- [ ] **Step 1: Rodar toda a suite de testes**

```powershell
.venv\Scripts\python.exe -m pytest tests/ -v
```

Expected: 7 testes, todos PASS.

- [ ] **Step 2: Rodar o main completo**

```powershell
cd backend; ..\.venv\Scripts\python.exe main.py
```

Verificar que a saída mostra:
- Três personagens criados
- Status com atributos específicos de cada classe
- Três ataques com comportamentos diferentes (Guerreiro fixo, Mago consome mana, Ladrão aleatorio)
- Status do alvo refletindo o dano acumulado

- [ ] **Step 3: Conferir critérios do trabalho**

| Critério | Verificação |
|---|---|
| Herança | `isinstance(guerreiro, Jogador)` → True |
| Encapsulamento | `_protected` na base, `__private` nas subclasses |
| Classe abstrata | `Jogador("x")` → `TypeError` (teste garante isso) |
| Polimorfismo dinâmico | Loop `for j in jogadores: j.atacar(alvo)` sem isinstance |
| Coleção heterogênea | `list[Jogador]` com três tipos diferentes |
