import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Plus,
  ShoppingCart,
  X,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ArrowDownToLine,
  ArrowUpFromLine,
  Minus,
  Check,
  Filter,
  Package,
  AlertTriangle,
  Receipt,
} from 'lucide-react';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { brl } from '../utils/format';
import { pdfReciboVenda } from '../utils/pdf';
import { usePaginacao } from '../hooks/usePaginacao';
import RangePicker from '../components/RangePicker';
import Paginacao from '../components/Paginacao';

const UNIDADES = ['Unidade', 'Kg', 'Litro', 'Caixa', 'Pacote', 'Par', 'Metro'];
const ABAS = [
  { id: 'venda', label: 'Venda' },
  { id: 'estoque', label: 'Estoque' },
  { id: 'movimentacoes', label: 'Movimentações' },
];

const inputCls =
  'w-full h-11 bg-gray-700 border border-gray-600 rounded-lg px-3 outline-none focus:border-orange-500';

// Lê uma imagem e devolve um data URL JPEG redimensionado (não pesar o banco)
function lerImagemRedimensionada(file, max = 400) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * escala);
        const h = Math.round(img.height * escala);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Estoque() {
  const { tenant } = useAuth();
  const [aba, setAba] = useState('venda');
  const [produtos, setProdutos] = useState([]);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [modal, setModal] = useState(null); // { tipo:'novo'|'editar'|'entrada'|'saida', produto? }
  const [confirmar, setConfirmar] = useState(null); // { mensagem, onOk }

  // PDV
  const [busca, setBusca] = useState('');
  const [catFiltro, setCatFiltro] = useState('Todos');
  const [carrinho, setCarrinho] = useState([]); // [{ produto_id, nome, preco, max, quantidade }]
  const [formaPagamento, setFormaPagamento] = useState('dinheiro');
  const [dividir, setDividir] = useState(false);
  const [pagamentos, setPagamentos] = useState([]); // [{ forma, valor }]
  const [cobrando, setCobrando] = useState(false);
  const [ultimaVenda, setUltimaVenda] = useState(null); // p/ recibo
  const [clientes, setClientes] = useState([]);
  const [fiado, setFiado] = useState(false);
  const [clienteId, setClienteId] = useState('');

  async function carregar(incluirInativos = mostrarInativos) {
    try {
      const { data } = await api.get('/estoque', {
        params: incluirInativos ? { inativos: 1 } : {},
      });
      setProdutos(data);
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao carregar produtos');
    }
  }
  useEffect(() => {
    carregar(mostrarInativos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrarInativos]);

  useEffect(() => {
    api.get('/clientes').then(({ data }) => setClientes(data)).catch(() => {});
  }, []);

  const categorias = useMemo(() => {
    const set = new Set();
    produtos.forEach((p) => p.categoria && set.add(p.categoria));
    return Array.from(set);
  }, [produtos]);

  function flash(msg) {
    setAviso(msg);
    setTimeout(() => setAviso(''), 3000);
  }

  // ---------- Carrinho (PDV) ----------
  function addCarrinho(p) {
    if (Number(p.quantidade) <= 0) return;
    setCarrinho((c) => {
      const ex = c.find((i) => i.produto_id === p.id);
      if (ex) {
        if (ex.quantidade >= ex.max) return c;
        return c.map((i) => (i.produto_id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i));
      }
      return [
        ...c,
        { produto_id: p.id, nome: p.nome, preco: Number(p.preco_venda), max: Number(p.quantidade), quantidade: 1 },
      ];
    });
  }
  function mudarQtd(produto_id, delta) {
    setCarrinho((c) =>
      c
        .map((i) =>
          i.produto_id === produto_id
            ? { ...i, quantidade: Math.max(0, Math.min(i.max, i.quantidade + delta)) }
            : i
        )
        .filter((i) => i.quantidade > 0)
    );
  }
  function removerItem(produto_id) {
    setCarrinho((c) => c.filter((i) => i.produto_id !== produto_id));
  }
  const totalCarrinho = Math.round(carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0) * 100) / 100;
  const qtdCarrinho = carrinho.reduce((s, i) => s + i.quantidade, 0);
  const somaPagamentos = pagamentos.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const restante = Math.round((totalCarrinho - somaPagamentos) * 100) / 100;

  function entrarDividir() {
    setDividir(true);
    setPagamentos([{ forma: 'dinheiro', valor: totalCarrinho ? totalCarrinho.toFixed(2) : '' }]);
  }
  function sairDividir() {
    setDividir(false);
    setPagamentos([]);
  }
  function addPagamento() {
    const rest = restante > 0 ? restante : 0;
    setPagamentos((ps) => [...ps, { forma: 'pix', valor: rest ? rest.toFixed(2) : '' }]);
  }
  function mudarPagamento(i, campo, valor) {
    setPagamentos((ps) => ps.map((p, idx) => (idx === i ? { ...p, [campo]: valor } : p)));
  }
  function removerPagamento(i) {
    setPagamentos((ps) => ps.filter((_, idx) => idx !== i));
  }

  async function cobrar() {
    if (carrinho.length === 0) return;
    setErro('');
    const body = {
      itens: carrinho.map((i) => ({ produto_id: i.produto_id, quantidade: i.quantidade })),
    };
    if (fiado) {
      if (!clienteId) return setErro('Selecione o cliente para vender no fiado');
      body.fiado = true;
      body.cliente_id = clienteId;
    } else if (dividir) {
      const pags = pagamentos
        .map((p) => ({ forma: p.forma, valor: Number(p.valor) || 0 }))
        .filter((p) => p.valor > 0);
      if (Math.abs(restante) >= 0.01) return setErro('A soma dos pagamentos deve ser igual ao total');
      body.pagamentos = pags;
    } else {
      body.forma_pagamento = formaPagamento;
    }
    const itensSnapshot = carrinho.map((i) => ({ nome: i.nome, quantidade: i.quantidade, preco: i.preco }));
    setCobrando(true);
    try {
      const { data } = await api.post('/estoque/vender', body);
      setUltimaVenda(data.fiado ? null : { itens: itensSnapshot, total: data.total, pagamentos: data.pagamentos, data: Date.now() });
      setCarrinho([]);
      sairDividir();
      setFiado(false);
      setClienteId('');
      await carregar(mostrarInativos);
      flash(data.fiado ? `Fiado registrado: ${brl(data.total)}` : `Venda registrada: ${brl(data.total)} (${data.itens} item(ns))`);
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao registrar venda');
    } finally {
      setCobrando(false);
    }
  }

  // ---------- Ações de produto ----------
  async function toggleAtivo(p) {
    try {
      await api.patch(`/estoque/${p.id}/ativo`, { ativo: !p.ativo });
      carregar(mostrarInativos);
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao atualizar');
    }
  }
  async function excluir(p) {
    setConfirmar({
      mensagem: `Excluir "${p.nome}"? (se tiver histórico, será apenas inativado)`,
      onOk: async () => {
        setConfirmar(null);
        try {
          const { data } = await api.delete(`/estoque/${p.id}`);
          carregar(mostrarInativos);
          flash(data.inativado ? 'Produto inativado (tinha histórico).' : 'Produto excluído.');
        } catch (err) {
          setErro(err.response?.data?.error || 'Erro ao excluir');
        }
      },
    });
    return;
  }

  const produtosFiltrados = produtos.filter((p) => {
    if (catFiltro !== 'Todos' && p.categoria !== catFiltro) return false;
    if (busca && !p.nome.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  return (
    <Layout title="Vendas & Estoque" subtitle="PDV, controle de estoque e movimentações.">
      {/* Abas */}
      <div className="border-b border-gray-700 mb-6 flex gap-6">
        {ABAS.map((t) => (
          <button
            key={t.id}
            onClick={() => setAba(t.id)}
            className={`pb-3 -mb-px border-b-2 text-sm font-medium transition-colors ${
              aba === t.id
                ? 'border-orange-500 text-orange-500'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {erro && <p className="text-red-400 text-sm mb-3">{erro}</p>}
      {aviso && (
        <div className="text-emerald-400 text-sm mb-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 flex items-center justify-between gap-3">
          <span>{aviso}</span>
          {ultimaVenda && (
            <button
              onClick={() => pdfReciboVenda(tenant?.nome, ultimaVenda)}
              className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 rounded-lg px-2.5 py-1"
            >
              <Receipt size={14} /> Baixar recibo
            </button>
          )}
        </div>
      )}

      {aba === 'venda' && (
        <div className="flex flex-col xl:flex-row gap-6">
          {/* Produtos */}
          <div className="flex-1 min-w-0">
            <div className="flex gap-3 mb-4">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar produto"
                  className="w-full h-11 bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-3 outline-none focus:border-orange-500"
                />
              </div>
              <button
                onClick={() => setModal({ tipo: 'novo' })}
                className="h-11 px-4 flex items-center gap-2 bg-orange-500 hover:bg-orange-600 rounded-lg font-semibold shrink-0"
              >
                <Plus size={18} /> Novo produto
              </button>
            </div>

            {/* Chips de categoria */}
            <div className="flex flex-wrap gap-2 mb-4">
              <Chip ativo={catFiltro === 'Todos'} onClick={() => setCatFiltro('Todos')}>
                Todos <b>{produtos.length}</b>
              </Chip>
              {categorias.map((c) => (
                <Chip key={c} ativo={catFiltro === c} onClick={() => setCatFiltro(c)}>
                  {c} <b>{produtos.filter((p) => p.categoria === c).length}</b>
                </Chip>
              ))}
            </div>

            {produtosFiltrados.length === 0 ? (
              <p className="text-gray-500 text-sm py-10 text-center">Nenhum produto encontrado.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {produtosFiltrados.map((p) => {
                  const noCarrinho = carrinho.find((i) => i.produto_id === p.id)?.quantidade || 0;
                  const semEstoque = Number(p.quantidade) <= 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => addCarrinho(p)}
                      disabled={semEstoque}
                      className={`relative text-left bg-gray-800 border rounded-2xl p-3 transition-colors ${
                        noCarrinho
                          ? 'border-orange-500'
                          : 'border-gray-700 hover:border-gray-600'
                      } ${semEstoque ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {noCarrinho > 0 && (
                        <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                          {noCarrinho}
                        </span>
                      )}
                      <div className="h-28 rounded-xl bg-gray-700 mb-3 flex items-center justify-center overflow-hidden">
                        {p.imagem ? (
                          <img src={p.imagem} alt={p.nome} className="w-full h-full object-cover" />
                        ) : (
                          <Package size={32} className="text-gray-500" />
                        )}
                      </div>
                      <p className="font-semibold truncate">{p.nome}</p>
                      <div className="flex items-end justify-between mt-1">
                        <span className="font-bold">{brl(p.preco_venda)}</span>
                        <span className={`text-xs ${semEstoque ? 'text-red-400' : 'text-gray-500'}`}>
                          {p.quantidade} {p.unidade?.toLowerCase() || 'un'}.
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Carrinho */}
          <div className="xl:w-80 shrink-0">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 xl:sticky xl:top-6">
              <p className="text-xs font-semibold tracking-wide text-gray-400 mb-3">
                VENDA EM ANDAMENTO
              </p>

              {carrinho.length === 0 ? (
                <div className="py-10 text-center text-gray-500">
                  <ShoppingCart size={32} className="mx-auto mb-2 opacity-60" />
                  <p className="text-sm">Clique nos produtos para adicionar</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 max-h-72 overflow-y-auto mb-4">
                    {carrinho.map((i) => (
                      <div key={i.produto_id} className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-gray-700 rounded-lg p-1">
                          <button onClick={() => mudarQtd(i.produto_id, -1)} className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-white">
                            <Minus size={14} />
                          </button>
                          <span className="w-6 text-center text-sm font-semibold">{i.quantidade}</span>
                          <button onClick={() => mudarQtd(i.produto_id, +1)} className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-white disabled:opacity-40" disabled={i.quantidade >= i.max}>
                            <Plus size={14} />
                          </button>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{i.nome}</p>
                          <p className="text-xs text-gray-500">{brl(i.preco)} un.</p>
                        </div>
                        <span className="text-sm font-semibold">{brl(i.preco * i.quantidade)}</span>
                        <button onClick={() => removerItem(i.produto_id)} className="text-gray-500 hover:text-red-400">
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between text-sm text-gray-400 border-t border-gray-700 pt-3">
                    <span>{qtdCarrinho} item(ns) · subtotal</span>
                    <span>{brl(totalCarrinho)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-gray-400">Total a pagar</span>
                    <span className="text-2xl font-bold">{brl(totalCarrinho)}</span>
                  </div>

                  {/* Alternância à vista / fiado */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <button
                      onClick={() => setFiado(false)}
                      className={`h-9 rounded-lg text-sm font-medium transition-colors ${
                        !fiado ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      À vista
                    </button>
                    <button
                      onClick={() => { setFiado(true); sairDividir(); }}
                      className={`h-9 rounded-lg text-sm font-medium transition-colors ${
                        fiado ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      Fiado
                    </button>
                  </div>

                  {fiado ? (
                    <div className="mb-3">
                      <label className="block text-xs text-gray-400 mb-1">Cliente</label>
                      <select
                        value={clienteId}
                        onChange={(e) => setClienteId(e.target.value)}
                        className="w-full h-10 bg-gray-700 border border-gray-600 rounded-lg px-2 text-sm outline-none focus:border-orange-500"
                      >
                        <option value="">Selecione o cliente</option>
                        {clientes.map((c) => (
                          <option key={c.id} value={c.id}>{c.nome}{Number(c.saldo_devedor) > 0 ? ` (deve ${brl(c.saldo_devedor)})` : ''}</option>
                        ))}
                      </select>
                      {clientes.length === 0 && (
                        <p className="text-xs text-gray-500 mt-1">Cadastre clientes na aba Clientes.</p>
                      )}
                    </div>
                  ) : !dividir ? (
                    <>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        {[
                          { id: 'pix', label: 'Pix' },
                          { id: 'cartao_credito', label: 'Crédito' },
                          { id: 'cartao_debito', label: 'Débito' },
                          { id: 'dinheiro', label: 'Dinheiro' },
                        ].map((f) => (
                          <button
                            key={f.id}
                            onClick={() => setFormaPagamento(f.id)}
                            className={`h-9 rounded-lg text-sm font-medium transition-colors ${
                              formaPagamento === f.id
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={entrarDividir}
                        className="w-full h-9 mb-3 rounded-lg text-sm font-medium bg-gray-700/60 text-gray-300 hover:bg-gray-600"
                      >
                        + Dividir pagamento
                      </button>
                    </>
                  ) : (
                    <div className="mb-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-400">PAGAMENTO DIVIDIDO</span>
                        <button onClick={sairDividir} className="text-xs text-gray-400 hover:text-gray-200">
                          Voltar
                        </button>
                      </div>
                      {pagamentos.map((p, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <select
                            value={p.forma}
                            onChange={(e) => mudarPagamento(i, 'forma', e.target.value)}
                            className="h-9 bg-gray-700 border border-gray-600 rounded-lg px-2 text-sm outline-none focus:border-orange-500"
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
                            value={p.valor}
                            onChange={(e) => mudarPagamento(i, 'valor', e.target.value)}
                            placeholder="0,00"
                            className="h-9 flex-1 min-w-0 bg-gray-700 border border-gray-600 rounded-lg px-2 text-sm outline-none focus:border-orange-500"
                          />
                          {pagamentos.length > 1 && (
                            <button onClick={() => removerPagamento(i)} className="text-gray-500 hover:text-red-400 shrink-0">
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={addPagamento}
                        className="w-full h-9 rounded-lg text-sm font-medium bg-gray-700/60 text-gray-300 hover:bg-gray-600 flex items-center justify-center gap-1"
                      >
                        <Plus size={14} /> Adicionar forma
                      </button>
                      <div className={`flex justify-between text-sm font-medium ${Math.abs(restante) < 0.01 ? 'text-emerald-400' : 'text-amber-500'}`}>
                        <span>{restante > 0.005 ? 'Falta' : restante < -0.005 ? 'Excede' : 'Conferido'}</span>
                        <span>{brl(Math.abs(restante))}</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={cobrar}
                    disabled={cobrando || (fiado && !clienteId) || (!fiado && dividir && Math.abs(restante) >= 0.01)}
                    className="w-full h-12 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg font-semibold"
                  >
                    {fiado ? 'Vender no fiado' : 'Cobrar'} {brl(totalCarrinho)} →
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {aba === 'estoque' && (
        <TabEstoque
          produtos={produtos}
          mostrarInativos={mostrarInativos}
          setMostrarInativos={setMostrarInativos}
          onNovo={() => setModal({ tipo: 'novo' })}
          onEntrada={(p) => setModal({ tipo: 'entrada', produto: p })}
          onSaida={(p) => setModal({ tipo: 'saida', produto: p })}
          onEditar={(p) => setModal({ tipo: 'editar', produto: p })}
          onToggle={toggleAtivo}
          onExcluir={excluir}
        />
      )}

      {aba === 'movimentacoes' && <TabMovimentacoes produtos={produtos} />}

      {/* Modais */}
      {modal?.tipo === 'novo' && (
        <ProdutoModal categorias={categorias} onClose={() => setModal(null)} onSalvo={() => { setModal(null); carregar(mostrarInativos); }} />
      )}
      {modal?.tipo === 'editar' && (
        <ProdutoModal produto={modal.produto} categorias={categorias} onClose={() => setModal(null)} onSalvo={() => { setModal(null); carregar(mostrarInativos); }} />
      )}
      {(modal?.tipo === 'entrada' || modal?.tipo === 'saida') && (
        <MovimentarModal
          tipo={modal.tipo}
          produto={modal.produto}
          onClose={() => setModal(null)}
          onSalvo={() => { setModal(null); carregar(mostrarInativos); }}
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

function Chip({ ativo, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`h-8 px-3 rounded-full text-sm font-medium transition-colors ${
        ativo ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

// ---------------- Aba Estoque (tabela) ----------------
function TabEstoque({ produtos, mostrarInativos, setMostrarInativos, onNovo, onEntrada, onSaida, onEditar, onToggle, onExcluir }) {
  const { pagina, setPagina, totalPaginas, total, itens } = usePaginacao(produtos, 10);
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setMostrarInativos((v) => !v)}
          className="h-10 px-3 flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700"
        >
          {mostrarInativos ? <EyeOff size={16} /> : <Eye size={16} />}
          {mostrarInativos ? 'Ocultar inativos' : 'Mostrar inativos'}
        </button>
        <button onClick={onNovo} className="h-10 px-4 flex items-center gap-2 bg-orange-500 hover:bg-orange-600 rounded-lg font-semibold">
          <Plus size={18} /> Novo produto
        </button>
      </div>

      {/* Tabela — desktop */}
      <div className="hidden sm:block bg-gray-800 border border-gray-700 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold tracking-wide text-gray-500 border-b border-gray-700">
              <th className="py-3 px-4">PRODUTO</th>
              <th className="py-3 px-4">CATEGORIA</th>
              <th className="py-3 px-4">PREÇO VENDA</th>
              <th className="py-3 px-4">PREÇO CUSTO</th>
              <th className="py-3 px-4">MARGEM</th>
              <th className="py-3 px-4">ESTOQUE</th>
              <th className="py-3 px-4">EST. MÍN.</th>
              <th className="py-3 px-4">STATUS</th>
              <th className="py-3 px-4 text-right">AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {produtos.length === 0 ? (
              <tr><td colSpan={9} className="text-center text-gray-500 py-10">Nenhum produto cadastrado.</td></tr>
            ) : (
              itens.map((p) => {
                const venda = Number(p.preco_venda);
                const custo = Number(p.preco_custo);
                const margem = venda > 0 ? Math.round(((venda - custo) / venda) * 100) : 0;
                const qtd = Number(p.quantidade);
                const min = Number(p.estoque_minimo);
                const status = qtd === 0 ? 'Esgotado' : qtd <= min ? 'Baixo' : 'OK';
                const statusCls =
                  status === 'OK'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : status === 'Baixo'
                    ? 'bg-amber-500/15 text-amber-500'
                    : 'bg-red-500/15 text-red-400';
                return (
                  <tr key={p.id} className={`border-b border-gray-700/50 last:border-0 ${!p.ativo ? 'opacity-50' : ''}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-lg bg-gray-700 overflow-hidden flex items-center justify-center shrink-0">
                          {p.imagem ? <img src={p.imagem} alt="" className="w-full h-full object-cover" /> : <Package size={16} className="text-gray-500" />}
                        </span>
                        <span className="font-semibold">{p.nome}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-400">{p.categoria || '—'}</td>
                    <td className="py-3 px-4 font-semibold">{brl(venda)}</td>
                    <td className="py-3 px-4 text-gray-400">{brl(custo)}</td>
                    <td className="py-3 px-4 text-orange-500 font-semibold">{margem}%</td>
                    <td className="py-3 px-4 font-semibold">{qtd} {p.unidade?.toLowerCase() || 'un'}.</td>
                    <td className="py-3 px-4 text-gray-400">{min}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold rounded-full px-2.5 py-1 ${statusCls}`}>
                        {status !== 'OK' && <AlertTriangle size={12} />} {status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => onEntrada(p)} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25">
                          <ArrowDownToLine size={13} /> Entrada
                        </button>
                        <button onClick={() => onSaida(p)} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-semibold bg-red-500/15 text-red-400 hover:bg-red-500/25">
                          <ArrowUpFromLine size={13} /> Saída
                        </button>
                        <button onClick={() => onEditar(p)} title="Editar" className="text-gray-400 hover:text-orange-500 p-1.5">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => onToggle(p)} title={p.ativo ? 'Inativar' : 'Reativar'} className="text-gray-400 hover:text-gray-200 p-1.5">
                          {p.ativo ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                        <button onClick={() => onExcluir(p)} title="Excluir" className="text-red-500 hover:text-red-600 p-2 sm:p-1.5">
                          <Trash2 size={15} />
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

      {/* Cards — mobile */}
      <div className="sm:hidden space-y-2">
        {produtos.length === 0 ? (
          <p className="text-center text-gray-500 py-10">Nenhum produto cadastrado.</p>
        ) : (
          itens.map((p) => {
            const venda = Number(p.preco_venda);
            const custo = Number(p.preco_custo);
            const margem = venda > 0 ? Math.round(((venda - custo) / venda) * 100) : 0;
            const qtd = Number(p.quantidade);
            const min = Number(p.estoque_minimo);
            const status = qtd === 0 ? 'Esgotado' : qtd <= min ? 'Baixo' : 'OK';
            const statusCls =
              status === 'OK'
                ? 'bg-emerald-500/15 text-emerald-400'
                : status === 'Baixo'
                ? 'bg-amber-500/15 text-amber-500'
                : 'bg-red-500/15 text-red-400';
            return (
              <div key={p.id} className={`bg-gray-700/50 rounded-xl p-3 space-y-2 ${!p.ativo ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-lg bg-gray-700 overflow-hidden flex items-center justify-center shrink-0">
                    {p.imagem ? <img src={p.imagem} alt="" className="w-full h-full object-cover" /> : <Package size={18} className="text-gray-500" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{p.nome}</p>
                    {p.categoria && <p className="text-xs text-gray-400">{p.categoria}</p>}
                  </div>
                  <span className={`inline-flex items-center gap-1 text-xs font-bold rounded-full px-2.5 py-1 shrink-0 ${statusCls}`}>
                    {status !== 'OK' && <AlertTriangle size={11} />} {status}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Venda</p>
                    <p className="font-semibold">{brl(venda)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Margem</p>
                    <p className="font-semibold text-orange-500">{margem}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Estoque</p>
                    <p className="font-semibold">{qtd} {p.unidade?.toLowerCase() || 'un'}.</p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end mt-2">
                  <button onClick={() => onEntrada(p)} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25">
                    <ArrowDownToLine size={13} /> Entrada
                  </button>
                  <button onClick={() => onSaida(p)} className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-semibold bg-red-500/15 text-red-400 hover:bg-red-500/25">
                    <ArrowUpFromLine size={13} /> Saída
                  </button>
                  <button onClick={() => onEditar(p)} title="Editar" className="text-gray-400 hover:text-orange-500 p-1.5">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => onToggle(p)} title={p.ativo ? 'Inativar' : 'Reativar'} className="text-gray-400 hover:text-gray-200 p-1.5">
                    {p.ativo ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  <button onClick={() => onExcluir(p)} title="Excluir" className="text-red-500 hover:text-red-600 p-2 sm:p-1.5">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Paginacao pagina={pagina} totalPaginas={totalPaginas} total={total} onPagina={setPagina} />
    </div>
  );
}

// ---------------- Aba Movimentações ----------------
function TabMovimentacoes({ produtos }) {
  const [filtros, setFiltros] = useState({ produto_id: '', tipo: '', de: '', ate: '' });
  const [lista, setLista] = useState([]);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const params = {};
    Object.entries(filtros).forEach(([k, v]) => v && (params[k] = v));
    api
      .get('/estoque/movimentacoes', { params })
      .then(({ data }) => setLista(data))
      .catch((err) => setErro(err.response?.data?.error || 'Erro ao carregar'));
  }, [filtros]);

  function set(campo, valor) {
    setFiltros((f) => ({ ...f, [campo]: valor }));
  }

  const { pagina, setPagina, totalPaginas, total, itens } = usePaginacao(lista, 12);

  return (
    <div>
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-400 mb-3">
          <Filter size={16} /> Filtros
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Produto</label>
            <select value={filtros.produto_id} onChange={(e) => set('produto_id', e.target.value)} className={inputCls}>
              <option value="">Todos</option>
              {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Tipo</label>
            <select value={filtros.tipo} onChange={(e) => set('tipo', e.target.value)} className={inputCls}>
              <option value="">Todos</option>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Período</label>
            <RangePicker
              de={filtros.de}
              ate={filtros.ate}
              onChange={({ de, ate }) => setFiltros((f) => ({ ...f, de, ate }))}
            />
          </div>
        </div>
      </div>

      {erro && <p className="text-red-400 text-sm mb-3">{erro}</p>}

      {/* Tabela — desktop */}
      <div className="hidden sm:block bg-gray-800 border border-gray-700 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold tracking-wide text-gray-500 border-b border-gray-700">
              <th className="py-3 px-4">DATA</th>
              <th className="py-3 px-4">PRODUTO</th>
              <th className="py-3 px-4">TIPO</th>
              <th className="py-3 px-4">QTD.</th>
              <th className="py-3 px-4">MOTIVO</th>
              <th className="py-3 px-4">OPERADOR</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-gray-500 py-10">Nenhuma movimentação.</td></tr>
            ) : (
              itens.map((m) => (
                <tr key={m.id} className="border-b border-gray-700/50 last:border-0">
                  <td className="py-3 px-4 text-gray-400">{new Date(m.created_at).toLocaleString('pt-BR')}</td>
                  <td className="py-3 px-4 font-semibold">{m.produto_nome}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex text-xs font-bold rounded-full px-2.5 py-1 ${
                      m.tipo === 'entrada' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                    }`}>
                      {m.tipo}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-semibold">{m.quantidade}</td>
                  <td className="py-3 px-4 text-gray-400">{m.motivo || '—'}</td>
                  <td className="py-3 px-4 text-gray-400">{m.operador || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Cards — mobile */}
      <div className="sm:hidden space-y-2">
        {lista.length === 0 ? (
          <p className="text-center text-gray-500 py-10">Nenhuma movimentação.</p>
        ) : (
          itens.map((m) => (
            <div key={m.id} className="bg-gray-700/50 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold truncate">{m.produto_nome}</span>
                <span className={`inline-flex text-xs font-bold rounded-full px-2.5 py-1 shrink-0 ${
                  m.tipo === 'entrada' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                }`}>
                  {m.tipo}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-400">
                <span>{new Date(m.created_at).toLocaleString('pt-BR')}</span>
                <span className="font-semibold text-gray-200">{m.quantidade} un.</span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-400">
                <span>{m.motivo || '—'}</span>
                <span>Op: {m.operador || '—'}</span>
              </div>
            </div>
          ))
        )}
      </div>

      <Paginacao pagina={pagina} totalPaginas={totalPaginas} total={total} onPagina={setPagina} />
    </div>
  );
}

// ---------------- Modal Novo/Editar produto ----------------
function ProdutoModal({ produto, categorias = [], onClose, onSalvo }) {
  const editando = !!produto;
  const [nome, setNome] = useState(produto?.nome || '');
  const [categoria, setCategoria] = useState(produto?.categoria || '');
  const [unidade, setUnidade] = useState(produto?.unidade || 'Unidade');
  const [precoVenda, setPrecoVenda] = useState(produto ? String(Number(produto.preco_venda) || '') : '');
  const [precoCusto, setPrecoCusto] = useState(produto ? String(Number(produto.preco_custo) || '') : '');
  const [qtd, setQtd] = useState('0');
  const [minimo, setMinimo] = useState(produto ? String(Number(produto.estoque_minimo) || '') : '5');
  const [imagem, setImagem] = useState(produto?.imagem || '');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function escolherFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setErro('Imagem maior que 5MB');
    try {
      setImagem(await lerImagemRedimensionada(file));
    } catch {
      setErro('Não foi possível ler a imagem');
    }
  }

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    if (!nome.trim()) return setErro('Informe o nome');
    setSalvando(true);
    const payload = {
      nome,
      categoria,
      unidade,
      imagem: imagem || null,
      preco_venda: Number(precoVenda) || 0,
      preco_custo: Number(precoCusto) || 0,
      estoque_minimo: parseInt(minimo, 10) || 0,
    };
    try {
      if (editando) {
        await api.put(`/estoque/${produto.id}`, payload);
      } else {
        await api.post('/estoque', { ...payload, quantidade: parseInt(qtd, 10) || 0 });
      }
      onSalvo();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao salvar');
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={editando ? 'Editar produto' : 'Novo produto'} onClose={onClose}>
      <form onSubmit={salvar} className="space-y-4">
        {/* Foto */}
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-xl bg-gray-700 overflow-hidden flex items-center justify-center shrink-0">
            {imagem ? <img src={imagem} alt="" className="w-full h-full object-cover" /> : <Package size={24} className="text-gray-500" />}
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Foto do produto</p>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={escolherFoto} className="text-xs text-gray-400 file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-gray-700 file:text-gray-200" />
            <p className="text-xs text-gray-500 mt-1">JPG, PNG ou WebP · máx. 5MB</p>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">Nome *</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Categoria</label>
            <input list="lista-categorias" value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Selecionar ou digitar" className={inputCls} />
            <datalist id="lista-categorias">
              {categorias.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Unidade</label>
            <select value={unidade} onChange={(e) => setUnidade(e.target.value)} className={inputCls}>
              {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Preço venda (R$) *</label>
            <input type="number" step="0.01" inputMode="decimal" value={precoVenda} onChange={(e) => setPrecoVenda(e.target.value)} placeholder="0,00" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Preço custo (R$)</label>
            <input type="number" step="0.01" inputMode="decimal" value={precoCusto} onChange={(e) => setPrecoCusto(e.target.value)} placeholder="0,00" className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {!editando && (
            <div>
              <label className="block text-sm text-gray-300 mb-1">Estoque inicial</label>
              <input type="number" step="1" inputMode="numeric" value={qtd} onChange={(e) => setQtd(e.target.value)} className={inputCls} />
            </div>
          )}
          <div className={editando ? 'col-span-2' : ''}>
            <label className="block text-sm text-gray-300 mb-1">Estoque mínimo</label>
            <input type="number" step="1" inputMode="numeric" value={minimo} onChange={(e) => setMinimo(e.target.value)} className={inputCls} />
          </div>
        </div>

        {editando && <p className="text-xs text-gray-500">A quantidade muda só por Entrada / Saída / Venda.</p>}
        {erro && <p className="text-red-400 text-sm">{erro}</p>}
        <button type="submit" disabled={salvando} className="w-full h-12 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg font-semibold">
          <Check size={18} /> {editando ? 'Salvar' : 'Criar produto'}
        </button>
      </form>
    </Modal>
  );
}

// ---------------- Modal Entrada / Saída ----------------
function MovimentarModal({ tipo, produto, onClose, onSalvo }) {
  const ehEntrada = tipo === 'entrada';
  const [quantidade, setQuantidade] = useState('');
  const [motivo, setMotivo] = useState('');
  const [descontarCaixa, setDescontarCaixa] = useState(false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    const qtd = parseInt(quantidade, 10) || 0;
    if (qtd <= 0) return setErro('Informe a quantidade');
    if (!ehEntrada && qtd > Number(produto.quantidade)) {
      return setErro(`Estoque insuficiente (disponível: ${produto.quantidade})`);
    }
    setSalvando(true);
    try {
      await api.post(`/estoque/${produto.id}/movimentar`, {
        tipo,
        quantidade: qtd,
        motivo: motivo || (ehEntrada ? 'compra' : 'ajuste'),
        descontar_caixa: ehEntrada ? descontarCaixa : false,
      });
      onSalvo();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao registrar');
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={ehEntrada ? 'Entrada de estoque' : 'Saída de estoque'} onClose={onClose}>
      <form onSubmit={salvar} className="space-y-4">
        <div className="bg-gray-700/50 rounded-lg px-4 py-3">
          <p className="font-semibold">{produto.nome}</p>
          <p className="text-sm text-gray-400">
            Estoque atual: <span className="font-semibold text-gray-200">{produto.quantidade} {produto.unidade?.toLowerCase() || 'un'}.</span>
          </p>
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">Quantidade *</label>
          <input type="number" step="1" min="1" inputMode="numeric" autoFocus value={quantidade} onChange={(e) => setQuantidade(e.target.value)} className={inputCls} />
        </div>

        <div>
          <label className="block text-sm text-gray-300 mb-1">Motivo</label>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={ehEntrada ? 'Compra, doação...' : 'Venda, perda...'} className={inputCls} />
        </div>

        {ehEntrada && (
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input type="checkbox" checked={descontarCaixa} onChange={(e) => setDescontarCaixa(e.target.checked)} className="w-4 h-4 accent-blue-600" />
            Registrar como despesa no caixa
          </label>
        )}

        {erro && <p className="text-red-400 text-sm">{erro}</p>}
        <button type="submit" disabled={salvando} className="w-full h-12 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg font-semibold">
          <Check size={18} /> {ehEntrada ? 'Registrar entrada' : 'Registrar saída'}
        </button>
      </form>
    </Modal>
  );
}

function Modal({ titulo, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">{titulo}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
