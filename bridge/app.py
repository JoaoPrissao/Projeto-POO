"""Entrypoint pywebview: cria a janela e expõe a API ao JavaScript.

Rodar com:  python bridge/app.py
O JS chama os métodos via  window.pywebview.api.<metodo>(...)  → Promise.
"""
import os

import webview

from api import API

FRONTEND = os.path.join(os.path.dirname(__file__), "..", "frontend", "index.html")


def main() -> None:
    api = API()
    # Ajuste 3: MAXIMIZADO (não fullscreen) — preserva os controles de janela
    # (barra de título, fechar, minimizar). fullscreen=True prendia o usuário
    # sem forma de sair pelo sistema operacional. maximized=True preenche a
    # tela mantendo a barra de título e o botão de fechar nativo.
    webview.create_window(
        title="RPG Manager — A Banda",
        url=os.path.abspath(FRONTEND),
        js_api=api,
        width=960,
        height=640,
        min_size=(720, 520),
        maximized=True,
    )
    webview.start()


if __name__ == "__main__":
    main()
