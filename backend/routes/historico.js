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

    // Vales pagos a funcionários no período
    const valesRes = await query(
      `SELECT m.funcionario_id, COALESCE(SUM(m.valor), 0) AS total_vales
       FROM movimentos_caixa m
       JOIN caixa_dia c ON c.id = m.caixa_id
       WHERE c.tenant_id = $1 AND m.tipo = 'sangria' AND m.funcionario_id IS NOT NULL
         AND c.data BETWEEN $2 AND $3
       GROUP BY m.funcionario_id`,
      [req.user.tenant_id, inicio, fim]
    );
    const valesMap = {};
    let totalValesPeriodo = 0;
    for (const v of valesRes.rows) {
      valesMap[v.funcionario_id] = Number(v.total_vales);
      totalValesPeriodo += Number(v.total_vales);
    }
    totalValesPeriodo = Math.round(totalValesPeriodo * 100) / 100;

    // Vendas por forma (PDV + serviços; mistos desmembrados pelo JSON pagamentos)
    const porForma = { pix: 0, cartao_credito: 0, cartao_debito: 0, dinheiro: 0 };
    const somarForma = (forma, valor) => {
      const v = Number(valor) || 0;
      if (v <= 0 || !forma || forma === 'misto' || forma === 'fiado') return;
      if (porForma[forma] !== undefined) porForma[forma] += v;
      else if (forma === 'cartao') porForma.cartao_credito += v;
    };

    const formaRes = await query(
      `SELECT v.pagamentos FROM vendas v
       JOIN caixa_dia c ON c.id = v.caixa_id
       WHERE v.tenant_id = $1 AND c.data BETWEEN $2 AND $3 AND COALESCE(v.fiado, false) = false`,
      [req.user.tenant_id, inicio, fim]
    );
    for (const v of formaRes.rows) {
      const pags = typeof v.pagamentos === 'string' ? JSON.parse(v.pagamentos) : v.pagamentos;
      for (const p of pags || []) somarForma(p.forma, p.valor);
    }

    const servForma = await query(
      `SELECT l.forma_pagamento, l.pagamentos, l.valor
       FROM lancamentos l JOIN caixa_dia c ON c.id = l.caixa_id
       WHERE l.tenant_id = $1 AND c.data BETWEEN $2 AND $3
         AND l.forma_pagamento IS NOT NULL AND l.forma_pagamento <> 'fiado'`,
      [req.user.tenant_id, inicio, fim]
    );
    for (const s of servForma.rows) {
      if (s.forma_pagamento === 'misto') {
        const pags = typeof s.pagamentos === 'string' ? JSON.parse(s.pagamentos) : s.pagamentos;
        for (const p of pags || []) somarForma(p.forma, p.valor);
      } else {
        somarForma(s.forma_pagamento, s.valor);
      }
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

    const porFuncionario = Object.values(map).map((f) => ({
      ...f,
      total_vales: Math.round((valesMap[f.funcionario_id] || 0) * 100) / 100,
    }));

    res.json({
      periodo: { inicio, fim },
      por_dia: porDia,
      total_geral: totalGeral,
      total_funcionarios: totalFuncionarios,
      total_patrao: totalPatrao,
      total_vales: totalValesPeriodo,
      qtd_servicos: lancamentos.length,
      total_produtos: totalProdutos,
      qtd_produtos: qtdProdutos,
      produtos_vendidos: produtosVendidos,
      por_forma: porForma,
      faturamento_total: Math.round((totalGeral + totalProdutos) * 100) / 100,
      por_funcionario: porFuncionario,
      lancamentos,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao gerar histórico' });
  }
});

export default router;
