/**
 * Cria/atualiza os indices do banco sem subir o servidor.
 * Uso: npm run migrate
 *
 * Idempotente: createIndex ignora indices que ja existem com a mesma definicao.
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { createIndexes } from '../db/indexes.js';

dotenv.config();

const mongoClient = new MongoClient(process.env.MONGODB_URI);

async function migrate() {
    await mongoClient.connect();
    const db = mongoClient.db();
    console.log('🔧 Criando indexes em:', db.databaseName);

    await createIndexes(db);

    console.log('✅ Database indexes created');
}

migrate()
    .catch((error) => {
        console.error('❌ Migrate error:', error.message);
        process.exitCode = 1;
    })
    .finally(() => mongoClient.close());
