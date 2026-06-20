import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, Wrench, ShoppingBag, AlertTriangle, HandCoins,
  Unlock, Lock, CalendarDays, Users, Clock, ChevronRight,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Layout from '../components/Layout';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { brl } from '../utils/format';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const FORMAS = { pix: 'PIX', cartao: 'Cartão', dinheiro: 'Dinheiro', misto: 'Misto' };

function rotuloDia(iso) {
  const dt = new Date(String(iso).slice(0, 10) + 'T12:00:00');
  return `${DIAS[dt.getDay()]} ${dt.getDate()}`;
}

function horaRelativa(iso) {
  if (!iso) return '';
  const dt = new Date(iso);
  return dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const CORES = ['bg-sky-500', 'bg-orange-500', 'bg-emerald-500', 'bg-purple-500', 'bg-rose-500'];
function corNome(nome = '') {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = nome.charCodeAt(i) + ((h << 5) - h);
  return CORES[Math.abs(h) % CORES.length];
}

export default function Dashboard() {
  const { tenant } = useAuth();
  const [d, setD] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api
      .get('/dashboard')
      .then(({ data }) => setD(data))
      .catch((err) => setErro(err.response?.data?.error || 'Erro ao carregar'));
  }, []);

  const serie7 = d ? d.ultimos_7_dias.map((x) => ({ label: rotuloDia(x.dia), total: x.total })) : [];
  const ticketMedio = d && d.servicos_hoje.qtd > 0
    ? d.faturamento_hoje / d.servicos_hoje.qtd
    : 0;

  return (
    <Layout title={`Olá, ${tenant?.nome || 'Borracharia'}`} subtitle="Resumo de hoje e dos últimos dias.">
      {erro && <p className="text-red-400 text-sm mb-3">{erro}</p>}
      {!d ? (
        <p className="text-gray-400 text-center py-12">Carregando...</p>
      ) : (
        <>
          {/* Status do caixa */}
          <div className={`mb-4 rounded-xl p-3 flex items-center gap-3 ${d.caixa_aberto ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
            {d.caixa_aberto ? <Unlock className="text-emerald-400 shrink-0" size={20} /> : <Lock className="text-yellow-400 shrink-0" size={20} />}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{d.caixa_aberto ? 'Caixa aberto' : 'Caixa fechado'}</p>
              <p className="text-xs text-gray-400 truncate">
                {d.caixa_aberto ? 'Pronto para lançar serviços e vendas.' : 'Abra o caixa para começar o dia.'}
              </p>
            </div>
            <Link to="/caixa" className="shrink-0 h-9 px-3 flex items-center rounded-lg bg-orange-500 hover:bg-orange-600 font-semibold text-sm whitespace-nowrap">
              Ir ao caixa
            </Link>
          </div>

          {/* Cards — hoje */}
          <p className="text-xs font-semibold text-gray-500 tracking-widest uppercase mb-2">Hoje</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <Card label="Faturamento" valor={brl(d.faturamento_hoje)} icon={TrendingUp} destaque />
            <Card label="Serviços" valor={`${d.servicos_hoje.qtd}`} sub={brl(d.servicos_hoje.total)} icon={Wrench} />
            <Card label="Vendas PDV" valor={`${d.vendas_hoje.qtd}`} sub={brl(d.vendas_hoje.total)} icon={ShoppingBag} />
            <Card label="Ticket médio" valor={ticketMedio > 0 ? brl(ticketMedio) : '—'} sub={d.servicos_hoje.qtd > 0 ? `${d.servicos_hoje.qtd} serviço(s)` : 'sem serviços'} icon={TrendingUp} />
          </div>

          {/* Cards — mês */}
          <p className="text-xs font-semibold text-gray-500 tracking-widest uppercase mb-2">Este mês</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <Card label="Faturamento" valor={brl(d.faturamento_mes)} icon={CalendarDays} destaque />
            <Card label="Serviços" valor={`${d.servicos_mes}`} sub="serviços realizados" icon={Wrench} />
            <Card label="A receber (fiado)" valor={brl(d.a_receber)} icon={HandCoins} link="/clientes" />
            <Card label="Estoque baixo" valor={`${d.estoque_baixo}`} sub="produto(s)" icon={AlertTriangle} alerta={d.estoque_baixo > 0} link="/estoque" />
          </div>

          {/* Grid inferior: gráfico + lateral */}
          <div className="grid lg:grid-cols-3 gap-4 mb-4">
            {/* Gráfico 7 dias */}
            <div className="lg:col-span-2 bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-sm">Faturamento — últimos 7 dias</h2>
                <span className="text-xs text-gray-400">
                  Total: <b className="text-orange-500">{brl(d.ultimos_7_dias.reduce((s, x) => s + x.total, 0))}</b>
                </span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={serie7} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="corFat" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis width={40} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                  <Tooltip
                    formatter={(v) => [brl(v), 'Faturamento']}
                    contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb' }}
                    labelStyle={{ color: '#0f172a', fontWeight: 600 }}
                  />
                  <Area type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2.5}
                    fill="url(#corFat)" dot={{ r: 3, fill: '#2563eb' }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Funcionários hoje */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users size={15} className="text-gray-400" />
                <h2 className="font-bold text-sm">Funcionários hoje</h2>
              </div>
              {d.por_funcionario.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-6">Nenhum serviço lançado hoje.</p>
              ) : (
                <div className="space-y-2">
                  {d.por_funcionario.map((f) => (
                    <div key={f.nome} className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full ${corNome(f.nome)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                        {f.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{f.nome}</p>
                        <p className="text-xs text-gray-400">{f.qtd} serviço(s) · {brl(f.total)}</p>
                      </div>
                      <span className="text-xs font-semibold text-orange-500 shrink-0">{brl(f.comissao)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Últimos serviços */}
          {d.ultimos_lancamentos.length > 0 && (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock size={15} className="text-gray-400" />
                  <h2 className="font-bold text-sm">Últimos serviços</h2>
                </div>
                <Link to="/servicos" className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-400 font-semibold">
                  Ver todos <ChevronRight size={13} />
                </Link>
              </div>
              <div className="space-y-2">
                {d.ultimos_lancamentos.map((l) => (
                  <div key={l.id} className="flex items-center gap-3 py-1.5 border-b border-gray-700/50 last:border-0">
                    <div className={`w-7 h-7 rounded-full ${corNome(l.funcionario || '')} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                      {(l.funcionario || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {l.tipo_servico || 'Serviço avulso'}
                        {l.cliente_nome ? <span className="font-normal text-gray-400"> — {l.cliente_nome}</span> : null}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {l.funcionario} · {FORMAS[l.forma_pagamento] || l.forma_pagamento || ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-emerald-400">+{brl(l.valor)}</p>
                      <p className="text-xs text-gray-500">{horaRelativa(l.criado_em)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alerta de estoque */}
          {d.estoque_baixo > 0 && (
            <Link to="/estoque" className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-3 hover:bg-red-500/15 mb-4">
              <AlertTriangle className="text-red-400 shrink-0" size={20} />
              <div className="flex-1">
                <p className="font-semibold text-sm text-red-400">{d.estoque_baixo} produto(s) com estoque baixo</p>
                <p className="text-xs text-gray-400">Toque para repor o estoque.</p>
              </div>
              <ChevronRight size={16} className="text-red-400 shrink-0" />
            </Link>
          )}
        </>
      )}
    </Layout>
  );
}

function Card({ label, valor, sub, icon: Icon, destaque, alerta, link }) {
  const body = (
    <div className={`bg-gray-800 border rounded-xl p-3 h-full ${alerta ? 'border-red-500/40' : 'border-gray-700'}`}>
      <div className="flex items-start justify-between mb-1.5">
        <p className="text-xs font-semibold tracking-wide text-gray-400 leading-tight">{label}</p>
        <Icon size={15} className={alerta ? 'text-red-400' : 'text-gray-500'} />
      </div>
      <p className={`text-xl font-bold ${destaque ? 'text-orange-500' : alerta ? 'text-red-400' : ''}`}>{valor}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5 truncate">{sub}</p>}
    </div>
  );
  return link ? <Link to={link} className="block">{body}</Link> : body;
}
