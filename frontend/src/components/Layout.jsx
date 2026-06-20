import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import UserMenu from './UserMenu';

export default function Layout({ title, subtitle, action, children }) {
  return (
    <div className="min-h-full bg-gray-900">
      <Sidebar />

      <div className="lg:pl-64 pb-16 lg:pb-0">
        <div className="w-full px-4 sm:px-6 pt-5 pb-4">

          {/* ── Header desktop: tudo numa linha ── */}
          <div className="hidden sm:flex items-center justify-between gap-4 mb-5">
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">{title}</h1>
              {subtitle && <p className="text-gray-400 text-sm mt-0.5">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {action}
              <UserMenu />
            </div>
          </div>

          {/* ── Header mobile: duas linhas ── */}
          <div className="sm:hidden mb-5">
            {/* linha 1: título + user menu */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <h1 className="text-lg font-bold leading-tight">{title}</h1>
              <UserMenu />
            </div>
            {/* linha 2: subtitle + action */}
            <div className="flex items-center justify-between gap-2">
              {subtitle
                ? <p className="text-gray-400 text-xs flex-1 min-w-0">{subtitle}</p>
                : <span />}
              {action && <div className="shrink-0">{action}</div>}
            </div>
          </div>

          {children}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
