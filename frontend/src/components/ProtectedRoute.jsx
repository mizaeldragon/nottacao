import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Protege rotas: exige JWT válido + plano ativo. `soAdmin` restringe ao dono.
export default function ProtectedRoute({ children, soAdmin }) {
  const { usuario, tenant, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        Carregando...
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  if (tenant && tenant.status !== 'ativo') {
    return <Navigate to="/login?bloqueado=1" replace />;
  }

  // Rota exclusiva do dono
  if (soAdmin && usuario.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
