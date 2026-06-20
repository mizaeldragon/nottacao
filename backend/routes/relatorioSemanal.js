import express from 'express';
import { query } from '../db/connection.js';
import auth from '../middlewares/auth.js';
import plano from '../middlewares/plano.js';
import { semanaAtual, coletarDados, chamarIA, gerarParaTenant } from '../utils/gerarRelatorio.js';

const router = express.Router();
router.use(auth, plano);

// GET /api/relatorio-semanal — relatório atual (se já gerado)
router.get('/', async (req, res) => {
  const tenant = req.user.tenant_id;
  const { inicio } = semanaAtual();
  try {
    const { rows } = await query(
      `SELECT * FROM relatorios_semanais WHERE tenant_id = $1 AND semana_inicio = $2`,
      [tenant, inicio]
    );
    res.json(rows.length === 0 ? null : rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar relatório' });
  }
});

// POST /api/relatorio-semanal/gerar — gera ou regenera
router.post('/gerar', async (req, res) => {
  const tenant = req.user.tenant_id;
  const { inicio, fim } = semanaAtual();
  try {
    const relatorio = await gerarParaTenant(tenant, inicio, fim);
    res.json(relatorio);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Erro ao gerar relatório' });
  }
});

// GET /api/relatorio-semanal/historico — últimos 8 relatórios
router.get('/historico', async (req, res) => {
  const tenant = req.user.tenant_id;
  try {
    const { rows } = await query(
      `SELECT id, semana_inicio, semana_fim, dados, ia_resumo, ia_destaques, ia_atencao, ia_sugestao, gerado_em
       FROM relatorios_semanais WHERE tenant_id = $1
       ORDER BY semana_inicio DESC LIMIT 8`,
      [tenant]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
});

export default router;
