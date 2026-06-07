from excecoes import InventarioCheioError, ItemNaoEncontradoError


class Inventario:
    """Coleção de itens com capacidade limitada. Identidade do item = `nome`."""

    def __init__(self, capacidade: int):
        self.capacidade = capacidade
        self._itens: list = []

    def __len__(self) -> int:
        return len(self._itens)

    def _buscar(self, item_id):
        for item in self._itens:
            if item.nome == item_id:
                return item
        return None

    def adicionar(self, item) -> None:
        if len(self._itens) >= self.capacidade:
            raise InventarioCheioError(
                f"Inventário cheio (capacidade {self.capacidade})."
            )
        self._itens.append(item)

    def remover(self, item_id):
        item = self._buscar(item_id)
        if item is None:
            raise ItemNaoEncontradoError(f"Item '{item_id}' não encontrado no inventário.")
        self._itens.remove(item)
        return item

    def usar(self, item_id, alvo) -> None:
        item = self._buscar(item_id)
        if item is None:
            raise ItemNaoEncontradoError(f"Item '{item_id}' não encontrado no inventário.")
        item.usar(alvo)  # pode levantar ItemIncompativelError (item não é consumido)
        if item.consumir_ao_usar:
            self._itens.remove(item)

    def listar(self) -> list:
        return list(self._itens)
