import express from 'express';
import { query } from '../db/connection.js';
import auth from '../middlewares/auth.js';
import plano from '../middlewares/plano.js';

const router = express.Router();

router.use(auth, plano);

// GET /api/historico?inicio=YYYY-MM-DD&fim=YYYY-MM-DD
// Sem datas => semana atual (segunda a domingo).
router.get('/', async (req, res) => {
  let { inicio, fim } = req.query;

  if (!inicio || !fim) {
    // Semana atual: segunda-feira até hoje
    const hoje = new Date();
    const diaSemana = (hoje.getDay() + 6) % 7; // 0 = segunda
    const segunda = new Date(hoje);
    segunda.setDate(hoje.getDate() - diaSemana);
    inicio = segunda.toISOString().slice(0, 10);
    fim = hoje.toISOString().slice(0, 10);
  }

  try {
    // Lançamentos do período (filtra pela data do caixa)
    const lancRes = await query(
      `SELECT l.*, f.nome AS funcionario_nome, c.data AS data_caixa
       FROM lancamentos l
       JOIN caixa_dia c ON c.id = l.caixa_id
       LEFT JOIN funcionarios f ON f.id = l.funcionario_id
       WHERE l.tenant_id = $1 AND c.data BETWEEN $2 AND $3
       ORDER BY c.data, l.created_at`,
      [req.user.tenant_id, inicio, fim]
    );
    const lancamentos = lancRes.rows;

    const totalGeral = lancamentos.reduce((s, l) => s + Number(l.valor), 0);
    const totalFuncionarios = lancamentos.reduce((s, l) => s + Number(l.valor_funcionario), 0);
    const totalPatrao = lancamentos.reduce((s, l) => s + Number(l.valor_patrao), 0);

    // Vendas de produtos do período (saídas que entraram no caixa)
    const prodRes = await query(
      `SELECT e.quantidade, e.valor_total, p.nome AS produto_nome
       FROM movimentos_estoque e
       JOIN caixa_dia c ON c.id = e.caixa_id
       JOIN produtos p ON p.id = e.produto_id
       WHERE e.tenant_id = $1 AND e.tipo = 'saida' AND e.motivo = 'venda'
         AND c.data BETWEEN $2 AND $3`,
      [req.user.tenant_id, inicio, fim]
    );
    const prodMap = {};
    let totalProdutos = 0;
    let qtdProdutos = 0;
    for (const r of prodRes.rows) {
      totalProdutos += Number(r.valor_total);
      qtdProdutos += Number(r.quantidade);
      const key = r.produto_nome;
      if (!prodMap[key]) prodMap[key] = { nome: key, qtd: 0, total: 0 };
      prodMap[key].qtd += Number(r.quantidade);
      prodMap[key].total += Number(r.valor_total);
    }
    totalProdutos = Math.round(totalProdutos * 100) / 100;
    const produtosVendidos = Object.values(prodMap).sort((a, b) => b.total - a.total);

    // Vendas por forma de pagamento (do registro de vendas do PDV)
    const formaRes = await query(
      `SELECT v.pagamentos FROM vendas v
       JOIN caixa_dia c ON c.id = v.caixa_id
       WHERE v.tenant_id = $1 AND c.data BETWEEN $2 AND $3`,
      [req.user.tenant_id, inicio, fim]
    );
    const porForma = { pix: 0, cartao: 0, dinheiro: 0 };
    for (const v of formaRes.rows) {
      for (const p of v.pagamentos || []) {
        if (porForma[p.forma] !== undefined) porForma[p.forma] += Number(p.valor) || 0;
      }
    }
    // Serviços com forma de pagamento informada
    const servForma = await query(
      `SELECT l.forma_pagamento AS forma, COALESCE(SUM(l.valor),0) AS total
       FROM lancamentos l JOIN caixa_dia c ON c.id = l.caixa_id
       WHERE l.tenant_id = $1 AND c.data BETWEEN $2 AND $3 AND l.forma_pagamento IS NOT NULL
       GROUP BY l.forma_pagamento`,
      [req.user.tenant_id, inicio, fim]
    );
    for (const s of servForma.rows) {
      if (porForma[s.forma] !== undefined) porForma[s.forma] += Number(s.total) || 0;
    }
    Object.keys(porForma).forEach((k) => (porForma[k] = Math.round(porForma[k] * 100) / 100));

    // Por funcionário
    const map = {};
    for (const l of lancamentos) {
      const key = l.funcionario_id || 'sem';
      if (!map[key]) {
        map[key] = {
          funcionario_id: l.funcionario_id,
          nome: l.funcionario_nome || 'Sem funcionário',
          qtd: 0,
          comissao: 0,
          total_gerado: 0,
        };
      }
      map[key].qtd += 1;
      map[key].comissao += Number(l.valor_funcionario);
      map[key].total_gerado += Number(l.valor);
    }

    // Série diária (faturamento serviços + produtos) para gráfico
    const serie = await query(
      `WITH dias AS (
         SELECT generate_series($2::date, $3::date, INTERVAL '1 day')::date AS dia
       )
       SELECT d.dia,
         COALESCE((SELECT SUM(l.valor) FROM lancamentos l JOIN caixa_dia c ON c.id = l.caixa_id
                   WHERE l.tenant_id = $1 AND c.data = d.dia), 0)
         + COALESCE((SELECT SUM(e.valor_total) FROM movimentos_estoque e JOIN caixa_dia c ON c.id = e.caixa_id
                   WHERE e.tenant_id = $1 AND e.tipo='saida' AND e.motivo='venda' AND c.data = d.dia), 0) AS total
       FROM dias d ORDER BY d.dia`,
      [req.user.tenant_id, inicio, fim]
    );
    const porDia = serie.rows.map((r) => ({ dia: r.dia, total: Number(r.total) }));

    res.json({
      periodo: { inicio, fim },
      por_dia: porDia,
      total_geral: totalGeral,
      total_funcionarios: totalFuncionarios,
      total_patrao: totalPatrao,
      qtd_servicos: lancamentos.length,
      total_produtos: totalProdutos,
      qtd_produtos: qtdProdutos,
      produtos_vendidos: produtosVendidos,
      por_forma: porForma,
      faturamento_total: Math.round((totalGeral + totalProdutos) * 100) / 100,
      por_funcionario: Object.values(map),
      lancamentos,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao gerar histórico' });
  }
});

export default router;
