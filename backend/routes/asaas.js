import express from 'express';
import asaas from '../utils/asaasClient.js';
import { query } from '../db/connection.js';
import auth from '../middlewares/auth.js';
import { enviarEmailBoasVindas } from '../utils/email.js';

const router = express.Router();

const VALOR_ASSINATURA = Number(process.env.ASAAS_VALOR_ASSINATURA || 49.9);

// Prefixo usado no externalReference do Asaas para isolar este SaaS dos demais
// que compartilham a MESMA conta Asaas. Todo customer/subscription criado aqui
// é marcado, e o webhook ignora qualquer evento que não tenha este prefixo.
const APP_TAG = 'borracharia';
const refDoTenant = (tenantId) => `${APP_TAG}:${tenantId}`;

// Data de vencimento da primeira cobrança (amanhã)
function proximoVencimento() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// POST /api/asaas/criar-cliente
// Cria (ou reaproveita) o customer no Asaas para o tenant logado.
router.post('/criar-cliente', auth, async (req, res) => {
  try {
    const tRes = await query('SELECT * FROM tenants WHERE id = $1', [req.user.tenant_id]);
    if (tRes.rows.length === 0) return res.status(404).json({ error: 'Tenant não encontrado' });
    const tenant = tRes.rows[0];

    if (tenant.asaas_customer_id) {
      return res.json({ customerId: tenant.asaas_customer_id });
    }

    const { cpfCnpj, phone } = req.body;
    // Salva o documento no tenant se veio no body (e ainda não tinha)
    const docFinal = cpfCnpj?.replace(/\D/g, '') || tenant.documento?.replace(/\D/g, '') || undefined;
    if (cpfCnpj && !tenant.documento) {
      await query('UPDATE tenants SET documento = $1 WHERE id = $2', [cpfCnpj.trim(), tenant.id]);
    }

    const { data } = await asaas.post('/customers', {
      name: tenant.nome,
      email: tenant.email,
      cpfCnpj: docFinal || undefined,
      mobilePhone: phone || tenant.telefone || undefined,
      externalReference: refDoTenant(tenant.id),
    });

    await query('UPDATE tenants SET asaas_customer_id = $1 WHERE id = $2', [
      data.id,
      tenant.id,
    ]);

    res.json({ customerId: data.id });
  } catch (err) {
    const detalhe = err.response?.data?.errors?.[0]?.description
      || err.response?.data?.errors?.[0]?.code
      || JSON.stringify(err.response?.data)
      || err.message;
    console.error('Erro criar-cliente Asaas:', detalhe);
    res.status(500).json({ error: `Erro ao criar cliente no Asaas: ${detalhe}` });
  }
});

// POST /api/asaas/criar-assinatura
// Cria a assinatura mensal e devolve o link de pagamento.
router.post('/criar-assinatura', auth, async (req, res) => {
  try {
    const tRes = await query('SELECT * FROM tenants WHERE id = $1', [req.user.tenant_id]);
    if (tRes.rows.length === 0) return res.status(404).json({ error: 'Tenant não encontrado' });
    const tenant = tRes.rows[0];

    if (!tenant.asaas_customer_id) {
      return res.status(400).json({ error: 'Crie o cliente no Asaas primeiro' });
    }

    const billingType = req.body.billingType || 'UNDEFINED'; // UNDEFINED = cliente escolhe

    const { data: sub } = await asaas.post('/subscriptions', {
      customer: tenant.asaas_customer_id,
      billingType,
      value: VALOR_ASSINATURA,
      nextDueDate: proximoVencimento(),
      cycle: 'MONTHLY',
      description: `Assinatura mensal - Sistema Borracharia (${tenant.nome})`,
      externalReference: refDoTenant(tenant.id),
    });

    // Busca a primeira cobrança da assinatura para pegar o link de pagamento
    let paymentLink = null;
    try {
      const { data: pagamentos } = await asaas.get(`/payments?subscription=${sub.id}`);
      const primeira = pagamentos.data?.[0];
      paymentLink = primeira?.invoiceUrl || primeira?.bankSlipUrl || null;
    } catch (e) {
      console.warn('Não foi possível obter o link de pagamento imediatamente.');
    }

    await query(
      `UPDATE tenants SET asaas_subscription_id = $1, asaas_payment_link = $2 WHERE id = $3`,
      [sub.id, paymentLink, tenant.id]
    );

    res.json({ subscriptionId: sub.id, paymentLink });
  } catch (err) {
    console.error('Erro criar-assinatura Asaas:', err.response?.data || err.message);
    res.status(500).json({ error: 'Erro ao criar assinatura no Asaas' });
  }
});

// GET /api/asaas/status — status do plano do tenant logado
router.get('/status', auth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT status, asaas_subscription_id, asaas_payment_link, documento
       FROM tenants WHERE id = $1`,
      [req.user.tenant_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Tenant não encontrado' });
    res.json({
      status: rows[0].status,
      subscriptionId: rows[0].asaas_subscription_id,
      paymentLink: rows[0].asaas_payment_link,
      temDocumento: !!rows[0].documento,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar status' });
  }
});

// POST /api/asaas/webhook
// Recebe notificações do Asaas. Valida pelo header asaas-access-token.
router.post('/webhook', async (req, res) => {
  const token = req.headers['asaas-access-token'];
  if (process.env.ASAAS_WEBHOOK_TOKEN && token !== process.env.ASAAS_WEBHOOK_TOKEN) {
    return res.status(401).json({ error: 'Token de webhook inválido' });
  }

  const { event, payment, subscription } = req.body;

  try {
    // ISOLAMENTO MULTI-SAAS: a mesma conta Asaas atende outros produtos, então
    // este webhook recebe eventos de todos. Só processamos os que foram marcados
    // com o nosso externalReference ("borracharia:<tenant_id>"). Qualquer evento
    // de outro SaaS (prefixo diferente ou sem externalReference) é ignorado.
    const externalReference =
      payment?.externalReference || subscription?.externalReference || '';

    if (!externalReference.startsWith(`${APP_TAG}:`)) {
      return res.json({ received: true, ignored: 'evento de outro produto' });
    }

    const tenantIdRef = externalReference.split(':')[1];

    // Descobre o customer afetado (pagamento ou assinatura)
    const customerId = payment?.customer || subscription?.customer;
    const subscriptionId = payment?.subscription || subscription?.id;

    let novoStatus = null;
    switch (event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        novoStatus = 'ativo';
        break;
      case 'PAYMENT_OVERDUE':
      case 'SUBSCRIPTION_DELETED':
        novoStatus = 'bloqueado';
        break;
      default:
        // Evento não tratado — apenas confirma o recebimento
        return res.json({ received: true, ignored: event });
    }

    // Atualiza o tenant correspondente. O externalReference é a fonte mais
    // confiável; caímos para subscription/customer apenas como fallback.
    if (tenantIdRef) {
      const { rows: updated } = await query(
        'UPDATE tenants SET status = $1 WHERE id = $2 RETURNING nome, email, status',
        [novoStatus, tenantIdRef]
      );
      if (novoStatus === 'ativo' && updated.length > 0) {
        const t = updated[0];
        const u = await query('SELECT nome FROM usuarios WHERE tenant_id = $1 AND role = $2 LIMIT 1', [tenantIdRef, 'admin']);
        const nomeAdmin = u.rows[0]?.nome || t.nome;
        enviarEmailBoasVindas(t.email, nomeAdmin, t.nome).catch(() => {});
      }
    } else if (subscriptionId) {
      await query('UPDATE tenants SET status = $1 WHERE asaas_subscription_id = $2', [
        novoStatus,
        subscriptionId,
      ]);
    } else if (customerId) {
      await query('UPDATE tenants SET status = $1 WHERE asaas_customer_id = $2', [
        novoStatus,
        customerId,
      ]);
    }

    res.json({ received: true, event, novoStatus });
  } catch (err) {
    console.error('Erro no webhook Asaas:', err);
    // Retorna 200 mesmo em erro interno para o Asaas não re-enfileirar infinitamente,
    // mas loga para investigação. Ajuste conforme sua política de retry.
    res.status(200).json({ received: true, error: 'erro interno' });
  }
});

export default router;
