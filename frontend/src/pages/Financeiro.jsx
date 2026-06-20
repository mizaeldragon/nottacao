import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, X, Check, TrendingUp, TrendingDown, Receipt, Users, Wallet } from 'lucide-react';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import api from '../services/api';
import { brl } from '../utils/format';
import { usePaginacao } from '../hooks/usePaginacao';
import Paginacao from '../components/Paginacao';
import RangePicker from '../components/RangePicker';

const inputCls =
  'w-full h-11 bg-gray-700 border border-gray-600 rounded-lg px-3 outline-none focus:border-orange-500';

function intervaloMes() {
  const h = new Date();
  return {
    inicio: new Date(h.getFullYear(), h.getMonth(), 1).toISOString().slice(0, 10),
    fim: new Date(h.getFullYear(), h.getMonth() + 1, 0).toISOString().slice(0, 10),
  };
}

export default function Financeiro() {
  const [despesas, setDespesas] = useState([]);
  const [dre, setDre] = useState(null);
  const [comissoes, setComissoes] = useState([]);
  const [periodo, setPeriodo] = useState(intervaloMes());
  const [modal, setModal] = useState(null); // { despesa? } | null
  const [pagarModal, setPagarModal] = useState(null); // funcionário comissão
  const [erro, setErro] = useState('');
  const [confirmar, setConfirmar] = useState(null); // { mensagem, onOk }

  async function carregar() {
    try {
      const [d, r, c] = await Promise.all([
        api.get('/financeiro/despesas'),
        api.get('/financeiro/dre', { params: periodo }),
        api.get('/financeiro/comissoes'),
      ]);
      setDespesas(d.data);
      setDre(r.data);
      setComissoes(c.data);
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao carregar');
    }
  }
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  async function remover(id) {
    setConfirmar({
      mensagem: 'Remover esta despesa?',
      onOk: async () => {
        setConfirmar(null);
        try {
          await api.delete(`/financeiro/despesas/${id}`);
          carregar();
        } catch (err) {
          setErro(err.response?.data?.error || 'Erro ao remover');
        }
      },
    });
    return;
  }

  const totalDespesas = despesas.reduce((s, d) => s + Number(d.valor), 0);
  const despPag = usePaginacao(despesas, 8);
  const comPag = usePaginacao(comissoes, 8);

  return (
    <Layout title="Financeiro" subtitle="Despesas fixas e lucro real (DRE) do período.">
      {erro && <p className="text-red-400 text-sm mb-3">{erro}</p>}

      {/* DRE + filtro integrados */}
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5 mb-5">
        {/* Header: título + filtro de período */}
        <div className="mb-5">
          <h2 className="font-bold text-lg mb-3">Resultado do Período (DRE)</h2>
          <div className="flex flex-wrap items-center gap-2">
            <RangePicker
              de={periodo.inicio}
              ate={periodo.fim}
              onChange={({ de, ate }) => setPeriodo({ inicio: de, fim: ate })}
            />
            <button
              onClick={() => {
                const m = intervaloMes();
                setPeriodo(m);
                // força recarregar mesmo se o período já era o mês atual
                setTimeout(() => carregar(), 0);
              }}
              className="h-10 px-4 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors"
              style={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#94a3b8' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f1f5f9'}
              onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
            >
              Mês atual
            </button>
          </div>
        </div>

        {dre && (
          <div className="text-sm">
            <div className="grid grid-cols-[1fr_auto] gap-x-8 gap-y-2.5 items-center">
              <span className="text-gray-300">Faturamento (serviços + produtos)</span>
              <span className="text-right font-semibold text-emerald-400">{brl(dre.faturamento)}</span>

              <span className="pl-4 text-gray-500 text-xs">• Serviços</span>
              <span className="text-right text-xs text-gray-500">{brl(dre.total_servicos)}</span>

              <span className="pl-4 text-gray-500 text-xs">• Produtos</span>
              <span className="text-right text-xs text-gray-500">{brl(dre.faturamento_produtos)}</span>

              <span className="text-gray-300">(−) Comissões dos funcionários</span>
              <span className="text-right font-semibold text-red-400">{brl(-dre.comissoes)}</span>

              <span className="text-gray-300">(−) Custo dos produtos vendidos (CMV)</span>
              <span className="text-right font-semibold text-red-400">{brl(-dre.cmv)}</span>

              <span className="text-gray-300">(−) Despesas fixas</span>
              <span className="text-right font-semibold text-red-400">{brl(-dre.despesas_fixas)}</span>
            </div>

            <div className={`mt-4 pt-4 border-t border-gray-700 flex items-center justify-between rounded-xl px-4 py-3 ${dre.lucro >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
              <span className="font-bold flex items-center gap-2">
                {dre.lucro >= 0
                  ? <TrendingUp size={17} className="text-emerald-400" />
                  : <TrendingDown size={17} className="text-red-400" />}
                Lucro do dono
              </span>
              <span className={`text-2xl font-bold ${dre.lucro >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {brl(dre.lucro)}
              </span>
            </div>

            <p className="text-xs text-gray-500 mt-3">
              CMV usa o preço de custo atual dos produtos.
            </p>
          </div>
        )}
      </div>

      {/* Despesas fixas */}
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <Receipt size={18} className="text-gray-400 shrink-0" />
            <h2 className="font-bold truncate">Despesas Fixas</h2>
          </div>
          <button onClick={() => setModal({})} className="shrink-0 h-10 px-3 sm:px-4 flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 rounded-lg font-semibold text-sm whitespace-nowrap">
            <Plus size={16} />
            <span className="hidden xs:inline sm:inline">Nova despesa</span>
            <span className="xs:hidden sm:hidden">Nova</span>
          </button>
        </div>

        {despesas.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">Nenhuma despesa fixa cadastrada.</p>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="sm:hidden space-y-2">
              {despPag.itens.map((d) => (
                <div key={d.id} className="bg-gray-700/50 rounded-xl p-3 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{d.descricao}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 flex-wrap">
                      {d.categoria && <span>{d.categoria}</span>}
                      {d.dia_vencimento && <span>· Vence dia {d.dia_vencimento}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="font-bold text-sm mr-1">{brl(d.valor)}</span>
                    <button onClick={() => setModal({ despesa: d })} className="text-gray-400 hover:text-orange-500 p-2">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => remover(d.id)} className="text-red-500 hover:text-red-600 p-2">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between px-1 pt-2 border-t border-gray-700">
                <span className="font-bold text-sm">Total mensal</span>
                <span className="font-bold text-orange-500">{brl(totalDespesas)}</span>
              </div>
            </div>

            {/* Desktop: tabela */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold tracking-wide text-gray-500 border-b border-gray-700">
                    <th className="py-2 pr-4">DESCRIÇÃO</th>
                    <th className="py-2 pr-4">CATEGORIA</th>
                    <th className="py-2 pr-4">VENCIMENTO</th>
                    <th className="py-2 pr-4 text-right">VALOR</th>
                    <th className="py-2 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {despPag.itens.map((d) => (
                    <tr key={d.id} className="border-b border-gray-700/50 last:border-0">
                      <td className="py-3 pr-4 font-medium">{d.descricao}</td>
                      <td className="py-3 pr-4 text-gray-400">{d.categoria || '—'}</td>
                      <td className="py-3 pr-4 text-gray-400">{d.dia_vencimento ? `Dia ${d.dia_vencimento}` : '—'}</td>
                      <td className="py-3 pr-4 text-right font-semibold">{brl(d.valor)}</td>
                      <td className="py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setModal({ despesa: d })} className="text-gray-400 hover:text-orange-500 p-1.5">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => remover(d.id)} className="text-red-500 hover:text-red-600 p-1.5">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-gray-700">
                    <td className="py-3 pr-4 font-bold" colSpan={3}>Total mensal</td>
                    <td className="py-3 pr-4 text-right font-bold text-orange-500">{brl(totalDespesas)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <Paginacao pagina={despPag.pagina} totalPaginas={despPag.totalPaginas} total={despPag.total} onPagina={despPag.setPagina} />
          </>
        )}
      </div>

      {/* Comissões a pagar */}
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5 mt-6">
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-gray-400" />
          <h2 className="font-bold">Comissões — Acerto com Funcionários</h2>
        </div>
        {comissoes.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">Nenhum funcionário ativo.</p>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="sm:hidden space-y-2">
              {comPag.itens.map((c) => (
                <div key={c.funcionario_id} className="bg-gray-700/50 rounded-xl p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="font-semibold text-sm">{c.nome}</p>
                    <span className={`font-bold text-sm ${c.saldo > 0 ? 'text-orange-500' : 'text-emerald-400'}`}>
                      {c.saldo > 0 ? `A pagar: ${brl(c.saldo)}` : 'Quitado'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                    <span>{c.qtd_servicos} serviço(s) · Total: {brl(c.total_ganho)}</span>
                    <span>Pago: {brl(c.total_pago)}</span>
                  </div>
                  <button
                    onClick={() => setPagarModal(c)}
                    disabled={c.saldo <= 0}
                    className="w-full h-9 flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-40"
                  >
                    <Wallet size={13} /> Registrar pagamento
                  </button>
                </div>
              ))}
            </div>

            {/* Desktop: tabela */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold tracking-wide text-gray-500 border-b border-gray-700">
                    <th className="py-2 pr-4">FUNCIONÁRIO</th>
                    <th className="py-2 pr-4">SERVIÇOS</th>
                    <th className="py-2 pr-4 text-right">COMISSÃO TOTAL</th>
                    <th className="py-2 pr-4 text-right">JÁ PAGO</th>
                    <th className="py-2 pr-4 text-right">SALDO A PAGAR</th>
                    <th className="py-2 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {comPag.itens.map((c) => (
                    <tr key={c.funcionario_id} className="border-b border-gray-700/50 last:border-0">
                      <td className="py-3 pr-4 font-medium">{c.nome}</td>
                      <td className="py-3 pr-4 text-gray-400">{c.qtd_servicos}</td>
                      <td className="py-3 pr-4 text-right">{brl(c.total_ganho)}</td>
                      <td className="py-3 pr-4 text-right text-gray-400">{brl(c.total_pago)}</td>
                      <td className={`py-3 pr-4 text-right font-bold ${c.saldo > 0 ? 'text-orange-500' : 'text-emerald-400'}`}>
                        {brl(c.saldo)}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => setPagarModal(c)}
                          disabled={c.saldo <= 0}
                          className="inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-40"
                        >
                          <Wallet size={13} /> Pagar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginacao pagina={comPag.pagina} totalPaginas={comPag.totalPaginas} total={comPag.total} onPagina={comPag.setPagina} />
          </>
        )}
      </div>

      {modal && (
        <DespesaModal
          despesa={modal.despesa}
          onClose={() => setModal(null)}
          onSalvo={() => {
            setModal(null);
            carregar();
          }}
        />
      )}
      {pagarModal && (
        <PagarComissaoModal
          comissao={pagarModal}
          onClose={() => setPagarModal(null)}
          onSalvo={() => {
            setPagarModal(null);
            carregar();
          }}
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

function PagarComissaoModal({ comissao, onClose, onSalvo }) {
  const [valor, setValor] = useState(String(comissao.saldo || ''));
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    if (!valor || Number(valor) <= 0) return setErro('Informe um valor válido');
    setSalvando(true);
    try {
      await api.post('/financeiro/comissoes/pagar', {
        funcionario_id: comissao.funcionario_id,
        valor: Number(valor),
        observacao: obs,
      });
      onSalvo();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao registrar');
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Pagar comissão</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900">
            <X size={20} />
          </button>
        </div>
        <div className="bg-gray-900 rounded-lg p-3 mb-3">
          <p className="font-semibold">{comissao.nome}</p>
          <p className="text-sm text-gray-400">Saldo a pagar: <span className="font-semibold text-orange-500">{brl(comissao.saldo)}</span></p>
        </div>
        <form onSubmit={salvar} className="space-y-3">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Valor a pagar (R$)</label>
            <input type="number" step="0.01" inputMode="decimal" autoFocus value={valor} onChange={(e) => setValor(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Observação (opcional)</label>
            <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex: acerto da semana" className={inputCls} />
          </div>
          {erro && <p className="text-red-400 text-sm">{erro}</p>}
          <button type="submit" disabled={salvando} className="w-full h-12 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg font-semibold">
            <Check size={18} /> Registrar pagamento
          </button>
        </form>
      </div>
    </div>
  );
}

function LinhaDRE({ label, valor, positivo, sub }) {
  return (
    <div className="flex items-center justify-between">
      <span className={sub ? 'text-xs' : ''}>{label}</span>
      <span className={`font-semibold ${positivo ? 'text-emerald-400' : valor < 0 ? 'text-red-400' : ''} ${sub ? 'text-xs' : ''}`}>
        {brl(valor)}
      </span>
    </div>
  );
}


function DespesaModal({ despesa, onClose, onSalvo }) {
  const editando = !!despesa;
  const [descricao, setDescricao] = useState(despesa?.descricao || '');
  const [categoria, setCategoria] = useState(despesa?.categoria || '');
  const [valor, setValor] = useState(despesa ? String(Number(despesa.valor) || '') : '');
  const [dia, setDia] = useState(despesa?.dia_vencimento ? String(despesa.dia_vencimento) : '');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    if (!descricao.trim()) return setErro('Informe a descrição');
    setSalvando(true);
    const payload = {
      descricao,
      categoria,
      valor: Number(valor) || 0,
      dia_vencimento: dia ? parseInt(dia, 10) : null,
    };
    try {
      if (editando) await api.put(`/financeiro/despesas/${despesa.id}`, payload);
      else await api.post('/financeiro/despesas', payload);
      onSalvo();
    } catch (err) {
      setErro(err.response?.data?.error || 'Erro ao salvar');
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">{editando ? 'Editar despesa' : 'Nova despesa'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={salvar} className="space-y-3">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Descrição *</label>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Aluguel, Luz, Internet..." className={inputCls} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Valor (R$)</label>
              <input type="number" step="0.01" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Dia venc. (opcional)</label>
              <input type="number" min="1" max="31" inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value)} placeholder="ex: 10" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Categoria (opcional)</label>
            <input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Fixa, Variável..." className={inputCls} />
          </div>
          {erro && <p className="text-red-400 text-sm">{erro}</p>}
          <button type="submit" disabled={salvando} className="w-full h-12 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 rounded-lg font-semibold">
            <Check size={18} /> {editando ? 'Salvar' : 'Criar despesa'}
          </button>
        </form>
      </div>
    </div>
  );
}
