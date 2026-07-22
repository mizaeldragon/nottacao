import express from 'express';
import { query } from '../db/connection.js';
import auth from '../middlewares/auth.js';
import plano from '../middlewares/plano.js';

const router = express.Router();

router.use(auth, plano);

// Monta o resumo completo de um caixa (totais, por funcionário, movimentos, saldo).
async function montarResumo(caixa, tenantId) {
  const lancRes = await query(
    `SELECT l.*, f.nome AS funcionario_nome
     FROM lancamentos l
     LEFT JOIN funcionarios f ON f.id = l.funcionario_id
     WHERE l.caixa_id = $1 ORDER BY l.created_at`,
    [caixa.id]
  );
  const lancamentos = lancRes.rows;
  // Fiado não entra no caixa agora; será contabilizado quando o cliente pagar
  const lancamentosFinanceiros = lancamentos.filter((l) => l.forma_pagamento !== 'fiado');

  const movRes = await query(
    `SELECT m.*, f.nome AS funcionario_nome
     FROM movimentos_caixa m
     LEFT JOIN funcionarios f ON f.id = m.funcionario_id
     WHERE m.caixa_id = $1 ORDER BY m.created_at`,
    [caixa.id]
  );
  const movimentos = movRes.rows;

  // Movimentações de estoque que refletem neste caixa (com o nome do produto)
  const estRes = await query(
    `SELECT e.*, p.nome AS produto_nome
     FROM movimentos_estoque e
     JOIN produtos p ON p.id = e.produto_id
     WHERE e.caixa_id = $1 ORDER BY e.created_at`,
    [caixa.id]
  );
  const estoque = estRes.rows;

  const totalServicos = lancamentosFinanceiros.reduce((s, l) => s + Number(l.valor), 0);
  const totalFuncionarios = lancamentosFinanceiros.reduce((s, l) => s + Number(l.valor_funcionario), 0);
  const totalPatrao = lancamentosFinanceiros.reduce((s, l) => s + Number(l.valor_patrao), 0);

  // Agrupa por funcionário: qtd de serviços + comissão (valor_funcionario)
  const porFuncionarioMap = {};
  for (const l of lancamentos) {
    const key = l.funcionario_id || 'sem';
    if (!porFuncionarioMap[key]) {
      porFuncionarioMap[key] = {
        funcionario_id: l.funcionario_id,
        nome: l.funcionario_nome || 'Sem funcionário',
        qtd: 0,
        comissao: 0,
      };
    }
    porFuncionarioMap[key].qtd += 1;
    porFuncionarioMap[key].comissao += Number(l.valor_funcionario);
  }
  const porFuncionario = Object.values(porFuncionarioMap);

  const sangrias = movimentos
    .filter((m) => m.tipo === 'sangria')
    .reduce((s, m) => s + Number(m.valor), 0);
  const suprimentos = movimentos
    .filter((m) => m.tipo === 'suprimento')
    .reduce((s, m) => s + Number(m.valor), 0);

  // Estoque: venda (saida) entra no caixa; compra (entrada) descontada sai do caixa.
  const vendasProdutos = estoque
    .filter((e) => e.tipo === 'saida')
    .reduce((s, e) => s + Number(e.valor_total), 0);
  const comprasEstoque = estoque
    .filter((e) => e.tipo === 'entrada')
    .reduce((s, e) => s + Number(e.valor_total), 0);

  // Entradas por forma de pagamento (PDV + serviços + mistos desmembrados + suprimentos)
  const porForma = { pix: 0, cartao_credito: 0, cartao_debito: 0, dinheiro: 0 };
  const somarForma = (forma, valor) => {
    const v = Number(valor) || 0;
    if (v <= 0 || !forma || forma === 'misto' || forma === 'fiado') return;
    if (porForma[forma] !== undefined) porForma[forma] += v;
    else if (forma === 'cartao') porForma.cartao_credito += v; // legado
  };

  const vendasRes = await query(
    `SELECT pagamentos FROM vendas WHERE caixa_id = $1 AND COALESCE(fiado, false) = false`,
    [caixa.id]
  );
  for (const v of vendasRes.rows) {
    const pags = typeof v.pagamentos === 'string' ? JSON.parse(v.pagamentos) : v.pagamentos;
    for (const p of pags || []) somarForma(p.forma, p.valor);
  }

  for (const l of lancamentosFinanceiros) {
    if (l.forma_pagamento === 'misto') {
      const pags = typeof l.pagamentos === 'string' ? JSON.parse(l.pagamentos) : l.pagamentos;
      for (const p of pags || []) somarForma(p.forma, p.valor);
    } else {
      somarForma(l.forma_pagamento, l.valor);
    }
  }

  // Suprimentos com forma (ex.: recebimento de fiado) também são entradas reais
  for (const m of movimentos) {
    if (m.tipo === 'suprimento') somarForma(m.forma_pagamento, m.valor);
  }

  Object.keys(porForma).forEach((k) => (porForma[k] = Math.round(porForma[k] * 100) / 100));

  // Modelo de caixa (dinheiro que passa pela gaveta):
  //   Entradas = serviços + suprimentos + vendas de produtos
  //   Saídas   = sangrias + compras de estoque descontadas do caixa
  //   Saldo    = valor inicial + entradas - saídas
  const entradas = totalServicos + suprimentos + vendasProdutos;
  const saidas = sangrias + comprasEstoque;
  const saldoFinal = Number(caixa.valor_inicial) + entradas - saidas;

  return {
    caixa,
    lancamentos,
    movimentos,
    estoque,
    resumo: {
      valor_inicial: Number(caixa.valor_inicial),
      total_servicos: totalServicos,
      total_funcionarios: totalFuncionarios,
      total_patrao: totalPatrao,
      qtd_servicos: lancamentos.length,
      por_funcionario: porFuncionario,
      sangrias,
      suprimentos,
      vendas_produtos: vendasProdutos,
      compras_estoque: comprasEstoque,
      por_forma: porForma,
      entradas,
      saidas,
      saldo_final: saldoFinal,
      valor_contado: caixa.valor_contado != null ? Number(caixa.valor_contado) : null,
      diferenca: caixa.diferenca != null ? Number(caixa.diferenca) : null,
    },
  };
}

// GET /api/caixa/atual — caixa aberto de hoje (ou null)
router.get('/atual', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM caixa_dia
       WHERE tenant_id = $1 AND status = 'aberto'
       ORDER BY data DESC LIMIT 1`,
      [req.user.tenant_id]
    );
    if (rows.length === 0) return res.json(null);
    const resumo = await montarResumo(rows[0], req.user.tenant_id);
    res.json(resumo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar caixa' });
  }
});

// GET /api/caixa/fechados — lista os caixas já fechados (mais recentes primeiro)
router.get('/fechados', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, data, valor_inicial, valor_contado, diferenca, fechado_em
       FROM caixa_dia
       WHERE tenant_id = $1 AND status = 'fechado'
       ORDER BY data DESC, fechado_em DESC LIMIT 60`,
      [req.user.tenant_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar caixas' });
  }
});

// GET /api/caixa/:id — resumo completo de um caixa específico (fechado)
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM caixa_dia WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.user.tenant_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Caixa não encontrado' });
    const resumo = await montarResumo(rows[0], req.user.tenant_id);
    res.json(resumo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar caixa' });
  }
});

// POST /api/caixa/abrir — abre o caixa do dia
router.post('/abrir', async (req, res) => {
  const { valor_inicial } = req.body;
  try {
    const aberto = await query(
      `SELECT id FROM caixa_dia WHERE tenant_id = $1 AND status = 'aberto'`,
      [req.user.tenant_id]
    );
    if (aberto.rows.length > 0) {
      return res.status(409).json({ error: 'Já existe um caixa aberto' });
    }

    const { rows } = await query(
      `INSERT INTO caixa_dia (tenant_id, data, valor_inicial, status)
       VALUES ($1, CURRENT_DATE, $2, 'aberto') RETURNING *`,
      [req.user.tenant_id, valor_inicial || 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao abrir caixa' });
  }
});

// POST /api/caixa/movimento — sangria ou suprimento (com suporte a vale de funcionário)
router.post('/movimento', async (req, res) => {
  const { tipo, valor, motivo, funcionario_id, forma_pagamento } = req.body;
  if (!['sangria', 'suprimento'].includes(tipo)) {
    return res.status(400).json({ error: 'Tipo deve ser sangria ou suprimento' });
  }
  if (!valor || Number(valor) <= 0) {
    return res.status(400).json({ error: 'Valor inválido' });
  }

  try {
    const caixa = await query(
      `SELECT id FROM caixa_dia WHERE tenant_id = $1 AND status = 'aberto' LIMIT 1`,
      [req.user.tenant_id]
    );
    if (caixa.rows.length === 0) {
      return res.status(400).json({ error: 'Nenhum caixa aberto' });
    }

    let funcId = null;
    let motivoFinal = motivo || null;
    if (funcionario_id) {
      const f = await query(
        `SELECT id, nome FROM funcionarios WHERE id = $1 AND tenant_id = $2 AND ativo = true`,
        [funcionario_id, req.user.tenant_id]
      );
      if (f.rows.length > 0) {
        funcId = f.rows[0].id;
        if (!motivoFinal) motivoFinal = `Vale — ${f.rows[0].nome}`;
      }
    }

    const FORMAS_VALIDAS = ['pix', 'cartao_credito', 'cartao_debito', 'dinheiro'];
    const forma = FORMAS_VALIDAS.includes(forma_pagamento) ? forma_pagamento : null;

    const { rows } = await query(
      `INSERT INTO movimentos_caixa (caixa_id, tipo, valor, motivo, funcionario_id, forma_pagamento)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [caixa.rows[0].id, tipo, valor, motivoFinal, funcId, forma]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao registrar movimento' });
  }
});

// DELETE /api/caixa/movimento/:id — remove uma sangria/suprimento do caixa aberto
router.delete('/movimento/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `DELETE FROM movimentos_caixa m
       USING caixa_dia c
       WHERE m.id = $1
         AND m.caixa_id = c.id
         AND c.tenant_id = $2
         AND c.status = 'aberto'
       RETURNING m.id`,
      [req.params.id, req.user.tenant_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Movimento não encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir movimento' });
  }
});

// POST /api/caixa/fechar — fecha o caixa aberto e devolve o resumo
// body opcional: { valor_contado } -> registra a conferência (diferença sobra/falta)
router.post('/fechar', async (req, res) => {
  try {
    const caixa = await query(
      `SELECT * FROM caixa_dia WHERE tenant_id = $1 AND status = 'aberto' LIMIT 1`,
      [req.user.tenant_id]
    );
    if (caixa.rows.length === 0) {
      return res.status(400).json({ error: 'Nenhum caixa aberto' });
    }

    const fechado = await query(
      `UPDATE caixa_dia SET status = 'fechado', fechado_em = NOW()
       WHERE id = $1 RETURNING *`,
      [caixa.rows[0].id]
    );

    let resumo = await montarResumo(fechado.rows[0], req.user.tenant_id);

    // Conferência: compara o que foi contado com o saldo esperado
    const { valor_contado } = req.body;
    if (valor_contado !== undefined && valor_contado !== null && valor_contado !== '') {
      const contado = Number(valor_contado);
      const diferenca = Math.round((contado - resumo.resumo.saldo_final) * 100) / 100;
      const atualizado = await query(
        `UPDATE caixa_dia SET valor_contado = $1, diferenca = $2 WHERE id = $3 RETURNING *`,
        [contado, diferenca, fechado.rows[0].id]
      );
      resumo = await montarResumo(atualizado.rows[0], req.user.tenant_id);
    }

    res.json(resumo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao fechar caixa' });
  }
});

export default router;
