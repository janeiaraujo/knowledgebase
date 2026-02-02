/**
 * Export Module Routes
 * Handles KB export to PDF and Markdown
 */

import { ObjectId } from 'mongodb';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { checkKBAccess } from '../../middlewares/kbAccess.middleware.js';

export default async function exportRoutes(fastify, options) {

    /**
     * Export KB to Markdown
     */
    fastify.get('/kb/:id/markdown', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { id } = request.params;

        let objectId;
        try {
            objectId = new ObjectId(id);
        } catch (err) {
            return reply.status(400).send({ error: 'Invalid record ID' });
        }

        const record = await db.collection('records').findOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        if (!record) {
            return reply.status(404).send({ error: 'Record not found' });
        }

        // Check access
        const hasAccess = await checkKBAccess(
            db,
            record,
            request.tenantId,
            request.userId,
            request.userRole
        );

        if (!hasAccess) {
            return reply.status(403).send({ error: 'Access denied' });
        }

        // Generate Markdown content
        const markdown = generateMarkdown(record);

        const filename = sanitizeFilename(record.title) + '.md';

        reply
            .header('Content-Type', 'text/markdown; charset=utf-8')
            .header('Content-Disposition', `attachment; filename="${filename}"`)
            .send(markdown);
    });

    /**
     * Export KB to HTML (can be used to generate PDF on client)
     */
    fastify.get('/kb/:id/html', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { id } = request.params;

        let objectId;
        try {
            objectId = new ObjectId(id);
        } catch (err) {
            return reply.status(400).send({ error: 'Invalid record ID' });
        }

        const record = await db.collection('records').findOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        if (!record) {
            return reply.status(404).send({ error: 'Record not found' });
        }

        // Check access
        const hasAccess = await checkKBAccess(
            db,
            record,
            request.tenantId,
            request.userId,
            request.userRole
        );

        if (!hasAccess) {
            return reply.status(403).send({ error: 'Access denied' });
        }

        // Get creator info
        const creator = await db.collection('users').findOne({ _id: record.created_by });

        // Generate HTML content
        const html = generateHTML(record, creator);

        return { html, title: record.title };
    });

    /**
     * Export multiple KBs as zip (Markdown)
     */
    fastify.post('/kb/export-batch', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { ids } = request.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return reply.status(400).send({ error: 'IDs array required' });
        }

        if (ids.length > 50) {
            return reply.status(400).send({ error: 'Maximum 50 KBs per export' });
        }

        const objectIds = ids.map(id => {
            try {
                return new ObjectId(id);
            } catch (err) {
                return null;
            }
        }).filter(Boolean);

        const records = await db.collection('records').find({
            _id: { $in: objectIds },
            tenant_id: request.tenantId
        }).toArray();

        // Generate exports
        const exports = records.map(record => ({
            filename: sanitizeFilename(record.title) + '.md',
            content: generateMarkdown(record)
        }));

        return { exports };
    });

    /**
     * Export KB to JSON
     */
    fastify.get('/kb/:id/json', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { id } = request.params;
        const { include_meta = 'true' } = request.query;

        let objectId;
        try {
            objectId = new ObjectId(id);
        } catch (err) {
            return reply.status(400).send({ error: 'Invalid record ID' });
        }

        const record = await db.collection('records').findOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        if (!record) {
            return reply.status(404).send({ error: 'Record not found' });
        }

        // Check access
        const hasAccess = await checkKBAccess(
            db,
            record,
            request.tenantId,
            request.userId,
            request.userRole
        );

        if (!hasAccess) {
            return reply.status(403).send({ error: 'Access denied' });
        }

        // Get related data
        const [creator, category, tags] = await Promise.all([
            db.collection('users').findOne({ _id: record.created_by }),
            record.category_id ? db.collection('categories').findOne({ _id: record.category_id }) : null,
            record.tags ?.length > 0 ? db.collection('tags').find({ _id: { $in: record.tags } }).toArray() : []
        ]);

        // Build export object
        const exportData = {
            title: record.title,
            content: record.content_md || record.content,
            status: record.status,
            version: record.version
        };

        if (include_meta === 'true') {
            exportData.metadata = {
                id: record._id,
                created_at: record.created_at,
                updated_at: record.updated_at,
                created_by: creator ? { name: creator.name, email: creator.email } : null,
                category: category ?.name || null,
                tags: tags.map(t => t.name),
                properties: record.properties || {},
                custom_properties: record.custom_properties || {}
            };
        }

        const filename = sanitizeFilename(record.title) + '.json';

        reply
            .header('Content-Type', 'application/json; charset=utf-8')
            .header('Content-Disposition', `attachment; filename="${filename}"`)
            .send(JSON.stringify(exportData, null, 2));
    });

    /**
     * Export KB to DOCX-compatible HTML (for Word import)
     */
    fastify.get('/kb/:id/docx-html', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { id } = request.params;

        let objectId;
        try {
            objectId = new ObjectId(id);
        } catch (err) {
            return reply.status(400).send({ error: 'Invalid record ID' });
        }

        const record = await db.collection('records').findOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        if (!record) {
            return reply.status(404).send({ error: 'Record not found' });
        }

        // Check access
        const hasAccess = await checkKBAccess(
            db,
            record,
            request.tenantId,
            request.userId,
            request.userRole
        );

        if (!hasAccess) {
            return reply.status(403).send({ error: 'Access denied' });
        }

        const creator = await db.collection('users').findOne({ _id: record.created_by });

        // Generate Word-compatible HTML
        const html = generateWordHTML(record, creator);

        const filename = sanitizeFilename(record.title) + '.html';

        reply
            .header('Content-Type', 'text/html; charset=utf-8')
            .header('Content-Disposition', `attachment; filename="${filename}"`)
            .send(html);
    });

    /**
     * Export KB to Plain Text
     */
    fastify.get('/kb/:id/txt', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { id } = request.params;

        let objectId;
        try {
            objectId = new ObjectId(id);
        } catch (err) {
            return reply.status(400).send({ error: 'Invalid record ID' });
        }

        const record = await db.collection('records').findOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        if (!record) {
            return reply.status(404).send({ error: 'Record not found' });
        }

        // Check access
        const hasAccess = await checkKBAccess(
            db,
            record,
            request.tenantId,
            request.userId,
            request.userRole
        );

        if (!hasAccess) {
            return reply.status(403).send({ error: 'Access denied' });
        }

        // Generate plain text
        const text = generatePlainText(record);

        const filename = sanitizeFilename(record.title) + '.txt';

        reply
            .header('Content-Type', 'text/plain; charset=utf-8')
            .header('Content-Disposition', `attachment; filename="${filename}"`)
            .send(text);
    });
}

/**
 * Generate Markdown from record
 */
function generateMarkdown(record) {
    const lines = [];

    // Title
    lines.push(`# ${record.title}`);
    lines.push('');

    // Metadata
    lines.push('---');
    lines.push(`Status: ${record.status}`);
    lines.push(`Criado em: ${new Date(record.created_at).toLocaleDateString('pt-BR')}`);
    if (record.updated_at) {
        lines.push(`Atualizado em: ${new Date(record.updated_at).toLocaleDateString('pt-BR')}`);
    }

    // Properties
    if (record.properties) {
        if (record.properties.category) {
            lines.push(`Categoria: ${record.properties.category}`);
        }
        if (record.properties.tags && record.properties.tags.length > 0) {
            lines.push(`Tags: ${record.properties.tags.join(', ')}`);
        }
        if (record.properties.priority) {
            lines.push(`Prioridade: ${record.properties.priority}`);
        }
    }
    lines.push('---');
    lines.push('');

    // Content
    lines.push(record.content_md || '');

    return lines.join('\n');
}

/**
 * Generate HTML from record (for PDF export)
 */
function generateHTML(record, creator) {
    const statusColors = {
        draft: '#ffc107',
        in_review: '#17a2b8',
        approved: '#28a745',
        published: '#007bff',
        rejected: '#dc3545'
    };

    const statusLabels = {
        draft: 'Rascunho',
        in_review: 'Em Revisão',
        approved: 'Aprovado',
        published: 'Publicado',
        rejected: 'Rejeitado'
    };

    // Convert markdown to HTML (basic conversion)
    let content = record.content_md || '';

    // Convert headers
    content = content.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    content = content.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    content = content.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Convert bold and italic
    content = content.replace(/\*\*\*(.*)\*\*\*/gim, '<strong><em>$1</em></strong>');
    content = content.replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>');
    content = content.replace(/\*(.*)\*/gim, '<em>$1</em>');

    // Convert code blocks
    content = content.replace(/```(\w+)?\n([\s\S]*?)```/gim, '<pre><code>$2</code></pre>');
    content = content.replace(/`([^`]+)`/gim, '<code>$1</code>');

    // Convert links
    content = content.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>');

    // Convert lists
    content = content.replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>');
    content = content.replace(/(<li>.*<\/li>\n?)+/gim, '<ul>$&</ul>');

    // Convert line breaks
    content = content.replace(/\n\n/g, '</p><p>');
    content = `<p>${content}</p>`;

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(record.title)}</title>
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .header {
      border-bottom: 2px solid #eee;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .title {
      font-size: 2rem;
      margin: 0 0 10px 0;
      color: #1a1a1a;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      font-size: 0.9rem;
      color: #666;
    }
    .status {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 4px;
      font-size: 0.8rem;
      font-weight: 500;
      color: white;
    }
    .content {
      font-size: 1rem;
    }
    .content h1, .content h2, .content h3 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
    }
    .content h1 { font-size: 1.5rem; }
    .content h2 { font-size: 1.3rem; }
    .content h3 { font-size: 1.1rem; }
    .content p {
      margin-bottom: 1em;
    }
    .content code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Fira Code', 'Consolas', monospace;
      font-size: 0.9em;
    }
    .content pre {
      background: #f4f4f4;
      padding: 15px;
      border-radius: 6px;
      overflow-x: auto;
    }
    .content pre code {
      background: none;
      padding: 0;
    }
    .content ul, .content ol {
      padding-left: 2em;
    }
    .content li {
      margin-bottom: 0.5em;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      font-size: 0.85rem;
      color: #888;
    }
    @media print {
      body {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="title">${escapeHtml(record.title)}</h1>
    <div class="meta">
      <span class="status" style="background-color: ${statusColors[record.status] || '#6c757d'}">
        ${statusLabels[record.status] || record.status}
      </span>
      ${record.properties?.category ? `<span>📁 ${escapeHtml(record.properties.category)}</span>` : ''}
      ${record.properties?.tags?.length > 0 ? `<span>🏷️ ${record.properties.tags.map(t => escapeHtml(t)).join(', ')}</span>` : ''}
    </div>
  </div>
  
  <div class="content">
    ${content}
  </div>
  
  <div class="footer">
    <p>
      Criado em ${new Date(record.created_at).toLocaleDateString('pt-BR')}
      ${creator ? ` por ${escapeHtml(creator.name || creator.email)}` : ''}
      ${record.updated_at ? ` • Atualizado em ${new Date(record.updated_at).toLocaleDateString('pt-BR')}` : ''}
    </p>
  </div>
</body>
</html>`;
  
  return html;
}

/**
 * Sanitize filename
 */
function sanitizeFilename(name) {
  return name
    .replace(/[^a-zA-Z0-9\u00C0-\u024F\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .substring(0, 100);
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate Word-compatible HTML
 */
function generateWordHTML(record, creator) {
  const content = record.content_md || record.content || '';
  
  // Convert markdown to simple HTML for Word
  let htmlContent = convertMarkdownToHTML(content);
  
  const statusLabels = {
    draft: 'Rascunho',
    review: 'Em Revisão',
    published: 'Publicado',
    archived: 'Arquivado'
  };

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <meta name="ProgId" content="Word.Document">
  <meta name="Generator" content="KB Platform">
  <meta name="Originator" content="KB Platform">
  <title>${escapeHtml(record.title)}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page {
      size: A4;
      margin: 2.5cm;
    }
    body {
      font-family: 'Calibri', sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #333;
    }
    h1 {
      font-size: 24pt;
      color: #1a1a1a;
      margin-bottom: 12pt;
      page-break-after: avoid;
    }
    h2 {
      font-size: 16pt;
      color: #2c3e50;
      margin-top: 18pt;
      margin-bottom: 6pt;
      page-break-after: avoid;
    }
    h3 {
      font-size: 13pt;
      color: #34495e;
      margin-top: 12pt;
      margin-bottom: 6pt;
      page-break-after: avoid;
    }
    p {
      margin: 0 0 6pt 0;
    }
    pre, code {
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 10pt;
      background-color: #f4f4f4;
      padding: 2pt 4pt;
    }
    pre {
      border: 1pt solid #ddd;
      padding: 6pt;
      white-space: pre-wrap;
      page-break-inside: avoid;
    }
    ul, ol {
      margin: 6pt 0 6pt 18pt;
    }
    li {
      margin-bottom: 3pt;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 12pt 0;
    }
    th, td {
      border: 1pt solid #666;
      padding: 6pt;
      text-align: left;
    }
    th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
    .metadata {
      background-color: #f8f9fa;
      border: 1pt solid #ddd;
      padding: 12pt;
      margin-bottom: 18pt;
    }
    .metadata p {
      margin: 3pt 0;
    }
    blockquote {
      border-left: 3pt solid #ccc;
      margin: 12pt 0;
      padding-left: 12pt;
      font-style: italic;
      color: #666;
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(record.title)}</h1>
  
  <div class="metadata">
    <p><strong>Status:</strong> ${statusLabels[record.status] || record.status}</p>
    <p><strong>Versão:</strong> ${record.version || 1}</p>
    <p><strong>Criado em:</strong> ${new Date(record.created_at).toLocaleDateString('pt-BR')}</p>
    ${record.updated_at ? `<p><strong>Atualizado em:</strong> ${new Date(record.updated_at).toLocaleDateString('pt-BR')}</p>` : ''}
    ${creator ? `<p><strong>Autor:</strong> ${escapeHtml(creator.name || creator.email)}</p>` : ''}
    ${record.properties?.category ? `<p><strong>Categoria:</strong> ${escapeHtml(record.properties.category)}</p>` : ''}
    ${record.properties?.tags?.length > 0 ? `<p><strong>Tags:</strong> ${record.properties.tags.map(t => escapeHtml(t)).join(', ')}</p>` : ''}
  </div>
  
  ${htmlContent}
</body>
</html>`;
}

/**
 * Convert Markdown to simple HTML
 */
function convertMarkdownToHTML(markdown) {
  if (!markdown) return '';
  
  let html = markdown;
  
  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Bold and italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/\_\_(.*?)\_\_/g, '<strong>$1</strong>');
  html = html.replace(/\_(.*?)\_/g, '<em>$1</em>');
  
  // Code blocks
  html = html.replace(/```[\w]*\n([\s\S]*?)```/g, '<pre>$1</pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Blockquotes
  html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');
  
  // Horizontal rule
  html = html.replace(/^---$/gim, '<hr>');
  html = html.replace(/^\*\*\*$/gim, '<hr>');
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  
  // Unordered lists
  html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
  
  // Ordered lists (simplified)
  html = html.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');
  
  // Wrap consecutive li elements in ul
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  
  // Paragraphs - wrap text blocks
  const lines = html.split('\n');
  const result = [];
  let inParagraph = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inParagraph) {
        result.push('</p>');
        inParagraph = false;
      }
      result.push('');
    } else if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || 
               trimmed.startsWith('<pre') || trimmed.startsWith('<blockquote') ||
               trimmed.startsWith('<hr') || trimmed.startsWith('<li')) {
      if (inParagraph) {
        result.push('</p>');
        inParagraph = false;
      }
      result.push(line);
    } else {
      if (!inParagraph) {
        result.push('<p>' + line);
        inParagraph = true;
      } else {
        result.push(line);
      }
    }
  }
  
  if (inParagraph) {
    result.push('</p>');
  }
  
  return result.join('\n');
}

/**
 * Generate Plain Text export
 */
function generatePlainText(record) {
  const content = record.content_md || record.content || '';
  
  const statusLabels = {
    draft: 'Rascunho',
    review: 'Em Revisão',
    published: 'Publicado',
    archived: 'Arquivado'
  };

  const divider = '='.repeat(60);
  const subDivider = '-'.repeat(40);
  
  let text = `${divider}
${record.title.toUpperCase()}
${divider}

Status: ${statusLabels[record.status] || record.status}
Versão: ${record.version || 1}
Criado em: ${new Date(record.created_at).toLocaleDateString('pt-BR')}`;

  if (record.updated_at) {
    text += `\nAtualizado em: ${new Date(record.updated_at).toLocaleDateString('pt-BR')}`;
  }
  
  if (record.properties?.category) {
    text += `\nCategoria: ${record.properties.category}`;
  }
  
  if (record.properties?.tags?.length > 0) {
    text += `\nTags: ${record.properties.tags.join(', ')}`;
  }

  text += `\n\n${subDivider}
CONTEÚDO
${subDivider}

`;

  // Strip markdown formatting for plain text
  let plainContent = content;
  
  // Remove markdown headers, keep text
  plainContent = plainContent.replace(/^#{1,6}\s+/gm, '');
  
  // Remove bold/italic markers
  plainContent = plainContent.replace(/\*\*\*(.*?)\*\*\*/g, '$1');
  plainContent = plainContent.replace(/\*\*(.*?)\*\*/g, '$1');
  plainContent = plainContent.replace(/\*(.*?)\*/g, '$1');
  plainContent = plainContent.replace(/\_\_(.*?)\_\_/g, '$1');
  plainContent = plainContent.replace(/\_(.*?)\_/g, '$1');
  
  // Remove code markers
  plainContent = plainContent.replace(/```[\w]*\n?/g, '');
  plainContent = plainContent.replace(/`([^`]+)`/g, '$1');
  
  // Convert links to text with URL
  plainContent = plainContent.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
  
  // Remove images
  plainContent = plainContent.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '[Imagem: $1]');
  
  // Convert blockquotes
  plainContent = plainContent.replace(/^\> /gm, '  | ');
  
  // Convert horizontal rules
  plainContent = plainContent.replace(/^---$/gm, subDivider);
  plainContent = plainContent.replace(/^\*\*\*$/gm, subDivider);
  
  text += plainContent;
  
  text += `\n\n${divider}
Exportado de KB Platform em ${new Date().toLocaleDateString('pt-BR')}
${divider}`;

  return text;
}