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

function ContasModal({ cliente, onClose, onMudou }) {
  const [contas, setContas] = useState([]);
  const [erro, setErro] = useState('');
  const [pagando, setPagando] = useState(null); // conta sendo paga
  const [valor, setValor] = useState('');

  async function carregar() {
    try {
      const { data } = await api.get(`/clientes/${cliente.id}/contas`);
      setContas(data);
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao carregar');
    }
  }
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function receber(conta) {
    setErro('');
    const v = Number(valor);
    if (!v || v <= 0) return setErro('Informe um valor válido');
    try {
      await api.post(`/clientes/contas/${conta.id}/pagar`, { valor: v });
      setPagando(null);
      setValor('');
      await carregar();
      onMudou();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao receber');
    }
  }

  const abertas = contas.filter((c) => c.status === 'aberto');

  return (
    <Modal titulo={`Fiado — ${cliente.nome}`} onClose={onClose}>
      {erro && <p className="text-red-400 text-sm mb-2">{erro}</p>}
      {contas.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-6">Sem contas de fiado.</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {contas.map((c) => {
            const restante = Number(c.valor) - Number(c.valor_pago);
            return (
              <div key={c.id} className="bg-gray-900 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.descricao || 'Fiado'}</p>
                    <p className="text-xs text-gray-500">{dataBR(c.created_at)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold">{brl(c.valor)}</p>
                    {c.status === 'pago' ? (
                      <span className="text-xs font-semibold text-emerald-400">Pago</span>
                    ) : (
                      <span className="text-xs text-orange-500">Resta {brl(restante)}</span>
                    )}
                  </div>
                </div>
                {c.status === 'aberto' && (
                  pagando === c.id ? (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        autoFocus
                        value={valor}
                        onChange={(e) => setValor(e.target.value)}
                        placeholder={restante.toFixed(2)}
                        className="h-9 flex-1 bg-gray-700 border border-gray-600 rounded-lg px-2 text-sm outline-none focus:border-orange-500"
                      />
                      <button onClick={() => receber(c)} className="h-9 px-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-sm font-semibold">
                        Receber
                      </button>
                      <button onClick={() => { setPagando(null); setValor(''); }} className="text-gray-500 hover:text-gray-300">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setPagando(c.id); setValor(String(restante.toFixed(2))); }}
                      className="mt-2 w-full h-9 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-medium inline-flex items-center justify-center gap-1"
                    >
                      <Wallet size={14} /> Receber pagamento
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
      {abertas.length === 0 && contas.length > 0 && (
        <p className="text-emerald-400 text-sm text-center mt-3">Tudo quitado ✓</p>
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
