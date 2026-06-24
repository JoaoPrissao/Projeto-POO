# Diagrama UML de Classes — Decibéis: a turnê contra O Empresário

> **Entregável DEL-04** — Diagrama de classes em Mermaid coerente com a implementação real em `backend/`.
> **Parte humana (D-02):** Renderizar para imagem via VS Code ("Markdown Preview Mermaid Support") ou
> em [mermaid.live](https://mermaid.live) (exportar PNG/SVG) — o agente produz apenas o texto-fonte.

---

```mermaid
classDiagram
    class Musico {
        <<abstract>>
        +XP_BASE : int = 100
        +ENERGIA_MAXIMA : int = 100
        +TIPO : str = None
        #_nome : str
        #_nivel : int
        #_hp : int
        #_hp_maximo : int
        #_xp : int
        #_xp_proximo_nivel : int
        #_energia : int
        #_cansado : bool
        +get_nome() str
        +get_nivel() int
        +get_hp() int
        +get_hp_maximo() int
        +get_xp() int
        +get_energia() int
        +esta_vivo() bool
        +esta_cansado() bool
        +receber_dano(dano: int) None
        +curar(cura: int) None
        +ganhar_xp(qtd: int) None
        +subir_nivel() None
        +gastar_energia(qtd: int) None
        +recuperar_energia(qtd: int) None
        +cansar() None
        +descansar() None
        +equipar(item) None
        +desequipar(nome_item: str) Item
        +bonus_equipamento(atributo: str) int
        +get_inventario() Inventario
        +to_dict() dict
        +atacar()* int
        +__del__() None
    }

    class Guitarrista {
        +TIPO : str = "guitarrista"
        -__forca : int
        -__ego : int
        +get_forca() int
        +get_ego() int
        +aumentar_forca(qtd: int) None
        +aumentar_ego(qtd: int) None
        +atacar() int
    }

    class Vocalista {
        +TIPO : str = "vocalista"
        -__inteligencia : int
        +get_inteligencia() int
        +aumentar_inteligencia(qtd: int) None
        +atacar() int
    }

    class Baterista {
        +TIPO : str = "baterista"
        -__agilidade : int
        -__chance_critico : float
        +get_agilidade() int
        +aumentar_agilidade(qtd: int) None
        +atacar() int
    }

    class Baixista {
        +TIPO : str = "baixista"
        -__fe : int
        +get_fe() int
        +atacar() int
    }

    class GerenciadorJogo {
        <<Singleton>>
        -_instancia : GerenciadorJogo
        -_inicializado : bool
        -_banda : list
        -_boss : Empresario
        -_campanha : Campanha
        +__new__(cls) GerenciadorJogo
        +criar_banda(composicao: list) list
        +obter_banda() list
        +salvar(slot: str) None
        +carregar(slot: str) None
    }

    class MusicoFactory {
        <<Factory>>
        -_tipos : dict
        +criar(tipo: str)$ Musico
        +registrar(chave: str, classe)$ None
    }

    class ItemFactory {
        <<Factory>>
        -_catalogo : dict
        +criar(tipo: str)$ Item
        +registrar(chave: str, fabrica)$ None
    }

    class Item {
        +nome : str
        +descricao : str
        +consumir_ao_usar : bool = False
        +usar(alvo) None
        +to_dict() dict
    }

    class Equipavel {
        +atributo : str
        +bonus : int
        +classes_permitidas : tuple
        +consumir_ao_usar : bool = False
        +validar_alvo(alvo) None
        +usar(alvo) None
    }

    class Consumivel {
        +efeito : str
        +valor : int
        +consumir_ao_usar : bool = True
        +usar(alvo) None
    }

    class Inventario {
        +capacidade : int
        -_itens : list
        +__len__() int
        +__contains__(nome_item: str) bool
        +__repr__() str
        +adicionar(item) None
        +remover(item_id: str) Item
        +usar(item_id: str, alvo) None
        +listar() list
    }

    class JogoError {
        <<Exception>>
    }

    class InventarioError {
        <<Exception>>
    }

    class InventarioCheioError {
        <<Exception>>
    }

    class ItemNaoEncontradoError {
        <<Exception>>
    }

    class PersistenciaError {
        <<Exception>>
    }

    class CampanhaError {
        <<Exception>>
    }

    class VenueBloqueadaError {
        <<Exception>>
    }

    class EnergiaInsuficienteError {
        <<Exception>>
    }

    %% ── Hierarquia de Músicos ──────────────────────────────
    Musico <|-- Guitarrista
    Musico <|-- Vocalista
    Musico <|-- Baterista
    Guitarrista <|-- Baixista

    %% ── Hierarquia de Itens ───────────────────────────────
    Item <|-- Equipavel
    Item <|-- Consumivel

    %% ── Hierarquia de Exceções ────────────────────────────
    JogoError <|-- InventarioError
    JogoError <|-- PersistenciaError
    JogoError <|-- CampanhaError
    InventarioError <|-- InventarioCheioError
    InventarioError <|-- ItemNaoEncontradoError
    CampanhaError <|-- VenueBloqueadaError
    JogoError <|-- EnergiaInsuficienteError

    %% ── Relações de Associação ────────────────────────────
    GerenciadorJogo --> MusicoFactory : usa
    GerenciadorJogo --> ItemFactory : usa
    GerenciadorJogo "1" --> "0..4" Musico : _banda
    Musico "1" --> "1" Inventario : tem
    Inventario "1" --> "0..*" Item : contém
```

---

## Legenda

### Estereótipos

| Estereótipo | Significado |
|-------------|-------------|
| `<<abstract>>` | Classe abstrata (ABC) — não pode ser instanciada diretamente; define a interface e o esqueleto via `@abstractmethod` |
| `<<Singleton>>` | Única instância global — controlada por `__new__` com `_instancia` de classe |
| `<<Factory>>` | Factory Method — centraliza a criação de objetos por tipo-string; extensível via `registrar()` |
| `<<Exception>>` | Classe de exceção do domínio — derivada de `JogoError` (raiz da hierarquia) |

### Três hierarquias principais

1. **Musico** — hierarquia de personagens: `Musico` (ABC) → `Guitarrista`, `Vocalista`, `Baterista`;
   `Guitarrista` → `Baixista` (Baixista herda de Guitarrista, pois compartilha o atributo de força).

2. **Item** — hierarquia de itens: `Item` (base) → `Equipavel` (ocupa slot, bônus de atributo)
   e `Consumivel` (efeito único, destruído ao usar).

3. **JogoError** — hierarquia de exceções: `JogoError` é a raiz; ramos cobrem
   `InventarioError`, `PersistenciaError`, `CampanhaError` e seus subtipos específicos.
   Permite capturar erros no nível certo (`except JogoError` para tudo,
   `except InventarioError` só para o inventário).
