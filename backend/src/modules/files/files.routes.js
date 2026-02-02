import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { toObjectId } from '../../utils/mongodb.js';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import fs from 'fs';
import path from 'path';

const hasR2Config = () => {
    return Boolean(
        process.env.R2_ACCOUNT_ID &&
        process.env.R2_ACCESS_KEY_ID &&
        process.env.R2_SECRET_ACCESS_KEY &&
        process.env.R2_BUCKET_NAME &&
        process.env.R2_PUBLIC_URL
    );
};

const getR2Client = () => {
    if (!hasR2Config()) return null;
    return new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
        }
    });
};

const getUploadsDir = () => path.resolve(process.cwd(), 'uploads');

export default async function fileRoutes(fastify, options) {

    // Public file access (fallback local storage)
    fastify.get('/public/:tenantId/:fileName', async(request, reply) => {
        const { tenantId, fileName } = request.params;
        const safeTenant = String(tenantId).replace(/[^a-f0-9]/gi, '');
        const safeFile = path.basename(String(fileName));

        const absolutePath = path.join(getUploadsDir(), safeTenant, safeFile);
        if (!fs.existsSync(absolutePath)) {
            return reply.status(404).send({ error: 'File not found' });
        }

        // Best-effort content-type
        const ext = path.extname(safeFile).toLowerCase();
        const mimetypes = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
            '.pdf': 'application/pdf'
        };
        reply.type(mimetypes[ext] || 'application/octet-stream');

        const stream = fs.createReadStream(absolutePath);
        return reply.send(stream);
    });

    // Upload file
    fastify.post('/upload', {
        preHandler: [authMiddleware, tenantMiddleware, requirePermission('file:upload')]
    }, async(request, reply) => {
        try {
            const db = fastify.db();
            const data = await request.file();

            if (!data) {
                return reply.status(400).send({ error: 'No file provided' });
            }

            const { filename, mimetype } = data;

            if (!filename) {
                return reply.status(400).send({ error: 'No filename provided' });
            }

            // Generate unique file key with tenant isolation
            const tenantIdStr = request.tenantId.toString();
            const fileId = crypto.randomBytes(16).toString('hex');
            const fileExtension = filename.split('.').pop() || 'bin';
            const fileKey = `${tenantIdStr}/${fileId}.${fileExtension}`;

            // Buffer the file
            const chunks = [];
            for await (const chunk of data.file) {
                chunks.push(chunk);
            }
            const fileBuffer = Buffer.concat(chunks);

            if (fileBuffer.length === 0) {
                return reply.status(400).send({ error: 'Empty file' });
            }

            let url;
            let storage = 'local';

            // Helper function to save locally
            const saveLocally = () => {
                const uploadsDir = path.join(getUploadsDir(), tenantIdStr);
                fs.mkdirSync(uploadsDir, { recursive: true });
                const absolutePath = path.join(uploadsDir, `${fileId}.${fileExtension}`);
                fs.writeFileSync(absolutePath, fileBuffer);
                return `${process.env.BACKEND_PUBLIC_URL || 'http://localhost:3000'}/api/files/public/${tenantIdStr}/${fileId}.${fileExtension}`;
            };

            const r2Client = getR2Client();
            if (r2Client) {
                try {
                    await r2Client.send(new PutObjectCommand({
                        Bucket: process.env.R2_BUCKET_NAME,
                        Key: fileKey,
                        Body: fileBuffer,
                        ContentType: mimetype,
                        Metadata: {
                            tenant_id: tenantIdStr,
                            uploaded_by: request.currentUser._id.toString(),
                            original_filename: filename
                        }
                    }));
                    url = `${process.env.R2_PUBLIC_URL}/${fileKey}`;
                    storage = 'r2';
                } catch (r2Error) {
                    console.warn('R2 upload failed, falling back to local storage:', r2Error.message);
                    url = saveLocally();
                    storage = 'local';
                }
            } else {
                url = saveLocally();
            }

            // Save file metadata
            const fileDoc = {
                tenant_id: request.tenantId,
                file_key: fileKey,
                original_filename: filename,
                mimetype,
                size: fileBuffer.length,
                uploaded_by: request.currentUser._id,
                created_at: new Date(),
                url,
                storage
            };

            const result = await db.collection('files').insertOne(fileDoc);

            // Audit log
            await db.collection('audit_logs').insertOne({
                tenant_id: request.tenantId,
                user_id: request.currentUser._id,
                action: 'file.uploaded',
                resource: 'file',
                resource_id: result.insertedId,
                timestamp: new Date(),
                metadata: { filename, size: fileBuffer.length }
            });

            return {
                success: true,
                fileId: result.insertedId,
                url: fileDoc.url,
                filename
            };

        } catch (error) {
            console.error('File upload error:', error);
            fastify.log.error({ err: error, stack: error.stack }, 'File upload error');
            return reply.status(500).send({ error: 'File upload failed', details: error.message, stack: error.stack });
        }
    });

    // Get file metadata
    fastify.get('/:fileId', {
        preHandler: [authMiddleware, tenantMiddleware, requirePermission('file:read')]
    }, async(request, reply) => {
        const db = fastify.db();
        const { fileId } = request.params;

        const objectId = toObjectId(fileId);
        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid file ID' });
        }

        const file = await db.collection('files').findOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        if (!file) {
            return reply.status(404).send({ error: 'File not found' });
        }

        return { file };
    });

    // Get signed URL for private file access
    fastify.get('/:fileId/signed-url', {
        preHandler: [authMiddleware, tenantMiddleware, requirePermission('file:read')]
    }, async(request, reply) => {
        const db = fastify.db();
        const { fileId } = request.params;

        const objectId = toObjectId(fileId);
        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid file ID' });
        }

        const file = await db.collection('files').findOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        if (!file) {
            return reply.status(404).send({ error: 'File not found' });
        }

        if (file.storage === 'local') {
            return { signedUrl: file.url };
        }

        const r2Client = getR2Client();
        if (!r2Client) {
            return reply.status(500).send({ error: 'R2 not configured' });
        }

        try {
            const command = new GetObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: file.file_key
            });

            const signedUrl = await getSignedUrl(r2Client, command, {
                expiresIn: 3600 // 1 hour
            });

            return { signedUrl };

        } catch (error) {
            fastify.log.error('Signed URL error:', error);
            return reply.status(500).send({ error: 'Failed to generate signed URL' });
        }
    });

    // Delete file
    fastify.delete('/:fileId', {
        preHandler: [authMiddleware, tenantMiddleware, requirePermission('file:delete')]
    }, async(request, reply) => {
        const db = fastify.db();
        const { fileId } = request.params;

        const objectId = toObjectId(fileId);
        if (!objectId) {
            return reply.status(400).send({ error: 'Invalid file ID' });
        }

        const file = await db.collection('files').findOne({
            _id: objectId,
            tenant_id: request.tenantId
        });

        if (!file) {
            return reply.status(404).send({ error: 'File not found' });
        }

        try {
            if (file.storage === 'local') {
                const safeTenant = String(request.tenantId).replace(/[^a-f0-9]/gi, '');
                const fileName = path.basename(file.file_key.split('/').pop());
                const absolutePath = path.join(getUploadsDir(), safeTenant, fileName);
                if (fs.existsSync(absolutePath)) {
                    fs.unlinkSync(absolutePath);
                }
            } else {
                const r2Client = getR2Client();
                if (!r2Client) {
                    return reply.status(500).send({ error: 'R2 not configured' });
                }
                // Delete from R2
                await r2Client.send(new DeleteObjectCommand({
                    Bucket: process.env.R2_BUCKET_NAME,
                    Key: file.file_key
                }));
            }

            // Delete from database
            await db.collection('files').deleteOne({ _id: objectId });

            // Audit log
            await db.collection('audit_logs').insertOne({
                tenant_id: request.tenantId,
                user_id: request.currentUser._id,
                action: 'file.deleted',
                resource: 'file',
                resource_id: objectId,
                timestamp: new Date()
            });

            return { success: true };

        } catch (error) {
            fastify.log.error('File delete error:', error);
            return reply.status(500).send({ error: 'File deletion failed' });
        }
    });

    // List files
    fastify.get('/', {
        preHandler: [authMiddleware, tenantMiddleware, requirePermission('file:read')]
    }, async(request, reply) => {
        const db = fastify.db();
        const { page = 1, limit = 50 } = request.query;

        const files = await db.collection('files')
            .find({ tenant_id: request.tenantId })
            .sort({ created_at: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .toArray();

        return { files };
    });
}