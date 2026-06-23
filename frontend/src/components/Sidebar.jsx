import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Wrench, DollarSign, History, ShoppingCart, PiggyBank, UserSquare, LayoutDashboard, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const NAV = [
  { to: '/dashboard',  label: 'Dashboard',        icon: LayoutDashboard },
  { to: '/servicos',   label: 'Serviços',         icon: Wrench },
  { to: '/caixa',      label: 'Caixa',            icon: DollarSign },
  { to: '/estoque',    label: 'Vendas & Estoque', icon: ShoppingCart, alerta: 'estoque' },
  { to: '/clientes',   label: 'Clientes Fiado',   icon: UserSquare },
  { to: '/historico',  label: 'Relatório',        icon: History },
  { to: '/relatorio-ia', label: 'Relatório IA',    icon: Sparkles, soAdmin: true },
  { to: '/financeiro',  label: 'Financeiro',       icon: PiggyBank, soAdmin: true },
];

export default function Sidebar() {
  const { usuario } = useAuth();
  const [estoqueBaixo, setEstoqueBaixo] = useState(0);
  const ehAdmin = usuario?.role === 'admin';
  const navItens = NAV.filter((n) => !n.soAdmin || ehAdmin);

  useEffect(() => {
    api.get('/estoque/alertas')
      .then(({ data }) => setEstoqueBaixo(data.baixo || 0))
      .catch(() => {});
  }, []);

  return (
    <aside className="hidden lg:flex fixed top-0 left-0 z-50 h-full w-64 bg-gray-900 border-r border-gray-700 flex-col">
      {/* Logo */}
      <div className="px-4 pt-5 pb-3">
        <img src="/logo.png" alt="nottação" className="h-11 w-auto" />
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItens.map(({ to, label, icon: Icon, alerta }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-300 hover:text-gray-100 hover:bg-gray-800'
              }`
            }
          >
            <Icon size={18} />
            <span className="flex-1">{label}</span>
            {alerta === 'estoque' && estoqueBaixo > 0 && (
              <span
                className="min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center"
                title={`${estoqueBaixo} produto(s) com estoque baixo`}
              >
                {estoqueBaixo}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
