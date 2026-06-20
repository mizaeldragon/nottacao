import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const GRAD = 'linear-gradient(135deg, #0096EF 0%, #0A67E2 100%)';
const COR2 = '#0A67E2';

function mascaraTelefone(v) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
  }
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
}

function mascaraDocumento(v) {
  const d = v.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) {
    // CPF: 000.000.000-00
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  // CNPJ: 00.000.000/0000-00
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export default function Registro() {
  const { registrar } = useAuth();
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [telefone, setTelefone] = useState('');
  const [documento, setDocumento] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      const { paymentLink } = await registrar(nome, email, senha, telefone, documento);
      if (paymentLink) {
        window.location.href = paymentLink;
      } else {
        setErro('Conta criada! Houve um problema ao gerar o link de pagamento. Entre em contato com o suporte.');
      }
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao cadastrar');
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm outline-none transition-all';
  const focus = e => (e.target.style.borderColor = COR2);
  const blur  = e => (e.target.style.borderColor = '');

  return (
    <div className="min-h-screen flex font-sans">
      {/* Left side */}
      <div className="hidden lg:flex flex-col w-[480px] bg-white px-12 py-16 justify-between border-r border-slate-200">
        <div>
          <Link to="/">
            <img src="/logo.png" alt="nottação" className="h-14 w-auto mb-16" />
          </Link>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Para borracharias</p>
          <h1 className="text-4xl font-extrabold text-slate-900 leading-[1.15] mb-2">
            Controle total.<br />
            Menos dor de cabeça.<br />
            <span style={{ color: COR2 }}>Mais lucro.</span>
          </h1>
          <p className="text-slate-500 text-sm mb-10 mt-4 leading-relaxed">
            Gestão de serviços, fiado e controle de caixa — tudo num painel simples.
          </p>
          <ul className="space-y-4">
            {['Lançamento de serviços automático', 'Divisão de comissões sem briga', 'Caixa, estoque e DRE num só lugar'].map(item => (
              <li key={item} className="flex items-center gap-3 text-sm font-medium text-slate-600">
                <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ border: '2px solid #BFDBFE' }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: COR2 }} />
                </div>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-slate-400 font-medium">© {new Date().getFullYear()} nottação</p>
      </div>

      {/* Right side */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-950">
        <div className="w-full max-w-md bg-white rounded-[2rem] p-8 sm:p-10 shadow-2xl">
          <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Crie sua conta</h2>
          <p className="text-sm text-slate-500 mb-8">Informe os dados da sua borracharia para começar.</p>

          <div className="flex bg-slate-100 rounded-xl p-1 mb-8">
            <Link to="/login" className="flex-1 text-center py-2.5 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors">
              Entrar
            </Link>
            <Link to="/registro" className="flex-1 text-center py-2.5 rounded-lg bg-white shadow-sm text-sm font-bold text-slate-900">
              Criar conta
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {erro && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 font-medium">{erro}</div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">Nome da borracharia</label>
              <input
                value={nome} onChange={e => setNome(e.target.value)}
                placeholder="Ex: Borracharia do João" required
                className={inputCls} onFocus={focus} onBlur={blur}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Telefone</label>
                <input
                  type="tel"
                  value={telefone}
                  onChange={e => setTelefone(mascaraTelefone(e.target.value))}
                  placeholder="(11) 90000-0000"
                  required
                  maxLength={15}
                  className={inputCls} onFocus={focus} onBlur={blur}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">CNPJ / CPF</label>
                <input
                  type="text"
                  value={documento}
                  onChange={e => setDocumento(mascaraDocumento(e.target.value))}
                  placeholder="00.000.000/0001-00"
                  required
                  maxLength={18}
                  className={inputCls} onFocus={focus} onBlur={blur}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">E-mail</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com" required
                className={inputCls} onFocus={focus} onBlur={blur}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={senha} onChange={e => setSenha(e.target.value)}
                  placeholder="••••••••" required minLength={6}
                  className={`${inputCls} pr-10`} onFocus={focus} onBlur={blur}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full h-12 mt-2 disabled:opacity-50 text-white rounded-xl font-bold transition-all hover:-translate-y-0.5"
              style={{ background: GRAD, boxShadow: `0 8px 24px ${COR2}40` }}>
              {loading ? 'Cadastrando...' : 'Cadastrar conta'}
            </button>
          </form>

          <p className="text-xs text-slate-500 text-center mt-6">
            Ao se cadastrar, você concorda com nossos{' '}
            <Link to="/termos" style={{ color: COR2 }} className="hover:underline">Termos</Link> e{' '}
            <Link to="/privacidade" style={{ color: COR2 }} className="hover:underline">Privacidade</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
