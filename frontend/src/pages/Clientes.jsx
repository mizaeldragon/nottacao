import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, X, Check, Phone, ReceiptText, Wallet } from 'lucide-react';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import api from '../services/api';
import { brl, dataBR, maskTel } from '../utils/format';
import { usePaginacao } from '../hooks/usePaginacao';
import Paginacao from '../components/Paginacao';

const inputCls =
  'w-full h-11 bg-gray-700 border border-gray-600 rounded-lg px-3 outline-none focus:border-orange-500';

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [erro, setErro] = useState('');
  const [modal, setModal] = useState(null); // { cliente? }
  const [contasDe, setContasDe] = useState(null); // cliente p/ ver fiado
  const [confirmar, setConfirmar] = useState(null); // { mensagem, onOk }

  async function carregar() {
    try {
      const { data } = await api.get('/clientes');
      setClientes(data);
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao carregar clientes');
    }
  }
  useEffect(() => {
    carregar();
  }, []);

  async function remover(c) {
    setConfirmar({
      mensagem: `Remover ${c.nome}?`,
      onOk: async () => {
        setConfirmar(null);
        try {
          await api.delete(`/clientes/${c.id}`);
          carregar();
        } catch (err) {
          setErro(err.response?.data?.error || 'Erro ao remover');
        }
      },
    });
    return;
  }

  const totalDevedor = clientes.reduce((s, c) => s + Number(c.saldo_devedor || 0), 0);
  const { pagina, setPagina, totalPaginas, total, itens } = usePaginacao(clientes, 10);

  return (
    <Layout
      title="Clientes"
      subtitle="Cadastro de clientes e controle de fiado."
      action={
        <button onClick={() => setModal({})} className="h-11 px-4 flex items-center gap-2 bg-orange-500 hover:bg-orange-600 rounded-lg font-semibold">
          <Plus size={18} /> Novo cliente
        </button>
      }
    >
      {erro && <p className="text-red-400 text-sm mb-3">{erro}</p>}

      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-xs font-semibold tracking-wide text-gray-400">CLIENTES</p>
          <p className="text-2xl font-bold mt-1">{clientes.length}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-xs font-semibold tracking-wide text-gray-400">TOTAL A RECEBER (FIADO)</p>
          <p className={`text-2xl font-bold mt-1 ${totalDevedor > 0 ? 'text-orange-500' : ''}`}>{brl(totalDevedor)}</p>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
        {clientes.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">Nenhum cliente cadastrado.</p>
        ) : (
          <>
            {/* Tabela — desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold tracking-wide text-gray-500 border-b border-gray-700">
                    <th className="py-2 pr-4">NOME</th>
                    <th className="py-2 pr-4">TELEFONE</th>
                    <th className="py-2 pr-4 text-right">DEVENDO</th>
                    <th className="py-2 w-28 text-right">AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((c) => (
                    <tr key={c.id} className="border-b border-gray-700/50 last:border-0">
                      <td className="py-2 pr-4 font-medium">{c.nome}</td>
                      <td className="py-2 pr-4 text-gray-400">
                        {c.telefone ? (
                          <span className="inline-flex items-center gap-1"><Phone size={13} /> {c.telefone}</span>
                        ) : '—'}
                      </td>
                      <td className={`py-2 pr-4 text-right font-semibold ${Number(c.saldo_devedor) > 0 ? 'text-orange-500' : 'text-gray-500'}`}>
                        {brl(c.saldo_devedor)}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setContasDe(c)} title="Fiado / contas" className="text-gray-400 hover:text-sky-400 p-1.5">
                            <ReceiptText size={16} />
                          </button>
                          <button onClick={() => setModal({ cliente: c })} className="text-gray-400 hover:text-orange-500 p-1.5">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => remover(c)} className="text-red-500 hover:text-red-600 p-2 sm:p-1.5">
                            <Trash2 size={15} />
                          </button>
                        </div>
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
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold truncate">{c.nome}</span>
                    <span className={`font-semibold text-sm shrink-0 ${Number(c.saldo_devedor) > 0 ? 'text-orange-500' : 'text-gray-500'}`}>
                      {brl(c.saldo_devedor)}
                    </span>
                  </div>
                  {c.telefone && (
                    <div className="flex items-center gap-1 text-sm text-gray-400">
                      <Phone size={13} /> {c.telefone}
                    </div>
                  )}
                  <div className="flex gap-2 justify-end mt-2">
                    <button onClick={() => setContasDe(c)} title="Fiado / contas" className="text-gray-400 hover:text-sky-400 p-1.5">
                      <ReceiptText size={16} />
                    </button>
                    <button onClick={() => setModal({ cliente: c })} className="text-gray-400 hover:text-orange-500 p-1.5">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => remover(c)} className="text-red-500 hover:text-red-600 p-2 sm:p-1.5">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <Paginacao pagina={pagina} totalPaginas={totalPaginas} total={total} onPagina={setPagina} />
          </>
        )}
      </div>

      {modal && (
        <ClienteModal
          cliente={modal.cliente}
          onClose={() => setModal(null)}
          onSalvo={() => {
            setModal(null);
            carregar();
          }}
        />
      )}
      {contasDe && (
        <ContasModal
          cliente={contasDe}
          onClose={() => setContasDe(null)}
          onMudou={carregar}
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

function ClienteModal({ cliente, onClose, onSalvo }) {
  const editando = !!cliente;
  const [nome, setNome] = useState(cliente?.nome || '');
  const [telefone, setTelefone] = useState(cliente?.telefone || '');
  const [observacao, setObservacao] = useState(cliente?.observacao || '');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    if (!nome.trim()) return setErro('Informe o nome');
    setSalvando(true);
    try {
      if (editando) await api.put(`/clientes/${cliente.id}`, { nome, telefone, observacao });
      else await api.post('/clientes', { nome, telefone, observacao });
      onSalvo();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao salvar');
      setSalvando(false);
    }
  }

  return (
    <Modal titulo={editando ? 'Editar cliente' : 'Novo cliente'} onClose={onClose}>
      <form onSubmit={salvar} className="space-y-3">
        <div>
          <label className="block text-sm text-gray-300 mb-1">Nome *</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} autoFocus />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Telefone</label>
          <input value={telefone} onChange={(e) => setTelefone(maskTel(e.target.value))} placeholder="(00) 00000-0000" inputMode="numeric" className={inputCls} />
        </div>
        <div>
          <label className="block text-sm text-gray-300 mb-1">Observação</label>
          <input value={observacao} onChange={(e) => setObservacao(e.target.value)} className={inputCls} />
        </div>
        {erro && <p className="text-red-400 text-sm">{erro}</p>}
        <button type="submit" disabled={salvando} className="w-full h-12 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg font-semibold">
          <Check size={18} /> {editando ? 'Salvar' : 'Criar cliente'}
        </button>
      </form>
    </Modal>
  );
}

const FORMAS_PAG = [
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'pix', label: 'Pix' },
  { id: 'cartao_credito', label: 'Crédito' },
  { id: 'cartao_debito', label: 'Débito' },
];

function ContasModal({ cliente, onClose, onMudou }) {
  const [contas, setContas] = useState([]);
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Abono global
  const [valorAbono, setValorAbono] = useState('');
  const [formaAbono, setFormaAbono] = useState('dinheiro');

  // Pagamento individual por item
  const [pagandoId, setPagandoId] = useState(null);
  const [valorItem, setValorItem] = useState('');
  const [formaItem, setFormaItem] = useState('dinheiro');

  async function carregar() {
    try {
      const { data } = await api.get(`/clientes/${cliente.id}/contas`);
      setContas(data);
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao carregar');
    }
  }
  useEffect(() => { carregar(); }, []); // eslint-disable-line

  async function receberAbono(e) {
    e.preventDefault();
    setErro(''); setMsg('');
    const v = Number(valorAbono);
    if (!v || v <= 0) return setErro('Informe um valor válido');
    setSalvando(true);
    try {
      const { data } = await api.post(`/clientes/${cliente.id}/pagar-abono`, { valor: v, forma_pagamento: formaAbono });
      setValorAbono('');
      if (data.troco > 0) setMsg(`Pago ${brl(data.pago)}. Troco: ${brl(data.troco)}`);
      else setMsg(`${brl(data.pago)} recebido com sucesso.`);
      await carregar();
      onMudou();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao registrar');
    } finally {
      setSalvando(false);
      setTimeout(() => setMsg(''), 4000);
    }
  }

  async function receberItem(conta) {
    setErro(''); setMsg('');
    const v = Number(valorItem);
    if (!v || v <= 0) return setErro('Informe um valor válido');
    setSalvando(true);
    try {
      await api.post(`/clientes/contas/${conta.id}/pagar`, { valor: v, forma_pagamento: formaItem });
      setPagandoId(null);
      setValorItem('');
      await carregar();
      onMudou();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao receber');
    } finally {
      setSalvando(false);
    }
  }

  const abertas = contas.filter((c) => c.status === 'aberto');
  const totalAberto = abertas.reduce((s, c) => s + (Number(c.valor) - Number(c.valor_pago)), 0);

  return (
    <Modal titulo={`Fiado — ${cliente.nome}`} onClose={onClose}>
      {/* Resumo do saldo */}
      {totalAberto > 0 ? (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide">Total em aberto</p>
            <p className="text-2xl font-bold text-orange-400">{brl(totalAberto)}</p>
          </div>
          <Wallet size={28} className="text-orange-500/50" />
        </div>
      ) : contas.length > 0 ? (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
          <Check size={20} className="text-emerald-400 shrink-0" />
          <p className="text-sm font-semibold text-emerald-400">Tudo quitado — sem dívidas em aberto</p>
        </div>
      ) : null}

      {erro && <p className="text-red-400 text-sm mb-3 bg-red-500/10 rounded-lg px-3 py-2">{erro}</p>}
      {msg && <p className="text-emerald-400 text-sm mb-3 bg-emerald-500/10 rounded-lg px-3 py-2">{msg}</p>}

      {/* Formulário de abono — só mostra se tiver abertas */}
      {abertas.length > 0 && (
        <form onSubmit={receberAbono} className="bg-gray-900 rounded-xl p-4 mb-4 space-y-3">
          <p className="text-sm font-semibold text-gray-300">Receber abono / pagamento parcial</p>
          <p className="text-xs text-gray-500">O valor é distribuído pelas contas mais antigas primeiro.</p>
          <div className="flex gap-2">
            {FORMAS_PAG.map((f) => (
              <button key={f.id} type="button" onClick={() => setFormaAbono(f.id)}
                className={`flex-1 h-9 rounded-lg text-xs font-semibold transition-colors ${formaAbono === f.id ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="number" step="0.01" inputMode="decimal"
              value={valorAbono} onChange={(e) => setValorAbono(e.target.value)}
              placeholder={`Valor (máx. ${totalAberto.toFixed(2)})`}
              className="flex-1 h-10 bg-gray-700 border border-gray-600 rounded-lg px-3 text-sm outline-none focus:border-orange-500"
            />
            <button type="button" onClick={() => setValorAbono(totalAberto.toFixed(2))}
              className="h-10 px-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-semibold text-gray-300 whitespace-nowrap">
              Quitar tudo
            </button>
          </div>
          <button type="submit" disabled={salvando || !valorAbono}
            className="w-full h-10 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
            <Wallet size={15} /> Registrar recebimento
          </button>
        </form>
      )}

      {/* Lista de contas */}
      {contas.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-6">Sem contas de fiado.</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Histórico de contas</p>
          {contas.map((c) => {
            const restante = Math.max(0, Number(c.valor) - Number(c.valor_pago));
            const pct = Math.min(100, (Number(c.valor_pago) / Number(c.valor)) * 100);
            const quitado = c.status === 'pago';
            return (
              <div key={c.id} className={`rounded-xl p-3 border ${quitado ? 'bg-gray-900/50 border-gray-700/40' : 'bg-gray-900 border-gray-700'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${quitado ? 'text-gray-500' : ''}`}>{c.descricao || 'Fiado'}</p>
                    <p className="text-xs text-gray-600">{dataBR(c.created_at)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-bold text-sm ${quitado ? 'text-gray-500' : ''}`}>{brl(c.valor)}</p>
                    {quitado ? (
                      <span className="text-xs font-semibold text-emerald-500">Pago</span>
                    ) : (
                      <span className="text-xs text-orange-400 font-semibold">Resta {brl(restante)}</span>
                    )}
                  </div>
                </div>

                {/* Barra de progresso */}
                {Number(c.valor_pago) > 0 && (
                  <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${quitado ? 'bg-emerald-500' : 'bg-orange-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                )}

                {/* Pagar item individualmente */}
                {!quitado && (
                  pagandoId === c.id ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex gap-1.5">
                        {FORMAS_PAG.map((f) => (
                          <button key={f.id} type="button" onClick={() => setFormaItem(f.id)}
                            className={`flex-1 h-7 rounded-lg text-xs font-semibold ${formaItem === f.id ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
                            {f.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number" step="0.01" inputMode="decimal" autoFocus
                          value={valorItem} onChange={(e) => setValorItem(e.target.value)}
                          placeholder={restante.toFixed(2)}
                          className="h-9 flex-1 bg-gray-700 border border-gray-600 rounded-lg px-2 text-sm outline-none focus:border-orange-500"
                        />
                        <button onClick={() => receberItem(c)} disabled={salvando}
                          className="h-9 px-3 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-sm font-semibold">
                          OK
                        </button>
                        <button onClick={() => { setPagandoId(null); setValorItem(''); }} className="text-gray-500 hover:text-gray-300 p-1">
                          <X size={15} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setPagandoId(c.id); setValorItem(restante.toFixed(2)); setFormaItem('dinheiro'); }}
                      className="mt-2 w-full h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors">
                      Pagar este item individualmente
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
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
