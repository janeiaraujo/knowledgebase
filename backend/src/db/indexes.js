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
    await db.collection('records').createIndex({
        title: 'text',
        content_md: 'text',
        'properties.tags': 'text'
    });
}
