import express from 'express';
import { query } from '../db/connection.js';
import auth from '../middlewares/auth.js';
import plano from '../middlewares/plano.js';

const router = express.Router();

router.use(auth, plano);

// GET /api/funcionarios — lista funcionários do tenant
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, nome, cargo, ativo, created_at FROM funcionarios
       WHERE tenant_id = $1 ORDER BY nome`,
      [req.user.tenant_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar funcionários' });
  }
});

// POST /api/funcionarios — cria funcionário (sempre divisão 50/50, sem campo de %)
router.post('/', async (req, res) => {
  const { nome, cargo } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

  try {
    const { rows } = await query(
      `INSERT INTO funcionarios (tenant_id, nome, cargo) VALUES ($1, $2, $3) RETURNING *`,
      [req.user.tenant_id, nome, cargo || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar funcionário' });
  }
});

// PUT /api/funcionarios/:id — atualiza nome / ativo
router.put('/:id', async (req, res) => {
  const { nome, cargo, ativo } = req.body;
  try {
    const { rows } = await query(
      `UPDATE funcionarios SET
         nome = COALESCE($1, nome),
         cargo = COALESCE($2, cargo),
         ativo = COALESCE($3, ativo)
       WHERE id = $4 AND tenant_id = $5 RETURNING *`,
      [nome, cargo, ativo, req.params.id, req.user.tenant_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar funcionário' });
  }
});

// DELETE /api/funcionarios/:id — inativa (soft delete para preservar histórico)
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `UPDATE funcionarios SET ativo = false
       WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [req.params.id, req.user.tenant_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Não encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao remover funcionário' });
  }
});

export default router;
