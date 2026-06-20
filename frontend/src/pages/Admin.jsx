import { useEffect, useState } from 'react';
import axios from 'axios';
import { Shield, LogOut, Building2, Users, CheckCircle, XCircle, Clock, DollarSign, Ban, PlayCircle, Trash2 } from 'lucide-react';
import { brl, dataBR } from '../utils/format';
import { usePaginacao } from '../hooks/usePaginacao';
import Paginacao from '../components/Paginacao';

// Instância isolada (não usa o token do tenant nem os interceptors do app)
const adminApi = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/admin`,
});
adminApi.interceptors.request.use((config) => {
  const t = localStorage.getItem('admin_token');
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export default function Admin() {
  const [logado, setLogado] = useState(!!localStorage.getItem('admin_token'));

  if (!logado) return <AdminLogin onLogin={() => setLogado(true)} />;
  return <AdminPainel onLogout={() => { localStorage.removeItem('admin_token'); setLogado(false); }} />;
}

function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    setErro('');
    setEntrando(true);
    try {
      const { data } = await adminApi.post('/login', { email, senha });
      localStorage.setItem('admin_token', data.token);
      onLogin();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao entrar');
      setEntrando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <form onSubmit={entrar} className="w-full max-w-sm bg-gray-800 border border-gray-700 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <span className="w-10 h-10 rounded-lg bg-orange-500/15 flex items-center justify-center text-orange-500">
            <Shield size={22} />
          </span>
          <div>
            <h1 className="font-bold text-lg">Painel Super-Admin</h1>
            <p className="text-xs text-gray-400">Acesso restrito ao dono do SaaS</p>
          </div>
        </div>
        <div className="space-y-3">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail"
            className="w-full h-12 bg-gray-700 border border-gray-600 rounded-lg px-3 outline-none focus:border-orange-500" />
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha"
            className="w-full h-12 bg-gray-700 border border-gray-600 rounded-lg px-3 outline-none focus:border-orange-500" />
        </div>
        {erro && <p className="text-red-400 text-sm mt-3">{erro}</p>}
        <button type="submit" disabled={entrando}
          className="mt-4 w-full h-12 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg font-semibold">
          Entrar
        </button>
      </form>
    </div>
  );
}

function AdminPainel({ onLogout }) {
  const [resumo, setResumo] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');
  const [acao, setAcao] = useState(null); // { tenant, novoStatus } | { tenant, excluir: true }

  function carregar() {
    return Promise.all([adminApi.get('/resumo'), adminApi.get('/tenants')])
      .then(([r, t]) => {
        setResumo(r.data);
        setTenants(t.data);
      })
      .catch((err) => {
        if (err.response?.status === 401) onLogout();
        else setErro(err.response?.data?.error || 'Erro ao carregar');
      });
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirmarAcao() {
    if (!acao) return;
    try {
      if (acao.excluir) {
        await adminApi.delete(`/tenants/${acao.tenant.id}`);
        setMsg(`"${acao.tenant.nome}" excluída.`);
      } else {
        await adminApi.patch(`/tenants/${acao.tenant.id}/status`, { status: acao.novoStatus });
        const labels = { ativo: 'ativada', bloqueado: 'bloqueada', pendente: 'marcada como pendente' };
        setMsg(`"${acao.tenant.nome}" ${labels[acao.novoStatus]}.`);
      }
      setAcao(null);
      await carregar();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao executar ação');
      setAcao(null);
    }
    setTimeout(() => setMsg(''), 4000);
  }

  const STATUS = {
    ativo: { label: 'Ativo', cls: 'bg-emerald-500/15 text-emerald-400', Icon: CheckCircle },
    bloqueado: { label: 'Bloqueado', cls: 'bg-red-500/15 text-red-400', Icon: XCircle },
    pendente: { label: 'Pendente', cls: 'bg-yellow-500/15 text-yellow-500', Icon: Clock },
  };

  const { pagina, setPagina, totalPaginas, total, itens } = usePaginacao(tenants, 12);

  return (
    <div className="min-h-screen bg-gray-900 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="w-10 h-10 rounded-lg bg-orange-500/15 flex items-center justify-center text-orange-500">
              <Shield size={22} />
            </span>
            <h1 className="text-2xl font-bold">Painel Super-Admin</h1>
          </div>
          <button onClick={onLogout} className="h-10 px-4 flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-700">
            <LogOut size={16} /> Sair
          </button>
        </div>

        {erro && <p className="text-red-400 text-sm mb-3">{erro}</p>}
        {msg && <p className="text-emerald-400 text-sm mb-3">{msg}</p>}

        {/* Modal de confirmação */}
        {acao && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
              <h3 className="font-bold text-lg mb-2">Confirmar ação</h3>
              {acao.excluir ? (
                <p className="text-gray-300 text-sm mb-5">
                  Excluir <strong>{acao.tenant.nome}</strong> permanentemente? Todos os dados serão perdidos.
                </p>
              ) : (
                <p className="text-gray-300 text-sm mb-5">
                  {acao.novoStatus === 'ativo' && <>Ativar <strong>{acao.tenant.nome}</strong>? O acesso será liberado imediatamente.</>}
                  {acao.novoStatus === 'bloqueado' && <>Bloquear <strong>{acao.tenant.nome}</strong>? O acesso será suspenso.</>}
                </p>
              )}
              <div className="flex gap-3 justify-end">
                <button onClick={() => setAcao(null)}
                  className="h-10 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium">
                  Cancelar
                </button>
                <button onClick={confirmarAcao}
                  className={`h-10 px-4 rounded-lg text-sm font-medium text-white ${acao.excluir ? 'bg-red-600 hover:bg-red-700' : acao.novoStatus === 'ativo' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
                  {acao.excluir ? 'Excluir' : acao.novoStatus === 'ativo' ? 'Ativar' : 'Bloquear'}
                </button>
              </div>
            </div>
          </div>
        )}

        {resumo && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card label="BORRACHARIAS" valor={resumo.total_tenants} icon={Building2} />
            <Card label="ATIVAS" valor={resumo.ativos} icon={CheckCircle} />
            <Card label="MRR (ASSINATURAS)" valor={brl(resumo.mrr)} icon={DollarSign} destaque />
            <Card label="FATURAMENTO DOS CLIENTES" valor={brl(resumo.faturamento_clientes)} icon={Users} />
          </div>
        )}

        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5">
          <h2 className="font-bold mb-4">Borracharias assinantes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold tracking-wide text-gray-500 border-b border-gray-700">
                  <th className="py-2 pr-4">NOME</th>
                  <th className="py-2 pr-4">E-MAIL</th>
                  <th className="py-2 pr-4">STATUS</th>
                  <th className="py-2 pr-4">USUÁRIOS</th>
                  <th className="py-2 pr-4 text-right">FATURAMENTO</th>
                  <th className="py-2 pr-4 text-right">DESDE</th>
                  <th className="py-2 text-right">AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {tenants.length === 0 ? (
                  <tr><td colSpan={7} className="text-center text-gray-500 py-8">Nenhuma borracharia.</td></tr>
                ) : (
                  itens.map((t) => {
                    const s = STATUS[t.status] || STATUS.pendente;
                    return (
                      <tr key={t.id} className="border-b border-gray-700/50 last:border-0">
                        <td className="py-3 pr-4 font-medium">{t.nome}</td>
                        <td className="py-3 pr-4 text-gray-400">{t.email}</td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-1 ${s.cls}`}>
                            <s.Icon size={12} /> {s.label}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-gray-300">{t.usuarios}</td>
                        <td className="py-3 pr-4 text-right font-semibold">{brl(t.faturamento)}</td>
                        <td className="py-3 pr-4 text-right text-gray-400">{dataBR(t.created_at)}</td>
                        <td className="py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            {t.status !== 'ativo' && (
                              <button
                                onClick={() => setAcao({ tenant: t, novoStatus: 'ativo' })}
                                title="Ativar"
                                className="h-8 px-2.5 inline-flex items-center gap-1 bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-xs font-semibold transition-colors"
                              >
                                <PlayCircle size={13} /> Ativar
                              </button>
                            )}
                            {t.status === 'ativo' && (
                              <button
                                onClick={() => setAcao({ tenant: t, novoStatus: 'bloqueado' })}
                                title="Bloquear"
                                className="h-8 px-2.5 inline-flex items-center gap-1 bg-red-500/15 hover:bg-red-500/30 text-red-400 rounded-lg text-xs font-semibold transition-colors"
                              >
                                <Ban size={13} /> Bloquear
                              </button>
                            )}
                            <button
                              onClick={() => setAcao({ tenant: t, excluir: true })}
                              title="Excluir"
                              className="h-8 w-8 inline-flex items-center justify-center bg-gray-700 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <Paginacao pagina={pagina} totalPaginas={totalPaginas} total={total} onPagina={setPagina} />
        </div>
      </div>
    </div>
  );
}

function Card({ label, valor, icon: Icon, destaque }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold tracking-wide text-gray-400">{label}</p>
        <Icon size={18} className="text-gray-500" />
      </div>
      <p className={`text-2xl font-bold mt-2 ${destaque ? 'text-orange-500' : ''}`}>{valor}</p>
    </div>
  );
}
