import express from 'express';
import { query } from '../db/connection.js';
import auth from '../middlewares/auth.js';
import plano from '../middlewares/plano.js';

const router = express.Router();

router.use(auth, plano);

// GET /api/dashboard — visão geral (hoje + últimos 7 dias + alertas)
router.get('/', async (req, res) => {
  const tenant = req.user.tenant_id;
  try {
    // Caixa de hoje (aberto)
    const caixa = await query(
      `SELECT * FROM caixa_dia WHERE tenant_id = $1 AND status = 'aberto' ORDER BY data DESC LIMIT 1`,
      [tenant]
    );
    const caixaAberto = caixa.rows[0] || null;

    // Serviços de hoje
    const servHoje = await query(
      `SELECT COALESCE(SUM(l.valor),0) AS total, COUNT(*) AS qtd
       FROM lancamentos l JOIN caixa_dia c ON c.id = l.caixa_id
       WHERE l.tenant_id = $1 AND c.data = CURRENT_DATE`,
      [tenant]
    );
    // Vendas de produtos de hoje
    const vendHoje = await query(
      `SELECT COALESCE(SUM(e.valor_total),0) AS total, COALESCE(SUM(e.quantidade),0) AS qtd
       FROM movimentos_estoque e JOIN caixa_dia c ON c.id = e.caixa_id
       WHERE e.tenant_id = $1 AND e.tipo = 'saida' AND e.motivo = 'venda' AND c.data = CURRENT_DATE`,
      [tenant]
    );

    const totalServicosHoje = Number(servHoje.rows[0].total);
    const totalVendasHoje = Number(vendHoje.rows[0].total);

    // Estoque baixo
    const estoque = await query(
      `SELECT COUNT(*) AS baixo FROM produtos
       WHERE tenant_id = $1 AND ativo = true AND quantidade <= estoque_minimo`,
      [tenant]
    );

    // Total a receber (fiado em aberto)
    const fiado = await query(
      `SELECT COALESCE(SUM(valor - valor_pago),0) AS total
       FROM contas_receber WHERE tenant_id = $1 AND status = 'aberto'`,
      [tenant]
    );

    // Últimos 7 dias (faturamento serviços + produtos por dia)
    const serie = await query(
      `WITH dias AS (
         SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day')::date AS dia
       )
       SELECT d.dia,
         COALESCE((SELECT SUM(l.valor) FROM lancamentos l JOIN caixa_dia c ON c.id = l.caixa_id
                   WHERE l.tenant_id = $1 AND c.data = d.dia), 0)
         + COALESCE((SELECT SUM(e.valor_total) FROM movimentos_estoque e JOIN caixa_dia c ON c.id = e.caixa_id
                   WHERE e.tenant_id = $1 AND e.tipo='saida' AND e.motivo='venda' AND c.data = d.dia), 0) AS total
       FROM dias d ORDER BY d.dia`,
      [tenant]
    );

    // Faturamento do mês atual
    const fatMes = await query(
      `SELECT
         COALESCE((SELECT SUM(l.valor) FROM lancamentos l JOIN caixa_dia c ON c.id = l.caixa_id
                   WHERE l.tenant_id = $1 AND date_trunc('month', c.data) = date_trunc('month', CURRENT_DATE)), 0)
         + COALESCE((SELECT SUM(e.valor_total) FROM movimentos_estoque e JOIN caixa_dia c ON c.id = e.caixa_id
                   WHERE e.tenant_id = $1 AND e.tipo='saida' AND e.motivo='venda'
                     AND date_trunc('month', c.data) = date_trunc('month', CURRENT_DATE)), 0) AS total,
         COALESCE((SELECT COUNT(*) FROM lancamentos l JOIN caixa_dia c ON c.id = l.caixa_id
                   WHERE l.tenant_id = $1 AND date_trunc('month', c.data) = date_trunc('month', CURRENT_DATE)), 0) AS qtd_servicos`,
      [tenant]
    );

    // Últimos 5 serviços lançados
    const ultimos = await query(
      `SELECT l.id, l.valor, l.created_at,
              f.nome AS funcionario, ts.nome AS tipo_servico,
              l.cliente_nome, l.forma_pagamento
       FROM lancamentos l
       LEFT JOIN funcionarios f ON f.id = l.funcionario_id
       LEFT JOIN tipos_servico ts ON ts.id = l.tipo_servico_id
       WHERE l.tenant_id = $1
       ORDER BY l.created_at DESC LIMIT 5`,
      [tenant]
    );

    // Serviços por funcionário hoje
    const porFunc = await query(
      `SELECT f.nome, COUNT(*) AS qtd, COALESCE(SUM(l.valor),0) AS total, COALESCE(SUM(l.valor_funcionario),0) AS comissao
       FROM lancamentos l
       JOIN funcionarios f ON f.id = l.funcionario_id
       JOIN caixa_dia c ON c.id = l.caixa_id
       WHERE l.tenant_id = $1 AND c.data = CURRENT_DATE
       GROUP BY f.id, f.nome ORDER BY total DESC`,
      [tenant]
    );

    res.json({
      caixa_aberto: !!caixaAberto,
      servicos_hoje: { total: totalServicosHoje, qtd: Number(servHoje.rows[0].qtd) },
      vendas_hoje: { total: totalVendasHoje, qtd: Number(vendHoje.rows[0].qtd) },
      faturamento_hoje: Math.round((totalServicosHoje + totalVendasHoje) * 100) / 100,
      estoque_baixo: Number(estoque.rows[0].baixo),
      a_receber: Number(fiado.rows[0].total),
      ultimos_7_dias: serie.rows.map((r) => ({ dia: r.dia, total: Number(r.total) })),
      faturamento_mes: Number(fatMes.rows[0].total),
      servicos_mes: Number(fatMes.rows[0].qtd_servicos),
      ultimos_lancamentos: ultimos.rows.map((r) => ({
        id: r.id,
        valor: Number(r.valor),
        funcionario: r.funcionario,
        tipo_servico: r.tipo_servico,
        cliente_nome: r.cliente_nome,
        forma_pagamento: r.forma_pagamento,
        criado_em: r.created_at,
      })),
      por_funcionario: porFunc.rows.map((r) => ({
        nome: r.nome,
        qtd: Number(r.qtd),
        total: Number(r.total),
        comissao: Number(r.comissao),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao montar dashboard' });
  }
});

export default router;
