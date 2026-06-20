import { ChevronLeft, ChevronRight } from 'lucide-react';

// Controles de paginação. Some quando há só uma página.
export default function Paginacao({ pagina, totalPaginas, total, onPagina }) {
  if (totalPaginas <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 mt-4 text-sm">
      <span className="text-gray-400">
        Página {pagina} de {totalPaginas}
        {total != null ? ` · ${total} ${total === 1 ? 'item' : 'itens'}` : ''}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPagina(pagina - 1)}
          disabled={pagina <= 1}
          className="h-9 w-9 flex items-center justify-center rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Página anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => onPagina(pagina + 1)}
          disabled={pagina >= totalPaginas}
          className="h-9 w-9 flex items-center justify-center rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Próxima página"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
