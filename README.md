# 🛞 Sistema de Anotação de Serviços — Borracharia (SaaS)

Sistema completo de controle de serviços para borracharias, com **divisão fixa de 50% para o funcionário e 50% para o patrão** em todos os serviços. Multi-tenant (SaaS) com assinatura mensal via **Asaas**.

## ✨ Funcionalidades

- **Autenticação / SaaS**: registro da borracharia, login com JWT, assinatura mensal e bloqueio automático por falta de pagamento.
- **Lançar serviço**: seleção de funcionário e tipo de serviço (com valor padrão editável), divisão automática 50/50 e totais do dia.
- **Caixa do dia**: abertura com valor inicial, sangrias e suprimentos, fechamento com resumo completo e exportação em PDF.
- **Histórico**: semana atual ou período customizado, totais por funcionário e exportação em PDF.
- **Cadastros**: funcionários (sempre 50/50) e tipos de serviço (8 já vêm pré-cadastrados ao criar a conta).

## 🧱 Stack

| Camada    | Tecnologias |
|-----------|-------------|
| Frontend  | React 18 + Vite, Tailwind CSS v3, React Router v6, Lucide React, Axios, jsPDF |
| Backend   | Node.js + Express, PostgreSQL puro (`pg`, sem ORM), JWT, bcrypt |
| Pagamentos| Asaas (assinatura mensal + webhook) |
| Deploy    | Frontend na **Vercel**, Backend + PostgreSQL na **Railway** |

---

## 📁 Estrutura

```
sistema-anotacao/
├── backend/
│   ├── db/            schema.sql, connection.js, migrate.js
│   ├── routes/        auth, funcionarios, tipos_servico, lancamentos, caixa, historico, asaas
│   ├── middlewares/   auth.js (JWT), plano.js (bloqueio por plano)
│   ├── utils/         asaasClient.js
│   └── server.js
└── frontend/
    └── src/
        ├── pages/      Login, Registro, Planos, Servicos, Caixa, Historico, Cadastro
        ├── components/ Layout, BottomNav, ProtectedRoute
        ├── context/    AuthContext
        ├── services/   api.js
        └── utils/      format.js, pdf.js
```

---

## 🚀 Rodando localmente

### Pré-requisitos
- Node.js 18+ e npm
- PostgreSQL rodando localmente (ou uma URL de banco na nuvem)

### 1. Banco de dados

Crie um banco e aplique o schema:

```bash
# crie um banco chamado borracharia no seu PostgreSQL
createdb borracharia
```

### 2. Backend

```bash
cd backend
cp .env.example .env        # no Windows (PowerShell): copy .env.example .env
# edite o .env com sua DATABASE_URL, JWT_SECRET e chaves do Asaas

npm install
npm run migrate             # cria as tabelas (executa db/schema.sql)
npm run dev                 # sobe a API em http://localhost:3001
```

Variáveis em `backend/.env`:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/borracharia
JWT_SECRET=uma_chave_bem_secreta
ASAAS_API_KEY=sua_chave_asaas
ASAAS_API_URL=https://api.asaas.com/v3        # sandbox: https://sandbox.asaas.com/api/v3
ASAAS_WEBHOOK_TOKEN=token_para_validar_webhook
ASAAS_VALOR_ASSINATURA=200
FRONTEND_URL=http://localhost:5173
PORT=3001
NODE_ENV=development
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env        # no Windows (PowerShell): copy .env.example .env
# VITE_API_URL=http://localhost:3001

npm install
npm run dev                 # abre em http://localhost:5173
```

### 4. Fluxo de teste
1. Acesse `http://localhost:5173/registro` e cadastre a borracharia.
2. Você será levado à tela de **Planos** (status `pendente`).
3. Clique em **Assinar** → o link de pagamento do Asaas é gerado.
4. Em sandbox, confirme o pagamento → o webhook ativa o tenant (ou clique em "Já paguei, verificar").
5. Com status `ativo`, use Serviços, Caixa, Histórico e Cadastro.

> 💡 Para testar sem Asaas, atualize o tenant manualmente no banco:
> `UPDATE tenants SET status = 'ativo';`

---

## 💳 Configuração do Asaas

1. Crie uma conta em [asaas.com](https://www.asaas.com) (use o **sandbox** para testes).
2. Gere a **API Key** em *Integrações → API* e coloque em `ASAAS_API_KEY`.
3. Em produção use `https://api.asaas.com/v3`; em sandbox use `https://sandbox.asaas.com/api/v3`.
4. Configure o **webhook** apontando para `https://SEU-BACKEND/api/asaas/webhook`.
   - Defina um token e coloque o mesmo valor em `ASAAS_WEBHOOK_TOKEN` (o Asaas envia no header `asaas-access-token`).
   - Eventos tratados: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `SUBSCRIPTION_DELETED`.

| Evento | Efeito no tenant |
|--------|------------------|
| PAYMENT_CONFIRMED / PAYMENT_RECEIVED | `status = ativo` |
| PAYMENT_OVERDUE / SUBSCRIPTION_DELETED | `status = bloqueado` |

---

## ☁️ Deploy

### Backend + PostgreSQL na Railway

1. Crie um projeto em [railway.app](https://railway.app).
2. **New → Database → PostgreSQL**. A Railway gera a `DATABASE_URL`.
3. **New → GitHub Repo** (ou Empty Service) apontando para a pasta `backend/`.
   - Root Directory: `backend`
   - Start Command: `node server.js`
4. Em **Variables**, configure:
   - `DATABASE_URL` (use a referência `${{Postgres.DATABASE_URL}}`)
   - `JWT_SECRET`, `ASAAS_API_KEY`, `ASAAS_API_URL`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_VALOR_ASSINATURA`
   - `FRONTEND_URL` (a URL da Vercel)
   - `NODE_ENV=production`
5. Aplique o schema no banco da Railway:
   ```bash
   # localmente, apontando para o banco de produção:
   DATABASE_URL="<url-da-railway>" NODE_ENV=production npm run migrate
   ```
   (ou rode `migrate` como um comando one-off no painel da Railway.)
6. Gere um domínio em **Settings → Networking → Generate Domain**.

### Frontend na Vercel

1. Importe o repositório em [vercel.com](https://vercel.com).
2. **Root Directory**: `frontend`
3. Framework: **Vite** (build `npm run build`, output `dist`).
4. Em **Environment Variables**, adicione:
   - `VITE_API_URL=https://SEU-BACKEND.up.railway.app`
5. Deploy. Atualize `FRONTEND_URL` na Railway com a URL final da Vercel e configure o webhook do Asaas para o backend.

---

## 🧮 Regra de negócio

Todo serviço é dividido **50% funcionário / 50% patrão**, calculado no backend no momento do lançamento (`routes/lancamentos.js`). Exemplo: serviço de **R$ 25,00** → funcionário **R$ 12,50** / patrão **R$ 12,50**.

---

## 📜 Scripts

**Backend**
- `npm run dev` — API com auto-reload
- `npm start` — API em produção
- `npm run migrate` — cria as tabelas

**Frontend**
- `npm run dev` — ambiente de desenvolvimento
- `npm run build` — build de produção
- `npm run preview` — preview do build
