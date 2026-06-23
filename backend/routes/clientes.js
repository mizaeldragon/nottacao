import express from 'express';
import pool, { query } from '../db/connection.js';
import auth from '../middlewares/auth.js';
import plano from '../middlewares/plano.js';

const router = express.Router();

router.use(auth, plano);

// GET /api/clientes — lista clientes ativos + saldo devedor (fiado em aberto)
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT c.*,
              COALESCE((
                SELECT SUM(cr.valor - cr.valor_pago)
                FROM contas_receber cr
                WHERE cr.cliente_id = c.id AND cr.status = 'aberto'
              ), 0) AS saldo_devedor
       FROM clientes c
       WHERE c.tenant_id = $1 AND c.ativo = true
       ORDER BY c.nome`,
      [req.user.tenant_id]
    );
    res.json(rows.map((c) => ({ ...c, saldo_devedor: Number(c.saldo_devedor) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar clientes' });
  }
});

router.post('/', async (req, res) => {
  const { nome, telefone, observacao } = req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome obrigatório' });
  try {
    const { rows } = await query(
      `INSERT INTO clientes (tenant_id, nome, telefone, observacao)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.tenant_id, nome.trim(), telefone?.trim() || null, observacao?.trim() || null]
    );
    res.status(201).json({ ...rows[0], saldo_devedor: 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar cliente' });
  }
});

router.put('/:id', async (req, res) => {
  const { nome, telefone, observacao } = req.body;
  try {
    const { rows } = await query(
      `UPDATE clientes SET
         nome = COALESCE($1, nome),
         telefone = $2,
         observacao = $3
       WHERE id = $4 AND tenant_id = $5 RETURNING *`,
      [nome ?? null, telefone?.trim() || null, observacao?.trim() || null, req.params.id, req.user.tenant_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar cliente' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE clientes SET ativo = false WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [req.params.id, req.user.tenant_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao remover cliente' });
  }
});

// GET /api/clientes/:id/contas — contas a receber (fiado) do cliente
router.get('/:id/contas', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM contas_receber
       WHERE tenant_id = $1 AND cliente_id = $2
       ORDER BY status, created_at DESC`,
      [req.user.tenant_id, req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar contas' });
  }
});

// POST /api/clientes/contas/:contaId/pagar — recebe (parte de) um fiado específico
router.post('/contas/:contaId/pagar', async (req, res) => {
  const { valor, forma_pagamento } = req.body;
  if (!valor || Number(valor) <= 0) return res.status(400).json({ error: 'Valor inválido' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const contaRes = await client.query(
      `SELECT cr.*, c.nome AS cliente_nome
       FROM contas_receber cr JOIN clientes c ON c.id = cr.cliente_id
       WHERE cr.id = $1 AND cr.tenant_id = $2 FOR UPDATE`,
      [req.params.contaId, req.user.tenant_id]
    );
    if (contaRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Conta não encontrada' });
    }
    const conta = contaRes.rows[0];
    const restante = Number(conta.valor) - Number(conta.valor_pago);
    const pago = Math.min(Number(valor), restante);
    if (pago <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Conta já quitada' });
    }

    const caixa = await client.query(
      `SELECT id FROM caixa_dia WHERE tenant_id = $1 AND status = 'aberto' LIMIT 1`,
      [req.user.tenant_id]
    );
    if (caixa.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Abra o caixa para receber o pagamento' });
    }

    const FORMAS = ['pix', 'cartao', 'dinheiro'];
    const forma = FORMAS.includes(forma_pagamento) ? forma_pagamento : 'dinheiro';
    const motivo = `Recebimento fiado — ${conta.cliente_nome}`;

    await client.query(
      `INSERT INTO movimentos_caixa (caixa_id, tipo, valor, motivo, forma_pagamento)
       VALUES ($1, 'suprimento', $2, $3, $4)`,
      [caixa.rows[0].id, pago, motivo, forma]
    );

    const novoPago = Math.round((Number(conta.valor_pago) + pago) * 100) / 100;
    const status = novoPago >= Number(conta.valor) - 0.01 ? 'pago' : 'aberto';
    await client.query(
      `UPDATE contas_receber SET valor_pago = $1, status = $2 WHERE id = $3`,
      [novoPago, status, conta.id]
    );

    await client.query('COMMIT');
    res.json({ ok: true, pago: Math.round(pago * 100) / 100, status });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erro ao registrar recebimento' });
  } finally {
    client.release();
  }
});

// POST /api/clientes/:id/pagar-abono — recebe um valor total e distribui pelas contas abertas (mais antigas primeiro)
router.post('/:id/pagar-abono', async (req, res) => {
  const { valor, forma_pagamento } = req.body;
  if (!valor || Number(valor) <= 0) return res.status(400).json({ error: 'Valor inválido' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const clienteRes = await client.query(
      `SELECT nome FROM clientes WHERE id = $1 AND tenant_id = $2 AND ativo = true`,
      [req.params.id, req.user.tenant_id]
    );
    if (clienteRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    const nomeCliente = clienteRes.rows[0].nome;

    const contasRes = await client.query(
      `SELECT * FROM contas_receber
       WHERE tenant_id = $1 AND cliente_id = $2 AND status = 'aberto'
       ORDER BY created_at ASC FOR UPDATE`,
      [req.user.tenant_id, req.params.id]
    );
    if (contasRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Nenhuma conta em aberto' });
    }

    const caixa = await client.query(
      `SELECT id FROM caixa_dia WHERE tenant_id = $1 AND status = 'aberto' LIMIT 1`,
      [req.user.tenant_id]
    );
    if (caixa.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Abra o caixa para receber o pagamento' });
    }

    const FORMAS = ['pix', 'cartao', 'dinheiro'];
    const forma = FORMAS.includes(forma_pagamento) ? forma_pagamento : 'dinheiro';
    let restanteAbono = Number(valor);
    let totalPago = 0;

    for (const conta of contasRes.rows) {
      if (restanteAbono <= 0) break;
      const deveNaConta = Number(conta.valor) - Number(conta.valor_pago);
      const pagar = Math.min(restanteAbono, deveNaConta);
      const novoPago = Math.round((Number(conta.valor_pago) + pagar) * 100) / 100;
      const status = novoPago >= Number(conta.valor) - 0.01 ? 'pago' : 'aberto';
      await client.query(
        `UPDATE contas_receber SET valor_pago = $1, status = $2 WHERE id = $3`,
        [novoPago, status, conta.id]
      );
      restanteAbono = Math.round((restanteAbono - pagar) * 100) / 100;
      totalPago = Math.round((totalPago + pagar) * 100) / 100;
    }

    if (totalPago > 0) {
      await client.query(
        `INSERT INTO movimentos_caixa (caixa_id, tipo, valor, motivo, forma_pagamento)
         VALUES ($1, 'suprimento', $2, $3, $4)`,
        [caixa.rows[0].id, totalPago, `Abono fiado — ${nomeCliente}`, forma]
      );
    }

    await client.query('COMMIT');
    res.json({ ok: true, pago: totalPago, troco: Math.max(0, Number(valor) - totalPago) });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erro ao registrar abono' });
  } finally {
    client.release();
  }
});

export default router;
