import express from 'express';
import pool, { query } from '../db/connection.js';
import auth from '../middlewares/auth.js';
import plano from '../middlewares/plano.js';

const router = express.Router();

router.use(auth, plano);

const COLS = `id, nome, categoria, unidade, imagem, preco_venda, preco_custo,
              quantidade, estoque_minimo, ativo, created_at`;

// GET /api/estoque — lista de produtos do tenant (?inativos=1 inclui inativos)
router.get('/', async (req, res) => {
  try {
    const incluirInativos = req.query.inativos === '1' || req.query.inativos === 'true';
    const { rows } = await query(
      `SELECT ${COLS} FROM produtos
       WHERE tenant_id = $1 ${incluirInativos ? '' : 'AND ativo = true'}
       ORDER BY nome`,
      [req.user.tenant_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar produtos' });
  }
});

// GET /api/estoque/alertas — produtos com estoque no/abaixo do mínimo (leve, sem imagem)
router.get('/alertas', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, nome, quantidade, estoque_minimo, unidade
       FROM produtos
       WHERE tenant_id = $1 AND ativo = true AND quantidade <= estoque_minimo
       ORDER BY quantidade ASC, nome`,
      [req.user.tenant_id]
    );
    res.json({ baixo: rows.length, produtos: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar alertas' });
  }
});

// GET /api/estoque/movimentacoes — histórico com filtros
// query: produto_id, tipo (entrada|saida), de (YYYY-MM-DD), ate (YYYY-MM-DD)
router.get('/movimentacoes', async (req, res) => {
  const { produto_id, tipo, de, ate } = req.query;
  const params = [req.user.tenant_id];
  let sql = `
    SELECT m.id, m.tipo, m.quantidade, m.valor_unitario, m.valor_total,
           m.forma_pagamento, m.motivo, m.created_at,
           p.nome AS produto_nome, u.nome AS operador
    FROM movimentos_estoque m
    JOIN produtos p ON p.id = m.produto_id
    LEFT JOIN usuarios u ON u.id = m.usuario_id
    WHERE m.tenant_id = $1`;
  if (produto_id) {
    params.push(produto_id);
    sql += ` AND m.produto_id = $${params.length}`;
  }
  if (tipo === 'entrada' || tipo === 'saida') {
    params.push(tipo);
    sql += ` AND m.tipo = $${params.length}`;
  }
  if (de) {
    params.push(de);
    sql += ` AND m.created_at >= $${params.length}`;
  }
  if (ate) {
    params.push(ate);
    sql += ` AND m.created_at < ($${params.length}::date + INTERVAL '1 day')`;
  }
  sql += ' ORDER BY m.created_at DESC LIMIT 500';
  try {
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao listar movimentações' });
  }
});

// POST /api/estoque — cria um produto (com estoque inicial opcional)
router.post('/', async (req, res) => {
  const { nome, categoria, unidade, imagem, preco_venda, preco_custo, quantidade, estoque_minimo } =
    req.body;
  if (!nome || !nome.trim()) return res.status(400).json({ error: 'Nome é obrigatório' });

  const qtdInicial = Math.max(0, parseInt(quantidade, 10) || 0);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO produtos
         (tenant_id, nome, categoria, unidade, imagem, preco_venda, preco_custo, quantidade, estoque_minimo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${COLS}`,
      [
        req.user.tenant_id,
        nome.trim(),
        categoria?.trim() || null,
        unidade?.trim() || 'Unidade',
        imagem || null,
        Number(preco_venda) || 0,
        Number(preco_custo) || 0,
        qtdInicial,
        Math.max(0, parseInt(estoque_minimo, 10) || 0),
      ]
    );
    const produto = rows[0];

    // Estoque inicial vira uma movimentação de entrada (sem reflexo no caixa)
    if (qtdInicial > 0) {
      await client.query(
        `INSERT INTO movimentos_estoque
           (tenant_id, produto_id, usuario_id, tipo, quantidade, valor_unitario, valor_total, motivo)
         VALUES ($1,$2,$3,'entrada',$4,$5,$6,'estoque inicial')`,
        [
          req.user.tenant_id,
          produto.id,
          req.user.id,
          qtdInicial,
          Number(preco_custo) || 0,
          Math.round((Number(preco_custo) || 0) * qtdInicial * 100) / 100,
        ]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(produto);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar produto' });
  } finally {
    client.release();
  }
});

// PUT /api/estoque/:id — edita dados do produto (não mexe na quantidade)
router.put('/:id', async (req, res) => {
  const { nome, categoria, unidade, imagem, preco_venda, preco_custo, estoque_minimo } = req.body;
  try {
    const { rows } = await query(
      `UPDATE produtos SET
         nome = COALESCE($1, nome),
         categoria = $2,
         unidade = COALESCE($3, unidade),
         imagem = COALESCE($4, imagem),
         preco_venda = COALESCE($5, preco_venda),
         preco_custo = COALESCE($6, preco_custo),
         estoque_minimo = COALESCE($7, estoque_minimo)
       WHERE id = $8 AND tenant_id = $9 RETURNING ${COLS}`,
      [
        nome ?? null,
        categoria?.trim() || null,
        unidade ?? null,
        imagem ?? null,
        preco_venda ?? null,
        preco_custo ?? null,
        estoque_minimo ?? null,
        req.params.id,
        req.user.tenant_id,
      ]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar produto' });
  }
});

// PATCH /api/estoque/:id/ativo — inativa/reativa (soft delete reversível)
router.patch('/:id/ativo', async (req, res) => {
  const ativo = req.body.ativo !== false;
  try {
    const { rows } = await query(
      `UPDATE produtos SET ativo = $1 WHERE id = $2 AND tenant_id = $3 RETURNING ${COLS}`,
      [ativo, req.params.id, req.user.tenant_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar produto' });
  }
});

// DELETE /api/estoque/:id — exclui de vez se não houver histórico; senão inativa
router.delete('/:id', async (req, res) => {
  try {
    const usos = await query(
      `SELECT 1 FROM movimentos_estoque WHERE produto_id = $1 LIMIT 1`,
      [req.params.id]
    );
    if (usos.rows.length > 0) {
      const { rows } = await query(
        `UPDATE produtos SET ativo = false WHERE id = $1 AND tenant_id = $2 RETURNING id`,
        [req.params.id, req.user.tenant_id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Produto não encontrado' });
      return res.json({ ok: true, inativado: true });
    }
    const { rows } = await query(
      `DELETE FROM produtos WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [req.params.id, req.user.tenant_id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json({ ok: true, inativado: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao remover produto' });
  }
});

// POST /api/estoque/:id/movimentar — ajuste manual de estoque
// body: { tipo: 'entrada'|'saida', quantidade, valor_unitario?, motivo?, descontar_caixa? }
//   - entrada (reposição): repõe estoque; se descontar_caixa, SAI dinheiro do caixa
//   - saida (perda/ajuste): só baixa o estoque (não mexe no caixa — venda é pelo PDV)
router.post('/:id/movimentar', async (req, res) => {
  const { tipo, quantidade, valor_unitario, motivo } = req.body;
  const descontarCaixa = tipo === 'entrada' && req.body.descontar_caixa === true;

  if (!['entrada', 'saida'].includes(tipo)) {
    return res.status(400).json({ error: "tipo deve ser 'entrada' ou 'saida'" });
  }
  const qtd = parseInt(quantidade, 10);
  if (!qtd || qtd <= 0) {
    return res.status(400).json({ error: 'Quantidade inválida' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const prodRes = await client.query(
      `SELECT * FROM produtos WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
      [req.params.id, req.user.tenant_id]
    );
    if (prodRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Produto não encontrado' });
    }
    const produto = prodRes.rows[0];

    if (tipo === 'saida' && qtd > produto.quantidade) {
      await client.query('ROLLBACK');
      return res
        .status(400)
        .json({ error: `Estoque insuficiente (disponível: ${produto.quantidade})` });
    }

    const padrao = tipo === 'saida' ? produto.preco_venda : produto.preco_custo;
    const unit =
      valor_unitario !== undefined && valor_unitario !== '' && valor_unitario !== null
        ? Number(valor_unitario)
        : Number(padrao);
    const total = Math.round(unit * qtd * 100) / 100;

    // Só a reposição com "descontar do caixa" reflete no caixa
    let caixaId = null;
    if (descontarCaixa) {
      const caixa = await client.query(
        `SELECT id FROM caixa_dia WHERE tenant_id = $1 AND status = 'aberto' LIMIT 1`,
        [req.user.tenant_id]
      );
      if (caixa.rows.length === 0) {
        await client.query('ROLLBACK');
        return res
          .status(400)
          .json({ error: 'Abra o caixa para registrar a despesa, ou desmarque a opção' });
      }
      caixaId = caixa.rows[0].id;
    }

    const delta = tipo === 'saida' ? -qtd : qtd;
    const novoEstoque = produto.quantidade + delta;
    await client.query(`UPDATE produtos SET quantidade = $1 WHERE id = $2`, [
      novoEstoque,
      produto.id,
    ]);

    const movRes = await client.query(
      `INSERT INTO movimentos_estoque
         (tenant_id, produto_id, caixa_id, usuario_id, tipo, quantidade, valor_unitario, valor_total, motivo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.tenant_id, produto.id, caixaId, req.user.id, tipo, qtd, unit, total, motivo || null]
    );

    await client.query('COMMIT');
    res.status(201).json({
      movimento: movRes.rows[0],
      produto: { ...produto, quantidade: novoEstoque },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erro ao movimentar estoque' });
  } finally {
    client.release();
  }
});

// POST /api/estoque/vender — venda pelo PDV (carrinho com vários itens)
// body: { itens: [{ produto_id, quantidade }], forma_pagamento?, pagamentos? }
//   pagamentos = [{ forma:'pix'|'cartao'|'dinheiro', valor }] para pagamento dividido.
//   Se ausente, usa forma_pagamento único para o total.
//   Baixa o estoque de cada item e ENTRA o total no caixa (exige caixa aberto).
const FORMAS = ['pix', 'cartao', 'dinheiro'];
router.post('/vender', async (req, res) => {
  const { itens, forma_pagamento, fiado, cliente_id } = req.body;
  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ error: 'Carrinho vazio' });
  }
  const ehFiado = fiado === true;
  if (ehFiado && !cliente_id) {
    return res.status(400).json({ error: 'Selecione o cliente para vender no fiado' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fiado não exige caixa aberto (não há dinheiro entrando agora).
    // Venda à vista exige caixa aberto.
    let caixaId = null;
    if (!ehFiado) {
      const caixa = await client.query(
        `SELECT id FROM caixa_dia WHERE tenant_id = $1 AND status = 'aberto' LIMIT 1`,
        [req.user.tenant_id]
      );
      if (caixa.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Abra o caixa antes de vender produtos' });
      }
      caixaId = caixa.rows[0].id;
    }

    // 1ª passada: trava produtos, valida estoque e calcula o total
    let totalVenda = 0;
    const preparados = [];
    for (const item of itens) {
      const qtd = parseInt(item.quantidade, 10);
      if (!qtd || qtd <= 0) continue;

      const prodRes = await client.query(
        `SELECT * FROM produtos WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
        [item.produto_id, req.user.tenant_id]
      );
      if (prodRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Produto não encontrado no carrinho' });
      }
      const produto = prodRes.rows[0];
      if (qtd > produto.quantidade) {
        await client.query('ROLLBACK');
        return res
          .status(400)
          .json({ error: `Estoque insuficiente de ${produto.nome} (disponível: ${produto.quantidade})` });
      }
      const unit = Number(produto.preco_venda);
      const total = Math.round(unit * qtd * 100) / 100;
      totalVenda += total;
      preparados.push({ produto, qtd, unit, total });
    }

    if (preparados.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Carrinho sem itens válidos' });
    }
    totalVenda = Math.round(totalVenda * 100) / 100;

    // Resolve os pagamentos. Fiado: nada é pago agora (vira conta a receber).
    let pagamentos = null;
    let formaMov = null;
    if (!ehFiado) {
      if (Array.isArray(req.body.pagamentos) && req.body.pagamentos.length > 0) {
        pagamentos = req.body.pagamentos
          .map((p) => ({ forma: FORMAS.includes(p.forma) ? p.forma : 'dinheiro', valor: Number(p.valor) || 0 }))
          .filter((p) => p.valor > 0);
        const soma = Math.round(pagamentos.reduce((s, p) => s + p.valor, 0) * 100) / 100;
        if (Math.abs(soma - totalVenda) > 0.01) {
          await client.query('ROLLBACK');
          return res
            .status(400)
            .json({ error: `Soma dos pagamentos (${soma}) difere do total (${totalVenda})` });
        }
      } else {
        const forma = FORMAS.includes(forma_pagamento) ? forma_pagamento : 'dinheiro';
        pagamentos = [{ forma, valor: totalVenda }];
      }
      formaMov = pagamentos.length > 1 ? 'misto' : pagamentos[0].forma;
    } else {
      formaMov = 'fiado';
    }

    // Registra a venda
    const vendaRes = await client.query(
      `INSERT INTO vendas (tenant_id, caixa_id, usuario_id, cliente_id, fiado, total, pagamentos)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        req.user.tenant_id,
        caixaId,
        req.user.id,
        ehFiado ? cliente_id : null,
        ehFiado,
        totalVenda,
        pagamentos ? JSON.stringify(pagamentos) : null,
      ]
    );
    const vendaId = vendaRes.rows[0].id;

    // Fiado: cria a conta a receber
    if (ehFiado) {
      await client.query(
        `INSERT INTO contas_receber (tenant_id, cliente_id, venda_id, descricao, valor)
         VALUES ($1,$2,$3,$4,$5)`,
        [req.user.tenant_id, cliente_id, vendaId, `Venda fiado (${preparados.length} item(ns))`, totalVenda]
      );
    }

    // 2ª passada: baixa estoque e grava os movimentos
    for (const { produto, qtd, unit, total } of preparados) {
      await client.query(`UPDATE produtos SET quantidade = quantidade - $1 WHERE id = $2`, [
        qtd,
        produto.id,
      ]);
      await client.query(
        `INSERT INTO movimentos_estoque
           (tenant_id, produto_id, caixa_id, usuario_id, venda_id, tipo, quantidade, valor_unitario, valor_total, forma_pagamento, motivo)
         VALUES ($1,$2,$3,$4,$5,'saida',$6,$7,$8,$9,'venda')`,
        [req.user.tenant_id, produto.id, caixaId, req.user.id, vendaId, qtd, unit, total, formaMov]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ total: totalVenda, itens: preparados.length, pagamentos, fiado: ehFiado });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erro ao registrar venda' });
  } finally {
    client.release();
  }
});

export default router;
