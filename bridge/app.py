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
    webview.create_window(
        title="RPG Manager — A Banda",
        url=os.path.abspath(FRONTEND),
        js_api=api,
        width=960,
        height=640,
        min_size=(720, 520),
    )
    webview.start()


if __name__ == "__main__":
    main()
