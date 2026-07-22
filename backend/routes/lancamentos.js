import express from 'express';
import pool, { query } from '../db/connection.js';
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
  const { funcionario_id, tipo_servico_id, nome_servico, valor, cliente_nome, cliente_id, veiculo, placa, forma_pagamento, pagamentos, produtos } =
    req.body;

  if (!funcionario_id) return res.status(400).json({ error: 'Funcionário é obrigatório' });
  if (!valor || Number(valor) <= 0) return res.status(400).json({ error: 'Valor inválido' });
  const FORMAS_VALIDAS = ['pix', 'cartao_credito', 'cartao_debito', 'dinheiro', 'misto', 'fiado'];
  const forma = FORMAS_VALIDAS.includes(forma_pagamento) ? forma_pagamento : null;
  const eFiado = forma === 'fiado';
  if (eFiado && !cliente_id) return res.status(400).json({ error: 'Selecione o cliente fiado' });
  const pagamentosJson = forma === 'misto' && Array.isArray(pagamentos) ? JSON.stringify(pagamentos) : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fiado não exige caixa aberto (dinheiro não entra agora)
    const caixaRes = await client.query(
      `SELECT id FROM caixa_dia WHERE tenant_id = $1 AND status = 'aberto' LIMIT 1`,
      [req.user.tenant_id]
    );
    if (!eFiado && caixaRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Abra o caixa antes de lançar serviços' });
    }
    const caixaId = caixaRes.rows[0]?.id || null;

    // Resolve nome + percentual a partir do tipo de serviço (padrão 50/50)
    let nomeFinal = nome_servico;
    let percentualFunc = 50;
    if (tipo_servico_id) {
      const t = await client.query(
        `SELECT nome, percentual_funcionario FROM tipos_servico WHERE id = $1 AND tenant_id = $2`,
        [tipo_servico_id, req.user.tenant_id]
      );
      if (t.rows.length > 0) {
        if (!nomeFinal) nomeFinal = t.rows[0].nome;
        percentualFunc = Number(t.rows[0].percentual_funcionario);
      }
    }

    const total = Number(valor);
    const valorFuncionario = Math.round(total * (percentualFunc / 100) * 100) / 100;
    const valorPatrao = Math.round((total - valorFuncionario) * 100) / 100;

    // Resolve cliente fiado
    let nomeCliente = cliente_nome?.trim() || null;
    let clienteIdValido = null;
    if (cliente_id) {
      const cl = await client.query(
        `SELECT id, nome FROM clientes WHERE id = $1 AND tenant_id = $2 AND ativo = true`,
        [cliente_id, req.user.tenant_id]
      );
      if (cl.rows.length > 0) {
        clienteIdValido = cl.rows[0].id;
        if (!nomeCliente) nomeCliente = cl.rows[0].nome;
      }
    }

    // Valida produtos antecipadamente (antes de gravar qualquer coisa)
    const itensProduto = [];
    if (Array.isArray(produtos) && produtos.length > 0) {
      for (const item of produtos) {
        const qtd = parseInt(item.quantidade, 10) || 1;
        const pr = await client.query(
          `SELECT * FROM produtos WHERE id = $1 AND tenant_id = $2 AND ativo = true FOR UPDATE`,
          [item.produto_id, req.user.tenant_id]
        );
        if (pr.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: `Produto não encontrado` });
        }
        const prod = pr.rows[0];
        if (qtd > prod.quantidade) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Estoque insuficiente de ${prod.nome} (disponível: ${prod.quantidade})` });
        }
        itensProduto.push({ prod, qtd, unit: Number(item.preco_venda ?? prod.preco_venda) });
      }
    }

    // Cria o lançamento do serviço
    const lancRes = await client.query(
      `INSERT INTO lancamentos
        (tenant_id, caixa_id, funcionario_id, tipo_servico_id, nome_servico,
         cliente_id, cliente_nome, veiculo, placa, forma_pagamento, pagamentos,
         valor, valor_funcionario, valor_patrao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [
        req.user.tenant_id, caixaId, funcionario_id,
        tipo_servico_id || null, nomeFinal || 'Serviço',
        clienteIdValido, nomeCliente,
        veiculo?.trim() || null, placa?.trim()?.toUpperCase() || null,
        forma, pagamentosJson, total, valorFuncionario, valorPatrao,
      ]
    );
    const lancamento = lancRes.rows[0];

    // Fiado do serviço → conta a receber
    if (eFiado && clienteIdValido) {
      await client.query(
        `INSERT INTO contas_receber (tenant_id, cliente_id, lancamento_id, descricao, valor)
         VALUES ($1,$2,$3,$4,$5)`,
        [req.user.tenant_id, clienteIdValido, lancamento.id,
         `Serviço fiado: ${nomeFinal || 'Serviço'}`, total]
      );
    }

    // Processa produtos vendidos junto com o serviço
    if (itensProduto.length > 0) {
      const totalProdutos = Math.round(
        itensProduto.reduce((s, i) => s + i.unit * i.qtd, 0) * 100
      ) / 100;

      // Cria venda vinculada ao lançamento.
      // Misto cobre só o valor do serviço (UI); produtos entram como dinheiro para o por_forma.
      const formaProdutos = !eFiado
        ? (forma === 'misto' || !forma ? 'dinheiro' : forma)
        : null;
      const vendaRes = await client.query(
        `INSERT INTO vendas (tenant_id, caixa_id, usuario_id, cliente_id, fiado, total, pagamentos, lancamento_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [
          req.user.tenant_id, eFiado ? null : caixaId, req.user.id,
          clienteIdValido, eFiado, totalProdutos,
          formaProdutos ? JSON.stringify([{ forma: formaProdutos, valor: totalProdutos }]) : null,
          lancamento.id,
        ]
      );
      const vendaId = vendaRes.rows[0].id;

      for (const { prod, qtd, unit } of itensProduto) {
        const subtotal = Math.round(unit * qtd * 100) / 100;
        await client.query(
          `UPDATE produtos SET quantidade = quantidade - $1 WHERE id = $2`,
          [qtd, prod.id]
        );
        await client.query(
          `INSERT INTO movimentos_estoque
             (tenant_id, produto_id, caixa_id, venda_id, usuario_id, tipo, quantidade, valor_unitario, valor_total, motivo)
           VALUES ($1,$2,$3,$4,$5,'saida',$6,$7,$8,'venda')`,
          [req.user.tenant_id, prod.id, eFiado ? null : caixaId, vendaId,
           req.user.id, qtd, unit, subtotal]
        );
      }

      // Fiado dos produtos → conta a receber separada (vinculada à venda e ao serviço)
      if (eFiado && clienteIdValido) {
        await client.query(
          `INSERT INTO contas_receber (tenant_id, cliente_id, venda_id, lancamento_id, descricao, valor)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [req.user.tenant_id, clienteIdValido, vendaId, lancamento.id,
           `Produtos fiado: ${itensProduto.map((i) => i.prod.nome).join(', ')}`,
           totalProdutos]
        );
      }

      lancamento.produtos_venda = itensProduto.map((i) => ({
        nome: i.prod.nome, quantidade: i.qtd, preco: i.unit,
        total: Math.round(i.unit * i.qtd * 100) / 100,
      }));
    }

    const func = await client.query(`SELECT nome FROM funcionarios WHERE id = $1`, [funcionario_id]);
    lancamento.funcionario_nome = func.rows[0]?.nome || null;

    await client.query('COMMIT');
    res.status(201).json(lancamento);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erro ao lançar serviço' });
  } finally {
    client.release();
  }
});

// DELETE /api/lancamentos/:id — exclui o serviço e desfaz tudo que ele gerou:
// cancela conta a receber (fiado) ainda não paga e devolve ao estoque os produtos
// vendidos junto. Se já existe pagamento de fiado registrado, bloqueia a exclusão
// (a divergência teria que ser resolvida à mão, não silenciosamente).
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const lancRes = await client.query(
      `SELECT * FROM lancamentos WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
      [req.params.id, req.user.tenant_id]
    );
    if (lancRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Não encontrado' });
    }
    const lancamento = lancRes.rows[0];

    const vendasRes = await client.query(
      `SELECT * FROM vendas WHERE lancamento_id = $1 FOR UPDATE`,
      [lancamento.id]
    );
    const vendaIds = vendasRes.rows.map((v) => v.id);

    const contasRes = await client.query(
      vendaIds.length > 0
        ? `SELECT * FROM contas_receber WHERE lancamento_id = $1 OR venda_id = ANY($2::uuid[]) FOR UPDATE`
        : `SELECT * FROM contas_receber WHERE lancamento_id = $1 FOR UPDATE`,
      vendaIds.length > 0 ? [lancamento.id, vendaIds] : [lancamento.id]
    );

    const contaComPagamento = contasRes.rows.find((c) => Number(c.valor_pago) > 0);
    if (contaComPagamento) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Esse serviço já tem pagamento de fiado recebido do cliente. Não é possível excluir direto — acerte a conta do cliente antes.',
      });
    }

    for (const conta of contasRes.rows) {
      await client.query(`DELETE FROM contas_receber WHERE id = $1`, [conta.id]);
    }

    for (const venda of vendasRes.rows) {
      const movs = await client.query(
        `SELECT * FROM movimentos_estoque WHERE venda_id = $1`,
        [venda.id]
      );
      for (const m of movs.rows) {
        if (m.tipo === 'saida') {
          await client.query(
            `UPDATE produtos SET quantidade = quantidade + $1 WHERE id = $2`,
            [m.quantidade, m.produto_id]
          );
        }
        await client.query(`DELETE FROM movimentos_estoque WHERE id = $1`, [m.id]);
      }
      await client.query(`DELETE FROM vendas WHERE id = $1`, [venda.id]);
    }

    await client.query(`DELETE FROM lancamentos WHERE id = $1`, [lancamento.id]);

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir lançamento' });
  } finally {
    client.release();
  }
});

export default router;
