import express from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db/connection.js';

const router = express.Router();

// Credenciais do super-admin (dono do SaaS) — defina no .env em produção.
const SUPER_EMAIL = (process.env.SUPER_ADMIN_EMAIL || 'super@admin.com').toLowerCase();
const SUPER_SENHA = process.env.SUPER_ADMIN_SENHA || 'superadmin';
const VALOR_ASSINATURA = Number(process.env.ASAAS_VALOR_ASSINATURA || 200);

// Middleware: exige um token de super-admin
function superAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token não fornecido' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload.super) return res.status(403).json({ error: 'Acesso negado' });
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// POST /api/admin/login
router.post('/login', (req, res) => {
  const { email, senha } = req.body;
  if ((email || '').trim().toLowerCase() !== SUPER_EMAIL || senha !== SUPER_SENHA) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }
  const token = jwt.sign({ super: true }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

// GET /api/admin/resumo — visão geral do SaaS
router.get('/resumo', superAuth, async (req, res) => {
  try {
    const statusRes = await query(`SELECT status, COUNT(*) AS qtd FROM tenants GROUP BY status`);
    const contagem = { ativo: 0, bloqueado: 0, pendente: 0 };
    for (const r of statusRes.rows) contagem[r.status] = Number(r.qtd);
    const totalTenants = Object.values(contagem).reduce((s, n) => s + n, 0);

    const fat = await query(
      `SELECT
         COALESCE((SELECT SUM(valor) FROM lancamentos), 0)
         + COALESCE((SELECT SUM(valor_total) FROM movimentos_estoque WHERE tipo='saida' AND motivo='venda'), 0)
         AS total`
    );

    res.json({
      total_tenants: totalTenants,
      ativos: contagem.ativo,
      bloqueados: contagem.bloqueado,
      pendentes: contagem.pendente,
      mrr: Math.round(contagem.ativo * VALOR_ASSINATURA * 100) / 100,
      faturamento_clientes: Number(fat.rows[0].total),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao montar resumo' });
  }
});

// GET /api/admin/tenants — todas as borracharias com estatísticas
router.get('/tenants', superAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT t.id, t.nome, t.email, t.telefone, t.status, t.created_at, t.trial_expira_em,
              (SELECT COUNT(*) FROM usuarios u WHERE u.tenant_id = t.id) AS usuarios,
              COALESCE((SELECT SUM(valor) FROM lancamentos WHERE tenant_id = t.id), 0)
              + COALESCE((SELECT SUM(valor_total) FROM movimentos_estoque
                          WHERE tenant_id = t.id AND tipo='saida' AND motivo='venda'), 0) AS faturamento
       FROM tenants t
       ORDER BY t.created_at DESC`
    );
    res.json(
      rows.map((r) => ({
        ...r,
        usuarios: Number(r.usuarios),
        faturamento: Number(r.faturamento),
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar borracharias' });
  }
});

// PATCH /api/admin/tenants/:id/status — ativa (com data de expiração opcional), bloqueia ou pendente
router.patch('/tenants/:id/status', superAuth, async (req, res) => {
  const { id } = req.params;
  const { status, trial_expira_em } = req.body;
  if (!['ativo', 'bloqueado', 'pendente'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }
  try {
    const { rowCount } = await query(
      `UPDATE tenants SET status = $1, trial_expira_em = $2 WHERE id = $3`,
      [status, trial_expira_em || null, id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Borracharia não encontrada' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar status' });
  }
});

// DELETE /api/admin/tenants/:id — exclui tenant (hard delete — cuidado)
router.delete('/tenants/:id', superAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await query(`DELETE FROM tenants WHERE id = $1`, [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Borracharia não encontrada' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir borracharia' });
  }
});

export default router;
