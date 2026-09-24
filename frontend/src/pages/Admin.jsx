import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Shield, LogOut, Building2, Users, CheckCircle, XCircle, Clock, DollarSign, Ban, PlayCircle, Trash2,
  MoreVertical, CalendarClock, KeyRound, Copy, Check } from 'lucide-react';
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
  const [trialData, setTrialData] = useState(''); // data de expiração ao ativar
  const [vencModal, setVencModal] = useState(null); // { tenant } — editar vencimento
  const [senhaModal, setSenhaModal] = useState(null); // { tenant, nome, email, senha } — senha temporária
  const [menuAberto, setMenuAberto] = useState(null); // id do tenant com o menu ⋮ aberto

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
        await adminApi.patch(`/tenants/${acao.tenant.id}/status`, {
          status: acao.novoStatus,
          trial_expira_em: acao.novoStatus === 'ativo' ? trialData || null : null,
        });
        const labels = { ativo: 'ativada', bloqueado: 'bloqueada', pendente: 'marcada como pendente' };
        setMsg(`"${acao.tenant.nome}" ${labels[acao.novoStatus]}.`);
      }
      setAcao(null);
      setTrialData('');
      await carregar();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao executar ação');
      setAcao(null);
    }
    setTimeout(() => setMsg(''), 4000);
  }

  async function salvarVencimento(novaData) {
    try {
      await adminApi.patch(`/tenants/${vencModal.tenant.id}/vencimento`, {
        trial_expira_em: novaData || null,
      });
      setMsg(
        novaData
          ? `Vencimento de "${vencModal.tenant.nome}" alterado.`
          : `"${vencModal.tenant.nome}" ficou sem data de vencimento.`
      );
      setVencModal(null);
      await carregar();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao salvar vencimento');
      setVencModal(null);
    }
    setTimeout(() => setMsg(''), 4000);
  }

  async function resetarSenha(tenant) {
    try {
      const { data } = await adminApi.post(`/tenants/${tenant.id}/resetar-senha`);
      setSenhaModal({ tenant, nome: data.nome, email: data.email, senha: data.senha });
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao resetar senha');
      setTimeout(() => setErro(''), 4000);
    }
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
              ) : acao.novoStatus === 'ativo' ? (
                <div className="mb-5">
                  <p className="text-gray-300 text-sm mb-4">
                    Ativar <strong>{acao.tenant.nome}</strong>? O acesso será liberado imediatamente.
                  </p>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">
                    Desativar automaticamente em (opcional)
                  </label>
                  <input
                    type="date"
                    value={trialData}
                    onChange={e => setTrialData(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    className="w-full h-10 bg-gray-700 border border-gray-600 rounded-lg px-3 text-sm outline-none focus:border-emerald-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Deixe em branco para ativar sem data de expiração.</p>
                </div>
              ) : (
                <p className="text-gray-300 text-sm mb-5">
                  Bloquear <strong>{acao.tenant.nome}</strong>? O acesso será suspenso.
                </p>
              )}
              <div className="flex gap-3 justify-end">
                <button onClick={() => { setAcao(null); setTrialData(''); }}
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

        {vencModal && (
          <VencimentoModal
            tenant={vencModal.tenant}
            onSalvar={salvarVencimento}
            onFechar={() => setVencModal(null)}
          />
        )}

        {senhaModal && (
          <SenhaTemporariaModal dados={senhaModal} onFechar={() => setSenhaModal(null)} />
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
                  <th className="py-2 pr-4 text-right">EXPIRA EM</th>
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
                        <td className="py-3 pr-4 text-right">
                          {t.trial_expira_em
                            ? <span className={`text-xs font-semibold ${new Date(t.trial_expira_em) < new Date() ? 'text-red-400' : 'text-yellow-400'}`}>{dataBR(t.trial_expira_em)}</span>
                            : <span className="text-gray-600">—</span>}
                        </td>
                        <td className="py-3 pr-4 text-right text-gray-400">{dataBR(t.created_at)}</td>
                        <td className="py-3 text-right">
                          <MenuAcoes
                            aberto={menuAberto === t.id}
                            onAbrir={() => setMenuAberto(menuAberto === t.id ? null : t.id)}
                            onFechar={() => setMenuAberto(null)}
                            itens={[
                              t.status !== 'ativo'
                                ? {
                                    label: 'Ativar',
                                    Icon: PlayCircle,
                                    cls: 'text-emerald-400',
                                    onClick: () => setAcao({ tenant: t, novoStatus: 'ativo' }),
                                  }
                                : {
                                    label: 'Bloquear',
                                    Icon: Ban,
                                    cls: 'text-red-400',
                                    onClick: () => setAcao({ tenant: t, novoStatus: 'bloqueado' }),
                                  },
                              {
                                label: 'Editar vencimento',
                                Icon: CalendarClock,
                                onClick: () => setVencModal({ tenant: t }),
                              },
                              {
                                label: 'Resetar senha',
                                Icon: KeyRound,
                                onClick: () => resetarSenha(t),
                              },
                              {
                                label: 'Excluir borracharia',
                                Icon: Trash2,
                                cls: 'text-red-400',
                                separador: true,
                                onClick: () => setAcao({ tenant: t, excluir: true }),
                              },
                            ]}
                          />
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

// Menu ⋮ de ações da linha. Vai em portal com position fixed porque o wrapper da
// tabela tem overflow-x-auto — e overflow em um eixo faz o navegador cortar no outro.
// Fecha ao clicar fora, apertar Esc ou rolar a página.
function MenuAcoes({ aberto, onAbrir, onFechar, itens }) {
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);

  // Altura estimada pra decidir se abre pra baixo ou pra cima perto do rodapé.
  const altura = itens.length * 37 + itens.filter((i) => i.separador).length * 13 + 12;
  const LARGURA = 208; // w-52

  useEffect(() => {
    if (!aberto) {
      setPos(null);
      return;
    }
    const posicionar = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const abaixo = r.bottom + 6;
      const cabe = abaixo + altura <= window.innerHeight - 8;
      setPos({
        top: cabe ? abaixo : Math.max(8, r.top - altura - 6),
        left: Math.max(8, Math.min(r.right - LARGURA, window.innerWidth - LARGURA - 8)),
      });
    };
    posicionar();

    const clicouFora = (e) => {
      if (btnRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
      onFechar();
    };
    const tecla = (e) => e.key === 'Escape' && onFechar();
    document.addEventListener('mousedown', clicouFora);
    document.addEventListener('keydown', tecla);
    window.addEventListener('scroll', onFechar, true);
    window.addEventListener('resize', onFechar);
    return () => {
      document.removeEventListener('mousedown', clicouFora);
      document.removeEventListener('keydown', tecla);
      window.removeEventListener('scroll', onFechar, true);
      window.removeEventListener('resize', onFechar);
    };
  }, [aberto, altura, onFechar]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={onAbrir}
        title="Ações"
        aria-haspopup="menu"
        aria-expanded={aberto}
        className={`h-8 w-8 inline-flex items-center justify-center rounded-lg border transition-colors ${
          aberto
            ? 'border-gray-500 bg-gray-700 text-gray-100'
            : 'border-transparent hover:bg-gray-700 text-gray-400'
        }`}
      >
        <MoreVertical size={16} />
      </button>

      {aberto && pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: LARGURA }}
            className="z-50 rounded-xl border border-gray-700 bg-gray-800 shadow-xl py-1.5"
          >
            {itens.map((it) => (
              <div key={it.label}>
                {it.separador && <div className="my-1.5 border-t border-gray-700" />}
                <button
                  role="menuitem"
                  onClick={() => {
                    onFechar();
                    it.onClick();
                  }}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-left hover:bg-gray-700 transition-colors ${
                    it.cls || 'text-gray-100'
                  }`}
                >
                  <it.Icon size={15} className="shrink-0" />
                  {it.label}
                </button>
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}

// Edita só a data de expiração, sem mexer no status.
function VencimentoModal({ tenant, onSalvar, onFechar }) {
  const [data, setData] = useState(
    tenant.trial_expira_em ? String(tenant.trial_expira_em).slice(0, 10) : ''
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
        <h3 className="font-bold text-lg mb-1">Editar vencimento</h3>
        <p className="text-sm text-gray-400 mb-4">{tenant.nome}</p>

        <label className="block text-xs font-semibold text-gray-400 mb-1.5">
          Desativar automaticamente em
        </label>
        <input
          type="date"
          value={data}
          autoFocus
          onChange={(e) => setData(e.target.value)}
          className="w-full h-10 bg-gray-700 border border-gray-600 rounded-lg px-3 text-sm outline-none focus:border-orange-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          Em branco = sem data de vencimento. O status atual não muda.
        </p>

        <div className="flex gap-3 justify-end mt-5">
          <button
            onClick={onFechar}
            className="h-10 px-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSalvar(data)}
            className="h-10 px-4 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-semibold"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// Mostra a senha temporária UMA vez — depois daqui ela não é mais recuperável.
function SenhaTemporariaModal({ dados, onFechar }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(dados.senha);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
        <h3 className="font-bold text-lg mb-1">Senha redefinida</h3>
        <p className="text-sm text-gray-400 mb-4">
          {dados.tenant.nome} — acesso de <strong className="text-gray-200">{dados.email}</strong>
        </p>

        <div className="bg-gray-700 border border-gray-600 rounded-xl p-3 flex items-center justify-between gap-3">
          <code className="text-lg font-bold tracking-wider break-all">{dados.senha}</code>
          <button
            onClick={copiar}
            title="Copiar senha"
            className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-600 text-gray-300"
          >
            {copiado ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
          </button>
        </div>

        <p className="text-xs text-amber-600 mt-3">
          Anote agora: essa senha não aparece de novo. A senha antiga e os links de
          "esqueci minha senha" já não valem mais.
        </p>

        <button
          onClick={onFechar}
          className="mt-5 w-full h-10 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-semibold"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}
