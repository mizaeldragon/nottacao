import { NavLink } from 'react-router-dom';
import { Wrench, DollarSign, History, ShoppingCart, PiggyBank, UserSquare, LayoutDashboard, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { to: '/servicos',   label: 'Serviços',   icon: Wrench },
  { to: '/caixa',      label: 'Caixa',      icon: DollarSign },
  { to: '/estoque',    label: 'Estoque',    icon: ShoppingCart },
  { to: '/clientes',   label: 'Clientes',   icon: UserSquare },
  { to: '/historico',  label: 'Relatório',  icon: History },
  { to: '/relatorio-ia', label: 'Rel. IA',    icon: Sparkles,  soAdmin: true },
  { to: '/financeiro',  label: 'Financeiro', icon: PiggyBank, soAdmin: true },
];

export default function BottomNav() {
  const { usuario } = useAuth();
  const ehAdmin = usuario?.role === 'admin';
  const itens = NAV.filter((n) => !n.soAdmin || ehAdmin);

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch border-t"
      style={{ backgroundColor: '#0f172a', borderColor: '#1e293b', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {itens.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 flex-1 min-w-0 py-2.5 px-1 transition-colors ${
              isActive ? 'text-orange-500' : 'text-gray-400 hover:text-gray-200'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="text-[9px] font-semibold leading-none truncate w-full text-center">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
