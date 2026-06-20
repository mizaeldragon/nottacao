import OpenAI from 'openai';
import { query } from '../db/connection.js';

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export function semanaAtual() {
  const hoje = new Date();
  const dia = hoje.getDay();
  const seg = new Date(hoje);
  seg.setDate(hoje.getDate() - (dia === 0 ? 6 : dia - 1));
  seg.setHours(0, 0, 0, 0);
  const dom = new Date(seg);
  dom.setDate(seg.getDate() + 6);
  return {
    inicio: seg.toISOString().split('T')[0],
    fim:    dom.toISOString().split('T')[0],
  };
}

export async function coletarDados(tenant, inicio, fim) {
  const totais = await query(
    `SELECT
       COALESCE(SUM(l.valor), 0)     AS fat_servicos,
       COUNT(l.id)                    AS qtd_servicos,
       COALESCE(AVG(l.valor), 0)     AS ticket_medio
     FROM lancamentos l
     JOIN caixa_dia c ON c.id = l.caixa_id
     WHERE l.tenant_id = $1 AND c.data BETWEEN $2 AND $3`,
    [tenant, inicio, fim]
  );

  const pdv = await query(
    `SELECT
       COALESCE(SUM(me.valor_total), 0) AS fat_pdv,
       COUNT(DISTINCT me.venda_id)       AS qtd_vendas
     FROM movimentos_estoque me
     JOIN caixa_dia c ON c.id = me.caixa_id
     WHERE me.tenant_id = $1 AND me.tipo = 'saida' AND me.motivo = 'venda'
       AND c.data BETWEEN $2 AND $3`,
    [tenant, inicio, fim]
  );

  const porDia = await query(
    `WITH dias AS (
       SELECT generate_series($2::date, $3::date, '1 day')::date AS dia
     )
     SELECT d.dia,
       COALESCE((SELECT SUM(l.valor) FROM lancamentos l JOIN caixa_dia c ON c.id = l.caixa_id
                 WHERE l.tenant_id = $1 AND c.data = d.dia), 0)
       + COALESCE((SELECT SUM(me.valor_total) FROM movimentos_estoque me JOIN caixa_dia c ON c.id = me.caixa_id
                   WHERE me.tenant_id = $1 AND me.tipo='saida' AND me.motivo='venda' AND c.data = d.dia), 0)
       AS total
     FROM dias d ORDER BY d.dia`,
    [tenant, inicio, fim]
  );

  const topServicos = await query(
    `SELECT COALESCE(ts.nome, 'Serviço avulso') AS nome,
            COUNT(*) AS qtd, SUM(l.valor) AS total
     FROM lancamentos l
     LEFT JOIN tipos_servico ts ON ts.id = l.tipo_servico_id
     JOIN caixa_dia c ON c.id = l.caixa_id
     WHERE l.tenant_id = $1 AND c.data BETWEEN $2 AND $3
     GROUP BY ts.nome ORDER BY total DESC LIMIT 5`,
    [tenant, inicio, fim]
  );

  const topFunc = await query(
    `SELECT f.nome, COUNT(*) AS qtd,
            SUM(l.valor) AS total, SUM(l.valor_funcionario) AS comissao
     FROM lancamentos l
     JOIN funcionarios f ON f.id = l.funcionario_id
     JOIN caixa_dia c ON c.id = l.caixa_id
     WHERE l.tenant_id = $1 AND c.data BETWEEN $2 AND $3
     GROUP BY f.nome ORDER BY total DESC`,
    [tenant, inicio, fim]
  );

  const inicioAnt = new Date(inicio);
  inicioAnt.setDate(inicioAnt.getDate() - 7);
  const fimAnt = new Date(fim);
  fimAnt.setDate(fimAnt.getDate() - 7);
  const ant = await query(
    `SELECT COALESCE(SUM(l.valor), 0) AS fat
     FROM lancamentos l JOIN caixa_dia c ON c.id = l.caixa_id
     WHERE l.tenant_id = $1 AND c.data BETWEEN $2 AND $3`,
    [tenant, inicioAnt.toISOString().split('T')[0], fimAnt.toISOString().split('T')[0]]
  );

  const fatServicos = Number(totais.rows[0].fat_servicos);
  const fatPdv      = Number(pdv.rows[0].fat_pdv);
  const fatAnt      = Number(ant.rows[0].fat);
  const variacao    = fatAnt > 0 ? ((fatServicos + fatPdv - fatAnt) / fatAnt * 100).toFixed(1) : null;

  return {
    semana_inicio: inicio,
    semana_fim:    fim,
    fat_servicos:  fatServicos,
    fat_pdv:       fatPdv,
    fat_total:     fatServicos + fatPdv,
    qtd_servicos:  Number(totais.rows[0].qtd_servicos),
    qtd_vendas:    Number(pdv.rows[0].qtd_vendas),
    ticket_medio:  Number(totais.rows[0].ticket_medio),
    variacao_pct:  variacao,
    fat_semana_ant: fatAnt,
    por_dia:       porDia.rows.map(r => ({ dia: r.dia, total: Number(r.total) })),
    top_servicos:  topServicos.rows.map(r => ({ nome: r.nome, qtd: Number(r.qtd), total: Number(r.total) })),
    top_funcionarios: topFunc.rows.map(r => ({
      nome: r.nome, qtd: Number(r.qtd),
      total: Number(r.total), comissao: Number(r.comissao),
    })),
  };
}

export async function chamarIA(dados) {
  const fmt = (v) => `R$ ${Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  const diasNomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const prompt = `
Você é um consultor de negócios especializado em borracharias brasileiras.
Analise os dados abaixo e gere um relatório semanal em JSON, em português brasileiro, com tom direto e útil para o dono do negócio.

Semana: ${dados.semana_inicio} a ${dados.semana_fim}
Faturamento serviços: ${fmt(dados.fat_servicos)}
Faturamento PDV (produtos): ${fmt(dados.fat_pdv)}
Faturamento total: ${fmt(dados.fat_total)}
Serviços realizados: ${dados.qtd_servicos}
Vendas PDV: ${dados.qtd_vendas}
Ticket médio: ${fmt(dados.ticket_medio)}
Variação vs semana anterior: ${dados.variacao_pct !== null ? dados.variacao_pct + '%' : 'sem dados anteriores'}

Faturamento por dia:
${dados.por_dia.map(d => {
  const dt = new Date(String(d.dia).substring(0, 10) + 'T12:00:00');
  return `- ${diasNomes[dt.getDay()]} ${dt.getDate()}/${dt.getMonth()+1}: ${fmt(d.total)}`;
}).join('\n')}

Top serviços:
${dados.top_servicos.map(s => `- ${s.nome}: ${s.qtd}x, ${fmt(s.total)}`).join('\n')}

Top funcionários:
${dados.top_funcionarios.map(f => `- ${f.nome}: ${f.qtd} serviços, ${fmt(f.total)} faturado, ${fmt(f.comissao)} de comissão`).join('\n')}

Retorne APENAS um JSON com exatamente esta estrutura (sem markdown, sem explicações):
{
  "resumo": "2-3 frases resumindo a semana de forma direta",
  "destaques": ["destaque positivo 1", "destaque positivo 2", "destaque positivo 3"],
  "atencao": ["ponto de atenção 1"],
  "sugestao": "Uma ação concreta e específica para a próxima semana"
}`;

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });

  return JSON.parse(completion.choices[0].message.content);
}

// Gera o relatório de um tenant específico e salva/atualiza no banco
export async function gerarParaTenant(tenantId, inicio, fim) {
  const dados = await coletarDados(tenantId, inicio, fim);
  const ia    = await chamarIA(dados);

  const { rows } = await query(
    `INSERT INTO relatorios_semanais
       (tenant_id, semana_inicio, semana_fim, dados, ia_resumo, ia_destaques, ia_atencao, ia_sugestao, gerado_em)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
     ON CONFLICT (tenant_id, semana_inicio)
     DO UPDATE SET dados=$4, ia_resumo=$5, ia_destaques=$6, ia_atencao=$7, ia_sugestao=$8, gerado_em=NOW()
     RETURNING *`,
    [tenantId, inicio, fim, dados, ia.resumo, JSON.stringify(ia.destaques), JSON.stringify(ia.atencao), ia.sugestao]
  );
  return rows[0];
}

// Chamado pelo cron: gera para todos os tenants ativos
export async function gerarRelatoriosTodos() {
  const { inicio, fim } = semanaAtual();
  const { rows: tenants } = await query(
    `SELECT id, nome FROM tenants WHERE status = 'ativo'`
  );

  console.log(`[CRON] Gerando relatórios para ${tenants.length} tenant(s) — semana ${inicio} a ${fim}`);

  for (const t of tenants) {
    try {
      await gerarParaTenant(t.id, inicio, fim);
      console.log(`[CRON] ✓ ${t.nome}`);
    } catch (err) {
      console.error(`[CRON] ✗ ${t.nome}:`, err.message);
    }
  }
}
