-- Extensão necessária para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  telefone VARCHAR(30),
  documento VARCHAR(30), -- CNPJ ou CPF da borracharia
  status VARCHAR(20) DEFAULT 'pendente', -- ativo | bloqueado | pendente
  asaas_customer_id VARCHAR(255),
  asaas_subscription_id VARCHAR(255),
  asaas_payment_link TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Colunas de dados da empresa adicionadas após o schema inicial.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS telefone VARCHAR(30);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS documento VARCHAR(30);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_expira_em DATE;

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  senha VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reset_senha (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expira_em TIMESTAMP NOT NULL,
  usado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS funcionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  nome VARCHAR(255) NOT NULL,
  cargo VARCHAR(255),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tipos_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  nome VARCHAR(255) NOT NULL,
  valor_padrao DECIMAL(10,2) DEFAULT 0,
  -- % do valor que vai para o funcionário (0–100). Padrão 50 = divisão meio a meio.
  percentual_funcionario DECIMAL(5,2) DEFAULT 50,
  ativo BOOLEAN DEFAULT true
);

-- Coluna adicionada após o schema inicial — garante a divisão configurável em bancos já existentes.
ALTER TABLE tipos_servico
  ADD COLUMN IF NOT EXISTS percentual_funcionario DECIMAL(5,2) DEFAULT 50;

CREATE TABLE IF NOT EXISTS caixa_dia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  data DATE NOT NULL,
  valor_inicial DECIMAL(10,2) DEFAULT 0,
  valor_contado DECIMAL(10,2),  -- quanto foi contado na gaveta ao fechar
  diferenca DECIMAL(10,2),      -- valor_contado - saldo esperado (sobra/falta)
  status VARCHAR(20) DEFAULT 'aberto', -- aberto | fechado
  fechado_em TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Colunas de conferência de caixa adicionadas após o schema inicial
ALTER TABLE caixa_dia ADD COLUMN IF NOT EXISTS valor_contado DECIMAL(10,2);
ALTER TABLE caixa_dia ADD COLUMN IF NOT EXISTS diferenca DECIMAL(10,2);

CREATE TABLE IF NOT EXISTS movimentos_caixa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caixa_id UUID REFERENCES caixa_dia(id),
  tipo VARCHAR(20) NOT NULL, -- sangria | suprimento
  valor DECIMAL(10,2) NOT NULL,
  motivo TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE movimentos_caixa ADD COLUMN IF NOT EXISTS forma_pagamento VARCHAR(20);

CREATE TABLE IF NOT EXISTS lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  caixa_id UUID REFERENCES caixa_dia(id),
  funcionario_id UUID REFERENCES funcionarios(id),
  tipo_servico_id UUID REFERENCES tipos_servico(id),
  nome_servico VARCHAR(255),
  cliente_nome VARCHAR(255), -- ordem de serviço (opcional)
  veiculo VARCHAR(120),      -- modelo/descrição do veículo (opcional)
  placa VARCHAR(20),         -- placa do veículo (opcional)
  forma_pagamento VARCHAR(20), -- pix | cartao | dinheiro (opcional)
  valor DECIMAL(10,2) NOT NULL,
  valor_funcionario DECIMAL(10,2) NOT NULL,
  valor_patrao DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Colunas de ordem de serviço / forma de pagamento adicionadas após o schema inicial
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS cliente_nome VARCHAR(255);
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS veiculo VARCHAR(120);
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS placa VARCHAR(20);
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS forma_pagamento VARCHAR(20);
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS pagamentos JSONB; -- [{forma, valor}] para pagamento misto
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL;

-- Produtos vendidos pela borracharia (catálogo + estoque atual)
CREATE TABLE IF NOT EXISTS produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  nome VARCHAR(255) NOT NULL,
  categoria VARCHAR(100),
  unidade VARCHAR(30) DEFAULT 'Unidade',
  imagem TEXT, -- data URL (base64) redimensionada no front
  preco_venda DECIMAL(10,2) DEFAULT 0,
  preco_custo DECIMAL(10,2) DEFAULT 0,
  quantidade INTEGER DEFAULT 0,
  estoque_minimo INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Colunas adicionadas após o schema inicial (categoria/unidade/foto)
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS categoria VARCHAR(100);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS unidade VARCHAR(30) DEFAULT 'Unidade';
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS imagem TEXT;

-- Movimentações de estoque (entrada = compra/reposição, saida = venda).
-- caixa_id é preenchido quando a movimentação reflete no caixa:
--   saida (venda)            -> entrada de dinheiro no caixa
--   entrada (compra) c/ caixa -> saída de dinheiro do caixa
CREATE TABLE IF NOT EXISTS movimentos_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  produto_id UUID REFERENCES produtos(id),
  caixa_id UUID REFERENCES caixa_dia(id),
  usuario_id UUID REFERENCES usuarios(id), -- operador que registrou
  tipo VARCHAR(20) NOT NULL, -- entrada | saida
  quantidade INTEGER NOT NULL,
  valor_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
  valor_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  forma_pagamento VARCHAR(20), -- pix | cartao | dinheiro (vendas pelo PDV)
  motivo TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Colunas adicionadas após o schema inicial (operador/forma de pagamento)
ALTER TABLE movimentos_estoque ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES usuarios(id);
ALTER TABLE movimentos_estoque ADD COLUMN IF NOT EXISTS forma_pagamento VARCHAR(20);

-- Clientes (para fiado / ordem de serviço)
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  nome VARCHAR(255) NOT NULL,
  telefone VARCHAR(30),
  observacao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clientes_tenant ON clientes(tenant_id);

-- Vendas pelo PDV (agrupa os itens e guarda a divisão de pagamento)
CREATE TABLE IF NOT EXISTS vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  caixa_id UUID REFERENCES caixa_dia(id),
  usuario_id UUID REFERENCES usuarios(id),
  cliente_id UUID REFERENCES clientes(id),
  fiado BOOLEAN DEFAULT false,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  pagamentos JSONB, -- [{ forma: 'pix'|'cartao'|'dinheiro', valor }]
  created_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE movimentos_estoque ADD COLUMN IF NOT EXISTS venda_id UUID REFERENCES vendas(id);
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id);
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS fiado BOOLEAN DEFAULT false;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS lancamento_id UUID REFERENCES lancamentos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_vendas_caixa ON vendas(caixa_id);

-- Contas a receber (fiado): uma por venda fiado; baixa quando o cliente paga
CREATE TABLE IF NOT EXISTS contas_receber (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  cliente_id UUID REFERENCES clientes(id),
  venda_id UUID REFERENCES vendas(id),
  descricao VARCHAR(255),
  valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  valor_pago DECIMAL(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) DEFAULT 'aberto', -- aberto | pago
  created_at TIMESTAMP DEFAULT NOW()
);
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS lancamento_id UUID REFERENCES lancamentos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_contas_cliente ON contas_receber(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contas_tenant ON contas_receber(tenant_id);

-- Despesas fixas mensais (aluguel, luz, água...) para cálculo do lucro real (DRE)
CREATE TABLE IF NOT EXISTS despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  descricao VARCHAR(255) NOT NULL,
  categoria VARCHAR(100),
  valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  dia_vencimento INTEGER, -- 1..31 (opcional)
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_despesas_tenant ON despesas(tenant_id);

-- Pagamentos de comissão aos funcionários (acerto)
CREATE TABLE IF NOT EXISTS pagamentos_comissao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  funcionario_id UUID REFERENCES funcionarios(id),
  valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  observacao TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pag_comissao_func ON pagamentos_comissao(funcionario_id);

-- Relatórios semanais gerados por IA
CREATE TABLE IF NOT EXISTS relatorios_semanais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  semana_inicio DATE NOT NULL,
  semana_fim DATE NOT NULL,
  dados JSONB NOT NULL,
  ia_resumo TEXT,
  ia_destaques JSONB,
  ia_atencao JSONB,
  ia_sugestao TEXT,
  gerado_em TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_relatorio_tenant_semana
  ON relatorios_semanais(tenant_id, semana_inicio);

-- Índices para acelerar consultas mais comuns
CREATE INDEX IF NOT EXISTS idx_lancamentos_tenant ON lancamentos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_caixa ON lancamentos(caixa_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_created ON lancamentos(created_at);
CREATE INDEX IF NOT EXISTS idx_caixa_tenant_data ON caixa_dia(tenant_id, data);
CREATE INDEX IF NOT EXISTS idx_funcionarios_tenant ON funcionarios(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tipos_servico_tenant ON tipos_servico(tenant_id);
CREATE INDEX IF NOT EXISTS idx_produtos_tenant ON produtos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mov_estoque_caixa ON movimentos_estoque(caixa_id);
CREATE INDEX IF NOT EXISTS idx_mov_estoque_produto ON movimentos_estoque(produto_id);
