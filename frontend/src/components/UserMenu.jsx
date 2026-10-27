import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, LogOut, ChevronDown, Moon, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTema } from '../context/TemaContext';

export default function UserMenu() {
  const { tenant, usuario, logout } = useAuth();
  const { escuro, alternar } = useTema();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const nome = tenant?.nome || usuario?.nome || 'Borracharia';
  const iniciais = nome
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  // Fecha ao clicar fora ou apertar ESC
  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full pl-1 pr-2 py-1 hover:bg-gray-700/60 transition-colors"
        aria-label="Menu da conta"
      >
        <span className="w-9 h-9 rounded-full bg-orange-500 text-white font-bold text-sm flex items-center justify-center shrink-0">
          {iniciais}
        </span>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-700">
            <p className="font-semibold truncate">{nome}</p>
            <p className="text-sm text-gray-400 truncate">{usuario?.email || ''}</p>
          </div>
          <button
            onClick={() => {
              setOpen(false);
              navigate('/cadastro');
            }}
            className="w-full flex items-center gap-3 px-4 h-11 text-left text-gray-200 hover:bg-gray-700/60 transition-colors"
          >
            <Settings size={18} className="text-gray-400" /> Configurações
          </button>
          <button
            onClick={alternar}
            className="w-full flex items-center justify-between gap-3 px-4 h-11 text-left text-gray-200 hover:bg-gray-700/60 transition-colors"
          >
            <span className="flex items-center gap-3">
              {escuro ? <Sun size={18} className="text-gray-400" /> : <Moon size={18} className="text-gray-400" />}
              Modo {escuro ? 'claro' : 'escuro'}
            </span>
            <span
              className={`w-9 h-5 rounded-full shrink-0 flex items-center px-0.5 transition-colors ${
                escuro ? 'bg-orange-500' : 'bg-gray-600'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full bg-gray-900 shadow transition-transform ${
                  escuro ? 'translate-x-4' : ''
                }`}
              />
            </span>
          </button>
          <button
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="w-full flex items-center gap-3 px-4 h-11 text-left text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={18} /> Sair da conta
          </button>
        </div>
      )}
    </div>
  );
}
