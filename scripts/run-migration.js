#!/usr/bin/env node
/**
 * Script para executar migration de país/bandeira no banco Railway
 * Uso: node scripts/run-migration.js
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
  const config = {
    host: process.env.MYSQLHOST || 'mysql.railway.internal',
    port: parseInt(process.env.MYSQLPORT || '3306'),
    user: process.env.MYSQLUSER || 'root',
    password: process.env.MYSQLPASSWORD || '',
    database: process.env.MYSQLDATABASE || 'railway',
  };

  console.log(`Conectando a ${config.host}:${config.port}...`);

  try {
    const connection = await mysql.createConnection(config);
    console.log('✓ Conectado ao banco de dados');

    // Executar migration
    const migrationSQL = `
      ALTER TABLE vinhos
        ADD COLUMN IF NOT EXISTS pais_origem VARCHAR(100) NULL AFTER uva,
        ADD COLUMN IF NOT EXISTS pais_codigo CHAR(2) NULL AFTER pais_origem,
        ADD COLUMN IF NOT EXISTS bandeira_url VARCHAR(500) NULL AFTER pais_codigo;

      CREATE INDEX IF NOT EXISTS idx_vinhos_pais ON vinhos (pais_origem, pais_codigo);
    `;

    console.log('Executando migration...');
    const statements = migrationSQL.split(';').filter(s => s.trim());
    
    for (const stmt of statements) {
      if (stmt.trim()) {
        await connection.execute(stmt);
        console.log('✓', stmt.substring(0, 60) + '...');
      }
    }

    console.log('\n✅ Migration concluída com sucesso!');

    // Verificar colunas
    const [columns] = await connection.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='vinhos' AND COLUMN_NAME IN ('pais_origem', 'pais_codigo', 'bandeira_url')"
    );
    console.log('\nColunas criadas:', columns.map(c => c.COLUMN_NAME).join(', '));

    await connection.end();
  } catch (error) {
    console.error('❌ Erro na migration:', error.message);
    process.exit(1);
  }
}

runMigration();
