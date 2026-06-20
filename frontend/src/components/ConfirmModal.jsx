import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({ mensagem, onOk, onCancelar }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-red-400" />
            </div>
            <h3 className="font-bold text-lg leading-tight">Confirmar exclusão</h3>
          </div>
          <button onClick={onCancelar} className="text-gray-400 hover:text-gray-200 p-1">
            <X size={18} />
          </button>
        </div>

        <p className="text-gray-300 text-sm mb-6 leading-relaxed pl-13">
          {mensagem || 'Tem certeza que deseja excluir? Esta ação não pode ser desfeita.'}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancelar}
            className="flex-1 h-11 rounded-xl bg-gray-700 hover:bg-gray-600 font-semibold text-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onOk}
            className="flex-1 h-11 rounded-xl bg-red-500 hover:bg-red-600 font-semibold text-white transition-colors"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
