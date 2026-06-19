"""Entrypoint pywebview: cria a janela e expõe a API ao JavaScript.

Rodar com:  python bridge/app.py
O JS chama os métodos via  window.pywebview.api.<metodo>(...)  → Promise.
"""
import os
import tempfile

import webview

from api import API

FRONTEND = os.path.join(os.path.dirname(__file__), "..", "frontend", "index.html")


def _gerar_icone_temp() -> str | None:
    """Gera ícone .ico 32×32 via Pillow em runtime (sem binário no repo).

    Formato ICO (não PNG): no Windows o backend WinForms usa System.Drawing.Icon,
    que só aceita .ico — um PNG derruba o app dentro de webview.start(). ICO é
    multiplataforma o bastante para os demais backends.

    Retorna o caminho do arquivo temporário, ou None se Pillow não estiver
    disponível — o app continua funcionando normalmente sem ícone (D-15).
    """
    try:
        from PIL import Image, ImageDraw  # type: ignore[import]

        img = Image.new("RGBA", (32, 32), (20, 17, 28, 255))  # --bg #14111c
        draw = ImageDraw.Draw(img)
        # "D" simplificado em âmbar (#d4921e) — 3 pixels de largura no centro
        cor_ambar = (212, 146, 30, 255)
        for row in range(8, 24):
            draw.point((12, row), fill=cor_ambar)
        for col in range(13, 19):
            draw.point((col, 8), fill=cor_ambar)
            draw.point((col, 23), fill=cor_ambar)
        for row in range(9, 23):
            draw.point((19, row), fill=cor_ambar)

        tmp = tempfile.NamedTemporaryFile(suffix=".ico", delete=False)
        img.save(tmp.name, format="ICO", sizes=[(32, 32)])
        tmp.close()
        return tmp.name
    except Exception:
        return None


def main() -> None:
    api = API()

    # D-15: ícone gerado em runtime via Pillow (fallback gracioso se ausente)
    icone = _gerar_icone_temp()

    # Ajuste 3: MAXIMIZADO (não fullscreen) — preserva os controles de janela
    # (barra de título, fechar, minimizar). fullscreen=True prendia o usuário
    # sem forma de sair pelo sistema operacional. maximized=True preenche a
    # tela mantendo a barra de título e o botão de fechar nativo.
    webview.create_window(
        title="Decibéis",
        url=os.path.abspath(FRONTEND),
        js_api=api,
        width=960,
        height=640,
        min_size=(720, 520),
        maximized=True,
    )
    # D-15: o ícone da aplicação é passado a start(), não a create_window()
    # — nesta versão do pywebview o parâmetro `icon` só existe em start().
    start_kwargs = {"icon": icone} if icone else {}
    try:
        webview.start(**start_kwargs)
    finally:
        # CR-01: o .ico é criado com delete=False; remove ao fechar a janela
        # (start() só retorna quando o usuário fecha) para não vazar em %TEMP%.
        if icone:
            try:
                os.unlink(icone)
            except OSError:
                pass


if __name__ == "__main__":
    main()
