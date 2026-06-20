import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import funcionariosRoutes from './routes/funcionarios.js';
import tiposServicoRoutes from './routes/tipos_servico.js';
import lancamentosRoutes from './routes/lancamentos.js';
import caixaRoutes from './routes/caixa.js';
import estoqueRoutes from './routes/estoque.js';
import historicoRoutes from './routes/historico.js';
import financeiroRoutes from './routes/financeiro.js';
import clientesRoutes from './routes/clientes.js';
import dashboardRoutes from './routes/dashboard.js';
import adminRoutes from './routes/admin.js';
import asaasRoutes from './routes/asaas.js';
import relatorioSemanalRoutes from './routes/relatorioSemanal.js';
import cron from 'node-cron';
import { gerarRelatoriosTodos } from './utils/gerarRelatorio.js';

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '5mb' })); // imagens de produto vão em base64

// Healthcheck
app.get('/', (req, res) => res.json({ ok: true, service: 'borracharia-api' }));

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/funcionarios', funcionariosRoutes);
app.use('/api/tipos-servico', tiposServicoRoutes);
app.use('/api/lancamentos', lancamentosRoutes);
app.use('/api/caixa', caixaRoutes);
app.use('/api/estoque', estoqueRoutes);
app.use('/api/historico', historicoRoutes);
app.use('/api/financeiro', financeiroRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/relatorio-semanal', relatorioSemanalRoutes);
app.use('/api/asaas', asaasRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

// Cron: todo sábado às 7h (Brasília) gera relatório semanal para todos os tenants ativos
cron.schedule('0 7 * * 6', () => {
  gerarRelatoriosTodos().catch(err => console.error('[CRON] Falha geral:', err));
}, { timezone: 'America/Sao_Paulo' });

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
