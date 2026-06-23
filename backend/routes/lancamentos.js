import express from 'express';
import { query } from '../db/connection.js';
import auth from '../middlewares/auth.js';
import plano from '../middlewares/plano.js';

const router = express.Router();

router.use(auth, plano);

// GET /api/lancamentos — serviços do caixa aberto (dia atual)
router.get('/', async (req, res) => {
  try {
    const caixa = await query(
      `SELECT id FROM caixa_dia WHERE tenant_id = $1 AND status = 'aberto' LIMIT 1`,
      [req.user.tenant_id]
    );
    if (caixa.rows.length === 0) return res.json([]);

    const { rows } = await query(
      `SELECT l.*, f.nome AS funcionario_nome
       FROM lancamentos l
       LEFT JOIN funcionarios f ON f.id = l.funcionario_id
       WHERE l.caixa_id = $1
       ORDER BY l.created_at DESC`,
      [caixa.rows[0].id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar lançamentos' });
  }
});

// POST /api/lancamentos — lança um serviço (divisão pelo percentual do tipo, padrão 50/50)
router.post('/', async (req, res) => {
  const { funcionario_id, tipo_servico_id, nome_servico, valor, cliente_nome, cliente_id, veiculo, placa, forma_pagamento, pagamentos } =
    req.body;

  if (!funcionario_id) return res.status(400).json({ error: 'Funcionário é obrigatório' });
  if (!valor || Number(valor) <= 0) return res.status(400).json({ error: 'Valor inválido' });
  const FORMAS_VALIDAS = ['pix', 'cartao', 'dinheiro', 'misto'];
  const forma = FORMAS_VALIDAS.includes(forma_pagamento) ? forma_pagamento : null;
  const pagamentosJson = forma === 'misto' && Array.isArray(pagamentos) ? JSON.stringify(pagamentos) : null;

  try {
    // Precisa de um caixa aberto
    const caixa = await query(
      `SELECT id FROM caixa_dia WHERE tenant_id = $1 AND status = 'aberto' LIMIT 1`,
      [req.user.tenant_id]
    );
    if (caixa.rows.length === 0) {
      return res.status(400).json({ error: 'Abra o caixa antes de lançar serviços' });
    }

    // Resolve nome + percentual do funcionário a partir do tipo de serviço.
    // Serviço avulso (sem tipo) cai no padrão 50/50.
    let nomeFinal = nome_servico;
    let percentualFunc = 50;
    if (tipo_servico_id) {
      const t = await query(
        `SELECT nome, percentual_funcionario FROM tipos_servico
         WHERE id = $1 AND tenant_id = $2`,
        [tipo_servico_id, req.user.tenant_id]
      );
      if (t.rows.length > 0) {
        if (!nomeFinal) nomeFinal = t.rows[0].nome;
        percentualFunc = Number(t.rows[0].percentual_funcionario);
      }
    }

    // Divisão configurável por tipo de serviço (percentual do funcionário).
    const total = Number(valor);
    const valorFuncionario = Math.round(total * (percentualFunc / 100) * 100) / 100;
    const valorPatrao = Math.round((total - valorFuncionario) * 100) / 100;

    // Se veio cliente_id, busca o nome do cadastro
    let nomeCliente = cliente_nome?.trim() || null;
    let clienteIdValido = null;
    if (cliente_id) {
      const cl = await query(
        `SELECT id, nome FROM clientes WHERE id = $1 AND tenant_id = $2 AND ativo = true`,
        [cliente_id, req.user.tenant_id]
      );
      if (cl.rows.length > 0) {
        clienteIdValido = cl.rows[0].id;
        if (!nomeCliente) nomeCliente = cl.rows[0].nome;
      }
    }

    const { rows } = await query(
      `INSERT INTO lancamentos
        (tenant_id, caixa_id, funcionario_id, tipo_servico_id, nome_servico,
         cliente_id, cliente_nome, veiculo, placa, forma_pagamento, pagamentos,
         valor, valor_funcionario, valor_patrao)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [
        req.user.tenant_id,
        caixa.rows[0].id,
        funcionario_id,
        tipo_servico_id || null,
        nomeFinal || 'Serviço',
        clienteIdValido,
        nomeCliente,
        veiculo?.trim() || null,
        placa?.trim()?.toUpperCase() || null,
        forma,
        pagamentosJson,
        total,
        valorFuncionario,
        valorPatrao,
      ]
    );

    // Retorna já com o nome do funcionário para exibir no card
    const func = await query(`SELECT nome FROM funcionarios WHERE id = $1`, [funcionario_id]);
    const lanc = rows[0];
    lanc.funcionario_nome = func.rows[0]?.nome || null;

    res.status(201).json(lanc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao lançar serviço' });
  }
});

// DELETE /api/lancamentos/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `DELETE FROM lancamentos WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [req.params.id, req.user.tenant_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Não encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir lançamento' });
  }
});

export default router;
