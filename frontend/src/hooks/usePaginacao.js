import { useEffect, useMemo, useState } from 'react';

// Pagina uma lista no cliente. Retorna os itens da página atual + controles.
export function usePaginacao(lista, porPagina = 10) {
  const [pagina, setPagina] = useState(1);
  const total = lista.length;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  // Se a lista encolher (filtro, exclusão), volta para uma página válida
  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas);
  }, [pagina, totalPaginas]);

  const itens = useMemo(
    () => lista.slice((pagina - 1) * porPagina, pagina * porPagina),
    [lista, pagina, porPagina]
  );

  return { pagina, setPagina, totalPaginas, total, itens };
}
