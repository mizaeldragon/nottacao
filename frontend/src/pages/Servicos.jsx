import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Trash2,
  User,
  ClipboardList,
  Users,
  Briefcase,
  Wrench,
  ArrowRight,
} from 'lucide-react';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import api from '../services/api';
import { brl, horaBR } from '../utils/format';

export default function Servicos() {
  const [funcionarios, setFuncionarios] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [caixaAberto, setCaixaAberto] = useState(false);

  const [funcionarioId, setFuncionarioId] = useState('');
  const [tipoId, setTipoId] = useState('');
  const [valor, setValor] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [clienteFiadoTexto, setClienteFiadoTexto] = useState('');
  const [clientesBusca, setClientesBusca] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [showClienteList, setShowClienteList] = useState(false);
  const [veiculo, setVeiculo] = useState('');
  // Produtos vendidos junto com o serviço
  const [produtos, setProdutos] = useState([]);
  const [todosProdutos, setTodosProdutos] = useState([]);
  const [buscaProduto, setBuscaProduto] = useState('');
  const [showProdList, setShowProdList] = useState(false);
  const [placa, setPlaca] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('dinheiro');
  const [pagamentosMisto, setPagamentosMisto] = useState([
    { forma: 'pix', valor: '' },
    { forma: 'dinheiro', valor: '' },
  ]);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [confirmar, setConfirmar] = useState(null); // { mensagem, onOk }

  async function carregar() {
    try {
      const [f, t, l, c, cl] = await Promise.all([
        api.get('/funcionarios'),
        api.get('/tipos-servico'),
        api.get('/lancamentos'),
        api.get('/caixa/atual'),
        api.get('/clientes'),
      ]);
      setFuncionarios(f.data.filter((x) => x.ativo));
      setTipos(t.data.filter((x) => x.ativo));
      setLancamentos(l.data);
      setCaixaAberto(!!c.data);
      setClientes(cl.data || []);
      const prod = await api.get('/estoque');
      setTodosProdutos((prod.data || []).filter((p) => p.ativo && p.quantidade > 0));
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao carregar dados');
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function selecionarTipo(id) {
    setTipoId(id);
    const tipo = tipos.find((t) => t.id === id);
    if (tipo) setValor(String(Number(tipo.valor_padrao) || ''));
  }

  async function lancar(e) {
    e.preventDefault();
    setErro('');
    if (!funcionarioId) return setErro('Selecione o funcionário');
    if (!valor || Number(valor) <= 0) return setErro('Informe um valor válido');
    if (formaPagamento === 'fiado' && !clienteId) return setErro('Selecione o cliente fiado para lançar no fiado');

    if (formaPagamento === 'misto') {
      const soma = pagamentosMisto.reduce((s, p) => s + (Number(p.valor) || 0), 0);
      const total = Number(valor);
      if (Math.abs(soma - total) > 0.01) {
        return setErro(`A soma dos pagamentos (${brl(soma)}) deve ser igual ao valor total (${brl(total)})`);
      }
    }

    setSalvando(true);
    try {
      const tipo = tipos.find((t) => t.id === tipoId);
      const { data } = await api.post('/lancamentos', {
        funcionario_id: funcionarioId,
        tipo_servico_id: tipoId || null,
        nome_servico: tipo?.nome,
        valor: Number(valor),
        cliente_id: clienteId || undefined,
        cliente_nome: clienteNome,
        produtos: produtos.length > 0 ? produtos.map((p) => ({
          produto_id: p.id, quantidade: p.quantidade, preco_venda: p.preco_venda,
        })) : undefined,
        veiculo,
        placa,
        forma_pagamento: formaPagamento,
        pagamentos: formaPagamento === 'misto' ? pagamentosMisto.map((p) => ({ forma: p.forma, valor: Number(p.valor) })) : undefined,
      });
      setLancamentos((prev) => [data, ...prev]);
      setValor('');
      setTipoId('');
      setClienteNome('');
      setClienteId('');
      setClienteFiadoTexto('');
      setClientesBusca([]);
      setProdutos([]);
      setBuscaProduto('');
      setVeiculo('');
      setPlaca('');
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao lançar serviço');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id) {
    setConfirmar({
      mensagem: 'Excluir este serviço?',
      onOk: async () => {
        setConfirmar(null);
        try {
          await api.delete(`/lancamentos/${id}`);
          setLancamentos((prev) => prev.filter((l) => l.id !== id));
        } catch (err) {
          setErro(err.response?.data?.error || 'Erro ao excluir');
        }
      },
    });
    return;
  }

  const totalDia = lancamentos.reduce((s, l) => s + Number(l.valor), 0);
  const totalFunc = lancamentos.reduce((s, l) => s + Number(l.valor_funcionario), 0);
  const totalPatrao = lancamentos.reduce((s, l) => s + Number(l.valor_patrao), 0);

  const valorNum = Number(valor) || 0;
  const tipoSelecionado = tipos.find((t) => t.id === tipoId);
  const pctFunc = tipoSelecionado ? Number(tipoSelecionado.percentual_funcionario) : 50;
  const previaFunc = Math.round(valorNum * (pctFunc / 100) * 100) / 100;
  const previaPatrao = Math.round((valorNum - previaFunc) * 100) / 100;

  return (
    <Layout title="Serviços" subtitle="Lançamento e divisão de serviços realizados.">
      {/* Cards de totais */}
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <StatCard label="TOTAL DO DIA" valor={brl(totalDia)} icon={ClipboardList} destaque />
        <StatCard label="COMISSÃO FUNCIONÁRIO" valor={brl(totalFunc)} icon={Users} />
        <StatCard label="PARTE PATRÃO" valor={brl(totalPatrao)} icon={Briefcase} />
      </div>

      {!caixaAberto && (
        <div className="bg-yellow-500/15 border border-yellow-500/40 text-yellow-300 text-sm rounded-xl p-3 mb-4">
          Nenhum caixa aberto.{' '}
          <Link to="/caixa" className="underline font-semibold">
            Abrir caixa
          </Link>{' '}
          para lançar serviços.
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Lançar novo serviço */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <h2 className="font-bold mb-3">Lançar Novo Serviço</h2>
          <form onSubmit={lancar} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Funcionário</label>
              <select
                value={funcionarioId}
                onChange={(e) => setFuncionarioId(e.target.value)}
                className="w-full h-10 bg-gray-700 border border-gray-600 rounded-lg px-3 outline-none focus:border-orange-500 text-sm"
              >
                <option value="">Selecione o funcionário</option>
                {funcionarios.map((f) => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Tipo de Serviço</label>
              <select
                value={tipoId}
                onChange={(e) => selecionarTipo(e.target.value)}
                className="w-full h-10 bg-gray-700 border border-gray-600 rounded-lg px-3 outline-none focus:border-orange-500 text-sm"
              >
                <option value="">Selecione o serviço</option>
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Valor Cobrado</label>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="R$ 25,00"
                className="w-full h-10 bg-gray-700 border border-gray-600 rounded-lg px-3 text-base outline-none focus:border-orange-500"
              />
            </div>

            {/* Forma de pagamento */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Forma de pagamento</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[
                  { id: 'pix', label: 'Pix' },
                  { id: 'cartao_credito', label: 'Crédito' },
                  { id: 'cartao_debito', label: 'Débito' },
                  { id: 'dinheiro', label: 'Dinheiro' },
                  { id: 'misto', label: 'Misto' },
                  { id: 'fiado', label: 'Fiado' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormaPagamento(f.id)}
                    className={`h-9 rounded-lg text-sm font-medium transition-colors ${
                      formaPagamento === f.id ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Split de pagamento misto */}
              {formaPagamento === 'misto' && (
                <div className="mt-2 space-y-2">
                  {pagamentosMisto.map((pg, i) => {
                    const restante = (Number(valor) || 0) - pagamentosMisto.reduce((s, p, j) => j !== i ? s + (Number(p.valor) || 0) : s, 0);
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <select
                          value={pg.forma}
                          onChange={(e) => {
                            const arr = [...pagamentosMisto];
                            arr[i] = { ...arr[i], forma: e.target.value };
                            setPagamentosMisto(arr);
                          }}
                          className="w-28 h-9 bg-gray-700 border border-gray-600 rounded-lg px-2 text-sm outline-none focus:border-orange-500"
                        >
                          <option value="pix">Pix</option>
                          <option value="cartao_credito">Crédito</option>
                          <option value="cartao_debito">Débito</option>
                          <option value="dinheiro">Dinheiro</option>
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          placeholder={i === pagamentosMisto.length - 1 ? brl(restante > 0 ? restante : 0).replace('R$ ','') : '0,00'}
                          value={pg.valor}
                          onChange={(e) => {
                            const arr = [...pagamentosMisto];
                            arr[i] = { ...arr[i], valor: e.target.value };
                            setPagamentosMisto(arr);
                          }}
                          className="flex-1 h-9 bg-gray-700 border border-gray-600 rounded-lg px-3 text-sm outline-none focus:border-orange-500"
                        />
                        {pagamentosMisto.length > 2 && (
                          <button
                            type="button"
                            onClick={() => setPagamentosMisto(pagamentosMisto.filter((_, j) => j !== i))}
                            className="text-red-500 hover:text-red-400 px-1"
                          >✕</button>
                        )}
                      </div>
                    );
                  })}
                  {pagamentosMisto.length < 3 && (
                    <button
                      type="button"
                      onClick={() => setPagamentosMisto([...pagamentosMisto, { forma: 'dinheiro', valor: '' }])}
                      className="text-xs text-orange-400 hover:text-orange-300 font-semibold"
                    >
                      + Adicionar forma
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Ordem de serviço (opcional) */}
            <div className="grid grid-cols-2 gap-2">
              {/* Cliente comum — texto livre */}
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1">Cliente (opcional)</label>
                <input
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                  placeholder="Nome do cliente"
                  className="w-full h-9 bg-gray-700 border border-gray-600 rounded-lg px-3 outline-none focus:border-orange-500 text-sm"
                />
              </div>

              {/* Cliente fiado — autocomplete do cadastro */}
              <div className="col-span-2 relative">
                <label className="block text-xs text-gray-400 mb-1">
                  Cliente fiado (opcional)
                  {clienteId && <span className="ml-2 text-orange-400 font-semibold">· vinculado</span>}
                </label>
                <input
                  value={clienteFiadoTexto}
                  onChange={(e) => {
                    const v = e.target.value;
                    setClienteFiadoTexto(v);
                    setClienteId('');
                    if (v.length >= 1) {
                      setClientesBusca(clientes.filter((c) =>
                        c.nome.toLowerCase().includes(v.toLowerCase())
                      ).slice(0, 6));
                      setShowClienteList(true);
                    } else {
                      setClientesBusca([]);
                      setShowClienteList(false);
                    }
                  }}
                  onFocus={() => {
                    if (clienteFiadoTexto.length >= 1) {
                      setClientesBusca(clientes.filter((c) =>
                        c.nome.toLowerCase().includes(clienteFiadoTexto.toLowerCase())
                      ).slice(0, 6));
                      setShowClienteList(true);
                    }
                  }}
                  onBlur={() => setTimeout(() => setShowClienteList(false), 150)}
                  placeholder="Buscar cliente fiado cadastrado..."
                  className={`w-full h-9 bg-gray-700 border rounded-lg px-3 outline-none focus:border-orange-500 text-sm ${clienteId ? 'border-orange-500/60' : 'border-gray-600'}`}
                />
                {showClienteList && clientesBusca.length > 0 && (
                  <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-gray-800 border border-gray-600 rounded-lg shadow-xl overflow-hidden">
                    {clientesBusca.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={() => {
                          setClienteId(c.id);
                          setClienteFiadoTexto(c.nome);
                          setClientesBusca([]);
                          setShowClienteList(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 flex items-center justify-between"
                      >
                        <span className="font-medium">{c.nome}</span>
                        {c.saldo_devedor > 0 && (
                          <span className="text-xs text-red-400 font-semibold">Deve {brl(c.saldo_devedor)}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Veículo (opcional)</label>
                <input
                  value={veiculo}
                  onChange={(e) => setVeiculo(e.target.value)}
                  placeholder="Ex: Gol, Strada..."
                  className="w-full h-9 bg-gray-700 border border-gray-600 rounded-lg px-3 outline-none focus:border-orange-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Placa (opcional)</label>
                <input
                  value={placa}
                  onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                  placeholder="ABC-1D23"
                  className="w-full h-9 bg-gray-700 border border-gray-600 rounded-lg px-3 outline-none focus:border-orange-500 text-sm uppercase"
                />
              </div>
            </div>

            {/* Produtos vendidos junto com o serviço */}
            <div className="relative">
              <label className="block text-xs text-gray-400 mb-1">Produtos utilizados/vendidos (opcional)</label>
              <input
                value={buscaProduto}
                onChange={(e) => {
                  setBuscaProduto(e.target.value);
                  setShowProdList(e.target.value.length >= 1);
                }}
                onFocus={() => { if (buscaProduto.length >= 1) setShowProdList(true); }}
                onBlur={() => setTimeout(() => setShowProdList(false), 150)}
                placeholder="Buscar produto por nome..."
                className="w-full h-9 bg-gray-700 border border-gray-600 rounded-lg px-3 outline-none focus:border-orange-500 text-sm"
              />
              {showProdList && (
                <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-gray-800 border border-gray-600 rounded-lg shadow-xl overflow-hidden max-h-44 overflow-y-auto">
                  {todosProdutos
                    .filter((p) => p.nome.toLowerCase().includes(buscaProduto.toLowerCase()))
                    .slice(0, 8)
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={() => {
                          if (!produtos.find((x) => x.id === p.id)) {
                            setProdutos([...produtos, { ...p, quantidade: 1, preco_venda: Number(p.preco_venda) }]);
                          }
                          setBuscaProduto('');
                          setShowProdList(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-700 flex items-center justify-between"
                      >
                        <span className="font-medium">{p.nome}</span>
                        <span className="text-xs text-gray-400">{brl(p.preco_venda)} · estq: {p.quantidade}</span>
                      </button>
                    ))}
                  {todosProdutos.filter((p) => p.nome.toLowerCase().includes(buscaProduto.toLowerCase())).length === 0 && (
                    <p className="px-3 py-2 text-xs text-gray-500">Nenhum produto encontrado</p>
                  )}
                </div>
              )}

              {/* Itens adicionados */}
              {produtos.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {produtos.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-2 bg-gray-700/60 border border-gray-700 rounded-lg px-2.5 py-1.5">
                      <span className="flex-1 text-sm font-medium truncate">{p.nome}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => setProdutos(produtos.map((x, j) => j === i ? { ...x, quantidade: Math.max(1, x.quantidade - 1) } : x))}
                          className="w-6 h-6 rounded bg-gray-600 hover:bg-gray-500 text-sm font-bold flex items-center justify-center">−</button>
                        <span className="w-6 text-center text-sm font-semibold">{p.quantidade}</span>
                        <button type="button" onClick={() => setProdutos(produtos.map((x, j) => j === i ? { ...x, quantidade: Math.min(x.quantidade + 1, x.quantidade_estoque ?? 999) } : x))}
                          className="w-6 h-6 rounded bg-gray-600 hover:bg-gray-500 text-sm font-bold flex items-center justify-center">+</button>
                      </div>
                      <span className="text-sm font-bold text-orange-400 w-20 text-right shrink-0">{brl(p.preco_venda * p.quantidade)}</span>
                      <button type="button" onClick={() => setProdutos(produtos.filter((_, j) => j !== i))}
                        className="text-red-500 hover:text-red-400 p-0.5 shrink-0">
                        <Plus size={13} className="rotate-45" />
                      </button>
                    </div>
                  ))}
                  <div className="flex justify-between items-center px-1 pt-0.5">
                    <span className="text-xs text-gray-400">Total produtos</span>
                    <span className="text-sm font-bold text-orange-400">{brl(produtos.reduce((s, p) => s + p.preco_venda * p.quantidade, 0))}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Divisão estimada */}
            <div className="flex items-center justify-between gap-2 bg-orange-500/10 border border-orange-500/30 rounded-lg px-3 h-10">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-orange-400">
                <Wrench size={14} /> Divisão ({pctFunc}/{100 - pctFunc})
              </span>
              <span className="text-sm font-bold">
                {brl(previaFunc)} <span className="text-gray-500">/</span> {brl(previaPatrao)}
              </span>
            </div>

            {erro && <p className="text-red-400 text-xs">{erro}</p>}

            <button
              type="submit"
              disabled={salvando || (!caixaAberto && formaPagamento !== 'fiado')}
              className="w-full h-10 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg font-semibold transition-colors text-sm"
            >
              <Plus size={18} /> {formaPagamento === 'fiado' ? 'Lançar no Fiado' : 'Lançar Serviço'}
            </button>
          </form>
        </div>

        {/* Serviços recentes */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold">Serviços Recentes</h2>
            <span className="text-xs text-gray-400">Hoje</span>
          </div>

          <div className="space-y-2 flex-1">
            {lancamentos.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-8">
                Nenhum serviço lançado ainda.
              </p>
            )}
            {lancamentos.slice(0, 7).map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-2.5 bg-gray-700/40 border border-gray-700 rounded-lg p-2.5"
              >
                <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center text-orange-500 shrink-0">
                  <Wrench size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">
                    {l.nome_servico}
                    {(l.placa || l.veiculo) && (
                      <span className="text-gray-400 font-normal"> · {l.veiculo || ''}{l.placa ? ` ${l.placa}` : ''}</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <User size={11} /> {l.funcionario_nome || '—'} · {horaBR(l.created_at)}
                    {l.cliente_nome ? ` · ${l.cliente_nome}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm">{brl(l.valor)}</p>
                  <p className="text-xs text-gray-400">Comissão: {brl(l.valor_funcionario)}</p>
                </div>
                <button
                  onClick={() => excluir(l.id)}
                  className="text-red-500 hover:text-red-600 p-2 sm:p-1 shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          <Link
            to="/historico"
            className="mt-3 h-9 flex items-center justify-center gap-2 bg-gray-700/60 hover:bg-gray-700 rounded-lg text-sm font-semibold transition-colors"
          >
            Ver histórico completo <ArrowRight size={15} />
          </Link>
        </div>
      </div>
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

function StatCard({ label, valor, icon: Icon, destaque }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold tracking-wide text-gray-400">{label}</p>
        <Icon size={16} className="text-gray-500" />
      </div>
      <p className={`text-2xl font-bold mt-1 ${destaque ? 'text-orange-500' : ''}`}>{valor}</p>
    </div>
  );
}
