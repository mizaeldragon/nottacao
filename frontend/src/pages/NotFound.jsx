import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950">
      <div className="text-center">
        <p className="text-8xl font-extrabold text-blue-600 mb-4">404</p>
        <h1 className="text-2xl font-bold text-white mb-2">Página não encontrada</h1>
        <p className="text-slate-400 text-sm mb-8">O endereço que você acessou não existe.</p>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white font-bold text-sm hover:-translate-y-0.5 transition-all shadow-lg shadow-blue-500/30"
        >
          <Home size={16} />
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
