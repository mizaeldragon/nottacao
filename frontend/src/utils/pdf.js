import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { brl, dataBR } from './format';

const LARANJA = [10, 103, 226]; // #0A67E2

// Gera PDF do fechamento de caixa
export function pdfFechamentoCaixa(nomeEmpresa, dados) {
  const doc = new jsPDF();
  const { caixa, resumo } = dados;

  doc.setFontSize(16);
  doc.setTextColor(...LARANJA);
  doc.text(nomeEmpresa || 'Borracharia', 14, 18);

  doc.setFontSize(12);
  doc.setTextColor(40);
  doc.text(`Fechamento de Caixa - ${dataBR(caixa.data)}`, 14, 27);

  const corpo = [
    ['Valor inicial', brl(resumo.valor_inicial)],
    ['Total de serviços (' + resumo.qtd_servicos + ')', brl(resumo.total_servicos)],
  ];
  if (resumo.vendas_produtos > 0) corpo.push(['Vendas de produtos', brl(resumo.vendas_produtos)]);
  corpo.push(['Total funcionários (comissão)', brl(resumo.total_funcionarios)]);
  corpo.push(['Total patrão', brl(resumo.total_patrao)]);
  corpo.push(['Suprimentos', brl(resumo.suprimentos)]);
  corpo.push(['Sangrias', '- ' + brl(resumo.sangrias)]);
  if (resumo.compras_estoque > 0) corpo.push(['Compras de estoque', '- ' + brl(resumo.compras_estoque)]);
  corpo.push(['Saldo final em caixa', brl(resumo.saldo_final)]);
  if (resumo.valor_contado != null) {
    corpo.push(['Valor contado', brl(resumo.valor_contado)]);
    const dif = Number(resumo.diferenca || 0);
    corpo.push([
      'Diferença',
      Math.abs(dif) < 0.01 ? 'Conferido' : (dif > 0 ? 'Sobra ' : 'Falta ') + brl(Math.abs(dif)),
    ]);
  }

  autoTable(doc, {
    startY: 33,
    head: [['Resumo', 'Valor']],
    body: corpo,
    headStyles: { fillColor: LARANJA },
  });

  const pf = resumo.por_forma || {};
  const totalFormas =
    (pf.pix || 0) + (pf.cartao_credito || 0) + (pf.cartao_debito || 0) + (pf.cartao || 0) + (pf.dinheiro || 0);
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 8,
    head: [['Entradas por forma', 'Valor']],
    body: [
      ['Pix', brl(pf.pix || 0)],
      ['Cartão Crédito', brl((pf.cartao_credito || 0) + (pf.cartao || 0))],
      ['Cartão Débito', brl(pf.cartao_debito || 0)],
      ['Dinheiro', brl(pf.dinheiro || 0)],
      ['Total recebido', brl(totalFormas)],
    ],
    headStyles: { fillColor: LARANJA },
  });


  if (resumo.por_funcionario?.length) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Funcionário', 'Qtd serviços', 'Comissão (50%)']],
      body: resumo.por_funcionario.map((f) => [f.nome, f.qtd, brl(f.comissao)]),
      headStyles: { fillColor: LARANJA },
    });
  }

  doc.save(`fechamento-caixa-${caixa.data}.pdf`);
}

const FORMA_LABEL = { pix: 'Pix', cartao: 'Cartão', dinheiro: 'Dinheiro' };

// Gera um recibo simples de venda (produtos do PDV)
export function pdfReciboVenda(nomeEmpresa, venda) {
  const doc = new jsPDF({ unit: 'mm', format: [80, 200] }); // formato de cupom
  let y = 10;
  doc.setFontSize(12);
  doc.setTextColor(...LARANJA);
  doc.text(nomeEmpresa || 'Borracharia', 40, y, { align: 'center' });
  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text('RECIBO DE VENDA', 40, y, { align: 'center' });
  y += 4;
  doc.text(new Date(venda.data || Date.now()).toLocaleString('pt-BR'), 40, y, { align: 'center' });
  y += 5;

  autoTable(doc, {
    startY: y,
    margin: { left: 4, right: 4 },
    styles: { fontSize: 8, cellPadding: 1 },
    head: [['Item', 'Qtd', 'Total']],
    body: venda.itens.map((i) => [i.nome, i.quantidade, brl(i.preco * i.quantidade)]),
    headStyles: { fillColor: LARANJA },
  });
  y = doc.lastAutoTable.finalY + 5;

  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text(`TOTAL: ${brl(venda.total)}`, 40, y, { align: 'center' });
  y += 6;

  if (venda.pagamentos?.length) {
    doc.setFontSize(8);
    doc.setTextColor(80);
    venda.pagamentos.forEach((p) => {
      doc.text(`${FORMA_LABEL[p.forma] || p.forma}: ${brl(p.valor)}`, 40, y, { align: 'center' });
      y += 4;
    });
  }
  y += 2;
  doc.text('Obrigado pela preferência!', 40, y, { align: 'center' });

  doc.save(`recibo-${Date.now()}.pdf`);
}

// Gera PDF do histórico por período
export function pdfHistorico(nomeEmpresa, dados) {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.setTextColor(...LARANJA);
  doc.text(nomeEmpresa || 'Borracharia', 14, 18);

  doc.setFontSize(12);
  doc.setTextColor(40);
  doc.text(
    `Histórico: ${dataBR(dados.periodo.inicio)} a ${dataBR(dados.periodo.fim)}`,
    14,
    27
  );

  autoTable(doc, {
    startY: 33,
    head: [['Totais do período', 'Valor']],
    body: [
      ['Serviços (' + dados.qtd_servicos + ')', brl(dados.total_geral)],
      ['Vendas de produtos (' + (dados.qtd_produtos || 0) + ')', brl(dados.total_produtos || 0)],
      ['Faturamento total', brl(dados.faturamento_total ?? dados.total_geral)],
      ['Total funcionários (comissão)', brl(dados.total_funcionarios)],
      ['Total patrão', brl(dados.total_patrao)],
    ],
    headStyles: { fillColor: LARANJA },
  });

  if (dados.por_funcionario?.length) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Funcionário', 'Qtd', 'Comissão', 'Total gerado', 'Vales']],
      body: dados.por_funcionario.map((f) => [
        f.nome,
        f.qtd,
        brl(f.comissao),
        brl(f.total_gerado),
        f.total_vales > 0 ? brl(f.total_vales) : '—',
      ]),
      headStyles: { fillColor: LARANJA },
    });
  }

  if (dados.vales?.length) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Data', 'Funcionário', 'Motivo', 'Vale']],
      body: dados.vales.map((v) => [
        dataBR(v.data),
        v.funcionario_nome,
        v.motivo || '—',
        brl(v.valor),
      ]),
      headStyles: { fillColor: LARANJA },
    });
  }

  if ((dados.total_vales || 0) > 0) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 4,
      body: [['Total de vales pagos no período', brl(dados.total_vales)]],
      styles: { textColor: [109, 40, 217] },
    });
  }

  if (dados.produtos_vendidos?.length) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Produto vendido', 'Qtd', 'Total']],
      body: dados.produtos_vendidos.map((p) => [p.nome, p.qtd, brl(p.total)]),
      headStyles: { fillColor: LARANJA },
    });
  }

  const pf = dados.por_forma || {};
  if ((pf.pix || 0) + (pf.cartao_credito || 0) + (pf.cartao_debito || 0) + (pf.dinheiro || 0) > 0) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Vendas por forma', 'Valor']],
      body: [
        ['Pix', brl(pf.pix || 0)],
        ['Cartão Crédito', brl(pf.cartao_credito || 0)],
        ['Cartão Débito', brl(pf.cartao_debito || 0)],
        ['Dinheiro', brl(pf.dinheiro || 0)],
      ],
      headStyles: { fillColor: LARANJA },
    });
  }

  doc.save(`historico-${dados.periodo.inicio}_a_${dados.periodo.fim}.pdf`);
}

// Gera PDF do relatório semanal de IA
export function pdfRelatorioIA(nomeEmpresa, r) {
  const doc = new jsPDF();
  const dados = r.dados || {};
  const fmt = (v) => brl(v || 0);

  doc.setFontSize(16);
  doc.setTextColor(...LARANJA);
  doc.text(nomeEmpresa || 'Borracharia', 14, 18);

  doc.setFontSize(11);
  doc.setTextColor(40);
  const ini = String(r.semana_inicio).substring(0, 10);
  const fim = String(r.semana_fim).substring(0, 10);
  const f = (s) => { const [y,m,d] = s.split('-'); return `${d}/${m}/${y}`; };
  doc.text(`Relatório IA — Semana de ${f(ini)} a ${f(fim)}`, 14, 27);

  // Totais
  const bodyIA = [
    ['Faturamento total', fmt(dados.fat_total)],
    ['Serviços', fmt(dados.fat_servicos)],
    ['Vendas PDV', fmt(dados.fat_pdv)],
    ['Qtd. serviços', String(dados.qtd_servicos || 0)],
    ['Ticket médio', fmt(dados.ticket_medio)],
    ['Variação vs semana ant.', dados.variacao_pct != null ? `${dados.variacao_pct}%` : '—'],
  ];
  if (dados.total_vales > 0) bodyIA.push(['Vales pagos a funcionários', fmt(dados.total_vales)]);
  autoTable(doc, {
    startY: 33,
    head: [['Indicador', 'Valor']],
    body: bodyIA,
    headStyles: { fillColor: LARANJA },
  });

  // Análise da IA
  if (r.ia_resumo) {
    const y = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setTextColor(...LARANJA);
    doc.text('Análise da IA', 14, y);

    doc.setFontSize(10);
    doc.setTextColor(60);
    const linhas = doc.splitTextToSize(r.ia_resumo, 182);
    doc.text(linhas, 14, y + 7);

    let cy = y + 7 + linhas.length * 5 + 4;

    if (r.ia_destaques?.length) {
      doc.setFontSize(10);
      doc.setTextColor(...LARANJA);
      doc.text('Destaques', 14, cy); cy += 6;
      doc.setTextColor(60);
      r.ia_destaques.forEach((d) => { doc.text(`• ${d}`, 16, cy); cy += 5; });
      cy += 2;
    }

    if (r.ia_atencao?.length) {
      doc.setTextColor(180, 120, 0);
      doc.text('Pontos de atenção', 14, cy); cy += 6;
      doc.setTextColor(60);
      r.ia_atencao.forEach((a) => { doc.text(`• ${a}`, 16, cy); cy += 5; });
      cy += 2;
    }

    if (r.ia_sugestao) {
      doc.setTextColor(...LARANJA);
      doc.text('Sugestão para a próxima semana', 14, cy); cy += 6;
      doc.setTextColor(60);
      const sug = doc.splitTextToSize(r.ia_sugestao, 182);
      doc.text(sug, 14, cy);
    }
  }

  // Funcionários com vales
  if (dados.top_funcionarios?.length) {
    autoTable(doc, {
      startY: doc.lastAutoTable ? doc.lastAutoTable.finalY + 8 : doc.internal.pageSize.height - 40,
      head: [['Funcionário', 'Serviços', 'Faturado', 'Comissão', 'Vales']],
      body: dados.top_funcionarios.map((f) => [
        f.nome, f.qtd, fmt(f.total), fmt(f.comissao),
        f.total_vales > 0 ? fmt(f.total_vales) : '—',
      ]),
      headStyles: { fillColor: LARANJA },
    });
  }

  doc.save(`relatorio-ia-${ini}.pdf`);
}
