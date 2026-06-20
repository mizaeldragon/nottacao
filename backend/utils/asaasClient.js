import axios from 'axios';

// Token lido em cada requisição para garantir que o dotenv já foi carregado
const asaas = axios.create({
  baseURL: process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3',
});

asaas.interceptors.request.use((config) => {
  config.headers['Content-Type'] = 'application/json';
  config.headers['access_token'] = process.env.ASAAS_API_KEY;
  return config;
});

export default asaas;
