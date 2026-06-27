import { useEffect, useState } from 'react';
import { FileDown, Receipt, Wallet, Wrench, ShoppingBag, TrendingUp } from 'lucide-react';
import Layout from '../components/Layout';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { brl } from '../utils/format';
import { pdfHistorico } from '../utils/pdf';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { usePaginacao } from '../hooks/usePaginacao';
import Paginacao from '../components/Paginacao';
import RangePicker from '../components/RangePicker';

// Cores para os avatares dos funcionários
const CORES = ['bg-sky-500', 'bg-orange-500', 'bg-emerald-500', 'bg-purple-500', 'bg-rose-500', 'bg-amber-500'];
function corDoNome(nome = '') {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = nome.charCodeAt(i) + ((h << 5) - h);
  return CORES[Math.abs(h) % CORES.length];
}

function dataLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function intervaloHoje() {
  const h = dataLocal(new Date());
  return { inicio: h, fim: h };
}

function intervaloSemana() {
  const hoje = new Date();
  const diaSemana = (hoje.getDay() + 6) % 7; // 0 = segunda
  const segunda = new Date(hoje);
  segunda.setDate(hoje.getDate() - diaSemana);
  const domingo = new Date(segunda);
  domingo.setDate(segunda.getDate() + 6);
  return { inicio: dataLocal(segunda), fim: dataLocal(domingo) };
}

function intervaloMes() {
  const hoje = new Date();
  const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  return { inicio: dataLocal(ini), fim: dataLocal(fim) };
}

const PERIODOS = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mês' },
];

export default function Historico() {
  const { tenant } = useAuth();
  const [dados, setDados] = useState(null);
  const [periodo, setPeriodo] = useState('semana'); // semana | mes | custom
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(true);

  async function carregar(params) {
    setLoading(true);
    setErro('');
    try {
      const { data } = await api.get('/historico', { params });
      setDados(data);
      setInicio(data.periodo.inicio);
      setFim(data.periodo.fim);
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar(intervaloSemana()); // padrão: esta semana
  }, []);

  function mudarPeriodo(valor) {
    setPeriodo(valor);
    if (valor === 'hoje') carregar(intervaloHoje());
    else if (valor === 'semana') carregar(intervaloSemana());
    else if (valor === 'mes') carregar(intervaloMes());
  }

  function aplicarCustom(e) {
    e.preventDefault();
    if (inicio && fim) {
      setPeriodo('custom');
      carregar({ inicio, fim });
    }
  }

  const media =
    dados && dados.qtd_servicos > 0 ? dados.total_geral / dados.qtd_servicos : 0;

  const funcPag = usePaginacao(dados?.por_funcionario || [], 8);
  const prodPag = usePaginacao(dados?.produtos_vendidos || [], 8);

  return (
    <Layout
      title="Relatório"
      subtitle="Visão geral do desempenho e comissões"
      action={
        <button
          onClick={() => dados && pdfHistorico(tenant?.nome, dados)}
          disabled={!dados || (dados.qtd_servicos === 0 && (dados.qtd_produtos || 0) === 0)}
          className="h-9 sm:h-11 px-3 sm:px-4 flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg font-semibold transition-colors text-sm"
        >
          <FileDown size={16} />
          <span className="hidden sm:inline">Gerar Relatório PDF</span>
          <span className="sm:hidden">PDF</span>
        </button>
      }
    >
      {/* Filtros */}
      <form
        onSubmit={aplicarCustom}
        className="bg-gray-800 border border-gray-700 rounded-2xl p-4 mb-5 flex flex-wrap items-end gap-4"
      >
        <div>
          <label className="block text-xs text-gray-400 mb-1">Período</label>
          <div className="inline-flex items-center gap-1 bg-gray-700/60 rounded-xl p-1">
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => mudarPeriodo(p.id)}
                className={`h-10 px-4 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                  periodo === p.id ? 'bg-orange-500 text-white shadow-sm' : 'text-gray-300 hover:text-gray-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Intervalo de datas</label>
          <RangePicker
            de={inicio}
            ate={fim}
            onChange={({ de, ate }) => {
              setInicio(de);
              setFim(ate);
              setPeriodo('custom');
              carregar({ inicio: de, fim: ate });
            }}
          />
        </div>
        {periodo === 'custom' && (
          <span className="text-xs text-gray-400 self-center">Período personalizado</span>
        )}
      </form>

      {erro && <p className="text-red-400 text-sm mb-3">{erro}</p>}
      {loading && <p className="text-gray-400 text-center py-6">Carregando...</p>}

      {dados && !loading && (
        <>
          {/* Indicadores */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <p className="text-sm text-gray-400">Faturamento Total</p>
                <TrendingUp size={18} className="text-gray-600" />
              </div>
              <p className="text-2xl font-bold text-orange-500 mt-1">{brl(dados.faturamento_total ?? dados.total_geral)}</p>
              <p className="text-xs text-gray-500 mt-1">Serviços + produtos</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <p className="text-sm text-gray-400">Serviços</p>
                <Wrench size={18} className="text-gray-600" />
              </div>
              <p className="text-2xl font-bold mt-1">{brl(dados.total_geral)}</p>
              <p className="text-xs text-gray-500 mt-1">{dados.qtd_servicos} serviço(s) · média {brl(media)}</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <p className="text-sm text-gray-400">Vendas de Produtos</p>
                <ShoppingBag size={18} className="text-gray-600" />
              </div>
              <p className="text-2xl font-bold mt-1">{brl(dados.total_produtos || 0)}</p>
              <p className="text-xs text-gray-500 mt-1">{dados.qtd_produtos || 0} item(ns) vendido(s)</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <p className="text-sm text-gray-400">Comissões</p>
                <Wallet size={18} className="text-gray-600" />
              </div>
              <p className="text-2xl font-bold mt-1">{brl(dados.total_funcionarios)}</p>
              <p className="text-xs text-gray-500 mt-1">A ser pago aos funcionários</p>
            </div>
          </div>

          {/* Tabela de desempenho */}
          <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden">
            <div className="p-5 pb-3">
              <h2 className="font-bold text-lg">Desempenho por Funcionário</h2>
            </div>

            {/* Tabela — desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-y border-gray-700">
                    <th className="px-4 py-2 font-semibold">FUNCIONÁRIO</th>
                    <th className="px-4 py-2 font-semibold">SERVIÇOS</th>
                    <th className="px-4 py-2 font-semibold">TOTAL GERADO</th>
                    <th className="px-4 py-2 font-semibold text-right">COMISSÃO</th>
                    <th className="px-4 py-2 font-semibold text-right">VALES</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.por_funcionario.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-gray-500">
                        Nenhum serviço no período.
                      </td>
                    </tr>
                  )}
                  {funcPag.itens.map((f) => (
                    <tr
                      key={f.funcionario_id || f.nome}
                      className="border-b border-gray-700/50 last:border-0"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-8 h-8 rounded-full ${corDoNome(
                              f.nome
                            )} flex items-center justify-center text-white text-xs font-bold`}
                          >
                            {f.nome?.[0]?.toUpperCase() || '?'}
                          </span>
                          <span className="font-medium">{f.nome}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-300">{f.qtd}</td>
                      <td className="px-4 py-2.5 text-gray-300">{brl(f.total_gerado)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-orange-500">
                        {brl(f.comissao)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-violet-400">
                        {f.total_vales > 0 ? brl(f.total_vales) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards — mobile */}
            <div className="sm:hidden px-4 pb-2 space-y-2">
              {dados.por_funcionario.length === 0 && (
                <p className="text-center text-gray-500 py-8">Nenhum serviço no período.</p>
              )}
              {funcPag.itens.map((f) => (
                <div key={f.funcionario_id || f.nome} className="bg-gray-700/50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full ${corDoNome(f.nome)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                      {f.nome?.[0]?.toUpperCase() || '?'}
                    </span>
                    <span className="font-medium">{f.nome}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">{f.qtd} serviço(s)</span>
                    <span className="text-gray-300">Total: {brl(f.total_gerado)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Comissão:</span>
                    <span className="font-bold text-orange-500">{brl(f.comissao)}</span>
                  </div>
                  {f.total_vales > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Vales:</span>
                      <span className="text-violet-400">{brl(f.total_vales)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="px-5 pb-4">
              <Paginacao pagina={funcPag.pagina} totalPaginas={funcPag.totalPaginas} total={funcPag.total} onPagina={funcPag.setPagina} />
            </div>
          </div>

          {/* Gráfico de faturamento por dia */}
          {dados.por_dia && dados.por_dia.length > 1 && dados.por_dia.length <= 31 && (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-5">
              <h2 className="font-bold text-lg mb-3">Faturamento por dia</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={dados.por_dia.map((x) => ({
                    label: String(x.dia).slice(8, 10),
                    dataCompleta: new Date(String(x.dia).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR'),
                    total: x.total,
                  }))}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis width={48} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                  <Tooltip
                    formatter={(v) => [brl(v), 'Faturamento']}
                    labelFormatter={(_, p) => p?.[0]?.payload?.dataCompleta || ''}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb' }}
                    labelStyle={{ color: '#0f172a', fontWeight: 600 }}
                    cursor={{ fill: 'rgba(37,99,235,0.08)' }}
                  />
                  <Bar dataKey="total" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Vendas por forma de pagamento */}
          {dados.por_forma && (dados.por_forma.pix + (dados.por_forma.cartao_credito || 0) + (dados.por_forma.cartao_debito || 0) + dados.por_forma.dinheiro) > 0 && (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mt-3">
              <h2 className="font-bold text-lg mb-3">Vendas por Forma de Pagamento</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { k: 'pix', label: 'Pix' },
                  { k: 'cartao_credito', label: 'Crédito' },
                  { k: 'cartao_debito', label: 'Débito' },
                  { k: 'dinheiro', label: 'Dinheiro' },
                ].map((f) => (
                  <div key={f.k} className="bg-gray-900 rounded-lg p-4">
                    <p className="text-xs text-gray-400">{f.label}</p>
                    <p className="text-xl font-bold mt-1">{brl(dados.por_forma[f.k] || 0)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vales pagos no período */}
          {(dados.total_vales || 0) > 0 && (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mt-3">
              <h2 className="font-bold text-lg mb-3">Vales Pagos a Funcionários</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {dados.por_funcionario.filter(f => f.total_vales > 0).map((f) => (
                  <div key={f.funcionario_id || f.nome} className="flex items-center justify-between bg-gray-900 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-full ${corDoNome(f.nome)} flex items-center justify-center text-white text-xs font-bold`}>
                        {f.nome?.[0]?.toUpperCase() || '?'}
                      </span>
                      <span className="text-sm font-medium">{f.nome}</span>
                    </div>
                    <span className="font-bold text-violet-400">{brl(f.total_vales)}</span>
                  </div>
                ))}
                <div className="sm:col-span-2 flex items-center justify-between bg-violet-500/10 border border-violet-500/20 rounded-lg px-4 py-3">
                  <span className="text-sm font-semibold text-violet-300">Total de vales</span>
                  <span className="font-bold text-violet-400">{brl(dados.total_vales)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Produtos vendidos */}
          {(dados.qtd_produtos || 0) > 0 && (
            <div className="bg-gray-800 border border-gray-700 rounded-2xl overflow-hidden mt-3">
              <div className="p-5 pb-3 flex items-center gap-2">
                <ShoppingBag size={18} className="text-gray-400" />
                <h2 className="font-bold text-lg">Produtos Vendidos</h2>
              </div>

              {/* Tabela — desktop */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-y border-gray-700">
                      <th className="px-4 py-2 font-semibold">PRODUTO</th>
                      <th className="px-4 py-2 font-semibold">QTD. VENDIDA</th>
                      <th className="px-4 py-2 font-semibold text-right">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prodPag.itens.map((p) => (
                      <tr key={p.nome} className="border-b border-gray-700/50 last:border-0">
                        <td className="px-4 py-2.5 font-medium">{p.nome}</td>
                        <td className="px-4 py-2.5 text-gray-300">{p.qtd}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-orange-500">{brl(p.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cards — mobile */}
              <div className="sm:hidden px-4 pb-2 space-y-2">
                {prodPag.itens.map((p) => (
                  <div key={p.nome} className="bg-gray-700/50 rounded-xl p-3 space-y-2">
                    <p className="font-medium">{p.nome}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">{p.qtd} un.</span>
                      <span className="font-bold text-orange-500">{brl(p.total)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-5 pb-4">
                <Paginacao pagina={prodPag.pagina} totalPaginas={prodPag.totalPaginas} total={prodPag.total} onPagina={prodPag.setPagina} />
              </div>
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
