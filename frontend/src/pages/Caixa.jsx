import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Lock,
  ArrowDownCircle,
  ArrowUpCircle,
  Plus,
  Minus,
  FileDown,
  Unlock,
  X,
  Wrench,
  Receipt,
  ChevronRight,
  Trash2,
  Wallet,
  Users,
} from 'lucide-react';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { brl, horaBR, dataBR } from '../utils/format';
import { pdfFechamentoCaixa } from '../utils/pdf';
import { usePaginacao } from '../hooks/usePaginacao';
import Paginacao from '../components/Paginacao';

export default function Caixa() {
  const { tenant, usuario } = useAuth();
  const [dados, setDados] = useState(null);
  const [valorInicial, setValorInicial] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { tipo, titulo, motivoInicial } | null
  const [valeModal, setValeModal] = useState(false);
  const [fechamento, setFechamento] = useState(null);
  const [confirmar, setConfirmar] = useState(null); // { mensagem, onOk }
  const [filtro, setFiltro] = useState('todos'); // todos | entradas | saidas
  const [fecharModal, setFecharModal] = useState(false);
  const [caixasFechados, setCaixasFechados] = useState([]);

  async function carregar() {
    setLoading(true);
    try {
      const { data } = await api.get('/caixa/atual');
      setDados(data);
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao carregar caixa');
    } finally {
      setLoading(false);
    }
  }

  async function carregarFechados() {
    try {
      const { data } = await api.get('/caixa/fechados');
      setCaixasFechados(data);
    } catch {
      /* silencioso */
    }
  }

  useEffect(() => {
    carregar();
    carregarFechados();
  }, []);

  async function verCaixaFechado(id) {
    try {
      const { data } = await api.get(`/caixa/${id}`);
      setFechamento(data);
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao abrir caixa');
    }
  }

  async function abrirCaixa(e) {
    e.preventDefault();
    setErro('');
    try {
      await api.post('/caixa/abrir', { valor_inicial: Number(valorInicial) || 0 });
      setValorInicial('');
      setFechamento(null);
      carregar();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao abrir caixa');
    }
  }

  async function fecharCaixa(valorContado) {
    setErro('');
    try {
      const { data } = await api.post('/caixa/fechar', { valor_contado: valorContado });
      setFechamento(data);
      setDados(null);
      setFecharModal(false);
      carregarFechados();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao fechar caixa');
    }
  }

  async function excluirItem(item) {
    setConfirmar({
      mensagem: 'Excluir esta movimentação?',
      onOk: async () => {
        setConfirmar(null);
        try {
          if (item.kind === 'lancamento') {
            await api.delete(`/lancamentos/${item.id}`);
          } else {
            await api.delete(`/caixa/movimento/${item.id}`);
          }
          carregar();
        } catch (err) {
          setErro(err.response?.data?.error || 'Erro ao excluir');
        }
      },
    });
    return;
  }

  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  if (loading) {
    return (
      <Layout title="Gestão de Caixa">
        <p className="text-gray-400 text-center py-12">Carregando...</p>
      </Layout>
    );
  }

  // === Resumo de fechamento ===
  if (fechamento) {
    return (
      <Layout title="Caixa Fechado" subtitle="Resumo do dia">
        <div className="max-w-3xl">
          <ResumoFechamento resumo={fechamento.resumo} />
          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            <button
              onClick={() => pdfFechamentoCaixa(tenant?.nome, fechamento)}
              className="h-12 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold"
            >
              <FileDown size={18} /> Exportar PDF
            </button>
            <button
              onClick={() => setFechamento(null)}
              className="h-12 bg-orange-500 hover:bg-orange-600 rounded-lg font-semibold"
            >
              Abrir novo caixa
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // === Nenhum caixa aberto ===
  if (!dados) {
    return (
      <Layout title="Gestão de Caixa" subtitle={hoje}>
        {erro && <p className="text-red-400 text-sm mb-3">{erro}</p>}
        <div className="max-w-md bg-gray-800 border border-gray-700 rounded-2xl p-6">
          <div className="flex flex-col items-center mb-3 text-center">
            <div className="w-14 h-14 rounded-full bg-orange-500/15 flex items-center justify-center mb-3">
              <Unlock size={26} className="text-orange-500" />
            </div>
            <p className="font-semibold text-lg">Nenhum caixa aberto</p>
            <p className="text-gray-400 text-sm">Abra o caixa para começar o dia</p>
          </div>
          <form onSubmit={abrirCaixa} className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Valor inicial / troco (R$)</label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={valorInicial}
                onChange={(e) => setValorInicial(e.target.value)}
                placeholder="0,00"
                className="w-full h-12 bg-gray-700 border border-gray-600 rounded-lg px-3 text-lg outline-none focus:border-orange-500"
              />
            </div>
            <button
              type="submit"
              className="w-full h-12 bg-orange-500 hover:bg-orange-600 rounded-lg font-semibold"
            >
              Abrir caixa
            </button>
          </form>
        </div>

        <CaixasFechados lista={caixasFechados} onVer={verCaixaFechado} />
      </Layout>
    );
  }

  // === Caixa aberto ===
  const r = dados.resumo;
  const feed = montarFeed(dados);
  const qtdEntradas = feed.filter((m) => m.entrada).length;
  const qtdSaidas = feed.filter((m) => !m.entrada).length;
  const feedFiltrado = feed.filter((m) =>
    filtro === 'todos' ? true : filtro === 'entradas' ? m.entrada : !m.entrada
  );

  return (
    <Layout title="Gestão de Caixa" subtitle={hoje}>
      {erro && <p className="text-red-400 text-sm mb-3">{erro}</p>}

      {/* Barra de operação */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-xs font-bold tracking-wide text-orange-500 mb-1">OPERAÇÃO DE CAIXA</p>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-white bg-orange-500 rounded-full px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-white" /> CAIXA ABERTO
            </span>
            <span className="text-sm text-gray-400">
              Operador: <span className="font-semibold text-gray-200">{usuario?.nome || '—'}</span>
            </span>
          </div>
        </div>
        <button
          onClick={() => setFecharModal(true)}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-lg font-semibold border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Lock size={16} /> Fechar Caixa
        </button>
      </div>

      {/* Três colunas: Nova Entrada · Nova Saída · Resumo */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Nova Entrada */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-9 h-9 rounded-full bg-green-500/15 flex items-center justify-center text-green-400">
              <ArrowDownCircle size={20} />
            </span>
            <h2 className="font-bold">Nova Entrada</h2>
          </div>
          <div className="space-y-1">
            <LinhaAcao
              as={Link}
              to="/servicos"
              icon={Wrench}
              label="Lançar Serviço"
            />
            <LinhaAcao
              icon={Wallet}
              label="Suprimento de Caixa"
              onClick={() => setModal({ tipo: 'suprimento', titulo: 'Suprimento de Caixa' })}
            />
          </div>
        </div>

        {/* Nova Saída */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-9 h-9 rounded-full bg-red-500/15 flex items-center justify-center text-red-400">
              <ArrowUpCircle size={20} />
            </span>
            <h2 className="font-bold">Nova Saída</h2>
          </div>
          <div className="space-y-1">
            <LinhaAcao
              icon={Receipt}
              label="Pagamento de Despesa"
              onClick={() =>
                setModal({ tipo: 'sangria', titulo: 'Pagamento de Despesa', motivoInicial: '' })
              }
            />
            <LinhaAcao
              icon={Minus}
              label="Sangria de Gaveta"
              onClick={() => setModal({ tipo: 'sangria', titulo: 'Sangria de Gaveta' })}
            />
            <LinhaAcao
              icon={Users}
              label="Vale de Funcionário"
              onClick={() => setValeModal(true)}
            />
          </div>
        </div>

        {/* Resumo Financeiro */}
        <div className="bg-orange-500 text-white rounded-xl p-4 flex flex-col">
          <p className="text-xs font-bold tracking-wide text-white/80">RESUMO FINANCEIRO</p>
          <p className="text-sm text-white/80 mt-3">Saldo Atual em Caixa</p>
          <p className="text-4xl font-bold mt-1">{brl(r.saldo_final)}</p>

          <div className="mt-5 space-y-2 text-sm">
            <LinhaResumo icon={Wrench} label="Serviços" valor={brl(r.total_servicos)} />
            {r.vendas_produtos > 0 && (
              <LinhaResumo icon={Wallet} label="Vendas" valor={brl(r.vendas_produtos)} />
            )}
            <LinhaResumo icon={Wallet} label="Suprimentos" valor={brl(r.suprimentos)} />
            <LinhaResumo icon={Minus} label="Sangrias" valor={`- ${brl(r.sangrias)}`} />
            {r.compras_estoque > 0 && (
              <LinhaResumo icon={Minus} label="Compras" valor={`- ${brl(r.compras_estoque)}`} />
            )}
            <LinhaResumo icon={Users} label="Comissão Funcionários" valor={brl(r.total_funcionarios)} />
          </div>

          <p className="text-xs text-white/70 mt-5 pt-4 border-t border-white/20">
            Aberto às {horaBR(dados.caixa.created_at)} · troco {brl(r.valor_inicial)}
          </p>
        </div>
      </div>

      {/* Movimentações Recentes */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">Movimentações Recentes</h2>
          <Link
            to="/historico"
            className="text-xs font-bold tracking-wide text-orange-500 hover:text-orange-400"
          >
            VER RELATÓRIO COMPLETO
          </Link>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mb-3">
          <Pill ativo={filtro === 'todos'} onClick={() => setFiltro('todos')}>
            Todos
          </Pill>
          <Pill ativo={filtro === 'entradas'} onClick={() => setFiltro('entradas')}>
            Entradas ({qtdEntradas})
          </Pill>
          <Pill ativo={filtro === 'saidas'} onClick={() => setFiltro('saidas')}>
            Saídas ({qtdSaidas})
          </Pill>
        </div>

        {/* Tabela */}
        <FeedTabela feed={feedFiltrado} onExcluir={excluirItem} />
      </div>

      {/* Caixas fechados anteriores */}
      <CaixasFechados lista={caixasFechados} onVer={verCaixaFechado} />

      {modal && (
        <MovimentoModal
          modal={modal}
          onClose={() => setModal(null)}
          onSalvo={() => {
            setModal(null);
            carregar();
          }}
        />
      )}
      {fecharModal && (
        <FecharCaixaModal
          saldoEsperado={r.saldo_final}
          onClose={() => setFecharModal(false)}
          onConfirmar={fecharCaixa}
        />
      )}
      {valeModal && (
        <ValeModal
          onClose={() => setValeModal(false)}
          onSalvo={() => { setValeModal(false); carregar(); }}
        />
      )}
      {confirmar && (
        <ConfirmModal
          mensagem={confirmar.mensagem}
          onOk={confirmar.onOk}
          onCancelar={() => setConfirmar(null)}
        />
      )}
    </Layout>
  );
}

// Rótulo amigável da forma de pagamento.
const FORMA_PAG = {
  pix: 'PIX',
  cartao_credito: 'Crédito',
  cartao_debito: 'Débito',
  dinheiro: 'Dinheiro',
  misto: 'Misto',
  cartao: 'Cartão', // compatibilidade com registros antigos
};

// Categorias de cada movimento (rótulo + cor da pílula).
const CATEGORIAS = {
  servico: { label: 'Serviço', classe: 'bg-emerald-500/15 text-emerald-400' },
  suprimento: { label: 'Suprimento', classe: 'bg-sky-500/15 text-sky-400' },
  sangria: { label: 'Sangria', classe: 'bg-rose-500/15 text-rose-400' },
  vale: { label: 'Vale', classe: 'bg-violet-500/15 text-violet-400' },
  venda: { label: 'Venda', classe: 'bg-indigo-500/15 text-indigo-600' },
  compra: { label: 'Compra', classe: 'bg-amber-500/15 text-amber-600' },
};

// Monta o feed da tabela: serviços + suprimentos + sangrias + estoque (mais recente primeiro).
// A abertura não entra na tabela — fica no rodapé do Resumo.
function montarFeed(dados) {
  const itens = [];
  for (const l of dados.lancamentos || []) {
    itens.push({
      key: `l-${l.id}`,
      kind: 'lancamento',
      id: l.id,
      podeExcluir: true,
      cat: CATEGORIAS.servico,
      descricao: `${l.nome_servico}${l.funcionario_nome ? ` — ${l.funcionario_nome}` : ''}${l.placa ? ` (${l.placa})` : ''}`,
      formaPag: FORMA_PAG[l.forma_pagamento] || '—',
      hora: horaBR(l.created_at),
      valor: Number(l.valor),
      comissao: Number(l.valor_funcionario),
      entrada: true,
      ts: new Date(l.created_at).getTime(),
    });
  }
  for (const m of dados.movimentos || []) {
    const ehSuprimento = m.tipo === 'suprimento';
    const ehVale = m.tipo === 'sangria' && m.funcionario_id;
    itens.push({
      key: `m-${m.id}`,
      kind: 'movimento',
      id: m.id,
      podeExcluir: true,
      cat: ehSuprimento ? CATEGORIAS.suprimento : ehVale ? CATEGORIAS.vale : CATEGORIAS.sangria,
      descricao: m.motivo || (ehSuprimento ? 'Suprimento de caixa' : ehVale ? `Vale — ${m.funcionario_nome || ''}` : 'Sangria de gaveta'),
      formaPag: '—',
      hora: horaBR(m.created_at),
      valor: Number(m.valor),
      entrada: ehSuprimento,
      ts: new Date(m.created_at).getTime(),
    });
  }
  for (const e of dados.estoque || []) {
    const ehVenda = e.tipo === 'saida';
    itens.push({
      key: `e-${e.id}`,
      kind: 'estoque',
      id: e.id,
      podeExcluir: false, // movimentação de estoque não é excluível pelo caixa
      cat: ehVenda ? CATEGORIAS.venda : CATEGORIAS.compra,
      descricao: `${e.produto_nome} (${e.quantidade} un.)${e.motivo ? ` — ${e.motivo}` : ''}`,
      formaPag: ehVenda ? FORMA_PAG[e.forma_pagamento] || '—' : 'Dinheiro',
      hora: horaBR(e.created_at),
      valor: Number(e.valor_total),
      entrada: ehVenda,
      ts: new Date(e.created_at).getTime(),
    });
  }
  return itens.sort((a, b) => b.ts - a.ts);
}

// Linha clicável dos cards Nova Entrada / Nova Saída.
function LinhaAcao({ as: As = 'button', icon: Icon, label, ...props }) {
  return (
    <As
      className="w-full flex items-center gap-3 text-left rounded-xl px-3 py-3 hover:bg-gray-700/50 transition-colors"
      {...props}
    >
      <span className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center text-gray-300 shrink-0">
        <Icon size={16} />
      </span>
      <span className="flex-1 font-medium">{label}</span>
      <ChevronRight size={16} className="text-gray-500" />
    </As>
  );
}

// Linha do card laranja de resumo.
function LinhaResumo({ icon: Icon, label, valor }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-white/85">
        <Icon size={15} /> {label}
      </span>
      <span className="font-bold">{valor}</span>
    </div>
  );
}

function Pill({ ativo, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-semibold rounded-full px-3 py-1.5 transition-colors ${
        ativo
          ? 'bg-orange-500 text-white'
          : 'bg-gray-700/60 text-gray-300 hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

function MovimentoModal({ modal, onClose, onSalvo }) {
  const { tipo, titulo, motivoInicial } = modal;
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState(motivoInicial ?? '');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const ehSuprimento = tipo === 'suprimento';

  async function salvar(e) {
    e.preventDefault();
    if (!valor || Number(valor) <= 0) return setErro('Informe um valor válido');
    setSalvando(true);
    try {
      await api.post('/caixa/movimento', { tipo, valor: Number(valor), motivo });
      onSalvo();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao registrar');
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg">{titulo || (ehSuprimento ? 'Suprimento' : 'Sangria')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={salvar} className="space-y-3">
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            autoFocus
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Valor (R$)"
            className="w-full h-12 bg-gray-700 border border-gray-600 rounded-lg px-3 outline-none focus:border-orange-500"
          />
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo / descrição (opcional)"
            className="w-full h-12 bg-gray-700 border border-gray-600 rounded-lg px-3 outline-none focus:border-orange-500"
          />
          {erro && <p className="text-red-400 text-sm">{erro}</p>}
          <button
            type="submit"
            disabled={salvando}
            className={`w-full h-12 rounded-lg font-semibold disabled:opacity-50 ${
              ehSuprimento ? 'bg-sky-500 hover:bg-sky-600' : 'bg-orange-500 hover:bg-orange-600'
            }`}
          >
            Registrar
          </button>
        </form>
      </div>
    </div>
  );
}

function ResumoFechamento({ resumo }) {
  const f = resumo.por_forma || {};
  const totalFormas =
    (f.pix || 0) + (f.cartao_credito || 0) + (f.cartao_debito || 0) + (f.dinheiro || 0) + (f.cartao || 0);
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <Box label="Valor inicial" valor={brl(resumo.valor_inicial)} />
        <Box label={`Serviços (${resumo.qtd_servicos})`} valor={brl(resumo.total_servicos)} />
        {resumo.vendas_produtos > 0 && <Box label="Vendas de produtos" valor={brl(resumo.vendas_produtos)} />}
        <Box label="Suprimentos" valor={brl(resumo.suprimentos)} />
        <Box label="Sangrias" valor={`- ${brl(resumo.sangrias)}`} />
        {resumo.compras_estoque > 0 && <Box label="Compras de estoque" valor={`- ${brl(resumo.compras_estoque)}`} />}
        <Box label="Comissão Funcionários" valor={brl(resumo.total_funcionarios)} />
        <Box label="Patrão" valor={brl(resumo.total_patrao)} destaque />
      </div>

      <div className="border-t border-gray-700 pt-4 flex justify-between items-center">
        <span className="text-gray-400">Saldo final em caixa</span>
        <span className="text-3xl font-bold text-orange-500">{brl(resumo.saldo_final)}</span>
      </div>

      {/* Conferência */}
      {resumo.valor_contado != null && (
        <div className="border-t border-gray-700 pt-4 grid grid-cols-3 gap-3 text-sm">
          <Box label="Esperado" valor={brl(resumo.saldo_final)} />
          <Box label="Contado" valor={brl(resumo.valor_contado)} />
          <div className="bg-gray-900 rounded-lg p-3">
            <p className="text-xs text-gray-400">Diferença</p>
            <p className={`font-semibold mt-0.5 ${
              Math.abs(resumo.diferenca) < 0.01 ? 'text-emerald-400' : resumo.diferenca > 0 ? 'text-sky-400' : 'text-red-400'
            }`}>
              {Math.abs(resumo.diferenca) < 0.01 ? 'Conferido' : (resumo.diferenca > 0 ? 'Sobra ' : 'Falta ') + brl(Math.abs(resumo.diferenca))}
            </p>
          </div>
        </div>
      )}

      {/* Relatório por forma — sempre no fechamento (mistos já desmembrados no backend) */}
      <div className="border-t border-gray-700 pt-4">
        <p className="text-sm font-semibold text-gray-400 mb-2">Entradas por forma de pagamento</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Box label="Pix" valor={brl(f.pix || 0)} />
          <Box label="Cartão Crédito" valor={brl((f.cartao_credito || 0) + (f.cartao || 0))} />
          <Box label="Cartão Débito" valor={brl(f.cartao_debito || 0)} />
          <Box label="Dinheiro" valor={brl(f.dinheiro || 0)} />
        </div>
        <div className="mt-2 flex justify-between text-sm px-1">
          <span className="text-gray-500">Total recebido no dia</span>
          <span className="font-semibold text-orange-400">{brl(totalFormas)}</span>
        </div>
      </div>


      {resumo.por_funcionario?.length > 0 && (
        <div className="border-t border-gray-700 pt-4">
          <p className="text-sm font-semibold text-gray-400 mb-2">Por funcionário</p>
          <div className="space-y-1">
            {resumo.por_funcionario.map((f) => (
              <div key={f.funcionario_id || f.nome} className="flex justify-between text-sm">
                <span>
                  {f.nome} <span className="text-gray-500">({f.qtd})</span>
                </span>
                <span className="font-semibold text-orange-500">{brl(f.comissao)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Box({ label, valor, destaque }) {
  return (
    <div className="bg-gray-900 rounded-lg p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`font-semibold mt-0.5 ${destaque ? 'text-orange-500' : ''}`}>{valor}</p>
    </div>
  );
}

// Modal de fechamento com conferência de gaveta
function FecharCaixaModal({ saldoEsperado, onClose, onConfirmar }) {
  const [contado, setContado] = useState('');
  const [salvando, setSalvando] = useState(false);
  const temContagem = contado !== '' && !Number.isNaN(Number(contado));
  const diferenca = temContagem ? Math.round((Number(contado) - saldoEsperado) * 100) / 100 : 0;

  async function confirmar(comConferencia) {
    setSalvando(true);
    await onConfirmar(comConferencia ? Number(contado) : undefined);
    setSalvando(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg">Fechar Caixa</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900">
            <X size={20} />
          </button>
        </div>

        <div className="bg-gray-900 rounded-lg p-3 mb-3 flex justify-between items-center">
          <span className="text-sm text-gray-400">Saldo esperado na gaveta</span>
          <span className="font-bold text-orange-500">{brl(saldoEsperado)}</span>
        </div>

        <label className="block text-sm text-gray-300 mb-1">Quanto você contou? (R$)</label>
        <input
          type="number"
          step="0.01"
          inputMode="decimal"
          autoFocus
          value={contado}
          onChange={(e) => setContado(e.target.value)}
          placeholder="0,00"
          className="w-full h-12 bg-gray-700 border border-gray-600 rounded-lg px-3 text-lg outline-none focus:border-orange-500"
        />

        {temContagem && (
          <div className={`mt-3 rounded-lg px-4 h-11 flex items-center justify-between text-sm font-semibold ${
            Math.abs(diferenca) < 0.01
              ? 'bg-emerald-500/10 text-emerald-400'
              : diferenca > 0
              ? 'bg-sky-500/10 text-sky-400'
              : 'bg-red-500/10 text-red-400'
          }`}>
            <span>{Math.abs(diferenca) < 0.01 ? 'Conferido ✓' : diferenca > 0 ? 'Sobra' : 'Falta'}</span>
            {Math.abs(diferenca) >= 0.01 && <span>{brl(Math.abs(diferenca))}</span>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button
            onClick={() => confirmar(false)}
            disabled={salvando}
            className="h-11 rounded-lg font-medium bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200"
          >
            Fechar sem conferir
          </button>
          <button
            onClick={() => confirmar(true)}
            disabled={salvando || !temContagem}
            className="h-11 rounded-lg font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50"
          >
            Conferir e fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// Tabela de movimentações do caixa com paginação
function FeedTabela({ feed, onExcluir }) {
  const { pagina, setPagina, totalPaginas, total, itens } = usePaginacao(feed, 10);
  return (
    <>
      {/* Tabela — desktop */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold tracking-wide text-gray-500 border-b border-gray-700">
              <th className="py-2 pr-4 font-semibold">HORA</th>
              <th className="py-2 pr-4 font-semibold">CATEGORIA</th>
              <th className="py-2 pr-4 font-semibold">DESCRIÇÃO</th>
              <th className="py-2 pr-4 font-semibold">FORMA PAG.</th>
              <th className="py-2 pr-4 font-semibold text-right">VALOR</th>
              <th className="py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {feed.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-gray-500 py-8">
                  Sem movimentações.
                </td>
              </tr>
            )}
            {itens.map((m) => (
              <tr key={m.key} className="border-b border-gray-700/50 last:border-0">
                <td className="py-2 pr-4 text-gray-400 whitespace-nowrap">{m.hora}</td>
                <td className="py-2 pr-4">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 ${m.cat.classe}`}>
                    {m.cat.label}
                  </span>
                </td>
                <td className="py-2 pr-4 max-w-[220px] truncate">{m.descricao}</td>
                <td className="py-2 pr-4 text-gray-400 whitespace-nowrap">{m.formaPag}</td>
                <td className="py-2 pr-4 text-right whitespace-nowrap">
                  <p className={`font-bold ${m.entrada ? 'text-green-400' : 'text-red-400'}`}>
                    {m.entrada ? '+' : '-'}
                    {brl(m.valor)}
                  </p>
                  {m.comissao != null && (
                    <p className="text-xs text-gray-400 font-normal">Comissão: {brl(m.comissao)}</p>
                  )}
                </td>
                <td className="py-3 text-right">
                  {m.podeExcluir && (
                    <button onClick={() => onExcluir(m)} className="p-2 sm:p-1.5 text-red-500 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards — mobile */}
      <div className="sm:hidden space-y-2">
        {feed.length === 0 && (
          <p className="text-center text-gray-500 py-8">Sem movimentações.</p>
        )}
        {itens.map((m) => (
          <div key={m.key} className="bg-gray-700/50 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 ${m.cat.classe}`}>
                {m.cat.label}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{m.hora}</span>
                {m.podeExcluir && (
                  <button onClick={() => onExcluir(m)} className="p-2 sm:p-1.5 text-red-500 hover:text-red-600">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
            <p className="font-medium text-sm truncate">{m.descricao}</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{m.formaPag}</span>
              <div className="text-right">
                <span className={`font-bold text-sm ${m.entrada ? 'text-green-400' : 'text-red-400'}`}>
                  {m.entrada ? '+' : '-'}{brl(m.valor)}
                </span>
                {m.comissao != null && (
                  <p className="text-xs text-gray-400">Comissão: {brl(m.comissao)}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Paginacao pagina={pagina} totalPaginas={totalPaginas} total={total} onPagina={setPagina} />
    </>
  );
}

const FORMAS_VALE = [
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'pix', label: 'Pix' },
  { id: 'cartao_credito', label: 'Crédito' },
  { id: 'cartao_debito', label: 'Débito' },
];

function ValeModal({ onClose, onSalvo }) {
  const [funcionarios, setFuncionarios] = useState([]);
  const [funcionarioId, setFuncionarioId] = useState('');
  const [valor, setValor] = useState('');
  const [forma, setForma] = useState('dinheiro');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api.get('/funcionarios').then(({ data }) => setFuncionarios(data.filter((f) => f.ativo)));
  }, []);

  async function salvar(e) {
    e.preventDefault();
    if (!funcionarioId) return setErro('Selecione o funcionário');
    if (!valor || Number(valor) <= 0) return setErro('Informe um valor válido');
    setSalvando(true);
    try {
      await api.post('/caixa/movimento', {
        tipo: 'sangria',
        valor: Number(valor),
        motivo: motivo || undefined,
        funcionario_id: funcionarioId,
        forma_pagamento: forma,
      });
      onSalvo();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao registrar vale');
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Vale de Funcionário</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200"><X size={20} /></button>
        </div>
        <form onSubmit={salvar} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Funcionário</label>
            <select
              value={funcionarioId}
              onChange={(e) => setFuncionarioId(e.target.value)}
              autoFocus
              className="w-full h-11 bg-gray-700 border border-gray-600 rounded-lg px-3 outline-none focus:border-orange-500"
            >
              <option value="">Selecione...</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Valor do vale (R$)</label>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              className="w-full h-11 bg-gray-700 border border-gray-600 rounded-lg px-3 outline-none focus:border-orange-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Forma de pagamento</label>
            <div className="grid grid-cols-2 gap-2">
              {FORMAS_VALE.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setForma(f.id)}
                  className={`h-9 rounded-lg text-sm font-medium transition-colors ${
                    forma === f.id
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Observação (opcional)</label>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Adiantamento do mês"
              className="w-full h-11 bg-gray-700 border border-gray-600 rounded-lg px-3 outline-none focus:border-orange-500"
            />
          </div>
          <p className="text-xs text-gray-500">O vale sai do caixa e desconta automaticamente no acerto de comissão do funcionário.</p>
          {erro && <p className="text-red-400 text-sm">{erro}</p>}
          <button
            type="submit"
            disabled={salvando}
            className="w-full h-11 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg font-semibold transition-colors"
          >
            Registrar Vale
          </button>
        </form>
      </div>
    </div>
  );
}

// Lista dos caixas já fechados (reabrir resumo / PDF)
function CaixasFechados({ lista, onVer }) {
  const { pagina, setPagina, totalPaginas, total, itens } = usePaginacao(lista || [], 10);
  if (!lista || lista.length === 0) return null;
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mt-4">
      <h2 className="font-bold mb-3">Caixas Fechados</h2>

      {/* Tabela — desktop */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold tracking-wide text-gray-500 border-b border-gray-700">
              <th className="py-2 pr-4">DATA</th>
              <th className="py-2 pr-4">CONTADO</th>
              <th className="py-2 pr-4">DIFERENÇA</th>
              <th className="py-2 text-right">FECHADO ÀS</th>
              <th className="py-2 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {itens.map((c) => (
              <tr key={c.id} className="border-b border-gray-700/50 last:border-0">
                <td className="py-2 pr-4 font-medium">{dataBR(c.data)}</td>
                <td className="py-2 pr-4 text-gray-300">{c.valor_contado != null ? brl(c.valor_contado) : '—'}</td>
                <td className="py-2 pr-4">
                  {c.diferenca == null ? (
                    <span className="text-gray-500">—</span>
                  ) : (
                    <span className={Math.abs(Number(c.diferenca)) < 0.01 ? 'text-emerald-400' : Number(c.diferenca) > 0 ? 'text-sky-400' : 'text-red-400'}>
                      {Math.abs(Number(c.diferenca)) < 0.01 ? 'OK' : (Number(c.diferenca) > 0 ? '+' : '-') + brl(Math.abs(Number(c.diferenca)))}
                    </span>
                  )}
                </td>
                <td className="py-3 text-right text-gray-400">{c.fechado_em ? horaBR(c.fechado_em) : '—'}</td>
                <td className="py-3 text-right">
                  <button onClick={() => onVer(c.id)} className="text-xs font-bold text-orange-500 hover:text-orange-400">
                    VER
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards — mobile */}
      <div className="sm:hidden space-y-2">
        {itens.map((c) => (
          <div key={c.id} className="bg-gray-700/50 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold">{dataBR(c.data)}</span>
              <button onClick={() => onVer(c.id)} className="text-xs font-bold text-orange-500 hover:text-orange-400 border border-orange-500/40 rounded-lg px-2.5 py-1">
                VER
              </button>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-400">
              <span>Contado: <span className="text-gray-200">{c.valor_contado != null ? brl(c.valor_contado) : '—'}</span></span>
              <span>Fechado às: <span className="text-gray-200">{c.fechado_em ? horaBR(c.fechado_em) : '—'}</span></span>
            </div>
            <div className="text-sm">
              {c.diferenca == null ? (
                <span className="text-gray-500">Sem conferência</span>
              ) : (
                <span className={`font-semibold ${Math.abs(Number(c.diferenca)) < 0.01 ? 'text-emerald-400' : Number(c.diferenca) > 0 ? 'text-sky-400' : 'text-red-400'}`}>
                  {Math.abs(Number(c.diferenca)) < 0.01
                    ? 'Conferido — OK'
                    : (Number(c.diferenca) > 0 ? 'Sobra ' : 'Falta ') + brl(Math.abs(Number(c.diferenca)))}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <Paginacao pagina={pagina} totalPaginas={totalPaginas} total={total} onPagina={setPagina} />
    </div>
  );
}
