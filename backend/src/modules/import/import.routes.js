/**
 * Import Module Routes
 * Handles importing KBs from various sources (Markdown, Confluence, Notion, etc.)
 */

import { ObjectId } from 'mongodb';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { Readable } from 'stream';

export default async function importRoutes(fastify, options) {

    /**
     * Import from Markdown file(s)
     */
    fastify.post('/markdown', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const parts = request.parts();

        const imported = [];
        const errors = [];
        let category_id = null;
        let tags = [];

        for await (const part of parts) {
            if (part.type === 'field') {
                if (part.fieldname === 'category_id') category_id = part.value;
                if (part.fieldname === 'tags') tags = JSON.parse(part.value || '[]');
                continue;
            }

            if (part.type === 'file') {
                try {
                    const chunks = [];
                    for await (const chunk of part.file) {
                        chunks.push(chunk);
                    }
                    const content = Buffer.concat(chunks).toString('utf-8');

                    // Extract title from first heading or filename
                    let title = part.filename.replace(/\.md$/i, '');
                    const titleMatch = content.match(/^#\s+(.+)$/m);
                    if (titleMatch) {
                        title = titleMatch[1].trim();
                    }

                    // Create KB record
                    const record = {
                        tenant_id: request.tenantId,
                        title,
                        content_md: content,
                        content: content, // Store as plain text too
                        status: 'draft',
                        version: 1,
                        category_id: category_id ? new ObjectId(category_id) : null,
                        tags: tags.map(id => new ObjectId(id)),
                        source: 'import_markdown',
                        source_file: part.filename,
                        created_by: request.userId,
                        created_at: new Date(),
                        updated_at: new Date()
                    };

                    const result = await db.collection('records').insertOne(record);
                    imported.push({
                        id: result.insertedId,
                        title,
                        filename: part.filename
                    });
                } catch (err) {
                    errors.push({
                        filename: part.filename,
                        error: err.message
                    });
                }
            }
        }

        return {
            success: true,
            imported: imported.length,
            failed: errors.length,
            records: imported,
            errors
        };
    });

    /**
     * Import from JSON (bulk import)
     */
    fastify.post('/json', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { records, category_id, tags = [] } = request.body;

        if (!Array.isArray(records) || records.length === 0) {
            return reply.status(400).send({ error: 'Records array is required' });
        }

        const imported = [];
        const errors = [];

        for (const item of records) {
            try {
                if (!item.title || !item.content) {
                    throw new Error('Title and content are required');
                }

                const record = {
                    tenant_id: request.tenantId,
                    title: item.title,
                    content_md: item.content,
                    content: item.content,
                    status: item.status || 'draft',
                    version: 1,
                    category_id: (item.category_id || category_id) ? new ObjectId(item.category_id || category_id) : null,
                    tags: (item.tags || tags).map(id => new ObjectId(id)),
                    properties: item.properties || {},
                    custom_properties: item.custom_properties || {},
                    source: 'import_json',
                    created_by: request.userId,
                    created_at: new Date(),
                    updated_at: new Date()
                };

                const result = await db.collection('records').insertOne(record);
                imported.push({
                    id: result.insertedId,
                    title: item.title
                });
            } catch (err) {
                errors.push({
                    title: item.title || 'Unknown',
                    error: err.message
                });
            }
        }

        return {
            success: true,
            imported: imported.length,
            failed: errors.length,
            records: imported,
            errors
        };
    });

    /**
     * Import from Confluence (via API)
     */
    fastify.post('/confluence', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const {
            confluence_url,
            api_token,
            email,
            space_key,
            page_ids = [],
            category_id,
            tags = []
        } = request.body;

        if (!confluence_url || !api_token || !email) {
            return reply.status(400).send({
                error: 'Confluence URL, API token, and email are required'
            });
        }

        const imported = [];
        const errors = [];

        // Helper to fetch from Confluence
        const fetchConfluence = async(endpoint) => {
            const auth = Buffer.from(`${email}:${api_token}`).toString('base64');
            const response = await fetch(`${confluence_url}/wiki/rest/api${endpoint}`, {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Confluence API error: ${response.status}`);
            }

            return response.json();
        };

        // Convert Confluence storage format to Markdown (basic)
        const confluenceToMarkdown = (html) => {
            return html
                .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
                .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
                .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
                .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
                .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
                .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
                .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
                .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
                .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
                .replace(/<ul[^>]*>|<\/ul>/gi, '')
                .replace(/<ol[^>]*>|<\/ol>/gi, '')
                .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<[^>]+>/g, '') // Remove remaining HTML tags
                .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
                .trim();
        };

        try {
            let pagesToImport = page_ids;

            // If no specific pages, get all pages from space
            if (pagesToImport.length === 0 && space_key) {
                const spaceContent = await fetchConfluence(
                    `/content?spaceKey=${space_key}&type=page&limit=50&expand=body.storage`
                );
                pagesToImport = spaceContent.results.map(p => p.id);
            }

            // Import each page
            for (const pageId of pagesToImport) {
                try {
                    const page = await fetchConfluence(
                        `/content/${pageId}?expand=body.storage,version`
                    );

                    const content = confluenceToMarkdown(page.body.storage.value);

                    const record = {
                        tenant_id: request.tenantId,
                        title: page.title,
                        content_md: content,
                        content,
                        status: 'draft',
                        version: 1,
                        category_id: category_id ? new ObjectId(category_id) : null,
                        tags: tags.map(id => new ObjectId(id)),
                        properties: {},
                        source: 'import_confluence',
                        source_url: `${confluence_url}/wiki${page._links.webui}`,
                        source_id: pageId,
                        created_by: request.userId,
                        created_at: new Date(),
                        updated_at: new Date()
                    };

                    const result = await db.collection('records').insertOne(record);
                    imported.push({
                        id: result.insertedId,
                        title: page.title,
                        source_id: pageId
                    });
                } catch (err) {
                    errors.push({
                        page_id: pageId,
                        error: err.message
                    });
                }
            }
        } catch (err) {
            return reply.status(500).send({
                error: `Confluence import failed: ${err.message}`
            });
        }

        return {
            success: true,
            imported: imported.length,
            failed: errors.length,
            records: imported,
            errors
        };
    });

    /**
     * Import from Notion (via API)
     */
    fastify.post('/notion', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const {
            api_key,
            database_id,
            page_ids = [],
            category_id,
            tags = []
        } = request.body;

        if (!api_key) {
            return reply.status(400).send({ error: 'Notion API key is required' });
        }

        const imported = [];
        const errors = [];

        // Helper to fetch from Notion
        const fetchNotion = async(endpoint, method = 'GET', body = null) => {
            const options = {
                method,
                headers: {
                    'Authorization': `Bearer ${api_key}`,
                    'Notion-Version': '2022-06-28',
                    'Content-Type': 'application/json'
                }
            };

            if (body) options.body = JSON.stringify(body);

            const response = await fetch(`https://api.notion.com/v1${endpoint}`, options);

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || `Notion API error: ${response.status}`);
            }

            return response.json();
        };

        // Convert Notion blocks to Markdown
        const blocksToMarkdown = (blocks) => {
            return blocks.map(block => {
                const text = block[block.type] ?.rich_text ?.map(t => {
                    let content = t.plain_text;
                    if (t.annotations ?.bold) content = `**${content}**`;
                    if (t.annotations ?.italic) content = `*${content}*`;
                    if (t.annotations ?.code) content = `\`${content}\``;
                    return content;
                }).join('') || '';

                switch (block.type) {
                    case 'heading_1':
                        return `# ${text}\n\n`;
                    case 'heading_2':
                        return `## ${text}\n\n`;
                    case 'heading_3':
                        return `### ${text}\n\n`;
                    case 'paragraph':
                        return `${text}\n\n`;
                    case 'bulleted_list_item':
                        return `- ${text}\n`;
                    case 'numbered_list_item':
                        return `1. ${text}\n`;
                    case 'code':
                        return `\`\`\`${block.code?.language || ''}\n${text}\n\`\`\`\n\n`;
                    case 'quote':
                        return `> ${text}\n\n`;
                    case 'divider':
                        return '---\n\n';
                    default:
                        return text ? `${text}\n\n` : '';
                }
            }).join('').trim();
        };

        // Get page title from properties
        const getPageTitle = (page) => {
            const titleProp = Object.values(page.properties || {}).find(p => p.type === 'title');
            return titleProp ?.title ?.[0] ?.plain_text || 'Untitled';
        };

        try {
            let pagesToImport = page_ids;

            // If database_id provided, get all pages from database
            if (pagesToImport.length === 0 && database_id) {
                const dbContent = await fetchNotion(`/databases/${database_id}/query`, 'POST', {
                    page_size: 50
                });
                pagesToImport = dbContent.results.map(p => p.id);
            }

            // Import each page
            for (const pageId of pagesToImport) {
                try {
                    const page = await fetchNotion(`/pages/${pageId}`);
                    const blocks = await fetchNotion(`/blocks/${pageId}/children`);

                    const title = getPageTitle(page);
                    const content = blocksToMarkdown(blocks.results || []);

                    const record = {
                        tenant_id: request.tenantId,
                        title,
                        content_md: content,
                        content,
                        status: 'draft',
                        version: 1,
                        category_id: category_id ? new ObjectId(category_id) : null,
                        tags: tags.map(id => new ObjectId(id)),
                        properties: {},
                        source: 'import_notion',
                        source_url: page.url,
                        source_id: pageId,
                        created_by: request.userId,
                        created_at: new Date(),
                        updated_at: new Date()
                    };

                    const result = await db.collection('records').insertOne(record);
                    imported.push({
                        id: result.insertedId,
                        title,
                        source_id: pageId
                    });
                } catch (err) {
                    errors.push({
                        page_id: pageId,
                        error: err.message
                    });
                }
            }
        } catch (err) {
            return reply.status(500).send({
                error: `Notion import failed: ${err.message}`
            });
        }

        return {
            success: true,
            imported: imported.length,
            failed: errors.length,
            records: imported,
            errors
        };
    });

    /**
     * Parse and preview content before import
     */
    fastify.post('/preview', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const { content, source_type } = request.body;

        if (!content) {
            return reply.status(400).send({ error: 'Content is required' });
        }

        let title = 'Untitled';
        let parsedContent = content;

        // Extract title based on source type
        if (source_type === 'markdown') {
            const titleMatch = content.match(/^#\s+(.+)$/m);
            if (titleMatch) {
                title = titleMatch[1].trim();
            }
        }

        // Count elements for preview
        const stats = {
            characters: content.length,
            words: content.split(/\s+/).filter(w => w).length,
            lines: content.split('\n').length,
            headings: (content.match(/^#+\s+/gm) || []).length,
            code_blocks: (content.match(/```/g) || []).length / 2,
            links: (content.match(/\[([^\]]+)\]\([^)]+\)/g) || []).length
        };

        return {
            title,
            content: parsedContent.slice(0, 1000) + (parsedContent.length > 1000 ? '...' : ''),
            stats,
            source_type
        };
    });

    /**
     * Get import history
     */
    fastify.get('/history', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { page = 1, limit = 20 } = request.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [imports, total] = await Promise.all([
            db.collection('records')
            .find({
                tenant_id: request.tenantId,
                source: { $regex: /^import_/ }
            })
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .project({
                _id: 1,
                title: 1,
                source: 1,
                source_url: 1,
                source_file: 1,
                created_at: 1
            })
            .toArray(),
            db.collection('records').countDocuments({
                tenant_id: request.tenantId,
                source: { $regex: /^import_/ }
            })
        ]);

        return {
            imports,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit))
            }
        };
    });
}