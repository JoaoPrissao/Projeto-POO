# Empacotamento e Distribuição — Decibéis

Este documento descreve como distribuir e executar o jogo **Decibéis** em duas modalidades:

- **Parte 1 — Caminho Garantido:** rodar do zero com Python instalado (recomendado para entrega).
- **Parte 2 — Bônus Best-Effort:** gerar um `.exe` standalone via PyInstaller (sem Python necessário).

---

## Parte 1 — Caminho Garantido: rodar do zero

> **Este é o método de distribuição recomendado e suficiente para a entrega.**
> Funciona em qualquer Windows 10/11 com Python instalado; não depende de pré-compilação.

### Pré-requisitos

| Requisito | Versão mínima | Onde obter |
|-----------|--------------|------------|
| **Python** | 3.12+ | [python.org/downloads](https://www.python.org/downloads/) |
| **WebView2 Runtime** | qualquer | Presente no Windows 10/11 atualizado. Em máquinas antigas ou fresh-install, baixar em [developer.microsoft.com/microsoft-edge/webview2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) |

### Passo a passo

```bash
# 1. Clone ou descompacte o projeto
git clone https://github.com/JoaoPrissao/Projeto-POO.git
cd Projeto-POO

# 2. Criar ambiente virtual
python -m venv .venv

# 3. Ativar o ambiente virtual (Windows)
.venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate

# 4. Instalar dependências
pip install -r requirements.txt

# 5. Executar o jogo
python bridge/app.py
```

A janela **Decibéis** abrirá maximizada automaticamente via pywebview.

### Verificação rápida

```bash
# Rodar a suite de testes para confirmar o ambiente
python -m pytest -q
# Esperado: 361 passed
```

---

## Parte 2 — Bônus Best-Effort: `.exe` via PyInstaller

> **AVISO: esta seção é best-effort.** A entrega válida é a Parte 1.
> Se o `.exe` não abrir (causa provável: WebView2 ausente ou hidden import faltando — veja
> Armadilhas abaixo), documente o sintoma e utilize a Parte 1 como caminho de distribuição.

### Pré-requisito adicional

- **WebView2 Runtime** instalado na máquina onde o `.exe` for executado (mesmo requisito da Parte 1, mas sem Python disponível para diagnóstico).

### Comando de build

A partir da raiz do projeto (com `.venv` ativo e `pyinstaller` disponível via `requirements.txt`):

```bash
python -m PyInstaller \
  --onefile \
  --windowed \
  --add-data "frontend;frontend" \
  --collect-all webview \
  --hidden-import PIL \
  --hidden-import PIL.Image \
  --hidden-import PIL.ImageDraw \
  --name "Decibeis" \
  bridge/app.py
```

Saída: `dist/Decibeis.exe`

> **Nota sobre o `_MEIPASS`:** o `bridge/app.py` já resolve o caminho do frontend via
> `getattr(sys, '_MEIPASS', ...)`, portanto o `--add-data "frontend;frontend"` funcionará
> corretamente dentro do bundle.

### Armadilhas conhecidas

| Problema | Sintoma | Mitigação |
|----------|---------|-----------|
| **WebView2 runtime ausente** | App abre e fecha imediatamente no Windows | Pré-requisito da máquina destino; instruir o usuário a instalar antes de executar o `.exe` |
| **`frontend/` não encontrado** | `FileNotFoundError` ao abrir `index.html` | Usar `--add-data "frontend;frontend"` + o fix `_MEIPASS` em `app.py` (já aplicado) |
| **Imports implícitos do webview** | `ModuleNotFoundError: webview.platforms` | `--collect-all webview` copia todo o pacote incluindo plataformas; se persistir, adicionar `--hidden-import webview.platforms.winforms` |
| **Pillow hidden imports** | `ModuleNotFoundError: PIL._imaging` | `--hidden-import PIL --hidden-import PIL.Image --hidden-import PIL.ImageDraw` (já no comando) |

### Se o `.exe` não abrir

1. Execute pelo terminal (não duplo-clique): `dist\Decibeis.exe` — o console mostrará o erro.
2. Se `ModuleNotFoundError: No module named 'webview.platforms.winforms'`: adicionar `--hidden-import webview.platforms.winforms` ao comando e recompilar.
3. Se a janela abrir e fechar instantaneamente: verificar WebView2 Runtime instalado.
4. Se não resolver em tempo razoável: a entrega válida é a **Parte 1** (rodar do zero).

---

## Referência rápida

| Método | Python necessário | Garantido | Notas |
|--------|------------------|-----------|-------|
| Parte 1 — `python bridge/app.py` | Sim (3.12+) | **Sim** | Caminho de entrega |
| Parte 2 — `dist/Decibeis.exe` | Não | Best-effort | Requer WebView2; pode não abrir |
