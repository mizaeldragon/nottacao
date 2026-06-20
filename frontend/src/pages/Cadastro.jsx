import { useEffect, useState } from 'react';
import {
  UserPlus,
  Trash2,
  Plus,
  Tag,
  Pencil,
  Check,
  Building2,
  ShieldCheck,
  Users,
  KeyRound,
} from 'lucide-react';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { brl, maskTel } from '../utils/format';

const ABAS = [
  { id: 'empresa', label: 'Empresa', icon: Building2 },
  { id: 'funcionarios', label: 'Funcionários', icon: Users },
  { id: 'servicos', label: 'Serviços', icon: Tag },
  { id: 'usuarios', label: 'Usuários', icon: KeyRound, soAdmin: true },
  { id: 'seguranca', label: 'Segurança', icon: ShieldCheck },
];

export default function Cadastro() {
  const { usuario } = useAuth();
  const [aba, setAba] = useState('empresa');
  const abas = ABAS.filter((a) => !a.soAdmin || usuario?.role === 'admin');

  const abaAtiva = abas.find((a) => a.id === aba);

  return (
    <Layout title="Configurações" subtitle={abaAtiva?.label}>
      {/* Abas — mobile: só ícones; desktop: ícone + texto */}
      <div className="flex items-center gap-1 bg-gray-700/60 rounded-xl p-1 mb-4 w-full sm:w-auto sm:inline-flex">
        {abas.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            title={label}
            className={`flex items-center justify-center gap-2 h-10 rounded-lg text-sm font-semibold transition-colors
              flex-1 sm:flex-none sm:px-4
              ${aba === id
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-gray-300 hover:text-gray-100 hover:bg-gray-600'
              }`}
          >
            <Icon size={18} />
            <span className="hidden sm:inline whitespace-nowrap">{label}</span>
          </button>
        ))}
      </div>

      <div className="max-w-3xl">
        {aba === 'empresa' && <Empresa />}
        {aba === 'funcionarios' && <Funcionarios />}
        {aba === 'servicos' && <TiposServico />}
        {aba === 'usuarios' && usuario?.role === 'admin' && <Usuarios />}
        {aba === 'seguranca' && <Seguranca />}
      </div>
    </Layout>
  );
}

const CORES = ['bg-sky-500', 'bg-orange-500', 'bg-emerald-500', 'bg-purple-500', 'bg-rose-500'];
function corDoNome(nome = '') {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = nome.charCodeAt(i) + ((h << 5) - h);
  return CORES[Math.abs(h) % CORES.length];
}

const inputCls =
  'w-full h-10 bg-gray-700 border border-gray-600 rounded-lg px-3 outline-none focus:border-orange-500 text-sm';

// ===== Aba Empresa =====
function Empresa() {
  const { recarregar } = useAuth();
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [documento, setDocumento] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api.get('/auth/conta').then(({ data }) => {
      setNome(data.empresa.nome || '');
      setTelefone(data.empresa.telefone || '');
      setDocumento(data.empresa.documento || '');
    });
  }, []);

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    setOk('');
    if (!nome.trim()) return setErro('Informe o nome da empresa');
    setSalvando(true);
    try {
      await api.put('/auth/empresa', { nome, telefone, documento });
      setOk('Dados da empresa salvos.');
      recarregar?.(); // atualiza o nome exibido na sidebar
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center text-orange-500">
          <Building2 size={18} />
        </span>
        <h2 className="font-bold">Dados da Empresa</h2>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Nome da Borracharia</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Telefone <span className="text-gray-500">(opcional)</span>
            </label>
            <input
              value={telefone}
              onChange={(e) => setTelefone(maskTel(e.target.value))}
              placeholder="(11) 90000-0000"
              inputMode="numeric"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              CNPJ / CPF <span className="text-gray-500">(opcional)</span>
            </label>
            <input
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              placeholder="00.000.000/0000-00"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {erro && <p className="text-red-400 text-sm mt-3">{erro}</p>}
      {ok && <p className="text-green-400 text-sm mt-3">{ok}</p>}

      <button
        type="submit"
        disabled={salvando}
        className="mt-3 h-9 px-4 flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg font-semibold transition-colors"
      >
        <Check size={18} /> Salvar alterações
      </button>
    </form>
  );
}

// ===== Aba Segurança =====
function Seguranca() {
  return (
    <div className="space-y-3">
      <TrocarEmail />
      <TrocarSenha />
    </div>
  );
}

function TrocarEmail() {
  const [emailAtual, setEmailAtual] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api.get('/auth/conta').then(({ data }) => {
      setEmailAtual(data.email);
      setEmail(data.email);
    });
  }, []);

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    setOk('');
    if (!email.includes('@')) return setErro('E-mail inválido');
    if (!senha) return setErro('Confirme com a senha atual');
    setSalvando(true);
    try {
      const { data } = await api.put('/auth/email', { email, senha });
      setEmailAtual(data.email);
      setEmail(data.email);
      setSenha('');
      setOk('E-mail atualizado. Use o novo e-mail no próximo login.');
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao trocar e-mail');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center text-orange-500">
          <ShieldCheck size={18} />
        </span>
        <h2 className="font-bold">E-mail da Conta</h2>
      </div>
      <p className="text-sm text-gray-400 mb-4">É o e-mail usado para entrar no sistema.</p>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Novo e-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Senha atual</label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Para confirmar a alteração"
            className={inputCls}
          />
        </div>
      </div>

      {erro && <p className="text-red-400 text-sm mt-3">{erro}</p>}
      {ok && <p className="text-green-400 text-sm mt-3">{ok}</p>}

      <button
        type="submit"
        disabled={salvando || email === emailAtual}
        className="mt-3 h-9 px-4 flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg font-semibold transition-colors"
      >
        <Check size={18} /> Salvar e-mail
      </button>
    </form>
  );
}

function TrocarSenha() {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    setOk('');
    if (nova.length < 6) return setErro('A nova senha deve ter ao menos 6 caracteres');
    if (nova !== confirma) return setErro('A confirmação não confere');
    setSalvando(true);
    try {
      await api.put('/auth/senha', { senha_atual: atual, nova_senha: nova });
      setAtual('');
      setNova('');
      setConfirma('');
      setOk('Senha alterada com sucesso.');
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao trocar senha');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center text-orange-500">
          <ShieldCheck size={18} />
        </span>
        <h2 className="font-bold">Trocar Senha</h2>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Senha atual</label>
          <input
            type="password"
            value={atual}
            onChange={(e) => setAtual(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Nova senha</label>
            <input
              type="password"
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Confirmar nova senha</label>
            <input
              type="password"
              value={confirma}
              onChange={(e) => setConfirma(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {erro && <p className="text-red-400 text-sm mt-3">{erro}</p>}
      {ok && <p className="text-green-400 text-sm mt-3">{ok}</p>}

      <button
        type="submit"
        disabled={salvando}
        className="mt-3 h-9 px-4 flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg font-semibold transition-colors"
      >
        <Check size={18} /> Alterar senha
      </button>
    </form>
  );
}

// ===== Aba Usuários (logins) — somente admin =====
function Usuarios() {
  const { usuario } = useAuth();
  const [lista, setLista] = useState([]);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [role, setRole] = useState('funcionario');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [confirmar, setConfirmar] = useState(null); // { mensagem, onOk }

  async function carregar() {
    try {
      const { data } = await api.get('/auth/usuarios');
      setLista(data);
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao carregar');
    }
  }
  useEffect(() => {
    carregar();
  }, []);

  async function criar(e) {
    e.preventDefault();
    setErro('');
    setOk('');
    if (!nome.trim() || !email.trim() || senha.length < 6) {
      return setErro('Preencha nome, e-mail e senha (mín. 6 caracteres)');
    }
    try {
      await api.post('/auth/usuarios', { nome, email, senha, role });
      setNome('');
      setEmail('');
      setSenha('');
      setRole('funcionario');
      setOk('Login criado.');
      carregar();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao criar usuário');
    }
  }

  async function remover(u) {
    setConfirmar({
      mensagem: `Remover o login de ${u.nome}?`,
      onOk: async () => {
        setConfirmar(null);
        try {
          await api.delete(`/auth/usuarios/${u.id}`);
          carregar();
        } catch (err) {
          setErro(err.response?.data?.error || 'Erro ao remover');
        }
      },
    });
    return;
  }

  return (
    <div className="space-y-3">
      <form className="bg-gray-800 border border-gray-700 rounded-xl p-4" onSubmit={criar}>
        <div className="flex items-center gap-2 mb-4">
          <span className="w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center text-orange-500">
            <KeyRound size={18} />
          </span>
          <h2 className="font-bold">Novo acesso (login)</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" className={inputCls} />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail (login)" className={inputCls} />
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha (mín. 6)" className={inputCls} />
          <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
            <option value="funcionario">Funcionário (acesso limitado)</option>
            <option value="admin">Administrador (acesso total)</option>
          </select>
        </div>
        {erro && <p className="text-red-400 text-sm mt-3">{erro}</p>}
        {ok && <p className="text-green-400 text-sm mt-3">{ok}</p>}
        <button type="submit" className="mt-4 h-9 px-4 flex items-center gap-2 bg-orange-500 hover:bg-orange-600 rounded-lg font-semibold">
          <UserPlus size={18} /> Criar acesso
        </button>
        <p className="text-xs text-gray-500 mt-3">
          Funcionário não vê o Financeiro (lucro, comissões e despesas) nem a gestão de usuários.
        </p>
      </form>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
        <h2 className="font-bold mb-3">Acessos cadastrados</h2>
        <div className="space-y-2">
          {lista.map((u) => (
            <div key={u.id} className="flex items-center gap-3 bg-gray-700/40 border border-gray-700 rounded-xl p-3">
              <span className={`w-9 h-9 rounded-full ${corDoNome(u.nome)} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                {u.nome?.[0]?.toUpperCase() || '?'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">
                  {u.nome} {u.id === usuario?.id && <span className="text-xs text-gray-400">(você)</span>}
                </p>
                <p className="text-xs text-gray-400 truncate">{u.email}</p>
              </div>
              <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${u.role === 'admin' ? 'bg-orange-500/15 text-orange-500' : 'bg-sky-500/15 text-sky-400'}`}>
                {u.role === 'admin' ? 'Admin' : 'Funcionário'}
              </span>
              {u.id !== usuario?.id && (
                <button onClick={() => remover(u)} className="text-red-500 hover:text-red-600 p-2 sm:p-1 shrink-0">
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      {confirmar && (
        <ConfirmModal
          mensagem={confirmar.mensagem}
          onOk={confirmar.onOk}
          onCancelar={() => setConfirmar(null)}
        />
      )}
    </div>
  );
}

function Funcionarios() {
  const [lista, setLista] = useState([]);
  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('');
  const [erro, setErro] = useState('');
  const [confirmar, setConfirmar] = useState(null); // { mensagem, onOk }

  async function carregar() {
    const { data } = await api.get('/funcionarios');
    setLista(data.filter((f) => f.ativo));
  }
  useEffect(() => {
    carregar();
  }, []);

  async function criar(e) {
    e.preventDefault();
    setErro('');
    if (!nome.trim()) return;
    try {
      await api.post('/funcionarios', { nome, cargo });
      setNome('');
      setCargo('');
      carregar();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao criar');
    }
  }

  async function remover(id) {
    setConfirmar({
      mensagem: 'Remover funcionário?',
      onOk: async () => {
        setConfirmar(null);
        await api.delete(`/funcionarios/${id}`);
        carregar();
      },
    });
    return;
  }

  return (
    <div className="space-y-3">
      {/* Form de cadastro */}
      <form className="bg-gray-800 border border-gray-700 rounded-xl p-4" onSubmit={criar}>
        <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Nome do Funcionário
            </label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: João Silva"
              className="w-full h-10 bg-gray-700 border border-gray-600 rounded-lg px-3 outline-none focus:border-orange-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Cargo / Função <span className="text-gray-500">(opcional)</span>
            </label>
            <input
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="Ex: Borracheiro Chefe"
              className="w-full h-10 bg-gray-700 border border-gray-600 rounded-lg px-3 outline-none focus:border-orange-500 text-sm"
            />
          </div>
          <button
            type="submit"
            className="h-12 px-5 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 rounded-lg font-semibold transition-colors"
          >
            <UserPlus size={18} /> Adicionar
          </button>
        </div>
        {erro && <p className="text-red-400 text-sm mt-2">{erro}</p>}
        <p className="text-xs text-gray-500 mt-3">
          A divisão entre funcionário e patrão é definida em cada tipo de serviço (aba Serviços).
        </p>
      </form>

      {/* Equipe ativa */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">Equipe Ativa</h2>
          <span className="text-xs font-semibold text-gray-300 bg-gray-700 rounded-full px-3 py-1">
            {lista.length} {lista.length === 1 ? 'Integrante' : 'Integrantes'}
          </span>
        </div>
        <div className="space-y-2">
          {lista.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-6">Nenhum funcionário cadastrado.</p>
          )}
          {lista.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-3 bg-gray-700/40 border border-gray-700 rounded-xl p-3"
            >
              <span
                className={`w-9 h-9 rounded-full ${corDoNome(
                  f.nome
                )} flex items-center justify-center text-white text-sm font-bold shrink-0`}
              >
                {f.nome?.[0]?.toUpperCase() || '?'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{f.nome}</p>
                {f.cargo && <p className="text-xs text-gray-400 truncate">{f.cargo}</p>}
              </div>
              <button
                onClick={() => remover(f.id)}
                className="text-red-500 hover:text-red-600 p-2 sm:p-1 shrink-0"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>
      {confirmar && (
        <ConfirmModal
          mensagem={confirmar.mensagem}
          onOk={confirmar.onOk}
          onCancelar={() => setConfirmar(null)}
        />
      )}
    </div>
  );
}

function TiposServico() {
  const [lista, setLista] = useState([]);
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState('');
  const [pct, setPct] = useState('50');
  const [erro, setErro] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [confirmar, setConfirmar] = useState(null); // { mensagem, onOk }

  async function carregar() {
    const { data } = await api.get('/tipos-servico');
    setLista(data.filter((t) => t.ativo));
  }
  useEffect(() => {
    carregar();
  }, []);

  async function criar(e) {
    e.preventDefault();
    setErro('');
    if (!nome.trim()) return;
    try {
      await api.post('/tipos-servico', {
        nome,
        valor_padrao: Number(valor) || 0,
        percentual_funcionario: pct === '' ? 50 : Number(pct),
      });
      setNome('');
      setValor('');
      setPct('50');
      carregar();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao criar');
    }
  }

  async function remover(id) {
    setConfirmar({
      mensagem: 'Remover tipo de serviço?',
      onOk: async () => {
        setConfirmar(null);
        await api.delete(`/tipos-servico/${id}`);
        carregar();
      },
    });
    return;
  }

  return (
    <div className="space-y-3">
      <form className="bg-gray-800 border border-gray-700 rounded-xl p-4" onSubmit={criar}>
        <div className="grid sm:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Nome do Serviço</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Remendo a quente"
              className="w-full h-10 bg-gray-700 border border-gray-600 rounded-lg px-3 outline-none focus:border-orange-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Valor Padrão <span className="text-gray-500">(opcional)</span>
            </label>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="R$ 0,00"
              className="w-full h-10 bg-gray-700 border border-gray-600 rounded-lg px-3 outline-none focus:border-orange-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">% Funcionário</label>
            <input
              type="number"
              step="1"
              min="0"
              max="100"
              inputMode="numeric"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              placeholder="50"
              className="w-full sm:w-28 h-10 bg-gray-700 border border-gray-600 rounded-lg px-3 outline-none focus:border-orange-500 text-sm"
            />
          </div>
          <button
            type="submit"
            className="h-12 px-5 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 rounded-lg font-semibold transition-colors"
          >
            <Plus size={18} /> Adicionar
          </button>
        </div>
        {erro && <p className="text-red-400 text-sm mt-2">{erro}</p>}
        <p className="text-xs text-gray-500 mt-3">
          O restante do valor (100% − % do funcionário) fica com o patrão. Deixe em 50 para meio a meio.
        </p>
      </form>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">Catálogo de Serviços</h2>
          <span className="text-xs font-semibold text-gray-300 bg-gray-700 rounded-full px-3 py-1">
            {lista.length} {lista.length === 1 ? 'Serviço' : 'Serviços'}
          </span>
        </div>
        <div className="space-y-2">
          {lista.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-6">Nenhum serviço cadastrado.</p>
          )}
          {lista.map((t) =>
            editandoId === t.id ? (
              <LinhaEdicao
                key={t.id}
                tipo={t}
                onCancelar={() => setEditandoId(null)}
                onSalvo={() => {
                  setEditandoId(null);
                  carregar();
                }}
              />
            ) : (
              <div
                key={t.id}
                className="flex items-center gap-3 bg-gray-700/40 border border-gray-700 rounded-xl p-3"
              >
                <span className="w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center text-orange-500 shrink-0">
                  <Tag size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{t.nome}</p>
                  <p className="text-xs text-gray-400">
                    Valor padrão: {brl(t.valor_padrao)} · Func {Number(t.percentual_funcionario)}% /
                    Patrão {100 - Number(t.percentual_funcionario)}%
                  </p>
                </div>
                <button
                  onClick={() => setEditandoId(t.id)}
                  className="text-gray-500 hover:text-orange-400 p-1 shrink-0"
                >
                  <Pencil size={17} />
                </button>
                <button
                  onClick={() => remover(t.id)}
                  className="text-red-500 hover:text-red-600 p-2 sm:p-1 shrink-0"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            )
          )}
        </div>
      </div>
      {confirmar && (
        <ConfirmModal
          mensagem={confirmar.mensagem}
          onOk={confirmar.onOk}
          onCancelar={() => setConfirmar(null)}
        />
      )}
    </div>
  );
}

// Linha editável do catálogo: nome, valor padrão e % do funcionário.
function LinhaEdicao({ tipo, onCancelar, onSalvo }) {
  const [nome, setNome] = useState(tipo.nome);
  const [valor, setValor] = useState(String(Number(tipo.valor_padrao) || ''));
  const [pct, setPct] = useState(String(Number(tipo.percentual_funcionario)));
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro('');
    if (!nome.trim()) return setErro('Informe o nome');
    setSalvando(true);
    try {
      await api.put(`/tipos-servico/${tipo.id}`, {
        nome,
        valor_padrao: Number(valor) || 0,
        percentual_funcionario: pct === '' ? 50 : Number(pct),
      });
      onSalvo();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao salvar');
      setSalvando(false);
    }
  }

  return (
    <div className="bg-gray-700/40 border border-orange-500/40 rounded-xl p-3 space-y-3">
      <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome do serviço"
          className="h-11 bg-gray-700 border border-gray-600 rounded-lg px-3 outline-none focus:border-orange-500"
        />
        <input
          type="number"
          step="0.01"
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="Valor padrão"
          className="h-11 bg-gray-700 border border-gray-600 rounded-lg px-3 outline-none focus:border-orange-500"
        />
        <input
          type="number"
          step="1"
          min="0"
          max="100"
          inputMode="numeric"
          value={pct}
          onChange={(e) => setPct(e.target.value)}
          placeholder="% Func"
          className="h-11 sm:w-28 bg-gray-700 border border-gray-600 rounded-lg px-3 outline-none focus:border-orange-500"
        />
      </div>
      {erro && <p className="text-red-400 text-sm">{erro}</p>}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          Func {Number(pct) || 0}% / Patrão {100 - (Number(pct) || 0)}%
        </span>
        <div className="flex gap-2">
          <button
            onClick={onCancelar}
            className="h-9 px-4 rounded-lg text-sm font-semibold bg-gray-700 hover:bg-gray-600"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="h-9 px-4 flex items-center gap-1 rounded-lg text-sm font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50"
          >
            <Check size={16} /> Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
