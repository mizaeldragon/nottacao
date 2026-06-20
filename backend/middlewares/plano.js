import { query } from '../db/connection.js';

// Bloqueia o acesso de tenants sem plano ativo.
// Deve ser usado SEMPRE depois do middleware de auth.
export default async function plano(req, res, next) {
  try {
    const { rows } = await query('SELECT status FROM tenants WHERE id = $1', [
      req.user.tenant_id,
    ]);

    if (rows.length === 0) {
      return res.status(403).json({ error: 'Tenant não encontrado' });
    }

    const status = rows[0].status;
    if (status !== 'ativo') {
      return res.status(402).json({
        error: 'Plano inativo',
        status,
        message:
          'Sua assinatura está pendente ou bloqueada. Regularize o pagamento para continuar.',
      });
    }

    next();
  } catch (err) {
    console.error('Erro no middleware de plano:', err);
    res.status(500).json({ error: 'Erro ao verificar plano' });
  }
}
