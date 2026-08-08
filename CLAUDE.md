# CLAUDE.md — Sistema de Anotação de Serviços (Borracharia)

Contexto do projeto para retomar trabalho sem precisar redescobrir tudo.

## O que é
SaaS multi-tenant de controle de serviços para **borracharias**. Cada serviço é dividido
entre funcionário e patrão por um **percentual configurável por tipo de serviço**
(`tipos_servico.percentual_funcionario`, padrão **50%** = meio a meio). Assinatura
mensal de **R$ 200/mês** via **Asaas**.

## Stack
- **Frontend:** React 18 + Vite, Tailwind CSS v3, React Router v6, Lucide React, Axios, jsPDF (+autotable). Pasta `frontend/`.
- **Backend:** Node.js + Express (ESM, `"type": "module"`), PostgreSQL **puro com `pg`** (sem ORM), JWT, bcryptjs. Pasta `backend/`.
- **Pagamentos:** Asaas (assinatura mensal + webhook).
- **Deploy alvo:** Frontend na Vercel, Backend + Postgres na Railway.

## Como rodar local
```bash
# Backend (porta 3001)
cd backend && npm install && npm run migrate && npm run dev

# Frontend (porta 5173)
cd frontend && npm install && npm run dev
```
- `npm run migrate` (backend) aplica `db/schema.sql`.
- Build de validação do front: `cd frontend && npm run build`.
- Shell do ambiente é **PowerShell**; `node server.js` precisa de porta 3001 livre.

## Ambiente local atual (já configurado)
- **Banco:** PostgreSQL local, database **`anotacaosaas`**. `DATABASE_URL` já no `backend/.env`
  (senha do postgres tem caracteres especiais `!@#` → codificados como `%21%40%23` na URL).
- **Asaas:** chave de **produção** (`$aact_prod_...`) já no `.env` (`ASAAS_API_URL=https://api.asaas.com/v3`).
- **Conta de teste (já ativada):** `teste@borracharia.com` / `teste123` (borracharia "Borracharia Teste", status `ativo`).
- Para ativar/bloquear tenant manualmente sem Asaas:
  `UPDATE tenants SET status='ativo' WHERE email='...';`

## Estrutura
```
backend/
  db/         schema.sql, connection.js (pool pg), migrate.js
  routes/     auth, funcionarios, tipos_servico, lancamentos, caixa, historico, asaas
  middlewares/ auth.js (JWT), plano.js (bloqueia tenant sem plano ativo → HTTP 402)
  utils/      asaasClient.js (axios pré-configurado)
  server.js
frontend/src/
  pages/      Landing, Login, Registro, Planos, Servicos, Caixa, Historico, Cadastro
  components/ Sidebar, Layout, ProtectedRoute  (BottomNav existe mas NÃO é mais usado)
  context/    AuthContext
  services/   api.js (axios + interceptors)
  utils/      format.js (brl/data), pdf.js (jsPDF)
```

## Regra de negócio (divisão configurável)
Calculada **no backend** ao lançar serviço (`routes/lancamentos.js`) usando o
`percentual_funcionario` do tipo de serviço (padrão 50; serviço avulso sem tipo → 50):
`valor_funcionario = round(valor * pct/100)`, `valor_patrao = valor - valor_funcionario`.
Ex. com 50%: R$ 25,00 → R$ 12,50 / R$ 12,50. Ex. com 60%: R$ 40,00 → R$ 24,00 / R$ 16,00.
O dono cria/edita o percentual por serviço na aba **Serviços** de Ajustes (`Cadastro.jsx`).

## Decisões importantes já tomadas
- **Layout = dashboard desktop** com **sidebar fixa à esquerda** (`components/Sidebar.jsx`),
  responsivo (vira drawer com hambúrguer no mobile). `Layout.jsx` recebe props
  `title`, `subtitle`, `action`. As 4 telas internas (Serviços, Caixa, Histórico, Cadastro)
  seguem mockups que o usuário enviou. Label do menu para Cadastro é **"Ajustes"**.
- **Soft delete** em funcionários e tipos de serviço (`ativo=false`) para preservar histórico.
- **`funcionarios.cargo`** (VARCHAR, opcional) — coluna adicionada depois do schema inicial;
  já aplicada no banco local via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
- **Caixa — modelo de saldo:** `Entradas = serviços + suprimentos + vendas de produtos`,
  `Saídas = sangrias + compras de estoque descontadas do caixa`,
  `saldo_final = valor_inicial + entradas - saídas`. Resumo expõe `entradas`/`saidas`,
  `vendas_produtos`/`compras_estoque`. `total_funcionarios`/`total_patrao` continuam no resumo.
- **Vendas & Estoque (`pages/Estoque.jsx`, rota `/estoque`, label sidebar "Vendas & Estoque"):**
  página com **3 abas**:
  - **Venda (PDV):** grid de cards de produto (foto/preço/estoque) + busca + chips de categoria;
    clicar monta o carrinho "Venda em andamento" (lateral). Escolhe forma (Pix/Cartão/Dinheiro)
    e **Cobrar** → `POST /api/estoque/vender` `{ itens:[{produto_id,quantidade}], forma_pagamento }`,
    baixa estoque de cada item e ENTRA o total no caixa (exige caixa aberto). **Dividir pagamento:**
    botão "+ Dividir pagamento" abre linhas forma+valor (Pix/Cartão/Dinheiro); envia
    `pagamentos:[{forma,valor}]` (soma tem que bater com o total). A venda é gravada na tabela
    `vendas` (com `pagamentos` JSONB) e os itens linkam por `movimentos_estoque.venda_id`.
  - **Estoque (tabela):** Produto/Categoria/Preço venda/Preço custo/Margem/Estoque/Est.mín./Status/Ações.
    Ações: **Entrada** (repõe; opcional "registrar como despesa no caixa" → SAI do caixa),
    **Saída** (ajuste/perda → só baixa estoque, NÃO mexe no caixa), editar, inativar/reativar (olho),
    excluir. Toggle "Mostrar inativos".
  - **Movimentações:** filtros (Produto, Tipo, De, Até) + tabela com coluna **Operador** (usuário).
  - **Modais:** Novo/Editar produto (foto redimensionada p/ ~400px JPEG no front via canvas, categoria
    por datalist, unidade, preços, estoque inicial→gera movimento "estoque inicial", estoque mínimo);
    Entrada e Saída de estoque.
  - **Tabelas:** `produtos` (+`categoria`,`unidade`,`imagem` TEXT data-URL) e `movimentos_estoque`
    (+`usuario_id` operador, +`forma_pagamento`). `tipo` entrada|saida; `caixa_id` preenchido quando
    reflete no caixa. Rotas em `routes/estoque.js`: `GET /`, `GET /movimentacoes`, `POST /`,
    `PUT /:id`, `PATCH /:id/ativo`, `DELETE /:id` (hard delete se sem histórico, senão soft),
    `POST /:id/movimentar`, `POST /vender`. **Importante:** agora só o PDV (`/vender`) é o caminho
    de venda que entra dinheiro; a "Saída" da tabela é só ajuste de estoque (não mexe no caixa).
  - **Reflexo no Caixa:** `caixa.js montarResumo` soma `movimentos_estoque` do caixa →
    vendas (saida) entram, compras (entrada c/ caixa) saem. Aparecem na tabela do Caixa
    (categorias Venda/Compra, não excluíveis pelo caixa). Soft delete (`ativo=false`).
  - **Histórico/PDF:** `routes/historico.js` agora também soma as vendas de produtos do período
    (`movimentos_estoque` tipo=saida, motivo='venda') → campos `total_produtos`, `qtd_produtos`,
    `produtos_vendidos[]`, `faturamento_total` (serviços+produtos). `pages/Historico.jsx` mostra
    card "Vendas de Produtos" + tabela "Produtos Vendidos"; `utils/pdf.js` inclui no relatório.
- **Multi-SaaS no mesmo Asaas:** o usuário tem OUTRO SaaS na mesma conta Asaas.
  Por isso todo customer/subscription é criado com `externalReference = "borracharia:<tenant_id>"`,
  e o **webhook ignora** qualquer evento cujo externalReference não comece com `borracharia:`.
  O tenant é resolvido pelo `tenant_id` extraído do externalReference.
- **Preço R$ 200/mês** (`ASAAS_VALOR_ASSINATURA=200`) — consistente em Landing, Planos e README.

## Fluxo SaaS / Auth
1. Registro cria tenant (`status='pendente'`) + usuário admin + 8 serviços pré-cadastrados
   (Pavio, Remendo a frio, Remendo a quente, Troca de pneu, Balanceamento, Calibragem,
   Câmara de ar, Vulcanização).
2. Vai para `/planos` → cria cliente + assinatura no Asaas → link de pagamento.
3. Webhook Asaas: `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` → `ativo`;
   `PAYMENT_OVERDUE`/`SUBSCRIPTION_DELETED` → `bloqueado`.
4. `ProtectedRoute` exige JWT + `status==='ativo'`. `api.js`: 401 → /login, 402 → /planos.

## Módulos adicionados (expansão grande)
- **Dashboard (`/dashboard`, tela inicial):** `routes/dashboard.js` — faturamento de hoje, serviços/vendas,
  estoque baixo, a receber (fiado), gráfico 7 dias (CSS puro). Catch-all do router aponta p/ `/dashboard`.
- **Financeiro (`/financeiro`, SÓ ADMIN):** `routes/financeiro.js` (protegido por `middlewares/adminOnly.js`).
  - **DRE/lucro real:** faturamento (serviços+produtos) − comissões − CMV (custo dos vendidos) − despesas fixas.
  - **Despesas fixas:** tabela `despesas` (CRUD).
  - **Acerto de comissão:** tabela `pagamentos_comissao`; saldo a pagar por funcionário (ganho − pago) e registrar pagamento.
  - **Abatimento de vale:** vale = sangria de caixa com `funcionario_id`. Tabela `abatimentos_vale`
    (`origem` = `desconto` não mexe no caixa | `dinheiro` gera suprimento no caixa aberto, ligado por
    `movimento_caixa_id`). A coluna da tela é **VALE EM ABERTO** = total de vales − abatido, e é ela
    que entra no `saldo` (ganho − pago − vales_aberto). Rotas: `GET /financeiro/vales/:funcionarioId`,
    `POST /financeiro/vales/abater`, `DELETE /financeiro/vales/abatimento/:id` (desfaz; devolução em
    dinheiro só enquanto o caixa estiver aberto). O `DELETE /caixa/movimento/:id` recusa apagar o
    suprimento de uma devolução. O total histórico de vales (Histórico/PDF/relatório IA) não muda.
- **Clientes + Fiado (`/clientes`):** `routes/clientes.js`. Tabelas `clientes` e `contas_receber`.
  PDV tem opção **À vista / Fiado** (fiado não exige caixa, vira conta a receber; receber pagamento entra no caixa como suprimento "Recebimento fiado").
- **Caixa:** conferência no fechamento (`valor_contado`/`diferenca` em `caixa_dia`), `GET /caixa/fechados` + `GET /caixa/:id`
  (histórico de caixas fechados, reabrir resumo/PDF), resumo `por_forma` (Pix/Cartão/Dinheiro). Coluna **FORMA PAG.** na tabela.
- **Serviços (OS):** `lancamentos` ganhou `cliente_nome`, `veiculo`, `placa`, `forma_pagamento`. Forma entra no relatório por forma.
- **Estoque:** `GET /estoque/alertas` (badge de estoque baixo na Sidebar). Recibo de venda em PDF (`pdfReciboVenda`).
- **Login de funcionário (papéis):** `usuarios.role` admin|funcionario. Endpoints `GET/POST/PUT/DELETE /api/auth/usuarios`
  (admin). Aba **Usuários** em Ajustes. Funcionário não vê Financeiro nem gestão de usuários (bloqueio no back via
  `adminOnly` e no front via Sidebar/`ProtectedRoute soAdmin`).
- **Super-admin (`/admin`, rota pública com login próprio):** `routes/admin.js`. Login por env
  **`SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_SENHA`** (padrão local `super@admin.com` / `superadmin` — TROCAR em produção).
  Token JWT com `{ super:true }`. Lista todas as borracharias + faturamento + MRR. Front usa axios isolado (`localStorage.admin_token`).
- **PWA instalável:** `public/manifest.webmanifest`, `public/icon.svg`, `public/sw.js` (stale-while-revalidate, ignora `/api`),
  registrado no `main.jsx`. `express.json` subiu p/ `5mb` (imagens base64 de produto).

## Pendências / próximos passos
- [ ] **Webhook Asaas em produção:** cadastrar no painel com URL pública
      (`https://<backend>/api/asaas/webhook`) + token igual ao `ASAAS_WEBHOOK_TOKEN`
      (hoje ainda é o placeholder `token_para_validar_webhook`). Local exige túnel (ngrok).
- [ ] **Deploy:** Railway (backend+Postgres) e Vercel (frontend). Passo a passo no README.md.
- [ ] **Repaginar Landing/Login/Registro/Planos** no estilo dashboard (ainda mobile-first
      centralizado) — pendente de decisão do usuário.
- [ ] Trocar `JWT_SECRET` por chave forte em produção.
- [ ] (Ideia sugerida) painel super-admin para ver todas as borracharias e faturamento.

## Notas
- README.md tem o passo a passo completo de execução local + deploy Railway/Vercel + Asaas.
- Não commitar `.env` (já no `.gitignore` de cada pasta). Projeto ainda **não é repositório git**.
