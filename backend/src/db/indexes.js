/**
 * Definicao dos indices do banco.
 *
 * Fonte unica de verdade: usado no boot do servidor (src/server.js) e pelo
 * script standalone `npm run migrate` (src/seeds/migrate.js).
 */

export async function createIndexes(db) {
    // Tenant-aware indexes
    await db.collection('users').createIndex({ tenant_id: 1, email: 1 }, { unique: true });
    await db.collection('organizations').createIndex({ tenant_id: 1 });
    await db.collection('records').createIndex({ tenant_id: 1, database_id: 1 });
    await db.collection('records').createIndex({ tenant_id: 1, status: 1 });
    await db.collection('ai_embeddings').createIndex({ tenant_id: 1, record_id: 1 });
    await db.collection('events').createIndex({ tenant_id: 1, created_at: -1 });
    await db.collection('audit_logs').createIndex({ tenant_id: 1, created_at: -1 });
    await db.collection('audit_logs').createIndex({ tenant_id: 1, user_id: 1, created_at: -1 });
    await db.collection('audit_logs').createIndex({ tenant_id: 1, action: 1, created_at: -1 });
    await db.collection('audit_logs').createIndex({ tenant_id: 1, entity_type: 1, entity_id: 1 });

    // Organizational structure indexes
    await db.collection('departments').createIndex({ tenant_id: 1, name: 1 });
    await db.collection('departments').createIndex({ tenant_id: 1, parent_department_id: 1 });
    await db.collection('groups').createIndex({ tenant_id: 1, department_id: 1 });
    await db.collection('groups').createIndex({ tenant_id: 1, parent_group_id: 1 });
    await db.collection('user_groups').createIndex({ tenant_id: 1, user_id: 1 });
    await db.collection('user_groups').createIndex({ tenant_id: 1, group_id: 1 });
    await db.collection('user_groups').createIndex({ tenant_id: 1, user_id: 1, group_id: 1 }, { unique: true });

    // KB access control indexes
    await db.collection('kb_access').createIndex({ tenant_id: 1, kb_id: 1 }, { unique: true });
    await db.collection('kb_access').createIndex({ tenant_id: 1, visibility: 1 });
    await db.collection('kb_access').createIndex({ tenant_id: 1, allowed_departments: 1 });
    await db.collection('kb_access').createIndex({ tenant_id: 1, allowed_groups: 1 });

    // Notifications indexes
    await db.collection('notifications').createIndex({ tenant_id: 1, user_id: 1, created_at: -1 });
    await db.collection('notifications').createIndex({ tenant_id: 1, user_id: 1, read: 1 });

    // Comments indexes
    await db.collection('comments').createIndex({ record_id: 1, deleted_at: 1, created_at: 1 });
    await db.collection('comments').createIndex({ tenant_id: 1, created_by: 1 });
    await db.collection('comments').createIndex({ parent_id: 1 });

    // Tags and Categories indexes
    await db.collection('tags').createIndex({ tenant_id: 1, name: 1 });
    await db.collection('tags').createIndex({ tenant_id: 1, deleted_at: 1 });
    await db.collection('categories').createIndex({ tenant_id: 1, slug: 1 }, { unique: true, sparse: true });
    await db.collection('categories').createIndex({ tenant_id: 1, parent_id: 1 });
    await db.collection('categories').createIndex({ tenant_id: 1, deleted_at: 1 });
    await db.collection('records').createIndex({ tenant_id: 1, tags: 1 });
    await db.collection('records').createIndex({ tenant_id: 1, category_id: 1 });

    // Favorites indexes
    await db.collection('favorites').createIndex({ tenant_id: 1, user_id: 1, record_id: 1 }, { unique: true });
    await db.collection('favorites').createIndex({ tenant_id: 1, user_id: 1, created_at: -1 });

    // Activity and KB views indexes
    await db.collection('kb_views').createIndex({ tenant_id: 1, kb_id: 1, viewed_at: -1 });
    await db.collection('kb_views').createIndex({ tenant_id: 1, user_id: 1, viewed_at: -1 });
    await db.collection('kb_views').createIndex({ tenant_id: 1, viewed_at: -1 });
    await db.collection('activity_logs').createIndex({ tenant_id: 1, user_id: 1, created_at: -1 });
    await db.collection('activity_logs').createIndex({ tenant_id: 1, action: 1, created_at: -1 });

    // Relations indexes
    await db.collection('record_relations').createIndex({ tenant_id: 1, source_id: 1 });
    await db.collection('record_relations').createIndex({ tenant_id: 1, target_id: 1 });
    await db.collection('record_relations').createIndex({ tenant_id: 1, source_id: 1, target_id: 1, relation_type: 1 });

    // Text search indexes
    await ensureRecordsTextIndex(db);
}

// Nome fixo para conseguir localizar e recriar o indice quando as opcoes
// mudarem (o Mongo gera "title_text_content_md_text_..." por padrao).
const RECORDS_TEXT_INDEX = 'records_text_search';

const RECORDS_TEXT_KEYS = {
    title: 'text',
    content_md: 'text',
    'properties.tags': 'text'
};

const RECORDS_TEXT_OPTIONS = {
    name: RECORDS_TEXT_INDEX,
    // O conteudo deste projeto e majoritariamente em portugues. Sem definir
    // isto, o Mongo assume 'english' e aplica stemming ingles sobre texto
    // PT - na pratica, buscar "incidentes" nao encontra "incidente", e
    // stopwords portuguesas ("de", "para", "com") entram no indice como se
    // fossem termos relevantes.
    default_language: 'portuguese',
    // Permite que um documento declare o proprio idioma, para quando a base
    // tiver KBs em ingles convivendo com os em portugues. Campo dedicado em
    // vez do padrao ('language'), que colidiria com um campo de negocio de
    // mesmo nome.
    language_override: 'search_language'
};

/**
 * Cria o indice de texto de `records` garantindo as opcoes corretas.
 *
 * O Mongo nao permite alterar `default_language` de um indice existente:
 * `createIndex` com opcoes diferentes falha com IndexOptionsConflict. Como
 * esta funcao roda a cada boot, instalacoes antigas (indice em ingles)
 * quebrariam. Por isso derrubamos o indice antigo antes de recriar.
 */
async function ensureRecordsTextIndex(db) {
    const records = db.collection('records');

    // Em base nova a colecao ainda nao existe e listar indices lanca
    // NamespaceNotFound - nesse caso simplesmente nao ha indice antigo.
    let existing = [];
    try {
        existing = await records.indexes();
    } catch (error) {
        if (error.codeName !== 'NamespaceNotFound' && error.code !== 26) throw error;
    }

    const currentTextIndex = existing.find(index => index.textIndexVersion !== undefined);

    const isUpToDate = currentTextIndex &&
        currentTextIndex.name === RECORDS_TEXT_INDEX &&
        currentTextIndex.default_language === RECORDS_TEXT_OPTIONS.default_language &&
        currentTextIndex.language_override === RECORDS_TEXT_OPTIONS.language_override;

    if (isUpToDate) return;

    // Só pode existir um indice de texto por colecao, entao o antigo sai antes.
    if (currentTextIndex) {
        await records.dropIndex(currentTextIndex.name);
    }

    await records.createIndex(RECORDS_TEXT_KEYS, RECORDS_TEXT_OPTIONS);
}
