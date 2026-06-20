import { useEffect, useState } from 'react';
import {
  Sparkles, RefreshCw, TrendingUp, TrendingDown, Wrench,
  ShoppingBag, CheckCircle2, AlertTriangle, Lightbulb,
  ChevronDown, ChevronUp, CalendarDays, FileDown,
} from 'lucide-react';
import Layout from '../components/Layout';
import api from '../services/api';
import { brl } from '../utils/format';
import { pdfRelatorioIA } from '../utils/pdf';
import { useAuth } from '../context/AuthContext';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function toDate(s) {
  // Pega só os 10 primeiros caracteres para lidar com ISO completo ou só data
  return new Date(String(s).substring(0, 10) + 'T12:00:00');
}

function fmtSemana(inicio, fim) {
  const f = (s) => {
    const d = toDate(s);
    return `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}`;
  };
  return `${f(inicio)} a ${f(fim)}`;
}

function rotuloDia(iso) {
  return DIAS[toDate(iso).getDay()];
}

export default function RelatorioIA() {
  const [relatorio, setRelatorio] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');
  const [expandido, setExpandido] = useState(null);

  useEffect(() => {
    Promise.all([carregarAtual(), carregarHistorico()]);
  }, []);

  async function carregarAtual() {
    setCarregando(true);
    try {
      const { data } = await api.get('/relatorio-semanal');
      setRelatorio(data);
    } catch {
      setRelatorio(null);
    } finally {
      setCarregando(false);
    }
  }

  async function carregarHistorico() {
    try {
      const { data } = await api.get('/relatorio-semanal/historico');
      setHistorico(data);
    } catch {}
  }

  async function gerar() {
    setGerando(true);
    setErro('');
    try {
      const { data } = await api.post('/relatorio-semanal/gerar');
      setRelatorio(data);
      await carregarHistorico();
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao gerar relatório. Verifique a chave OpenAI no .env');
    } finally {
      setGerando(false);
    }
  }

  const { tenant } = useAuth();
  const hoje = new Date();
  const ehSabado = hoje.getDay() === 6;

  return (
    <Layout title="Relatório IA" subtitle="Análise semanal gerada por inteligência artificial">

      {/* Cabeçalho da semana */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-gray-400" />
          <span className="text-sm text-gray-300">
            Semana atual
            {ehSabado && (
              <span className="ml-2 text-xs font-bold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full">
                Relatório gerado automaticamente hoje às 7h
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {relatorio && (
            <button
              onClick={() => pdfRelatorioIA(tenant?.nome, relatorio)}
              className="flex items-center gap-2 h-9 px-3 rounded-xl border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 text-sm font-semibold transition-all"
            >
              <FileDown size={15} /> PDF
            </button>
          )}
          <button
            onClick={gerar}
            disabled={gerando}
            className="flex items-center gap-2 h-9 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm disabled:opacity-60 transition-all"
          >
            {gerando
              ? <><RefreshCw size={15} className="animate-spin" /> Gerando com IA...</>
              : <><Sparkles size={15} /> {relatorio ? 'Atualizar relatório' : 'Gerar relatório'}</>
            }
          </button>
        </div>
      </div>

      {erro && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{erro}</div>
      )}

      {carregando ? (
        <p className="text-center text-gray-400 py-16 text-sm">Carregando...</p>
      ) : !relatorio ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-4">
            <Sparkles size={28} className="text-orange-500" />
          </div>
          <p className="font-bold text-lg mb-1">Nenhum relatório gerado ainda</p>
          <p className="text-gray-400 text-sm max-w-sm">
            O relatório é gerado automaticamente todo sábado às 7h. Você também pode clicar em "Gerar relatório" a qualquer momento.
          </p>
        </div>
      ) : (
        <RelatorioPainel r={relatorio} />
      )}

      {/* Histórico */}
      {historico.length > 1 && (
        <div className="mt-8">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Relatórios anteriores</p>
          <div className="space-y-2">
            {historico.slice(1).map((h) => (
              <div key={h.id} className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandido(expandido === h.id ? null : h.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <CalendarDays size={15} className="text-gray-400 shrink-0" />
                    <span className="font-semibold text-sm">{fmtSemana(h.semana_inicio, h.semana_fim)}</span>
                    <span className="text-xs text-gray-400">{brl(h.dados?.fat_total || 0)}</span>
                  </div>
                  {expandido === h.id ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
                </button>
                {expandido === h.id && (
                  <div className="px-4 pb-4 border-t border-gray-700 pt-4">
                    <RelatorioPainel r={h} compact />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}

function RelatorioPainel({ r, compact }) {
  const dados = r.dados || {};
  const variacao = dados.variacao_pct !== null && dados.variacao_pct !== undefined ? Number(dados.variacao_pct) : null;
  const maxDia = Math.max(...(dados.por_dia || []).map(d => d.total), 1);

  return (
    <div className="space-y-4">
      {/* Período */}
      {!compact && (
        <p className="text-xs text-gray-400">
          Semana de <span className="font-semibold text-gray-200">{fmtSemana(r.semana_inicio, r.semana_fim)}</span>
          {' · '}gerado em{' '}
          <span className="font-semibold text-gray-200">
            {new Date(r.gerado_em).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
          </span>
        </p>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Faturamento total" valor={brl(dados.fat_total || 0)} icon={TrendingUp} destaque
          sub={variacao !== null ? `${variacao > 0 ? '+' : ''}${variacao}% vs semana ant.` : null}
          subColor={variacao > 0 ? 'text-emerald-400' : variacao < 0 ? 'text-red-400' : 'text-gray-400'}
        />
        <MetricCard label="Serviços" valor={dados.qtd_servicos || 0} icon={Wrench}
          sub={`Ticket médio ${brl(dados.ticket_medio || 0)}`} />
        <MetricCard label="Vendas PDV" valor={dados.qtd_vendas || 0} icon={ShoppingBag}
          sub={brl(dados.fat_pdv || 0)} />
        <MetricCard label="Serviços" valor={brl(dados.fat_servicos || 0)} icon={TrendingUp}
          sub="faturamento em OS" />
      </div>

      {/* Gráfico por dia + IA lado a lado no desktop */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Faturamento por dia */}
        {dados.por_dia?.length > 0 && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <p className="text-sm font-bold mb-4">Faturamento por dia</p>
            <div className="space-y-2">
              {dados.por_dia.map((d) => (
                <div key={d.dia} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-8 shrink-0">{rotuloDia(d.dia)}</span>
                  <div className="flex-1 h-5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-orange-500 transition-all"
                      style={{ width: `${(d.total / maxDia) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold w-20 text-right shrink-0">{brl(d.total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bloco de IA */}
        {r.ia_resumo && (
          <div className="bg-gray-800 border border-orange-500/30 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0">
                <Sparkles size={14} className="text-orange-500" />
              </div>
              <p className="text-sm font-bold">Análise da IA</p>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{r.ia_resumo}</p>

            {r.ia_destaques?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">Destaques</p>
                <ul className="space-y-1.5">
                  {r.ia_destaques.map((d, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {r.ia_atencao?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-2">Atenção</p>
                <ul className="space-y-1.5">
                  {r.ia_atencao.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <AlertTriangle size={14} className="text-yellow-400 shrink-0 mt-0.5" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {r.ia_sugestao && (
              <div className="bg-orange-500/8 border border-orange-500/20 rounded-xl p-3">
                <p className="text-xs font-bold text-orange-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Lightbulb size={12} /> Sugestão para a próxima semana
                </p>
                <p className="text-sm text-gray-300 leading-relaxed">{r.ia_sugestao}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Top serviços + Top funcionários */}
      <div className="grid lg:grid-cols-2 gap-4">
        {dados.top_servicos?.length > 0 && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <p className="text-sm font-bold mb-3">Top serviços</p>
            <div className="space-y-2">
              {dados.top_servicos.map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-gray-500 w-4 shrink-0">{i + 1}</span>
                    <span className="text-sm truncate">{s.nome}</span>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-bold">{brl(s.total)}</p>
                    <p className="text-xs text-gray-400">{s.qtd}x</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {dados.top_funcionarios?.length > 0 && (
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <p className="text-sm font-bold mb-3">Funcionários</p>
            <div className="space-y-2">
              {dados.top_funcionarios.map((f, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0 text-xs font-bold text-orange-500">
                      {f.nome.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{f.nome}</p>
                      <p className="text-xs text-gray-400">{f.qtd} serviços</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-bold">{brl(f.total)}</p>
                    <p className="text-xs text-orange-500">{brl(f.comissao)} comissão</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, valor, icon: Icon, destaque, sub, subColor = 'text-gray-400' }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-3">
      <div className="flex items-start justify-between mb-1">
        <p className="text-xs text-gray-400 font-semibold">{label}</p>
        <Icon size={14} className="text-gray-500 shrink-0" />
      </div>
      <p className={`text-xl font-bold ${destaque ? 'text-orange-500' : ''}`}>{valor}</p>
      {sub && <p className={`text-xs mt-0.5 ${subColor}`}>{sub}</p>}
    </div>
  );
}
