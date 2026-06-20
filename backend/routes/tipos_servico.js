import express from 'express';
import { query } from '../db/connection.js';
import auth from '../middlewares/auth.js';
import plano from '../middlewares/plano.js';

const router = express.Router();

router.use(auth, plano);

// Normaliza o percentual do funcionário para um número entre 0 e 100.
// Retorna null quando o valor é inválido (para sinalizar erro ao chamador).
function normalizarPercentual(valor) {
  if (valor === undefined || valor === null || valor === '') return 50;
  const n = Number(valor);
  if (Number.isNaN(n) || n < 0 || n > 100) return null;
  return n;
}

// GET /api/tipos-servico
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, nome, valor_padrao, percentual_funcionario, ativo FROM tipos_servico
       WHERE tenant_id = $1 ORDER BY nome`,
      [req.user.tenant_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar tipos de serviço' });
  }
});

// POST /api/tipos-servico
router.post('/', async (req, res) => {
  const { nome, valor_padrao, percentual_funcionario } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

  const pct = normalizarPercentual(percentual_funcionario);
  if (pct === null) {
    return res.status(400).json({ error: 'Percentual do funcionário deve ser entre 0 e 100' });
  }

  try {
    const { rows } = await query(
      `INSERT INTO tipos_servico (tenant_id, nome, valor_padrao, percentual_funcionario)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.tenant_id, nome, valor_padrao || 0, pct]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar tipo de serviço' });
  }
});

// PUT /api/tipos-servico/:id
router.put('/:id', async (req, res) => {
  const { nome, valor_padrao, ativo, percentual_funcionario } = req.body;

  // Só valida/atualiza o percentual quando ele veio no corpo; senão mantém o atual.
  let pct = null;
  if (percentual_funcionario !== undefined) {
    const n = Number(percentual_funcionario);
    if (Number.isNaN(n) || n < 0 || n > 100) {
      return res.status(400).json({ error: 'Percentual do funcionário deve ser entre 0 e 100' });
    }
    pct = n;
  }

  try {
    const { rows } = await query(
      `UPDATE tipos_servico SET
         nome = COALESCE($1, nome),
         valor_padrao = COALESCE($2, valor_padrao),
         ativo = COALESCE($3, ativo),
         percentual_funcionario = COALESCE($4, percentual_funcionario)
       WHERE id = $5 AND tenant_id = $6 RETURNING *`,
      [nome, valor_padrao, ativo, pct, req.params.id, req.user.tenant_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar tipo de serviço' });
  }
});

// DELETE /api/tipos-servico/:id — inativa (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE tipos_servico SET ativo = false
       WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [req.params.id, req.user.tenant_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Não encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao remover tipo de serviço' });
  }
});

export default router;
