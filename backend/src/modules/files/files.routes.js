import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { toObjectId } from '../../utils/mongodb.js';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { tenantMiddleware } from '../../middlewares/tenant.middleware.js';
import { requirePermission } from '../../middlewares/rbac.middleware.js';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';

// Configure R2 client (S3-compatible)
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

export default async function fileRoutes(fastify, options) {
  
  // Upload file
  fastify.post('/upload', {
    preHandler: [authMiddleware, tenantMiddleware, requirePermission('file:upload')]
  }, async (request, reply) => {
    const db = fastify.db();
    const data = await request.file();
    
    if (!data) {
      return reply.status(400).send({ error: 'No file provided' });
    }
    
    const { filename, mimetype } = data;
    
    // Generate unique file key with tenant isolation
    const fileId = crypto.randomBytes(16).toString('hex');
    const fileExtension = filename.split('.').pop();
    const fileKey = `${request.tenantId}/${fileId}.${fileExtension}`;
    
    try {
      // Buffer the file
      const chunks = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const fileBuffer = Buffer.concat(chunks);
      
      // Upload to R2
      await r2Client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileKey,
        Body: fileBuffer,
        ContentType: mimetype,
        Metadata: {
          tenant_id: request.tenantId.toString(),
          uploaded_by: request.currentUser._id.toString(),
          original_filename: filename
        }
      }));
      
      // Save file metadata
      const fileDoc = {
        tenant_id: request.tenantId,
        file_key: fileKey,
        original_filename: filename,
        mimetype,
        size: fileBuffer.length,
        uploaded_by: request.currentUser._id,
        created_at: new Date(),
        url: `${process.env.R2_PUBLIC_URL}/${fileKey}`
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
      fastify.log.error('File upload error:', error);
      return reply.status(500).send({ error: 'File upload failed' });
    }
  });
  
  // Get file metadata
  fastify.get('/:fileId', {
    preHandler: [authMiddleware, tenantMiddleware, requirePermission('file:read')]
  }, async (request, reply) => {
    const db = fastify.db();
    const { fileId } = request.params;
    
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
  }, async (request, reply) => {
    const db = fastify.db();
    const { fileId } = request.params;
    
    const file = await db.collection('files').findOne({
      _id: objectId,
      tenant_id: request.tenantId
    });
    
    if (!file) {
      return reply.status(404).send({ error: 'File not found' });
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
  }, async (request, reply) => {
    const db = fastify.db();
    const { fileId } = request.params;
    
    const file = await db.collection('files').findOne({
      _id: objectId,
      tenant_id: request.tenantId
    });
    
    if (!file) {
      return reply.status(404).send({ error: 'File not found' });
    }
    
    try {
      // Delete from R2
      await r2Client.send(new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: file.file_key
      }));
      
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
  }, async (request, reply) => {
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
