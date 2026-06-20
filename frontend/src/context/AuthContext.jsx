import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  // Carrega os dados do usuário a partir do token salvo
  async function carregarUsuario() {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      setUsuario(data.usuario);
      setTenant(data.tenant);
    } catch {
      localStorage.removeItem('token');
      setUsuario(null);
      setTenant(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarUsuario();
  }, []);

  async function login(email, senha) {
    const { data } = await api.post('/auth/login', { email, senha });
    localStorage.setItem('token', data.token);
    setUsuario(data.usuario);
    setTenant(data.tenant);
    return data;
  }

  async function registrar(nome, email, senha, telefone, documento) {
    const { data } = await api.post('/auth/registro', { nome, email, senha, telefone, documento });
    localStorage.setItem('token', data.token);
    setUsuario(data.usuario);
    setTenant(data.tenant);
    return data;
  }

  function logout() {
    localStorage.removeItem('token');
    setUsuario(null);
    setTenant(null);
  }

  // Atualiza apenas o status do tenant (após pagamento)
  async function atualizarStatus() {
    try {
      const { data } = await api.get('/asaas/status');
      setTenant((t) => ({ ...t, status: data.status, payment_link: data.paymentLink }));
      return data.status;
    } catch {
      return null;
    }
  }

  return (
    <AuthContext.Provider
      value={{
        usuario,
        tenant,
        loading,
        login,
        registrar,
        logout,
        atualizarStatus,
        recarregar: carregarUsuario,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
