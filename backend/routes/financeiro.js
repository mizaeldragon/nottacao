import express from 'express';
import { query } from '../db/connection.js';
import auth from '../middlewares/auth.js';
import plano from '../middlewares/plano.js';
import adminOnly from '../middlewares/adminOnly.js';

const router = express.Router();

// Financeiro (lucro, despesas, comissões) é só do dono.
router.use(auth, plano, adminOnly);

// ---------- Despesas fixas (CRUD) ----------
router.get('/despesas', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM despesas WHERE tenant_id = $1 AND ativo = true ORDER BY descricao`,
      [req.user.tenant_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar despesas' });
  }
});

router.post('/despesas', async (req, res) => {
  const { descricao, categoria, valor, dia_vencimento } = req.body;
  if (!descricao || !descricao.trim()) return res.status(400).json({ error: 'Descrição obrigatória' });
  try {
    const dia = parseInt(dia_vencimento, 10);
    const { rows } = await query(
      `INSERT INTO despesas (tenant_id, descricao, categoria, valor, dia_vencimento)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [
        req.user.tenant_id,
        descricao.trim(),
        categoria?.trim() || null,
        Number(valor) || 0,
        dia >= 1 && dia <= 31 ? dia : null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar despesa' });
  }
});

router.put('/despesas/:id', async (req, res) => {
  const { descricao, categoria, valor, dia_vencimento } = req.body;
  try {
    const dia = parseInt(dia_vencimento, 10);
    const { rows } = await query(
      `UPDATE despesas SET
         descricao = COALESCE($1, descricao),
         categoria = $2,
         valor = COALESCE($3, valor),
         dia_vencimento = $4
       WHERE id = $5 AND tenant_id = $6 RETURNING *`,
      [
        descricao ?? null,
        categoria?.trim() || null,
        valor ?? null,
        dia >= 1 && dia <= 31 ? dia : null,
        req.params.id,
        req.user.tenant_id,
      ]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Despesa não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar despesa' });
  }
});

router.delete('/despesas/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `DELETE FROM despesas WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [req.params.id, req.user.tenant_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Despesa não encontrada' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao remover despesa' });
  }
});

// ---------- DRE simples do período ----------
// GET /api/financeiro/dre?inicio=YYYY-MM-DD&fim=YYYY-MM-DD (padrão: mês atual)
router.get('/dre', async (req, res) => {
  let { inicio, fim } = req.query;
  if (!inicio || !fim) {
    const hoje = new Date();
    inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
    fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);
  }
  try {
    // Serviços e comissões
    const serv = await query(
      `SELECT COALESCE(SUM(l.valor),0) AS total, COALESCE(SUM(l.valor_funcionario),0) AS comissao
       FROM lancamentos l JOIN caixa_dia c ON c.id = l.caixa_id
       WHERE l.tenant_id = $1 AND c.data BETWEEN $2 AND $3`,
      [req.user.tenant_id, inicio, fim]
    );
    const totalServicos = Number(serv.rows[0].total);
    const comissoes = Number(serv.rows[0].comissao);

    // Vendas de produtos (faturamento) e custo dos produtos vendidos (CMV)
    const prod = await query(
      `SELECT COALESCE(SUM(e.valor_total),0) AS faturamento,
              COALESCE(SUM(e.quantidade * p.preco_custo),0) AS custo
       FROM movimentos_estoque e
       JOIN caixa_dia c ON c.id = e.caixa_id
       JOIN produtos p ON p.id = e.produto_id
       WHERE e.tenant_id = $1 AND e.tipo = 'saida' AND e.motivo = 'venda'
         AND c.data BETWEEN $2 AND $3`,
      [req.user.tenant_id, inicio, fim]
    );
    const faturamentoProdutos = Number(prod.rows[0].faturamento);
    const cmv = Number(prod.rows[0].custo);

    // Despesas fixas (mensais) ativas
    const desp = await query(
      `SELECT COALESCE(SUM(valor),0) AS total FROM despesas WHERE tenant_id = $1 AND ativo = true`,
      [req.user.tenant_id]
    );
    const despesasFixas = Number(desp.rows[0].total);

    const faturamento = round(totalServicos + faturamentoProdutos);
    const lucro = round(faturamento - comissoes - cmv - despesasFixas);

    res.json({
      periodo: { inicio, fim },
      faturamento,
      total_servicos: round(totalServicos),
      faturamento_produtos: round(faturamentoProdutos),
      comissoes: round(comissoes),
      cmv: round(cmv),
      despesas_fixas: round(despesasFixas),
      lucro,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao calcular DRE' });
  }
});

// ---------- Acerto de comissão ----------
// GET /api/financeiro/comissoes — por funcionário: ganho (total), pago, saldo a pagar
router.get('/comissoes', async (req, res) => {
  try {
    const ganho = await query(
      `SELECT f.id AS funcionario_id, f.nome,
              COALESCE(SUM(l.valor_funcionario),0) AS total_ganho,
              COUNT(l.id) AS qtd_servicos
       FROM funcionarios f
       LEFT JOIN lancamentos l ON l.funcionario_id = f.id
       WHERE f.tenant_id = $1 AND f.ativo = true
       GROUP BY f.id, f.nome ORDER BY f.nome`,
      [req.user.tenant_id]
    );
    const pago = await query(
      `SELECT funcionario_id, COALESCE(SUM(valor),0) AS total_pago
       FROM pagamentos_comissao WHERE tenant_id = $1 GROUP BY funcionario_id`,
      [req.user.tenant_id]
    );
    const pagoMap = {};
    pago.rows.forEach((p) => (pagoMap[p.funcionario_id] = Number(p.total_pago)));

    // Vales: sangrias de caixa vinculadas a um funcionário
    const vales = await query(
      `SELECT m.funcionario_id, COALESCE(SUM(m.valor),0) AS total_vales
       FROM movimentos_caixa m
       JOIN caixa_dia c ON c.id = m.caixa_id
       WHERE c.tenant_id = $1 AND m.tipo = 'sangria' AND m.funcionario_id IS NOT NULL
       GROUP BY m.funcionario_id`,
      [req.user.tenant_id]
    );
    const valesMap = {};
    vales.rows.forEach((v) => (valesMap[v.funcionario_id] = Number(v.total_vales)));

    const lista = ganho.rows.map((g) => {
      const totalGanho = round(g.total_ganho);
      const totalPago = round(pagoMap[g.funcionario_id] || 0);
      const totalVales = round(valesMap[g.funcionario_id] || 0);
      return {
        funcionario_id: g.funcionario_id,
        nome: g.nome,
        qtd_servicos: Number(g.qtd_servicos),
        total_ganho: totalGanho,
        total_pago: totalPago,
        total_vales: totalVales,
        saldo: round(totalGanho - totalPago - totalVales),
      };
    });
    res.json(lista);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao calcular comissões' });
  }
});

// POST /api/financeiro/comissoes/pagar — registra um acerto
router.post('/comissoes/pagar', async (req, res) => {
  const { funcionario_id, valor, observacao } = req.body;
  if (!funcionario_id) return res.status(400).json({ error: 'Funcionário obrigatório' });
  if (!valor || Number(valor) <= 0) return res.status(400).json({ error: 'Valor inválido' });
  try {
    const { rows } = await query(
      `INSERT INTO pagamentos_comissao (tenant_id, funcionario_id, valor, observacao)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.tenant_id, funcionario_id, Number(valor), observacao?.trim() || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao registrar pagamento' });
  }
});

// GET /api/financeiro/comissoes/:funcionarioId/pagamentos — histórico de acertos
router.get('/comissoes/:funcionarioId/pagamentos', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM pagamentos_comissao
       WHERE tenant_id = $1 AND funcionario_id = $2 ORDER BY created_at DESC`,
      [req.user.tenant_id, req.params.funcionarioId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar pagamentos' });
  }
});

function round(n) {
  return Math.round(Number(n) * 100) / 100;
}

export default router;
