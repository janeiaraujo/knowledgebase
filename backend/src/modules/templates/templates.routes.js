import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import { toObjectId } from '../../utils/mongodb.js';

export default async function templatesRoutes(fastify, options) {

    // List all templates
    fastify.get('/', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { category, is_default } = request.query;

        const filter = {
            $or: [
                { tenant_id: request.tenantId },
                { is_system: true }
            ]
        };

        if (category) {
            filter.category = category;
        }

        if (is_default !== undefined) {
            filter.is_default = is_default === 'true';
        }

        const templates = await db.collection('kb_templates')
            .find(filter)
            .sort({ is_system: -1, is_default: -1, name: 1 })
            .toArray();

        return { templates };
    });

    // Get template by ID
    fastify.get('/:templateId', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { templateId } = request.params;

        const objectId = toObjectId(templateId);
        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid template ID' });
        }

        const template = await db.collection('kb_templates').findOne({
            _id: objectId,
            $or: [
                { tenant_id: request.tenantId },
                { is_system: true }
            ]
        });

        if (!template) {
            return reply.status(404).send({ error: 'Template not found' });
        }

        return { template };
    });

    // Create template
    fastify.post('/', {
        preHandler: [authMiddleware, tenantMiddleware, requirePermission('kb:create')]
    }, async(request, reply) => {
        const db = fastify.db();
        const {
            name,
            description,
            category,
            content_md,
            properties,
            custom_properties,
            is_default
        } = request.body;

        if (!name || !content_md) {
            return reply.status(400).send({ error: 'Name and content are required' });
        }

        // If setting as default, unset other defaults in same category
        if (is_default && category) {
            await db.collection('kb_templates').updateMany({
                tenant_id: request.tenantId,
                category,
                is_default: true
            }, { $set: { is_default: false } });
        }

        const template = {
            tenant_id: request.tenantId,
            name,
            description: description || '',
            category: category || 'general',
            content_md,
            properties: properties || {},
            custom_properties: custom_properties || {},
            is_default: is_default || false,
            is_system: false,
            created_by: request.currentUser._id,
            created_at: new Date(),
            updated_at: new Date(),
            usage_count: 0
        };

        const result = await db.collection('kb_templates').insertOne(template);

        return {
            success: true,
            templateId: result.insertedId,
            template: {...template, _id: result.insertedId }
        };
    });

    // Update template
    fastify.patch('/:templateId', {
        preHandler: [authMiddleware, tenantMiddleware, requirePermission('kb:edit')]
    }, async(request, reply) => {
        const db = fastify.db();
        const { templateId } = request.params;
        const { name, description, category, content_md, properties, custom_properties, is_default } = request.body;

        const objectId = toObjectId(templateId);
        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid template ID' });
        }

        // Can't edit system templates
        const template = await db.collection('kb_templates').findOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        if (!template) {
            return reply.status(404).send({ error: 'Template not found or cannot be edited' });
        }

        if (template.is_system) {
            return reply.status(403).send({ error: 'System templates cannot be modified' });
        }

        // If setting as default, unset other defaults
        if (is_default && category) {
            await db.collection('kb_templates').updateMany({
                tenant_id: request.tenantId,
                category: category || template.category,
                is_default: true,
                _id: { $ne: objectId }
            }, { $set: { is_default: false } });
        }

        const updates = {
            ...(name && { name }),
            ...(description !== undefined && { description }),
            ...(category && { category }),
            ...(content_md && { content_md }),
            ...(properties && { properties }),
            ...(custom_properties && { custom_properties }),
            ...(is_default !== undefined && { is_default }),
            updated_at: new Date()
        };

        await db.collection('kb_templates').updateOne({ _id: objectId }, { $set: updates });

        return { success: true };
    });

    // Delete template
    fastify.delete('/:templateId', {
        preHandler: [authMiddleware, tenantMiddleware, requirePermission('kb:delete')]
    }, async(request, reply) => {
        const db = fastify.db();
        const { templateId } = request.params;

        const objectId = toObjectId(templateId);
        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid template ID' });
        }

        const template = await db.collection('kb_templates').findOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        if (!template) {
            return reply.status(404).send({ error: 'Template not found' });
        }

        if (template.is_system) {
            return reply.status(403).send({ error: 'System templates cannot be deleted' });
        }

        await db.collection('kb_templates').deleteOne({ _id: objectId });

        return { success: true };
    });

    // Duplicate template
    fastify.post('/:templateId/duplicate', {
        preHandler: [authMiddleware, tenantMiddleware, requirePermission('kb:create')]
    }, async(request, reply) => {
        const db = fastify.db();
        const { templateId } = request.params;
        const { name } = request.body;

        const objectId = toObjectId(templateId);
        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid template ID' });
        }

        const original = await db.collection('kb_templates').findOne({
            _id: objectId,
            $or: [
                { tenant_id: request.tenantId },
                { is_system: true }
            ]
        });

        if (!original) {
            return reply.status(404).send({ error: 'Template not found' });
        }

        const newTemplate = {
            tenant_id: request.tenantId,
            name: name || `${original.name} (Copy)`,
            description: original.description,
            category: original.category,
            content_md: original.content_md,
            properties: original.properties,
            custom_properties: original.custom_properties,
            is_default: false,
            is_system: false,
            created_by: request.currentUser._id,
            created_at: new Date(),
            updated_at: new Date(),
            usage_count: 0
        };

        const result = await db.collection('kb_templates').insertOne(newTemplate);

        return {
            success: true,
            templateId: result.insertedId,
            template: {...newTemplate, _id: result.insertedId }
        };
    });

    // Use template (increment usage and return content)
    fastify.post('/:templateId/use', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();
        const { templateId } = request.params;

        const objectId = toObjectId(templateId);
        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid template ID' });
        }

        const template = await db.collection('kb_templates').findOne({
            _id: objectId,
            $or: [
                { tenant_id: request.tenantId },
                { is_system: true }
            ]
        });

        if (!template) {
            return reply.status(404).send({ error: 'Template not found' });
        }

        // Increment usage count
        await db.collection('kb_templates').updateOne({ _id: objectId }, { $inc: { usage_count: 1 } });

        return {
            template: {
                content_md: template.content_md,
                properties: template.properties,
                custom_properties: template.custom_properties
            }
        };
    });

    // Get template categories
    fastify.get('/meta/categories', {
        preHandler: [authMiddleware, tenantMiddleware]
    }, async(request, reply) => {
        const db = fastify.db();

        const categories = await db.collection('kb_templates').distinct('category', {
            $or: [
                { tenant_id: request.tenantId },
                { is_system: true }
            ]
        });

        return { categories };
    });

    // Seed default system templates
    fastify.post('/seed-defaults', {
        preHandler: [authMiddleware, tenantMiddleware, requirePermission('admin')]
    }, async(request, reply) => {
        const db = fastify.db();

        const defaultTemplates = [{
                name: 'Incident Response',
                description: 'Template for documenting incident responses and resolutions',
                category: 'incident',
                content_md: `# Incident Response: [Incident Title]

## Summary
Brief description of the incident.

## Timeline
| Time | Event |
|------|-------|
| HH:MM | Initial detection |
| HH:MM | First response |
| HH:MM | Resolution |

## Impact
- **Affected Systems**: 
- **Affected Users**: 
- **Duration**: 

## Root Cause
Detailed explanation of what caused the incident.

## Resolution
Steps taken to resolve the incident.

## Prevention
Measures to prevent recurrence.

## Lessons Learned
Key takeaways from this incident.
`,
                properties: {
                    priority: 'medium',
                    category: 'incident'
                },
                is_system: true,
                is_default: true
            },
            {
                name: 'How-To Guide',
                description: 'Step-by-step guide template',
                category: 'guide',
                content_md: `# How to: [Task Title]

## Overview
Brief description of what this guide covers.

## Prerequisites
- Prerequisite 1
- Prerequisite 2

## Steps

### Step 1: [Step Title]
Description of step 1.

\`\`\`bash
# Example command
\`\`\`

### Step 2: [Step Title]
Description of step 2.

### Step 3: [Step Title]
Description of step 3.

## Verification
How to verify the task was completed successfully.

## Troubleshooting
Common issues and solutions.

## Related Documents
- Link to related KB
`,
                properties: {
                    category: 'documentation'
                },
                is_system: true,
                is_default: true
            },
            {
                name: 'Troubleshooting',
                description: 'Problem-solution documentation template',
                category: 'troubleshooting',
                content_md: `# Troubleshooting: [Issue Title]

## Problem Description
Clear description of the problem or error.

## Symptoms
- Symptom 1
- Symptom 2
- Error messages: \`error message here\`

## Environment
- **System**: 
- **Version**: 
- **Configuration**: 

## Cause
Root cause of the issue.

## Solution

### Quick Fix
Immediate workaround if available.

### Permanent Solution
1. Step 1
2. Step 2
3. Step 3

## Prevention
How to prevent this issue in the future.

## Related Issues
- Link to similar issues
`,
                properties: {
                    priority: 'high',
                    category: 'troubleshooting'
                },
                is_system: true,
                is_default: true
            },
            {
                name: 'API Documentation',
                description: 'Template for documenting APIs',
                category: 'api',
                content_md: `# API: [API Name]

## Overview
Brief description of the API.

## Base URL
\`\`\`
https://api.example.com/v1
\`\`\`

## Authentication
Describe authentication method.

## Endpoints

### GET /resource
Description of endpoint.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| param1 | string | Yes | Description |

**Response:**
\`\`\`json
{
  "data": {}
}
\`\`\`

### POST /resource
Description of endpoint.

**Request Body:**
\`\`\`json
{
  "field": "value"
}
\`\`\`

**Response:**
\`\`\`json
{
  "id": "123",
  "created_at": "2024-01-01T00:00:00Z"
}
\`\`\`

## Error Codes
| Code | Message | Description |
|------|---------|-------------|
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Invalid token |

## Rate Limits
Describe rate limiting.
`,
                properties: {
                    category: 'documentation'
                },
                is_system: true
            },
            {
                name: 'Runbook',
                description: 'Operational runbook template',
                category: 'runbook',
                content_md: `# Runbook: [Service/Process Name]

## Overview
Brief description of this runbook.

## When to Use
Circumstances that require this runbook.

## Prerequisites
- [ ] Access to system X
- [ ] Required permissions
- [ ] Necessary tools installed

## Procedure

### 1. Pre-checks
- [ ] Verify system status
- [ ] Check dependencies

### 2. Execution Steps
\`\`\`bash
# Step 1
command here

# Step 2
another command
\`\`\`

### 3. Verification
- [ ] Verify step completed
- [ ] Check logs for errors

### 4. Rollback (if needed)
Steps to undo changes if something goes wrong.

## Contacts
| Role | Name | Contact |
|------|------|---------|
| Primary | Name | email@example.com |
| Backup | Name | email@example.com |

## Related Documents
- Link to architecture docs
- Link to monitoring dashboard
`,
                properties: {
                    priority: 'high',
                    category: 'operations'
                },
                is_system: true,
                is_default: true
            },
            {
                name: 'Meeting Notes',
                description: 'Template for meeting documentation',
                category: 'meeting',
                content_md: `# Meeting: [Meeting Title]

**Date:** YYYY-MM-DD
**Time:** HH:MM - HH:MM
**Location/Link:** 

## Attendees
- @name1
- @name2

## Agenda
1. Topic 1
2. Topic 2
3. Topic 3

## Discussion Notes

### Topic 1
Notes from discussion.

### Topic 2
Notes from discussion.

## Action Items
| Action | Owner | Due Date |
|--------|-------|----------|
| Action 1 | @name | YYYY-MM-DD |
| Action 2 | @name | YYYY-MM-DD |

## Decisions Made
- Decision 1
- Decision 2

## Next Meeting
Date and time of next meeting.
`,
                properties: {
                    category: 'general'
                },
                is_system: true
            }
        ];

        // Add tenant_id and timestamps to all templates
        const templatesWithMeta = defaultTemplates.map(t => ({
            ...t,
            tenant_id: null, // System templates are global
            created_at: new Date(),
            updated_at: new Date(),
            usage_count: 0
        }));

        // Only insert if system templates don't exist
        const existingCount = await db.collection('kb_templates').countDocuments({ is_system: true });

        if (existingCount === 0) {
            await db.collection('kb_templates').insertMany(templatesWithMeta);
            return { success: true, message: `Seeded ${templatesWithMeta.length} default templates` };
        }

        return { success: true, message: 'Default templates already exist' };
    });
}