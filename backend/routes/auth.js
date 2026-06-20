import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool, { query } from '../db/connection.js';
import auth from '../middlewares/auth.js';
import adminOnly from '../middlewares/adminOnly.js';
import { enviarEmailResetSenha } from '../utils/email.js';
import asaas from '../utils/asaasClient.js';

const router = express.Router();

// Serviços pré-cadastrados ao criar a conta.
const SERVICOS_PADRAO = [
  'Pavio',
  'Remendo a frio',
  'Remendo a quente',
  'Troca de pneu',
  'Balanceamento',
  'Calibragem',
  'Câmara de ar',
  'Vulcanização',
];

function gerarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, tenant_id: usuario.tenant_id, role: usuario.role },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// POST /api/auth/registro
// Cria tenant (status pendente) + usuário admin + serviços padrão.
router.post('/registro', async (req, res) => {
  const { nome, email, senha, telefone, documento } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
  }

  const client = await pool.connect();
  try {
    // E-mail único entre usuários
    const existe = await client.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (existe.rows.length > 0) {
      return res.status(409).json({ error: 'E-mail já cadastrado' });
    }

    await client.query('BEGIN');

    const tenantRes = await client.query(
      `INSERT INTO tenants (nome, email, telefone, documento, status) VALUES ($1, $2, $3, $4, 'pendente') RETURNING *`,
      [nome, email, telefone?.trim() || null, documento?.trim() || null]
    );
    const tenant = tenantRes.rows[0];

    const senhaHash = await bcrypt.hash(senha, 10);
    const usuarioRes = await client.query(
      `INSERT INTO usuarios (tenant_id, nome, email, senha, role)
       VALUES ($1, $2, $3, $4, 'admin') RETURNING id, tenant_id, nome, email, role`,
      [tenant.id, nome, email, senhaHash]
    );
    const usuario = usuarioRes.rows[0];

    // Serviços pré-cadastrados
    for (const s of SERVICOS_PADRAO) {
      await client.query(
        `INSERT INTO tipos_servico (tenant_id, nome, valor_padrao) VALUES ($1, $2, 0)`,
        [tenant.id, s]
      );
    }

    await client.query('COMMIT');

    // Cria cliente + assinatura no Asaas logo após o registro
    let paymentLink = null;
    try {
      const docLimpo = documento?.replace(/\D/g, '') || undefined;
      const { data: customer } = await asaas.post('/customers', {
        name: nome,
        email,
        cpfCnpj: docLimpo,
        mobilePhone: telefone?.replace(/\D/g, '') || undefined,
        externalReference: `borracharia:${tenant.id}`,
      });
      await query('UPDATE tenants SET asaas_customer_id = $1 WHERE id = $2', [customer.id, tenant.id]);

      const vencimento = new Date();
      vencimento.setDate(vencimento.getDate() + 1);
      const { data: sub } = await asaas.post('/subscriptions', {
        customer: customer.id,
        billingType: 'UNDEFINED',
        value: Number(process.env.ASAAS_VALOR_ASSINATURA || 200),
        nextDueDate: vencimento.toISOString().slice(0, 10),
        cycle: 'MONTHLY',
        description: `Assinatura mensal - Sistema Borracharia (${nome})`,
        externalReference: `borracharia:${tenant.id}`,
      });

      // Busca o link da primeira cobrança
      const { data: pagamentos } = await asaas.get(`/payments?subscription=${sub.id}`);
      const primeira = pagamentos.data?.[0];
      paymentLink = primeira?.invoiceUrl || primeira?.bankSlipUrl || null;

      await query(
        'UPDATE tenants SET asaas_subscription_id = $1, asaas_payment_link = $2 WHERE id = $3',
        [sub.id, paymentLink, tenant.id]
      );
    } catch (asaasErr) {
      console.error('Asaas no registro (não-fatal):', asaasErr.response?.data || asaasErr.message);
    }

    const token = gerarToken(usuario);
    res.status(201).json({
      token,
      usuario,
      tenant: { id: tenant.id, nome: tenant.nome, status: tenant.status },
      paymentLink,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro no registro:', err);
    res.status(500).json({ error: 'Erro ao registrar' });
  } finally {
    client.release();
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios' });
  }

  try {
    const { rows } = await query(
      `SELECT u.*, t.status AS tenant_status, t.nome AS tenant_nome, t.asaas_payment_link
       FROM usuarios u JOIN tenants t ON t.id = u.tenant_id
       WHERE u.email = $1`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const usuario = rows[0];
    const ok = await bcrypt.compare(senha, usuario.senha);
    if (!ok) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = gerarToken(usuario);
    res.json({
      token,
      usuario: {
        id: usuario.id,
        tenant_id: usuario.tenant_id,
        nome: usuario.nome,
        email: usuario.email,
        role: usuario.role,
      },
      tenant: { status: usuario.tenant_status, nome: usuario.tenant_nome, asaas_payment_link: usuario.asaas_payment_link },
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// GET /api/auth/me — dados do usuário logado + status do tenant
router.get('/me', auth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.nome, u.email, u.role, u.tenant_id,
              t.nome AS tenant_nome, t.status AS tenant_status,
              t.asaas_payment_link
       FROM usuarios u JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const u = rows[0];
    res.json({
      usuario: { id: u.id, nome: u.nome, email: u.email, role: u.role, tenant_id: u.tenant_id },
      tenant: {
        nome: u.tenant_nome,
        status: u.tenant_status,
        payment_link: u.asaas_payment_link,
      },
    });
  } catch (err) {
    console.error('Erro no /me:', err);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

// GET /api/auth/conta — dados da empresa + e-mail da conta (para a tela de Ajustes)
router.get('/conta', auth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT u.email,
              t.nome AS empresa_nome, t.telefone, t.documento
       FROM usuarios u JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Conta não encontrada' });
    const c = rows[0];
    res.json({
      email: c.email,
      empresa: {
        nome: c.empresa_nome,
        telefone: c.telefone || '',
        documento: c.documento || '',
      },
    });
  } catch (err) {
    console.error('Erro ao buscar conta:', err);
    res.status(500).json({ error: 'Erro ao buscar dados da conta' });
  }
});

// PUT /api/auth/empresa — atualiza os dados da borracharia
router.put('/empresa', auth, async (req, res) => {
  const { nome, telefone, documento } = req.body;
  if (!nome || !nome.trim()) {
    return res.status(400).json({ error: 'Nome da empresa é obrigatório' });
  }
  try {
    const { rows } = await query(
      `UPDATE tenants
         SET nome = $1, telefone = $2, documento = $3
       WHERE id = $4
       RETURNING nome, telefone, documento`,
      [nome.trim(), telefone || null, documento || null, req.user.tenant_id]
    );
    const t = rows[0];
    res.json({
      empresa: { nome: t.nome, telefone: t.telefone || '', documento: t.documento || '' },
    });
  } catch (err) {
    console.error('Erro ao atualizar empresa:', err);
    res.status(500).json({ error: 'Erro ao atualizar dados da empresa' });
  }
});

// PUT /api/auth/email — troca o e-mail de login (exige a senha atual)
router.put('/email', auth, async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'E-mail inválido' });
  }
  if (!senha) {
    return res.status(400).json({ error: 'Informe a senha atual para confirmar' });
  }

  const novoEmail = email.trim().toLowerCase();
  const client = await pool.connect();
  try {
    const u = await client.query('SELECT senha, tenant_id FROM usuarios WHERE id = $1', [
      req.user.id,
    ]);
    if (u.rows.length === 0) return res.status(404).json({ error: 'Conta não encontrada' });

    const ok = await bcrypt.compare(senha, u.rows[0].senha);
    if (!ok) return res.status(401).json({ error: 'Senha atual incorreta' });

    // E-mail precisa ser único entre usuários
    const existe = await client.query(
      'SELECT id FROM usuarios WHERE email = $1 AND id <> $2',
      [novoEmail, req.user.id]
    );
    if (existe.rows.length > 0) {
      return res.status(409).json({ error: 'E-mail já está em uso' });
    }

    await client.query('BEGIN');
    await client.query('UPDATE usuarios SET email = $1 WHERE id = $2', [novoEmail, req.user.id]);
    // Mantém o e-mail do tenant em sincronia com o login
    await client.query('UPDATE tenants SET email = $1 WHERE id = $2', [
      novoEmail,
      u.rows[0].tenant_id,
    ]);
    await client.query('COMMIT');

    res.json({ email: novoEmail });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao trocar e-mail:', err);
    res.status(500).json({ error: 'Erro ao trocar e-mail' });
  } finally {
    client.release();
  }
});

// PUT /api/auth/senha — troca a senha (exige a senha atual)
router.put('/senha', auth, async (req, res) => {
  const { senha_atual, nova_senha } = req.body;
  if (!senha_atual || !nova_senha) {
    return res.status(400).json({ error: 'Informe a senha atual e a nova senha' });
  }
  if (nova_senha.length < 6) {
    return res.status(400).json({ error: 'A nova senha deve ter ao menos 6 caracteres' });
  }
  try {
    const u = await query('SELECT senha FROM usuarios WHERE id = $1', [req.user.id]);
    if (u.rows.length === 0) return res.status(404).json({ error: 'Conta não encontrada' });

    const ok = await bcrypt.compare(senha_atual, u.rows[0].senha);
    if (!ok) return res.status(401).json({ error: 'Senha atual incorreta' });

    const hash = await bcrypt.hash(nova_senha, 10);
    await query('UPDATE usuarios SET senha = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao trocar senha:', err);
    res.status(500).json({ error: 'Erro ao trocar senha' });
  }
});

// ---------- Gestão de usuários do tenant (somente admin) ----------
// GET /api/auth/usuarios — lista os logins da borracharia
router.get('/usuarios', auth, adminOnly, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, nome, email, role, created_at FROM usuarios
       WHERE tenant_id = $1 ORDER BY role, nome`,
      [req.user.tenant_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
});

// POST /api/auth/usuarios — cria um login (funcionário ou admin)
router.post('/usuarios', auth, adminOnly, async (req, res) => {
  const { nome, email, senha, role } = req.body;
  if (!nome || !email || !senha) {
    return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios' });
  }
  if (senha.length < 6) return res.status(400).json({ error: 'A senha deve ter ao menos 6 caracteres' });
  const papel = role === 'admin' ? 'admin' : 'funcionario';
  const emailNorm = email.trim().toLowerCase();
  try {
    const existe = await query('SELECT id FROM usuarios WHERE email = $1', [emailNorm]);
    if (existe.rows.length > 0) return res.status(409).json({ error: 'E-mail já cadastrado' });

    const hash = await bcrypt.hash(senha, 10);
    const { rows } = await query(
      `INSERT INTO usuarios (tenant_id, nome, email, senha, role)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, nome, email, role, created_at`,
      [req.user.tenant_id, nome.trim(), emailNorm, hash, papel]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

// PUT /api/auth/usuarios/:id — edita nome/role/senha de um usuário do tenant
router.put('/usuarios/:id', auth, adminOnly, async (req, res) => {
  const { nome, role, senha } = req.body;
  const papel = role === 'admin' ? 'admin' : role === 'funcionario' ? 'funcionario' : null;
  try {
    const alvo = await query('SELECT id, role FROM usuarios WHERE id = $1 AND tenant_id = $2', [
      req.params.id,
      req.user.tenant_id,
    ]);
    if (alvo.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });

    const hash = senha ? await bcrypt.hash(senha, 10) : null;
    const { rows } = await query(
      `UPDATE usuarios SET
         nome = COALESCE($1, nome),
         role = COALESCE($2, role),
         senha = COALESCE($3, senha)
       WHERE id = $4 AND tenant_id = $5 RETURNING id, nome, email, role`,
      [nome ?? null, papel, hash, req.params.id, req.user.tenant_id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

// DELETE /api/auth/usuarios/:id — remove um login (não pode remover a si mesmo)
router.delete('/usuarios/:id', auth, adminOnly, async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Você não pode remover a si mesmo' });
  }
  try {
    const { rows } = await query(
      `DELETE FROM usuarios WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [req.params.id, req.user.tenant_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao remover usuário' });
  }
});

// POST /api/auth/esqueci-senha — envia e-mail com link de reset
router.post('/esqueci-senha', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Informe o e-mail' });

  try {
    const { rows } = await query('SELECT id, nome FROM usuarios WHERE email = $1', [email.toLowerCase().trim()]);
    // Responde sempre OK para não vazar se o e-mail existe
    if (rows.length === 0) return res.json({ ok: true });

    const usuario = rows[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await query(
      `INSERT INTO reset_senha (usuario_id, token, expira_em) VALUES ($1, $2, $3)`,
      [usuario.id, token, expira]
    );

    await enviarEmailResetSenha(email, usuario.nome, token);
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro esqueci-senha:', err);
    res.status(500).json({ error: 'Erro ao enviar e-mail' });
  }
});

// POST /api/auth/redefinir-senha — troca a senha pelo token
router.post('/redefinir-senha', async (req, res) => {
  const { token, nova_senha } = req.body;
  if (!token || !nova_senha) return res.status(400).json({ error: 'Dados incompletos' });
  if (nova_senha.length < 6) return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres' });

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT r.id, r.usuario_id FROM reset_senha r
       WHERE r.token = $1 AND r.usado = FALSE AND r.expira_em > NOW()`,
      [token]
    );
    if (rows.length === 0) return res.status(400).json({ error: 'Link inválido ou expirado' });

    const { id: resetId, usuario_id } = rows[0];
    const hash = await bcrypt.hash(nova_senha, 10);

    await client.query('BEGIN');
    await client.query('UPDATE usuarios SET senha = $1 WHERE id = $2', [hash, usuario_id]);
    await client.query('UPDATE reset_senha SET usado = TRUE WHERE id = $1', [resetId]);
    await client.query('COMMIT');

    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro redefinir-senha:', err);
    res.status(500).json({ error: 'Erro ao redefinir senha' });
  } finally {
    client.release();
  }
});

export default router;
