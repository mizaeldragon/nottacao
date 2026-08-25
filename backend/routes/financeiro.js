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

    // Abatimentos: quanto de vale já foi quitado (desconto no acerto ou devolução em dinheiro)
    const abatidos = await query(
      `SELECT funcionario_id, COALESCE(SUM(valor),0) AS total_abatido
       FROM abatimentos_vale WHERE tenant_id = $1 GROUP BY funcionario_id`,
      [req.user.tenant_id]
    );
    const abatidoMap = {};
    abatidos.rows.forEach((a) => (abatidoMap[a.funcionario_id] = Number(a.total_abatido)));

    const lista = ganho.rows.map((g) => {
      const totalGanho = round(g.total_ganho);
      const totalPago = round(pagoMap[g.funcionario_id] || 0);
      const totalVales = round(valesMap[g.funcionario_id] || 0);
      const totalAbatido = round(abatidoMap[g.funcionario_id] || 0);
      // O que ainda pesa no acerto é só o vale em aberto (o abatido já foi quitado)
      const valesAberto = round(Math.max(totalVales - totalAbatido, 0));
      return {
        funcionario_id: g.funcionario_id,
        nome: g.nome,
        qtd_servicos: Number(g.qtd_servicos),
        total_ganho: totalGanho,
        total_pago: totalPago,
        total_vales: totalVales,
        total_abatido: totalAbatido,
        vales_aberto: valesAberto,
        saldo: round(totalGanho - totalPago - valesAberto),
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

// ---------- Abatimento de vale ----------
// Soma dos vales (sangrias vinculadas ao funcionário) e do que já foi abatido.
async function saldoVale(tenantId, funcionarioId) {
  const vales = await query(
    `SELECT COALESCE(SUM(m.valor),0) AS total FROM movimentos_caixa m
     JOIN caixa_dia c ON c.id = m.caixa_id
     WHERE c.tenant_id = $1 AND m.funcionario_id = $2 AND m.tipo = 'sangria'`,
    [tenantId, funcionarioId]
  );
  const abat = await query(
    `SELECT COALESCE(SUM(valor),0) AS total FROM abatimentos_vale
     WHERE tenant_id = $1 AND funcionario_id = $2`,
    [tenantId, funcionarioId]
  );
  const total = round(vales.rows[0].total);
  const abatido = round(abat.rows[0].total);
  return { total, abatido, aberto: round(total - abatido) };
}

// GET /api/financeiro/vales/:funcionarioId — vales do funcionário + abatimentos já feitos
router.get('/vales/:funcionarioId', async (req, res) => {
  try {
    const { funcionarioId } = req.params;
    const lancados = await query(
      `SELECT m.id, TO_CHAR(c.data, 'YYYY-MM-DD') AS data, m.valor, m.motivo,
              c.status AS caixa_status
       FROM movimentos_caixa m
       JOIN caixa_dia c ON c.id = m.caixa_id
       WHERE c.tenant_id = $1 AND m.funcionario_id = $2 AND m.tipo = 'sangria'
       ORDER BY c.data DESC, m.created_at DESC`,
      [req.user.tenant_id, funcionarioId]
    );
    const abatimentos = await query(
      `SELECT id, valor, origem, observacao, created_at
       FROM abatimentos_vale
       WHERE tenant_id = $1 AND funcionario_id = $2
       ORDER BY created_at DESC`,
      [req.user.tenant_id, funcionarioId]
    );
    const saldo = await saldoVale(req.user.tenant_id, funcionarioId);
    res.json({
      ...saldo,
      vales: lancados.rows.map((v) => ({ ...v, valor: Number(v.valor) })),
      abatimentos: abatimentos.rows.map((a) => ({ ...a, valor: Number(a.valor) })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar vales' });
  }
});

// POST /api/financeiro/vales/abater — quita parte (ou tudo) do vale do funcionário
// body: { funcionario_id, valor, origem: 'desconto'|'dinheiro', observacao }
router.post('/vales/abater', async (req, res) => {
  const { funcionario_id, valor, origem, observacao } = req.body;
  if (!funcionario_id) return res.status(400).json({ error: 'Funcionário obrigatório' });
  if (!valor || Number(valor) <= 0) return res.status(400).json({ error: 'Valor inválido' });
  const tipoAbat = origem === 'dinheiro' ? 'dinheiro' : 'desconto';

  try {
    const func = await query(
      `SELECT id, nome FROM funcionarios WHERE id = $1 AND tenant_id = $2`,
      [funcionario_id, req.user.tenant_id]
    );
    if (func.rows.length === 0) return res.status(404).json({ error: 'Funcionário não encontrado' });

    const saldo = await saldoVale(req.user.tenant_id, funcionario_id);
    if (saldo.aberto <= 0) {
      return res.status(400).json({ error: 'Esse funcionário não tem vale em aberto.' });
    }
    if (round(valor) > saldo.aberto + 0.001) {
      return res.status(400).json({
        error: `Valor maior que o vale em aberto (R$ ${saldo.aberto.toFixed(2).replace('.', ',')}).`,
      });
    }

    // Devolução em dinheiro entra no caixa como suprimento; desconto no acerto não mexe no caixa
    let movimentoId = null;
    if (tipoAbat === 'dinheiro') {
      const caixa = await query(
        `SELECT id FROM caixa_dia WHERE tenant_id = $1 AND status = 'aberto' LIMIT 1`,
        [req.user.tenant_id]
      );
      if (caixa.rows.length === 0) {
        return res.status(400).json({
          error: 'Nenhum caixa aberto. Abra o caixa para registrar a devolução em dinheiro.',
        });
      }
      const mov = await query(
        `INSERT INTO movimentos_caixa (caixa_id, tipo, valor, motivo, funcionario_id, forma_pagamento)
         VALUES ($1, 'suprimento', $2, $3, $4, 'dinheiro') RETURNING id`,
        [caixa.rows[0].id, Number(valor), `Devolução de vale — ${func.rows[0].nome}`, funcionario_id]
      );
      movimentoId = mov.rows[0].id;
    }

    const { rows } = await query(
      `INSERT INTO abatimentos_vale
         (tenant_id, funcionario_id, valor, origem, observacao, movimento_caixa_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        req.user.tenant_id,
        funcionario_id,
        Number(valor),
        tipoAbat,
        observacao?.trim() || null,
        movimentoId,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao abater vale' });
  }
});

// Carrega um vale (sangria com funcionário) garantindo que é do tenant.
async function carregarVale(tenantId, movimentoId) {
  const { rows } = await query(
    `SELECT m.*, c.id AS caixa_id, c.status AS caixa_status,
            c.valor_contado, c.diferenca
     FROM movimentos_caixa m
     JOIN caixa_dia c ON c.id = m.caixa_id
     WHERE m.id = $1 AND c.tenant_id = $2
       AND m.tipo = 'sangria' AND m.funcionario_id IS NOT NULL`,
    [movimentoId, tenantId]
  );
  return rows[0] || null;
}

// Mexer no valor de um vale muda o saldo daquele dia. Se o caixa já foi conferido,
// a diferença (sobra/falta) precisa acompanhar: saldo sobe D => diferença cai D.
async function ajustarConferencia(caixaId, valorContado, diferencaAtual, deltaSaldo) {
  if (valorContado === null || valorContado === undefined) return;
  const nova = round(Number(diferencaAtual || 0) - deltaSaldo);
  await query(`UPDATE caixa_dia SET diferenca = $1 WHERE id = $2`, [nova, caixaId]);
}

// PUT /api/financeiro/vales/:movimentoId — corrige um vale lançado errado
// body: { valor, funcionario_id, motivo }
router.put('/vales/:movimentoId', async (req, res) => {
  const { valor, funcionario_id, motivo } = req.body;
  try {
    const vale = await carregarVale(req.user.tenant_id, req.params.movimentoId);
    if (!vale) return res.status(404).json({ error: 'Vale não encontrado' });

    const valorAntigo = round(vale.valor);
    const valorNovo = valor === undefined || valor === null || valor === ''
      ? valorAntigo
      : round(valor);
    if (valorNovo <= 0) return res.status(400).json({ error: 'Valor inválido' });

    const funcAntigo = vale.funcionario_id;
    const funcNovo = funcionario_id || funcAntigo;

    const dest = await query(
      `SELECT id, nome FROM funcionarios WHERE id = $1 AND tenant_id = $2`,
      [funcNovo, req.user.tenant_id]
    );
    if (dest.rows.length === 0) return res.status(404).json({ error: 'Funcionário não encontrado' });

    // O total de vales do funcionário não pode ficar abaixo do que já foi abatido,
    // senão o acerto passa a mostrar vale negativo.
    const saldoAntigo = await saldoVale(req.user.tenant_id, funcAntigo);
    const totalAntigoDepois = funcNovo === funcAntigo
      ? round(saldoAntigo.total - valorAntigo + valorNovo)
      : round(saldoAntigo.total - valorAntigo);
    if (totalAntigoDepois < saldoAntigo.abatido - 0.001) {
      return res.status(400).json({
        error: `Esse funcionário já tem R$ ${saldoAntigo.abatido.toFixed(2).replace('.', ',')} de vale abatido. Desfaça o abatimento antes de reduzir o vale.`,
      });
    }

    // Motivo automático ("Vale — Fulano") acompanha a troca de funcionário
    const motivoAuto = /^Vale — /.test(vale.motivo || '');
    const motivoFinal = motivo !== undefined && motivo !== null && String(motivo).trim() !== ''
      ? String(motivo).trim()
      : motivoAuto || !vale.motivo
        ? `Vale — ${dest.rows[0].nome}`
        : vale.motivo;

    const { rows } = await query(
      `UPDATE movimentos_caixa SET valor = $1, funcionario_id = $2, motivo = $3
       WHERE id = $4 RETURNING *`,
      [valorNovo, funcNovo, motivoFinal, vale.id]
    );

    await ajustarConferencia(
      vale.caixa_id, vale.valor_contado, vale.diferenca,
      round(valorAntigo - valorNovo) // sangria menor => saldo do dia maior
    );

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao editar vale' });
  }
});

// DELETE /api/financeiro/vales/:movimentoId — apaga um vale lançado errado
router.delete('/vales/:movimentoId', async (req, res) => {
  try {
    const vale = await carregarVale(req.user.tenant_id, req.params.movimentoId);
    if (!vale) return res.status(404).json({ error: 'Vale não encontrado' });

    const saldo = await saldoVale(req.user.tenant_id, vale.funcionario_id);
    const totalDepois = round(saldo.total - round(vale.valor));
    if (totalDepois < saldo.abatido - 0.001) {
      return res.status(400).json({
        error: `Esse funcionário já tem R$ ${saldo.abatido.toFixed(2).replace('.', ',')} de vale abatido. Desfaça o abatimento antes de apagar o vale.`,
      });
    }

    await query(`DELETE FROM movimentos_caixa WHERE id = $1`, [vale.id]);
    await ajustarConferencia(
      vale.caixa_id, vale.valor_contado, vale.diferenca,
      round(vale.valor) // sangria some => saldo do dia sobe esse valor
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao apagar vale' });
  }
});

// DELETE /api/financeiro/vales/abatimento/:id — desfaz um abatimento lançado errado
router.delete('/vales/abatimento/:id', async (req, res) => {
  try {
    const abat = await query(
      `SELECT * FROM abatimentos_vale WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.user.tenant_id]
    );
    if (abat.rows.length === 0) return res.status(404).json({ error: 'Abatimento não encontrado' });

    // Se entrou dinheiro no caixa, só dá pra desfazer enquanto o caixa estiver aberto —
    // senão o fechamento já conferido mudaria depois do fato.
    const movId = abat.rows[0].movimento_caixa_id;
    if (movId) {
      const del = await query(
        `DELETE FROM movimentos_caixa m
         USING caixa_dia c
         WHERE m.id = $1 AND m.caixa_id = c.id AND c.tenant_id = $2 AND c.status = 'aberto'
         RETURNING m.id`,
        [movId, req.user.tenant_id]
      );
      if (del.rows.length === 0) {
        return res.status(400).json({
          error: 'O caixa dessa devolução já foi fechado. Lance um novo vale para corrigir.',
        });
      }
    }

    await query(`DELETE FROM abatimentos_vale WHERE id = $1 AND tenant_id = $2`, [
      req.params.id,
      req.user.tenant_id,
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao desfazer abatimento' });
  }
});

function round(n) {
  return Math.round(Number(n) * 100) / 100;
}

export default router;
