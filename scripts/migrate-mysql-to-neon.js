#!/usr/bin/env node

require('dotenv').config();
const mysql = require('mysql2/promise');
const { Pool } = require('pg');

const tables = [
    'usuarios',
    'vinhos',
    'configuracoes',
    'beneficios_vip',
    'pedidos',
    'pedidos_itens',
    'password_resets'
];
const optionalTables = new Set(['password_resets']);
const booleanColumns = new Set(['ativo', 'is_admin', 'is_vip']);

function mysqlConfigFromEnvironment() {
    const required = ['MYSQLHOST', 'MYSQLUSER', 'MYSQLPASSWORD', 'MYSQLDATABASE'];
    const missing = required.filter((name) => !process.env[name]);
    if (missing.length > 0) {
        throw new Error(`Variáveis de origem ausentes: ${missing.join(', ')}`);
    }

    return {
        host: process.env.MYSQLHOST,
        port: Number(process.env.MYSQLPORT || 3306),
        user: process.env.MYSQLUSER,
        password: process.env.MYSQLPASSWORD,
        database: process.env.MYSQLDATABASE,
        connectTimeout: 10000
    };
}

function normalizeValue(column, value) {
    if (value === null || value === undefined || !booleanColumns.has(column)) {
        return value;
    }
    return value === true || value === 1 || value === '1';
}

async function sourceTableExists(connection, table) {
    const [rows] = await connection.query(
        `SELECT 1
         FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_name = ?
         LIMIT 1`,
        [table]
    );
    return rows.length > 0;
}

async function migrate() {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL não definido para o banco Neon.');
    }

    const source = await mysql.createConnection(mysqlConfigFromEnvironment());
    const target = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: true },
        max: 1,
        connectionTimeoutMillis: 10000
    });
    let client;
    let transactionStarted = false;

    try {
        client = await target.connect();
        const sourceData = new Map();
        for (const table of tables) {
            if (!(await sourceTableExists(source, table))) {
                if (optionalTables.has(table)) {
                    sourceData.set(table, []);
                    continue;
                }
                throw new Error(`Tabela obrigatória ausente no MySQL: ${table}`);
            }

            const [rows] = await source.query(`SELECT * FROM \`${table}\``);
            sourceData.set(table, rows);
        }

        for (const table of tables) {
            const { rows } = await client.query(`SELECT COUNT(*)::int AS total FROM "${table}"`);
            if (rows[0].total !== 0) {
                throw new Error(`A tabela ${table} no Neon não está vazia; migração cancelada para evitar sobrescrever dados.`);
            }
        }

        const columnMap = new Map();
        for (const table of tables) {
            const { rows } = await client.query(
                `SELECT column_name
                 FROM information_schema.columns
                 WHERE table_schema = current_schema() AND table_name = $1`,
                [table]
            );
            const targetColumns = new Set(rows.map((row) => row.column_name));
            const sourceColumns = sourceData.get(table).length > 0
                ? Object.keys(sourceData.get(table)[0])
                : [];
            const missingColumns = sourceColumns.filter((column) => !targetColumns.has(column));
            if (missingColumns.length > 0) {
                throw new Error(`Colunas ausentes no Neon em ${table}: ${missingColumns.join(', ')}`);
            }
            columnMap.set(table, sourceColumns);
        }

        await client.query('BEGIN');
        transactionStarted = true;

        for (const table of tables) {
            const rows = sourceData.get(table);
            const columns = columnMap.get(table);
            if (rows.length === 0) {
                console.log(`${table}: 0 registros`);
                continue;
            }

            const columnSql = columns.map((column) => `"${column}"`).join(', ');
            const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
            const insertSql = `INSERT INTO "${table}" (${columnSql}) VALUES (${placeholders})`;

            for (const row of rows) {
                const values = columns.map((column) => normalizeValue(column, row[column]));
                await client.query(insertSql, values);
            }

            if (columns.includes('id')) {
                await client.query(
                    `SELECT setval(
                        pg_get_serial_sequence($1, 'id'),
                        COALESCE(MAX(id), 1),
                        COUNT(*) > 0
                     )
                     FROM "${table}"`,
                    [`${table}`]
                );
            }
            console.log(`${table}: ${rows.length} registros copiados`);
        }

        for (const table of tables) {
            const { rows } = await client.query(`SELECT COUNT(*)::int AS total FROM "${table}"`);
            if (rows[0].total !== sourceData.get(table).length) {
                throw new Error(`A validação de quantidade de registros falhou na tabela ${table}.`);
            }
        }

        await client.query('COMMIT');
        transactionStarted = false;
        console.log('Migração concluída. Nenhum dado foi impresso no log.');
    } catch (error) {
        if (transactionStarted && client) {
            await client.query('ROLLBACK');
        }
        throw error;
    } finally {
        if (client) {
            client.release();
        }
        await target.end();
        await source.end();
    }
}

migrate().catch((error) => {
    console.error('Migração MySQL → Neon cancelada:', error.message);
    process.exitCode = 1;
});
