import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Executa o schema.sql contra o banco configurado em DATABASE_URL.
async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  try {
    console.log('Rodando migração do schema...');
    await pool.query(sql);
    console.log('✅ Schema aplicado com sucesso.');
  } catch (err) {
    console.error('❌ Erro ao aplicar schema:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
